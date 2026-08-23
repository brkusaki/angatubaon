/* ═══════════════════════════════════════════════════════════════
   CORUJA PARTY — modo 2-4 jogadores (estilo Mario Party / Machine
   Party), lazy-loaded a partir de /Jogos/party.js quando o usuário
   abre o card "Coruja Party" no hub.
   ------------------------------------------------------------
   POR QUE NÃO REUTILIZA window.AngatubaMP (Jogos/multiplayer.js)?
   AngatubaMP é sinalização WebRTC pensada pra EXATAMENTE 2 pares
   (campos fixos "anfitriao"/"convidado", 1 canal de dados 1x1) — é a
   base do Ping Pong e da Batalha de Tanques. Coruja Party precisa de
   até 4 jogadores trocando pouquíssima informação (placar, "qual
   minigame agora", resultado final de cada rodada) — não dá pra
   encaixar isso num par WebRTC sem malabarismo (mesh de N conexões).
   Por isso este módulo fala DIRETO com o Firebase Realtime Database
   (o mesmo banco usado pela sinalização do multiplayer.js) como o
   próprio meio de sincronização — sem WebRTC nenhum. Isso combina
   com o pedido do produto: nada de sincronização frame-a-frame, o
   anfitrião é a fonte da verdade de "próximo jogo + seed + início da
   rodada", e cada aparelho só reporta o resultado final da rodada.
   Reaproveita, sim, os PADRÕES do multiplayer.js: código de sala de
   4 letras, sala pública com espelho leve em .../Publicas, identidade
   anônima via Firebase Auth, expiração automática (onDisconnect).
   Ver claude/database.rules.json (nó "salasParty") pras regras.

   POOL DE MINIGAMES (bloco 1 — estrutura + Puff):
   Cada rodada, o anfitrião sorteia um minigame da POOL abaixo. Dois
   tipos de adaptador:
     - "tela": reaproveita um jogo solo já existente (Pega a Coruja,
       Sequência, Piano), abrindo a tela normal dele e chamando
       comecar() direto — sem passar pela tela de menu solo. O jogo
       PRECISA ter o pulo de gato: ao chegar no fim, checa
       window.AngatubaGames.party.ativo() e, se true, chama
       reportarResultado(score) em vez do fluxo solo normal (ver o
       comentário "Modo Coruja Party" em speedtap.js/sequencia.js/
       piano.js — são 3-4 linhas cada, o resto do jogo é intocado).
     - "container": minigames feitos JÁ pensando em Party (Puff,
       Ervilhas), que recebem um <div> vazio e desenham tudo sozinhos
       (não têm tela própria em index.html).
   Exposto ao app pela ponte window.AngatubaGames.party (ver app.js).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────────── */
  var ALFABETO_CODIGO   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
  var SALA_EXPIRA_MS    = 10 * 60 * 1000; // lobby sem começar por 10min = expirada
  var MIN_JOGADORES     = 2;
  var MAX_JOGADORES     = 4;
  var TOTAL_RODADAS_PADRAO = 4;
  var PONTOS_POR_COLOCACAO = [5, 3, 2, 1]; // 1º,2º,3º,4º lugar na rodada
  var FOLGA_SEGURANCA_MS   = 20000; // além da duração estimada do minigame, antes de fechar a rodada com 0 pra quem não reportou

  /* ── Pool de minigames da Party ──────────────────────────────── */
  // "tetoSeg" (só speedtap/sequencia/piano) é um corte de segurança PRÓPRIO
  // do Party pros jogos de resistência (sem cronômetro): decorrido esse
  // tempo, a rodada termina com o score alcançado até ali (ver
  // forcarFimParty em sequencia.js/piano.js). "duracaoSeg" é só a
  // estimativa usada no timeout de segurança do host (reportar 0 se nem
  // isso responder) — por isso fica um pouco maior que o tetoSeg.
  var POOL = [
    {
      chave: 'speedtap', nome: 'Pega a Coruja', duracaoSeg: 25,
      iniciar: function () { return _iniciarJogoTela('speedtap', ['classico']); }
    },
    {
      chave: 'sequencia', nome: 'Sequência da Coruja', duracaoSeg: 60,
      iniciar: function () { return _iniciarJogoTela('sequencia', [], 50); }
    },
    {
      chave: 'piano', nome: 'Piano da Coruja', duracaoSeg: 60,
      iniciar: function () { return _iniciarJogoTela('piano', ['sobrevivencia'], 50); }
    },
    {
      chave: 'puff', nome: 'Puff da Coruja', duracaoSeg: 28,
      iniciar: function () { return _iniciarJogoContainer('puff', 28); }
    },
    {
      chave: 'ervilhas', nome: 'Ervilhas da Coruja', duracaoSeg: 42,
      iniciar: function () { return _iniciarJogoContainer('ervilhas', 38); }
    }
  ];
  function _poolPorChave(chave) {
    for (var i = 0; i < POOL.length; i++) if (POOL[i].chave === chave) return POOL[i];
    return null;
  }

  /* ── Estado local ────────────────────────────────────────────── */
  var _codigo = null;          // código da sala atual (4 letras)
  var _salaRef = null;         // referência RTDB da sala atual
  var _souAnfitriao = false;
  var _meuUid = null;
  var _meuNome = null;
  var _listeners = [];         // { ref, evento, cb } abertos, pra desligar depois
  var _sala = null;            // último snapshot conhecido de salasParty/{codigo}
  var _resultadosCache = {};   // { rodada: { uid: {score} } } — espelho de resultados/
  var _rodadaEmAndamento = false; // true entre "meu minigame começou" e "eu reportei"
  var _rodadaVistaEm = -1;     // último valor de rodadaAtual já processado (evita reprocessar)
  var _timeoutSeguranca = null;
  var _ultimoJogoUsado = null; // evita repetir o mesmo minigame 2x seguidas
  var _totalRodadasEscolhidas = TOTAL_RODADAS_PADRAO; // ajustável no lobby, só o anfitrião

  function disponivel() {
    return typeof firebase !== 'undefined' && !!firebase.database && !!firebase.auth;
  }

  /* ── Identidade (mesmo padrão do multiplayer.js) ────────────── */
  function _garantirIdentidade() {
    return new Promise(function (resolve, reject) {
      if (typeof firebase === 'undefined' || !firebase.auth) {
        reject(new Error('Coruja Party indisponível agora.'));
        return;
      }
      var auth = firebase.auth();
      var atual = auth.currentUser;
      if (atual) {
        var apelido = (window.AngatubaGames && window.AngatubaGames.apelido && window.AngatubaGames.apelido());
        resolve({ uid: atual.uid, nome: (apelido || atual.displayName || 'Jogador').slice(0, 20) });
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

  /* ── Criar sala ──────────────────────────────────────────────── */
  function criarSala(publica) {
    if (!disponivel()) return Promise.reject(new Error('Coruja Party indisponível neste navegador.'));
    return _garantirIdentidade().then(function (eu) {
      _meuUid = eu.uid; _meuNome = eu.nome;
      var db = _db();
      if (!db) return Promise.reject(new Error('Coruja Party indisponível agora.'));
      return _tentarCriar(db, eu, !!publica, 0);
    });
  }

  function _tentarCriar(db, eu, publica, tentativa) {
    if (tentativa >= 5) return Promise.reject(new Error('Não consegui abrir uma sala. Tente de novo.'));
    var codigo = _codigoAleatorio();
    var ref = db.ref('salasParty/' + codigo);
    return ref.get().then(function (snap) {
      if (snap.exists()) return _tentarCriar(db, eu, publica, tentativa + 1);

      return ref.set({
        anfitriao: { uid: eu.uid, nome: eu.nome },
        publica: publica,
        criadoEm: firebase.database.ServerValue.TIMESTAMP,
        status: 'lobby',
        rodadaAtual: 0
      }).then(function () {
        return ref.child('jogadores/' + eu.uid).set({
          nome: eu.nome, entrouEm: firebase.database.ServerValue.TIMESTAMP, pontosTotal: 0
        });
      }).then(function () {
        _codigo = codigo; _salaRef = ref; _souAnfitriao = true;
        // Sala sem ninguém a mais entrar / anfitrião cair = some sozinha.
        ref.onDisconnect().remove();

        if (publica) {
          var refPublica = db.ref('salasPartyPublicas/' + codigo);
          refPublica.set({ nome: eu.nome, criadoEm: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
          refPublica.onDisconnect().remove();
        }
        _observarSala();
        return codigo;
      });
    });
  }

  /* ── Entrar em sala existente ────────────────────────────────── */
  function entrarSala(codigoBruto) {
    if (!disponivel()) return Promise.reject(new Error('Coruja Party indisponível neste navegador.'));
    var codigo = String(codigoBruto || '').trim().toUpperCase();
    if (!codigo) return Promise.reject(new Error('Digite o código da sala.'));

    return _garantirIdentidade().then(function (eu) {
      _meuUid = eu.uid; _meuNome = eu.nome;
      var db = _db();
      if (!db) return Promise.reject(new Error('Coruja Party indisponível agora.'));
      var ref = db.ref('salasParty/' + codigo);

      return ref.get().then(function (snap) {
        if (!snap.exists()) return Promise.reject(new Error('Sala não encontrada. Confira o código.'));
        var sala = snap.val();
        if (sala.status !== 'lobby') return Promise.reject(new Error('Essa Party já começou. Peça um código novo.'));
        var jogadores = sala.jogadores || {};
        var qtd = Object.keys(jogadores).length;
        if (jogadores[eu.uid]) {
          // Reconexão: já era desta sala (ex.: recarregou a página).
        } else if (qtd >= MAX_JOGADORES) {
          return Promise.reject(new Error('Essa sala já está cheia (máximo 4 jogadores).'));
        }
        if (!sala.criadoEm || (Date.now() - sala.criadoEm) > SALA_EXPIRA_MS) {
          return Promise.reject(new Error('Essa sala expirou. Peça um código novo.'));
        }

        _codigo = codigo; _salaRef = ref; _souAnfitriao = false;
        return ref.child('jogadores/' + eu.uid).set({
          nome: eu.nome, entrouEm: firebase.database.ServerValue.TIMESTAMP, pontosTotal: 0
        }).then(function () {
          ref.child('jogadores/' + eu.uid).onDisconnect().remove();
          _observarSala();
          return codigo;
        });
      });
    });
  }

  /* ── Lista de salas públicas abertas agora ──────────────────── */
  function listarSalas(callback) {
    if (typeof callback !== 'function') callback = function () {};
    if (!disponivel()) { callback([]); return function () {}; }
    var cancelado = false;
    var desligar = function () {};
    _garantirIdentidade().then(function () {
      if (cancelado) return;
      var db = _db();
      if (!db) { callback([]); return; }
      var ref = db.ref('salasPartyPublicas');
      var handler = function (snap) {
        var lista = [];
        snap.forEach(function (filho) {
          var v = filho.val() || {};
          // Defesa extra contra sala "fantasma": se por algum motivo o
          // onDisconnect não rodou (app fechado sem desconectar limpo,
          // etc.) e a entrada ficou velha demais, não mostra na lista —
          // mesmo critério de expiração usado em entrarSala().
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

  /* ── Observação contínua da sala ─────────────────────────────── */
  function _observarSala() {
    if (!_salaRef) return;
    _escutar(_salaRef, 'value', _aoAtualizarSala);
    _escutar(_salaRef.child('resultados'), 'value', function (snap) {
      _resultadosCache = snap.val() || {};
      _emit('resultadosMudaram', _resultadosCache);
      if (_souAnfitriao) _anfitriaoChecarFechamentoRodada();
    });
  }

  function _aoAtualizarSala(snap) {
    var sala = snap.val();
    if (!sala) { _aoSalaFechada(); return; }
    _sala = sala;
    _emit('salaMudou', sala);

    if (sala.status === 'rodada' && sala.rodadaAtual !== _rodadaVistaEm) {
      _rodadaVistaEm = sala.rodadaAtual;
      _iniciarRodadaLocal(sala);
    } else if (sala.status === 'resultado') {
      _emit('resultadoRodada', sala);
    } else if (sala.status === 'campeao') {
      _emit('campeao', sala);
    }
  }

  function _aoSalaFechada() {
    _emit('salaFechada');
    _limparTudo();
  }

  /* ── Handlers (equivalente ao AngatubaMP.on) ─────────────────── */
  var _handlers = {};
  function on(evento, cb) {
    if (!_handlers[evento]) _handlers[evento] = [];
    _handlers[evento].push(cb);
  }
  function _emit(evento, dado) {
    (_handlers[evento] || []).forEach(function (cb) {
      try { cb(dado); } catch (e) { console.error('[AngatubaParty]', evento, e); }
    });
  }

  /* ── Rodada: iniciar localmente (todo mundo faz isso, cada um no
     próprio aparelho, ao ver status vira "rodada") ────────────── */
  function _iniciarRodadaLocal(sala) {
    var entry = _poolPorChave(sala.jogoAtual);
    _rodadaEmAndamento = true;
    document.body.classList.add('angatuba-party-ativo');
    _emit('countdown', { jogo: entry, sala: sala });

    _contagemRegressiva(3, function () {
      if (!entry) { reportarResultado(0); return; }
      entry.iniciar(sala.seed).catch(function () {
        reportarResultado(0); // jogo não carregou: não trava a rodada pros outros
      });
      var limiteMs = (entry.duracaoSeg || 30) * 1000 + FOLGA_SEGURANCA_MS;
      _timeoutSeguranca = setTimeout(function () {
        if (_rodadaEmAndamento) reportarResultado(0);
      }, limiteMs);
    });
  }

  function _contagemRegressiva(n, aoFim) {
    // Desce até n=0 (emite o "Vai!") antes de chamar aoFim — antes o
    // contador pulava de "1" direto pro jogo, sem mostrar o "Vai!"
    // que o handler de countdownTick já esperava (ver party.js/UI).
    if (n < 0) { aoFim(); return; }
    _emit('countdownTick', n);
    setTimeout(function () { _contagemRegressiva(n - 1, aoFim); }, n > 0 ? 800 : 500);
  }

  /* ── Mostra a tela cheia de um jogo já existente e chama comecar()
     direto (sem passar pela tela de menu solo dele). Não usa
     window._abrirJogo pra evitar corrida entre o preparar() dele e
     o nosso comecar() — ver comentário no topo do arquivo. ─────── */
  function _mostrarTelaJogo(nome) {
    var hubEl = document.getElementById('games-hub');
    if (hubEl) hubEl.classList.add('jogo-ativo');
    var menu = document.getElementById('games-menu');
    if (menu) menu.style.display = 'none';
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    var tela = document.getElementById('jogo-' + nome);
    if (tela) tela.style.display = 'block';
  }

  function _iniciarJogoTela(nome, comecarArgs, tetoSeg) {
    return window._jogoLoader(nome).then(function (api) {
      if (typeof api.preparar === 'function') api.preparar();
      _mostrarTelaJogo(nome);
      if (typeof api.comecar === 'function') api.comecar.apply(api, comecarArgs || []);
      // Corte de segurança pros jogos de resistência (ver comentário na
      // POOL). Só dispara se a rodada ainda estiver rolando quando o
      // tempo vencer — se a pessoa já tiver errado sozinha antes disso,
      // reportarResultado já rodou e forcarFimParty vira no-op.
      if (tetoSeg && typeof api.forcarFimParty === 'function') {
        setTimeout(function () {
          if (_ativo()) { try { api.forcarFimParty(); } catch (e) {} }
        }, tetoSeg * 1000);
      }
      return api;
    });
  }

  /* ── Mostra a tela do próprio Party (arena) e deixa o minigame
     "container" desenhar tudo dentro do container que ela expõe. ── */
  function _iniciarJogoContainer(nome, duracaoSeg) {
    _mostrarTelaJogo('party');
    _emit('mostrarArena');
    return window._jogoLoader(nome).then(function (api) {
      var container = document.getElementById('pty-arena-container');
      if (!container) throw new Error('Arena da Party não encontrada.');
      if (typeof api.render !== 'function') throw new Error('Módulo ' + nome + ' não expõe render().');
      api.render(container, {
        duracaoSeg: duracaoSeg,
        onFim: function (score) { reportarResultado(score); }
      });
      return api;
    });
  }

  /* ── Reportar resultado da minha rodada ──────────────────────── */
  function reportarResultado(score) {
    if (!_rodadaEmAndamento || !_salaRef || !_sala) return;
    _rodadaEmAndamento = false;
    if (_timeoutSeguranca) { clearTimeout(_timeoutSeguranca); _timeoutSeguranca = null; }
    document.body.classList.remove('angatuba-party-ativo');
    _mostrarTelaJogo('party');
    _emit('aguardandoOutros', _sala.rodadaAtual);

    var rodada = _sala.rodadaAtual;
    _salaRef.child('resultados/' + rodada + '/' + _meuUid).set({
      score: Math.max(0, Math.round(Number(score) || 0)),
      enviadoEm: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () {});

    if (_souAnfitriao) _anfitriaoChecarFechamentoRodada();
  }

  function _ativo() { return _rodadaEmAndamento; }

  /* ── Anfitrião: fecha a rodada quando todos reportaram (ou o
     timeout de segurança de cada um vence e reporta 0) ───────── */
  function _anfitriaoChecarFechamentoRodada() {
    if (!_souAnfitriao || !_sala || _sala.status !== 'rodada') return;
    var rodada = _sala.rodadaAtual;
    var resultados = _resultadosCache[rodada] || {};
    var jogadores = _sala.jogadores || {};
    var qtdJogadores = Object.keys(jogadores).length;
    var qtdResultados = Object.keys(resultados).length;
    if (qtdResultados < qtdJogadores) return; // ainda falta gente
    _anfitriaoFecharRodada(rodada, resultados, jogadores);
  }

  function _anfitriaoFecharRodada(rodada, resultados, jogadores) {
    var lista = [];
    Object.keys(jogadores).forEach(function (uid) {
      lista.push({ uid: uid, nome: jogadores[uid].nome, score: (resultados[uid] && resultados[uid].score) || 0 });
    });
    lista.sort(function (a, b) { return b.score - a.score; });

    var updates = {};
    var placar = {};
    lista.forEach(function (j, i) {
      var pontosGanhos = PONTOS_POR_COLOCACAO[i] || 0;
      placar[j.uid] = { nome: j.nome, score: j.score, colocacao: i + 1, pontosGanhos: pontosGanhos };
      var totalAnterior = (jogadores[j.uid] && jogadores[j.uid].pontosTotal) || 0;
      updates['jogadores/' + j.uid + '/pontosTotal'] = totalAnterior + pontosGanhos;
    });
    updates['placarRodadas/' + rodada] = placar;
    updates['status'] = (rodada >= (_sala.totalRodadas || TOTAL_RODADAS_PADRAO)) ? 'campeao' : 'resultado';

    _salaRef.update(updates).catch(function () {});
  }

  /* ── Anfitrião: escolhe rodadas (lobby), começa e avança rodadas ── */
  function definirTotalRodadas(n) {
    _totalRodadasEscolhidas = Math.max(2, Math.min(20, Number(n) || TOTAL_RODADAS_PADRAO));
  }

  function _sortearProximoJogo() {
    var opcoes = POOL.filter(function (j) { return j.chave !== _ultimoJogoUsado; });
    if (!opcoes.length) opcoes = POOL;
    var escolhido = opcoes[Math.floor(Math.random() * opcoes.length)];
    _ultimoJogoUsado = escolhido.chave;
    return escolhido.chave;
  }

  // "Começar Party": só aqui o totalRodadas é (re)calculado — fixa a linha
  // de chegada da sessão. baseRodada normalmente é 0 (sala nova), mas numa
  // revanche já vem com o valor da sessão anterior (ver revanche()), então
  // a numeração de rodada continua subindo em vez de reiniciar do zero.
  function comecarParty() {
    if (!_souAnfitriao || !_sala || !_salaRef) return;
    var qtd = Object.keys(_sala.jogadores || {}).length;
    if (qtd < MIN_JOGADORES) return;
    var baseRodada = _sala.rodadaAtual || 0;
    _salaRef.update({
      totalRodadas: baseRodada + _totalRodadasEscolhidas,
      rodadaAtual: baseRodada + 1,
      jogoAtual: _sortearProximoJogo(),
      seed: Math.floor(Math.random() * 1e9),
      status: 'rodada',
      rodadaIniciadaEm: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () {});
  }

  // "Próxima rodada" (dentro da MESMA sessão): só avança rodadaAtual em 1.
  // NÃO mexe em totalRodadas — que already foi fixado no comecarParty() lá
  // em cima. (Bug corrigido: antes esta função recalculava totalRodadas =
  // rodadaAtual + N a cada rodada, o que empurrava a linha de chegada pra
  // frente pra sempre e a Party nunca terminava.)
  function proximaRodada() {
    if (!_souAnfitriao || !_sala || !_salaRef) return;
    _salaRef.update({
      rodadaAtual: (_sala.rodadaAtual || 0) + 1,
      jogoAtual: _sortearProximoJogo(),
      seed: Math.floor(Math.random() * 1e9),
      status: 'rodada',
      rodadaIniciadaEm: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () {});
  }

  // Revanchinha: zera o placar geral e reabre o lobby — sem apagar
  // nada (rodadaAtual/totalRodadas continuam subindo na próxima
  // sessão, ver comecarParty()). Mesma sala, mesmo código, mesma
  // galera.
  function revanche() {
    if (!_souAnfitriao || !_sala || !_salaRef) return;
    var jogadores = _sala.jogadores || {};
    var updates = { status: 'lobby' };
    Object.keys(jogadores).forEach(function (uid) { updates['jogadores/' + uid + '/pontosTotal'] = 0; });
    _salaRef.update(updates).catch(function () {});
  }

  /* ── Sair da sala / limpeza ───────────────────────────────────── */
  function sair() {
    _pararListeners();
    if (_timeoutSeguranca) { clearTimeout(_timeoutSeguranca); _timeoutSeguranca = null; }
    document.body.classList.remove('angatuba-party-ativo');
    if (_salaRef) {
      try { _salaRef.onDisconnect().cancel(); } catch (e) {}
      if (_souAnfitriao) {
        try { _salaRef.remove(); } catch (e) {}
        if (_sala && _sala.publica) {
          try {
            var db = _db();
            if (db) {
              var refPublica = db.ref('salasPartyPublicas/' + _codigo);
              refPublica.onDisconnect().cancel();
              refPublica.remove();
            }
          } catch (e) {}
        }
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
    _sala = null; _resultadosCache = {};
    _rodadaEmAndamento = false; _rodadaVistaEm = -1;
  }

  function estado() { return _sala; }
  function meuUid() { return _meuUid; }
  function souAnfitriao() { return _souAnfitriao; }
  function codigoSala() { return _codigo; }
  function pool() { return POOL; }

  window.AngatubaParty = {
    disponivel: disponivel,
    criarSala: criarSala,
    entrarSala: entrarSala,
    listarSalas: listarSalas,
    definirTotalRodadas: definirTotalRodadas,
    comecarParty: comecarParty,
    proximaRodada: proximaRodada,
    revanche: revanche,
    sair: sair,
    on: on,
    estado: estado,
    meuUid: meuUid,
    souAnfitriao: souAnfitriao,
    codigoSala: codigoSala,
    pool: pool,
    // Ponte usada pelos jogos da pool em modo "tela" (speedtap/
    // sequencia/piano) pra saber se estão rodando dentro de uma
    // rodada de Party e, se sim, reportar o resultado pra cá em vez
    // de seguir o fluxo solo normal. Ver window.AngatubaGames.party
    // em app.js — é só uma fachada segura sobre isto.
    ativo: _ativo,
    reportarResultado: reportarResultado
  };

  // Controlador de UI (telas do #jogo-party) vive em party-ui.js? Não —
  // pra manter "arquivos completos, poucos arquivos novos", a UI do
  // hub/lobby/rodada/placar fica neste mesmo arquivo, na seção abaixo.
  // Ela só CONSOME a API pública acima (AngatubaParty.*) e os eventos
  // emitidos por on(...) — nenhuma função abaixo mexe em Firebase
  // direto.
  /* ═══════════════════ UI: telas do #jogo-party ═══════════════════ */

  function _q(id) { return document.getElementById(id); }
  function _mostrarSub(tela) {
    var nomes = ['menu', 'lobby', 'countdown', 'arena', 'aguardando', 'resultado', 'campeao', 'erro'];
    nomes.forEach(function (n) {
      var el = _q('pty-' + n);
      if (el) el.style.display = (n === tela) ? 'flex' : 'none';
    });
  }
  function _erroMenu(msg) {
    var el = _q('pty-menu-erro');
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  var _pararListaSalas = null;

  function _ptyPreparar() {
    _erroMenu('');
    var input = _q('pty-codigo-input'); if (input) input.value = '';
    _mostrarSub('menu');
    if (_pararListaSalas) { _pararListaSalas(); _pararListaSalas = null; }
    _pararListaSalas = window.AngatubaParty.listarSalas(_renderListaSalas);
  }

  function _renderListaSalas(lista) {
    var wrap = _q('pty-lista-salas');
    if (!wrap) return;
    if (!lista.length) {
      wrap.innerHTML = '<div class="pty-lista-vazia">Nenhuma Party pública aberta agora.</div>';
      return;
    }
    wrap.innerHTML = lista.map(function (s) {
      return '<button type="button" class="pty-sala-item" onclick="_ptyEntrarSala(\'' + s.codigo + '\')">' +
        '<span class="pty-sala-item-nome">🦉 ' + _escHTML(s.nome) + '</span>' +
        '<span class="pty-sala-item-cta">Entrar</span></button>';
    }).join('');
  }

  function _escHTML(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _ptyCriarSala() {
    var privadaCheck = _q('pty-privada-check');
    var publica = !(privadaCheck && privadaCheck.checked);
    _erroMenu('');
    window.AngatubaParty.criarSala(publica).then(function () {
      _rendarLobby();
    }).catch(function (err) { _erroMenu(err && err.message ? err.message : 'Não foi possível criar a sala.'); });
  }
  window._ptyCriarSala = _ptyCriarSala;

  function _ptyEntrarSala(codigoDireto) {
    var input = _q('pty-codigo-input');
    var codigo = codigoDireto || (input ? input.value : '');
    _erroMenu('');
    window.AngatubaParty.entrarSala(codigo).then(function () {
      _rendarLobby();
    }).catch(function (err) { _erroMenu(err && err.message ? err.message : 'Não foi possível entrar na sala.'); });
  }
  window._ptyEntrarSala = _ptyEntrarSala; // usado no onclick da lista de salas

  function _rendarLobby() {
    if (_pararListaSalas) { _pararListaSalas(); _pararListaSalas = null; }
    _mostrarSub('lobby');
  }

  function _ptySairSala() {
    window.AngatubaParty.sair();
    if (typeof window._voltarAoMenu === 'function') window._voltarAoMenu();
  }
  window._ptySairSala = _ptySairSala;

  function _ptyVoltarMenuLobby() {
    window.AngatubaParty.sair();
    _ptyPreparar();
  }
  window._ptyVoltarMenuLobby = _ptyVoltarMenuLobby;

  function _ptyCopiarCodigo() {
    var codigo = window.AngatubaParty.codigoSala();
    if (!codigo) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(codigo).catch(function () {});
    }
    var btn = _q('pty-btn-copiar');
    if (btn) {
      var original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(function () { btn.textContent = original; }, 1400);
    }
  }
  window._ptyCopiarCodigo = _ptyCopiarCodigo;

  function _ptyEscolherRodadas(n, btn) {
    window.AngatubaParty.definirTotalRodadas(n);
    document.querySelectorAll('.pty-rodadas-chip').forEach(function (b) { b.classList.remove('pty-rodadas-ativa'); });
    if (btn) btn.classList.add('pty-rodadas-ativa');
  }
  window._ptyEscolherRodadas = _ptyEscolherRodadas;

  function _ptyComecarParty() { window.AngatubaParty.comecarParty(); }
  window._ptyComecarParty = _ptyComecarParty;

  function _ptyProximaRodada() { window.AngatubaParty.proximaRodada(); }
  window._ptyProximaRodada = _ptyProximaRodada;

  function _ptyRevanche() { window.AngatubaParty.revanche(); }
  window._ptyRevanche = _ptyRevanche;

  function _ptyVoltarHubFinal() {
    window.AngatubaParty.sair();
    if (typeof window._voltarAoMenu === 'function') window._voltarAoMenu();
  }
  window._ptyVoltarHubFinal = _ptyVoltarHubFinal;

  /* ── Renderização reativa a partir dos eventos do AngatubaParty ── */
  window.AngatubaParty.on('salaMudou', function (sala) {
    var codEl = _q('pty-lobby-codigo'); if (codEl) codEl.textContent = window.AngatubaParty.codigoSala() || '';
    var jogadores = sala.jogadores || {};
    var lista = Object.keys(jogadores).map(function (uid) { return { uid: uid, nome: jogadores[uid].nome, pontosTotal: jogadores[uid].pontosTotal || 0, anfitriao: sala.anfitriao && sala.anfitriao.uid === uid }; });

    if (sala.status === 'lobby') {
      var wrap = _q('pty-lobby-jogadores');
      if (wrap) {
        wrap.innerHTML = lista.map(function (j) {
          return '<div class="pty-jogador-chip">🦉 ' + _escHTML(j.nome) + (j.anfitriao ? ' <span class="pty-badge-anfitriao">anfitrião</span>' : '') + '</div>';
        }).join('');
      }
      var contador = _q('pty-lobby-contador');
      if (contador) contador.textContent = lista.length + '/4 jogadores (mínimo 2 pra começar)';
      var btnComecar = _q('pty-btn-comecar');
      var souAnf = window.AngatubaParty.souAnfitriao();
      if (btnComecar) {
        btnComecar.style.display = souAnf ? '' : 'none';
        btnComecar.disabled = lista.length < 2;
      }
      var esperaAnf = _q('pty-lobby-espera-anfitriao');
      if (esperaAnf) esperaAnf.style.display = souAnf ? 'none' : '';
      var rodadasWrap = _q('pty-rodadas-escolha');
      if (rodadasWrap) rodadasWrap.style.display = souAnf ? '' : 'none';
      _mostrarSub('lobby');
    }
  });

  window.AngatubaParty.on('countdown', function (info) {
    var nomeEl = _q('pty-countdown-jogo');
    if (nomeEl) nomeEl.textContent = (info.jogo && info.jogo.nome) || 'Minigame surpresa';
    _mostrarSub('countdown');
  });
  window.AngatubaParty.on('countdownTick', function (n) {
    var numEl = _q('pty-countdown-num');
    if (numEl) {
      numEl.textContent = n > 0 ? n : 'Vai!';
      numEl.classList.toggle('pty-countdown-vai', n <= 0);
      numEl.classList.remove('pty-countdown-pulse'); void numEl.offsetWidth; numEl.classList.add('pty-countdown-pulse');
    }
    // Som do tique-taque (3-2-1) e um som mais triunfante no "Vai!".
    if (window.AngatubaGames && window.AngatubaGames.som) {
      if (n > 0) window.AngatubaGames.som.toque(); else window.AngatubaGames.som.nivelUp();
    }
  });
  window.AngatubaParty.on('mostrarArena', function () { _mostrarSub('arena'); /* o render() do minigame injeta o jogo em #pty-arena-container */ });

  window.AngatubaParty.on('aguardandoOutros', function (rodada) {
    _atualizarAguardando(rodada);
    _mostrarSub('aguardando');
  });
  window.AngatubaParty.on('resultadosMudaram', function () {
    var sala = window.AngatubaParty.estado();
    if (sala && sala.status === 'rodada') _atualizarAguardando(sala.rodadaAtual);
  });
  function _atualizarAguardando(rodada) {
    var sala = window.AngatubaParty.estado();
    if (!sala) return;
    var jogadores = sala.jogadores || {};
    var resultados = _resultadosCache[rodada] || {};
    var wrap = _q('pty-aguardando-lista');
    if (!wrap) return;
    wrap.innerHTML = Object.keys(jogadores).map(function (uid) {
      var pronto = !!resultados[uid];
      return '<div class="pty-jogador-chip' + (pronto ? ' pty-jogador-pronto' : '') + '">🦉 ' +
        _escHTML(jogadores[uid].nome) + (pronto ? ' ✅' : ' ⏳') + '</div>';
    }).join('');
  }

  window.AngatubaParty.on('resultadoRodada', function (sala) {
    var rodada = sala.rodadaAtual;
    var placar = (sala.placarRodadas && sala.placarRodadas[rodada]) || {};
    var itens = Object.keys(placar).map(function (uid) { return placar[uid]; });
    itens.sort(function (a, b) { return a.colocacao - b.colocacao; });

    var medalhas = ['🥇', '🥈', '🥉', '🎖️'];
    var listaEl = _q('pty-resultado-lista');
    if (listaEl) {
      listaEl.innerHTML = itens.map(function (it, i) {
        return '<div class="pty-resultado-item">' +
          '<span class="pty-resultado-pos">' + (medalhas[i] || (i + 1) + 'º') + '</span>' +
          '<span class="pty-resultado-nome">' + _escHTML(it.nome) + '</span>' +
          '<span class="pty-resultado-score">' + it.score + '</span>' +
          '<span class="pty-resultado-pts">+' + it.pontosGanhos + '</span></div>';
      }).join('');
    }

    var jogadores = sala.jogadores || {};
    var geral = Object.keys(jogadores).map(function (uid) { return { nome: jogadores[uid].nome, pontosTotal: jogadores[uid].pontosTotal || 0 }; });
    geral.sort(function (a, b) { return b.pontosTotal - a.pontosTotal; });
    var geralEl = _q('pty-resultado-geral');
    if (geralEl) {
      geralEl.innerHTML = geral.map(function (j) {
        return '<div class="pty-geral-item"><span>' + _escHTML(j.nome) + '</span><span>' + j.pontosTotal + ' pts</span></div>';
      }).join('');
    }

    var tituloEl = _q('pty-resultado-titulo');
    if (tituloEl) tituloEl.textContent = 'Fim da rodada ' + rodada + ' de ' + (sala.totalRodadas || rodada);

    var btnProx = _q('pty-btn-proxima-rodada');
    if (btnProx) btnProx.style.display = window.AngatubaParty.souAnfitriao() ? '' : 'none';
    var esperaEl = _q('pty-resultado-espera-anfitriao');
    if (esperaEl) esperaEl.style.display = window.AngatubaParty.souAnfitriao() ? 'none' : '';

    document.body.classList.remove('angatuba-party-ativo');
    _mostrarTelaJogo('party');
    _mostrarSub('resultado');
  });

  window.AngatubaParty.on('campeao', function (sala) {
    var jogadores = sala.jogadores || {};
    var geral = Object.keys(jogadores).map(function (uid) { return { nome: jogadores[uid].nome, pontosTotal: jogadores[uid].pontosTotal || 0 }; });
    geral.sort(function (a, b) { return b.pontosTotal - a.pontosTotal; });

    var medalhas = ['🥇', '🥈', '🥉', '🎖️'];
    var podioEl = _q('pty-campeao-podio');
    if (podioEl) {
      podioEl.innerHTML = geral.map(function (j, i) {
        return '<div class="pty-podio-item pty-podio-' + (i + 1) + '"><span class="pty-podio-medalha">' + (medalhas[i] || '') + '</span>' +
          '<span class="pty-podio-nome">' + _escHTML(j.nome) + '</span><span class="pty-podio-pts">' + j.pontosTotal + ' pts</span></div>';
      }).join('');
    }
    var tituloEl = _q('pty-campeao-titulo');
    if (tituloEl && geral[0]) {
      tituloEl.textContent = '🏆 ' + geral[0].nome + ' venceu a Party!';
      // Entrada mais festiva do título (mesmo padrão de "pulse" do countdown).
      tituloEl.classList.remove('pty-campeao-titulo-anim'); void tituloEl.offsetWidth; tituloEl.classList.add('pty-campeao-titulo-anim');
    }

    var btnRev = _q('pty-btn-revanche');
    if (btnRev) btnRev.style.display = window.AngatubaParty.souAnfitriao() ? '' : 'none';

    document.body.classList.remove('angatuba-party-ativo');
    _mostrarTelaJogo('party');
    _mostrarSub('campeao');
    if (window.AngatubaGames && window.AngatubaGames.efeitos) {
      window.AngatubaGames.efeitos.confete('pty-campeao-podio');
      // Segunda leva de confete um instante depois — reforça o clima de
      // comemoração sem exigir nenhum asset ou elemento novo.
      setTimeout(function () { window.AngatubaGames.efeitos.confete('pty-campeao-podio'); }, 650);
    }
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(true);
  });

  window.AngatubaParty.on('salaFechada', function () {
    document.body.classList.remove('angatuba-party-ativo');
    _mostrarTelaJogo('party');
    _mostrarSub('erro');
  });

  // API pública consumida pelo loader do app (_jogoLoader) — o card do
  // hub chama _abrirJogo('party'), que chama preparar() ao abrir.
  window.PartyGame = {
    preparar: _ptyPreparar,
    // Chamado quando o app fecha a tela do jogo por fora das telas
    // próprias do Party (botão genérico "← Voltar aos jogos" / troca de
    // jogo) — ver _pararJogosExternos em app.js. Sem isto, sair da
    // lobby por esse caminho deixava a sala (e o espelho público) para
    // trás: o anfitrião "saía" mas o Firebase nunca ficava sabendo, e a
    // Party ficava fantasma na lista até o navegador desconectar de
    // verdade. Mesma limpeza do botão "Sair da sala" — chamar sair()
    // sem sala ativa é no-op seguro (ver AngatubaParty.sair()).
    parar: function () {
      if (_pararListaSalas) { _pararListaSalas(); _pararListaSalas = null; }
      if (window.AngatubaParty && window.AngatubaParty.codigoSala()) window.AngatubaParty.sair();
    }
  };
})();
