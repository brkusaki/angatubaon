/* ═══════════════════════════════════════════════════════════════
   RITMO DA CORUJA — módulo de jogo (lazy-loaded)
   Jogo de ritmo estilo osu!mania com 4, 5 ou 7 colunas: as notas descem
   pelas pistas e a pessoa toca na coluna certa quando a nota passa pela
   linha de acerto, no tempo da música. Notas longas ("length" no
   beatmap) precisam ser seguradas até o fim; no Hard há barra de vida.

   Fluxo:  seleção (música + dificuldade) → partida → resultado → 🪙

   Peças principais:
   - RT_CATALOGO ........ lista das músicas (arquivo, BPM, duração, níveis)
   - Beatmaps ........... /Jogos/ritmo/beatmaps/<id>.<normal|hard>.json
                          { songId, difficulty, bpm, offset, keys?,
                            notes:[{time, column, length?}] }
                          time/length em ms; column 0..keys-1 (keys = 4
                          se omitido). 5K/7K saem do mapa 4K (_rtConverterK).
   - Skins .............. Loja da Coruja (hub.js): slot rt_nota → _rtSkin()
                          (notas e receptores), rt_fundo → _rtFundoUrl()
                          (imagem atrás das pistas), rt_pista → _rtPista()
                          (cores das faixas, divisórias e linha de acerto)
   - Ranking ............ por mapa (música+dificuldade+colunas), via
                          AngatubaGames.rankMapaSubmeter / rankMapaPosicao
   - Entrada ............ toque (multitoque), teclado e controle (Gamepad API,
                          ver bloco CONTROLE) — todos somam em _rtApertada.
                          Fora da partida o controle navega (NAVEGAÇÃO COM O
                          CONTROLE): seleção, pausa, resultado.
   - Relógio ............ Web Audio (AudioContext). A música é decodificada
                          inteira e tocada por um AudioBufferSourceNode; o
                          tempo da música sai do ctx.currentTime (preciso,
                          ao contrário do <audio>.currentTime no celular).
   - Julgamento ......... RT_JANELAS (Perfeito / Ótimo / Bom / Erro)
   - Pontuação .......... até 1.000.000 (90% precisão + 10% combo máximo)
   - Recompensa ......... _rtMoedas(): rank × dificuldade × precisão

   Fala com o app APENAS via window.AngatubaGames (a ponte do hub):
   moedasAdd, statsRegistrarPartida, menu (pausa unificada), efeitos.
   Expõe window.RitmoGame = { preparar, parar, suspenderAudio }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     CATÁLOGO
     arquivo ... caminho do MP3 (pasta /musicas/ do site)
     bpm ....... aproximado (só informativo — o tempo das notas vem do beatmap)
     duracao ... segundos
     previa .... segundo em que começa a prévia na tela de seleção (refrão/trecho forte)
     dif ....... por dificuldade: quantidade de notas e nível (1–10)
     Para adicionar uma música: suba o MP3 em /musicas/, gere/escreva os
     dois beatmaps em /Jogos/ritmo/beatmaps/ e acrescente uma linha aqui.
  ══════════════════════════════════════════════════════════════ */
  var RT_CATALOGO = [
    { id: 'ninguem-te-repara', previa: 76,      titulo: 'Ninguém Te Repara', sub: 'Brega romântico',        arquivo: '/musicas/Ninguém Te Repara.mp3',               bpm: 92,  duracao: 212, dif: { normal: { notas: 276, nivel: 3 }, hard: { notas: 679, nivel: 7 } } },
    { id: 'estatica', previa: 121,               titulo: 'Estática',          sub: 'Rock alternativo',       arquivo: '/musicas/Estática.mp3',                        bpm: 131, duracao: 167, dif: { normal: { notas: 231, nivel: 4 }, hard: { notas: 555, nivel: 7 } } },
    { id: 'estatica-v2', previa: 147,            titulo: 'Estática',          sub: 'Versão 2',               arquivo: '/musicas/Estática versao 2.mp3',               bpm: 131, duracao: 199, dif: { normal: { notas: 279, nivel: 4 }, hard: { notas: 673, nivel: 8 } } },
    { id: 'estatica-eletronica', previa: 37,    titulo: 'Estática',          sub: 'Eletrônica',             arquivo: '/musicas/Estática eletronica.mp3',             bpm: 109, duracao: 162, dif: { normal: { notas: 233, nivel: 3 }, hard: { notas: 541, nivel: 7 } } },
    { id: 'estatica-eletronica-v2', previa: 128, titulo: 'Estática',          sub: 'Eletrônica · versão 2',  arquivo: '/musicas/Estática eletronica versao 2.mp3',    bpm: 110, duracao: 176, dif: { normal: { notas: 256, nivel: 3 }, hard: { notas: 604, nivel: 7 } } },
    { id: 'transborda', previa: 58,             titulo: 'Transborda',        sub: 'Melodic house',          arquivo: '/musicas/Transborda.mp3',                      bpm: 125, duracao: 240, dif: { normal: { notas: 344, nivel: 4 }, hard: { notas: 820, nivel: 8 } } },
    { id: 'plateia', previa: 56,                titulo: 'Plateia',           sub: 'Pop / R&B',              arquivo: '/musicas/Plateia.mp3',                         bpm: 101, duracao: 180, dif: { normal: { notas: 238, nivel: 3 }, hard: { notas: 599, nivel: 7 } } },
    { id: 'plateia-v2', previa: 127,             titulo: 'Plateia',           sub: 'Versão 2',               arquivo: '/musicas/Plateia versao 2.mp3',                bpm: 101, duracao: 218, dif: { normal: { notas: 298, nivel: 3 }, hard: { notas: 733, nivel: 7 } } },
    { id: 'bateria-fraca', previa: 86,          titulo: 'Bateria Fraca',     sub: 'Neo-soul',               arquivo: '/musicas/Bateria Fraca.mp3',                   bpm: 92,  duracao: 206, dif: { normal: { notas: 286, nivel: 3 }, hard: { notas: 647, nivel: 7 } } },
    { id: 'mare-alta', previa: 132,              titulo: 'Maré Alta',         sub: 'Trap',                   arquivo: '/musicas/Maré Alta.mp3',                       bpm: 138, duracao: 187, dif: { normal: { notas: 277, nivel: 4 }, hard: { notas: 643, nivel: 8 } } }
  ];

  // Sobe este número sempre que editar QUALQUER beatmap: ele entra na URL
  // (?v=N) e faz o navegador/Service Worker buscar a versão nova em vez
  // da cópia guardada (os beatmaps ficam no cache pra jogar offline).
  var RT_MAPAS_VERSAO = 3;   // v2: notas longas · v3: longas ajustadas pra 2 polegares
  var RT_MAPAS_PASTA = '/Jogos/ritmo/beatmaps/';
  // Mesmo nome do CACHE_JOGOS do service-worker.js (o MP3 já cai lá
  // sozinho pelo SW; aqui guardamos também o JSON do beatmap).
  var RT_CACHE_JOGOS = 'angatubaon-jogos-v4';

  /* ── Julgamento (ms de distância da nota) ──────────────────────
     Um pouco mais folgado que o osu!mania de PC: toque de tela tem
     latência maior que teclado. "erro" é até onde um toque ainda
     "consome" a nota (como Erro); depois disso a nota passa direto. */
  var RT_JANELAS = { perfeito: 45, otimo: 90, bom: 135, erro: 170 };
  var RT_VALOR   = { perfeito: 1, otimo: 0.7, bom: 0.4, erro: 0 };
  var RT_ROTULO  = { perfeito: 'PERFEITO', otimo: 'ÓTIMO', bom: 'BOM', erro: 'ERRO' };
  var RT_COR_JULG = { perfeito: '#7cf5ff', otimo: '#5eead4', bom: '#fbbf24', erro: '#f87171' };

  /* ── Colunas: 4K (padrão), 5K e 7K ─────────────────────────────
     Os beatmaps são escritos em 4K; 5K e 7K são gerados na hora a partir
     deles (_rtConverterK). Um mapa feito à mão pra N colunas declara
     "keys": N no JSON, fica em <id>.<dif>.<N>k.json e entra em
     RT_MAPAS_NATIVOS — aí é usado direto, sem conversão.
     RT_PADRAO_COR: qual das 3 cores da skin vai em cada pista
     (0 = de fora, 1 = de dentro, 2 = do meio). */
  var RT_MODOS_K = [4, 5, 7];
  var RT_PADRAO_COR = { 4: [0, 1, 1, 0], 5: [0, 1, 2, 1, 0], 7: [0, 1, 0, 2, 0, 1, 0] };
  var RT_TECLAS_K = { 4: 'dfjk', 5: 'df jk', 7: 'sdf jkl' };   // ' ' = barra de espaço
  var RT_LARGURA_MAX = { 4: 110, 5: 96, 7: 80 };                  // px por pista em tela larga
  var RT_MAPAS_NATIVOS = {};   // ex.: { 'mare-alta|hard|7': true } → mare-alta.hard.7k.json

  /* ── Skin das notas (Loja da Coruja, slot rt_nota — ver hub.js) ──
     estilo: gema | flat | olho | neon | ouro  (ver _rtDesenharNota) */
  var RT_SKIN_PADRAO = { estilo: 'gema', cores: ['#a78bfa', '#fbbf24', '#5eead4'] };
  /* ── Pista (slot rt_pista) — mesmos campos de item.pista no hub.js:
     faixa [pares, ímpares], linha (divisórias), acerto (linha de acerto),
     aperto ('r,g,b' do realce da coluna pressionada) e brilho opcional
     (halo largo translúcido por baixo das linhas, no lugar de shadowBlur).
     O padrão é exatamente o visual de antes das skins de pista. */
  var RT_PISTA_PADRAO = { faixa: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.035)'], linha: 'rgba(255,255,255,0.07)', acerto: 'rgba(255,255,255,0.10)', aperto: '167,139,250' };
  // Fundo com imagem: véu escuro "assado" na cópia escalada (legibilidade
  // geral) + um véu extra só sobre as pistas, onde as notas passam.
  var RT_FUNDO_VEU = 'rgba(4,5,12,0.22)';
  var RT_FUNDO_VEU_PISTA = 'rgba(4,5,12,0.30)';
  /* ── Efeitos de acerto: partículas num pool FIXO (nada é criado
     durante a partida). Cada uma guarda origem, velocidade e hora de
     nascimento; a posição sai da fórmula (sem update por frame). */
  var RT_PART_MAX = 48;
  var RT_PART_QTD = { perfeito: 8, otimo: 6, bom: 4 };   // por acerto
  var RT_ANEL_MS = 300;                                    // duração do anel de acerto

  /* ── Barra de vida (só no Hard) ─────────────────────────────────
     Começa cheia (1). Cada julgamento soma/subtrai; zerou → falhou.
     "solto" = soltou a nota longa antes da hora. Com estes valores,
     ~12 erros seguidos derrubam; uma sequência de acertos recupera. */
  var RT_VIDA = { perfeito: 0.012, otimo: 0.006, bom: -0.02, erro: -0.08, solto: -0.05 };

  var RT_LEAD_S = 2.2;         // silêncio antes da música começar (as notas já vêm descendo)
  var RT_RETOMAR_S = 2.0;      // ao continuar da pausa, a música volta com esse "respiro"

  // { "<id>|<dif>" (4K) ou "<id>|<dif>|<k>k" (5K/7K): {score, acc, rank, combo} }
  var RT_KEY_REC = 'angatuba_ritmo_recordes';
  var RT_KEY_CFG = 'angatuba_ritmo_cfg';       // { dif, velocidade, ajuste, ultima, colunas }

  /* ── Estado ──────────────────────────────────────────────────── */
  var _rtRoot = null;            // #ritmo-root
  var _rtEls = {};               // atalhos do DOM
  var _rtCfg = _rtCfgLer();
  var _rtSelId = _rtCfg.ultima || RT_CATALOGO[0].id;

  var _rtCtx = null, _rtGanho = null, _rtFonte = null;
  var _rtBufId = null, _rtBuf = null;    // última música decodificada (só uma na memória)
  var _rtMapas = {};                     // "<id>|<dif>" -> beatmap já baixado

  var _rtEstado = 'selecao';   // selecao | carregando | jogando | resultado
  var _rtPausado = false;
  var _rtPosPausa = 0;         // ms da música quando pausou
  var _rtInicioCtx = 0;        // ctx.currentTime em que a música estaria em 0 ms
  var _rtUltCtx = -1, _rtUltPerf = 0;
  var _rtRAF = 0;
  var _rtTokenCarga = 0;       // invalida cargas antigas se a pessoa trocar de tela
  var _rtInicioReal = 0, _rtPausaMs = 0, _rtPausaDesde = 0; // pra contar segundos jogados

  // Partida
  var _rtMusica = null, _rtDif = 'normal', _rtMapa = null;
  var _rtK = 4;                // colunas da partida atual
  // Notas, ordenadas por tempo: { t, c, fim (0 = toque simples), j (julgamento
  // da cabeça), jc (julgamento do fim da longa), seg (segurando agora),
  // solto (soltou cedo), pausado (estava segurando quando pausou) }
  var _rtNotas = [];
  var _rtPorCol = [[], [], [], []];
  var _rtPonteiro = [0, 0, 0, 0];  // próxima nota não julgada por coluna
  var _rtSegurando = [];       // coluna → nota longa sendo segurada
  var _rtLongasPausadas = [];  // longas interrompidas pela pausa (dá pra "pegar de volta")
  var _rtTotal = 0;            // julgamentos possíveis: toques + 2 por longa (cabeça + fim)
  var _rtVida = 1, _rtFalhou = false, _rtFalhaEm = 0, _rtFalhaPos = 0;
  var _rtSkinAtual = null;     // skin lida no começo da partida (não a cada frame)
  var _rtPistaAtual = null;    // idem, skin da pista (rt_pista)
  var _rtFundoAtual = null;    // idem, URL do fundo (rt_fundo); null = fundo escuro padrão
  var _rtDesenhoIni = 0;       // primeira nota que ainda pode aparecer na tela
  var _rtCont = null;          // contadores {perfeito, otimo, bom, erro}
  var _rtSoma = 0, _rtJulgadas = 0, _rtCombo = 0, _rtComboMax = 0;
  var _rtDesvioSoma = 0, _rtDesvioN = 0;   // toques acertados: média >0 = atrasado
  var _rtFim = 0;              // ms em que a partida termina
  var _rtSaindo = false;

  // Visual
  var _rtCanvas = null, _rtG = null, _rtW = 0, _rtH = 0, _rtDpr = 1;
  var _rtApertada = [0, 0, 0, 0];      // pista pressionada (contagem de dedos/teclas)
  var _rtBrilho = [0, 0, 0, 0];        // flash de acerto por pista (0..1)
  var _rtAperto = [0, 0, 0, 0];        // receptor afundado (0..1, suavizado a cada frame)
  var _rtAnel = [0, 0, 0, 0];          // performance.now() do último acerto por pista (anel)
  var _rtAnelForca = [0, 0, 0, 0];     // 1 perfeito · 0,8 ótimo · 0,6 bom
  var _rtParts = [], _rtPartProx = 0;  // pool de partículas (ver _rtEfeitoAcerto)
  for (var _rtPi = 0; _rtPi < RT_PART_MAX; _rtPi++) _rtParts.push({ t0: 0, x: 0, y: 0, vx: 0, vy: 0, dur: 1, tam: 1, cor: '#fff' });
  var _rtFundoImgs = {};               // url -> Image() (carrega uma vez só)
  var _rtFundoCv = null, _rtFundoChave = '';   // fundo já escalado (cover) no tamanho do canvas
  var _rtPonteiros = {};               // pointerId -> coluna
  var _rtJulgVis = null;               // {tipo, ate, desvio}
  var _rtUltimoFrame = 0;

  /* ── Utilidades ─────────────────────────────────────────────── */
  function _rtG_() { return window.AngatubaGames || null; }
  function _rtEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _rtMMSS(seg) {
    seg = Math.max(0, Math.round(seg));
    return Math.floor(seg / 60) + ':' + ('0' + (seg % 60)).slice(-2);
  }
  function _rtMusicaPorId(id) {
    for (var i = 0; i < RT_CATALOGO.length; i++) if (RT_CATALOGO[i].id === id) return RT_CATALOGO[i];
    return null;
  }
  // Caminho do MP3 com cada pedaço codificado (nomes têm espaço e acento).
  function _rtUrlAudio(m) {
    return m.arquivo.split('/').map(function (p) { return p ? encodeURIComponent(p) : p; }).join('/');
  }
  function _rtCfgLer() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(RT_KEY_CFG) || '{}') || {}; } catch (e) {}
    return {
      dif: c.dif === 'hard' ? 'hard' : 'normal',
      velocidade: Math.max(1, Math.min(10, Math.round(Number(c.velocidade) || 6))),
      ajuste: Math.max(-200, Math.min(200, Math.round(Number(c.ajuste) || 0))),
      ultima: typeof c.ultima === 'string' ? c.ultima : '',
      colunas: RT_MODOS_K.indexOf(Number(c.colunas)) !== -1 ? Number(c.colunas) : 4,
      pad: _rtCfgPad(c.pad)
    };
  }
  // Botões personalizados do controle: { 4:[b,b,b,b], 5:[...], 7:[...] } (um por coluna).
  function _rtCfgPad(p) {
    var out = {};
    if (!p || typeof p !== 'object') return out;
    RT_MODOS_K.forEach(function (k) {
      var l = p[k];
      if (Array.isArray(l) && l.length === k && l.every(function (b) { return b === Math.round(b) && b >= 0 && b < 32; })) out[k] = l.slice();
    });
    return out;
  }
  function _rtCfgSalvar() {
    try { localStorage.setItem(RT_KEY_CFG, JSON.stringify(_rtCfg)); } catch (e) {}
  }
  function _rtRecLer() {
    try { var o = JSON.parse(localStorage.getItem(RT_KEY_REC) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function _rtRecSalvar(o) {
    try { localStorage.setItem(RT_KEY_REC, JSON.stringify(o)); } catch (e) {}
  }
  // Chave do recorde local: a de 4K continua igual à de antes (compatível).
  function _rtChaveRec(id, dif, k) { return id + '|' + dif + (k && k !== 4 ? '|' + k + 'k' : ''); }
  // Id do mapa no ranking da cidade (mesmo formato validado nas regras).
  function _rtMapaId(id, dif, k) { return id + '_' + dif + '_' + (k || 4) + 'k'; }
  // Skin equipada (Loja da Coruja). Fallback: clássica.
  function _rtSkin() {
    var G = _rtG_(), it = null;
    try { it = (G && typeof G.skinEquipada === 'function') ? G.skinEquipada('rt_nota') : null; } catch (e) {}
    var n = it && it.nota;
    return (n && n.estilo && n.cores && n.cores.length >= 3) ? { estilo: n.estilo, cores: n.cores, nome: it.nome } : { estilo: RT_SKIN_PADRAO.estilo, cores: RT_SKIN_PADRAO.cores, nome: 'Clássica' };
  }
  function _rtCorCol(skin, c, k) { return skin.cores[(RT_PADRAO_COR[k] || RT_PADRAO_COR[4])[c] || 0]; }
  // Item equipado em outro slot do Ritmo (rt_fundo / rt_pista).
  function _rtItemSlot(slot) {
    var G = _rtG_();
    try { return (G && typeof G.skinEquipada === 'function') ? G.skinEquipada(slot) : null; } catch (e) { return null; }
  }
  function _rtPista() {
    var p = (_rtItemSlot('rt_pista') || {}).pista;
    return (p && p.faixa && p.faixa.length >= 2 && p.linha && p.acerto && p.aperto) ? p : RT_PISTA_PADRAO;
  }
  // Fundo: o preview do item É a imagem (fundo padrão não tem → null).
  function _rtFundoUrl() { return (_rtItemSlot('rt_fundo') || {}).preview || null; }
  // Image() do fundo, criada uma vez por URL e reaproveitada.
  function _rtFundoImg(url) {
    if (!url) return null;
    var im = _rtFundoImgs[url];
    if (!im) { im = new Image(); im.decoding = 'async'; im.src = url; _rtFundoImgs[url] = im; }
    return im;
  }
  function _rtFundoCarregou(im) { return !!(im && im.complete && im.naturalWidth); }
  /* Cópia do fundo já escalada (cover, centralizada) e escurecida no
     tamanho exato do canvas: o frame só faz UM drawImage 1:1, sem escala.
     Refeita só quando muda a imagem ou o tamanho do canvas. null enquanto
     a imagem não carregou (ou falhou) — aí vale o fundo escuro padrão. */
  function _rtFundoPronto(url) {
    var im = _rtFundoImg(url);
    if (!_rtFundoCarregou(im) || !_rtCanvas) return null;
    var cw = _rtCanvas.width, ch = _rtCanvas.height, chave = url + '|' + cw + 'x' + ch;
    if (_rtFundoCv && _rtFundoChave === chave) return _rtFundoCv;
    try {
      var cv = _rtFundoCv || document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      var g = cv.getContext('2d');
      var iw = im.naturalWidth, ih = im.naturalHeight, esc = Math.max(cw / iw, ch / ih);
      var dw = iw * esc, dh = ih * esc;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      g.fillStyle = RT_FUNDO_VEU;
      g.fillRect(0, 0, cw, ch);
      _rtFundoCv = cv; _rtFundoChave = chave;
      return cv;
    } catch (e) { return null; }
  }
  // Velocidade 1..10 → tempo (ms) que a nota leva do topo até a linha de acerto.
  function _rtTempoQueda() { return 2100 - _rtCfg.velocidade * 150; }

  /* ══════════════════════════════════════════════════════════════
     ÁUDIO (Web Audio)
  ══════════════════════════════════════════════════════════════ */
  // Cria/destrava o AudioContext. Precisa rodar DENTRO do toque em "Jogar"
  // (iOS/Chrome só liberam áudio num gesto da pessoa).
  function _rtAudioGarantir() {
    if (!_rtCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { _rtCtx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { _rtCtx = new AC(); } catch (e2) { return null; } }
      _rtGanho = _rtCtx.createGain();
      _rtGanho.connect(_rtCtx.destination);
    }
    // iOS 17+: toca mesmo com a chave de silencioso ligada (é uma música).
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (_rtCtx.state !== 'running' && _rtCtx.resume) { try { _rtCtx.resume(); } catch (e) {} }
    return _rtCtx;
  }
  function _rtAudioSuspender() {
    if (_rtCtx && _rtCtx.state === 'running' && _rtCtx.suspend) { try { _rtCtx.suspend(); } catch (e) {} }
  }
  function _rtSomAtivo() {
    var S = window.AngatubaSom;
    return !S || typeof S.ativo !== 'function' || S.ativo();
  }
  function _rtPararFonte() {
    if (_rtFonte) {
      try { _rtFonte.onended = null; _rtFonte.stop(); } catch (e) {}
      try { _rtFonte.disconnect(); } catch (e) {}
      _rtFonte = null;
    }
  }
  // Toca a música a partir de "posMs", começando daqui a "atrasoS" segundos.
  // Define o relógio: tempo da música = (ctx.currentTime - _rtInicioCtx) * 1000.
  function _rtTocarDe(posMs, atrasoS) {
    _rtPararFonte();
    var ctx = _rtCtx;
    var quando = ctx.currentTime + atrasoS;
    var fonte = ctx.createBufferSource();
    fonte.buffer = _rtBuf;
    fonte.connect(_rtGanho);
    var posS = posMs / 1000;
    if (posS >= 0) fonte.start(quando, posS);
    else fonte.start(quando - posS, 0);          // começa antes do 0: espera em silêncio
    _rtInicioCtx = quando - posS;
    _rtFonte = fonte;
    _rtGanho.gain.cancelScheduledValues(ctx.currentTime);
    _rtGanho.gain.setValueAtTime(_rtSomAtivo() ? 1 : 0, ctx.currentTime);
    _rtUltCtx = -1;
  }

  /* ── Prévia na tela de seleção (estilo Guitar Hero) ──────────────
     Tocar no card da música toca RT_PREVIA_S segundos a partir de
     m.previa, com fade de entrada/saída. Usa o MESMO download/decodificação
     da partida: se a pessoa tocar "Jogar" em seguida, a música já está
     pronta. Para ao trocar de música, ao começar a partida e ao sair. */
  var RT_PREVIA_S = 12;
  var _rtPrev = { id: null, carregando: null, fonte: null, ganho: null, token: 0 };
  function _rtPreviaParar() {
    _rtPrev.token++;
    _rtPrev.carregando = null;
    if (_rtPrev.fonte) {
      var f = _rtPrev.fonte, g = _rtPrev.ganho;
      try {
        var t = _rtCtx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.15);   // corta sem "estalo"
        f.onended = null;
        f.stop(t + 0.16);
      } catch (e) { try { f.stop(); } catch (e2) {} }
      setTimeout(function () { try { f.disconnect(); g.disconnect(); } catch (e) {} }, 300);
    }
    _rtPrev.fonte = null; _rtPrev.ganho = null; _rtPrev.id = null;
    _rtPreviaIcones();
  }
  function _rtPreviaTocar(m) {
    _rtPreviaParar();
    if (!_rtAudioGarantir()) return;            // dentro do toque no card
    var token = _rtPrev.token;
    _rtPrev.carregando = m.id;
    _rtPreviaIcones();
    _rtCarregarAudio(m, null).then(function (buf) {
      if (token !== _rtPrev.token || _rtEstado !== 'selecao') return;
      _rtPrev.carregando = null;
      var ctx = _rtCtx, t0 = ctx.currentTime + 0.05;
      var dur = Math.min(RT_PREVIA_S, buf.duration);
      var ini = Math.max(0, Math.min(m.previa || buf.duration * 0.4, buf.duration - dur - 0.5));
      var vol = _rtSomAtivo() ? 0.9 : 0;
      var g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.8);
      g.gain.setValueAtTime(vol, t0 + dur - 1.5);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      var f = ctx.createBufferSource();
      f.buffer = buf;
      f.connect(g);
      f.onended = function () {
        if (_rtPrev.fonte !== f) return;
        try { f.disconnect(); g.disconnect(); } catch (e) {}
        _rtPrev.fonte = null; _rtPrev.ganho = null; _rtPrev.id = null;
        _rtPreviaIcones();
      };
      f.start(t0, ini, dur);
      _rtPrev.fonte = f; _rtPrev.ganho = g; _rtPrev.id = m.id;
      _rtPreviaIcones();
    }).catch(function (err) {
      if (token !== _rtPrev.token) return;
      _rtPrev.carregando = null;
      _rtPreviaIcones();
      _rtMostrarErro(_rtMsgDoErro(err));
    });
  }
  // Atualiza só os ícones dos cards (sem redesenhar a lista toda).
  function _rtPreviaIcones() {
    if (!_rtEls.lista) return;
    var cards = _rtEls.lista.querySelectorAll('[data-musica]');
    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].getAttribute('data-musica');
      var ico = cards[i].querySelector('.rt-musica-ico');
      if (!ico) continue;
      var carregando = _rtPrev.carregando === id, tocando = _rtPrev.id === id;
      ico.className = 'rt-musica-ico' + (carregando ? ' rt-ico-carregando' : '') + (tocando ? ' rt-ico-tocando' : '');
      ico.innerHTML = carregando ? '' : tocando ? '<span class="rt-eq"><i></i><i></i><i></i></span>' : (id === _rtSelId ? '▶' : '♪');
      cards[i].setAttribute('aria-label', cards[i].getAttribute('data-titulo') + (tocando ? ' — tocando prévia (toque para parar)' : ' — toque para ouvir a prévia'));
    }
  }

  /* ── Relógio da música (ms) ─────────────────────────────────────
     ctx.currentTime anda em "degraus" (blocos de áudio); entre um degrau
     e outro interpolamos com performance.now() — no máximo 40 ms — pra
     o movimento ficar liso. Desconta a latência de saída (Bluetooth) e
     soma o ajuste manual de sincronia escolhido pela pessoa. */
  function _rtAgoraMs() {
    if (!_rtCtx) return 0;
    if (_rtPausado) return _rtPosPausa;
    var ct = _rtCtx.currentTime, pn = performance.now();
    if (ct !== _rtUltCtx) { _rtUltCtx = ct; _rtUltPerf = pn; }
    var extra = Math.min(40, pn - _rtUltPerf);
    var lat = _rtCtx.outputLatency || _rtCtx.baseLatency || 0;
    return (ct - _rtInicioCtx - lat) * 1000 + extra - _rtCfg.ajuste;
  }

  /* ── Download + decodificação ─────────────────────────────────── */
  // Erro com tipo, pra mensagem certa na tela:
  //   'rede'    → sem internet / servidor fora
  //   'arquivo' → o MP3 chegou, mas não é um áudio válido (ex.: arquivo
  //               quebrado no servidor) ou não existe (404)
  //   'mapa'    → o beatmap não carregou
  function _rtErro(tipo, msg) { var e = new Error(msg || tipo); e.tipo = tipo; return e; }
  // Um MP3 de 2–4 min tem vários MB; abaixo disso é arquivo quebrado
  // (foi o caso de 5 faixas que subiram pro GitHub com 2 bytes).
  var RT_AUDIO_MIN_BYTES = 100000;

  function _rtBaixarComProgresso(url, aoProgresso, recarregar) {
    // recarregar: pula o cache HTTP do navegador (o GitHub Pages manda max-age=600)
    return fetch(url, recarregar ? { cache: 'reload' } : undefined).catch(function () {
      throw _rtErro('rede', 'fetch falhou');
    }).then(function (r) {
      if (!r.ok) throw _rtErro(r.status === 404 ? 'arquivo' : 'rede', 'HTTP ' + r.status);
      var total = Number(r.headers.get('content-length')) || 0;
      if (!total || !r.body || !r.body.getReader) return r.arrayBuffer();
      var leitor = r.body.getReader(), partes = [], recebido = 0;
      function ler() {
        return leitor.read().then(function (p) {
          if (p.done) {
            var tudo = new Uint8Array(recebido), o = 0;
            for (var i = 0; i < partes.length; i++) { tudo.set(partes[i], o); o += partes[i].length; }
            return tudo.buffer;
          }
          partes.push(p.value); recebido += p.value.length;
          aoProgresso(Math.min(1, recebido / total));
          return ler();
        });
      }
      return ler();
    });
  }
  function _rtDecodificar(ab) {
    return new Promise(function (ok, falha) {
      // Forma com callbacks: o Safari antigo não devolve Promise.
      var p = _rtCtx.decodeAudioData(ab, ok, falha);
      if (p && typeof p.then === 'function') p.then(ok, falha);
    });
  }
  // Apaga a URL de todos os caches do app. O SW guarda MP3 em cache-first
  // (CACHE_JOGOS): se uma vez chegou um arquivo quebrado, ele ficaria preso
  // ali pra sempre — mesmo depois de corrigido no servidor.
  function _rtApagarDoCache(url) {
    if (!window.caches || !caches.keys) return Promise.resolve();
    var abs = new URL(url, location.href).href;
    return caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (n) {
        return caches.open(n).then(function (c) {
          return Promise.all([c.delete(url), c.delete(abs)]);
        });
      }));
    }).catch(function () {});
  }

  // Baixa + decodifica a música. Se o arquivo vier inválido, apaga a cópia
  // do cache e tenta UMA vez direto da rede (auto-cura). Pedidos repetidos
  // da mesma música (prévia → Jogar) reaproveitam o mesmo download.
  var _rtCarga = null;   // { id, p, ouvintes[] } — download em andamento
  function _rtCarregarAudio(m, aoProgresso) {
    if (_rtBufId === m.id && _rtBuf) return Promise.resolve(_rtBuf);
    if (_rtCarga && _rtCarga.id === m.id) {
      if (aoProgresso) _rtCarga.ouvintes.push(aoProgresso);
      return _rtCarga.p;
    }
    _rtBuf = null; _rtBufId = null;            // solta a anterior (memória do celular)
    var url = _rtUrlAudio(m);
    var carga = { id: m.id, ouvintes: aoProgresso ? [aoProgresso] : [] };
    function prog(x) { for (var i = 0; i < carga.ouvintes.length; i++) { try { carga.ouvintes[i](x); } catch (e) {} } }
    function tentar(n) {
      return _rtBaixarComProgresso(url, prog, n > 0).then(function (ab) {
        if (!ab || ab.byteLength < RT_AUDIO_MIN_BYTES) throw _rtErro('arquivo', 'MP3 com ' + (ab ? ab.byteLength : 0) + ' bytes');
        return _rtDecodificar(ab).catch(function () { throw _rtErro('arquivo', 'MP3 não decodifica'); });
      }).catch(function (err) {
        if (n > 0 || err.tipo !== 'arquivo') throw err;
        return _rtApagarDoCache(url).then(function () { return tentar(1); });
      });
    }
    carga.p = tentar(0).then(function (buf) {
      // Só vira a "música atual" se ninguém pediu outra no meio do caminho.
      if (_rtCarga === carga) { _rtCarga = null; _rtBuf = buf; _rtBufId = m.id; }
      return buf;
    }, function (err) {
      if (_rtCarga === carga) _rtCarga = null;
      throw err;
    });
    _rtCarga = carga;
    return carga.p;
  }
  // k: colunas pedidas. Se existe mapa feito à mão pra k (RT_MAPAS_NATIVOS)
  // carrega ele; senão o 4K de sempre (convertido depois em _rtIniciar).
  function _rtCarregarMapa(id, dif, k) {
    var nativo = k && k !== 4 && RT_MAPAS_NATIVOS[id + '|' + dif + '|' + k];
    var chave = id + '|' + dif + (nativo ? '|' + k : '');
    if (_rtMapas[chave]) return Promise.resolve(_rtMapas[chave]);
    var url = RT_MAPAS_PASTA + id + '.' + dif + (nativo ? '.' + k + 'k' : '') + '.json?v=' + RT_MAPAS_VERSAO;
    return fetch(url).then(function (r) {
      if (!r.ok) throw _rtErro('mapa', 'HTTP ' + r.status);
      // Guarda uma cópia no cache dos jogos pra abrir offline depois.
      try {
        if (window.caches && caches.open) {
          var copia = r.clone();
          caches.open(RT_CACHE_JOGOS).then(function (c) { return c.put(url, copia); }).catch(function () {});
        }
      } catch (e) {}
      return r.json().catch(function () { throw _rtErro('mapa', 'JSON inválido'); });
    }, function (err) { throw err.tipo ? err : _rtErro('rede', 'fetch do mapa falhou'); }).then(function (mapa) {
      if (!mapa || !Array.isArray(mapa.notes) || !mapa.notes.length) throw _rtErro('mapa', 'beatmap inválido');
      _rtMapas[chave] = mapa;
      return mapa;
    });
  }

  /* ══════════════════════════════════════════════════════════════
     DOM — tudo é montado aqui dentro de #ritmo-root (index.html só
     tem o contêiner e o "Voltar aos jogos").
  ══════════════════════════════════════════════════════════════ */
  function _rtMontar() {
    _rtRoot = document.getElementById('ritmo-root');
    if (!_rtRoot) return false;
    if (_rtRoot.getAttribute('data-montado')) return true;
    _rtRoot.setAttribute('data-montado', '1');
    _rtRoot.innerHTML =
      // ── Seleção ──
      '<div class="rt-sel" id="rt-sel">' +
        '<div class="rt-sel-topo">' +
          '<div class="rt-sel-titulo">🎵 Ritmo da Coruja</div>' +
          '<div class="rt-sel-sub" id="rt-sel-sub"></div>' +
          '<button type="button" class="rt-aviso-som" id="rt-aviso-som" style="display:none;">🔇 O som dos jogos está desligado — toque para ligar</button>' +
          '<div class="rt-erro" id="rt-erro" role="alert" style="display:none;"></div>' +
          '<div class="rt-pad" id="rt-pad" style="display:none;"><span>🎮 <span id="rt-pad-txt">Controle conectado</span></span><button type="button" class="rt-pad-cfg" id="rt-pad-cfg">Configurar botões</button></div>' +
        '</div>' +
        '<div class="rt-lista" id="rt-lista"></div>' +
        '<div class="rt-painel">' +
          '<button type="button" class="rt-rank-linha" id="rt-rank-linha"></button>' +
          '<div class="rt-linha2">' +
            '<div class="rt-ks" role="radiogroup" aria-label="Colunas">' +
              '<button type="button" class="rt-k" data-k="4" role="radio">4K</button>' +
              '<button type="button" class="rt-k" data-k="5" role="radio">5K</button>' +
              '<button type="button" class="rt-k" data-k="7" role="radio">7K</button>' +
            '</div>' +
            '<button type="button" class="rt-skin-btn" id="rt-skin-btn" aria-label="Trocar skins: notas, fundo e pista"><canvas id="rt-skin-cv" width="72" height="28" aria-hidden="true"></canvas><span id="rt-skin-nome">Skin</span></button>' +
          '</div>' +
          '<div class="rt-difs" role="radiogroup" aria-label="Dificuldade">' +
            '<button type="button" class="rt-dif" data-dif="normal" role="radio"><span class="rt-dif-nome">Normal</span><span class="rt-dif-info" id="rt-dif-normal"></span></button>' +
            '<button type="button" class="rt-dif rt-dif-hard" data-dif="hard" role="radio"><span class="rt-dif-nome">Hard</span><span class="rt-dif-info" id="rt-dif-hard"></span></button>' +
          '</div>' +
          '<div class="rt-ajustes">' +
            '<div class="rt-ajuste"><span class="rt-ajuste-rot">Velocidade</span>' +
              '<button type="button" class="rt-step" data-aj="vel" data-d="-1" aria-label="Diminuir velocidade">−</button>' +
              '<span class="rt-ajuste-val" id="rt-vel"></span>' +
              '<button type="button" class="rt-step" data-aj="vel" data-d="1" aria-label="Aumentar velocidade">+</button></div>' +
            '<div class="rt-ajuste"><span class="rt-ajuste-rot">Atraso do áudio <button type="button" class="rt-ajuda" id="rt-ajuda" aria-expanded="false" aria-controls="rt-ajuda-txt" aria-label="O que é o atraso do áudio?">?</button></span>' +
              '<button type="button" class="rt-step" data-aj="sync" data-d="-10" aria-label="Diminuir atraso do áudio">−</button>' +
              '<span class="rt-ajuste-val" id="rt-sync"></span>' +
              '<button type="button" class="rt-step" data-aj="sync" data-d="10" aria-label="Aumentar atraso do áudio">+</button></div>' +
          '</div>' +
          '<div class="rt-ajuda-txt" id="rt-ajuda-txt" style="display:none;">' +
            'Compensa a demora do som chegar no seu ouvido. Se você toca no tempo da música e aparece <b>“tarde”</b>, aumente (+). ' +
            'Se aparece <b>“cedo”</b>, diminua (−). Fone Bluetooth costuma precisar de +100 a +200 ms. Deixe em 0 ms se estiver tudo certo.' +
          '</div>' +
          '<button type="button" class="rt-jogar" id="rt-jogar">Jogar</button>' +
          '<div class="rt-pad-dicas" id="rt-pad-dicas" style="display:none;"><span><b>Ⓐ</b> jogar</span><span><b>Ⓑ</b> voltar</span><span><b>↑↓</b> música</span><span><b>←→</b> dificuldade</span><span><b>LB RB</b> colunas</span><span><b>Ⓨ</b> ranking</span><span><b>Select</b> botões</span></div>' +
        '</div>' +
      '</div>' +
      // ── Partida ──
      '<div class="rt-jogo" id="rt-jogo" style="display:none;">' +
        '<canvas class="rt-canvas" id="rt-canvas"></canvas>' +
        '<div class="rt-progresso"><div class="rt-progresso-barra" id="rt-prog"></div></div>' +
        '<div class="rt-vida" id="rt-vida" style="display:none;" aria-label="Vida"><i>❤</i><div class="rt-vida-trilho"><div class="rt-vida-barra" id="rt-vida-barra"></div></div></div>' +
        '<div class="rt-hud">' +
          '<div class="rt-hud-score" id="rt-score">0</div>' +
          '<div class="rt-hud-acc" id="rt-acc">100,00%</div>' +
          '<div class="rt-hud-combo" id="rt-combo" aria-live="off"></div>' +
          '<div class="rt-hud-pad" id="rt-hud-pad" style="display:none;" title="Controle conectado">🎮</div>' +
        '</div>' +
        '<div class="rt-aviso" id="rt-aviso" style="display:none;"></div>' +
      '</div>' +
      // ── Resultado ──
      '<div class="rt-res" id="rt-res" style="display:none;">' +
        '<div class="rt-res-musica" id="rt-res-musica"></div>' +
        '<div class="rt-res-rank" id="rt-res-rank">A</div>' +
        '<div class="rt-res-falhou-msg" id="rt-res-falhou-msg" style="display:none;"></div>' +
        '<div class="rt-res-recorde" id="rt-res-recorde" style="display:none;">🏆 Novo recorde!</div>' +
        '<div class="rt-res-score" id="rt-res-score">0</div>' +
        '<div class="rt-res-grade">' +
          '<div><span>Precisão</span><b id="rt-res-acc">0%</b></div>' +
          '<div><span>Combo máx.</span><b id="rt-res-combo">0</b></div>' +
        '</div>' +
        '<div class="rt-res-cont" id="rt-res-cont"></div>' +
        '<div class="rt-res-moedas" id="rt-res-moedas" style="display:none;"></div>' +
        '<div class="rt-res-dica" id="rt-res-dica" style="display:none;"></div>' +
        '<div class="rt-res-cidade" id="rt-res-cidade" style="display:none;"></div>' +
        '<button type="button" class="rt-jogar" id="rt-res-denovo">Jogar de novo</button>' +
        '<button type="button" class="rt-link" id="rt-res-voltar">Escolher outra música</button>' +
      '</div>' +
      // ── Configurar botões do controle ──
      '<div class="rt-top-ov" id="rt-pad-ov" style="display:none;" role="dialog" aria-modal="true" aria-label="Configurar controle">' +
        '<div class="rt-top-caixa rt-pad-caixa">' +
          '<div class="rt-top-cab"><div class="rt-top-tit" id="rt-pad-tit"></div><button type="button" class="rt-top-fechar" id="rt-pad-fechar" aria-label="Fechar">✕</button></div>' +
          '<div class="rt-pad-msg" id="rt-pad-msg"></div>' +
          '<div class="rt-pad-slots" id="rt-pad-slots"></div>' +
          '<button type="button" class="rt-link" id="rt-pad-padrao">Voltar pro mapa padrão</button>' +
        '</div>' +
      '</div>' +
      // ── Top 10 do mapa (ranking da cidade) ──
      '<div class="rt-top-ov" id="rt-top-ov" style="display:none;" role="dialog" aria-modal="true" aria-label="Ranking da música">' +
        '<div class="rt-top-caixa">' +
          '<div class="rt-top-cab"><div class="rt-top-tit" id="rt-top-tit"></div><button type="button" class="rt-top-fechar" id="rt-top-fechar" aria-label="Fechar">✕</button></div>' +
          '<ol class="rt-top-lista" id="rt-top-lista"></ol>' +
          '<div class="rt-top-rodape" id="rt-top-rodape"></div>' +
        '</div>' +
      '</div>';

    var q = function (id) { return document.getElementById(id); };
    _rtEls = {
      sel: q('rt-sel'), lista: q('rt-lista'), jogo: q('rt-jogo'), res: q('rt-res'),
      difN: q('rt-dif-normal'), difH: q('rt-dif-hard'), vel: q('rt-vel'), sync: q('rt-sync'),
      avisoSom: q('rt-aviso-som'), score: q('rt-score'), acc: q('rt-acc'), prog: q('rt-prog'),
      aviso: q('rt-aviso'), erro: q('rt-erro'),
      rankLinha: q('rt-rank-linha'), skinCv: q('rt-skin-cv'), skinNome: q('rt-skin-nome'),
      vida: q('rt-vida'), vidaBarra: q('rt-vida-barra'), topOv: q('rt-top-ov'),
      combo: q('rt-combo'), hudPad: q('rt-hud-pad'), pad: q('rt-pad'), padOv: q('rt-pad-ov')
    };
    _rtCanvas = q('rt-canvas');
    _rtG = _rtCanvas.getContext('2d');

    // Lista de músicas (clique escolhe; duplo toque/“Jogar” começa).
    _rtEls.lista.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-musica]');
      if (!b) return;
      var id = b.getAttribute('data-musica');
      _rtMostrarErro('');
      if (id === _rtSelId && (_rtPrev.id === id || _rtPrev.carregando === id)) { _rtPreviaParar(); return; }
      _rtSelId = id;
      _rtRenderSelecao();
      _rtPreviaTocar(_rtMusicaPorId(id));
    });
    // App foi pro segundo plano: a prévia não continua tocando escondida.
    document.addEventListener('visibilitychange', function () { if (document.hidden) _rtPreviaParar(); });
    _rtRoot.querySelector('.rt-difs').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-dif]');
      if (!b) return;
      _rtCfg.dif = b.getAttribute('data-dif');
      _rtCfgSalvar();
      _rtRenderSelecao();
    });
    _rtRoot.querySelector('.rt-ajustes').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-aj]');
      if (!b) return;
      var d = Number(b.getAttribute('data-d'));
      if (b.getAttribute('data-aj') === 'vel') _rtCfg.velocidade = Math.max(1, Math.min(10, _rtCfg.velocidade + d));
      else _rtCfg.ajuste = Math.max(-200, Math.min(200, _rtCfg.ajuste + d));
      _rtCfgSalvar();
      _rtRenderAjustes();
    });
    _rtRoot.querySelector('.rt-ks').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-k]');
      if (!b) return;
      _rtCfg.colunas = Number(b.getAttribute('data-k'));
      _rtCfgSalvar();
      _rtRenderSelecao();
    });
    q('rt-skin-btn').addEventListener('click', function () {
      _rtPreviaParar();
      var G = _rtG_();
      if (G && typeof G.lojaJogoAbrir === 'function') G.lojaJogoAbrir('ritmo');
      else if (typeof window.lojaJogoAbrir === 'function') window.lojaJogoAbrir('ritmo');
    });
    // Equipou outra skin (loja dentro do jogo ou da Coruja): atualiza a
    // amostra na hora; fundo novo já começa a baixar pra próxima partida.
    window.addEventListener('angatuba:equipado', function (e) {
      var s = e && e.detail && e.detail.slot;
      if (s === 'rt_nota' || s === 'rt_fundo' || s === 'rt_pista') _rtRenderSkinBtn();
    });
    _rtEls.rankLinha.addEventListener('click', _rtTopAbrir);
    q('rt-pad-cfg').addEventListener('click', _rtPadCalAbrir);
    q('rt-pad-fechar').addEventListener('click', _rtPadCalFechar);
    q('rt-pad-padrao').addEventListener('click', _rtPadCalPadrao);
    q('rt-top-fechar').addEventListener('click', _rtTopFechar);
    _rtEls.topOv.addEventListener('click', function (e) { if (e.target === _rtEls.topOv) _rtTopFechar(); });
    q('rt-ajuda').addEventListener('click', function (e) {
      e.stopPropagation();
      var t = q('rt-ajuda-txt'), abrir = t.style.display === 'none';
      t.style.display = abrir ? '' : 'none';
      this.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    });
    _rtEls.avisoSom.addEventListener('click', function () {
      if (typeof window._alternarSomJogos === 'function') window._alternarSomJogos();
      _rtRenderAvisoSom();
    });
    q('rt-jogar').addEventListener('click', function () { _rtComecar(_rtSelId, _rtCfg.dif); });
    q('rt-res-denovo').addEventListener('click', function () { if (_rtMusica) _rtComecar(_rtMusica.id, _rtDif); });
    q('rt-res-voltar').addEventListener('click', _rtMostrarSelecao);

    // Toque nas pistas (multitoque: cada dedo é um pointerId).
    _rtCanvas.addEventListener('pointerdown', _rtPointerDown, { passive: false });
    _rtCanvas.addEventListener('pointerup', _rtPointerUp);
    _rtCanvas.addEventListener('pointercancel', _rtPointerUp);
    _rtCanvas.addEventListener('lostpointercapture', _rtPointerUp);
    _rtCanvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', _rtKeyDown);
    document.addEventListener('keyup', _rtKeyUp);
    window.addEventListener('resize', _rtRedimensionar);
    window.addEventListener('orientationchange', _rtRedimensionar);
    return true;
  }

  function _rtMostrar(qual) {
    _rtEls.sel.style.display = qual === 'sel' ? '' : 'none';
    _rtEls.jogo.style.display = qual === 'jogo' ? '' : 'none';
    _rtEls.res.style.display = qual === 'res' ? '' : 'none';
  }

  /* ── Tela de seleção ─────────────────────────────────────────── */
  var RT_ORDEM_RANK = { SS: 6, S: 5, A: 4, B: 3, C: 2, D: 1 };
  function _rtRenderSelecao() {
    var rec = _rtRecLer();
    var html = '';
    for (var i = 0; i < RT_CATALOGO.length; i++) {
      var m = RT_CATALOGO[i];
      var rn = rec[_rtChaveRec(m.id, 'normal', _rtCfg.colunas)], rh = rec[_rtChaveRec(m.id, 'hard', _rtCfg.colunas)];
      var sel = m.id === _rtSelId;
      html += '<button type="button" class="rt-musica' + (sel ? ' rt-musica-sel' : '') + '" data-musica="' + _rtEsc(m.id) + '" data-titulo="' + _rtEsc(m.titulo + (m.sub ? ' (' + m.sub + ')' : '')) + '" aria-pressed="' + sel + '">' +
        '<span class="rt-musica-ico">' + (sel ? '▶' : '♪') + '</span>' +
        '<span class="rt-musica-txt">' +
          '<span class="rt-musica-tit">' + _rtEsc(m.titulo) + '</span>' +
          '<span class="rt-musica-meta">' + _rtEsc(m.sub) + ' · ' + m.bpm + ' BPM · ' + _rtMMSS(m.duracao) + '</span>' +
        '</span>' +
        // Melhor rank em cada dificuldade: rótulo pequeno em cima, rank embaixo
        // ("—" enquanto não jogou).
        '<span class="rt-musica-ranks">' +
          _rtRankChip('Normal', 'rt-rk-n', rn) +
          _rtRankChip('Hard', 'rt-rk-h', rh) +
        '</span>' +
      '</button>';
    }
    _rtEls.lista.innerHTML = html;
    _rtPreviaIcones();
    var m2 = _rtMusicaPorId(_rtSelId) || RT_CATALOGO[0];
    _rtSelId = m2.id;
    _rtEls.difN.textContent = 'Nível ' + m2.dif.normal.nivel + ' · ' + m2.dif.normal.notas + ' notas';
    _rtEls.difH.textContent = 'Nível ' + m2.dif.hard.nivel + ' · ' + m2.dif.hard.notas + ' notas';
    var difs = _rtRoot.querySelectorAll('.rt-dif');
    for (var j = 0; j < difs.length; j++) {
      var ativo = difs[j].getAttribute('data-dif') === _rtCfg.dif;
      difs[j].classList.toggle('rt-dif-ativa', ativo);
      difs[j].setAttribute('aria-checked', ativo ? 'true' : 'false');
    }
    var sub = document.getElementById('rt-sel-sub');
    if (sub) sub.textContent = 'Toque nas ' + _rtCfg.colunas + ' colunas quando as notas chegarem na linha. Notas longas: segure até o fim.';
    var ks = _rtRoot.querySelectorAll('.rt-k');
    for (var kk = 0; kk < ks.length; kk++) {
      var kAtivo = Number(ks[kk].getAttribute('data-k')) === _rtCfg.colunas;
      ks[kk].classList.toggle('rt-k-ativa', kAtivo);
      ks[kk].setAttribute('aria-checked', kAtivo ? 'true' : 'false');
    }
    _rtRenderAjustes();
    _rtRenderAvisoSom();
    _rtRenderSkinBtn();
    _rtRankAtualizar();
    _rtPadIndicador();
  }

  /* ── Botão da skin (amostra desenhada com as skins equipadas) ────
     Notas da rt_nota; por trás, o fundo (rt_fundo) e as divisórias da
     pista (rt_pista) quando não são os padrões. Fundo ainda baixando:
     redesenha sozinho quando a imagem chega. */
  function _rtRenderSkinBtn() {
    var cv = _rtEls.skinCv;
    if (!cv) return;
    var sk = _rtSkin(), pista = _rtPista(), url = _rtFundoUrl(), im = _rtFundoImg(url);
    _rtEls.skinNome.textContent = sk.nome;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = 72 * dpr; cv.height = 28 * dpr;
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, 72, 28);
    if (im || pista !== RT_PISTA_PADRAO) {
      g.save();
      g.beginPath();                                   // cantos arredondados (r = 6)
      g.moveTo(6, 0); g.arcTo(72, 0, 72, 28, 6); g.arcTo(72, 28, 0, 28, 6); g.arcTo(0, 28, 0, 0, 6); g.arcTo(0, 0, 72, 0, 6);
      g.closePath(); g.clip();
      g.fillStyle = 'rgba(6,8,20,0.7)'; g.fillRect(0, 0, 72, 28);
      if (_rtFundoCarregou(im)) {
        var iw = im.naturalWidth, ih = im.naturalHeight, esc = Math.max(72 / iw, 28 / ih);
        g.drawImage(im, (72 - iw * esc) / 2, (28 - ih * esc) * 0.4, iw * esc, ih * esc);
        g.fillStyle = RT_FUNDO_VEU; g.fillRect(0, 0, 72, 28);
      } else if (im && !im._rtEsperaBtn) {
        im._rtEsperaBtn = true;
        im.addEventListener('load', function () { im._rtEsperaBtn = false; _rtRenderSkinBtn(); }, { once: true });
      }
      for (var f = 0; f < 3; f++) { g.fillStyle = pista.faixa[f % 2]; g.fillRect(f * 24, 0, 24, 28); }
      g.fillStyle = pista.linha; g.fillRect(23.5, 0, 1, 28); g.fillRect(47.5, 0, 1, 28);
      g.restore();
    }
    for (var i = 0; i < 3; i++) _rtDesenharNota(g, 13 + i * 23, 14, 10, sk.cores[i], sk.estilo);
  }

  /* ── Ranking da cidade do mapa selecionado ──────────────────────
     Uma leitura por mapa a cada 60 s (cache em memória); depois de
     gravar um recorde o cache daquele mapa é descartado. */
  var _rtRankCache = {};
  function _rtRankMapaSel() { return _rtMapaId(_rtSelId, _rtCfg.dif, _rtCfg.colunas); }
  function _rtRankLer(mapa, forcar) {
    var c = _rtRankCache[mapa];
    if (c && !forcar && Date.now() - c.em < 60000) return c.p;
    var G = _rtG_();
    var falha = { top: [], pos: null, meu: null, erro: true };
    var p = (G && typeof G.rankMapaPosicao === 'function') ? G.rankMapaPosicao(mapa) : Promise.resolve(falha);
    // Offline/SDK do Firebase não carregou: não fica "carregando" pra sempre.
    p = Promise.race([p, new Promise(function (ok) { setTimeout(function () { ok(falha); }, 8000); })]);
    _rtRankCache[mapa] = { em: Date.now(), p: p };
    return p;
  }
  function _rtRankAtualizar() {
    var el = _rtEls.rankLinha;
    if (!el) return;
    var mapa = _rtRankMapaSel();
    el.setAttribute('data-mapa', mapa);
    el.innerHTML = '<span class="rt-rank-ico">🏆</span><span class="rt-rank-txt">Ranking da cidade…</span>';
    _rtRankLer(mapa).then(function (r) {
      if (el.getAttribute('data-mapa') !== mapa) return;     // trocou de mapa no meio
      var txt;
      if (r.erro) txt = 'Ranking da cidade indisponível agora';
      else if (!r.top.length) txt = 'Ninguém jogou este mapa ainda — seja o 1º!';
      else {
        var lider = r.top[0];
        txt = (r.pos ? '<b>Você: #' + r.pos + '</b> · ' : (r.meu != null ? '<b>Você: 50+</b> · ' : '')) +
          '1º ' + _rtEsc(lider.nome) + ' ' + _rtFmtNum(lider.score);
      }
      el.innerHTML = '<span class="rt-rank-ico">🏆</span><span class="rt-rank-txt">' + txt + '</span>' + (r.top.length ? '<span class="rt-rank-seta">›</span>' : '');
    });
  }
  function _rtTopAbrir() {
    var mapa = _rtRankMapaSel(), m = _rtMusicaPorId(_rtSelId);
    var G = _rtG_(), uid = null;
    document.getElementById('rt-top-tit').textContent = (m ? m.titulo + (m.sub ? ' · ' + m.sub : '') : '') + ' — ' + (_rtCfg.dif === 'hard' ? 'Hard' : 'Normal') + ' ' + _rtCfg.colunas + 'K';
    var lista = document.getElementById('rt-top-lista'), rod = document.getElementById('rt-top-rodape');
    lista.innerHTML = '<li class="rt-top-vazio">Carregando…</li>';
    rod.innerHTML = '';
    _rtEls.topOv.style.display = 'flex';
    _rtRankLer(mapa, true).then(function (r) {
      if (_rtEls.topOv.style.display === 'none') return;
      var logado = !!(G && typeof G.estaLogado === 'function' && G.estaLogado());
      if (r.erro) { lista.innerHTML = '<li class="rt-top-vazio">Sem conexão com o ranking agora.</li>'; return; }
      if (!r.top.length) { lista.innerHTML = '<li class="rt-top-vazio">Ninguém jogou este mapa ainda.</li>'; }
      else {
        var html = '';
        for (var i = 0; i < Math.min(10, r.top.length); i++) {
          var it = r.top[i], eu = r.pos === i + 1;
          html += '<li class="rt-top-item' + (eu ? ' rt-top-eu' : '') + '"><span class="rt-top-pos">' + (i + 1) + '</span>' +
            '<span class="rt-top-nome">' + _rtEsc(it.nome) + (eu ? ' (você)' : '') + '</span><span class="rt-top-score">' + _rtFmtNum(it.score) + '</span></li>';
        }
        lista.innerHTML = html;
      }
      if (!logado) rod.innerHTML = '<button type="button" class="rt-top-login">Entre na sua conta pra aparecer aqui</button>';
      else if (r.pos && r.pos > 10) rod.textContent = 'Sua posição: #' + r.pos + ' · ' + _rtFmtNum(r.meu);
      else if (!r.pos && r.meu != null) rod.textContent = 'Seu melhor: ' + _rtFmtNum(r.meu) + ' (fora do top 50)';
      else if (!r.pos) rod.textContent = 'Termine este mapa pra entrar no ranking.';
      var bl = rod.querySelector('.rt-top-login');
      if (bl) bl.onclick = function () { _rtTopFechar(); if (G && typeof G.abrirLogin === 'function') G.abrirLogin('Entre pra aparecer no ranking do Ritmo da Coruja!'); };
    });
  }
  function _rtTopFechar() { if (_rtEls.topOv) _rtEls.topOv.style.display = 'none'; }
  function _rtRankChip(rotulo, cls, rec) {
    return '<span class="rt-rk ' + cls + (rec ? '' : ' rt-rk-vazio') + '" title="' + (rec ? 'Melhor no ' + rotulo + ': ' + rec.rank + ' (' + _rtFmtAcc(rec.acc || 0) + ')' : 'Ainda não jogou no ' + rotulo) + '">' +
      '<span class="rt-rk-dif">' + rotulo + '</span>' +
      '<span class="rt-rk-val' + (rec ? ' rt-r-' + rec.rank : '') + '">' + (rec ? rec.rank : '—') + '</span>' +
    '</span>';
  }
  function _rtRenderAjustes() {
    _rtEls.vel.textContent = _rtCfg.velocidade;
    _rtEls.sync.textContent = (_rtCfg.ajuste > 0 ? '+' : '') + _rtCfg.ajuste + ' ms';
    _rtEls.sync.classList.toggle('rt-ajuste-val-mudado', _rtCfg.ajuste !== 0);
  }
  function _rtRenderAvisoSom() {
    _rtEls.avisoSom.style.display = _rtSomAtivo() ? 'none' : '';
  }
  function _rtMostrarSelecao() {
    _rtPararPartida();
    _rtEstado = 'selecao';
    _rtMostrar('sel');
    _rtRenderSelecao();
    var sel = _rtEls.lista.querySelector('.rt-musica-sel');
    if (sel && sel.scrollIntoView) { try { sel.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  }

  /* ══════════════════════════════════════════════════════════════
     PARTIDA
  ══════════════════════════════════════════════════════════════ */
  function _rtComecar(id, dif) {
    var m = _rtMusicaPorId(id);
    if (!m) return;
    _rtPreviaParar();
    _rtMostrarErro('');
    // Áudio destravado AQUI, dentro do toque (antes de qualquer await).
    if (!_rtAudioGarantir()) { _rtAvisoErro('Seu navegador não toca áudio do jeito que o jogo precisa.'); return; }
    _rtPararPartida();
    _rtMusica = m; _rtDif = dif;
    _rtCfg.ultima = m.id; _rtCfgSalvar();
    _rtEstado = 'carregando';
    _rtMostrar('jogo');
    _rtRedimensionar();
    _rtZerarPlacar();
    _rtNotas = []; _rtDesenhar(0);
    _rtAviso('Carregando ' + m.titulo + '…');
    var token = ++_rtTokenCarga;
    Promise.all([
      _rtCarregarAudio(m, function (p) {
        if (token === _rtTokenCarga) _rtAviso('Carregando ' + m.titulo + '… ' + Math.round(p * 100) + '%');
      }),
      _rtCarregarMapa(m.id, dif, _rtCfg.colunas)
    ]).then(function (r) {
      if (token !== _rtTokenCarga || _rtEstado !== 'carregando') return;
      _rtBuf = r[0]; _rtBufId = m.id;
      _rtIniciar(r[1]);
    }).catch(function (err) {
      if (token !== _rtTokenCarga) return;
      try { console.warn('[ritmo] falha ao carregar ' + m.id + ':', err && err.message); } catch (e) {}
      _rtAvisoErro(_rtMsgDoErro(err));
    });
  }

  var RT_MSG_ERRO = {
    rede: 'Sem conexão pra baixar a música. Confira a internet e tente de novo.',
    arquivo: 'O arquivo desta música está com defeito no servidor. Escolha outra por enquanto.',
    mapa: 'Não deu pra carregar as notas desta música. Tente de novo em instantes.'
  };
  function _rtMsgDoErro(err) { return RT_MSG_ERRO[err && err.tipo] || RT_MSG_ERRO.rede; }
  // Mostra o erro na própria tela de seleção (não some, a pessoa vê o motivo).
  function _rtMostrarErro(msg) {
    if (!_rtEls.erro) return;
    _rtEls.erro.textContent = msg || '';
    _rtEls.erro.style.display = msg ? '' : 'none';
  }
  function _rtAvisoErro(msg) {
    _rtEstado = 'selecao';
    _rtMostrar('sel');
    _rtRenderSelecao();
    _rtMostrarErro(msg);
    try { console.warn('[ritmo] ' + msg); } catch (e) {}
  }

  function _rtZerarPlacar() {
    _rtCont = { perfeito: 0, otimo: 0, bom: 0, erro: 0 };
    _rtSoma = 0; _rtJulgadas = 0; _rtCombo = 0; _rtComboMax = 0;
    _rtDesvioSoma = 0; _rtDesvioN = 0;
    _rtJulgVis = null;
    _rtK = _rtCfg.colunas;
    _rtApertada = []; _rtBrilho = []; _rtSegurando = []; _rtPonteiros = {}; _rtTeclasDown = {}; _rtPadCols = {};
    _rtAperto = []; _rtAnel = []; _rtAnelForca = [];
    for (var c = 0; c < _rtK; c++) { _rtApertada.push(0); _rtBrilho.push(0); _rtSegurando.push(null); _rtAperto.push(0); _rtAnel.push(0); _rtAnelForca.push(0); }
    for (var p = 0; p < _rtParts.length; p++) _rtParts[p].t0 = 0;   // apaga partículas da partida anterior
    _rtLongasPausadas = [];
    _rtVida = 1; _rtFalhou = false; _rtFalhaEm = 0; _rtFalhaPos = 0;
    _rtSkinAtual = _rtSkin();
    _rtPistaAtual = _rtPista();
    _rtFundoAtual = _rtFundoUrl();
    _rtFundoImg(_rtFundoAtual);   // começa a carregar (se já não estiver no cache)
    _rtEls.score.textContent = '0';
    _rtEls.acc.textContent = '100,00%';
    _rtComboRender();
    _rtEls.prog.style.width = '0%';
    _rtEls.vida.style.display = _rtCfg.dif === 'hard' ? '' : 'none';
    _rtVidaRender();
  }

  /* ── 4K → 5K/7K ──────────────────────────────────────────────────
     Espalha as 4 colunas do mapa original pelas N novas, de forma
     determinística (o mesmo mapa sai sempre igual — o ranking é justo):
       5K: 0→0 · 1→1 ou meio · 2→3 ou meio · 3→4
       7K: 0→0/1 · 1→2/1/3 · 2→4/3/5 · 3→6/5
     Uma coluna só recebe nota se estiver livre (sem longa em andamento
     e sem nota no mesmo instante); senão tenta a vizinha, depois a base. */
  var RT_K_OPCOES = {
    5: [[0], [1, 2], [3, 2], [4]],
    7: [[0, 1], [2, 1, 3], [4, 3, 5], [6, 5]]
  };
  function _rtConverterK(notas, k) {
    var opcoes = RT_K_OPCOES[k];
    if (!opcoes) return notas;
    var livreApos = [];
    for (var i = 0; i < k; i++) livreApos.push(-1e9);
    var saida = [];
    for (var j = 0; j < notas.length; j++) {
      var n = notas[j], ops = opcoes[n.c];
      // "sorteio" fixo pelo tempo da nota (hash inteiro, sem Math.random)
      var h = ((Math.floor(n.t / 7) * 2654435761) >>> 0) % 1000 / 1000;
      var pref = ops[Math.min(ops.length - 1, Math.floor(h * ops.length))];
      var ordem = [pref].concat(ops, opcoes[n.c][0]);
      var col = -1;
      for (var o = 0; o < ordem.length; o++) {
        if (livreApos[ordem[o]] < n.t - 30) { col = ordem[o]; break; }
      }
      if (col === -1) {                       // tudo ocupado ali perto: pega a coluna livre mais próxima
        for (var d = 0; d < k && col === -1; d++) {
          var a = pref - d, b = pref + d;
          if (a >= 0 && livreApos[a] < n.t - 30) col = a;
          else if (b < k && livreApos[b] < n.t - 30) col = b;
        }
      }
      if (col === -1) continue;              // não cabe em lugar nenhum: some (raríssimo)
      livreApos[col] = Math.max(n.t, n.fim || 0);
      saida.push({ t: n.t, c: col, fim: n.fim, j: null, jc: null, seg: false, solto: false, pausado: false });
    }
    return saida;
  }

  /* ── Feito pra 2 polegares ──────────────────────────────────────
     No celular, enquanto um polegar segura a nota longa, só o OUTRO está
     livre. Então, durante cada longa (até 100 ms depois do fim):
       · nota do MESMO lado da longa vai pro lado oposto (espelho c → k-1-c);
       · nunca 2 notas juntas (acorde vira nota única);
       · nunca outra longa por cima (a de dentro vira toque simples).
     Se o espelho cair num lugar ocupado, a nota sai. Longa na coluna do
     meio (5K/7K) deixa os dois lados livres, mas continua sem acorde.
     Os mapas 4K já vêm assim (adicionar_holds.py faz o mesmo); aqui
     garante o 5K/7K convertido e qualquer mapa feito à mão. */
  function _rtLado(c, k) { var m = (k - 1) / 2; return c < m ? 'e' : (c > m ? 'd' : 'meio'); }
  function _rtAjustarDedos(notas, k) {
    var fora = {};
    for (var i = 0; i < notas.length; i++) {
      var h = notas[i];
      if (fora[i] || !h.fim) continue;
      var lh = _rtLado(h.c, k), usados = {};
      for (var j = 0; j < notas.length; j++) {
        var n = notas[j];
        if (j === i || fora[j] || n.t < h.t) continue;
        if (n.t > h.fim + 100) break;
        if (n.fim) n.fim = 0;                                  // longa dentro de longa: vira toque
        if (lh !== 'meio' && _rtLado(n.c, k) === lh) n.c = k - 1 - n.c;  // pro outro polegar
        if (usados[n.t] || n.c === h.c) { fora[j] = true; continue; }    // acorde/colisão: sai
        usados[n.t] = true;
      }
    }
    var saida = [];
    for (var x = 0; x < notas.length; x++) if (!fora[x]) saida.push(notas[x]);
    saida.sort(function (a, b) { return a.t - b.t || a.c - b.c; });
    return saida;
  }

  function _rtIniciar(mapa) {
    _rtMapa = mapa;
    var off = Number(mapa.offset) || 0;
    var keysMapa = RT_MODOS_K.indexOf(Number(mapa.keys)) !== -1 ? Number(mapa.keys) : 4;
    var notas = [];
    for (var i = 0; i < mapa.notes.length; i++) {
      var n = mapa.notes[i];
      var c = Math.round(Number(n.column));
      var t = Number(n.time) + off;
      if (!(c >= 0 && c < keysMapa) || !isFinite(t)) continue;
      // nota longa: "length" em ms; menos de 120 ms vira toque simples
      var len = Math.round(Number(n.length) || 0);
      notas.push({ t: t, c: c, fim: len >= 120 ? t + len : 0, j: null, jc: null, seg: false, solto: false, pausado: false });
    }
    notas.sort(function (a, b) { return a.t - b.t || a.c - b.c; });
    if (keysMapa !== _rtK) notas = (keysMapa === 4) ? _rtConverterK(notas, _rtK) : [];
    notas = _rtAjustarDedos(notas, _rtK);
    _rtNotas = notas;
    _rtPorCol = [];
    _rtPonteiro = [];
    for (var cc = 0; cc < _rtK; cc++) { _rtPorCol.push([]); _rtPonteiro.push(0); }
    _rtTotal = 0;
    var ultima = 0;
    for (var k = 0; k < _rtNotas.length; k++) {
      var nk = _rtNotas[k];
      _rtPorCol[nk.c].push(nk);
      _rtTotal += nk.fim ? 2 : 1;
      ultima = Math.max(ultima, nk.fim || nk.t);
    }
    _rtDesenhoIni = 0;
    // Termina 2,5 s depois da última nota (ou no fim do áudio, o que vier
    // primeiro) — músicas com outro longo não prendem a pessoa à toa.
    _rtFim = Math.min(_rtBuf.duration * 1000, ultima + 2500);
    _rtSaindo = false;
    _rtPausado = false; _rtPausaMs = 0; _rtPausaDesde = 0;
    _rtInicioReal = Date.now();
    _rtPadSnapshot();
    _rtTocarDe(-RT_LEAD_S * 1000, 0);
    _rtEstado = 'jogando';
    _rtAviso('');
    _rtMenuPartida(true);
    _rtLoopIniciar();
  }

  function _rtPararPartida() {
    _rtTokenCarga++;
    if (_rtRAF) { cancelAnimationFrame(_rtRAF); _rtRAF = 0; }
    _rtPararFonte();
    _rtPausado = false;
    _rtSaindo = false;
    _rtMenuPartida(false);
    if (_rtEstado === 'jogando' || _rtEstado === 'carregando') _rtEstado = 'selecao';
  }

  function _rtLoopIniciar() {
    if (_rtRAF) cancelAnimationFrame(_rtRAF);
    _rtRAF = requestAnimationFrame(_rtLoop);
  }

  function _rtLoop(ts) {
    _rtRAF = 0;
    if (_rtEstado !== 'jogando') return;
    var agora = _rtAgoraMs();
    var dt = _rtUltimoFrame ? Math.min(100, ts - _rtUltimoFrame) : 16;
    _rtUltimoFrame = ts;
    _rtPadPoll();
    if (!_rtPausado && !_rtFalhou) {
      _rtVerificarPassadas(agora);
      _rtVerificarLongas(agora);
      // som ligado/desligado pelo menu de pausa vale na hora
      if (_rtGanho && !_rtSaindo) {
        var alvo = _rtSomAtivo() ? 1 : 0;
        if (_rtGanho.gain.value !== alvo) _rtGanho.gain.setValueAtTime(alvo, _rtCtx.currentTime);
      }
      if (agora >= _rtFim && !_rtSaindo) _rtTerminar();
    }
    for (var i = 0; i < _rtK; i++) {
      // segurando uma longa: a pista fica acesa (brilho mínimo 0,55)
      _rtBrilho[i] = Math.max(_rtSegurando[i] ? 0.55 : 0, _rtBrilho[i] - dt / 180);
      // receptor afunda rápido ao tocar (~35 ms) e volta um pouco mais devagar
      var alvoAp = _rtApertada[i] > 0 ? 1 : 0;
      _rtAperto[i] += (alvoAp - _rtAperto[i]) * Math.min(1, dt / (alvoAp ? 35 : 70));
    }
    _rtDesenhar(agora);
    _rtRAF = requestAnimationFrame(_rtLoop);
  }

  // Notas que passaram da janela sem toque viram Erro (a longa perde a
  // cabeça E o fim — 2 erros, não dá pra "pegar no meio").
  function _rtVerificarPassadas(agora) {
    for (var c = 0; c < _rtK; c++) {
      var lista = _rtPorCol[c];
      while (_rtPonteiro[c] < lista.length) {
        var n = lista[_rtPonteiro[c]];
        if (n.j) { _rtPonteiro[c]++; continue; }
        if (agora - n.t > RT_JANELAS.erro) {
          _rtJulgar(n, 'erro', agora - n.t);
          if (n.fim) _rtFinalizarLonga(n, 'erro', true);
          _rtPonteiro[c]++;
        } else break;
      }
    }
  }

  // Longas: segurou até o fim → Perfeito automático. Longa interrompida
  // pela pausa e não "pega de volta" até o fim → Bom (a pausa não pune).
  function _rtVerificarLongas(agora) {
    for (var c = 0; c < _rtK; c++) {
      var n = _rtSegurando[c];
      if (n && agora >= n.fim) {
        _rtSegurando[c] = null;
        n.seg = false;
        _rtFinalizarLonga(n, 'perfeito');
        _rtEfeitoAcerto(c, 'perfeito');
      }
    }
    for (var i = _rtLongasPausadas.length - 1; i >= 0; i--) {
      var p = _rtLongasPausadas[i];
      if (p.jc) { _rtLongasPausadas.splice(i, 1); continue; }
      if (agora >= p.fim) { p.pausado = false; _rtFinalizarLonga(p, 'bom'); _rtLongasPausadas.splice(i, 1); }
    }
  }

  // Toque numa coluna: pega a nota mais antiga ainda não julgada dela.
  function _rtTocar(c) {
    if (_rtEstado !== 'jogando' || _rtPausado || _rtFalhou) return;
    var agora = _rtAgoraMs();
    // Voltou da pausa no meio de uma longa: tocar de novo na coluna "pega" ela.
    for (var i = 0; i < _rtLongasPausadas.length; i++) {
      var p = _rtLongasPausadas[i];
      if (p.c === c && !p.jc && agora < p.fim) {
        p.pausado = false; p.seg = true; _rtSegurando[c] = p;
        _rtLongasPausadas.splice(i, 1);
        return;
      }
    }
    var lista = _rtPorCol[c];
    while (_rtPonteiro[c] < lista.length && lista[_rtPonteiro[c]].j) _rtPonteiro[c]++;
    var n = lista[_rtPonteiro[c]];
    if (!n) return;
    var dt = agora - n.t;              // < 0 = adiantado, > 0 = atrasado
    if (dt < -RT_JANELAS.erro) return; // cedo demais: toque "no vazio", sem punição
    var a = Math.abs(dt), tipo;
    if (a <= RT_JANELAS.perfeito) tipo = 'perfeito';
    else if (a <= RT_JANELAS.otimo) tipo = 'otimo';
    else if (a <= RT_JANELAS.bom) tipo = 'bom';
    else tipo = 'erro';
    _rtJulgar(n, tipo, dt);
    _rtPonteiro[c]++;
    if (tipo !== 'erro') {
      _rtEfeitoAcerto(c, tipo); _rtDesvioSoma += dt; _rtDesvioN++;
      if (n.fim) { n.seg = true; _rtSegurando[c] = n; }       // começou a segurar
    } else if (n.fim) {
      _rtFinalizarLonga(n, 'erro', true);                       // errou a cabeça: perde a longa
    }
  }

  // Soltou o dedo/tecla: se estava segurando uma longa, julga o fim.
  // Até 90 ms antes do fim = Perfeito; até 170 ms = Bom; antes disso = Erro
  // ("SOLTOU CEDO" — quebra o combo e, no Hard, tira vida).
  function _rtSoltar(c) {
    var n = _rtSegurando[c];
    if (!n || _rtPausado) return;
    _rtSegurando[c] = null;
    n.seg = false;
    var cedo = n.fim - _rtAgoraMs();
    if (cedo <= RT_JANELAS.otimo) { _rtFinalizarLonga(n, 'perfeito'); _rtEfeitoAcerto(c, 'perfeito'); }
    else if (cedo <= RT_JANELAS.erro) { _rtFinalizarLonga(n, 'bom'); _rtEfeitoAcerto(c, 'bom'); }
    else { n.solto = true; _rtFinalizarLonga(n, 'erro'); }
  }

  /* ── Efeito de acerto: acende a pista, dispara o anel e solta
     poucas partículas (4–8) do receptor, que somem em ~0,4 s. As
     partículas vêm de um pool fixo de RT_PART_MAX objetos, reusado em
     roda (o mais antigo é sobrescrito) — nunca cresce, nunca gera lixo. */
  function _rtEfeitoAcerto(c, tipo) {
    _rtBrilho[c] = 1;
    var agora = performance.now();
    _rtAnel[c] = agora;
    _rtAnelForca[c] = tipo === 'perfeito' ? 1 : (tipo === 'otimo' ? 0.8 : 0.6);
    if (!_rtW) return;
    var L = _rtLayout(), cx = L.x0 + c * L.lw + L.lw / 2, raio = _rtRaioNota(L.lw);
    var cor = _rtCorCol(_rtSkinAtual || RT_SKIN_PADRAO, c, _rtK);
    var qtd = RT_PART_QTD[tipo] || 4;
    for (var i = 0; i < qtd; i++) {
      var p = _rtParts[_rtPartProx];
      _rtPartProx = (_rtPartProx + 1) % RT_PART_MAX;
      // leque pra cima (±65°) a partir da borda do receptor
      var ang = -Math.PI / 2 + ((i + Math.random()) / qtd - 0.5) * 2.3;
      var vel = 0.16 + Math.random() * 0.2;              // px/ms
      p.x = cx + Math.cos(ang) * raio * 0.7;
      p.y = L.hitY + Math.sin(ang) * raio * 0.7;
      p.vx = Math.cos(ang) * vel;
      p.vy = Math.sin(ang) * vel;
      p.dur = 260 + Math.random() * 160;                  // ms de vida
      p.tam = 1.6 + Math.random() * 2.2;                  // raio em px
      p.cor = (tipo === 'perfeito' && i % 3 === 0) ? '#ffffff' : cor;
      p.t0 = agora;
    }
  }

  function _rtJulgar(n, tipo, desvio) {
    n.j = tipo;
    _rtContar(tipo, desvio, null);
  }
  // semAviso: o erro da cabeça já apareceu na tela; o do fim conta calado.
  function _rtFinalizarLonga(n, tipo, semAviso) {
    if (n.jc) return;
    n.jc = tipo;
    _rtContar(tipo, null, n.solto ? 'SOLTOU CEDO' : null, semAviso, semAviso ? 'nenhuma' : (n.solto ? 'solto' : null));
  }
  // Contabiliza UM julgamento (cabeça de nota, toque ou fim de longa).
  function _rtContar(tipo, desvio, rotulo, semAviso, chaveVida) {
    _rtCont[tipo]++;
    _rtJulgadas++;
    _rtSoma += RT_VALOR[tipo];
    if (tipo === 'erro') _rtCombo = 0;
    else { _rtCombo++; if (_rtCombo > _rtComboMax) _rtComboMax = _rtCombo; }
    if (!semAviso) _rtJulgVis = { tipo: tipo, ate: performance.now() + 520, desvio: desvio, rotulo: rotulo };
    _rtEls.score.textContent = _rtFmtNum(_rtScoreAtual());
    _rtEls.acc.textContent = _rtFmtAcc(_rtPrecisao());
    _rtComboRender();
    if (_rtDif === 'hard' && !_rtFalhou && !_rtSaindo) {
      var dv = chaveVida === 'nenhuma' ? 0 : (RT_VIDA[chaveVida || tipo] || 0);
      _rtVida = Math.max(0, Math.min(1, _rtVida + dv));
      _rtVidaRender();
      if (_rtVida <= 0) _rtFalhar();
    }
  }

  /* ── Combo no canto (HUD), longe do julgamento ───────────────────
     Estilo Guitar Hero: o "PERFEITO" grande fica no alto da pista e o
     contador de acertos seguidos vive discreto sob o placar. A cada 50
     ele dá um pulinho (classe rt-combo-marco). */
  var _rtComboUlt = 0;
  function _rtComboRender() {
    var el = _rtEls.combo;
    if (!el) return;
    if (_rtCombo < 3) { el.textContent = ''; el.classList.remove('rt-combo-vivo'); _rtComboUlt = _rtCombo; return; }
    el.innerHTML = '<b>' + _rtCombo + '</b>x combo';
    el.classList.add('rt-combo-vivo');
    if (Math.floor(_rtCombo / 50) > Math.floor(_rtComboUlt / 50)) {
      el.classList.remove('rt-combo-marco'); void el.offsetWidth; el.classList.add('rt-combo-marco');
    }
    _rtComboUlt = _rtCombo;
  }

  /* ── Barra de vida (Hard) ─────────────────────────────────────── */
  function _rtVidaRender() {
    var b = _rtEls.vidaBarra;
    if (!b) return;
    var v = Math.max(0, Math.min(1, _rtVida));
    b.style.width = (v * 100).toFixed(1) + '%';
    b.style.background = v > 0.5 ? '#5eead4' : v > 0.25 ? '#fbbf24' : '#f87171';
    _rtEls.vida.classList.toggle('rt-vida-baixa', v <= 0.25);
  }
  // Vida zerou: a música "desliga" (desacelera + some) e vem a tela de Falhou.
  function _rtFalhar() {
    _rtFalhou = true;
    _rtSaindo = true;
    _rtFalhaEm = performance.now();
    _rtFalhaPos = _rtAgoraMs();
    for (var c = 0; c < _rtK; c++) _rtSegurando[c] = null;
    try {
      var t0 = _rtCtx.currentTime;
      if (_rtFonte && _rtFonte.playbackRate) {
        _rtFonte.playbackRate.setValueAtTime(1, t0);
        _rtFonte.playbackRate.linearRampToValueAtTime(0.35, t0 + 1.3);
      }
      _rtGanho.gain.cancelScheduledValues(t0);
      _rtGanho.gain.setValueAtTime(_rtGanho.gain.value, t0);
      _rtGanho.gain.linearRampToValueAtTime(0, t0 + 1.3);
    } catch (e) {}
    setTimeout(function () { if (_rtEstado === 'jogando') _rtResultado(); }, 1400);
  }

  /* ── Pontuação ───────────────────────────────────────────────────
     Estilo osu!mania: teto de 1.000.000. 90% vem da precisão de cada
     nota (Perfeito 100%, Ótimo 70%, Bom 40%, Erro 0) e 10% do combo
     máximo em relação ao total. Nota longa vale 2 julgamentos (cabeça e
     fim). */
  // Total = julgamentos possíveis (toques + cabeça e fim de cada longa).
  function _rtScoreAtual() {
    var total = _rtTotal || 1;
    return Math.round(900000 * (_rtSoma / total) + 100000 * (_rtComboMax / total));
  }
  function _rtPrecisao() { return _rtJulgadas ? (_rtSoma / _rtJulgadas) * 100 : 100; }
  function _rtFmtAcc(v) { return v.toFixed(2).replace('.', ',') + '%'; }
  function _rtFmtNum(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function _rtRank(acc, cont) {
    if (cont.erro === 0 && cont.bom === 0 && cont.otimo === 0) return 'SS';
    if (acc >= 95) return 'S';
    if (acc >= 90) return 'A';
    if (acc >= 80) return 'B';
    if (acc >= 70) return 'C';
    return 'D';
  }

  /* ── Recompensa 🪙 ──────────────────────────────────────────────
     Base pelo rank × dificuldade (Hard vale 1,5×) × colunas (5K 1,1×,
     7K 1,2×) × fator de precisão (0,5 a 1,0). Falhou (vida zerou) = 0. Rank D só paga com pelo menos 50% de precisão — sem
     isso, deixar a música tocando sozinha renderia moeda. O teto diário
     (500) e o multiplicador de evento ficam a cargo do moedasAdd. */
  var RT_MOEDAS_BASE = { SS: 30, S: 25, A: 20, B: 14, C: 9, D: 4 };
  var RT_MOEDAS_K = { 4: 1, 5: 1.1, 7: 1.2 };
  function _rtMoedas(rank, acc, dif, k) {
    if (rank === 'D' && acc < 50) return 0;
    var mult = (dif === 'hard' ? 1.5 : 1) * (RT_MOEDAS_K[k] || 1);
    return Math.max(0, Math.round(RT_MOEDAS_BASE[rank] * mult * (0.5 + 0.5 * acc / 100)));
  }

  function _rtTerminar() {
    _rtSaindo = true;
    // fade-out curto em vez de cortar a música no meio da frase
    try {
      var t0 = _rtCtx.currentTime;
      _rtGanho.gain.cancelScheduledValues(t0);
      _rtGanho.gain.setValueAtTime(_rtGanho.gain.value, t0);
      _rtGanho.gain.linearRampToValueAtTime(0, t0 + 1.2);
    } catch (e) {}
    setTimeout(function () {
      if (_rtEstado !== 'jogando') return;
      _rtResultado();
    }, 1200);
  }

  function _rtResultado() {
    if (_rtRAF) { cancelAnimationFrame(_rtRAF); _rtRAF = 0; }
    _rtPararFonte();
    _rtMenuPartida(false);
    _rtEstado = 'resultado';
    var segundos = Math.max(0, Math.round((Date.now() - _rtInicioReal - _rtPausaMs) / 1000));
    var progresso = Math.max(0, Math.min(100, Math.round(_rtFalhaPos / (_rtFim || 1) * 100)));
    var G = _rtG_();
    var q = function (id) { return document.getElementById(id); };
    var nomeMapa = _rtMusica.titulo + (_rtMusica.sub ? ' · ' + _rtMusica.sub : '') + ' — ' + (_rtDif === 'hard' ? 'Hard' : 'Normal') + ' · ' + _rtK + 'K';
    q('rt-res-musica').textContent = nomeMapa;
    q('rt-res-cidade').style.display = 'none';
    q('rt-res-dica').style.display = 'none';
    q('rt-res-denovo').textContent = _rtFalhou ? 'Tentar de novo' : 'Jogar de novo';

    /* ── Falhou (Hard, vida zerou): sem moedas, recorde nem ranking.
       Conta a partida nas stats (tempo jogado), com score 0 e 'derrota'
       no histórico — não mexe no recorde. */
    if (_rtFalhou) {
      if (G && typeof G.statsRegistrarPartida === 'function') G.statsRegistrarPartida('ritmo', { segundos: segundos, score: 0, resultado: 'derrota' });
      var rkF = q('rt-res-rank');
      rkF.textContent = 'Falhou';
      rkF.className = 'rt-res-rank rt-res-rank-falhou';
      var fm = q('rt-res-falhou-msg');
      fm.textContent = 'A vida acabou em ' + progresso + '% da música. No Hard, cada erro tira vida e cada acerto devolve um pouco.';
      fm.style.display = '';
      q('rt-res-recorde').style.display = 'none';
      q('rt-res-score').textContent = _rtFmtNum(_rtScoreAtual());
      q('rt-res-acc').textContent = _rtFmtAcc(_rtPrecisao());
      q('rt-res-combo').textContent = _rtComboMax + 'x';
      _rtResContagem();
      var meF = q('rt-res-moedas');
      meF.textContent = 'Sem moedas desta vez — termine a música pra ganhar 🪙';
      meF.style.display = '';
      meF.classList.add('rt-res-moedas-zero');
      _rtMostrar('res');
      if (G && G.som && typeof G.som.fim === 'function') { try { G.som.fim(false); } catch (e) {} }
      return;
    }
    q('rt-res-falhou-msg').style.display = 'none';

    // Garante que toda nota foi contada (quem saiu antes do fim já foi tratado).
    for (var i = 0; i < _rtNotas.length; i++) {
      var ni = _rtNotas[i];
      if (!ni.j) _rtJulgar(ni, 'erro', 0);
      if (ni.fim && !ni.jc) _rtFinalizarLonga(ni, ni.seg ? 'perfeito' : 'erro', true);
    }
    var acc = _rtPrecisao();
    var score = _rtScoreAtual();
    var rank = _rtRank(acc, _rtCont);

    // Recorde local por música + dificuldade
    var rec = _rtRecLer(), chave = _rtChaveRec(_rtMusica.id, _rtDif, _rtK);
    var antes = rec[chave];
    var novo = !antes || score > (antes.score || 0);
    if (novo) {
      rec[chave] = { score: score, acc: Math.round(acc * 100) / 100, rank: rank, combo: _rtComboMax };
      _rtRecSalvar(rec);
    }

    // Moedas + stats (mesmo padrão dos outros jogos do hub)
    var moedas = _rtMoedas(rank, acc, _rtDif, _rtK);
    if (G) {
      if (moedas > 0 && typeof G.moedasAdd === 'function') G.moedasAdd(moedas, 'ritmo');
      if (typeof G.statsRegistrarPartida === 'function') G.statsRegistrarPartida('ritmo', { segundos: segundos, score: score });
    }

    // Tela
    var rk = q('rt-res-rank');
    rk.textContent = rank;
    rk.className = 'rt-res-rank rt-r-' + rank;
    q('rt-res-recorde').style.display = (novo && antes) ? '' : 'none';
    q('rt-res-score').textContent = _rtFmtNum(score);
    q('rt-res-acc').textContent = _rtFmtAcc(acc);
    q('rt-res-combo').textContent = _rtComboMax + 'x';
    _rtResContagem();
    var me = q('rt-res-moedas');
    if (moedas > 0) { me.textContent = '+' + moedas + ' 🪙'; me.style.display = ''; }
    else { me.textContent = 'Acerte mais da metade das notas pra ganhar 🪙'; me.style.display = ''; }
    me.classList.toggle('rt-res-moedas-zero', moedas <= 0);
    _rtDicaCalibrar();
    _rtResRankCidade(score);
    _rtMostrar('res');
    if (G && G.som && typeof G.som.fim === 'function') { try { G.som.fim(RT_ORDEM_RANK[rank] >= 5); } catch (e) {} }
    if (RT_ORDEM_RANK[rank] >= 5 && G && G.efeitos) G.efeitos.confete('rt-res', 90);
  }

  function _rtResContagem() {
    document.getElementById('rt-res-cont').innerHTML =
      '<span style="color:' + RT_COR_JULG.perfeito + '">Perfeito <b>' + _rtCont.perfeito + '</b></span>' +
      '<span style="color:' + RT_COR_JULG.otimo + '">Ótimo <b>' + _rtCont.otimo + '</b></span>' +
      '<span style="color:' + RT_COR_JULG.bom + '">Bom <b>' + _rtCont.bom + '</b></span>' +
      '<span style="color:' + RT_COR_JULG.erro + '">Erro <b>' + _rtCont.erro + '</b></span>';
  }

  // Ranking da cidade deste mapa: grava (se logado) e mostra a posição.
  function _rtResRankCidade(score) {
    var el = document.getElementById('rt-res-cidade');
    var G = _rtG_();
    if (!el || !G || typeof G.rankMapaSubmeter !== 'function') return;
    var mapa = _rtMapaId(_rtMusica.id, _rtDif, _rtK);
    var logado = typeof G.estaLogado === 'function' && G.estaLogado();
    if (!logado) {
      el.innerHTML = '🏆 <button type="button" class="rt-res-cidade-login">Entre na sua conta</button> pra aparecer no ranking desta música.';
      el.style.display = '';
      el.querySelector('button').onclick = function () { if (typeof G.abrirLogin === 'function') G.abrirLogin('Entre pra aparecer no ranking do Ritmo da Coruja!'); };
      return;
    }
    el.textContent = '🏆 Enviando pro ranking da cidade…';
    el.style.display = '';
    G.rankMapaSubmeter(mapa, score).then(function (gravou) {
      delete _rtRankCache[mapa];
      return _rtRankLer(mapa, true).then(function (r) {
        if (r.erro) { el.textContent = '🏆 Ranking indisponível agora — seu recorde fica salvo neste aparelho.'; return; }
        el.innerHTML = '🏆 ' + (r.pos ? 'Você está em <b>#' + r.pos + '</b> na cidade neste mapa' : 'Seu melhor neste mapa: <b>' + _rtFmtNum(r.meu || score) + '</b> (fora do top 50)') +
          (gravou ? ' · <b>novo recorde!</b>' : '');
      });
    });
  }

  // Se os toques acertados vieram em média bem atrasados/adiantados, sugere
  // um "Atraso do áudio" novo (com botão pra aplicar na hora).
  function _rtDicaCalibrar() {
    var el = document.getElementById('rt-res-dica');
    if (!el) return;
    var media = _rtDesvioN >= 20 ? _rtDesvioSoma / _rtDesvioN : 0;
    if (Math.abs(media) < 25) { el.style.display = 'none'; return; }
    var novo = Math.max(-200, Math.min(200, Math.round((_rtCfg.ajuste + media) / 10) * 10));
    el.innerHTML = 'Seus toques vieram em média <b>' + Math.round(Math.abs(media)) + ' ms ' + (media > 0 ? 'atrasados' : 'adiantados') + '</b>. ' +
      'Quer ajustar o atraso do áudio para <b>' + (novo > 0 ? '+' : '') + novo + ' ms</b>? ' +
      '<button type="button" class="rt-res-dica-btn">Ajustar</button>';
    el.style.display = '';
    el.querySelector('button').onclick = function () {
      _rtCfg.ajuste = novo; _rtCfgSalvar(); _rtRenderAjustes();
      el.innerHTML = '✔ Atraso do áudio ajustado para ' + (novo > 0 ? '+' : '') + novo + ' ms.';
    };
  }

  /* ── Menu de pausa unificado (hub.js → AngatubaGames.menu) ───────
     Pausar para a música e guarda a posição. Continuar recomeça o áudio
     do mesmo ponto, com RT_RETOMAR_S de respiro (as notas que faltam
     voltam a descer antes, como numa contagem). */
  function _rtMenu() { var G = _rtG_(); return (G && G.menu) || window.AngatubaJogoMenu || null; }
  function _rtMenuPartida(ativa) { var M = _rtMenu(); if (M) M.partida('jogo-ritmo', ativa); }
  function _rtRegistrarMenu() {
    var M = _rtMenu();
    if (!M) return;
    M.registrar('jogo-ritmo', {
      podePausar: function () { return _rtEstado === 'jogando' && !_rtSaindo; },
      pausar: _rtPausar,
      continuar: _rtContinuar,
      descricao: function () { return _rtMusica ? _rtMusica.titulo + ' · ' + (_rtDif === 'hard' ? 'Hard' : 'Normal') + ' · ' + _rtK + 'K' : ''; },
      extra: { rotulo: 'Escolher outra música', acao: _rtMostrarSelecao }
    });
    // O hub desenha o "extra" como link de texto (.jm-link). Aqui ele vira
    // botão igual aos outros (.jm-opcao) e sobe pra antes de "Voltar aos
    // jogos". O hub só troca o texto dele a cada abertura — a classe fica.
    var tela = document.getElementById('jogo-ritmo');
    var bx = tela && tela.querySelector('.jm-overlay [data-jm="extra"]');
    var sair = tela && tela.querySelector('.jm-overlay [data-jm="sair"]');
    if (bx) {
      bx.classList.remove('jm-link');
      bx.classList.add('jm-opcao', 'rt-jm-musica');
      if (sair && sair.parentNode === bx.parentNode) sair.parentNode.insertBefore(bx, sair);
    }
    // "Recomeçar a música": botão nosso, sem data-jm (o hub ignora o clique
    // dele e não mexe nele ao redesenhar). Fica logo depois de Continuar.
    var caixa = tela && tela.querySelector('.jm-overlay .jm-caixa');
    if (caixa && !caixa.querySelector('.rt-jm-recomecar')) {
      var br = document.createElement('button');
      br.type = 'button';
      br.className = 'jm-opcao rt-jm-recomecar';
      br.innerHTML = '<i class="fa fa-rotate-left"></i><span>Recomeçar a música</span>';
      br.addEventListener('click', function (e) { e.stopPropagation(); br.blur(); _rtRecomecar(); });
      var cont = caixa.querySelector('[data-jm="continuar"]');
      caixa.insertBefore(br, cont ? cont.nextSibling : caixa.firstChild);
    }
  }
  function _rtPausar() {
    if (_rtEstado !== 'jogando' || _rtPausado || _rtFalhou) return;
    _rtPosPausa = _rtAgoraMs();
    _rtPausado = true;
    _rtPausaDesde = Date.now();
    _rtPararFonte();
    _rtAudioSuspender();
    // Longa sendo segurada: fica "pausada" — ao voltar, é só tocar de novo
    // na coluna pra continuar segurando (ver _rtTocar). Sem penalidade.
    for (var c = 0; c < _rtK; c++) {
      var n = _rtSegurando[c];
      if (n) { n.seg = false; n.pausado = true; _rtLongasPausadas.push(n); _rtSegurando[c] = null; }
      _rtApertada[c] = 0;
    }
    _rtPonteiros = {}; _rtTeclasDown = {}; _rtPadCols = {};
  }
  function _rtContinuar() {
    if (!_rtPausado || _rtEstado !== 'jogando') return;
    if (!_rtAudioGarantir()) return;   // chamado no toque em "Continuar": destrava de novo
    if (_rtPausaDesde) { _rtPausaMs += Date.now() - _rtPausaDesde; _rtPausaDesde = 0; }
    _rtPausado = false;
    // Volta a tocar RT_RETOMAR_S antes do ponto da pausa: a pessoa ouve de
    // novo o trecho final e as notas que faltam já chegam no tempo certo.
    // (posição do áudio = tempo da música + latência + ajuste — o inverso
    // de _rtAgoraMs.)
    var lat = (_rtCtx.outputLatency || _rtCtx.baseLatency || 0) * 1000;
    _rtTocarDe(_rtPosPausa + lat + _rtCfg.ajuste - (RT_RETOMAR_S * 1000), 0);
    _rtUltimoFrame = 0;
    if (!_rtRAF) _rtLoopIniciar();
  }

  /* ══════════════════════════════════════════════════════════════
     ENTRADA (toque e teclado)
  ══════════════════════════════════════════════════════════════ */
  function _rtColunaDoX(clientX) {
    var r = _rtCanvas.getBoundingClientRect();
    var L = _rtLayout();
    var x = (clientX - r.left) - L.x0;
    // fora das pistas (telas largas) conta como a pista mais perto
    return Math.max(0, Math.min(_rtK - 1, Math.floor(x / L.lw)));
  }
  function _rtPointerDown(e) {
    if (_rtEstado !== 'jogando') return;
    e.preventDefault();
    var c = _rtColunaDoX(e.clientX);
    _rtPonteiros[e.pointerId] = c;
    _rtApertada[c]++;
    try { _rtCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    _rtTocar(c);
  }
  function _rtPointerUp(e) {
    var c = _rtPonteiros[e.pointerId];
    if (c === undefined) return;
    delete _rtPonteiros[e.pointerId];
    _rtApertada[c] = Math.max(0, _rtApertada[c] - 1);
    if (!_rtApertada[c]) _rtSoltar(c);      // último dedo saiu da pista
  }
  // Tecla → coluna, conforme o modo (D F J K · D F espaço J K · S D F espaço J K L).
  function _rtColunaDaTecla(e) {
    var tecla = e.key === ' ' || e.key === 'Spacebar' ? ' ' : (e.key || '').toLowerCase();
    if (tecla.length !== 1) return undefined;
    var i = (RT_TECLAS_K[_rtK] || '').indexOf(tecla);
    return i === -1 ? undefined : i;
  }
  var _rtTeclasDown = {};
  function _rtKeyDown(e) {
    if (_rtEstado !== 'jogando') return;
    var c = _rtColunaDaTecla(e);
    if (c === undefined) return;
    if (e.repeat) { e.preventDefault(); return; }
    var tela = document.getElementById('jogo-ritmo');
    if (!tela || tela.style.display === 'none') return;
    e.preventDefault();
    if (_rtTeclasDown[c]) return;
    _rtTeclasDown[c] = true;
    _rtApertada[c]++;
    _rtTocar(c);
  }
  function _rtKeyUp(e) {
    var c = _rtColunaDaTecla(e);
    if (c === undefined || !_rtTeclasDown[c]) return;
    _rtTeclasDown[c] = false;
    _rtApertada[c] = Math.max(0, _rtApertada[c] - 1);
    if (!_rtApertada[c]) _rtSoltar(c);
  }

  /* ══════════════════════════════════════════════════════════════
     CONTROLE (Gamepad API) — ex.: Ipega 9076 no modo gamepad
     Lido a cada frame no _rtLoop (a Gamepad API não tem eventos de
     botão). Funciona junto com o toque e o teclado: cada fonte soma no
     mesmo _rtApertada[c], então segurar nota longa vale igual.
     Mapa padrão = layout "standard" do navegador (o que o Ipega 9076
     manda no modo Android/X-input). Cada coluna aceita mais de um
     botão, pra servir tanto pra quem usa gatilhos quanto D-pad + A/B/X/Y.
     Índices standard: 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT ·
     8 Select · 9 Start · 10 L3 · 11 R3 · 12 ↑ · 13 ↓ · 14 ← · 15 →
     Se o controle não for "standard" (ou a pessoa preferir), dá pra
     escolher um botão por coluna em "Configurar botões" (salvo por modo
     em _rtCfg.pad). Start pausa/continua.
  ══════════════════════════════════════════════════════════════ */
  var RT_PAD_PADRAO = {
    4: [[4, 14, 12], [6, 15, 13], [7, 2, 0], [5, 1, 3]],
    5: [[4, 14], [6, 15, 13], [0, 12], [7, 2, 3], [5, 1]],
    7: [[4, 14], [6, 13], [15], [12, 0], [2], [7, 3], [5, 1]]
  };
  var RT_PAD_NOMES = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Select', 9: 'Start', 10: 'L3', 11: 'R3', 12: '↑', 13: '↓', 14: '←', 15: '→' };
  var RT_PAD_START = 9;
  var _rtPadAntes = {};   // "gp_botão" → estava apertado no frame anterior
  var _rtPadCols = {};    // "gp_botão" → coluna que esse botão está segurando
  var _rtPadUsado = false;

  function _rtPadLista() {
    var out = [];
    try {
      var l = navigator.getGamepads ? navigator.getGamepads() : [];
      for (var i = 0; i < l.length; i++) if (l[i] && l[i].connected !== false) out.push(l[i]);
    } catch (e) {}
    return out;
  }
  function _rtPadNome(b) { return RT_PAD_NOMES[b] || ('B' + b); }
  function _rtBotaoApertado(gp, b) {
    var x = gp.buttons && gp.buttons[b];
    return !!x && (x.pressed || x.value > 0.5);
  }
  // Mapa da coluna → botões, pro modo k (personalizado tem prioridade).
  function _rtPadMapa(k) {
    var p = _rtCfg.pad && _rtCfg.pad[k];
    if (p && p.length === k) return p.map(function (b) { return [b]; });
    return RT_PAD_PADRAO[k] || RT_PAD_PADRAO[4];
  }

  // Marca como "já apertado" tudo que está pressionado agora: o Start/A
  // que acabou de começar a música não vira pausa nem toque no 1º frame.
  function _rtPadSnapshot() {
    _rtPadAntes = {}; _rtPadCols = {};
    var pads = _rtPadLista();
    for (var i = 0; i < pads.length; i++) {
      var gp = pads[i];
      for (var b = 0; b < (gp.buttons || []).length; b++) if (_rtBotaoApertado(gp, b)) _rtPadAntes[gp.index + '_' + b] = true;
    }
  }
  // Lido todo frame durante a partida.
  function _rtPadPoll() {
    var pads = _rtPadLista();
    if (!pads.length) return;
    var mapa = _rtPadMapa(_rtK), M = _rtMenu();
    for (var i = 0; i < pads.length; i++) {
      var gp = pads[i];
      // Start: pausa / continua (abre/fecha o menu unificado)
      var kS = gp.index + '_' + RT_PAD_START, apS = _rtBotaoApertado(gp, RT_PAD_START);
      if (apS && !_rtPadAntes[kS] && M && _rtEstado === 'jogando') {
        if (M.aberto && M.aberto('jogo-ritmo')) M.fechar('jogo-ritmo', true);
        else if (M.abrir) M.abrir('jogo-ritmo');
      }
      _rtPadAntes[kS] = apS;
      for (var c = 0; c < mapa.length; c++) {
        for (var j = 0; j < mapa[c].length; j++) {
          var b = mapa[c][j];
          if (b === RT_PAD_START) continue;
          var chave = gp.index + '_' + b, ap = _rtBotaoApertado(gp, b);
          if (ap && !_rtPadAntes[chave]) {
            _rtPadUsado = true;
            if (!_rtPausado && !_rtFalhou && _rtPadCols[chave] === undefined) {
              _rtPadCols[chave] = c;
              _rtApertada[c]++;
              _rtTocar(c);
            }
          } else if (!ap && _rtPadAntes[chave] && _rtPadCols[chave] !== undefined) {
            var col = _rtPadCols[chave];
            delete _rtPadCols[chave];
            _rtApertada[col] = Math.max(0, _rtApertada[col] - 1);
            if (!_rtApertada[col]) _rtSoltar(col);
          }
          _rtPadAntes[chave] = ap;
        }
      }
    }
  }

  // Indicadores "🎮 Controle conectado" (seleção) e 🎮 (HUD da partida).
  function _rtPadIndicador() {
    var tem = _rtPadLista().length > 0;
    if (_rtEls.hudPad) _rtEls.hudPad.style.display = tem ? '' : 'none';
    var dicas = document.getElementById('rt-pad-dicas');
    if (dicas) dicas.style.display = tem ? '' : 'none';
    if (_rtEls.pad) {
      _rtEls.pad.style.display = tem ? '' : 'none';
      var p = _rtPadLista()[0];
      var pers = _rtCfg.pad && _rtCfg.pad[_rtCfg.colunas];
      var txt = document.getElementById('rt-pad-txt');
      if (txt && p) txt.textContent = 'Controle conectado' + (p.mapping !== 'standard' && !pers ? ' — configure os botões' : (pers ? ' · botões personalizados' : ''));
    }
  }
  window.addEventListener('gamepadconnected', function () { _rtPadIndicador(); });
  window.addEventListener('gamepaddisconnected', function (e) {
    // Caiu no meio da música: pausa (as longas ficam "pausadas", sem
    // penalidade) e esquece os botões daquele controle.
    var idx = e && e.gamepad ? e.gamepad.index : null;
    if (_rtEstado === 'jogando' && !_rtPausado && !_rtSaindo && _rtPadUsado) {
      var M = _rtMenu();
      if (M && M.abrir) M.abrir('jogo-ritmo'); else _rtPausar();
    }
    for (var k in _rtPadAntes) if (idx === null || k.indexOf(idx + '_') === 0) delete _rtPadAntes[k];
    for (var k2 in _rtPadCols) {
      if (idx !== null && k2.indexOf(idx + '_') !== 0) continue;
      var col = _rtPadCols[k2];
      delete _rtPadCols[k2];
      if (_rtApertada[col]) _rtApertada[col] = Math.max(0, _rtApertada[col] - 1);
    }
    _rtPadIndicador();
  });

  /* ── Configurar botões (um botão por coluna, salvo por modo) ───── */
  var _rtPadCal = null;   // { k, botoes:[], antes:{}, raf }
  function _rtPadCalAbrir() {
    _rtPreviaParar();
    var k = _rtCfg.colunas;
    _rtPadCal = { k: k, botoes: [], antes: {}, raf: 0, primeiro: true };
    _rtEls.padOv.style.display = 'flex';
    _rtPadCalRender();
    _rtPadCal.raf = requestAnimationFrame(_rtPadCalPoll);
  }
  function _rtPadCalFechar() {
    if (_rtPadCal && _rtPadCal.raf) cancelAnimationFrame(_rtPadCal.raf);
    _rtPadCal = null;
    if (_rtEls.padOv) _rtEls.padOv.style.display = 'none';
    _rtPadIndicador();
  }
  function _rtPadCalRender() {
    var c = _rtPadCal; if (!c) return;
    document.getElementById('rt-pad-tit').textContent = 'Configurar controle · ' + c.k + 'K';
    var faltam = c.k - c.botoes.length;
    document.getElementById('rt-pad-msg').innerHTML = faltam > 0
      ? 'Aperte o botão da <b>coluna ' + (c.botoes.length + 1) + '</b> (da esquerda pra direita).'
      : '✔ Pronto! Botões salvos pro modo ' + c.k + 'K.';
    var html = '';
    for (var i = 0; i < c.k; i++) {
      var b = c.botoes[i];
      html += '<span class="rt-pad-slot' + (i === c.botoes.length ? ' rt-pad-slot-agora' : '') + (b !== undefined ? ' rt-pad-slot-ok' : '') + '">' + (b !== undefined ? _rtEsc(_rtPadNome(b)) : (i + 1)) + '</span>';
    }
    document.getElementById('rt-pad-slots').innerHTML = html;
  }
  function _rtPadCalPoll() {
    var c = _rtPadCal; if (!c) return;
    var pads = _rtPadLista();
    for (var i = 0; i < pads.length; i++) {
      var gp = pads[i];
      for (var b = 0; b < gp.buttons.length; b++) {
        var chave = gp.index + '_' + b, ap = _rtBotaoApertado(gp, b);
        // no 1º frame só registra o que já estava apertado (não conta)
        if (ap && !c.antes[chave] && !c.primeiro && b !== RT_PAD_START && c.botoes.length < c.k && c.botoes.indexOf(b) === -1) {
          c.botoes.push(b);
          if (c.botoes.length === c.k) {
            if (!_rtCfg.pad) _rtCfg.pad = {};
            _rtCfg.pad[c.k] = c.botoes.slice();
            _rtCfgSalvar();
            setTimeout(_rtPadCalFechar, 900);
          }
          _rtPadCalRender();
        }
        c.antes[chave] = ap;
      }
    }
    c.primeiro = false;
    c.raf = requestAnimationFrame(_rtPadCalPoll);
  }
  function _rtPadCalPadrao() {
    if (_rtCfg.pad) delete _rtCfg.pad[_rtCfg.colunas];
    _rtCfgSalvar();
    _rtPadCalFechar();
  }

  /* ══════════════════════════════════════════════════════════════
     NAVEGAÇÃO COM O CONTROLE (fora da partida)
     Um laço leve (_rtNavLoop) roda enquanto a tela do Ritmo está aberta
     e lê ↑↓←→ (D-pad ou analógico esquerdo), A, B, Y, LB/RB e Start.
     Cada tela tem seu "contexto":
       selecao  ↑↓ música (com prévia) · ←→ Normal/Hard · LB/RB 4K/5K/7K
                A jogar · B para a prévia, ou volta aos jogos · Y ranking
       pausa    ↑↓ opção · A confirma · B continua (Start é tratado no
                _rtPadPoll da partida, que segue rodando durante a pausa)
       resultado ↑↓ botão · A confirma · B escolher outra música
       top / loja / carregando: B fecha/cancela (A também fecha o top)
     Durante a partida (sem pausa) não faz nada — as colunas são do
     _rtPadPoll. Na troca de contexto, o que já estava apertado é
     ignorado até soltar (sem "A" fantasma vindo da última nota).
     O foco do controle aparece com a classe .rt-foco.
  ══════════════════════════════════════════════════════════════ */
  var RT_NAV = { cima: 12, baixo: 13, esq: 14, dir: 15, a: 0, b: 1, y: 3, lb: 4, rb: 5, select: 8 };
  var _rtNav = { raf: 0, ctx: '', antes: {}, desde: {}, rep: {}, foco: 0, previaT: 0 };

  function _rtNavIniciar() {
    if (_rtNav.raf) return;
    _rtNav.raf = requestAnimationFrame(_rtNavLoop);
  }
  function _rtNavCtx() {
    var tela = document.getElementById('jogo-ritmo');
    if (!tela || tela.style.display === 'none' || !_rtRoot) return null;
    if (_rtPadCal) return 'cal';
    var loja = document.getElementById('lojajogo-overlay');
    if (loja && loja.style.display !== 'none' && loja.parentNode === tela) return 'loja';
    if (_rtEls.topOv && _rtEls.topOv.style.display !== 'none') return 'top';
    if (_rtEstado === 'jogando') { var M = _rtMenu(); return (M && M.aberto && M.aberto('jogo-ritmo')) ? 'pausa' : 'jogo'; }
    if (_rtEstado === 'carregando') return 'carregando';
    if (_rtEstado === 'resultado') return 'resultado';
    return 'selecao';
  }
  // Estado "lógico" de cada comando juntando todos os controles + analógico.
  function _rtNavLer() {
    var st = {}, pads = _rtPadLista();
    for (var i = 0; i < pads.length; i++) {
      var gp = pads[i], ax = gp.axes || [];
      for (var nome in RT_NAV) if (_rtBotaoApertado(gp, RT_NAV[nome])) st[nome] = true;
      if (_rtBotaoApertado(gp, RT_PAD_START)) st.start = true;
      if ((ax[1] || 0) < -0.6) st.cima = true;
      if ((ax[1] || 0) > 0.6) st.baixo = true;
      if ((ax[0] || 0) < -0.6) st.esq = true;
      if ((ax[0] || 0) > 0.6) st.dir = true;
    }
    return st;
  }
  function _rtNavLoop() {
    _rtNav.raf = 0;
    var ctx = _rtNavCtx();
    if (!ctx) { _rtNavFocoLimpar(); _rtNav.ctx = ''; return; }   // tela fechada: o laço para (preparar() religa)
    var st = _rtNavLer(), agora = performance.now();
    if (ctx !== _rtNav.ctx) {
      // trocou de tela: o que já está apertado não conta até soltar
      _rtNav.antes = {}; for (var k0 in st) _rtNav.antes[k0] = true;
      _rtNav.ctx = ctx; _rtNav.foco = 0;
      _rtNavFocoLimpar();
      if (ctx === 'resultado') {                                   // foco inicial: "Jogar de novo"
        var li = _rtNavItens(ctx), d = document.getElementById('rt-res-denovo');
        if (li.indexOf(d) !== -1) _rtNav.foco = li.indexOf(d);
      }
      if (ctx === 'pausa' || ctx === 'resultado') _rtNavFocoAplicar();
    }
    var ev = [];
    ['cima', 'baixo', 'esq', 'dir', 'a', 'b', 'y', 'lb', 'rb', 'select', 'start'].forEach(function (n) {
      var ap = !!st[n];
      if (ap && !_rtNav.antes[n]) { ev.push(n); _rtNav.desde[n] = agora; _rtNav.rep[n] = agora; }
      else if (ap && (n === 'cima' || n === 'baixo') && agora - _rtNav.desde[n] > 420 && agora - _rtNav.rep[n] > 120) {
        ev.push(n); _rtNav.rep[n] = agora;                       // segurar ↑/↓ rola a lista
      }
      _rtNav.antes[n] = ap;
    });
    for (var i = 0; i < ev.length; i++) _rtNavAcao(ctx, ev[i]);
    if (_rtNav.previaT && agora >= _rtNav.previaT && _rtEstado === 'selecao') {
      _rtNav.previaT = 0;
      var m = _rtMusicaPorId(_rtSelId);
      if (m && _rtPrev.id !== m.id && _rtPrev.carregando !== m.id) _rtPreviaTocar(m);
    }
    _rtNav.raf = requestAnimationFrame(_rtNavLoop);
  }

  // Botões navegáveis de cada contexto (só os visíveis).
  function _rtNavItens(ctx) {
    var tela = document.getElementById('jogo-ritmo'), sel;
    if (ctx === 'pausa') sel = '.jm-overlay .jm-caixa button';
    else if (ctx === 'resultado') sel = '#rt-res button';
    else return [];
    var l = Array.prototype.slice.call(tela.querySelectorAll(sel)).filter(function (b) {
      return b.offsetParent !== null && !b.disabled;
    });
    if (ctx === 'resultado') {
      var v = tela.querySelector('.jogo-voltar');                // "Voltar aos jogos" no topo
      if (v && v.offsetParent !== null) l.push(v);
    }
    return l;
  }
  function _rtNavFocoLimpar() {
    var l = document.querySelectorAll('#jogo-ritmo .rt-foco');
    for (var i = 0; i < l.length; i++) l[i].classList.remove('rt-foco');
  }
  function _rtNavFocoAplicar() {
    _rtNavFocoLimpar();
    var l = _rtNavItens(_rtNav.ctx);
    if (!l.length) return;
    _rtNav.foco = Math.max(0, Math.min(l.length - 1, _rtNav.foco));
    l[_rtNav.foco].classList.add('rt-foco');
    try { l[_rtNav.foco].scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }

  function _rtNavAcao(ctx, n) {
    var M = _rtMenu();
    if (ctx === 'jogo' || ctx === 'cal') return;
    if (ctx === 'loja') { if (n === 'b' && typeof window.lojaJogoFechar === 'function') window.lojaJogoFechar(); return; }
    if (ctx === 'top') { if (n === 'b' || n === 'a' || n === 'y') _rtTopFechar(); return; }
    if (ctx === 'carregando') { if (n === 'b') _rtMostrarSelecao(); return; }
    if (ctx === 'pausa' || ctx === 'resultado') {
      var l = _rtNavItens(ctx);
      if (n === 'cima' || n === 'baixo') {
        if (!l.length) return;
        _rtNav.foco = (_rtNav.foco + (n === 'baixo' ? 1 : -1) + l.length) % l.length;
        _rtNavFocoAplicar();
      } else if (n === 'a') {
        var alvo = l[_rtNav.foco];
        if (alvo) { _rtNavFocoLimpar(); alvo.click(); }
      } else if (n === 'b') {
        if (ctx === 'pausa' && M && M.fechar) M.fechar('jogo-ritmo', true);
        else if (ctx === 'resultado') _rtMostrarSelecao();
      }
      return;
    }
    // ── seleção ──
    if (n === 'cima' || n === 'baixo') {
      var i = 0;
      for (var j = 0; j < RT_CATALOGO.length; j++) if (RT_CATALOGO[j].id === _rtSelId) i = j;
      i = Math.max(0, Math.min(RT_CATALOGO.length - 1, i + (n === 'baixo' ? 1 : -1)));
      if (RT_CATALOGO[i].id !== _rtSelId) {
        _rtPreviaParar();
        _rtSelId = RT_CATALOGO[i].id;
        _rtMostrarErro('');
        _rtRenderSelecao();
        var card = _rtEls.lista.querySelector('.rt-musica-sel');
        if (card) { try { card.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
        _rtNav.previaT = performance.now() + 450;                // prévia depois de parar de rolar
      }
    } else if (n === 'esq' || n === 'dir') {
      var dif = n === 'dir' ? 'hard' : 'normal';
      if (dif !== _rtCfg.dif) { _rtCfg.dif = dif; _rtCfgSalvar(); _rtRenderSelecao(); }
    } else if (n === 'lb' || n === 'rb') {
      var ik = RT_MODOS_K.indexOf(_rtCfg.colunas);
      ik = Math.max(0, Math.min(RT_MODOS_K.length - 1, ik + (n === 'rb' ? 1 : -1)));
      if (RT_MODOS_K[ik] !== _rtCfg.colunas) { _rtCfg.colunas = RT_MODOS_K[ik]; _rtCfgSalvar(); _rtRenderSelecao(); }
    } else if (n === 'a' || n === 'start') {
      _rtNav.previaT = 0;
      _rtComecar(_rtSelId, _rtCfg.dif);
    } else if (n === 'b') {
      _rtNav.previaT = 0;
      if (_rtPrev.id || _rtPrev.carregando) _rtPreviaParar();      // 1º B: para a prévia
      else if (typeof window._voltarAoMenu === 'function') window._voltarAoMenu();   // 2º B: sai
    } else if (n === 'y') {
      _rtTopAbrir();
    } else if (n === 'select') {
      _rtPadCalAbrir();
    }
  }

  /* ── Recomeçar a música (menu de pausa) ──────────────────────────
     Mesma música, mesma dificuldade e mesmo nº de colunas, do zero.
     A música já está decodificada na memória → começa na hora. */
  function _rtRecomecar() {
    if (!_rtMusica) return;
    var M = _rtMenu();
    if (M && M.fechar) M.fechar('jogo-ritmo', false);            // fecha o menu SEM continuar
    _rtComecar(_rtMusica.id, _rtDif);
  }

  /* ══════════════════════════════════════════════════════════════
     DESENHO (canvas)
  ══════════════════════════════════════════════════════════════ */
  function _rtRedimensionar() {
    if (!_rtCanvas || !_rtEls.jogo || _rtEls.jogo.style.display === 'none') return;
    var r = _rtCanvas.getBoundingClientRect();
    _rtDpr = Math.min(2, window.devicePixelRatio || 1);
    _rtW = Math.max(1, Math.round(r.width));
    _rtH = Math.max(1, Math.round(r.height));
    _rtCanvas.width = Math.round(_rtW * _rtDpr);
    _rtCanvas.height = Math.round(_rtH * _rtDpr);
  }
  // Pistas centralizadas: no celular ocupam a largura toda; em tela
  // larga ficam com no máximo RT_LARGURA_MAX[k] px cada.
  function _rtLayout() {
    var k = _rtK || 4;
    var lw = Math.min(_rtW / k, RT_LARGURA_MAX[k] || 110);
    var x0 = (_rtW - lw * k) / 2;
    var hitY = _rtH - Math.max(96, Math.min(150, _rtH * 0.15));
    return { lw: lw, x0: x0, hitY: hitY };
  }
  // Raio das notas/receptores: cabe na pista com folga, nunca gigante.
  function _rtRaioNota(lw) { return Math.max(12, Math.min(lw * 0.36, 40)); }

  /* ── Nota redonda, no estilo da skin ─────────────────────────────
     gema  : borda colorida, anel escuro e miolo claro (clássica)
     flat  : disco liso com contorno fino (minimal)
     olho  : íris colorida, pupila preta e brilho (Olho de Coruja)
     neon  : anel brilhante, miolo escuro (Neon) — brilho feito com um
             círculo translúcido maior em vez de shadowBlur (pesado no celular)
     ouro  : gradiente metálico + estrelinha que gira (Ouro Real) */
  function _rtDesenharNota(g, x, y, r, cor, estilo) {
    var PI2 = Math.PI * 2;
    function disco(rr, f) { g.beginPath(); g.arc(x, y, rr, 0, PI2); g.fillStyle = f; g.fill(); }
    if (estilo === 'flat') {
      disco(r, cor);
      g.lineWidth = Math.max(1.5, r * 0.1); g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.arc(x, y, r * 0.92, 0, PI2); g.stroke();
      return;
    }
    if (estilo === 'olho') {
      disco(r, '#1c1206');
      var gi = g.createRadialGradient(x, y, r * 0.2, x, y, r * 0.88);
      gi.addColorStop(0, '#fde68a'); gi.addColorStop(1, cor);
      disco(r * 0.86, gi);
      disco(r * 0.4, '#0b0b0b');
      disco(r * 0.14, 'rgba(255,255,255,0.9)');
      g.beginPath(); g.arc(x - r * 0.22, y - r * 0.24, r * 0.12, 0, PI2); g.fillStyle = '#fff'; g.fill();
      return;
    }
    if (estilo === 'neon') {
      var a0 = g.globalAlpha;
      g.globalAlpha = a0 * 0.22; disco(r * 1.3, cor);
      g.globalAlpha = a0;
      disco(r, 'rgba(8,4,20,0.85)');
      g.lineWidth = Math.max(2.5, r * 0.2); g.strokeStyle = cor;
      g.beginPath(); g.arc(x, y, r * 0.8, 0, PI2); g.stroke();
      disco(r * 0.22, cor);
      return;
    }
    if (estilo === 'ouro') {
      var go = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      go.addColorStop(0, '#fffbeb'); go.addColorStop(0.45, cor); go.addColorStop(1, '#78350f');
      disco(r, go);
      g.lineWidth = Math.max(1.5, r * 0.09); g.strokeStyle = '#fde68a';
      g.beginPath(); g.arc(x, y, r * 0.93, 0, PI2); g.stroke();
      // estrelinha de 4 pontas girando
      var ang = (performance.now() / 600) % PI2, sr = r * 0.42;
      g.save(); g.translate(x + r * 0.28, y - r * 0.3); g.rotate(ang);
      g.beginPath();
      for (var i = 0; i < 8; i++) {
        var rr = i % 2 ? sr * 0.28 : sr, ai = i * Math.PI / 4;
        g.lineTo(Math.cos(ai) * rr, Math.sin(ai) * rr);
      }
      g.closePath(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
      g.restore();
      return;
    }
    // gema (padrão)
    disco(r, cor);
    disco(r * 0.66, 'rgba(12,8,28,0.55)');
    disco(r * 0.42, cor);
    disco(r * 0.42, 'rgba(255,255,255,0.55)');
    g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.22, 0, PI2); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
  }

  // Corpo da nota longa: faixa arredondada entre a cabeça (y1) e o fim (y0).
  function _rtDesenharCorpo(g, x, y0, y1, larg, cor, alfa) {
    if (y1 <= y0) return;
    var a0 = g.globalAlpha;
    g.globalAlpha = a0 * alfa;
    var rr = larg / 2;
    g.beginPath();
    g.moveTo(x - rr, y1);
    g.lineTo(x - rr, y0 + rr);
    g.arc(x, y0 + rr, rr, Math.PI, 0);
    g.lineTo(x + rr, y1);
    g.closePath();
    g.fillStyle = cor; g.fill();
    g.globalAlpha = a0;
  }

  function _rtDesenhar(agora) {
    var g = _rtG;
    if (!g || !_rtW) return;
    g.setTransform(_rtDpr, 0, 0, _rtDpr, 0, 0);
    var K = _rtK || 4;
    var L = _rtLayout(), lw = L.lw, x0 = L.x0, hitY = L.hitY;
    var queda = _rtTempoQueda();
    var px = hitY / queda;          // pixels por ms
    var skin = _rtSkinAtual || _rtSkin();
    var pista = _rtPistaAtual || RT_PISTA_PADRAO;
    var PI2 = Math.PI * 2;
    var pn = performance.now();

    // Fundo: imagem equipada (cópia já escalada → 1 drawImage 1:1) ou,
    // no padrão / enquanto a imagem carrega, o fundo escuro do CSS.
    var fundo = _rtFundoAtual ? _rtFundoPronto(_rtFundoAtual) : null;
    if (fundo) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(fundo, 0, 0);
      g.setTransform(_rtDpr, 0, 0, _rtDpr, 0, 0);
      g.fillStyle = RT_FUNDO_VEU_PISTA;          // véu extra só onde as notas passam
      g.fillRect(x0, 0, lw * K, _rtH);
    } else {
      g.clearRect(0, 0, _rtW, _rtH);
    }

    // Fundo das pistas (cores da skin de pista)
    for (var c = 0; c < K; c++) {
      var x = x0 + c * lw;
      g.fillStyle = pista.faixa[c % 2];
      g.fillRect(x, 0, lw, _rtH);
      if (_rtApertada[c] > 0) {
        var grad = g.createLinearGradient(0, hitY, 0, hitY - _rtH * 0.45);
        grad.addColorStop(0, 'rgba(' + pista.aperto + ',0.22)');
        grad.addColorStop(1, 'rgba(' + pista.aperto + ',0)');
        g.fillStyle = grad;
        g.fillRect(x, 0, lw, hitY);
      }
    }
    // Divisórias: halo largo e translúcido por baixo (skins com brilho) + linha fina
    if (pista.brilho) {
      g.fillStyle = pista.brilho;
      for (var sb = 0; sb <= K; sb++) g.fillRect(x0 + sb * lw - 2.5, 0, 5, _rtH);
    }
    g.fillStyle = pista.linha;
    for (var s = 0; s <= K; s++) g.fillRect(x0 + s * lw, 0, 1, _rtH);

    // Linha de acerto + receptores (no estilo da skin de nota)
    var raio = _rtRaioNota(lw);
    if (pista.brilho) { g.fillStyle = pista.brilho; g.fillRect(x0, hitY - 4, lw * K, 8); }
    g.strokeStyle = pista.acerto;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, hitY); g.lineTo(x0 + lw * K, hitY); g.stroke();
    for (var r = 0; r < K; r++) {
      var cxr = x0 + r * lw + lw / 2, corR = _rtCorCol(skin, r, K);
      var ap = _rtAperto[r] || 0;                                   // 0 solto → 1 pressionado
      var idadeA = pn - (_rtAnel[r] || 0);                          // ms desde o último acerto
      var pop = idadeA < 140 ? (1 - idadeA / 140) * 0.1 : 0;        // "quique" no acerto
      var rr = raio * (1 - 0.1 * ap + pop);
      // halo da cor da pista quando pressiona (círculo translúcido, sem shadowBlur)
      if (ap > 0.02) {
        g.globalAlpha = 0.2 * ap;
        g.beginPath(); g.arc(cxr, hitY, raio * 1.28, 0, PI2); g.fillStyle = corR; g.fill();
      }
      // base escura + "fantasma" da própria nota (gema, neon, ouro, olho, flat)
      g.globalAlpha = 1;
      g.beginPath(); g.arc(cxr, hitY, rr, 0, PI2); g.fillStyle = 'rgba(6,9,16,0.82)'; g.fill();
      g.globalAlpha = 0.24 + 0.46 * ap;
      _rtDesenharNota(g, cxr, hitY, rr * 0.74, corR, skin.estilo);
      // anel grosso na cor da skin
      g.globalAlpha = 0.72 + 0.28 * ap;
      g.lineWidth = Math.max(3.5, raio * 0.19);
      g.strokeStyle = corR;
      g.beginPath(); g.arc(cxr, hitY, rr * 0.93, 0, PI2); g.stroke();
      // fio claro por dentro do anel quando pressionado
      if (ap > 0.02) {
        g.globalAlpha = 0.55 * ap;
        g.lineWidth = Math.max(1.5, raio * 0.06);
        g.strokeStyle = '#ffffff';
        g.beginPath(); g.arc(cxr, hitY, rr * 0.8, 0, PI2); g.stroke();
      }
      g.globalAlpha = 1;
      if (_rtBrilho[r] > 0) {
        // faísca subindo pela pista (também acesa enquanto segura uma longa)
        var b = _rtBrilho[r];
        var fg = g.createLinearGradient(0, hitY, 0, hitY - 130);
        fg.addColorStop(0, corR);
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = fg;
        g.globalAlpha = b * 0.35;
        g.fillRect(x0 + r * lw + lw * 0.18, hitY - 130, lw * 0.64, 130);
        g.globalAlpha = 1;
      }
      if (idadeA < RT_ANEL_MS) {
        // anel de acerto: clarão no receptor + onda que abre e afina
        var va = idadeA / RT_ANEL_MS, fa = _rtAnelForca[r] || 0.6, sai = 1 - (1 - va) * (1 - va);
        if (va < 0.35) {
          g.globalAlpha = (1 - va / 0.35) * 0.45 * fa;
          g.beginPath(); g.arc(cxr, hitY, raio * (0.95 + 0.2 * va), 0, PI2); g.fillStyle = '#ffffff'; g.fill();
        }
        g.globalAlpha = (1 - va) * fa;
        g.lineWidth = Math.max(1, raio * 0.22 * (1 - va));
        g.strokeStyle = corR;
        g.beginPath(); g.arc(cxr, hitY, raio * (1 + sai * (0.55 + 0.35 * fa)), 0, PI2); g.stroke();
        g.globalAlpha = 1;
      }
    }


    // Notas visíveis: do ponteiro de desenho até sair pelo topo.
    // Uma nota sai da lista quando já foi resolvida e passou da linha
    // (longas: quando o FIM passou, ou foi completada).
    while (_rtDesenhoIni < _rtNotas.length) {
      var n0 = _rtNotas[_rtDesenhoIni], fim0 = n0.fim || n0.t;
      var resolvida = n0.fim ? (n0.jc && (n0.jc !== 'erro' || agora - fim0 > 400)) : (n0.j && agora > n0.t);
      if (resolvida || agora - fim0 > RT_JANELAS.erro + 400) _rtDesenhoIni++;
      else break;
    }
    var larg = raio * 1.05;
    for (var i = _rtDesenhoIni; i < _rtNotas.length; i++) {
      var n = _rtNotas[i];
      var dtn = n.t - agora;
      if (dtn > queda * 1.05) break;
      var cx = x0 + n.c * lw + lw / 2, cor = _rtCorCol(skin, n.c, K);
      var y = hitY - dtn * px;
      if (n.fim) {
        if (n.jc && n.jc !== 'erro') continue;               // completada: some
        var yFim = Math.max(-raio, hitY - (n.fim - agora) * px);
        var morta = n.solto || n.j === 'erro' || n.jc === 'erro';
        var yCab = n.seg ? hitY : y;                         // segurando: cabeça presa na linha
        if (morta) {
          _rtDesenharCorpo(g, cx, yFim, yCab, larg, 'rgba(148,163,184,1)', 0.28);
        } else {
          _rtDesenharCorpo(g, cx, yFim, yCab, larg, cor, n.seg ? 0.85 : 0.5);
          if (n.seg) {
            // brilho correndo pelo corpo enquanto segura
            var faixa = (performance.now() / 4) % 60;
            g.globalAlpha = 0.35; g.fillStyle = '#fff';
            for (var fy = yCab - faixa; fy > yFim + 6; fy -= 60) g.fillRect(cx - larg * 0.18, fy - 10, larg * 0.36, 10);
            g.globalAlpha = 1;
          }
        }
        // ponta do fim
        g.globalAlpha = morta ? 0.3 : 1;
        g.beginPath(); g.arc(cx, yFim, raio * 0.42, 0, Math.PI * 2);
        g.fillStyle = morta ? '#94a3b8' : cor; g.fill();
        g.globalAlpha = morta ? 0.3 : 1;
        if (yCab > -raio && yCab < _rtH + raio) _rtDesenharNota(g, cx, yCab, raio, morta ? '#64748b' : cor, skin.estilo);
        g.globalAlpha = 1;
        continue;
      }
      if (n.j && n.j !== 'erro') continue;
      if (y < -raio || y > _rtH + raio) continue;
      g.globalAlpha = n.j === 'erro' ? 0.25 : 1;
      _rtDesenharNota(g, cx, y, raio, cor, skin.estilo);
      g.globalAlpha = 1;
    }

    // Partículas do acerto (pool fixo; posição calculada pela idade)
    for (var pi = 0; pi < RT_PART_MAX; pi++) {
      var pt = _rtParts[pi];
      if (!pt.t0) continue;
      var ip = pn - pt.t0;
      if (ip >= pt.dur || ip < 0) { pt.t0 = 0; continue; }
      var vp = ip / pt.dur;
      g.globalAlpha = 1 - vp;
      g.fillStyle = pt.cor;
      g.beginPath();
      g.arc(pt.x + pt.vx * ip, pt.y + pt.vy * ip + 0.00045 * ip * ip, pt.tam * (1 - vp * 0.6), 0, PI2);
      g.fill();
    }
    g.globalAlpha = 1;

    // Julgamento no alto da pista (o combo agora fica no HUD, no canto).
    // Animação: entra grande (1,5×) e assenta em 1× com um leve quique,
    // sobe uns pixels e some. Erro treme de lado em vez de quicar.
    var ccx = _rtW / 2, jy = Math.max(118, Math.min(_rtH * 0.24, hitY - 260));
    if (_rtJulgVis && pn < _rtJulgVis.ate) {
      var DUR = 520, vida = 1 - (_rtJulgVis.ate - pn) / DUR;      // 0 → 1
      var entra = Math.min(1, vida / 0.18);                        // primeiros ~90 ms
      var esc = vida < 0.18 ? 1.5 - 0.6 * entra : 0.9 + 0.1 * Math.min(1, (vida - 0.18) / 0.12);
      var dx = _rtJulgVis.tipo === 'erro' ? Math.sin(vida * 40) * 6 * (1 - vida) : 0;
      g.save();
      g.translate(ccx + dx, jy - vida * 10);
      g.scale(esc, esc);
      g.globalAlpha = vida > 0.7 ? (1 - vida) / 0.3 : 1;
      var tam = Math.round(Math.min(36, Math.max(26, _rtW * 0.085)));
      g.font = '900 ' + tam + 'px Syne, system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      var corJ = RT_COR_JULG[_rtJulgVis.tipo], txtJ = _rtJulgVis.rotulo || RT_ROTULO[_rtJulgVis.tipo];
      g.lineWidth = 5; g.strokeStyle = 'rgba(5,8,14,0.75)'; g.lineJoin = 'round';
      g.strokeText(txtJ, 0, 0);                                    // contorno: lê bem sobre as notas
      g.fillStyle = corJ;
      g.fillText(txtJ, 0, 0);
      if (_rtJulgVis.tipo !== 'perfeito' && _rtJulgVis.tipo !== 'erro' && _rtJulgVis.desvio) {
        g.font = '800 12px system-ui, sans-serif';
        g.fillStyle = 'rgba(226,232,240,0.9)';
        g.fillText(_rtJulgVis.desvio < 0 ? 'cedo' : 'tarde', 0, tam * 0.75);
      }
      g.restore();
    }

    // "Prepare-se" antes da primeira nota
    if (_rtEstado === 'jogando' && agora < 0) {
      g.font = '800 18px Syne, system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,255,255,' + Math.min(1, -agora / 600).toFixed(2) + ')';
      g.fillText(_rtPausado ? '' : 'Prepare-se!', ccx, _rtH * 0.36);
    }

    // Falhou: tela escurece em vermelho
    if (_rtFalhou) {
      var f = Math.min(1, (pn - _rtFalhaEm) / 1200);
      g.fillStyle = 'rgba(60,6,12,' + (f * 0.75).toFixed(3) + ')';
      g.fillRect(0, 0, _rtW, _rtH);
      g.globalAlpha = f;
      g.font = '900 ' + Math.round(Math.min(40, _rtW * 0.1)) + 'px Syne, system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#f87171';
      g.fillText('FALHOU', ccx, _rtH * 0.42);
      g.globalAlpha = 1;
    }

    // Barra de progresso
    if (_rtFim > 0 && _rtEls.prog) _rtEls.prog.style.width = Math.max(0, Math.min(100, agora / _rtFim * 100)).toFixed(1) + '%';
  }

  function _rtAviso(txt) {
    if (!_rtEls.aviso) return;
    _rtEls.aviso.textContent = txt || '';
    _rtEls.aviso.style.display = txt ? '' : 'none';
  }

  /* ══════════════════════════════════════════════════════════════
     API PÚBLICA (chamada pelo hub)
  ══════════════════════════════════════════════════════════════ */
  // Ao abrir a tela do jogo: monta (1ª vez) e mostra a seleção.
  function _rtPreparar() {
    if (!_rtMontar()) return;
    _rtRegistrarMenu();
    _rtMostrarSelecao();
    _rtNavIniciar();
  }
  // Ao sair pro menu de jogos / fechar o hub: para tudo e libera o áudio.
  function _rtParar() {
    _rtPreviaParar();
    _rtPadCalFechar();
    _rtCarga = null;
    _rtPararPartida();
    _rtAudioSuspender();
    // Solta a música decodificada (~50–90 MB de PCM): fora do jogo ela só
    // ocuparia memória do celular. Reabrir baixa do cache do SW, rápido.
    _rtBuf = null; _rtBufId = null;
    // Idem a cópia escalada do fundo (do tamanho da tela). As Image() dos
    // fundos ficam: são pequenas e reabrir o jogo não baixa de novo.
    _rtFundoCv = null; _rtFundoChave = '';
    _rtEstado = 'selecao';
  }

  window.RitmoGame = { preparar: _rtPreparar, parar: _rtParar, suspenderAudio: _rtAudioSuspender };
})();
