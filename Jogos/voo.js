/* ═══════════════════════════════════════════════════════════════
   VOO DA CORUJA — módulo de jogo (lazy-loaded)
   Carregado sob demanda por /jogos/ quando o usuário abre o jogo.
   Comunica-se com o app APENAS via window.AngatubaGames (a ponte).
   Expõe window.VooGame = { preparar, comecar, parar } e mantém
   window._vooComecar pro onclick inline do botão no HTML.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     VOO DA CORUJA — mini game estilo Doodle Jump (canvas)
     — A coruja pula sozinha ao bater nas plataformas; o jogador
       arrasta o dedo pra mover na horizontal (controle relativo).
     — Pontuação = altura subida (independente de resolução: tudo
       normalizado por H, a altura lógica do canvas).
     — Integra no hub como os outros: _vooPreparar (ao abrir a tela),
       _vooComecar (botão), _vooParar (ao sair). Rank via
       rankSubmeter('voo', score) + rankFimDeJogo no fim.
  ══════════════════════════════════════════════════════════════ */
  var _VOO_OWL_SRC = '/webp/owl-flying.webp';
  var _vooImg = null, _vooImgOk = false, _vooImgRatio = 1;   // ratio = h/w
  var _vooCanvas = null, _vooCtx = null;
  var _vooW = 0, _vooH = 0, _vooDpr = 1;
  var _vooRAF = 0, _vooLast = 0, _vooEstado = 'inicio';       // 'inicio'|'jogando'|'fim'
  var _vooListenersOn = false, _vooResizeOn = false;

  // Estado da partida
  var _vooOwl = null, _vooPlats = [], _vooCamY = 0, _vooStartY = 0;
  var _vooMaxClimb = 0, _vooScore = 0, _vooScoreShown = -1;
  var _vooDragging = false, _vooLastPX = 0, _vooKeyDir = 0;
  var _vooNuvens = [];

  function _vooRec() {
    try { return Number(localStorage.getItem('angatuba_voo_rec')) || 0; } catch (e) { return 0; }
  }
  function _vooRecSet(v) {
    try { localStorage.setItem('angatuba_voo_rec', String(v)); } catch (e) {}
  }

  // Carrega a imagem da coruja uma vez (degrada pra bolinha se falhar).
  function _vooCarregarImg() {
    if (_vooImg) return;
    try {
      _vooImg = new Image();
      _vooImg.onload = function () {
        _vooImgOk = true;
        var w = _vooImg.naturalWidth || 0, h = _vooImg.naturalHeight || 0;
        _vooImgRatio = (w > 0 && h > 0) ? (h / w) : 1;
      };
      _vooImg.onerror = function () { _vooImgOk = false; };
      _vooImg.src = _VOO_OWL_SRC;
    } catch (e) { _vooImg = null; _vooImgOk = false; }
  }

  // (Re)dimensiona o canvas pro tamanho do container, com DPR.
  function _vooDimensionar() {
    if (!_vooCanvas) return;
    var rect = _vooCanvas.getBoundingClientRect();
    var cssW = Math.max(1, Math.round(rect.width));
    var cssH = Math.max(1, Math.round(rect.height));
    _vooDpr = Math.min(2, (window.devicePixelRatio || 1));
    _vooCanvas.width = Math.round(cssW * _vooDpr);
    _vooCanvas.height = Math.round(cssH * _vooDpr);
    _vooW = cssW; _vooH = cssH;
    if (_vooCtx) _vooCtx.setTransform(_vooDpr, 0, 0, _vooDpr, 0, 0);
  }

  // Constantes de física em função de H (mesma sensação em qualquer tela).
  function _vooGrav()  { return 2.3 * _vooH; }     // px/s²
  function _vooJump()  { return -1.02 * _vooH; }   // px/s (impulso p/ cima)
  function _vooPlatW() { return 0.28 * _vooW; }
  function _vooPlatH() { return Math.max(8, 0.028 * _vooH); }
  function _vooOwlW()  { return 0.15 * _vooW; }
  function _vooOwlH()  { return _vooOwlW() * (_vooImgOk ? _vooImgRatio : 1); }

  // Gap vertical entre plataformas, cresce com a pontuação (mais difícil).
  // Alcance seguro de um pulo (altura máxima), em px, com margem.
  // hMax = v^2 / (2g). Usamos 82% dele como teto de gap pra sempre
  // sobrar folga de controle horizontal.
  function _vooAlcance() {
    var v = Math.abs(_vooJump());
    var g = _vooGrav();
    return (v * v) / (2 * g);
  }

  // Gap efetivo entre plataformas ALCANÇÁVEIS (normais/móveis), sempre
  // <= teto seguro. Cresce com o score, mas nunca além do que o pulo
  // vence. (Independe de resolução: tudo em px do H atual.)
  function _vooGap() {
    var teto = _vooAlcance() * 0.82;
    var t = Math.min(1, _vooScore / 4000);
    var min = teto * (0.58 + 0.12 * t);
    var max = teto * (0.74 + 0.14 * t);
    if (max > teto) max = teto;
    return min + Math.random() * (max - min);
  }

  // Cria UMA plataforma num y dado. 'forcarNormal' garante que ela seja
  // pisável (usado logo acima de uma quebrável, pra nunca formar beco).
  function _vooNovaPlat(y, forcarNormal) {
    var w = _vooPlatW();
    var x = Math.random() * (_vooW - w);
    var tipo = 'normal';
    if (!forcarNormal) {
      var r = Math.random();
      if (_vooScore >= 700 && r < 0.18)      tipo = 'break';
      else if (_vooScore >= 300 && r < 0.42) tipo = 'move';
    }
    // Trampolim só em plataforma normal.
    var boost = (tipo === 'normal' && Math.random() < 0.07);
    var vx = 0;
    if (tipo === 'move') {
      var spd = (0.10 + 0.10 * Math.min(1, _vooScore / 3000)) * _vooW;
      vx = (Math.random() < 0.5 ? -1 : 1) * spd;
    }
    return { x: x, y: y, w: w, tipo: tipo, boost: boost, vx: vx, usada: false };
  }

  // Garante plataformas preenchidas acima da câmera, SEMPRE com caminho
  // alcançável: cada passo sobe no máximo _vooGap() (<= alcance do pulo),
  // e nunca gera não-normal imediatamente acima de uma quebrável.
  function _vooGerarAcima() {
    var topo = _vooCamY - 0.2 * _vooH;
    var maisAlta = _vooPlats.length ? _vooPlats[_vooPlats.length - 1] : null;
    var yAtual = maisAlta ? maisAlta.y : _vooStartY;
    var tipoAnterior = maisAlta ? maisAlta.tipo : 'normal';
    while (yAtual > topo) {
      // Regra de jogabilidade: nunca duas plataformas NÃO-NORMAIS seguidas.
      // Uma não-normal (quebrável some após o pulo; móvel pode estar longe
      // no eixo X) não é apoio confiável pra um segundo salto. Forçando uma
      // NORMAL logo acima de qualquer não-normal, garantimos que entre dois
      // apoios confiáveis (normais) há no máximo uma não-normal.
      var anteriorRuim = (tipoAnterior !== 'normal');
      // Quando a anterior é não-normal, encurtamos ESTE gap: assim o salto
      // que possivelmente ignora a não-normal (normal->normal) ainda cabe
      // dentro de um único pulo. gap normal->normal <= gap1*0.6 + gap2 onde
      // gap2 (este) é reduzido a 55%.
      var g = _vooGap();
      if (anteriorRuim) g *= 0.35;
      yAtual -= g;
      var nova = _vooNovaPlat(yAtual, anteriorRuim);   // força normal se anterior ruim
      _vooPlats.push(nova);
      tipoAnterior = nova.tipo;
    }
  }

  function _vooReset() {
    _vooDimensionar();
    _vooPlats = [];
    _vooStartY = 0;
    _vooCamY = _vooStartY - 0.7 * _vooH;     // coruja começa no terço de baixo
    _vooMaxClimb = 0; _vooScore = 0; _vooScoreShown = -1;
    _vooKeyDir = 0; _vooDragging = false;

    // Plataforma-base logo abaixo da coruja (primeiro pulo garantido).
    var baseY = _vooStartY + 0.12 * _vooH;
    var pw = _vooPlatW();
    _vooPlats.push({ x: (_vooW - pw) / 2, y: baseY, w: pw, tipo: 'normal', boost: false, vx: 0, usada: false });

    _vooOwl = {
      x: _vooW / 2, y: _vooStartY,
      vx: 0, vy: _vooJump() * 0.6,   // já sobe um pouquinho no começo
      dir: 1                          // 1 direita, -1 esquerda (p/ espelhar)
    };

    // Sobe as plataformas iniciais (mesma proteção do _vooGerarAcima:
    // nunca duas não-normais seguidas; encurta gap após não-normal).
    var y = baseY;
    var tAnt = 'normal';
    while (y > _vooCamY - 0.2 * _vooH) {
      var ruim = (tAnt !== 'normal');
      var gg = _vooGap(); if (ruim) gg *= 0.35;
      y -= gg;
      var np = _vooNovaPlat(y, ruim);
      _vooPlats.push(np);
      tAnt = np.tipo;
    }

    // Nuvens de parallax (decorativas).
    _vooNuvens = [];
    for (var i = 0; i < 4; i++) {
      _vooNuvens.push({
        x: Math.random() * _vooW,
        y: _vooStartY - Math.random() * 2 * _vooH,
        r: (0.10 + Math.random() * 0.10) * _vooW
      });
    }
  }

  function _vooAtualizarScore() {
    var climb = _vooStartY - _vooOwl.y;
    if (climb > _vooMaxClimb) _vooMaxClimb = climb;
    _vooScore = Math.max(0, Math.floor((_vooMaxClimb / _vooH) * 100));
    if (_vooScore !== _vooScoreShown) {
      _vooScoreShown = _vooScore;
      var el = document.getElementById('vo-pontos');
      if (el) el.textContent = _vooScore;
    }
  }

  function _vooStep(dt) {
    var o = _vooOwl;
    var g = _vooGrav();

    // Movimento horizontal por teclado (desktop); o arraste mexe direto em o.x.
    if (_vooKeyDir !== 0) { o.x += _vooKeyDir * 0.9 * _vooW * dt; }

    // Física vertical
    o.vy += g * dt;
    o.y += o.vy * dt;

    // Wrap horizontal (sai de um lado, entra no outro)
    var hw = _vooOwlW() / 2;
    if (o.x < -hw) o.x = _vooW + hw;
    else if (o.x > _vooW + hw) o.x = -hw;

    // Move plataformas móveis
    for (var i = 0; i < _vooPlats.length; i++) {
      var p = _vooPlats[i];
      if (p.tipo === 'move' && p.vx) {
        p.x += p.vx * dt;
        if (p.x < 0) { p.x = 0; p.vx = -p.vx; }
        else if (p.x + p.w > _vooW) { p.x = _vooW - p.w; p.vx = -p.vx; }
      }
    }

    // Colisão: só quando caindo (vy > 0) e os pés cruzam o topo da plataforma
    if (o.vy > 0) {
      var owlH = _vooOwlH();
      var feet = o.y + owlH / 2;
      var ph = _vooPlatH();
      for (var j = 0; j < _vooPlats.length; j++) {
        var pl = _vooPlats[j];
        if (pl.usada) continue;
        var dentroX = (o.x > pl.x - hw * 0.4) && (o.x < pl.x + pl.w + hw * 0.4);
        var cruzou = (feet >= pl.y) && (feet <= pl.y + ph + Math.abs(o.vy) * dt);
        if (dentroX && cruzou) {
          // Impulsiona SEMPRE (inclusive quebrável) — assim nenhuma
          // plataforma vira beco sem saída. A quebrável dá o pulo e
          // só então some (nega a 2ª vez naquele ponto, como no
          // Doodle Jump clássico).
          o.vy = _vooJump() * (pl.boost ? 1.7 : 1);
          o.y = pl.y - owlH / 2;           // encosta em cima
          if (pl.tipo === 'break') pl.usada = true;  // quebra após impulsionar
          break;
        }
      }
    }

    // Direção pra espelhar sprite
    if (o.vx > 2) o.dir = 1; else if (o.vx < -2) o.dir = -1;

    // Câmera sobe com a coruja (nunca desce)
    var alvoCam = o.y - 0.45 * _vooH;
    if (alvoCam < _vooCamY) _vooCamY = alvoCam;

    // Gera acima e descarta plataformas bem abaixo
    _vooGerarAcima();
    var limiteBaixo = _vooCamY + _vooH + 0.3 * _vooH;
    _vooPlats = _vooPlats.filter(function (p) { return p.y < limiteBaixo; });

    _vooAtualizarScore();

    // Morte: caiu abaixo da tela
    if (o.y - _vooCamY > _vooH + _vooOwlH()) { _vooFim(); return false; }
    return true;
  }

  function _vooDraw() {
    var ctx = _vooCtx;
    if (!ctx) return;
    var W = _vooW, H = _vooH;

    // Fundo (gradiente escuro do tema)
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1420');
    grad.addColorStop(1, '#131b2b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Nuvens parallax (recicladas conforme sobe)
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#9fb4d6';
    for (var n = 0; n < _vooNuvens.length; n++) {
      var c = _vooNuvens[n];
      var sy = (c.y - _vooCamY * 0.5);              // metade da velocidade
      if (sy > H + c.r) { c.y = _vooCamY * 0.5 - c.r - Math.random() * H; c.x = Math.random() * W; }
      ctx.beginPath();
      ctx.arc(c.x, sy, c.r, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.7, sy + c.r * 0.2, c.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Plataformas
    var ph = _vooPlatH();
    for (var i = 0; i < _vooPlats.length; i++) {
      var p = _vooPlats[i];
      if (p.usada) continue;
      var y = p.y - _vooCamY;
      if (y < -ph || y > H + ph) continue;
      var cor = '#2fd48a';                            // normal: verde-água
      if (p.tipo === 'move') cor = '#49a7ff';         // móvel: azul
      else if (p.tipo === 'break') cor = '#f0913e';   // quebrável: laranja
      _vooRoundRect(ctx, p.x, y, p.w, ph, ph / 2);
      ctx.fillStyle = cor;
      ctx.fill();
      // Trampolim: marquinha neon vermelha
      if (p.boost) {
        ctx.fillStyle = '#ff3355';
        var bw = p.w * 0.34, bx = p.x + (p.w - bw) / 2, by = y - ph * 0.9;
        _vooRoundRect(ctx, bx, by, bw, ph * 0.9, ph * 0.35);
        ctx.fill();
      }
    }

    // Coruja
    var o = _vooOwl;
    var ow = _vooOwlW(), oh = _vooOwlH();
    ctx.save();
    ctx.translate(o.x, (o.y - _vooCamY));
    if (o.dir < 0) ctx.scale(-1, 1);
    if (_vooImgOk && _vooImg) {
      try { ctx.drawImage(_vooImg, -ow / 2, -oh / 2, ow, oh); }
      catch (e) { _vooDrawFallback(ctx, ow); }
    } else {
      _vooDrawFallback(ctx, ow);
    }
    ctx.restore();
  }

  function _vooDrawFallback(ctx, ow) {
    ctx.fillStyle = '#8aa0c6';
    ctx.beginPath();
    ctx.arc(0, 0, ow / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath(); ctx.arc(-ow * 0.15, -ow * 0.1, ow * 0.09, 0, Math.PI * 2);
    ctx.arc(ow * 0.15, -ow * 0.1, ow * 0.09, 0, Math.PI * 2); ctx.fill();
  }

  function _vooRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function _vooLoop(ts) {
    if (_vooEstado !== 'jogando') return;
    if (!_vooLast) _vooLast = ts;
    var dt = (ts - _vooLast) / 1000;
    _vooLast = ts;
    if (dt > 1 / 30) dt = 1 / 30;                    // clamp anti-tunneling
    var vivo = _vooStep(dt);
    if (!vivo) return;
    _vooDraw();
    _vooRAF = requestAnimationFrame(_vooLoop);
  }

  /* ── Controles ─────────────────────────────────────────────── */
  function _vooPX(e) {
    var rect = _vooCanvas.getBoundingClientRect();
    var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    return cx - rect.left;
  }
  function _vooPointerDown(e) {
    if (_vooEstado !== 'jogando') return;
    _vooDragging = true; _vooLastPX = _vooPX(e);
    if (e.cancelable) e.preventDefault();
  }
  function _vooPointerMove(e) {
    if (!_vooDragging || _vooEstado !== 'jogando') return;
    var px = _vooPX(e);
    var dx = px - _vooLastPX;
    _vooLastPX = px;
    _vooOwl.x += dx * 1.5;                            // sensibilidade do arraste
    _vooOwl.vx = dx;                                  // p/ decidir espelhamento
    if (e.cancelable) e.preventDefault();
  }
  function _vooPointerUp() { _vooDragging = false; _vooOwl.vx = 0; }
  function _vooKey(down, e) {
    if (e.key === 'ArrowLeft')  { _vooKeyDir = down ? -1 : 0; _vooOwl.dir = -1; }
    else if (e.key === 'ArrowRight') { _vooKeyDir = down ? 1 : 0; _vooOwl.dir = 1; }
  }
  function _vooLigarControles() {
    if (_vooListenersOn || !_vooCanvas) return;
    _vooCanvas.addEventListener('touchstart', _vooPointerDown, { passive: false });
    _vooCanvas.addEventListener('touchmove',  _vooPointerMove, { passive: false });
    _vooCanvas.addEventListener('touchend',   _vooPointerUp);
    _vooCanvas.addEventListener('touchcancel',_vooPointerUp);
    _vooCanvas.addEventListener('mousedown',  _vooPointerDown);
    window.addEventListener('mousemove',      _vooPointerMove);
    window.addEventListener('mouseup',        _vooPointerUp);
    _vooCanvas.__voKD = function (e) { _vooKey(true, e); };
    _vooCanvas.__voKU = function (e) { _vooKey(false, e); };
    window.addEventListener('keydown', _vooCanvas.__voKD);
    window.addEventListener('keyup',   _vooCanvas.__voKU);
    _vooListenersOn = true;
  }

  /* ── Ciclo de vida integrado ao hub ────────────────────────── */
  function _vooPreparar() {
    _vooCanvas = document.getElementById('vo-canvas');
    if (!_vooCanvas) return;
    _vooCtx = _vooCanvas.getContext('2d');
    _vooCarregarImg();
    _vooLigarControles();
    if (!_vooResizeOn) {
      window.addEventListener('resize', function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) { _vooDimensionar(); if (_vooEstado !== 'jogando') _vooDrawIdle(); }
      });
      _vooResizeOn = true;
    }
    _vooEstado = 'inicio';
    var rec = document.getElementById('vo-recorde'); if (rec) rec.textContent = _vooRec();
    var pts = document.getElementById('vo-pontos');  if (pts) pts.textContent = 0;
    _vooMostrarOverlay('inicio');
    _vooDimensionar();
    _vooDrawIdle();
  }

  // Desenha um quadro parado (fundo + plataformas de amostra) atrás do overlay.
  function _vooDrawIdle() {
    if (!_vooCtx) return;
    _vooDimensionar();
    var ctx = _vooCtx, W = _vooW, H = _vooH;
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1420'); grad.addColorStop(1, '#131b2b');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  function _vooComecar() {
    _vooCanvas = document.getElementById('vo-canvas');
    if (!_vooCanvas) return;
    if (!_vooCtx) _vooCtx = _vooCanvas.getContext('2d');
    _vooLigarControles();
    _vooMostrarOverlay(null);
    _vooReset();
    _vooEstado = 'jogando';
    _vooLast = 0;
    if (_vooRAF) cancelAnimationFrame(_vooRAF);
    _vooRAF = requestAnimationFrame(_vooLoop);
  }

  function _vooParar() {
    if (_vooRAF) { cancelAnimationFrame(_vooRAF); _vooRAF = 0; }
    if (_vooEstado === 'jogando') _vooEstado = 'inicio';
    _vooDragging = false; _vooKeyDir = 0;
  }

  function _vooFim() {
    if (_vooRAF) { cancelAnimationFrame(_vooRAF); _vooRAF = 0; }
    _vooEstado = 'fim';
    var score = _vooScore;
    var rec = _vooRec();
    var recorde = score > rec;
    if (recorde) { _vooRecSet(score); var r = document.getElementById('vo-recorde'); if (r) r.textContent = score; }

    // Rank (silencioso se deslogado; o Firestore aplica recorde/teto)
    if (window.AngatubaGames) window.AngatubaGames.rankSubmeter('voo', score);

    // Tela de fim
    var owlEl = document.getElementById('vo-fim-owl');
    var titEl = document.getElementById('vo-fim-titulo');
    var msgEl = document.getElementById('vo-fim-pontos');
    var subEl = document.getElementById('vo-fim-msg');
    if (owlEl) { owlEl.src = recorde ? '/webp/owl-celebrate-flying.webp' : '/webp/owl-flying.webp'; owlEl.style.display = ''; }
    if (titEl) titEl.textContent = recorde ? '🎉 Novo recorde!' : 'Fim do voo!';
    if (msgEl) msgEl.textContent = score + (score === 1 ? ' ponto' : ' pontos');
    if (subEl) {
      subEl.textContent = recorde
        ? 'Você voou mais alto que nunca! 🦉'
        : (rec > 0 ? 'Seu recorde: ' + rec + '. Bora de novo?' : 'Arraste pra desviar e suba o máximo que puder!');
    }
    _vooMostrarOverlay('fim');

    if (window.AngatubaGames) window.AngatubaGames.rankFimDeJogo('voo', 'vo-rank-slot', score);
  }

  // Mostra o overlay pedido ('inicio' | 'fim' | null pra esconder ambos).
  function _vooMostrarOverlay(qual) {
    var ini = document.getElementById('vo-inicio');
    var fim = document.getElementById('vo-fim');
    if (ini) ini.style.display = (qual === 'inicio') ? '' : 'none';
    if (fim) fim.style.display = (qual === 'fim') ? '' : 'none';
  }

  window._vooComecar = _vooComecar;

  // API pública consumida pelo loader do app (_jogoLoader).
  window.VooGame = {
    preparar: _vooPreparar,
    comecar:  _vooComecar,
    parar:    _vooParar
  };
  // Mantém o binding usado pelo onclick inline no HTML.
  window._vooComecar = _vooComecar;
})();
