/* ═══════════════════════════════════════════════════════════════
   SEQUÊNCIA DA CORUJA (Simon/Genius) — módulo de jogo (lazy-loaded)
   Carregado sob demanda por /Jogos/ quando o usuário abre o jogo.
   Comunica-se com o app APENAS via window.AngatubaGames (a ponte).
   Expõe window.SequenciaGame = { preparar, comecar, parar } e mantém
   window._sqComecar pro onclick inline dos botões no HTML.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* -- Sequência da Coruja (estilo Simon/Genius) -- */
  var _SQ_CORES = ['#a855f7', '#f59e0b', '#4ade80', '#3b82f6']; // 4 corujas
  var _sqSeq = [];          // sequência sorteada
  var _sqPasso = 0;         // posição atual na repetição do jogador
  var _sqRodada = 0;        // rodada atual = tamanho da sequência
  var _sqAceitando = false; // true quando é a vez do jogador
  var _sqTocando = false;   // true durante o playback
  var _sqTimers = [];       // timeouts do playback (pra limpar)

  function _sqRecordeGet() {
    try { return Number(localStorage.getItem('angatuba_seq_rec')) || 0; } catch(e) { return 0; }
  }
  function _sqRecordeSet(v) {
    try { localStorage.setItem('angatuba_seq_rec', String(v)); } catch(e) {}
  }

  function _sqLimparTimers() {
    for (var i = 0; i < _sqTimers.length; i++) clearTimeout(_sqTimers[i]);
    _sqTimers = [];
  }

  // Quantas corujas ficam ativas conforme a rodada. Começa com 4 (grade 2x2)
  // e expande para 6 (grade 3x2) a partir da rodada 6, deixando o jogo mais
  // difícil naturalmente para quem avança.
  function _sqCorujasAtivas(rodada) {
    return rodada >= 6 ? 6 : 4;
  }

  // Mostra/esconde os 2 botões extras e ajusta a grade (2x2 <-> 3x2).
  function _sqAjustarGrade(ativas) {
    var grade = document.getElementById('sq-grade');
    if (!grade) return;
    grade.classList.toggle('sq-grade-6', ativas === 6);
    var btns = grade.querySelectorAll('.sq-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].style.display = (i < ativas) ? '' : 'none';
    }
  }

  // Apaga a luz de TODAS as corujas (evita botão aceso preso ao reiniciar).
  function _sqApagarTodos() {
    var grade = document.getElementById('sq-grade');
    if (!grade) return;
    var btns = grade.querySelectorAll('.sq-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('sq-on');
  }

  function _sqPreparar() {
    _sqLimparTimers();
    _sqApagarTodos();
    _sqAjustarGrade(4); // sempre começa com 4 corujas (2x2)
    _sqSeq = []; _sqPasso = 0; _sqRodada = 0;
    _sqAceitando = false; _sqTocando = false;
    var rEl = document.getElementById('sq-rodada'); if (rEl) rEl.textContent = '0';
    var recEl = document.getElementById('sq-recorde'); if (recEl) recEl.textContent = _sqRecordeGet();
    var inicio = document.getElementById('sq-inicio'); if (inicio) inicio.style.display = 'flex';
    var fim = document.getElementById('sq-fim'); if (fim) fim.style.display = 'none';
    var st = document.getElementById('sq-status'); if (st) st.textContent = 'Memorize a sequência!';
  }

  function _sqBotoes() {
    var grade = document.getElementById('sq-grade');
    if (!grade) return [];
    return grade.querySelectorAll('.sq-btn');
  }

  // Acende uma coruja (visual + vibração leve).
  function _sqAcender(idx, dur) {
    var btns = _sqBotoes();
    if (!btns[idx]) return;
    var b = btns[idx];
    b.classList.add('sq-on');
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch(e) {} }
    var t = setTimeout(function(){ b.classList.remove('sq-on'); }, dur || 380);
    _sqTimers.push(t);
  }

  // Toca a sequência inteira pro jogador ver.
  function _sqPlayback() {
    _sqAceitando = false;
    _sqTocando = true;
    _sqApagarTodos();
    var st = document.getElementById('sq-status');
    if (st) st.textContent = 'Observe… 👀';
    _sqLimparTimers();

    // velocidade aumenta levemente conforme avança
    var vel = Math.max(320, 620 - _sqRodada * 25);
    var i = 0;
    function passo() {
      if (i >= _sqSeq.length) {
        // fim do playback: passa a vez ao jogador
        var t = setTimeout(function(){
          _sqTocando = false;
          _sqAceitando = true;
          _sqPasso = 0;
          if (st) st.textContent = 'Sua vez! Repita 🦉';
        }, 250);
        _sqTimers.push(t);
        return;
      }
      _sqAcender(_sqSeq[i], vel * 0.6);
      i++;
      var t = setTimeout(passo, vel);
      _sqTimers.push(t);
    }
    passo();
  }

  // Avança pra próxima rodada: adiciona 1 coruja e toca o playback.
  function _sqProximaRodada() {
    _sqRodada++;
    var rEl = document.getElementById('sq-rodada');
    if (rEl) {
      rEl.textContent = _sqRodada;
      rEl.classList.remove('sq-rodada-up'); void rEl.offsetWidth; rEl.classList.add('sq-rodada-up');
    }

    // Ajusta quantas corujas estão em jogo. Se acabou de expandir para 6,
    // mostra um aviso pra pessoa notar as novas corujas.
    var ativas = _sqCorujasAtivas(_sqRodada);
    var antesAtivas = _sqCorujasAtivas(_sqRodada - 1);
    _sqAjustarGrade(ativas);
    if (ativas > antesAtivas) {
      var st = document.getElementById('sq-status');
      if (st) st.textContent = 'Mais corujas! Agora são ' + ativas + ' 🔥';
      var grade = document.getElementById('sq-grade');
      if (grade) { grade.classList.remove('sq-expandiu'); void grade.offsetWidth; grade.classList.add('sq-expandiu'); }
      if (navigator.vibrate) { try { navigator.vibrate([30, 50, 30]); } catch(e) {} }
    }

    _sqSeq.push(Math.floor(Math.random() * ativas));
    // Dá um tempinho a mais na rodada que expande, pra pessoa perceber.
    var espera = (ativas > antesAtivas) ? 1100 : 600;
    var t = setTimeout(_sqPlayback, espera);
    _sqTimers.push(t);
  }

  // Jogador tocou numa coruja.
  function _sqTocar(idx) {
    if (!_sqAceitando) return;
    _sqAcender(idx, 260);

    if (idx === _sqSeq[_sqPasso]) {
      // acertou este passo
      _sqPasso++;
      if (_sqPasso >= _sqSeq.length) {
        // completou a rodada!
        _sqAceitando = false;
        var st = document.getElementById('sq-status');
        if (st) st.textContent = 'Acertou! 🎉';
        if (navigator.vibrate) { try { navigator.vibrate([15, 40, 15]); } catch(e) {} }
        var t = setTimeout(_sqProximaRodada, 700);
        _sqTimers.push(t);
      }
    } else {
      // errou: fim de jogo
      _sqErrou();
    }
  }

  function _sqErrou() {
    _sqAceitando = false;
    _sqTocando = false;
    _sqLimparTimers();
    _sqApagarTodos();
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch(e) {} }
    var grade = document.getElementById('sq-grade');
    if (grade) { grade.classList.remove('sq-erro'); void grade.offsetWidth; grade.classList.add('sq-erro'); }

    // a rodada alcançada é _sqRodada; pontuação = rodadas completas = _sqRodada - 1
    var alcancado = _sqRodada - 1;
    var rec = _sqRecordeGet();
    var bateu = alcancado > rec;
    if (bateu) _sqRecordeSet(alcancado);
    if (window.AngatubaGames) window.AngatubaGames.rankSubmeter('sequencia', alcancado);

    var recEl = document.getElementById('sq-recorde');
    if (recEl) recEl.textContent = _sqRecordeGet();

    var fim = document.getElementById('sq-fim');
    var fimOwl = document.getElementById('sq-fim-owl');
    var fimTit = document.getElementById('sq-fim-titulo');
    var fimMsg = document.getElementById('sq-fim-msg');
    if (fimOwl) {
      fimOwl.src = bateu ? '/webp/owl-celebrate-pro.webp' : '/webp/owl-thumbsup.webp';
      fimOwl.style.display = '';
    }
    if (fimTit) fimTit.textContent = bateu ? 'Novo recorde! 🏆' : 'Ops! Errou 🦉';
    if (fimMsg) {
      if (alcancado <= 0) fimMsg.textContent = 'Você chegou na rodada 1. Bora tentar de novo!';
      else fimMsg.textContent = 'Você memorizou ' + alcancado + (alcancado === 1 ? ' rodada' : ' rodadas') + '!' + (bateu ? ' Melhor marca!' : '');
    }
    var st = document.getElementById('sq-status');
    if (st) st.textContent = 'Fim de jogo';
    var t = setTimeout(function(){
      if (fim) fim.style.display = 'flex';
      if (window.AngatubaGames) window.AngatubaGames.rankFimDeJogo('sequencia', 'sq-rank-slot', alcancado);
    }, 500);
    _sqTimers.push(t);
  }

  function _sqComecar() {
    _sqLimparTimers();
    _sqApagarTodos();
    _sqSeq = []; _sqPasso = 0; _sqRodada = 0;
    _sqAceitando = false; _sqTocando = false;
    var inicio = document.getElementById('sq-inicio'); if (inicio) inicio.style.display = 'none';
    var fim = document.getElementById('sq-fim'); if (fim) fim.style.display = 'none';
    var recEl = document.getElementById('sq-recorde'); if (recEl) recEl.textContent = _sqRecordeGet();
    _sqProximaRodada();
  }

  // Liga os cliques nos botões uma única vez (delegação simples).
  function _sqLigarBotoes() {
    var grade = document.getElementById('sq-grade');
    if (!grade || grade._sqLigado) return;
    grade._sqLigado = true;
    var btns = grade.querySelectorAll('.sq-btn');
    for (var i = 0; i < btns.length; i++) {
      (function(b){
        b.addEventListener('click', function(){
          var idx = Number(b.getAttribute('data-idx'));
          _sqTocar(idx);
        });
      })(btns[i]);
    }
  }

  // Preparação da tela: liga os botões (idempotente) e reseta o estado.
  function _sqPrepararTela() {
    _sqLigarBotoes();
    _sqPreparar();
  }

  window._sqComecar = _sqComecar;

  // API pública consumida pelo loader do app (_jogoLoader).
  window.SequenciaGame = {
    preparar: _sqPrepararTela,
    comecar:  _sqComecar,
    parar:    _sqLimparTimers
  };
})();
