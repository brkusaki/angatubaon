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
  var _vooEstrelas = [];        // campo de estrelas (parallax lento, surge na subida)
  var _vooTrail = [];           // rastro da coruja (posições recentes p/ fade)
  var _vooSquash = 0;           // 0 = neutro; >0 estica (pulo), <0 achata (impacto)
  var _vooTempo = 0;            // relógio do jogo (s) p/ cintilar estrelas/asas
  var _vooAlt = 0;              // altitude normalizada 0→1 (0 = solo, 1 = espaço)

  // Altitude de "climb" (px) que corresponde a atingir o espaço (alt=1).
  // ~2600px de subida — várias telas — pra transição durar a partida toda.
  function _vooAltMax() { return 26 * _vooH; }

  // Paleta do céu por altitude: amanhecer → dia → crepúsculo → espaço.
  // Cada parada tem cor de topo e de base do gradiente vertical.
  var _VOO_CEU = [
    { a: 0.00, topo: [255, 176, 122], base: [255, 214, 170] }, // amanhecer quente
    { a: 0.22, topo: [122, 178, 240], base: [196, 224, 255] }, // dia claro
    { a: 0.52, topo: [ 74,  96, 176], base: [138, 120, 210] }, // fim de tarde / roxo
    { a: 0.78, topo: [ 26,  30,  68], base: [ 58,  40, 104] }, // crepúsculo profundo
    { a: 1.00, topo: [  5,   7,  18], base: [ 14,  18,  40] }  // espaço
  ];

  // Interpola a paleta do céu para uma altitude 'a' (0→1), devolvendo
  // [topoRGB, baseRGB]. Clampa nas pontas.
  function _vooCorCeu(a) {
    if (a <= _VOO_CEU[0].a) return [_VOO_CEU[0].topo, _VOO_CEU[0].base];
    var n = _VOO_CEU.length;
    if (a >= _VOO_CEU[n - 1].a) return [_VOO_CEU[n - 1].topo, _VOO_CEU[n - 1].base];
    for (var i = 0; i < n - 1; i++) {
      var p0 = _VOO_CEU[i], p1 = _VOO_CEU[i + 1];
      if (a >= p0.a && a <= p1.a) {
        var t = (a - p0.a) / (p1.a - p0.a);
        return [_vooMix(p0.topo, p1.topo, t), _vooMix(p0.base, p1.base, t)];
      }
    }
    return [_VOO_CEU[0].topo, _VOO_CEU[0].base];
  }
  function _vooMix(c0, c1, t) {
    return [
      Math.round(c0[0] + (c1[0] - c0[0]) * t),
      Math.round(c0[1] + (c1[1] - c0[1]) * t),
      Math.round(c0[2] + (c1[2] - c0[2]) * t)
    ];
  }
  function _vooRgb(c)      { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function _vooRgba(c, a)  { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

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

    // Nuvens de parallax (decorativas). Guardam uma "faixa" de altitude
    // própria pra recliclar dentro das camadas baixas do céu.
    _vooNuvens = [];
    for (var i = 0; i < 6; i++) {
      _vooNuvens.push({
        x: Math.random() * _vooW,
        y: _vooStartY - Math.random() * 3 * _vooH,
        r: (0.14 + Math.random() * 0.16) * _vooW,
        op: 0.5 + Math.random() * 0.5
      });
    }

    // Campo de estrelas: coordenadas em espaço de tela (recicladas no
    // parallax). Só ficam visíveis conforme a altitude sobe. Guardamos
    // fase de cintilação individual.
    _vooEstrelas = [];
    var nEst = 70;
    for (var s = 0; s < nEst; s++) {
      _vooEstrelas.push({
        x: Math.random() * _vooW,
        y: Math.random() * _vooH,
        r: 0.5 + Math.random() * 1.6,
        f: Math.random() * Math.PI * 2,        // fase da cintilação
        v: 0.15 + Math.random() * 0.5          // camada de parallax (0..~0.65)
      });
    }

    _vooTrail = [];
    _vooSquash = 0;
    _vooTempo = 0;
    _vooAlt = 0;
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

    _vooTempo += dt;

    // Movimento horizontal por teclado (desktop); o arraste mexe direto em o.x.
    if (_vooKeyDir !== 0) { o.x += _vooKeyDir * 0.9 * _vooW * dt; }

    // Física vertical
    o.vy += g * dt;
    o.y += o.vy * dt;

    // Squash & stretch relaxa suavemente de volta ao neutro (~8/s).
    if (_vooSquash !== 0) {
      var relax = _vooSquash * Math.min(1, dt * 8);
      _vooSquash -= relax;
      if (Math.abs(_vooSquash) < 0.004) _vooSquash = 0;
    }

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
          // Feedback: achata no impacto e dispara som (mola no trampolim).
          _vooSquash = pl.boost ? -0.42 : -0.26;
          if (window.AngatubaGames && window.AngatubaGames.som) {
            if (pl.boost) window.AngatubaGames.som.mola();
            else          window.AngatubaGames.som.pulo();
          }
          // Faíscas no ponto de contato (trampolim reforça).
          if (pl.boost && window.AngatubaGames && window.AngatubaGames.efeitos && _vooCanvas) {
            var rC = _vooCanvas.getBoundingClientRect();
            window.AngatubaGames.efeitos.estrelas(
              rC.left + (o.x / _vooW) * rC.width,
              rC.top + ((pl.y - _vooCamY) / _vooH) * rC.height,
              10
            );
          }
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

    // Altitude normalizada (0 solo → 1 espaço), suavizada pra transição
    // de céu não "pinotear" quando a coruja oscila.
    var altAlvo = Math.max(0, Math.min(1, _vooMaxClimb / _vooAltMax()));
    _vooAlt += (altAlvo - _vooAlt) * Math.min(1, dt * 3);

    // Rastro: registra a posição em coord. de MUNDO (y absoluto), pra
    // desenhar já compensando a câmera. Limita o comprimento.
    _vooTrail.push({ x: o.x, y: o.y });
    if (_vooTrail.length > 14) _vooTrail.shift();

    // Morte: caiu abaixo da tela
    if (o.y - _vooCamY > _vooH + _vooOwlH()) { _vooFim(); return false; }
    return true;
  }

  function _vooDraw() {
    var ctx = _vooCtx;
    if (!ctx) return;
    var W = _vooW, H = _vooH;

    _vooDesenharCeu(ctx, W, H, _vooAlt);

    // Coruja por último (sobre tudo).
    var o = _vooOwl;
    _vooDesenharRastro(ctx);
    _vooDesenharPlataformas(ctx, W, H);
    _vooDesenharCoruja(ctx, o);
  }

  // ── Camada 1: céu (gradiente por altitude) + astro + estrelas + nuvens ──
  function _vooDesenharCeu(ctx, W, H, alt) {
    var par = _vooCorCeu(alt);
    var topo = par[0], base = par[1];
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, _vooRgb(topo));
    grad.addColorStop(1, _vooRgb(base));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Sol/lua: um disco que sobe pra fora de cena e esfria de cor
    // conforme ganhamos altitude (some no espaço). Parallax bem lento.
    var astroOp = Math.max(0, 1 - alt * 1.7);
    if (astroOp > 0.02) {
      var ax = W * 0.74;
      var ay = H * (0.16 + alt * 0.9);            // desce na tela = sobe no mundo
      var ar = W * 0.14;
      var qCor = alt < 0.35
        ? [255, 236, 180]                          // sol quente (manhã)
        : _vooMix([255, 236, 180], [214, 224, 255], Math.min(1, (alt - 0.35) / 0.4)); // esfria p/ lua
      var gA = ctx.createRadialGradient(ax, ay, ar * 0.2, ax, ay, ar * 2.4);
      gA.addColorStop(0, _vooRgba(qCor, 0.9 * astroOp));
      gA.addColorStop(0.4, _vooRgba(qCor, 0.35 * astroOp));
      gA.addColorStop(1, _vooRgba(qCor, 0));
      ctx.fillStyle = gA;
      ctx.beginPath(); ctx.arc(ax, ay, ar * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = _vooRgba(qCor, astroOp);
      ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill();
    }

    // Estrelas: aparecem gradualmente (fade-in a partir de ~alt 0.3) com
    // parallax individual e cintilação suave. Recicladas verticalmente.
    var estOp = Math.max(0, (alt - 0.28) / 0.55);
    if (estOp > 0.02) {
      if (estOp > 1) estOp = 1;
      for (var s = 0; s < _vooEstrelas.length; s++) {
        var st = _vooEstrelas[s];
        var sy = ((st.y - _vooCamY * st.v) % H + H) % H;   // wrap suave
        var tw = 0.55 + 0.45 * Math.sin(_vooTempo * 2.2 + st.f); // cintila
        ctx.fillStyle = 'rgba(255,255,255,' + (estOp * tw).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(st.x, sy, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Nuvens: densas embaixo, somem conforme sobe (opacidade cai com alt).
    var nuvOp = Math.max(0, 1 - alt * 1.5);
    if (nuvOp > 0.02) {
      for (var n = 0; n < _vooNuvens.length; n++) {
        var c = _vooNuvens[n];
        var cy = (c.y - _vooCamY * 0.5);                  // metade da velocidade
        if (cy > H + c.r) { c.y = _vooCamY * 0.5 - c.r - Math.random() * H; c.x = Math.random() * W; }
        ctx.globalAlpha = 0.16 * c.op * nuvOp;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(c.x, cy, c.r, 0, Math.PI * 2);
        ctx.arc(c.x + c.r * 0.7, cy + c.r * 0.15, c.r * 0.72, 0, Math.PI * 2);
        ctx.arc(c.x - c.r * 0.7, cy + c.r * 0.18, c.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Rastro da coruja: bolinhas que somem (mais recente = maior/opaco) ──
  function _vooDesenharRastro(ctx) {
    var m = _vooTrail.length;
    if (m < 2) return;
    var ow = _vooOwlW();
    for (var i = 0; i < m; i++) {
      var t = _vooTrail[i];
      var f = (i + 1) / m;                     // 0→1 (fim = coruja atual)
      var rr = ow * 0.30 * f;
      ctx.globalAlpha = 0.30 * f * f;
      ctx.fillStyle = '#ff3355';
      ctx.beginPath();
      ctx.arc(t.x, t.y - _vooCamY, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Plataformas: sombra + corpo com highlight superior + brilho neon ──
  function _vooDesenharPlataformas(ctx, W, H) {
    var ph = _vooPlatH();
    for (var i = 0; i < _vooPlats.length; i++) {
      var p = _vooPlats[i];
      if (p.usada) continue;
      var y = p.y - _vooCamY;
      if (y < -ph * 2 || y > H + ph * 2) continue;

      var corBase, corTopo, corGlow;
      if (p.tipo === 'move')       { corBase = '#2b7fd6'; corTopo = '#6fc0ff'; corGlow = 'rgba(73,167,255,0.55)'; }
      else if (p.tipo === 'break') { corBase = '#c46a24'; corTopo = '#ffb066'; corGlow = 'rgba(240,145,62,0.5)'; }
      else                         { corBase = '#1f9e68'; corTopo = '#54e6a2'; corGlow = 'rgba(47,212,138,0.5)'; }

      // Sombra projetada (deslocada pra baixo/direita).
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      _vooRoundRect(ctx, p.x + ph * 0.18, y + ph * 0.5, p.w, ph, ph / 2);
      ctx.fill();

      // Glow neon por trás (mais forte no espaço, onde o fundo é escuro).
      ctx.save();
      ctx.shadowColor = corGlow;
      ctx.shadowBlur = ph * (1.2 + _vooAlt * 2.2);
      // Corpo (gradiente vertical: topo claro → base).
      var gP = ctx.createLinearGradient(0, y, 0, y + ph);
      gP.addColorStop(0, corTopo);
      gP.addColorStop(1, corBase);
      _vooRoundRect(ctx, p.x, y, p.w, ph, ph / 2);
      ctx.fillStyle = gP;
      ctx.fill();
      ctx.restore();

      // Faixa de brilho no topo (highlight fininho).
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      _vooRoundRect(ctx, p.x + ph * 0.3, y + ph * 0.16, p.w - ph * 0.6, ph * 0.24, ph * 0.12);
      ctx.fill();

      // Trampolim: mola vermelha em zigue-zague sobre a plataforma.
      if (p.boost) _vooDesenharMola(ctx, p, y, ph);
    }
  }

  // Mola do trampolim (desenho vetorial simples, neon vermelho).
  function _vooDesenharMola(ctx, p, y, ph) {
    var bw = p.w * 0.30;
    var bx = p.x + (p.w - bw) / 2;
    var topY = y - ph * 1.6;
    ctx.save();
    ctx.strokeStyle = '#ff3355';
    ctx.lineWidth = Math.max(2, ph * 0.28);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,51,85,0.7)';
    ctx.shadowBlur = ph * 1.4;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.lineTo(bx + bw, topY + ph * 1.1);
    ctx.lineTo(bx, topY + ph * 0.55);
    ctx.lineTo(bx + bw, topY);
    ctx.stroke();
    // Plaquinha no topo da mola.
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff5a77';
    _vooRoundRect(ctx, bx - ph * 0.15, topY - ph * 0.5, bw + ph * 0.3, ph * 0.5, ph * 0.2);
    ctx.fill();
    ctx.restore();
  }

  // ── Coruja: rotação pela velocidade + squash & stretch + espelho ──
  function _vooDesenharCoruja(ctx, o) {
    var ow = _vooOwlW(), oh = _vooOwlH();

    // Inclinação: sobe → nariz p/ cima; cai → mergulha. Mapeia vy.
    var vNorm = Math.max(-1, Math.min(1, o.vy / (Math.abs(_vooJump()) * 1.1)));
    var ang = vNorm * 0.28;                 // rad (~16°)

    // Squash: _vooSquash<0 achata (impacto), tende a 0. Converte em escalas
    // que preservam volume aproximado.
    var sq = _vooSquash;
    var sx = 1 - sq * 0.5;                   // impacto (sq<0) → mais largo
    var sy = 1 + sq * 0.5;                   // impacto (sq<0) → mais baixo

    ctx.save();
    ctx.translate(o.x, (o.y - _vooCamY));
    if (o.dir < 0) ctx.scale(-1, 1);
    ctx.rotate(o.dir < 0 ? -ang : ang);
    ctx.scale(sx, sy);
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
    // Blindagem de timing: em tela cheia o layout pode ainda nao ter
    // assentado quando medimos acima (arena 0px = tela preta). Remede no
    // proximo frame, quando o CSS de tela cheia ja aplicou a altura real.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        _vooDimensionar();
        if (_vooEstado !== 'jogando') _vooDrawIdle();
      });
    }
  }

  // Desenha um quadro parado (céu de amanhecer) atrás do overlay.
  function _vooDrawIdle() {
    if (!_vooCtx) return;
    _vooDimensionar();
    var ctx = _vooCtx, W = _vooW, H = _vooH;
    var par = _vooCorCeu(0);
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, _vooRgb(par[0]));
    grad.addColorStop(1, _vooRgb(par[1]));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    // Sol quente da manhã, canto superior.
    var ax = W * 0.74, ay = H * 0.2, ar = W * 0.14, q = [255, 236, 180];
    var gA = ctx.createRadialGradient(ax, ay, ar * 0.2, ax, ay, ar * 2.4);
    gA.addColorStop(0, _vooRgba(q, 0.9)); gA.addColorStop(0.4, _vooRgba(q, 0.35)); gA.addColorStop(1, _vooRgba(q, 0));
    ctx.fillStyle = gA; ctx.beginPath(); ctx.arc(ax, ay, ar * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = _vooRgba(q, 1); ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill();
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

    // Som de fim (vitória se bateu recorde, senão neutro).
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(recorde);

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

    // Confete sobre a tela de fim quando bateu recorde.
    if (recorde && window.AngatubaGames && window.AngatubaGames.efeitos) {
      window.AngatubaGames.efeitos.confete('vo-fim', 90);
    }

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