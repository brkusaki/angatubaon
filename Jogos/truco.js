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

   ARMADILHA DO RTDB: ARRAY VAZIO NÃO EXISTE
   O Firebase não guarda lista nem objeto vazio — ele apaga a chave. Um
   "cartasNaMesa: []" salvo pelo anfitrião NÃO volta como [] no eco do
   'value': volta como undefined. Por isso duas coisas:
     1. o anfitrião NUNCA adota o eco (a cópia local _g é a boa — ele já
        mexeu nela antes de salvar); só quem não hospeda lê do "game";
     2. todo estado que vem do RTDB passa por _normalizarGame(), que
        recria as listas que sumiram.
   Sem isso, o PRIMEIRO render de qualquer partida estourava em
   "cartasNaMesa.forEach" e a mesa ficava em branco — em todos os modos.

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

   MÃO DE 11 E MÃO DE FERRO
   Quando um time chega a EXATAMENTE 11 pontos e o outro tem menos:
   antes de qualquer jogada, esse time vê as 3 cartas dele e escolhe
   (ação 'responderOnze'):
     - "ir"    -> a mão é jogada valendo 3 (e não 1);
     - "correr"-> o adversário leva 1 ponto e a mão nem é jogada.
   O outro time não vê as cartas nem a deliberação, só o resultado. Em
   4 jogadores, qualquer um da dupla pode decidir pelos dois
   (simplificação assumida). Com 11 a 11 é MÃO DE FERRO: ninguém olha e
   corre, a mão vale 3 e quem ganhar fecha a partida. Nas duas, o truco
   fica BLOQUEADO (mão de 11 não se truca) — ver _meuTeamPode. Campos no
   estado: game.decisaoOnze = { time } enquanto a decisão está pendente,
   e game.maoEspecial = 'onze' | 'ferro' depois de resolvida.

   REAÇÕES (balões estilo 8 Ball Pool)
   Não é chat: o cliente manda só o ID de uma reação da lista fixa
   REACOES (ação 'reacao'), e o anfitrião valida id + autor + cooldown
   antes de gravar em game.reacoes[uid] = { id, seq }. O "seq" é um
   contador — é ele que diz ao cliente que a reação é NOVA; comparar
   timestamp entre aparelhos com relógios diferentes daria balão
   fantasma ou balão nenhum. O tempo que o balão fica no ar é decidido
   por timer LOCAL de cada cliente (MS_BALAO). O mesmo canal carrega os
   balões que o próprio jogo solta ("Cai dentro!" ao aceitar um truco),
   via _balaoDoSistema, que manda { texto, seq } em vez de { id }.

   MODO SOLO (1 jogador vs. Coruja) — seção 3.5 abaixo
   Sala com maxJogadores=1 na sala/lobby (ver Jogos/baralho.js) tem só
   UM jogador de verdade no RTDB. Pra mesa funcionar (dupla de
   times A/B) o anfitrião — que aqui é sempre o próprio jogador
   solo — preenche o assento 1 com um bot LOCAL ("Coruja"): o bot
   NUNCA é escrito em salasBaralho/{codigo}/jogadores (não é um
   jogador real pro RTDB/regras de segurança), ele só existe dentro
   da cópia local do estado do anfitrião e é injetado via
   _jogadoresEfetivos() sempre que o resto do código precisa "ver"
   todos os assentos da mesa. O bot processa a própria jogada
   chamando _processarAcao() diretamente (mesma função que trata as
   ações vindas da fila "acoes" de um jogador humano) — do ponto de
   vista das regras do jogo, é só mais um uid.

   PENDÊNCIAS CONHECIDAS
   1. Na mão de 11 de uma DUPLA (4 jogadores), quem decide é o primeiro
      da dupla que responder, e ele enxerga só as próprias 3 cartas —
      na mesa real os dois veem as seis antes de decidir juntos.
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
   5. Bot do modo solo (v1) é simples de propósito: na vez dele joga a
      carta mais fraca que mata a maior carta da mesa (ou a mais fraca
      da mão, se nenhuma mata ou se ele abre a vaza); nunca pede
      truco sozinho, só responde a pedido do humano (aceita se seu
      time já está ganhando a mão em vazas, senão corre em pedidos
      altos — 9 ou 12); nunca joga carta escondida. Sem blefe, sem
      contagem de cartas, sem covardia/agressividade configurável —
      dá pra evoluir depois sem mudar a integração (é só trocar
      _escolherCartaBot/_botResponderAumento).
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

  /* Reações da mesa (estilo 8 Ball Pool): lista FIXA, o cliente manda só o
     id e quem desenha o balão é o texto daqui — ninguém digita nada, então
     não há o que moderar. Pra acrescentar uma reação basta uma linha nova:
     o id é o que trafega no RTDB, o texto é só apresentação. */
  var REACOES = [
    { id: 'medo',      texto: 'Tá com medo?' },
    { id: 'blefe',     texto: 'Tá blefando!' },
    { id: 'chora',     texto: 'Chora!' },
    { id: 'vamos',     texto: 'Vamos!' },
    { id: 'sorte',     texto: 'Sorte de principiante…' },
    { id: 'boa',       texto: 'Boa!' },
    { id: 'pensando',  texto: '🤔' },
    { id: 'silencio',  texto: '🤫' },
    { id: 'tedio',     texto: '🥱' },
    { id: 'risada',    texto: '😂' },
    { id: 'estiloso',  texto: '😎' },
    { id: 'fogo',      texto: '🔥' },
    { id: 'palmas',    texto: '👏' },
    { id: 'caveira',   texto: '💀' }
  ];
  /* Linguagem de mesa. Cada situação tem 2-4 variações sorteadas — o que
     tira o ar de robô sem precisar de texto livre. ATENÇÃO: frase que os
     DOIS lados precisam ver igual (pedido de truco, fim de mão, fim de
     partida) é sorteada pelo ANFITRIÃO e gravada no "game"; sorteio local
     faria cada aparelho mostrar uma coisa diferente. As frases locais
     (de quem é a vez) podem sortear no cliente. */
  var FRASES = {
    pedir3:     ['TRUCO!', 'Truco, pilantra!', 'Truco na mesa!'],
    pedir6:     ['SEIS!', 'Seis, ladrão!', 'Seis pra cima!'],
    pedir9:     ['NOVE!', 'Nove na conta!', 'Quero nove!'],
    pedir12:    ['DOZE!', 'Doze ou corre!', 'É doze!'],
    aceitar:    ['Aceito!', 'Cai dentro!', 'Manda ver!', 'Bora!'],
    correr:     ['Corre!', 'Tô fora!', 'Não dessa vez.', 'Guarda isso'],
    fimMao:     ['Fechou a mão!', 'Essa é nossa!', 'Levou!'],
    empate:     ['Empatou!', 'Fica pra próxima'],
    fimPartida: ['Ganhou a partida!', 'É campeão!', 'Acabou!'],
    minhaVez:   ['Sua vez', 'Joga aí', 'Manda a carta'],
    vezDele:    ['Vez de', 'Esperando']
  };
  function _frase(chave) {
    var lista = FRASES[chave] || [''];
    return lista[Math.floor(Math.random() * lista.length)];
  }

  function _reacaoPorId(id) {
    for (var i = 0; i < REACOES.length; i++) if (REACOES[i].id === id) return REACOES[i];
    return null;
  }
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
  var _maxJogadores = 2;    // capacidade REAL da sala (salasBaralho/.../maxJogadores) — só usado em _checarJogadoresAusentes
  var _assentos = 2;        // total de assentos da MESA (dealing/times/posição) — 2 mesmo no solo (eu + bot)
  var _solo = false;        // maxJogadores da sala == 1 -> assento 1 é o bot "Coruja" (ver seção 3.5)
  var _off = [];            // { ref, evento, cb } — listeners próprios (acoes)
  var _g = null;             // cópia local do "game" (autoritativa só se _souAnfitriao)
  var _sala = null;          // último snapshot completo da sala
  var _timerProximaMao = null;
  var _timerBot = null;
  var _timerVaza = null;
  var _modoEscondida = false; // toggle persistente: próximo toque joga a carta virada
  var _painelReacoes = false; // painel de reações aberto?
  var _baloes = {};           // uid -> { id, expiraEm } — balões no ar AGORA (só local)
  var _reacoesVistas = {};    // uid -> última seq já exibida (evita repetir balão a cada render)
  var _cooldownReacao = {};   // uid -> timestamp da última reação aceita (só no anfitrião)
  var _timerBalao = null;
  var _fraseVez = { chave: '', texto: '' }; // sorteia a frase da vez UMA vez por turno
  var _root = null;          // container da mesa (ctx.container)
  var _flashTimer = null;

  var MS_VAZA = 1200;   // quanto tempo a vaza fechada fica à vista antes de recolher
  var MS_BOT = 1100;    // pausa do bot antes de jogar/responder (dá tempo de ler a mesa)
  var MS_BALAO = 2400;  // quanto tempo o balão de reação fica no ar
  var MS_COOLDOWN_REACAO = 3500; // anti-spam por jogador
  var PONTOS_MAO_ONZE = 3; // mão de 11 (e mão de ferro) vale 3
  var _BOT_UID = '_bot_coruja';
  var _NOME_BOT = 'Coruja 🦉';

  function _time() { return _sala && _uid ? _timeDoUid(_uid, _sala.jogadores || {}) : null; }
  function _meuTeamPode(gameAtual) {
    // pode pedir aumento se ninguém pediu ainda e não foi o próprio time
    // que fez a última aposta aceita (não dá pra "re-truco" sozinho).
    // Mão de 11 e mão de ferro já nascem valendo 3 e NÃO se trucam.
    if (gameAtual.maoEspecial || gameAtual.decisaoOnze) return false;
    return !gameAtual.pedidoTruco && gameAtual.apostaAtual < 12 && gameAtual.ultimoTimeAumentou !== _time();
  }

  // O RTDB NÃO guarda array vazio nem objeto vazio: um "cartasNaMesa: []"
  // salvo pelo anfitrião simplesmente não existe quando o estado volta do
  // Firebase — e volta como undefined, não como []. Sem isto, o primeiro
  // render de qualquer partida estourava em "cartasNaMesa.forEach" e a mesa
  // ficava em branco. Vale pra todo campo de lista do "game".
  function _normalizarGame(g) {
    if (!g) return null;
    g.cartasNaMesa = g.cartasNaMesa || [];
    g.vazasResultados = g.vazasResultados || [];
    g.descarte = g.descarte || [];
    g.historico = g.historico || [];
    g.maos = g.maos || {};
    g.pontuacao = g.pontuacao || { A: 0, B: 0 };
    g.reacoes = g.reacoes || {};
    return g;
  }

  // "jogadores" completo pra fins de jogo: os reais da sala (RTDB) + o bot
  // do assento 1, se for modo solo. É o que _prepararNovaMao/_avaliarVaza/
  // _render etc. devem usar sempre que precisam "ver a mesa inteira" — o
  // bot nunca existe em _sala.jogadores (ver seção 3.5 no cabeçalho).
  function _jogadoresEfetivos() {
    var jogadores = {};
    var base = (_sala && _sala.jogadores) || {};
    Object.keys(base).forEach(function (uid) { jogadores[uid] = base[uid]; });
    if (_solo) jogadores[_BOT_UID] = { nome: _NOME_BOT, seat: 1, pronto: true, bot: true };
    return jogadores;
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
    for (var s = 0; s < _assentos; s++) ordemAssentos.push(_uidDoAssento(jogadores, s));

    // 3 cartas por jogador, na ordem dos assentos a partir de quem é "mão".
    var seatMao = base.maoAtual % _assentos;
    var ordemDeal = [];
    for (var k = 0; k < _assentos; k++) ordemDeal.push(ordemAssentos[(seatMao + k) % _assentos]);
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

    // ---- mão de 11 / mão de ferro (ver cabeçalho) ----
    // Só entra em jogo com pontuação EXATAMENTE 11: acima disso a partida
    // já teria acabado (12 pontos), então não há caso de "12 ou mais aqui".
    var pts = g.pontuacao || { A: 0, B: 0 };
    var onzeA = pts.A === 11, onzeB = pts.B === 11;
    g.maoEspecial = null;
    g.decisaoOnze = null;
    if (onzeA && onzeB) {
      // Mão de ferro: os dois estão com 11, ninguém olha e corre, vale 3 e
      // quem ganhar fecha a partida.
      g.maoEspecial = 'ferro';
      g.apostaAtual = PONTOS_MAO_ONZE;
    } else if (onzeA || onzeB) {
      // O time com 11 vê as próprias cartas e decide ir ou correr antes de
      // qualquer jogada (ver _acaoResponderOnze).
      g.decisaoOnze = { time: onzeA ? 'A' : 'B' };
      g.apostaAtual = PONTOS_MAO_ONZE; // valor SE for jogada; correr paga 1 ao adversário
    }
    return g;
  }

  function _iniciarComoAnfitriao() {
    var jogadores = _jogadoresEfetivos();
    if (_sala.game) {
      _g = _normalizarGame(_sala.game);
      _ouvirAcoes();
      // Retomou no meio de uma vaza em exibição: reagenda o recolhimento,
      // senão as cartas ficariam na mesa pra sempre e a mão travava.
      if (_g.vazaEmExibicao) _agendarFecharVaza();
      _talvezAgirComoBot();
      return;
    }
    _g = _prepararNovaMao(_novoJogoInicial(), jogadores);
    _salvarGame();
    _ouvirAcoes();
  }

  function _salvarGame() {
    if (!_souAnfitriao || !_ctx.salaRef) return;
    _ctx.salaRef.child('game').set(_g).catch(function () {});
    // O anfitrião não adota o eco do RTDB (ver armadilha no cabeçalho),
    // então é aqui que ele percebe as próprias reações/balões novos.
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

  function _proximoAssentoVivo(seatAtual) { return (seatAtual + 1) % _assentos; }

  function _processarAcao(acao) {
    if (!_g || !_sala) return;
    var jogadores = _jogadoresEfetivos();
    // "revanche" só é enviada DEPOIS que vencedorPartida já está setado
    // (é a própria condição que mostra o botão) — por isso trata ela ANTES
    // do "return" de partida encerrada, senão nunca seria processada.
    if (acao.tipo === 'revanche') { _acaoRevanche(acao, jogadores); return; }
    // Reação é só enfeite e vale até depois da partida acabar (a galera
    // comemora/zoa no fim), então também vem antes do return abaixo.
    if (acao.tipo === 'reacao') { _acaoReacao(acao, jogadores); return; }
    if (_g.vencedorPartida) return; // partida já acabou, ignora qualquer outra ação atrasada

    if (acao.tipo === 'responderOnze') { _acaoResponderOnze(acao, jogadores); return; }
    if (_g.decisaoOnze) return; // mão de 11 pendente: ninguém joga nem pede nada

    if (acao.tipo === 'jogarCarta') _acaoJogarCarta(acao, jogadores);
    else if (acao.tipo === 'pedirAumento') _acaoPedirAumento(acao, jogadores);
    else if (acao.tipo === 'responderAumento') _acaoResponderAumento(acao, jogadores);
  }

  /* Reação: o cliente manda só o id; o anfitrião confere se o id existe na
     lista fixa, se o uid é mesmo alguém da mesa e aplica o cooldown. O
     "seq" é um contador simples — é ele que diz aos clientes que a reação
     é NOVA (comparar timestamp entre aparelhos com relógios diferentes
     daria balão fantasma ou balão nenhum). */
  function _acaoReacao(acao, jogadores) {
    var g = _g;
    var id = acao.payload && acao.payload.id;
    if (!_reacaoPorId(id)) return;          // id fora da lista: ignora
    if (!jogadores[acao.uid]) return;       // não está na mesa
    var agora = Date.now();
    if (_cooldownReacao[acao.uid] && (agora - _cooldownReacao[acao.uid]) < MS_COOLDOWN_REACAO) return;
    _cooldownReacao[acao.uid] = agora;

    g.reacaoSeq = (g.reacaoSeq || 0) + 1;
    g.reacoes = g.reacoes || {};
    g.reacoes[acao.uid] = { id: id, seq: g.reacaoSeq };
    _salvarGame();
  }

  /* Balão que o JOGO solta (não veio de toque em reação): "Cai dentro!"
     quando alguém aceita o truco, "Tô fora!" quando corre. Usa o mesmo
     canal das reações — o cliente desenha { texto, seq } igualzinho, então
     não precisa de um segundo mecanismo só pra isso. */
  function _balaoDoSistema(uid, texto) {
    var g = _g;
    if (!g || !uid || !texto) return;
    g.reacaoSeq = (g.reacaoSeq || 0) + 1;
    g.reacoes = g.reacoes || {};
    g.reacoes[uid] = { texto: texto, seq: g.reacaoSeq };
  }

  /* Mão de 11: só o time que está com 11 responde. "ir" transforma a mão
     numa mão normal valendo 3 (sem direito a truco); "correr" entrega 1
     ponto ao adversário e a mão nem chega a ser jogada. */
  function _acaoResponderOnze(acao, jogadores) {
    var g = _g;
    if (!g.decisaoOnze) return;
    var time = _timeDoUid(acao.uid, jogadores);
    if (!time || time !== g.decisaoOnze.time) return; // só o time da mão de 11 decide
    var resposta = acao.payload && acao.payload.resposta;

    if (resposta === 'ir') {
      g.decisaoOnze = null;
      g.maoEspecial = 'onze';
      g.apostaAtual = PONTOS_MAO_ONZE;
      _salvarGame();
    } else if (resposta === 'correr') {
      g.decisaoOnze = null;
      g.maoEspecial = null;
      _fecharMao(_timeAdversario(time), 1, 'correuOnze');
    }
  }

  function _acaoJogarCarta(acao, jogadores) {
    var g = _g;
    if (g.vencedorMao) return; // mão em exibição de resultado, aguardando próxima
    if (g.vazaEmExibicao) return; // vaza fechada à vista: ninguém joga até recolher
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

    // Vaza completa: NÃO recolhe as cartas agora. Sem esta pausa, a carta
    // que fecha a vaza era jogada e some no mesmo instante — do ponto de
    // vista de quem jogou, ela "nunca apareceu" (bug reportado). Fica em
    // exibição por MS_VAZA e só então _fecharVaza() resolve de verdade.
    var resultado = _avaliarVaza(g.cartasNaMesa, g.manilha, jogadores);
    // A frase do empate vai no estado (e não sorteada no render): render
    // roda várias vezes durante a exibição e a frase ficaria trocando.
    g.vazaEmExibicao = {
      time: resultado.time || null,
      uid: resultado.uid || null,
      frase: resultado.time ? null : _frase('empate')
    };
    _salvarGame();
    _agendarFecharVaza();
  }

  function _agendarFecharVaza() {
    if (!_souAnfitriao) return;
    clearTimeout(_timerVaza);
    _timerVaza = setTimeout(_fecharVaza, MS_VAZA);
  }

  function _fecharVaza() {
    _timerVaza = null;
    var g = _g;
    if (!g || !g.vazaEmExibicao) return;
    var resultado = g.vazaEmExibicao;
    g.vazaEmExibicao = null;
    g.vazasResultados.push(resultado.time);
    g.descarte = g.descarte.concat((g.cartasNaMesa || []).map(function (e) { return e.carta; }));
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
    g.fraseFimMao = _frase('fimMao');
    g.pontuacao[timeVencedor] = (g.pontuacao[timeVencedor] || 0) + pontos;
    g.historico = (g.historico || []).concat([{
      maoAtual: g.maoAtual, vencedor: timeVencedor, pontos: pontos, motivo: motivo
    }]);
    if (g.historico.length > 30) g.historico = g.historico.slice(-30); // teto de segurança no RTDB

    if (g.pontuacao[timeVencedor] >= PONTOS_PARTIDA) {
      g.vencedorPartida = timeVencedor;
      g.fraseFimPartida = _frase('fimPartida');
      _salvarGame();
      return;
    }
    _talvezReagirComoBot(timeVencedor);
    _salvarGame();
    _cancelarAgendamentos();
    _timerProximaMao = setTimeout(function () {
      if (!_souAnfitriao || !_g || _g.vencedorPartida) return;
      var jogadores = _jogadoresEfetivos();
      var base = { pontuacao: _g.pontuacao, maoAtual: _g.maoAtual + 1, vencedorPartida: null, historico: _g.historico };
      _g = _prepararNovaMao(base, jogadores);
      _salvarGame();
    }, 2600);
  }

  function _acaoPedirAumento(acao, jogadores) {
    var g = _g;
    if (g.vencedorMao || g.vazaEmExibicao) return;
    var time = _timeDoUid(acao.uid, jogadores);
    if (!time || !_meuTeamPodeServidor(g, time)) return;
    var proximo = _proximoValorAposta(g.apostaAtual);
    if (!proximo) return;
    g.pedidoTruco = { de: acao.uid, time: time, valor: proximo, frase: _frase('pedir' + proximo) };
    _salvarGame();
  }
  function _meuTeamPodeServidor(g, time) {
    if (g.maoEspecial || g.decisaoOnze) return false; // mão de 11 / de ferro não se truca
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
      _balaoDoSistema(acao.uid, _frase('aceitar'));
      _salvarGame();
    } else if (resposta === 'correr') {
      var timeQueGanhou = g.pedidoTruco.time;
      var pontos = g.apostaAtual; // valor QUE JÁ VALIA antes deste pedido
      g.pedidoTruco = null;
      _balaoDoSistema(acao.uid, _frase('correr'));
      _fecharMao(timeQueGanhou, pontos, 'correu');
    } else if (resposta === 'aumentar') {
      var proximo = _proximoValorAposta(g.pedidoTruco.valor);
      if (!proximo) return;
      g.pedidoTruco = { de: acao.uid, time: time, valor: proximo, frase: _frase('pedir' + proximo) };
      _salvarGame();
    }
  }

  function _acaoRevanche(acao, jogadores) {
    if (!_g || !_g.vencedorPartida) return;
    var base = { pontuacao: { A: 0, B: 0 }, maoAtual: 0, vencedorPartida: null, historico: [] };
    _g = _prepararNovaMao(base, jogadores);
    _salvarGame();
  }

  /* ═══════════════ 3.5. MODO SOLO: BOT LOCAL "CORUJA" (só anfitrião) ═══
     Chamado a partir de _salvarGame() — todo lugar que muda _g e persiste
     já passa por ali, então é o único ponto que precisa "acordar" o bot.
     O bot só REAGE (joga carta na vez dele, ou responde a um pedido de
     aumento do time do humano); nunca pede truco por conta própria (ver
     pendência 5 no cabeçalho). Usa _processarAcao() com um uid sintético
     — pro resto das regras, o bot é só mais um jogador. */

  function _talvezAgirComoBot() {
    // vazaEmExibicao: o bot espera a vaza ser recolhida (_fecharVaza chama
    // _salvarGame, que passa por aqui de novo) — senão ele jogaria por cima
    // da carta que o humano acabou de ver entrar na mesa.
    if (!_solo || !_souAnfitriao || !_g || _g.vencedorPartida || _g.vencedorMao || _g.vazaEmExibicao) { clearTimeout(_timerBot); return; }
    var timeBot = _timeDoUid(_BOT_UID, _jogadoresEfetivos());
    clearTimeout(_timerBot);
    if (_g.decisaoOnze) {
      // Só age se a mão de 11 for DO bot; se for do humano, espera a
      // decisão dele (o overlay está aberto do lado de lá).
      if (_g.decisaoOnze.time === timeBot) _timerBot = setTimeout(_botDecidirOnze, MS_BOT + 600);
      return;
    }
    if (_g.pedidoTruco && _g.pedidoTruco.time !== timeBot) {
      _timerBot = setTimeout(_botResponderAumento, MS_BOT); // pedido é do time do humano — bot responde
    } else if (!_g.pedidoTruco && _g.vez === _BOT_UID) {
      _timerBot = setTimeout(_botJogarCarta, MS_BOT);
    }
  }

  function _cartaMaisFraca(lista) {
    var melhor = lista[0], melhorPoder = _poder(melhor, _g.manilha);
    lista.forEach(function (c) {
      var p = _poder(c, _g.manilha);
      if (p < melhorPoder) { melhor = c; melhorPoder = p; }
    });
    return melhor;
  }

  // Se existe carta na mão do bot que mata a maior carta visível da mesa,
  // joga a MAIS FRACA dessas (economiza as boas); senão joga a mais fraca
  // da mão inteira (também cobre o caso de o bot abrir a vaza — não há
  // "carta da mesa" pra matar, cai direto nesse fallback).
  function _escolherCartaBot(mao) {
    var visiveis = (_g.cartasNaMesa || []).filter(function (e) { return !e.escondida; });
    if (!visiveis.length) return _cartaMaisFraca(mao);
    var maxPoderMesa = -1;
    visiveis.forEach(function (e) { var p = _poder(e.carta, _g.manilha); if (p > maxPoderMesa) maxPoderMesa = p; });
    var mata = mao.filter(function (c) { return _poder(c, _g.manilha) > maxPoderMesa; });
    return mata.length ? _cartaMaisFraca(mata) : _cartaMaisFraca(mao);
  }

  /* Mão de 11 do bot (v1, de propósito simples e previsível): ele olha as
     3 cartas e vai se tiver pelo menos UMA manilha, ou pelo menos DUAS
     cartas altas (Ás, 2 ou 3). Fora isso corre e entrega 1 ponto — que é
     o que um jogador cauteloso faria estando a um ponto da vitória. */
  function _botDecidirOnze() {
    if (!_solo || !_g || !_g.decisaoOnze) return;
    var mao = (_g.maos && _g.maos[_BOT_UID]) || [];
    var manilhas = 0, altas = 0;
    mao.forEach(function (c) {
      if (_ehManilha(c, _g.manilha)) manilhas++;
      else if (ORDEM_VALOR.indexOf(_valorCarta(c)) >= ORDEM_VALOR.indexOf('A')) altas++;
    });
    var vai = manilhas >= 1 || altas >= 2;
    _processarAcao({ uid: _BOT_UID, tipo: 'responderOnze', payload: { resposta: vai ? 'ir' : 'correr' } });
  }

  /* O bot comemora de vez em quando ao fechar uma mão — raro de propósito
     (1 em 4), senão vira poluição. Só no solo, e nunca depois que a
     partida acabou. */
  function _talvezReagirComoBot(timeVencedor) {
    if (!_solo || !_souAnfitriao || !_g) return;
    var timeBot = _timeDoUid(_BOT_UID, _jogadoresEfetivos());
    if (timeVencedor !== timeBot) return;
    if (Math.random() > 0.25) return;
    _balaoDoSistema(_BOT_UID, _frase(Math.random() < 0.5 ? 'fimMao' : 'aceitar'));
  }

  function _botJogarCarta() {
    if (!_solo || !_g || _g.vez !== _BOT_UID || _g.pedidoTruco || _g.vencedorMao || _g.vencedorPartida) return;
    var mao = (_g.maos && _g.maos[_BOT_UID]) || [];
    if (!mao.length) return;
    _processarAcao({ uid: _BOT_UID, tipo: 'jogarCarta', payload: { carta: _escolherCartaBot(mao), escondida: false } });
  }

  // Regra simples (v1): aceita se o time do bot já está ganhando a mão em
  // vazas fechadas; senão corre só em pedidos altos (9 ou 12) — pedidos
  // baixos (6) o bot aceita mesmo sem estar ganhando, pra não fugir logo
  // de cara. Ver pendência 5 no cabeçalho.
  function _botResponderAumento() {
    if (!_solo || !_g || !_g.pedidoTruco) return;
    var timeBot = _timeDoUid(_BOT_UID, _jogadoresEfetivos());
    if (!timeBot || _g.pedidoTruco.time === timeBot) return; // pedido não é do time adversário do bot
    var vazasBot = (_g.vazasResultados || []).filter(function (v) { return v === timeBot; }).length;
    var vazasHumano = (_g.vazasResultados || []).filter(function (v) { return v && v !== timeBot; }).length;
    var ganhando = vazasBot > vazasHumano;
    var pedidoAlto = _g.pedidoTruco.valor >= 9;
    var resposta = (!ganhando && pedidoAlto) ? 'correr' : 'aceitar';
    _processarAcao({ uid: _BOT_UID, tipo: 'responderAumento', payload: { resposta: resposta } });
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
    _assentos = _solo ? 2 : _maxJogadores; // mesa efetiva: eu + bot no solo
    _modoEscondida = false;
    _painelReacoes = false;
    _baloes = {}; _reacoesVistas = {}; _cooldownReacao = {};
    _fraseVez = { chave: '', texto: '' };

    if (_souAnfitriao) _iniciarComoAnfitriao();

    ctx.onSala(function (sala) {
      _sala = sala;
      // O anfitrião é dono do estado: a cópia local (_g) é sempre a boa e
      // já está atualizada antes mesmo de salvar. Adotar o eco do RTDB
      // (como era feito antes) só trazia de volta um estado mutilado pelo
      // Firebase — arrays vazios somem — e derrubava o render. Quem não
      // hospeda só tem o eco, então normaliza o que chegou.
      if (!_souAnfitriao) _g = _normalizarGame(sala.game) || _g;
      if (_g && !_g.timeDaMao && _g.vez) _g.timeDaMao = _timeDoUid(_g.vez, _jogadoresEfetivos());
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
    _modoEscondida = false; _root = null; _solo = false; _assentos = 2;
    _painelReacoes = false; _baloes = {}; _reacoesVistas = {}; _cooldownReacao = {};
    _fraseVez = { chave: '', texto: '' };
  }

  // NÃO mexe no _timerBalao: esta função roda no meio da partida (a cada
  // fim de mão) e mataria o balão que acabou de subir. Balão é enfeite de
  // ciclo próprio — só o parar() derruba.
  function _cancelarAgendamentos() {
    if (_timerVaza) { clearTimeout(_timerVaza); _timerVaza = null; }
    if (_timerProximaMao) { clearTimeout(_timerProximaMao); _timerProximaMao = null; }
    if (_timerBot) { clearTimeout(_timerBot); _timerBot = null; }
  }

  /* ═══════════════ 7. UI: MESA DO TRUCO (prefixo trc-) ═══════════════
     Layout, de cima pra baixo: placar -> vira/manilha -> oponente(s) ->
     centro (a vaza) -> base (Truco! | minha mão | Fechada). A base em três
     colunas é o desenho de mini truco de celular: o polegar alcança os
     dois botões sem tapar as cartas.

     ATENÇÃO: _elx já prefixa TODA classe com "trc-" (ver _cls). Passar a
     classe já prefixada gera "trc-trc-x", que não casa com nada no CSS e
     falha em silêncio — foi assim que o oponente foi parar no canto
     esquerdo e as cartas jogadas empilharam no mesmo ponto. Classe aqui
     vai SEMPRE sem prefixo. */

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
    var j = _jogadoresEfetivos()[uid];
    return j ? j.nome : '...';
  }

  function _nomesDoTime(time) {
    var jogadores = _jogadoresEfetivos();
    return Object.keys(jogadores).filter(function (uid) { return _timeDoUid(uid, jogadores) === time; })
      .map(function (uid) { return jogadores[uid].nome; }).join(' & ');
  }

  function _cartaEl(cod, opcoes) {
    opcoes = opcoes || {};
    var el = _elx('div', 'carta' + (opcoes.pequena ? ' carta-pequena' : ''));
    if (opcoes.virada) {
      el.classList.add(_cls('carta-verso'));
      el.appendChild(_elx('span', 'carta-verso-coruja', { texto: '🦉' }));
      return el;
    }
    var valor = _valorCarta(cod), naipe = _naipeCarta(cod);
    el.classList.add(_cls('carta-' + COR_NAIPE[naipe]));
    if (opcoes.manilha) el.classList.add(_cls('carta-manilha'));
    if (opcoes.vencedora) el.classList.add(_cls('carta-vencedora'));
    var topo = _elx('span', 'carta-valor', { texto: valor });
    var meio = _elx('span', 'carta-naipe-grande', { texto: SIMBOLO_NAIPE[naipe] });
    var baixo = _elx('span', 'carta-valor carta-valor-baixo', { texto: valor });
    el.appendChild(topo); el.appendChild(meio); el.appendChild(baixo);
    return el;
  }

  // Layout relativo: sul = eu, norte = à minha frente (parceiro se 4
  // jogadores, único adversário se 2), leste/oeste = os outros dois (4).
  function _posicaoRelativa(meuSeat, seatAlvo) {
    var diff = (seatAlvo - meuSeat + _assentos) % _assentos;
    if (_assentos === 2) return diff === 0 ? 'sul' : 'norte';
    return ['sul', 'leste', 'norte', 'oeste'][diff] || 'norte';
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
      if (_reacoesVistas[uid] === r.seq) return; // já mostrei esta
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
    if (!_g) { _root.appendChild(_elx('div', 'carregando', { texto: 'Preparando a mesa…' })); return; }

    var jogadores = _jogadoresEfetivos();
    var meuSeat = (jogadores[_uid] && jogadores[_uid].seat) || 0;
    var meuTime = _time();
    var travado = !!(_g.pedidoTruco || _g.vencedorMao || _g.vencedorPartida || _g.vazaEmExibicao || _g.decisaoOnze);
    var souVez = _g.vez === _uid && !travado;

    var mesa = _elx('div', 'mesa');

    // ---- placar: pontos dos dois lados + quanto vale a mão ----
    var placar = _elx('div', 'placar');
    placar.appendChild(_criarPlacarTime('A', jogadores, meuTime));
    var centro = _elx('div', 'placar-centro');
    centro.appendChild(_elx('span', 'placar-aposta', { texto: 'vale ' + _g.apostaAtual }));
    centro.appendChild(_elx('span', 'placar-mao', { texto: _rotuloDaMao() }));
    placar.appendChild(centro);
    placar.appendChild(_criarPlacarTime('B', jogadores, meuTime));
    mesa.appendChild(placar);

    // ---- vira / manilha ----
    var viraWrap = _elx('div', 'vira-wrap');
    var viraCol = _elx('div', 'vira-col');
    viraCol.appendChild(_elx('span', 'vira-label', { texto: 'vira' }));
    viraCol.appendChild(_cartaEl(_g.vira, { pequena: true }));
    viraWrap.appendChild(viraCol);
    var manilhaCol = _elx('div', 'manilha-col');
    manilhaCol.appendChild(_elx('span', 'vira-manilha', { texto: 'Manilha: ' + _g.manilha }));
    manilhaCol.appendChild(_elx('span', 'vira-ordem', { texto: '♦ < ♠ < ♥ < ♣' }));
    viraWrap.appendChild(manilhaCol);
    mesa.appendChild(viraWrap);

    // ---- oponente(s): nome + leque de versos + balão ----
    var faixaOutros = _elx('div', 'outros outros-' + _assentos);
    Object.keys(jogadores).forEach(function (uid) {
      if (uid === _uid) return;
      var pos = _posicaoRelativa(meuSeat, jogadores[uid].seat);
      var chip = _elx('div', 'jogador-chip pos-' + pos);
      var balao = _balaoEl(uid);
      if (balao) chip.appendChild(balao);
      chip.appendChild(_elx('span', 'jogador-nome', { texto: jogadores[uid].nome }));
      var qtdMao = (_g.maos && _g.maos[uid] && _g.maos[uid].length) || 0;
      var mini = _elx('div', 'mini-mao');
      for (var i = 0; i < qtdMao; i++) mini.appendChild(_cartaEl(null, { virada: true, pequena: true }));
      chip.appendChild(mini);
      if (_g.vez === uid && !travado) chip.classList.add(_cls('jogador-vez'));
      faixaOutros.appendChild(chip);
    });
    mesa.appendChild(faixaOutros);

    // ---- centro: as cartas da vaza ----
    var centroMesa = _elx('div', 'centro-mesa');
    var exib = _g.vazaEmExibicao;
    (_g.cartasNaMesa || []).forEach(function (e) {
      var pos = _posicaoRelativa(meuSeat, jogadores[e.uid] ? jogadores[e.uid].seat : meuSeat);
      var slot = _elx('div', 'slot-mesa pos-' + pos);
      // A carta escondida é revelada quando a vaza fecha (é a regra: ela
      // perde a disputa, mas todo mundo vê o que era no fim).
      slot.appendChild(_cartaEl(e.carta, {
        virada: e.escondida && e.uid !== _uid && !exib,
        manilha: _ehManilha(e.carta, _g.manilha),
        vencedora: !!(exib && exib.uid === e.uid)
      }));
      centroMesa.appendChild(slot);
    });
    if (exib && !exib.time) centroMesa.appendChild(_elx('div', 'aviso-vaza', { texto: exib.frase || 'Empatou!' }));
    mesa.appendChild(centroMesa);

    // ---- overlays ----
    // Ordem importa: vencedorPartida implica vencedorMao (fecharMao nunca
    // limpa o campo), então a checagem de partida vem ANTES da de mão —
    // senão o placar final nunca apareceria.
    if (_g.decisaoOnze) mesa.appendChild(_criarOverlayOnze(meuTime));
    else if (_g.pedidoTruco) mesa.appendChild(_criarOverlayPedido(meuTime));
    else if (_g.vencedorPartida) mesa.appendChild(_criarOverlayFimPartida());
    else if (_g.vencedorMao) mesa.appendChild(_criarOverlayFimMao());

    // ---- base: Truco! | minha mão | Fechada ----
    mesa.appendChild(_criarBase(souVez));

    // ---- reações (botão discreto + painel) ----
    mesa.appendChild(_criarBotaoReacoes());
    if (_painelReacoes) mesa.appendChild(_criarPainelReacoes());

    _root.appendChild(mesa);
  }

  // "Mão 3" normalmente; nas mãos especiais o rótulo já avisa o que é.
  function _rotuloDaMao() {
    if (_g.maoEspecial === 'ferro' || (_g.pontuacao.A === 11 && _g.pontuacao.B === 11)) return 'mão de ferro';
    if (_g.maoEspecial === 'onze' || _g.decisaoOnze) return 'mão de 11';
    return 'mão ' + (_g.maoAtual + 1);
  }

  function _criarPlacarTime(time, jogadores, meuTime) {
    var wrap = _elx('div', 'placar-time' + (time === meuTime ? ' placar-meu' : ''));
    wrap.appendChild(_elx('span', 'placar-numero', { texto: String((_g.pontuacao && _g.pontuacao[time]) || 0) }));
    wrap.appendChild(_elx('span', 'placar-nomes', { texto: _nomesDoTime(time) || ('Time ' + time) }));
    return wrap;
  }

  /* Base em 3 colunas. As laterais existem sempre (mesmo vazias) pra a mão
     não dançar horizontalmente quando um botão some. */
  function _criarBase(souVez) {
    var base = _elx('div', 'base');

    var esq = _elx('div', 'base-lado');
    if (_meuTeamPode(_g) && !_g.vencedorMao && !_g.vencedorPartida && !_g.vazaEmExibicao) {
      var proximo = _proximoValorAposta(_g.apostaAtual);
      var btn = _elx('button', 'btn-truco', { type: 'button', texto: _g.apostaAtual === 1 ? 'TRUCO!' : String(proximo) });
      btn.addEventListener('click', function () { _empurrarAcao('pedirAumento', {}); });
      esq.appendChild(btn);
    }
    base.appendChild(esq);

    var meio = _elx('div', 'base-meio');
    var minhaMao = (_g.maos && _g.maos[_uid]) || [];
    var mao = _elx('div', 'minha-mao' + (souVez ? ' minha-mao-ativa' : ''));
    // Um toque = joga. O "escondida" é o toggle da direita: confirmar carta
    // a carta com dois botões custava um toque a mais em TODA jogada só
    // pra atender o caso raro.
    minhaMao.forEach(function (cod) {
      var el = _cartaEl(cod, { manilha: _ehManilha(cod, _g.manilha) });
      if (souVez) {
        el.classList.add(_cls('carta-jogavel'));
        if (_modoEscondida) el.classList.add(_cls('carta-vai-escondida'));
        el.addEventListener('click', function () {
          var escondida = _modoEscondida;
          _modoEscondida = false; // volta pro normal depois de usar
          _empurrarAcao('jogarCarta', { carta: cod, escondida: escondida });
        });
      }
      mao.appendChild(el);
    });
    meio.appendChild(mao);
    var meuBalao = _balaoEl(_uid);
    if (meuBalao) meio.appendChild(meuBalao);
    meio.appendChild(_elx('p', 'turno-info', { texto: _textoDoTurno(souVez) }));
    base.appendChild(meio);

    var dir = _elx('div', 'base-lado');
    if (souVez) {
      var btnEsc = _elx('button', 'btn-escondida' + (_modoEscondida ? ' btn-escondida-ativo' : ''), {
        type: 'button', texto: 'Fechada'
      });
      btnEsc.addEventListener('click', function () { _modoEscondida = !_modoEscondida; _render(); });
      dir.appendChild(btnEsc);
    }
    base.appendChild(dir);
    return base;
  }

  /* A frase da vez é sorteada UMA vez por turno, não a cada render — senão
     ela trocaria sozinha a cada atualização de estado. */
  function _textoDoTurno(souVez) {
    if (_g.vencedorPartida || _g.vencedorMao || _g.pedidoTruco || _g.decisaoOnze || _g.vazaEmExibicao) return '';
    var chaveTurno = _g.maoAtual + '|' + _g.rodadaAtual + '|' + _g.vez + '|' + (souVez ? 'eu' : 'ele');
    if (_fraseVez.chave !== chaveTurno) {
      _fraseVez = { chave: chaveTurno, texto: souVez ? _frase('minhaVez') : _frase('vezDele') };
    }
    if (souVez && _modoEscondida) return 'Toque na carta — vai FECHADA';
    return souVez ? _fraseVez.texto : _fraseVez.texto + ' ' + _nomeDoUid(_g.vez);
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

  /* ---------- overlays ---------- */

  /* Mão de 11: só o time que está com 11 vê as cartas e decide. O outro
     time fica sabendo apenas que há uma decisão em curso — e depois, pelo
     resultado, se o adversário foi ou correu. */
  function _criarOverlayOnze(meuTime) {
    var ov = _elx('div', 'overlay');
    var caixa = _elx('div', 'overlay-caixa');
    var minhaDecisao = _g.decisaoOnze.time === meuTime;
    caixa.appendChild(_elx('h3', 'overlay-titulo', { texto: minhaDecisao ? 'Mão de 11!' : 'Mão de 11 do adversário' }));

    if (!minhaDecisao) {
      caixa.appendChild(_elx('p', 'overlay-texto', { texto: 'Eles estão olhando as cartas pra decidir se vão…' }));
      ov.appendChild(caixa);
      return ov;
    }

    caixa.appendChild(_elx('p', 'overlay-texto', { texto: 'Suas cartas — vale 3 se jogar, 1 pro adversário se correr.' }));
    var cartas = _elx('div', 'overlay-cartas');
    ((_g.maos && _g.maos[_uid]) || []).forEach(function (cod) {
      cartas.appendChild(_cartaEl(cod, { manilha: _ehManilha(cod, _g.manilha) }));
    });
    caixa.appendChild(cartas);

    var acoes = _elx('div', 'overlay-acoes');
    var btnIr = _elx('button', 'btn-aceitar', { type: 'button', texto: 'Jogar (vale 3)' });
    btnIr.addEventListener('click', function () { _empurrarAcao('responderOnze', { resposta: 'ir' }); });
    var btnCorrer = _elx('button', 'btn-correr', { type: 'button', texto: 'Correr (+1 pra eles)' });
    btnCorrer.addEventListener('click', function () { _empurrarAcao('responderOnze', { resposta: 'correr' }); });
    acoes.appendChild(btnIr); acoes.appendChild(btnCorrer);
    caixa.appendChild(acoes);
    ov.appendChild(caixa);
    return ov;
  }

  function _criarOverlayPedido(meuTime) {
    var ov = _elx('div', 'overlay');
    var caixa = _elx('div', 'overlay-caixa');
    var pedeNome = _nomeDoUid(_g.pedidoTruco.de);
    // A frase vem do anfitrião (gravada no pedido), pra todo mundo ver a
    // MESMA — sorteio local faria cada aparelho mostrar uma coisa.
    caixa.appendChild(_elx('h3', 'overlay-titulo-grande', { texto: _g.pedidoTruco.frase || (_g.pedidoTruco.valor + '!') }));
    caixa.appendChild(_elx('p', 'overlay-texto', { texto: pedeNome + ' pediu ' + _g.pedidoTruco.valor }));

    if (_g.pedidoTruco.time === meuTime) {
      caixa.appendChild(_elx('p', 'overlay-texto', { texto: 'Esperando a resposta deles…' }));
    } else {
      var acoes = _elx('div', 'overlay-acoes');
      var btnAceitar = _elx('button', 'btn-aceitar', { type: 'button', texto: 'Cai dentro!' });
      btnAceitar.addEventListener('click', function () { _empurrarAcao('responderAumento', { resposta: 'aceitar' }); });
      var btnCorrer = _elx('button', 'btn-correr', { type: 'button', texto: 'Corro' });
      btnCorrer.addEventListener('click', function () { _empurrarAcao('responderAumento', { resposta: 'correr' }); });
      acoes.appendChild(btnAceitar); acoes.appendChild(btnCorrer);
      if (_proximoValorAposta(_g.pedidoTruco.valor)) {
        var btnAumentar = _elx('button', 'btn-aumentar', { type: 'button', texto: 'Pede ' + _proximoValorAposta(_g.pedidoTruco.valor) + '!' });
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
    var nomeTime = _nomesDoTime(_g.vencedorMao);
    caixa.appendChild(_elx('h3', 'overlay-titulo', { texto: _g.fraseFimMao || 'Fechou a mão!' }));
    caixa.appendChild(_elx('p', 'overlay-texto', { texto: (nomeTime || ('Time ' + _g.vencedorMao)) + ' +' + _g.pontosUltimaMao }));
    ov.appendChild(caixa);
    return ov;
  }

  function _criarOverlayFimPartida() {
    var ov = _elx('div', 'overlay');
    var caixa = _elx('div', 'overlay-caixa');
    var nomeTime = _nomesDoTime(_g.vencedorPartida);
    caixa.appendChild(_elx('h3', 'overlay-titulo-grande', { texto: '🏆 ' + (_g.fraseFimPartida || 'Ganhou a partida!') }));
    caixa.appendChild(_elx('p', 'overlay-texto', { texto: (nomeTime || ('Time ' + _g.vencedorPartida)) + ' — ' + _g.pontuacao.A + ' x ' + _g.pontuacao.B }));
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
      nome: 'Truco Paulista', min: 1, max: 4, opcoesJogadores: [1, 2, 4],
      iniciar: iniciar, parar: parar
    });
  }

  // Exposto só por consistência com o padrão dos outros módulos
  // (window.<Nome>Game) e pra depuração no console — o hub não chama
  // isto diretamente, quem chama é baralho.js via registrarModo.
  window.TrucoGame = { _debug: { regras: { _poder: _poder, _avaliarMao: _avaliarMao, _avaliarVaza: _avaliarVaza, _calcularManilha: _calcularManilha } } };
})();
