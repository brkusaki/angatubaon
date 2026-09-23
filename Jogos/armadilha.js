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
     armadilhas + textos + (opcional) corujas guia e grupos condicionais.
     Nada de código novo pra criar uma fase (formato documentado em cima
     do array).
   - v357: bloco caindo/andando é sólido (carrega, empurra, esmaga — nunca
     atravessa); no toque só o ▲ pula; 40 fases.
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
  // v358: toque no ▲ segura o pulo por pelo menos isto (s). Um toque de
  // dedo dura ~40 ms (bem menos que uma tecla) e dava um pulinho de nada;
  // 80 ms = ~2,2 tiles de altura (ainda passa por baixo de espinho de teto
  // nas fases de "pulinho"). Segurando, vai até o pulo cheio como no PC.
  var PULO_MIN_TOQUE = 0.08;

  var CORES_PENAS = ['#5b6b7f', '#d6bf9c', '#f2a11f', '#ff4a4a', '#1c212b', '#c4ab8a'];
  var RISADAS = ['Ha ha!', 'Otário!', 'Ha ha ha!'];

  /* ══════════════════════════════════════════════════════════════
     FASES — edite aqui. (40 fases; fase = DADOS, nada de código novo)

     COMO ADICIONAR UMA FASE
       Copie um bloco { nome, cores, mapa, armadilhas, textos } parecido,
       cole no fim do array e mude o mapa. O menu, o HUD ("Fase N/40") e
       o progresso (localStorage) se ajustam sozinhos ao tamanho do array.
       Teste pela Jogos/armadilha-teste.html (carrega o .js sem minificar).
       Física de referência: pulo máx ≈ 3 tiles de altura e ≈ 3,4 tiles de
       distância (vão seguro: 3). Gravidade 0,45 (lua) ≈ 5,7 tiles de altura.

     mapa (12 linhas, todas do mesmo tamanho; o chão costuma ser as linhas 10-11):
       .  vazio            #  chão/parede      ^  espinho (pra cima)
       v  espinho (pra baixo, no teto)         S  início da coruja
       F  bandeira         a-z  bloco de um GRUPO (pode cair/sumir/mover)
       1-9  espinho de um GRUPO (pode aparecer/sumir/mover)
       %  PAREDE/CHÃO FALSO: desenhado igual ao '#', mas atravessável
          (depois que a coruja passa, fica translúcido até ela morrer)
       ?  BLOCO INVISÍVEL: sólido, mas só aparece depois que a coruja
          encosta nele (morreu/↻ = invisível de novo: a fase volta do zero)

     armadilhas: [{ g: grupo ('a', '1'... ou 'bandeira'), acao, ...condições }]
       acao: 'cai' | 'some' | 'aparece' | 'move' | 'gravidade'
         cai:      pousa: true → para ao bater no chão fixo (vira degrau/parede)
         move:     dx/dy (tiles), vel (px/s)
         gravidade (sem g): grav (fator, 0,45 = lua / 1,7 = pesado),
                   pulo (fator do impulso), ms (duração; barrinha na cabeça)
         mata: true → o bloco passa a matar ao encostar
         atraso: ms entre o disparo e a ação
       CONDIÇÕES DE DISPARO (todas as que estiverem no objeto valem juntas):
         gatilho: coluna — dispara quando o CENTRO da coruja passa dela
                  (sem gatilho: só as outras condições contam)
         lado: 'esq'     só VOLTANDO (passou da coluna e cruzou de volta)
         abaixo: linha   pés abaixo do topo da linha (ex.: caiu no buraco)
         acima: linha    pés acima do topo da linha (ex.: pulando/lá em cima)
         pulou: true     só se cruzar a coluna NO AR  (pular = castigo)
         pulou: false    só se cruzar a coluna NO CHÃO (não pular = castigo)
         pisou: true     quando a coruja PISA num bloco do grupo g
                         (use com atraso: "chão que desaba depois que pisou")
         tempo: ms       depois de N ms da vida — o relógio só começa no
                         primeiro movimento (ex.: teto que desce)
       Grupo com alguma 'aparece' começa invisível ('bandeira' também: aí ela
       só existe — e só dá pra vencer — depois do gatilho).
       Várias armadilhas podem mexer no mesmo grupo (vai e volta com atraso).

     grupos (opcional): comportamento contínuo de um grupo, sem gatilho
       { a: { so: 'andando' } }  existe só enquanto a coruja anda
            so: 'parado'         existe só com ela parada (≥ 0,3 s)
            so: 'noAr'           existe só com ela no ar (+0,12 s de folga ao pousar)
            so: 'noChao'         existe só com ela no chão (pular = atravessar)
       { '1': { pisca: [ligadoMs, desligadoMs, defasagemMs] } }  ritmo fixo
       Desligado, o grupo aparece só em contorno pontilhado (dá pra ler o
       padrão). Bloco nunca religa em cima da coruja; espinho religa, mas
       mostra a pontinha 250 ms antes.

     BLOCO EM MOVIMENTO É SÓLIDO: chão que anda/cai carrega a coruja; bloco
     que invade empurra; se prensar contra outro sólido, esmaga.

     textos: { c: coluna, r: linha, t: 'texto' } — dicas FIXAS desenhadas no
       cenário (fazem parte da fase; não são fala de guia).

     RESET: morrer, ↻ ou R = a fase volta exatamente como abriu (ver
     _iniciarVida). Não guarde estado de jogo fora de grupos/armadilhas/
     guias/p — o que ficar fora não é zerado.

     guias (opcional): corujas "clone" que o jogador NÃO controla:
       { tipo: 'traidora' | 'confiavel',
         c, r: célula onde ela começa em pé,
         ativa: coluna — quando o jogador passa, ela fala e sai andando,
         fala: 'txt'      (padrão "Me siga")
         morte: 'txt' ou ['a', 'b']  fala quando o jogador morre (padrão:
                risada na traidora / "Era só me seguir..." na confiável)
         fim: 'txt'       fala ao ser alcançada no fim do caminho (padrão:
                "Obrigado pela confiança" / "Sortudo...")
         aparece: true    fica invisível até ativar (pra "trocar" de guia
                          no mesmo lugar em que a outra sumiu)
         vel: px/s        (padrão 115)
         caminho: [ passos, em ordem ]
           { c }            anda até a coluna (mesma altura)
           { c, r }         pula até a célula (arco)
           { espera: ms }   para um tempo
           { fala: 'txt' }  balão de fala (a guia pode MENTIR na fala e
                            acertar no caminho — ou o contrário)
           { aguarda: 'g' } espera o grupo g disparar e terminar (quem
                            dispara é o jogador: ponha o gatilho ANTES dela)
           { some: true }   some (a próxima guia pode surgir ali) }
       A guia atravessa tudo (não sofre armadilha): quem dispara é SEMPRE o
       jogador. Traidora: ri quando o jogador morre. Confiável: agradece no
       fim. Espera o jogador se ele ficar > 7 tiles atrás.
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
      nome: 'Final?',
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
    },
    {
      // 16 — Pé leve: chão que desaba DEPOIS que você pisa (pisou + atraso)
      nome: 'Pé leve',
      cores: { fundo: '#9fd8cb', chao: '#123029', pano: '#fff6e5' },
      mapa: [
        '..........................................................',
        '..........................................................',
        '..........................................................',
        '..........................................................',
        '..........................................................',
        '..........................................................',
        '..........................................................',
        '..........................................................',
        '..........................................................',
        '..S..................................................F....',
        '############..aa..bb..cc..########..ddd...#####eee########',
        '############..............########........#####eee########'
      ],
      armadilhas: [
        { g: 'a', pisou: true, acao: 'cai', atraso: 450 },
        { g: 'b', pisou: true, acao: 'cai', atraso: 450 },
        { g: 'c', pisou: true, acao: 'cai', atraso: 450 },
        { g: 'd', pisou: true, acao: 'cai', atraso: 220 },
        { g: 'e', pisou: true, acao: 'cai', atraso: 250 }
      ],
      textos: [{ c: 2, r: 5, t: 'pé leve...' }, { c: 27, r: 5, t: 'não enrola' }, { c: 43, r: 5, t: 'tá tranquilo...' }]
    },
    {
      // 17 — Não pula!: armadilha que depende de pular (pulou:true) ou NÃO pular (pulou:false)
      nome: 'Não pula!',
      cores: { fundo: '#f7c59f', chao: '#2e1a0e', pano: '#fff6e5' },
      mapa: [
        '................................................................',
        '................................................................',
        '................................................................',
        '...........aaa..................................................',
        '...........aaa..................................................',
        '...........aaa..................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '..S.......................^....^....1...........22...^....3..F..',
        '################################################################',
        '################################################################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 11, pulou: true, acao: 'cai', mata: true },
        { g: '1', gatilho: 34.5, pulou: false, acao: 'aparece' },
        { g: '2', gatilho: 46, pulou: true, acao: 'aparece' },
        { g: '3', gatilho: 56.5, pulou: false, acao: 'aparece' }
      ],
      textos: [{ c: 8, r: 7, t: 'pula!' }, { c: 22, r: 5, t: 'pula... pula... pula!' }, { c: 43, r: 5, t: 'e agora?' }]
    },
    {
      // 18 — Alçapão: o caminho óbvio (pra direita) mata; o escondido (chão falso atrás de você + túnel por baixo) salva
      nome: 'Alçapão',
      cores: { fundo: '#c7d3e8', chao: '#18202e', pano: '#fff6e5' },
      mapa: [
        '..............................................................',
        '..............................................................',
        '..............................................................',
        '..............................................................',
        '...........................###................................',
        '.......................##..###................................',
        '............S.......#..##..###..........^^^^^^^^^^^^^......F..',
        '######%%#############################################%%%%#####',
        '####.....................................................#####',
        '####...................................................#.#####',
        '####....................^...........^..................#.#####',
        '##############################################################'
      ],
      armadilhas: [],
      textos: [{ c: 12, r: 2, t: 'por aqui →' }, { c: 31, r: 2, t: 'quase lá!' }, { c: 9, r: 8, t: 'psiu...' }]
    },
    {
      // 19 — Bloco invisível: some de primeira, óbvio na segunda (o que você toca fica à mostra)
      nome: 'Bloco invisível',
      cores: { fundo: '#e6d3a3', chao: '#2a2112', pano: '#fff6e5' },
      mapa: [
        '....................................................',
        '....................................................',
        '....................................................',
        '.............................................F......',
        '............................................###.....',
        '............................................###.....',
        '.........................................??.###.....',
        '........................???.................###.....',
        '......................................##....###.....',
        '..S...................#.^^^.............^^^^###.....',
        '##########..???..###################################',
        '##########.......###################################'
      ],
      armadilhas: [],
      textos: [{ c: 2, r: 5, t: 'confia no ar' }, { c: 19, r: 4, t: 'pula, ué' }, { c: 33, r: 3, t: 'lá em cima?' }]
    },
    {
      // 20 — Lua: gravidade baixa por alguns segundos, depois pesada
      nome: 'Lua',
      cores: { fundo: '#27304a', chao: '#c9d1e6', pano: '#f2a11f' },
      mapa: [
        '..................#############...................................',
        '..................vvvvvvvvvvvvv...................................',
        '..................................................................',
        '..................................................................',
        '..................................................................',
        '................##................................................',
        '................##................................................',
        '................##................................................',
        '................##...................................##...........',
        '..S.............##..............................^....##.....F.....',
        '################################......############################',
        '################################......############################'
      ],
      armadilhas: [
        { gatilho: 10, acao: 'gravidade', grav: 0.45, pulo: 0.9, ms: 7000 },
        { gatilho: 44, acao: 'gravidade', grav: 1.7, pulo: 1, ms: 3500 }
      ],
      textos: [{ c: 3, r: 5, t: 'que muro alto...' }, { c: 19, r: 4, t: 'sem pular aqui' }, { c: 41, r: 5, t: 'pesado...' }]
    },
    {
      // 21 — Coruja sincera: CONFIÁVEL que mente na fala, mas o caminho dela é o certo
      nome: 'Coruja sincera',
      cores: { fundo: '#d4e6b5', chao: '#1d2a10', pano: '#fff6e5' },
      mapa: [
        '....................................................aa..........',
        '....................................................aa..........',
        '....................................................aa..........',
        '....................................................aa..........',
        '....................................................aa..........',
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '..S.........#..............................1................F...',
        '##############??????????????????################################',
        '##############..................################################'
      ],
      armadilhas: [
        { g: '1', gatilho: 41.5, pulou: false, acao: 'aparece' },
        { g: 'a', gatilho: 47, acao: 'cai', mata: true, atraso: 350 }
      ],
      guias: [
        { tipo: 'confiavel', c: 8, r: 9, ativa: 4, fala: 'Não me siga!', morte: ['Falei pra não seguir?', 'Mentira... segue sim'], fim: 'Só minto na fala :)',
          caminho: [
            { c: 10.6 }, { c: 13.4, r: 9 }, { fala: 'Aqui não tem chão...' }, { c: 31 }, { c: 40.4 }, { fala: 'Não pula!' },
            { c: 44.4, r: 9 }, { c: 48.6 }, { fala: 'Corre!' }, { aguarda: 'a' }, { c: 57 }
          ] }
      ],
      textos: []
    },
    {
      // 22 — Só andando: ponte que só existe se você anda; espinho que nasce se você para
      nome: 'Só andando',
      cores: { fundo: '#f3d9e8', chao: '#321528', pano: '#fff6e5' },
      mapa: [
        '...............................bb.............................',
        '...............................bb.............................',
        '...............................bb.............................',
        '...............................bb.............................',
        '...............................bb.............................',
        '.....................................................d........',
        '.....................................................d........',
        '.....................................................d........',
        '.....................................................d........',
        '..S.....................111111111111....^...^........d....F...',
        '##########aaaaaaaaaaaa##############cccccccccccc##############',
        '##########............##############............##############'
      ],
      armadilhas: [
        { g: 'b', gatilho: 28, acao: 'cai', mata: true, atraso: 600 }
      ],
      grupos: { '1': { so: 'parado' }, a: { so: 'andando' }, c: { so: 'andando' }, d: { so: 'andando' } },
      textos: [{ c: 2, r: 5, t: 'não para' }, { c: 24, r: 5, t: 'nem pra esperar' }, { c: 49, r: 5, t: 'licença...' }]
    },
    {
      // 23 — Pisca-pisca: plataformas e espinhos num ritmo fixo (contorno mostra o padrão)
      nome: 'Pisca-pisca',
      cores: { fundo: '#1f2a3a', chao: '#b8c7dc', pano: '#f2a11f' },
      mapa: [
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '..S.......................................11....22....3....F....',
        '##########..aaa...bbb...ccc...ddd...############################',
        '##########..........................############################'
      ],
      armadilhas: [],
      grupos: { '1': { pisca: [800, 800, 0] }, '2': { pisca: [800, 800, 800] }, '3': { pisca: [600, 600, 300] }, a: { pisca: [1400, 1000, 0] }, b: { pisca: [1400, 1000, 1200] }, c: { pisca: [1400, 1000, 0] }, d: { pisca: [1400, 1000, 1200] } },
      textos: [{ c: 2, r: 5, t: 'olha o ritmo' }]
    },
    {
      // 24 — Ela anda no ar: TRAIDORA atravessa o buraco "andando no ar"; o chão invisível de verdade está em cima
      nome: 'Ela anda no ar',
      cores: { fundo: '#bfe3f2', chao: '#0f2733', pano: '#fff6e5' },
      mapa: [
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '............................................................',
        '.............##?????????????................................',
        '............................................................',
        '..S........#............................11.............F....',
        '##############..............################################',
        '##############..............################################'
      ],
      armadilhas: [
        { g: '1', gatilho: 38, pulou: true, acao: 'aparece' }
      ],
      guias: [
        { tipo: 'traidora', c: 7, r: 9, ativa: 3, fala: 'Me siga, tem chão!',
          caminho: [
            { c: 9.6 }, { c: 12.4, r: 9 }, { c: 13.6 }, { c: 28 }, { c: 35.6 }, { fala: 'Pula aqui!' },
            { c: 36.6 }, { c: 40.6, r: 9 }, { c: 47 }
          ] }
      ],
      textos: [{ c: 12, r: 4, t: 'hm...' }]
    },
    {
      // 25 — Volta pra casa: a bandeira só aparece no fim... lá no começo; na volta tudo dispara (lado:'esq')
      nome: 'Volta pra casa',
      cores: { fundo: '#f6e3b4', chao: '#33250b', pano: '#fff6e5' },
      mapa: [
        '..........bb....................................................',
        '..........bb....................................................',
        '..........bb....................................................',
        '..........bb....................................................',
        '..........bb....................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '............................................##..................',
        '..S..F........^.....2.........^.......11....##..................',
        '##################################################aaa###########',
        '##################################################aaa###########'
      ],
      armadilhas: [
        { g: 'bandeira', gatilho: 58, acao: 'aparece' },
        { g: 'a', gatilho: 55, lado: 'esq', acao: 'cai' },
        { g: '1', gatilho: 42.5, lado: 'esq', acao: 'aparece' },
        { g: '2', gatilho: 26, lado: 'esq', acao: 'move', dx: 6, vel: 120 },
        { g: 'b', gatilho: 14.5, lado: 'esq', acao: 'cai', mata: true, atraso: 150 }
      ],
      textos: [{ c: 3, r: 5, t: 'cadê a bandeira?' }, { c: 50, r: 5, t: 'achou?' }]
    },
    {
      // 26 — Relógio: o teto começa a descer 2 s depois do primeiro passo
      nome: 'Relógio',
      cores: { fundo: '#e9c46a', chao: '#2b2208', pano: '#fff6e5' },
      mapa: [
        '............aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.......................',
        '............aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.......................',
        '............aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.......................',
        '......................................................................',
        '......................................................................',
        '......................................................................',
        '......................................................................',
        '......................................................................',
        '......................................................................',
        '..S.............^.....^.....^....^^....^.......................F......',
        '###################################################...################',
        '###################################################...################'
      ],
      armadilhas: [
        { g: 'a', tempo: 2000, acao: 'move', dy: 5, vel: 15 }
      ],
      textos: [{ c: 2, r: 5, t: 'o teto tá com pressa' }, { c: 48, r: 5, t: 'ufa' }]
    },
    {
      // 27 — Duas vozes: as duas guias falam AO MESMO TEMPO e vão por caminhos diferentes
      nome: 'Duas vozes',
      cores: { fundo: '#d6c9f0', chao: '#1e1633', pano: '#fff6e5' },
      mapa: [
        '.........................cc.....................................',
        '.........................cc.....................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '...............##...##...##...##................................',
        '................................................................',
        '............##..................................................',
        '............##..................................................',
        '..S........###....^....^....^....^.........................F....',
        '################################################################',
        '################################################################'
      ],
      armadilhas: [
        { g: 'c', gatilho: 23.6, acima: 6, acao: 'cai', mata: true }
      ],
      guias: [
        { tipo: 'traidora', c: 5, r: 9, ativa: 6, fala: 'Não! Me siga!',
          caminho: [
            { c: 9.6 }, { c: 11.4, r: 8 }, { c: 12.6, r: 6 }, { c: 15.5, r: 4 }, { c: 20.5, r: 4 }, { c: 25.5, r: 4 },
            { c: 30.5, r: 4 }, { fala: 'Vem!' }
          ] },
        { tipo: 'confiavel', c: 7, r: 9, ativa: 6, fala: 'Me siga',
          caminho: [
            { c: 9.6 }, { c: 11.4, r: 8 }, { c: 12.6, r: 6 }, { c: 15.4, r: 9 }, { c: 16.4 }, { c: 19.6, r: 9 },
            { c: 21.4 }, { c: 24.6, r: 9 }, { c: 26.4 }, { c: 29.6, r: 9 }, { c: 31.4 }, { c: 34.6, r: 9 },
            { c: 55 }
          ] }
      ],
      textos: []
    },
    {
      // 28 — Torre amiga: a torre que cai vira degrau (pousa); dá pra ficar em cima dela
      nome: 'Torre amiga',
      cores: { fundo: '#a9d6e5', chao: '#10242e', pano: '#fff6e5' },
      mapa: [
        '..................aa.........................dd.................',
        '..................aa.........................dd.................',
        '.............................................dd.................',
        '.............................................dd.................',
        '.............................................dd.................',
        '................................................................',
        '....................##..........................................',
        '....................##........ccc...............................',
        '....................##..........................................',
        '..S.................##....##..............................F.....',
        '#############################111111#############################',
        '################################################################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 14, acao: 'cai', pousa: true, atraso: 300 },
        { g: 'c', pisou: true, acao: 'cai', pousa: true, atraso: 350 },
        { g: 'd', gatilho: 42, acao: 'cai', mata: true, atraso: 200 }
      ],
      textos: [{ c: 3, r: 5, t: 'muro alto...' }, { c: 13, r: 3, t: 'espera...' }, { c: 24, r: 4, t: 'sobe nela' }]
    },
    {
      // 29 — Gravidade traiçoeira: na lua, pulo alto demais bate no espinho do teto
      nome: 'Gravidade traiçoeira',
      cores: { fundo: '#2d2640', chao: '#d8cfee', pano: '#f2a11f' },
      mapa: [
        '................................................................',
        '................................................................',
        '..........###############################.......................',
        '..........vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.......................',
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '........................#..........................##...........',
        '..S............^.....^..#.....^^.....^.........^...##.....F.....',
        '################################################################',
        '################################################################'
      ],
      armadilhas: [
        { gatilho: 7, acao: 'gravidade', grav: 0.45, pulo: 0.9, ms: 6500 },
        { gatilho: 43, acao: 'gravidade', grav: 1.7, pulo: 1, ms: 3000 }
      ],
      textos: [{ c: 2, r: 5, t: 'devagar...' }, { c: 42, r: 5, t: 'agora pesa' }]
    },
    {
      // 30 — Confia de novo: CONFIÁVEL pula no buraco (tem chão invisível lá embaixo)
      nome: 'Confia de novo',
      cores: { fundo: '#b8e0d2', chao: '#0f2a20', pano: '#fff6e5' },
      mapa: [
        '.................................bb...........................',
        '.................................bb...........................',
        '.................................bb...........................',
        '.................................bb...........................',
        '.................................bb...........................',
        '..............................................................',
        '..............................................................',
        '..............................................................',
        '...................aa.........................................',
        '..S......................................11.............F.....',
        '################.........#####################################',
        '################?????????#####################################'
      ],
      armadilhas: [
        { g: 'a', pisou: true, acao: 'cai', mata: true },
        { g: 'b', gatilho: 30, acao: 'cai', mata: true, atraso: 250 },
        { g: '1', gatilho: 38, pulou: true, acao: 'aparece' }
      ],
      guias: [
        { tipo: 'confiavel', c: 9, r: 9, ativa: 5, fala: 'Pula no buraco!',
          caminho: [
            { c: 15.6 }, { c: 17.5, r: 10 }, { c: 23.4 }, { c: 26, r: 9 }, { c: 31.4 }, { fala: 'Espera...' },
            { aguarda: 'b' }, { c: 36 }, { fala: 'Sem pular' }, { c: 52 }
          ] }
      ],
      textos: []
    },
    {
      // 31 — Espelho: primeiro uma TRAIDORA, depois (do nada) uma CONFIÁVEL
      nome: 'Espelho',
      cores: { fundo: '#cfe0f5', chao: '#141f33', pano: '#fff6e5' },
      mapa: [
        '............................................................................',
        '............................................................................',
        '............................................................................',
        '............................................................................',
        '............................................................................',
        '..............................................###...........................',
        '..............................................###^^^^^^^^^^^^...............',
        '...........................................##.%%%############...............',
        '...........................................##.%%%...........................',
        '..S......................................#.##.%%%.....................F.....',
        '############..##...bb...##..################################################',
        '############................################################################'
      ],
      armadilhas: [
        { g: 'b', pisou: true, acao: 'cai', atraso: 400 }
      ],
      guias: [
        { tipo: 'traidora', c: 6, r: 9, ativa: 3,
          caminho: [
            { c: 11.6 }, { c: 14.5, r: 9 }, { c: 19.5, r: 9 }, { fala: 'Descansa aqui' }, { espera: 900 }, { c: 24.5, r: 9 },
            { c: 29, r: 9 }, { c: 31 }
          ] },
        { tipo: 'confiavel', c: 38, r: 9, ativa: 36, aparece: true, fala: 'Agora é sério. Me siga.',
          caminho: [
            { c: 39.6 }, { c: 41.4, r: 8 }, { c: 43.5, r: 6 }, { c: 45.4, r: 9 }, { fala: 'Por aqui.' }, { c: 62 },
            { c: 67 }
          ] }
      ],
      textos: [{ c: 50, r: 3, t: 'por cima?' }]
    },
    {
      // 32 — Chão de vidro: cada pedaço cai depois que você pisa, cada vez mais rápido
      nome: 'Chão de vidro',
      cores: { fundo: '#dff3f7', chao: '#123038', pano: '#fff6e5' },
      mapa: [
        '......................................................................',
        '......................................................................',
        '........................................%%............................',
        '........................................%%............................',
        '........................................%%............................',
        '........................................%%............................',
        '........................................%%............................',
        '........................................%%.......???..................',
        '........................................##............................',
        '..S.....................................##.....#.^^^...........F......',
        '########aabbccddeeffgghhiijjkkll######################################',
        '########........................######################################'
      ],
      armadilhas: [
        { g: 'a', pisou: true, acao: 'cai', atraso: 400 },
        { g: 'b', pisou: true, acao: 'cai', atraso: 400 },
        { g: 'c', pisou: true, acao: 'cai', atraso: 400 },
        { g: 'd', pisou: true, acao: 'cai', atraso: 400 },
        { g: 'e', pisou: true, acao: 'cai', atraso: 250 },
        { g: 'f', pisou: true, acao: 'cai', atraso: 250 },
        { g: 'g', pisou: true, acao: 'cai', atraso: 250 },
        { g: 'h', pisou: true, acao: 'cai', atraso: 250 },
        { g: 'i', pisou: true, acao: 'cai', atraso: 120 },
        { g: 'j', pisou: true, acao: 'cai', atraso: 120 },
        { g: 'k', pisou: true, acao: 'cai', atraso: 120 },
        { g: 'l', pisou: true, acao: 'cai', atraso: 120 }
      ],
      textos: [{ c: 2, r: 5, t: 'não olha pra baixo' }, { c: 35, r: 4, t: 'parede de novo?' }]
    },
    {
      // 33 — Pula-pula: pedra que só existe NO AR, parede que some quando você pula, espinho que só nasce se você pular
      nome: 'Pula-pula',
      cores: { fundo: '#ffd6a5', chao: '#3a1f05', pano: '#fff6e5' },
      mapa: [
        '..................................................................',
        '..................................................................',
        '..................................................................',
        '..................................................................',
        '...................................d.....e........................',
        '...................................d.....e........................',
        '...................................d.....e........................',
        '...................................d.....e........................',
        '...................................d.....e........................',
        '..S................................d.....e....1111...^......F.....',
        '##########.aa.bb.cc.ff.###########################################',
        '##########.............###########################################'
      ],
      armadilhas: [],
      grupos: { '1': { so: 'noAr' }, a: { so: 'noAr' }, b: { so: 'noAr' }, c: { so: 'noAr' }, f: { so: 'noAr' }, d: { so: 'noChao' }, e: { so: 'noChao' } },
      textos: [{ c: 2, r: 5, t: 'pula-pula' }, { c: 31, r: 3, t: 'atravessa' }, { c: 45, r: 5, t: 'agora não' }]
    },
    {
      // 34 — Quase impossível: de primeira não dá; na segunda é óbvio
      nome: 'Quase impossível',
      cores: { fundo: '#f4a6a6', chao: '#330d0d', pano: '#fff6e5' },
      mapa: [
        '......................................................................',
        '......................................................................',
        '..............................bbb.....................................',
        '..............................bbb.......##............................',
        '..............................bbb.......##............................',
        '........................................##............................',
        '........................................##............................',
        '.....................??.................##............................',
        '........................................%%............................',
        '..S.....F..........#.^^........^........%%............................',
        '############aaa########################################ccc############',
        '############aaa########################################ccc############'
      ],
      armadilhas: [
        { g: 'bandeira', gatilho: 6, acao: 'move', dx: 52, vel: 320 },
        { g: 'a', gatilho: 11, acao: 'cai' },
        { g: 'b', gatilho: 29.5, pulou: true, acao: 'cai', mata: true },
        { g: 'c', pisou: true, acao: 'cai', atraso: 150 }
      ],
      textos: [{ c: 2, r: 5, t: 'fácil!' }, { c: 36, r: 4, t: 'hm' }]
    },
    {
      // 35 — Ritmo: a TRAIDORA pula quando não devia e anda quando devia pular
      nome: 'Ritmo',
      cores: { fundo: '#fbe7c6', chao: '#3b2a10', pano: '#fff6e5' },
      mapa: [
        '..................................................................',
        '..................................................................',
        '.....................................aaa..........................',
        '.....................................aaa..........................',
        '.....................................aaa..........................',
        '..........................................#####...................',
        '..........................................vvvvv...................',
        '..................................................................',
        '..................................................................',
        '..S...........11....^........2..............^...............F.....',
        '##################################################################',
        '##################################################################'
      ],
      armadilhas: [
        { g: '1', gatilho: 12, pulou: true, acao: 'aparece' },
        { g: '2', gatilho: 27, pulou: false, acao: 'aparece' },
        { g: 'a', gatilho: 35.5, pulou: true, acao: 'cai', mata: true }
      ],
      guias: [
        { tipo: 'traidora', c: 6, r: 9, ativa: 3, fala: 'Pula comigo!',
          caminho: [
            { c: 10.4 }, { c: 14.4, r: 9 }, { c: 25.6 }, { c: 27.6 }, { c: 33.6 }, { c: 37.6, r: 9 },
            { c: 42.4 }, { c: 46, r: 9 }, { c: 52 }
          ] }
      ],
      textos: [{ c: 40, r: 3, t: 'pulinho...' }]
    },
    {
      // 36 — Ela mudou de ideia: a CONFIÁVEL some e no mesmo lugar surge uma TRAIDORA
      nome: 'Ela mudou de ideia',
      cores: { fundo: '#e8d5f2', chao: '#27123a', pano: '#fff6e5' },
      mapa: [
        '...........................aa...................................................',
        '...........................aa...................................................',
        '...........................aa...................................................',
        '...........................aa...................................................',
        '...........................aa...................................................',
        '................................................................................',
        '................................................................................',
        '.........................................##..##.................................',
        '................................................................................',
        '..S...................................#..................11.............F.......',
        '############????????####################bbbbbbbb################################',
        '############........####################........################################'
      ],
      armadilhas: [
        { g: 'a', gatilho: 24, acao: 'cai', mata: true, atraso: 250 },
        { g: 'b', pisou: true, acao: 'cai', atraso: 150 },
        { g: '1', gatilho: 55, pulou: true, acao: 'aparece' }
      ],
      guias: [
        { tipo: 'confiavel', c: 6, r: 9, ativa: 3,
          caminho: [
            { c: 11.6 }, { c: 19.6 }, { c: 24.4 }, { fala: 'Espera...' }, { aguarda: 'a' }, { c: 34 },
            { some: true }
          ] },
        { tipo: 'traidora', c: 34, r: 9, ativa: 34.5, aparece: true, fala: 'Continua!',
          caminho: [
            { c: 36.6 }, { c: 39.4, r: 9 }, { c: 48 }, { fala: 'Vem!' }, { c: 54.4 }, { c: 58, r: 9 },
            { c: 63 }
          ] }
      ],
      textos: []
    },
    {
      // 37 — Sobe e desce: elevador (sem pular!), bloco que empurra, carona na plataforma que cai
      nome: 'Sobe e desce',
      cores: { fundo: '#cde7b0', chao: '#16240a', pano: '#fff6e5' },
      mapa: [
        '.........#####..................................................',
        '.........vvvvv..................................................',
        '................................................................',
        '.......................bb.......................................',
        '.............############.ccc...................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '..............................................dd................',
        '..S.......aaa111111111111111111....^^.........dd..........F.....',
        '################################################################',
        '################################################################'
      ],
      armadilhas: [
        { g: 'a', pisou: true, acao: 'move', dy: -5, vel: 60, atraso: 300 },
        { g: 'b', gatilho: 15.5, acao: 'move', dx: -9, vel: 55 },
        { g: 'c', pisou: true, acao: 'cai', pousa: true, atraso: 200 },
        { g: 'd', gatilho: 33, acao: 'move', dx: -9, vel: 50 }
      ],
      textos: [{ c: 2, r: 5, t: 'sobe' }, { c: 6, r: 3, t: 'sem pular!' }]
    },
    {
      // 38 — Lua cheia: gravidade baixa longa; do alto do muro, pulo alto = espinho
      nome: 'Lua cheia',
      cores: { fundo: '#1c2233', chao: '#dfe6f5', pano: '#f2a11f' },
      mapa: [
        '..............................................###########.................',
        '..............................................vvvvvvvvvvv.................',
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '........................##......................##........................',
        '..............##........##......................##........................',
        '..............##........##......................##........................',
        '..............##........##......................##..........##............',
        '..S...........##........##...............111....##..........##.....F......',
        '#################################......###################################',
        '#################################......###################################'
      ],
      armadilhas: [
        { gatilho: 6, acao: 'gravidade', grav: 0.4, pulo: 0.85, ms: 10000 }
      ],
      grupos: { '1': { pisca: [1000, 1000, 0] } },
      textos: [{ c: 2, r: 5, t: 'lua cheia' }, { c: 44, r: 4, t: 'lá em cima, não' }]
    },
    {
      // 39 — Mentirosa: CONFIÁVEL que fala tudo ao contrário (e acerta o caminho)
      nome: 'Mentirosa',
      cores: { fundo: '#f2d0a9', chao: '#2e1a08', pano: '#fff6e5' },
      mapa: [
        '.............................................aa.........................',
        '.............................................aa.........................',
        '.............................................aa.........................',
        '.............................................aa.........................',
        '.............................................aa.........................',
        '........................................................................',
        '........................................................................',
        '........................................................................',
        '........................................................................',
        '..S...........11.........2........................................F.....',
        '###############################????????#################################',
        '###############################........#################################'
      ],
      armadilhas: [
        { g: '1', gatilho: 12, pulou: true, acao: 'aparece' },
        { g: '2', gatilho: 23, pulou: false, acao: 'aparece' },
        { g: 'a', gatilho: 42, acao: 'cai', mata: true, atraso: 300 }
      ],
      guias: [
        { tipo: 'confiavel', c: 6, r: 9, ativa: 3, fim: 'Eu só minto quando falo.', morte: ['Ué, eu avisei...', 'Olha o que eu FAÇO'],
          caminho: [
            { c: 10.6 }, { fala: 'Pula agora!' }, { c: 20.6 }, { fala: 'Nem pensa em pular' }, { c: 21.4 }, { c: 24.8, r: 9 },
            { c: 30.4 }, { fala: 'Aqui não tem chão' }, { c: 39 }, { c: 42.4 }, { fala: 'Corre!' }, { aguarda: 'a' },
            { c: 62 }
          ] }
      ],
      textos: []
    },
    {
      // 40 — Grande final: um pouco de tudo
      nome: 'Grande final',
      cores: { fundo: '#f2a541', chao: '#2b1d14', pano: '#fff6e5' },
      mapa: [
        '................................................................................................................',
        '................................................................................................................',
        '................................................................................................................',
        '..........................##....................................................................................',
        '..........................##....................................................................................',
        '..........................##............##......................................................................',
        '..........................##............##......................................................................',
        '..........................##....??......##...............................##????????.............................',
        '..........................%%............##......................................................................',
        '..S.......................%%..#.^^......##......................2222...#.................33.............F.......',
        '##########.aa..bb..#########################.....#####cccccccccc###########dddddddd#############################',
        '##########.........#########################.....#####..........###########........#############################'
      ],
      armadilhas: [
        { g: 'a', pisou: true, acao: 'cai', atraso: 300 },
        { g: 'b', pisou: true, acao: 'cai', atraso: 300 },
        { gatilho: 37, acao: 'gravidade', grav: 0.45, pulo: 0.9, ms: 6000 },
        { g: 'd', pisou: true, acao: 'cai', atraso: 100 },
        { g: '3', gatilho: 87, pulou: true, acao: 'aparece' },
        { g: 'bandeira', gatilho: 99, acao: 'move', dy: -5, vel: 200 },
        { g: 'bandeira', gatilho: 99, acao: 'move', dy: 5, vel: 200, atraso: 2200 }
      ],
      grupos: { '2': { so: 'parado' }, c: { so: 'andando' } },
      guias: [
        { tipo: 'confiavel', c: 5, r: 9, ativa: 3, fala: 'Última! Me siga.',
          caminho: [
            { c: 7.6 }, { c: 11.6, r: 9 }, { c: 15.6, r: 9 }, { c: 19.4, r: 9 }, { c: 29.4 }, { c: 30.4, r: 8 },
            { c: 32.4, r: 6 }, { c: 33.6 }, { c: 35, r: 9 }, { fala: 'Boa sorte!' }, { espera: 600 }, { some: true }
          ] },
        { tipo: 'traidora', c: 70, r: 9, ativa: 68, fala: 'Última, juro!', morte: ['Ha ha!', 'Última, juro!', 'Otário!'],
          caminho: [
            { c: 69.6 }, { c: 72.4, r: 9 }, { c: 83 }, { c: 86.6 }, { c: 90.6, r: 9 }, { c: 95 }
          ] }
      ],
      textos: [{ c: 2, r: 5, t: 'tudo junto agora' }, { c: 92, r: 5, t: 'paciência...' }]
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
  var puloDeToque = false;      // o último aperto de pulo veio do ▲ na tela?
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
        else if (_ehGrupoBloco(ch) || ch === '%' || ch === '?') gdef(ch).blocos.push({ c: c, r: r });
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

  /* ── Vida nova = fase do zero (v359) ────────────────────────────
     Usada na morte, no ↻ / tecla R e ao abrir a fase: TUDO que é
     dinâmico é recriado a partir dos dados (FASES[i] nunca é alterado;
     _lerFase só lê o mapa). Não sobra nada da tentativa anterior:
     coruja, blocos (cópia nova de cada bloco — inclusive o "já visto"
     dos '?' e '%'), armadilhas e seus timers, espinhos que nascem/piscam,
     guias (posição, passo, falas, timers), bandeira, gravidade, partículas,
     tremor e câmera. Só o contador de mortes e o progresso continuam. */
  function _iniciarVida() {
    grupos = {};
    var gd = nivel.gruposDef, cfg = fase.grupos || {};
    function copia(lista) { var out = []; for (var k = 0; k < lista.length; k++) out.push({ c: lista[k].c, r: lista[k].r }); return out; }
    for (var id in gd) {
      var gc = cfg[id] || {};
      grupos[id] = { id: id, blocos: copia(gd[id].blocos), espinhos: copia(gd[id].espinhos),
                     ox: 0, oy: 0, vy: 0, visivel: true, caindo: false, mata: false,
                     alvo: null, vel: 0, surgir: 1, dx: 0, dy: 0, feito: false,
                     falso: id === '%', oculto: id === '?', pousa: false,
                     so: gc.so || null, pisca: gc.pisca || null, aviso: 0 };
    }
    grupos.bandeira = { id: 'bandeira', blocos: [], espinhos: [], ox: 0, oy: 0, vy: 0, visivel: true,
                        caindo: false, mata: false, alvo: null, vel: 0, surgir: 1, dx: 0, dy: 0, feito: false };
    armadilhas = [];
    var lista = fase.armadilhas || [];
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!grupos[a.g] && a.acao !== 'gravidade') continue;
      if (a.acao === 'aparece') grupos[a.g].visivel = false;
      armadilhas.push({ def: a, disparada: false, armada: false, timer: -1, antes: null });
    }
    p = { x: nivel.inicio.x, y: nivel.inicio.y, w: PW, h: PH, vx: 0, vy: 0, noChao: false, coyote: 0, buffer: 0,
          olhando: 1, chaoGrupo: null, pouso: 0, visivel: true,
          gravF: 1, puloF: 1, efeitoT: 0, efeitoMax: 0, mexeu: false, vidaT: 0, t: 0, paradoT: 0, chaoT: 0, seguraMin: 0 };
    guias = [];
    var gl = fase.guias || [];
    for (i = 0; i < gl.length; i++) {
      var d = gl[i];
      guias.push({ def: d, x: d.c * T + (T - PW) / 2, y: (d.r + 1) * T - PH, olhando: -1,
                   ativa: false, passo: 0, t: 0, emPasso: false, andando: false, noAr: false,
                   pausa: 0, fala: '', falaT: 0, falaIdade: 0, fim: false, agradeceu: false, zombou: false,
                   visivel: !d.aparece });
    }
    particulas = [];
    tremor = 0; acumulado = 0; timerEstado = 0;
    cam.x = null;   // câmera pula direto pro início (não desliza desde o lugar da morte)
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
      if (!g.visivel || !g.blocos.length || g.falso) continue;
      for (var i = 0; i < g.blocos.length; i++) {
        var b = g.blocos[i], rb = { x: b.c * T + g.ox, y: b.r * T + g.oy, w: T, h: T, g: g, b: b };
        if (_sobrepoe(ret, rb)) out.push(rb);
      }
    }
    return out;
  }

  // Encostou num bloco invisível ('?'): ele passa a ser desenhado (e continua
  // à mostra nas próximas vidas desta fase — aprender com a morte)
  function _tocou(s) { if (s.g && s.g.oculto && s.b && !s.b.visto) { s.b.visto = true; _som('toque'); } }

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
      p.vx = 0; _tocou(s);
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
      p.vy = 0; _tocou(s);
    }
  }

  // Algum sólido (fixo ou bloco de grupo) ocupando o mesmo espaço da coruja?
  function _presa(ignorar) {
    var hs = _solidosEm(p);
    for (var i = 0; i < hs.length; i++) {
      var s = hs[i];
      if (s.g && s.g === ignorar) continue;
      // folga de 0,02 px: encostar não é estar presa
      if (p.x < s.x + s.w - 0.02 && p.x + PW > s.x + 0.02 && p.y < s.y + s.h - 0.02 && p.y + PH > s.y + 0.02) return true;
    }
    return p.x < -0.02 || p.x > nivel.LW - PW + 0.02;
  }

  /* CORREÇÃO v357 — bloco em movimento/queda é SÓLIDO de verdade.
     1) Chão que anda/cai leva a coruja junto (dá pra ficar em cima de
        torre caindo). Descendo, se encontrar outro chão, pousa nele;
        subindo, se bater no teto, é esmagada.
     2) Bloco que se mexeu e invadiu a coruja EMPURRA na direção em que
        andou (caindo por cima = empurra pra baixo; subindo = levanta;
        de lado = empurra de lado). Se o empurrão a prensar contra outro
        sólido, morre esmagada. Nunca atravessa. Bloco que surge do nada
        em cima dela (acao 'aparece') continua esmagando na hora. */
  function _carregar(g, dt) {
    if (g.dx) {
      p.x += g.dx;
      if (_presa(g)) { p.x -= g.dx; }            // parede na frente: escorrega, não morre
    }
    if (g.dy > 0) {
      p.y += g.dy;
      var hs = _solidosEm(p);
      for (var i = 0; i < hs.length; i++) {
        var s = hs[i];
        if (s.g === g || !_sobrepoe(p, s)) continue;
        if (s.y >= p.y + PH - g.dy - 0.05) { p.y = s.y - PH; p.chaoGrupo = s.g; }   // pousou em outro chão
      }
      p.vy = Math.max(p.vy, 0);
    } else if (g.dy < 0) {
      p.y += g.dy;
      if (_presa(g)) { _morrer(); return false; }
    }
    return true;
  }

  function _empurroes(chao, dt) {
    for (var volta = 0; volta < 3; volta++) {
      var hs = _solidosEm(p), s = null;
      for (var i = 0; i < hs.length; i++) {
        if (hs[i].g && hs[i].g !== chao && _sobrepoe(p, hs[i])) { s = hs[i]; break; }
      }
      if (!s) return true;
      var g = s.g;
      if (!g.dx && !g.dy) { _morrer(); return false; }            // surgiu em cima: esmagada
      if (Math.abs(g.dy) >= Math.abs(g.dx)) {
        if (g.dy > 0) { p.y = s.y + s.h; p.vy = Math.max(p.vy, g.dy / dt); }
        else { p.y = s.y - PH; p.vy = Math.min(p.vy, 0); p.noChao = true; p.chaoGrupo = g; chao = g; }
      } else {
        p.x = g.dx > 0 ? s.x + s.w : s.x - PW;
      }
      if (_presa(null)) { _morrer(); return false; }            // prensada contra outro sólido
    }
    return true;
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
    if (a.acao === 'gravidade') {
      // Trecho de gravidade/pulo diferente por alguns segundos
      p.gravF = a.grav || 1; p.puloF = a.pulo || 1;
      p.efeitoT = p.efeitoMax = (a.ms || 4000) / 1000;
      _som('mola');
      return;
    }
    var g = grupos[a.g];
    if (!g) return;
    g.feito = true;
    if (a.mata) g.mata = true;
    if (a.acao === 'cai') { g.caindo = true; g.vy = 0; g.pousa = !!a.pousa; g.alvo = null; }
    else if (a.acao === 'some') g.visivel = false;
    else if (a.acao === 'aparece') {
      g.visivel = true; g.surgir = 0;
      if (a.g === 'bandeira') _brilho(nivel.bandeira.x + 8 + g.ox, nivel.bandeira.y - 20 + g.oy);
    }
    else if (a.acao === 'move') {
      g.alvo = { x: g.ox + (a.dx || 0) * T, y: g.oy + (a.dy || 0) * T };
      g.vel = a.vel || 120;
    }
  }

  // Condição de disparo: coluna do centro (+ lado/altura/pulo/pisou/tempo opcionais)
  function _gatilhoOk(a, centro) {
    var d = a.def, pes = p.y + PH;
    if (d.abaixo !== undefined && !(pes > d.abaixo * T)) return false;
    if (d.acima !== undefined && !(pes < d.acima * T)) return false;
    if (d.tempo !== undefined && !(p.vidaT * 1000 >= d.tempo)) return false;
    if (d.pisou && !_pisaEm(grupos[d.g])) return false;
    if (d.gatilho === undefined) return true;
    var gx = d.gatilho * T;
    if (d.lado === 'esq') {
      if (centro > gx) a.armada = true;
      return a.armada && centro <= gx;
    }
    if (d.pulou !== undefined) {
      // Só vale NO INSTANTE em que cruza a coluna: cruzou no ar (pulou:true)
      // ou no chão (pulou:false). Cruzou do jeito "errado" = não dispara
      // (até voltar e cruzar de novo).
      var antes = a.antes;
      a.antes = centro < gx;
      if (!(antes === true && centro >= gx)) return false;
      return d.pulou ? !p.noChao : p.noChao;
    }
    return centro >= gx;
  }

  // Grupo "condicional" (fase.grupos): liga/desliga conforme a coruja
  // anda/para/pula, ou pisca num ritmo fixo. Bloco nunca religa em cima
  // dela (espera ela sair); espinho religa — mas avisa antes (contorno).
  function _grupoQuer(g) {
    if (g.pisca) {
      var lig = g.pisca[0], des = g.pisca[1], per = lig + des;
      var t = (p.t * 1000 + (g.pisca[2] || 0)) % per;
      g.aviso = (t >= per - 250) ? 1 : 0;
      return t < lig;
    }
    // Folgas pequenas pra não piscar na virada de direção / no pouso
    if (g.so === 'andando') return p.paradoT < 0.15;
    if (g.so === 'parado') return p.paradoT >= 0.3;
    if (g.so === 'noAr') return !p.noChao || p.chaoT < 0.12;
    if (g.so === 'noChao') return p.noChao;
    return g.visivel;
  }
  function _ocupaCoruja(g) {
    for (var i = 0; i < g.blocos.length; i++) {
      var b = g.blocos[i];
      if (_sobrepoe({ x: p.x - 0.5, y: p.y - 0.5, w: PW + 1, h: PH + 1 }, { x: b.c * T + g.ox, y: b.r * T + g.oy, w: T, h: T })) return true;
    }
    return false;
  }

  // Coruja em pé (no chão) em cima de algum bloco do grupo?
  function _pisaEm(g) {
    if (!p.noChao || !g || !g.visivel) return false;
    var pe = { x: p.x, y: p.y + PH - 0.5, w: PW, h: 1.5 };
    for (var i = 0; i < g.blocos.length; i++) {
      var b = g.blocos[i];
      if (_sobrepoe(pe, { x: b.c * T + g.ox, y: b.r * T + g.oy, w: T, h: T })) return true;
    }
    return false;
  }

  // Torre que cai com pousa:true para ao bater no chão fixo (vira parede/degrau)
  function _penetracaoChao(g) {
    var pen = 0;
    for (var i = 0; i < g.blocos.length; i++) {
      var b = g.blocos[i], fundo = b.r * T + g.oy + T;
      var r = Math.floor((fundo - 0.001) / T), c0 = Math.floor((b.c * T + g.ox) / T), c1 = Math.floor((b.c * T + g.ox + T - 0.001) / T);
      for (var c = c0; c <= c1; c++) {
        if (_solidoEstatico(c, r) && fundo - r * T <= g.dy + 0.001) pen = Math.max(pen, fundo - r * T);
      }
    }
    return pen;
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
      if ((g.so || g.pisca) && !g.caindo) {
        var quer = _grupoQuer(g);
        if (quer && !g.visivel && !(g.blocos.length && _ocupaCoruja(g))) { g.visivel = true; g.surgir = 0; }
        else if (!quer && g.visivel) g.visivel = false;
      }
      if (g.caindo) {
        g.vy = Math.min(g.vy + GRAV * dt, 900);
        g.oy += g.vy * dt; g.dy = g.vy * dt;
        if (g.pousa) {
          var pen = _penetracaoChao(g);
          if (pen > 0) { g.oy -= pen; g.dy -= pen; g.caindo = false; g.vy = 0; tremor = 0.15; _som('toque'); }
        }
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
    if (!g.visivel) return true;
    // Caindo: só segue quando o grupo INTEIRO já passou do chão (antes ela
    // "atravessava" a torre que ainda estava descendo)
    if (g.caindo) {
      var topo = Infinity;
      for (var i = 0; i < g.blocos.length; i++) topo = Math.min(topo, g.blocos[i].r * T);
      for (i = 0; i < g.espinhos.length; i++) topo = Math.min(topo, g.espinhos[i].r * T);
      return topo + g.oy > nivel.LH;
    }
    return !g.alvo;
  }

  function _atualizarGuias(dt) {
    var pc = p.x + PW / 2;
    for (var i = 0; i < guias.length; i++) {
      var gu = guias[i], d = gu.def, cam_ = d.caminho || [];
      gu.andando = false;
      if (!gu.ativa) {
        if (pc >= d.ativa * T) {
          gu.ativa = true; gu.pausa = 0.55; _falar(gu, d.fala || 'Me siga', 1.6);
          if (!gu.visivel) { gu.visivel = true; gu.pausa = 0.35; }
        }
        else { gu.olhando = pc < gu.x + PW / 2 ? -1 : 1; continue; }
      }
      if (gu.pausa > 0) { gu.pausa -= dt; continue; }
      if (!gu.visivel) continue;
      if (gu.passo >= cam_.length) {
        // Fim do caminho: espera virada pro jogador
        if (!gu.fim) gu.fim = true;
        if (!gu.noAr) gu.olhando = pc < gu.x + PW / 2 ? -1 : 1;
        var perto = Math.abs(pc - (gu.x + PW / 2)) < T * 1.6 && Math.abs(p.y - gu.y) < T * 1.5;
        if (perto && d.tipo === 'confiavel' && !gu.agradeceu) { gu.agradeceu = true; _falar(gu, d.fim || 'Obrigado pela confiança', 2.2); }
        else if (perto && d.tipo === 'traidora' && !gu.zombou) { gu.zombou = true; _falar(gu, d.fim || 'Sortudo...', 1.6); }
        continue;
      }
      var s = cam_[gu.passo];
      // Não sai na frente sozinha: espera o jogador chegar perto (antes de começar um passo)
      if (!gu.emPasso && s.c !== undefined && (gu.x - p.x) > GUIA_LONGE * T) continue;
      var proximo = false;
      if (s.fala !== undefined) { _falar(gu, s.fala, (s.ms || 1500) / 1000); proximo = true; }
      else if (s.some) { gu.visivel = false; gu.falaT = 0; proximo = true; }
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

  // A guia "da vez" reage à morte: a ativa (e visível) mais perto da coruja
  function _guiaDaVez() {
    var melhor = null, dm = Infinity;
    for (var i = 0; i < guias.length; i++) {
      var gu = guias[i];
      if (!gu.ativa || !gu.visivel) continue;
      var d = Math.abs(gu.x - p.x) + Math.abs(gu.y - p.y) * 0.5;
      if (d < dm) { dm = d; melhor = gu; }
    }
    return melhor;
  }

  /* ── Passo de física ────────────────────────────────────────── */
  function _passo(dt) {
    var dir = (inp.dir ? 1 : 0) - (inp.esq ? 1 : 0);
    // Relógio da vida (armadilhas por tempo começam a contar no 1º movimento)
    p.t += dt;
    if (dir || inp.pulo) p.mexeu = true;
    if (p.mexeu) p.vidaT += dt;
    if (p.efeitoT > 0) { p.efeitoT -= dt; if (p.efeitoT <= 0) { p.gravF = 1; p.puloF = 1; } }

    // Chão que anda OU cai carrega a coruja junto (ver _carregar)
    var chao = p.noChao ? p.chaoGrupo : null;
    if (chao && !chao.visivel) chao = null;
    _atualizarArmadilhas(dt);
    if (chao && (chao.dx || chao.dy) && !_carregar(chao, dt)) return;
    // Bloco que andou/caiu por cima empurra; se prensar (ou surgir em cima) = esmagada
    if (!_empurroes(chao, dt)) return;

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
      p.vy = -PULO_V * p.puloF; p.buffer = 0; p.coyote = 0; p.noChao = false;
      p.seguraMin = puloDeToque ? PULO_MIN_TOQUE : 0;
      _som('pulo');
    }
    if (p.seguraMin > 0) p.seguraMin -= dt;
    // pulo variável (no toque, só corta depois do mínimo)
    if (!inp.pulo && p.seguraMin <= 0 && p.vy < -PULO_CORTE * p.puloF) p.vy = -PULO_CORTE * p.puloF;
    p.vy = Math.min(p.vy + GRAV * p.gravF * dt, QUEDA_MAX);

    var estavaNoChao = p.noChao;
    p.noChao = false; p.chaoGrupo = null;
    _moverX(p.vx * dt);
    _moverY(p.vy * dt);
    if (p.noChao && !estavaNoChao) p.pouso = 0.09;
    p.chaoT = p.noChao ? p.chaoT + dt : 0;
    p.paradoT = p.noChao && Math.abs(p.vx) < 20 ? p.paradoT + dt : 0;
    if (p.pouso > 0) p.pouso -= dt;

    if (p.y > nivel.LH + 24 || _tocaPerigo()) { _morrer(); return; }

    if (guias.length) _atualizarGuias(dt);

    // Parede falsa ('%'): quem atravessa descobre (fica translúcida nesta fase)
    var gf = grupos['%'];
    if (gf) for (var fi = 0; fi < gf.blocos.length; fi++) {
      var bf = gf.blocos[fi];
      if (!bf.visto && _sobrepoe(p, { x: bf.c * T, y: bf.r * T, w: T, h: T })) bf.visto = true;
    }

    var b = grupos.bandeira;
    var rb = { x: nivel.bandeira.x + b.ox + 3, y: nivel.bandeira.y + b.oy - 40, w: 10, h: 40 };
    if (b.visivel && _sobrepoe(p, rb)) _vencerFase();
  }

  function _brilho(x, y) {
    for (var i = 0; i < 14; i++) {
      var ang = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
      particulas.push({ x: x, y: y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 60,
                        cor: i % 2 ? '#fff6e5' : '#f2a11f', vida: 0.5 + Math.random() * 0.3, t: 2 });
    }
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
      var mt = gu.def.morte;
      if (mt) _falar(gu, typeof mt === 'string' ? mt : mt[risos++ % mt.length], T_RESPAWN_FALA);
      else if (gu.def.tipo === 'traidora') _falar(gu, RISADAS[risos++ % RISADAS.length], T_RESPAWN_FALA);
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
      if (gu.def.tipo === 'confiavel' && gu.ativa && gu.visivel && !gu.agradeceu) {
        gu.agradeceu = true; _falar(gu, gu.def.fim || 'Obrigado pela confiança', T_VITORIA_FALA); timerEstado = T_VITORIA_FALA;
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
      if (id === 'bandeira' || g.falso) continue;
      var gx = Math.round(g.ox), gy = Math.round(g.oy);
      if (!g.visivel) {
        // Grupo condicional desligado: só o contorno pontilhado (dá pra ler o padrão)
        if ((g.so || g.pisca) && !g.caindo) _contornoGrupo(g, gx, gy, g.aviso ? 0.7 : 0.28);
        continue;
      }
      for (var i = 0; i < g.blocos.length; i++) {
        var b = g.blocos[i], bx = b.c * T + gx, by = b.r * T + gy;
        if (g.oculto && !b.visto) continue;
        ctx.fillRect(bx, by, T, T);
        // Encostado na borda do mapa: prolonga até fora da tela — mas só
        // enquanto o grupo está no lugar. Antes o prolongamento ia junto
        // com a torre que caía e parecia uma coluna que nunca saía dali.
        if (!gx && !gy) {
          if (b.r === nivel.H - 1) ctx.fillRect(bx, by + T, T, EXT);
          if (b.r === 0) ctx.fillRect(bx, by - EXT, T, EXT);
        }
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
    // Parede falsa: igualzinha à de verdade até alguém atravessar
    var gf = grupos['%'];
    if (gf) {
      for (i = 0; i < gf.blocos.length; i++) {
        var bf = gf.blocos[i];
        ctx.globalAlpha = bf.visto ? 0.3 : 1;
        ctx.fillRect(bf.c * T, bf.r * T, T, T);
        if (bf.r === nivel.H - 1) ctx.fillRect(bf.c * T, nivel.LH, T, EXT);
      }
      ctx.globalAlpha = 1;
    }

    if (grupos.bandeira.visivel) _desenharBandeira(cores);
    // Guias: mesmo sprite, levemente "fantasma" (dá pra distinguir quando encosta na sua)
    if (guias.length) {
      ctx.globalAlpha = 0.82;
      for (i = 0; i < guias.length; i++) if (guias[i].visivel) _desenharCoruja(guias[i], _quadroGuia(guias[i]));
      ctx.globalAlpha = 1;
    }
    if (p && p.visivel) {
      _desenharCoruja(p, _quadroCoruja());
      // Gravidade/pulo alterados: barrinha de tempo em cima da cabeça
      if (p.efeitoT > 0) {
        var bw = Math.max(1, Math.round(16 * p.efeitoT / p.efeitoMax)), bx0 = Math.round(p.x + PW / 2 - 8), by0 = Math.round(p.y + PH - SPR_H - 5);
        ctx.fillStyle = cores.chao; ctx.fillRect(bx0 - 1, by0 - 1, 18, 4);
        ctx.fillStyle = p.gravF < 1 || p.puloF > 1 ? '#7fd6ff' : '#ff4a4a'; ctx.fillRect(bx0, by0, bw, 2);
      }
    }

    for (i = 0; i < particulas.length; i++) {
      var q = particulas[i];
      ctx.fillStyle = q.cor;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.t, q.t);
    }
    // Balões por cima de tudo
    for (i = 0; i < guias.length; i++) {
      var gu = guias[i];
      if (gu.visivel && gu.falaT > 0 && gu.fala) _desenharBalao(gu.fala, gu.x + PW / 2, gu.y + PH - SPR_H, gu.falaIdade, cores.chao);
    }
  }

  function _contornoGrupo(g, gx, gy, alfa) {
    ctx.globalAlpha = alfa;
    for (var i = 0; i < g.blocos.length; i++) {
      var bx = g.blocos[i].c * T + gx, by = g.blocos[i].r * T + gy;
      for (var k = 0; k < T; k += 4) {
        ctx.fillRect(bx + k, by, 2, 1); ctx.fillRect(bx + k + 2, by + T - 1, 2, 1);
        ctx.fillRect(bx, by + k + 2, 1, 2); ctx.fillRect(bx + T - 1, by + k, 1, 2);
      }
    }
    for (i = 0; i < g.espinhos.length; i++) {
      var ex = g.espinhos[i].c * T + gx, ey = g.espinhos[i].r * T + gy;
      ctx.fillRect(ex + 3, ey + 14, 10, 2);
      if (g.aviso) _pintarEspinho(ctx, ex, ey + 5, false);   // pontinha saindo do chão: vai nascer
    }
    ctx.globalAlpha = 1;
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
    // 40 fases: já abre rolado até a última liberada (só o overlay rola, não a página)
    var atual = elFasesLista.querySelector('[data-fase="' + liberada + '"]');
    if (atual) elMenu.scrollTop = Math.max(0, atual.offsetTop - elMenu.clientHeight / 2);
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
  function _apertarPulo(deToque) { inp.pulo = true; puloDeToque = !!deToque; if (p && estado === 'jogando') p.buffer = BUFFER_PULO; }

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
  function _dentro(el, x, y) {
    var r = el.getBoundingClientRect();
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
       começou no direcional = anda (◀/▶ pelo lado); começou no ▲ = pula.
       v357: toque no CENÁRIO não pula mais (pulava sem querer ao
       reposicionar o dedo). Dedo que começou fora dos botões fica
       "solto" e só vira controle se escorregar pra dentro do ◀▶ ou do ▲. */
    function tocar(ev) {
      if (!wrap.classList.contains('ar-toque')) { wrap.classList.add('ar-toque'); medida.cw = 0; }
      var jogo = false, i, t;
      for (i = 0; i < ev.changedTouches.length; i++) if (!_ehUi(ev.changedTouches[i].target)) jogo = true;
      if (!jogo) return;
      if (ev.cancelable) ev.preventDefault();
      // Reconstrói a partir dos dedos que ESTÃO na tela agora
      var vivos = {};
      for (i = 0; i < ev.touches.length; i++) {
        t = ev.touches[i];
        if (_ehUi(t.target)) continue;
        var id = t.identifier, zona = toques[id];
        if (zona === undefined || zona === 'solto') {
          if (_dentro(elDpad, t.clientX, t.clientY)) zona = 'dpad';
          else if (_dentro(bPulo, t.clientX, t.clientY)) { zona = 'pulo'; _apertarPulo(true); }
          else zona = 'solto';
        }
        if (zona === 'dpad' || zona === 'esq' || zona === 'dir') zona = _ladoDpad(t.clientX);
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
    // Só o botão ▲ pula (v357: clique/toque no cenário não pula mais)
    bPulo.addEventListener('pointerdown', apertaPulo);
    bPulo.addEventListener('pointerup', soltaPulo);
    bPulo.addEventListener('pointercancel', soltaPulo);
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
    if (estado === 'jogando' || estado === 'morto') _iniciarVida();   // mesmo reset da morte
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
            '<div class="ar-dica">◀ ▶ andar · ▲ pula (segure = mais alto)<br>Teclado: setas/A D · espaço/↑/W · R reinicia</div>' +
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
    // Botões do HUD/aviso não "vazam" o clique do mouse pro jogo
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
               guias: guias.map(function (g) { return { x: g.x, y: g.y, tipo: g.def.tipo, ativa: g.ativa, passo: g.passo, visivel: g.visivel, fala: g.falaT > 0 ? g.fala : '' }; }) };
    },
    // Foto de TODO o estado dinâmico da fase (testes do reset — não altera nada)
    _foto: function () {
      if (!nivel || !p) return null;
      var gs = {}, id, i;
      for (id in grupos) {
        var g = grupos[id], vistos = 0;
        for (i = 0; i < g.blocos.length; i++) if (g.blocos[i].visto) vistos++;
        gs[id] = [g.ox, g.oy, g.vy, g.visivel, g.caindo, g.mata, g.alvo ? [g.alvo.x, g.alvo.y] : null, g.feito, g.pousa, g.surgir, vistos];
      }
      return {
        p: [p.x, p.y, p.vx, p.vy, p.buffer, p.coyote, p.gravF, p.puloF, p.efeitoT, p.mexeu, p.vidaT, p.t, p.seguraMin, p.visivel],
        grupos: gs,
        armadilhas: armadilhas.map(function (a) { return [a.disparada, a.armada, a.timer, a.antes]; }),
        guias: guias.map(function (g) { return [g.x, g.y, g.ativa, g.passo, g.t, g.emPasso, g.pausa, g.fala, g.falaT, g.fim, g.agradeceu, g.zombou, g.visivel]; }),
        particulas: particulas.length, tremor: tremor > 0, camSnap: cam.x === null,
        mapa: JSON.stringify(fase.mapa)
      };
    }
  };
})();
