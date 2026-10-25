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
   opts: { jogo, duracaoSeg, seed, onFim(score), onMoedas(qtd) }

   SEMENTE: tudo que decide a dificuldade (onde nasce cada serra, as
   setas, os símbolos do piso, a ordem da esteira) sai de geradores
   presos à semente da rodada — todo mundo da sala recebe a MESMA
   armadilha. Cada sistema tem o próprio gerador (_fluxo) pra que o
   que o jogador faz nunca mude a sequência do outro. Enfeite visual
   (partículas, faíscas) usa Math.random, não importa.

   PONTUAÇÃO: score final ≤ 19999 (a regra de resultados/ no RTDB
   corta em 20000). Moedas coletadas na rodada vão pra carteira no
   fim (motivo 'party', sem teto — ver TETO_MOTIVOS_SEM_TETO no hub).

   ARTE: tudo é desenhado no código. Quando a arte do Gemini subir em
   /Jogos/assets/maquina/ com o nome de ARTES, ela "acende" sozinha
   no lugar do desenho (ver _arte). Sons: /Jogos/assets/maquina/sfx/
   <nome>-N.mp3 listados em SFX_ARQ; sem arquivo, toca o sintetizado.
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
    // Sheet 3×3 da Corujinha (Master Reference): 0 parada · 1 piscando ·
    // 2 feliz de asas abertas · 3 asas abertas · 4 asas no rosto (tonta) ·
    // 5 assustada · 6 comemorando · 7 asas meio abertas · 8 joinha.
    coruja: '/Jogos/assets/corujinha/coruja-sheet-v2.webp',
    moeda: '/Jogos/assets/corujinha/sim-moeda-v2.webp'
  };
  // Sons gravados disponíveis: nome -> quantas versões (nome-1.mp3 ...).
  var SFX_ARQ = {};

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
    vitoria: function (t) { [523, 659, 784, 1047].forEach(function (f, i) { _tom(t + i * 0.09, 'triangle', f, f, 0.18, 0.18); }); }
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
      reg = _imgs[chave] = { img: new Image(), ok: false };
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
  function _recorte(chave, img, q, cols, px) {
    px = Math.max(8, Math.ceil(px / 8) * 8);
    var k = chave + '|' + q + '|' + px;
    var c = _recortes[k];
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = px;
    var fw = img.width / cols, fh = img.height / cols;
    var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(img, (q % cols) * fw, Math.floor(q / cols) * fh, fw, fh, 0, 0, px, px);
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

  /* ── Desenhos de base (coruja, metal, listras) ───────────────── */
  // Coruja chibi desenhada (cinza-azulada, barriga creme, olhos âmbar,
  // linhas de neon vermelho nas asas — mesma cara da Master Reference).
  // Em unidades do mundo: (x, y) = centro do corpo, r = raio do corpo.
  function _coruja(ctx, x, y, r, o) {
    o = o || {};
    var sheet = o.desenhada ? null : _arte('coruja');
    if (sheet) {
      var q = o.olhos === 'x' ? 4 : o.olhos === 'medo' ? 5 : o.vitoria ? 6 : o.pisca ? 1 : (o.asa || 0) > 0.55 ? 3 : (o.asa || 0) > 0.2 ? 7 : 0;
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
      var t = r * S;
      ctx.drawImage(_recorte('coruja', sheet, q, 3, t * _pxPorUnidade), -t / 2, -t / 2, t, t);
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
      leve: false, fonte: fonte
    };
    var _fluxos = 0;
    M.fluxo = function () { _fluxos++; return _gerador((seed ^ Math.imul(_fluxos, 0x85ebca6b)) >>> 0); };

    var jogo = fabrica(M);
    M.W = jogo.mundo[0]; M.H = jogo.mundo[1];
    if (opts.teste) window.__mq = { M: M, jogo: jogo }; // só o harness do Playwright passa isto
    root.classList.add('mq-' + jogo.chave);
    root.querySelector('.mq-hud-titulo').textContent = jogo.titulo;

    var raf = 0, ultimo = 0, vivo = true, fimEm = 0, reportou = false;
    var dpr = 1, Wpx = 0, Hpx = 0;
    var tremor = 0, flashCor = null, flashT = 0;
    var parts = [], textos = [];
    var fpsAcum = 0, fpsN = 0, fpsDecidido = false;
    var timers = [];

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
    M.pontos = function (n) { M.pts = Math.max(0, Math.round(M.pts + n)); elPts.textContent = M.pts; };
    M.moeda = function (x, y) {
      M.moedas++; elMoedas.textContent = M.moedas;
      elMoedasWrap.classList.remove('mq-moedas-pop'); void elMoedasWrap.offsetWidth; elMoedasWrap.classList.add('mq-moedas-pop');
      _som('moeda', 0.8);
      M.particulas(x, y, 8, '#ffd23f', 'faisca');
      M.texto(x, y - 4, '+1 🪙', '#ffd23f');
    };
    M.som = _som;
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
    M.coruja = _coruja; M.listras = _listras; M.chapa = _chapa; M.rebites = _rebites; M.engrenagem = _engrenagem;
    M.arte = _arte; M.desenharMoeda = _moedaDesenhar;
    _arte('coruja'); _arte('moeda'); // já começa a carregar

    // Morreu: a armadilha pegou. score = o que fez até aqui.
    M.morrer = function (titulo, sub) {
      if (M.estado !== 'jogando') return;
      M.estado = 'morto';
      M.tremer(3); M.flash('rgba(255,40,60,.55)'); M.vibrar([60, 40, 120]);
      _som('morte');
      _mostrarFim(titulo || 'VOCÊ CAIU!', sub, 'morte');
    };
    function _terminouTempo() {
      if (M.estado !== 'jogando') return;
      M.estado = 'venceu';
      if (typeof jogo.sobreviveu === 'function') jogo.sobreviveu();
      _som('vitoria');
      M.vibrar(40);
      _mostrarFim('SOBREVIVEU!', null, 'vitoria');
    }
    function _mostrarFim(titulo, sub, tipo) {
      fimEm = performance.now();
      elFim.className = 'mq-fim mq-fim-on mq-fim-' + tipo;
      elFim.querySelector('.mq-fim-tit').textContent = titulo;
      elFim.querySelector('.mq-fim-sub').textContent = (sub ? sub + ' · ' : '') + M.pts + ' pontos' + (M.moedas ? ' · +' + M.moedas + ' 🪙' : '');
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
      onFim(Math.min(SCORE_TETO, Math.max(0, Math.round(M.pts))));
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
      if (M.estado === 'jogando') {
        M.t += dt;
        jogo.atualizar(dt);
        if (M.estado === 'jogando' && M.t >= duracao) _terminouTempo();
        var rest = Math.max(0, duracao - M.t);
        elTempo.textContent = Math.ceil(rest);
        elBarra.style.transform = 'scaleX(' + (rest / duracao).toFixed(4) + ')';
        root.classList.toggle('mq-final', rest < 5);
      } else if (typeof jogo.atualizarFim === 'function') {
        jogo.atualizarFim(dt);
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
    elTempo.textContent = Math.ceil(duracao);
    elPts.textContent = '0';
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
    var serraSprite = {};

    function _spriteSerra(r) {
      var k = r.toFixed(1) + '|' + M.s;
      if (serraSprite[k]) return serraSprite[k];
      var px = Math.ceil(r * 2.4 * M.s * 1.5), c = document.createElement('canvas');
      c.width = c.height = px;
      var g = c.getContext('2d'), sc = px / (r * 2.4);
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

    return {
      chave: 'laminas', titulo: 'Lâminas', mundo: [W, H],
      iniciar: function () { M.dica('Arraste pra fugir das serras', 2600); },
      fundo: function (c) {
        c.fillStyle = '#1b1e23'; c.fillRect(0, 0, W, H);
        // chapas do piso
        for (var y = P; y < H - P; y += 16) for (var x = P; x < W - P; x += 20.25) {
          M.chapa(c, x, y, 20.25, 16, '#2c3138', '#23272d');
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
      atualizar: function (dt) {
        // spawn de serras (tempo fixo pela semente → igual pra todos)
        proxSerra -= dt;
        if (proxSerra <= 0 && serras.length + alertas.length < 7) {
          var duto = Math.floor(rSpawn() * 3);
          alertas.push({ duto: duto, t: 1.0 });
          M.som('alerta', 0.6);
          proxSerra = Math.max(2.0, 4.6 - nSerras * 0.35) + rSpawn() * 0.8;
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
        // movimento: teclado (PC) soma com o arrasto
        var kx = (teclas.ArrowRight ? 1 : 0) - (teclas.ArrowLeft ? 1 : 0);
        var ky = (teclas.ArrowDown ? 1 : 0) - (teclas.ArrowUp ? 1 : 0);
        if (kx || ky) { coruja.x += kx * 70 * dt; coruja.y += ky * 70 * dt; }
        coruja.x = _clamp(coruja.x, P + coruja.r, W - P - coruja.r);
        coruja.y = _clamp(coruja.y, P + coruja.r + 2, H - P - coruja.r);
        coruja.asa = Math.max(0, coruja.asa - dt * 3);
        // serras
        for (var i = 0; i < serras.length; i++) {
          var s = serras[i];
          s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 18; s.nova = Math.max(0, s.nova - dt);
          if (s.x < P + s.r) { s.x = P + s.r; s.vx = Math.abs(s.vx); M.som('clank', 0.25); }
          if (s.x > W - P - s.r) { s.x = W - P - s.r; s.vx = -Math.abs(s.vx); M.som('clank', 0.25); }
          if (s.y < P + s.r && s.nova <= 0) { s.y = P + s.r; s.vy = Math.abs(s.vy); M.som('clank', 0.25); }
          if (s.y > H - P - s.r) { s.y = H - P - s.r; s.vy = -Math.abs(s.vy); M.som('clank', 0.25); }
          var d = _dist(s.x, s.y, coruja.x, coruja.y);
          if (d < s.r * 0.95 + coruja.r * 0.72) {
            M.penas(coruja.x, coruja.y);
            M.morrer('FATIADA! 🪚', 'Durou ' + M.t.toFixed(1).replace('.', ',') + ' s');
            return;
          }
          s.raspou = Math.max(0, s.raspou - dt);
          if (d < s.r + coruja.r + 4 && !s.raspou) {
            s.raspou = 1.2; M.pontos(40); M.texto(coruja.x, coruja.y - 7, 'raspão! +40', '#ff8fa3', 4);
            M.som('raspao', 0.7); M.vibrar(15);
            M.particulas((s.x + coruja.x) / 2, (s.y + coruja.y) / 2, 6, '#ffe08a', 'faisca');
          }
        }
        for (var m = moedas.length - 1; m >= 0; m--) {
          moedas[m].v += dt;
          if (moedas[m].v > 6.5) { moedas.splice(m, 1); continue; }
          if (_dist(moedas[m].x, moedas[m].y, coruja.x, coruja.y) < coruja.r + 3.5) {
            M.moeda(moedas[m].x, moedas[m].y); M.pontos(150); moedas.splice(m, 1);
          }
        }
        // tempo vivo (100 pontos por segundo, creditados de 10 em 10)
        acumVivo += dt * 100;
        if (acumVivo >= 10) { var q = Math.floor(acumVivo / 10) * 10; acumVivo -= q; M.pontos(q); }
      },
      sobreviveu: function () { M.pontos(2500); M.texto(coruja.x, coruja.y - 8, '+2500', '#4ade80', 6); },
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
        // coruja (abaixo das serras)
        if (M.estado !== 'morto') {
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
      chave: 'escada', titulo: 'Escada Errada', mundo: [W, H], alinharBaixo: true,
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
      sobreviveu: function () { M.pontos(2000); M.texto(45, 60, '+2000', '#4ade80', 6); },
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

        // coruja de costas subindo
        if (M.estado !== 'morto') {
          var cy = baseY - 5.2 - pulo * 2.6;
          M.coruja(c, XC, cy, 4.6, {
            asa: tonta > 0 ? 0.9 * Math.abs(Math.sin(M.t * 20)) : pulo,
            rot: tonta > 0 ? Math.sin(M.t * 30) * 0.25 : 0,
            olhos: p < 2 ? 'medo' : (tonta > 0 ? 'x' : null), olharY: -1
          });
          if (tonta > 0) { c.fillStyle = '#ffe08a'; c.font = '800 4px ' + M.fonte; c.textAlign = 'center'; c.fillText('★ ★', XC, cy - 8); }
        } else {
          c.fillStyle = '#7189a6'; c.beginPath(); c.ellipse(XC, Y_PRENSA - 0.6, 7, 1.2, 0, 0, 6.283); c.fill();
        }

        // prensa: mandíbula de aço com dentes + pistões
        var perigo = Math.max(0, 1 - p / 2.2);
        var bate = M.estado === 'morto' ? 0 : Math.abs(Math.sin(prensaAbre)) * 3;
        var topo = Y_PRENSA - bate;
        c.fillStyle = 'rgba(255,40,60,' + (0.12 + perigo * 0.35) + ')';
        c.fillRect(16, topo - 14, W - 32, 14);
        M.chapa(c, 10, topo, W - 20, H - topo, '#4a515b', '#262a30');
        c.fillStyle = '#9aa3ad';
        for (var d = 12; d < W - 12; d += 5) { c.beginPath(); c.moveTo(d, topo); c.lineTo(d + 2.5, topo - 3.6); c.lineTo(d + 5, topo); c.closePath(); c.fill(); }
        M.listras(c, 10, topo + 3, W - 20, 3.4, 2.6);
        c.fillStyle = '#2f343b'; c.fillRect(20, topo + 8, 8, H); c.fillRect(W - 28, topo + 8, 8, H);
        c.fillStyle = '#c4ccd5'; c.fillRect(22.5, topo + 6, 3, H); c.fillRect(W - 25.5, topo + 6, 3, H);
        c.fillStyle = perigo > 0.3 && Math.floor(M.t * 8) % 2 ? '#ff2d55' : '#5a1220';
        c.beginPath(); c.arc(45, topo + 12, 2.2, 0, 6.283); c.fill();
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
        var remover = Math.min(2 + Math.floor(rodada / 4), 4);
        for (var k = 0; k < remover; k++) {
          var vivos = pisos.filter(function (p) { return p.vivo; });
          if (vivos.length <= 7) break;
          vivos[Math.floor(rRod() * vivos.length)].vivo = false;
        }
      }
      var vivos2 = pisos.filter(function (p) { return p.vivo; });
      alvo = Math.floor(rRod() * SIMB.length);
      vivos2.forEach(function (p) { p.simb = Math.floor(rRod() * SIMB.length); p.cai = 0; p.moeda = rRod() < 0.07; });
      // garante 2-4 pisos com o símbolo certo, espalhados
      var certos = vivos2.filter(function (p) { return p.simb === alvo; });
      var minimo = 2 + (rRod() < 0.5 ? 1 : 0);
      while (certos.length < minimo) {
        var q = vivos2[Math.floor(rRod() * vivos2.length)];
        if (q.simb !== alvo) { q.simb = alvo; certos.push(q); }
      }
      while (certos.length > 4) { var r = certos.pop(); r.simb = (alvo + 1 + Math.floor(rRod() * 4)) % SIMB.length; }
      fase = 'escolha'; faseT = 0;
      faseDur = Math.max(1.8, 3.7 - (rodada - 1) * 0.2);
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
      chave: 'piso', titulo: 'Piso Falso', mundo: [W, H],
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
          var gg = c.createLinearGradient(0, -T / 2, 0, T / 2);
          gg.addColorStop(0, '#59616c'); gg.addColorStop(1, '#353b43');
          c.fillStyle = gg; c.fillRect(-T / 2, -T / 2, T, T - 0.6);
          c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 0.4; c.strokeRect(-T / 2 + 0.6, -T / 2 + 0.6, T - 1.2, T - 1.8);
          _desenharSimbolo(c, 0, -0.4, 3.6, p.simb);
          if (p.moeda) M.desenharMoeda(c, 4.4, -4.4, 2.4);
          c.restore();
        });
        c.globalAlpha = 1;
        // coruja
        if (cor.caindo) {
          var k = cor.caindo;
          M.coruja(c, cor.x, cor.y + k * 10, 4.4 * (1 - k * 0.85), { rot: k * 6, olhos: 'medo', semSombra: true, asa: Math.abs(Math.sin(M.t * 25)), alpha: 1 - k * 0.6 });
        } else {
          M.coruja(c, cor.x, cor.y, 4.4, { asa: cor.de ? 0.8 : 0, olhos: (fase === 'escolha' && rest < 0.3) ? 'medo' : null, pisca: (M.t % 3.2) < 0.12 });
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

    function _vel() { return Math.min(52, 20 + M.t * 0.95); }
    function _intervalo() { return Math.max(0.5, 1.2 - M.t * 0.019); }
    function _errou(x, y, txt) {
      erros++;
      M.som('erro'); M.vibrar(60); M.tremer(1.6); M.flash('rgba(255,60,60,.28)');
      M.texto(x, y, txt, '#ff6b6b', 4.6);
      if (erros >= MAX_ERROS) M.depois(250, function () { M.morrer('A MÁQUINA TRAVOU! 🔥', 'Três erros'); });
    }
    function _desenharItem(c, it, x, y, esc) {
      c.save(); c.translate(x, y); c.scale(esc, esc); c.rotate(it.rot || 0);
      if (it.t === 'quadro') {
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
      chave: 'esteira', titulo: 'A Esteira', mundo: [W, H],
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

  var JOGOS = { laminas: _laminas, escada: _escada, piso: _piso, esteira: _esteira };

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

  window.MaquinaGame = { render: render, parar: parar, jogos: function () { return Object.keys(JOGOS); } };
})();
