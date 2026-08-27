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

  // ── Estado do jogo (igual a antes) ─────────────────────────
  var _dcCor = [];                // 64 posições: 1..5 = cor do doce
  var _dcGelo = [];               // 64 posições: 0 = normal, 1-2 = hits restantes
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

  // Encontra todas as combinações de 3+ (linhas e colunas). Retorna
  // { marcado: bool[64], runs: [{cor, cells:[idx,...]}] }.
  function _dcEncontrarMatches() {
    var marcado = new Array(_DC_TAM * _DC_TAM).fill(false);
    var runs = [], r, c, i;
    for (r = 0; r < _DC_TAM; r++) {
      var run = 1;
      for (c = 1; c <= _DC_TAM; c++) {
        var atual = c < _DC_TAM ? _dcCor[r * _DC_TAM + c] : -1;
        var anterior = _dcCor[r * _DC_TAM + (c - 1)];
        if (c < _DC_TAM && atual === anterior) { run++; }
        else {
          if (run >= 3) {
            var cells = [];
            for (i = c - run; i < c; i++) { cells.push(r * _DC_TAM + i); marcado[r * _DC_TAM + i] = true; }
            runs.push({ cor: anterior, cells: cells });
          }
          run = 1;
        }
      }
    }
    for (c = 0; c < _DC_TAM; c++) {
      var runV = 1;
      for (r = 1; r <= _DC_TAM; r++) {
        var atualV = r < _DC_TAM ? _dcCor[r * _DC_TAM + c] : -1;
        var anteriorV = _dcCor[(r - 1) * _DC_TAM + c];
        if (r < _DC_TAM && atualV === anteriorV) { runV++; }
        else {
          if (runV >= 3) {
            var cellsV = [];
            for (i = r - runV; i < r; i++) { cellsV.push(i * _DC_TAM + c); marcado[i * _DC_TAM + c] = true; }
            runs.push({ cor: anteriorV, cells: cellsV });
          }
          runV = 1;
        }
      }
    }
    return { marcado: marcado, runs: runs };
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
        var sobreviventes = []; // {origRow, cor}, do topo pra baixo, só deste pedaço
        for (var rr = rIni; rr <= rFim; rr++) {
          var idxRr = rr * _DC_TAM + c;
          if (_dcCor[idxRr] !== 0) sobreviventes.push({ origRow: rr, cor: _dcCor[idxRr] });
        }
        var novos = tamPedaco - sobreviventes.length;
        for (var i = 0; i < tamPedaco; i++) {
          var linhaAtual = rIni + i;
          var idx2 = linhaAtual * _DC_TAM + c;
          if (i < novos) {
            _dcCor[idx2] = _dcNovaCor();
            quedas.push({ idx: idx2, filas: novos - i });
          } else {
            var sv = sobreviventes[i - novos];
            _dcCor[idx2] = sv.cor;
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
  function _dcProcessarMarcados(resultado) {
    resultado.runs.forEach(function (run) {
      _dcPontosFase += run.cells.length * 10;
      if (_dcObjetivo && _dcObjetivo.tipo === 'cor' && run.cor === _dcObjetivo.corAlvo) {
        _dcMatchesCorFase++;
      }
    });
    resultado.marcado.forEach(function (m, idx) {
      if (!m) return;
      if (_dcGelo[idx] > 0) {
        _dcGelo[idx]--;
        if (_dcGelo[idx] === 0) _dcObstaculosQuebrados++;
      }
      _dcCor[idx] = 0;
    });
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
  function _dcDesenharDoce(ctx, cx, cy, raio, corIdx, gelo, escala, alpha, offsetX) {
    if (!corIdx) return; // 0/undefined = célula vazia (transitório)
    var r = raio * (escala == null ? 1 : escala);
    if (r <= 0) return;
    var x = cx + (offsetX || 0);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
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
    if (gelo && _dcImgs.gelo) {
      ctx.globalAlpha = (alpha == null ? 1 : alpha) * (gelo === 2 ? 1 : 0.55);
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
        _dcDesenharDoce(ctx, cx, cy + offY, raio, _dcCor[idx], _dcGelo[idx], escala * (escalaY), alpha, offX);
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
      var tmp = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tmp;
      var resultado = _dcEncontrarMatches();
      if (resultado.marcado.indexOf(true) === -1) {
        // não formou combinação: desfaz o dado e desliza de volta
        tmp = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tmp;
        _dcTrocaAnim = { i1: i1, i2: i2, t0: performance.now(), duracao: _DC_DUR_TROCA, reversa: true };
        setTimeout(function () {
          _dcTrocaAnim = null;
          _dcAnimando = false;
          _dcFeedbackInvalido(i1, i2);
        }, _DC_DUR_TROCA);
        return;
      }

      _dcMovimentosRestantes = Math.max(0, _dcMovimentosRestantes - 1);
      _dcAtualizarHud();
      _dcAnimando = false;
      _dcResolverCascata();
    }, _DC_DUR_TROCA);
  }

  // Mensagens tipo "Delicioso!"/"Combo x2!" — só aparecem em jogadas
  // grandes (4+ na mesma combinação, ou cascata com 2+ passos seguidos
  // vindos da mesma troca), pra não virar poluição visual num match
  // comum de 3.
  var _DC_MENSAGENS_RUN = { 4: ['Delicioso!', '#4ade80'], 5: ['Sensacional!', '#38bdf8'], 6: ['Incrível!', '#fb7185'] };
  function _dcMostrarComboMsg(texto, cor) {
    _dcComboMsg = { texto: texto, cor: cor, t0: performance.now(), duracao: _DC_DUR_COMBO };
  }
  function _dcResolverCascata() {
    _dcAnimando = true;
    var passosNestaTroca = 0, maiorRunNestaTroca = 0;
    function passo() {
      var resultado = _dcEncontrarMatches();
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
      // 1) "Explode" as células combinadas antes de sumirem — sem isso a
      // troca parecia teletransporte (uma cor some, outra já aparece no
      // lugar sem nenhuma ligação visual entre as duas).
      var s = _som(); if (s) s.combo();
      var fx = window.AngatubaGames && window.AngatubaGames.efeitos;
      var agora = performance.now();
      resultado.runs.forEach(function (run) {
        maiorRunNestaTroca = Math.max(maiorRunNestaTroca, run.cells.length);
        var meio = run.cells[Math.floor(run.cells.length / 2)];
        if (fx && fx.estrelas) {
          var p = _dcCentroCelulaTela(meio);
          if (p) fx.estrelas(p.x, p.y);
        }
      });
      resultado.marcado.forEach(function (m, idx) {
        if (m) _dcPopAnim[idx] = { t0: agora };
      });
      setTimeout(function () {
        resultado.marcado.forEach(function (m, idx) { if (m) delete _dcPopAnim[idx]; });
        // 2) só depois da explosão os doces de cima caem no lugar —
        // com animação de queda em vez de troca instantânea de cor.
        _dcProcessarMarcados(resultado);
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
