/* ═══════════════════════════════════════════════════════════════
   VOO DA CORUJA — módulo de jogo (lazy-loaded)
   Carregado sob demanda por /jogos/ quando o usuário abre o jogo.
   Comunica-se com o app APENAS via window.AngatubaGames (a ponte).
   Expõe window.VooGame = { preparar, comecar, parar } e mantém
   window._vooComecar pro onclick inline do botão no HTML.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     VOO DA CORUJA — mini game estilo Doodle Jump (canvas)
     — A coruja pula sozinha ao bater nas plataformas; o jogador
       arrasta o dedo pra mover na horizontal (controle relativo).
     — Pontuação = altura subida (independente de resolução: tudo
       normalizado por H, a altura lógica do canvas).
     — Integra no hub como os outros: _vooPreparar (ao abrir a tela),
       _vooComecar (botão), _vooParar (ao sair). Rank via
       rankSubmeter('voo', score) + rankFimDeJogo no fim.
  ══════════════════════════════════════════════════════════════ */
  var _VOO_OWL_SRC = '/webp/owl-flying.webp';
  var _vooImg = null, _vooImgOk = false, _vooImgRatio = 1;   // ratio = h/w

  /* ══════════════════════════════════════════════════════════════
     SISTEMA DE ASSETS (plataformas + decoração de fundo)
     — Cada asset é OPCIONAL: se o arquivo não existe/falha, o jogo
       degrada pro desenho vetorial (fallback). Assim dá pra ir
       criando as imagens aos poucos e elas "acendem" sozinhas.
     — Base dos assets: /Jogos/assets/ (pasta com J maiúsculo; o
       GitHub Pages é case-sensitive). O SW faz cache-first de
       imagens do próprio domínio, então cada asset é cacheado no
       1º fetch sem precisar listar no precache.
     — Plataformas: matriz TIPO × FAIXA de altitude. Faixas:
       'ceu' (baixo), 'atm' (atmosfera/meio), 'esp' (espaço).
       Tipos: 'normal' | 'move' | 'break'. (Trampolim é a mola,
       desenhada por cima em vetor — continua vetorial.)
     — Decoração: elementos que cruzam o fundo em parallax, cada um
       restrito à(s) faixa(s) de altitude onde faz sentido.
  ══════════════════════════════════════════════════════════════ */
  var _VOO_ASSET_BASE = '/Jogos/assets/';

  // Cache de imagens já pedidas: nome -> { img, ok }. 'ok' vira true no
  // onload; se falhar, fica false pra sempre (usa fallback vetorial).
  var _vooAssets = {};

  // Pede um asset pelo nome de arquivo (idempotente). Não bloqueia nada:
  // devolve o registro na hora; o desenho checa .ok antes de usar.
  function _vooAsset(nome) {
    if (_vooAssets[nome]) return _vooAssets[nome];
    var reg = { img: null, ok: false, w: 0, h: 0 };
    _vooAssets[nome] = reg;
    try {
      var im = new Image();
      im.onload = function () {
        reg.ok = true;
        reg.w = im.naturalWidth || 0;
        reg.h = im.naturalHeight || 0;
      };
      im.onerror = function () { reg.ok = false; };
      im.src = _VOO_ASSET_BASE + nome;
      reg.img = im;
    } catch (e) { reg.ok = false; }
    return reg;
  }

  // Nome do arquivo de plataforma pra (tipo, faixa). Convenção:
  //   plat-<tipo>-<faixa>.webp   ex.: plat-normal-ceu.webp
  // Faixa por altitude: <0.4 = ceu, <0.75 = atm, senão = esp.
  function _vooFaixa(alt) {
    if (alt < 0.4) return 'ceu';
    if (alt < 0.75) return 'atm';
    return 'esp';
  }
  function _vooPlatAssetNome(tipo, faixa) {
    var t = (tipo === 'move' || tipo === 'break') ? tipo : 'normal';
    return 'plat-' + t + '-' + faixa + '.webp';
  }

  // ── Registro de DECORAÇÃO de fundo ──────────────────────────
  // Cada entrada: nome do arquivo, faixa(s) de altitude onde surge
  // (min/max em 0..1), tamanho relativo à largura (frac de _vooW),
  // faixa de velocidade horizontal (em frac de _vooW por segundo),
  // camada de parallax (0 = colado no fundo/lento; 1 = perto/rápido),
  // e se cruza a tela na horizontal ('cruza') ou paira/gira no lugar
  // ('flutua', ex.: buraco negro). Tudo puramente decorativo.
  var _VOO_DECOR = [
    // Baixa altitude (céu): pássaros e balões/pipas.
    { nome: 'passaro.webp',    kind: 'passaro', min: 0.00, max: 0.45, tam: 0.10, vmin: 0.10, vmax: 0.22, camada: 0.55, modo: 'cruza' },
    { nome: 'balao.webp',      kind: 'balao',   min: 0.00, max: 0.40, tam: 0.15, vmin: 0.02, vmax: 0.06, camada: 0.35, modo: 'sobe'  },
    // Média (atmosfera): aviões.
    { nome: 'aviao.webp',      kind: 'aviao',   min: 0.30, max: 0.72, tam: 0.22, vmin: 0.16, vmax: 0.30, camada: 0.70, modo: 'cruza' },
    // Transição/alta: foguetes (sobem).
    { nome: 'foguete.webp',    kind: 'foguete', min: 0.45, max: 0.90, tam: 0.13, vmin: 0.20, vmax: 0.36, camada: 0.80, modo: 'sobe'  },
    // Espaço: OVNIs e buracos negros.
    { nome: 'ovni.webp',       kind: 'ovni',    min: 0.72, max: 1.00, tam: 0.18, vmin: 0.10, vmax: 0.26, camada: 0.60, modo: 'cruza' },
    { nome: 'buraconegro.webp',kind: 'buraco',  min: 0.80, max: 1.00, tam: 0.34, vmin: 0.00, vmax: 0.00, camada: 0.25, modo: 'flutua'}
  ];
  var _vooCanvas = null, _vooCtx = null;
  var _vooW = 0, _vooH = 0, _vooDpr = 1;
  var _vooRAF = 0, _vooLast = 0, _vooEstado = 'inicio';       // 'inicio'|'jogando'|'fim'
  var _vooListenersOn = false, _vooResizeOn = false;

  // Estado da partida
  var _vooOwl = null, _vooPlats = [], _vooCamY = 0, _vooStartY = 0;
  var _vooMaxClimb = 0, _vooScore = 0, _vooScoreShown = -1;
  var _vooDragging = false, _vooLastPX = 0, _vooKeyDir = 0;
  var _vooNuvens = [];
  var _vooEstrelas = [];        // campo de estrelas (parallax lento, surge na subida)
  var _vooTrail = [];           // rastro da coruja (posições recentes p/ fade)
  var _vooSquash = 0;           // 0 = neutro; >0 estica (pulo), <0 achata (impacto)
  var _vooTempo = 0;            // relógio do jogo (s) p/ cintilar estrelas/asas
  var _vooAlt = 0;              // altitude normalizada 0→1 (0 = solo, 1 = espaço)
  var _vooDecor = [];          // objetos decorativos ativos cruzando o fundo
  var _vooDecorTimer = 0;      // tempo até tentar spawnar o próximo decor (s)

  // Altitude de "climb" (px) que corresponde a atingir o espaço (alt=1).
  // Calibrado pra ser ALCANÇÁVEL numa partida boa: score = climb/H*100,
  // então alt=1 acontece por volta de score ~420. Assim o gradiente
  // amanhecer→espaço e as faixas de asset ficam visíveis de verdade
  // (atmosfera ~score 120, espaço ~score 300), sem exigir um recorde
  // absurdo. Ajuste fino aqui muda todo o ritmo visual da subida.
  function _vooAltMax() { return 4.2 * _vooH; }

  // Paleta do céu por altitude: amanhecer → dia → crepúsculo → espaço.
  // Cada parada tem cor de topo e de base do gradiente vertical.
  var _VOO_CEU = [
    { a: 0.00, topo: [255, 176, 122], base: [255, 214, 170] }, // amanhecer quente
    { a: 0.22, topo: [122, 178, 240], base: [196, 224, 255] }, // dia claro
    { a: 0.52, topo: [ 74,  96, 176], base: [138, 120, 210] }, // fim de tarde / roxo
    { a: 0.78, topo: [ 26,  30,  68], base: [ 58,  40, 104] }, // crepúsculo profundo
    { a: 1.00, topo: [  5,   7,  18], base: [ 14,  18,  40] }  // espaço
  ];

  // Interpola a paleta do céu para uma altitude 'a' (0→1), devolvendo
  // [topoRGB, baseRGB]. Clampa nas pontas.
  function _vooCorCeu(a) {
    if (a <= _VOO_CEU[0].a) return [_VOO_CEU[0].topo, _VOO_CEU[0].base];
    var n = _VOO_CEU.length;
    if (a >= _VOO_CEU[n - 1].a) return [_VOO_CEU[n - 1].topo, _VOO_CEU[n - 1].base];
    for (var i = 0; i < n - 1; i++) {
      var p0 = _VOO_CEU[i], p1 = _VOO_CEU[i + 1];
      if (a >= p0.a && a <= p1.a) {
        var t = (a - p0.a) / (p1.a - p0.a);
        return [_vooMix(p0.topo, p1.topo, t), _vooMix(p0.base, p1.base, t)];
      }
    }
    return [_VOO_CEU[0].topo, _VOO_CEU[0].base];
  }
  function _vooMix(c0, c1, t) {
    return [
      Math.round(c0[0] + (c1[0] - c0[0]) * t),
      Math.round(c0[1] + (c1[1] - c0[1]) * t),
      Math.round(c0[2] + (c1[2] - c0[2]) * t)
    ];
  }
  function _vooRgb(c)      { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function _vooRgba(c, a)  { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function _vooRec() {
    try { return Number(localStorage.getItem('angatuba_voo_rec')) || 0; } catch (e) { return 0; }
  }
  function _vooRecSet(v) {
    try { localStorage.setItem('angatuba_voo_rec', String(v)); } catch (e) {}
  }

  // Carrega a imagem da coruja uma vez (degrada pra bolinha se falhar).
  function _vooCarregarImg() {
    if (_vooImg) return;
    try {
      _vooImg = new Image();
      _vooImg.onload = function () {
        _vooImgOk = true;
        var w = _vooImg.naturalWidth || 0, h = _vooImg.naturalHeight || 0;
        _vooImgRatio = (w > 0 && h > 0) ? (h / w) : 1;
      };
      _vooImg.onerror = function () { _vooImgOk = false; };
      _vooImg.src = _VOO_OWL_SRC;
    } catch (e) { _vooImg = null; _vooImgOk = false; }
  }

  // (Re)dimensiona o canvas pro tamanho do container, com DPR.
  function _vooDimensionar() {
    if (!_vooCanvas) return;
    var rect = _vooCanvas.getBoundingClientRect();
    var cssW = Math.max(1, Math.round(rect.width));
    var cssH = Math.max(1, Math.round(rect.height));
    _vooDpr = Math.min(2, (window.devicePixelRatio || 1));
    _vooCanvas.width = Math.round(cssW * _vooDpr);
    _vooCanvas.height = Math.round(cssH * _vooDpr);
    _vooW = cssW; _vooH = cssH;
    if (_vooCtx) _vooCtx.setTransform(_vooDpr, 0, 0, _vooDpr, 0, 0);
  }

  // Constantes de física em função de H (mesma sensação em qualquer tela).
  function _vooGrav()  { return 2.3 * _vooH; }     // px/s²
  function _vooJump()  { return -1.02 * _vooH; }   // px/s (impulso p/ cima)
  function _vooPlatW() { return 0.28 * _vooW; }
  function _vooPlatH() { return Math.max(8, 0.028 * _vooH); }
  function _vooOwlW()  { return 0.15 * _vooW; }
  function _vooOwlH()  { return _vooOwlW() * (_vooImgOk ? _vooImgRatio : 1); }

  // Gap vertical entre plataformas, cresce com a pontuação (mais difícil).
  // Alcance seguro de um pulo (altura máxima), em px, com margem.
  // hMax = v^2 / (2g). Usamos 82% dele como teto de gap pra sempre
  // sobrar folga de controle horizontal.
  function _vooAlcance() {
    var v = Math.abs(_vooJump());
    var g = _vooGrav();
    return (v * v) / (2 * g);
  }

  // Gap efetivo entre plataformas ALCANÇÁVEIS (normais/móveis), sempre
  // <= teto seguro. Cresce com o score, mas nunca além do que o pulo
  // vence. (Independe de resolução: tudo em px do H atual.)
  function _vooGap() {
    var teto = _vooAlcance() * 0.82;
    var t = Math.min(1, _vooScore / 4000);
    var min = teto * (0.58 + 0.12 * t);
    var max = teto * (0.74 + 0.14 * t);
    if (max > teto) max = teto;
    return min + Math.random() * (max - min);
  }

  // Cria UMA plataforma num y dado. 'forcarNormal' garante que ela seja
  // pisável (usado logo acima de uma quebrável, pra nunca formar beco).
  function _vooNovaPlat(y, forcarNormal) {
    var w = _vooPlatW();
    var x = Math.random() * (_vooW - w);
    var tipo = 'normal';
    if (!forcarNormal) {
      var r = Math.random();
      if (_vooScore >= 700 && r < 0.18)      tipo = 'break';
      else if (_vooScore >= 300 && r < 0.42) tipo = 'move';
    }
    // Trampolim só em plataforma normal.
    var boost = (tipo === 'normal' && Math.random() < 0.07);
    var vx = 0;
    if (tipo === 'move') {
      var spd = (0.10 + 0.10 * Math.min(1, _vooScore / 3000)) * _vooW;
      vx = (Math.random() < 0.5 ? -1 : 1) * spd;
    }
    return { x: x, y: y, w: w, tipo: tipo, boost: boost, vx: vx, usada: false };
  }

  // Garante plataformas preenchidas acima da câmera, SEMPRE com caminho
  // alcançável: cada passo sobe no máximo _vooGap() (<= alcance do pulo),
  // e nunca gera não-normal imediatamente acima de uma quebrável.
  function _vooGerarAcima() {
    var topo = _vooCamY - 0.2 * _vooH;
    var maisAlta = _vooPlats.length ? _vooPlats[_vooPlats.length - 1] : null;
    var yAtual = maisAlta ? maisAlta.y : _vooStartY;
    var tipoAnterior = maisAlta ? maisAlta.tipo : 'normal';
    while (yAtual > topo) {
      // Regra de jogabilidade: nunca duas plataformas NÃO-NORMAIS seguidas.
      // Uma não-normal (quebrável some após o pulo; móvel pode estar longe
      // no eixo X) não é apoio confiável pra um segundo salto. Forçando uma
      // NORMAL logo acima de qualquer não-normal, garantimos que entre dois
      // apoios confiáveis (normais) há no máximo uma não-normal.
      var anteriorRuim = (tipoAnterior !== 'normal');
      // Quando a anterior é não-normal, encurtamos ESTE gap: assim o salto
      // que possivelmente ignora a não-normal (normal->normal) ainda cabe
      // dentro de um único pulo. gap normal->normal <= gap1*0.6 + gap2 onde
      // gap2 (este) é reduzido a 55%.
      var g = _vooGap();
      if (anteriorRuim) g *= 0.35;
      yAtual -= g;
      var nova = _vooNovaPlat(yAtual, anteriorRuim);   // força normal se anterior ruim
      _vooPlats.push(nova);
      tipoAnterior = nova.tipo;
    }
  }

  function _vooReset() {
    _vooDimensionar();
    _vooPlats = [];
    _vooStartY = 0;
    _vooCamY = _vooStartY - 0.7 * _vooH;     // coruja começa no terço de baixo
    _vooMaxClimb = 0; _vooScore = 0; _vooScoreShown = -1;
    _vooKeyDir = 0; _vooDragging = false;

    // Plataforma-base logo abaixo da coruja (primeiro pulo garantido).
    var baseY = _vooStartY + 0.12 * _vooH;
    var pw = _vooPlatW();
    _vooPlats.push({ x: (_vooW - pw) / 2, y: baseY, w: pw, tipo: 'normal', boost: false, vx: 0, usada: false });

    _vooOwl = {
      x: _vooW / 2, y: _vooStartY,
      vx: 0, vy: _vooJump() * 0.6,   // já sobe um pouquinho no começo
      dir: 1                          // 1 direita, -1 esquerda (p/ espelhar)
    };

    // Sobe as plataformas iniciais (mesma proteção do _vooGerarAcima:
    // nunca duas não-normais seguidas; encurta gap após não-normal).
    var y = baseY;
    var tAnt = 'normal';
    while (y > _vooCamY - 0.2 * _vooH) {
      var ruim = (tAnt !== 'normal');
      var gg = _vooGap(); if (ruim) gg *= 0.35;
      y -= gg;
      var np = _vooNovaPlat(y, ruim);
      _vooPlats.push(np);
      tAnt = np.tipo;
    }

    // Nuvens de parallax (decorativas). Guardam uma "faixa" de altitude
    // própria pra recliclar dentro das camadas baixas do céu.
    _vooNuvens = [];
    for (var i = 0; i < 6; i++) {
      _vooNuvens.push({
        x: Math.random() * _vooW,
        y: _vooStartY - Math.random() * 3 * _vooH,
        r: (0.14 + Math.random() * 0.16) * _vooW,
        op: 0.5 + Math.random() * 0.5
      });
    }

    // Campo de estrelas: coordenadas em espaço de tela (recicladas no
    // parallax). Só ficam visíveis conforme a altitude sobe. Guardamos
    // fase de cintilação individual.
    _vooEstrelas = [];
    var nEst = 70;
    for (var s = 0; s < nEst; s++) {
      _vooEstrelas.push({
        x: Math.random() * _vooW,
        y: Math.random() * _vooH,
        r: 0.5 + Math.random() * 1.6,
        f: Math.random() * Math.PI * 2,        // fase da cintilação
        v: 0.15 + Math.random() * 0.5          // camada de parallax (0..~0.65)
      });
    }

    _vooTrail = [];
    _vooSquash = 0;
    _vooTempo = 0;
    _vooAlt = 0;
    _vooDecor = [];
    _vooDecorTimer = 1.2;      // primeiro decor aparece logo no começo

    // Pré-carrega (best-effort) os assets de plataforma da faixa baixa e
    // as decorações de céu — os que aparecem primeiro. Os demais são
    // pedidos sob demanda; o SW cacheia no 1º fetch. Se não existirem,
    // ficam .ok=false e o jogo usa o fallback vetorial sem travar.
    _vooAsset(_vooPlatAssetNome('normal', 'ceu'));
    _vooAsset(_vooPlatAssetNome('move', 'ceu'));
    _vooAsset(_vooPlatAssetNome('break', 'ceu'));
  }

  // Atualiza a decoração de fundo: move os objetos ativos e, de tempos
  // em tempos, tenta spawnar um novo compatível com a altitude atual.
  // Objetos que saem de cena são descartados. Nada aqui colide com a
  // coruja — é puramente visual.
  function _vooAtualizarDecor(dt) {
    // Move / envelhece os ativos.
    for (var i = _vooDecor.length - 1; i >= 0; i--) {
      var d = _vooDecor[i];
      d.idade += dt;
      if (d.modo === 'cruza') {
        d.x += d.vx * dt;                       // atravessa horizontalmente
      } else if (d.modo === 'sobe') {
        d.y -= d.vsobe * dt;                    // sobe (foguete/balão)
        d.x += d.vx * dt;                       // leve deriva lateral
      } else if (d.modo === 'flutua') {
        d.giro += dt * 0.4;                     // buraco negro: gira devagar
      }
      // Descarte quando sai bem fora da tela (com folga).
      var margem = d.tam * _vooW;
      var foraX = (d.x < -margem * 1.5) || (d.x > _vooW + margem * 1.5);
      var foraY = (d.y < -margem * 1.5) || (d.y > _vooH + margem * 1.5);
      var venceuFlutua = (d.modo === 'flutua' && d.idade > 9);   // some após um tempo
      if (foraX || foraY || venceuFlutua) _vooDecor.splice(i, 1);
    }

    // Spawn temporizado. Ritmo depende de quantos já estão em cena
    // (limita a poluição visual) e um pouco da altitude.
    _vooDecorTimer -= dt;
    if (_vooDecorTimer <= 0 && _vooDecor.length < 3) {
      _vooDecorTimer = 2.4 + Math.random() * 3.2;   // próximo em ~2.4–5.6s
      _vooSpawnDecor();
    }
  }

  // Cria um objeto decorativo elegível pra altitude atual. Escolhe entre
  // os candidatos do registro cuja faixa [min,max] contém _vooAlt. Se não
  // houver candidato (ou o sorteio falhar), simplesmente não faz nada.
  function _vooSpawnDecor() {
    var alt = _vooAlt;
    var cands = [];
    for (var i = 0; i < _VOO_DECOR.length; i++) {
      var c = _VOO_DECOR[i];
      if (alt >= c.min && alt <= c.max) cands.push(c);
    }
    if (!cands.length) return;
    var def = cands[(Math.random() * cands.length) | 0];

    // Pede o asset (idempotente). Mesmo sem ele, criamos o objeto: o
    // desenho tem fallback vetorial por 'kind'.
    _vooAsset(def.nome);

    var tam = def.tam;
    var vel = (def.vmin + Math.random() * (def.vmax - def.vmin)) * _vooW;
    var d = {
      def: def, kind: def.kind, nome: def.nome,
      tam: tam, camada: def.camada, modo: def.modo,
      idade: 0, giro: 0,
      x: 0, y: 0, vx: 0, vsobe: 0, dir: 1
    };

    if (def.modo === 'cruza') {
      // Entra por um lado, sai pelo outro; y numa faixa média da tela.
      var daEsq = Math.random() < 0.5;
      d.dir = daEsq ? 1 : -1;
      d.vx = vel * d.dir;
      d.x = daEsq ? -tam * _vooW : _vooW + tam * _vooW;
      d.y = (0.12 + Math.random() * 0.5) * _vooH;
    } else if (def.modo === 'sobe') {
      // Sobe de baixo pra cima; leve deriva.
      d.x = (0.1 + Math.random() * 0.8) * _vooW;
      d.y = _vooH + tam * _vooW;
      d.vsobe = vel;
      d.vx = (Math.random() - 0.5) * 0.04 * _vooW;
    } else { // flutua (buraco negro)
      d.x = (0.2 + Math.random() * 0.6) * _vooW;
      d.y = (0.15 + Math.random() * 0.45) * _vooH;
    }
    _vooDecor.push(d);
  }

  function _vooAtualizarScore() {
    var climb = _vooStartY - _vooOwl.y;
    if (climb > _vooMaxClimb) _vooMaxClimb = climb;
    _vooScore = Math.max(0, Math.floor((_vooMaxClimb / _vooH) * 100));
    if (_vooScore !== _vooScoreShown) {
      _vooScoreShown = _vooScore;
      var el = document.getElementById('vo-pontos');
      if (el) el.textContent = _vooScore;
    }
  }

  function _vooStep(dt) {
    var o = _vooOwl;
    var g = _vooGrav();

    _vooTempo += dt;

    // Movimento horizontal por teclado (desktop); o arraste mexe direto em o.x.
    if (_vooKeyDir !== 0) { o.x += _vooKeyDir * 0.9 * _vooW * dt; }

    // Física vertical
    o.vy += g * dt;
    o.y += o.vy * dt;

    // Squash & stretch relaxa suavemente de volta ao neutro (~8/s).
    if (_vooSquash !== 0) {
      var relax = _vooSquash * Math.min(1, dt * 8);
      _vooSquash -= relax;
      if (Math.abs(_vooSquash) < 0.004) _vooSquash = 0;
    }

    // Wrap horizontal (sai de um lado, entra no outro)
    var hw = _vooOwlW() / 2;
    if (o.x < -hw) o.x = _vooW + hw;
    else if (o.x > _vooW + hw) o.x = -hw;

    // Move plataformas móveis
    for (var i = 0; i < _vooPlats.length; i++) {
      var p = _vooPlats[i];
      if (p.tipo === 'move' && p.vx) {
        p.x += p.vx * dt;
        if (p.x < 0) { p.x = 0; p.vx = -p.vx; }
        else if (p.x + p.w > _vooW) { p.x = _vooW - p.w; p.vx = -p.vx; }
      }
    }

    // Colisão: só quando caindo (vy > 0) e os pés cruzam o topo da plataforma
    if (o.vy > 0) {
      var owlH = _vooOwlH();
      var feet = o.y + owlH / 2;
      var ph = _vooPlatH();
      for (var j = 0; j < _vooPlats.length; j++) {
        var pl = _vooPlats[j];
        if (pl.usada) continue;
        var dentroX = (o.x > pl.x - hw * 0.4) && (o.x < pl.x + pl.w + hw * 0.4);
        var cruzou = (feet >= pl.y) && (feet <= pl.y + ph + Math.abs(o.vy) * dt);
        if (dentroX && cruzou) {
          // Impulsiona SEMPRE (inclusive quebrável) — assim nenhuma
          // plataforma vira beco sem saída. A quebrável dá o pulo e
          // só então some (nega a 2ª vez naquele ponto, como no
          // Doodle Jump clássico).
          o.vy = _vooJump() * (pl.boost ? 1.7 : 1);
          o.y = pl.y - owlH / 2;           // encosta em cima
          // Feedback: achata no impacto e dispara som (mola no trampolim).
          _vooSquash = pl.boost ? -0.42 : -0.26;
          if (window.AngatubaGames && window.AngatubaGames.som) {
            if (pl.boost) window.AngatubaGames.som.mola();
            else          window.AngatubaGames.som.pulo();
          }
          // Faíscas no ponto de contato (trampolim reforça).
          if (pl.boost && window.AngatubaGames && window.AngatubaGames.efeitos && _vooCanvas) {
            var rC = _vooCanvas.getBoundingClientRect();
            window.AngatubaGames.efeitos.estrelas(
              rC.left + (o.x / _vooW) * rC.width,
              rC.top + ((pl.y - _vooCamY) / _vooH) * rC.height,
              10
            );
          }
          if (pl.tipo === 'break') pl.usada = true;  // quebra após impulsionar
          break;
        }
      }
    }

    // Direção pra espelhar sprite
    if (o.vx > 2) o.dir = 1; else if (o.vx < -2) o.dir = -1;

    // Câmera sobe com a coruja (nunca desce)
    var alvoCam = o.y - 0.45 * _vooH;
    if (alvoCam < _vooCamY) _vooCamY = alvoCam;

    // Gera acima e descarta plataformas bem abaixo
    _vooGerarAcima();
    var limiteBaixo = _vooCamY + _vooH + 0.3 * _vooH;
    _vooPlats = _vooPlats.filter(function (p) { return p.y < limiteBaixo; });

    _vooAtualizarScore();

    // Altitude normalizada (0 solo → 1 espaço), suavizada pra transição
    // de céu não "pinotear" quando a coruja oscila.
    var altAlvo = Math.max(0, Math.min(1, _vooMaxClimb / _vooAltMax()));
    _vooAlt += (altAlvo - _vooAlt) * Math.min(1, dt * 3);

    // Decoração de fundo (spawn + movimento), depende da altitude atual.
    _vooAtualizarDecor(dt);

    // Rastro: registra a posição em coord. de MUNDO (y absoluto), pra
    // desenhar já compensando a câmera. Limita o comprimento.
    _vooTrail.push({ x: o.x, y: o.y });
    if (_vooTrail.length > 14) _vooTrail.shift();

    // Morte: caiu abaixo da tela
    if (o.y - _vooCamY > _vooH + _vooOwlH()) { _vooFim(); return false; }
    return true;
  }

  function _vooDraw() {
    var ctx = _vooCtx;
    if (!ctx) return;
    var W = _vooW, H = _vooH;

    _vooDesenharCeu(ctx, W, H, _vooAlt);

    // Decoração de fundo (atrás das plataformas e da coruja).
    _vooDesenharDecor(ctx);

    // Coruja por último (sobre tudo).
    var o = _vooOwl;
    _vooDesenharRastro(ctx);
    _vooDesenharPlataformas(ctx, W, H);
    _vooDesenharCoruja(ctx, o);
  }

  // ── Camada 1: céu (gradiente por altitude) + astro + estrelas + nuvens ──
  function _vooDesenharCeu(ctx, W, H, alt) {
    var par = _vooCorCeu(alt);
    var topo = par[0], base = par[1];
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, _vooRgb(topo));
    grad.addColorStop(1, _vooRgb(base));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Sol/lua: um disco que sobe pra fora de cena e esfria de cor
    // conforme ganhamos altitude (some no espaço). Parallax bem lento.
    var astroOp = Math.max(0, 1 - alt * 1.7);
    if (astroOp > 0.02) {
      var ax = W * 0.74;
      var ay = H * (0.16 + alt * 0.9);            // desce na tela = sobe no mundo
      var ar = W * 0.14;
      var qCor = alt < 0.35
        ? [255, 236, 180]                          // sol quente (manhã)
        : _vooMix([255, 236, 180], [214, 224, 255], Math.min(1, (alt - 0.35) / 0.4)); // esfria p/ lua
      var gA = ctx.createRadialGradient(ax, ay, ar * 0.2, ax, ay, ar * 2.4);
      gA.addColorStop(0, _vooRgba(qCor, 0.9 * astroOp));
      gA.addColorStop(0.4, _vooRgba(qCor, 0.35 * astroOp));
      gA.addColorStop(1, _vooRgba(qCor, 0));
      ctx.fillStyle = gA;
      ctx.beginPath(); ctx.arc(ax, ay, ar * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = _vooRgba(qCor, astroOp);
      ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill();
    }

    // Estrelas: aparecem gradualmente (fade-in a partir de ~alt 0.3) com
    // parallax individual e cintilação suave. Recicladas verticalmente.
    var estOp = Math.max(0, (alt - 0.28) / 0.55);
    if (estOp > 0.02) {
      if (estOp > 1) estOp = 1;
      for (var s = 0; s < _vooEstrelas.length; s++) {
        var st = _vooEstrelas[s];
        var sy = ((st.y - _vooCamY * st.v) % H + H) % H;   // wrap suave
        var tw = 0.55 + 0.45 * Math.sin(_vooTempo * 2.2 + st.f); // cintila
        ctx.fillStyle = 'rgba(255,255,255,' + (estOp * tw).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(st.x, sy, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Nuvens: densas embaixo, somem conforme sobe (opacidade cai com alt).
    var nuvOp = Math.max(0, 1 - alt * 1.5);
    if (nuvOp > 0.02) {
      for (var n = 0; n < _vooNuvens.length; n++) {
        var c = _vooNuvens[n];
        var cy = (c.y - _vooCamY * 0.5);                  // metade da velocidade
        if (cy > H + c.r) { c.y = _vooCamY * 0.5 - c.r - Math.random() * H; c.x = Math.random() * W; }
        ctx.globalAlpha = 0.16 * c.op * nuvOp;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(c.x, cy, c.r, 0, Math.PI * 2);
        ctx.arc(c.x + c.r * 0.7, cy + c.r * 0.15, c.r * 0.72, 0, Math.PI * 2);
        ctx.arc(c.x - c.r * 0.7, cy + c.r * 0.18, c.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Camada 1.5: decoração de fundo (asset se houver; senão vetor) ──
  function _vooDesenharDecor(ctx) {
    for (var i = 0; i < _vooDecor.length; i++) {
      var d = _vooDecor[i];
      var w = d.tam * _vooW;
      var reg = _vooAssets[d.nome];
      // Fade suave na entrada/saída pra não "piscar" na borda.
      var op = 1;
      if (d.idade < 0.6) op = d.idade / 0.6;
      if (d.modo === 'flutua') {
        // buraco negro: aparece, fica, some (janela de 9s).
        var vida = d.idade;
        op = Math.min(1, vida / 0.8) * Math.min(1, Math.max(0, (9 - vida) / 1.2));
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, op)) * (0.55 + 0.45 * d.camada);
      ctx.translate(d.x, d.y);
      if (reg && reg.ok && reg.img) {
        // Proporção real do asset; espelha se estiver indo pra esquerda.
        var ratio = (reg.w > 0 && reg.h > 0) ? reg.h / reg.w : 1;
        var h = w * ratio;
        if (d.modo === 'cruza' && d.dir < 0) ctx.scale(-1, 1);
        if (d.modo === 'flutua') ctx.rotate(d.giro);
        try { ctx.drawImage(reg.img, -w / 2, -h / 2, w, h); }
        catch (e) { _vooDecorFallback(ctx, d, w); }
      } else {
        if (d.modo === 'cruza' && d.dir < 0) ctx.scale(-1, 1);
        _vooDecorFallback(ctx, d, w);
      }
      ctx.restore();
    }
  }

  // Fallback vetorial por tipo de decoração (silhuetas reconhecíveis).
  // Centrado em (0,0); o caller já aplicou translate/scale/alpha.
  function _vooDecorFallback(ctx, d, w) {
    var k = d.kind, h = w;
    switch (k) {
      case 'passaro': {
        // "M" de gaivota (duas curvas).
        ctx.strokeStyle = 'rgba(40,50,70,0.75)';
        ctx.lineWidth = Math.max(2, w * 0.06);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-w * 0.5, 0);
        ctx.quadraticCurveTo(-w * 0.25, -w * 0.28, 0, 0);
        ctx.quadraticCurveTo(w * 0.25, -w * 0.28, w * 0.5, 0);
        ctx.stroke();
        break;
      }
      case 'balao': {
        // Balão (círculo) + cestinha.
        var r = w * 0.42;
        var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
        g.addColorStop(0, '#ff8fa3'); g.addColorStop(1, '#e23e5c');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, -r * 0.2, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, w * 0.02);
        ctx.beginPath(); ctx.moveTo(0, -r * 0.2 + r); ctx.lineTo(0, r * 0.55); ctx.stroke();
        ctx.fillStyle = '#8a5a2b';
        _vooRoundRect(ctx, -r * 0.22, r * 0.55, r * 0.44, r * 0.3, r * 0.08); ctx.fill();
        break;
      }
      case 'aviao': {
        // Fuselagem + asas + cauda (silhueta lateral).
        ctx.fillStyle = 'rgba(214,224,240,0.92)';
        _vooRoundRect(ctx, -w * 0.5, -h * 0.09, w, h * 0.18, h * 0.09); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-w * 0.05, 0); ctx.lineTo(w * 0.12, -h * 0.32);
        ctx.lineTo(w * 0.22, -h * 0.30); ctx.lineTo(w * 0.1, 0); ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-w * 0.42, 0); ctx.lineTo(-w * 0.52, -h * 0.24);
        ctx.lineTo(-w * 0.44, -h * 0.24); ctx.lineTo(-w * 0.34, 0); ctx.closePath();
        ctx.fill();
        break;
      }
      case 'foguete': {
        // Corpo + bico + aletas + chama.
        ctx.fillStyle = '#eef2f8';
        _vooRoundRect(ctx, -w * 0.16, -h * 0.42, w * 0.32, h * 0.7, w * 0.14); ctx.fill();
        ctx.fillStyle = '#ff5a77';
        ctx.beginPath();
        ctx.moveTo(-w * 0.16, -h * 0.32); ctx.lineTo(0, -h * 0.62);
        ctx.lineTo(w * 0.16, -h * 0.32); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff9d33';
        ctx.beginPath();
        ctx.moveTo(-w * 0.12, h * 0.28); ctx.lineTo(0, h * 0.55);
        ctx.lineTo(w * 0.12, h * 0.28); ctx.closePath(); ctx.fill();
        break;
      }
      case 'ovni': {
        // Cúpula + disco + luzes.
        ctx.fillStyle = 'rgba(120,240,200,0.5)';
        ctx.beginPath(); ctx.ellipse(0, 0, w * 0.5, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b8c4d8';
        ctx.beginPath(); ctx.ellipse(0, 0, w * 0.4, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(180,230,255,0.9)';
        ctx.beginPath(); ctx.arc(0, -h * 0.06, w * 0.18, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#7CF0C8';
        for (var li = -2; li <= 2; li++) {
          ctx.beginPath(); ctx.arc(li * w * 0.14, h * 0.02, w * 0.03, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'buraco': {
        // Disco de acreção: anéis concêntricos + centro preto.
        var R = w * 0.5;
        var g2 = ctx.createRadialGradient(0, 0, R * 0.28, 0, 0, R);
        g2.addColorStop(0, 'rgba(0,0,0,1)');
        g2.addColorStop(0.42, 'rgba(0,0,0,1)');
        g2.addColorStop(0.5, 'rgba(150,90,255,0.85)');
        g2.addColorStop(0.62, 'rgba(90,140,255,0.55)');
        g2.addColorStop(1, 'rgba(90,140,255,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle = 'rgba(200,200,220,0.4)';
        ctx.beginPath(); ctx.arc(0, 0, w * 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ── Rastro da coruja: bolinhas que somem (mais recente = maior/opaco) ──
  function _vooDesenharRastro(ctx) {
    var m = _vooTrail.length;
    if (m < 2) return;
    var ow = _vooOwlW();
    for (var i = 0; i < m; i++) {
      var t = _vooTrail[i];
      var f = (i + 1) / m;                     // 0→1 (fim = coruja atual)
      var rr = ow * 0.30 * f;
      ctx.globalAlpha = 0.30 * f * f;
      ctx.fillStyle = '#ff3355';
      ctx.beginPath();
      ctx.arc(t.x, t.y - _vooCamY, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Plataformas: usa asset (tipo × faixa de altitude) se existir;
  //    senão, desenho vetorial (sombra + corpo + highlight + glow). A
  //    mola do trampolim é sempre vetorial, por cima. ──
  function _vooDesenharPlataformas(ctx, W, H) {
    var ph = _vooPlatH();
    var faixa = _vooFaixa(_vooAlt);
    for (var i = 0; i < _vooPlats.length; i++) {
      var p = _vooPlats[i];
      if (p.usada) continue;
      var y = p.y - _vooCamY;
      if (y < -ph * 2 || y > H + ph * 2) continue;

      // Tenta o asset da faixa atual pra este tipo.
      var nome = _vooPlatAssetNome(p.tipo, faixa);
      var reg = _vooAsset(nome);
      if (reg && reg.ok && reg.img) {
        _vooDesenharPlatImg(ctx, p, y, ph, reg);
      } else {
        _vooPlatVetor(ctx, p, y, ph);
      }

      // Trampolim: mola vermelha por cima (sempre vetorial).
      if (p.boost) _vooDesenharMola(ctx, p, y, ph);
    }
  }

  // Desenha a plataforma a partir de uma imagem. A imagem é encaixada na
  // LARGURA da plataforma (p.w); a altura segue o ratio do asset, mas é
  // "ancorada" pela superfície de colisão (topo da imagem ~ p.y), pra que
  // a arte possa ter volume abaixo sem bagunçar a física.
  function _vooDesenharPlatImg(ctx, p, y, ph, reg) {
    var ratio = (reg.w > 0 && reg.h > 0) ? reg.h / reg.w : 0.4;
    var iw = p.w * 1.18;                       // leve sangria lateral
    var ih = iw * ratio;
    var ix = p.x - (iw - p.w) / 2;
    // Superfície pisável fica perto do topo da arte (12% de folga).
    var iy = y - ih * 0.12;
    ctx.save();
    // Glow sutil por trás no espaço (destaca a plataforma no fundo escuro).
    if (_vooAlt > 0.5) {
      ctx.shadowColor = 'rgba(120,160,255,0.35)';
      ctx.shadowBlur = ph * (_vooAlt * 2.2);
    }
    try { ctx.drawImage(reg.img, ix, iy, iw, ih); }
    catch (e) { ctx.restore(); _vooPlatVetor(ctx, p, y, ph); return; }
    ctx.restore();
  }

  // Desenho vetorial da plataforma (fallback / faixas sem asset).
  function _vooPlatVetor(ctx, p, y, ph) {
    var corBase, corTopo, corGlow;
    if (p.tipo === 'move')       { corBase = '#2b7fd6'; corTopo = '#6fc0ff'; corGlow = 'rgba(73,167,255,0.55)'; }
    else if (p.tipo === 'break') { corBase = '#c46a24'; corTopo = '#ffb066'; corGlow = 'rgba(240,145,62,0.5)'; }
    else                         { corBase = '#1f9e68'; corTopo = '#54e6a2'; corGlow = 'rgba(47,212,138,0.5)'; }

    // Sombra projetada (deslocada pra baixo/direita).
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    _vooRoundRect(ctx, p.x + ph * 0.18, y + ph * 0.5, p.w, ph, ph / 2);
    ctx.fill();

    // Glow neon por trás (mais forte no espaço, onde o fundo é escuro).
    ctx.save();
    ctx.shadowColor = corGlow;
    ctx.shadowBlur = ph * (1.2 + _vooAlt * 2.2);
    // Corpo (gradiente vertical: topo claro → base).
    var gP = ctx.createLinearGradient(0, y, 0, y + ph);
    gP.addColorStop(0, corTopo);
    gP.addColorStop(1, corBase);
    _vooRoundRect(ctx, p.x, y, p.w, ph, ph / 2);
    ctx.fillStyle = gP;
    ctx.fill();
    ctx.restore();

    // Faixa de brilho no topo (highlight fininho).
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    _vooRoundRect(ctx, p.x + ph * 0.3, y + ph * 0.16, p.w - ph * 0.6, ph * 0.24, ph * 0.12);
    ctx.fill();
  }

  // Mola do trampolim (desenho vetorial simples, neon vermelho).
  function _vooDesenharMola(ctx, p, y, ph) {
    var bw = p.w * 0.30;
    var bx = p.x + (p.w - bw) / 2;
    var topY = y - ph * 1.6;
    ctx.save();
    ctx.strokeStyle = '#ff3355';
    ctx.lineWidth = Math.max(2, ph * 0.28);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,51,85,0.7)';
    ctx.shadowBlur = ph * 1.4;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.lineTo(bx + bw, topY + ph * 1.1);
    ctx.lineTo(bx, topY + ph * 0.55);
    ctx.lineTo(bx + bw, topY);
    ctx.stroke();
    // Plaquinha no topo da mola.
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff5a77';
    _vooRoundRect(ctx, bx - ph * 0.15, topY - ph * 0.5, bw + ph * 0.3, ph * 0.5, ph * 0.2);
    ctx.fill();
    ctx.restore();
  }

  // ── Coruja: rotação pela velocidade + squash & stretch + espelho ──
  function _vooDesenharCoruja(ctx, o) {
    var ow = _vooOwlW(), oh = _vooOwlH();

    // Inclinação: sobe → nariz p/ cima; cai → mergulha. Mapeia vy.
    var vNorm = Math.max(-1, Math.min(1, o.vy / (Math.abs(_vooJump()) * 1.1)));
    var ang = vNorm * 0.28;                 // rad (~16°)

    // Squash: _vooSquash<0 achata (impacto), tende a 0. Converte em escalas
    // que preservam volume aproximado.
    var sq = _vooSquash;
    var sx = 1 - sq * 0.5;                   // impacto (sq<0) → mais largo
    var sy = 1 + sq * 0.5;                   // impacto (sq<0) → mais baixo

    ctx.save();
    ctx.translate(o.x, (o.y - _vooCamY));
    if (o.dir < 0) ctx.scale(-1, 1);
    ctx.rotate(o.dir < 0 ? -ang : ang);
    ctx.scale(sx, sy);
    if (_vooImgOk && _vooImg) {
      try { ctx.drawImage(_vooImg, -ow / 2, -oh / 2, ow, oh); }
      catch (e) { _vooDrawFallback(ctx, ow); }
    } else {
      _vooDrawFallback(ctx, ow);
    }
    ctx.restore();
  }

  function _vooDrawFallback(ctx, ow) {
    ctx.fillStyle = '#8aa0c6';
    ctx.beginPath();
    ctx.arc(0, 0, ow / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath(); ctx.arc(-ow * 0.15, -ow * 0.1, ow * 0.09, 0, Math.PI * 2);
    ctx.arc(ow * 0.15, -ow * 0.1, ow * 0.09, 0, Math.PI * 2); ctx.fill();
  }

  function _vooRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function _vooLoop(ts) {
    if (_vooEstado !== 'jogando') return;
    if (!_vooLast) _vooLast = ts;
    var dt = (ts - _vooLast) / 1000;
    _vooLast = ts;
    if (dt > 1 / 30) dt = 1 / 30;                    // clamp anti-tunneling
    var vivo = _vooStep(dt);
    if (!vivo) return;
    _vooDraw();
    _vooRAF = requestAnimationFrame(_vooLoop);
  }

  /* ── Controles ─────────────────────────────────────────────── */
  function _vooPX(e) {
    var rect = _vooCanvas.getBoundingClientRect();
    var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    return cx - rect.left;
  }
  function _vooPointerDown(e) {
    if (_vooEstado !== 'jogando') return;
    _vooDragging = true; _vooLastPX = _vooPX(e);
    if (e.cancelable) e.preventDefault();
  }
  function _vooPointerMove(e) {
    if (!_vooDragging || _vooEstado !== 'jogando') return;
    var px = _vooPX(e);
    var dx = px - _vooLastPX;
    _vooLastPX = px;
    _vooOwl.x += dx * 1.5;                            // sensibilidade do arraste
    _vooOwl.vx = dx;                                  // p/ decidir espelhamento
    if (e.cancelable) e.preventDefault();
  }
  function _vooPointerUp() { _vooDragging = false; _vooOwl.vx = 0; }
  function _vooKey(down, e) {
    if (e.key === 'ArrowLeft')  { _vooKeyDir = down ? -1 : 0; _vooOwl.dir = -1; }
    else if (e.key === 'ArrowRight') { _vooKeyDir = down ? 1 : 0; _vooOwl.dir = 1; }
  }
  function _vooLigarControles() {
    if (_vooListenersOn || !_vooCanvas) return;
    _vooCanvas.addEventListener('touchstart', _vooPointerDown, { passive: false });
    _vooCanvas.addEventListener('touchmove',  _vooPointerMove, { passive: false });
    _vooCanvas.addEventListener('touchend',   _vooPointerUp);
    _vooCanvas.addEventListener('touchcancel',_vooPointerUp);
    _vooCanvas.addEventListener('mousedown',  _vooPointerDown);
    window.addEventListener('mousemove',      _vooPointerMove);
    window.addEventListener('mouseup',        _vooPointerUp);
    _vooCanvas.__voKD = function (e) { _vooKey(true, e); };
    _vooCanvas.__voKU = function (e) { _vooKey(false, e); };
    window.addEventListener('keydown', _vooCanvas.__voKD);
    window.addEventListener('keyup',   _vooCanvas.__voKU);
    _vooListenersOn = true;
  }

  /* ── Ciclo de vida integrado ao hub ────────────────────────── */
  function _vooPreparar() {
    _vooCanvas = document.getElementById('vo-canvas');
    if (!_vooCanvas) return;
    _vooCtx = _vooCanvas.getContext('2d');
    _vooCarregarImg();
    _vooLigarControles();
    if (!_vooResizeOn) {
      window.addEventListener('resize', function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) { _vooDimensionar(); if (_vooEstado !== 'jogando') _vooDrawIdle(); }
      });
      _vooResizeOn = true;
    }
    _vooEstado = 'inicio';
    var rec = document.getElementById('vo-recorde'); if (rec) rec.textContent = _vooRec();
    var pts = document.getElementById('vo-pontos');  if (pts) pts.textContent = 0;
    _vooMostrarOverlay('inicio');
    _vooDimensionar();
    _vooDrawIdle();
    // Blindagem de timing: em tela cheia o layout pode ainda nao ter
    // assentado quando medimos acima (arena 0px = tela preta). Remede no
    // proximo frame, quando o CSS de tela cheia ja aplicou a altura real.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        _vooDimensionar();
        if (_vooEstado !== 'jogando') _vooDrawIdle();
      });
    }
  }

  // Desenha um quadro parado (céu de amanhecer) atrás do overlay.
  function _vooDrawIdle() {
    if (!_vooCtx) return;
    _vooDimensionar();
    var ctx = _vooCtx, W = _vooW, H = _vooH;
    var par = _vooCorCeu(0);
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, _vooRgb(par[0]));
    grad.addColorStop(1, _vooRgb(par[1]));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    // Sol quente da manhã, canto superior.
    var ax = W * 0.74, ay = H * 0.2, ar = W * 0.14, q = [255, 236, 180];
    var gA = ctx.createRadialGradient(ax, ay, ar * 0.2, ax, ay, ar * 2.4);
    gA.addColorStop(0, _vooRgba(q, 0.9)); gA.addColorStop(0.4, _vooRgba(q, 0.35)); gA.addColorStop(1, _vooRgba(q, 0));
    ctx.fillStyle = gA; ctx.beginPath(); ctx.arc(ax, ay, ar * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = _vooRgba(q, 1); ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill();
  }

  function _vooComecar() {
    _vooCanvas = document.getElementById('vo-canvas');
    if (!_vooCanvas) return;
    if (!_vooCtx) _vooCtx = _vooCanvas.getContext('2d');
    _vooLigarControles();
    _vooMostrarOverlay(null);
    _vooReset();
    _vooEstado = 'jogando';
    _vooLast = 0;
    if (_vooRAF) cancelAnimationFrame(_vooRAF);
    _vooRAF = requestAnimationFrame(_vooLoop);
  }

  function _vooParar() {
    if (_vooRAF) { cancelAnimationFrame(_vooRAF); _vooRAF = 0; }
    if (_vooEstado === 'jogando') _vooEstado = 'inicio';
    _vooDragging = false; _vooKeyDir = 0;
  }

  function _vooFim() {
    if (_vooRAF) { cancelAnimationFrame(_vooRAF); _vooRAF = 0; }
    _vooEstado = 'fim';
    var score = _vooScore;
    var rec = _vooRec();
    var recorde = score > rec;
    if (recorde) { _vooRecSet(score); var r = document.getElementById('vo-recorde'); if (r) r.textContent = score; }

    // Som de fim (vitória se bateu recorde, senão neutro).
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(recorde);

    // Rank (silencioso se deslogado; o Firestore aplica recorde/teto)
    if (window.AngatubaGames) window.AngatubaGames.rankSubmeter('voo', score);

    // Tela de fim
    var owlEl = document.getElementById('vo-fim-owl');
    var titEl = document.getElementById('vo-fim-titulo');
    var msgEl = document.getElementById('vo-fim-pontos');
    var subEl = document.getElementById('vo-fim-msg');
    if (owlEl) { owlEl.src = recorde ? '/webp/owl-celebrate-flying.webp' : '/webp/owl-flying.webp'; owlEl.style.display = ''; }
    if (titEl) titEl.textContent = recorde ? '🎉 Novo recorde!' : 'Fim do voo!';
    if (msgEl) msgEl.textContent = score + (score === 1 ? ' ponto' : ' pontos');
    if (subEl) {
      subEl.textContent = recorde
        ? 'Você voou mais alto que nunca! 🦉'
        : (rec > 0 ? 'Seu recorde: ' + rec + '. Bora de novo?' : 'Arraste pra desviar e suba o máximo que puder!');
    }
    _vooMostrarOverlay('fim');

    // Confete sobre a tela de fim quando bateu recorde.
    if (recorde && window.AngatubaGames && window.AngatubaGames.efeitos) {
      window.AngatubaGames.efeitos.confete('vo-fim', 90);
    }

    if (window.AngatubaGames) window.AngatubaGames.rankFimDeJogo('voo', 'vo-rank-slot', score);
  }

  // Mostra o overlay pedido ('inicio' | 'fim' | null pra esconder ambos).
  function _vooMostrarOverlay(qual) {
    var ini = document.getElementById('vo-inicio');
    var fim = document.getElementById('vo-fim');
    if (ini) ini.style.display = (qual === 'inicio') ? '' : 'none';
    if (fim) fim.style.display = (qual === 'fim') ? '' : 'none';
  }

  window._vooComecar = _vooComecar;

  // API pública consumida pelo loader do app (_jogoLoader).
  window.VooGame = {
    preparar: _vooPreparar,
    comecar:  _vooComecar,
    parar:    _vooParar
  };
  // Mantém o binding usado pelo onclick inline no HTML.
  window._vooComecar = _vooComecar;
})();