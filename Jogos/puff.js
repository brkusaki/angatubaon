/* ═══════════════════════════════════════════════════════════════
   PUFF DA CORUJA — minigame de Coruja Party (baseado no "Smoke
   Break" do Machine Party), lazy-loaded a partir de /Jogos/puff.js.
   ------------------------------------------------------------
   Diferente dos jogos solo (speedtap/sequencia/piano), este módulo
   NÃO tem uma tela própria em index.html: ele é sempre chamado de
   dentro de uma rodada do Coruja Party, que passa um <div> vazio e
   espera receber de volta o resultado no fim. Por isso o contrato é
   render(container, opts) em vez de preparar/comecar/parar — ver
   window.PuffGame no fim do arquivo e o adaptador "container" em
   Jogos/party.js (_iniciarJogoContainer).

   Mecânica:
   - Segura a tela pra Coruja encher o peito ("puff"). Soltar dentro
     da janela de tempo válida = 1 puff + barra de fôlego sobe.
   - Soltar tarde demais (passou do limite) = tosse: a Coruja fica
     atordoada por um tempinho e não dá pra puffar de novo até passar.
   - Objetivo: o maior número de puffs válidos no tempo do round.
   - Sozinho no próprio aparelho — no fim, reporta só o total pro
     Coruja Party (ver onFim). Também funciona fora de uma Party (ver
     window.PuffGame.jogarSolo), caso o hub ganhe um card próprio depois.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Handle da rodada em andamento (setado por render(), consumido por
  // parar()). Sem isto, sair do Party no meio da rodada deixava
  // timerRodada correndo sobre um <div> já descartado — 30s depois ele
  // chamava onFim() e reportava o placar da rodada abandonada como se
  // fosse da rodada atual (ver A2.2).
  var _pararAtual = null;

  var PUFF_MIN_MS       = 180;   // hold mais curto que isso não conta (evita "spam de toque")
  var PUFF_LIMITE_INICIAL = 2200; // ms — a partir daqui, tosse (começa mais fácil...)
  var PUFF_LIMITE_MINIMO  = 1300; // ms — ...e vai apertando conforme acerta (mais difícil)
  var PUFF_LIMITE_PASSO   = 70;   // ms de redução no limite a cada puff válido
  var TOSSE_DURACAO_MS    = 1700; // atordoada, não dá pra puffar
  var BARRA_META          = 16;   // puffs válidos pra encher a barra de fôlego uma vez
  // Sprite 3×3 da Corujinha (estilo da Master Reference). Nome novo
  // (-v2) de propósito: /Jogos/assets/ é cache-first no CACHE_JOGOS.
  // Quadros: 0 parada · 1 começando a inspirar · 2 meio cheia · 3 cheia ·
  // 4 no limite (vermelha, olhos marejados — aviso pra soltar) ·
  // 5 soltando o ar · 6/7 tosse · 8 tonta.
  var PUFF_SHEET          = '/Jogos/assets/puff/puff-sheet-v2.webp';
  var Q_SOLTA = 5, Q_TOSSE_A = 6, Q_TOSSE_B = 7, Q_TONTA = 8;
  var SOLTA_MS            = 380;  // quanto tempo a pose de "soltar o ar" fica
  var TOSSE_TROCA_MS      = 180;  // alternância entre as duas poses de tosse
  var TOSSE_ATE_TONTA_MS  = 1000; // depois disso, fica tonta até o fim da TOSSE_DURACAO_MS

  function render(container, opts) {
    if (!container) return;
    opts = opts || {};
    var duracaoSeg = Math.max(10, Number(opts.duracaoSeg) || 28);
    var onFim = typeof opts.onFim === 'function' ? opts.onFim : function () {};

    // Estado da rodada (recriado a cada render — cada rodada é um jogo novo).
    var puffs = 0;
    var limiteAtual = PUFF_LIMITE_INICIAL;
    var segurando = false;
    var tAppertouEm = 0;
    var atordoada = false;
    var acabou = false;
    var timerHold = null;      // dispara a tosse se ainda estiver segurando ao passar do limite
    var timerAtordoada = null;
    var timerRodada = null;
    var tempoRestante = duracaoSeg;

    container.innerHTML =
      '<div class="pf-card">' +
        '<div class="pf-hud">' +
          '<div class="pf-hud-item"><span class="pf-hud-label">Puffs</span><span class="pf-hud-valor" id="pf-puffs">0</span></div>' +
          '<div class="pf-hud-item"><span class="pf-hud-label">Tempo</span><span class="pf-hud-valor" id="pf-tempo">' + duracaoSeg + '</span></div>' +
        '</div>' +
        '<div class="pf-barra-wrap"><div class="pf-barra" id="pf-barra"></div></div>' +
        '<div class="pf-arena" id="pf-arena">' +
          '<div class="pf-owl-wrap" id="pf-owl-wrap">' +
            '<span class="pf-owl-emoji" id="pf-owl-emoji">🦉</span>' +
            // Sprite por cima do emoji (o emoji só aparece se o sheet não carregar).
            '<div class="pf-owl-sprite" id="pf-owl-sprite" style="background-image:url(\'' + PUFF_SHEET + '\')"></div>' +
          '</div>' +
          '<div class="pf-instrucao" id="pf-instrucao">Segure e solte no tempo certo!</div>' +
          '<div class="pf-aviso-tosse" id="pf-aviso-tosse">Segurou demais! 🤧</div>' +
        '</div>' +
      '</div>';

    var elPuffs   = container.querySelector('#pf-puffs');
    var elTempo   = container.querySelector('#pf-tempo');
    var elBarra   = container.querySelector('#pf-barra');
    var elOwlWrap = container.querySelector('#pf-owl-wrap');
    var elSprite  = container.querySelector('#pf-owl-sprite');
    var rafHold = 0, timerPose = null, timerTosseAnim = null;
    var elAvisoTosse = container.querySelector('#pf-aviso-tosse');
    var elInstrucao  = container.querySelector('#pf-instrucao');

    // Com o sheet carregado some o emoji (senão ele aparece pelas partes
    // transparentes do sprite); sem o sheet (offline sem cache, 404), fica só o emoji.
    (function () {
      var pre = new Image();
      pre.onload = function () { var em = container.querySelector('#pf-owl-emoji'); if (em) em.style.display = 'none'; };
      pre.onerror = function () { if (elSprite) elSprite.style.display = 'none'; };
      pre.src = PUFF_SHEET;
    })();

    function _quadro(q) {
      if (elSprite) elSprite.style.backgroundPosition = ((q % 3) * 50) + '% ' + (Math.floor(q / 3) * 50) + '%';
    }
    function _pararPoses() {
      if (rafHold) { cancelAnimationFrame(rafHold); rafHold = 0; }
      if (timerPose) { clearTimeout(timerPose); timerPose = null; }
      if (timerTosseAnim) { clearInterval(timerTosseAnim); timerTosseAnim = null; }
    }
    // Enquanto segura, a pose acompanha o quanto já passou do limite:
    // o último quadro (vermelha, olhos marejados) é o aviso de "solta já".
    function _animHold() {
      rafHold = 0;
      if (!segurando) return;
      var p = (Date.now() - tAppertouEm) / limiteAtual;
      _quadro(p < 0.25 ? 1 : p < 0.5 ? 2 : p < 0.78 ? 3 : 4);
      rafHold = requestAnimationFrame(_animHold);
    }

    function _som(m, args) {
      var G = window.AngatubaGames;
      if (G && G.som && typeof G.som[m] === 'function') { try { G.som[m].apply(G.som, args || []); } catch (e) {} }
    }
    function _vibrar(padrao) {
      if (navigator.vibrate) { try { navigator.vibrate(padrao); } catch (e) {} }
    }

    function _atualizarBarra() {
      var pct = ((puffs % BARRA_META) / BARRA_META) * 100;
      if (puffs > 0 && puffs % BARRA_META === 0) pct = 100;
      elBarra.style.width = pct + '%';
    }

    function _iniciarHold() {
      if (acabou || atordoada || segurando) return;
      segurando = true;
      tAppertouEm = Date.now();
      elOwlWrap.classList.add('pf-inflando');
      elOwlWrap.style.setProperty('--pf-dur', limiteAtual + 'ms');
      _pararPoses();
      _animHold();
      if (elInstrucao) elInstrucao.style.display = 'none';
      _som('toque');
      _som('precarregar', [['puff-estoura']]);
      // Se o jogador continuar segurando além do limite, a tosse dispara sozinha.
      timerHold = setTimeout(function () { if (segurando) _tosse(); }, limiteAtual);
    }

    function _soltarHold() {
      if (!segurando) return;
      segurando = false;
      var duracao = Date.now() - tAppertouEm;
      elOwlWrap.classList.remove('pf-inflando');
      if (timerHold) { clearTimeout(timerHold); timerHold = null; }
      if (acabou || atordoada) return;

      if (duracao < PUFF_MIN_MS) {
        // Muito rápido — nem chegou a ser um puff. Sem penalidade, só não conta.
        _pararPoses();
        _quadro(0);
        return;
      }
      if (duracao > limiteAtual) {
        _tosse();
        return;
      }
      _puffValido();
    }

    function _puffValido() {
      puffs++;
      limiteAtual = Math.max(PUFF_LIMITE_MINIMO, limiteAtual - PUFF_LIMITE_PASSO);
      if (elPuffs) elPuffs.textContent = puffs;
      _atualizarBarra();
      elOwlWrap.classList.remove('pf-pop'); void elOwlWrap.offsetWidth; elOwlWrap.classList.add('pf-pop');
      _pararPoses();
      _quadro(Q_SOLTA);
      timerPose = setTimeout(function () { timerPose = null; if (!segurando && !atordoada) _quadro(0); }, SOLTA_MS);
      _som('acerto');
      _vibrar(20);
    }

    function _tosse() {
      if (atordoada) return;
      segurando = false;
      atordoada = true;
      if (timerHold) { clearTimeout(timerHold); timerHold = null; }
      elOwlWrap.classList.remove('pf-inflando');
      elOwlWrap.classList.add('pf-tossindo');
      // Tosse animada (alterna as duas poses) e depois fica tonta até
      // acabar o atordoamento.
      _pararPoses();
      var tq = Q_TOSSE_A, tIni = Date.now();
      _quadro(tq);
      timerTosseAnim = setInterval(function () {
        if (Date.now() - tIni >= TOSSE_ATE_TONTA_MS) {
          clearInterval(timerTosseAnim); timerTosseAnim = null;
          _quadro(Q_TONTA);
          return;
        }
        tq = tq === Q_TOSSE_A ? Q_TOSSE_B : Q_TOSSE_A;
        _quadro(tq);
      }, TOSSE_TROCA_MS);
      if (elAvisoTosse) { elAvisoTosse.style.display = 'block'; elAvisoTosse.classList.remove('pf-aviso-anim'); void elAvisoTosse.offsetWidth; elAvisoTosse.classList.add('pf-aviso-anim'); }
      _som('tocar', ['puff-estoura', 'dano', 0.7]);   // encheu demais: estouro gravado (reserva: dano)
      _vibrar([40, 60, 40]);
      timerAtordoada = setTimeout(function () {
        atordoada = false;
        elOwlWrap.classList.remove('pf-tossindo');
        _pararPoses();
        _quadro(0);
        if (elAvisoTosse) elAvisoTosse.style.display = 'none';
      }, TOSSE_DURACAO_MS);
    }

    function _aoPointerDown(ev) {
      ev.preventDefault();
      // Fix A2.14: sem isto, dava pra segurar sobre a coruja e arrastar o
      // dedo pra fora — o pointerleave soltava normalmente e pontuava por
      // um caminho que não é o do jogo. Com o ponteiro capturado, ele
      // continua "dentro" do elemento (pointerup ainda dispara aqui) até
      // soltar de verdade.
      try { elOwlWrap.setPointerCapture(ev.pointerId); } catch (e) {}
      _iniciarHold();
    }
    function _aoPointerUp(ev) { ev.preventDefault(); _soltarHold(); }
    // pointerleave com ponteiro capturado só acontece em cancelamentos de
    // verdade (ex.: o sistema tomou o gesto) — trata como desistência, sem
    // pontuar.
    function _aoPointerCancelar(ev) {
      if (!segurando) return;
      segurando = false;
      elOwlWrap.classList.remove('pf-inflando');
      if (timerHold) { clearTimeout(timerHold); timerHold = null; }
      _pararPoses();
      _quadro(0);
    }

    elOwlWrap.addEventListener('pointerdown', _aoPointerDown);
    elOwlWrap.addEventListener('pointerup', _aoPointerUp);
    elOwlWrap.addEventListener('pointercancel', _aoPointerCancelar);
    elOwlWrap.addEventListener('pointerleave', _aoPointerCancelar);

    function _ligarRelogioRodada() {
      timerRodada = setInterval(function () {
        tempoRestante--;
        if (elTempo) elTempo.textContent = Math.max(0, tempoRestante);
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
      if (timerHold) { clearTimeout(timerHold); timerHold = null; }
      if (timerAtordoada) { clearTimeout(timerAtordoada); timerAtordoada = null; }
      document.removeEventListener('visibilitychange', _aoVisibilidade);
      _pararPoses();
      elOwlWrap.removeEventListener('pointerdown', _aoPointerDown);
      elOwlWrap.removeEventListener('pointerup', _aoPointerUp);
      elOwlWrap.removeEventListener('pointercancel', _aoPointerCancelar);
      elOwlWrap.removeEventListener('pointerleave', _aoPointerCancelar);
      if (_pararAtual === _pararExterno) _pararAtual = null;
    }

    function _finalizar() {
      if (acabou) return;
      acabou = true;
      _limpar();
      _som('fim', [puffs >= BARRA_META]);
      onFim(puffs);
    }

    // Chamado de fora (party.js) quando a rodada é abandonada antes do
    // tempo — não reporta placar nenhum, só limpa (ver A2.2).
    function _pararExterno() {
      if (acabou) return;
      acabou = true;
      _limpar();
    }
    _pararAtual = _pararExterno;
  }

  function parar() {
    if (_pararAtual) _pararAtual();
  }

  window.PuffGame = { render: render, parar: parar };
})();
