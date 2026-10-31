/* ═══════════════════════════════════════════════════════════════
   A MÁQUINA DA CORUJA — minigames do Coruja Party no espírito do
   Machine Party (cada rodada é uma armadilha: quem falha "morre").
   Lazy-loaded a partir de /Jogos/maquina.js pela pool do party.js.
   ------------------------------------------------------------
   Mesmo contrato do Puff/Ervilhas ("container"): render(container,
   opts) + parar(). Um módulo só pra vários minigames porque todos
   dividem o mesmo motor (canvas, semente, HUD, sons, partículas,
   tela de morte). Qual minigame roda vem em opts.jogo:
     laminas  — Lâminas      (Lethal Rebound): serras quicando, sobreviva
     escada   — Escada Errada (Wrong Way): acerte as setas, fuja da prensa
     piso     — Piso Falso   (Stable Footing): pise no símbolo da parede
     esteira  — A Esteira    (The Filter): quadro pra fornalha, peça passa
     empurra  — Empurra-Empurra: plataforma que encolhe, empurre os outros
     minado   — Campo Minado: atravesse sem pisar em mina (o número ajuda)
     tunel    — O Túnel: troque de faixa pra passar no vão dos pistões
     puff     — Puff da Coruja: todos no mesmo banco, segure e solte
     mesa     — Ervilhas: todos na mesma mesa, coma sem a Chefe ver
   opts: { jogo, duracaoSeg, seed, slot, rede, bots, onFim(score, assistir),
           onBotFim(uid, score), onMoedas(qtd) }
   ROBÔS: no anfitrião, opts.bots traz os robôs da sala; cada minigame
   sabe jogar por eles (jogo.bot) e o motor os mostra como rivais.

   SEMENTE: tudo que decide a dificuldade (onde nasce cada serra, as
   setas, os símbolos do piso, a ordem da esteira) sai de geradores
   presos à semente da rodada — todo mundo da sala recebe a MESMA
   armadilha. Cada sistema tem o próprio gerador (_fluxo) pra que o
   que o jogador faz nunca mude a sequência do outro. Enfeite visual
   (partículas, faíscas) usa Math.random, não importa.

   PONTUAÇÃO: score final ≤ 19999 (a regra de resultados/ no RTDB
   corta em 20000). Moedas coletadas na rodada vão pra carteira no
   fim (motivo 'party', sem teto — ver TETO_MOTIVOS_SEM_TETO no hub).

   ARTE: a arte do Gemini fica em /Jogos/assets/maquina/ (tabela ARTES) e
   entra no lugar do desenho feito no código — que continua como reserva
   se o arquivo não carregar (ver _arte). Cada minigame lista em "artes"
   o que usa, e o cenário fixo é redesenhado quando tudo chega. Sons
   gravados: /Jogos/assets/maquina/sfx/<nome>-N.mp3 (SFX_ARQ); sem o
   arquivo, toca o sintetizado.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BASE = '/Jogos/assets/maquina/';
  var SCORE_TETO = 19999;
  var FIM_OVERLAY_MS = 1900;     // quanto a tela de morte/vitória fica antes de reportar
  var DPR_MAX = 1.5, DPR_LEVE = 1, ORC_PX = 1.15e6, ORC_PX_LEVE = 0.55e6;

  // Arte opcional (nome do arquivo sem pasta). Vazio = ainda não existe.
  // Quando o Bruno subir, basta pôr o nome aqui (e na lista do hub).
  // Caminho começando com '/' = arte de outro jogo reaproveitada.
  var ARTES = {
    // Sheet 3×3 da coruja operária (capacete amarelo): 0 parada · 1 piscando ·
    // 2 correndo de asas abertas · 3 assustada · 4 tonta · 5 comemorando ·
    // 6 e 7 de costas subindo (pé esquerdo / direito) · 8 amassada (X nos olhos).
    // (nov/2026: sem o capacete, pra os chapéus do "Monte sua coruja" irem por cima)
    coruja: 'coruja-party-sheet.webp',
    moeda: '/Jogos/assets/corujinha/sim-moeda-v2.webp',
    serra: 'serra.webp',                  // serra circular vista de cima
    itens: 'itens.webp',                  // sheet 3×3: 5 quadros, engrenagem, parafuso, porca, mola
    prensa: 'prensa.webp',                // mandíbula da prensa hidráulica
    chao: 'chao-laminas.webp',            // chapa xadrez do piso das Lâminas
    piso: 'piso-tile.webp',               // ladrilho do Piso Falso
    // Puff e Ervilhas (todos juntos na mesma cena) reaproveitam a arte dos
    // módulos antigos. Sheet do Puff 3×3: 0 parada · 1 começando a inspirar ·
    // 2 meio cheia · 3 cheia · 4 no limite · 5 soltando · 6/7 tosse · 8 tonta.
    puff: '/Jogos/assets/puff/puff-sheet-v2.webp',
    // Chefe 3×3 (células 520×370): 0 lendo · 1 página · 2 óculos · 3 espiando ·
    // 4 jornal no queixo · 5 encarando · 6 apontando · 7 braços cruzados · 8 bocejo.
    chefe: '/Jogos/assets/ervilhas/chefe-sheet.webp',
    sala: '/Jogos/assets/ervilhas/sala.webp',
    mesaChefe: '/Jogos/assets/ervilhas/mesa.webp',
    prato: '/Jogos/assets/ervilhas/prato.webp',
    ervilha: '/Jogos/assets/ervilhas/ervilha.webp',
    // Arte pedida pros jogos novos (claude/party-maquina-assets-fase2.md).
    // Vazio = ainda não existe; o desenho em código assume.
    mesaLonga: 'mesa-longa.webp',   // mesa de jantar comprida em perspectiva (Ervilhas)
    plataforma: 'plataforma.webp',  // disco de metal visto de cima (Empurra-Empurra)
    braco: 'braco.webp',            // braço giratório, pivô na ponta esquerda (Empurra-Empurra)
    pistao: 'pistao.webp',          // bloco do pistão que desce pelo túnel (O Túnel)
    mina: 'mina.webp',              // ladrilho com a mina explodida (Campo Minado)
    pisoMina: 'piso-mina.webp',     // ladrilho do Campo Minado
    // Ervilhas: coruja sentada à mesa em 3/4 olhando pra direita, cortada na
    // barriga (base do corte a 94% da célula). 0 calma · 1 piscando ·
    // 2 espetando · 3 garfo com ervilhas · 4 comendo · 5 mastigando ·
    // 6 flagrada · 7 tonta · 8 comemorando.
    mesaCoruja: 'coruja-mesa-sheet.webp'
  };
  // Sons gravados (ElevenLabs): nome -> quantas versões (nome-1.mp3 ...).
  var SFX_ARQ = {
    serra: 1, clank: 1, raspao: 1, alerta: 1, morte: 1, prensa: 1, passo: 1,
    erro: 1, sirene: 1, queda: 1, fogo: 1, acerto: 1, moeda: 1, vitoria: 1,
    // fase 2/3: Empurra-Empurra, Campo Minado, Puff e Ervilhas
    investida: 1, explosao: 1, tosse: 1, mastigar: 1
  };

  var _pararAtual = null;

  /* ── Utilidades ──────────────────────────────────────────────── */
  function _gerador(seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function _clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function _lerp(a, b, t) { return a + (b - a) * t; }
  function _dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function _fonteH() {
    try {
      var f = getComputedStyle(document.documentElement).getPropertyValue('--font-h');
      return (f && f.trim()) || 'system-ui, sans-serif';
    } catch (e) { return 'system-ui, sans-serif'; }
  }
  function _somLigado() {
    var S = window.AngatubaSom;
    if (S && typeof S.ativo === 'function') { try { return !!S.ativo(); } catch (e) { return true; } }
    return true;
  }

  /* ── Áudio (sintetizado + gravado opcional) ──────────────────── */
  var _ac = null, _master = null, _ruidoBuf = null, _sfxBuf = {}, _sfxPedido = false;
  function _audio() {
    if (_ac) return _ac;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ac = new AC();
      _master = _ac.createGain(); _master.gain.value = 0.7; _master.connect(_ac.destination);
    } catch (e) { _ac = null; }
    return _ac;
  }
  function _audioDestravar() {
    var ac = _audio();
    if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    if (_sfxPedido || !ac || typeof fetch !== 'function') return;
    _sfxPedido = true;
    Object.keys(SFX_ARQ).forEach(function (nome) {
      _sfxBuf[nome] = [];
      for (var i = 1; i <= SFX_ARQ[nome]; i++) (function (url) {
        fetch(url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (ab) {
          ac.decodeAudioData(ab, function (b) { _sfxBuf[nome].push(b); }, function () {});
        }).catch(function () {});
      })(BASE + 'sfx/' + nome + '-' + i + '.mp3');
    });
  }
  function _ruido(ac) {
    if (_ruidoBuf) return _ruidoBuf;
    var n = Math.floor(ac.sampleRate * 0.8), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    _ruidoBuf = b; return b;
  }
  function _tom(t, tipo, f0, f1, dur, vol) {
    var ac = _ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(_master); o.start(t); o.stop(t + dur + 0.05);
  }
  function _sopro(t, dur, f0, f1, vol) {
    var ac = _ac, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = _ruido(ac); fl.type = 'bandpass'; fl.Q.value = 1.2;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(_master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.05);
  }
  // Sons sintetizados de reserva (o gravado do ElevenLabs entra por cima).
  var SINT = {
    moeda:   function (t) { _tom(t, 'square', 988, 988, 0.07, 0.12); _tom(t + 0.07, 'square', 1319, 1319, 0.16, 0.12); },
    acerto:  function (t) { _tom(t, 'triangle', 520, 780, 0.09, 0.22); },
    passo:   function (t) { _tom(t, 'square', 260, 180, 0.05, 0.1); _sopro(t, 0.04, 2400, 1200, 0.08); },
    erro:    function (t) { _tom(t, 'sawtooth', 220, 110, 0.22, 0.2); },
    alerta:  function (t) { _tom(t, 'square', 880, 880, 0.08, 0.1); _tom(t + 0.14, 'square', 880, 880, 0.08, 0.1); },
    serra:   function (t) { _sopro(t, 0.5, 5200, 2400, 0.12); _tom(t, 'sawtooth', 640, 900, 0.45, 0.05); },
    raspao:  function (t) { _sopro(t, 0.18, 7000, 3000, 0.16); },
    morte:   function (t) { _sopro(t, 0.5, 3000, 300, 0.4); _tom(t, 'sawtooth', 400, 60, 0.6, 0.25); },
    prensa:  function (t) { _tom(t, 'sine', 90, 40, 0.35, 0.6); _sopro(t, 0.25, 900, 200, 0.4); },
    sirene:  function (t) { _tom(t, 'sawtooth', 380, 560, 0.35, 0.12); _tom(t + 0.35, 'sawtooth', 560, 380, 0.35, 0.12); },
    queda:   function (t) { _tom(t, 'sine', 600, 80, 0.7, 0.2); },
    fogo:    function (t) { _sopro(t, 0.45, 1600, 300, 0.35); _tom(t, 'sine', 120, 60, 0.3, 0.2); },
    clank:   function (t) { _tom(t, 'square', 180, 120, 0.12, 0.18); _sopro(t, 0.08, 3600, 1800, 0.18); },
    vitoria: function (t) { [523, 659, 784, 1047].forEach(function (f, i) { _tom(t + i * 0.09, 'triangle', f, f, 0.18, 0.18); }); },
    investida: function (t) { _sopro(t, 0.3, 900, 3000, 0.3); },
    explosao: function (t) { _tom(t, 'sine', 120, 35, 0.6, 0.6); _sopro(t, 0.6, 2500, 200, 0.5); },
    tosse:   function (t) { _sopro(t, 0.12, 1400, 600, 0.35); _sopro(t + 0.2, 0.12, 1300, 500, 0.3); },
    mastigar: function (t) { _sopro(t, 0.05, 3000, 2000, 0.15); _sopro(t + 0.1, 0.05, 2800, 1800, 0.15); }
  };
  function _som(nome, vol) {
    if (!_somLigado()) return;
    var ac = _audio(); if (!ac || ac.state !== 'running') return;
    var l = _sfxBuf[nome];
    if (l && l.length) {
      try {
        var src = ac.createBufferSource(), g = ac.createGain();
        src.buffer = l[(Math.random() * l.length) | 0];
        src.playbackRate.value = 1 + (Math.random() * 2 - 1) * 0.05;
        g.gain.value = vol == null ? 1 : vol; src.connect(g); g.connect(_master); src.start();
        return;
      } catch (e) {}
    }
    var f = SINT[nome]; if (f) { try { f(ac.currentTime + 0.005); } catch (e) {} }
  }

  /* ── Arte opcional ───────────────────────────────────────────── */
  var _imgs = {};
  function _arte(chave) {
    var nome = ARTES[chave];
    if (!nome) return null;
    var reg = _imgs[chave];
    if (!reg) {
      reg = _imgs[chave] = { img: new Image(), ok: false, erro: false };
      reg.img.onerror = function () { reg.erro = true; };
      reg.img.onload = function () {
        var pr = reg.img.decode ? reg.img.decode() : Promise.resolve();
        pr.then(function () { reg.ok = true; }, function () { reg.ok = true; });
      };
      reg.img.src = nome.charAt(0) === '/' ? nome : BASE + nome;
    }
    return reg.ok ? reg.img : null;
  }

  // Recortes da arte já reduzidos pro tamanho em pixels da tela (reduzir
  // a imagem de 1116 px a cada quadro custa caro e serrilha). O motor
  // atualiza _pxPorUnidade antes de cada desenho.
  var _pxPorUnidade = 4, _recortes = {};
  // Desenha o quadro q de uma folha da tabela ARTES com centro (x, y) e
  // largura w (altura pela proporção da célula). Devolve false sem a arte.
  function _quadroArte(ctx, chave, q, cols, linhas, x, y, w, cor, alpha) {
    if (cor && typeof cor === 'object') chave = _folhaDaSkin(chave, cor);
    var img = _arte(chave);
    if (!img) return false;
    var c = _recorte(chave, img, q, cols, w * _pxPorUnidade, cor, linhas), h = w * c.height / c.width;
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(c, x - w / 2, y - h / 2, w, h);
    if (alpha != null) ctx.globalAlpha = 1;
    return true;
  }
  // linhas: quantas linhas a folha tem (padrão = cols). Célula que não é
  // quadrada (a Chefe é 520×370) sai com a mesma proporção: largura px.
  function _recorte(chave, img, q, cols, px, cor, linhas) {
    px = Math.max(8, Math.ceil(px / 8) * 8);
    // cor: texto = tinta da cor do jogador; objeto = visual da coruja (a
    // roupa já veio na folha da skin — ver _folhaDaSkin — e aqui entra a cor).
    var vis = cor && typeof cor === 'object' ? cor : null;
    var k = chave + '|' + q + '|' + px + '|' + (vis ? 'v' + vis.cor : (cor || ''));
    var c = _recortes[k];
    if (c) return c;
    var fw = img.width / cols, fh = img.height / (linhas || cols), ph = Math.max(8, Math.round(px * fh / fw));
    c = document.createElement('canvas'); c.width = px; c.height = ph;
    var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(img, (q % cols) * fw, Math.floor(q / cols) * fh, fw, fh, 0, 0, px, ph);
    if (vis) _recolorir(g, px, ph, vis.cor, chave.indexOf('skin:') === 0);
    else if (cor) { // coruja de rival: tingida com a cor do jogador (só onde há pena)
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.42;
      g.fillStyle = cor; g.fillRect(0, 0, px, ph);
    }
    _recortes[k] = c;
    return c;
  }
  function _moedaDesenhar(ctx, x, y, r) {
    var img = _arte('moeda');
    if (img) { var t = r * 2.3; ctx.drawImage(_recorte('moeda', img, 0, 1, t * _pxPorUnidade), x - t / 2, y - t / 2, t, t); return; }
    ctx.fillStyle = '#b77c00'; ctx.beginPath(); ctx.arc(x, y + r * 0.15, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#f5b301'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.62, 0, 6.283); ctx.fill();
  }


  /* ── Visual da coruja ("Monte sua coruja") ───────────────────────
     Cada jogador escolhe a COR da pena e uma SKIN (roupa completa). Vai
     pra sala como texto "cor|skin" e cada celular desenha os outros assim.
     - SKIN: é uma folha inteira redesenhada pelo Gemini com a coruja já
       vestida (mesmas poses e geometria da folha base) — nada de peça
       colada por cima. Uma folha por base: coruja (minigames), puff e
       mesa. Se a skin ainda não tem a folha de uma base, aquela base usa
       a coruja sem roupa. Arquivos: /Jogos/assets/maquina/skins/<skin>-<base>.webp
       e a lista do que existe em SKINS (o Claude acrescenta quando chega).
     - COR: troca só o tom das penas cinza-azuladas, em cima da arte. */
  var SKINS = {
    // id: [bases que já têm folha]   (bases: 'coruja', 'puff', 'mesaCoruja')
    operaria: ['coruja', 'puff', 'mesaCoruja'], cauboi: ['coruja', 'puff', 'mesaCoruja'], pirata: ['coruja', 'puff', 'mesaCoruja'], chef: ['coruja', 'puff', 'mesaCoruja'],
    caipira: ['coruja', 'puff', 'mesaCoruja'], nerd: ['coruja', 'puff', 'mesaCoruja'], realeza: ['coruja', 'puff', 'mesaCoruja'], astronauta: ['coruja', 'puff', 'mesaCoruja'],
    bruxa: ['coruja', 'puff', 'mesaCoruja'], heroina: ['coruja', 'puff', 'mesaCoruja'], detetive: ['coruja', 'puff', 'mesaCoruja'], roqueira: ['coruja', 'puff', 'mesaCoruja']
  };
  var SKIN_ARQ = { coruja: 'coruja', puff: 'puff', mesaCoruja: 'mesa' };
  // Chave da folha a usar pra esta base com este visual (registra na tabela
  // ARTES na primeira vez). Sem folha da skin, devolve a base.
  function _folhaDaSkin(chave, vis) {
    var sk = vis && vis.skin, lista = sk && SKINS[sk];
    if (!lista || lista.indexOf(chave) < 0) return chave;
    var k = 'skin:' + sk + ':' + chave;
    if (!ARTES[k]) ARTES[k] = 'skins/' + sk + '-' + SKIN_ARQ[chave] + '.webp';
    return _arte(k) ? k : chave;   // enquanto a da skin carrega, mostra a base
  }
  function _skinsProntas() { return Object.keys(SKINS).filter(function (k) { return SKINS[k].indexOf('coruja') >= 0; }); }
  var CORES_PENA = {
    classica: null,
    azul:     { h: 205, sm: 1.5, sa: 0.28, lm: 1, la: 0.02 },
    menta:    { h: 165, sm: 1.4, sa: 0.26, lm: 1, la: 0.04 },
    verde:    { h: 120, sm: 1.4, sa: 0.3, lm: 1, la: 0 },
    roxa:     { h: 275, sm: 1.4, sa: 0.3, lm: 1, la: 0 },
    rosa:     { h: 325, sm: 1.5, sa: 0.35, lm: 1, la: 0.06 },
    vermelha: { h: 355, sm: 1.6, sa: 0.4, lm: 1, la: 0 },
    laranja:  { h: 24, sm: 1.6, sa: 0.45, lm: 1, la: 0.04 },
    dourada:  { h: 44, sm: 1.6, sa: 0.5, lm: 1.05, la: 0.08 },
    branca:   { h: null, sm: 0.2, sa: 0, lm: 0.55, la: 0.42 },
    preta:    { h: null, sm: 0.3, sa: 0, lm: 0.45, la: -0.03 }
  };
  function _visParse(str) {
    if (str && typeof str === 'object') return str;
    var p = String(str || '').split('|');
    return { cor: CORES_PENA.hasOwnProperty(p[0]) ? p[0] : 'classica', skin: SKINS.hasOwnProperty(p[1]) ? p[1] : '' };
  }
  function _rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function _hue2(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
  function _hsl2rgb(h, s, l) {
    if (!s) { var v = Math.round(l * 255); return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; h /= 360;
    return [Math.round(_hue2(p, q, h + 1 / 3) * 255), Math.round(_hue2(p, q, h) * 255), Math.round(_hue2(p, q, h - 1 / 3) * 255)];
  }
  // Pena = cinza-azulado (ou cinza neutro escuro/médio). Creme, âmbar,
  // amarelo e vermelho ficam de fora.
  // escuro=true (folha de skin): não pinta preto/cinza-escuro (chapéu, óculos).
  function _recolorir(g, w, h, cor, escuro) {
    var T = CORES_PENA[cor];
    if (!T) return;
    try {
      var d = g.getImageData(0, 0, w, h), a = d.data;
      for (var i = 0; i < a.length; i += 4) {
        if (a[i + 3] < 10) continue;
        var hsl = _rgb2hsl(a[i], a[i + 1], a[i + 2]), hh = hsl[0], s = hsl[1], l = hsl[2];
        var pena = (hh >= 180 && hh <= 265 && s < 0.65 && l < 0.85) || (s < 0.1 && l > (escuro ? 0.2 : 0.08) && l < 0.62);
        if (!pena) continue;
        var nh = T.h == null ? hh : T.h, ns = Math.min(1, s * T.sm + T.sa), nl = Math.max(0, Math.min(1, l * T.lm + T.la));
        var c = _hsl2rgb(nh, ns, nl);
        a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2];
      }
      g.putImageData(d, 0, 0);
    } catch (e) {}
  }
  /* ── Desenhos de base (coruja, metal, listras) ───────────────── */
  // Coruja chibi desenhada (cinza-azulada, barriga creme, olhos âmbar,
  // linhas de neon vermelho nas asas — mesma cara da Master Reference).
  // Em unidades do mundo: (x, y) = centro do corpo, r = raio do corpo.
  function _coruja(ctx, x, y, r, o) {
    o = o || {};
    var visO = o.vis ? _visParse(o.vis) : null, chaveF = visO ? _folhaDaSkin('coruja', visO) : 'coruja';
    var sheet = o.desenhada ? null : _arte(chaveF);
    if (sheet) {
      var q = o.morta ? 8 : o.costas ? (o.passo ? 7 : 6) : o.olhos === 'x' ? 4 : o.olhos === 'medo' ? 3 : o.vitoria ? 5 : o.pisca ? 1 : (o.asa || 0) > 0.4 ? 2 : 0;
      var S = 3.1;
      ctx.save();
      ctx.translate(x, y);
      if (!o.semSombra) {
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.ellipse(0, r * 1.18 * (o.sy || 1), r * 0.82, r * 0.22, 0, 0, 6.283); ctx.fill();
      }
      if (o.rot) ctx.rotate(o.rot);
      ctx.scale(o.sx || 1, o.sy || 1);
      if (o.alpha != null) ctx.globalAlpha = o.alpha;
      var t = r * S, tinta = visO || o.cor;
      ctx.drawImage(_recorte(chaveF, sheet, q, 3, t * _pxPorUnidade, tinta), -t / 2, -t / 2, t, t);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(r * (o.sx || 1), r * (o.sy || 1));
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (!o.semSombra) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(0, 1.0, 0.82, 0.22, 0, 0, 6.283); ctx.fill();
    }
    var asa = o.asa || 0;
    for (var l = -1; l <= 1; l += 2) {
      ctx.save(); ctx.scale(l, 1); ctx.translate(0.8, 0.12); ctx.rotate(-0.2 - asa * 0.9);
      ctx.fillStyle = '#4c5c75';
      ctx.beginPath(); ctx.ellipse(0, 0.2, 0.3, 0.6, 0, 0, 6.283); ctx.fill();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,45,85,.4)'; ctx.lineWidth = 0.16;
      ctx.beginPath(); ctx.moveTo(-0.04, -0.22); ctx.quadraticCurveTo(0.14, 0.22, 0.0, 0.64); ctx.stroke();
      ctx.strokeStyle = '#ff5a76'; ctx.lineWidth = 0.05; ctx.stroke();
      ctx.restore();
    }
    var g = ctx.createRadialGradient(-0.32, -0.42, 0.1, 0, 0.05, 1.1);
    g.addColorStop(0, '#a9bbd0'); g.addColorStop(0.55, '#7189a6'); g.addColorStop(1, '#4a5a72');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0.05, 0.92, 1.0, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#5b6d88';
    ctx.beginPath(); ctx.moveTo(-0.6, -0.6); ctx.lineTo(-0.8, -1.12); ctx.lineTo(-0.26, -0.84); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.6, -0.6); ctx.lineTo(0.8, -1.12); ctx.lineTo(0.26, -0.84); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#efe4cb';
    ctx.beginPath(); ctx.ellipse(0, 0.44, 0.58, 0.5, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#d6c6a3'; ctx.lineWidth = 0.05;
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-0.2 + k * 0.2, 0.36 + (k % 2) * 0.16, 0.08, 0.2, 2.9); ctx.stroke(); }
    // disco do rosto + olhos
    ctx.fillStyle = '#dde5ee';
    ctx.beginPath(); ctx.arc(-0.35, -0.28, 0.36, 0, 6.283); ctx.arc(0.35, -0.28, 0.36, 0, 6.283); ctx.fill();
    var olx = (o.olharX || 0) * 0.08, oly = (o.olharY || 0) * 0.08;
    for (var e = -1; e <= 1; e += 2) {
      var ex = e * 0.35, ey = -0.28;
      if (o.olhos === 'x') {
        ctx.strokeStyle = '#7a1022'; ctx.lineWidth = 0.09; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - 0.15, ey - 0.15); ctx.lineTo(ex + 0.15, ey + 0.15);
        ctx.moveTo(ex + 0.15, ey - 0.15); ctx.lineTo(ex - 0.15, ey + 0.15); ctx.stroke();
        continue;
      }
      if (o.pisca) {
        ctx.strokeStyle = '#3a3a46'; ctx.lineWidth = 0.07;
        ctx.beginPath(); ctx.arc(ex, ey - 0.02, 0.17, 0.3, 2.84); ctx.stroke();
        continue;
      }
      var gi = ctx.createRadialGradient(ex, ey, 0.02, ex, ey, 0.28);
      gi.addColorStop(0, '#ffd166'); gi.addColorStop(0.7, '#f59e0b'); gi.addColorStop(1, '#c2620a');
      ctx.fillStyle = gi;
      ctx.beginPath(); ctx.arc(ex, ey, o.olhos === 'medo' ? 0.22 : 0.27, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#17171f';
      ctx.beginPath(); ctx.arc(ex + olx, ey + oly, o.olhos === 'medo' ? 0.07 : 0.14, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex + olx - 0.06, ey + oly - 0.07, 0.05, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = '#7d8da3';
    ctx.beginPath(); ctx.moveTo(-0.11, -0.1); ctx.lineTo(0.11, -0.1); ctx.lineTo(0, 0.13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.ellipse(-0.3, 1.0, 0.16, 0.08, 0, 0, 6.283); ctx.ellipse(0.3, 1.0, 0.16, 0.08, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  function _listras(ctx, x, y, w, h, larg) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#f5c518'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#16161a';
    larg = larg || 4;
    for (var i = -h; i < w + h; i += larg * 2) {
      ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + larg, y + h); ctx.lineTo(x + i + larg + h, y); ctx.lineTo(x + i + h, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function _chapa(ctx, x, y, w, h, c1, c2) {
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, c1 || '#3a3f48'); g.addColorStop(1, c2 || '#22262d');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 0.4; ctx.strokeRect(x + 0.2, y + 0.2, w - 0.4, h - 0.4);
  }
  function _rebites(ctx, x, y, w, h, passo) {
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    for (var i = x + 2; i < x + w - 1; i += passo) {
      ctx.beginPath(); ctx.arc(i, y + 1.6, 0.45, 0, 6.283); ctx.arc(i, y + h - 1.6, 0.45, 0, 6.283); ctx.fill();
    }
  }
  function _engrenagem(ctx, x, y, r, dentes, rot, cor) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = cor || '#9aa3ad';
    ctx.beginPath();
    for (var i = 0; i < dentes * 2; i++) {
      var a = i / (dentes * 2) * 6.283, rr = (i % 2) ? r * 0.78 : r;
      ctx.lineTo(Math.cos(a - 0.12) * rr, Math.sin(a - 0.12) * rr);
      ctx.lineTo(Math.cos(a + 0.12) * rr, Math.sin(a + 0.12) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  /* ═════════════════════ MOTOR ═════════════════════════════════ */
  function _criarMotor(container, opts, fabrica) {
    var duracao = Math.max(10, Number(opts.duracaoSeg) || 35);
    var onFim = typeof opts.onFim === 'function' ? opts.onFim : function () {};
    var seed = (Number(opts.seed) || Math.floor(Math.random() * 1e9)) >>> 0;
    var fonte = _fonteH();

    var root = document.createElement('div');
    root.className = 'mq-root';
    root.innerHTML =
      '<div class="mq-hud">' +
        '<div class="mq-hud-bloco"><span class="mq-hud-rot">Pontos</span><b class="mq-hud-pts">0</b></div>' +
        '<div class="mq-hud-titulo"></div>' +
        '<div class="mq-hud-bloco mq-hud-dir"><span class="mq-hud-rot">Tempo</span><b class="mq-hud-tempo"></b></div>' +
      '</div>' +
      '<div class="mq-tempo-barra"><i></i></div>' +
      '<div class="mq-palco"><canvas class="mq-cv"></canvas>' +
        '<div class="mq-moedas"><span>🪙</span><b>0</b></div>' +
        '<div class="mq-dica"></div>' +
      '</div>' +
      '<div class="mq-controles"></div>' +
      '<div class="mq-fim"><div class="mq-fim-cx"><div class="mq-fim-tit"></div><div class="mq-fim-sub"></div></div></div>';
    container.innerHTML = '';
    container.appendChild(root);

    var elPts = root.querySelector('.mq-hud-pts');
    var elTempo = root.querySelector('.mq-hud-tempo');
    var elBarra = root.querySelector('.mq-tempo-barra i');
    var elMoedas = root.querySelector('.mq-moedas b');
    var elMoedasWrap = root.querySelector('.mq-moedas');
    var elDica = root.querySelector('.mq-dica');
    var elFim = root.querySelector('.mq-fim');
    var palco = root.querySelector('.mq-palco');
    var cv = root.querySelector('.mq-cv');
    var ctx = cv.getContext('2d');

    var M = {
      seed: seed, t: 0, pts: 0, moedas: 0, estado: 'jogando',
      W: 90, H: 160, s: 1, ox: 0, oy: 0,
      controles: root.querySelector('.mq-controles'),
      leve: false, fonte: fonte,
      // Lugar fixo deste jogador na sala (0-3, ordem dos uids): onde ele
      // nasce nas arenas em que todos começam juntos.
      slot: Math.max(0, Math.min(3, Number(opts.slot) || 0)),
      visEu: _visParse(opts.visual)   // "Monte sua coruja" deste jogador
    };
    var _fluxos = 0;
    M.fluxo = function () { _fluxos++; return _gerador((seed ^ Math.imul(_fluxos, 0x85ebca6b)) >>> 0); };

    var jogo = fabrica(M);
    M.W = jogo.mundo[0]; M.H = jogo.mundo[1];

    /* — robôs (só no anfitrião) —
       opts.bots = [{uid, nome, cor, slot}]. Cada minigame diz como o robô
       joga (jogo.bot(B) → { passo(dt), rede(), sobreviveu() }) dentro da
       MESMA armadilha. O robô aparece aqui como mais um rival e vai pros
       outros celulares pelo canal das posições (rede.enviarBot); quando
       ele cai ou o tempo acaba, opts.onBotFim(uid, score). */
    var bots = [], botEnvEm = 0;
    if (Array.isArray(opts.bots) && typeof jogo.bot === 'function') {
      opts.bots.slice(0, 3).forEach(function (b) {
        var B = { uid: String(b.uid), nome: String(b.nome || 'Robô'), cor: b.cor || '#ffffff', e: 0, pts: 0, visual: b.visual || '',
          slot: Math.max(0, Math.min(3, Number(b.slot) || 0)), r: M.fluxo(), reportou: false, envUlt: '' };
        B.nivel = 0.35 + B.r() * 0.6;   // 0.35 (distraído) … 0.95 (afiado)
        B.pontos = function (n) { if (!sobrev) B.pts = Math.max(0, B.pts + n); };
        B.morrer = function () { if (B.e) return; B.e = 1; _botFim(B); };
        B.vencer = function () { if (B.e) return; B.e = 2; _botFim(B); };
        B.ctl = jogo.bot(B);
        if (B.ctl) bots.push(B);
      });
    }
    function _botFim(B) {
      if (B.reportou) return;
      B.reportou = true;
      _redeEnviarBots(true);
      if (typeof opts.onBotFim === 'function') { try { opts.onBotFim(B.uid, Math.min(SCORE_TETO, Math.round(B.pts))); } catch (e) {} }
    }
    function _botsVivos() { for (var i = 0; i < bots.length; i++) if (!bots[i].e) return true; return false; }
    function _botsPasso(dt) {
      for (var i = 0; i < bots.length; i++) {
        var B = bots[i];
        if (B.e) continue;
        if (sobrev) B.pts += dt * 100;
        try { B.ctl.passo(dt); } catch (e) { B.erro = String(e && e.message); B.morrer(); }
      }
    }
    function _botsFimTempo() {
      bots.forEach(function (B) {
        if (B.e) return;
        B.e = 2;
        if (typeof B.ctl.sobreviveu === 'function') { try { B.ctl.sobreviveu(); } catch (e) {} }
        _botFim(B);
      });
    }
    function _botTxt(B) { return B.e + ';' + B.ctl.rede() + ';' + Math.floor(M.t); }
    function _redeEnviarBots(forcar) {
      if (!rede || typeof rede.enviarBot !== 'function' || !bots.length) return;
      var agora = Date.now();
      if (!forcar && agora - botEnvEm < 100) return;
      botEnvEm = agora;
      bots.forEach(function (B) {
        var str = _botTxt(B);
        if (str === B.envUlt) return;
        B.envUlt = str;
        try { rede.enviarBot(B.uid, str); } catch (e) {}
      });
    }
    if (opts.teste) window.__mq = { M: M, jogo: jogo, bots: bots }; // só o harness do Playwright passa isto
    root.classList.add('mq-' + jogo.chave);
    root.querySelector('.mq-hud-titulo').textContent = jogo.titulo;

    /* — modo da rodada (igual ao Machine Party) —
       'sobrevivencia': não tem relógio — vai até sobrar UM (a armadilha
       só aperta). A pontuação é o tempo vivo (100 por segundo) e quem
       fica por último ganha +3000; assim a ordem das mortes decide a
       rodada. opts.duracaoSeg vira só um teto de segurança.
       'objetivo' (padrão): pontos do próprio jogo; jogo.fimNoPrimeiro
       encerra a rodada de todo mundo quando alguém termina (Ervilhas). */
    var sobrev = jogo.modo === 'sobrevivencia';
    var BONUS_ULTIMO = 3000;
    if (sobrev) {
      root.classList.add('mq-sobrev');
      root.querySelector('.mq-hud-bloco .mq-hud-rot').textContent = 'Vivos';
    }

    var raf = 0, ultimo = 0, vivo = true, fimEm = 0, reportou = false;
    var dpr = 1, Wpx = 0, Hpx = 0;
    var tremor = 0, flashCor = null, flashT = 0;
    var parts = [], textos = [];
    var fpsAcum = 0, fpsN = 0, fpsDecidido = false;
    var timers = [];

    /* — rede: os rivais na mesma arena —
       opts.rede vem do party.js: enviar(texto) grava a MINHA posição na
       sala e rivais() devolve a última posição de cada um ({uid, nome,
       cor, v, em}). O texto é "estado;n1;n2…;segundo" (0 jogando,
       1 caiu, 2 sobreviveu) e cada minigame decide o que vai nos
       números (jogo.rede()). Ninguém manda no outro: cada celular simula a
       própria coruja e só desenha (e, nas Lâminas, sente o empurrão de)
       quem está do lado. */
    var rede = (opts.rede && typeof opts.rede.enviar === 'function' && typeof opts.rede.rivais === 'function') ? opts.rede : null;
    var rivais = {}, envioUlt = '', envioEm = 0;
    M.mudo = false; M.assistindo = false;
    function _redeEnviar(forcar) {
      if (!rede || typeof jogo.rede !== 'function') return;
      var agora = Date.now();
      if (!forcar && agora - envioEm < 100) return;           // ~10 por segundo
      // O último campo é o segundo da rodada: muda sozinho a cada 1 s, então
      // até quem está parado manda um "tô vivo" (o RTDB não avisa um set igual).
      var str = (M.estado === 'jogando' ? 0 : M.estado === 'morto' ? 1 : 2) + ';' + jogo.rede() + ';' + Math.floor(M.t);
      if (!forcar && str === envioUlt) return;
      envioUlt = str; envioEm = agora;
      try { rede.enviar(str); } catch (e) {}
    }
    function _redeReceber(dt) {
      if (!rede && !bots.length) return;
      var lista = [];
      if (rede) { try { lista = rede.rivais() || []; } catch (e) {} }
      var agora = Date.now(), vistos = {}, k = Math.min(1, dt * 10);
      bots.forEach(function (B) { lista.push({ uid: B.uid, nome: B.nome, cor: B.cor, visual: B.visual, v: _botTxt(B), em: agora, bot: B }); });
      lista.forEach(function (r, i) {
        if (!r || typeof r.v !== 'string') return;
        var partes = r.v.split(';'), e = Number(partes[0]) || 0;
        var n = partes.slice(1, -1).map(function (x) { var v = Number(x); return isFinite(v) ? v : 0; });
        var g = rivais[r.uid];
        if (!g) g = rivais[r.uid] = { uid: r.uid, s: n.slice(), vx: 0, vy: 0, e: e, morteT: e ? 9 : 0, bateu: 0 };
        g.nome = String(r.nome || ''); g.cor = r.cor || '#ffffff'; g.i = i; g.n = n; g.bot = r.bot || null;
        if (r.visual !== g.visualTxt) { g.visualTxt = r.visual; g.vis = r.visual ? _visParse(r.visual) : null; }
        g.velho = agora - (r.em || 0) > 4000;
        if (e === 1 && g.e !== 1) {
          g.morteT = 0;
          M.som('morte', 0.3);
          if (typeof jogo.rivalCaiu === 'function') { try { jogo.rivalCaiu(g); } catch (er) {} }
        }
        g.e = e; vistos[r.uid] = 1;
      });
      Object.keys(rivais).forEach(function (u) {
        var g = rivais[u];
        if (!vistos[u]) { delete rivais[u]; return; }
        var x0 = g.s[0], y0 = g.s[1];
        for (var j = 0; j < g.n.length; j++) g.s[j] = g.s[j] == null ? g.n[j] : _lerp(g.s[j], g.n[j], k);
        if (dt > 0) { g.vx = _lerp(g.vx, (g.s[0] - x0) / dt, 0.3); g.vy = _lerp(g.vy, (g.s[1] - y0) / dt, 0.3); }
        g.morteT += dt; g.bateu = Math.max(0, g.bateu - dt);
      });
    }
    // Rivais na ordem fixa da sala; some quem parou de mandar sinal
    // (caiu a conexão), a não ser que já tenha terminado a rodada.
    M.rivais = function () {
      return Object.keys(rivais).map(function (u) { return rivais[u]; })
        .filter(function (g) { return !g.velho || g.e; })
        .sort(function (a, b) { return a.i - b.i; });
    };
    M.rotulo = function (c, x, y, txt, cor) {
      c.font = '800 3px ' + fonte; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 0.9; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(txt, x, y);
      c.fillStyle = cor; c.fillText(txt, x, y);
    };

    /* — tamanho — */
    var fundo = null; // cache do cenário fixo (jogo.fundo)
    function _redimensionar() {
      var r = palco.getBoundingClientRect();
      Wpx = Math.max(1, r.width); Hpx = Math.max(1, r.height);
      var maxD = M.leve ? DPR_LEVE : DPR_MAX, orc = M.leve ? ORC_PX_LEVE : ORC_PX;
      dpr = Math.min(window.devicePixelRatio || 1, maxD);
      if (Wpx * Hpx * dpr * dpr > orc) dpr = Math.max(0.75, Math.sqrt(orc / (Wpx * Hpx)));
      cv.width = Math.round(Wpx * dpr); cv.height = Math.round(Hpx * dpr);
      M.s = Math.min(Wpx / M.W, Hpx / M.H);
      M.ox = (Wpx - M.W * M.s) / 2;
      M.oy = jogo.alinharBaixo ? (Hpx - M.H * M.s) : (Hpx - M.H * M.s) / 2;
      fundo = null;
    }
    function _fundoCache() {
      if (fundo || typeof jogo.fundo !== 'function') return fundo;
      fundo = document.createElement('canvas');
      fundo.width = Math.max(1, Math.round(M.W * M.s * dpr)); fundo.height = Math.max(1, Math.round(M.H * M.s * dpr));
      var fc = fundo.getContext('2d');
      fc.setTransform(M.s * dpr, 0, 0, M.s * dpr, 0, 0);
      jogo.fundo(fc);
      return fundo;
    }
    _redimensionar();
    var _onResize = function () { _redimensionar(); };
    window.addEventListener('resize', _onResize);

    /* — API pro jogo — */
    M.pontos = function (n) { if (sobrev) return; M.pts = Math.max(0, Math.round(M.pts + n)); elPts.textContent = M.pts; };
    // Quantos ainda estão no jogo (eu + rivais + robôs). A Party conta quem
    // ainda não mandou resultado; sem ela, conta o que se vê na arena.
    var totalJog = Math.max(1, Number(opts.total) || 0);
    function _vivosAgora() {
      if (typeof opts.vivos === 'function') { try { var v = opts.vivos(); if (v != null && isFinite(v)) return v; } catch (e) {} }
      var n = M.estado === 'jogando' ? 1 : 0;
      bots.forEach(function (B) { if (!B.e) n++; });
      M.rivais().forEach(function (g) { if (!g.bot && g.e === 0) n++; });
      return n;
    }
    function _totalAgora() { return Math.max(totalJog, 1 + M.rivais().length); }
    var vivosTxt = '';
    function _hudVivos() {
      var t = _vivosAgora() + '/' + _totalAgora();
      if (t !== vivosTxt) { vivosTxt = t; elPts.textContent = t; }
    }
    // Última de pé (sobrevivência) e "alguém terminou" (fimNoPrimeiro).
    function _checarFimRodada() {
      if (sobrev) {
        if (M.t < 1.5 || _totalAgora() < 2) return;
        if (_vivosAgora() > 1) return;
        if (M.estado === 'jogando') { M.pts += BONUS_ULTIMO; M.vencer('ÚLTIMA DE PÉ! 🏆', 'Ficou ' + M.t.toFixed(1).replace('.', ',') + ' s'); return; }
        var vb = bots.filter(function (B) { return !B.e; });
        if (vb.length === 1) { vb[0].pts += BONUS_ULTIMO; vb[0].vencer(); }
      } else if (jogo.fimNoPrimeiro) {
        var alguem = M.estado === 'venceu' && !M.encerrado;
        var quem = null;
        M.rivais().forEach(function (g) { if (g.e === 2 && !quem) quem = g; });
        if (quem) alguem = true;
        if (!alguem) return;
        if (M.estado === 'jogando' && quem) M.encerrar(jogo.fimNoPrimeiro(quem.nome), quem.nome + ' terminou primeiro');
        bots.forEach(function (B) { if (!B.e) { B.e = 2; _botFim(B); } });
      }
    }
    M.moeda = function (x, y) {
      M.moedas++; elMoedas.textContent = M.moedas;
      elMoedasWrap.classList.remove('mq-moedas-pop'); void elMoedasWrap.offsetWidth; elMoedasWrap.classList.add('mq-moedas-pop');
      _som('moeda', 0.8);
      M.particulas(x, y, 8, '#ffd23f', 'faisca');
      M.texto(x, y - 4, '+1 🪙', '#ffd23f');
    };
    M.som = function (nome, vol) { if (!M.mudo) _som(nome, vol); }; // assistindo: só os rivais fazem barulho
    M.vibrar = function (p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };
    M.tremer = function (v) { tremor = Math.max(tremor, v); };
    M.flash = function (cor) { flashCor = cor; flashT = 1; };
    M.dica = function (txt, ms) {
      elDica.textContent = txt || '';
      elDica.classList.toggle('mq-dica-on', !!txt);
      if (txt && ms) M.depois(ms, function () { elDica.classList.remove('mq-dica-on'); });
    };
    M.depois = function (ms, fn) { var h = setTimeout(function () { if (vivo) fn(); }, ms); timers.push(h); return h; };
    M.texto = function (x, y, str, cor, tam) { textos.push({ x: x, y: y, str: str, cor: cor || '#fff', tam: tam || 5, v: 0 }); };
    M.particulas = function (x, y, n, cor, tipo) {
      if (M.leve) n = Math.ceil(n / 2);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, v = (tipo === 'pena' ? 14 : 26) * (0.4 + Math.random());
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (tipo === 'pena' ? 8 : 4),
          vida: tipo === 'pena' ? 1.4 + Math.random() * 0.6 : 0.4 + Math.random() * 0.4, v: 0,
          cor: cor, tipo: tipo || 'faisca', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
          tam: tipo === 'pena' ? 1.6 + Math.random() * 1.4 : 0.5 + Math.random() * 0.7 });
      }
    };
    M.penas = function (x, y) {
      M.particulas(x, y, 18, '#7189a6', 'pena');
      M.particulas(x, y, 10, '#efe4cb', 'pena');
      M.particulas(x, y, 6, '#ff5a76', 'faisca');
    };
    // Sem cor nem visual = é a minha coruja: desenha com o meu visual.
    M.coruja = function (c, x, y, r, o) { o = o || {}; if (!o.cor && !o.vis) o.vis = M.visEu; _coruja(c, x, y, r, o); };
    M.listras = _listras; M.chapa = _chapa; M.rebites = _rebites; M.engrenagem = _engrenagem;
    M.arte = _arte; M.desenharMoeda = _moedaDesenhar;
    // Já começa a carregar a arte que este minigame usa; quando tudo chega,
    // o cenário fixo (cache) é redesenhado uma vez com a arte nova.
    var artesJogo = ['coruja', 'moeda'].concat(jogo.artes || []), artesOk = false;
    artesJogo.forEach(function (k) { _arte(k); });

    // Morreu: a armadilha pegou. score = o que fez até aqui.
    M.morrer = function (titulo, sub) {
      if (M.estado !== 'jogando') return;
      M.estado = 'morto';
      _redeEnviar(true);
      M.tremer(3); M.flash('rgba(255,40,60,.55)'); M.vibrar([60, 40, 120]);
      _som('morte');
      _mostrarFim(titulo || 'VOCÊ CAIU!', sub, 'morte');
    };
    function _terminouTempo() {
      if (M.estado !== 'jogando') return;
      // Minigame em que acabar o tempo é perder (Campo Minado).
      if (typeof jogo.tempoEsgotado === 'function') { jogo.tempoEsgotado(); if (M.estado !== 'jogando') return; }
      M.estado = 'venceu';
      _redeEnviar(true);
      if (typeof jogo.sobreviveu === 'function') jogo.sobreviveu();
      _som('vitoria');
      M.vibrar(40);
      _mostrarFim(jogo.tituloFim || 'SOBREVIVEU!', null, 'vitoria');
    }
    // Outro jogador terminou primeiro: fecha a minha rodada com o que fiz.
    M.encerrar = function (titulo, sub) {
      if (M.estado !== 'jogando') return;
      M.estado = 'venceu'; M.encerrado = true;
      _redeEnviar(true);
      M.som('sirene', 0.7); M.vibrar(30);
      _mostrarFim(titulo || 'ACABOU!', sub, 'morte');
    };
    // Venceu antes do tempo (chegou na saída, limpou o prato, sobrou sozinha).
    M.vencer = function (titulo, sub) {
      if (M.estado !== 'jogando') return;
      M.estado = 'venceu';
      _redeEnviar(true);
      _som('vitoria');
      M.vibrar(40); M.flash('rgba(74,222,128,.35)');
      _mostrarFim(titulo || 'VENCEU!', sub, 'vitoria');
    };
    function _mostrarFim(titulo, sub, tipo) {
      fimEm = performance.now();
      elFim.className = 'mq-fim mq-fim-on mq-fim-' + tipo;
      elFim.querySelector('.mq-fim-tit').textContent = titulo;
      elFim.querySelector('.mq-fim-sub').textContent = (sub || '') + (sobrev ? '' : (sub ? ' · ' : '') + Math.round(M.pts) + ' pontos') + (M.moedas ? ' · +' + M.moedas + ' 🪙' : '');
      if (typeof jogo.aoFim === 'function') { try { jogo.aoFim(tipo); } catch (e) {} }
      M.depois(FIM_OVERLAY_MS, _reportar);
    }
    function _reportar() {
      if (reportou) return;
      reportou = true;
      var G = window.AngatubaGames;
      if (M.moedas > 0) {
        if (typeof opts.onMoedas === 'function') { try { opts.onMoedas(M.moedas); } catch (e) {} }
        if (G && typeof G.moedasAdd === 'function') { try { G.moedasAdd(M.moedas, 'party'); } catch (e) {} }
      }
      // Com rede, quem já terminou fica assistindo a arena até a rodada
      // fechar (igual Machine Party) em vez de ir pra tela de espera.
      var assistir = !!(rede && rede.assistir && typeof jogo.assistir === 'function');
      if (assistir) {
        M.assistindo = true; M.mudo = true;
        elFim.classList.remove('mq-fim-on');
        root.classList.add('mq-assistindo');
        M.dica('👀 Assistindo os outros');
      }
      onFim(Math.min(SCORE_TETO, Math.max(0, Math.round(M.pts))), assistir);
    }

    /* — entrada (toque/mouse) em unidades do mundo — */
    function _pt(e) {
      var r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left - M.ox) / M.s, y: (e.clientY - r.top - M.oy) / M.s, id: e.pointerId };
    }
    var _onDown = function (e) {
      _audioDestravar();
      if (M.estado !== 'jogando') return;
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      if (jogo.toqueInicio) jogo.toqueInicio(_pt(e));
      e.preventDefault();
    };
    var _onMove = function (e) { if (M.estado === 'jogando' && jogo.toqueMove) jogo.toqueMove(_pt(e)); };
    var _onUp = function (e) { if (jogo.toqueFim) jogo.toqueFim(_pt(e)); };
    cv.addEventListener('pointerdown', _onDown);
    cv.addEventListener('pointermove', _onMove);
    cv.addEventListener('pointerup', _onUp);
    cv.addEventListener('pointercancel', _onUp);
    var _onKey = function (e) {
      if (M.estado !== 'jogando' || !jogo.tecla) return;
      if (jogo.tecla(e.key, e.type === 'keydown')) e.preventDefault();
    };
    window.addEventListener('keydown', _onKey);
    window.addEventListener('keyup', _onKey);
    root.addEventListener('pointerdown', _audioDestravar);

    /* — laço — */
    function _quadro(ts) {
      if (!vivo) return;
      raf = requestAnimationFrame(_quadro);
      var dt = ultimo ? (ts - ultimo) / 1000 : 0.016;
      ultimo = ts;
      // Gráficos leves automáticos: média < ~40 fps nos primeiros ~2,5 s.
      if (!fpsDecidido && dt > 0 && dt < 0.5) {
        fpsAcum += dt; fpsN++;
        if (fpsAcum > 2.5) {
          fpsDecidido = true;
          if (fpsN / fpsAcum < 40) { M.leve = true; _redimensionar(); }
        }
      }
      dt = Math.min(0.05, dt);
      if (!artesOk && artesJogo.every(function (k) { return _arte(k); })) { artesOk = true; fundo = null; }
      _redeReceber(dt);
      var andou = false;
      if (M.estado === 'jogando') {
        M.t += dt; andou = true;
        if (sobrev) M.pts += dt * 100;
        jogo.atualizar(dt);
        _botsPasso(dt);
        if (M.t >= duracao) { if (M.estado === 'jogando') _terminouTempo(); _botsFimTempo(); }
        _redeEnviar(false);
      } else {
        if (typeof jogo.atualizarFim === 'function') jogo.atualizarFim(dt);
        // Com rede (ou robôs ainda vivos), a armadilha segue rodando pros
        // rivais que continuam no jogo.
        if (M.t < duracao && ((rede && typeof jogo.assistir === 'function') || _botsVivos())) {
          M.t += dt; andou = true;
          if (typeof jogo.assistir === 'function') jogo.assistir(dt);
          _botsPasso(dt);
          if (M.t >= duracao) _botsFimTempo();
        }
      }
      _checarFimRodada();
      _redeEnviarBots(false);
      if (andou) {
        if (sobrev) { elTempo.textContent = Math.floor(M.t); _hudVivos(); }
        else {
          var rest = Math.max(0, duracao - M.t);
          elTempo.textContent = Math.ceil(rest);
          elBarra.style.transform = 'scaleX(' + (rest / duracao).toFixed(4) + ')';
          root.classList.toggle('mq-final', rest < 5);
        }
      }
      // partículas e textos
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.v += dt;
        if (p.v >= p.vida) { parts.splice(i, 1); continue; }
        if (p.tipo === 'pena') { p.vx *= 0.96; p.vy = p.vy * 0.96 + 10 * dt; }
        else { p.vy += 40 * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
      for (var j = textos.length - 1; j >= 0; j--) { textos[j].v += dt; textos[j].y -= 10 * dt; if (textos[j].v > 0.9) textos.splice(j, 1); }
      tremor = Math.max(0, tremor - dt * 8);
      flashT = Math.max(0, flashT - dt * 2.5);
      _desenhar();
    }
    function _desenhar() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      var tx = tremor ? (Math.random() - 0.5) * tremor : 0, ty = tremor ? (Math.random() - 0.5) * tremor : 0;
      ctx.setTransform(dpr * M.s, 0, 0, dpr * M.s, dpr * (M.ox + tx * M.s), dpr * (M.oy + ty * M.s));
      _pxPorUnidade = dpr * M.s;
      var f = _fundoCache();
      if (f) ctx.drawImage(f, 0, 0, M.W, M.H);
      jogo.desenhar(ctx);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], a = 1 - p.v / p.vida;
        ctx.globalAlpha = a; ctx.fillStyle = p.cor;
        if (p.tipo === 'pena') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, p.tam * 0.35, p.tam, 0, 0, 6.283); ctx.fill(); ctx.restore();
        } else { ctx.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam, p.tam); }
      }
      ctx.globalAlpha = 1;
      if (textos.length) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (var j = 0; j < textos.length; j++) {
          var tt = textos[j];
          ctx.globalAlpha = Math.min(1, 1.6 - tt.v * 1.6);
          ctx.font = '800 ' + tt.tam + 'px ' + fonte;
          ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(tt.str, tt.x, tt.y);
          ctx.fillStyle = tt.cor; ctx.fillText(tt.str, tt.x, tt.y);
        }
        ctx.globalAlpha = 1;
      }
      if (flashT > 0 && flashCor) {
        ctx.globalAlpha = flashT; ctx.fillStyle = flashCor; ctx.fillRect(-20, -20, M.W + 40, M.H + 40); ctx.globalAlpha = 1;
      }
    }

    function destruir() {
      vivo = false;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout); timers = [];
      window.removeEventListener('resize', _onResize);
      window.removeEventListener('keydown', _onKey);
      window.removeEventListener('keyup', _onKey);
      if (typeof jogo.destruir === 'function') { try { jogo.destruir(); } catch (e) {} }
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    if (typeof jogo.iniciar === 'function') jogo.iniciar();
    elTempo.textContent = sobrev ? '0' : Math.ceil(duracao);
    elPts.textContent = sobrev ? (1 + bots.length) + '/' + Math.max(totalJog, 1 + bots.length) : '0';
    if (sobrev) root.querySelector('.mq-hud-dir .mq-hud-rot').textContent = 'Tempo';
    raf = requestAnimationFrame(_quadro);
    return destruir;
  }

  /* ═══════════════ 1. LÂMINAS (Lethal Rebound) ═════════════════
     Sala de metal vista de cima, três dutos no alto. A cada poucos
     segundos uma luz pisca sobre um duto e sai uma serra que quica nas
     paredes pra sempre. Arraste (em qualquer lugar da tela) pra mover a
     coruja — o movimento é relativo ao dedo, pra o dedo não tampar ela.
     Pontos: tempo vivo + raspões + moedas; sobreviver = bônus. */
  function _laminas(M) {
    var W = 90, H = 160, P = 4.5;           // P = espessura da parede
    var DUTOS = [18, 45, 72];
    var rSpawn = M.fluxo(), rMoeda = M.fluxo();
    var coruja = { x: 45, y: 118, r: 4.2, vx: 0, vy: 0, asa: 0 };
    var serras = [], alertas = [], moedas = [];
    var proxSerra = 1.4, nSerras = 0, proxMoeda = 2.2;
    var dedo = null, teclas = {};
    var SENS = 1.25, MAXV = 95, acumVivo = 0;
    var emp = { x: 0, y: 0 };               // empurrão levado de um rival (decai sozinho)
    var serraSprite = {};

    function _spriteSerra(r) {
      var arte = _arte('serra');
      var k = r.toFixed(1) + '|' + M.s + (arte ? 'a' : 'd');
      if (serraSprite[k]) return serraSprite[k];
      var px = Math.ceil(r * 2.4 * M.s * 1.5), c = document.createElement('canvas');
      c.width = c.height = px;
      var g = c.getContext('2d'), sc = px / (r * 2.4);
      if (arte) { // arte gravada: a serra (pontas dos dentes inclusas) ocupa 2.3r de 2.4r
        g.imageSmoothingQuality = 'high';
        var lado = px * 2.3 / 2.4, off = (px - lado) / 2;
        g.drawImage(arte, off, off, lado, lado);
        serraSprite[k] = c; return c;
      }
      g.setTransform(sc, 0, 0, sc, px / 2, px / 2);
      var dentes = 14;
      g.fillStyle = '#c9d1da';
      g.beginPath();
      for (var i = 0; i < dentes; i++) {
        var a0 = i / dentes * 6.283, a1 = (i + 0.55) / dentes * 6.283, a2 = (i + 1) / dentes * 6.283;
        g.lineTo(Math.cos(a0) * r * 0.86, Math.sin(a0) * r * 0.86);
        g.lineTo(Math.cos(a1) * r * 1.13, Math.sin(a1) * r * 1.13);
        g.lineTo(Math.cos(a2) * r * 0.86, Math.sin(a2) * r * 0.86);
      }
      g.closePath(); g.fill();
      var gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      gr.addColorStop(0, '#f1f4f7'); gr.addColorStop(0.6, '#a7b1bc'); gr.addColorStop(1, '#6b7580');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.88, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(40,46,54,.5)'; g.lineWidth = r * 0.06;
      for (var j = 0; j < 4; j++) { g.beginPath(); g.arc(0, 0, r * 0.62, j * 1.57 + 0.3, j * 1.57 + 1.1); g.stroke(); }
      g.fillStyle = '#e11d48'; g.beginPath(); g.arc(0, 0, r * 0.26, 0, 6.283); g.fill();
      g.fillStyle = '#2a2f37'; g.beginPath(); g.arc(0, 0, r * 0.1, 0, 6.283); g.fill();
      serraSprite[k] = c; return c;
    }

    function _novaSerra(duto) {
      nSerras++;
      var grande = nSerras >= 4 && rSpawn() < 0.22;
      var r = grande ? 8 : 5.4 + rSpawn() * 1.2;
      var v = (grande ? 30 : 38) + Math.min(24, nSerras * 3);
      var ang = Math.PI / 2 + (rSpawn() * 2 - 1) * 1.0;
      serras.push({ x: DUTOS[duto], y: P + r, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: r, rot: 0, raspou: 0, nova: 0.35 });
      M.som('serra', 0.8); M.tremer(1.2);
    }

    // A armadilha em si (serras, alertas, moedas), sem a coruja: roda
    // igual pra quem joga e pra quem ficou assistindo.
    function _mundo(dt) {
      // spawn de serras (tempo fixo pela semente → igual pra todos)
      proxSerra -= dt;
      // sem relógio: o teto de serras e o ritmo sobem até sobrar uma
      if (proxSerra <= 0 && serras.length + alertas.length < Math.min(12, 7 + Math.floor(M.t / 14))) {
        var duto = Math.floor(rSpawn() * 3);
        alertas.push({ duto: duto, t: 1.0 });
        M.som('alerta', 0.6);
        proxSerra = Math.max(M.t > 40 ? 1.3 : 2.0, 4.6 - nSerras * 0.35) + rSpawn() * 0.8;
      }
      for (var a = alertas.length - 1; a >= 0; a--) {
        alertas[a].t -= dt;
        if (alertas[a].t <= 0) { _novaSerra(alertas[a].duto); alertas.splice(a, 1); }
      }
      proxMoeda -= dt;
      if (proxMoeda <= 0) {
        moedas.push({ x: 12 + rMoeda() * 66, y: 22 + rMoeda() * 124, v: 0 });
        proxMoeda = 2.4 + rMoeda() * 1.4;
      }
      for (var i = 0; i < serras.length; i++) {
        var s = serras[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 18; s.nova = Math.max(0, s.nova - dt);
        if (s.x < P + s.r) { s.x = P + s.r; s.vx = Math.abs(s.vx); M.som('clank', 0.25); }
        if (s.x > W - P - s.r) { s.x = W - P - s.r; s.vx = -Math.abs(s.vx); M.som('clank', 0.25); }
        if (s.y < P + s.r && s.nova <= 0) { s.y = P + s.r; s.vy = Math.abs(s.vy); M.som('clank', 0.25); }
        if (s.y > H - P - s.r) { s.y = H - P - s.r; s.vy = -Math.abs(s.vy); M.som('clank', 0.25); }
        s.raspou = Math.max(0, s.raspou - dt);
      }
      for (var m = moedas.length - 1; m >= 0; m--) {
        moedas[m].v += dt;
        if (moedas[m].v > 6.5) moedas.splice(m, 1);
      }
    }

    return {
      chave: 'laminas', titulo: 'Lâminas', mundo: [W, H], modo: 'sobrevivencia', artes: ['serra', 'chao'],
      iniciar: function () { M.dica('Arraste pra fugir das serras', 2600); },
      fundo: function (c) {
        c.fillStyle = '#1b1e23'; c.fillRect(0, 0, W, H);
        // chapas do piso
        var chao = _arte('chao');
        if (chao) { // chapa xadrez da arte, 2 ladrilhos empilhados + véu escuro pra serra e coruja saltarem
          var hl = (H - 2 * P) / 2;
          c.drawImage(chao, P, P, W - 2 * P, hl + 0.2); c.drawImage(chao, P, P + hl, W - 2 * P, hl);
          c.fillStyle = 'rgba(8,10,14,.32)'; c.fillRect(P, P, W - 2 * P, H - 2 * P);
        } else {
          for (var y = P; y < H - P; y += 16) for (var x = P; x < W - P; x += 20.25) {
            M.chapa(c, x, y, 20.25, 16, '#2c3138', '#23272d');
          }
        }
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.3;
        for (var k = 0; k < 40; k++) { // arranhões
          var ax = P + Math.random() * (W - 2 * P), ay = P + Math.random() * (H - 2 * P);
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + (Math.random() - 0.5) * 12, ay + (Math.random() - 0.5) * 6); c.stroke();
        }
        // ralo central
        c.fillStyle = '#15171b'; c.beginPath(); c.arc(45, 82, 6, 0, 6.283); c.fill();
        c.strokeStyle = '#3a3f47'; c.lineWidth = 0.6;
        for (var g = -4; g <= 4; g += 2) { c.beginPath(); c.moveTo(45 + g, 77); c.lineTo(45 + g, 87); c.stroke(); }
        // paredes com listra de perigo
        M.listras(c, 0, 0, W, P, 3); M.listras(c, 0, H - P, W, P, 3);
        M.listras(c, 0, 0, P, H, 3); M.listras(c, W - P, 0, P, H, 3);
        c.fillStyle = 'rgba(0,0,0,.45)';
        c.fillRect(0, P - 0.8, W, 0.8); c.fillRect(P - 0.8, 0, 0.8, H);
        // dutos
        DUTOS.forEach(function (dx) {
          c.fillStyle = '#0b0c0e'; c.fillRect(dx - 8, 0, 16, P + 1.4);
          c.strokeStyle = '#4b525c'; c.lineWidth = 0.8; c.strokeRect(dx - 8, -1, 16, P + 2.4);
        });
      },
      rede: function () { return coruja.x.toFixed(1) + ';' + coruja.y.toFixed(1); },
      rivalCaiu: function (g) {
        M.particulas(g.s[0], g.s[1], 14, g.cor, 'pena');
        M.texto(g.s[0], g.s[1] - 8, g.nome + ' caiu!', g.cor, 3.6);
      },
      assistir: function (dt) { _mundo(dt); },
      atualizar: function (dt) {
        _mundo(dt);
        // movimento: teclado (PC) soma com o arrasto
        var kx = (teclas.ArrowRight ? 1 : 0) - (teclas.ArrowLeft ? 1 : 0);
        var ky = (teclas.ArrowDown ? 1 : 0) - (teclas.ArrowUp ? 1 : 0);
        if (kx || ky) { coruja.x += kx * 70 * dt; coruja.y += ky * 70 * dt; }
        // Empurrão: rival encostado me tira do lugar (metade da sobreposição
        // aqui, a outra metade no celular dele); vindo rápido, dá um tranco
        // que pode jogar na serra.
        coruja.x += emp.x * dt; coruja.y += emp.y * dt;
        var amort = Math.exp(-dt * 5); emp.x *= amort; emp.y *= amort;
        M.rivais().forEach(function (g) {
          if (g.e !== 0) return;
          var dx = coruja.x - g.s[0], dy = coruja.y - g.s[1], d = Math.sqrt(dx * dx + dy * dy), min = coruja.r * 1.5;
          if (d >= min || d < 0.001) return;
          var nx = dx / d, ny = dy / d;
          coruja.x += nx * (min - d) * 0.5; coruja.y += ny * (min - d) * 0.5;
          var vRel = g.vx * nx + g.vy * ny; // quanto o rival vem pra cima de mim
          if (vRel > 14 && !g.bateu) {
            g.bateu = 0.35;
            var f = Math.min(110, vRel * 1.1);
            emp.x += nx * f; emp.y += ny * f;
            M.som('clank', 0.35); M.vibrar(25);
            M.particulas(coruja.x - nx * coruja.r, coruja.y - ny * coruja.r, 6, '#ffe08a', 'faisca');
            M.texto(coruja.x, coruja.y - 8, 'EMPURRÃO!', g.cor, 3.6);
          }
        });
        coruja.x = _clamp(coruja.x, P + coruja.r, W - P - coruja.r);
        coruja.y = _clamp(coruja.y, P + coruja.r + 2, H - P - coruja.r);
        coruja.asa = Math.max(0, coruja.asa - dt * 3);
        // serras × coruja
        for (var i = 0; i < serras.length; i++) {
          var s = serras[i];
          var d = _dist(s.x, s.y, coruja.x, coruja.y);
          if (d < s.r * 0.95 + coruja.r * 0.72) {
            M.penas(coruja.x, coruja.y);
            M.morrer('FATIADA! 🪚', 'Durou ' + M.t.toFixed(1).replace('.', ',') + ' s');
            return;
          }
          if (d < s.r + coruja.r + 4 && !s.raspou) {
            s.raspou = 1.2; M.pontos(40); M.texto(coruja.x, coruja.y - 7, 'raspão! +40', '#ff8fa3', 4);
            M.som('raspao', 0.7); M.vibrar(15);
            M.particulas((s.x + coruja.x) / 2, (s.y + coruja.y) / 2, 6, '#ffe08a', 'faisca');
          }
        }
        for (var m = moedas.length - 1; m >= 0; m--) {
          if (_dist(moedas[m].x, moedas[m].y, coruja.x, coruja.y) < coruja.r + 3.5) {
            M.moeda(moedas[m].x, moedas[m].y); M.pontos(150); moedas.splice(m, 1);
          }
        }
        // tempo vivo (100 pontos por segundo, creditados de 10 em 10)
        acumVivo += dt * 100;
        if (acumVivo >= 10) { var q = Math.floor(acumVivo / 10) * 10; acumVivo -= q; M.pontos(q); }
      },
      sobreviveu: function () { M.pontos(2500); M.texto(coruja.x, coruja.y - 8, '+2500', '#4ade80', 6); },
      // Robô: foge do ponto onde cada serra VAI estar daqui a pouco (quanto
      // mais afiado, mais longe ele prevê e mais rápido reage), sai de
      // baixo do duto que está piscando e evita as paredes.
      bot: function (B) {
        var o = { x: 14 + ((B.slot * 23) % 62), y: 100 + B.r() * 40, vx: 0, vy: 0, ax: 0, ay: 0, pensa: 0 };
        var prev = 0.2 + B.nivel * 0.35, vmax = 42 + B.nivel * 32;
        return {
          passo: function (dt) {
            o.pensa -= dt;
            if (o.pensa <= 0) {
              o.pensa = 0.06 + (1 - B.nivel) * 0.22;
              var fx = 0, fy = 0;
              serras.forEach(function (s) {
                [0, prev].forEach(function (tt) {
                  var dx = o.x - (s.x + s.vx * tt), dy = o.y - (s.y + s.vy * tt);
                  var d = Math.sqrt(dx * dx + dy * dy) || 0.01, raio = s.r + 15;
                  if (d < raio) { var f = (raio - d) / raio; fx += dx / d * f * 3; fy += dy / d * f * 3; }
                });
              });
              alertas.forEach(function (a) {
                var dx = o.x - DUTOS[a.duto], dy = o.y - 12, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
                if (d < 22) { fx += dx / d * 1.2; fy += dy / d * 1.2; }
              });
              if (o.x < 16) fx += 0.8; if (o.x > W - 16) fx -= 0.8;
              if (o.y < 30) fy += 0.8; if (o.y > H - 16) fy -= 0.8;
              if (Math.abs(fx) + Math.abs(fy) < 0.2) { fx += (45 - o.x) * 0.01; fy += (100 - o.y) * 0.01; }
              fx += (B.r() - 0.5) * 0.7 * (1 - B.nivel); fy += (B.r() - 0.5) * 0.7 * (1 - B.nivel);
              var n = Math.sqrt(fx * fx + fy * fy); if (n > 1) { fx /= n; fy /= n; }
              o.ax = fx; o.ay = fy;
            }
            o.vx = _lerp(o.vx, o.ax * vmax, Math.min(1, dt * 7)); o.vy = _lerp(o.vy, o.ay * vmax, Math.min(1, dt * 7));
            o.x += o.vx * dt; o.y += o.vy * dt;
            // a minha coruja (anfitrião) empurra o robô, igual empurra rival
            if (M.estado === 'jogando') {
              var dx = o.x - coruja.x, dy = o.y - coruja.y, d = Math.sqrt(dx * dx + dy * dy), min = coruja.r * 1.5;
              if (d < min && d > 0.001) { o.x += dx / d * (min - d) * 0.5; o.y += dy / d * (min - d) * 0.5; }
            }
            o.x = _clamp(o.x, P + coruja.r, W - P - coruja.r);
            o.y = _clamp(o.y, P + coruja.r + 2, H - P - coruja.r);
            for (var i = 0; i < serras.length; i++) {
              var s = serras[i];
              if (_dist(s.x, s.y, o.x, o.y) < s.r * 0.95 + coruja.r * 0.72) { B.morrer(); return; }
            }
            B.pontos(100 * dt);
          },
          rede: function () { return o.x.toFixed(1) + ';' + o.y.toFixed(1); },
          sobreviveu: function () { B.pontos(2500); }
        };
      },
      desenhar: function (c) {
        // alertas: luz vermelha piscando sobre o duto
        alertas.forEach(function (a) {
          var on = Math.floor(a.t * 8) % 2 === 0, dx = DUTOS[a.duto];
          c.fillStyle = on ? 'rgba(255,40,60,.95)' : 'rgba(120,10,20,.9)';
          c.beginPath(); c.arc(dx, P + 4, 2.2, 0, 6.283); c.fill();
          if (on) {
            var g = c.createRadialGradient(dx, P + 4, 0, dx, P + 4, 18);
            g.addColorStop(0, 'rgba(255,40,60,.45)'); g.addColorStop(1, 'rgba(255,40,60,0)');
            c.fillStyle = g; c.beginPath(); c.arc(dx, P + 4, 18, 0, 6.283); c.fill();
          }
        });
        // moedas
        moedas.forEach(function (m) {
          if (m.v > 5 && Math.floor(m.v * 8) % 2) return;
          var bob = Math.sin(m.v * 5) * 0.8, esc = Math.min(1, m.v * 4);
          c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(m.x, m.y + 3, 2.4 * esc, 0.8 * esc, 0, 0, 6.283); c.fill();
          M.desenharMoeda(c, m.x, m.y + bob, 2.8 * esc);
        });
        // rivais (mesma sala, cor de cada um) — abaixo da minha coruja
        var rv = M.rivais();
        rv.forEach(function (g) {
          if (g.e === 1) {
            if (g.morteT < 1.4) M.coruja(c, g.s[0], g.s[1], coruja.r, { morta: true, cor: g.cor, vis: g.vis, semSombra: true, alpha: Math.max(0, 1 - g.morteT / 1.4) });
            return;
          }
          var vg = Math.min(1, Math.sqrt(g.vx * g.vx + g.vy * g.vy) / 60);
          M.coruja(c, g.s[0], g.s[1], coruja.r, { cor: g.cor, vis: g.vis, alpha: g.e === 2 ? 0.6 : 0.95, asa: vg * 0.6 * (0.5 + 0.5 * Math.sin(M.t * 30 + g.i)) });
          M.rotulo(c, g.s[0], g.s[1] - 8.6, g.nome, g.cor);
        });
        // coruja (abaixo das serras)
        if (M.estado !== 'morto') {
          if (rv.length) M.rotulo(c, coruja.x, coruja.y - 8.6, 'VOCÊ', '#ffffff');
          var vel = Math.min(1, Math.sqrt(coruja.vx * coruja.vx + coruja.vy * coruja.vy) / 60);
          var perto = 1e9;
          serras.forEach(function (s) { perto = Math.min(perto, _dist(s.x, s.y, coruja.x, coruja.y) - s.r); });
          M.coruja(c, coruja.x, coruja.y, coruja.r, {
            asa: Math.max(coruja.asa, vel * 0.6) * (0.5 + 0.5 * Math.sin(M.t * 30)),
            olhos: perto < 9 ? 'medo' : null, olharX: coruja.vx / 80, olharY: coruja.vy / 80
          });
        }
        // serras com rastro
        serras.forEach(function (s) {
          var sp = _spriteSerra(s.r);
          c.globalAlpha = 0.18;
          c.drawImage(sp, s.x - s.vx * 0.05 - s.r * 1.2, s.y - s.vy * 0.05 - s.r * 1.2, s.r * 2.4, s.r * 2.4);
          c.globalAlpha = 1;
          c.save(); c.translate(s.x, s.y); c.rotate(s.rot);
          c.drawImage(sp, -s.r * 1.2, -s.r * 1.2, s.r * 2.4, s.r * 2.4);
          c.restore();
        });
      },
      toqueInicio: function (p) { dedo = { x: p.x, y: p.y, id: p.id }; },
      toqueMove: function (p) {
        if (!dedo || dedo.id !== p.id) return;
        var dx = (p.x - dedo.x) * SENS, dy = (p.y - dedo.y) * SENS;
        var lim = MAXV * 0.05;
        dx = _clamp(dx, -lim * 2, lim * 2); dy = _clamp(dy, -lim * 2, lim * 2);
        coruja.x += dx; coruja.y += dy; coruja.vx = dx * 30; coruja.vy = dy * 30;
        if (Math.abs(dx) + Math.abs(dy) > 0.6) coruja.asa = 1;
        dedo.x = p.x; dedo.y = p.y;
      },
      toqueFim: function (p) { if (dedo && dedo.id === p.id) { dedo = null; coruja.vx = coruja.vy = 0; } },
      tecla: function (k, desce) { if (k.indexOf('Arrow') === 0) { teclas[k] = desce; return true; } return false; }
    };
  }

  /* ═══════════════ 2. ESCADA ERRADA (Wrong Way) ════════════════
     Escada rolante descendo, prensa hidráulica lá embaixo. Cada degrau
     acima da coruja mostra uma seta: aperte a seta certa (botões, deslize
     ou teclado) pra subir um degrau. Errou = tropeça e escorrega. A
     escada acelera com o tempo; se a coruja chegar na prensa, já era. */
  function _escada(M) {
    var W = 90, H = 160, HS = 12.5;        // HS = altura do degrau
    var Y_PRENSA = 138;                    // linha da prensa
    var P_MAX = 6.2;                       // teto: sempre sobram ~4 setas visíveis acima
    var XC = 33, XS = 60;                  // coluna da coruja e trilho das setas
    var LANES = [23.5, 42.5, 48];          // colunas dos rivais (até 3), um de cada lado de mim
    var rSeta = M.fluxo();
    var SETAS = ['esq', 'cima', 'baixo', 'dir'];
    var ROT = { esq: Math.PI, cima: -Math.PI / 2, baixo: Math.PI / 2, dir: 0 };
    var COR = { esq: '#38bdf8', cima: '#4ade80', baixo: '#f472b6', dir: '#facc15' };
    var fila = [], p = 4.2, pVis = 4.2, rolagem = 0, tonta = 0, degraus = 0;
    var prensaAbre = 0, pulo = 0, ultimoPerigo = 0;
    var swipe = null, botoes = {};

    function _seta(i) {
      while (fila.length <= i) {
        var s = SETAS[Math.floor(rSeta() * 4)];
        var n = fila.length;
        if (n >= 2 && fila[n - 1].s === s && fila[n - 2].s === s) s = SETAS[(SETAS.indexOf(s) + 1 + Math.floor(rSeta() * 3)) % 4];
        fila.push({ s: s, ouro: rSeta() < 0.1 });
      }
      return fila[i];
    }
    function _velocidade() { return 1.2 + M.t * 0.065; } // degraus por segundo
    function _apertar(s) {
      if (M.estado !== 'jogando') return;
      var b = botoes[s];
      if (b) { b.classList.remove('mq-bt-pop'); void b.offsetWidth; b.classList.add('mq-bt-pop'); }
      if (tonta > 0) return;
      var alvo = _seta(degraus);
      if (alvo.s === s) {
        degraus++;
        p = Math.min(P_MAX, p + 1); pulo = 1;
        M.pontos(40); M.som('passo', 0.7);
        if (alvo.ouro) M.moeda(XS, Y_PRENSA - pVis * HS - 8);
      } else {
        tonta = 0.5; p = Math.max(0, p - 0.55);
        M.som('erro'); M.vibrar(50); M.tremer(1.5); M.flash('rgba(255,60,60,.25)');
        M.texto(XC, Y_PRENSA - pVis * HS - 10, 'ERROU!', '#ff6b6b', 5);
      }
    }

    return {
      chave: 'escada', titulo: 'Escada Errada', mundo: [W, H], modo: 'sobrevivencia', alinharBaixo: true, artes: ['prensa'],
      iniciar: function () {
        var html = '';
        ['esq', 'baixo', 'cima', 'dir'].forEach(function (s) {
          html += '<button type="button" class="mq-bt mq-bt-' + s + '" data-s="' + s + '" aria-label="' + s + '">' +
            '<svg viewBox="0 0 24 24"><path d="M4 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
        });
        M.controles.innerHTML = '<div class="mq-setas">' + html + '</div>';
        M.controles.classList.add('mq-controles-on');
        Array.prototype.forEach.call(M.controles.querySelectorAll('.mq-bt'), function (b) {
          botoes[b.getAttribute('data-s')] = b;
          b.addEventListener('pointerdown', function (e) { e.preventDefault(); _audioDestravar(); _apertar(b.getAttribute('data-s')); });
        });
        M.dica('Aperte a seta do degrau de cima', 2600);
      },
      fundo: function (c) {
        var g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0d1013'); g.addColorStop(1, '#1d2126');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        // paredes laterais com tubos
        M.chapa(c, 0, 0, 16, H, '#2a2f36', '#1c2025'); M.chapa(c, W - 16, 0, 16, H, '#2a2f36', '#1c2025');
        c.fillStyle = '#39404a'; c.fillRect(5, 0, 2.2, H); c.fillRect(W - 7.2, 0, 2.2, H);
        for (var y = 8; y < H; y += 22) { c.fillStyle = '#4b535e'; c.fillRect(3.8, y, 4.6, 2.4); c.fillRect(W - 8.4, y, 4.6, 2.4); }
        // saída lá em cima
        c.fillStyle = '#0a2a18'; c.fillRect(30, 0, 30, 9);
        c.fillStyle = 'rgba(74,222,128,.8)'; c.fillRect(32, 2, 26, 5);
        c.fillStyle = '#05140b'; c.font = '800 4px ' + M.fonte; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('SAÍDA', 45, 4.7);
      },
      atualizar: function (dt) {
        var v = _velocidade();
        p -= v * dt;
        rolagem = (rolagem + v * dt) % 1;
        tonta = Math.max(0, tonta - dt);
        pulo = Math.max(0, pulo - dt * 7);
        pVis = _lerp(pVis, p, Math.min(1, dt * 16));
        prensaAbre += dt * (2 + v);
        if (p < 1.6 && M.t - ultimoPerigo > 0.45) { ultimoPerigo = M.t; M.som('alerta', 0.4); }
        if (p <= 0) {
          M.penas(XC, Y_PRENSA - 2);
          M.som('prensa'); M.tremer(4);
          M.morrer('ESMAGADA! ⚙️', degraus + ' degraus');
        }
      },
      atualizarFim: function (dt) { prensaAbre += dt * 6; },
      assistir: function (dt) { var v = _velocidade(); rolagem = (rolagem + v * dt) % 1; },
      rede: function () { return pVis.toFixed(2) + ';' + degraus; },
      rivalCaiu: function (g) {
        var lx = LANES[g.i % LANES.length];
        M.particulas(lx, Y_PRENSA - 2, 12, g.cor, 'pena');
        M.texto(lx, Y_PRENSA - 12, g.nome + ' esmagada!', g.cor, 3.4);
      },
      sobreviveu: function () { M.pontos(2000); M.texto(45, 60, '+2000', '#4ade80', 6); },
      // Robô: aperta num ritmo próprio e erra de vez em quando; a escada
      // acelera até passar do ritmo dele.
      bot: function (B) {
        var o = { p: 4.2, pVis: 4.2, deg: 0, tonta: 0, prox: 0.5 + B.r() * 0.4 };
        var taxa = 2.3 + B.nivel * 1.9, erro = 0.03 + (1 - B.nivel) * 0.09;
        return {
          passo: function (dt) {
            o.p -= _velocidade() * dt;
            o.tonta = Math.max(0, o.tonta - dt);
            o.prox -= dt;
            if (o.prox <= 0 && o.tonta <= 0 && o.p < P_MAX - 0.2) {
              o.prox = (1 / taxa) * (0.7 + B.r() * 0.6);
              if (B.r() < erro) { o.tonta = 0.5; o.p = Math.max(0, o.p - 0.55); }
              else { o.deg++; o.p = Math.min(P_MAX, o.p + 1); B.pontos(40); }
            }
            o.pVis = _lerp(o.pVis, o.p, Math.min(1, dt * 16));
            if (o.p <= 0) B.morrer();
          },
          rede: function () { return o.pVis.toFixed(2) + ';' + o.deg; },
          sobreviveu: function () { B.pontos(2000); }
        };
      },
      desenhar: function (c) {
        // degraus rolando pra baixo
        var x0 = 18, x1 = W - 18, off = rolagem * HS;
        for (var i = -1; i < 13; i++) {
          var y = Y_PRENSA - i * HS + off - HS;
          if (y < 8 || y > Y_PRENSA + HS) continue;
          var g = c.createLinearGradient(0, y, 0, y + HS);
          g.addColorStop(0, '#59626e'); g.addColorStop(0.18, '#3b424c'); g.addColorStop(1, '#262b31');
          c.fillStyle = g; c.fillRect(x0, y, x1 - x0, HS - 0.6);
          c.fillStyle = '#f5c518'; c.fillRect(x0, y, x1 - x0, 0.9);
          c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.3;
          for (var r = x0 + 2; r < x1; r += 2.4) { c.beginPath(); c.moveTo(r, y + 1.6); c.lineTo(r, y + HS - 1.5); c.stroke(); }
        }
        // corrimão (borracha correndo)
        c.fillStyle = '#121418'; c.fillRect(14, 0, 4, H); c.fillRect(W - 18, 0, 4, H);
        c.fillStyle = '#2b2f36';
        for (var k = -1; k < 20; k++) { var yy = k * 9 + (rolagem * HS * 0.72) % 9; c.fillRect(14.6, yy, 2.8, 4); c.fillRect(W - 17.4, yy, 2.8, 4); }

        // setas nos degraus de cima
        var baseY = Y_PRENSA - pVis * HS;
        for (var j = 0; j < 6; j++) {
          var sy = baseY - (j + 1) * HS + HS * 0.5;
          if (sy < 12) break;
          // trilho ligando a seta ao degrau
          c.fillStyle = 'rgba(245,197,24,.18)'; c.fillRect(XC + 6, sy - 0.4, XS - XC - 12, 0.8);
          var st = _seta(degraus + j), ativa = j === 0;
          var tam = ativa ? 7.2 : 5.2;
          c.globalAlpha = ativa ? 1 : Math.max(0.25, 0.85 - j * 0.14);
          c.fillStyle = 'rgba(0,0,0,.45)';
          c.beginPath(); c.arc(XS, sy + 0.6, tam + 1.4, 0, 6.283); c.fill();
          if (st.ouro) { c.fillStyle = '#f5b301'; c.beginPath(); c.arc(XS, sy, tam + 2.2, 0, 6.283); c.fill(); }
          c.fillStyle = COR[st.s];
          c.beginPath(); c.arc(XS, sy, tam + 0.8, 0, 6.283); c.fill();
          c.save(); c.translate(XS, sy); c.rotate(ROT[st.s]);
          c.strokeStyle = '#111'; c.lineWidth = tam * 0.34; c.lineCap = 'round'; c.lineJoin = 'round';
          c.beginPath(); c.moveTo(-tam * 0.55, 0); c.lineTo(tam * 0.5, 0); c.moveTo(tam * 0.05, -tam * 0.5); c.lineTo(tam * 0.55, 0); c.lineTo(tam * 0.05, tam * 0.5); c.stroke();
          c.restore();
          if (st.ouro) {
            c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(XS + tam + 1.6, sy - tam, 2, 0, 6.283); c.fill();
            c.fillStyle = '#b77c00'; c.font = '800 2.4px ' + M.fonte; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', XS + tam + 1.6, sy - tam + 0.1);
          }
          if (ativa && tonta <= 0) {
            c.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(M.t * 12)) + ')'; c.lineWidth = 0.7;
            c.beginPath(); c.arc(XS, sy, tam + 2.4, 0, 6.283); c.stroke();
          }
        }
        c.globalAlpha = 1;

        // rivais subindo na mesma escada, cada um na própria altura
        var rv = M.rivais();
        rv.forEach(function (g) {
          if (g.e === 1) return; // amassado: desenhado em cima da prensa, lá embaixo
          var lx = LANES[g.i % LANES.length], gy = Math.max(14, Y_PRENSA - g.s[0] * HS - 4.2);
          M.coruja(c, lx, gy, 3.8, { cor: g.cor, vis: g.vis, alpha: 0.92, costas: g.e === 0, passo: (g.n[1] | 0) % 2 === 1, vitoria: g.e === 2 });
          M.rotulo(c, lx, gy - 7.6, g.nome, g.cor);
        });
        // coruja de costas subindo
        if (M.estado !== 'morto') {
          var cy = baseY - 5.2 - pulo * 2.6;
          M.coruja(c, XC, cy, 4.6, {
            asa: tonta > 0 ? 0.9 * Math.abs(Math.sin(M.t * 20)) : pulo,
            rot: tonta > 0 ? Math.sin(M.t * 30) * 0.25 : 0,
            olhos: p < 2 ? 'medo' : (tonta > 0 ? 'x' : null), olharY: -1,
            costas: tonta <= 0, passo: degraus % 2 === 1   // sobe de costas, um pé de cada vez
          });
          if (tonta > 0) { c.fillStyle = '#ffe08a'; c.font = '800 4px ' + M.fonte; c.textAlign = 'center'; c.fillText('★ ★', XC, cy - 8); }
        } else if (!_arte('coruja')) {
          c.fillStyle = '#7189a6'; c.beginPath(); c.ellipse(XC, Y_PRENSA - 0.6, 7, 1.2, 0, 0, 6.283); c.fill();
        }

        // prensa: mandíbula de aço com dentes + pistões
        var perigo = Math.max(0, 1 - p / 2.2);
        var bate = M.estado === 'morto' ? 0 : Math.abs(Math.sin(prensaAbre)) * 3;
        var topo = Y_PRENSA - bate;
        c.fillStyle = 'rgba(255,40,60,' + (0.12 + perigo * 0.35) + ')';
        c.fillRect(16, topo - 14, W - 32, 14);
        var parte = _arte('prensa');
        if (parte) {
          var ph = (W - 20) * parte.height / parte.width, yp = topo - 3, fimP = yp + ph * 0.96;
          c.fillStyle = '#15171b'; c.fillRect(10, fimP, W - 20, H - fimP);
          c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(10, fimP, W - 20, 0.7);
          [0.371, 0.569].forEach(function (fx) { // pistões seguem pra baixo da arte
            var px = 10 + fx * (W - 20), gr = c.createLinearGradient(px, 0, px + 4.1, 0);
            gr.addColorStop(0, '#6c7580'); gr.addColorStop(0.35, '#e1e7ee'); gr.addColorStop(1, '#59626d');
            c.fillStyle = gr; c.fillRect(px, fimP - 0.5, 4.1, H - fimP + 0.5);
          });
          c.drawImage(parte, 10, yp, W - 20, ph);
          if (perigo > 0.3 && Math.floor(M.t * 8) % 2) { // luz de perigo pulsando
            var lx = 45, ly = yp + ph * 0.44, gl = c.createRadialGradient(lx, ly, 0, lx, ly, 9);
            gl.addColorStop(0, 'rgba(255,60,60,.7)'); gl.addColorStop(1, 'rgba(255,60,60,0)');
            c.fillStyle = gl; c.beginPath(); c.arc(lx, ly, 9, 0, 6.283); c.fill();
          }
        } else {
          M.chapa(c, 10, topo, W - 20, H - topo, '#4a515b', '#262a30');
          c.fillStyle = '#9aa3ad';
          for (var d = 12; d < W - 12; d += 5) { c.beginPath(); c.moveTo(d, topo); c.lineTo(d + 2.5, topo - 3.6); c.lineTo(d + 5, topo); c.closePath(); c.fill(); }
          M.listras(c, 10, topo + 3, W - 20, 3.4, 2.6);
          c.fillStyle = '#2f343b'; c.fillRect(20, topo + 8, 8, H); c.fillRect(W - 28, topo + 8, 8, H);
          c.fillStyle = '#c4ccd5'; c.fillRect(22.5, topo + 6, 3, H); c.fillRect(W - 25.5, topo + 6, 3, H);
          c.fillStyle = perigo > 0.3 && Math.floor(M.t * 8) % 2 ? '#ff2d55' : '#5a1220';
          c.beginPath(); c.arc(45, topo + 12, 2.2, 0, 6.283); c.fill();
        }
        // coruja amassada na mandíbula (arte da coruja operária)
        if (M.estado === 'morto' && _arte('coruja')) M.coruja(c, XC, Y_PRENSA - 6.4, 6.4, { morta: true, semSombra: true });
        rv.forEach(function (g) {
          if (g.e === 1) M.coruja(c, LANES[g.i % LANES.length], Y_PRENSA - 5, 5, { morta: true, semSombra: true, cor: g.cor, vis: g.vis });
        });
      },
      proxima: function () { return _seta(degraus).s; },
      toqueInicio: function (pt) { swipe = { x: pt.x, y: pt.y, id: pt.id }; },
      toqueFim: function (pt) {
        if (!swipe || swipe.id !== pt.id) return;
        var dx = pt.x - swipe.x, dy = pt.y - swipe.y; swipe = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        _apertar(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'dir' : 'esq') : (dy > 0 ? 'baixo' : 'cima'));
      },
      tecla: function (k, desce) {
        var m = { ArrowLeft: 'esq', ArrowRight: 'dir', ArrowUp: 'cima', ArrowDown: 'baixo' }[k];
        if (!m) return false;
        if (desce) _apertar(m);
        return true;
      }
    };
  }

  /* ═══════════════ 3. PISO FALSO (Stable Footing) ══════════════
     Grade de pisos sobre um poço, cada piso com um símbolo. O painel
     da parede mostra o símbolo da vez e o tempo. Toque num piso pra
     coruja andar até ele (de piso em piso, nunca pelo buraco). Quando a
     sirene toca, todo piso que não tem o símbolo cai. A cada rodada
     alguns pisos somem de vez e o tempo pra escolher encurta. */
  function _piso(M) {
    var W = 90, H = 160, COLS = 5, LINS = 7, T = 16, G = 1.6;
    var X0 = (W - (COLS * T + (COLS - 1) * G)) / 2, Y0 = 38;
    var SIMB = [
      { n: 'círculo', c: '#38bdf8' }, { n: 'triângulo', c: '#facc15' }, { n: 'quadrado', c: '#4ade80' },
      { n: 'cruz', c: '#f87171' }, { n: 'estrela', c: '#c084fc' }
    ];
    var rRod = M.fluxo();
    var pisos = [];             // { c, l, vivo, simb, cai (0..1), moeda }
    var alvo = 0, fase = 'escolha', faseT = 0, faseDur = 3.6, rodada = 0;
    var cor = { c: 2, l: 4, x: 0, y: 0, cam: [], prog: 0, de: null, caindo: 0 };
    for (var l = 0; l < LINS; l++) for (var c0 = 0; c0 < COLS; c0++) pisos.push({ c: c0, l: l, vivo: true, simb: 0, cai: 0, moeda: false });
    function _p(c, l) { return (c < 0 || l < 0 || c >= COLS || l >= LINS) ? null : pisos[l * COLS + c]; }
    function _cx(c) { return X0 + c * (T + G) + T / 2; }
    function _cy(l) { return Y0 + l * (T + G) + T / 2; }
    cor.x = _cx(cor.c); cor.y = _cy(cor.l) - 2;

    function _novaRodada() {
      rodada++;
      // some piso de vez a partir da 2ª rodada (sempre sobra pelo menos 7)
      if (rodada > 1) {
        var remover = Math.min(2 + Math.floor(rodada / 4), 4), sobra = rodada > 10 ? 3 : rodada > 6 ? 5 : 7;
        for (var k = 0; k < remover; k++) {
          var vivos = pisos.filter(function (p) { return p.vivo; });
          if (vivos.length <= sobra) break;
          vivos[Math.floor(rRod() * vivos.length)].vivo = false;
        }
      }
      var vivos2 = pisos.filter(function (p) { return p.vivo; });
      alvo = Math.floor(rRod() * SIMB.length);
      vivos2.forEach(function (p) { p.simb = Math.floor(rRod() * SIMB.length); p.cai = 0; p.moeda = rRod() < 0.07; });
      // garante 2-4 pisos com o símbolo certo, espalhados
      var certos = vivos2.filter(function (p) { return p.simb === alvo; });
      var minimo = rodada > 9 ? 1 : 2 + (rRod() < 0.5 ? 1 : 0), maximo = rodada > 9 ? 1 : rodada > 6 ? 2 : 4;
      while (certos.length < minimo) {
        var q = vivos2[Math.floor(rRod() * vivos2.length)];
        if (q.simb !== alvo) { q.simb = alvo; certos.push(q); }
      }
      while (certos.length > maximo) { var r = certos.pop(); r.simb = (alvo + 1 + Math.floor(rRod() * 4)) % SIMB.length; }
      fase = 'escolha'; faseT = 0;
      faseDur = Math.max(rodada > 9 ? 1.4 : 1.8, 3.7 - (rodada - 1) * 0.2);
      M.som('alerta', 0.5);
    }
    // caminho por BFS em 8 direções, só por piso vivo
    function _caminho(c0, l0, c1, l1) {
      var ini = c0 + ',' + l0, fim = c1 + ',' + l1, de = {}, fila = [[c0, l0]];
      de[ini] = null;
      while (fila.length) {
        var at = fila.shift();
        if (at[0] === c1 && at[1] === l1) break;
        for (var dc = -1; dc <= 1; dc++) for (var dl = -1; dl <= 1; dl++) {
          if (!dc && !dl) continue;
          var nc = at[0] + dc, nl = at[1] + dl, k = nc + ',' + nl, pp = _p(nc, nl);
          if (!pp || !pp.vivo || k in de) continue;
          de[k] = at; fila.push([nc, nl]);
        }
      }
      if (!(fim in de)) return null;
      var cam = [], cur = [c1, l1];
      while (cur && (cur[0] !== c0 || cur[1] !== l0)) { cam.unshift(cur); cur = de[cur[0] + ',' + cur[1]]; }
      return cam;
    }
    function _pisoDaCoruja() {
      // no meio do passo, vale o piso de onde está mais perto
      if (cor.de && cor.prog < 0.5) return _p(cor.de[0], cor.de[1]);
      return _p(cor.c, cor.l);
    }
    function _desenharSimbolo(c, x, y, r, s) {
      c.fillStyle = SIMB[s].c; c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = r * 0.16;
      c.beginPath();
      if (s === 0) c.arc(x, y, r, 0, 6.283);
      else if (s === 1) { c.moveTo(x, y - r); c.lineTo(x + r * 0.95, y + r * 0.75); c.lineTo(x - r * 0.95, y + r * 0.75); c.closePath(); }
      else if (s === 2) c.rect(x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64);
      else if (s === 3) { var a = r * 0.36; c.moveTo(x - a, y - r); c.lineTo(x + a, y - r); c.lineTo(x + a, y - a); c.lineTo(x + r, y - a); c.lineTo(x + r, y + a); c.lineTo(x + a, y + a); c.lineTo(x + a, y + r); c.lineTo(x - a, y + r); c.lineTo(x - a, y + a); c.lineTo(x - r, y + a); c.lineTo(x - r, y - a); c.lineTo(x - a, y - a); c.closePath(); }
      else { for (var i = 0; i < 10; i++) { var an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r * 1.05; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } c.closePath(); }
      c.fill(); c.stroke();
    }

    return {
      chave: 'piso', titulo: 'Piso Falso', mundo: [W, H], modo: 'sobrevivencia', artes: ['piso'],
      iniciar: function () { _novaRodada(); M.dica('Toque num piso com o símbolo do painel', 2800); },
      fundo: function (c) {
        // parede com painel
        M.chapa(c, 0, 0, W, 34, '#2e333b', '#1f2329');
        M.rebites(c, 0, 0, W, 34, 6);
        M.listras(c, 0, 32, W, 3, 2.4);
        // poço
        var g = c.createRadialGradient(W / 2, 100, 10, W / 2, 100, 90);
        g.addColorStop(0, '#050506'); g.addColorStop(1, '#141519');
        c.fillStyle = g; c.fillRect(0, 35, W, H - 35);
        c.strokeStyle = 'rgba(255,255,255,.03)'; c.lineWidth = 0.5;
        for (var i = 0; i < 8; i++) { c.beginPath(); c.arc(W / 2, 100, 10 + i * 9, 0, 6.283); c.stroke(); }
        // moldura do painel
        c.fillStyle = '#0b0d10'; c.fillRect(27, 4, 36, 25);
        c.strokeStyle = '#59616c'; c.lineWidth = 0.9; c.strokeRect(27, 4, 36, 25);
      },
      atualizar: function (dt) {
        faseT += dt;
        // anda pelo caminho
        if (cor.cam.length && fase === 'escolha') {
          if (!cor.de) { cor.de = [cor.c, cor.l]; var prox = cor.cam[0]; cor.c = prox[0]; cor.l = prox[1]; cor.prog = 0; }
          cor.prog += dt / 0.15;
          if (cor.prog >= 1) {
            cor.prog = 1; cor.cam.shift(); cor.de = null; M.som('passo', 0.4);
            var pq = _p(cor.c, cor.l);
            if (pq && pq.moeda) { pq.moeda = false; M.moeda(_cx(cor.c), _cy(cor.l)); M.pontos(150); }
          }
        }
        var tx = _cx(cor.c), ty = _cy(cor.l) - 2;
        if (cor.de) { var k = Math.min(1, cor.prog); tx = _lerp(_cx(cor.de[0]), tx, k); ty = _lerp(_cy(cor.de[1]) - 2, ty, k) - Math.sin(k * Math.PI) * 2.5; }
        cor.x = tx; cor.y = ty;

        if (fase === 'escolha' && faseT >= faseDur) {
          fase = 'queda'; faseT = 0; cor.cam = [];
          M.som('sirene', 0.9); M.tremer(1.6);
          var meu = _pisoDaCoruja();
          if (cor.de) { cor.c = meu.c; cor.l = meu.l; cor.de = null; cor.x = _cx(cor.c); cor.y = _cy(cor.l) - 2; }
          if (!meu || meu.simb !== alvo) {
            cor.caindo = 0.001;
            M.som('queda');
            M.morrer('CAIU NO POÇO! 🕳️', (rodada - 1) + (rodada === 2 ? ' rodada' : ' rodadas'));
          } else {
            M.pontos(400); M.texto(cor.x, cor.y - 8, '+400', '#4ade80', 5); M.som('acerto');
          }
        }
        if (fase === 'queda') {
          pisos.forEach(function (p) { if (p.vivo && p.simb !== alvo) p.cai = Math.min(1, p.cai + dt * 2.2); });
          if (faseT >= 1.15 && !cor.caindo) _novaRodada();
        }
      },
      atualizarFim: function (dt) {
        if (cor.caindo) cor.caindo = Math.min(1, cor.caindo + dt * 1.6);
        pisos.forEach(function (p) { if (p.vivo && p.simb !== alvo) p.cai = Math.min(1, p.cai + dt * 2.2); });
      },
      sobreviveu: function () { M.pontos(2000); M.texto(45, 90, '+2000', '#4ade80', 6); },
      // Robô: espera um tempo de reação, escolhe o piso certo mais perto
      // (ou, distraído, um qualquer) e anda até lá pelo mesmo caminho.
      bot: function (B) {
        var ini = [[2, 4], [0, 1], [4, 1], [2, 6]][B.slot] || [2, 4];
        var o = { c: ini[0], l: ini[1], x: _cx(ini[0]), y: _cy(ini[1]) - 2, cam: [], prog: 0, de: null, rod: -1, decide: 0, escolheu: false, avaliou: false };
        return {
          passo: function (dt) {
            if (o.rod !== rodada) {
              o.rod = rodada; o.escolheu = false; o.avaliou = false;
              o.decide = 0.3 + (1 - B.nivel) * 1.1 + B.r() * 0.5;
            }
            if (fase === 'escolha') {
              if (!o.escolheu && faseT >= o.decide) {
                o.escolheu = true;
                var aqui = _p(o.c, o.l), errar = B.r() < 0.04 + (1 - B.nivel) * 0.12;
                if (!(aqui && aqui.vivo && aqui.simb === alvo && !errar)) {
                  var opcoes = pisos.filter(function (p) { return p.vivo && (errar || p.simb === alvo); });
                  var melhor = null, mc = null;
                  opcoes.forEach(function (p) {
                    var cam = _caminho(o.c, o.l, p.c, p.l);
                    if (cam && (!mc || cam.length < mc.length || (errar && B.r() < 0.3))) { mc = cam; melhor = p; }
                  });
                  if (mc) o.cam = mc;
                }
              }
              if (o.cam.length) {
                if (!o.de) { o.de = [o.c, o.l]; o.c = o.cam[0][0]; o.l = o.cam[0][1]; o.prog = 0; }
                o.prog += dt / 0.15;
                if (o.prog >= 1) { o.prog = 1; o.cam.shift(); o.de = null; }
              }
            } else if (!o.avaliou) {
              o.avaliou = true; o.cam = [];
              if (o.de && o.prog < 0.5) { o.c = o.de[0]; o.l = o.de[1]; }
              o.de = null;
              var p = _p(o.c, o.l);
              if (!p || !p.vivo || p.simb !== alvo) { o.x = _cx(o.c); o.y = _cy(o.l) - 2; B.morrer(); return; }
              B.pontos(400);
            }
            var tx = _cx(o.c), ty = _cy(o.l) - 2;
            if (o.de) { var k = Math.min(1, o.prog); tx = _lerp(_cx(o.de[0]), tx, k); ty = _lerp(_cy(o.de[1]) - 2, ty, k) - Math.sin(k * Math.PI) * 2.5; }
            o.x = tx; o.y = ty;
          },
          rede: function () { return o.x.toFixed(1) + ';' + o.y.toFixed(1); },
          sobreviveu: function () { B.pontos(2000); }
        };
      },
      rede: function () { return cor.x.toFixed(1) + ';' + cor.y.toFixed(1); },
      rivalCaiu: function (g) { M.texto(g.s[0], g.s[1] - 9, g.nome + ' caiu!', g.cor, 3.4); },
      // Assistindo: as rodadas seguem (mesma semente → mesmos pisos dos rivais).
      assistir: function (dt) {
        faseT += dt;
        if (fase === 'escolha' && faseT >= faseDur) { fase = 'queda'; faseT = 0; M.tremer(1); }
        if (fase === 'queda') {
          pisos.forEach(function (p) { if (p.vivo && p.simb !== alvo) p.cai = Math.min(1, p.cai + dt * 2.2); });
          if (faseT >= 1.15) _novaRodada();
        }
      },
      desenhar: function (c) {
        // painel: símbolo alvo + anel de tempo
        var rest = fase === 'escolha' ? 1 - faseT / faseDur : 0;
        c.strokeStyle = '#1e2329'; c.lineWidth = 2.2;
        c.beginPath(); c.arc(45, 16.5, 9.5, 0, 6.283); c.stroke();
        c.strokeStyle = rest < 0.3 ? '#ff2d55' : '#f5c518';
        c.beginPath(); c.arc(45, 16.5, 9.5, -Math.PI / 2, -Math.PI / 2 + rest * 6.283); c.stroke();
        var pulsa = 1 + (rest < 0.3 ? Math.sin(M.t * 25) * 0.08 : 0);
        _desenharSimbolo(c, 45, 16.5, 6 * pulsa, alvo);
        // lâmpadas da sirene
        var on = fase === 'queda' && Math.floor(faseT * 10) % 2 === 0;
        [10, 80].forEach(function (lx) {
          c.fillStyle = on ? '#ff2d55' : '#4a121c'; c.beginPath(); c.arc(lx, 16, 3.4, 0, 6.283); c.fill();
          if (on) { var g = c.createRadialGradient(lx, 16, 0, lx, 16, 14); g.addColorStop(0, 'rgba(255,45,85,.45)'); g.addColorStop(1, 'rgba(255,45,85,0)'); c.fillStyle = g; c.beginPath(); c.arc(lx, 16, 14, 0, 6.283); c.fill(); }
        });
        // pisos
        pisos.forEach(function (p) {
          if (!p.vivo) return;
          var x = _cx(p.c), y = _cy(p.l), esc = 1 - p.cai * 0.55;
          if (p.cai >= 1) return;
          c.save(); c.translate(x, y + p.cai * 6); c.scale(esc, esc);
          c.globalAlpha = 1 - p.cai * 0.8;
          c.fillStyle = '#0c0d10'; c.fillRect(-T / 2, -T / 2 + 1.6, T, T);
          var tile = _arte('piso');
          if (tile) {
            c.drawImage(_recorte('piso', tile, 0, 1, T * _pxPorUnidade), -T / 2, -T / 2, T, T - 0.6);
          } else {
            var gg = c.createLinearGradient(0, -T / 2, 0, T / 2);
            gg.addColorStop(0, '#59616c'); gg.addColorStop(1, '#353b43');
            c.fillStyle = gg; c.fillRect(-T / 2, -T / 2, T, T - 0.6);
            c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 0.4; c.strokeRect(-T / 2 + 0.6, -T / 2 + 0.6, T - 1.2, T - 1.8);
          }
          _desenharSimbolo(c, 0, -0.4, 3.6, p.simb);
          if (p.moeda) M.desenharMoeda(c, 4.4, -4.4, 2.4);
          c.restore();
        });
        c.globalAlpha = 1;
        // rivais (um pouco deslocados pra não sumirem atrás de quem divide o piso)
        var rv = M.rivais(), DESL = [-2.6, 2.6, 0];
        rv.forEach(function (g) {
          var gx = g.s[0] + DESL[g.i % 3], gy = g.s[1];
          if (g.e === 1) {
            var kg = Math.min(1, g.morteT * 1.6);
            if (kg < 1) M.coruja(c, gx, gy + kg * 10, 4 * (1 - kg * 0.85), { rot: kg * 6, olhos: 'medo', semSombra: true, cor: g.cor, vis: g.vis, alpha: 1 - kg * 0.6 });
            return;
          }
          M.coruja(c, gx, gy, 4, { cor: g.cor, vis: g.vis, alpha: 0.92, vitoria: g.e === 2 });
          M.rotulo(c, gx, gy - 8, g.nome, g.cor);
        });
        // coruja
        if (cor.caindo) {
          var k = cor.caindo;
          if (k >= 1) return;
          M.coruja(c, cor.x, cor.y + k * 10, 4.4 * (1 - k * 0.85), { rot: k * 6, olhos: 'medo', semSombra: true, asa: Math.abs(Math.sin(M.t * 25)), alpha: 1 - k * 0.6 });
        } else {
          M.coruja(c, cor.x, cor.y, 4.4, { asa: cor.de ? 0.8 : 0, olhos: (fase === 'escolha' && rest < 0.3) ? 'medo' : null, pisca: (M.t % 3.2) < 0.12 });
          if (rv.length) M.rotulo(c, cor.x, cor.y - 8.6, 'VOCÊ', '#ffffff');
        }
      },
      estado: function () { return { alvo: alvo, fase: fase, rodada: rodada, pisos: pisos.filter(function (p) { return p.vivo && p.simb === alvo; }).map(function (p) { return [_cx(p.c), _cy(p.l)]; }) }; },
      toqueInicio: function (pt) {
        if (fase !== 'escolha') return;
        var c1 = Math.floor((pt.x - X0) / (T + G)), l1 = Math.floor((pt.y - Y0) / (T + G));
        var alvoP = _p(c1, l1);
        if (!alvoP || !alvoP.vivo) return;
        var de = cor.de ? [cor.c, cor.l] : [cor.c, cor.l];
        var cam = _caminho(de[0], de[1], c1, l1);
        if (cam) cor.cam = cam;
      },
      tecla: function (k, desce) {
        var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
        if (!d) return false;
        if (desce && fase === 'escolha' && !cor.cam.length) {
          var pq = _p(cor.c + d[0], cor.l + d[1]);
          if (pq && pq.vivo) cor.cam = [[cor.c + d[0], cor.l + d[1]]];
        }
        return true;
      }
    };
  }

  /* ═══════════════ 4. A ESTEIRA (The Filter) ═══════════════════
     Esteira passando no meio da tela, fornalha em cima. QUADROS (moldura
     dourada) têm que ir pro fogo: toque neles. PEÇAS (engrenagem,
     parafuso, porca, mola) têm que passar: não toque. Moeda: toque pra
     pegar. Três erros (peça no fogo ou quadro que passou) = a máquina
     trava. A esteira acelera com o tempo. */
  function _esteira(M) {
    var W = 90, H = 160, YE = 92, HE = 18;   // YE = centro da esteira
    var rItem = M.fluxo();
    var itens = [], voando = [], prox = 0.8, rolo = 0, erros = 0, fogo = 0, fogoCor = '#ff8a00';
    var MAX_ERROS = 3, cobreFim = false;
    var TIPOS_PECA = ['engrenagem', 'parafuso', 'porca', 'mola'];
    var CORES_QUADRO = ['#0ea5e9', '#22c55e', '#a855f7', '#ef4444', '#f97316'];

    function _vel() { return Math.min(72, 20 + M.t * 0.95); }
    function _intervalo() { return Math.max(0.36, 1.2 - M.t * 0.019); }
    function _errou(x, y, txt) {
      erros++;
      M.som('erro'); M.vibrar(60); M.tremer(1.6); M.flash('rgba(255,60,60,.28)');
      M.texto(x, y, txt, '#ff6b6b', 4.6);
      if (erros >= MAX_ERROS) M.depois(250, function () { M.morrer('A MÁQUINA TRAVOU! 🔥', 'Três erros'); });
    }
    function _desenharItem(c, it, x, y, esc) {
      c.save(); c.translate(x, y); c.scale(esc, esc); c.rotate(it.rot || 0);
      var folha = (it.t === 'moeda') ? null : _arte('itens');
      if (folha) { // arte gravada: células 0-4 quadros, 5-8 engrenagem/parafuso/porca/mola
        var qi = it.t === 'quadro' ? Math.max(0, CORES_QUADRO.indexOf(it.cor)) : 5 + Math.max(0, TIPOS_PECA.indexOf(it.p));
        if (it.p === 'engrenagem') c.rotate(it.giro * 0.6);
        var tam = 14;
        c.drawImage(_recorte('itens', folha, qi, 3, tam * _pxPorUnidade), -tam / 2, -tam / 2, tam, tam);
      } else if (it.t === 'quadro') {
        c.fillStyle = '#7a4d12'; c.fillRect(-6.2, -5, 12.4, 10);
        c.fillStyle = '#d4a017'; c.fillRect(-5.6, -4.4, 11.2, 8.8);
        c.fillStyle = '#9a6b0f'; c.fillRect(-4.4, -3.2, 8.8, 6.4);
        c.fillStyle = it.cor; c.fillRect(-3.8, -2.6, 7.6, 5.2);
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(1.6, -0.9, 0.9, 0, 6.283); c.fill();
        c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(-3.8, 2.6); c.lineTo(-1, -0.6); c.lineTo(1.4, 1.2); c.lineTo(3.8, -0.4); c.lineTo(3.8, 2.6); c.closePath(); c.fill();
      } else if (it.t === 'moeda') {
        M.desenharMoeda(c, 0, 0, 4);
      } else if (it.p === 'engrenagem') {
        M.engrenagem(c, 0, 0, 4.6, 9, it.giro, '#a3acb7');
      } else if (it.p === 'parafuso') {
        c.fillStyle = '#8f99a5'; c.fillRect(-1.2, -2, 2.4, 7.4);
        c.strokeStyle = '#6b7480'; c.lineWidth = 0.5;
        for (var i = -1; i < 5; i += 1.2) { c.beginPath(); c.moveTo(-1.2, i); c.lineTo(1.2, i + 0.6); c.stroke(); }
        c.fillStyle = '#b8c0ca'; c.fillRect(-3, -4.4, 6, 2.6);
      } else if (it.p === 'porca') {
        c.fillStyle = '#a3acb7'; c.beginPath();
        for (var k = 0; k < 6; k++) { var a = k / 6 * 6.283; c.lineTo(Math.cos(a) * 4, Math.sin(a) * 4); }
        c.closePath(); c.fill();
        c.fillStyle = '#2a2f36'; c.beginPath(); c.arc(0, 0, 1.6, 0, 6.283); c.fill();
      } else {
        c.strokeStyle = '#a3acb7'; c.lineWidth = 1.1; c.beginPath();
        for (var m = 0; m <= 24; m++) { var yy = -4.5 + m * 0.375; c.lineTo(Math.sin(m * 1.05) * 2.6, yy); }
        c.stroke();
      }
      c.restore();
    }

    return {
      chave: 'esteira', titulo: 'A Esteira', mundo: [W, H], modo: 'sobrevivencia', artes: ['itens'],
      iniciar: function () { M.dica('Quadro pro fogo (toque) · peça deixa passar', 3000); },
      fundo: function (c) {
        c.fillStyle = '#16181c'; c.fillRect(0, 0, W, H);
        // parede de tijolo refratário atrás da fornalha
        for (var y = 0; y < 62; y += 5) for (var x = (y / 5) % 2 ? -5 : 0; x < W; x += 10) {
          c.fillStyle = ((x + y) % 3) ? '#3a2420' : '#432a24'; c.fillRect(x + 0.3, y + 0.3, 9.4, 4.4);
        }
        // corpo da fornalha
        M.chapa(c, 14, 10, 62, 50, '#3b3f46', '#23262b');
        M.rebites(c, 14, 10, 62, 50, 6);
        c.fillStyle = '#0b0b0d'; c.beginPath(); c.moveTo(22, 58); c.lineTo(22, 30); c.quadraticCurveTo(45, 14, 68, 30); c.lineTo(68, 58); c.closePath(); c.fill();
        M.listras(c, 14, 58, 62, 3.4, 2.6);
        // chão
        M.chapa(c, 0, 110, W, 50, '#272b31', '#1a1d21');
        M.listras(c, 0, 110, W, 2.6, 2.2);
        // caixa de peças na ponta direita
        M.chapa(c, 76, 98, 14, 14, '#2f5b3a', '#1d3a25');
        c.fillStyle = '#86efac'; c.font = '800 3.2px ' + M.fonte; c.textAlign = 'center'; c.fillText('PEÇAS', 83, 106);
        // painel de controle
        M.chapa(c, 52, 122, 32, 26, '#353a42', '#202328');
      },
      atualizar: function (dt) {
        var v = _vel();
        rolo = (rolo + v * dt) % 6;
        fogo = Math.max(0, fogo - dt * 2);
        prox -= dt;
        if (prox <= 0) {
          var r = rItem(), it;
          if (r < 0.46) it = { t: 'quadro', cor: CORES_QUADRO[Math.floor(rItem() * CORES_QUADRO.length)] };
          else if (r < 0.92) it = { t: 'peca', p: TIPOS_PECA[Math.floor(rItem() * 4)] };
          else it = { t: 'moeda' };
          it.x = -8; it.y = YE - 3 + (rItem() - 0.5) * 3; it.giro = 0; it.rot = (rItem() - 0.5) * 0.3;
          itens.push(it);
          prox = _intervalo() * (0.75 + rItem() * 0.5);
        }
        for (var i = itens.length - 1; i >= 0; i--) {
          var it2 = itens[i];
          it2.x += v * dt; it2.giro += dt * 2;
          if (it2.x > 80) {
            itens.splice(i, 1);
            if (it2.t === 'quadro') _errou(78, YE - 12, 'QUADRO PASSOU!');
            else if (it2.t === 'peca') { M.pontos(25); M.texto(80, YE - 10, '+25', '#86efac', 3.6); M.som('clank', 0.35); }
            if (M.estado !== 'jogando') return;
          }
        }
        for (var j = voando.length - 1; j >= 0; j--) {
          var f = voando[j]; f.k += dt / 0.34;
          f.x = _lerp(f.x0, 45, f.k); f.y = _lerp(f.y0, 40, f.k) - Math.sin(f.k * Math.PI) * 18; f.rot += dt * 9;
          if (f.k >= 1) {
            voando.splice(j, 1);
            fogo = 1;
            M.particulas(45 + (Math.random() - 0.5) * 10, 44, 10, '#ffb703', 'faisca');
            M.som('fogo', 0.8);
            if (f.it.t === 'quadro') { fogoCor = '#ff8a00'; M.pontos(100); M.texto(45, 30, 'QUEIMOU! +100', '#ffd166', 4.4); }
            else { fogoCor = '#60a5fa'; _errou(45, 30, 'ERA PEÇA!'); }
          }
        }
      },
      sobreviveu: function () { M.pontos(1500); M.texto(45, 80, '+1500', '#4ade80', 6); },
      // Robô: opera a própria esteira (invisível) — cada item é uma chance
      // de errar, que cresce com a velocidade.
      bot: function (B) {
        var o = { erros: 0, prox: 0.8 };
        return {
          passo: function (dt) {
            o.prox -= dt;
            if (o.prox > 0) return;
            o.prox = _intervalo() * (0.75 + B.r() * 0.5);
            if (B.r() < 0.012 + (1 - B.nivel) * 0.05 + M.t * 0.0022) {
              o.erros++;
              if (o.erros >= MAX_ERROS) B.morrer();
            } else B.pontos(60);
          },
          rede: function () { return String(o.erros); },
          sobreviveu: function () { B.pontos(1500); }
        };
      },
      rede: function () { return String(erros); },
      rivalCaiu: function (g) { M.texto(14 + g.i * 26, 63, g.nome + ' travou!', g.cor, 3.2); },
      assistir: function (dt) { rolo = (rolo + _vel() * dt) % 6; },
      desenhar: function (c) {
        // fogo da fornalha
        var chama = 0.6 + 0.4 * Math.sin(M.t * 13) * Math.sin(M.t * 7.3) + fogo * 0.8;
        var g = c.createRadialGradient(45, 56, 1, 45, 52, 26 + fogo * 8);
        g.addColorStop(0, fogo > 0.2 ? '#fff3b0' : '#ffd166');
        g.addColorStop(0.35, fogoCor);
        g.addColorStop(1, 'rgba(120,20,0,0)');
        c.globalAlpha = Math.min(1, 0.55 + chama * 0.3);
        c.fillStyle = g; c.beginPath(); c.moveTo(22, 58); c.lineTo(22, 30); c.quadraticCurveTo(45, 14, 68, 30); c.lineTo(68, 58); c.closePath(); c.fill();
        c.globalAlpha = 1;
        for (var fl = 0; fl < 5; fl++) {
          var fx = 27 + fl * 9, alt = 8 + 5 * Math.sin(M.t * 9 + fl * 1.7) + fogo * 10;
          c.fillStyle = fl % 2 ? 'rgba(255,183,3,.85)' : 'rgba(255,90,0,.8)';
          c.beginPath(); c.moveTo(fx - 4, 58); c.quadraticCurveTo(fx - 1, 58 - alt * 0.6, fx, 58 - alt); c.quadraticCurveTo(fx + 1, 58 - alt * 0.6, fx + 4, 58); c.closePath(); c.fill();
        }
        // esteira
        c.fillStyle = '#0e0f12'; c.fillRect(0, YE - HE / 2 - 1, 80, HE + 2);
        c.fillStyle = '#2b2f35'; c.fillRect(0, YE - HE / 2, 80, HE);
        c.fillStyle = '#1f2227';
        for (var x = -6 + rolo; x < 80; x += 6) c.fillRect(x, YE - HE / 2, 2, HE);
        c.fillStyle = '#4b525c';
        for (var rx = 3; rx < 80; rx += 9) { c.beginPath(); c.arc(rx, YE + HE / 2 + 1.6, 1.8, 0, 6.283); c.fill(); }
        M.listras(c, 0, YE + HE / 2 + 3.6, 80, 2, 2);
        // seta indicando "peças → caixa"
        c.fillStyle = 'rgba(134,239,172,.4)';
        c.beginPath(); c.moveTo(70, YE - 13); c.lineTo(76, YE - 10); c.lineTo(70, YE - 7); c.closePath(); c.fill();
        // itens na esteira
        itens.forEach(function (it) { _desenharItem(c, it, it.x, it.y, 1); });
        voando.forEach(function (f) { _desenharItem(c, { t: f.it.t, p: f.it.p, cor: f.it.cor, giro: f.it.giro, rot: f.rot }, f.x, f.y, 1 - f.k * 0.4); });
        // luzes de erro no painel
        for (var e = 0; e < MAX_ERROS; e++) {
          var acesa = e < erros;
          c.fillStyle = acesa ? '#ff2d55' : '#2c1418';
          c.beginPath(); c.arc(60 + e * 8, 130, 2.6, 0, 6.283); c.fill();
          if (acesa) { c.strokeStyle = 'rgba(255,45,85,.5)'; c.lineWidth = 1; c.beginPath(); c.arc(60 + e * 8, 130, 3.8, 0, 6.283); c.stroke(); }
        }
        c.fillStyle = '#9aa3ad'; c.font = '800 3.2px ' + M.fonte; c.textAlign = 'center'; c.fillText('ERROS', 68, 141);
        // rivais: cada um opera a própria esteira — aqui só a cara e os erros
        M.rivais().forEach(function (g) {
          var rx = 14 + g.i * 26, ry = 72, ne = g.n[0] | 0;
          M.coruja(c, rx, ry, 3.2, { cor: g.cor, vis: g.vis, semSombra: true, alpha: g.e === 1 ? 0.5 : 0.95, olhos: g.e === 1 ? 'x' : (ne >= 2 ? 'medo' : null), vitoria: g.e === 2 });
          for (var k = 0; k < MAX_ERROS; k++) {
            c.fillStyle = k < ne ? '#ff2d55' : 'rgba(60,24,30,.9)';
            c.beginPath(); c.arc(rx + 6.6 + k * 3, ry + 1.5, 1.1, 0, 6.283); c.fill();
          }
          M.rotulo(c, rx + 6, ry - 6, g.nome, g.cor);
        });
        // coruja operadora
        var bracos = voando.length ? 1 : 0;
        M.coruja(c, 28, 132, 7, { asa: bracos ? 1 : 0.15 * Math.sin(M.t * 3), olhos: erros >= 2 ? 'medo' : null, olharY: -1, olharX: 0.3 });
      },
      toqueInicio: function (pt) {
        // toque mais generoso: pega o item mais perto do dedo na faixa da esteira
        var melhor = null, md = 11;
        itens.forEach(function (it) {
          var d = _dist(it.x, it.y, pt.x, pt.y);
          if (d < md) { md = d; melhor = it; }
        });
        if (!melhor) return;
        itens.splice(itens.indexOf(melhor), 1);
        if (melhor.t === 'moeda') { M.moeda(melhor.x, melhor.y); M.pontos(150); return; }
        voando.push({ it: melhor, x0: melhor.x, y0: melhor.y, x: melhor.x, y: melhor.y, k: 0, rot: 0 });
        M.som('acerto', 0.5);
      }
    };
  }

  /* ═══════════════ 5. EMPURRA-EMPURRA (sumô na plataforma) ══════
     Disco de metal sobre um poço, vista de cima. Todo mundo começa na
     mesma plataforma (cada um no seu lugar) e ela vai encolhendo. A
     partir de uns segundos, um braço gira rente ao chão e joga longe
     quem estiver no caminho. Arraste (joystick relativo ao dedo) pra
     andar com inércia; o botão EMPURRAR dá uma investida — encostar
     rápido em alguém joga ele pra fora. Caiu da borda, já era. */
  function _empurra(M) {
    var W = 90, H = 160, CX = 45, CY = 88, R0 = 38, RMIN = 12.5, R = 4.2;
    var rMoeda = M.fluxo(), rBraco = M.fluxo();
    var BRACO_T0 = 9, VMAX = 46, ACEL = 175, ATRITO = 2.4, DASH = 78, RECARGA = 1.35;
    var SPAWN = function (slot) { var a = Math.PI / 2 + slot * Math.PI / 2; return [CX + Math.cos(a) * 21, CY + Math.sin(a) * 21]; };
    var s0 = SPAWN(M.slot);
    var eu = { x: s0[0], y: s0[1], vx: 0, vy: 0, recarga: 0.6, dash: 0, caindo: 0, asa: 0 };
    var dedo = null, joy = { x: 0, y: 0 }, teclas = {};
    var moedas = [], proxMoeda = 2.5, acumVivo = 0;
    // braço: ângulo e sentido vêm só do tempo + semente → igual em todos
    var braco = { a: rBraco() * 6.283, dir: rBraco() < 0.5 ? 1 : -1, troca: BRACO_T0 + 4 + rBraco() * 4, aviso: 0 };
    var botoes = null;

    function _raio() { return M.t < 6 ? R0 : Math.max(RMIN, R0 - (M.t - 6) * 0.86); }
    function _wBraco() { return 1.05 + Math.max(0, M.t - BRACO_T0) * 0.035; }
    // Batida do braço: devolve o empurrão (vx, vy) pra quem está em (x, y), ou null.
    function _bracoBate(x, y) {
      if (M.t < BRACO_T0) return null;
      var dx = x - CX, dy = y - CY, d = Math.sqrt(dx * dx + dy * dy);
      if (d > _raio() + 1 || d < 2.5) return null;
      var ux = Math.cos(braco.a), uy = Math.sin(braco.a);
      var ao = dx * ux + dy * uy;                    // projeção ao longo do braço
      if (ao < 0) return null;
      var perp = dx * -uy + dy * ux;                 // distância lateral (com sinal)
      if (Math.abs(perp) > R + 1.4) return null;
      // só bate quem está do lado pra onde o braço gira
      var s = braco.dir;
      var f = 62 + _wBraco() * d * 0.9;
      return { vx: -uy * s * f + ux * 12, vy: ux * s * f + uy * 12, lado: perp * s };
    }
    function _mundo(dt) {
      if (M.t >= BRACO_T0) {
        braco.a += braco.dir * _wBraco() * dt;
        braco.aviso = Math.max(0, braco.troca - M.t);
        if (M.t >= braco.troca) {
          braco.dir *= -1; braco.troca = M.t + 4.5 + rBraco() * 4.5;
          M.som('clank', 0.5); M.tremer(1);
        }
      }
      proxMoeda -= dt;
      if (proxMoeda <= 0) {
        var a = rMoeda() * 6.283, rr = rMoeda() * _raio() * 0.75;
        moedas.push({ x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, v: 0 });
        proxMoeda = 2.6 + rMoeda() * 1.6;
      }
      for (var m = moedas.length - 1; m >= 0; m--) {
        moedas[m].v += dt;
        var dm = _dist(moedas[m].x, moedas[m].y, CX, CY);
        if (moedas[m].v > 7 || dm > _raio() - 1) moedas.splice(m, 1);
      }
    }
    // Física comum (eu e robô): aceleração, atrito, investida, braço e borda.
    function _fisica(o, ax, ay, dt) {
      o.vx += ax * ACEL * dt; o.vy += ay * ACEL * dt;
      var at = Math.exp(-ATRITO * dt); o.vx *= at; o.vy *= at;
      var v = Math.sqrt(o.vx * o.vx + o.vy * o.vy), lim = o.dash > 0 ? DASH * 1.1 : VMAX;
      if (v > lim) { o.vx *= lim / v; o.vy *= lim / v; }
      o.recarga = Math.max(0, o.recarga - dt); o.dash = Math.max(0, o.dash - dt);
      var b = _bracoBate(o.x, o.y);
      if (b && !o.bracoT) { o.vx = b.vx; o.vy = b.vy; o.bracoT = 0.45; o.batido = 1; }
      o.bracoT = Math.max(0, (o.bracoT || 0) - dt);
      o.x += o.vx * dt; o.y += o.vy * dt;
    }
    function _investir(o, dx, dy) {
      if (o.recarga > 0) return false;
      var n = Math.sqrt(dx * dx + dy * dy);
      if (n < 0.01) { dx = o.vx; dy = o.vy; n = Math.sqrt(dx * dx + dy * dy); }
      if (n < 0.01) { dx = 0; dy = -1; n = 1; }
      o.vx += dx / n * DASH; o.vy += dy / n * DASH;
      o.recarga = RECARGA; o.dash = 0.3;
      return true;
    }
    function _foraDaBorda(o) { return _dist(o.x, o.y, CX, CY) > _raio() + R * 0.25; }
    // Encontrão entre duas corujas: separa e, se alguém vinha rápido pra
    // cima da outra, a outra leva o tranco (cada celular só mexe no seu).
    function _encontrao(o, ox, oy, ovx, ovy, cool) {
      var dx = o.x - ox, dy = o.y - oy, d = Math.sqrt(dx * dx + dy * dy), min = R * 1.7;
      if (d >= min || d < 0.001) return false;
      var nx = dx / d, ny = dy / d;
      o.x += nx * (min - d) * 0.5; o.y += ny * (min - d) * 0.5;
      var vRel = (ovx - o.vx) * nx + (ovy - o.vy) * ny;
      if (vRel > 10 && !cool) {
        var f = Math.min(125, vRel * 1.35);
        o.vx += nx * f; o.vy += ny * f;
        return true;
      }
      return false;
    }

    return {
      chave: 'empurra', titulo: 'Empurra-Empurra', mundo: [W, H], modo: 'sobrevivencia', artes: ['plataforma', 'braco'],
      iniciar: function () {
        M.controles.innerHTML = '<div class="mq-acoes"><button type="button" class="mq-acao mq-acao-empurrar">💥 EMPURRAR</button></div>';
        M.controles.classList.add('mq-controles-on');
        botoes = M.controles.querySelector('.mq-acao-empurrar');
        botoes.addEventListener('pointerdown', function (e) {
          e.preventDefault(); _audioDestravar();
          if (M.estado !== 'jogando') return;
          if (_investir(eu, joy.x, joy.y)) { M.som('investida', 0.8); M.vibrar(20); eu.asa = 1; }
        });
        M.dica('Arraste pra andar · Empurrar joga os outros longe', 3000);
      },
      fundo: function (c) {
        var g = c.createRadialGradient(CX, CY, 6, CX, CY, 95);
        g.addColorStop(0, '#020203'); g.addColorStop(0.55, '#0b0c10'); g.addColorStop(1, '#1a1c21');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        // engrenagens lá no fundo do poço
        for (var i = 0; i < 7; i++) {
          var a = i / 7 * 6.283;
          M.engrenagem(c, CX + Math.cos(a) * 30, CY + Math.sin(a) * 30, 9, 10, a, 'rgba(70,76,86,.35)');
        }
        c.strokeStyle = 'rgba(255,45,85,.12)'; c.lineWidth = 0.6;
        for (var k = 0; k < 6; k++) { c.beginPath(); c.arc(CX, CY, 44 + k * 9, 0, 6.283); c.stroke(); }
        M.listras(c, 0, 0, W, 4, 3); M.listras(c, 0, H - 4, W, 4, 3);
      },
      atualizar: function (dt) {
        _mundo(dt);
        var ax = joy.x, ay = joy.y;
        var kx = (teclas.ArrowRight ? 1 : 0) - (teclas.ArrowLeft ? 1 : 0), ky = (teclas.ArrowDown ? 1 : 0) - (teclas.ArrowUp ? 1 : 0);
        if (kx || ky) { ax = kx; ay = ky; }
        var n = Math.sqrt(ax * ax + ay * ay); if (n > 1) { ax /= n; ay /= n; }
        _fisica(eu, ax, ay, dt);
        if (eu.batido) { eu.batido = 0; M.som('clank', 0.7); M.vibrar(40); M.tremer(1.6); M.texto(eu.x, eu.y - 8, 'PANCADA!', '#ff8fa3', 4); }
        eu.asa = Math.max(0, eu.asa - dt * 3);
        M.rivais().forEach(function (g) {
          if (g.e !== 0) return;
          if (_encontrao(eu, g.s[0], g.s[1], g.vx, g.vy, g.bateu)) {
            g.bateu = 0.3;
            M.som('clank', 0.5); M.vibrar(30);
            M.particulas(eu.x, eu.y, 7, '#ffe08a', 'faisca');
            M.texto(eu.x, eu.y - 8, 'EMPURRÃO!', g.cor, 3.6);
          }
        });
        if (_foraDaBorda(eu)) {
          eu.caindo = 0.001;
          M.som('queda');
          M.morrer('CAIU NO POÇO! 🕳️', 'Durou ' + M.t.toFixed(1).replace('.', ',') + ' s');
          return;
        }
        for (var m = moedas.length - 1; m >= 0; m--) {
          if (_dist(moedas[m].x, moedas[m].y, eu.x, eu.y) < R + 3.2) { M.moeda(moedas[m].x, moedas[m].y); M.pontos(150); moedas.splice(m, 1); }
        }
        acumVivo += dt * 100;
        if (acumVivo >= 10) { var q = Math.floor(acumVivo / 10) * 10; acumVivo -= q; M.pontos(q); }
        if (botoes) botoes.classList.toggle('mq-acao-carregando', eu.recarga > 0);
      },
      atualizarFim: function (dt) {
        if (eu.caindo) { eu.caindo = Math.min(1, eu.caindo + dt * 1.6); eu.x += eu.vx * dt * 0.4; eu.y += eu.vy * dt * 0.4; }
      },
      assistir: function (dt) { _mundo(dt); },
      sobreviveu: function () { M.pontos(2500); M.texto(eu.x, eu.y - 8, '+2500', '#4ade80', 6); },
      rede: function () { return eu.x.toFixed(1) + ';' + eu.y.toFixed(1) + ';' + (eu.dash > 0 ? 1 : 0); },
      rivalCaiu: function (g) { M.texto(g.s[0], g.s[1] - 8, g.nome + ' caiu!', g.cor, 3.6); },
      // Robô: fica atrás do braço (no lado de onde ele acabou de passar),
      // perto do centro; com alguém do lado e a investida pronta, empurra.
      bot: function (B) {
        var sp = SPAWN(B.slot);
        var o = { x: sp[0], y: sp[1], vx: 0, vy: 0, recarga: 0.8 + B.r(), dash: 0, ax: 0, ay: 0, pensa: 0 };
        var raiva = 0.25 + B.r() * 0.6;
        var outros = function () {
          var l = [];
          if (M.estado === 'jogando') l.push({ x: eu.x, y: eu.y, vx: eu.vx, vy: eu.vy, eu: true });
          M.rivais().forEach(function (g) { if (g.e === 0 && g.uid !== B.uid) l.push({ x: g.s[0], y: g.s[1], vx: g.vx, vy: g.vy }); });
          return l;
        };
        return {
          passo: function (dt) {
            o.pensa -= dt;
            var lista = outros();
            if (o.pensa <= 0) {
              o.pensa = 0.08 + (1 - B.nivel) * 0.25;
              var raio = _raio(), alvoA = M.t >= BRACO_T0 ? braco.a - braco.dir * (0.9 + (1 - B.nivel) * 0.8) : Math.atan2(o.y - CY, o.x - CX);
              var rr = raio * (0.3 + (1 - B.nivel) * 0.25);
              var tx = CX + Math.cos(alvoA) * rr, ty = CY + Math.sin(alvoA) * rr;
              var fx = tx - o.x, fy = ty - o.y;
              // longe da borda, sempre
              var dc = _dist(o.x, o.y, CX, CY);
              if (dc > raio * 0.7) { fx += (CX - o.x) * 0.6; fy += (CY - o.y) * 0.6; }
              fx += (B.r() - 0.5) * 6 * (1 - B.nivel); fy += (B.r() - 0.5) * 6 * (1 - B.nivel);
              var n = Math.sqrt(fx * fx + fy * fy); if (n > 1) { fx /= n; fy /= n; }
              o.ax = fx; o.ay = fy;
              if (o.recarga <= 0) {
                lista.forEach(function (q) {
                  var d = _dist(q.x, q.y, o.x, o.y);
                  if (d < 15 && d > 2 && B.r() < raiva) { if (_investir(o, q.x - o.x, q.y - o.y) && q.eu) M.som('investida', 0.45); }
                });
              }
            }
            _fisica(o, o.ax, o.ay, dt);
            lista.forEach(function (q) { _encontrao(o, q.x, q.y, q.vx, q.vy, false); });
            if (_foraDaBorda(o)) { B.morrer(); return; }
            B.pontos(100 * dt);
          },
          rede: function () { return o.x.toFixed(1) + ';' + o.y.toFixed(1) + ';' + (o.dash > 0 ? 1 : 0); },
          sobreviveu: function () { B.pontos(2500); }
        };
      },
      desenhar: function (c) {
        var raio = _raio();
        // plataforma
        c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.arc(CX, CY + 2.2, raio, 0, 6.283); c.fill();
        var plat = _arte('plataforma');
        if (plat) { c.drawImage(plat, CX - raio, CY - raio, raio * 2, raio * 2); }
        else {
          var g = c.createRadialGradient(CX - raio * 0.3, CY - raio * 0.3, 2, CX, CY, raio);
          g.addColorStop(0, '#5a636e'); g.addColorStop(0.7, '#3a414a'); g.addColorStop(1, '#262b31');
          c.fillStyle = g; c.beginPath(); c.arc(CX, CY, raio, 0, 6.283); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 0.4;
          for (var k = 1; k < 4; k++) { c.beginPath(); c.arc(CX, CY, raio * k / 4, 0, 6.283); c.stroke(); }
          for (var j = 0; j < 8; j++) { var aj = j / 8 * 6.283; c.beginPath(); c.moveTo(CX, CY); c.lineTo(CX + Math.cos(aj) * raio, CY + Math.sin(aj) * raio); c.stroke(); }
        }
        // borda de perigo (listra amarela/preta em anel) — a arte já tem a dela
        var segs = plat ? 0 : Math.max(12, Math.round(raio * 1.2));
        c.lineWidth = 2;
        for (var sgi = 0; sgi < segs; sgi++) {
          c.strokeStyle = sgi % 2 ? '#16161a' : '#f5c518';
          c.beginPath(); c.arc(CX, CY, raio - 1, sgi / segs * 6.283, (sgi + 1) / segs * 6.283); c.stroke();
        }
        if (raio > RMIN + 0.5 && M.t > 6 && Math.floor(M.t * 4) % 2) {
          c.strokeStyle = 'rgba(255,45,85,.55)'; c.lineWidth = 0.8;
          c.beginPath(); c.arc(CX, CY, raio + 0.8, 0, 6.283); c.stroke();
        }
        // moedas
        moedas.forEach(function (m) {
          if (m.v > 5.5 && Math.floor(m.v * 8) % 2) return;
          M.desenharMoeda(c, m.x, m.y + Math.sin(m.v * 5) * 0.7, 2.6 * Math.min(1, m.v * 4));
        });
        // braço giratório
        if (M.t >= BRACO_T0 - 1.2) {
          var on = M.t >= BRACO_T0, ux = Math.cos(braco.a), uy = Math.sin(braco.a);
          c.save(); c.translate(CX, CY); c.rotate(braco.a);
          c.globalAlpha = on ? 1 : 0.35 + 0.3 * Math.sin(M.t * 20);
          var art = _arte('braco');
          if (art) c.drawImage(art, -3, -3, raio + 3, 6);
          else {
            c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(1, -1.6, raio, 4.4);
            M.chapa(c, 0, -2.2, raio, 4.4, '#9aa3ad', '#59626d');
            M.listras(c, raio * 0.25, -0.7, raio * 0.65, 1.4, 1.6);
            c.fillStyle = (braco.aviso < 1.2 && Math.floor(M.t * 10) % 2) ? '#ff2d55' : '#7a1022';
            c.beginPath(); c.arc(raio - 2, 0, 1.6, 0, 6.283); c.fill();
          }
          c.restore(); c.globalAlpha = 1;
          // eixo central (a arte do braço já traz o pivô)
          if (!art) {
            M.engrenagem(c, CX, CY, 5, 10, braco.a * 2, '#c4ccd5');
            c.fillStyle = '#e11d48'; c.beginPath(); c.arc(CX, CY, 1.8, 0, 6.283); c.fill();
          }
          if (on && braco.aviso < 1.2) M.rotulo(c, CX + ux * raio * 0.5, CY + uy * raio * 0.5 - 4, '!', '#ff8fa3');
        }
        // rivais
        var rv = M.rivais();
        rv.forEach(function (g) {
          if (g.e === 1) {
            var kg = Math.min(1, g.morteT * 1.6);
            if (kg < 1) M.coruja(c, g.s[0], g.s[1] + kg * 6, R * (1 - kg * 0.8), { rot: kg * 5, olhos: 'medo', semSombra: true, cor: g.cor, vis: g.vis, alpha: 1 - kg * 0.6 });
            return;
          }
          var dash = (g.n[2] | 0) === 1;
          M.coruja(c, g.s[0], g.s[1], R, { cor: g.cor, vis: g.vis, alpha: g.e === 2 ? 0.6 : 0.95, asa: dash ? 1 : 0.3, olhos: dash ? 'x' : null });
          M.rotulo(c, g.s[0], g.s[1] - 8.4, g.nome, g.cor);
        });
        // eu
        if (eu.caindo) {
          var k2 = eu.caindo;
          if (k2 < 1) M.coruja(c, eu.x, eu.y + k2 * 6, R * (1 - k2 * 0.8), { rot: k2 * 5, olhos: 'medo', semSombra: true, asa: 1, alpha: 1 - k2 * 0.6 });
        } else if (M.estado !== 'morto') {
          var perto = _dist(eu.x, eu.y, CX, CY) > raio - 7;
          M.coruja(c, eu.x, eu.y, R, { asa: Math.max(eu.asa, eu.dash > 0 ? 1 : 0), olhos: perto ? 'medo' : null, olharX: eu.vx / 60, olharY: eu.vy / 60 });
          if (rv.length) M.rotulo(c, eu.x, eu.y - 8.4, 'VOCÊ', '#ffffff');
          if (eu.recarga <= 0) { c.strokeStyle = 'rgba(255,224,138,.7)'; c.lineWidth = 0.5; c.beginPath(); c.arc(eu.x, eu.y, R + 1.6, 0, 6.283); c.stroke(); }
        }
        // joystick (onde o dedo começou)
        if (dedo) {
          c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.6;
          c.beginPath(); c.arc(dedo.x0, dedo.y0, 9, 0, 6.283); c.stroke();
          c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(dedo.x0 + joy.x * 9, dedo.y0 + joy.y * 9, 3, 0, 6.283); c.fill();
        }
      },
      toqueInicio: function (p) { dedo = { x0: p.x, y0: p.y, id: p.id }; joy.x = joy.y = 0; },
      toqueMove: function (p) {
        if (!dedo || dedo.id !== p.id) return;
        var dx = (p.x - dedo.x0) / 9, dy = (p.y - dedo.y0) / 9, n = Math.sqrt(dx * dx + dy * dy);
        if (n > 1) { dx /= n; dy /= n; }
        joy.x = n < 0.12 ? 0 : dx; joy.y = n < 0.12 ? 0 : dy;
      },
      toqueFim: function (p) { if (dedo && dedo.id === p.id) { dedo = null; joy.x = joy.y = 0; } },
      tecla: function (k, desce) {
        if (k.indexOf('Arrow') === 0) { teclas[k] = desce; return true; }
        if (k === ' ' && desce && M.estado === 'jogando') { if (_investir(eu, joy.x, joy.y)) M.som('investida', 0.8); return true; }
        return false;
      }
    };
  }

  /* ═══════════════ 6. CAMPO MINADO ═════════════════════════════
     Piso de ladrilhos com minas escondidas (as mesmas pra todo mundo).
     Todos largam da fileira de baixo e têm que chegar na SAÍDA lá em
     cima. Cada ladrilho pisado mostra quantas minas há em volta — e o
     que os rivais pisam aparece pra você também (quem explode mostra
     onde estava a mina). Toque num ladrilho do lado pra dar um passo
     (ou mais longe: a coruja anda um passo naquela direção). */
  function _minado(M) {
    var W = 90, H = 160, COLS = 7, LINS = 11, T = 10.8, G = 0.8;
    var X0 = (W - (COLS * T + (COLS - 1) * G)) / 2, Y0 = 26;
    var rMina = M.fluxo();
    var mina = [], num = [], moeda = [], visto = [], boom = [];
    var INI_COL = [3, 1, 5, 6];
    function _ok(c, l) { return c >= 0 && l >= 0 && c < COLS && l < LINS; }
    function _cx(c) { return X0 + c * (T + G) + T / 2; }
    function _cy(l) { return Y0 + l * (T + G) + T / 2; }
    function _gerar() {
      for (var tent = 0; tent < 40; tent++) {
        mina = []; moeda = [];
        for (var l = 0; l < LINS; l++) {
          mina.push([]); moeda.push([]);
          for (var c = 0; c < COLS; c++) {
            var m = l > 0 && l < LINS - 1 && rMina() < 0.24;
            // largada limpa: nada colado em quem começa
            if (l === LINS - 2 && INI_COL.some(function (ic) { return Math.abs(ic - c) <= 0; })) m = false;
            mina[l].push(m);
            moeda[l].push(!m && l > 0 && l < LINS - 1 && rMina() < 0.06);
          }
        }
        if (_caminhoSeguro(3, LINS - 1)) break;
      }
      for (var l2 = 0; l2 < LINS; l2++) {
        num.push([]); visto.push([]);
        for (var c2 = 0; c2 < COLS; c2++) {
          var n = 0;
          for (var dl = -1; dl <= 1; dl++) for (var dc = -1; dc <= 1; dc++) if ((dl || dc) && _ok(c2 + dc, l2 + dl) && mina[l2 + dl][c2 + dc]) n++;
          num[l2].push(n); visto[l2].push(l2 === LINS - 1 || l2 === 0);
        }
      }
    }
    // BFS em 8 direções só por ladrilho sem mina (do robô e da geração)
    function _caminhoSeguro(c0, l0) {
      var de = {}, fila = [[c0, l0]], achou = null;
      de[c0 + ',' + l0] = null;
      while (fila.length) {
        var at = fila.shift();
        if (at[1] === 0) { achou = at; break; }
        for (var dl = -1; dl <= 1; dl++) for (var dc = -1; dc <= 1; dc++) {
          var nc = at[0] + dc, nl = at[1] + dl, k = nc + ',' + nl;
          if ((!dl && !dc) || !_ok(nc, nl) || mina[nl][nc] || k in de) continue;
          de[k] = at; fila.push([nc, nl]);
        }
      }
      if (!achou) return null;
      var cam = [], cur = achou;
      while (cur && !(cur[0] === c0 && cur[1] === l0)) { cam.unshift(cur); cur = de[cur[0] + ',' + cur[1]]; }
      return cam;
    }
    _gerar();

    var ini = INI_COL[M.slot] != null ? INI_COL[M.slot] : 3;
    var eu = { c: ini, l: LINS - 1, de: null, prog: 0, x: _cx(ini), y: _cy(LINS - 1), melhor: LINS - 1, morto: false, fila: null };

    function _pisar(o, souEu) {
      visto[o.l][o.c] = true;
      if (mina[o.l][o.c]) {
        boom.push({ c: o.c, l: o.l, t: 0 });
        return 'mina';
      }
      if (souEu && moeda[o.l][o.c]) { moeda[o.l][o.c] = false; M.moeda(_cx(o.c), _cy(o.l)); M.pontos(150); }
      return o.l === 0 ? 'saida' : 'ok';
    }
    function _passo(o, dc, dl) {
      var nc = o.c + dc, nl = o.l + dl;
      if (!_ok(nc, nl) || o.de) return false;
      o.de = [o.c, o.l]; o.c = nc; o.l = nl; o.prog = 0;
      return true;
    }
    function _andar(o, dt) {
      if (!o.de) return null;
      o.prog += dt / 0.17;
      var k = Math.min(1, o.prog);
      o.x = _lerp(_cx(o.de[0]), _cx(o.c), k); o.y = _lerp(_cy(o.de[1]), _cy(o.l), k) - Math.sin(k * Math.PI) * 2;
      if (o.prog < 1) return null;
      o.de = null; o.x = _cx(o.c); o.y = _cy(o.l);
      return 'chegou';
    }
    function _restante() { return Math.max(0, 45 - M.t); }
    // A colheitadeira (igual ao Minefield): a partir de COLH_INI ela come
    // uma fileira de baixo a cada COLH_PASSO segundos. Quem estiver numa
    // fileira comida, já era. A saída (fileira 0) nunca é comida.
    var COLH_INI = 8, COLH_PASSO = 3.3;
    function _colhidas() { return M.t < COLH_INI ? 0 : (M.t - COLH_INI) / COLH_PASSO; }
    function _comida(l) { return l > 0 && (LINS - 1 - l) < Math.floor(_colhidas()); }
    function _celulaDe(o) { return o.de && o.prog < 0.5 ? o.de[1] : o.l; }

    return {
      chave: 'minado', titulo: 'Campo Minado', mundo: [W, H], artes: ['pisoMina', 'mina'],
      iniciar: function () { M.dica('Chegue na saída antes da colheitadeira · número = minas em volta', 3400); },
      tituloFim: 'ESCAPOU!',
      fundo: function (c) {
        c.fillStyle = '#0c0d10'; c.fillRect(0, 0, W, H);
        // saída lá em cima
        c.fillStyle = '#0a2a18'; c.fillRect(X0 - 1, Y0 - 9, COLS * (T + G) + 1.2, 7);
        c.fillStyle = 'rgba(74,222,128,.85)'; c.fillRect(X0 + 1, Y0 - 7.6, COLS * (T + G) - 2.8, 4.2);
        c.fillStyle = '#05140b'; c.font = '800 3.6px ' + M.fonte; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('SAÍDA', W / 2, Y0 - 5.5);
        M.listras(c, 0, 0, W, 3, 2.4);
        M.listras(c, 0, H - 3.2, W, 3.2, 2.4);
      },
      atualizar: function (dt) {
        if (_comida(_celulaDe(eu))) {
          M.penas(eu.x, eu.y); M.som('serra'); M.tremer(3); eu.morto = true;
          M.morrer('A COLHEITADEIRA PEGOU! 🚜', (LINS - 1 - eu.melhor) + ' fileiras');
          return;
        }
        var r = _andar(eu, dt);
        if (r === 'chegou') {
          M.som('passo', 0.5);
          var res = _pisar(eu, true);
          if (res === 'mina') {
            M.penas(eu.x, eu.y); M.particulas(eu.x, eu.y, 16, '#ff8a00', 'faisca');
            M.som('explosao'); M.tremer(4); eu.morto = true;
            M.morrer('BOOM! 💣', (LINS - 1 - eu.melhor) + ' fileiras');
            return;
          }
          if (eu.l < eu.melhor) { M.pontos(80 * (eu.melhor - eu.l)); eu.melhor = eu.l; }
          if (res === 'saida') {
            var bonus = 1500 + Math.round(_restante() * 40);
            M.pontos(bonus); M.texto(eu.x, eu.y - 8, '+' + bonus, '#4ade80', 5);
            M.vencer('ESCAPOU! 🏁', 'Faltavam ' + Math.ceil(_restante()) + ' s');
            return;
          }
          if (eu.fila) { var f = eu.fila; eu.fila = null; _passo(eu, f[0], f[1]); }
        }
        boom.forEach(function (b) { b.t += dt; });
      },
      atualizarFim: function (dt) { boom.forEach(function (b) { b.t += dt; }); },
      assistir: function (dt) { boom.forEach(function (b) { b.t += dt; }); },
      tempoEsgotado: function () { M.som('queda'); M.morrer('O PISO DESABOU! ⏱️', 'Não chegou na saída'); },
      rede: function () { return eu.c + ';' + eu.l; },
      rivalCaiu: function (g) {
        var c = Math.round(g.n[0]), l = Math.round(g.n[1]);
        if (_ok(c, l)) { visto[l][c] = true; boom.push({ c: c, l: l, t: 0 }); M.particulas(_cx(c), _cy(l), 12, '#ff8a00', 'faisca'); M.som('explosao', 0.45); }
        M.texto(_cx(c), _cy(l) - 7, g.nome + ' explodiu!', g.cor, 3.2);
      },
      // Robô: conhece o mapa (é robô), mas a cada passo pode se distrair e
      // pisar num ladrilho qualquer pra cima — que pode ter mina.
      bot: function (B) {
        var ic = INI_COL[B.slot] != null ? INI_COL[B.slot] : 3;
        var o = { c: ic, l: LINS - 1, de: null, prog: 0, x: _cx(ic), y: _cy(LINS - 1), espera: 0.8 + B.r() };
        var intervalo = 0.35 + (1 - B.nivel) * 0.55, erro = 0.03 + (1 - B.nivel) * 0.09;
        return {
          passo: function (dt) {
            if (_comida(_celulaDe(o))) { B.morrer(); return; }
            if (o.de) {
              if (_andar(o, dt) !== 'chegou') return;
              var res = _pisar(o, false);
              if (res === 'mina') { B.morrer(); return; }
              if (res === 'saida') { B.pontos(80 * (LINS - 1) + 1500 + Math.round(_restante() * 40)); B.vencer(); return; }
              B.pontos(40);
              return;
            }
            o.espera -= dt;
            if (o.espera > 0) return;
            o.espera = intervalo * (0.7 + B.r() * 0.6);
            if (B.r() < erro) {
              var op = [];
              for (var dc = -1; dc <= 1; dc++) if (_ok(o.c + dc, o.l - 1) && !visto[o.l - 1][o.c + dc]) op.push(dc);
              if (op.length) { _passo(o, op[Math.floor(B.r() * op.length)], -1); return; }
            }
            var cam = _caminhoSeguro(o.c, o.l);
            if (cam && cam.length) _passo(o, cam[0][0] - o.c, cam[0][1] - o.l);
          },
          rede: function () { return o.c + ';' + o.l; }
        };
      },
      desenhar: function (c) {
        // rivais que pisaram: revela o ladrilho (vem pela rede a posição)
        var rv = M.rivais();
        rv.forEach(function (g) {
          var gc = Math.round(g.n[0]), gl = Math.round(g.n[1]);
          if (_ok(gc, gl)) visto[gl][gc] = true;
        });
        var tile = _arte('pisoMina');
        for (var l = 0; l < LINS; l++) for (var cc = 0; cc < COLS; cc++) {
          var x = X0 + cc * (T + G), y = Y0 + l * (T + G), v = visto[l][cc];
          c.fillStyle = '#050607'; c.fillRect(x, y + 1, T, T);
          if (tile && !v) c.drawImage(_recorte('pisoMina', tile, 0, 1, T * _pxPorUnidade), x, y, T, T - 0.6);
          else {
            var gg = c.createLinearGradient(0, y, 0, y + T);
            if (v) { gg.addColorStop(0, '#3d4652'); gg.addColorStop(1, '#2b323b'); }
            else { gg.addColorStop(0, '#5b6470'); gg.addColorStop(1, '#3b424c'); }
            c.fillStyle = gg; c.fillRect(x, y, T, T - 0.6);
            if (!v) { c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 0.35; c.strokeRect(x + 0.6, y + 0.6, T - 1.2, T - 1.8); }
          }
          if (v && l > 0 && l < LINS - 1 && !mina[l][cc] && num[l][cc]) {
            var cores = ['', '#60a5fa', '#4ade80', '#facc15', '#fb923c', '#f87171', '#e879f9', '#f472b6', '#fff'];
            c.fillStyle = cores[num[l][cc]]; c.font = '800 6px ' + M.fonte; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(String(num[l][cc]), x + T / 2, y + T / 2);
          }
          if (moeda[l][cc]) M.desenharMoeda(c, x + T / 2, y + T / 2 + Math.sin(M.t * 4 + cc) * 0.6, 2.2);
        }
        // fileiras comidas pela colheitadeira + a lâmina subindo
        var k = _colhidas(), comidas = Math.floor(k);
        if (comidas > 0) {
          var yc = Y0 + (LINS - comidas) * (T + G) - G;
          c.fillStyle = '#050505'; c.fillRect(X0 - 1, yc, COLS * (T + G) + 1, Y0 + LINS * (T + G) - yc + 1);
          c.fillStyle = 'rgba(120,20,20,.25)';
          for (var cr = 0; cr < comidas * 3; cr++) c.fillRect(X0 + ((cr * 37) % 76), yc + ((cr * 13) % Math.max(1, comidas * 11)), 2, 1);
        }
        if (M.t > COLH_INI - 2) {
          var yl = Math.min(Y0 + LINS * (T + G), Y0 + (LINS - k) * (T + G)) - 1.5, xs = X0 - 1, ws = COLS * (T + G) + 1;
          c.fillStyle = 'rgba(255,45,85,.18)'; c.fillRect(xs, yl - 9, ws, 9);
          M.chapa(c, xs, yl - 1.5, ws, 4.5, '#b91c1c', '#7f1d1d');
          c.fillStyle = '#e5e7eb';
          for (var dx = xs + ((M.t * 30) % 4); dx < xs + ws; dx += 4) { c.beginPath(); c.moveTo(dx, yl - 1.5); c.lineTo(dx + 2, yl - 4.2); c.lineTo(dx + 4, yl - 1.5); c.closePath(); c.fill(); }
          M.listras(c, xs, yl + 3, ws, 1.6, 1.4);
        }
        // explosões / minas reveladas
        boom.forEach(function (b) {
          var bx = _cx(b.c), by = _cy(b.l);
          var art = _arte('mina');
          if (art) c.drawImage(art, bx - T / 2, by - T / 2, T, T);
          else {
            c.fillStyle = '#1a0a0a'; c.beginPath(); c.arc(bx, by, 3.8, 0, 6.283); c.fill();
            c.fillStyle = '#ff2d55'; c.beginPath(); c.arc(bx, by, 1.4, 0, 6.283); c.fill();
            c.strokeStyle = '#2a1a1a'; c.lineWidth = 0.9;
            for (var i = 0; i < 6; i++) { var a = i / 6 * 6.283; c.beginPath(); c.moveTo(bx + Math.cos(a) * 3, by + Math.sin(a) * 3); c.lineTo(bx + Math.cos(a) * 5, by + Math.sin(a) * 5); c.stroke(); }
          }
          if (b.t < 0.6) {
            var gr = c.createRadialGradient(bx, by, 0, bx, by, 14 * (0.4 + b.t));
            gr.addColorStop(0, 'rgba(255,200,80,' + (0.9 - b.t * 1.4) + ')'); gr.addColorStop(1, 'rgba(255,60,0,0)');
            c.fillStyle = gr; c.beginPath(); c.arc(bx, by, 14 * (0.4 + b.t), 0, 6.283); c.fill();
          }
        });
        // vizinhos onde dá pra pisar
        if (M.estado === 'jogando' && !eu.de) {
          c.strokeStyle = 'rgba(245,197,24,' + (0.35 + 0.25 * Math.sin(M.t * 6)) + ')'; c.lineWidth = 0.5;
          for (var dl = -1; dl <= 1; dl++) for (var dc = -1; dc <= 1; dc++) {
            if ((!dl && !dc) || !_ok(eu.c + dc, eu.l + dl)) continue;
            c.strokeRect(X0 + (eu.c + dc) * (T + G) + 0.4, Y0 + (eu.l + dl) * (T + G) + 0.4, T - 0.8, T - 1.4);
          }
        }
        var DESL = [-2.2, 2.2, 0];
        rv.forEach(function (g) {
          var gx = _lerp(_cx(0), _cx(1), g.s[0]) + DESL[g.i % 3], gy = _lerp(_cy(0), _cy(1), g.s[1]) - 2.2;
          if (g.e === 1) { if (g.morteT < 1.2) M.coruja(c, gx, gy, 3.4, { morta: true, cor: g.cor, vis: g.vis, semSombra: true, alpha: 1 - g.morteT / 1.2 }); return; }
          M.coruja(c, gx, gy, 3.4, { cor: g.cor, vis: g.vis, alpha: 0.92, vitoria: g.e === 2 });
          M.rotulo(c, gx, gy - 7, g.nome, g.cor);
        });
        if (!eu.morto) {
          M.coruja(c, eu.x, eu.y - 2.2, 3.8, { asa: eu.de ? 0.8 : 0, olhos: eu.l > 0 && num[eu.l][eu.c] >= 3 ? 'medo' : null, vitoria: M.estado === 'venceu', pisca: (M.t % 3) < 0.12 });
          if (rv.length) M.rotulo(c, eu.x, eu.y - 9.4, 'VOCÊ', '#ffffff');
        }
      },
      toqueInicio: function (pt) {
        if (M.estado !== 'jogando') return;
        var c1 = Math.floor((pt.x - X0) / (T + G)), l1 = Math.floor((pt.y - Y0) / (T + G));
        if (!_ok(c1, l1)) { if (pt.y < Y0 && eu.l === 1) { c1 = eu.c; l1 = 0; } else return; }
        var dc = Math.sign(c1 - eu.c), dl = Math.sign(l1 - eu.l);
        if (!dc && !dl) return;
        if (eu.de) { eu.fila = [dc, dl]; return; }
        _passo(eu, dc, dl);
      },
      tecla: function (k, desce) {
        var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
        if (!d) return false;
        if (desce && M.estado === 'jogando') { if (eu.de) eu.fila = d; else _passo(eu, d[0], d[1]); }
        return true;
      }
    };
  }

  /* ═══════════════ 7. O TÚNEL ══════════════════════════════════
     Túnel visto de cima com 4 faixas. Fileiras de pistões descem cada
     vez mais rápido, sempre com pelo menos um vão. Toque no lado
     esquerdo/direito da tela (ou deslize) pra trocar de faixa. As
     fileiras saem iguais pra todo mundo; os rivais correm nas mesmas
     faixas, por cima de você. */
  function _tunel(M) {
    var W = 90, H = 160, N = 4, LX0 = 10, LW = 17.5, PY = 132, TOPO = 6;
    var rFila = M.fluxo();
    var filas = [], prox = 1.2, rolo = 0, passadas = 0;
    var eu = { faixa: [1, 2, 0, 3][M.slot] || 1, x: 0, morto: false, bate: 0 };
    function _fx(f) { return LX0 + f * LW + LW / 2; }
    eu.x = _fx(eu.faixa);
    function _vel() { return 40 + M.t * 1.45; }
    function _gap() { return Math.max(0.5, 1.3 - M.t * 0.016); }
    function _novaFila() {
      var bloq = [false, false, false, false];
      var nb = M.t < 6 ? 1 + (rFila() < 0.4 ? 1 : 0) : M.t < 18 ? 2 + (rFila() < 0.3 ? 1 : 0) : 2 + (rFila() < 0.6 ? 1 : 0);
      // um vão garantido, sorteado
      var livre = Math.floor(rFila() * N);
      var ordem = [0, 1, 2, 3].filter(function (f) { return f !== livre; });
      for (var i = ordem.length - 1; i > 0; i--) { var j = Math.floor(rFila() * (i + 1)); var t = ordem[i]; ordem[i] = ordem[j]; ordem[j] = t; }
      for (var k = 0; k < nb && k < ordem.length; k++) bloq[ordem[k]] = true;
      var livres = [0, 1, 2, 3].filter(function (f) { return !bloq[f]; });
      var m = rFila() < 0.25 ? livres[Math.floor(rFila() * livres.length)] : -1;
      filas.push({ y: TOPO - 8, bloq: bloq, moeda: m, n: ++_nFila, passou: false });
    }
    var _nFila = 0;
    function _mundo(dt) {
      var v = _vel();
      rolo = (rolo + v * dt) % 12;
      prox -= dt;
      if (prox <= 0) { _novaFila(); prox = _gap() * (0.85 + rFila() * 0.3); }
      for (var i = filas.length - 1; i >= 0; i--) {
        filas[i].y += v * dt;
        if (filas[i].y > H + 10) filas.splice(i, 1);
      }
    }
    function _filaEm(y0, y1) { return filas.filter(function (f) { return f.y >= y0 && f.y <= y1; }); }
    function _mudar(d) {
      if (M.estado !== 'jogando') return;
      var nf = _clamp(eu.faixa + d, 0, N - 1);
      if (nf === eu.faixa) { eu.bate = 0.15; return; }
      eu.faixa = nf; M.som('passo', 0.5);
    }
    var swipe = null;

    return {
      chave: 'tunel', titulo: 'O Túnel', mundo: [W, H], modo: 'sobrevivencia', artes: ['pistao'],
      iniciar: function () { M.dica('Toque à esquerda ou à direita pra trocar de faixa', 3000); },
      fundo: function (c) {
        c.fillStyle = '#0b0c0f'; c.fillRect(0, 0, W, H);
        M.chapa(c, 0, 0, LX0, H, '#2a2f36', '#1c2025'); M.chapa(c, W - LX0, 0, LX0, H, '#2a2f36', '#1c2025');
        c.fillStyle = '#39404a'; c.fillRect(3, 0, 2, H); c.fillRect(W - 5, 0, 2, H);
        for (var y = 6; y < H; y += 18) { c.fillStyle = '#4b535e'; c.fillRect(1.8, y, 4.4, 2.2); c.fillRect(W - 6.2, y, 4.4, 2.2); }
      },
      atualizar: function (dt) {
        _mundo(dt);
        eu.x = _lerp(eu.x, _fx(eu.faixa), Math.min(1, dt * 18));
        eu.bate = Math.max(0, eu.bate - dt);
        var fAqui = Math.round((eu.x - LX0 - LW / 2) / LW);
        for (var i = 0; i < filas.length; i++) {
          var f = filas[i];
          if (Math.abs(f.y - PY) < 4.5) {
            if (f.bloq[fAqui]) {
              eu.morto = true;
              M.penas(eu.x, PY); M.som('prensa'); M.tremer(4);
              M.morrer('PRENSADA! ⚙️', passadas + ' fileiras');
              return;
            }
            if (f.moeda === fAqui) { f.moeda = -1; M.moeda(_fx(fAqui), PY); M.pontos(150); }
          }
          if (!f.passou && f.y > PY + 4.5) { f.passou = true; passadas++; M.pontos(50); }
        }
      },
      assistir: function (dt) { _mundo(dt); },
      sobreviveu: function () { M.pontos(2000); M.texto(45, 100, '+2000', '#4ade80', 6); },
      rede: function () { return eu.x.toFixed(1) + ';' + passadas; },
      rivalCaiu: function (g) { M.texto(g.s[0], PY - 10, g.nome + ' prensada!', g.cor, 3.2); },
      // Robô: olha as fileiras que vêm (mais longe se for afiado) e vai pro
      // vão mais perto, uma faixa por vez, com tempo de reação.
      bot: function (B) {
        var o = { faixa: [1, 2, 0, 3][B.slot] || 0, x: 0, pensa: 0, passadas: 0, vistas: {} };
        o.x = _fx(o.faixa);
        var olhar = 20 + B.nivel * 38, reacao = 0.1 + (1 - B.nivel) * 0.22, erro = 0.03 + (1 - B.nivel) * 0.12;
        return {
          passo: function (dt) {
            o.x = _lerp(o.x, _fx(o.faixa), Math.min(1, dt * 18));
            o.pensa -= dt;
            if (o.pensa <= 0) {
              o.pensa = reacao;
              // a fileira que ainda não passou mais perto dele
              var vem = _filaEm(PY - olhar, PY + 4.5).sort(function (a, b) { return b.y - a.y; })[0];
              if (vem) {
                var alvo = o.faixa;
                if (vem.bloq[o.faixa]) {
                  var melhor = 9;
                  for (var f = 0; f < N; f++) if (!vem.bloq[f] && Math.abs(f - o.faixa) < melhor) { melhor = Math.abs(f - o.faixa); alvo = f; }
                }
                if (!o.vistas[vem.n] && B.r() < erro) alvo = _clamp(o.faixa + (B.r() < 0.5 ? -1 : 1), 0, N - 1);
                o.vistas[vem.n] = 1;
                if (alvo !== o.faixa) {
                  // só passa pra faixa do lado se ela não está sendo prensada agora
                  var prox = o.faixa + (alvo > o.faixa ? 1 : -1);
                  if (_filaEm(PY - 8, PY + 5).every(function (fl) { return !fl.bloq[prox]; })) o.faixa = prox;
                }
              }
            }
            var fAqui = Math.round((o.x - LX0 - LW / 2) / LW);
            for (var i = 0; i < filas.length; i++) {
              var fl = filas[i];
              if (Math.abs(fl.y - PY) < 4.5 && fl.bloq[fAqui]) { B.morrer(); return; }
              if (fl.y > PY + 4.5 && !o.vistas['p' + fl.n]) { o.vistas['p' + fl.n] = 1; o.passadas++; B.pontos(50); }
            }
          },
          rede: function () { return o.x.toFixed(1) + ';' + o.passadas; },
          sobreviveu: function () { B.pontos(2000); }
        };
      },
      desenhar: function (c) {
        // faixas com piso correndo
        for (var f = 0; f < N; f++) {
          var x = LX0 + f * LW;
          c.fillStyle = f % 2 ? '#1d2127' : '#22272e'; c.fillRect(x, 0, LW, H);
          c.fillStyle = 'rgba(0,0,0,.25)';
          for (var y = -12 + rolo; y < H; y += 12) c.fillRect(x + 1, y, LW - 2, 1.2);
          if (f) { c.fillStyle = 'rgba(245,197,24,.35)'; for (var yy = -12 + rolo; yy < H; yy += 12) c.fillRect(x - 0.3, yy, 0.6, 6); }
        }
        // fileiras de pistões
        var art = _arte('pistao');
        filas.forEach(function (fl) {
          for (var k = 0; k < N; k++) {
            var px = LX0 + k * LW;
            if (fl.bloq[k]) {
              var perto = fl.y > PY - 30 && fl.y < PY;
              if (art) c.drawImage(art, px + 0.6, fl.y - 6, LW - 1.2, 12);
              else {
                c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(px + 1, fl.y - 4.2, LW - 2, 10);
                M.chapa(c, px + 0.8, fl.y - 6, LW - 1.6, 11, '#8b949f', '#4b525c');
                M.listras(c, px + 0.8, fl.y + 2.6, LW - 1.6, 2.4, 1.8);
                c.fillStyle = perto && Math.floor(M.t * 10) % 2 ? '#ff2d55' : '#5a1220';
                c.beginPath(); c.arc(px + LW / 2, fl.y - 2.2, 1.3, 0, 6.283); c.fill();
              }
            } else if (fl.moeda === k) {
              M.desenharMoeda(c, px + LW / 2, fl.y, 2.6);
            }
          }
        });
        // rivais
        var rv = M.rivais(), DESL = [-1.8, 1.8, 0];
        rv.forEach(function (g) {
          var gx = g.s[0] + DESL[g.i % 3];
          if (g.e === 1) { if (g.morteT < 1.2) M.coruja(c, gx, PY, 4, { morta: true, cor: g.cor, vis: g.vis, semSombra: true, alpha: 1 - g.morteT / 1.2 }); return; }
          M.coruja(c, gx, PY + 1.5, 4, { cor: g.cor, vis: g.vis, alpha: 0.85, costas: g.e === 0, passo: Math.floor(M.t * 8 + g.i) % 2 === 1, vitoria: g.e === 2 });
          M.rotulo(c, gx, PY - 6.6, g.nome, g.cor);
        });
        if (!eu.morto) {
          M.coruja(c, eu.x + (eu.bate ? Math.sin(M.t * 60) * 0.8 : 0), PY, 4.6, { costas: M.estado === 'jogando', passo: Math.floor(M.t * 8) % 2 === 1, vitoria: M.estado === 'venceu' });
          if (rv.length) M.rotulo(c, eu.x, PY - 8.4, 'VOCÊ', '#ffffff');
        }
        // aviso da próxima fileira no alto
        var prox2 = _filaEm(-20, 30)[0];
        if (prox2 && M.estado === 'jogando') {
          for (var q = 0; q < N; q++) if (prox2.bloq[q]) { c.fillStyle = 'rgba(255,45,85,.22)'; c.fillRect(LX0 + q * LW, 0, LW, 3); }
        }
      },
      toqueInicio: function (pt) { swipe = { x: pt.x, y: pt.y, id: pt.id, usou: false }; },
      toqueMove: function (pt) {
        if (!swipe || swipe.id !== pt.id || swipe.usou) return;
        var dx = pt.x - swipe.x;
        if (Math.abs(dx) > 7) { swipe.usou = true; _mudar(dx > 0 ? 1 : -1); }
      },
      toqueFim: function (pt) {
        if (!swipe || swipe.id !== pt.id) return;
        if (!swipe.usou) _mudar(pt.x < W / 2 ? -1 : 1);
        swipe = null;
      },
      tecla: function (k, desce) {
        if (k === 'ArrowLeft' || k === 'ArrowRight') { if (desce) _mudar(k === 'ArrowLeft' ? -1 : 1); return true; }
        return false;
      }
    };
  }

  /* ═══════════════ 8. PUFF DA CORUJA (todos no mesmo banco) ════
     As corujas sentadas lado a lado no banco do intervalo da fábrica.
     A cada ciclo a Máquina marca uma META no medidor: até a sirene
     tocar, cada um tem que dar um fôlego que passe da meta. Segure pra
     encher o peito e solte acima da marca — mas cada fôlego tem um
     limite escondido (a coruja vai ficando vermelha): passou dele,
     tosse e fica tonta. Quem chega na sirene sem um fôlego bom, cai.
     A meta sobe e o ciclo encurta até sobrar uma. Limites e ciclos saem
     da semente: iguais pra todos. */
  function _puff(M) {
    var W = 90, H = 160, BANCO_Y = 112, MIN_S = 0.15, TOSSE_S = 1.4;
    var LUGAR = [14.5, 34.8, 55.2, 75.5];
    var rLim = M.fluxo(), limites = [];
    function _lim(n) { while (limites.length <= n) limites.push(1.0 + rLim() * 0.9); return limites[n]; }
    var ciclo = { k: 0, ini: 2.2, dur: 6.5 };
    function _meta() { return Math.min(0.9, 0.35 + ciclo.k * 0.06); }
    function _fimCiclo() { return ciclo.ini + ciclo.dur; }
    var eu = { n: 0, segura: false, t: 0, tosse: 0, solta: 0, ok: false, fraco: 0 };
    var nuvens = [];

    function _quadroPuff(o) {
      if (o.tosse > 0) return (TOSSE_S - o.tosse) < 0.9 ? (Math.floor(o.tosse * 6) % 2 ? 6 : 7) : 8;
      if (o.solta > 0) return 5;
      if (!o.segura) return (M.t % 3.4) < 0.12 ? 1 : 0;
      var p = o.t / _lim(o.n);
      return p < 0.25 ? 1 : p < 0.5 ? 2 : p < 0.78 ? 3 : 4;
    }
    function _fill(o) { return o.segura ? Math.min(1, o.t / _lim(o.n)) : 0; }
    function _st(o) { return o.tosse > 0 ? 3 : o.solta > 0 ? 2 : o.segura ? 1 : 0; }
    // Solta o fôlego: 'bom' (passou da meta), 'fraco' ou null (curto demais).
    function _soltar(o, x, souEu) {
      if (!o.segura) return null;
      o.segura = false;
      if (o.t < MIN_S) return null;
      var fill = Math.min(1, o.t / _lim(o.n));
      o.n++; o.solta = 0.38;
      nuvens.push({ x: x + 4, y: BANCO_Y - 15, t: 0, tam: 3 + fill * 6 });
      var bom = fill >= _meta();
      if (bom) o.ok = true;
      if (souEu) {
        if (bom) { M.som('acerto', 0.7); M.vibrar(15); M.texto(x, BANCO_Y - 26, 'BOM! ✔', '#4ade80', 4); }
        else { M.som('passo', 0.5); M.texto(x, BANCO_Y - 26, 'FRACO!', '#facc15', 3.6); o.fraco = 0.6; }
      }
      return bom ? 'bom' : 'fraco';
    }
    function _passoComum(o, dt, souEu) {
      o.tosse = Math.max(0, o.tosse - dt);
      o.solta = Math.max(0, o.solta - dt);
      o.fraco = Math.max(0, (o.fraco || 0) - dt);
      if (o.segura) {
        o.t += dt;
        if (o.t > _lim(o.n)) {
          o.segura = false; o.tosse = TOSSE_S; o.n++;
          if (souEu) { M.som('tosse'); M.vibrar([40, 60, 40]); M.tremer(1.4); M.flash('rgba(255,90,90,.22)'); }
        }
      }
    }
    // Ciclos (iguais pra todos): a sirene julga quem não deu fôlego bom.
    var julgarEu = null, julgarBots = [];
    function _mundo(dt) {
      for (var i = nuvens.length - 1; i >= 0; i--) { nuvens[i].t += dt; nuvens[i].y -= dt * 9; if (nuvens[i].t > 1.6) nuvens.splice(i, 1); }
      if (M.t >= _fimCiclo()) {
        M.som('sirene', 0.8); M.tremer(1.2);
        if (julgarEu) julgarEu();
        julgarBots.forEach(function (f) { f(); });
        ciclo.k++; ciclo.ini = M.t; ciclo.dur = Math.max(3.4, 6.5 - ciclo.k * 0.3);
        eu.ok = false;
      }
    }
    function _desenharCoruja(c, x, q, cor, alpha, eh) {
      var w = 19, y = BANCO_Y - 9;
      if (!_quadroArte(c, 'puff', q, 3, 3, x, y, w, cor, alpha)) {
        M.coruja(c, x, y + 1, 6.4, { cor: typeof cor === 'string' ? cor : null, vis: typeof cor === 'object' ? cor : null, alpha: alpha, sx: q >= 2 && q <= 4 ? 1 + (q - 1) * 0.08 : 1, olhos: q === 8 ? 'x' : q === 4 ? 'medo' : null, pisca: q === 1 || q === 6 || q === 7 });
      }
      if (eh) { c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.moveTo(x - 2, y - 15); c.lineTo(x + 2, y - 15); c.lineTo(x, y - 12.6); c.closePath(); c.fill(); }
    }
    function _medidor(c, x, fill, ok) {
      var y = BANCO_Y - 34, w = 14, meta = _meta();
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - w / 2, y, w, 2.6);
      c.fillStyle = fill >= meta ? '#4ade80' : fill > 0.78 ? '#ff2d55' : '#facc15';
      c.fillRect(x - w / 2, y, w * fill, 2.6);
      c.fillStyle = '#fff'; c.fillRect(x - w / 2 + w * meta - 0.25, y - 0.8, 0.5, 4.2);
      if (ok) { c.fillStyle = '#4ade80'; c.font = '800 4px ' + M.fonte; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✔', x, y - 3.4); }
    }

    return {
      chave: 'puff', titulo: 'Puff da Coruja', mundo: [W, H], artes: ['puff'], modo: 'sobrevivencia',
      iniciar: function () {
        M.dica('Solte acima da marca antes da sirene · passou do limite, tosse', 3400);
        julgarEu = function () {
          if (M.estado !== 'jogando') return;
          if (!eu.ok) { M.som('queda'); M.morrer('SEM FÔLEGO! 💨', 'Ciclo ' + (ciclo.k + 1)); }
          else M.texto(LUGAR[M.slot], BANCO_Y - 30, 'PASSOU!', '#4ade80', 3.6);
        };
      },
      fundo: function (c) {
        M.chapa(c, 0, 0, W, 96, '#2b3038', '#1d2127');
        M.rebites(c, 0, 0, W, 96, 7);
        c.fillStyle = '#0b1622'; c.fillRect(8, 14, 32, 22); c.fillRect(50, 14, 32, 22);
        c.fillStyle = 'rgba(120,170,255,.12)'; c.fillRect(9, 15, 30, 20); c.fillRect(51, 15, 30, 20);
        c.strokeStyle = '#4b525c'; c.lineWidth = 0.8; c.strokeRect(8, 14, 32, 22); c.strokeRect(50, 14, 32, 22);
        M.chapa(c, 0, 96, W, H - 96, '#22262c', '#15181c');
        M.listras(c, 0, 96, W, 2.4, 2);
        c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(4, BANCO_Y + 1, W - 8, 4);
        M.chapa(c, 4, BANCO_Y - 2, W - 8, 4, '#7a4d12', '#5b3a0e');
        c.fillStyle = '#3a2a10'; c.fillRect(8, BANCO_Y + 2, 2.4, 10); c.fillRect(W - 10.4, BANCO_Y + 2, 2.4, 10);
      },
      atualizar: function (dt) { _passoComum(eu, dt, true); _mundo(dt); },
      atualizarFim: function (dt) { _passoComum(eu, dt, false); },
      assistir: function (dt) { _mundo(dt); },
      rede: function () { return M.slot + ';' + (eu.ok ? 1 : 0) + ';' + Math.round(_fill(eu) * 99) + ';' + _st(eu); },
      rivalCaiu: function (g) { var x = LUGAR[g.n[0] | 0] || 14.5; M.texto(x, BANCO_Y - 30, g.nome + ' caiu!', g.cor, 3.2); },
      // Robô: espera um pouco e mira um pouco acima da meta — quanto mais
      // nervoso, mais espalha (às vezes tosse, às vezes sai fraco).
      bot: function (B) {
        var o = { n: 0, segura: false, t: 0, tosse: 0, solta: 0, ok: false, espera: 0.4 + B.r() * 0.6, alvo: 0 };
        var x = LUGAR[B.slot] != null ? LUGAR[B.slot] : 14.5;
        julgarBots.push(function () {
          if (B.e) return;
          if (!o.ok) B.morrer();
          o.ok = false; o.espera = 0.25 + (1 - B.nivel) * 0.8 + B.r() * 0.4;
        });
        return {
          passo: function (dt) {
            _passoComum(o, dt, false);
            if (o.ok || o.tosse > 0 || o.solta > 0) return;
            if (!o.segura) {
              o.espera -= dt;
              if (o.espera <= 0) {
                o.segura = true; o.t = 0;
                var folga = 0.05 + B.nivel * 0.06, erro = (B.r() + B.r() - 1) * (0.2 - B.nivel * 0.13);
                o.alvo = _meta() + folga + erro;
              }
            } else if (o.t >= o.alvo * _lim(o.n)) {
              _soltar(o, x, false);
              o.espera = 0.2 + B.r() * 0.3;
            }
          },
          rede: function () { return B.slot + ';' + (o.ok ? 1 : 0) + ';' + Math.round(_fill(o) * 99) + ';' + _st(o); }
        };
      },
      desenhar: function (c) {
        // placa com a meta e o tempo do ciclo
        var rest = Math.max(0, _fimCiclo() - M.t), frac = rest / ciclo.dur;
        c.fillStyle = '#f5c518'; c.fillRect(24, 42, 42, 14);
        c.fillStyle = '#16161a'; c.font = '800 3.4px ' + M.fonte; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('META ' + Math.round(_meta() * 100) + '%', 45, 46.5);
        c.fillStyle = '#16161a'; c.fillRect(27, 50.5, 36, 2.6);
        c.fillStyle = frac < 0.3 ? '#ff2d55' : '#2563eb'; c.fillRect(27, 50.5, 36 * frac, 2.6);
        if (frac < 0.25 && Math.floor(M.t * 8) % 2) { c.fillStyle = 'rgba(255,45,85,.25)'; c.fillRect(0, 0, W, 96); }
        var rv = M.rivais();
        rv.forEach(function (g) {
          var sl = g.n[0] | 0, x = LUGAR[sl] != null ? LUGAR[sl] : 14.5, st = g.n[3] | 0, fill = (g.n[2] || 0) / 99;
          if (st === 2 && g.stAnt !== 2 && !g.bot) nuvens.push({ x: x + 4, y: BANCO_Y - 15, t: 0, tam: 4 });
          g.stAnt = st;
          if (g.e === 1) { _desenharCoruja(c, x, 8, g.vis || g.cor, 0.35, false); M.rotulo(c, x, BANCO_Y + 6.5, g.nome, g.cor); return; }
          var q = st === 3 ? (Math.floor(M.t * 6) % 2 ? 6 : 8) : st === 2 ? 5 : st === 1 ? (fill < 0.25 ? 1 : fill < 0.5 ? 2 : fill < 0.78 ? 3 : 4) : 0;
          _desenharCoruja(c, x, q, g.vis || g.cor, 0.95, false);
          _medidor(c, x, fill, (g.n[1] | 0) === 1);
          M.rotulo(c, x, BANCO_Y + 6.5, g.nome, g.cor);
        });
        var xe = LUGAR[M.slot];
        if (M.estado === 'morto') _desenharCoruja(c, xe, 8, M.visEu, 0.4, false);
        else {
          _desenharCoruja(c, xe, _quadroPuff(eu), M.visEu, 1, true);
          _medidor(c, xe, _fill(eu), eu.ok);
          if (eu.tosse > 0) M.rotulo(c, xe, BANCO_Y - 40, 'COF COF!', '#ff8fa3');
        }
        M.rotulo(c, xe, BANCO_Y + 6.5, 'VOCÊ', '#ffffff');
        nuvens.forEach(function (n) {
          var a = Math.max(0, 1 - n.t / 1.6), r = n.tam * (0.6 + n.t * 0.9);
          c.fillStyle = 'rgba(235,240,245,' + (a * 0.75) + ')';
          c.beginPath(); c.arc(n.x, n.y, r, 0, 6.283); c.arc(n.x + r * 0.7, n.y + r * 0.2, r * 0.7, 0, 6.283); c.arc(n.x - r * 0.6, n.y + r * 0.3, r * 0.6, 0, 6.283); c.fill();
        });
        // medidor grande do meu fôlego, com a marca da meta
        var f = _fill(eu), bx = 15, by = 134, bw = 60, meta = _meta();
        c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(bx - 1, by - 1, bw + 2, 8);
        c.fillStyle = f >= meta ? '#4ade80' : f > 0.78 ? '#ff2d55' : '#facc15';
        c.fillRect(bx, by, bw * f, 6);
        c.fillStyle = '#fff'; c.fillRect(bx + bw * meta - 0.4, by - 2, 0.8, 10);
        c.fillStyle = '#c9d1da'; c.font = '800 3.2px ' + M.fonte; c.textAlign = 'center';
        c.fillText(M.estado !== 'jogando' ? '' : eu.ok ? 'BOM! ESPERE A SIRENE' : eu.tosse > 0 ? 'TONTA…' : eu.segura ? (f >= meta ? 'SOLTA!' : 'SEGURA…') : 'SEGURE E SOLTE ACIMA DA MARCA', 45, by + 12);
      },
      toqueInicio: function () { if (M.estado === 'jogando' && !eu.ok && eu.tosse <= 0 && eu.solta <= 0 && !eu.segura) { eu.segura = true; eu.t = 0; M.som('passo', 0.3); } },
      toqueFim: function () { if (M.estado === 'jogando') _soltar(eu, LUGAR[M.slot], true); },
      tecla: function (k, desce) {
        if (k !== ' ') return false;
        if (desce) this.toqueInicio(); else this.toqueFim();
        return true;
      }
    };
  }

  /* ═══════════════ 9. ERVILHAS DA CORUJA (todos na mesma mesa) ═
     Mesa de jantar comprida com a Coruja-Chefe na cabeceira, lendo o
     jornal. Os jogadores sentam dos dois lados, cada um com o seu prato
     de ervilhas. ESPETAR põe uma ervilha no garfo, COMER engole o que
     estiver nele. Se a Chefe olhar e você estiver se mexendo: flagrado,
     o garfo volta pro prato e você trava um instante. A Chefe é a MESMA
     pra todo mundo (o humor dela sai da semente). Limpou o prato, venceu. */
  function _mesa(M) {
    var W = 90, H = 160, TOTAL = 20, GARFO_MAX = 5, ESPETAR = 0.23, COMER = 0.42, TRAVA = 1.0;
    // Lugares: 0 frente-esq, 1 frente-dir, 2 fundo-esq, 3 fundo-dir.
    // Mesa em perspectiva (ponta na Chefe, lá em cima): cada um senta na
    // borda, o prato fica pra dentro da toalha.
    var LUG = [
      { x: 16, y: 96, esc: 1.0, px: 31, py: 105 },
      { x: 74, y: 96, esc: 1.0, px: 59, py: 105 },
      { x: 27.5, y: 75, esc: 0.8, px: 38, py: 83 },
      { x: 62.5, y: 75, esc: 0.8, px: 52, py: 83 }
    ];
    var MESA_X = 10, MESA_W = 70, MESA_Y = 52, MESA_H = 102; // onde a mesa é desenhada
    var rChefe = M.fluxo();
    var chefe = { st: 'lendo', ate: 1.6 + rChefe() * 1.2, q: 0, pegouAte: 0 };
    var eu = { comidas: 0, garfo: 0, mov: 0, movT: 0, trava: 0, pego: 0 };
    var botoes = {};

    function _proxChefe() {
      // Fica mais desconfiada com o tempo (lê menos, olha mais).
      var sus = Math.min(1, M.t / 38);
      if (chefe.st === 'lendo') { chefe.st = 'aviso'; chefe.ate = M.t + 0.45 + rChefe() * 0.3 - sus * 0.12; chefe.q = rChefe() < 0.5 ? 2 : 3; }
      else if (chefe.st === 'aviso') {
        if (rChefe() < 0.3 - sus * 0.1) { chefe.st = 'lendo'; chefe.ate = M.t + (1.1 + rChefe() * 1.3) * (1 - sus * 0.4); chefe.q = 0; }
        else { chefe.st = 'olhando'; chefe.ate = M.t + (0.8 + rChefe() * 0.6) * (1 + sus * 0.5); chefe.q = rChefe() < 0.5 ? 4 : 5; }
      } else { chefe.st = 'lendo'; chefe.ate = M.t + (1.3 + rChefe() * 1.4) * (1 - sus * 0.45); chefe.q = rChefe() < 0.15 ? 8 : 0; }
    }
    function _mundo() {
      while (M.t >= chefe.ate) _proxChefe();
    }
    function _olhando() { return chefe.st === 'olhando'; }
    // Ações de um comensal (eu ou robô). Devolve 'pego' quando é flagrado.
    function _passoComensal(o, dt) {
      o.trava = Math.max(0, o.trava - dt);
      if (o.mov) {
        o.movT -= dt;
        if (_olhando()) return _flagra(o);
        if (o.movT <= 0) {
          if (o.mov === 1) o.garfo = Math.min(GARFO_MAX, o.garfo + 1);
          else { o.comidas += o.garfo; o.ultimaMordida = o.garfo; o.garfo = 0; }
          var era = o.mov; o.mov = 0;
          return era === 1 ? 'espetou' : 'comeu';
        }
      }
      return null;
    }
    function _flagra(o) { o.mov = 0; o.garfo = 0; o.trava = TRAVA; o.movT = 0; return 'pego'; }
    function _agir(o, qual) { // 1 espetar, 2 comer
      if (o.trava > 0 || o.mov) return false;
      if (qual === 1 && (o.garfo >= GARFO_MAX || TOTAL - o.comidas - o.garfo <= 0)) return false;
      if (qual === 2 && !o.garfo) return false;
      if (_olhando()) { _flagra(o); return 'pego'; }
      o.mov = qual; o.movT = qual === 1 ? ESPETAR : COMER;
      return true;
    }
    function _pego() {
      M.som('erro'); M.vibrar([60, 40, 80]); M.tremer(1.8); M.flash('rgba(255,60,60,.3)');
      var L = LUG[M.slot]; M.texto(L.x, L.y - 16, 'FLAGRADA!', '#ff6b6b', 4.6);
      chefe.pegouAte = M.t + 1.1;
    }
    function _apertar(qual) {
      if (M.estado !== 'jogando') return;
      var b = botoes[qual]; if (b) { b.classList.remove('mq-bt-pop'); void b.offsetWidth; b.classList.add('mq-bt-pop'); }
      var r = _agir(eu, qual);
      if (r === 'pego') _pego();
      else if (r) M.som(qual === 1 ? 'passo' : 'acerto', 0.5);
    }
    function _pratoRest(o) { return TOTAL - o.comidas - o.garfo; }
    function _desenharPrato(c, L, rest) {
      var pw = 17 * L.esc;
      if (!_quadroArte(c, 'prato', 0, 1, 1, L.px, L.py, pw)) {
        c.fillStyle = '#f4f4f2'; c.beginPath(); c.ellipse(L.px, L.py, pw / 2, pw / 2.4, 0, 0, 6.283); c.fill();
        c.strokeStyle = '#c9a24a'; c.lineWidth = 0.4; c.stroke();
      }
      var er = _arte('ervilha');
      for (var i = 0; i < rest; i++) {
        var a = i * 2.399, rr = Math.sqrt(i / TOTAL) * pw * 0.32;
        var ex = L.px + Math.cos(a) * rr, ey = L.py + Math.sin(a) * rr * 0.8, t = 2.3 * L.esc;
        if (er) c.drawImage(_recorte('ervilha', er, 0, 1, t * _pxPorUnidade), ex - t / 2, ey - t / 2, t, t);
        else { c.fillStyle = '#5fae3a'; c.beginPath(); c.arc(ex, ey, t / 2, 0, 6.283); c.fill(); }
      }
    }
    // Garfo na asa: parado do lado, espetando no prato ou levando à boca.
    function _desenharGarfo(c, L, mov, k, garfo, lado) {
      var bx = L.x + lado * 5 * L.esc, by = L.y + 3 * L.esc;
      var tx = bx, ty = by - 6 * L.esc;
      if (mov === 1) { var e = Math.sin(Math.min(1, k) * Math.PI); tx = _lerp(bx, L.px, e); ty = _lerp(by - 6 * L.esc, L.py - 1, e); }
      else if (mov === 2) { var e2 = Math.sin(Math.min(1, k) * Math.PI); tx = _lerp(bx, L.x, e2); ty = _lerp(by - 6 * L.esc, L.y - 4 * L.esc, e2); }
      c.strokeStyle = '#c9d1da'; c.lineWidth = 0.9 * L.esc; c.lineCap = 'round';
      c.beginPath(); c.moveTo(bx, by + 3 * L.esc); c.lineTo(tx, ty); c.stroke();
      for (var d = -1; d <= 1; d++) { c.beginPath(); c.moveTo(tx + d * 0.7 * L.esc, ty); c.lineTo(tx + d * 0.7 * L.esc, ty - 2.2 * L.esc); c.stroke(); }
      for (var i = 0; i < garfo; i++) { c.fillStyle = '#5fae3a'; c.beginPath(); c.arc(tx, ty - 2.4 * L.esc - i * 1.5 * L.esc, 0.9 * L.esc, 0, 6.283); c.fill(); }
    }
    // qm = quadro da coruja à mesa (arte mesaCoruja); q = reserva no sheet do Puff.
    function _desenharComensal(c, L, q, cor, alpha, rest, mov, k, garfo, nome, rotCor, eh, qm) {
      var lado = L.x < 45 ? 1 : -1;
      var w = 17 * L.esc;
      if (eh) { c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.ellipse(L.x, L.y + 7 * L.esc, w * 0.55, w * 0.2, 0, 0, 6.283); c.fill(); }
      _desenharPrato(c, L, rest);
      if (_arte('mesaCoruja')) {
        // sentada de lado, olhando pro prato; quem senta à direita é espelhada.
        // O corte da barriga (94% da célula) fica na borda da mesa.
        var wm = 22 * L.esc, ym = L.y + 7 * L.esc - 0.44 * wm;
        c.save(); c.translate(L.x + lado * 1.5 * L.esc, ym); c.scale(lado, 1);
        _quadroArte(c, 'mesaCoruja', qm, 3, 3, 0, 0, wm, cor, alpha);
        c.restore();
        if (garfo) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(L.x + lado * 6 * L.esc - 3, L.y - 13 * L.esc, 6, 3.6); c.fillStyle = '#86efac'; c.font = '800 2.8px ' + M.fonte; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(garfo + '🫛', L.x + lado * 6 * L.esc, L.y - 11.2 * L.esc); }
      } else {
        if (!_quadroArte(c, 'puff', q, 3, 3, L.x, L.y, w, cor, alpha)) {
          M.coruja(c, L.x, L.y, 5.6 * L.esc, { cor: typeof cor === 'string' ? cor : null, vis: typeof cor === 'object' ? cor : null, alpha: alpha, olhos: q === 8 ? 'x' : q === 4 ? 'medo' : null, sx: q === 2 || q === 3 ? 1.08 : 1 });
        }
        _desenharGarfo(c, L, mov, k, garfo, lado);
      }
      M.rotulo(c, L.x, L.y - 15 * L.esc, nome, rotCor);
    }
    // Quadro da coruja à mesa pelo estado (ver ARTES.mesaCoruja).
    function _qMesa(mov, trava, mastiga, garfo, venceu) {
      if (trava > 0) return trava > 0.55 ? 6 : 7;
      if (venceu) return 8;
      if (mov === 1) return 2;
      if (mov === 2) return 4;
      if (mastiga) return 5;
      if (garfo) return 3;
      return (M.t % 3.1) < 0.12 ? 1 : 0;
    }
    function _qComensal(mov, trava, mastiga) { return mov === 3 || trava > 0 ? 8 : mastiga ? 3 : mov === 2 ? 2 : (M.t % 3.1) < 0.12 ? 1 : 0; }

    return {
      chave: 'mesa', titulo: 'Ervilhas', mundo: [W, H],
      fimNoPrimeiro: function () { return 'A CHEFE RECOLHEU! 🍽️'; }, artes: ['mesaCoruja', 'chefe', 'sala', 'prato', 'ervilha', 'mesaChefe', 'mesaLonga'], tituloFim: 'TEMPO! 🍽️',
      iniciar: function () {
        M.controles.innerHTML = '<div class="mq-acoes mq-acoes-2">' +
          '<button type="button" class="mq-acao mq-acao-espetar" data-q="1">🍴 ESPETAR</button>' +
          '<button type="button" class="mq-acao mq-acao-comer" data-q="2">😋 COMER</button></div>';
        M.controles.classList.add('mq-controles-on');
        Array.prototype.forEach.call(M.controles.querySelectorAll('.mq-acao'), function (b) {
          var q = Number(b.getAttribute('data-q')); botoes[q] = b;
          b.addEventListener('pointerdown', function (e) { e.preventDefault(); _audioDestravar(); _apertar(q); });
        });
        M.dica('Espete e coma só com a Chefe lendo', 2800);
      },
      fundo: function (c) {
        var sala = _arte('sala');
        if (sala) c.drawImage(sala, 150, 80, 900, 560, 0, 0, W, 56);
        else { c.fillStyle = '#3a2618'; c.fillRect(0, 0, W, 56); }
        c.fillStyle = '#2a1a10'; c.fillRect(0, 56, W, H - 56);
        // mesa comprida em perspectiva (toalha branca), ponta na Chefe
        var art = _arte('mesaLonga');
        if (art) { c.drawImage(art, MESA_X, MESA_Y, MESA_W, MESA_H); return; }
        var yb = MESA_Y + MESA_H * 0.57, yf = MESA_Y + MESA_H * 0.8;
        c.fillStyle = '#4a2c16';
        c.beginPath(); c.moveTo(45, MESA_Y); c.lineTo(MESA_X + MESA_W, yb); c.lineTo(MESA_X + MESA_W, MESA_Y + MESA_H); c.lineTo(MESA_X, MESA_Y + MESA_H); c.lineTo(MESA_X, yb); c.closePath(); c.fill();
        var g = c.createLinearGradient(0, MESA_Y, 0, yf);
        g.addColorStop(0, '#d9d4c8'); g.addColorStop(1, '#f6f2e8');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(45, MESA_Y + 2); c.lineTo(MESA_X + MESA_W - 2, yb + 1); c.lineTo(MESA_X + MESA_W - 2, yf); c.lineTo(MESA_X + 2, yf); c.lineTo(MESA_X + 2, yb + 1); c.closePath(); c.fill();
        c.fillStyle = 'rgba(140,40,40,.25)'; c.beginPath(); c.moveTo(45, MESA_Y + 3); c.lineTo(48, 92); c.lineTo(42, 92); c.closePath(); c.fill();
      },
      atualizar: function (dt) {
        _mundo();
        var r = _passoComensal(eu, dt);
        if (r === 'pego') _pego();
        else if (r === 'comeu') {
          var L = LUG[M.slot], n = eu.ultimaMordida;
          M.pontos(100 * n); M.texto(L.x, L.y - 14, '+' + (100 * n), '#ffd166', 3.6 + n * 0.3); M.som('mastigar', 0.7);
          eu.mastiga = 0.35;
          if (eu.comidas >= TOTAL) {
            var bonus = Math.round(Math.max(0, 40 - M.t) * 25);
            M.pontos(bonus);
            M.vencer('PRATO LIMPO! 🍽️', bonus ? '+' + bonus + ' de bônus' : null);
          }
        }
        eu.mastiga = Math.max(0, (eu.mastiga || 0) - dt);
        if (botoes[1]) {
          botoes[1].disabled = eu.garfo >= GARFO_MAX || _pratoRest(eu) <= 0;
          botoes[2].disabled = !eu.garfo;
        }
      },
      assistir: function () { _mundo(); },
      rede: function () { return M.slot + ';' + eu.comidas + ';' + eu.garfo + ';' + (eu.trava > 0 ? 3 : eu.mov); },
      // Robô: só se mexe com a Chefe lendo; o cuidadoso para no aviso, o
      // afoito continua — e é pego se ela virar com o garfo no ar.
      bot: function (B) {
        var o = { comidas: 0, garfo: 0, mov: 0, movT: 0, trava: 0, pensa: 0.5, alvo: 2, lendoDesde: 0, stAnt: '' };
        var ousado = 1 - B.nivel, vel = 0.22 + (1 - B.nivel) * 0.3, reage = 0.25 + (1 - B.nivel) * 0.45;
        return {
          passo: function (dt) {
            var r = _passoComensal(o, dt);
            if (r === 'comeu') { B.pontos(100 * o.ultimaMordida); if (o.comidas >= TOTAL) { B.pontos(Math.round(Math.max(0, 40 - M.t) * 25)); B.vencer(); return; } }
            if (r === 'pego') { chefe.pegouAte = Math.max(chefe.pegouAte, M.t + 0.8); o.alvo = 1 + Math.floor(B.r() * 2); }
            if (chefe.st !== o.stAnt) { o.stAnt = chefe.st; if (chefe.st === 'lendo') o.lendoDesde = M.t; }
            o.pensa -= dt;
            if (o.pensa > 0 || o.mov || o.trava > 0) return;
            o.pensa = vel * (0.6 + B.r() * 0.8);
            // demora um pouco pra perceber que ela voltou a ler
            var pode = (chefe.st === 'lendo' && M.t - o.lendoDesde > reage) || (chefe.st === 'aviso' && B.r() < ousado * 0.5) || (chefe.st === 'olhando' && B.r() < ousado * 0.03);
            if (!pode) return;
            if (o.garfo >= o.alvo || (o.garfo && _pratoRest(o) <= 0)) { _agir(o, 2); o.alvo = 2 + Math.floor(B.r() * (2 + ousado * 3)); }
            else if (_pratoRest(o) > 0) _agir(o, 1);
          },
          rede: function () { return B.slot + ';' + o.comidas + ';' + o.garfo + ';' + (o.trava > 0 ? 3 : o.mov); }
        };
      },
      desenhar: function (c) {
        // Chefe na cabeceira
        var q = chefe.q;
        if (M.t < chefe.pegouAte) q = 6;
        else if (M.estado !== 'jogando' && !M.assistindo) q = 7;
        else if (chefe.st === 'lendo' && q === 0 && Math.floor(M.t * 0.7) % 5 === 4) q = 1;
        if (!_quadroArte(c, 'chefe', q, 3, 3, 45, 41, 40)) {
          M.coruja(c, 45, 42, 9, { olhos: chefe.st === 'olhando' ? null : 'x', semSombra: true });
          if (chefe.st !== 'olhando') { c.fillStyle = '#e5e1d6'; c.fillRect(33, 38, 24, 14); }
        }
        var mc = _arte('mesaChefe');
        if (mc) c.drawImage(mc, 27, 51, 36, 7.3);
        if (chefe.st === 'olhando' || M.t < chefe.pegouAte) {
          c.fillStyle = 'rgba(255,45,85,' + (0.18 + 0.12 * Math.sin(M.t * 16)) + ')';
          c.beginPath(); c.moveTo(45, 44); c.lineTo(-4, 152); c.lineTo(94, 152); c.closePath(); c.fill();
          M.rotulo(c, 45, 18, '👀 OLHANDO!', '#ff8fa3');
        } else if (chefe.st === 'aviso') M.rotulo(c, 45, 18, '⚠️', '#facc15');
        // os outros na mesa (fundo primeiro)
        var rv = M.rivais();
        var meu = LUG[M.slot];
        var todos = rv.map(function (g) { return { g: g, L: LUG[g.n[0] | 0] || LUG[0] }; });
        todos.push({ eu: true, L: meu });
        todos.sort(function (a, b) { return a.L.y - b.L.y; });
        todos.forEach(function (t) {
          if (t.eu) {
            var k = eu.mov === 1 ? 1 - eu.movT / ESPETAR : eu.mov === 2 ? 1 - eu.movT / COMER : 0;
            _desenharComensal(c, meu, _qComensal(eu.mov, eu.trava, eu.mastiga > 0), M.visEu, 1, _pratoRest(eu), eu.mov, k, eu.garfo, 'VOCÊ', '#ffffff', true, _qMesa(eu.mov, eu.trava, eu.mastiga > 0, eu.garfo, M.estado === 'venceu' && !M.encerrado));
            return;
          }
          var g = t.g, mov = g.n[3] | 0, comidas = g.n[1] | 0, garfo = g.n[2] | 0;
          if (mov === 3 && g.movAnt !== 3) { M.texto(t.L.x, t.L.y - 14 * t.L.esc, 'FLAGRADA!', g.cor, 3.4); chefe.pegouAte = Math.max(chefe.pegouAte, M.t + 0.8); }
          if (mov !== g.movAnt) { g.movIni = M.t; g.movAnt = mov; }
          var kk = mov === 1 ? (M.t - g.movIni) / ESPETAR : mov === 2 ? (M.t - g.movIni) / COMER : 0;
          if (mov === 3 && g.movAnt3 == null) g.movAnt3 = M.t; else if (mov !== 3) g.movAnt3 = null;
          var travaG = mov === 3 ? Math.max(0.01, 1 - (M.t - (g.movAnt3 || M.t))) : 0;
          _desenharComensal(c, t.L, _qComensal(mov, 0, false), g.vis || g.cor, 0.95, Math.max(0, TOTAL - comidas - garfo), mov, kk, garfo, g.nome + ' ' + comidas, g.cor, false, _qMesa(mov === 3 ? 0 : mov, travaG, false, garfo, g.e === 2 && comidas >= TOTAL));
        });
        // contador grande
        c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(31, 150, 28, 8);
        c.fillStyle = '#e8ecf1'; c.font = '800 3.6px ' + M.fonte; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(_pratoRest(eu) + ' no prato · garfo ' + eu.garfo + '/' + GARFO_MAX, 45, 154);
      },
      tecla: function (k, desce) {
        if (!desce) return k === 'e' || k === 'c';
        if (k === 'e' || k === 'ArrowLeft') { _apertar(1); return true; }
        if (k === 'c' || k === 'ArrowRight') { _apertar(2); return true; }
        return false;
      }
    };
  }

  var JOGOS = { laminas: _laminas, escada: _escada, piso: _piso, esteira: _esteira,
    empurra: _empurra, minado: _minado, tunel: _tunel, puff: _puff, mesa: _mesa };

  function render(container, opts) {
    if (!container) return;
    opts = opts || {};
    parar();
    var fab = JOGOS[opts.jogo];
    if (!fab) { if (typeof opts.onFim === 'function') opts.onFim(0); return; }
    var destruir = _criarMotor(container, opts, fab);
    _pararAtual = destruir;
  }
  function parar() {
    if (_pararAtual) { var f = _pararAtual; _pararAtual = null; try { f(); } catch (e) {} }
  }

  /* ── Coruja fora dos minigames (lobby, "Monte sua coruja", pódio) ── */
  var ARTES_VISUAL = ['coruja'];
  // Chama cb quando a arte da coruja e dos acessórios chegou (ou falhou).
  function carregarVisual(cb) {
    var feito = false, t0 = Date.now();
    function pronto() { return ARTES_VISUAL.every(function (k) { return !ARTES[k] || _arte(k) || (_imgs[k] && _imgs[k].erro); }); }
    (function checa() {
      if (feito) return;
      if (pronto() || Date.now() - t0 > 8000) { feito = true; if (cb) cb(); return; }
      setTimeout(checa, 90);
    })();
  }
  // Desenha a coruja com o visual dado num canvas (pose = quadro do sheet:
  // 0 parada, 1 piscando, 2 asas abertas, 5 comemorando…).
  function desenharCoruja(canvas, visual, o) {
    if (!canvas) return;
    o = o || {};
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, antes = _pxPorUnidade;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!o.manter) ctx.clearRect(0, 0, w, h);
    _pxPorUnidade = 1;
    var r = Math.min(w, h) * (o.escala || 0.92) / 3.1;
    _coruja(ctx, o.x != null ? o.x : w / 2, o.y != null ? o.y : h / 2, r, {
      vis: _visParse(visual), semSombra: o.semSombra !== false ? true : false,
      pisca: o.pose === 1, vitoria: o.pose === 5, asa: o.pose === 2 ? 1 : 0, olhos: o.pose === 3 ? 'medo' : null, costas: o.pose === 6
    });
    _pxPorUnidade = antes;
  }
  var _avatares = {};
  // Retrato pronto (dataURL) pras listas da Party; null enquanto a arte carrega.
  function avatar(visual, px) {
    px = px || 96;
    var k = String(visual || '') + '@' + px;
    if (_avatares[k]) return _avatares[k];
    if (!_arte('coruja')) return null;
    var vv = _visParse(visual);
    if (vv.skin && _folhaDaSkin('coruja', vv) === 'coruja' && SKINS[vv.skin] && SKINS[vv.skin].indexOf('coruja') >= 0) return null; // skin ainda carregando
    var c = document.createElement('canvas'); c.width = c.height = px;
    desenharCoruja(c, visual, { escala: 1.05, y: px * 0.56 });
    try { _avatares[k] = c.toDataURL('image/png'); } catch (e) { return null; }
    return _avatares[k];
  }

  window.MaquinaGame = {
    render: render, parar: parar, jogos: function () { return Object.keys(JOGOS); },
    carregarVisual: carregarVisual, desenharCoruja: desenharCoruja, avatar: avatar,
    // listas pra montar a tela "Monte sua coruja"
    visual: { cores: Object.keys(CORES_PENA), skins: _skinsProntas }
  };
})();
