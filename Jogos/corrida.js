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

   ─── MUDANÇAS DA v5 (Into the Dead: esbarrão + obstáculos) ─────
   5) ESBARRÃO: relar na BORDA de um zumbi (fora do centro) não é mais
      game over — só a colisão central mata. O esbarrão empurra o
      zumbi pra longe, treme a câmera e entra num cambaleio de ~1.2s
      (_corSlowT) em que o mundo avança a ~50% — E qualquer novo
      contato de zumbi (centro OU borda) durante o cambaleio é morte
      na hora ("chain kill": levou um raspão, a horda te alcançou nele
      antes de você se recompor). O i-frame de verdade é bem curto
      (~0.14s), só pra não processar a mesma colisão duas vezes no
      mesmo frame. Zumbi "forte" empurra menos. Ver _corEsbarrao.
   6) OBSTÁCULOS DE CENÁRIO: carro/cerca/entulho/pedra nascem no
      horizonte e avançam com o mundo, sem atirar nem ter HP — só pra
      desviar. Colidir com um é morte na hora (sem esbarrão: cenário é
      sólido, zumbi é mole). Sempre sobra passagem livre de um lado
      (ver _corSpawnObstaculo).
   7) SPAWN DO INÍCIO (bug): população-alvo base era 5-9 zumbis vivos
      com reposição em 0.25-0.6s (2 de uma vez quando bem abaixo do
      alvo) e _corSpawnT inicial de só 0.9s — isso empilhava uma PAREDE
      de zumbi bem em cima do jogador nos primeiros ~2s, sem tempo de
      reação nenhum. Base caiu pra 2-4 (sobe igual com a distância,
      com teto), _corSpawnT inicial subiu pra 2.2s, e nos primeiros
      ~100m a reposição spawna só 1 zumbi por vez em vez de 2.
   8) MÚSICA DE FUNDO: trilha ambiente em loop baixinho (HTMLAudioElement
      simples — não usa o Web Audio dos SFX). Toca ao Começar, para/
      rebobina no game over e ao sair da Corrida, acompanha o botão de
      mudo global durante a partida, e é 100% opcional (sem o arquivo,
      o jogo segue normal). Crédito CC BY obrigatório na tela de fim
      (ver index.html). Ver bloco "MÚSICA DE FUNDO (BGM)" abaixo.
   9) SFX AMBIENTE (tudo sintético, zero asset novo): rosnado curto
      quando um zumbi fica perigoso (perto + na faixa que mata, mesma
      conta do pulso vermelho — cooldown global 0.8-1.2s pra não virar
      coro de horda), impacto seco/abafado ao morrer batendo em
      obstáculo (diferente do impacto em carne), uivo distante e
      abafado a cada 10-18s como ambiente, e um pouco mais de "corpo"
      grave no esbarrão. Ver _corSomRosnado/_corSomImpactoObstaculo/
      _corSomUivoDistante logo depois de _corSomMorte.
  10) MOEDAS NA PISTA: fileiras de moedas (retas ou diagonais) vêm pelo
      campo; cada uma pega vale 1, sem teto por partida (antes pagava
      metros/200 com teto de 25). Ver _corSpawnMoedas e o bloco de
      moedas em _corUpdate.
  11) MAIS INTO THE DEAD (v6): caixa de arma (escopeta/metralhadora com
      munição própria), agarrão na morte por zumbi + batimento e borda
      vermelha de perigo, missões (3 ativas, pagam moedas), zonas por
      distância (cenário + obstáculos próprios) e a coruja guardiã. Arte
      nova é opcional — ver o bloco "v6" e claude/corrida-v6-assets.md.
  12) v6.1/v6.2: beira do caminho (o mundo passando), mato em arte, chão
      correndo em perspectiva (textura por zona), inclinar o celular pra
      desviar, eventos de zumbi (grupo cruzando, saindo do chão,
      corredora, horda com brecha, rastejante), clima (chuva, relâmpago,
      noite fechada com lanterna), respiração e gemidos com direção, e
      melhorias compradas com moedas + arma inicial.
  13) v6.4: desempenho (canvas com teto de resolução, chão num buffer
      reduzido, vinheta em CSS, imagens pré-decodificadas, gráficos leves
      automáticos em aparelho lento) e opções no menu de pausa: modo de
      controle (arrastar / toque nos lados / inclinar), tiro automático,
      sensibilidade, música, vibração, gráficos leves e recomeçar.
  14) v6.5: sons gravados (ElevenLabs) em /Jogos/assets/corrida/sfx/ —
      armas, zumbis, passos/fôlego/chuva em loop, trovão, guardiã; o som
      sintetizado antigo fica de reserva se um arquivo faltar.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     ASSETS opcionais (o jogo funciona 100% em vetor). Base:
     /Jogos/assets/corrida/ (J maiúsculo; GitHub Pages é case-sensitive).
       zumbi-coruja-normal.webp | zumbi-coruja-normal-b.webp | zumbi-coruja-rapido.webp | zumbi-coruja-forte.webp (3×3, ver _COR_SHEETS)
       obst-<tipo>.webp      → obstáculos (carro/cerca/entulho/pedra/toco/placa/abobora/lapide)
       municao-v2.webp     → caixa de recarga no chão
       arma.webp           → sprite da arma em 1a pessoa (base da tela)
       cenario-floresta.webp → cenário inteiro (céu, lua, árvores mortas e
                             chão/trilha), fundo estático cobrindo o canvas
                             todo em "cover fit"; SEM remoção de fundo —
                             é imagem opaca, não sprite recortado
     Se faltar/falhar, usa fallback vetorial.
  ══════════════════════════════════════════════════════════════ */
  var _COR_ASSET_BASE = '/Jogos/assets/corrida/';
  // Artes reprocessadas (borda clara removida): ?v= força baixar de novo,
  // porque o CACHE_JOGOS do service worker é cache-first por URL.
  var _COR_ARTE_V = /^(deco-|mato-frente|obst-carro|obst-entulho)/;
  function _corArteUrl(nome) { return _COR_ASSET_BASE + nome + (_COR_ARTE_V.test(nome) ? '?v=2' : ''); }
  // Asas + lançador de espuma no estilo da Master Reference. Nome novo
  // (-v2) por causa do CACHE_JOGOS (cache-first, nunca apagado).
  var _COR_ARMA = 'arma-v4.webp';   // v4: vista por trás, cano pra dentro da tela (a v2 apontava pro jogador; a v3 tinha halo na asa direita)
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
  // v2: corujas-zumbi no estilo da Master Reference, sheet em grade 3×3
  // (9 quadros de caminhada, pés na base de cada célula). 'grade' fixa o
  // layout (sem depender do palpite por proporção); 'esc' ajusta o tamanho
  // na tela (a forte é maior). 'normalB' é uma segunda aparência da comum:
  // metade das comuns nasce com ela (ver _corSpawnZumbi, zb.sheetKey) —
  // mesmo tipo/HP/velocidade, só muda a arte.
  var _COR_SHEETS = {
    normal:  { arquivo: 'zumbi-coruja-normal.webp',   frames: 9, fps: 9,  grade: [3, 3], esc: 1.00 },
    normalB: { arquivo: 'zumbi-coruja-normal-b.webp', frames: 9, fps: 9,  grade: [3, 3], esc: 1.00 },
    rapido:  { arquivo: 'zumbi-coruja-rapido.webp',   frames: 9, fps: 13, grade: [3, 3], esc: 0.95 },
    forte:   { arquivo: 'zumbi-coruja-forte.webp',    frames: 9, fps: 7,  grade: [3, 3], esc: 1.22 },
    // v6.2 — arte opcional (novo: um nome só, sem variantes). Sem ela: corredora
    // usa o sheet da rápida, saindo-do-chão usa o andar normal, rastejante não aparece.
    corredor:   { arquivo: 'zumbi-coruja-corredor.webp',   frames: 9, fps: 16, grade: [3, 3], esc: 1.00, novo: true },
    rastejante: { arquivo: 'zumbi-coruja-rastejante.webp', frames: 9, fps: 10, grade: [3, 3], esc: 1.00, novo: true },
    chao:       { arquivo: 'zumbi-coruja-chao.webp',       frames: 9, fps: 11, grade: [3, 3], esc: 1.00, novo: true }
  };
  var _COR_MUNICAO = 'municao-v2.webp';

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
          // decode() antes de liberar: sem isso a 1ª vez que a arte aparece
          // na tela decodifica no meio do quadro (engasgo ao trocar de zona).
          var pronto = function () {
            reg.ok = true; reg.img = im; reg.nomeOk = nome;
            reg.w = im.naturalWidth || 0; reg.h = im.naturalHeight || 0;
          };
          if (im.decode) im.decode().then(pronto, pronto); else pronto();
        };
        im.onerror = function () { tentar(); };   // 404 → tenta o próximo nome
        im.src = _corArteUrl(nome);
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
    reg.grade = meta.grade || null;
    reg.esc = meta.esc || 1;
    reg.durFrame = 1000 / (meta.fps || 10);
    reg.sheet = meta.novo ? _corAssetNovo(meta.arquivo) : _corAsset(meta.arquivo);   // carrega a imagem do sheet
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
      reg.lay = reg.grade ? { c: reg.grade[0], r: reg.grade[1], n: reg.decl }
                          : _corLayoutSheet(w, h, reg.decl);
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
    _corSfxCarregar();
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

  /* ── SONS GRAVADOS (v6.5, gerados no ElevenLabs) ─────────────────
     /Jogos/assets/corrida/sfx/<nome>-N.mp3. Cada efeito pode ter várias
     versões (sorteia uma, nunca a mesma duas vezes seguidas) e toca com
     uma leve variação de tom. Carregam ao abrir a corrida; enquanto não
     chegam (ou se faltarem), o som sintetizado antigo continua no lugar.
     Loops (passos, respiração, chuva) têm volume/velocidade por quadro. */
  var _COR_SFX_BASE = '/Jogos/assets/corrida/sfx/';
  var _COR_SFX = {
    tiro: 2, escopeta: 1, metralhadora: 1, recarga: 1, vazio: 1, caixa: 1,
    acerto: 1, morre: 1, gemido: 2, corredora: 1, terra: 1, agarrao: 1,
    rosnado: 1, coracao: 1, trovao: 1, guardia: 1, esbarrao: 1, batida: 1, uivo: 1,
    'passos-loop': 1, 'respiracao-loop': 1, 'chuva-loop': 1
  };
  var _corSfxBuf = {}, _corSfxUlt = {}, _corSfxPedido = false, _corLoops = {};
  function _corSfxUrl(nome, i) { return _COR_SFX_BASE + nome + '-' + i + '.mp3'; }
  function _corSfxCarregar() {
    var ac = _corAudio();
    if (_corSfxPedido || !ac || typeof fetch !== 'function') return;
    _corSfxPedido = true;
    Object.keys(_COR_SFX).forEach(function (nome) {
      _corSfxBuf[nome] = [];
      for (var i = 1; i <= _COR_SFX[nome]; i++) (function (url) {
        fetch(url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (ab) {
          // Forma com callbacks: o Safari antigo não devolve Promise aqui.
          ac.decodeAudioData(ab, function (b) { _corSfxBuf[nome].push(b); }, function () {});
        }).catch(function () {});
      })(_corSfxUrl(nome, i));
    });
  }
  // Toca um efeito. Devolve false se ainda não há gravação (quem chama
  // cai no som sintetizado). vol 0..1, pan -1..1, varTom = ± variação.
  function _corSfx(nome, vol, pan, varTom, rate) {
    if (!_corSomLigado()) return true;
    var ac = _corAudio(), l = _corSfxBuf[nome];
    if (!ac || !l || !l.length) return false;
    var i = (Math.random() * l.length) | 0;
    if (l.length > 1 && i === _corSfxUlt[nome]) i = (i + 1) % l.length;
    _corSfxUlt[nome] = i;
    try {
      var src = ac.createBufferSource(); src.buffer = l[i];
      var v = varTom == null ? 0.06 : varTom;
      src.playbackRate.value = (rate || 1) * (1 + (Math.random() * 2 - 1) * v);
      var g = ac.createGain(); g.gain.value = vol == null ? 1 : vol;
      src.connect(g);
      var saida = g;
      if (pan && ac.createStereoPanner) { var pn = ac.createStereoPanner(); pn.pan.value = _corClamp(pan, -1, 1); g.connect(pn); saida = pn; }
      saida.connect(_corMaster);
      src.start();
    } catch (e) { return false; }
    return true;
  }
  // Loop contínuo: chame todo quadro com o volume desejado (0 = some).
  function _corSfxLoop(nome, vol, rate) {
    var ac = _corAudio(), l = _corSfxBuf[nome];
    if (!ac) return false;
    var lp = _corLoops[nome];
    if (!_corSomLigado() || _corPausado || _corEstado !== 'jogando') vol = 0;
    if (!lp) {
      if (!l || !l.length) return false;
      if (vol < 0.005) return true;
      try {
        var src = ac.createBufferSource(); src.buffer = l[0]; src.loop = true;
        // mp3 tem um respiro de codificação nas pontas: pula 30 ms de cada
        // lado pra emenda do loop não dar "clique".
        if (l[0].duration > 0.5) { src.loopStart = 0.03; src.loopEnd = l[0].duration - 0.03; }
        var g = ac.createGain(); g.gain.value = 0.0001;
        src.connect(g); g.connect(_corMaster);
        src.start(0, Math.random() * l[0].duration);
        lp = _corLoops[nome] = { src: src, g: g };
      } catch (e) { return false; }
    }
    try {
      lp.g.gain.setTargetAtTime(Math.max(0.0001, vol), ac.currentTime, 0.25);
      if (rate) lp.src.playbackRate.setTargetAtTime(rate, ac.currentTime, 0.3);
    } catch (e) {}
    if (vol < 0.003 && lp.g.gain.value < 0.003) { try { lp.src.stop(); } catch (e) {} delete _corLoops[nome]; }
    return true;
  }
  function _corLoopsParar() {
    for (var k in _corLoops) { try { _corLoops[k].src.stop(); } catch (e) {} }
    _corLoops = {};
  }

  function _corSomTiro() {
    if (_corSfx('tiro', 0.75)) return;
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    _corSopro(ac, t, 0.18, 5600, 300, 0.80, 170);   // estampido
    _corTom(ac, t, 'sine', 170, 40, 0.14, 0.55);    // corpo grave
    _corSopro(ac, t + 0.05, 0.26, 1100, 160, 0.14); // cauda/eco no campo
  }
  function _corSomImpacto(matou) {
    if (_corSfx('acerto', 0.7)) { if (matou) _corSfx('morre', 0.55, 0, 0.1); return; }
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime + 0.02;
    _corSopro(ac, t, 0.09, 900, 200, 0.34);
    _corTom(ac, t, 'triangle', matou ? 120 : 190, matou ? 45 : 110, matou ? 0.20 : 0.08, 0.30);
  }
  function _corSomVazio() {
    if (_corSfx('vazio', 0.8)) return;
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    _corSopro(ac, t, 0.035, 4200, 1800, 0.30, 900);
    _corSopro(ac, t + 0.07, 0.03, 3400, 1500, 0.20, 900);
  }
  function _corSomPasso() {
    if (_corSfxBuf['passos-loop'] && _corSfxBuf['passos-loop'].length) return;   // o loop de passos cuida disso
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac || ac.state !== 'running') return;
    var t = ac.currentTime;
    _corSopro(ac, t, 0.07, 620 + Math.random() * 180, 120, 0.085);
  }
  function _corSomRecarga() {
    if (_corSfx('recarga', 0.75)) return;
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
  // Rosnado de PERIGO: zumbi perto e dentro da faixa que mata (ver gatilho
  // em _corUpdate/_corRosnadoT). Duas vozes gravas quase na mesma frequência
  // (leve batimento) + um sopro rouco por cima — mais "growl" orgânico do
  // que um tom puro. f0/f1 sorteados a cada chamada pra não repetir igual.
  function _corSomRosnado() {
    if (_corSfx('rosnado', 0.6, 0, 0.12)) return;
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    var dur = _corRand(0.15, 0.35);
    var f0 = _corRand(70, 100), f1 = f0 * _corRand(0.45, 0.65);
    _corTom(ac, t, 'sawtooth', f0, f1, dur, 0.15);
    _corTom(ac, t, 'sawtooth', f0 * 1.04, f1 * 1.04, dur, 0.09);
    _corSopro(ac, t, dur * 0.8, 500, 150, 0.09, 200);
  }
  // Impacto ao morrer batendo em OBSTÁCULO — seco/abafado, bem diferente
  // do impacto em carne (_corSomImpacto usa 'triangle', mais macio). Aqui
  // é ruído filtrado em faixa (highpass alto) + um 'square' curto: mais
  // "crash" metálico que "soco".
  function _corSomImpactoObstaculo() {
    if (_corSfx('batida', 0.85)) return;
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    _corSopro(ac, t, 0.10, 2200, 300, 0.38, 600);
    _corTom(ac, t, 'square', 180, 60, 0.16, 0.20);
  }
  // Uivo/gemido DISTANTE (ambiente, ver _corUivoT/_corUivoTocandoT em
  // _corUpdate) — bem mais baixo que o rosnado de perigo e SEM highpass
  // no sopro (o oposto do rosnado): deixa mais grave/redondo, "longe e
  // abafado" sem precisar de um filtro novo.
  function _corSomUivoDistante(dur) {
    if (_corSfx('uivo', 0.32, _corRand(-0.8, 0.8), 0.1)) return;
    if (!_corSomLigado()) return;
    var ac = _corAudio(); if (!ac) return;
    var t = ac.currentTime;
    _corTom(ac, t, 'sawtooth', 130, 85, dur, 0.05);
    _corSopro(ac, t, dur, 280, 100, 0.05);
  }

  /* ══════════════════════════════════════════════════════════════
     MÚSICA DE FUNDO (BGM) — HTMLAudioElement simples, DE PROPÓSITO
     separado do Web Audio sintetizado dos SFX acima (motores diferentes,
     sem mexer um no outro). Trilha:
       /Jogos/assets/corrida/musica-fundo.mp3
       "Dark Ambient Music" — TheoJT (Freesound, CC BY 4.0) — crédito
       visível na tela de fim (ver index.html, overlay #cor-fim).
     Opcional 100%: se o arquivo faltar/falhar, _corBgmOk fica false e
     todo play/pause vira no-op — o jogo segue normal sem música.
  ══════════════════════════════════════════════════════════════ */
  var _corBgm = null, _corBgmOk = false;
  var _COR_BGM_VOL = 0.30;   // dentro de 0.28-0.35 pedido — não abafa tiro/passo
  var _corBgmMudoAntes = null;   // último estado conhecido de _corSomLigado(), p/ detectar o usuário mutar/desmutar NO MEIO da partida

  // Cria e pré-carrega o elemento (chamado 1x em _corPreparar). Só cria o
  // objeto e pede o load — o play de verdade só acontece em _corComecar.
  function _corBgmPreparar() {
    if (_corBgm) return;
    try {
      var a = new Audio(_COR_ASSET_BASE + 'musica-fundo.mp3');
      a.loop = true;
      a.preload = 'auto';
      a.volume = _COR_BGM_VOL;
      a.addEventListener('error', function () { _corBgmOk = false; });
      _corBgm = a;
      _corBgmOk = true;   // "existe e não deu erro síncrono" — não garante que carregou
    } catch (e) { _corBgm = null; _corBgmOk = false; }
  }
  function _corBgmTocar() {
    if (!_corBgm || !_corBgmOk || !_corSomLigado() || !_corOpc.musica) return;
    try {
      var p = _corBgm.play();
      if (p && p.catch) p.catch(function () {});   // autoplay bloqueado/erro de decode → silencioso
    } catch (e) {}
  }
  // Pausa e rebobina — usado no fim de jogo e ao sair da Corrida, pra a
  // próxima partida sempre começar a música do zero (nunca no meio).
  function _corBgmParar() {
    if (!_corBgm) return;
    try { _corBgm.pause(); _corBgm.currentTime = 0; } catch (e) {}
  }
  // Chamado a cada frame (rodando): detecta o jogador mutar/desmutar o som
  // global NO MEIO da partida e acompanha (pausa/retoma) — sem isso a BGM
  // ficava tocando por cima do botão de mudo, ou não voltava ao desmutar.
  function _corBgmChecarMudo() {
    var ligado = _corSomLigado();
    if (ligado === _corBgmMudoAntes) return;
    _corBgmMudoAntes = ligado;
    if (ligado) _corBgmTocar(); else _corBgmParar_semRebobinar();
  }
  // Igual _corBgmParar, mas sem zerar o currentTime — mutar não é "acabou
  // a partida", é só pausa; ao desmutar a música retoma de onde parou.
  function _corBgmParar_semRebobinar() {
    if (!_corBgm) return;
    try { _corBgm.pause(); } catch (e) {}
  }

  /* ── Estado / canvas ──────────────────────────────────────────── */
  var _corCanvas = null, _corCtx = null;
  var _corW = 640, _corH = 360, _corDpr = 1;
  var _corEstado = 'inicio';
  var _corRAF = 0, _corLast = 0;
  var _corPausado = false;   // menu unificado do hub (ver _corRegistrarMenu)
  var _corInicioMs = 0;      // Date.now() no início da corrida (segundos reais — P1-2)
  var _corPausaTotalMs = 0;  // soma do tempo pausado, descontado do total
  var _corPausaInicioMs = 0; // Date.now() de quando a pausa atual começou
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

  /* ── Esbarrão (raspão em zumbi) ───────────────────────────────────
     _corShakeT: segundos restantes do tremor de câmera do esbarrão —
     separado de _corBobY (que é "só sobe", ver comentário dele) pra não
     violar esse invariante.
     _corIframesT: janela BEM curta (só pra não processar a mesma colisão
     duas vezes no mesmo lance — não é invulnerabilidade de verdade).
     _corSlowT: "cambaleio" pós-esbarrão (~1.2s, estilo Into the Dead) —
     enquanto ativo, o avanço do mundo fica ~50% (ver velEfetiva em
     _corUpdate) E qualquer novo contato de zumbi em z≤0.05 (centro OU
     borda) é morte na hora — é a "chain kill": levou um raspão, ficou
     lento, se a horda te alcançar de novo antes de se recompor, morre. */
  var _corShakeT = 0, _COR_SHAKE_DUR = 0.22;
  var _corIframesT = 0, _COR_IFRAMES_DUR = 0.14;
  var _corSlowT = 0, _COR_SLOW_DUR = 1.2, _COR_SLOW_MUL = 0.5;
  function _corShakeY() { return _corShakeT > 0 ? Math.sin(_corShakeT * 80) * (_corShakeT / _COR_SHAKE_DUR) * 0.016 : 0; }
  function _corShakeX() { return _corShakeT > 0 ? Math.cos(_corShakeT * 65) * (_corShakeT / _COR_SHAKE_DUR) * 0.014 : 0; }

  /* ── Throttle dos SFX ambiente novos (ver _corSomRosnado/_corSomUivoDistante) ──
     _corRosnadoT: cooldown GLOBAL (não por zumbi) — qualquer zumbi perigoso
     dispara, mas só 1 rosnado a cada 0.8-1.2s no total, senão uma horda
     inteira perto viraria um coro.
     _corUivoT: tempo até o próximo uivo distante poder soar (10-18s).
     _corUivoTocandoT: > 0 enquanto o uivo atual ainda estaria soando —
     evita empilhar um uivo em cima do outro. */
  var _corRosnadoT = 0;
  var _corUivoT = 0, _corUivoTocandoT = 0;

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
  var _COR_VEL_INI = 0.125, _COR_VEL_MAX = 0.28, _COR_VEL_ACC = 0.0024;

  /* ── Munição / tiro ───────────────────────────────────────────── */
  var _COR_MUN_INI = 8;
  var _corMun = _COR_MUN_INI;
  var _COR_TIRO_CD = 0.14;
  var _corTiroT = 0, _corFlashT = 0, _corRecuo = 0;

  /* ── Entidades ────────────────────────────────────────────────── */
  var _corZumbis = [];
  var _corItens = [];
  var _corSangue = [];
  var _corObstaculos = [];
  var _corSpawnT = 0, _corItemT = 0, _corObstT = 0;

  /* ── Moedas na pista (estilo Subway Surfers) ─────────────────────
     Em vez de pagar por distância no fim (com teto de 25 por partida),
     fileiras de moedas vêm pelo campo — retas ou na diagonal — e cada
     uma pega vale 1, sem teto: quem corre mais longe pega mais. Elas
     passam no meio da horda, então pegar tudo é arriscar. Creditadas de
     uma vez no fim (ou ao sair no meio), pra não gravar a cada moeda. */
  var _COR_MOEDA_IMG = '/Jogos/assets/corujinha/sim-moeda-v2.webp';   // mesma arte da Corujinha
  var _COR_MOEDA_PEGA = 0.24;    // meia-largura (unid. de faixa) que conta como pegar
  var _corMoedas = [];           // { z, faixa, fase }
  var _corMoedaT = 0;            // s até a próxima fileira
  var _corMoedasRun = 0;         // moedas pegas na corrida atual
  var _corMoedaFx = [];          // "+1" de coleta, em coordenadas de tela: { x, t }
  var _corMoedaStreak = 0, _corMoedaStreakT = 0;   // sequência → som sobe de tom
  var _corMoedaImg = null, _corMoedaSp = null, _corMoedaSpImg = false;

  /* ══════════════════════════════════════════════════════════════
     v6 — MAIS INTO THE DEAD: armas nas caixas, agarrão + aviso de
     perigo, missões, zonas por distância e coruja guardiã. Toda arte
     nova é OPCIONAL (mesma regra do resto do jogo): sem o arquivo, cai
     num desenho provisório e "acende" sozinha quando o arquivo subir.
  ══════════════════════════════════════════════════════════════ */

  /* ── Armas temporárias ──────────────────────────────────────────
     Caixa de arma no campo (como a de munição, mas mais rara): pegar dá
     uma arma especial com munição PRÓPRIA; quando ela acaba, volta pro
     lançador de sempre (cuja munição fica guardada). Escopeta: tiro
     espalhado que pega todo zumbi perto num cone largo. Metralhadora:
     atira SOZINHA enquanto tiver zumbi na mira (você só mira desviando).
     filtro = tingimento provisório do lançador enquanto a arte não chega. */
  var _COR_ARMAS = {
    escopeta:     { nome: 'Escopeta',     sub: 'Espalha e derruba quem estiver perto', mun: 8,  cd: 0.55, arte: 'arma-escopeta.webp',     filtro: 'hue-rotate(-35deg) saturate(1.5) brightness(1.05)', cor: '#ff9d3a' },
    metralhadora: { nome: 'Metralhadora', sub: 'Atira sozinha no que estiver na mira',  mun: 45, cd: 0.10, arte: 'arma-metralhadora.webp', filtro: 'hue-rotate(150deg) saturate(1.4)',               cor: '#5fd4ff', auto: true }
  };
  var _COR_ARMAS_LISTA = ['escopeta', 'metralhadora'];
  var _COR_CAIXA_ARMA = 'caixa-arma.webp';
  var _corArma = '';           // '' = lançador básico
  var _corArmaMun = 0;
  var _corCaixas = [];         // { z, faixa, bob, arma }
  var _corCaixaT = 0;

  /* ── Coruja guardiã (o "cachorro" do Into the Dead) ─────────────
     Item raro no campo. Pegou: por _COR_GUARD_DUR segundos uma coruja
     voa na sua frente e derruba, um por um, os zumbis que chegam perto
     (prioriza quem está na sua linha). Arte: sheet 3×3 voando/atacando;
     sem ela, usa a owl-flying.webp do app com um halo dourado. */
  var _COR_GUARD_DUR = 8, _COR_GUARD_CD = 0.65;
  var _COR_GUARD_SHEET = 'coruja-guardia.webp', _COR_GUARD_ITEM = 'item-guardia.webp';
  var _corGuardItens = [];     // { z, faixa, bob }
  var _corGuardItemT = 0;
  var _corGuardT = 0;          // s restantes de guardiã ativa
  var _corGuardCdT = 0;        // s até o próximo ataque
  var _corGuard = { x: 0, y: 0, alvo: null, voo: 0, atk: 0 };   // tela; atk>0 = mergulhando
  var _corGuardImg = null;     // fallback /webp/owl-flying.webp

  /* ── Perigo (batimento + borda vermelha) e agarrão ──────────────
     _corPerigo 0..1: quão perto está o zumbi mais perigoso DA SUA LINHA
     (mesma conta do pulso vermelho no chão). Dita o ritmo do coração e
     a força da borda vermelha. Morte por zumbi não corta direto pro fim:
     ~1.1s de "agarrão" (a coruja-zumbi pula na tela) antes da tela final. */
  var _corPerigo = 0, _corCoracaoT = 0, _corCoracaoPulso = 0;
  var _COR_AGARRAO_DUR = 1.15, _COR_AGARRAO_SHEET = 'zumbi-agarrao.webp';
  var _corAgarraoT = 0, _corAgarraoZb = null;

  /* ── Zonas por distância ────────────────────────────────────────
     Cada zona troca o cenário de fundo (com fusão de ~2.5s) e o sorteio
     de obstáculos. Sem a arte da zona, usa o cenário da floresta com uma
     tinta de cor por cima. Obstáculos "soArte" só entram no sorteio
     depois que a imagem deles carregou (sem desenho provisório feio). */
  var COR_ZONAS = [
    { id: 'floresta', nome: 'Floresta Morta',     ini: 0,    cen: 'cenario-floresta.webp', tinta: '',                      obst: ['toco', 'pedra', 'lapide', 'abobora', 'cerca', 'placa'], beira: ['toco', 'toco', 'lapide', 'lapide', 'pedra', 'pedra', 'abobora', 'cerca'] },
    { id: 'sitio', nome: 'Sítio Abandonado',   ini: 350,  cen: 'cenario-sitio.webp',    tinta: 'rgba(130,85,25,0.26)',  obst: ['cerca', 'abobora', 'entulho', 'feno', 'trator', 'espantalho'], beira: ['feno', 'feno', 'cerca', 'cerca', 'espantalho', 'abobora', 'trator'] },
    { id: 'estrada', nome: 'Entrada da Cidade',  ini: 800,  cen: 'cenario-estrada.webp',  tinta: 'rgba(40,75,130,0.22)',  obst: ['carro', 'placa', 'entulho', 'cone', 'barricada', 'onibus'], beira: ['poste', 'poste', 'poste', 'cone', 'cone', 'placa', 'barricada', 'carro', 'onibus'] },
    { id: 'centro', nome: 'Centro de Angatuba', ini: 1400, cen: 'cenario-centro.webp',   tinta: 'rgba(160,70,30,0.20)',  obst: ['carro', 'entulho', 'placa', 'banco', 'poste', 'carrinho'], beira: ['poste', 'poste', 'poste', 'banco', 'banco', 'carrinho', 'carro', 'placa'] }
  ];
  var _corZonaIdx = 0, _corZonaAnt = -1, _corZonaFade = 1;

  /* ── Beira do caminho (v6.1): o mundo passando ──────────────────
     O Into the Dead dá sensação de corrida porque o mundo inteiro passa por
     você: árvores, cercas, carros, mato. Aqui o fundo era uma imagem parada
     e só os obstáculos se mexiam. Agora, dos dois lados (fora da faixa onde
     nascem zumbis e obstáculos) vem um fluxo contínuo de cenário de beira,
     SEM colisão: a vegetação genérica (deco-*.webp, todas as zonas) e os
     objetos da zona (reaproveitando a arte dos obstáculos). Tufos de capim
     pequenos passam também pelo meio do chão. Só entra o que tem arte.
     As listas "beira" das zonas repetem nomes de propósito = peso no sorteio
     (poste aparece muito, ônibus é raro). */
  var _COR_DECO = {   // altMul em relação à altura do zumbi; meio = pode passar pelo chão do meio
    arvore1:  { altMul: 3.2 }, arvore2: { altMul: 2.8 }, pinheiro: { altMul: 3.4 },
    arbusto:  { altMul: 0.9 }, capim:   { altMul: 0.6 }, tufo:     { altMul: 0.28, meio: true },
    mato:     { altMul: 0.45, meio: true }, mourao: { altMul: 0.9 }, pedra: { altMul: 0.5 },
    // Objetos de beira próprios de cada zona (zona = id em COR_ZONAS). Só entram com arte.
    milho:       { altMul: 1.7, zona: 'sitio' },   caixadagua: { altMul: 2.8, zona: 'sitio' },  galinheiro: { altMul: 1.3, zona: 'sitio' },
    carroca:     { altMul: 1.0, zona: 'sitio' },   porteira:   { altMul: 0.9, zona: 'sitio' },  latao:      { altMul: 0.6, zona: 'sitio' },
    lenha:       { altMul: 0.6, zona: 'sitio' },   moinho:     { altMul: 3.2, zona: 'sitio' },  poco:       { altMul: 1.0, zona: 'sitio' },
    placavel:    { altMul: 1.5, zona: 'estrada' }, capotado:   { altMul: 0.8, zona: 'estrada' }, lixo:      { altMul: 0.8, zona: 'estrada' },
    ponto:       { altMul: 1.6, zona: 'estrada' }, outdoor:    { altMul: 2.6, zona: 'estrada' }, cacamba:   { altMul: 0.9, zona: 'estrada' },
    hidrante:    { altMul: 0.5, zona: 'estrada' }, semaforo:   { altMul: 2.0, zona: 'estrada' }, pneus:     { altMul: 0.6, zona: 'estrada' },
    orelhao:     { altMul: 1.4, zona: 'centro' },  banca:      { altMul: 1.5, zona: 'centro' },  chafariz:  { altMul: 1.2, zona: 'centro' },
    lixeira:     { altMul: 0.7, zona: 'centro' },  bicicleta:  { altMul: 0.6, zona: 'centro' },  mesabar:   { altMul: 0.8, zona: 'centro' },
    mercado:     { altMul: 0.7, zona: 'centro' },  floreira:   { altMul: 0.6, zona: 'centro' },  relogio:   { altMul: 2.4, zona: 'centro' }
  };
  var _COR_DECO_NOMES = ['arvore1', 'arvore2', 'pinheiro', 'arbusto', 'capim', 'tufo', 'mato', 'mourao', 'pedra',
    'milho', 'caixadagua', 'galinheiro', 'carroca', 'porteira', 'latao', 'lenha', 'moinho', 'poco',
    'placavel', 'capotado', 'lixo', 'ponto', 'outdoor', 'cacamba', 'hidrante', 'semaforo', 'pneus',
    'orelhao', 'banca', 'chafariz', 'lixeira', 'bicicleta', 'mesabar', 'mercado', 'floreira', 'relogio'];
  // Pede a arte da vegetação geral + a dos objetos da zona (1 pedido por arquivo).
  function _corDecoPedir(zonaId) {
    for (var i = 0; i < _COR_DECO_NOMES.length; i++) {
      var d = _COR_DECO[_COR_DECO_NOMES[i]];
      if (!d.zona || d.zona === zonaId) _corAssetNovo('deco-' + _COR_DECO_NOMES[i] + '.webp');
    }
  }
  var _corBeira = [];          // { z, faixa, tipo, deco, esc, flip }
  var _corBeiraT = 0, _corChaoT = 0;

  /* ── Avisos grandes no meio da tela (arma, zona, missão) — fila ── */
  var _corAvisos = [];         // { txt, sub, cor, t, dur }

  /* ── Contadores da corrida (missões) ── */
  var _corRun = null;
  function _corRunZerar() {
    _corRun = { abates: 0, rapido: 0, forte: 0, escopeta: 0, tiros: 0, distPrimeiroTiro: -1,
                esbarroes: 0, distPrimeiroEsb: -1, caixas: 0, guardia: 0, missoesFeitas: [] };
  }
  _corRunZerar();

  // Campo ABERTO: os zumbis nascem em qualquer x lateral contínuo dentro
  // deste range (em unidades de faixa; -1.6..1.6 cobre além das bordas pra
  // eles entrarem/saírem de campo naturalmente). Sem faixas discretas.
  var _COR_CAMPO_LAT = 1.1;    // era 1.6 — campo mais estreito, zumbis nascem perto da linha de visão
  // População alvo de zumbis vivos na tela: sobe com a distância (base
  // 2-4, +1 a cada ~200m, com teto) — o campo enche de verdade com o tempo
  // em vez de ficar fixo pra sempre. Base era 5-9: com _corSpawnT inicial
  // curto (0.9s) e reposição rápida (0.25-0.6s, 2 de uma vez), isso fazia
  // nascer uma PAREDE de zumbi no centro nos primeiros ~2s de jogo, antes
  // do jogador ter qualquer chance de reagir — ver também o reset de
  // _corSpawnT e o "só 1 por vez nos primeiros 100m" em _corUpdate.
  function _corPopMin() { return Math.min(6, 2 + Math.floor(_corDist / 200)); }
  function _corPopMax() { return Math.min(10, 4 + Math.floor(_corDist / 200)); }

  var _COR_TIPOS = {
    normal: { hp: 1, w: 0.16, cor: '#6f7d5a', corEsc: '#4b5640', vel: 1.00 },
    rapido: { hp: 1, w: 0.13, cor: '#8a6f3a', corEsc: '#5e4b26', vel: 1.35 },
    forte:  { hp: 3, w: 0.24, cor: '#5a6f6b', corEsc: '#3c4b48', vel: 0.80 },
    // v6.2 — eventos: corredora (sprint) e rastejante (baixa: alt = fração da altura)
    corredor:   { hp: 1, w: 0.13, cor: '#8a4a3a', corEsc: '#5e2e22', vel: 1.9 },
    rastejante: { hp: 1, w: 0.20, cor: '#6f7d5a', corEsc: '#4b5640', vel: 0.85, alt: 0.55 }
  };

  // Meia-largura da "pista" que conta como colisão (faixa lateral em que,
  // se o zumbi chegar em z~0 dentro dela, é GAME OVER). Função só pra não
  // duplicar a fórmula entre o teste de colisão de verdade e o aviso visual
  // (_corDrawZumbi) — as duas TÊM que usar exatamente o mesmo número, senão
  // o aviso mente (acende perigo num zumbi que ia passar reto, ou o
  // contrário).
  function _corMeiaColisao(tipo) { return (_COR_TIPOS[tipo].w * 0.5) + 0.11; }   // era 0.20 — desviar precisa ser de verdade
  // Fração de _corMeiaColisao que conta como colisão FATAL (centro). Fora
  // dela mas ainda dentro de _corMeiaColisao é ESBARRÃO (raspão), não morte.
  var _COR_FATAL_FRAC = 0.55;

  /* Obstáculos de cenário (carro/cerca/entulho/pedra): sólidos, sem HP,
     só pra desviar — ver _corSpawnObstaculo/_corDrawObstaculo. altMul e
     ratio são relativos ao mesmo hpx usado pro zumbi (_corDrawZumbi), pra
     ficarem na mesma escala visual; larguraMundo é a largura na MESMA
     unidade de faixa/camX que _COR_TIPOS[].w, usada só na colisão. */
  var _COR_OBST_TIPOS = {
    carro:   { altMul: 0.95, ratio: 1.85, larguraMundo: 0.62, cor: '#4c5761', corEsc: '#2b3237', corVid: '#232a30', corFarol: '#d8b24a' },
    cerca:   { altMul: 0.55, ratio: 2.60, larguraMundo: 0.46, cor: '#8a6a44', corEsc: '#5c4630' },
    entulho: { altMul: 0.50, ratio: 1.70, larguraMundo: 0.42, cor: '#6b6153', corEsc: '#453f36' },
    pedra:   { altMul: 0.50, ratio: 1.25, larguraMundo: 0.32, cor: '#767670', corEsc: '#4a4a45' },
    // v2: obstáculos novos (só com arte; sem a imagem, desenham como pedra).
    toco:    { altMul: 0.55, ratio: 1.05, larguraMundo: 0.30, cor: '#6b5236', corEsc: '#45341f', vetor: 'pedra' },
    placa:   { altMul: 0.80, ratio: 0.62, larguraMundo: 0.20, cor: '#7a6040', corEsc: '#4e3c27', vetor: 'pedra' },
    abobora: { altMul: 0.42, ratio: 1.03, larguraMundo: 0.26, cor: '#e07a1f', corEsc: '#9c4f10', vetor: 'pedra' },
    lapide:  { altMul: 0.55, ratio: 0.96, larguraMundo: 0.26, cor: '#86867f', corEsc: '#55554f', vetor: 'pedra' },
    // v6: obstáculos das zonas novas — soArte: só entram no sorteio quando
    // a imagem carregou (ver _corObstSortear).
    feno:       { altMul: 0.55, ratio: 1.13, larguraMundo: 0.31, cor: '#b58a3a', corEsc: '#7a5a22', vetor: 'pedra', soArte: true },
    trator:     { altMul: 1.00, ratio: 1.22, larguraMundo: 0.61, cor: '#8a3a2a', corEsc: '#4e2018', vetor: 'pedra', soArte: true },
    espantalho: { altMul: 1.15, ratio: 0.79, larguraMundo: 0.35, cor: '#8a6a44', corEsc: '#5c4630', vetor: 'pedra', soArte: true },
    cone:       { altMul: 0.45, ratio: 0.82, larguraMundo: 0.19, cor: '#e8752a', corEsc: '#9c4a14', vetor: 'pedra', soArte: true },
    barricada:  { altMul: 0.70, ratio: 0.93, larguraMundo: 0.32, cor: '#c9a12a', corEsc: '#6b5616', vetor: 'pedra', soArte: true },
    onibus:     { altMul: 1.15, ratio: 1.42, larguraMundo: 0.80, cor: '#c9a12a', corEsc: '#6b5616', vetor: 'pedra', soArte: true },
    banco:      { altMul: 0.50, ratio: 1.48, larguraMundo: 0.37, cor: '#6b4a2a', corEsc: '#3e2a16', vetor: 'pedra', soArte: true },
    poste:      { altMul: 1.60, ratio: 0.48, larguraMundo: 0.16, cor: '#55595e', corEsc: '#2f3236', vetor: 'pedra', soArte: true },
    carrinho:   { altMul: 0.85, ratio: 0.73, larguraMundo: 0.31, cor: '#c33a3a', corEsc: '#7a2020', vetor: 'pedra', soArte: true }
  };
  // Arte dos obstáculos: obst-<tipo>.webp, recortados sem fundo. Lista de
  // TODOS (pré-carga); o sorteio de cada zona vem de COR_ZONAS[].obst.
  var _COR_OBST_NOMES = ['carro', 'cerca', 'entulho', 'pedra', 'toco', 'placa', 'abobora', 'lapide',
                         'feno', 'trator', 'espantalho', 'cone', 'barricada', 'onibus', 'banco', 'poste', 'carrinho'];
  // Mesma lógica do _corMeiaColisao, mas pro obstáculo (sem o +0.11 do
  // zumbi, que existia pra compensar a "gordura" do boneco vetorial).
  function _corMeiaObst(tipo) { return (_COR_OBST_TIPOS[tipo].larguraMundo * 0.5) + 0.05; }

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
    // _corShakeY/_corShakeX somam o tremor curto do esbarrão em cima disso.
    var horizonY = H * _COR_HORIZ + _corBobY * H + _corShakeY() * H;
    var baseY = H * 1.06 + _corBobY * H + _corShakeY() * H;
    var t = 1 - zc;
    var tt = t * t;
    var y = horizonY + (baseY - horizonY) * tt;
    var s = 0.14 + 0.95 * tt;
    var espalhar = 0.08 + 0.92 * tt;
    var cx = W * 0.5 - _corCamX * (W * 0.42) * espalhar + _corSwayX * W * espalhar + _corShakeX() * W * espalhar;
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
    // Desempenho: o custo do quadro cresce com o nº de pixels (DPR 2 = 4×).
    // Teto de 1.5 (1 no modo leve) e um orçamento total de pixels, pra telas
    // grandes de PC não pesarem; o navegador amplia o canvas sem custo.
    var dprMax = _corOpc.leve ? 1 : 1.5, orc = _corOpc.leve ? 0.55e6 : 1.15e6;
    _corDpr = Math.min(dprMax, window.devicePixelRatio || 1);
    if (cssW * cssH * _corDpr * _corDpr > orc) _corDpr = Math.max(0.6, Math.sqrt(orc / (cssW * cssH)));
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
    _corMelhRecarregar();
    _corMun = _corMunInicial();
    _corChaoRolo = 0; _corEventoT = 8; _corRespT = 0; _corGemidoCd = 0; _corTilt.base = null; _corLados = {}; _corAutoT = 0; _corFps.n = 0; _corFps.soma = 0;
    _corClimaZerar();
    _corTiroT = 0; _corFlashT = 0; _corRecuo = 0;
    _corCamX = 0; _corCamVX = 0;
    _corShakeT = 0; _corIframesT = 0; _corSlowT = 0;
    _corRosnadoT = 0; _corUivoT = _corRand(10, 18); _corUivoTocandoT = 0;
    _corPasso = 0; _corPassoUlt = 0;
    _corZumbis.length = 0; _corItens.length = 0; _corSangue.length = 0; _corObstaculos.length = 0;
    _corMoedas.length = 0; _corMoedaFx.length = 0; _corMoedasRun = 0; _corMoedasPagas = false;
    _corMoedaStreak = 0; _corMoedaStreakT = 0; _corMoedaT = 4.5;
    _corMoedaSprite();   // já começa a baixar a arte da moeda
    _corArma = ''; _corArmaMun = 0; _corCaixas.length = 0; _corCaixaT = 22;
    _corGuardItens.length = 0; _corGuardItemT = 35; _corGuardT = 0; _corGuardCdT = 0;
    _corGuard.alvo = null; _corGuard.atk = 0;
    _corPerigo = 0; _corCoracaoT = 0; _corCoracaoPulso = 0;
    _corAgarraoT = 0; _corAgarraoZb = null;
    _corZonaIdx = 0; _corZonaAnt = -1; _corZonaFade = 1;
    _corAvisos.length = 0;
    _corBeira.length = 0; _corBeiraT = 0; _corChaoT = 0;
    _corDecoPedir('floresta');
    _corAssetNovo(_COR_MATO);
    _corRunZerar();
    _corMissoesCarregar();
    _corAssetNovo(_COR_CAIXA_ARMA); _corAssetNovo(_COR_GUARD_ITEM); _corAssetNovo(_COR_GUARD_SHEET); _corAssetNovo(_COR_AGARRAO_SHEET);
    if (!_corGuardImg) { try { _corGuardImg = new Image(); _corGuardImg.src = '/webp/owl-flying.webp'; } catch (e) {} }
    // 2.2s (era 0.9s) — dá tempo do jogador se situar antes do primeiro
    // lote de zumbis nascer (ver comentário em _corPopMin sobre a "parede").
    _corSpawnT = 2.2; _corItemT = 8.5; _corObstT = _corRand(8, 12);
    _corAtualizarHUD(true);
  }

  /* HUD — antes isto rodava 3 getElementById + 3 textContent + 1
     localStorage.getItem A CADA FRAME (180 escritas de DOM por segundo).
     Em Android fraco isso sozinho já engasgava o loop. Agora os elementos
     ficam em cache e só escrevemos quando o valor realmente muda. */
  var _corElDist = null, _corElMun = null, _corElRec = null, _corElMoe = null, _corElMunLbl = null;
  var _corHudUlt = { d: -1, m: -1, r: -1, mo: -1, a: null };
  function _corAtualizarHUD(forcar) {
    if (forcar || !_corElDist) {
      _corElDist = document.getElementById('cor-dist');
      _corElMun  = document.getElementById('cor-mun');
      _corElRec  = document.getElementById('cor-recorde');
      _corElMoe  = document.getElementById('cor-moedas');
      _corElMunLbl = _corElMun && _corElMun.parentNode ? _corElMun.parentNode.querySelector('.cor-hud-label') : null;
    }
    if (_corElMoe && (forcar || _corMoedasRun !== _corHudUlt.mo)) { _corElMoe.textContent = _corMoedasRun; _corHudUlt.mo = _corMoedasRun; }
    var dv = Math.floor(_corDist);
    if (_corElDist && (forcar || dv !== _corHudUlt.d)) { _corElDist.textContent = dv + 'm'; _corHudUlt.d = dv; }
    // Com arma especial, o quadro de munição mostra a dela (nome + tiros).
    var munV = _corArma ? _corArmaMun : _corMun;
    if (_corElMunLbl && (forcar || _corArma !== _corHudUlt.a)) {
      _corElMunLbl.textContent = _corArma ? _COR_ARMAS[_corArma].nome : 'Munição';
      if (_corElMun) _corElMun.style.color = _corArma ? _COR_ARMAS[_corArma].cor : '';
      _corHudUlt.a = _corArma;
    }
    if (_corElMun && (forcar || munV !== _corHudUlt.m)) { _corElMun.textContent = munV; _corHudUlt.m = munV; }
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
    // Mix sobe a partir dos ~200-400m (era desde o início, mais devagar) e
    // continua apertando com teto mais alto.
    var pRapido = _corClamp(0.10 + Math.max(0, d - 200) / 3500, 0.10, 0.48);
    var pForte  = _corClamp(0.05 + Math.max(0, d - 400) / 4500, 0.05, 0.38);
    var r = Math.random();
    var tipo = (r < pForte) ? 'forte' : ((r < pForte + pRapido) ? 'rapido' : 'normal');
    var def = _COR_TIPOS[tipo];
    // Arte: a comum alterna entre duas aparências (só visual).
    var sheetKey = (tipo === 'normal' && Math.random() < 0.5) ? 'normalB' : tipo;
    // Campo aberto: zumbis nascem RELATIVOS à posição da câmera (sempre no
    // teu campo de visão atual), pra o campo nunca "acabar" quando você anda
    // muito pro lado. Espalhados numa faixa de ±1.6 ao redor de onde olha.
    var faixa = _corCamX + _corRand(-_COR_CAMPO_LAT, _COR_CAMPO_LAT);
    // z inicial variado (perto de Z_FAR, mas escalonado) pra não nascerem
    // todos na mesma linha de profundidade.
    var z = _COR_Z_FAR - _corRand(0, 0.18);
    _corZumbis.push({
      z: z, faixa: faixa, tipo: tipo, sheetKey: sheetKey,
      hp: def.hp, morto: false, cai: 0, bob: Math.random() * Math.PI * 2,
      // defasagem da animação: sem isso a horda inteira dá o mesmo passo
      // no mesmo instante e parece um só zumbi clonado.
      fase: Math.random() * 4000,
      // deriva lateral lenta (cambaleio pelo campo)
      swayA: (tipo === 'forte') ? _corRand(0.02, 0.05) : _corRand(0.04, 0.10),
      swayF: _corRand(0.8, 1.8), swayP: Math.random() * Math.PI * 2,
      // cada zumbi tem uma leve variação de velocidade individual
      velVar: _corRand(0.85, 1.15),
      // projeção do último frame desenhado (reaproveitada pela mira e
      // pelo tiro — o que você VÊ é exatamente o que você acerta)
      _px: 0, _py: 0, _ps: 0, _vis: false
    });
  }
  function _corSpawnItem() {
    // Relativo à câmera, como os zumbis. Munição escassa: nasce mais nas
    // laterais (longe do centro) — precisa se mover de verdade pra pegar,
    // em vez de cair sozinha na mira.
    var lado = (Math.random() < 0.5 ? -1 : 1) * _corRand(0.6, 1.4);
    _corItens.push({ z: _COR_Z_FAR, faixa: _corCamX + lado, bob: Math.random() * Math.PI * 2 });
  }

  /* Fileira de 4 a 6 moedas, uma atrás da outra (nascem além do horizonte,
     escondidas na névoa, e vão surgindo). 40% das vezes é diagonal —
     obriga a acompanhar com o arraste. Relativa à câmera, como o resto.
     Desvia de obstáculo que acabou de nascer, pra fileira não terminar
     dentro de um carro. */
  function _corSpawnMoedas() {
    var n = 4 + ((Math.random() * 3) | 0);
    var ini = _corCamX + _corRand(-0.85, 0.85);
    var fim = (Math.random() < 0.4) ? _corClamp(ini + _corRand(-0.7, 0.7), _corCamX - 0.95, _corCamX + 0.95) : ini;
    for (var k = 0; k < _corObstaculos.length; k++) {
      var ob = _corObstaculos[k], meio = (ini + fim) / 2;
      if (ob.z > 0.55 && Math.abs(ob.faixa - meio) < 0.45) {
        var desvio = (meio >= ob.faixa ? 1 : -1) * 0.5;
        ini += desvio; fim += desvio;
      }
    }
    for (var i = 0; i < n; i++) {
      _corMoedas.push({ z: _COR_Z_FAR + i * 0.055, faixa: ini + (fim - ini) * (i / (n - 1)), fase: Math.random() * 6.283 });
    }
  }

  // Credita as moedas da corrida na carteira (uma vez só) e devolve quantas.
  var _corMoedasPagas = false;
  function _corCreditarMoedas() {
    if (_corMoedasPagas) return 0;
    _corMoedasPagas = true;
    var G = window.AngatubaGames;
    if (_corMoedasRun > 0 && G && typeof G.moedasAdd === 'function') G.moedasAdd(_corMoedasRun, 'corrida');
    return _corMoedasRun;
  }

  // Sprite da moeda (arte da moeda-coruja com halo dourado; sem a arte,
  // disco vetorial), pré-renderizado UMA vez em 96px e só escalado no
  // desenho. Refeito uma única vez quando a arte termina de carregar.
  function _corMoedaSprite() {
    if (!_corMoedaImg) {
      try {
        _corMoedaImg = new Image();
        _corMoedaImg.onload = function () { _corMoedaSp = null; };
        _corMoedaImg.src = _COR_MOEDA_IMG;
      } catch (e) {}
    }
    var temImg = !!(_corMoedaImg && _corMoedaImg.complete && _corMoedaImg.naturalWidth);
    if (_corMoedaSp && (_corMoedaSpImg || !temImg)) return _corMoedaSp;
    var T = 96, r = T / 2 / 1.35, cv, c;
    try {
      cv = document.createElement('canvas');
      cv.width = cv.height = T;
      c = cv.getContext('2d');
      if (!c) return null;
    } catch (e) { return null; }
    c.translate(T / 2, T / 2);
    c.shadowColor = 'rgba(255,205,70,0.85)';
    c.shadowBlur = r * 0.6;
    var desenhou = false;
    if (temImg) {
      try { c.drawImage(_corMoedaImg, -r * 1.12, -r * 1.12, r * 2.24, r * 2.24); desenhou = true; } catch (e) {}
    }
    if (!desenhou) {
      var g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#fff3b0'); g.addColorStop(0.55, '#ffc928'); g.addColorStop(1, '#d48a00');
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(150,90,0,0.7)';
      c.lineWidth = Math.max(1, r * 0.14);
      c.beginPath(); c.arc(0, 0, r * 0.68, 0, Math.PI * 2); c.stroke();
    }
    _corMoedaSp = cv; _corMoedaSpImg = desenhou;
    return cv;
  }

  /* ══════════════════════════════════════════════════════════════
     v6 — FUNÇÕES: itens novos, avisos, missões, zonas, guardiã,
     perigo e agarrão (ver o bloco de estado "v6" lá em cima).
  ══════════════════════════════════════════════════════════════ */

  // Asset novo (v6): um nome só, sem a cascata de variantes de nome — os
  // arquivos novos sobem já com o nome certo, e assim cada arte que ainda
  // não existe custa 1 pedido (404) em vez de 3.
  function _corAssetNovo(nome) { return _corAssetMulti([nome]); }
  function _corObstAsset(tipo) {
    var def = _COR_OBST_TIPOS[tipo];
    return (def && def.soArte) ? _corAssetNovo('obst-' + tipo + '.webp') : _corAsset('obst-' + tipo + '.webp');
  }
  function _corImgPronta(reg) { return !!(reg && reg.ok && reg.img && reg.w && reg.h); }

  /* ── Beira do caminho ── */
  function _corBeiraSortear(chao) {
    var c = [], i, n;
    for (i = 0; i < _COR_DECO_NOMES.length; i++) {
      n = _COR_DECO_NOMES[i];
      if (chao && !_COR_DECO[n].meio) continue;
      if (_COR_DECO[n].zona && _COR_DECO[n].zona !== COR_ZONAS[_corZonaIdx].id) continue;
      if (_corImgPronta(_corAssetNovo('deco-' + n + '.webp'))) c.push({ tipo: n, deco: true });
    }
    if (!chao) {
      var z = COR_ZONAS[_corZonaIdx].beira || [];
      for (i = 0; i < z.length; i++) {
        var a = _corObstAsset(z[i]);
        if (a && a.ok && a.w) c.push({ tipo: z[i], deco: false });
      }
    }
    return c.length ? c[(Math.random() * c.length) | 0] : null;
  }
  function _corBeiraAtualizar(dt) {
    var i, b;
    _corBeiraT -= dt;
    if (_corBeiraT <= 0) {
      _corBeiraT = _corRand(0.22, 0.45) * (_corOpc.leve ? 1.7 : 1);
      var esc = _corBeiraSortear(false);
      if (esc) {
        var lado = Math.random() < 0.5 ? -1 : 1;
        _corBeira.push({ z: _COR_Z_FAR, faixa: _corCamX + lado * _corRand(1.35, 3.2), tipo: esc.tipo, deco: esc.deco,
                         esc: _corRand(0.8, 1.25), flip: Math.random() < 0.5 });
      }
    }
    _corChaoT -= dt;
    if (_corChaoT <= 0) {
      _corChaoT = _corRand(0.11, 0.22) * (_corOpc.leve ? 2 : 1);
      var tf = _corBeiraSortear(true);
      if (tf) _corBeira.push({ z: _COR_Z_FAR, faixa: _corCamX + _corRand(-1.3, 1.3), tipo: tf.tipo, deco: true,
                               esc: _corRand(0.7, 1.2), flip: Math.random() < 0.5 });
    }
    for (i = _corBeira.length - 1; i >= 0; i--) {
      b = _corBeira[i];
      b.z -= _corVel * dt;
      if (b.z <= 0.01) _corBeira.splice(i, 1);
    }
  }
  function _corDrawBeira(ctx, b) {
    var reg = b.deco ? _corAssetNovo('deco-' + b.tipo + '.webp') : _corObstAsset(b.tipo);
    if (!reg || !reg.ok || !reg.w || !reg.h) return;
    var def = b.deco ? _COR_DECO[b.tipo] : _COR_OBST_TIPOS[b.tipo];
    var p = _corProj(b.z, b.faixa);
    var ah = 0.5 * _corH * p.s * 0.94 * def.altMul * b.esc, aw = ah * reg.w / reg.h;
    if (ah < 2.5 || p.x + aw / 2 < 0 || p.x - aw / 2 > _corW) return;
    var fonte = b.deco ? reg.img : (_corFonte(reg) || reg.img);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (b.flip) ctx.scale(-1, 1);
    ctx.drawImage(fonte, -aw / 2, -ah, aw, ah);
    ctx.restore();
  }

  /* ── Avisos (fila) ── */
  function _corAviso(txt, sub, cor, dur) {
    if (_corAvisos.length >= 4) _corAvisos.shift();
    _corAvisos.push({ txt: txt, sub: sub || '', cor: cor || '#fff', t: 0, dur: dur || 2.2 });
  }

  /* ── Caixa de arma e item da guardiã: nascem nas laterais, como a munição ── */
  function _corSpawnCaixa() {
    var lado = (Math.random() < 0.5 ? -1 : 1) * _corRand(0.35, 1.0);
    _corCaixas.push({ z: _COR_Z_FAR, faixa: _corCamX + lado, bob: Math.random() * 6.283,
                      arma: _COR_ARMAS_LISTA[(Math.random() * _COR_ARMAS_LISTA.length) | 0] });
  }
  function _corSpawnGuardItem() {
    var lado = (Math.random() < 0.5 ? -1 : 1) * _corRand(0.4, 1.1);
    _corGuardItens.push({ z: _COR_Z_FAR, faixa: _corCamX + lado, bob: Math.random() * 6.283 });
  }
  function _corPegarArma(tipo) {
    var def = _COR_ARMAS[tipo];
    if (_corArma === tipo) _corArmaMun += def.mun;
    else { _corArma = tipo; _corArmaMun = def.mun; }
    _corAssetNovo(def.arte);
    _corRun.caixas++;
    _corSfx('caixa', 0.7);
    _corSomRecarga();
    _corVibrar(30);
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.bonus();
    _corAviso(def.nome + '!', def.sub, def.cor, 2.2);
    _corAtualizarHUD();
  }
  function _corPegarGuardia() {
    _corGuardT = _corGuardDur(); _corGuardCdT = 0.5;
    _corGuard.x = _corW * 0.5; _corGuard.y = -_corH * 0.2; _corGuard.alvo = null; _corGuard.atk = 0;
    _corRun.guardia++;
    _corVibrar([30, 40, 30]);
    _corSfx('guardia', 0.8, 0, 0.04);
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.nivelUp();
    _corAviso('Coruja guardiã!', 'Ela derruba os zumbis por ' + _corGuardDur() + ' segundos', '#ffd24a', 2.2);
  }

  // Move e coleta os itens novos (caixa de arma, guardiã). Mesma regra da
  // munição: chegou em z≈0 perto da sua linha, pegou.
  function _corItensV6(dt) {
    var i, it;
    _corCaixaT -= dt;
    if (_corCaixaT <= 0) {
      if (_corDist > 120 && !_corArma && !_corCaixas.length) { _corSpawnCaixa(); _corCaixaT = _corRand(24, 36) * (1 - 0.15 * _corMelh.sorte); }
      else _corCaixaT = 4;
    }
    for (i = _corCaixas.length - 1; i >= 0; i--) {
      it = _corCaixas[i];
      it.z -= _corVel * dt; it.bob += dt * 4;
      if (it.z <= 0.07) {
        if (Math.abs(it.faixa - _corCamX) < 0.34) _corPegarArma(it.arma);
        _corCaixas.splice(i, 1);
      }
    }
    _corGuardItemT -= dt;
    if (_corGuardItemT <= 0) {
      if (_corDist > 250 && _corGuardT <= 0 && !_corGuardItens.length) { _corSpawnGuardItem(); _corGuardItemT = _corRand(45, 70); }
      else _corGuardItemT = 5;
    }
    for (i = _corGuardItens.length - 1; i >= 0; i--) {
      it = _corGuardItens[i];
      it.z -= _corVel * dt; it.bob += dt * 3;
      if (it.z <= 0.07) {
        if (Math.abs(it.faixa - _corCamX) < 0.34) _corPegarGuardia();
        _corGuardItens.splice(i, 1);
      }
    }
    // Metralhadora: dispara sozinha enquanto houver zumbi na mira.
    if (_corArma && _COR_ARMAS[_corArma].auto) _corAtirar(true);
    else if (_corOpc.auto) _corAutoTiro(dt);
  }

  /* ── Coruja guardiã ── */
  function _corGuardEscolher() {
    var melhor = null, melhorNota = 1e9;
    for (var i = 0; i < _corZumbis.length; i++) {
      var zb = _corZumbis[i];
      if (zb.morto || zb.z > 0.8) continue;
      var d = Math.abs(zb.faixa - _corCamX);
      if (d > 1.1) continue;
      var nota = zb.z + (d < _corMeiaColisao(zb.tipo) ? -0.5 : 0);   // quem está na sua linha primeiro
      if (nota < melhorNota) { melhorNota = nota; melhor = zb; }
    }
    return melhor;
  }
  function _corGuardAtualizar(dt) {
    if (_corGuardT <= 0) return;
    var g = _corGuard, W = _corW, H = _corH;
    _corGuardT -= dt; g.voo += dt;
    if (g.alvo && (g.alvo.morto || _corZumbis.indexOf(g.alvo) < 0)) { g.alvo = null; g.atk = 0; }
    if (!g.alvo && _corGuardT > 0.4) {
      _corGuardCdT -= dt;
      if (_corGuardCdT <= 0) {
        g.alvo = _corGuardEscolher();
        if (g.alvo) g.atk = 0.001; else _corGuardCdT = 0.2;
      }
    }
    var tx = W * 0.5 + Math.sin(g.voo * 1.3) * W * 0.12, ty = H * 0.22 + Math.sin(g.voo * 2.1) * H * 0.03;
    if (g.alvo) {
      var p = _corProj(g.alvo.z, g.alvo.faixa), hpx = 0.5 * H * p.s * 0.94;
      tx = p.x; ty = p.y - hpx * _COR_ALT_MUL * 0.7;
      g.atk += dt;
    }
    var k = Math.min(1, dt * (g.alvo ? 9 : 4));
    g.x += (tx - g.x) * k; g.y += (ty - g.y) * k;
    if (g.alvo && ((Math.abs(g.x - tx) < W * 0.03 && Math.abs(g.y - ty) < H * 0.05) || g.atk > 0.6)) {
      _corDano(g.alvo, 99, 'guardia');
      var ac = _corAudio();
      if (ac && _corSomLigado()) _corTom(ac, ac.currentTime, 'triangle', 900, 1500, 0.12, 0.16);
      g.alvo = null; g.atk = 0; _corGuardCdT = _COR_GUARD_CD;
    }
    if (_corGuardT <= 0) { _corGuardT = 0; g.alvo = null; _corAviso('A guardiã foi embora', '', '#c7d1e0', 1.4); }
  }

  /* ── Perigo: batimento + borda vermelha ── */
  function _corSomCoracao(v) {
    if (_corSfx('coracao', 0.35 + 0.55 * v, 0, 0.02)) return;
    var ac = _corAudio();
    if (!ac || !_corSomLigado()) return;
    var t = ac.currentTime;
    _corTom(ac, t, 'sine', 68, 42, 0.12, 0.34 * v);
    _corTom(ac, t + 0.17, 'sine', 60, 38, 0.10, 0.24 * v);
  }
  function _corPerigoAtualizar(dt) {
    var alvo = 0;
    for (var i = 0; i < _corZumbis.length; i++) {
      var zb = _corZumbis[i];
      if (zb.morto || zb.z >= 0.45) continue;
      if (Math.abs(zb.faixa - _corCamX) < _corMeiaColisao(zb.tipo)) alvo = Math.max(alvo, 1 - zb.z / 0.45);
    }
    _corPerigo += (alvo - _corPerigo) * Math.min(1, dt * 6);
    if (_corCoracaoPulso > 0) _corCoracaoPulso = Math.max(0, _corCoracaoPulso - dt * 2.2);
    if (_corPerigo > 0.08) {
      _corCoracaoT -= dt;
      if (_corCoracaoT <= 0) {
        _corCoracaoT = 0.95 - 0.5 * _corPerigo;
        _corCoracaoPulso = 1;
        _corSomCoracao(0.4 + 0.6 * _corPerigo);
      }
    } else _corCoracaoT = 0;
  }

  /* ── Zonas ── */
  function _corZonaAtualizar(dt) {
    var nova = _corZonaIdx;
    while (nova + 1 < COR_ZONAS.length && _corDist >= COR_ZONAS[nova + 1].ini) nova++;
    // Pede a arte da próxima zona ~150 m antes de chegar nela.
    if (nova + 1 < COR_ZONAS.length && _corDist > COR_ZONAS[nova + 1].ini - 150) _corAssetNovo(COR_ZONAS[nova + 1].cen);
    if (nova !== _corZonaIdx) {
      _corZonaAnt = _corZonaIdx; _corZonaIdx = nova; _corZonaFade = 0;
      _corAssetNovo(COR_ZONAS[nova].cen);
      _corDecoPedir(COR_ZONAS[nova].id);
      var lo = COR_ZONAS[nova].obst.concat(COR_ZONAS[nova].beira || []);
      for (var i = 0; i < lo.length; i++) _corObstAsset(lo[i]);
      _corAviso('Zona ' + (nova + 1), COR_ZONAS[nova].nome, '#ffd24a', 2.6);
    }
    if (_corZonaFade < 1) _corZonaFade = Math.min(1, _corZonaFade + dt / 2.5);
  }

  /* ══════════════════════════════════════════════════════════════
     MISSÕES — 3 ativas por vez, salvas neste aparelho (e no pacote por
     conta do hub). Tipos "Run" valem dentro de uma corrida; "Tot" somam
     entre corridas (prog guardado). Cumpriu: paga na hora (moedasAdd) e
     avisa; no fim da corrida as cumpridas dão lugar a novas.
  ══════════════════════════════════════════════════════════════ */
  var COR_MISSOES_KEY = 'angatuba_corrida_missoes';
  var COR_MISSOES = [
    { id: 'dist300',   txt: 'Corra 300 m numa corrida',          tipo: 'distRun',     meta: 300,  premio: 20 },
    { id: 'dist600',   txt: 'Corra 600 m numa corrida',          tipo: 'distRun',     meta: 600,  premio: 35 },
    { id: 'dist1000',  txt: 'Corra 1.000 m numa corrida',        tipo: 'distRun',     meta: 1000, premio: 60 },
    { id: 'tot2000',   txt: 'Corra 2.000 m no total',            tipo: 'distTot',     meta: 2000, premio: 30 },
    { id: 'tot5000',   txt: 'Corra 5.000 m no total',            tipo: 'distTot',     meta: 5000, premio: 60 },
    { id: 'abate15',   txt: 'Abata 15 zumbis numa corrida',      tipo: 'abatesRun',   meta: 15,   premio: 25 },
    { id: 'abate40',   txt: 'Abata 40 zumbis no total',          tipo: 'abatesTot',   meta: 40,   premio: 25 },
    { id: 'rapido8',   txt: 'Abata 8 corujas rápidas',           tipo: 'rapidoTot',   meta: 8,    premio: 25 },
    { id: 'forte3',    txt: 'Abata 3 corujas fortes',            tipo: 'forteTot',    meta: 3,    premio: 25 },
    { id: 'moeda30',   txt: 'Pegue 30 moedas numa corrida',      tipo: 'moedasRun',   meta: 30,   premio: 25 },
    { id: 'semtiro',   txt: 'Corra 200 m sem atirar',            tipo: 'semTiro',     meta: 200,  premio: 25 },
    { id: 'semesb',    txt: 'Corra 400 m sem esbarrar',          tipo: 'semEsb',      meta: 400,  premio: 30 },
    { id: 'caixa2',    txt: 'Pegue 2 caixas de arma',            tipo: 'caixasTot',   meta: 2,    premio: 20 },
    { id: 'escop5',    txt: 'Abata 5 com a escopeta',            tipo: 'escopetaTot', meta: 5,    premio: 25 },
    { id: 'guardia1',  txt: 'Chame a coruja guardiã',            tipo: 'guardiaTot',  meta: 1,    premio: 20 },
    { id: 'zona2',     txt: 'Chegue ao Sítio Abandonado',        tipo: 'zonaRun',     meta: 1,    premio: 20 },
    { id: 'zona3',     txt: 'Chegue à Entrada da Cidade',        tipo: 'zonaRun',     meta: 2,    premio: 45 },
    { id: 'zona4',     txt: 'Chegue ao Centro de Angatuba',      tipo: 'zonaRun',     meta: 3,    premio: 80 }
  ];
  var _corMissoes = null;   // { ativas: [{ id, prog, feita }] }
  var _corMisT = 0;

  function _corMissaoDef(id) {
    for (var i = 0; i < COR_MISSOES.length; i++) if (COR_MISSOES[i].id === id) return COR_MISSOES[i];
    return null;
  }
  function _corMissoesSalvar() {
    try { localStorage.setItem(COR_MISSOES_KEY, JSON.stringify(_corMissoes)); } catch (e) {}
  }
  function _corMissaoSortear(usados) {
    var c = [];
    for (var i = 0; i < COR_MISSOES.length; i++) if (!usados[COR_MISSOES[i].id]) c.push(COR_MISSOES[i].id);
    return c.length ? c[(Math.random() * c.length) | 0] : null;
  }
  // Lê do aparelho, descarta ids que não existem mais e completa até 3.
  function _corMissoesCarregar() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(COR_MISSOES_KEY) || 'null'); } catch (e) {}
    var ativas = [], usados = {};
    if (d && d.ativas && d.ativas.length) {
      for (var i = 0; i < d.ativas.length && ativas.length < 3; i++) {
        var m = d.ativas[i];
        if (!m || !_corMissaoDef(m.id) || m.feita || usados[m.id]) continue;
        usados[m.id] = true;
        ativas.push({ id: m.id, prog: Math.max(0, Number(m.prog) || 0) });
      }
    }
    while (ativas.length < 3) {
      var id = _corMissaoSortear(usados);
      if (!id) break;
      usados[id] = true; ativas.push({ id: id, prog: 0 });
    }
    _corMissoes = { ativas: ativas };
    _corMissoesSalvar();
  }
  function _corMissaoValor(m, def) {
    var r = _corRun, d = _corDist;
    switch (def.tipo) {
      case 'distRun':     return d;
      case 'distTot':     return m.prog + d;
      case 'abatesRun':   return r.abates;
      case 'abatesTot':   return m.prog + r.abates;
      case 'rapidoTot':   return m.prog + r.rapido;
      case 'forteTot':    return m.prog + r.forte;
      case 'escopetaTot': return m.prog + r.escopeta;
      case 'moedasRun':   return _corMoedasRun;
      case 'semTiro':     return r.distPrimeiroTiro < 0 ? d : r.distPrimeiroTiro;
      case 'semEsb':      return r.distPrimeiroEsb < 0 ? d : r.distPrimeiroEsb;
      case 'caixasTot':   return m.prog + r.caixas;
      case 'guardiaTot':  return m.prog + r.guardia;
      case 'zonaRun':     return _corZonaIdx;
    }
    return 0;
  }
  function _corMissaoTot(def) { return /Tot$/.test(def.tipo); }

  function _corMissoesChecar() {
    if (!_corMissoes) return;
    var mudou = false;
    for (var i = 0; i < _corMissoes.ativas.length; i++) {
      var m = _corMissoes.ativas[i];
      if (m.feita) continue;
      var def = _corMissaoDef(m.id);
      if (!def || _corMissaoValor(m, def) < def.meta) continue;
      m.feita = true; mudou = true;
      _corRun.missoesFeitas.push(m.id);
      var G = window.AngatubaGames;
      if (G && typeof G.moedasAdd === 'function') G.moedasAdd(def.premio, 'corrida');
      if (G && G.som) G.som.nivelUp();
      _corAviso('Missão cumprida!', def.txt + '  +' + def.premio + ' 🪙', '#7CF0A0', 2.6);
    }
    if (mudou) _corMissoesSalvar();
  }

  // Fim da corrida (ou saída no meio): guarda o progresso dos tipos "Tot",
  // troca as cumpridas por novas e devolve o resumo pra tela de fim.
  function _corMissoesFechar() {
    if (!_corMissoes) return [];
    var resumo = [], ficam = [], usados = {}, i, m, def;
    for (i = 0; i < _corMissoes.ativas.length; i++) {
      m = _corMissoes.ativas[i]; def = _corMissaoDef(m.id);
      if (!def) continue;
      usados[m.id] = true;
      var val = _corMissaoValor(m, def);
      if (!m.feita && _corMissaoTot(def)) m.prog = Math.min(def.meta, val);
      resumo.push({ txt: def.txt, premio: def.premio, feita: !!m.feita, prog: Math.min(def.meta, Math.floor(val)), meta: def.meta, tot: _corMissaoTot(def) });
      if (!m.feita) ficam.push({ id: m.id, prog: m.prog || 0 });
    }
    while (ficam.length < 3) {
      var id = _corMissaoSortear(usados);
      if (!id) break;
      usados[id] = true; ficam.push({ id: id, prog: 0 });
    }
    _corMissoes = { ativas: ficam };
    _corMissoesSalvar();
    return resumo;
  }

  function _corNumBr(n) { n = Math.floor(n); return n >= 1000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(n); }

  // Lista no overlay (início: as ativas com progresso; fim: o resumo da corrida).
  function _corMissoesRender(elId, itens) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (!itens || !itens.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    var h = '<div class="cor-missoes-tit">Missões</div>';
    for (var i = 0; i < itens.length; i++) {
      var it = itens[i];
      var prog = it.feita ? '' : (it.tot ? _corNumBr(it.prog) + '/' + _corNumBr(it.meta) : '');
      h += '<div class="cor-missao' + (it.feita ? ' cor-missao-feita' : '') + '">' +
             '<span class="cor-missao-ic">' + (it.feita ? '✓' : '•') + '</span>' +
             '<span class="cor-missao-txt">' + it.txt + '</span>' +
             (prog ? '<span class="cor-missao-prog">' + prog + '</span>' : '') +
             '<span class="cor-missao-premio">+' + it.premio + ' 🪙</span>' +
           '</div>';
    }
    el.innerHTML = h;
    el.style.display = '';
  }
  function _corMissoesItensAtivas() {
    var out = [];
    if (!_corMissoes) return out;
    for (var i = 0; i < _corMissoes.ativas.length; i++) {
      var m = _corMissoes.ativas[i], def = _corMissaoDef(m.id);
      if (!def) continue;
      out.push({ txt: def.txt, premio: def.premio, feita: false, prog: m.prog || 0, meta: def.meta, tot: _corMissaoTot(def) });
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════
     AGARRÃO — morte por zumbi: a cena congela, escurece e a coruja-zumbi
     pula na tela por _COR_AGARRAO_DUR antes do game over. Arte própria
     (sheet 3×3 do bote); sem ela, a própria coruja-zumbi que te pegou
     cresce até tomar a tela, com garras vermelhas no fim.
  ══════════════════════════════════════════════════════════════ */
  function _corAgarrar(zb) {
    _corEstado = 'agarrao'; _corAgarraoT = 0; _corAgarraoZb = zb;
    _corLadosSoltar();
    _corVibrar([90, 50, 220]);
    _corMenuPartida(false);
    _corDrag = false; _corCamVX = 0;
    _corBgmParar();
    _corChuvaSomParar();
    if (!_corSfx('agarrao', 1, 0, 0.03)) {
      _corSomRosnado();
      var ac = _corAudio();
      if (ac && _corSomLigado()) _corTom(ac, ac.currentTime + 0.05, 'sawtooth', 180, 55, 0.4, 0.22);
    }
  }
  function _corDrawAgarrao() {
    var ctx = _corCtx;
    if (!ctx) return;
    var W = _corW, H = _corH, t = _corAgarraoT, k = Math.min(1, t / _COR_AGARRAO_DUR);
    _corDraw();
    var amp = 1 - k * 0.5;
    var sx = Math.sin(t * 70) * W * 0.012 * amp, sy = Math.cos(t * 55) * H * 0.015 * amp;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.25 + 0.45 * k).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    var ease = 1 - Math.pow(1 - Math.min(1, t / 0.45), 3);   // bote rápido, depois segura
    var reg = _corAssetNovo(_COR_AGARRAO_SHEET);
    if (_corImgPronta(reg)) {
      var fw = reg.w / 3, fh = reg.h / 3;
      var f = Math.min(8, Math.floor(t / (_COR_AGARRAO_DUR / 9)));
      var hh = H * (0.6 + 0.8 * ease), ww = hh * fw / fh;
      ctx.drawImage(reg.img, (f % 3) * fw, Math.floor(f / 3) * fh, fw, fh, W / 2 - ww / 2 + sx, H * 0.55 - hh / 2 + sy, ww, hh);
    } else {
      var zb = _corAgarraoZb;
      var sk = zb ? (zb.sheetKey || zb.tipo) : 'normal';
      var ah = H * (0.5 + 1.15 * ease), aw = ah * _corSheetRatio(sk);
      ctx.save();
      ctx.translate(W / 2 + sx, H * (1.0 + 0.45 * ease) + sy);
      ctx.rotate(Math.sin(t * 9) * 0.06);
      var ok = _corDrawSheetFrame(ctx, sk, _corRelogio * 2, -aw / 2, -ah, aw, ah);
      ctx.restore();
      if (!ok) _corVetorZumbi(ctx, W / 2 + sx, H * (1.0 + 0.45 * ease) + sy, ah * 0.47, ah / _COR_ALT_MUL, _COR_TIPOS[(zb && zb.tipo) || 'normal'], 0, t * 8);
    }
    if (t < 0.25) {
      ctx.fillStyle = 'rgba(255,0,0,' + (0.45 * (1 - t / 0.25)).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (t > 0.42) {
      var g = Math.min(1, (t - 0.42) / 0.22);
      ctx.save();
      ctx.strokeStyle = 'rgba(150,0,0,0.85)'; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(4, H * 0.028);
      for (var i = 0; i < 3; i++) {
        var x0 = W * (0.30 + i * 0.13), y0 = H * 0.12, x1 = W * (0.42 + i * 0.13), y1 = H * 0.88;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * g, y0 + (y1 - y0) * g); ctx.stroke();
      }
      ctx.restore();
    }
    var gV = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.3, W * 0.5, H * 0.5, H * 0.95);
    gV.addColorStop(0, 'rgba(120,0,0,0)'); gV.addColorStop(1, 'rgba(120,0,0,' + (0.35 + 0.4 * k).toFixed(3) + ')');
    ctx.fillStyle = gV; ctx.fillRect(0, 0, W, H);
  }

  /* ══════════════════════════════════════════════════════════════
     DESENHO dos itens novos, da guardiã, do perigo e dos avisos
  ══════════════════════════════════════════════════════════════ */
  function _corRotulo(ctx, txt, x, y, px, cor) {
    ctx.font = '800 ' + Math.round(px) + 'px Syne, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = Math.max(2, px * 0.22); ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = cor; ctx.fillText(txt, x, y);
  }
  function _corDrawCaixa(ctx, cx) {
    var p = _corProj(cx.z, cx.faixa), s = p.s, hpxC = 0.5 * _corH * p.s * 0.94;
    var bob = Math.sin(cx.bob) * hpxC * 0.03, sz = hpxC * 0.27;   // escala do mundo (antes: px fixos, minúsculo)
    var def = _COR_ARMAS[cx.arma];
    ctx.globalAlpha = 0.3 * (0.4 + s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 1.0, sz * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var reg = _corAssetNovo(_COR_CAIXA_ARMA), topo;
    if (_corImgPronta(reg)) {
      var ah = sz * 2.8, aw = ah * reg.w / reg.h;
      ctx.drawImage(reg.img, p.x - aw / 2, p.y - ah + bob, aw, ah);
      topo = p.y - ah + bob;
    } else {
      var bw = sz * 2.2, bh = sz * 1.5, bx = p.x - bw / 2, by = p.y - bh + bob;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(cx.bob));
      ctx.strokeStyle = def.cor; ctx.lineWidth = Math.max(2, sz * 0.12);
      ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = def.cor; ctx.fillRect(bx, by + bh * 0.38, bw, bh * 0.24);
      ctx.fillStyle = '#1a1d22'; ctx.fillRect(bx + bw * 0.42, by + bh * 0.3, bw * 0.16, bh * 0.4);
      ctx.restore();
      topo = by;
    }
    if (cx.z < 0.75) _corRotulo(ctx, def.nome.toUpperCase(), p.x, topo - sz * 0.25, Math.max(11, sz * 0.55), def.cor);
  }
  function _corDrawGuardItem(ctx, it) {
    var p = _corProj(it.z, it.faixa), s = p.s, hpxG = 0.5 * _corH * p.s * 0.94;
    var bob = Math.sin(it.bob) * hpxG * 0.03, sz = hpxG * 0.22;
    var cy = p.y - sz * 1.7 + bob;
    var pul = 0.75 + 0.25 * Math.sin(it.bob * 2);
    var gr = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, sz * 1.9);
    gr.addColorStop(0, 'rgba(255,215,90,' + (0.55 * pul).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, cy, sz * 1.9, 0, Math.PI * 2); ctx.fill();
    var reg = _corAssetNovo(_COR_GUARD_ITEM);
    if (_corImgPronta(reg)) {
      var ih = sz * 2.4, iw = ih * reg.w / reg.h;
      ctx.drawImage(reg.img, p.x - iw / 2, cy - ih / 2, iw, ih);
    } else if (_corGuardImg && _corGuardImg.complete && _corGuardImg.naturalWidth) {
      var gw = sz * 2.8, gh = gw * _corGuardImg.naturalHeight / _corGuardImg.naturalWidth;
      ctx.drawImage(_corGuardImg, p.x - gw / 2, cy - gh / 2, gw, gh);
    } else {
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(p.x, cy, sz * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    if (it.z < 0.75) _corRotulo(ctx, 'GUARDIÃ', p.x, cy - sz * 1.5, Math.max(11, sz * 0.55), '#ffd24a');
  }
  function _corDrawGuardia(ctx, W, H) {
    if (_corGuardT <= 0) return;
    var g = _corGuard, tam = H * 0.2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, _corGuardT / 0.6);
    var gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, tam * 0.85);
    gr.addColorStop(0, 'rgba(255,215,90,0.45)'); gr.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(g.x, g.y, tam * 0.85, 0, Math.PI * 2); ctx.fill();
    var reg = _corAssetNovo(_COR_GUARD_SHEET);
    if (_corImgPronta(reg)) {
      var fw = reg.w / 3, fh = reg.h / 3;
      var f = g.alvo ? 6 + (Math.floor(g.atk * 10) % 3) : (Math.floor(g.voo * 12) % 6);
      var ww = tam * fw / fh;
      ctx.drawImage(reg.img, (f % 3) * fw, Math.floor(f / 3) * fh, fw, fh, g.x - ww / 2, g.y - tam / 2, ww, tam);
    } else if (_corGuardImg && _corGuardImg.complete && _corGuardImg.naturalWidth) {
      var iw = tam * 1.3, ih = iw * _corGuardImg.naturalHeight / _corGuardImg.naturalWidth;
      ctx.translate(g.x, g.y);
      if (g.alvo) ctx.rotate(0.35);
      ctx.drawImage(_corGuardImg, -iw / 2, -ih / 2, iw, ih);
    }
    ctx.restore();
  }
  function _corDrawPerigo(ctx, W, H) {
    if (_corPerigo < 0.03) return;
    var a = Math.min(0.9, _corPerigo * (0.4 + 0.55 * _corCoracaoPulso));
    var g = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.35, W * 0.5, H * 0.5, H * 0.95);
    g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, 'rgba(200,0,0,' + a.toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // Avisos (fila) + barrinha do tempo da guardiã, por cima de tudo.
  function _corDrawAvisos(ctx, W, H) {
    if (_corGuardT > 0) {
      var bx = W * 0.03, by = H * 0.06, bw = W * 0.16, bh = Math.max(5, H * 0.016);
      ctx.font = '800 ' + Math.round(H * 0.04) + 'px Syne, sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd24a'; ctx.fillText('Guardiã', bx, by - bh);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx, by, bw * Math.min(1, _corGuardT / _corGuardDur()), bh);
    }
    if (!_corAvisos.length) return;
    var av = _corAvisos[0];
    var a = Math.max(0, Math.min(1, av.t / 0.2, (av.dur - av.t) / 0.35));
    var y = H * 0.2;
    ctx.save();
    ctx.globalAlpha = a;
    var f1 = Math.round(H * 0.065), f2 = Math.round(H * 0.036);
    ctx.font = '800 ' + f1 + 'px Syne, sans-serif';
    var w1 = ctx.measureText(av.txt).width;
    ctx.font = '600 ' + f2 + 'px sans-serif';
    var w2 = av.sub ? ctx.measureText(av.sub).width : 0;
    var pw = Math.max(w1, w2) + H * 0.08, ph = f1 + (av.sub ? f2 * 1.5 : 0) + H * 0.04;
    ctx.fillStyle = 'rgba(8,10,12,0.62)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(W / 2 - pw / 2, y - f1, pw, ph, H * 0.025); ctx.fill(); }
    else ctx.fillRect(W / 2 - pw / 2, y - f1, pw, ph);
    ctx.textAlign = 'center';
    ctx.font = '800 ' + f1 + 'px Syne, sans-serif'; ctx.fillStyle = av.cor;
    ctx.fillText(av.txt, W / 2, y + f1 * 0.15);
    if (av.sub) { ctx.font = '600 ' + f2 + 'px sans-serif'; ctx.fillStyle = '#e8edf5'; ctx.fillText(av.sub, W / 2, y + f1 * 0.15 + f2 * 1.35); }
    ctx.restore();
  }
  function _corAvisosAtualizar(dt) {
    if (!_corAvisos.length) return;
    _corAvisos[0].t += dt;
    if (_corAvisos[0].t >= _corAvisos[0].dur) _corAvisos.shift();
  }

  /* ══════════════════════════════════════════════════════════════
     v6.2 — chão correndo, inclinação, zumbis com comportamentos,
     clima, som de respiração/gemido e melhorias.
  ══════════════════════════════════════════════════════════════ */

  /* ── CHÃO CORRENDO ──────────────────────────────────────────────
     O chão do cenário é pintado na imagem de fundo, então ficava parado.
     Com a textura da zona (chao-<zona>.webp, vista de cima, sem emenda),
     o chão perto da câmera é redesenhado linha a linha em perspectiva —
     mesma projeção de _corProj — e rola junto com o mundo (_corChaoRolo
     anda na mesma velocidade dos itens). Perto do horizonte ele some aos
     poucos e fica o chão da imagem. Sem a textura, não desenha nada. */
  var _corChaoRolo = 0;
  var _COR_CHAO_U = 520, _COR_CHAO_V = 2600;   // px de textura por faixa / por z (≈ mesma escala em metros)
  var _corChaoPat = {};                        // nome -> CanvasPattern
  function _corChaoTex(zi) {
    var z = COR_ZONAS[zi] || COR_ZONAS[0];
    var reg = _corAssetNovo('chao-' + z.id + '.webp');
    return _corImgPronta(reg) ? reg : null;
  }
  // Desempenho: a textura é desenhada num canvas à parte com BEM menos
  // pixels (o chão em perspectiva já é borrado de natureza) e colada de uma
  // vez no quadro — era a camada mais cara do jogo, linha a linha na
  // resolução cheia.
  var _corChaoCv = null, _corChaoCx = null, _corChaoM = null;
  function _corDrawChao(ctx, W, H) {
    if (typeof DOMMatrix === 'undefined') return;
    var a = _corChaoTex(_corZonaIdx), b = (_corZonaFade < 1 && _corZonaAnt >= 0) ? _corChaoTex(_corZonaAnt) : null;
    if (!a && !b) return;
    var horizonY = H * _COR_HORIZ + _corBobY * H + _corShakeY() * H;
    var faixaH = H * 1.06 + _corBobY * H + _corShakeY() * H - horizonY;
    var topo = Math.max(0, Math.floor(horizonY + faixaH * 0.05));
    if (topo >= H) return;
    var k = _corOpc.leve ? 0.4 : 0.6;
    var cw = Math.ceil(W * k), ch = Math.ceil((H - topo) * k) + 1;
    if (!_corChaoCv) {
      try { _corChaoCv = document.createElement('canvas'); _corChaoCx = _corChaoCv.getContext('2d'); } catch (e) { _corChaoCx = null; }
      if (!_corChaoCx) { _corChaoCv = null; return; }
    }
    if (_corChaoCv.width !== cw || _corChaoCv.height < ch) { _corChaoCv.width = cw; _corChaoCv.height = ch; }
    var c2 = _corChaoCx;
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, cw, ch);
    c2.setTransform(k, 0, 0, k, 0, -topo * k);
    if (b) _corDrawChaoTex(c2, W, H, b, 1, 1.25 / k);
    if (a) _corDrawChaoTex(c2, W, H, a, b ? _corZonaFade : 1, 1.25 / k);
    ctx.drawImage(_corChaoCv, 0, 0, cw, ch, 0, topo, cw / k, ch / k);
  }
  function _corDrawChaoTex(ctx, W, H, reg, alfaZona, passo) {
    var nome = reg.nomeOk || 'x';
    var pat = _corChaoPat[nome];
    if (!pat) { try { pat = ctx.createPattern(reg.img, 'repeat'); } catch (e) { pat = null; } _corChaoPat[nome] = pat || false; }
    if (!pat || !pat.setTransform) return;
    if (!_corChaoM) _corChaoM = new DOMMatrix();
    var m = _corChaoM;
    var horizonY = H * _COR_HORIZ + _corBobY * H + _corShakeY() * H;
    var baseY = H * 1.06 + _corBobY * H + _corShakeY() * H;
    var faixaH = baseY - horizonY;
    var lateral = (_corSwayX + _corShakeX()) * W;
    ctx.save();
    ctx.fillStyle = pat;
    for (var y = Math.ceil(horizonY + faixaH * 0.05); y < H; y += passo) {
      var tt = (y - horizonY) / faixaH;
      var al = Math.min(1, (tt - 0.05) / 0.28);
      if (al <= 0) continue;
      var tt2 = (y + passo - horizonY) / faixaH;
      var e = 0.08 + 0.92 * tt;
      var v1 = (1 - Math.sqrt(tt) + _corChaoRolo) * _COR_CHAO_V;
      var v2 = (1 - Math.sqrt(Math.min(1.2, tt2)) + _corChaoRolo) * _COR_CHAO_V;
      var dv = v2 - v1; if (Math.abs(dv) < 1e-3) continue;
      var sx = 0.42 * W * e / _COR_CHAO_U, sy = passo / dv;
      var tx = W / 2 - _corCamX * 0.42 * W * e + lateral * e;
      m.a = sx; m.b = 0; m.c = 0; m.d = sy; m.e = tx; m.f = y - v1 * sy;
      pat.setTransform(m);
      ctx.globalAlpha = al * 0.96 * alfaZona;
      ctx.fillRect(0, y, W, passo + 0.6);
    }
    ctx.restore();
  }

  /* ── INCLINAÇÃO (como no Into the Dead) ─────────────────────────
     Opcional, liga na tela inicial. Usa a gravidade (accelerationIncludingGravity)
     projetada no eixo horizontal DA TELA: girar o celular como um volante
     desvia. O sinal muda entre aparelhos/sistemas, então ao ligar a
     pessoa gira pra direita uma vez e o jogo aprende o lado (sinal salvo).
     No iOS a permissão é pedida no toque do botão. Arrastar continua valendo. */
  var COR_TILT_KEY = 'angatuba_corrida_tilt';
  var _corTilt = (function () {
    var t = { on: false, sinal: 0, base: null, val: null, ouvindo: false, cal: null };
    try { var d = JSON.parse(localStorage.getItem(COR_TILT_KEY) || 'null'); if (d) { t.on = !!d.on; t.sinal = d.sinal === -1 ? -1 : (d.sinal === 1 ? 1 : 0); } } catch (e) {}
    if (!t.sinal) t.on = false;
    return t;
  })();
  function _corTiltSalvar() { try { localStorage.setItem(COR_TILT_KEY, JSON.stringify({ on: _corTilt.on, sinal: _corTilt.sinal })); } catch (e) {} }
  function _corTiltSuportado() { return typeof window.DeviceMotionEvent !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0); }
  function _corTiltEixo(g) {
    var ang = 0;
    try { ang = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0); } catch (e) {}
    ang = ((ang % 360) + 360) % 360;
    if (_corRotacionado()) return g.y;          // retrato com o jogo girado por CSS: o eixo do jogo é o y do aparelho
    if (ang === 90) return g.y;
    if (ang === 270) return -g.y;
    if (ang === 180) return -g.x;
    return g.x;
  }
  function _corTiltOuvir() {
    if (_corTilt.ouvindo) return;
    _corTilt.ouvindo = true;
    window.addEventListener('devicemotion', function (e) {
      var g = e.accelerationIncludingGravity;
      if (!g || g.x == null) return;
      var v = _corTiltEixo(g);
      _corTilt.val = (_corTilt.val == null) ? v : _corTilt.val + (v - _corTilt.val) * 0.35;   // suaviza
      var c = _corTilt.cal;
      if (c && !c.feito) {
        if (c.ini == null) c.ini = _corTilt.val;
        var d = _corTilt.val - c.ini;
        if (Math.abs(d) > 2.2) { c.feito = true; _corTilt.sinal = d > 0 ? 1 : -1; _corTilt.on = true; _corTiltSalvar(); _corTiltCalFim(true); }
      }
    });
  }
  function _corTiltAlternar() {
    if (_corTilt.on) { _corTilt.on = false; _corTiltSalvar(); _corTiltBotao(); return; }
    _corTiltLigar(false);
  }
  // Liga a inclinação. Se o lado do giro já foi aprendido, liga direto
  // (recal=true força girar de novo). No iOS a permissão sai deste toque.
  function _corTiltLigar(recal) {
    var pedir = window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === 'function';
    var seguir = function () {
      _corTiltOuvir();
      if (_corTilt.sinal && !recal) { _corTilt.on = true; _corTilt.base = null; _corOpc.lados = false; _corTiltSalvar(); _corOpcSalvar(); _corTiltBotao(); _corMenuRedesenhar(); }
      else _corTiltCalIniciar();
    };
    if (pedir) {
      window.DeviceMotionEvent.requestPermission().then(function (r) { if (r === 'granted') seguir(); else _corAvisoDom('Sem permissão do sensor: o jogo segue no arraste.'); }).catch(function () { _corAvisoDom('Não deu pra ligar o sensor.'); });
    } else seguir();
  }
  function _corTiltCalIniciar() {
    _corTilt.cal = { ini: null, feito: false };
    var el = document.getElementById('cor-tilt-cal');
    var palco = document.getElementById('cor-palco');
    if (!palco) return;
    if (!el) { el = document.createElement('div'); el.id = 'cor-tilt-cal'; el.className = 'cor-overlay cor-tilt-cal'; }
    // Chamada do menu de pausa (overlay fixo do hub): mora dentro dele, senão ficaria por baixo.
    var tela = document.getElementById('jogo-corrida');
    var jm = _corPausado && tela ? tela.querySelector('.jm-overlay.jm-aberto') : null;
    var pai = jm || palco;
    if (el.parentNode !== pai) pai.appendChild(el);
    el.innerHTML = '<div class="cor-overlay-titulo">📱 Inclinar pra desviar</div>' +
      '<div class="cor-overlay-desc">Segure o celular deitado e <b>gire pra DIREITA</b>, como um volante.</div>' +
      '<div class="cor-tilt-vol">⟳</div>' +
      '<button type="button" class="cor-extra-btn" onclick="_corTiltCalFim(false)">Cancelar</button>';
    el.style.display = '';
    clearTimeout(_corTilt.calTimer);
    _corTilt.calTimer = setTimeout(function () { if (_corTilt.cal && !_corTilt.cal.feito) _corTiltCalFim(false, 'Não senti o movimento. Tente de novo.'); }, 9000);
  }
  function _corTiltCalFim(ok, msg) {
    clearTimeout(_corTilt.calTimer);
    _corTilt.cal = null;
    var el = document.getElementById('cor-tilt-cal');
    if (el) el.style.display = 'none';
    if (ok) { _corTilt.base = null; _corOpc.lados = false; _corOpcSalvar(); }
    if (msg) _corAvisoDom(msg);
    else if (ok) _corAvisoDom('Pronto! Gire o celular pra desviar.');
    _corTiltBotao();
    _corMenuRedesenhar();
  }
  function _corTiltBotao() {
    var b = document.getElementById('cor-tilt-btn');
    if (!b) return;
    b.style.display = '';
    b.textContent = '🎮 Controle: ' + COR_CONTROLE_NOME[_corControle()];
    b.classList.toggle('cor-extra-on', _corControle() !== 'arrastar');
  }
  // Na partida: zera o "neutro" no começo e desvia pelo quanto girou.
  function _corTiltAplicar(dt) {
    if (!_corTilt.on || _corTilt.val == null) return;
    if (_corTilt.base == null) _corTilt.base = _corTilt.val;
    var d = (_corTilt.val - _corTilt.base) * _corTilt.sinal / 3.2 * COR_SENS[_corOpc.sens];
    if (Math.abs(d) < 0.1) return;
    d = _corClamp(d, -1, 1);
    _corCamX = _corClamp(_corCamX + d * COR_PAD_VEL * dt, -_COR_CAM_LIM, _COR_CAM_LIM);
  }
  // Mensagem curta sobre a tela (fora da partida, onde não há canvas de aviso).
  function _corAvisoDom(txt) {
    var palco = document.getElementById('cor-palco');
    if (!palco) return;
    var t = document.createElement('div'); t.className = 'cor-toast'; t.textContent = txt;
    palco.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }

  /* ── OPÇÕES (menu de pausa + botão "Controle" da tela inicial) ──────
     Controle: Arrastar (padrão: arrasta pra desviar, toca pra atirar) ·
     Toque nos lados (segura o terço esquerdo/direito pra andar, toca no
     meio pra atirar; dá pra segurar um lado e atirar com o outro dedo) ·
     Inclinar (sensor; arrastar continua valendo).
     E mais: tiro automático, sensibilidade, música, vibração e gráficos
     leves. Preferência do aparelho, não da conta. */
  var COR_OPC_KEY = 'angatuba_corrida_opcoes';
  var COR_SENS = [0.7, 1, 1.45], COR_SENS_NOME = ['baixa', 'média', 'alta'];
  var COR_CONTROLE_NOME = { arrastar: 'Arrastar', lados: 'Toque nos lados', inclinar: 'Inclinar' };
  var COR_CONTROLE_DICA = {
    arrastar: 'Arraste pra desviar, toque pra atirar.',
    lados: 'Segure a esquerda ou a direita pra desviar, toque no meio pra atirar.',
    inclinar: 'Gire o celular pra desviar, toque pra atirar.'
  };
  var _corOpc = (function () {
    var o = { lados: false, auto: false, sens: 1, musica: true, vibrar: true, leve: false, leveManual: false };
    try {
      var d = JSON.parse(localStorage.getItem(COR_OPC_KEY) || 'null');
      if (d && typeof d === 'object') {
        o.lados = !!d.lados; o.auto = !!d.auto; o.leve = !!d.leve; o.leveManual = !!d.leveManual;
        o.musica = d.musica !== false; o.vibrar = d.vibrar !== false;
        if (d.sens === 0 || d.sens === 2) o.sens = d.sens;
      }
    } catch (e) {}
    return o;
  })();
  function _corOpcSalvar() { try { localStorage.setItem(COR_OPC_KEY, JSON.stringify(_corOpc)); } catch (e) {} }
  function _corControle() { return _corTilt.on ? 'inclinar' : (_corOpc.lados ? 'lados' : 'arrastar'); }
  function _corControleCiclar() {
    var c = _corControle();
    _corLadosSoltar();
    if (c === 'arrastar') _corOpc.lados = true;
    else if (c === 'lados') {
      _corOpc.lados = false;
      if (_corTiltSuportado()) { _corOpcSalvar(); _corTiltLigar(false); _corTiltBotao(); return; }
    } else { _corTilt.on = false; _corTiltSalvar(); }
    _corOpcSalvar(); _corTiltBotao();
    if (!_corPausado) _corAvisoDom(COR_CONTROLE_DICA[_corControle()]);
  }
  function _corOpcTrocar(k) {
    if (k === 'sens') _corOpc.sens = (_corOpc.sens + 1) % 3;
    else _corOpc[k] = !_corOpc[k];
    if (k === 'leve') _corOpc.leveManual = true;
    _corOpcSalvar();
    if (k === 'leve') { _corDimensionar(); if (_corEstado !== 'jogando') _corDrawIdle(); }
    if (k === 'vibrar' && _corOpc.vibrar) _corVibrar(40);
  }
  // Aparelho sofrendo (média < ~40 fps nos primeiros segundos da corrida):
  // liga os gráficos leves sozinho, uma vez, e avisa. Quem escolheu no
  // menu (leveManual) manda — o automático não mexe mais.
  var _corFps = { n: 0, soma: 0, feito: false };
  function _corFpsMedir(dt) {
    var f = _corFps;
    if (f.feito || _corOpc.leve || _corOpc.leveManual || _corPausado) return;
    if (dt <= 0 || dt > 0.25) return;            // aba em segundo plano / volta da pausa
    f.n++; f.soma += dt;
    if (f.n < 150) return;
    var media = f.soma / f.n;
    f.n = 0; f.soma = 0;
    if (media > 0.025) {
      f.feito = true;
      _corOpc.leve = true; _corOpcSalvar(); _corDimensionar();
      _corAviso('Gráficos leves ligados', 'pra rodar mais liso · dá pra mudar no ⏸', '#7CF0A0', 2.6);
    }
  }
  function _corVibrar(p) {
    if (!_corOpc.vibrar) return;
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  }
  // O menu do hub só se redesenha num clique dele; a calibração termina
  // depois, então pedimos um redesenho (registrar de novo só re-renderiza).
  var _corMenuCfg = null;
  function _corMenuRedesenhar() {
    var M = _corMenu();
    if (M && _corMenuCfg && _corPausado) M.registrar('jogo-corrida', _corMenuCfg);
  }
  function _corOpcoesMenu() {
    var c = _corControle();
    var l = [{ icone: c === 'inclinar' ? 'fa-mobile-screen-button' : (c === 'lados' ? 'fa-arrows-left-right' : 'fa-hand-pointer'),
               rotulo: 'Controle: ' + COR_CONTROLE_NOME[c], acao: _corControleCiclar }];
    if (c === 'inclinar') l.push({ icone: 'fa-rotate', rotulo: 'Recalibrar giro', acao: function () { _corTiltLigar(true); } });
    l.push({ icone: 'fa-crosshairs', rotulo: 'Tiro automático: ' + (_corOpc.auto ? 'sim' : 'não'), ativo: _corOpc.auto, acao: function () { _corOpcTrocar('auto'); } });
    l.push({ icone: 'fa-sliders', rotulo: 'Sensibilidade ' + COR_SENS_NOME[_corOpc.sens], acao: function () { _corOpcTrocar('sens'); } });
    l.push({ icone: _corOpc.musica ? 'fa-music' : 'fa-volume-xmark', rotulo: 'Música: ' + (_corOpc.musica ? 'sim' : 'não'), ativo: _corOpc.musica, acao: function () { _corOpcTrocar('musica'); } });
    if (navigator.vibrate) l.push({ icone: 'fa-mobile', rotulo: 'Vibração: ' + (_corOpc.vibrar ? 'sim' : 'não'), ativo: _corOpc.vibrar, acao: function () { _corOpcTrocar('vibrar'); } });
    l.push({ icone: 'fa-bolt', rotulo: 'Gráficos leves: ' + (_corOpc.leve ? 'sim' : 'não'), ativo: _corOpc.leve, acao: function () { _corOpcTrocar('leve'); } });
    return l;
  }
  function _corRecomecar() {
    if (_corEstado === 'jogando') { _corCreditarMoedas(); _corMissoesFechar(); }
    _corBgmParar();
    _corChuvaSomParar();
    _corComecar();
  }

  /* Toque nos lados: cada dedo guarda o lado em que encostou (-1/+1). */
  var _corLados = {};
  function _corLadosSoltar() { _corLados = {}; }
  function _corLadoDe(x, y) {
    if (!_corCanvas) return 0;
    var r = _corCanvas.getBoundingClientRect();
    // Girado por CSS: a esquerda do jogo é o TOPO da tela física.
    var f = _corRotacionado() ? (y - r.top) / (r.height || 1) : (x - r.left) / (r.width || 1);
    return f < 0.34 ? -1 : (f > 0.66 ? 1 : 0);
  }
  function _corLadosAplicar(dt) {
    var dir = 0;
    for (var k in _corLados) dir += _corLados[k];
    if (!dir) return;
    dir = dir > 0 ? 1 : -1;
    _corCamX = _corClamp(_corCamX + dir * COR_PAD_VEL * 1.15 * COR_SENS[_corOpc.sens] * dt, -_COR_CAM_LIM, _COR_CAM_LIM);
  }
  function _corDrawLados(ctx, W, H) {
    if (_corControle() !== 'lados') return;
    var dir = 0;
    for (var k in _corLados) dir += _corLados[k];
    var r = H * 0.05, y = H * 0.56;
    ctx.save();
    ctx.lineWidth = Math.max(3, H * 0.012); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var lado = -1; lado <= 1; lado += 2) {
      var x = lado < 0 ? W * 0.06 : W * 0.94;
      ctx.strokeStyle = (dir && (dir > 0) === (lado > 0)) ? 'rgba(124,240,160,0.85)' : 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.moveTo(x - lado * r * 0.5, y - r); ctx.lineTo(x + lado * r * 0.5, y); ctx.lineTo(x - lado * r * 0.5, y + r); ctx.stroke();
    }
    ctx.restore();
  }
  // Tiro automático: dispara sozinho quando há zumbi perto na mira.
  var _corAutoT = 0;
  function _corAutoTiro(dt) {
    _corAutoT -= dt;
    if (_corAutoT > 0 || _corTiroT > 0) return;
    if (!_corArma && _corMun <= 0) return;
    var a = _corMiraAlvo(_corW, _corH);
    if (!a || a.z > 0.55) return;
    _corAutoT = 0.3;
    _corAtirar();
  }

  /* ── EVENTOS DE ZUMBI ───────────────────────────────────────────
     Além do fluxo normal, de tempos em tempos acontece um evento:
       cruzando   — um grupo atravessa o caminho de lado
       chao       — corujas-zumbi saem do chão perto de você
       corredora  — uma corre na sua direção (mais rápida que todas)
       parede     — HORDA: uma fileira inteira com uma brecha só
       rastejante — baixinha, quase escondida no mato (só com arte)
     Os comportamentos são todos de código; arte própria (corredor,
     rastejante, saindo do chão) é opcional. */
  var _corEventoT = 0;
  function _corNovoZumbi(tipo, faixa, z) {
    _corSpawnZumbi();
    var zb = _corZumbis[_corZumbis.length - 1];
    zb.tipo = tipo; zb.hp = _COR_TIPOS[tipo].hp; zb.faixa = faixa; zb.z = z;
    if (tipo === 'corredor') zb.sheetKey = _corSheetPronto('corredor') ? 'corredor' : 'rapido';
    else if (tipo === 'rastejante') zb.sheetKey = 'rastejante';
    else if (tipo === 'normal') zb.sheetKey = Math.random() < 0.5 ? 'normalB' : 'normal';
    else zb.sheetKey = tipo;
    return zb;
  }
  function _corEvento(ev) {
    var i, zb, lado;
    if (ev === 'cruzando') {
      lado = Math.random() < 0.5 ? -1 : 1;
      var n = 3 + ((Math.random() * 3) | 0), vx = _corRand(0.32, 0.48);
      for (i = 0; i < n; i++) {
        zb = _corNovoZumbi('normal', _corCamX + lado * (1.45 + i * 0.22), _corRand(0.55, 0.7) + i * 0.04);
        zb.vx = -lado * vx; zb.homing = 0; zb.swayA = 0.03;
      }
      _corSomGemido(lado, 0.9);
    } else if (ev === 'chao') {
      var m = Math.random() < 0.5 ? 1 : 2;
      for (i = 0; i < m; i++) {
        zb = _corNovoZumbi('normal', _corCamX + _corRand(-0.55, 0.55), _corRand(0.4, 0.52));
        zb.surge = 0.9;
        if (_corSheetPronto('chao')) zb.sheetKey = 'chao';
      }
      var ac = _corAudio();
      if (!_corSfx('terra', 0.75, (zb.faixa - _corCamX) / 1.2) && ac && _corSomLigado()) _corSopro(ac, ac.currentTime, 0.6, 500, 90, 0.3, 0);
    } else if (ev === 'corredora') {
      zb = _corNovoZumbi('corredor', _corCamX + _corRand(-0.6, 0.6), _COR_Z_FAR);
      zb.homing = 0.55;
      if (!_corSfx('corredora', 0.7, (zb.faixa - _corCamX) / 1.2, 0.08)) _corSomRosnado();
      _corAviso('Corredora!', 'Desvia ou derruba antes que ela chegue', '#ff6a5a', 1.6);
    } else if (ev === 'parede') {
      var k = 8, brecha = 2 + ((Math.random() * 4) | 0), larg = 2.8;
      for (i = 0; i < k; i++) {
        if (i === brecha) continue;
        zb = _corNovoZumbi(Math.random() < 0.2 ? 'forte' : 'normal', _corCamX - larg / 2 + larg * i / (k - 1), _COR_Z_FAR - Math.random() * 0.04);
        zb.homing = 0; zb.swayA = 0.015;
      }
      _corAviso('HORDA!', 'Ache a brecha', '#ff4a3a', 2);
      _corSomGemido(0, 1);
    } else if (ev === 'rastejante') {
      zb = _corNovoZumbi('rastejante', _corCamX + _corRand(-0.5, 0.5), _COR_Z_FAR);
      zb.homing = 0.12;
    }
  }
  function _corEventosAtualizar(dt) {
    _corEventoT -= dt;
    if (_corEventoT > 0) return;
    if (_corDist < 220) { _corEventoT = 3; return; }
    var opc = ['cruzando', 'cruzando'];
    if (_corDist > 300) opc.push('chao');
    if (_corDist > 420) opc.push('corredora');
    if (_corDist > 550) opc.push('parede');
    if (_corDist > 250 && _corSheetPronto('rastejante')) opc.push('rastejante');
    _corEvento(opc[(Math.random() * opc.length) | 0]);
    _corEventoT = _corRand(12, 20) - Math.min(5, _corDist / 600);
  }

  /* ── CLIMA ──────────────────────────────────────────────────────
     Chuva (com relâmpago e trovão) e "noite fechada" (escurece tudo e
     fica só o facho da lanterna em volta da mira) vêm em trechos, depois
     dos primeiros metros. Tudo de código, sem arte. */
  var _corClima = null;
  var _corGotas = [];
  var _corChuvaSom = null;
  function _corClimaZerar() {
    _corClima = { chuva: 0, chuvaAlvo: 0, chuvaT: _corRand(25, 40), raioT: 8, flash: 0, flashes: [], trovaoT: -1,
                  noite: 0, noiteAlvo: 0, noiteT: _corRand(30, 45) };
    _corGotas.length = 0;
    for (var i = 0; i < 150; i++) _corGotas.push({ x: Math.random(), y: Math.random(), v: _corRand(1.4, 2.2), l: _corRand(0.03, 0.06) });
  }
  function _corClimaAtualizar(dt) {
    var c = _corClima, ac, i;
    c.chuvaT -= dt;
    if (c.chuvaT <= 0) {
      if (c.chuvaAlvo > 0) { c.chuvaAlvo = 0; c.chuvaT = _corRand(30, 50); }
      else if (_corDist > 280 && Math.random() < 0.6) { c.chuvaAlvo = 1; c.chuvaT = _corRand(20, 32); c.raioT = _corRand(3, 6); }
      else c.chuvaT = _corRand(12, 20);
    }
    c.chuva += (c.chuvaAlvo - c.chuva) * Math.min(1, dt * 0.45);
    for (i = 0; i < _corGotas.length; i++) {
      var g = _corGotas[i];
      g.y += g.v * dt; g.x += 0.18 * dt;
      if (g.y > 1.05) { g.y = -0.05; g.x = Math.random(); }
      if (g.x > 1.02) g.x -= 1.04;
    }
    // Relâmpago (só na chuva forte): clarão duplo e o trovão um pouco depois.
    if (c.chuva > 0.55) {
      c.raioT -= dt;
      if (c.raioT <= 0) {
        c.raioT = _corRand(7, 14);
        c.flashes = [0, 0.13]; c.trovaoT = _corRand(0.6, 1.4);
      }
    }
    for (i = c.flashes.length - 1; i >= 0; i--) {
      c.flashes[i] -= dt;
      if (c.flashes[i] <= 0) { c.flash = Math.max(c.flash, i === 0 ? 1 : 0.75); c.flashes.splice(i, 1); }
    }
    if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 4);
    if (c.trovaoT > 0) {
      c.trovaoT -= dt;
      if (c.trovaoT <= 0 && _corSfx('trovao', 0.8, _corRand(-0.4, 0.4), 0.08)) c.trovaoT = 0;
      else if (c.trovaoT <= 0) { ac = _corAudio(); if (ac && _corSomLigado()) { _corSopro(ac, ac.currentTime, 1.8, 380, 50, 0.45, 0); _corTom(ac, ac.currentTime, 'sine', 55, 30, 1.2, 0.18); } }
    }
    // Noite fechada.
    c.noiteT -= dt;
    if (c.noiteT <= 0) {
      if (c.noiteAlvo > 0) { c.noiteAlvo = 0; c.noiteT = _corRand(35, 55); }
      else if (_corDist > 200 && Math.random() < 0.55) {
        c.noiteAlvo = 1; c.noiteT = _corRand(15, 22);
        _corAviso('Noite fechada', 'Só a lanterna ilumina o caminho', '#9fb0c4', 2);
      } else c.noiteT = _corRand(15, 25);
    }
    c.noite += (c.noiteAlvo - c.noite) * Math.min(1, dt * 0.6);
    _corChuvaSomAtualizar();
  }
  // Barulho de chuva: ruído contínuo filtrado, volume pela intensidade.
  function _corChuvaSomAtualizar() {
    var ac = _corAudio();
    var alvo = (_corClima && _corEstado === 'jogando' && !_corPausado && _corSomLigado()) ? _corClima.chuva * 0.09 : 0;
    if (!ac) return;
    if (_corSfxLoop('chuva-loop', alvo * 5.5)) { if (_corChuvaSom) { try { _corChuvaSom.src.stop(); } catch (e) {} _corChuvaSom = null; } return; }
    if (!_corChuvaSom) {
      if (alvo < 0.005) return;
      try {
        var src = ac.createBufferSource(); src.buffer = _corRuido(ac); src.loop = true;
        var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
        var g = ac.createGain(); g.gain.value = 0.0001;
        src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(_corMaster); src.start();
        _corChuvaSom = { src: src, g: g };
      } catch (e) { return; }
    }
    try { _corChuvaSom.g.gain.setTargetAtTime(Math.max(0.0001, alvo), ac.currentTime, 0.3); } catch (e) {}
    if (alvo < 0.002 && _corChuvaSom.g.gain.value < 0.002) { try { _corChuvaSom.src.stop(); } catch (e) {} _corChuvaSom = null; }
  }
  function _corChuvaSomParar() {
    if (_corChuvaSom) { try { _corChuvaSom.src.stop(); } catch (e) {} _corChuvaSom = null; }
    _corLoopsParar();   // passos, fôlego e chuva gravados param junto (pausa, fim, saída)
  }
  // Noite: escurece em volta, sobra o facho da lanterna em volta da mira.
  function _corDrawNoite(ctx, W, H) {
    var c = _corClima;
    if (!c || c.noite < 0.02) return;
    var cx = W * 0.5, cy = H * (_COR_HORIZ + 0.14);
    var g = ctx.createRadialGradient(cx, cy, H * 0.16, cx, cy, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,6,0)');
    g.addColorStop(0.45, 'rgba(0,0,6,' + (0.55 * c.noite).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,6,' + (0.93 * c.noite).toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function _corDrawChuva(ctx, W, H) {
    var c = _corClima;
    if (!c) return;
    if (c.chuva > 0.02) {
      ctx.fillStyle = 'rgba(10,18,32,' + (0.16 * c.chuva).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
      var n = Math.floor(_corGotas.length * c.chuva * (_corOpc.leve ? 0.45 : 1));
      ctx.strokeStyle = 'rgba(190,205,230,' + (0.38 * c.chuva).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, H * 0.0025);
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var g = _corGotas[i], x = g.x * W, y = g.y * H, l = g.l * H;
        ctx.moveTo(x, y); ctx.lineTo(x - l * 0.18, y + l);
      }
      ctx.stroke();
    }
    if (c.flash > 0.01) { ctx.fillStyle = 'rgba(225,232,255,' + (c.flash * 0.55).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  /* ── SOM: respiração e gemidos com direção ──────────────────────
     Respiração ofegante quando o perigo sobe, no cambaleio e com a
     velocidade. Gemido de zumbi vem do lado em que ele está (pan). */
  var _corRespT = 0, _corGemidoCd = 0;
  function _corRespAtualizar(dt) {
    if (_corGemidoCd > 0) _corGemidoCd -= dt;
    var vel = (_corVel - _COR_VEL_INI) / (_COR_VEL_MAX - _COR_VEL_INI);
    var I = Math.max(_corPerigo, _corSlowT > 0 ? 0.85 : 0, vel * 0.45);
    // Gravados: passos sempre (ritmo pela velocidade) e fôlego pela tensão.
    var velN = _corClamp(vel, 0, 1);
    _corSfxLoop('passos-loop', _corSlowT > 0 ? 0.22 : 0.3, 0.92 + 0.28 * velN + (_corSlowT > 0 ? -0.12 : 0));
    if (_corSfxLoop('respiracao-loop', I < 0.18 ? 0 : 0.12 + 0.4 * I, 0.9 + 0.3 * I)) return;
    _corRespT -= dt;
    if (I < 0.18 || _corRespT > 0) return;
    var per = 1.15 - 0.55 * I;
    _corRespT = per;
    var ac = _corAudio();
    if (!ac || !_corSomLigado()) return;
    var t = ac.currentTime;
    _corSopro(ac, t, per * 0.32, 650, 1300, 0.035 + 0.09 * I, 300);              // inspira
    _corSopro(ac, t + per * 0.45, per * 0.38, 1100, 480, 0.045 + 0.11 * I, 250); // solta
  }
  function _corSomGemido(pan, vol) {
    if (_corSfx('gemido', 0.55 * (vol || 1), pan, 0.12)) return;
    var ac = _corAudio();
    if (!ac || !_corSomLigado()) return;
    try {
      var t = ac.currentTime, dur = _corRand(0.6, 0.95), f0 = _corRand(95, 135);
      var o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + dur);
      var lfo = ac.createOscillator(); lfo.frequency.value = _corRand(5, 8);
      var lg = ac.createGain(); lg.gain.value = 7; lfo.connect(lg); lg.connect(o.frequency);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 4;
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11 * (vol || 1), t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g);
      var saida = g;
      if (ac.createStereoPanner) { var p = ac.createStereoPanner(); p.pan.value = _corClamp(pan || 0, -1, 1); g.connect(p); saida = p; }
      saida.connect(_corMaster);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    } catch (e) {}
  }

  /* ── MELHORIAS (progressão) ─────────────────────────────────────
     Compradas com moedas, valem pra sempre (salvas no aparelho e no
     pacote por conta). Arma inicial: escolhida antes da corrida, paga ao
     começar, vale só pra aquela corrida. */
  var COR_MELH_KEY = 'angatuba_corrida_melhorias';
  var COR_MELHORIAS = [
    { id: 'mun',    nome: 'Munição extra',       desc: '+3 dardos no começo da corrida',  precos: [60, 120, 200] },
    { id: 'guarda', nome: 'Guardiã mais longa',  desc: '+2 s de coruja guardiã',          precos: [80, 150, 250] },
    { id: 'ima',    nome: 'Ímã de moedas',       desc: 'pega moedas mais longe',          precos: [50, 100, 180] },
    { id: 'sorte',  nome: 'Mais caixas de arma', desc: 'caixas de arma aparecem mais',    precos: [70, 140, 220] }
  ];
  var COR_ARMA_INI_PRECO = { escopeta: 30, metralhadora: 45 };
  var _corMelh = (function () {
    var m = { mun: 0, guarda: 0, ima: 0, sorte: 0 };
    try { var d = JSON.parse(localStorage.getItem(COR_MELH_KEY) || 'null'); if (d) for (var k in m) if (m.hasOwnProperty(k)) m[k] = Math.max(0, Math.min(3, d[k] | 0)); } catch (e) {}
    return m;
  })();
  var _corArmaIni = '';
  function _corMelhSalvar() { try { localStorage.setItem(COR_MELH_KEY, JSON.stringify(_corMelh)); } catch (e) {} }
  function _corMelhRecarregar() {
    try { var d = JSON.parse(localStorage.getItem(COR_MELH_KEY) || 'null'); for (var k in _corMelh) if (_corMelh.hasOwnProperty(k)) _corMelh[k] = d ? Math.max(0, Math.min(3, d[k] | 0)) : 0; } catch (e) {}
  }
  function _corMunInicial() { return _COR_MUN_INI + 3 * _corMelh.mun; }
  function _corGuardDur() { return _COR_GUARD_DUR + 2 * _corMelh.guarda; }
  function _corMoedaPega() { return _COR_MOEDA_PEGA + 0.08 * _corMelh.ima; }
  function _corSaldo() { var G = window.AngatubaGames; return (G && typeof G.moedasSaldo === 'function') ? G.moedasSaldo() : 0; }

  function _corMelhoriasAbrir() {
    _corMelhRecarregar();
    var palco = document.getElementById('cor-palco');
    if (!palco) return;
    var el = document.getElementById('cor-melh');
    if (!el) { el = document.createElement('div'); el.id = 'cor-melh'; el.className = 'cor-overlay cor-melh'; palco.appendChild(el); }
    var saldo = _corSaldo();
    var h = '<div class="cor-overlay-titulo">🛠 Melhorias</div><div class="cor-melh-saldo">🪙 ' + saldo + '</div><div class="cor-melh-lista">';
    for (var i = 0; i < COR_MELHORIAS.length; i++) {
      var m = COR_MELHORIAS[i], nv = _corMelh[m.id], preco = m.precos[nv];
      var pips = ''; for (var p = 0; p < 3; p++) pips += '<span class="cor-melh-pip' + (p < nv ? ' on' : '') + '"></span>';
      h += '<div class="cor-melh-item"><div class="cor-melh-txt"><b>' + m.nome + '</b><span>' + m.desc + '</span><span class="cor-melh-pips">' + pips + '</span></div>' +
           (nv >= 3 ? '<span class="cor-melh-max">Máximo</span>'
                    : '<button type="button" class="cor-melh-btn"' + (saldo < preco ? ' disabled' : '') + ' onclick="_corMelhComprar(\'' + m.id + '\')">' + preco + ' 🪙</button>') +
           '</div>';
    }
    h += '</div><div class="cor-melh-sub">Arma inicial (só na próxima corrida)</div><div class="cor-melh-armas">';
    var ops = [['', 'Lançador', 0], ['escopeta', 'Escopeta', COR_ARMA_INI_PRECO.escopeta], ['metralhadora', 'Metralhadora', COR_ARMA_INI_PRECO.metralhadora]];
    for (var a = 0; a < ops.length; a++) {
      h += '<button type="button" class="cor-melh-arma' + (_corArmaIni === ops[a][0] ? ' on' : '') + '"' +
           (ops[a][2] > saldo && _corArmaIni !== ops[a][0] ? ' disabled' : '') +
           ' onclick="_corArmaIniEscolher(\'' + ops[a][0] + '\')">' + ops[a][1] + (ops[a][2] ? ' · ' + ops[a][2] + ' 🪙' : ' · grátis') + '</button>';
    }
    h += '</div><button type="button" class="cor-play" onclick="_corMelhoriasFechar()">Pronto</button>';
    el.innerHTML = h;
    el.style.display = '';
  }
  function _corMelhoriasFechar() { var el = document.getElementById('cor-melh'); if (el) el.style.display = 'none'; }
  function _corMelhComprar(id) {
    var m = null;
    for (var i = 0; i < COR_MELHORIAS.length; i++) if (COR_MELHORIAS[i].id === id) m = COR_MELHORIAS[i];
    if (!m || _corMelh[id] >= 3) return;
    var preco = m.precos[_corMelh[id]], G = window.AngatubaGames;
    if (!G || typeof G.moedasAdd !== 'function' || _corSaldo() < preco) return;
    G.moedasAdd(-preco, 'corrida-melhoria');
    _corMelh[id]++; _corMelhSalvar();
    if (G.som) G.som.nivelUp();
    _corMelhoriasAbrir();
  }
  function _corArmaIniEscolher(a) { _corArmaIni = a; _corMelhoriasAbrir(); }
  // Chamada ao começar a corrida (depois do reset): cobra e equipa a arma inicial.
  function _corArmaIniAplicar() {
    var a = _corArmaIni;
    _corArmaIni = '';
    if (!a || !_COR_ARMAS[a]) return;
    var preco = COR_ARMA_INI_PRECO[a], G = window.AngatubaGames;
    if (!G || typeof G.moedasAdd !== 'function' || _corSaldo() < preco) return;
    G.moedasAdd(-preco, 'corrida-arma');
    _corArma = a; _corArmaMun = _COR_ARMAS[a].mun;
    _corAtualizarHUD(true);
    _corAviso(_COR_ARMAS[a].nome + '!', 'Arma inicial', _COR_ARMAS[a].cor, 1.6);
  }

  /* Obstáculo de cenário: nasce no horizonte, relativo à câmera (mesmo
     padrão dos zumbis/itens — nunca "acaba" mesmo andando muito pro lado).
     Metade das vezes nasce "no caminho" (perto do centro, força desviar de
     verdade); a outra metade já nasce lateral (só decorativo). Quando já
     existe outro obstáculo em campo, o novo é OBRIGATORIAMENTE lateral e do
     lado OPOSTO ao último — assim os dois nunca fecham os dois lados ao
     mesmo tempo e sempre sobra passagem livre. */
  // Sorteia o tipo do obstáculo pela ZONA atual; os "soArte" só valem com
  // a imagem já carregada. Sem nenhum disponível, cai em pedra/entulho.
  function _corObstSortear() {
    var lista = COR_ZONAS[_corZonaIdx].obst, ok = [];
    for (var i = 0; i < lista.length; i++) {
      var def = _COR_OBST_TIPOS[lista[i]];
      if (!def) continue;
      if (def.soArte) { var a = _corObstAsset(lista[i]); if (!(a && a.ok)) continue; }
      ok.push(lista[i]);
    }
    if (!ok.length) ok = ['pedra', 'entulho'];
    return ok[(Math.random() * ok.length) | 0];
  }

  function _corSpawnObstaculo() {
    var tipo = _corObstSortear();
    var lado, offset;
    if (_corObstaculos.length > 0) {
      var ultimo = _corObstaculos[_corObstaculos.length - 1];
      lado = (ultimo.faixa - _corCamX) < 0 ? 1 : -1;
      offset = _corRand(0.65, 1.05);
    } else {
      lado = (Math.random() < 0.5) ? -1 : 1;
      offset = (Math.random() < 0.5) ? _corRand(0.10, 0.40) : _corRand(0.65, 1.05);
    }
    var faixa = _corCamX + lado * offset;
    // Não nasce em cima de um item de munição já nascido no mesmo trecho.
    for (var i = 0; i < _corItens.length; i++) {
      if (Math.abs(_corItens[i].faixa - faixa) < 0.30) { faixa += lado * 0.35; break; }
    }
    // Nem em cima do fim de uma fileira de moedas que ainda está chegando.
    for (var j = 0; j < _corMoedas.length; j++) {
      if (_corMoedas[j].z > 0.7 && Math.abs(_corMoedas[j].faixa - faixa) < 0.35) { faixa += lado * 0.45; break; }
    }
    _corObstaculos.push({ z: _COR_Z_FAR, faixa: faixa, tipo: tipo });
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
      if (zb.morto || !zb._vis || zb.surge > 0.35) continue;
      var tolX = W * 0.08 + _COR_TIPOS[zb.tipo].w * W * 0.5 * zb._ps;
      if (Math.abs(zb._px - cx) > tolX) continue;
      var hpxZ = 0.5 * H * zb._ps * 0.94;
      var altura = hpxZ * _COR_ALT_MUL * (_COR_TIPOS[zb.tipo].alt || 1), folga = hpxZ * 0.35;
      if (cy < zb._py - altura - folga || cy > zb._py + folga) continue;
      if (zb.z < melhorZ) { melhorZ = zb.z; alvo = zb; }
    }
    return alvo;
  }

  // Dano num zumbi (tiro de qualquer arma ou ataque da guardiã). 'fonte'
  // alimenta os contadores das missões. Devolve true se matou.
  function _corDano(alvo, n, fonte) {
    if (!alvo || alvo.morto) return false;
    alvo.hp -= n;
    if (alvo.hp <= 0) {
      alvo.morto = true; alvo.cai = 0.001;
      for (var k = 0; k < 7; k++) {
        _corSangue.push({
          x: alvo._px + _corRand(-16, 16), y: alvo._py - _corRand(6, 40) * alvo._ps,
          r: _corRand(2, 7) * (0.6 + alvo._ps), life: 0.5, max: 0.5
        });
      }
      _corSomImpacto(true);
      _corRun.abates++;
      if (alvo.tipo === 'rapido') _corRun.rapido++;
      else if (alvo.tipo === 'forte') _corRun.forte++;
      if (fonte === 'escopeta') _corRun.escopeta++;
      return true;
    }
    _corSomImpacto(false);
    if (window.AngatubaGames && window.AngatubaGames.efeitos) {
      window.AngatubaGames.efeitos.estrelas(alvo._px, alvo._py - 20 * alvo._ps, 4, _corOpcoesFx());
    }
    return false;
  }

  // auto=true: disparo automático da metralhadora (só ela atira sozinha).
  function _corAtirar(auto) {
    if (_corEstado !== 'jogando') return;
    if (_corTiroT > 0) return;
    if (_corArma) { _corAtirarEspecial(auto); return; }
    if (auto) return;
    if (_corMun <= 0) { _corSomVazio(); return; }
    _corMun--; _corTiroT = _COR_TIRO_CD; _corFlashT = 0.09; _corRecuo = 1;
    _corSomTiro();
    _corContarTiro();
    var alvo = _corMiraAlvo(_corW, _corH);
    if (alvo) _corDano(alvo, 1, 'lancador');
    _corAtualizarHUD();
  }

  function _corContarTiro() {
    _corRun.tiros++;
    if (_corRun.distPrimeiroTiro < 0) _corRun.distPrimeiroTiro = _corDist;
  }

  /* Escopeta: acerta TODO zumbi vivo e visível num cone largo à frente
     (perto conta mais: dentro de z<0.3 derruba até a forte). Metralhadora:
     tiro único rápido no alvo da mira, igual ao lançador. */
  function _corAtirarEspecial(auto) {
    var def = _COR_ARMAS[_corArma];
    if (auto && !def.auto) return;
    if (auto && !_corMiraAlvo(_corW, _corH)) return;
    _corArmaMun--; _corTiroT = def.cd;
    _corContarTiro();
    var W = _corW, H = _corH;
    if (_corArma === 'escopeta') {
      _corFlashT = 0.16; _corRecuo = 1.5; _corShakeT = Math.max(_corShakeT, _COR_SHAKE_DUR * 0.6);
      if (!_corSfx('escopeta', 0.9)) {
        _corSomTiro();
        var acE = _corAudio();
        if (acE && _corSomLigado()) _corTom(acE, acE.currentTime, 'sawtooth', 120, 40, 0.22, 0.22);
      }
      var cx = W * 0.5;
      for (var i = 0; i < _corZumbis.length; i++) {
        var zb = _corZumbis[i];
        if (zb.morto || !zb._vis || zb.z > 0.6) continue;
        if (Math.abs(zb._px - cx) > W * (0.12 + 0.22 * zb._ps)) continue;
        _corDano(zb, zb.z < 0.3 ? 3 : 2, 'escopeta');
      }
    } else {
      _corFlashT = 0.06; _corRecuo = 0.55;
      if (!_corSfx('metralhadora', 0.55, 0, 0.08)) _corSomTiro();
      var alvo = _corMiraAlvo(W, H);
      if (alvo) _corDano(alvo, 1, 'metralhadora');
    }
    if (_corArmaMun <= 0) {
      _corArma = ''; _corArmaMun = 0;
      _corAviso('Munição especial acabou', 'De volta ao lançador', '#c7d1e0', 1.6);
    }
    _corAtualizarHUD();
  }

  /* Esbarrão: raspão na BORDA de um zumbi — não mata. Empurra o zumbi pra
     longe da câmera (mais fraco no zumbi "forte": ele quase não sai da
     frente), treme a câmera, abre o i-frame curtinho (anti-double-hit no
     mesmo frame) e entra em _corSlowT — o cambaleio que deixa o mundo
     ~50% mais lento e vira "chain kill" se outro zumbi te alcançar antes
     de passar (ver _corUpdate). Esbarrar de novo enquanto já está lento
     RENOVA a duração do slow (não soma) — continua cambaleando, não
     acumula pra sempre. Reusa o som de impacto (sem "matou") e um burst
     leve de partículas, se o efeitos.js tiver carregado. */
  function _corEsbarrao(zb) {
    var lado = (zb.faixa - _corCamX) < 0 ? -1 : 1;
    var forca = (zb.tipo === 'forte') ? 0.05 : (zb.tipo === 'rapido' ? 0.16 : 0.12);
    zb.faixa += lado * forca;
    _corRun.esbarroes++;
    if (_corRun.distPrimeiroEsb < 0) _corRun.distPrimeiroEsb = _corDist;
    _corShakeT = _COR_SHAKE_DUR;
    _corIframesT = _COR_IFRAMES_DUR;
    _corSlowT = _COR_SLOW_DUR;
    _corVibrar(70);
    if (!_corSfx('esbarrao', 0.85, lado * 0.5)) {
      _corSomImpacto(false);
      // Corpo extra grave por baixo do impacto — o esbarrão é um "trombada",
      // não só um tiro de raspão; dá mais peso sem trocar o som base.
      var acEsb = _corAudio();
      if (acEsb && _corSomLigado()) _corTom(acEsb, acEsb.currentTime, 'sine', 90, 35, 0.18, 0.20);
    }
    if (window.AngatubaGames && window.AngatubaGames.efeitos) {
      var p = _corProj(zb.z, zb.faixa);
      window.AngatubaGames.efeitos.estrelas(p.x, p.y - 10 * p.s, 3, _corOpcoesFx());
    }
  }

  /* ══════════════════════════════════════════════════════════════
     UPDATE
  ══════════════════════════════════════════════════════════════ */
  function _corUpdate(dt) {
    _corBgmChecarMudo();   // acompanha o jogador mutar/desmutar o som global no meio da partida
    _corVel = Math.min(_COR_VEL_MAX, _corVel + _COR_VEL_ACC * dt);
    if (_corSlowT > 0) _corSlowT = Math.max(0, _corSlowT - dt);
    // Cambaleio pós-esbarrão: avanço do MUNDO (distância pontuada + quão
    // rápido o zumbi se aproxima) a ~50%, sem mexer no _corVel "de verdade"
    // (a aceleração/dificuldade de fundo continua subindo por baixo).
    // Obstáculos NÃO usam isto (instrução explícita: não mexer neles).
    var velEfetiva = _corSlowT > 0 ? _corVel * _COR_SLOW_MUL : _corVel;
    // Distância em "metros": fator reduzido pra dar ritmo de pessoa correndo,
    // não de veículo. Com vel~0.16-0.34 e fator 16, ~5-9 m/s (18-32 km/h no
    // pico), mas começa devagar e a sensação casa com o passo.
    _corDist += velEfetiva * dt * 16;

    // Passada: avança com a velocidade EFETIVA (não a "de verdade") — no
    // cambaleio pós-esbarrão o passo fica mais pesado/arrastado também,
    // não só o mundo. Deriva head-bob e micro-sway.
    _corPasso += dt * (2.6 + velEfetiva * 1.6) * Math.PI;
    // bobY: 2 subidas por ciclo de passada (pé esq + pé dir). Amplitude
    // pequena, cresce um tico com a velocidade; um pouco maior no
    // cambaleio (passo mais "pesado", opcional/leve como pedido).
    var ampBob = 0.014 + velEfetiva * 0.004 + (_corSlowT > 0 ? 0.010 : 0);
    _corBobY = Math.abs(Math.sin(_corPasso)) * ampBob;      // sempre >=0 (só sobe)
    // swayX: 1 balanço por passo, alterna lados. Bem sutil.
    var ampSway = 0.010 + velEfetiva * 0.003;
    _corSwayX = Math.sin(_corPasso * 0.5) * ampSway;
    // Som do pé no chão: cada meio-ciclo de _corPasso é uma pisada.
    var meioCiclo = Math.floor(_corPasso / Math.PI);
    if (meioCiclo !== _corPassoUlt) { _corPassoUlt = meioCiclo; _corSomPasso(); }

    if (_corTiroT > 0) _corTiroT -= dt;
    if (_corFlashT > 0) _corFlashT -= dt;
    if (_corRecuo > 0) _corRecuo = Math.max(0, _corRecuo - dt * 6);
    if (_corShakeT > 0) _corShakeT = Math.max(0, _corShakeT - dt);
    if (_corIframesT > 0) _corIframesT = Math.max(0, _corIframesT - dt);
    if (_corRosnadoT > 0) _corRosnadoT = Math.max(0, _corRosnadoT - dt);
    _corCamVX *= Math.max(0, 1 - dt * 10);

    // Uivo distante (ambiente): agenda independente de mudo — se estiver
    // mudo o _corSomUivoDistante() só não soa, mas o relógio não emperra
    // (senão desmutar no meio da partida disparava uma "fila" atrasada).
    _corUivoT -= dt;
    if (_corUivoTocandoT > 0) _corUivoTocandoT = Math.max(0, _corUivoTocandoT - dt);
    if (_corUivoT <= 0 && _corUivoTocandoT <= 0) {
      var durUivo = _corRand(0.9, 1.4);
      _corSomUivoDistante(durUivo);
      _corUivoTocandoT = durUivo;
      _corUivoT = _corRand(10, 18);
    }

    // Spawn por POPULAÇÃO: mantém entre POP_MIN e POP_MAX zumbis vivos na
    // tela (campo aberto cheio, estilo Into the Dead). Conta os vivos.
    var vivos = 0;
    for (var vi = 0; vi < _corZumbis.length; vi++) if (!_corZumbis[vi].morto) vivos++;
    _corSpawnT -= dt;
    var popMin = _corPopMin(), popMax = _corPopMax();
    if (_corSpawnT <= 0) {
      if (vivos < popMin) {
        // Abaixo do mínimo: repõe rápido. Nos primeiros ~100m spawna só 1
        // por vez (popMin já começa baixo — 2 de uma vez ainda formava uma
        // dupla em cima do jogador antes dele sequer se situar); depois
        // disso volta a repor 2 de uma vez quando está bem abaixo do alvo.
        _corSpawnZumbi();
        if (_corDist > 100 && vivos < popMin - 1) _corSpawnZumbi();
        _corSpawnT = _corRand(0.25, 0.6);
      } else if (vivos < popMax) {
        // Entre min e max: spawna esporádico.
        _corSpawnZumbi();
        _corSpawnT = _corRand(0.8, 1.6);
      } else {
        // Cheio: espera esvaziar um pouco.
        _corSpawnT = _corRand(0.5, 1.0);
      }
    }
    _corItemT -= dt;
    if (_corItemT <= 0) { _corSpawnItem(); _corItemT = _corRand(8.5, 14); }

    // Obstáculo: intervalo ~8-12s no começo, aperta um pouco (piso 4.5-6.5s)
    // com a distância. No máx 1 obstáculo em campo no começo, 2 depois de
    // ~500m (ver _corSpawnObstaculo pra garantia de passagem livre).
    _corObstT -= dt;
    if (_corObstT <= 0) {
      var maxObst = (_corDist > 500) ? 2 : 1;
      if (_corObstaculos.length < maxObst) _corSpawnObstaculo();
      _corObstT = _corRand(_corClamp(8 - _corDist / 600, 4.5, 8), _corClamp(12 - _corDist / 500, 6.5, 12));
    }

    var i, zb;
    for (i = _corZumbis.length - 1; i >= 0; i--) {
      zb = _corZumbis[i];
      if (zb.morto) {
        zb.cai += dt;
        if (zb.cai > 0.6) _corZumbis.splice(i, 1);
        continue;
      }
      // v6.2: saindo do chão — parado, sem colisão, até terminar de subir.
      if (zb.surge > 0) {
        zb.surge -= dt; zb.bob += dt * 4;
        if (zb.surge <= 0) { zb.surge = 0; if (zb.sheetKey === 'chao') zb.sheetKey = 'normal'; }
        continue;
      }
      zb.z -= velEfetiva * (_COR_TIPOS[zb.tipo].vel) * (zb.velVar || 1) * dt;
      zb.bob += dt * 4;
      zb.swayP += dt * zb.swayF;
      // Homing suave: cada zumbi puxa levemente a faixa em direção à
      // câmera (diferencia do Into the Dead, que só desvia em linha reta).
      // Rápido "sente" mais forte, forte mais fraco, normal no meio; o
      // sway (acima) continua por cima, então o rumo nunca fica reto.
      var homingR = (zb.homing != null) ? zb.homing : ((zb.tipo === 'rapido') ? 0.32 : (zb.tipo === 'forte' ? 0.10 : 0.18));
      zb.faixa += (_corCamX - zb.faixa) * Math.min(1, homingR * dt);
      if (zb.vx) zb.faixa += zb.vx * dt;                 // v6.2: grupo cruzando de lado
      // v6.2: gemido com direção quando chega mais perto (nem todos gemem).
      if (!zb.gemeu && zb.z < 0.6) {
        zb.gemeu = true;
        if (_corGemidoCd <= 0 && Math.random() < 0.45) { _corSomGemido((zb.faixa - _corCamX) / 1.1, 0.8); _corGemidoCd = 0.8; }
      }
      // Rosnado de perigo: zumbi perto (z < 0.35) E na faixa que mata —
      // mesma dupla condição do pulso vermelho em _corDrawZumbi, só que
      // aqui é sonora. Cooldown GLOBAL (_corRosnadoT) evita coro de horda:
      // o primeiro zumbi perigoso do frame dispara, os outros esperam.
      if (_corRosnadoT <= 0 && zb.z < 0.35 && Math.abs(zb.faixa - _corCamX) < _corMeiaColisao(zb.tipo)) {
        _corSomRosnado();
        _corRosnadoT = _corRand(0.8, 1.2);
      }
      if (zb.z <= 0.05) {
        // i-frame curtinho: só evita processar a MESMA colisão duas vezes
        // no mesmo lance (não é invulnerabilidade — ver comentário na
        // declaração de _corIframesT). Fora dele:
        if (_corIframesT <= 0) {
          var meia = _corMeiaColisao(zb.tipo);
          var dist = Math.abs(zb.faixa - _corCamX);
          if (_corSlowT > 0) {
            // CHAIN KILL: já esbarrou e está no cambaleio — QUALQUER
            // contato agora (centro OU borda) mata. Sem segundo esbarrão
            // de graça: se a horda te alcançar antes de você se afastar
            // e o slow acabar, morreu.
            if (dist < meia) { _corAgarrar(zb); return; }
          } else {
            // Fora do cambaleio: distingue COLISÃO FATAL (centro, < 55%
            // da meia-colisão) de ESBARRÃO (borda, entre 55% e 100%) —
            // igual antes.
            if (dist < meia * _COR_FATAL_FRAC) { _corAgarrar(zb); return; }
            if (dist < meia) { _corEsbarrao(zb); _corZumbis.splice(i, 1); continue; }
          }
        }
        _corZumbis.splice(i, 1); continue;
      }
    }

    for (i = _corObstaculos.length - 1; i >= 0; i--) {
      var ob = _corObstaculos[i];
      ob.z -= _corVel * dt;
      if (ob.z <= 0.05) {
        // Sólido: sem esbarrão, sem i-frame — se está na faixa, morre.
        // Som de impacto seco/abafado ANTES do game over (que ainda toca
        // o rosnado de morte por cima) — diferencia claramente "bateu no
        // carro" de "mordida de zumbi".
        if (Math.abs(ob.faixa - _corCamX) < _corMeiaObst(ob.tipo)) { _corSomImpactoObstaculo(); _corGameOver(); return; }
        _corObstaculos.splice(i, 1);
      }
    }

    for (i = _corItens.length - 1; i >= 0; i--) {
      var it = _corItens[i];
      it.z -= _corVel * dt;
      it.bob += dt * 4;
      if (it.z <= 0.07) {
        if (Math.abs(it.faixa - _corCamX) < 0.32) {
          _corMun = Math.min(99, _corMun + 4);
          _corSomRecarga();
          if (window.AngatubaGames && window.AngatubaGames.efeitos) {
            var pit = _corProj(it.z, it.faixa);
            window.AngatubaGames.efeitos.estrelas(pit.x, pit.y - 16, 8, _corOpcoesFx());
          }
        }
        _corItens.splice(i, 1);
      }
    }

    // Moedas: fileira nova a cada ~9-13s no começo, apertando até ~5.5-8s.
    _corMoedaT -= dt;
    if (_corMoedaT <= 0) {
      _corSpawnMoedas();
      _corMoedaT = _corRand(_corClamp(9 - _corDist / 400, 5.5, 9), _corClamp(13 - _corDist / 350, 8, 13));
    }
    if (_corMoedaStreakT > 0) { _corMoedaStreakT -= dt; if (_corMoedaStreakT <= 0) _corMoedaStreak = 0; }
    for (i = _corMoedas.length - 1; i >= 0; i--) {
      var mo = _corMoedas[i];
      mo.z -= _corVel * dt;
      if (mo.z <= 0.07) {
        if (Math.abs(mo.faixa - _corCamX) < _corMoedaPega()) {
          _corMoedasRun++;
          _corMoedaStreak++; _corMoedaStreakT = 1.0;
          if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.combo(Math.min(8, _corMoedaStreak));
          if (_corMoedaFx.length >= 8) _corMoedaFx.shift();
          _corMoedaFx.push({ x: _corProj(mo.z, mo.faixa).x, t: 0 });
        }
        _corMoedas.splice(i, 1);
      }
    }
    for (i = _corMoedaFx.length - 1; i >= 0; i--) {
      _corMoedaFx[i].t += dt;
      if (_corMoedaFx[i].t >= 0.6) _corMoedaFx.splice(i, 1);
    }

    // v6.2: chão, eventos de zumbi, clima, respiração e inclinação.
    _corChaoRolo += _corVel * dt;
    _corEventosAtualizar(dt);
    _corClimaAtualizar(dt);
    _corRespAtualizar(dt);
    _corTiltAplicar(dt);
    _corLadosAplicar(dt);
    // v6: caixas de arma, guardiã, perigo, zona, avisos e missões.
    _corBeiraAtualizar(dt);
    _corItensV6(dt);
    _corGuardAtualizar(dt);
    _corPerigoAtualizar(dt);
    _corZonaAtualizar(dt);
    _corAvisosAtualizar(dt);
    _corMisT += dt;
    if (_corMisT >= 0.25) { _corMisT = 0; _corMissoesChecar(); }

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
    var ctx = _corCtx, W = _corW, H = _corH, horizonY = H * _COR_HORIZ + _corBobY * H + _corShakeY() * H;

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
    _corDrawChao(ctx, W, H);   // v6.2: chão correndo (com a textura da zona)

    // ── Entidades (zumbis + itens) do fundo pra frente ──
    var render = [];
    var i;
    for (i = 0; i < _corItens.length; i++) render.push({ k: 'item', o: _corItens[i], z: _corItens[i].z });
    for (i = 0; i < _corZumbis.length; i++) render.push({ k: 'zumbi', o: _corZumbis[i], z: _corZumbis[i].z });
    for (i = 0; i < _corObstaculos.length; i++) render.push({ k: 'obst', o: _corObstaculos[i], z: _corObstaculos[i].z });
    for (i = 0; i < _corMoedas.length; i++) if (_corMoedas[i].z <= _COR_Z_FAR) render.push({ k: 'moeda', o: _corMoedas[i], z: _corMoedas[i].z });
    for (i = 0; i < _corCaixas.length; i++) render.push({ k: 'caixa', o: _corCaixas[i], z: _corCaixas[i].z });
    for (i = 0; i < _corBeira.length; i++) render.push({ k: 'beira', o: _corBeira[i], z: _corBeira[i].z });
    for (i = 0; i < _corGuardItens.length; i++) render.push({ k: 'guard', o: _corGuardItens[i], z: _corGuardItens[i].z });
    render.sort(function (a, b) { return b.z - a.z; });
    for (i = 0; i < render.length; i++) {
      if (render[i].k === 'zumbi') _corDrawZumbi(ctx, render[i].o);
      else if (render[i].k === 'obst') _corDrawObstaculo(ctx, render[i].o);
      else if (render[i].k === 'moeda') _corDrawMoeda(ctx, render[i].o);
      else if (render[i].k === 'caixa') _corDrawCaixa(ctx, render[i].o);
      else if (render[i].k === 'beira') _corDrawBeira(ctx, render[i].o);
      else if (render[i].k === 'guard') _corDrawGuardItem(ctx, render[i].o);
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

    // v6.2: noite fechada (a lanterna ilumina em volta da mira).
    _corDrawNoite(ctx, W, H);

    // ── Coruja guardiã (na frente dos zumbis, atrás da arma) ──
    _corDrawGuardia(ctx, W, H);

    // ── Arma + mira ──
    _corDrawLados(ctx, W, H);
    _corDrawArma(ctx, W, H);
    _corDrawMira(ctx, W, H);

    // "+1" das moedas pegas: por cima da arma (a moeda some atrás dela).
    if (_corMoedaFx.length) {
      ctx.font = '800 ' + Math.round(H * 0.06) + 'px Syne, sans-serif';
      ctx.textAlign = 'center';
      for (i = 0; i < _corMoedaFx.length; i++) {
        var mf = _corMoedaFx[i], kf = mf.t / 0.6;
        ctx.globalAlpha = 1 - kf * kf;
        ctx.fillStyle = '#ffd740';
        ctx.fillText('+1', mf.x, H * (0.6 - 0.14 * kf));
      }
      ctx.globalAlpha = 1;
    }

    if (_corFlashT > 0) {
      var fx = W * 0.5, fy = H * (0.65 - _corRecuo * 0.03);   // ponta do cano, logo abaixo da mira
      ctx.globalAlpha = _corClamp(_corFlashT / 0.09, 0, 1);
      var rF = H * (_corArma === 'escopeta' ? 0.24 : 0.14);
      var gF = ctx.createRadialGradient(fx, fy, 2, fx, fy, rF);
      gF.addColorStop(0, 'rgba(255,232,150,0.95)'); gF.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = gF; ctx.beginPath(); ctx.arc(fx, fy, rF, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Vinheta escura: virou CSS (.cor-rot::after) — uma camada fixa que a
    // GPU compõe sem redesenhar; aqui no canvas custava uma tela inteira
    // de gradiente por quadro.

    // v6.2: chuva e clarão do relâmpago por cima de tudo.
    _corDrawChuva(ctx, W, H);
    // v6: borda vermelha do perigo (no ritmo do coração) + avisos.
    _corDrawPerigo(ctx, W, H);
    _corDrawAvisos(ctx, W, H);
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
  /* v6 — cenário por ZONA: desenha o da zona anterior e funde o da atual
     por cima (_corZonaFade 0→1). Sem a arte da zona, usa a floresta com a
     tinta de cor da zona por cima. */
  function _corDrawCeuFundo(ctx, W, H, horizonY) {
    if (_corZonaFade < 1 && _corZonaAnt >= 0) {
      _corDrawCenarioZona(ctx, W, H, horizonY, _corZonaAnt);
      ctx.save(); ctx.globalAlpha = _corZonaFade;
      _corDrawCenarioZona(ctx, W, H, horizonY, _corZonaIdx);
      ctx.restore();
    } else _corDrawCenarioZona(ctx, W, H, horizonY, _corZonaIdx);
  }
  function _corDrawCenarioZona(ctx, W, H, horizonY, zi) {
    var z = COR_ZONAS[zi] || COR_ZONAS[0];
    var regZ = zi > 0 ? _corAssetNovo(z.cen) : null;
    if (_corImgPronta(regZ)) { _corDrawCenarioImg(ctx, W, H, horizonY, regZ); return; }
    _corDrawCenarioImg(ctx, W, H, horizonY, null);
    if (z.tinta) { ctx.fillStyle = z.tinta; ctx.fillRect(0, 0, W, H); }
  }
  function _corDrawCenarioImg(ctx, W, H, horizonY, regForcado) {
    var reg = regForcado || _corAsset('cenario-floresta.webp');
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

  // Mato em primeiro plano. Com a arte (mato-frente.webp: faixa larga de
  // capim escuro, repetida na horizontal), duas camadas com balanço da
  // passada e parallax do arraste. Sem a arte, só um degradê escuro na base
  // (os tufos vetoriais antigos destoavam do resto, que é todo em arte).
  var _COR_MATO = 'mato-frente.webp';
  function _corDrawMato(ctx, W, H) {
    var reg = _corAssetNovo(_COR_MATO);
    var swayG = Math.sin(_corPasso * 0.5) * W * 0.008;
    if (_corImgPronta(reg)) {
      if (!_corOpc.leve) _corDrawMatoFaixa(ctx, W, H, reg, H * 0.24, swayG * 0.5, 0.18, 0.75);   // de trás, mais baixa e apagada
      _corDrawMatoFaixa(ctx, W, H, reg, H * 0.30, swayG, 0.32, 1);           // da frente
      return;
    }
    var g = ctx.createLinearGradient(0, H * 0.8, 0, H);
    g.addColorStop(0, 'rgba(5,8,5,0)'); g.addColorStop(1, 'rgba(5,8,5,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.8, W, H * 0.2);
  }
  function _corDrawMatoFaixa(ctx, W, H, reg, alt, sway, parallax, alfa) {
    var larg = alt * reg.w / reg.h;
    var off = ((-_corCamX * W * parallax + sway) % larg + larg) % larg - larg;
    ctx.save(); ctx.globalAlpha = alfa;
    for (var x = off; x < W; x += larg - 1) ctx.drawImage(reg.img, x, H - alt + H * 0.02, larg, alt);
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

    if (zb.surge > 0) {
      ctx.fillStyle = 'rgba(58,44,30,0.85)';
      for (var tq = 0; tq < 6; tq++) {
        var ang = tq / 6 * Math.PI * 2 + zb.fase, rr = wpx * (0.5 + 0.4 * (1 - zb.surge / 0.9));
        ctx.beginPath(); ctx.ellipse(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr * 0.25, wpx * 0.14, wpx * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
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
    var sk = zb.sheetKey || zb.tipo;
    var regSk = _corSheetPronto(sk);
    var ah = hpx * _COR_ALT_MUL * mortScale * (regSk ? regSk.esc : 1) * (def.alt || 1);
    var aw = ah * _corSheetRatio(sk);
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    if (zb.surge > 0 && sk !== 'chao') {
      // v6.2: saindo do chão — recorta na linha do chão e sobe aos poucos
      // (com a arte própria 'chao', a subida já está nos quadros dela).
      var sub = 1 - zb.surge / 0.9;
      ctx.beginPath(); ctx.rect(-aw * 2, -ah * 3, aw * 4, ah * 3); ctx.clip();
      ctx.translate(0, ah * (1 - sub) * 0.95);
    }
    if (mortRot) ctx.rotate(mortRot);
    // 'chao' toca os 9 quadros UMA vez, sincronizado com a subida (0,9 s).
    var tAnim = (sk === 'chao') ? Math.min(0.999, 1 - zb.surge / 0.9) * 818 : _corRelogio + zb.fase;
    var desenhou = _corDrawSheetFrame(ctx, sk, tAnim, -aw / 2, -ah, aw, ah);
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
    var hpxI = 0.5 * _corH * p.s * 0.94;                  // mesma escala do zumbi
    var s = p.s, bob = Math.sin(it.bob) * hpxI * 0.03, sz = hpxI * 0.24;
    ctx.globalAlpha = 0.3 * (0.4 + s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 0.9, sz * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var regMun = _corAsset(_COR_MUNICAO);
    var fonteMun = _corFonte(regMun);
    if (fonteMun) {
      var ah = sz * 2.6, aw = ah * ((regMun.w && regMun.h) ? regMun.w / regMun.h : 1);
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

  // Moeda flutuando logo ACIMA da cabeça do zumbi (mesma escala hpx dele):
  // mais baixa ela ficava escondida atrás da arma justo quando vem na sua
  // direção. Gira no eixo vertical, com sombrinha no chão.
  function _corDrawMoeda(ctx, mo) {
    var sp = _corMoedaSprite();
    if (!sp) return;
    var p = _corProj(mo.z, mo.faixa);
    var hpx = 0.5 * _corH * p.s * 0.94;
    var r = hpx * 0.15, R = r * 1.35;
    var t = _corRelogio / 1000;
    var cy = p.y - hpx * 1.05 + Math.sin(t * 3 + mo.fase) * hpx * 0.03;
    ctx.globalAlpha = 0.3 * (0.4 + p.s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.8, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var esc = 0.3 + 0.7 * Math.abs(Math.cos(t * 2.6 + mo.fase));
    ctx.drawImage(sp, p.x - R * esc, cy - R, 2 * R * esc, 2 * R);
  }

  /* Obstáculo de cenário — ancorado no chão (pé em p.y), igual ao zumbi:
     1ª opção imagem (se o asset carregar), 2ª opção sempre o vetor. Sem
     HP/animação: só entra na composição do render por z, como zumbi/item. */
  function _corDrawObstaculo(ctx, ob) {
    var def = _COR_OBST_TIPOS[ob.tipo];
    var p = _corProj(ob.z, ob.faixa);
    var hpx = 0.5 * _corH * p.s * 0.94;
    var ah = hpx * def.altMul, aw = ah * def.ratio;

    ctx.globalAlpha = 0.35 * (0.4 + p.s); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, aw * 0.52, aw * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    var asset = _corObstAsset(ob.tipo);
    var fonte = _corFonte(asset);
    if (fonte && asset.w && asset.h) {
      var iaw = ah * (asset.w / asset.h);
      ctx.drawImage(fonte, p.x - iaw / 2, p.y - ah, iaw, ah);
      return;
    }
    _corVetorObstaculo(ctx, p.x, p.y, aw, ah, def.vetor || ob.tipo, def);
  }

  // Silhuetas vetoriais simples e legíveis — sem sombreado nem detalhe
  // demais, só o suficiente pra reconhecer o que é de longe e desviar a
  // tempo (mesmo espírito do boneco vetorial do zumbi).
  function _corVetorObstaculo(ctx, cx, footY, w, h, tipo, def) {
    ctx.save(); ctx.translate(cx, footY);
    if (tipo === 'carro') {
      ctx.fillStyle = def.corEsc;
      ctx.fillRect(-w * 0.5, -h * 0.55, w, h * 0.55);
      ctx.fillStyle = def.cor;
      ctx.beginPath();
      ctx.moveTo(-w * 0.32, -h * 0.55); ctx.lineTo(-w * 0.20, -h);
      ctx.lineTo(w * 0.22, -h); ctx.lineTo(w * 0.34, -h * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = def.corVid;
      ctx.beginPath();
      ctx.moveTo(-w * 0.14, -h * 0.62); ctx.lineTo(-w * 0.04, -h * 0.90);
      ctx.lineTo(w * 0.14, -h * 0.90); ctx.lineTo(w * 0.22, -h * 0.62);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = def.corFarol;
      ctx.beginPath(); ctx.arc(-w * 0.44, -h * 0.24, w * 0.05, 0, Math.PI * 2); ctx.fill();
    } else if (tipo === 'cerca') {
      ctx.strokeStyle = def.corEsc; ctx.lineWidth = Math.max(2, h * 0.09);
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0); ctx.lineTo(-w * 0.5, -h);
      ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.94);
      ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.5, -h);
      ctx.stroke();
      ctx.strokeStyle = def.cor; ctx.lineWidth = Math.max(2, h * 0.15);
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -h * 0.68); ctx.lineTo(w * 0.5, -h * 0.32);
      ctx.moveTo(-w * 0.5, -h * 0.32); ctx.lineTo(w * 0.5, -h * 0.68);
      ctx.stroke();
    } else if (tipo === 'entulho') {
      ctx.fillStyle = def.corEsc;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0); ctx.lineTo(-w * 0.18, -h * 0.7);
      ctx.lineTo(w * 0.08, -h * 0.5); ctx.lineTo(w * 0.5, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = def.cor;
      ctx.beginPath();
      ctx.moveTo(-w * 0.30, 0); ctx.lineTo(0, -h);
      ctx.lineTo(w * 0.35, -h * 0.55); ctx.lineTo(w * 0.15, 0);
      ctx.closePath(); ctx.fill();
    } else { // pedra
      ctx.fillStyle = def.corEsc;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, 0); ctx.lineTo(-w * 0.30, -h * 0.8);
      ctx.lineTo(w * 0.15, -h); ctx.lineTo(w * 0.5, -h * 0.35); ctx.lineTo(w * 0.42, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = def.cor;
      ctx.beginPath();
      ctx.moveTo(-w * 0.30, -h * 0.15); ctx.lineTo(-w * 0.10, -h * 0.75);
      ctx.lineTo(w * 0.20, -h * 0.55); ctx.lineTo(0, 0);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function _corDrawArma(ctx, W, H) {
    var kick = _corRecuo * H * 0.05;
    // Arma balança em contrafase leve com a passada (sincronizada ao bob).
    var swayX = Math.sin(_corPasso * 0.5) * W * 0.012;
    var swayY = Math.abs(Math.sin(_corPasso)) * H * 0.016;
    var baseY = H + kick + swayY;
    var cx = W * 0.5 + swayX;

    // v6: arma especial — arte própria; sem ela, o lançador tingido.
    var asset = _corAsset(_COR_ARMA), fonteArma = null, filtroArma = '';
    if (_corArma) {
      var regEsp = _corAssetNovo(_COR_ARMAS[_corArma].arte);
      if (_corImgPronta(regEsp)) { asset = regEsp; fonteArma = regEsp.img; }
      else filtroArma = _COR_ARMAS[_corArma].filtro;
    }
    if (!fonteArma) fonteArma = _corFonte(asset);
    if (fonteArma) {
      // Arma FPS empunhada na base. Ancoramos pela largura pra as asas
      // transbordarem, MAS com TETO de altura pra não cobrir a tela em
      // telas landscape largas (celular deitado tem proporção ~2.2:1, então
      // largura×105% daria altura maior que a tela). O teto garante que a
      // arma ocupe no máx ~52% da altura, deixando o campo de visão livre.
      // v3 (arte vista por trás, cano pra dentro da tela): arma menor (teto
      // 40% da altura) e afundada, CENTRALIZADA — a ponta do cano fica logo
      // abaixo da mira, apontando pra ela (deslocada pro lado, a mira
      // parecia solta, longe do cano).
      var ratio = (asset.h && asset.w) ? (asset.w / asset.h) : 2.2;  // w/h
      var aw = W * 1.05;
      var ah = aw / ratio;
      var ahMax = H * 0.40;
      if (ah > ahMax) { ah = ahMax; aw = ah * ratio; }
      var filtroAntes = ctx.filter;
      if (filtroArma) ctx.filter = filtroArma;
      ctx.drawImage(fonteArma, cx - aw / 2, baseY + H * 0.04 - ah, aw, ah);
      if (filtroArma) ctx.filter = filtroAntes || 'none';
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
    if (_corEstado === 'agarrao') {
      if (!_corLast) _corLast = ts;
      var dta = Math.min(0.05, (ts - _corLast) / 1000); _corLast = ts;
      _corRelogio = ts;
      _corAgarraoT += dta;
      _corDrawAgarrao();
      if (_corAgarraoT >= _COR_AGARRAO_DUR) { _corRAF = 0; _corGameOver(true); return; }
      _corRAF = requestAnimationFrame(_corLoop);
      return;
    }
    if (_corEstado !== 'jogando') return;
    if (!_corLast) _corLast = ts;
    var dt = (ts - _corLast) / 1000; _corLast = ts;
    _corFpsMedir(dt);
    if (dt > 0.05) dt = 0.05;
    _corRelogio = ts;                 // relógio p/ animação dos webp
    _corPadPoll(dt);                  // controle (Gamepad API) — não tem eventos de botão
    if (_corPausado) return;          // Start acabou de pausar: o loop para aqui
    _corUpdate(dt);
    if (_corEstado === 'jogando') { _corDraw(); _corRAF = requestAnimationFrame(_corLoop); }
    else if (_corEstado === 'agarrao') _corRAF = requestAnimationFrame(_corLoop);
  }

  /* ══════════════════════════════════════════════════════════════
     GAME OVER
  ══════════════════════════════════════════════════════════════ */
  function _corGameOver(doAgarrao) {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    _corEstado = 'fim';
    _corMenuPartida(false);
    _corBgmParar();
    _corChuvaSomParar();
    var score = Math.floor(_corDist), rec = _corRec(), recorde = score > rec;
    if (recorde) _corRecSet(score);
    if (!doAgarrao) _corDraw();   // do agarrão, fica o último quadro dele por trás
    _corSomMorte();
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(recorde);
    if (window.AngatubaGames) window.AngatubaGames.rankSubmeter('corrida', score);

    // Moedas da Loja da Coruja: as pegas na pista, sem teto por partida
    // + stats locais (partidas/segundos/recorde), no mesmo padrão do Voo.
    var moedasGanhas = 0;
    var segundos = Math.max(0, Math.round((Date.now() - _corInicioMs - _corPausaTotalMs) / 1000));
    if (window.AngatubaGames) {
      moedasGanhas = _corCreditarMoedas();
      _corMissoesRender('cor-missoes-fim', _corMissoesFechar());
      if (typeof window.AngatubaGames.statsRegistrarPartida === 'function') {
        window.AngatubaGames.statsRegistrarPartida('corrida', { segundos: segundos, score: score });
      }
    }

    var owlEl = document.getElementById('cor-fim-owl');
    var titEl = document.getElementById('cor-fim-titulo');
    var ptsEl = document.getElementById('cor-fim-pontos');
    var msgEl = document.getElementById('cor-fim-msg');
    var moedasEl = document.getElementById('cor-fim-moedas');
    if (moedasEl) {
      if (moedasGanhas > 0) { moedasEl.textContent = '+' + moedasGanhas + ' 🪙'; moedasEl.style.display = ''; }
      else moedasEl.style.display = 'none';
    }
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
    if (_corEstado !== 'jogando' || _corPausado) return;
    if (_corControle() === 'lados') {
      var ts = e.changedTouches || [e];
      for (var i = 0; i < ts.length; i++) {
        var lado = _corLadoDe(ts[i].clientX, ts[i].clientY);
        if (lado) _corLados[ts[i].identifier != null ? ts[i].identifier : 'm'] = lado;
        else _corAtirar();
      }
      if (e.cancelable) e.preventDefault();
      return;
    }
    _corDrag = true;
    _corLast2 = _corXY(e); _corDownXY = _corLast2; _corDownT = (e.timeStamp || Date.now()); _corMoveu = false;
    if (e.cancelable) e.preventDefault();
  }
  function _corPointerMove(e) {
    if (_corControle() === 'lados') {
      var ts = e.changedTouches || [e];
      for (var i = 0; i < ts.length; i++) {
        var id = ts[i].identifier != null ? ts[i].identifier : 'm';
        if (!(id in _corLados)) continue;
        var lado = _corLadoDe(ts[i].clientX, ts[i].clientY);
        if (lado) _corLados[id] = lado; else delete _corLados[id];
      }
      if (e.cancelable && e.changedTouches) e.preventDefault();
      return;
    }
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
    var escala = COR_SENS[_corOpc.sens] / (_corW * 0.5);
    _corCamX = _corClamp(_corCamX + mov * escala, -_COR_CAM_LIM, _COR_CAM_LIM);
    _corCamVX = mov;
    if (e.cancelable) e.preventDefault();
  }
  function _corPointerUp(e) {
    var ts = (e && e.changedTouches) || [e || {}];
    for (var i = 0; i < ts.length; i++) delete _corLados[ts[i].identifier != null ? ts[i].identifier : 'm'];
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
    if (_corEstado !== 'jogando' || _corPausado) return;
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
     CONTROLE (Gamepad API) — mesmo padrão do Ritmo (ritmo.js)
     Lido a cada frame no _corLoop (a Gamepad API não tem eventos de
     botão). Soma com toque e teclado: mexe no mesmo _corCamX que as
     setas e chama o mesmo _corAtirar.
     Mapa fixo, layout "standard" (Ipega 9076 no modo Android/X-input):
       ← (14) / analógico esquerdo X < -zona ... desvia pra esquerda
       → (15) / analógico esquerdo X > +zona ... desvia pra direita
       A (0) / RT (7) / ↑ (12) ................. atira (1 tiro por aperto)
       Start (9) ............................... pausa / continua
     Fora da partida (Começar, fim, pausa) quem lê o controle é o
     _corNavLoop (navegação nos menus — ver abaixo).
     Escala: a MESMA do teclado — cada repetição da seta anda 0.08 e o
     teclado repete ~30x/s com a tecla segurada, então D-pad segurado =
     0.08 × 30 por segundo; o analógico é proporcional (0..1 depois da
     zona morta). Sem conversão de rotação: o motor já pensa em paisagem.
     Esse é o mapa PADRÃO: em "Configurar botões" (tela inicial, ou
     Select nela) a pessoa escolhe um botão por ação — ver COR_PAD_ACOES.
  ══════════════════════════════════════════════════════════════ */
  var COR_PAD_ZONA = 0.25;        // deadzone do analógico (sem drift)
  var COR_PAD_VEL = 0.08 * 30;    // = seta do teclado segurada (por segundo)
  var COR_PAD_START = 9;
  var _corPadAntes = {};          // comando → estava apertado no frame anterior (borda)
  var _corPadUsado = false;

  function _corPadLista() {
    var out = [];
    try {
      var l = navigator.getGamepads ? navigator.getGamepads() : [];
      for (var i = 0; i < l.length; i++) if (l[i] && l[i].connected !== false) out.push(l[i]);
    } catch (e) {}
    return out;
  }
  function _corBotaoApertado(gp, b) {
    var x = gp.buttons && gp.buttons[b];
    return !!x && (x.pressed || x.value > 0.5);
  }

  /* ── Configurar botões (igual ao "Configurar botões" do Ritmo) ──────
     Um botão por ação, na ordem de COR_PAD_ACOES, salvo neste aparelho
     (COR_PAD_KEY). Com mapa salvo, ele manda; sem, vale o "padrao" de
     cada ação. O analógico continua valendo sempre e o Start fica de
     fora (é sempre pausa). Abre pela linha "🎮 Controle conectado" da
     tela inicial (ou Select nela); durante a configuração, Start cancela.
  ─────────────────────────────────────────────────────────────────── */
  var COR_PAD_ACOES = [
    { k: 'esq', nome: 'Esquerda', padrao: [14] },
    { k: 'dir', nome: 'Direita', padrao: [15] },
    { k: 'tiro', nome: 'Atirar', padrao: [0, 7, 12] }
  ];
  var COR_PAD_KEY = 'angatuba_pad_corrida';
  var COR_PAD_NOMES = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Select', 9: 'Start', 10: 'L3', 11: 'R3', 12: '↑', 13: '↓', 14: '←', 15: '→' };
  var _corPadCfg = _corPadCfgLer();   // { ação: botão } ou null (= padrão)
  var _corPadCal = null;              // configuração aberta: { botoes, antes, raf, primeiro, el }

  function _corPadCfgLer() {
    try {
      var c = JSON.parse(localStorage.getItem(COR_PAD_KEY) || 'null');
      if (!c || typeof c !== 'object') return null;
      for (var i = 0; i < COR_PAD_ACOES.length; i++) if (typeof c[COR_PAD_ACOES[i].k] !== 'number') return null;
      return c;
    } catch (e) { return null; }
  }
  // Botões que valem pra ação a agora (personalizado tem prioridade).
  function _corPadBotoes(a) {
    if (_corPadCfg) return [_corPadCfg[a]];
    for (var i = 0; i < COR_PAD_ACOES.length; i++) if (COR_PAD_ACOES[i].k === a) return COR_PAD_ACOES[i].padrao;
    return [];
  }
  function _corPadAlgum(gp, a) {
    var l = _corPadBotoes(a);
    for (var i = 0; i < l.length; i++) if (_corBotaoApertado(gp, l[i])) return true;
    return false;
  }

  function _corPadCalAbrir() {
    if (_corPadCal) return;
    var tela = document.getElementById('jogo-corrida');
    if (!tela) return;
    var ov = document.createElement('div');
    ov.className = 'jpad-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Configurar controle');
    ov.innerHTML = '<div class="jpad-caixa"><div class="jpad-tit">Configurar controle · Corrida</div>' +
      '<div class="jpad-msg"></div><div class="jpad-slots"></div>' +
      '<div class="jpad-rodape">O analógico continua valendo. Start cancela.</div>' +
      '<button type="button" class="jpad-link">Cancelar</button></div>';
    ov.querySelector('.jpad-link').addEventListener('click', _corPadCalFechar);
    tela.appendChild(ov);
    _corPadCal = { botoes: [], antes: {}, raf: 0, primeiro: true, el: ov };
    _corPadCalRender();
    _corPadCal.raf = requestAnimationFrame(_corPadCalPoll);
  }
  function _corPadCalFechar() {
    var c = _corPadCal;
    _corPadCal = null;
    if (c) {
      if (c.raf) cancelAnimationFrame(c.raf);
      if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
    }
    _corPadLinhaAtualizar();
  }
  function _corPadCalRender() {
    var c = _corPadCal;
    if (!c) return;
    var A = COR_PAD_ACOES, n = c.botoes.length, h = '';
    c.el.querySelector('.jpad-msg').innerHTML = n < A.length
      ? 'Aperte o botão pra <b>' + A[n].nome + '</b>.'
      : '✔ Pronto! Botões salvos neste aparelho.';
    for (var i = 0; i < A.length; i++) {
      var b = c.botoes[i];
      h += '<span class="jpad-slot' + (i === n ? ' jpad-slot-agora' : '') + (b !== undefined ? ' jpad-slot-ok' : '') + '">' +
           A[i].nome + '<b>' + (b !== undefined ? (COR_PAD_NOMES[b] || ('B' + b)) : '?') + '</b></span>';
    }
    c.el.querySelector('.jpad-slots').innerHTML = h;
  }
  function _corPadCalPoll() {
    var c = _corPadCal;
    if (!c) return;
    c.raf = 0;
    var A = COR_PAD_ACOES, pads = _corPadLista();
    for (var i = 0; i < pads.length; i++) {
      var gp = pads[i];
      for (var b = 0; b < (gp.buttons || []).length; b++) {
        var chave = gp.index + '_' + b, ap = _corBotaoApertado(gp, b);
        // no 1º frame só registra o que já estava apertado (não conta)
        if (ap && !c.antes[chave] && !c.primeiro && c.botoes.length < A.length) {
          if (b === COR_PAD_START) { _corPadCalFechar(); return; }
          if (c.botoes.indexOf(b) === -1) {
            c.botoes.push(b);
            if (c.botoes.length === A.length) {
              var cfg = {};
              for (var j = 0; j < A.length; j++) cfg[A[j].k] = c.botoes[j];
              _corPadCfg = cfg;
              try { localStorage.setItem(COR_PAD_KEY, JSON.stringify(cfg)); } catch (e) {}
              setTimeout(function () { if (_corPadCal === c) _corPadCalFechar(); }, 900);
            }
            _corPadCalRender();
          }
        }
        c.antes[chave] = ap;
      }
    }
    c.primeiro = false;
    if (c.botoes.length < A.length) c.raf = requestAnimationFrame(_corPadCalPoll);
  }
  function _corPadUsarPadrao() {
    _corPadCfg = null;
    try { localStorage.removeItem(COR_PAD_KEY); } catch (e) {}
    _corPadLinhaAtualizar();
  }
  // Linha "🎮 Controle conectado · Configurar botões" na tela inicial
  // (criada na 1ª vez, pra não mexer no HTML; só aparece com controle).
  function _corPadLinhaAtualizar() {
    var pads = _corPadLista(), cx = document.getElementById('cor-inicio');
    if (!cx) return;
    var el = cx.querySelector('.jpad-linha');
    if (!el) {
      if (!pads.length) return;
      el = document.createElement('div');
      el.className = 'jpad-linha';
      el.innerHTML = '<span>🎮 <span class="jpad-txt">Controle conectado</span></span>' +
        '<button type="button" class="jpad-btn" data-jpad="cfg">Configurar botões</button>' +
        '<button type="button" class="jpad-btn" data-jpad="padrao">Usar padrão</button>';
      el.querySelector('[data-jpad="cfg"]').addEventListener('click', function (ev) { ev.currentTarget.blur(); _corPadCalAbrir(); });
      el.querySelector('[data-jpad="padrao"]').addEventListener('click', function (ev) { ev.currentTarget.blur(); _corPadUsarPadrao(); });
      cx.insertBefore(el, cx.querySelector('.cor-play'));
    }
    el.style.display = pads.length ? '' : 'none';
    el.querySelector('[data-jpad="padrao"]').style.display = _corPadCfg ? '' : 'none';
    var p = pads[0];
    el.querySelector('.jpad-txt').textContent = 'Controle conectado' +
      (_corPadCfg ? ' · botões personalizados' : (p && p.mapping !== 'standard' ? ' — configure os botões' : ''));
  }
  // Estado lógico juntando todos os controles (null = nenhum conectado).
  function _corPadLer() {
    var pads = _corPadLista();
    if (!pads.length) return null;
    var st = { x: 0, tiro: false, start: false };
    for (var i = 0; i < pads.length; i++) {
      var gp = pads[i], ax = (gp.axes && gp.axes[0]) || 0;
      var d = (_corPadAlgum(gp, 'dir') ? 1 : 0) - (_corPadAlgum(gp, 'esq') ? 1 : 0);
      if (d) st.x = d;
      else if (!st.x && Math.abs(ax) > COR_PAD_ZONA) {
        st.x = (ax < 0 ? -1 : 1) * Math.min(1, (Math.abs(ax) - COR_PAD_ZONA) / (1 - COR_PAD_ZONA));
      }
      if (_corPadAlgum(gp, 'tiro')) st.tiro = true;
      if (_corBotaoApertado(gp, COR_PAD_START)) st.start = true;
    }
    return st;
  }
  // O que já está apertado ao começar a corrida não vira tiro/pausa no 1º frame.
  function _corPadSnapshot() { _corPadAntes = _corPadLer() || {}; }

  function _corPadPoll(dt) {
    var st = _corPadLer();
    if (!st) return;
    var antes = _corPadAntes;
    _corPadAntes = st;
    if (st.start && !antes.start) {
      var M = _corMenu();
      if (M && M.abrir) { M.abrir('jogo-corrida'); return; }
    }
    if (st.x) {
      _corPadUsado = true;
      _corCamX = _corClamp(_corCamX + st.x * COR_PAD_VEL * dt, -_COR_CAM_LIM, _COR_CAM_LIM);
    }
    if (st.tiro && !antes.tiro) { _corPadUsado = true; _corAudioDestravar(); _corAtirar(); }
  }

  /* ══════════════════════════════════════════════════════════════
     NAVEGAÇÃO COM O CONTROLE (fora da partida) — mesmo esquema do
     _rtNavLoop do Ritmo. Um laço leve (_corNavLoop) roda enquanto a
     tela da Corrida está aberta; cada tela é um "contexto":
       inicio  Ⓐ/Start "Começar" · Ⓑ volta aos jogos
       fim     ↑↓ botão · Ⓐ/Start confirma ("Correr de novo") · Ⓑ volta aos jogos
       pausa   ↑↓ opção · Ⓐ confirma · Ⓑ/Start continua
       jogo    nada — a corrida é do _corPadPoll
     ↑↓←→ = D-pad ou analógico; segurar repete. O foco anda pro botão
     mais próximo naquela direção e aparece com .cor-foco. Na troca de
     contexto, o que já estava apertado é ignorado até soltar — e, fora
     da partida, o _corPadAntes acompanha o controle (o Ⓐ de "Começar"
     não sai atirando).
  ══════════════════════════════════════════════════════════════ */
  var _corNav = { raf: 0, ctx: '', antes: {}, desde: {}, rep: {}, foco: null };

  function _corNavIniciar() { if (!_corNav.raf) _corNav.raf = requestAnimationFrame(_corNavLoop); }
  function _corNavCtx() {
    var tela = document.getElementById('jogo-corrida');
    if (!tela || tela.style.display === 'none' || !_corCanvas) return null;
    if (_corPadCal) return 'cal';                // configurando botões: é com o _corPadCalPoll
    if (_corEstado === 'agarrao') return 'jogo';
    if (_corEstado === 'jogando') {
      var M = _corMenu();
      return (M && M.aberto && M.aberto('jogo-corrida')) ? 'pausa' : 'jogo';
    }
    return _corEstado === 'fim' ? 'fim' : 'inicio';
  }
  // Estado "lógico" de cada comando juntando todos os controles + analógico.
  function _corNavLer(pads) {
    var st = {};
    for (var i = 0; i < pads.length; i++) {
      var gp = pads[i], ax = gp.axes || [];
      if (_corBotaoApertado(gp, 12) || (ax[1] || 0) < -0.6) st.cima = true;
      if (_corBotaoApertado(gp, 13) || (ax[1] || 0) > 0.6) st.baixo = true;
      if (_corBotaoApertado(gp, 14) || (ax[0] || 0) < -0.6) st.esq = true;
      if (_corBotaoApertado(gp, 15) || (ax[0] || 0) > 0.6) st.dir = true;
      if (_corBotaoApertado(gp, 0)) st.a = true;
      if (_corBotaoApertado(gp, 1)) st.b = true;
      if (_corBotaoApertado(gp, 8)) st.select = true;
      if (_corBotaoApertado(gp, COR_PAD_START)) st.start = true;
    }
    return st;
  }
  // Botões navegáveis do contexto (só os visíveis e habilitados).
  function _corNavItens(ctx) {
    var cx = ctx === 'pausa' ? document.querySelector('#jogo-corrida .jm-overlay .jm-caixa')
           : document.getElementById(ctx === 'fim' ? 'cor-fim' : 'cor-inicio');
    if (!cx) return [];
    return Array.prototype.slice.call(cx.querySelectorAll('button')).filter(function (b) {
      return b.offsetParent !== null && !b.disabled;
    });
  }
  // Foco inicial de cada tela: o botão "principal".
  function _corNavPadrao(ctx, l) {
    var sel = ctx === 'pausa' ? '[data-jm="continuar"]' : '.cor-play';
    for (var i = 0; i < l.length; i++) if (l[i].matches(sel)) return l[i];
    return l[0] || null;
  }
  // Próximo botão na direção n. Primeiro os "alinhados" (mesma linha pra
  // ←→, mesma coluna pra ↑↓), o mais perto ganha. ←→ sem ninguém na linha
  // fica parado (não pula na diagonal pra outra linha da grade); ↑↓ sem
  // ninguém na coluna vai pro mais perto, penalizando o desvio lateral.
  function _corNavMover(l, el, n) {
    var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var horiz = n === 'dir' || n === 'esq', melhor = null, nota = Infinity, alinhado = false;
    for (var i = 0; i < l.length; i++) {
      if (l[i] === el) continue;
      var q = l[i].getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      var frente = n === 'dir' ? dx : n === 'esq' ? -dx : n === 'baixo' ? dy : -dy;
      if (frente <= 4) continue;
      var al = horiz ? (q.top < r.bottom && q.bottom > r.top) : (q.left < r.right && q.right > r.left);
      if (horiz && !al) continue;
      var v = al ? frente : frente + (horiz ? Math.abs(dy) : Math.abs(dx)) * 2;
      if ((al && !alinhado) || (al === alinhado && v < nota)) { nota = v; melhor = l[i]; alinhado = al; }
    }
    return melhor || el;
  }
  function _corNavFocoLimpar() {
    var l = document.querySelectorAll('#jogo-corrida .cor-foco');
    for (var i = 0; i < l.length; i++) l[i].classList.remove('cor-foco');
  }
  function _corNavFocar(el) {
    _corNavFocoLimpar();
    _corNav.foco = el;
    if (!el) return;
    el.classList.add('cor-foco');
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }

  function _corNavLoop() {
    _corNav.raf = 0;
    var ctx = _corNavCtx();
    if (!ctx) { _corNavFocoLimpar(); _corNav.ctx = ''; _corNav.foco = null; return; }   // tela fechada: o laço para (preparar religa)
    var pads = _corPadLista();
    if (!pads.length) {
      if (_corNav.ctx) { _corNavFocoLimpar(); _corNav.ctx = ''; _corNav.foco = null; }
      _corNav.raf = requestAnimationFrame(_corNavLoop);
      return;
    }
    var st = _corNavLer(pads), agora = performance.now();
    if (ctx !== _corNav.ctx) {
      // trocou de tela: o que já está apertado não conta até soltar
      _corNav.antes = {}; for (var k0 in st) _corNav.antes[k0] = true;
      _corNav.ctx = ctx; _corNav.foco = null;
      _corNavFocoLimpar();
    }
    if (ctx === 'jogo' || ctx === 'cal') {
      _corNav.antes = {}; for (var k1 in st) _corNav.antes[k1] = true;
    } else {
      var l = _corNavItens(ctx), ev = [];
      if (!_corNav.foco || l.indexOf(_corNav.foco) === -1) _corNavFocar(_corNavPadrao(ctx, l));
      ['cima', 'baixo', 'esq', 'dir', 'a', 'b', 'start', 'select'].forEach(function (n) {
        var ap = !!st[n], seta = n === 'cima' || n === 'baixo' || n === 'esq' || n === 'dir';
        if (ap && !_corNav.antes[n]) { ev.push(n); _corNav.desde[n] = agora; _corNav.rep[n] = agora; }
        else if (ap && seta && agora - _corNav.desde[n] > 420 && agora - _corNav.rep[n] > 120) { ev.push(n); _corNav.rep[n] = agora; }   // segurar rola
        _corNav.antes[n] = ap;
      });
      for (var i = 0; i < ev.length; i++) {
        _corNavAcao(ctx, ev[i], l);
        if (ev[i] !== 'cima' && ev[i] !== 'baixo' && ev[i] !== 'esq' && ev[i] !== 'dir') break;   // trocou de tela: o resto do frame não vale
      }
    }
    if (ctx !== 'jogo') _corPadAntes = _corPadLer() || {};
    _corNav.raf = requestAnimationFrame(_corNavLoop);
  }

  function _corNavAcao(ctx, n, l) {
    if (n === 'select') { if (ctx === 'inicio') _corPadCalAbrir(); return; }   // igual ao Select do Ritmo
    if (n === 'cima' || n === 'baixo' || n === 'esq' || n === 'dir') {
      if (_corNav.foco) _corNavFocar(_corNavMover(l, _corNav.foco, n));
      return;
    }
    if (ctx === 'pausa' && (n === 'b' || n === 'start')) {
      var M = _corMenu();
      if (M && M.fechar) M.fechar('jogo-corrida', true);
      return;
    }
    if (n === 'a' || n === 'start') {
      var alvo = _corNav.foco;
      if (alvo) alvo.click();      // o foco fica nele; se a tela mudar, o loop refaz
      return;
    }
    if (n === 'b' && typeof window._voltarAoMenu === 'function') window._voltarAoMenu();
  }

  // 🎮 no HUD quando tem controle conectado (criado na 1ª vez, pra não
  // precisar mexer no index.html).
  function _corPadIndicador() {
    _corPadLinhaAtualizar();
    var tem = _corPadLista().length > 0;
    var el = document.getElementById('cor-pad');
    if (!el && tem) {
      var hud = document.querySelector('#jogo-corrida .cor-hud');
      if (!hud) return;
      el = document.createElement('span');
      el.id = 'cor-pad';
      el.title = 'Controle conectado';
      el.setAttribute('aria-label', 'Controle conectado');
      el.textContent = '🎮';
      el.style.cssText = 'align-self:center;font-size:16px;opacity:.85;line-height:1;';
      hud.appendChild(el);
    }
    if (el) el.style.display = tem ? '' : 'none';
  }
  window.addEventListener('gamepadconnected', function () { _corPadIndicador(); });
  window.addEventListener('gamepaddisconnected', function () {
    // Caiu no meio da corrida: o movimento já para sozinho (sem controle
    // não tem o que ler), esquece os botões e, se estava sendo usado, pausa.
    _corPadAntes = _corPadLer() || {};
    if (_corEstado === 'jogando' && !_corPausado && _corPadUsado) {
      var M = _corMenu();
      if (M && M.abrir) M.abrir('jogo-corrida');
    }
    if (!_corPadLista().length) _corPadUsado = false;
    _corPadIndicador();
  });

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
    _corArma = ''; _corZonaIdx = 0; _corZonaAnt = -1; _corZonaFade = 1;
    _corAtualizarHUD(true);
    // Pré-carrega os spritesheets dos zumbis (imagens únicas; o fallback
    // vetor cobre enquanto não chegam).
    _corSheet('normal');
    _corSheet('normalB');
    _corSheet('rapido');
    _corSheet('forte');
    _corAsset('cenario-floresta.webp');   // dispara o carregamento do fundo cedo
    for (var oi = 0; oi < _COR_OBST_NOMES.length; oi++) if (!_COR_OBST_TIPOS[_COR_OBST_NOMES[oi]].soArte) _corAsset('obst-' + _COR_OBST_NOMES[oi] + '.webp');
    _corMissoesCarregar();
    _corMissoesRender('cor-missoes-ini', _corMissoesItensAtivas());
    _corTiltBotao();
    if (_corTilt.on) _corTiltOuvir();
    _corCarregarSpritesFx();
    _corPrepararFontes();
    _corBgmPreparar();   // cria/pré-carrega a música de fundo (play só em _corComecar)
    // Pede ao sistema pra girar pra landscape (APK/instalado com manifest
    // "any"). No navegador comum é recusado e caímos na rotação CSS.
    _corTravarLandscape();
    _corRegistrarMenu();
    _corMenuPartida(false);
    _corMostrarOverlay('inicio');
    _corAplicarOrientacaoRepetido();
    _corDrawIdle();
    _corPadIndicador();
    _corNavIniciar();
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
      for (var tipo in _COR_SHEETS) {
        if (!_COR_SHEETS.hasOwnProperty(tipo)) continue;
        var reg = _corSheetPronto(tipo);
        if (reg) _corFonte(reg.sheet); else faltou = true;
      }
      _corFonte(_corAsset(_COR_ARMA));
      _corFonte(_corAsset(_COR_MUNICAO));
      for (var oi2 = 0; oi2 < _COR_OBST_NOMES.length; oi2++) if (!_COR_OBST_TIPOS[_COR_OBST_NOMES[oi2]].soArte) _corFonte(_corAsset('obst-' + _COR_OBST_NOMES[oi2] + '.webp'));
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
    _corArmaIniAplicar();
    _corMelhoriasFechar();
    _corInicioMs = Date.now(); _corPausaTotalMs = 0; _corPausaInicioMs = 0;
    _corEstado = 'jogando'; _corLast = 0;
    _corMenuPartida(true);
    _corPadSnapshot();
    _corPadIndicador();
    if (_corRAF) cancelAnimationFrame(_corRAF);
    _corRAF = requestAnimationFrame(_corLoop);
    // Clique no botão = gesto do usuário → pode iniciar áudio de verdade.
    _corBgmMudoAntes = _corSomLigado();
    _corBgmTocar();
  }

  function _corParar() {
    if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
    // Saiu no meio da corrida: as moedas já pegas não se perdem.
    if (_corEstado === 'jogando' || _corEstado === 'agarrao') {
      _corCreditarMoedas(); _corMissoesFechar(); _corEstado = 'inicio';
    }
    _corDrag = false;
    _corBgmParar();
    _corChuvaSomParar();
    _corDestravarOrientacao();     // volta a orientação do sistema ao normal
    // Fix A2.22: cancela a cascata de remedição pós-rotação se ainda tiver
    // algum passo pendente — mesma correção do Tanques.
    _corResizeTimers.forEach(clearTimeout);
    _corResizeTimers.length = 0;
    _corMenuPartida(false);
  }

  /* ── Menu unificado (hub.js → AngatubaGames.menu) ──────────────
     ⏸ no canto durante a corrida: para o loop, solta o arraste e pausa a
     música SEM rebobinar; ao continuar o dt recomeça do zero e a música
     volta de onde parou (se o som estiver ligado — o botão de som do
     próprio menu pode ter mudado isso no meio da pausa). */
  function _corMenu() {
    var G = window.AngatubaGames;
    return (G && G.menu) || null;
  }
  function _corMenuPartida(ativa) {
    _corPausado = false;
    var M = _corMenu();
    if (M) M.partida('jogo-corrida', ativa);
  }
  function _corRegistrarMenu() {
    var M = _corMenu();
    if (!M) return;
    _corMenuCfg = {
      opcoes: _corOpcoesMenu,
      extra: { rotulo: 'Recomeçar corrida', acao: _corRecomecar },
      pausar: function () {
        _corPausado = true;
        _corLadosSoltar();
        _corPausaInicioMs = Date.now();
        if (_corRAF) { cancelAnimationFrame(_corRAF); _corRAF = 0; }
        _corDrag = false; _corCamVX = 0;
        _corBgmParar_semRebobinar();
        _corChuvaSomParar();
      },
      continuar: function () {
        if (!_corPausado) return;
        _corPausado = false;
        if (_corPausaInicioMs) { _corPausaTotalMs += Date.now() - _corPausaInicioMs; _corPausaInicioMs = 0; }
        if (_corEstado !== 'jogando') return;
        _corTilt.base = null;          // o "reto" volta a ser como a pessoa está segurando agora
        _corBgmMudoAntes = _corSomLigado();
        _corBgmTocar();
        if (!_corRAF) {
          _corLast = 0;
          _corRAF = requestAnimationFrame(_corLoop);
        }
      }
    };
    M.registrar('jogo-corrida', _corMenuCfg);
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
    out.arma = estat(_COR_ARMA);
    out.municao = estat(_COR_MUNICAO);
    // cenario-floresta.webp é imagem opaca (não sprite) — sem _corFonte()
    // aqui, senão o diag dispararia o flood-fill de remoção de fundo nela.
    (function () {
      var a = _corAsset('cenario-floresta.webp');
      out.cenario = { carregou: a.ok, imagem: a.ok ? (a.w + '×' + a.h) : null };
    })();
    out.audio = _corAC ? _corAC.state : 'não criado';
    out.bgm = { existe: !!_corBgm, ok: _corBgmOk, tocando: !!(_corBgm && !_corBgm.paused), volume: _corBgm ? _corBgm.volume : null };
    return out;
  }

  /* ── Exposição pública ────────────────────────────────────────── */
  window._corComecar = _corComecar;
  window._corMelhoriasAbrir = _corMelhoriasAbrir;
  window._corMelhoriasFechar = _corMelhoriasFechar;
  window._corMelhComprar = _corMelhComprar;
  window._corArmaIniEscolher = _corArmaIniEscolher;
  window._corTiltAlternar = _corTiltAlternar;
  window._corControleCiclar = _corControleCiclar;
  window._corTiltCalFim = _corTiltCalFim;
  window.CorridaGame = { preparar: _corPreparar, comecar: _corComecar, parar: _corParar, diag: _corDiag };
})();