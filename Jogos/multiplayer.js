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
     amigo digita e entra). Salas podem ser públicas (aparecem
     numa lista pra qualquer um entrar com 1 toque) ou privadas
     (só quem tem o código entra) — ver criarSala(publica).
   - O Firebase Realtime Database (NÃO o Firestore, que já é usado
     pro ranking) serve só de "correio" pra combinar a conexão:
     troca oferta/resposta SDP e candidatos ICE do WebRTC.
   - Salas públicas ganham um espelho leve em salasPublicas/{codigo}
     (só nome do anfitrião + data) — NUNCA os dados sensíveis da
     sinalização (oferta/resposta/ICE), que ficam só em salas/{codigo}
     com leitura restrita a quem já conhece o código. Ver
     claude/database.rules.json.
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
     AngatubaMP.criarSala(true).then(function (codigo) {
       // mostra "codigo" pro jogador compartilhar (true = pública,
       // também aparece na lista; false = só por código)
     }).catch(function (err) { // mostra err.message });

     // Lista de salas públicas abertas agora:
     var pararDeOuvir = AngatubaMP.listarSalas(function (lista) {
       // lista = [{ codigo, nome }, ...]
     });
     // pararDeOuvir() quando a tela some.

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
  var _salaPublica = false;   // true se a sala atual (quando anfitrião) tem espelho em salasPublicas/
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

  // publica: true = a sala também ganha um espelho leve em salasPublicas/
  // (aparece na lista "salas abertas agora"); false/omitido = só por código.
  function criarSala(publica) {
    if (!disponivel()) return Promise.reject(new Error('Multiplayer indisponível neste navegador.'));
    return _garantirIdentidade().then(function (eu) {
      var db = _db();
      if (!db) return Promise.reject(new Error('Multiplayer indisponível agora.'));
      return _tentarCriar(db, eu, !!publica, 0);
    });
  }

  function _tentarCriar(db, eu, publica, tentativa) {
    if (tentativa >= 5) return Promise.reject(new Error('Não consegui abrir uma sala. Tente de novo.'));
    var codigo = _codigoAleatorio();
    var ref = db.ref('salas/' + codigo);
    return ref.get().then(function (snap) {
      if (snap.exists()) return _tentarCriar(db, eu, publica, tentativa + 1);

      return ref.set({
        anfitriao: { uid: eu.uid, nome: eu.nome },
        publica: publica,
        criadoEm: firebase.database.ServerValue.TIMESTAMP
      }).then(function () {
        _salaRef = ref;
        _souAnfitriao = true;
        _salaPublica = publica;
        // Se o anfitrião cair/fechar a aba antes de alguém entrar, a sala
        // some sozinha — evita salas fantasmas acumulando no banco.
        ref.onDisconnect().remove();

        // Sala pública: espelho leve em salasPublicas/ (só nome + data —
        // nunca oferta/resposta/ICE) pra tela "salas abertas agora" listar
        // sem precisar ler a sala inteira (essa fica restrita a quem tem
        // o código). Ver claude/database.rules.json.
        if (publica) {
          var refPublica = db.ref('salasPublicas/' + codigo);
          refPublica.set({ nome: eu.nome, criadoEm: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
          refPublica.onDisconnect().remove();
          // Alguém entrou: a sala deixa de estar "aberta" — some da lista.
          _escutar(ref.child('convidado'), 'value', function (snapConv) {
            if (snapConv.exists()) db.ref('salasPublicas/' + codigo).remove().catch(function () {});
          });
        }

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
          // Sem isto, um convidado que cai (sem passar por sair()) deixa o
          // nó preso pra sempre: a sala trava porque ninguém mais consegue
          // entrar (ver A1.5, mesmo padrão já usado em party.js:220).
          ref.child('convidado').onDisconnect().remove();
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

  // Lista salas públicas abertas agora (via salasPublicas/, o espelho leve
  // — ver criarSala). callback recebe um array [{ codigo, nome }, ...] toda
  // vez que a lista muda. Retorna uma função pra parar de ouvir.
  function listarSalas(callback) {
    if (typeof callback !== 'function') callback = function () {};
    if (!disponivel()) { callback([]); return function () {}; }
    var cancelado = false;
    var desligar = function () {};
    _garantirIdentidade().then(function () {
      if (cancelado) return;
      var db = _db();
      if (!db) { callback([]); return; }
      // limitToLast: um passivo de salas mortas acumulado não vira uma
      // lista que só cresce pra sempre (ver A1.8).
      var ref = db.ref('salasPublicas').limitToLast(30);
      var handler = function (snap) {
        var lista = [];
        snap.forEach(function (filho) {
          var v = filho.val() || {};
          // Defesa extra contra sala fantasma (onDisconnect que não rodou,
          // etc.): mesmo critério de expiração usado em entrarSala() —
          // mesmo padrão já usado em party.js:247 (ver A1.8).
          if (!v.criadoEm || (Date.now() - v.criadoEm) > SALA_EXPIRA_MS) return;
          lista.push({ codigo: filho.key, nome: String(v.nome || 'Jogador').slice(0, 20) });
        });
        callback(lista);
      };
      ref.on('value', handler);
      desligar = function () { try { ref.off('value', handler); } catch (e) {} };
    }).catch(function () { callback([]); });
    return function () { cancelado = true; desligar(); };
  }

  function enviar(dado) {
    if (!_canal || _canal.readyState !== 'open') return false;
    try { _canal.send(JSON.stringify(dado)); return true; } catch (e) { return false; }
  }

  function sair() {
    // on() nunca some sozinho: sem isto, os handlers de 'mensagem' de um
    // jogo continuam vivos depois de sair dele. Como Ping Pong e Tanques
    // usam os mesmos tipos de pacote (oi/p/e/rr/pr), abrir os dois na mesma
    // sessão faz cada um processar os pacotes do outro (ver A1.2).
    _handlers = { conectado: [], mensagem: [], desconectado: [], erro: [] };
    _pararListeners();
    _limparPeer();
    if (_salaRef) {
      var salaRefAtual = _salaRef;
      try { salaRefAtual.onDisconnect().cancel(); } catch (e) {}
      if (_souAnfitriao) {
        var _apagarSala = function () { try { salaRefAtual.remove(); } catch (e) {} };
        if (_salaPublica) {
          // Apaga o espelho ANTES da sala: a regra de escrita de
          // salasPublicas/$codigo exige provar (lendo salas/$codigo) que
          // quem apaga ainda é o anfitrião. Apagando a sala primeiro essa
          // prova some e a remoção do espelho é negada — a sala fica
          // fantasma na lista pública pra sempre (ver A1.4).
          try {
            var db = _db();
            if (db) {
              var refPublica = db.ref('salasPublicas/' + salaRefAtual.key);
              refPublica.onDisconnect().cancel();
              refPublica.remove().catch(function () {}).then(_apagarSala);
            } else {
              _apagarSala();
            }
          } catch (e) { _apagarSala(); }
        } else {
          _apagarSala();
        }
      } else {
        // Convidado: sem isto o nó fica preso e a sala trava pra quem
        // ficou (ver A1.5).
        try { salaRefAtual.child('convidado').remove(); } catch (e) {}
      }
    }
    _salaRef = null;
    _souAnfitriao = false;
    _salaPublica = false;
  }

  window.AngatubaMP = {
    disponivel: disponivel,
    criarSala: criarSala,
    entrarSala: entrarSala,
    listarSalas: listarSalas,
    enviar: enviar,
    sair: sair,
    on: on
  };
})();
