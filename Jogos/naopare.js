/* ═══════════════════════════════════════════════════════════════
   NÃO PARE — terror ao volante, 3D (Three.js)
   Lazy-loaded pelo hub a partir de /Jogos/naopare.min.js (ver
   JOGOS_EXTERNOS em Jogos/hub.js). Expõe window.NaoPareGame =
   { preparar, parar }.
   ------------------------------------------------------------
   - Doc do projeto: claude/nao-pare-mecanicas.md (mecânicas e plano).
   - Regra: a Mula sem cabeça corre atrás do carro. Ela não é um
     inimigo com física: é uma DISTÂNCIA (gap, em metros) que encolhe
     quando você anda mais devagar que ela, bate ou roda. Gap ≤ 3 m:
     ela te alcança.
   - Three.js vem de /Jogos/vendor/three-naopare.min.js (só as classes
     usadas, ver ferramentas/naopare/three-entrada.mjs), carregado sob
     demanda por este arquivo e exposto em window.NPTHREE.
   - Tudo fica dentro de #naopare-root: um "palco" 16:9. Celular em pé:
     o palco gira 90° por CSS (mesma ideia do Sinal Branco). Os botões de
     toque são DOM, então o navegador cuida do toque girado.
   - A imagem sai por um passe final próprio (grão, vinheta, aberração,
     tom vermelho do perigo) e o retrovisor é desenhado nesse passe.
   - Som 100% sintetizado (Web Audio), respeitando o mudo do hub.
   - Recorde por rota no localStorage (angatuba_naopare). Sem backend.
   - Fase 1 (protótipo): 1 rota, direção com drift, Mula, placas de km
     com retry, derrota/vitória. Eventos de cabine vêm na fase 2.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TELA = 'jogo-naopare';
  var THREE_URL = '/Jogos/vendor/three-naopare.min.js?v=187b';
  var SAVE = 'angatuba_naopare';
  var T = null;            // namespace do Three (window.NPTHREE)

  /* ══════════════════════════════════════════════════════════════
     ROTAS — dados. A geometria é gerada por semente (sempre igual).
  ══════════════════════════════════════════════════════════════ */
  var ROTAS = [
    { id: 'estrada-velha', nome: 'Estrada Velha', dif: 'Fácil', km: 6, semente: 1610,
      // Medalhas pelo tempo total (segundos)
      ouro: 198, prata: 212, bronze: 235,
      // Mula: velocidade base (m/s) do começo e do fim da rota
      mulaIni: 19.5, mulaFim: 23.2 }
  ];

  var DS = 2;              // metros entre amostras da estrada
  var MEIA = 4.6;          // meia largura da pista de terra
  var BARREIRA = 7.6;      // além disto: cerca/árvore = batida
  var GAP_INI = 70, GAP_RETRY = 52, GAP_MAX = 82, GAP_PEGA = 3;

  /* ── utilidades ─────────────────────────────────────────────── */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function suave(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmtTempo(s) {
    if (!(s >= 0)) s = 0;
    s = Math.floor(s * 10) / 10;
    var m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }
  function fmtKm(m) { return (m / 1000).toFixed(1).replace('.', ','); }
  // Relevo suave do mundo (morros longos; a estrada acompanha)
  function relevo(x, z) {
    return 3.4 * Math.sin(x * 0.0105 + 0.7) * Math.cos(z * 0.0088) +
      2.1 * Math.sin((x + z) * 0.0161) + 1.1 * Math.sin(z * 0.029 - x * 0.0074);
  }

  /* ══════════════════════════════════════════════════════════════
     GERAÇÃO DA ESTRADA
     Curvatura com sinal: c > 0 = curva para a DIREITA. Direção de
     avanço f = (sin θ, cos θ); direita r = (-cos θ, sin θ); θ -= c·ds.
  ══════════════════════════════════════════════════════════════ */
  var SEV_RAIO = { 1: [150, 115], 2: [72, 56], 3: [34, 27] };
  var SEV_ANG = { 1: [0.35, 0.85], 2: [0.6, 1.3], 3: [1.0, 1.85] };

  function gerarRota(def) {
    for (var tent = 0; tent < 40; tent++) {
      var r = montarRota(def, def.semente + tent * 7919);
      if (r) return r;
    }
    return montarRota(def, def.semente); // não deve acontecer
  }

  function montarRota(def, semente) {
    var rnd = rng(semente);
    var L = def.km * 1000 + 120;      // + trecho da capela
    var n = Math.ceil(L / DS) + 1;
    var kT = new Float32Array(n);
    var curvas = [];
    var s = 150, theta = 0, ultDir = 0, repet = 0;
    function marcarCurva(s0, len, sev, dir) {
      var R = lerp(SEV_RAIO[sev][0], SEV_RAIO[sev][1], rnd());
      var i0 = Math.round(s0 / DS), i1 = Math.round((s0 + len) / DS);
      for (var i = i0; i < i1 && i < n; i++) kT[i] = dir / R;
      curvas.push({ s0: s0, s1: s0 + len, sev: sev, dir: dir });
      theta -= dir * len / R;
    }
    while (s < L - 330) {
      var p = s / L;
      if (rnd() < 0.34) { s += lerp(70, 210, rnd()) * (1 - p * 0.35); continue; }
      var w = p < 0.18 ? [0.7, 0.28, 0.02] : p < 0.5 ? [0.38, 0.4, 0.22] : [0.22, 0.4, 0.38];
      var q = rnd(), sev = q < w[0] ? 1 : q < w[0] + w[1] ? 2 : 3;
      var dir = rnd() < 0.5 ? 1 : -1;
      if (Math.abs(theta) > 1.1) dir = theta > 0 ? 1 : -1;   // volta para o rumo
      if (dir === ultDir) { repet++; if (repet >= 2) { dir = -dir; repet = 0; } } else repet = 0;
      ultDir = dir;
      var ang = lerp(SEV_ANG[sev][0], SEV_ANG[sev][1], rnd());
      var R0 = lerp(SEV_RAIO[sev][0], SEV_RAIO[sev][1], 0.5);
      var len = ang * R0;
      marcarCurva(s, len, sev, dir);
      s += len;
      // às vezes um "S" logo em seguida
      if (sev >= 2 && rnd() < 0.3 && s < L - 400) {
        var sev2 = rnd() < 0.5 ? 2 : sev;
        var len2 = lerp(SEV_ANG[sev2][0], SEV_ANG[sev2][1], rnd()) * lerp(SEV_RAIO[sev2][0], SEV_RAIO[sev2][1], 0.5);
        s += 6;
        marcarCurva(s, len2, sev2, -dir);
        ultDir = -dir;
        s += len2;
      }
      s += lerp(25, 60, rnd());
    }
    // Suaviza a entrada/saída das curvas (sem degrau de curvatura)
    var k = suavizar(suavizar(kT, 6), 6);
    // Integra a linha central
    var x = new Float32Array(n), z = new Float32Array(n), th = new Float32Array(n);
    var t0 = 0, cx = 0, cz = 0;
    for (var i = 0; i < n; i++) {
      x[i] = cx; z[i] = cz; th[i] = t0;
      t0 -= k[i] * DS;
      cx += Math.sin(t0) * DS; cz += Math.cos(t0) * DS;
    }
    // A estrada não pode passar perto dela mesma
    var hash = montarHash(x, z, n);
    for (i = 0; i < n; i += 3) {
      var viz = vizinhos(hash, x[i], z[i]);
      for (var j = 0; j < viz.length; j++) {
        var m = viz[j];
        if (Math.abs(m - i) * DS < 140) continue;
        var dx = x[m] - x[i], dz = z[m] - z[i];
        if (dx * dx + dz * dz < 30 * 30) return null;
      }
    }
    // Altura: relevo do mundo, alisado ao longo da estrada
    var y0 = new Float32Array(n);
    for (i = 0; i < n; i++) y0[i] = relevo(x[i], z[i]);
    var y = suavizar(suavizar(y0, 10), 10);
    // Obstáculos (troncos/pedras) em retas depois do km 1
    var obst = [];
    var so = 1000 + rnd() * 300;
    while (so < L - 400) {
      if (!emCurva(curvas, so, 40)) {
        var lado = rnd() < 0.5 ? -1 : 1;
        obst.push({ s: so, lat0: lado < 0 ? -MEIA : 0.2, lat1: lado < 0 ? -0.2 : MEIA, tipo: rnd() < 0.55 ? 'tronco' : 'pedras', lado: lado });
        so += lerp(420, 780, rnd());
      } else so += 60;
    }
    return { def: def, L: L, fim: def.km * 1000, n: n, x: x, z: z, y: y, th: th, k: k, curvas: curvas, obst: obst, hash: hash };
  }

  function suavizar(a, raio) {
    var n = a.length, out = new Float32Array(n), soma = 0, cnt = 0, i;
    for (i = 0; i < Math.min(raio, n); i++) { soma += a[i]; cnt++; }
    for (i = 0; i < n; i++) {
      var ent = i + raio, sai = i - raio - 1;
      if (ent < n) { soma += a[ent]; cnt++; }
      if (sai >= 0) { soma -= a[sai]; cnt--; }
      out[i] = soma / cnt;
    }
    return out;
  }
  function emCurva(curvas, s, folga) {
    for (var i = 0; i < curvas.length; i++) if (s > curvas[i].s0 - folga && s < curvas[i].s1 + folga) return true;
    return false;
  }
  // Grade espacial (células de 24 m) com os índices das amostras
  var CEL = 24;
  function chave(cx, cz) { return cx * 73856093 ^ cz * 19349663; }
  function montarHash(x, z, n) {
    var h = new Map();
    for (var i = 0; i < n; i++) {
      var c = chave(Math.floor(x[i] / CEL), Math.floor(z[i] / CEL));
      var l = h.get(c); if (!l) { l = []; h.set(c, l); } l.push(i);
    }
    return h;
  }
  var _viz = [];
  function vizinhos(h, px, pz) {
    _viz.length = 0;
    var cx = Math.floor(px / CEL), cz = Math.floor(pz / CEL);
    for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
      var l = h.get(chave(cx + a, cz + b));
      if (l) for (var i = 0; i < l.length; i++) _viz.push(l[i]);
    }
    return _viz;
  }
  // Distância (m) do ponto até a estrada mais próxima e a altura dela ali
  function distEstrada(R, px, pz, out) {
    var v = vizinhos(R.hash, px, pz), best = 1e9, bi = -1;
    for (var i = 0; i < v.length; i++) {
      var dx = R.x[v[i]] - px, dz = R.z[v[i]] - pz, d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = v[i]; }
    }
    out.d = bi < 0 ? 999 : Math.sqrt(best);
    out.y = bi < 0 ? 0 : R.y[bi];
    out.i = bi;
    return out;
  }
  // Ponto da estrada na distância s (interpolado)
  function pontoEm(R, s, out) {
    var f = clamp(s / DS, 0, R.n - 1.001), i = Math.floor(f), t = f - i;
    out.x = lerp(R.x[i], R.x[i + 1], t);
    out.z = lerp(R.z[i], R.z[i + 1], t);
    out.y = lerp(R.y[i], R.y[i + 1], t);
    out.th = lerp(R.th[i], R.th[i + 1], t);
    return out;
  }

  /* ══════════════════════════════════════════════════════════════
     SALVAR
  ══════════════════════════════════════════════════════════════ */
  function lerSave() { try { return JSON.parse(localStorage.getItem(SAVE) || '{}') || {}; } catch (e) { return {}; } }
  function gravarSave(o) { try { localStorage.setItem(SAVE, JSON.stringify(o)); } catch (e) {} }
  var cfg = (function () {
    var s = lerSave();
    var toque = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return {
      camera: s.camera || 'atras',              // 'atras' | 'cabine'
      autoAcel: s.autoAcel != null ? !!s.autoAcel : toque,
      grafico: s.grafico || (toque ? 'medio' : 'alto'),
      susto: s.susto || 'forte',                // 'forte' | 'suave'
      toque: toque
    };
  })();
  function salvarCfg() { var s = lerSave(); s.camera = cfg.camera; s.autoAcel = cfg.autoAcel; s.grafico = cfg.grafico; s.susto = cfg.susto; gravarSave(s); }

  /* ══════════════════════════════════════════════════════════════
     SOM (sintetizado)
  ══════════════════════════════════════════════════════════════ */
  var som = (function () {
    var ac = null, mestre = null, ruido = null, ok = false;
    var motor = {}, estrada = {}, vento = {}, derrapa = {}, fogo = {};
    var proxCasco = 0, proxCoracao = 0, proxGrilo = 0, proxFagulha = 0, faseGalope = 0, silencioAte = 0;
    function ligado() { var s = window.AngatubaSom; return !(s && typeof s.ativo === 'function' && !s.ativo()); }
    function criarRuido() {
      var b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function fonteRuido() { var s = ac.createBufferSource(); s.buffer = ruido; s.loop = true; return s; }
    function cadeiaRuido(tipo, freq, q) {
      var src = fonteRuido(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = tipo; f.frequency.value = freq; f.Q.value = q || 0.7; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(mestre); src.start();
      return { src: src, f: f, g: g };
    }
    function init() {
      if (ac) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      mestre = ac.createGain(); mestre.gain.value = 0.9;
      var comp = ac.createDynamicsCompressor();
      mestre.connect(comp); comp.connect(ac.destination);
      ruido = criarRuido();
      // Motor: serra + quadrada uma oitava abaixo, filtradas
      motor.o1 = ac.createOscillator(); motor.o1.type = 'sawtooth';
      motor.o2 = ac.createOscillator(); motor.o2.type = 'square';
      motor.f = ac.createBiquadFilter(); motor.f.type = 'lowpass'; motor.f.frequency.value = 700; motor.f.Q.value = 2;
      motor.g = ac.createGain(); motor.g.gain.value = 0;
      var g2 = ac.createGain(); g2.gain.value = 0.55;
      motor.o1.connect(motor.f); motor.o2.connect(g2); g2.connect(motor.f);
      motor.f.connect(motor.g); motor.g.connect(mestre);
      motor.o1.start(); motor.o2.start();
      estrada = cadeiaRuido('bandpass', 380, 0.8);
      vento = cadeiaRuido('lowpass', 500, 0.5);
      derrapa = cadeiaRuido('bandpass', 1700, 1.4);
      fogo = cadeiaRuido('lowpass', 260, 0.9);
      ok = true;
      ARQ.forEach(carregarArq);
    }
    function retomar() { if (ac && ac.state === 'suspended') ac.resume().catch(function () {}); }
    // Sons gravados (ElevenLabs). Se o arquivo ainda não chegou, toca o sintetizado.
    var ARQ = ['grito', 'impacto', 'trinca', 'casco'], bufs = {}, baixando = {};
    function carregarArq(nome) {
      if (!ac || bufs[nome] || baixando[nome] || !window.fetch) return;
      baixando[nome] = true;
      fetch(PASTA + 'sfx/' + nome + '.mp3').then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(function (ab) { ac.decodeAudioData(ab, function (b) { bufs[nome] = b; }, function () {}); })
        .catch(function () { baixando[nome] = false; });
    }
    function arq(nome, vol, rate) {
      var b = bufs[nome];
      if (!b || !ac) return false;
      var s = ac.createBufferSource(), g = ac.createGain();
      s.buffer = b; if (rate) s.playbackRate.value = rate;
      g.gain.value = vol;
      s.connect(g); g.connect(mestre);
      s.start(ac.currentTime);
      s.onended = function () { try { s.disconnect(); g.disconnect(); } catch (e) {} };
      return true;
    }
    function env(g, t, a, d, v) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    function estalo(t, freq, q, a, d, v, dest) {
      var s = fonteRuido(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      s.connect(f); f.connect(g); g.connect(dest || mestre);
      s.start(t, Math.random() * 1.5); s.stop(t + a + d + 0.05);
      env(g, t, a, d, v);
    }
    function tom(t, tipo, f0, f1, a, d, v) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = tipo; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
      o.connect(g); g.connect(mestre); o.start(t); o.stop(t + a + d + 0.05);
      env(g, t, a, d, v);
    }
    // Uma batida de casco: baque de terra + o "tlim" da ferradura
    function casco(v) {
      if (arq('casco', Math.min(1, v * 1.1), 0.92 + Math.random() * 0.2)) return;
      var t = ac.currentTime + 0.005;
      estalo(t, 700, 1.2, 0.004, 0.07, v * 0.9);
      tom(t, 'sine', 95, 45, 0.004, 0.09, v * 0.8);
      if (Math.random() < 0.55) tom(t + 0.006, 'triangle', 2400 + Math.random() * 600, 0, 0.002, 0.05, v * 0.12);
    }
    var api = {
      init: init,
      retomar: retomar,
      suspender: function () { if (ac && ac.state === 'running') ac.suspend().catch(function () {}); },
      // Chamado todo quadro com o estado do carro e da Mula
      quadro: function (dt, e) {
        if (!ok) return;
        var t = ac.currentTime, on = ligado() && e.ativo;
        if (t > silencioAte) mestre.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.05);
        if (!on) return;
        // Motor: marchas simuladas pela velocidade
        var v = Math.abs(e.vel), marchas = [0, 11, 19, 27, 34, 41, 60];
        var gi = 0; while (gi < marchas.length - 2 && v > marchas[gi + 1]) gi++;
        var fr = (v - marchas[gi]) / (marchas[gi + 1] - marchas[gi]);
        var rpm = 900 + clamp(fr, 0, 1.1) * 4800 + e.acel * 500;
        var hz = rpm / 60 * 1.6;
        motor.o1.frequency.setTargetAtTime(hz, t, 0.03);
        motor.o2.frequency.setTargetAtTime(hz * 0.5, t, 0.03);
        motor.f.frequency.setTargetAtTime(400 + rpm * 0.25 + e.acel * 500, t, 0.05);
        motor.g.gain.setTargetAtTime(0.05 + e.acel * 0.06 + v * 0.0012, t, 0.05);
        estrada.g.gain.setTargetAtTime(Math.min(0.5, v * 0.008) * (e.foraPista ? 2.2 : 1), t, 0.08);
        estrada.f.frequency.setTargetAtTime(e.foraPista ? 220 : 380 + v * 6, t, 0.1);
        vento.g.gain.setTargetAtTime(Math.min(0.25, v * v * 0.00018), t, 0.2);
        derrapa.g.gain.setTargetAtTime(clamp(e.deslize * 0.05, 0, 0.32), t, 0.04);
        // Mula: fogo e galope pela distância
        var prox = e.mulaVisivel ? clamp(1 - (e.gap - 3) / 70, 0, 1) : 0;
        fogo.g.gain.setTargetAtTime(prox * prox * 0.55, t, 0.1);
        if (e.mulaVisivel && e.mulaVel > 1) {
          faseGalope += dt * (1.6 + e.mulaVel * 0.045);
          if (faseGalope >= proxCasco) {
            // galope: 4 batidas por ciclo, a última mais forte
            var b = Math.floor(proxCasco * 4) % 4;
            casco((0.1 + prox * 0.9) * (b === 3 ? 1 : 0.7));
            proxCasco = Math.floor(faseGalope * 4 + 1) / 4 + (b === 2 ? 0.08 : 0);
          }
          if (prox > 0.25 && t > proxFagulha) { estalo(t, 3000 + Math.random() * 2000, 3, 0.002, 0.03, prox * 0.25); proxFagulha = t + 0.04 + Math.random() * 0.15; }
        }
        // Coração quando ela está perto
        if (e.perigo > 0.45 && t > proxCoracao) {
          var bpm = 70 + e.perigo * 90, iv = 60 / bpm;
          tom(t, 'sine', 62, 40, 0.01, 0.12, 0.25 + e.perigo * 0.35);
          tom(t + iv * 0.28, 'sine', 55, 38, 0.01, 0.1, 0.18 + e.perigo * 0.25);
          proxCoracao = t + iv;
        }
        // Grilos no mato
        if (t > proxGrilo) {
          var gt = t + 0.02, gf = 4200 + Math.random() * 900;
          for (var c = 0; c < 3; c++) tom(gt + c * 0.045, 'sine', gf, 0, 0.004, 0.025, 0.012);
          proxGrilo = t + 0.4 + Math.random() * 1.6;
        }
      },
      batida: function (forca) {
        if (!ok || !ligado()) return;
        var t = ac.currentTime;
        estalo(t, 300, 0.6, 0.005, 0.35, 0.9 * forca);
        estalo(t, 1800, 0.9, 0.003, 0.18, 0.4 * forca);
        tom(t, 'sine', 120, 35, 0.005, 0.35, 0.8 * forca);
      },
      // Rasga-mortalha: grito de coruja que lembra pano rasgando
      rasga: function () {
        if (!ok || !ligado()) return;
        var t = ac.currentTime;
        for (var i = 0; i < 14; i++) estalo(t + i * 0.045 + Math.random() * 0.02, 1500 + Math.random() * 1500, 6, 0.004, 0.06, 0.16);
      },
      // Relincho/grito da Mula quando alcança
      grito: function (forte) {
        if (!ok || !ligado()) return;
        var t = ac.currentTime, vg0 = forte ? 0.95 : 0.5;
        if (arq('grito', forte ? 1 : 0.55, forte ? 1 : 1.12)) return;
        [0, 7].forEach(function (det) {
          var o = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain(), f = ac.createBiquadFilter(), g = ac.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(950 + det * 9, t);
          o.frequency.exponentialRampToValueAtTime(380, t + 0.7);
          o.frequency.exponentialRampToValueAtTime(160, t + 1.3);
          vib.frequency.value = 23 + det; vg.gain.value = 60;
          vib.connect(vg); vg.connect(o.frequency);
          f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.2;
          o.connect(f); f.connect(g); g.connect(mestre);
          env(g, t, 0.03, 1.3, vg0);
          o.start(t); vib.start(t); o.stop(t + 1.45); vib.stop(t + 1.45);
        });
        estalo(t, 400, 0.5, 0.02, 1.4, 0.9);
      },
      // Um instante de silêncio antes do susto (o mestre quase zera)
      silencio: function (dur) {
        if (!ok) return;
        var t = ac.currentTime;
        mestre.gain.cancelScheduledValues(t);
        mestre.gain.setValueAtTime(mestre.gain.value, t);
        mestre.gain.linearRampToValueAtTime(0.05, t + 0.04);
        silencioAte = t + dur;
      },
      // Cascos no capô + vidro trincando
      impacto: function (forca) {
        if (!ok || !ligado()) return;
        var t = ac.currentTime;
        mestre.gain.cancelScheduledValues(t); mestre.gain.setValueAtTime(1.2, t); silencioAte = 0;
        if (arq('impacto', 1 * forca)) { tom(t, 'sine', 70, 28, 0.003, 0.5, 0.7 * forca); return; }
        tom(t, 'sine', 90, 30, 0.003, 0.4, 1.0 * forca);
        tom(t + 0.07, 'sine', 80, 28, 0.003, 0.35, 0.9 * forca);
        estalo(t, 250, 0.5, 0.003, 0.45, 1.0 * forca);
        for (var i = 0; i < 10; i++) estalo(t + 0.01 + i * 0.012 + Math.random() * 0.02, 3500 + Math.random() * 4000, 4, 0.001, 0.05 + Math.random() * 0.08, 0.35 * forca);
      },
      trinca: function () {
        if (!ok || !ligado()) return;
        var t = ac.currentTime;
        if (arq('trinca', 0.9)) return;
        for (var i = 0; i < 7; i++) estalo(t + i * 0.018 + Math.random() * 0.015, 4500 + Math.random() * 3500, 5, 0.001, 0.06, 0.3);
      },
      // Chiado de estática (o sinal caindo)
      estatica: function (dur) {
        if (!ok || !ligado()) return;
        var t = ac.currentTime, s = fonteRuido(), f = ac.createBiquadFilter(), g = ac.createGain();
        f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.4;
        s.connect(f); f.connect(g); g.connect(mestre);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
        g.gain.setValueAtTime(0.7, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.start(t); s.stop(t + dur + 0.05);
      },
      // Sobressalto curto (ela encostou do lado)
      ferroada: function () {
        if (!ok || !ligado()) return;
        var t = ac.currentTime;
        tom(t, 'sawtooth', 1400, 600, 0.005, 0.4, 0.12);
        tom(t, 'sawtooth', 1480, 640, 0.005, 0.4, 0.1);
        estalo(t, 900, 0.8, 0.003, 0.3, 0.4);
      },
      bip: function (alto) {
        if (!ok || !ligado()) return;
        tom(ac.currentTime, 'square', alto ? 880 : 440, 0, 0.005, alto ? 0.35 : 0.15, 0.12);
      },
      placa: function () { if (!ok || !ligado()) return; var t = ac.currentTime; tom(t, 'triangle', 660, 0, 0.005, 0.12, 0.09); tom(t + 0.1, 'triangle', 990, 0, 0.005, 0.18, 0.09); },
      vitoria: function () {
        if (!ok || !ligado()) return;
        var t = ac.currentTime;
        [523, 659, 784, 1046].forEach(function (f, i) { tom(t + i * 0.12, 'triangle', f, 0, 0.01, 0.6, 0.12); });
      }
    };
    return api;
  })();

  /* ══════════════════════════════════════════════════════════════
     TEXTURAS (canvas)
  ══════════════════════════════════════════════════════════════ */
  function texCanvas(w, h, pintar, repetir) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'); pintar(g, w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    if (repetir) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    t.anisotropy = 4;
    return t;
  }
  function manchas(g, w, h, n, cores, rmin, rmax, alfa) {
    var r = rng(n * 31 + w);
    for (var i = 0; i < n; i++) {
      g.globalAlpha = alfa * (0.4 + r() * 0.6);
      g.fillStyle = cores[Math.floor(r() * cores.length)];
      var rr = rmin + r() * (rmax - rmin), x = r() * w, y = r() * h;
      g.beginPath(); g.ellipse(x, y, rr, rr * (0.5 + r()), r() * 3, 0, 6.3); g.fill();
      // repete na borda (textura contínua)
      if (x < rmax) { g.beginPath(); g.ellipse(x + w, y, rr, rr, 0, 0, 6.3); g.fill(); }
      if (y < rmax) { g.beginPath(); g.ellipse(x, y + h, rr, rr, 0, 0, 6.3); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  function texTerra() {
    return texCanvas(256, 512, function (g, w, h) {
      g.fillStyle = '#93583a'; g.fillRect(0, 0, w, h);
      manchas(g, w, h, 900, ['#7d4630', '#a5694a', '#6a3a24', '#b07a5a'], 2, 9, 0.5);
      // trilhos de pneu
      [0.3, 0.7].forEach(function (u) {
        var gr = g.createLinearGradient(w * (u - 0.08), 0, w * (u + 0.08), 0);
        gr.addColorStop(0, 'rgba(40,20,12,0)'); gr.addColorStop(0.5, 'rgba(40,20,12,.55)'); gr.addColorStop(1, 'rgba(40,20,12,0)');
        g.fillStyle = gr; g.fillRect(w * (u - 0.08), 0, w * 0.16, h);
      });
      manchas(g, w, h, 260, ['#9c8a7a', '#5d5750', '#b8a593'], 0.8, 2.2, 0.7); // pedrinhas
      // bordas com capim
      [0, 1].forEach(function (lado) {
        var x0 = lado ? w * 0.9 : 0;
        var gr = g.createLinearGradient(lado ? w * 0.86 : w * 0.14, 0, lado ? w : 0, 0);
        gr.addColorStop(0, 'rgba(46,52,26,0)'); gr.addColorStop(1, 'rgba(46,52,26,1)');
        g.fillStyle = gr; g.fillRect(lado ? w * 0.86 : 0, 0, w * 0.14, h);
        var r = rng(lado + 5);
        g.strokeStyle = '#3d4a22'; g.lineWidth = 1.2;
        for (var i = 0; i < 260; i++) {
          var x = x0 + r() * w * 0.1, y = r() * h;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y - 4 - r() * 8); g.stroke();
        }
      });
    }, true);
  }
  function texMato() {
    return texCanvas(256, 256, function (g, w, h) {
      g.fillStyle = '#34421f'; g.fillRect(0, 0, w, h);
      manchas(g, w, h, 700, ['#1f2914', '#344321', '#3c3a1c', '#2b2f16', '#4a4424'], 3, 14, 0.45);
      var r = rng(9);
      g.lineWidth = 1;
      for (var i = 0; i < 1600; i++) {
        g.strokeStyle = r() < 0.5 ? '#4b5a2a' : '#6a6436';
        g.globalAlpha = 0.5;
        var x = r() * w, y = r() * h;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6); g.stroke();
      }
      g.globalAlpha = 1;
    }, true);
  }
  function texBrilho(cor0, cor1) {
    return texCanvas(64, 64, function (g, w) {
      var gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, cor0); gr.addColorStop(0.35, cor1); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
  }
  // N planos verticais cruzados (base em y=0, 1x1), com um plano de topo opcional
  function cartoes(nPlanos, topo) {
    var pos = [], uv = [], nor = [], idx = [], v = 0;
    function quad(p, n) {
      for (var k = 0; k < 4; k++) { pos.push(p[k][0], p[k][1], p[k][2]); nor.push(n[0], n[1], n[2]); }
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
    for (var i = 0; i < nPlanos; i++) {
      var a = i / nPlanos * Math.PI, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
      quad([[-cx, 0, -cz], [cx, 0, cz], [cx, 1, cz], [-cx, 1, -cz]], [-Math.sin(a), 0, Math.cos(a)]);
    }
    if (topo) quad([[-0.45, 0.62, -0.45], [0.45, 0.62, -0.45], [0.45, 0.62, 0.45], [-0.45, 0.62, 0.45]], [0, 1, 0]);
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  // Folhas de eucalipto: compridas, finas e caídas, em cachos
  function texFolhas(c1, c2, c3) {
    var t = texCanvas(256, 256, function (g, w, h) {
      var r = rng(c1.length * 97 + c2.charCodeAt(2));
      for (var i = 0; i < 260; i++) {
        var x = 20 + r() * (w - 40), y = 10 + r() * (h - 30);
        // mais denso no meio, ralo nas bordas
        var dx = (x - w / 2) / (w / 2), dy = (y - h * 0.45) / (h / 2);
        if (dx * dx + dy * dy > 1 + r() * 0.25) continue;
        var ang = Math.PI / 2 + (r() - 0.5) * 1.2, len = 10 + r() * 16, larg = 1.6 + r() * 1.6;
        g.save(); g.translate(x, y); g.rotate(ang);
        g.fillStyle = [c1, c2, c3][Math.floor(r() * 3)];
        g.beginPath(); g.ellipse(len / 2, 0, len / 2, larg, 0.08, 0, 6.3); g.fill();
        g.restore();
      }
      // galhinhos
      g.strokeStyle = 'rgba(70,60,50,.7)'; g.lineWidth = 1;
      for (var k = 0; k < 14; k++) { g.beginPath(); var sx = w * (0.3 + r() * 0.4); g.moveTo(sx, h); g.quadraticCurveTo(sx + (r() - 0.5) * 60, h * 0.6, w * (0.15 + r() * 0.7), h * (0.15 + r() * 0.5)); g.stroke(); }
    });
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    return t;
  }
  // Capim seco de pasto
  function texCapim() {
    var t = texCanvas(128, 128, function (g, w, h) {
      var r = rng(4242);
      for (var i = 0; i < 70; i++) {
        var x = 8 + r() * (w - 16), alt = h * (0.35 + r() * 0.6), curva = (r() - 0.5) * 40;
        g.strokeStyle = ['#7a7640', '#5d6a2f', '#8f8550', '#6b6b35', '#a39a62'][Math.floor(r() * 5)];
        g.lineWidth = 1 + r() * 1.6;
        g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + curva * 0.3, h - alt * 0.6, x + curva, h - alt); g.stroke();
      }
    });
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    return t;
  }
  // Cana: colmos e folhas longas arqueadas
  function texCana() {
    var t = texCanvas(128, 256, function (g, w, h) {
      var r = rng(777);
      for (var i = 0; i < 9; i++) {
        var x = 10 + r() * (w - 20);
        g.strokeStyle = '#5a5a2a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x, h); g.lineTo(x + (r() - 0.5) * 8, h * 0.25); g.stroke();
      }
      for (var k = 0; k < 60; k++) {
        var x0 = 10 + r() * (w - 20), y0 = h * (0.15 + r() * 0.7), dir = r() < 0.5 ? -1 : 1, len = 30 + r() * 50;
        g.strokeStyle = ['#4d5b26', '#627033', '#3e4a1e', '#7b7a3e'][Math.floor(r() * 4)];
        g.lineWidth = 2 + r() * 2;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + dir * len * 0.6, y0 - len * 0.5, x0 + dir * len, y0 + len * 0.15); g.stroke();
      }
    });
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    return t;
  }
  function texPlaca(txt, sub) {
    return texCanvas(256, 160, function (g, w, h) {
      g.fillStyle = '#0d5a2a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8f0e6'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#f2f6ef'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '800 64px "Syne", "DM Sans", sans-serif'; g.fillText(txt, w / 2, h * (sub ? 0.42 : 0.52));
      if (sub) { g.font = '700 26px "DM Sans", sans-serif'; g.fillText(sub, w / 2, h * 0.76); }
      // sujeira
      manchas(g, w, h, 60, ['#3a2a1a', '#22160c'], 2, 10, 0.25);
    });
  }
  function texChevron(dir) {
    return texCanvas(128, 128, function (g, w, h) {
      g.fillStyle = '#e8b81c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#111';
      for (var i = 0; i < 2; i++) {
        var x0 = 18 + i * 46;
        g.beginPath();
        if (dir > 0) { g.moveTo(x0, 14); g.lineTo(x0 + 34, 64); g.lineTo(x0, 114); g.lineTo(x0 + 18, 114); g.lineTo(x0 + 52, 64); g.lineTo(x0 + 18, 14); }
        else { g.moveTo(w - x0, 14); g.lineTo(w - x0 - 34, 64); g.lineTo(w - x0, 114); g.lineTo(w - x0 - 18, 114); g.lineTo(w - x0 - 52, 64); g.lineTo(w - x0 - 18, 14); }
        g.closePath(); g.fill();
      }
    });
  }
  function texCeu() {
    return texCanvas(512, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#04040c'); gr.addColorStop(0.55, '#0d0b1c'); gr.addColorStop(0.85, '#2a1222'); gr.addColorStop(1, '#3a1620');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      var r = rng(77);
      for (var i = 0; i < 420; i++) {
        g.globalAlpha = 0.2 + r() * 0.7; g.fillStyle = '#fff';
        var s = r() < 0.92 ? 0.8 : 1.6;
        g.fillRect(r() * w, r() * h * 0.7, s, s);
      }
      g.globalAlpha = 1;
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PARTÍCULAS (fogo da Mula, poeira do carro)
  ══════════════════════════════════════════════════════════════ */
  function Particulas(max, tex, aditivo, corFn) {
    this.max = max; this.n = 0; this.corFn = corFn;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.vida = new Float32Array(max); this.dur = new Float32Array(max); this.tam0 = new Float32Array(max);
    this.cor = new Float32Array(max * 3); this.tam = new Float32Array(max); this.alfa = new Float32Array(max);
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(this.pos, 3));
    geo.setAttribute('cor', new T.BufferAttribute(this.cor, 3));
    geo.setAttribute('tam', new T.BufferAttribute(this.tam, 1));
    geo.setAttribute('alfa', new T.BufferAttribute(this.alfa, 1));
    geo.boundingSphere = new T.Sphere(new T.Vector3(), 1e6);
    var mat = new T.ShaderMaterial({
      uniforms: { tMapa: { value: tex }, uEscala: { value: 400 } },
      vertexShader: 'attribute vec3 cor; attribute float tam; attribute float alfa; varying vec3 vCor; varying float vAlfa; uniform float uEscala;' +
        'void main(){ vCor=cor; vAlfa=alfa; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=tam*uEscala/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D tMapa; varying vec3 vCor; varying float vAlfa;' +
        'void main(){ vec4 t=texture2D(tMapa, gl_PointCoord); gl_FragColor=vec4(vCor*t.rgb, t.a*vAlfa); }',
      transparent: true, depthWrite: false, blending: aditivo ? T.AdditiveBlending : T.NormalBlending
    });
    this.mat = mat;
    this.obj = new T.Points(geo, mat);
    this.obj.frustumCulled = false;
    this.geo = geo;
  }
  Particulas.prototype.emitir = function (x, y, z, vx, vy, vz, dur, tam) {
    var i;
    if (this.n < this.max) i = this.n++;
    else { // substitui a mais velha
      i = 0; var m = -1;
      for (var j = 0; j < this.n; j++) { var f = this.vida[j] / this.dur[j]; if (f > m) { m = f; i = j; } }
    }
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.vida[i] = 0; this.dur[i] = dur; this.tam0[i] = tam;
  };
  Particulas.prototype.atualizar = function (dt, subida, arrasto) {
    for (var i = 0; i < this.n; i++) {
      this.vida[i] += dt;
      if (this.vida[i] >= this.dur[i]) {
        var u = --this.n;
        if (i !== u) {
          for (var a = 0; a < 3; a++) { this.pos[i * 3 + a] = this.pos[u * 3 + a]; this.vel[i * 3 + a] = this.vel[u * 3 + a]; }
          this.vida[i] = this.vida[u]; this.dur[i] = this.dur[u]; this.tam0[i] = this.tam0[u];
        }
        i--; continue;
      }
      var k = 1 - arrasto * dt;
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k + subida * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      var f = this.vida[i] / this.dur[i];
      this.corFn(f, this.cor, i * 3);
      this.tam[i] = this.tam0[i] * (this.corFn.tam ? this.corFn.tam(f) : 1);
      this.alfa[i] = this.corFn.alfa ? this.corFn.alfa(f) : 1 - f;
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.cor.needsUpdate = true;
    this.geo.attributes.tam.needsUpdate = true;
    this.geo.attributes.alfa.needsUpdate = true;
  };
  Particulas.prototype.limpar = function () { this.n = 0; this.geo.setDrawRange(0, 0); };

  function corFogo(f, c, o) {
    // branco-amarelo → laranja → vermelho → brasa escura
    if (f < 0.15) { c[o] = 1.6; c[o + 1] = 1.35; c[o + 2] = 0.7; }
    else if (f < 0.45) { var t = (f - 0.15) / 0.3; c[o] = 1.5; c[o + 1] = lerp(1.2, 0.45, t); c[o + 2] = lerp(0.5, 0.08, t); }
    else { var u = (f - 0.45) / 0.55; c[o] = lerp(1.3, 0.25, u); c[o + 1] = lerp(0.4, 0.04, u); c[o + 2] = 0.03; }
  }
  corFogo.tam = function (f) { return f < 0.2 ? 0.6 + f * 2.5 : 1.1 - (f - 0.2) * 0.9; };
  corFogo.alfa = function (f) { return f < 0.1 ? f * 10 : 1 - f; };
  function corPoeira(f, c, o) { c[o] = 0.42; c[o + 1] = 0.25; c[o + 2] = 0.18; }
  corPoeira.tam = function (f) { return 0.6 + f * 1.8; };
  corPoeira.alfa = function (f) { return (1 - f) * 0.2; };

  /* ══════════════════════════════════════════════════════════════
     ESTADO
  ══════════════════════════════════════════════════════════════ */
  var el = {};               // elementos DOM
  var G = null;              // tudo do Three (cena, câmeras, objetos)
  var R = null;              // rota atual
  var rotaIdx = 0;
  var ativo = false, montado = false, pausado = false, emPartida = false, lockNativo = false;
  var raf = 0, tAnt = 0, tempoGlobal = 0;
  var estado = 'titulo';     // titulo | contagem | correndo | pego | fim
  var tEstado = 0;
  var ent = { acel: 0, freio: 0, esq: 0, dir: 0, drift: 0, olharTras: 0 };
  var teclas = {};
  var carro = null, mula = null, corrida = null;

  function novoCarro() {
    return { x: 0, z: 0, y: 0, psi: 0, vx: 0, vz: 0, vel: 0, volante: 0, idx: 0, s: 0, lat: 0,
      driftT: 0, deslize: 0, foraPista: false, batidaT: 0, rodas: 0, pitch: 0, roll: 0, acel: 0, freando: false };
  }

  /* ══════════════════════════════════════════════════════════════
     CENA 3D
  ══════════════════════════════════════════════════════════════ */
  function montarCena() {
    G = {};
    var renderer = new T.WebGLRenderer({ canvas: el.canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    G.renderer = renderer;

    var cena = new T.Scene();
    cena.background = new T.Color(0x07060f);
    cena.fog = new T.FogExp2(0x0d0b17, 0.0105);
    G.cena = cena;

    G.cam = new T.PerspectiveCamera(68, 16 / 9, 0.1, 900);
    G.camEsp = new T.PerspectiveCamera(48, 3, 0.5, 400);

    // Céu: esfera grande com gradiente e estrelas, e a lua
    var ceu = new T.Mesh(new T.SphereGeometry(700, 24, 12), new T.MeshBasicMaterial({ map: texCeu(), side: T.BackSide, fog: false, depthWrite: false }));
    G.ceu = ceu; cena.add(ceu);
    var lua = new T.Sprite(new T.SpriteMaterial({ map: texBrilho('rgba(255,236,214,1)', 'rgba(220,180,170,.35)'), fog: false, depthWrite: false, transparent: true }));
    lua.scale.set(70, 70, 1); G.lua = lua; cena.add(lua);

    if (AST && AST.tx.ceu) {
      var tc = AST.tx.ceu;
      tc.mapping = T.EquirectangularReflectionMapping; tc.wrapS = T.RepeatWrapping; tc.wrapT = T.ClampToEdgeWrapping;
      cena.background = tc;
      cena.backgroundIntensity = 0.42;
      var pm = new T.PMREMGenerator(renderer);
      cena.environment = pm.fromEquirectangular(tc).texture;
      cena.environmentIntensity = 0.45;
      pm.dispose();
      ceu.visible = false; lua.visible = false;
      cena.fog.color.setRGB(0.035, 0.04, 0.07);
    }
    cena.add(new T.HemisphereLight(0x6c6cb0, 0x24160e, AST && AST.tx.ceu ? 0.75 : 1.1));
    var luar = new T.DirectionalLight(0x9aa0d8, 0.9);
    luar.position.set(-200, 300, -150);
    cena.add(luar); G.luar = luar; cena.add(luar.target);

    G.tex = { terra: texTerra(), mato: texMato(), brilhoFogo: texBrilho('rgba(255,255,230,1)', 'rgba(255,140,40,.55)'),
      fumaca: texBrilho('rgba(255,255,255,.9)', 'rgba(200,200,200,.3)'), vermelho: texBrilho('rgba(255,90,80,1)', 'rgba(200,0,0,.4)') };

    montarChao();
    montarCarro();
    montarMula();
    G.fogo = new Particulas(420, G.tex.brilhoFogo, true, corFogo);
    cena.add(G.fogo.obj);
    G.poeira = new Particulas(160, G.tex.fumaca, false, corPoeira);
    cena.add(G.poeira.obj);
    montarPos();
    montarNevoa();
    G.estradaObj = null;
  }

  // Névoa rasteira: tufos grandes e suaves na beira do chão, clareados quando caem no facho do farol
  var NEV_N = 70;
  function montarNevoa() {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(NEV_N * 3), tam = new Float32Array(NEV_N), alfa = new Float32Array(NEV_N), cor = new Float32Array(NEV_N * 3);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('tam', new T.BufferAttribute(tam, 1));
    geo.setAttribute('alfa', new T.BufferAttribute(alfa, 1));
    geo.setAttribute('cor', new T.BufferAttribute(cor, 3));
    var mat = new T.ShaderMaterial({
      uniforms: { tMapa: { value: G.tex.fumaca }, uEscala: { value: 400 } },
      vertexShader: 'attribute vec3 cor; attribute float tam; attribute float alfa; varying vec3 vCor; varying float vAlfa; uniform float uEscala;' +
        'void main(){ vCor=cor; vec4 mv=modelViewMatrix*vec4(position,1.0); vAlfa=alfa*smoothstep(1.5, 8.0, -mv.z); gl_PointSize=tam*uEscala/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D tMapa; varying vec3 vCor; varying float vAlfa; void main(){ float a = texture2D(tMapa, gl_PointCoord).a; gl_FragColor = vec4(vCor, a*vAlfa); }',
      transparent: true, depthWrite: false, blending: T.NormalBlending
    });
    var pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4;
    G.cena.add(pts);
    G.nev = { geo: geo, pos: pos, tam: tam, alfa: alfa, cor: cor, mat: mat, s: new Float32Array(NEV_N), lat: new Float32Array(NEV_N), alt: new Float32Array(NEV_N), ok: false };
  }
  var _pn = { x: 0, z: 0, y: 0, th: 0 };
  function atualizarNevoa(dt) {
    var N = G.nev, c = carro;
    var fx = Math.sin(c.psi), fz = Math.cos(c.psi);
    for (var i = 0; i < NEV_N; i++) {
      // recicla o que ficou para trás ou longe demais
      if (!N.ok || N.s[i] < c.s - 25 || N.s[i] > c.s + 150) {
        N.s[i] = c.s + (N.ok ? 120 + Math.random() * 30 : -20 + Math.random() * 170);
        N.lat[i] = (Math.random() - 0.5) * 34; N.alt[i] = 0.4 + Math.random() * 1.6;
        N.tam[i] = 7 + Math.random() * 9;
      }
      N.s[i] -= dt * 0.6;
      pontoEm(R, clamp(N.s[i], 0, R.L - 1), _pn);
      var x = _pn.x - Math.cos(_pn.th) * N.lat[i], z = _pn.z + Math.sin(_pn.th) * N.lat[i], y = _pn.y + N.alt[i];
      N.pos[i * 3] = x; N.pos[i * 3 + 1] = y; N.pos[i * 3 + 2] = z;
      // dentro do facho do farol: clareia
      var dx = x - c.x, dz = z - c.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
      var noFacho = clamp(((dx * fx + dz * fz) / d - 0.86) / 0.12, 0, 1) * clamp(1 - d / 70, 0, 1);
      var luzM = mula && G.mulaObj.visible ? clamp(1 - Math.hypot(x - G.mulaObj.position.x, z - G.mulaObj.position.z) / 18, 0, 1) : 0;
      N.cor[i * 3] = 0.16 + noFacho * 0.75 + luzM * 0.8; N.cor[i * 3 + 1] = 0.16 + noFacho * 0.66 + luzM * 0.35; N.cor[i * 3 + 2] = 0.22 + noFacho * 0.5 + luzM * 0.1;
      N.alfa[i] = 0.06 + noFacho * 0.12;
    }
    N.ok = true;
    N.geo.attributes.position.needsUpdate = true; N.geo.attributes.tam.needsUpdate = true;
    N.geo.attributes.alfa.needsUpdate = true; N.geo.attributes.cor.needsUpdate = true;
  }

  // Chão: grade que acompanha o carro (alturas pelo relevo, rebaixada junto da estrada)
  var CHAO_N = 80, CHAO_C = 8;
  function montarChao() {
    var geo = new T.PlaneGeometry(CHAO_N * CHAO_C, CHAO_N * CHAO_C, CHAO_N, CHAO_N);
    geo.rotateX(-Math.PI / 2);
    var mat = new T.MeshLambertMaterial({ map: G.tex.mato });
    if (AST && AST.tx.chaoCor) {
      mat = new T.MeshStandardMaterial({ map: AST.tx.chaoCor, normalMap: AST.tx.chaoNor || null, roughness: 0.95, metalness: 0, color: new T.Color(0.62, 0.72, 0.48) });
      G.uvChao = 2.4;
    }
    var m = new T.Mesh(geo, mat);
    m.frustumCulled = false;
    m.receiveShadow = true;
    G.chao = m; G.chaoCx = 1e9; G.chaoCz = 1e9;
    G.cena.add(m);
  }
  var _de = { d: 0, y: 0, i: 0 };
  function atualizarChao(px, pz, forcar) {
    var cx = Math.round(px / CHAO_C) * CHAO_C, cz = Math.round(pz / CHAO_C) * CHAO_C;
    if (!forcar && Math.abs(cx - G.chaoCx) < 24 && Math.abs(cz - G.chaoCz) < 24) return;
    G.chaoCx = cx; G.chaoCz = cz;
    var geo = G.chao.geometry, p = geo.attributes.position, uv = geo.attributes.uv;
    var meio = CHAO_N * CHAO_C / 2, k = 0;
    for (var j = 0; j <= CHAO_N; j++) {
      for (var i = 0; i <= CHAO_N; i++, k++) {
        var x = cx - meio + i * CHAO_C, z = cz - meio + j * CHAO_C;
        var h = relevo(x, z);
        if (R) {
          distEstrada(R, x, z, _de);
          if (_de.d < 30) h = lerp(_de.y - 0.35, h, suave(6.5, 24, _de.d));
        }
        p.setXYZ(k, x, h, z);
        uv.setXY(k, x / (G.uvChao || 7), z / (G.uvChao || 7));
      }
    }
    p.needsUpdate = true; uv.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // Estrada + tudo que fica à beira dela (gerado uma vez por rota)
  function montarEstrada() {
    if (G.estradaObj) { G.cena.remove(G.estradaObj); descartar(G.estradaObj); }
    var grp = new T.Group();
    G.estradaObj = grp;
    var n = R.n;
    // Faixa da estrada: 4 vértices por amostra (-5.4, -4.5, 4.5, 5.4)
    var real = !!(AST && AST.tx.estradaCor);
    var LAT = real ? [-5.6, -4.9, -4.3, -3.0, -2.2, -1.4, 0, 1.4, 2.2, 3.0, 4.3, 4.9, 5.6] : [-5.5, -MEIA, MEIA, 5.5];
    var ALT = real ? [-0.3, -0.06, 0.04, 0.06, 0.04, 0.07, 0.09, 0.07, 0.04, 0.06, 0.04, -0.06, -0.3] : [-0.28, 0.06, 0.06, -0.28];
    // cor por vértice: borda com capim, trilhos de pneu mais escuros e lisos, meio mais claro
    var COR = [[0.42, 0.5, 0.3], [0.62, 0.62, 0.48], [0.95, 0.9, 0.85], [0.9, 0.86, 0.82], [0.7, 0.66, 0.62], [0.92, 0.88, 0.84], [1.05, 1.0, 0.95],
      [0.92, 0.88, 0.84], [0.7, 0.66, 0.62], [0.9, 0.86, 0.82], [0.95, 0.9, 0.85], [0.62, 0.62, 0.48], [0.42, 0.5, 0.3]];
    var NL = LAT.length;
    var pos = new Float32Array(n * NL * 3), uvs = new Float32Array(n * NL * 2), cores = new Float32Array(n * NL * 3), idx = [];
    for (var i = 0; i < n; i++) {
      var th = R.th[i], rx = -Math.cos(th), rz = Math.sin(th);
      for (var a = 0; a < NL; a++) {
        var o = (i * NL + a);
        pos[o * 3] = R.x[i] + rx * LAT[a];
        pos[o * 3 + 1] = R.y[i] + ALT[a];
        pos[o * 3 + 2] = R.z[i] + rz * LAT[a];
        if (real) { uvs[o * 2] = (LAT[a] + 5.6) / 1.5; uvs[o * 2 + 1] = i * DS / 1.5; }
        else { uvs[o * 2] = [0, 0.1, 0.9, 1][a]; uvs[o * 2 + 1] = i * DS / 9; }
        var cc = real ? COR[a] : [1, 1, 1];
        cores[o * 3] = cc[0]; cores[o * 3 + 1] = cc[1]; cores[o * 3 + 2] = cc[2];
      }
      if (i < n - 1) for (a = 0; a < NL - 1; a++) {
        var p0 = i * NL + a, p1 = p0 + 1, p2 = p0 + NL, p3 = p0 + NL + 1;
        idx.push(p0, p1, p2, p1, p3, p2);
      }
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new T.BufferAttribute(cores, 3));
    if (real && !G.matEstrada) {
      G.matEstrada = new T.MeshStandardMaterial({ map: AST.tx.estradaCor, normalMap: AST.tx.estradaNor || null,
        roughness: 0.93, metalness: 0, vertexColors: true, normalScale: new T.Vector2(1.3, 1.3), envMapIntensity: 0.4 });
    }
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var estrada = new T.Mesh(geo, G.matEstrada || new T.MeshLambertMaterial({ map: G.tex.terra }));
    estrada.receiveShadow = true;
    grp.add(estrada);

    montarBeira(grp);
    grp.traverse(function (o) { if (o.isMesh && !o.isInstancedMesh) { o.castShadow = true; o.receiveShadow = true; } });
    G.cena.add(grp);
    atualizarChao(R.x[0], R.z[0], true);
  }

  function descartar(o) {
    o.traverse(function (c) {
      if (c.geometry) c.geometry.dispose();
      if (c.material) { var ms = Array.isArray(c.material) ? c.material : [c.material]; ms.forEach(function (m) { if (m.map && m.map !== G.tex.terra && m.map !== G.tex.mato) m.map.dispose(); m.dispose(); }); }
    });
  }

  // Árvores, cercas, refletores, placas, cruzes, obstáculos e a capela
  function montarBeira(grp) {
    var rnd = rng(R.def.semente * 3 + 11);
    var BLOCO = 500, nb = Math.ceil(R.L / BLOCO);
    var mtx = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), eixoY = new T.Vector3(0, 1, 0);
    var tmp = {};
    var geoTronco = new T.CylinderGeometry(0.16, 0.26, 1, 5); geoTronco.translate(0, 0.5, 0);
    var geoCopa = new T.IcosahedronGeometry(1, 0);
    var geoCana = new T.ConeGeometry(0.5, 1, 4); geoCana.translate(0, 0.5, 0);
    var geoPoste = new T.BoxGeometry(0.14, 1.3, 0.14); geoPoste.translate(0, 0.65, 0);
    var geoRefl = new T.BoxGeometry(0.1, 0.16, 0.16);
    var matTronco = new T.MeshLambertMaterial({ color: 0xb9b2a6 });
    if (AST && AST.tx.cascaCor) {
      var tcas = AST.tx.cascaCor.clone(); tcas.repeat.set(1, 7); tcas.needsUpdate = true;
      var tcasN = AST.tx.cascaNor ? AST.tx.cascaNor.clone() : null; if (tcasN) { tcasN.repeat.set(1, 7); tcasN.needsUpdate = true; }
      matTronco = new T.MeshStandardMaterial({ map: tcas, normalMap: tcasN, roughness: 0.85, metalness: 0, color: 0xd8d2c8 });
    }
    // Copas e capim em cartões com transparência (folhas desenhadas em canvas)
    var geoCopaC = cartoes(3, true), geoCapim = cartoes(2, false), geoCanaC = cartoes(3, false);
    var matFolha = new T.MeshStandardMaterial({ map: texFolhas('#2c3b2a', '#4a5a3c', '#6b7354'), alphaTest: 0.45, side: T.DoubleSide, roughness: 0.9, metalness: 0 });
    var matFolha2 = new T.MeshStandardMaterial({ map: texFolhas('#24331f', '#3f5230', '#5d6b3a'), alphaTest: 0.45, side: T.DoubleSide, roughness: 0.9, metalness: 0 });
    var matCapim = new T.MeshStandardMaterial({ map: texCapim(), alphaTest: 0.4, side: T.DoubleSide, roughness: 1, metalness: 0 });
    var matCanaC = new T.MeshStandardMaterial({ map: texCana(), alphaTest: 0.4, side: T.DoubleSide, roughness: 0.95, metalness: 0 });
    var matTronco2 = new T.MeshLambertMaterial({ color: 0x3b2c22 });
    var matCopa = new T.MeshLambertMaterial({ color: 0x1d2d1c, flatShading: true });
    var matCopa2 = new T.MeshLambertMaterial({ color: 0x2a3118, flatShading: true });
    var matCana = new T.MeshLambertMaterial({ color: 0x3e4a21, flatShading: true });
    var matPoste = new T.MeshLambertMaterial({ color: 0x4a3828 });
    var matRefl = new T.MeshBasicMaterial({ color: 0xff2a1a });
    var matBalz = new T.MeshBasicMaterial({ color: 0xd8dccf });
    // Trechos: eucaliptal, pasto, canavial (mudam a cada 300-600 m)
    var trechos = [], st = 0;
    while (st < R.L) { var tipos = ['eucalipto', 'pasto', 'cana', 'mata']; trechos.push({ s0: st, tipo: tipos[Math.floor(rnd() * tipos.length)] }); st += 300 + rnd() * 300; }
    trechos[0].tipo = 'pasto';
    function trechoEm(s) { var t = trechos[0]; for (var i = 0; i < trechos.length; i++) if (trechos[i].s0 <= s) t = trechos[i]; return t.tipo; }
    var blocos = [];
    for (var b = 0; b < nb; b++) blocos.push({ tronco: [], tronco2: [], copa: [], copa2: [], cana: [], poste: [], refl: [], balz: [], capim: [] });
    function livre(x, z, folga) { distEstrada(R, x, z, tmp); return tmp.d > folga; }
    function ponto(i, lat) { var th = R.th[i]; return { x: R.x[i] - Math.cos(th) * lat, z: R.z[i] + Math.sin(th) * lat, th: th }; }
    for (var i = 2; i < R.n - 2; i++) {
      var s = i * DS, bl = blocos[Math.floor(s / BLOCO)], tipo = trechoEm(s);
      if (s > R.fim - 10) continue;
      for (var lado = -1; lado <= 1; lado += 2) {
        // Eucaliptal: fileiras
        if (tipo === 'eucalipto' && i % 2 === 0) {
          for (var f = 0; f < 6; f++) {
            if (rnd() < 0.2) continue;
            var lat = lado * (11 + f * 4.2 + rnd() * 0.8), pt = ponto(i, lat);
            if (!livre(pt.x, pt.z, 9.5)) continue;
            var y = relevo(pt.x, pt.z) - 0.2, alt = 15 + rnd() * 9;
            bl.tronco.push([pt.x, y, pt.z, 0.9 + rnd() * 0.3, alt, rnd() * 6]);
            bl.copa.push([pt.x, y + alt - 5.5, pt.z, 3.6 + rnd() * 1.6, 7 + rnd() * 2.5, rnd() * 6]);
          }
        } else if (tipo === 'cana' && i % 1 === 0) {
          for (var c = 0; c < 5; c++) {
            var lat2 = lado * (8.6 + rnd() * 28), pc = ponto(i, lat2);
            if (!livre(pc.x, pc.z, 8.2)) continue;
            bl.cana.push([pc.x, relevo(pc.x, pc.z) - 0.3, pc.z, 1.3 + rnd() * 0.7, 2.6 + rnd() * 1.2, rnd() * 6]);
          }
        } else if (rnd() < (tipo === 'mata' ? 0.55 : 0.08)) {
          var lat3 = lado * (10 + rnd() * (tipo === 'mata' ? 30 : 50)), pm = ponto(i, lat3);
          if (livre(pm.x, pm.z, 9.5)) {
            var y3 = relevo(pm.x, pm.z) - 0.2, alt3 = 4 + rnd() * 5;
            bl.tronco2.push([pm.x, y3, pm.z, 1.3 + rnd() * 0.6, alt3, rnd() * 6]);
            bl.copa2.push([pm.x, y3 + alt3 - 2.2, pm.z, 5 + rnd() * 3.5, 4.2 + rnd() * 2, rnd() * 6]);
          }
        }
        // Tufos de capim na beira da estrada
        if (tipo !== 'cana') for (var tc2 = 0; tc2 < 2; tc2++) {
          var latc = lado * (5.4 + rnd() * (tc2 ? 9 : 2.5)), pcp = ponto(i, latc);
          if (!livre(pcp.x, pcp.z, 5.2)) continue;
          bl.capim.push([pcp.x, relevo(pcp.x, pcp.z) - 0.25, pcp.z, 0.9 + rnd() * 0.9, 0.55 + rnd() * 0.6, rnd() * 6]);
        }
        // Cerca do pasto
        if (tipo === 'pasto' && i % 2 === 0) {
          var pp = ponto(i, lado * BARREIRA);
          if (livre(pp.x, pp.z, BARREIRA - 0.5)) bl.poste.push([pp.x, R.y[i] - 0.3, pp.z, 1, 1, pp.th]);
        }
      }
    }
    // Balizadores brancos nos dois lados, a cada 20 m (leitura da estrada à noite)
    for (i = 5; i < R.n - 2 && i * DS < R.fim; i += 10) {
      for (var lb = -1; lb <= 1; lb += 2) {
        if (emCurva(R.curvas, i * DS, 30)) continue;
        var pb = ponto(i, lb * 6.3);
        if (!livre(pb.x, pb.z, 6)) continue;
        var bb = blocos[Math.floor(i * DS / BLOCO)];
        bb.poste.push([pb.x, R.y[i] - 0.25, pb.z, 0.85, 1, pb.th]);
        bb.balz.push([pb.x, R.y[i] + 0.8, pb.z, 1, 1, pb.th]);
      }
    }
    // Refletores vermelhos e chevrons no lado de fora das curvas médias/fortes
    var matsChev = { '1': new T.MeshLambertMaterial({ map: texChevron(1), emissive: 0x2a2200 }), '-1': new T.MeshLambertMaterial({ map: texChevron(-1), emissive: 0x2a2200 }) };
    var geoChev = new T.PlaneGeometry(1.1, 1.1);
    R.curvas.forEach(function (cv) {
      var fora = -cv.dir; // curva à direita: lado de fora é a esquerda
      for (var s2 = cv.s0 - 30; s2 < cv.s1 + 10; s2 += 8) {
        var ii = Math.round(s2 / DS); if (ii < 1 || ii >= R.n) continue;
        var p2 = ponto(ii, fora * 6.2), b2 = blocos[Math.floor(s2 / BLOCO)];
        b2.poste.push([p2.x, R.y[ii] - 0.25, p2.z, 0.85, 1, p2.th]);
        b2.refl.push([p2.x, R.y[ii] + 0.8, p2.z, 1, 1, p2.th]);
      }
      if (cv.sev >= 2) {
        for (var s3 = cv.s0 + 4; s3 < cv.s1; s3 += cv.sev === 3 ? 9 : 14) {
          var i3 = Math.round(s3 / DS); if (i3 >= R.n) continue;
          var p3 = ponto(i3, fora * 7.4);
          var ch = new T.Mesh(geoChev, matsChev[String(cv.dir)]);
          ch.position.set(p3.x, R.y[i3] + 1.6, p3.z);
          // vira para quem vem pela estrada (normal do plano = -frente)
          ch.rotation.y = R.th[i3] + Math.PI;
          var poste = new T.Mesh(geoPoste, matPoste); poste.position.set(p3.x, R.y[i3] - 0.2, p3.z);
          grp.add(ch); grp.add(poste);
        }
      }
    });
    // Monta os instanciados por bloco (cada bloco tem sua esfera para o recorte)
    function inst(geo, mat, lista, tipoEsc) {
      if (!lista.length) return;
      var im = new T.InstancedMesh(geo, mat, lista.length);
      for (var k = 0; k < lista.length; k++) {
        var it = lista[k];
        ps.set(it[0], it[1], it[2]);
        q.setFromAxisAngle(eixoY, it[5]);
        if (tipoEsc === 'tronco') sc.set(it[3], it[4], it[3]);
        else if (tipoEsc === 'copa') sc.set(it[3], it[4], it[3] * (0.8 + (k % 5) * 0.08));
        else if (tipoEsc === 'poste') sc.set(1, it[3], 1);
        else if (tipoEsc === 'card') sc.set(it[3], it[4], it[3]);
        else sc.set(it[3], it[4], it[3]);
        mtx.compose(ps, q, sc);
        im.setMatrixAt(k, mtx);
      }
      im.computeBoundingSphere();
      im.castShadow = tipoEsc !== 'refl' && tipoEsc !== 'capim'; im.receiveShadow = true;
      grp.add(im);
    }
    blocos.forEach(function (bl) {
      inst(geoTronco, matTronco, bl.tronco, 'tronco');
      inst(geoCopaC, matFolha, bl.copa, 'card');
      inst(geoTronco, matTronco2, bl.tronco2, 'tronco');
      inst(geoCopaC, matFolha2, bl.copa2, 'card');
      inst(geoCanaC, matCanaC, bl.cana, 'cana');
      inst(geoCapim, matCapim, bl.capim, 'capim');
      inst(geoPoste, matPoste, bl.poste, 'poste');
      inst(geoRefl, matRefl, bl.refl, 'refl');
      inst(geoRefl, matBalz, bl.balz, 'refl');
    });
    // Arame da cerca (duas linhas) nos trechos de pasto
    var arame = [];
    for (i = 2; i < R.n - 3; i += 2) {
      if (trechoEm(i * DS) !== 'pasto' || i * DS > R.fim) continue;
      for (var ld = -1; ld <= 1; ld += 2) {
        var a1 = ponto(i, ld * BARREIRA), a2 = ponto(i + 2, ld * BARREIRA);
        if (!livre(a1.x, a1.z, BARREIRA - 0.5)) continue;
        for (var hh = 0; hh < 2; hh++) {
          var yy = 0.55 + hh * 0.45;
          arame.push(a1.x, R.y[i] - 0.3 + yy, a1.z, a2.x, R.y[i + 2] - 0.3 + yy, a2.z);
        }
      }
    }
    if (arame.length) {
      var ga = new T.BufferGeometry(); ga.setAttribute('position', new T.Float32BufferAttribute(arame, 3));
      grp.add(new T.LineSegments(ga, new T.LineBasicMaterial({ color: 0x55504a })));
    }
    // Cruzes à beira da estrada (perto de curvas fortes)
    var matCruz = new T.MeshLambertMaterial({ color: 0xd8d2c4, emissive: 0x181614 });
    R.curvas.forEach(function (cv) {
      if (cv.sev < 3 || rnd() < 0.4) return;
      var ic = Math.round((cv.s0 + cv.s1) / 2 / DS), pc2 = ponto(ic, -cv.dir * 6.6);
      var cruz = new T.Group();
      var v1 = new T.Mesh(new T.BoxGeometry(0.1, 1.1, 0.06), matCruz); v1.position.y = 0.55;
      var h1 = new T.Mesh(new T.BoxGeometry(0.55, 0.09, 0.06), matCruz); h1.position.y = 0.82;
      cruz.add(v1); cruz.add(h1);
      cruz.position.set(pc2.x, R.y[ic] - 0.25, pc2.z); cruz.rotation.y = R.th[ic] + 0.3;
      grp.add(cruz);
    });
    // Placas de km
    var geoPlaca = new T.PlaneGeometry(1.6, 1);
    for (var km = 1; km <= R.def.km; km++) {
      var ik = Math.round(km * 1000 / DS), pk = ponto(ik, 6.4);
      var placa = new T.Mesh(geoPlaca, new T.MeshLambertMaterial({ map: texPlaca('KM ' + km, km === R.def.km ? 'CAPELA' : R.def.nome.toUpperCase()), emissive: 0x0a1a10 }));
      placa.position.set(pk.x, R.y[ik] + 2.0, pk.z);
      placa.rotation.y = R.th[ik] + Math.PI;
      var pst = new T.Mesh(new T.BoxGeometry(0.1, 2.0, 0.1), matPoste); pst.position.set(pk.x, R.y[ik] + 0.6, pk.z);
      grp.add(placa); grp.add(pst);
    }
    // Obstáculos
    var matTora = new T.MeshLambertMaterial({ color: 0x4a3322 });
    var matPedra = new T.MeshLambertMaterial({ color: 0x6d6862, flatShading: true });
    R.obst.forEach(function (ob) {
      var io = Math.round(ob.s / DS), mid = (ob.lat0 + ob.lat1) / 2, po = ponto(io, mid);
      var g2 = new T.Group();
      if (ob.tipo === 'tronco') {
        var tora = new T.Mesh(new T.CylinderGeometry(0.32, 0.38, MEIA + 1.2, 7), matTora);
        tora.rotation.z = Math.PI / 2; tora.position.y = 0.3;
        g2.add(tora);
        var galho = new T.Mesh(new T.CylinderGeometry(0.06, 0.1, 1.6, 4), matTora);
        galho.position.set(0.6, 0.8, 0.2); galho.rotation.z = 0.7; g2.add(galho);
      } else {
        for (var pdr = 0; pdr < 4; pdr++) {
          var pd = new T.Mesh(new T.DodecahedronGeometry(0.45 + rnd() * 0.4, 0), matPedra);
          pd.position.set(-1.6 + pdr * 1.05, 0.25, (rnd() - 0.5) * 0.8);
          pd.rotation.set(rnd() * 3, rnd() * 3, 0);
          g2.add(pd);
        }
      }
      if (AST && AST.tronco && ob.tipo === 'tronco') {
        g2.clear();
        var tr = AST.tronco.scene.clone(true);
        tr.scale.set(1.75, 2.1, 2.1); tr.position.y = 0.05;
        g2.add(tr);
      } else if (AST && AST.pedra && ob.tipo === 'pedras') {
        g2.clear();
        for (var pr = 0; pr < 3; pr++) {
          var pe = AST.pedra.scene.clone(true), e = 0.45 + rnd() * 0.3;
          pe.scale.set(e, e * (0.7 + rnd() * 0.4), e); pe.rotation.y = rnd() * 6;
          pe.position.set(-1.5 + pr * 1.5 + (rnd() - 0.5) * 0.4, -0.1, (rnd() - 0.5) * 0.8);
          g2.add(pe);
        }
      }
      g2.position.set(po.x, R.y[io], po.z);
      g2.rotation.y = R.th[io];
      grp.add(g2);
    });
    // A capela no fim (o abrigo)
    var ifim = Math.round((R.fim + 40) / DS), pf = ponto(Math.min(ifim, R.n - 1), 0);
    var capela = new T.Group();
    var matCal = new T.MeshStandardMaterial({ color: 0x5f5a53, roughness: 0.95, metalness: 0 });
    var corpo = new T.Mesh(new T.BoxGeometry(9, 6, 12), matCal); corpo.position.y = 3; capela.add(corpo);
    var tel = new T.Mesh(new T.ConeGeometry(8.7, 3.4, 4), new T.MeshLambertMaterial({ color: 0x6a2a1c })); tel.position.y = 7.7; tel.rotation.y = Math.PI / 4; capela.add(tel);
    var torre = new T.Mesh(new T.BoxGeometry(3, 11, 3), matCal); torre.position.set(0, 5.5, 5.5); capela.add(torre);
    var cruzT = new T.Mesh(new T.BoxGeometry(0.25, 1.6, 0.25), matCruz); cruzT.position.set(0, 12, 5.5); capela.add(cruzT);
    var porta = new T.Mesh(new T.PlaneGeometry(2.4, 3.6), new T.MeshBasicMaterial({ color: 0xc8882e })); porta.position.set(0, 1.8, -6.02); porta.rotation.y = Math.PI; capela.add(porta);
    var luzCap = new T.PointLight(0xffb060, 25, 30, 1.6); luzCap.position.set(0, 2.5, -8); capela.add(luzCap);
    capela.position.set(pf.x, R.y[Math.min(ifim, R.n - 1)] - 0.2, pf.z);
    capela.rotation.y = pf.th;
    grp.add(capela);
  }

  /* ── Carro (hatch de rali, primitivas) ───────────────────────── */
  function montarCarro() {
    var c = new T.Group();
    var ext = new T.Group(); c.add(ext);
    var matLat = new T.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.55, metalness: 0.3 });
    var matPreto = new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.8 });
    var matVidro = new T.MeshStandardMaterial({ color: 0x1a222c, roughness: 0.25, metalness: 0.2 });
    var matSujo = new T.MeshLambertMaterial({ color: 0x5a3a26 });
    var base = new T.Mesh(new T.BoxGeometry(1.76, 0.62, 3.9), matLat); base.position.y = 0.62; ext.add(base);
    var saia = new T.Mesh(new T.BoxGeometry(1.8, 0.22, 3.95), matSujo); saia.position.y = 0.36; ext.add(saia);
    var cab = new T.Mesh(new T.BoxGeometry(1.56, 0.6, 2.0), matVidro); cab.position.set(0, 1.22, -0.35); ext.add(cab);
    var teto = new T.Mesh(new T.BoxGeometry(1.5, 0.08, 1.8), matLat); teto.position.set(0, 1.55, -0.4); ext.add(teto);
    var faixa = new T.Mesh(new T.BoxGeometry(0.35, 0.02, 3.92), new T.MeshStandardMaterial({ color: 0x1b3d6e, roughness: 0.6 })); faixa.position.set(0, 0.94, 0); ext.add(faixa);
    var barra = new T.Mesh(new T.BoxGeometry(1.3, 0.12, 0.12), matPreto); barra.position.set(0, 1.64, 0.35); ext.add(barra);
    var matFarol = new T.MeshBasicMaterial({ color: 0xfff2d0 }); matFarol.color.setRGB(6, 5.4, 4.2);
    var farois = [];
    [-0.55, 0.55].forEach(function (x) { var f = new T.Mesh(new T.BoxGeometry(0.34, 0.14, 0.05), matFarol); f.position.set(x, 0.72, 1.96); f.userData.luz = true; ext.add(f); farois.push(f); });
    [-0.45, -0.15, 0.15, 0.45].forEach(function (x) { var f = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.06, 10), matFarol); f.rotation.x = Math.PI / 2; f.position.set(x, 1.64, 0.43); ext.add(f); });
    G.matLanterna = new T.MeshBasicMaterial({ color: 0x8a0a06 });
    [-0.62, 0.62].forEach(function (x) { var f = new T.Mesh(new T.BoxGeometry(0.32, 0.14, 0.05), G.matLanterna); f.position.set(x, 0.78, -1.96); f.userData.luz = true; f.userData.lanterna = true; ext.add(f); });
    var rodas = [];
    var geoRoda = new T.CylinderGeometry(0.34, 0.34, 0.26, 14); geoRoda.rotateZ(Math.PI / 2);
    [[-0.84, 1.25], [0.84, 1.25], [-0.84, -1.2], [0.84, -1.2]].forEach(function (p) {
      var pivo = new T.Group(); pivo.position.set(p[0], 0.34, p[1]);
      var r = new T.Mesh(geoRoda, matPreto); pivo.add(r);
      var aro = new T.Mesh(new T.BoxGeometry(0.27, 0.12, 0.5), new T.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.4 })); r.add(aro);
      c.add(pivo); rodas.push({ pivo: pivo, roda: r, frente: p[1] > 0 });
    });
    // Interior (câmera de cabine): painel, volante, colunas
    var inter = new T.Group(); c.add(inter);
    var painel = new T.Mesh(new T.BoxGeometry(1.6, 0.22, 0.45), matPreto); painel.position.set(0, 0.92, 0.7); inter.add(painel);
    var capo = new T.Mesh(new T.BoxGeometry(1.7, 0.06, 1.3), new T.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.55, metalness: 0.3, emissive: 0x2a1e06 })); capo.position.set(0, 0.86, 1.35); capo.rotation.x = 0.08; inter.add(capo);
    var volante = new T.Mesh(new T.TorusGeometry(0.17, 0.025, 6, 18), matPreto); volante.position.set(0.36, 0.9, 0.5); volante.rotation.x = -0.35; inter.add(volante);
    var raio = new T.Mesh(new T.BoxGeometry(0.36, 0.04, 0.03), matPreto); volante.add(raio);
    [-0.8, 0.8].forEach(function (x) { var col = new T.Mesh(new T.BoxGeometry(0.05, 0.75, 0.05), matPreto); col.position.set(x, 1.3, 0.62); col.rotation.x = -0.55; col.rotation.z = x > 0 ? 0.18 : -0.18; inter.add(col); });
    var tetoI = new T.Mesh(new T.BoxGeometry(1.6, 0.05, 1.6), matPreto); tetoI.position.set(0, 1.62, -0.2); inter.add(tetoI);
    var conta = new T.Mesh(new T.PlaneGeometry(0.3, 0.1), new T.MeshBasicMaterial({ color: 0xff9a3a })); conta.position.set(0.36, 1.04, 0.62); conta.rotation.x = -0.6; conta.rotation.y = Math.PI; inter.add(conta);
    inter.visible = false;
    // Luzes: faróis (spot) e lanterna (vermelha, ilumina a Mula atrás)
    var spot = new T.SpotLight(0xffe7c0, 2600, 150, 0.5, 0.5, 1.2);
    spot.castShadow = true; spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 90; spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.05;
    spot.position.set(0, 0.78, 2.1); c.add(spot);
    var alvo = new T.Object3D(); alvo.position.set(0, -0.2, 26); c.add(alvo); spot.target = alvo;
    var spot2 = new T.SpotLight(0xfff6e0, 700, 60, 0.95, 0.8, 1.4);
    spot2.position.set(0, 0.95, 2.05); c.add(spot2);
    var alvo2 = new T.Object3D(); alvo2.position.set(0, -1, 9); c.add(alvo2); spot2.target = alvo2;
    // Facho visível dos faróis na neblina
    var matFacho = new T.ShaderMaterial({
      uniforms: { uCor: { value: new T.Color(1.0, 0.86, 0.66) }, uForca: { value: 0.11 } },
      vertexShader: 'varying float vL; varying vec3 vN; varying vec3 vV; void main(){ vL = clamp(position.z, 0.0, 1.0); vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uCor; uniform float uForca; varying float vL; varying vec3 vN; varying vec3 vV; void main(){ float borda = pow(abs(dot(vN, vV)), 1.6); float a = pow(max(1.0 - vL, 0.0), 1.4) * borda * uForca; gl_FragColor = vec4(uCor * a, 1.0); }',
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
    });
    var geoFacho = new T.CylinderGeometry(0.08, 4.2, 1, 20, 1, true);
    geoFacho.translate(0, -0.5, 0); geoFacho.rotateX(-Math.PI / 2 - 0.03);
    [-0.55, 0.55].forEach(function (x) {
      var f = new T.Mesh(geoFacho, matFacho);
      f.position.set(x, 0.72, 2.0); f.scale.set(1, 1, 30);
      f.renderOrder = 5; f.frustumCulled = false; f.castShadow = false; f.userData.semSombra = true;
      ext.add(f);
    });
    G.matFacho = matFacho;
    var lant = new T.PointLight(0xff1a10, 5, 9, 1.6); lant.position.set(0, 0.55, -2.7); c.add(lant);
    G.cena.add(c);
    G.carroReal = usarCarroReal(ext, capo, rodas);
    c.traverse(function (o) { if (o.isMesh && !o.userData.semSombra) { o.castShadow = true; o.receiveShadow = true; } });
    G.carroObj = c; G.carroExt = ext; G.carroInt = inter; G.rodas = rodas; G.volante = volante; G.lantLuz = lant; G.farol = spot;
  }

  // Lataria do modelo real: esconde as primitivas (fica só o que é luz e o facho)
  function usarCarroReal(ext, capo, rodas) {
    if (!(AST && AST.carro)) return false;
    ext.children.forEach(function (o) {
      if (o.isMesh && !o.userData.semSombra && !o.userData.luz) o.visible = false;
      if (o.userData.luz && !o.userData.lanterna) { o.position.y = 0.6; o.position.z = 2.0; o.scale.set(0.7, 0.8, 1); }
      if (o.userData.lanterna) { o.position.y = 0.74; o.position.z = -1.96; o.scale.set(0.6, 0.7, 1); }
    });
    // a barra de faróis do teto não existe no carro real
    ext.children.forEach(function (o) { if (o.userData.luz && o.position.y > 1.2) o.visible = false; });
    rodas.forEach(function (r) { r.pivo.visible = false; });
    var cena = AST.carro.scene.clone(true), nos = {}, novas = [];
    cena.traverse(function (o) { if (o.name) nos[o.name] = o; });
    ['roda_fe', 'roda_fd', 'roda_te', 'roda_td'].forEach(function (n) {
      var w = nos[n]; if (!w) return;
      var piv = new T.Group(); piv.position.copy(w.position);
      w.parent.remove(w); w.position.set(0, 0, 0); piv.add(w); cena.add(piv);
      novas.push({ pivo: piv, roda: w, frente: n.charAt(5) === 'f' });
    });
    cena.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 0.7; } });
    ext.add(cena);
    // cabine: o capô de primitiva assume a cor do carro real (os vidros do modelo são opacos por dentro)
    capo.material.color.setHex(0x6e2620); capo.material.emissive.setHex(0x1a0605); capo.material.metalness = 0.15;
    if (novas.length === 4) { rodas.length = 0; novas.forEach(function (x) { rodas.push(x); }); }
    return true;
  }

  /* ── Mula sem cabeça (primitivas) ─────────────────────────────
     Corpo de mula escuro; no lugar da cabeça, o pescoço cortado solta
     fogo (partículas em espaço de mundo: viram um rastro atrás dela). */
  function montarMula() {
    var m = new T.Group();
    var corpoG = new T.Group(); m.add(corpoG);
    var mat = new T.MeshStandardMaterial({ color: 0x2b1e16, roughness: 0.8, metalness: 0.05, emissive: 0x120402 });
    var matBrasa = new T.MeshBasicMaterial({ color: 0xff7a1a });
    var corpo = new T.Mesh(new T.CapsuleGeometry(0.52, 1.5, 4, 10), mat); corpo.rotation.x = Math.PI / 2; corpo.position.y = 1.5; corpoG.add(corpo);
    var peito = new T.Mesh(new T.SphereGeometry(0.6, 10, 8), mat); peito.position.set(0, 1.55, 0.75); corpoG.add(peito);
    var anca = new T.Mesh(new T.SphereGeometry(0.62, 10, 8), mat); anca.position.set(0, 1.6, -0.75); corpoG.add(anca);
    var pescoco = new T.Group(); pescoco.position.set(0, 1.75, 1.0); pescoco.rotation.x = 0.75; corpoG.add(pescoco);
    var pesc = new T.Mesh(new T.CylinderGeometry(0.3, 0.42, 1.1, 9), mat); pesc.position.y = 0.5; pescoco.add(pesc);
    var toco = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.05, 9), matBrasa); toco.position.y = 1.06; pescoco.add(toco);
    var ponta = new T.Object3D(); ponta.position.y = 1.15; pescoco.add(ponta);
    var cauda = new T.Mesh(new T.ConeGeometry(0.12, 1.1, 5), mat); cauda.position.set(0, 1.45, -1.55); cauda.rotation.x = -2.5; corpoG.add(cauda);
    // Pernas: quadril -> coxa -> joelho -> canela -> casco
    var pernas = [];
    var geoCoxa = new T.CylinderGeometry(0.16, 0.11, 0.8, 6); geoCoxa.translate(0, -0.4, 0);
    var geoCanela = new T.CylinderGeometry(0.08, 0.07, 0.72, 6); geoCanela.translate(0, -0.36, 0);
    var geoCasco = new T.CylinderGeometry(0.1, 0.12, 0.12, 8);
    var matCasco = new T.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.7, roughness: 0.35 });
    [[-0.3, 0.75, 0], [0.3, 0.75, 0.12], [-0.3, -0.75, 0.55], [0.3, -0.75, 0.67]].forEach(function (p) {
      var quad = new T.Group(); quad.position.set(p[0], 1.55, p[1]); corpoG.add(quad);
      var coxa = new T.Mesh(geoCoxa, mat); quad.add(coxa);
      var joelho = new T.Group(); joelho.position.y = -0.8; quad.add(joelho);
      var can = new T.Mesh(geoCanela, mat); joelho.add(can);
      var casco = new T.Mesh(geoCasco, matCasco); casco.position.y = -0.74; joelho.add(casco);
      pernas.push({ quad: quad, joelho: joelho, fase: p[2], tras: p[1] < 0 });
    });
    // Brilho do fogo (sprite) e a luz laranja que ela joga na estrada
    var brilho = new T.Sprite(new T.SpriteMaterial({ map: G.tex.brilhoFogo, color: 0xff9a40, blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    brilho.scale.set(3.2, 3.2, 1); G.cena.add(brilho);
    var luz = new T.PointLight(0xff7a28, 220, 60, 1.5); G.cena.add(luz);
    // Luz do fogo apontada para o carro: joga a sombra do carro para a frente na estrada
    var luzSombra = new T.SpotLight(0xff8a30, 0, 70, 0.75, 0.6, 1.4);
    luzSombra.castShadow = true; luzSombra.shadow.camera.near = 0.5; luzSombra.shadow.camera.far = 70; luzSombra.shadow.bias = -0.0005; luzSombra.shadow.normalBias = 0.05;
    G.cena.add(luzSombra); G.cena.add(luzSombra.target);
    G.mulaSombra = luzSombra;
    m.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    G.cena.add(m);
    G.mulaObj = m; G.mulaCorpo = corpoG; G.mulaPernas = pernas; G.mulaPonta = ponta; G.mulaBrilho = brilho; G.mulaLuz = luz; G.mulaPescoco = pescoco;
    usarMulaReal(m, corpoG);
  }

  /* ── Mula do modelo real: malha com esqueleto; o galope é feito aqui ── */
  var OSSOS = {
    // [nome no glTF, papel]
    upper_armL_38: 'ombroE', forearmL_37: 'anteE', handL_36: 'canelaDE', f_toeL_35: 'cascoDE',
    upper_armR_44: 'ombroD', forearmR_43: 'anteD', handR_42: 'canelaDD', f_toeR_41: 'cascoDD',
    thighL_56: 'coxaE', shinL_55: 'pernaE', footL_54: 'canelaTE', r_toeL_53: 'cascoTE',
    thighR_61: 'coxaD', shinR_60: 'pernaD', footR_59: 'canelaTD', r_toeR_58: 'cascoTD',
    spine010_34: 'pesc1', spine011_31: 'pesc2', spine012_28: 'pesc3', spine014_25: 'pesc4', spine015_22: 'toco',
    spine004_5: 'rabo1', spine003_4: 'rabo2', spine002_3: 'rabo3', spine001_2: 'rabo4', spine_1: 'rabo5',
    spine005_64: 'quadril', spine009_48: 'peito', spine007_51: 'lombo'
  };
  function usarMulaReal(m, corpoG) {
    if (!(AST && AST.mula)) return false;
    var g = AST.mula.scene;
    var ossos = {}, malhas = [];
    g.traverse(function (o) {
      if (o.isBone && OSSOS[o.name]) { ossos[OSSOS[o.name]] = o; o.userData.q0 = o.quaternion.clone(); }
      if (o.isMesh) {
        malhas.push(o);
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        var nome = (o.material && o.material.name) || '';
        if (nome === 'toco') { var mb = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }); mb.color.setRGB(5, 1.5, 0.25); o.material = mb; }
        else o.material = new T.MeshStandardMaterial({ color: 0x241811, roughness: 0.45, metalness: 0, emissive: 0x0c0302, envMapIntensity: 0.8, side: T.DoubleSide });
      }
    });
    if (!ossos.toco || !ossos.ombroE || !ossos.coxaE) return false;
    // esconde as primitivas
    corpoG.children.forEach(function (o) { o.visible = false; });
    // orienta: do quadril para o pescoço = +Z; escala para 2,4 m de comprimento; cascos no chão
    var ajuste = new T.Group(); ajuste.add(g);
    var piv = new T.Group(); piv.add(ajuste); m.add(piv);
    g.updateMatrixWorld(true);
    var a = new T.Vector3(), b = new T.Vector3();
    ossos.coxaE.getWorldPosition(a); ossos.toco.getWorldPosition(b);
    ajuste.rotation.y = -Math.atan2(b.x - a.x, b.z - a.z);
    ajuste.updateMatrixWorld(true);
    var caixa = new T.Box3().setFromObject(g, true), tam = new T.Vector3(); caixa.getSize(tam);
    var esc = 2.45 / Math.max(tam.z, 0.01);
    ajuste.scale.setScalar(esc);
    ajuste.updateMatrixWorld(true);
    caixa.setFromObject(g, true);
    var cz = (caixa.min.z + caixa.max.z) / 2;
    // pivô do corpo nos cascos de trás (para empinar), 0,8 m atrás do centro
    piv.position.set(0, 0, -0.8);
    ajuste.position.set(-(caixa.min.x + caixa.max.x) / 2, -caixa.min.y, 0.8 - cz);
    G.mulaCorpo = piv; G.mulaBaseZ = piv.position.z;
    G.mulaOssos = ossos;
    var ponta = new T.Object3D();
    ossos.toco.add(ponta);
    // o eixo Y do osso aponta ao longo do pescoço: sai uns 25 cm do corte
    ponta.position.set(0, 0.25 / Math.max(0.0001, ossos.toco.getWorldScale(new T.Vector3()).y), 0);
    G.mulaPonta = ponta;
    return true;
  }
  // Galope transverso (4 tempos), osso por osso. Ângulos em radianos, girando no eixo X local
  // de cada osso (o eixo de dobra das pernas nesse esqueleto).
  var GAL = { ombro: 0.6, ante: -1.5, canelaD: 0.9, cascoD: 0.6, coxa: 0.5, perna: 0.9, canelaT: -0.9, cascoT: 0.3,
    fases: { E_t: 0.0, D_t: 0.12, E_d: 0.5, D_d: 0.62 }, apoio: 0.42 };
  var _qx = null;
  function girarX(o, ang) {
    if (!o) return;
    if (!_qx) _qx = new T.Quaternion();
    _qx.setFromAxisAngle(_eixoX, ang);
    o.quaternion.copy(o.userData.q0).multiply(_qx);
  }
  var _eixoX = null;
  function animarOssos(f, emp) {
    var O = G.mulaOssos;
    if (!_eixoX) _eixoX = new T.Vector3(1, 0, 0);
    var ciclo = f / (Math.PI * 2);
    function perna(fase, A, osso1, osso2, osso3, osso4, k2, k3, k4) {
      var u = ciclo + fase; u -= Math.floor(u);
      var ap = GAL.apoio, giro, dobra;
      if (u < ap) { giro = lerp(A, -A, u / ap); dobra = 0.08; }
      else { var sw = (u - ap) / (1 - ap); giro = -A + 2 * A * (0.5 - 0.5 * Math.cos(Math.PI * sw)); dobra = Math.sin(Math.PI * Math.min(1, sw * 1.15)); }
      girarX(osso1, giro * emp);
      girarX(osso2, k2 * dobra * emp);
      girarX(osso3, k3 * dobra * emp);
      girarX(osso4, k4 * (dobra - 0.15) * emp);
    }
    var F = GAL.fases;
    perna(F.E_t, GAL.coxa, O.coxaE, O.pernaE, O.canelaTE, O.cascoTE, GAL.perna, GAL.canelaT, GAL.cascoT);
    perna(F.D_t, GAL.coxa, O.coxaD, O.pernaD, O.canelaTD, O.cascoTD, GAL.perna, GAL.canelaT, GAL.cascoT);
    perna(F.E_d, GAL.ombro, O.ombroE, O.anteE, O.canelaDE, O.cascoDE, GAL.ante, GAL.canelaD, GAL.cascoD);
    perna(F.D_d, GAL.ombro, O.ombroD, O.anteD, O.canelaDD, O.cascoDD, GAL.ante, GAL.canelaD, GAL.cascoD);
    // pescoço balança contra o corpo; rabo levantado e solto
    var balanco = Math.sin(f + 0.6);
    girarX(O.pesc1, balanco * 0.1 * emp + (mula.pescoco || 0));
    girarX(O.pesc2, balanco * 0.08 * emp);
    girarX(O.lombo, Math.sin(f * 2) * 0.03 * emp);
    var rab = ['rabo1', 'rabo2', 'rabo3', 'rabo4', 'rabo5'];
    for (var i = 0; i < rab.length; i++) girarX(O[rab[i]], (GAL.rabo != null ? GAL.rabo : -0.32) * emp + Math.sin(f * 2 - i * 0.7) * 0.09 * emp);
  }

  /* ── Passe final: grão, vinheta, aberração, perigo, retrovisor ─── */
  function montarPos() {
    G.cenaPos = new T.Scene();
    G.camPos = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    G.matPos = new T.ShaderMaterial({
      uniforms: {
        tCena: { value: null }, tEsp: { value: null }, tBloom: { value: null }, uT: { value: 0 }, uPerigo: { value: 0 }, uFlash: { value: 0 },
        uEsp: { value: 1 }, uEstatica: { value: 0 }, uRet: { value: new T.Vector4(0.37, 0.80, 0.63, 0.94) }, uRes: { value: new T.Vector2(1280, 720) }, uPreto: { value: 0 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: [
        'uniform sampler2D tCena; uniform sampler2D tEsp; uniform sampler2D tBloom; uniform float uT, uPerigo, uFlash, uEsp, uPreto, uEstatica; uniform vec4 uRet; uniform vec2 uRes;',
        'varying vec2 vUv;',
        'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }',
        'void main(){',
        '  vec2 uv = vUv;',
        '  uv.x += sin(uv.y*170.0 + uT*7.0) * 0.0012 * uPerigo * uPerigo;',
        '  vec2 d = uv - 0.5; float r2 = dot(d,d);',
        '  float ab = 0.002 + uPerigo*0.009;',
        '  vec3 c = vec3(texture2D(tCena, uv + d*ab).r, texture2D(tCena, uv).g, texture2D(tCena, uv - d*ab).b);',
        '  if (uEsp > 0.5 && uv.x > uRet.x && uv.x < uRet.z && uv.y > uRet.y && uv.y < uRet.w) {',
        '    vec2 m = (uv - uRet.xy) / (uRet.zw - uRet.xy);',
        '    vec2 e = abs(m - 0.5) * 2.0; float borda = max(e.x, e.y);',
        '    vec3 ce = texture2D(tEsp, vec2(1.0 - m.x, m.y)).rgb * 1.05;',
        '    c = borda > 0.93 ? vec3(0.02) : mix(ce, ce*0.6, smoothstep(0.6, 0.93, borda));',
        '  }',
        '  c += texture2D(tBloom, uv).rgb * 0.9;',
        '  c = c * vec3(1.03, 0.96, 1.07);',
        '  #ifdef TONE_MAPPING',
        '  c = toneMapping(c);',
        '  #endif',
        '  float l = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(l), c, 0.82);',
        '  float g = h(uv*uRes + fract(uT*13.7)*91.0) - 0.5;',
        '  c += g * (0.04 + uPerigo*0.06);',
        '  c *= 0.965 + 0.035*sin(uv.y*uRes.y*1.3 + uT*30.0);',
        '  float vig = smoothstep(0.75, 0.12, r2*2.1);',
        '  c *= mix(0.32, 1.0, vig);',
        '  c = mix(c, vec3(0.5,0.0,0.02), (1.0 - vig) * uPerigo * 0.62);',
        '  c = mix(c, vec3(1.0,0.55,0.18), uFlash);',
        '  if (uEstatica > 0.5) {',
        '    float n = h(floor(uv*uRes/2.0) + fract(uT*61.0)*317.0);',
        '    float faixa = step(0.92, fract(uv.y*7.0 - uT*9.0));',
        '    c = vec3(n*0.85 + faixa*0.25);',
        '  }',
        '  c *= 1.0 - uPreto;',
        '  gl_FragColor = vec4(c, 1.0);',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });
    var quad = new T.Mesh(new T.PlaneGeometry(2, 2), G.matPos);
    quad.frustumCulled = false;
    G.cenaPos.add(quad);
    G.rtCena = null; G.rtEsp = null;
    // Bloom: separa o que passa do branco, borra em 1/4 da resolução e soma no passe final
    var vs = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';
    G.matLimiar = new T.ShaderMaterial({ uniforms: { tMapa: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D tMapa; varying vec2 vUv; void main(){ vec3 c = texture2D(tMapa, vUv).rgb; if (!(c.r == c.r && c.g == c.g && c.b == c.b)) c = vec3(0.0); c = clamp(c, 0.0, 60.0); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.9, 2.2, l), 1.0); }' });
    G.matBorrao = new T.ShaderMaterial({ uniforms: { tMapa: { value: null }, uDir: { value: new T.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D tMapa; uniform vec2 uDir; varying vec2 vUv; void main(){ vec3 c = texture2D(tMapa, vUv).rgb * 0.227;' +
        ' c += (texture2D(tMapa, vUv + uDir*1.385).rgb + texture2D(tMapa, vUv - uDir*1.385).rgb) * 0.316;' +
        ' c += (texture2D(tMapa, vUv + uDir*3.231).rgb + texture2D(tMapa, vUv - uDir*3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }' });
    G.cenaPasse = new T.Scene();
    G.quadPasse = new T.Mesh(new T.PlaneGeometry(2, 2), G.matLimiar);
    G.quadPasse.frustumCulled = false;
    G.cenaPasse.add(G.quadPasse);
    G.rtB1 = null; G.rtB2 = null;
  }
  function tamanhoRT(w, h) {
    var esc = cfg.grafico === 'alto' ? 1 : cfg.grafico === 'medio' ? 0.72 : 0.5;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var rw = Math.max(320, Math.round(w * dpr * esc)), rh = Math.max(180, Math.round(h * dpr * esc));
    var opts = { type: T.HalfFloatType, depthBuffer: true };
    if (!G.rtCena) { G.rtCena = new T.WebGLRenderTarget(rw, rh, opts); G.rtEsp = new T.WebGLRenderTarget(Math.round(rw * 0.3), Math.round(rw * 0.3 / 3), opts); }
    else { G.rtCena.setSize(rw, rh); G.rtEsp.setSize(Math.round(rw * 0.3), Math.round(rw * 0.3 / 3)); }
    G.matPos.uniforms.uRes.value.set(rw, rh);
    var bw = Math.max(80, Math.round(rw / 4)), bh = Math.max(45, Math.round(rh / 4));
    if (!G.rtB1) { G.rtB1 = new T.WebGLRenderTarget(bw, bh, { type: T.HalfFloatType, depthBuffer: false }); G.rtB2 = G.rtB1.clone(); }
    else { G.rtB1.setSize(bw, bh); G.rtB2.setSize(bw, bh); }
    G.bloomTam = [bw, bh];
    // sombras por nível de gráfico
    var somb = cfg.grafico !== 'leve';
    G.renderer.shadowMap.enabled = somb;
    G.farol.castShadow = somb;
    var tam = cfg.grafico === 'alto' ? 2048 : 1024;
    if (G.farol.shadow.mapSize.x !== tam) { G.farol.shadow.mapSize.set(tam, tam); if (G.farol.shadow.map) { G.farol.shadow.map.dispose(); G.farol.shadow.map = null; } }
    G.sombraMula = cfg.grafico === 'alto';
    G.fogo.mat.uniforms.uEscala.value = rh * 0.9;
    G.poeira.mat.uniforms.uEscala.value = rh * 0.9;
    G.nev.mat.uniforms.uEscala.value = rh * 0.9;
  }

  /* ══════════════════════════════════════════════════════════════
     FÍSICA DO CARRO (arcade)
     - Sem drift: a direção da velocidade segue o bico do carro até o
       limite de aderência lateral (ACEL_LAT). Passou disso, o carro
       escorrega pra fora da curva.
     - Drift (Espaço): o bico gira mais e a velocidade é "arrastada" para
       o bico a uma taxa fixa — é assim que se faz curva forte rápido.
  ══════════════════════════════════════════════════════════════ */
  var CARRO = { vmax: 41, acel: 9.5, freio: 17, re: 7, acelLat: 12.5, driftGiro: 1.4, driftPerda: 1.3 };
  var _p = { x: 0, z: 0, y: 0, th: 0 };

  function projetar(c) {
    // amostra mais próxima perto da anterior
    var best = 1e18, bi = c.idx;
    var a = Math.max(0, c.idx - 12), b = Math.min(R.n - 1, c.idx + 24);
    for (var i = a; i <= b; i++) {
      var dx = c.x - R.x[i], dz = c.z - R.z[i], d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    c.idx = bi;
    var th = R.th[bi], fx = Math.sin(th), fz = Math.cos(th);
    var dx2 = c.x - R.x[bi], dz2 = c.z - R.z[bi];
    var ao = dx2 * fx + dz2 * fz;
    c.s = bi * DS + ao;
    c.lat = dx2 * -Math.cos(th) + dz2 * Math.sin(th);
    pontoEm(R, c.s, _p);
    c.y = _p.y + 0.06 + (Math.abs(c.lat) > MEIA ? -suave(MEIA, 5.5, Math.abs(c.lat)) * 0.3 : 0);
    c.thPista = _p.th;
  }

  function passoFisica(c, dt) {
    var fx = Math.sin(c.psi), fz = Math.cos(c.psi);
    var vf = c.vx * fx + c.vz * fz;               // velocidade para frente
    var rx = -fz, rz = fx;                        // direita
    var vl = c.vx * rx + c.vz * rz;               // lateral
    var v = Math.sqrt(c.vx * c.vx + c.vz * c.vz);
    var drift = c.driftT > 0 && v > 6;
    var fora = Math.abs(c.lat) > MEIA + 0.3;
    c.foraPista = fora;
    // Volante: mais leve em baixa velocidade, menos curso em alta
    var alvo = (ent.dir - ent.esq) * (1 - 0.3 * clamp(v / CARRO.vmax, 0, 1));
    var taxa = Math.abs(alvo) > Math.abs(c.volante) ? 4.2 : 6.5;
    c.volante += clamp(alvo - c.volante, -taxa * dt, taxa * dt);
    // Giro do bico
    var giroMax = Math.min(Math.abs(vf) * 0.105, 1.15) * (drift ? 1.55 : 1);
    var giro = c.volante * giroMax * (vf < 0 ? -1 : 1);
    c.psi -= giro * dt;
    // Motor e freio
    var a = 0;
    var acel = cfg.autoAcel && !ent.freio ? 1 : ent.acel;
    c.acel = acel;
    c.freando = ent.freio > 0;
    if (ent.freio) {
      if (vf > 0.5) a -= CARRO.freio;
      else a -= CARRO.re;
    } else if (acel) {
      var fr = clamp(vf / CARRO.vmax, 0, 1);
      a += CARRO.acel * (1 - fr * fr * 0.92) * (vf < 0 ? 2 : 1);
    }
    a -= vf * 0.035 + (vf > 0 ? 0.25 : -0.25);          // arrasto e rolagem
    if (fora) a -= vf * 0.55;                            // mato segura
    if (drift) a -= CARRO.driftPerda * (vf > 0 ? 1 : 0);
    // subida/descida
    var iA = Math.min(R.n - 2, c.idx), incl = (R.y[iA + 1] - R.y[iA]) / DS;
    a -= 9.8 * incl * 0.6;
    if (!ent.freio && !acel && Math.abs(vf) < 0.4) { vf = 0; a = 0; }
    vf += a * dt;
    if (ent.freio && vf < 0 && vf < -CARRO.re * 0.8) vf = -CARRO.re * 0.8;
    // Aderência lateral
    var aderencia = fora ? 6.5 : CARRO.acelLat;
    var maxDelta;
    if (drift) {
      // arrasta a velocidade para o bico a uma taxa angular fixa
      maxDelta = CARRO.driftGiro * Math.max(v, 1) * dt * (fora ? 0.6 : 1);
    } else maxDelta = aderencia * dt;
    var dvl = clamp(-vl, -maxDelta, maxDelta);
    vl += dvl;
    // parte do deslize volta como velocidade para frente (arcade)
    if (drift && vf > 0) vf += Math.abs(dvl) * 0.22;
    c.deslize = Math.abs(vl);
    // Rodou: deslize maior que a própria velocidade para frente
    if (Math.abs(vl) > 9 && Math.abs(vl) > Math.abs(vf) * 1.2) {
      vf *= Math.pow(0.25, dt); vl *= Math.pow(0.3, dt);
      if (!c.rodouAviso) { c.rodouAviso = true; aviso('RODOU!', 'perigo'); }
    } else if (Math.abs(vl) < 3) c.rodouAviso = false;
    c.vx = fx * vf + rx * vl;
    c.vz = fz * vf + rz * vl;
    c.vel = vf;
    c.x += c.vx * dt; c.z += c.vz * dt;
    if (c.driftT > 0) c.driftT -= dt;
    c.batidaT = Math.max(0, c.batidaT - dt);
  }

  // Batida: cerca/árvore além da BARREIRA, ou obstáculo na pista
  function colisoes(c) {
    var al = Math.abs(c.lat);
    if (al > BARREIRA - 0.9) {
      var lado = c.lat > 0 ? 1 : -1;
      var th = c.thPista, rx = -Math.cos(th), rz = Math.sin(th);
      // empurra de volta e zera a componente que ia pra fora
      var pen = al - (BARREIRA - 0.9);
      c.x -= rx * lado * pen; c.z -= rz * lado * pen;
      var vlat = c.vx * rx + c.vz * rz;
      if (vlat * lado > 0) { c.vx -= rx * vlat * 1.3; c.vz -= rz * vlat * 1.3; }
      if (c.batidaT <= 0 && Math.abs(c.vel) > 6) bater(c, clamp(Math.abs(vlat) / 10 + Math.abs(c.vel) / 40, 0.35, 1));
      // alinha um pouco o bico com a estrada
      var dif = angDif(c.thPista, c.psi);
      c.psi += dif * 0.08;
    }
    for (var i = 0; i < R.obst.length; i++) {
      var ob = R.obst[i];
      if (ob.batido && ob.batido > tempoGlobal - 1) continue;
      if (Math.abs(c.s - ob.s) < 1.6 && c.lat > ob.lat0 - 0.85 && c.lat < ob.lat1 + 0.85) {
        ob.batido = tempoGlobal;
        bater(c, 0.9);
        // joga o carro para o lado livre
        var lado2 = ob.lado < 0 ? 1 : -1, th2 = c.thPista;
        c.vx += -Math.cos(th2) * lado2 * 3; c.vz += Math.sin(th2) * lado2 * 3;
      }
    }
  }
  function angDif(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function bater(c, forca) {
    c.batidaT = 0.6;
    var k = 1 - 0.55 * forca;
    c.vx *= k; c.vz *= k;
    corrida.batidas++;
    corrida.tremor = Math.max(corrida.tremor, 0.6 * forca + 0.3);
    som.batida(forca);
    aviso('BATEU!', 'perigo');
    vibrar(forca > 0.7 ? 120 : 60);
  }
  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ══════════════════════════════════════════════════════════════
     MULA — distância (gap)
  ══════════════════════════════════════════════════════════════ */
  function passoMula(dt) {
    var d = R.def, p = clamp(carro.s / R.fim, 0, 1);
    var base = lerp(d.mulaIni, d.mulaFim, p);
    // largada: ela acelera aos poucos
    base *= clamp(mula.tCorrida / 3.5, 0, 1);
    // Investida: de tempos em tempos ela acelera por alguns segundos
    mula.proxInv -= dt;
    if (mula.proxInv <= 0 && mula.invT <= 0 && carro.s < R.fim - 300) {
      mula.invT = 4.5; mula.proxInv = 32 + Math.random() * 28;
      som.rasga(); aviso('ELA ACELEROU!', 'perigo');
    }
    if (mula.invT > 0) { mula.invT -= dt; base += 3.6; mula.surto = Math.max(mula.surto, 0.15); }
    var vCarro = Math.max(0, carro.vel);
    var vm;
    if (vCarro > base) vm = base + (vCarro - base) * 0.88;   // acompanha, cede pouco
    else vm = base;
    if (mula.gap > GAP_MAX) vm = Math.max(vm, vCarro + 2);
    mula.vel = vm;
    mula.gap += (vCarro - vm) * dt;
    mula.tCorrida += dt;
    if (mula.gap < 22 && !mula.avisouPerto) { mula.avisouPerto = true; som.rasga(); aviso('ELA ESTÁ PERTO', 'perigo'); }
    if (mula.gap > 34) mula.avisouPerto = false;
  }

  var _pm = { x: 0, z: 0, y: 0, th: 0 };
  function posicionarMula(dt) {
    var o = G.mulaObj;
    var sM = carro.s - mula.gap;
    o.visible = true;
    pontoEm(R, Math.max(0, sM), _pm);
    if (sM < 0) { _pm.x += Math.sin(_pm.th) * sM; _pm.z += Math.cos(_pm.th) * sM; }
    // vem pelo meio, puxando para o lado do carro quando chega perto
    if (mula.gap < 12) { if (!mula.lado) mula.lado = carro.lat > 0 ? -1 : 1; }
    else if (mula.gap > 18) mula.lado = 0;
    var latAlvo = mula.lado ? clamp(carro.lat + mula.lado * 2.3, -MEIA - 0.5, MEIA + 0.5) : Math.sin(tempoGlobal * 0.6) * 1.3;
    mula.lat = lerp(mula.lat, latAlvo, dt * 1.8);
    if (mula.gap < 7 && !mula.ferroou && estado === 'correndo') { mula.ferroou = true; som.ferroada(); vibrar(80); }
    if (mula.gap > 16) mula.ferroou = false;
    var rx = -Math.cos(_pm.th), rz = Math.sin(_pm.th);
    o.position.set(_pm.x + rx * mula.lat, _pm.y, _pm.z + rz * mula.lat);
    o.rotation.y = _pm.th;
    if (mula.capo) {
      // em cima do capô, de frente para o para-brisa
      var cfx = Math.sin(carro.psi), cfz = Math.cos(carro.psi);
      o.position.set(carro.x + cfx * mula.capoD, carro.y + mula.capoY, carro.z + cfz * mula.capoD);
      o.rotation.y = carro.psi + Math.PI;
      _pm.th = carro.psi + Math.PI;
    }
    // Galope
    mula.fase += dt * (1.4 + mula.vel * 0.05) * Math.PI * 2;
    if (GAL.fixo != null) mula.fase = GAL.fixo * Math.PI * 2;
    var f = mula.fase, emp = mula.vel > 0.5 ? 1 : 0.15;
    G.mulaCorpo.position.y = Math.abs(Math.sin(f)) * 0.16 * emp;
    G.mulaCorpo.rotation.x = Math.sin(f) * 0.07 * emp + (mula.empina || 0);
    if (G.mulaOssos) { G.mulaCorpo.position.z = G.mulaBaseZ; animarOssos(f, emp); }
    else G.mulaPernas.forEach(function (pn) {
      var ph = f + pn.fase * Math.PI * 2;
      pn.quad.rotation.x = Math.sin(ph) * 0.75 * emp;
      pn.joelho.rotation.x = (pn.tras ? -1 : 1) * Math.max(0, Math.sin(ph + 0.9)) * 1.1 * emp;
    });
    if (!G.mulaOssos) G.mulaPescoco.rotation.x = 0.75 + Math.sin(f * 0.5) * 0.06;
    // Fogo
    G.mulaObj.updateMatrixWorld(true);
    var pw = _pw; G.mulaPonta.getWorldPosition(pw);
    if (mula.capo) {
      // encaixa o toco do pescoço no ponto pedido, à frente dos olhos do motorista
      var ofx = Math.sin(carro.psi), ofz = Math.cos(carro.psi);
      var ex = carro.x + Math.cos(carro.psi) * 0.36 + ofx * 0.05, ez = carro.z - Math.sin(carro.psi) * 0.36 + ofz * 0.05, ey = carro.y + (G.carroReal ? 1.22 : 1.32);
      var alvoX = ex + ofx * mula.capoD, alvoY = ey + mula.capoY, alvoZ = ez + ofz * mula.capoD;
      o.position.x += alvoX - pw.x; o.position.y += alvoY - pw.y; o.position.z += alvoZ - pw.z;
      o.updateMatrixWorld(true);
      G.mulaPonta.getWorldPosition(pw);
    }
    var fdx = Math.sin(_pm.th), fdz = Math.cos(_pm.th);
    if (mula.capo && mula.jorro > 0) {
      var cp = G.cam.position;
      for (var j = 0; j < 10; j++) {
        var ddx = cp.x - pw.x, ddy = cp.y - pw.y, ddz = cp.z - pw.z, dl = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 1;
        var vj = 4 + Math.random() * 5 * mula.jorro;
        G.fogo.emitir(pw.x, pw.y, pw.z, ddx / dl * vj + (Math.random() - 0.5) * 3, ddy / dl * vj + (Math.random() - 0.5) * 3, ddz / dl * vj + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 0.4, 0.5 + Math.random() * 0.9);
      }
    }
    var nEmit = Math.min(8, Math.round(dt * (mula.surto > 0 ? 900 : 260)));
    for (var i = 0; i < nEmit; i++) {
      var sp = mula.surto > 0 ? 4 : 1;
      G.fogo.emitir(pw.x + (Math.random() - 0.5) * 0.3, pw.y + Math.random() * 0.2, pw.z + (Math.random() - 0.5) * 0.3,
        fdx * mula.vel * 0.55 + (Math.random() - 0.5) * 1.6 * sp, 2.2 + Math.random() * 2.5 * sp, fdz * mula.vel * 0.55 + (Math.random() - 0.5) * 1.6 * sp,
        0.45 + Math.random() * 0.5, 0.55 + Math.random() * 0.6 * sp);
    }
    var tremula = 0.75 + Math.sin(tempoGlobal * 31) * 0.12 + Math.sin(tempoGlobal * 17.3) * 0.13 + Math.random() * 0.1;
    G.mulaBrilho.visible = true;
    G.mulaBrilho.position.set(pw.x, pw.y + 0.5, pw.z);
    var esc = 3 * tremula * (mula.surto > 0 ? 2.2 : 1);
    G.mulaBrilho.scale.set(esc, esc * 1.3, 1);
    G.mulaLuz.position.set(pw.x, pw.y + 0.8, pw.z);
    G.mulaLuz.intensity = 240 * tremula * (mula.surto > 0 ? 3 : 1);
    var proxM = clamp(1 - (mula.gap - 3) / 45, 0, 1);
    G.mulaSombra.position.set(pw.x, pw.y + 0.6, pw.z);
    G.mulaSombra.target.position.set(carro.x, carro.y + 0.5, carro.z);
    G.mulaSombra.intensity = (estado === 'titulo' ? 0.35 : proxM) * 420 * tremula;
    G.mulaSombra.castShadow = G.sombraMula && proxM > 0.05;
    if (mula.surto > 0) mula.surto -= dt;
  }

  /* ══════════════════════════════════════════════════════════════
     CORRIDA — estados
  ══════════════════════════════════════════════════════════════ */
  function novaCorrida() {
    return { tempo: 0, km: 0, kmTempos: [0], retries: 2, batidas: 0, tremor: 0, flash: 0, preto: 0, usouRetry: false, tUltPerigo: 0 };
  }

  function posicionarCarroEm(s) {
    pontoEm(R, s, _p);
    carro.x = _p.x; carro.z = _p.z; carro.psi = _p.th; carro.vx = carro.vz = 0; carro.vel = 0;
    carro.idx = Math.round(s / DS); carro.volante = 0; carro.driftT = 0;
    projetar(carro);
  }

  function comecar(retryKm) {
    som.init(); som.retomar();
    if (retryKm == null) {
      corrida = novaCorrida();
      carro = novoCarro();
      posicionarCarroEm(30);
      mula = { gap: GAP_INI, vel: 0, lat: 0, fase: 0, tCorrida: 0, empina: 0, surto: 0, invT: 0, proxInv: 28, capo: false, jorro: 0, lado: 0 };
      R.obst.forEach(function (o) { o.batido = 0; });
    } else {
      corrida.retries--; corrida.usouRetry = true;
      corrida.tempo = corrida.kmTempos[retryKm] + 8;   // 8 s de penalidade
      corrida.km = retryKm;
      corrida.kmTempos.length = retryKm + 1;
      carro = novoCarro();
      posicionarCarroEm(retryKm * 1000 + 6);
      mula = { gap: GAP_RETRY, vel: 0, lat: 0, fase: 0, tCorrida: 0, empina: 0, surto: 0, invT: 0, proxInv: 22, capo: false, jorro: 0, lado: 0 };
    }
    G.fogo.limpar(); G.poeira.limpar(); G.nev.ok = false;
    corrida.flash = 0; corrida.preto = 0; corrida.estatica = 0;
    limparRachas();
    atualizarChao(carro.x, carro.z, true);
    camInstantanea = true;
    mudarEstado('contagem');
    esconderTelas();
    el.hud.style.display = '';
    el.toque.style.display = cfg.toque ? '' : 'none';
    el.palco.classList.toggle('np-com-toque', cfg.toque);
    partida(true);
  }

  function mudarEstado(e) { estado = e; tEstado = 0; }

  function atualizar(dt) {
    tEstado += dt;
    if (estado === 'contagem') {
      var n = 3 - Math.floor(tEstado);
      if (n !== corrida.ultCont) {
        corrida.ultCont = n;
        if (n > 0) { mostrarContagem(String(n)); som.bip(false); }
        else { mostrarContagem('NÃO PARE!'); som.bip(true); }
      }
      if (tEstado >= 3) { mudarEstado('correndo'); setTimeout(function () { mostrarContagem(''); }, 700); }
      // ronco no lugar e Mula parada lá atrás
      carro.acel = (ent.acel || cfg.autoAcel) ? 1 : 0;
      mula.vel = 0;
    } else if (estado === 'correndo') {
      corrida.tempo += dt;
      if (ent.drift) carro.driftT = Math.max(carro.driftT, 0.35);
      var sub = 4, h = dt / sub;
      for (var i = 0; i < sub; i++) { passoFisica(carro, h); projetar(carro); colisoes(carro); }
      passoMula(dt);
      // Placas de km
      var kmAgora = Math.floor(carro.s / 1000);
      if (kmAgora > corrida.km && kmAgora <= R.def.km) {
        corrida.km = kmAgora; corrida.kmTempos[kmAgora] = corrida.tempo;
        if (kmAgora < R.def.km) { som.placa(); aviso('KM ' + kmAgora, 'placa'); }
      }
      if (carro.s >= R.fim) { vencer(); }
      else if (mula.gap <= GAP_PEGA) { pegar(); }
    } else if (estado === 'pego') {
      carro.vx *= Math.pow(0.2, dt); carro.vz *= Math.pow(0.2, dt); carro.vel *= Math.pow(0.2, dt);
      carro.x += carro.vx * dt; carro.z += carro.vz * dt; projetar(carro);
      if (cfg.susto === 'forte') sustoForte(dt);
      else {
        // suave: câmera de lado, a Mula empina por cima do carro
        mula.gap = Math.max(-1.5, mula.gap - dt * 6);
        mula.empina = -Math.min(0.55, tEstado * 1.2);
        corrida.flash = (tEstado < 0.25 ? tEstado * 4 : Math.max(0, 1 - (tEstado - 0.25) * 1.4)) * 0.6;
        corrida.preto = clamp((tEstado - 0.9) * 1.6, 0, 1);
        if (tEstado > 1.7 && !corrida.mostrouFim) { corrida.mostrouFim = true; telaDerrota(); }
      }
    } else if (estado === 'fim') {
      // entra devagar no adro da capela
      carro.vx *= Math.pow(0.3, dt); carro.vz *= Math.pow(0.3, dt); carro.vel *= Math.pow(0.3, dt);
      carro.x += carro.vx * dt; carro.z += carro.vz * dt; projetar(carro);
      mula.gap += dt * 10;
      mula.vel = 0;
    }
    corrida.tremor = Math.max(0, corrida.tremor - dt * 1.6);
  }

  function pegar() {
    mudarEstado('pego');
    corrida.mostrouFim = false;
    corrida.fase = 0;
    partida(false);
    el.toque.style.display = 'none';
    if (cfg.susto === 'forte') {
      // 1) um instante de silêncio, já dentro do carro
      som.silencio(0.4);
      mula.capo = false; mula.jorro = 0;
      el.hud.style.display = 'none';
    } else {
      mula.surto = 1.2;
      som.grito(false);
      vibrar(250);
    }
  }

  /* JUMP SCARE (forte)
     0,00 s  corte para a cabine, silêncio; ela some (está pulando o carro)
     0,32 s  PAM: cai no capô de frente para você, o vidro trinca, grito
     0,32–1,0 s  o pescoço em chamas avança contra o para-brisa, fogo na cara
     1,0 s   segunda trinca; o fogo toma a tela
     1,25 s  estática (o sinal cai) → preto → tela de derrota */
  function sustoForte(dt) {
    var t = tEstado;
    if (corrida.fase === 0) {
      mula.capo = false;
      G.mulaObj.visible = false;
      if (t > 0.32) {
        corrida.fase = 1;
        mula.capo = true; mula.capoD = 3.8; mula.capoY = 1.6; mula.empina = -0.75; mula.surto = 2; mula.jorro = 0;
        mula.vel = 0;
        som.impacto(1); som.grito(true);
        racha(0.5 + (Math.random() - 0.5) * 0.25, 0.35 + Math.random() * 0.15, 0.55);
        corrida.tremor = 2.2; corrida.flash = 0.35;
        vibrar([300, 60, 500]);
      }
    } else if (corrida.fase === 1) {
      var k = clamp((t - 0.32) / 0.68, 0, 1);
      // avança: chega mais perto e abaixa o pescoço para o vidro
      mula.capoD = lerp(3.8, 1.75, suave(0.1, 1, k));
      mula.capoY = lerp(1.6, 0.1, suave(0, 0.9, k)) + Math.sin(t * 40) * 0.03;
      mula.empina = lerp(-0.75, 0.22, suave(0, 0.8, k)) + Math.sin(t * 38) * 0.04;
      mula.jorro = k;
      corrida.flash = Math.max(corrida.flash - dt * 2, k > 0.75 ? (k - 0.75) * 2.4 : 0);
      corrida.tremor = Math.max(corrida.tremor, 1.2);
      if (k >= 1) { corrida.fase = 2; racha(0.42 + Math.random() * 0.16, 0.5, 1); som.trinca(); }
    } else if (corrida.fase === 2) {
      corrida.flash = Math.min(1, corrida.flash + dt * 5);
      mula.jorro = 1;
      if (t > 1.25) { corrida.fase = 3; corrida.estatica = 1; som.estatica(0.45); mula.jorro = 0; }
    } else if (corrida.fase === 3) {
      corrida.flash = 0;
      corrida.estatica = t < 1.7 ? 1 : 0;
      corrida.preto = t < 1.7 ? 0 : 1;
      if (t > 1.85 && !corrida.mostrouFim) {
        corrida.mostrouFim = true;
        mula.capo = false; mula.jorro = 0; corrida.estatica = 0;
        limparRachas();
        telaDerrota();
      }
    }
  }

  // Trinca no para-brisa (desenhada num canvas por cima do jogo)
  function racha(u, v, tam) {
    var c = el.trinca; if (!c) return;
    var w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    var g = c.getContext('2d');
    var cx = u * w, cy = v * h, R0 = Math.min(w, h) * 0.6 * tam;
    c.style.opacity = '1';
    g.lineCap = 'round';
    var raios = 14 + Math.floor(Math.random() * 8), pontas = [];
    for (var i = 0; i < raios; i++) {
      var a = i / raios * Math.PI * 2 + (Math.random() - 0.5) * 0.35, len = R0 * (0.45 + Math.random() * 0.75);
      var x = cx, y = cy, seg = 7 + Math.floor(Math.random() * 5), pts = [[x, y]];
      for (var k = 0; k < seg; k++) {
        a += (Math.random() - 0.5) * 0.45;
        x += Math.cos(a) * len / seg; y += Math.sin(a) * len / seg; pts.push([x, y]);
      }
      pontas.push(pts);
      // sombra escura + fio claro = trinca visível em qualquer fundo
      [['rgba(0,0,0,.55)', 3.2], ['rgba(235,245,255,.9)', 1.3]].forEach(function (est) {
        g.strokeStyle = est[0]; g.lineWidth = est[1];
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (var m = 1; m < pts.length; m++) g.lineTo(pts[m][0], pts[m][1]);
        g.stroke();
      });
    }
    // anéis entre os raios
    for (var anel = 1; anel <= 3; anel++) {
      g.strokeStyle = 'rgba(230,240,255,' + (0.75 - anel * 0.15) + ')'; g.lineWidth = 1.1;
      g.beginPath();
      for (var j = 0; j < pontas.length; j++) {
        var pa = pontas[j], q = pa[Math.min(pa.length - 1, anel * 2)];
        if (j === 0) g.moveTo(q[0], q[1]); else g.lineTo(q[0] + (Math.random() - 0.5) * 6, q[1] + (Math.random() - 0.5) * 6);
      }
      g.closePath(); g.stroke();
    }
    // miolo estilhaçado
    var gr = g.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.12);
    gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R0 * 0.12, 0, 6.3); g.fill();
  }
  function limparRachas() {
    var c = el.trinca; if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    c.style.opacity = '0';
  }

  function vencer() {
    mudarEstado('fim');
    corrida.kmTempos[R.def.km] = corrida.tempo;
    som.vitoria();
    partida(false);
    el.toque.style.display = 'none';
    var sv = lerSave(); sv.rotas = sv.rotas || {};
    var reg = sv.rotas[R.def.id] || {};
    var t = corrida.tempo, med = medalha(R.def, t);
    var novo = !reg.melhor || t < reg.melhor;
    if (novo) reg.melhor = t;
    if (rankMed(med) > rankMed(reg.medalha)) reg.medalha = med;
    reg.chegadas = (reg.chegadas || 0) + 1;
    sv.rotas[R.def.id] = reg; gravarSave(sv);
    setTimeout(function () { telaVitoria(t, med, novo); }, 1400);
  }
  function medalha(d, t) { return t <= d.ouro ? 'ouro' : t <= d.prata ? 'prata' : t <= d.bronze ? 'bronze' : ''; }
  function rankMed(m) { return m === 'ouro' ? 3 : m === 'prata' ? 2 : m === 'bronze' ? 1 : 0; }

  /* ══════════════════════════════════════════════════════════════
     CÂMERA E QUADRO
  ══════════════════════════════════════════════════════════════ */
  var camInstantanea = true;
  var camPos = null, camAlvo = null;
  var _v1 = null, _v2 = null, _pw = null;

  function quadroVisual(dt) {
    var c = carro, o = G.carroObj;
    // Carro
    var vAbs = Math.sqrt(c.vx * c.vx + c.vz * c.vz);
    o.position.set(c.x, c.y, c.z);
    var vlat = c.vx * -Math.cos(c.psi) + c.vz * Math.sin(c.psi);
    c.roll = lerp(c.roll, clamp(-vlat * 0.012 + c.volante * vAbs * 0.0025, -0.09, 0.09), dt * 6);
    c.pitch = lerp(c.pitch, (c.freando ? 0.035 : 0) - c.acel * 0.012, dt * 5);
    o.rotation.set(c.pitch, c.psi, c.roll, 'YXZ');
    c.rodas += c.vel * dt / 0.34;
    G.rodas.forEach(function (r) {
      r.roda.rotation.x = c.rodas;
      if (r.frente) r.pivo.rotation.y = -c.volante * 0.5;
    });
    G.volante.rotation.z = c.volante * 1.6;
    G.matLanterna.color.setRGB(c.freando ? 5 : 1.2, c.freando ? 0.15 : 0.03, c.freando ? 0.08 : 0.02);
    G.lantLuz.intensity = c.freando ? 14 : 5;
    // Poeira vermelha das rodas
    if (vAbs > 5 && estado !== 'titulo') {
      var nP = (c.foraPista || c.deslize > 3) ? 2 : 1;
      if (Math.random() < ((c.foraPista || c.deslize > 3) ? 0.9 : 0.25)) for (var i = 0; i < nP; i++) {
        var lado = Math.random() < 0.5 ? -0.8 : 0.8;
        var bx = c.x - Math.sin(c.psi) * 1.9 - Math.cos(c.psi) * lado, bz = c.z - Math.cos(c.psi) * 1.9 + Math.sin(c.psi) * lado;
        G.poeira.emitir(bx, c.y + 0.25, bz, c.vx * 0.25 + (Math.random() - 0.5) * 2, 0.6 + Math.random(), c.vz * 0.25 + (Math.random() - 0.5) * 2, 0.9 + Math.random() * 0.6, 0.35 + Math.random() * 0.35);
      }
    }
    G.poeira.atualizar(dt, 0.1, 0.9);
    G.fogo.atualizar(dt, 2.2, 1.4);
    posicionarMula(dt);
    atualizarNevoa(dt);
    atualizarChao(c.x, c.z, false);

    // Câmera principal
    var susto = estado === 'pego' && cfg.susto === 'forte';
    var cab = (cfg.camera === 'cabine' && estado !== 'pego' && estado !== 'fim') || susto;
    var olharTras = ent.olharTras && (estado === 'correndo' || estado === 'contagem');
    G.carroExt.visible = !cab;
    G.carroInt.visible = cab;
    var fx = Math.sin(c.psi), fz = Math.cos(c.psi);
    var fov = 64 + clamp(vAbs, 0, 45) * 0.32 + (c.driftT > 0 ? 3 : 0);
    if (cab) {
      _v1.set(0.36, G.carroReal ? 1.22 : 1.32, 0.05).applyEuler(o.rotation).add(o.position);
      _v2.set(0.36 + c.volante * -0.5, G.carroReal ? 1.0 : 1.12, olharTras ? -10 : 10).applyEuler(o.rotation).add(o.position);
      if (susto && mula.capo) {
        // olha para o pescoço em chamas
        G.mulaPonta.getWorldPosition(_pw);
        _v2.lerp(_pw, 0.8);
      }
      camPos.copy(_v1); camAlvo.copy(_v2);
      G.cam.position.copy(camPos);
      fov -= 4;
    } else if (estado === 'pego') {
      // olha para trás, para a Mula chegando
      var mp = G.mulaObj.position;
      _v1.set(c.x + fx * 2.5 - fz * 4.2, c.y + 2.3, c.z + fz * 2.5 + fx * 4.2);
      _v2.set(mp.x, mp.y + 1.8, mp.z);
      camPos.lerp(_v1, Math.min(1, dt * 6)); camAlvo.lerp(_v2, Math.min(1, dt * 8));
      G.cam.position.copy(camPos);
    } else {
      // mira um pouco para dentro da curva (direção da velocidade)
      var dvx = vAbs > 2 ? c.vx / vAbs : fx, dvz = vAbs > 2 ? c.vz / vAbs : fz;
      var mx = lerp(fx, dvx, 0.35), mz = lerp(fz, dvz, 0.35);
      if (olharTras) { mx = -mx; mz = -mz; }
      var dist = 6.2 + clamp(vAbs, 0, 40) * 0.04, alt = olharTras ? 3.4 : 2.35;
      _v1.set(c.x - mx * dist, c.y + alt, c.z - mz * dist);
      _v2.set(c.x + mx * (olharTras ? 14 : 8), c.y + (olharTras ? 0.7 : 1.0), c.z + mz * (olharTras ? 14 : 8));
      var k = camInstantanea ? 1 : Math.min(1, dt * 7.5);
      camPos.lerp(_v1, k); camAlvo.lerp(_v2, Math.min(1, k * 1.4));
      // não deixa a câmera entrar no chão
      var chaoY = relevo(camPos.x, camPos.z);
      if (camPos.y < chaoY + 0.8) camPos.y = chaoY + 0.8;
      G.cam.position.copy(camPos);
    }
    camInstantanea = false;
    // Tremor: batida e perigo
    var perigo = estado === 'correndo' || estado === 'pego' ? clamp(1 - (mula.gap - 4) / 28, 0, 1) : 0;
    var tr = corrida ? corrida.tremor * (susto ? 0.06 : 0.25) + perigo * perigo * 0.05 : 0;
    if (tr > 0) G.cam.position.add(_v1.set((Math.random() - 0.5) * tr, (Math.random() - 0.5) * tr, (Math.random() - 0.5) * tr));
    G.cam.lookAt(camAlvo);
    G.cam.fov = lerp(G.cam.fov, fov, Math.min(1, dt * 3));
    G.cam.updateProjectionMatrix();
    // Céu e lua acompanham a câmera
    G.ceu.position.copy(G.cam.position);
    G.lua.position.set(G.cam.position.x - 260, G.cam.position.y + 210, G.cam.position.z - 320);
    G.luar.position.set(c.x - 200, c.y + 300, c.z - 150); G.luar.target.position.set(c.x, c.y, c.z);
    // Retrovisor: câmera no teto olhando para trás
    _v1.set(0, 1.5, -0.6).applyEuler(o.rotation).add(o.position);
    _v2.set(0, 1.25, -30).applyEuler(o.rotation).add(o.position);
    G.camEsp.position.copy(_v1); G.camEsp.lookAt(_v2);
    // Uniforms do passe final
    var u = G.matPos.uniforms;
    u.uT.value = tempoGlobal;
    u.uPerigo.value = lerp(u.uPerigo.value, perigo, Math.min(1, dt * 3));
    u.uFlash.value = corrida ? corrida.flash : 0;
    u.uPreto.value = corrida ? corrida.preto : 0;
    u.uEstatica.value = corrida && corrida.estatica ? 1 : 0;
    if (susto && corrida.fase >= 1 && corrida.fase < 3) u.uPerigo.value = 1;
    u.uEsp.value = (estado === 'correndo' || estado === 'contagem') && !olharTras ? 1 : 0;
  }

  function renderizar() {
    var r = G.renderer;
    if (G.matPos.uniforms.uEsp.value > 0.5) {
      r.setRenderTarget(G.rtEsp);
      r.render(G.cena, G.camEsp);
    }
    r.setRenderTarget(G.rtCena);
    r.render(G.cena, G.cam);
    // bloom
    var q = G.quadPasse, bw = G.bloomTam[0], bh = G.bloomTam[1];
    q.material = G.matLimiar; G.matLimiar.uniforms.tMapa.value = G.rtCena.texture;
    r.setRenderTarget(G.rtB1); r.render(G.cenaPasse, G.camPos);
    q.material = G.matBorrao;
    for (var i = 0; i < 2; i++) {
      G.matBorrao.uniforms.tMapa.value = G.rtB1.texture; G.matBorrao.uniforms.uDir.value.set((1 + i) / bw, 0);
      r.setRenderTarget(G.rtB2); r.render(G.cenaPasse, G.camPos);
      G.matBorrao.uniforms.tMapa.value = G.rtB2.texture; G.matBorrao.uniforms.uDir.value.set(0, (1 + i) / bh);
      r.setRenderTarget(G.rtB1); r.render(G.cenaPasse, G.camPos);
    }
    G.matPos.uniforms.tBloom.value = G.rtB1.texture;
    r.setRenderTarget(null);
    G.matPos.uniforms.tCena.value = G.rtCena.texture;
    G.matPos.uniforms.tEsp.value = G.rtEsp.texture;
    r.render(G.cenaPos, G.camPos);
  }

  /* ══════════════════════════════════════════════════════════════
     HUD
  ══════════════════════════════════════════════════════════════ */
  var hudCache = {};
  function setTxt(e, k, v) { if (hudCache[k] !== v) { hudCache[k] = v; e.textContent = v; } }
  function proximaCurva() {
    var s = carro.s, melhor = null;
    for (var i = 0; i < R.curvas.length; i++) {
      var cv = R.curvas[i];
      if (cv.s1 < s + 2) continue;
      if (cv.s0 - s > 170) break;
      melhor = cv; break;
    }
    return melhor;
  }
  function atualizarHud() {
    if (!corrida || !carro) return;
    setTxt(el.hTempo, 't', fmtTempo(corrida.tempo));
    setTxt(el.hKm, 'km', fmtKm(clamp(carro.s, 0, R.fim)) + ' / ' + R.def.km + ' km');
    setTxt(el.hVel, 'v', String(Math.round(Math.max(0, carro.vel) * 3.6)));
    // Próxima curva: setas como o teclado do copiloto (<<< forte ... > leve)
    var cv = proximaCurva();
    if (cv && estado !== 'fim') {
      var setas = (cv.dir < 0 ? '<' : '>').repeat(cv.sev);
      var d = Math.max(0, Math.round(cv.s0 - carro.s));
      var cls = 'np-curva np-sev' + cv.sev + (d < 55 ? ' np-perto' : '') + (d === 0 ? ' np-dentro' : '');
      setTxt(el.hCurvaSeta, 'cs', setas);
      setTxt(el.hCurvaDist, 'cd', d > 0 ? d + ' m' : 'AGORA');
      if (hudCache.cc !== cls) { hudCache.cc = cls; el.hCurva.className = cls; }
    } else if (hudCache.cc !== 'np-curva np-oculto') { hudCache.cc = 'np-curva np-oculto'; el.hCurva.className = 'np-curva np-oculto'; }
    // Ferradura: quanto mais cheia, mais perto ela está
    var f = clamp(1 - (mula.gap - GAP_PEGA) / (GAP_INI - GAP_PEGA), 0, 1);
    var fq = Math.round(f * 100);
    if (hudCache.f !== fq) { hudCache.f = fq; el.hPerigoBarra.style.width = fq + '%'; el.hPerigo.classList.toggle('np-alerta', f > 0.6); }
  }
  var avisoT = 0;
  function aviso(txt, tipo) {
    if (!el.aviso) return;
    el.aviso.textContent = txt;
    el.aviso.className = 'np-aviso np-mostra np-' + (tipo || 'info');
    clearTimeout(avisoT);
    avisoT = setTimeout(function () { el.aviso.className = 'np-aviso'; }, 1100);
  }
  function mostrarContagem(t) {
    el.cont.textContent = t;
    el.cont.className = 'np-cont' + (t ? ' np-mostra' : '');
    if (t) { void el.cont.offsetWidth; el.cont.classList.add('np-pulsa'); }
  }

  /* ══════════════════════════════════════════════════════════════
     TELAS (título, ajuda, derrota, vitória)
  ══════════════════════════════════════════════════════════════ */
  function esconderTelas() { el.tela.style.display = 'none'; el.tela.innerHTML = ''; }
  function esconderHud() { el.hud.style.display = 'none'; mostrarContagem(''); }
  function mostrarTela(html, cls) {
    el.tela.className = 'np-tela ' + (cls || '');
    el.tela.innerHTML = html;
    el.tela.style.display = '';
  }
  function medIcone(m) { return m ? '<span class="np-med np-med-' + m + '">' + (m === 'ouro' ? 'Ouro' : m === 'prata' ? 'Prata' : 'Bronze') + '</span>' : ''; }

  function telaTitulo() {
    estado = 'titulo';
    partida(false);
    el.hud.style.display = 'none';
    el.toque.style.display = 'none';
    mostrarContagem('');
    var d = R.def, reg = (lerSave().rotas || {})[d.id] || {};
    mostrarTela(
      '<div class="np-logo">NÃO<br>PARE</div>' +
      '<div class="np-sub">A Mula sem cabeça corre atrás de você. Se parar, ela te alcança.</div>' +
      '<div class="np-rota">' +
        '<div class="np-rota-nome"><i class="fa fa-road"></i> ' + d.nome + ' <span class="np-dif">' + d.dif + ' · ' + d.km + ' km</span></div>' +
        '<div class="np-rota-rec">' + (reg.melhor ? 'Recorde ' + fmtTempo(reg.melhor) + ' ' + medIcone(reg.medalha) : 'Chegue à capela no fim da estrada') + '</div>' +
      '</div>' +
      '<div class="np-botoes">' +
        '<button type="button" class="np-btn np-btn-pri" data-a="dirigir"><i class="fa fa-car"></i> Dirigir</button>' +
        '<button type="button" class="np-btn" data-a="ajuda"><i class="fa fa-circle-question"></i> Como jogar</button>' +
      '</div>', 'np-titulo');
  }

  function telaAjuda() {
    var tq = cfg.toque;
    mostrarTela(
      '<div class="np-h">Como jogar</div>' +
      '<ul class="np-lista">' +
        '<li><b>Não pare.</b> A Mula sem cabeça vem atrás, no ritmo do carro. Se você frear, bater ou rodar, ela encurta a distância.</li>' +
        '<li><b>Drift:</b> segure ' + (tq ? 'o botão <b>DRIFT</b>' : '<b>Espaço</b>') + ' ao entrar na curva para virar sem perder velocidade. Solte para o carro voltar a agarrar.</li>' +
        '<li>O quadro no alto mostra a <b>próxima curva</b>: <b>&lt;</b> leve, <b>&lt;&lt;</b> média, <b>&lt;&lt;&lt;</b> forte.</li>' +
        '<li>A <b>ferradura</b> enche quando ela chega perto. Olhe o retrovisor e escute o galope.</li>' +
        '<li>O mato segura o carro. Troncos e pedras na pista: desvie.</li>' +
        '<li>Cada <b>placa de km</b> é um ponto de volta: se ela te pegar, dá para tentar de novo dali (2 vezes por corrida).</li>' +
      '</ul>' +
      (tq ? '' : '<div class="np-teclas"><span><b>W/↑</b> acelera</span><span><b>S/↓</b> freia</span><span><b>A D / ← →</b> volante</span><span><b>Espaço</b> drift</span><span><b>C</b> olhar para trás</span><span><b>V</b> câmera</span></div>') +
      '<div class="np-botoes"><button type="button" class="np-btn np-btn-pri" data-a="dirigir"><i class="fa fa-car"></i> Dirigir</button>' +
      '<button type="button" class="np-btn" data-a="titulo">Voltar</button></div>' +
      '<div class="np-creditos">Modelos 3D: Mula a partir de "Animated Rigged Horse With Saddle", de ayanahmadbutt (CC BY 4.0, modificado: sem cabeça e sem sela) · ' +
      'carro "Lowpoly Abandoned Simple Car Prop", de rashad-brahimli (CC BY 4.0) · tronco, pedra, texturas e céu: Poly Haven (CC0).</div>', 'np-ajuda');
  }

  function telaDerrota() {
    esconderHud();
    var km = corrida.km, podeRetry = km >= 1 && corrida.retries > 0;
    var onde = fmtKm(clamp(carro.s, 0, R.fim));
    mostrarTela(
      '<div class="np-h np-h-perigo">ELA TE ALCANÇOU</div>' +
      '<div class="np-sub">Km ' + onde + ' · ' + fmtTempo(corrida.tempo) + '</div>' +
      '<div class="np-botoes np-col">' +
        (podeRetry ? '<button type="button" class="np-btn np-btn-pri" data-a="retry"><i class="fa fa-rotate-right"></i> Voltar ao km ' + km + ' <small>(' + corrida.retries + (corrida.retries === 1 ? ' chance' : ' chances') + ')</small></button>' : '') +
        '<button type="button" class="np-btn' + (podeRetry ? '' : ' np-btn-pri') + '" data-a="dirigir"><i class="fa fa-car"></i> Recomeçar do início</button>' +
        '<button type="button" class="np-btn" data-a="titulo">Menu do jogo</button>' +
      '</div>', 'np-derrota');
  }

  function telaVitoria(t, med, novo) {
    esconderHud();
    var d = R.def;
    mostrarTela(
      '<div class="np-h np-h-ok">VOCÊ CHEGOU À CAPELA</div>' +
      '<div class="np-sub">A Mula não entra em chão sagrado.</div>' +
      '<div class="np-tempo-fim">' + fmtTempo(t) + '</div>' +
      '<div class="np-sub">' + (med ? medIcone(med) : 'Sem medalha') + (novo ? ' · <b>novo recorde!</b>' : '') + (corrida.usouRetry ? ' · com volta de km' : '') + '</div>' +
      '<div class="np-metas">Ouro ' + fmtTempo(d.ouro) + ' · Prata ' + fmtTempo(d.prata) + ' · Bronze ' + fmtTempo(d.bronze) + '</div>' +
      '<div class="np-botoes"><button type="button" class="np-btn np-btn-pri" data-a="dirigir"><i class="fa fa-car"></i> Correr de novo</button>' +
      '<button type="button" class="np-btn" data-a="titulo">Menu do jogo</button></div>', 'np-vitoria');
  }

  function aoClicarTela(e) {
    var b = e.target.closest('[data-a]');
    if (!b) return;
    var a = b.getAttribute('data-a');
    som.init(); som.retomar();
    if (a === 'dirigir') comecar(null);
    else if (a === 'retry') comecar(corrida.km);
    else if (a === 'ajuda') telaAjuda();
    else if (a === 'titulo') { preview(); telaTitulo(); }
  }

  // Cena de fundo do título: carro parado na largada, Mula esperando lá atrás
  function preview() {
    carro = novoCarro();
    posicionarCarroEm(30);
    mula = { gap: 34, vel: 0, lat: 0, fase: 0, tCorrida: 0, empina: 0, surto: 0, invT: 0, proxInv: 99, capo: false, jorro: 0, lado: 0 };
    corrida = novaCorrida();
    G.fogo.limpar(); G.poeira.limpar();
    atualizarChao(carro.x, carro.z, true);
    camInstantanea = true;
  }

  /* ══════════════════════════════════════════════════════════════
     DOM
  ══════════════════════════════════════════════════════════════ */
  function montarDom() {
    var root = document.getElementById('naopare-root');
    if (!root) return false;
    el.root = root;
    root.innerHTML =
      '<div class="np-palco">' +
        '<canvas class="np-canvas"></canvas>' +
        '<div class="np-hud" style="display:none">' +
          '<div class="np-topo"><span class="np-tempo">0:00.0</span><span class="np-km">0,0 km</span></div>' +
          '<div class="np-curva np-oculto"><span class="np-curva-seta"></span><span class="np-curva-dist"></span></div>' +
          '<div class="np-vel"><b>0</b><span>km/h</span></div>' +
          '<div class="np-perigo" title="Distância da Mula"><svg viewBox="0 0 24 24" class="np-ferr"><path d="M6 3c-1.8 2.4-2.8 5.3-2.8 8.3 0 5.4 3.8 9.7 8.8 9.7s8.8-4.3 8.8-9.7c0-3-1-5.9-2.8-8.3h-3.3c1.9 2.1 3 4.9 3 7.9 0 3.6-2.5 6.5-5.7 6.5s-5.7-2.9-5.7-6.5c0-3 1.1-5.8 3-7.9z"/></svg><div class="np-perigo-trilho"><div class="np-perigo-barra"></div></div></div>' +
        '</div>' +
        '<canvas class="np-trinca"></canvas>' +
        '<div class="np-aviso"></div>' +
        '<div class="np-cont"></div>' +
        '<div class="np-toque" style="display:none">' +
          '<div class="np-tq-esq"><button type="button" class="np-tq" data-tq="esq" aria-label="Esquerda">◀</button><button type="button" class="np-tq" data-tq="dir" aria-label="Direita">▶</button></div>' +
          '<div class="np-tq-dir">' +
            '<button type="button" class="np-tq np-tq-freio" data-tq="freio">FREIO</button>' +
            '<button type="button" class="np-tq np-tq-drift" data-tq="drift">DRIFT</button>' +
            '<button type="button" class="np-tq np-tq-acel" data-tq="acel">ACEL.</button>' +
          '</div>' +
          '<div class="np-tq-cima"><button type="button" class="np-tq np-tq-mini" data-tq="tras" aria-label="Olhar para trás"><i class="fa fa-rotate-right"></i></button><button type="button" class="np-tq np-tq-mini" data-tq="cam" aria-label="Câmera"><i class="fa fa-camera"></i></button></div>' +
        '</div>' +
        '<div class="np-tela" style="display:none"></div>' +
        '<div class="np-carregando">Ligando o motor…</div>' +
      '</div>';
    var p = root.querySelector('.np-palco');
    el.palco = p;
    el.canvas = p.querySelector('.np-canvas');
    el.hud = p.querySelector('.np-hud');
    el.hTempo = p.querySelector('.np-tempo');
    el.hKm = p.querySelector('.np-km');
    el.hVel = p.querySelector('.np-vel b');
    el.hCurva = p.querySelector('.np-curva');
    el.hCurvaSeta = p.querySelector('.np-curva-seta');
    el.hCurvaDist = p.querySelector('.np-curva-dist');
    el.hPerigo = p.querySelector('.np-perigo');
    el.hPerigoBarra = p.querySelector('.np-perigo-barra');
    el.aviso = p.querySelector('.np-aviso');
    el.trinca = p.querySelector('.np-trinca');
    el.cont = p.querySelector('.np-cont');
    el.toque = p.querySelector('.np-toque');
    el.tela = p.querySelector('.np-tela');
    el.carregando = p.querySelector('.np-carregando');
    el.tela.addEventListener('click', aoClicarTela);
    montarToque();
    montado = true;
    return true;
  }

  function montarToque() {
    var bts = el.toque.querySelectorAll('[data-tq]');
    Array.prototype.forEach.call(bts, function (b) {
      var k = b.getAttribute('data-tq');
      function on(e) {
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch (er) {}
        b.classList.add('np-on');
        som.retomar();
        if (k === 'cam') { trocarCamera(); return; }
        if (k === 'tras') { ent.olharTras = 1; return; }
        ent[k] = 1;
      }
      function off(e) {
        if (e) e.preventDefault();
        b.classList.remove('np-on');
        if (k === 'tras') { ent.olharTras = 0; return; }
        if (k !== 'cam') ent[k] = 0;
      }
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    el.toque.querySelector('.np-tq-acel').style.display = cfg.autoAcel ? 'none' : '';
  }
  function trocarCamera() { cfg.camera = cfg.camera === 'cabine' ? 'atras' : 'cabine'; salvarCfg(); camInstantanea = true; }

  var MAPA = { KeyW: 'acel', ArrowUp: 'acel', KeyS: 'freio', ArrowDown: 'freio', KeyA: 'esq', ArrowLeft: 'esq', KeyD: 'dir', ArrowRight: 'dir', Space: 'drift', KeyC: 'olharTras' };
  function aoTecla(e) {
    if (!ativo || pausado) return;
    var k = MAPA[e.code];
    if (k) {
      if (estado === 'correndo' || estado === 'contagem') e.preventDefault();
      if (!teclas[e.code]) { teclas[e.code] = 1; ent[k] = 1; som.retomar(); }
      return;
    }
    if (e.code === 'KeyV' && !e.repeat) trocarCamera();
    if ((e.code === 'Enter') && el.tela.style.display !== 'none') {
      var pri = el.tela.querySelector('.np-btn-pri'); if (pri) { e.preventDefault(); pri.click(); }
    }
  }
  function aoSoltar(e) {
    var k = MAPA[e.code];
    if (!k) return;
    teclas[e.code] = 0;
    // só solta se nenhuma outra tecla da mesma ação estiver apertada
    var ainda = false;
    for (var c in MAPA) if (MAPA[c] === k && teclas[c]) ainda = true;
    if (!ainda) ent[k] = 0;
  }
  function soltarTudo() { teclas = {}; ent.acel = ent.freio = ent.esq = ent.dir = ent.drift = ent.olharTras = 0; }

  /* ── Layout: palco 16:9; em pé, gira 90° ─────────────────────── */
  function layout() {
    if (!el.root) return;
    var r = el.root.getBoundingClientRect();
    var W = r.width, H = r.height;
    if (W < 10 || H < 10) return;
    var girar = !lockNativo && H > W * 1.05;
    var aw = girar ? H : W, ah = girar ? W : H;
    var sw = Math.min(aw, ah * 16 / 9), sh = sw * 9 / 16;
    // em tela larga, ocupa a largura toda (corta um pouco em cima/baixo não; estica a câmera)
    sw = aw; sh = ah;
    var p = el.palco.style;
    p.width = sw + 'px'; p.height = sh + 'px';
    p.fontSize = (Math.min(sw, sh * 16 / 9) / 100) + 'px';
    p.transform = 'translate(-50%,-50%)' + (girar ? ' rotate(90deg)' : '');
    if (G) {
      G.renderer.setSize(sw, sh, false);
      el.canvas.style.width = sw + 'px'; el.canvas.style.height = sh + 'px';
      G.cam.aspect = sw / sh; G.cam.updateProjectionMatrix();
      // retrovisor: proporção 3:1 no topo, centralizado
      var ew = Math.min(0.26, 0.26 * (16 / 9) / (sw / sh)), eh = ew * (sw / sh) / 3;
      G.matPos.uniforms.uRet.value.set(0.5 - ew / 2, 0.955 - eh, 0.5 + ew / 2, 0.955);
      tamanhoRT(sw, sh);
    }
  }
  function travarPaisagem() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        var pr = screen.orientation.lock('landscape');
        if (pr && pr.then) pr.then(function () { lockNativo = true; layout(); setTimeout(layout, 250); }).catch(function () { lockNativo = false; });
      }
    } catch (e) { lockNativo = false; }
  }
  function destravar() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    lockNativo = false;
  }
  function aoRedimensionar() { if (ativo) { layout(); setTimeout(layout, 200); } }

  /* ══════════════════════════════════════════════════════════════
     LAÇO
  ══════════════════════════════════════════════════════════════ */
  function laco(t) {
    raf = requestAnimationFrame(laco);
    var dt = tAnt ? (t - tAnt) / 1000 : 0.016;
    tAnt = t;
    if (dt > 0.05) dt = 0.05;
    if (pausado) { som.quadro(dt, { ativo: false }); return; }
    tempoGlobal += dt;
    if (estado === 'titulo') {
      // câmera girando devagar em volta do carro parado
      mula.vel = fotoAng != null ? 22 : 0;
    } else atualizar(dt);
    quadroVisual(dt);
    if (estado === 'titulo') {
      var a = fotoAng != null ? carro.psi + fotoAng : tempoGlobal * 0.12, c = carro;
      var rf = fotoAng != null ? 6.6 : 9;
      camPos.set(c.x + Math.sin(a) * rf, c.y + (fotoAng != null ? 1.2 : 2.6), c.z + Math.cos(a) * rf);
      G.cam.position.copy(camPos);
      camAlvo.set(c.x, c.y + 0.9, c.z);
      if (fotoAng != null) { var mp = G.mulaObj.position; camAlvo.set((c.x + mp.x) / 2, c.y + 1.3, (c.z + mp.z) / 2); }
      G.cam.lookAt(camAlvo);
    }
    renderizar();
    if (estado !== 'titulo') atualizarHud();
    var perigo = estado === 'correndo' ? clamp(1 - (mula.gap - 4) / 28, 0, 1) : 0;
    som.quadro(dt, {
      ativo: true,
      vel: carro.vel, acel: estado === 'pego' || estado === 'fim' ? 0 : carro.acel,
      foraPista: carro.foraPista, deslize: (estado === 'correndo' && carro.driftT > 0) ? carro.deslize + 3 : carro.deslize * 0.5,
      gap: mula.gap, mulaVel: mula.vel, mulaVisivel: G.mulaObj.visible, perigo: perigo
    });
  }

  /* ══════════════════════════════════════════════════════════════
     INTEGRAÇÃO COM O HUB
  ══════════════════════════════════════════════════════════════ */
  function _menu() { var Gm = window.AngatubaGames; return (Gm && Gm.menu) || window.AngatubaJogoMenu || null; }
  function partida(em) {
    if (em === emPartida) return;
    emPartida = em;
    var M = _menu();
    if (M) M.partida(TELA, em);
  }
  function registrarMenu() {
    var M = _menu();
    if (!M) return;
    M.registrar(TELA, {
      pausar: function () { pausado = true; soltarTudo(); som.suspender(); },
      continuar: function () { pausado = false; tAnt = 0; som.retomar(); },
      descricao: function () { return R ? R.def.nome + ' · km ' + fmtKm(clamp(carro ? carro.s : 0, 0, R.fim)) : 'Não Pare'; },
      extra: { rotulo: 'Sair da corrida', acao: function () { pausado = false; preview(); telaTitulo(); } },
      opcoes: function () {
        return [
          { icone: 'fa-camera', rotulo: 'Câmera: ' + (cfg.camera === 'cabine' ? 'Cabine' : 'Atrás'), ativo: true, acao: trocarCamera },
          { icone: 'fa-gauge-high', rotulo: 'Acelerar sozinho: ' + (cfg.autoAcel ? 'Sim' : 'Não'), ativo: cfg.autoAcel, acao: function () {
            cfg.autoAcel = !cfg.autoAcel; salvarCfg();
            el.toque.querySelector('.np-tq-acel').style.display = cfg.autoAcel ? 'none' : '';
          } },
          { icone: 'fa-ghost', rotulo: 'Susto: ' + (cfg.susto === 'forte' ? 'Forte' : 'Suave'), ativo: cfg.susto === 'forte', acao: function () {
            cfg.susto = cfg.susto === 'forte' ? 'suave' : 'forte'; salvarCfg();
          } },
          { icone: 'fa-display', rotulo: 'Gráficos: ' + (cfg.grafico === 'alto' ? 'Alto' : cfg.grafico === 'medio' ? 'Médio' : 'Leve'), ativo: true, acao: function () {
            cfg.grafico = cfg.grafico === 'alto' ? 'medio' : cfg.grafico === 'medio' ? 'leve' : 'alto'; salvarCfg(); layout();
          } }
        ];
      }
    });
  }
  function aoVisibilidade() {
    if (document.hidden && estado === 'correndo' && !pausado) {
      var M = _menu();
      if (M && typeof M.abrir === 'function') M.abrir(TELA);
      else { pausado = true; soltarTudo(); }
    }
  }

  var fotoAng = null;
  var carregandoThree = null;

  /* ══════════════════════════════════════════════════════════════
     ASSETS REAIS (modelos e texturas) — Jogos/assets/naopare/
     Mula: "Animated Rigged Horse With Saddle" (ayanahmadbutt, Sketchfab,
     CC BY), sem cabeça, sem sela e sem a animação original (o galope é
     feito aqui, osso por osso). Carro: "Lowpoly Abandoned Simple Car
     Prop" (rashad-brahimli, Sketchfab, CC BY). Tronco, pedra, texturas
     de terra/chão/casca e o céu (Moonlit Golf): Poly Haven, CC0.
     Os .blend de origem ficam em "Claude outputs/naopare" (fora do site).
     Se algum arquivo falhar, o jogo usa as primitivas de antes.
  ══════════════════════════════════════════════════════════════ */
  var PASTA = '/Jogos/assets/naopare/';
  var AST = null, carregandoAst = null;
  function carregarAssets(prog) {
    if (carregandoAst) return carregandoAst;
    var tl = new T.TextureLoader(), gl = new T.GLTFLoader();
    var out = { tx: {} }, tarefas = [], feitos = 0;
    function um() { feitos++; if (prog) prog(feitos / tarefas.length); }
    function tex(nome, arq, cor) {
      tarefas.push(new Promise(function (ok) {
        tl.load(PASTA + arq, function (t) {
          if (cor) t.colorSpace = T.SRGBColorSpace;
          t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
          out.tx[nome] = t; um(); ok();
        }, undefined, function () { um(); ok(); });
      }));
    }
    function glb(nome, arq) {
      tarefas.push(new Promise(function (ok) {
        gl.load(PASTA + arq, function (g) { out[nome] = g; um(); ok(); }, undefined, function () { um(); ok(); });
      }));
    }
    tex('estradaCor', 'tex/estrada-cor.webp', true); tex('estradaNor', 'tex/estrada-normal.webp'); tex('estradaRug', 'tex/estrada-aspereza.webp');
    tex('chaoCor', 'tex/chao-cor.webp', true); tex('chaoNor', 'tex/chao-normal.webp');
    tex('cascaCor', 'tex/casca-cor.webp', true); tex('cascaNor', 'tex/casca-normal.webp');
    tex('ceu', 'tex/ceu.webp', true);
    glb('carro', 'carro-v1.glb'); glb('mula', 'mula-v1.glb'); glb('tronco', 'tronco-v1.glb'); glb('pedra', 'pedra-v1.glb');
    carregandoAst = Promise.all(tarefas).then(function () { AST = out; return out; });
    return carregandoAst;
  }
  function nomeOsso(n) { return String(n).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function carregarThree() {
    if (window.NPTHREE) return Promise.resolve(window.NPTHREE);
    if (carregandoThree) return carregandoThree;
    carregandoThree = new Promise(function (ok, erro) {
      var s = document.createElement('script');
      s.src = THREE_URL; s.async = true;
      s.onload = function () { window.NPTHREE ? ok(window.NPTHREE) : erro(new Error('three')); };
      s.onerror = function () { carregandoThree = null; erro(new Error('three')); };
      document.head.appendChild(s);
    });
    return carregandoThree;
  }

  function iniciarMundo() {
    T = window.NPTHREE;
    _v1 = new T.Vector3(); _v2 = new T.Vector3(); _pw = new T.Vector3(); camPos = new T.Vector3(); camAlvo = new T.Vector3();
    if (!G) { try { montarCena(); } catch (e) { G = null; throw e; } }
    if (!R || R.def !== ROTAS[rotaIdx]) { R = gerarRota(ROTAS[rotaIdx]); montarEstrada(); }
    layout();
    preview();
    telaTitulo();
    el.carregando.style.display = 'none';
    tAnt = 0;
    if (!raf) raf = requestAnimationFrame(laco);
  }

  function preparar() {
    if (!montado && !montarDom()) return;
    if (!ativo) {
      ativo = true;
      window.addEventListener('resize', aoRedimensionar);
      window.addEventListener('orientationchange', aoRedimensionar);
      window.addEventListener('keydown', aoTecla, true);
      window.addEventListener('keyup', aoSoltar, true);
      window.addEventListener('blur', soltarTudo);
      document.addEventListener('visibilitychange', aoVisibilidade);
    }
    pausado = false; soltarTudo();
    registrarMenu();
    travarPaisagem();
    layout(); setTimeout(layout, 120); setTimeout(layout, 400);
    if (window.NPTHREE && G) { iniciarMundo(); return; }
    el.carregando.style.display = '';
    el.carregando.textContent = 'Ligando o motor…';
    carregarThree().then(function () {
      T = window.NPTHREE;
      return carregarAssets(function (f) { el.carregando.textContent = 'Ligando o motor… ' + Math.round(f * 100) + '%'; });
    }).then(function () {
      if (!ativo) return;
      try { iniciarMundo(); }
      catch (e) { el.carregando.textContent = 'Seu aparelho não conseguiu abrir o 3D deste jogo.'; if (window.console) console.error(e); }
    }).catch(function () {
      el.carregando.textContent = 'Não foi possível carregar o jogo. Verifique a conexão e tente de novo.';
    });
  }

  function parar() {
    if (!ativo) return;
    ativo = false;
    partida(false);
    cancelAnimationFrame(raf); raf = 0;
    som.suspender();
    soltarTudo();
    destravar();
    window.removeEventListener('resize', aoRedimensionar);
    window.removeEventListener('orientationchange', aoRedimensionar);
    window.removeEventListener('keydown', aoTecla, true);
    window.removeEventListener('keyup', aoSoltar, true);
    window.removeEventListener('blur', soltarTudo);
    document.removeEventListener('visibilitychange', aoVisibilidade);
  }

  window.NaoPareGame = {
    preparar: preparar, parar: parar,
    // Leitura de estado para testes (não altera nada)
    _estado: function () {
      var cv = carro && R ? proximaCurva() : null;
      return { estado: estado, s: carro && carro.s, lat: carro && carro.lat, vel: carro && carro.vel, gap: mula && mula.gap, psi: carro && carro.psi, th: carro && carro.thPista,
        curva: cv ? { d: cv.s0 - carro.s, sev: cv.sev, dir: cv.dir, fim: cv.s1 - carro.s } : null,
        tempo: corrida && corrida.tempo, km: corrida && corrida.km, curvas: R && R.curvas.length, L: R && R.L };
    },
    // Só para testes automáticos: entradas virtuais e simulação sem desenhar
    _ent: ent,
    _foto: function (ang, gap) { fotoAng = ang; if (mula) mula.gap = gap; },
    _gal: GAL,
    _dbg: function () { var v = new T.Vector3(); G.mulaPonta.getWorldPosition(v); return { cam: G.cam.position.toArray().map(function (x) { return +x.toFixed(2); }), toco: v.toArray().map(function (x) { return +x.toFixed(2); }), mula: G.mulaObj.position.toArray().map(function (x) { return +x.toFixed(2); }), carro: [+carro.x.toFixed(2), +carro.y.toFixed(2), +carro.z.toFixed(2)], psi: +carro.psi.toFixed(2), fase: corrida && corrida.fase, capo: mula.capo, D: mula.capoD, Y: mula.capoY, visivel: G.mulaObj.visible }; },
    _simular: function (n, dt, fn) {
      for (var i = 0; i < n; i++) {
        if (estado !== 'correndo' && estado !== 'contagem') break;
        fn(window.NaoPareGame._estado());
        tempoGlobal += dt;
        atualizar(dt);
      }
      return window.NaoPareGame._estado();
    }
  };
})();
