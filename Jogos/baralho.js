/* ══════════════════════════════════════════════════════════════
   JOGOS DE BARALHO — hub + sistema de salas (Firebase RTDB)
   ------------------------------------------------------------
   Ponto de entrada único pro card "Jogos de Baralho" do hub:
   escolha de jogo (Truco | Uno em breve), sistema de salas
   multiplayer (código de 4 letras + salas públicas) e delegação
   da partida em si pro "motor" que cada jogo registra.

   POR QUE UM MÓDULO SEPARADO DE party.js?
   O Coruja Party (Jogos/party.js) também fala direto com o RTDB pra
   N jogadores, mas ali o anfitrião só manda "próximo minigame +
   seed" e cada aparelho reporta um placar no final — não tem jogada
   a jogada. Truco (e qualquer jogo de baralho por vir) precisa de
   estado compartilhado jogada a jogada (quem jogou qual carta, de
   quem é a vez, aposta em andamento) com o anfitrião validando cada
   lance. Por isso este módulo usa o MESMO padrão de sala/identidade/
   onDisconnect de party.js e multiplayer.js, mas guarda um nó
   "game" por sala que o motor de cada jogo lê/escreve à vontade.
   Ver claude/database.rules.json (nó "salasBaralho").

   Como um novo jogo de baralho se registra (ver Jogos/truco.js):
     window.AngatubaBaralho.registrarModo('truco', {
       nome: 'Truco Paulista', min: 2, max: 4,
       iniciar: function (ctx) { ... },  // ctx: ver _criarContexto()
       parar: function () { ... }
     });

   UI: assim como Jogos/negocios.js, este módulo desenha tudo dentro
   de #baralho-root (dentro da tela #jogo-baralho) — nenhum markup
   do jogo mora no index.html além da casca da tela (ver o resumo de
   integração entregue junto com estes arquivos).

   Exporta:
     window.BaralhoGame     { preparar, parar, disponivel }  -> chamado pelo hub (_jogoLoader/_abrirJogo)
     window.AngatubaBaralho { criarSala, entrarSala, listarSalas,
                               marcarPronto, iniciarPartida, sair,
                               on, registrarModo, ... }        -> ponte com os motores

   Pendências conhecidas
   ----------------------
   1. Reconexão automática do jogador (hoje, cair da sala = sair da
      sala; reentrar com o mesmo código funciona, mas não há
      "retomar sozinho" se o app fechar no meio de uma partida).
   2. Chat/sinais dos 4 jogadores (fora do escopo desta rodada).
   3. Bot pra substituir jogador desconectado em partida de 4 — por
      enquanto o anfitrião só cancela e avisa (ver truco.js).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config (mesmo alfabeto/padrão de party.js e multiplayer.js) ── */
  var ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
  var TAM_CODIGO = 4;
  var MAX_NOME = 20;
  var SALA_EXPIRA_MS = 20 * 60 * 1000; // lobby parado por 20min = expirado (partida em si não expira)
  var MAX_TENTATIVAS_CODIGO = 5;

  var _MODOS = {}; // registro cheio (pós-load): { truco: { nome, min, max, iniciar, parar } }
  // Catálogo estático (nome/min/max) — existe pra desenhar a tela de
  // escolha de jogo e o lobby ANTES do arquivo do modo (truco.min.js)
  // terminar de carregar. Cada motor mora num JOGOS_EXTERNOS próprio no
  // hub.js (sem card nem tela dele — mesmo esquema de puff/ervilhas
  // dentro de party.js) e é buscado sob demanda com window._jogoLoader.
  // Novo jogo de baralho (ex.: Uno) = uma linha aqui + o arquivo dele
  // chamando registrarModo(). Ver o resumo de integração entregue.
  var _CATALOGO = {
    truco: { nome: 'Truco Paulista', min: 2, max: 4 }
  };
  var _promessasModos = {}; // chave -> Promise do _jogoLoader (evita pedir 2x)

  // Garante que o script do modo já rodou (e portanto já chamou
  // registrarModo) antes de usar def.iniciar/def.parar. callback(def|null).
  function _garantirModoCarregado(chave, callback) {
    if (_MODOS[chave] && typeof _MODOS[chave].iniciar === 'function') { callback(_MODOS[chave]); return; }
    if (typeof window._jogoLoader !== 'function') { callback(null); return; }
    if (!_promessasModos[chave]) _promessasModos[chave] = window._jogoLoader(chave);
    _promessasModos[chave].then(function () { callback(_MODOS[chave] || null); })
      .catch(function () { callback(null); });
  }

  // Pré-carrega todos os modos do catálogo assim que o hub de baralho
  // abre — na prática só o Truco por ora, então o custo é o mesmo de
  // abrir um minigame comum; evita a pessoa esperar no clique do card.
  function _precarregarModos() {
    Object.keys(_CATALOGO).forEach(function (chave) { _garantirModoCarregado(chave, function () { if (_tela === 'escolha' || _tela === 'criar') _renderizar(); }); });
  }

  /* ── Estado local ─────────────────────────────────────────────── */
  var _codigo = null;
  var _salaRef = null;
  var _souAnfitriao = false;
  var _meuUid = null;
  var _meuNome = null;
  var _listeners = [];   // { ref, evento, cb } abertos, pra desligar depois
  var _sala = null;      // último snapshot conhecido de salasBaralho/{codigo}
  var _motorAtivo = null; // { chave, api } do jogo em execução
  var _cbMotorSala = null; // callback único do motor ativo (ver onSala em _criarContexto)

  function disponivel() {
    return typeof firebase !== 'undefined' && !!firebase.database && !!firebase.auth;
  }

  /* ── Identidade (mesmo padrão de party.js/multiplayer.js) ───────
     Apelido: window.AngatubaGames.apelido() se existir, senão
     displayName, senão "Jogador" (máx 20 chars) — pedido explícito. */
  function _garantirIdentidade() {
    return new Promise(function (resolve, reject) {
      if (typeof firebase === 'undefined' || !firebase.auth) {
        reject(new Error('Jogos de Baralho indisponível agora.'));
        return;
      }
      var auth = firebase.auth();
      var atual = auth.currentUser;
      if (atual) {
        var apelido = (window.AngatubaGames && window.AngatubaGames.apelido && window.AngatubaGames.apelido());
        resolve({ uid: atual.uid, nome: String(apelido || atual.displayName || 'Jogador').slice(0, MAX_NOME) });
        return;
      }
      auth.signInAnonymously()
        .then(function (cred) { resolve({ uid: cred.user.uid, nome: 'Jogador' }); })
        .catch(function () { reject(new Error('Não foi possível entrar pra jogar. Tente de novo.')); });
    });
  }

  function _db() {
    if (typeof firebase === 'undefined' || !firebase.database) return null;
    try { return firebase.database(); } catch (e) { return null; }
  }

  function _codigoAleatorio() {
    var c = '';
    for (var i = 0; i < TAM_CODIGO; i++) c += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
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

  /* ── Handlers (equivalente ao AngatubaMP.on/AngatubaParty.on) ──── */
  var _handlers = {};
  function on(evento, cb) {
    if (!_handlers[evento]) _handlers[evento] = [];
    _handlers[evento].push(cb);
  }
  function _emit(evento, dado) {
    (_handlers[evento] || []).forEach(function (cb) {
      try { cb(dado); } catch (e) { console.error('[AngatubaBaralho]', evento, e); }
    });
  }

  /* ── Criar sala ──────────────────────────────────────────────────
     criarSala(modo, publica, maxJogadores) -> Promise<codigo> */
  function criarSala(modo, publica, maxJogadores) {
    if (!disponivel()) return Promise.reject(new Error('Jogos de Baralho indisponível neste navegador.'));
    var def = _MODOS[modo];
    if (!def) return Promise.reject(new Error('Modo de jogo desconhecido: ' + modo));
    var max = Math.max(def.min, Math.min(def.max, Number(maxJogadores) || def.min));

    return _garantirIdentidade().then(function (eu) {
      _meuUid = eu.uid; _meuNome = eu.nome;
      var db = _db();
      if (!db) return Promise.reject(new Error('Jogos de Baralho indisponível agora.'));
      return _tentarCriar(db, eu, modo, !!publica, max, 0);
    });
  }

  function _tentarCriar(db, eu, modo, publica, max, tentativa) {
    if (tentativa >= MAX_TENTATIVAS_CODIGO) return Promise.reject(new Error('Não consegui abrir uma sala. Tente de novo.'));
    var codigo = _codigoAleatorio();
    var ref = db.ref('salasBaralho/' + codigo);
    return ref.get().then(function (snap) {
      if (snap.exists()) return _tentarCriar(db, eu, modo, publica, max, tentativa + 1);

      return ref.set({
        anfitriao: { uid: eu.uid, nome: eu.nome },
        publica: publica,
        criadoEm: firebase.database.ServerValue.TIMESTAMP,
        modo: modo,
        maxJogadores: max,
        status: 'lobby'
      }).then(function () {
        return ref.child('jogadores/' + eu.uid).set({
          nome: eu.nome, pronto: false, seat: 0, entrouEm: firebase.database.ServerValue.TIMESTAMP
        });
      }).then(function () {
        _codigo = codigo; _salaRef = ref; _souAnfitriao = true;
        // Sala sem ninguém a mais entrar / anfitrião cair = some sozinha.
        ref.onDisconnect().remove();

        if (publica) {
          var refPublica = db.ref('salasBaralhoPublicas/' + codigo);
          refPublica.set({
            anfitriao: eu.nome, criadoEm: firebase.database.ServerValue.TIMESTAMP,
            modo: modo, maxJogadores: max, qtdJogadores: 1
          }).catch(function () {});
          refPublica.onDisconnect().remove();
        }
        _observarSala();
        return codigo;
      });
    });
  }

  /* ── Entrar em sala existente ────────────────────────────────────
     entrarSala(codigoBruto) -> Promise<codigo> */
  function entrarSala(codigoBruto) {
    if (!disponivel()) return Promise.reject(new Error('Jogos de Baralho indisponível neste navegador.'));
    var codigo = String(codigoBruto || '').trim().toUpperCase();
    if (codigo.length !== TAM_CODIGO) return Promise.reject(new Error('Código inválido.'));

    return _garantirIdentidade().then(function (eu) {
      _meuUid = eu.uid; _meuNome = eu.nome;
      var db = _db();
      if (!db) return Promise.reject(new Error('Jogos de Baralho indisponível agora.'));
      var ref = db.ref('salasBaralho/' + codigo);

      return ref.get().then(function (snap) {
        if (!snap.exists()) return Promise.reject(new Error('Sala não encontrada. Confira o código.'));
        var sala = snap.val();
        if (sala.status !== 'lobby') return Promise.reject(new Error('Essa sala já começou ou terminou.'));
        if (!sala.criadoEm || (Date.now() - sala.criadoEm) > SALA_EXPIRA_MS) {
          return Promise.reject(new Error('Essa sala expirou. Peça um código novo.'));
        }
        var jogadores = sala.jogadores || {};
        var qtd = Object.keys(jogadores).length;
        var jaEstou = jogadores[eu.uid];
        if (!jaEstou && qtd >= sala.maxJogadores) return Promise.reject(new Error('Sala cheia.'));

        var assento = jaEstou ? jaEstou.seat : _proximoAssento(jogadores, sala.maxJogadores);
        return ref.child('jogadores/' + eu.uid).set({
          nome: eu.nome, pronto: jaEstou ? !!jaEstou.pronto : false, seat: assento,
          entrouEm: firebase.database.ServerValue.TIMESTAMP
        }).then(function () {
          _codigo = codigo; _salaRef = ref; _souAnfitriao = (sala.anfitriao && sala.anfitriao.uid === eu.uid);
          if (!_souAnfitriao) ref.child('jogadores/' + eu.uid).onDisconnect().remove();
          _observarSala();
          return codigo;
        });
      });
    });
  }

  function _proximoAssento(jogadoresObj, max) {
    var ocupados = {};
    Object.keys(jogadoresObj || {}).forEach(function (uid) { ocupados[jogadoresObj[uid].seat] = true; });
    for (var i = 0; i < max; i++) if (!ocupados[i]) return i;
    return 0;
  }

  /* ── Lista de salas públicas abertas agora ───────────────────── */
  function listarSalas(modo, callback) {
    if (typeof callback !== 'function') callback = function () {};
    if (!disponivel()) { callback([]); return function () {}; }
    var cancelado = false;
    var desligar = function () {};
    _garantirIdentidade().then(function () {
      if (cancelado) return;
      var db = _db();
      if (!db) { callback([]); return; }
      var ref = db.ref('salasBaralhoPublicas').limitToLast(30);
      var handler = function (snap) {
        var lista = [];
        snap.forEach(function (filho) {
          var v = filho.val() || {};
          if (modo && v.modo !== modo) return;
          if (!v.criadoEm || (Date.now() - v.criadoEm) > SALA_EXPIRA_MS) return;
          lista.push({
            codigo: filho.key,
            anfitriao: String(v.anfitriao || 'Jogador').slice(0, MAX_NOME),
            modo: v.modo, maxJogadores: v.maxJogadores || 0, qtdJogadores: v.qtdJogadores || 0
          });
        });
        callback(lista);
      };
      ref.on('value', handler);
      desligar = function () { try { ref.off('value', handler); } catch (e) {} };
    }).catch(function () { callback([]); });
    return function () { cancelado = true; desligar(); };
  }

  /* ── Observação contínua da sala ─────────────────────────────── */
  function _observarSala() {
    if (!_salaRef) return;
    _escutar(_salaRef, 'value', function (snap) {
      var sala = snap.val();
      if (!sala) { _emit('salaFechada'); _limparTudo(); return; }
      _sala = sala; _sala._codigo = _codigo;
      _atualizarEspelhoPublico();
      _emit('salaMudou', sala);
    });
  }

  function _atualizarEspelhoPublico() {
    if (!_souAnfitriao || !_sala || !_sala.publica || !_codigo) return;
    if (_sala.status !== 'lobby') return; // partida em andamento some da listagem pública
    var db = _db();
    if (!db) return;
    db.ref('salasBaralhoPublicas/' + _codigo + '/qtdJogadores')
      .set(Object.keys(_sala.jogadores || {}).length)
      .catch(function () {});
  }

  function marcarPronto(pronto) {
    if (!_salaRef || !_meuUid) return;
    _salaRef.child('jogadores/' + _meuUid + '/pronto').set(!!pronto).catch(function () {});
  }

  function definirMaxJogadores(n) {
    if (!_souAnfitriao || !_salaRef) return;
    _salaRef.child('maxJogadores').set(Number(n)).catch(function () {});
  }

  // Anfitrião: começa a partida (o motor do modo faz o "deal" inicial —
  // ver iniciarPartida em truco.js, chamado depois que status vira 'jogando').
  function iniciarPartida() {
    if (!_souAnfitriao || !_salaRef || !_sala) return;
    var def = _MODOS[_sala.modo];
    if (!def) return;
    var jogadores = Object.keys(_sala.jogadores || {});
    if (jogadores.length !== _sala.maxJogadores || jogadores.length < def.min) return;
    _salaRef.update({ status: 'jogando' }).catch(function () {});
    if (_sala.publica && _codigo) {
      var db = _db();
      if (db) {
        var refPublica = db.ref('salasBaralhoPublicas/' + _codigo);
        refPublica.onDisconnect().cancel();
        refPublica.remove().catch(function () {});
      }
    }
  }

  // Anfitrião: volta o status pra 'lobby' (fim de partida / cancelamento)
  // e limpa o estado do jogo, mantendo a mesma sala/galera.
  function voltarAoLobby() {
    if (!_souAnfitriao || !_salaRef) return;
    _salaRef.update({ status: 'lobby', game: null }).catch(function () {});
  }

  /* ── Sair da sala / limpeza (mesmo padrão de party.js/sair) ──── */
  function sair() {
    _pararListeners();
    if (_motorAtivo && _motorAtivo.api.parar) { try { _motorAtivo.api.parar(); } catch (e) {} }
    _motorAtivo = null;
    _cbMotorSala = null;
    if (_salaRef) {
      try { _salaRef.onDisconnect().cancel(); } catch (e) {}
      if (_souAnfitriao) {
        var salaRefAoSair = _salaRef;
        var codigoAoSair = _codigo;
        var limparPublica = Promise.resolve();
        if (_sala && _sala.publica) {
          try {
            var db = _db();
            if (db) {
              var refPublica = db.ref('salasBaralhoPublicas/' + codigoAoSair);
              refPublica.onDisconnect().cancel();
              limparPublica = refPublica.remove().catch(function () {});
            }
          } catch (e) {}
        }
        limparPublica.then(function () { try { salaRefAoSair.remove(); } catch (e) {} });
      } else if (_meuUid) {
        try {
          _salaRef.child('jogadores/' + _meuUid).onDisconnect().cancel();
          _salaRef.child('jogadores/' + _meuUid).remove();
        } catch (e) {}
      }
    }
    _limparTudo();
  }

  function _limparTudo() {
    _codigo = null; _salaRef = null; _souAnfitriao = false;
    _sala = null; _motorAtivo = null;
  }

  function estado() { return _sala; }
  function meuUid() { return _meuUid; }
  function souAnfitriao() { return _souAnfitriao; }
  function codigoSala() { return _codigo; }
  // Pra UI: sempre inclui nome/min/max de tudo no catálogo, mesmo antes
  // do arquivo do modo carregar (ver _CATALOGO/_garantirModoCarregado).
  function modos() {
    var todos = {};
    Object.keys(_CATALOGO).forEach(function (chave) { todos[chave] = _MODOS[chave] || _CATALOGO[chave]; });
    return todos;
  }

  /* ── Contexto entregue ao motor (Jogos/truco.js etc.) ─────────── */
  function _criarContexto(container) {
    return {
      db: _db(),
      salaRef: _salaRef,
      salaCodigo: _codigo,
      uid: _meuUid,
      nome: _meuNome,
      souAnfitriao: _souAnfitriao,
      container: container,
      salaSnapshot: function () { return _sala; },
      onSala: function (cb) { _cbMotorSala = cb; if (_sala) cb(_sala); },
      // O motor chama isto quando a partida termina (ou é abandonada) e
      // deve voltar ao lobby DESTA MESMA sala (revanche fica a critério
      // do motor: ele decide se zera o placar ou só volta ao lobby).
      voltarAoLobby: voltarAoLobby,
      sairDoJogo: sair
    };
  }

  window.AngatubaBaralho = {
    disponivel: disponivel,
    criarSala: criarSala,
    entrarSala: entrarSala,
    listarSalas: listarSalas,
    marcarPronto: marcarPronto,
    definirMaxJogadores: definirMaxJogadores,
    iniciarPartida: iniciarPartida,
    voltarAoLobby: voltarAoLobby,
    sair: sair,
    on: on,
    estado: estado,
    meuUid: meuUid,
    souAnfitriao: souAnfitriao,
    codigoSala: codigoSala,
    modos: modos,
    registrarModo: function (chave, definicao) { _MODOS[chave] = definicao; }
  };

  /* ═══════════════════ UI: telas do #baralho-root ═════════════════
     Assim como Jogos/negocios.js, tudo é desenhado dentro de UM
     container fixo (#baralho-root, já presente dentro da tela
     #jogo-baralho no index.html) — nenhum markup do jogo mora no
     index.html além dessa casca. Esta seção só CONSOME a API pública
     acima e os eventos emitidos por on(...); nenhuma função abaixo
     mexe em Firebase direto (mesma separação usada em party.js). */

  var _raiz = null;
  var _montado = false;
  var _tela = 'escolha'; // escolha | criar | lobby | jogo
  var _modoEscolhido = null;
  var _pararListaPublicas = null;

  function _cls(nome) { return 'brl-' + nome; }
  function _q(sel) { return _raiz ? _raiz.querySelector(sel) : null; }
  function _limpar(no) { while (no.firstChild) no.removeChild(no.firstChild); }
  function _escHTML(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _el(tag, classes, attrs) {
    var e = document.createElement(tag);
    if (classes) (Array.isArray(classes) ? classes : classes.split(' ')).forEach(function (c) { e.classList.add(_cls(c)); });
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'texto') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    return e;
  }

  var _msgTimer = null;
  function _flash(texto) {
    if (!_raiz) return;
    var caixa = _q('.' + _cls('flash'));
    if (!caixa) { caixa = _el('div', 'flash'); _raiz.appendChild(caixa); }
    caixa.textContent = texto;
    caixa.classList.add(_cls('flash-visivel'));
    clearTimeout(_msgTimer);
    _msgTimer = setTimeout(function () { caixa.classList.remove(_cls('flash-visivel')); }, 3200);
  }

  function _montar() {
    _raiz = document.getElementById('baralho-root');
    if (!_raiz) return false;
    _montado = true;
    return true;
  }

  function _renderizar() {
    if (!_raiz) return;
    _limpar(_raiz);
    if (_tela === 'escolha') _renderEscolha();
    else if (_tela === 'criar') _renderCriarEntrar();
    else if (_tela === 'lobby') _renderLobby();
  }

  function _renderEscolha() {
    var wrap = _el('div', 'escolha');
    wrap.appendChild(_el('h2', 'titulo', { texto: 'Jogos de Baralho' }));
    wrap.appendChild(_el('p', 'subtitulo', { texto: 'Chame a turma pra uma partida.' }));

    var lista = _el('div', 'lista-modos');
    var chaves = Object.keys(modos());
    chaves.forEach(function (chave) {
      var def = modos()[chave];
      var card = _el('button', 'card-modo', { type: 'button' });
      card.appendChild(_el('span', 'card-modo-nome', { texto: def.nome }));
      card.appendChild(_el('span', 'card-modo-jogadores', { texto: def.min + ' a ' + def.max + ' jogadores' }));
      card.addEventListener('click', function () { _modoEscolhido = chave; _tela = 'criar'; _renderizar(); });
      lista.appendChild(card);
    });
    if (!modos().uno) {
      var emBreve = _el('div', 'card-modo-em-breve');
      emBreve.appendChild(_el('span', 'card-modo-nome', { texto: 'Uno' }));
      emBreve.appendChild(_el('span', 'card-modo-jogadores', { texto: 'Em breve' }));
      lista.appendChild(emBreve);
    }
    wrap.appendChild(lista);
    _raiz.appendChild(wrap);
  }

  function _renderCriarEntrar() {
    var def = modos()[_modoEscolhido];
    if (!def) { _tela = 'escolha'; _renderizar(); return; }
    var wrap = _el('div', 'criar-entrar');
    wrap.appendChild(_el('h2', 'titulo', { texto: def.nome }));

    var voltarTopo = _el('button', 'link-voltar', { type: 'button', texto: '← Escolher outro jogo' });
    voltarTopo.addEventListener('click', function () {
      if (_pararListaPublicas) { _pararListaPublicas(); _pararListaPublicas = null; }
      _tela = 'escolha'; _renderizar();
    });
    wrap.appendChild(voltarTopo);

    var erroEl = _el('p', 'erro');
    erroEl.style.display = 'none';
    function mostrarErro(msg) { erroEl.textContent = msg; erroEl.style.display = msg ? 'block' : 'none'; }

    // ---- criar sala ----
    var blocoCriar = _el('div', 'bloco');
    blocoCriar.appendChild(_el('h3', 'bloco-titulo', { texto: 'Criar sala' }));
    var opcoes = def.max > def.min ? [def.min, def.max] : [def.min];
    var escolhido = { v: opcoes[0] };
    var seletor = _el('div', 'seletor-jogadores');
    opcoes.forEach(function (n) {
      var btn = _el('button', 'chip-num', { type: 'button', texto: n + ' jogadores' });
      if (n === escolhido.v) btn.classList.add(_cls('chip-ativo'));
      btn.addEventListener('click', function () {
        escolhido.v = n;
        seletor.querySelectorAll('.' + _cls('chip-num')).forEach(function (b) { b.classList.remove(_cls('chip-ativo')); });
        btn.classList.add(_cls('chip-ativo'));
      });
      seletor.appendChild(btn);
    });
    blocoCriar.appendChild(seletor);

    var checkPublica = _el('label', 'check-publica');
    var inputPublica = document.createElement('input');
    inputPublica.type = 'checkbox'; inputPublica.checked = true;
    checkPublica.appendChild(inputPublica);
    checkPublica.appendChild(document.createTextNode(' Sala pública (aparece na lista)'));
    blocoCriar.appendChild(checkPublica);

    var btnCriar = _el('button', 'btn-primario', { type: 'button', texto: 'Criar sala' });
    btnCriar.addEventListener('click', function () {
      btnCriar.disabled = true; mostrarErro('');
      criarSala(_modoEscolhido, inputPublica.checked, escolhido.v).then(function () {
        if (_pararListaPublicas) { _pararListaPublicas(); _pararListaPublicas = null; }
        _tela = 'lobby'; _renderizar();
      }).catch(function (err) {
        btnCriar.disabled = false;
        mostrarErro(err && err.message ? err.message : 'Não foi possível criar a sala.');
      });
    });
    blocoCriar.appendChild(btnCriar);
    wrap.appendChild(blocoCriar);

    // ---- entrar por código ----
    var blocoCodigo = _el('div', 'bloco');
    blocoCodigo.appendChild(_el('h3', 'bloco-titulo', { texto: 'Entrar com código' }));
    var linhaCodigo = _el('div', 'linha-codigo');
    var campoCodigo = document.createElement('input');
    campoCodigo.type = 'text'; campoCodigo.maxLength = TAM_CODIGO; campoCodigo.placeholder = 'ABCD';
    campoCodigo.className = _cls('campo-codigo');
    campoCodigo.addEventListener('input', function () { campoCodigo.value = campoCodigo.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    var btnEntrar = _el('button', 'btn-secundario', { type: 'button', texto: 'Entrar' });
    btnEntrar.addEventListener('click', function () {
      btnEntrar.disabled = true; mostrarErro('');
      entrarSala(campoCodigo.value).then(function () {
        if (_pararListaPublicas) { _pararListaPublicas(); _pararListaPublicas = null; }
        _tela = 'lobby'; _renderizar();
      }).catch(function (err) {
        btnEntrar.disabled = false;
        mostrarErro(err && err.message ? err.message : 'Não foi possível entrar na sala.');
      });
    });
    linhaCodigo.appendChild(campoCodigo); linhaCodigo.appendChild(btnEntrar);
    blocoCodigo.appendChild(linhaCodigo);
    wrap.appendChild(blocoCodigo);

    wrap.appendChild(erroEl);

    // ---- salas públicas ----
    var blocoPublicas = _el('div', 'bloco');
    blocoPublicas.appendChild(_el('h3', 'bloco-titulo', { texto: 'Salas públicas' }));
    var listaPublicas = _el('div', 'lista-publicas');
    blocoPublicas.appendChild(listaPublicas);
    wrap.appendChild(blocoPublicas);

    if (_pararListaPublicas) { _pararListaPublicas(); _pararListaPublicas = null; }
    _pararListaPublicas = listarSalas(_modoEscolhido, function (lista) {
      _limpar(listaPublicas);
      if (!lista.length) {
        listaPublicas.appendChild(_el('p', 'vazio', { texto: 'Nenhuma sala pública agora. Crie a primeira!' }));
        return;
      }
      lista.forEach(function (s) {
        var linha = _el('div', 'linha-publica');
        linha.appendChild(_el('span', 'linha-publica-nome', { texto: s.anfitriao }));
        linha.appendChild(_el('span', 'linha-publica-info', { texto: s.qtdJogadores + '/' + s.maxJogadores }));
        var btn = _el('button', 'btn-secundario', { type: 'button', texto: 'Entrar' });
        btn.addEventListener('click', function () {
          btn.disabled = true; mostrarErro('');
          entrarSala(s.codigo).then(function () {
            if (_pararListaPublicas) { _pararListaPublicas(); _pararListaPublicas = null; }
            _tela = 'lobby'; _renderizar();
          }).catch(function (err) {
            btn.disabled = false;
            mostrarErro(err && err.message ? err.message : 'Não foi possível entrar na sala.');
          });
        });
        linha.appendChild(btn);
        listaPublicas.appendChild(linha);
      });
    });

    _raiz.appendChild(wrap);
  }

  function _renderLobby() {
    var sala = estado();
    if (!sala) return;
    var def = modos()[sala.modo] || { nome: sala.modo, min: 2, max: sala.maxJogadores };

    var wrap = _el('div', 'lobby');
    wrap.appendChild(_el('h2', 'titulo', { texto: def.nome }));

    var caixaCodigo = _el('div', 'caixa-codigo');
    caixaCodigo.appendChild(_el('span', 'caixa-codigo-label', { texto: 'Código da sala' }));
    caixaCodigo.appendChild(_el('span', 'caixa-codigo-valor', { texto: codigoSala() }));
    var btnCopiar = _el('button', 'btn-copiar', { type: 'button', texto: 'Copiar' });
    btnCopiar.addEventListener('click', function () {
      try { navigator.clipboard.writeText(codigoSala()); btnCopiar.textContent = 'Copiado!'; setTimeout(function () { btnCopiar.textContent = 'Copiar'; }, 1400); } catch (e) {}
    });
    caixaCodigo.appendChild(btnCopiar);
    wrap.appendChild(caixaCodigo);

    var listaJog = _el('div', 'lista-jogadores');
    var jogadores = sala.jogadores || {};
    var uids = Object.keys(jogadores).sort(function (a, b) { return (jogadores[a].seat || 0) - (jogadores[b].seat || 0); });
    uids.forEach(function (uid) {
      var j = jogadores[uid];
      var linha = _el('div', 'linha-jogador');
      if (sala.anfitriao && sala.anfitriao.uid === uid) linha.classList.add(_cls('linha-jogador-anfitriao'));
      linha.appendChild(_el('span', 'linha-jogador-nome', { texto: j.nome + (uid === meuUid() ? ' (você)' : '') }));
      linha.appendChild(_el('span', j.pronto ? 'chip-pronto' : 'chip-esperando', { texto: j.pronto ? 'Pronto' : 'Esperando' }));
      listaJog.appendChild(linha);
    });
    for (var i = uids.length; i < sala.maxJogadores; i++) {
      var vazio = _el('div', 'linha-jogador linha-jogador-vazia');
      vazio.appendChild(_el('span', 'linha-jogador-nome', { texto: 'Aguardando jogador…' }));
      listaJog.appendChild(vazio);
    }
    wrap.appendChild(listaJog);

    if (souAnfitriao() && def.max > def.min) {
      var seletor = _el('div', 'seletor-jogadores');
      [def.min, def.max].forEach(function (n) {
        var btn = _el('button', 'chip-num', { type: 'button', texto: n + ' jogadores' });
        if (n === sala.maxJogadores) btn.classList.add(_cls('chip-ativo'));
        btn.addEventListener('click', function () {
          if (uids.length > n) { _flash('Já tem gente demais na sala pra esse tamanho.'); return; }
          definirMaxJogadores(n);
        });
        seletor.appendChild(btn);
      });
      wrap.appendChild(seletor);
    }

    var euPronto = jogadores[meuUid()] && jogadores[meuUid()].pronto;
    var btnPronto = _el('button', euPronto ? 'btn-secundario' : 'btn-primario', { type: 'button', texto: euPronto ? 'Cancelar prontidão' : 'Estou pronto' });
    btnPronto.addEventListener('click', function () { marcarPronto(!euPronto); });
    wrap.appendChild(btnPronto);

    if (souAnfitriao()) {
      var todosProntos = uids.length === sala.maxJogadores && uids.length >= def.min && uids.every(function (uid) { return jogadores[uid].pronto; });
      var btnIniciar = _el('button', 'btn-primario', { type: 'button', texto: 'Começar partida' });
      if (!todosProntos) { btnIniciar.disabled = true; btnIniciar.classList.add(_cls('btn-desabilitado')); }
      btnIniciar.addEventListener('click', iniciarPartida);
      wrap.appendChild(btnIniciar);
    }

    var btnSair = _el('button', 'link-voltar', { type: 'button', texto: '← Sair da sala' });
    btnSair.addEventListener('click', function () { sair(); _tela = 'escolha'; _renderizar(); });
    wrap.appendChild(btnSair);

    _raiz.appendChild(wrap);
  }

  function _entrarNaTelaDeJogo(sala) {
    // O motor (ex.: truco.min.js) pode ainda não ter chegado — acontece
    // com um convidado que entrou na sala direto por código, sem passar
    // pela tela de escolha (que é quem normalmente dispara o preload).
    _tela = 'jogo';
    _limpar(_raiz);
    var carregando = _el('div', 'carregando-modo', { texto: 'Carregando o jogo…' });
    _raiz.appendChild(carregando);
    _garantirModoCarregado(sala.modo, function (def) {
      if (_tela !== 'jogo' || !_raiz) return; // saiu da tela enquanto carregava
      _limpar(_raiz);
      if (!def || typeof def.iniciar !== 'function') { _flash('Não foi possível carregar o jogo.'); _tela = 'lobby'; _renderizar(); return; }
      var palco = _el('div', 'palco-jogo');
      _raiz.appendChild(palco);
      _motorAtivo = { chave: sala.modo, api: def };
      def.iniciar(_criarContexto(palco));
    });
  }

  on('salaMudou', function (sala) {
    if (_cbMotorSala) _cbMotorSala(sala); // encaminha pro motor ativo, se houver
    if (!_montado) return;
    if (sala.status === 'jogando' && _tela !== 'jogo') { _entrarNaTelaDeJogo(sala); return; }
    if (sala.status === 'lobby' && _tela === 'jogo') {
      if (_motorAtivo && _motorAtivo.api.parar) { try { _motorAtivo.api.parar(); } catch (e) {} }
      _motorAtivo = null;
      _cbMotorSala = null;
      _tela = 'lobby';
    }
    if (_tela === 'lobby') _renderizar();
  });
  on('salaFechada', function () {
    if (!_montado) return;
    if (_motorAtivo && _motorAtivo.api.parar) { try { _motorAtivo.api.parar(); } catch (e) {} }
    _motorAtivo = null;
    _cbMotorSala = null;
    _tela = 'escolha';
    _flash('A sala foi encerrada.');
    _renderizar();
  });

  /* ── API do hub (window.BaralhoGame) ─────────────────────────────
     _abrirJogo/_jogoLoader chamam preparar(); _pararJogosExternos()
     (e o botão "← Voltar aos jogos" da tela) chamam parar() — ver o
     resumo de integração entregue junto com estes arquivos. */
  function preparar() {
    if (!_montado && !_montar()) return; // #baralho-root não existe no index.html ainda
    _precarregarModos();
    if (estado()) {
      _tela = estado().status === 'jogando' ? 'jogo' : 'lobby';
      if (_tela === 'jogo') _entrarNaTelaDeJogo(estado()); else _renderizar();
    } else {
      _tela = 'escolha'; _modoEscolhido = null;
      _renderizar();
    }
  }

  function parar() {
    if (_motorAtivo && _motorAtivo.api.parar) { try { _motorAtivo.api.parar(); } catch (e) {} }
    _motorAtivo = null;
    _cbMotorSala = null;
    if (_pararListaPublicas) { _pararListaPublicas(); _pararListaPublicas = null; }
    // Não sai da sala automaticamente (permite retomar ao reabrir o
    // card) — sala só é abandonada pelo botão explícito "Sair da sala".
    if (_raiz) _limpar(_raiz);
  }

  window.BaralhoGame = {
    disponivel: disponivel,
    preparar: preparar,
    iniciar: preparar, // alias — ver pedido original do módulo
    parar: parar
  };
})();
