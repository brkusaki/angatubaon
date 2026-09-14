/* ══════════════════════════════════════════════════════════════
   AngatubaON — Multiplayer Core (sala + sinalização WebRTC + voz)
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

   Globais expostos: window.AngatubaMP com
     disponivel, criarSala, entrarSala, listarSalas, enviar, sair, on,
     habilitarAudio, desabilitarAudio, microfoneMutado,
     setMicrofoneMutado, audioAtivo, audioRemotoAtivo

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

   ── VOZ P2P (opcional) — Etapa 3.1 ────────────────────────────
   O áudio viaja na MESMA RTCPeerConnection do jogo (mesma porta,
   mesmo ICE, mesmo custo zero). É 100% opcional: quem nunca chamar
   habilitarAudio() tem exatamente o fluxo de antes — nenhum
   getUserMedia é pedido em criarSala()/entrarSala(), nenhuma m-line
   de áudio entra no SDP, nada muda.

     AngatubaMP.habilitarAudio()          // → Promise (pede o microfone)
       .then(function () { // voz ligada
         })
       .catch(function (err) { alert(err.message); }); // PT-BR

     AngatubaMP.desabilitarAudio();       // desliga o mic de vez (libera o aparelho)
     AngatubaMP.setMicrofoneMutado(true); // mute temporário (não libera o mic)
     AngatubaMP.microfoneMutado();        // → bool
     AngatubaMP.audioAtivo();             // → bool (minha voz está indo)
     AngatubaMP.audioRemotoAtivo();       // → bool (estou recebendo a voz do outro)

     AngatubaMP.on('audio', function (e) {
       // e = { local: bool, remoto: bool }
       // disparado quando minha voz liga/desliga e quando a voz do
       // outro começa/para de chegar. É o único evento de áudio —
       // não existem 'audioLocal'/'audioRemoto' separados.
     });

   QUANDO DÁ PRA LIGAR A VOZ: antes OU depois de conectar.
   - Antes de criarSala()/entrarSala(): a intenção fica guardada e a
     track entra já na primeira oferta/resposta. É o caminho mais
     barato e o recomendado pra UI da Etapa 3.2 (botão de mic no
     lobby, antes de criar/entrar).
   - Depois de conectado: funciona também, via RENEGOCIAÇÃO PELO
     PRÓPRIO DATACHANNEL. Os campos 'oferta' e 'resposta' no RTDB são
     write-once (".validate": "!data.exists()" em
     claude/database.rules.json) e "$outro": false impede criar campos
     novos — ou seja, o RTDB NÃO serve pra uma segunda negociação.
     Então o SDP novo vai empacotado como mensagem de controle dentro
     do DataChannel já aberto ({ __mp: 'sdp', desc }), que é P2P e não
     passa por regra nenhuma. Nada mudou no database.rules.json nem no
     GAS. Padrão "perfect negotiation": em colisão (os dois ligam o mic
     no mesmo instante), o convidado é o "educado" e cede.
   - Se ligar a voz enquanto a conexão ainda está sendo montada, a
     renegociação é feita sozinha assim que o DataChannel abre.
   - Mensagens com a chave "__mp" são reservadas do core e NUNCA
     chegam no handler 'mensagem' dos jogos (os jogos usam "t").
   - Candidatos ICE novos continuam indo pelo RTDB (os listeners da
     sala seguem vivos até sair()); adicionar uma track reaproveita
     o transporte já negociado, então normalmente nem surgem.

   ── POLIMENTO 3.3 ─────────────────────────────────────────────
   - getUserMedia pede echoCancellation/noiseSuppression/autoGainControl
     (ver RESTRICOES_AUDIO). São constraints simples, não "exact": quem
     não suporta ignora. Se ainda assim algum navegador rejeitar por
     causa delas, o pedido é refeito com { audio: true }.
   - Queda de conexão apaga o microfone na hora (_encerrarAudio dentro de
     _emitDesconectadoUmaVez), não só no sair() — o indicador de
     "gravando" do aparelho não fica aceso na tela de resultado.
   - audioRemotoAtivo() também olha track.muted: quando o outro lado
     desliga a voz, a track daqui fica mutada (não 'ended'), então sem
     isso o indicador remoto nunca apagava.
   - Autoplay barrado pelo navegador não quebra nada: o áudio remoto
     tenta tocar de novo no próximo toque/tecla, em silêncio.

   Limitações conhecidas (aceitas nesta etapa):
   - Sem AEC próprio: em viva-voz com os dois aparelhos no mesmo ambiente
     ainda pode haver eco. O cancelamento é o do navegador/SO ou nada.
   - Sem servidor TURN. Em NAT muito restritivo a conexão (jogo E voz)
     não fecha — igual já era antes do áudio.
   - Voz só existe no AngatubaMP (Ping Pong e Tanques). Party e
     Baralho usam só RTDB, sem WebRTC: PARTY/BARALHO SEM VOZ NESTA
     ETAPA.
   - Sem UI nos jogos ainda — isso é a Etapa 3.2. Aqui só a API.
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

  // Eco (3.3): pedidas como constraints simples (não "exact"), então
  // navegador que não conhece alguma delas simplesmente ignora em vez de
  // rejeitar. Resolve o eco normal de fone/alto-falante baixo; em viva-voz
  // com os dois aparelhos no mesmo ambiente AINDA PODE HAVER ECO — não tem
  // AEC próprio aqui, é o do navegador/SO ou nada.
  var RESTRICOES_AUDIO = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false
  };

  var SALA_EXPIRA_MS = 5 * 60 * 1000; // sala sem ninguém entrar por 5min = expirada
  var ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I

  var _pc = null;             // RTCPeerConnection ativa
  var _canal = null;          // RTCDataChannel ativo
  var _salaRef = null;        // referência RTDB da sala atual
  var _souAnfitriao = false;
  var _salaPublica = false;   // true se a sala atual (quando anfitrião) tem espelho em salasPublicas/
  var _listeners = [];        // { ref, evento, cb } abertos, pra desligar depois
  var _handlers = { conectado: [], mensagem: [], desconectado: [], erro: [], audio: [] };
  var _jaEmitiuDesconexao = false; // evita emitir 'desconectado' duas vezes pela mesma queda (A1.13)

  // ── Estado do áudio opcional (Etapa 3.1) ──────────────────────
  var _intencaoAudio = false; // usuário pediu voz (vale mesmo antes do pc existir)
  var _streamLocal = null;    // MediaStream do microfone
  var _pedidoMic = null;      // Promise de getUserMedia em andamento (evita 2 pedidos juntos)
  var _geracaoAudio = 0;      // invalida um getUserMedia antigo que voltar tarde
  var _sendersAudio = [];     // RTCRtpSender das tracks locais já entregues ao pc
  var _micMutado = false;
  var _elAudioRemoto = null;  // <audio> escondido que toca a voz do outro
  var _esperandoGesto = false; // autoplay barrado: esperando um toque pra tentar de novo
  var _fazendoOferta = false; // perfect negotiation
  var _educado = true;        // convidado = educado (cede em colisão de ofertas)

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
    _sendersAudio = [];
    _fazendoOferta = false;
  }

  // Garante um único disparo de 'desconectado' por queda: canal.onclose e
  // pc.onconnectionstatechange podem disparar os dois pra mesma queda
  // (ver A1.13). Zerada em sair().
  function _emitDesconectadoUmaVez() {
    if (_jaEmitiuDesconexao) return;
    _jaEmitiuDesconexao = true;
    // 3.3: a conexão morreu — não existe mais ninguém pra ouvir. Apaga o
    // microfone AQUI (e não só no sair()), senão o indicador de "gravando"
    // do aparelho fica aceso enquanto a tela de resultado estiver aberta e
    // a stream sobrevive órfã até o jogador sair do jogo. O 'audio' emitido
    // por _encerrarAudio() sai ANTES do 'desconectado', então a UI dos
    // jogos já volta pro estado desligado.
    _encerrarAudio();
    _emit('desconectado');
  }

  // ── Áudio: microfone local ────────────────────────────────────

  function _mensagemErroMic(err) {
    var nome = err && (err.name || err.code) ? String(err.name || err.code) : '';
    if (nome === 'NotAllowedError' || nome === 'PermissionDeniedError' || nome === 'SecurityError') {
      return 'Você precisa permitir o microfone pra falar com o outro jogador.';
    }
    if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError' || nome === 'OverconstrainedError') {
      return 'Não encontrei um microfone neste aparelho.';
    }
    if (nome === 'NotReadableError' || nome === 'TrackStartError') {
      return 'Não consegui abrir o microfone — pode estar em uso por outro app.';
    }
    return 'Não consegui ligar o microfone agora. Tente de novo.';
  }

  function _pararStreamLocal() {
    if (!_streamLocal) return;
    _streamLocal.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    _streamLocal = null;
  }

  function _tocarAudioRemoto(stream) {
    if (typeof document === 'undefined') return;
    if (!_elAudioRemoto) {
      var el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('aria-hidden', 'true');
      el.style.display = 'none';
      try { (document.body || document.documentElement).appendChild(el); } catch (e) { return; }
      _elAudioRemoto = el;
    }
    _elAudioRemoto.srcObject = stream;
    _tentarTocarRemoto();
  }

  // Autoplay de áudio normalmente já passou por gesto do usuário (ele tocou
  // em criar/entrar na sala e no botão de mic), mas se o navegador barrar
  // mesmo assim não é motivo pra quebrar a partida: fica sem som e o
  // PRÓXIMO toque em qualquer lugar tenta de novo — o primeiro toque no
  // botão de mic já basta. Falha silenciosa, sem aviso na tela.
  function _tentarTocarRemoto() {
    if (!_elAudioRemoto) return;
    var p;
    try { p = _elAudioRemoto.play(); } catch (e) { _armarGestoAudio(); return; }
    if (p && p.catch) p.catch(function () { _armarGestoAudio(); });
  }

  function _armarGestoAudio() {
    if (_esperandoGesto || typeof document === 'undefined') return;
    _esperandoGesto = true;
    var retomar = function () {
      document.removeEventListener('pointerdown', retomar, true);
      document.removeEventListener('touchend', retomar, true);
      document.removeEventListener('keydown', retomar, true);
      _esperandoGesto = false;
      if (_elAudioRemoto && _elAudioRemoto.srcObject) _tentarTocarRemoto();
    };
    document.addEventListener('pointerdown', retomar, true);
    document.addEventListener('touchend', retomar, true);
    document.addEventListener('keydown', retomar, true);
  }

  function _removerAudioRemoto() {
    if (!_elAudioRemoto) return;
    try { _elAudioRemoto.pause(); } catch (e) {}
    try { _elAudioRemoto.srcObject = null; } catch (e) {}
    try {
      if (_elAudioRemoto.parentNode) _elAudioRemoto.parentNode.removeChild(_elAudioRemoto);
    } catch (e) {}
    _elAudioRemoto = null;
  }

  function audioAtivo() {
    if (_streamLocal) {
      return _streamLocal.getAudioTracks().some(function (t) { return t.readyState === 'live'; });
    }
    return !!_intencaoAudio;
  }

  function audioRemotoAtivo() {
    if (!_elAudioRemoto || !_elAudioRemoto.srcObject) return false;
    var faixas = _elAudioRemoto.srcObject.getAudioTracks ? _elAudioRemoto.srcObject.getAudioTracks() : [];
    // 3.3: quando o outro lado chama desabilitarAudio(), o removeTrack dele
    // deixa a track DAQUI mutada (t.muted = true) — o readyState só vira
    // 'ended' quando a conexão inteira cai. Sem checar .muted o pontinho
    // verde ficava aceso pra sempre depois que o outro desligava o mic.
    return faixas.some(function (t) { return t.readyState === 'live' && !t.muted; });
  }

  function _emitirAudio() {
    _emit('audio', { local: audioAtivo(), remoto: audioRemotoAtivo() });
  }

  // Entrega as tracks do microfone pro pc. Se o pc ainda não existe, não
  // faz nada — criarSala()/entrarSala() chamam isto de novo assim que
  // criam a conexão (é aí que a intenção guardada vira track de verdade).
  function _aplicarAudioNoPeer() {
    if (!_pc || !_streamLocal) return;
    if (_sendersAudio.length) return; // já entregue
    _streamLocal.getAudioTracks().forEach(function (t) {
      try { _sendersAudio.push(_pc.addTrack(t, _streamLocal)); } catch (e) {}
    });
  }

  // true quando existe track local que ainda não está saindo de verdade —
  // acontece quando o mic foi ligado depois da oferta/resposta inicial (a
  // m-line de áudio não existia ainda). Aí precisa renegociar.
  function _audioPrecisaNegociar() {
    if (!_pc || !_sendersAudio.length || typeof _pc.getTransceivers !== 'function') return false;
    var trs = _pc.getTransceivers();
    return _sendersAudio.some(function (s) {
      for (var i = 0; i < trs.length; i++) {
        if (trs[i].sender === s) {
          var d = trs[i].currentDirection;
          return !(d === 'sendrecv' || d === 'sendonly');
        }
      }
      return true;
    });
  }

  // Pede o mic com as constraints de eco; se algum navegador teimar e
  // rejeitar por causa delas (OverconstrainedError), tenta o pedido simples
  // em vez de deixar o jogador sem voz por um detalhe de qualidade.
  function _pedirMicrofone() {
    var md = navigator.mediaDevices;
    return md.getUserMedia(RESTRICOES_AUDIO).catch(function (err) {
      var nome = err && err.name ? String(err.name) : '';
      if (nome === 'OverconstrainedError' || nome === 'ConstraintNotSatisfiedError') {
        return md.getUserMedia({ audio: true, video: false });
      }
      throw err;
    });
  }

  function habilitarAudio() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Seu navegador não permite usar o microfone aqui.'));
    }
    if (_streamLocal && audioAtivo()) { _intencaoAudio = true; return Promise.resolve(); }
    if (_pedidoMic) return _pedidoMic;

    _intencaoAudio = true;
    var geracao = _geracaoAudio;
    var pedido = _pedirMicrofone()
      .then(function (stream) {
        if (geracao === _geracaoAudio) _pedidoMic = null;
        // Desligou a voz (ou saiu da sala) enquanto o navegador perguntava
        // da permissão: não deixa o mic aceso por nada.
        if (!_intencaoAudio || geracao !== _geracaoAudio) {
          stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
          return;
        }
        _streamLocal = stream;
        if (_micMutado) {
          stream.getAudioTracks().forEach(function (t) { t.enabled = false; });
        }
        _aplicarAudioNoPeer();
        // Já conectado? addTrack dispara onnegotiationneeded e a renegociação
        // sai pelo DataChannel. Ainda conectando? a oferta/resposta inicial
        // já leva o áudio, ou o onopen do canal renegocia.
        _emitirAudio();
      })
      .catch(function (err) {
        if (geracao === _geracaoAudio) {
          _pedidoMic = null;
          _intencaoAudio = false;
        }
        throw new Error(_mensagemErroMic(err));
      });

    _pedidoMic = pedido;
    return pedido;
  }

  function desabilitarAudio() {
    _intencaoAudio = false;
    _micMutado = false;
    // Invalida um getUserMedia ainda no ar: se a permissão for concedida
    // depois deste desligamento, a stream que chegar é descartada na hora
    // em vez de acender o microfone sem ninguém pedir.
    _geracaoAudio++;
    _pedidoMic = null;
    if (_pc) {
      _sendersAudio.forEach(function (s) {
        // removeTrack dispara onnegotiationneeded → renegocia pelo canal e o
        // outro lado para de receber. Se o pc já morreu, não tem o que fazer.
        try { _pc.removeTrack(s); } catch (e) {}
      });
    }
    _sendersAudio = [];
    _pararStreamLocal();
    _emitirAudio();
  }

  // Apaga TUDO de áudio sem tentar renegociar nada — pra quando não existe
  // mais conexão viva (queda) ou estamos saindo da sala. Emite 'audio' uma
  // única vez, já com o <audio> remoto fora, pra UI não ver um estado
  // intermediário. _geracaoAudio++ aborta um getUserMedia ainda no ar: se a
  // permissão sair depois, a stream que chegar é descartada em vez de
  // acender o microfone sem ninguém pedir (ver habilitarAudio).
  function _encerrarAudio() {
    var tinhaAlgo = !!_streamLocal || _intencaoAudio || !!_elAudioRemoto || !!_pedidoMic;
    _intencaoAudio = false;
    _micMutado = false;
    _pedidoMic = null;
    _geracaoAudio++;
    _sendersAudio = [];
    _pararStreamLocal();
    _removerAudioRemoto();
    if (tinhaAlgo) _emitirAudio();
  }

  function microfoneMutado() { return !!_micMutado; }

  // Mute de verdade (a track continua viva, o aparelho continua "em uso",
  // só não sai som). Serve pro botão de mic da Etapa 3.2 sem ter que pedir
  // permissão de novo a cada toque.
  function setMicrofoneMutado(valor) {
    _micMutado = !!valor;
    if (_streamLocal) {
      _streamLocal.getAudioTracks().forEach(function (t) { t.enabled = !_micMutado; });
    }
    return _micMutado;
  }

  // ── Renegociação (SDP dentro do DataChannel) ──────────────────
  // Os campos 'oferta'/'resposta' do RTDB são write-once nas regras, então
  // qualquer negociação DEPOIS da primeira tem que sair por outro caminho:
  // o próprio canal P2P já aberto. Ver cabeçalho.

  function _enviarControle(msg) {
    if (!_canal || _canal.readyState !== 'open') return false;
    try { _canal.send(JSON.stringify(msg)); return true; } catch (e) { return false; }
  }

  function _negociar(pc) {
    if (!pc || _fazendoOferta) return;
    if (pc.signalingState !== 'stable') return;
    if (!_canal || _canal.readyState !== 'open') return;
    _fazendoOferta = true;
    pc.createOffer().then(function (oferta) {
      return pc.setLocalDescription(oferta);
    }).then(function () {
      _enviarControle({ __mp: 'sdp', desc: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
    }).catch(function () {
      /* renegociação é best-effort: falhar aqui não derruba a partida */
    }).then(function () { _fazendoOferta = false; });
  }

  function _tratarControle(msg) {
    var pc = _pc;
    if (!pc || msg.__mp !== 'sdp' || !msg.desc) return;
    var ehOferta = msg.desc.type === 'offer';
    var pronto = !_fazendoOferta && pc.signalingState === 'stable';
    // Colisão (os dois ligaram o mic junto): o anfitrião é o "mal-educado"
    // e ignora a oferta do outro; o convidado desfaz a dele e aceita.
    if (ehOferta && !pronto && !_educado) return;

    var antes = Promise.resolve();
    if (ehOferta && !pronto) {
      antes = pc.setLocalDescription({ type: 'rollback' }).catch(function () {});
    }
    antes.then(function () {
      return pc.setRemoteDescription(new RTCSessionDescription(msg.desc));
    }).then(function () {
      if (!ehOferta) return null;
      return pc.createAnswer().then(function (resp) {
        return pc.setLocalDescription(resp);
      }).then(function () {
        _enviarControle({ __mp: 'sdp', desc: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      });
    }).catch(function () {});
  }

  function _configurarCanalDados(canal) {
    _canal = canal;
    canal.onopen = function () {
      _emit('conectado');
      // Mic ligado antes do canal abrir mas fora da oferta inicial (ex.: o
      // convidado ligou a voz numa sala cuja oferta não tinha áudio): agora
      // dá pra renegociar.
      if (_audioPrecisaNegociar()) _negociar(_pc);
    };
    canal.onclose = function () { _emitDesconectadoUmaVez(); };
    canal.onerror = function () { _emit('erro', new Error('Conexão com o outro jogador falhou.')); };
    canal.onmessage = function (ev) {
      var dado;
      try { dado = JSON.parse(ev.data); } catch (e) { return; /* mensagem não-JSON: ignora */ }
      // Pacotes de controle do core (renegociação de áudio) NUNCA vazam pro
      // jogo: os jogos usam a chave "t", nunca "__mp".
      if (dado && dado.__mp) { _tratarControle(dado); return; }
      _emit('mensagem', dado);
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
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        _emitDesconectadoUmaVez();
      } else if (pc.connectionState === 'disconnected') {
        // Transitório: uma oscilação de rede costuma voltar sozinha pra
        // 'connected'. Só trata como queda de verdade se continuar assim
        // por ~5s (ver A1.13).
        setTimeout(function () {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            _emitDesconectadoUmaVez();
          }
        }, 5000);
      }
    };
    // Só dispara quando alguém liga/desliga a voz. Enquanto o canal não
    // abriu, a negociação inicial (RTDB) é quem manda — o onopen do canal
    // cobre o resto.
    pc.onnegotiationneeded = function () {
      if (!_canal || _canal.readyState !== 'open') return;
      _negociar(pc);
    };
    // Voz do outro jogador chegando.
    pc.ontrack = function (ev) {
      if (ev.track && ev.track.kind !== 'audio') return;
      var stream = (ev.streams && ev.streams[0]) ? ev.streams[0] : new MediaStream([ev.track]);
      _tocarAudioRemoto(stream);
      _emitirAudio();
      if (ev.track) {
        ev.track.onended = function () { _emitirAudio(); };
        ev.track.onmute = function () { _emitirAudio(); };
        ev.track.onunmute = function () { _emitirAudio(); };
      }
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
        _educado = false; // anfitrião não cede em colisão de renegociação
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
        // Voz ligada antes de criar a sala: a track entra ANTES do
        // createOffer, então a m-line de áudio já vai na primeira oferta e
        // nenhuma renegociação é necessária. É o caminho barato.
        _aplicarAudioNoPeer();
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
        // Sinalização já gasta (P2): um convidado anterior escreveu a
        // resposta e saiu — o onDisconnect só apaga o nó 'convidado', a
        // 'resposta' fica. Entrar aqui seria cair num buraco: o pc do
        // anfitrião já tem remoteDescription daquela negociação e ignora
        // respostas novas ("if (resp && !pc.remoteDescription)" em
        // _tentarCriar), então a tela ficaria em "conectando" pra sempre.
        // Reaproveitar a sala exigiria o anfitrião derrubar o pc e publicar
        // uma oferta nova — e tanto 'oferta' quanto 'resposta' têm
        // ".validate": "!data.exists()" nas regras, ou seja, são escritas
        // uma única vez por sala. Então o caminho honesto é avisar e pedir
        // um código novo, não fingir que dá pra conectar.
        if (sala.resposta) {
          return Promise.reject(new Error('Essa sala já foi usada em outra conexão. Peça um código novo pro anfitrião.'));
        }

        return ref.child('convidado').set({ uid: eu.uid, nome: eu.nome }).then(function () {
          // Só marca esta sala como "a nossa" depois que o set() realmente
          // vingou — dois convidados entrando juntos na mesma sala pública
          // não deixam mais _salaRef sujo pro que perdeu a corrida (A2.15).
          _salaRef = ref;
          _souAnfitriao = false;
          _educado = true; // convidado cede em colisão de renegociação
          // Sem isto, um convidado que cai (sem passar por sair()) deixa o
          // nó preso pra sempre: a sala trava porque ninguém mais consegue
          // entrar (ver A1.5, mesmo padrão já usado em party.js:220).
          ref.child('convidado').onDisconnect().remove();
          var pc = _novoPeerConnection(ref, false);
          _pc = pc;
          // Voz ligada antes de entrar: entrega a track ANTES do
          // setRemoteDescription pra ela casar com a m-line de áudio da
          // oferta, se o anfitrião tiver aberto voz. Se a oferta não tiver
          // áudio, a track fica pendurada e o onopen do canal renegocia.
          _aplicarAudioNoPeer();
          pc.ondatachannel = function (ev) { _configurarCanalDados(ev.channel); };

          return pc.setRemoteDescription(new RTCSessionDescription(sala.oferta)).then(function () {
            _liberarFilaIce(pc);
            return pc.createAnswer();
          }).then(function (resposta) {
            return pc.setLocalDescription(resposta).then(function () {
              return ref.child('resposta').set({ type: resposta.type, sdp: resposta.sdp });
            });
          });
        }).catch(function (err) {
          // Corrida: dois jogadores tocaram "Entrar" na mesma sala pública
          // ao mesmo tempo — o segundo set() é barrado pela regra
          // !data.exists() e sobe PERMISSION_DENIED cru (ver A2.15).
          if (err && (err.code === 'PERMISSION_DENIED' || /permission_denied/i.test(String(err.message || '')))) {
            throw new Error('Essa sala já tem dois jogadores.');
          }
          throw err;
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
    _handlers = { conectado: [], mensagem: [], desconectado: [], erro: [], audio: [] };
    // Áudio antes do _limparPeer(): o microfone tem que apagar junto com a
    // partida, senão o indicador de "gravando" fica aceso no aparelho e a
    // próxima sala herda track órfã. _intencaoAudio = false também aborta
    // um getUserMedia que ainda esteja no ar (ver habilitarAudio).
    _encerrarAudio();
    _pararListeners();
    _limparPeer();
    if (_salaRef) {
      var salaRefAtual = _salaRef;
      try { salaRefAtual.onDisconnect().cancel(); } catch (e) {}
      if (_souAnfitriao) {
        // O .catch() importa (P4): quando quem caiu foi o anfitrião, a sala
        // já não existe e a regra de salas/$codigo nega qualquer escrita
        // (o ".write" cai no ramo "data.child('anfitriao/uid')", que é null).
        // O try/catch só pega erro síncrono — sem o .catch(), a Promise
        // rejeitada do remove() virava um "Uncaught (in promise)
        // PERMISSION_DENIED" no console de quem só estava saindo direito.
        var _apagarSala = function () { try { salaRefAtual.remove().catch(function () {}); } catch (e) {} };
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
        // ficou (ver A1.5). O .catch() é o caso mais comum do P4 — o
        // anfitrião caiu, a sala inteira já foi embora e este remove é
        // negado pela regra; sem ele a saída limpa do convidado terminava
        // num "Uncaught (in promise) PERMISSION_DENIED".
        try { salaRefAtual.child('convidado').remove().catch(function () {}); } catch (e) {}
      }
    }
    _salaRef = null;
    _souAnfitriao = false;
    _salaPublica = false;
    _jaEmitiuDesconexao = false;
    _educado = true;
  }

  window.AngatubaMP = {
    disponivel: disponivel,
    criarSala: criarSala,
    entrarSala: entrarSala,
    listarSalas: listarSalas,
    enviar: enviar,
    sair: sair,
    on: on,
    habilitarAudio: habilitarAudio,
    desabilitarAudio: desabilitarAudio,
    microfoneMutado: microfoneMutado,
    setMicrofoneMutado: setMicrofoneMutado,
    audioAtivo: audioAtivo,
    audioRemotoAtivo: audioRemotoAtivo
  };
})();
