/* ══════════════════════════════════════════════════════════════
   UNO — motor de regras + mesa, plugado no sistema de salas de
   Jogos/baralho.js (window.AngatubaBaralho).
   ------------------------------------------------------------
   Mesmo contrato do Truco (Jogos/truco.js): este arquivo é um
   "motor" que se registra com registrarModo('uno', {...}) e, quando
   a sala entra em status "jogando", recebe um <div> vazio
   (ctx.container) pra desenhar a mesa inteira — nenhum markup do Uno
   mora no index.html. NÃO usa Sheets/GAS: só Firebase RTDB, igual
   Truco/Party.

   MODELO DE SINCRONIZAÇÃO (anfitrião valida, RTDB só transporta)
     salasBaralho/{codigo}/game    -> estado completo da partida,
                                      escrito SÓ pelo anfitrião
                                      (objeto inteiro, via set()).
     salasBaralho/{codigo}/acoes/  -> fila de intenções { uid, tipo,
                                      payload }. Qualquer jogador
                                      empurra a própria; só o
                                      anfitrião valida e apaga.
   Todo cliente (inclusive o do anfitrião) só empurra ações e desenha
   o que "game" disser. O anfitrião mantém a cópia local autoritativa
   (_g) e publica ela inteira a cada mudança.

   ARMADILHA DO RTDB: ARRAY/OBJETO VAZIO NÃO EXISTE
   O Firebase apaga a chave em vez de guardar [] ou {}. Por isso:
     1. o anfitrião NUNCA adota o eco do 'value' (a cópia local _g já
        está na frente); só quem não hospeda lê do "game";
     2. tudo que vem do RTDB passa por _normalizarGame(), que recria
        as listas/mapas que sumiram (inclusive a MÃO de cada jogador,
        que vira undefined quando o jogador fica sem carta).

   ONDE MORA O MONTE DE COMPRA
   O "game" é público pra quem está na sala, então publicar o monte
   entregaria as próximas compras. O monte real vive só na memória do
   anfitrião (_monte) e o estado carrega apenas g.monteQtd. Se o
   anfitrião reabrir a partida no meio (ver _iniciarComoAnfitriao), o
   monte é RECONSTRUÍDO: baralho completo menos as mãos menos o
   descarte, embaralhado de novo. O descarte, esse sim, vai inteiro no
   estado — é informação pública e é dele que sai o reembaralhamento.
   (Limitação herdada do Truco: as MÃOS vão no "game", então um
   cliente adulterado consegue ver a mão dos outros. Vale a mesma
   medida de confiança das outras salas do app.)

   ══════════════════ REGRAS IMPLEMENTADAS ══════════════════
   BARALHO (108 cartas)
   - 4 cores (vermelho R, azul B, verde G, amarelo Y). Por cor: um 0,
     dois de cada 1–9, dois +2, dois "inverte", dois "pula" = 25.
   - 4 coringas (escolhe cor) + 4 coringas +4.
   - Código interno da carta: "COR:VALOR" ("R:5", "B:+2", "G:inverte",
     "Y:pula", "W:cor", "W:+4").

   DISTRIBUIÇÃO E CARTA INICIAL
   - 7 cartas por jogador. A primeira carta do descarte é virada até
     sair um NÚMERO — coringa e carta de efeito voltam pro monte. É a
     simplificação clássica: ninguém começa a partida já comprando.

   JOGADA VÁLIDA
   - Mesma cor OU mesmo valor da carta do topo, ou qualquer coringa.
   - O coringa +4 pode ser jogado SEMPRE (regra de casa): não se checa
     se o jogador tinha cor válida na mão, porque não há como checar
     "desafio" sem abrir a mão de todo mundo.

   COMPRA
   - O monte é tocável a qualquer momento na sua vez (mesmo tendo
     jogada). Comprar sem dívida tira 1 carta: se ela for jogável, o
     jogador pode JOGAR ESSA CARTA ou apertar "Passar"; se não for, a
     vez passa sozinha. Ou seja, comprar à toa custa uma carta — o
     próprio jogo desestimula enrolação, sem precisar proibir.
   - Monte vazio: o descarte (menos o topo) é embaralhado e vira o
     monte novo. Se nem isso sobrar, a compra simplesmente não
     acontece (partida segue).

   STACK DE +2 / +4 (regra de casa BR — ACUMULATIVO)
   - +2 e +4 EMPILHAM: quem recebe pode responder em vez de comprar, e
     a dívida SOMA (2 → 4 → 6 → 10 …) até alguém não responder.
   - O que responde o quê:
       dívida aberta por +2  -> aceita +2 (de qualquer cor) e +4;
       dívida aberta por +4  -> aceita SÓ +4.
     (+2 em cima de +4 NÃO vale — foi a linha de corte escolhida pra
     não transformar toda mão num mata-mata de +2.)
   - Quem não responde compra a dívida INTEIRA de uma vez e perde a
     vez. O aviso "+6 pra comprar!" fica no centro da mesa.

   EFEITOS
   - "pula": o próximo é pulado. Com 2 jogadores, quem jogou joga de
     novo (efeito idêntico).
   - "inverte": troca o sentido da mesa (↻ / ↺). Com 2 jogadores vale
     como "pula" — é a regra clássica.
   - coringa: escolhe a cor por overlay antes da vez passar.
   - coringa +4: escolhe a cor E abre/soma dívida de 4.

   GRITAR UNO (regra escolhida — versão "pegadinha com janela")
   - O botão "UNO!" aparece quando você tem 2 cartas (antes de jogar a
     penúltima) ou 1 carta. Apertar marca você como declarado.
   - Se você jogar a penúltima SEM ter declarado, abre uma janela de
     MS_PEGAR (5s) em que qualquer OUTRO jogador pode apertar "PEGAR!"
     — quem foi pego compra 2. Apertar "UNO!" dentro da janela salva.
   - Passada a janela, o esquecimento prescreve (ninguém fica refém de
     um clique atrasado). Ficar com 2+ cartas de novo zera a
     declaração.
   - Os bots declaram UNO em ~80% das vezes: dá pra pegar a Coruja.

   VITÓRIA
   - Ganha quem esvazia a mão. O placar acumulado de rodadas fica em
     game.placar e aparece no fim; o anfitrião decide "Nova rodada" ou
     "Voltar ao lobby" (mesmo padrão do fim de partida do Truco).

   ══════════════════ MODO SOLO (1 jogador vs. Coruja) ══════════════
   Sala com maxJogadores = 1 (ver Jogos/baralho.js) tem só UM jogador
   de verdade no RTDB. A mesa vira 1 humano + QTD_BOTS_SOLO bots (hoje
   3, mesa de 4): os bots são LOCAIS, nunca são escritos em
   salasBaralho/{codigo}/jogadores, existem só dentro da cópia do
   anfitrião e são injetados por _jogadoresEfetivos() sempre que o
   resto do código precisa "ver a mesa inteira". Cada bot processa a
   própria jogada chamando _processarAcao() direto, com uid sintético
   — pras regras, é só mais um jogador. Pra mudar o tamanho da mesa
   solo basta mexer em QTD_BOTS_SOLO (e nos nomes em NOMES_BOT).

   BOT v1
   - Joga carta válida de mesma cor ou valor, preferindo gastar a cor
     em que tem mais cartas; segura coringa pro fim.
   - Solta carta de efeito (+2/pula/inverte) quando o próximo está com
     2 cartas ou menos; fora disso descarta o número mais alto.
   - Responde stack se tiver +2/+4 compatível; senão compra a dívida.
   - Escolhe a cor do coringa pela cor mais comum na mão.
   - Pausa de 1,2–2,0s em toda ação (_pausaBot).

   PENDÊNCIAS CONHECIDAS
   1. Sem "desafio" do +4 (ver acima) e sem regra de 7/0 (troca de
      mãos) — as duas exigiriam abrir mão dos outros.
   2. Sem reconexão: se o anfitrião cair no meio, a partida é
      cancelada e a sala volta ao lobby (igual Truco).
   3. Pontuação por cartas restantes (o placar oficial do Uno) não foi
      implementada: o placar conta rodadas ganhas.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ═══════════════ 1. REGRAS (funções puras, sem DOM/Firebase) ═══════════════ */

  var CORES = ['R', 'B', 'G', 'Y'];
  var NOME_COR = { R: 'Vermelho', B: 'Azul', G: 'Verde', Y: 'Amarelo' };
  var ESPECIAIS_COR = ['+2', 'inverte', 'pula'];
  var CARTAS_INICIAIS = 7;

  function _cor(carta) { return String(carta || '').split(':')[0]; }
  function _valor(carta) { return String(carta || '').split(':')[1]; }
  function _ehCoringa(carta) { return _cor(carta) === 'W'; }

  // 108 cartas: por cor um 0, dois de cada 1–9, dois +2/inverte/pula
  // (25 x 4 = 100) + 4 coringas + 4 coringas +4.
  function _criarBaralho() {
    var d = [];
    CORES.forEach(function (c) {
      d.push(c + ':0');
      for (var i = 1; i <= 9; i++) { d.push(c + ':' + i); d.push(c + ':' + i); }
      ESPECIAIS_COR.forEach(function (e) { d.push(c + ':' + e); d.push(c + ':' + e); });
    });
    for (var k = 0; k < 4; k++) { d.push('W:cor'); d.push('W:+4'); }
    return d;
  }

  function _embaralhar(lista) {
    // Fisher-Yates — só roda no anfitrião, que é quem "sabe" a ordem real.
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Jogada válida. Com dívida aberta (stack > 0) só vale RESPONDER:
     dívida de +2 aceita +2 (qualquer cor) ou +4; dívida de +4 aceita
     só +4 (ver cabeçalho). Sem dívida: mesma cor, mesmo valor, ou
     qualquer coringa. */
  function _podeJogar(carta, g) {
    var v = _valor(carta);
    if (g.stack > 0) {
      if (g.stackTipo === '+4') return v === '+4';
      return v === '+2' || v === '+4';
    }
    if (_ehCoringa(carta)) return true;
    return _cor(carta) === g.corAtual || v === g.valorAtual;
  }

  function _temJogada(mao, g) {
    for (var i = 0; i < mao.length; i++) if (_podeJogar(mao[i], g)) return true;
    return false;
  }

  function _rotuloValor(v) {
    if (v === 'pula') return '⊘';
    if (v === 'inverte') return '⇄';
    if (v === 'cor') return '★';
    return v;
  }
  function _nomeValor(v) {
    if (v === 'pula') return 'Pula';
    if (v === 'inverte') return 'Inverte';
    if (v === 'cor') return 'Coringa';
    if (v === '+4') return 'Coringa +4';
    if (v === '+2') return '+2';
    return v;
  }

  /* Reações da mesa (mesmo mecanismo do Truco): lista FIXA, o cliente
     manda só o id e o texto sai daqui — ninguém digita nada, então não
     há o que moderar. */
  var REACOES = [
    { id: 'uno',      texto: 'UNO!' },
    { id: 'essa',     texto: 'Essa doeu!' },
    { id: 'pega',     texto: 'Pega ele!' },
    { id: 'calma',    texto: 'Calma aí…' },
    { id: 'boa',      texto: 'Boa!' },
    { id: 'compra',   texto: 'Compra aí 😈' },
    { id: 'pensando', texto: '🤔' },
    { id: 'risada',   texto: '😂' },
    { id: 'fogo',     texto: '🔥' },
    { id: 'palmas',   texto: '👏' },
    { id: 'chora',    texto: '😭' },
    { id: 'caveira',  texto: '💀' }
  ];
  function _reacaoPorId(id) {
    for (var i = 0; i < REACOES.length; i++) if (REACOES[i].id === id) return REACOES[i];
    return null;
  }

  /* Frase que os DOIS lados precisam ver igual é sorteada pelo ANFITRIÃO
     e gravada no "game" — sorteio local faria cada aparelho mostrar uma
     coisa diferente. As locais (de quem é a vez) podem sortear no cliente. */
  var FRASES = {
    fimPartida: ['Bateu!', 'Acabou as cartas!', 'É campeão!'],
    minhaVez:   ['Sua vez', 'Manda a carta', 'Joga aí'],
    vezDele:    ['Vez de', 'Esperando'],
    pegou:      ['Pegadinha! +2', 'Esqueceu o UNO! +2', 'Pegou! +2'],
    botUno:     ['UNO!', 'Uma carta!', 'Tô quase…'],
    botCompra:  ['Que isso…', '😤', 'Tá bom, eu compro'],
    botJoga:    ['Toma!', '🔥', 'Essa é minha']
  };
  function _frase(chave) {
    var lista = FRASES[chave] || [''];
    return lista[Math.floor(Math.random() * lista.length)];
  }

  /* ═══════════════ 2. ESTADO DO MÓDULO ═══════════════ */

  var _ctx = null;           // contexto recebido de baralho.js
  var _uid = null;
  var _souAnfitriao = false;
  var _maxJogadores = 2;     // capacidade REAL da sala — só usado em _checarJogadoresAusentes
  var _assentos = 2;         // assentos da MESA (no solo: 1 + QTD_BOTS_SOLO)
  var _solo = false;
  var _off = [];             // listeners próprios (acoes)
  var _g = null;             // cópia local do "game" (autoritativa só se _souAnfitriao)
  var _monte = [];           // monte de compra — SÓ no anfitrião, nunca vai pro RTDB
  var _sala = null;
  var _root = null;
  var _timerBot = null;
  var _timerPegar = null;    // janela do "PEGAR!" (anfitrião)
  var _timerBotPegar = null; // bot decidindo se pega alguém
  var _timerBalao = null;
  var _flashTimer = null;
  var _painelReacoes = false;
  var _baloes = {};          // uid -> { texto, expiraEm } (só local)
  var _reacoesVistas = {};   // uid -> última seq exibida
  var _cooldownReacao = {};  // uid -> timestamp (só no anfitrião)
  var _fraseVez = { chave: '', texto: '' };

  var MS_BALAO = 2400;
  var MS_COOLDOWN_REACAO = 3500;
  var MS_PEGAR = 5000;       // janela pra pegar quem esqueceu o UNO
  var MS_BOT_BASE = 1200;    // pausas do bot: 1,2s + até 0,8s
  function _pausaBot() { return MS_BOT_BASE + Math.floor(Math.random() * 800); }

  var QTD_BOTS_SOLO = 3;     // mesa solo = 1 humano + 3 bots (ver cabeçalho)
  var NOMES_BOT = ['Coruja 🦉', 'Corujão 🦉', 'Corujinha 🦉'];
  function _uidBot(i) { return '_bot_coruja_' + i; }
  function _ehBot(uid) { return String(uid || '').indexOf('_bot_coruja_') === 0; }

  /* "jogadores" completo pra fins de jogo: os reais da sala (RTDB) + os
     bots do modo solo. É o que todo o resto deve usar — os bots nunca
     existem em _sala.jogadores (ver MODO SOLO no cabeçalho). */
  function _jogadoresEfetivos() {
    var jogadores = {};
    var base = (_sala && _sala.jogadores) || {};
    Object.keys(base).forEach(function (uid) { jogadores[uid] = base[uid]; });
    if (_solo) {
      for (var i = 0; i < QTD_BOTS_SOLO; i++) {
        jogadores[_uidBot(i)] = { nome: NOMES_BOT[i % NOMES_BOT.length], seat: i + 1, pronto: true, bot: true };
      }
    }
    return jogadores;
  }

  function _ordemAssentos(jogadores) {
    return Object.keys(jogadores).sort(function (a, b) {
      return (jogadores[a].seat || 0) - (jogadores[b].seat || 0);
    });
  }

  // Próximo uid na roda, respeitando o sentido (1 = horário, -1 = anti).
  function _proximo(uid, passos, jogadores) {
    var ordem = _ordemAssentos(jogadores);
    var n = ordem.length;
    if (!n) return uid;
    var i = ordem.indexOf(uid);
    if (i < 0) i = 0;
    var sentido = (_g && _g.sentido) || 1;
    var j = (((i + passos * sentido) % n) + n) % n;
    return ordem[j];
  }

  /* O RTDB não guarda lista nem objeto vazio: ele apaga a chave. Um
     "descarte: []" ou a MÃO de quem ficou sem carta voltam como
     undefined no eco do 'value'. Sem isto, o render estoura no primeiro
     forEach e a mesa fica em branco. */
  function _normalizarGame(g) {
    if (!g) return null;
    g.descarte = g.descarte || [];
    g.placar = g.placar || {};
    g.unoDeclarado = g.unoDeclarado || {};
    g.reacoes = g.reacoes || {};
    g.maos = g.maos || {};
    Object.keys(g.maos).forEach(function (uid) {
      var m = g.maos[uid];
      g.maos[uid] = Array.isArray(m) ? m.filter(function (c) { return !!c; }) : (m ? [m] : []);
    });
    g.stack = g.stack || 0;
    g.stackTipo = g.stackTipo || null;
    g.sentido = g.sentido || 1;
    g.monteQtd = g.monteQtd || 0;
    return g;
  }

  function _topo(g) {
    var d = g.descarte || [];
    return d.length ? d[d.length - 1] : null;
  }

  /* ═══════════════ 3. ANFITRIÃO: DEAL E PROCESSAMENTO DE AÇÕES ═══════════════ */

  function _novoJogoInicial(jogadores) {
    var placar = {};
    Object.keys(jogadores).forEach(function (uid) { placar[uid] = 0; });
    return { placar: placar, rodadaAtual: 0, vencedorPartida: null };
  }

  function _prepararNovaRodada(base, jogadores) {
    var ordem = _ordemAssentos(jogadores);
    _monte = _embaralhar(_criarBaralho());

    var maos = {};
    ordem.forEach(function (uid) { maos[uid] = []; });
    for (var r = 0; r < CARTAS_INICIAIS; r++) {
      ordem.forEach(function (uid) { maos[uid].push(_monte.pop()); });
    }

    // Primeira carta do descarte: vira até sair um NÚMERO (coringa e
    // carta de efeito voltam pro monte). Ninguém começa comprando.
    var descartadas = [];
    var topo = null;
    while (_monte.length) {
      var c = _monte.pop();
      if (!_ehCoringa(c) && ESPECIAIS_COR.indexOf(_valor(c)) < 0) { topo = c; break; }
      descartadas.push(c);
    }
    if (!topo) topo = 'R:0'; // impossível na prática (baralho tem 76 números)
    if (descartadas.length) _monte = _embaralhar(_monte.concat(descartadas));

    var g = {};
    Object.keys(base).forEach(function (k) { g[k] = base[k]; });
    g.maos = maos;
    g.descarte = [topo];
    g.monteQtd = _monte.length;
    g.corAtual = _cor(topo);
    g.valorAtual = _valor(topo);
    g.sentido = 1;
    g.stack = 0;
    g.stackTipo = null;
    g.escolhaCor = null;
    g.compradaJogavel = null;
    g.unoDeclarado = {};
    g.pegavel = null;
    g.vencedorPartida = null;
    g.ultimoEvento = null;
    g.eventoSeq = 0;
    // Quem abre gira a cada rodada, pra não ser sempre o anfitrião.
    g.vez = ordem[(base.rodadaAtual || 0) % ordem.length];
    return g;
  }

  function _iniciarComoAnfitriao() {
    var jogadores = _jogadoresEfetivos();
    if (_sala.game) {
      _g = _normalizarGame(_sala.game);
      _reconstruirMonte();
      _ouvirAcoes();
      if (_g.pegavel) _agendarFecharPegavel();
      _talvezAgirComoBot();
      return;
    }
    _g = _prepararNovaRodada(_novoJogoInicial(jogadores), jogadores);
    _salvarGame();
    _ouvirAcoes();
  }

  /* Retomada do anfitrião: o monte nunca foi pro RTDB (ver cabeçalho),
     então ele é remontado a partir do que É público — baralho completo
     menos as mãos menos o descarte — e embaralhado de novo. As cartas
     que sobram são exatamente as que ninguém viu. */
  function _reconstruirMonte() {
    var restante = _criarBaralho();
    var tirar = [];
    Object.keys(_g.maos || {}).forEach(function (uid) { tirar = tirar.concat(_g.maos[uid] || []); });
    tirar = tirar.concat(_g.descarte || []);
    tirar.forEach(function (c) {
      var i = restante.indexOf(c);
      if (i >= 0) restante.splice(i, 1);
    });
    _monte = _embaralhar(restante);
    _g.monteQtd = _monte.length;
  }

  function _salvarGame() {
    if (!_souAnfitriao || !_ctx || !_ctx.salaRef) return;
    _ctx.salaRef.child('game').set(_g).catch(function () {});
    // O anfitrião não adota o eco do RTDB, então é aqui que ele percebe
    // as próprias reações/balões novos.
    _processarReacoes();
    _render();
    _talvezAgirComoBot();
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

  function _processarAcao(acao) {
    if (!_g || !_sala) return;
    var jogadores = _jogadoresEfetivos();
    if (!jogadores[acao.uid]) return; // não está na mesa
    // "revanche" e "reacao" valem DEPOIS do fim da partida (é quando o
    // botão aparece / a galera comemora), então vêm antes do return.
    if (acao.tipo === 'revanche') { _acaoRevanche(jogadores); return; }
    if (acao.tipo === 'reacao') { _acaoReacao(acao, jogadores); return; }
    if (_g.vencedorPartida) return;

    if (acao.tipo === 'uno') { _acaoUno(acao); return; }
    if (acao.tipo === 'pegar') { _acaoPegar(acao, jogadores); return; }
    if (acao.tipo === 'escolherCor') { _acaoEscolherCor(acao, jogadores); return; }
    if (_g.escolhaCor) return; // cor pendente: ninguém joga nem compra

    if (acao.tipo === 'jogarCarta') _acaoJogarCarta(acao, jogadores);
    else if (acao.tipo === 'comprar') _acaoComprar(acao, jogadores);
    else if (acao.tipo === 'passar') _acaoPassar(acao, jogadores);
  }

  /* ---------- compra / monte ---------- */

  function _comprarCartas(uid, qtd) {
    var mao = _g.maos[uid] = _g.maos[uid] || [];
    for (var i = 0; i < qtd; i++) {
      if (!_monte.length) _reembaralharDescarte();
      if (!_monte.length) break; // acabou de verdade: a compra só não acontece
      mao.push(_monte.pop());
    }
    _g.monteQtd = _monte.length;
    if (mao.length > 1) delete _g.unoDeclarado[uid];
  }

  function _reembaralharDescarte() {
    var d = _g.descarte || [];
    if (d.length <= 1) return;
    var topo = d[d.length - 1];
    _monte = _embaralhar(d.slice(0, d.length - 1));
    _g.descarte = [topo];
    _g.monteQtd = _monte.length;
  }

  // O descarte NÃO pode ter teto (como o historico do Truco tem): ele é o
  // estoque de onde sai o reembaralhamento, então cortar as cartas mais
  // antigas apaga cartas do jogo de verdade — a simulação pegou o baralho
  // caindo de 108 pra 107 exatamente no corte. E não precisa de teto: são
  // no máximo 108 strings curtas, o baralho inteiro.
  function _empilharDescarte(carta) {
    _g.descarte.push(carta);
  }

  function _evento(tipo, uid, texto) {
    _g.eventoSeq = (_g.eventoSeq || 0) + 1;
    _g.ultimoEvento = { tipo: tipo, uid: uid || null, texto: texto || null, seq: _g.eventoSeq };
  }

  /* ---------- jogar carta ---------- */

  function _acaoJogarCarta(acao, jogadores) {
    var g = _g;
    if (g.vez !== acao.uid) return;
    var carta = acao.payload && acao.payload.carta;
    var mao = g.maos[acao.uid] || [];
    var idx = mao.indexOf(carta);
    if (idx < 0) return; // carta não está na mão (cliente adulterado ou dessincronizado)
    if (!_podeJogar(carta, g)) return;
    // Já comprou nesta vez: só a carta comprada pode ser jogada (ver
    // COMPRA no cabeçalho).
    if (g.compradaJogavel && g.compradaJogavel.uid === acao.uid && g.compradaJogavel.carta !== carta) return;

    mao.splice(idx, 1);
    _empilharDescarte(carta);
    g.compradaJogavel = null;
    var v = _valor(carta);

    if (_ehCoringa(carta)) {
      g.valorAtual = v;
      g.corAtual = null; // definido em _acaoEscolherCor
      if (v === '+4') { g.stack = (g.stack || 0) + 4; g.stackTipo = '+4'; }
      if (!mao.length) { _fecharRodada(acao.uid); return; } // bateu com coringa: cor não importa mais
      // A janela do "PEGAR!" só abre depois da cor escolhida (em
      // _finalizarJogada) — abrir aqui também criaria duas janelas
      // seguidas pro mesmo esquecimento.
      g.escolhaCor = { uid: acao.uid };
      _evento('jogou', acao.uid, null);
      _salvarGame();
      return;
    }

    g.corAtual = _cor(carta);
    g.valorAtual = v;
    var passos = 1;
    var naMesa = _ordemAssentos(jogadores).length;
    if (v === '+2') { g.stack = (g.stack || 0) + 2; g.stackTipo = '+2'; }
    else if (v === 'pula') passos = 2;
    else if (v === 'inverte') {
      // Com 2 jogadores inverter a roda equivale a pular — regra clássica.
      if (naMesa === 2) passos = 2;
      else g.sentido = -(g.sentido || 1);
    }
    _evento('jogou', acao.uid, null);
    _finalizarJogada(acao.uid, passos, jogadores);
  }

  function _acaoEscolherCor(acao, jogadores) {
    var g = _g;
    if (!g.escolhaCor || g.escolhaCor.uid !== acao.uid) return;
    var cor = acao.payload && acao.payload.cor;
    if (CORES.indexOf(cor) < 0) return;
    g.corAtual = cor;
    g.escolhaCor = null;
    _finalizarJogada(acao.uid, 1, jogadores);
  }

  function _finalizarJogada(uid, passos, jogadores) {
    var g = _g;
    var mao = g.maos[uid] || [];
    if (!mao.length) { _fecharRodada(uid); return; }
    _abrirJanelaUno(uid);
    g.vez = _proximo(uid, passos, jogadores);
    _salvarGame();
  }

  /* ---------- comprar / passar ---------- */

  function _acaoComprar(acao, jogadores) {
    var g = _g;
    if (g.vez !== acao.uid) return;
    if (g.compradaJogavel) return; // já comprou nesta vez

    if (g.stack > 0) {
      var total = g.stack;
      _comprarCartas(acao.uid, total);
      g.stack = 0; g.stackTipo = null;
      _evento('comprouStack', acao.uid, '+' + total);
      g.vez = _proximo(acao.uid, 1, jogadores);
      _salvarGame();
      return;
    }

    _comprarCartas(acao.uid, 1);
    var mao = g.maos[acao.uid] || [];
    var nova = mao[mao.length - 1];
    _evento('comprou', acao.uid, null);
    if (nova && _podeJogar(nova, g)) {
      g.compradaJogavel = { uid: acao.uid, carta: nova };
      _salvarGame();
    } else {
      g.vez = _proximo(acao.uid, 1, jogadores);
      _salvarGame();
    }
  }

  function _acaoPassar(acao, jogadores) {
    var g = _g;
    if (!g.compradaJogavel || g.compradaJogavel.uid !== acao.uid) return;
    g.compradaJogavel = null;
    g.vez = _proximo(acao.uid, 1, jogadores);
    _salvarGame();
  }

  /* ---------- UNO! / PEGAR! ---------- */

  // Chamado logo depois de uma jogada: quem ficou com 1 carta sem ter
  // declarado fica "pegável" por MS_PEGAR (ver cabeçalho).
  function _abrirJanelaUno(uid) {
    var g = _g;
    var mao = g.maos[uid] || [];
    if (mao.length > 1) { delete g.unoDeclarado[uid]; return; }
    if (mao.length === 1 && !g.unoDeclarado[uid]) {
      g.pegavelSeq = (g.pegavelSeq || 0) + 1;
      g.pegavel = { uid: uid, seq: g.pegavelSeq };
      _agendarFecharPegavel();
    }
  }

  function _agendarFecharPegavel() {
    if (!_souAnfitriao) return;
    clearTimeout(_timerPegar);
    var seq = _g.pegavel && _g.pegavel.seq;
    _timerPegar = setTimeout(function () {
      _timerPegar = null;
      if (!_g || !_g.pegavel || _g.pegavel.seq !== seq) return;
      _g.pegavel = null; // o esquecimento prescreve
      _salvarGame();
    }, MS_PEGAR);
  }

  function _acaoUno(acao) {
    var g = _g;
    var mao = g.maos[acao.uid] || [];
    if (mao.length > 2 || !mao.length) return; // só com 1 ou 2 cartas
    g.unoDeclarado[acao.uid] = true;
    if (g.pegavel && g.pegavel.uid === acao.uid) { g.pegavel = null; clearTimeout(_timerPegar); _timerPegar = null; }
    _balaoDoSistema(acao.uid, 'UNO!');
    _salvarGame();
  }

  function _acaoPegar(acao, jogadores) {
    var g = _g;
    if (!g.pegavel) return;
    if (g.pegavel.uid === acao.uid) return; // ninguém se pega
    if (!jogadores[acao.uid]) return;
    var alvo = g.pegavel.uid;
    g.pegavel = null;
    clearTimeout(_timerPegar); _timerPegar = null;
    _comprarCartas(alvo, 2);
    _evento('pegou', alvo, _frase('pegou'));
    _balaoDoSistema(acao.uid, 'Peguei!');
    _salvarGame();
  }

  /* ---------- fim de rodada ---------- */

  function _fecharRodada(uid) {
    var g = _g;
    g.vencedorPartida = uid;
    g.placar = g.placar || {};
    g.placar[uid] = (g.placar[uid] || 0) + 1;
    g.pegavel = null;
    g.escolhaCor = null;
    g.compradaJogavel = null;
    g.stack = 0; g.stackTipo = null;
    g.fraseFim = _frase('fimPartida');
    _cancelarAgendamentos();
    _salvarGame();
  }

  function _acaoRevanche(jogadores) {
    if (!_g || !_g.vencedorPartida) return;
    var base = {
      placar: _g.placar || {},
      rodadaAtual: (_g.rodadaAtual || 0) + 1,
      vencedorPartida: null
    };
    _g = _prepararNovaRodada(base, jogadores);
    _salvarGame();
  }

  /* ---------- reações ---------- */

  function _acaoReacao(acao, jogadores) {
    var g = _g;
    var id = acao.payload && acao.payload.id;
    if (!_reacaoPorId(id)) return;
    if (!jogadores[acao.uid]) return;
    var agora = Date.now();
    if (_cooldownReacao[acao.uid] && (agora - _cooldownReacao[acao.uid]) < MS_COOLDOWN_REACAO) return;
    _cooldownReacao[acao.uid] = agora;
    g.reacaoSeq = (g.reacaoSeq || 0) + 1;
    g.reacoes = g.reacoes || {};
    g.reacoes[acao.uid] = { id: id, seq: g.reacaoSeq };
    _salvarGame();
  }

  /* Balão que o JOGO solta (não veio de toque em reação). Usa o mesmo
     canal das reações — o cliente desenha { texto, seq } igualzinho.
     Não grava sozinho: quem chama já termina em _salvarGame(). */
  function _balaoDoSistema(uid, texto) {
    var g = _g;
    if (!g || !uid || !texto) return;
    g.reacaoSeq = (g.reacaoSeq || 0) + 1;
    g.reacoes = g.reacoes || {};
    g.reacoes[uid] = { texto: texto, seq: g.reacaoSeq };
  }

  /* ═══════════════ 3.5. MODO SOLO: BOTS LOCAIS "CORUJA" (só anfitrião) ═══
     Chamado a partir de _salvarGame() — todo lugar que muda _g e persiste
     passa por lá, então é o único ponto que precisa "acordar" os bots.
     Eles agem via _processarAcao() com uid sintético: pras regras, são
     só mais jogadores. */

  function _talvezAgirComoBot() {
    clearTimeout(_timerBot);
    clearTimeout(_timerBotPegar);
    if (!_solo || !_souAnfitriao || !_g || _g.vencedorPartida) return;

    // Alguém esqueceu o UNO: um bot pode pegar (se não for outro bot —
    // bot pegando bot é invisível pra quem joga e só atrasa a mesa).
    if (_g.pegavel && !_ehBot(_g.pegavel.uid)) {
      var caçador = _escolherBotCaçador();
      if (caçador && Math.random() < 0.7) {
        _timerBotPegar = setTimeout(function () {
          if (_g && _g.pegavel && _g.pegavel.uid !== caçador) _processarAcao({ uid: caçador, tipo: 'pegar', payload: {} });
        }, 1400 + Math.floor(Math.random() * 1200));
      }
    }

    if (_g.escolhaCor && _ehBot(_g.escolhaCor.uid)) {
      _timerBot = setTimeout(_botEscolherCor, _pausaBot());
      return;
    }
    if (_g.escolhaCor) return; // cor é do humano: espera
    if (_ehBot(_g.vez)) _timerBot = setTimeout(_botAgir, _pausaBot());
  }

  function _escolherBotCaçador() {
    var jogadores = _jogadoresEfetivos();
    var bots = Object.keys(jogadores).filter(function (u) { return _ehBot(u); });
    if (!bots.length) return null;
    return bots[Math.floor(Math.random() * bots.length)];
  }

  function _corMaisComum(mao) {
    var cont = { R: 0, B: 0, G: 0, Y: 0 };
    mao.forEach(function (c) { if (!_ehCoringa(c)) cont[_cor(c)]++; });
    var melhor = CORES[Math.floor(Math.random() * CORES.length)], max = -1;
    CORES.forEach(function (c) { if (cont[c] > max) { max = cont[c]; melhor = c; } });
    return melhor;
  }

  function _botEscolherCor() {
    if (!_g || !_g.escolhaCor) return;
    var uid = _g.escolhaCor.uid;
    if (!_ehBot(uid)) return;
    _processarAcao({ uid: uid, tipo: 'escolherCor', payload: { cor: _corMaisComum(_g.maos[uid] || []) } });
  }

  /* Escolha de carta do bot (v1):
       - com dívida aberta, responde com o +2/+4 que valer (prefere o +2,
         pra guardar o +4 que é mais versátil);
       - sem dívida, tira os coringas da lista e prefere a cor em que tem
         mais cartas;
       - se o PRÓXIMO jogador está com 2 cartas ou menos, prioriza carta
         de efeito (+2 > pula > inverte) — é quando atrapalhar vale mais
         do que descartar número alto;
       - fora isso, joga o número mais alto (esvazia carta "cara" antes);
       - coringa só quando não há nada mais; +4 é o último recurso. */
  function _escolherCartaBot(uid, jogaveis, jogadores) {
    var g = _g;
    if (g.stack > 0) {
      var doisPlus = jogaveis.filter(function (c) { return _valor(c) === '+2'; });
      return doisPlus.length ? doisPlus[0] : jogaveis[0];
    }
    var coloridas = jogaveis.filter(function (c) { return !_ehCoringa(c); });
    if (!coloridas.length) {
      var simples = jogaveis.filter(function (c) { return _valor(c) === 'cor'; });
      return simples.length ? simples[0] : jogaveis[0];
    }
    var mao = g.maos[uid] || [];
    var corPreferida = _corMaisComum(mao);
    var naCor = coloridas.filter(function (c) { return _cor(c) === corPreferida; });
    var pool = naCor.length ? naCor : coloridas;

    var proximoUid = _proximo(uid, 1, jogadores);
    var maoProximo = (g.maos[proximoUid] || []).length;
    if (maoProximo <= 2) {
      var ordemEfeito = ['+2', 'pula', 'inverte'];
      for (var i = 0; i < ordemEfeito.length; i++) {
        var achou = pool.filter(function (c) { return _valor(c) === ordemEfeito[i]; });
        if (achou.length) return achou[0];
      }
    }
    var numeros = pool.filter(function (c) { return /^[0-9]$/.test(_valor(c)); });
    if (numeros.length) {
      return numeros.sort(function (a, b) { return Number(_valor(b)) - Number(_valor(a)); })[0];
    }
    return pool[0];
  }

  function _botAgir() {
    if (!_g || _g.vencedorPartida || _g.escolhaCor) return;
    var uid = _g.vez;
    if (!_ehBot(uid)) return;
    var jogadores = _jogadoresEfetivos();
    var mao = _g.maos[uid] || [];

    // Comprou nesta vez e a carta não serve mais / prefere passar.
    if (_g.compradaJogavel && _g.compradaJogavel.uid === uid) {
      var comprada = _g.compradaJogavel.carta;
      if (_podeJogar(comprada, _g)) {
        if (mao.length === 2) _talvezDeclararUnoBot(uid);
        _processarAcao({ uid: uid, tipo: 'jogarCarta', payload: { carta: comprada } });
      } else {
        _processarAcao({ uid: uid, tipo: 'passar', payload: {} });
      }
      return;
    }

    var jogaveis = mao.filter(function (c) { return _podeJogar(c, _g); });
    if (!jogaveis.length) {
      if (_g.stack > 0) _balaoDoBot(uid, 'botCompra', 0.35);
      _processarAcao({ uid: uid, tipo: 'comprar', payload: {} });
      return;
    }
    if (mao.length === 2) _talvezDeclararUnoBot(uid);
    var escolha = _escolherCartaBot(uid, jogaveis, jogadores);
    if (_valor(escolha) === '+2' || _valor(escolha) === '+4') _balaoDoBot(uid, 'botJoga', 0.3);
    _processarAcao({ uid: uid, tipo: 'jogarCarta', payload: { carta: escolha } });
  }

  // O bot "grita UNO" em ~80% das vezes — os 20% restantes são a chance
  // de quem está jogando pegar a Coruja no contrapé.
  function _talvezDeclararUnoBot(uid) {
    if (Math.random() < 0.8) _processarAcao({ uid: uid, tipo: 'uno', payload: {} });
  }

  function _balaoDoBot(uid, chave, chance) {
    if (!_solo || !_souAnfitriao || !_g) return;
    if (Math.random() > chance) return;
    _balaoDoSistema(uid, _frase(chave));
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
    _solo = _maxJogadores === 1;
    _assentos = _solo ? (1 + QTD_BOTS_SOLO) : _maxJogadores;
    _painelReacoes = false;
    _baloes = {}; _reacoesVistas = {}; _cooldownReacao = {};
    _fraseVez = { chave: '', texto: '' };

    if (_souAnfitriao) _iniciarComoAnfitriao();

    ctx.onSala(function (sala) {
      _sala = sala;
      // O anfitrião é dono do estado: a cópia local (_g) é sempre a boa.
      // Adotar o eco do RTDB traria de volta um estado mutilado (listas
      // vazias somem). Quem não hospeda só tem o eco, então normaliza.
      if (!_souAnfitriao) _g = _normalizarGame(sala.game) || _g;
      _processarReacoes();
      _checarJogadoresAusentes(sala);
      _render();
    });

    _render();
  }

  function parar() {
    _off.forEach(function (l) { try { l.ref.off(l.evento, l.cb); } catch (e) {} });
    _off = [];
    _cancelarAgendamentos();
    if (_timerBalao) { clearTimeout(_timerBalao); _timerBalao = null; }
    if (_root) { while (_root.firstChild) _root.removeChild(_root.firstChild); }
    _ctx = null; _uid = null; _souAnfitriao = false; _g = null; _sala = null;
    _monte = []; _root = null; _solo = false; _assentos = 2;
    _painelReacoes = false; _baloes = {}; _reacoesVistas = {}; _cooldownReacao = {};
    _fraseVez = { chave: '', texto: '' };
  }

  // NÃO mexe no _timerBalao: esta função roda no meio da partida e
  // mataria o balão que acabou de subir (balão é enfeite de ciclo
  // próprio — só o parar() derruba).
  function _cancelarAgendamentos() {
    if (_timerBot) { clearTimeout(_timerBot); _timerBot = null; }
    if (_timerBotPegar) { clearTimeout(_timerBotPegar); _timerBotPegar = null; }
    if (_timerPegar) { clearTimeout(_timerPegar); _timerPegar = null; }
  }

  /* ═══════════════ 7. UI: MESA DO UNO (prefixo uno-) ═══════════════
     Layout, de cima pra baixo: barra de status -> oponentes (chips que
     quebram linha, então 7 oponentes cabem sem virar sopa) -> centro
     (monte + descarte + aviso de stack) -> base (ações + minha mão).

     ATENÇÃO: _elx já prefixa TODA classe com "uno-" (ver _cls). Passar a
     classe já prefixada gera "uno-uno-x", que não casa com nada no CSS e
     falha em silêncio. Classe aqui vai SEMPRE sem prefixo. */

  function _cls(n) { return 'uno-' + n; }
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
    var j = _jogadoresEfetivos()[uid];
    return j ? j.nome : '...';
  }

  function _iniciais(nome) {
    // Sem \p{L}: emoji no apelido (a Coruja tem um) viraria inicial.
    var n = String(nome || '?').replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').trim();
    if (!n) return '🦉';
    var partes = n.split(/\s+/);
    return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
  }

  /* Carta: fundo na cor, oval branca inclinada no meio (a cara do Uno) e
     o valor grande por cima, com os cantos repetindo o valor. Coringa usa
     as 4 cores num conic-gradient (ver uno.css). */
  function _cartaEl(cod, opcoes) {
    opcoes = opcoes || {};
    var el = _elx('div', 'carta' + (opcoes.pequena ? ' carta-pequena' : ''));
    if (opcoes.verso) {
      el.classList.add(_cls('carta-verso'));
      el.appendChild(_elx('span', 'carta-verso-marca', { texto: '🦉' }));
      return el;
    }
    var cor = _cor(cod), v = _valor(cod);
    el.classList.add(_cls('carta-c-' + (cor === 'W' ? 'W' : cor)));
    if (opcoes.corEscolhida) el.classList.add(_cls('carta-tingida-' + opcoes.corEscolhida));
    el.setAttribute('aria-label', (cor === 'W' ? '' : NOME_COR[cor] + ' ') + _nomeValor(v));
    el.appendChild(_elx('span', 'carta-canto carta-canto-cima', { texto: _rotuloValor(v) }));
    var oval = _elx('span', 'carta-oval');
    oval.appendChild(_elx('span', 'carta-valor', { texto: _rotuloValor(v) }));
    el.appendChild(oval);
    el.appendChild(_elx('span', 'carta-canto carta-canto-baixo', { texto: _rotuloValor(v) }));
    return el;
  }

  /* ---------- balões de reação ----------
     O estado que trafega é só { id|texto, seq }. Quem controla POR QUANTO
     TEMPO o balão fica no ar é cada cliente, com timer local: comparar
     timestamp do anfitrião com o relógio de quem assiste daria balão
     fantasma (relógio adiantado) ou balão nenhum (atrasado). */
  function _processarReacoes() {
    if (!_g || !_g.reacoes) return;
    var agora = Date.now(), mudou = false;
    Object.keys(_g.reacoes).forEach(function (uid) {
      var r = _g.reacoes[uid];
      if (!r || !r.seq) return;
      if (_reacoesVistas[uid] === r.seq) return;
      _reacoesVistas[uid] = r.seq;
      var def = r.texto ? { texto: r.texto } : _reacaoPorId(r.id);
      if (!def) return;
      _baloes[uid] = { texto: def.texto, expiraEm: agora + MS_BALAO };
      mudou = true;
    });
    if (mudou) _agendarLimpezaBaloes();
  }

  function _agendarLimpezaBaloes() {
    clearTimeout(_timerBalao);
    _timerBalao = setTimeout(function () {
      var agora = Date.now(), limpou = false;
      Object.keys(_baloes).forEach(function (uid) {
        if (_baloes[uid].expiraEm <= agora) { delete _baloes[uid]; limpou = true; }
      });
      if (Object.keys(_baloes).length) _agendarLimpezaBaloes();
      if (limpou) _render();
    }, MS_BALAO + 60);
  }

  function _balaoEl(uid) {
    var b = _baloes[uid];
    if (!b || b.expiraEm <= Date.now()) return null;
    return _elx('div', 'balao', { texto: b.texto });
  }

  /* ---------- render ---------- */

  function _render() {
    if (!_root || !_sala) return;
    while (_root.firstChild) _root.removeChild(_root.firstChild);
    if (!_g) { _root.appendChild(_elx('div', 'carregando', { texto: 'Embaralhando…' })); return; }

    var jogadores = _jogadoresEfetivos();
    var ordem = _ordemAssentos(jogadores);
    var travado = !!(_g.vencedorPartida || (_g.escolhaCor && _g.escolhaCor.uid !== _uid));
    var souVez = _g.vez === _uid && !travado && !_g.escolhaCor;
    var minhaMao = (_g.maos && _g.maos[_uid]) || [];

    var mesa = _elx('div', 'mesa');
    if (_g.corAtual) mesa.classList.add(_cls('mesa-cor-' + _g.corAtual));

    // ---- barra de status: sentido, cor da vez, rodada ----
    var topo = _elx('div', 'topo');
    var sentidoEl = _elx('div', 'sentido', { texto: (_g.sentido === -1 ? '↺' : '↻') });
    sentidoEl.setAttribute('aria-label', _g.sentido === -1 ? 'Sentido anti-horário' : 'Sentido horário');
    topo.appendChild(sentidoEl);
    var corAtualEl = _elx('div', 'cor-atual');
    if (_g.corAtual) {
      corAtualEl.appendChild(_elx('span', 'bolinha bolinha-' + _g.corAtual));
      corAtualEl.appendChild(_elx('span', 'cor-atual-nome', { texto: NOME_COR[_g.corAtual] }));
    } else {
      corAtualEl.appendChild(_elx('span', 'cor-atual-nome', { texto: 'Escolhendo cor…' }));
    }
    topo.appendChild(corAtualEl);
    topo.appendChild(_elx('div', 'rodada', { texto: 'rodada ' + ((_g.rodadaAtual || 0) + 1) }));
    mesa.appendChild(topo);

    // ---- oponentes: começam por quem joga depois de mim, na ordem da roda ----
    var meuIdx = Math.max(0, ordem.indexOf(_uid));
    var outros = [];
    for (var k = 1; k < ordem.length; k++) outros.push(ordem[(meuIdx + k) % ordem.length]);
    var faixa = _elx('div', 'oponentes' + (outros.length > 3 ? ' oponentes-compacto' : ''));
    outros.forEach(function (uid) {
      var qtd = ((_g.maos && _g.maos[uid]) || []).length;
      var chip = _elx('div', 'op');
      if (_g.vez === uid && !travado) chip.classList.add(_cls('op-vez'));
      if (qtd === 1) chip.classList.add(_cls('op-uno'));
      var balao = _balaoEl(uid);
      if (balao) chip.appendChild(balao);
      var av = _elx('div', 'op-avatar', { texto: _iniciais(jogadores[uid].nome) });
      chip.appendChild(av);
      chip.appendChild(_elx('span', 'op-nome', { texto: jogadores[uid].nome }));
      var linhaCartas = _elx('div', 'op-cartas');
      var versos = Math.min(qtd, 5);
      for (var i = 0; i < versos; i++) linhaCartas.appendChild(_cartaEl(null, { verso: true, pequena: true }));
      linhaCartas.appendChild(_elx('span', 'op-qtd', { texto: '×' + qtd }));
      chip.appendChild(linhaCartas);
      if (qtd === 1) chip.appendChild(_elx('span', 'op-badge-uno', { texto: 'UNO' }));
      faixa.appendChild(chip);
    });
    mesa.appendChild(faixa);

    // ---- centro: monte + descarte + aviso de stack ----
    var centro = _elx('div', 'centro');

    var monteWrap = _elx('div', 'monte-wrap');
    var monte = _cartaEl(null, { verso: true });
    monte.classList.add(_cls('monte'));
    if (souVez) {
      monte.classList.add(_cls('monte-ativo'));
      monte.addEventListener('click', function () { _empurrarAcao('comprar', {}); });
    }
    monteWrap.appendChild(monte);
    monteWrap.appendChild(_elx('span', 'monte-qtd', { texto: (_g.monteQtd || 0) + ' no monte' }));
    centro.appendChild(monteWrap);

    var descarteWrap = _elx('div', 'descarte-wrap');
    var cartaTopo = _topo(_g);
    if (cartaTopo) {
      descarteWrap.appendChild(_cartaEl(cartaTopo, {
        corEscolhida: _ehCoringa(cartaTopo) && _g.corAtual ? _g.corAtual : null
      }));
    }
    centro.appendChild(descarteWrap);

    if (_g.stack > 0) {
      centro.appendChild(_elx('div', 'stack-aviso', { texto: '+' + _g.stack + ' pra comprar!' }));
    }
    mesa.appendChild(centro);

    // ---- base: ações + minha mão + info do turno ----
    mesa.appendChild(_criarBase(souVez, minhaMao, travado));

    // ---- overlays ----
    if (_g.escolhaCor && _g.escolhaCor.uid === _uid) mesa.appendChild(_criarOverlayCor());
    else if (_g.vencedorPartida) mesa.appendChild(_criarOverlayFim(jogadores, ordem));

    // ---- reações ----
    mesa.appendChild(_criarBotaoReacoes());
    if (_painelReacoes) mesa.appendChild(_criarPainelReacoes());

    _root.appendChild(mesa);
  }

  function _criarBase(souVez, minhaMao, travado) {
    var base = _elx('div', 'base');

    // Linha de ações: PEGAR! (alguém esqueceu o UNO), UNO! (eu com 1 ou 2
    // cartas) e Passar (só depois de comprar e não querer jogar).
    var acoes = _elx('div', 'acoes');
    if (_g.pegavel && _g.pegavel.uid !== _uid && !_g.vencedorPartida) {
      var btnPegar = _elx('button', 'btn-pegar', { type: 'button', texto: 'PEGAR ' + _nomeDoUid(_g.pegavel.uid) + '!' });
      btnPegar.addEventListener('click', function () { _empurrarAcao('pegar', {}); });
      acoes.appendChild(btnPegar);
    }
    if (!_g.vencedorPartida && minhaMao.length >= 1 && minhaMao.length <= 2 && !_g.unoDeclarado[_uid]) {
      var btnUno = _elx('button', 'btn-uno', { type: 'button', texto: 'UNO!' });
      btnUno.addEventListener('click', function () { _empurrarAcao('uno', {}); });
      acoes.appendChild(btnUno);
    }
    if (_g.compradaJogavel && _g.compradaJogavel.uid === _uid) {
      var btnPassar = _elx('button', 'btn-passar', { type: 'button', texto: 'Passar a vez' });
      btnPassar.addEventListener('click', function () { _empurrarAcao('passar', {}); });
      acoes.appendChild(btnPassar);
    }
    var meuBalao = _balaoEl(_uid);
    if (meuBalao) acoes.appendChild(meuBalao);
    base.appendChild(acoes);

    // Minha mão. Um toque = joga. Cartas sem jogada válida ficam apagadas
    // (e não respondem ao toque) pra não ter tentativa e erro no celular.
    var soAComprada = !!(_g.compradaJogavel && _g.compradaJogavel.uid === _uid);
    var mao = _elx('div', 'mao' + (souVez ? ' mao-ativa' : ''));
    if (minhaMao.length > 8) mao.classList.add(_cls('mao-cheia'));
    minhaMao.forEach(function (cod) {
      var jogavel = souVez && _podeJogar(cod, _g) && (!soAComprada || cod === _g.compradaJogavel.carta);
      var el = _cartaEl(cod);
      if (jogavel) {
        el.classList.add(_cls('carta-jogavel'));
        el.addEventListener('click', function () { _empurrarAcao('jogarCarta', { carta: cod }); });
      } else if (souVez) {
        el.classList.add(_cls('carta-apagada'));
      }
      mao.appendChild(el);
    });
    base.appendChild(mao);

    base.appendChild(_elx('p', 'turno-info', { texto: _textoDoTurno(souVez, minhaMao, travado) }));
    return base;
  }

  /* A frase da vez é sorteada UMA vez por turno, não a cada render — senão
     ela trocaria sozinha a cada atualização de estado. */
  function _textoDoTurno(souVez, minhaMao, travado) {
    if (_g.vencedorPartida) return '';
    if (_g.escolhaCor) {
      return _g.escolhaCor.uid === _uid ? 'Escolha a cor' : _nomeDoUid(_g.escolhaCor.uid) + ' está escolhendo a cor…';
    }
    if (souVez && _g.stack > 0) return 'Responda com +2/+4 ou compre ' + _g.stack;
    if (souVez && _g.compradaJogavel) return 'Jogue a carta comprada ou passe';
    if (souVez && !_temJogada(minhaMao, _g)) return 'Sem jogada — toque no monte pra comprar';
    var chave = (_g.rodadaAtual || 0) + '|' + (_g.eventoSeq || 0) + '|' + _g.vez + '|' + (souVez ? 'eu' : 'ele');
    if (_fraseVez.chave !== chave) {
      _fraseVez = { chave: chave, texto: souVez ? _frase('minhaVez') : _frase('vezDele') };
    }
    return souVez ? _fraseVez.texto : _fraseVez.texto + ' ' + _nomeDoUid(_g.vez);
  }

  /* ---------- overlays ---------- */

  function _criarOverlayCor() {
    var ov = _elx('div', 'overlay');
    var caixa = _elx('div', 'overlay-caixa');
    caixa.appendChild(_elx('h3', 'overlay-titulo', { texto: 'Escolha a cor' }));
    var grade = _elx('div', 'grade-cores');
    CORES.forEach(function (c) {
      var b = _elx('button', 'botao-cor botao-cor-' + c, { type: 'button', texto: NOME_COR[c] });
      b.addEventListener('click', function () { _empurrarAcao('escolherCor', { cor: c }); });
      grade.appendChild(b);
    });
    caixa.appendChild(grade);
    ov.appendChild(caixa);
    return ov;
  }

  function _criarOverlayFim(jogadores, ordem) {
    var ov = _elx('div', 'overlay');
    var caixa = _elx('div', 'overlay-caixa');
    var venc = _g.vencedorPartida;
    caixa.appendChild(_elx('h3', 'overlay-titulo-grande', {
      texto: (venc === _uid ? '🏆 ' : '') + (_g.fraseFim || 'Bateu!')
    }));
    caixa.appendChild(_elx('p', 'overlay-texto', {
      texto: venc === _uid ? 'Você ficou sem cartas!' : _nomeDoUid(venc) + ' ficou sem cartas.'
    }));

    var tabela = _elx('div', 'placar-lista');
    ordem.forEach(function (uid) {
      var linha = _elx('div', 'placar-linha' + (uid === venc ? ' placar-linha-venc' : ''));
      linha.appendChild(_elx('span', 'placar-nome', { texto: jogadores[uid].nome + (uid === _uid ? ' (você)' : '') }));
      linha.appendChild(_elx('span', 'placar-pontos', { texto: String((_g.placar && _g.placar[uid]) || 0) }));
      tabela.appendChild(linha);
    });
    caixa.appendChild(_elx('p', 'overlay-legenda', { texto: 'Rodadas ganhas' }));
    caixa.appendChild(tabela);

    var acoes = _elx('div', 'overlay-acoes');
    if (_souAnfitriao) {
      // Só o anfitrião decide — são os campos que a regra do RTDB deixa ele
      // escrever (ver database.rules.json). Os demais acompanham.
      var btnNova = _elx('button', 'btn-principal', { type: 'button', texto: 'Nova rodada' });
      btnNova.addEventListener('click', function () { _empurrarAcao('revanche', {}); });
      var btnLobby = _elx('button', 'btn-secundario', { type: 'button', texto: 'Voltar ao lobby' });
      btnLobby.addEventListener('click', function () { _ctx.voltarAoLobby(); });
      acoes.appendChild(btnNova); acoes.appendChild(btnLobby);
    } else {
      acoes.appendChild(_elx('p', 'overlay-texto', { texto: 'Aguardando o anfitrião começar outra rodada…' }));
    }
    caixa.appendChild(acoes);
    ov.appendChild(caixa);
    return ov;
  }

  /* ---------- reações ---------- */

  function _criarBotaoReacoes() {
    var btn = _elx('button', 'btn-reacoes' + (_painelReacoes ? ' btn-reacoes-aberto' : ''), {
      type: 'button', texto: '💬', 'aria-label': 'Reações'
    });
    btn.addEventListener('click', function () { _painelReacoes = !_painelReacoes; _render(); });
    return btn;
  }

  function _criarPainelReacoes() {
    var painel = _elx('div', 'painel-reacoes');
    REACOES.forEach(function (r) {
      var b = _elx('button', 'chip-reacao', { type: 'button', texto: r.texto });
      b.addEventListener('click', function () {
        _empurrarAcao('reacao', { id: r.id });
        _painelReacoes = false;
        _render();
      });
      painel.appendChild(b);
    });
    return painel;
  }

  /* ═══════════════ 8. REGISTRO NO HUB DE BARALHO ═══════════════ */

  if (window.AngatubaBaralho) {
    window.AngatubaBaralho.registrarModo('uno', {
      nome: 'Uno', min: 1, max: 8, opcoesJogadores: [1, 2, 3, 4, 5, 6, 7, 8],
      iniciar: iniciar, parar: parar
    });
  }

  // Exposto só por consistência com o padrão dos outros módulos
  // (window.<Nome>Game) e pra depuração no console — o hub não chama
  // isto direto, quem chama é baralho.js via registrarModo.
  window.UnoGame = {
    _debug: {
      regras: {
        criarBaralho: _criarBaralho,
        podeJogar: _podeJogar,
        cor: _cor,
        valor: _valor,
        ehCoringa: _ehCoringa
      }
    }
  };
})();
