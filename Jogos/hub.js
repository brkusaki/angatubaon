'use strict';

/* ══════════════════════════════════════════════════════════════
   HUB DE JOGOS DA CORUJA — Jogos/hub.js
   Extraído do app.js (que ficou só com cardápio/lojas/admin/avisos +
   o núcleo de login compartilhado com "Hoje em Angatuba"). Este
   arquivo carrega sob demanda (ver _carregarHubJogos em app.js),
   disparado no primeiro toque no badge da coruja ou na pill
   "Joguinhos" — quem só quer ver o cardápio nunca baixa isto.

   Escopo: menu/filtro do hub, tela cheia, ofensiva (streak), som e
   efeitos compartilhados, quiz da coruja (diário/relâmpago/tema),
   loader dos jogos externos (/Jogos/<nome>.min.js), ranking
   (Firestore) e a ponte window.AngatubaGames usada pelos módulos
   de cada jogo.

   Roda no MESMO escopo global do app.js (script clássico, sem
   módulo/IIFE) — os dois se enxergam por identificador direto,
   sem precisar de window.* pra se chamar (ver comentário em
   app.js perto de window.cliAbrirLogin). Depende de app.js já ter
   rodado antes (login/conta, _injetarScript/_injetarCSS,
   _carregarFirebaseAuthCore) — nunca é carregado sozinho.
══════════════════════════════════════════════════════════════ */

  /* ── Quiz da Coruja — mini-quiz diário (5 perguntas + placar) ──
     Carrega o banco de perguntas ativas e monta um bloco de 5 por dia
     (rotação determinística por data). O usuário responde as 5 em sequência
     e vê o placar (ex: 4/5). Trava o dia todo (localStorage). Fundo do card
     acompanha a Igreja Matriz dia/noite. Falha silenciosa. */

  var _QUIZ_POR_DIA = 5; // quantas perguntas no mini-quiz de cada dia.
  var _quizEstado = null; // estado da sessão atual (perguntas do dia, índice, acertos).
  var _quizBancoCompleto = []; // banco inteiro de perguntas (reusado pelo Relâmpago).

  // Corujas por faixa de acerto no placar (caminho real: /webp/ com hífen).
  var _QUIZ_OWL = {
    otimo: '/webp/owl-celebrate-pro.webp', // 4-5 acertos
    bom:   '/webp/owl-thumbsup.webp',      // 2-3 acertos
    fraco: '/webp/owl-idea.webp'           // 0-1 acerto
  };

  function _quizChaveDia() { return 'angatuba_quiz_' + Math.floor(Date.now() / 86400000); }

  // Tema dia/noite do card, igual ao header-top.
  function _quizAplicarTema(card) {
    var h = new Date().getHours();
    var ehDia = (h >= 5 && h < 18), ehNoite = (h >= 22 || h < 5);
    card.classList.toggle('qz-dia', ehDia);
    card.classList.toggle('qz-noite', ehNoite);
    card.classList.toggle('qz-neutro', !ehDia && !ehNoite);
  }

  // Seleciona o bloco de 5 perguntas do dia. Começa num offset que roda por
  // dia, pegando 5 consecutivas (com wrap-around se chegar ao fim do banco).
  function _quizBlocoDoDia(banco) {
    var n = banco.length;
    var qtd = Math.min(_QUIZ_POR_DIA, n);
    var diaEpoch = Math.floor(Date.now() / 86400000);
    // Offset avança de 'qtd' em 'qtd' por dia, pra não repetir o mesmo bloco.
    var inicio = (diaEpoch * qtd) % n;
    var bloco = [];
    for (var i = 0; i < qtd; i++) { bloco.push(banco[(inicio + i) % n]); }
    return bloco;
  }

  // Renderiza a pergunta atual do estado.
  function _quizRenderPergunta() {
    if (!_quizEstado) return;
    var idx = _quizEstado.idx;
    var total = _quizEstado.perguntas.length;
    var pergunta = _quizEstado.perguntas[idx];
    var perguntaEl = document.getElementById('quiz-pergunta');
    var opcoesEl = document.getElementById('quiz-opcoes');
    var progEl = document.getElementById('quiz-progresso');
    var barraEl = document.getElementById('quiz-barra-fill');
    if (!perguntaEl || !opcoesEl) return;
    if (progEl) progEl.textContent = (idx + 1) + '/' + total;
    if (barraEl) barraEl.style.width = Math.round((idx / total) * 100) + '%';
    perguntaEl.textContent = pergunta.pergunta;
    perguntaEl.classList.remove('quiz-fade'); void perguntaEl.offsetWidth; perguntaEl.classList.add('quiz-fade');
    var letras = ['A','B','C'];
    opcoesEl.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      (function(li){
        var btn = document.createElement('button');
        btn.className = 'quiz-opt'; btn.type = 'button';
        var span = document.createElement('span');
        span.className = 'quiz-opt-letra'; span.textContent = letras[li];
        var txt = document.createElement('span');
        txt.textContent = pergunta.opcoes[li];
        btn.appendChild(span); btn.appendChild(txt);
        btn.addEventListener('click', function(){ _quizResponder(letras[li]); });
        opcoesEl.appendChild(btn);
      })(i);
    }
  }

  // Trata a resposta de UMA pergunta: marca visual, conta acerto, avança.
  function _quizResponder(escolha) {
    if (!_quizEstado || _quizEstado.travado) return;
    _quizEstado.travado = true; // evita duplo-clique enquanto anima
    var pergunta = _quizEstado.perguntas[_quizEstado.idx];
    var acertou = (escolha === pergunta.correta);
    if (acertou) _quizEstado.acertos++;
    var opcoesEl = document.getElementById('quiz-opcoes');
    var botoes = opcoesEl ? opcoesEl.querySelectorAll('.quiz-opt') : [];
    var letras = ['A','B','C'];
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].disabled = true;
      if (letras[i] === pergunta.correta) botoes[i].classList.add('qz-certa');
      else if (letras[i] === escolha) botoes[i].classList.add('qz-errada');
    }
    if (acertou && navigator.vibrate) { try { navigator.vibrate(35); } catch(e) {} }
    // Aguarda 1.1s pra pessoa ver o resultado, depois avança.
    setTimeout(function(){
      _quizEstado.idx++;
      _quizEstado.travado = false;
      if (_quizEstado.idx >= _quizEstado.perguntas.length) { _quizMostrarPlacar(); }
      else { _quizRenderPergunta(); }
    }, 1100);
  }

  // Mostra a tela de placar final e salva conclusão no localStorage.
  function _quizMostrarPlacar() {
    var acertos = _quizEstado.acertos;
    var total = _quizEstado.perguntas.length;
    // Trava o dia: guarda que completou (não refaz hoje).
    try { localStorage.setItem(_quizChaveDia(), String(acertos)); } catch(e) {}
    var faseEl = document.getElementById('quiz-fase-perguntas');
    var placarEl = document.getElementById('quiz-placar');
    var imgEl = document.getElementById('quiz-placar-img');
    var notaEl = document.getElementById('quiz-placar-nota');
    var msgEl = document.getElementById('quiz-placar-msg');
    if (faseEl) faseEl.style.display = 'none';
    if (!placarEl || !imgEl || !notaEl || !msgEl) return;
    // Coruja + mensagem conforme desempenho.
    var owl, msg;
    var pct = acertos / total;
    if (pct >= 0.8)      { owl = _QUIZ_OWL.otimo; msg = 'Você manja MUITO de Angatuba! 🏆'; }
    else if (pct >= 0.4) { owl = _QUIZ_OWL.bom;   msg = 'Mandou bem! Dá pra melhorar amanhã! 😉'; }
    else                 { owl = _QUIZ_OWL.fraco; msg = 'Bora estudar a cidade e voltar amanhã! 🦉'; }
    imgEl.src = owl; imgEl.style.display = '';
    notaEl.innerHTML = 'Você acertou <b>' + acertos + '</b> de ' + total + '!';
    msgEl.textContent = msg;
    placarEl.classList.add('show');
  }

  // _tentativa: 0 na primeira. Em falha (timeout/rede), 1 retry após 3s.
  async function _carregarQuizCoruja(_tentativa) {
    _tentativa = _tentativa || 0;
    var card = document.getElementById('quiz-coruja');
    if (!card) return;
    try {
      var params = new URLSearchParams();
      // tema:'angatuba' garante que o desafio diário e o Relâmpago (que reusa
      // este banco) fiquem só com perguntas da cidade, mesmo com outros temas
      // ativos na mesma aba Quiz.
      params.append('payload', JSON.stringify({ action: 'quizCoruja', tema: 'angatuba' }));
      var resp = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(8000) });
      var json = await resp.json();
      var banco = (json && json.status === 'ok' && Array.isArray(json.data)) ? json.data : [];
      if (!banco.length) return; // sem perguntas: card escondido
      _quizBancoCompleto = banco; // guarda pra o Modo Relâmpago reutilizar
      _quizAplicarTema(card);
      var bloco = _quizBlocoDoDia(banco);
      _quizEstado = { perguntas: bloco, idx: 0, acertos: 0, travado: false };
      card.style.display = 'block';
      // Já jogou hoje? Mostra o placar salvo direto (não deixa refazer).
      var jaJogou = null;
      try { jaJogou = localStorage.getItem(_quizChaveDia()); } catch(e) {}
      if (jaJogou !== null && jaJogou !== '') {
        _quizEstado.acertos = Number(jaJogou) || 0;
        _quizEstado.idx = bloco.length;
        _quizMostrarPlacar();
      } else {
        _quizRenderPergunta();
      }
    } catch(e) {
      if (_tentativa < 1) setTimeout(function(){ _carregarQuizCoruja(_tentativa + 1); }, 3000);
    }
  }


  /* -- Modo Relâmpago: quiz de treino com timer por pergunta -- */
  var _RL_TEMPO = 6000;   // ms por pergunta
  var _RL_MAX = 20;       // máx de perguntas por partida (pra não ser infinito)
  var _rlFila = [];       // perguntas embaralhadas da partida
  var _rlIdx = 0;
  var _rlPontos = 0, _rlAcertos = 0;
  var _rlTravado = false;
  var _rlTimerBarra = null, _rlTimerFim = null, _rlInicioPergunta = 0;

  function _rlRecordeGet() {
    try { return Number(localStorage.getItem('angatuba_relampago_rec')) || 0; } catch(e) { return 0; }
  }
  function _rlRecordeSet(v) {
    try { localStorage.setItem('angatuba_relampago_rec', String(v)); } catch(e) {}
  }

  function _rlLimparTimers() {
    if (_rlTimerBarra) { clearInterval(_rlTimerBarra); _rlTimerBarra = null; }
    if (_rlTimerFim)   { clearTimeout(_rlTimerFim);    _rlTimerFim = null; }
  }

  // Embaralha uma cópia do array (Fisher-Yates).
  function _rlEmbaralhar(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Abre a tela do Relâmpago (a partir do botão no placar do quiz).
  function _rlAbrir() {
    // Precisa do banco carregado (vem do quiz). Se vazio, tenta usar o que houver.
    if (!_quizBancoCompleto || !_quizBancoCompleto.length) {
      alert('O banco de perguntas ainda está carregando. Abra o Quiz da Coruja primeiro. 🦉');
      return;
    }
    var menu = document.getElementById('games-menu');
    if (menu) menu.style.display = 'none';
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    var tela = document.getElementById('jogo-relampago');
    if (tela) tela.style.display = 'block';
    _rlPreparar();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) {}
  }

  function _rlPreparar() {
    _rlLimparTimers();
    _rlTravado = false;
    var pEl = document.getElementById('rl-pontos'); if (pEl) pEl.textContent = '0';
    var aEl = document.getElementById('rl-acertos'); if (aEl) aEl.textContent = '0';
    var recEl = document.getElementById('rl-recorde'); if (recEl) recEl.textContent = _rlRecordeGet();
    var fill = document.getElementById('rl-timer-fill'); if (fill) fill.style.width = '100%';
    var inicio = document.getElementById('rl-inicio'); if (inicio) inicio.style.display = 'flex';
    var fim = document.getElementById('rl-fim'); if (fim) fim.style.display = 'none';
  }

  function _rlComecar() {
    _rlLimparTimers();
    _rlFila = _rlEmbaralhar(_quizBancoCompleto).slice(0, _RL_MAX);
    _rlIdx = 0; _rlPontos = 0; _rlAcertos = 0; _rlTravado = false;
    var pEl = document.getElementById('rl-pontos'); if (pEl) pEl.textContent = '0';
    var aEl = document.getElementById('rl-acertos'); if (aEl) aEl.textContent = '0';
    var recEl = document.getElementById('rl-recorde'); if (recEl) { recEl.textContent = _rlRecordeGet(); recEl.classList.remove('rl-recorde-novo'); }
    var inicio = document.getElementById('rl-inicio'); if (inicio) inicio.style.display = 'none';
    var fim = document.getElementById('rl-fim'); if (fim) fim.style.display = 'none';
    _rlRenderPergunta();
  }

  function _rlRenderPergunta() {
    if (_rlIdx >= _rlFila.length) { _rlFim(true); return; } // acabou o banco: vitória
    _rlTravado = false;
    var pergunta = _rlFila[_rlIdx];
    var pergEl = document.getElementById('rl-pergunta');
    var opcoesEl = document.getElementById('rl-opcoes');
    if (!pergEl || !opcoesEl) return;
    pergEl.textContent = pergunta.pergunta;
    pergEl.classList.remove('rl-fade'); void pergEl.offsetWidth; pergEl.classList.add('rl-fade');
    var letras = ['A','B','C'];
    opcoesEl.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      (function(li){
        var btn = document.createElement('button');
        btn.className = 'rl-opt'; btn.type = 'button';
        var span = document.createElement('span');
        span.className = 'rl-opt-letra'; span.textContent = letras[li];
        var txt = document.createElement('span');
        txt.textContent = pergunta.opcoes[li];
        btn.appendChild(span); btn.appendChild(txt);
        btn.addEventListener('click', function(){ _rlResponder(letras[li]); });
        opcoesEl.appendChild(btn);
      })(i);
    }
    _rlIniciarTimer();
  }

  // Barra de tempo regressiva + timeout que encerra por tempo esgotado.
  function _rlIniciarTimer() {
    _rlLimparTimers();
    _rlInicioPergunta = Date.now();
    var fill = document.getElementById('rl-timer-fill');
    if (fill) { fill.style.width = '100%'; }
    _rlTimerBarra = setInterval(function(){
      var passou = Date.now() - _rlInicioPergunta;
      var restante = Math.max(0, 1 - passou / _RL_TEMPO);
      if (fill) fill.style.width = (restante * 100) + '%';
      if (fill) fill.classList.toggle('rl-timer-critico', restante < 0.3);
    }, 60);
    _rlTimerFim = setTimeout(function(){
      if (_rlTravado) return;
      _rlTravado = true;
      _rlRevelarErro(null); // ninguém respondeu: mostra a certa e encerra
    }, _RL_TEMPO);
  }

  function _rlResponder(escolha) {
    if (_rlTravado) return;
    _rlTravado = true;
    _rlLimparTimers();
    var pergunta = _rlFila[_rlIdx];
    var acertou = (escolha === pergunta.correta);
    var opcoesEl = document.getElementById('rl-opcoes');
    var botoes = opcoesEl ? opcoesEl.querySelectorAll('.rl-opt') : [];
    var letras = ['A','B','C'];
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].disabled = true;
      if (letras[i] === pergunta.correta) botoes[i].classList.add('rl-certa');
      else if (letras[i] === escolha) botoes[i].classList.add('rl-errada');
    }
    if (acertou) {
      // Pontos por rapidez: 100 base + até 100 de bônus pelo tempo restante.
      var passou = Date.now() - _rlInicioPergunta;
      var restante = Math.max(0, 1 - passou / _RL_TEMPO);
      var ganho = 100 + Math.round(restante * 100);
      _rlPontos += ganho;
      _rlAcertos++;
      var pEl = document.getElementById('rl-pontos'); if (pEl) pEl.textContent = _rlPontos;
      var aEl = document.getElementById('rl-acertos'); if (aEl) aEl.textContent = _rlAcertos;
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch(e) {} }
      setTimeout(function(){ _rlIdx++; _rlRenderPergunta(); }, 700);
    } else {
      if (navigator.vibrate) { try { navigator.vibrate(150); } catch(e) {} }
      setTimeout(function(){ _rlFim(false); }, 900);
    }
  }

  // Chamado no timeout (sem resposta): revela a certa e encerra.
  function _rlRevelarErro() {
    var pergunta = _rlFila[_rlIdx];
    var opcoesEl = document.getElementById('rl-opcoes');
    var botoes = opcoesEl ? opcoesEl.querySelectorAll('.rl-opt') : [];
    var letras = ['A','B','C'];
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].disabled = true;
      if (letras[i] === pergunta.correta) botoes[i].classList.add('rl-certa');
    }
    if (navigator.vibrate) { try { navigator.vibrate(150); } catch(e) {} }
    setTimeout(function(){ _rlFim(false); }, 900);
  }

  function _rlFim(venceuBanco) {
    _rlLimparTimers();
    _rlTravado = true;
    var rec = _rlRecordeGet();
    var bateu = _rlPontos > rec;
    if (bateu) _rlRecordeSet(_rlPontos);
    if (typeof rankSubmeter === 'function') rankSubmeter('relampago', _rlPontos);
    var recEl = document.getElementById('rl-recorde'); if (recEl) recEl.textContent = _rlRecordeGet();
    var fim = document.getElementById('rl-fim');
    var fimOwl = document.getElementById('rl-fim-owl');
    var fimTit = document.getElementById('rl-fim-titulo');
    var fimMsg = document.getElementById('rl-fim-msg');
    if (fimOwl) { fimOwl.src = bateu ? '/webp/owl-celebrate-pro.webp' : '/webp/owl-thumbsup.webp'; fimOwl.style.display = ''; }
    if (fimTit) fimTit.textContent = bateu ? 'Novo recorde! 🏆' : (venceuBanco ? 'Você zerou o banco! 🎓' : 'Fim de jogo ⚡');
    if (fimMsg) {
      var base = _rlAcertos + (_rlAcertos === 1 ? ' acerto' : ' acertos') + ' • ' + _rlPontos + ' pontos';
      if (bateu) fimMsg.textContent = base + '. Melhor marca!';
      else fimMsg.textContent = base + '.';
    }
    if (bateu && recEl) recEl.classList.add('rl-recorde-novo');
    if (fim) fim.style.display = 'flex';
    if (typeof rankFimDeJogo === 'function') rankFimDeJogo('relampago', 'rl-rank-slot', _rlPontos);
  }

  window._rlAbrir = _rlAbrir;
  window._rlComecar = _rlComecar;

  /* -- "Quanto você conhece de..." — quiz temático (15 perguntas, sem timer) --
     Reaproveita o motor de perguntas do Quiz da Coruja (opções A/B/C, placar
     com coruja, _rlEmbaralhar pra sortear) só que com o banco filtrado por
     tema (futebol, música, séries e filmes) e nota em %. Sem trava de dia —
     dá pra jogar de novo na hora. Tela própria (#jogo-tema-escolha e
     #jogo-tema-quiz) pra não disputar elementos com o desafio diário. */
  var _QT_TEMAS = {
    futebol:       { label: 'Futebol',        emoji: '⚽',
                      iniciante: 'Só de passagem no futebol ⚽', manja: 'Manja bem de futebol! 👏', expert: 'Lenda da bola! 🏆' },
    musica:        { label: 'Música',         emoji: '🎵',
                      iniciante: 'Só ouve no rádio 📻',          manja: 'Manja de música! 🎧',      expert: 'DJ dos hits! 🎤' },
    series_filmes: { label: 'Séries e Filmes', emoji: '🎬',
                      iniciante: 'Só vê o trailer 🍿',            manja: 'Manja de cinema! 🎥',      expert: 'Crítico de Hollywood! 🏆' }
  };
  var _QT_POR_TEMA = 15; // perguntas por rodada (ou todas, se o banco do tema tiver menos)

  var _qtEstado = null;    // { perguntas, idx, acertos, travado }
  var _qtTemaAtual = null; // chave do tema em jogo agora (ex.: 'futebol')

  // Abre a tela de escolha de tema (botão no placar do desafio diário).
  function _qtAbrirEscolha() {
    var menu = document.getElementById('games-menu');
    if (menu) menu.style.display = 'none';
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    var tela = document.getElementById('jogo-tema-escolha');
    if (tela) tela.style.display = 'block';
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) {}
  }
  window._qtAbrirEscolha = _qtAbrirEscolha;

  // Da tela de perguntas/placar, volta pra escolha de tema (sem sair do hub).
  function _qtVoltarEscolha() {
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    var tela = document.getElementById('jogo-tema-escolha');
    if (tela) tela.style.display = 'block';
  }
  window._qtVoltarEscolha = _qtVoltarEscolha;

  // Usuário escolheu um tema: busca o banco daquele tema e começa a rodada.
  async function _qtEscolherTema(tema) {
    var cfg = _QT_TEMAS[tema];
    if (!cfg) return;
    _qtTemaAtual = tema;
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    var tela = document.getElementById('jogo-tema-quiz');
    if (tela) tela.style.display = 'block';
    var card = document.getElementById('qt-card');
    var fase = document.getElementById('qt-fase-perguntas');
    var placar = document.getElementById('qt-placar');
    var loading = document.getElementById('qt-loading');
    var headTxt = document.getElementById('qt-head-txt');
    if (placar) placar.classList.remove('show');
    if (fase) fase.style.display = 'none';
    if (card) card.style.display = 'none';
    if (loading) loading.style.display = 'block';
    if (headTxt) headTxt.textContent = cfg.emoji + ' ' + cfg.label;
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'quizCoruja', tema: tema }));
      var resp = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(8000) });
      var json = await resp.json();
      var banco = (json && json.status === 'ok' && Array.isArray(json.data)) ? json.data : [];
      if (loading) loading.style.display = 'none';
      if (!banco.length) {
        alert('Não encontrei perguntas desse tema ainda. Volta mais tarde! 🦉');
        _qtVoltarEscolha();
        return;
      }
      card && (card.style.display = 'block');
      var qtd = Math.min(_QT_POR_TEMA, banco.length);
      var perguntas = _rlEmbaralhar(banco).slice(0, qtd);
      _qtEstado = { perguntas: perguntas, idx: 0, acertos: 0, travado: false };
      if (fase) fase.style.display = '';
      _qtRenderPergunta();
    } catch(e) {
      if (loading) loading.style.display = 'none';
      alert('Não deu pra carregar as perguntas agora. Tenta de novo. 🦉');
      _qtVoltarEscolha();
    }
  }
  window._qtEscolherTema = _qtEscolherTema;

  // Joga de novo o mesmo tema (novo sorteio das perguntas já carregadas).
  function _qtJogarDeNovo() {
    if (!_qtTemaAtual) { _qtVoltarEscolha(); return; }
    _qtEscolherTema(_qtTemaAtual);
  }
  window._qtJogarDeNovo = _qtJogarDeNovo;

  // Renderiza a pergunta atual do tema (mesmo padrão do _quizRenderPergunta).
  function _qtRenderPergunta() {
    if (!_qtEstado) return;
    var idx = _qtEstado.idx;
    var total = _qtEstado.perguntas.length;
    var pergunta = _qtEstado.perguntas[idx];
    var perguntaEl = document.getElementById('qt-pergunta');
    var opcoesEl = document.getElementById('qt-opcoes');
    var progEl = document.getElementById('qt-progresso');
    var barraEl = document.getElementById('qt-barra-fill');
    if (!perguntaEl || !opcoesEl) return;
    if (progEl) progEl.textContent = (idx + 1) + '/' + total;
    if (barraEl) barraEl.style.width = Math.round((idx / total) * 100) + '%';
    perguntaEl.textContent = pergunta.pergunta;
    perguntaEl.classList.remove('quiz-fade'); void perguntaEl.offsetWidth; perguntaEl.classList.add('quiz-fade');
    var letras = ['A','B','C'];
    opcoesEl.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      (function(li){
        var btn = document.createElement('button');
        btn.className = 'quiz-opt'; btn.type = 'button';
        var span = document.createElement('span');
        span.className = 'quiz-opt-letra'; span.textContent = letras[li];
        var txt = document.createElement('span');
        txt.textContent = pergunta.opcoes[li];
        btn.appendChild(span); btn.appendChild(txt);
        btn.addEventListener('click', function(){ _qtResponder(letras[li]); });
        opcoesEl.appendChild(btn);
      })(i);
    }
  }

  // Trata a resposta de UMA pergunta do tema (mesmo padrão do _quizResponder).
  function _qtResponder(escolha) {
    if (!_qtEstado || _qtEstado.travado) return;
    _qtEstado.travado = true;
    var pergunta = _qtEstado.perguntas[_qtEstado.idx];
    var acertou = (escolha === pergunta.correta);
    if (acertou) _qtEstado.acertos++;
    var opcoesEl = document.getElementById('qt-opcoes');
    var botoes = opcoesEl ? opcoesEl.querySelectorAll('.quiz-opt') : [];
    var letras = ['A','B','C'];
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].disabled = true;
      if (letras[i] === pergunta.correta) botoes[i].classList.add('qz-certa');
      else if (letras[i] === escolha) botoes[i].classList.add('qz-errada');
    }
    if (acertou && navigator.vibrate) { try { navigator.vibrate(35); } catch(e) {} }
    setTimeout(function(){
      _qtEstado.idx++;
      _qtEstado.travado = false;
      if (_qtEstado.idx >= _qtEstado.perguntas.length) { _qtMostrarPlacar(); }
      else { _qtRenderPergunta(); }
    }, 1100);
  }

  // Mostra o placar final em % + título de acordo com a faixa de acerto:
  // 0–40% iniciante, 41–70% manja do assunto, 71–100% expert/lenda.
  function _qtMostrarPlacar() {
    var acertos = _qtEstado.acertos;
    var total = _qtEstado.perguntas.length;
    var pct = total ? Math.round((acertos / total) * 100) : 0;
    var cfg = _QT_TEMAS[_qtTemaAtual] || { label: 'isso', iniciante: 'Só de passagem', manja: 'Manja do assunto!', expert: 'Expert!' };
    var faseEl = document.getElementById('qt-fase-perguntas');
    var placarEl = document.getElementById('qt-placar');
    var imgEl = document.getElementById('qt-placar-img');
    var notaEl = document.getElementById('qt-placar-nota');
    var msgEl = document.getElementById('qt-placar-msg');
    if (faseEl) faseEl.style.display = 'none';
    if (!placarEl || !imgEl || !notaEl || !msgEl) return;
    var owl, titulo;
    if (pct >= 71)      { owl = _QUIZ_OWL.otimo; titulo = cfg.expert; }
    else if (pct >= 41) { owl = _QUIZ_OWL.bom;   titulo = cfg.manja; }
    else                { owl = _QUIZ_OWL.fraco; titulo = cfg.iniciante; }
    imgEl.src = owl; imgEl.style.display = '';
    notaEl.innerHTML = 'Você acertou <b>' + acertos + '</b> de ' + total + '!';
    msgEl.textContent = 'Você conhece ' + pct + '% de ' + cfg.label + ' — ' + titulo;
    placarEl.classList.add('show');
  }

  /* ── Ofensiva (streak diário) ───────────
     Conta dias seguidos em que a pessoa jogou QUALQUER jogo. 100% local.
     Guarda { dias, ultimoDia } onde ultimoDia é o epoch em dias (Date.now/86400000).
     Regras ao registrar atividade:
       - mesmo dia  -> mantém (não conta de novo)
       - dia seguinte -> incrementa
       - pulou 1+ dia -> reseta para 1
     A faixa aparece no topo do hub quando dias >= 1. */
  function _streakDiaAtual() { return Math.floor(Date.now() / 86400000); }

  var _streakAumentouAgora = false; // true se o streak subiu ao abrir o último jogo

  function _streakLer() {
    try {
      var raw = localStorage.getItem('angatuba_streak');
      if (!raw) return { dias: 0, ultimoDia: 0 };
      var obj = JSON.parse(raw);
      return { dias: Number(obj.dias) || 0, ultimoDia: Number(obj.ultimoDia) || 0 };
    } catch (e) { return { dias: 0, ultimoDia: 0 }; }
  }

  function _streakSalvar(dias, ultimoDia) {
    try { localStorage.setItem('angatuba_streak', JSON.stringify({ dias: dias, ultimoDia: ultimoDia })); } catch (e) {}
  }

  // Chamado quando a pessoa começa a jogar. Atualiza o streak conforme a data.
  // Retorna true se o streak AUMENTOU nesta chamada (pra dar feedback visual).
  function _streakRegistrar() {
    var hoje = _streakDiaAtual();
    var s = _streakLer();
    if (s.ultimoDia === hoje) {
      return false; // já contou hoje
    }
    if (s.ultimoDia === hoje - 1) {
      s.dias = s.dias + 1; // dia seguinte: continua a ofensiva
    } else {
      s.dias = 1; // primeiro dia ou quebrou a sequência
    }
    s.ultimoDia = hoje;
    _streakSalvar(s.dias, s.ultimoDia);
    return true;
  }

  // Próximo marco de dias (3, 7, 14, 30, 60, 100...) acima do valor atual.
  function _streakProxMarco(dias) {
    var marcos = [3, 7, 14, 30, 60, 100, 200, 365];
    for (var i = 0; i < marcos.length; i++) { if (marcos[i] > dias) return marcos[i]; }
    return null;
  }

  // Atualiza a faixa visual no hub conforme o estado do streak.
  function _streakAtualizarFaixa(comAnimacao) {
    var faixa = document.getElementById('streak-faixa');
    if (!faixa) return;
    var s = _streakLer();
    var hoje = _streakDiaAtual();

    // Streak "vivo" = jogou hoje ou ontem. 2+ dias sem jogar = ofensiva esfriou.
    var vivo = (s.ultimoDia === hoje || s.ultimoDia === hoje - 1);

    if (s.dias <= 0) { faixa.style.display = 'none'; return; }

    var numEl = document.getElementById('streak-num');
    var subEl = document.getElementById('streak-sub');
    var chamaEl = document.getElementById('streak-chama');

    faixa.style.display = 'flex';
    faixa.classList.toggle('streak-apagada', !vivo);

    if (numEl) numEl.textContent = s.dias + (s.dias === 1 ? ' dia' : ' dias');

    if (subEl) {
      if (!vivo) {
        subEl.textContent = 'Sua ofensiva esfriou! Jogue pra reacender 🔥';
      } else if (s.ultimoDia === hoje) {
        var proxMarco = _streakProxMarco(s.dias);
        subEl.textContent = proxMarco
          ? ('Voltou hoje! Faltam ' + (proxMarco - s.dias) + ' pra ' + proxMarco + ' dias 🎯')
          : 'Você está on fire! 🔥';
      } else {
        subEl.textContent = 'Jogue hoje pra manter a ofensiva!';
      }
    }

    if (comAnimacao && chamaEl) {
      chamaEl.classList.remove('streak-chama-pop'); void chamaEl.offsetWidth; chamaEl.classList.add('streak-chama-pop');
    }
  }

  /* ── Tela cheia NATIVA dos jogos ─────────────────────────────
     Usa a Fullscreen API do navegador pra colocar o hub de jogos em
     tela cheia de verdade: some a barra de status/URL do navegador e a
     navbar do app. Só funciona dentro de um gesto do usuário (por isso
     chamamos no toque que abre o jogo). Degrada em silêncio se a API
     não existir ou o navegador recusar (ex.: alguns iOS) — aí vale o
     fallback CSS games-fs-open, que já cobre a viewport.
     Prefixos: padrão + webkit (Safari/iOS antigos). */
  function _fsElemento() {
    return document.getElementById('games-hub') || document.documentElement;
  }
  function _fsAtivo() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function _entrarTelaCheia() {
    if (_fsAtivo()) return;
    var el = _fsElemento();
    if (!el) return;
    try {
      var p = null;
      if (el.requestFullscreen)            p = el.requestFullscreen();
      else if (el.webkitRequestFullscreen) p = el.webkitRequestFullscreen();
      // A promessa pode rejeitar (gesto expirado, permissão); engolimos.
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) { /* fallback CSS cobre */ }
  }
  function _sairTelaCheia() {
    if (!_fsAtivo()) return;
    try {
      if (document.exitFullscreen)            document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
  }
  // Quando o estado de tela cheia muda, o tamanho útil da tela muda também;
  // reavisamos os jogos ativos pra redimensionar o canvas na hora (senão a
  // arena fica com o tamanho antigo até um resize manual).
  var _fsListenerOn = false;
  function _ligarFsListener() {
    if (_fsListenerOn) return;
    _fsListenerOn = true;
    var aoMudar = function () {
      // Se o usuário SAIU da tela cheia por gesto do sistema (back/ESC/swipe)
      // enquanto um jogo estava ativo, voltamos pro menu — senão o jogo
      // ficaria rodando num layout meia-boca. (_fsAtivo false + jogo aberto.)
      // MAS: se a aba está oculta (document.hidden), quem soltou a tela
      // cheia foi o PRÓPRIO NAVEGADOR ao perder o foco — ex.: a pessoa saiu
      // pra colar o código da sala no WhatsApp — não o usuário saindo do
      // jogo. Só tratamos como saída de verdade com a aba visível; senão
      // isso derrubava o jogo (e a sala multiplayer) toda vez que alguém
      // só trocava de app um instante.
      var hubEl = document.getElementById('games-hub');
      var jogoAberto = hubEl && hubEl.classList.contains('jogo-ativo');
      if (!_fsAtivo() && jogoAberto && !document.hidden) {
        // Evita loop: _voltarAoMenu chama _sairTelaCheia, que é no-op aqui.
        _voltarAoMenu();
      }
      // Deixa o layout assentar antes de medir (dois frames).
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
        });
      } else {
        setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
      }
    };
    document.addEventListener('fullscreenchange', aoMudar);
    document.addEventListener('webkitfullscreenchange', aoMudar);

    // Ao voltar pro app com um jogo ainda ativo mas sem tela cheia (porque
    // o navegador soltou sozinho ao ir pro segundo plano), tenta reentrar —
    // silencioso se o navegador recusar, o fallback CSS já cobre a viewport.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      var hubEl = document.getElementById('games-hub');
      var jogoAberto = hubEl && hubEl.classList.contains('jogo-ativo');
      if (jogoAberto && !_fsAtivo()) _entrarTelaCheia();
    });
  }



  function _abrirGamesHub() {
    var hub = document.getElementById('games-hub');
    if (!hub) return;
    // Item 12: a lista de lojas agora vive dentro do carrossel horizontal
    // da home (ver initHomeCarouselSwipe); escondemos o carrossel inteiro
    // (e as bolinhas do indicador) em vez da <section> isolada.
    var secao = document.getElementById('home-carousel-wrap');
    var dots  = document.getElementById('home-dots');
    var footer = document.querySelector('main.main .footer');
    if (secao)  secao.style.display = 'none';
    if (dots)   dots.style.display = 'none';
    if (footer) footer.style.display = 'none';
    var siga = document.getElementById('bloco-siga');
    if (siga) siga.style.display = 'none';
    hub.style.display = 'block';
    document.body.classList.add('games-fs-open');   // trava scroll do body (tela cheia)
    _ligarFsListener();                              // redimensiona ao entrar/sair da tela cheia nativa
    _voltarAoMenu(); // sempre abre mostrando o menu de jogos
    _gamesLimparFiltros(); // reseta busca/categoria a cada entrada no hub
    _streakAtualizarFaixa(false); // mostra a ofensiva atual (sem animar)
    _carregarAssetsJogos();  // som + efeitos (uma vez, sob demanda)
    // Firestore (ranking) + Database (sinalização multiplayer) — dispara
    // em paralelo assim que o hub abre, bem antes de terminar uma partida
    // ou entrar numa sala. Ver _carregarFirebaseJogos.
    if (typeof _carregarFirebaseJogos === 'function') _carregarFirebaseJogos().catch(function () {});
    // Fix A1.18/A1.20: se o hub fechou antes suspendeu o áudio (ver
    // _fecharGamesHub) — reabrir é, ele mesmo, um gesto do usuário, então dá
    // pra acordar o contexto na hora (cobre 'suspended' e o 'interrupted' do
    // iOS). Nas primeiras aberturas AngatubaSom ainda não existe (script
    // carregando); o listener de _ligarDestravarAudio cobre esse caso.
    if (window.AngatubaSom && typeof window.AngatubaSom._destravar === 'function') window.AngatubaSom._destravar();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) { window.scrollTo(0,0); }
    // Fix: entrada no histórico pro botão "voltar" (Android) fechar o hub e
    // cair na tela inicial — sem isso, abrir o hub não empilhava nada e o
    // "voltar" saía direto do PWA.
    if (history.state?.modal !== 'jogos-hub') history.pushState({ modal: 'jogos-hub' }, '');
  }
  // Exposto pro badge da coruja no header (index.html), que abre o hub
  // direto no clique/toque, sem depender da pill de filtros.
  window._abrirGamesHub = _abrirGamesHub;

  /* ── Assets compartilhados dos jogos (som + efeitos visuais) ──
     Carregados uma única vez quando o hub abre. São leves e
     usados por vários jogos + pelo botão de som do hub, então não
     valem um lazy-load por jogo. O SW cacheia no 1º fetch.
     iOS: o AudioContext só acorda dentro de um gesto; por isso
     destravamos o áudio no 1º toque em qualquer lugar do hub. */
  var _assetsJogosCarregados = false;
  function _carregarAssetsJogos() {
    if (_assetsJogosCarregados) { _sincronizarBotaoSom(); return; }
    Promise.all([
      _injetarScript('/Jogos/assets/som.min.js'),
      _injetarScript('/Jogos/assets/efeitos.min.js')
    ]).then(function () {
      _assetsJogosCarregados = true;
      _sincronizarBotaoSom();
    }).catch(function () { _assetsJogosCarregados = false; /* permite nova tentativa na próxima abertura */ });
    _ligarDestravarAudio();
  }

  // Destrava o áudio no primeiro gesto do usuário dentro do hub.
  // Um único listener 'once' basta (o AudioContext fica acordado
  // depois disso na sessão).
  function _ligarDestravarAudio() {
    var hub = document.getElementById('games-hub');
    if (!hub || hub._audioLig) return;
    hub._audioLig = true;
    // Fix A1.16: nem pointerdown nem touchstart tinham { once: true } — em
    // aparelho com toque os dois disparam no mesmo gesto e ficavam
    // pendurados no hub pelo resto da vida da página. Agora cada um se
    // remove sozinho (once) e também remove o irmão dentro do handler.
    var destravar = function () {
      if (window.AngatubaSom && typeof window.AngatubaSom._destravar === 'function') {
        window.AngatubaSom._destravar();
      }
      hub.removeEventListener('pointerdown', destravar);
      hub.removeEventListener('touchstart', destravar);
    };
    hub.addEventListener('pointerdown', destravar, { once: true });
    hub.addEventListener('touchstart', destravar, { once: true, passive: true });
  }

  // Atualiza o ícone/estado do botão de som do hub conforme a
  // preferência atual. Chamado ao carregar os assets e ao alternar.
  function _sincronizarBotaoSom() {
    var btn = document.getElementById('games-som-btn');
    if (!btn) return;
    var ativo = !!(window.AngatubaSom && window.AngatubaSom.ativo());
    var ic = btn.querySelector('i');
    if (ic) ic.className = ativo ? 'fa fa-volume-high' : 'fa fa-volume-xmark';
    btn.setAttribute('aria-label', ativo ? 'Desligar som dos jogos' : 'Ligar som dos jogos');
    btn.setAttribute('title', ativo ? 'Som ligado' : 'Som desligado');
    btn.classList.toggle('games-som-off', !ativo);
  }

  // Liga/desliga o som dos jogos (botão do hub). Toca um bip curto
  // ao LIGAR pra dar retorno imediato (e já destrava dentro do gesto).
  function _alternarSomJogos() {
    if (!window.AngatubaSom) return;
    var agoraAtivo = window.AngatubaSom.alternar();
    _sincronizarBotaoSom();
    if (agoraAtivo && typeof window.AngatubaSom.toque === 'function') {
      window.AngatubaSom._destravar();
      window.AngatubaSom.toque();
    }
  }
  window._alternarSomJogos = _alternarSomJogos;

  function _fecharGamesHub(viaPopstate) {
    _pararJogosExternos(); // para Speed Tap / Sequência / Voo se estavam rodando
    // Fix A1.18: suspende os dois AudioContext (som compartilhado + piano,
    // que tem o seu próprio) — sem isso o indicador de mídia do navegador
    // ficava preso ativo com a pessoa já de volta na lista de lojas.
    if (window.AngatubaSom && typeof window.AngatubaSom._suspender === 'function') window.AngatubaSom._suspender();
    if (window.PianoGame && typeof window.PianoGame.suspenderAudio === 'function') window.PianoGame.suspenderAudio();
    _sairTelaCheia();      // garante sair da tela cheia nativa
    if (typeof _rlLimparTimers === 'function') _rlLimparTimers();
    var hub = document.getElementById('games-hub');
    if (!hub) return;
    hub.style.display = 'none';
    document.body.classList.remove('games-fs-open');  // destrava scroll do body
    var secao = document.getElementById('home-carousel-wrap');
    var dots  = document.getElementById('home-dots');
    var footer = document.querySelector('main.main .footer');
    if (secao)  secao.style.display = '';
    if (dots)   dots.style.display = '';
    if (footer) footer.style.display = '';
    var siga = document.getElementById('bloco-siga');
    if (siga) siga.style.display = '';
    // Fix: desfaz a entrada do histórico ao fechar manualmente (popstate já
    // consumiu) — mesmo padrão usado nos outros modais do app.
    if (!viaPopstate && history.state?.modal === 'jogos-hub') { _popstateNosso = true; history.back(); }
  }

  // Sai por completo do hub de jogos e volta pra tela inicial (lista de
  // lojas). Fecha o hub, desmarca a pill "Joguinhos" e re-renderiza a
  // lista — o mesmo efeito de clicar de novo na pill, mas acessível de
  // dentro do próprio hub (botão no topo do menu de jogos) e do botão
  // "voltar" do Android (viaPopstate=true, ver handler de popstate).
  function _sairDosJogos(viaPopstate) {
    _fecharGamesHub(viaPopstate);
    try { document.querySelectorAll('.pill-btn').forEach(function (b) { b.classList.remove('active'); }); } catch (e) {}
    if (typeof activePillFilter !== 'undefined') activePillFilter = 'all';
    if (typeof renderLojas === 'function') renderLojas();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }
  window._sairDosJogos = _sairDosJogos;

  function _gamesHubAberto() {
    var hub = document.getElementById('games-hub');
    return !!(hub && hub.style.display !== 'none' && hub.style.display !== '');
  }
  // Exposto pra os módulos de jogo externos (ex.: voo.js) checarem se o
  // hub ainda está aberto antes de reagir a resize/timers.
  window._gamesHubAberto = _gamesHubAberto;

  // Para todos os jogos externos que possam estar rodando. Cada módulo
  // só existe depois de carregado sob demanda; por isso o guard typeof.
  function _pararJogosExternos() {
    if (window.SpeedTapGame  && typeof window.SpeedTapGame.parar  === 'function') window.SpeedTapGame.parar();
    if (window.SequenciaGame && typeof window.SequenciaGame.parar === 'function') window.SequenciaGame.parar();
    if (window.VooGame       && typeof window.VooGame.parar       === 'function') window.VooGame.parar();
    if (window.CorridaGame   && typeof window.CorridaGame.parar   === 'function') window.CorridaGame.parar();
    if (window.PianoGame     && typeof window.PianoGame.parar     === 'function') window.PianoGame.parar();
    if (window.PingPongGame  && typeof window.PingPongGame.parar  === 'function') window.PingPongGame.parar();
    if (window.TanquesGame   && typeof window.TanquesGame.parar   === 'function') window.TanquesGame.parar();
    // Puff/Ervilhas só existem dentro de uma rodada de Party (container,
    // não tela própria) — ver A2.2. PartyGame.parar(), logo abaixo, já
    // chama isto por conta própria; aqui cobre a saída pelo botão genérico
    // quando por algum motivo o Party não tiver rodado sua própria limpeza.
    if (window.PuffGame      && typeof window.PuffGame.parar      === 'function') window.PuffGame.parar();
    if (window.ErvilhasGame  && typeof window.ErvilhasGame.parar  === 'function') window.ErvilhasGame.parar();
    if (window.BlocosGame    && typeof window.BlocosGame.parar    === 'function') window.BlocosGame.parar();
    if (window.DocesGame     && typeof window.DocesGame.parar     === 'function') window.DocesGame.parar();
    if (window.Game2048      && typeof window.Game2048.parar      === 'function') window.Game2048.parar();
    // Coruja Party: sem isto, sair da lobby pelo botão genérico (em vez
    // das telas próprias do Party) não avisava o Firebase — a sala
    // ficava fantasma na lista pública. Ver PartyGame.parar em party.js.
    if (window.PartyGame     && typeof window.PartyGame.parar     === 'function') window.PartyGame.parar();
  }

  /* -- Roteador de jogos: menu <-> tela de cada jogo -- */
  var _quizJaCarregadoNaTela = false; // lazy-load do quiz só quando abre a tela dele

  function _voltarAoMenu() {
    _pararJogosExternos();
    // Sai da tela cheia nativa ao voltar pro menu de jogos (o menu rola e
    // não precisa/quer tela cheia travada).
    _sairTelaCheia();
    // Volta a mostrar o cabeçalho/ranking do hub (sai do estado "jogo ativo").
    var hubEl = document.getElementById('games-hub');
    if (hubEl) hubEl.classList.remove('jogo-ativo');
    if (typeof _rlLimparTimers === 'function') _rlLimparTimers();
    var menu = document.getElementById('games-menu');
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    if (menu) menu.style.display = '';
    _gamesAplicarFiltro();
    // Atualiza a faixa de ofensiva; anima a chama se subiu nesta visita.
    _streakAtualizarFaixa(_streakAumentouAgora);
    _streakAumentouAgora = false;
    // Fix A1.15: desfaz o pushState({modal:'jogo'}) de _abrirJogo ao sair do
    // jogo por qualquer caminho que não seja o botão "voltar" do Android
    // (que já consumiu a entrada sozinho) — mesmo padrão dos outros modais.
    if (history.state?.modal === 'jogo') { _popstateNosso = true; history.back(); }
  }

  /* ══════════════════════════════════════════════════════════════
     BUSCA + FILTRO DE CATEGORIA (grid de jogos redesenhado)
     Filtra os cards de #games-menu por texto (data-nome/data-desc)
     e por categoria (data-cat), combinando os dois critérios.
  ══════════════════════════════════════════════════════════════ */
  var _gamesCatAtual = 'todos';
  function _gamesAplicarFiltro() {
    var termo = (document.getElementById('games-search-input') || {}).value || '';
    termo = termo.toLowerCase().trim();
    var cards = document.querySelectorAll('#games-menu .game-card');
    var visiveis = 0;
    cards.forEach(function (c) {
      var cat = c.getAttribute('data-cat') || '';
      var nome = c.getAttribute('data-nome') || '';
      var desc = c.getAttribute('data-desc') || '';
      var passaCat = (_gamesCatAtual === 'todos' || cat === _gamesCatAtual);
      var passaBusca = !termo || nome.indexOf(termo) !== -1 || desc.indexOf(termo) !== -1;
      var mostra = passaCat && passaBusca;
      c.style.display = mostra ? '' : 'none';
      if (mostra) visiveis++;
    });
    var vazio = document.getElementById('games-empty');
    if (vazio) vazio.style.display = visiveis === 0 ? 'flex' : 'none';
  }
  window._gamesFiltrar = _gamesAplicarFiltro;

  function _gamesFiltrarCat(cat, btn) {
    _gamesCatAtual = cat;
    document.querySelectorAll('.games-cat-chip').forEach(function (b) { b.classList.remove('games-cat-ativa'); });
    if (btn) btn.classList.add('games-cat-ativa');
    _gamesAplicarFiltro();
  }
  window._gamesFiltrarCat = _gamesFiltrarCat;

  function _gamesLimparFiltros() {
    var input = document.getElementById('games-search-input');
    if (input) input.value = '';
    var todosBtn = document.querySelector('.games-cat-chip[data-cat="todos"]');
    _gamesFiltrarCat('todos', todosBtn);
  }
  window._gamesLimparFiltros = _gamesLimparFiltros;

  /* ══════════════════════════════════════════════════════════════
     LOADER DE JOGOS SOB DEMANDA (_jogoLoader)
     Jogos pesados vivem em /jogos/<nome>.js (+ .css) e só são
     baixados quando o usuário abre o jogo pela primeira vez. Depois,
     o Service Worker cacheia e a abertura é instantânea.
     Cada jogo externo expõe um objeto global (ex.: window.VooGame)
     com { preparar, comecar, parar }.
  ══════════════════════════════════════════════════════════════ */
  var JOGOS_EXTERNOS = {
    voo: { js: '/Jogos/voo.min.js', css: '/Jogos/voo.css', global: 'VooGame' },
    speedtap: { js: '/Jogos/speedtap.min.js', css: '/Jogos/speedtap.css', global: 'SpeedTapGame' },
    sequencia: { js: '/Jogos/sequencia.min.js', css: '/Jogos/sequencia.css', global: 'SequenciaGame' },
    corrida: { js: '/Jogos/corrida.min.js', css: '/Jogos/corrida.css', global: 'CorridaGame' },
    piano: { js: '/Jogos/piano.min.js', css: '/Jogos/piano.css', global: 'PianoGame' },
    // Ping Pong depende de Jogos/multiplayer.js (AngatubaMP), carregado
    // sob demanda pelo _jogoLoader (ver flag mp abaixo) — infraestrutura
    // leve e compartilhável com futuros jogos, sem custar nada em quem
    // nunca abre jogo nenhum.
    pingpong: { js: '/Jogos/pingpong.min.js', css: '/Jogos/pingpong.css', global: 'PingPongGame', mp: true },
    // Batalha de Tanques também depende de Jogos/multiplayer.js (AngatubaMP),
    // carregado sob demanda pelo _jogoLoader (ver flag mp abaixo) — mesma
    // infraestrutura do Ping Pong.
    tanques: { js: '/Jogos/tanques.min.js', css: '/Jogos/tanques.css', global: 'TanquesGame', mp: true },
    // Coruja Party (2-4 jogadores): fala direto com o Firebase Realtime
    // Database, não usa AngatubaMP (que é só 1x1). Ver Jogos/party.js.
    party: { js: '/Jogos/party.min.js', css: '/Jogos/party.css', global: 'PartyGame' },
    // Puff da Coruja: minigame da pool do Coruja Party. Não tem tela
    // própria (nem card no hub) — é carregado de dentro do party.js via
    // window._jogoLoader('puff') e desenha tudo em #pty-arena-container.
    puff: { js: '/Jogos/puff.min.js', css: '/Jogos/puff.css', global: 'PuffGame' },
    // Ervilhas da Coruja: mesmo esquema do Puff acima — minigame só da
    // pool do Coruja Party, carregado via window._jogoLoader('ervilhas').
    ervilhas: { js: '/Jogos/ervilhas.min.js', css: '/Jogos/ervilhas.css', global: 'ErvilhasGame' },
    // Blocos da Coruja e Doces da Coruja: solo com fases (não entram na
    // pool do Coruja Party). Ranking = maior fase concluída.
    blocos: { js: '/Jogos/blocos.min.js', css: '/Jogos/blocos.css', global: 'BlocosGame' },
    doces: { js: '/Jogos/doces.min.js', css: '/Jogos/doces.css', global: 'DocesGame' },
    // 2048 da Coruja: solo sem fases (corrida única, sem "vitória final"
    // que trava o jogo) — ranking = maior pontuação, igual a Voo/Piano.
    '2048': { js: '/Jogos/2048.min.js', css: '/Jogos/2048.css', global: 'Game2048' }
  };
  var _jogosCarregados = {};   // nome -> true quando js+css já injetados


  var _fbJogosCarregado = null;
  function _carregarFirebaseJogos() {
    // Firestore (ranking) + Realtime Database (sinalização multiplayer) —
    // só usados dentro do hub de jogos.
    if (_fbJogosCarregado) return _fbJogosCarregado;
    _fbJogosCarregado = _carregarFirebaseAuthCore().then(function () {
      return Promise.all([
        _injetarScript(FIREBASE_SDK_BASE + 'firebase-firestore-compat.js'),
        _injetarScript(FIREBASE_SDK_BASE + 'firebase-database-compat.js')
      ]);
    }).catch(function (err) { _fbJogosCarregado = null; throw err; });
    return _fbJogosCarregado;
  }

  // Mostra/esconde o overlay de carregamento do jogo (reaproveita o
  // #games-loading se existir; senão cria um simples na tela do jogo).
  function _jogoLoadingMostrar(tela, mostrar) {
    if (!tela) return;
    var ld = tela.querySelector('.jogo-loading-lazy');
    if (mostrar) {
      if (!ld) {
        ld = document.createElement('div');
        ld.className = 'jogo-loading-lazy';
        ld.innerHTML = '<img src="/webp/owl-search.webp" alt="" onerror="this.style.display=\'none\'">' +
                       '<div class="jll-txt">Carregando o jogo\u2026</div>';
        tela.appendChild(ld);
      }
      ld.style.display = 'flex';
    } else if (ld) {
      ld.style.display = 'none';
    }
  }

  // Carrega (se preciso) e prepara um jogo externo. Retorna Promise
  // que resolve com o objeto global do jogo (ex.: window.VooGame).
  function _jogoLoader(nome) {
    var cfg = JOGOS_EXTERNOS[nome];
    var tela = document.getElementById('jogo-' + nome);
    if (!cfg) return Promise.reject(new Error('Jogo externo desconhecido: ' + nome));
    // Já carregado: só resolve.
    if (_jogosCarregados[nome] && window[cfg.global]) {
      return Promise.resolve(window[cfg.global]);
    }
    _jogoLoadingMostrar(tela, true);
    _injetarCSS(cfg.css);
    // Firestore/Database já devem estar carregando desde a abertura do hub
    // (ver _abrirGamesHub); aqui só garante (é idempotente — Promise
    // cacheada), sem travar a abertura do jogo por isso: ranking e
    // multiplayer degradam sozinhos se o SDK não vier (ver _rankDb /
    // multiplayer.js).
    if (typeof _carregarFirebaseJogos === 'function') _carregarFirebaseJogos().catch(function () {});
    // Ping Pong e Batalha de Tanques dependem do multiplayer.min.js
    // (AngatubaMP). Injeta em paralelo ao script do próprio jogo — como os
    // dois usam script.async=false (ver _injetarScript), a ordem de
    // EXECUÇÃO fica garantida (multiplayer antes do jogo) mesmo com
    // download em paralelo.
    var _pMultiplayer = cfg.mp ? _injetarScript('/Jogos/multiplayer.min.js') : null;
    var _pJogo = _injetarScript(cfg.js);
    var _pronto = _pMultiplayer ? Promise.all([_pMultiplayer, _pJogo]) : _pJogo;
    return _pronto.then(function () {
      _jogosCarregados[nome] = true;
      _jogoLoadingMostrar(tela, false);
      var api = window[cfg.global];
      if (!api) throw new Error('Módulo ' + nome + ' não expôs ' + cfg.global);
      return api;
    }).catch(function (err) {
      _jogoLoadingMostrar(tela, false);
      if (tela) {
        var er = tela.querySelector('.jogo-erro-lazy') || document.createElement('div');
        er.className = 'jogo-erro-lazy';
        er.innerHTML = 'Não foi possível carregar o jogo. Verifique a conexão e tente de novo.';
        if (!er.parentNode) tela.appendChild(er);
      }
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[jogoLoader]', err && err.message);
      throw err;
    });
  }
  window._jogoLoader = _jogoLoader;

  function _abrirJogo(nome) {
    // Registra a ofensiva do dia (qualquer jogo conta). Guarda se aumentou
    // pra animar a chama quando a pessoa voltar ao menu de jogos.
    _streakAumentouAgora = _streakRegistrar();
    // Tela cheia NATIVA: estamos dentro do gesto de toque no card do jogo,
    // então o navegador aceita. (No menu não pedimos — só ao abrir um jogo.)
    _entrarTelaCheia();
    // Marca o hub como "jogo ativo" pra o CSS esconder o cabeçalho, a
    // faixa de ofensiva e o botão de ranking — tela cheia de verdade só
    // com a arena do jogo.
    var hubEl = document.getElementById('games-hub');
    if (hubEl) hubEl.classList.add('jogo-ativo');
    var menu = document.getElementById('games-menu');
    if (menu) menu.style.display = 'none';
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    var tela = document.getElementById('jogo-' + nome);
    // Fix: limpa o display inline em vez de forçar 'block' — só assim a
    // regra de CSS "body.games-fs-open .jogo-tela { display:flex }" (que
    // faz o cartão do jogo esticar pra tela toda) consegue valer, já que
    // estilo inline sempre vence regra de classe.
    if (tela) tela.style.display = '';
    if (nome === 'quiz') {
      // Lazy-load do quiz na primeira abertura da tela.
      if (!_quizJaCarregadoNaTela) {
        _quizJaCarregadoNaTela = true;
        _carregarQuizCoruja();
        setTimeout(function(){
          var ld = document.getElementById('games-loading');
          var qz = document.getElementById('quiz-coruja');
          if (ld && qz && qz.style.display !== 'none') ld.style.display = 'none';
        }, 1200);
        setTimeout(function(){ var ld = document.getElementById('games-loading'); if (ld) ld.style.display = 'none'; }, 12000);
      }
    } else if (JOGOS_EXTERNOS[nome]) {
      // Fix A1.17: antes a lista vinha duplicada à mão aqui — quem
      // adicionasse um jogo novo em JOGOS_EXTERNOS e esquecesse esta linha
      // abria uma tela vazia sem nenhum erro. Puff/Ervilhas não têm tela
      // própria (só existem dentro de uma rodada do Party) e por isso nunca
      // entram em JOGOS_EXTERNOS — a checagem já os exclui sozinha.
      // Jogos externos: carrega sob demanda e prepara quando pronto.
      _jogoLoader(nome).then(function (api) {
        if (api && typeof api.preparar === 'function') api.preparar();
      }).catch(function () {});
    }
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) {}
    // Fix A1.15: empilha uma entrada própria pro jogo — sem isto, o botão
    // "voltar" do Android saía do hub inteiro em vez de só fechar o jogo
    // (ver ramo "jogo-ativo" no handler de popstate, mais abaixo).
    if (history.state?.modal !== 'jogo') history.pushState({ modal: 'jogo' }, '');
  }
  window._abrirJogo = _abrirJogo;
  window._voltarAoMenu = _voltarAoMenu;

  /* ── Jogos extraídos para /Jogos/ (lazy load) ───────────────────
     Voo da Coruja      → /Jogos/voo.js        (window.VooGame)
     Pega a Coruja      → /Jogos/speedtap.js   (window.SpeedTapGame)
     Sequência da Coruja→ /Jogos/sequencia.js  (window.SequenciaGame)
     Cada jogo é um módulo carregado sob demanda pelo _jogoLoader
     quando o usuário abre a tela. Fala com o app só via a ponte
     window.AngatubaGames. Quiz e Modo Relâmpago seguem inline
     abaixo (compartilham o banco de perguntas do dia).
  */
  /* ── Recordes dos jogos ─────────────────────
     Mostra a melhor pontuação de cada jogo, mas só os que a pessoa já
     jogou (recorde > 0) — senão a lista fica cheia de zeros à toa.
     Nomes/ícones vêm de RANK_INFO e a chave local de RANK_REC_LOCAL
     (ambos já existem no módulo de ranking, Camada 2.4 — aqui só
     reaproveitamos, sem duplicar a lista de jogos por dois lugares).
     Acima de CLI_REC_LIMITE itens, o resto fica atrás de "ver mais".
     Preferimos o recorde do Firestore (rankMinhaPontuacao) quando
     logado; se vier vazio, caímos no recorde local (localStorage). */
  var CLI_REC_LIMITE = 4; // itens visíveis antes do "ver mais"
  var CLI_REC_COR = {
    pegacoruja:      '#fbbf24',
    pegacoruja_surv: '#ef4444',
    relampago:       '#c084fc',
    sequencia:       '#34d399',
    voo:             '#38bdf8',
    corrida:         '#a3e635',
    piano:           '#f472b6',
    blocos:          '#22d3ee',
    doces:           '#fb7185',
    '2048':          '#fb923c'
  };

  function cliRenderRecordes() {
    var wrap = document.getElementById('cli-conta-recordes');
    var maisBtn = document.getElementById('cli-conta-recordes-mais');
    var vazio = document.getElementById('cli-conta-recordes-vazio');
    if (!wrap) return;
    var RANK = (typeof RANK_INFO !== 'undefined') ? RANK_INFO : {};
    var ordem = Object.keys(RANK);

    function montar(dados) {
      var jogados = dados.filter(function (d) { return d.valor > 0; });
      if (!jogados.length) {
        wrap.innerHTML = '';
        wrap.style.display = 'none';
        if (maisBtn) maisBtn.style.display = 'none';
        if (vazio) vazio.style.display = 'block';
        return;
      }
      wrap.style.display = '';
      if (vazio) vazio.style.display = 'none';
      wrap.innerHTML = jogados.map(function (d, i) {
        var info = RANK[d.key] || {};
        var sub = info.sub ? '<span class="cli-rec-sub">' + info.sub + '</span>' : '';
        var extra = (i >= CLI_REC_LIMITE) ? ' cli-rec-extra' : '';
        var cor = CLI_REC_COR[d.key] || '';
        var estilo = cor ? ' style="--rc:' + cor + '"' : '';
        return '<div class="cli-rec-item' + extra + '"' + estilo + '>' +
          '<div class="cli-rec-top"><span class="cli-rec-ico">' + (info.ico || '🏆') + '</span>' +
          '<span class="cli-rec-val">' + d.valor + '</span></div>' +
          '<span class="cli-rec-nome">' + (info.label || d.key) + sub + '</span></div>';
      }).join('');
      if (maisBtn) {
        var extraQtd = jogados.length - CLI_REC_LIMITE;
        if (extraQtd > 0) {
          maisBtn.style.display = 'flex';
          maisBtn.dataset.extra = extraQtd;
          var aberto = wrap.classList.contains('aberto');
          var txt = maisBtn.querySelector('.txt');
          if (txt) txt.textContent = aberto ? 'Ver menos' : ('Ver mais ' + extraQtd);
          maisBtn.classList.toggle('aberto', aberto);
        } else {
          maisBtn.style.display = 'none';
          wrap.classList.remove('aberto');
        }
      }
    }

    // Render inicial com o recorde local (instantâneo, sem esperar rede).
    var dados = ordem.map(function (k) { return { key: k, valor: _rankRecordeLocal(k) }; });
    montar(dados);
    // Se logado e o Firestore responde, prevalece o recorde do servidor
    // (fonte da verdade do ranking) quando for maior. Espera todas as
    // consultas responderem pra re-renderizar uma vez só (sem "piscar").
    if (_cliUser && typeof rankMinhaPontuacao === 'function') {
      var pendentes = ordem.length;
      ordem.forEach(function (k, idx) {
        rankMinhaPontuacao(k).then(function (s) {
          if (s != null && s > dados[idx].valor) dados[idx].valor = s;
        }).catch(function () {}).finally(function () {
          if (--pendentes === 0) montar(dados);
        });
      });
    }
  }

  /* ── Expandir/recolher a lista de recordes ──────────────
     Botão "ver mais" só aparece quando há mais jogos jogados do que
     CLI_REC_LIMITE (ver cliRenderRecordes). */
  function cliToggleRecordesMais() {
    var wrap = document.getElementById('cli-conta-recordes');
    var btn = document.getElementById('cli-conta-recordes-mais');
    if (!wrap || !btn) return;
    var aberto = wrap.classList.toggle('aberto');
    btn.classList.toggle('aberto', aberto);
    var extra = Number(btn.dataset.extra) || 0;
    var txt = btn.querySelector('.txt');
    if (txt) txt.textContent = aberto ? 'Ver menos' : ('Ver mais ' + extra);
  }
  window.cliToggleRecordesMais = cliToggleRecordesMais;
  /* ══════════════════════════════════════════════════════════════
     RANKING DOS JOGOS (Cloud Firestore)
     — Camada 2: grava a pontuação quando o cliente logado bate
       recorde, e lê o rank para exibir.
     — Depende da camada 1 (cliente-auth). Se o cliente NÃO estiver
       logado, rankSubmeter() é um no-op silencioso: o jogo livre
       continua idêntico ao de hoje (recorde local no localStorage).
     — Segurança: as regras do Firestore garantem que só o dono grava
       o próprio doc, só recorde (score maior) passa, e há teto por
       jogo. O cliente NÃO precisa confiar em nada disso; é o servidor
       (Firebase) que aplica.
  ══════════════════════════════════════════════════════════════ */

  // Referência ao Firestore (compat). Injetado sob demanda por
  // _carregarFirebaseJogos() ao abrir o hub de jogos (ver perto de
  // _jogoLoader). Degradação graciosa se o SDK não carregou: ranking
  // fica indisponível, jogo segue normal.
  var _fbDb = null;
  // Guarda a última pontuação feita DESLOGADO ({jogo, score}), pra ser
  // re-submetida automaticamente assim que o cliente logar. Zerada após
  // enviar. Sem isso, um recorde jogado sem login se perdia ao entrar.
  var _rankPendente = null;

  // Pedido de login vindo de dentro de um jogo (botão "Entrar e competir"
  // na tela de fim). O jogo roda em tela cheia NATIVA num elemento; um
  // modal fora desse elemento não é exibido pelo navegador. Então saímos
  // da tela cheia ANTES de abrir o login. Um pequeno atraso deixa o layout
  // reassentar antes do modal aparecer.
  function rankPedirLogin() {
    var estavaFs = (typeof _fsAtivo === 'function' && _fsAtivo());
    if (typeof _sairTelaCheia === 'function') _sairTelaCheia();
    var abrir = function () {
      if (typeof cliAbrirLogin === 'function') cliAbrirLogin('Entre para aparecer no ranking de Angatuba!');
    };
    if (estavaFs) setTimeout(abrir, 220); else abrir();
  }
  window.rankPedirLogin = rankPedirLogin;

  function _rankDb() {
    if (_fbDb) return _fbDb;
    if (typeof firebase === 'undefined' || !firebase.firestore) return null;
    try { _fbDb = firebase.firestore(); } catch (e) { _fbDb = null; }
    return _fbDb;
  }

  // Mapa jogo -> coleção no Firestore. Mantém os nomes das regras.
  var RANK_COLECOES = {
    pegacoruja:      'ranking_pegacoruja',
    pegacoruja_surv: 'ranking_pegacoruja_surv',
    relampago:       'ranking_relampago',
    sequencia:       'ranking_sequencia',
    voo:             'ranking_voo',
    corrida:         'ranking_corrida',
    piano:           'ranking_piano',
    blocos:          'ranking_blocos',
    doces:           'ranking_doces',
    '2048':          'ranking_2048'
  };

  // Chave do recorde LOCAL (localStorage) de cada jogo. Usada para, ao
  // logar, subir também o melhor recorde já feito DESLOGADO — não só a
  // pontuação da partida que acabou. Mantém em sincronia com as chaves
  // definidas dentro de cada módulo de jogo.
  var RANK_REC_LOCAL = {
    pegacoruja:      'angatuba_speedtap_rec',
    pegacoruja_surv: 'angatuba_speedtap_surv_rec',
    relampago:       'angatuba_relampago_rec',
    sequencia:       'angatuba_seq_rec',
    voo:             'angatuba_voo_rec',
    corrida:         'angatuba_corrida_rec',
    piano:           'angatuba_piano_rec',
    blocos:          'angatuba_blocos_fase',
    doces:           'angatuba_doces_fase',
    '2048':          'angatuba_2048_rec'
  };
  function _rankRecordeLocal(jogoKey) {
    var chave = RANK_REC_LOCAL[jogoKey];
    if (!chave) return 0;
    try { return Math.max(0, Math.round(Number(localStorage.getItem(chave)) || 0)); }
    catch (e) { return 0; }
  }

  /* ── Submeter uma pontuação ─────────────────────────────────
     Chamada nos pontos de "bateu recorde" de cada jogo.
     - jogoKey: chave de RANK_COLECOES (ex.: 'pegacoruja')
     - score: número inteiro da pontuação
     Comportamento:
     - Sem login → não faz nada (silencioso). Jogo livre preservado.
     - Com login → grava/atualiza o doc do próprio uid. A regra do
       Firestore só aceita se for recorde (score maior que o atual)
       e dentro do teto; então não precisamos checar aqui — mas
       tratamos o erro com discrição (sem quebrar o fim de jogo).
     Usa merge/set no doc de id = uid. */
  function rankSubmeter(jogoKey, score) {
    // Só faz sentido se houver cliente logado (camada 1).
    if (typeof _cliUser === 'undefined' || !_cliUser) return;
    var db = _rankDb();
    if (!db) return;
    var colecao = RANK_COLECOES[jogoKey];
    if (!colecao) return;

    var uid = _cliUser.uid;
    var nome = (_cliApelido || _cliUser.displayName || 'Jogador').trim().slice(0, 20);
    // Garante nome válido pras regras do Firestore (mín. 2 caracteres).
    if (nome.length < 2) nome = 'Jogador';
    // Reconcilia com o recorde LOCAL do dispositivo: sempre tentamos subir
    // o MAIOR entre a pontuação da partida e o melhor recorde já salvo no
    // localStorage. Assim, um recorde feito DESLOGADO sobe sozinho na
    // primeira partida jogada logado — sem depender do fluxo de login.
    var val = Math.max(0, Math.round(Number(score) || 0), _rankRecordeLocal(jogoKey));

    // Read-before-write: lê o score atual do próprio doc e só grava se o
    // novo for MAIOR. Isso garante o comportamento correto mesmo que as
    // regras do Firestore não estejam barrando downgrade — uma partida
    // pior nunca sobrescreve o recorde. (A regra do servidor continua
    // sendo a defesa final; aqui é a defesa do cliente.)
    var ref = db.collection(colecao).doc(uid);
    ref.get().then(function (doc) {
      var atual = 0;
      if (doc && doc.exists) {
        var d = doc.data() || {};
        atual = (typeof d.score === 'number') ? d.score : 0;
      }
      // Não é recorde: não grava (evita downgrade e escrita desnecessária).
      if (val <= atual) {
        if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[rank] não é recorde (' + val + ' <= ' + atual + '):', colecao);
        return;
      }
      ref.set({
        uid: uid,
        nome: nome,
        score: val,
        photoURL: (_cliUser.photoURL || ''),
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(function (err) {
        // permission-denied aqui = regra do servidor rejeitou (ex.: teto
        // por jogo nas security rules do Firestore menor que o score).
        // Se um recorde legítimo não sobe, é o teto do servidor que precisa
        // ser revisto no console do Firebase — não há o que fazer no cliente.
        if (typeof DEBUG !== 'undefined' && DEBUG) {
          console.log('[rank] servidor rejeitou gravação (verifique teto nas regras do Firestore):', colecao, val, err && err.code);
        }
      });
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[rank] falha ao ler antes de gravar:', err && err.message);
    });
  }

  /* ── Ler o top de um ranking ────────────────────────────────
     Retorna uma Promise com array [{uid, nome, score}], ordenado
     do maior pro menor, limitado a `limite` (default 20).
     Leitura é pública (regra allow read: true), funciona logado ou
     não. */
  function rankLerTop(jogoKey, limite) {
    var db = _rankDb();
    var colecao = RANK_COLECOES[jogoKey];
    if (!db || !colecao) return Promise.resolve([]);
    var n = limite || 20;
    return db.collection(colecao)
      .orderBy('score', 'desc')
      .limit(n)
      .get()
      .then(function (snap) {
        var out = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          out.push({ uid: d.uid || doc.id, nome: d.nome || 'Jogador', score: d.score || 0, photoURL: d.photoURL || '' });
        });
        return out;
      })
      .catch(function (err) {
        if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[rank] erro ao ler:', err && err.message);
        return [];
      });
  }

  /* ── Ler a própria posição/pontuação num ranking ────────────
     Útil para mostrar "sua melhor: X" mesmo que fora do top.
     Retorna Promise<number|null>. */
  function rankMinhaPontuacao(jogoKey) {
    if (typeof _cliUser === 'undefined' || !_cliUser) return Promise.resolve(null);
    var db = _rankDb();
    var colecao = RANK_COLECOES[jogoKey];
    if (!db || !colecao) return Promise.resolve(null);
    return db.collection(colecao).doc(_cliUser.uid).get()
      .then(function (doc) {
        if (!doc.exists) return null;
        var d = doc.data() || {};
        return typeof d.score === 'number' ? d.score : null;
      })
      .catch(function () { return null; });
  }

  /* ── Ranking GERAL (agregado dos 7 jogos) ────────────────────
     Pontuação estilo F1: cada jogo dá pontos pela colocação da
     pessoa no seu próprio Top 20 (1º = 25, 2º = 18 ... 10º = 1,
     11º–20º = 1 de participação). Soma os pontos dos 7 jogos.
     Só enxerga quem está no Top 20 de cada jogo — não faz leitura
     extra por jogador (mantém o custo igual ao das abas de hoje).
     Por isso só entra no geral quem aparece no Top 20 de pelo menos
     RANK_GERAL_MIN_JOGOS jogos diferentes: sem esse piso, alguém
     ótimo em 1 jogo só ficaria bem colocado no geral sem ter
     variado de jogo.
     Retorna Promise<array [{uid, nome, score, photoURL, jogos}]>,
     já ordenada e limitada a `limite`. */
  var RANK_GERAL_MIN_JOGOS = 3;
  var RANK_GERAL_PONTOS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  function _rankGeralPontos(pos) {
    if (pos <= RANK_GERAL_PONTOS.length) return RANK_GERAL_PONTOS[pos - 1];
    return (pos <= 20) ? 1 : 0;
  }

  // Lê o Top 20 dos 7 jogos de uma vez (pra montar o geral e, pra quem
  // abriu o painel, pra ordenar as abas por popularidade — ver
  // rankRenderAbas). Cache: 140 leituras do Firestore por abertura do
  // painel é a operação mais cara do app — 60s (em vez dos 4s originais,
  // que só cobriam duas chamadas quase simultâneas na mesma abertura) corta
  // quase tudo pra quem abre o ranking mais de uma vez seguida (ver A1.24).
  var _rankTopsCache = null, _rankTopsCacheEm = 0;
  function _rankTopsTodosJogos() {
    var agora = Date.now();
    if (_rankTopsCache && (agora - _rankTopsCacheEm) < 60000) return _rankTopsCache;
    _rankTopsCacheEm = agora;
    _rankTopsCache = Promise.all(Object.keys(RANK_COLECOES).map(function (k) {
      return rankLerTop(k, 20).then(function (top) { return { jogo: k, top: top }; });
    }));
    return _rankTopsCache;
  }

  function rankLerGeral(limite) {
    return _rankTopsTodosJogos().then(function (listas) {
      var mapa = {};
      listas.forEach(function (entry) {
        entry.top.forEach(function (item, i) {
          var acc = mapa[item.uid];
          if (!acc) { acc = mapa[item.uid] = { uid: item.uid, nome: item.nome, photoURL: item.photoURL, score: 0, jogos: 0 }; }
          acc.score += _rankGeralPontos(i + 1);
          acc.jogos += 1;
          acc.nome = item.nome; acc.photoURL = item.photoURL;
        });
      });
      return Object.keys(mapa).map(function (uid) { return mapa[uid]; })
        .filter(function (p) { return p.jogos >= RANK_GERAL_MIN_JOGOS; })
        .sort(function (a, b) { return b.score - a.score || b.jogos - a.jogos; })
        .slice(0, limite || 20);
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[rank] erro ao calcular geral:', err && err.message);
      return [];
    });
  }

  // Ordem das abas por popularidade: quantas pessoas aparecem no Top 20
  // de cada jogo (proxy de "quem mais joga" sem precisar contar partidas,
  // que o app não guarda). 'geral' fica sempre primeiro, fixo.
  function _rankOrdemPorPopularidade() {
    return _rankTopsTodosJogos().then(function (listas) {
      var ordenado = listas.slice().sort(function (a, b) { return b.top.length - a.top.length; });
      return ['geral'].concat(ordenado.map(function (e) { return e.jogo; }));
    }).catch(function () { return null; });
  }

  window.rankSubmeter       = rankSubmeter;
  window.rankLerTop         = rankLerTop;
  window.rankMinhaPontuacao = rankMinhaPontuacao;
  window.rankLerGeral       = rankLerGeral;

  /* ══════════════════════════════════════════════════════════════
     UI DO RANKING (Camada 2.4)
     — Renderiza o rank na tela de Joguinhos (lar do rank: 4 rankings
       com abas) e o mini-rank no fim de cada jogo (Opção 3).
     — Usa rankLerTop/rankMinhaPontuacao (módulo da 2.3).
     — Convite pós-jogo: se o jogador NÃO está logado ao terminar,
       mostra um convite para entrar (liga o login sob demanda da
       camada 1).
  ══════════════════════════════════════════════════════════════ */

  // Metadados dos rankings (rótulo amigável + coleção). 'geral' não é uma
  // coleção do Firestore — é o agregado calculado por rankLerGeral().
  var RANK_INFO = {
    geral:           { label: 'Geral',          sub: '',             ico: '🏆' },
    pegacoruja:      { label: 'Pega a Coruja', sub: 'Clássico',      ico: '🦉' },
    pegacoruja_surv: { label: 'Pega a Coruja', sub: 'Sobrevivência', ico: '❤️' },
    relampago:       { label: 'Relâmpago',      sub: '',             ico: '⚡' },
    sequencia:       { label: 'Sequência',      sub: '',             ico: '🧠' },
    voo:             { label: 'Voo da Coruja',   sub: '',            ico: '☁️' },
    corrida:         { label: 'Corrida da Coruja', sub: '',          ico: '🧟' },
    piano:           { label: 'Piano da Coruja',   sub: '',          ico: '🎹' },
    blocos:          { label: 'Blocos da Coruja',  sub: '',          ico: '🧱' },
    doces:           { label: 'Doces da Coruja',   sub: '',          ico: '🍬' },
    '2048':          { label: '2048 da Coruja',    sub: '',          ico: '🔢' }
  };

  var _rankAbaAtual = 'geral';
  // Ordem de exibição das abas: 'geral' sempre primeiro, o resto por
  // popularidade (calculado em _rankOrdemPorPopularidade). Começa null
  // e usa a ordem de RANK_INFO como fallback até a primeira leitura
  // responder — rankAbrirPainel atualiza e re-renderiza em seguida.
  var _rankOrdemAbas = null;

  // Escapa texto do usuário para evitar HTML injection ao montar a lista.
  function _rankEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Abrir o Ranking (tela cheia dentro do hub de Joguinhos) ─
     Antes era um bottom-sheet (modal-rank) por cima do hub. Sobre a
     tela cheia dos jogos aquilo virava "janela colada na janela".
     Agora o ranking é uma TELA do hub, irmã das telas de jogo: mesma
     moldura, mesmo botão voltar, sem overlay — e, vindo do fim de um
     jogo, nem precisa sair da tela cheia nativa. */
  function rankAbrirPainel(jogoKey) {
    var tela = document.getElementById('jogo-ranking');
    if (!tela) return;
    // Chamado de fora do hub (ponte/deep link): abre o hub antes.
    if (typeof _gamesHubAberto === 'function' && !_gamesHubAberto()) {
      if (typeof _abrirGamesHub === 'function') _abrirGamesHub();
    }
    if (typeof _pararJogosExternos === 'function') _pararJogosExternos();
    if (typeof _rlLimparTimers === 'function') _rlLimparTimers();

    // Esconde o menu e as telas de jogo; só o ranking fica visível.
    var menu = document.getElementById('games-menu');
    if (menu) menu.style.display = 'none';
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    // flex (não block): o layout da tela é herói + abas + lista rolável
    // + barra "você" no rodapé, em coluna.
    tela.style.display = 'flex';
    tela.classList.add('rank-open');

    // Mesmo estado das telas de jogo: esconde cabeçalho do hub, ofensiva
    // e o próprio botão de ranking. Mantém a tela cheia nativa se já ativa.
    var hubEl = document.getElementById('games-hub');
    if (hubEl) hubEl.classList.add('jogo-ativo');

    _rankAbaAtual = jogoKey || _rankAbaAtual || 'geral';
    rankRenderAbas();
    rankCarregarAba(_rankAbaAtual);

    // Reordena as abas por popularidade assim que os totais chegarem
    // (a primeira exibição acima já sai instantânea, com a ordem
    // anterior ou a de RANK_INFO — sem esperar rede pra abrir a tela).
    if (typeof _rankOrdemPorPopularidade === 'function') {
      _rankOrdemPorPopularidade().then(function (ordem) {
        if (!ordem) return;
        _rankOrdemAbas = ordem;
        rankRenderAbas();
      });
    }

    if (history.state && history.state.modal !== 'rank') history.pushState({ modal: 'rank' }, '');
    else if (!history.state) history.pushState({ modal: 'rank' }, '');
  }

  function rankFecharPainel(viaPopstate) {
    var tela = document.getElementById('jogo-ranking');
    if (tela) tela.classList.remove('rank-open');
    // Volta pro menu de jogos (esconde todas as .jogo-tela, incl. esta).
    if (typeof _voltarAoMenu === 'function') _voltarAoMenu();
    if (!viaPopstate && history.state?.modal === 'rank') { _popstateNosso = true; history.back(); }
  }

  // Monta as abas (uma por ranking), com ícone do jogo. Ordem: 'geral'
  // primeiro, depois os jogos do mais pro menos jogado (_rankOrdemAbas,
  // calculada em rankAbrirPainel); antes da primeira leitura responder,
  // usa a ordem declarada em RANK_INFO como fallback.
  function rankRenderAbas() {
    var wrap = document.getElementById('rank-abas');
    if (!wrap) return;
    var html = '';
    var chaves = _rankOrdemAbas || Object.keys(RANK_INFO);
    chaves.forEach(function (k) {
      var info = RANK_INFO[k];
      if (!info) return;
      var ativa = (k === _rankAbaAtual) ? ' rank-aba-ativa' : '';
      html += '<button class="rank-aba' + ativa + '" onclick="rankCarregarAba(\'' + k + '\')">' +
                '<span class="rank-aba-ico" aria-hidden="true">' + info.ico + '</span>' +
                '<span class="rank-aba-txt">' + _rankEsc(info.label) +
                  (info.sub ? '<span class="rank-aba-sub">' + _rankEsc(info.sub) + '</span>' : '') +
                '</span>' +
              '</button>';
    });
    wrap.innerHTML = html;
    // Deixa a aba ativa visível na faixa rolável (ex.: ao abrir vindo
    // do fim de um jogo que está lá no fim da lista).
    var at = wrap.querySelector('.rank-aba-ativa');
    if (at && at.scrollIntoView) {
      try { at.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (e) {}
    }
  }

  /* ── Avatar do jogador ───────────────────────────────────────
     O documento do ranking guarda só {uid, nome, score} — não há foto.
     Então geramos um avatar de iniciais com cor derivada do uid: a
     mesma pessoa tem sempre a mesma cor, sem custo de leitura extra.
     Para o próprio usuário, se houver photoURL, usamos a foto real. */
  function _rankCorUid(uid) {
    var s = String(uid || ''), h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;   // FNV-1a: espalha bem mesmo em uids parecidos
    }
    return h % 360;
  }
  function _rankIniciais(nome) {
    var p = String(nome || '?').trim().split(/\s+/);
    var a = p[0] ? p[0].charAt(0) : '?';
    var b = (p.length > 1 && p[p.length - 1]) ? p[p.length - 1].charAt(0) : '';
    return (a + b).toUpperCase();
  }
  function _rankAvatar(item, cls) {
    var souEu = (typeof _cliUser !== 'undefined' && _cliUser && item.uid === _cliUser.uid);
    var foto  = (souEu && _cliUser.photoURL) ? _cliUser.photoURL : (item.photoURL || '');
    var h     = _rankCorUid(item.uid);
    var bg    = 'background:linear-gradient(135deg,hsl(' + h + ',62%,44%),hsl(' + ((h + 42) % 360) + ',58%,28%));';
    if (foto) {
      return '<span class="' + cls + '" style="' + bg + '">' +
               '<img src="' + _rankEsc(foto) + '" alt="" onerror="this.style.display=\'none\'">' +
             '</span>';
    }
    return '<span class="' + cls + '" style="' + bg + '">' + _rankEsc(_rankIniciais(item.nome)) + '</span>';
  }

  /* ── Pódio do top 3 ──────────────────────────────────────────
     Ordem VISUAL 2º · 1º · 3º (o campeão no meio, mais alto), que é
     como as pessoas leem pódio. Com 1 ou 2 jogadores os degraus que
     faltam simplesmente não são desenhados. */
  function _rankPodio(top, meuUid) {
    var ordemVisual = [1, 0, 2];
    var html = '<div class="rank-podio">';
    ordemVisual.forEach(function (i) {
      var it = top[i];
      if (!it) return;
      var pos = i + 1;
      var eu  = (meuUid && it.uid === meuUid);
      var coroa = pos === 1 ? '👑' : (pos === 2 ? '🥈' : '🥉');
      html += '<div class="rank-pod rank-pod-' + pos + (eu ? ' rank-pod-eu' : '') + '">' +
                '<div class="rank-pod-coroa" aria-hidden="true">' + coroa + '</div>' +
                _rankAvatar(it, 'rank-pod-av') +
                '<div class="rank-pod-nome">' + _rankEsc(it.nome) + '</div>' +
                '<div class="rank-pod-tag">' + (eu ? 'você' : '') + '</div>' +
                '<div class="rank-pod-score">' + it.score + '</div>' +
                '<div class="rank-pod-base"><span class="rank-pod-pos">' + pos + 'º</span></div>' +
              '</div>';
    });
    return html + '</div>';
  }

  // Carrega e mostra um ranking específico. jogoKey === 'geral' é o
  // agregado dos 7 jogos (rankLerGeral) — mesma renderização de sempre,
  // só troca a fonte dos dados e mostra "pts" em vez do score bruto.
  function rankCarregarAba(jogoKey) {
    _rankAbaAtual = jogoKey;
    rankRenderAbas();
    var lista = document.getElementById('rank-lista');
    var barra = document.getElementById('rank-eu-barra');
    if (barra) { barra.innerHTML = ''; barra.style.display = 'none'; }
    if (lista) lista.innerHTML = '<div class="rank-loading"><span class="rank-spin"></span>Carregando ranking…</div>';

    if (typeof rankLerTop !== 'function') {
      if (lista) lista.innerHTML = '<div class="rank-vazio"><div class="rank-vazio-tit">Ranking indisponível agora</div>' +
                                   '<div class="rank-vazio-sub">Verifique sua conexão e tente de novo.</div></div>';
      return;
    }

    var ehGeral = (jogoKey === 'geral');
    var meuUid = (typeof _cliUser !== 'undefined' && _cliUser) ? _cliUser.uid : null;
    var leitura = ehGeral ? rankLerGeral(20) : rankLerTop(jogoKey, 20);

    leitura.then(function (top) {
      if (!lista) return;
      // Trocou de aba enquanto carregava: descarta o resultado atrasado.
      if (jogoKey !== _rankAbaAtual) return;
      if (!top || !top.length) {
        lista.innerHTML = '<div class="rank-vazio">' +
            '<img src="/webp/owl-trophy.webp" alt="" class="rank-vazio-owl" onerror="this.style.display=\'none\'">' +
            '<div class="rank-vazio-tit">Ninguém pontuou ainda</div>' +
            '<div class="rank-vazio-sub">' + (ehGeral
              ? 'Jogue pelo menos ' + RANK_GERAL_MIN_JOGOS + ' jogos diferentes pra entrar no geral! 🦉'
              : 'Jogue agora e seja o primeiro do ranking! 🦉') + '</div>' +
          '</div>';
        return;
      }

      // No geral o número é pontos (soma da colocação em cada jogo), não
      // uma pontuação bruta — mostramos com sufixo pra não confundir com
      // metros/notas/etc. dos rankings por jogo.
      var exibir = ehGeral ? top.map(function (t) {
        return { uid: t.uid, nome: t.nome, photoURL: t.photoURL, score: t.score + ' pts' };
      }) : top;

      var html = _rankPodio(exibir, meuUid);
      if (exibir.length > 3) {
        html += '<div class="rank-lista-resto">';
        for (var i = 3; i < exibir.length; i++) {
          var it = exibir[i], pos = i + 1;
          var eu = (meuUid && it.uid === meuUid) ? ' rank-linha-eu' : '';
          html += '<div class="rank-linha' + eu + '">' +
                    '<div class="rank-pos-num">' + pos + '</div>' +
                    _rankAvatar(it, 'rank-av') +
                    '<div class="rank-nome">' + _rankEsc(it.nome) +
                      (eu ? ' <span class="rank-voce">(você)</span>' : '') + '</div>' +
                    '<div class="rank-score">' + it.score + '</div>' +
                  '</div>';
        }
        html += '</div>';
      }
      lista.innerHTML = html;

      // Logado e fora do top 20: a própria posição vira uma barra
      // grudada no rodapé, sempre visível enquanto rola a lista.
      // No geral não lemos as coleções inteiras (só o Top 20 de cada
      // jogo), então não dá pra achar com precisão quem ficou fora do
      // Top 20 do agregado — a barra fica só pras abas por jogo.
      if (meuUid && !ehGeral) {
        var estaNoTop = top.some(function (t) { return t.uid === meuUid; });
        if (!estaNoTop && typeof rankMinhaPontuacao === 'function') {
          rankMinhaPontuacao(jogoKey).then(function (minha) {
            if (minha == null || !barra || jogoKey !== _rankAbaAtual) return;
            var meuNome = (typeof _cliApelido !== 'undefined' && _cliApelido) ||
                          (_cliUser && _cliUser.displayName) || 'Você';
            var rotulo = (top.length >= 20) ? '(fora do top 20)' : '(sua marca)';
            barra.innerHTML = '<div class="rank-linha rank-linha-eu">' +
                '<div class="rank-pos-num">—</div>' +
                _rankAvatar({ uid: meuUid, nome: meuNome }, 'rank-av') +
                '<div class="rank-nome">Você <span class="rank-voce">' + rotulo + '</span></div>' +
                '<div class="rank-score">' + minha + '</div>' +
              '</div>';
            barra.style.display = 'block';
          });
        }
      }
    });
  }

  /* ── Mini-rank no fim de jogo (Opção 3) ─────────────────────
     Preenche o slot de rank dentro da tela de fim do jogo com o
     top 5 + a posição do jogador. Se deslogado, mostra o convite. */
  function rankFimDeJogo(jogoKey, slotId, scoreObtido) {
    var slot = document.getElementById(slotId);
    if (!slot) return;

    var logado = (typeof _cliUser !== 'undefined' && !!_cliUser);

    // Deslogado: convite para entrar (liga o login sob demanda).
    if (!logado) {
      // Guarda a pontuação recém-feita pra re-submeter automaticamente
      // assim que a pessoa logar (senão o recorde jogado deslogado se
      // perdia — rankSubmeter só grava se já houver usuário no fim de jogo).
      _rankPendente = { jogo: jogoKey, score: Math.max(0, Math.round(Number(scoreObtido) || 0)) };
      slot.innerHTML =
        '<div class="rank-fim-convite">' +
          '<img src="/webp/owl-trophy.webp" alt="" class="rank-fim-owl" onerror="this.style.display=\'none\'">' +
          '<div class="rank-fim-txt">Entre para salvar <b>' + (scoreObtido || 0) + '</b> no ranking da cidade!</div>' +
          '<button class="rank-fim-btn" onclick="rankPedirLogin()">Entrar e competir</button>' +
        '</div>';
      slot.style.display = '';
      return;
    }

    // Logado: mostra o top 5 do jogo.
    if (typeof rankLerTop !== 'function') { slot.style.display = 'none'; return; }
    slot.innerHTML = '<div class="rank-loading">Carregando ranking…</div>';
    slot.style.display = '';

    var meuUid = _cliUser.uid;
    rankLerTop(jogoKey, 5).then(function (top) {
      if (!top || !top.length) {
        slot.innerHTML = '<div class="rank-fim-titulo">🏆 Ranking</div>' +
                         '<div class="rank-vazio-mini">Você é o primeiro! 🦉</div>';
        return;
      }
      var html = '<div class="rank-fim-titulo">🏆 Top 5 · ' + _rankEsc(RANK_INFO[jogoKey] ? RANK_INFO[jogoKey].label : 'Ranking') + '</div>';
      top.forEach(function (item, i) {
        var pos = i + 1;
        var medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
        var eu = (item.uid === meuUid) ? ' rank-linha-eu' : '';
        html += '<div class="rank-linha rank-linha-mini' + eu + '">' +
                  '<div class="rank-medal">' + medal + '</div>' +
                  '<div class="rank-nome">' + _rankEsc(item.nome) + (eu ? ' <span class="rank-voce">(você)</span>' : '') + '</div>' +
                  '<div class="rank-score">' + item.score + '</div>' +
                '</div>';
      });
      html += '<button class="rank-fim-vertudo" onclick="rankAbrirPainel(\'' + jogoKey + '\')">Ver ranking completo</button>';
      slot.innerHTML = html;
    });
  }

  // Slot de cada jogo na tela de fim (pra re-renderizar após login).
  var RANK_SLOTS = {
    pegacoruja:      'st-rank-slot',
    pegacoruja_surv: 'st-rank-slot',
    relampago:       'rl-rank-slot',
    sequencia:       'sq-rank-slot',
    voo:             'vo-rank-slot',
    corrida:         'cor-rank-slot',
    piano:           'pn-rank-slot',
    blocos:          'bb-rank-slot',
    doces:           'dc-rank-slot',
    '2048':          't48-rank-slot'
  };
  // Depois que a pessoa loga a partir da tela de fim, troca o convite de
  // login pelo ranking (top 5), já contabilizando a pontuação re-submetida.
  function _rankAtualizarSlotAposLogin(jogoKey, score) {
    var slotId = RANK_SLOTS[jogoKey];
    if (!slotId) return;
    var slot = document.getElementById(slotId);
    // Só atualiza se o slot ainda está visível (a tela de fim continua aberta).
    if (!slot || slot.style.display === 'none') return;
    if (typeof rankFimDeJogo === 'function') rankFimDeJogo(jogoKey, slotId, score);
  }

  window.rankAbrirPainel  = rankAbrirPainel;
  window.rankFecharPainel = rankFecharPainel;
  window.rankCarregarAba  = rankCarregarAba;
  window.rankFimDeJogo    = rankFimDeJogo;

  /* ══════════════════════════════════════════════════════════════
     PONTE DE JOGOS — window.AngatubaGames
     Contrato único entre o app principal e os módulos de jogos que
     serão carregados sob demanda (lazy load) a partir de /jogos/.
     Um módulo externo NÃO acessa variáveis internas do app; fala só
     com esta ponte. Assim o app não precisa conhecer os jogos, e os
     jogos só conhecem este objeto — o que permite, no futuro, mover
     tudo pra um subdomínio sem reescrever os jogos.
  ══════════════════════════════════════════════════════════════ */
  window.AngatubaGames = {
    // Versão do contrato (bump se mudar a forma da ponte).
    versao: 1,

    // ── Rank (Firestore) ────────────────────────────────────
    // Submete uma pontuação (silencioso se deslogado; o Firestore
    // aplica recorde/teto). jogoKey deve existir em RANK_COLECOES.
    rankSubmeter: function (jogoKey, score) {
      if (typeof rankSubmeter === 'function') return rankSubmeter(jogoKey, score);
    },
    // Preenche o mini-rank no fim de jogo (top 5 ou convite de login).
    rankFimDeJogo: function (jogoKey, slotId, score) {
      if (typeof rankFimDeJogo === 'function') return rankFimDeJogo(jogoKey, slotId, score);
    },
    // Abre o painel de ranking completo (abas).
    rankAbrirPainel: function (jogoKey) {
      if (typeof rankAbrirPainel === 'function') return rankAbrirPainel(jogoKey);
    },

    // ── Sessão do cliente ───────────────────────────────────
    // true se há usuário logado (pra decidir convite de login etc.).
    estaLogado: function () {
      return (typeof _cliUser !== 'undefined' && !!_cliUser);
    },
    // Apelido de exibição atual (ou null).
    apelido: function () {
      if (typeof _cliApelido !== 'undefined' && _cliApelido) return _cliApelido;
      if (typeof _cliUser !== 'undefined' && _cliUser && _cliUser.displayName) return _cliUser.displayName;
      return null;
    },
    // Abre o modal de login sob demanda, com uma mensagem opcional.
    abrirLogin: function (motivo) {
      if (typeof cliAbrirLogin === 'function') return cliAbrirLogin(motivo);
    },

    // ── Ofensiva (streak diário) ────────────────────────────
    // Registra atividade do dia (qualquer jogo conta). Retorna true
    // se a ofensiva aumentou nesta chamada.
    registrarOfensiva: function () {
      if (typeof _streakRegistrar === 'function') return _streakRegistrar();
      return false;
    },

    // ── Navegação do hub ────────────────────────────────────
    // Volta ao menu de jogos (para timers/loops do jogo atual).
    voltarAoMenu: function () {
      if (typeof _voltarAoMenu === 'function') return _voltarAoMenu();
    },
    // Caminho base dos assets de jogos (imagens, sons).
    assetsBase: '/Jogos/assets/',

    // ── Som (Web Audio sintetizado) ─────────────────────────
    // Fachada segura: se o módulo de som ainda não carregou (ou
    // o usuário deixou mudo), cada chamada vira no-op. Assim os
    // jogos chamam som.acerto() etc. sem checar existência.
    som: (function () {
      function chamar(m, args) {
        var S = window.AngatubaSom;
        if (S && typeof S[m] === 'function') { try { return S[m].apply(S, args); } catch (e) {} }
      }
      return {
        toque:   function ()   { return chamar('toque', []); },
        acerto:  function ()   { return chamar('acerto', []); },
        combo:   function (n)  { return chamar('combo', [n]); },
        bonus:   function ()   { return chamar('bonus', []); },
        erro:    function ()   { return chamar('erro', []); },
        dano:    function ()   { return chamar('dano', []); },
        nota:    function (i)  { return chamar('nota', [i]); },
        nivelUp: function ()   { return chamar('nivelUp', []); },
        pulo:    function ()   { return chamar('pulo', []); },
        mola:    function ()   { return chamar('mola', []); },
        fim:     function (v)  { return chamar('fim', [v]); },
        ativo:   function ()   { var S = window.AngatubaSom; return S ? S.ativo() : false; }
      };
    })(),

    // ── Efeitos visuais (partículas em canvas) ──────────────
    // Mesma fachada segura: no-op se o módulo não carregou.
    efeitos: {
      confete:  function (alvo, qtd, opcoes) { var E = window.AngatubaEfeitos; if (E) { try { E.confete(alvo, qtd, opcoes); } catch (e) {} } },
      estrelas: function (x, y, qtd, opcoes) { var E = window.AngatubaEfeitos; if (E) { try { E.estrelas(x, y, qtd, opcoes); } catch (e) {} } },
      brilho:   function (alvo)      { var E = window.AngatubaEfeitos; if (E) { try { E.brilho(alvo); } catch (e) {} } },
      // Repassa pro efeitos.js de verdade; sem ele (ainda não carregou,
      // ou falhou), resolve com lista vazia — quem chama já trata isso
      // como "sem sprite" e cai no círculo colorido padrão.
      carregarSprites: function (urls) {
        var E = window.AngatubaEfeitos;
        if (E && E.carregarSprites) return E.carregarSprites(urls);
        return Promise.resolve([]);
      }
    },

    // ── Coruja Party ─────────────────────────────────────────
    // Fachada segura sobre window.AngatubaParty (Jogos/party.js), usada
    // pelos jogos da pool em modo "tela" (speedtap/sequencia/piano) pra
    // saber se estão rodando dentro de uma rodada de Party e reportar o
    // resultado pra lá em vez de seguir o fluxo solo normal. Se o Party
    // ainda não carregou (jogo aberto fora de uma Party), ativo() é
    // sempre false e o jogo segue o fluxo solo de sempre.
    party: {
      ativo: function () { var P = window.AngatubaParty; return !!(P && P.ativo()); },
      reportarResultado: function (score) { var P = window.AngatubaParty; if (P) { try { P.reportarResultado(score); } catch (e) {} } }
    }
  };