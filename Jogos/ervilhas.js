/* ═══════════════════════════════════════════════════════════════
   ERVILHAS DA CORUJA — minigame de Coruja Party (baseado no "Table
   Manners" do Machine Party), lazy-loaded a partir de /Jogos/ervilhas.js.
   ------------------------------------------------------------
   Mesmo contrato do Puff (ver Jogos/puff.js e o comentário no topo
   dele): render(container, opts) em vez de preparar/comecar/parar —
   este módulo não tem tela própria em index.html nem card no hub, só
   entra pela pool do Coruja Party (Jogos/party.js).

   v2 (tela cheia, no jeito do Table Manners):
   - Em cima, a sala de jantar com a Coruja-Chefe lendo jornal na
     cabeceira. Embaixo, a toalha, o prato de ervilhas e o garfo na asa
     do jogador (primeira pessoa).
   - Dois botões, como os dois cliques do original:
       ESPETAR  = põe uma ervilha no garfo (até GARFO_MAX);
       COMER    = engole tudo que está no garfo de uma vez.
     Encher o garfo rende mais por mordida, mas arrisca mais.
   - A Chefe alterna: lendo (seguro) → aviso (espia por cima do jornal,
     ainda seguro) → olhando (perigo) → lendo. Parte dos avisos é
     alarme falso (volta a ler). Ela fica mais desconfiada conforme o
     prato esvazia (lê menos tempo, olha por mais tempo, avisa mais rápido).
   - Se mexer (tocar, ou estar no meio de espetar/comer) com ela
     olhando = flagrado: as ervilhas do garfo voltam pro prato e o
     jogador fica travado um instante. Ficar parado nunca é perigoso.
   - Objetivo: esvaziar o prato antes do tempo. Pontos = ervilhas
     comidas × PONTOS_POR_SEMENTE + bônus de tempo se esvaziar.
   - Tela cheia: o .ev-root é position: fixed por cima do Party (o
     container continua o mesmo; se o Party esconder a tela, o fixed
     some junto porque o ancestral fica display:none).
   - v1 de sorteio local dos intervalos (sem mensagem extra) — ver o
     comentário no topo de party.js sobre o "seed" da rodada.
   - Sozinho no próprio aparelho — no fim, reporta só o score final
     pro Coruja Party (ver onFim).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Handle da rodada em andamento (setado por render(), consumido por
  // parar()). Sem isto, sair do Party no meio da rodada deixava a cadeia
  // da Chefe se reagendando pra sempre sobre um <div> já descartado, e o
  // timerRodada acabava reportando o placar da rodada abandonada como se
  // fosse da rodada atual (ver A2.2).
  var _pararAtual = null;

  var A = '/Jogos/assets/ervilhas/';
  var TOTAL_SEMENTES     = 20;   // ervilhas no prato
  var GARFO_MAX          = 5;    // quantas cabem no garfo
  var ESPETAR_MS         = 230;  // animação de espetar (uma ervilha)
  var COMER_MS           = 420;  // animação de levar o garfo à boca
  var ASSUSTADA_MS       = 1000; // travado depois de flagrado
  var PEGOU_MS           = 1100; // quanto tempo a Chefe fica apontando
  var LENDO_MIN = 1300, LENDO_MAX = 2700;   // seguro
  var AVISO_MIN = 450,  AVISO_MAX = 700;    // espiando (ainda seguro)
  var OLHANDO_MIN = 800, OLHANDO_MAX = 1400; // perigo
  var CHANCE_ALARME_FALSO = 0.3;
  var PONTOS_POR_SEMENTE = 100;
  var BONUS_TEMPO_DIVISOR = 500; // bônus só se esvaziar o prato: msRestantes / 500

  // Quadros do chefe-sheet.webp (grade 3×3, cabeça alinhada em todos):
  // 0 lendo · 1 virando a página · 2 ajeitando os óculos (aviso) ·
  // 3 espiando por cima do jornal (aviso) · 4 jornal no queixo (olhando) ·
  // 5 jornal na mesa, encarando (olhando) · 6 apontando "te peguei" ·
  // 7 braços cruzados, satisfeita · 8 bocejando (lendo, alarme falso visual)
  var Q = { LENDO: 0, PAGINA: 1, OCULOS: 2, ESPIA: 3, QUEIXO: 4, ENCARA: 5, PEGOU: 6, FIM: 7, BOCEJO: 8 };
  // asa-garfo-1/2/3.webp: parado (dentes pra cima) · espetando · levando
  // à boca. Âncora: canto inferior direito. tipX/tipY = ponta dos dentes
  // e tinesW = largura da cabeça do garfo, em px da própria imagem —
  // usados pra empilhar as ervilhas no garfo.
  var ASA = {
    1: { w: 251, h: 375, tipX: 40, tipY: 2, tinesW: 40 },
    2: { w: 341, h: 362 },
    3: { w: 289, h: 370, tipX: 88, tipY: 1, tinesW: 111 }
  };

  function render(container, opts) {
    if (!container) return;
    opts = opts || {};
    var duracaoSeg = Math.max(15, Number(opts.duracaoSeg) || 38);
    var onFim = typeof opts.onFim === 'function' ? opts.onFim : function () {};

    // Estado da rodada (recriado a cada render — cada rodada é um jogo novo).
    var noPrato = TOTAL_SEMENTES;   // ervilhas ainda no prato
    var noGarfo = 0;                // espetadas, ainda não comidas
    var comidas = 0;
    var movendo = null;             // null | 'espetar' | 'comer'
    var travada = false;
    var acabou = false;
    var chefe = 'lendo';            // lendo | aviso | olhando | pegou
    var tempoRestante = duracaoSeg;
    var timerMov = null, timerChefe = null, timerTravada = null, timerRodada = null, timerPagina = null;

    container.innerHTML =
      '<div class="ev-root" id="ev-root">' +
        '<div class="ev-sala" style="background-image:url(\'' + A + 'sala.webp\')">' +
          '<div class="ev-hud">' +
            '<button type="button" class="ev-sair" id="ev-sair" aria-label="Sair">✕</button>' +
            '<span class="ev-chip"><b id="ev-restantes">' + noPrato + '</b> no prato</span>' +
            '<span class="ev-chip ev-chip-tempo"><b id="ev-tempo">' + duracaoSeg + '</b>s</span>' +
          '</div>' +
          '<div class="ev-chefe-wrap">' +
            '<div class="ev-chefe" id="ev-chefe" style="background-image:url(\'' + A + 'chefe-sheet.webp\')"></div>' +
            '<img class="ev-mesa" src="' + A + 'mesa.webp" alt="" draggable="false">' +
          '</div>' +
          '<div class="ev-balao" id="ev-balao"></div>' +
        '</div>' +
        '<div class="ev-toalha" id="ev-toalha">' +
          '<img class="ev-guardanapo" src="' + A + 'guardanapo.webp" alt="" draggable="false">' +
          '<img class="ev-suco" src="' + A + 'suco.webp" alt="" draggable="false">' +
          '<div class="ev-prato" id="ev-prato"><img class="ev-prato-img" src="' + A + 'prato.webp" alt="" draggable="false"></div>' +
          '<div class="ev-asa" id="ev-asa">' +
            '<img class="ev-asa-img" id="ev-asa-img" src="' + A + 'asa-garfo-1.webp" alt="" draggable="false">' +
            '<div class="ev-garfo-ervilhas" id="ev-garfo-ervilhas"></div>' +
          '</div>' +
          '<div class="ev-garfo-cont" id="ev-garfo-cont">Garfo 0/' + GARFO_MAX + '</div>' +
          '<div class="ev-instrucao" id="ev-instrucao">Espete e coma só quando a Chefe estiver lendo.<br>Encheu o garfo? Mais ervilhas por mordida — e mais risco!</div>' +
        '</div>' +
        '<div class="ev-botoes">' +
          '<button type="button" class="ev-btn ev-btn-espetar" id="ev-btn-espetar">Espetar</button>' +
          '<button type="button" class="ev-btn ev-btn-comer" id="ev-btn-comer">Comer</button>' +
        '</div>' +
        '<div class="ev-flash" id="ev-flash"></div>' +
      '</div>';

    var $ = function (id) { return container.querySelector('#' + id); };
    var elRoot = $('ev-root'), elChefe = $('ev-chefe'), elBalao = $('ev-balao');
    var elRestantes = $('ev-restantes'), elTempo = $('ev-tempo');
    var elToalha = $('ev-toalha'), elPrato = $('ev-prato'), elAsa = $('ev-asa'), elAsaImg = $('ev-asa-img');
    var elGarfoErv = $('ev-garfo-ervilhas'), elGarfoCont = $('ev-garfo-cont'), elInstrucao = $('ev-instrucao');
    var elBtnEspetar = $('ev-btn-espetar'), elBtnComer = $('ev-btn-comer'), elFlash = $('ev-flash');

    // Pré-carrega as três poses da asa (a troca de src fica instantânea).
    [2, 3].forEach(function (k) { var im = new Image(); im.src = A + 'asa-garfo-' + k + '.webp'; });

    function _som(m, args) {
      var G = window.AngatubaGames;
      if (G && G.som && typeof G.som[m] === 'function') { try { G.som[m].apply(G.som, args || []); } catch (e) {} }
    }
    function _vibrar(padrao) {
      if (navigator.vibrate) { try { navigator.vibrate(padrao); } catch (e) {} }
    }
    function _quadroChefe(q) {
      if (elChefe) elChefe.style.backgroundPosition = ((q % 3) * 50) + '% ' + (Math.floor(q / 3) * 50) + '%';
    }
    function _balao(txt, ms) {
      if (!elBalao) return;
      if (!txt) { elBalao.classList.remove('on'); return; }
      elBalao.textContent = txt;
      elBalao.classList.remove('on'); void elBalao.offsetWidth; elBalao.classList.add('on');
      if (ms) setTimeout(function () { if (elBalao) elBalao.classList.remove('on'); }, ms);
    }

    // ── Prato: uma <img> de ervilha por unidade, espalhadas dentro do
    // círculo interno do prato. Espetar tira uma; flagra devolve. ──────
    var ervilhasPrato = [];
    function _posLivre() {
      // Sorteia uma posição no miolo do prato evitando encostar demais
      // nas ervilhas já postas (algumas tentativas; se não achar, aceita).
      var melhor = null;
      for (var t = 0; t < 14; t++) {
        var ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.27;
        var x = 0.5 + Math.cos(ang) * r, y = 0.5 + Math.sin(ang) * r;
        var ok = true;
        for (var i = 0; i < ervilhasPrato.length; i++) {
          var e = ervilhasPrato[i];
          if ((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) < 0.075 * 0.075) { ok = false; break; }
        }
        melhor = { x: x, y: y };
        if (ok) break;
      }
      return melhor;
    }
    function _addErvilhaPrato() {
      var p = _posLivre();
      var el = document.createElement('img');
      el.className = 'ev-ervilha';
      el.src = A + 'ervilha.webp';
      el.alt = ''; el.draggable = false;
      el.style.left = (p.x * 100) + '%';
      el.style.top = (p.y * 100) + '%';
      el.style.transform = 'translate(-50%,-50%) rotate(' + Math.round(Math.random() * 360) + 'deg)';
      elPrato.appendChild(el);
      ervilhasPrato.push({ x: p.x, y: p.y, el: el });
    }
    function _tirarErvilhaPrato() {
      var e = ervilhasPrato.pop();
      if (e && e.el && e.el.parentNode) e.el.parentNode.removeChild(e.el);
    }
    for (var i0 = 0; i0 < TOTAL_SEMENTES; i0++) _addErvilhaPrato();

    // ── Asa + garfo: pose (1 parado, 2 espetando, 3 comendo) e as
    // ervilhas empilhadas nos dentes. Tamanho da asa vem do CSS (altura
    // da .ev-asa); as larguras e a pilha seguem a proporção da imagem. ─
    var poseAsa = 1;
    function _escalaAsa() {
      var h = elAsa ? elAsa.clientHeight : 0;
      return h > 0 ? h / 375 : 0;
    }
    function _poseAsa(k) {
      poseAsa = k;
      var s = _escalaAsa();
      elAsaImg.src = A + 'asa-garfo-' + k + '.webp';
      elAsaImg.style.width = (ASA[k].w * s) + 'px';
      elAsaImg.style.height = (ASA[k].h * s) + 'px';
      _desenharGarfo();
    }
    function _desenharGarfo() {
      if (!elGarfoErv) return;
      var d = ASA[poseAsa];
      elGarfoErv.innerHTML = '';
      if (elGarfoCont) elGarfoCont.textContent = 'Garfo ' + noGarfo + '/' + GARFO_MAX;
      if (!noGarfo || !d.tinesW) return;
      var s = _escalaAsa();
      var img = d.w * s, imh = d.h * s;
      var tam = d.tinesW * s * 1.05;
      // Ponta dos dentes no sistema da .ev-asa: a imagem fica ancorada
      // no canto inferior direito dela.
      var asaW = elAsa.clientWidth, asaH = elAsa.clientHeight;
      var baseX = asaW - img + d.tipX * s, baseY = asaH - imh + d.tipY * s;
      for (var k = 0; k < noGarfo; k++) {
        var el = document.createElement('img');
        el.className = 'ev-ervilha ev-ervilha-garfo';
        el.src = A + 'ervilha.webp'; el.alt = ''; el.draggable = false;
        el.style.width = tam + 'px'; el.style.height = tam + 'px';
        el.style.left = (baseX - tam / 2 + ((k % 2) ? tam * 0.12 : -tam * 0.12)) + 'px';
        el.style.top = (baseY + tam * 0.15 + k * tam * 0.62) + 'px';
        elGarfoErv.appendChild(el);
      }
    }

    function _atualizarHud() {
      if (elRestantes) elRestantes.textContent = noPrato;
      if (elBtnEspetar) elBtnEspetar.disabled = acabou || noPrato <= 0 || noGarfo >= GARFO_MAX;
      if (elBtnComer) elBtnComer.disabled = acabou || noGarfo <= 0;
      _desenharGarfo();
    }

    // ── Coruja-Chefe ──────────────────────────────────────────────
    function _progresso() { return comidas / TOTAL_SEMENTES; }
    function _sorteio(min, max, fator) { return (min + Math.random() * (max - min)) * fator; }
    function _perigo() { return chefe === 'olhando' || chefe === 'pegou'; }

    function _agendarChefe(ms, fn) {
      if (timerChefe) clearTimeout(timerChefe);
      timerChefe = setTimeout(function () { timerChefe = null; if (!acabou) fn(); }, ms);
    }
    function _virarPagina() {
      // Enfeite enquanto lê: vira a página ou boceja de vez em quando.
      if (timerPagina) clearTimeout(timerPagina);
      timerPagina = setTimeout(function () {
        timerPagina = null;
        if (acabou || chefe !== 'lendo') return;
        var q = Math.random() < 0.25 ? Q.BOCEJO : Q.PAGINA;
        _quadroChefe(q);
        timerPagina = setTimeout(function () {
          timerPagina = null;
          if (!acabou && chefe === 'lendo') { _quadroChefe(Q.LENDO); _virarPagina(); }
        }, q === Q.BOCEJO ? 700 : 450);
      }, 700 + Math.random() * 1400);
    }
    function _lendo() {
      chefe = 'lendo';
      _quadroChefe(Q.LENDO);
      elRoot.classList.remove('ev-perigo', 'ev-alerta');
      _virarPagina();
      var p = _progresso();
      _agendarChefe(_sorteio(LENDO_MIN, LENDO_MAX, 1 - p * 0.35), _aviso);
    }
    function _aviso() {
      chefe = 'aviso';
      if (timerPagina) { clearTimeout(timerPagina); timerPagina = null; }
      _quadroChefe(Math.random() < 0.35 ? Q.OCULOS : Q.ESPIA);
      elRoot.classList.add('ev-alerta');
      _som('toque');
      var p = _progresso();
      var falso = Math.random() < CHANCE_ALARME_FALSO;
      _agendarChefe(_sorteio(AVISO_MIN, AVISO_MAX, 1 - p * 0.3), falso ? _lendo : _olhando);
    }
    function _olhando() {
      chefe = 'olhando';
      _quadroChefe(Math.random() < 0.5 ? Q.QUEIXO : Q.ENCARA);
      elRoot.classList.remove('ev-alerta');
      elRoot.classList.add('ev-perigo');
      // Pegou alguém no meio do movimento no instante em que olhou.
      if (movendo) { _flagrada(); return; }
      var p = _progresso();
      _agendarChefe(_sorteio(OLHANDO_MIN, OLHANDO_MAX, 1 + p * 0.4), _lendo);
    }

    // ── Ações ─────────────────────────────────────────────────────
    function _espetar() {
      if (acabou || travada || movendo) return;
      if (_perigo()) { _flagrada(); return; }
      if (noPrato <= 0 || noGarfo >= GARFO_MAX) return;
      if (elInstrucao) elInstrucao.style.display = 'none';
      movendo = 'espetar';
      _poseAsa(2);
      _som('toque');
      timerMov = setTimeout(function () {
        timerMov = null;
        if (movendo !== 'espetar') return;
        movendo = null;
        noPrato--; noGarfo++;
        _tirarErvilhaPrato();
        _poseAsa(1);
        _atualizarHud();
      }, ESPETAR_MS);
    }
    function _comer() {
      if (acabou || travada || movendo) return;
      if (_perigo()) { _flagrada(); return; }
      if (noGarfo <= 0) return;
      movendo = 'comer';
      _poseAsa(3);
      timerMov = setTimeout(function () {
        timerMov = null;
        if (movendo !== 'comer') return;
        movendo = null;
        comidas += noGarfo;
        var n = noGarfo;
        noGarfo = 0;
        _poseAsa(1);
        _atualizarHud();
        elAsa.classList.remove('ev-nham'); void elAsa.offsetWidth; elAsa.classList.add('ev-nham');
        _som(n >= 3 ? 'bonus' : 'acerto');
        _vibrar(n >= 3 ? [20, 30, 20] : 20);
        if (n >= GARFO_MAX) _balao('Garfada cheia! +' + n, 900);
        if (comidas >= TOTAL_SEMENTES) _finalizar();
      }, COMER_MS);
    }
    function _flagrada() {
      if (travada || acabou) return;
      if (timerMov) { clearTimeout(timerMov); timerMov = null; }
      movendo = null;
      travada = true;
      // As ervilhas do garfo voltam pro prato.
      var devolver = noGarfo;
      noGarfo = 0;
      noPrato += devolver;
      for (var i = 0; i < devolver; i++) _addErvilhaPrato();
      _poseAsa(1);
      _atualizarHud();
      // A Chefe aponta e dá bronca; depois volta a ler.
      chefe = 'pegou';
      if (timerPagina) { clearTimeout(timerPagina); timerPagina = null; }
      _quadroChefe(Q.PEGOU);
      _balao(devolver ? 'Te peguei! Devolve essas ervilhas!' : 'Te peguei!', 1100);
      elRoot.classList.remove('ev-sacode'); void elRoot.offsetWidth; elRoot.classList.add('ev-sacode');
      if (elFlash) { elFlash.classList.remove('on'); void elFlash.offsetWidth; elFlash.classList.add('on'); }
      _som('dano');
      _vibrar([50, 70, 50]);
      _agendarChefe(PEGOU_MS, _lendo);
      timerTravada = setTimeout(function () { timerTravada = null; travada = false; _atualizarHud(); }, ASSUSTADA_MS);
    }

    function _toque(fn) { return function (ev) { if (ev) ev.preventDefault(); fn(); }; }
    var _aoEspetar = _toque(_espetar), _aoComer = _toque(_comer);
    // Tela cheia cobre o "Voltar" do Party: este ✕ faz o mesmo caminho.
    var elSair = $('ev-sair');
    if (elSair) elSair.addEventListener('click', function () {
      if (typeof window._voltarAoMenu === 'function') window._voltarAoMenu();
    });
    elBtnEspetar.addEventListener('pointerdown', _aoEspetar);
    elBtnComer.addEventListener('pointerdown', _aoComer);
    // Teclado (desktop): ← / A espetar, → / D / espaço comer.
    function _aoTecla(ev) {
      if (acabou) return;
      var k = ev.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { ev.preventDefault(); _espetar(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === ' ') { ev.preventDefault(); _comer(); }
    }
    document.addEventListener('keydown', _aoTecla);
    // Tamanho da asa depende da altura da tela: refaz em resize/rotação.
    function _aoResize() { _poseAsa(poseAsa); }
    window.addEventListener('resize', _aoResize);

    // ── Relógio da rodada ─────────────────────────────────────────
    function _ligarRelogioRodada() {
      timerRodada = setInterval(function () {
        tempoRestante--;
        if (elTempo) elTempo.textContent = Math.max(0, tempoRestante);
        if (tempoRestante <= 5 && elRoot) elRoot.classList.add('ev-fim-perto');
        if (tempoRestante <= 0) _finalizar();
      }, 1000);
    }
    _ligarRelogioRodada();

    // Fix A2.11: sem isto, o relógio da rodada seguia contando em segundo
    // plano e a rodada terminava (reportando o placar) sem o jogador ver.
    // Pausa enquanto oculto e retoma de onde parou ao voltar.
    function _aoVisibilidade() {
      if (acabou) return;
      if (document.hidden) {
        if (timerRodada) { clearInterval(timerRodada); timerRodada = null; }
      } else if (!timerRodada) {
        _ligarRelogioRodada();
      }
    }
    document.addEventListener('visibilitychange', _aoVisibilidade);

    function _limpar() {
      if (timerRodada) { clearInterval(timerRodada); timerRodada = null; }
      if (timerChefe) { clearTimeout(timerChefe); timerChefe = null; }
      if (timerPagina) { clearTimeout(timerPagina); timerPagina = null; }
      if (timerMov) { clearTimeout(timerMov); timerMov = null; }
      if (timerTravada) { clearTimeout(timerTravada); timerTravada = null; }
      document.removeEventListener('visibilitychange', _aoVisibilidade);
      document.removeEventListener('keydown', _aoTecla);
      window.removeEventListener('resize', _aoResize);
      elBtnEspetar.removeEventListener('pointerdown', _aoEspetar);
      elBtnComer.removeEventListener('pointerdown', _aoComer);
      if (_pararAtual === _pararExterno) _pararAtual = null;
    }

    function _finalizar() {
      if (acabou) return;
      acabou = true;
      _limpar();
      var esvaziou = comidas >= TOTAL_SEMENTES;
      var bonusTempo = esvaziou ? Math.round((Math.max(0, tempoRestante) * 1000) / BONUS_TEMPO_DIVISOR) : 0;
      var score = comidas * PONTOS_POR_SEMENTE + bonusTempo;
      _quadroChefe(esvaziou ? Q.FIM : Q.ENCARA);
      elRoot.classList.remove('ev-perigo', 'ev-alerta');
      _balao(esvaziou ? 'Prato limpo! Muito bem.' : 'Acabou o tempo!', 0);
      _atualizarHud();
      _som('fim', [esvaziou]);
      onFim(score);
    }

    // Chamado de fora (party.js) quando a rodada é abandonada antes do
    // tempo — não reporta placar nenhum, só limpa (ver A2.2). Sem isto a
    // cadeia da Chefe ficaria se reagendando pra sempre (acabou nunca
    // vira true) mesmo depois de sair da rodada.
    function _pararExterno() {
      if (acabou) return;
      acabou = true;
      _limpar();
    }
    _pararAtual = _pararExterno;

    _poseAsa(1);
    _atualizarHud();
    _lendo();
  }

  function parar() {
    if (_pararAtual) _pararAtual();
  }

  window.ErvilhasGame = { render: render, parar: parar };
})();
