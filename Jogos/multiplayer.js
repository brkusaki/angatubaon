/* ══════════════════════════════════════════════════════════════
   AngatubaON — Multiplayer Core (sala + sinalização WebRTC)
   ------------------------------------------------------------
   Peça de infraestrutura REUTILIZÁVEL: não é um jogo, é a camada
   de rede que qualquer jogo 1x1 em tempo real (Ping Pong, etc.)
   usa por baixo. Não depende de nenhum jogo específico e nenhum
   jogo específico depende dela até ser carregada.

   Como funciona:
   - Dois jogadores trocam "sala" via código de 4 letras (o
     anfitrião cria, manda o código pro amigo por WhatsApp, o
     amigo digita e entra).
   - O Firebase Realtime Database (NÃO o Firestore, que já é usado
     pro ranking) serve só de "correio" pra combinar a conexão:
     troca oferta/resposta SDP e candidatos ICE do WebRTC.
   - Depois que a conexão fecha, o jogo em si conversa direto
     entre os dois navegadores (RTCDataChannel), sem passar pelo
     Firebase de novo — sem custo por partida, latência baixa.
   - Funciona sem login: se ninguém estiver logado, entra
     silenciosamente com uma conta anônima do Firebase Auth só
     pra ter permissão de escrever na sala (precisa habilitar o
     provedor "Anônimo" no console — ver claude/database.rules.json).

   Uso (por um jogo futuro):
     if (!AngatubaMP.disponivel()) { // esconde o botão de multiplayer }

     // Anfitrião:
     AngatubaMP.criarSala().then(function (codigo) {
       // mostra "codigo" pro jogador compartilhar
     }).catch(function (err) { // mostra err.message });

     // Convidado:
     AngatubaMP.entrarSala('ABCD').catch(function (err) { ... });

     AngatubaMP.on('conectado', function () { // começa a partida });
     AngatubaMP.on('mensagem', function (dado) { // aplica estado recebido });
     AngatubaMP.on('desconectado', function () { // pausa/encerra });
     AngatubaMP.on('erro', function (err) { // mostra erro });

     AngatubaMP.enviar({ tipo: 'raquete', y: 0.42 });
     AngatubaMP.sair(); // ao terminar a partida ou sair da tela
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Servidores STUN públicos (resolvem a maioria das conexões). Se no
  // futuro aparecerem relatos de "não conecta" em redes muito restritivas
  // (4G de operadora, wifi corporativo/escolar), adicionar um servidor
  // TURN aqui resolve — STUN sozinho não atravessa todo tipo de NAT.
  var ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  var SALA_EXPIRA_MS = 5 * 60 * 1000; // sala sem ninguém entrar por 5min = expirada
  var ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I

  var _pc = null;             // RTCPeerConnection ativa
  var _canal = null;          // RTCDataChannel ativo
  var _salaRef = null;        // referência RTDB da sala atual
  var _souAnfitriao = false;
  var _listeners = [];        // { ref, evento, cb } abertos, pra desligar depois
  var _handlers = { conectado: [], mensagem: [], desconectado: [], erro: [] };

  function disponivel() {
    return typeof RTCPeerConnection !== 'undefined'
      && typeof firebase !== 'undefined'
      && !!firebase.database;
  }

  function on(evento, cb) {
    if (!_handlers[evento]) _handlers[evento] = [];
    _handlers[evento].push(cb);
  }

  function _emit(evento, dado) {
    (_handlers[evento] || []).forEach(function (cb) {
      try { cb(dado); } catch (e) { console.error('[AngatubaMP]', evento, e); }
    });
  }

  function _db() {
    if (typeof firebase === 'undefined' || !firebase.database) return null;
    try { return firebase.database(); } catch (e) { return null; }
  }

  // Garante alguém autenticado (mesmo que anônimo) pra ter permissão de
  // escrever na sala. Se já tem um cliente logado (fluxo do ranking),
  // usa esse uid/nome; senão entra anônimo só pra essa sessão.
  function _garantirIdentidade() {
    return new Promise(function (resolve, reject) {
      if (typeof firebase === 'undefined' || !firebase.auth) {
        reject(new Error('Multiplayer indisponível agora.'));
        return;
      }
      var auth = firebase.auth();
      var atual = auth.currentUser;
      if (atual) {
        resolve({ uid: atual.uid, nome: (atual.displayName || 'Jogador').slice(0, 20) });
        return;
      }
      auth.signInAnonymously()
        .then(function (cred) { resolve({ uid: cred.user.uid, nome: 'Jogador' }); })
        .catch(function () { reject(new Error('Não foi possível entrar pra jogar. Tente de novo.')); });
    });
  }

  function _codigoAleatorio() {
    var c = '';
    for (var i = 0; i < 4; i++) c += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
    return c;
  }

  function _escutar(ref, evento, cb) {
    ref.on(evento, cb);
    _listeners.push({ ref: ref, evento: evento, cb: cb });
  }

  function _pararListeners() {
    _listeners.forEach(function (l) { try { l.ref.off(l.evento, l.cb); } catch (e) {} });
    _listeners = [];
  }

  function _limparPeer() {
    if (_canal) { try { _canal.close(); } catch (e) {} _canal = null; }
    if (_pc) { try { _pc.close(); } catch (e) {} _pc = null; }
  }

  function _configurarCanalDados(canal) {
    _canal = canal;
    canal.onopen = function () { _emit('conectado'); };
    canal.onclose = function () { _emit('desconectado'); };
    canal.onerror = function () { _emit('erro', new Error('Conexão com o outro jogador falhou.')); };
    canal.onmessage = function (ev) {
      try { _emit('mensagem', JSON.parse(ev.data)); } catch (e) { /* mensagem não-JSON: ignora */ }
    };
  }

  function _liberarFilaIce(pc) {
    (pc._filaIce || []).forEach(function (cand) {
      pc.addIceCandidate(new RTCIceCandidate(cand)).catch(function () {});
    });
    pc._filaIce = [];
  }

  function _novoPeerConnection(salaRef, souAnfitriao) {
    var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc._filaIce = [];
    var campoIceLocal = souAnfitriao ? 'iceAnfitriao' : 'iceConvidado';
    var campoIceRemoto = souAnfitriao ? 'iceConvidado' : 'iceAnfitriao';

    pc.onicecandidate = function (ev) {
      if (ev.candidate) salaRef.child(campoIceLocal).push(ev.candidate.toJSON());
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') _emit('desconectado');
    };

    _escutar(salaRef.child(campoIceRemoto), 'child_added', function (snap) {
      var cand = snap.val();
      if (!cand) return;
      if (pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(cand)).catch(function () {});
      else pc._filaIce.push(cand);
    });

    return pc;
  }

  function criarSala() {
    if (!disponivel()) return Promise.reject(new Error('Multiplayer indisponível neste navegador.'));
    return _garantirIdentidade().then(function (eu) {
      var db = _db();
      if (!db) return Promise.reject(new Error('Multiplayer indisponível agora.'));
      return _tentarCriar(db, eu, 0);
    });
  }

  function _tentarCriar(db, eu, tentativa) {
    if (tentativa >= 5) return Promise.reject(new Error('Não consegui abrir uma sala. Tente de novo.'));
    var codigo = _codigoAleatorio();
    var ref = db.ref('salas/' + codigo);
    return ref.get().then(function (snap) {
      if (snap.exists()) return _tentarCriar(db, eu, tentativa + 1);

      return ref.set({
        anfitriao: { uid: eu.uid, nome: eu.nome },
        criadoEm: firebase.database.ServerValue.TIMESTAMP
      }).then(function () {
        _salaRef = ref;
        _souAnfitriao = true;
        // Se o anfitrião cair/fechar a aba antes de alguém entrar, a sala
        // some sozinha — evita salas fantasmas acumulando no banco.
        ref.onDisconnect().remove();

        var pc = _novoPeerConnection(ref, true);
        _pc = pc;
        _configurarCanalDados(pc.createDataChannel('jogo'));

        _escutar(ref.child('resposta'), 'value', function (snap) {
          var resp = snap.val();
          if (resp && !pc.remoteDescription) {
            pc.setRemoteDescription(new RTCSessionDescription(resp))
              .then(function () { _liberarFilaIce(pc); })
              .catch(function () { _emit('erro', new Error('Falha ao conectar com o outro jogador.')); });
          }
        });

        return pc.createOffer().then(function (oferta) {
          return pc.setLocalDescription(oferta).then(function () {
            return ref.child('oferta').set({ type: oferta.type, sdp: oferta.sdp });
          });
        }).then(function () { return codigo; });
      });
    });
  }

  function entrarSala(codigoBruto) {
    if (!disponivel()) return Promise.reject(new Error('Multiplayer indisponível neste navegador.'));
    var codigo = String(codigoBruto || '').trim().toUpperCase();
    if (!codigo) return Promise.reject(new Error('Digite o código da sala.'));

    return _garantirIdentidade().then(function (eu) {
      var db = _db();
      if (!db) return Promise.reject(new Error('Multiplayer indisponível agora.'));
      var ref = db.ref('salas/' + codigo);

      return ref.get().then(function (snap) {
        if (!snap.exists()) return Promise.reject(new Error('Sala não encontrada. Confira o código.'));
        var sala = snap.val();
        if (sala.convidado) return Promise.reject(new Error('Essa sala já tem dois jogadores.'));
        if (!sala.criadoEm || (Date.now() - sala.criadoEm) > SALA_EXPIRA_MS) {
          return Promise.reject(new Error('Essa sala expirou. Peça um código novo.'));
        }
        if (!sala.oferta) return Promise.reject(new Error('Sala ainda não está pronta. Tente de novo em instantes.'));

        _salaRef = ref;
        _souAnfitriao = false;

        return ref.child('convidado').set({ uid: eu.uid, nome: eu.nome }).then(function () {
          var pc = _novoPeerConnection(ref, false);
          _pc = pc;
          pc.ondatachannel = function (ev) { _configurarCanalDados(ev.channel); };

          return pc.setRemoteDescription(new RTCSessionDescription(sala.oferta)).then(function () {
            _liberarFilaIce(pc);
            return pc.createAnswer();
          }).then(function (resposta) {
            return pc.setLocalDescription(resposta).then(function () {
              return ref.child('resposta').set({ type: resposta.type, sdp: resposta.sdp });
            });
          });
        });
      });
    });
  }

  function enviar(dado) {
    if (!_canal || _canal.readyState !== 'open') return false;
    try { _canal.send(JSON.stringify(dado)); return true; } catch (e) { return false; }
  }

  function sair() {
    _pararListeners();
    _limparPeer();
    if (_salaRef) {
      try { _salaRef.onDisconnect().cancel(); } catch (e) {}
      if (_souAnfitriao) { try { _salaRef.remove(); } catch (e) {} }
    }
    _salaRef = null;
    _souAnfitriao = false;
  }

  window.AngatubaMP = {
    disponivel: disponivel,
    criarSala: criarSala,
    entrarSala: entrarSala,
    enviar: enviar,
    sair: sair,
    on: on
  };
})();
