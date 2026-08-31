/* ═══════════════════════════════════════════════════════════════
   CORRIDA DA CORUJA — módulo de jogo (lazy-loaded) — v4 PRIMEIRA PESSOA
   Endless runner estilo "Into the Dead" em PRIMEIRA PESSOA e LANDSCAPE:
   a câmera são os olhos do sobrevivente correndo pra frente por uma
   Angatuba tomada por zumbis. Você NÃO se vê — vê a arma na base da
   tela, a mira fixa no centro e os zumbis vindo do nevoeiro. Arraste
   o dedo pros lados pra desviar (strafe/gira a visão) e TOQUE pra
   atirar no que estiver sob a mira central. Munição finita (recarga
   no caminho). Pontuação = metros percorridos.

   LANDSCAPE: o motor SEMPRE pensa em paisagem (W > H). A rotação de
   90° pra caber num celular em pé é feita por CSS no wrapper (.cor-rot),
   então este código lê _corW/_corH já como paisagem e não sabe da
   rotação. Quando o aparelho já está deitado, o CSS não rotaciona nada.

   TÉCNICA (pseudo-3D por escala — sem raycasting, roda liso em Android
   fraco): cada entidade tem z (profundidade, 1=fundo → 0=na cara). A
   cada frame z diminui (vem em direção à câmera). A projeção converte
   z + posição lateral do mundo (camX, movida pelo strafe) em (x,y,s)
   de tela, convergindo pro ponto de fuga no horizonte. Colisão = zumbi
   chega em z~0 perto do centro da visão. Mira = ponto central fixo;
   o tiro acerta o zumbi mais próximo cujo x projetado esteja sob a mira.

   ─── MUDANÇAS DA v4 ────────────────────────────────────────────
   0) O BUG DE VERDADE — CHAVE TROCADA: _COR_SHEETS era indexado por
      'zumbi-normal' | 'zumbi-rapido' | 'zumbi-forte', mas o desenho
      procurava o sheet por zb.tipo, que vale 'normal' | 'rapido' |
      'forte'. Resultado: _COR_SHEETS['normal'] === undefined, o registro
      voltava vazio, _corDrawSheetFrame devolvia false e o jogo caía no
      boneco vetorial SEMPRE — mesmo com os arquivos no ar e baixados
      (o preload usava a chave longa, então as imagens até chegavam;
      só nunca eram desenhadas). Agora as chaves são as MESMAS de
      _COR_TIPOS e o diag percorre _COR_TIPOS, pra essa divergência não
      poder mais se esconder.
   0b) FUNDO CHAPADO: os sheets exportados do render 3D vêm com fundo
      cinza claro opaco, o que colocaria um retângulo claro em volta de
      cada zumbi no campo escuro. Na carga, o fundo é apagado por flood
      fill a partir das bordas — o que preserva os brancos internos
      (olhos). Feito uma vez só, adiantado na tela inicial.

   ─── MUDANÇAS DA v3 ────────────────────────────────────────────
   1) ZUMBI INVISÍVEL (o bug): o sprite era ancorado em (p.y - hpx) e
      desenhado com altura 2*hpx. Resultado: os pés ficavam grudados na
      linha do horizonte e o corpo crescia PRA CIMA, saindo pelo topo da
      tela conforme o zumbi se aproximava — ou seja, ele nunca "descia"
      pro chão e sumia de vista. Agora o pé é ancorado exatamente em
      p.y (o ponto de contato com o solo), igual ao fallback vetorial.
   2) SHEET INTERPRETADO ERRADO: o código assumia CEGAMENTE 12 frames
      lado a lado. Se o arquivo não for uma tira horizontal de 12 (por
      ex.: um webp animado, uma imagem única ou uma grade 4×3), ele
      recortava 1/12 da largura e esticava — virava uma tirinha fina
      e ilegível. Agora _corLayoutSheet olha a proporção real da imagem
      e descobre sozinho o arranjo (tira horizontal, tira vertical,
      grade ou imagem única). Use CorridaGame.diag() no console pra ver
      o que ele detectou em cada arquivo.
   3) SOM PRÓPRIO: o tiro usava som.acerto() (um blip de acerto genérico
      dos outros jogos, que soava errado). Agora o jogo tem seu próprio
      naipe sintetizado em Web Audio — estampido do tiro, impacto na
      carne, clique seco de pente vazio, passos e rosnado na morte.
      Continua respeitando o botão de mudo global (AngatubaSom.ativo()).
   4) PERFORMANCE: o HUD era reescrito no DOM 3× por frame (60fps × 3
      textContent + 3 getElementById + 1 leitura de localStorage). Agora
      só escreve quando o valor muda, com os elementos e o recorde em
      cache. A mira e o tiro também reaproveitam a projeção já calculada
      no desenho, em vez de reprojetar todos os zumbis de novo.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     ASSETS opcionais (o jogo funciona 100% em vetor). Base:
     /Jogos/assets/corrida/ (J maiúsculo; GitHub Pages é case-sensitive).
       zumbi-normal-sheet.webp | zumbi-rapido-sheet.webp | zumbi-forte-sheet.webp
       municao.webp        → caixa de recarga no chão
       arma.webp           → sprite da arma em 1a pessoa (base da tela)
       cenario-floresta.webp → cenário inteiro (céu, lua, árvores mortas e
                             chão/trilha), fundo estático cobrindo o canvas
                             todo em "cover fit"; SEM remoção de fundo —
                             é imagem opaca, não sprite recortado
     Se faltar/falhar, usa fallback vetorial.
  ══════════════════════════════════════════════════════════════ */
  var _COR_ASSET_BASE = '/Jogos/assets/corrida/';
  var _corAssets = {};

  // Metadados dos spritesheets animados (zumbis). "frames" é só um PALPITE:
  // se a proporção da imagem não bater com uma tira de N frames, o
  // _corLayoutSheet corrige sozinho (inclusive tratando o arquivo como
  // uma imagem única). Isso evita o zumbi virar uma tirinha invisível.
  // ATENÇÃO: as chaves aqui têm que ser EXATAMENTE as mesmas de _COR_TIPOS
  // ('normal' | 'rapido' | 'forte'), porque o desenho procura o sheet por
  // zb.tipo. Era justamente essa divergência (chave 'zumbi-normal' aqui
  // contra tipo 'normal' lá) que fazia o sheet NUNCA ser usado: o preload
  // baixava os arquivos com a chave longa e, na hora de desenhar, o jogo
  // procurava por 'normal', achava undefined e caía no boneco vetorial
  // pra sempre. O nome do arquivo mora em "arquivo".
  var _COR_SHEETS = {
    normal: { arquivo: 'zumbi-normal-sheet.webp', frames: 12, fps: 10 },
    rapido: { arquivo: 'zumbi-rapido-sheet.webp', frames: 12, fps: 12 },
    forte:  { arquivo: 'zumbi-forte-sheet.webp',  frames: 12, fps: 8 }
  };

  // Carrega uma imagem, tentando VÁRIOS nomes em cascata. Isso torna o jogo
  // tolerante a arquivos que subiram com o nome normalizado (sem hífens) —
  // GitHub Pages é case- e hífen-sensitive, então um nome errado dá 404 e o
  // asset nunca aparece. Passamos as variantes e a primeira que carregar vence.
  function _corAssetMulti(nomes) {
    var chave = nomes.join('|');
    if (_corAssets[chave]) return _corAssets[chave];
    var reg = { img: null, ok: false, w: 0, h: 0, nomeOk: null, erro: null };
    _corAssets[chave] = reg;
    var i = 0;
    function tentar() {
      if (i >= nomes.length) { reg.ok = false; reg.erro = '404 em todos os nomes'; return; }
      var nome = nomes[i++];
      try {
        var im = new Image();
        im.onload = function () {
          reg.ok = true; reg.img = im; reg.nomeOk = nome;
          reg.w = im.naturalWidth || 0; reg.h = im.naturalHeight || 0;
        };
        im.onerror = function () { tentar(); };   // 404 → tenta o próximo nome
        im.src = _COR_ASSET_BASE + nome;
        if (!reg.img) reg.img = im;               // provisório até carregar
      } catch (e) { tentar(); }
    }
    tentar();
    return reg;
  }

  // Gera as variantes de nome de um arquivo: com hífen (original) e sem
  // separadores (caso o upload tenha normalizado).
  function _corVariantes(nome) {
    var v = [nome];
    var semHifen = nome.replace(/-/g, '');
    if (semHifen !== nome) v.push(semHifen);
    var comUnderscore = nome.replace(/-/g, '_');
    if (comUnderscore !== nome) v.push(comUnderscore);
    return v;
  }

  // Carrega uma imagem estática simples (arma, munição, ou um spritesheet),
  // já tentando as variantes de nome.
  function _corAsset(nome) {
    return _corAssetMulti(_corVariantes(nome));
  }

  // Sprites do burst de partículas do efeitos.js (impacto no zumbi, coleta
  // de munição) — mesmo pool usado em Blocos/Doces. Carregados uma vez em
  // _corPreparar via efeitos.carregarSprites (pela ponte AngatubaGames,
  // não o efeitos.js direto). Enquanto não carregam (ou se falharem), os
  // 3 call-sites de estrelas()/confete() já existentes caem sozinhos pro
  // círculo colorido padrão — retrocompatível, nenhum deles muda de posição.
  var _COR_SPRITES_FX_URLS = [
    '/Jogos/assets/particulas/brilho/circle_01.webp',
    '/Jogos/assets/particulas/brilho/circle_02.webp',
    '/Jogos/assets/particulas/brilho/flare_01.webp',
    '/Jogos/assets/particulas/brilho/magic_01.webp',
    '/Jogos/assets/particulas/brilho/magic_04.webp',
    '/Jogos/assets/particulas/brilho/muzzle_01.webp',
    '/Jogos/assets/particulas/brilho/muzzle_03.webp',
    '/Jogos/assets/particulas/brilho/spark_01.webp',
    '/Jogos/assets/particulas/brilho/spark_02.webp',
    '/Jogos/assets/particulas/brilho/spark_03.webp',
    '/Jogos/assets/particulas/brilho/star_01.webp',
    '/Jogos/assets/particulas/brilho/star_04.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff00.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff01.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff02.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff03.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff04.webp',
    '/Jogos/assets/particulas/fumaca/whitePuff05.webp'
  ];
  var _corSpritesFx = null;
  function _corCarregarSpritesFx() {
    var fx = window.AngatubaGames && window.AngatubaGames.efeitos;
    if (!fx || !fx.carregarSprites || _corSpritesFx) return;
    fx.carregarSprites(_COR_SPRITES_FX_URLS).then(function (imgs) {
      _corSpritesFx = imgs;
    }).catch(function () {}); // silencioso — sem sprites, os bursts usam o fallback
  }
  function _corOpcoesFx() {
    return _corSpritesFx ? { sprites: _corSpritesFx } : undefined;
  }

  /* ── Fundo chapado → transparente ───────────────────────────────
     Vários sheets exportados de render 3D vêm com o fundo CHAPADO
     (cinza claro/branco) em vez de alfa. Desenhados no campo escuro,
     viram um retângulo claro em volta do zumbi — fica horrível.

     Aqui, UMA ÚNICA VEZ no carregamento, copiamos a imagem pra um
     canvas e apagamos o fundo por preenchimento a partir das BORDAS
     (flood fill). Usar as bordas — e não "toda cor clara" — preserva
     os brancos de DENTRO do desenho: os olhos do zumbi continuam lá.

     Só age quando os quatro cantos são opacos E da mesma cor (sinal
     claro de fundo chapado). Se o arquivo já tiver alfa, ou se o
     canvas falhar por qualquer motivo, devolve null e o jogo usa a
     imagem original — nunca fica pior do que estava.
  ─────────────────────────────────────────────────────────────── */
  function _corSemFundo(img) {
    try {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h || w * h > 4194304) return null;   // >4MP: não vale o custo
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var c = cv.getContext('2d');
      if (!c) return null;
      c.drawImage(img, 0, 0);
      var id = c.getImageData(0, 0, w, h);
      var d = id.data, N = w * h;
      // Os quatro cantos: se algum já é transparente, o arquivo está certo.
      var cantos = [0, (w - 1) * 4, (N - w) * 4, (N - 1) * 4];
      var i, o;
      for (i = 0; i < 4; i++) if (d[cantos[i] + 3] < 250) return null;
      var r0 = d[0], g0 = d[1], b0 = d[2];
      var TOL = 46 * 46;
      for (i = 1; i < 4; i++) {
        o = cantos[i];
        var ar = d[o] - r0, ag = d[o + 1] - g0, ab = d[o + 2] - b0;
        if (ar * ar + ag * ag + ab * ab > TOL) return null;   // cantos diferentes
      }
      var vis = new Uint8Array(N);
      var fila = new Int32Array(N);
      var ini = 0, fim = 0;
      function por(px) {
        if (px < 0 || px >= N || vis[px]) return;
        var q = px * 4;
        var dr = d[q] - r0, dg = d[q + 1] - g0, db = d[q + 2] - b0;
        if (dr * dr + dg * dg + db * db > TOL) return;
        vis[px] = 1; fila[fim++] = px;
      }
      var x, y;
      for (x = 0; x < w; x++) { por(x); por((h - 1) * w + x); }
      for (y = 0; y < h; y++) { por(y * w); por(y * w + w - 1); }
      while (ini < fim) {
        var p = fila[ini++];
        d[p * 4 + 3] = 0;
        x = p % w; y = (p / w) | 0;
        if (x > 0) por(p - 1);
        if (x < w - 1) por(p + 1);
        if (y > 0) por(p - w);
        if (y < h - 1) por(p + w);
      }
      if (!fim) return null;
      c.putImageData(id, 0, 0);
      return cv;
    } catch (e) { return null; }   // canvas "tainted" ou memória: segue com a original
  }

  // Fonte de pixels de um asset: o canvas com fundo removido, se deu certo,
  // senão a própria imagem. Resolvido preguiçosamente na 1a vez que desenha.
  function _corFonte(reg) {
    if (!reg || !reg.ok || !reg.img) return null;
    if (reg.fonte === undefined) {
      var limpo = _corSemFundo(reg.img);
      reg.fonte = limpo || reg.img;
      reg.fundoRemovido = !!limpo;
    }
    return reg.fonte;
  }

  /* ── Descoberta do LAYOUT do spritesheet ────────────────────────
     Recebe as dimensões reais da imagem carregada e quantos frames o
     metadado DIZ que existem, e devolve como os frames estão arrumados:
       { c: colunas, r: linhas, n: total de frames }
     Testa os arranjos plausíveis (tira horizontal, tira vertical, grades
     c×r com c*r = n) e também a hipótese "não é sheet nenhum, é uma
     imagem só" (1×1). Vence o arranjo cujo FRAME fique com a proporção
     mais parecida com a de uma pessoa em pé (~0.55 de largura/altura).

     Por que isso importa: se o arquivo for um webp ANIMADO (o canvas só
     enxerga o primeiro quadro) ou uma imagem única, dividir a largura
     por 12 recorta uma fatia estreitíssima e o zumbi some da tela. Com a
     detecção, o pior caso vira "aparece parado" em vez de "não aparece".
  ─────────────────────────────────────────────────────────────── */
  var _COR_AR_ALVO = 0.55;   // largura/altura típica de um humanoide em pé
  function _corLayoutSheet(w, h, nDeclarado) {
    var melhor = { c: 1, r: 1, n: 1, erro: 1e9 };
    if (!w || !h) return melhor;
    function testar(c, r, quantos, peso) {
      var ar = (w / c) / (h / r);
      if (!isFinite(ar) || ar <= 0) return;
      var erro = Math.abs(Math.log(ar / _COR_AR_ALVO)) * peso;
      if (erro < melhor.erro) melhor = { c: c, r: r, n: quantos, erro: erro };
    }
    testar(1, 1, 1, 1.0);                     // hipótese "imagem única"
    var n = Math.max(1, nDeclarado | 0);
    for (var c = 1; c <= n; c++) {
      if (n % c) continue;                    // só grades exatas
      testar(c, n / c, n, 0.85);              // leve preferência pelo sheet
    }
    return melhor;
  }

  // Prepara o spritesheet de um zumbi (carrega a imagem única). Idempotente.
  // O layout só é resolvido DEPOIS que a imagem carrega (precisa das
  // dimensões reais), por isso _corSheetPronto() faz a resolução preguiçosa.
  function _corSheet(tipoKey) {
    var chave = '__sheet_' + tipoKey;
    if (_corAssets[chave]) return _corAssets[chave];
    var meta = _COR_SHEETS[tipoKey];
    var reg = { sheet: null, decl: 0, lay: null, durFrame: 100, ok: false };
    _corAssets[chave] = reg;
    if (!meta) return reg;
    reg.decl = meta.frames;
    reg.durFrame = 1000 / (meta.fps || 10);
    reg.sheet = _corAsset(meta.arquivo);   // carrega a imagem do sheet
    return reg;
  }

  // Devolve o registro do sheet SÓ se ele estiver pronto pra desenhar
  // (imagem carregada + layout já deduzido). Senão devolve null.
  function _corSheetPronto(tipoKey) {
    var reg = _corSheet(tipoKey);
    if (!reg || !reg.sheet || !reg.sheet.ok || !reg.sheet.img) return null;
    if (!reg.lay) {
      var img = reg.sheet.img;
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) return null;
      reg.lay = _corLayoutSheet(w, h, reg.decl);
      reg.lay.fw = w / reg.lay.c;
      reg.lay.fh = h / reg.lay.r;
      reg.ok = true;
    }
    return reg;
  }

  // Desenha o frame animado atual de um spritesheet no contexto. Retorna true
  // se desenhou (sheet pronto), false se ainda não carregou (usar fallback).
  // (dx,dy) = canto sup-esq do destino; (dw,dh) = tamanho no destino.
  function _corDrawSheetFrame(ctx, tipoKey, tMs, dx, dy, dw, dh) {
    var reg = _corSheetPronto(tipoKey);
    if (!reg) return false;
    var lay = reg.lay;
    var idx = 0;
    if (lay.n > 1) {
      var total = lay.n * reg.durFrame;
      idx = Math.floor(((tMs % total) + total) % total / reg.durFrame);
      if (idx < 0) idx = 0; if (idx >= lay.n) idx = lay.n - 1;
    }
    var col = idx % lay.c, lin = (idx / lay.c) | 0;
    var fonte = _corFonte(reg.sheet);
    if (!fonte) return false;
    ctx.drawImage(fonte, col * lay.fw, lin * lay.fh, lay.fw, lay.fh, dx, dy, dw, dh);
    return true;
  }

  // Proporção (w/h) de um frame do sheet, pra não distorcer.
  function _corSheetRatio(tipoKey) {
    var reg = _corSheetPronto(tipoKey);
    if (!reg || !reg.lay.fh) return _COR_AR_ALVO;
    return reg.lay.fw / reg.lay.fh;
  }

  /* ══════════════════════════════════════════════════════════════
     SOM DO JOGO (Web Audio sintetizado, sem baixar nenhum arquivo).
     Os outros jogos usam AngatubaSom (blips alegres de acerto/erro).
     Num shooter de zumbi isso soa errado: aqui o tiro precisa de
     estampido. Então a Corrida tem seu próprio naipe, gerado na hora:
       tiro     → ruído branco filtrado (o "crack") + seno grave
                  despencando (o "soco" no peito) + cauda curta
       impacto  → thud abafado; se matou, ganha um estalo mais grave
       vazio    → dois cliques metálicos secos (gatilho sem munição)
       passo    → sopro curtíssimo e baixinho, no ritmo da passada
       recarga  → duas notas subindo (pegou a caixa)
       morte    → rosnado grave descendo
     Respeita o mudo global: se AngatubaSom existir e estiver desligado,
     tudo aqui vira no-op. O AudioContext é criado preguiçosamente e
     acordado no primeiro toque (exigência do iOS/Android).
  ══════════════════════════════════════════════════════════════ */
  var _corAC = null, _corMaster = null, _corRuidoBuf = null;

  function _corSomLigado() {
    var S = window.AngatubaSom;
    if (S && typeof S.ativo === 'function') { try { return !!S.ativo(); } catch (e) { return true; } }
    return true;   // sem o módulo global carregado, o jogo toca normalmente
  }
  function _corAudio() {
    if (_corAC) return _corAC;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _corAC = new AC();
      _corMaster = _corAC.createGain();
      _corMaster.gain.value = 0.85;
      _corMaster.connect(_corAC.destination);
    } catch (e) { _corAC = null; }
    return _corAC;
  }
  // Chamado dentro de um gesto do usuário (toque/clique). Sem isso o
  // contexto nasce "suspended" e nenhum som sai.
  function _corAudioDestravar() {
    var ac = _corAudio();
    if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
  }
  // 1 segundo de ruído branco, gerado uma vez e reaproveitado em todos
  // os disparos (criar buffer por tiro cansaria o GC no Android fraco).
  function _corRuido(ac) {
    if (_corRuidoBuf) return _corRuidoBuf;
    var n = Math.floor(ac.sampleRate * 1.0);
    var buf = ac.createBuffer(1, n, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    _corRuidoBuf = buf;
    return buf;
  }
  // Helper: dispara um trecho de ruído passando por passa-baixa + ganho.
  function _corSopro(ac, t, dur, fIni, fFim, vol, hpF) {
    var src = ac.createBufferSource();
    src.buffer = _corRuido(ac);
    src.playbackRate.value = 1;
    var lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(fIni, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(60, fFim), t + dur);
    var no = lp;
    if (hpF) {
      var hp = ac.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = hpF;
      lp.connect(hp); no = hp;
    }
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); no.connect(g); g.connect(_corMaster);
    // Começa num ponto aleatório do buffer: dois tiros seguidos nunca
    // soam exatamente iguais.
    src.start(t, Math.random() * 0.8, dur + 0.05);
    src.stop(t + dur + 0.06);
  }
  // Helper: um oscilador com envelope de ataque rápido e queda.
  function _corTom(ac, t, tipo, f0, f1, dur, vol) {
    var o = ac.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(_corMaster);
    o.start(t); o.stop(t + dur + 0.04);
  }

  function _corSomTiro() {
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    _corSopro(ac, t, 0.18, 5600, 300, 0.80, 170);   // estampido
    _corTom(ac, t, 'sine', 170, 40, 0.14, 0.55);    // corpo grave
    _corSopro(ac, t + 0.05, 0.26, 1100, 160, 0.14); // cauda/eco no campo
  }
  function _corSomImpacto(matou) {
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime + 0.02;
    _corSopro(ac, t, 0.09, 900, 200, 0.34);
    _corTom(ac, t, 'triangle', matou ? 120 : 190, matou ? 45 : 110, matou ? 0.20 : 0.08, 0.30);
  }
  function _corSomVazio() {
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    _corSopro(ac, t, 0.035, 4200, 1800, 0.30, 900);
    _corSopro(ac, t + 0.07, 0.03, 3400, 1500, 0.20, 900);
  }
  function _corSomPasso() {
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac || ac.state !== 'running') return;
    var t = ac.currentTime;
    _corSopro(ac, t, 0.07, 620 + Math.random() * 180, 120, 0.085);
  }
  function _corSomRecarga() {
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    _corTom(ac, t, 'square', 520, 520, 0.06, 0.16);
    _corTom(ac, t + 0.08, 'square', 780, 780, 0.09, 0.16);
  }
  function _corSomMorte() {
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    _corTom(ac, t, 'sawtooth', 210, 42, 0.55, 0.30);
    _corSopro(ac, t, 0.45, 1400, 130, 0.30);
  }

  /* ── Estado / canvas ──────────────────────────────────────────── */
  var _corCanvas = null, _corCtx = null;
  var _corW = 640, _corH = 360, _corDpr = 1;
  var _corEstado = 'inicio';
  var _corRAF = 0, _corLast = 0;
  var _corFontesTimer = 0; // handle do setInterval de _corPrepararFontes (evita duplicar)
  var _corListenersOn = false, _corResizeOn = false;
  var _corResizeTimers = []; // handles da cascata de remedição pós-rotação (ver A2.22)
  var _corRelogio = 0;    // tempo global (ms) p/ escolher frame das animações

  /* ── Config do mundo pseudo-3D (1a pessoa) ────────────────────── */
  var _COR_Z_FAR = 1.0;
  var _COR_HORIZ = 0.46;
  var _corCamX = 0, _corCamVX = 0;
  var _COR_CAM_LIM = 6.0;   // bem largo: sensação de campo livre (zumbis
                            // nascem relativos à câmera, então nunca "acaba")

  /* ── Head-bob / passada (sensação de correr, estilo Into the Dead) ─
     A passada avança proporcional à velocidade. Dela derivamos:
       bobY  = câmera sobe/desce (2 passos por ciclo → freq dobrada)
       swayX = micro-inclinação lateral, 1 por passo (freq simples)
     Mantido SUTIL pra não enjoar. */
  var _corPasso = 0;            // fase acumulada da passada
  var _corPassoUlt = 0;         // último meio-ciclo tocado (som do pé no chão)
  var _corBobY = 0;            // deslocamento vertical corrente (px, calc no draw)
  var _corSwayX = 0;           // deslocamento lateral corrente (px, calc no draw)

  /* ── Corrida / dificuldade ────────────────────────────────────── */
  var _corDist = 0;
  var _corVel = 0;
  // Calibrado pra dar TEMPO DE VER E DESVIAR (Into the Dead):
  //   início  → zumbi normal leva ~9s do horizonte até você
  //   máximo  → ~5s (ainda confortável), atingido bem devagar
  var _COR_VEL_INI = 0.105, _COR_VEL_MAX = 0.19, _COR_VEL_ACC = 0.0012;

  /* ── Munição / tiro ───────────────────────────────────────────── */
  var _COR_MUN_INI = 12;
  var _corMun = _COR_MUN_INI;
  var _COR_TIRO_CD = 0.14;
  var _corTiroT = 0, _corFlashT = 0, _corRecuo = 0;

  /* ── Entidades ────────────────────────────────────────────────── */
  var _corZumbis = [];
  var _corItens = [];
  var _corSangue = [];
  var _corSpawnT = 0, _corItemT = 0;

  // Campo ABERTO: os zumbis nascem em qualquer x lateral contínuo dentro
  // deste range (em unidades de faixa; -1.6..1.6 cobre além das bordas pra
  // eles entrarem/saírem de campo naturalmente). Sem faixas discretas.
  var _COR_CAMPO_LAT = 1.6;
  // População alvo de zumbis vivos na tela (mantém 3-6 visíveis).
  var _COR_POP_MIN = 4, _COR_POP_MAX = 7;

  var _COR_TIPOS = {
    normal: { hp: 1, w: 0.16, cor: '#6f7d5a', corEsc: '#4b5640', vel: 1.00 },
    rapido: { hp: 1, w: 0.13, cor: '#8a6f3a', corEsc: '#5e4b26', vel: 1.35 },
    forte:  { hp: 3, w: 0.24, cor: '#5a6f6b', corEsc: '#3c4b48', vel: 0.80 }
  };

  // Meia-largura da "pista" que conta como colisão (faixa lateral em que,
  // se o zumbi chegar em z~0 dentro dela, é GAME OVER). Função só pra não
  // duplicar a fórmula entre o teste de colisão de verdade e o aviso visual
  // (_corDrawZumbi) — as duas TÊM que usar exatamente o mesmo número, senão
  // o aviso mente (acende perigo num zumbi que ia passar reto, ou o
  // contrário).
  function _corMeiaColisao(tipo) { return (_COR_TIPOS[tipo].w * 0.5) + 0.20; }

  /* ── Persistência ─────────────────────────────────────────────── */
  var _COR_REC_KEY = 'angatuba_corrida_rec';
  var _corRecCache = null;      // evita ler localStorage a cada frame
  function _corRec() {
    if (_corRecCache !== null) return _corRecCache;
    try { _corRecCache = Math.max(0, Math.round(Number(localStorage.getItem(_COR_REC_KEY)) || 0)); }
    catch (e) { _corRecCache = 0; }
    return _corRecCache;
  }
  function _corRecSet(v) {
    _corRecCache = Math.round(v);
    try { localStorage.setItem(_COR_REC_KEY, String(_corRecCache)); } catch (e) {}
  }

  /* ── Utils ────────────────────────────────────────────────────── */
  function _corClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function _corRand(a, b) { return a + Math.random() * (b - a); }

  // Projeção pseudo-3D em 1a pessoa. z:0(perto)..1(longe); faixa:-1..1.
  // Devolve o ponto onde a entidade TOCA O CHÃO (x,y) e a escala s.
  function _corProj(z, faixa) {
    var W = _corW, H = _corH;
    var zc = _corClamp(z, 0, _COR_Z_FAR) / _COR_Z_FAR;
    // Head-bob empurra o horizonte pra baixo quando a câmera "sobe" no
    // passo (a cena inteira sobe/desce junto). Sway empurra lateral.
    var horizonY = H * _COR_HORIZ + _corBobY * H;
    var baseY = H * 1.06 + _corBobY * H;
    var t = 1 - zc;
    var tt = t * t;
    var y = horizonY + (baseY - horizonY) * tt;
    var s = 0.14 + 0.95 * tt;
    var espalhar = 0.08 + 0.92 * tt;
    var cx = W * 0.5 - _corCamX * (W * 0.42) * espalhar + _corSwayX * W * espalhar;
    var x = cx + faixa * (W * 0.42) * espalhar;
    return { x: x, y: y, s: s, t: t };
  }

  /* ══════════════════════════════════════════════════════════════
     DIMENSIONAMENTO. A arena pode estar rotacionada por CSS; usamos
     offsetWidth/Height do canvas (ignoram o transform), que já vêm em
     paisagem porque o CSS dimensiona o .cor-rot em landscape.
  ══════════════════════════════════════════════════════════════ */
  function _corDimensionar() {
    if (!_corCanvas) return;
    var cssW, cssH;
    // Com lock nativo (APK girado), o offsetWidth do canvas pode demorar a
    // refletir o giro. Medimos preferencialmente pelo PALCO (que é o container
    // real e já está com o tamanho da tela girada); se falhar, viewport; por
    // último, offsetWidth do canvas.
    var palco = document.getElementById('cor-palco');
    if (_corLockNativo && palco) {
      var pr = palco.getBoundingClientRect();
      cssW = Math.round(pr.width) || _corCanvas.offsetWidth || 640;
      cssH = Math.round(pr.height) || _corCanvas.offsetHeight || 360;
    } else {
      cssW = _corCanvas.offsetWidth || 640;
      cssH = _corCanvas.offsetHeight || 360;
    }
    if (cssW < 2) cssW = 640;
    if (cssH < 2) cssH = 360;
    _corDpr = Math.min(2, window.devicePixelRatio || 1);
    _corCanvas.width = Math.round(cssW * _corDpr);
    _corCanvas.height = Math.round(cssH * _corDpr);
    _corW = cssW; _corH = cssH;
    if (_corCtx) _corCtx.setTransform(_corDpr, 0, 0, _corDpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════
     RESET
  ══════════════════════════════════════════════════════════════ */
  function _corReset() {
    _corDist = 0; _corVel = _COR_VEL_INI;
    _corMun = _COR_MUN_INI;
    _corTiroT = 0; _corFlashT = 0; _corRecuo = 0;
    _corCamX = 0; _corCamVX = 0;
    _corPasso = 0; _corPassoUlt = 0;
    _corZumbis.length = 0; _corItens.length = 0; _corSangue.length = 0;
    _corSpawnT = 0.9; _corItemT = 4.5;
    _corAtualizarHUD(true);
  }

  /* HUD — antes isto rodava 3 getElementById + 3 textContent + 1
     localStorage.getItem A CADA FRAME (180 escritas de DOM por segundo).
     Em Android fraco isso sozinho já engasgava o loop. Agora os elementos
     ficam em cache e só escrevemos quando o valor realmente muda. */
  var _corElDist = null, _corElMun = null, _corElRec = null;
  var _corHudUlt = { d: -1, m: -1, r: -1 };
  function _corAtualizarHUD(forcar) {
    if (forcar || !_corElDist) {
      _corElDist = document.getElementById('cor-dist');
      _corElMun  = document.getElementById('cor-mun');
      _corElRec  = document.getElementById('cor-recorde');
    }
    var dv = Math.floor(_corDist);
    if (_corElDist && (forcar || dv !== _corHudUlt.d)) { _corElDist.textContent = dv + 'm'; _corHudUlt.d = dv; }
    if (_corElMun && (forcar || _corMun !== _corHudUlt.m)) { _corElMun.textContent = _corMun; _corHudUlt.m = _corMun; }
    var rv = _corRec();
    if (_corElRec && (forcar || rv !== _corHudUlt.r)) { _corElRec.textContent = rv + 'm'; _corHudUlt.r = rv; }
  }

  /* ══════════════════════════════════════════════════════════════
     SPAWN
  ══════════════════════════════════════════════════════════════ */
  function _corSpawnZumbi() {
    var d = _corDist;
    // Antes o mix de tipos saturava cedo (~d=840/1100) e ficava parado
    // dali pra frente — quem sobrevivia mais tempo sentia o jogo "empacar"
    // em vez de continuar ficando mais difícil. Teto mais alto e rampa
    // mais longa: continua ficando mais puxado por mais tempo de jogo,
    // sem mexer no ritmo de corrida em si (isso já era calibrado pra ser
    // "confortável", ver comentário perto de _COR_VEL_MAX).
    var pRapido = _corClamp(0.08 + d / 5000, 0.08, 0.42);
    var pForte  = _corClamp(0.04 + d / 7000, 0.04, 0.34);
    var r = Math.random();
    var tipo = (r < pForte) ? 'forte' : ((r < pForte + pRapido) ? 'rapido' : 'normal');
    var def = _COR_TIPOS[tipo];
    // Campo aberto: zumbis nascem RELATIVOS à posição da câmera (sempre no
    // teu campo de visão atual), pra o campo nunca "acabar" quando você anda
    // muito pro lado. Espalhados numa faixa de ±1.6 ao redor de onde olha.
    var faixa = _corCamX + _corRand(-_COR_CAMPO_LAT, _COR_CAMPO_LAT);
    // z inicial variado (perto de Z_FAR, mas escalonado) pra não nascerem
    // todos na mesma linha de profundidade.
    var z = _COR_Z_FAR - _corRand(0, 0.18);
    _corZumbis.push({
      z: z, faixa: faixa, tipo: tipo,
      hp: def.hp, morto: false, cai: 0, bob: Math.random() * Math.PI * 2,
      // defasagem da animação: sem isso a horda inteira dá o mesmo passo
      // no mesmo instante e parece um só zumbi clonado.
      fase: Math.random() * 4000,
      // deriva lateral lenta (cambaleio pelo campo)
      swayA: (tipo === 'forte') ? _corRand(0.01, 0.03) : _corRand(0.03, 0.08),
      swayF: _corRand(0.8, 1.8), swayP: Math.random() * Math.PI * 2,
      // cada zumbi tem uma leve variação de velocidade individual
      velVar: _corRand(0.85, 1.15),
      // projeção do último frame desenhado (reaproveitada pela mira e
      // pelo tiro — o que você VÊ é exatamente o que você acerta)
      _px: 0, _py: 0, _ps: 0, _vis: false
    });
  }
  function _corSpawnItem() {
    // Relativo à câmera, como os zumbis — senão você anda pro lado e nunca
    // mais encontra munição.
    _corItens.push({ z: _COR_Z_FAR, faixa: _corCamX + _corRand(-1.0, 1.0), bob: Math.random() * Math.PI * 2 });
  }

  /* ══════════════════════════════════════════════════════════════
     TIRO — mira central fixa. Usa a projeção do último frame (a que o
     jogador está vendo na tela), em vez de reprojetar tudo de novo.
  ══════════════════════════════════════════════════════════════ */
  /* Quem está DE FATO sob a mira central, em X e Y — usado tanto pra pintar
     o reticulo de vermelho (_corDrawMira) quanto pro tiro de verdade
     (_corAtirar). ANTES cada um tinha sua própria conta e elas divergiam:
     a mira checava X e Y, o tiro só checava X. Resultado: o tiro acertava
     zumbi que estava fora da faixa vertical da mira (um lá no horizonte
     enquanto você mirava embaixo, por exemplo) — o "zumbi que nem tava na
     reta do tiro e morre". Uma função só pras duas coisas garante que o
     que acende vermelho é exatamente o que o gatilho acerta.

     JANELA VERTICAL = altura de verdade do sprite (pés até a cabeça, mais
     uma folga), não um número fixo em fração de H. A versão antiga da mira
     usava uma faixa fixa (cy±0.2H/0.3H) que parecia razoável mas CORTAVA
     zumbis muito perto: perto do fim (z→0.05) o pé projetado passa de
     ~0.80H rapidinho (a projeção manda o zumbi "sair por baixo" da tela
     conforme ele chega em cima de você), e a faixa fixa não ia longe o
     bastante — o zumbi mais perigoso, bem na sua cara, virava impossível
     de acertar. Usando a altura real (mesma conta de _corDrawZumbi) a
     janela cresce junto com o zumbi conforme ele se aproxima.

     Entre vários zumbis dentro da tolerância, fica com o mais PERTO (menor
     z) — é o que "está na frente" dos outros, faz mais sentido ser o alvo. */
  function _corMiraAlvo(W, H) {
    var cx = W * 0.5, cy = H * (_COR_HORIZ + 0.14);
    var alvo = null, melhorZ = 1e9;
    for (var i = 0; i < _corZumbis.length; i++) {
      var zb = _corZumbis[i];
      if (zb.morto || !zb._vis) continue;
      var tolX = W * 0.08 + _COR_TIPOS[zb.tipo].w * W * 0.5 * zb._ps;
      if (Math.abs(zb._px - cx) > tolX) continue;
      var hpxZ = 0.5 * H * zb._ps * 0.94;
      var altura = hpxZ * _COR_ALT_MUL, folga = hpxZ * 0.35;
      if (cy < zb._py - altura - folga || cy > zb._py + folga) continue;
      if (zb.z < melhorZ) { melhorZ = zb.z; alvo = zb; }
    }
    return alvo;
  }

  function _corAtirar() {
    if (_corEstado !== 'jogando') return;
    if (_corTiroT > 0) return;
    if (_corMun <= 0) { _corSomVazio(); return; }
    _corMun--; _corTiroT = _COR_TIRO_CD; _corFlashT = 0.09; _corRecuo = 1;
    _corSomTiro();

    var alvo = _corMiraAlvo(_corW, _corH);

    if (alvo) {
      alvo.hp--;
      if (alvo.hp <= 0) {
        alvo.morto = true; alvo.cai = 0.001;
        for (var k = 0; k < 7; k++) {
          _corSangue.push({
            x: alvo._px + _corRand(-16, 16), y: alvo._py - _corRand(6, 40) * alvo._ps,
            r: _corRand(2, 7) * (0.6 + alvo._ps), life: 0.5, max: 0.5
          });
        }
        _corSomImpacto(true);
      } else {
        _corSomImpacto(false);
        if (window.AngatubaGames && window.AngatubaGames.efeitos) {
          window.AngatubaGames.efeitos.estrelas(alvo._px, alvo._py - 20 * alvo._ps, 4, _corOpcoesFx());
        }
      }
    }
    _corAtualizarHUD();
  }

  /* ══════════════════════════════════════════════════════════════
     UPDATE
  ══════════════════════════════════════════════════════════════ */
  function _corUpdate(dt) {
    _corVel = Math.min(_COR_VEL_MAX, _corVel + _COR_VEL_ACC * dt);
    // Distância em "metros": fator reduzido pra dar ritmo de pessoa correndo,
    // não de veículo. Com vel~0.16-0.34 e fator 16, ~5-9 m/s (18-32 km/h no
    // pico), mas começa devagar e a sensação casa com o passo.
    _corDist += _corVel * dt * 16;

    // Passada: avança com a velocidade. ~2.4 passos/seg em vel baixa,
    // acelerando com a corrida. Deriva head-bob e micro-sway.
    _corPasso += dt * (2.6 + _corVel * 1.6) * Math.PI;
    // bobY: 2 subidas por ciclo de passada (pé esq + pé dir). Amplitude
    // pequena, cresce um tico com a velocidade. Valor em fração de H.
    var ampBob = 0.014 + _corVel * 0.004;
    _corBobY = Math.abs(Math.sin(_corPasso)) * ampBob;      // sempre >=0 (só sobe)
    // swayX: 1 balanço por passo, alterna lados. Bem sutil.
    var ampSway = 0.010 + _corVel * 0.003;
    _corSwayX = Math.sin(_corPasso * 0.5) * ampSway;
    // Som do pé no chão: cada meio-ciclo de _corPasso é uma pisada.
    var meioCiclo = Math.floor(_corPasso / Math.PI);
    if (meioCiclo !== _corPassoUlt) { _corPassoUlt = meioCiclo; _corSomPasso(); }

    if (_corTiroT > 0) _corTiroT -= dt;
    if (_corFlashT > 0) _corFlashT -= dt;
    if (_corRecuo > 0) _corRecuo = Math.max(0, _corRecuo - dt * 6);
    _corCamVX *= Math.max(0, 1 - dt * 10);

    // Spawn por POPULAÇÃO: mantém entre POP_MIN e POP_MAX zumbis vivos na
    // tela (campo aberto cheio, estilo Into the Dead). Conta os vivos.
    var vivos = 0;
    for (var vi = 0; vi < _corZumbis.length; vi++) if (!_corZumbis[vi].morto) vivos++;
    _corSpawnT -= dt;
    if (_corSpawnT <= 0) {
      if (vivos < _COR_POP_MIN) {
        // Abaixo do mínimo: repõe rápido (spawna 1-2 de uma vez).
        _corSpawnZumbi();
        if (vivos < _COR_POP_MIN - 1) _corSpawnZumbi();
        _corSpawnT = _corRand(0.25, 0.6);
      } else if (vivos < _COR_POP_MAX) {
        // Entre min e max: spawna esporádico.
        _corSpawnZumbi();
        _corSpawnT = _corRand(0.8, 1.6);
      } else {
        // Cheio: espera esvaziar um pouco.
        _corSpawnT = _corRand(0.5, 1.0);
      }
    }
    _corItemT -= dt;
    if (_corItemT <= 0) { _corSpawnItem(); _corItemT = _corRand(6, 11); }

    var i, zb;
    for (i = _corZumbis.length - 1; i >= 0; i--) {
      zb = _corZumbis[i];
      if (zb.morto) {
        zb.cai += dt;
        if (zb.cai > 0.6) _corZumbis.splice(i, 1);
        continue;
      }
      zb.z -= _corVel * (_COR_TIPOS[zb.tipo].vel) * (zb.velVar || 1) * dt;
      zb.bob += dt * 4;
      zb.swayP += dt * zb.swayF;
      if (zb.z <= 0.05) {
        var meia = _corMeiaColisao(zb.tipo);
        if (Math.abs(zb.faixa - _corCamX) < meia) { _corGameOver(); return; }
        else { _corZumbis.splice(i, 1); continue; }
      }
    }

    for (i = _corItens.length - 1; i >= 0; i--) {
      var it = _corItens[i];
      it.z -= _corVel * dt;
      it.bob += dt * 4;
      if (it.z <= 0.07) {
        if (Math.abs(it.faixa - _corCamX) < 0.32) {
          _corMun = Math.min(99, _corMun + 6);
          _corSomRecarga();
          if (window.AngatubaGames && window.AngatubaGames.efeitos) {
            var pit = _corProj(it.z, it.faixa);
            window.AngatubaGames.efeitos.estrelas(pit.x, pit.y - 16, 8, _corOpcoesFx());
          }
        }
        _corItens.splice(i, 1);
      }
    }

    for (i = _corSangue.length - 1; i >= 0; i--) {
      var sg = _corSangue[i];
      sg.life -= dt; sg.y += dt * 46;
      if (sg.life <= 0) _corSangue.splice(i, 1);
    }
    _corAtualizarHUD();
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER (1a pessoa)
  ══════════════════════════════════════════════════════════════ */
  function _corDraw() {
    if (!_corCtx) return;
    var ctx = _corCtx, W = _corW, H = _corH, horizonY = H * _COR_HORIZ + _corBobY * H;

    // ── Chão (campo) — do horizonte pra baixo, tom escuro esverdeado ──
    // (pintado ANTES do céu/imagem: a imagem desvanece por cima dele perto
    // do horizonte, ver comentário em _corDrawCeuFundo.)
    var gCh = ctx.createLinearGradient(0, horizonY, 0, H);
    gCh.addColorStop(0, '#2f3830'); gCh.addColorStop(0.5, '#232a24'); gCh.addColorStop(1, '#141813');
    ctx.fillStyle = gCh; ctx.fillRect(0, horizonY, W, H - horizonY);

    // Textura sutil do campo correndo (linhas de perspectiva suaves, campo
    // aberto — sem estrada estreita).
    _corDrawCampo(ctx, W, H, horizonY);

    // ── Céu/horizonte: imagem do cenário (lua + árvores mortas + névoa),
    // com fallback vetorial embutido enquanto ela carrega. ──
    _corDrawCeuFundo(ctx, W, H, horizonY);

    // ── Entidades (zumbis + itens) do fundo pra frente ──
    var render = [];
    var i;
    for (i = 0; i < _corItens.length; i++) render.push({ k: 'item', o: _corItens[i], z: _corItens[i].z });
    for (i = 0; i < _corZumbis.length; i++) render.push({ k: 'zumbi', o: _corZumbis[i], z: _corZumbis[i].z });
    render.sort(function (a, b) { return b.z - a.z; });
    for (i = 0; i < render.length; i++) {
      if (render[i].k === 'zumbi') _corDrawZumbi(ctx, render[i].o);
      else _corDrawItem(ctx, render[i].o);
    }

    // ── Névoa densa na faixa do horizonte (esconde o spawn) ──
    // Degradê em "morro" (sobe de 0 e desce pra 0 nas duas pontas) — com
    // stop inicial já em 0.55 dava uma linha reta bem visível onde o
    // fillRect começava (nada de névoa acima, 55% de repente ali embaixo).
    var gFog = ctx.createLinearGradient(0, horizonY - H * 0.08, 0, horizonY + H * 0.30);
    gFog.addColorStop(0, 'rgba(150,155,150,0)'); gFog.addColorStop(0.25, 'rgba(150,155,150,0.55)'); gFog.addColorStop(0.6, 'rgba(140,148,142,0.28)'); gFog.addColorStop(1, 'rgba(140,148,142,0)');
    ctx.fillStyle = gFog; ctx.fillRect(0, horizonY - H * 0.08, W, H * 0.4);

    // ── Respingos de sangue ──
    for (i = 0; i < _corSangue.length; i++) {
      var sg = _corSangue[i];
      ctx.globalAlpha = _corClamp(sg.life / sg.max, 0, 1) * 0.8;
      ctx.fillStyle = '#6a2812';
      ctx.beginPath(); ctx.arc(sg.x, sg.y, sg.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Mato em PRIMEIRO PLANO (silhuetas de grama na base, como Into the
    // Dead) — desenhado ANTES da arma, atrás dela. ──
    _corDrawMato(ctx, W, H);

    // ── Arma + mira ──
    _corDrawArma(ctx, W, H);
    _corDrawMira(ctx, W, H);

    if (_corFlashT > 0) {
      var fx = W * 0.5, fy = H * (0.72 - _corRecuo * 0.03);
      ctx.globalAlpha = _corClamp(_corFlashT / 0.09, 0, 1);
      var gF = ctx.createRadialGradient(fx, fy, 2, fx, fy, H * 0.14);
      gF.addColorStop(0, 'rgba(255,232,150,0.95)'); gF.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = gF; ctx.beginPath(); ctx.arc(fx, fy, H * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Vinheta escura (clima sombrio, mais forte que antes).
    var gV = ctx.createRadialGradient(W * 0.5, H * 0.48, H * 0.28, W * 0.5, H * 0.5, H * 0.9);
    gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  // Floresta de pinheiros (silhuetas serrilhadas) no horizonte.
  function _corDrawFloresta(ctx, W, horizonY) {
    ctx.save();
    ctx.fillStyle = '#181d18';
    var base = horizonY + 2;
    var off = (-_corCamX * (W * 0.08)) % 40;
    var x = -40 - off, seed = 13;
    ctx.beginPath(); ctx.moveTo(-40, base);
    while (x < W + 40) {
      seed = (seed * 9301 + 49297) % 233280;
      var hh = horizonY * (0.06 + (seed / 233280) * 0.14);   // altura da árvore
      var ww = 8 + ((seed >> 4) % 10);                        // largura
      // pinheiro triangular
      ctx.lineTo(x, base);
      ctx.lineTo(x + ww * 0.5, base - hh);
      ctx.lineTo(x + ww, base);
      x += ww * 0.7;
    }
    ctx.lineTo(W + 40, base); ctx.closePath(); ctx.fill();
    // segunda fileira mais clara/distante atrás
    ctx.fillStyle = 'rgba(40,46,44,0.6)';
    var off2 = (-_corCamX * (W * 0.05)) % 30;
    x = -40 - off2; seed = 29;
    ctx.beginPath(); ctx.moveTo(-40, base - horizonY * 0.02);
    while (x < W + 40) {
      seed = (seed * 9301 + 49297) % 233280;
      var hh2 = horizonY * (0.04 + (seed / 233280) * 0.10);
      var ww2 = 7 + ((seed >> 4) % 8);
      ctx.lineTo(x, base - horizonY * 0.02);
      ctx.lineTo(x + ww2 * 0.5, base - horizonY * 0.02 - hh2);
      ctx.lineTo(x + ww2, base - horizonY * 0.02);
      x += ww2 * 0.7;
    }
    ctx.lineTo(W + 40, base - horizonY * 0.02); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* Cenário: imagem estática (lua + árvores mortas + trilha de terra até o
     chão, gerada uma vez fora do jogo) desenhada em "cover fit" cobrindo o
     CANVAS INTEIRO (0..H) — não só o céu. A 2a versão da imagem já vem com
     o chão pintado nela (a 1a era só céu, recortada no horizonte, e dava
     uma emenda visível onde encontrava o gradiente do chão desenhado por
     código). Cobrindo tudo, a base da imagem cai exatamente em H (ancorada
     embaixo), então nunca sobra gap: sem costura, sem precisar de fade.
     Leve parallax pelo strafe, na mesma escala usada pela floresta vetorial.

     _corDraw/_corDrawIdle continuam desenhando o gradiente do chão e o
     _corDrawCampo ANTES de chamar isto — não por costura (não tem mais),
     mas como fallback: se a imagem ainda não carregou, cai no desenho
     vetorial abaixo (só céu, 0..horizonY) e o chão desenhado por código
     continua visível por baixo, exatamente como sempre foi.

     SEM _corFonte()/flood-fill aqui: é uma imagem opaca (não sprite
     recortado) — rodar a remoção de fundo nela trataria a imagem inteira
     como "fundo chapado" e comeria tudo.
  ─────────────────────────────────────────────────────────────── */
  function _corDrawCeuFundo(ctx, W, H, horizonY) {
    var reg = _corAsset('cenario-floresta.webp');
    if (reg && reg.ok && reg.img && reg.w && reg.h) {
      var escala = Math.max(W / reg.w, H / reg.h);
      var dw = reg.w * escala, dh = reg.h * escala;
      var parX = -_corCamX * (W * 0.05);
      // _COR_CAM_LIM é bem largo (6.0) pra dar sensação de campo livre —
      // parX cru podia passar longe da folga que o "cover fit" tem sobre W,
      // deslocando a imagem de vez e deixando uma borda inteira sem fundo
      // (canvas vazio/preto). Trava dx no intervalo que garante W sempre
      // coberto: nunca mostra fundo vazio, só reduz o parallax quando a
      // folga é pequena (telas mais quadradas).
      var dx = _corClamp((W - dw) / 2 + parX, W - dw, 0);
      var dy = H - dh;   // ancora a base da imagem no fundo do canvas
      ctx.drawImage(reg.img, dx, dy, dw, dh);
      return;
    }
    // Fallback vetorial (imagem ainda não chegou ou falhou).
    var gCeu = ctx.createLinearGradient(0, 0, 0, horizonY);
    gCeu.addColorStop(0, '#3a4048'); gCeu.addColorStop(0.55, '#4c5259'); gCeu.addColorStop(1, '#5f6560');
    ctx.fillStyle = gCeu; ctx.fillRect(0, 0, W, horizonY);
    var lx = W * 0.74, ly = horizonY * 0.36, lr = H * 0.14;
    var gL = ctx.createRadialGradient(lx, ly, lr * 0.2, lx, ly, lr * 2.4);
    gL.addColorStop(0, 'rgba(210,205,195,0.45)'); gL.addColorStop(0.5, 'rgba(180,175,165,0.14)'); gL.addColorStop(1, 'rgba(180,175,165,0)');
    ctx.fillStyle = gL; ctx.beginPath(); ctx.arc(lx, ly, lr * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(205,200,188,0.5)'; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
    _corDrawFloresta(ctx, W, horizonY);
  }

  // Campo aberto: linhas de perspectiva MUITO suaves convergindo pro fuga,
  // dando noção de movimento sem a "estrada" estreita. Ocupa a largura toda.
  function _corDrawCampo(ctx, W, H, horizonY) {
    var fugaX = W * 0.5 - _corCamX * (W * 0.30) * 0.1;
    // Linhas radiais suaves saindo do ponto de fuga pra base (campo inteiro).
    ctx.strokeStyle = 'rgba(120,130,115,0.05)';
    ctx.lineWidth = 1;
    for (var k = -6; k <= 6; k++) {
      var xb = W * 0.5 + k * (W * 0.16) - _corCamX * (W * 0.30);
      ctx.beginPath(); ctx.moveTo(fugaX, horizonY); ctx.lineTo(xb, H); ctx.stroke();
    }
    // "Ondas" horizontais correndo em direção à câmera (textura do chão).
    var run = (_corDist * 1.6) % 100;
    ctx.strokeStyle = 'rgba(90,100,85,0.06)';
    for (var d = 0; d < 10; d++) {
      var tt = (d * 100 + run) / (10 * 100); var t2 = tt * tt;
      var y = horizonY + (H - horizonY) * t2;
      ctx.lineWidth = 1 + 3 * t2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  // Mato em primeiro plano: tufos de grama escura na base da tela, com leve
  // balanço pela passada. Duas camadas (atrás mais clara, frente preta).
  function _corDrawMato(ctx, W, H) {
    var swayG = Math.sin(_corPasso * 0.5) * W * 0.008;
    // camada de trás (mais clara, tufos menores)
    _corDrawTufos(ctx, W, H, H * 0.82, W * 0.045, 'rgba(20,26,20,0.75)', swayG * 0.5, 17);
    // camada da frente (preta, tufos maiores, cobre a base)
    _corDrawTufos(ctx, W, H, H * 0.90, W * 0.075, 'rgba(6,9,6,0.96)', swayG, 11);
  }
  function _corDrawTufos(ctx, W, H, topY, larg, cor, sway, seedBase) {
    ctx.save();
    ctx.fillStyle = cor;
    var seed = seedBase;
    var x = -larg;
    while (x < W + larg) {
      seed = (seed * 9301 + 49297) % 233280;
      var altura = (H - topY) * (0.55 + (seed / 233280) * 0.7);
      var lw = larg * (0.6 + (seed / 233280));
      var cx = x + sway * (0.5 + (seed / 233280));
      // tufo = triângulo pontudo pra cima
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.5, H);
      ctx.quadraticCurveTo(cx - lw * 0.15, H - altura * 0.7, cx, H - altura);
      ctx.quadraticCurveTo(cx + lw * 0.15, H - altura * 0.7, cx + lw * 0.5, H);
      ctx.closePath(); ctx.fill();
      x += larg * 0.55;
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════
     ZUMBI — o desenho.
     ANCORAGEM: p.y é o ponto em que o zumbi PISA no chão. Tanto o
     spritesheet quanto o vetor são desenhados de p.y pra CIMA. (Era
     exatamente isto que estava errado antes: o sprite era ancorado em
     p.y - hpx, então ele "flutuava" e, quando o zumbi chegava perto,
     o corpo inteiro subia pra fora da tela — o famoso "zumbi que não
     aparece".)
     ALTURA: _COR_ALT_MUL × hpx, calibrado pra bater com a altura total
     do boneco vetorial (~1.32 × hpx), pra a troca sprite↔vetor não dar
     salto de tamanho.
  ══════════════════════════════════════════════════════════════ */
  var _COR_ALT_MUL = 1.32;

  function _corDrawZumbi(ctx, zb) {
    var def = _COR_TIPOS[zb.tipo];
    var faixaAnim = zb.faixa + zb.swayA * Math.sin(zb.swayP);
    var p = _corProj(zb.z, faixaAnim);
    var hpx = 0.5 * _corH * p.s * 0.94;
    // Largura derivada da ALTURA (proporção consistente em qualquer tela).
    // Antes usava _corW, que em landscape inflava demais e deformava o vetor.
    var wpx = hpx * 0.62 * (def.w / 0.16);   // normaliza pela largura-base do tipo
    var bob = Math.sin(zb.bob) * hpx * 0.03;

    // Guarda a projeção pra mira e tiro reaproveitarem neste frame.
    zb._px = p.x; zb._py = p.y; zb._ps = p.s; zb._vis = true;

    // Sombra no chão, no ponto de contato.
    ctx.globalAlpha = 0.35 * (0.4 + p.s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, wpx * 0.6, wpx * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // ── Aviso de perigo: pulso vermelho no chão sob os pés, só quando este
    // zumbi está DENTRO da faixa que mata (mesma conta de _corMeiaColisao
    // usada no game over) e já perto o suficiente pra importar. Sem isso
    // não tem como o jogador saber, olhando pra tela, se aquele zumbi ali
    // vai te pegar ou passar reto do lado — a "hitbox do próprio corpo"
    // que não dava pra ver. Não aparece pra zumbi já morto/caindo.
    if (!zb.morto) {
      var pertoDemais = _corClamp(1 - zb.z / 0.35, 0, 1);
      if (pertoDemais > 0 && Math.abs(zb.faixa - _corCamX) < _corMeiaColisao(zb.tipo)) {
        var pulso = 0.55 + 0.45 * Math.sin(_corRelogio * 0.012);
        ctx.save();
        ctx.globalAlpha = pertoDemais * 0.6 * pulso;
        var gPerigo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, wpx * 1.3);
        gPerigo.addColorStop(0, 'rgba(255,40,30,0.85)'); gPerigo.addColorStop(1, 'rgba(255,40,30,0)');
        ctx.fillStyle = gPerigo;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, wpx * 1.3, wpx * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    var mortAlpha = 1, mortScale = 1, mortRot = 0;
    if (zb.morto) { var q = _corClamp(zb.cai / 0.6, 0, 1); mortAlpha = 1 - q; mortScale = 1 - q * 0.4; mortRot = q * 0.9; }
    ctx.globalAlpha = mortAlpha;

    // 1ª opção: spritesheet animado. Pés em p.y, corpo pra cima.
    var ah = hpx * _COR_ALT_MUL * mortScale;
    var aw = ah * _corSheetRatio(zb.tipo);
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    if (mortRot) ctx.rotate(mortRot);
    var desenhou = _corDrawSheetFrame(ctx, zb.tipo, _corRelogio + zb.fase, -aw / 2, -ah, aw, ah);
    if (!desenhou) {
      // 2ª opção: o webp estático antigo (imagem real, sem animar).
      var est = _corAsset('zumbi-' + zb.tipo + '.webp');
      var fonteEst = _corFonte(est);
      if (fonteEst && est.w && est.h) {
        var eaw = ah * (est.w / est.h);
        ctx.drawImage(fonteEst, -eaw / 2, -ah, eaw, ah);
        desenhou = true;
      }
    }
    ctx.restore();
    // 3ª opção: boneco vetorial com ciclo de caminhada (sempre funciona).
    if (!desenhou) {
      _corVetorZumbi(ctx, p.x, p.y + bob, wpx * mortScale, hpx * mortScale, def, mortRot, zb.bob);
    }
    ctx.globalAlpha = 1;
  }

  /* Fallback vetorial — silhueta cambaleante com ciclo de passada:
     pernas alternando, braços esticados pra frente e cabeça pendendo.
     Desenhado a partir do PÉ (0,0 = chão), altura total ~1.32×h. */
  function _corVetorZumbi(ctx, cx, footY, w, h, def, rot, fase) {
    ctx.save(); ctx.translate(cx, footY); if (rot) ctx.rotate(rot);
    var sw = Math.sin(fase), sw2 = Math.sin(fase + Math.PI);
    var lw = Math.max(1.6, w * 0.26);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Pernas alternando (o passo arrastado do zumbi).
    ctx.strokeStyle = def.corEsc; ctx.lineWidth = lw * 1.15;
    ctx.beginPath();
    ctx.moveTo(-w * 0.14, -h * 0.52); ctx.lineTo(-w * 0.14 + sw * w * 0.30, 0);
    ctx.moveTo(w * 0.14, -h * 0.52);  ctx.lineTo(w * 0.14 + sw2 * w * 0.30, 0);
    ctx.stroke();

    // Tronco (roupa rasgada).
    ctx.fillStyle = def.cor;
    ctx.beginPath();
    ctx.moveTo(-w * 0.30, -h * 0.46);
    ctx.lineTo(w * 0.30, -h * 0.46);
    ctx.lineTo(w * 0.40, -h * 1.00);
    ctx.lineTo(-w * 0.40, -h * 1.00);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = def.corEsc;
    ctx.beginPath();
    ctx.moveTo(-w * 0.30, -h * 0.46); ctx.lineTo(-w * 0.10, -h * 0.40);
    ctx.lineTo(w * 0.05, -h * 0.48);  ctx.lineTo(w * 0.20, -h * 0.38);
    ctx.lineTo(w * 0.30, -h * 0.46);  ctx.closePath(); ctx.fill();

    // Braços esticados pra frente, balançando de leve.
    ctx.strokeStyle = def.cor; ctx.lineWidth = lw;
    var by1 = -h * (0.70 + sw * 0.05), by2 = -h * (0.70 + sw2 * 0.05);
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, -h * 0.93); ctx.lineTo(-w * 0.70, by1);
    ctx.moveTo(w * 0.36, -h * 0.93);  ctx.lineTo(w * 0.70, by2);
    ctx.stroke();
    ctx.fillStyle = def.cor;
    ctx.beginPath(); ctx.arc(-w * 0.70, by1, lw * 0.60, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.70, by2, lw * 0.60, 0, Math.PI * 2); ctx.fill();

    // Cabeça pendendo pro lado no ritmo do passo.
    ctx.save(); ctx.translate(0, -h * 1.00); ctx.rotate(sw * 0.10);
    ctx.fillStyle = def.cor;
    ctx.beginPath(); ctx.arc(0, -h * 0.19, w * 0.30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(228,228,205,0.9)';
    var olho = Math.max(1, w * 0.065);
    ctx.beginPath(); ctx.arc(-w * 0.11, -h * 0.21, olho, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.11, -h * 0.21, olho, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function _corDrawItem(ctx, it) {
    var p = _corProj(it.z, it.faixa);
    var s = p.s, bob = Math.sin(it.bob) * 5 * s, sz = 20 * s;
    ctx.globalAlpha = 0.3 * (0.4 + s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 0.9, sz * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var fonteMun = _corFonte(_corAsset('municao.webp'));
    if (fonteMun) {
      var aw = sz * 2.4, ah = sz * 2.4;
      ctx.drawImage(fonteMun, p.x - aw / 2, p.y - ah + bob, aw, ah);
    } else {
      ctx.save(); ctx.translate(p.x, p.y - sz + bob);
      ctx.fillStyle = '#3e5a2e'; ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
      ctx.fillStyle = '#557a3e'; ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 0.35);
      ctx.strokeStyle = '#c33'; ctx.lineWidth = Math.max(2, sz * 0.18);
      ctx.beginPath(); ctx.moveTo(-sz * 0.6, 0); ctx.lineTo(sz * 0.6, 0); ctx.stroke();
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(it.bob));
      ctx.strokeStyle = 'rgba(120,220,120,0.85)'; ctx.lineWidth = 2;
      ctx.strokeRect(-sz - 3, -sz * 0.7 - 3, sz * 2 + 6, sz * 1.4 + 6);
      ctx.globalAlpha = 1; ctx.restore();
    }
  }

  function _corDrawArma(ctx, W, H) {
    var kick = _corRecuo * H * 0.05;
    // Arma balança em contrafase leve com a passada (sincronizada ao bob).
    var swayX = Math.sin(_corPasso * 0.5) * W * 0.012;
    var swayY = Math.abs(Math.sin(_corPasso)) * H * 0.016;
    var baseY = H + kick + swayY;
    var cx = W * 0.5 + swayX;

    var asset = _corAsset('arma.webp');
    var fonteArma = _corFonte(asset);
    if (fonteArma) {
      // Arma FPS empunhada na base. Ancoramos pela largura pra as asas
      // transbordarem, MAS com TETO de altura pra não cobrir a tela em
      // telas landscape largas (celular deitado tem proporção ~2.2:1, então
      // largura×105% daria altura maior que a tela). O teto garante que a
      // arma ocupe no máx ~52% da altura, deixando o campo de visão livre.
      var ratio = (asset.h && asset.w) ? (asset.w / asset.h) : 2.2;  // w/h
      var aw = W * 1.05;
      var ah = aw / ratio;
      var ahMax = H * 0.52;
      if (ah > ahMax) { ah = ahMax; aw = ah * ratio; }
      ctx.drawImage(fonteArma, cx - aw / 2, baseY - ah, aw, ah);
      return;
    }
    ctx.save(); ctx.translate(cx, baseY);
    ctx.fillStyle = '#20242b';
    ctx.beginPath();
    ctx.moveTo(-W * 0.20, 0);
    ctx.lineTo(W * 0.20, 0);
    ctx.lineTo(W * 0.11, -H * 0.16);
    ctx.lineTo(-W * 0.11, -H * 0.16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2c313a';
    ctx.beginPath();
    ctx.moveTo(-W * 0.045, -H * 0.14);
    ctx.lineTo(W * 0.045, -H * 0.14);
    ctx.lineTo(W * 0.016, -H * 0.30);
    ctx.lineTo(-W * 0.016, -H * 0.30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#14171c';
    ctx.beginPath(); ctx.ellipse(0, -H * 0.30, W * 0.018, H * 0.012, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6f5a';
    ctx.beginPath(); ctx.ellipse(-W * 0.10, -H * 0.05, W * 0.05, H * 0.05, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(W * 0.10, -H * 0.05, W * 0.05, H * 0.05, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Mira: usa _corMiraAlvo (mesmo cálculo do tiro de verdade — ver
  // comentário lá) em vez de reprojetar/recalcular por conta própria.
  function _corDrawMira(ctx, W, H) {
    var cx = W * 0.5, cy = H * (_COR_HORIZ + 0.14);
    var sobAlvo = !!_corMiraAlvo(W, H);
    var cor = sobAlvo ? 'rgba(255,70,70,0.9)' : 'rgba(255,255,255,0.55)';
    ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.lineCap = 'round';
    var r = H * 0.03, g = H * 0.012;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx - g, cy);
    ctx.moveTo(cx + g, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - g);
    ctx.moveTo(cx, cy + g); ctx.lineTo(cx, cy + r);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fillStyle = cor; ctx.fill();
  }

  /* ══════════════════════════════════════════════════════════════
     LOOP
  ══════════════════════════════════════════════════════════════ */
  function _corLoop(ts) {
    if (_corEstado !== 'jogando') return;
    if (!_corLast) _corLast = ts;
    var dt = (ts - _corLast) / 1000; _corLast = ts;
    if (dt > 0.05) dt = 0.05;
    _corRelogio = ts;                 // relógio p/ animação dos webp
    _corUpdate(dt);
    if (_corEstado === 'jogando') { _corDraw(); _corRAF = requestAnimationFrame(_corLoop); }
  }

  /* ══════════════════════════════════════════════════════════════
     GAME OVER
  ══════════════════════════════════════════════════════════════ */
  function _corGameOver() {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    _corEstado = 'fim';
    var score = Math.floor(_corDist), rec = _corRec(), recorde = score > rec;
    if (recorde) _corRecSet(score);
    _corDraw();
    _corSomMorte();
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(recorde);
    if (window.AngatubaGames) window.AngatubaGames.rankSubmeter('corrida', score);

    var owlEl = document.getElementById('cor-fim-owl');
    var titEl = document.getElementById('cor-fim-titulo');
    var ptsEl = document.getElementById('cor-fim-pontos');
    var msgEl = document.getElementById('cor-fim-msg');
    if (owlEl) { owlEl.src = recorde ? '/webp/owl-celebrate-flying.webp' : '/webp/owl-surprised.webp'; owlEl.style.display = ''; }
    if (titEl) titEl.textContent = recorde ? '🎉 Novo recorde!' : 'Fim da linha!';
    if (ptsEl) ptsEl.textContent = score + ' metros';
    if (msgEl) msgEl.textContent = recorde ? 'Você correu mais longe que nunca! 🦉'
      : (rec > 0 ? 'Seu recorde: ' + rec + 'm. Bora de novo?' : 'Arraste pra desviar, toque pra atirar!');
    _corMostrarOverlay('fim');
    _corAtualizarHUD(true);
    if (recorde && window.AngatubaGames && window.AngatubaGames.efeitos) window.AngatubaGames.efeitos.confete('cor-fim', 90, _corOpcoesFx());
    if (window.AngatubaGames) window.AngatubaGames.rankFimDeJogo('corrida', 'cor-rank-slot', score);
  }

  /* ══════════════════════════════════════════════════════════════
     CONTROLES — arraste = strafe da câmera; tap = tiro.
     Como a arena pode estar rotacionada 90° por CSS, mapeamos o eixo
     do dedo na tela física pro eixo lateral do JOGO via _corRotacionado.
  ══════════════════════════════════════════════════════════════ */
  function _corRotacionado() {
    try {
      var rot = document.getElementById('cor-rot');
      if (rot && rot.getAttribute('data-rot') === '1') return true;
    } catch (e) {}
    return false;
  }
  function _corXY(e) {
    var t = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }
  var _corDrag = false, _corLast2 = null, _corDownXY = null, _corDownT = 0, _corMoveu = false;

  function _corPointerDown(e) {
    // O AudioContext só acorda dentro de um gesto — este é o gesto.
    _corAudioDestravar();
    if (_corEstado !== 'jogando') return;
    _corDrag = true;
    _corLast2 = _corXY(e); _corDownXY = _corLast2; _corDownT = (e.timeStamp || Date.now()); _corMoveu = false;
    if (e.cancelable) e.preventDefault();
  }
  function _corPointerMove(e) {
    if (!_corDrag || _corEstado !== 'jogando') return;
    var xy = _corXY(e);
    var dxScreen = xy.x - _corLast2.x;
    var dyScreen = xy.y - _corLast2.y;
    _corLast2 = xy;
    // Rotacionado +90° (topo do jogo aponta pra direita da tela física):
    // arrastar pra BAIXO na tela move pra direita no jogo. Sem rotação:
    // arrastar pra direita move pra direita.
    var mov = _corRotacionado() ? dyScreen : dxScreen;
    var accX = xy.x - _corDownXY.x, accY = xy.y - _corDownXY.y;
    if (Math.sqrt(accX * accX + accY * accY) > 8) _corMoveu = true;
    var escala = 1 / (_corW * 0.5);
    _corCamX = _corClamp(_corCamX + mov * escala, -_COR_CAM_LIM, _COR_CAM_LIM);
    _corCamVX = mov;
    if (e.cancelable) e.preventDefault();
  }
  function _corPointerUp(e) {
    if (_corEstado === 'jogando' && _corDrag) {
      var dtms = ((e && e.timeStamp) || Date.now()) - _corDownT;
      if (!_corMoveu && dtms < 320) _corAtirar();
    }
    _corDrag = false; _corCamVX = 0;
  }
  function _corKey(down, e) {
    // Os listeners de keydown/keyup ficam presos em window pra sempre (ver
    // _corLigarControles): sem essa guarda, espaço/Enter continuam sendo
    // interceptados com preventDefault() em QUALQUER campo de texto do app
    // depois de abrir a Corrida uma única vez.
    if (_corEstado !== 'jogando') return;
    if (e.key === 'ArrowLeft') { if (down) { _corCamX = _corClamp(_corCamX - 0.08, -_COR_CAM_LIM, _COR_CAM_LIM); } }
    else if (e.key === 'ArrowRight') { if (down) { _corCamX = _corClamp(_corCamX + 0.08, -_COR_CAM_LIM, _COR_CAM_LIM); } }
    else if (down && (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter')) { _corAudioDestravar(); _corAtirar(); if (e.preventDefault) e.preventDefault(); }
  }
  function _corLigarControles() {
    if (_corListenersOn || !_corCanvas) return;
    _corCanvas.addEventListener('touchstart', _corPointerDown, { passive: false });
    _corCanvas.addEventListener('touchmove', _corPointerMove, { passive: false });
    _corCanvas.addEventListener('touchend', _corPointerUp);
    _corCanvas.addEventListener('touchcancel', _corPointerUp);
    _corCanvas.addEventListener('mousedown', _corPointerDown);
    window.addEventListener('mousemove', _corPointerMove);
    window.addEventListener('mouseup', _corPointerUp);
    _corCanvas.__coKD = function (e) { _corKey(true, e); };
    _corCanvas.__coKU = function (e) { _corKey(false, e); };
    window.addEventListener('keydown', _corCanvas.__coKD);
    window.addEventListener('keyup', _corCanvas.__coKU);
    _corListenersOn = true;
  }

  /* ══════════════════════════════════════════════════════════════
     ORIENTAÇÃO NATIVA — pede ao sistema pra girar pra landscape (só
     funciona se o manifest tiver "orientation":"any" e no APK/instalado).
     Quando o lock nativo PEGA, o próprio SO gira a tela: o palco já vira
     paisagem e NÃO devemos rotacionar por CSS (senão gira 2x). A flag
     _corLockNativo indica se o lock foi aceito.
  ══════════════════════════════════════════════════════════════ */
  var _corLockNativo = false;
  function _corTravarLandscape() {
    try {
      if (screen && screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock('landscape');
        if (p && p.then) {
          p.then(function () {
            _corLockNativo = true;
            _corAplicarOrientacao();
            if (_corEstado !== 'jogando') _corDrawIdle();
          }).catch(function () {
            _corLockNativo = false;   // navegador comum recusa → usa CSS
          });
        }
      }
    } catch (e) { _corLockNativo = false; }
  }
  function _corDestravarOrientacao() {
    try {
      if (screen && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
    _corLockNativo = false;
  }

  /* ══════════════════════════════════════════════════════════════
     ORIENTAÇÃO — rotaciona a arena por CSS quando o device está em
     retrato (data-rot=1) e mostra a dica "gire o celular". Reavalia
     em resize/orientationchange.
  ══════════════════════════════════════════════════════════════ */
  function _corAplicarOrientacao() {
    var rot = document.getElementById('cor-rot');
    var palco = document.getElementById('cor-palco');
    var dica = document.getElementById('cor-gire');
    if (!rot) return;
    // Se o lock NATIVO pegou, o SO já girou a tela pra paisagem: NÃO
    // rotacionamos por CSS (seria girar 2x) e escondemos a dica.
    if (_corLockNativo) {
      rot.setAttribute('data-rot', '0');
      rot.style.width = ''; rot.style.height = ''; rot.style.top = ''; rot.style.left = '';
      if (dica) dica.style.display = 'none';
      _corDimensionar();
      if (_corEstado !== 'jogando') _corDrawIdle();
      return;
    }
    // Detecta retrato pelas dimensões REAIS do palco (mais confiável em
    // fullscreen PWA que window.innerWidth/Height, que às vezes vêm errados).
    // Fallback pro window se o palco ainda não tiver dimensões.
    var retrato;
    var pr = palco ? palco.getBoundingClientRect() : null;
    if (pr && pr.width > 2 && pr.height > 2) {
      retrato = (pr.height >= pr.width);
    } else {
      retrato = (window.innerHeight >= window.innerWidth);
    }
    if (retrato && palco && pr) {
      // Mede o palco (em retrato, alto) e dimensiona o wrapper com os eixos
      // TROCADOS: largura do wrapper = altura do palco, altura = largura.
      // O CSS gira 90°, virando paisagem que preenche o palco.
      var pw = Math.max(1, Math.round(pr.width));
      var ph = Math.max(1, Math.round(pr.height));
      rot.setAttribute('data-rot', '1');
      rot.style.width = ph + 'px';
      rot.style.height = pw + 'px';
      rot.style.top = '50%';
      rot.style.left = '50%';
      if (dica) dica.style.display = '';
    } else {
      rot.setAttribute('data-rot', '0');
      rot.style.width = '';
      rot.style.height = '';
      rot.style.top = '';
      rot.style.left = '';
      if (dica) dica.style.display = 'none';
    }
    _corDimensionar();
    if (_corEstado !== 'jogando') _corDrawIdle();
  }

  /* ══════════════════════════════════════════════════════════════
     CICLO DE VIDA
  ══════════════════════════════════════════════════════════════ */
  function _corPreparar() {
    _corCanvas = document.getElementById('cor-canvas');
    if (!_corCanvas) return;
    _corCtx = _corCanvas.getContext('2d');
    _corLigarControles();
    if (!_corResizeOn) {
      var reaval = function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _corAplicarOrientacao();
          if (_corEstado !== 'jogando') _corDrawIdle();
        }
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', reaval);
      // O giro do lock nativo dispara 'change' no screen.orientation QUANDO
      // a tela realmente terminou de girar (o .then do lock resolve antes
      // disso). Aqui remedimos o canvas com as dimensões finais.
      try {
        if (screen && screen.orientation && screen.orientation.addEventListener) {
          screen.orientation.addEventListener('change', function () {
            // Várias remedições porque o layout assenta em passos.
            reaval();
            _corResizeTimers.push(setTimeout(reaval, 60));
            _corResizeTimers.push(setTimeout(reaval, 200));
            _corResizeTimers.push(setTimeout(reaval, 450));
          });
        }
      } catch (e) {}
      _corResizeOn = true;
    }
    _corEstado = 'inicio';
    _corDist = 0; _corMun = _COR_MUN_INI;
    _corAtualizarHUD(true);
    // Pré-carrega os spritesheets dos zumbis (imagens únicas; o fallback
    // vetor cobre enquanto não chegam).
    _corSheet('normal');
    _corSheet('rapido');
    _corSheet('forte');
    _corAsset('cenario-floresta.webp');   // dispara o carregamento do fundo cedo
    _corCarregarSpritesFx();
    _corPrepararFontes();
    // Pede ao sistema pra girar pra landscape (APK/instalado com manifest
    // "any"). No navegador comum é recusado e caímos na rotação CSS.
    _corTravarLandscape();
    _corMostrarOverlay('inicio');
    _corAplicarOrientacaoRepetido();
    _corDrawIdle();
  }

  /* Adianta o trabalho pesado de tirar o fundo chapado dos sprites (flood
     fill num canvas do tamanho da imagem) enquanto o jogador ainda está na
     tela inicial lendo as instruções. Se isso rodasse na primeira vez que
     cada zumbi aparece, daria um engasgo no meio da corrida. Tentamos
     algumas vezes porque as imagens chegam da rede em tempos diferentes. */
  function _corPrepararFontes() {
    // Fix A2.18: preparar() roda de novo a cada abertura da Corrida — sem
    // isso, abrir o jogo várias vezes empilhava um setInterval por vez, todos
    // fazendo o mesmo trabalho em paralelo.
    if (_corFontesTimer) clearInterval(_corFontesTimer);
    var tentativas = 0;
    _corFontesTimer = setInterval(function () {
      var faltou = false;
      for (var tipo in _COR_TIPOS) {
        if (!_COR_TIPOS.hasOwnProperty(tipo)) continue;
        var reg = _corSheetPronto(tipo);
        if (reg) _corFonte(reg.sheet); else faltou = true;
      }
      _corFonte(_corAsset('arma.webp'));
      _corFonte(_corAsset('municao.webp'));
      if (!faltou || ++tentativas > 20) { clearInterval(_corFontesTimer); _corFontesTimer = 0; }
    }, 400);
  }

  // O fullscreen do celular muda o tamanho do palco de forma ASSÍNCRONA e em
  // tempo variável (às vezes 300ms). Reaplicamos a orientação várias vezes
  // após abrir, pra garantir que a rotação use as dimensões finais do palco.
  function _corAplicarOrientacaoRepetido() {
    _corAplicarOrientacao();
    var atrasos = [50, 150, 300, 500, 800];
    for (var i = 0; i < atrasos.length; i++) {
      setTimeout(function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _corAplicarOrientacao();
          if (_corEstado !== 'jogando') _corDrawIdle();
        }
      }, atrasos[i]);
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        _corAplicarOrientacao();
        if (_corEstado !== 'jogando') _corDrawIdle();
      });
    }
  }

  function _corDrawIdle() {
    if (!_corCtx) return;
    _corDimensionar();
    var ctx = _corCtx, W = _corW, H = _corH, horizonY = H * _COR_HORIZ;
    var gCh = ctx.createLinearGradient(0, horizonY, 0, H);
    gCh.addColorStop(0, '#2f3830'); gCh.addColorStop(0.5, '#232a24'); gCh.addColorStop(1, '#141813');
    ctx.fillStyle = gCh; ctx.fillRect(0, horizonY, W, H - horizonY);
    _corDrawCampo(ctx, W, H, horizonY);
    _corDrawCeuFundo(ctx, W, H, horizonY);
    var gFog = ctx.createLinearGradient(0, horizonY - H * 0.08, 0, horizonY + H * 0.3);
    gFog.addColorStop(0, 'rgba(150,155,150,0)'); gFog.addColorStop(0.25, 'rgba(150,155,150,0.55)'); gFog.addColorStop(1, 'rgba(140,148,142,0)');
    ctx.fillStyle = gFog; ctx.fillRect(0, horizonY - H * 0.08, W, H * 0.4);
    _corDrawMato(ctx, W, H);
    _corDrawArma(ctx, W, H);
    _corDrawMira(ctx, W, H);
    var gV = ctx.createRadialGradient(W * 0.5, H * 0.48, H * 0.28, W * 0.5, H * 0.5, H * 0.9);
    gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  function _corComecar() {
    _corCanvas = document.getElementById('cor-canvas');
    if (!_corCanvas) return;
    if (!_corCtx) _corCtx = _corCanvas.getContext('2d');
    _corAudioDestravar();          // veio de um clique no botão: acorda o áudio
    _corLigarControles();
    _corMostrarOverlay(null);
    _corTravarLandscape();
    _corAplicarOrientacaoRepetido();
    _corReset();
    _corEstado = 'jogando'; _corLast = 0;
    if (_corRAF) cancelAnimationFrame(_corRAF);
    _corRAF = requestAnimationFrame(_corLoop);
  }

  function _corParar() {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    if (_corEstado === 'jogando') _corEstado = 'inicio';
    _corDrag = false;
    _corDestravarOrientacao();     // volta a orientação do sistema ao normal
    // Fix A2.22: cancela a cascata de remedição pós-rotação se ainda tiver
    // algum passo pendente — mesma correção do Tanques.
    _corResizeTimers.forEach(clearTimeout);
    _corResizeTimers.length = 0;
  }

  function _corMostrarOverlay(qual) {
    var ini = document.getElementById('cor-inicio');
    var fim = document.getElementById('cor-fim');
    if (ini) ini.style.display = (qual === 'inicio') ? '' : 'none';
    if (fim) fim.style.display = (qual === 'fim') ? '' : 'none';
  }

  /* Diagnóstico de assets. No console do celular/desktop:
       CorridaGame.diag()
     Mostra, pra cada zumbi, se o arquivo carregou, com que nome, o
     tamanho real da imagem e como o layout de frames foi interpretado.
     Se "frames" vier 1 num arquivo que deveria ser sheet, o arquivo não
     é uma tira de frames (provavelmente é um webp animado) — nesse caso
     reexporte como tira horizontal de 12 quadros lado a lado. */
  function _corDiag() {
    var out = {};
    // Percorre por _COR_TIPOS (a chave que o DESENHO usa), não por
    // _COR_SHEETS. Assim, se as duas tabelas voltarem a divergir, o diag
    // acusa "semSheet" em vez de dizer que está tudo certo — foi esse
    // ponto cego que escondeu o bug das chaves por duas versões.
    for (var tipo in _COR_TIPOS) {
      if (!_COR_TIPOS.hasOwnProperty(tipo)) continue;
      var meta = _COR_SHEETS[tipo];
      if (!meta) { out[tipo] = { erro: 'sem entrada em _COR_SHEETS para o tipo "' + tipo + '"' }; continue; }
      var reg = _corSheet(tipo), s = reg.sheet;
      var pronto = _corSheetPronto(tipo);
      if (pronto) _corFonte(s);   // força resolver o fundo pra reportar abaixo
      out[tipo] = {
        arquivo: meta.arquivo,
        carregou: !!(s && s.ok),
        nomeQueFuncionou: s ? s.nomeOk : null,
        imagem: s && s.ok ? (s.w + '×' + s.h) : null,
        frames: pronto ? pronto.lay.n : 0,
        grade: pronto ? (pronto.lay.c + '×' + pronto.lay.r) : null,
        frameProporcao: pronto ? +(pronto.lay.fw / pronto.lay.fh).toFixed(3) : null,
        fundoChapadoRemovido: s ? !!s.fundoRemovido : false,
        usandoSprite: !!pronto
      };
    }
    function estat(nome) {
      var a = _corAsset(nome);
      _corFonte(a);
      return { carregou: a.ok, imagem: a.ok ? a.w + '×' + a.h : null, fundoChapadoRemovido: !!a.fundoRemovido };
    }
    out.arma = estat('arma.webp');
    out.municao = estat('municao.webp');
    // cenario-floresta.webp é imagem opaca (não sprite) — sem _corFonte()
    // aqui, senão o diag dispararia o flood-fill de remoção de fundo nela.
    (function () {
      var a = _corAsset('cenario-floresta.webp');
      out.cenario = { carregou: a.ok, imagem: a.ok ? (a.w + '×' + a.h) : null };
    })();
    out.audio = _corAC ? _corAC.state : 'não criado';
    return out;
  }

  /* ── Exposição pública ────────────────────────────────────────── */
  window._corComecar = _corComecar;
  window.CorridaGame = { preparar: _corPreparar, comecar: _corComecar, parar: _corParar, diag: _corDiag };
})();