/* ═══════════════════════════════════════════════════════════════
   EFEITOS VISUAIS DOS JOGOS — partículas em canvas (compartilhado)
   Módulo leve pra dar "vida" às celebrações sem depender de imagens
   novas. Desenha num <canvas> overlay temporário criado sob demanda,
   por cima da tela atual, e se auto-remove ao terminar a animação.
   Não interfere no canvas do próprio jogo (ex.: Voo).

   Exposto ao app pela ponte (window.AngatubaGames.efeitos). Uso:
     efeitos.confete(elOuId)   → chuva de confete colorido (recorde)
     efeitos.estrelas(x, y)    → burst de estrelinhas num ponto
     efeitos.brilho(elOuId)    → flash suave de brilho na área

   Respeita prefers-reduced-motion: se o usuário pediu menos
   animação, os efeitos viram no-op (acessibilidade).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Respeita preferência de menos movimento.
  function _reduzMovimento() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  // Resolve um alvo (id string ou elemento) para um elemento DOM.
  function _resolverEl(alvo) {
    if (!alvo) return document.body;
    if (typeof alvo === 'string') return document.getElementById(alvo) || document.body;
    return alvo;
  }

  // Cria um canvas overlay cobrindo o retângulo do elemento-alvo.
  // position:fixed em coordenadas de viewport (robusto a scroll do
  // container). z-index alto pra ficar sobre a tela de fim do jogo.
  function _criarCanvas(el) {
    var r = el.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.floor(r.width * dpr));
    cv.height = Math.max(1, Math.floor(r.height * dpr));
    var s = cv.style;
    s.position = 'fixed';
    s.left = r.left + 'px';
    s.top = r.top + 'px';
    s.width = r.width + 'px';
    s.height = r.height + 'px';
    s.pointerEvents = 'none';
    s.zIndex = '9999';
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    return { cv: cv, ctx: ctx, w: r.width, h: r.height };
  }

  // Paleta alinhada à identidade (vermelho neon, âmbar, roxo, verde, azul).
  var CORES = ['#ff3b3b', '#f59e0b', '#a855f7', '#4ade80', '#3b82f6', '#fcd34d'];

  // Loop de animação genérico: recebe uma lista de partículas com
  // {x,y,vx,vy,...} e uma função de desenho/atualização por frame.
  // Termina quando 'vivas' zera ou estoura o tempo máximo.
  function _animar(pack, particulas, passoFn, maxMs) {
    var ini = (window.performance && performance.now) ? performance.now() : Date.now();
    var prev = ini;

    function frame(now) {
      now = now || ((window.performance && performance.now) ? performance.now() : Date.now());
      var dt = Math.min(48, now - prev) / 16.6667; // em "frames de 60fps"
      prev = now;
      pack.ctx.clearRect(0, 0, pack.w, pack.h);

      var vivas = 0;
      for (var i = 0; i < particulas.length; i++) {
        var p = particulas[i];
        if (p.vida <= 0) continue;
        vivas++;
        passoFn(pack.ctx, p, dt);
      }

      var passou = now - ini;
      if (vivas > 0 && passou < (maxMs || 2600)) {
        (window.requestAnimationFrame || function (f) { return setTimeout(function () { f(); }, 16); })(frame);
      } else {
        try { pack.cv.remove(); } catch (e) {}
      }
    }
    (window.requestAnimationFrame || function (f) { return setTimeout(function () { f(); }, 16); })(frame);
  }

  // ── Confete: chuva colorida caindo do topo da área ───────
  function confete(alvo, qtd) {
    if (_reduzMovimento()) return;
    var el = _resolverEl(alvo);
    var pack = _criarCanvas(el);
    var n = qtd || Math.min(90, Math.max(36, Math.floor(pack.w / 6)));
    var ps = [];
    for (var i = 0; i < n; i++) {
      ps.push({
        x: Math.random() * pack.w,
        y: -10 - Math.random() * pack.h * 0.4,
        vx: (Math.random() - 0.5) * 2.2,
        vy: 1.6 + Math.random() * 2.8,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        larg: 5 + Math.random() * 5,
        alt: 8 + Math.random() * 6,
        cor: CORES[(Math.random() * CORES.length) | 0],
        vida: 1
      });
    }
    _animar(pack, ps, function (ctx, p, dt) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.02 * dt;          // gravidadezinha
      p.rot += p.vrot * dt;
      if (p.y > pack.h + 20) p.vida = 0; // saiu embaixo
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.cor;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(-p.larg / 2, -p.alt / 2, p.larg, p.alt);
      ctx.restore();
    }, 2800);
  }

  // ── Estrelas: burst radial a partir de um ponto (x,y em px de
  //    viewport). Bom pra marcar um acerto especial/bônus. ─────
  function estrelas(x, y, qtd) {
    if (_reduzMovimento()) return;
    // canvas do tamanho da tela toda (o ponto é em viewport)
    var fakeEl = {
      getBoundingClientRect: function () {
        return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      }
    };
    var pack = _criarCanvas(fakeEl);
    var n = qtd || 16;
    var ps = [];
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      var vel = 2 + Math.random() * 3;
      ps.push({
        x: x, y: y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        r: 2 + Math.random() * 2.5,
        cor: CORES[(Math.random() * CORES.length) | 0],
        vida: 1, t: 0
      });
    }
    _animar(pack, ps, function (ctx, p, dt) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.05 * dt;
      p.vx *= 0.98; p.vy *= 0.98;
      var a = Math.max(0, 1 - p.t / 40);
      if (a <= 0.02) { p.vida = 0; return; }
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }, 1200);
  }

  // ── Brilho: um flash radial suave sobre a área (feedback de
  //    celebração discreto, sem partículas). ──────────────────
  function brilho(alvo) {
    if (_reduzMovimento()) return;
    var el = _resolverEl(alvo);
    var pack = _criarCanvas(el);
    var estado = { t: 0 };
    var cx = pack.w / 2, cy = pack.h / 2;
    var raio = Math.max(pack.w, pack.h) * 0.7;

    function frame() {
      estado.t += 1;
      pack.ctx.clearRect(0, 0, pack.w, pack.h);
      var prog = estado.t / 28;
      if (prog >= 1) { try { pack.cv.remove(); } catch (e) {} return; }
      var a = Math.sin(prog * Math.PI) * 0.5; // sobe e desce
      var grad = pack.ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
      grad.addColorStop(0, 'rgba(252,211,77,' + a + ')');
      grad.addColorStop(0.5, 'rgba(255,59,59,' + (a * 0.4) + ')');
      grad.addColorStop(1, 'rgba(255,59,59,0)');
      pack.ctx.fillStyle = grad;
      pack.ctx.fillRect(0, 0, pack.w, pack.h);
      (window.requestAnimationFrame || function (f) { return setTimeout(function () { f(); }, 16); })(frame);
    }
    (window.requestAnimationFrame || function (f) { return setTimeout(function () { f(); }, 16); })(frame);
  }

  // API pública.
  window.AngatubaEfeitos = {
    confete: confete,
    estrelas: estrelas,
    brilho: brilho
  };
})();
