/* ═══════════════════════════════════════════════════════════════
   ARMADILHA DA CORUJA — platformer de armadilhas (estilo Level Devil)
   Lazy-loaded pelo hub a partir de /Jogos/armadilha.min.js
   (ver JOGOS_EXTERNOS em Jogos/hub.js). Expõe window.ArmadilhaGame
   = { preparar, parar }.
   ------------------------------------------------------------
   - Monta tudo dentro de #armadilha-root (mesmo esquema do
     #negocios-root): canvas, HUD, controles de toque e overlays.
   - Canvas 2D, física em passo fixo (1/120 s), colisão AABB.
   - Escala INTEIRA em pixels do aparelho + imageSmoothing desligado:
     a coruja pixel art nunca borra.
   - Sprite: /img/pixel/coruja-pixel-idle-sheet.png (4 quadros lado a
     lado: normal, abaixada, normal, piscando). O tamanho do quadro é
     calculado da própria imagem (largura/4), então tanto a versão 1x
     quanto a ampliada funcionam.
   - Fases são DADOS (array FASES logo abaixo): mapa ASCII + lista de
     armadilhas + textos. Nada de código novo pra criar uma fase.
   - Sem backend: progresso (fase liberada) fica no localStorage.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Constantes ─────────────────────────────────────────────── */
  var T = 16;                                   // tamanho do tile (px do mundo)
  var SPRITE_SHEET = '/img/pixel/coruja-pixel-idle-sheet.png';
  var SPR_W = 20, SPR_H = 23;                   // quadro da coruja em px do mundo
  var CHAVE_PROGRESSO = 'angatuba_armadilha_fase';

  // Física (px do mundo por segundo)
  var GRAV = 1500, PULO_V = 390, PULO_CORTE = 170, QUEDA_MAX = 620;
  var VEL = 105, ACEL_CHAO = 1500, ACEL_AR = 1000, FREIO_CHAO = 2000, FREIO_AR = 500;
  var COYOTE = 0.08, BUFFER_PULO = 0.12, PASSO = 1 / 120;
  var PW = 12, PH = 18;                         // hitbox da coruja
  var MIN_TILES_LARG = 15;                      // mínimo de tiles visíveis na largura
  var T_RESPAWN = 0.5, T_VITORIA = 1.1;

  var CORES_PENAS = ['#5b6b7f', '#d6bf9c', '#f2a11f', '#ff4a4a', '#1c212b', '#c4ab8a'];

  /* ══════════════════════════════════════════════════════════════
     FASES — edite aqui.
     mapa (12 linhas, todas do mesmo tamanho):
       .  vazio            #  chão/parede      ^  espinho (pra cima)
       v  espinho (pra baixo, no teto)         S  início da coruja
       F  bandeira         a-z  bloco de um GRUPO (pode cair/sumir/mover)
       1-9  espinho de um GRUPO (pode aparecer/mover)
     armadilhas: { g: grupo ('a', '1'... ou 'bandeira'),
                   gatilho: coluna (dispara quando o CENTRO da coruja passa dela),
                   acao: 'cai' | 'some' | 'aparece' | 'move',
                   dx/dy: tiles (só 'move'), vel: px/s (só 'move'),
                   atraso: ms (opcional), mata: true (bloco mata ao encostar) }
     Grupo com alguma armadilha 'aparece' começa invisível.
     textos: { c: coluna, r: linha, t: 'texto' } — dicas desenhadas no cenário.
  ══════════════════════════════════════════════════════════════ */
  var FASES = [
    {
      nome: 'Tutorial',
      cores: { fundo: '#f2a541', chao: '#2b1d14', pano: '#fff6e5' },
      mapa: [
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '........................####................',
        '..S.......^.............####............F...',
        '################...##############aaa########',
        '################...##############aaa########'
      ],
      armadilhas: [
        { g: 'a', gatilho: 31, acao: 'cai' }
      ],
      textos: [
        { c: 2, r: 5, t: '← → andar   ▲ pular' },
        { c: 9, r: 6, t: 'pule!' },
        { c: 21, r: 5, t: 'segure = mais alto' },
        { c: 30, r: 6, t: 'tá tranquilo...' }
      ]
    },
    {
      nome: 'Nada é o que parece',
      cores: { fundo: '#7cc4d4', chao: '#16263a', pano: '#fff6e5' },
      mapa: [
        '.........................bbb................................',
        '.........................bbb................................',
        '.........................bbb................................',
        '.........................bbb................................',
        '.........................bbb................................',
        '.........................bbb....#####.......................',
        '.........................bbb....vvvvv.......................',
        '............................................................',
        '............................................................',
        '..S.....^.....11..................^.................F.......',
        '##################...###########################ccc#########',
        '##################...###########################ccc#########'
      ],
      armadilhas: [
        { g: '1', gatilho: 12, acao: 'aparece' },
        { g: 'b', gatilho: 23.5, acao: 'cai', mata: true },
        { g: 'c', gatilho: 47, acao: 'cai' },
        { g: 'bandeira', gatilho: 47, acao: 'move', dx: 5, vel: 160 }
      ],
      textos: [
        { c: 2, r: 5, t: 'agora é sério' },
        { c: 31, r: 3, t: 'pulinho curto...' }
      ]
    },
    {
      nome: 'Sujeira total',
      cores: { fundo: '#d8573f', chao: '#240c0c', pano: '#fff6e5' },
      mapa: [
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................................',
        '...............##..dd..##.........................................',
        '..S...............................2.........................33.F..',
        '#####aaa#####^^^^^^^^^^^^^##############eee##fff##################',
        '#####aaa################################eee##fff##################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 4, acao: 'cai' },
        { g: 'd', gatilho: 19.3, acao: 'some', atraso: 350 },
        { g: '2', gatilho: 30, acao: 'move', dx: -3, vel: 130 },
        { g: 'e', gatilho: 39.5, acao: 'cai' },
        { g: 'f', gatilho: 44, acao: 'cai' },
        { g: 'g', gatilho: 49, acao: 'cai', mata: true },
        { g: 'h', gatilho: 49, acao: 'cai', mata: true, atraso: 700 },
        { g: '3', gatilho: 58, acao: 'aparece' }
      ],
      textos: [
        { c: 3, r: 5, t: 'boa sorte :)' }
      ]
    }
  ];

  /* ── Estado do módulo ───────────────────────────────────────── */
  var root = null, wrap, canvas, ctx, elFase, elMortes, elMenu, elFim, elBanner, elControles, elFasesLista;
  var img = new Image(), imgOk = false;
  var montado = false, ativo = false, raf = 0, ultimoT = 0, acumulado = 0;
  var estado = 'menu';          // menu | jogando | morto | vitoria | fim
  var faseIdx = 0, fase = null, nivel = null;
  var p = null, grupos = null, armadilhas = null, particulas = [];
  var timerEstado = 0, tempoAnim = 0, tremor = 0;
  var mortesFase = 0, mortesTotal = 0;
  var cam = { x: 0, y: 0, s: 1, vw: 0, vh: 0, reservaBaixo: 0 };
  var inp = { esq: false, dir: false, pulo: false };
  var puloPonteiros = {}, dpadPonteiros = {}, teclas = {};

  /* ── Utilidades ─────────────────────────────────────────────── */
  function _som(m, args) {
    var G = window.AngatubaGames;
    if (G && G.som && typeof G.som[m] === 'function') { try { G.som[m].apply(G.som, args || []); } catch (e) {} }
  }
  function _vibrar(padrao) { if (navigator.vibrate) { try { navigator.vibrate(padrao); } catch (e) {} } }
  function _lerProgresso() {
    try { var v = parseInt(localStorage.getItem(CHAVE_PROGRESSO), 10); return isNaN(v) ? 0 : Math.max(0, Math.min(FASES.length - 1, v)); } catch (e) { return 0; }
  }
  function _salvarProgresso(v) { try { localStorage.setItem(CHAVE_PROGRESSO, String(v)); } catch (e) {} }
  function _sobrepoe(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function _ehGrupoBloco(ch) { return ch >= 'a' && ch <= 'z'; }
  function _ehGrupoEspinho(ch) { return ch >= '1' && ch <= '9'; }

  /* ── Leitura da fase (dados → estrutura) ───────────────────── */
  function _lerFase(def) {
    var H = def.mapa.length, W = def.mapa[0].length;
    var solido = new Uint8Array(W * H);
    var perigos = [], gruposDef = {}, inicio = null, bandeira = null;
    function gdef(id) { return gruposDef[id] || (gruposDef[id] = { id: id, blocos: [], espinhos: [] }); }
    for (var r = 0; r < H; r++) {
      var linha = def.mapa[r];
      if (linha.length !== W) throw new Error('Fase "' + def.nome + '": linha ' + r + ' com tamanho diferente');
      for (var c = 0; c < W; c++) {
        var ch = linha.charAt(c);
        if (ch === '#') solido[r * W + c] = 1;
        else if (ch === '^') perigos.push({ x: c * T + 3, y: r * T + 9, w: 10, h: 7 });
        else if (ch === 'v') perigos.push({ x: c * T + 3, y: r * T, w: 10, h: 7 });
        else if (ch === 'S') inicio = { x: c * T + (T - PW) / 2, y: (r + 1) * T - PH };
        else if (ch === 'F') bandeira = { x: c * T, y: (r + 1) * T };
        else if (_ehGrupoBloco(ch)) gdef(ch).blocos.push({ c: c, r: r });
        else if (_ehGrupoEspinho(ch)) gdef(ch).espinhos.push({ c: c, r: r });
      }
    }
    if (!inicio) inicio = { x: T, y: (H - 3) * T - PH };
    if (!bandeira) bandeira = { x: (W - 2) * T, y: (H - 2) * T };
    // Colunas cujo chão/teto encosta na borda: estendidas até fora da tela
    var extBaixo = [], extCima = [];
    for (c = 0; c < W; c++) {
      if (solido[(H - 1) * W + c]) extBaixo.push(c);
      if (solido[c]) extCima.push(c);
    }
    return { def: def, W: W, H: H, LW: W * T, LH: H * T, solido: solido, perigos: perigos,
             gruposDef: gruposDef, inicio: inicio, bandeira: bandeira,
             extBaixo: extBaixo, extCima: extCima, camada: _desenharCamadaEstatica(def, W, H, solido) };
  }

  // Espinho em pixel art (triângulo de 14px de base, 8 de altura)
  function _pintarEspinho(g, x, y, praBaixo) {
    for (var i = 0; i < 8; i++) {
      var yy = praBaixo ? y + i : y + 15 - i;
      var meia = 7 - i;
      g.fillRect(x + 8 - meia - 1, yy, (meia + 1) * 2, 1);
    }
  }

  function _desenharCamadaEstatica(def, W, H, solido) {
    var cv = document.createElement('canvas');
    cv.width = W * T; cv.height = H * T;
    var g = cv.getContext('2d');
    g.fillStyle = def.cores.chao;
    for (var r = 0; r < H; r++) {
      for (var c = 0; c < W; c++) {
        var ch = def.mapa[r].charAt(c);
        if (solido[r * W + c]) g.fillRect(c * T, r * T, T, T);
        else if (ch === '^') _pintarEspinho(g, c * T, r * T, false);
        else if (ch === 'v') _pintarEspinho(g, c * T, r * T, true);
      }
    }
    return cv;
  }

  /* ── Vida nova (reset de fase: armadilhas voltam ao lugar) ─── */
  function _iniciarVida() {
    grupos = {};
    var gd = nivel.gruposDef;
    for (var id in gd) {
      grupos[id] = { id: id, blocos: gd[id].blocos, espinhos: gd[id].espinhos,
                     ox: 0, oy: 0, vy: 0, visivel: true, caindo: false, mata: false,
                     alvo: null, vel: 0, surgir: 1, dx: 0, dy: 0 };
    }
    grupos.bandeira = { id: 'bandeira', blocos: [], espinhos: [], ox: 0, oy: 0, vy: 0, visivel: true,
                        caindo: false, mata: false, alvo: null, vel: 0, surgir: 1, dx: 0, dy: 0 };
    armadilhas = [];
    var lista = fase.armadilhas || [];
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!grupos[a.g]) continue;
      if (a.acao === 'aparece') grupos[a.g].visivel = false;
      armadilhas.push({ def: a, disparada: false, timer: -1 });
    }
    p = { x: nivel.inicio.x, y: nivel.inicio.y, w: PW, h: PH, vx: 0, vy: 0, noChao: false, coyote: 0, buffer: 0,
          olhando: 1, chaoGrupo: null, pouso: 0, visivel: true };
    particulas = [];
    estado = 'jogando';
    _atualizarHud();
  }

  function _comecarFase(i) {
    faseIdx = Math.max(0, Math.min(FASES.length - 1, i));
    fase = FASES[faseIdx];
    try { nivel = _lerFase(fase); } catch (e) { if (window.console) console.error('[Armadilha]', e); return; }
    mortesFase = 0;
    if (wrap) wrap.style.background = fase.cores.fundo;
    _esconder(elMenu); _esconder(elFim); _esconder(elBanner);
    _iniciarVida();
    cam.x = null; // força a câmera a pular direto pra coruja
  }

  /* ── Colisão ────────────────────────────────────────────────── */
  function _solidoEstatico(c, r) {
    if (r < 0 || r >= nivel.H || c < 0 || c >= nivel.W) return false;
    return nivel.solido[r * nivel.W + c] === 1;
  }

  // Lista de retângulos sólidos que tocam o retângulo "ret"
  function _solidosEm(ret) {
    var out = [];
    var c0 = Math.floor(ret.x / T), c1 = Math.floor((ret.x + ret.w - 0.001) / T);
    var r0 = Math.floor(ret.y / T), r1 = Math.floor((ret.y + ret.h - 0.001) / T);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      if (_solidoEstatico(c, r)) out.push({ x: c * T, y: r * T, w: T, h: T, g: null });
    }
    for (var id in grupos) {
      var g = grupos[id];
      if (!g.visivel || !g.blocos.length) continue;
      for (var i = 0; i < g.blocos.length; i++) {
        var b = g.blocos[i], rb = { x: b.c * T + g.ox, y: b.r * T + g.oy, w: T, h: T, g: g };
        if (_sobrepoe(ret, rb)) out.push(rb);
      }
    }
    return out;
  }

  function _moverX(dx) {
    if (!dx) return;
    p.x += dx;
    var hs = _solidosEm(p);
    for (var i = 0; i < hs.length; i++) {
      var s = hs[i];
      if (!_sobrepoe(p, s)) continue;
      if (dx > 0) p.x = s.x - PW; else p.x = s.x + s.w;
      p.vx = 0;
    }
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x > nivel.LW - PW) { p.x = nivel.LW - PW; p.vx = 0; }
  }

  function _moverY(dy) {
    if (!dy) return;
    p.y += dy;
    var hs = _solidosEm(p);
    for (var i = 0; i < hs.length; i++) {
      var s = hs[i];
      if (!_sobrepoe(p, s)) continue;
      if (dy > 0) { p.y = s.y - PH; p.noChao = true; p.chaoGrupo = s.g; }
      else p.y = s.y + s.h;
      p.vy = 0;
    }
  }

  function _tocaPerigo() {
    var i, pr = nivel.perigos;
    for (i = 0; i < pr.length; i++) if (_sobrepoe(p, pr[i])) return true;
    var infl = { x: p.x - 1, y: p.y - 1, w: PW + 2, h: PH + 2 };
    for (var id in grupos) {
      var g = grupos[id];
      if (!g.visivel) continue;
      for (i = 0; i < g.espinhos.length; i++) {
        var e = g.espinhos[i];
        if (_sobrepoe(p, { x: e.c * T + 3 + g.ox, y: e.r * T + 9 + g.oy, w: 10, h: 7 })) return true;
      }
      if (g.mata) {
        for (i = 0; i < g.blocos.length; i++) {
          var b = g.blocos[i];
          if (_sobrepoe(infl, { x: b.c * T + g.ox, y: b.r * T + g.oy, w: T, h: T })) return true;
        }
      }
    }
    return false;
  }

  /* ── Armadilhas ─────────────────────────────────────────────── */
  function _executar(a) {
    var g = grupos[a.g];
    if (!g) return;
    if (a.mata) g.mata = true;
    if (a.acao === 'cai') { g.caindo = true; g.vy = 0; }
    else if (a.acao === 'some') g.visivel = false;
    else if (a.acao === 'aparece') { g.visivel = true; g.surgir = 0; }
    else if (a.acao === 'move') {
      g.alvo = { x: g.ox + (a.dx || 0) * T, y: g.oy + (a.dy || 0) * T };
      g.vel = a.vel || 120;
    }
  }

  function _atualizarArmadilhas(dt) {
    var centro = p.x + PW / 2;
    for (var i = 0; i < armadilhas.length; i++) {
      var a = armadilhas[i];
      if (!a.disparada && centro >= a.def.gatilho * T) {
        a.disparada = true;
        a.timer = (a.def.atraso || 0) / 1000;
      }
      if (a.disparada && a.timer >= 0) {
        a.timer -= dt;
        if (a.timer < 0) _executar(a.def);
      }
    }
    for (var id in grupos) {
      var g = grupos[id];
      g.dx = 0; g.dy = 0;
      if (g.surgir < 1) g.surgir = Math.min(1, g.surgir + dt / 0.08);
      if (g.caindo) {
        g.vy = Math.min(g.vy + GRAV * dt, 900);
        g.oy += g.vy * dt; g.dy = g.vy * dt;
        if (g.oy > nivel.LH + 480) { g.caindo = false; g.visivel = false; }
      } else if (g.alvo) {
        var ddx = g.alvo.x - g.ox, ddy = g.alvo.y - g.oy, dist = Math.sqrt(ddx * ddx + ddy * ddy);
        var passo = g.vel * dt;
        if (dist <= passo) { g.dx = ddx; g.dy = ddy; g.ox = g.alvo.x; g.oy = g.alvo.y; g.alvo = null; }
        else { g.dx = ddx / dist * passo; g.dy = ddy / dist * passo; g.ox += g.dx; g.oy += g.dy; }
      }
    }
  }

  /* ── Passo de física ────────────────────────────────────────── */
  function _passo(dt) {
    // Plataforma que se move (não a que cai) carrega a coruja junto
    var chao = p.noChao ? p.chaoGrupo : null;
    _atualizarArmadilhas(dt);
    if (chao && !chao.caindo && (chao.dx || chao.dy)) { p.x += chao.dx; p.y += chao.dy; }
    // Bloco que apareceu/andou por cima da coruja = esmagada
    var sob = _solidosEm(p);
    for (var i = 0; i < sob.length; i++) if (_sobrepoe(p, sob[i]) && sob[i].g && sob[i].g !== chao) { _morrer(); return; }

    var dir = (inp.dir ? 1 : 0) - (inp.esq ? 1 : 0);
    if (dir) {
      p.vx += dir * (p.noChao ? ACEL_CHAO : ACEL_AR) * dt;
      if (p.vx > VEL) p.vx = VEL; if (p.vx < -VEL) p.vx = -VEL;
      p.olhando = dir;
    } else {
      var fr = (p.noChao ? FREIO_CHAO : FREIO_AR) * dt;
      p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr;
    }
    p.coyote = p.noChao ? COYOTE : p.coyote - dt;
    if (p.buffer > 0) p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PULO_V; p.buffer = 0; p.coyote = 0; p.noChao = false;
      _som('pulo');
    }
    if (!inp.pulo && p.vy < -PULO_CORTE) p.vy = -PULO_CORTE;   // pulo variável
    p.vy = Math.min(p.vy + GRAV * dt, QUEDA_MAX);

    var estavaNoChao = p.noChao;
    p.noChao = false; p.chaoGrupo = null;
    _moverX(p.vx * dt);
    _moverY(p.vy * dt);
    if (p.noChao && !estavaNoChao) p.pouso = 0.09;
    if (p.pouso > 0) p.pouso -= dt;

    if (p.y > nivel.LH + 24 || _tocaPerigo()) { _morrer(); return; }

    var b = grupos.bandeira;
    var rb = { x: nivel.bandeira.x + b.ox + 3, y: nivel.bandeira.y + b.oy - 40, w: 10, h: 40 };
    if (_sobrepoe(p, rb)) _vencerFase();
  }

  function _morrer() {
    if (estado !== 'jogando') return;
    estado = 'morto'; timerEstado = T_RESPAWN; tremor = 0.18;
    mortesFase++; mortesTotal++;
    p.visivel = false;
    var cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (var i = 0; i < 18; i++) {
      var ang = Math.random() * Math.PI * 2, v = 60 + Math.random() * 140;
      particulas.push({ x: cx, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 120,
                        cor: CORES_PENAS[i % CORES_PENAS.length], vida: 0.7 + Math.random() * 0.3, t: i % 3 === 0 ? 3 : 2 });
    }
    _som('dano'); _vibrar(35);
    _atualizarHud();
  }

  function _vencerFase() {
    if (estado !== 'jogando') return;
    estado = 'vitoria'; timerEstado = T_VITORIA;
    var prox = faseIdx + 1;
    if (prox < FASES.length && prox > _lerProgresso()) _salvarProgresso(prox);
    _som('nivelUp'); _vibrar([20, 40, 20]);
    if (prox < FASES.length) _mostrarBanner('Fase ' + (faseIdx + 1) + ' concluída!');
  }

  function _atualizar(dt) {
    tempoAnim += dt;
    if (tremor > 0) tremor -= dt;
    for (var i = particulas.length - 1; i >= 0; i--) {
      var q = particulas[i];
      q.vida -= dt; q.vy += GRAV * 0.6 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.vida <= 0) particulas.splice(i, 1);
    }
    if (estado === 'jogando') {
      acumulado += dt;
      while (acumulado >= PASSO && estado === 'jogando') { _passo(PASSO); acumulado -= PASSO; }
    } else {
      acumulado = 0;
      if (estado === 'morto') {
        timerEstado -= dt;
        if (timerEstado <= 0) _iniciarVida();
      } else if (estado === 'vitoria') {
        timerEstado -= dt;
        if (timerEstado <= 0) {
          _esconder(elBanner);
          if (faseIdx + 1 < FASES.length) _comecarFase(faseIdx + 1);
          else _mostrarFim();
        }
      }
    }
    _atualizarCamera(dt);
  }

  /* ── Câmera + escala inteira ────────────────────────────────── */
  function _redimensionar() {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
    var ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch;
    }
    // Retrato + controles na tela: a fase fica acima dos botões
    var reservaCss = 0;
    if (elControles && elControles.offsetParent !== null && canvas.clientHeight > canvas.clientWidth) {
      reservaCss = elControles.offsetHeight + 16;
    }
    var reservaDev = reservaCss * dpr;
    var LH = nivel ? nivel.LH : 12 * T;
    var s = Math.floor(Math.min(cw / (MIN_TILES_LARG * T), Math.max(1, ch - reservaDev) / LH));
    cam.s = Math.max(1, s);
    cam.vw = cw / cam.s; cam.vh = ch / cam.s;
    cam.reservaBaixo = reservaDev / cam.s;
    ctx.imageSmoothingEnabled = false;
  }

  function _atualizarCamera(dt) {
    if (!nivel) return;
    var util = cam.vh - cam.reservaBaixo, alvoX, alvoY;
    if (nivel.LW <= cam.vw) alvoX = -(cam.vw - nivel.LW) / 2;
    else alvoX = Math.max(0, Math.min(nivel.LW - cam.vw, p.x + PW / 2 - cam.vw * 0.42));
    if (nivel.LH <= util) alvoY = -(util - nivel.LH) / 2;
    else alvoY = Math.max(0, Math.min(nivel.LH - util, p.y + PH / 2 - util / 2));
    if (cam.x === null || cam.x === undefined) { cam.x = alvoX; cam.y = alvoY; return; }
    var k = Math.min(1, dt * 9);
    cam.x += (alvoX - cam.x) * k;
    cam.y += (alvoY - cam.y) * k;
  }

  /* ── Desenho ────────────────────────────────────────────────── */
  function _desenhar() {
    _redimensionar();
    var cores = fase.cores;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var sx = 0, sy = 0;
    if (tremor > 0) { sx = Math.round(Math.random() * 2 - 1); sy = Math.round(Math.random() * 2 - 1); }
    var ox = Math.round(cam.x) - sx, oy = Math.round(cam.y) - sy;
    ctx.setTransform(cam.s, 0, 0, cam.s, -ox * cam.s, -oy * cam.s);
    ctx.imageSmoothingEnabled = false;

    // Textos de dica (atrás de tudo)
    if (fase.textos) {
      ctx.fillStyle = cores.chao; ctx.globalAlpha = 0.55;
      ctx.font = '700 7px ui-monospace, Menlo, Consolas, monospace';
      ctx.textBaseline = 'top';
      for (var ti = 0; ti < fase.textos.length; ti++) {
        var tx = fase.textos[ti];
        ctx.fillText(tx.t, tx.c * T, tx.r * T + 4);
      }
      ctx.globalAlpha = 1;
    }

    // Grupos (antes da camada estática: o que cai passa "por trás" do chão)
    ctx.fillStyle = cores.chao;
    var EXT = 600;
    for (var id in grupos) {
      var g = grupos[id];
      if (!g.visivel || id === 'bandeira') continue;
      var gx = Math.round(g.ox), gy = Math.round(g.oy);
      for (var i = 0; i < g.blocos.length; i++) {
        var b = g.blocos[i], bx = b.c * T + gx, by = b.r * T + gy;
        ctx.fillRect(bx, by, T, T);
        if (b.r === nivel.H - 1) ctx.fillRect(bx, by + T, T, EXT);
        if (b.r === 0) ctx.fillRect(bx, by - EXT, T, EXT);
      }
      var sub = Math.round((1 - g.surgir) * 10);
      for (i = 0; i < g.espinhos.length; i++) {
        var e = g.espinhos[i];
        _pintarEspinho(ctx, e.c * T + gx, e.r * T + gy + sub, false);
      }
    }

    // Camada estática + chão/teto estendidos até fora da tela
    ctx.drawImage(nivel.camada, 0, 0);
    for (i = 0; i < nivel.extBaixo.length; i++) ctx.fillRect(nivel.extBaixo[i] * T, nivel.LH, T, EXT);
    for (i = 0; i < nivel.extCima.length; i++) ctx.fillRect(nivel.extCima[i] * T, -EXT, T, EXT);

    _desenharBandeira(cores);
    if (p && p.visivel) _desenharCoruja();

    for (i = 0; i < particulas.length; i++) {
      var q = particulas[i];
      ctx.fillStyle = q.cor;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.t, q.t);
    }
  }

  function _desenharBandeira(cores) {
    var b = grupos.bandeira, x = Math.round(nivel.bandeira.x + b.ox), y = Math.round(nivel.bandeira.y + b.oy);
    ctx.fillStyle = cores.chao;
    ctx.fillRect(x + 7, y - 40, 2, 40);          // mastro
    ctx.fillRect(x + 4, y - 2, 8, 2);            // base
    ctx.fillStyle = cores.pano;
    var onda = Math.floor(tempoAnim * 4) % 2;
    for (var i = 0; i < 10; i++) {
      var w = 12 - Math.abs(i - 5) * 2;
      ctx.fillRect(x + 9, y - 39 + i + (i > 4 ? onda : 0), w, 1);
    }
  }

  // Quadros do sheet: 0 normal, 1 abaixada (respira), 2 normal, 3 piscando
  var SEQ_IDLE = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 2, 3, 2, 0, 1, 1];
  function _quadroCoruja() {
    if (p.pouso > 0) return 1;
    if (!p.noChao) return 0;
    if (Math.abs(p.vx) > 20) return Math.floor(tempoAnim / 0.09) % 2 === 0 ? 0 : 1;
    return SEQ_IDLE[Math.floor(tempoAnim / 0.17) % SEQ_IDLE.length];
  }

  function _desenharCoruja() {
    var dx = Math.round(p.x + PW / 2 - SPR_W / 2), dy = Math.round(p.y + PH - SPR_H);
    if (!imgOk) {
      ctx.fillStyle = '#5b6b7f'; ctx.fillRect(Math.round(p.x), Math.round(p.y), PW, PH);
      return;
    }
    var fw = img.naturalWidth / 4, fh = img.naturalHeight, q = _quadroCoruja();
    if (p.olhando < 0) {
      ctx.save();
      ctx.translate(dx + SPR_W, dy); ctx.scale(-1, 1);
      ctx.drawImage(img, q * fw, 0, fw, fh, 0, 0, SPR_W, SPR_H);
      ctx.restore();
    } else {
      ctx.drawImage(img, q * fw, 0, fw, fh, dx, dy, SPR_W, SPR_H);
    }
  }

  /* ── Loop ───────────────────────────────────────────────────── */
  function _loop(t) {
    raf = 0;
    if (!ativo) return;
    var dt = ultimoT ? Math.min(0.05, (t - ultimoT) / 1000) : 0;
    ultimoT = t;
    if (nivel) { _atualizar(dt); _desenhar(); }
    raf = requestAnimationFrame(_loop);
  }
  function _ligarLoop() { if (!raf && ativo) { ultimoT = 0; raf = requestAnimationFrame(_loop); } }
  function _desligarLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  /* ── HUD / overlays ─────────────────────────────────────────── */
  function _mostrar(el) { if (el) el.style.display = ''; }
  function _esconder(el) { if (el) el.style.display = 'none'; }
  function _atualizarHud() {
    if (elFase) elFase.textContent = 'Fase ' + (faseIdx + 1) + '/' + FASES.length;
    if (elMortes) elMortes.textContent = '☠ ' + mortesFase;
  }
  function _mostrarBanner(txt) {
    if (!elBanner) return;
    elBanner.textContent = txt;
    _mostrar(elBanner);
    elBanner.classList.remove('ar-banner-anim'); void elBanner.offsetWidth; elBanner.classList.add('ar-banner-anim');
  }

  function _abrirMenu() {
    estado = 'menu';
    _limparEntrada();
    var liberada = _lerProgresso(), html = '';
    for (var i = 0; i < FASES.length; i++) {
      var trava = i > liberada;
      html += '<button type="button" class="ar-fase-btn' + (trava ? ' ar-travada' : '') + '" data-fase="' + i + '"' + (trava ? ' disabled' : '') + '>' +
              '<span class="ar-fase-num">' + (trava ? '🔒' : (i + 1)) + '</span>' +
              '<span class="ar-fase-nome">' + FASES[i].nome + '</span></button>';
    }
    elFasesLista.innerHTML = html;
    _esconder(elFim); _esconder(elBanner);
    _mostrar(elMenu);
  }

  function _mostrarFim() {
    estado = 'fim';
    var el = root.querySelector('#ar-fim-mortes');
    if (el) el.textContent = mortesTotal === 0 ? 'Sem morrer nenhuma vez?! Lenda.' :
      ('Você morreu ' + mortesTotal + (mortesTotal === 1 ? ' vez' : ' vezes') + '. A coruja agradece a persistência.');
    _mostrar(elFim);
    _som('fim', [true]);
    var G = window.AngatubaGames;
    if (G && G.efeitos) G.efeitos.confete(elFim, 60);
  }

  /* ── Entrada: toque + teclado ───────────────────────────────── */
  function _limparEntrada() {
    inp.esq = inp.dir = inp.pulo = false;
    puloPonteiros = {}; dpadPonteiros = {}; teclas = {};
    if (wrap) wrap.querySelectorAll('.ar-on').forEach(function (b) { b.classList.remove('ar-on'); });
  }
  function _apertarPulo() { inp.pulo = true; if (p && estado === 'jogando') p.buffer = BUFFER_PULO; }
  function _recalcPulo() { inp.pulo = Object.keys(puloPonteiros).length > 0 || !!teclas.pulo; }
  function _recalcDpad() {
    var e = false, d = false;
    for (var k in dpadPonteiros) { if (dpadPonteiros[k] < 0) e = true; else d = true; }
    inp.esq = e || !!teclas.esq; inp.dir = d || !!teclas.dir;
    var be = wrap.querySelector('.ar-esq'), bd = wrap.querySelector('.ar-dir');
    if (be) be.classList.toggle('ar-on', e); if (bd) bd.classList.toggle('ar-on', d);
  }

  function _ligarToque() {
    var dpad = wrap.querySelector('.ar-dpad'), bPulo = wrap.querySelector('.ar-pulo');
    function lado(ev) { var r = dpad.getBoundingClientRect(); return ev.clientX < r.left + r.width / 2 ? -1 : 1; }
    dpad.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      try { dpad.setPointerCapture(ev.pointerId); } catch (e) {}
      dpadPonteiros[ev.pointerId] = lado(ev); _recalcDpad();
    });
    dpad.addEventListener('pointermove', function (ev) {
      if (dpadPonteiros[ev.pointerId] === undefined) return;
      dpadPonteiros[ev.pointerId] = lado(ev); _recalcDpad();
    });
    function soltarDpad(ev) { delete dpadPonteiros[ev.pointerId]; _recalcDpad(); }
    dpad.addEventListener('pointerup', soltarDpad);
    dpad.addEventListener('pointercancel', soltarDpad);

    function apertaPulo(ev) {
      ev.preventDefault();
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
      puloPonteiros[ev.pointerId] = true; bPulo.classList.add('ar-on'); _apertarPulo();
    }
    function soltaPulo(ev) {
      delete puloPonteiros[ev.pointerId]; _recalcPulo();
      if (!Object.keys(puloPonteiros).length) bPulo.classList.remove('ar-on');
    }
    // Botão ▲ e também um toque em qualquer ponto do cenário = pular
    [bPulo, canvas].forEach(function (el) {
      el.addEventListener('pointerdown', apertaPulo);
      el.addEventListener('pointerup', soltaPulo);
      el.addEventListener('pointercancel', soltaPulo);
    });
    wrap.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  var TECLAS = {
    ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir',
    Space: 'pulo', ArrowUp: 'pulo', KeyW: 'pulo', KeyZ: 'pulo', KeyR: 'reiniciar'
  };
  function _teclaDown(ev) {
    if (!ativo) return;
    var acao = TECLAS[ev.code];
    if (!acao) return;
    ev.preventDefault();
    if (acao === 'reiniciar') { if (!ev.repeat) _reiniciar(); return; }
    if (acao === 'pulo') { if (!ev.repeat) { teclas.pulo = true; _apertarPulo(); } return; }
    teclas[acao] = true; _recalcDpad();
  }
  function _teclaUp(ev) {
    var acao = TECLAS[ev.code];
    if (!acao || !ativo) return;
    teclas[acao] = false;
    if (acao === 'pulo') _recalcPulo(); else _recalcDpad();
  }

  function _reiniciar() {
    if (estado === 'jogando' || estado === 'morto') { _iniciarVida(); cam.x = null; }
  }

  function _aoVisibilidade() {
    if (!ativo) return;
    if (document.hidden) { _desligarLoop(); _limparEntrada(); }
    else _ligarLoop();
  }

  /* ── Montagem do DOM ────────────────────────────────────────── */
  function _montar() {
    root = document.getElementById('armadilha-root');
    if (!root) return false;
    root.innerHTML =
      '<div class="ar-wrap">' +
        '<canvas class="ar-canvas"></canvas>' +
        '<div class="ar-hud">' +
          '<span class="ar-pill" id="ar-fase">Fase 1/' + FASES.length + '</span>' +
          '<span class="ar-pill" id="ar-mortes">☠ 0</span>' +
          '<button type="button" class="ar-hud-btn" id="ar-btn-reiniciar" aria-label="Reiniciar fase">↻</button>' +
          '<button type="button" class="ar-hud-btn" id="ar-btn-menu" aria-label="Escolher fase">☰</button>' +
        '</div>' +
        '<div class="ar-controles">' +
          '<div class="ar-dpad"><span class="ar-seta ar-esq">◀</span><span class="ar-seta ar-dir">▶</span></div>' +
          '<button type="button" class="ar-pulo" aria-label="Pular">▲</button>' +
        '</div>' +
        '<div class="ar-banner" id="ar-banner" style="display:none"></div>' +
        '<div class="ar-overlay" id="ar-menu">' +
          '<div class="ar-caixa">' +
            '<img src="/img/pixel/coruja-pixel-idle.png" alt="" class="ar-menu-owl" onerror="this.style.display=\'none\'">' +
            '<div class="ar-titulo">Armadilha da Coruja</div>' +
            '<div class="ar-desc">Leve a coruja até a bandeira. Nada é o que parece: morreu, volta na hora.</div>' +
            '<div class="ar-fases" id="ar-fases"></div>' +
            '<div class="ar-dica">◀ ▶ andar · ▲ ou toque na tela pula (segure = mais alto)<br>Teclado: setas/A D · espaço/↑/W · R reinicia</div>' +
          '</div>' +
        '</div>' +
        '<div class="ar-overlay" id="ar-fim" style="display:none">' +
          '<div class="ar-caixa">' +
            '<img src="/img/pixel/coruja-pixel-idle.png" alt="" class="ar-menu-owl" onerror="this.style.display=\'none\'">' +
            '<div class="ar-titulo">Você venceu!</div>' +
            '<div class="ar-desc" id="ar-fim-mortes"></div>' +
            '<button type="button" class="ar-btn" id="ar-btn-denovo">Jogar de novo</button>' +
            '<button type="button" class="ar-btn ar-btn-sec" id="ar-btn-fases">Escolher fase</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    wrap = root.querySelector('.ar-wrap');
    canvas = root.querySelector('.ar-canvas');
    ctx = canvas.getContext('2d', { alpha: false });
    elFase = root.querySelector('#ar-fase');
    elMortes = root.querySelector('#ar-mortes');
    elMenu = root.querySelector('#ar-menu');
    elFim = root.querySelector('#ar-fim');
    elBanner = root.querySelector('#ar-banner');
    elControles = root.querySelector('.ar-controles');
    elFasesLista = root.querySelector('#ar-fases');

    elFasesLista.addEventListener('click', function (ev) {
      var b = ev.target.closest('.ar-fase-btn');
      if (!b || b.disabled) return;
      mortesTotal = 0;
      _comecarFase(parseInt(b.getAttribute('data-fase'), 10) || 0);
    });
    root.querySelector('#ar-btn-reiniciar').addEventListener('click', function (ev) { ev.currentTarget.blur(); _reiniciar(); });
    root.querySelector('#ar-btn-menu').addEventListener('click', function (ev) { ev.currentTarget.blur(); _abrirMenu(); });
    root.querySelector('#ar-btn-denovo').addEventListener('click', function () { mortesTotal = 0; _comecarFase(0); });
    root.querySelector('#ar-btn-fases').addEventListener('click', _abrirMenu);
    // Botões do HUD não podem "vazar" o toque pro canvas (senão pula)
    root.querySelectorAll('.ar-hud-btn').forEach(function (b) {
      b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    });
    _ligarToque();

    img.onload = function () { imgOk = true; };
    img.onerror = function () { imgOk = false; };
    img.src = SPRITE_SHEET;
    montado = true;
    return true;
  }

  /* ── API pública (contrato do _jogoLoader do hub) ───────────── */
  function preparar() {
    if (!montado && !_montar()) return;
    if (!ativo) {
      ativo = true;
      window.addEventListener('keydown', _teclaDown);
      window.addEventListener('keyup', _teclaUp);
      document.addEventListener('visibilitychange', _aoVisibilidade);
    }
    // Cenário da fase liberada aparece atrás do menu
    _comecarFase(_lerProgresso());
    _abrirMenu();
    _ligarLoop();
  }

  function parar() {
    if (!ativo) return;
    ativo = false;
    _desligarLoop();
    _limparEntrada();
    window.removeEventListener('keydown', _teclaDown);
    window.removeEventListener('keyup', _teclaUp);
    document.removeEventListener('visibilitychange', _aoVisibilidade);
    estado = 'menu';
  }

  window.ArmadilhaGame = {
    preparar: preparar, parar: parar, FASES: FASES,
    // Leitura de estado para testes/depuração (não altera nada)
    _estado: function () { return { estado: estado, fase: faseIdx, mortes: mortesTotal, p: p ? { x: p.x, y: p.y, noChao: p.noChao } : null }; }
  };
})();
