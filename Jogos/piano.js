/* ═══════════════════════════════════════════════════════════════
   PIANO DA CORUJA — módulo de jogo (lazy-loaded)
   Piano Tiles clássico: 4 colunas, os azulejos descem e você toca
   sempre no MAIS BAIXO ainda não tocado. Errar a coluna ou deixar
   um azulejo passar pelo rodapé encerra a partida. A velocidade
   sobe junto com a pontuação + combo.

   MÚSICA — sintetizada (Web Audio), zero MP3.
   - Domínio público (clássicos + brasileiras antigas)
   - Originais modernas (estilo phonk/funk/eletrônica) — só notas
     MIDI, sem amostra de terceiros → sem risco de direito autoral.

   Retenção: sistema de combo (visual + leve aceleração), mensagens
   de fim motivadoras e seletor com músicas atuais.

   Fala com o app APENAS via window.AngatubaGames (a ponte).
   Expõe window.PianoGame = { preparar, comecar, parar } e mantém
   window._pnComecar pro onclick inline do botão no HTML.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     MELODIAS
     - Domínio público (clássicos + brasileiras antigas)
     - Originais modernas (estilo phonk / funk / eletrônica)
       criadas só com sequências de notas MIDI — sem amostra,
       sem fonograma, sem risco de direito autoral.

     Cada número é nota MIDI (69 = lá central). O ritmo NÃO vem
     daqui: quem dita o andamento é a velocidade da queda.
     Quando a lista acaba, ela recomeça.
  ══════════════════════════════════════════════════════════════ */
  var _PN_MELODIAS = [
    /* ── Clássicos (domínio público) ─────────────────────────── */
    { nome: 'Für Elise', notas: [
      76,75,76,75,76,71,74,72,69,
      60,64,69,71,64,68,71,72,
      64,76,75,76,75,76,71,74,72,69,
      60,64,69,71,64,72,71,69
    ] },
    { nome: 'Ode à Alegria', notas: [
      64,64,65,67,67,65,64,62,60,60,62,64,64,62,62,
      64,64,65,67,67,65,64,62,60,60,62,64,62,60,60
    ] },
    { nome: 'Marcha Turca', notas: [
      71,69,68,69,72,74,72,71,72,76,
      77,76,75,76,83,81,80,81,83,81,80,81,84,83,81,80,81
    ] },
    { nome: 'Canon in D', notas: [
      78,76,74,73,71,69,71,73,
      74,73,71,69,67,66,67,64,
      62,64,66,67,69,71,73,74
    ] },
    { nome: 'Brilha, Brilha, Estrelinha', notas: [
      60,60,67,67,69,69,67,65,65,64,64,62,62,60,
      67,67,65,65,64,64,62,67,67,65,65,64,64,62,
      60,60,67,67,69,69,67,65,65,64,64,62,62,60
    ] },

    /* ── Brasileiras (domínio público) ───────────────────────── */
    { nome: 'Ó Abre Alas', notas: [
      73,73,72,72,70,73,72,70,69,70,
      73,73,72,72,70,73,72,70,69,70,
      70,70,68,68,66,70,68,68,66,65,
      65,69,72,77,75,77,75,73,72,70
    ] },
    { nome: 'Ciranda, Cirandinha', notas: [
      60,65,65,69,69,72,72,
      70,69,67,72,69,67,65,
      69,72,70,69,67,65,64,60,
      70,67,69,65,67,64,65
    ] },
    { nome: 'O Cravo e a Rosa', notas: [
      67,67,64,72,71,69,67,65,
      69,69,65,72,71,69,67,67,
      67,72,72,72,74,72,71,69,
      69,67,71,67,65,62,60,60
    ] },
    { nome: 'Marcha Soldado', notas: [
      72,72,69,65,65,
      69,72,72,72,69,67,
      67,70,70,70,70,67,72,
      72,74,72,70,69,67,65,
      65,69,72,
      72,69,65,65,
      69,72,72,72,69,67,
      69,70,70,70,67,72,72,
      74,72,70,69,67,65
    ] },
    { nome: 'Peixe Vivo', notas: [
      64,67,67,65,65,69,69,67,
      64,67,67,65,62,65,65,64,
      72,72,69,71,72,71,69,67,72,72,
      69,71,72
    ] },

    /* ── Originais modernas (estilo phonk / funk / eletrônica) ──
       Criadas do zero. Só sequência de notas — livre de direito
       autoral. Feitas pra soar atuais e prender o jogador. */
    { nome: 'Drift Phonk', notas: [
      48,48,55,51,48,55,58,55,
      48,48,55,51,43,48,51,55,
      51,51,58,55,51,58,60,58,
      48,48,55,51,48,55,58,55,
      36,43,48,51,55,51,48,43,
      48,55,58,60,58,55,51,48
    ] },
    { nome: 'Automotivo SP', notas: [
      45,45,52,48,45,52,57,52,
      45,45,52,48,40,45,48,52,
      48,48,55,52,48,55,57,55,
      45,45,52,48,45,52,57,52,
      40,45,48,52,55,52,48,45,
      52,55,57,60,57,55,52,48
    ] },
    { nome: 'Night Drive', notas: [
      50,53,57,50,53,57,60,57,
      50,53,57,62,60,57,53,50,
      45,50,53,57,53,50,45,41,
      50,53,57,50,53,57,60,62,
      57,60,62,65,62,60,57,53,
      50,53,57,53,50,45,41,38
    ] },
    { nome: 'Bass Drop', notas: [
      36,36,43,36,48,43,36,43,
      36,36,43,36,48,51,48,43,
      38,38,45,38,50,45,38,45,
      36,36,43,36,48,43,36,31,
      36,43,48,51,48,43,36,43,
      48,51,55,51,48,43,36,36
    ] },
    { nome: 'Neon Pulse', notas: [
      60,64,67,60,64,67,72,67,
      60,64,67,71,67,64,60,55,
      57,60,64,57,60,64,69,64,
      60,64,67,72,71,67,64,60,
      55,60,64,67,64,60,55,52,
      60,64,67,71,72,71,67,64
    ] },
    { nome: 'Shadow Funk', notas: [
      43,47,50,43,47,50,55,50,
      43,47,50,53,50,47,43,38,
      40,43,47,40,43,47,52,47,
      43,47,50,55,53,50,47,43,
      38,43,47,50,47,43,38,35,
      43,47,50,53,55,53,50,47
    ] },
    { nome: 'Hyper Run', notas: [
      62,65,69,62,65,69,74,69,
      62,65,69,72,69,65,62,57,
      58,62,65,58,62,65,70,65,
      62,65,69,74,72,69,65,62,
      57,62,65,69,65,62,57,53,
      62,65,69,72,74,72,69,65
    ] },
    { nome: 'Low Rider', notas: [
      41,41,48,45,41,48,53,48,
      41,41,48,45,36,41,45,48,
      45,45,52,48,45,52,55,52,
      41,41,48,45,41,48,53,48,
      36,41,45,48,52,48,45,41,
      48,52,55,57,55,52,48,45
    ] }
  ];

  /* ══════════════════════════════════════════════════════════════
     SOM — piano sintetizado em Web Audio.
     Cada nota = triangular na fundamental (o corpo) + senoide na
     oitava (o brilho) + um "martelo" curtíssimo agudo no ataque,
     tudo passando por um passa-baixa pra tirar a aspereza. O
     envelope cai exponencialmente, que é o que faz soar percussivo
     como piano em vez de sustentado como órgão.
     Respeita o mudo global (AngatubaSom.ativo()). O AudioContext
     nasce preguiçoso e é acordado no primeiro toque (iOS/Android).
  ══════════════════════════════════════════════════════════════ */
  var _pnAC = null, _pnMaster = null;

  function _pnSomLigado() {
    var S = window.AngatubaSom;
    if (S && typeof S.ativo === 'function') { try { return !!S.ativo(); } catch (e) { return true; } }
    return true;
  }
  function _pnAudio() {
    if (_pnAC) return _pnAC;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _pnAC = new AC();
      _pnMaster = _pnAC.createGain();
      _pnMaster.gain.value = 0.5;
      _pnMaster.connect(_pnAC.destination);
    } catch (e) { _pnAC = null; }
    return _pnAC;
  }
  function _pnAudioDestravar() {
    var ac = _pnAudio();
    if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
  }
  function _pnFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  // Um oscilador com envelope percussivo. Base de tudo aqui.
  function _pnOsc(ac, destino, t, tipo, freq, vol, dur) {
    var o = ac.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function _pnTocarNota(midi) {
    if (!_pnSomLigado()) return;
    var ac = _pnAudio(); if (!ac) return;
    var t = ac.currentTime, f = _pnFreq(midi);
    var lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.9);
    lp.connect(_pnMaster);
    _pnOsc(ac, lp, t, 'triangle', f, 0.42, 1.15);        // corpo
    _pnOsc(ac, lp, t, 'sine', f * 2, 0.14, 0.60);        // oitava (brilho)
    _pnOsc(ac, lp, t, 'sine', f * 4, 0.05, 0.09);        // martelo do ataque
  }

  /* ══════════════════════════════════════════════════════════════
     BATIDA — bumbo, caixa e chimbal sintetizados, rodando por
     baixo das notas. É percussão pura, sem nota afinada, de
     propósito: assim ela combina com qualquer uma das melodias sem
     brigar com a tonalidade (as dez estão em tons diferentes).

     O andamento acompanha o jogo, mas NÃO na mesma proporção: a
     esteira vai de 1,8 a 7,5 linhas/s, e amarrar a batida nisso
     daria 450 BPM no fim. Em vez disso mapeamos o progresso da
     velocidade para 100-160 BPM, que é faixa de música de verdade.

     O disparo é feito no loop de vídeo (requestAnimationFrame), não
     por agendamento no relógio do áudio. Dá um jitter de ~16ms, que
     seria inaceitável numa base de ritmo, mas aqui é percussão de
     fundo e o custo é bem menor que manter um agendador com fila.
  ══════════════════════════════════════════════════════════════ */
  var _PN_BAT_KEY = 'angatuba_piano_batida';
  var _PN_BPM_MIN = 100, _PN_BPM_MAX = 160;
  var _pnBatOn = null;                  // null = ainda não lido do storage
  var _pnBatMaster = null, _pnRuidoBuf = null;
  var _pnBatFase = 0, _pnBatStep = -1;

  function _pnBatidaAtiva() {
    if (_pnBatOn === null) {
      try { _pnBatOn = localStorage.getItem(_PN_BAT_KEY) !== '0'; }
      catch (e) { _pnBatOn = true; }
    }
    return _pnBatOn;
  }
  function _pnBatidaBotao() {
    var b = document.getElementById('pn-batida-btn');
    if (!b) return;
    var on = _pnBatidaAtiva();
    if (on) b.classList.remove('off'); else b.classList.add('off');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function _pnAlternarBatida() {
    _pnBatOn = !_pnBatidaAtiva();
    try { localStorage.setItem(_PN_BAT_KEY, _pnBatOn ? '1' : '0'); } catch (e) {}
    if (_pnBatOn) _pnAudioDestravar();
    _pnBatidaBotao();
  }

  // Saída própria da percussão, mais baixa que o piano: a melodia
  // é a protagonista, a batida só empurra.
  function _pnBatSaida(ac) {
    if (!_pnBatMaster) {
      _pnBatMaster = ac.createGain();
      _pnBatMaster.gain.value = 0.32;
      _pnBatMaster.connect(ac.destination);
    }
    return _pnBatMaster;
  }
  // Meio segundo de ruído branco, gerado uma vez e reaproveitado —
  // criar buffer a cada chimbal cansaria o GC no Android fraco.
  function _pnRuido(ac) {
    if (_pnRuidoBuf) return _pnRuidoBuf;
    var n = Math.floor(ac.sampleRate * 0.5);
    var buf = ac.createBuffer(1, n, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    _pnRuidoBuf = buf;
    return buf;
  }
  function _pnPercussao(ac, t, dur, vol, tipoFiltro, freq, q) {
    var src = ac.createBufferSource();
    src.buffer = _pnRuido(ac);
    var f = ac.createBiquadFilter();
    f.type = tipoFiltro; f.frequency.value = freq;
    if (q) f.Q.value = q;
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(_pnBatSaida(ac));
    src.start(t, Math.random() * 0.4, dur + 0.03);
    src.stop(t + dur + 0.04);
  }
  function _pnBumbo(ac, t) {
    var o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.10);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.95, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(_pnBatSaida(ac));
    o.start(t); o.stop(t + 0.25);
  }
  function _pnCaixa(ac, t) {
    _pnPercussao(ac, t, 0.14, 0.55, 'bandpass', 1900, 0.8);
    var o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.30, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(_pnBatSaida(ac));
    o.start(t); o.stop(t + 0.11);
  }
  function _pnChimbal(ac, t, aberto) {
    _pnPercussao(ac, t, aberto ? 0.22 : 0.045, aberto ? 0.20 : 0.26, 'highpass', 7200);
  }

  // Grade de 16 semicolcheias: bumbo nos quatro tempos, caixa em 2
  // e 4, chimbal no contratempo (o "tss" entre os bumbos) e um
  // chimbal aberto no fim do compasso pra puxar o próximo.
  function _pnBaterStep(ac, t, passo) {
    if (passo % 4 === 0) _pnBumbo(ac, t);
    if (passo === 4 || passo === 12) _pnCaixa(ac, t);
    if (passo % 4 === 2) _pnChimbal(ac, t, passo === 14);
  }

  function _pnBatidaPasso(dt) {
    if (!_pnBatidaAtiva() || !_pnSomLigado()) return;
    var ac = _pnAudio();
    if (!ac || ac.state !== 'running') return;
    var prog = (_pnVel - _PN_VEL_INI) / (_PN_VEL_MAX - _PN_VEL_INI);
    if (prog < 0) prog = 0; else if (prog > 1) prog = 1;
    var bpm = _PN_BPM_MIN + (_PN_BPM_MAX - _PN_BPM_MIN) * prog;
    _pnBatFase += dt * (bpm / 60) * 4;
    // O teto de 8 evita rajada de percussão quando a aba volta do
    // segundo plano com um dt gigante acumulado.
    var guarda = 0;
    while (_pnBatFase >= 1 && guarda++ < 8) {
      _pnBatFase -= 1;
      _pnBatStep = (_pnBatStep + 1) % 16;
      _pnBaterStep(ac, ac.currentTime, _pnBatStep);
    }
    if (_pnBatFase >= 1) _pnBatFase = 0;
  }

  function _pnSomErro() {
    if (!_pnSomLigado()) return;
    var ac = _pnAudio(); if (!ac) return;
    var t = ac.currentTime;
    var o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.45);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.30, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(_pnMaster);
    o.start(t); o.stop(t + 0.54);
  }

  /* ── Estado / canvas ──────────────────────────────────────────
     TRUQUE DE COORDENADA: a posição vertical dos azulejos (y) é
     guardada em UNIDADES DE LINHA, não em pixels — a tela tem 4
     linhas de altura, então y=3 é a linha de baixo e y=-1 é a que
     acabou de nascer acima do topo. Assim girar o celular ou mudar
     o tamanho do canvas não bagunça nada: só o fator de conversão
     (altura de uma linha em px) muda.
  ─────────────────────────────────────────────────────────────── */
  var _PN_COLS = 4;          // colunas
  var _PN_LINHAS_TELA = 4;   // linhas visíveis (define a altura da linha)

  var _pnCanvas = null, _pnCtx = null;
  var _pnW = 320, _pnH = 560, _pnDpr = 1;
  var _pnEstado = 'inicio';           // 'inicio' | 'jogando' | 'fim'
  var _pnRAF = 0, _pnLast = 0;
  var _pnListenersOn = false, _pnResizeOn = false;

  var _pnAzulejos = [];      // [0] é sempre o mais baixo
  var _pnMovendo = false;    // só anda depois do primeiro toque certo
  var _pnPontos = 0;
  var _pnVel = 0;            // em linhas por segundo
  var _PN_VEL_INI = 1.8, _PN_VEL_MAX = 7.8, _PN_VEL_ACC = 0.052;
  var _pnMelodia = null;
  var _pnOndas = [];         // ripples do toque certo
  var _pnCombo = 0;          // acertos seguidos (retenção)
  var _pnComboMax = 0;       // maior combo da partida
  var _pnComboFlash = 0;     // tempo restante do texto de combo na tela

  /* ══════════════════════════════════════════════════════════════
     MODOS
       'sobrevivencia' — o original: acelera sem parar, errar a
         coluna ou deixar passar encerra. É o que vale ranking.
       'normal' — a música do começo ao fim num ritmo fixo e
         confortável. Errar não encerra: conta como erro e segue.
         A partida acaba quando a melodia termina, e o resultado é
         quantas notas você acertou de quantas. Não vai pro ranking
         de propósito — num modo onde não dá pra perder, tabela de
         recorde não significa nada (todo mundo empataria no total
         de notas da música).
     A nota de cada azulejo é decidida no NASCIMENTO dele, não na
     hora do toque. Sem isso, uma nota perdida no modo Normal
     empurraria a melodia inteira pra trás e a música sairia torta.
  ══════════════════════════════════════════════════════════════ */
  var _PN_VEL_NORMAL = 2.2;      // ritmo fixo do modo Normal
  var _PN_MIN_AZULEJOS = 48;     // piso de partida: melodia curta repete
  var _pnModo = 'sobrevivencia';
  var _pnTotalAzulejos = 0;      // 0 = fila infinita (sobrevivência)
  var _pnCriados = 0;            // quantos já nasceram = índice da nota
  var _pnErros = 0, _pnPerdidas = 0;
  var _pnFlashErro = 0, _pnColErro = -1;   // brilho vermelho ao errar

  /* ── Persistência ─────────────────────────────────────────────
     Cacheado em memória: o HUD lia localStorage a cada frame nos
     jogos antigos e isso sozinho engasgava Android fraco. */
  var _PN_REC_KEY = 'angatuba_piano_rec';
  var _pnRecCache = null;
  function _pnRec() {
    if (_pnRecCache !== null) return _pnRecCache;
    try { _pnRecCache = Math.max(0, Math.round(Number(localStorage.getItem(_PN_REC_KEY)) || 0)); }
    catch (e) { _pnRecCache = 0; }
    return _pnRecCache;
  }
  function _pnRecSet(v) {
    _pnRecCache = Math.round(v);
    try { localStorage.setItem(_PN_REC_KEY, String(_pnRecCache)); } catch (e) {}
  }

  /* ── HUD (só escreve quando o valor muda) ─────────────────────── */
  var _pnElPontos = null, _pnElRec = null, _pnElRot = null, _pnElMusica = null;
  var _pnHudUlt = { p: -1, r: -1, rot: '', m: '' };
  function _pnAtualizarHUD(forcar) {
    if (forcar || !_pnElPontos) {
      _pnElPontos = document.getElementById('pn-pontos');
      _pnElRec    = document.getElementById('pn-recorde');
      _pnElRot    = document.getElementById('pn-rotulo2');
      _pnElMusica = document.getElementById('pn-musica');
    }
    if (_pnElPontos && (forcar || _pnPontos !== _pnHudUlt.p)) { _pnElPontos.textContent = _pnPontos; _pnHudUlt.p = _pnPontos; }
    // O segundo quadro troca de sentido conforme o modo: mostrar
    // recorde de sobrevivência durante uma partida tranquila só
    // confunde, porque não é isso que está em jogo ali.
    var normal = (_pnModo === 'normal');
    var rv  = normal ? _pnErros : _pnRec();
    var rot = normal ? 'Erros' : 'Recorde';
    if (_pnElRec && (forcar || rv !== _pnHudUlt.r)) { _pnElRec.textContent = rv; _pnHudUlt.r = rv; }
    if (_pnElRot && (forcar || rot !== _pnHudUlt.rot)) { _pnElRot.textContent = rot; _pnHudUlt.rot = rot; }
    var mn = _pnMelodia ? _pnMelodia.nome : '—';
    if (_pnElMusica && (forcar || mn !== _pnHudUlt.m)) { _pnElMusica.textContent = mn; _pnHudUlt.m = mn; }
  }

  /* ── Dimensionamento ──────────────────────────────────────────── */
  function _pnDimensionar() {
    if (!_pnCanvas) return;
    var cssW = _pnCanvas.offsetWidth || 320;
    var cssH = _pnCanvas.offsetHeight || 560;
    if (cssW < 2) cssW = 320;
    if (cssH < 2) cssH = 560;
    _pnDpr = Math.min(2, window.devicePixelRatio || 1);
    _pnCanvas.width = Math.round(cssW * _pnDpr);
    _pnCanvas.height = Math.round(cssH * _pnDpr);
    _pnW = cssW; _pnH = cssH;
    if (_pnCtx) _pnCtx.setTransform(_pnDpr, 0, 0, _pnDpr, 0, 0);
  }
  function _pnLinhaH() { return _pnH / _PN_LINHAS_TELA; }
  function _pnColW() { return _pnW / _PN_COLS; }

  /* ── Geração dos azulejos ─────────────────────────────────────
     Uma coluna por linha. Evitamos três seguidas na mesma coluna:
     sem isso o jogo vira um botão só e perde a graça. */
  function _pnSortearCol() {
    var n = _pnAzulejos.length;
    var col = (Math.random() * _PN_COLS) | 0;
    if (n >= 2) {
      var a = _pnAzulejos[n - 1].col, b = _pnAzulejos[n - 2].col;
      if (a === b && col === a) col = (col + 1 + ((Math.random() * (_PN_COLS - 1)) | 0)) % _PN_COLS;
    }
    return col;
  }
  function _pnNovoAzulejo(y) {
    return { col: _pnSortearCol(), y: y, tocada: false, flash: 0, nota: _pnCriados++ };
  }
  // Ainda cabe mais um na fila? No Normal a fila tem fim (o tamanho
  // da música); na Sobrevivência, não.
  function _pnCabeMais() {
    return !_pnTotalAzulejos || _pnCriados < _pnTotalAzulejos;
  }

  // Melodia da partida: a escolhida no seletor, ou sorteada.
  function _pnEscolherMelodia() {
    var sel = document.getElementById('pn-musica-sel');
    var i = sel ? parseInt(sel.value, 10) : -1;
    if (!(i >= 0 && i < _PN_MELODIAS.length)) i = (Math.random() * _PN_MELODIAS.length) | 0;
    return _PN_MELODIAS[i];
  }

  /* ── Reset ────────────────────────────────────────────────────── */
  function _pnReset(modo) {
    _pnModo = (modo === 'normal') ? 'normal' : 'sobrevivencia';
    _pnAzulejos.length = 0;
    _pnOndas.length = 0;
    _pnPontos = 0; _pnErros = 0; _pnPerdidas = 0;
    _pnCriados = 0;
    _pnFlashErro = 0; _pnColErro = -1;
    _pnCombo = 0; _pnComboMax = 0; _pnComboFlash = 0;
    _pnMovendo = false;
    _pnBatFase = 0; _pnBatStep = -1;   // próximo passo será o 0 (bumbo)
    _pnMelodia = _pnEscolherMelodia();
    if (_pnModo === 'normal') {
      _pnVel = _PN_VEL_NORMAL;
      // Melodia curta repete até dar uma partida de duração decente —
      // Für Elise com 34 notas acabaria em 15 segundos.
      var n = _pnMelodia.notas.length;
      _pnTotalAzulejos = n * Math.max(1, Math.ceil(_PN_MIN_AZULEJOS / n));
    } else {
      _pnVel = _PN_VEL_INI;
      _pnTotalAzulejos = 0;
    }
    // Preenche a tela de baixo pra cima + uma folga acima do topo.
    for (var i = 0; i < _PN_LINHAS_TELA + 2 && _pnCabeMais(); i++) {
      _pnAzulejos.push(_pnNovoAzulejo(_PN_LINHAS_TELA - 1 - i));
    }
    _pnAtualizarHUD(true);
  }

  /* ── Alvo ─────────────────────────────────────────────────────
     O azulejo que o jogador tem que acertar agora: o pendente mais
     baixo QUE JÁ ENTROU NA TELA. A segunda metade da frase é o que
     segura o jogo em pé — sem ela dava pra sair martelando a fila
     inteira, inclusive os azulejos que ainda estavam acima do topo,
     e a partida virava spam de toque. Com o corte, dá pra adiantar
     no máximo o que está visível, exatamente como no original. */
  function _pnAlvo() {
    for (var i = 0; i < _pnAzulejos.length; i++) {
      if (_pnAzulejos[i].tocada) continue;
      return (_pnAzulejos[i].y > -1) ? _pnAzulejos[i] : null;
    }
    return null;
  }

  /* ── Toque ────────────────────────────────────────────────────
     Acertar a COLUNA do alvo basta (não precisa mirar a altura
     exata) — é assim que o Piano Tiles original funciona e é o que
     dá o toque rápido de polegar no celular. Tocar com a fila
     visível toda limpa não pune: só não faz nada. */
  function _pnTocar(clientX, clientY) {
    if (_pnEstado !== 'jogando') return;
    if (!_pnCanvas) return;
    var r = _pnCanvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var x = clientX - r.left;
    if (x < 0 || x > r.width) return;
    var col = Math.floor((x / r.width) * _PN_COLS);
    if (col < 0) col = 0; if (col >= _PN_COLS) col = _PN_COLS - 1;

    var alvo = _pnAlvo();
    if (!alvo) return;

    if (col !== alvo.col) {
      // No Normal errar não encerra: marca o erro, pisca a coluna e
      // o azulejo continua lá esperando o toque certo.
      if (_pnModo === 'normal') {
        _pnErros++;
        _pnCombo = 0;
        _pnFlashErro = 1; _pnColErro = col;
        _pnSomErro();
        _pnAtualizarHUD();
        return;
      }
      _pnGameOver('errou');
      return;
    }

    alvo.tocada = true;
    alvo.flash = 1;
    _pnPontos++;
    _pnCombo++;
    if (_pnCombo > _pnComboMax) _pnComboMax = _pnCombo;
    if (_pnCombo >= 5) _pnComboFlash = 1.1;   // mostra o texto por ~1s
    _pnMovendo = true;                 // a queda só começa no 1º acerto
    if (_pnModo !== 'normal') {
      // Acelera um pouco mais forte em combo alto (retenção)
      var extra = Math.min(0.8, (_pnCombo / 40) * 0.4);
      _pnVel = Math.min(_PN_VEL_MAX, _PN_VEL_INI + _pnPontos * _PN_VEL_ACC + extra);
    }

    var notas = _pnMelodia.notas;
    _pnTocarNota(notas[alvo.nota % notas.length]);

    var lh = _pnLinhaH(), cw = _pnColW();
    _pnOndas.push({
      x: (alvo.col + 0.5) * cw,
      y: (alvo.y + 0.5) * lh,
      t: 0
    });
    _pnAtualizarHUD();
  }

  /* ── Update ───────────────────────────────────────────────────── */
  function _pnUpdate(dt) {
    var i;
    for (i = 0; i < _pnAzulejos.length; i++) {
      if (_pnAzulejos[i].flash > 0) _pnAzulejos[i].flash = Math.max(0, _pnAzulejos[i].flash - dt * 4);
    }
    if (_pnFlashErro > 0) _pnFlashErro = Math.max(0, _pnFlashErro - dt * 3);
    if (_pnComboFlash > 0) _pnComboFlash = Math.max(0, _pnComboFlash - dt);
    for (i = _pnOndas.length - 1; i >= 0; i--) {
      _pnOndas[i].t += dt;
      if (_pnOndas[i].t > 0.4) _pnOndas.splice(i, 1);
    }
    if (!_pnMovendo) return;
    _pnBatidaPasso(dt);   // só toca depois do 1º acerto, junto com a queda

    var avanco = _pnVel * dt;
    for (i = 0; i < _pnAzulejos.length; i++) _pnAzulejos[i].y += avanco;
    for (i = 0; i < _pnOndas.length; i++) _pnOndas[i].y += avanco * _pnLinhaH();

    // Saiu por baixo? Na Sobrevivência isso encerra; no Normal só
    // conta como nota perdida e a música segue.
    while (_pnAzulejos.length && _pnAzulejos[0].y >= _PN_LINHAS_TELA) {
      if (!_pnAzulejos[0].tocada) {
        if (_pnModo !== 'normal') { _pnGameOver('passou'); return; }
        _pnPerdidas++;
      }
      _pnAzulejos.shift();
    }
    // Repõe em cima. Na Sobrevivência a fila nunca acaba; no Normal
    // ela para quando a música termina — e quando o último azulejo
    // sai da tela, a partida acabou.
    var topo = _pnAzulejos.length ? _pnAzulejos[_pnAzulejos.length - 1].y : 0;
    while (topo > -2 && _pnCabeMais()) {
      topo -= 1;
      _pnAzulejos.push(_pnNovoAzulejo(topo));
    }
    if (_pnModo === 'normal' && !_pnAzulejos.length && !_pnCabeMais()) {
      _pnGameOver('completou');
    }
  }

  /* ── Render ───────────────────────────────────────────────────── */
  function _pnRoundRect(ctx, x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function _pnDraw() {
    if (!_pnCtx) return;
    var ctx = _pnCtx, W = _pnW, H = _pnH;
    var lh = _pnLinhaH(), cw = _pnColW();

    // Fundo + trilhos das colunas
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (var c = 1; c < _PN_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, H);
      ctx.stroke();
    }

    // Qual é o próximo a tocar (ganha contorno de dica)
    var alvo = _pnAlvo(), i;

    var pad = Math.max(2, cw * 0.03);
    var raio = Math.min(cw, lh) * 0.14;

    for (i = 0; i < _pnAzulejos.length; i++) {
      var az = _pnAzulejos[i];
      var y = az.y * lh;
      if (y > H || y + lh < 0) continue;          // fora da tela
      var x = az.col * cw;
      var bx = x + pad, by = y + pad, bw = cw - pad * 2, bh = lh - pad * 2;

      if (az.tocada) {
        // Tocado: esverdeado, esmaecendo conforme desce. Cor sólida
        // (sem gradiente) — com ~8 azulejos visíveis, criar um
        // CanvasGradient por azulejo A CADA FRAME (60x/s) gera muito
        // lixo de memória e engasga o jogo periodicamente (GC) em
        // Android mais fraco. Uma cor só, recalculada por número, é
        // igual de viva no efeito de flash e não aloca nada extra.
        var f = az.flash;
        ctx.fillStyle = 'rgba(33,166,123,' + (0.13 + f * 0.475) + ')';
        _pnRoundRect(ctx, bx, by, bw, bh, raio); ctx.fill();
      } else {
        // Idem: era gradiente #ff4d63→#c81e3c recriado por azulejo
        // por frame; agora é o tom médio fixo, sem alocação.
        ctx.fillStyle = '#e3354f';
        _pnRoundRect(ctx, bx, by, bw, bh, raio); ctx.fill();
        if (az === alvo) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = Math.max(2, cw * 0.022);
          _pnRoundRect(ctx, bx, by, bw, bh, raio); ctx.stroke();
        }
      }
    }

    // Coluna que o jogador errou (só acontece no Normal, onde errar
    // não encerra — precisa de um retorno visual no lugar do fim).
    if (_pnFlashErro > 0 && _pnColErro >= 0) {
      ctx.fillStyle = 'rgba(255,60,80,' + (_pnFlashErro * 0.20) + ')';
      ctx.fillRect(_pnColErro * cw, 0, cw, H);
    }

    // Ondas do acerto
    for (i = 0; i < _pnOndas.length; i++) {
      var on = _pnOndas[i];
      var p = on.t / 0.4;
      ctx.globalAlpha = (1 - p) * 0.55;
      ctx.strokeStyle = '#8ffdd6';
      ctx.lineWidth = Math.max(1.5, cw * 0.03) * (1 - p);
      ctx.beginPath();
      ctx.arc(on.x, on.y, cw * (0.15 + p * 0.55), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Combo na tela (retenção): aparece a partir de 5 e some sozinho
    if (_pnEstado === 'jogando' && _pnComboFlash > 0 && _pnCombo >= 5) {
      var alpha = Math.min(1, _pnComboFlash * 1.4);
      var escala = 1 + Math.min(0.35, (_pnCombo - 5) * 0.012);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var fs = Math.round(Math.min(W, H) * 0.09 * escala);
      ctx.font = '800 ' + fs + "px 'Syne','DM Sans',sans-serif";
      ctx.fillStyle = _pnCombo >= 20 ? '#ffd54a' : (_pnCombo >= 10 ? '#8ffdd6' : '#ffffff');
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 10;
      ctx.fillText(_pnCombo + ' COMBO', W / 2, H * 0.22);
      if (_pnCombo >= 15) {
        ctx.font = '700 ' + Math.round(fs * 0.38) + "px 'DM Sans',sans-serif";
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(_pnCombo >= 30 ? 'INSANO 🔥' : (_pnCombo >= 20 ? 'FOGO 🔥' : 'BOA!'), W / 2, H * 0.22 + fs * 0.7);
      }
      ctx.restore();
    }

    // Antes do primeiro toque: dica de onde começar.
    if (_pnEstado === 'jogando' && !_pnMovendo && alvo) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '700 ' + Math.round(Math.min(W, H) * 0.045) + "px 'DM Sans',sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('Toque no azulejo marcado pra começar', W / 2, H - lh * 0.28);
      ctx.textAlign = 'left';
    }
  }

  /* ── Loop ─────────────────────────────────────────────────────── */
  function _pnLoop(ts) {
    if (_pnEstado !== 'jogando') return;
    if (!_pnLast) _pnLast = ts;
    var dt = (ts - _pnLast) / 1000; _pnLast = ts;
    if (dt > 0.05) dt = 0.05;
    _pnUpdate(dt);
    if (_pnEstado === 'jogando') { _pnDraw(); _pnRAF = requestAnimationFrame(_pnLoop); }
  }

  /* ── Fim de jogo ──────────────────────────────────────────────── */
  function _pnGameOver(motivo) {
    if (_pnRAF) { cancelAnimationFrame(_pnRAF); _pnRAF = 0; }
    _pnEstado = 'fim';
    _pnMovendo = false;
    _pnDraw();

    var owlEl = document.getElementById('pn-fim-owl');
    var titEl = document.getElementById('pn-fim-titulo');
    var ptsEl = document.getElementById('pn-fim-pontos');
    var msgEl = document.getElementById('pn-fim-msg');
    var slot  = document.getElementById('pn-rank-slot');

    /* ── Modo Normal: fim de música, não fim de jogo ──────────────
       Nada de recorde local, nada de ranking e nada de som de erro:
       o jogador chegou ao fim da música, isso não é derrota. */
    if (_pnModo === 'normal') {
      var total = _pnPontos + _pnPerdidas;
      var perfeito = (_pnPerdidas === 0 && _pnErros === 0);
      if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(perfeito);
      if (owlEl) { owlEl.src = perfeito ? '/webp/owl-celebrate-flying.webp' : '/webp/owl-thumbsup.webp'; owlEl.style.display = ''; }
      if (titEl) titEl.textContent = perfeito ? '🎵 Tocou sem errar!' : '🎵 Fim da música!';
      if (ptsEl) ptsEl.textContent = _pnPontos + ' de ' + total + ' notas';
      var comboExtra = _pnComboMax >= 8 ? ' Combo máximo: ' + _pnComboMax + '.' : '';
      if (msgEl) msgEl.textContent = perfeito
        ? (_pnMelodia.nome + ' inteirinha, nota por nota. 🦉' + comboExtra)
        : (_pnErros > 0 ? 'Você tocou ' + _pnMelodia.nome + ' com ' + _pnErros + (_pnErros === 1 ? ' erro' : ' erros') + '.' + comboExtra + ' Sem pressa, tenta de novo!'
                        : 'Você tocou ' + _pnMelodia.nome + '.' + comboExtra + ' Sem pressa, tenta de novo!');
      if (slot) { slot.style.display = 'none'; slot.innerHTML = ''; }
      _pnMostrarOverlay('fim');
      _pnAtualizarHUD(true);
      if (perfeito && window.AngatubaGames && window.AngatubaGames.efeitos) window.AngatubaGames.efeitos.confete('pn-fim', 90);
      return;
    }

    /* ── Sobrevivência: é aqui que vale recorde e ranking ─────────── */
    var score = _pnPontos, rec = _pnRec(), recorde = score > rec;
    if (recorde) _pnRecSet(score);
    _pnSomErro();
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(recorde);
    if (window.AngatubaGames) window.AngatubaGames.rankSubmeter('piano', score);

    if (owlEl) { owlEl.src = recorde ? '/webp/owl-celebrate-flying.webp' : '/webp/owl-surprised.webp'; owlEl.style.display = ''; }
    if (titEl) titEl.textContent = recorde ? '🎉 Novo recorde!' : (motivo === 'passou' ? 'Deixou passar!' : 'Nota errada!');
    if (ptsEl) ptsEl.textContent = score + (score === 1 ? ' nota' : ' notas');
    var comboTxt = _pnComboMax >= 10 ? ' Melhor combo: ' + _pnComboMax + '!' : '';
    if (msgEl) msgEl.textContent = recorde ? ('Você nunca tocou tão longe! 🦉' + comboTxt)
      : (rec > 0 ? 'Seu recorde: ' + rec + '.' + comboTxt + ' Bora de novo?' : 'Toque sempre no azulejo mais baixo!' + comboTxt);
    _pnMostrarOverlay('fim');
    _pnAtualizarHUD(true);
    if (recorde && window.AngatubaGames && window.AngatubaGames.efeitos) window.AngatubaGames.efeitos.confete('pn-fim', 90);
    if (window.AngatubaGames) window.AngatubaGames.rankFimDeJogo('piano', 'pn-rank-slot', score);
  }

  /* ── Controles ────────────────────────────────────────────────
     touchstart percorre TODOS os changedTouches: com dois polegares
     dá pra encadear dois azulejos no mesmo frame, e é isso que
     permite pontuação alta. Um listener só no primeiro dedo comeria
     o segundo toque. */
  function _pnTouchStart(e) {
    _pnAudioDestravar();
    if (_pnEstado !== 'jogando') return;
    var t = e.changedTouches;
    for (var i = 0; i < t.length; i++) {
      _pnTocar(t[i].clientX, t[i].clientY);
      if (_pnEstado !== 'jogando') break;   // acabou no meio da leva
    }
    if (e.cancelable) e.preventDefault();
  }
  function _pnMouseDown(e) {
    _pnAudioDestravar();
    if (_pnEstado !== 'jogando') return;
    _pnTocar(e.clientX, e.clientY);
    if (e.cancelable) e.preventDefault();
  }
  function _pnKey(e) {
    if (_pnEstado !== 'jogando' || !_pnCanvas) return;
    var mapa = { '1': 0, '2': 1, '3': 2, '4': 3,
                 'a': 0, 's': 1, 'd': 2, 'f': 3,
                 'ArrowLeft': 0, 'ArrowDown': 1, 'ArrowUp': 2, 'ArrowRight': 3 };
    var k = e.key, col = mapa[k];
    if (col === undefined && k) col = mapa[k.toLowerCase()];
    if (col === undefined) return;
    _pnAudioDestravar();
    var r = _pnCanvas.getBoundingClientRect();
    _pnTocar(r.left + (col + 0.5) * (r.width / _PN_COLS), r.top + r.height * 0.5);
    if (e.preventDefault) e.preventDefault();
  }
  function _pnLigarControles() {
    if (_pnListenersOn || !_pnCanvas) return;
    _pnCanvas.addEventListener('touchstart', _pnTouchStart, { passive: false });
    _pnCanvas.addEventListener('mousedown', _pnMouseDown);
    _pnCanvas.__pnKD = function (e) { _pnKey(e); };
    window.addEventListener('keydown', _pnCanvas.__pnKD);
    _pnListenersOn = true;
  }

  /* ── Overlays ─────────────────────────────────────────────────── */
  function _pnMostrarOverlay(qual) {
    var ini = document.getElementById('pn-inicio');
    var fim = document.getElementById('pn-fim');
    if (ini) ini.style.display = (qual === 'inicio') ? '' : 'none';
    if (fim) fim.style.display = (qual === 'fim') ? '' : 'none';
  }

  /* ── Tela parada (antes de começar) ───────────────────────────── */
  function _pnDrawIdle() {
    if (!_pnCtx) return;
    _pnDimensionar();
    if (!_pnAzulejos.length) {
      for (var i = 0; i < _PN_LINHAS_TELA + 2; i++) _pnAzulejos.push(_pnNovoAzulejo(_PN_LINHAS_TELA - 1 - i));
    }
    _pnDraw();
  }

  /* ── Ciclo de vida ────────────────────────────────────────────── */
  function _pnPreparar() {
    _pnCanvas = document.getElementById('pn-canvas');
    if (!_pnCanvas) return;
    _pnCtx = _pnCanvas.getContext('2d');
    _pnLigarControles();
    if (!_pnResizeOn) {
      var reaval = function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _pnDimensionar();
          if (_pnEstado !== 'jogando') _pnDrawIdle(); else _pnDraw();
        }
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', reaval);
      _pnResizeOn = true;
    }
    _pnEstado = 'inicio';
    _pnPontos = 0;
    if (!_pnMelodia) _pnMelodia = _PN_MELODIAS[(Math.random() * _PN_MELODIAS.length) | 0];
    _pnMontarSeletor();
    _pnAtualizarHUD(true);
    _pnBatidaBotao();
    _pnMostrarOverlay('inicio');
    _pnDrawIdle();
  }

  // Preenche o seletor de música a partir da própria lista de
  // melodias — assim acrescentar uma nota nova no array já a coloca
  // no seletor, sem tocar no HTML.
  function _pnMontarSeletor() {
    var sel = document.getElementById('pn-musica-sel');
    if (!sel || sel.options.length) return;
    var h = '<option value="-1">🎲 Sortear</option>';
    for (var i = 0; i < _PN_MELODIAS.length; i++) {
      h += '<option value="' + i + '">' + _PN_MELODIAS[i].nome + '</option>';
    }
    sel.innerHTML = h;
  }

  function _pnComecar(modo) {
    _pnCanvas = document.getElementById('pn-canvas');
    if (!_pnCanvas) return;
    if (!_pnCtx) _pnCtx = _pnCanvas.getContext('2d');
    _pnAudioDestravar();            // veio de um clique: acorda o áudio
    _pnLigarControles();
    _pnMostrarOverlay(null);
    _pnDimensionar();
    // Sem argumento (ponte do hub ou "jogar de novo"), repete o
    // último modo jogado.
    _pnReset(modo || _pnModo);
    _pnEstado = 'jogando'; _pnLast = 0;
    if (_pnRAF) cancelAnimationFrame(_pnRAF);
    _pnRAF = requestAnimationFrame(_pnLoop);
  }

  // Volta pra tela de escolha (modo + música) sem sair do jogo.
  function _pnVoltarInicio() {
    _pnParar();
    _pnEstado = 'inicio';
    _pnMostrarOverlay('inicio');
    _pnDrawIdle();
  }

  function _pnParar() {
    if (_pnRAF) { cancelAnimationFrame(_pnRAF); _pnRAF = 0; }
    if (_pnEstado === 'jogando') _pnEstado = 'inicio';
    _pnMovendo = false;
  }

  /* ── Exposição pública ────────────────────────────────────────── */
  window._pnComecar = _pnComecar;
  window._pnAlternarBatida = _pnAlternarBatida;
  window._pnVoltarInicio = _pnVoltarInicio;
  window.PianoGame = { preparar: _pnPreparar, comecar: _pnComecar, parar: _pnParar };
})();
