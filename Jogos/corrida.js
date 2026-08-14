/* ═══════════════════════════════════════════════════════════════
   CORRIDA DA CORUJA — módulo de jogo (lazy-loaded)
   Endless runner estilo "Into the Dead": a coruja corre pra frente
   por uma Angatuba apocalíptica enevoada; o jogador ARRASTA o dedo
   pros lados pra desviar dos zumbis e dá TAP pra atirar (munição
   finita, recarga aparece no caminho). Pontuação = metros percorridos.

   Carregado sob demanda por /Jogos/ quando o usuário abre o jogo.
   Comunica-se com o app APENAS via window.AngatubaGames (a ponte).
   Expõe window.CorridaGame = { preparar, comecar, parar } e mantém
   window._corComecar pro onclick inline do botão no HTML.

   TÉCNICA (pseudo-3D por escala, sem raycasting — roda liso em
   Android fraco): cada entidade tem um z (profundidade). A cada frame
   z diminui (vem em direção à coruja). A projeção converte z em:
     escala  = perto grande / longe pequeno
     y (tela)= horizonte (longe) → base (perto)
     x (tela)= faixa lateral projetada em relação ao ponto de fuga
   A coruja fica fixa embaixo; o arraste move o "corredor" (offset
   lateral do mundo). Colisão = zumbi cruza a zona de proximidade da
   coruja desalinhado (ou é morto antes por tiro). Névoa densa no
   fundo esconde o spawn — é o coração da tensão do gênero.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Sprites (owl) — degradam pra desenho vetorial se faltarem ── */
  var _corOwlSrc = '/webp/owl-flying.webp';
  var _corOwlImg = null, _corOwlOk = false, _corOwlRatio = 1;   // ratio = h/w

  function _corCarregarImg() {
    if (_corOwlImg) return;
    try {
      _corOwlImg = new Image();
      _corOwlImg.onload = function () {
        _corOwlOk = true;
        if (_corOwlImg.naturalWidth) _corOwlRatio = _corOwlImg.naturalHeight / _corOwlImg.naturalWidth;
      };
      _corOwlImg.onerror = function () { _corOwlOk = false; };
      _corOwlImg.src = _corOwlSrc;
    } catch (e) { _corOwlOk = false; }
  }

  /* ══════════════════════════════════════════════════════════════
     SISTEMA DE ASSETS (opcional — o jogo funciona 100% em vetor)
     — Base: /Jogos/assets/ (J maiúsculo; GitHub Pages é case-sensitive).
     — Cada asset é OPCIONAL: se faltar/falhar, usa fallback vetorial.
       Assim dá pra ir criando as imagens aos poucos e elas "acendem"
       sozinhas. O SW cacheia no 1º fetch (não precisa precache).
     — Convenção de arquivos (todos webp):
         zumbi-normal.webp | zumbi-rapido.webp | zumbi-forte.webp
         (opcional: sufixo de frame -a/-b pra andar, ex.: zumbi-normal-a.webp)
         municao.webp   → item de recarga no chão
         cenario-<n>.webp → silhueta de fundo (praça, igreja, etc.), n=0..N
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
  var _corW = 360, _corH = 640, _corDpr = 1;
  var _corEstado = 'inicio';           // 'inicio' | 'jogando' | 'fim'
  var _corRAF = 0, _corLast = 0;
  var _corListenersOn = false, _corResizeOn = false;

  /* ── Config do mundo pseudo-3D ────────────────────────────────── */
  // z vai de Z_FAR (spawn, bem no fundo) até 0 (na altura da coruja).
  var _COR_Z_FAR = 1.0;
  // Ponto de fuga (fração da tela). Horizonte fica um pouco acima do meio.
  var _COR_HORIZ = 0.42;               // y do horizonte (fração de H)
  // A "estrada" tem largura lógica em unidades de faixa: -1 (esq) .. +1 (dir).
  // A coruja anda dentro dessa faixa; o mundo desliza no eixo lateral.
  var _COR_FAIXA = 1.0;                // meia-largura jogável em unidades

  /* ── Jogador (coruja) ─────────────────────────────────────────── */
  var _corOwl = { x: 0, vx: 0, dir: 0 };   // x em unidades de faixa (-1..1)
  var _corDrag = false, _corLastPX = 0, _corKeyDir = 0;

  /* ── Corrida / dificuldade ────────────────────────────────────── */
  var _corDist = 0;                    // metros percorridos (score)
  var _corVel = 0;                     // velocidade atual (unid z/seg)
  var _COR_VEL_INI = 0.85;             // velocidade inicial
  var _COR_VEL_MAX = 2.2;              // teto de velocidade
  var _COR_VEL_ACC = 0.018;            // aceleração por segundo
  var _corMundoX = 0;                  // deslocamento lateral acumulado do fundo

  /* ── Munição / tiro ───────────────────────────────────────────── */
  var _COR_MUN_INI = 12;
  var _corMun = _COR_MUN_INI;
  var _COR_TIRO_CD = 0.14;             // cadência mínima (s) entre tiros
  var _corTiroT = 0;                   // cooldown corrente
  var _corFlashT = 0;                  // clarão do cano ao atirar

  /* ── Entidades ────────────────────────────────────────────────── */
  // Zumbi: { z, faixa, tipo, hp, x(anim), morto, cai }
  //   tipo: 'normal' | 'rapido' | 'forte'
  var _corZumbis = [];
  // Munição no chão: { z, faixa }
  var _corItens = [];
  // Balas em voo (efeito visual): { z, faixa, life }
  var _corBalas = [];
  // Manchas de sangue / respingo (efeito curto): { x, y, r, life, max }
  var _corSangue = [];

  var _corSpawnT = 0;                  // timer de spawn de zumbi
  var _corItemT = 0;                   // timer de spawn de munição

  /* ── Faixas discretas de spawn (colunas da estrada) ───────────── */
  // Usamos 5 posições laterais pra o inimigo nascer, mas o movimento
  // da coruja é contínuo. Faixa em unidades: -1, -0.5, 0, 0.5, 1.
  var _COR_FAIXAS = [-1, -0.5, 0, 0.5, 1];

  /* ── Tipos de zumbi ───────────────────────────────────────────── */
  var _COR_TIPOS = {
    normal: { hp: 1, w: 0.16, cor: '#6f7d5a', corEsc: '#4b5640', vel: 1.00, pts: 0 },
    rapido: { hp: 1, w: 0.13, cor: '#8a6f3a', corEsc: '#5e4b26', vel: 1.55, pts: 0 },
    forte:  { hp: 3, w: 0.22, cor: '#5a6f6b', corEsc: '#3c4b48', vel: 0.78, pts: 0 }
  };

  /* ── Persistência do recorde (localStorage) ───────────────────── */
  var _COR_REC_KEY = 'angatuba_corrida_rec';
  function _corRec() {
    try { return Math.max(0, Math.round(Number(localStorage.getItem(_COR_REC_KEY)) || 0)); }
    catch (e) { return 0; }
  }
  function _corRecSet(v) {
    try { localStorage.setItem(_COR_REC_KEY, String(Math.round(v))); } catch (e) {}
  }

  /* ── Utils ────────────────────────────────────────────────────── */
  function _corClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function _corRand(a, b) { return a + Math.random() * (b - a); }
  function _corEscolha(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // Projeção pseudo-3D: dado z (0=perto,1=longe) e faixa lateral, devolve
  // { x, y, s } em pixels de tela. Perspectiva: quanto mais longe (z→1),
  // menor a escala e mais próximo do horizonte; a faixa lateral converge
  // pro ponto de fuga.
  function _corProj(z, faixa) {
    var W = _corW, H = _corH;
    // "perto" da câmera em profundidade normalizada. Curva não-linear
    // (pow) dá sensação de aceleração perto do jogador.
    var zc = _corClamp(z, 0, _COR_Z_FAR) / _COR_Z_FAR;   // 0..1
    var horizonY = H * _COR_HORIZ;
    var baseY = H * 1.02;                                  // um tico abaixo da base
    // Interpola y do horizonte (longe) até a base (perto) com curva.
    var t = 1 - zc;                                        // 0 longe, 1 perto
    var tt = t * t;                                        // acelera perto
    var y = horizonY + (baseY - horizonY) * tt;
    // Escala: perto ~1.0, longe ~0.16.
    var s = 0.16 + 0.94 * tt;
    // x: a faixa lateral abre conforme se aproxima (perspectiva).
    // No horizonte tudo converge pro centro; perto, ocupa a largura toda.
    var espalhar = 0.10 + 0.90 * tt;                       // largura da estrada em t
    var cx = W * 0.5 + (_corMundoX * espalhar);
    var x = cx + (faixa - _corOwl.x * 0.0) * (W * 0.46) * espalhar;
    return { x: x, y: y, s: s, t: t };
  }

  // Projeção do X lateral só (pra coruja e alinhamento), sem depender de z.
  function _corLaneX(faixa, t) {
    var W = _corW;
    var espalhar = 0.10 + 0.90 * (t * t);
    return W * 0.5 + faixa * (W * 0.46) * espalhar + _corMundoX * espalhar;
  }

  /* ══════════════════════════════════════════════════════════════
     DIMENSIONAMENTO (retina-aware). Igual padrão do Voo: mede a
     arena real e ajusta o backing store pelo DPR pra ficar nítido.
  ══════════════════════════════════════════════════════════════ */
  function _corDimensionar() {
    if (!_corCanvas) return;
    var arena = document.getElementById('cor-arena') || _corCanvas.parentNode;
    var r = arena ? arena.getBoundingClientRect() : _corCanvas.getBoundingClientRect();
    var cssW = Math.max(1, Math.round(r.width));
    var cssH = Math.max(1, Math.round(r.height));
    _corDpr = Math.min(2, window.devicePixelRatio || 1);
    _corCanvas.width = Math.round(cssW * _corDpr);
    _corCanvas.height = Math.round(cssH * _corDpr);
    _corW = cssW; _corH = cssH;
    if (_corCtx) { _corCtx.setTransform(_corDpr, 0, 0, _corDpr, 0, 0); }
  }

  /* ══════════════════════════════════════════════════════════════
     RESET DA PARTIDA
  ══════════════════════════════════════════════════════════════ */
  function _corReset() {
    _corDist = 0;
    _corVel = _COR_VEL_INI;
    _corMun = _COR_MUN_INI;
    _corTiroT = 0; _corFlashT = 0;
    _corMundoX = 0;
    _corOwl.x = 0; _corOwl.vx = 0; _corOwl.dir = 0;
    _corZumbis.length = 0;
    _corItens.length = 0;
    _corBalas.length = 0;
    _corSangue.length = 0;
    _corSpawnT = 0.8;
    _corItemT = 4.5;
    _corAtualizarHUD();
  }

  function _corAtualizarHUD() {
    var d = document.getElementById('cor-dist'); if (d) d.textContent = Math.floor(_corDist) + 'm';
    var m = document.getElementById('cor-mun');  if (m) m.textContent = _corMun;
    var r = document.getElementById('cor-recorde'); if (r) r.textContent = _corRec() + 'm';
  }

  /* ══════════════════════════════════════════════════════════════
     SPAWN
  ══════════════════════════════════════════════════════════════ */
  function _corSpawnZumbi() {
    // Escolhe tipo com peso que muda pela distância (fica mais difícil).
    var d = _corDist;
    var pRapido = _corClamp(0.10 + d / 2600, 0.10, 0.42);
    var pForte  = _corClamp(0.04 + d / 4200, 0.04, 0.30);
    var r = Math.random();
    var tipo = (r < pForte) ? 'forte' : ((r < pForte + pRapido) ? 'rapido' : 'normal');
    var def = _COR_TIPOS[tipo];
    var faixa = _corEscolha(_COR_FAIXAS);
    _corZumbis.push({
      z: _COR_Z_FAR, faixa: faixa, tipo: tipo,
      hp: def.hp, morto: false, cai: 0, bob: Math.random() * Math.PI * 2,
      // desvio horizontal sutil pra andar "zigue-zague" (só normal/rápido)
      swayA: (tipo === 'forte') ? 0 : _corRand(0.02, 0.06),
      swayF: _corRand(1.4, 2.6), swayP: Math.random() * Math.PI * 2
    });
  }

  function _corSpawnItem() {
    var faixa = _corEscolha(_COR_FAIXAS);
    _corItens.push({ z: _COR_Z_FAR, faixa: faixa, bob: Math.random() * Math.PI * 2 });
  }

  /* ══════════════════════════════════════════════════════════════
     TIRO
  ══════════════════════════════════════════════════════════════ */
  function _corAtirar() {
    if (_corEstado !== 'jogando') return;
    if (_corTiroT > 0) return;
    if (_corMun <= 0) {
      // Clique "vazio" — som de erro leve, sem gastar nada.
      if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.erro();
      return;
    }
    _corMun--;
    _corTiroT = _COR_TIRO_CD;
    _corFlashT = 0.08;
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.acerto();

    // A mira é pra frente, na faixa onde a coruja está. Acerta o zumbi
    // MAIS PRÓXIMO cuja faixa esteja alinhada com a coruja (tolerância).
    var alvo = null, melhorZ = 1e9;
    for (var i = 0; i < _corZumbis.length; i++) {
      var zb = _corZumbis[i];
      if (zb.morto) continue;
      if (Math.abs(zb.faixa - _corOwl.x) > 0.34) continue;   // fora da mira
      if (zb.z < melhorZ) { melhorZ = zb.z; alvo = zb; }
    }
    // Efeito de bala subindo pela estrada (visual).
    _corBalas.push({ z: 0.02, faixa: _corOwl.x, life: 0.24 });

    if (alvo) {
      alvo.hp--;
      if (alvo.hp <= 0) {
        alvo.morto = true; alvo.cai = 0.001;
        // Respingo no ponto do alvo.
        var p = _corProj(alvo.z, alvo.faixa);
        for (var k = 0; k < 6; k++) {
          _corSangue.push({
            x: p.x + _corRand(-14, 14), y: p.y - _corRand(4, 30) * p.s,
            r: _corRand(2, 6) * (0.6 + p.s), life: 0.5, max: 0.5
          });
        }
        if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.dano();
      } else {
        // Só levou dano (forte): feedback mais fraco.
        if (window.AngatubaGames && window.AngatubaGames.efeitos) {
          var pp = _corProj(alvo.z, alvo.faixa);
          window.AngatubaGames.efeitos.estrelas(pp.x, pp.y - 20 * pp.s, 4);
        }
      }
    }
    _corAtualizarHUD();
  }

  /* ══════════════════════════════════════════════════════════════
     UPDATE (dt em segundos)
  ══════════════════════════════════════════════════════════════ */
  function _corUpdate(dt) {
    // Acelera com o tempo (dificuldade crescente).
    _corVel = Math.min(_COR_VEL_MAX, _corVel + _COR_VEL_ACC * dt);
    // Distância percorrida ~ velocidade (fator pra virar "metros" legíveis).
    _corDist += _corVel * dt * 34;

    // Cooldown de tiro / clarão.
    if (_corTiroT > 0) _corTiroT -= dt;
    if (_corFlashT > 0) _corFlashT -= dt;

    // Movimento lateral por teclado (desktop). Toque é tratado no drag.
    if (_corKeyDir !== 0) {
      _corOwl.x = _corClamp(_corOwl.x + _corKeyDir * 1.8 * dt, -_COR_FAIXA, _COR_FAIXA);
    }
    // O "corredor" (fundo) desliza no sentido oposto ao da coruja, dando
    // parallax de que o mundo se move. Suaviza pra centralizar a coruja.
    var alvoMundo = -_corOwl.x * (_corW * 0.30);
    _corMundoX += (alvoMundo - _corMundoX) * Math.min(1, dt * 8);

    // Frequência de spawn cresce com a distância.
    var intervalo = _corClamp(1.15 - _corDist / 3800, 0.42, 1.15);
    _corSpawnT -= dt;
    if (_corSpawnT <= 0) { _corSpawnZumbi(); _corSpawnT = intervalo * _corRand(0.75, 1.25); }

    _corItemT -= dt;
    if (_corItemT <= 0) { _corSpawnItem(); _corItemT = _corRand(6, 11); }

    // Avança zumbis (z diminui = aproxima). Velocidade do zumbi soma à do mundo.
    var i, zb;
    for (i = _corZumbis.length - 1; i >= 0; i--) {
      zb = _corZumbis[i];
      if (zb.morto) {
        zb.cai += dt;                       // anima queda e some
        if (zb.cai > 0.6) _corZumbis.splice(i, 1);
        continue;
      }
      var vz = _corVel * (_COR_TIPOS[zb.tipo].vel);
      zb.z -= vz * dt;
      zb.bob += dt * 6;
      zb.swayP += dt * zb.swayF;

      // COLISÃO: zumbi cruzou a zona da coruja (z pequeno) ainda vivo.
      if (zb.z <= 0.06) {
        // Alinhado com a coruja? (largura do zumbi + corpo da coruja)
        var meia = (_COR_TIPOS[zb.tipo].w * 0.5) + 0.20;
        if (Math.abs(zb.faixa - _corOwl.x) < meia) {
          _corGameOver();
          return;
        } else {
          // Passou raspando ao lado — remove sem dano.
          _corZumbis.splice(i, 1);
          continue;
        }
      }
    }

    // Avança itens de munição.
    for (i = _corItens.length - 1; i >= 0; i--) {
      var it = _corItens[i];
      it.z -= _corVel * dt;
      it.bob += dt * 4;
      if (it.z <= 0.08) {
        // Pegou? (precisa estar alinhado lateralmente)
        if (Math.abs(it.faixa - _corOwl.x) < 0.30) {
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

    // Balas (só visual) e sangue.
    for (i = _corBalas.length - 1; i >= 0; i--) {
      var bl = _corBalas[i];
      bl.z += dt * 3.2; bl.life -= dt;
      if (bl.life <= 0 || bl.z > 1) _corBalas.splice(i, 1);
    }
    for (i = _corSangue.length - 1; i >= 0; i--) {
      var sg = _corSangue[i];
      sg.life -= dt; sg.y += dt * 40;
      if (sg.life <= 0) _corSangue.splice(i, 1);
    }

    _corAtualizarHUD();
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  function _corDraw() {
    if (!_corCtx) return;
    var ctx = _corCtx, W = _corW, H = _corH;
    var horizonY = H * _COR_HORIZ;

    // ── Céu apocalíptico (marrom-avermelhado esfumaçado) ──
    var gCeu = ctx.createLinearGradient(0, 0, 0, horizonY);
    gCeu.addColorStop(0, '#2a1c18');
    gCeu.addColorStop(0.6, '#4a2f22');
    gCeu.addColorStop(1, '#6b4130');
    ctx.fillStyle = gCeu; ctx.fillRect(0, 0, W, horizonY);

    // Lua/sol pálido velado pela fumaça.
    var lx = W * 0.72, ly = horizonY * 0.42, lr = W * 0.10;
    var gL = ctx.createRadialGradient(lx, ly, lr * 0.2, lx, ly, lr * 2.2);
    gL.addColorStop(0, 'rgba(230,190,150,0.55)');
    gL.addColorStop(0.5, 'rgba(200,150,110,0.18)');
    gL.addColorStop(1, 'rgba(200,150,110,0)');
    ctx.fillStyle = gL; ctx.beginPath(); ctx.arc(lx, ly, lr * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,180,140,0.6)';
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();

    // ── Silhueta de cidade no horizonte (parallax lento) ──
    _corDrawSkyline(ctx, W, horizonY);

    // ── Chão / estrada (do horizonte pra baixo) ──
    var gCh = ctx.createLinearGradient(0, horizonY, 0, H);
    gCh.addColorStop(0, '#20241c');
    gCh.addColorStop(1, '#0e120c');
    ctx.fillStyle = gCh; ctx.fillRect(0, horizonY, W, H - horizonY);

    // Estrada em perspectiva: um trapézio claro convergindo pro fuga.
    _corDrawEstrada(ctx, W, H, horizonY);

    // ── Entidades ordenadas do fundo pra frente (painter's) ──
    // Junta zumbis + itens + balas num array com z, ordena z desc.
    var render = [];
    var i;
    for (i = 0; i < _corItens.length; i++) render.push({ k: 'item', o: _corItens[i], z: _corItens[i].z });
    for (i = 0; i < _corZumbis.length; i++) render.push({ k: 'zumbi', o: _corZumbis[i], z: _corZumbis[i].z });
    for (i = 0; i < _corBalas.length; i++) render.push({ k: 'bala', o: _corBalas[i], z: _corBalas[i].z });
    render.sort(function (a, b) { return b.z - a.z; });   // longe primeiro
    for (i = 0; i < render.length; i++) {
      var r = render[i];
      if (r.k === 'zumbi') _corDrawZumbi(ctx, r.o);
      else if (r.k === 'item') _corDrawItem(ctx, r.o);
      else _corDrawBala(ctx, r.o);
    }

    // ── Névoa: gradiente que apaga o fundo (esconde o spawn) ──
    var gFog = ctx.createLinearGradient(0, horizonY - H * 0.06, 0, horizonY + H * 0.30);
    gFog.addColorStop(0, 'rgba(60,52,44,0.92)');
    gFog.addColorStop(0.5, 'rgba(60,52,44,0.45)');
    gFog.addColorStop(1, 'rgba(60,52,44,0)');
    ctx.fillStyle = gFog;
    ctx.fillRect(0, horizonY - H * 0.06, W, H * 0.42);

    // ── Coruja (jogador), fixa embaixo ──
    _corDrawOwl(ctx, W, H);

    // ── Respingos de sangue por cima ──
    for (i = 0; i < _corSangue.length; i++) {
      var sg = _corSangue[i];
      ctx.globalAlpha = _corClamp(sg.life / sg.max, 0, 1) * 0.8;
      ctx.fillStyle = '#7a1216';
      ctx.beginPath(); ctx.arc(sg.x, sg.y, sg.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Clarão do cano ao atirar ──
    if (_corFlashT > 0) {
      var owlY = H * 0.80;
      var fx = _corLaneX(_corOwl.x, 1);
      ctx.globalAlpha = _corClamp(_corFlashT / 0.08, 0, 1);
      var gF = ctx.createRadialGradient(fx, owlY, 2, fx, owlY, 40);
      gF.addColorStop(0, 'rgba(255,230,150,0.9)');
      gF.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = gF; ctx.beginPath(); ctx.arc(fx, owlY, 40, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ── Vinheta escura nas bordas (clima) ──
    var gV = ctx.createRadialGradient(W * 0.5, H * 0.55, H * 0.25, W * 0.5, H * 0.55, H * 0.75);
    gV.addColorStop(0, 'rgba(0,0,0,0)');
    gV.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  // Skyline de silhuetas no horizonte, deslizando com _corMundoX (parallax).
  function _corDrawSkyline(ctx, W, horizonY) {
    ctx.save();
    ctx.fillStyle = '#1a1512';
    var base = horizonY;
    var off = (_corMundoX * 0.20) % 80;
    ctx.beginPath();
    ctx.moveTo(-40, base);
    var x = -40 - off;
    var seed = 7;
    while (x < W + 40) {
      // altura pseudo-aleatória estável (hash simples)
      seed = (seed * 9301 + 49297) % 233280;
      var hh = 14 + (seed / 233280) * 46;
      var ww = 26 + ((seed >> 3) % 22);
      ctx.lineTo(x, base - hh);
      ctx.lineTo(x + ww, base - hh);
      x += ww + 6;
    }
    ctx.lineTo(W + 40, base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Estrada trapézio + linhas de faixa convergindo pro ponto de fuga.
  function _corDrawEstrada(ctx, W, H, horizonY) {
    var cxTop = W * 0.5 + _corMundoX * 0.10;
    var cxBot = W * 0.5 + _corMundoX;
    var topHalf = W * 0.05, botHalf = W * 0.52;
    ctx.fillStyle = '#2b2f24';
    ctx.beginPath();
    ctx.moveTo(cxTop - topHalf, horizonY);
    ctx.lineTo(cxTop + topHalf, horizonY);
    ctx.lineTo(cxBot + botHalf, H);
    ctx.lineTo(cxBot - botHalf, H);
    ctx.closePath();
    ctx.fill();

    // Linhas laterais das faixas (as 5 posições).
    ctx.strokeStyle = 'rgba(180,170,140,0.10)';
    ctx.lineWidth = 1;
    for (var f = 0; f < _COR_FAIXAS.length; f++) {
      var fa = _COR_FAIXAS[f];
      var xt = cxTop + fa * topHalf;
      var xb = cxBot + fa * botHalf;
      ctx.beginPath(); ctx.moveTo(xt, horizonY); ctx.lineTo(xb, H); ctx.stroke();
    }
    // Traço central tracejado "correndo" (dá sensação de velocidade).
    var run = (_corDist * 0.9) % 60;
    ctx.strokeStyle = 'rgba(210,200,160,0.16)';
    for (var d = 0; d < 8; d++) {
      var tt = (d * 60 + run) / (8 * 60);           // 0..1 do horizonte à base
      var t2 = tt * tt;
      var y1 = horizonY + (H - horizonY) * t2;
      var t2b = Math.min(1, (tt + 0.04));
      var y2 = horizonY + (H - horizonY) * (t2b * t2b);
      var xw = 1 + 5 * t2;
      var cx = W * 0.5 + _corMundoX * (0.10 + 0.90 * t2);
      ctx.lineWidth = xw;
      ctx.beginPath(); ctx.moveTo(cx, y1); ctx.lineTo(cx, y2); ctx.stroke();
    }
  }

  // Zumbi: usa sprite se existir, senão vetor (silhueta simples).
  function _corDrawZumbi(ctx, zb) {
    var def = _COR_TIPOS[zb.tipo];
    var sway = zb.swayA * Math.sin(zb.swayP);
    var faixaAnim = zb.faixa + sway;
    var p = _corProj(zb.z, faixaAnim);
    var alturaU = 0.42;                                // altura lógica do zumbi
    var hpx = alturaU * _corH * p.s * 0.5;
    var wpx = def.w * _corW * p.s * 1.4;
    var bob = Math.sin(zb.bob) * hpx * 0.03;

    // Sombra no chão.
    ctx.globalAlpha = 0.35 * (0.4 + p.s);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, wpx * 0.6, wpx * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Se morto: encolhe e some (queda).
    var mortAlpha = 1, mortScale = 1, mortRot = 0;
    if (zb.morto) {
      var q = _corClamp(zb.cai / 0.6, 0, 1);
      mortAlpha = 1 - q; mortScale = 1 - q * 0.4; mortRot = q * 0.9;
    }
    ctx.globalAlpha = mortAlpha;

    var asset = _corAsset('zumbi-' + zb.tipo + '.webp');
    if (asset && asset.ok && asset.img) {
      var aw = wpx * 2.4 * mortScale, ah = hpx * 2.0 * mortScale;
      ctx.save();
      ctx.translate(p.x, p.y - hpx + bob);
      ctx.rotate(mortRot);
      ctx.drawImage(asset.img, -aw / 2, -ah, aw, ah);
      ctx.restore();
    } else {
      _corVetorZumbi(ctx, p.x, p.y + bob, wpx * mortScale, hpx * mortScale, def, mortRot);
    }
    ctx.globalAlpha = 1;
  }

  // Silhueta vetorial de zumbi (fallback): corpo curvado, cabeça, braços.
  function _corVetorZumbi(ctx, cx, footY, w, h, def, rot) {
    ctx.save();
    ctx.translate(cx, footY);
    if (rot) ctx.rotate(rot);
    // Corpo (tronco levemente inclinado).
    ctx.fillStyle = def.cor;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0);
    ctx.lineTo(w * 0.5, 0);
    ctx.lineTo(w * 0.42, -h * 1.1);
    ctx.lineTo(-w * 0.42, -h * 1.1);
    ctx.closePath(); ctx.fill();
    // Braços esticados pra frente (o clássico do zumbi).
    ctx.strokeStyle = def.corEsc; ctx.lineWidth = Math.max(2, w * 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.95); ctx.lineTo(-w * 0.75, -h * 0.7);
    ctx.moveTo(w * 0.3, -h * 0.95);  ctx.lineTo(w * 0.75, -h * 0.72);
    ctx.stroke();
    // Cabeça.
    ctx.fillStyle = def.cor;
    ctx.beginPath();
    ctx.arc(0, -h * 1.28, w * 0.34, 0, Math.PI * 2);
    ctx.fill();
    // Olhos brancos leitosos.
    ctx.fillStyle = 'rgba(220,220,200,0.85)';
    ctx.beginPath(); ctx.arc(-w * 0.12, -h * 1.30, w * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.12, -h * 1.30, w * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Munição no chão (caixote/pente). Sprite ou vetor.
  function _corDrawItem(ctx, it) {
    var p = _corProj(it.z, it.faixa);
    var s = p.s;
    var bob = Math.sin(it.bob) * 4 * s;
    var sz = 22 * s;

    ctx.globalAlpha = 0.3 * (0.4 + s);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 0.9, sz * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    var asset = _corAsset('municao.webp');
    if (asset && asset.ok && asset.img) {
      var aw = sz * 2.4, ah = sz * 2.4;
      ctx.drawImage(asset.img, p.x - aw / 2, p.y - ah + bob, aw, ah);
    } else {
      // Caixote de munição (verde militar) com faixa vermelha "ammo".
      ctx.save();
      ctx.translate(p.x, p.y - sz + bob);
      ctx.fillStyle = '#3e5a2e';
      ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
      ctx.fillStyle = '#557a3e';
      ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 0.35);
      ctx.strokeStyle = '#c33'; ctx.lineWidth = Math.max(2, sz * 0.18);
      ctx.beginPath(); ctx.moveTo(-sz * 0.6, 0); ctx.lineTo(sz * 0.6, 0); ctx.stroke();
      // Brilho pulsante pra chamar atenção.
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(it.bob));
      ctx.strokeStyle = 'rgba(120,220,120,0.8)'; ctx.lineWidth = 2;
      ctx.strokeRect(-sz - 3, -sz * 0.7 - 3, sz * 2 + 6, sz * 1.4 + 6);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // Bala em voo (rastro amarelo subindo pela estrada).
  function _corDrawBala(ctx, bl) {
    var p = _corProj(bl.z, bl.faixa);
    var s = p.s;
    ctx.globalAlpha = _corClamp(bl.life / 0.24, 0, 1);
    ctx.strokeStyle = 'rgba(255,235,150,0.9)';
    ctx.lineWidth = Math.max(1.5, 3 * s);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 16 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Coruja do jogador: vista de trás/baixo, fixa perto da base, move em x.
  function _corDrawOwl(ctx, W, H) {
    var owlY = H * 0.80;
    var owlX = _corLaneX(_corOwl.x, 1);
    var owlW = W * 0.26;
    var bobY = Math.sin(_corDist * 0.25) * 3;        // balanço de corrida

    // Sombra.
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(owlX, owlY + owlW * 0.42, owlW * 0.5, owlW * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    if (_corOwlOk && _corOwlImg) {
      var w = owlW, h = owlW * _corOwlRatio;
      // Inclina levemente no sentido do movimento lateral.
      var tilt = _corClamp(_corOwl.vx * 0.004, -0.18, 0.18);
      ctx.save();
      ctx.translate(owlX, owlY + bobY);
      ctx.rotate(tilt);
      ctx.drawImage(_corOwlImg, -w / 2, -h * 0.72, w, h);
      ctx.restore();
    } else {
      // Vetor: corpo cinza-azulado + olhos âmbar (mascote).
      ctx.save();
      ctx.translate(owlX, owlY + bobY);
      ctx.fillStyle = '#5a6b82';
      ctx.beginPath(); ctx.ellipse(0, 0, owlW * 0.42, owlW * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#48566b';
      ctx.beginPath(); ctx.ellipse(0, owlW * 0.05, owlW * 0.30, owlW * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      // Olhos.
      ctx.fillStyle = '#ffb020';
      ctx.beginPath(); ctx.arc(-owlW * 0.15, -owlW * 0.12, owlW * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(owlW * 0.15, -owlW * 0.12, owlW * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(-owlW * 0.15, -owlW * 0.12, owlW * 0.045, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(owlW * 0.15, -owlW * 0.12, owlW * 0.045, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     LOOP
  ══════════════════════════════════════════════════════════════ */
  function _corLoop(ts) {
    if (_corEstado !== 'jogando') return;
    if (!_corLast) _corLast = ts;
    var dt = (ts - _corLast) / 1000;
    _corLast = ts;
    if (dt > 0.05) dt = 0.05;                          // trava spikes (aba em bg)
    _corUpdate(dt);
    if (_corEstado === 'jogando') {                    // update pode ter dado game over
      _corDraw();
      _corRAF = requestAnimationFrame(_corLoop);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     GAME OVER
  ══════════════════════════════════════════════════════════════ */
  function _corGameOver() {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    _corEstado = 'fim';
    var score = Math.floor(_corDist);
    var rec = _corRec();
    var recorde = score > rec;
    if (recorde) { _corRecSet(score); }

    // Desenha um último quadro (mostra a cena parada atrás do overlay).
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
    if (msgEl) {
      msgEl.textContent = recorde
        ? 'Você correu mais longe que nunca! 🦉'
        : (rec > 0 ? 'Seu recorde: ' + rec + 'm. Bora de novo?' : 'Arraste pra desviar, toque pra atirar!');
    }
    _corMostrarOverlay('fim');

    if (recorde && window.AngatubaGames && window.AngatubaGames.efeitos) {
      window.AngatubaGames.efeitos.confete('cor-fim', 90);
    }
    if (window.AngatubaGames) window.AngatubaGames.rankFimDeJogo('corrida', 'cor-rank-slot', score);
  }

  /* ══════════════════════════════════════════════════════════════
     CONTROLES
  ══════════════════════════════════════════════════════════════ */
  function _corPX(e) {
    var rect = _corCanvas.getBoundingClientRect();
    var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    return cx - rect.left;
  }
  // Toque: começa a arrastar E marca posição (tap curto = tiro no up).
  var _corDownX = 0, _corDownT = 0, _corMoveu = false;
  function _corPointerDown(e) {
    if (_corEstado !== 'jogando') return;
    _corDrag = true; _corLastPX = _corPX(e);
    _corDownX = _corLastPX; _corDownT = (e.timeStamp || Date.now()); _corMoveu = false;
    if (e.cancelable) e.preventDefault();
  }
  function _corPointerMove(e) {
    if (!_corDrag || _corEstado !== 'jogando') return;
    var px = _corPX(e);
    var dx = px - _corLastPX;
    _corLastPX = px;
    if (Math.abs(px - _corDownX) > 8) _corMoveu = true;
    // Converte deslocamento em pixels pra unidades de faixa (sensível).
    _corOwl.x = _corClamp(_corOwl.x + (dx / (_corW * 0.42)), -_COR_FAIXA, _COR_FAIXA);
    _corOwl.vx = dx;
    if (e.cancelable) e.preventDefault();
  }
  function _corPointerUp(e) {
    if (_corEstado === 'jogando' && _corDrag) {
      var dtms = ((e && e.timeStamp) || Date.now()) - _corDownT;
      // Tap curto sem arrastar = atira.
      if (!_corMoveu && dtms < 320) _corAtirar();
    }
    _corDrag = false; _corOwl.vx = 0;
  }
  function _corKey(down, e) {
    if (e.key === 'ArrowLeft') { _corKeyDir = down ? -1 : 0; }
    else if (e.key === 'ArrowRight') { _corKeyDir = down ? 1 : 0; }
    else if (down && (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      _corAtirar(); if (e.preventDefault) e.preventDefault();
    }
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
     CICLO DE VIDA (integração com o hub)
  ══════════════════════════════════════════════════════════════ */
  function _corPreparar() {
    _corCanvas = document.getElementById('cor-canvas');
    if (!_corCanvas) return;
    _corCtx = _corCanvas.getContext('2d');
    _corCarregarImg();
    _corLigarControles();
    if (!_corResizeOn) {
      window.addEventListener('resize', function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _corDimensionar(); if (_corEstado !== 'jogando') _corDrawIdle();
        }
      });
      _corResizeOn = true;
    }
    _corEstado = 'inicio';
    var rec = document.getElementById('cor-recorde'); if (rec) rec.textContent = _corRec() + 'm';
    var d = document.getElementById('cor-dist'); if (d) d.textContent = '0m';
    var m = document.getElementById('cor-mun'); if (m) m.textContent = _COR_MUN_INI;
    _corMostrarOverlay('inicio');
    _corDimensionar();
    _corDrawIdle();
    // Blindagem de timing (tela cheia pode não ter assentado ainda).
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        _corDimensionar();
        if (_corEstado !== 'jogando') _corDrawIdle();
      });
    }
  }

  // Quadro parado (cena apocalíptica) atrás do overlay inicial.
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
    var gFog = ctx.createLinearGradient(0, horizonY - H * 0.06, 0, horizonY + H * 0.3);
    gFog.addColorStop(0, 'rgba(60,52,44,0.9)'); gFog.addColorStop(1, 'rgba(60,52,44,0)');
    ctx.fillStyle = gFog; ctx.fillRect(0, horizonY - H * 0.06, W, H * 0.42);
    _corDrawOwl(ctx, W, H);
    var gV = ctx.createRadialGradient(W * 0.5, H * 0.55, H * 0.25, W * 0.5, H * 0.55, H * 0.75);
    gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  function _corComecar() {
    _corCanvas = document.getElementById('cor-canvas');
    if (!_corCanvas) return;
    if (!_corCtx) _corCtx = _corCanvas.getContext('2d');
    _corLigarControles();
    _corMostrarOverlay(null);
    _corDimensionar();
    _corReset();
    _corEstado = 'jogando';
    _corLast = 0;
    if (_corRAF) cancelAnimationFrame(_corRAF);
    _corRAF = requestAnimationFrame(_corLoop);
  }

  function _corParar() {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    if (_corEstado === 'jogando') _corEstado = 'inicio';
    _corDrag = false; _corKeyDir = 0;
  }

  function _corMostrarOverlay(qual) {
    var ini = document.getElementById('cor-inicio');
    var fim = document.getElementById('cor-fim');
    if (ini) ini.style.display = (qual === 'inicio') ? '' : 'none';
    if (fim) fim.style.display = (qual === 'fim') ? '' : 'none';
  }

  /* ── Exposição pública ────────────────────────────────────────── */
  window._corComecar = _corComecar;
  window.CorridaGame = {
    preparar: _corPreparar,
    comecar: _corComecar,
    parar: _corParar
  };
})();
