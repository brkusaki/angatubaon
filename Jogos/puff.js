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

  var PUFF_MIN_MS       = 180;   // hold mais curto que isso não conta (evita "spam de toque")
  var PUFF_LIMITE_INICIAL = 2200; // ms — a partir daqui, tosse (começa mais fácil...)
  var PUFF_LIMITE_MINIMO  = 1300; // ms — ...e vai apertando conforme acerta (mais difícil)
  var PUFF_LIMITE_PASSO   = 70;   // ms de redução no limite a cada puff válido
  var TOSSE_DURACAO_MS    = 1700; // atordoada, não dá pra puffar
  var BARRA_META          = 16;   // puffs válidos pra encher a barra de fôlego uma vez
  var IMG_IDLE            = '/Jogos/assets/puff/coruja-puff.webp';
  var IMG_TOSSINDO        = '/Jogos/assets/puff/coruja-puff-tossindo.webp';

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
            '<img class="pf-owl-img" id="pf-owl-img" src="' + IMG_IDLE + '" alt="" draggable="false">' +
            // Loop de vídeo da tosse (opcional — ver CORUJA-PARTY-PLANO.md):
            // fica escondido e pausado o tempo todo, e só aparece por cima
            // da imagem (mesmo tamanho/posição) durante "pf-tossindo" (ver
            // _tosse()). A imagem NUNCA fica escondida — ela troca pra
            // IMG_TOSSINDO nesse estado — então se o vídeo não existir/não
            // carregar (onerror), quem aparece por baixo já é a pose de
            // tosse certa, não a pose neutra.
            '<video class="pf-owl-video" id="pf-owl-video" src="/Jogos/assets/puff/coruja-tossindo-loop.webm" muted loop playsinline preload="auto"></video>' +
          '</div>' +
          '<div class="pf-instrucao" id="pf-instrucao">Segure e solte no tempo certo!</div>' +
          '<div class="pf-aviso-tosse" id="pf-aviso-tosse">Segurou demais! 🤧</div>' +
        '</div>' +
      '</div>';

    var elPuffs   = container.querySelector('#pf-puffs');
    var elTempo   = container.querySelector('#pf-tempo');
    var elBarra   = container.querySelector('#pf-barra');
    var elOwlWrap = container.querySelector('#pf-owl-wrap');
    var elOwlImg  = container.querySelector('#pf-owl-img');
    var elOwlVideo = container.querySelector('#pf-owl-video');
    var elAvisoTosse = container.querySelector('#pf-aviso-tosse');
    var elInstrucao  = container.querySelector('#pf-instrucao');

    elOwlImg.onerror = function () { this.style.visibility = 'hidden'; };
    // Sem isto, se a troca pra IMG_TOSSINDO falhasse (onerror escondia o
    // <img>), ele continuaria escondido pra sempre mesmo depois do src
    // voltar pra IMG_IDLE com sucesso — agora reaparece assim que QUALQUER
    // imagem carrega de verdade.
    elOwlImg.onload = function () { this.style.visibility = 'visible'; };
    if (elOwlVideo) elOwlVideo.onerror = function () { this.style.display = 'none'; };

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
      if (elInstrucao) elInstrucao.style.display = 'none';
      _som('toque');
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
      // Pose de tosse na hora (troca de src, instantâneo — já deve estar
      // em cache) + tenta subir o vídeo por cima (CSS mostra o <video> só
      // durante pf-tossindo — ver puff.css). Se o vídeo não existir/não
      // carregar, .play() falha silenciosamente e quem fica visível é a
      // imagem estática de tosse, não a pose neutra.
      elOwlImg.src = IMG_TOSSINDO;
      if (elOwlVideo) { try { elOwlVideo.currentTime = 0; elOwlVideo.play().catch(function () {}); } catch (e) {} }
      if (elAvisoTosse) { elAvisoTosse.style.display = 'block'; elAvisoTosse.classList.remove('pf-aviso-anim'); void elAvisoTosse.offsetWidth; elAvisoTosse.classList.add('pf-aviso-anim'); }
      _som('dano');
      _vibrar([40, 60, 40]);
      timerAtordoada = setTimeout(function () {
        atordoada = false;
        elOwlWrap.classList.remove('pf-tossindo');
        elOwlImg.src = IMG_IDLE;
        if (elOwlVideo) { try { elOwlVideo.pause(); } catch (e) {} }
        if (elAvisoTosse) elAvisoTosse.style.display = 'none';
      }, TOSSE_DURACAO_MS);
    }

    function _aoPointerDown(ev) { ev.preventDefault(); _iniciarHold(); }
    function _aoPointerUp(ev) { ev.preventDefault(); _soltarHold(); }

    elOwlWrap.addEventListener('pointerdown', _aoPointerDown);
    elOwlWrap.addEventListener('pointerup', _aoPointerUp);
    elOwlWrap.addEventListener('pointercancel', _aoPointerUp);
    elOwlWrap.addEventListener('pointerleave', function (ev) { if (segurando) _soltarHold(); });

    timerRodada = setInterval(function () {
      tempoRestante--;
      if (elTempo) elTempo.textContent = Math.max(0, tempoRestante);
      if (tempoRestante <= 0) _finalizar();
    }, 1000);

    function _finalizar() {
      if (acabou) return;
      acabou = true;
      if (timerRodada) { clearInterval(timerRodada); timerRodada = null; }
      if (timerHold) { clearTimeout(timerHold); timerHold = null; }
      if (timerAtordoada) { clearTimeout(timerAtordoada); timerAtordoada = null; }
      if (elOwlVideo) { try { elOwlVideo.pause(); } catch (e) {} }
      elOwlWrap.removeEventListener('pointerdown', _aoPointerDown);
      elOwlWrap.removeEventListener('pointerup', _aoPointerUp);
      _som('fim', [puffs >= BARRA_META]);
      onFim(puffs);
    }
  }

  window.PuffGame = { render: render };
})();
