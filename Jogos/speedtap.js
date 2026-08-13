/* ═══════════════════════════════════════════════════════════════
   PEGA A CORUJA (Speed Tap) — módulo de jogo (lazy-loaded)
   Carregado sob demanda por /Jogos/ quando o usuário abre o jogo.
   Comunica-se com o app APENAS via window.AngatubaGames (a ponte).
   Expõe window.SpeedTapGame = { preparar, comecar, parar } e mantém
   window._stComecar pro onclick inline dos botões no HTML.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* -- Speed Tap: "Pega a Coruja" (com níveis, combo, coruja fake e 2 modos) -- */
  var _ST_DURACAO = 25;                        // segundos por partida (modo clássico)
  var _ST_VIDAS   = 3;                          // fakes que pode errar (modo sobrevivência)
  var _ST_OWL     = '/webp/owl-portrait.webp'; // coruja boa (vale ponto)
  var _ST_FAKE    = '/webp/owl-angry.webp';    // coruja fake (não pode tocar!)
  var _ST_BONUS   = '/webp/owl-trophy.webp';   // coruja bônus dourada (+5)

  var _stModo = 'classico';                     // 'classico' | 'sobrevivencia'
  var _stTempo = 0, _stPontos = 0, _stCombo = 0, _stComboMax = 0;
  var _stNivel = 1, _stAcertos = 0, _stVidas = 0;
  var _stTimerRelogio = null, _stTimerCiclo = null, _stRodando = false;

  // Recordes separados por modo.
  function _stRecChave() {
    return _stModo === 'sobrevivencia' ? 'angatuba_speedtap_surv_rec' : 'angatuba_speedtap_rec';
  }
  function _stRecordeGet() {
    try { return Number(localStorage.getItem(_stRecChave())) || 0; } catch(e) { return 0; }
  }
  function _stRecordeSet(v) {
    try { localStorage.setItem(_stRecChave(), String(v)); } catch(e) {}
  }

  // Config de cada nível: intervalo de troca (ms), tamanho da coruja (px),
  // chance de a coruja ser fake (0-1) e chance de bônus dourado.
  function _stNivelCfg(nivel) {
    // Vai ficando mais rápido, menor e com mais fakes conforme sobe.
    var intervalo = Math.max(560, 1100 - (nivel - 1) * 90);
    var tamanho   = Math.max(40, 66 - (nivel - 1) * 3);
    var chanceFake = Math.min(0.42, 0.10 + (nivel - 1) * 0.05);
    var chanceBonus = nivel >= 3 ? 0.12 : 0;
    // No modo sobrevivência as fakes precisam aparecer com frequência (senão
    // é impossível perder). Garante um piso maior de fakes.
    if (_stModo === 'sobrevivencia') {
      chanceFake = Math.min(0.5, 0.22 + (nivel - 1) * 0.045);
    }
    return { intervalo: intervalo, tamanho: tamanho, chanceFake: chanceFake, chanceBonus: chanceBonus };
  }

  // A cada X acertos, sobe de nível (até 6).
  function _stAtualizarNivel() {
    var novoNivel = Math.min(6, 1 + Math.floor(_stAcertos / 6));
    if (novoNivel !== _stNivel) {
      _stNivel = novoNivel;
      var nEl = document.getElementById('st-nivel');
      if (nEl) {
        nEl.textContent = _stNivel;
        nEl.classList.remove('st-nivel-up'); void nEl.offsetWidth; nEl.classList.add('st-nivel-up');
      }
      // Aviso visual de "Nível X!"
      var arena = document.getElementById('st-arena');
      if (arena) {
        var aviso = document.createElement('div');
        aviso.className = 'st-nivelup-aviso';
        aviso.textContent = 'Nível ' + _stNivel + '! 🚀';
        arena.appendChild(aviso);
        setTimeout(function(){ if (aviso.parentNode) aviso.remove(); }, 900);
      }
      if (navigator.vibrate) { try { navigator.vibrate([20, 40, 20]); } catch(e) {} }
    }
  }

  function _stComboMostrar() {
    var cEl = document.getElementById('st-combo');
    if (!cEl) return;
    if (_stCombo >= 2) {
      cEl.textContent = 'Combo x' + _stCombo;
      cEl.style.display = '';
      cEl.classList.remove('st-combo-pulse'); void cEl.offsetWidth; cEl.classList.add('st-combo-pulse');
    } else {
      cEl.style.display = 'none';
    }
  }

  // Mostra o slot de "Tempo" ou "Vidas" conforme o modo, e atualiza o valor.
  function _stAtualizarSlotTempoVidas() {
    var labelEl = document.getElementById('st-slot-label');
    var valEl = document.getElementById('st-tempo');
    if (_stModo === 'sobrevivencia') {
      if (labelEl) labelEl.textContent = 'Vidas';
      if (valEl) {
        var cheias = '', vazias = '';
        for (var i = 0; i < _stVidas; i++) cheias += '❤️';
        for (var j = 0; j < (_ST_VIDAS - _stVidas); j++) vazias += '🖤';
        valEl.innerHTML = '<span class="st-vidas">' + cheias + vazias + '</span>';
        valEl.classList.remove('st-tempo-baixo');
      }
    } else {
      if (labelEl) labelEl.textContent = 'Tempo';
      if (valEl) valEl.textContent = _stTempo;
    }
  }

  // Prepara a tela (estado inicial, mostra recorde). Não inicia o jogo ainda.
  function _stPreparar() {
    _stParar();
    var recEl = document.getElementById('st-recorde');
    if (recEl) recEl.textContent = _stRecordeGet();
    var pEl = document.getElementById('st-pontos'); if (pEl) pEl.textContent = '0';
    var labelEl = document.getElementById('st-slot-label'); if (labelEl) labelEl.textContent = 'Tempo';
    var tEl = document.getElementById('st-tempo');  if (tEl) { tEl.textContent = _ST_DURACAO; tEl.classList.remove('st-tempo-baixo'); }
    var nEl = document.getElementById('st-nivel');  if (nEl) nEl.textContent = '1';
    var cEl = document.getElementById('st-combo');  if (cEl) cEl.style.display = 'none';
    var inicio = document.getElementById('st-inicio');
    var fim = document.getElementById('st-fim');
    if (inicio) inicio.style.display = 'flex';
    if (fim) fim.style.display = 'none';
    var arena = document.getElementById('st-arena');
    if (arena) { var a = arena.querySelector('.st-alvo'); if (a) a.remove(); }
  }

  // Para tudo (timers, alvo). Seguro chamar a qualquer momento.
  function _stParar() {
    _stRodando = false;
    if (_stTimerRelogio) { clearInterval(_stTimerRelogio); _stTimerRelogio = null; }
    if (_stTimerCiclo)   { clearTimeout(_stTimerCiclo);   _stTimerCiclo = null; }
    var arena = document.getElementById('st-arena');
    if (arena) { var a = arena.querySelector('.st-alvo'); if (a) a.remove(); }
  }

  // Posiciona a coruja-alvo num ponto aleatório da arena.
  function _stPosicionar(alvo, arena, tamanho) {
    var w = arena.clientWidth, h = arena.clientHeight;
    var margem = tamanho * 0.7 + 8;
    var x = margem + Math.random() * Math.max(1, (w - margem * 2));
    var y = margem + Math.random() * Math.max(1, (h - margem * 2));
    alvo.style.left = x + 'px';
    alvo.style.top = y + 'px';
  }

  // Decide o tipo da próxima coruja e a mostra. Chamado em ciclo.
  function _stProximaCoruja() {
    if (!_stRodando) return;
    var arena = document.getElementById('st-arena');
    if (!arena) return;
    var cfg = _stNivelCfg(_stNivel);

    // Remove a anterior.
    var antiga = arena.querySelector('.st-alvo');
    if (antiga) antiga.remove();

    // Sorteia o tipo: bônus > fake > boa.
    var r = Math.random();
    var tipo = 'boa';
    if (r < cfg.chanceBonus) tipo = 'bonus';
    else if (r < cfg.chanceBonus + cfg.chanceFake) tipo = 'fake';

    var alvo = document.createElement('button');
    alvo.type = 'button';
    alvo.className = 'st-alvo st-' + tipo;
    alvo.style.width = cfg.tamanho + 'px';
    alvo.style.height = cfg.tamanho + 'px';
    var img = document.createElement('img');
    img.src = tipo === 'fake' ? _ST_FAKE : (tipo === 'bonus' ? _ST_BONUS : _ST_OWL);
    img.alt = 'coruja';
    img.onerror = function(){ this.style.visibility = 'hidden'; };
    alvo.appendChild(img);
    arena.appendChild(alvo);
    _stPosicionar(alvo, arena, cfg.tamanho);

    alvo.addEventListener('click', function(){
      if (!_stRodando) return;
      _stTocarCoruja(tipo, alvo, arena);
    });

    // Agenda a próxima troca. Se o jogador não tocar, a coruja "some" e troca.
    _stTimerCiclo = setTimeout(function(){
      // Perder a coruja boa por inação zera o combo (mas não tira ponto).
      if (tipo === 'boa') { _stCombo = 0; _stComboMostrar(); }
      _stProximaCoruja();
    }, cfg.intervalo);
  }

  // Trata o toque conforme o tipo de coruja.
  function _stTocarCoruja(tipo, alvo, arena) {
    var pEl = document.getElementById('st-pontos');

    if (tipo === 'fake') {
      if (_stModo === 'sobrevivencia') {
        // Perde 1 vida. Combo zera. Se acabaram as vidas, fim de jogo.
        _stVidas = Math.max(0, _stVidas - 1);
        _stCombo = 0;
        _stComboMostrar();
        _stAtualizarSlotTempoVidas();
        _stFlutuante('-1 ❤️', alvo, arena, 'st-menos');
        if (navigator.vibrate) { try { navigator.vibrate(160); } catch(e) {} }
        var arS = document.getElementById('st-arena');
        if (arS) { arS.classList.remove('st-shake'); void arS.offsetWidth; arS.classList.add('st-shake'); }
        if (_stTimerCiclo) { clearTimeout(_stTimerCiclo); _stTimerCiclo = null; }
        if (_stVidas <= 0) { _stFim(); return; }
        _stProximaCoruja();
        return;
      }
      // Modo clássico: tocou na errada, perde 2 pontos, zera combo, treme.
      _stPontos = Math.max(0, _stPontos - 2);
      _stCombo = 0;
      if (pEl) pEl.textContent = _stPontos;
      _stComboMostrar();
      _stFlutuante('-2', alvo, arena, 'st-menos');
      if (navigator.vibrate) { try { navigator.vibrate(120); } catch(e) {} }
      var ar = document.getElementById('st-arena');
      if (ar) { ar.classList.remove('st-shake'); void ar.offsetWidth; ar.classList.add('st-shake'); }
      if (_stTimerCiclo) { clearTimeout(_stTimerCiclo); _stTimerCiclo = null; }
      _stProximaCoruja();
      return;
    }

    // Coruja boa ou bônus: pontua com multiplicador de combo.
    _stCombo++;
    if (_stCombo > _stComboMax) _stComboMax = _stCombo;
    _stAcertos++;
    var mult = _stCombo >= 6 ? 3 : (_stCombo >= 3 ? 2 : 1);
    var base = tipo === 'bonus' ? 5 : 1;
    var ganho = base * mult;
    _stPontos += ganho;
    if (pEl) pEl.textContent = _stPontos;

    _stComboMostrar();
    _stFlutuante('+' + ganho, alvo, arena, tipo === 'bonus' ? 'st-bonus-txt' : (mult > 1 ? 'st-mult-txt' : ''));
    if (navigator.vibrate) { try { navigator.vibrate(tipo === 'bonus' ? [15,30,15] : 15); } catch(e) {} }
    alvo.classList.remove('st-pop'); void alvo.offsetWidth; alvo.classList.add('st-pop');

    _stAtualizarNivel();
    if (_stTimerCiclo) { clearTimeout(_stTimerCiclo); _stTimerCiclo = null; }
    _stProximaCoruja();
  }

  // Badge de texto flutuante (+N / -N) na posição da coruja.
  function _stFlutuante(txt, alvo, arena, classe) {
    var el = document.createElement('div');
    el.className = 'st-mais' + (classe ? ' ' + classe : '');
    el.textContent = txt;
    el.style.left = alvo.style.left; el.style.top = alvo.style.top;
    arena.appendChild(el);
    setTimeout(function(){ if (el.parentNode) el.remove(); }, 600);
  }

  function _stComecar(modo) {
    var arena = document.getElementById('st-arena');
    if (!arena) return;
    _stParar();
    // Define o modo (default: mantém o atual, ou clássico se indefinido).
    if (modo === 'classico' || modo === 'sobrevivencia') _stModo = modo;
    _stPontos = 0; _stCombo = 0; _stComboMax = 0;
    _stNivel = 1; _stAcertos = 0;
    _stVidas = _ST_VIDAS;
    _stTempo = _ST_DURACAO;
    var pEl = document.getElementById('st-pontos'); if (pEl) pEl.textContent = '0';
    var nEl = document.getElementById('st-nivel');  if (nEl) nEl.textContent = '1';
    var cEl = document.getElementById('st-combo');  if (cEl) cEl.style.display = 'none';
    _stAtualizarSlotTempoVidas();
    var inicio = document.getElementById('st-inicio'); if (inicio) inicio.style.display = 'none';
    var fim = document.getElementById('st-fim'); if (fim) fim.style.display = 'none';
    var recEl = document.getElementById('st-recorde');
    if (recEl) { recEl.textContent = _stRecordeGet(); recEl.classList.remove('st-recorde-novo'); }

    _stRodando = true;
    _stProximaCoruja();

    // Contagem regressiva só no modo clássico. Sobrevivência não tem relógio.
    if (_stModo === 'classico') {
      var tEl = document.getElementById('st-tempo');
      _stTimerRelogio = setInterval(function(){
        _stTempo--;
        if (tEl) tEl.textContent = _stTempo;
        if (_stTempo <= 5 && tEl) { tEl.classList.add('st-tempo-baixo'); }
        if (_stTempo <= 0) { _stFim(); }
      }, 1000);
    }
  }

  function _stFim() {
    _stRodando = false;
    if (_stTimerRelogio) { clearInterval(_stTimerRelogio); _stTimerRelogio = null; }
    if (_stTimerCiclo)   { clearTimeout(_stTimerCiclo);   _stTimerCiclo = null; }
    var arena = document.getElementById('st-arena');
    if (arena) { var a = arena.querySelector('.st-alvo'); if (a) a.remove(); }
    var tEl = document.getElementById('st-tempo'); if (tEl) tEl.classList.remove('st-tempo-baixo');
    var cEl = document.getElementById('st-combo'); if (cEl) cEl.style.display = 'none';

    var rec = _stRecordeGet();
    var bateuRecorde = _stPontos > rec;
    if (bateuRecorde) { _stRecordeSet(_stPontos); }
    // Ranking: submete ao Firestore (se logado). Modo define a coleção.
    if (window.AngatubaGames) {
      window.AngatubaGames.rankSubmeter(_stModo === 'sobrevivencia' ? 'pegacoruja_surv' : 'pegacoruja', _stPontos);
    }

    var fim = document.getElementById('st-fim');
    var fimOwl = document.getElementById('st-fim-owl');
    var fimPontos = document.getElementById('st-fim-pontos');
    var fimMsg = document.getElementById('st-fim-msg');
    var recEl = document.getElementById('st-recorde');
    if (recEl) recEl.textContent = _stRecordeGet();

    if (fimOwl) {
      fimOwl.src = bateuRecorde ? '/webp/owl-celebrate-pro.webp' : '/webp/owl-thumbsup.webp';
      fimOwl.style.display = '';
    }
    if (fimPontos) fimPontos.innerHTML = '<b>' + _stPontos + '</b> ' + (_stPontos === 1 ? 'ponto' : 'pontos');
    if (fimMsg) {
      var extra = _stComboMax >= 3 ? ' (combo máx. x' + _stComboMax + ')' : '';
      if (_stModo === 'sobrevivencia') {
        if (bateuRecorde) fimMsg.textContent = 'Novo recorde de sobrevivência! 🏆' + extra;
        else if (_stPontos >= 30) fimMsg.textContent = 'Resistiu bravamente! 🛡️' + extra;
        else fimMsg.textContent = 'As corujas bravas venceram dessa vez! 😠' + extra;
      } else {
        if (bateuRecorde) fimMsg.textContent = 'Novo recorde! Você é rápido! 🏆' + extra;
        else if (_stPontos >= 40) fimMsg.textContent = 'Mandou muito bem! 🔥' + extra;
        else fimMsg.textContent = 'Boa! Tenta de novo pra bater o recorde! 🦉' + extra;
      }
    }
    if (bateuRecorde && recEl) recEl.classList.add('st-recorde-novo');
    if (fim) fim.style.display = 'flex';
    if (window.AngatubaGames) {
      window.AngatubaGames.rankFimDeJogo(_stModo === 'sobrevivencia' ? 'pegacoruja_surv' : 'pegacoruja', 'st-rank-slot', _stPontos);
    }
  }

  window._stComecar = _stComecar;

  // API pública consumida pelo loader do app (_jogoLoader).
  window.SpeedTapGame = {
    preparar: _stPreparar,
    comecar:  _stComecar,
    parar:    _stParar
  };
})();
