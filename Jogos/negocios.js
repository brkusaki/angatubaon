/* ═══════════════════════════════════════════════════════════════
   NEGÓCIOS DA CIDADE (Banco Imobiliário de Angatuba) — módulo de
   jogo (lazy-loaded). Carregado sob demanda pelo _jogoLoader do hub
   quando o usuário abre o jogo. Expõe
   window.NegociosGame = { preparar, comecar, parar }.

   Multijogador LOCAL: 2 a 8 pessoas no mesmo aparelho, passando o
   celular. Não usa Firestore nem AngatubaMP — não há pontuação
   individual pra ranking, o placar é a própria partida.

   Organização interna (as 4 partes do protótipo standalone, na
   mesma ordem em que dependem umas das outras):
     1. DADOS        — config, 40 casas, grupos de cor, cartas
     2. MOTOR        — regras puras, sem nenhum acesso ao DOM
     3. UI           — desenho, animações e modais
     4. CONTROLADOR  — conduz o turno ligando motor + UI
     5. API DO HUB   — preparar / comecar / parar

   Tudo é desenhado dentro de #negocios-root (dentro da tela
   #jogo-negocios). Nenhum id ou classe vaza pro app: ids levam o
   prefixo "ndc-" e as classes recebem o mesmo prefixo no helper
   cls(), num ponto só. Ver Jogos/negocios.css, que espelha isso.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Namespace interno do módulo. Ao contrário do protótipo standalone,
     NÃO vai pro window: o hub só enxerga window.NegociosGame. */
  var NDC = {};

  /* Elemento onde o jogo desenha. Preenchido por preparar(). */
  var raiz = null;

  /* ── Prefixo de classe ──────────────────────────────────────────
     O app tem .btn, .modal, .chip, .arena etc. em styles.css. Em vez
     de renomear as ~120 classes do protótipo em 60 lugares, o
     prefixo é aplicado aqui, no único ponto por onde toda classe
     passa (o helper el() e os poucos className diretos). */
  function cls(nomes) {
    var partes = String(nomes || '').split(/\s+/);
    var saida = [];
    for (var i = 0; i < partes.length; i++) {
      if (partes[i]) saida.push('ndc-' + partes[i]);
    }
    return saida.join(' ');
  }

  /* ── Timers rastreados ──────────────────────────────────────────
     Sombreiam os globais DE PROPÓSITO: assim as ~15 chamadas de
     setTimeout/setInterval espalhadas pelo módulo entram na lista
     sozinhas e parar() consegue matar todas, sem precisar guardar id
     em cada ponto. */
  var _timers = [];
  var _intervalos = [];

  function setTimeout(fn, ms) {
    var id = window.setTimeout(function () {
      var i = _timers.indexOf(id);
      if (i !== -1) _timers.splice(i, 1);
      fn();
    }, ms);
    _timers.push(id);
    return id;
  }

  function setInterval(fn, ms) {
    var id = window.setInterval(fn, ms);
    _intervalos.push(id);
    return id;
  }

  function clearInterval(id) {
    var i = _intervalos.indexOf(id);
    if (i !== -1) _intervalos.splice(i, 1);
    window.clearInterval(id);
  }

  function _limparTimers() {
    for (var i = 0; i < _timers.length; i++) window.clearTimeout(_timers[i]);
    for (var j = 0; j < _intervalos.length; j++) window.clearInterval(_intervalos[j]);
    _timers = [];
    _intervalos = [];
  }

  /* ═══════════════════════════════════════════════════════════════
     1. DADOS
     ═══════════════════════════════════════════════════════════════ */
  /* -----------------------------------------------------------------------
     CONFIGURAÇÃO GERAL
     Decisões de design tomadas para partidas mais curtas que o clássico:
     - Dinheiro inicial alto (R$ 2.500) mas aluguéis com monopólio bem pesados,
       então a partida acelera muito depois das primeiras construções.
     - Sem leilão: quem cai em propriedade livre compra ou passa.
     - Delegacia é só visita (sem prisão). O flag DELEGACIA_PERDE_VEZ existe
       para ligar uma punição leve no futuro sem mexer no resto do código.
     ----------------------------------------------------------------------- */
  NDC.CONFIG = {
    DINHEIRO_INICIAL: 2500,
    SALARIO_PARTIDA: 200,      // recebido ao passar OU cair na Partida
    MIN_JOGADORES: 2,
    MAX_JOGADORES: 8,

    MAX_CASAS: 4,              // 4 casas; o 5º nível vira hotel
    NIVEL_HOTEL: 5,            // índice usado na tabela de aluguéis
    VENDA_CASA_PCT: 0.5,       // vende casa de volta ao banco por 50%
    HIPOTECA_PCT: 0.5,         // hipoteca vale 50% do preço
    JUROS_DESHIPOTECA: 0.1,    // deshipotecar custa hipoteca + 10%

    // Regra clássica mantida: dentro de um grupo a diferença de casas entre
    // duas propriedades nunca passa de 1. Deixe false para construção livre.
    CONSTRUCAO_UNIFORME: true,

    // Tirou dupla joga de novo (no máximo 2 jogadas extras seguidas).
    DUPLA_JOGA_DE_NOVO: true,
    MAX_DUPLAS_SEGUIDAS: 3,

    // Delegacia por enquanto não prende ninguém (ver briefing da v1).
    DELEGACIA_PERDE_VEZ: false,

    // Impostos
    IMPOSTO_PREDIAL: 150,
    IR_FIXO: 200,
    IR_PERCENTUAL: 0.1,        // paga o MENOR entre IR_FIXO e 10% do patrimônio

    // Estações e utilidades
    ALUGUEL_ESTACAO: [50, 100, 200, 400],   // por quantidade de estações do dono
    MULT_UTILIDADE: [4, 10],                // x dados com 1 ou 2 utilidades

    // Ritmo das animações (ms)
    MS_PASSO_TOKEN: 130,
    MS_ROLAGEM_DADOS: 750,

    /* Peças ilustradas (ver NDC.TOKENS logo abaixo dos dados).
       TOKEN_ESCALA é o tamanho da peça em relação ao lado da casa: 1.06
       deixa a arte transbordar de leve a casa, que é como uma peça de
       verdade se apoia no tabuleiro, e mantém ~30 px legíveis no celular
       em pé (casa de ~29 px em 360 px de tela). */
    TOKENS_BASE: '/Jogos/assets/negocios/',
    TOKEN_ESCALA: 1.06,

    /* Animação da coruja jogando os dados. Roda ANTES dos dados girarem;
       o resultado continua vindo do motor (jogo.rolar()), a animação é só
       enfeite. Desligue ANIM_CORUJA para voltar ao giro puro. */
    ANIM_CORUJA: true,
    MS_ANIM_CORUJA: 1500,
    VIDEO_CORUJA: '/Jogos/assets/negocios/dados-coruja.mp4'
  };

  /* -----------------------------------------------------------------------
     GRUPOS DE COR
     custoCasa = preço fixo de cada casa/hotel do grupo (regra simplificada).
     ----------------------------------------------------------------------- */
  NDC.GRUPOS = {
    marrom:     { nome: 'Marrom',      cor: '#a06a3f', custoCasa: 50 },
    azulclaro:  { nome: 'Azul-claro',  cor: '#59c7f0', custoCasa: 50 },
    rosa:       { nome: 'Rosa',        cor: '#f2609e', custoCasa: 100 },
    laranja:    { nome: 'Laranja',     cor: '#f2913d', custoCasa: 100 },
    vermelho:   { nome: 'Vermelho',    cor: '#e84d5c', custoCasa: 150 },
    amarelo:    { nome: 'Amarelo',     cor: '#f2ce3c', custoCasa: 150 },
    verde:      { nome: 'Verde',       cor: '#3fc47c', custoCasa: 200 },
    azulescuro: { nome: 'Azul-escuro', cor: '#5a7bf0', custoCasa: 200 },
    estacao:    { nome: 'Transporte',  cor: '#94a3c4', custoCasa: 0 },
    utilidade:  { nome: 'Serviços',    cor: '#c9a227', custoCasa: 0 }
  };

  /* -----------------------------------------------------------------------
     TABULEIRO - 40 casas na ordem do briefing.

     tipo:
       partida | propriedade | estacao | utilidade | sorte | azar
       imposto | imposto_renda | delegacia | vadelegacia | livre

     alugueis: [sem casa, 1 casa, 2 casas, 3 casas, 4 casas, hotel]

     Balanceamento: preços ~1,5x o clássico (porque o caixa inicial é maior)
     e aluguéis com 3 casas ou mais bem acima do clássico, para que a partida
     tenha um ponto de virada claro e termine rápido.
     ----------------------------------------------------------------------- */
  NDC.TABULEIRO = [
    { id: 0, tipo: 'partida', nome: 'Partida', curto: 'PARTIDA',
      desc: 'Receba R$ 200 ao passar ou cair aqui.' },

    { id: 1, tipo: 'propriedade', grupo: 'marrom',
      nome: 'Rua Coronel Ludovico Homem de Góes', curto: 'Cel. Ludovico',
      preco: 100, alugueis: [6, 30, 90, 270, 400, 550] },

    { id: 2, tipo: 'sorte', nome: 'Sorte', curto: 'Sorte' },

    { id: 3, tipo: 'propriedade', grupo: 'marrom',
      nome: 'Rua João Lopes Filho', curto: 'João Lopes',
      preco: 120, alugueis: [8, 40, 100, 300, 450, 600] },

    { id: 4, tipo: 'imposto', nome: 'Imposto Predial', curto: 'IPTU',
      valor: 150, desc: 'Pague R$ 150 de IPTU.' },

    { id: 5, tipo: 'estacao', nome: 'Rodovia Raposo Tavares', curto: 'Raposo Tavares',
      preco: 200 },

    { id: 6, tipo: 'propriedade', grupo: 'azulclaro',
      nome: 'Rua Cornélio Vieira de Moraes', curto: 'Cornélio Vieira',
      preco: 160, alugueis: [12, 60, 180, 500, 700, 900] },

    { id: 7, tipo: 'azar', nome: 'Azar', curto: 'Azar' },

    { id: 8, tipo: 'propriedade', grupo: 'azulclaro',
      nome: 'Rua Padre Caetano Tedeschi', curto: 'Pe. Caetano',
      preco: 160, alugueis: [12, 60, 180, 500, 700, 900] },

    { id: 9, tipo: 'propriedade', grupo: 'azulclaro',
      nome: 'Rua Espírito Santo', curto: 'Espírito Santo',
      preco: 180, alugueis: [16, 80, 220, 600, 800, 1000] },

    { id: 10, tipo: 'delegacia', nome: 'Delegacia', curto: 'Delegacia',
      desc: 'Só visita. Nada acontece por aqui (por enquanto).' },

    { id: 11, tipo: 'propriedade', grupo: 'rosa',
      nome: 'Praça Monsenhor Ribeiro', curto: 'Pça. Monsenhor',
      preco: 220, alugueis: [20, 100, 300, 750, 925, 1100] },

    { id: 12, tipo: 'utilidade', nome: 'Companhia de Energia', curto: 'Energia',
      preco: 150 },

    { id: 13, tipo: 'propriedade', grupo: 'rosa',
      nome: 'Rua Salvador Rodrigues dos Santos', curto: 'Salvador Rodrigues',
      preco: 220, alugueis: [20, 100, 300, 750, 925, 1100] },

    { id: 14, tipo: 'propriedade', grupo: 'rosa',
      nome: 'Rua Irmãos Basile', curto: 'Irmãos Basile',
      preco: 240, alugueis: [24, 120, 360, 850, 1025, 1200] },

    { id: 15, tipo: 'estacao', nome: 'Antiga Estação Ferroviária', curto: 'Est. Ferroviária',
      preco: 200 },

    { id: 16, tipo: 'propriedade', grupo: 'laranja',
      nome: 'Vila São Cristóvão', curto: 'V. São Cristóvão',
      preco: 260, alugueis: [26, 130, 390, 900, 1100, 1275] },

    { id: 17, tipo: 'sorte', nome: 'Sorte', curto: 'Sorte' },

    { id: 18, tipo: 'propriedade', grupo: 'laranja',
      nome: 'Vila Progresso', curto: 'Vila Progresso',
      preco: 260, alugueis: [26, 130, 390, 900, 1100, 1275] },

    { id: 19, tipo: 'propriedade', grupo: 'laranja',
      nome: 'Jardim Domingos Orsi', curto: 'Jd. Domingos Orsi',
      preco: 280, alugueis: [30, 150, 450, 1000, 1200, 1400] },

    { id: 20, tipo: 'livre', nome: 'Estacionamento Livre', curto: 'Estac. Livre',
      desc: 'Descanse. Nada acontece aqui.' },

    { id: 21, tipo: 'propriedade', grupo: 'vermelho',
      nome: 'Bairro dos Mineiros', curto: 'B. dos Mineiros',
      preco: 300, alugueis: [32, 160, 470, 1100, 1300, 1500] },

    { id: 22, tipo: 'azar', nome: 'Azar', curto: 'Azar' },

    { id: 23, tipo: 'propriedade', grupo: 'vermelho',
      nome: 'Cachoeira das Correntes', curto: 'Cach. das Correntes',
      preco: 300, alugueis: [32, 160, 470, 1100, 1300, 1500] },

    { id: 24, tipo: 'propriedade', grupo: 'vermelho',
      nome: 'Bairro do Palmital', curto: 'B. do Palmital',
      preco: 320, alugueis: [36, 180, 500, 1200, 1400, 1700] },

    { id: 25, tipo: 'estacao', nome: 'Terminal Rodoviário', curto: 'T. Rodoviário',
      preco: 200 },

    { id: 26, tipo: 'propriedade', grupo: 'amarelo',
      nome: 'Santa Casa de Angatuba', curto: 'Santa Casa',
      preco: 340, alugueis: [38, 190, 550, 1300, 1550, 1800] },

    { id: 27, tipo: 'propriedade', grupo: 'amarelo',
      nome: 'Câmara Municipal', curto: 'Câmara Municipal',
      preco: 340, alugueis: [38, 190, 550, 1300, 1550, 1800] },

    { id: 28, tipo: 'utilidade', nome: 'Companhia de Água', curto: 'Água',
      preco: 150 },

    { id: 29, tipo: 'propriedade', grupo: 'amarelo',
      nome: 'Fórum de Angatuba', curto: 'Fórum',
      preco: 360, alugueis: [42, 210, 600, 1400, 1700, 1950] },

    { id: 30, tipo: 'vadelegacia', nome: 'Vá para a Delegacia', curto: 'Vá p/ Delegacia',
      desc: 'Vá direto para a Delegacia (casa 10). Sem receber os R$ 200.' },

    { id: 31, tipo: 'propriedade', grupo: 'verde',
      nome: 'Polenghi', curto: 'Polenghi',
      preco: 390, alugueis: [46, 230, 660, 1600, 1900, 2200] },

    { id: 32, tipo: 'propriedade', grupo: 'verde',
      nome: 'Klabin', curto: 'Klabin',
      preco: 390, alugueis: [46, 230, 660, 1600, 1900, 2200] },

    { id: 33, tipo: 'sorte', nome: 'Sorte', curto: 'Sorte' },

    { id: 34, tipo: 'propriedade', grupo: 'verde',
      nome: 'Confecção Local', curto: 'Confecção Local',
      preco: 420, alugueis: [52, 260, 780, 1800, 2100, 2400] },

    { id: 35, tipo: 'estacao', nome: 'Aeroporto / Acesso Raposo', curto: 'Aeroporto',
      preco: 200 },

    { id: 36, tipo: 'azar', nome: 'Azar', curto: 'Azar' },

    { id: 37, tipo: 'propriedade', grupo: 'azulescuro',
      nome: 'Centro Comercial', curto: 'Centro Comercial',
      preco: 450, alugueis: [60, 300, 900, 2000, 2400, 2800] },

    { id: 38, tipo: 'imposto_renda', nome: 'Imposto de Renda', curto: 'Imp. de Renda',
      desc: 'Pague R$ 200 ou 10% do seu patrimônio — o que for MENOR.' },

    { id: 39, tipo: 'propriedade', grupo: 'azulescuro',
      nome: 'Prefeitura / Paço Municipal', curto: 'Prefeitura',
      preco: 500, alugueis: [80, 400, 1000, 2400, 2800, 3200] }
  ];

  /* -----------------------------------------------------------------------
     CARTAS

     Formato declarativo para ficar fácil de editar sem mexer no motor:
       receber          -> ganha `valor` do banco
       pagar            -> paga `valor` ao banco
       receber_de_cada  -> cada adversário ativo paga `valor`
       pagar_a_cada     -> paga `valor` a cada adversário ativo
       ir_para          -> anda até a casa `destino` (ganha salário se passar
                           pela Partida)
       ir_para_direto   -> vai até `destino` sem receber salário
       avancar          -> anda `valor` casas para frente
       voltar           -> anda `valor` casas para trás
       casa_gratis      -> constrói 1 casa de graça (precisa ter o grupo)
       reparos          -> paga `porCasa` por casa e `porHotel` por hotel
     ----------------------------------------------------------------------- */
  NDC.CARTAS = {
    sorte: [
      { texto: 'Feira do produtor lotada no centro e suas vendas bombaram. Receba R$ 150.',
        efeito: 'receber', valor: 150 },
      { texto: 'Verba da prefeitura liberada! Construa 1 casa de graça em uma propriedade sua (precisa ter o grupo de cor completo).',
        efeito: 'casa_gratis' },
      { texto: 'Colheita boa de laranja na região. Cada jogador te paga R$ 80.',
        efeito: 'receber_de_cada', valor: 80 },
      { texto: 'Você levou o prêmio do torneio de pesca na represa. Receba R$ 120.',
        efeito: 'receber', valor: 120 },
      { texto: 'Estrada liberada! Avance até a Partida e receba R$ 200.',
        efeito: 'ir_para', destino: 0 },
      { texto: 'Turistas lotaram a Cachoeira das Correntes. Avance até lá.',
        efeito: 'ir_para', destino: 23 },
      { texto: 'Caiu a restituição do imposto. Receba R$ 90.',
        efeito: 'receber', valor: 90 },
      { texto: 'A Klabin fechou contrato com você como fornecedor. Receba R$ 250.',
        efeito: 'receber', valor: 250 },
      { texto: 'É seu aniversário! Cada jogador te dá R$ 50.',
        efeito: 'receber_de_cada', valor: 50 },
      { texto: 'Você vendeu um lote no Jardim Domingos Orsi. Receba R$ 200.',
        efeito: 'receber', valor: 200 },
      { texto: 'Erro na conta de água a seu favor. Receba R$ 60.',
        efeito: 'receber', valor: 60 },
      { texto: 'Frete rápido pela rodovia. Avance até a Rodovia Raposo Tavares.',
        efeito: 'ir_para', destino: 5 },
      { texto: 'O Fórum cancelou sua multa de trânsito. Receba R$ 100.',
        efeito: 'receber', valor: 100 },
      { texto: 'Você pegou um atalho pela estrada de terra. Avance 3 casas.',
        efeito: 'avancar', valor: 3 }
    ],

    azar: [
      { texto: 'Chuva forte estragou a estrada de terra até o seu sítio. Pague R$ 80.',
        efeito: 'pagar', valor: 80 },
      { texto: 'Multa por estacionar em fila dupla na Praça Monsenhor Ribeiro. Pague R$ 50.',
        efeito: 'pagar', valor: 50 },
      { texto: 'Manutenção da trilha da Cachoeira das Correntes. Pague R$ 100.',
        efeito: 'pagar', valor: 100 },
      { texto: 'A conta de energia veio salgada no calor de janeiro. Pague R$ 70.',
        efeito: 'pagar', valor: 70 },
      { texto: 'A Prefeitura exigiu reforma de fachada. Pague R$ 40 por casa e R$ 100 por hotel.',
        efeito: 'reparos', porCasa: 40, porHotel: 100 },
      { texto: 'Blitz na Raposo Tavares. Vá direto para a Delegacia, sem receber os R$ 200.',
        efeito: 'ir_para_direto', destino: 10 },
      { texto: 'Taxa de terreno baldio sem roçar. Pague R$ 120.',
        efeito: 'pagar', valor: 120 },
      { texto: 'Seu caminhão quebrou na subida da Raposo. Pague R$ 150.',
        efeito: 'pagar', valor: 150 },
      { texto: 'Doação para a campanha da Santa Casa de Angatuba. Pague R$ 100.',
        efeito: 'pagar', valor: 100 },
      { texto: 'A geada estragou a plantação e você atrasou as entregas. Pague R$ 30 a cada jogador.',
        efeito: 'pagar_a_cada', valor: 30 },
      { texto: 'Você errou o retorno na rodovia. Volte 3 casas.',
        efeito: 'voltar', valor: 3 },
      { texto: 'Renovação do alvará de funcionamento. Pague R$ 110.',
        efeito: 'pagar', valor: 110 },
      { texto: 'Furto na sua loja no centro. Pague R$ 75.',
        efeito: 'pagar', valor: 75 },
      { texto: 'Revisão do trator antes da safra. Pague R$ 60.',
        efeito: 'pagar', valor: 60 }
    ]
  };

  /* -----------------------------------------------------------------------
     CORES DOS JOGADORES (tokens)
     ----------------------------------------------------------------------- */
  NDC.CORES_JOGADOR = [
    { id: 'coral',   nome: 'Coral',    cor: '#ff6b6b' },
    { id: 'ceu',     nome: 'Céu',      cor: '#4dabf7' },
    { id: 'limao',   nome: 'Limão',    cor: '#51cf66' },
    { id: 'sol',     nome: 'Sol',      cor: '#ffd43b' },
    { id: 'uva',     nome: 'Uva',      cor: '#b197fc' },
    { id: 'menta',   nome: 'Menta',    cor: '#38e1b0' },
    { id: 'rosa',    nome: 'Rosa',     cor: '#f783ac' },
    { id: 'laranja', nome: 'Laranja',  cor: '#ff922b' }
  ];

  /* -----------------------------------------------------------------------
     PEÇAS ILUSTRADAS DOS JOGADORES
     Uma por jogador (8, mesma quantidade das cores). `img` é resolvido
     contra CFG.TOKENS_BASE, então trocar, renomear ou reordenar as artes
     é mexer SÓ nesta lista. A cor do jogador continua existindo: vira o
     anel em volta da peça, para dois carrinhos parecidos nunca se
     confundirem.
     ----------------------------------------------------------------------- */
  NDC.TOKENS = [
    { id: 'carrinho-colorido', nome: 'Carrinho colorido', img: 'token-carrinho-colorido.webp' },
    { id: 'bike-amarela',      nome: 'Bicicleta amarela', img: 'token-bike-amarela.webp' },
    { id: 'trator-azul',       nome: 'Trator azul',       img: 'token-trator-azul.webp' },
    { id: 'onibus',            nome: 'Ônibus',            img: 'token-onibus.webp' },
    { id: 'caminhao-laranja',  nome: 'Caminhão laranja',  img: 'token-caminhao-laranja.webp' },
    { id: 'bike-colorida',     nome: 'Bicicleta colorida', img: 'token-bike-colorida.webp' },
    { id: 'trator-branco',     nome: 'Trator branco',     img: 'token-trator-branco.webp' },
    { id: 'carrinho-preto',    nome: 'Carrinho preto',    img: 'token-carrinho-preto.webp' }
  ];

  NDC.tokenPorId = function (id) {
    for (var i = 0; i < NDC.TOKENS.length; i++) {
      if (NDC.TOKENS[i].id === id) return NDC.TOKENS[i];
    }
    return null;
  };

  /** URL da arte de uma peça. Cai na primeira se o id não existir mais. */
  NDC.urlToken = function (id) {
    var t = NDC.tokenPorId(id) || NDC.TOKENS[0];
    return NDC.CONFIG.TOKENS_BASE + t.img;
  };

  /* -----------------------------------------------------------------------
     POSIÇÃO DE CADA CASA NO GRID 11x11.

     O tabuleiro usa o desenho clássico: a Partida fica no canto inferior
     direito e o percurso corre pela borda de baixo para a esquerda, sobe
     pela esquerda, atravessa o topo para a direita e desce pela direita.
     É o traçado que todo mundo reconhece de Banco Imobiliário, e mantém
     exatamente a ordem numérica das casas do briefing.
     ----------------------------------------------------------------------- */
  NDC.posicaoGrid = function (id) {
    if (id === 0)  return { linha: 11, coluna: 11 };
    if (id < 10)   return { linha: 11, coluna: 11 - id };
    if (id === 10) return { linha: 11, coluna: 1 };
    if (id < 20)   return { linha: 21 - id, coluna: 1 };
    if (id === 20) return { linha: 1, coluna: 1 };
    if (id < 30)   return { linha: 1, coluna: id - 19 };
    if (id === 30) return { linha: 1, coluna: 11 };
    return { linha: id - 29, coluna: 11 };
  };

  /* Em que borda a casa fica (usado só para orientar o CSS). */
  NDC.bordaDaCasa = function (id) {
    if (id === 0 || id === 10 || id === 20 || id === 30) return 'canto';
    if (id < 10) return 'sul';
    if (id < 20) return 'oeste';
    if (id < 30) return 'norte';
    return 'leste';
  };

  /* Formata dinheiro no padrão brasileiro, sem centavos. */
  NDC.dinheiro = function (v) {
    var n = Math.round(Math.abs(v));
    var s = n.toLocaleString('pt-BR');
    return (v < 0 ? '-R$ ' : 'R$ ') + s;
  };
  /* Atalhos usados pelo motor e pela UI. Ficam DEPOIS da seção de dados
     de propósito: NDC.CONFIG e NDC.TABULEIRO só existem a partir dali. */
  var CFG = NDC.CONFIG;
  var TAB = NDC.TABULEIRO;

  /* ══════════════════════════════
     2. MOTOR DE REGRAS (estado puro, sem DOM)
     ══════════════════════════════ */
  /* ---------------------------------------------------------------------
     Utilitários internos
     --------------------------------------------------------------------- */
  function embaralhar(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function d6() { return 1 + Math.floor(Math.random() * 6); }

  /* =====================================================================
     JOGO
     ===================================================================== */
  function Jogo() {
    this.jogadores = [];
    this.casas = [];          // estado de posse de cada uma das 40 casas
    this.vez = 0;
    this.fase = 'setup';      // setup | rolar | movendo | decisao | acoes | fim
    this.lance = null;        // { d1, d2, total, dupla }
    this.duplasSeguidas = 0;
    this.rodada = 1;
    this.historico = [];
    this.baralhos = { sorte: [], azar: [] };
    this.divida = null;       // { devedor, credores[], valor, motivo }
    this.vencedor = null;
    this._ouvintes = {};
  }

  /* ------------------------------ eventos ------------------------------ */
  Jogo.prototype.on = function (evento, fn) {
    (this._ouvintes[evento] || (this._ouvintes[evento] = [])).push(fn);
    return this;
  };

  Jogo.prototype.emitir = function (evento, dados) {
    var lista = this._ouvintes[evento];
    if (!lista) return;
    for (var i = 0; i < lista.length; i++) lista[i](dados);
  };

  Jogo.prototype.log = function (texto, tipo) {
    var reg = { texto: texto, tipo: tipo || 'info', rodada: this.rodada };
    this.historico.push(reg);
    if (this.historico.length > 300) this.historico.shift();
    this.emitir('log', reg);
  };

  /* ------------------------------ início ------------------------------- */
  /**
   * @param {Array} defs  [{ nome, corId, tokenId }]
   */
  Jogo.prototype.iniciar = function (defs) {
    var self = this;

    this.jogadores = defs.map(function (d, i) {
      var cor = NDC.CORES_JOGADOR.filter(function (c) { return c.id === d.corId; })[0]
             || NDC.CORES_JOGADOR[i % NDC.CORES_JOGADOR.length];
      // Sem tokenId (partida antiga, chamada externa) cada um pega a peça
      // da sua posição na mesa — nunca ficam dois iguais.
      var tok = NDC.tokenPorId(d.tokenId) || NDC.TOKENS[i % NDC.TOKENS.length];
      return {
        id: i,
        nome: (d.nome || '').trim() || ('Jogador ' + (i + 1)),
        corId: cor.id,
        cor: cor.cor,
        tokenId: tok.id,
        tokenImg: NDC.urlToken(tok.id),
        inicial: ((d.nome || '').trim() || ('J' + (i + 1))).charAt(0).toUpperCase(),
        dinheiro: CFG.DINHEIRO_INICIAL,
        posicao: 0,
        falido: false
      };
    });

    this.casas = TAB.map(function () {
      return { dono: null, casas: 0, hipotecada: false };
    });

    this.baralhos.sorte = embaralhar(NDC.CARTAS.sorte.map(function (c, i) { return i; }));
    this.baralhos.azar  = embaralhar(NDC.CARTAS.azar.map(function (c, i) { return i; }));

    this.vez = 0;
    this.rodada = 1;
    this.fase = 'rolar';
    this.duplasSeguidas = 0;
    this.divida = null;
    this.vencedor = null;
    this.historico = [];

    this.log('Partida iniciada com ' + this.jogadores.length + ' jogadores. Cada um começa com ' + NDC.dinheiro(CFG.DINHEIRO_INICIAL) + '.', 'destaque');
    this.emitir('atualizar', self);
    return this;
  };

  /* ---------------------------- consultas ------------------------------ */
  Jogo.prototype.jogadorAtual = function () { return this.jogadores[this.vez]; };

  Jogo.prototype.ativos = function () {
    return this.jogadores.filter(function (j) { return !j.falido; });
  };

  Jogo.prototype.adversarios = function (id) {
    return this.jogadores.filter(function (j) { return !j.falido && j.id !== id; });
  };

  Jogo.prototype.porId = function (id) {
    return (id === null || id === undefined) ? null : this.jogadores[id];
  };

  /** Casas do tabuleiro que pertencem a um grupo de cor. */
  Jogo.prototype.casasDoGrupo = function (grupo) {
    return TAB.filter(function (c) { return c.grupo === grupo; });
  };

  /** Todas as casas (com dono) de um jogador. */
  Jogo.prototype.bensDe = function (jogadorId) {
    var self = this;
    return TAB.filter(function (c) { return self.casas[c.id].dono === jogadorId; });
  };

  Jogo.prototype.contarTipo = function (jogadorId, tipo) {
    var self = this, n = 0;
    TAB.forEach(function (c) {
      if (c.tipo === tipo && self.casas[c.id].dono === jogadorId) n++;
    });
    return n;
  };

  /** Jogador tem TODAS as propriedades do grupo de cor? */
  Jogo.prototype.temGrupo = function (jogadorId, grupo) {
    var self = this;
    var doGrupo = this.casasDoGrupo(grupo);
    if (!doGrupo.length) return false;
    return doGrupo.every(function (c) { return self.casas[c.id].dono === jogadorId; });
  };

  /** Monopólio válido para construir/dobrar aluguel: grupo inteiro e sem hipoteca. */
  Jogo.prototype.monopolioAtivo = function (jogadorId, grupo) {
    var self = this;
    if (!this.temGrupo(jogadorId, grupo)) return false;
    return this.casasDoGrupo(grupo).every(function (c) { return !self.casas[c.id].hipotecada; });
  };

  /** Grupos em que o jogador tem monopólio ativo. */
  Jogo.prototype.gruposComMonopolio = function (jogadorId) {
    var self = this, achados = [];
    Object.keys(NDC.GRUPOS).forEach(function (g) {
      if (NDC.GRUPOS[g].custoCasa > 0 && self.monopolioAtivo(jogadorId, g)) achados.push(g);
    });
    return achados;
  };

  /**
   * Aluguel devido por cair numa casa.
   * @param {number} casaId
   * @param {number} totalDados  soma do último lance (usada pelas utilidades)
   */
  Jogo.prototype.aluguel = function (casaId, totalDados) {
    var casa = TAB[casaId];
    var est = this.casas[casaId];
    if (est.dono === null || est.hipotecada) return 0;

    if (casa.tipo === 'estacao') {
      var q = this.contarTipo(est.dono, 'estacao');
      return CFG.ALUGUEL_ESTACAO[Math.max(0, q - 1)] || 0;
    }

    if (casa.tipo === 'utilidade') {
      var u = this.contarTipo(est.dono, 'utilidade');
      var mult = CFG.MULT_UTILIDADE[Math.max(0, u - 1)] || CFG.MULT_UTILIDADE[0];
      return mult * (totalDados || 7);
    }

    if (casa.tipo === 'propriedade') {
      if (est.casas > 0) return casa.alugueis[est.casas];
      // Terreno vazio vale o dobro se o dono tiver o grupo de cor inteiro.
      return casa.alugueis[0] * (this.monopolioAtivo(est.dono, casa.grupo) ? 2 : 1);
    }

    return 0;
  };

  /** Patrimônio = dinheiro + valor das propriedades + construções. */
  Jogo.prototype.patrimonio = function (jogadorId) {
    var self = this;
    var j = this.jogadores[jogadorId];
    var total = j.dinheiro;
    this.bensDe(jogadorId).forEach(function (c) {
      var est = self.casas[c.id];
      total += est.hipotecada ? Math.round(c.preco * CFG.HIPOTECA_PCT) : c.preco;
      if (est.casas > 0) total += est.casas * NDC.GRUPOS[c.grupo].custoCasa;
    });
    return total;
  };

  /** Quanto o jogador consegue levantar vendendo casas e hipotecando tudo. */
  Jogo.prototype.liquidez = function (jogadorId) {
    var self = this;
    var total = this.jogadores[jogadorId].dinheiro;
    this.bensDe(jogadorId).forEach(function (c) {
      var est = self.casas[c.id];
      if (est.casas > 0) {
        total += Math.round(est.casas * NDC.GRUPOS[c.grupo].custoCasa * CFG.VENDA_CASA_PCT);
      }
      if (!est.hipotecada) total += Math.round(c.preco * CFG.HIPOTECA_PCT);
    });
    return total;
  };

  /* ------------------------------ dinheiro ----------------------------- */
  Jogo.prototype.creditar = function (jogadorId, valor, motivo) {
    var j = this.jogadores[jogadorId];
    j.dinheiro += valor;
    this.emitir('dinheiro', { jogador: jogadorId, delta: valor, motivo: motivo });
    return valor;
  };

  Jogo.prototype.debitarDireto = function (jogadorId, valor) {
    var j = this.jogadores[jogadorId];
    j.dinheiro -= valor;
    this.emitir('dinheiro', { jogador: jogadorId, delta: -valor });
  };

  /**
   * Cobra um valor de um jogador. Se ele não tiver caixa, abre uma dívida
   * pendente (this.divida) e devolve { ok:false }.
   * @param {number}  devedorId
   * @param {Array}   credores    ids que recebem (vazio = banco)
   * @param {number}  valor
   * @param {string}  motivo
   */
  Jogo.prototype.cobrar = function (devedorId, credores, valor, motivo) {
    credores = credores || [];
    valor = Math.round(valor);
    if (valor <= 0) return { ok: true, valor: 0 };

    var dev = this.jogadores[devedorId];
    if (dev.dinheiro >= valor) {
      this.debitarDireto(devedorId, valor);
      this._distribuir(credores, valor);
      this.log(dev.nome + ' pagou ' + NDC.dinheiro(valor) + ' — ' + motivo + '.', 'pagamento');
      this.emitir('atualizar', this);
      return { ok: true, valor: valor };
    }

    this.divida = { devedor: devedorId, credores: credores, valor: valor, motivo: motivo };
    this.emitir('atualizar', this);
    return { ok: false, valor: valor, falta: valor - dev.dinheiro };
  };

  Jogo.prototype._distribuir = function (credores, valor) {
    if (!credores.length) return;                       // vai para o banco
    var cota = Math.floor(valor / credores.length);
    var resto = valor - cota * credores.length;
    for (var i = 0; i < credores.length; i++) {
      this.creditar(credores[i], cota + (i === 0 ? resto : 0));
    }
  };

  /** Tenta quitar a dívida pendente com o caixa atual. */
  Jogo.prototype.quitarDivida = function () {
    var d = this.divida;
    if (!d) return { ok: true };
    var dev = this.jogadores[d.devedor];
    if (dev.dinheiro < d.valor) return { ok: false, falta: d.valor - dev.dinheiro };

    this.debitarDireto(d.devedor, d.valor);
    this._distribuir(d.credores, d.valor);
    this.log(dev.nome + ' quitou ' + NDC.dinheiro(d.valor) + ' — ' + d.motivo + '.', 'pagamento');
    this.divida = null;
    this.emitir('atualizar', this);
    return { ok: true };
  };

  /* ---------------------------- movimentação --------------------------- */
  Jogo.prototype.rolar = function () {
    var d1 = d6(), d2 = d6();
    this.lance = { d1: d1, d2: d2, total: d1 + d2, dupla: d1 === d2 };
    this.emitir('dados', this.lance);
    return this.lance;
  };

  /**
   * Anda `passos` casas (aceita valor negativo).
   * @returns {{de:number, para:number, passos:number, passouPartida:boolean}}
   */
  Jogo.prototype.mover = function (passos) {
    var j = this.jogadorAtual();
    var de = j.posicao;
    var bruto = de + passos;
    var para = ((bruto % 40) + 40) % 40;
    var passou = passos > 0 && bruto >= 40;

    j.posicao = para;
    if (passou) {
      this.creditar(j.id, CFG.SALARIO_PARTIDA, 'salário');
      this.log(j.nome + ' passou pela Partida e recebeu ' + NDC.dinheiro(CFG.SALARIO_PARTIDA) + '.', 'recebimento');
    }
    this.emitir('atualizar', this);
    return { de: de, para: para, passos: passos, passouPartida: passou };
  };

  /** Vai direto até uma casa. `ganhaSalario=false` para a Delegacia. */
  Jogo.prototype.irPara = function (destino, ganhaSalario) {
    var j = this.jogadorAtual();
    var passos = ((destino - j.posicao) % 40 + 40) % 40;
    if (passos === 0) passos = 0;
    if (ganhaSalario === false) {
      var de = j.posicao;
      j.posicao = destino;
      this.emitir('atualizar', this);
      return { de: de, para: destino, passos: passos, passouPartida: false, direto: true };
    }
    return this.mover(passos);
  };

  /* ------------------------- resolução da casa ------------------------- */
  /**
   * Lê a casa onde o jogador parou e descreve o que precisa acontecer.
   * NÃO mexe em dinheiro: quem decide (e cobra) é o app.js, depois de
   * mostrar o modal.
   */
  Jogo.prototype.resolverCasa = function () {
    var j = this.jogadorAtual();
    var casa = TAB[j.posicao];
    var est = this.casas[casa.id];
    var comprável = (casa.tipo === 'propriedade' || casa.tipo === 'estacao' || casa.tipo === 'utilidade');

    if (comprável) {
      if (est.dono === null) {
        return { tipo: 'comprar', casa: casa, preco: casa.preco, podePagar: j.dinheiro >= casa.preco };
      }
      if (est.dono === j.id) return { tipo: 'propria', casa: casa };
      if (est.hipotecada)   return { tipo: 'hipotecada', casa: casa, dono: this.porId(est.dono) };
      return {
        tipo: 'aluguel',
        casa: casa,
        dono: this.porId(est.dono),
        valor: this.aluguel(casa.id, this.lance ? this.lance.total : 7)
      };
    }

    switch (casa.tipo) {
      case 'partida':
        return { tipo: 'partida', casa: casa };
      case 'livre':
      case 'delegacia':
        return { tipo: 'neutra', casa: casa };
      case 'imposto':
        return { tipo: 'imposto', casa: casa, valor: casa.valor };
      case 'imposto_renda':
        var pat = this.patrimonio(j.id);
        return {
          tipo: 'imposto',
          casa: casa,
          valor: Math.min(CFG.IR_FIXO, Math.round(pat * CFG.IR_PERCENTUAL)),
          patrimonio: pat
        };
      case 'sorte':
      case 'azar':
        return { tipo: 'carta', casa: casa, baralho: casa.tipo, carta: this.comprarCarta(casa.tipo) };
      case 'vadelegacia':
        return { tipo: 'vadelegacia', casa: casa, destino: 10 };
    }
    return { tipo: 'neutra', casa: casa };
  };

  /* -------------------------------- cartas ----------------------------- */
  Jogo.prototype.comprarCarta = function (baralho) {
    var fila = this.baralhos[baralho];
    if (!fila.length) {
      this.baralhos[baralho] = embaralhar(NDC.CARTAS[baralho].map(function (c, i) { return i; }));
      fila = this.baralhos[baralho];
    }
    var idx = fila.shift();
    var carta = NDC.CARTAS[baralho][idx];
    return { indice: idx, baralho: baralho, texto: carta.texto, efeito: carta.efeito,
             valor: carta.valor, destino: carta.destino,
             porCasa: carta.porCasa, porHotel: carta.porHotel };
  };

  /**
   * Aplica o efeito de uma carta.
   * Devolve o que o app.js ainda precisa fazer:
   *   { acao:'nada' }
   *   { acao:'mover', destino, ganhaSalario }
   *   { acao:'relativo', passos }
   *   { acao:'escolher', opcoes:[casaId] }   -> casa grátis
   *   { acao:'divida' }                      -> não teve caixa, dívida aberta
   */
  Jogo.prototype.aplicarCarta = function (carta) {
    var self = this;
    var j = this.jogadorAtual();

    switch (carta.efeito) {
      case 'receber':
        this.creditar(j.id, carta.valor, 'carta');
        this.log(j.nome + ' recebeu ' + NDC.dinheiro(carta.valor) + ' (carta).', 'recebimento');
        this.emitir('atualizar', this);
        return { acao: 'nada' };

      case 'pagar':
        return this.cobrar(j.id, [], carta.valor, 'carta').ok
          ? { acao: 'nada' } : { acao: 'divida' };

      case 'receber_de_cada': {
        var advs = this.adversarios(j.id);
        var recebido = 0;
        advs.forEach(function (a) {
          var pago = Math.min(a.dinheiro, carta.valor);   // quem não tem, paga o que tem
          if (pago > 0) { self.debitarDireto(a.id, pago); recebido += pago; }
          if (a.dinheiro < 0) a.dinheiro = 0;
        });
        if (recebido > 0) this.creditar(j.id, recebido, 'carta');
        this.log(j.nome + ' recebeu ' + NDC.dinheiro(recebido) + ' dos adversários.', 'recebimento');
        this.emitir('atualizar', this);
        return { acao: 'nada' };
      }

      case 'pagar_a_cada': {
        var alvos = this.adversarios(j.id).map(function (a) { return a.id; });
        var total = carta.valor * alvos.length;
        return this.cobrar(j.id, alvos, total, 'carta').ok
          ? { acao: 'nada' } : { acao: 'divida' };
      }

      case 'reparos': {
        var casas = 0, hoteis = 0;
        this.bensDe(j.id).forEach(function (c) {
          var est = self.casas[c.id];
          if (est.casas === CFG.NIVEL_HOTEL) hoteis++;
          else casas += est.casas;
        });
        var conta = casas * carta.porCasa + hoteis * carta.porHotel;
        if (conta === 0) {
          this.log(j.nome + ' não tem construções: nada a pagar.', 'info');
          return { acao: 'nada' };
        }
        return this.cobrar(j.id, [], conta, 'reforma de fachada').ok
          ? { acao: 'nada' } : { acao: 'divida' };
      }

      case 'ir_para':
        return { acao: 'mover', destino: carta.destino, ganhaSalario: true };

      case 'ir_para_direto':
        return { acao: 'mover', destino: carta.destino, ganhaSalario: false };

      case 'avancar':
        return { acao: 'relativo', passos: carta.valor };

      case 'voltar':
        return { acao: 'relativo', passos: -carta.valor };

      case 'casa_gratis': {
        var opcoes = TAB.filter(function (c) {
          if (c.tipo !== 'propriedade') return false;
          var est = self.casas[c.id];
          if (est.dono !== j.id || est.casas >= CFG.NIVEL_HOTEL) return false;
          if (!self.monopolioAtivo(j.id, c.grupo)) return false;
          if (CFG.CONSTRUCAO_UNIFORME && est.casas > self._minCasasDoGrupo(c.grupo)) return false;
          return true;
        }).map(function (c) { return c.id; });

        if (!opcoes.length) {
          this.log(j.nome + ' não tem onde usar a verba (precisa de um grupo de cor completo).', 'info');
          return { acao: 'nada' };
        }
        return { acao: 'escolher', opcoes: opcoes };
      }
    }
    return { acao: 'nada' };
  };

  /* ------------------------------- compra ------------------------------ */
  Jogo.prototype.comprar = function (casaId) {
    var j = this.jogadorAtual();
    var casa = TAB[casaId];
    var est = this.casas[casaId];
    if (est.dono !== null || j.dinheiro < casa.preco) return false;

    this.debitarDireto(j.id, casa.preco);
    est.dono = j.id;
    this.log(j.nome + ' comprou ' + casa.nome + ' por ' + NDC.dinheiro(casa.preco) + '.', 'compra');
    this.emitir('atualizar', this);
    return true;
  };

  /* ----------------------------- construção ---------------------------- */
  Jogo.prototype._minCasasDoGrupo = function (grupo) {
    var self = this;
    return Math.min.apply(null, this.casasDoGrupo(grupo).map(function (c) {
      return self.casas[c.id].casas;
    }));
  };

  Jogo.prototype._maxCasasDoGrupo = function (grupo) {
    var self = this;
    return Math.max.apply(null, this.casasDoGrupo(grupo).map(function (c) {
      return self.casas[c.id].casas;
    }));
  };

  /** @returns {true|string} true, ou o motivo de não poder construir. */
  Jogo.prototype.podeConstruir = function (casaId, jogadorId, gratis) {
    var casa = TAB[casaId];
    var est = this.casas[casaId];
    if (casa.tipo !== 'propriedade') return 'Só dá para construir em terrenos.';
    if (est.dono !== jogadorId) return 'A propriedade não é sua.';
    if (est.hipotecada) return 'Propriedade hipotecada.';
    if (!this.monopolioAtivo(jogadorId, casa.grupo)) return 'Você precisa do grupo de cor completo e sem hipoteca.';
    if (est.casas >= CFG.NIVEL_HOTEL) return 'Já tem hotel aqui.';
    if (CFG.CONSTRUCAO_UNIFORME && est.casas > this._minCasasDoGrupo(casa.grupo)) {
      return 'Construa por igual: comece pelas propriedades com menos casas.';
    }
    if (!gratis && this.jogadores[jogadorId].dinheiro < NDC.GRUPOS[casa.grupo].custoCasa) {
      return 'Caixa insuficiente.';
    }
    return true;
  };

  Jogo.prototype.construir = function (casaId, gratis) {
    var j = this.jogadorAtual();
    if (this.podeConstruir(casaId, j.id, gratis) !== true) return false;
    var casa = TAB[casaId];
    var custo = NDC.GRUPOS[casa.grupo].custoCasa;

    if (!gratis) this.debitarDireto(j.id, custo);
    this.casas[casaId].casas++;

    var nivel = this.casas[casaId].casas;
    var oque = nivel === CFG.NIVEL_HOTEL ? 'um hotel' : (nivel + (nivel === 1 ? ' casa' : ' casas'));
    this.log(j.nome + ' agora tem ' + oque + ' em ' + casa.nome +
             (gratis ? ' (verba da prefeitura).' : ' — ' + NDC.dinheiro(custo) + '.'), 'construcao');
    this.emitir('atualizar', this);
    return true;
  };

  Jogo.prototype.podeVenderCasa = function (casaId, jogadorId) {
    var casa = TAB[casaId];
    var est = this.casas[casaId];
    if (casa.tipo !== 'propriedade' || est.dono !== jogadorId) return 'Não é sua.';
    if (est.casas === 0) return 'Não há construção aqui.';
    if (CFG.CONSTRUCAO_UNIFORME && est.casas < this._maxCasasDoGrupo(casa.grupo)) {
      return 'Venda por igual: comece pelas propriedades com mais casas.';
    }
    return true;
  };

  Jogo.prototype.venderCasa = function (casaId, jogadorId) {
    if (this.podeVenderCasa(casaId, jogadorId) !== true) return false;
    var casa = TAB[casaId];
    var volta = Math.round(NDC.GRUPOS[casa.grupo].custoCasa * CFG.VENDA_CASA_PCT);
    this.casas[casaId].casas--;
    this.creditar(jogadorId, volta, 'venda de construção');
    this.log(this.jogadores[jogadorId].nome + ' vendeu uma construção em ' + casa.nome +
             ' por ' + NDC.dinheiro(volta) + '.', 'construcao');
    this.emitir('atualizar', this);
    return true;
  };

  /* ------------------------------ hipoteca ----------------------------- */
  Jogo.prototype.podeHipotecar = function (casaId, jogadorId) {
    var est = this.casas[casaId];
    if (est.dono !== jogadorId) return 'Não é sua.';
    if (est.hipotecada) return 'Já está hipotecada.';
    if (est.casas > 0) return 'Venda as construções antes de hipotecar.';
    return true;
  };

  Jogo.prototype.hipotecar = function (casaId, jogadorId) {
    if (this.podeHipotecar(casaId, jogadorId) !== true) return false;
    var casa = TAB[casaId];
    var valor = Math.round(casa.preco * CFG.HIPOTECA_PCT);
    this.casas[casaId].hipotecada = true;
    this.creditar(jogadorId, valor, 'hipoteca');
    this.log(this.jogadores[jogadorId].nome + ' hipotecou ' + casa.nome +
             ' e recebeu ' + NDC.dinheiro(valor) + '.', 'hipoteca');
    this.emitir('atualizar', this);
    return true;
  };

  Jogo.prototype.custoDeshipoteca = function (casaId) {
    var casa = TAB[casaId];
    return Math.round(casa.preco * CFG.HIPOTECA_PCT * (1 + CFG.JUROS_DESHIPOTECA));
  };

  Jogo.prototype.podeDeshipotecar = function (casaId, jogadorId) {
    var est = this.casas[casaId];
    if (est.dono !== jogadorId) return 'Não é sua.';
    if (!est.hipotecada) return 'Não está hipotecada.';
    if (this.jogadores[jogadorId].dinheiro < this.custoDeshipoteca(casaId)) return 'Caixa insuficiente.';
    return true;
  };

  Jogo.prototype.deshipotecar = function (casaId, jogadorId) {
    if (this.podeDeshipotecar(casaId, jogadorId) !== true) return false;
    var custo = this.custoDeshipoteca(casaId);
    this.debitarDireto(jogadorId, custo);
    this.casas[casaId].hipotecada = false;
    this.log(this.jogadores[jogadorId].nome + ' quitou a hipoteca de ' + TAB[casaId].nome +
             ' por ' + NDC.dinheiro(custo) + '.', 'hipoteca');
    this.emitir('atualizar', this);
    return true;
  };

  /* -------------------------------- troca ------------------------------ */
  /**
   * @param {{de:number, para:number, casasDe:number[], casasPara:number[],
   *          dinheiroDe:number, dinheiroPara:number}} t
   * @returns {true|string}
   */
  Jogo.prototype.validarTroca = function (t) {
    var self = this;
    var a = this.jogadores[t.de], b = this.jogadores[t.para];
    if (!a || !b || a.id === b.id) return 'Escolha outro jogador.';
    if (!t.casasDe.length && !t.casasPara.length && !t.dinheiroDe && !t.dinheiroPara) {
      return 'A proposta está vazia.';
    }
    if (t.dinheiroDe > a.dinheiro) return a.nome + ' não tem esse dinheiro.';
    if (t.dinheiroPara > b.dinheiro) return b.nome + ' não tem esse dinheiro.';

    var erro = null;
    t.casasDe.forEach(function (id) {
      if (self.casas[id].dono !== a.id) erro = 'Propriedade inválida na oferta.';
      if (self.casas[id].casas > 0) erro = 'Venda as construções de ' + TAB[id].nome + ' antes de trocar.';
    });
    t.casasPara.forEach(function (id) {
      if (self.casas[id].dono !== b.id) erro = 'Propriedade inválida no pedido.';
      if (self.casas[id].casas > 0) erro = TAB[id].nome + ' tem construções e não pode ser trocada.';
    });
    return erro || true;
  };

  Jogo.prototype.executarTroca = function (t) {
    var self = this;
    if (this.validarTroca(t) !== true) return false;
    var a = this.jogadores[t.de], b = this.jogadores[t.para];

    t.casasDe.forEach(function (id) { self.casas[id].dono = b.id; });
    t.casasPara.forEach(function (id) { self.casas[id].dono = a.id; });
    if (t.dinheiroDe)   { this.debitarDireto(a.id, t.dinheiroDe);  this.creditar(b.id, t.dinheiroDe); }
    if (t.dinheiroPara) { this.debitarDireto(b.id, t.dinheiroPara); this.creditar(a.id, t.dinheiroPara); }

    this.log('Troca fechada entre ' + a.nome + ' e ' + b.nome + '.', 'troca');
    this.emitir('atualizar', this);
    return true;
  };

  /* ------------------------------ falência ----------------------------- */
  /**
   * Regra simplificada do briefing: o falido perde TUDO. O dinheiro que
   * sobrou vai para quem ele devia; as propriedades voltam para o banco,
   * limpas (sem casas e sem hipoteca), e podem ser compradas de novo.
   */
  Jogo.prototype.declararFalencia = function (jogadorId) {
    var self = this;
    var j = this.jogadores[jogadorId];
    var credores = (this.divida && this.divida.devedor === jogadorId) ? this.divida.credores : [];

    if (j.dinheiro > 0 && credores.length) {
      var sobra = j.dinheiro;
      j.dinheiro = 0;
      this._distribuir(credores, sobra);
    } else {
      j.dinheiro = 0;
    }

    var devolvidas = 0;
    TAB.forEach(function (c) {
      var est = self.casas[c.id];
      if (est.dono === jogadorId) {
        est.dono = null; est.casas = 0; est.hipotecada = false;
        devolvidas++;
      }
    });

    j.falido = true;
    this.divida = null;
    this.log('💥 ' + j.nome + ' faliu! ' + devolvidas + ' propriedades voltaram para o banco.', 'falencia');
    this.emitir('atualizar', this);
    this.verificarFim();
    return true;
  };

  /* ------------------------------- turno ------------------------------- */
  /**
   * Fecha o turno. Se o jogador tirou dupla (e o flag está ligado), ele
   * joga de novo em vez de passar a vez.
   * @returns {{mesmoJogador:boolean}}
   */
  Jogo.prototype.passarVez = function () {
    if (this.fase === 'fim') return { mesmoJogador: false };

    var atual = this.jogadorAtual();
    var repete = CFG.DUPLA_JOGA_DE_NOVO &&
                 this.lance && this.lance.dupla &&
                 !atual.falido &&
                 this.duplasSeguidas < CFG.MAX_DUPLAS_SEGUIDAS;

    if (repete) {
      this.duplasSeguidas++;
      this.fase = 'rolar';
      this.log(atual.nome + ' tirou dupla e joga de novo!', 'destaque');
      this.emitir('atualizar', this);
      return { mesmoJogador: true };
    }

    this.duplasSeguidas = 0;
    var voltas = 0;
    do {
      this.vez = (this.vez + 1) % this.jogadores.length;
      if (this.vez === 0) this.rodada++;
      voltas++;
    } while (this.jogadores[this.vez].falido && voltas <= this.jogadores.length);

    this.lance = null;
    this.fase = 'rolar';
    this.emitir('atualizar', this);
    return { mesmoJogador: false };
  };

  Jogo.prototype.verificarFim = function () {
    var vivos = this.ativos();
    if (vivos.length <= 1) {
      this.fase = 'fim';
      this.vencedor = vivos[0] || null;
      this.log('🏆 Fim de jogo! ' + (this.vencedor ? this.vencedor.nome + ' venceu.' : 'Ninguém sobrou.'), 'destaque');
      this.emitir('fim', this.vencedor);
      return true;
    }
    return false;
  };

  /** Encerra a partida por decisão da mesa: vence quem tem mais patrimônio. */
  Jogo.prototype.encerrarPorPatrimonio = function () {
    var self = this;
    var ranking = this.ativos().slice().sort(function (a, b) {
      return self.patrimonio(b.id) - self.patrimonio(a.id);
    });
    this.fase = 'fim';
    this.vencedor = ranking[0] || null;
    this.log('Partida encerrada pela mesa. Vence quem tem mais patrimônio.', 'destaque');
    this.emitir('fim', this.vencedor);
    return ranking;
  };

  /** Ranking final ordenado por patrimônio (falidos por último). */
  Jogo.prototype.ranking = function () {
    var self = this;
    return this.jogadores.slice().sort(function (a, b) {
      if (a.falido !== b.falido) return a.falido ? 1 : -1;
      return self.patrimonio(b.id) - self.patrimonio(a.id);
    });
  };

  NDC.Jogo = Jogo;
  var UI = NDC.UI = {};

  /* ══════════════════════════════
     3. INTERFACE (tudo que toca o DOM)
     ══════════════════════════════ */
  /* ---------------------------------------------------------------------
     Helpers de DOM
     --------------------------------------------------------------------- */
  function $(sel) { return raiz ? raiz.querySelector(sel) : null; }
  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = cls(attrs[k]);
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'texto') n.textContent = attrs[k];
      else if (k === 'estilo') n.setAttribute('style', attrs[k]);
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) {
      if (f === null || f === undefined || f === false) return;
      n.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    });
    return n;
  }
  function limpar(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  UI.el = el;
  UI.limpar = limpar;

  /* ---------------------------------------------------------------------
     Siglas e ícones das casas
     Em tela pequena não cabe o nome inteiro, então a casa mostra uma sigla.
     No modo ampliado (e no desktop) o nome curto aparece no lugar dela.
     --------------------------------------------------------------------- */
  var IGNORAR = ['de', 'da', 'do', 'das', 'dos', 'e'];

  function sigla(texto) {
    var partes = texto.replace(/\./g, ' ').split(/\s+/).filter(function (p) {
      return p && IGNORAR.indexOf(p.toLowerCase()) === -1;
    });
    if (partes.length === 1) return partes[0].slice(0, 3).toUpperCase();
    return partes.slice(0, 3).map(function (p) { return p.charAt(0); }).join('').toUpperCase();
  }

  var ICONES = {
    partida: '🏁', sorte: '🍀', azar: '⚡', imposto: '🧾', imposto_renda: '🧾',
    delegacia: '🚓', vadelegacia: '🚨', livre: '🅿️', estacao: '🚌', utilidade: '💡'
  };

  function iconeDaCasa(casa) {
    if (casa.id === 5 || casa.id === 35) return '🛣️';
    if (casa.id === 15) return '🚂';
    if (casa.id === 25) return '🚌';
    if (casa.id === 12) return '⚡';
    if (casa.id === 28) return '💧';
    return ICONES[casa.tipo] || '';
  }
  UI.iconeDaCasa = iconeDaCasa;

  /* =====================================================================
     TELAS
     ===================================================================== */
  UI.mostrarTela = function (id) {
    ['tela-setup', 'tela-jogo', 'tela-fim'].forEach(function (t) {
      var n = $('#ndc-' + t);
      if (n) n.classList.toggle('ndc-ativa', t === id);
    });
  };

  /* =====================================================================
     TELA DE SETUP
     ===================================================================== */
  UI.setup = {
    qtd: 4,
    jogadores: [],

    montar: function (aoComecar) {
      var self = this;
      // estado inicial dos 8 slots possíveis
      this.jogadores = NDC.CORES_JOGADOR.map(function (c, i) {
        return {
          nome: '',
          corId: c.id,
          tokenId: NDC.TOKENS[i % NDC.TOKENS.length].id,
          sugestao: 'Jogador ' + (i + 1)
        };
      });

      $('#ndc-qtd-menos').addEventListener('click', function () { self.mudarQtd(-1); });
      $('#ndc-qtd-mais').addEventListener('click', function () { self.mudarQtd(1); });
      $('#ndc-btn-comecar').addEventListener('click', function () {
        aoComecar(self.definicoes());
      });

      this.desenhar();
    },

    /* Jogadores configurados agora, no formato que Jogo.iniciar espera. */
    definicoes: function () {
      return this.jogadores.slice(0, this.qtd).map(function (j, i) {
        return { nome: j.nome.trim() || ('Jogador ' + (i + 1)), corId: j.corId, tokenId: j.tokenId };
      });
    },

    mudarQtd: function (delta) {
      var novo = this.qtd + delta;
      if (novo < CFG.MIN_JOGADORES || novo > CFG.MAX_JOGADORES) return;
      this.qtd = novo;
      this.desenhar();
    },

    desenhar: function () {
      var self = this;
      $('#ndc-qtd-valor').textContent = this.qtd;
      $('#ndc-qtd-menos').disabled = this.qtd <= CFG.MIN_JOGADORES;
      $('#ndc-qtd-mais').disabled  = this.qtd >= CFG.MAX_JOGADORES;

      var lista = limpar($('#ndc-lista-jogadores'));
      var emJogo = this.jogadores.slice(0, this.qtd);
      var usadas = emJogo.map(function (j) { return j.corId; });
      var usados = emJogo.map(function (j) { return j.tokenId; });

      emJogo.forEach(function (j, i) {
        var corHex = corPorId(j.corId);

        // O avatar mostra a peça escolhida sobre o disco da cor: é a mesma
        // dupla arte + anel que vai aparecer no tabuleiro.
        var avatar = el('div', {
          class: 'avatar peca-avatar',
          estilo: 'background-color:' + corHex + ';background-image:url("' + NDC.urlToken(j.tokenId) + '")'
        });

        var input = el('input', {
          type: 'text', maxlength: '14', value: j.nome,
          placeholder: j.sugestao, 'aria-label': 'Nome do jogador ' + (i + 1)
        });
        input.addEventListener('input', function () { j.nome = input.value; });

        var cores = el('div', { class: 'cores' },
          NDC.CORES_JOGADOR.map(function (c) {
            var tomada = usadas.indexOf(c.id) !== -1 && c.id !== j.corId;
            return el('button', {
              type: 'button',
              estilo: 'background:' + c.cor,
              'aria-pressed': c.id === j.corId ? 'true' : 'false',
              'aria-label': c.nome,
              disabled: tomada ? 'disabled' : null,
              onclick: function () { j.corId = c.id; self.desenhar(); }
            });
          })
        );

        var pecas = el('div', { class: 'pecas' },
          NDC.TOKENS.map(function (t) {
            var tomada = usados.indexOf(t.id) !== -1 && t.id !== j.tokenId;
            return el('button', {
              type: 'button',
              class: 'peca',
              'aria-pressed': t.id === j.tokenId ? 'true' : 'false',
              'aria-label': t.nome,
              title: t.nome,
              disabled: tomada ? 'disabled' : null,
              onclick: function () { j.tokenId = t.id; self.desenhar(); }
            }, [el('img', { src: CFG.TOKENS_BASE + t.img, alt: '', loading: 'lazy', draggable: 'false' })]);
          })
        );

        lista.appendChild(el('div', { class: 'linha-jogador' }, [avatar, input, cores, pecas]));
      });
    }
  };

  function corPorId(id) {
    var c = NDC.CORES_JOGADOR.filter(function (x) { return x.id === id; })[0];
    return c ? c.cor : '#888';
  }
  UI.corPorId = corPorId;

  /* Disco da cor do jogador com a peça ilustrada por cima. Um ponto só para
     a faixa da vez, o painel, o ranking e o aviso de passar o aparelho. */
  function estiloAvatar(j) {
    return 'background-color:' + j.cor + ';background-image:url("' + j.tokenImg + '")';
  }
  UI.estiloAvatar = estiloAvatar;

  /* =====================================================================
     TABULEIRO
     ===================================================================== */
  var casasEls = [];      // <div class="ndc-casa"> por id
  var tokensEls = [];     // <div class="ndc-token"> por jogador

  UI.montarTabuleiro = function (aoClicarCasa) {
    var tabuleiro = $('#ndc-tabuleiro');
    var centro = $('#ndc-centro');
    var camada = $('#ndc-camada-tokens');

    // limpa casas antigas mantendo centro e camada de peças
    casasEls.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    casasEls = [];

    TAB.forEach(function (casa) {
      var pos = NDC.posicaoGrid(casa.id);
      var borda = NDC.bordaDaCasa(casa.id);
      var grupo = casa.grupo ? NDC.GRUPOS[casa.grupo]
                : (casa.tipo === 'estacao' ? NDC.GRUPOS.estacao
                : (casa.tipo === 'utilidade' ? NDC.GRUPOS.utilidade : null));

      var filhos = [];
      filhos.push(el('div', {
        class: 'faixa',
        estilo: grupo ? 'background:' + grupo.cor : 'background:transparent'
      }));

      var miolo = [];
      var ico = iconeDaCasa(casa);
      if (ico && !casa.preco) miolo.push(el('div', { class: 'icone', texto: ico }));
      miolo.push(el('div', { class: 'sigla', texto: sigla(casa.curto) }));
      miolo.push(el('div', { class: 'curto', texto: casa.curto }));
      if (casa.preco) miolo.push(el('div', { class: 'preco', texto: casa.preco }));

      filhos.push(el('div', { class: 'miolo' }, miolo));
      filhos.push(el('div', { class: 'dono oculto' }));
      filhos.push(el('div', { class: 'construcoes' }));

      var node = el('div', {
        class: 'casa' + (borda === 'canto' ? ' canto' : '') + (grupo ? '' : ' sem-faixa'),
        'data-id': casa.id,
        'data-borda': borda,
        estilo: 'grid-row:' + pos.linha + ';grid-column:' + pos.coluna,
        onclick: function () { aoClicarCasa(casa.id); }
      }, filhos);

      casasEls.push(node);
      tabuleiro.insertBefore(node, centro);
    });

    void camada; // a camada de peças já existe no HTML
  };

  /* Reflete posse, hipoteca e construções em cada casa. */
  UI.pintarCasas = function (jogo) {
    TAB.forEach(function (casa) {
      var node = casasEls[casa.id];
      if (!node) return;
      var est = jogo.casas[casa.id];

      var pontoDono = node.querySelector('.ndc-dono');
      if (est.dono !== null) {
        pontoDono.classList.remove('ndc-oculto');
        pontoDono.style.background = jogo.jogadores[est.dono].cor;
      } else {
        pontoDono.classList.add('ndc-oculto');
      }

      node.classList.toggle('ndc-hipotecada', !!est.hipotecada);

      var cons = limpar(node.querySelector('.ndc-construcoes'));
      if (est.casas === CFG.NIVEL_HOTEL) {
        cons.appendChild(el('i', { class: 'hotel' }));
      } else {
        for (var i = 0; i < est.casas; i++) cons.appendChild(el('i'));
      }
    });

    // realce da casa onde está quem joga
    var atual = jogo.jogadorAtual();
    casasEls.forEach(function (n, i) { n.classList.toggle('ndc-atual', atual && i === atual.posicao); });
  };

  /* ------------------------------- peças ------------------------------- */
  UI.criarTokens = function (jogo) {
    var camada = limpar($('#ndc-camada-tokens'));
    tokensEls = jogo.jogadores.map(function (j) {
      // A peça é a arte; a cor do jogador vira o anel e o brilho por baixo,
      // que é o que separa duas bicicletas parecidas numa mesa de 8.
      var t = el('div', {
        class: 'token',
        estilo: '--ndc-cor-peca:' + j.cor,
        'data-jogador': j.id,
        title: j.nome
      }, [
        el('img', { class: 'token-img', src: j.tokenImg, alt: '', draggable: 'false' })
      ]);
      camada.appendChild(t);
      return t;
    });
    UI.posicionarTokens(jogo);
  };

  function medidasCasa(id) {
    var n = casasEls[id];
    if (!n) return { x: 0, y: 0, w: 10, h: 10 };
    return { x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight };
  }

  /* Reposiciona TODAS as peças, agrupando as que dividem a mesma casa. */
  UI.posicionarTokens = function (jogo) {
    var porCasa = {};
    jogo.jogadores.forEach(function (j) {
      if (j.falido) return;
      (porCasa[j.posicao] || (porCasa[j.posicao] = [])).push(j.id);
    });

    var atual = jogo.jogadorAtual();

    jogo.jogadores.forEach(function (j) {
      var t = tokensEls[j.id];
      if (!t) return;
      if (j.falido) { t.style.display = 'none'; return; }
      t.style.display = '';
      t.classList.toggle('ndc-vez', !!atual && atual.id === j.id);

      var grupo = porCasa[j.posicao];
      var idx = grupo.indexOf(j.id);
      var n = grupo.length;
      var m = medidasCasa(j.posicao);

      var cols = Math.ceil(Math.sqrt(n));
      var rows = Math.ceil(n / cols);
      // Sozinha, a peça ocupa a casa inteira (TOKEN_ESCALA). Dividindo a casa
      // com outras ela encolhe pelo número de colunas, com uma folga para as
      // artes não se encostarem.
      var tam = Math.min(m.w, m.h) * CFG.TOKEN_ESCALA / (n === 1 ? 1 : cols + 0.15);
      var gw = cols * tam, gh = rows * tam;
      var ox = m.x + (m.w - gw) / 2;
      var oy = m.y + (m.h - gh) / 2;
      var c = idx % cols, r = Math.floor(idx / cols);

      aplicarToken(t, ox + c * tam, oy + r * tam, tam);
    });
  };

  function aplicarToken(t, x, y, tam) {
    t.style.width = tam + 'px';
    t.style.height = tam + 'px';
    t.style.fontSize = Math.max(7, tam * 0.5) + 'px';
    t.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  /* Coloca uma peça sozinha no centro de uma casa (usado durante o passo). */
  function tokenNaCasa(jogadorId, casaId) {
    var t = tokensEls[jogadorId];
    if (!t) return;
    var m = medidasCasa(casaId);
    var tam = Math.min(m.w, m.h) * CFG.TOKEN_ESCALA;
    aplicarToken(t, m.x + (m.w - tam) / 2, m.y + (m.h - tam) / 2, tam);
  }

  /**
   * Anda com a peça, casa a casa.
   * @param {number[]} caminho lista de ids de casa, na ordem
   */
  UI.andarPeca = function (jogo, jogadorId, caminho, aoTerminar) {
    var t = tokensEls[jogadorId];
    if (!t || !caminho.length) { UI.posicionarTokens(jogo); aoTerminar && aoTerminar(); return; }

    t.style.zIndex = '9';
    t.classList.add('ndc-andando');
    var i = 0;

    (function passo() {
      if (i >= caminho.length) {
        t.classList.remove('ndc-andando');
        t.style.zIndex = '';
        UI.posicionarTokens(jogo);
        setTimeout(function () { aoTerminar && aoTerminar(); }, 120);
        return;
      }
      var casaId = caminho[i++];
      tokenNaCasa(jogadorId, casaId);
      var node = casasEls[casaId];
      if (node) {
        node.classList.add('ndc-pisca');
        setTimeout(function () { node.classList.remove('ndc-pisca'); }, 260);
      }
      setTimeout(passo, CFG.MS_PASSO_TOKEN);
    })();
  };

  /** Teleporte (carta “vá direto para…”). */
  UI.teleportarPeca = function (jogo, jogadorId, casaId, aoTerminar) {
    var t = tokensEls[jogadorId];
    if (t) t.style.transition = 'transform .45s cubic-bezier(.4,1.4,.5,1)';
    tokenNaCasa(jogadorId, casaId);
    setTimeout(function () {
      if (t) t.style.transition = '';
      UI.posicionarTokens(jogo);
      aoTerminar && aoTerminar();
    }, 520);
  };

  /* =====================================================================
     DADOS
     ===================================================================== */
  var FACES = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };

  function desenharDado(node, face) {
    limpar(node);
    var on = FACES[face] || [];
    for (var i = 0; i < 9; i++) {
      node.appendChild(el('i', { class: on.indexOf(i) !== -1 ? 'on' : '' }));
    }
  }

  UI.zerarDados = function () {
    desenharDado($('#ndc-dado1'), 1);
    desenharDado($('#ndc-dado2'), 1);
    $('#ndc-resultado-dados').textContent = '';
  };

  /** Gira os dados e revela o lance. */
  UI.animarDados = function (lance, aoTerminar) {
    var d1 = $('#ndc-dado1'), d2 = $('#ndc-dado2'), res = $('#ndc-resultado-dados');
    res.textContent = '';
    d1.classList.add('ndc-rolando'); d2.classList.add('ndc-rolando');

    var giro = setInterval(function () {
      desenharDado(d1, 1 + Math.floor(Math.random() * 6));
      desenharDado(d2, 1 + Math.floor(Math.random() * 6));
    }, 70);

    setTimeout(function () {
      clearInterval(giro);
      d1.classList.remove('ndc-rolando'); d2.classList.remove('ndc-rolando');
      desenharDado(d1, lance.d1);
      desenharDado(d2, lance.d2);
      res.innerHTML = lance.d1 + ' + ' + lance.d2 + ' = <b>' + lance.total + '</b>' +
        (lance.dupla ? ' <span class="ndc-dupla">• DUPLA!</span>' : '');
      aoTerminar && aoTerminar();
    }, CFG.MS_ROLAGEM_DADOS);
  };

  UI.mensagemCentro = function (texto) {
    $('#ndc-msg-centro').innerHTML = texto || '';
  };

  /* ------------------------- animação da coruja ------------------------- */
  /* O vídeo (dados-coruja.mp4) roda no miolo do tabuleiro antes dos dados
     girarem. É enfeite: o lance já foi sorteado pelo motor quando isto
     começa, então se o vídeo não tocar (autoplay bloqueado, arquivo
     ausente, prefers-reduced-motion) o jogo segue igual pelo aoTerminar.

     Marca d'água do Pika: a arte é ampliada (scale) e recortada por uma
     máscara radial no CSS, o que empurra os cantos — onde a marca fica —
     para fora do quadro e ainda funde a borda com o fundo do tabuleiro.
     Se em algum aparelho a marca ainda aparecer de canto de olho, é
     preferível deixar assim a não ter animação nenhuma. */
  function _semMovimento() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  UI.animarCoruja = function (aoTerminar) {
    var ov = $('#ndc-coruja');
    var vid = $('#ndc-coruja-video');
    if (!ov || !vid || !CFG.ANIM_CORUJA || _semMovimento()) {
      aoTerminar && aoTerminar();
      return;
    }
    ov.classList.add('ndc-ativa');
    try {
      vid.currentTime = 0;
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});   // autoplay bloqueado: só o pôster
    } catch (e) { /* sem vídeo, segue o jogo */ }

    setTimeout(function () {
      UI.pararCoruja();
      aoTerminar && aoTerminar();
    }, CFG.MS_ANIM_CORUJA);
  };

  UI.pararCoruja = function () {
    if (!raiz) return;
    var ov = $('#ndc-coruja');
    var vid = $('#ndc-coruja-video');
    if (ov) ov.classList.remove('ndc-ativa');
    if (vid) { try { vid.pause(); } catch (e) { /* ignorado */ } }
  };

  /* =====================================================================
     FAIXA DA VEZ + PAINÉIS
     ===================================================================== */
  UI.atualizarFaixa = function (jogo, avisarTroca) {
    var j = jogo.jogadorAtual();
    if (!j) return;
    var peca = $('#ndc-peca-vez');
    peca.textContent = '';
    peca.setAttribute('style', estiloAvatar(j));
    $('#ndc-nome-vez').textContent = j.nome;
    $('#ndc-rotulo-vez').textContent = 'Rodada ' + jogo.rodada + ' • vez de';
    $('#ndc-caixa-vez').textContent = NDC.dinheiro(j.dinheiro);
    $('#ndc-titulo-centro').innerHTML = 'Vez de <b>' + escapar(j.nome) + '</b>';

    if (avisarTroca) {
      var faixa = $('#ndc-faixa-vez');
      faixa.classList.remove('ndc-trocando');
      void faixa.offsetWidth;             // força reinício da animação
      faixa.classList.add('ndc-trocando');
    }
  };

  function chipsDoJogador(jogo, jogadorId) {
    var chips = [];
    Object.keys(NDC.GRUPOS).forEach(function (g) {
      var doGrupo = jogo.casasDoGrupo(g).filter(function (c) { return jogo.casas[c.id].dono === jogadorId; });
      var totalGrupo = jogo.casasDoGrupo(g).length;
      if (!doGrupo.length) return;
      chips.push(el('span', {
        class: 'chip' + (doGrupo.length < totalGrupo ? ' pouco' : ''),
        estilo: 'background:' + NDC.GRUPOS[g].cor,
        texto: doGrupo.length + '/' + totalGrupo
      }));
    });
    ['estacao', 'utilidade'].forEach(function (tipo) {
      var n = jogo.contarTipo(jogadorId, tipo);
      if (!n) return;
      var total = TAB.filter(function (c) { return c.tipo === tipo; }).length;
      chips.push(el('span', {
        class: 'chip pouco',
        estilo: 'background:' + NDC.GRUPOS[tipo === 'estacao' ? 'estacao' : 'utilidade'].cor,
        texto: (tipo === 'estacao' ? '🚌 ' : '💡 ') + n + '/' + total
      }));
    });
    return chips;
  }

  UI.painelJogadores = function (jogo) {
    var pane = limpar($('#ndc-pane-jogadores'));
    var atual = jogo.jogadorAtual();

    jogo.jogadores.forEach(function (j) {
      var avatar = el('div', { class: 'avatar peca-avatar', estilo: estiloAvatar(j) });
      var chips = el('div', { class: 'chips' }, chipsDoJogador(jogo, j.id));

      var info = el('div', { class: 'info' }, [
        el('b', { texto: j.nome + (j.falido ? ' (falido)' : '') }),
        el('small', { texto: jogo.bensDe(j.id).length + ' propriedades' }),
        chips
      ]);

      var valores = el('div', { class: 'valores' }, [
        el('span', { class: 'grana', texto: NDC.dinheiro(j.dinheiro) }),
        el('small', { texto: 'patrim. ' + NDC.dinheiro(jogo.patrimonio(j.id)) })
      ]);

      pane.appendChild(el('div', {
        class: 'card-jogador' + (atual && atual.id === j.id && !j.falido ? ' davez' : '') + (j.falido ? ' falido' : '')
      }, [avatar, info, valores]));
    });
  };

  UI.painelBens = function (jogo, aoClicarBem) {
    var pane = limpar($('#ndc-pane-bens'));
    var j = jogo.jogadorAtual();
    if (!j) return;

    var bens = jogo.bensDe(j.id);
    pane.appendChild(el('div', { class: 'rotulo', estilo: 'display:block;margin-bottom:8px' },
      ['Bens de ' + j.nome]));

    if (!bens.length) {
      pane.appendChild(el('div', { class: 'vazio', texto: 'Nenhuma propriedade ainda. Ande pelo tabuleiro e compre!' }));
      return;
    }

    var lista = el('div', { class: 'lista-bens' });
    bens.forEach(function (c) {
      var est = jogo.casas[c.id];
      var cor = c.grupo ? NDC.GRUPOS[c.grupo].cor
              : (c.tipo === 'estacao' ? NDC.GRUPOS.estacao.cor : NDC.GRUPOS.utilidade.cor);

      var detalhe = [];
      if (est.hipotecada) detalhe.push('hipotecada');
      else if (est.casas === CFG.NIVEL_HOTEL) detalhe.push('hotel');
      else if (est.casas) detalhe.push(est.casas + (est.casas === 1 ? ' casa' : ' casas'));
      if (!est.hipotecada) detalhe.push('aluguel ' + NDC.dinheiro(jogo.aluguel(c.id, 7)));

      lista.appendChild(el('div', { class: 'item-bem', estilo: 'border-left-color:' + cor }, [
        el('div', { class: 'nome' }, [
          el('b', { texto: c.curto }),
          el('small', { texto: detalhe.join(' • ') })
        ]),
        el('div', { class: 'acao' }, [
          el('button', {
            class: 'btn btn-mini', type: 'button', texto: 'Ver',
            onclick: function () { aoClicarBem(c.id); }
          })
        ])
      ]));
    });
    pane.appendChild(lista);
  };

  UI.painelHistorico = function (jogo) {
    var box = limpar($('#ndc-historico'));
    jogo.historico.slice(-60).forEach(function (h) {
      box.appendChild(el('p', { class: h.tipo, texto: h.texto }));
    });
  };

  UI.ligarAbas = function () {
    var botoes = raiz.querySelectorAll('.ndc-abas button');
    Array.prototype.forEach.call(botoes, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(botoes, function (o) { o.setAttribute('aria-selected', 'false'); });
        b.setAttribute('aria-selected', 'true');
        ['jogadores', 'bens', 'historico'].forEach(function (a) {
          var pane = $('#ndc-pane-' + a);
          if (pane) pane.classList.toggle('ndc-ativa', a === b.dataset.aba);
        });
      });
    });
  };

  /* =====================================================================
     BARRA DE AÇÕES
     ===================================================================== */
  /**
   * @param {{principal:{texto,onClick,classe,desativado}, alternativo:?{...},
   *          secundariasAtivas:boolean}} cfg
   */
  UI.barraAcoes = function (cfg) {
    var p = $('#ndc-btn-principal');
    var a = $('#ndc-btn-alternativo');

    p.textContent = cfg.principal.texto;
    p.className = cls('btn ' + (cfg.principal.classe || 'btn-primario'));
    p.disabled = !!cfg.principal.desativado;
    p.onclick = cfg.principal.onClick || null;

    if (cfg.alternativo) {
      a.classList.remove('ndc-oculto');
      a.textContent = cfg.alternativo.texto;
      a.className = cls('btn ' + (cfg.alternativo.classe || ''));
      a.disabled = !!cfg.alternativo.desativado;
      a.onclick = cfg.alternativo.onClick || null;
    } else {
      a.classList.add('ndc-oculto');
      a.onclick = null;
    }

    ['#ndc-btn-construir', '#ndc-btn-hipoteca', '#ndc-btn-trocar'].forEach(function (s) {
      $(s).disabled = !cfg.secundariasAtivas;
    });
  };

  /* =====================================================================
     MODAIS
     ===================================================================== */
  var modalAberto = null;

  /**
   * @param {{titulo, cor?, corpo:(string|Node), acoes?:Array, fechavel?:boolean,
   *          aoFechar?:Function}} opt
   * @returns {HTMLElement} o nó .modal (para consultas internas)
   */
  UI.modal = function (opt) {
    UI.fecharModal(true);

    var corpo = typeof opt.corpo === 'string'
      ? el('div', { class: 'corpo-modal', html: opt.corpo })
      : el('div', { class: 'corpo-modal' }, [opt.corpo]);

    var topo = el('div', { class: 'topo-modal' }, [
      el('h3', { texto: opt.titulo || '' }),
      opt.fechavel === false ? null : el('button', {
        class: 'fechar', type: 'button', 'aria-label': 'Fechar', texto: '×',
        onclick: function () { UI.fecharModal(); }
      })
    ]);

    var filhos = [];
    if (opt.cor) filhos.push(el('div', { class: 'faixa-cor', estilo: 'background:' + opt.cor }));
    filhos.push(topo, corpo);

    if (opt.acoes && opt.acoes.length) {
      filhos.push(el('div', { class: 'acoes-modal' + (opt.acoes.length === 2 ? ' duplo' : '') },
        opt.acoes.map(function (ac) {
          return el('button', {
            class: 'btn ' + (ac.classe || ''),
            type: 'button',
            texto: ac.texto,
            disabled: ac.desativado ? 'disabled' : null,
            onclick: function () {
              if (ac.fechar !== false) UI.fecharModal(true);
              ac.onClick && ac.onClick();
            }
          });
        })
      ));
    }

    var caixa = el('div', { class: 'modal' }, filhos);
    var fundo = el('div', {
      class: 'fundo-modal',
      onclick: function (e) {
        if (e.target === fundo && opt.fechavel !== false) UI.fecharModal();
      }
    }, [caixa]);

    modalAberto = { fundo: fundo, aoFechar: opt.aoFechar };
    $('#ndc-raiz-modal').appendChild(fundo);
    return caixa;
  };

  UI.fecharModal = function (silencioso) {
    if (!modalAberto) return;
    var m = modalAberto;
    modalAberto = null;
    if (m.fundo.parentNode) m.fundo.parentNode.removeChild(m.fundo);
    if (!silencioso && m.aoFechar) m.aoFechar();
  };

  UI.temModal = function () { return !!modalAberto; };

  /* Ficha completa de uma casa (aparece ao tocar no tabuleiro). */
  UI.fichaDaCasa = function (jogo, casaId, acoes) {
    var casa = TAB[casaId];
    var est = jogo.casas[casaId];
    var grupo = casa.grupo ? NDC.GRUPOS[casa.grupo]
              : (casa.tipo === 'estacao' ? NDC.GRUPOS.estacao
              : (casa.tipo === 'utilidade' ? NDC.GRUPOS.utilidade : null));

    var html = '';
    if (casa.desc) html += '<p>' + escapar(casa.desc) + '</p>';

    if (casa.tipo === 'propriedade') {
      html += '<p>Grupo <strong>' + grupo.nome + '</strong> • preço <strong>' + NDC.dinheiro(casa.preco) +
              '</strong> • casa <strong>' + NDC.dinheiro(grupo.custoCasa) + '</strong></p>';
      var nivelAtual = est.casas;
      var linhas = ['Terreno vazio', '1 casa', '2 casas', '3 casas', '4 casas', 'Hotel'];
      html += '<table class="ndc-tabela-aluguel">';
      linhas.forEach(function (rot, i) {
        var v = casa.alugueis[i];
        if (i === 0 && est.dono !== null && jogo.monopolioAtivo(est.dono, casa.grupo)) {
          v = v * 2; rot += ' (grupo completo ×2)';
        }
        html += '<tr' + (i === nivelAtual ? ' class="ndc-atual"' : '') + '><td>' + rot + '</td><td>' +
                NDC.dinheiro(v) + '</td></tr>';
      });
      html += '</table>';
      html += '<p class="ndc-sub">Hipoteca: ' + NDC.dinheiro(Math.round(casa.preco * CFG.HIPOTECA_PCT)) +
              ' • quitar depois: ' + NDC.dinheiro(jogo.custoDeshipoteca(casaId)) + '</p>';
    } else if (casa.tipo === 'estacao') {
      html += '<p>Preço <strong>' + NDC.dinheiro(casa.preco) + '</strong>. O aluguel sobe conforme o dono junta pontos de transporte.</p>';
      html += '<table class="ndc-tabela-aluguel">';
      CFG.ALUGUEL_ESTACAO.forEach(function (v, i) {
        var q = est.dono !== null ? jogo.contarTipo(est.dono, 'estacao') : 0;
        html += '<tr' + (q === i + 1 ? ' class="ndc-atual"' : '') + '><td>' + (i + 1) +
                (i ? ' transportes' : ' transporte') + '</td><td>' + NDC.dinheiro(v) + '</td></tr>';
      });
      html += '</table>';
    } else if (casa.tipo === 'utilidade') {
      html += '<p>Preço <strong>' + NDC.dinheiro(casa.preco) + '</strong>. O aluguel é o valor dos dados multiplicado por ' +
              CFG.MULT_UTILIDADE[0] + ' (uma companhia) ou ' + CFG.MULT_UTILIDADE[1] + ' (as duas).</p>';
    }

    if (est.dono !== null) {
      var dono = jogo.jogadores[est.dono];
      html += '<p style="margin-top:10px">Dono: <strong style="color:' + dono.cor + '">' +
              escapar(dono.nome) + '</strong>' + (est.hipotecada ? ' — <strong>hipotecada</strong>' : '') + '</p>';
    } else if (casa.preco) {
      html += '<p style="margin-top:10px">Ainda <strong>sem dono</strong>.</p>';
    }

    return UI.modal({
      titulo: casa.nome,
      cor: grupo ? grupo.cor : 'var(--ndc-linha)',
      corpo: html,
      acoes: acoes || [{ texto: 'Fechar', classe: 'btn-fantasma' }]
    });
  };

  /* =====================================================================
     FEEDBACK DE DINHEIRO
     ===================================================================== */
  UI.brinde = function (delta) {
    if (!delta) return;
    var caixa = $('#ndc-brindes');
    while (caixa.children.length >= 3) caixa.removeChild(caixa.firstChild);
    var n = el('div', {
      class: 'brinde ' + (delta > 0 ? 'mais' : 'menos'),
      texto: (delta > 0 ? '+ ' : '− ') + NDC.dinheiro(Math.abs(delta))
    });
    caixa.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 1600);
  };

  /* =====================================================================
     TELA FINAL
     ===================================================================== */
  UI.telaFinal = function (jogo) {
    var ranking = jogo.ranking();
    $('#ndc-campeao-nome').textContent = ranking[0] ? ranking[0].nome + ' venceu!' : 'Sem vencedor';

    var box = limpar($('#ndc-ranking'));
    ranking.forEach(function (j, i) {
      box.appendChild(el('div', { class: 'linha-rank' + (i === 0 ? ' primeiro' : '') }, [
        el('div', { class: 'pos-rank', texto: (i + 1) + 'º' }),
        el('div', { class: 'avatar peca-avatar', estilo: estiloAvatar(j) }),
        el('div', { class: 'nome-rank' }, [
          el('div', { texto: j.nome }),
          el('small', { estilo: 'color:var(--ndc-txt3);font-size:12px',
            texto: j.falido ? 'faliu' : jogo.bensDe(j.id).length + ' propriedades' })
        ]),
        el('div', { class: 'grana', texto: NDC.dinheiro(jogo.patrimonio(j.id)) })
      ]));
    });
    UI.mostrarTela('tela-fim');
  };
  /* ══════════════════════════════
     4. CONTROLADOR (conduz o turno)
     ══════════════════════════════ */
  var jogo = null;
  var modoPassaAparelho = true;
  var ampliado = false;
  /* true enquanto a peça anda / os dados giram. Se a pessoa sair pro menu
     do hub nesse meio, parar() zera os timers e a animação morre pela
     metade; _retomar usa esta marca pra terminar de resolver a casa. */
  var _emAnimacao = false;

  /* =====================================================================
     INÍCIO DE PARTIDA
     ===================================================================== */
  function comecarPartida(defs) {
    jogo = new NDC.Jogo();

    jogo.on('atualizar', repintar);
    jogo.on('log', function () { UI.painelHistorico(jogo); });
    jogo.on('dinheiro', function (ev) {
      // evita enxurrada de avisos: mostra o do jogador da vez e valores altos
      if (ev.jogador === jogo.vez || Math.abs(ev.delta) >= 150) UI.brinde(ev.delta);
    });
    jogo.on('fim', function () { setTimeout(function () { UI.telaFinal(jogo); }, 700); });

    jogo.iniciar(defs);

    UI.mostrarTela('tela-jogo');
    UI.montarTabuleiro(function (casaId) { UI.fichaDaCasa(jogo, casaId); });

    // espera o layout existir para calcular a posição das peças
    requestAnimationFrame(function () {
      if (!raiz || !jogo) return;   // saiu do jogo antes do frame chegar
      UI.criarTokens(jogo);
      repintar();
      UI.zerarDados();
      abrirTurno(false);
    });
  }

  function repintar() {
    if (!jogo) return;
    UI.atualizarFaixa(jogo);
    UI.pintarCasas(jogo);
    UI.posicionarTokens(jogo);
    UI.painelJogadores(jogo);
    UI.painelBens(jogo, function (casaId) { UI.fichaDaCasa(jogo, casaId); });
  }

  /* =====================================================================
     TURNO
     ===================================================================== */
  /** Abre a vez. `avisar` mostra a tela de "passe o aparelho". */
  function abrirTurno(avisar) {
    if (jogo.fase === 'fim') return;
    var j = jogo.jogadorAtual();
    UI.atualizarFaixa(jogo, true);
    UI.mensagemCentro('Toque em <b>Rolar dados</b>.');

    function entrar() {
      UI.barraAcoes({
        principal: { texto: '🎲 Rolar dados', onClick: rolar },
        secundariasAtivas: true
      });
    }

    if (avisar && modoPassaAparelho && jogo.ativos().length > 1) {
      UI.modal({
        titulo: 'Passe o aparelho',
        cor: j.cor,
        fechavel: false,
        corpo: '<div style="text-align:center;padding:14px 0">' +
               '<div class="ndc-peca-avatar" style="width:74px;height:74px;border-radius:50%;margin:0 auto 14px;' +
               'background-color:' + j.cor + ';background-image:url(&quot;' + j.tokenImg + '&quot;)"></div>' +
               '<div style="font-size:24px;font-weight:900;color:var(--ndc-txt)">' + textoSeguro(j.nome) + '</div>' +
               '<div style="margin-top:6px">Caixa: <strong>' + NDC.dinheiro(j.dinheiro) + '</strong></div>' +
               '</div>',
        acoes: [{ texto: 'Sou eu — bora', classe: 'btn-primario', onClick: entrar }]
      });
    } else {
      entrar();
    }
  }

  function ocupar(msg) {
    UI.barraAcoes({
      principal: { texto: msg || 'Aguarde…', desativado: true },
      secundariasAtivas: false
    });
  }

  function rolar() {
    ocupar('Rolando…');
    _emAnimacao = true;
    var lance = jogo.rolar();
    // A coruja joga primeiro (enfeite), os dados do jogo revelam depois o
    // lance que o motor já sorteou.
    UI.animarCoruja(function () {
      UI.animarDados(lance, function () {
        UI.mensagemCentro('Andando ' + lance.total + ' casas…');
        andar(lance.total, 0);
      });
    });
  }

  /** Monta a lista de casas por onde a peça passa. */
  function caminho(de, passos) {
    var lista = [], p = de;
    var dir = passos >= 0 ? 1 : -1;
    for (var i = 0; i < Math.abs(passos); i++) {
      p = (p + dir + 40) % 40;
      lista.push(p);
    }
    return lista;
  }

  function andar(passos, profundidade) {
    var j = jogo.jogadorAtual();
    var de = j.posicao;
    _emAnimacao = true;
    jogo.mover(passos);
    UI.andarPeca(jogo, j.id, caminho(de, passos), function () {
      _emAnimacao = false;
      repintar();
      resolver(profundidade || 0);
    });
  }

  function irDireto(destino, profundidade) {
    var j = jogo.jogadorAtual();
    _emAnimacao = true;
    jogo.irPara(destino, false);
    UI.teleportarPeca(jogo, j.id, destino, function () {
      _emAnimacao = false;
      repintar();
      resolver(profundidade || 0);
    });
  }

  /* =====================================================================
     RESOLUÇÃO DA CASA
     ===================================================================== */
  function resolver(profundidade) {
    if (jogo.fase === 'fim') return;
    if (profundidade > 3) { faseAcoes(); return; }   // trava anti-loop de cartas

    var d = jogo.resolverCasa();
    var j = jogo.jogadorAtual();

    switch (d.tipo) {
      case 'comprar':   return modalComprar(d);
      case 'aluguel':   return modalAluguel(d);
      case 'imposto':   return modalImposto(d);
      case 'carta':     return modalCarta(d, profundidade);
      case 'vadelegacia':
        UI.mensagemCentro('🚨 Direto para a Delegacia!');
        return irDireto(d.destino, (profundidade || 0) + 1);

      case 'propria':
        UI.mensagemCentro('Você parou em <b>' + textoSeguro(d.casa.curto) + '</b>. É sua.');
        return faseAcoes();

      case 'hipotecada':
        UI.mensagemCentro('<b>' + textoSeguro(d.casa.curto) + '</b> está hipotecada. Sem aluguel hoje.');
        return faseAcoes();

      case 'partida':
        UI.mensagemCentro('🏁 Você caiu na Partida.');
        return faseAcoes();

      default:
        UI.mensagemCentro(textoSeguro(d.casa.nome) + '. ' + (d.casa.desc || 'Nada acontece aqui.'));
        void j;
        return faseAcoes();
    }
  }

  /* ------------------------------- compra ------------------------------ */
  function modalComprar(d) {
    ocupar();
    var casa = d.casa;
    var grupo = corDaCasa(casa);

    UI.fichaDaCasa(jogo, casa.id, [
      {
        texto: d.podePagar ? 'Comprar por ' + NDC.dinheiro(casa.preco) : 'Caixa insuficiente',
        classe: 'btn-primario',
        desativado: !d.podePagar,
        onClick: function () {
          jogo.comprar(casa.id);
          UI.mensagemCentro('Você comprou <b>' + textoSeguro(casa.curto) + '</b>!');
          faseAcoes();
        }
      },
      {
        texto: 'Passar',
        classe: 'btn-fantasma',
        onClick: function () {
          jogo.log(jogo.jogadorAtual().nome + ' passou ' + casa.nome + '.', 'info');
          UI.mensagemCentro('Ninguém quis <b>' + textoSeguro(casa.curto) + '</b> desta vez.');
          faseAcoes();
        }
      }
    ]);
    void grupo;
  }

  /* ------------------------------- aluguel ----------------------------- */
  function modalAluguel(d) {
    ocupar();
    var j = jogo.jogadorAtual();
    var detalhe = '';
    if (d.casa.tipo === 'utilidade') {
      var mult = jogo.contarTipo(d.dono.id, 'utilidade') > 1 ? CFG.MULT_UTILIDADE[1] : CFG.MULT_UTILIDADE[0];
      detalhe = '<p class="ndc-sub">' + mult + ' × ' + (jogo.lance ? jogo.lance.total : 7) + ' (dados)</p>';
    } else if (d.casa.tipo === 'estacao') {
      detalhe = '<p class="ndc-sub">' + d.dono.nome + ' tem ' + jogo.contarTipo(d.dono.id, 'estacao') + ' pontos de transporte.</p>';
    } else {
      var est = jogo.casas[d.casa.id];
      detalhe = '<p class="ndc-sub">' + (est.casas === CFG.NIVEL_HOTEL ? 'Com hotel.'
              : est.casas ? 'Com ' + est.casas + (est.casas === 1 ? ' casa.' : ' casas.')
              : (jogo.monopolioAtivo(d.dono.id, d.casa.grupo) ? 'Terreno vazio, mas o grupo de cor é todo dele: aluguel em dobro.' : 'Terreno vazio.')) + '</p>';
    }

    UI.modal({
      titulo: 'Aluguel de ' + d.casa.curto,
      cor: corDaCasa(d.casa),
      fechavel: false,
      corpo: '<p>Esta propriedade é de <strong style="color:' + d.dono.cor + '">' + textoSeguro(d.dono.nome) + '</strong>.</p>' +
             '<p style="font-size:26px;font-weight:900;color:var(--ndc-perigo);margin:8px 0">' + NDC.dinheiro(d.valor) + '</p>' +
             detalhe,
      acoes: [{
        texto: j.dinheiro >= d.valor ? 'Pagar' : 'Preciso levantar dinheiro',
        classe: j.dinheiro >= d.valor ? 'btn-primario' : 'btn-ouro',
        onClick: function () {
          var r = jogo.cobrar(j.id, [d.dono.id], d.valor, 'aluguel de ' + d.casa.curto);
          if (r.ok) {
            UI.mensagemCentro('Você pagou ' + NDC.dinheiro(d.valor) + ' para ' + textoSeguro(d.dono.nome) + '.');
            faseAcoes();
          } else {
            modalLevantarDinheiro();
          }
        }
      }]
    });
  }

  /* ------------------------------- imposto ----------------------------- */
  function modalImposto(d) {
    ocupar();
    var j = jogo.jogadorAtual();
    var extra = d.patrimonio !== undefined
      ? '<p class="ndc-sub">Seu patrimônio é ' + NDC.dinheiro(d.patrimonio) + '. Você paga o menor entre ' +
        NDC.dinheiro(CFG.IR_FIXO) + ' e 10% disso.</p>' : '';

    UI.modal({
      titulo: d.casa.nome,
      cor: 'var(--ndc-perigo)',
      fechavel: false,
      corpo: '<p>' + (d.casa.desc || '') + '</p>' +
             '<p style="font-size:26px;font-weight:900;color:var(--ndc-perigo);margin:8px 0">' + NDC.dinheiro(d.valor) + '</p>' + extra,
      acoes: [{
        texto: j.dinheiro >= d.valor ? 'Pagar' : 'Preciso levantar dinheiro',
        classe: j.dinheiro >= d.valor ? 'btn-primario' : 'btn-ouro',
        onClick: function () {
          var r = jogo.cobrar(j.id, [], d.valor, d.casa.nome);
          if (r.ok) { UI.mensagemCentro('Imposto pago: ' + NDC.dinheiro(d.valor) + '.'); faseAcoes(); }
          else modalLevantarDinheiro();
        }
      }]
    });
  }

  /* -------------------------------- carta ------------------------------ */
  function modalCarta(d, profundidade) {
    ocupar();
    var carta = d.carta;
    var ehSorte = d.baralho === 'sorte';

    UI.modal({
      titulo: ehSorte ? '🍀 Sorte' : '⚡ Azar',
      cor: ehSorte ? 'var(--ndc-acc)' : 'var(--ndc-perigo)',
      fechavel: false,
      corpo: el('div', { class: 'carta ' + d.baralho }, [
        el('span', { class: 'selo-carta', texto: ehSorte ? 'Sorte' : 'Azar' }),
        el('div', { texto: carta.texto })
      ]),
      acoes: [{
        texto: 'Ok',
        classe: 'btn-primario',
        onClick: function () {
          jogo.log((ehSorte ? '🍀 ' : '⚡ ') + jogo.jogadorAtual().nome + ': ' + carta.texto, ehSorte ? 'recebimento' : 'pagamento');
          var r = jogo.aplicarCarta(carta);
          var prox = (profundidade || 0) + 1;

          switch (r.acao) {
            case 'mover':
              if (r.ganhaSalario === false) return irDireto(r.destino, prox);
              var passos = ((r.destino - jogo.jogadorAtual().posicao) % 40 + 40) % 40;
              return andar(passos, prox);
            case 'relativo':
              return andar(r.passos, prox);
            case 'escolher':
              return modalCasaGratis(r.opcoes);
            case 'divida':
              return modalLevantarDinheiro();
            default:
              repintar();
              return faseAcoes();
          }
        }
      }]
    });
  }

  function modalCasaGratis(opcoes) {
    var caixa = UI.modal({
      titulo: '🏗️ Verba da prefeitura',
      cor: 'var(--ndc-acc2)',
      fechavel: false,
      corpo: 'Escolha onde construir a casa grátis:'
    });
    var corpo = caixa.querySelector('.ndc-corpo-modal');

    corpo.appendChild(el('div', { class: 'selecao', estilo: 'margin-top:10px' },
      opcoes.map(function (id) {
        var casa = TAB[id];
        var est = jogo.casas[id];
        return el('button', {
          class: 'opcao-prop', type: 'button',
          estilo: 'border-left-color:' + corDaCasa(casa),
          onclick: function () {
            jogo.construir(id, true);
            UI.fecharModal(true);
            repintar();
            faseAcoes();
          }
        }, [el('div', { class: 'txt' }, [
          el('b', { texto: casa.curto }),
          el('small', { texto: est.casas ? est.casas + ' casa(s) hoje' : 'sem construção' })
        ])]);
      })
    ));
  }

  /* =====================================================================
     FASE DE AÇÕES + PASSAR A VEZ
     ===================================================================== */
  function faseAcoes() {
    if (jogo.fase === 'fim') return;
    if (jogo.divida) { modalLevantarDinheiro(); return; }

    jogo.fase = 'acoes';
    repintar();

    var dupla = jogo.lance && jogo.lance.dupla && CFG.DUPLA_JOGA_DE_NOVO &&
                jogo.duplasSeguidas < CFG.MAX_DUPLAS_SEGUIDAS;

    UI.barraAcoes({
      principal: {
        texto: dupla ? '🎲 Tirou dupla — jogar de novo' : 'Passar a vez ➜',
        classe: dupla ? 'btn-ouro' : 'btn-primario',
        onClick: passarVez
      },
      secundariasAtivas: true
    });
  }

  function passarVez() {
    if (jogo.divida) { modalLevantarDinheiro(); return; }
    var r = jogo.passarVez();
    if (jogo.fase === 'fim') return;
    UI.zerarDados();
    abrirTurno(!r.mesmoJogador);
  }

  /* =====================================================================
     LEVANTAR DINHEIRO / FALÊNCIA
     ===================================================================== */
  function modalLevantarDinheiro() {
    var d = jogo.divida;
    if (!d) { faseAcoes(); return; }

    var j = jogo.jogadores[d.devedor];
    var caixa = UI.modal({
      titulo: '💸 Você precisa de dinheiro',
      cor: 'var(--ndc-perigo)',
      fechavel: false,
      corpo: el('div')
    });
    var corpo = caixa.querySelector('.ndc-corpo-modal');
    var pe = caixa.querySelector('.ndc-acoes-modal');
    if (!pe) { pe = el('div', { class: 'acoes-modal' }); caixa.appendChild(pe); }

    function desenhar() {
      UI.limpar(corpo);
      UI.limpar(pe);

      var falta = Math.max(0, d.valor - j.dinheiro);
      var liquidez = jogo.liquidez(j.id);
      var semSaida = liquidez < d.valor;

      corpo.appendChild(el('div', { html:
        '<p>Dívida: <strong>' + NDC.dinheiro(d.valor) + '</strong> — ' + textoSeguro(d.motivo) + '.</p>' +
        '<p>Seu caixa: <strong>' + NDC.dinheiro(j.dinheiro) + '</strong>' +
        (falta ? ' — faltam <strong style="color:var(--ndc-perigo)">' + NDC.dinheiro(falta) + '</strong>' : '') + '</p>'
      }));

      if (semSaida) {
        corpo.appendChild(el('div', { class: 'alerta', texto:
          'Mesmo vendendo tudo e hipotecando tudo você só levanta ' + NDC.dinheiro(liquidez) + '. Não tem como pagar.' }));
      } else {
        corpo.appendChild(el('div', { class: 'sub', texto:
          'Venda construções e hipoteque propriedades até fechar a conta. Vendendo tudo você chega a ' + NDC.dinheiro(liquidez) + '.' }));
      }

      var bens = jogo.bensDe(j.id);
      if (bens.length) {
        corpo.appendChild(el('div', { class: 'selecao', estilo: 'margin-top:10px' },
          bens.map(function (c) { return linhaLevantar(c, desenhar, j); })));
      }

      if (!semSaida) {
        pe.appendChild(el('button', {
          class: 'btn btn-primario', type: 'button',
          texto: j.dinheiro >= d.valor ? 'Pagar ' + NDC.dinheiro(d.valor) : 'Ainda falta ' + NDC.dinheiro(falta),
          disabled: j.dinheiro < d.valor ? 'disabled' : null,
          onclick: function () {
            var r = jogo.quitarDivida();
            if (r.ok) { UI.fecharModal(true); repintar(); faseAcoes(); }
          }
        }));
      }

      pe.appendChild(el('button', {
        class: 'btn btn-perigo', type: 'button', texto: 'Declarar falência e sair',
        onclick: confirmarFalencia
      }));
    }

    function confirmarFalencia() {
      UI.modal({
        titulo: 'Declarar falência?',
        cor: 'var(--ndc-perigo)',
        corpo: '<p>Você entrega o que tem em caixa para o credor, todas as suas propriedades voltam para o banco (limpas, sem casas e sem hipoteca) e você <strong>sai da partida</strong>.</p>',
        acoes: [
          { texto: 'Voltar', classe: 'btn-fantasma', onClick: modalLevantarDinheiro },
          { texto: 'Falir', classe: 'btn-perigo', onClick: function () {
              var quem = j.id;
              jogo.declararFalencia(quem);
              repintar();
              if (jogo.fase === 'fim') return;
              // se quem faliu era o da vez, a mesa segue com o próximo
              if (jogo.vez === quem) { jogo.lance = null; passarVezForcado(); }
              else faseAcoes();
            } }
        ]
      });
    }

    desenhar();
  }

  function passarVezForcado() {
    jogo.lance = null;
    jogo.duplasSeguidas = 0;
    var voltas = 0;
    do {
      jogo.vez = (jogo.vez + 1) % jogo.jogadores.length;
      if (jogo.vez === 0) jogo.rodada++;
      voltas++;
    } while (jogo.jogadores[jogo.vez].falido && voltas <= jogo.jogadores.length);
    jogo.fase = 'rolar';
    UI.zerarDados();
    repintar();
    abrirTurno(true);
  }

  function linhaLevantar(casa, redesenhar, jogador) {
    var est = jogo.casas[casa.id];
    var botoes = [];

    if (est.casas > 0 && jogo.podeVenderCasa(casa.id, jogador.id) === true) {
      botoes.push(el('button', {
        class: 'btn btn-mini', type: 'button',
        texto: '− casa +' + NDC.dinheiro(Math.round(NDC.GRUPOS[casa.grupo].custoCasa * CFG.VENDA_CASA_PCT)),
        onclick: function () { jogo.venderCasa(casa.id, jogador.id); repintar(); redesenhar(); }
      }));
    }
    if (jogo.podeHipotecar(casa.id, jogador.id) === true) {
      botoes.push(el('button', {
        class: 'btn btn-mini btn-ouro', type: 'button',
        texto: 'Hipotecar +' + NDC.dinheiro(Math.round(casa.preco * CFG.HIPOTECA_PCT)),
        onclick: function () { jogo.hipotecar(casa.id, jogador.id); repintar(); redesenhar(); }
      }));
    }

    return el('div', {
      class: 'opcao-prop', estilo: 'border-left-color:' + corDaCasa(casa)
    }, [
      el('div', { class: 'txt' }, [
        el('b', { texto: casa.curto }),
        el('small', { texto: est.hipotecada ? 'hipotecada'
          : est.casas === CFG.NIVEL_HOTEL ? 'hotel'
          : est.casas ? est.casas + ' casa(s)' : 'sem construção' })
      ])
    ].concat(botoes));
  }

  /* =====================================================================
     CONSTRUIR
     ===================================================================== */
  function modalConstruir() {
    var j = jogo.jogadorAtual();
    var caixa = UI.modal({ titulo: '🏗️ Construir', corpo: el('div') });
    var corpo = caixa.querySelector('.ndc-corpo-modal');

    function desenhar() {
      UI.limpar(corpo);
      var grupos = jogo.gruposComMonopolio(j.id);

      if (!grupos.length) {
        corpo.appendChild(el('div', { class: 'vazio', texto:
          'Para construir você precisa de todas as propriedades de um grupo de cor, sem hipoteca. Troque com a mesa para fechar um grupo!' }));
        return;
      }

      corpo.appendChild(el('div', { class: 'sub', texto:
        'Caixa: ' + NDC.dinheiro(j.dinheiro) +
        (CFG.CONSTRUCAO_UNIFORME ? ' • construa por igual dentro do grupo' : '') }));

      grupos.forEach(function (g) {
        corpo.appendChild(el('div', {
          class: 'rotulo',
          estilo: 'display:block;margin:12px 0 6px;color:' + NDC.GRUPOS[g].cor,
          texto: NDC.GRUPOS[g].nome + ' • casa ' + NDC.dinheiro(NDC.GRUPOS[g].custoCasa)
        }));

        var linhas = jogo.casasDoGrupo(g).map(function (casa) {
          var est = jogo.casas[casa.id];
          var podeMais = jogo.podeConstruir(casa.id, j.id, false);
          var podeMenos = jogo.podeVenderCasa(casa.id, j.id);

          return el('div', { class: 'opcao-prop', estilo: 'border-left-color:' + NDC.GRUPOS[g].cor }, [
            el('div', { class: 'txt' }, [
              el('b', { texto: casa.curto }),
              el('small', { texto: (est.casas === CFG.NIVEL_HOTEL ? '🏨 hotel'
                : est.casas ? '🏠'.repeat(est.casas) : 'terreno vazio') +
                ' • aluguel ' + NDC.dinheiro(jogo.aluguel(casa.id, 7)) })
            ]),
            el('button', {
              class: 'btn btn-mini', type: 'button', texto: '−',
              disabled: podeMenos === true ? null : 'disabled',
              title: podeMenos === true ? 'Vender construção' : podeMenos,
              onclick: function () { jogo.venderCasa(casa.id, j.id); repintar(); desenhar(); }
            }),
            el('button', {
              class: 'btn btn-mini btn-primario', type: 'button', texto: '+',
              disabled: podeMais === true ? null : 'disabled',
              title: podeMais === true ? 'Construir' : podeMais,
              onclick: function () { jogo.construir(casa.id, false); repintar(); desenhar(); }
            })
          ]);
        });

        corpo.appendChild(el('div', { class: 'selecao', estilo: 'max-height:none' }, linhas));
      });
    }

    desenhar();
  }

  /* =====================================================================
     HIPOTECAS
     ===================================================================== */
  function modalHipotecas() {
    var j = jogo.jogadorAtual();
    var caixa = UI.modal({ titulo: '🏦 Hipotecas', corpo: el('div') });
    var corpo = caixa.querySelector('.ndc-corpo-modal');

    function desenhar() {
      UI.limpar(corpo);
      var bens = jogo.bensDe(j.id);
      if (!bens.length) {
        corpo.appendChild(el('div', { class: 'vazio', texto: 'Você ainda não tem propriedades.' }));
        return;
      }

      corpo.appendChild(el('div', { class: 'sub', texto:
        'Hipotecar rende metade do preço na hora. Para desfazer, paga a hipoteca + ' +
        (CFG.JUROS_DESHIPOTECA * 100) + '% de juros. Propriedade hipotecada não cobra aluguel.' }));

      corpo.appendChild(el('div', { class: 'selecao', estilo: 'max-height:none;margin-top:10px' },
        bens.map(function (casa) {
          var est = jogo.casas[casa.id];
          var acao;

          if (est.hipotecada) {
            var podeQuitar = jogo.podeDeshipotecar(casa.id, j.id);
            acao = el('button', {
              class: 'btn btn-mini btn-primario', type: 'button',
              texto: 'Quitar ' + NDC.dinheiro(jogo.custoDeshipoteca(casa.id)),
              disabled: podeQuitar === true ? null : 'disabled',
              title: podeQuitar === true ? '' : podeQuitar,
              onclick: function () { jogo.deshipotecar(casa.id, j.id); repintar(); desenhar(); }
            });
          } else {
            var podeHip = jogo.podeHipotecar(casa.id, j.id);
            acao = el('button', {
              class: 'btn btn-mini btn-ouro', type: 'button',
              texto: '+' + NDC.dinheiro(Math.round(casa.preco * CFG.HIPOTECA_PCT)),
              disabled: podeHip === true ? null : 'disabled',
              title: podeHip === true ? 'Hipotecar' : podeHip,
              onclick: function () { jogo.hipotecar(casa.id, j.id); repintar(); desenhar(); }
            });
          }

          return el('div', { class: 'opcao-prop', estilo: 'border-left-color:' + corDaCasa(casa) }, [
            el('div', { class: 'txt' }, [
              el('b', { texto: casa.curto }),
              el('small', { texto: est.hipotecada ? 'hipotecada'
                : est.casas ? 'tem construção — venda antes' : 'livre' })
            ]),
            acao
          ]);
        })
      ));
    }

    desenhar();
  }

  /* =====================================================================
     TROCA
     ===================================================================== */
  function modalTroca() {
    var eu = jogo.jogadorAtual();
    var outros = jogo.adversarios(eu.id);
    if (!outros.length) return;

    var alvo = outros[0];
    var ofereco = [];   // ids de casa
    var peco = [];
    var dinOfereco = 0, dinPeco = 0;

    var caixa = UI.modal({ titulo: '🤝 Propor troca', corpo: el('div') });
    var corpo = caixa.querySelector('.ndc-corpo-modal');
    var pe = caixa.querySelector('.ndc-acoes-modal') || (function () {
      var n = el('div', { class: 'acoes-modal' }); caixa.appendChild(n); return n;
    })();

    function trocavel(casaId) { return jogo.casas[casaId].casas === 0; }

    function listaProps(dono, selecionados) {
      var bens = jogo.bensDe(dono.id);
      if (!bens.length) return el('div', { class: 'sub', texto: 'sem propriedades' });

      return el('div', { class: 'selecao' }, bens.map(function (casa) {
        var ok = trocavel(casa.id);
        var marcada = selecionados.indexOf(casa.id) !== -1;
        return el('button', {
          class: 'opcao-prop' + (marcada ? ' marcada' : ''),
          type: 'button',
          disabled: ok ? null : 'disabled',
          estilo: 'border-left-color:' + corDaCasa(casa),
          onclick: function () {
            var i = selecionados.indexOf(casa.id);
            if (i === -1) selecionados.push(casa.id); else selecionados.splice(i, 1);
            desenhar();
          }
        }, [
          el('div', { class: 'txt' }, [
            el('b', { texto: (marcada ? '✓ ' : '') + casa.curto }),
            el('small', { texto: jogo.casas[casa.id].hipotecada ? 'hipotecada'
              : ok ? NDC.dinheiro(casa.preco) : 'tem construção' })
          ])
        ]);
      }));
    }

    function desenhar() {
      UI.limpar(corpo);
      UI.limpar(pe);

      // 1. com quem
      corpo.appendChild(el('span', { class: 'rotulo', estilo: 'display:block;margin-bottom:6px', texto: 'Trocar com' }));
      corpo.appendChild(el('div', { estilo: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px' },
        outros.map(function (o) {
          return el('button', {
            class: 'btn btn-mini' + (o.id === alvo.id ? ' btn-primario' : ''),
            type: 'button', texto: o.nome,
            onclick: function () { alvo = o; peco = []; dinPeco = 0; desenhar(); }
          });
        })
      ));

      // 2. o que eu ofereço
      corpo.appendChild(el('span', { class: 'rotulo', estilo: 'display:block;margin-bottom:6px',
        texto: 'Você oferece' }));
      corpo.appendChild(listaProps(eu, ofereco));
      corpo.appendChild(campoDinheiro('Dinheiro seu (máx. ' + NDC.dinheiro(eu.dinheiro) + ')', dinOfereco, eu.dinheiro,
        function (v) { dinOfereco = v; atualizarBotao(); }));

      // 3. o que eu peço
      corpo.appendChild(el('span', { class: 'rotulo', estilo: 'display:block;margin:14px 0 6px',
        texto: 'Você pede de ' + alvo.nome }));
      corpo.appendChild(listaProps(alvo, peco));
      corpo.appendChild(campoDinheiro('Dinheiro de ' + alvo.nome + ' (máx. ' + NDC.dinheiro(alvo.dinheiro) + ')',
        dinPeco, alvo.dinheiro, function (v) { dinPeco = v; atualizarBotao(); }));

      var btn = el('button', {
        class: 'btn btn-primario', type: 'button', texto: 'Propor para ' + alvo.nome,
        onclick: function () { propor(); }
      });
      pe.appendChild(btn);
      pe.appendChild(el('button', { class: 'btn btn-fantasma', type: 'button', texto: 'Cancelar',
        onclick: function () { UI.fecharModal(true); } }));

      function atualizarBotao() {
        var t = montar();
        var v = jogo.validarTroca(t);
        btn.disabled = v !== true;
        btn.textContent = v === true ? 'Propor para ' + alvo.nome : v;
      }
      atualizarBotao();
    }

    function montar() {
      return {
        de: eu.id, para: alvo.id,
        casasDe: ofereco.slice(), casasPara: peco.slice(),
        dinheiroDe: dinOfereco, dinheiroPara: dinPeco
      };
    }

    function propor() {
      var t = montar();
      if (jogo.validarTroca(t) !== true) return;

      var resumo = '<p><strong>' + textoSeguro(eu.nome) + '</strong> oferece: ' +
        (t.casasDe.map(function (id) { return TAB[id].curto; }).join(', ') || '—') +
        (t.dinheiroDe ? ' + ' + NDC.dinheiro(t.dinheiroDe) : '') + '</p>' +
        '<p><strong>' + textoSeguro(alvo.nome) + '</strong> entrega: ' +
        (t.casasPara.map(function (id) { return TAB[id].curto; }).join(', ') || '—') +
        (t.dinheiroPara ? ' + ' + NDC.dinheiro(t.dinheiroPara) : '') + '</p>' +
        '<div class="ndc-aviso-ok">Passe o aparelho para ' + textoSeguro(alvo.nome) + ' decidir.</div>';

      UI.modal({
        titulo: alvo.nome + ', topa?',
        cor: alvo.cor,
        fechavel: false,
        corpo: resumo,
        acoes: [
          { texto: 'Recusar', classe: 'btn-fantasma', onClick: function () {
              jogo.log(alvo.nome + ' recusou a troca.', 'info');
            } },
          { texto: 'Aceitar', classe: 'btn-primario', onClick: function () {
              jogo.executarTroca(t);
              repintar();
            } }
        ]
      });
    }

    function campoDinheiro(rotulo, valor, max, aoMudar) {
      var input = el('input', {
        class: 'campo-num', type: 'number', min: '0', max: String(max), step: '10',
        value: String(valor), 'aria-label': rotulo
      });
      input.addEventListener('input', function () {
        var v = Math.max(0, Math.min(max, parseInt(input.value, 10) || 0));
        aoMudar(v);
      });
      return el('div', { estilo: 'margin-top:8px' }, [
        el('div', { class: 'sub', estilo: 'margin-bottom:4px', texto: rotulo }),
        input
      ]);
    }

    desenhar();
  }

  /* =====================================================================
     MENU "MAIS"
     ===================================================================== */
  function modalMais() {
    var caixa = UI.modal({ titulo: 'Mais opções', corpo: el('div') });
    var corpo = caixa.querySelector('.ndc-corpo-modal');

    function opcao(texto, sub, aoClicar, classe) {
      var n = el('button', {
        class: 'btn ' + (classe || ''), type: 'button',
        estilo: 'width:100%;justify-content:flex-start;text-align:left;margin-bottom:8px;flex-direction:column;align-items:flex-start;gap:2px;padding:11px 13px',
        onclick: function () { UI.fecharModal(true); aoClicar(); }
      }, [
        el('span', { estilo: 'font-weight:700', texto: texto }),
        sub ? el('span', { estilo: 'font-size:12px;color:var(--ndc-txt3);font-weight:500', texto: sub }) : null
      ]);
      corpo.appendChild(n);
    }

    opcao(ampliado ? '🔍 Reduzir tabuleiro' : '🔍 Ampliar tabuleiro',
      ampliado ? 'Volta a caber inteiro na tela' : 'Mostra os nomes das casas (rola na tela)',
      function () {
        ampliado = !ampliado;
        var wrap = $('#ndc-tabuleiro-wrap');
        wrap.classList.toggle('ndc-ampliado', ampliado);
        requestAnimationFrame(function () {
          UI.posicionarTokens(jogo);
          // centraliza a rolagem para não abrir preso no canto
          wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
          wrap.scrollTop = (wrap.scrollHeight - wrap.clientHeight) / 2;
        });
      });

    opcao('👥 Modo passa-o-aparelho: ' + (modoPassaAparelho ? 'ligado' : 'desligado'),
      'Mostra de quem é a vez em tela cheia antes de cada turno',
      function () { modoPassaAparelho = !modoPassaAparelho; });

    opcao('📖 Regras rápidas', 'Um resumo do que vale nesta versão', modalRegras);

    opcao('🏁 Encerrar agora', 'Vence quem tiver o maior patrimônio', function () {
      UI.modal({
        titulo: 'Encerrar a partida?',
        corpo: '<p>A partida acaba aqui e vence quem tiver o maior patrimônio (dinheiro + propriedades + construções).</p>',
        acoes: [
          { texto: 'Voltar', classe: 'btn-fantasma' },
          { texto: 'Encerrar', classe: 'btn-ouro', onClick: function () { jogo.encerrarPorPatrimonio(); } }
        ]
      });
    }, 'btn-fantasma');

    opcao('🔄 Nova partida', 'Descarta esta e volta para a tela inicial', function () {
      UI.modal({
        titulo: 'Começar de novo?',
        corpo: '<p>Tudo desta partida será perdido.</p>',
        acoes: [
          { texto: 'Voltar', classe: 'btn-fantasma' },
          { texto: 'Nova partida', classe: 'btn-perigo', onClick: function () { UI.mostrarTela('tela-setup'); } }
        ]
      });
    }, 'btn-fantasma');
  }

  function modalRegras() {
    UI.modal({
      titulo: '📖 Regras rápidas',
      corpo:
        '<ul style="padding-left:18px;line-height:1.7;margin:0">' +
        '<li>Começa com <strong>' + NDC.dinheiro(CFG.DINHEIRO_INICIAL) + '</strong>.</li>' +
        '<li>Passou ou caiu na Partida: <strong>' + NDC.dinheiro(CFG.SALARIO_PARTIDA) + '</strong>.</li>' +
        '<li>Terreno sem dono: <strong>compra ou passa</strong>. Sem leilão.</li>' +
        '<li>Grupo de cor completo dobra o aluguel do terreno vazio e libera construir.</li>' +
        '<li>Casas custam o valor fixo do grupo. Máximo 4 casas + 1 hotel.</li>' +
        (CFG.CONSTRUCAO_UNIFORME ? '<li>Construção uniforme: dentro do grupo a diferença de casas nunca passa de 1.</li>' : '') +
        '<li>Hipoteca = metade do preço. Quitar custa +' + (CFG.JUROS_DESHIPOTECA * 100) + '%. Hipotecada não cobra aluguel.</li>' +
        '<li>Troca: propriedades + dinheiro, dos dois lados. Não dá para trocar propriedade com construção.</li>' +
        '<li>Tirou dupla joga de novo (até ' + CFG.MAX_DUPLAS_SEGUIDAS + ' vezes seguidas).</li>' +
        '<li>Delegacia é <strong>só visita</strong> nesta versão.</li>' +
        '<li>Faliu: entrega o caixa ao credor, as propriedades voltam limpas para o banco e você sai.</li>' +
        '<li>Vence o último de pé — ou o maior patrimônio se a mesa encerrar antes.</li>' +
        '</ul>',
      acoes: [{ texto: 'Entendi', classe: 'btn-primario' }]
    });
  }

  /* =====================================================================
     Utilidades
     ===================================================================== */
  function corDaCasa(casa) {
    if (casa.grupo) return NDC.GRUPOS[casa.grupo].cor;
    if (casa.tipo === 'estacao') return NDC.GRUPOS.estacao.cor;
    if (casa.tipo === 'utilidade') return NDC.GRUPOS.utilidade.cor;
    return 'var(--ndc-linha)';
  }

  function textoSeguro(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     5. API DO HUB — preparar / comecar / parar
     ═══════════════════════════════════════════════════════════════ */

  /* Markup das três telas. No protótipo standalone isto morava no
     index.html próprio do jogo; aqui é montado dentro de
     #negocios-root pra não sujar o index.html do app. */
  function _markup() {
    return '' +
    '<section id="ndc-tela-setup" class="ndc-tela ndc-ativa">' +
      '<div class="ndc-marca">' +
        '<span class="ndc-selo">Jogos da Coruja</span>' +
        '<h1>Negócios da Cidade</h1>' +
        '<p>Compre a cidade inteira. Passe o aparelho. Quebre os amigos.</p>' +
      '</div>' +
      '<div class="ndc-bloco-setup">' +
        '<span class="ndc-rotulo">Quantos vão jogar?</span>' +
        '<div class="ndc-contador">' +
          '<button type="button" id="ndc-qtd-menos" aria-label="Menos jogadores">−</button>' +
          '<div class="ndc-valor"><span id="ndc-qtd-valor">4</span><small>jogadores</small></div>' +
          '<button type="button" id="ndc-qtd-mais" aria-label="Mais jogadores">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="ndc-bloco-setup">' +
        '<span class="ndc-rotulo">Quem é quem</span>' +
        '<div class="ndc-lista-jogadores" id="ndc-lista-jogadores"></div>' +
      '</div>' +
      '<button type="button" class="ndc-btn ndc-btn-primario ndc-btn-bloco" id="ndc-btn-comecar" ' +
        'style="min-height:56px;font-size:17px">Começar partida</button>' +
      '<details class="ndc-regras">' +
        '<summary>Como se joga (resumo)</summary>' +
        '<ul>' +
          '<li>Cada um começa com <strong>R$ 2.500</strong> e anda com 2 dados.</li>' +
          '<li>Caiu em terreno sem dono: <strong>compra ou passa</strong>. Não tem leilão.</li>' +
          '<li>Caiu em terreno dos outros: <strong>paga aluguel</strong>. Hipotecado não cobra.</li>' +
          '<li>Terreno vazio com o <strong>grupo de cor completo</strong> cobra aluguel em dobro.</li>' +
          '<li>Com o grupo completo dá para <strong>construir</strong>: até 4 casas e depois o hotel.</li>' +
          '<li><strong>Tirou dupla, joga de novo</strong> (no máximo 3 vezes seguidas).</li>' +
          '<li>Passou pela Partida, recebe <strong>R$ 200</strong>.</li>' +
          '<li>Não conseguiu pagar nem vendendo e hipotecando tudo? <strong>Faliu</strong> e sai do jogo.</li>' +
          '<li>A Delegacia por enquanto é <strong>só visita</strong> — ninguém fica preso.</li>' +
        '</ul>' +
      '</details>' +
    '</section>' +

    '<section id="ndc-tela-jogo" class="ndc-tela">' +
      '<header class="ndc-faixa-vez" id="ndc-faixa-vez">' +
        '<div class="ndc-peca-vez" id="ndc-peca-vez">?</div>' +
        '<div class="ndc-quem">' +
          '<span class="ndc-rotulo" id="ndc-rotulo-vez">Vez de</span>' +
          '<b id="ndc-nome-vez">—</b>' +
        '</div>' +
        '<div class="ndc-caixa">' +
          '<span class="ndc-rotulo">Caixa</span>' +
          '<div class="ndc-grana" id="ndc-caixa-vez">R$ 0</div>' +
        '</div>' +
        // Só existe (visualmente) em landscape — ver seção 15 do CSS, onde
        // ele vai morar na lateral direita. Em pé fica display:none: o
        // painel já é uma faixa normal ali embaixo, não precisa de botão.
        '<button type="button" class="ndc-btn-painel" id="ndc-btn-painel" ' +
          'aria-label="Jogadores e bens" aria-expanded="false">' +
          '<span class="ndc-ico">👥</span><span class="ndc-rot">Jogadores</span>' +
        '</button>' +
      '</header>' +

      '<main class="ndc-arena">' +
        '<div class="ndc-col-tabuleiro">' +
          '<div class="ndc-tabuleiro-wrap" id="ndc-tabuleiro-wrap">' +
            '<div class="ndc-tabuleiro" id="ndc-tabuleiro">' +
              '<div class="ndc-centro" id="ndc-centro">' +
                '<div class="ndc-titulo-centro" id="ndc-titulo-centro">Negócios da <b>Cidade</b></div>' +
                '<div class="ndc-dados">' +
                  '<div class="ndc-dado" id="ndc-dado1"></div>' +
                  '<div class="ndc-dado" id="ndc-dado2"></div>' +
                '</div>' +
                '<div class="ndc-resultado" id="ndc-resultado-dados"></div>' +
                '<div class="ndc-msg" id="ndc-msg-centro">Toque em “Rolar dados” para começar.</div>' +
              '</div>' +
              // Overlay da coruja: ocupa o mesmo miolo do tabuleiro que o
              // centro. O src entra no _montar() para o caminho morar só
              // em NDC.CONFIG.
              '<div class="ndc-coruja" id="ndc-coruja" aria-hidden="true">' +
                '<video class="ndc-coruja-video" id="ndc-coruja-video" muted playsinline ' +
                  'preload="auto" disablepictureinpicture></video>' +
              '</div>' +
              '<div class="ndc-camada-tokens" id="ndc-camada-tokens"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Backdrop do painel em landscape (ver seção 15 do CSS): some fora
        // do modo deitado, então em pé é só um <div> vazio sem efeito.
        '<div class="ndc-painel-backdrop" id="ndc-painel-backdrop"></div>' +
        '<aside class="ndc-painel">' +
          // Alça (arrastar pra fechar) e X — os dois só aparecem em
          // landscape, onde o painel vira bottom-sheet. Em pé o painel é
          // uma faixa normal do fluxo e nenhum dos dois faz sentido.
          '<div class="ndc-painel-alca" id="ndc-painel-alca"><span></span></div>' +
          '<button type="button" class="ndc-painel-fechar" id="ndc-painel-fechar" ' +
            'aria-label="Fechar painel">✕</button>' +
          '<nav class="ndc-abas" role="tablist">' +
            '<button type="button" role="tab" aria-selected="true"  data-aba="jogadores">Jogadores</button>' +
            '<button type="button" role="tab" aria-selected="false" data-aba="bens">Meus bens</button>' +
            '<button type="button" role="tab" aria-selected="false" data-aba="historico">Histórico</button>' +
          '</nav>' +
          '<div class="ndc-painel-conteudo">' +
            '<div id="ndc-pane-jogadores" class="ndc-ativa"></div>' +
            '<div id="ndc-pane-bens"></div>' +
            '<div id="ndc-pane-historico"><div class="ndc-historico" id="ndc-historico"></div></div>' +
          '</div>' +
        '</aside>' +
      '</main>' +

      '<footer class="ndc-acoes">' +
        '<div class="ndc-principais">' +
          '<button type="button" class="ndc-btn ndc-btn-primario" id="ndc-btn-principal">🎲 Rolar dados</button>' +
          '<button type="button" class="ndc-btn ndc-oculto" id="ndc-btn-alternativo">Passar</button>' +
        '</div>' +
        '<div class="ndc-secundarias">' +
          '<button type="button" class="ndc-btn" id="ndc-btn-construir"><span class="ndc-ico">🏗️</span>Construir</button>' +
          '<button type="button" class="ndc-btn" id="ndc-btn-hipoteca"><span class="ndc-ico">🏦</span>Hipoteca</button>' +
          '<button type="button" class="ndc-btn" id="ndc-btn-trocar"><span class="ndc-ico">🤝</span>Trocar</button>' +
          '<button type="button" class="ndc-btn" id="ndc-btn-mais"><span class="ndc-ico">⋯</span>Mais</button>' +
        '</div>' +
      '</footer>' +
    '</section>' +

    '<section id="ndc-tela-fim" class="ndc-tela">' +
      '<div class="ndc-trofeu">🏆</div>' +
      '<h2>Fim de partida</h2>' +
      '<div class="ndc-campeao" id="ndc-campeao-nome">—</div>' +
      '<div class="ndc-ranking" id="ndc-ranking"></div>' +
      '<button type="button" class="ndc-btn ndc-btn-primario ndc-btn-bloco" id="ndc-btn-novo-jogo">Jogar de novo</button>' +
    '</section>' +

    '<div id="ndc-raiz-modal"></div>' +
    '<div class="ndc-brindes" id="ndc-brindes"></div>';
  }

  var _montado = false;
  var _aoRedimensionar = null;

  /* ── Orientação ────────────────────────────────────────────────
     O layout deitado é feito no CSS (seção 15 do negocios.css), que é
     quem manda: media query não tem FOUC nem depende de JS. Aqui só
     espelhamos o estado numa classe (útil para depurar e para quem
     quiser gancho em JS) e, o que importa de verdade, reposicionamos as
     peças: elas são colocadas em pixels absolutos e não acompanham a
     mudança de tamanho das casas sozinhas. Dois requestAnimationFrame
     porque as medidas só valem depois que o CSS novo já refluiu. */
  var _mqDeitado = null;
  var _aoGirar = null;

  function _remedirPecas() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (jogo && raiz) UI.posicionarTokens(jogo);
      });
    });
  }

  function _ligarOrientacao() {
    if (_aoGirar || !window.matchMedia) return;
    _mqDeitado = window.matchMedia('(orientation: landscape)');
    _aoGirar = function () {
      if (raiz) raiz.classList.toggle('ndc-deitado', _mqDeitado.matches);
      // Girando pra qualquer lado, o painel (que só existe como
      // bottom-sheet em landscape) começa fechado — sem isso, sair do
      // landscape com ele aberto e voltar reabriria ele sozinho.
      setPainelAberto(false);
      _remedirPecas();
    };
    if (_mqDeitado.addEventListener) _mqDeitado.addEventListener('change', _aoGirar);
    else if (_mqDeitado.addListener) _mqDeitado.addListener(_aoGirar);
    _aoGirar();
  }

  /* ── Painel em landscape (bottom-sheet) ───────────────────────────
     Em pé o painel (Jogadores/Bens/Histórico) é uma faixa normal do
     fluxo, sempre visível. Deitado ele viraria uma coluna permanente ao
     lado do tabuleiro — só que aí o tabuleiro fica pequeno e espremido
     contra ela, que era exatamente a reclamação do playtest. Agora,
     deitado, o painel fica recolhido por padrão e só sobe (como um
     bottom-sheet) quando o botão 👥 da faixa da vez é tocado.

     _painelAberto só controla a classe; quem decide como o painel SE
     COMPORTA com ela é o CSS (seção 15) — em pé a classe não muda nada
     porque lá o painel nem tem o botão pra abrir (display:none). */
  var _painelAberto = false;

  function setPainelAberto(aberto) {
    _painelAberto = !!aberto;
    if (raiz) raiz.classList.toggle('ndc-painel-aberto', _painelAberto);
    var btn = $('#ndc-btn-painel');
    if (btn) btn.setAttribute('aria-expanded', _painelAberto ? 'true' : 'false');
    // Limpa qualquer transform/transition deixado pelo arraste (ver
    // _ligarArrastarPainel) pra a transição por classe do CSS assumir.
    var painelEl = $('.ndc-painel');
    if (painelEl) { painelEl.style.transform = ''; painelEl.style.transition = ''; }
  }

  /* Arrastar a alça pra baixo fecha o painel. Pointer Events cobrem
     mouse e touch com o mesmo código; o threshold de 70px é o "soltou
     longe o bastante pra valer fechar" — abaixo disso ele volta pro
     lugar. Puramente aditivo: sem isto, tocar fora (backdrop) ou o ✕
     já fecham. */
  function _ligarArrastarPainel() {
    var alca = $('#ndc-painel-alca');
    var painelEl = $('.ndc-painel');
    if (!alca || !painelEl || alca._ndcLigado) return;
    alca._ndcLigado = true;

    var startY = 0, dy = 0, arrastando = false;

    function aoMover(e) {
      if (!arrastando) return;
      var y = e.clientY;
      dy = Math.max(0, y - startY);
      painelEl.style.transform = 'translateY(' + dy + 'px)';
    }
    function aoSoltar() {
      if (!arrastando) return;
      arrastando = false;
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);
      window.removeEventListener('pointercancel', aoSoltar);
      if (dy > 70) setPainelAberto(false);
      else { painelEl.style.transform = ''; painelEl.style.transition = ''; }
    }
    alca.addEventListener('pointerdown', function (e) {
      if (!_painelAberto) return;
      arrastando = true; startY = e.clientY; dy = 0;
      painelEl.style.transition = 'none';
      window.addEventListener('pointermove', aoMover);
      window.addEventListener('pointerup', aoSoltar);
      window.addEventListener('pointercancel', aoSoltar);
    });
  }

  /* Monta o DOM e liga os controles. Idempotente: chamado de novo,
     redesenha do zero. */
  function _montar() {
    raiz.innerHTML = _markup();
    UI.setup.montar(comecarPartida);
    UI.ligarAbas();
    UI.zerarDados();

    var vid = $('#ndc-coruja-video');
    if (vid && CFG.ANIM_CORUJA) vid.src = CFG.VIDEO_CORUJA;

    $('#ndc-btn-construir').addEventListener('click', modalConstruir);
    $('#ndc-btn-hipoteca').addEventListener('click', modalHipotecas);
    $('#ndc-btn-trocar').addEventListener('click', modalTroca);
    $('#ndc-btn-mais').addEventListener('click', modalMais);
    $('#ndc-btn-novo-jogo').addEventListener('click', function () {
      jogo = null;
      UI.mostrarTela('tela-setup');
    });

    // Painel em landscape (bottom-sheet): botão da faixa, backdrop e ✕
    // fecham/abrem; sem efeito em pé (ver comentário de setPainelAberto).
    setPainelAberto(false);
    var btnPainel = $('#ndc-btn-painel');
    if (btnPainel) btnPainel.addEventListener('click', function () { setPainelAberto(!_painelAberto); });
    var backdropPainel = $('#ndc-painel-backdrop');
    if (backdropPainel) backdropPainel.addEventListener('click', function () { setPainelAberto(false); });
    var fecharPainel = $('#ndc-painel-fechar');
    if (fecharPainel) fecharPainel.addEventListener('click', function () { setPainelAberto(false); });
    _ligarArrastarPainel();

    if (!_aoRedimensionar) {
      _aoRedimensionar = function () { if (jogo && raiz) UI.posicionarTokens(jogo); };
      window.addEventListener('resize', _aoRedimensionar);
    }
    _ligarOrientacao();
    _montado = true;
  }

  /* Volta pra partida que já estava rolando (a pessoa saiu pro menu do
     hub e voltou). Uma partida de 8 pessoas leva bem mais que 20
     minutos: perder tudo por um toque no "Voltar aos jogos" seria
     cruel, então o estado sobrevive — parar() só mata os timers. */
  function _retomar() {
    UI.mostrarTela('tela-jogo');
    UI.pararCoruja();          // saiu no meio da animação: o overlay não fica preso
    setPainelAberto(false);    // idem pro painel, se tinha ficado aberto
    UI.criarTokens(jogo);
    repintar();
    if (jogo.fase === 'fim') { UI.telaFinal(jogo); return; }
    if (jogo.divida) { modalLevantarDinheiro(); return; }
    // Se saiu no meio do movimento da peça, a posição já foi gravada no
    // motor — basta resolver a casa onde ela parou.
    if (_emAnimacao) { _emAnimacao = false; resolver(0); return; }
    if (jogo.fase === 'acoes') { faseAcoes(); return; }
    abrirTurno(false);
  }

  /* ── preparar ──────────────────────────────────────────────────
     Chamado pelo hub toda vez que o jogo é aberto (_abrirJogo). */
  function preparar() {
    raiz = document.getElementById('negocios-root');
    if (!raiz) return;
    if (!_montado || !raiz.firstChild) _montar();
    if (jogo && jogo.fase !== 'fim') { _retomar(); return; }
    jogo = null;
    UI.mostrarTela('tela-setup');
  }

  /* ── comecar ───────────────────────────────────────────────────
     Começa (ou recomeça) uma partida com os jogadores configurados.
     O hub não chama isto sozinho — quem chama é o botão "Começar
     partida" da tela de setup —, mas fica exposto pro padrão dos
     outros jogos e pra poder reiniciar de fora. */
  function comecar() {
    if (!raiz) preparar();
    if (!raiz) return;
    var defs = UI.setup.definicoes();
    comecarPartida(defs);
  }

  /* ── parar ─────────────────────────────────────────────────────
     Mata timers e fecha modal. NÃO destrói a partida: ver _retomar. */
  function parar() {
    _limparTimers();
    UI.pararCoruja();
    if (UI && UI.temModal && UI.temModal()) UI.fecharModal(true);
    _emAnimacao = false;
  }

  window.NegociosGame = {
    preparar: preparar,
    comecar: comecar,
    parar: parar,
    // usado só em depuração no console
    _debug: { get jogo() { return jogo; }, get NDC() { return NDC; } }
  };

})();
