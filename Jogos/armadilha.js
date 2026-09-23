/* ═══════════════════════════════════════════════════════════════
   ARMADILHA DA CORUJA — platformer de armadilhas (estilo Level Devil)
   Lazy-loaded pelo hub a partir de /Jogos/armadilha.min.js
   (ver JOGOS_EXTERNOS em Jogos/hub.js). Expõe window.ArmadilhaGame
   = { preparar, parar }.
   ------------------------------------------------------------
   - Monta tudo dentro de #armadilha-root (mesmo esquema do
     #negocios-root): canvas, HUD, controles de toque e overlays.
   - Canvas 2D, física em passo fixo (1/120 s), colisão AABB.
   - Escala INTEIRA em pixels do aparelho + imageSmoothing desligado:
     a coruja pixel art nunca borra.
   - Sprite: /img/pixel/coruja-pixel-idle-sheet.png (4 quadros lado a
     lado: normal, abaixada, normal, piscando). O tamanho do quadro é
     calculado da própria imagem (largura/4), então tanto a versão 1x
     quanto a ampliada funcionam.
   - Fases são DADOS (array FASES logo abaixo): mapa ASCII + lista de
     armadilhas + textos + (opcional) corujas guia. Nada de código novo
     pra criar uma fase.
   - Sem backend: progresso (fase liberada) fica no localStorage.
   - Feito pra jogar DEITADO: em pé funciona, mas mostra um aviso leve
     ("Gira o celular") e, onde o navegador deixa, um botão que trava a
     orientação só enquanto o jogo está aberto.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Constantes ─────────────────────────────────────────────── */
  var T = 16;                                   // tamanho do tile (px do mundo)
  var SPRITE_SHEET = '/img/pixel/coruja-pixel-idle-sheet.png';
  var SPR_W = 20, SPR_H = 23;                   // quadro da coruja em px do mundo
  var CHAVE_PROGRESSO = 'angatuba_armadilha_fase';

  // Física (px do mundo por segundo)
  var GRAV = 1500, PULO_V = 390, PULO_CORTE = 170, QUEDA_MAX = 620;
  var VEL = 105, ACEL_CHAO = 1500, ACEL_AR = 1000, FREIO_CHAO = 2000, FREIO_AR = 500;
  var COYOTE = 0.08, BUFFER_PULO = 0.12, PASSO = 1 / 120;
  var PW = 12, PH = 18;                         // hitbox da coruja
  var MIN_TILES_LARG = 15;                      // mínimo de tiles visíveis na largura
  var T_RESPAWN = 0.5, T_VITORIA = 1.1;
  var T_RESPAWN_FALA = 1.05, T_VITORIA_FALA = 2.0;   // pausas maiores quando a guia fala
  var GUIA_VEL = 115, GUIA_LONGE = 7;           // guia: px/s andando; espera se o jogador ficar > N tiles atrás
  var FONTE = '700 7px ui-monospace, Menlo, Consolas, monospace';
  var TOQUE_FOLGA = 22;                         // px CSS de folga em volta do ◀ ▶ (dedo gordo)

  var CORES_PENAS = ['#5b6b7f', '#d6bf9c', '#f2a11f', '#ff4a4a', '#1c212b', '#c4ab8a'];
  var RISADAS = ['Ha ha!', 'Otário!', 'Ha ha ha!'];

  /* ══════════════════════════════════════════════════════════════
     FASES — edite aqui.
     mapa (12 linhas, todas do mesmo tamanho):
       .  vazio            #  chão/parede      ^  espinho (pra cima)
       v  espinho (pra baixo, no teto)         S  início da coruja
       F  bandeira         a-z  bloco de um GRUPO (pode cair/sumir/mover)
       1-9  espinho de um GRUPO (pode aparecer/sumir/mover)
     armadilhas: { g: grupo ('a', '1'... ou 'bandeira'),
                   gatilho: coluna (dispara quando o CENTRO da coruja passa dela),
                   acao: 'cai' | 'some' | 'aparece' | 'move',
                   dx/dy: tiles (só 'move'), vel: px/s (só 'move'),
                   atraso: ms (opcional), mata: true (bloco mata ao encostar),
                   lado: 'esq' (opcional: só dispara VOLTANDO — depois de ter
                         passado do gatilho pra direita, ao cruzar de volta),
                   abaixo: linha (opcional: só se os pés estão ABAIXO do topo
                         dessa linha — ex.: caiu no buraco),
                   acima: linha (opcional: só se os pés estão ACIMA do topo
                         dessa linha — ex.: está pulando / na plataforma de cima) }
     Grupo com alguma armadilha 'aparece' começa invisível.
     Várias armadilhas podem mexer no mesmo grupo (ex.: vai e volta com atraso).
     textos: { c: coluna, r: linha, t: 'texto' } — dicas desenhadas no cenário.
     guias (opcional): corujas "clone" que o jogador NÃO controla:
       { tipo: 'traidora' | 'confiavel',
         c, r: célula onde ela começa em pé,
         ativa: coluna — quando o jogador passa, ela diz "Me siga" e sai andando,
         caminho: [ passos, em ordem ]
           { c }            anda até a coluna (mesma altura)
           { c, r }         pula até a célula (arco)
           { espera: ms }   para um tempo
           { fala: 'txt' }  balão de fala
           { aguarda: 'g' } espera o grupo g disparar e terminar (ex.: bloco cair) }
       A guia atravessa tudo (não sofre armadilha): quem dispara é SEMPRE o
       jogador. Traidora: ri quando o jogador morre. Confiável: agradece no fim.
  ══════════════════════════════════════════════════════════════ */
  var FASES = [
    {
      nome: 'Tutorial',
      cores: { fundo: '#f2a541', chao: '#2b1d14', pano: '#fff6e5' },
      mapa: [
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '........................####................',
        '..S.......^.............####............F...',
        '################...##############aaa########',
        '################...##############aaa########'
      ],
      armadilhas: [
        { g: 'a', gatilho: 31, acao: 'cai' }
      ],
      textos: [
        { c: 2, r: 5, t: '← → andar   ▲ pular' },
        { c: 9, r: 6, t: 'pule!' },
        { c: 21, r: 5, t: 'segure = mais alto' },
        { c: 30, r: 6, t: 'tá tranquilo...' }
      ]
    },
    {
      nome: 'Nada é o que parece',
      cores: { fundo: '#7cc4d4', chao: '#16263a', pano: '#fff6e5' },
      mapa: [
        '.........................bbb................................',
        '.........................bbb................................',
        '.........................bbb................................',
        '.........................bbb................................',
        '.........................bbb................................',
        '.........................bbb....#####.......................',
        '.........................bbb....vvvvv.......................',
        '............................................................',
        '............................................................',
        '..S.....^.....11..................^.................F.......',
        '##################...###########################ccc#########',
        '##################...###########################ccc#########'
      ],
      armadilhas: [
        { g: '1', gatilho: 12, acao: 'aparece' },
        { g: 'b', gatilho: 23.5, acao: 'cai', mata: true },
        { g: 'c', gatilho: 47, acao: 'cai' },
        { g: 'bandeira', gatilho: 47, acao: 'move', dx: 5, vel: 160 }
      ],
      textos: [
        { c: 2, r: 5, t: 'agora é sério' },
        { c: 31, r: 3, t: 'pulinho curto...' }
      ]
    },
    {
      nome: 'Sujeira total',
      cores: { fundo: '#d8573f', chao: '#240c0c', pano: '#fff6e5' },
      mapa: [
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................gg..hh..........',
        '..................................................................',
        '...............##..dd..##.........................................',
        '..S...............................2.........................33.F..',
        '#####aaa#####^^^^^^^^^^^^^##############eee##fff##################',
        '#####aaa################################eee##fff##################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 4, acao: 'cai' },
        { g: 'd', gatilho: 19.3, acao: 'some', atraso: 350 },
        { g: '2', gatilho: 30, acao: 'move', dx: -3, vel: 130 },
        { g: 'e', gatilho: 39.5, acao: 'cai' },
        { g: 'f', gatilho: 44, acao: 'cai' },
        { g: 'g', gatilho: 49, acao: 'cai', mata: true },
        { g: 'h', gatilho: 49, acao: 'cai', mata: true, atraso: 700 },
        { g: '3', gatilho: 58, acao: 'aparece' }
      ],
      textos: [
        { c: 3, r: 5, t: 'boa sorte :)' }
      ]
    },
    {
      nome: 'Não pare',
      cores: { fundo: '#9bd17a', chao: '#1d2b16', pano: '#fff6e5' },
      mapa: [
        '....................................................',
        '....................................................',
        '....................................................',
        '....................................................',
        '....................................................',
        '....................................................',
        '....................................................',
        '....................................................',
        '....................................................',
        '..S....................................11......F....',
        '##########abcdefghijkl########...###################',
        '##########............########...###################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 10.5, acao: 'cai', atraso: 150 },
        { g: 'b', gatilho: 11.5, acao: 'cai', atraso: 150 },
        { g: 'c', gatilho: 12.5, acao: 'cai', atraso: 150 },
        { g: 'd', gatilho: 13.5, acao: 'cai', atraso: 150 },
        { g: 'e', gatilho: 14.5, acao: 'cai', atraso: 150 },
        { g: 'f', gatilho: 15.5, acao: 'cai', atraso: 150 },
        { g: 'g', gatilho: 16.5, acao: 'cai', atraso: 150 },
        { g: 'h', gatilho: 17.5, acao: 'cai', atraso: 150 },
        { g: 'i', gatilho: 18.5, acao: 'cai', atraso: 150 },
        { g: 'j', gatilho: 19.5, acao: 'cai', atraso: 150 },
        { g: 'k', gatilho: 20.5, acao: 'cai', atraso: 150 },
        { g: 'l', gatilho: 21.5, acao: 'cai', atraso: 150 },
        { g: '1', gatilho: 36, acao: 'aparece' }
      ],
      textos: [{ c: 2, r: 5, t: 'o chão tá cansado' }, { c: 23, r: 5, t: 'ufa...' }]
    },
    {
      nome: 'Pra trás',
      cores: { fundo: '#b7a6e8', chao: '#221a3b', pano: '#fff6e5' },
      mapa: [
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '..S.........1..............................F....',
        '####################aaa#########################',
        '####################aaa#########################'
      ],
      armadilhas: [
        { g: 'bandeira', gatilho: 37, acao: 'move', dy: -6, vel: 220 },
        { g: 'bandeira', gatilho: 37, acao: 'move', dx: -35, vel: 320, atraso: 450 },
        { g: 'bandeira', gatilho: 37, acao: 'move', dy: 6, vel: 220, atraso: 2300 },
        { g: 'a', gatilho: 26, lado: 'esq', acao: 'cai' },
        { g: '1', gatilho: 16, lado: 'esq', acao: 'aparece' }
      ],
      textos: [{ c: 28, r: 5, t: 'tá quase!' }]
    },
    {
      nome: 'Espinhos andantes',
      cores: { fundo: '#f0c75e', chao: '#2e2410', pano: '#fff6e5' },
      mapa: [
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '..S...........1.........22......3...........^...4......F....',
        '############################################################',
        '############################################################'
      ],
      armadilhas: [
        { g: '1', gatilho: 6, acao: 'move', dx: -6, vel: 90 },
        { g: '2', gatilho: 16, acao: 'move', dx: -7, vel: 150 },
        { g: '3', gatilho: 29.5, acao: 'move', dx: 4, vel: 105 },
        { g: '4', gatilho: 43.5, acao: 'aparece' }
      ],
      textos: [{ c: 2, r: 5, t: 'eles andam?' }]
    },
    {
      nome: 'Chuva de teto',
      cores: { fundo: '#8fb8de', chao: '#14202e', pano: '#fff6e5' },
      mapa: [
        '.........aa......bb......cc......dd..ee......ff.........',
        '.........aa......bb......cc......dd..ee......ff.........',
        '.........aa......bb......cc......dd..ee......ff.........',
        '.........aa......bb......cc......dd..ee......ff.........',
        '.........aa......bb......cc......dd..ee......ff.........',
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '..S.................................................F...',
        '########################################################',
        '########################################################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 7, acao: 'cai', mata: true },
        { g: 'b', gatilho: 14, acao: 'cai', mata: true, atraso: 250 },
        { g: 'c', gatilho: 29, acao: 'cai', mata: true },
        { g: 'd', gatilho: 31, acao: 'cai', mata: true },
        { g: 'e', gatilho: 31, acao: 'cai', mata: true, atraso: 600 },
        { g: 'f', gatilho: 47.2, acao: 'cai', mata: true }
      ],
      textos: [{ c: 2, r: 6, t: 'olha pra cima' }]
    },
    {
      nome: 'Espinho tímido',
      cores: { fundo: '#e89aa8', chao: '#2d141a', pano: '#fff6e5' },
      mapa: [
        '...........######..............#######................',
        '...........######..............#######................',
        '...........######..............#######................',
        '...........######..............#######................',
        '...........######..............#######................',
        '...........######..............#######................',
        '...........vvvvvv..............#######................',
        '...............................vvvvvvv................',
        '......................................................',
        '..S.........111.........^^.......222.............F....',
        '######################################################',
        '######################################################'
      ],
      armadilhas: [
        { g: '1', gatilho: 10.5, acao: 'some' },
        { g: '2', gatilho: 31.5, acao: 'some' }
      ],
      textos: [{ c: 3, r: 4, t: 'espinho tímido...' }, { c: 20, r: 5, t: '...esse não' }]
    },
    {
      nome: 'Plataforma fujona',
      cores: { fundo: '#7fd6c2', chao: '#10281f', pano: '#fff6e5' },
      mapa: [
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................##..............',
        '..S.............aaa.................bb..............F...',
        '##############........############...........###########',
        '##############........############^^^^^^^^^^^###########'
      ],
      armadilhas: [
        { g: 'a', gatilho: 11.5, acao: 'move', dx: 4, vel: 150 },
        { g: 'a', gatilho: 11.5, acao: 'move', dx: -4, vel: 150, atraso: 1600 },
        { g: 'b', gatilho: 36, acao: 'move', dy: 3, vel: 55 }
      ],
      textos: [{ c: 3, r: 5, t: 'paciência' }]
    },
    {
      nome: 'Me siga',
      cores: { fundo: '#c9b7e0', chao: '#221733', pano: '#fff6e5' },
      mapa: [
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '...................##...##...##.................',
        '................................................',
        '..S............##..........................F....',
        '#################aaaaaaaaaaaaaa#################',
        '#################..............#################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 19.5, acao: 'cai' }
      ],
      guias: [
        { tipo: 'traidora', c: 12, r: 9, ativa: 5,
          caminho: [
            { c: 13.6 },
            { c: 15.6, r: 8 },
            { c: 18, r: 9 },
            { c: 34 },
            { fala: 'Vem!' }
          ] }
      ],
      textos: []
    },
    {
      nome: 'Pula aqui',
      cores: { fundo: '#f5a97f', chao: '#2e160c', pano: '#fff6e5' },
      mapa: [
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '........................................................',
        '......................111111111111......................',
        '................##################......................',
        '........................................................',
        '.............##.........................................',
        '..S.......##.##......#.....#..........^...........F.....',
        '########################################################',
        '########################################################'
      ],
      armadilhas: [
        { g: '1', gatilho: 21, acima: 7, acao: 'aparece' }
      ],
      guias: [
        { tipo: 'traidora', c: 7, r: 9, ativa: 3,
          caminho: [
            { c: 8.6 },
            { c: 10.6, r: 8 },
            { c: 13.6, r: 7 },
            { c: 16.6, r: 5 },
            { c: 33 },
            { c: 36, r: 9 },
            { c: 40 }
          ] }
      ],
      textos: []
    },
    {
      nome: 'Confia?',
      cores: { fundo: '#a8d8ea', chao: '#0f2530', pano: '#fff6e5' },
      mapa: [
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '..................11............................',
        '..................##............................',
        '..S........................................F....',
        '################........########################',
        '################bbbbbbbb########################'
      ],
      armadilhas: [
        { g: 'b', gatilho: 16, abaixo: 10, acao: 'aparece' },
        { g: '1', gatilho: 16.8, acima: 10, acao: 'aparece' }
      ],
      guias: [
        { tipo: 'confiavel', c: 12, r: 9, ativa: 4,
          caminho: [
            { c: 15.3 },
            { c: 17, r: 10 },
            { c: 22.6 },
            { c: 25, r: 9 },
            { c: 30 }
          ] }
      ],
      textos: []
    },
    {
      nome: 'Caminho de cima',
      cores: { fundo: '#b5d99c', chao: '#18260f', pano: '#fff6e5' },
      mapa: [
        '.......................dd...........................',
        '.......................dd...........................',
        '.......................dd...........................',
        '.......................dd...........................',
        '.......................dd...........................',
        '....................................................',
        '....................................................',
        '..................##...##...##......................',
        '....................................................',
        '..S...........##..............................F.....',
        '##################aaaaaaaaaaaa######################',
        '##################aaaaaaaaaaaa######################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 19.5, abaixo: 9, acao: 'cai' },
        { g: 'd', gatilho: 18.8, acima: 8, acao: 'cai', mata: true, atraso: 400 }
      ],
      guias: [
        { tipo: 'confiavel', c: 10, r: 9, ativa: 3,
          caminho: [
            { c: 12.6 },
            { c: 14.5, r: 8 },
            { c: 18.5, r: 6 },
            { c: 19.4 },
            { fala: 'Espera...' },
            { aguarda: 'd' },
            { c: 23.5, r: 6 },
            { c: 28.5, r: 6 },
            { c: 31.5, r: 9 },
            { c: 34 }
          ] }
      ],
      textos: []
    },
    {
      nome: 'Duas corujas',
      cores: { fundo: '#e0c3f0', chao: '#26143a', pano: '#fff6e5' },
      mapa: [
        '............######....aa..............................................',
        '............######....aa..............................................',
        '............######....aa..............................................',
        '............######....aa..............................................',
        '............######....aa..............................................',
        '............######....................................................',
        '............vvvvvv.............................22.....................',
        '..........................................##...##...##................',
        '......................................................................',
        '..S..........111......................##..................^.......F...',
        '######################################################################',
        '######################################################################'
      ],
      armadilhas: [
        { g: '1', gatilho: 11, acao: 'some' },
        { g: 'a', gatilho: 18, acao: 'cai', mata: true, atraso: 400 },
        { g: '2', gatilho: 45.5, acima: 9, acao: 'aparece' }
      ],
      guias: [
        { tipo: 'confiavel', c: 8, r: 9, ativa: 2,
          caminho: [
            { c: 11.2 },
            { aguarda: '1' },
            { c: 19 },
            { fala: 'Espera...' },
            { aguarda: 'a' },
            { c: 28 }
          ] },
        { tipo: 'traidora', c: 35, r: 9, ativa: 30,
          caminho: [
            { c: 36.6 },
            { c: 38.5, r: 8 },
            { c: 42.5, r: 6 },
            { c: 47.5, r: 6 },
            { c: 52.5, r: 6 },
            { c: 55, r: 9 },
            { c: 56 }
          ] }
      ],
      textos: []
    },
    {
      nome: 'Final',
      cores: { fundo: '#f2a541', chao: '#2b1d14', pano: '#fff6e5' },
      mapa: [
        '.....................######.....ii..............................................',
        '.....................######.....ii..............................................',
        '.....................######.....ii..............................................',
        '.....................######.....ii..............................................',
        '.....................######.....ii..............................................',
        '.....................######.....................................................',
        '.....................vvvvvv.....................................................',
        '.....................................................##...##....................',
        '................................................................................',
        '..S...................111...................2....##....................3...F....',
        '########abcdefgh###################################xxxxxxxxxxxx#################',
        '########........###################################............#################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 8.5, acao: 'cai', atraso: 150 },
        { g: 'b', gatilho: 9.5, acao: 'cai', atraso: 150 },
        { g: 'c', gatilho: 10.5, acao: 'cai', atraso: 150 },
        { g: 'd', gatilho: 11.5, acao: 'cai', atraso: 150 },
        { g: 'e', gatilho: 12.5, acao: 'cai', atraso: 150 },
        { g: 'f', gatilho: 13.5, acao: 'cai', atraso: 150 },
        { g: 'g', gatilho: 14.5, acao: 'cai', atraso: 150 },
        { g: 'h', gatilho: 15.5, acao: 'cai', atraso: 150 },
        { g: '1', gatilho: 20, acao: 'some' },
        { g: 'i', gatilho: 29, acao: 'cai', mata: true, atraso: 250 },
        { g: '2', gatilho: 37, acao: 'move', dx: -5, vel: 140 },
        { g: 'x', gatilho: 53.5, acao: 'cai' },
        { g: '3', gatilho: 68.5, acao: 'aparece' }
      ],
      guias: [
        { tipo: 'traidora', c: 47, r: 9, ativa: 42,
          caminho: [
            { c: 48.6 },
            { c: 50.5, r: 8 },
            { c: 52, r: 9 },
            { c: 64 },
            { fala: 'Última, juro!' }
          ] }
      ],
      textos: [{ c: 2, r: 5, t: 'tudo junto agora' }]
    }
  ];

  /* ── Estado do módulo ───────────────────────────────────────── */
  var root = null, wrap, canvas, ctx, elFase, elMortes, elMenu, elFim, elBanner, elControles, elFasesLista;
  var elGirar, elBtnGirar, elDpad;
  var img = new Image(), imgOk = false;
  var montado = false, ativo = false, raf = 0, ultimoT = 0, acumulado = 0;
  var estado = 'menu';          // menu | jogando | morto | vitoria | fim
  var faseIdx = 0, fase = null, nivel = null;
  var p = null, grupos = null, armadilhas = null, guias = [], particulas = [];
  var risos = 0;                // quantas vezes a traidora já riu nesta fase (alterna a risada)
  var timerEstado = 0, tempoAnim = 0, tremor = 0;
  var mortesFase = 0, mortesTotal = 0;
  var cam = { x: 0, y: 0, s: 1, vw: 0, vh: 0, reservaBaixo: 0 };
  var inp = { esq: false, dir: false, pulo: false };
  var puloPonteiros = {}, dpadPonteiros = {}, toques = {}, teclas = {};
  var girarFechado = false, girarVisivel = false, orientacaoTravada = false;
  var medida = { cw: 0, ch: 0, toque: null, reservaCss: 0 };

  /* ── Utilidades ─────────────────────────────────────────────── */
  function _som(m, args) {
    var G = window.AngatubaGames;
    if (G && G.som && typeof G.som[m] === 'function') { try { G.som[m].apply(G.som, args || []); } catch (e) {} }
  }
  function _vibrar(padrao) { if (navigator.vibrate) { try { navigator.vibrate(padrao); } catch (e) {} } }
  function _lerProgresso() {
    try { var v = parseInt(localStorage.getItem(CHAVE_PROGRESSO), 10); return isNaN(v) ? 0 : Math.max(0, Math.min(FASES.length - 1, v)); } catch (e) { return 0; }
  }
  function _salvarProgresso(v) { try { localStorage.setItem(CHAVE_PROGRESSO, String(v)); } catch (e) {} }
  function _sobrepoe(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function _ehGrupoBloco(ch) { return ch >= 'a' && ch <= 'z'; }
  function _ehGrupoEspinho(ch) { return ch >= '1' && ch <= '9'; }

  /* ── Leitura da fase (dados → estrutura) ───────────────────── */
  function _lerFase(def) {
    var H = def.mapa.length, W = def.mapa[0].length;
    var solido = new Uint8Array(W * H);
    var perigos = [], gruposDef = {}, inicio = null, bandeira = null;
    function gdef(id) { return gruposDef[id] || (gruposDef[id] = { id: id, blocos: [], espinhos: [] }); }
    for (var r = 0; r < H; r++) {
      var linha = def.mapa[r];
      if (linha.length !== W) throw new Error('Fase "' + def.nome + '": linha ' + r + ' com tamanho diferente');
      for (var c = 0; c < W; c++) {
        var ch = linha.charAt(c);
        if (ch === '#') solido[r * W + c] = 1;
        else if (ch === '^') perigos.push({ x: c * T + 3, y: r * T + 9, w: 10, h: 7 });
        else if (ch === 'v') perigos.push({ x: c * T + 3, y: r * T, w: 10, h: 7 });
        else if (ch === 'S') inicio = { x: c * T + (T - PW) / 2, y: (r + 1) * T - PH };
        else if (ch === 'F') bandeira = { x: c * T, y: (r + 1) * T };
        else if (_ehGrupoBloco(ch)) gdef(ch).blocos.push({ c: c, r: r });
        else if (_ehGrupoEspinho(ch)) gdef(ch).espinhos.push({ c: c, r: r });
      }
    }
    if (!inicio) inicio = { x: T, y: (H - 3) * T - PH };
    if (!bandeira) bandeira = { x: (W - 2) * T, y: (H - 2) * T };
    // Colunas cujo chão/teto encosta na borda: estendidas até fora da tela
    var extBaixo = [], extCima = [];
    for (c = 0; c < W; c++) {
      if (solido[(H - 1) * W + c]) extBaixo.push(c);
      if (solido[c]) extCima.push(c);
    }
    return { def: def, W: W, H: H, LW: W * T, LH: H * T, solido: solido, perigos: perigos,
             gruposDef: gruposDef, inicio: inicio, bandeira: bandeira,
             extBaixo: extBaixo, extCima: extCima, camada: _desenharCamadaEstatica(def, W, H, solido) };
  }

  // Espinho em pixel art (triângulo de 14px de base, 8 de altura)
  function _pintarEspinho(g, x, y, praBaixo) {
    for (var i = 0; i < 8; i++) {
      var yy = praBaixo ? y + i : y + 15 - i;
      var meia = 7 - i;
      g.fillRect(x + 8 - meia - 1, yy, (meia + 1) * 2, 1);
    }
  }

  function _desenharCamadaEstatica(def, W, H, solido) {
    var cv = document.createElement('canvas');
    cv.width = W * T; cv.height = H * T;
    var g = cv.getContext('2d');
    g.fillStyle = def.cores.chao;
    for (var r = 0; r < H; r++) {
      for (var c = 0; c < W; c++) {
        var ch = def.mapa[r].charAt(c);
        if (solido[r * W + c]) g.fillRect(c * T, r * T, T, T);
        else if (ch === '^') _pintarEspinho(g, c * T, r * T, false);
        else if (ch === 'v') _pintarEspinho(g, c * T, r * T, true);
      }
    }
    return cv;
  }

  /* ── Vida nova (reset de fase: armadilhas e guias voltam ao lugar) ── */
  function _iniciarVida() {
    grupos = {};
    var gd = nivel.gruposDef;
    for (var id in gd) {
      grupos[id] = { id: id, blocos: gd[id].blocos, espinhos: gd[id].espinhos,
                     ox: 0, oy: 0, vy: 0, visivel: true, caindo: false, mata: false,
                     alvo: null, vel: 0, surgir: 1, dx: 0, dy: 0, feito: false };
    }
    grupos.bandeira = { id: 'bandeira', blocos: [], espinhos: [], ox: 0, oy: 0, vy: 0, visivel: true,
                        caindo: false, mata: false, alvo: null, vel: 0, surgir: 1, dx: 0, dy: 0, feito: false };
    armadilhas = [];
    var lista = fase.armadilhas || [];
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!grupos[a.g]) continue;
      if (a.acao === 'aparece') grupos[a.g].visivel = false;
      armadilhas.push({ def: a, disparada: false, armada: false, timer: -1 });
    }
    p = { x: nivel.inicio.x, y: nivel.inicio.y, w: PW, h: PH, vx: 0, vy: 0, noChao: false, coyote: 0, buffer: 0,
          olhando: 1, chaoGrupo: null, pouso: 0, visivel: true };
    guias = [];
    var gl = fase.guias || [];
    for (i = 0; i < gl.length; i++) {
      var d = gl[i];
      guias.push({ def: d, x: d.c * T + (T - PW) / 2, y: (d.r + 1) * T - PH, olhando: -1,
                   ativa: false, passo: 0, t: 0, emPasso: false, andando: false, noAr: false,
                   pausa: 0, fala: '', falaT: 0, falaIdade: 0, fim: false, agradeceu: false, zombou: false });
    }
    particulas = [];
    estado = 'jogando';
    _atualizarHud();
  }

  function _comecarFase(i) {
    faseIdx = Math.max(0, Math.min(FASES.length - 1, i));
    fase = FASES[faseIdx];
    try { nivel = _lerFase(fase); } catch (e) { if (window.console) console.error('[Armadilha]', e); return; }
    mortesFase = 0; risos = 0;
    if (wrap) wrap.style.background = fase.cores.fundo;
    _esconder(elMenu); _esconder(elFim); _esconder(elBanner);
    _iniciarVida();
    cam.x = null; // força a câmera a pular direto pra coruja
  }

  /* ── Colisão ────────────────────────────────────────────────── */
  function _solidoEstatico(c, r) {
    if (r < 0 || r >= nivel.H || c < 0 || c >= nivel.W) return false;
    return nivel.solido[r * nivel.W + c] === 1;
  }

  // Lista de retângulos sólidos que tocam o retângulo "ret"
  function _solidosEm(ret) {
    var out = [];
    var c0 = Math.floor(ret.x / T), c1 = Math.floor((ret.x + ret.w - 0.001) / T);
    var r0 = Math.floor(ret.y / T), r1 = Math.floor((ret.y + ret.h - 0.001) / T);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      if (_solidoEstatico(c, r)) out.push({ x: c * T, y: r * T, w: T, h: T, g: null });
    }
    for (var id in grupos) {
      var g = grupos[id];
      if (!g.visivel || !g.blocos.length) continue;
      for (var i = 0; i < g.blocos.length; i++) {
        var b = g.blocos[i], rb = { x: b.c * T + g.ox, y: b.r * T + g.oy, w: T, h: T, g: g };
        if (_sobrepoe(ret, rb)) out.push(rb);
      }
    }
    return out;
  }

  function _moverX(dx) {
    if (!dx) return;
    p.x += dx;
    var hs = _solidosEm(p);
    for (var i = 0; i < hs.length; i++) {
      var s = hs[i];
      if (!_sobrepoe(p, s)) continue;
      // Encostado por cima/baixo com erro de arredondamento (plataforma que
      // desce levando a coruja): não é parede — senão ela é empurrada pra fora
      if (p.y + PH - s.y < 0.05 || s.y + s.h - p.y < 0.05) continue;
      if (dx > 0) p.x = s.x - PW; else p.x = s.x + s.w;
      p.vx = 0;
    }
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x > nivel.LW - PW) { p.x = nivel.LW - PW; p.vx = 0; }
  }

  function _moverY(dy) {
    if (!dy) return;
    p.y += dy;
    var hs = _solidosEm(p);
    for (var i = 0; i < hs.length; i++) {
      var s = hs[i];
      if (!_sobrepoe(p, s)) continue;
      if (dy > 0) { p.y = s.y - PH; p.noChao = true; p.chaoGrupo = s.g; }
      else p.y = s.y + s.h;
      p.vy = 0;
    }
  }

  function _tocaPerigo() {
    var i, pr = nivel.perigos;
    for (i = 0; i < pr.length; i++) if (_sobrepoe(p, pr[i])) return true;
    var infl = { x: p.x - 1, y: p.y - 1, w: PW + 2, h: PH + 2 };
    for (var id in grupos) {
      var g = grupos[id];
      if (!g.visivel) continue;
      for (i = 0; i < g.espinhos.length; i++) {
        var e = g.espinhos[i];
        if (_sobrepoe(p, { x: e.c * T + 3 + g.ox, y: e.r * T + 9 + g.oy, w: 10, h: 7 })) return true;
      }
      if (g.mata) {
        for (i = 0; i < g.blocos.length; i++) {
          var b = g.blocos[i];
          if (_sobrepoe(infl, { x: b.c * T + g.ox, y: b.r * T + g.oy, w: T, h: T })) return true;
        }
      }
    }
    return false;
  }

  /* ── Armadilhas ─────────────────────────────────────────────── */
  function _executar(a) {
    var g = grupos[a.g];
    if (!g) return;
    g.feito = true;
    if (a.mata) g.mata = true;
    if (a.acao === 'cai') { g.caindo = true; g.vy = 0; }
    else if (a.acao === 'some') g.visivel = false;
    else if (a.acao === 'aparece') { g.visivel = true; g.surgir = 0; }
    else if (a.acao === 'move') {
      g.alvo = { x: g.ox + (a.dx || 0) * T, y: g.oy + (a.dy || 0) * T };
      g.vel = a.vel || 120;
    }
  }

  // Condição de disparo: coluna do centro (+ lado/altura opcionais)
  function _gatilhoOk(a, centro) {
    var d = a.def, gx = d.gatilho * T, pes = p.y + PH;
    if (d.abaixo !== undefined && !(pes > d.abaixo * T)) return false;
    if (d.acima !== undefined && !(pes < d.acima * T)) return false;
    if (d.lado === 'esq') {
      if (centro > gx) a.armada = true;
      return a.armada && centro <= gx;
    }
    return centro >= gx;
  }

  function _atualizarArmadilhas(dt) {
    var centro = p.x + PW / 2;
    for (var i = 0; i < armadilhas.length; i++) {
      var a = armadilhas[i];
      if (a.def.lado === 'esq' && centro > a.def.gatilho * T) a.armada = true;
      if (!a.disparada && _gatilhoOk(a, centro)) {
        a.disparada = true;
        a.timer = (a.def.atraso || 0) / 1000;
      }
      if (a.disparada && a.timer >= 0) {
        a.timer -= dt;
        if (a.timer < 0) _executar(a.def);
      }
    }
    for (var id in grupos) {
      var g = grupos[id];
      g.dx = 0; g.dy = 0;
      if (g.surgir < 1) g.surgir = Math.min(1, g.surgir + dt / 0.08);
      if (g.caindo) {
        g.vy = Math.min(g.vy + GRAV * dt, 900);
        g.oy += g.vy * dt; g.dy = g.vy * dt;
        if (g.oy > nivel.LH + 480) { g.caindo = false; g.visivel = false; }
      } else if (g.alvo) {
        var ddx = g.alvo.x - g.ox, ddy = g.alvo.y - g.oy, dist = Math.sqrt(ddx * ddx + ddy * ddy);
        var passo = g.vel * dt;
        if (dist <= passo) { g.dx = ddx; g.dy = ddy; g.ox = g.alvo.x; g.oy = g.alvo.y; g.alvo = null; }
        else { g.dx = ddx / dist * passo; g.dy = ddy / dist * passo; g.ox += g.dx; g.oy += g.dy; }
      }
    }
  }

  /* ── Coruja guia (clone que o jogador só observa) ───────────── */
  function _falar(gu, txt, seg) { gu.fala = txt; gu.falaT = seg; gu.falaIdade = 0; }

  // Grupo já disparou e terminou (caiu pra longe / sumiu / chegou no alvo)?
  function _grupoTerminou(id) {
    var g = grupos[id];
    if (!g) return true;
    if (!g.feito) return false;
    if (g.caindo) return g.oy > 7 * T;
    return !g.alvo;
  }

  function _atualizarGuias(dt) {
    var pc = p.x + PW / 2;
    for (var i = 0; i < guias.length; i++) {
      var gu = guias[i], d = gu.def, cam_ = d.caminho || [];
      gu.andando = false;
      if (!gu.ativa) {
        if (pc >= d.ativa * T) { gu.ativa = true; gu.pausa = 0.55; _falar(gu, d.fala || 'Me siga', 1.6); }
        else { gu.olhando = pc < gu.x + PW / 2 ? -1 : 1; continue; }
      }
      if (gu.pausa > 0) { gu.pausa -= dt; continue; }
      if (gu.passo >= cam_.length) {
        // Fim do caminho: espera virada pro jogador
        if (!gu.fim) gu.fim = true;
        if (!gu.noAr) gu.olhando = pc < gu.x + PW / 2 ? -1 : 1;
        var perto = Math.abs(pc - (gu.x + PW / 2)) < T * 1.6 && Math.abs(p.y - gu.y) < T * 1.5;
        if (perto && d.tipo === 'confiavel' && !gu.agradeceu) { gu.agradeceu = true; _falar(gu, 'Obrigado pela confiança', 2.2); }
        else if (perto && d.tipo === 'traidora' && !gu.zombou) { gu.zombou = true; _falar(gu, 'Sortudo...', 1.6); }
        continue;
      }
      var s = cam_[gu.passo];
      // Não sai na frente sozinha: espera o jogador chegar perto (antes de começar um passo)
      if (!gu.emPasso && s.c !== undefined && (gu.x - p.x) > GUIA_LONGE * T) continue;
      var proximo = false;
      if (s.fala !== undefined) { _falar(gu, s.fala, (s.ms || 1500) / 1000); proximo = true; }
      else if (s.espera !== undefined) {
        gu.emPasso = true; gu.t += dt;
        if (gu.t >= s.espera / 1000) proximo = true;
      } else if (s.aguarda !== undefined) {
        gu.olhando = pc < gu.x + PW / 2 ? -1 : 1;
        if (_grupoTerminou(s.aguarda)) proximo = true;
      } else if (s.r === undefined) {
        // anda até a coluna
        var alvoX = s.c * T + (T - PW) / 2, dx = alvoX - gu.x, vel = (d.vel || GUIA_VEL) * dt;
        gu.emPasso = true;
        if (Math.abs(dx) <= vel) { gu.x = alvoX; proximo = true; }
        else { gu.x += dx > 0 ? vel : -vel; gu.olhando = dx > 0 ? 1 : -1; gu.andando = true; }
      } else {
        // pulo em arco até a célula
        if (!gu.emPasso) {
          gu.emPasso = true; gu.t = 0;
          gu.x0 = gu.x; gu.y0 = gu.y;
          gu.x1 = s.c * T + (T - PW) / 2; gu.y1 = (s.r + 1) * T - PH;
          var sobe = gu.y0 - gu.y1;
          gu.alt = sobe > 0 ? sobe + 18 : 16;
          gu.dur = 0.32 + Math.abs(gu.x1 - gu.x0) / 320 + Math.abs(sobe) / 500;
          gu.olhando = gu.x1 >= gu.x0 ? 1 : -1;
          _som('pulo');
        }
        gu.t += dt; gu.noAr = true;
        var k = Math.min(1, gu.t / gu.dur);
        gu.x = gu.x0 + (gu.x1 - gu.x0) * k;
        gu.y = gu.y0 + (gu.y1 - gu.y0) * k - gu.alt * 4 * k * (1 - k);
        if (k >= 1) { gu.noAr = false; proximo = true; }
      }
      if (proximo) { gu.passo++; gu.t = 0; gu.emPasso = false; }
    }
  }

  // A guia "da vez" (a última que o jogador ativou) reage à morte
  function _guiaDaVez() {
    var melhor = null;
    for (var i = 0; i < guias.length; i++) {
      var gu = guias[i];
      if (gu.ativa && (!melhor || gu.def.ativa > melhor.def.ativa)) melhor = gu;
    }
    return melhor;
  }

  /* ── Passo de física ────────────────────────────────────────── */
  function _passo(dt) {
    // Plataforma que se move (não a que cai) carrega a coruja junto
    var chao = p.noChao ? p.chaoGrupo : null;
    _atualizarArmadilhas(dt);
    if (chao && !chao.caindo && (chao.dx || chao.dy)) { p.x += chao.dx; p.y += chao.dy; }
    // Bloco que apareceu/andou por cima da coruja = esmagada
    var sob = _solidosEm(p);
    for (var i = 0; i < sob.length; i++) if (_sobrepoe(p, sob[i]) && sob[i].g && sob[i].g !== chao) { _morrer(); return; }

    var dir = (inp.dir ? 1 : 0) - (inp.esq ? 1 : 0);
    if (dir) {
      p.vx += dir * (p.noChao ? ACEL_CHAO : ACEL_AR) * dt;
      if (p.vx > VEL) p.vx = VEL;
      if (p.vx < -VEL) p.vx = -VEL;
      p.olhando = dir;
    } else {
      var fr = (p.noChao ? FREIO_CHAO : FREIO_AR) * dt;
      p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr;
    }
    p.coyote = p.noChao ? COYOTE : p.coyote - dt;
    if (p.buffer > 0) p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PULO_V; p.buffer = 0; p.coyote = 0; p.noChao = false;
      _som('pulo');
    }
    if (!inp.pulo && p.vy < -PULO_CORTE) p.vy = -PULO_CORTE;   // pulo variável
    p.vy = Math.min(p.vy + GRAV * dt, QUEDA_MAX);

    var estavaNoChao = p.noChao;
    p.noChao = false; p.chaoGrupo = null;
    _moverX(p.vx * dt);
    _moverY(p.vy * dt);
    if (p.noChao && !estavaNoChao) p.pouso = 0.09;
    if (p.pouso > 0) p.pouso -= dt;

    if (p.y > nivel.LH + 24 || _tocaPerigo()) { _morrer(); return; }

    if (guias.length) _atualizarGuias(dt);

    var b = grupos.bandeira;
    var rb = { x: nivel.bandeira.x + b.ox + 3, y: nivel.bandeira.y + b.oy - 40, w: 10, h: 40 };
    if (_sobrepoe(p, rb)) _vencerFase();
  }

  function _morrer() {
    if (estado !== 'jogando') return;
    estado = 'morto'; timerEstado = T_RESPAWN; tremor = 0.18;
    mortesFase++; mortesTotal++;
    p.visivel = false;
    var cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (var i = 0; i < 18; i++) {
      var ang = Math.random() * Math.PI * 2, v = 60 + Math.random() * 140;
      particulas.push({ x: cx, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 120,
                        cor: CORES_PENAS[i % CORES_PENAS.length], vida: 0.7 + Math.random() * 0.3, t: i % 3 === 0 ? 3 : 2 });
    }
    // Coruja guia reage: traidora ri, confiável lamenta
    var gu = _guiaDaVez();
    if (gu) {
      if (gu.def.tipo === 'traidora') _falar(gu, RISADAS[risos++ % RISADAS.length], T_RESPAWN_FALA);
      else _falar(gu, 'Era só me seguir...', T_RESPAWN_FALA);
      timerEstado = T_RESPAWN_FALA;
    }
    _som('dano'); _vibrar(35);
    _atualizarHud();
  }

  function _vencerFase() {
    if (estado !== 'jogando') return;
    estado = 'vitoria'; timerEstado = T_VITORIA;
    for (var i = 0; i < guias.length; i++) {
      var gu = guias[i];
      if (gu.def.tipo === 'confiavel' && gu.ativa && !gu.agradeceu) {
        gu.agradeceu = true; _falar(gu, 'Obrigado pela confiança', T_VITORIA_FALA); timerEstado = T_VITORIA_FALA;
      }
    }
    var prox = faseIdx + 1;
    if (prox < FASES.length && prox > _lerProgresso()) _salvarProgresso(prox);
    _som('nivelUp'); _vibrar([20, 40, 20]);
    if (prox < FASES.length) _mostrarBanner('Fase ' + (faseIdx + 1) + ' concluída!');
  }

  function _atualizar(dt) {
    tempoAnim += dt;
    if (tremor > 0) tremor -= dt;
    for (var i = particulas.length - 1; i >= 0; i--) {
      var q = particulas[i];
      q.vida -= dt; q.vy += GRAV * 0.6 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.vida <= 0) particulas.splice(i, 1);
    }
    for (i = 0; i < guias.length; i++) {
      if (guias[i].falaT > 0) { guias[i].falaT -= dt; guias[i].falaIdade += dt; }
    }
    if (estado === 'jogando') {
      acumulado += dt;
      while (acumulado >= PASSO && estado === 'jogando') { _passo(PASSO); acumulado -= PASSO; }
    } else {
      acumulado = 0;
      if (estado === 'morto') {
        timerEstado -= dt;
        if (timerEstado <= 0) _iniciarVida();
      } else if (estado === 'vitoria') {
        timerEstado -= dt;
        if (timerEstado <= 0) {
          _esconder(elBanner);
          if (faseIdx + 1 < FASES.length) _comecarFase(faseIdx + 1);
          else _mostrarFim();
        }
      }
    }
    _atualizarCamera(dt);
  }

  /* ── Câmera + escala inteira ────────────────────────────────── */
  function _controlesNaTela() { return !!(elControles && elControles.offsetParent !== null); }

  function _redimensionar() {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
    var ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch;
    }
    // Controles de toque na tela (em pé OU deitado): a fase fica ACIMA dos
    // botões, senão a coruja anda por baixo do ◀ e some. Mede só quando o
    // tamanho muda (getBoundingClientRect todo quadro é desperdício).
    var toque = _controlesNaTela();
    if (cw !== medida.cw || ch !== medida.ch || toque !== medida.toque) {
      medida.cw = cw; medida.ch = ch; medida.toque = toque;
      medida.reservaCss = 0;
      if (toque) {
        var rw = wrap.getBoundingClientRect(), rc = elControles.getBoundingClientRect();
        medida.reservaCss = Math.max(0, rw.bottom - rc.top + 6);
      }
      _atualizarAvisoGirar();
    }
    var reservaDev = medida.reservaCss * dpr;
    var LH = nivel ? nivel.LH : 12 * T;
    var s = Math.floor(Math.min(cw / (MIN_TILES_LARG * T), Math.max(1, ch - reservaDev) / LH));
    cam.s = Math.max(1, s);
    cam.vw = cw / cam.s; cam.vh = ch / cam.s;
    cam.reservaBaixo = reservaDev / cam.s;
    ctx.imageSmoothingEnabled = false;
  }

  function _atualizarCamera(dt) {
    if (!nivel) return;
    var util = cam.vh - cam.reservaBaixo, alvoX, alvoY;
    if (nivel.LW <= cam.vw) alvoX = -(cam.vw - nivel.LW) / 2;
    else alvoX = Math.max(0, Math.min(nivel.LW - cam.vw, p.x + PW / 2 - cam.vw * 0.42));
    if (nivel.LH <= util) alvoY = -(util - nivel.LH) / 2;
    else alvoY = Math.max(0, Math.min(nivel.LH - util, p.y + PH / 2 - util / 2));
    if (cam.x === null || cam.x === undefined) { cam.x = alvoX; cam.y = alvoY; return; }
    var k = Math.min(1, dt * 9);
    cam.x += (alvoX - cam.x) * k;
    cam.y += (alvoY - cam.y) * k;
  }

  /* ── Desenho ────────────────────────────────────────────────── */
  function _desenhar() {
    _redimensionar();
    var cores = fase.cores;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var sx = 0, sy = 0;
    if (tremor > 0) { sx = Math.round(Math.random() * 2 - 1); sy = Math.round(Math.random() * 2 - 1); }
    var ox = Math.round(cam.x) - sx, oy = Math.round(cam.y) - sy;
    ctx.setTransform(cam.s, 0, 0, cam.s, -ox * cam.s, -oy * cam.s);
    ctx.imageSmoothingEnabled = false;

    // Textos de dica (atrás de tudo)
    if (fase.textos) {
      ctx.fillStyle = cores.chao; ctx.globalAlpha = 0.55;
      ctx.font = FONTE;
      ctx.textBaseline = 'top';
      for (var ti = 0; ti < fase.textos.length; ti++) {
        var tx = fase.textos[ti];
        ctx.fillText(tx.t, tx.c * T, tx.r * T + 4);
      }
      ctx.globalAlpha = 1;
    }

    // Grupos (antes da camada estática: o que cai passa "por trás" do chão)
    ctx.fillStyle = cores.chao;
    var EXT = 600;
    for (var id in grupos) {
      var g = grupos[id];
      if (!g.visivel || id === 'bandeira') continue;
      var gx = Math.round(g.ox), gy = Math.round(g.oy);
      for (var i = 0; i < g.blocos.length; i++) {
        var b = g.blocos[i], bx = b.c * T + gx, by = b.r * T + gy;
        ctx.fillRect(bx, by, T, T);
        if (b.r === nivel.H - 1) ctx.fillRect(bx, by + T, T, EXT);
        if (b.r === 0) ctx.fillRect(bx, by - EXT, T, EXT);
      }
      var sub = Math.round((1 - g.surgir) * 10);
      for (i = 0; i < g.espinhos.length; i++) {
        var e = g.espinhos[i];
        _pintarEspinho(ctx, e.c * T + gx, e.r * T + gy + sub, false);
      }
    }

    // Camada estática + chão/teto estendidos até fora da tela
    ctx.drawImage(nivel.camada, 0, 0);
    for (i = 0; i < nivel.extBaixo.length; i++) ctx.fillRect(nivel.extBaixo[i] * T, nivel.LH, T, EXT);
    for (i = 0; i < nivel.extCima.length; i++) ctx.fillRect(nivel.extCima[i] * T, -EXT, T, EXT);

    _desenharBandeira(cores);
    // Guias: mesmo sprite, levemente "fantasma" (dá pra distinguir quando encosta na sua)
    if (guias.length) {
      ctx.globalAlpha = 0.82;
      for (i = 0; i < guias.length; i++) _desenharCoruja(guias[i], _quadroGuia(guias[i]));
      ctx.globalAlpha = 1;
    }
    if (p && p.visivel) _desenharCoruja(p, _quadroCoruja());

    for (i = 0; i < particulas.length; i++) {
      var q = particulas[i];
      ctx.fillStyle = q.cor;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.t, q.t);
    }
    // Balões por cima de tudo
    for (i = 0; i < guias.length; i++) {
      var gu = guias[i];
      if (gu.falaT > 0 && gu.fala) _desenharBalao(gu.fala, gu.x + PW / 2, gu.y + PH - SPR_H, gu.falaIdade, cores.chao);
    }
  }

  function _desenharBandeira(cores) {
    var b = grupos.bandeira, x = Math.round(nivel.bandeira.x + b.ox), y = Math.round(nivel.bandeira.y + b.oy);
    ctx.fillStyle = cores.chao;
    ctx.fillRect(x + 7, y - 40, 2, 40);          // mastro
    ctx.fillRect(x + 4, y - 2, 8, 2);            // base
    ctx.fillStyle = cores.pano;
    var onda = Math.floor(tempoAnim * 4) % 2;
    for (var i = 0; i < 10; i++) {
      var w = 12 - Math.abs(i - 5) * 2;
      ctx.fillRect(x + 9, y - 39 + i + (i > 4 ? onda : 0), w, 1);
    }
  }

  // Balão de fala pixel: caixa clara com borda, rabinho apontando pra guia
  function _desenharBalao(txt, cx, topo, idade, corBorda) {
    ctx.font = FONTE;
    var w = Math.ceil(ctx.measureText(txt).width) + 8, h = 13;
    var pop = idade < 0.12 ? Math.round((0.12 - idade) / 0.04) : 0;   // "pulinho" ao aparecer
    var x = Math.round(cx - w / 2), y = Math.round(topo - h - 5) + pop;
    var minX = Math.round(cam.x) + 2, maxX = Math.round(cam.x + cam.vw) - w - 2;
    if (x > maxX) x = maxX;
    if (x < minX) x = minX;
    var tx = Math.round(cx);
    ctx.fillStyle = corBorda;
    ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillRect(tx - 3, y + h - 1, 7, 2); ctx.fillRect(tx - 2, y + h + 1, 5, 1); ctx.fillRect(tx - 1, y + h + 2, 3, 1);
    ctx.fillStyle = '#fff6e5';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillRect(tx - 2, y + h - 1, 5, 1); ctx.fillRect(tx - 1, y + h, 3, 1); ctx.fillRect(tx, y + h + 1, 1, 1);
    ctx.fillStyle = corBorda;
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x + 4, y + h / 2 + 0.5);
    ctx.textBaseline = 'top';
  }

  // Quadros do sheet: 0 normal, 1 abaixada (respira), 2 normal, 3 piscando
  var SEQ_IDLE = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 2, 3, 2, 0, 1, 1];
  function _quadroCoruja() {
    if (p.pouso > 0) return 1;
    if (!p.noChao) return 0;
    if (Math.abs(p.vx) > 20) return Math.floor(tempoAnim / 0.09) % 2 === 0 ? 0 : 1;
    return SEQ_IDLE[Math.floor(tempoAnim / 0.17) % SEQ_IDLE.length];
  }
  function _quadroGuia(gu) {
    if (gu.noAr) return 0;
    if (gu.andando) return Math.floor(tempoAnim / 0.09) % 2 === 0 ? 0 : 1;
    return SEQ_IDLE[(Math.floor(tempoAnim / 0.17) + 5) % SEQ_IDLE.length];   // defasada: não pisca junto
  }

  function _desenharCoruja(o, q) {
    var dx = Math.round(o.x + PW / 2 - SPR_W / 2), dy = Math.round(o.y + PH - SPR_H);
    if (!imgOk) {
      ctx.fillStyle = '#5b6b7f'; ctx.fillRect(Math.round(o.x), Math.round(o.y), PW, PH);
      return;
    }
    var fw = img.naturalWidth / 4, fh = img.naturalHeight;
    if (o.olhando < 0) {
      ctx.save();
      ctx.translate(dx + SPR_W, dy); ctx.scale(-1, 1);
      ctx.drawImage(img, q * fw, 0, fw, fh, 0, 0, SPR_W, SPR_H);
      ctx.restore();
    } else {
      ctx.drawImage(img, q * fw, 0, fw, fh, dx, dy, SPR_W, SPR_H);
    }
  }

  /* ── Loop ───────────────────────────────────────────────────── */
  function _loop(t) {
    raf = 0;
    if (!ativo) return;
    var dt = ultimoT ? Math.min(0.05, (t - ultimoT) / 1000) : 0;
    ultimoT = t;
    if (nivel) { _atualizar(dt); _desenhar(); }
    raf = requestAnimationFrame(_loop);
  }
  function _ligarLoop() { if (!raf && ativo) { ultimoT = 0; raf = requestAnimationFrame(_loop); } }
  function _desligarLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  /* ── HUD / overlays ─────────────────────────────────────────── */
  function _mostrar(el) { if (el) el.style.display = ''; }
  function _esconder(el) { if (el) el.style.display = 'none'; }
  function _atualizarHud() {
    if (elFase) elFase.textContent = 'Fase ' + (faseIdx + 1) + '/' + FASES.length;
    if (elMortes) elMortes.textContent = '☠ ' + mortesFase;
  }
  function _mostrarBanner(txt) {
    if (!elBanner) return;
    elBanner.textContent = txt;
    _mostrar(elBanner);
    elBanner.classList.remove('ar-banner-anim'); void elBanner.offsetWidth; elBanner.classList.add('ar-banner-anim');
  }

  function _abrirMenu() {
    estado = 'menu';
    _limparEntrada();
    var liberada = _lerProgresso(), html = '';
    for (var i = 0; i < FASES.length; i++) {
      var trava = i > liberada;
      html += '<button type="button" class="ar-fase-btn' + (trava ? ' ar-travada' : '') + '" data-fase="' + i + '"' + (trava ? ' disabled' : '') + '>' +
              '<span class="ar-fase-num">' + (trava ? '🔒' : (i + 1)) + '</span>' +
              '<span class="ar-fase-nome">' + FASES[i].nome + '</span></button>';
    }
    elFasesLista.innerHTML = html;
    _esconder(elFim); _esconder(elBanner);
    _mostrar(elMenu);
  }

  function _mostrarFim() {
    estado = 'fim';
    var el = root.querySelector('#ar-fim-mortes');
    if (el) el.textContent = mortesTotal === 0 ? 'Sem morrer nenhuma vez?! Lenda.' :
      ('Você morreu ' + mortesTotal + (mortesTotal === 1 ? ' vez' : ' vezes') + '. A coruja agradece a persistência.');
    _mostrar(elFim);
    _som('fim', [true]);
    var G = window.AngatubaGames;
    if (G && G.efeitos) G.efeitos.confete(elFim, 60);
  }

  /* ── Aviso "gira o celular" (só dentro do jogo) ─────────────── */
  function _atualizarAvisoGirar() {
    if (!elGirar) return;
    var emPe = wrap.clientHeight > wrap.clientWidth * 1.05;
    var mostrar = emPe && _controlesNaTela() && !girarFechado;
    if (mostrar !== girarVisivel) { girarVisivel = mostrar; elGirar.style.display = mostrar ? '' : 'none'; }
  }
  function _podeTravarOrientacao() {
    return !!(window.screen && screen.orientation && typeof screen.orientation.lock === 'function');
  }
  // Só funciona com o hub em tela cheia (Android/Chrome). iOS não deixa:
  // aí o botão some e fica só o texto pedindo pra girar.
  function _deitarTela() {
    if (!_podeTravarOrientacao()) { _esconder(elBtnGirar); return; }
    try {
      var pr = screen.orientation.lock('landscape');
      orientacaoTravada = true;
      if (pr && typeof pr.catch === 'function') pr.catch(function () { orientacaoTravada = false; _esconder(elBtnGirar); });
    } catch (e) { _esconder(elBtnGirar); }
  }
  function _destravarOrientacao() {
    if (!orientacaoTravada) return;
    orientacaoTravada = false;
    try { screen.orientation.unlock(); } catch (e) {}
  }

  /* ── Entrada: toque + mouse + teclado ───────────────────────── */
  function _limparEntrada() {
    inp.esq = inp.dir = inp.pulo = false;
    puloPonteiros = {}; dpadPonteiros = {}; toques = {}; teclas = {};
    if (wrap) wrap.querySelectorAll('.ar-on').forEach(function (b) { b.classList.remove('ar-on'); });
  }
  function _apertarPulo() { inp.pulo = true; if (p && estado === 'jogando') p.buffer = BUFFER_PULO; }

  // Estado final = união de toque (toques), mouse/caneta (ponteiros) e teclado
  function _recalcEntrada() {
    var e = !!teclas.esq, d = !!teclas.dir, pu = !!teclas.pulo, k;
    var te = false, td = false, tp = false;
    for (k in toques) { var z = toques[k]; if (z === 'esq') te = true; else if (z === 'dir') td = true; else if (z === 'pulo') tp = true; }
    for (k in dpadPonteiros) { if (dpadPonteiros[k] < 0) te = true; else td = true; }
    if (Object.keys(puloPonteiros).length) tp = true;
    inp.esq = e || te; inp.dir = d || td; inp.pulo = pu || tp;
    if (!wrap) return;
    var be = wrap.querySelector('.ar-esq'), bd = wrap.querySelector('.ar-dir'), bp = wrap.querySelector('.ar-pulo');
    if (be) be.classList.toggle('ar-on', te);
    if (bd) bd.classList.toggle('ar-on', td);
    if (bp) bp.classList.toggle('ar-on', tp);
  }

  // Botões/menus por cima do jogo: toque neles NÃO é controle (deixa o clique passar)
  function _ehUi(el) { return !!(el && el.closest && el.closest('.ar-hud, .ar-overlay, .ar-girar')); }

  // Qual lado do direcional: divide no meio entre ◀ e ▶ (com folga em volta)
  function _ladoDpad(x) {
    var r = elDpad.getBoundingClientRect();
    return x < r.left + r.width / 2 ? 'esq' : 'dir';
  }
  function _dentroDpad(x, y) {
    var r = elDpad.getBoundingClientRect();
    return x >= r.left - TOQUE_FOLGA && x <= r.right + TOQUE_FOLGA && y >= r.top - TOQUE_FOLGA && y <= r.bottom + TOQUE_FOLGA;
  }

  function _ligarToque() {
    var bPulo = wrap.querySelector('.ar-pulo');
    elDpad = wrap.querySelector('.ar-dpad');

    /* TOQUE — eventos touch com passive:false. Correção do "◀ não anda":
       antes o direcional dependia de pointer events + setPointerCapture +
       touch-action:none. No iOS o touch-action:none não é respeitado e
       perto da borda esquerda o sistema toma o gesto (voltar/rolar) e
       dispara pointercancel — o ◀ soltava sozinho. Agora cada dedo é
       lido de ev.touches (fonte da verdade), com preventDefault no
       touchstart/touchmove, e fica "preso" à zona onde começou:
       começou no direcional = anda (◀/▶ pelo lado), senão = pula. */
    function tocar(ev) {
      if (!wrap.classList.contains('ar-toque')) { wrap.classList.add('ar-toque'); medida.cw = 0; }
      var jogo = false, i, t, novos = ev.type === 'touchstart';
      for (i = 0; i < ev.changedTouches.length; i++) if (!_ehUi(ev.changedTouches[i].target)) jogo = true;
      if (!jogo) return;
      if (ev.cancelable) ev.preventDefault();
      // Reconstrói a partir dos dedos que ESTÃO na tela agora
      var vivos = {};
      for (i = 0; i < ev.touches.length; i++) {
        t = ev.touches[i];
        if (_ehUi(t.target)) continue;
        var id = t.identifier, zona = toques[id];
        if (zona === undefined) {
          zona = _dentroDpad(t.clientX, t.clientY) ? 'dpad' : 'pulo';
          if (zona === 'pulo' && novos) _apertarPulo();
        }
        if (zona !== 'pulo') zona = _ladoDpad(t.clientX);
        vivos[id] = zona;
      }
      toques = vivos;
      _recalcEntrada();
    }
    wrap.addEventListener('touchstart', tocar, { passive: false });
    wrap.addEventListener('touchmove', tocar, { passive: false });
    wrap.addEventListener('touchend', tocar, { passive: false });
    wrap.addEventListener('touchcancel', tocar, { passive: false });

    /* MOUSE / CANETA — pointer events, ignorando os de toque (já tratados acima) */
    function ehToque(ev) { return ev.pointerType === 'touch'; }
    elDpad.addEventListener('pointerdown', function (ev) {
      if (ehToque(ev)) return;
      ev.preventDefault();
      try { elDpad.setPointerCapture(ev.pointerId); } catch (e) {}
      dpadPonteiros[ev.pointerId] = _ladoDpad(ev.clientX) === 'esq' ? -1 : 1; _recalcEntrada();
    });
    elDpad.addEventListener('pointermove', function (ev) {
      if (ehToque(ev) || dpadPonteiros[ev.pointerId] === undefined) return;
      dpadPonteiros[ev.pointerId] = _ladoDpad(ev.clientX) === 'esq' ? -1 : 1; _recalcEntrada();
    });
    function soltarDpad(ev) { if (ehToque(ev)) return; delete dpadPonteiros[ev.pointerId]; _recalcEntrada(); }
    elDpad.addEventListener('pointerup', soltarDpad);
    elDpad.addEventListener('pointercancel', soltarDpad);

    function apertaPulo(ev) {
      if (ehToque(ev)) return;
      ev.preventDefault();
      try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
      puloPonteiros[ev.pointerId] = true; _apertarPulo(); _recalcEntrada();
    }
    function soltaPulo(ev) { if (ehToque(ev)) return; delete puloPonteiros[ev.pointerId]; _recalcEntrada(); }
    // Botão ▲ e também um clique em qualquer ponto do cenário = pular
    [bPulo, canvas].forEach(function (el) {
      el.addEventListener('pointerdown', apertaPulo);
      el.addEventListener('pointerup', soltaPulo);
      el.addEventListener('pointercancel', soltaPulo);
    });
    wrap.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  // ev.code (posição física) + ev.key (fallback: teclados virtuais/layouts
  // que mandam code vazio). Os dois lados usam a MESMA função, então
  // soltar a tecla sempre solta a ação certa.
  var TECLAS = {
    ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir',
    Space: 'pulo', ArrowUp: 'pulo', KeyW: 'pulo', KeyZ: 'pulo', KeyR: 'reiniciar'
  };
  var TECLAS_KEY = {
    arrowleft: 'esq', left: 'esq', a: 'esq', arrowright: 'dir', right: 'dir', d: 'dir',
    ' ': 'pulo', spacebar: 'pulo', arrowup: 'pulo', up: 'pulo', w: 'pulo', z: 'pulo', r: 'reiniciar'
  };
  function _acaoTecla(ev) {
    return TECLAS[ev.code] || TECLAS_KEY[String(ev.key || '').toLowerCase()] || null;
  }
  function _teclaDown(ev) {
    if (!ativo || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var acao = _acaoTecla(ev);
    if (!acao) return;
    ev.preventDefault();
    if (acao === 'reiniciar') { if (!ev.repeat) _reiniciar(); return; }
    if (acao === 'pulo') { if (!ev.repeat) { teclas.pulo = true; _apertarPulo(); } return; }
    teclas[acao] = true; _recalcEntrada();
  }
  function _teclaUp(ev) {
    if (!ativo) return;
    var acao = _acaoTecla(ev);
    if (!acao) return;
    teclas[acao] = false;
    _recalcEntrada();
  }
  // Janela perdeu o foco com tecla apertada: não deixa a coruja andando sozinha
  function _aoBlur() { if (ativo) _limparEntrada(); }

  function _reiniciar() {
    if (estado === 'jogando' || estado === 'morto') { _iniciarVida(); cam.x = null; }
  }

  function _aoVisibilidade() {
    if (!ativo) return;
    if (document.hidden) { _desligarLoop(); _limparEntrada(); }
    else _ligarLoop();
  }

  /* ── Montagem do DOM ────────────────────────────────────────── */
  function _montar() {
    root = document.getElementById('armadilha-root');
    if (!root) return false;
    root.innerHTML =
      '<div class="ar-wrap">' +
        '<canvas class="ar-canvas"></canvas>' +
        '<div class="ar-hud">' +
          '<span class="ar-pill" id="ar-fase">Fase 1/' + FASES.length + '</span>' +
          '<span class="ar-pill" id="ar-mortes">☠ 0</span>' +
          '<button type="button" class="ar-hud-btn" id="ar-btn-reiniciar" aria-label="Reiniciar fase">↻</button>' +
          '<button type="button" class="ar-hud-btn" id="ar-btn-menu" aria-label="Escolher fase">☰</button>' +
        '</div>' +
        '<div class="ar-girar" id="ar-girar" style="display:none" role="status">' +
          '<span class="ar-girar-ico" aria-hidden="true">📱</span>' +
          '<span class="ar-girar-txt">Gira o celular para jogar melhor</span>' +
          '<button type="button" class="ar-girar-btn" id="ar-btn-girar">Deitar</button>' +
          '<button type="button" class="ar-girar-x" id="ar-btn-girar-x" aria-label="Fechar aviso">✕</button>' +
        '</div>' +
        '<div class="ar-controles">' +
          '<div class="ar-dpad"><span class="ar-seta ar-esq">◀</span><span class="ar-seta ar-dir">▶</span></div>' +
          '<button type="button" class="ar-pulo" aria-label="Pular">▲</button>' +
        '</div>' +
        '<div class="ar-banner" id="ar-banner" style="display:none"></div>' +
        '<div class="ar-overlay" id="ar-menu">' +
          '<div class="ar-caixa">' +
            '<img src="/img/pixel/coruja-pixel-idle.png" alt="" class="ar-menu-owl" onerror="this.style.display=\'none\'">' +
            '<div class="ar-titulo">Armadilha da Coruja</div>' +
            '<div class="ar-desc">Leve a coruja até a bandeira. Nada é o que parece: morreu, volta na hora. E cuidado com quem diz "me siga"...</div>' +
            '<div class="ar-fases" id="ar-fases"></div>' +
            '<div class="ar-dica">◀ ▶ andar · ▲ ou toque na tela pula (segure = mais alto)<br>Teclado: setas/A D · espaço/↑/W · R reinicia</div>' +
          '</div>' +
        '</div>' +
        '<div class="ar-overlay" id="ar-fim" style="display:none">' +
          '<div class="ar-caixa">' +
            '<img src="/img/pixel/coruja-pixel-idle.png" alt="" class="ar-menu-owl" onerror="this.style.display=\'none\'">' +
            '<div class="ar-titulo">Você venceu!</div>' +
            '<div class="ar-desc" id="ar-fim-mortes"></div>' +
            '<button type="button" class="ar-btn" id="ar-btn-denovo">Jogar de novo</button>' +
            '<button type="button" class="ar-btn ar-btn-sec" id="ar-btn-fases">Escolher fase</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    wrap = root.querySelector('.ar-wrap');
    canvas = root.querySelector('.ar-canvas');
    ctx = canvas.getContext('2d', { alpha: false });
    elFase = root.querySelector('#ar-fase');
    elMortes = root.querySelector('#ar-mortes');
    elMenu = root.querySelector('#ar-menu');
    elFim = root.querySelector('#ar-fim');
    elBanner = root.querySelector('#ar-banner');
    elControles = root.querySelector('.ar-controles');
    elFasesLista = root.querySelector('#ar-fases');
    elGirar = root.querySelector('#ar-girar');
    elBtnGirar = root.querySelector('#ar-btn-girar');
    if (!_podeTravarOrientacao()) _esconder(elBtnGirar);

    elFasesLista.addEventListener('click', function (ev) {
      var b = ev.target.closest('.ar-fase-btn');
      if (!b || b.disabled) return;
      mortesTotal = 0;
      _comecarFase(parseInt(b.getAttribute('data-fase'), 10) || 0);
    });
    root.querySelector('#ar-btn-reiniciar').addEventListener('click', function (ev) { ev.currentTarget.blur(); _reiniciar(); });
    root.querySelector('#ar-btn-menu').addEventListener('click', function (ev) { ev.currentTarget.blur(); _abrirMenu(); });
    root.querySelector('#ar-btn-denovo').addEventListener('click', function () { mortesTotal = 0; _comecarFase(0); });
    root.querySelector('#ar-btn-fases').addEventListener('click', _abrirMenu);
    elBtnGirar.addEventListener('click', function (ev) { ev.currentTarget.blur(); _deitarTela(); });
    root.querySelector('#ar-btn-girar-x').addEventListener('click', function () { girarFechado = true; _atualizarAvisoGirar(); });
    // Botões do HUD/aviso não podem "vazar" o clique do mouse pro canvas (senão pula)
    root.querySelectorAll('.ar-hud-btn, .ar-girar button').forEach(function (b) {
      b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    });
    _ligarToque();

    img.onload = function () { imgOk = true; };
    img.onerror = function () { imgOk = false; };
    img.src = SPRITE_SHEET;
    montado = true;
    return true;
  }

  /* ── API pública (contrato do _jogoLoader do hub) ───────────── */
  function preparar() {
    if (!montado && !_montar()) return;
    if (!ativo) {
      ativo = true;
      // Captura na janela: nenhum handler do app engole seta/A antes do jogo
      window.addEventListener('keydown', _teclaDown, true);
      window.addEventListener('keyup', _teclaUp, true);
      window.addEventListener('blur', _aoBlur);
      document.addEventListener('visibilitychange', _aoVisibilidade);
    }
    medida.cw = 0;
    // Cenário da fase liberada aparece atrás do menu
    _comecarFase(_lerProgresso());
    _abrirMenu();
    _ligarLoop();
  }

  function parar() {
    if (!ativo) return;
    ativo = false;
    _desligarLoop();
    _limparEntrada();
    _destravarOrientacao();
    window.removeEventListener('keydown', _teclaDown, true);
    window.removeEventListener('keyup', _teclaUp, true);
    window.removeEventListener('blur', _aoBlur);
    document.removeEventListener('visibilitychange', _aoVisibilidade);
    estado = 'menu';
  }

  window.ArmadilhaGame = {
    preparar: preparar, parar: parar, FASES: FASES,
    // Leitura de estado para testes/depuração (não altera nada)
    _estado: function () {
      return { estado: estado, fase: faseIdx, mortes: mortesTotal, mortesFase: mortesFase,
               p: p ? { x: p.x, y: p.y, vx: p.vx, noChao: p.noChao } : null,
               inp: { esq: inp.esq, dir: inp.dir, pulo: inp.pulo },
               guias: guias.map(function (g) { return { x: g.x, y: g.y, tipo: g.def.tipo, ativa: g.ativa, passo: g.passo, fala: g.falaT > 0 ? g.fala : '' }; }) };
    }
  };
})();
