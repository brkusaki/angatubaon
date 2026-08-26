/* ═══════════════════════════════════════════════════════════════
   DOCES DA CORUJA (match-3 estilo Candy Crush simplificado) —
   módulo de jogo (lazy-loaded). Carregado sob demanda por /Jogos/
   quando o usuário abre o jogo. Comunica-se com o app APENAS via
   window.AngatubaGames (a ponte). Expõe
   window.DocesGame = { preparar, comecar, parar }.

   Mecânica: grade 8×8 de doces coloridos. Troca duas peças
   adjacentes (toque em duas, ou arraste/swipe) — se formar uma
   combinação de 3+ na horizontal/vertical, remove, cai e repõe em
   cascata; senão a troca desfaz sozinha (sem custar movimento).
   Cada fase tem um limite de movimentos e um objetivo (pontos,
   combinações de uma cor-alvo, ou derreter blocos de gelo), gerado
   por fórmula a partir do número da fase. O ranking usa a MAIOR
   FASE CONCLUÍDA (inteiro), guardada localmente em
   'angatuba_doces_fase' e reconciliada no Firestore via
   AngatubaGames.rankSubmeter/rankFimDeJogo.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function _som() {
    return (window.AngatubaGames && window.AngatubaGames.som) || null;
  }

  var _DC_TAM = 8; // grade 8×8
  var _dcCores = ['#ef4444', '#a855f7', '#4ade80', '#fbbf24', '#38bdf8'];
  // Texturas opcionais (mesma ordem de _dcCores); se o arquivo não existir,
  // a cor sólida acima já fica aplicada como fundo e o visual não quebra.
  var _dcTexturas = [
    '/Jogos/assets/doces/doce-vermelho.webp',
    '/Jogos/assets/doces/doce-roxo.webp',
    '/Jogos/assets/doces/doce-verde.webp',
    '/Jogos/assets/doces/doce-amarelo.webp',
    '/Jogos/assets/doces/doce-azul.webp'
  ];
  var _dcCoresNome = ['🔴 vermelho', '🟣 roxo', '🟢 verde', '🟡 amarelo', '🔵 azul'];

  // ── Estado ────────────────────────────────────────────────
  var _dcCor = [];                // 64 posições: 1..5 = cor do doce
  var _dcGelo = [];               // 64 posições: 0 = normal, 1-2 = hits restantes
  var _dcFaseAtual = 1;
  var _dcObjetivo = null;         // { tipo:'pontos'|'cor'|'obstaculo', meta, corAlvo }
  var _dcMovimentosRestantes = 0;
  var _dcPontosFase = 0;
  var _dcMatchesCorFase = 0;
  var _dcObstaculosQuebrados = 0;
  var _dcRng = null;
  var _dcRodando = false;
  var _dcAnimando = false;
  var _dcUltimoResultado = null;  // 'venceu' | 'perdeu'
  var _dcCelEls = null;
  var _dcSelecionado = null;      // { r, c } escolhida por toque
  var _dcArraste = null;

  // ── localStorage: maior fase JÁ CONCLUÍDA ──────────────────
  function _dcRecordeGet() {
    try { return Math.max(0, Math.round(Number(localStorage.getItem('angatuba_doces_fase')) || 0)); }
    catch (e) { return 0; }
  }
  function _dcRecordeSet(v) {
    try { localStorage.setItem('angatuba_doces_fase', String(v)); } catch (e) {}
  }

  // ── PRNG determinístico (mulberry32) — mesma fase = mesmo
  // tabuleiro inicial, mesmo depois de um "retry". ────────────
  function _dcMulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function _dcNovaCor() { return 1 + Math.floor(_dcRng() * _dcCores.length); }

  // ── Configuração de fase por fórmula: alterna objetivo,
  // reduz movimentos e introduz gelo a partir da fase 4. ─────
  function _dcConfigFase(fase) {
    var haGelo = fase >= 4;
    var tipos = haGelo ? ['pontos', 'cor', 'obstaculo'] : ['pontos', 'cor'];
    var tipo = tipos[(fase - 1) % tipos.length];
    var movimentos = Math.max(12, 28 - Math.floor((fase - 1) / 2));
    var qtdGelo = haGelo ? Math.min(8, 2 + Math.floor((fase - 4) / 2)) : 0;
    var meta, corAlvo = null;
    if (tipo === 'pontos') meta = 400 + (fase - 1) * 180;
    else if (tipo === 'cor') { meta = 6 + Math.floor((fase - 1) / 3); corAlvo = ((fase - 1) % _dcCores.length) + 1; }
    else meta = Math.max(1, qtdGelo);
    return { tipo: tipo, meta: meta, movimentos: movimentos, corAlvo: corAlvo, qtdGelo: qtdGelo };
  }

  function _dcObjetivoTexto() {
    if (!_dcObjetivo) return '—';
    if (_dcObjetivo.tipo === 'pontos') return 'Alcance ' + _dcObjetivo.meta + ' pontos';
    if (_dcObjetivo.tipo === 'cor') return 'Faça ' + _dcObjetivo.meta + ' combinações ' + _dcCoresNome[_dcObjetivo.corAlvo - 1];
    return 'Derreta ' + _dcObjetivo.meta + (_dcObjetivo.meta === 1 ? ' bloco de gelo' : ' blocos de gelo');
  }
  function _dcObjetivoProgresso() {
    if (!_dcObjetivo) return '0/0';
    if (_dcObjetivo.tipo === 'pontos') return Math.min(_dcPontosFase, _dcObjetivo.meta) + '/' + _dcObjetivo.meta;
    if (_dcObjetivo.tipo === 'cor') return Math.min(_dcMatchesCorFase, _dcObjetivo.meta) + '/' + _dcObjetivo.meta;
    return Math.min(_dcObstaculosQuebrados, _dcObjetivo.meta) + '/' + _dcObjetivo.meta;
  }
  function _dcObjetivoAtingido() {
    if (!_dcObjetivo) return false;
    if (_dcObjetivo.tipo === 'pontos') return _dcPontosFase >= _dcObjetivo.meta;
    if (_dcObjetivo.tipo === 'cor') return _dcMatchesCorFase >= _dcObjetivo.meta;
    return _dcObstaculosQuebrados >= _dcObjetivo.meta;
  }

  // ── Tabuleiro ───────────────────────────────────────────────
  // Gera um tabuleiro sem combinações prontas (checa só pra trás,
  // já que as células seguintes ainda não foram preenchidas).
  function _dcCriaMatchEm(idx, cor) {
    var r = Math.floor(idx / _DC_TAM), c = idx % _DC_TAM;
    if (c >= 2 && _dcCor[idx - 1] === cor && _dcCor[idx - 2] === cor) return true;
    if (r >= 2 && _dcCor[idx - _DC_TAM] === cor && _dcCor[idx - 2 * _DC_TAM] === cor) return true;
    return false;
  }
  function _dcGerarTabuleiroInicial() {
    _dcCor = new Array(_DC_TAM * _DC_TAM);
    for (var i = 0; i < _dcCor.length; i++) {
      var cor, tentativas = 0;
      do { cor = _dcNovaCor(); tentativas++; } while (_dcCriaMatchEm(i, cor) && tentativas < 30);
      _dcCor[i] = cor;
    }
  }
  function _dcColocarGelo(qtd) {
    _dcGelo = new Array(_DC_TAM * _DC_TAM).fill(0);
    var colocados = 0, tentativas = 0;
    while (colocados < qtd && tentativas < qtd * 20) {
      tentativas++;
      var idx = Math.floor(_dcRng() * _DC_TAM * _DC_TAM);
      if (_dcGelo[idx] > 0) continue;
      _dcGelo[idx] = 2;
      colocados++;
    }
  }

  // Encontra todas as combinações de 3+ (linhas e colunas). Retorna
  // { marcado: bool[64], runs: [{cor, cells:[idx,...]}] }.
  function _dcEncontrarMatches() {
    var marcado = new Array(_DC_TAM * _DC_TAM).fill(false);
    var runs = [], r, c, i;
    for (r = 0; r < _DC_TAM; r++) {
      var run = 1;
      for (c = 1; c <= _DC_TAM; c++) {
        var atual = c < _DC_TAM ? _dcCor[r * _DC_TAM + c] : -1;
        var anterior = _dcCor[r * _DC_TAM + (c - 1)];
        if (c < _DC_TAM && atual === anterior) { run++; }
        else {
          if (run >= 3) {
            var cells = [];
            for (i = c - run; i < c; i++) { cells.push(r * _DC_TAM + i); marcado[r * _DC_TAM + i] = true; }
            runs.push({ cor: anterior, cells: cells });
          }
          run = 1;
        }
      }
    }
    for (c = 0; c < _DC_TAM; c++) {
      var runV = 1;
      for (r = 1; r <= _DC_TAM; r++) {
        var atualV = r < _DC_TAM ? _dcCor[r * _DC_TAM + c] : -1;
        var anteriorV = _dcCor[(r - 1) * _DC_TAM + c];
        if (r < _DC_TAM && atualV === anteriorV) { runV++; }
        else {
          if (runV >= 3) {
            var cellsV = [];
            for (i = r - runV; i < r; i++) { cellsV.push(i * _DC_TAM + c); marcado[i * _DC_TAM + c] = true; }
            runs.push({ cor: anteriorV, cells: cellsV });
          }
          runV = 1;
        }
      }
    }
    return { marcado: marcado, runs: runs };
  }

  function _dcTrocaFormaMatch(i1, i2) {
    if (_dcGelo[i1] > 0 || _dcGelo[i2] > 0) return false;
    var tmp = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tmp;
    var achou = _dcEncontrarMatches().marcado.indexOf(true) !== -1;
    tmp = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tmp;
    return achou;
  }
  function _dcExisteMovimentoValido() {
    for (var r = 0; r < _DC_TAM; r++) {
      for (var c = 0; c < _DC_TAM; c++) {
        var idx = r * _DC_TAM + c;
        if (c + 1 < _DC_TAM && _dcTrocaFormaMatch(idx, idx + 1)) return true;
        if (r + 1 < _DC_TAM && _dcTrocaFormaMatch(idx, idx + _DC_TAM)) return true;
      }
    }
    return false;
  }
  function _dcEmbaralhar() {
    var tentativas = 0;
    do { _dcGerarTabuleiroInicial(); tentativas++; } while (!_dcExisteMovimentoValido() && tentativas < 6);
    _dcRenderTabuleiro();
  }

  function _dcAplicarGravidade() {
    for (var c = 0; c < _DC_TAM; c++) {
      var vals = [];
      for (var r = _DC_TAM - 1; r >= 0; r--) {
        var idx = r * _DC_TAM + c;
        if (_dcCor[idx] !== 0) vals.push(_dcCor[idx]);
      }
      for (var i = 0; i < _DC_TAM; i++) {
        var rr = _DC_TAM - 1 - i;
        var idx2 = rr * _DC_TAM + c;
        _dcCor[idx2] = (i < vals.length) ? vals[i] : _dcNovaCor();
      }
    }
  }

  // Remove as peças marcadas (pontua, conta combinações da cor-alvo
  // e "craca" o gelo daquela posição), deixando 0 = vazio pra gravidade.
  function _dcProcessarMarcados(resultado) {
    resultado.runs.forEach(function (run) {
      _dcPontosFase += run.cells.length * 10;
      if (_dcObjetivo && _dcObjetivo.tipo === 'cor' && run.cor === _dcObjetivo.corAlvo) {
        _dcMatchesCorFase++;
      }
    });
    resultado.marcado.forEach(function (m, idx) {
      if (!m) return;
      if (_dcGelo[idx] > 0) {
        _dcGelo[idx]--;
        if (_dcGelo[idx] === 0) _dcObstaculosQuebrados++;
      }
      _dcCor[idx] = 0;
    });
  }

  // ── DOM ───────────────────────────────────────────────────
  function _dcCriarTabuleiroDOM() {
    var grid = document.getElementById('dc-grid');
    if (!grid || grid._dcPronto) return;
    grid._dcPronto = true;
    grid.innerHTML = '';
    _dcCelEls = [];
    for (var r = 0; r < _DC_TAM; r++) {
      for (var c = 0; c < _DC_TAM; c++) {
        var el = document.createElement('div');
        el.className = 'dc-cel';
        (function (rr, cc) {
          el.addEventListener('pointerdown', function (e) { _dcPointerDown(e, rr, cc); });
        })(r, c);
        grid.appendChild(el);
        _dcCelEls.push(el);
      }
    }
  }
  function _dcRenderTabuleiro() {
    if (!_dcCelEls) return;
    for (var i = 0; i < _dcCelEls.length; i++) {
      var el = _dcCelEls[i];
      var corIdx = _dcCor[i] - 1;
      el.style.background = _dcCores[corIdx] || '';
      var tex = _dcTexturas[corIdx];
      if (tex) {
        el.style.backgroundImage = 'url(' + tex + ')';
        el.style.backgroundSize = '72%';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
      } else {
        el.style.backgroundImage = '';
      }
      el.classList.toggle('dc-gelo', _dcGelo[i] > 0);
      el.classList.toggle('dc-gelo-2', _dcGelo[i] === 2);
      el.classList.toggle('dc-selecionada', !!(_dcSelecionado && (_dcSelecionado.r * _DC_TAM + _dcSelecionado.c) === i));
    }
  }
  function _dcFeedbackInvalido(i1, i2) {
    var s = _som(); if (s) s.erro();
    [i1, i2].forEach(function (idx) {
      var el = _dcCelEls[idx];
      if (!el) return;
      el.classList.remove('dc-shake'); void el.offsetWidth; el.classList.add('dc-shake');
    });
  }

  // ── Seleção/arraste (Pointer Events cobrem mouse e toque) ──
  var _DC_LIMIAR_SWIPE = 18;

  function _dcSelecionar(r, c) {
    _dcSelecionado = { r: r, c: c };
    _dcRenderTabuleiro();
    var s = _som(); if (s) s.toque();
  }
  function _dcLimparSelecao() {
    _dcSelecionado = null;
    _dcRenderTabuleiro();
  }
  function _dcAdjacente(a, b) {
    return (Math.abs(a.r - b.r) + Math.abs(a.c - b.c)) === 1;
  }
  function _dcTratarTap(r, c) {
    if (!_dcSelecionado) { _dcSelecionar(r, c); return; }
    if (_dcSelecionado.r === r && _dcSelecionado.c === c) { _dcLimparSelecao(); return; }
    if (_dcAdjacente(_dcSelecionado, { r: r, c: c })) {
      var sel = _dcSelecionado;
      _dcLimparSelecao();
      _dcTentarTrocar(sel.r, sel.c, r, c);
    } else {
      _dcSelecionar(r, c);
    }
  }

  function _dcPointerDown(e, r, c) {
    if (!_dcRodando || _dcAnimando) return;
    e.preventDefault();
    var el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    var estado = { r: r, c: c, x0: e.clientX, y0: e.clientY, resolvido: false };
    _dcArraste = estado;

    function mover(ev) {
      if (estado.resolvido) return;
      var dx = ev.clientX - estado.x0, dy = ev.clientY - estado.y0;
      if (Math.abs(dx) < _DC_LIMIAR_SWIPE && Math.abs(dy) < _DC_LIMIAR_SWIPE) return;
      ev.preventDefault();
      estado.resolvido = true;
      var dr = 0, dc = 0;
      if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1; else dr = dy > 0 ? 1 : -1;
      _dcLimparSelecao();
      _dcTentarTrocar(estado.r, estado.c, estado.r + dr, estado.c + dc);
    }
    function soltar() {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
      _dcArraste = null;
      if (!estado.resolvido) _dcTratarTap(estado.r, estado.c);
    }
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  }

  // ── Troca + cascata ─────────────────────────────────────────
  function _dcTentarTrocar(r1, c1, r2, c2) {
    if (!_dcRodando || _dcAnimando) return;
    if (r2 < 0 || r2 >= _DC_TAM || c2 < 0 || c2 >= _DC_TAM) return;
    var i1 = r1 * _DC_TAM + c1, i2 = r2 * _DC_TAM + c2;
    if (_dcGelo[i1] > 0 || _dcGelo[i2] > 0) { _dcFeedbackInvalido(i1, i2); return; }

    var tmp = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tmp;
    var resultado = _dcEncontrarMatches();
    if (resultado.marcado.indexOf(true) === -1) {
      // não formou combinação: desfaz sem custar movimento
      tmp = _dcCor[i1]; _dcCor[i1] = _dcCor[i2]; _dcCor[i2] = tmp;
      _dcRenderTabuleiro();
      _dcFeedbackInvalido(i1, i2);
      return;
    }

    _dcMovimentosRestantes = Math.max(0, _dcMovimentosRestantes - 1);
    _dcRenderTabuleiro();
    _dcAtualizarHud();
    _dcResolverCascata();
  }

  function _dcResolverCascata() {
    _dcAnimando = true;
    function passo() {
      var resultado = _dcEncontrarMatches();
      if (resultado.marcado.indexOf(true) === -1) {
        _dcAnimando = false;
        _dcAposCascata();
        return;
      }
      _dcProcessarMarcados(resultado);
      _dcAplicarGravidade();
      _dcRenderTabuleiro();
      _dcAtualizarHud();
      setTimeout(passo, 260);
    }
    passo();
  }

  function _dcAposCascata() {
    if (_dcObjetivoAtingido()) { _dcFimFase(true); return; }
    if (_dcMovimentosRestantes <= 0) { _dcFimFase(false); return; }
    if (!_dcExisteMovimentoValido()) _dcEmbaralhar();
  }

  function _dcAtualizarHud() {
    var faseEl = document.getElementById('dc-fase'); if (faseEl) faseEl.textContent = _dcFaseAtual;
    var recEl = document.getElementById('dc-recorde'); if (recEl) recEl.textContent = _dcRecordeGet();
    var movEl = document.getElementById('dc-movimentos'); if (movEl) movEl.textContent = _dcMovimentosRestantes;
    var pontosEl = document.getElementById('dc-pontos'); if (pontosEl) pontosEl.textContent = _dcPontosFase;
    var objEl = document.getElementById('dc-objetivo-texto'); if (objEl) objEl.textContent = _dcObjetivoTexto();
    var progEl = document.getElementById('dc-objetivo-progresso'); if (progEl) progEl.textContent = _dcObjetivoProgresso();
  }
  function _dcMostrarOverlay(nome) {
    var inicio = document.getElementById('dc-inicio');
    var fim = document.getElementById('dc-fim');
    if (inicio) inicio.style.display = (nome === 'inicio') ? 'flex' : 'none';
    if (fim) fim.style.display = (nome === 'fim') ? 'flex' : 'none';
  }

  // ── Início / fim de fase ────────────────────────────────────
  function _dcIniciarFase(fase) {
    _dcFaseAtual = Math.max(1, fase);
    var cfg = _dcConfigFase(_dcFaseAtual);
    _dcObjetivo = { tipo: cfg.tipo, meta: cfg.meta, corAlvo: cfg.corAlvo };
    _dcMovimentosRestantes = cfg.movimentos;
    _dcPontosFase = 0; _dcMatchesCorFase = 0; _dcObstaculosQuebrados = 0;
    _dcRng = _dcMulberry32(2000 + _dcFaseAtual * 131);

    var tentativas = 0;
    do {
      _dcGerarTabuleiroInicial();
      _dcColocarGelo(cfg.qtdGelo);
      tentativas++;
    } while (!_dcExisteMovimentoValido() && tentativas < 6);

    _dcRodando = true;
    _dcAnimando = false;
    _dcSelecionado = null;
    _dcRenderTabuleiro();
    _dcAtualizarHud();
  }

  function _dcFimFase(venceu) {
    _dcRodando = false;
    _dcUltimoResultado = venceu ? 'venceu' : 'perdeu';
    var s = _som();
    if (venceu) {
      if (_dcFaseAtual > _dcRecordeGet()) _dcRecordeSet(_dcFaseAtual);
      if (s) s.fim(true);
      if (window.AngatubaGames && window.AngatubaGames.efeitos) window.AngatubaGames.efeitos.confete('dc-card');
    } else if (s) { s.fim(false); }
    var recorde = _dcRecordeGet();

    var owl = document.getElementById('dc-fim-owl');
    var tit = document.getElementById('dc-fim-titulo');
    var msg = document.getElementById('dc-fim-msg');
    var btn = document.getElementById('dc-fim-btn');
    if (owl) { owl.src = venceu ? '/webp/owl-celebrate-pro.webp' : '/webp/owl-angry.webp'; owl.style.display = ''; }
    if (tit) tit.textContent = venceu ? ('Fase ' + _dcFaseAtual + ' concluída! 🎉') : 'Movimentos esgotados!';
    if (msg) {
      msg.textContent = venceu
        ? ('Você fez ' + _dcPontosFase + ' pontos nesta fase. Bora pra próxima?')
        : ('Você chegou até a fase ' + _dcFaseAtual + ' com ' + _dcPontosFase + ' pontos nesta tentativa. Tenta de novo!');
    }
    if (btn) btn.textContent = venceu ? 'Próxima fase' : 'Tentar de novo';
    var recEl = document.getElementById('dc-recorde'); if (recEl) recEl.textContent = recorde;

    _dcMostrarOverlay('fim');

    if (window.AngatubaGames) {
      window.AngatubaGames.rankSubmeter('doces', recorde);
      window.AngatubaGames.rankFimDeJogo('doces', 'dc-rank-slot', recorde);
    }
  }

  function _dcBotaoPrincipal() {
    if (_dcUltimoResultado === 'venceu') _dcProximaFase(); else _dcRetry();
  }
  function _dcComecar() {
    _dcMostrarOverlay(null);
    _dcIniciarFase(_dcRecordeGet() + 1);
  }
  function _dcProximaFase() {
    _dcMostrarOverlay(null);
    _dcIniciarFase(_dcFaseAtual + 1);
  }
  function _dcRetry() {
    _dcMostrarOverlay(null);
    _dcIniciarFase(_dcFaseAtual);
  }

  // ── Preparação da tela (chamada pelo _jogoLoader ao abrir) ──
  function _dcPrepararTela() {
    _dcCriarTabuleiroDOM();
    _dcRodando = false;
    _dcAnimando = false;
    _dcArraste = null;
    _dcSelecionado = null;
    var recorde = _dcRecordeGet();
    var faseIni = document.getElementById('dc-fase-inicio'); if (faseIni) faseIni.textContent = (recorde + 1);
    var recIni = document.getElementById('dc-recorde-inicio'); if (recIni) recIni.textContent = recorde;
    _dcAtualizarHud();
    _dcMostrarOverlay('inicio');
  }
  function _dcParar() {
    _dcRodando = false;
    _dcAnimando = false;
    _dcArraste = null;
  }

  window._dcComecar = _dcComecar;
  window._dcProximaFase = _dcProximaFase;
  window._dcRetry = _dcRetry;
  window._dcBotaoPrincipal = _dcBotaoPrincipal;

  // API pública consumida pelo loader do app (_jogoLoader).
  window.DocesGame = {
    preparar: _dcPrepararTela,
    comecar: _dcComecar,
    parar: _dcParar
  };
})();
