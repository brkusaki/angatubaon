/* ══════════════════════════════════════════════════════════════
   TRUCO PAULISTA — motor de regras + mesa, plugado no sistema de
   salas de Jogos/baralho.js (window.AngatubaBaralho).
   ------------------------------------------------------------
   Este arquivo é um "motor" de jogo no sentido de baralho.js: ele
   se registra com registrarModo('truco', {...}) e, quando a sala
   entra em status "jogando", recebe um <div> vazio (ctx.container)
   pra desenhar a mesa inteira — nenhum markup do Truco mora no
   index.html (mesmo padrão de Jogos/negocios.js).

   MODELO DE SINCRONIZAÇÃO (anfitrião valida, RTDB só transporta)
   O estado de uma mão de Truco (cartas na mão de cada um, de quem é
   a vez, aposta em andamento...) muda rápido demais e é sensível
   demais a trapaça pra deixar qualquer cliente escrever direto nele
   — diferente do Coruja Party, aqui tem jogada a jogada. Por isso:
     salasBaralho/{codigo}/game    -> estado completo da partida,
                                       escrito SÓ pelo anfitrião
                                       (sempre um objeto inteiro, via
                                       set() — nunca patch parcial).
     salasBaralho/{codigo}/acoes/  -> fila de intenções ("quero jogar
                                       esta carta", "quero pedir 6").
                                       Qualquer jogador empurra a
                                       própria (uid = auth.uid); só o
                                       anfitrião valida e apaga cada
                                       uma depois de processar.
   Cada cliente (INCLUSIVE o do anfitrião, pra não duplicar caminho
   de código) só empurra ações pra "acoes" e desenha o que "game"
   disser. O anfitrião mantém uma cópia local autoritativa (_g),
   processa as ações em ordem (child_added garante a ordem de chegada)
   e publica _g inteiro em "game" a cada mudança. Ver
   claude/database.rules.json (nó "salasBaralho").

   REGRAS IMPLEMENTADAS (Truco Paulista)
   - Baralho limpo de 40 cartas (sem 8/9/10), manilha = carta seguinte
     à virada na ordem 4-5-6-7-Q-J-K-A-2-3 (cíclica).
   - Força das manilhas: Ouros < Espadas < Copas < Paus (Zap).
   - Cartas iguais (não-manilha) de naipes diferentes empatam.
   - Mão de até 3 vazas; vaza empatada não dá ponto a ninguém e quem
     abriu ela abre a próxima. Resolução clássica: 1ª vitória +
     empate na 2ª fecha pra quem venceu a 1ª; empate na 1ª + vitória
     na 2ª fecha pra quem venceu a 2ª; 3 vazas sem 2 vitórias do
     mesmo time fecha pra quem venceu a 1ª não-empatada, ou pro time
     da "mão" (quem abriu a mão) se as 3 empatarem.
   - Aposta: 1 (sem truco) -> 3 -> 6 -> 9 -> 12, alternando qual time
     pode pedir aumento (quem aceitou um pedido não pode re-pedir
     antes do adversário jogar ou pedir de novo). Correr concede ao
     adversário o valor QUE JÁ ESTAVA VALENDO antes do pedido atual.
   - Partida até 12 pontos.
   - 2 jogadores: cada um por si. 4 jogadores: duplas nos assentos
     0+2 contra 1+3 (parceiro sempre do lado oposto da mesa).
   - Carta "virada" (jogada escondida): conta como perdedora
     automática na vaza (revelada só no fim da vaza) — é a forma mais
     comum de implementar o blefe da carta escondida sem exigir botar
     e tirar peso da rodada em tempo real.

   PENDÊNCIAS CONHECIDAS
   1. "Mão de 11" (regra especial quando um time está com 11 pontos)
      não implementada — fica pra uma rodada futura se fizer falta.
   2. Sinais visuais entre parceiros (4 jogadores) não implementados
      — o combinado por ora é só a comunicação por fora do app.
   3. Se o anfitrião cair no meio de uma mão, a partida é cancelada
      (ver "cancelamento por jogador ausente" abaixo) — não há
      handoff de anfitrião nem retomada automática de estado.
   4. Simplificação deliberada no revide da aposta: depois que um time
      pede aumento e o outro ACEITA, só o time que aceitou pode pedir
      o próximo aumento NAQUELA mão (ver "ultimoTimeAumentou") — na
      mesa real, o time que acabou de subir a aposta só fica impedido
      de subir de novo até o outro jogar uma carta ou pedir por conta
      própria, podendo voltar a pedir depois. Trocar pra esse
      comportamento exigiria rastrear "última vez que a vez avançou
      sem pedido", que não valia a complexidade extra nesta rodada.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ═══════════════ 1. REGRAS (funções puras, sem DOM/Firebase) ═══════════════ */

  var NAIPES = ['O', 'E', 'C', 'P']; // ouros, espadas, copas, paus
  var ORDEM_VALOR = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
  var FORCA_NAIPE = { O: 1, E: 2, C: 3, P: 4 }; // manilha: ouros < espadas < copas < paus(zap)
  var NOME_NAIPE = { O: 'Ouros', E: 'Espadas', C: 'Copas', P: 'Paus' };
  var SIMBOLO_NAIPE = { O: '♦', E: '♠', C: '♥', P: '♣' };
  var COR_NAIPE = { O: 'vermelha', E: 'preta', C: 'vermelha', P: 'preta' };
  var SEQUENCIA_APOSTA = [1, 3, 6, 9, 12];
  var PONTOS_PARTIDA = 12;

  function _criarBaralho() {
    var cartas = [];
    NAIPES.forEach(function (naipe) {
      ORDEM_VALOR.forEach(function (valor) { cartas.push(valor + naipe); });
    });
    return cartas;
  }

  function _embaralhar(lista) {
    // Fisher-Yates — só roda no anfitrião, que é quem "sabe" a ordem real.
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function _valorCarta(cod) { return cod.slice(0, -1); }
  function _naipeCarta(cod) { return cod.slice(-1); }

  function _calcularManilha(valorVirada) {
    var i = ORDEM_VALOR.indexOf(valorVirada);
    return ORDEM_VALOR[(i + 1) % ORDEM_VALOR.length];
  }

  // Poder da carta pra comparação: manilhas sempre acima de qualquer carta
  // comum (10 + força do naipe = 11..14); comuns usam o índice na ordem
  // natural (0..9). Cartas comuns de mesmo valor e naipe diferente empatam
  // (mesmo poder) — é assim mesmo no Truco.
  function _poder(cod, manilhaValor) {
    var valor = _valorCarta(cod), naipe = _naipeCarta(cod);
    if (valor === manilhaValor) return 10 + FORCA_NAIPE[naipe];
    return ORDEM_VALOR.indexOf(valor);
  }

  function _ehManilha(cod, manilhaValor) { return _valorCarta(cod) === manilhaValor; }

  function _timeDoAssento(seat) { return (seat % 2 === 0) ? 'A' : 'B'; }
  function _timeDoUid(uid, jogadores) {
    var j = jogadores[uid];
    return j ? _timeDoAssento(j.seat) : null;
  }
  function _timeAdversario(time) { return time === 'A' ? 'B' : 'A'; }

  function _uidDoAssento(jogadores, seat) {
    var uids = Object.keys(jogadores || {});
    for (var i = 0; i < uids.length; i++) if (jogadores[uids[i]].seat === seat) return uids[i];
    return null;
  }

  // Avalia uma vaza já completa (uma carta por jogador ativo). Cartas
  // "escondidas" nunca vencem — se todas as jogadas da vaza estiverem
  // escondidas, a vaza empata (ninguém marca).
  function _avaliarVaza(cartasNaMesa, manilhaValor, jogadores) {
    var visiveis = cartasNaMesa.filter(function (e) { return !e.escondida; });
    if (!visiveis.length) return { time: null, uid: null };
    var maxPoder = -1;
    visiveis.forEach(function (e) { var p = _poder(e.carta, manilhaValor); if (p > maxPoder) maxPoder = p; });
    var vencedores = visiveis.filter(function (e) { return _poder(e.carta, manilhaValor) === maxPoder; });
    if (vencedores.length === 1) {
      return { time: _timeDoUid(vencedores[0].uid, jogadores), uid: vencedores[0].uid };
    }
    // Mais de uma carta no topo: se todas forem do mesmo time (dupla,
    // 4 jogadores), esse time vence mesmo assim; senão é empate de verdade.
    var timesEmpate = {};
    vencedores.forEach(function (e) { timesEmpate[_timeDoUid(e.uid, jogadores)] = true; });
    var chaves = Object.keys(timesEmpate);
    if (chaves.length === 1) return { time: chaves[0], uid: vencedores[0].uid };
    return { time: null, uid: null };
  }

  // Decide o vencedor da MÃO a partir do histórico de vazas já fechadas
  // (array de 'A' | 'B' | null, na ordem jogada). Retorna 'A'/'B' se a mão
  // já está decidida, ou null se ainda precisa de mais uma vaza.
  function _avaliarMao(vazas, timeDaMao) {
    if (!vazas.length) return null;
    var qtdA = vazas.filter(function (v) { return v === 'A'; }).length;
    var qtdB = vazas.filter(function (v) { return v === 'B'; }).length;
    if (qtdA >= 2) return 'A';
    if (qtdB >= 2) return 'B';
    if (vazas.length === 3) {
      // Ninguém fechou 2-0: cada time tem no máximo 1 vitória. Resolve
      // pela primeira vaza não-empatada; se as 3 empataram, vence quem
      // era "mão" (abriu a primeira vaza).
      var primeira = vazas.filter(function (v) { return v; })[0];
      return primeira || timeDaMao;
    }
    if (vazas.length === 2) {
      if (vazas[0] && vazas[1] === null) return vazas[0]; // venceu a 1ª, 2ª empatou
      if (vazas[0] === null && vazas[1]) return vazas[1]; // 1ª empatou, venceu a 2ª
    }
    return null; // segue pra próxima vaza
  }

  function _proximoValorAposta(valorAtual) {
    var i = SEQUENCIA_APOSTA.indexOf(valorAtual);
    if (i < 0 || i >= SEQUENCIA_APOSTA.length - 1) return null;
    return SEQUENCIA_APOSTA[i + 1];
  }

  /* ═══════════════ 2. ESTADO DO MÓDULO ═══════════════ */

  var _ctx = null;          // contexto recebido de baralho.js
  var _uid = null;
  var _souAnfitriao = false;
  var _maxJogadores = 2;
  var _off = [];            // { ref, evento, cb } — listeners próprios (acoes)
  var _g = null;             // cópia local do "game" (autoritativa só se _souAnfitriao)
  var _sala = null;          // último snapshot completo da sala
  var _timerProximaMao = null;
  var _cartaSelecionada = null; // código da carta selecionada na mão local, aguardando confirmação
  var _root = null;          // container da mesa (ctx.container)
  var _flashTimer = null;

  function _time() { return _sala && _uid ? _timeDoUid(_uid, _sala.jogadores || {}) : null; }
  function _meuTeamPode(gameAtual) {
    // pode pedir aumento se ninguém pediu ainda e não foi o próprio time
    // que fez a última aposta aceita (não dá pra "re-truco" sozinho).
    return !gameAtual.pedidoTruco && gameAtual.apostaAtual < 12 && gameAtual.ultimoTimeAumentou !== _time();
  }

  /* ═══════════════ 3. ANFITRIÃO: DEAL E PROCESSAMENTO DE AÇÕES ═══════════════ */

  function _novoJogoInicial() {
    return { pontuacao: { A: 0, B: 0 }, maoAtual: 0, vencedorPartida: null, historico: [] };
  }

  function _prepararNovaMao(base, jogadores) {
    var uids = Object.keys(jogadores);
    var baralho = _embaralhar(_criarBaralho());
    var maos = {};
    var ordemAssentos = [];
    for (var s = 0; s < _maxJogadores; s++) ordemAssentos.push(_uidDoAssento(jogadores, s));

    // 3 cartas por jogador, na ordem dos assentos a partir de quem é "mão".
    var seatMao = base.maoAtual % _maxJogadores;
    var ordemDeal = [];
    for (var k = 0; k < _maxJogadores; k++) ordemDeal.push(ordemAssentos[(seatMao + k) % _maxJogadores]);
    ordemDeal.forEach(function (uid) { maos[uid] = []; });
    for (var rodada = 0; rodada < 3; rodada++) {
      ordemDeal.forEach(function (uid) { maos[uid].push(baralho.pop()); });
    }
    var vira = baralho.pop();
    var manilha = _calcularManilha(_valorCarta(vira));
    var uidMao = ordemAssentos[seatMao];

    var g = {};
    Object.keys(base).forEach(function (k) { g[k] = base[k]; });
    g.baralhoRestante = baralho.length; // só a contagem — as cartas em si não interessam ao cliente
    g.descarte = [];
    g.maos = maos;
    g.vira = vira;
    g.manilha = manilha;
    g.rodadaAtual = 0;
    g.vez = uidMao;
    g.liderVaza = uidMao;
    g.apostaAtual = 1;
    g.pedidoTruco = null;
    g.ultimoTimeAumentou = null;
    g.cartasNaMesa = [];
    g.vazasResultados = [];
    g.vencedorMao = null;
    g.pontosUltimaMao = 0;
    g.timeDaMao = _timeDoAssento(seatMao); // fixo pro desempate "3 vazas empatadas" — não muda durante a mão
    return g;
  }

  function _iniciarComoAnfitriao() {
    var jogadores = _sala.jogadores || {};
    if (_sala.game) { _g = _sala.game; _ouvirAcoes(); return; }
    _g = _prepararNovaMao(_novoJogoInicial(), jogadores);
    _salvarGame();
    _ouvirAcoes();
  }

  function _salvarGame() {
    if (!_souAnfitriao || !_ctx.salaRef) return;
    _ctx.salaRef.child('game').set(_g).catch(function () {});
  }

  function _ouvirAcoes() {
    if (!_souAnfitriao || !_ctx.salaRef) return;
    var ref = _ctx.salaRef.child('acoes');
    var handler = function (snap) {
      var acao = snap.val();
      if (acao) _processarAcao(acao);
      ref.child(snap.key).remove().catch(function () {});
    };
    ref.on('child_added', handler);
    _off.push({ ref: ref, evento: 'child_added', cb: handler });
  }

  function _proximoAssentoVivo(seatAtual) { return (seatAtual + 1) % _maxJogadores; }

  function _processarAcao(acao) {
    if (!_g || !_sala) return;
    var jogadores = _sala.jogadores || {};
    if (_g.vencedorPartida) return; // partida já acabou, ignora qualquer ação atrasada

    if (acao.tipo === 'jogarCarta') _acaoJogarCarta(acao, jogadores);
    else if (acao.tipo === 'pedirAumento') _acaoPedirAumento(acao, jogadores);
    else if (acao.tipo === 'responderAumento') _acaoResponderAumento(acao, jogadores);
    else if (acao.tipo === 'revanche') _acaoRevanche(acao, jogadores);
  }

  function _acaoJogarCarta(acao, jogadores) {
    var g = _g;
    if (g.vencedorMao) return; // mão em exibição de resultado, aguardando próxima
    if (g.pedidoTruco) return; // aposta pendente: ninguém joga carta até resolver
    if (g.vez !== acao.uid) return;
    var mao = g.maos[acao.uid] || [];
    var idx = mao.indexOf(acao.payload && acao.payload.carta);
    if (idx < 0) return; // carta não está na mão desse jogador — ignora (cliente adulterado ou dessincronizado)

    mao.splice(idx, 1);
    g.cartasNaMesa.push({ uid: acao.uid, carta: acao.payload.carta, escondida: !!acao.payload.escondida });

    var vivos = Object.keys(jogadores).length;
    if (g.cartasNaMesa.length < vivos) {
      var seatAtual = jogadores[acao.uid].seat;
      var prox = _proximoAssentoVivo(seatAtual);
      g.vez = _uidDoAssento(jogadores, prox);
      _salvarGame();
      return;
    }

    // Vaza completa: avalia, arquiva no descarte e decide se a mão fechou.
    var resultado = _avaliarVaza(g.cartasNaMesa, g.manilha, jogadores);
    g.vazasResultados.push(resultado.time);
    g.descarte = g.descarte.concat(g.cartasNaMesa.map(function (e) { return e.carta; }));
    g.cartasNaMesa = [];
    g.rodadaAtual++;

    var proximoLider = resultado.uid || g.liderVaza; // empate: quem abriu esta vaza abre a próxima
    g.liderVaza = proximoLider;
    g.vez = proximoLider;

    var vencedorMao = _avaliarMao(g.vazasResultados, g.timeDaMao);
    if (vencedorMao) _fecharMao(vencedorMao, g.apostaAtual, 'vazas');
    else _salvarGame();
  }

  function _fecharMao(timeVencedor, pontos, motivo) {
    var g = _g;
    g.vencedorMao = timeVencedor;
    g.pontosUltimaMao = pontos;
    g.pontuacao[timeVencedor] = (g.pontuacao[timeVencedor] || 0) + pontos;
    g.historico = (g.historico || []).concat([{
      maoAtual: g.maoAtual, vencedor: timeVencedor, pontos: pontos, motivo: motivo
    }]);
    if (g.historico.length > 30) g.historico = g.historico.slice(-30); // teto de segurança no RTDB

    if (g.pontuacao[timeVencedor] >= PONTOS_PARTIDA) {
      g.vencedorPartida = timeVencedor;
      _salvarGame();
      return;
    }
    _salvarGame();
    _cancelarAgendamentos();
    _timerProximaMao = setTimeout(function () {
      if (!_souAnfitriao || !_g || _g.vencedorPartida) return;
      var jogadores = (_sala && _sala.jogadores) || {};
      var base = { pontuacao: _g.pontuacao, maoAtual: _g.maoAtual + 1, vencedorPartida: null, historico: _g.historico };
      _g = _prepararNovaMao(base, jogadores);
      _salvarGame();
    }, 2600);
  }

  function _acaoPedirAumento(acao, jogadores) {
    var g = _g;
    if (g.vencedorMao) return;
    var time = _timeDoUid(acao.uid, jogadores);
    if (!time || !_meuTeamPodeServidor(g, time)) return;
    var proximo = _proximoValorAposta(g.apostaAtual);
    if (!proximo) return;
    g.pedidoTruco = { de: acao.uid, time: time, valor: proximo };
    _salvarGame();
  }
  function _meuTeamPodeServidor(g, time) {
    return !g.pedidoTruco && g.apostaAtual < 12 && g.ultimoTimeAumentou !== time;
  }

  function _acaoResponderAumento(acao, jogadores) {
    var g = _g;
    if (!g.pedidoTruco) return;
    var time = _timeDoUid(acao.uid, jogadores);
    if (!time || time === g.pedidoTruco.time) return; // só o time adversário do pedido responde
    var resposta = acao.payload && acao.payload.resposta;

    if (resposta === 'aceitar') {
      g.ultimoTimeAumentou = g.pedidoTruco.time;
      g.apostaAtual = g.pedidoTruco.valor;
      g.pedidoTruco = null;
      _salvarGame();
    } else if (resposta === 'correr') {
      var timeQueGanhou = g.pedidoTruco.time;
      var pontos = g.apostaAtual; // valor QUE JÁ VALIA antes deste pedido
      g.pedidoTruco = null;
      _fecharMao(timeQueGanhou, pontos, 'correu');
    } else if (resposta === 'aumentar') {
      var proximo = _proximoValorAposta(g.pedidoTruco.valor);
      if (!proximo) return;
      g.pedidoTruco = { de: acao.uid, time: time, valor: proximo };
      _salvarGame();
    }
  }

  function _acaoRevanche(acao, jogadores) {
    if (!_g || !_g.vencedorPartida) return;
    var base = { pontuacao: { A: 0, B: 0 }, maoAtual: 0, vencedorPartida: null, historico: [] };
    _g = _prepararNovaMao(base, jogadores);
    _salvarGame();
  }

  /* ═══════════════ 4. QUALQUER CLIENTE: EMPURRAR AÇÕES ═══════════════ */

  function _empurrarAcao(tipo, payload) {
    if (!_ctx || !_ctx.salaRef || !_uid) return;
    _ctx.salaRef.child('acoes').push({
      uid: _uid, tipo: tipo, payload: payload || {}, ts: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () {});
  }

  /* ═══════════════ 5. CANCELAMENTO POR JOGADOR AUSENTE (só anfitrião) ═══ */

  function _checarJogadoresAusentes(sala) {
    if (!_souAnfitriao || sala.status !== 'jogando') return;
    var qtd = Object.keys(sala.jogadores || {}).length;
    if (qtd < _maxJogadores) {
      _flash('Um jogador saiu — a partida foi cancelada.');
      _ctx.voltarAoLobby();
    }
  }

  /* ═══════════════ 6. CICLO DE VIDA ═══════════════ */

  function iniciar(ctx) {
    _ctx = ctx;
    _uid = ctx.uid;
    _souAnfitriao = ctx.souAnfitriao;
    _root = ctx.container;
    _sala = ctx.salaSnapshot();
    _maxJogadores = (_sala && _sala.maxJogadores) || 2;
    _cartaSelecionada = null;

    if (_souAnfitriao) _iniciarComoAnfitriao();

    ctx.onSala(function (sala) {
      _sala = sala;
      _g = sala.game || _g;
      if (_g && !_g.timeDaMao && _g.vez && sala.jogadores) _g.timeDaMao = _timeDoUid(_g.vez, sala.jogadores);
      _checarJogadoresAusentes(sala);
      _render();
    });

    _render();
  }

  function parar() {
    _off.forEach(function (l) { try { l.ref.off(l.evento, l.cb); } catch (e) {} });
    _off = [];
    _cancelarAgendamentos();
    if (_root) { while (_root.firstChild) _root.removeChild(_root.firstChild); }
    _ctx = null; _uid = null; _souAnfitriao = false; _g = null; _sala = null;
    _cartaSelecionada = null; _root = null;
  }

  function _cancelarAgendamentos() {
    if (_timerProximaMao) { clearTimeout(_timerProximaMao); _timerProximaMao = null; }
  }

  /* ═══════════════ 7. UI: MESA DO TRUCO (prefixo trc-) ═══════════════ */

  function _cls(n) { return 'trc-' + n; }
  function _elx(tag, classes, attrs) {
    var e = document.createElement(tag);
    if (classes) (Array.isArray(classes) ? classes : classes.split(' ')).forEach(function (c) { e.classList.add(_cls(c)); });
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'texto') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    return e;
  }

  function _flash(texto) {
    if (!_root) return;
    var caixa = _root.querySelector('.' + _cls('flash'));
    if (!caixa) { caixa = _elx('div', 'flash'); _root.appendChild(caixa); }
    caixa.textContent = texto;
    caixa.classList.add(_cls('flash-visivel'));
    clearTimeout(_flashTimer);
    _flashTimer = setTimeout(function () { caixa.classList.remove(_cls('flash-visivel')); }, 2600);
  }

  function _nomeDoUid(uid) {
    var j = _sala && _sala.jogadores && _sala.jogadores[uid];
    return j ? j.nome : '...';
  }

  function _cartaEl(cod, opcoes) {
    opcoes = opcoes || {};
    var el = _elx('div', 'carta' + (opcoes.pequena ? ' trc-carta-pequena' : ''));
    if (opcoes.virada) {
      el.classList.add(_cls('carta-verso'));
      el.appendChild(_elx('span', 'carta-verso-coruja', { texto: '🦉' }));
      return el;
    }
    var valor = _valorCarta(cod), naipe = _naipeCarta(cod);
    el.classList.add(_cls('carta-' + COR_NAIPE[naipe]));
    if (opcoes.manilha) el.classList.add(_cls('carta-manilha'));
    var topo = _elx('span', 'carta-valor', { texto: valor });
    var meio = _elx('span', 'carta-naipe-grande', { texto: SIMBOLO_NAIPE[naipe] });
    var baixo = _elx('span', 'carta-valor carta-valor-baixo', { texto: valor });
    el.appendChild(topo); el.appendChild(meio); el.appendChild(baixo);
    return el;
  }

  // Layout relativo: sul = eu, norte = à minha frente (parceiro se 4
  // jogadores, único adversário se 2), leste/oeste = os outros dois (4).
  function _posicaoRelativa(meuSeat, seatAlvo) {
    var diff = (seatAlvo - meuSeat + _maxJogadores) % _maxJogadores;
    if (_maxJogadores === 2) return diff === 0 ? 'sul' : 'norte';
    return ['sul', 'leste', 'norte', 'oeste'][diff] || 'norte';
  }

  function _render() {
    if (!_root || !_sala) return;
    while (_root.firstChild) _root.removeChild(_root.firstChild);
    if (!_g) { _root.appendChild(_elx('div', 'carregando', { texto: 'Preparando a mesa…' })); return; }

    var jogadores = _sala.jogadores || {};
    var meuSeat = (jogadores[_uid] && jogadores[_uid].seat) || 0;
    var meuTime = _time();

    var mesa = _elx('div', 'mesa');

    // ---- placar ----
    var placar = _elx('div', 'placar');
    placar.appendChild(_criarPlacarTime('A', jogadores, meuTime));
    var centro = _elx('div', 'placar-centro');
    centro.appendChild(_elx('span', 'placar-aposta', { texto: _g.apostaAtual + ' ponto' + (_g.apostaAtual > 1 ? 's' : '') }));
    centro.appendChild(_elx('span', 'placar-mao', { texto: 'Mão ' + (_g.maoAtual + 1) }));
    placar.appendChild(centro);
    placar.appendChild(_criarPlacarTime('B', jogadores, meuTime));
    mesa.appendChild(placar);

    // ---- vira / manilha ----
    var viraWrap = _elx('div', 'vira-wrap');
    viraWrap.appendChild(_elx('span', 'vira-label', { texto: 'Vira' }));
    viraWrap.appendChild(_cartaEl(_g.vira, { pequena: true }));
    viraWrap.appendChild(_elx('span', 'vira-manilha', { texto: 'Manilha: ' + _g.manilha + SIMBOLO_NAIPE.O + ' e naipes' }));
    mesa.appendChild(viraWrap);

    // ---- outros jogadores (norte/leste/oeste) ----
    var faixaOutros = _elx('div', 'outros');
    Object.keys(jogadores).forEach(function (uid) {
      if (uid === _uid) return;
      var seat = jogadores[uid].seat;
      var pos = _posicaoRelativa(meuSeat, seat);
      var chip = _elx('div', 'jogador-chip trc-pos-' + pos);
      chip.appendChild(_elx('span', 'jogador-nome', { texto: jogadores[uid].nome }));
      var qtdMao = (_g.maos && _g.maos[uid] && _g.maos[uid].length) || 0;
      var mini = _elx('div', 'mini-mao');
      for (var i = 0; i < qtdMao; i++) mini.appendChild(_cartaEl(null, { virada: true }));
      chip.appendChild(mini);
      if (_g.vez === uid) chip.classList.add(_cls('jogador-vez'));
      faixaOutros.appendChild(chip);
    });
    mesa.appendChild(faixaOutros);

    // ---- mesa (cartas jogadas nesta vaza) ----
    var centroMesa = _elx('div', 'centro-mesa');
    _g.cartasNaMesa.forEach(function (e) {
      var pos = _posicaoRelativa(meuSeat, jogadores[e.uid] ? jogadores[e.uid].seat : meuSeat);
      var slot = _elx('div', 'slot-mesa trc-pos-' + pos);
      slot.appendChild(_cartaEl(e.carta, { virada: e.escondida && e.uid !== _uid }));
      centroMesa.appendChild(slot);
    });
    mesa.appendChild(centroMesa);

    // ---- overlay: pedido de aumento pendente ----
    // Ordem importa: vencedorPartida implica vencedorMao (fecharMao nunca
    // limpa o campo), então a checagem de partida vem ANTES da de mão —
    // senão o placar final nunca apareceria, só a tela de "mão terminou".
    if (_g.pedidoTruco) mesa.appendChild(_criarOverlayPedido(meuTime));
    else if (_g.vencedorPartida) mesa.appendChild(_criarOverlayFimPartida());
    else if (_g.vencedorMao) mesa.appendChild(_criarOverlayFimMao());

    // ---- minha mão + ações ----
    mesa.appendChild(_criarMinhaMao(jogadores));
    mesa.appendChild(_criarBarraAcoes(meuTime));

    var voltar = _elx('button', 'btn-sair-partida', { type: 'button', texto: 'Sair da partida' });
    voltar.addEventListener('click', function () { _ctx.sairDoJogo(); });
    mesa.appendChild(voltar);

    _root.appendChild(mesa);
  }

  function _criarPlacarTime(time, jogadores, meuTime) {
    var nomes = Object.keys(jogadores).filter(function (uid) { return _timeDoUid(uid, jogadores) === time; })
      .map(function (uid) { return jogadores[uid].nome; }).join(' & ');
    var wrap = _elx('div', 'placar-time' + (time === meuTime ? ' trc-placar-meu' : ''));
    wrap.appendChild(_elx('span', 'placar-numero', { texto: String((_g.pontuacao && _g.pontuacao[time]) || 0) }));
    wrap.appendChild(_elx('span', 'placar-nomes', { texto: nomes || ('Time ' + time) }));
    return wrap;
  }

  function _criarMinhaMao(jogadores) {
    var wrap = _elx('div', 'minha-mao-wrap');
    var minhaMao = (_g.maos && _g.maos[_uid]) || [];
    var mao = _elx('div', 'minha-mao');
    var souVez = _g.vez === _uid && !_g.pedidoTruco && !_g.vencedorMao && !_g.vencedorPartida;

    minhaMao.forEach(function (cod) {
      var opts = { manilha: _ehManilha(cod, _g.manilha) };
      var el = _cartaEl(cod, opts);
      if (souVez) {
        el.classList.add(_cls('carta-jogavel'));
        if (_cartaSelecionada === cod) el.classList.add(_cls('carta-selecionada'));
        el.addEventListener('click', function () {
          _cartaSelecionada = (_cartaSelecionada === cod) ? null : cod;
          _render();
        });
      }
      mao.appendChild(el);
    });
    wrap.appendChild(mao);

    if (souVez && _cartaSelecionada) {
      var confirmar = _elx('div', 'confirmar-jogada');
      var btnJogar = _elx('button', 'btn-jogar', { type: 'button', texto: 'Jogar' });
      btnJogar.addEventListener('click', function () {
        _empurrarAcao('jogarCarta', { carta: _cartaSelecionada, escondida: false });
        _cartaSelecionada = null;
      });
      var btnEsconder = _elx('button', 'btn-jogar-escondida', { type: 'button', texto: 'Jogar escondida' });
      btnEsconder.addEventListener('click', function () {
        _empurrarAcao('jogarCarta', { carta: _cartaSelecionada, escondida: true });
        _cartaSelecionada = null;
      });
      confirmar.appendChild(btnJogar); confirmar.appendChild(btnEsconder);
      wrap.appendChild(confirmar);
    } else {
      wrap.appendChild(_elx('p', 'turno-info', {
        texto: _g.vencedorPartida ? '' : _g.vencedorMao ? '' : _g.pedidoTruco ? '' :
          (souVez ? 'Sua vez — escolha uma carta' : 'Vez de ' + _nomeDoUid(_g.vez))
      }));
    }
    return wrap;
  }

  function _criarBarraAcoes(meuTime) {
    var barra = _elx('div', 'barra-acoes');
    if (_g.vencedorPartida || _g.vencedorMao || _g.pedidoTruco) return barra; // nada a pedir agora

    if (_meuTeamPode(_g)) {
      var proximo = _proximoValorAposta(_g.apostaAtual);
      var rotulo = _g.apostaAtual === 1 ? 'Truco!' : ('Pedir ' + proximo);
      var btn = _elx('button', 'btn-truco', { type: 'button', texto: rotulo });
      btn.addEventListener('click', function () { _empurrarAcao('pedirAumento', {}); });
      barra.appendChild(btn);
    }
    return barra;
  }

  function _criarOverlayPedido(meuTime) {
    var ov = _elx('div', 'overlay');
    var caixa = _elx('div', 'overlay-caixa');
    var pedeNome = _nomeDoUid(_g.pedidoTruco.de);
    caixa.appendChild(_elx('h3', 'overlay-titulo', { texto: pedeNome + ' pediu ' + _g.pedidoTruco.valor + '!' }));

    if (_g.pedidoTruco.time === meuTime) {
      caixa.appendChild(_elx('p', 'overlay-texto', { texto: 'Aguardando resposta do outro time…' }));
    } else {
      var acoes = _elx('div', 'overlay-acoes');
      var btnAceitar = _elx('button', 'btn-aceitar', { type: 'button', texto: 'Aceitar' });
      btnAceitar.addEventListener('click', function () { _empurrarAcao('responderAumento', { resposta: 'aceitar' }); });
      var btnCorrer = _elx('button', 'btn-correr', { type: 'button', texto: 'Correr' });
      btnCorrer.addEventListener('click', function () { _empurrarAcao('responderAumento', { resposta: 'correr' }); });
      acoes.appendChild(btnAceitar); acoes.appendChild(btnCorrer);
      if (_proximoValorAposta(_g.pedidoTruco.valor)) {
        var btnAumentar = _elx('button', 'btn-aumentar', { type: 'button', texto: 'Pedir ' + _proximoValorAposta(_g.pedidoTruco.valor) });
        btnAumentar.addEventListener('click', function () { _empurrarAcao('responderAumento', { resposta: 'aumentar' }); });
        acoes.appendChild(btnAumentar);
      }
      caixa.appendChild(acoes);
    }
    ov.appendChild(caixa);
    return ov;
  }

  function _criarOverlayFimMao() {
    var ov = _elx('div', 'overlay');
    var caixa = _elx('div', 'overlay-caixa');
    var nomeTime = Object.keys(_sala.jogadores || {}).filter(function (uid) { return _timeDoUid(uid, _sala.jogadores) === _g.vencedorMao; })
      .map(function (uid) { return _sala.jogadores[uid].nome; }).join(' & ');
    caixa.appendChild(_elx('h3', 'overlay-titulo', { texto: (nomeTime || ('Time ' + _g.vencedorMao)) + ' venceu a mão! +' + _g.pontosUltimaMao }));
    caixa.appendChild(_elx('p', 'overlay-texto', { texto: 'Preparando a próxima mão…' }));
    ov.appendChild(caixa);
    return ov;
  }

  function _criarOverlayFimPartida() {
    var ov = _elx('div', 'overlay');
    var caixa = _elx('div', 'overlay-caixa');
    var nomeTime = Object.keys(_sala.jogadores || {}).filter(function (uid) { return _timeDoUid(uid, _sala.jogadores) === _g.vencedorPartida; })
      .map(function (uid) { return _sala.jogadores[uid].nome; }).join(' & ');
    caixa.appendChild(_elx('h3', 'overlay-titulo-grande', { texto: '🏆 ' + (nomeTime || ('Time ' + _g.vencedorPartida)) + ' venceu!' }));
    caixa.appendChild(_elx('p', 'overlay-texto', { texto: _g.pontuacao.A + ' x ' + _g.pontuacao.B }));
    var acoes = _elx('div', 'overlay-acoes');
    if (_souAnfitriao) {
      // Só o anfitrião decide "revanche" ou "voltar ao lobby" — são os dois
      // únicos campos (game/status) que a regra do RTDB deixa ele escrever
      // (ver database.rules.json). Os demais só acompanham.
      var btnRevanche = _elx('button', 'btn-aceitar', { type: 'button', texto: 'Revanche' });
      btnRevanche.addEventListener('click', function () { _empurrarAcao('revanche', {}); });
      var btnLobby = _elx('button', 'btn-correr', { type: 'button', texto: 'Voltar ao lobby' });
      btnLobby.addEventListener('click', function () { _ctx.voltarAoLobby(); });
      acoes.appendChild(btnRevanche); acoes.appendChild(btnLobby);
    } else {
      acoes.appendChild(_elx('p', 'overlay-texto', { texto: 'Aguardando o anfitrião decidir revanche ou voltar ao lobby…' }));
    }
    caixa.appendChild(acoes);
    ov.appendChild(caixa);
    return ov;
  }

  /* ═══════════════ 8. REGISTRO NO HUB DE BARALHO ═══════════════ */

  if (window.AngatubaBaralho) {
    window.AngatubaBaralho.registrarModo('truco', {
      nome: 'Truco Paulista', min: 2, max: 4,
      iniciar: iniciar, parar: parar
    });
  }

  // Exposto só por consistência com o padrão dos outros módulos
  // (window.<Nome>Game) e pra depuração no console — o hub não chama
  // isto diretamente, quem chama é baralho.js via registrarModo.
  window.TrucoGame = { _debug: { regras: { _poder: _poder, _avaliarMao: _avaliarMao, _avaliarVaza: _avaliarVaza, _calcularManilha: _calcularManilha } } };
})();
