/* ═══════════════════════════════════════════════════════════════
   CORRIDA DA CORUJA — módulo de jogo (lazy-loaded) — v2 PRIMEIRA PESSOA
   Endless runner estilo "Into the Dead" em PRIMEIRA PESSOA e LANDSCAPE:
   a câmera são os olhos do sobrevivente correndo pra frente por uma
   Angatuba tomada por zumbis. Você NÃO se vê — vê a arma na base da
   tela, a mira fixa no centro e os zumbis vindo do nevoeiro. Arraste
   o dedo pros lados pra desviar (strafe/gira a visão) e TOQUE pra
   atirar no que estiver sob a mira central. Munição finita (recarga
   no caminho). Pontuação = metros percorridos.

   LANDSCAPE: o motor SEMPRE pensa em paisagem (W > H). A rotação de
   90° pra caber num celular em pé é feita por CSS no wrapper (.cor-rot),
   então este código lê _corW/_corH já como paisagem e não sabe da
   rotação. Quando o aparelho já está deitado, o CSS não rotaciona nada.

   TÉCNICA (pseudo-3D por escala — sem raycasting, roda liso em Android
   fraco): cada entidade tem z (profundidade, 1=fundo → 0=na cara). A
   cada frame z diminui (vem em direção à câmera). A projeção converte
   z + posição lateral do mundo (camX, movida pelo strafe) em (x,y,s)
   de tela, convergindo pro ponto de fuga no horizonte. Colisão = zumbi
   chega em z~0 perto do centro da visão. Mira = ponto central fixo;
   o tiro acerta o zumbi mais próximo cujo x projetado esteja sob a mira.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     ASSETS opcionais (o jogo funciona 100% em vetor). Base:
     /Jogos/assets/ (J maiúsculo; GitHub Pages é case-sensitive).
       zumbi-normal.webp | zumbi-rapido.webp | zumbi-forte.webp
       municao.webp   → caixa de recarga no chão
       arma.webp      → sprite da arma em 1a pessoa (base da tela)
     Se faltar/falhar, usa fallback vetorial.
  ══════════════════════════════════════════════════════════════ */
  var _COR_ASSET_BASE = '/Jogos/assets/';
  var _corAssets = {};
  function _corAsset(nome) {
    if (_corAssets[nome]) return _corAssets[nome];
    var reg = { img: null, ok: false, w: 0, h: 0 };
    _corAssets[nome] = reg;
    try {
      var im = new Image();
      im.onload = function () { reg.ok = true; reg.w = im.naturalWidth || 0; reg.h = im.naturalHeight || 0; };
      im.onerror = function () { reg.ok = false; };
      im.src = _COR_ASSET_BASE + nome;
      reg.img = im;
    } catch (e) { reg.ok = false; }
    return reg;
  }

  /* ── Estado / canvas ──────────────────────────────────────────── */
  var _corCanvas = null, _corCtx = null;
  var _corW = 640, _corH = 360, _corDpr = 1;
  var _corEstado = 'inicio';
  var _corRAF = 0, _corLast = 0;
  var _corListenersOn = false, _corResizeOn = false;

  /* ── Config do mundo pseudo-3D (1a pessoa) ────────────────────── */
  var _COR_Z_FAR = 1.0;
  var _COR_HORIZ = 0.46;
  var _corCamX = 0, _corCamVX = 0;
  var _COR_CAM_LIM = 1.0;

  /* ── Head-bob / passada (sensação de correr, estilo Into the Dead) ─
     A passada avança proporcional à velocidade. Dela derivamos:
       bobY  = câmera sobe/desce (2 passos por ciclo → freq dobrada)
       swayX = micro-inclinação lateral, 1 por passo (freq simples)
     Mantido SUTIL pra não enjoar. */
  var _corPasso = 0;            // fase acumulada da passada
  var _corBobY = 0;            // deslocamento vertical corrente (px, calc no draw)
  var _corSwayX = 0;           // deslocamento lateral corrente (px, calc no draw)

  /* ── Corrida / dificuldade ────────────────────────────────────── */
  var _corDist = 0;
  var _corVel = 0;
  var _COR_VEL_INI = 0.85, _COR_VEL_MAX = 2.3, _COR_VEL_ACC = 0.02;

  /* ── Munição / tiro ───────────────────────────────────────────── */
  var _COR_MUN_INI = 12;
  var _corMun = _COR_MUN_INI;
  var _COR_TIRO_CD = 0.14;
  var _corTiroT = 0, _corFlashT = 0, _corRecuo = 0;

  /* ── Entidades ────────────────────────────────────────────────── */
  var _corZumbis = [];
  var _corItens = [];
  var _corSangue = [];
  var _corSpawnT = 0, _corItemT = 0;

  var _COR_FAIXAS = [-1, -0.5, 0, 0.5, 1];

  var _COR_TIPOS = {
    normal: { hp: 1, w: 0.16, cor: '#6f7d5a', corEsc: '#4b5640', vel: 1.00 },
    rapido: { hp: 1, w: 0.13, cor: '#8a6f3a', corEsc: '#5e4b26', vel: 1.55 },
    forte:  { hp: 3, w: 0.24, cor: '#5a6f6b', corEsc: '#3c4b48', vel: 0.78 }
  };

  /* ── Persistência ─────────────────────────────────────────────── */
  var _COR_REC_KEY = 'angatuba_corrida_rec';
  function _corRec() {
    try { return Math.max(0, Math.round(Number(localStorage.getItem(_COR_REC_KEY)) || 0)); }
    catch (e) { return 0; }
  }
  function _corRecSet(v) { try { localStorage.setItem(_COR_REC_KEY, String(Math.round(v))); } catch (e) {} }

  /* ── Utils ────────────────────────────────────────────────────── */
  function _corClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function _corRand(a, b) { return a + Math.random() * (b - a); }
  function _corEscolha(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // Projeção pseudo-3D em 1a pessoa. z:0(perto)..1(longe); faixa:-1..1.
  function _corProj(z, faixa) {
    var W = _corW, H = _corH;
    var zc = _corClamp(z, 0, _COR_Z_FAR) / _COR_Z_FAR;
    // Head-bob empurra o horizonte pra baixo quando a câmera "sobe" no
    // passo (a cena inteira sobe/desce junto). Sway empurra lateral.
    var horizonY = H * _COR_HORIZ + _corBobY * H;
    var baseY = H * 1.06 + _corBobY * H;
    var t = 1 - zc;
    var tt = t * t;
    var y = horizonY + (baseY - horizonY) * tt;
    var s = 0.14 + 0.95 * tt;
    var espalhar = 0.08 + 0.92 * tt;
    var cx = W * 0.5 - _corCamX * (W * 0.42) * espalhar + _corSwayX * W * espalhar;
    var x = cx + faixa * (W * 0.42) * espalhar;
    return { x: x, y: y, s: s, t: t };
  }

  /* ══════════════════════════════════════════════════════════════
     DIMENSIONAMENTO. A arena pode estar rotacionada por CSS; usamos
     offsetWidth/Height do canvas (ignoram o transform), que já vêm em
     paisagem porque o CSS dimensiona o .cor-rot em landscape.
  ══════════════════════════════════════════════════════════════ */
  function _corDimensionar() {
    if (!_corCanvas) return;
    var cssW = _corCanvas.offsetWidth || 640;
    var cssH = _corCanvas.offsetHeight || 360;
    _corDpr = Math.min(2, window.devicePixelRatio || 1);
    _corCanvas.width = Math.round(cssW * _corDpr);
    _corCanvas.height = Math.round(cssH * _corDpr);
    _corW = cssW; _corH = cssH;
    if (_corCtx) _corCtx.setTransform(_corDpr, 0, 0, _corDpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════
     RESET
  ══════════════════════════════════════════════════════════════ */
  function _corReset() {
    _corDist = 0; _corVel = _COR_VEL_INI;
    _corMun = _COR_MUN_INI;
    _corTiroT = 0; _corFlashT = 0; _corRecuo = 0;
    _corCamX = 0; _corCamVX = 0;
    _corZumbis.length = 0; _corItens.length = 0; _corSangue.length = 0;
    _corSpawnT = 0.9; _corItemT = 4.5;
    _corAtualizarHUD();
  }
  function _corAtualizarHUD() {
    var d = document.getElementById('cor-dist'); if (d) d.textContent = Math.floor(_corDist) + 'm';
    var m = document.getElementById('cor-mun'); if (m) m.textContent = _corMun;
    var r = document.getElementById('cor-recorde'); if (r) r.textContent = _corRec() + 'm';
  }

  /* ══════════════════════════════════════════════════════════════
     SPAWN
  ══════════════════════════════════════════════════════════════ */
  function _corSpawnZumbi() {
    var d = _corDist;
    var pRapido = _corClamp(0.10 + d / 2600, 0.10, 0.42);
    var pForte  = _corClamp(0.04 + d / 4200, 0.04, 0.30);
    var r = Math.random();
    var tipo = (r < pForte) ? 'forte' : ((r < pForte + pRapido) ? 'rapido' : 'normal');
    var def = _COR_TIPOS[tipo];
    _corZumbis.push({
      z: _COR_Z_FAR, faixa: _corEscolha(_COR_FAIXAS), tipo: tipo,
      hp: def.hp, morto: false, cai: 0, bob: Math.random() * Math.PI * 2,
      swayA: (tipo === 'forte') ? 0 : _corRand(0.02, 0.06),
      swayF: _corRand(1.4, 2.6), swayP: Math.random() * Math.PI * 2
    });
  }
  function _corSpawnItem() {
    _corItens.push({ z: _COR_Z_FAR, faixa: _corEscolha(_COR_FAIXAS), bob: Math.random() * Math.PI * 2 });
  }

  /* ══════════════════════════════════════════════════════════════
     TIRO — mira central fixa.
  ══════════════════════════════════════════════════════════════ */
  function _corAtirar() {
    if (_corEstado !== 'jogando') return;
    if (_corTiroT > 0) return;
    if (_corMun <= 0) {
      if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.erro();
      return;
    }
    _corMun--; _corTiroT = _COR_TIRO_CD; _corFlashT = 0.09; _corRecuo = 1;
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.acerto();

    var miraX = _corW * 0.5;
    var tolBase = _corW * 0.08;
    var alvo = null, melhorZ = 1e9;
    for (var i = 0; i < _corZumbis.length; i++) {
      var zb = _corZumbis[i];
      if (zb.morto) continue;
      var p = _corProj(zb.z, zb.faixa + zb.swayA * Math.sin(zb.swayP));
      var tol = tolBase + _COR_TIPOS[zb.tipo].w * _corW * 0.5 * p.s;
      if (Math.abs(p.x - miraX) > tol) continue;
      if (zb.z < melhorZ) { melhorZ = zb.z; alvo = zb; }
    }

    if (alvo) {
      alvo.hp--;
      if (alvo.hp <= 0) {
        alvo.morto = true; alvo.cai = 0.001;
        var pp = _corProj(alvo.z, alvo.faixa);
        for (var k = 0; k < 7; k++) {
          _corSangue.push({
            x: pp.x + _corRand(-16, 16), y: pp.y - _corRand(6, 40) * pp.s,
            r: _corRand(2, 7) * (0.6 + pp.s), life: 0.5, max: 0.5
          });
        }
        if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.dano();
      } else if (window.AngatubaGames && window.AngatubaGames.efeitos) {
        var pe = _corProj(alvo.z, alvo.faixa);
        window.AngatubaGames.efeitos.estrelas(pe.x, pe.y - 20 * pe.s, 4);
      }
    }
    _corAtualizarHUD();
  }

  /* ══════════════════════════════════════════════════════════════
     UPDATE
  ══════════════════════════════════════════════════════════════ */
  function _corUpdate(dt) {
    _corVel = Math.min(_COR_VEL_MAX, _corVel + _COR_VEL_ACC * dt);
    _corDist += _corVel * dt * 34;

    // Passada: avança com a velocidade. ~2.4 passos/seg em vel baixa,
    // acelerando com a corrida. Deriva head-bob e micro-sway.
    _corPasso += dt * (2.6 + _corVel * 1.6) * Math.PI;
    // bobY: 2 subidas por ciclo de passada (pé esq + pé dir). Amplitude
    // pequena, cresce um tico com a velocidade. Valor em fração de H.
    var ampBob = 0.014 + _corVel * 0.004;
    _corBobY = Math.abs(Math.sin(_corPasso)) * ampBob;      // sempre >=0 (só sobe)
    // swayX: 1 balanço por passo, alterna lados. Bem sutil.
    var ampSway = 0.010 + _corVel * 0.003;
    _corSwayX = Math.sin(_corPasso * 0.5) * ampSway;

    if (_corTiroT > 0) _corTiroT -= dt;
    if (_corFlashT > 0) _corFlashT -= dt;
    if (_corRecuo > 0) _corRecuo = Math.max(0, _corRecuo - dt * 6);
    _corCamVX *= Math.max(0, 1 - dt * 10);

    var intervalo = _corClamp(1.15 - _corDist / 3800, 0.42, 1.15);
    _corSpawnT -= dt;
    if (_corSpawnT <= 0) { _corSpawnZumbi(); _corSpawnT = intervalo * _corRand(0.75, 1.25); }
    _corItemT -= dt;
    if (_corItemT <= 0) { _corSpawnItem(); _corItemT = _corRand(6, 11); }

    var i, zb;
    for (i = _corZumbis.length - 1; i >= 0; i--) {
      zb = _corZumbis[i];
      if (zb.morto) {
        zb.cai += dt;
        if (zb.cai > 0.6) _corZumbis.splice(i, 1);
        continue;
      }
      zb.z -= _corVel * (_COR_TIPOS[zb.tipo].vel) * dt;
      zb.bob += dt * 6;
      zb.swayP += dt * zb.swayF;
      if (zb.z <= 0.05) {
        var meia = (_COR_TIPOS[zb.tipo].w * 0.5) + 0.22;
        if (Math.abs(zb.faixa - _corCamX) < meia) { _corGameOver(); return; }
        else { _corZumbis.splice(i, 1); continue; }
      }
    }

    for (i = _corItens.length - 1; i >= 0; i--) {
      var it = _corItens[i];
      it.z -= _corVel * dt;
      it.bob += dt * 4;
      if (it.z <= 0.07) {
        if (Math.abs(it.faixa - _corCamX) < 0.32) {
          _corMun = Math.min(99, _corMun + 6);
          if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.combo(2);
          if (window.AngatubaGames && window.AngatubaGames.efeitos) {
            var pit = _corProj(it.z, it.faixa);
            window.AngatubaGames.efeitos.estrelas(pit.x, pit.y - 16, 8);
          }
          _corAtualizarHUD();
        }
        _corItens.splice(i, 1);
      }
    }

    for (i = _corSangue.length - 1; i >= 0; i--) {
      var sg = _corSangue[i];
      sg.life -= dt; sg.y += dt * 46;
      if (sg.life <= 0) _corSangue.splice(i, 1);
    }
    _corAtualizarHUD();
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER (1a pessoa)
  ══════════════════════════════════════════════════════════════ */
  function _corDraw() {
    if (!_corCtx) return;
    var ctx = _corCtx, W = _corW, H = _corH, horizonY = H * _COR_HORIZ + _corBobY * H;

    var gCeu = ctx.createLinearGradient(0, 0, 0, horizonY);
    gCeu.addColorStop(0, '#2a1c18'); gCeu.addColorStop(0.6, '#4a2f22'); gCeu.addColorStop(1, '#6b4130');
    ctx.fillStyle = gCeu; ctx.fillRect(0, 0, W, horizonY);

    var lx = W * 0.7, ly = horizonY * 0.4, lr = H * 0.16;
    var gL = ctx.createRadialGradient(lx, ly, lr * 0.2, lx, ly, lr * 2.2);
    gL.addColorStop(0, 'rgba(230,190,150,0.5)'); gL.addColorStop(0.5, 'rgba(200,150,110,0.16)'); gL.addColorStop(1, 'rgba(200,150,110,0)');
    ctx.fillStyle = gL; ctx.beginPath(); ctx.arc(lx, ly, lr * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,180,140,0.55)'; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();

    _corDrawSkyline(ctx, W, horizonY);

    var gCh = ctx.createLinearGradient(0, horizonY, 0, H);
    gCh.addColorStop(0, '#20241c'); gCh.addColorStop(1, '#0e120c');
    ctx.fillStyle = gCh; ctx.fillRect(0, horizonY, W, H - horizonY);

    _corDrawEstrada(ctx, W, H, horizonY);

    var render = [];
    var i;
    for (i = 0; i < _corItens.length; i++) render.push({ k: 'item', o: _corItens[i], z: _corItens[i].z });
    for (i = 0; i < _corZumbis.length; i++) render.push({ k: 'zumbi', o: _corZumbis[i], z: _corZumbis[i].z });
    render.sort(function (a, b) { return b.z - a.z; });
    for (i = 0; i < render.length; i++) {
      if (render[i].k === 'zumbi') _corDrawZumbi(ctx, render[i].o);
      else _corDrawItem(ctx, render[i].o);
    }

    var gFog = ctx.createLinearGradient(0, horizonY - H * 0.05, 0, horizonY + H * 0.34);
    gFog.addColorStop(0, 'rgba(60,52,44,0.94)'); gFog.addColorStop(0.5, 'rgba(60,52,44,0.4)'); gFog.addColorStop(1, 'rgba(60,52,44,0)');
    ctx.fillStyle = gFog; ctx.fillRect(0, horizonY - H * 0.05, W, H * 0.45);

    for (i = 0; i < _corSangue.length; i++) {
      var sg = _corSangue[i];
      ctx.globalAlpha = _corClamp(sg.life / sg.max, 0, 1) * 0.8;
      ctx.fillStyle = '#7a1216';
      ctx.beginPath(); ctx.arc(sg.x, sg.y, sg.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    _corDrawArma(ctx, W, H);
    _corDrawMira(ctx, W, H);

    if (_corFlashT > 0) {
      var fx = W * 0.5, fy = H * (0.72 - _corRecuo * 0.03);
      ctx.globalAlpha = _corClamp(_corFlashT / 0.09, 0, 1);
      var gF = ctx.createRadialGradient(fx, fy, 2, fx, fy, H * 0.14);
      gF.addColorStop(0, 'rgba(255,232,150,0.95)'); gF.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = gF; ctx.beginPath(); ctx.arc(fx, fy, H * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    var gV = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.3, W * 0.5, H * 0.5, H * 0.85);
    gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  function _corDrawSkyline(ctx, W, horizonY) {
    ctx.save();
    ctx.fillStyle = '#1a1512';
    var base = horizonY;
    var off = (-_corCamX * (W * 0.10)) % 90;
    ctx.beginPath(); ctx.moveTo(-40, base);
    var x = -40 - off, seed = 7;
    while (x < W + 40) {
      seed = (seed * 9301 + 49297) % 233280;
      var hh = horizonY * (0.08 + (seed / 233280) * 0.22);
      var ww = 30 + ((seed >> 3) % 26);
      ctx.lineTo(x, base - hh); ctx.lineTo(x + ww, base - hh);
      x += ww + 7;
    }
    ctx.lineTo(W + 40, base); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function _corDrawEstrada(ctx, W, H, horizonY) {
    var fugaX = W * 0.5 - _corCamX * (W * 0.42) * 0.08;
    var cxBot = W * 0.5 - _corCamX * (W * 0.42);
    var topHalf = W * 0.04, botHalf = W * 0.46;
    ctx.fillStyle = '#2b2f24';
    ctx.beginPath();
    ctx.moveTo(fugaX - topHalf, horizonY);
    ctx.lineTo(fugaX + topHalf, horizonY);
    ctx.lineTo(cxBot + botHalf, H);
    ctx.lineTo(cxBot - botHalf, H);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = 'rgba(180,170,140,0.10)'; ctx.lineWidth = 1;
    for (var f = 0; f < _COR_FAIXAS.length; f++) {
      var fa = _COR_FAIXAS[f];
      var xt = fugaX + fa * topHalf, xb = cxBot + fa * botHalf;
      ctx.beginPath(); ctx.moveTo(xt, horizonY); ctx.lineTo(xb, H); ctx.stroke();
    }
    // Tracejado central "correndo" — bem mais rápido pra sensação de corrida.
    var run = (_corDist * 2.4) % 60;
    ctx.strokeStyle = 'rgba(210,200,160,0.16)';
    for (var d = 0; d < 8; d++) {
      var tt = (d * 60 + run) / (8 * 60); var t2 = tt * tt;
      var y1 = horizonY + (H - horizonY) * t2;
      var t2b = Math.min(1, tt + 0.04);
      var y2 = horizonY + (H - horizonY) * (t2b * t2b);
      var cx = W * 0.5 - _corCamX * (W * 0.42) * (0.08 + 0.92 * t2);
      ctx.lineWidth = 1 + 5 * t2;
      ctx.beginPath(); ctx.moveTo(cx, y1); ctx.lineTo(cx, y2); ctx.stroke();
    }
    // Marcas laterais no chão (rachaduras/texturas) subindo rápido em
    // direção à câmera — reforça MUITO a percepção de velocidade.
    var run2 = (_corDist * 3.0) % 40;
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    for (var m = 0; m < 10; m++) {
      var mt = (m * 40 + run2) / (10 * 40); var mt2 = mt * mt;
      var my = horizonY + (H - horizonY) * mt2;
      var half = (topHalf + (botHalf - topHalf) * mt2);
      var mcx = W * 0.5 - _corCamX * (W * 0.42) * (0.08 + 0.92 * mt2);
      var lw = Math.max(1, 3 * mt2);
      ctx.lineWidth = lw;
      // duas marcas curtas, uma de cada lado da estrada
      ctx.beginPath();
      ctx.moveTo(mcx - half * 0.7, my); ctx.lineTo(mcx - half * 0.4, my);
      ctx.moveTo(mcx + half * 0.4, my); ctx.lineTo(mcx + half * 0.7, my);
      ctx.stroke();
    }
  }

  function _corDrawZumbi(ctx, zb) {
    var def = _COR_TIPOS[zb.tipo];
    var faixaAnim = zb.faixa + zb.swayA * Math.sin(zb.swayP);
    var p = _corProj(zb.z, faixaAnim);
    var hpx = 0.5 * _corH * p.s * 0.94;
    var wpx = def.w * _corW * p.s * 1.5;
    var bob = Math.sin(zb.bob) * hpx * 0.03;

    ctx.globalAlpha = 0.35 * (0.4 + p.s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, wpx * 0.6, wpx * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    var mortAlpha = 1, mortScale = 1, mortRot = 0;
    if (zb.morto) { var q = _corClamp(zb.cai / 0.6, 0, 1); mortAlpha = 1 - q; mortScale = 1 - q * 0.4; mortRot = q * 0.9; }
    ctx.globalAlpha = mortAlpha;

    var asset = _corAsset('zumbi-' + zb.tipo + '.webp');
    if (asset && asset.ok && asset.img) {
      var aw = wpx * 2.4 * mortScale, ah = hpx * 2.0 * mortScale;
      ctx.save(); ctx.translate(p.x, p.y - hpx + bob); ctx.rotate(mortRot);
      ctx.drawImage(asset.img, -aw / 2, -ah, aw, ah); ctx.restore();
    } else {
      _corVetorZumbi(ctx, p.x, p.y + bob, wpx * mortScale, hpx * mortScale, def, mortRot);
    }
    ctx.globalAlpha = 1;
  }

  function _corVetorZumbi(ctx, cx, footY, w, h, def, rot) {
    ctx.save(); ctx.translate(cx, footY); if (rot) ctx.rotate(rot);
    ctx.fillStyle = def.cor;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0); ctx.lineTo(w * 0.5, 0);
    ctx.lineTo(w * 0.42, -h * 1.1); ctx.lineTo(-w * 0.42, -h * 1.1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = def.corEsc; ctx.lineWidth = Math.max(2, w * 0.22); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.95); ctx.lineTo(-w * 0.78, -h * 0.66);
    ctx.moveTo(w * 0.3, -h * 0.95); ctx.lineTo(w * 0.78, -h * 0.68);
    ctx.stroke();
    ctx.fillStyle = def.cor; ctx.beginPath(); ctx.arc(0, -h * 1.28, w * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,220,200,0.85)';
    ctx.beginPath(); ctx.arc(-w * 0.12, -h * 1.30, w * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.12, -h * 1.30, w * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function _corDrawItem(ctx, it) {
    var p = _corProj(it.z, it.faixa);
    var s = p.s, bob = Math.sin(it.bob) * 5 * s, sz = 20 * s;
    ctx.globalAlpha = 0.3 * (0.4 + s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 0.9, sz * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var asset = _corAsset('municao.webp');
    if (asset && asset.ok && asset.img) {
      var aw = sz * 2.4, ah = sz * 2.4;
      ctx.drawImage(asset.img, p.x - aw / 2, p.y - ah + bob, aw, ah);
    } else {
      ctx.save(); ctx.translate(p.x, p.y - sz + bob);
      ctx.fillStyle = '#3e5a2e'; ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
      ctx.fillStyle = '#557a3e'; ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 0.35);
      ctx.strokeStyle = '#c33'; ctx.lineWidth = Math.max(2, sz * 0.18);
      ctx.beginPath(); ctx.moveTo(-sz * 0.6, 0); ctx.lineTo(sz * 0.6, 0); ctx.stroke();
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(it.bob));
      ctx.strokeStyle = 'rgba(120,220,120,0.85)'; ctx.lineWidth = 2;
      ctx.strokeRect(-sz - 3, -sz * 0.7 - 3, sz * 2 + 6, sz * 1.4 + 6);
      ctx.globalAlpha = 1; ctx.restore();
    }
  }

  function _corDrawArma(ctx, W, H) {
    var kick = _corRecuo * H * 0.05;
    // Arma balança em contrafase leve com a passada (sincronizada ao bob).
    var swayX = Math.sin(_corPasso * 0.5) * W * 0.012;
    var swayY = Math.abs(Math.sin(_corPasso)) * H * 0.016;
    var baseY = H + kick + swayY;
    var cx = W * 0.5 + swayX;

    var asset = _corAsset('arma.webp');
    if (asset && asset.ok && asset.img) {
      // Arma FPS empunhada: ancoramos pela LARGURA (~105% da tela) pra as
      // asas transbordarem pras bordas laterais — a cara de "segurando a
      // arma" que o Into the Dead tem. A altura vem da proporção; o centro
      // da tela (onde vêm os zumbis) cai na fenda entre as asas, acima do
      // rifle. A imagem deve vir recortada em paisagem larga (~2.2:1) —
      // é o que faz a arma preencher a base sem virar um item flutuante.
      var ratio = (asset.h && asset.w) ? (asset.w / asset.h) : 2.2;  // w/h
      var aw = W * 1.05;
      var ah = aw / ratio;
      ctx.drawImage(asset.img, cx - aw / 2, baseY - ah, aw, ah);
      return;
    }
    ctx.save(); ctx.translate(cx, baseY);
    ctx.fillStyle = '#20242b';
    ctx.beginPath();
    ctx.moveTo(-W * 0.20, 0);
    ctx.lineTo(W * 0.20, 0);
    ctx.lineTo(W * 0.11, -H * 0.16);
    ctx.lineTo(-W * 0.11, -H * 0.16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2c313a';
    ctx.beginPath();
    ctx.moveTo(-W * 0.045, -H * 0.14);
    ctx.lineTo(W * 0.045, -H * 0.14);
    ctx.lineTo(W * 0.016, -H * 0.30);
    ctx.lineTo(-W * 0.016, -H * 0.30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#14171c';
    ctx.beginPath(); ctx.ellipse(0, -H * 0.30, W * 0.018, H * 0.012, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6f5a';
    ctx.beginPath(); ctx.ellipse(-W * 0.10, -H * 0.05, W * 0.05, H * 0.05, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(W * 0.10, -H * 0.05, W * 0.05, H * 0.05, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function _corDrawMira(ctx, W, H) {
    var cx = W * 0.5, cy = H * (_COR_HORIZ + 0.14);
    var sobAlvo = false;
    for (var i = 0; i < _corZumbis.length; i++) {
      var zb = _corZumbis[i]; if (zb.morto) continue;
      var p = _corProj(zb.z, zb.faixa + zb.swayA * Math.sin(zb.swayP));
      var tol = W * 0.08 + _COR_TIPOS[zb.tipo].w * W * 0.5 * p.s;
      if (Math.abs(p.x - cx) < tol && p.y < cy + H * 0.2 && p.y > cy - H * 0.3) { sobAlvo = true; break; }
    }
    var cor = sobAlvo ? 'rgba(255,70,70,0.9)' : 'rgba(255,255,255,0.55)';
    ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.lineCap = 'round';
    var r = H * 0.03, g = H * 0.012;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx - g, cy);
    ctx.moveTo(cx + g, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - g);
    ctx.moveTo(cx, cy + g); ctx.lineTo(cx, cy + r);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fillStyle = cor; ctx.fill();
  }

  /* ══════════════════════════════════════════════════════════════
     LOOP
  ══════════════════════════════════════════════════════════════ */
  function _corLoop(ts) {
    if (_corEstado !== 'jogando') return;
    if (!_corLast) _corLast = ts;
    var dt = (ts - _corLast) / 1000; _corLast = ts;
    if (dt > 0.05) dt = 0.05;
    _corUpdate(dt);
    if (_corEstado === 'jogando') { _corDraw(); _corRAF = requestAnimationFrame(_corLoop); }
  }

  /* ══════════════════════════════════════════════════════════════
     GAME OVER
  ══════════════════════════════════════════════════════════════ */
  function _corGameOver() {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    _corEstado = 'fim';
    var score = Math.floor(_corDist), rec = _corRec(), recorde = score > rec;
    if (recorde) _corRecSet(score);
    _corDraw();
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(recorde);
    if (window.AngatubaGames) window.AngatubaGames.rankSubmeter('corrida', score);

    var owlEl = document.getElementById('cor-fim-owl');
    var titEl = document.getElementById('cor-fim-titulo');
    var ptsEl = document.getElementById('cor-fim-pontos');
    var msgEl = document.getElementById('cor-fim-msg');
    if (owlEl) { owlEl.src = recorde ? '/webp/owl-celebrate-flying.webp' : '/webp/owl-surprised.webp'; owlEl.style.display = ''; }
    if (titEl) titEl.textContent = recorde ? '🎉 Novo recorde!' : 'Fim da linha!';
    if (ptsEl) ptsEl.textContent = score + ' metros';
    if (msgEl) msgEl.textContent = recorde ? 'Você correu mais longe que nunca! 🦉'
      : (rec > 0 ? 'Seu recorde: ' + rec + 'm. Bora de novo?' : 'Arraste pra desviar, toque pra atirar!');
    _corMostrarOverlay('fim');
    if (recorde && window.AngatubaGames && window.AngatubaGames.efeitos) window.AngatubaGames.efeitos.confete('cor-fim', 90);
    if (window.AngatubaGames) window.AngatubaGames.rankFimDeJogo('corrida', 'cor-rank-slot', score);
  }

  /* ══════════════════════════════════════════════════════════════
     CONTROLES — arraste = strafe da câmera; tap = tiro.
     Como a arena pode estar rotacionada 90° por CSS, mapeamos o eixo
     do dedo na tela física pro eixo lateral do JOGO via _corRotacionado.
  ══════════════════════════════════════════════════════════════ */
  function _corRotacionado() {
    try {
      var rot = document.getElementById('cor-rot');
      if (rot && rot.getAttribute('data-rot') === '1') return true;
    } catch (e) {}
    return false;
  }
  function _corXY(e) {
    var t = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }
  var _corDrag = false, _corLast2 = null, _corDownXY = null, _corDownT = 0, _corMoveu = false;

  function _corPointerDown(e) {
    if (_corEstado !== 'jogando') return;
    _corDrag = true;
    _corLast2 = _corXY(e); _corDownXY = _corLast2; _corDownT = (e.timeStamp || Date.now()); _corMoveu = false;
    if (e.cancelable) e.preventDefault();
  }
  function _corPointerMove(e) {
    if (!_corDrag || _corEstado !== 'jogando') return;
    var xy = _corXY(e);
    var dxScreen = xy.x - _corLast2.x;
    var dyScreen = xy.y - _corLast2.y;
    _corLast2 = xy;
    // Rotacionado +90° (topo do jogo aponta pra direita da tela física):
    // arrastar pra BAIXO na tela move pra direita no jogo. Sem rotação:
    // arrastar pra direita move pra direita.
    var mov = _corRotacionado() ? dyScreen : dxScreen;
    var accX = xy.x - _corDownXY.x, accY = xy.y - _corDownXY.y;
    if (Math.sqrt(accX * accX + accY * accY) > 8) _corMoveu = true;
    var escala = 1 / (_corW * 0.5);
    _corCamX = _corClamp(_corCamX + mov * escala, -_COR_CAM_LIM, _COR_CAM_LIM);
    _corCamVX = mov;
    if (e.cancelable) e.preventDefault();
  }
  function _corPointerUp(e) {
    if (_corEstado === 'jogando' && _corDrag) {
      var dtms = ((e && e.timeStamp) || Date.now()) - _corDownT;
      if (!_corMoveu && dtms < 320) _corAtirar();
    }
    _corDrag = false; _corCamVX = 0;
  }
  function _corKey(down, e) {
    if (e.key === 'ArrowLeft') { if (down) { _corCamX = _corClamp(_corCamX - 0.08, -_COR_CAM_LIM, _COR_CAM_LIM); } }
    else if (e.key === 'ArrowRight') { if (down) { _corCamX = _corClamp(_corCamX + 0.08, -_COR_CAM_LIM, _COR_CAM_LIM); } }
    else if (down && (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter')) { _corAtirar(); if (e.preventDefault) e.preventDefault(); }
  }
  function _corLigarControles() {
    if (_corListenersOn || !_corCanvas) return;
    _corCanvas.addEventListener('touchstart', _corPointerDown, { passive: false });
    _corCanvas.addEventListener('touchmove', _corPointerMove, { passive: false });
    _corCanvas.addEventListener('touchend', _corPointerUp);
    _corCanvas.addEventListener('touchcancel', _corPointerUp);
    _corCanvas.addEventListener('mousedown', _corPointerDown);
    window.addEventListener('mousemove', _corPointerMove);
    window.addEventListener('mouseup', _corPointerUp);
    _corCanvas.__coKD = function (e) { _corKey(true, e); };
    _corCanvas.__coKU = function (e) { _corKey(false, e); };
    window.addEventListener('keydown', _corCanvas.__coKD);
    window.addEventListener('keyup', _corCanvas.__coKU);
    _corListenersOn = true;
  }

  /* ══════════════════════════════════════════════════════════════
     ORIENTAÇÃO — rotaciona a arena por CSS quando o device está em
     retrato (data-rot=1) e mostra a dica "gire o celular". Reavalia
     em resize/orientationchange.
  ══════════════════════════════════════════════════════════════ */
  function _corAplicarOrientacao() {
    var rot = document.getElementById('cor-rot');
    var palco = document.getElementById('cor-palco');
    var dica = document.getElementById('cor-gire');
    if (!rot) return;
    var retrato = (window.innerHeight >= window.innerWidth);
    if (retrato && palco) {
      // Mede o palco (que em retrato está alto, ~9/16) e dimensiona o
      // wrapper com os eixos TROCADOS: largura do wrapper = altura do
      // palco, altura = largura do palco. Depois o CSS gira 90°, virando
      // paisagem que preenche exatamente o palco. Pixels explícitos —
      // sem depender de :has() nem de aspect-ratio do wrapper.
      var pr = palco.getBoundingClientRect();
      var pw = Math.max(1, Math.round(pr.width));
      var ph = Math.max(1, Math.round(pr.height));
      rot.setAttribute('data-rot', '1');
      rot.style.width = ph + 'px';
      rot.style.height = pw + 'px';
      rot.style.top = '50%';
      rot.style.left = '50%';
      if (dica) dica.style.display = '';
    } else {
      rot.setAttribute('data-rot', '0');
      rot.style.width = '';
      rot.style.height = '';
      rot.style.top = '';
      rot.style.left = '';
      if (dica) dica.style.display = 'none';
    }
    _corDimensionar();
    if (_corEstado !== 'jogando') _corDrawIdle();
  }

  /* ══════════════════════════════════════════════════════════════
     CICLO DE VIDA
  ══════════════════════════════════════════════════════════════ */
  function _corPreparar() {
    _corCanvas = document.getElementById('cor-canvas');
    if (!_corCanvas) return;
    _corCtx = _corCanvas.getContext('2d');
    _corLigarControles();
    if (!_corResizeOn) {
      var reaval = function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) _corAplicarOrientacao();
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', reaval);
      _corResizeOn = true;
    }
    _corEstado = 'inicio';
    var rec = document.getElementById('cor-recorde'); if (rec) rec.textContent = _corRec() + 'm';
    var d = document.getElementById('cor-dist'); if (d) d.textContent = '0m';
    var m = document.getElementById('cor-mun'); if (m) m.textContent = _COR_MUN_INI;
    _corMostrarOverlay('inicio');
    _corAplicarOrientacao();
    _corDrawIdle();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { _corAplicarOrientacao(); if (_corEstado !== 'jogando') _corDrawIdle(); });
    }
  }

  function _corDrawIdle() {
    if (!_corCtx) return;
    _corDimensionar();
    var ctx = _corCtx, W = _corW, H = _corH, horizonY = H * _COR_HORIZ;
    var gCeu = ctx.createLinearGradient(0, 0, 0, horizonY);
    gCeu.addColorStop(0, '#2a1c18'); gCeu.addColorStop(0.6, '#4a2f22'); gCeu.addColorStop(1, '#6b4130');
    ctx.fillStyle = gCeu; ctx.fillRect(0, 0, W, horizonY);
    _corDrawSkyline(ctx, W, horizonY);
    var gCh = ctx.createLinearGradient(0, horizonY, 0, H);
    gCh.addColorStop(0, '#20241c'); gCh.addColorStop(1, '#0e120c');
    ctx.fillStyle = gCh; ctx.fillRect(0, horizonY, W, H - horizonY);
    _corDrawEstrada(ctx, W, H, horizonY);
    var gFog = ctx.createLinearGradient(0, horizonY - H * 0.05, 0, horizonY + H * 0.34);
    gFog.addColorStop(0, 'rgba(60,52,44,0.9)'); gFog.addColorStop(1, 'rgba(60,52,44,0)');
    ctx.fillStyle = gFog; ctx.fillRect(0, horizonY - H * 0.05, W, H * 0.45);
    _corDrawArma(ctx, W, H);
    _corDrawMira(ctx, W, H);
    var gV = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.3, W * 0.5, H * 0.5, H * 0.85);
    gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  function _corComecar() {
    _corCanvas = document.getElementById('cor-canvas');
    if (!_corCanvas) return;
    if (!_corCtx) _corCtx = _corCanvas.getContext('2d');
    _corLigarControles();
    _corMostrarOverlay(null);
    _corAplicarOrientacao();
    _corReset();
    _corEstado = 'jogando'; _corLast = 0;
    if (_corRAF) cancelAnimationFrame(_corRAF);
    _corRAF = requestAnimationFrame(_corLoop);
  }

  function _corParar() {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    if (_corEstado === 'jogando') _corEstado = 'inicio';
    _corDrag = false;
  }

  function _corMostrarOverlay(qual) {
    var ini = document.getElementById('cor-inicio');
    var fim = document.getElementById('cor-fim');
    if (ini) ini.style.display = (qual === 'inicio') ? '' : 'none';
    if (fim) fim.style.display = (qual === 'fim') ? '' : 'none';
  }

  /* ── Exposição pública ────────────────────────────────────────── */
  window._corComecar = _corComecar;
  window.CorridaGame = { preparar: _corPreparar, comecar: _corComecar, parar: _corParar };
})();