/* ═══════════════════════════════════════════════════════════════
   ERVILHAS DA CORUJA — minigame de Coruja Party (baseado no "Table
   Manners" do Machine Party), lazy-loaded a partir de /Jogos/ervilhas.js.
   ------------------------------------------------------------
   Mesmo contrato do Puff (ver Jogos/puff.js e o comentário no topo
   dele): render(container, opts) em vez de preparar/comecar/parar —
   este módulo não tem tela própria em index.html nem card no hub, só
   entra pela pool do Coruja Party (Jogos/party.js).

   Mecânica (Red Light / Green Light):
   - Toque 1 = espeta uma semente com o bico (animação curta).
   - Toque 2 = engole a semente espetada (outra animação curta).
   - De tempos em tempos o "Olhão da Coruja-Chefe" abre. Se o toque
     começar OU a animação de espetar/engolir estiver rolando quando
     o olho abrir, o jogador é flagrado: perde a semente em andamento
     (não desconta do prato, só não conta) e fica "assustado" por um
     instante sem poder agir. Ficar parado (esperando ou segurando a
     semente já espetada) nunca é perigoso — só o movimento é.
   - Objetivo: esvaziar o prato o mais rápido possível.
   - v1: cada aparelho sorteia os intervalos do olho localmente (sem
     mensagem extra) — ver o comentário no topo de party.js sobre o
     "seed" da rodada, que fica disponível pra sincronizar isso depois
     se um dia valer a pena.
   - Sozinho no próprio aparelho — no fim, reporta só o score final
     pro Coruja Party (ver onFim).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TOTAL_SEMENTES     = 14;   // sementes no prato (sugestão do pedido: 12-15)
  var ESPETAR_MS         = 380;  // duração da animação de espetar
  var ENGOLIR_MS         = 380;  // duração da animação de engolir
  var ASSUSTADA_MS       = 800;  // travado depois de flagrado
  var OLHO_FECHADO_MIN   = 1500; // ms — faixa inicial de "olho fechado" (seguro)
  var OLHO_FECHADO_MAX   = 2900;
  var OLHO_ABERTO_MIN    = 700;  // ms — faixa inicial de "olho aberto" (perigo)
  var OLHO_ABERTO_MAX    = 1300;
  var PONTOS_POR_SEMENTE = 100;
  var BONUS_TEMPO_DIVISOR = 500; // bônus de velocidade só se esvaziar o prato: tempoRestanteMs / 500

  function render(container, opts) {
    if (!container) return;
    opts = opts || {};
    var duracaoSeg = Math.max(15, Number(opts.duracaoSeg) || 38);
    var duracaoMs = duracaoSeg * 1000;
    var onFim = typeof opts.onFim === 'function' ? opts.onFim : function () {};

    // Estado da rodada (recriado a cada render — cada rodada é um jogo novo).
    var sementesRestantes = TOTAL_SEMENTES;
    var estado = 'esperando'; // esperando | espetando | segurando | engolindo | assustada
    var olhoAberto = false;
    var acabou = false;
    var inicioEm = Date.now();
    var timerAnimacao = null;
    var timerOlho = null;
    var timerAssustada = null;
    var timerRodada = null;
    var tempoRestante = duracaoSeg;

    container.innerHTML =
      '<div class="ev-card">' +
        '<div class="ev-hud">' +
          '<div class="ev-hud-item"><span class="ev-hud-label">Sementes</span><span class="ev-hud-valor" id="ev-restantes">' + sementesRestantes + '</span></div>' +
          '<div class="ev-hud-item"><span class="ev-hud-label">Tempo</span><span class="ev-hud-valor" id="ev-tempo">' + duracaoSeg + '</span></div>' +
        '</div>' +
        '<div class="ev-arena" id="ev-arena">' +
          '<div class="ev-olho-wrap" id="ev-olho-wrap">' +
            '<span class="ev-olho-emoji" id="ev-olho-emoji">😌</span>' +
            '<img class="ev-olho-img" id="ev-olho-img" src="/Jogos/assets/ervilhas/olho-fechado.webp" alt="" draggable="false">' +
            '<div class="ev-olho-label">Olhão da Coruja-Chefe</div>' +
          '</div>' +
          '<div class="ev-prato" id="ev-prato"></div>' +
          '<div class="ev-owl-wrap" id="ev-owl-wrap">' +
            '<span class="ev-owl-emoji">🦉</span>' +
            '<img class="ev-owl-img" id="ev-owl-img" src="/Jogos/assets/ervilhas/coruja-bico.webp" alt="" draggable="false">' +
          '</div>' +
          '<div class="ev-instrucao" id="ev-instrucao">Toque pra espetar, toque de novo pra engolir. Nunca se mexa com o olho aberto!</div>' +
          '<div class="ev-aviso-flagra" id="ev-aviso-flagra">Flagrado! 😱</div>' +
        '</div>' +
      '</div>';

    var elRestantes  = container.querySelector('#ev-restantes');
    var elTempo      = container.querySelector('#ev-tempo');
    var elArena       = container.querySelector('#ev-arena');
    var elOlhoWrap    = container.querySelector('#ev-olho-wrap');
    var elOlhoEmoji   = container.querySelector('#ev-olho-emoji');
    var elOlhoImg     = container.querySelector('#ev-olho-img');
    var elPrato       = container.querySelector('#ev-prato');
    var elOwlWrap     = container.querySelector('#ev-owl-wrap');
    var elOwlImg      = container.querySelector('#ev-owl-img');
    var elInstrucao   = container.querySelector('#ev-instrucao');
    var elAvisoFlagra = container.querySelector('#ev-aviso-flagra');

    elOlhoImg.onerror = function () { this.style.visibility = 'hidden'; };
    elOwlImg.onerror = function () { this.style.visibility = 'hidden'; };

    function _som(m, args) {
      var G = window.AngatubaGames;
      if (G && G.som && typeof G.som[m] === 'function') { try { G.som[m].apply(G.som, args || []); } catch (e) {} }
    }
    function _vibrar(padrao) {
      if (navigator.vibrate) { try { navigator.vibrate(padrao); } catch (e) {} }
    }

    // ── Prato: uma "semente" (div) por unidade restante ────────────
    var sementesEls = [];
    (function _montarPrato() {
      for (var i = 0; i < TOTAL_SEMENTES; i++) {
        var s = document.createElement('div');
        s.className = 'ev-semente';
        elPrato.appendChild(s);
        sementesEls.push(s);
      }
    })();
    function _removerUmaSemente() {
      // Some com a última semente "viva" da lista (visual só — a
      // contagem de verdade é sementesRestantes).
      for (var i = sementesEls.length - 1; i >= 0; i--) {
        if (!sementesEls[i]._comida) {
          sementesEls[i]._comida = true;
          sementesEls[i].classList.add('ev-semente-comida');
          break;
        }
      }
    }

    // ── Progresso (0..1) — usado pra apertar as faixas do olho aos
    // poucos, deixando o fim do prato mais tenso. ───────────────────
    function _progresso() { return 1 - (sementesRestantes / TOTAL_SEMENTES); }
    function _faixaAtual(min, max, aperto, cresce) {
      // cresce=true (olho aberto): a faixa AUMENTA com o progresso —
      // fica perigoso por mais tempo conforme o prato esvazia.
      // cresce=false (olho fechado): a faixa ENCOLHE com o progresso —
      // a folga segura fica mais curta conforme o prato esvazia.
      var fator = cresce ? (1 + aperto * 0.4) : (1 - aperto * 0.35);
      var faixaMin = Math.max(280, min * fator);
      var faixaMax = Math.max(faixaMin + 150, max * fator);
      return faixaMin + Math.random() * (faixaMax - faixaMin);
    }

    // ── Olhão da Coruja-Chefe: alterna aberto/fechado sozinho ──────
    function _agendarOlho() {
      if (acabou) return;
      var aperto = _progresso(); // 0 no início, 1 quando o prato tá quase vazio
      var espera = olhoAberto
        ? _faixaAtual(OLHO_ABERTO_MIN, OLHO_ABERTO_MAX, aperto, true)
        : _faixaAtual(OLHO_FECHADO_MIN, OLHO_FECHADO_MAX, aperto, false);
      timerOlho = setTimeout(function () {
        _alternarOlho();
        _agendarOlho();
      }, espera);
    }
    function _alternarOlho() {
      olhoAberto = !olhoAberto;
      if (elOlhoWrap) elOlhoWrap.classList.toggle('ev-olho-aberto', olhoAberto);
      if (elOlhoEmoji) elOlhoEmoji.textContent = olhoAberto ? '👁️' : '😌';
      if (elOlhoImg) elOlhoImg.src = olhoAberto
        ? '/Jogos/assets/ervilhas/olho-aberto.webp'
        : '/Jogos/assets/ervilhas/olho-fechado.webp';
      if (olhoAberto) {
        _som('toque');
        // Pegou alguém se mexendo no exato momento em que o olho abriu.
        if (estado === 'espetando' || estado === 'engolindo') _flagrada();
      }
    }

    // ── Interação: toque 1 espeta, toque 2 engole ──────────────────
    function _aoTocar(ev) {
      if (ev) ev.preventDefault();
      if (acabou || estado === 'assustada') return;

      if (estado === 'esperando') {
        if (olhoAberto) { _flagrada(); return; }
        estado = 'espetando';
        elOwlWrap.classList.add('ev-bicando');
        if (elInstrucao) elInstrucao.style.display = 'none';
        _som('toque');
        timerAnimacao = setTimeout(function () {
          if (estado !== 'espetando') return; // já foi flagrado nesse meio tempo
          estado = 'segurando';
          elOwlWrap.classList.remove('ev-bicando');
          elOwlWrap.classList.add('ev-segurando-semente');
        }, ESPETAR_MS);
        return;
      }

      if (estado === 'segurando') {
        if (olhoAberto) { _flagrada(); return; }
        estado = 'engolindo';
        elOwlWrap.classList.remove('ev-segurando-semente');
        elOwlWrap.classList.add('ev-engolindo');
        timerAnimacao = setTimeout(function () {
          if (estado !== 'engolindo') return; // já foi flagrado nesse meio tempo
          _semenComida();
        }, ENGOLIR_MS);
        return;
      }
      // estado === 'espetando' ou 'engolindo': ignora toque extra (já em movimento).
    }

    function _semenComida() {
      estado = 'esperando';
      elOwlWrap.classList.remove('ev-engolindo');
      sementesRestantes = Math.max(0, sementesRestantes - 1);
      if (elRestantes) elRestantes.textContent = sementesRestantes;
      _removerUmaSemente();
      elOwlWrap.classList.remove('ev-pop'); void elOwlWrap.offsetWidth; elOwlWrap.classList.add('ev-pop');
      _som('acerto');
      _vibrar(20);
      if (sementesRestantes <= 0) { _finalizar(); return; }
    }

    function _flagrada() {
      if (estado === 'assustada') return;
      if (timerAnimacao) { clearTimeout(timerAnimacao); timerAnimacao = null; }
      estado = 'assustada';
      elOwlWrap.classList.remove('ev-bicando', 'ev-segurando-semente', 'ev-engolindo');
      elOwlWrap.classList.add('ev-flagrado');
      if (elAvisoFlagra) { elAvisoFlagra.style.display = 'block'; elAvisoFlagra.classList.remove('ev-aviso-anim'); void elAvisoFlagra.offsetWidth; elAvisoFlagra.classList.add('ev-aviso-anim'); }
      _som('dano');
      _vibrar([50, 70, 50]);
      timerAssustada = setTimeout(function () {
        estado = 'esperando';
        elOwlWrap.classList.remove('ev-flagrado');
        if (elAvisoFlagra) elAvisoFlagra.style.display = 'none';
      }, ASSUSTADA_MS);
    }

    elArena.addEventListener('pointerdown', _aoTocar);

    timerRodada = setInterval(function () {
      tempoRestante--;
      if (elTempo) elTempo.textContent = Math.max(0, tempoRestante);
      if (tempoRestante <= 0) _finalizar();
    }, 1000);

    function _finalizar() {
      if (acabou) return;
      acabou = true;
      if (timerRodada) { clearInterval(timerRodada); timerRodada = null; }
      if (timerOlho) { clearTimeout(timerOlho); timerOlho = null; }
      if (timerAnimacao) { clearTimeout(timerAnimacao); timerAnimacao = null; }
      if (timerAssustada) { clearTimeout(timerAssustada); timerAssustada = null; }
      elArena.removeEventListener('pointerdown', _aoTocar);

      var comidas = TOTAL_SEMENTES - sementesRestantes;
      var esvaziou = sementesRestantes <= 0;
      var tempoRestanteMs = Math.max(0, duracaoMs - (Date.now() - inicioEm));
      var bonusTempo = esvaziou ? Math.round(tempoRestanteMs / BONUS_TEMPO_DIVISOR) : 0;
      var score = comidas * PONTOS_POR_SEMENTE + bonusTempo;

      _som('fim', [esvaziou]);
      onFim(score);
    }

    _agendarOlho();
  }

  window.ErvilhasGame = { render: render };
})();
