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
  // Atalho pra fachada de efeitos da ponte (no-op se não carregou ainda).
  function _efeitos() {
    return (window.AngatubaGames && window.AngatubaGames.efeitos) || null;
  }

  // Sprites do burst de limpeza (linha/coluna completada) — carregados uma
  // vez em _bbPrepararTela e cacheados aqui. Enquanto não carregam (ou se
  // falharem), o burst cai sozinho pro círculo colorido padrão do
  // efeitos.js (retrocompatível — ver opcoes.sprites em efeitos.estrelas).
  var _BB_SPRITES_LIMPEZA_URLS = [
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
  var _bbSpritesLimpeza = null;
  function _bbCarregarSpritesLimpeza() {
    var fx = _efeitos();
    if (!fx || !fx.carregarSprites || _bbSpritesLimpeza) return;
    fx.carregarSprites(_BB_SPRITES_LIMPEZA_URLS).then(function (imgs) {
      _bbSpritesLimpeza = imgs;
    }).catch(function () {}); // silencioso — sem sprites, o burst usa o fallback
  }

  var _BB_TAM = 8;                 // grade 8×8
  var _bbCores = ['#a855f7', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#22d3ee'];
  // Texturas opcionais (mesma ordem de _bbCores); se o arquivo não existir,
  // a cor sólida acima já fica aplicada como fundo e o visual não quebra.
  var _bbTexturas = [
    '/Jogos/assets/blocos/bloco-roxo.webp',
    '/Jogos/assets/blocos/bloco-azul.webp',
    '/Jogos/assets/blocos/bloco-verde.webp',
    '/Jogos/assets/blocos/bloco-amarelo.webp',
    '/Jogos/assets/blocos/bloco-rosa.webp',
    '/Jogos/assets/blocos/bloco-ciano.webp'
  ];
  // Skin (paleta das peças) — loja dentro do jogo (hub.js). Tema com
  // 'paleta' (6 cores) troca _bbCores e desliga as texturas (que são de
  // cor fixa) — no lugar, um brilho em gradiente dá o relevo da peça.
  var _BB_CORES_CLASSICAS = _bbCores.slice();
  var _BB_TEX_CLASSICAS = _bbTexturas.slice();
  var _bbTemaPaleta = false;
  function _bbAplicarSkin() {
    var G = window.AngatubaGames, it = null;
    try { it = (G && typeof G.skinEquipada === 'function') ? G.skinEquipada('bb_tema') : null; } catch (e) {}
    var pal = (it && it.paleta && it.paleta.length >= _BB_CORES_CLASSICAS.length) ? it.paleta : null;
    // Tema com arte ('texturas', 6): usa as imagens dele no lugar das do
    // clássico; a paleta fica só de cor de fundo enquanto a imagem carrega.
    var tex = (it && it.texturas && it.texturas.length >= _BB_TEX_CLASSICAS.length) ? it.texturas : null;
    _bbTexturas = tex ? tex.slice(0, _BB_TEX_CLASSICAS.length) : _BB_TEX_CLASSICAS.slice();
    if (tex) pal = null;
    _bbTemaPaleta = !!pal;
    _bbCores = pal ? pal.slice(0, _BB_CORES_CLASSICAS.length)
      : (tex && it.paleta ? it.paleta.slice(0, _BB_CORES_CLASSICAS.length) : _BB_CORES_CLASSICAS.slice());
    if (_bbCelEls) _bbRenderGrid();
    if (_bbTrayEls) _bbRenderTray();
  }
  window.addEventListener('angatuba:equipado', function (e) {
    if (e && e.detail && e.detail.slot === 'bb_tema') _bbAplicarSkin();
  });
  function _bbAplicarCor(el, corIdx) {
    el.style.background = _bbCores[corIdx];
    if (_bbTemaPaleta) {
      el.style.backgroundImage = 'linear-gradient(145deg, rgba(255,255,255,0.32), rgba(255,255,255,0) 45%, rgba(0,0,0,0.22))';
      return;
    }
    var tex = _bbTexturas[corIdx];
    if (tex) {
      el.style.backgroundImage = 'url(' + tex + ')';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
  }

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
  var _bbInicioFaseMs = 0;        // Date.now() no início da fase (segundos reais — P1-2)
  // Sobe a cada fase iniciada; os setTimeout de efeito/fim guardam o valor e
  // desistem se ele mudou (saiu ou recomeçou no meio).
  var _bbGeracao = 0;

  /* ── Visual v3 (nov/2026) ─────────────────────────────────────
     Cenário por fase, coruja com balão, peças estalando ao encaixar,
     prévia das linhas que vão fechar, estouro das linhas limpas (feixe +
     blocos voando + "+pontos"), peças novas deslizando, onda de vitória.
     Os elementos extras são criados em _bbMontarVisual (não estão no
     index.html). */
  function _bbMovReduzido() {
    var E = window.AngatubaGames && window.AngatubaGames.efeitos;
    if (E && E.leves) return E.leves();
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function _bbAplicarLeve() { var t = document.getElementById('jogo-blocos'); if (t) t.classList.toggle('fx-leve', _bbMovReduzido()); }
  var _BB_TEMAS = [
    { a: '#1e1b4b', b: '#0b1030', luz: 'rgba(99,102,241,0.45)' },   // anil
    { a: '#083344', b: '#04161d', luz: 'rgba(34,211,238,0.40)' },   // ciano
    { a: '#3b0764', b: '#180327', luz: 'rgba(192,132,252,0.42)' },  // roxo
    { a: '#052e16', b: '#03160b', luz: 'rgba(52,211,153,0.38)' },   // verde
    { a: '#431407', b: '#1c0903', luz: 'rgba(251,146,60,0.40)' },   // laranja
    { a: '#4c0519', b: '#1f0209', luz: 'rgba(251,113,133,0.40)' }   // rosa
  ];
  // Coruja construtora (nov/2026): um quadro por estado.
  var _BB_OWL = {};
  ['normal', 'ola', 'feliz', 'festa', 'uau', 'aperto', 'pensa', 'triste', 'vitoria'].forEach(function (k) {
    _BB_OWL[k] = '/Jogos/assets/blocos/coruja-' + k + '.webp';
  });
  var _bbMascoteT = 0, _bbMascoteEstado = 'normal';

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
    return { qtd: linhas.length + colunas.length, linhas: linhas, colunas: colunas };
  }

  // Burst de partículas (estrelas/sprites do efeitos.js) no centro de cada
  // linha/coluna limpa — mesmo padrão já validado no Doces (um burst por
  // "grupo" limpo, não por célula). As posições vêm de getBoundingClientRect
  // dos próprios <div> da grade, já que aqui (ao contrário do Doces, que
  // desenha tudo num <canvas>) cada célula é um elemento DOM de verdade.
  function _bbBurstLimpeza(linhas, colunas) {
    var fx = _efeitos();
    if (!fx || !fx.estrelas || !_bbCelEls) return;
    var opcoes = _bbSpritesLimpeza ? { sprites: _bbSpritesLimpeza } : undefined;
    var meio = Math.floor(_BB_TAM / 2);
    function burstNaCelula(idx) {
      var el = _bbCelEls[idx];
      if (!el) return;
      var r = el.getBoundingClientRect();
      fx.estrelas(r.left + r.width / 2, r.top + r.height / 2, undefined, opcoes);
    }
    linhas.forEach(function (r) { burstNaCelula(r * _BB_TAM + meio); });
    colunas.forEach(function (c) { burstNaCelula(meio * _BB_TAM + c); });
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
      // atraso da "onda" (entrada da fase / vitória): diagonal de cima-esquerda
      el.style.setProperty('--d', (((i / _BB_TAM) | 0) + (i % _BB_TAM)) * 28 + 'ms');
      el.style.setProperty('--dc', (i % _BB_TAM) * 55 + 'ms');
      grid.appendChild(el);
      _bbCelEls.push(el);
    }
  }
  function _bbRenderGrid() {
    if (!_bbCelEls) return;
    for (var i = 0; i < _bbCelEls.length; i++) {
      var v = _bbGrid[i], el = _bbCelEls[i];
      el.classList.remove('bb-preview-ok', 'bb-preview-bad');
      if (v > 0) { el.classList.add('bb-cheia'); _bbAplicarCor(el, v - 1); }
      else { el.classList.remove('bb-cheia'); el.style.background = ''; el.style.backgroundImage = ''; }
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
  function _bbRenderTray(novas) {
    if (!_bbTrayEls) return;
    for (var i = 0; i < 3; i++) {
      var slot = _bbTrayEls[i], peca = _bbTray[i];
      slot.innerHTML = '';
      slot.classList.remove('bb-peca-nova');
      if (novas && peca && !_bbMovReduzido()) {
        void slot.offsetWidth;
        slot.style.setProperty('--d', (i * 90) + 'ms');
        slot.classList.add('bb-peca-nova');
      }
      slot.classList.remove('bb-peca-sem-lugar');
      if (!peca) { slot.classList.add('bb-peca-vazia'); continue; }
      slot.classList.remove('bb-peca-vazia');
      // Peça que não cabe em lugar nenhum agora fica apagada (dica visual).
      if (_bbRodando && !_bbPecaCabeEmAlgumLugar(peca)) slot.classList.add('bb-peca-sem-lugar');
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
        _bbAplicarCor(b, peca.cor - 1);
        mini.appendChild(b);
      });
      slot.appendChild(mini);
    }
  }

  // ── Arrastar peça (Pointer Events: cobre mouse e toque) ────
  var _BB_GHOST_OFFSET_Y = 60; // sobe a peça acima do dedo pra não tampar a mira

  function _bbIniciarArraste(e, slotIdx) {
    if (!_bbRodando) return;
    // Um arraste por vez: um 2º dedo em outra peça sobrescrevia o estado do
    // 1º arraste e o "fantasma" dele ficava preso na tela pra sempre.
    if (_bbArrastando) return;
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
      _bbAplicarCor(b, peca.cor - 1);
      ghost.appendChild(b);
    });
    (document.fullscreenElement || document.body).appendChild(ghost);
    pecaEl.classList.add('bb-peca-arrastando');

    // Bandeja ao lado da grade (celular deitado): a peça vai pra ESQUERDA do
    // dedo em vez de pra cima — senão as linhas de baixo ficavam fora de alcance.
    var trayEl = document.getElementById('bb-tray');
    var lateral = !!trayEl && trayEl.getBoundingClientRect().left >= gridRect.right - 4;
    _bbArrastando = {
      slotIdx: slotIdx, peca: peca, ghost: ghost, cell: cell,
      cols: cols, rows: rows, gridRect: gridRect, pecaEl: pecaEl, lateral: lateral,
      anchorRow: 0, anchorCol: 0, valido: false
    };
    _bbMoverGhost(e.clientX, e.clientY);

    function mover(ev) { ev.preventDefault(); _bbMoverGhost(ev.clientX, ev.clientY); }
    function soltar(ev) {
      pecaEl.removeEventListener('pointermove', mover);
      pecaEl.removeEventListener('pointerup', soltar);
      pecaEl.removeEventListener('pointercancel', soltar);
      // Toque cancelado pelo sistema (gesto, ligação, notificação) NÃO coloca
      // a peça onde ela estava passando — só solta.
      if (ev && ev.type === 'pointercancel') _bbCancelarArraste(); else _bbFinalizarArraste();
    }
    pecaEl.addEventListener('pointermove', mover);
    pecaEl.addEventListener('pointerup', soltar);
    pecaEl.addEventListener('pointercancel', soltar);
  }

  function _bbMoverGhost(clientX, clientY) {
    var st = _bbArrastando;
    if (!st) return;
    var left = st.lateral ? clientX - (st.cols * st.cell) - 40 : clientX - (st.cols * st.cell) / 2;
    var top = st.lateral ? clientY - (st.rows * st.cell) / 2 : clientY - (st.rows * st.cell) - _BB_GHOST_OFFSET_Y;
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
      if (el) {
        el.classList.add(st.valido ? 'bb-preview-ok' : 'bb-preview-bad');
        if (st.valido) _bbAplicarCor(el, st.peca.cor - 1);   // a sombra já mostra a cor da peça
      }
    });
    // Linhas/colunas que FECHAM se soltar aqui acendem (igual ao Block Blast).
    if (st.valido) {
      var sim = _bbGrid.slice(), r, c, k, cheia;
      st.peca.cel.forEach(function (o) { sim[(anchorRow + o[0]) * _BB_TAM + anchorCol + o[1]] = st.peca.cor; });
      for (r = 0; r < _BB_TAM; r++) {
        for (cheia = true, c = 0; c < _BB_TAM; c++) if (!sim[r * _BB_TAM + c]) { cheia = false; break; }
        if (cheia) for (k = 0; k < _BB_TAM; k++) _bbCelEls[r * _BB_TAM + k].classList.add('bb-preview-linha');
      }
      for (c = 0; c < _BB_TAM; c++) {
        for (cheia = true, r = 0; r < _BB_TAM; r++) if (!sim[r * _BB_TAM + c]) { cheia = false; break; }
        if (cheia) for (k = 0; k < _BB_TAM; k++) _bbCelEls[k * _BB_TAM + c].classList.add('bb-preview-linha');
      }
    }
  }
  function _bbLimparPreview() {
    if (!_bbCelEls) return;
    for (var i = 0; i < _bbCelEls.length; i++) {
      var el = _bbCelEls[i];
      if (el.classList.contains('bb-preview-ok') && !_bbGrid[i]) { el.style.background = ''; el.style.backgroundImage = ''; }
      el.classList.remove('bb-preview-ok', 'bb-preview-bad', 'bb-preview-linha');
    }
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

    var antesLimpar = _bbGrid.slice();   // cores das linhas que vão sumir (pro efeito)
    var limpeza = _bbLimparLinhasCompletas();
    var qtdLimpas = limpeza.qtd;
    var s = _som();
    if (qtdLimpas > 0) {
      _bbLinhasFase += qtdLimpas;
      _bbPontosFase += qtdLimpas * qtdLimpas * 10;
      if (s) { if (s.tocar) s.tocar(qtdLimpas >= 2 ? 'blocos-linha-dupla' : 'blocos-linha', function () { s.combo(qtdLimpas); }, 0.8); else s.combo(qtdLimpas); }
      if (navigator.vibrate) { try { navigator.vibrate(qtdLimpas >= 2 ? [20, 30, 20] : 15); } catch (e) {} }
      _bbBurstLimpeza(limpeza.linhas, limpeza.colunas);
    } else if (s) {
      if (s.tocar) s.tocar(Math.random() < 0.5 ? 'blocos-encaixar-1' : 'blocos-encaixar-2', function () { s.acerto(); }, 0.7, 0.94 + Math.random() * 0.12);
      else s.acerto();
    }

    var novas = false;
    if (_bbTray.every(function (p) { return !p; })) {
      _bbRodadasFase++;
      _bbTray = [_bbNovaPeca(), _bbNovaPeca(), _bbNovaPeca()];
      novas = true;
      if (s && s.tocar) setTimeout(function () { s.tocar('blocos-pecas', null, 0.55); }, 120);
    }

    _bbRenderGrid();
    _bbRenderTray(novas);
    _bbAtualizarHud();
    _bbEstalo(peca, anchorRow, anchorCol, limpeza);
    if (qtdLimpas > 0) _bbEfeitoLimpeza(limpeza, antesLimpar, qtdLimpas * qtdLimpas * 10);
    _bbReagir(qtdLimpas);

    if (_bbObjetivoAtingido()) { _bbFimFase(true); return; }
    if (_bbSemEspaco()) { _bbFimFase(false); }
  }

  function _bbAtualizarHud() {
    var faseEl = document.getElementById('bb-fase'); if (faseEl) faseEl.textContent = _bbFaseAtual;
    var recEl = document.getElementById('bb-recorde'); if (recEl) recEl.textContent = _bbRecordeGet();
    var pontosEl = document.getElementById('bb-pontos'); if (pontosEl) pontosEl.textContent = _bbPontosFase;
    var objEl = document.getElementById('bb-objetivo-texto'); if (objEl) objEl.textContent = _bbObjetivoTexto();
    var progEl = document.getElementById('bb-objetivo-progresso'); if (progEl) progEl.textContent = _bbObjetivoProgresso();
    var barra = document.getElementById('bb-barra-fill');
    if (barra) barra.style.width = (_bbObjetivoFracao() * 100).toFixed(1) + '%';
    if (objEl && _bbObjetivo) objEl.textContent = _bbObjetivoCurto();
  }
  function _bbObjetivoFracao() {
    if (!_bbObjetivo || !_bbObjetivo.meta) return 0;
    var v = _bbObjetivo.tipo === 'pontos' ? _bbPontosFase : (_bbObjetivo.tipo === 'linhas' ? _bbLinhasFase : _bbRodadasFase);
    return Math.max(0, Math.min(1, v / _bbObjetivo.meta));
  }
  // Versão curta pro placar (o rótulo "Objetivo" já está em cima).
  function _bbObjetivoCurto() {
    var m = _bbObjetivo.meta;
    if (_bbObjetivo.tipo === 'pontos') return m + ' pontos';
    if (_bbObjetivo.tipo === 'linhas') return 'Limpe ' + m + (m === 1 ? ' linha' : ' linhas');
    return 'Sobreviva ' + m + (m === 1 ? ' rodada' : ' rodadas');
  }

  function _bbMostrarOverlay(nome) {
    // Sem overlay do jogo = fase rolando → menu unificado do hub no canto.
    var G = window.AngatubaGames;
    if (G && G.menu) G.menu.partida('jogo-blocos', !nome);
    var inicio = document.getElementById('bb-inicio');
    var fim = document.getElementById('bb-fim');
    if (inicio) inicio.style.display = (nome === 'inicio') ? 'flex' : 'none';
    if (fim) fim.style.display = (nome === 'fim') ? 'flex' : 'none';
  }

  // ── Início / fim de fase ────────────────────────────────────
  function _bbIniciarFase(fase) {
    _bbGeracao++;
    _bbFaseAtual = Math.max(1, fase);
    var cfg = _bbConfigFase(_bbFaseAtual);
    _bbAplicarTema(_bbFaseAtual);
    _bbObjetivo = { tipo: cfg.tipo, meta: cfg.meta };
    _bbPontosFase = 0; _bbLinhasFase = 0; _bbRodadasFase = 0;
    _bbRng = _bbMulberry32(1000 + _bbFaseAtual * 97);
    _bbInicioFaseMs = Date.now();
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
    _bbRenderTray(true);
    _bbAtualizarHud();
    var grid = document.getElementById('bb-grid');
    if (grid) {
      grid.classList.remove('bb-vitoria', 'bb-derrota', 'bb-entra');
      if (!_bbMovReduzido()) { void grid.offsetWidth; grid.classList.add('bb-entra'); }
    }
    var fx = document.getElementById('bb-fx'); if (fx) fx.innerHTML = '';
    _bbMascote('ola', _bbObjetivoTexto() + '!', 3200);
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
    } else if (s) {
      if (s.tocar) s.tocar('blocos-sem-espaco', null, 0.8);
      setTimeout(function () { s.fim(false); }, 450);
    }
    var recorde = _bbRecordeGet();

    var owl = document.getElementById('bb-fim-owl');
    var tit = document.getElementById('bb-fim-titulo');
    var msg = document.getElementById('bb-fim-msg');
    var btn = document.getElementById('bb-fim-btn');
    if (owl) { owl.src = venceu ? _BB_OWL.vitoria : _BB_OWL.triste; owl.style.display = ''; }
    if (tit) tit.textContent = venceu ? ('Fase ' + _bbFaseAtual + ' concluída! 🎉') : 'Não coube mais!';
    if (msg) {
      msg.textContent = venceu
        ? 'Mandou bem! Bora pra próxima?'
        : ('Faltou pouco: ' + _bbObjetivoProgresso() + ' do objetivo. Tenta de novo!');
    }
    var stats = document.getElementById('bb-fim-stats');
    if (stats) {
      stats.innerHTML = '<span class="bb-chip"><b>' + _bbPontosFase + '</b> pontos</span>' +
        '<span class="bb-chip"><b>' + _bbLinhasFase + '</b> ' + (_bbLinhasFase === 1 ? 'linha limpa' : 'linhas limpas') + '</span>';
    }
    var fimEl = document.getElementById('bb-fim');
    if (fimEl) fimEl.classList.toggle('bb-fim-venceu', !!venceu);
    if (btn) btn.textContent = venceu ? 'Próxima fase' : 'Tentar de novo';
    var recEl = document.getElementById('bb-recorde'); if (recEl) recEl.textContent = recorde;

    // A grade comemora (ou apaga) e a tela de fim entra logo depois.
    var grid = document.getElementById('bb-grid');
    if (grid && !_bbMovReduzido()) { grid.classList.remove('bb-entra'); void grid.offsetWidth; grid.classList.add(venceu ? 'bb-vitoria' : 'bb-derrota'); }
    _bbMascote(venceu ? 'festa' : 'triste', venceu ? 'Fase concluída!' : 'Não coube mais!');
    var gerFim = _bbGeracao;
    setTimeout(function () {
      if (gerFim !== _bbGeracao || _bbRodando) return;
      _bbMostrarOverlay('fim');
      if (window.AngatubaGames) window.AngatubaGames.rankFimDeJogo('blocos', 'bb-rank-slot', recorde);
    }, venceu ? 1200 : 900);

    var segundos = Math.max(0, Math.round((Date.now() - _bbInicioFaseMs) / 1000));

    if (window.AngatubaGames) {
      window.AngatubaGames.rankSubmeter('blocos', recorde);

      // Moedas da Loja da Coruja (teto 25 por partida) + stats locais
      // (partidas/segundos/recorde), no mesmo padrão do Voo da Coruja.
      // Só paga vencendo a fase, pela fase recém-concluída — não pelo
      // recorde histórico (senão dava pra "farmar" perdendo, P1-1).
      var moedasGanhas = venceu ? Math.max(0, Math.min(25, Math.floor(_bbFaseAtual * 3))) : 0;
      if (moedasGanhas > 0 && typeof window.AngatubaGames.moedasAdd === 'function') {
        window.AngatubaGames.moedasAdd(moedasGanhas, 'blocos');
      }
      if (typeof window.AngatubaGames.statsRegistrarPartida === 'function') {
        window.AngatubaGames.statsRegistrarPartida('blocos', { segundos: segundos, score: recorde });
      }
      var moedasEl = document.getElementById('bb-fim-moedas');
      if (moedasEl) {
        if (moedasGanhas > 0) { moedasEl.textContent = '+' + moedasGanhas + ' 🪙'; moedasEl.style.display = ''; }
        else moedasEl.style.display = 'none';
      }
    }
  }

  function _bbBotaoPrincipal() {
    if (_bbUltimoResultado === 'venceu') _bbProximaFase(); else _bbRetry();
  }
  function _bbComecar() {
    _bbAplicarSkin();
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

  // ── Visual v3: helpers ───────────────────────────────────────
  function _bbMontarVisual() {
    var card = document.getElementById('bb-card'), arena = document.getElementById('bb-arena'), grid = document.getElementById('bb-grid');
    if (!card || !arena || card._bbVisual) return;
    card._bbVisual = true;
    function novo(tag, cls, id) { var e = document.createElement(tag); if (cls) e.className = cls; if (id) e.id = id; return e; }
    // Telas de início/fim cobrem o card inteiro (HUD incluso).
    ['bb-inicio', 'bb-fim'].forEach(function (id) { var ov = document.getElementById(id); if (ov) card.appendChild(ov); });
    var prog = document.getElementById('bb-objetivo-progresso');
    if (prog && prog.parentNode) {
      var barra = novo('div', 'bb-barra'); barra.appendChild(novo('i', '', 'bb-barra-fill'));
      prog.parentNode.insertBefore(barra, prog);
    }
    var decos = novo('div', 'bb-decos'); decos.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 7; i++) {
      var d = novo('i');
      d.style.backgroundImage = 'url(' + _BB_TEX_CLASSICAS[i % _BB_TEX_CLASSICAS.length] + ')';
      decos.appendChild(d);
    }
    arena.insertBefore(decos, arena.firstChild);
    var masc = novo('div', 'bb-mascote', 'bb-mascote'), img = novo('img', '', 'bb-mascote-img'), bal = novo('div', 'bb-balao', 'bb-balao');
    img.alt = ''; img.src = _BB_OWL.normal; bal.setAttribute('aria-live', 'polite');
    masc.appendChild(img); masc.appendChild(bal);
    arena.insertBefore(masc, grid || null);
    for (var k in _BB_OWL) { var pre = new Image(); pre.src = _BB_OWL[k]; }
    // Camada dos efeitos (feixes, blocos voando, "+pontos"), por cima de tudo na arena.
    var fx = novo('div', 'bb-fx', 'bb-fx'); fx.setAttribute('aria-hidden', 'true');
    arena.appendChild(fx);
    var faseIni = document.querySelector('#bb-inicio .bb-overlay-fase');
    if (faseIni && faseIni.parentNode) faseIni.parentNode.insertBefore(novo('div', 'bb-overlay-obj', 'bb-inicio-obj'), faseIni.nextSibling);
    var moedas = document.getElementById('bb-fim-moedas');
    if (moedas && moedas.parentNode) moedas.parentNode.insertBefore(novo('div', 'bb-fim-stats', 'bb-fim-stats'), moedas);
    var owlIni = document.querySelector('#bb-inicio .bb-overlay-owl');
    if (owlIni) { owlIni.removeAttribute('loading'); owlIni.src = _BB_OWL.ola; }
  }
  function _bbResumoFase(fase) {
    var cfg = _bbConfigFase(fase), m = cfg.meta, alvo;
    if (cfg.tipo === 'pontos') alvo = m + ' pontos';
    else if (cfg.tipo === 'linhas') alvo = 'limpar ' + m + (m === 1 ? ' linha' : ' linhas');
    else alvo = 'sobreviver ' + m + (m === 1 ? ' rodada' : ' rodadas');
    return '🎯 ' + alvo + (cfg.prefill ? ' · grade com ' + cfg.prefill + ' blocos' : '');
  }
  function _bbAplicarTema(fase) {
    var t = _BB_TEMAS[(fase - 1) % _BB_TEMAS.length], card = document.getElementById('bb-card');
    if (!card) return;
    card.style.setProperty('--bb-a', t.a);
    card.style.setProperty('--bb-b', t.b);
    card.style.setProperty('--bb-luz', t.luz);
    // Cenário pintado (nov/2026); o tema 3 ainda não tem arte e fica no gradiente.
    var n = ((fase - 1) % _BB_TEMAS.length) + 1;
    card.style.setProperty('--bb-img', n === 3 ? 'none' : 'url(/Jogos/assets/blocos/cenario-' + n + '.webp)');
  }
  function _bbMascote(estado, fala, ms) {
    var img = document.getElementById('bb-mascote-img'), bal = document.getElementById('bb-balao');
    if (!img) return;
    clearTimeout(_bbMascoteT);
    _bbMascoteEstado = estado;
    var src = _BB_OWL[estado] || _BB_OWL.normal;
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    img.classList.remove('bb-mascote-pulo');
    if (estado !== 'normal') { void img.offsetWidth; img.classList.add('bb-mascote-pulo'); }
    if (bal) { if (fala) bal.textContent = fala; bal.classList.toggle('on', !!fala); }
    if (ms) _bbMascoteT = setTimeout(function () { _bbMascote(_bbApertado() ? 'aperto' : 'normal', _bbApertado() ? 'Tá apertado aqui!' : ''); }, ms);
  }
  // Grade quase cheia (ou só uma peça cabendo): a coruja fica aflita.
  function _bbApertado() {
    if (!_bbRodando) return false;
    var cheias = 0, cabem = 0;
    for (var i = 0; i < _bbGrid.length; i++) if (_bbGrid[i]) cheias++;
    _bbTray.forEach(function (p) { if (p && _bbPecaCabeEmAlgumLugar(p)) cabem++; });
    var pend = _bbTray.filter(function (p) { return p; }).length;
    return cheias >= 40 || (pend >= 2 && cabem <= 1);
  }
  function _bbReagir(qtd) {
    if (!_bbRodando) return;
    if (qtd >= 3) _bbMascote('uau', 'Incrível! ' + qtd + ' de uma vez!', 1800);
    else if (qtd === 2) _bbMascote('festa', 'Linha dupla!', 1600);
    else if (qtd === 1) _bbMascote('feliz', ['Boa!', 'Isso!', 'Limpou!'][(Math.random() * 3) | 0], 1300);
    else if (_bbApertado()) _bbMascote('aperto', 'Tá apertado aqui!');
    else if (_bbMascoteEstado === 'aperto') _bbMascote('normal', '');   // abriu espaço de novo
  }
  // Retângulo de uma célula relativo à arena (pros efeitos da camada .bb-fx).
  function _bbCelRect(idx, base) {
    var el = _bbCelEls && _bbCelEls[idx];
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  }
  // Peça encaixada: as células estalam (crescem e assentam).
  function _bbEstalo(peca, ar, ac, limpeza) {
    if (_bbMovReduzido() || !_bbCelEls) return;
    peca.cel.forEach(function (o) {
      var rr = ar + o[0], cc = ac + o[1];
      if (limpeza.linhas.indexOf(rr) !== -1 || limpeza.colunas.indexOf(cc) !== -1) return;
      var el = _bbCelEls[rr * _BB_TAM + cc];
      if (!el) return;
      el.classList.remove('bb-estalo'); void el.offsetWidth; el.classList.add('bb-estalo');
      setTimeout(function () { el.classList.remove('bb-estalo'); }, 320);
    });
  }
  // Linhas limpas: feixe de luz na linha/coluna, cada bloco salta e cai
  // girando, "+pontos" sobe do meio e, em limpeza múltipla, a grade treme
  // e aparece um aviso grande.
  function _bbEfeitoLimpeza(limpeza, cores, pontos) {
    var fx = document.getElementById('bb-fx'), arena = document.getElementById('bb-arena'), grid = document.getElementById('bb-grid');
    if (!fx || !arena || !grid) return;
    var base = arena.getBoundingClientRect(), g = grid.getBoundingClientRect();
    var reduzido = _bbMovReduzido(), feitos = {}, html = '', meio = Math.floor(_BB_TAM / 2);
    var gx = g.left - base.left, gy = g.top - base.top;
    function bloco(idx, atraso) {
      if (feitos[idx] || !cores[idx]) return;
      feitos[idx] = true;
      var r = _bbCelRect(idx, base); if (!r) return;
      var cor = _bbCores[cores[idx] - 1] || '#fff', tex = _bbTemaPaleta ? '' : _bbTexturas[cores[idx] - 1];
      var dx = (Math.random() * 2 - 1) * r.w * 1.6, rot = (Math.random() * 2 - 1) * 200;
      html += '<i class="bb-fx-bloco" style="left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px;' +
        'background-color:' + cor + ';' + (tex ? 'background-image:url(' + tex + ');' : '') +
        '--dx:' + dx.toFixed(0) + 'px;--rot:' + rot.toFixed(0) + 'deg;animation-delay:' + atraso + 'ms"></i>';
    }
    limpeza.linhas.forEach(function (r) {
      var c0 = _bbCelRect(r * _BB_TAM, base);
      if (c0) html += '<i class="bb-fx-feixe bb-fx-h" style="left:' + gx + 'px;top:' + c0.y + 'px;width:' + g.width + 'px;height:' + c0.h + 'px"></i>';
      if (!reduzido) for (var c = 0; c < _BB_TAM; c++) bloco(r * _BB_TAM + c, Math.abs(c - 3.5) * 22);
    });
    limpeza.colunas.forEach(function (c) {
      var c0 = _bbCelRect(c, base);
      if (c0) html += '<i class="bb-fx-feixe bb-fx-v" style="left:' + c0.x + 'px;top:' + gy + 'px;width:' + c0.w + 'px;height:' + g.height + 'px"></i>';
      if (!reduzido) for (var r = 0; r < _BB_TAM; r++) bloco(r * _BB_TAM + c, Math.abs(r - 3.5) * 22);
    });
    // "+pontos" no meio da primeira linha/coluna limpa
    var ref = limpeza.linhas.length ? _bbCelRect(limpeza.linhas[0] * _BB_TAM + meio, base) : _bbCelRect(meio * _BB_TAM + limpeza.colunas[0], base);
    if (ref) html += '<b class="bb-fx-pontos" style="left:' + ref.x + 'px;top:' + ref.y + 'px">+' + pontos + '</b>';
    var qtd = limpeza.qtd;
    if (qtd >= 2) html += '<b class="bb-fx-aviso" style="top:' + (gy + g.height * 0.38) + 'px">' + (qtd >= 3 ? 'INCRÍVEL!' : 'LINHA DUPLA!') + '</b>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var criados = Array.prototype.slice.call(wrap.children);
    criados.forEach(function (el) { fx.appendChild(el); });
    // cada estouro tira só os próprios elementos (outro pode já ter começado)
    setTimeout(function () { criados.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); }); }, 1300);
    if (qtd >= 2 && !reduzido) { grid.classList.remove('bb-treme'); void grid.offsetWidth; grid.classList.add('bb-treme'); }
  }

  // ── Menu unificado (hub.js → AngatubaGames.menu) ────────────
  // Jogo por turnos, sem relógio: "pausar" só solta a peça que estiver
  // sendo arrastada — o overlay do menu cobre o tabuleiro e a bandeja.
  function _bbRegistrarMenu() {
    var G = window.AngatubaGames;
    if (!G || !G.menu) return;
    G.menu.registrar('jogo-blocos', {
      pausar: function () { _bbCancelarArraste(); },
      continuar: function () {},
      opcoes: function () {
        var E = G.efeitos, leve = _bbMovReduzido();
        return [
          { icone: 'fa-wand-magic-sparkles', ativo: !leve,
            rotulo: leve ? ('Efeitos: leves' + (E && E.levesAutomatico && E.levesAutomatico() ? ' (automático)' : '')) : 'Efeitos: completos',
            acao: function () { if (E && E.definirLeves) E.definirLeves(!leve); _bbAplicarLeve(); } },
          { icone: 'fa-rotate-right', rotulo: 'Recomeçar',
            acao: function () { G.menu.fechar('jogo-blocos', false); _bbRetry(); } }
        ];
      }
    });
  }

  // ── Preparação da tela (chamada pelo _jogoLoader ao abrir) ──
  function _bbPrepararTela() {
    var sP = _som(); if (sP && sP.precarregar) sP.precarregar(['blocos-encaixar-1', 'blocos-encaixar-2', 'blocos-linha', 'blocos-linha-dupla', 'blocos-pecas', 'blocos-sem-espaco']);
    _bbCriarGridDOM();
    _bbMontarVisual();
    _bbAplicarLeve();
    var Ef = window.AngatubaGames && window.AngatubaGames.efeitos; if (Ef && Ef.medir) Ef.medir(_bbAplicarLeve);
    _bbRegistrarMenu();
    _bbCriarTrayDOM();
    _bbAplicarSkin();
    _bbCancelarArraste();
    _bbCarregarSpritesLimpeza();
    _bbRodando = false;
    var recorde = _bbRecordeGet();
    var faseIni = document.getElementById('bb-fase-inicio'); if (faseIni) faseIni.textContent = (recorde + 1);
    var recIni = document.getElementById('bb-recorde-inicio'); if (recIni) recIni.textContent = recorde;
    var objIni = document.getElementById('bb-inicio-obj'); if (objIni) objIni.textContent = _bbResumoFase(recorde + 1);
    _bbAplicarTema(recorde + 1);
    _bbMascote('normal', '');
    _bbAtualizarHud();
    _bbMostrarOverlay('inicio');
  }
  function _bbParar() {
    _bbRodando = false;
    _bbGeracao++;
    clearTimeout(_bbMascoteT);
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
