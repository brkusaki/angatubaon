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

  // Metadados dos spritesheets animados (zumbis). Cada sheet é UMA imagem com
  // os frames lado a lado na horizontal. Animamos desenhando o recorte do
  // frame certo por tempo — 100% compatível com qualquer canvas/WebView, sem
  // depender de ImageDecoder (que falha em WebViews antigos do APK).
  var _COR_SHEETS = {
    'zumbi-normal': { arquivo: 'zumbi-normal-sheet.webp', frames: 12, fps: 10 },
    'zumbi-rapido': { arquivo: 'zumbi-rapido-sheet.webp', frames: 12, fps: 12 },
    'zumbi-forte':  { arquivo: 'zumbi-forte-sheet.webp',  frames: 12, fps: 8 }
  };

  // Carrega uma imagem, tentando VÁRIOS nomes em cascata. Isso torna o jogo
  // tolerante a arquivos que subiram com o nome normalizado (sem hífens) —
  // GitHub Pages é case- e hífen-sensitive, então um nome errado dá 404 e o
  // asset nunca aparece. Passamos as variantes e a primeira que carregar vence.
  function _corAssetMulti(nomes) {
    var chave = nomes.join('|');
    if (_corAssets[chave]) return _corAssets[chave];
    var reg = { img: null, ok: false, w: 0, h: 0, nomeOk: null };
    _corAssets[chave] = reg;
    var i = 0;
    function tentar() {
      if (i >= nomes.length) { reg.ok = false; return; }
      var nome = nomes[i++];
      try {
        var im = new Image();
        im.onload = function () {
          reg.ok = true; reg.img = im; reg.nomeOk = nome;
          reg.w = im.naturalWidth || 0; reg.h = im.naturalHeight || 0;
        };
        im.onerror = function () { tentar(); };   // 404 → tenta o próximo nome
        im.src = _COR_ASSET_BASE + nome;
        if (!reg.img) reg.img = im;               // provisório até carregar
      } catch (e) { tentar(); }
    }
    tentar();
    return reg;
  }

  // Gera as variantes de nome de um arquivo: com hífen (original) e sem
  // separadores (caso o upload tenha normalizado).
  function _corVariantes(nome) {
    var v = [nome];
    var semHifen = nome.replace(/-/g, '');
    if (semHifen !== nome) v.push(semHifen);
    var comUnderscore = nome.replace(/-/g, '_');
    if (comUnderscore !== nome) v.push(comUnderscore);
    return v;
  }

  // Carrega uma imagem estática simples (arma, munição, ou um spritesheet),
  // já tentando as variantes de nome.
  function _corAsset(nome) {
    return _corAssetMulti(_corVariantes(nome));
  }

  // Prepara o spritesheet de um zumbi (carrega a imagem única). Idempotente.
  // reg.sheet = registro do _corAsset da imagem; reg.n/fw/fh/durFrame = meta.
  function _corSheet(tipoKey) {
    var chave = '__sheet_' + tipoKey;
    if (_corAssets[chave]) return _corAssets[chave];
    var meta = _COR_SHEETS[tipoKey];
    var reg = { sheet: null, n: 0, fw: 0, fh: 0, durFrame: 100, ok: false };
    _corAssets[chave] = reg;
    if (!meta) return reg;
    reg.n = meta.frames;
    reg.durFrame = 1000 / (meta.fps || 10);
    reg.sheet = _corAsset(meta.arquivo);   // carrega a imagem do sheet
    return reg;
  }

  // Desenha o frame animado atual de um spritesheet no contexto. Retorna true
  // se desenhou (sheet pronto), false se ainda não carregou (usar fallback).
  // (dx,dy) = canto sup-esq do destino; (dw,dh) = tamanho no destino.
  function _corDrawSheetFrame(ctx, tipoKey, tMs, dx, dy, dw, dh) {
    var reg = _corSheet(tipoKey);
    if (!reg || !reg.sheet || !reg.sheet.ok || !reg.sheet.img || !reg.n) return false;
    var img = reg.sheet.img;
    // Largura de cada frame na imagem = largura total / nº de frames.
    var fw = (img.naturalWidth || img.width) / reg.n;
    var fh = (img.naturalHeight || img.height);
    var total = reg.n * reg.durFrame;
    var idx = Math.floor((tMs % total) / reg.durFrame);
    if (idx < 0) idx = 0; if (idx >= reg.n) idx = reg.n - 1;
    ctx.drawImage(img, idx * fw, 0, fw, fh, dx, dy, dw, dh);
    return true;
  }

  // Proporção (w/h) de um frame do sheet, pra não distorcer.
  function _corSheetRatio(tipoKey) {
    var reg = _corSheet(tipoKey);
    if (!reg || !reg.sheet || !reg.sheet.ok || !reg.sheet.img || !reg.n) return 0.7;
    var img = reg.sheet.img;
    var fw = (img.naturalWidth || img.width) / reg.n;
    var fh = (img.naturalHeight || img.height);
    return fh ? (fw / fh) : 0.7;
  }

  /* ── Estado / canvas ──────────────────────────────────────────── */
  var _corCanvas = null, _corCtx = null;
  var _corW = 640, _corH = 360, _corDpr = 1;
  var _corEstado = 'inicio';
  var _corRAF = 0, _corLast = 0;
  var _corListenersOn = false, _corResizeOn = false;
  var _corRelogio = 0;    // tempo global (ms) p/ escolher frame das animações

  /* ── Config do mundo pseudo-3D (1a pessoa) ────────────────────── */
  var _COR_Z_FAR = 1.0;
  var _COR_HORIZ = 0.46;
  var _corCamX = 0, _corCamVX = 0;
  var _COR_CAM_LIM = 6.0;   // bem largo: sensação de campo livre (zumbis
                            // nascem relativos à câmera, então nunca "acaba")

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
  // Calibrado pra dar TEMPO DE VER E DESVIAR (Into the Dead):
  //   início  → zumbi normal leva ~9s do horizonte até você
  //   máximo  → ~5s (ainda confortável), atingido bem devagar
  var _COR_VEL_INI = 0.105, _COR_VEL_MAX = 0.19, _COR_VEL_ACC = 0.0012;

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

  // Campo ABERTO: os zumbis nascem em qualquer x lateral contínuo dentro
  // deste range (em unidades de faixa; -1.6..1.6 cobre além das bordas pra
  // eles entrarem/saírem de campo naturalmente). Sem faixas discretas.
  var _COR_CAMPO_LAT = 1.6;
  // População alvo de zumbis vivos na tela (mantém 3-6 visíveis).
  var _COR_POP_MIN = 4, _COR_POP_MAX = 7;

  var _COR_TIPOS = {
    normal: { hp: 1, w: 0.16, cor: '#6f7d5a', corEsc: '#4b5640', vel: 1.00 },
    rapido: { hp: 1, w: 0.13, cor: '#8a6f3a', corEsc: '#5e4b26', vel: 1.35 },
    forte:  { hp: 3, w: 0.24, cor: '#5a6f6b', corEsc: '#3c4b48', vel: 0.80 }
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
    var cssW, cssH;
    // Com lock nativo (APK girado), o offsetWidth do canvas pode demorar a
    // refletir o giro. Medimos preferencialmente pelo PALCO (que é o container
    // real e já está com o tamanho da tela girada); se falhar, viewport; por
    // último, offsetWidth do canvas.
    var palco = document.getElementById('cor-palco');
    if (_corLockNativo && palco) {
      var pr = palco.getBoundingClientRect();
      cssW = Math.round(pr.width) || _corCanvas.offsetWidth || 640;
      cssH = Math.round(pr.height) || _corCanvas.offsetHeight || 360;
    } else {
      cssW = _corCanvas.offsetWidth || 640;
      cssH = _corCanvas.offsetHeight || 360;
    }
    if (cssW < 2) cssW = 640;
    if (cssH < 2) cssH = 360;
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
    var pRapido = _corClamp(0.08 + d / 3000, 0.08, 0.36);
    var pForte  = _corClamp(0.04 + d / 4600, 0.04, 0.28);
    var r = Math.random();
    var tipo = (r < pForte) ? 'forte' : ((r < pForte + pRapido) ? 'rapido' : 'normal');
    var def = _COR_TIPOS[tipo];
    // Campo aberto: zumbis nascem RELATIVOS à posição da câmera (sempre no
    // teu campo de visão atual), pra o campo nunca "acabar" quando você anda
    // muito pro lado. Espalhados numa faixa de ±1.6 ao redor de onde olha.
    var faixa = _corCamX + _corRand(-_COR_CAMPO_LAT, _COR_CAMPO_LAT);
    // z inicial variado (perto de Z_FAR, mas escalonado) pra não nascerem
    // todos na mesma linha de profundidade.
    var z = _COR_Z_FAR - _corRand(0, 0.18);
    _corZumbis.push({
      z: z, faixa: faixa, tipo: tipo,
      hp: def.hp, morto: false, cai: 0, bob: Math.random() * Math.PI * 2,
      // deriva lateral lenta (cambaleio pelo campo)
      swayA: (tipo === 'forte') ? _corRand(0.01, 0.03) : _corRand(0.03, 0.08),
      swayF: _corRand(0.8, 1.8), swayP: Math.random() * Math.PI * 2,
      // cada zumbi tem uma leve variação de velocidade individual
      velVar: _corRand(0.85, 1.15)
    });
  }
  function _corSpawnItem() {
    // Relativo à câmera, como os zumbis — senão você anda pro lado e nunca
    // mais encontra munição.
    _corItens.push({ z: _COR_Z_FAR, faixa: _corCamX + _corRand(-1.0, 1.0), bob: Math.random() * Math.PI * 2 });
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
    // Distância em "metros": fator reduzido pra dar ritmo de pessoa correndo,
    // não de veículo. Com vel~0.16-0.34 e fator 16, ~5-9 m/s (18-32 km/h no
    // pico), mas começa devagar e a sensação casa com o passo.
    _corDist += _corVel * dt * 16;

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

    // Spawn por POPULAÇÃO: mantém entre POP_MIN e POP_MAX zumbis vivos na
    // tela (campo aberto cheio, estilo Into the Dead). Conta os vivos.
    var vivos = 0;
    for (var vi = 0; vi < _corZumbis.length; vi++) if (!_corZumbis[vi].morto) vivos++;
    _corSpawnT -= dt;
    if (_corSpawnT <= 0) {
      if (vivos < _COR_POP_MIN) {
        // Abaixo do mínimo: repõe rápido (spawna 1-2 de uma vez).
        _corSpawnZumbi();
        if (vivos < _COR_POP_MIN - 1) _corSpawnZumbi();
        _corSpawnT = _corRand(0.25, 0.6);
      } else if (vivos < _COR_POP_MAX) {
        // Entre min e max: spawna esporádico.
        _corSpawnZumbi();
        _corSpawnT = _corRand(0.8, 1.6);
      } else {
        // Cheio: espera esvaziar um pouco.
        _corSpawnT = _corRand(0.5, 1.0);
      }
    }
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
      zb.z -= _corVel * (_COR_TIPOS[zb.tipo].vel) * (zb.velVar || 1) * dt;
      zb.bob += dt * 4;
      zb.swayP += dt * zb.swayF;
      if (zb.z <= 0.05) {
        var meia = (_COR_TIPOS[zb.tipo].w * 0.5) + 0.20;
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

    // ── Céu sombrio (cinza-esverdeado apocalíptico) ──
    var gCeu = ctx.createLinearGradient(0, 0, 0, horizonY);
    gCeu.addColorStop(0, '#3a4048'); gCeu.addColorStop(0.55, '#4c5259'); gCeu.addColorStop(1, '#5f6560');
    ctx.fillStyle = gCeu; ctx.fillRect(0, 0, W, horizonY);

    // Lua/sol pálido velado, alto no céu.
    var lx = W * 0.74, ly = horizonY * 0.36, lr = H * 0.14;
    var gL = ctx.createRadialGradient(lx, ly, lr * 0.2, lx, ly, lr * 2.4);
    gL.addColorStop(0, 'rgba(210,205,195,0.45)'); gL.addColorStop(0.5, 'rgba(180,175,165,0.14)'); gL.addColorStop(1, 'rgba(180,175,165,0)');
    ctx.fillStyle = gL; ctx.beginPath(); ctx.arc(lx, ly, lr * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(205,200,188,0.5)'; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();

    // ── Floresta de silhuetas no horizonte (parallax pelo strafe) ──
    _corDrawFloresta(ctx, W, horizonY);

    // ── Chão (campo) — do horizonte pra baixo, tom escuro esverdeado ──
    var gCh = ctx.createLinearGradient(0, horizonY, 0, H);
    gCh.addColorStop(0, '#2f3830'); gCh.addColorStop(0.5, '#232a24'); gCh.addColorStop(1, '#141813');
    ctx.fillStyle = gCh; ctx.fillRect(0, horizonY, W, H - horizonY);

    // Textura sutil do campo correndo (linhas de perspectiva suaves, campo
    // aberto — sem estrada estreita).
    _corDrawCampo(ctx, W, H, horizonY);

    // ── Entidades (zumbis + itens) do fundo pra frente ──
    var render = [];
    var i;
    for (i = 0; i < _corItens.length; i++) render.push({ k: 'item', o: _corItens[i], z: _corItens[i].z });
    for (i = 0; i < _corZumbis.length; i++) render.push({ k: 'zumbi', o: _corZumbis[i], z: _corZumbis[i].z });
    render.sort(function (a, b) { return b.z - a.z; });
    for (i = 0; i < render.length; i++) {
      if (render[i].k === 'zumbi') _corDrawZumbi(ctx, render[i].o);
      else _corDrawItem(ctx, render[i].o);
    }

    // ── Névoa densa na faixa do horizonte (esconde o spawn) ──
    var gFog = ctx.createLinearGradient(0, horizonY - H * 0.08, 0, horizonY + H * 0.30);
    gFog.addColorStop(0, 'rgba(150,155,150,0.55)'); gFog.addColorStop(0.45, 'rgba(140,148,142,0.28)'); gFog.addColorStop(1, 'rgba(140,148,142,0)');
    ctx.fillStyle = gFog; ctx.fillRect(0, horizonY - H * 0.08, W, H * 0.4);

    // ── Respingos de sangue ──
    for (i = 0; i < _corSangue.length; i++) {
      var sg = _corSangue[i];
      ctx.globalAlpha = _corClamp(sg.life / sg.max, 0, 1) * 0.8;
      ctx.fillStyle = '#6a2812';
      ctx.beginPath(); ctx.arc(sg.x, sg.y, sg.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Mato em PRIMEIRO PLANO (silhuetas de grama na base, como Into the
    // Dead) — desenhado ANTES da arma, atrás dela. ──
    _corDrawMato(ctx, W, H);

    // ── Arma + mira ──
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

    // Vinheta escura (clima sombrio, mais forte que antes).
    var gV = ctx.createRadialGradient(W * 0.5, H * 0.48, H * 0.28, W * 0.5, H * 0.5, H * 0.9);
    gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  // Floresta de pinheiros (silhuetas serrilhadas) no horizonte.
  function _corDrawFloresta(ctx, W, horizonY) {
    ctx.save();
    ctx.fillStyle = '#181d18';
    var base = horizonY + 2;
    var off = (-_corCamX * (W * 0.08)) % 40;
    var x = -40 - off, seed = 13;
    ctx.beginPath(); ctx.moveTo(-40, base);
    while (x < W + 40) {
      seed = (seed * 9301 + 49297) % 233280;
      var hh = horizonY * (0.06 + (seed / 233280) * 0.14);   // altura da árvore
      var ww = 8 + ((seed >> 4) % 10);                        // largura
      // pinheiro triangular
      ctx.lineTo(x, base);
      ctx.lineTo(x + ww * 0.5, base - hh);
      ctx.lineTo(x + ww, base);
      x += ww * 0.7;
    }
    ctx.lineTo(W + 40, base); ctx.closePath(); ctx.fill();
    // segunda fileira mais clara/distante atrás
    ctx.fillStyle = 'rgba(40,46,44,0.6)';
    var off2 = (-_corCamX * (W * 0.05)) % 30;
    x = -40 - off2; seed = 29;
    ctx.beginPath(); ctx.moveTo(-40, base - horizonY * 0.02);
    while (x < W + 40) {
      seed = (seed * 9301 + 49297) % 233280;
      var hh2 = horizonY * (0.04 + (seed / 233280) * 0.10);
      var ww2 = 7 + ((seed >> 4) % 8);
      ctx.lineTo(x, base - horizonY * 0.02);
      ctx.lineTo(x + ww2 * 0.5, base - horizonY * 0.02 - hh2);
      ctx.lineTo(x + ww2, base - horizonY * 0.02);
      x += ww2 * 0.7;
    }
    ctx.lineTo(W + 40, base - horizonY * 0.02); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Campo aberto: linhas de perspectiva MUITO suaves convergindo pro fuga,
  // dando noção de movimento sem a "estrada" estreita. Ocupa a largura toda.
  function _corDrawCampo(ctx, W, H, horizonY) {
    var fugaX = W * 0.5 - _corCamX * (W * 0.30) * 0.1;
    // Linhas radiais suaves saindo do ponto de fuga pra base (campo inteiro).
    ctx.strokeStyle = 'rgba(120,130,115,0.05)';
    ctx.lineWidth = 1;
    for (var k = -6; k <= 6; k++) {
      var xb = W * 0.5 + k * (W * 0.16) - _corCamX * (W * 0.30);
      ctx.beginPath(); ctx.moveTo(fugaX, horizonY); ctx.lineTo(xb, H); ctx.stroke();
    }
    // "Ondas" horizontais correndo em direção à câmera (textura do chão).
    var run = (_corDist * 1.6) % 100;
    ctx.strokeStyle = 'rgba(90,100,85,0.06)';
    for (var d = 0; d < 10; d++) {
      var tt = (d * 100 + run) / (10 * 100); var t2 = tt * tt;
      var y = horizonY + (H - horizonY) * t2;
      ctx.lineWidth = 1 + 3 * t2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  // Mato em primeiro plano: tufos de grama escura na base da tela, com leve
  // balanço pela passada. Duas camadas (atrás mais clara, frente preta).
  function _corDrawMato(ctx, W, H) {
    var swayG = Math.sin(_corPasso * 0.5) * W * 0.008;
    // camada de trás (mais clara, tufos menores)
    _corDrawTufos(ctx, W, H, H * 0.82, W * 0.045, 'rgba(20,26,20,0.75)', swayG * 0.5, 17);
    // camada da frente (preta, tufos maiores, cobre a base)
    _corDrawTufos(ctx, W, H, H * 0.90, W * 0.075, 'rgba(6,9,6,0.96)', swayG, 11);
  }
  function _corDrawTufos(ctx, W, H, topY, larg, cor, sway, seedBase) {
    ctx.save();
    ctx.fillStyle = cor;
    var seed = seedBase;
    var x = -larg;
    while (x < W + larg) {
      seed = (seed * 9301 + 49297) % 233280;
      var altura = (H - topY) * (0.55 + (seed / 233280) * 0.7);
      var lw = larg * (0.6 + (seed / 233280));
      var cx = x + sway * (0.5 + (seed / 233280));
      // tufo = triângulo pontudo pra cima
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.5, H);
      ctx.quadraticCurveTo(cx - lw * 0.15, H - altura * 0.7, cx, H - altura);
      ctx.quadraticCurveTo(cx + lw * 0.15, H - altura * 0.7, cx + lw * 0.5, H);
      ctx.closePath(); ctx.fill();
      x += larg * 0.55;
    }
    ctx.restore();
  }


  function _corDrawZumbi(ctx, zb) {
    var def = _COR_TIPOS[zb.tipo];
    var faixaAnim = zb.faixa + zb.swayA * Math.sin(zb.swayP);
    var p = _corProj(zb.z, faixaAnim);
    var hpx = 0.5 * _corH * p.s * 0.94;
    // Largura derivada da ALTURA (proporção consistente em qualquer tela).
    // Antes usava _corW, que em landscape inflava demais e deformava o vetor.
    var wpx = hpx * 0.62 * (def.w / 0.16);   // normaliza pela largura-base do tipo
    var bob = Math.sin(zb.bob) * hpx * 0.03;

    ctx.globalAlpha = 0.35 * (0.4 + p.s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, wpx * 0.6, wpx * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    var mortAlpha = 1, mortScale = 1, mortRot = 0;
    if (zb.morto) { var q = _corClamp(zb.cai / 0.6, 0, 1); mortAlpha = 1 - q; mortScale = 1 - q * 0.4; mortRot = q * 0.9; }
    ctx.globalAlpha = mortAlpha;

    // Spritesheet animado (universal). Proporção real do frame pra não esticar.
    var fr = _corSheetRatio(zb.tipo);
    var ah = hpx * 2.0 * mortScale, aw = ah * fr;
    ctx.save(); ctx.translate(p.x, p.y - hpx + bob); ctx.rotate(mortRot);
    var desenhou = _corDrawSheetFrame(ctx, zb.tipo, _corRelogio, -aw / 2, -ah, aw, ah);
    ctx.restore();
    if (!desenhou) {
      // Sheet não carregou. Tenta o webp estático antigo (imagem real, sem
      // animar) — melhor que o vetor. Só cai no vetor se nem isso existir.
      var est = _corAsset('zumbi-' + zb.tipo + '.webp');
      if (est && est.ok && est.img && est.w && est.h) {
        var er = est.w / est.h;
        var eah = hpx * 2.0 * mortScale, eaw = eah * er;
        ctx.save(); ctx.translate(p.x, p.y - hpx + bob); ctx.rotate(mortRot);
        ctx.drawImage(est.img, -eaw / 2, -eah, eaw, eah); ctx.restore();
      } else {
        _corVetorZumbi(ctx, p.x, p.y + bob, wpx * mortScale, hpx * mortScale, def, mortRot);
      }
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
      // Arma FPS empunhada na base. Ancoramos pela largura pra as asas
      // transbordarem, MAS com TETO de altura pra não cobrir a tela em
      // telas landscape largas (celular deitado tem proporção ~2.2:1, então
      // largura×105% daria altura maior que a tela). O teto garante que a
      // arma ocupe no máx ~52% da altura, deixando o campo de visão livre.
      var ratio = (asset.h && asset.w) ? (asset.w / asset.h) : 2.2;  // w/h
      var aw = W * 1.05;
      var ah = aw / ratio;
      var ahMax = H * 0.52;
      if (ah > ahMax) { ah = ahMax; aw = ah * ratio; }
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
    _corRelogio = ts;                 // relógio p/ animação dos webp
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
     ORIENTAÇÃO NATIVA — pede ao sistema pra girar pra landscape (só
     funciona se o manifest tiver "orientation":"any" e no APK/instalado).
     Quando o lock nativo PEGA, o próprio SO gira a tela: o palco já vira
     paisagem e NÃO devemos rotacionar por CSS (senão gira 2x). A flag
     _corLockNativo indica se o lock foi aceito.
  ══════════════════════════════════════════════════════════════ */
  var _corLockNativo = false;
  function _corTravarLandscape() {
    try {
      if (screen && screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock('landscape');
        if (p && p.then) {
          p.then(function () {
            _corLockNativo = true;
            _corAplicarOrientacao();
            if (_corEstado !== 'jogando') _corDrawIdle();
          }).catch(function () {
            _corLockNativo = false;   // navegador comum recusa → usa CSS
          });
        }
      }
    } catch (e) { _corLockNativo = false; }
  }
  function _corDestravarOrientacao() {
    try {
      if (screen && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
    _corLockNativo = false;
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
    // Se o lock NATIVO pegou, o SO já girou a tela pra paisagem: NÃO
    // rotacionamos por CSS (seria girar 2x) e escondemos a dica.
    if (_corLockNativo) {
      rot.setAttribute('data-rot', '0');
      rot.style.width = ''; rot.style.height = ''; rot.style.top = ''; rot.style.left = '';
      if (dica) dica.style.display = 'none';
      _corDimensionar();
      if (_corEstado !== 'jogando') _corDrawIdle();
      return;
    }
    // Detecta retrato pelas dimensões REAIS do palco (mais confiável em
    // fullscreen PWA que window.innerWidth/Height, que às vezes vêm errados).
    // Fallback pro window se o palco ainda não tiver dimensões.
    var retrato;
    var pr = palco ? palco.getBoundingClientRect() : null;
    if (pr && pr.width > 2 && pr.height > 2) {
      retrato = (pr.height >= pr.width);
    } else {
      retrato = (window.innerHeight >= window.innerWidth);
    }
    if (retrato && palco && pr) {
      // Mede o palco (em retrato, alto) e dimensiona o wrapper com os eixos
      // TROCADOS: largura do wrapper = altura do palco, altura = largura.
      // O CSS gira 90°, virando paisagem que preenche o palco.
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
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _corAplicarOrientacao();
          if (_corEstado !== 'jogando') _corDrawIdle();
        }
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', reaval);
      // O giro do lock nativo dispara 'change' no screen.orientation QUANDO
      // a tela realmente terminou de girar (o .then do lock resolve antes
      // disso). Aqui remedimos o canvas com as dimensões finais.
      try {
        if (screen && screen.orientation && screen.orientation.addEventListener) {
          screen.orientation.addEventListener('change', function () {
            // Várias remedições porque o layout assenta em passos.
            reaval();
            setTimeout(reaval, 60);
            setTimeout(reaval, 200);
            setTimeout(reaval, 450);
          });
        }
      } catch (e) {}
      _corResizeOn = true;
    }
    _corEstado = 'inicio';
    var rec = document.getElementById('cor-recorde'); if (rec) rec.textContent = _corRec() + 'm';
    var d = document.getElementById('cor-dist'); if (d) d.textContent = '0m';
    var m = document.getElementById('cor-mun'); if (m) m.textContent = _COR_MUN_INI;
    // Dispara a decodificação dos zumbis animados desde já (baixa + extrai
    // frames em background; o fallback vetor cobre enquanto não chega).
    // Pré-carrega os spritesheets dos zumbis (imagens únicas; o fallback
    // vetor cobre enquanto não chegam).
    _corSheet('zumbi-normal');
    _corSheet('zumbi-rapido');
    _corSheet('zumbi-forte');
    // Pede ao sistema pra girar pra landscape (APK/instalado com manifest
    // "any"). No navegador comum é recusado e caímos na rotação CSS.
    _corTravarLandscape();
    _corMostrarOverlay('inicio');
    _corAplicarOrientacaoRepetido();
    _corDrawIdle();
  }

  // O fullscreen do celular muda o tamanho do palco de forma ASSÍNCRONA e em
  // tempo variável (às vezes 300ms). Reaplicamos a orientação várias vezes
  // após abrir, pra garantir que a rotação use as dimensões finais do palco.
  function _corAplicarOrientacaoRepetido() {
    _corAplicarOrientacao();
    var atrasos = [50, 150, 300, 500, 800];
    for (var i = 0; i < atrasos.length; i++) {
      setTimeout(function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _corAplicarOrientacao();
          if (_corEstado !== 'jogando') _corDrawIdle();
        }
      }, atrasos[i]);
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        _corAplicarOrientacao();
        if (_corEstado !== 'jogando') _corDrawIdle();
      });
    }
  }

  function _corDrawIdle() {
    if (!_corCtx) return;
    _corDimensionar();
    var ctx = _corCtx, W = _corW, H = _corH, horizonY = H * _COR_HORIZ;
    var gCeu = ctx.createLinearGradient(0, 0, 0, horizonY);
    gCeu.addColorStop(0, '#3a4048'); gCeu.addColorStop(0.55, '#4c5259'); gCeu.addColorStop(1, '#5f6560');
    ctx.fillStyle = gCeu; ctx.fillRect(0, 0, W, horizonY);
    // lua
    var lx = W * 0.74, ly = horizonY * 0.36, lr = H * 0.14;
    var gL = ctx.createRadialGradient(lx, ly, lr * 0.2, lx, ly, lr * 2.4);
    gL.addColorStop(0, 'rgba(210,205,195,0.45)'); gL.addColorStop(1, 'rgba(180,175,165,0)');
    ctx.fillStyle = gL; ctx.beginPath(); ctx.arc(lx, ly, lr * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(205,200,188,0.5)'; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
    _corDrawFloresta(ctx, W, horizonY);
    var gCh = ctx.createLinearGradient(0, horizonY, 0, H);
    gCh.addColorStop(0, '#2f3830'); gCh.addColorStop(0.5, '#232a24'); gCh.addColorStop(1, '#141813');
    ctx.fillStyle = gCh; ctx.fillRect(0, horizonY, W, H - horizonY);
    _corDrawCampo(ctx, W, H, horizonY);
    var gFog = ctx.createLinearGradient(0, horizonY - H * 0.08, 0, horizonY + H * 0.3);
    gFog.addColorStop(0, 'rgba(150,155,150,0.55)'); gFog.addColorStop(1, 'rgba(140,148,142,0)');
    ctx.fillStyle = gFog; ctx.fillRect(0, horizonY - H * 0.08, W, H * 0.4);
    _corDrawMato(ctx, W, H);
    _corDrawArma(ctx, W, H);
    _corDrawMira(ctx, W, H);
    var gV = ctx.createRadialGradient(W * 0.5, H * 0.48, H * 0.28, W * 0.5, H * 0.5, H * 0.9);
    gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  function _corComecar() {
    _corCanvas = document.getElementById('cor-canvas');
    if (!_corCanvas) return;
    if (!_corCtx) _corCtx = _corCanvas.getContext('2d');
    _corLigarControles();
    _corMostrarOverlay(null);
    _corTravarLandscape();
    _corAplicarOrientacaoRepetido();
    _corReset();
    _corEstado = 'jogando'; _corLast = 0;
    if (_corRAF) cancelAnimationFrame(_corRAF);
    _corRAF = requestAnimationFrame(_corLoop);
  }

  function _corParar() {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    if (_corEstado === 'jogando') _corEstado = 'inicio';
    _corDrag = false;
    _corDestravarOrientacao();     // volta a orientação do sistema ao normal
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