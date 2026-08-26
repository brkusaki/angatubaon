/* ═══════════════════════════════════════════════════════════════
   BLOCOS DA CORUJA (block puzzle estilo Block Blast/1010!) — módulo
   de jogo (lazy-loaded). Carregado sob demanda por /Jogos/ quando o
   usuário abre o jogo. Comunica-se com o app APENAS via
   window.AngatubaGames (a ponte). Expõe
   window.BlocosGame = { preparar, comecar, parar }.

   Mecânica: grade 8×8, o jogador recebe 3 peças por vez e as
   arrasta (Pointer Events — funciona com mouse e toque) até a
   grade. Linhas/colunas completas são limpas e valem pontos.
   Fases têm objetivo (pontos, linhas limpas ou rodadas
   sobrevividas) gerado por fórmula a partir do número da fase —
   não há fases desenhadas à mão. O ranking usa a MAIOR FASE
   CONCLUÍDA (inteiro), guardada localmente em
   'angatuba_blocos_fase' e reconciliada no Firestore via
   AngatubaGames.rankSubmeter/rankFimDeJogo.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Atalho pra fachada de som da ponte (no-op quando mudo ou não carregou).
  function _som() {
    return (window.AngatubaGames && window.AngatubaGames.som) || null;
  }

  var _BB_TAM = 8;                 // grade 8×8
  var _bbCores = ['#a855f7', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#22d3ee'];

  // ── Formas das peças (offsets [linha,coluna] a partir de [0,0]) ──
  // t = "tier" de dificuldade: 1 pequena, 2 média, 3 grande/incômoda.
  var _BB_FORMAS = [
    { cel: [[0, 0]], t: 1 },
    { cel: [[0, 0], [0, 1]], t: 1 },
    { cel: [[0, 0], [1, 0]], t: 1 },
    { cel: [[0, 0], [0, 1], [0, 2]], t: 1 },
    { cel: [[0, 0], [1, 0], [2, 0]], t: 1 },
    { cel: [[0, 0], [0, 1], [1, 0], [1, 1]], t: 1 },      // quadrado 2×2
    { cel: [[0, 0], [1, 0], [1, 1]], t: 1 },              // tromino L
    { cel: [[0, 0], [0, 1], [1, 1]], t: 1 },              // tromino L espelhado
    { cel: [[0, 0], [0, 1], [0, 2], [0, 3]], t: 2 },      // I4 horizontal
    { cel: [[0, 0], [1, 0], [2, 0], [3, 0]], t: 2 },      // I4 vertical
    { cel: [[0, 0], [1, 0], [2, 0], [2, 1]], t: 2 },      // L
    { cel: [[0, 1], [1, 1], [2, 1], [2, 0]], t: 2 },      // J
    { cel: [[0, 0], [0, 1], [1, 1], [1, 2]], t: 2 },      // S
    { cel: [[0, 1], [0, 2], [1, 0], [1, 1]], t: 2 },      // Z
    { cel: [[0, 0], [0, 1], [0, 2], [1, 1]], t: 2 },      // T
    { cel: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], t: 2 }, // bloco 2×3
    { cel: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], t: 3 }, // I5 horizontal
    { cel: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], t: 3 }, // I5 vertical
    { cel: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]], t: 3 }, // cruz (+)
    { cel: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], t: 3 }, // L grande
    { cel: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], t: 3 }  // L grande espelhado
  ];

  // ── Estado ────────────────────────────────────────────────
  var _bbGrid = [];               // 64 posições: 0 vazio, 1..N cor
  var _bbFaseAtual = 1;
  var _bbObjetivo = null;         // { tipo: 'pontos'|'linhas'|'sobreviver', meta }
  var _bbPontosFase = 0;
  var _bbLinhasFase = 0;
  var _bbRodadasFase = 0;
  var _bbTray = [null, null, null];
  var _bbRng = null;
  var _bbRodando = false;
  var _bbUltimoResultado = null;  // 'venceu' | 'perdeu'
  var _bbCelEls = null;
  var _bbTrayEls = null;
  var _bbArrastando = null;

  // ── localStorage: maior fase JÁ CONCLUÍDA ──────────────────
  function _bbRecordeGet() {
    try { return Math.max(0, Math.round(Number(localStorage.getItem('angatuba_blocos_fase')) || 0)); }
    catch (e) { return 0; }
  }
  function _bbRecordeSet(v) {
    try { localStorage.setItem('angatuba_blocos_fase', String(v)); } catch (e) {}
  }

  // ── PRNG determinístico (mulberry32) — mesma fase = mesma
  // sequência de peças e o mesmo preenchimento inicial, mesmo
  // depois de um "retry" (só muda se o jogador avançar de fase). ──
  function _bbMulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Dificuldade progressiva: pesos por "tier" de peça e
  // configuração de objetivo/preenchimento inicial por fase. ──
  function _bbPesosPorFase(fase) {
    var prog = Math.min(1, (fase - 1) / 24);
    return { 1: Math.max(0.15, 0.60 - 0.45 * prog), 2: 0.30 + 0.10 * prog, 3: 0.10 + 0.35 * prog };
  }
  function _bbEscolherFormaBase(rng, fase) {
    var pesos = _bbPesosPorFase(fase);
    var total = 0, i;
    for (i = 0; i < _BB_FORMAS.length; i++) total += pesos[_BB_FORMAS[i].t];
    var r = rng() * total;
    for (i = 0; i < _BB_FORMAS.length; i++) {
      r -= pesos[_BB_FORMAS[i].t];
      if (r <= 0) return _BB_FORMAS[i];
    }
    return _BB_FORMAS[_BB_FORMAS.length - 1];
  }
  function _bbNovaPeca() {
    var base = _bbEscolherFormaBase(_bbRng, _bbFaseAtual);
    return { cel: base.cel, cor: 1 + Math.floor(_bbRng() * _bbCores.length) };
  }

  // Objetivo alterna entre os 3 tipos a cada fase; metas e o
  // preenchimento inicial da grade sobem com o número da fase.
  function _bbConfigFase(fase) {
    var tipos = ['pontos', 'linhas', 'sobreviver'];
    var tipo = tipos[(fase - 1) % 3];
    var meta;
    if (tipo === 'pontos') meta = 250 + (fase - 1) * 130;
    else if (tipo === 'linhas') meta = 3 + Math.floor((fase - 1) / 2);
    else meta = 6 + Math.floor((fase - 1) / 2);
    var prefill = Math.min(26, Math.floor((fase - 1) / 2) * 3);
    return { tipo: tipo, meta: meta, prefill: prefill };
  }

  function _bbObjetivoTexto() {
    if (!_bbObjetivo) return '—';
    if (_bbObjetivo.tipo === 'pontos') return 'Alcance ' + _bbObjetivo.meta + ' pontos';
    if (_bbObjetivo.tipo === 'linhas') return 'Limpe ' + _bbObjetivo.meta + (_bbObjetivo.meta === 1 ? ' linha' : ' linhas');
    return 'Sobreviva ' + _bbObjetivo.meta + (_bbObjetivo.meta === 1 ? ' rodada' : ' rodadas') + ' de peças';
  }
  function _bbObjetivoProgresso() {
    if (!_bbObjetivo) return '0/0';
    if (_bbObjetivo.tipo === 'pontos') return Math.min(_bbPontosFase, _bbObjetivo.meta) + '/' + _bbObjetivo.meta;
    if (_bbObjetivo.tipo === 'linhas') return Math.min(_bbLinhasFase, _bbObjetivo.meta) + '/' + _bbObjetivo.meta;
    return Math.min(_bbRodadasFase, _bbObjetivo.meta) + '/' + _bbObjetivo.meta;
  }
  function _bbObjetivoAtingido() {
    if (!_bbObjetivo) return false;
    if (_bbObjetivo.tipo === 'pontos') return _bbPontosFase >= _bbObjetivo.meta;
    if (_bbObjetivo.tipo === 'linhas') return _bbLinhasFase >= _bbObjetivo.meta;
    return _bbRodadasFase >= _bbObjetivo.meta;
  }

  // ── Preenche N células aleatórias no início da fase, sem
  // nunca completar uma linha/coluna inteira de saída. ──────
  function _bbPrefill(qtd) {
    var colocados = 0, tentativas = 0, max = Math.max(40, qtd * 25);
    while (colocados < qtd && tentativas < max) {
      tentativas++;
      var idx = Math.floor(_bbRng() * _BB_TAM * _BB_TAM);
      if (_bbGrid[idx] !== 0) continue;
      var r = Math.floor(idx / _BB_TAM), c = idx % _BB_TAM, cc, rr;
      _bbGrid[idx] = -1; // marca temporária pra testar a linha/coluna
      var completaLinha = true, completaCol = true;
      for (cc = 0; cc < _BB_TAM; cc++) { if (_bbGrid[r * _BB_TAM + cc] === 0) { completaLinha = false; break; } }
      for (rr = 0; rr < _BB_TAM; rr++) { if (_bbGrid[rr * _BB_TAM + c] === 0) { completaCol = false; break; } }
      if (completaLinha || completaCol) { _bbGrid[idx] = 0; continue; }
      _bbGrid[idx] = 1 + Math.floor(_bbRng() * _bbCores.length);
      colocados++;
    }
  }

  // ── Regras de encaixe / limpeza ────────────────────────────
  function _bbFormaCabeEm(peca, anchorRow, anchorCol) {
    for (var i = 0; i < peca.cel.length; i++) {
      var rr = anchorRow + peca.cel[i][0], cc = anchorCol + peca.cel[i][1];
      if (rr < 0 || rr >= _BB_TAM || cc < 0 || cc >= _BB_TAM) return false;
      if (_bbGrid[rr * _BB_TAM + cc] !== 0) return false;
    }
    return true;
  }
  function _bbPecaCabeEmAlgumLugar(peca) {
    for (var r = 0; r < _BB_TAM; r++) {
      for (var c = 0; c < _BB_TAM; c++) {
        if (_bbFormaCabeEm(peca, r, c)) return true;
      }
    }
    return false;
  }
  function _bbSemEspaco() {
    var pendentes = _bbTray.filter(function (p) { return p; });
    if (!pendentes.length) return false;
    for (var i = 0; i < pendentes.length; i++) {
      if (_bbPecaCabeEmAlgumLugar(pendentes[i])) return false;
    }
    return true;
  }
  function _bbLimparLinhasCompletas() {
    var linhas = [], colunas = [], r, c;
    for (r = 0; r < _BB_TAM; r++) {
      var full = true;
      for (c = 0; c < _BB_TAM; c++) { if (_bbGrid[r * _BB_TAM + c] === 0) { full = false; break; } }
      if (full) linhas.push(r);
    }
    for (c = 0; c < _BB_TAM; c++) {
      var fullc = true;
      for (r = 0; r < _BB_TAM; r++) { if (_bbGrid[r * _BB_TAM + c] === 0) { fullc = false; break; } }
      if (fullc) colunas.push(c);
    }
    linhas.forEach(function (rr) { for (var cc = 0; cc < _BB_TAM; cc++) _bbGrid[rr * _BB_TAM + cc] = 0; });
    colunas.forEach(function (cc) { for (var rr = 0; rr < _BB_TAM; rr++) _bbGrid[rr * _BB_TAM + cc] = 0; });
    return linhas.length + colunas.length;
  }

  // ── DOM: grade (criada 1x, só atualiza classes/cor depois) ──
  function _bbCriarGridDOM() {
    var grid = document.getElementById('bb-grid');
    if (!grid || grid._bbPronto) return;
    grid._bbPronto = true;
    grid.innerHTML = '';
    _bbCelEls = [];
    for (var i = 0; i < _BB_TAM * _BB_TAM; i++) {
      var el = document.createElement('div');
      el.className = 'bb-cel';
      grid.appendChild(el);
      _bbCelEls.push(el);
    }
  }
  function _bbRenderGrid() {
    if (!_bbCelEls) return;
    for (var i = 0; i < _bbCelEls.length; i++) {
      var v = _bbGrid[i], el = _bbCelEls[i];
      el.classList.remove('bb-preview-ok', 'bb-preview-bad');
      if (v > 0) { el.classList.add('bb-cheia'); el.style.background = _bbCores[v - 1]; }
      else { el.classList.remove('bb-cheia'); el.style.background = ''; }
    }
  }

  // ── DOM: bandeja de peças (3 slots fixos; conteúdo é
  // reconstruído a cada rodada, mas o slot/listener persiste). ──
  function _bbCriarTrayDOM() {
    var tray = document.getElementById('bb-tray');
    if (!tray || tray._bbPronto) return;
    tray._bbPronto = true;
    tray.innerHTML = '';
    _bbTrayEls = [];
    for (var i = 0; i < 3; i++) {
      var slot = document.createElement('div');
      slot.className = 'bb-peca';
      (function (idx) {
        slot.addEventListener('pointerdown', function (e) { _bbIniciarArraste(e, idx); });
      })(i);
      tray.appendChild(slot);
      _bbTrayEls.push(slot);
    }
  }
  function _bbRenderTray() {
    if (!_bbTrayEls) return;
    for (var i = 0; i < 3; i++) {
      var slot = _bbTrayEls[i], peca = _bbTray[i];
      slot.innerHTML = '';
      if (!peca) { slot.classList.add('bb-peca-vazia'); continue; }
      slot.classList.remove('bb-peca-vazia');
      var maxR = 0, maxC = 0;
      peca.cel.forEach(function (o) { if (o[0] > maxR) maxR = o[0]; if (o[1] > maxC) maxC = o[1]; });
      var cols = maxC + 1, rows = maxR + 1;
      // Fix: usava 1fr dentro de uma caixa quadrada fixa (64×64), então uma
      // peça 1×4 (uma barra EM PÉ) saía esticada em 4 tiras DEITADAS bem
      // finas — o formato na bandeja não batia com o formato real da peça.
      // Calcula um tamanho de célula em px que mantém as células quadradas,
      // escalando a peça inteira (e não cada eixo) dentro de uma caixa máxima.
      var GAP = 3, MAX_LADO = 58;
      var maiorDim = Math.max(cols, rows);
      var cellPx = Math.max(9, Math.floor((MAX_LADO - (maiorDim - 1) * GAP) / maiorDim));
      var larguraPx = cols * cellPx + (cols - 1) * GAP;
      var alturaPx = rows * cellPx + (rows - 1) * GAP;
      var mini = document.createElement('div');
      mini.className = 'bb-peca-mini';
      mini.style.width = larguraPx + 'px';
      mini.style.height = alturaPx + 'px';
      mini.style.gridTemplateColumns = 'repeat(' + cols + ',' + cellPx + 'px)';
      mini.style.gridTemplateRows = 'repeat(' + rows + ',' + cellPx + 'px)';
      peca.cel.forEach(function (o) {
        var b = document.createElement('div');
        b.className = 'bb-peca-bloco';
        b.style.gridColumn = (o[1] + 1);
        b.style.gridRow = (o[0] + 1);
        b.style.background = _bbCores[peca.cor - 1];
        mini.appendChild(b);
      });
      slot.appendChild(mini);
    }
  }

  // ── Arrastar peça (Pointer Events: cobre mouse e toque) ────
  var _BB_GHOST_OFFSET_Y = 60; // sobe a peça acima do dedo pra não tampar a mira

  function _bbIniciarArraste(e, slotIdx) {
    if (!_bbRodando) return;
    var peca = _bbTray[slotIdx];
    if (!peca) return;
    e.preventDefault();
    var pecaEl = e.currentTarget;
    try { pecaEl.setPointerCapture(e.pointerId); } catch (err) {}

    var grid = document.getElementById('bb-grid');
    if (!grid) return;
    var gridRect = grid.getBoundingClientRect();
    var cell = gridRect.width / _BB_TAM;
    var maxR = 0, maxC = 0;
    peca.cel.forEach(function (o) { if (o[0] > maxR) maxR = o[0]; if (o[1] > maxC) maxC = o[1]; });
    var cols = maxC + 1, rows = maxR + 1;

    var ghost = document.createElement('div');
    ghost.className = 'bb-ghost';
    ghost.style.width = (cols * cell) + 'px';
    ghost.style.height = (rows * cell) + 'px';
    ghost.style.gridTemplateColumns = 'repeat(' + cols + ',' + cell + 'px)';
    ghost.style.gridTemplateRows = 'repeat(' + rows + ',' + cell + 'px)';
    peca.cel.forEach(function (o) {
      var b = document.createElement('div');
      b.className = 'bb-ghost-bloco';
      b.style.gridColumn = (o[1] + 1);
      b.style.gridRow = (o[0] + 1);
      b.style.background = _bbCores[peca.cor - 1];
      ghost.appendChild(b);
    });
    (document.fullscreenElement || document.body).appendChild(ghost);
    pecaEl.classList.add('bb-peca-arrastando');

    _bbArrastando = {
      slotIdx: slotIdx, peca: peca, ghost: ghost, cell: cell,
      cols: cols, rows: rows, gridRect: gridRect, pecaEl: pecaEl,
      anchorRow: 0, anchorCol: 0, valido: false
    };
    _bbMoverGhost(e.clientX, e.clientY);

    function mover(ev) { ev.preventDefault(); _bbMoverGhost(ev.clientX, ev.clientY); }
    function soltar() {
      pecaEl.removeEventListener('pointermove', mover);
      pecaEl.removeEventListener('pointerup', soltar);
      pecaEl.removeEventListener('pointercancel', soltar);
      _bbFinalizarArraste();
    }
    pecaEl.addEventListener('pointermove', mover);
    pecaEl.addEventListener('pointerup', soltar);
    pecaEl.addEventListener('pointercancel', soltar);
  }

  function _bbMoverGhost(clientX, clientY) {
    var st = _bbArrastando;
    if (!st) return;
    var left = clientX - (st.cols * st.cell) / 2;
    var top = clientY - (st.rows * st.cell) - _BB_GHOST_OFFSET_Y;
    st.ghost.style.left = left + 'px';
    st.ghost.style.top = top + 'px';

    var anchorCol = Math.round((left - st.gridRect.left) / st.cell);
    var anchorRow = Math.round((top - st.gridRect.top) / st.cell);
    st.anchorRow = anchorRow;
    st.anchorCol = anchorCol;
    st.valido = _bbFormaCabeEm(st.peca, anchorRow, anchorCol);
    if (st.ghost) st.ghost.classList.toggle('bb-ghost-invalido', !st.valido);

    _bbLimparPreview();
    st.peca.cel.forEach(function (o) {
      var rr = anchorRow + o[0], cc = anchorCol + o[1];
      if (rr < 0 || rr >= _BB_TAM || cc < 0 || cc >= _BB_TAM) return;
      var el = _bbCelEls[rr * _BB_TAM + cc];
      if (el) el.classList.add(st.valido ? 'bb-preview-ok' : 'bb-preview-bad');
    });
  }
  function _bbLimparPreview() {
    if (!_bbCelEls) return;
    for (var i = 0; i < _bbCelEls.length; i++) _bbCelEls[i].classList.remove('bb-preview-ok', 'bb-preview-bad');
  }

  function _bbFinalizarArraste() {
    var st = _bbArrastando;
    if (!st) return;
    _bbLimparPreview();
    if (st.ghost && st.ghost.parentNode) st.ghost.parentNode.removeChild(st.ghost);
    if (st.pecaEl) st.pecaEl.classList.remove('bb-peca-arrastando');
    var valido = st.valido, slotIdx = st.slotIdx, anchorRow = st.anchorRow, anchorCol = st.anchorCol;
    _bbArrastando = null;
    if (valido) _bbColocarPeca(slotIdx, anchorRow, anchorCol);
  }
  // Cancela um arraste em curso sem colocar a peça (usado ao sair do jogo).
  function _bbCancelarArraste() {
    var st = _bbArrastando;
    if (!st) return;
    _bbLimparPreview();
    if (st.ghost && st.ghost.parentNode) st.ghost.parentNode.removeChild(st.ghost);
    if (st.pecaEl) st.pecaEl.classList.remove('bb-peca-arrastando');
    _bbArrastando = null;
  }

  // ── Colocação da peça: pontua, limpa linhas, repõe bandeja,
  // checa vitória (objetivo) e derrota (sem espaço) da fase. ──
  function _bbColocarPeca(slotIdx, anchorRow, anchorCol) {
    if (!_bbRodando) return;
    var peca = _bbTray[slotIdx];
    if (!peca || !_bbFormaCabeEm(peca, anchorRow, anchorCol)) return;
    peca.cel.forEach(function (o) {
      var rr = anchorRow + o[0], cc = anchorCol + o[1];
      _bbGrid[rr * _BB_TAM + cc] = peca.cor;
    });
    _bbTray[slotIdx] = null;
    _bbPontosFase += peca.cel.length;

    var linhas = _bbLimparLinhasCompletas();
    var s = _som();
    if (linhas > 0) {
      _bbLinhasFase += linhas;
      _bbPontosFase += linhas * linhas * 10;
      if (s) s.combo(linhas);
      if (navigator.vibrate) { try { navigator.vibrate(linhas >= 2 ? [20, 30, 20] : 15); } catch (e) {} }
    } else if (s) { s.acerto(); }

    if (_bbTray.every(function (p) { return !p; })) {
      _bbRodadasFase++;
      _bbTray = [_bbNovaPeca(), _bbNovaPeca(), _bbNovaPeca()];
    }

    _bbRenderGrid();
    _bbRenderTray();
    _bbAtualizarHud();

    if (_bbObjetivoAtingido()) { _bbFimFase(true); return; }
    if (_bbSemEspaco()) { _bbFimFase(false); }
  }

  function _bbAtualizarHud() {
    var faseEl = document.getElementById('bb-fase'); if (faseEl) faseEl.textContent = _bbFaseAtual;
    var recEl = document.getElementById('bb-recorde'); if (recEl) recEl.textContent = _bbRecordeGet();
    var pontosEl = document.getElementById('bb-pontos'); if (pontosEl) pontosEl.textContent = _bbPontosFase;
    var objEl = document.getElementById('bb-objetivo-texto'); if (objEl) objEl.textContent = _bbObjetivoTexto();
    var progEl = document.getElementById('bb-objetivo-progresso'); if (progEl) progEl.textContent = _bbObjetivoProgresso();
  }

  function _bbMostrarOverlay(nome) {
    var inicio = document.getElementById('bb-inicio');
    var fim = document.getElementById('bb-fim');
    if (inicio) inicio.style.display = (nome === 'inicio') ? 'flex' : 'none';
    if (fim) fim.style.display = (nome === 'fim') ? 'flex' : 'none';
  }

  // ── Início / fim de fase ────────────────────────────────────
  function _bbIniciarFase(fase) {
    _bbFaseAtual = Math.max(1, fase);
    var cfg = _bbConfigFase(_bbFaseAtual);
    _bbObjetivo = { tipo: cfg.tipo, meta: cfg.meta };
    _bbPontosFase = 0; _bbLinhasFase = 0; _bbRodadasFase = 0;
    _bbRng = _bbMulberry32(1000 + _bbFaseAtual * 97);
    _bbGrid = new Array(_BB_TAM * _BB_TAM).fill(0);
    _bbPrefill(cfg.prefill);
    _bbTray = [_bbNovaPeca(), _bbNovaPeca(), _bbNovaPeca()];

    // Salvaguarda: no raríssimo caso de o preenchimento inicial não
    // deixar espaço pra nenhuma das 3 peças, afrouxa o preenchimento
    // (mesma fase, mesma seed — ainda determinístico).
    var tentativas = 0;
    while (_bbSemEspaco() && tentativas < 8) {
      tentativas++;
      _bbGrid = new Array(_BB_TAM * _BB_TAM).fill(0);
      _bbPrefill(Math.max(0, cfg.prefill - tentativas * 4));
    }

    _bbRodando = true;
    _bbRenderGrid();
    _bbRenderTray();
    _bbAtualizarHud();
  }

  function _bbFimFase(venceu) {
    _bbRodando = false;
    _bbCancelarArraste();
    _bbUltimoResultado = venceu ? 'venceu' : 'perdeu';
    var s = _som();
    if (venceu) {
      if (_bbFaseAtual > _bbRecordeGet()) _bbRecordeSet(_bbFaseAtual);
      if (s) s.fim(true);
      if (window.AngatubaGames && window.AngatubaGames.efeitos) window.AngatubaGames.efeitos.confete('bb-card');
    } else if (s) { s.fim(false); }
    var recorde = _bbRecordeGet();

    var owl = document.getElementById('bb-fim-owl');
    var tit = document.getElementById('bb-fim-titulo');
    var msg = document.getElementById('bb-fim-msg');
    var btn = document.getElementById('bb-fim-btn');
    if (owl) { owl.src = venceu ? '/webp/owl-celebrate-pro.webp' : '/webp/owl-angry.webp'; owl.style.display = ''; }
    if (tit) tit.textContent = venceu ? ('Fase ' + _bbFaseAtual + ' concluída! 🎉') : 'Não coube mais!';
    if (msg) {
      msg.textContent = venceu
        ? ('Você fez ' + _bbPontosFase + ' pontos nesta fase. Bora pra próxima?')
        : ('Você chegou até a fase ' + _bbFaseAtual + ' com ' + _bbPontosFase + ' pontos nesta tentativa. Tenta de novo!');
    }
    if (btn) btn.textContent = venceu ? 'Próxima fase' : 'Tentar de novo';
    var recEl = document.getElementById('bb-recorde'); if (recEl) recEl.textContent = recorde;

    _bbMostrarOverlay('fim');

    if (window.AngatubaGames) {
      window.AngatubaGames.rankSubmeter('blocos', recorde);
      window.AngatubaGames.rankFimDeJogo('blocos', 'bb-rank-slot', recorde);
    }
  }

  function _bbBotaoPrincipal() {
    if (_bbUltimoResultado === 'venceu') _bbProximaFase(); else _bbRetry();
  }
  function _bbComecar() {
    _bbMostrarOverlay(null);
    _bbIniciarFase(_bbRecordeGet() + 1);
  }
  function _bbProximaFase() {
    _bbMostrarOverlay(null);
    _bbIniciarFase(_bbFaseAtual + 1);
  }
  function _bbRetry() {
    _bbMostrarOverlay(null);
    _bbIniciarFase(_bbFaseAtual);
  }

  // ── Preparação da tela (chamada pelo _jogoLoader ao abrir) ──
  function _bbPrepararTela() {
    _bbCriarGridDOM();
    _bbCriarTrayDOM();
    _bbCancelarArraste();
    _bbRodando = false;
    var recorde = _bbRecordeGet();
    var faseIni = document.getElementById('bb-fase-inicio'); if (faseIni) faseIni.textContent = (recorde + 1);
    var recIni = document.getElementById('bb-recorde-inicio'); if (recIni) recIni.textContent = recorde;
    _bbAtualizarHud();
    _bbMostrarOverlay('inicio');
  }
  function _bbParar() {
    _bbRodando = false;
    _bbCancelarArraste();
  }

  window._bbComecar = _bbComecar;
  window._bbProximaFase = _bbProximaFase;
  window._bbRetry = _bbRetry;
  window._bbBotaoPrincipal = _bbBotaoPrincipal;

  // API pública consumida pelo loader do app (_jogoLoader).
  window.BlocosGame = {
    preparar: _bbPrepararTela,
    comecar: _bbComecar,
    parar: _bbParar
  };
})();
