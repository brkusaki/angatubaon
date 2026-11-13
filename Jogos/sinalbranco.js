/* ═══════════════════════════════════════════════════════════════
   SINAL BRANCO — aventura de mistério em 1ª pessoa (cenas ilustradas)
   Lazy-loaded pelo hub a partir de /Jogos/sinalbranco.min.js
   (ver JOGOS_EXTERNOS em Jogos/hub.js). Expõe window.SinalBrancoGame
   = { preparar, parar }.
   ------------------------------------------------------------
   - Bíblia do jogo (história, cenas, prompts das imagens): doc do
     projeto claude/sinal-branco-biblia.md.
   - Tudo é DOM dentro de #sinalbranco-root: um "palco" 16:9 que se
     ajusta à tela. Celular em pé: o palco gira 90° por CSS (mesma ideia
     da Corrida); o navegador cuida do toque nos elementos girados, então
     nenhum cálculo de coordenada é preciso.
   - Unidade de tamanho: 1em = 1% da largura do palco (font-size do palco
     é setado em px pelo JS). Pontos de toque em % da imagem.
   - Cenas, itens e documentos são DADOS (CENAS / ITENS / DOCS abaixo).
     As ações dos pontos são funções curtas que usam os auxiliares
     fala(), pegar(), doc(), ir(), flag().
   - Progresso no localStorage (angatuba_sinalbranco_save). Sem backend.
   - Som: síntese própria (vento, zumbido, estática), respeitando o mudo
     do hub (AngatubaSom.ativo()).
   - Atos 1 (O Muro Branco) e 2 (Subsolo Zero) jogáveis; 3 e 4 vêm depois.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var A = '/Jogos/assets/sinalbranco/';
  var SAVE = 'angatuba_sinalbranco_save';
  var TELA = 'jogo-sinalbranco';

  /* ══════════════════════════════════════════════════════════════
     ITENS
  ══════════════════════════════════════════════════════════════ */
  var ITENS = {
    multimetro: { nome: 'Multímetro', img: 'item-multimetro-v1.webp', desc: 'Multímetro. Mede tensão, corrente e continuidade.' },
    lanterna:   { nome: 'Lanterna',   img: 'item-lanterna-v1.webp',   desc: 'Lanterna de alta potência. Bateria em 70%.' },
    bilhete:    { nome: 'Bilhete',    img: 'item-bilhete-v1.webp',    desc: 'O bilhete do Pavel.', doc: 'bilhete_pavel' },
    chaves:     { nome: 'Chaves',     img: 'item-chaves-v1.webp',     desc: 'Chaves com etiqueta vermelha: GERADOR.' },
    gravador:   { nome: 'Gravador',   img: 'item-gravador-v1.webp',   desc: 'O gravador da Dra. Ingrid. Tem uma gravação.', doc: 'audio_ingrid' },
    fusivel:    { nome: 'Fusível',    img: 'item-fusivel-v1.webp',    desc: 'Fusível cerâmico de reserva, 30 A.' },
    // Ato 2
    pecabra:    { nome: 'Pé de cabra', img: 'item-pecabra-v1.webp',   desc: 'Pé de cabra de aço. Pesado e frio.' },
    valvula:    { nome: 'Válvula',    img: 'item-valvula-v1.webp',    desc: 'Válvula termiônica antiga. Ainda acende um pouco quando aquece na mão.' },
    cracha:     { nome: 'Crachá vermelho', img: 'item-cracha-vermelho-v1.webp', desc: 'Crachá de segurança de Kazuo Ren. Faixa vermelha: acesso total ao nível -1.' },
    fita:       { nome: 'Fita',       img: 'item-fita-v1.webp',       desc: 'Fita de dados com a etiqueta "K. — não apagar".', doc: 'fita_kazuo' },
    polaroid:   { nome: 'Foto',       img: 'item-polaroid-v1.webp',   desc: 'Uma foto instantânea com algo escrito no verso.', doc: 'polaroid' },
    mapa:       { nome: 'Mapa',       img: 'item-mapa-v1.webp',       desc: 'Mapa do nível -1 desenhado à mão.', doc: 'mapa_mao' },
    frasco:     { nome: 'Amostra 7',  img: 'item-frasco-v1.webp',     desc: 'Frasco com um líquido que brilha sozinho. Está morno.', doc: 'amostra' },
    cartao:     { nome: 'Cartão perfurado', img: 'item-cartao-v1.webp', desc: 'Cartão perfurado amarelado. Os furos não seguem nenhum padrão que eu conheça.' }
  };

  /* ══════════════════════════════════════════════════════════════
     DOCUMENTOS — tipo: 'papel' (datilografado), 'mao' (à mão),
     'terminal' (tela verde) ou 'audio' (gravação com legenda).
  ══════════════════════════════════════════════════════════════ */
  var DOCS = {
    avisos: { titulo: 'Quadro de avisos', tipo: 'papel', texto:
      'ESCALA DE TURNOS — SEMANA 41\n' +
      'Rádio: Kazuo / Pavel\nGerador: Pavel\nLaboratório: Mira / Ingrid\n\n' +
      'AVISO DA DIREÇÃO\n' +
      'O acesso ao Almoxarifado B fica restrito à equipe autorizada.\n' +
      'Qualquer pane de comunicação deve ser informada SOMENTE à Dra. Solberg.\n' +
      'Não comentar com o continente sobre os testes de frequência.\n\n' +
      '— escrito à mão, embaixo —\n' +
      'alguém mais está ouvindo o zumbido de noite?' },
    bilhete_pavel: { titulo: 'Bilhete do Pavel', tipo: 'mao', texto:
      'A Ingrid trancou o painel do gerador e ficou com a chave.\n' +
      'Diz que é pra ninguém "desligar a escuta".\n\n' +
      'Escuta de quê?\n\n' +
      'Se a energia cair de novo, a reserva de fusíveis está no laboratório, na bancada da esquerda.\n' +
      'Não deixa a Ingrid saber.\n\n— P.' },
    diario_ingrid: { titulo: 'Diário da Dra. Ingrid Solberg', tipo: 'mao', texto:
      '3 de outubro\nO sinal voltou às 3h12. Igual a ontem. Kazuo jura que não vem de satélite nenhum. Vem de BAIXO.\n\n' +
      '7 de outubro\nA Mira passou a noite no laboratório. Diz que as leituras não são de interferência. São de seres vivos. Todos. Ao mesmo tempo.\n\n' +
      '11 de outubro\nConsegui isolar a frequência. Ela muda quando a gente fala perto do microfone. Como se estivesse prestando atenção.\n\n' +
      '13 de outubro\nAmanhã a gente responde.\n\n' +
      '14 de outubro\nEstá tudo bem. Está tudo bem. Está tudo bem. Está tudo bem.' },
    audio_ingrid: { titulo: 'Gravação — Dra. Ingrid Solberg', tipo: 'audio', texto:
      'Registro pessoal. A equipe está... cansada. Ninguém dorme direito desde que o zumbido começou.\n\n' +
      'O consórcio quer que eu desligue tudo. Eles não entendem.\n\n' +
      'Durante milhares de anos, alguma coisa escutou este planeta em silêncio. E agora, pela primeira vez, a gente pode responder.\n\n' +
      'Se alguém ouvir isto... mantenha o gerador ligado. Ela precisa da energia pra continuar ouvindo.\n\n[estática]' },
    graf: { titulo: 'Sensor eletromagnético', tipo: 'terminal', texto:
      'ESTAÇÃO HALVORSEN — SENSOR EM-07\n' +
      '--------------------------------\n' +
      'LEITURA DE BASE ....... 0,02 µT\n\n' +
      'PICO 1  03:12  ........ 47,9 µT\n' +
      'PICO 2  03:12 (+24h) .. 48,1 µT\n' +
      'PICO 3  03:12 (+48h) .. 48,0 µT\n\n' +
      'ORIGEM ESTIMADA: PROFUNDIDADE 1.840 m\n\n' +
      '!! ALERTA: LEITURA INCOMPATÍVEL COM\n   ATIVIDADE GEOLÓGICA CONHECIDA' },
    relatorio_mira: { titulo: 'Relatório — Dra. Mira Okafor', tipo: 'papel', texto:
      'RELATÓRIO INTERNO — Dra. Mira Okafor, bióloga\nAssunto: leituras de organismos\n\n' +
      'O sinal das 3h12 não é aleatório. Comparei o padrão com os dados de migração de pinguins, krill e baleias deste mês. Bate.\n\n' +
      'Comparei com a rotina da própria equipe. Bate também: cada pico vem logo depois de alguém acordar.\n\n' +
      'Conclusão (não oficial): o sinal acompanha os seres vivos. Não só aqui. No planeta inteiro.\n\n' +
      'Não sei o que está do outro lado. Mas está contando a gente.' },
    log_radio: { titulo: 'Diário de rádio', tipo: 'mao', texto:
      '12/10 — 22h00 — contato com o continente: ok.\n\n' +
      '13/10 — 03h12 — interferência forte. Origem não identificada. —K.\n\n' +
      '13/10 — 03h40 — achei o ruído: 6,3 MHz. Não é ruído. Tem estrutura. Parece fala. —K.\n\n' +
      '14/10 — 01h00 — a Ingrid mandou deixar sintonizado em 6,3. Fase invertida pra "responder". —K.\n\n' +
      '14/10 — 03h11 — vamos descer.' },
    sinal: { titulo: '6,3 MHz — sinal decodificado', tipo: 'audio', texto:
      '...ssshhh...\n\n...doze... doze...\n\n...treze...\n\n...você chegou...\n\n' +
      '...nós ouvimos você descer do céu...\n\n...desça mais...\n\n' +
      '[o sinal se repete, agora com a voz de uma mulher]' }
  };
  // Ato 2
  DOCS.planta = { titulo: 'Planta oficial — nível -1', tipo: 'papel', texto:
    'ESTAÇÃO HALVORSEN — NÍVEL -1 (SUBSOLO TÉCNICO)\n\n' +
    'Almoxarifado A ........ peças e combustível\n' +
    'Almoxarifado B ........ suprimentos de frio\n\n' +
    'Parede norte do Almoxarifado B: rocha. Sem acesso.\n' +
    'Elevadores registrados: NENHUM.\n\n' +
    '— alguém riscou "SEM ACESSO" e escreveu por cima, a lápis: —\n' +
    'desce 640 metros' };
  DOCS.emails = { titulo: 'Terminal de Kazuo Ren — e-mails', tipo: 'terminal', texto:
    'DE: k.ren  PARA: p.drozd\nASSUNTO: caixa do corredor de serviço\n' +
    '----------------------------------------\n' +
    'Pavel, refiz a caixa de junção depois do curto. Se cair de novo, a ordem dos fios é:\n\n' +
    '   VERMELHO -> ○      AZUL   -> ✕\n   AMARELO  -> □      BRANCO -> △\n\n' +
    'E deixa a porta de segurança FECHADA. Larguei meu crachá vermelho na gaveta da mesa do arquivo. Não quero ele comigo.\n\n' +
    '========================================\n' +
    'DE: i.solberg  PARA: equipe\nASSUNTO: descida\n' +
    '----------------------------------------\n' +
    'Amanhã, 03h11, todos no nível -1.\nNão tragam nada.\nEla já sabe quem somos.' };
  DOCS.fita_kazuo = { titulo: 'Fita — Kazuo Ren', tipo: 'audio', texto:
    'Registro, Kazuo Ren. O cabo preto não é nosso. A gente achou ele já plugado no rack 9, descendo pelo chão.\n\n' +
    'Puxei a ponta pra ver. Estava morna. Morna, debaixo de 600 metros de gelo.\n\n' +
    'Os servidores não guardam nada. Eles traduzem. A Ingrid chama de "o Coro".\n\n' +
    'Se alguém achar isto: não abram a porta de pedra sem a Mira. Ela é a única que entende a estrela.\n\n[fim da fita]' };
  DOCS.polaroid = { titulo: 'Foto — verso', tipo: 'mao', texto:
    'Na frente: a equipe toda no refeitório, sorrindo, dia 1.\n\n' +
    'No verso, à mão:\n"Halvorsen — 12 pessoas."\n\n' +
    'Embaixo, com outra letra, mais tremida:\n"13. Contei de novo. São 13."' };
  DOCS.mapa_mao = { titulo: 'Mapa do nível -1 (à mão)', tipo: 'mao', texto:
    'ELEVADOR → corredor de serviço\n' +
    '   ← servidores        arquivo →\n' +
    '   no fundo: porta de segurança (crachá VERMELHO)\n' +
    '   → laboratório da Mira → TÚNEL → "a porta"\n\n' +
    'Nota no canto: "a energia do túnel vem de uma caixa velha. Ela come válvulas."' };
  DOCS.amostra = { titulo: 'Etiqueta — Amostra 7', tipo: 'papel', texto:
    'AMOSTRA 7 — coletada no tanque principal\n\n' +
    'Luminescência sem fonte de energia.\n' +
    'Temperatura estável: 37,0 °C.\n' +
    'Igual à temperatura do corpo humano.\n\n' +
    '— M. Okafor' };
  DOCS.quadro_mira = { titulo: 'Quadro do laboratório', tipo: 'mao', texto:
    'ORDEM DE ATIVAÇÃO (não apagar!)\n\n' +
    'A estrela não se desenha em volta.\nEla PULA.\n\n' +
    'Comece na ponta de CIMA.\nVá de TRÊS em TRÊS.\nSete traços e você volta ao começo.\n\n' +
    'Se errar, ela apaga tudo. — M.' };
  DOCS.terminal_antigo = { titulo: 'Console de pedra', tipo: 'terminal', texto:
    '> CARTÃO LIDO\n> IDIOMA: ???  (tradução parcial de K. Ren)\n\n' +
    'CONTAGEM ............ 8.112.406.218\n' +
    'CONTAGEM ............ 8.112.406.219\n' +
    'CONTAGEM ............ 8.112.406.221\n\n' +
    'ESCUTA .............. CONTÍNUA\n' +
    'NOVOS OUVINTES ...... 13\n\n' +
    '> ESTAÇÃO DE RESPOSTA: ABERTA\n> AGUARDANDO O DÉCIMO QUARTO' };
  var DOCS_ATO = {
    1: ['avisos', 'bilhete_pavel', 'diario_ingrid', 'audio_ingrid', 'graf', 'relatorio_mira', 'log_radio', 'sinal'],
    2: ['planta', 'emails', 'fita_kazuo', 'polaroid', 'mapa_mao', 'amostra', 'quadro_mira', 'terminal_antigo'],
    3: ['caderneta_radio', 'notas_traducao', 'nota_ondas', 'inscricao', 'relatorio_selo', 'ficha_teo', 'audio_ingrid_final']
  };
  function docsAte(n) { var l = []; for (var i = 1; i <= n; i++) l = l.concat(DOCS_ATO[i] || []); return l; }

  /* ══════════════════════════════════════════════════════════════
     CENAS — pontos em % da imagem { x, y, w, h }.
     saidas: lado 'esq' | 'dir' | 'baixo' | 'cima' (seta na borda).
     Uma porta que dá pra outra cena é um ponto com acao: ir(...).
  ══════════════════════════════════════════════════════════════ */
  var CENAS = {
    // Abertura: dentro do helicóptero, a caminho da estação. Termina na ordem de serviço.
    voo: {
      nome: 'Helicóptero', img: 'helicoptero-v1.webp', fora: true,
      chegada: ['Meu nome é Téo Marin. Eu conserto sinais.',
        'Um serviço simples, segundo o Consórcio Polar: a Estação Halvorsen parou de transmitir. Valor fechado e uma cláusula de sigilo que li duas vezes.',
        '"Halvorsen à vista", o piloto avisou pelo intercomunicador, sem tirar os olhos do branco. "Aquela luz vermelha na antena é a base."',
        'Uma luz vermelha piscando no meio de um deserto de gelo. Não é o tipo de sinal que eu gosto de ver.',
        '"Não posso esperar, o tempo fecha rápido aqui. Volto em três dias, se deixar."',
        'Peguei a pasta com a ordem de serviço no banco ao lado. Li de novo, só pra ter o que fazer com as mãos.'],
      aoChegar: function () { abrirContrato(function () { flag('intro'); ir('heliponto'); }); },
      pontos: []
    },
    heliponto: {
      nome: 'Heliponto', img: 'heliponto-v1.webp', neve: true, fora: true,
      chegada: ['O helicóptero já estava subindo antes de eu fechar a porta.',
        'Ficou só o vento, e o barulho dele sumindo no branco.',
        'Estação Halvorsen. Doze pesquisadores, segundo o contrato. Nenhum veio me receber.',
        '"Eu fui levada", minha mãe repetia à mesa, todo domingo. Ninguém dava bola. Eu também não.',
        '{confuso}Faz anos que eu não pensava nisso. Deve ser o frio.'],
      pontos: [
        { id: 'placa', x: 4, y: 17, w: 21, h: 26, acao: function () {
          fala(['ESTAÇÃO HALVORSEN — Consórcio Polar Internacional.', 'O gelo cobriu metade das letras. Ninguém limpa essa placa há semanas.']); } },
        { id: 'antena', x: 58, y: 2, w: 9, h: 24, acao: function () {
          fala(['A luz da antena pisca em vermelho. Vermelho é falha.', 'Pelo menos alguma coisa aqui tem energia. Bateria de reserva, talvez.']); } },
        { id: 'mala', x: 73, y: 69, w: 26, h: 26, acao: function () {
          if (!tem('multimetro')) pegar('multimetro', ['Minha mala de ferramentas. Quase esqueci na neve.', 'Peguei o multímetro. Se o problema é de transmissão, vou precisar dele.']);
          else fala(['O resto das ferramentas fica na mala. Pesada demais pra carregar.']); } },
        { id: 'porta', x: 46, y: 44, w: 9, h: 19, porta: true, acao: function () { ir('entrada'); } }
      ]
    },
    entrada: {
      nome: 'Entrada', img: 'entrada-v1.webp', pisca: true,
      chegada: ['Aqui dentro está quase tão frio quanto lá fora.', 'A porta interna estava aberta. Com esse vento, isso não faz sentido.'],
      saidas: [{ lado: 'baixo', para: 'heliponto', rotulo: 'Heliponto' }],
      pontos: [
        { id: 'armario', x: 3, y: 12, w: 29, h: 72, acao: function () {
          if (!tem('lanterna')) pegar('lanterna', ['Uma lanterna na prateleira, ainda com bateria.', 'Isso vai ser útil.']);
          else fala(['Os casacos de frio estão todos aqui.', 'Se a equipe saiu da base... saiu sem casaco.']); } },
        { id: 'quadro', x: 74, y: 13, w: 20, h: 47, acao: function () { doc('avisos'); } },
        { id: 'pegadas', x: 42, y: 76, w: 20, h: 22, acao: function () {
          fala(['Pegadas molhadas. Indo pra dentro.', '{tenso}Não são minhas. Eu ainda nem tinha entrado.']); } },
        { id: 'porta', x: 41, y: 24, w: 18, h: 50, porta: true, acao: function () { ir('refeitorio'); } }
      ]
    },
    refeitorio: {
      nome: 'Refeitório', img: 'refeitorio-v1.webp',
      chegada: ['O refeitório.', 'Comida nos pratos. Café nas canecas. Cadeiras afastadas, como se todo mundo tivesse levantado na mesma hora.'],
      saidas: [
        { lado: 'esq', para: 'corredor', rotulo: 'Alojamentos' },
        { lado: 'dir', para: 'lab', rotulo: 'Laboratório' },
        { lado: 'baixo', para: 'entrada', rotulo: 'Entrada' }
      ],
      pontos: [
        { id: 'pratos', x: 32, y: 44, w: 28, h: 14, acao: function () {
          fala(['O café congelou dentro da caneca.', 'Seja o que for que aconteceu, foi no meio do jantar.']); } },
        { id: 'calendario', x: 1, y: 12, w: 13, h: 22, acao: function () {
          flag('dia14'); fala(['Um calendário com os dias riscados até o dia 14 de outubro.', 'Depois do 14, mais nada.']); } },
        { id: 'bilhete', x: 71, y: 62, w: 17, h: 16, se: function () { return !tem('bilhete'); }, acao: function () {
          pegar('bilhete', ['Um bilhete dobrado, largado na cadeira.'], 'bilhete_pavel'); } },
        { id: 'janelas', x: 45, y: 12, w: 54, h: 28, acao: function () {
          fala(['A nevasca não para. Nem de dia, nem de noite.']); } }
      ]
    },
    corredor: {
      nome: 'Alojamentos', img: 'corredor-v1.webp',
      chegada: ['O corredor dos alojamentos.', 'Só uma lâmpada funcionando. E uma porta aberta.'],
      saidas: [{ lado: 'baixo', para: 'refeitorio', rotulo: 'Refeitório' }],
      pontos: [
        { id: 'simbolo', x: 8, y: 24, w: 17, h: 40, acao: function () {
          flag('simbolo');
          fala(['Alguém riscou isso na parede. Com força, até arrancar a tinta.', '{tenso}Uma estrela de sete pontas.']); } },
        { id: 'quadro', x: 54, y: 74, w: 18, h: 16, acao: function () {
          fala(['Um quadro caído. O vidro quebrou bem no meio.', 'Alguém passou correndo por aqui e nem parou pra juntar.']); } },
        { id: 'quarto', x: 61, y: 28, w: 12, h: 44, porta: true, acao: function () { ir('quarto'); } },
        { id: 'fundo', x: 42, y: 26, w: 15, h: 38, porta: true, acao: function () {
          if (!tem('lanterna')) fala(['O fim do corredor está completamente escuro.', 'Pela planta, a sala do gerador fica pra lá. Sem luz, não dá.']);
          else { som.tocar('lanterna', 0.8); fala(['Liguei a lanterna.'], function () { ir('gerador'); }); } } }
      ]
    },
    quarto: {
      nome: 'Quarto da diretora', img: 'quarto-v1.webp',
      chegada: ['Quarto da diretora. Dra. Ingrid Solberg, diz a plaquinha na porta.', 'A luminária está acesa. Então alguns circuitos ainda têm energia de reserva.'],
      saidas: [{ lado: 'baixo', para: 'corredor', rotulo: 'Corredor' }],
      pontos: [
        { id: 'parede', x: 60, y: 0, w: 40, h: 44, acao: function () {
          fala(['Dezenas de folhas. Todas com o mesmo desenho.',
            S.flags.simbolo ? 'A mesma estrela de sete pontas da parede do corredor.' : 'Uma estrela de sete pontas, desenhada à mão, de novo e de novo.']); } },
        { id: 'diario', x: 44, y: 52, w: 13, h: 12, acao: function () { doc('diario_ingrid'); } },
        { id: 'gravador', x: 47, y: 63, w: 11, h: 11, se: function () { return !tem('gravador'); }, acao: function () {
          pegar('gravador', ['Um gravador. A luzinha vermelha ainda acende.'], 'audio_ingrid'); } },
        { id: 'foto', x: 4, y: 21, w: 14, h: 18, acao: function () {
          fala(['A equipe toda, na frente da estação. O reflexo no vidro não deixa ver os rostos.', '{tenso}Contei. Doze pessoas... e uma sombra a mais, no canto.', '{confuso}Deve ser o vidro.']); } },
        { id: 'gaveta', x: 82, y: 76, w: 17, h: 22, acao: function () {
          if (!S.flags.chavesPegas) { flag('chavesPegas'); pegar('chaves', ['Na gaveta, um molho de chaves com etiqueta vermelha: GERADOR.', 'A Ingrid não queria mesmo que ninguém mexesse no gerador.']); }
          else fala(['A gaveta está vazia agora.']); } }
      ]
    },
    lab: {
      nome: 'Laboratório', img: 'lab-v1.webp',
      chegada: ['Laboratório de meteorologia.', 'Os monitores ainda funcionam, ligados na bateria de reserva.'],
      saidas: [
        { lado: 'dir', para: 'radio', rotulo: 'Sala de rádio' },
        { lado: 'baixo', para: 'refeitorio', rotulo: 'Refeitório' }
      ],
      pontos: [
        { id: 'monitor', x: 42, y: 23, w: 21, h: 24, acao: function () { doc('graf'); } },
        { id: 'papel', x: 72, y: 46, w: 23, h: 46, acao: function () {
          fala(['A impressora cuspiu metros de papel.', 'Os mesmos picos, sempre às 3h12.']); } },
        { id: 'prancheta', x: 10, y: 47, w: 14, h: 12, acao: function () { doc('relatorio_mira'); } },
        { id: 'bancada', x: 1, y: 38, w: 10, h: 16, acao: function () {
          if (!S.flags.fusivelPego) {
            flag('fusivelPego');
            pegar('fusivel', S.docs.indexOf('bilhete_pavel') >= 0
              ? ['A bancada da esquerda, como o Pavel disse.', 'Uma caixinha de fusíveis de reserva. Sobrou um só.']
              : ['Entre os tubos de amostra, uma caixinha de fusíveis de reserva. Sobrou um só.']);
          } else fala(['Mais nada de útil aqui.']); } }
      ]
    },
    radio: {
      nome: 'Sala de rádio', img: 'radio-v1.webp',
      chegada: ['A sala de rádio. Foi por causa dela que me mandaram pra cá.'],
      saidas: [{ lado: 'baixo', para: 'lab', rotulo: 'Laboratório' }],
      pontos: [
        { id: 'transceptor', x: 41, y: 42, w: 22, h: 21, acao: function () {
          if (!S.flags.energia) fala(['O rádio principal está morto. Só os aparelhos pequenos funcionam na bateria.', 'Preciso religar o gerador primeiro.']);
          else if (!S.flags.radioOk) fala(['Agora sim, o rádio liga.', 'Muita estática. Tem alguma coisa escondida no meio do ruído.'], abrirFrequencia);
          else fala(['O rádio só chia agora.', '{tenso}Mas eu sei que ela ainda está ouvindo.']); } },
        { id: 'fones', x: 1, y: 20, w: 13, h: 44, acao: function () {
          fala(['Os fones do Kazuo.', '{confuso}Ainda estão... mornos?', '{tenso}Não pode ser.']); } },
        { id: 'livro', x: 68, y: 56, w: 23, h: 24, acao: function () { doc('log_radio'); } },
        { id: 'mapa', x: 89, y: 8, w: 11, h: 30, acao: function () {
          fala(['Um mapa da região. Alguém circulou a lápis um ponto bem abaixo da estação.', 'Embaixo. Não ao lado.']); } }
      ]
    },
    gerador: {
      nome: 'Galpão do gerador', img: 'gerador-escuro-v1.webp',
      imgCom: function () { return S.flags.energia ? 'gerador-ligado-v1.webp' : null; },
      chegada: ['A lanterna mal dá conta desse galpão.', 'Ali está. O gerador principal.'],
      saidas: [{ lado: 'baixo', para: 'corredor', rotulo: 'Corredor' }],
      pontos: [
        { id: 'motor', x: 30, y: 18, w: 46, h: 56, acao: function () {
          if (!S.flags.energia) fala(['Desligado. O motor parece em ordem; o problema deve ser elétrico.', 'O painel de fusíveis fica na parede da direita.']);
          else fala(['Funcionando. O barulho do motor é quase reconfortante.']); } },
        { id: 'galao', x: 20, y: 68, w: 9, h: 18, acao: function () {
          fala(['Diesel. Cheio.', 'Combustível não é o problema.']); } },
        { id: 'painel', x: 82, y: 36, w: 17, h: 34, acao: function () {
          if (S.flags.energia) fala(['Tudo verde no painel.']);
          else if (!tem('chaves')) fala(['O painel de fusíveis está trancado, com cadeado e tudo.', 'Alguém não queria que ninguém mexesse aqui.']);
          else if (!tem('multimetro')) fala(['Abri o painel com as chaves da Ingrid.', 'Sem um multímetro, não tenho como saber o que queimou.']);
          else if (!tem('fusivel')) { flag('f3'); fala(['Abri o painel e medi tudo com o multímetro.', 'O fusível F3 está queimado. Preciso de um reserva.']); }
          else fala(['Troquei o fusível F3.', 'Agora é refazer as ligações que alguém bagunçou.'], abrirCircuito); } }
      ]
    }
  };

  /* ── ATO 2 — Subsolo Zero ───────────────────────────────────── */
  CENAS.almoxarifado = {
    nome: 'Almoxarifado B', img: 'almoxarifado-v1.webp',
    imgCom: function () { return S.flags.painelAberto ? 'almoxarifado-aberto-v1.webp' : null; },
    chegada: ['Almoxarifado B. "Suprimentos de frio", dizia a planta.', 'Mas tem marcas de arrasto no chão. Vindo daquela parede.'],
    saidas: [{ lado: 'baixo', para: 'entrada', rotulo: 'Entrada' }],
    pontos: [
      { id: 'planta', x: 5, y: 19, w: 16, h: 35, acao: function () { doc('planta'); } },
      { id: 'arranhoes', x: 37, y: 72, w: 26, h: 15, acao: function () {
        fala(['Marcas fundas no concreto, em arco.', 'Aquela placa de metal foi aberta e fechada dezenas de vezes.']); } },
      { id: 'pecabra', x: 70, y: 50, w: 11, h: 40, se: function () { return !S.flags.pecabraPego; }, acao: function () {
        flag('pecabraPego'); pegar('pecabra', ['Um pé de cabra encostado na prateleira.', 'Como se alguém tivesse deixado ali pra próxima pessoa.']); } },
      { id: 'painel', x: 43, y: 27, w: 19, h: 45, porta: true, acao: function () {
        if (S.flags.painelAberto) { ir('elevador'); return; }
        if (!tem('pecabra')) { fala(['Uma placa de metal aparafusada na rocha. Está solta de um lado.', 'Com alguma coisa pra fazer alavanca, dá pra abrir.']); return; }
        som.tocar('cabra', 0.9, function () { som.porta(); });
        flag('painelAberto'); tirar('pecabra');
        desenharCena();
        fala(['Enfiei o pé de cabra na fresta e puxei com o corpo todo.', 'A placa abriu como uma porta. Atrás dela...', '{confuso}Um elevador. Que não existe em planta nenhuma.']); } },
      { id: 'prateleiras', x: 23, y: 28, w: 16, h: 42, acao: function () {
        fala(['Peças de reposição, caixas de ração, cobertores.', 'Tudo etiquetado, tudo em ordem. Menos aquela parede.']); } }
    ]
  };
  CENAS.elevador = {
    nome: 'Elevador de carga', img: 'elevador-v1.webp',
    chegada: ['Uma gaiola de aço velha. A chave ainda está no painel.', 'Quem desceu por último não pensou em voltar.'],
    pontos: [
      { id: 'painel', x: 76, y: 26, w: 19, h: 50, acao: function () {
        if (S.flags.desceu) { fala(['O painel marca SUBSOLO ZERO.', 'Para subir é só puxar a alavanca ao contrário... mas eu ainda não terminei aqui.']); return; }
        fala(['Chave na posição LIGA. Uma alavanca de descida e um medidor de profundidade.', 'Nenhum botão de andar. Só uma marca riscada no vidro do medidor: 640.'], abrirElevador); } },
      { id: 'poco', x: 40, y: 20, w: 20, h: 56, acao: function () {
        fala(['O poço desce até onde a luz não alcança.', '{tenso}Lá embaixo, bem fraco, o mesmo zumbido do rádio.']); } },
      { id: 'sair', x: 21, y: 14, w: 15, h: 66, porta: true, acao: function () {
        ir(S.flags.desceu ? 'servico' : 'almoxarifado'); } }
    ]
  };
  CENAS.servico = {
    nome: 'Corredor de serviço', img: 'servico-v1.webp',
    chegada: ['Subsolo Zero. O gelo invadiu o concreto por todo lado.', 'E o ar é mais quente do que devia.'],
    aoChegar: function () {
      radio(['Téo? Aqui é a central do consórcio. O sinal está fraco, mas estamos te ouvindo.',
        '— Central? Ninguém me falou de um nível abaixo da base.',
        'A gente te guia daqui. Siga em frente.']);
    },
    saidas: [
      { lado: 'esq', para: 'servidores', rotulo: 'Servidores' },
      { lado: 'dir', para: 'arquivo', rotulo: 'Arquivo' },
      { lado: 'baixo', para: 'elevador', rotulo: 'Elevador' }
    ],
    pontos: [
      { id: 'juncao', x: 19, y: 25, w: 17, h: 31, acao: function () {
        if (S.flags.energia2) { fala(['A caixa de junção está ligada. Os fios no lugar certo.']); return; }
        fala(['A caixa de junção do corredor. Quatro fios soltos e quatro bornes marcados com símbolos.',
          S.docs.indexOf('emails') >= 0 ? 'O e-mail do Kazuo tinha a ordem dos fios.' : 'Sem saber a ordem, posso fritar tudo. Alguém deve ter anotado isso.'], abrirFios); } },
      { id: 'porta', x: 47, y: 42, w: 14, h: 30, porta: true, acao: function () {
        if (S.flags.portaSeg) { ir('biolab'); return; }
        if (!S.flags.energia2) { fala(['Porta de segurança. A luz do leitor está vermelha e apagada por dentro.', 'Sem energia no corredor, nem com crachá isso abre.']); return; }
        if (!tem('cracha')) { fala(['O leitor acendeu. Pede um crachá com acesso ao nível -1.']); return; }
        flag('portaSeg'); som.tocar('sinal-ok', 0.6); som.tocar('porta', 0.9);
        fala(['Passei o crachá vermelho do Kazuo. Bip. A trava abriu.'], function () {
          radio(['Ótimo trabalho, Téo. O laboratório da Dra. Okafor fica logo à frente.', '— Como vocês sabem onde eu estou?', '[só estática]'], function () { ir('biolab'); });
        }); } }
    ]
  };
  CENAS.servidores = {
    nome: 'Sala de servidores', img: 'servidores-v1.webp',
    chegada: ['Servidores. Centenas de luzes piscando no mesmo ritmo.', 'Como uma respiração.'],
    saidas: [{ lado: 'baixo', para: 'servico', rotulo: 'Corredor' }],
    pontos: [
      { id: 'terminal', x: 44, y: 42, w: 14, h: 16, acao: function () {
        if (S.flags.logado) { doc('emails'); return; }
        fala(['O terminal do Kazuo pede uma senha de 4 dígitos.'], abrirSenha); } },
      { id: 'caneca', x: 55, y: 50, w: 7, h: 11, acao: function () {
        fala(['Café pela metade. Ainda está... morno.', '{confuso}Isso não faz sentido nenhum.']); } },
      { id: 'rack', x: 72, y: 38, w: 12, h: 30, acao: function () {
        if (!S.flags.valvulaPega) { flag('valvulaPega'); pegar('valvula', ['O rack 9 está aberto. No meio dos servidores modernos, um soquete antigo com uma válvula termiônica.', 'Isto aqui é dos anos 50. Peguei.']); }
        else fala(['O cabo preto entra no rack e desce pelo buraco do chão.', '{tenso}Encostei a mão. Está morno. E pulsa.']); } },
      { id: 'buraco', x: 61, y: 80, w: 21, h: 13, acao: function () {
        fala(['O cabo some num buraco aberto no piso.', '{tenso}Não dá pra ver o fundo. Dá pra ouvir o zumbido.']); } }
    ]
  };
  CENAS.arquivo = {
    nome: 'Arquivo', img: 'arquivo-v1.webp',
    chegada: ['Um escritório virado do avesso.', 'Alguém estava procurando alguma coisa. Ou tentando entender.'],
    saidas: [{ lado: 'baixo', para: 'servico', rotulo: 'Corredor' }],
    pontos: [
      { id: 'mural', x: 36, y: 14, w: 30, h: 34, acao: function () {
        fala(['Um mapa-múndi com fotos de estações: Svalbard, Atacama, Sibéria, Groenlândia.', 'Barbantes de todas elas. Todos terminam no mesmo ponto.', '{tenso}Aqui.']); } },
      { id: 'fotos', x: 49, y: 51, w: 12, h: 10, se: function () { return !tem('polaroid'); }, acao: function () {
        pegar('polaroid', ['Fotos espalhadas pela mesa. Uma delas tem algo escrito no verso.'], 'polaroid'); } },
      { id: 'gaveta', x: 59, y: 61, w: 9, h: 17, acao: function () {
        if (!S.flags.crachaPego) { flag('crachaPego'); pegar('cracha', ['Na gaveta da mesa, um crachá com faixa vermelha.', 'KAZUO REN — ACESSO TOTAL.']); }
        else fala(['Só clipes e uma caneta sem tinta.']); } },
      { id: 'arquivos', x: 9, y: 31, w: 19, h: 45, acao: function () {
        if (!S.flags.fitaPega) { flag('fitaPega'); pegar('fita', ['Gavetas arrombadas. No fundo de uma delas, uma fita com a etiqueta "K. — não apagar".'], 'fita_kazuo'); }
        else fala(['Relatórios de temperatura, pedidos de suprimento...', 'E dezenas de folhas com a mesma estrela de sete pontas.']); } },
      { id: 'mapa', x: 36, y: 46, w: 10, h: 13, se: function () { return !tem('mapa'); }, acao: function () {
        pegar('mapa', ['Na pilha de pastas, um mapa do nível -1 desenhado à mão.'], 'mapa_mao'); } },
      { id: 'cartao', x: 58, y: 80, w: 10, h: 11, se: function () { return !S.flags.cartaoPego; }, acao: function () {
        flag('cartaoPego'); pegar('cartao', ['No chão, entre os papéis, um cartão perfurado.', 'Ninguém usa isso desde antes de eu nascer.']); } }
    ]
  };
  CENAS.biolab = {
    nome: 'Laboratório da Mira', img: 'biolab-v1.webp', pisca: true,
    chegada: ['O laboratório da Dra. Okafor.', 'O tanque do meio está rachado. O que estava dentro não está mais.'],
    saidas: [
      { lado: 'dir', para: 'portaAntiga', rotulo: 'Túnel' },
      { lado: 'baixo', para: 'servico', rotulo: 'Corredor' }
    ],
    pontos: [
      { id: 'frascos', x: 1, y: 55, w: 12, h: 16, se: function () { return !tem('frasco'); }, acao: function () {
        pegar('frasco', ['Frascos que brilham sozinhos. Peguei um.', 'Está morno. Na palma da mão, parece um pulso.'], 'amostra'); } },
      { id: 'microscopio', x: 12, y: 39, w: 9, h: 26, acao: function () {
        fala(['No microscópio, uma lâmina com o líquido do tanque.', 'Não são células. São padrões. Estrelas de sete pontas, minúsculas, se repetindo.']); } },
      { id: 'tanque', x: 44, y: 22, w: 12, h: 55, acao: function () {
        fala(['O vidro rachou de dentro pra fora.', 'No fundo, um resto escuro congelado. E marcas de mão. Do lado de dentro.']); } },
      { id: 'quadro', x: 77, y: 10, w: 23, h: 43, acao: function () { doc('quadro_mira'); } }
    ]
  };
  CENAS.portaAntiga = {
    nome: 'O túnel', img: 'porta-antiga-v1.webp',
    imgCom: function () { return S.flags.portaAberta ? 'porta-aberta-v1.webp' : null; },
    chegada: ['O concreto acaba aqui. Daqui pra frente é pedra.', 'Uma porta redonda, entalhada, muito mais velha que qualquer coisa que eu conheça.'],
    aoChegar: function () { radio(['A Mira deixou a ordem no quadro. Ela sempre deixava.', '— Eu não te contei do quadro.']); },
    saidas: [{ lado: 'baixo', para: 'biolab', rotulo: 'Laboratório' }],
    pontos: [
      { id: 'caixa', x: 77, y: 37, w: 10, h: 19, acao: function () {
        if (S.flags.caixaLigada) { fala(['A caixa zumbe. A válvula brilha laranja lá dentro.']); return; }
        if (!tem('valvula')) { fala(['Uma caixa de energia improvisada, aparafusada na pedra.', 'Tem um soquete vazio. De válvula.']); return; }
        flag('caixaLigada'); tirar('valvula'); som.tocar('luzes', 0.7);
        fala(['Encaixei a válvula dos servidores no soquete.', 'Ela acendeu. Os entalhes da porta acenderam junto.']); } },
      { id: 'estrela', x: 37, y: 24, w: 26, h: 48, porta: true, acao: function () {
        if (S.flags.portaAberta) { ir('terminalAntigo'); return; }
        if (!S.flags.caixaLigada) { fala(['A estrela no centro tem sete pontas. Cada uma com uma marca gasta pelo toque.', 'Está tudo apagado. Os cabos vêm daquela caixa à direita.']); return; }
        fala(['As sete pontas brilham fraco, esperando.'], abrirEstrela); } }
    ]
  };
  CENAS.terminalAntigo = {
    nome: 'A câmara', img: 'terminal-antigo-v1.webp',
    chegada: ['Um console de pedra preta. Os símbolos flutuam no ar, sem tela nenhuma.', 'Os notebooks da equipe estão no chão, ligados nele.'],
    saidas: [{ lado: 'baixo', para: 'portaAntiga', rotulo: 'Túnel' }],
    pontos: [
      { id: 'simbolos', x: 41, y: 28, w: 18, h: 18, acao: function () {
        fala(['Os símbolos giram devagar. Quando eu chego perto, eles param.', '{tenso}Como se estivessem olhando de volta.']); } },
      { id: 'notebook', x: 22, y: 66, w: 10, h: 14, acao: function () {
        fala(['O notebook do Kazuo. Última anotação na tela:', '"A fenda do console aceita os cartões perfurados do arquivo. Foi assim que a gente começou a traduzir."']); } },
      { id: 'console', x: 34, y: 46, w: 33, h: 27, acao: function () {
        if (!tem('cartao')) { fala(['Uma fenda fina no meio do console.', 'Do tamanho exato de um cartão.']); return; }
        tirar('cartao'); som.tocar('sinal-ok', 0.8);
        fala(['Encaixei o cartão perfurado na fenda.', 'O console inteiro acendeu.'], function () { doc('terminal_antigo', fimDoAto2); }); } }
    ]
  };

  /* ══════════════════════════════════════════════════════════════
     ATO 3 — O COFRE PRÉ-DILUVIANO
     Cenas: escadaria → salão → monólitos → ressonância → mirante → núcleo.
     Puzzles: inscrição, decodificador, três ondas, 13ª frequência.
     Três pedidos do Coro (P1, P2, P3): obedecer / conferir / recusar.
     Projeto: claude/sinal-branco-ato3-puzzles.md
  ══════════════════════════════════════════════════════════════ */
  ITENS.caderneta = { nome: 'Caderneta de rádio', img: 'item-caderneta-v1.webp', desc: 'A caderneta do Kazuo, com horários e frases de rádio anotados à mão.', doc: 'caderneta_radio' };
  ITENS.notas     = { nome: 'Anotações da Mira', img: 'item-notas-v1.webp', desc: 'Folhas coladas numa coluna, com marcas desenhadas e as traduções ao lado.', doc: 'notas_traducao' };
  ITENS.cartaomem = { nome: 'Cartão de memória', img: 'item-cartaomem-v1.webp', desc: 'Cartão de memória com uma etiqueta: "K. — decodificador".' };
  ITENS.pasta     = { nome: 'Pasta do selo', img: 'item-pasta-v1.webp', desc: 'Pasta plástica com o relatório da Mira sobre a faixa dourada.', doc: 'relatorio_selo' };
  ITENS.gravador2 = { nome: 'Gravador da Ingrid', img: 'item-gravador-v1.webp', desc: 'O último gravador da Dra. Ingrid. A fita ainda gira.', doc: 'audio_ingrid_final' };
  ITENS.oculos    = { nome: 'Óculos da Ingrid', img: 'item-oculos-v1.webp', desc: 'Óculos finos de armação prateada. Uma das hastes está torta.' };

  DOCS.caderneta_radio = { titulo: 'Caderneta de rádio', tipo: 'mao', texto:
    'CADERNETA DE RÁDIO — K. REN\n\n' +
    '11/10  21h40 — Sem resposta do continente há dois dias.\n' +
    '13/10  18h10 — Mira achou a escada no fundo do arquivo.\n' +
    '14/10  03h05 — Consórcio confirmou ciência da descida: "cientes, prossigam".\n' +
    '14/10  03h12 — Pedi pra repetir. Repetiram igual. Mesma voz, mesma pausa.\n\n' +
    'Se alguém perguntar: eles sabiam.' };
  DOCS.notas_traducao = { titulo: 'Anotações da Mira', tipo: 'mao', texto:
    'NOTAS DA PAREDE — M. OKAFOR\n\n' +
    'Três marcas eu tenho certeza:\n\n' +
    '[[g:ELE]]  = ELE\n[[g:ESCUTA]]  = ESCUTA\n[[g:RESPONDA]]  = RESPONDA\n\n' +
    'A quarta é a que abre a frase. O Kazuo disse que sabe qual é. Não deu tempo de perguntar.' };
  DOCS.nota_ondas = { titulo: 'Notebook do Kazuo', tipo: 'terminal', texto:
    'ANOTAÇÕES — K. REN\n\n' +
    '[[g:NAO]]  = NÃO. Abre toda frase de aviso. Aparece sempre primeiro.\n\n' +
    'Sobre as três ondas da sala de baixo: elas entram da mais lenta para a mais rápida, nessa ordem, da esquerda pra direita.\n\n' +
    'O anel do núcleo, mais abaixo: um soquete por pessoa, na ordem em que chegaram. Cada um é um múltiplo do sinal de 6,3 MHz que captamos no primeiro dia (a n-ésima harmônica). Eu sou o terceiro: 18,9.\n\n' +
    'Se errar, a sala não reclama. Ela muda.' };
  DOCS.inscricao = { titulo: 'A parede, traduzida', tipo: 'papel', texto:
    ''+
    '[[g:NAO]]  [[g:RESPONDA]]  [[g:ELE]]  [[g:ESCUTA]]\n\n' +
    'NÃO RESPONDA. ELE ESCUTA.\n\n' +
    'Na borda de baixo, duas marcas menores:\n[[g:GELO]]  [[g:DESCE]]\n\n' +
    'É um aviso. Escrito por quem desceu primeiro, muito antes de nós.' };
  DOCS.relatorio_selo = { titulo: 'Relatório do selo', tipo: 'papel', texto:
    'RELATÓRIO — SELO DOS MONÓLITOS\nM. OKAFOR\n\n' +
    'A faixa dourada não segura a porta. Ela segura o Coro.\n' +
    'O que está preso passa pela estrutura inteira e é contido no ponto do selo. Se o selo for solto, ele sai.\n\n' +
    'Não sei dizer pra onde. Não encosta nele.' };
  DOCS.ficha_teo = { titulo: 'Ficha 13', tipo: 'terminal', texto:
    'CONSÓRCIO POLAR — PROGRAMA DE COMPATIBILIDADE\nFICHA 13\n\n' +
    'Nome: MARIN, TÉO\nFunção: técnico de telecomunicações\nOrigem do contato: linhagem materna\n\n' +
    'MARCADORES\n  equipe (12 amostras) ...... compatíveis\n  amostra 13 (anterior ao Programa) ... compatível\n\n' +
    'SUSCETIBILIDADE: a avaliar em campo.\n' +
    'Obs.: contratado por indicação do Programa. Sem ciência do candidato.' };
  DOCS.audio_ingrid_final = { titulo: 'Gravador da Ingrid — última', tipo: 'audio', texto:
    'É a última que eu gravo. Contei de novo. Ainda são treze.\n\n' +
    'Eu sei quem é o treze. Ele me disse o nome, e não era um nome. Era uma luz.\n\n' +
    'Ele é gentil. É isso que me assusta mais. Ele nunca pediu nada que eu não quisesse dar.\n\n' +
    'Se alguém ouvir isso: não responda. Mesmo se ele pedir com a minha voz. Principalmente se pedir com a minha voz.' };

  // Glifos (traço em SVG 24×24): os documentos escrevem [[g:NOME]]
  var GLIFOS = {
    NAO: 'M12 2V22M5 7L19 17M19 7L5 17',
    RESPONDA: 'M4 5V19M4 12H19M14 7L19 12L14 17',
    ELE: 'M12 3L21 20H3ZM12 11V15',
    ESCUTA: 'M8 20C3 11 7 3 13 4C19 5 18 12 14 13C11 14 12 18 9 17',
    GELO: 'M12 2V22M3 7L21 17M21 7L3 17M9 3L12 6L15 3M9 21L12 18L15 21',
    DESCE: 'M5 5L12 12L19 5M5 12L12 19L19 12',
    SETE: 'M12 2L20 20L3 8H21L4 20Z'
  };
  var PAL_GLIFO = { NAO: 'NÃO', RESPONDA: 'RESPONDA', ELE: 'ELE', ESCUTA: 'ESCUTA', GELO: 'GELO', DESCE: 'DESCE' };
  function glifoSvg(k, cls) { return '<svg class="sb-gl ' + (cls || '') + '" viewBox="0 0 24 24"><path d="' + GLIFOS[k] + '"/></svg>'; }

  /* ── Pedidos do Coro ───────────────────────────────────────── */
  var PEDIDOS = {
    1: { resumo: '"Não avise a central."', docs: ['caderneta_radio'],
      voz: ['Téo. Antes de descer: não avise a central.', 'Eles não sabem que esta escada existe. Se souberem, cortam a energia da estação e eu perco você.'],
      contra: ['A caderneta do Kazuo: "14/10, 03h05 — Consórcio confirmou ciência da descida."', '{tenso}Eles sabiam. Eles autorizaram. A voz mentiu pra mim.'],
      obedece: ['Deixei o rádio calado. Se ele tem razão, é melhor assim.'],
      recusa: ['{tenso}Não. Quem manda aqui não é uma voz sem rosto.', 'Liguei o rádio pra avisar a central. Só estática. Alguma coisa cortou o sinal.'] },
    2: { resumo: '"Solte o selo do monólito."', docs: ['relatorio_selo'],
      voz: ['Téo. Aquela faixa dourada é uma trava velha. Solte o selo.', 'Sem ela, a estrutura inteira responde. Você termina o trabalho em minutos.'],
      contra: ['O relatório da Mira: "A faixa não segura a porta. Segura o Coro. Se soltar, ele sai."', '{tenso}Não é uma trava velha. É a tranca.'],
      obedece: ['A faixa se soltou como se estivesse esperando.', 'A luz que saiu dela encheu a câmara toda.'],
      recusa: ['{tenso}Não vou encostar nisso.'] },
    3: { resumo: '"Solte o primeiro dos que desceram."', docs: ['polaroid', 'ficha_teo'],
      voz: ['Téo. Ali, no parapeito. É o primeiro dos que desceram.', 'A equipe o prendeu lá embaixo e esqueceu. Solte-o. Ele só quer subir.'],
      contra: ['A foto da Ingrid: "13. Contei de novo." Desde o primeiro dia, quando eram doze.', 'A ficha: a amostra 13 é anterior ao Programa. Nunca foi da equipe.', '{tenso}Ninguém prendeu um pesquisador aqui embaixo. Isso nunca foi um deles.'],
      obedece: ['Encostei na pedra do parapeito. Estava quente.', 'A luz desceu pelo vão, devagar, como quem volta pra casa.'],
      recusa: ['{tenso}Não.', 'A figura me olhou um pouco mais. Depois apagou.'] }
  };
  function nObedecidos() { var n = 0; if (S) for (var i = 1; i <= 3; i++) if (S.flags['obedeceu' + i]) n++; return n; }
  function emoBase() { return S && nObedecidos() >= 2 ? 'obediente' : 'neutro'; }
  // Obedeceu algum pedido sem conferir → o Coro passa a mentir nas dicas
  function obedeceuSemChecar() {
    for (var i = 1; i <= 3; i++) if (S.flags['obedeceu' + i] && !S.flags['checou' + i]) return true;
    return false;
  }
  function pedido(n, depois) {
    fala(PEDIDOS[n].voz.map(function (l) { return '{coro}' + l; }), function () { pedidoQuadro(n, depois, false); });
  }
  function pedidoQuadro(n, depois, conferido) {
    var P = PEDIDOS[n];
    abrirModal(
      '<div class="sb-doc-tit">A voz pede</div>' +
      '<div class="sb-ped-txt">' + esc(P.resumo) + '</div>' +
      '<div class="sb-ped-botoes">' +
        '<button type="button" class="sb-btn" data-p="obedecer">Obedecer</button>' +
        (conferido ? '' : '<button type="button" class="sb-btn sb-btn-sec" data-p="conferir"><i class="fa fa-folder-open"></i> Conferir o Arquivo</button>') +
        '<button type="button" class="sb-btn sb-btn-sec" data-p="recusar">Recusar</button>' +
      '</div>', 'sb-puz sb-puz-pedido', false);
    el.caixa.querySelector('[data-p="obedecer"]').addEventListener('click', function () {
      som.clique(); flag('obedeceu' + n); fecharModal(); fala(P.obedece, depois);
    });
    var bc = el.caixa.querySelector('[data-p="conferir"]');
    if (bc) bc.addEventListener('click', function () {
      som.clique(); fecharModal();
      var ok = P.docs.every(function (d) { return S.docs.indexOf(d) >= 0; });
      if (ok) { flag('checou' + n); fala(P.contra, function () { pedidoQuadro(n, depois, true); }); }
      else fala(['{tenso}Não tenho nada pra conferir isso. Ainda.'], function () { pedidoQuadro(n, depois, false); });
    });
    el.caixa.querySelector('[data-p="recusar"]').addEventListener('click', function () {
      som.clique(); flag('recusou' + n); flag('semRadio'); fecharModal();
      som.estatica(0.7); setTimeout(function () { som.estatica(0); }, 600);
      fala(P.recusa, depois);
    });
  }

  /* ── Auxiliares dos puzzles ─────────────────────────────────── */
  function tremer() { el.caixa.classList.remove('sb-tremer'); void el.caixa.offsetWidth; el.caixa.classList.add('sb-tremer'); }
  function htmlDica() { return S.flags.semRadio ? '' : '<button type="button" class="sb-btn sb-btn-sec" data-d="dica"><i class="fa fa-headphones"></i> Ouvir a central</button>'; }
  function ligarDica(texto) {
    var b = el.caixa.querySelector('[data-d="dica"]');
    if (!b) return;
    b.addEventListener('click', function () {
      som.clique(); som.estatica(0.5); setTimeout(function () { som.estatica(0); }, 450);
      var m = el.caixa.querySelector('.sb-puz-dica');
      m.classList.remove('sb-aviso'); m.textContent = 'VOZ: «' + texto() + '»';
    });
  }
  function clarao() { el.fade.classList.add('sb-flash'); setTimeout(function () { el.fade.classList.remove('sb-flash'); }, 700); }

  /* ── Puzzle 1: a inscrição (4 glifos → 4 palavras) ───────────── */
  function abrirInscricao() {
    var PAL = ['NAO', 'RESPONDA', 'ELE', 'ESCUTA', 'GELO', 'DESCE'], CERTO = ['NAO', 'RESPONDA', 'ELE', 'ESCUTA'], idx = [-1, -1, -1, -1];
    abrirModal(
      '<button type="button" class="sb-x sb-x2" aria-label="Sair">✕</button>' +
      '<div class="sb-doc-tit">A inscrição</div>' +
      '<div class="sb-puz-dica">Quatro marcas na parede. Toque embaixo de cada uma para trocar a palavra.</div>' +
      '<div class="sb-ins">' + CERTO.map(function (k, i) {
        return '<div class="sb-ins-c">' + glifoSvg(k, 'sb-gl-g') + '<button type="button" class="sb-ins-p" data-i="' + i + '">· · ·</button></div>';
      }).join('') + '</div>' +
      '<div class="sb-puz-botoes">' + htmlDica() + '<button type="button" class="sb-btn" data-p="ok">Traduzir</button></div>', 'sb-puz sb-puz-ins', false);
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    ligarDica(function () { return 'Não. Responda. Ele. Escuta. Nessa ordem, Téo.'; });
    var msg = el.caixa.querySelector('.sb-puz-dica');
    Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-ins-p'), function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-i');
        idx[i] = (idx[i] + 1) % PAL.length; som.tique();
        b.textContent = PAL_GLIFO[PAL[idx[i]]];
      });
    });
    el.caixa.querySelector('[data-p="ok"]').addEventListener('click', function () {
      som.clique();
      var certo = CERTO.every(function (k, i) { return PAL[idx[i]] === k; });
      if (!certo) { tremer(); som.tocar('porta', 0.35); msg.textContent = 'A estrela do chão não reage. Alguma marca está errada.'; msg.classList.add('sb-aviso'); return; }
      som.tocar('sinal-ok', 0.7); msg.textContent = 'A estrela do chão acendeu.'; msg.classList.remove('sb-aviso');
      setTimeout(function () {
        fecharModal(); flag('inscricaoOk'); desenharCena(); clarao();
        doc('inscricao', function () {
          fala(['A estrela no chão acendeu, ponta por ponta. No fundo do salão, uma passagem se abriu.',
            '{tenso}"Não responda. Ele escuta." Quem escuta? E por que alguém gravaria um aviso na pedra?']);
        });
      }, 900);
    });
  }

  /* ── Puzzle 2: o decodificador (tocar os monólitos na ordem da inscrição) ── */
  function abrirDecoder() {
    var seq = S.flags.semRadio ? ['NAO', 'RESPONDA', 'ELE', 'ESCUTA', 'GELO', 'DESCE'] : ['NAO', 'RESPONDA', 'ELE', 'ESCUTA'];
    var lay = ['ELE', 'GELO', 'NAO', 'DESCE', 'ESCUTA', 'SETE', 'RESPONDA'], pos = 0;
    abrirModal(
      '<button type="button" class="sb-x sb-x2" aria-label="Sair">✕</button>' +
      '<div class="sb-doc-tit">Decodificador</div>' +
      '<div class="sb-puz-dica">Toque os monólitos na ordem da inscrição do salão.</div>' +
      '<div class="sb-dec-prog">' + seq.map(function () { return '<i></i>'; }).join('') + '</div>' +
      '<div class="sb-dec">' + lay.map(function (k) { return '<button type="button" class="sb-dec-m" data-k="' + k + '">' + glifoSvg(k) + '</button>'; }).join('') + '</div>' +
      '<div class="sb-puz-botoes">' + htmlDica() + '</div>', 'sb-puz sb-puz-dec', false);
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    ligarDica(function () { return 'Na ordem em que estão na parede, Téo. O primeiro é o NÃO.'; });
    var msg = el.caixa.querySelector('.sb-puz-dica'), pts = el.caixa.querySelectorAll('.sb-dec-prog i'), ms = el.caixa.querySelectorAll('.sb-dec-m');
    function limpar() { pos = 0; Array.prototype.forEach.call(pts, function (p) { p.classList.remove('sb-on'); }); Array.prototype.forEach.call(ms, function (m) { m.classList.remove('sb-on'); }); }
    Array.prototype.forEach.call(ms, function (m) {
      m.addEventListener('click', function () {
        var k = m.getAttribute('data-k');
        if (k !== seq[pos]) { tremer(); som.tocar('porta', 0.35); msg.textContent = 'Os monólitos apagaram. A sequência recomeça.'; msg.classList.add('sb-aviso'); limpar(); return; }
        msg.classList.remove('sb-aviso'); som.giro(); m.classList.add('sb-on'); pts[pos].classList.add('sb-on'); pos++;
        if (pos === seq.length) {
          som.tocar('revelacao', 0.6);
          setTimeout(function () {
            fecharModal(); flag('decodificado'); clarao();
            doc('ficha_teo', function () {
              fala(['{tenso}Marin, Téo. Ficha 13. Eles tinham o meu nome antes de me contratarem.',
                '"Sem ciência do candidato." Eu não fui chamado pra consertar nada.',
                'A amostra 13 também é compatível comigo. Uma amostra de antes do Programa, que nenhuma equipe coletou.']);
            });
          }, 900);
        }
      });
    });
  }

  /* ── Puzzle 3: as três ondas ────────────────────────────────── */
  function ondaPath(t) {
    var ciclos = { lenta: 1.5, media: 3, rapida: 6 }, d = '', x, y;
    if (t === 'plana') return 'M0 20H100';
    if (t === 'irregular') return 'M0 20L7 6L13 31L22 12L26 28L37 9L41 33L53 14L58 26L66 8L74 32L80 15L91 27L100 18';
    for (x = 0; x <= 100; x += 2) { y = 20 + 14 * Math.sin(2 * Math.PI * ciclos[t] * x / 100); d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1); }
    return d;
  }
  function abrirOndas() {
    var TIPOS = ['plana', 'lenta', 'media', 'rapida', 'irregular'], CERTO = ['lenta', 'media', 'rapida'], sel = [0, 0, 0];
    abrirModal(
      '<button type="button" class="sb-x sb-x2" aria-label="Sair">✕</button>' +
      '<div class="sb-doc-tit">O pedestal</div>' +
      '<div class="sb-puz-dica">Três anéis. Toque em cada um para trocar a onda.</div>' +
      '<div class="sb-ondas">' + [0, 1, 2].map(function (i) {
        return '<button type="button" class="sb-onda-a" data-i="' + i + '"><svg viewBox="0 0 100 40"><path d="' + ondaPath('plana') + '"/></svg></button>';
      }).join('') + '</div>' +
      '<div class="sb-puz-botoes">' + htmlDica() + '<button type="button" class="sb-btn" data-p="ok">Alinhar</button></div>', 'sb-puz sb-puz-ond', false);
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    ligarDica(function () { return obedeceuSemChecar() ? 'Rápida, média, lenta. Começa pela mais rápida, Téo.' : 'Lenta, média, rápida. Da esquerda pra direita.'; });
    var msg = el.caixa.querySelector('.sb-puz-dica');
    Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-onda-a'), function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-i'); sel[i] = (sel[i] + 1) % TIPOS.length; som.giro();
        b.querySelector('path').setAttribute('d', ondaPath(TIPOS[sel[i]]));
      });
    });
    el.caixa.querySelector('[data-p="ok"]').addEventListener('click', function () {
      som.clique();
      var certo = CERTO.every(function (t, i) { return TIPOS[sel[i]] === t; });
      if (!certo) {
        tremer(); som.tocar('porta', 0.5); msg.textContent = 'A sala estremeceu. Alguma coisa nos discos mudou de lugar.'; msg.classList.add('sb-aviso');
        var primeira = !S.flags.erros3;
        S.flags.erros3 = (S.flags.erros3 | 0) + 1; salvar();
        setTimeout(function () {
          fecharModal(); desenharCena(); clarao();
          if (primeira) fala(['{tenso}A sala trocou. Os discos estão em outros lugares, a luz virou outra e a porta agora está do outro lado.', 'Eu não saí do lugar. Eu tenho certeza que não saí do lugar.']);
        }, 900);
        return;
      }
      som.tocar('sinal-ok', 0.7); msg.classList.remove('sb-aviso');
      if (S.flags.semRadio && !S.flags.rodada3) {
        flag('rodada3'); S.flags.erros3 = Math.max(1, S.flags.erros3 | 0); salvar();
        msg.textContent = 'Os discos giraram sozinhos. A sala trocou de novo.';
        setTimeout(function () {
          fecharModal(); desenharCena(); clarao();
          fala(['Os discos bateram no mesmo compasso... e a sala trocou outra vez.', '{tenso}Sem a voz, não tenho como saber se acertei. Preciso alinhar uma segunda vez, já na sala trocada.']);
        }, 1000);
        return;
      }
      msg.textContent = 'Os três discos bateram no mesmo compasso.';
      setTimeout(function () {
        fecharModal(); flag('ondasOk'); clarao();
        fala(['Os três discos pararam no mesmo compasso. O ar ficou mais leve.', 'No canto da sala, uma porta que não estava aqui destravou.']);
      }, 900);
    });
  }

  /* ── Puzzle 4: a 13ª frequência ─────────────────────────────── */
  function abrirNucleo() {
    var dig = '', pts = [], i;
    for (i = 0; i < 13; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 13;
      pts.push({ x: 50 + 37 * Math.cos(a), y: 50 + 37 * Math.sin(a) });
    }
    var soq = pts.map(function (p, k) {
      var v = (6.3 * (k + 1)).toFixed(1).replace('.', ',');
      return k < 12
        ? '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="7.2" class="sb-soq sb-soq-on"/><text x="' + p.x.toFixed(1) + '" y="' + (p.y + 1.6).toFixed(1) + '" class="sb-soq-t">' + v + '</text>'
        : '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="7.2" class="sb-soq sb-soq-13"/><text x="' + p.x.toFixed(1) + '" y="' + (p.y + 1.6).toFixed(1) + '" class="sb-soq-t sb-soq-t13">?</text>';
    }).join('');
    abrirModal(
      '<button type="button" class="sb-x sb-x2" aria-label="Sair">✕</button>' +
      '<div class="sb-doc-tit">Núcleo — anel de soquetes (MHz)</div>' +
      '<div class="sb-puz-dica">Doze soquetes acesos, um por pessoa, na ordem de chegada. O décimo terceiro está apagado.</div>' +
      '<div class="sb-nuc">' +
        '<svg class="sb-nuc-anel" viewBox="0 0 100 100">' + soq + '<text x="50" y="50" class="sb-nuc-v">____</text></svg>' +
        '<div class="sb-nuc-pad"><div class="sb-teclado">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, ',', 0, 'C'].map(function (t) {
          return '<button type="button" class="sb-tecla" data-t="' + t + '">' + (t === 'C' ? '⌫' : t) + '</button>';
        }).join('') + '</div><div class="sb-puz-botoes">' + htmlDica() + '<button type="button" class="sb-btn" data-p="ok">Encaixar</button></div></div>' +
      '</div>', 'sb-puz sb-puz-nuc', false);
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    ligarDica(function () { return obedeceuSemChecar() ? '6,3, Téo. A base de tudo. Encaixe a base.' : 'A cada soquete soma 6,3 ao anterior. É só continuar a série.'; });
    var msg = el.caixa.querySelector('.sb-puz-dica'), vis = el.caixa.querySelector('.sb-nuc-v');
    function mostrar() { vis.textContent = dig || '____'; }
    Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-tecla'), function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-t'); som.tique();
        if (t === 'C') dig = dig.slice(0, -1);
        else if (dig.length < 5 && !(t === ',' && (dig.indexOf(',') >= 0 || !dig))) dig += t;
        mostrar();
      });
    });
    el.caixa.querySelector('[data-p="ok"]').addEventListener('click', function () {
      som.clique();
      var v = dig.replace('.', ',');
      if (v === '81,9') {
        som.tocar('revelacao', 0.8); msg.classList.remove('sb-aviso'); msg.textContent = 'O décimo terceiro soquete acendeu.';
        el.caixa.querySelector('.sb-soq-13').classList.add('sb-soq-on'); el.caixa.querySelector('.sb-soq-t13').textContent = '81,9';
        setTimeout(function () { fecharModal(); flag('nucleoOk'); desenharCena(); clarao(); fimDoAto3(); }, 1500);
        return;
      }
      tremer(); som.tocar('porta', 0.4); msg.classList.add('sb-aviso');
      msg.textContent = v === '6,3' ? 'O soquete devolve o mesmo número: 6,3 já está aceso no primeiro anel.' : 'O soquete recusa. A coluna de luz estremeceu.';
      dig = ''; mostrar();
    });
  }
  function fimDoAto3() {
    fala(['O décimo terceiro soquete acendeu. A coluna de luz no meio da sala mudou de cor, de branco para um violeta que eu não sei nomear.',
      '{tenso}Treze acesos. A equipe, e mais um. Eu completei o círculo.'], function () {
      if (S.flags.semRadio) fala(['{tenso}Sem a voz no rádio, o silêncio ficou pesado. Alguma coisa lá em cima abriu um caminho mesmo assim.'], function () { flag('ato3Fim'); telaFimAto(3); });
      else radio(['Treze acesos, Téo. Faltava só a última frequência.', 'Suba agora. A sala de transmissão está aberta.'], function () { flag('ato3Fim'); telaFimAto(3); });
    });
  }
  function apareceFigura() {
    if (S.flags.figura) return;
    flag('figura');
    if (S.cena !== 'mirante') return;
    desenharCena(); clarao(); som.tocar('revelacao', 0.7);
    fala(['{tenso}Na ponta do mirante, uma luz com forma de gente. Linda. Sem rosto fixo, como se mudasse conforme eu olho.'], function () {
      radio(['Aquele é o primeiro dos que desceram, Téo. Venha até o parapeito.']);
    });
  }

  CENAS.escadaria = {
    nome: 'Escadaria de gelo', img: 'ato3-escadaria-v1.webp',
    chegada: ['O elevador parou de responder. A única descida que sobrou é esta escada.',
      'Degraus de pedra com gelo por cima, e uma fila de lâmpadas penduradas por alguém que passou antes de mim.',
      'Ferramentas largadas, uma bolsa, pegadas de bota. Aqui o frio é outro, mais antigo.'],
    pontos: [
      { id: 'lampadas', x: 15, y: 5, w: 20, h: 45, acao: function () {
        fala(['Lâmpadas de obra penduradas em fio. Alguém trouxe energia até aqui embaixo.', 'O cabo está morno. Vem do mesmo lugar do zumbido.']); } },
      { id: 'picaretas', x: 24, y: 72, w: 13, h: 24, acao: function () {
        fala(['Duas picaretas largadas uma por cima da outra.', 'Usaram pra quebrar o gelo dos degraus. Quem desceu primeiro teve trabalho.']); } },
      { id: 'pegadas', x: 45, y: 71, w: 14, h: 25, acao: function () {
        fala(['{tenso}Pegadas de bota indo só pra baixo.', 'Contei duas vezes. Treze pares. De novo o treze.']); } },
      { id: 'bolsa', x: 61, y: 68, w: 17, h: 21, acao: function () {
        if (!S.flags.cadernetaPega) { flag('cadernetaPega'); pegar('caderneta', ['Uma bolsa laranja de campo, aberta, com ferramentas e uma corda.', 'No fundo, uma caderneta de rádio com a letra do Kazuo.'], 'caderneta_radio'); }
        else fala(['A bolsa do Kazuo. Só ferramentas e corda.']); } },
      { id: 'lanterna', x: 77, y: 84, w: 12, h: 12, acao: function () {
        fala(['Uma lanterna de campo caída no degrau, sem bateria.', 'Quem largou isso aqui não voltou pra buscar.']); } },
      { id: 'escada', x: 36, y: 50, w: 28, h: 20, porta: true, acao: function () {
        if (S.flags.p1ok) { ir('salao'); return; }
        fala(['A escada desce até onde a luz das lâmpadas acaba.', 'Daqui pra baixo, o rádio do cinto vai começar a falhar.'], function () {
          pedido(1, function () { flag('p1ok'); ir('salao'); });
        }); } }
    ]
  };
  CENAS.salao = {
    nome: 'Salão de colunas', img: 'ato3-salao-v1.webp',
    chegada: ['Um salão de colunas altas, de uma pedra que não é da Antártica. As paredes têm inscrições, as mesmas marcas do túnel.',
      'No chão, a estrela de sete pontas de novo, apagada. E encostada numa coluna, uma mesa de campo com o notebook do Kazuo, ainda ligado.'],
    saidas: [
      { lado: 'baixo', para: 'escadaria', rotulo: 'Escadaria' },
      { lado: 'cima', para: 'monolitos', rotulo: 'Câmara dos monólitos', se: function () { return !!S.flags.inscricaoOk; } }
    ],
    pontos: [
      { id: 'parede', x: 53, y: 14, w: 20, h: 42, acao: function () {
        if (S.flags.inscricaoOk) { doc('inscricao'); return; }
        fala(['Uma parede inteira de marcas, em fileiras. Quatro delas brilham mais que as outras.'], abrirInscricao); } },
      { id: 'estrela', x: 40, y: 64, w: 40, h: 17, acao: function () {
        fala(S.flags.inscricaoOk ? ['A estrela acesa mostra o caminho pro fundo do salão.'] : ['A estrela de sete pontas, gravada no piso. Apagada.', 'Quando a parede for lida, imagino que ela acenda.']); } },
      { id: 'notas', x: 13, y: 50, w: 8, h: 21, acao: function () {
        if (!S.flags.notasPegas) { flag('notasPegas'); pegar('notas', ['Folhas coladas na coluna, com a letra da Mira. Marcas desenhadas, e ao lado, a tradução.'], 'notas_traducao'); }
        else fala(['As folhas da Mira, que já guardei.']); } },
      { id: 'notebook', x: 18, y: 67, w: 8, h: 9, acao: function () { doc('nota_ondas'); } },
      { id: 'cartao', x: 27, y: 70, w: 6, h: 8, acao: function () {
        if (!S.flags.cartaoMemPego) { flag('cartaoMemPego'); pegar('cartaomem', ['Ao lado do notebook, um cartão de memória preso com fita.', 'A etiqueta, na letra do Kazuo: "decodificador".']); }
        else fala(['A mesa de campo. O resto é cabo e ferramenta.']); } }
    ]
  };
  CENAS.monolitos = {
    nome: 'Câmara dos monólitos', img: 'ato3-monolitos-v1.webp',
    imgCom: function () { return S.flags.seloSolto ? 'ato3-monolitos-solto-v1.webp' : null; },
    chegada: ['Sete monólitos num círculo, cobertos de marcas que brilham sozinhas. No meio, uma pedra baixa com três notebooks ligados em cabos que somem pelo chão.',
      'Em volta do monólito mais alto, uma faixa dourada. Parece que está apertando.'],
    saidas: [
      { lado: 'baixo', para: 'salao', rotulo: 'Salão' },
      { lado: 'cima', para: 'ressonancia', rotulo: 'Sala da ressonância', se: function () { return !!S.flags.p2ok; } }
    ],
    pontos: [
      { id: 'runas', x: 73, y: 7, w: 13, h: 78, acao: function () {
        fala(['As marcas do monólito têm o mesmo traço das do salão.', '{tenso}Pulsam. Devagar. Como quem respira.']); } },
      { id: 'equipamento', x: 41, y: 53, w: 18, h: 21, acao: function () {
        if (S.flags.decodificado) { doc('ficha_teo'); return; }
        if (!tem('cartaomem')) { fala(['Três notebooks ligados a um leitor de cartão. A fenda está vazia.', 'Preciso do cartão de memória do Kazuo.']); return; }
        if (!S.flags.decoderLigado) { flag('decoderLigado'); tirar('cartaomem'); som.tocar('sinal-ok', 0.6); fala(['Encaixei o cartão. Os três notebooks acordaram juntos.', 'Cada monólito agora tem um sinal ao lado, esperando uma ordem.'], abrirDecoder); return; }
        abrirDecoder(); } },
      { id: 'pasta', x: 28, y: 80, w: 6, h: 7, acao: function () {
        if (!S.flags.pastaPega) { flag('pastaPega'); pegar('pasta', ['Uma caixa de energia no chão, com uma pasta plástica presa embaixo.', 'Na capa, a letra da Mira: "SELO".'], 'relatorio_selo'); }
        else fala(['A caixa de energia. Ainda quente.']); } },
      { id: 'selo', x: 14, y: 7, w: 14, h: 78, acao: function () {
        if (S.flags.p2ok) { fala(S.flags.seloSolto ? ['O monólito está inteiro, mas sem a faixa. A luz de dentro ficou mais forte.'] : ['A faixa dourada continua no lugar. Eu deixei.']); return; }
        if (!S.flags.decodificado) { fala(['Uma faixa dourada em volta do monólito mais alto, apertada como uma cinta.', 'Não há controle nenhum aqui. Primeiro preciso ligar o equipamento do meio.']); return; }
        pedido(2, function () { flag('p2ok'); if (S.flags.obedeceu2) flag('seloSolto'); desenharCena(); }); } }
    ]
  };
  CENAS.ressonancia = {
    nome: 'Sala da ressonância', img: 'ato3-ressonancia-v1.webp',
    imgCom: function () { return (S.flags.erros3 | 0) > 0 ? 'ato3-ressonancia-errada-v1.webp' : null; },
    chegada: ['Uma sala redonda, de pedra lisa, com três discos de luz na parede. Cada um mostra uma onda diferente.', 'No meio, um pedestal com três anéis giratórios.'],
    saidas: [{ lado: 'baixo', para: 'monolitos', rotulo: 'Monólitos' }],
    pontos: [
      { id: 'pedestal', x: 43, y: 52, w: 15, h: 24, acao: function () {
        if (S.flags.ondasOk) { fala(['Os três anéis bateram no mesmo compasso e ficaram quietos.']); return; }
        abrirOndas(); } },
      { id: 'discos', x: 20, y: 20, w: 62, h: 35, acao: function () {
        fala(['Três discos de luz com três ondas: uma lenta, uma média e uma rápida.', 'Pelo que o Kazuo anotou, o pedestal quer que eu copie a ordem deles.']); } },
      { id: 'porta-esq', x: 3, y: 18, w: 11, h: 45, se: function () { return !((S.flags.erros3 | 0) > 0); }, porta: true, acao: function () { portaOndas(); } },
      { id: 'porta-dir', x: 86, y: 20, w: 11, h: 46, se: function () { return (S.flags.erros3 | 0) > 0; }, porta: true, acao: function () { portaOndas(); } }
    ]
  };
  function portaOndas() {
    if (S.flags.ondasOk) ir('mirante');
    else fala(['A porta não cede. Os anéis do pedestal ainda estão fora do compasso.']);
  }
  CENAS.mirante = {
    nome: 'Mirante', img: 'ato3-mirante-v1.webp',
    imgCom: function () { return S.flags.figura && !S.flags.p3ok ? 'ato3-mirante-luz-v1.webp' : null; },
    chegada: ['A sala acaba num mirante sobre um vazio enorme. Lá embaixo, em linhas e círculos, milhares de luzes pequenas desenham uma coisa que eu levo um tempo pra entender.',
      '{tenso}Não é uma cidade. É uma planta. E cada luz, uma coisa presa.'],
    saidas: [
      { lado: 'baixo', para: 'ressonancia', rotulo: 'Ressonância' },
      { lado: 'dir', para: 'nucleo', rotulo: 'Núcleo do Coro', se: function () { return !!S.flags.p3ok; } }
    ],
    pontos: [
      { id: 'gravador', x: 35, y: 83, w: 8, h: 10, se: function () { return !S.flags.gravadorPego; }, acao: function () {
        flag('gravadorPego'); pegar('gravador2', ['No chão do mirante, um gravador de bolso. O da Ingrid.', 'A fita ainda está girando, devagar.'], 'audio_ingrid_final'); } },
      { id: 'oculos', x: 42, y: 85, w: 8, h: 8, se: function () { return !S.flags.oculosPego; }, acao: function () {
        flag('oculosPego'); pegar('oculos', ['Óculos finos de armação prateada, ao lado do gravador.', 'Uma das hastes está torta. Ela nunca andava sem eles.']); } },
      { id: 'abismo', x: 60, y: 44, w: 30, h: 17, acao: function () {
        fala(['As luzes lá embaixo não se mexem, mas parecem olhar pra cima.', '{tenso}Dá pra sentir de longe: é de lá que vem o zumbido.']); } },
      { id: 'figura', x: 45, y: 19, w: 13, h: 22, se: function () { return !!S.flags.figura && !S.flags.p3ok; }, acao: function () {
        fala(['{tenso}A luz tem a forma de uma pessoa alta, de ombros relaxados. Não tem rosto, mas eu tenho a sensação de que sorri.']); } },
      { id: 'parapeito', x: 26, y: 62, w: 68, h: 19, acao: function () {
        if (S.flags.p3ok) { fala(['O parapeito de pedra. O vão embaixo está quieto.']); return; }
        if (!S.flags.figura) { fala(['Um parapeito de pedra, cheio de gelo, com o vazio logo atrás.', 'O gravador no chão parece mais interessante que a vista.']); return; }
        pedido(3, function () { flag('p3ok'); desenharCena(); }); } }
    ]
  };
  CENAS.nucleo = {
    nome: 'Núcleo do Coro', img: 'ato3-nucleo-v1.webp',
    chegada: ['Um salão circular, com colunas ao redor e servidores modernos plugados nelas por feixes de cabos grossos como braços.',
      'No centro, uma coluna de luz branca vai do chão ao teto. E num disco no piso, um anel de soquetes acesos. Falta um.'],
    pontos: [
      { id: 'coluna', x: 47, y: 0, w: 6, h: 68, acao: function () {
        fala(['A coluna de luz não faz calor, nem som. Faz só pressão, como a de um ouvido tapado.']); } },
      { id: 'servidor-e', x: 20, y: 44, w: 10, h: 22, acao: function () {
        fala(['Servidores comuns, de rack, ligados direto na pedra.', 'Alguém pagou caro pra enfiar um data center dentro de uma coisa mais velha que a escrita.']); } },
      { id: 'servidor-d', x: 72, y: 44, w: 10, h: 22, acao: function () {
        fala(['A etiqueta do rack diz CONSÓRCIO POLAR. O resto é cabo.']); } },
      { id: 'anel', x: 54, y: 79, w: 33, h: 16, acao: function () {
        if (S.flags.nucleoOk) { fala(['Os treze soquetes acesos. Não sobrou nada pra fazer aqui.']); return; }
        abrirNucleo(); } }
    ]
  };

  /* ══════════════════════════════════════════════════════════════
     ESTADO
  ══════════════════════════════════════════════════════════════ */
  var S = null;           // { cena, itens[], flags{}, docs[], vistos{}, chegou{}, tempo }
  var montado = false, ativo = false, lockNativo = false;
  var el = {};            // referências do DOM
  var falaFila = [], falaFim = null, falaTimer = 0, falaTexto = '', falaPos = 0, falaRet = '';
  var tUltimo = 0, relogio = 0;
  var neveRaf = 0, neve = [];
  var emPartida = false;

  // Progresso desbloqueado (maior ato alcançado). Separado do save para sobreviver a "refazer ato".
  var PROG = 'angatuba_sinalbranco_prog', progCache = 0;
  var ATO_CENAS = {
    1: ['voo', 'heliponto', 'entrada', 'refeitorio', 'corredor', 'quarto', 'lab', 'radio', 'gerador'],
    2: ['almoxarifado', 'elevador', 'servico', 'servidores', 'arquivo', 'biolab', 'portaAntiga', 'terminalAntigo'],
    3: ['escadaria', 'salao', 'monolitos', 'ressonancia', 'mirante', 'nucleo']
  };
  var ATO_FLAGS = {
    1: ['energia', 'radioOk', 'atoFim', 'chavesPegas', 'fusivelPego', 'dia14', 'f3', 'simbolo'],
    2: ['caixaLigada', 'cartaoPego', 'crachaPego', 'desceu', 'energia2', 'fitaPega', 'logado', 'painelAberto', 'pecabraPego', 'portaAberta', 'portaSeg', 'valvulaPega', 'ato2Fim'],
    3: ['obedeceu1', 'obedeceu2', 'obedeceu3', 'checou1', 'checou2', 'checou3', 'recusou1', 'recusou2', 'recusou3', 'semRadio',
      'p1ok', 'p2ok', 'p3ok', 'inscricaoOk', 'decoderLigado', 'decodificado', 'seloSolto', 'erros3', 'rodada3', 'ondasOk', 'figura', 'nucleoOk', 'ato3Fim',
      'cadernetaPega', 'notasPegas', 'cartaoMemPego', 'pastaPega', 'gravadorPego', 'oculosPego']
  };
  function progLer() {
    var p = 1;
    try { p = (JSON.parse(localStorage.getItem(PROG) || '{}').max | 0) || 1; } catch (e) {}
    return p;
  }
  function progMax() {
    var p = Math.max(progLer(), progCache || 1);
    try {
      var sv = JSON.parse(localStorage.getItem(SAVE) || 'null');
      if (sv) p = Math.max(p, sv.ato || 1, sv.flags && sv.flags.atoFim ? 2 : 1, sv.flags && sv.flags.ato2Fim ? 3 : 1, sv.flags && sv.flags.ato3Fim ? 4 : 1);
    } catch (e) {}
    return Math.min(p, ULTIMO_ATO);
  }
  function progRegistrar() {
    var p = progMax();
    if (p > progCache) { progCache = p; try { localStorage.setItem(PROG, JSON.stringify({ max: p })); } catch (e) {} }
  }
  function novoEstado() {
    return { ato: 1, cena: 'voo', itens: [], flags: {}, docs: [], vistos: {}, chegou: {}, tempo: 0 };
  }
  function salvar() {
    if (!S) return;
    _tickTempo();
    try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {}
    progRegistrar();
  }
  function carregar() {
    try { var s = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (s && CENAS[s.cena]) return s; } catch (e) {}
    return null;
  }
  function _tickTempo() {
    var agora = Date.now();
    if (S && tUltimo && emPartida) S.tempo += Math.min(60000, agora - tUltimo);
    tUltimo = agora;
  }

  /* ── Auxiliares usados pelas cenas ───────────────────────────── */
  function tem(id) { return S.itens.indexOf(id) >= 0; }
  function flag(f) { S.flags[f] = true; salvar(); }
  // Fala da "voz da central" no rádio do cinto: estática curta antes.
  function radio(linhas, aoFim) {
    if (S && S.flags.semRadio) { som.estatica(0.7); setTimeout(function () { som.estatica(0); }, 600); fala(['{tenso}Só estática no rádio. A central não responde mais.'], aoFim); return; }
    som.estatica(0.7);
    setTimeout(function () { som.estatica(0); }, 700);
    fala(linhas.map(function (l) { return l.charAt(0) === '—' || l.charAt(0) === '[' ? l : '{coro}' + l; }), aoFim);
  }
  function tirar(id) { var i = S.itens.indexOf(id); if (i >= 0) S.itens.splice(i, 1); desenharInv(); }
  function pegar(id, linhas, docId, aoDoc) {
    if (!tem(id)) S.itens.push(id);
    som.pegar();
    salvar();
    desenharCena(true);
    fala(linhas, function () {
      desenharInv(id);
      mostrarItem(id, true, docId ? function () { doc(docId, aoDoc); } : null);
    });
  }

  // Janela do item: imagem grande, nome e descrição. Ao pegar ("Novo item")
  // ou ao tocar no item do inventário. Itens com documento (bilhete,
  // gravador) ganham o botão de ler/ouvir.
  function mostrarItem(id, novo, aoFechar) {
    var it = ITENS[id], d = it.doc ? DOCS[it.doc] : null;
    abrirModal(
      '<div class="sb-it-novo">' + (novo ? 'Novo item' : 'Inventário') + '</div>' +
      '<div class="sb-it-img"><img src="' + A + it.img + '" alt=""></div>' +
      '<div class="sb-it-nome">' + esc(it.nome) + '</div>' +
      '<div class="sb-it-desc">' + esc(it.desc) + '</div>' +
      '<div class="sb-puz-botoes">' +
        (d ? '<button type="button" class="sb-btn" data-i="doc"><i class="fa ' + (d.tipo === 'audio' ? 'fa-play' : 'fa-book-open') + '"></i> ' + (d.tipo === 'audio' ? 'Ouvir gravação' : 'Ler') + '</button>' : '') +
        '<button type="button" class="' + (d ? 'sb-btn-sec' : 'sb-btn') + '" data-i="ok">' + (novo ? 'Guardar' : 'Fechar') + '</button>' +
      '</div>', 'sb-it', true, aoFechar);
    if (novo) som.tocar('pegar', 0.5);
    var bDoc = el.caixa.querySelector('[data-i="doc"]');
    if (bDoc) bDoc.addEventListener('click', function () { som.clique(); modalAoFechar = null; fecharModal(); doc(it.doc); });
    el.caixa.querySelector('[data-i="ok"]').addEventListener('click', function () { som.clique(); fecharModal(); });
  }

  /* ══════════════════════════════════════════════════════════════
     MONTAGEM DO DOM
  ══════════════════════════════════════════════════════════════ */
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function montar() {
    var root = document.getElementById('sinalbranco-root');
    if (!root) return false;
    root.innerHTML = '';
    var palco = h('div', 'sb-palco');
    palco.innerHTML =
      '<div class="sb-mundo"><img class="sb-bg" alt="" draggable="false"><video class="sb-vid" muted loop playsinline preload="auto" aria-hidden="true" style="display:none"></video><div class="sb-pontos"></div></div>' +
      '<canvas class="sb-fx" width="800" height="450"></canvas>' +
      '<div class="sb-saidas"></div>' +
      '<div class="sb-hud">' +
        '<div class="sb-local"></div>' +
        '<div class="sb-botoes">' +
          '<button type="button" class="sb-hbtn" data-a="lupa" aria-label="Mostrar pontos"><i class="fa fa-search"></i></button>' +
          '<button type="button" class="sb-hbtn" data-a="arquivo" aria-label="Arquivo"><i class="fa fa-folder-open"></i><span class="sb-badge"></span></button>' +
        '</div>' +
      '</div>' +
      '<div class="sb-inv"></div>' +
      '<div class="sb-fala" style="display:none"><div class="sb-ret"></div><div class="sb-fala-txt"></div><div class="sb-fala-seta">▼</div></div>' +
      '<div class="sb-modal" style="display:none"><div class="sb-modal-caixa"></div></div>' +
      '<div class="sb-titulo" style="display:none"></div>' +
      '<div class="sb-fade"></div>';
    var amb = h('img', 'sb-amb'); amb.alt = ''; amb.setAttribute('aria-hidden', 'true'); amb.draggable = false;
    root.appendChild(amb); root.appendChild(palco);
    el.root = root; el.palco = palco; el.amb = amb;
    el.bg = palco.querySelector('.sb-bg');
    el.vid = palco.querySelector('.sb-vid');
    el.fx = palco.querySelector('.sb-fx');
    el.pontos = palco.querySelector('.sb-pontos');
    el.saidas = palco.querySelector('.sb-saidas');
    el.local = palco.querySelector('.sb-local');
    el.badge = palco.querySelector('.sb-badge');
    el.inv = palco.querySelector('.sb-inv');
    el.fala = palco.querySelector('.sb-fala');
    el.falaTxt = palco.querySelector('.sb-fala-txt');
    el.ret = palco.querySelector('.sb-ret');
    el.modal = palco.querySelector('.sb-modal');
    el.caixa = palco.querySelector('.sb-modal-caixa');
    el.titulo = palco.querySelector('.sb-titulo');
    el.fade = palco.querySelector('.sb-fade');

    palco.querySelector('[data-a="lupa"]').addEventListener('click', function () { som.clique(); lupa(); });
    palco.querySelector('[data-a="arquivo"]').addEventListener('click', function () { som.clique(); abrirArquivo(); });
    el.fala.addEventListener('click', avancarFala);
    el.modal.addEventListener('click', function (e) { if (e.target === el.modal && el.modal.getAttribute('data-fecha') === '1') fecharModal(); });
    montado = true;
    return true;
  }

  /* ── Layout: palco 16:9; em pé, gira 90° ─────────────────────── */
  function layout() {
    if (!el.root) return;
    var r = el.root.getBoundingClientRect();
    var W = r.width, H = r.height;
    if (W < 10 || H < 10) return;
    var girar = !lockNativo && H > W * 1.05;
    var aw = girar ? H : W, ah = girar ? W : H;
    var sw = Math.min(aw, ah * 16 / 9), sh = sw * 9 / 16;
    var p = el.palco.style;
    p.width = sw + 'px'; p.height = sh + 'px';
    p.fontSize = (sw / 100) + 'px';
    p.transform = 'translate(-50%,-50%)' + (girar ? ' rotate(90deg)' : '');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cw = Math.round(sw * dpr), ch = Math.round(sh * dpr);
    if (el.fx.width !== cw) { el.fx.width = cw; el.fx.height = ch; }
  }
  function travarPaisagem() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        var pr = screen.orientation.lock('landscape');
        if (pr && pr.then) pr.then(function () { lockNativo = true; layout(); setTimeout(layout, 250); }).catch(function () { lockNativo = false; });
      }
    } catch (e) { lockNativo = false; }
  }
  function destravar() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    lockNativo = false;
  }
  function aoRedimensionar() { if (ativo) { layout(); setTimeout(layout, 200); } }

  /* ══════════════════════════════════════════════════════════════
     CENA
  ══════════════════════════════════════════════════════════════ */
  function cenaAtual() { return CENAS[S.cena]; }

  function desenharCena(soPontos) {
    var c = cenaAtual();
    if (!soPontos) {
      var src = A + ((c.imgCom && c.imgCom()) || c.img);
      if (el.bg.getAttribute('src') !== src) { el.bg.src = src; el.amb.src = src; }
      el.palco.classList.toggle('sb-pisca', !!c.pisca);
      // Vídeo opcional da cena (loop mudo por cima da imagem, só com a imagem base; a imagem fica de fundo/reserva)
      var vsrc = c.video && !(c.imgCom && c.imgCom()) ? A + c.video : '';
      if (vsrc) {
        if (el.vid.getAttribute('src') !== vsrc) { el.vid.style.display = 'none'; el.vid.onplaying = function () { el.vid.style.display = ''; }; el.vid.onerror = function () { el.vid.style.display = 'none'; }; el.vid.src = vsrc; }
        var pv = el.vid.play(); if (pv && pv.catch) pv.catch(function () {});
      } else { el.vid.style.display = 'none'; if (el.vid.getAttribute('src')) { el.vid.pause(); el.vid.removeAttribute('src'); el.vid.load(); } }
      el.palco.classList.toggle('sb-nucleo-ok', S.cena === 'nucleo' && !!S.flags.nucleoOk);
      el.local.textContent = c.nome;
      ligarNeve(!!c.neve);
      som.ambiente(c.fora ? 'fora' : 'dentro', S.cena);
    }
    el.pontos.innerHTML = '';
    c.pontos.forEach(function (pt) {
      if (pt.se && !pt.se()) return;
      var b = h('button', 'sb-ponto' + (pt.porta ? ' sb-porta' : '') + (S.vistos[S.cena + '.' + pt.id] ? ' sb-visto' : ''));
      b.type = 'button';
      b.style.left = pt.x + '%'; b.style.top = pt.y + '%';
      b.style.width = pt.w + '%'; b.style.height = pt.h + '%';
      b.setAttribute('aria-label', pt.id);
      b.addEventListener('click', function () {
        if (ocupado()) return;
        S.vistos[S.cena + '.' + pt.id] = true;
        b.classList.add('sb-visto');
        var onda = h('span', 'sb-onda-toque'); b.appendChild(onda);
        setTimeout(function () { if (onda.parentNode) onda.parentNode.removeChild(onda); }, 600);
        if (pt.porta) som.porta(); else som.clique();
        pt.acao();
        salvar();
      });
      el.pontos.appendChild(b);
    });
    if (!soPontos) {
      el.saidas.innerHTML = '';
      (c.saidas || []).forEach(function (s) {
        if (s.se && !s.se()) return;
        var ic = { esq: 'fa-chevron-left', dir: 'fa-chevron-right', baixo: 'fa-chevron-down', cima: 'fa-chevron-up' }[s.lado];
        var b = h('button', 'sb-saida sb-saida-' + s.lado, '<i class="fa ' + ic + '"></i><span>' + esc(s.rotulo) + '</span>');
        b.type = 'button';
        b.addEventListener('click', function () { if (ocupado()) return; som.passo(!!cenaAtual().fora); ir(s.para); });
        el.saidas.appendChild(b);
      });
    }
  }

  function ir(id) {
    if (!CENAS[id]) return;
    el.fade.classList.add('sb-on');
    setTimeout(function () {
      S.cena = id;
      desenharCena();
      salvar();
      var pronto = function () {
        el.fade.classList.remove('sb-on');
        var c = cenaAtual();
        if (!S.chegou[id] && c.chegada) {
          S.chegou[id] = true; salvar();
          setTimeout(function () { fala(c.chegada, c.aoChegar || null); }, 280);
        }
      };
      if (el.bg.complete) pronto(); else { el.bg.onload = function () { el.bg.onload = null; pronto(); }; setTimeout(pronto, 900); }
    }, 260);
  }

  function lupa() {
    el.palco.classList.add('sb-lupa');
    clearTimeout(lupa._t);
    lupa._t = setTimeout(function () { el.palco.classList.remove('sb-lupa'); }, 2200);
  }

  function ocupado() {
    return el.fala.style.display !== 'none' || el.modal.style.display !== 'none' || el.titulo.style.display !== 'none';
  }

  /* ══════════════════════════════════════════════════════════════
     INVENTÁRIO
  ══════════════════════════════════════════════════════════════ */
  function desenharInv(novo) {
    el.inv.innerHTML = '';
    S.itens.forEach(function (id) {
      var it = ITENS[id];
      var b = h('button', 'sb-item' + (id === novo ? ' sb-novo' : ''), '<img src="' + A + it.img + '" alt="' + esc(it.nome) + '">');
      b.type = 'button';
      b.addEventListener('click', function () {
        if (ocupado()) return;
        som.clique();
        mostrarItem(id, false);
      });
      el.inv.appendChild(b);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     RETRATOS: busto de quem fala + ícone da emoção
     Arquivos ret-<quem>-<emoção>-v1.webp. Nas falas, '{tenso}texto' troca
     a emoção do Téo (sem tag = neutro) e '{coro}texto' é a voz do rádio
     (sem retrato: símbolo da estrela de sete pontas).
  ══════════════════════════════════════════════════════════════ */
  var NOMES = { teo: 'TÉO', ingrid: 'INGRID', kazuo: 'KAZUO', mira: 'MIRA', pavel: 'PAVEL', coro: 'VOZ' };
  var EMO_ICONE = { tenso: '!', confuso: '?', obediente: '…', fundido: '✦', obsessiva: '!', assustada: '!!', transe: '✦',
    desconfiado: '?', cansado: '…', perturbada: '!', paranoico: '!!', arrependido: '…', curiosa: '?' };
  // Quem "escreveu" cada documento e com que cara (sem entrada = sem retrato)
  var DOC_RET = {
    bilhete_pavel: ['pavel', 'paranoico'], diario_ingrid: ['ingrid', 'obsessiva'], audio_ingrid: ['ingrid', 'serena'],
    relatorio_mira: ['mira', 'perturbada'], log_radio: ['kazuo', 'tecnico'], sinal: ['coro', ''], emails: ['kazuo', 'desconfiado'],
    fita_kazuo: ['kazuo', 'cansado'], amostra: ['mira', 'curiosa'], quadro_mira: ['mira', 'firme'],
    caderneta_radio: ['kazuo', 'tecnico'], notas_traducao: ['mira', 'firme'], nota_ondas: ['kazuo', 'cansado'],
    relatorio_selo: ['mira', 'perturbada'], audio_ingrid_final: ['ingrid', 'assustada']
  };
  // Falas da "central" que têm áudio (a voz do Coro disfarçado). Chave = texto exato da linha.
  var VOZ_CENTRAL = {
    'Téo? Aqui é a central do consórcio. O sinal está fraco, mas estamos te ouvindo.': 'central_abertura',
    'A gente te guia daqui. Siga em frente.': 'central_guia',
    'Ótimo trabalho, Téo. O laboratório da Dra. Okafor fica logo à frente.': 'central_otimo',
    'A Mira deixou a ordem no quadro. Ela sempre deixava.': 'central_quadro',
    'Bem-vindo, Téo. Agora desça.': 'central_desca'
  };
  function estrela7() {
    var p = [], i, a;
    for (i = 0; i < 7; i++) { a = ((i * 3) % 7) / 7 * 2 * Math.PI - Math.PI / 2; p.push((42 * Math.cos(a)).toFixed(1) + ',' + (42 * Math.sin(a)).toFixed(1)); }
    return p.join(' ');
  }
  function retInterno(quem, emo) {
    var cara = quem === 'coro'
      ? '<svg class="sb-ret-coro" viewBox="-50 -50 100 100"><polygon points="' + estrela7() + '"/></svg>'
      : '<img class="sb-ret-img" src="' + A + 'ret-' + quem + '-' + emo + '-v2.webp" alt="" draggable="false">';
    return cara + (EMO_ICONE[emo] ? '<span class="sb-ret-emo">' + EMO_ICONE[emo] + '</span>' : '') + '<span class="sb-ret-nome">' + NOMES[quem] + '</span>';
  }
  function retFala(tag) {
    var coro = tag === 'coro', emo = coro ? '' : (tag || emoBase()), k = (coro ? 'coro' : 'teo') + emo;
    el.fala.classList.toggle('sb-fala-coro', coro);
    if (k !== falaRet) { falaRet = k; el.ret.innerHTML = retInterno(coro ? 'coro' : 'teo', emo); }
  }

  /* ══════════════════════════════════════════════════════════════
     FALA (balão com retrato e máquina de escrever)
  ══════════════════════════════════════════════════════════════ */
  function fala(linhas, aoFim) {
    falaFila = linhas.slice();
    falaFim = aoFim || null;
    el.fala.style.display = '';
    proximaLinha();
  }
  function proximaLinha() {
    clearInterval(falaTimer);
    if (!falaFila.length) {
      el.fala.style.display = 'none';
      falaRet = '';
      var f = falaFim; falaFim = null;
      if (f) f();
      return;
    }
    var l = falaFila.shift(), m = /^\{(\w+)\}/.exec(l);
    falaTexto = m ? l.slice(m[0].length) : l;
    retFala(m ? m[1] : '');
    if (m && m[1] === 'coro' && VOZ_CENTRAL[falaTexto]) som.voz(VOZ_CENTRAL[falaTexto]);
    falaPos = 0;
    el.falaTxt.textContent = '';
    el.fala.classList.remove('sb-pronta');
    el.fala.classList.add('sb-digita');
    falaTimer = setInterval(function () {
      falaPos += 2;
      el.falaTxt.textContent = falaTexto.slice(0, falaPos);
      if (falaPos >= falaTexto.length) { clearInterval(falaTimer); el.fala.classList.remove('sb-digita'); el.fala.classList.add('sb-pronta'); }
    }, 28);
  }
  function avancarFala() {
    if (falaPos < falaTexto.length) {
      clearInterval(falaTimer); falaPos = falaTexto.length;
      el.falaTxt.textContent = falaTexto; el.fala.classList.remove('sb-digita'); el.fala.classList.add('sb-pronta');
      return;
    }
    som.clique();
    proximaLinha();
  }

  /* ══════════════════════════════════════════════════════════════
     MODAL: documentos, arquivo, puzzles
  ══════════════════════════════════════════════════════════════ */
  var modalAoFechar = null;
  function abrirModal(html, cls, podeFechar, aoFechar) {
    el.caixa.className = 'sb-modal-caixa ' + (cls || '');
    el.caixa.innerHTML = html;
    el.modal.style.display = '';
    el.modal.setAttribute('data-fecha', podeFechar ? '1' : '0');
    modalAoFechar = aoFechar || null;
    var x = el.caixa.querySelector('.sb-x');
    if (x) x.addEventListener('click', function () { som.clique(); fecharModal(); });
  }
  function fecharModal() {
    el.modal.style.display = 'none';
    el.caixa.innerHTML = '';
    puz.parar();
    som.estatica(0);
    som.pararVoz();
    var f = modalAoFechar; modalAoFechar = null;
    if (f) f();
  }

  function doc(id, aoFechar) {
    var d = DOCS[id];
    var novo = S.docs.indexOf(id) < 0;
    if (novo) { S.docs.push(id); salvar(); atualizarBadge(true); }
    var corpo = esc(d.texto).replace(/\n/g, '<br>').replace(/\[\[g:(\w+)\]\]/g, function (_, k) { return glifoSvg(k); });
    if (id === 'audio_ingrid_final' && !S.flags.figura) { var fim0 = aoFechar; aoFechar = function () { if (fim0) fim0(); apareceFigura(); }; }
    var topo = d.tipo === 'audio'
      ? '<div class="sb-onda"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'
      : '';
    var dr = DOC_RET[id];
    var miolo = '<div class="sb-doc-tit">' + esc(d.titulo) + '</div>' + topo +
      '<div class="sb-doc-txt">' + corpo + '</div>' +
      (novo ? '<div class="sb-doc-novo">Guardado no Arquivo</div>' : '');
    abrirModal(
      '<button type="button" class="sb-x" aria-label="Fechar">✕</button>' +
      (dr ? '<div class="sb-doc-duas"><div class="sb-ret sb-doc-ret">' + retInterno(dr[0], dr[1]) + '</div><div class="sb-doc-corpo">' + miolo + '</div></div>' : miolo),
      'sb-doc sb-doc-' + d.tipo, true, aoFechar);
    if (d.tipo === 'audio') { som.fita(); som.voz(id); }
    else som.papel();
  }

  function atualizarBadge(novo) {
    el.badge.textContent = S.docs.length ? S.docs.length : '';
    if (novo) { el.badge.classList.remove('sb-pulsa'); void el.badge.offsetWidth; el.badge.classList.add('sb-pulsa'); }
  }

  function abrirArquivo() {
    if (ocupado()) return;
    var lista = S.docs.length
      ? S.docs.map(function (id) {
          var ic = { papel: 'fa-file', mao: 'fa-pencil', terminal: 'fa-desktop', audio: 'fa-microphone' }[DOCS[id].tipo] || 'fa-file';
          return '<button type="button" class="sb-arq-item" data-doc="' + id + '"><i class="fa ' + ic + '"></i> ' + esc(DOCS[id].titulo) + '</button>';
        }).join('')
      : '<div class="sb-arq-vazio">Nada aqui ainda. Documentos, gravações e telas que você encontrar ficam guardados no Arquivo.</div>';
    abrirModal(
      '<button type="button" class="sb-x" aria-label="Fechar">✕</button>' +
      '<div class="sb-doc-tit">Arquivo</div>' +
      '<div class="sb-arq-cont">' + S.docs.length + ' de ' + docsAte(S.ato || 1).length + ' arquivos encontrados</div>' +
      '<div class="sb-arq-lista">' + lista + '</div>', 'sb-arq', true);
    Array.prototype.forEach.call(el.caixa.querySelectorAll('[data-doc]'), function (b) {
      b.addEventListener('click', function () { som.clique(); var id = b.getAttribute('data-doc'); fecharModal(); doc(id, abrirArquivo); });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PUZZLES
  ══════════════════════════════════════════════════════════════ */
  var puz = { raf: 0, timers: [], parar: function () {
    if (puz.raf) cancelAnimationFrame(puz.raf); puz.raf = 0;
    som.elevador(0);
    puz.timers.forEach(clearInterval); puz.timers = [];
  } };

  /* ── Circuito do painel (girar peças até ligar a fonte ao gerador) ──
     Bits de conexão: N=1, L=2, S=4, O=8. Peças: I (reta), L (curva). */
  var COLS = 6, LINS = 4;
  var ROTA = [ // [col, lin, entrada, saída] — caminho da solução
    [0, 1, 8, 2], [1, 1, 8, 4], [1, 2, 1, 2], [2, 2, 8, 2], [3, 2, 8, 1],
    [3, 1, 4, 2], [4, 1, 8, 4], [4, 2, 1, 2], [5, 2, 8, 2]
  ];
  function girarBits(m, r) { for (var i = 0; i < r; i++) m = ((m << 1) | (m >> 3)) & 15; return m; }
  // Tabuleiro FIXO (sempre o mesmo, sorteio com semente) e o progresso
  // fica salvo em S.circ: sair do painel não embaralha de novo.
  function semente(n) { return function () { n = (n * 1103515245 + 12345) & 0x7fffffff; return n / 0x7fffffff; }; }
  function montarGrade() {
    var rnd = semente(1407), grade = [], i;
    for (i = 0; i < COLS * LINS; i++) grade.push({ base: rnd() < 0.5 ? 5 : 3, rot: Math.floor(rnd() * 4) });
    ROTA.forEach(function (p) {
      var m = p[2] | p[3];
      grade[p[1] * COLS + p[0]].base = (m === 5 || m === 10) ? 5 : 3;
    });
    while (energizar(grade).ok) grade[ROTA[4][1] * COLS + ROTA[4][0]].rot++;
    return grade;
  }
  function rotCerta(base, m) { var r = 0; while (girarBits(base, r) !== m && r < 4) r++; return r; }
  function abrirCircuito() {
    var grade = montarGrade();
    if (S.circ && S.circ.length === grade.length) grade.forEach(function (t, i) { t.rot = S.circ[i]; });
    var html = '<div class="sb-doc-tit">Painel de fusíveis — circuito principal</div>' +
      '<div class="sb-puz-dica">Toque nas peças para girar. Leve a energia da bateria (BAT) até o gerador (GER). Nem toda peça faz parte do caminho.</div>' +
      '<div class="sb-circ"><div class="sb-circ-fonte">BAT</div><div class="sb-circ-grade"></div><div class="sb-circ-alvo">GER</div></div>' +
      '<div class="sb-puz-botoes"><button type="button" class="sb-btn-sec sb-medir"><i class="fa fa-bolt"></i> Medir com o multímetro</button>' +
      '<button type="button" class="sb-btn-sec sb-x2">Sair do painel</button></div>';
    abrirModal(html, 'sb-puz', false);
    var gEl = el.caixa.querySelector('.sb-circ-grade');
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    var tiles = grade.map(function (t) {
      var b = h('button', 'sb-peca', svgPeca(t.base));
      b.type = 'button';
      t.ang = t.rot * 90;
      b.style.transform = 'rotate(' + t.ang + 'deg)';
      b.addEventListener('click', function () {
        if (gEl.classList.contains('sb-ok')) return;
        t.rot = (t.rot + 1) % 4; t.ang += 90;
        b.style.transform = 'rotate(' + t.ang + 'deg)';
        b.classList.remove('sb-medida');
        som.giro();
        S.circ = grade.map(function (x) { return x.rot; });
        salvar();
        atualizar();
      });
      gEl.appendChild(b);
      return b;
    });
    // Dica: o multímetro aponta a primeira peça do caminho que está virada errado.
    el.caixa.querySelector('.sb-medir').addEventListener('click', function () {
      som.clique();
      tiles.forEach(function (b) { b.classList.remove('sb-medida'); });
      for (var i = 0; i < ROTA.length; i++) {
        var p = ROTA[i], idx = p[1] * COLS + p[0], t = grade[idx];
        if (girarBits(t.base, t.rot) !== (p[2] | p[3])) {
          tiles[idx].classList.add('sb-medida');
          var falta = (rotCerta(t.base, p[2] | p[3]) - t.rot + 4) % 4;
          var msg = el.caixa.querySelector('.sb-puz-dica');
          msg.textContent = 'O multímetro apita nesta peça: gire ' + (falta === 1 ? '1 vez' : falta + ' vezes') + '.';
          return;
        }
      }
    });
    var fonteEl = el.caixa.querySelector('.sb-circ-fonte'), alvoEl = el.caixa.querySelector('.sb-circ-alvo');
    function atualizar() {
      var r = energizar(grade);
      tiles.forEach(function (b, idx) { b.classList.toggle('sb-luz', !!r.luz[idx]); });
      fonteEl.classList.add('sb-luz');
      alvoEl.classList.toggle('sb-luz', r.ok);
      if (r.ok) {
        gEl.classList.add('sb-ok');
        som.energia();
        setTimeout(function () {
          fecharModal();
          tirar('fusivel');
          flag('energia');
          el.fade.classList.add('sb-flash');
          setTimeout(function () { el.fade.classList.remove('sb-flash'); }, 700);
          desenharCena();
          som.ambiente('dentro', S.cena);
          setTimeout(function () { som.tocar('luzes', 0.7); }, 1300);
          fala(['O motor tossiu, engasgou... e pegou.', 'As luzes acenderam. Lá longe, a estação inteira voltou a zumbir.', 'Agora o rádio.']);
        }, 900);
      }
    }
    atualizar();
  }
  function energizar(grade) {
    var luz = {}, fila = [], ok = false;
    function m(c, l) { var t = grade[l * COLS + c]; return girarBits(t.base, t.rot); }
    if (m(0, 1) & 8) { luz[1 * COLS + 0] = true; fila.push([0, 1]); }
    var viz = [[1, 0, -1, 4], [2, 1, 0, 8], [4, 0, 1, 1], [8, -1, 0, 2]];
    while (fila.length) {
      var p = fila.shift(), mm = m(p[0], p[1]);
      if (p[0] === COLS - 1 && p[1] === 2 && (mm & 2)) ok = true;
      for (var k = 0; k < 4; k++) {
        var v = viz[k];
        if (!(mm & v[0])) continue;
        var nc = p[0] + v[1], nl = p[1] + v[2];
        if (nc < 0 || nc >= COLS || nl < 0 || nl >= LINS) continue;
        var idx = nl * COLS + nc;
        if (luz[idx]) continue;
        if (m(nc, nl) & v[3]) { luz[idx] = true; fila.push([nc, nl]); }
      }
    }
    return { luz: luz, ok: ok };
  }
  function svgPeca(base) {
    var d = base === 5 ? 'M50 0 V100' : 'M50 0 V50 H100';
    return '<svg viewBox="0 0 100 100"><path class="sb-fio-f" d="' + d + '"/><path class="sb-fio" d="' + d + '"/><circle cx="50" cy="50" r="9" class="sb-no"/></svg>';
  }

  /* ── Frequência do rádio ──────────────────────────────────────
     O sinal escondido NÃO fica parado: a fase e a força dele oscilam o
     tempo todo. São três controles (frequência, fase e ganho) e o
     jogador precisa ACOMPANHAR o sinal até a barra de trava encher —
     ela enche com o sinal casado e esvazia quando escapa. O mostrador
     não mostra o número enquanto está longe (a pista do 6,3 está no
     diário de rádio do Kazuo). Conforme a trava enche, a mensagem
     aparece, cada vez menos embaralhada. */
  var MSG_RADIO = '...doze... doze... treze... você chegou...';
  function embaralhar(txt, q) {
    var lixo = '#%&*@$?!/\\|~^';
    return txt.split('').map(function (ch) {
      if (ch === ' ' || ch === '.') return ch;
      return Math.random() < q ? ch : lixo[Math.floor(Math.random() * lixo.length)];
    }).join('');
  }
  function abrirFrequencia() {
    var F0 = 6.3, P0 = 2.2, G0 = 0.6;
    var cur = { f: 2.4 + Math.random() * 1.2, p: 0.3 + Math.random(), g: 0.25 };
    var trava = 0, t = 0, feito = false, msgT = 0;
    var html = '<button type="button" class="sb-x sb-x2" aria-label="Desligar o rádio">✕</button>' +
      '<div class="sb-doc-tit">Rádio principal — sintonia</div>' +
      '<div class="sb-puz-dica">O sinal (ciano) se mexe. Ajuste a sua onda (branca) e acompanhe até a trava encher.</div>' +
      '<canvas class="sb-freq-cv" width="900" height="300"></canvas>' +
      '<div class="sb-freq-msg">&nbsp;</div>' +
      '<div class="sb-freq-ctrl">' +
        '<div class="sb-freq-grupo"><span>Frequência</span><button type="button" data-k="f" data-d="-1">◀</button><b class="sb-freq-fv"></b><button type="button" data-k="f" data-d="1">▶</button></div>' +
        '<div class="sb-freq-grupo"><span>Fase</span><button type="button" data-k="p" data-d="-1">◀</button><b class="sb-freq-pv"></b><button type="button" data-k="p" data-d="1">▶</button></div>' +
        '<div class="sb-freq-grupo"><span>Ganho</span><button type="button" data-k="g" data-d="-1">◀</button><b class="sb-freq-gv"></b><button type="button" data-k="g" data-d="1">▶</button></div>' +
      '</div>' +
      '<div class="sb-freq-medidor"><div class="sb-freq-barra"></div><span class="sb-freq-pct"></span></div>';
    abrirModal(html, 'sb-puz sb-puz-freq', false);
    var cv = el.caixa.querySelector('.sb-freq-cv'), ctx = cv.getContext('2d');
    var fv = el.caixa.querySelector('.sb-freq-fv'), pv = el.caixa.querySelector('.sb-freq-pv'), gv = el.caixa.querySelector('.sb-freq-gv');
    var barra = el.caixa.querySelector('.sb-freq-barra'), pct = el.caixa.querySelector('.sb-freq-pct');
    var msgEl = el.caixa.querySelector('.sb-freq-msg');
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    Array.prototype.forEach.call(el.caixa.querySelectorAll('[data-k]'), function (b) {
      var k = b.getAttribute('data-k'), dd = +b.getAttribute('data-d');
      var passo = function () {
        if (feito) return;
        if (k === 'f') cur.f = Math.max(1, Math.min(9.9, Math.round((cur.f + dd * 0.1) * 10) / 10));
        else if (k === 'p') cur.p = (cur.p + dd * 0.07 + Math.PI * 2) % (Math.PI * 2);
        else cur.g = Math.max(0.1, Math.min(1, Math.round((cur.g + dd * 0.04) * 100) / 100));
        som.tique();
      };
      var tm = 0, r = 0;
      var parar = function () { clearTimeout(tm); clearInterval(r); };
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); passo(); parar();
        tm = setTimeout(function () { r = setInterval(passo, 60); puz.timers.push(r); }, 280);
      });
      b.addEventListener('pointerup', parar); b.addEventListener('pointerleave', parar); b.addEventListener('pointercancel', parar);
    });
    // alvo que se move: fase e força oscilam em ritmos diferentes
    function alvo() {
      return { f: F0, p: (P0 + 0.75 * Math.sin(t * 0.55) + 0.35 * Math.sin(t * 1.3) + Math.PI * 4) % (Math.PI * 2),
               g: G0 + 0.28 * Math.sin(t * 0.41 + 1) };
    }
    function casamento(a) {
      var df = Math.abs(cur.f - a.f);
      var dp = Math.abs(((cur.p - a.p) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      var mp = Math.max(0, 1 - dp / Math.PI), mg = Math.max(0, 1 - Math.abs(cur.g - a.g) / 0.6);
      if (df < 0.05) return 0.4 + 0.35 * mp + 0.25 * mg;
      return Math.max(0, 1 - df / 2.5) * 0.5 * (0.5 + 0.5 * mp);
    }
    var ult = 0;
    function quadro(ts) {
      var dt = ult ? Math.min(0.05, (ts - ult) / 1000) : 0.016; ult = ts;
      if (!feito) t += dt;
      var a = alvo(), c = casamento(a);
      var W = cv.width, H = cv.height;
      ctx.fillStyle = '#04110f'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(80,255,220,.07)'; ctx.lineWidth = 1;
      for (var gx = 0; gx <= W; gx += 75) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (var gy = 0; gy <= H; gy += 50) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      var ruido = 1 - c;
      function onda(f, p, g, cor, lw, sujo) {
        ctx.beginPath();
        for (var x = 0; x <= W; x += 4) {
          var y = H / 2 + Math.sin(x / W * Math.PI * 2 * f / 2 + p) * H * 0.4 * g;
          if (sujo) y += (Math.random() - 0.5) * H * 0.22 * sujo;
          if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.stroke();
      }
      ctx.shadowBlur = 14; ctx.shadowColor = '#22d3ee';
      onda(a.f, a.p, a.g, 'rgba(34,211,238,' + (0.3 + 0.45 * c) + ')', 5, ruido * 0.9);
      ctx.shadowColor = '#fff';
      onda(cur.f, cur.p, cur.g, 'rgba(255,255,255,.92)', 3, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200,255,240,' + (0.08 * ruido) + ')';
      for (var n = 0; n < 160 * ruido; n++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      // mostrador: o número só aparece quando a agulha chega perto
      fv.textContent = Math.abs(cur.f - F0) <= 0.6 ? cur.f.toFixed(1).replace('.', ',') + ' MHz' : '–,– MHz';
      pv.textContent = Math.round(cur.p / (Math.PI * 2) * 360) + '°';
      gv.textContent = Math.round(cur.g * 100) + '%';
      som.estatica(feito ? 0 : ruido);
      if (!feito) {
        trava = c >= 0.88 ? Math.min(1, trava + dt / 4) : Math.max(0, trava - dt / 5);
        barra.style.width = Math.round(trava * 100) + '%';
        barra.classList.toggle('sb-quase', c >= 0.88);
        pct.textContent = c >= 0.88 ? 'Travando o sinal... ' + Math.round(trava * 100) + '%' : 'Sinal ' + Math.round(c * 100) + '%';
        msgT -= dt;
        if (msgT <= 0) { msgT = 0.12; msgEl.textContent = trava > 0.02 ? embaralhar(MSG_RADIO, 0.15 + trava * 0.85) : ' '; }
        if (trava >= 1) {
          feito = true;
          som.estatica(0);
          som.tocar('sinal-ok', 0.8, som.energia);
          msgEl.textContent = MSG_RADIO;
          pct.textContent = 'Sinal travado — decodificando...';
          setTimeout(function () {
            fecharModal();
            flag('radioOk');
            doc('sinal', fimDoAto);
          }, 1600);
        }
      }
      puz.raf = requestAnimationFrame(quadro);
    }
    puz.raf = requestAnimationFrame(quadro);
  }

  /* ── Elevador (Ato 2): descer e parar no Subsolo Zero ──────────
     Segurar a alavanca acelera; soltar freia (o freio é mais fraco
     que o motor, então é preciso soltar ANTES). Passar de 110 m/s
     aquece o cabo e trava o freio de emergência. Parou dentro da
     faixa de 640 m ± 12: chegou. Passou muito: o elevador sobe de
     volta um trecho. */
  var puzInfo = null;   // leitura para testes (_puz)
  function abrirElevador() {
    var ALVO = 640, FAIXA = 12, VMAX = 150, LIMITE = 110;
    var prof = 0, v = 0, calor = 0, segurando = false, travado = 0, parado = 0, feito = false;
    var html = '<button type="button" class="sb-x sb-x2" aria-label="Sair">✕</button>' +
      '<div class="sb-doc-tit">Elevador de carga</div>' +
      '<div class="sb-puz-dica">Segure a alavanca para descer, solte para frear. Pare na faixa verde dos 640 m. Acima de 110 m/s o cabo esquenta.</div>' +
      '<div class="sb-elev">' +
        '<canvas class="sb-elev-cv" width="900" height="300"></canvas>' +
        '<button type="button" class="sb-elev-alav"><span>ALAVANCA</span><small>segure</small></button>' +
      '</div>' +
      '<div class="sb-freq-medidor"><div class="sb-freq-barra"></div><span class="sb-freq-pct"></span></div>';
    abrirModal(html, 'sb-puz sb-puz-elev', false);
    var cv = el.caixa.querySelector('.sb-elev-cv'), ctx = cv.getContext('2d');
    var alav = el.caixa.querySelector('.sb-elev-alav');
    var barra = el.caixa.querySelector('.sb-freq-barra'), pct = el.caixa.querySelector('.sb-freq-pct');
    var dica = el.caixa.querySelector('.sb-puz-dica'), dicaBase = dica.textContent, dicaT = 0;
    function avisar(t) { dica.textContent = t; dica.classList.add('sb-aviso'); clearTimeout(dicaT); dicaT = setTimeout(function () { dica.textContent = dicaBase; dica.classList.remove('sb-aviso'); }, 3200); }
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    var on = function (e) { e.preventDefault(); if (!travado && !feito) { segurando = true; alav.classList.add('sb-on'); som.tique(); } };
    var off = function () { segurando = false; alav.classList.remove('sb-on'); };
    alav.addEventListener('pointerdown', on); alav.addEventListener('pointerup', off);
    alav.addEventListener('pointerleave', off); alav.addEventListener('pointercancel', off);
    var ult = 0;
    function quadro(ts) {
      var dt = ult ? Math.min(0.05, (ts - ult) / 1000) : 0.016; ult = ts;
      if (!feito) {
        if (travado > 0) { travado -= dt; v = Math.max(0, v - 160 * dt); if (travado <= 0) calor = 0; }
        else if (segurando) v = Math.min(VMAX, v + 34 * dt);
        else v = Math.max(0, v - 42 * dt);
        prof += v * dt;
        calor = v > LIMITE ? Math.min(1, calor + dt * 0.9) : Math.max(0, calor - dt * 0.4);
        if (calor >= 1 && travado <= 0) {
          travado = 2.2; segurando = false; alav.classList.remove('sb-on');
          som.tocar('elevador-freio', 0.9, function () { som.tocar('porta', 0.8); });
          avisar('O freio de emergência travou com um tranco. O cabo esquentou demais.');
        }
        if (prof > ALVO + 60 && v < 30) {
          som.tocar('elevador-freio', 0.6, function () { som.tocar('gerador-liga', 0.5); });
          avisar('Passei do andar. O elevador subiu de volta um trecho, rangendo.');
          prof = ALVO - 260; v = 0;
        }
        som.elevador(travado > 0 ? 0 : Math.min(1, v / VMAX));
        var dentro = Math.abs(prof - ALVO) <= FAIXA && v < 3;
        parado = dentro ? parado + dt : 0;
        if (parado > 0.6) {
          feito = true; flag('desceu'); som.elevador(0);
          som.tocar('sinal-ok', 0.5);
          setTimeout(function () {
            fecharModal();
            fala(['O elevador parou com um baque. Na parede do poço, pintado à mão: SUBSOLO ZERO.'], function () { ir('servico'); });
          }, 900);
        }
      }
      puzInfo = { prof: prof, v: v, calor: calor };
      // desenho: poço com marcas de profundidade passando
      var W = cv.width, H = cv.height;
      ctx.fillStyle = '#060b12'; ctx.fillRect(0, 0, W, H);
      var esc = 1.2, cy = H / 2;
      for (var m = Math.floor((prof - 140) / 20) * 20; m < prof + 140; m += 20) {
        if (m < 0) continue;
        var y = cy + (m - prof) * esc;
        ctx.strokeStyle = m % 100 === 0 ? 'rgba(148,163,184,.55)' : 'rgba(148,163,184,.18)';
        ctx.lineWidth = m % 100 === 0 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(m % 100 === 0 ? 150 : 110, y); ctx.stroke();
        if (m % 100 === 0) { ctx.fillStyle = 'rgba(148,163,184,.7)'; ctx.font = '600 18px ui-monospace,monospace'; ctx.fillText(m + ' m', 160, y + 6); }
      }
      var ya = cy + (ALVO - FAIXA - prof) * esc, yb = cy + (ALVO + FAIXA - prof) * esc;
      ctx.fillStyle = 'rgba(34,197,94,.22)'; ctx.fillRect(40, ya, W - 80, yb - ya);
      ctx.strokeStyle = 'rgba(74,222,128,.8)'; ctx.strokeRect(40, ya, W - 80, yb - ya);
      ctx.fillStyle = '#86efac'; ctx.font = '800 20px ui-monospace,monospace'; ctx.fillText('SUBSOLO ZERO — 640 m', W - 330, ya - 8);
      // régua da descida inteira (0–800 m) à esquerda
      var rx = 16, rt = 16, rb = H - 16, k = (rb - rt) / 800;
      ctx.fillStyle = 'rgba(148,163,184,.12)'; ctx.fillRect(rx, rt, 10, rb - rt);
      ctx.fillStyle = 'rgba(74,222,128,.85)'; ctx.fillRect(rx - 3, rt + (ALVO - FAIXA) * k, 16, 2 * FAIXA * k);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(rx - 5, rt + Math.min(800, prof) * k - 2, 20, 4);
      // a cabine (linha do meio)
      ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(44, cy); ctx.lineTo(W - 30, cy); ctx.stroke();
      ctx.fillStyle = '#f8fafc'; ctx.font = '800 34px ui-monospace,monospace';
      ctx.fillText(Math.round(prof) + ' m', W - 230, cy - 18);
      ctx.font = '600 20px ui-monospace,monospace';
      ctx.fillStyle = v > LIMITE ? '#f87171' : '#a5f3fc';
      ctx.fillText(Math.round(v) + ' m/s', W - 230, cy + 34);
      barra.style.width = Math.round(calor * 100) + '%';
      barra.classList.toggle('sb-calor', calor > 0.01);
      pct.textContent = travado > 0 ? 'FREIO DE EMERGÊNCIA' : (calor > 0.01 ? 'Cabo esquentando ' + Math.round(calor * 100) + '%' : 'Temperatura do cabo: normal');
      puz.raf = requestAnimationFrame(quadro);
    }
    puz.raf = requestAnimationFrame(quadro);
  }

  /* ── Caixa de junção (Ato 2): ligar 4 fios aos bornes certos ────
     Toca no fio e depois no borne. "Testar" diz quantos estão certos
     (a ordem está no e-mail do Kazuo, mas dá pra deduzir testando). */
  var FIOS = [
    { id: 'vermelho', cor: '#ef4444', certo: 'O' },
    { id: 'azul', cor: '#3b82f6', certo: 'X' },
    { id: 'amarelo', cor: '#facc15', certo: 'Q' },
    { id: 'branco', cor: '#f1f5f9', certo: 'T' }
  ];
  var BORNES = [{ id: 'T', s: '△' }, { id: 'X', s: '✕' }, { id: 'O', s: '○' }, { id: 'Q', s: '□' }];
  function abrirFios() {
    var lig = {}, sel = null, tentativas = 0;
    var html = '<button type="button" class="sb-x sb-x2" aria-label="Sair">✕</button>' +
      '<div class="sb-doc-tit">Caixa de junção — corredor de serviço</div>' +
      '<div class="sb-puz-dica">Toque num fio e depois num borne. Ligue os quatro e teste.</div>' +
      '<div class="sb-fios">' +
        '<div class="sb-fios-col">' + FIOS.map(function (f) { return '<button type="button" class="sb-fio-b" data-f="' + f.id + '"><i style="background:' + f.cor + '"></i>' + f.id + '</button>'; }).join('') + '</div>' +
        '<svg class="sb-fios-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>' +
        '<div class="sb-fios-col">' + BORNES.map(function (b) { return '<button type="button" class="sb-borne" data-b="' + b.id + '">' + b.s + '</button>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="sb-puz-botoes"><button type="button" class="sb-btn" data-a="testar">Testar</button><button type="button" class="sb-btn-sec" data-a="limpar">Soltar tudo</button></div>';
    abrirModal(html, 'sb-puz sb-puz-fios', false);
    var svg = el.caixa.querySelector('.sb-fios-svg'), msg = el.caixa.querySelector('.sb-puz-dica');
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    function desenhar() {
      var linhas = '';
      FIOS.forEach(function (f, i) {
        if (!lig[f.id]) return;
        var j = BORNES.map(function (b) { return b.id; }).indexOf(lig[f.id]);
        var y1 = 12.5 + i * 25, y2 = 12.5 + j * 25;
        linhas += '<path d="M0 ' + y1 + ' C50 ' + y1 + ' 50 ' + y2 + ' 100 ' + y2 + '" stroke="' + f.cor + '" stroke-width="3" fill="none" vector-effect="non-scaling-stroke"/>';
      });
      svg.innerHTML = linhas;
      Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-fio-b'), function (b) {
        b.classList.toggle('sb-sel', b.getAttribute('data-f') === sel);
        b.classList.toggle('sb-ok', !!lig[b.getAttribute('data-f')]);
      });
      Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-borne'), function (b) {
        var usado = false; for (var k in lig) if (lig[k] === b.getAttribute('data-b')) usado = true;
        b.classList.toggle('sb-ok', usado);
      });
    }
    Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-fio-b'), function (b) {
      b.addEventListener('click', function () { som.tique(); sel = b.getAttribute('data-f'); desenhar(); });
    });
    Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-borne'), function (b) {
      b.addEventListener('click', function () {
        if (!sel) { msg.textContent = 'Escolha um fio primeiro.'; return; }
        var alvo = b.getAttribute('data-b');
        for (var k in lig) if (lig[k] === alvo) delete lig[k];
        lig[sel] = alvo; sel = null; som.giro(); desenhar();
      });
    });
    el.caixa.querySelector('[data-a="limpar"]').addEventListener('click', function () { som.clique(); lig = {}; sel = null; desenhar(); });
    el.caixa.querySelector('[data-a="testar"]').addEventListener('click', function () {
      if (Object.keys(lig).length < 4) { msg.textContent = 'Faltam fios. Ligue os quatro antes de testar.'; som.clique(); return; }
      tentativas++;
      var certos = FIOS.filter(function (f) { return lig[f.id] === f.certo; }).length;
      if (certos === 4) {
        som.tocar('faisca', 0.6); som.energia();
        msg.textContent = 'Energia restabelecida no corredor.';
        setTimeout(function () {
          fecharModal(); flag('energia2'); som.tocar('luzes', 0.7);
          fala(['As luzes do corredor firmaram. Lá no fundo, o leitor da porta de segurança acendeu.']);
        }, 900);
      } else {
        som.tocar('faisca', 0.9, function () { som.tocar('porta', 0.4); });
        el.caixa.classList.remove('sb-tremer'); void el.caixa.offsetWidth; el.caixa.classList.add('sb-tremer');
        msg.textContent = 'Faísca! ' + certos + ' de 4 no lugar certo. Desliguei tudo de novo.' +
          (tentativas >= 3 && S.docs.indexOf('emails') < 0 ? ' Alguém deve ter anotado essa ordem.' : '');
        lig = {}; desenhar();
      }
    });
    desenhar();
  }

  /* ── Senha de 4 dígitos (terminal do Kazuo) ───────────────────── */
  function abrirSenha() {
    var dig = '';
    var html = '<button type="button" class="sb-x sb-x2" aria-label="Sair">✕</button>' +
      '<div class="sb-doc-tit">Terminal — k.ren</div>' +
      '<div class="sb-puz-dica">Dica de senha: "a hora em que ela acorda"</div>' +
      '<div class="sb-senha-vis">____</div>' +
      '<div class="sb-teclado">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map(function (t) {
        return '<button type="button" class="sb-tecla" data-t="' + t + '">' + (t === 'C' ? '⌫' : t) + '</button>';
      }).join('') + '</div>';
    abrirModal(html, 'sb-puz sb-puz-senha', false);
    var vis = el.caixa.querySelector('.sb-senha-vis'), msg = el.caixa.querySelector('.sb-puz-dica');
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    function mostrar() { vis.textContent = (dig + '____').slice(0, 4).split('').join(' '); }
    Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-tecla'), function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-t');
        som.tique();
        if (t === 'C') dig = dig.slice(0, -1);
        else if (t === 'OK') {
          if (dig === '0312') {
            som.tocar('sinal-ok', 0.6); vis.textContent = 'ACESSO LIBERADO';
            setTimeout(function () { fecharModal(); flag('logado'); doc('emails'); }, 700);
            return;
          }
          vis.textContent = 'SENHA INCORRETA'; dig = '';
          el.caixa.classList.remove('sb-tremer'); void el.caixa.offsetWidth; el.caixa.classList.add('sb-tremer');
          msg.textContent = 'Dica de senha: "a hora em que ela acorda" (formato HHMM)';
          setTimeout(mostrar, 900); return;
        } else if (dig.length < 4) dig += t;
        mostrar();
      });
    });
    mostrar();
  }

  /* ── A estrela (porta de pedra): desenhar a heptagrama {7/3} ─────
     Sete pontas num círculo; começa na de cima e pula de 3 em 3 (para
     qualquer lado, mas sempre o mesmo). Erro: apaga tudo. */
  function abrirEstrela() {
    var seq = [], passo = 0;
    var pts = [];
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 7;
      pts.push({ x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) });
    }
    var html = '<button type="button" class="sb-x sb-x2" aria-label="Sair">✕</button>' +
      '<div class="sb-doc-tit">A estrela</div>' +
      '<div class="sb-puz-dica">Toque nas pontas, na ordem certa, para desenhar a estrela.</div>' +
      '<div class="sb-estrela"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="sb-est-aro"/><g class="sb-est-linhas"></g>' +
      pts.map(function (p, k) { return '<circle cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="5.2" class="sb-est-pt" data-p="' + k + '"/>'; }).join('') +
      '</svg></div>';
    abrirModal(html, 'sb-puz sb-puz-estrela', false);
    var linhasG = el.caixa.querySelector('.sb-est-linhas'), msg = el.caixa.querySelector('.sb-puz-dica');
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    function desenhar(cls) {
      var l = '';
      for (var k = 1; k < seq.length; k++) {
        var a = pts[seq[k - 1]], b = pts[seq[k]];
        l += '<line x1="' + a.x.toFixed(2) + '" y1="' + a.y.toFixed(2) + '" x2="' + b.x.toFixed(2) + '" y2="' + b.y.toFixed(2) + '" class="sb-est-l ' + (cls || '') + '"/>';
      }
      linhasG.innerHTML = l;
      Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-est-pt'), function (c) {
        c.classList.toggle('sb-on', seq.indexOf(+c.getAttribute('data-p')) >= 0);
      });
    }
    function errou() {
      desenhar('sb-erro'); som.tocar('porta', 0.4);
      msg.textContent = 'As linhas piscaram em vermelho e apagaram.';
      setTimeout(function () { seq = []; passo = 0; desenhar(); }, 700);
    }
    Array.prototype.forEach.call(el.caixa.querySelectorAll('.sb-est-pt'), function (c) {
      c.addEventListener('click', function () {
        var p = +c.getAttribute('data-p');
        if (!seq.length) {
          if (p !== 0) { msg.textContent = 'Nada acontece. Talvez precise começar por outra ponta.'; som.clique(); return; }
          seq.push(p); som.tique(); desenhar(); return;
        }
        var ant = seq[seq.length - 1], dif = (p - ant + 7) % 7;
        if (!passo) { if (dif === 3 || dif === 4) passo = dif; else { seq.push(p); return errou(); } }
        if (dif !== passo) { seq.push(p); return errou(); }
        seq.push(p); som.giro(); desenhar();
        if (seq.length === 8) {
          desenhar('sb-ok'); som.tocar('revelacao', 0.6);
          msg.textContent = 'A estrela inteira acendeu.';
          setTimeout(function () {
            fecharModal(); flag('portaAberta'); desenharCena(); som.tocar('porta-pedra', 0.95, function () { som.tocar('porta', 0.9); });
            el.fade.classList.add('sb-flash'); setTimeout(function () { el.fade.classList.remove('sb-flash'); }, 700);
            fala(['A pedra rolou pro lado, pesada, e o chão tremeu sob os meus pés.', 'Lá dentro, uma luz azul. E calor.']);
          }, 1300);
        }
      });
    });
    desenhar();
  }

  /* ══════════════════════════════════════════════════════════════
     TELAS: título e fim do ato
  ══════════════════════════════════════════════════════════════ */
  var NOMES_ATO = { 1: 'Ato 1 — O Muro Branco', 2: 'Ato 2 — Subsolo Zero', 3: 'Ato 3 — O Cofre Pré-Diluviano' };
  var ULTIMO_ATO = 3;   // atos prontos
  function telaTitulo() {
    var save = carregar(), temSave = !!save;
    progRegistrar();   // guarda o ato já alcançado antes de qualquer "refazer ato"
    el.bg.src = el.amb.src = A + 'heliponto-v1.webp';
    el.pontos.innerHTML = ''; el.saidas.innerHTML = ''; el.inv.innerHTML = '';
    el.local.textContent = '';
    ligarNeve(true);
    el.titulo.innerHTML =
      '<div class="sb-tit-nome">SINAL BRANCO</div>' +
      '<div class="sb-tit-sub">' + NOMES_ATO[(save && save.ato) || 1] + '</div>' +
      '<div class="sb-tit-botoes">' +
        (temSave ? '<button type="button" class="sb-btn" data-t="continuar">Continuar</button>' : '') +
        (temSave && progMax() >= 2 ? '<button type="button" class="sb-btn sb-btn-sec" data-t="atos">Escolher ato</button>' : '') +
        '<button type="button" class="sb-btn' + (temSave ? ' sb-btn-sec' : '') + '" data-t="novo">Novo jogo</button>' +
      '</div>' +
      '<div class="sb-tit-nota">Use fones de ouvido. Toque nas coisas da cena para examinar.</div>';
    el.titulo.style.display = '';
    partida(false);
    Array.prototype.forEach.call(el.titulo.querySelectorAll('[data-t]'), function (b) {
      b.addEventListener('click', function () {
        som.destravar(); som.clique();
        if (b.getAttribute('data-t') === 'atos') { telaAtos(); return; }
        if (b.getAttribute('data-t') === 'novo') {
          if (temSave && !confirmarNovo(b)) return;
          S = novoEstado();
          progCache = 0; try { localStorage.removeItem(PROG); } catch (e) {}
        } else S = carregar() || novoEstado();
        if (!S.ato) S.ato = 1;
        comecar();
      });
    });
  }
  // Refazer um ato: apaga o progresso dele e dos seguintes; os arquivos achados continuam no Arquivo.
  function prepararAto(n) {
    S = carregar() || novoEstado();
    for (var k = n; k <= ULTIMO_ATO; k++) {
      (ATO_FLAGS[k] || []).forEach(function (f) { delete S.flags[f]; });
      (ATO_CENAS[k] || []).forEach(function (c) {
        delete S.chegou[c];
        Object.keys(S.vistos).forEach(function (v) { if (v.indexOf(c + '.') === 0) delete S.vistos[v]; });
      });
    }
    if (n >= 2) { S.flags.energia = S.flags.radioOk = S.flags.atoFim = true; }
    if (n >= 3) S.flags.ato2Fim = true;   // o Ato 1 conta como cumprido
    S.ato = n;
    S.itens = n >= 2 ? ['lanterna'] : [];
    if (n === 1) { S.cena = 'heliponto'; S.flags.intro = true; }
    salvar();
  }
  function telaAtos() {
    var max = progMax(), sv = carregar(), atual = (sv && sv.ato) || 1, l = '';
    for (var n = 1; n <= max; n++) {
      l += '<button type="button" class="sb-btn sb-btn-sec sb-ato-b" data-ato="' + n + '">' + NOMES_ATO[n] +
        '<small>' + (n < max ? 'concluído' : n === atual ? 'em andamento' : 'novo') + '</small></button>';
    }
    el.titulo.innerHTML =
      '<div class="sb-tit-sub">Escolher ato</div>' +
      '<div class="sb-atos">' + l + '</div>' +
      '<div class="sb-tit-botoes"><button type="button" class="sb-btn sb-btn-sec" data-t="voltar">Voltar</button></div>' +
      '<div class="sb-tit-nota">Os arquivos que você já achou continuam no Arquivo. Refazer um ato apaga só o progresso dele e dos seguintes.</div>';
    el.titulo.querySelector('[data-t="voltar"]').addEventListener('click', function () { som.clique(); telaTitulo(); });
    Array.prototype.forEach.call(el.titulo.querySelectorAll('[data-ato]'), function (b) {
      b.addEventListener('click', function () {
        som.destravar(); som.clique();
        var n = +b.getAttribute('data-ato');
        if (b.getAttribute('data-ok') !== '1') {
          Array.prototype.forEach.call(el.titulo.querySelectorAll('[data-ato]'), function (o) { o.removeAttribute('data-ok'); o.firstChild.nodeValue = NOMES_ATO[+o.getAttribute('data-ato')]; });
          b.setAttribute('data-ok', '1'); b.firstChild.nodeValue = 'Refazer o Ato ' + n + '? Toque de novo';
          return;
        }
        prepararAto(n);
        if (n === 1) comecar(); else iniciarAto(n);
      });
    });
  }
  function confirmarNovo(b) {
    if (b.getAttribute('data-ok') === '1') return true;
    b.setAttribute('data-ok', '1');
    b.textContent = 'Apagar o progresso? Toque de novo';
    return false;
  }
  // Ordem de serviço que abre o jogo: o jogador fica sabendo quem é e por que está ali.
  var CONTRATO = 'CONSÓRCIO POLAR INTERNACIONAL\n\n' +
    'Contratado: Téo Marin\nFunção: técnico de telecomunicações\n' +
    'Destino: Estação Halvorsen, Antártica interior\nPessoal na base: 12 pesquisadores\n\n' +
    'Missão: restabelecer a transmissão de dados da estação.\n' +
    'Prazo: 3 dias. Retirada de helicóptero, se o tempo deixar.\n\n' +
    'Cláusula 7 — Sigilo. Tudo o que o técnico vir ou ouvir na estação pertence ao Consórcio e não será comentado com terceiros.';
  function abrirContrato(aoFechar) {
    som.papel();
    abrirModal(
      '<div class="sb-doc-duas"><div class="sb-ret sb-doc-ret">' + retInterno('teo', 'neutro') + '</div><div class="sb-doc-corpo">' +
      '<div class="sb-doc-tit">Ordem de serviço nº 1014</div>' +
      '<div class="sb-doc-txt">' + esc(CONTRATO).replace(/\n/g, '<br>') + '</div>' +
      '<button type="button" class="sb-btn sb-contrato-ok" data-i="embarcar">Aceitar o serviço</button></div></div>',
      'sb-doc sb-doc-papel sb-contrato', false, aoFechar);
    el.caixa.querySelector('[data-i="embarcar"]').addEventListener('click', function () { som.clique(); fecharModal(); });
  }
  function comecar() {
    el.titulo.style.display = 'none';
    tUltimo = Date.now();
    partida(true);
    desenharInv();
    atualizarBadge(false);
    if (S.ato === 1 && S.flags.atoFim) { telaFimAto(1); return; }
    if (S.ato === 2 && S.flags.ato2Fim) { telaFimAto(2); return; }
    if (S.ato === 3 && S.flags.ato3Fim) { telaFimAto(3); return; }
    if (S.ato === 1 && !S.chegou.heliponto && !S.flags.intro) { S.cena = 'voo'; S.chegou.voo = false; }
    ir(S.cena);
  }
  function fimDoAto() {
    som.tocar('revelacao', 0.9);
    fala(['{tenso}Treze. Doze da equipe... e eu.', '{confuso}E aquela voz era da Ingrid. Igual à da gravação.', '{tenso}Debaixo do piso, alguma coisa começou a vibrar.'], function () {
      flag('atoFim'); telaFimAto(1);
    });
  }
  function fimDoAto2() {
    som.tocar('revelacao', 0.9);
    fala(['Treze novos ouvintes.', '{tenso}Ninguém morreu aqui embaixo, eu entendi. Eles só... começaram a escutar também.', '{tenso}E ela está esperando o décimo quarto.'], function () {
      radio(['Bem-vindo, Téo. Agora desça.'], function () { flag('ato2Fim'); telaFimAto(2); });
    });
  }
  function iniciarAto(n) { if (n === 2) iniciarAto2(); else if (n === 3) iniciarAto3(); }
  function iniciarAto3() {
    S.ato = 3; S.cena = 'escadaria'; S.itens = tem('lanterna') ? ['lanterna'] : []; S.flags.ato2Fim = true; salvar();
    el.titulo.style.display = 'none';
    partida(true); desenharInv(); atualizarBadge(false);
    ir('escadaria');
  }
  function iniciarAto2() {
    // Itens do Ato 1 já cumpriram o papel (os documentos ficam no Arquivo); a lanterna segue.
    S.ato = 2; S.cena = 'almoxarifado'; S.itens = tem('lanterna') ? ['lanterna'] : []; salvar();
    el.titulo.style.display = 'none';
    partida(true); desenharInv(); atualizarBadge(false);
    fala(['O zumbido não vinha do gerador. Vinha de baixo.', 'O quadro de avisos falava de um Almoxarifado B. Restrito.'], function () { ir('almoxarifado'); });
  }
  function telaFimAto(n) {
    _tickTempo(); salvar();
    var min = Math.floor(S.tempo / 60000), seg = Math.floor(S.tempo / 1000) % 60;
    var lista = DOCS_ATO[n] || [];
    var achados = lista.filter(function (d) { return S.docs.indexOf(d) >= 0; }).length;
    var temProximo = n < ULTIMO_ATO;
    partida(false);
    el.titulo.innerHTML =
      '<div class="sb-tit-sub">Fim do</div>' +
      '<div class="sb-tit-nome sb-tit-menor">ATO ' + n + '</div>' +
      '<div class="sb-tit-stats">Tempo total: ' + min + 'min ' + (seg < 10 ? '0' : '') + seg + 's · Arquivos deste ato: ' + achados + '/' + lista.length + '</div>' +
      (temProximo ? '' : '<div class="sb-tit-sub2">Ato ' + (n + 1) + ' · em breve</div>') +
      '<div class="sb-tit-botoes">' +
        (temProximo ? '<button type="button" class="sb-btn" data-t="proximo">Ir para o ' + NOMES_ATO[n + 1] + '</button>' : '') +
        '<button type="button" class="sb-btn' + (temProximo ? ' sb-btn-sec' : '') + '" data-t="arquivo">Ver arquivos</button>' +
        (temProximo ? '' : '<button type="button" class="sb-btn sb-btn-sec" data-t="novo">Jogar de novo</button>') +
      '</div>';
    el.titulo.style.display = '';
    var b = el.titulo.querySelector('[data-t="proximo"]');
    if (b) b.addEventListener('click', function () { som.clique(); iniciarAto(n + 1); });
    el.titulo.querySelector('[data-t="arquivo"]').addEventListener('click', function () {
      som.clique(); el.titulo.style.display = 'none'; abrirArquivo();
      modalAoFechar = function () { el.titulo.style.display = ''; };
    });
    var bn = el.titulo.querySelector('[data-t="novo"]');
    if (bn) bn.addEventListener('click', function () { som.clique(); S = novoEstado(); salvar(); comecar(); });
  }

  /* ══════════════════════════════════════════════════════════════
     NEVE (canvas por cima da cena externa)
  ══════════════════════════════════════════════════════════════ */
  function ligarNeve(on) {
    if (!on) {
      if (neveRaf) cancelAnimationFrame(neveRaf); neveRaf = 0;
      var cx = el.fx.getContext('2d'); cx.clearRect(0, 0, el.fx.width, el.fx.height);
      return;
    }
    if (neveRaf) return;
    var ult = 0;
    function q(ts) {
      var dt = ult ? Math.min(0.05, (ts - ult) / 1000) : 0.016; ult = ts;
      var W = el.fx.width, H = el.fx.height, cx = el.fx.getContext('2d');
      while (neve.length < 140) neve.push({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random(), r: 0.6 + Math.random() * 1.8 });
      cx.clearRect(0, 0, W, H);
      var k = W / 800;
      cx.lineCap = 'round';
      for (var i = 0; i < neve.length; i++) {
        var n = neve[i];
        var vx = (260 + 160 * n.v) * k, vy = (60 + 70 * n.v) * k;
        n.x -= vx * dt; n.y += vy * dt;
        if (n.x < -20 || n.y > H + 10) { n.x = W + Math.random() * 60; n.y = Math.random() * H * 0.9 - 20; }
        cx.strokeStyle = 'rgba(225,240,255,' + (0.25 + 0.45 * (n.r / 2.4)) + ')';
        cx.lineWidth = n.r * 1.3 * k;
        cx.beginPath(); cx.moveTo(n.x, n.y); cx.lineTo(n.x + vx * 0.018, n.y - vy * 0.018); cx.stroke();
      }
      neveRaf = requestAnimationFrame(q);
    }
    neveRaf = requestAnimationFrame(q);
  }

  /* ══════════════════════════════════════════════════════════════
     SOM (síntese, sem arquivos — dá pra trocar por ElevenLabs depois)
  ══════════════════════════════════════════════════════════════ */
  var som = (function () {
    var ac = null, master = null, vento = null, ventoG = null, zumbido = null, zumbG = null, estG = null, mudoT = 0;
    // Arquivos gravados (ElevenLabs) em /Jogos/assets/sinalbranco/sfx/<nome>.mp3.
    // Enquanto um arquivo não existe ou não carregou, toca a síntese de reserva.
    var VOZES = { audio_ingrid: 'voz-audio_ingrid-v3', sinal: 'voz-sinal-v2', fita_kazuo: 'voz-fita_kazuo-v2',
      central_abertura: 'voz-central-abertura-v1', central_guia: 'voz-central-guia-v1', central_otimo: 'voz-central-otimo-v1',
      central_quadro: 'voz-central-quadro-v1', central_desca: 'voz-central-desca-v1' };
    var ARQ = ['passos-neve', 'passos-metal', 'porta', 'gerador-liga', 'sinal-ok', 'pegar', 'papel', 'gravador',
      'peca', 'lanterna', 'luzes', 'revelacao', 'elevador-freio', 'faisca', 'porta-pedra', 'cabra',
      VOZES.audio_ingrid, VOZES.sinal, VOZES.fita_kazuo,
      VOZES.central_abertura, VOZES.central_guia, VOZES.central_otimo, VOZES.central_quadro, VOZES.central_desca];
    var LOOPS = ['vento-loop', 'interior-loop', 'gerador-loop', 'estatica-loop', 'coro-loop', 'elevador-loop'];
    var buf = {}, loopG = {}, loopOn = {}, vozSrc = null, vozVez = 0, ambAtual = { onde: '', cena: '' };
    function ligado() { var s = window.AngatubaSom; return !(s && typeof s.ativo === 'function' && !s.ativo()); }
    function ruidoBuf() {
      var b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0), u = 0;
      for (var i = 0; i < d.length; i++) { u = (u + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = u * 3.5; }
      return b;
    }
    function brancoBuf() {
      var b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function carregar(nome) {
      try {
        fetch(A + 'sfx/' + nome + '.mp3').then(function (r) { if (!r.ok) throw new Error('404'); return r.arrayBuffer(); })
          .then(function (ab) { return new Promise(function (ok, erro) { ac.decodeAudioData(ab, ok, erro); }); })
          .then(function (b) { buf[nome] = b; if (loopG[nome]) iniciarLoop(nome); aplicarAmbiente(); })
          .catch(function () {});
      } catch (e) {}
    }
    function iniciarLoop(nome) {
      if (loopOn[nome] || !buf[nome]) return;
      var s = ac.createBufferSource(); s.buffer = buf[nome]; s.loop = true;
      // pula o respiro do mp3 nas pontas
      s.loopStart = 0.03; s.loopEnd = Math.max(0.1, buf[nome].duration - 0.03);
      s.connect(loopG[nome]); s.start(0, 0.03);
      loopOn[nome] = true;
    }
    function destravar() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
      master = ac.createGain(); master.gain.value = ligado() ? 0.8 : 0; master.connect(ac.destination);
      // vento sintetizado (reserva): ruído marrom + passa-faixa com LFO
      vento = ac.createBufferSource(); vento.buffer = ruidoBuf(); vento.loop = true;
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
      var lfo = ac.createOscillator(); lfo.frequency.value = 0.13;
      var lfoG = ac.createGain(); lfoG.gain.value = 220; lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
      ventoG = ac.createGain(); ventoG.gain.value = 0;
      vento.connect(bp); bp.connect(ventoG); ventoG.connect(master); vento.start();
      // zumbido sintetizado (reserva)
      zumbido = ac.createOscillator(); zumbido.type = 'sawtooth'; zumbido.frequency.value = 55;
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
      zumbG = ac.createGain(); zumbG.gain.value = 0;
      zumbido.connect(lp); lp.connect(zumbG); zumbG.connect(master); zumbido.start();
      // estática sintetizada (reserva)
      var est = ac.createBufferSource(); est.buffer = brancoBuf(); est.loop = true;
      var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      estG = ac.createGain(); estG.gain.value = 0;
      est.connect(hp); hp.connect(estG); estG.connect(master); est.start();
      LOOPS.forEach(function (n) { loopG[n] = ac.createGain(); loopG[n].gain.value = 0; loopG[n].connect(master); });
      ARQ.concat(LOOPS).forEach(carregar);
      clearInterval(mudoT);
      mudoT = setInterval(function () { if (master) master.gain.value = ligado() ? 0.8 : 0; }, 500);
    }
    function alvo(g, v, t) { if (g && ac) { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setTargetAtTime(v, ac.currentTime, t || 0.6); } }
    function bip(f, dur, tipo, vol, f2) {
      if (!ac) return;
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    }
    function sopro(dur, f, vol) {
      if (!ac) return;
      var s = ac.createBufferSource(); s.buffer = brancoBuf();
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.2;
      var g = ac.createGain(), t = ac.currentTime;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
    }
    // Toca o arquivo; sem ele, chama a reserva sintetizada.
    function tocar(nome, vol, reserva) {
      if (ac && buf[nome]) {
        var s = ac.createBufferSource(), g = ac.createGain();
        s.buffer = buf[nome]; g.gain.value = vol == null ? 0.8 : vol;
        s.connect(g); g.connect(master); s.start();
        return s;
      }
      if (typeof reserva === 'function') reserva();
      return null;
    }
    function aplicarAmbiente() {
      if (!ac) return;
      var fora = ambAtual.onde === 'fora', cena = ambAtual.cena;
      var energia = !!(S && S.flags.energia), radio = !!(S && S.flags.radioOk);
      // gravados
      alvo(loopG['vento-loop'], fora ? 0.75 : 0, 0.8);
      alvo(loopG['interior-loop'], fora ? 0 : 0.55, 0.8);
      alvo(loopG['gerador-loop'], cena === 'gerador' && energia ? 0.6 : (energia && !fora ? 0.08 : 0), 1);
      alvo(loopG['coro-loop'], radio && !fora ? 0.35 : 0, 2);
      // reservas sintetizadas só tocam se o arquivo correspondente não existir
      alvo(ventoG, buf['vento-loop'] ? 0 : (fora ? 0.55 : (buf['interior-loop'] ? 0 : 0.1)), 0.8);
      alvo(zumbG, buf['gerador-loop'] ? 0 : (energia && !fora ? 0.05 : 0), 1.2);
    }
    return {
      destravar: destravar,
      tocar: tocar,
      ambiente: function (onde, cena) { ambAtual = { onde: onde, cena: cena || '' }; aplicarAmbiente(); },
      estatica: function (v) {
        if (!ac) return;
        var x = Math.max(0, v);
        if (buf['estatica-loop']) { estG.gain.setTargetAtTime(0, ac.currentTime, 0.08); loopG['estatica-loop'].gain.setTargetAtTime(x * 0.7, ac.currentTime, 0.08); }
        else estG.gain.setTargetAtTime(x * 0.16, ac.currentTime, 0.08);
      },
      // Cada pedido ganha uma "vez"; se outro pedido ou o fechamento do
      // documento vier antes do atraso, o anterior não toca mais.
      voz: function (id) {
        var nome = VOZES[id];
        if (!ac || !nome || !buf[nome]) return;
        var vez = ++vozVez;
        if (vozSrc) { try { vozSrc.stop(); } catch (e) {} vozSrc = null; }
        setTimeout(function () {
          if (vez !== vozVez) return;
          vozSrc = tocar(nome, 1);
          if (vozSrc) vozSrc.onended = function () { if (vez === vozVez) vozSrc = null; };
        }, 700);
      },
      // motor do elevador: x = 0..1 (velocidade); arquivo em loop, sem reserva sintetizada
      elevador: function (x) {
        if (!ac || !loopG['elevador-loop']) return;
        var g = loopG['elevador-loop'].gain;
        g.cancelScheduledValues(ac.currentTime);
        g.setTargetAtTime(x > 0.02 ? 0.25 + 0.6 * x : 0, ac.currentTime, 0.15);
      },
      pararVoz: function () { vozVez++; if (vozSrc) { try { vozSrc.stop(); } catch (e) {} vozSrc = null; } },
      clique: function () { bip(1800, 0.03, 'square', 0.025); },
      tique: function () { bip(2400, 0.02, 'square', 0.02); },
      porta: function () { tocar('porta', 0.7, function () { sopro(0.3, 500, 0.08); }); },
      giro: function () { tocar('peca', 0.7, function () { bip(300, 0.06, 'triangle', 0.08, 180); sopro(0.05, 3000, 0.04); }); },
      passo: function (fora) {
        tocar(fora ? 'passos-neve' : 'passos-metal', 0.8, function () { sopro(0.12, 700, 0.12); setTimeout(function () { sopro(0.12, 600, 0.1); }, 170); });
      },
      papel: function () { tocar('papel', 0.8, function () { sopro(0.18, 4200, 0.07); }); },
      fita: function () { tocar('gravador', 0.8, function () { bip(140, 0.08, 'square', 0.05); sopro(0.5, 2500, 0.05); }); },
      pegar: function () { tocar('pegar', 0.8); bip(660, 0.18, 'sine', 0.06); setTimeout(function () { bip(990, 0.25, 'sine', 0.05); }, 110); },
      energia: function () { tocar('gerador-liga', 0.9, function () { bip(60, 1.4, 'sawtooth', 0.14, 110); setTimeout(function () { bip(880, 0.4, 'sine', 0.06); }, 500); }); },
      parar: function () { if (ac && ac.state === 'running') ac.suspend(); clearInterval(mudoT); mudoT = 0; },
      voltar: function () {
        if (ac && ac.state === 'suspended') ac.resume();
        if (ac && !mudoT) mudoT = setInterval(function () { if (master) master.gain.value = ligado() ? 0.8 : 0; }, 500);
      }
    };
  })();

  /* ══════════════════════════════════════════════════════════════
     INTEGRAÇÃO COM O HUB
  ══════════════════════════════════════════════════════════════ */
  function _menu() { var G = window.AngatubaGames; return (G && G.menu) || window.AngatubaJogoMenu || null; }
  function partida(em) {
    if (em === emPartida) return;
    _tickTempo();
    emPartida = em;
    var M = _menu();
    if (M) M.partida(TELA, em);
  }
  function registrarMenu() {
    var M = _menu();
    if (!M) return;
    M.registrar(TELA, {
      pausar: function () { _tickTempo(); som.parar(); },
      continuar: function () { tUltimo = Date.now(); som.voltar(); },
      descricao: function () { return S ? 'Ato ' + (S.ato || 1) + ' · ' + cenaAtual().nome + ' · progresso salvo' : 'Sinal Branco'; }
    });
  }
  function aoTecla(e) {
    if (!ativo) return;
    if (e.key === 'Escape' && el.modal.style.display !== 'none' && el.modal.getAttribute('data-fecha') === '1') { e.preventDefault(); fecharModal(); }
    else if ((e.key === ' ' || e.key === 'Enter') && el.fala.style.display !== 'none') { e.preventDefault(); avancarFala(); }
  }

  function preparar() {
    if (!montado && !montar()) return;
    if (!ativo) {
      ativo = true;
      window.addEventListener('resize', aoRedimensionar);
      window.addEventListener('orientationchange', aoRedimensionar);
      window.addEventListener('keydown', aoTecla, true);
    }
    registrarMenu();
    travarPaisagem();
    layout(); setTimeout(layout, 120); setTimeout(layout, 400);
    el.fala.style.display = 'none';
    el.modal.style.display = 'none';
    som.voltar();
    telaTitulo();
  }

  function parar() {
    if (!ativo) return;
    salvar();
    ativo = false;
    partida(false);
    puz.parar();
    clearInterval(falaTimer);
    ligarNeve(false);
    som.parar();
    destravar();
    window.removeEventListener('resize', aoRedimensionar);
    window.removeEventListener('orientationchange', aoRedimensionar);
    window.removeEventListener('keydown', aoTecla, true);
  }

  window.SinalBrancoGame = {
    preparar: preparar, parar: parar,
    // Leitura de estado para testes (não altera nada)
    _estado: function () { return S ? JSON.parse(JSON.stringify(S)) : null; },
    _puz: function () { return puzInfo; }
  };
})();
