/* ═══════════════════════════════════════════════════════════════
   2048 DA CORUJA (clássico deslizar-e-fundir) — módulo de jogo
   (lazy-loaded). Carregado sob demanda por /Jogos/ quando o usuário
   abre o jogo. Comunica-se com o app APENAS via window.AngatubaGames
   (a ponte). Expõe window.Game2048 = { preparar, comecar, parar }.

   Mecânica: grade 4×4. Arraste/swipe (Pointer Events — cobre mouse e
   toque) numa das 4 direções desliza todas as peças; duas peças de
   mesmo valor que se encostam se fundem numa só, dobrando o valor e
   somando pontos. Depois de cada jogada válida nasce uma peça nova
   (90% chance de "2", 10% chance de "4") numa célula vazia
   aleatória. Chegar a uma peça "2048" dispara uma comemoração (som +
   confete + aviso na tela), mas o jogo CONTINUA — igual ao 2048
   clássico, dá pra seguir jogando pra bater um placar ainda maior.
   O fim de verdade só chega quando não sobra nenhuma jogada válida
   (grade cheia e sem par de vizinhos iguais).

   Diferente de Blocos/Doces (que rankeiam pela MAIOR FASE), aqui o
   2048 não tem fases — é uma corrida só, então o ranking usa a
   PONTUAÇÃO (score), igual a jogos como Voo/Piano/Corrida. Mesma
   estrutura de sempre: RANK_COLECOES/RANK_REC_LOCAL no app.js e
   AngatubaGames.rankSubmeter/rankFimDeJogo aqui, só que com score em
   vez de fase. Recorde local em 'angatuba_2048_rec'.

   RENDER: cada peça é um <div> absolutamente posicionado (não uma
   grade recriada a cada jogada) — a posição muda via CSS transform
   (translate), que o navegador anima sozinho de um estado pro outro
   (transition no CSS). Uma peça nova nasce direto na posição final
   (sem "deslizar de lugar nenhum") e só faz o efeito de "pop" na
   escala; ao fundir, a peça que desaparece desliza até encostar na
   sobrevivente e some, enquanto a sobrevivente dá um leve "pulo" de
   escala. Isso evita precisar de canvas + loop de desenho pra uma
   grade 4×4 simples.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function _som() {
    return (window.AngatubaGames && window.AngatubaGames.som) || null;
  }

  var _T48_TAM = 4; // grade 4×4 (padrão do 2048 clássico)
  var _T48_PAD = 8, _T48_GAP = 10;      // mesmos papéis de _DC_PAD/_DC_GAP em doces.js
  var _T48_DUR_SLIDE = 110;             // ms — tem que bater com a transition do CSS (.t48-tile)
  var _T48_DUR_POP = 140;               // ms — duração do "pop" de escala (nova peça / fusão)
  var _T48_LIMIAR_SWIPE = 18;           // px — mesmo limiar usado em doces.js pro arraste

  // ── Estado ────────────────────────────────────────────────
  var _t48Grid = [];              // 16 posições: 0 vazio, ou o id da peça
  var _t48Tiles = {};             // id -> { id, valor, r, c, el, faceEl }
  var _t48ProxId = 1;
  var _t48Pontos = 0;
  var _t48Melhor = 0;             // maior peça já formada NESTA partida (pra HUD/objetivo)
  var _t48Rodando = false;
  var _t48Animando = false;       // trava entrada durante a transição de uma jogada
  var _t48VenceuMostrado = false; // já comemorou o 2048 nesta partida? (só comemora 1x)
  var _t48Arraste = null;
  var _t48TilesEl = null;
  var _t48ListenersProntos = false;

  // ── localStorage: MELHOR PONTUAÇÃO já feita (não é fase) ───
  function _t48RecordeGet() {
    try { return Math.max(0, Math.round(Number(localStorage.getItem('angatuba_2048_rec')) || 0)); }
    catch (e) { return 0; }
  }
  function _t48RecordeSet(v) {
    try { localStorage.setItem('angatuba_2048_rec', String(v)); } catch (e) {}
  }

  // ── Sorteio de peça nova: 90% "2", 10% "4" (regra clássica) ─
  function _t48NovoValor() { return Math.random() < 0.9 ? 2 : 4; }

  // ── DOM: grade (fundo estático) + camada de peças (criada 1x) ──
  function _t48CriarDOM() {
    var grid = document.getElementById('t48-grid');
    if (!grid) return;
    if (grid._t48Pronto) { _t48TilesEl = document.getElementById('t48-tiles'); return; }
    grid._t48Pronto = true;
    grid.innerHTML = '';
    for (var i = 0; i < _T48_TAM * _T48_TAM; i++) {
      var cel = document.createElement('div');
      cel.className = 't48-cel';
      grid.appendChild(cel);
    }
    var tiles = document.createElement('div');
    tiles.className = 't48-tiles';
    tiles.id = 't48-tiles';
    grid.appendChild(tiles);
    _t48TilesEl = tiles;
  }

  // Layout atual da grade em pixels CSS (recalculado a cada uso —
  // mesma ideia de _dcObterLayout em doces.js — pra sobreviver a
  // resize/rotação sem precisar de listener dedicado).
  function _t48Layout() {
    var grid = document.getElementById('t48-grid');
    var rect = grid ? grid.getBoundingClientRect() : { width: 320, height: 320 };
    var largura = rect.width || 320;
    var cellPx = (largura - 2 * _T48_PAD - (_T48_TAM - 1) * _T48_GAP) / _T48_TAM;
    return { cellPx: cellPx, passo: cellPx + _T48_GAP, pad: _T48_PAD };
  }
  function _t48PosPx(layout, r, c) {
    return { x: layout.pad + c * layout.passo, y: layout.pad + r * layout.passo };
  }

  function _t48GarantirEl(tile) {
    if (tile.el) return;
    var el = document.createElement('div');
    el.className = 't48-tile';
    var face = document.createElement('div');
    face.className = 't48-tile-face';
    el.appendChild(face);
    _t48TilesEl.appendChild(el);
    tile.el = el;
    tile.faceEl = face;
  }

  // Cor/tamanho de fonte da peça pelo valor. Acima de 2048 (dá pra
  // continuar jogando depois de vencer) cai num estilo "super"
  // genérico em vez de crescer a lista de cores pra sempre.
  function _t48AtualizarFace(tile, cellPx) {
    var v = tile.valor <= 2048 ? tile.valor : 'super';
    tile.faceEl.className = 't48-tile-face t48-tile-v' + v;
    tile.faceEl.textContent = tile.valor;
    var digitos = String(tile.valor).length;
    var fonte = cellPx * (digitos <= 2 ? 0.42 : digitos === 3 ? 0.34 : digitos === 4 ? 0.27 : 0.22);
    tile.faceEl.style.fontSize = Math.max(11, fonte) + 'px';
  }

  // Posiciona uma peça na grade (via transform:translate). Quando
  // `semTransicao` é true (peça recém-criada), desliga a transição
  // antes de aplicar a posição — sem isso, a peça nasceria já
  // "deslizando" desde o canto (0,0) do container, porque o
  // navegador trata a 1ª mudança de transform como uma transição
  // normal também. Força um reflow no meio pra garantir que o
  // navegador "viu" a posição sem transição antes de reativá-la.
  function _t48RenderTile(tile, layout, semTransicao) {
    _t48GarantirEl(tile);
    var pos = _t48PosPx(layout, tile.r, tile.c);
    if (semTransicao) tile.el.style.transition = 'none';
    tile.el.style.width = layout.cellPx + 'px';
    tile.el.style.height = layout.cellPx + 'px';
    tile.el.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
    if (semTransicao) {
      void tile.el.offsetWidth; // força o navegador a aplicar antes de reativar a transição
      tile.el.style.transition = '';
    }
    _t48AtualizarFace(tile, layout.cellPx);
  }

  // Redesenha TODAS as peças vivas na posição atual — usado depois
  // de resize/rotação (a grade pode ter mudado de tamanho) e como
  // base das jogadas via _t48RenderMovimento.
  function _t48RenderTodasSemTransicao() {
    var layout = _t48Layout();
    Object.keys(_t48Tiles).forEach(function (id) {
      _t48RenderTile(_t48Tiles[id], layout, true);
    });
  }

  function _t48PopIn(tile) {
    if (!tile.faceEl) return;
    tile.faceEl.classList.add('t48-anim-nova');
    setTimeout(function () { if (tile.faceEl) tile.faceEl.classList.remove('t48-anim-nova'); }, _T48_DUR_POP);
  }
  function _t48PopMerge(tile) {
    if (!tile.faceEl) return;
    tile.faceEl.classList.add('t48-anim-fundiu');
    setTimeout(function () { if (tile.faceEl) tile.faceEl.classList.remove('t48-anim-fundiu'); }, _T48_DUR_POP);
  }

  // ── Sorteio de uma peça nova numa célula vazia aleatória ────
  function _t48Spawn() {
    var livres = [];
    for (var i = 0; i < _t48Grid.length; i++) { if (!_t48Grid[i]) livres.push(i); }
    if (!livres.length) return null;
    var idx = livres[Math.floor(Math.random() * livres.length)];
    var r = Math.floor(idx / _T48_TAM), c = idx % _T48_TAM;
    var tile = { id: _t48ProxId++, valor: _t48NovoValor(), r: r, c: c, el: null, faceEl: null };
    _t48Tiles[tile.id] = tile;
    _t48Grid[idx] = tile.id;
    var layout = _t48Layout();
    _t48RenderTile(tile, layout, true); // sem transição de posição: só o "pop" de escala
    _t48PopIn(tile);
    return tile;
  }

  // ── Existe alguma jogada válida? (célula vazia OU par de
  // vizinhos —horizontal/vertical— com o mesmo valor) ─────────
  function _t48ExisteMovimentoValido() {
    for (var i = 0; i < _t48Grid.length; i++) { if (!_t48Grid[i]) return true; }
    for (var r = 0; r < _T48_TAM; r++) {
      for (var c = 0; c < _T48_TAM; c++) {
        var id = _t48Grid[r * _T48_TAM + c];
        if (!id) continue;
        var v = _t48Tiles[id].valor;
        if (c + 1 < _T48_TAM) {
          var idD = _t48Grid[r * _T48_TAM + c + 1];
          if (idD && _t48Tiles[idD].valor === v) return true;
        }
        if (r + 1 < _T48_TAM) {
          var idB = _t48Grid[(r + 1) * _T48_TAM + c];
          if (idB && _t48Tiles[idB].valor === v) return true;
        }
      }
    }
    return false;
  }

  function _t48MaiorPeca() {
    var maior = 0;
    Object.keys(_t48Tiles).forEach(function (id) {
      if (_t48Tiles[id].valor > maior) maior = _t48Tiles[id].valor;
    });
    return maior;
  }

  // ── Monta as 4 "linhas" (cada uma com 4 células) na ordem
  // DESTINO → LONGE pra uma direção de jogada. Compactar/fundir
  // sempre varre do índice 0 em diante — por isso a célula de
  // destino (pra onde tudo desliza) sempre entra em 1º na lista, e
  // as 4 direções reaproveitam a MESMA lógica de compactação. ────
  function _t48Linhas(dir) {
    var linhas = [], i, j, linha;
    if (dir === 'esquerda') {
      for (i = 0; i < _T48_TAM; i++) { linha = []; for (j = 0; j < _T48_TAM; j++) linha.push({ r: i, c: j }); linhas.push(linha); }
    } else if (dir === 'direita') {
      for (i = 0; i < _T48_TAM; i++) { linha = []; for (j = _T48_TAM - 1; j >= 0; j--) linha.push({ r: i, c: j }); linhas.push(linha); }
    } else if (dir === 'cima') {
      for (j = 0; j < _T48_TAM; j++) { linha = []; for (i = 0; i < _T48_TAM; i++) linha.push({ r: i, c: j }); linhas.push(linha); }
    } else { // baixo
      for (j = 0; j < _T48_TAM; j++) { linha = []; for (i = _T48_TAM - 1; i >= 0; i--) linha.push({ r: i, c: j }); linhas.push(linha); }
    }
    return linhas;
  }

  // ── Jogada: desliza + funde numa direção. Retorna false (sem
  // gastar jogada, sem som, sem nova peça) se nada mudou de lugar —
  // regra clássica do 2048: só nasce peça nova depois de um
  // movimento que realmente mexeu no tabuleiro. ──────────────────
  function _t48Mover(dir) {
    if (!_t48Rodando || _t48Animando) return false;
    var linhas = _t48Linhas(dir);
    var novoGrid = new Array(_T48_TAM * _T48_TAM).fill(0);
    var moveu = false, pontosGanhos = 0;
    var idsFundidos = [], idsRemovidos = [], elsRemovidos = [];

    linhas.forEach(function (linha) {
      var seq = [];
      linha.forEach(function (cel) {
        var id = _t48Grid[cel.r * _T48_TAM + cel.c];
        if (id) seq.push(id);
      });
      var destino = [], i = 0;
      while (i < seq.length) {
        var idA = seq[i];
        if (i + 1 < seq.length && _t48Tiles[idA].valor === _t48Tiles[seq[i + 1]].valor) {
          destino.push({ id: idA, valor: _t48Tiles[idA].valor * 2, removido: seq[i + 1] });
          i += 2;
        } else {
          destino.push({ id: idA, valor: _t48Tiles[idA].valor, removido: null });
          i += 1;
        }
      }
      for (var k = 0; k < destino.length; k++) {
        var alvo = linha[k], d = destino[k], tile = _t48Tiles[d.id];
        if (tile.r !== alvo.r || tile.c !== alvo.c) moveu = true;
        if (d.removido) {
          moveu = true;
          pontosGanhos += d.valor;
          idsFundidos.push(d.id);
          idsRemovidos.push(d.removido);
          // A peça que vai sumir também desliza até a célula de
          // destino (junto da sobrevivente) antes de ser removida —
          // sem isto ela ficaria "parada" no lugar velho e o efeito
          // pareceria um teleporte em vez de uma fusão.
          var removida = _t48Tiles[d.removido];
          removida.r = alvo.r; removida.c = alvo.c;
          elsRemovidos.push(removida);
        }
        tile.valor = d.valor; tile.r = alvo.r; tile.c = alvo.c;
        novoGrid[alvo.r * _T48_TAM + alvo.c] = d.id;
      }
    });

    if (!moveu) return false; // nada mexeu: joystick "bateu na parede", sem custo

    _t48Grid = novoGrid;
    _t48Pontos += pontosGanhos;
    var s = _som();
    if (s) { if (pontosGanhos > 0) s.combo(idsFundidos.length); else s.toque(); }

    _t48Animando = true;
    var layout = _t48Layout();
    // Desliza TODAS as peças vivas (inclusive as que vão sumir na
    // fusão, que agora apontam pra célula de destino) pra posição
    // atual — a transição do CSS cuida da animação sozinha.
    Object.keys(_t48Tiles).forEach(function (id) { _t48RenderTile(_t48Tiles[id], layout, false); });

    setTimeout(function () {
      elsRemovidos.forEach(function (t) {
        if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
      });
      idsRemovidos.forEach(function (id) { delete _t48Tiles[id]; });
      idsFundidos.forEach(function (id) {
        var t = _t48Tiles[id];
        if (t) _t48PopMerge(t);
      });
      _t48Animando = false;
      _t48DepoisDaJogada();
    }, _T48_DUR_SLIDE);

    return true;
  }

  // ── Pós-jogada: nasce peça nova, atualiza HUD, checa vitória
  // (2048 pela 1ª vez — comemora mas não para o jogo) e derrota
  // (sem jogada válida — aí sim encerra a partida). ──────────────
  function _t48DepoisDaJogada() {
    _t48Spawn();
    var maiorAtual = _t48MaiorPeca();
    if (maiorAtual > _t48Melhor) _t48Melhor = maiorAtual;
    _t48AtualizarHud();

    if (!_t48VenceuMostrado && maiorAtual >= 2048) {
      _t48VenceuMostrado = true;
      _t48Comemorar2048();
    }
    if (!_t48ExisteMovimentoValido()) _t48FimDeJogo();
  }

  function _t48Comemorar2048() {
    var s = _som(); if (s) s.bonus();
    if (window.AngatubaGames && window.AngatubaGames.efeitos) window.AngatubaGames.efeitos.confete('t48-card');
    var toast = document.getElementById('t48-toast');
    if (!toast) return;
    toast.textContent = '🎉 Você chegou ao 2048!';
    toast.classList.add('t48-toast-show');
    setTimeout(function () { toast.classList.remove('t48-toast-show'); }, 2200);
  }

  function _t48AtualizarHud() {
    var pontosEl = document.getElementById('t48-pontos'); if (pontosEl) pontosEl.textContent = _t48Pontos;
    var recEl = document.getElementById('t48-recorde'); if (recEl) recEl.textContent = Math.max(_t48RecordeGet(), _t48Pontos);
    var progEl = document.getElementById('t48-objetivo-progresso'); if (progEl) progEl.textContent = Math.min(_t48Melhor, 2048) + '/2048';
  }

  function _t48MostrarOverlay(nome) {
    var inicio = document.getElementById('t48-inicio');
    var fim = document.getElementById('t48-fim');
    if (inicio) inicio.style.display = (nome === 'inicio') ? 'flex' : 'none';
    if (fim) fim.style.display = (nome === 'fim') ? 'flex' : 'none';
  }

  // ── Início / fim de partida ─────────────────────────────────
  function _t48NovoJogo() {
    // Remove as peças da partida anterior (se houver) antes de
    // zerar o estado — senão os <div> velhos ficariam órfãos na tela.
    Object.keys(_t48Tiles).forEach(function (id) {
      var t = _t48Tiles[id];
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    });
    _t48Grid = new Array(_T48_TAM * _T48_TAM).fill(0);
    _t48Tiles = {};
    _t48ProxId = 1;
    _t48Pontos = 0;
    _t48Melhor = 0;
    _t48VenceuMostrado = false;
    _t48Animando = false;
    _t48Rodando = true;
    _t48Spawn();
    _t48Spawn();
    _t48AtualizarHud();
  }

  function _t48FimDeJogo() {
    _t48Rodando = false;
    _t48CancelarArraste();
    var venceu = _t48VenceuMostrado; // chegou ao 2048 nesta partida?
    var s = _som(); if (s) s.fim(venceu);
    var recordeAnterior = _t48RecordeGet();
    var bateuRecorde = _t48Pontos > recordeAnterior;
    if (bateuRecorde) _t48RecordeSet(_t48Pontos);
    var recorde = _t48RecordeGet();

    var owl = document.getElementById('t48-fim-owl');
    var tit = document.getElementById('t48-fim-titulo');
    var msg = document.getElementById('t48-fim-msg');
    if (owl) { owl.src = venceu ? '/webp/owl-celebrate-pro.webp' : '/webp/owl-angry.webp'; owl.style.display = ''; }
    if (tit) tit.textContent = venceu ? 'Você chegou ao 2048! 🎉' : 'Sem jogadas! 😵';
    if (msg) {
      msg.textContent = 'Você fez ' + _t48Pontos + ' pontos' + (bateuRecorde ? ' — novo recorde!' : '') +
        '. Melhor peça: ' + _t48Melhor + '. ' + (venceu ? 'Bora bater esse recorde de novo?' : 'Tenta de novo!');
    }
    var recEl = document.getElementById('t48-recorde'); if (recEl) recEl.textContent = recorde;

    _t48MostrarOverlay('fim');

    if (window.AngatubaGames) {
      window.AngatubaGames.rankSubmeter('2048', _t48Pontos);
      window.AngatubaGames.rankFimDeJogo('2048', 't48-rank-slot', _t48Pontos);
    }
  }

  function _t48Comecar() {
    _t48MostrarOverlay(null);
    _t48NovoJogo();
  }
  function _t48Retry() {
    _t48MostrarOverlay(null);
    _t48NovoJogo();
  }

  // ── Entrada: swipe (Pointer Events cobrem mouse e toque) +
  // setas do teclado (bônus pra quem joga no desktop). ───────────
  function _t48ArenaPointerDown(e) {
    if (!_t48Rodando || _t48Animando) return;
    var estado = { x0: e.clientX, y0: e.clientY, resolvido: false };
    _t48Arraste = estado;

    function mover(ev) {
      if (estado.resolvido) return;
      var dx = ev.clientX - estado.x0, dy = ev.clientY - estado.y0;
      if (Math.abs(dx) < _T48_LIMIAR_SWIPE && Math.abs(dy) < _T48_LIMIAR_SWIPE) return;
      estado.resolvido = true;
      var dir;
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'direita' : 'esquerda';
      else dir = dy > 0 ? 'baixo' : 'cima';
      _t48Mover(dir);
    }
    function soltar() {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
      _t48Arraste = null;
    }
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  }
  function _t48CancelarArraste() {
    _t48Arraste = null; // os listeners de mover/soltar se removem sozinhos no pointerup/cancel
  }

  var _T48_TECLAS = { ArrowLeft: 'esquerda', ArrowRight: 'direita', ArrowUp: 'cima', ArrowDown: 'baixo' };
  function _t48KeyDown(e) {
    if (!_t48Rodando || _t48Animando) return;
    var dir = _T48_TECLAS[e.key];
    if (!dir) return;
    e.preventDefault();
    _t48Mover(dir);
  }

  function _t48AoRedimensionar() {
    if (!_t48TilesEl) return;
    _t48RenderTodasSemTransicao();
  }

  // Liga os listeners globais (arena + teclado + resize) uma única
  // vez — cada handler já checa _t48Rodando por dentro, então não
  // precisa remover/religar toda vez que entra/sai da tela.
  function _t48LigarListeners() {
    if (_t48ListenersProntos) return;
    _t48ListenersProntos = true;
    var arena = document.getElementById('t48-arena');
    if (arena) arena.addEventListener('pointerdown', _t48ArenaPointerDown);
    document.addEventListener('keydown', _t48KeyDown);
    window.addEventListener('resize', _t48AoRedimensionar);
    window.addEventListener('orientationchange', _t48AoRedimensionar);
  }

  // ── Preparação da tela (chamada pelo _jogoLoader ao abrir) ──
  function _t48PrepararTela() {
    _t48CriarDOM();
    _t48LigarListeners();
    _t48CancelarArraste();
    _t48Rodando = false;
    var recorde = _t48RecordeGet();
    var recIni = document.getElementById('t48-recorde-inicio'); if (recIni) recIni.textContent = recorde;
    var recEl = document.getElementById('t48-recorde'); if (recEl) recEl.textContent = recorde;
    _t48AtualizarHud();
    _t48MostrarOverlay('inicio');
  }
  function _t48Parar() {
    _t48Rodando = false;
    _t48CancelarArraste();
  }

  window._t48Comecar = _t48Comecar;
  window._t48Retry = _t48Retry;

  // API pública consumida pelo loader do app (_jogoLoader).
  window.Game2048 = {
    preparar: _t48PrepararTela,
    comecar: _t48Comecar,
    parar: _t48Parar
  };
})();
