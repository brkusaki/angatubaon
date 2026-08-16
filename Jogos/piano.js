/* ═══════════════════════════════════════════════════════════════
   PIANO DA CORUJA — módulo de jogo (lazy-loaded)
   Piano Tiles clássico: 4 colunas, os azulejos descem e você toca
   sempre no MAIS BAIXO ainda não tocado. Errar a coluna ou deixar
   um azulejo passar pelo rodapé encerra a partida. A velocidade
   sobe junto com a pontuação.

   MÚSICA — por que é sintetizada e não MP3
   O jogo NÃO baixa nenhum arquivo de áudio. Cada azulejo tocado
   dispara a próxima nota da melodia, gerada na hora em Web Audio
   (dois osciladores + envelope de piano). Isso resolve três coisas
   de uma vez:
     1) SINCRONIA — o azulejo É a nota. Não existe latência de
        decode nem drift entre o áudio e o desenho.
     2) PESO — zero KB de áudio no cache do Service Worker; o jogo
        inteiro cabe neste arquivo e funciona offline.
     3) DIREITO AUTORAL — as melodias são de domínio público
        (Beethoven, Mozart, Pachelbel, tradicionais) e a "gravação"
        é gerada pelo próprio navegador, então não há gravação de
        terceiro envolvida. Faixas de gravadora (inclusive as da
        NCS) exigiriam licença comercial pra uso em jogo.

   Fala com o app APENAS via window.AngatubaGames (a ponte).
   Expõe window.PianoGame = { preparar, comecar, parar } e mantém
   window._pnComecar pro onclick inline do botão no HTML.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     MELODIAS — todas de domínio público. Cada número é uma nota
     MIDI (69 = lá central). O ritmo NÃO vem daqui: como no Piano
     Tiles original, quem dita o andamento é a velocidade da queda,
     então cada azulejo toca a próxima nota da lista. Quando a
     lista acaba, ela recomeça.
  ══════════════════════════════════════════════════════════════ */
  var _PN_MELODIAS = [
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
  var _PN_VEL_INI = 1.8, _PN_VEL_MAX = 7.5, _PN_VEL_ACC = 0.045;
  var _pnMelodia = null, _pnNotaIdx = 0;
  var _pnOndas = [];         // ripples do toque certo

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
  var _pnElPontos = null, _pnElRec = null, _pnElMusica = null;
  var _pnHudUlt = { p: -1, r: -1, m: '' };
  function _pnAtualizarHUD(forcar) {
    if (forcar || !_pnElPontos) {
      _pnElPontos = document.getElementById('pn-pontos');
      _pnElRec    = document.getElementById('pn-recorde');
      _pnElMusica = document.getElementById('pn-musica');
    }
    if (_pnElPontos && (forcar || _pnPontos !== _pnHudUlt.p)) { _pnElPontos.textContent = _pnPontos; _pnHudUlt.p = _pnPontos; }
    var rv = _pnRec();
    if (_pnElRec && (forcar || rv !== _pnHudUlt.r)) { _pnElRec.textContent = rv; _pnHudUlt.r = rv; }
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
    return { col: _pnSortearCol(), y: y, tocada: false, flash: 0 };
  }

  /* ── Reset ────────────────────────────────────────────────────── */
  function _pnReset() {
    _pnAzulejos.length = 0;
    _pnOndas.length = 0;
    _pnPontos = 0;
    _pnVel = _PN_VEL_INI;
    _pnMovendo = false;
    _pnNotaIdx = 0;
    _pnMelodia = _PN_MELODIAS[(Math.random() * _PN_MELODIAS.length) | 0];
    // Preenche a tela de baixo pra cima + uma folga acima do topo.
    for (var i = 0; i < _PN_LINHAS_TELA + 2; i++) {
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

    if (col !== alvo.col) { _pnGameOver('errou'); return; }

    alvo.tocada = true;
    alvo.flash = 1;
    _pnPontos++;
    _pnMovendo = true;                 // a queda só começa no 1º acerto
    _pnVel = Math.min(_PN_VEL_MAX, _PN_VEL_INI + _pnPontos * _PN_VEL_ACC);

    var notas = _pnMelodia.notas;
    _pnTocarNota(notas[_pnNotaIdx % notas.length]);
    _pnNotaIdx++;

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
    for (i = _pnOndas.length - 1; i >= 0; i--) {
      _pnOndas[i].t += dt;
      if (_pnOndas[i].t > 0.4) _pnOndas.splice(i, 1);
    }
    if (!_pnMovendo) return;

    var avanco = _pnVel * dt;
    for (i = 0; i < _pnAzulejos.length; i++) _pnAzulejos[i].y += avanco;
    for (i = 0; i < _pnOndas.length; i++) _pnOndas[i].y += avanco * _pnLinhaH();

    // Saiu por baixo? Se não foi tocado, acabou o jogo.
    while (_pnAzulejos.length && _pnAzulejos[0].y >= _PN_LINHAS_TELA) {
      if (!_pnAzulejos[0].tocada) { _pnGameOver('passou'); return; }
      _pnAzulejos.shift();
    }
    // Repõe em cima pra fila nunca acabar.
    var topo = _pnAzulejos.length ? _pnAzulejos[_pnAzulejos.length - 1].y : 0;
    while (topo > -2) {
      topo -= 1;
      _pnAzulejos.push(_pnNovoAzulejo(topo));
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
        // Tocado: esverdeado, esmaecendo conforme desce.
        var f = az.flash;
        var g = ctx.createLinearGradient(0, by, 0, by + bh);
        g.addColorStop(0, 'rgba(45,212,150,' + (0.16 + f * 0.55) + ')');
        g.addColorStop(1, 'rgba(20,120,95,' + (0.10 + f * 0.40) + ')');
        ctx.fillStyle = g;
        _pnRoundRect(ctx, bx, by, bw, bh, raio); ctx.fill();
      } else {
        var g2 = ctx.createLinearGradient(0, by, 0, by + bh);
        g2.addColorStop(0, '#ff4d63');
        g2.addColorStop(1, '#c81e3c');
        ctx.fillStyle = g2;
        _pnRoundRect(ctx, bx, by, bw, bh, raio); ctx.fill();
        if (az === alvo) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = Math.max(2, cw * 0.022);
          _pnRoundRect(ctx, bx, by, bw, bh, raio); ctx.stroke();
        }
      }
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
    var score = _pnPontos, rec = _pnRec(), recorde = score > rec;
    if (recorde) _pnRecSet(score);
    _pnDraw();
    _pnSomErro();
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(recorde);
    if (window.AngatubaGames) window.AngatubaGames.rankSubmeter('piano', score);

    var owlEl = document.getElementById('pn-fim-owl');
    var titEl = document.getElementById('pn-fim-titulo');
    var ptsEl = document.getElementById('pn-fim-pontos');
    var msgEl = document.getElementById('pn-fim-msg');
    if (owlEl) { owlEl.src = recorde ? '/webp/owl-celebrate-flying.webp' : '/webp/owl-surprised.webp'; owlEl.style.display = ''; }
    if (titEl) titEl.textContent = recorde ? '🎉 Novo recorde!' : (motivo === 'passou' ? 'Deixou passar!' : 'Nota errada!');
    if (ptsEl) ptsEl.textContent = score + (score === 1 ? ' nota' : ' notas');
    if (msgEl) msgEl.textContent = recorde ? 'Você nunca tocou tão longe! 🦉'
      : (rec > 0 ? 'Seu recorde: ' + rec + '. Bora de novo?' : 'Toque sempre no azulejo mais baixo!');
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
    _pnAtualizarHUD(true);
    _pnMostrarOverlay('inicio');
    _pnDrawIdle();
  }

  function _pnComecar() {
    _pnCanvas = document.getElementById('pn-canvas');
    if (!_pnCanvas) return;
    if (!_pnCtx) _pnCtx = _pnCanvas.getContext('2d');
    _pnAudioDestravar();            // veio de um clique: acorda o áudio
    _pnLigarControles();
    _pnMostrarOverlay(null);
    _pnDimensionar();
    _pnReset();
    _pnEstado = 'jogando'; _pnLast = 0;
    if (_pnRAF) cancelAnimationFrame(_pnRAF);
    _pnRAF = requestAnimationFrame(_pnLoop);
  }

  function _pnParar() {
    if (_pnRAF) { cancelAnimationFrame(_pnRAF); _pnRAF = 0; }
    if (_pnEstado === 'jogando') _pnEstado = 'inicio';
    _pnMovendo = false;
  }

  /* ── Exposição pública ────────────────────────────────────────── */
  window._pnComecar = _pnComecar;
  window.PianoGame = { preparar: _pnPreparar, comecar: _pnComecar, parar: _pnParar };
})();
