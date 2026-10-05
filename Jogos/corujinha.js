/* ═══════════════════════════════════════════════════════════════
   CORUJINHA — slot 3×3 da coruja (módulo de jogo, lazy-loaded)
   Carregado sob demanda pelo hub (_jogoLoader('corujinha')). Fala com o
   app SÓ pela ponte window.AngatubaGames (moedas, inventário, catálogo,
   som). Expõe window.CorujinhaGame = { preparar, parar }.

   MECÂNICA
   - Grade 3×3, 5 linhas (meio, cima, baixo e as 2 diagonais). Linha
     completa = 3 símbolos iguais; a CORUJA é coringa (vale por qualquer
     símbolo, menos o ovo). Prêmio de cada linha = aposta × PAGA[símbolo];
     várias linhas somam.
   - TELA CHEIA: as 9 casas formam o mesmo símbolo → total ×10.
   - VOO DA SORTE (recurso especial, ~1 em 35 giros): a coruja escolhe um
     símbolo; as casas com ele (ou coringa) travam e o resto re-gira até
     sair pelo menos uma linha (garantido).
   - OVO DOURADO: 3 ovos na grade = um cosmético da Loja (se já tiver,
     vira 45% do preço em moedas). Chance = aposta × 0,0002 (0,1% a 1%).
   - Teto: nenhum giro paga mais que 20× a aposta.

   ECONOMIA (simulação de 600 mil giros por aposta — ver comentário em CJM):
   retorno médio ≈ 83% em moedas + ≈ 3% em cosméticos. A Corujinha drena
   moedas no longo prazo; cada partida dos outros jogos paga no máx. 25.

   O giro inteiro (grades, recurso, prêmio) é sorteado ANTES da animação
   e já aplicado ao saldo/inventário — a animação é só visual, então
   sair no meio não perde nem duplica nada.

   ARTE: pixel art provisória em /Jogos/assets/corujinha/ (PNG pequeno,
   desenhado com image-rendering: pixelated). Pra trocar por arte final,
   basta substituir os arquivos mantendo os nomes (proporção quadrada nos
   símbolos; coruja-sheet.png = 4 quadros lado a lado).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var ASSETS = '/Jogos/assets/corujinha/';
  var APOSTAS = [5, 10, 15, 20, 25, 30, 40, 50];
  var NOMES = { coruja: 'Coruja', coroa: 'Coroa', igreja: 'Matriz', livro: 'Livro', estrela: 'Estrela', milho: 'Milho', moeda: 'Moeda', ovo: 'Ovo dourado' };
  var FAIXAS = [ { min: 18, txt: 'SUPER GANHO' }, { min: 12, txt: 'MEGA GANHO' }, { min: 8, txt: 'GRANDE GANHO' } ];
  var CONVERSAO_REPETIDO = 0.45;

  /* ── MATEMÁTICA (pura, sem DOM) ────────────────────────────────
     Cada casa é sorteada por PESO (independente). Linhas pagam PAGA ×
     aposta. Valores ajustados por simulação (600 mil giros por aposta):
       retorno ≈ 83% em moedas (+ ≈ 3% em cosméticos do ovo)
       acerto (algum prêmio) ≈ 31%   ·   lucro (ganho > aposta) ≈ 20%
       GRANDE GANHO (≥ 8×) ~1 em 62 · MEGA (≥ 12×) ~1 em 230 ·
       SUPER (≥ 18×) ~1 em 540 · teto 20× ~1 em 900
       Voo da Sorte ≈ 1 em 35 giros
     Mexeu em PESO/PAGA/P_VOO? Rode a simulação de novo (window.CorujinhaGame._mat). */
  var CJM = (function () {
    var PAGA = { coruja: 20, coroa: 10, igreja: 7, livro: 5, estrela: 3, milho: 1.5, moeda: 1 };
    var PESO = { coruja: 5, coroa: 6, igreja: 9, livro: 12, estrela: 16, milho: 22, moeda: 28, ovo: 3 };
    // [linha, coluna] de cada casa — ordem = número da linha na tela (1..5)
    var LINHAS = [
      [[1, 0], [1, 1], [1, 2]],   // 1 meio
      [[0, 0], [0, 1], [0, 2]],   // 2 cima
      [[2, 0], [2, 1], [2, 2]],   // 3 baixo
      [[0, 0], [1, 1], [2, 2]],   // 4 diagonal ↘
      [[2, 0], [1, 1], [0, 2]]    // 5 diagonal ↗
    ];
    var CHEIA_MULT = 10, TETO = 20;
    var P_VOO = 1 / 35, VOO_MAX = 8, VOO_P_SIMB = 0.22, VOO_P_CORINGA = 0.04;
    var VOO_SIMB = { coroa: 1, igreja: 2, livro: 3, estrela: 4, milho: 5, moeda: 5 };
    var OVO_POR_MOEDA = 0.0002;
    var rnd = Math.random;

    function pesoEscolher(tab) {
      var t = 0, k;
      for (k in tab) t += tab[k];
      var x = rnd() * t;
      for (k in tab) { if (x < tab[k]) return k; x -= tab[k]; }
      return k;
    }
    function celula(semOvo) {
      if (!semOvo) return pesoEscolher(PESO);
      var t = {};
      for (var k in PESO) if (k !== 'ovo') t[k] = PESO[k];
      return pesoEscolher(t);
    }
    function grade() {
      var g = [[], [], []];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) g[r][c] = celula(false);
      return g;
    }
    function copiar(m) { return [m[0].slice(), m[1].slice(), m[2].slice()]; }
    function contar(g, s) {
      var n = 0;
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) if (g[r][c] === s) n++;
      return n;
    }
    // { linhas: [{ i, simb, paga }], mult, cheia }
    function avaliar(g) {
      var res = [], mult = 0, i, j;
      for (i = 0; i < LINHAS.length; i++) {
        var L = LINHAS[i], base = null, ok = true;
        for (j = 0; j < 3; j++) {
          var s = g[L[j][0]][L[j][1]];
          if (s === 'ovo') { ok = false; break; }
          if (s === 'coruja') continue;
          if (base === null) base = s;
          else if (s !== base) { ok = false; break; }
        }
        if (!ok) continue;
        var simb = base || 'coruja';
        res.push({ i: i, simb: simb, paga: PAGA[simb] });
        mult += PAGA[simb];
      }
      var cheia = false;
      if (res.length === 5) {
        var b = null; cheia = true;
        for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
          var s2 = g[r][c];
          if (s2 === 'coruja') continue;
          if (b === null) b = s2; else if (s2 !== b) cheia = false;
        }
      }
      if (cheia) mult *= CHEIA_MULT;
      return { linhas: res, mult: mult, cheia: cheia };
    }
    // Voo da Sorte: trava o símbolo escolhido (e coringas) e re-gira o
    // resto até sair linha. Devolve os passos (grade + travas) pra animar.
    function vooRodar(simb, g) {
      var passos = [], trava = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r, c;
      function travar() {
        for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) if (g[r][c] === simb || g[r][c] === 'coruja') trava[r][c] = 1;
      }
      travar();
      passos.push({ g: copiar(g), trava: copiar(trava) });
      var n = 0;
      while (avaliar(g).linhas.length === 0 && n < VOO_MAX) {
        n++;
        for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) {
          if (trava[r][c]) continue;
          var x = rnd();
          if (x < VOO_P_SIMB) g[r][c] = simb;
          else if (x < VOO_P_SIMB + VOO_P_CORINGA) g[r][c] = 'coruja';
          else { var f; do { f = celula(true); } while (f === simb || f === 'coruja'); g[r][c] = f; }
        }
        travar();
        passos.push({ g: copiar(g), trava: copiar(trava) });
      }
      if (avaliar(g).linhas.length === 0) {
        // Garantia: completa a linha que já tem mais casas travadas.
        var melhor = -1, mi = 0;
        for (var i = 0; i < LINHAS.length; i++) {
          var t = 0;
          LINHAS[i].forEach(function (p) { t += trava[p[0]][p[1]]; });
          if (t > melhor) { melhor = t; mi = i; }
        }
        LINHAS[mi].forEach(function (p) { if (!trava[p[0]][p[1]]) g[p[0]][p[1]] = simb; });
        travar();
        passos.push({ g: copiar(g), trava: copiar(trava) });
      }
      return passos;
    }
    // Sorteia o giro inteiro. NÃO mexe em saldo.
    function sortear(aposta) {
      var r = { aposta: aposta, passos: null, voo: null, ovo: false, linhas: [], mult: 0, cheia: false, ganho: 0, teto: false };
      var g, a, b;
      r.ovo = rnd() < aposta * OVO_POR_MOEDA;
      if (!r.ovo && rnd() < P_VOO) {
        r.voo = pesoEscolher(VOO_SIMB);
        // Grade inicial do recurso SEM linha pronta — o prêmio tem que sair
        // dos re-giros (senão o "Voo" anunciava um símbolo e pagava outro).
        do {
          g = grade();
          for (a = 0; a < 3; a++) for (b = 0; b < 3; b++) {
            if (g[a][b] === 'ovo') g[a][b] = celula(true);
            if (rnd() < 0.3) g[a][b] = r.voo;
          }
        } while (avaliar(g).linhas.length);
        r.passos = vooRodar(r.voo, g);
      } else {
        g = grade();
        // Ovo "natural": no máximo 2 (o 3º só vem do prêmio sorteado acima).
        while (contar(g, 'ovo') > 2) {
          a = Math.floor(rnd() * 3); b = Math.floor(rnd() * 3);
          if (g[a][b] === 'ovo') g[a][b] = celula(true);
        }
        if (r.ovo) {
          for (b = 0; b < 3; b++) {
            for (a = 0; a < 3; a++) if (g[a][b] === 'ovo') g[a][b] = celula(true);
            g[Math.floor(rnd() * 3)][b] = 'ovo';
          }
        }
        r.passos = [{ g: g, trava: null }];
      }
      var ev = avaliar(r.passos[r.passos.length - 1].g);
      r.linhas = ev.linhas; r.mult = ev.mult; r.cheia = ev.cheia;
      if (r.mult > TETO) { r.mult = TETO; r.teto = true; }
      r.ganho = Math.floor(aposta * r.mult);
      return r;
    }
    return {
      sortear: sortear, avaliar: avaliar, celula: celula,
      LINHAS: LINHAS, PAGA: PAGA, PESO: PESO, CHEIA_MULT: CHEIA_MULT, TETO: TETO,
      P_VOO: P_VOO, OVO_POR_MOEDA: OVO_POR_MOEDA,
      _setRnd: function (f) { rnd = f || Math.random; }
    };
  })();

  /* ── Ponte / util ────────────────────────────────────────────── */
  function G() { return window.AngatubaGames || null; }
  function som(nome, arg) {
    var g = G(), S = g && g.som;
    if (S && typeof S[nome] === 'function') { try { S[nome](arg); } catch (e) {} }
  }
  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function saldoReal() { var g = G(); return g && g.moedasSaldo ? g.moedasSaldo() : 0; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function reduzido() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ── Estado ──────────────────────────────────────────────────── */
  var st = {
    aposta: 10, turbo: false, auto: 0, girando: false,
    pend: 0,                 // prêmio já creditado, ainda não "revelado" no saldo da tela
    grade: null,             // o que a tela mostra agora
    timers: [], raf: 0, montado: false, ultimoGanho: 0, bigAberto: false
  };
  function later(fn, ms) { var t = setTimeout(fn, ms); st.timers.push(t); return t; }
  function limparTimers() {
    st.timers.forEach(clearTimeout); st.timers = [];
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
  }
  function esperar(ms) { return new Promise(function (ok) { later(ok, ms); }); }
  function tempo(ms) { return st.turbo ? Math.round(ms * 0.45) : ms; }

  /* ── Coruja mascote (sprite 4 quadros: 0 parada, 1 piscando, 2/3 asas) ── */
  var coruja = { modo: 'parada', piscaT: 0, asaT: 0 };
  function corujaQuadro(q) {
    var el = $('cjx-coruja');
    if (el) el.style.backgroundPosition = (q * 100 / 3) + '% 0';
  }
  function corujaModo(modo, ms) {
    var el = $('cjx-coruja'); if (!el) return;
    clearInterval(coruja.asaT); clearTimeout(coruja.piscaT);
    coruja.modo = modo;
    el.classList.remove('cjx-coruja-festa', 'cjx-coruja-voo', 'cjx-coruja-gira');
    if (modo === 'festa' || modo === 'voo') {
      el.classList.add(modo === 'festa' ? 'cjx-coruja-festa' : 'cjx-coruja-voo');
      var q = 2;
      corujaQuadro(q);
      coruja.asaT = setInterval(function () { q = q === 2 ? 3 : 2; corujaQuadro(q); }, modo === 'voo' ? 110 : 170);
      if (ms) coruja.piscaT = setTimeout(function () { corujaModo('parada'); }, ms);
      return;
    }
    if (modo === 'gira') el.classList.add('cjx-coruja-gira');
    corujaQuadro(0);
    (function piscar() {
      coruja.piscaT = setTimeout(function () {
        corujaQuadro(1);
        coruja.piscaT = setTimeout(function () { corujaQuadro(0); piscar(); }, 140);
      }, 2200 + Math.random() * 2600);
    })();
  }
  function balao(txt, ms) {
    var b = $('cjx-balao'); if (!b) return;
    if (!txt) { b.classList.remove('cjx-balao-on'); return; }
    b.textContent = txt;
    b.classList.remove('cjx-balao-on'); void b.offsetWidth; b.classList.add('cjx-balao-on');
    if (ms) later(function () { b.classList.remove('cjx-balao-on'); }, ms);
  }

  /* ── DOM ─────────────────────────────────────────────────────── */
  function simHtml(s) {
    return '<div class="cjx-s cjx-s-' + s + '"><i style="background-image:url(\'' + ASSETS + 'sim-' + s + '.png\')"></i>' +
           (s === 'coruja' ? '<b>CORINGA</b>' : '') + '</div>';
  }
  function marcasHtml(lado) {
    // números das linhas nas laterais (esquerda: 2·4 / 1 / 3·5 · direita: 2·5 / 1 / 3·4)
    var m = lado === 'e' ? [[2, 4], [1], [3, 5]] : [[2, 5], [1], [3, 4]];
    return '<div class="cjx-marcas cjx-marcas-' + lado + '">' + m.map(function (row) {
      return '<div>' + row.map(function (n) { return '<span data-l="' + n + '">' + n + '</span>'; }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function criarDOM() {
    var root = $('corujinha-root');
    if (!root) return false;
    var cels = '';
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      cels += '<div class="cjx-cel" id="cjx-cel-' + r + c + '"><div class="cjx-fita"></div></div>';
    }
    var estrelas = '';
    for (var k = 0; k < 26; k++) {
      estrelas += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 62).toFixed(1) + '%;animation-delay:' + (Math.random() * 3).toFixed(2) + 's"></i>';
    }
    root.innerHTML =
      '<div class="cjx" id="cjx">' +
        '<div class="cjx-ceu" aria-hidden="true">' + estrelas + '<div class="cjx-skyline"></div></div>' +
        '<div class="cjx-topo">' +
          '<button type="button" class="cjx-ico" aria-label="Voltar aos jogos" onclick="CorujinhaGame._voltar()"><i class="fa fa-chevron-left"></i></button>' +
          '<div class="cjx-logo">CORUJINHA</div>' +
          '<button type="button" class="cjx-ico" aria-label="Regras e prêmios" onclick="CorujinhaGame._tabela(true)"><i class="fa fa-info"></i></button>' +
        '</div>' +
        '<div class="cjx-palco">' +
          '<div class="cjx-mascote"><div class="cjx-coruja" id="cjx-coruja"></div><div class="cjx-balao" id="cjx-balao"></div></div>' +
          '<div class="cjx-maquina" id="cjx-maquina">' +
            marcasHtml('e') +
            '<div class="cjx-moldura"><div class="cjx-grade" id="cjx-grade">' + cels +
              '<svg class="cjx-linhas" id="cjx-linhas" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true"></svg>' +
            '</div></div>' +
            marcasHtml('d') +
          '</div>' +
          '<div class="cjx-ganhobar" id="cjx-ganhobar" aria-live="polite"><span id="cjx-ganhotxt">Boa sorte!</span></div>' +
        '</div>' +
        '<div class="cjx-rodape">' +
          '<div class="cjx-painel">' +
            '<div><small>Saldo</small><b id="cjx-saldo">0</b></div>' +
            '<div><small>Aposta</small><b id="cjx-aposta">0</b></div>' +
            '<div><small>Ganho</small><b id="cjx-ganho">0</b></div>' +
          '</div>' +
          '<div class="cjx-controles">' +
            '<button type="button" class="cjx-redondo cjx-turbo" id="cjx-turbo" aria-label="Turbo" onclick="CorujinhaGame._turbo()"><i class="fa fa-bolt"></i><small>Turbo</small></button>' +
            '<button type="button" class="cjx-redondo" id="cjx-menos" aria-label="Diminuir aposta" onclick="CorujinhaGame._aposta(-1)"><i class="fa fa-minus"></i></button>' +
            '<button type="button" class="cjx-girar" id="cjx-girar" aria-label="Girar" onclick="CorujinhaGame._girar()"><i class="fa fa-rotate-right"></i><span id="cjx-autoconta"></span></button>' +
            '<button type="button" class="cjx-redondo" id="cjx-mais" aria-label="Aumentar aposta" onclick="CorujinhaGame._aposta(1)"><i class="fa fa-plus"></i></button>' +
            '<button type="button" class="cjx-redondo cjx-auto" id="cjx-auto" aria-label="Giro automático" onclick="CorujinhaGame._autoMenu()"><i class="fa fa-repeat"></i><small>Auto</small></button>' +
          '</div>' +
          '<div class="cjx-autopop" id="cjx-autopop">' +
            [10, 25, 50, 100].map(function (n) { return '<button type="button" onclick="CorujinhaGame._autoIniciar(' + n + ')">' + n + '</button>'; }).join('') +
          '</div>' +
        '</div>' +
        // Abertura
        '<div class="cjx-over cjx-splash" id="cjx-splash">' +
          '<div class="cjx-splash-raios"></div>' +
          '<div class="cjx-splash-coruja"></div>' +
          '<div class="cjx-logo cjx-logo-grande">CORUJINHA</div>' +
          '<div class="cjx-splash-sub">Alinhe 3 e ganhe!</div>' +
          '<ul class="cjx-splash-lista">' +
            '<li><i style="background-image:url(\'' + ASSETS + 'sim-coruja.png\')"></i>Coruja é coringa</li>' +
            '<li><i style="background-image:url(\'' + ASSETS + 'sim-estrela.png\')"></i>Voo da Sorte: re-giros até ganhar</li>' +
            '<li><i style="background-image:url(\'' + ASSETS + 'sim-coroa.png\')"></i>Tela cheia paga ×10</li>' +
            '<li><i style="background-image:url(\'' + ASSETS + 'sim-ovo.png\')"></i>3 ovos dourados = cosmético</li>' +
          '</ul>' +
          '<button type="button" class="cjx-comecar" onclick="CorujinhaGame._comecar()">COMEÇAR</button>' +
          '<div class="cjx-splash-nota">Moedas do app — não valem dinheiro.</div>' +
        '</div>' +
        // Grande ganho / ovo dourado
        '<div class="cjx-over cjx-big" id="cjx-big" onclick="CorujinhaGame._bigToque()">' +
          '<div class="cjx-big-raios"></div>' +
          '<div class="cjx-big-moedas" id="cjx-big-moedas"></div>' +
          '<div class="cjx-big-coruja"></div>' +
          '<div class="cjx-big-tit" id="cjx-big-tit">GRANDE GANHO</div>' +
          '<div class="cjx-big-item" id="cjx-big-item"></div>' +
          '<div class="cjx-big-num" id="cjx-big-num">0</div>' +
          '<div class="cjx-big-dica">toque pra continuar</div>' +
        '</div>' +
        // Regras e prêmios
        '<div class="cjx-over cjx-tabela" id="cjx-tabela">' +
          '<div class="cjx-tabela-box">' +
            '<button type="button" class="cjx-ico cjx-tabela-x" aria-label="Fechar" onclick="CorujinhaGame._tabela(false)"><i class="fa fa-xmark"></i></button>' +
            '<div class="cjx-tabela-tit">Prêmios e regras</div>' +
            '<div id="cjx-tabela-corpo"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    montarTabela();
    st.montado = true;
    return true;
  }

  function montarTabela() {
    var el = $('cjx-tabela-corpo'); if (!el) return;
    var ordem = ['coruja', 'coroa', 'igreja', 'livro', 'estrela', 'milho', 'moeda'];
    var linhasPaga = ordem.map(function (s) {
      return '<div class="cjx-tp">' + '<span class="cjx-tp-sims">' + simHtml(s) + simHtml(s) + simHtml(s) + '</span>' +
             '<span class="cjx-tp-nome">' + NOMES[s] + '</span><b>' + String(CJM.PAGA[s]).replace('.', ',') + '×</b></div>';
    }).join('');
    var mini = CJM.LINHAS.map(function (L, i) {
      var on = {}; L.forEach(function (p) { on[p[0] + '' + p[1]] = 1; });
      var q = '';
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) q += '<i' + (on[r + '' + c] ? ' class="on"' : '') + '></i>';
      return '<div class="cjx-mini"><div class="cjx-mini-g">' + q + '</div><span>' + (i + 1) + '</span></div>';
    }).join('');
    el.innerHTML =
      '<p class="cjx-tabela-p">Prêmio de cada linha = <b>aposta × valor</b>. Linhas premiadas somam.</p>' +
      linhasPaga +
      '<div class="cjx-tabela-sub">As 5 linhas</div><div class="cjx-minis">' + mini + '</div>' +
      '<div class="cjx-tabela-sub">Especiais</div>' +
      '<ul class="cjx-tabela-ul">' +
        '<li><b>Coruja (coringa)</b> vale por qualquer símbolo, menos o ovo.</li>' +
        '<li><b>Tela cheia</b>: as 9 casas iguais → prêmio ×' + CJM.CHEIA_MULT + '.</li>' +
        '<li><b>Voo da Sorte</b> (cerca de 1 em 35 giros): a coruja escolhe um símbolo, ele trava na grade e o resto gira de novo até sair linha.</li>' +
        '<li><b>3 ovos dourados</b> em qualquer lugar = um cosmético da Loja (se já tiver, vira ' + Math.round(CONVERSAO_REPETIDO * 100) + '% do preço em moedas). Chance de 0,1% (aposta 5) a 1% (aposta 50).</li>' +
        '<li>Nenhum giro paga mais que <b>' + CJM.TETO + '× a aposta</b>.</li>' +
        '<li>Retorno médio ≈ 86% do que é apostado (moedas + cosméticos). As moedas do app não valem dinheiro.</li>' +
      '</ul>';
  }

  /* ── Grade / rolos ──────────────────────────────────────────── */
  function fitaFixa(r, c, s) {
    var cel = $('cjx-cel-' + r + c); if (!cel) return;
    var f = cel.firstElementChild;
    f.classList.remove('cjx-borrao');
    f.style.transition = 'none';
    f.style.transform = 'none';
    f.innerHTML = simHtml(s);
  }
  function desenharGrade(g) {
    st.grade = g;
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) fitaFixa(r, c, g[r][c]);
  }
  function girarCel(r, c, alvo, n, ms) {
    var cel = $('cjx-cel-' + r + c); if (!cel) return;
    var f = cel.firstElementChild;
    var h = simHtml(st.grade ? st.grade[r][c] : alvo);
    for (var k = 0; k < n; k++) h += simHtml(CJM.celula(false));
    h += simHtml(alvo);
    f.style.transition = 'none';
    f.style.transform = 'translateY(0)';
    f.innerHTML = h;
    void f.offsetHeight;
    f.classList.add('cjx-borrao');
    // leve "quique" no fim (cubic-bezier com overshoot)
    f.style.transition = 'transform ' + ms + 'ms cubic-bezier(.3,.85,.35,1.06)';
    f.style.transform = 'translateY(-' + ((n + 1) * 100 / (n + 2)) + '%)';
    later(function () { f.classList.remove('cjx-borrao'); }, Math.max(0, ms - 140));
  }
  function limparDestaques() {
    var g = $('cjx-grade'); if (g) g.classList.remove('cjx-tem-ganho');
    var svg = $('cjx-linhas'); if (svg) svg.innerHTML = '';
    document.querySelectorAll('#cjx .cjx-cel').forEach(function (el) {
      el.classList.remove('cjx-ganha', 'cjx-trava', 'cjx-suspense', 'cjx-ovo-on');
    });
    document.querySelectorAll('#cjx .cjx-marcas span').forEach(function (el) { el.classList.remove('on'); });
    var m = $('cjx-maquina'); if (m) m.classList.remove('cjx-maquina-suspense', 'cjx-maquina-voo');
  }
  // Suspense no 3º rolo: duas primeiras casas de uma linha "boa" combinam,
  // ou já tem ovo nos 2 primeiros rolos.
  function temSuspense(g) {
    var ovo0 = 0, ovo1 = 0, r;
    for (r = 0; r < 3; r++) { if (g[r][0] === 'ovo') ovo0++; if (g[r][1] === 'ovo') ovo1++; }
    if (ovo0 && ovo1) return true;
    for (var i = 0; i < CJM.LINHAS.length; i++) {
      var L = CJM.LINHAS[i], a = g[L[0][0]][L[0][1]], b = g[L[1][0]][L[1][1]];
      if (a === 'ovo' || b === 'ovo') continue;
      var base = a === 'coruja' ? b : a;
      if ((a === b || a === 'coruja' || b === 'coruja') && (base === 'coruja' || base === 'coroa' || base === 'igreja')) return true;
    }
    return false;
  }
  // Gira as casas (todas, ou só as não travadas) até a grade g. Promise.
  function animarGiro(g, trava) {
    var base = tempo(reduzido() ? 160 : 720), passo = tempo(reduzido() ? 80 : 260);
    var suspense = !trava && !reduzido() && temSuspense(g);
    var fim = 0;
    for (var c = 0; c < 3; c++) {
      var extra = (c === 2 && suspense) ? tempo(1100) : 0;
      for (var r = 0; r < 3; r++) {
        if (trava && trava[r][c]) continue;
        var ms = base + c * passo + r * 40 + extra;
        var n = 6 + c * 3 + (extra ? 9 : 0);
        girarCel(r, c, g[r][c], n, ms);
        fim = Math.max(fim, ms);
      }
      (function (c, t) { later(function () { som('toque'); if (c === 1 && suspense) suspenseLigar(); }, t); })(c, base + c * passo + 80);
    }
    return esperar(fim + 60).then(function () {
      var m = $('cjx-maquina'); if (m) m.classList.remove('cjx-maquina-suspense');
      document.querySelectorAll('#cjx .cjx-cel').forEach(function (el) { el.classList.remove('cjx-suspense'); });
      desenharGrade(g);
    });
  }
  function suspenseLigar() {
    var m = $('cjx-maquina'); if (m) m.classList.add('cjx-maquina-suspense');
    for (var r = 0; r < 3; r++) { var el = $('cjx-cel-' + r + '2'); if (el) el.classList.add('cjx-suspense'); }
    som('mola');
  }

  /* ── Destaque das linhas ganhadoras ─────────────────────────── */
  function mostrarLinhas(linhas) {
    var svg = $('cjx-linhas'), gr = $('cjx-grade');
    if (!svg || !linhas.length) return;
    gr.classList.add('cjx-tem-ganho');
    var html = '';
    linhas.forEach(function (ln) {
      var L = CJM.LINHAS[ln.i];
      var pts = L.map(function (p) { return (50 + p[1] * 100) + ',' + (50 + p[0] * 100); });
      // estica a linha até as bordas
      var a = L[0], b = L[2];
      var x0 = 50 + a[1] * 100 - 46, y0 = 50 + a[0] * 100 - (b[0] - a[0]) * 23;
      var x1 = 50 + b[1] * 100 + 46, y1 = 50 + b[0] * 100 + (b[0] - a[0]) * 23;
      var d = x0 + ',' + y0 + ' ' + pts.join(' ') + ' ' + x1 + ',' + y1;
      html += '<polyline class="cjx-ln-brilho" points="' + d + '"/><polyline class="cjx-ln" points="' + d + '"/>';
      L.forEach(function (p) { var el = $('cjx-cel-' + p[0] + p[1]); if (el) el.classList.add('cjx-ganha'); });
      document.querySelectorAll('#cjx .cjx-marcas span[data-l="' + (ln.i + 1) + '"]').forEach(function (el) { el.classList.add('on'); });
    });
    svg.innerHTML = html;
  }
  function mostrarOvos(g) {
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) if (g[r][c] === 'ovo') { var el = $('cjx-cel-' + r + c); if (el) el.classList.add('cjx-ganha', 'cjx-ovo-on'); }
    $('cjx-grade').classList.add('cjx-tem-ganho');
  }

  /* ── Painel (saldo / aposta / ganho) ────────────────────────── */
  function saldoVisivel() { return Math.max(0, saldoReal() - st.pend); }
  function apostaValida() {
    var s = saldoVisivel();
    if (s < APOSTAS[0]) return 0;
    if (st.aposta > s) {
      for (var i = APOSTAS.length - 1; i >= 0; i--) if (APOSTAS[i] <= s) { st.aposta = APOSTAS[i]; break; }
    }
    return st.aposta;
  }
  function painel() {
    var s = $('cjx-saldo'); if (s) s.textContent = fmt(saldoVisivel());
    var a = $('cjx-aposta'); if (a) a.textContent = fmt(st.aposta);
    var gz = $('cjx-ganho'); if (gz) gz.textContent = fmt(st.ultimoGanho);
    var trava = st.girando || st.auto > 0;
    var menos = $('cjx-menos'), mais = $('cjx-mais');
    if (menos) menos.disabled = trava || APOSTAS.indexOf(st.aposta) <= 0;
    if (mais) mais.disabled = trava || APOSTAS.indexOf(st.aposta) >= APOSTAS.length - 1 || APOSTAS[APOSTAS.indexOf(st.aposta) + 1] > saldoVisivel();
    var gir = $('cjx-girar');
    if (gir) {
      gir.classList.toggle('cjx-girar-auto', st.auto > 0);
      gir.classList.toggle('cjx-girar-ocupado', st.girando && !st.auto);
    }
    var ac = $('cjx-autoconta'); if (ac) ac.textContent = st.auto > 0 ? st.auto : '';
    var t = $('cjx-turbo'); if (t) t.classList.toggle('on', st.turbo);
    var au = $('cjx-auto'); if (au) au.classList.toggle('on', st.auto > 0);
  }
  function ganhoBar(txt, classe) {
    var b = $('cjx-ganhobar'), t = $('cjx-ganhotxt'); if (!b || !t) return;
    b.className = 'cjx-ganhobar' + (classe ? ' ' + classe : '');
    t.innerHTML = txt;
  }
  // Conta de 0 até valor no elemento (ticks de som). Promise.
  function contar(el, valor, ms, prefixo) {
    return new Promise(function (ok) {
      if (!el) return ok();
      var ini = performance.now(), ult = -1;
      function passo(agora) {
        var p = Math.min(1, (agora - ini) / ms);
        var e = 1 - Math.pow(1 - p, 3);
        var v = Math.floor(valor * e);
        el.textContent = (prefixo || '') + fmt(v);
        var tick = Math.floor(p * 12);
        if (tick !== ult && p < 1) { ult = tick; som('nota', tick % 8); }
        if (p < 1) st.raf = requestAnimationFrame(passo);
        else { st.raf = 0; ok(); }
      }
      st.raf = requestAnimationFrame(passo);
      st.contarFim = function () { el.textContent = (prefixo || '') + fmt(valor); };
    });
  }

  /* ── Grande ganho / ovo ─────────────────────────────────────── */
  var big = { resolver: null, contando: false, final: 0 };
  function faixaDe(mult) { for (var i = 0; i < FAIXAS.length; i++) if (mult >= FAIXAS[i].min) return FAIXAS[i]; return null; }
  function chuvaMoedas() {
    var w = $('cjx-big-moedas'); if (!w) return;
    var h = '';
    var n = reduzido() ? 0 : 28;
    for (var i = 0; i < n; i++) {
      h += '<i style="left:' + (Math.random() * 96).toFixed(1) + '%;animation-delay:' + (Math.random() * 1.6).toFixed(2) + 's;animation-duration:' + (1.6 + Math.random() * 1.4).toFixed(2) + 's;--g:' + (Math.random() * 720 - 360).toFixed(0) + 'deg;width:' + (22 + Math.random() * 18).toFixed(0) + 'px"></i>';
    }
    w.innerHTML = h;
  }
  function bigAbrir(opts) {
    var ov = $('cjx-big'); if (!ov) return Promise.resolve();
    st.bigAberto = true;
    var tit = $('cjx-big-tit'), num = $('cjx-big-num'), it = $('cjx-big-item');
    tit.textContent = opts.titulo;
    tit.classList.remove('cjx-pulo'); void tit.offsetWidth; tit.classList.add('cjx-pulo');
    it.innerHTML = opts.itemHtml || '';
    num.textContent = opts.valor ? '0' : '';
    ov.classList.add('on');
    chuvaMoedas();
    corujaModo('festa');
    som('nivelUp'); vibrar([30, 40, 60]);
    return new Promise(function (ok) {
      big.resolver = ok; big.final = opts.valor || 0;
      if (opts.valor) {
        big.contando = true;
        var faixaAtual = opts.titulo;
        var ms = tempo(opts.duracao || 3000);
        var ini = performance.now();
        (function passo(agora) {
          var p = Math.min(1, (agora - ini) / ms);
          var v = Math.floor(opts.valor * (1 - Math.pow(1 - p, 2)));
          num.textContent = fmt(v);
          // o título "sobe de faixa" conforme o número cresce
          var f = faixaDe(v / st.aposta);
          if (opts.subirFaixa && f && f.txt !== faixaAtual) { faixaAtual = f.txt; tit.textContent = f.txt; tit.classList.remove('cjx-pulo'); void tit.offsetWidth; tit.classList.add('cjx-pulo'); som('bonus'); }
          if (Math.floor(p * 20) % 2 === 0 && p < 1) som('nota', Math.floor(p * 8));
          if (p < 1 && big.contando) { st.raf = requestAnimationFrame(passo); }
          else { big.contando = false; num.textContent = fmt(opts.valor); if (opts.subirFaixa && opts.tituloFinal) tit.textContent = opts.tituloFinal; som('fim', true); bigAutoFechar(); }
        })(ini);
      } else {
        big.contando = false;
        bigAutoFechar();
      }
    });
  }
  function bigAutoFechar() { if (st.auto > 0) later(bigFechar, tempo(1800)); }
  function bigFechar() {
    var ov = $('cjx-big'); if (ov) ov.classList.remove('on');
    var w = $('cjx-big-moedas'); if (w) w.innerHTML = '';
    st.bigAberto = false;
    corujaModo('parada');
    if (big.resolver) { var r = big.resolver; big.resolver = null; r(); }
  }
  function bigToque() {
    if (big.contando) { big.contando = false; return; }   // 1º toque: pula a contagem
    bigFechar();
  }

  /* ── Giro ───────────────────────────────────────────────────── */
  function aplicar(r) {
    var g = G(); if (!g) return;
    g.moedasAdd(-r.aposta, 'corujinha-aposta');
    if (r.ovo) {
      var cat = (g.lojaCatalogo ? g.lojaCatalogo() : []).filter(function (it) { return it.preco > 0; });
      var naoTem = cat.filter(function (it) { return !g.temItem(it.id); });
      var base = naoTem.length ? naoTem : cat;
      if (base.length) {
        r.item = base[Math.floor(Math.random() * base.length)];
        r.itemNovo = !g.temItem(r.item.id) && typeof g.ganharItem === 'function' && g.ganharItem(r.item.id) !== false;
        if (!r.itemNovo) r.ganho += Math.floor(r.item.preco * CONVERSAO_REPETIDO);
      }
    }
    if (r.ganho > 0) g.moedasAdd(r.ganho, 'corujinha-premio');
  }

  function girar() {
    if (!st.montado) return;
    if (st.bigAberto) { bigToque(); return; }
    if (st.auto > 0 && st.girando) { st.auto = 0; painel(); return; }   // toque no meio do auto = parar
    if (st.girando) return;
    fecharAutoMenu();
    var aposta = apostaValida();
    if (!aposta || saldoReal() < aposta) {
      st.auto = 0;
      ganhoBar('Saldo insuficiente — jogue um mini-jogo pra ganhar moedas', 'cjx-ganhobar-erro');
      som('erro'); balao('Sem moedas!', 1600);
      painel();
      return;
    }
    var r = CJM.sortear(aposta);       // resultado decidido AQUI
    st.pend = 0;
    aplicar(r);                        // aposta debitada + prêmio creditado já
    st.pend = r.ganho;                 // o saldo da tela só sobe no fim da animação
    st.girando = true;
    st.ultimoGanho = 0;
    if (st.auto > 0) st.auto--;
    limparDestaques();
    ganhoBar('Boa sorte!', '');
    painel();
    som('pulo');
    corujaModo('gira');
    var gir = $('cjx-girar'); if (gir) { gir.classList.remove('cjx-girar-roda'); void gir.offsetWidth; gir.classList.add('cjx-girar-roda'); }

    var p0 = r.passos[0];
    animarGiro(p0.g, null).then(function () {
      if (!r.voo) return;
      return vooAnimar(r);
    }).then(function () {
      return revelar(r);
    }).then(function () {
      st.girando = false;
      st.pend = 0;
      painel();
      if (st.auto > 0) later(girar, tempo(500));
    });
  }

  function vooAnimar(r) {
    var m = $('cjx-maquina'); if (m) m.classList.add('cjx-maquina-voo');
    ganhoBar('<img src="' + ASSETS + 'sim-' + r.voo + '.png" alt=""> VOO DA SORTE!', 'cjx-ganhobar-voo');
    balao('Voo da Sorte!', 1800);
    corujaModo('voo', 1600);
    som('mola'); vibrar(40);
    var i = 0;
    function travas(t) {
      for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) {
        var el = $('cjx-cel-' + a + b);
        if (el) el.classList.toggle('cjx-trava', !!t[a][b]);
      }
    }
    return esperar(tempo(1300)).then(function prox() {
      travas(r.passos[i].trava);
      som('acerto');
      i++;
      if (i >= r.passos.length) return esperar(tempo(350));
      return esperar(tempo(450)).then(function () {
        return animarGiro(r.passos[i].g, r.passos[i - 1].trava);
      }).then(prox);
    }).then(function () {
      if (m) m.classList.remove('cjx-maquina-voo');
      document.querySelectorAll('#cjx .cjx-cel').forEach(function (el) { el.classList.remove('cjx-trava'); });
    });
  }

  function revelar(r) {
    var gFinal = r.passos[r.passos.length - 1].g;
    var valorLinhas = r.ovo && !r.itemNovo && r.item ? r.ganho - Math.floor(r.item.preco * CONVERSAO_REPETIDO) : r.ganho;
    var p = Promise.resolve();
    if (r.linhas.length) {
      mostrarLinhas(r.linhas);
      corujaModo('festa', 1600);
      som(r.mult >= 3 ? 'bonus' : 'acerto');
      if (r.cheia) { balao('TELA CHEIA ×' + CJM.CHEIA_MULT + '!', 2200); vibrar([40, 60, 40]); }
    } else if (!r.ovo) {
      corujaModo('parada');
      // "quase": par numa linha
      var quase = CJM.LINHAS.some(function (L) {
        var a = gFinal[L[0][0]][L[0][1]], b = gFinal[L[1][0]][L[1][1]], c = gFinal[L[2][0]][L[2][1]];
        return a !== 'ovo' && (a === b || b === c) && a !== 'moeda';
      });
      ganhoBar(quase ? 'Quase! Mais um giro?' : 'Boa sorte!', '');
    }
    if (r.ovo) mostrarOvos(gFinal);

    var faixa = faixaDe(r.mult);
    if (valorLinhas > 0 && !faixa) {
      // ganho comum: conta na barra
      ganhoBar('Ganho <b id="cjx-ganhonum">0</b>', 'cjx-ganhobar-ganho' + (r.mult >= 3 ? ' cjx-ganhobar-forte' : ''));
      st.ultimoGanho = valorLinhas;
      p = p.then(function () { return contar($('cjx-ganhonum'), valorLinhas, tempo(r.mult >= 3 ? 1300 : 800)); });
    } else if (valorLinhas > 0 && faixa) {
      ganhoBar('Ganho <b>' + fmt(valorLinhas) + '</b>', 'cjx-ganhobar-ganho cjx-ganhobar-forte');
      st.ultimoGanho = valorLinhas;
      p = p.then(function () { return esperar(tempo(500)); }).then(function () {
        return bigAbrir({ titulo: FAIXAS[FAIXAS.length - 1].txt, valor: valorLinhas, subirFaixa: true, tituloFinal: (r.cheia ? 'TELA CHEIA!' : faixa.txt), duracao: 2400 + r.mult * 90 });
      });
    }
    if (r.ovo && r.item) {
      p = p.then(function () { return esperar(tempo(400)); }).then(function () {
        var conv = Math.floor(r.item.preco * CONVERSAO_REPETIDO);
        var prev = r.item.preview
          ? '<img src="' + esc(r.item.preview) + '" alt="" onerror="this.style.display=\'none\'">'
          : '<span class="cjx-big-item-ico">🎁</span>';
        var html = '<div class="cjx-big-item-card">' + prev + '<div><b>' + esc(r.item.nome) + '</b>' +
                   '<small>' + (r.itemNovo ? 'Novo no seu inventário! Equipe na Loja.' : 'Você já tinha — virou moedas') + '</small></div></div>';
        if (!r.itemNovo) st.ultimoGanho += conv;
        return bigAbrir({ titulo: 'OVO DOURADO!', itemHtml: html, valor: r.itemNovo ? 0 : conv, duracao: 1200 });
      });
    }
    return p.then(function () {
      if (r.ganho > 0 && !faixa && !r.ovo) return esperar(tempo(350));
    });
  }

  /* ── Controles ──────────────────────────────────────────────── */
  function mudarAposta(d) {
    if (st.girando || st.auto) return;
    var i = APOSTAS.indexOf(st.aposta) + d;
    if (i < 0 || i >= APOSTAS.length) return;
    if (APOSTAS[i] > saldoVisivel() && d > 0) { som('erro'); return; }
    st.aposta = APOSTAS[i];
    som('toque');
    painel();
  }
  function turbo() { st.turbo = !st.turbo; som('toque'); painel(); balao(st.turbo ? 'Turbo ligado!' : 'Turbo desligado', 1100); }
  function autoMenu() {
    if (st.auto > 0) { st.auto = 0; painel(); return; }
    var p = $('cjx-autopop'); if (p) p.classList.toggle('on');
    som('toque');
  }
  function fecharAutoMenu() { var p = $('cjx-autopop'); if (p) p.classList.remove('on'); }
  function autoIniciar(n) {
    fecharAutoMenu();
    st.auto = n;
    painel();
    if (!st.girando) girar();
  }
  function tabela(abrir) { var t = $('cjx-tabela'); if (t) t.classList.toggle('on', !!abrir); som('toque'); }
  function comecar() {
    var s = $('cjx-splash'); if (s) s.classList.add('cjx-sai');
    later(function () { if (s) s.classList.remove('on', 'cjx-sai'); }, 380);
    som('nivelUp');
    corujaModo('festa', 1200);
    balao('Boa sorte!', 1500);
  }
  function voltar() {
    if (typeof window._voltarAoMenu === 'function') window._voltarAoMenu();
    else if (G() && G().voltarAoMenu) G().voltarAoMenu();
  }

  /* ── API ────────────────────────────────────────────────────── */
  function preparar() {
    limparTimers();
    st.girando = false; st.auto = 0; st.pend = 0; st.bigAberto = false; st.ultimoGanho = 0;
    if (!criarDOM()) return;
    var g0 = [['coroa', 'igreja', 'livro'], ['estrela', 'coruja', 'estrela'], ['livro', 'milho', 'coroa']];
    desenharGrade(g0);
    apostaValida();
    painel();
    ganhoBar('Boa sorte!', '');
    var s = $('cjx-splash'); if (s) s.classList.add('on');
    corujaModo('parada');
  }
  function parar() {
    limparTimers();
    clearInterval(coruja.asaT); clearTimeout(coruja.piscaT);
    st.girando = false; st.auto = 0; st.pend = 0; st.bigAberto = false;
    big.resolver = null; big.contando = false;
  }

  window.CorujinhaGame = {
    preparar: preparar,
    parar: parar,
    _girar: girar, _aposta: mudarAposta, _turbo: turbo, _autoMenu: autoMenu, _autoIniciar: autoIniciar,
    _tabela: tabela, _comecar: comecar, _bigToque: bigToque, _voltar: voltar,
    _mat: CJM
  };
})();
