/* ═══════════════════════════════════════════════════════════════
   DOCES DA CORUJA (match-3 estilo Candy Crush) — módulo de jogo
   (lazy-loaded). Carregado sob demanda por /Jogos/ quando o usuário
   abre o jogo. Comunica-se com o app APENAS via window.AngatubaGames
   (a ponte). Expõe window.DocesGame = { preparar, comecar, parar }.

   Mecânica: grade 8×8 de doces coloridos. Troca duas peças
   adjacentes (toque em duas, ou arraste/swipe) — se formar uma
   combinação de 3+ na horizontal/vertical, remove, cai e repõe em
   cascata; senão a troca desfaz sozinha (sem custar movimento).
   Cada fase tem um limite de movimentos e um objetivo (pontos,
   combinações de uma cor-alvo, ou derreter blocos de gelo), gerado
   por fórmula a partir do número da fase. O ranking usa a MAIOR
   FASE CONCLUÍDA (inteiro), guardada localmente em
   'angatuba_doces_fase' e reconciliada no Firestore via
   AngatubaGames.rankSubmeter/rankFimDeJogo.

   RENDER: tabuleiro desenhado num único <canvas> (não uma div por
   célula), com loop de animação via requestAnimationFrame — permite
   troca deslizando, queda com "bounce" ao pousar, explosão com
   partícula e gelo com opacidade variável, mais perto do Candy Crush
   do que CSS/DOM dava. A LÓGICA do jogo (tabuleiro, combinações,
   gravidade, objetivo, fases, ranking) é a mesma de antes — só a
   forma de desenhar e captar toque mudou.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function _som() {
    return (window.AngatubaGames && window.AngatubaGames.som) || null;
  }
  // Atalho pra fachada de efeitos da ponte (no-op se não carregou ainda).
  function _efeitos() {
    return (window.AngatubaGames && window.AngatubaGames.efeitos) || null;
  }

  // Sprites do burst de match (mesmo pool usado no Blocos) — carregados
  // uma vez em _dcPrepararTela e cacheados aqui. Enquanto não carregam
  // (ou se falharem), o burst cai sozinho pro círculo colorido padrão
  // do efeitos.js (retrocompatível — ver opcoes.sprites em efeitos.estrelas).
  var _DC_SPRITES_MATCH_URLS = [
    '/Jogos/assets/particulas/brilho/circle_01.webp',
    '/Jogos/assets/particulas/brilho/circle_02.webp',
    '/Jogos/assets/particulas/brilho/flare_01.webp',
    '/Jogos/assets/particulas/brilho/magic_01.webp',
    '/Jogos/assets/particulas/brilho/magic_04.webp',
    '/Jogos/assets/particulas/brilho/muzzle_01.webp',
    '/Jogos/assets/particulas/brilho/muzzle_03.webp',
    '/Jogos/assets/particulas/brilho/spark_01.webp',
    '/Jogos/assets/particulas/brilho/spark_02.webp',
    '/Jogos/assets/particulas/brilho/spark_03.webp',
    '/Jogos/assets/particulas/brilho/star_01.webp',
    '/Jogos/assets/particulas/brilho/star_04.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff00.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff01.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff02.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff03.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff04.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff05.webp'
  ];
  var _dcSpritesMatch = null;
  function _dcCarregarSpritesMatch() {
    var fx = _efeitos();
    if (!fx || !fx.carregarSprites || _dcSpritesMatch) return;
    fx.carregarSprites(_DC_SPRITES_MATCH_URLS).then(function (imgs) {
      _dcSpritesMatch = imgs;
    }).catch(function () {}); // silencioso — sem sprites, o burst usa o fallback
  }

  var _DC_TAM = 8; // grade 8×8
  var _dcCores = ['#ef4444', '#a855f7', '#4ade80', '#fbbf24', '#38bdf8'];
  // Texturas opcionais (mesma ordem de _dcCores); se a imagem não
  // carregar, a cor sólida acima já é usada como fundo do doce.
  var _dcTexturas = [
    '/Jogos/assets/doces/doce-vermelho.webp',
    '/Jogos/assets/doces/doce-roxo.webp',
    '/Jogos/assets/doces/doce-verde.webp',
    '/Jogos/assets/doces/doce-amarelo.webp',
    '/Jogos/assets/doces/doce-azul.webp'
  ];
  var _DC_TEX_GELO = '/Jogos/assets/doces/gelo.webp';
  var _dcCoresNome = ['🔴 vermelho', '🟣 roxo', '🟢 verde', '🟡 amarelo', '🔵 azul'];

  // Formatos de tabuleiro por fase — no Candy Crush de verdade cada fase
  // tem um layout diferente, não é sempre uma grade 8×8 cheia. Fase 1-2
  // ficam cheias (tutorial); da 3 em diante alterna entre os formatos
  // abaixo. Cada função recebe (r,c) 0..7 e diz se a célula é jogável
  // (célula fora do formato vira um "buraco": nunca tem doce/gelo).
  var _dcFormatosTabuleiro = [
    function cheio() { return true; },
    function diamante(r, c) { return Math.abs(r - 3.5) + Math.abs(c - 3.5) <= 5.5; },
    function cruz(r, c) { return (r >= 2 && r <= 5) || (c >= 2 && c <= 5); },
    function anel(r, c) { return !(r >= 3 && r <= 4 && c >= 3 && c <= 4); },
    function cantos(r, c) { return (r + c) >= 2 && (r + c) <= 12; }
  ];
  // Temas de fundo por fase (arena atrás do tabuleiro) — cicla junto
  // com os formatos pra cada fase parecer mais um "cenário" diferente,
  // igual ao Candy Crush (lá muda árvore/bolo/fábrica; aqui muda cor).
  var _dcTemasFundo = [
    { base1: '#3a1a2e', base2: '#1c0f1c', destaque: 'rgba(251,113,133,0.18)' }, // rosa-doce
    { base1: '#0f2e26', base2: '#0a1a16', destaque: 'rgba(74,222,128,0.16)' },  // menta
    { base1: '#2a1240', base2: '#160a24', destaque: 'rgba(168,85,247,0.18)' }, // uva
    { base1: '#3a2410', base2: '#1e1207', destaque: 'rgba(251,191,36,0.18)' }, // laranja
    { base1: '#0d2438', base2: '#071420', destaque: 'rgba(56,189,248,0.18)' }, // céu/gelo
    { base1: '#2b1810', base2: '#160c08', destaque: 'rgba(217,119,6,0.16)' }   // chocolate
  ];

  // Doces especiais (criados ao combinar 4+, ativados ao serem
  // combinados/trocados de novo) — igual ao Candy Crush: listrado limpa
  // linha/coluna, embrulhado explode uma área 3×3, bomba de cor limpa
  // toda uma cor do tabuleiro quando trocada com um doce normal.
  var _DC_TIPO_NORMAL = 0, _DC_TIPO_LISTRA_H = 1, _DC_TIPO_LISTRA_V = 2,
      _DC_TIPO_EMBRULHADO = 3, _DC_TIPO_BOMBA = 4;

  // ── Estado do jogo (igual a antes) ─────────────────────────
  var _dcCor = [];                // 64 posições: 1..5 = cor do doce
  var _dcGelo = [];               // 64 posições: 0 = normal, 1-2 = hits restantes
  var _dcTipo = [];               // 64 posições: 0 = normal, 1-4 = doce especial (ver _DC_TIPO_*)
  var _dcFormato = null;          // 64 posições: 1 = jogável, 0 = buraco (sem doce)
  var _dcFaseAtual = 1;
  var _dcObjetivo = null;         // { tipo:'pontos'|'cor'|'obstaculo', meta, corAlvo }
  var _dcMovimentosRestantes = 0;
  var _dcPontosFase = 0;
  var _dcMatchesCorFase = 0;
  var _dcObstaculosQuebrados = 0;
  var _dcRng = null;
  var _dcRodando = false;
  var _dcAnimando = false;
  var _dcUltimoResultado = null;  // 'venceu' | 'perdeu'
  var _dcSelecionado = null;      // { r, c } escolhida por toque
  var _dcArraste = null;

  // ── Estado só do RENDER em canvas ──────────────────────────
  var _dcCanvas = null, _dcCtx = null;
  var _dcTelaAberta = false;      // liga/desliga o loop de desenho
  var _dcImgs = {};               // corIdx(0..4) -> Image carregada; 'gelo' -> Image
  var _dcImgsPedidas = false;
  var _DC_PAD = 6, _DC_GAP = 3;   // mesmos valores que eram do CSS (.dc-grid)
  var _dcQuedaAnim = {};          // idx -> { t0, filas }
  var _dcPopAnim = {};            // idx -> { t0 }
  var _dcPousoAnim = {};          // idx -> { t0 } (squash ao pousar da queda)
  var _dcShakeAnim = {};          // idx -> { t0 } (troca inválida)
  var _dcTrocaAnim = null;        // { i1, i2, t0, duracao, reversa }
  var _DC_DUR_POP = 200, _DC_DUR_QUEDA = 220, _DC_DUR_POUSO = 150,
      _DC_DUR_SHAKE = 300, _DC_DUR_TROCA = 130, _DC_DUR_COMBO = 900;
  var _dcCorBorda = 'rgba(255,255,255,0.08)'; // fallback; lido de --border ao preparar a tela
  var _dcComboMsg = null;         // { texto, cor, t0, duracao } — aviso tipo "Delicioso!"

  // ── localStorage: maior fase JÁ CONCLUÍDA ──────────────────
  function _dcRecordeGet() {
    try { return Math.max(0, Math.round(Number(localStorage.getItem('angatuba_doces_fase')) || 0)); }
    catch (e) { return 0; }
  }
  function _dcRecordeSet(v) {
    try { localStorage.setItem('angatuba_doces_fase', String(v)); } catch (e) {}
  }

  // ── PRNG determinístico (mulberry32) — mesma fase = mesmo
  // tabuleiro inicial, mesmo depois de um "retry". ────────────
  function _dcMulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function _dcNovaCor() { return 1 + Math.floor(_dcRng() * _dcCores.length); }

  // ── Configuração de fase por fórmula: alterna objetivo,
  // reduz movimentos e introduz gelo a partir da fase 4. ─────
  function _dcConfigFase(fase) {
    var haGelo = fase >= 4;
    var tipos = haGelo ? ['pontos', 'cor', 'obstaculo'] : ['pontos', 'cor'];
    var tipo = tipos[(fase - 1) % tipos.length];
    var movimentos = Math.max(12, 28 - Math.floor((fase - 1) / 2));
    var qtdGelo = haGelo ? Math.min(8, 2 + Math.floor((fase - 4) / 2)) : 0;
    var meta, corAlvo = null;
    if (tipo === 'pontos') meta = 400 + (fase - 1) * 180;
    else if (tipo === 'cor') { meta = 6 + Math.floor((fase - 1) / 3); corAlvo = ((fase - 1) % _dcCores.length) + 1; }
    else meta = Math.max(1, qtdGelo);
    return { tipo: tipo, meta: meta, movimentos: movimentos, corAlvo: corAlvo, qtdGelo: qtdGelo };
  }

  function _dcObjetivoTexto() {
    if (!_dcObjetivo) return '—';
    if (_dcObjetivo.tipo === 'pontos') return 'Alcance ' + _dcObjetivo.meta + ' pontos';
    if (_dcObjetivo.tipo === 'cor') return 'Faça ' + _dcObjetivo.meta + ' combinações ' + _dcCoresNome[_dcObjetivo.corAlvo - 1];
    return 'Derreta ' + _dcObjetivo.meta + (_dcObjetivo.meta === 1 ? ' bloco de gelo' : ' blocos de gelo');
  }
  function _dcObjetivoProgresso() {
    if (!_dcObjetivo) return '0/0';
    if (_dcObjetivo.tipo === 'pontos') return Math.min(_dcPontosFase, _dcObjetivo.meta) + '/' + _dcObjetivo.meta;
    if (_dcObjetivo.tipo === 'cor') return Math.min(_dcMatchesCorFase, _dcObjetivo.meta) + '/' + _dcObjetivo.meta;
    return Math.min(_dcObstaculosQuebrados, _dcObjetivo.meta) + '/' + _dcObjetivo.meta;
  }
  function _dcObjetivoAtingido() {
    if (!_dcObjetivo) return false;
    if (_dcObjetivo.tipo === 'pontos') return _dcPontosFase >= _dcObjetivo.meta;
    if (_dcObjetivo.tipo === 'cor') return _dcMatchesCorFase >= _dcObjetivo.meta;
    return _dcObstaculosQuebrados >= _dcObjetivo.meta;
  }

  // ── Formato do tabuleiro (buracos) ──────────────────────────
  function _dcCelulaAtiva(idx) { return !_dcFormato || _dcFormato[idx] === 1; }
  function _dcFormatoParaFase(fase) {
    if (fase <= 2) return _dcFormatosTabuleiro[0]; // fases 1-2: sempre cheio (tutorial)
    return _dcFormatosTabuleiro[1 + ((fase - 3) % (_dcFormatosTabuleiro.length - 1))];
  }
  function _dcGerarFormato(fase) {
    var fn = _dcFormatoParaFase(fase);
    var formato = new Array(_DC_TAM * _DC_TAM);
    for (var r = 0; r < _DC_TAM; r++) {
      for (var c = 0; c < _DC_TAM; c++) formato[r * _DC_TAM + c] = fn(r, c) ? 1 : 0;
    }
    return formato;
  }
  function _dcAplicarTemaFase(fase) {
    var arena = document.getElementById('dc-arena');
    if (!arena) return;
    var t = _dcTemasFundo[(fase - 1) % _dcTemasFundo.length];
    arena.style.background =
      'radial-gradient(circle at 70% 8%, ' + t.destaque + ', transparent 55%), ' +
      'linear-gradient(160deg, ' + t.base1 + ', ' + t.base2 + ')';
  }

  // ── Tabuleiro ───────────────────────────────────────────────
  // Gera um tabuleiro sem combinações prontas (checa só pra trás,
  // já que as células seguintes ainda não foram preenchidas).
  function _dcCriaMatchEm(idx, cor) {
    var r = Math.floor(idx / _DC_TAM), c = idx % _DC_TAM;
    if (c >= 2 && _dcCor[idx - 1] === cor && _dcCor[idx - 2] === cor) return true;
    if (r >= 2 && _dcCor[idx - _DC_TAM] === cor && _dcCor[idx - 2 * _DC_TAM] === cor) return true;
    return false;
  }
  function _dcGerarTabuleiroInicial() {
    _dcCor = new Array(_DC_TAM * _DC_TAM);
    _dcTipo = new Array(_DC_TAM * _DC_TAM).fill(0); // tabuleiro novo: nenhum doce especial ainda
    for (var i = 0; i < _dcCor.length; i++) {
      if (!_dcCelulaAtiva(i)) { _dcCor[i] = 0; continue; } // buraco: nunca recebe doce
      var cor, tentativas = 0;
      do { cor = _dcNovaCor(); tentativas++; } while (_dcCriaMatchEm(i, cor) && tentativas < 30);
      _dcCor[i] = cor;
    }
  }
  function _dcColocarGelo(qtd) {
    _dcGelo = new Array(_DC_TAM * _DC_TAM).fill(0);
    var colocados = 0, tentativas = 0;
    while (colocados < qtd && tentativas < qtd * 40) {
      tentativas++;
      var idx = Math.floor(_dcRng() * _DC_TAM * _DC_TAM);
      if (!_dcCelulaAtiva(idx) || _dcGelo[idx] > 0) continue;
      _dcGelo[idx] = 2;
      colocados++;
    }
  }

  // Chave de comparação usada só pra achar combinações — não é a cor real.
  // Buraco e bomba de cor recebem um valor único por célula (nunca repete),
  // então nunca "combinam" à toa: buraco não tem doce, e bomba de cor só
  // ativa por troca direta (ver _dcAtivarEspeciaisSwap), nunca por engano
  // caindo numa combinação comum de mesma cor.
  function _dcChaveMatch(idx) {
    if (!_dcCelulaAtiva(idx)) return -1000 - idx;
    if (_dcTipo[idx] === _DC_TIPO_BOMBA) return -2000 - idx;
    return _dcCor[idx];
  }

  // Encontra todas as combinações de 3+ (linhas e colunas). Retorna
  // { marcado: bool[64], runs: [{cor, cells:[idx,...], dir:'h'|'v'}] }.
  function _dcEncontrarMatches() {
    var marcado = new Array(_DC_TAM * _DC_TAM).fill(false);
    var runs = [], r, c, i;
    for (r = 0; r < _DC_TAM; r++) {
      var run = 1;
      for (c = 1; c <= _DC_TAM; c++) {
        var atual = c < _DC_TAM ? _dcChaveMatch(r * _DC_TAM + c) : -1;
        var anterior = _dcChaveMatch(r * _DC_TAM + (c - 1));
        if (c < _DC_TAM && atual === anterior) { run++; }
        else {
          if (run >= 3) {
            var cells = [];
            for (i = c - run; i < c; i++) { cells.push(r * _DC_TAM + i); marcado[r * _DC_TAM + i] = true; }
            runs.push({ cor: _dcCor[r * _DC_TAM + (c - 1)], cells: cells, dir: 'h' });
          }
          run = 1;
        }
      }
    }
    for (c = 0; c < _DC_TAM; c++) {
      var runV = 1;
      for (r = 1; r <= _DC_TAM; r++) {
        var atualV = r < _DC_TAM ? _dcChaveMatch(r * _DC_TAM + c) : -1;
        var anteriorV = _dcChaveMatch((r - 1) * _DC_TAM + c);
        if (r < _DC_TAM && atualV === anteriorV) { runV++; }
        else {
          if (runV >= 3) {
            var cellsV = [];
            for (i = r - runV; i < r; i++) { cellsV.push(i * _DC_TAM + c); marcado[i * _DC_TAM + c] = true; }
            runs.push({ cor: _dcCor[(r - 1) * _DC_TAM + c], cells: cellsV, dir: 'v' });
          }
          runV = 1;
        }
      }
    }
    return { marcado: marcado, runs: runs };
  }

  // Troca cor E tipo juntos (usado na troca real do jogador) — sem isso
  // o doce especial "ficaria pra trás" quando o jogador arrasta ele pra
  // outra célula, e a cor normal herdaria o tipo especial por engano.
  function _dcTrocarCelulas(i1, i2) {
    var tc = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tc;
    var tt = _dcTipo[i1]; _dcTipo[i1] = _dcTipo[i2]; _dcTipo[i2] = tt;
  }
  function _dcTrocaFormaMatch(i1, i2) {
    if (!_dcCelulaAtiva(i1) || !_dcCelulaAtiva(i2)) return false; // buraco: não tem doce pra trocar
    // O gelo NÃO trava a troca — trava só a peça de sumir do tabuleiro
    // (ver _dcProcessarMarcados). A cor por baixo do gelo troca normal,
    // igual ao Candy Crush: sem isso o gelo só quebrava por acaso, via
    // cascata vinda de outro match na mesma coluna — quase nunca acontecia.
    var tmp = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tmp;
    var achou = _dcEncontrarMatches().marcado.indexOf(true) !== -1;
    tmp = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tmp;
    return achou;
  }
  function _dcExisteMovimentoValido() {
    for (var r = 0; r < _DC_TAM; r++) {
      for (var c = 0; c < _DC_TAM; c++) {
        var idx = r * _DC_TAM + c;
        if (!_dcCelulaAtiva(idx)) continue;
        // Um doce especial SEMPRE tem uma troca válida (ativa o efeito na
        // hora, mesmo sem formar combinação de cor) — sem este check, o
        // embaralhamento automático podia apagar um especial que o
        // jogador tinha acabado de ganhar, achando que o tabuleiro
        // estava travado.
        if (_dcTipo[idx] > 0 && (
          (c + 1 < _DC_TAM && _dcCelulaAtiva(idx + 1)) ||
          (r + 1 < _DC_TAM && _dcCelulaAtiva(idx + _DC_TAM)) ||
          (c - 1 >= 0 && _dcCelulaAtiva(idx - 1)) ||
          (r - 1 >= 0 && _dcCelulaAtiva(idx - _DC_TAM))
        )) return true;
        if (c + 1 < _DC_TAM && _dcTrocaFormaMatch(idx, idx + 1)) return true;
        if (r + 1 < _DC_TAM && _dcTrocaFormaMatch(idx, idx + _DC_TAM)) return true;
      }
    }
    return false;
  }
  function _dcEmbaralhar() {
    var tentativas = 0;
    do { _dcGerarTabuleiroInicial(); tentativas++; } while (!_dcExisteMovimentoValido() && tentativas < 6);
  }

  // Aplica a gravidade (doces caem, vazios no topo viram doce novo) e
  // devolve quanto cada um "caiu" (em linhas), pra animar a queda em
  // vez de só trocar a cor instantaneamente. Doce novo entra vindo de
  // cima da grade.
  // Com tabuleiros de formato variado, um "buraco" no meio de uma coluna
  // (ex.: o formato "anel") separa a coluna em pedaços independentes —
  // doces de cima não atravessam o buraco, cada pedaço cai só dentro
  // dele mesmo, igual peça flutuando sobre um vão no Candy Crush.
  function _dcAplicarGravidadeComQuedas() {
    var quedas = []; // { idx: posição final, filas: distância caída }
    for (var c = 0; c < _DC_TAM; c++) {
      var r = 0;
      while (r < _DC_TAM) {
        if (!_dcCelulaAtiva(r * _DC_TAM + c)) { r++; continue; }
        var rIni = r;
        while (r < _DC_TAM && _dcCelulaAtiva(r * _DC_TAM + c)) r++;
        var rFim = r - 1; // pedaço contíguo jogável: [rIni..rFim]
        var tamPedaco = rFim - rIni + 1;
        var sobreviventes = []; // {origRow, cor, tipo}, do topo pra baixo, só deste pedaço
        for (var rr = rIni; rr <= rFim; rr++) {
          var idxRr = rr * _DC_TAM + c;
          if (_dcCor[idxRr] !== 0) sobreviventes.push({ origRow: rr, cor: _dcCor[idxRr], tipo: _dcTipo[idxRr] });
        }
        var novos = tamPedaco - sobreviventes.length;
        for (var i = 0; i < tamPedaco; i++) {
          var linhaAtual = rIni + i;
          var idx2 = linhaAtual * _DC_TAM + c;
          if (i < novos) {
            _dcCor[idx2] = _dcNovaCor();
            _dcTipo[idx2] = 0; // doce novo: nunca nasce especial
            quedas.push({ idx: idx2, filas: novos - i });
          } else {
            var sv = sobreviventes[i - novos];
            _dcCor[idx2] = sv.cor;
            _dcTipo[idx2] = sv.tipo;
            var filas = linhaAtual - sv.origRow;
            if (filas > 0) quedas.push({ idx: idx2, filas: filas });
          }
        }
      }
    }
    return quedas;
  }

  // Remove as peças marcadas (pontua, conta combinações da cor-alvo
  // e "craca" o gelo daquela posição), deixando 0 = vazio pra gravidade.
  // `criar` (opcional) é a lista de { idx, tipo, cor } de _dcAnalisarResultado:
  // em vez de esvaziar essas células, elas viram doces especiais.
  function _dcProcessarMarcados(resultado, criar) {
    var emRun = new Array(_dcCor.length).fill(false);
    resultado.runs.forEach(function (run) {
      _dcPontosFase += run.cells.length * 10;
      if (_dcObjetivo && _dcObjetivo.tipo === 'cor' && run.cor === _dcObjetivo.corAlvo) {
        _dcMatchesCorFase++;
      }
      run.cells.forEach(function (idx) { emRun[idx] = true; });
    });
    var criarPorIdx = {};
    (criar || []).forEach(function (cr) { criarPorIdx[cr.idx] = cr; });
    resultado.marcado.forEach(function (m, idx) {
      if (!m) return;
      // célula limpa só por efeito de um doce especial (nunca fez parte de
      // uma combinação normal) também pontua — senão o estouro de um
      // listrado/embrulhado/bomba não valeria nada.
      if (!emRun[idx] && !criarPorIdx[idx]) _dcPontosFase += 15;
      if (_dcGelo[idx] > 0) {
        _dcGelo[idx]--;
        if (_dcGelo[idx] === 0) _dcObstaculosQuebrados++;
      }
      var cr = criarPorIdx[idx];
      if (cr) {
        _dcCor[idx] = cr.cor;
        _dcTipo[idx] = cr.tipo;
        _dcPontosFase += 40; // bônus por criar um doce especial
      } else {
        _dcCor[idx] = 0;
        _dcTipo[idx] = 0;
      }
    });
  }

  // ── Doces especiais: criação e ativação ─────────────────────
  // Quais células um doce especial afeta ao ser ativado (não inclui a
  // bomba de cor — ela depende da cor do parceiro na troca, tratada à
  // parte em _dcAtivarEspeciaisSwap).
  function _dcCelulasEfeitoEspecial(idx, tipo) {
    var r = Math.floor(idx / _DC_TAM), c = idx % _DC_TAM, out = [], rr, cc, j;
    if (tipo === _DC_TIPO_LISTRA_H) { // limpa a LINHA inteira
      for (cc = 0; cc < _DC_TAM; cc++) { j = r * _DC_TAM + cc; if (_dcCelulaAtiva(j)) out.push(j); }
    } else if (tipo === _DC_TIPO_LISTRA_V) { // limpa a COLUNA inteira
      for (rr = 0; rr < _DC_TAM; rr++) { j = rr * _DC_TAM + c; if (_dcCelulaAtiva(j)) out.push(j); }
    } else if (tipo === _DC_TIPO_EMBRULHADO) { // explode uma área 3×3
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          var rr2 = r + dr, cc2 = c + dc;
          if (rr2 < 0 || rr2 >= _DC_TAM || cc2 < 0 || cc2 >= _DC_TAM) continue;
          j = rr2 * _DC_TAM + cc2;
          if (_dcCelulaAtiva(j)) out.push(j);
        }
      }
    }
    return out;
  }
  // Todas as células ativas de uma cor (usado pela bomba de cor).
  function _dcCelulasCor(cor) {
    var out = [];
    for (var i = 0; i < _dcCor.length; i++) {
      if (_dcCelulaAtiva(i) && _dcCor[i] === cor && _dcTipo[i] !== _DC_TIPO_BOMBA) out.push(i);
    }
    return out;
  }
  // Reação em cadeia: se uma célula já marcada (por ter entrado numa
  // combinação normal) já era um doce especial, seu efeito também dispara
  // — ex.: um listrado pego no meio de outro match explode a linha dele
  // inteira, e se essa linha tiver outro especial, o efeito continua.
  // Bomba de cor NUNCA participa disso (só ativa por troca direta — ver
  // _dcAtivarEspeciaisSwap): sem isso, ela "combinaria" à toa como uma
  // cor comum sempre que caísse do lado de doces da mesma cor guardada.
  function _dcExpandirMarcado(marcado) {
    var fila = [], vistos = {}, i;
    for (i = 0; i < marcado.length; i++) {
      if (marcado[i] && _dcTipo[i] > 0 && _dcTipo[i] !== _DC_TIPO_BOMBA) fila.push(i);
    }
    while (fila.length) {
      var idx = fila.shift();
      if (vistos[idx]) continue;
      vistos[idx] = true;
      var extras = _dcCelulasEfeitoEspecial(idx, _dcTipo[idx]);
      extras.forEach(function (j) {
        if (!marcado[j]) marcado[j] = true;
        if (_dcTipo[j] > 0 && _dcTipo[j] !== _DC_TIPO_BOMBA && !vistos[j]) fila.push(j);
      });
    }
  }
  // Decide quais células do resultado (das combinações ORIGINAIS, antes
  // da expansão em cadeia) viram doces especiais em vez de sumir:
  // - combinação de 4: listrado (orientação = direção da combinação);
  // - combinação de 5+: bomba de cor;
  // - duas combinações de 3 (uma horizontal, uma vertical) que se cruzam
  //   numa célula livre, formando "L"/"T": embrulhado.
  // `prefCel`, quando informado, é a célula de destino da troca do
  // jogador — se ela fizer parte da combinação, o especial nasce ali
  // (igual ao Candy Crush: o doce especial aparece onde você arrastou).
  function _dcAnalisarResultado(resultado, prefCel) {
    var criar = [], usados = {};
    var runsGrandes = resultado.runs.filter(function (rn) { return rn.cells.length >= 4; });
    var runsTriplas = resultado.runs.filter(function (rn) { return rn.cells.length === 3; });

    runsGrandes.forEach(function (run) {
      var tipo = run.cells.length >= 5
        ? _DC_TIPO_BOMBA
        : (run.dir === 'h' ? _DC_TIPO_LISTRA_H : _DC_TIPO_LISTRA_V);
      var idx = (prefCel != null && run.cells.indexOf(prefCel) !== -1 && !usados[prefCel])
        ? prefCel
        : run.cells.filter(function (i) { return !usados[i]; })[0];
      if (idx == null) return;
      usados[idx] = true;
      criar.push({ idx: idx, tipo: tipo, cor: run.cor });
    });

    for (var i = 0; i < runsTriplas.length; i++) {
      if (runsTriplas[i].dir !== 'h') continue;
      for (var j = 0; j < runsTriplas.length; j++) {
        if (runsTriplas[j].dir !== 'v') continue;
        var rh = runsTriplas[i], rv = runsTriplas[j];
        var comum = rh.cells.filter(function (c) { return rv.cells.indexOf(c) !== -1 && !usados[c]; });
        if (comum.length) {
          var idxE = (prefCel != null && comum.indexOf(prefCel) !== -1) ? prefCel : comum[0];
          usados[idxE] = true;
          criar.push({ idx: idxE, tipo: _DC_TIPO_EMBRULHADO, cor: rh.cor });
        }
      }
    }
    return criar;
  }
  // Ativa doce(s) especial(is) envolvidos numa troca DIRETA do jogador
  // (mesmo sem formar uma combinação de cor comum) — devolve o array
  // marcado[64] com todas as células atingidas, já expandido em cadeia.
  function _dcAtivarEspeciaisSwap(i1, i2, tipo1, tipo2) {
    var marcado = new Array(_dcCor.length).fill(false);
    function marcarLista(lista) { lista.forEach(function (j) { marcado[j] = true; }); }
    var bomba1 = tipo1 === _DC_TIPO_BOMBA, bomba2 = tipo2 === _DC_TIPO_BOMBA;
    if (bomba1 && bomba2) {
      // duas bombas de cor trocadas entre si: limpa o tabuleiro inteiro
      for (var i = 0; i < _dcCor.length; i++) { if (_dcCelulaAtiva(i)) marcado[i] = true; }
    } else if (bomba1) {
      marcarLista(_dcCelulasCor(_dcCor[i2]));
      marcado[i1] = true;
    } else if (bomba2) {
      marcarLista(_dcCelulasCor(_dcCor[i1]));
      marcado[i2] = true;
    } else {
      if (tipo1 > 0) marcarLista(_dcCelulasEfeitoEspecial(i1, tipo1));
      if (tipo2 > 0) marcarLista(_dcCelulasEfeitoEspecial(i2, tipo2));
    }
    _dcExpandirMarcado(marcado);
    var out = [];
    marcado.forEach(function (m, idx) { if (m) out.push(idx); });
    return out;
  }

  // ── RENDER em canvas ────────────────────────────────────────
  // Carrega as imagens uma vez (idempotente); se alguma falhar, o
  // desenho cai pra cor sólida (_dcCores) sem quebrar nada.
  function _dcCarregarImagens() {
    if (_dcImgsPedidas) return;
    _dcImgsPedidas = true;
    _dcTexturas.forEach(function (src, i) {
      var img = new Image();
      img.onload = function () { _dcImgs[i] = img; };
      img.src = src;
    });
    var imgGelo = new Image();
    imgGelo.onload = function () { _dcImgs.gelo = imgGelo; };
    imgGelo.src = _DC_TEX_GELO;
  }

  // Layout atual do tabuleiro em pixels CSS (depende só da largura
  // exibida do canvas — ele é sempre quadrado). Recalculado a cada
  // uso porque o tamanho pode mudar (rotação, tela cheia).
  function _dcObterLayout() {
    var rect = _dcCanvas ? _dcCanvas.getBoundingClientRect() : { width: 340, height: 340 };
    var largura = rect.width || 340;
    var cellPx = (largura - 2 * _DC_PAD - (_DC_TAM - 1) * _DC_GAP) / _DC_TAM;
    return { rect: rect, cellPx: cellPx, passo: cellPx + _DC_GAP, pad: _DC_PAD };
  }
  // Centro (em px CSS, relativo ao canvas) da célula (r,c).
  function _dcCentroCelula(layout, r, c) {
    return {
      x: layout.pad + c * layout.passo + layout.cellPx / 2,
      y: layout.pad + r * layout.passo + layout.cellPx / 2
    };
  }
  // Centro em coordenadas de TELA (pra posicionar efeitos externos
  // como a explosão de estrelinhas, que espera clientX/clientY).
  function _dcCentroCelulaTela(idx) {
    if (!_dcCanvas) return null;
    var layout = _dcObterLayout();
    var r = Math.floor(idx / _DC_TAM), c = idx % _DC_TAM;
    var p = _dcCentroCelula(layout, r, c);
    return { x: layout.rect.left + p.x, y: layout.rect.top + p.y };
  }

  function _dcAjustarResolucaoCanvas() {
    if (!_dcCanvas || !_dcCtx) return;
    var rect = _dcCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return; // tela ainda escondida (display:none)
    var dpr = window.devicePixelRatio || 1;
    var wPx = Math.round(rect.width * dpr), hPx = Math.round(rect.height * dpr);
    if (_dcCanvas.width === wPx && _dcCanvas.height === hPx) return;
    _dcCanvas.width = wPx;
    _dcCanvas.height = hPx;
    _dcCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Curvas de easing usadas nas animações.
  function _dcEaseOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function _dcEaseOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // Desenha um doce centrado em (cx, cy), com raio, escala e opacidade
  // dadas — usado pra idle, queda, pop, seleção, troca, tudo passa pelos
  // mesmos parâmetros. Sem bolinha colorida de fundo: o doce é só a
  // imagem (pirulito, diamante, coração...) ocupando quase a célula
  // inteira, igual ao Candy Crush de verdade — pedido do Bruno pra tirar
  // o "doce dentro de uma bolinha" que a versão anterior tinha.
  function _dcDesenharDoce(ctx, cx, cy, raio, corIdx, tipo, gelo, escala, alpha, offsetX) {
    if (!corIdx) return; // 0/undefined = célula vazia (transitório)
    var r = raio * (escala == null ? 1 : escala);
    if (r <= 0) return;
    var x = cx + (offsetX || 0);
    var a = alpha == null ? 1 : alpha;
    ctx.save();
    ctx.globalAlpha = a;

    // Bomba de cor: orbe arco-íris no lugar da imagem normal — não fica
    // "dentro" de gelo nem herda a textura da cor guardada (ela é curinga).
    if (tipo === _DC_TIPO_BOMBA) {
      var grad = ctx.createRadialGradient(x, cy, r * 0.1, x, cy, r * 0.95);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, '#f87171');
      grad.addColorStop(0.45, '#fbbf24');
      grad.addColorStop(0.65, '#4ade80');
      grad.addColorStop(0.85, '#38bdf8');
      grad.addColorStop(1, '#a855f7');
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.92, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (gelo) { try { ctx.filter = gelo === 2 ? 'saturate(0.5) brightness(1.05)' : 'saturate(0.3) brightness(1.12)'; } catch (e) {} }
    var img = _dcImgs[corIdx - 1];
    if (img) {
      var lado = r * 1.9; // quase o diâmetro (2r) inteiro da célula
      try { ctx.drawImage(img, x - lado / 2, cy - lado / 2, lado, lado); } catch (e) {}
    } else {
      // imagem ainda carregando (raro, só no primeiro frame): círculo da
      // cor sólida como placeholder temporário, nunca o visual final.
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = _dcCores[corIdx - 1] || '#999';
      ctx.fill();
    }
    try { ctx.filter = 'none'; } catch (e) {}

    // Overlay do doce especial (listrado/embrulhado) por cima da imagem
    // normal — sem precisar de nenhum asset novo.
    if (tipo === _DC_TIPO_LISTRA_H || tipo === _DC_TIPO_LISTRA_V) {
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      var nb = 3, lado2 = r * 1.7, faixa = (lado2 / nb) * 0.42;
      for (var bi = 0; bi < nb; bi++) {
        var offB = -lado2 / 2 + bi * (lado2 / nb) + (lado2 / nb - faixa) / 2;
        if (tipo === _DC_TIPO_LISTRA_H) ctx.fillRect(x - lado2 / 2, cy + offB, lado2, faixa);
        else ctx.fillRect(x + offB, cy - lado2 / 2, faixa, lado2);
      }
      ctx.restore();
    } else if (tipo === _DC_TIPO_EMBRULHADO) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1.5, r * 0.14);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, cy); ctx.lineTo(x + r * 0.8, cy);
      ctx.moveTo(x, cy - r * 0.8); ctx.lineTo(x, cy + r * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.restore();
    }

    if (gelo && _dcImgs.gelo) {
      ctx.globalAlpha = a * (gelo === 2 ? 1 : 0.55);
      var ladoGelo = r * 1.7;
      try { ctx.drawImage(_dcImgs.gelo, x - ladoGelo / 2, cy - ladoGelo / 2, ladoGelo, ladoGelo); } catch (e) {}
    }
    ctx.restore();
  }

  function _dcDesenharFrame() {
    if (!_dcTelaAberta) return;
    _dcDesenharTabuleiro(performance.now());
    requestAnimationFrame(_dcDesenharFrame);
  }

  function _dcDesenharTabuleiro(agora) {
    if (!_dcCtx || !_dcCanvas) return;
    var layout = _dcObterLayout();
    var w = layout.rect.width, h = layout.rect.height;
    var ctx = _dcCtx;
    ctx.clearRect(0, 0, w, h);
    // fundo do tabuleiro (igual ao antigo .dc-grid)
    _dcCaminhoArredondado(ctx, 0, 0, w, h, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    ctx.strokeStyle = _dcCorBorda;
    ctx.lineWidth = 1;
    ctx.stroke();

    for (var r = 0; r < _DC_TAM; r++) {
      for (var c = 0; c < _DC_TAM; c++) {
        var idx = r * _DC_TAM + c;
        if (!_dcCelulaAtiva(idx)) {
          // buraco do formato da fase: marca como um vão, sem doce nem interação
          var pBuraco = _dcCentroCelula(layout, r, c);
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(pBuraco.x, pBuraco.y, layout.cellPx * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fill();
          ctx.restore();
          continue;
        }
        var p = _dcCentroCelula(layout, r, c);
        var cx = p.x, cy = p.y;
        var raio = layout.cellPx / 2;
        var escala = 1, alpha = 1, offX = 0, offY = 0;

        // troca deslizando (as duas peças cruzam de posição)
        if (_dcTrocaAnim && (idx === _dcTrocaAnim.i1 || idx === _dcTrocaAnim.i2)) {
          var ta = _dcTrocaAnim;
          var t = Math.min(1, (agora - ta.t0) / ta.duracao);
          var te = _dcEaseOutQuad(t);
          var proprioIdx = idx, outroIdx = idx === ta.i1 ? ta.i2 : ta.i1;
          var pProprio = _dcCentroCelula(layout, Math.floor(proprioIdx / _DC_TAM), proprioIdx % _DC_TAM);
          var pOutro = _dcCentroCelula(layout, Math.floor(outroIdx / _DC_TAM), outroIdx % _DC_TAM);
          var de = ta.reversa ? pOutro : pProprio, para = ta.reversa ? pProprio : pOutro;
          cx = de.x + (para.x - de.x) * te;
          cy = de.y + (para.y - de.y) * te;
        }

        // queda (entra de cima, com um leve "estica" ao final)
        var quedaInfo = _dcQuedaAnim[idx];
        if (quedaInfo) {
          var tq = Math.min(1, (agora - quedaInfo.t0) / _DC_DUR_QUEDA);
          var teq = _dcEaseOutBack(tq);
          offY += -(1 - teq) * quedaInfo.filas * layout.passo;
          if (tq >= 1) {
            delete _dcQuedaAnim[idx];
            _dcPousoAnim[idx] = { t0: agora };
          }
        }
        // squash ao pousar
        var pousoInfo = _dcPousoAnim[idx];
        var escalaX = 1, escalaY = 1;
        if (pousoInfo) {
          var tp = Math.min(1, (agora - pousoInfo.t0) / _DC_DUR_POUSO);
          if (tp >= 1) delete _dcPousoAnim[idx];
          else {
            var achata = Math.sin(tp * Math.PI) * 0.22;
            escalaY = 1 - achata; escalaX = 1 + achata * 0.7;
          }
        }
        // pop/explosão
        var popInfo = _dcPopAnim[idx];
        if (popInfo) {
          var tpop = Math.min(1, (agora - popInfo.t0) / _DC_DUR_POP);
          if (tpop < 0.45) escala = 1 + (tpop / 0.45) * 0.3;
          else { var tt = (tpop - 0.45) / 0.55; escala = 1.3 - tt * 1.15; alpha = 1 - tt; }
        }
        // seleção (encolhe um pouco + anel branco)
        var selecionada = !!(_dcSelecionado && (_dcSelecionado.r * _DC_TAM + _dcSelecionado.c) === idx);
        if (selecionada) escala *= 0.86;
        // troca inválida (tremida horizontal)
        var shakeInfo = _dcShakeAnim[idx];
        if (shakeInfo) {
          var ts = Math.min(1, (agora - shakeInfo.t0) / _DC_DUR_SHAKE);
          if (ts >= 1) delete _dcShakeAnim[idx];
          else offX += Math.sin(ts * Math.PI * 4) * 5 * (1 - ts);
        }

        var raioFinal = raio * escalaX;
        _dcDesenharDoce(ctx, cx, cy + offY, raio, _dcCor[idx], _dcTipo[idx], _dcGelo[idx], escala * (escalaY), alpha, offX);
        if (selecionada) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx + offX, cy + offY, raio * escala + 2, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Mensagem de combo ("Delicioso!", "Combo x2!"...) — aparece só em
    // jogadas grandes, centrada sobre o tabuleiro, com pop-in e fade-out.
    if (_dcComboMsg) {
      var tc = (agora - _dcComboMsg.t0) / _dcComboMsg.duracao;
      if (tc >= 1) {
        _dcComboMsg = null;
      } else {
        var escalaMsg = 1, alphaMsg = 1;
        if (tc < 0.2) { escalaMsg = Math.max(0.01, _dcEaseOutBack(tc / 0.2)); }
        else if (tc > 0.7) { alphaMsg = 1 - (tc - 0.7) / 0.3; }
        ctx.save();
        ctx.globalAlpha = Math.max(0, alphaMsg);
        ctx.translate(w / 2, h * 0.4);
        ctx.scale(escalaMsg, escalaMsg);
        ctx.font = '800 ' + Math.round(w * 0.095) + 'px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.strokeText(_dcComboMsg.texto, 0, 0);
        ctx.fillStyle = _dcComboMsg.cor || '#fff';
        ctx.fillText(_dcComboMsg.texto, 0, 0);
        ctx.restore();
      }
    }
  }
  function _dcCaminhoArredondado(ctx, x, y, w, h, raio) {
    ctx.beginPath();
    ctx.moveTo(x + raio, y);
    ctx.arcTo(x + w, y, x + w, y + h, raio);
    ctx.arcTo(x + w, y + h, x, y + h, raio);
    ctx.arcTo(x, y + h, x, y, raio);
    ctx.arcTo(x, y, x + w, y, raio);
    ctx.closePath();
  }

  function _dcFeedbackInvalido(i1, i2) {
    var s = _som(); if (s) s.erro();
    var agora = performance.now();
    _dcShakeAnim[i1] = { t0: agora };
    _dcShakeAnim[i2] = { t0: agora };
  }

  // ── Seleção/arraste (Pointer Events cobrem mouse e toque) ──
  var _DC_LIMIAR_SWIPE = 18;

  function _dcSelecionar(r, c) {
    _dcSelecionado = { r: r, c: c };
    var s = _som(); if (s) s.toque();
  }
  function _dcLimparSelecao() {
    _dcSelecionado = null;
  }
  function _dcAdjacente(a, b) {
    return (Math.abs(a.r - b.r) + Math.abs(a.c - b.c)) === 1;
  }
  function _dcTratarTap(r, c) {
    if (!_dcSelecionado) { _dcSelecionar(r, c); return; }
    if (_dcSelecionado.r === r && _dcSelecionado.c === c) { _dcLimparSelecao(); return; }
    if (_dcAdjacente(_dcSelecionado, { r: r, c: c })) {
      var sel = _dcSelecionado;
      _dcLimparSelecao();
      _dcTentarTrocar(sel.r, sel.c, r, c);
    } else {
      _dcSelecionar(r, c);
    }
  }

  // Converte coordenada de tela (clientX/clientY) em célula (r,c) do
  // canvas — substitui o listener por-célula que existia quando o
  // tabuleiro era feito de divs.
  function _dcCanvasParaCelula(clientX, clientY) {
    if (!_dcCanvas) return null;
    var layout = _dcObterLayout();
    var x = clientX - layout.rect.left - layout.pad;
    var y = clientY - layout.rect.top - layout.pad;
    if (x < 0 || y < 0) return null;
    var c = Math.floor(x / layout.passo), r = Math.floor(y / layout.passo);
    if (r < 0 || r >= _DC_TAM || c < 0 || c >= _DC_TAM) return null;
    if ((x - c * layout.passo) > layout.cellPx || (y - r * layout.passo) > layout.cellPx) return null; // caiu no vão entre células
    if (!_dcCelulaAtiva(r * _DC_TAM + c)) return null; // buraco do formato do tabuleiro
    return { r: r, c: c };
  }

  function _dcCanvasPointerDown(e) {
    if (!_dcRodando || _dcAnimando) return;
    var cel = _dcCanvasParaCelula(e.clientX, e.clientY);
    if (!cel) return;
    e.preventDefault();
    try { _dcCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    var estado = { r: cel.r, c: cel.c, x0: e.clientX, y0: e.clientY, resolvido: false };
    _dcArraste = estado;

    function mover(ev) {
      if (estado.resolvido) return;
      var dx = ev.clientX - estado.x0, dy = ev.clientY - estado.y0;
      if (Math.abs(dx) < _DC_LIMIAR_SWIPE && Math.abs(dy) < _DC_LIMIAR_SWIPE) return;
      ev.preventDefault();
      estado.resolvido = true;
      var dr = 0, dc = 0;
      if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1; else dr = dy > 0 ? 1 : -1;
      _dcLimparSelecao();
      _dcTentarTrocar(estado.r, estado.c, estado.r + dr, estado.c + dc);
    }
    function soltar() {
      _dcCanvas.removeEventListener('pointermove', mover);
      _dcCanvas.removeEventListener('pointerup', soltar);
      _dcCanvas.removeEventListener('pointercancel', soltar);
      _dcArraste = null;
      if (!estado.resolvido) _dcTratarTap(estado.r, estado.c);
    }
    _dcCanvas.addEventListener('pointermove', mover);
    _dcCanvas.addEventListener('pointerup', soltar);
    _dcCanvas.addEventListener('pointercancel', soltar);
  }

  // ── Troca + cascata ─────────────────────────────────────────
  // Antes a troca só existia no dado (a tela redesenhava já trocada
  // ou já desfeita, sem meio-termo visual — "teletransportava"). Agora
  // anima o deslizar das duas peças ANTES de decidir se formou
  // combinação; se não formou, desliza de volta (com "reversa") e só
  // então treme, igual ao Candy Crush.
  function _dcTentarTrocar(r1, c1, r2, c2) {
    if (!_dcRodando || _dcAnimando) return;
    if (r2 < 0 || r2 >= _DC_TAM || c2 < 0 || c2 >= _DC_TAM) return;
    var i1 = r1 * _DC_TAM + c1, i2 = r2 * _DC_TAM + c2;
    if (!_dcCelulaAtiva(i1) || !_dcCelulaAtiva(i2)) return; // buraco no tabuleiro: sem doce ali
    // (gelo não bloqueia mais a troca — ver comentário em _dcTrocaFormaMatch)

    _dcAnimando = true;
    _dcTrocaAnim = { i1: i1, i2: i2, t0: performance.now(), duracao: _DC_DUR_TROCA };
    setTimeout(function () {
      _dcTrocaAnim = null;
      _dcTrocarCelulas(i1, i2);
      var tipo1 = _dcTipo[i1], tipo2 = _dcTipo[i2];
      // Trocar um doce especial (mesmo sem formar combinação de cor) SEMPRE
      // ativa o efeito dele — igual ao Candy Crush: arrastar um listrado ou
      // uma bomba de cor pra qualquer lado dispara o efeito na hora.
      var especial = tipo1 > 0 || tipo2 > 0;
      var resultado = _dcEncontrarMatches();
      if (resultado.marcado.indexOf(true) === -1 && !especial) {
        // não formou combinação nem envolveu especial: desfaz e desliza de volta
        _dcTrocarCelulas(i1, i2);
        _dcTrocaAnim = { i1: i1, i2: i2, t0: performance.now(), duracao: _DC_DUR_TROCA, reversa: true };
        setTimeout(function () {
          _dcTrocaAnim = null;
          _dcAnimando = false;
          _dcFeedbackInvalido(i1, i2);
        }, _DC_DUR_TROCA);
        return;
      }

      if (especial) {
        var ativados = _dcAtivarEspeciaisSwap(i1, i2, tipo1, tipo2);
        ativados.forEach(function (idx) { resultado.marcado[idx] = true; });
      }

      _dcMovimentosRestantes = Math.max(0, _dcMovimentosRestantes - 1);
      _dcAtualizarHud();
      _dcAnimando = false;
      _dcResolverCascata({ prefCel: i2, resultadoInicial: resultado });
    }, _DC_DUR_TROCA);
  }

  // Mensagens tipo "Delicioso!"/"Combo x2!" — só aparecem em jogadas
  // grandes (4+ na mesma combinação, ou cascata com 2+ passos seguidos
  // vindos da mesma troca), pra não virar poluição visual num match
  // comum de 3.
  var _DC_MENSAGENS_RUN = { 4: ['Delicioso!', '#4ade80'], 5: ['Sensacional!', '#38bdf8'], 6: ['Incrível!', '#fb7185'] };
  // Mensagem mostrada assim que um doce especial nasce numa combinação.
  var _DC_MENSAGENS_ESPECIAL = {
    1: ['Listrado!', '#38bdf8'],
    2: ['Listrado!', '#38bdf8'],
    3: ['Embrulhado!', '#a855f7'],
    4: ['Bomba de cor!', '#fb7185']
  };
  function _dcMostrarComboMsg(texto, cor) {
    _dcComboMsg = { texto: texto, cor: cor, t0: performance.now(), duracao: _DC_DUR_COMBO };
  }
  // `opts.prefCel` (opcional): célula de destino da troca do jogador, só
  // usada no 1º passo, pra um doce especial recém-criado nascer onde o
  // jogador arrastou. `opts.resultadoInicial` (opcional): resultado já
  // calculado por _dcTentarTrocar (evita recalcular e permite incluir
  // células ativadas por troca direta com um especial).
  function _dcResolverCascata(opts) {
    _dcAnimando = true;
    var passosNestaTroca = 0, maiorRunNestaTroca = 0;
    var prefCel = (opts && opts.prefCel != null) ? opts.prefCel : null;
    var resultadoForcado = (opts && opts.resultadoInicial) ? opts.resultadoInicial : null;
    function passo() {
      var resultado = resultadoForcado || _dcEncontrarMatches();
      resultadoForcado = null;
      if (resultado.marcado.indexOf(true) === -1) {
        _dcAnimando = false;
        if (passosNestaTroca >= 2) {
          _dcMostrarComboMsg('Combo x' + passosNestaTroca + '!', '#fbbf24');
        } else if (maiorRunNestaTroca >= 4) {
          var msg = _DC_MENSAGENS_RUN[Math.min(6, maiorRunNestaTroca)];
          _dcMostrarComboMsg(msg[0], msg[1]);
        }
        _dcAposCascata();
        return;
      }
      passosNestaTroca++;
      // Reação em cadeia: especiais já existentes pegos nesta combinação
      // disparam seu próprio efeito (expande o conjunto marcado).
      _dcExpandirMarcado(resultado.marcado);
      // Decide se alguma célula desta combinação vira um doce especial
      // novo em vez de simplesmente sumir.
      var criar = _dcAnalisarResultado(resultado, prefCel);
      prefCel = null;
      if (criar.length) {
        var msgEsp = _DC_MENSAGENS_ESPECIAL[criar[criar.length - 1].tipo];
        if (msgEsp) _dcMostrarComboMsg(msgEsp[0], msgEsp[1]);
      }
      // 1) "Explode" as células combinadas antes de sumirem — sem isso a
      // troca parecia teletransporte (uma cor some, outra já aparece no
      // lugar sem nenhuma ligação visual entre as duas).
      var s = _som(); if (s) s.combo();
      var fx = window.AngatubaGames && window.AngatubaGames.efeitos;
      var opcoesFx = _dcSpritesMatch ? { sprites: _dcSpritesMatch } : undefined;
      var agora = performance.now();
      resultado.runs.forEach(function (run) {
        maiorRunNestaTroca = Math.max(maiorRunNestaTroca, run.cells.length);
        var meio = run.cells[Math.floor(run.cells.length / 2)];
        if (fx && fx.estrelas) {
          var p = _dcCentroCelulaTela(meio);
          if (p) fx.estrelas(p.x, p.y, undefined, opcoesFx);
        }
      });
      resultado.marcado.forEach(function (m, idx) {
        if (m) _dcPopAnim[idx] = { t0: agora };
      });
      setTimeout(function () {
        resultado.marcado.forEach(function (m, idx) { if (m) delete _dcPopAnim[idx]; });
        // 2) só depois da explosão os doces de cima caem no lugar —
        // com animação de queda em vez de troca instantânea de cor.
        _dcProcessarMarcados(resultado, criar);
        var quedas = _dcAplicarGravidadeComQuedas();
        _dcAtualizarHud();
        var agora2 = performance.now();
        quedas.forEach(function (q) { _dcQuedaAnim[q.idx] = { t0: agora2, filas: q.filas }; });
        setTimeout(passo, 300);
      }, _DC_DUR_POP);
    }
    passo();
  }

  function _dcAposCascata() {
    if (_dcObjetivoAtingido()) { _dcFimFase(true); return; }
    if (_dcMovimentosRestantes <= 0) { _dcFimFase(false); return; }
    if (!_dcExisteMovimentoValido()) _dcEmbaralhar();
  }

  function _dcAtualizarHud() {
    var faseEl = document.getElementById('dc-fase'); if (faseEl) faseEl.textContent = _dcFaseAtual;
    var recEl = document.getElementById('dc-recorde'); if (recEl) recEl.textContent = _dcRecordeGet();
    var movEl = document.getElementById('dc-movimentos'); if (movEl) movEl.textContent = _dcMovimentosRestantes;
    var pontosEl = document.getElementById('dc-pontos'); if (pontosEl) pontosEl.textContent = _dcPontosFase;
    var objEl = document.getElementById('dc-objetivo-texto'); if (objEl) objEl.textContent = _dcObjetivoTexto();
    var progEl = document.getElementById('dc-objetivo-progresso'); if (progEl) progEl.textContent = _dcObjetivoProgresso();
  }
  function _dcMostrarOverlay(nome) {
    var inicio = document.getElementById('dc-inicio');
    var fim = document.getElementById('dc-fim');
    if (inicio) inicio.style.display = (nome === 'inicio') ? 'flex' : 'none';
    if (fim) fim.style.display = (nome === 'fim') ? 'flex' : 'none';
  }

  // ── Início / fim de fase ────────────────────────────────────
  function _dcIniciarFase(fase) {
    _dcFaseAtual = Math.max(1, fase);
    var cfg = _dcConfigFase(_dcFaseAtual);
    _dcObjetivo = { tipo: cfg.tipo, meta: cfg.meta, corAlvo: cfg.corAlvo };
    _dcMovimentosRestantes = cfg.movimentos;
    _dcPontosFase = 0; _dcMatchesCorFase = 0; _dcObstaculosQuebrados = 0;
    _dcRng = _dcMulberry32(2000 + _dcFaseAtual * 131);
    _dcFormato = _dcGerarFormato(_dcFaseAtual);
    _dcAplicarTemaFase(_dcFaseAtual);
    _dcComboMsg = null;

    var tentativas = 0;
    do {
      _dcGerarTabuleiroInicial();
      _dcColocarGelo(cfg.qtdGelo);
      tentativas++;
    } while (!_dcExisteMovimentoValido() && tentativas < 6);

    _dcRodando = true;
    _dcAnimando = false;
    _dcSelecionado = null;
    _dcQuedaAnim = {}; _dcPopAnim = {}; _dcPousoAnim = {}; _dcShakeAnim = {}; _dcTrocaAnim = null;
    _dcAtualizarHud();
  }

  function _dcFimFase(venceu) {
    _dcRodando = false;
    _dcUltimoResultado = venceu ? 'venceu' : 'perdeu';
    var s = _som();
    if (venceu) {
      if (_dcFaseAtual > _dcRecordeGet()) _dcRecordeSet(_dcFaseAtual);
      if (s) s.fim(true);
      if (window.AngatubaGames && window.AngatubaGames.efeitos) window.AngatubaGames.efeitos.confete('dc-card');
    } else if (s) { s.fim(false); }
    var recorde = _dcRecordeGet();

    var owl = document.getElementById('dc-fim-owl');
    var tit = document.getElementById('dc-fim-titulo');
    var msg = document.getElementById('dc-fim-msg');
    var btn = document.getElementById('dc-fim-btn');
    if (owl) { owl.src = venceu ? '/webp/owl-celebrate-pro.webp' : '/webp/owl-angry.webp'; owl.style.display = ''; }
    if (tit) tit.textContent = venceu ? ('Fase ' + _dcFaseAtual + ' concluída! 🎉') : 'Movimentos esgotados!';
    if (msg) {
      msg.textContent = venceu
        ? ('Você fez ' + _dcPontosFase + ' pontos nesta fase. Bora pra próxima?')
        : ('Você chegou até a fase ' + _dcFaseAtual + ' com ' + _dcPontosFase + ' pontos nesta tentativa. Tenta de novo!');
    }
    if (btn) btn.textContent = venceu ? 'Próxima fase' : 'Tentar de novo';
    var recEl = document.getElementById('dc-recorde'); if (recEl) recEl.textContent = recorde;

    _dcMostrarOverlay('fim');

    if (window.AngatubaGames) {
      window.AngatubaGames.rankSubmeter('doces', recorde);
      window.AngatubaGames.rankFimDeJogo('doces', 'dc-rank-slot', recorde);
    }
  }

  function _dcBotaoPrincipal() {
    if (_dcUltimoResultado === 'venceu') _dcProximaFase(); else _dcRetry();
  }
  function _dcComecar() {
    _dcMostrarOverlay(null);
    _dcIniciarFase(_dcRecordeGet() + 1);
  }
  function _dcProximaFase() {
    _dcMostrarOverlay(null);
    _dcIniciarFase(_dcFaseAtual + 1);
  }
  function _dcRetry() {
    _dcMostrarOverlay(null);
    _dcIniciarFase(_dcFaseAtual);
  }

  // ── Preparação da tela (chamada pelo _jogoLoader ao abrir) ──
  function _dcPrepararTela() {
    _dcCanvas = document.getElementById('dc-grid');
    if (_dcCanvas && !_dcCanvas._dcPronto) {
      _dcCanvas._dcPronto = true;
      _dcCtx = _dcCanvas.getContext('2d');
      _dcCanvas.addEventListener('pointerdown', _dcCanvasPointerDown);
      window.addEventListener('resize', _dcAjustarResolucaoCanvas);
    }
    _dcCarregarImagens();
    _dcCarregarSpritesMatch();
    try {
      var corBorda = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
      if (corBorda) _dcCorBorda = corBorda;
    } catch (e) {}
    _dcAjustarResolucaoCanvas();
    if (!_dcTelaAberta) {
      _dcTelaAberta = true;
      requestAnimationFrame(_dcDesenharFrame);
    }
    _dcRodando = false;
    _dcAnimando = false;
    _dcArraste = null;
    _dcSelecionado = null;
    var recorde = _dcRecordeGet();
    var faseIni = document.getElementById('dc-fase-inicio'); if (faseIni) faseIni.textContent = (recorde + 1);
    var recIni = document.getElementById('dc-recorde-inicio'); if (recIni) recIni.textContent = recorde;
    _dcAplicarTemaFase(recorde + 1);
    _dcAtualizarHud();
    _dcMostrarOverlay('inicio');
    // A tela pode ter acabado de virar visível (display:none -> flex)
    // agora mesmo; um frame depois o tamanho real já está disponível.
    requestAnimationFrame(_dcAjustarResolucaoCanvas);
  }
  function _dcParar() {
    _dcRodando = false;
    _dcAnimando = false;
    _dcArraste = null;
    _dcTelaAberta = false; // para o loop de desenho (economiza bateria fora da tela)
  }

  window._dcComecar = _dcComecar;
  window._dcProximaFase = _dcProximaFase;
  window._dcRetry = _dcRetry;
  window._dcBotaoPrincipal = _dcBotaoPrincipal;

  // API pública consumida pelo loader do app (_jogoLoader).
  window.DocesGame = {
    preparar: _dcPrepararTela,
    comecar: _dcComecar,
    parar: _dcParar
  };
})();
