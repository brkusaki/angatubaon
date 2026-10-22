/* ═══════════════════════════════════════════════════════════════
   HEX ARENA — jogo da Coruja Party (2 a 4 jogadores, todos no MESMO
   jogo). Lazy-loaded por Jogos/party.js via window._jogoLoader
   ('hexarena') quando o anfitrião escolhe o modo "Hex Arena".
   ------------------------------------------------------------
   Não é minigame da pool (aqueles cada um joga sozinho e só manda o
   score). Aqui os jogadores interagem: todos ficam na mesma arena
   hexagonal e o resultado de um depende da escolha dos outros.

   REGRAS (MVP)
   - Arena hexagonal vista de cima (raio 4 com 2 jogadores, 5 com 3-4).
   - Cada round tem uma fase de PLANEJAR (15 s): cada um escolhe, sem
     ver os outros, onde vai PARAR (até 2 casas de distância) e pra que
     lado vai ATIRAR (uma das 6 direções do hexágono).
   - Quando todo mundo confirmou (ou o tempo acabou), todos se mexem ao
     mesmo tempo e os lasers saem da posição final, em linha reta até a
     borda. Quem terminou parado na linha de tiro de OUTRO jogador
     morre. Lasers atravessam jogadores.
   - Não dá pra dividir casa: quem escolheu a mesma casa que outro
     ESBARRA e volta pra onde estava (e atira de lá). Sem isso, todo
     mundo empilhava no centro no fim e ninguém morria.
   - O anel de fora fica rachado (vermelho) durante o round e DESABA no
     fim dele: quem parou ali cai. A arena encolhe 1 anel por round até
     sobrar a "arena final" (o centro + 6 casas). Nela não desaba mais
     nada e valem mais RODADAS_FINAIS rounds.
   - Acaba quando sobra 1 (ou ninguém) ou quando acabam os rounds da
     arena final. Os sobreviventes empatam em 1º. Quem morre no mesmo
     round empata entre si.
   - Quem não confirmar a tempo: o que estava marcado vale; sem mira
     escolhida, atira pra um lado aleatório.

   SINCRONIA (usa a infraestrutura do party.js, nada de rede nova)
   - O anfitrião é a fonte da verdade. Ele grava o estado inteiro em
     salasParty/{codigo}/modoEstado (set completo a cada fase).
   - Cada jogador grava a própria jogada UMA vez por round em
     salasParty/{codigo}/modoJogadas/{round}/{uid} = { v: 'q,r,d', em }.
     A regra do RTDB impede reenviar depois de gravado.
   - O cliente nunca DESENHA a jogada dos outros antes da revelação (só
     mostra "✓ confirmou"). Limitação conhecida do MVP: o nó é legível
     por quem está na sala, então alguém abrindo o console conseguiria
     espiar. Resolver de verdade exigiria commit/reveal ou servidor.

   Contrato com o party.js (ver MODOS e _iniciarModoLocal lá):
     window.HexArenaGame.montar(container, ctx) -> { parar, salaMudou }
     window.HexArenaGame.parar()
   ctx = { seed, meuUid, souAnfitriao(), jogadores(), estadoRef,
           jogadasRef, escutar(ref, ev, cb), agora, fim(coloc),
           recompensa(qtd) }
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────────── */
  var MOVER_MAX   = 2;       // casas por round
  var PRAZO_MS    = 15000;   // tempo de planejar
  var FOLGA_MS    = 1800;    // o anfitrião espera um pouco além do prazo (rede)
  var REVELAR_MS  = 3900;    // duração da revelação antes do próximo round
  var FIM_MS      = 7500;    // tela de fim dentro da arena antes do pódio da Party
  var CORES       = ['#ef4444', '#3b82f6', '#facc15', '#22c55e'];
  // Arte (fichas da Coruja, casas de pedra, mira). Sem a imagem carregada,
  // o desenho cai no vetor antigo (círculo + inicial / hexágono liso).
  var _HX_DIR = '/Jogos/assets/hexarena/';
  var _HX_FICHAS = ['ficha-vermelha', 'ficha-azul', 'ficha-amarela', 'ficha-verde'];
  var _hxImgs = {};
  function _hxImg(nome) {
    var im = _hxImgs[nome];
    if (!im) { im = _hxImgs[nome] = new Image(); im.src = _HX_DIR + nome + '.webp'; }
    return (im.complete && im.naturalWidth) ? im : null;
  }
  var RODADAS_FINAIS = 3;    // rounds na arena final (raio 1) antes do empate
  // Moedas por colocação. Empate no 1º paga o valor do 2º (12): sem
  // isso, um grupo combinando de não se acertar tirava 20 cada partida.
  var MOEDAS_POR_COLOCACAO = [20, 12, 7, 4];
  var MOEDAS_EMPATE_1 = 12;
  // Direções axiais (hexágono "flat-top"): ↘ ↗ ↑ ↖ ↙ ↓
  var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  var RAIZ3 = Math.sqrt(3);

  // Tempos da animação de revelação (ms desde que chegou o 'revelar').
  var T_MOVE = 650, T_LASER = 1500, T_MORTE = 2300, T_QUEDA = 3200;

  /* ── Geometria axial ─────────────────────────────────────────── */
  function _dist0(q, r) { return (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) / 2; }
  function _dist(a, b) { return _dist0(a.q - b.q, a.r - b.r); }
  function _chave(c) { return c.q + ',' + c.r; }
  function _ler(s) {
    var p = String(s || '').split(',');
    var q = parseInt(p[0], 10), r = parseInt(p[1], 10);
    if (isNaN(q) || isNaN(r)) return null;
    return { q: q, r: r };
  }
  function _celulas(raio) {
    var out = [];
    for (var q = -raio; q <= raio; q++) {
      for (var r = Math.max(-raio, -q - raio); r <= Math.min(raio, -q + raio); r++) out.push({ q: q, r: r });
    }
    return out;
  }
  // Casas atingidas por um laser saindo de `de` na direção d (sem incluir `de`).
  function _linha(de, d, raio) {
    var out = [];
    var c = { q: de.q + DIRS[d][0], r: de.r + DIRS[d][1] };
    while (_dist0(c.q, c.r) <= raio) {
      out.push(c);
      c = { q: c.q + DIRS[d][0], r: c.r + DIRS[d][1] };
    }
    return out;
  }
  function _raioInicial(n) { return n >= 3 ? 5 : 4; }
  // Último round da partida: encolhe de raioInicial até 1 e joga mais RODADAS_FINAIS.
  function _roundLimite(raioInicial) { return (raioInicial - 1) + RODADAS_FINAIS; }
  // Cantos do anel (raio-1) espaçados de forma simétrica pra cada quantidade.
  var CANTOS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4] };

  /* ── Lógica pura (roda no anfitrião) ─────────────────────────── */
  function _estadoInicial(jogadores) {
    var uids = Object.keys(jogadores).sort(function (a, b) {
      return ((jogadores[a].entrouEm || 0) - (jogadores[b].entrouEm || 0)) || (a < b ? -1 : 1);
    }).slice(0, 4);
    var raio = _raioInicial(uids.length);
    var cantos = CANTOS[uids.length] || CANTOS[4];
    var pos = {}, vivos = {}, cores = {}, nomes = {};
    uids.forEach(function (uid, i) {
      var d = DIRS[cantos[i]];
      pos[uid] = (d[0] * (raio - 1)) + ',' + (d[1] * (raio - 1));
      vivos[uid] = true;
      cores[uid] = i;
      nomes[uid] = String(jogadores[uid].nome || 'Jogador').slice(0, 20);
    });
    return {
      v: 1, round: 1, fase: 'planejar', raio: raio, raioInicial: raio,
      prazoMs: PRAZO_MS, pos: pos, vivos: vivos, cores: cores, nomes: nomes, elim: {}
    };
  }

  /* Resolve um round. `jogadas` = { uid: 'q,r,d' }, `presentes` = uids
     ainda na sala. Devolve o estado de revelação (fase 'revelar' ou
     'fim'); o próximo round é montado por _proximoRound. */
  function _resolver(est, jogadas, presentes) {
    var raio = est.raio;
    var vivos = Object.keys(est.vivos || {});
    var mov = {}, dir = {}, mortes = {}, bate = {};
    var origem = {};
    var ativos = [];
    vivos.forEach(function (uid) {
      if (!presentes[uid]) { mortes[uid] = 'saiu'; return; }
      ativos.push(uid);
      var p = _ler(est.pos[uid]) || { q: 0, r: 0 };
      var dest = p, d = Math.floor(Math.random() * 6);
      var partes = String(jogadas[uid] || '').split(',');
      if (partes.length === 3) {
        var cand = { q: parseInt(partes[0], 10), r: parseInt(partes[1], 10) };
        var cd = parseInt(partes[2], 10);
        if (!isNaN(cand.q) && !isNaN(cand.r) && _dist(p, cand) <= MOVER_MAX && _dist0(cand.q, cand.r) <= raio) dest = cand;
        if (cd >= 0 && cd <= 5) d = cd;
      }
      origem[uid] = _chave(p);
      mov[uid] = _chave(dest);
      dir[uid] = d;
    });
    // Esbarrões: casa disputada por 2+ -> quem SE MEXEU volta pra origem.
    // Repete porque voltar pode criar disputa nova (alguém entrou na casa
    // de onde eu saí). Termina: cada passada devolve pelo menos um, e as
    // origens são todas diferentes entre si.
    for (var passada = 0; passada < 10; passada++) {
      var ocup = {};
      ativos.forEach(function (u) { (ocup[mov[u]] = ocup[mov[u]] || []).push(u); });
      var mudou = false;
      Object.keys(ocup).forEach(function (c) {
        if (ocup[c].length < 2) return;
        ocup[c].forEach(function (u) {
          if (mov[u] !== origem[u]) { if (!bate[u]) bate[u] = mov[u]; mov[u] = origem[u]; mudou = true; }
        });
      });
      if (!mudou) break;
    }
    // Lasers (todos ao mesmo tempo, a partir da posição FINAL).
    var linhas = {};
    ativos.forEach(function (uid) {
      var set = {};
      _linha(_ler(mov[uid]), dir[uid], raio).forEach(function (c) { set[_chave(c)] = true; });
      linhas[uid] = set;
    });
    ativos.forEach(function (uid) {
      for (var i = 0; i < ativos.length; i++) {
        var outro = ativos[i];
        if (outro !== uid && linhas[outro][mov[uid]]) { mortes[uid] = 'laser:' + outro; return; }
      }
    });
    // Anel de fora desaba no fim do round (a arena final não desaba).
    if (raio > 1) {
      ativos.forEach(function (uid) {
        if (mortes[uid]) return;
        var c = _ler(mov[uid]);
        if (_dist0(c.q, c.r) >= raio) mortes[uid] = 'queda';
      });
    }

    var elim = {};
    Object.keys(est.elim || {}).forEach(function (u) { elim[u] = est.elim[u]; });
    var novosVivos = {};
    vivos.forEach(function (uid) {
      if (mortes[uid]) elim[uid] = est.round; else novosVivos[uid] = true;
    });
    var fim = Object.keys(novosVivos).length <= 1 || est.round >= _roundLimite(est.raioInicial);

    var out = {
      v: 1, round: est.round, fase: fim ? 'fim' : 'revelar', raio: raio, raioInicial: est.raioInicial,
      prazoMs: est.prazoMs, pos: est.pos, vivos: est.vivos, cores: est.cores, nomes: est.nomes,
      elim: elim, res: { mov: mov, dir: dir, mortes: mortes, bate: bate }
    };
    if (fim) out.coloc = _colocacoes(est.nomes, elim, novosVivos);
    return out;
  }

  // Colocação: sobrevivente = 1º; depois quem morreu mais tarde. Empates dividem.
  function _colocacoes(nomes, elim, vivos) {
    var uids = Object.keys(nomes || {});
    var valor = {};
    uids.forEach(function (u) { valor[u] = vivos[u] ? 1e9 : (elim[u] || 0); });
    var coloc = {};
    uids.forEach(function (u) {
      var melhores = 0;
      uids.forEach(function (o) { if (valor[o] > valor[u]) melhores++; });
      coloc[u] = melhores + 1;
    });
    return coloc;
  }

  function _proximoRound(rev) {
    var pos = {}, vivos = {};
    Object.keys(rev.vivos || {}).forEach(function (uid) {
      if (rev.res.mortes[uid]) return;
      vivos[uid] = true;
      pos[uid] = rev.res.mov[uid];
    });
    return {
      v: 1, round: rev.round + 1, fase: 'planejar', raio: Math.max(1, rev.raio - 1), raioInicial: rev.raioInicial,
      prazoMs: rev.prazoMs, pos: pos, vivos: vivos, cores: rev.cores, nomes: rev.nomes, elim: rev.elim
    };
  }

  /* ── Instância (uma por partida) ─────────────────────────────── */
  var _atual = null;

  function montar(container, ctx) {
    if (_atual) _atual.parar();
    var inst = _criar(container, ctx);
    _atual = inst;
    return inst;
  }
  function parar() { if (_atual) _atual.parar(); }

  function _criar(container, ctx) {
    var vivo = true;
    var est = null;              // último modoEstado recebido
    var recebidoEm = 0;          // Date.now() local de quando chegou a fase atual
    var faseChave = '';          // round|fase do estado desenhado
    var sel = null;              // { dest:{q,r}, dir:null|0..5, modo:'mover'|'mirar' }
    var enviado = {};            // round -> true (minha jogada já saiu)
    var confirmados = {};        // uid -> true no round atual (só a presença)
    var jogadasRound = {};       // anfitrião: uid -> 'q,r,d'
    var jogadasRefRound = null, jogadasCbRound = null;
    var timers = [];
    var raf = null;
    var tickTimer = null;
    var premiado = false;
    var tam = 20, cx = 0, cy = 0, dpr = 1, W = 0, H = 0;

    container.innerHTML =
      '<div class="hx-root">' +
        '<div class="hx-topo">' +
          '<div class="hx-linha1"><span class="hx-round" id="hx-round">Hex Arena</span>' +
            '<span class="hx-tempo" id="hx-tempo"></span></div>' +
          '<div class="hx-timer"><div class="hx-timer-barra" id="hx-timer-barra"></div></div>' +
          '<div class="hx-msg" id="hx-msg" aria-live="polite">Preparando a arena…</div>' +
        '</div>' +
        '<div class="hx-jogadores" id="hx-jogadores"></div>' +
        '<div class="hx-palco" id="hx-palco">' +
          '<canvas class="hx-canvas" id="hx-canvas" aria-label="Arena hexagonal"></canvas>' +
          '<div class="hx-fim" id="hx-fim" style="display:none;"></div>' +
        '</div>' +
        '<div class="hx-controles" id="hx-controles">' +
          '<div class="hx-seg" role="group" aria-label="O que tocar na arena">' +
            '<button type="button" class="hx-seg-btn on" data-hx-modo="mover"><img class="hx-seg-ico" src="/Jogos/assets/hexarena/pegada.webp" alt=""> Mover</button>' +
            '<button type="button" class="hx-seg-btn" data-hx-modo="mirar">🎯 Mirar</button>' +
          '</div>' +
          '<button type="button" class="hx-confirmar" id="hx-confirmar" disabled>Confirmar</button>' +
        '</div>' +
      '</div>';

    var canvas = container.querySelector('#hx-canvas');
    var g = canvas.getContext('2d');
    var elMsg = container.querySelector('#hx-msg');
    var elRound = container.querySelector('#hx-round');
    var elTempo = container.querySelector('#hx-tempo');
    var elBarra = container.querySelector('#hx-timer-barra');
    var elJog = container.querySelector('#hx-jogadores');
    var elFim = container.querySelector('#hx-fim');
    var elCtrl = container.querySelector('#hx-controles');
    var elConf = container.querySelector('#hx-confirmar');
    var elPalco = container.querySelector('#hx-palco');

    function _som(m, a) { var G = window.AngatubaGames; if (G && G.som && G.som[m]) { try { G.som[m](a); } catch (e) {} } }
    function _vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
    function _later(fn, ms) { var t = setTimeout(function () { if (vivo) fn(); }, ms); timers.push(t); return t; }
    function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function _nome(uid) { return (est && est.nomes && est.nomes[uid]) || 'Jogador'; }
    function _cor(uid) { return CORES[(est && est.cores && est.cores[uid]) || 0] || CORES[0]; }
    function _souVivo() { return !!(est && est.vivos && est.vivos[ctx.meuUid] && est.fase === 'planejar'); }

    /* ── Medidas / conversão pixel <-> hexágono ─────────────────── */
    function _medir() {
      var rect = elPalco.getBoundingClientRect();
      dpr = Math.min(2.5, window.devicePixelRatio || 1);
      W = Math.max(200, Math.floor(rect.width));
      H = Math.max(200, Math.floor(rect.height));
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      var R = (est && est.raioInicial) || 5;
      tam = Math.min(W / (3 * R + 2), H / (RAIZ3 * (2 * R + 1))) * 0.97;
      cx = W / 2; cy = H / 2;
    }
    function _px(c) { return { x: cx + tam * 1.5 * c.q, y: cy + tam * RAIZ3 * (c.r + c.q / 2) }; }
    function _hexDe(x, y) {
      var fx = x - cx, fy = y - cy;
      var q = (2 / 3 * fx) / tam, r = (-1 / 3 * fx + RAIZ3 / 3 * fy) / tam, s = -q - r;
      var rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
      var dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
      if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
      return { q: rq, r: rr };
    }
    function _dirPara(de, x, y) {
      var p = _px(de), vx = x - p.x, vy = y - p.y;
      if (vx * vx + vy * vy < 9) return null;
      var melhor = 0, mv = -Infinity;
      for (var d = 0; d < 6; d++) {
        var a = _px({ q: DIRS[d][0], r: DIRS[d][1] });
        var ax = a.x - cx, ay = a.y - cy;
        var dot = (vx * ax + vy * ay) / Math.sqrt(ax * ax + ay * ay);
        if (dot > mv) { mv = dot; melhor = d; }
      }
      return melhor;
    }

    /* ── Desenho ────────────────────────────────────────────────── */
    function _hexPath(p, s) {
      g.beginPath();
      for (var i = 0; i < 6; i++) {
        var ang = Math.PI / 3 * i;
        var x = p.x + s * Math.cos(ang), y = p.y + s * Math.sin(ang);
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
    }
    function _ease(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    function _desenhar(agora) {
      if (!vivo) return;
      raf = window.requestAnimationFrame(_desenhar);
      // A sub-tela pode ter mudado de tamanho (girou o celular, entrou em
      // tela cheia): remede antes de desenhar.
      if (Math.floor(elPalco.clientWidth) !== W || Math.floor(elPalco.clientHeight) !== H) _medir();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      if (!est) return;

      var fase = est.fase;
      var t = Date.now() - recebidoEm;          // tempo desde a fase atual
      var revelando = (fase === 'revelar' || fase === 'fim') && est.res;
      var pulso = 0.5 + 0.5 * Math.sin(agora / 220);
      var raio = est.raio;
      var queda = revelando ? _ease((t - T_MORTE) / (T_QUEDA - T_MORTE)) : 0;

      // Casas
      var reach = {};
      if (_souVivo() && sel && sel.modo === 'mover') {
        var meu = _ler(est.pos[ctx.meuUid]);
        _celulas(raio).forEach(function (c) { if (_dist(meu, c) <= MOVER_MAX) reach[_chave(c)] = true; });
      }
      _celulas(est.raioInicial).forEach(function (c) {
        var d0 = _dist0(c.q, c.r), p = _px(c);
        if (d0 > raio) {           // já desabou: só o contorno, bem apagado
          _hexPath(p, tam * 0.92);
          g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; g.stroke();
          return;
        }
        var borda = (d0 === raio && raio > 1);   // a arena final (raio 1) não desaba
        var escala = 0.94;
        g.globalAlpha = 1;
        if (borda && revelando) { escala = 0.94 * (1 - queda); g.globalAlpha = 1 - queda; }
        if (escala <= 0.02) { g.globalAlpha = 1; return; }
        var pedra = _hxImg(borda ? 'hex-rachado' : 'hex');
        if (pedra) {
          var sw = tam * escala * 2.04;
          g.drawImage(pedra, p.x - sw / 2, p.y - sw * 0.46, sw, sw * 0.92);
          _hexPath(p, tam * escala);
          g.fillStyle = borda ? 'rgba(244,63,94,' + (0.14 + 0.16 * pulso) + ')'
            : (reach[_chave(c)] ? 'rgba(139,92,246,.42)' : 'rgba(17,13,31,.30)');
          g.fill();
          if (borda || reach[_chave(c)]) {
            g.lineWidth = borda ? 1.6 : 1.4;
            g.strokeStyle = borda ? 'rgba(251,113,133,' + (0.45 + 0.4 * pulso) + ')' : 'rgba(196,181,253,.85)';
            g.stroke();
          }
          g.globalAlpha = 1;
          return;
        }
        _hexPath(p, tam * escala);
        if (borda) {
          g.fillStyle = 'rgba(244,63,94,' + (0.18 + 0.14 * pulso) + ')';
        } else if (reach[_chave(c)]) {
          g.fillStyle = '#3d3570';
        } else {
          g.fillStyle = '#2a2445';
        }
        g.fill();
        g.lineWidth = borda ? 1.6 : 1;
        g.strokeStyle = borda ? 'rgba(251,113,133,' + (0.45 + 0.4 * pulso) + ')' : (reach[_chave(c)] ? 'rgba(167,139,250,.7)' : 'rgba(255,255,255,0.10)');
        g.stroke();
        if (borda && !revelando && tam > 14) {   // rachadura
          g.strokeStyle = 'rgba(15,10,25,.55)'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(p.x - tam * 0.35, p.y - tam * 0.2); g.lineTo(p.x - tam * 0.05, p.y + tam * 0.05);
          g.lineTo(p.x + tam * 0.3, p.y - tam * 0.1); g.stroke();
        }
        g.globalAlpha = 1;
      });

      // Prévia da minha jogada (só pra mim, só no planejar)
      if (_souVivo() && sel) {
        var cor = _cor(ctx.meuUid);
        var origem = _px(_ler(est.pos[ctx.meuUid]));
        var alvo = _px(sel.dest);
        _hexPath(alvo, tam * 0.94); g.fillStyle = _alpha(cor, 0.28); g.fill();
        g.strokeStyle = cor; g.lineWidth = 2; g.stroke();
        if (_chave(sel.dest) !== est.pos[ctx.meuUid]) {
          g.setLineDash([5, 5]); g.strokeStyle = _alpha(cor, 0.8); g.lineWidth = 2;
          g.beginPath(); g.moveTo(origem.x, origem.y); g.lineTo(alvo.x, alvo.y); g.stroke(); g.setLineDash([]);
          _token(alvo, ctx.meuUid, 0.45, false);
        }
        if (sel.dir !== null) {
          var lin = _linha(sel.dest, sel.dir, raio);
          var fimL = lin.length ? _px(lin[lin.length - 1]) : alvo;
          g.setLineDash([3, 6]); g.lineCap = 'round';
          g.strokeStyle = _alpha(cor, 0.55 + 0.35 * pulso); g.lineWidth = Math.max(2, tam * 0.16);
          g.beginPath(); g.moveTo(alvo.x, alvo.y); g.lineTo(fimL.x, fimL.y); g.stroke();
          g.setLineDash([]);
          var mira = lin.length ? _hxImg('alvo') : null;
          if (mira) { var ms = tam * (1.25 + 0.12 * pulso); g.drawImage(mira, fimL.x - ms / 2, fimL.y - ms / 2, ms, ms); }
          _seta(alvo, sel.dir, cor);
        }
      }

      // Lasers (revelação)
      if (revelando && t >= T_MOVE) {
        var pl = _ease((t - T_MOVE) / (T_LASER - T_MOVE - 250));
        var apagar = t > T_QUEDA ? Math.max(0, 1 - (t - T_QUEDA) / 500) : 1;
        Object.keys(est.res.mov).forEach(function (uid) {
          var de = _ler(est.res.mov[uid]);
          var lin = _linha(de, est.res.dir[uid], raio);
          if (!lin.length) return;
          var a = _px(de), b = _px(lin[lin.length - 1]);
          var bx = a.x + (b.x - a.x) * pl, by = a.y + (b.y - a.y) * pl;
          var cor = _cor(uid);
          g.save(); g.globalAlpha = apagar; g.lineCap = 'round';
          g.shadowColor = cor; g.shadowBlur = 14;
          g.strokeStyle = cor; g.lineWidth = Math.max(3, tam * 0.24);
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(bx, by); g.stroke();
          g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1, tam * 0.07);
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(bx, by); g.stroke();
          g.restore();
        });
      }

      // Jogadores
      var uids = Object.keys(est.vivos || {});
      uids.forEach(function (uid) {
        var p0 = _ler(est.pos[uid]); if (!p0) return;
        var p = _px(p0), escala = 1, alpha = 1, morto = false;
        if (revelando && est.res.mov[uid]) {
          var k = _ease(t / T_MOVE);
          if (est.res.bate[uid]) {
            // Esbarrou: vai até a metade do caminho e volta.
            var pb = _px(_ler(est.res.bate[uid]));
            var kb = 0.45 * Math.sin(Math.PI * Math.min(1, t / T_MOVE));
            p = { x: p.x + (pb.x - p.x) * kb, y: p.y + (pb.y - p.y) * kb };
          } else {
            var p1 = _px(_ler(est.res.mov[uid]));
            p = { x: p.x + (p1.x - p.x) * k, y: p.y + (p1.y - p.y) * k };
          }
          var m = est.res.mortes[uid];
          if (m && m.indexOf('laser:') === 0 && t >= T_LASER) {
            var km = Math.min(1, (t - T_LASER) / (T_MORTE - T_LASER));
            escala = 1 + 0.5 * km; alpha = 1 - km; morto = true;
          } else if (m === 'queda' && t >= T_MORTE) {
            escala = 1 - queda; alpha = 1 - queda; morto = true;
          }
        } else if (revelando && est.res.mortes[uid] === 'saiu') {
          alpha = 0.25;
        }
        if (alpha <= 0.02) return;
        g.globalAlpha = alpha;
        _token(p, uid, 1, uid === ctx.meuUid && !morto, escala, morto && t >= T_LASER);
        g.globalAlpha = 1;
      });
    }

    function _alpha(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function _token(p, uid, alpha, souEu, escala, flash) {
      var r = tam * 0.56 * (escala || 1);
      var cor = _cor(uid);
      g.save();
      if (alpha < 1) g.globalAlpha = alpha * (g.globalAlpha || 1);
      if (souEu) {
        g.beginPath(); g.arc(p.x, p.y, r + 4 + 2 * Math.sin(Date.now() / 200), 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.stroke();
      }
      var ficha = _hxImg(flash ? 'ficha-nocaute' : (_HX_FICHAS[(est && est.cores && est.cores[uid]) || 0] || _HX_FICHAS[0]));
      if (ficha) {
        var fs = r * 2.3;
        g.drawImage(ficha, p.x - fs / 2, p.y - fs / 2, fs, fs);
        g.restore();
        return;
      }
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fillStyle = flash ? '#ffffff' : cor; g.fill();
      g.lineWidth = 2; g.strokeStyle = 'rgba(15,10,25,.8)'; g.stroke();
      g.fillStyle = '#140f22';
      g.font = '800 ' + Math.round(r * 1.05) + 'px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(flash ? '✖' : (_nome(uid).charAt(0) || '?').toUpperCase(), p.x, p.y + 1);
      g.restore();
    }
    function _seta(p, d, cor) {
      var a = _px({ q: DIRS[d][0], r: DIRS[d][1] });
      var vx = a.x - cx, vy = a.y - cy, n = Math.sqrt(vx * vx + vy * vy);
      vx /= n; vy /= n;
      var base = tam * 0.62, ponta = tam * 1.0, lado = tam * 0.22;
      g.beginPath();
      g.moveTo(p.x + vx * ponta, p.y + vy * ponta);
      g.lineTo(p.x + vx * base - vy * lado, p.y + vy * base + vx * lado);
      g.lineTo(p.x + vx * base + vy * lado, p.y + vy * base - vx * lado);
      g.closePath(); g.fillStyle = cor; g.fill();
    }

    /* ── HUD ────────────────────────────────────────────────────── */
    function _pintarJogadores() {
      if (!est) { elJog.innerHTML = ''; return; }
      var uids = Object.keys(est.nomes || {});
      uids.sort(function (a, b) { return (est.cores[a] || 0) - (est.cores[b] || 0); });
      elJog.innerHTML = uids.map(function (uid) {
        var vivoU = !!(est.vivos && est.vivos[uid]);
        var st = '';
        if (!vivoU) st = '💀';
        else if (est.fase === 'planejar') st = confirmados[uid] ? '✓' : '…';
        return '<span class="hx-chip' + (vivoU ? '' : ' morto') + (uid === ctx.meuUid ? ' eu' : '') + '">' +
          '<i style="background:' + _cor(uid) + '"></i>' + _esc(_nome(uid)) +
          (uid === ctx.meuUid ? ' <small>(você)</small>' : '') +
          (st ? ' <b>' + st + '</b>' : '') + '</span>';
      }).join('');
    }

    function _pintarControles() {
      var planejando = _souVivo() && !enviado[est.round];
      elCtrl.style.visibility = planejando ? 'visible' : 'hidden';
      var btns = elCtrl.querySelectorAll('.hx-seg-btn');
      for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', !!sel && btns[i].getAttribute('data-hx-modo') === sel.modo);
      elConf.disabled = !(planejando && sel && sel.dir !== null);
      elConf.textContent = (sel && sel.dir === null) ? 'Escolha a mira' : 'Confirmar';
    }

    function _msg(txt) { elMsg.textContent = txt; }

    function _tick() {
      if (!vivo || !est) return;
      if (est.fase === 'planejar') {
        var resta = Math.max(0, est.prazoMs - (Date.now() - recebidoEm));
        elTempo.textContent = Math.ceil(resta / 1000) + 's';
        elBarra.style.width = (100 * resta / est.prazoMs) + '%';
        elBarra.classList.toggle('urgente', resta < 4000);
        // Prazo acabou e eu não confirmei: vale o que estiver marcado.
        if (resta <= 0 && _souVivo() && !enviado[est.round]) _enviar(true);
      } else {
        elTempo.textContent = '';
        elBarra.style.width = '0%';
      }
    }

    /* ── Entrada de toque ──────────────────────────────────────── */
    var _apertado = false;
    function _ponto(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function _tocar(e, arrastando) {
      if (!_souVivo() || enviado[est.round] || !sel) return;
      var pt = _ponto(e);
      if (sel.modo === 'mover') {
        if (arrastando) return;
        var c = _hexDe(pt.x, pt.y);
        var meu = _ler(est.pos[ctx.meuUid]);
        if (_dist0(c.q, c.r) > est.raio) return;
        if (_dist(meu, c) > MOVER_MAX) { _msg('Longe demais — dá pra andar até ' + MOVER_MAX + ' casas.'); _som('erro'); return; }
        sel.dest = c;
        _som('toque'); _vibrar(8);
        var aviso = _dist0(c.q, c.r) >= est.raio ? '⚠ Essa casa desaba no fim do round! ' : '';
        // Primeira escolha de destino já leva pra mira — é o passo seguinte.
        if (sel.dir === null) { sel.modo = 'mirar'; _msg(aviso + 'Agora toque (ou arraste) pra escolher a direção do laser.'); }
        else _msg(aviso || 'Destino marcado. Confirme quando quiser.');
      } else {
        var d = _dirPara(sel.dest, pt.x, pt.y);
        if (d === null) return;
        if (d !== sel.dir) { sel.dir = d; if (!arrastando) _som('toque'); _vibrar(6); }
        _msg('Mira pronta. Toque em Confirmar — ninguém vê a sua escolha.');
      }
      _pintarControles();
    }
    function _onDown(e) { _apertado = true; try { canvas.setPointerCapture(e.pointerId); } catch (er) {} _tocar(e, false); e.preventDefault(); }
    function _onMove(e) { if (_apertado && sel && sel.modo === 'mirar') _tocar(e, true); }
    function _onUp() { _apertado = false; }
    canvas.addEventListener('pointerdown', _onDown);
    canvas.addEventListener('pointermove', _onMove);
    canvas.addEventListener('pointerup', _onUp);
    canvas.addEventListener('pointercancel', _onUp);

    function _onCtrl(e) {
      var b = e.target.closest && e.target.closest('[data-hx-modo]');
      if (b && sel) {
        sel.modo = b.getAttribute('data-hx-modo');
        _msg(sel.modo === 'mover' ? 'Toque numa casa clara (até ' + MOVER_MAX + ') — ou na sua pra ficar parado.' : 'Toque (ou arraste) pra escolher a direção do laser.');
        _pintarControles();
      }
    }
    elCtrl.addEventListener('click', _onCtrl);
    elConf.addEventListener('click', function () { _enviar(false); });

    function _onResize() { _medir(); }
    window.addEventListener('resize', _onResize);

    /* ── Rede: enviar a minha jogada ─────────────────────────────── */
    function _enviar(automatico) {
      if (!est || !_souVivo() || enviado[est.round] || !sel) return;
      var d = sel.dir === null ? Math.floor(Math.random() * 6) : sel.dir;
      enviado[est.round] = true;
      ctx.jogadasRef.child(String(est.round) + '/' + ctx.meuUid).set({
        v: sel.dest.q + ',' + sel.dest.r + ',' + d,
        em: ctx.agora
      }).catch(function () {});
      confirmados[ctx.meuUid] = true;
      _som(automatico ? 'erro' : 'acerto'); _vibrar(15);
      _msg(automatico ? 'Tempo! Valeu o que estava marcado. Esperando os outros…' : 'Confirmado! Esperando os outros…');
      _pintarControles(); _pintarJogadores();
    }

    /* Escuta só a PRESENÇA de jogadas do round (pra mostrar "✓").
       No anfitrião a mesma escuta guarda o conteúdo pra resolver. */
    function _ouvirJogadas(round) {
      if (jogadasRefRound && jogadasCbRound) { try { jogadasRefRound.off('value', jogadasCbRound); } catch (e) {} }
      jogadasRound = {}; confirmados = {};
      jogadasRefRound = ctx.jogadasRef.child(String(round));
      jogadasCbRound = function (snap) {
        if (!vivo || !est || est.round !== round) return;
        var val = snap.val() || {};
        confirmados = {};
        Object.keys(val).forEach(function (uid) {
          confirmados[uid] = true;
          if (ctx.souAnfitriao()) jogadasRound[uid] = String((val[uid] && val[uid].v) || '');
        });
        _pintarJogadores();
        if (ctx.souAnfitriao()) _anfChecar();
      };
      jogadasRefRound.on('value', jogadasCbRound);
    }

    /* ── Anfitrião ─────────────────────────────────────────────── */
    var _anfResolvido = {};   // round -> true
    var _anfPrazo = null;
    function _presentes() {
      var j = ctx.jogadores() || {}, out = {};
      Object.keys(j).forEach(function (u) { out[u] = true; });
      return out;
    }
    function _anfChecar() {
      if (!ctx.souAnfitriao() || !est || est.fase !== 'planejar' || _anfResolvido[est.round]) return;
      var pres = _presentes();
      var faltam = Object.keys(est.vivos).filter(function (u) { return pres[u] && !jogadasRound[u]; });
      if (!faltam.length) _anfResolver();
    }
    function _anfResolver() {
      if (!est || est.fase !== 'planejar' || _anfResolvido[est.round]) return;
      _anfResolvido[est.round] = true;
      if (_anfPrazo) { clearTimeout(_anfPrazo); _anfPrazo = null; }
      var rev = _resolver(est, jogadasRound, _presentes());
      ctx.estadoRef.set(rev).catch(function () {});
      if (rev.fase === 'fim') {
        _later(function () { ctx.fim(rev.coloc); }, FIM_MS);
      } else {
        _later(function () { ctx.estadoRef.set(_proximoRound(rev)).catch(function () {}); }, REVELAR_MS);
      }
    }

    /* ── Estado recebido ───────────────────────────────────────── */
    function _aoEstado(snap) {
      var novo = snap.val();
      if (!vivo) return;
      if (!novo) {
        // Ainda não existe: quem cria é o anfitrião (uma vez por partida).
        if (ctx.souAnfitriao() && !est) ctx.estadoRef.set(_estadoInicial(ctx.jogadores() || {})).catch(function () {});
        return;
      }
      var chave = novo.round + '|' + novo.fase;
      if (chave === faseChave) return;
      faseChave = chave;
      est = novo;
      // O RTDB não guarda objeto vazio: { mortes: {} } volta sem a chave.
      est.elim = est.elim || {};
      est.pos = est.pos || {};
      est.vivos = est.vivos || {};
      if (est.res) { est.res.mov = est.res.mov || {}; est.res.dir = est.res.dir || {}; est.res.mortes = est.res.mortes || {}; est.res.bate = est.res.bate || {}; }
      recebidoEm = Date.now();
      _medir();
      var limite = _roundLimite(est.raioInicial);
      elRound.textContent = 'Round ' + est.round + ' de ' + limite + (est.raio <= 1 ? ' · arena final' : '');

      if (est.fase === 'planejar') {
        _ouvirJogadas(est.round);
        var meu = est.pos[ctx.meuUid];
        sel = meu ? { dest: _ler(meu), dir: null, modo: 'mover' } : null;
        if (_souVivo()) {
          _msg(est.round === 1
            ? 'Escolha onde parar (até ' + MOVER_MAX + ' casas) e pra onde atirar. Ninguém vê a sua escolha!'
            : est.raio <= 1
              ? 'Arena final! Nada mais desaba, mas quem divide casa esbarra e volta. ' + (limite - est.round + 1) + ' round(s) pro empate.'
              : 'A borda vermelha vai desabar! Escolha onde parar e pra onde atirar.');
          _som('toque');
        } else {
          _msg('Você está fora — assistindo os outros.');
        }
        if (ctx.souAnfitriao()) {
          if (_anfPrazo) clearTimeout(_anfPrazo);
          _anfPrazo = _later(_anfResolver, est.prazoMs + FOLGA_MS);
          _anfChecar();
        }
      } else if (est.res) {
        _msg('Revelando…');
        _som('nivelUp');
        _later(function () { _som('dano'); }, T_LASER - 200);
        _later(_anunciarMortes, T_MORTE);
        if (est.fase === 'fim') _later(_mostrarFim, T_QUEDA + 400);
      }
      _pintarJogadores();
      _pintarControles();
    }

    function _anunciarMortes() {
      if (!est || !est.res) return;
      var m = est.res.mortes || {};
      var frases = Object.keys(m).map(function (uid) {
        if (m[uid] === 'queda') return '🕳️ ' + _nome(uid) + ' caiu da arena';
        if (m[uid] === 'saiu') return '🚪 ' + _nome(uid) + ' saiu';
        return '💥 ' + _nome(m[uid].slice(6)) + ' acertou ' + _nome(uid);
      });
      var bateram = Object.keys(est.res.bate || {}).filter(function (u) { return !m[u]; });
      if (bateram.length) frases.push('💢 ' + bateram.map(_nome).join(', ') + (bateram.length > 1 ? ' esbarraram e voltaram' : ' esbarrou e voltou'));
      _msg(frases.length ? frases.join(' · ') : 'Ninguém caiu neste round!');
      if (m[ctx.meuUid] && m[ctx.meuUid] !== 'saiu') { _vibrar([40, 60, 40]); _som('erro'); }
    }

    function _mostrarFim() {
      if (!est || !est.coloc) return;
      var coloc = est.coloc;
      var uids = Object.keys(coloc).sort(function (a, b) { return coloc[a] - coloc[b]; });
      var vencedores = uids.filter(function (u) { return coloc[u] === 1; });
      var titulo = vencedores.length === 1 ? '🏆 ' + _nome(vencedores[0]) + ' venceu!'
                 : '🤝 Empate: ' + vencedores.map(_nome).join(' e ');
      var minha = coloc[ctx.meuUid] || 0;
      var moedas = 0;
      if (minha && !premiado) {
        premiado = true;
        moedas = (minha === 1 && vencedores.length > 1) ? MOEDAS_EMPATE_1 : (MOEDAS_POR_COLOCACAO[minha - 1] || 0);
        var G = window.AngatubaGames;
        if (G) {
          try { if (moedas && G.moedasAdd) G.moedasAdd(moedas, 'hexarena'); } catch (e) {}
          try {
            if (G.historicoRegistrar) G.historicoRegistrar('hexarena', {
              resultado: minha === 1 ? (vencedores.length > 1 ? 'empate' : 'vitoria') : 'derrota',
              score: est.elim[ctx.meuUid] || est.round,
              placar: minha + 'º de ' + uids.length
            });
          } catch (e) {}
        }
        if (typeof ctx.recompensa === 'function') ctx.recompensa(moedas);
        _som('fim', minha === 1);
        if (minha === 1 && G && G.efeitos) G.efeitos.confete('hx-palco');
      }
      elFim.innerHTML = '<div class="hx-fim-tit">' + _esc(titulo) + '</div>' +
        '<ol class="hx-fim-lista">' + uids.map(function (u) {
          return '<li><i style="background:' + _cor(u) + '"></i><span>' + coloc[u] + 'º</span> ' + _esc(_nome(u)) + '</li>';
        }).join('') + '</ol>' +
        (minha ? '<div class="hx-fim-moedas">' + (moedas ? '+' + moedas + ' 🪙' : '') + '</div>' : '') +
        '<div class="hx-fim-sub">Placar da Party em instantes…</div>';
      elFim.style.display = 'flex';
      _msg('Fim da Hex Arena!');
    }

    /* ── Liga ──────────────────────────────────────────────────── */
    ctx.escutar(ctx.estadoRef, 'value', _aoEstado);
    _medir();
    raf = window.requestAnimationFrame(_desenhar);
    tickTimer = setInterval(_tick, 250);

    function pararInst() {
      if (!vivo) return;
      vivo = false;
      timers.forEach(clearTimeout); timers = [];
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      if (_anfPrazo) { clearTimeout(_anfPrazo); _anfPrazo = null; }
      if (raf) { window.cancelAnimationFrame(raf); raf = null; }
      if (jogadasRefRound && jogadasCbRound) { try { jogadasRefRound.off('value', jogadasCbRound); } catch (e) {} }
      window.removeEventListener('resize', _onResize);
      if (_atual === api) _atual = null;
    }

    var api = {
      parar: pararInst,
      // party.js avisa a cada mudança da sala: alguém que saiu conta como
      // "já respondeu" pro anfitrião não ficar esperando quem não volta.
      salaMudou: function () { if (vivo && ctx.souAnfitriao()) _anfChecar(); _pintarJogadores(); }
    };
    return api;
  }

  window.HexArenaGame = {
    montar: montar,
    parar: parar,
    // Exposto pra teste (lógica pura, sem DOM nem rede).
    _logica: { estadoInicial: _estadoInicial, resolver: _resolver, proximoRound: _proximoRound, linha: _linha }
  };
})();
