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
   - Ato 1 (O Muro Branco) jogável; Atos 2–4 vêm depois.
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
    fusivel:    { nome: 'Fusível',    img: 'item-fusivel-v1.webp',    desc: 'Fusível cerâmico de reserva, 30 A.' }
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
  var DOCS_ATO1 = ['avisos', 'bilhete_pavel', 'diario_ingrid', 'audio_ingrid', 'graf', 'relatorio_mira', 'log_radio', 'sinal'];

  /* ══════════════════════════════════════════════════════════════
     CENAS — pontos em % da imagem { x, y, w, h }.
     saidas: lado 'esq' | 'dir' | 'baixo' | 'cima' (seta na borda).
     Uma porta que dá pra outra cena é um ponto com acao: ir(...).
  ══════════════════════════════════════════════════════════════ */
  var CENAS = {
    heliponto: {
      nome: 'Heliponto', img: 'heliponto-v1.webp', neve: true, fora: true,
      chegada: ['O helicóptero já estava subindo antes de eu fechar a porta.',
        '"Volto em três dias, se o tempo deixar", o piloto gritou. Não parecia ter muita certeza.',
        'Estação Halvorsen. Doze pesquisadores, segundo o contrato. Nenhum veio me receber.'],
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
          fala(['Pegadas molhadas. Indo pra dentro.', 'Não são minhas. Eu ainda nem tinha entrado.']); } },
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
          fala(['Alguém riscou isso na parede. Com força, até arrancar a tinta.', 'Uma estrela de sete pontas.']); } },
        { id: 'quadro', x: 54, y: 74, w: 18, h: 16, acao: function () {
          fala(['Um quadro caído. O vidro quebrou bem no meio.', 'Alguém passou correndo por aqui e nem parou pra juntar.']); } },
        { id: 'quarto', x: 61, y: 28, w: 12, h: 44, porta: true, acao: function () { ir('quarto'); } },
        { id: 'fundo', x: 42, y: 26, w: 15, h: 38, porta: true, acao: function () {
          if (!tem('lanterna')) fala(['O fim do corredor está completamente escuro.', 'Pela planta, a sala do gerador fica pra lá. Sem luz, não dá.']);
          else { fala(['Liguei a lanterna.'], function () { ir('gerador'); }); } } }
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
          fala(['A equipe toda, na frente da estação. O reflexo no vidro não deixa ver os rostos.', 'Contei. Doze pessoas... e uma sombra a mais, no canto.', 'Deve ser o vidro.']); } },
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
          else fala(['O rádio só chia agora.', 'Mas eu sei que ela ainda está ouvindo.']); } },
        { id: 'fones', x: 1, y: 20, w: 13, h: 44, acao: function () {
          fala(['Os fones do Kazuo.', 'Ainda estão... mornos?', 'Não pode ser.']); } },
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

  /* ══════════════════════════════════════════════════════════════
     ESTADO
  ══════════════════════════════════════════════════════════════ */
  var S = null;           // { cena, itens[], flags{}, docs[], vistos{}, chegou{}, tempo }
  var montado = false, ativo = false, lockNativo = false;
  var el = {};            // referências do DOM
  var falaFila = [], falaFim = null, falaTimer = 0, falaTexto = '', falaPos = 0;
  var tUltimo = 0, relogio = 0;
  var neveRaf = 0, neve = [];
  var emPartida = false;

  function novoEstado() {
    return { cena: 'heliponto', itens: [], flags: {}, docs: [], vistos: {}, chegou: {}, tempo: 0 };
  }
  function salvar() {
    if (!S) return;
    _tickTempo();
    try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {}
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
  function tirar(id) { var i = S.itens.indexOf(id); if (i >= 0) S.itens.splice(i, 1); desenharInv(); }
  function pegar(id, linhas, docId) {
    if (!tem(id)) S.itens.push(id);
    som.pegar();
    desenharInv(id);
    salvar();
    fala(linhas.concat(['[ ' + ITENS[id].nome + ' adicionado ao inventário ]']), docId ? function () { doc(docId); } : null);
    desenharCena(true);
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
      '<img class="sb-bg" alt="" draggable="false">' +
      '<canvas class="sb-fx" width="800" height="450"></canvas>' +
      '<div class="sb-pontos"></div>' +
      '<div class="sb-saidas"></div>' +
      '<div class="sb-hud">' +
        '<div class="sb-local"></div>' +
        '<div class="sb-botoes">' +
          '<button type="button" class="sb-hbtn" data-a="lupa" aria-label="Mostrar pontos"><i class="fa fa-search"></i></button>' +
          '<button type="button" class="sb-hbtn" data-a="arquivo" aria-label="Arquivo"><i class="fa fa-folder-open"></i><span class="sb-badge"></span></button>' +
        '</div>' +
      '</div>' +
      '<div class="sb-inv"></div>' +
      '<div class="sb-fala" style="display:none"><div class="sb-fala-txt"></div><div class="sb-fala-seta">▼</div></div>' +
      '<div class="sb-modal" style="display:none"><div class="sb-modal-caixa"></div></div>' +
      '<div class="sb-titulo" style="display:none"></div>' +
      '<div class="sb-fade"></div>';
    root.appendChild(palco);
    el.root = root; el.palco = palco;
    el.bg = palco.querySelector('.sb-bg');
    el.fx = palco.querySelector('.sb-fx');
    el.pontos = palco.querySelector('.sb-pontos');
    el.saidas = palco.querySelector('.sb-saidas');
    el.local = palco.querySelector('.sb-local');
    el.badge = palco.querySelector('.sb-badge');
    el.inv = palco.querySelector('.sb-inv');
    el.fala = palco.querySelector('.sb-fala');
    el.falaTxt = palco.querySelector('.sb-fala-txt');
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
      if (el.bg.getAttribute('src') !== src) el.bg.src = src;
      el.palco.classList.toggle('sb-pisca', !!c.pisca);
      el.local.textContent = c.nome;
      ligarNeve(!!c.neve);
      som.ambiente(c.fora ? 'fora' : 'dentro');
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
        som.clique();
        pt.acao();
        salvar();
      });
      el.pontos.appendChild(b);
    });
    if (!soPontos) {
      el.saidas.innerHTML = '';
      (c.saidas || []).forEach(function (s) {
        var ic = { esq: 'fa-chevron-left', dir: 'fa-chevron-right', baixo: 'fa-chevron-down', cima: 'fa-chevron-up' }[s.lado];
        var b = h('button', 'sb-saida sb-saida-' + s.lado, '<i class="fa ' + ic + '"></i><span>' + esc(s.rotulo) + '</span>');
        b.type = 'button';
        b.addEventListener('click', function () { if (ocupado()) return; som.passo(); ir(s.para); });
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
        if (!S.chegou[id] && c.chegada) { S.chegou[id] = true; salvar(); setTimeout(function () { fala(c.chegada); }, 280); }
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
        fala([it.nome + ': ' + it.desc], it.doc ? function () { doc(it.doc); } : null);
      });
      el.inv.appendChild(b);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     FALA (caixa de texto com máquina de escrever)
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
      var f = falaFim; falaFim = null;
      if (f) f();
      return;
    }
    falaTexto = falaFila.shift();
    falaPos = 0;
    el.falaTxt.textContent = '';
    el.fala.classList.remove('sb-pronta');
    falaTimer = setInterval(function () {
      falaPos += 2;
      el.falaTxt.textContent = falaTexto.slice(0, falaPos);
      if (falaPos >= falaTexto.length) { clearInterval(falaTimer); el.fala.classList.add('sb-pronta'); }
    }, 28);
  }
  function avancarFala() {
    if (falaPos < falaTexto.length) {
      clearInterval(falaTimer); falaPos = falaTexto.length;
      el.falaTxt.textContent = falaTexto; el.fala.classList.add('sb-pronta');
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
    var f = modalAoFechar; modalAoFechar = null;
    if (f) f();
  }

  function doc(id, aoFechar) {
    var d = DOCS[id];
    var novo = S.docs.indexOf(id) < 0;
    if (novo) { S.docs.push(id); salvar(); atualizarBadge(true); }
    var corpo = esc(d.texto).replace(/\n/g, '<br>');
    var topo = d.tipo === 'audio'
      ? '<div class="sb-onda"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'
      : '';
    abrirModal(
      '<button type="button" class="sb-x" aria-label="Fechar">✕</button>' +
      '<div class="sb-doc-tit">' + esc(d.titulo) + '</div>' + topo +
      '<div class="sb-doc-txt">' + corpo + '</div>' +
      (novo ? '<div class="sb-doc-novo">Guardado no Arquivo</div>' : ''),
      'sb-doc sb-doc-' + d.tipo, true, aoFechar);
    if (d.tipo === 'audio') som.fita();
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
      '<div class="sb-arq-cont">' + S.docs.length + ' de ' + DOCS_ATO1.length + ' arquivos encontrados</div>' +
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
          som.ambiente('dentro');
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

  /* ── Frequência do rádio (encaixar a onda na onda-alvo) ──────── */
  function abrirFrequencia() {
    var alvo = { f: 6.3, p: 2.2 };
    var cur = { f: 3.0 + Math.random() * 1.2, p: 0.3 + Math.random() };
    var segurar = 0;
    var html = '<div class="sb-doc-tit">Rádio principal — sintonia</div>' +
      '<div class="sb-puz-dica">Encaixe a sua onda (branca) na onda escondida no ruído (ciano).</div>' +
      '<canvas class="sb-freq-cv" width="900" height="300"></canvas>' +
      '<div class="sb-freq-ctrl">' +
        '<div class="sb-freq-grupo"><span>Frequência</span><button type="button" data-k="f" data-d="-1">◀</button><b class="sb-freq-fv"></b><button type="button" data-k="f" data-d="1">▶</button></div>' +
        '<div class="sb-freq-grupo"><span>Fase</span><button type="button" data-k="p" data-d="-1">◀</button><b class="sb-freq-pv"></b><button type="button" data-k="p" data-d="1">▶</button></div>' +
      '</div>' +
      '<div class="sb-freq-medidor"><div class="sb-freq-barra"></div><span class="sb-freq-pct"></span></div>' +
      '<button type="button" class="sb-btn-sec sb-x2">Desligar o rádio</button>';
    abrirModal(html, 'sb-puz sb-puz-freq', false);
    var cv = el.caixa.querySelector('.sb-freq-cv'), ctx = cv.getContext('2d');
    var fv = el.caixa.querySelector('.sb-freq-fv'), pv = el.caixa.querySelector('.sb-freq-pv');
    var barra = el.caixa.querySelector('.sb-freq-barra'), pct = el.caixa.querySelector('.sb-freq-pct');
    var feito = false;
    el.caixa.querySelector('.sb-x2').addEventListener('click', function () { som.clique(); fecharModal(); });
    Array.prototype.forEach.call(el.caixa.querySelectorAll('[data-k]'), function (b) {
      var k = b.getAttribute('data-k'), dd = +b.getAttribute('data-d');
      var passo = function () {
        if (feito) return;
        if (k === 'f') cur.f = Math.max(1, Math.min(9.9, Math.round((cur.f + dd * 0.1) * 10) / 10));
        else cur.p = (cur.p + dd * 0.1 + Math.PI * 2) % (Math.PI * 2);
        som.tique();
      };
      var t = 0, r = 0;
      var parar = function () { clearTimeout(t); clearInterval(r); };
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); passo(); parar();
        t = setTimeout(function () { r = setInterval(passo, 70); puz.timers.push(r); }, 320);
      });
      b.addEventListener('pointerup', parar); b.addEventListener('pointerleave', parar); b.addEventListener('pointercancel', parar);
    });
    function casamento() {
      var df = Math.abs(cur.f - alvo.f);
      var dp = Math.abs(((cur.p - alvo.p) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      var mf = Math.max(0, 1 - df / 2.5), mp = Math.max(0, 1 - dp / Math.PI);
      return df < 0.05 ? (0.55 + 0.45 * mp) : mf * 0.55 * (0.6 + 0.4 * mp);
    }
    var ult = 0;
    function quadro(ts) {
      var dt = ult ? Math.min(0.05, (ts - ult) / 1000) : 0.016; ult = ts;
      var W = cv.width, H = cv.height, c = casamento();
      ctx.fillStyle = '#04110f'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(80,255,220,.07)'; ctx.lineWidth = 1;
      for (var gx = 0; gx <= W; gx += 75) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (var gy = 0; gy <= H; gy += 50) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      var ruido = 1 - c;
      function onda(f, p, cor, lw, sujo) {
        ctx.beginPath();
        for (var x = 0; x <= W; x += 4) {
          var y = H / 2 + Math.sin(x / W * Math.PI * 2 * f / 2 + p) * H * 0.3;
          if (sujo) y += (Math.random() - 0.5) * H * 0.22 * sujo;
          if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.stroke();
      }
      ctx.shadowBlur = 14; ctx.shadowColor = '#22d3ee';
      onda(alvo.f, alvo.p, 'rgba(34,211,238,' + (0.35 + 0.4 * c) + ')', 5, ruido * 0.9);
      ctx.shadowColor = '#fff';
      onda(cur.f, cur.p, 'rgba(255,255,255,.92)', 3, 0);
      ctx.shadowBlur = 0;
      // chiado visual
      ctx.fillStyle = 'rgba(200,255,240,' + (0.08 * ruido) + ')';
      for (var n = 0; n < 160 * ruido; n++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      fv.textContent = cur.f.toFixed(1).replace('.', ',') + ' MHz';
      pv.textContent = Math.round(cur.p / (Math.PI * 2) * 360) + '°';
      var pc = Math.round(c * 100);
      barra.style.width = pc + '%';
      barra.classList.toggle('sb-quase', pc >= 80);
      pct.textContent = 'Sinal ' + pc + '%';
      som.estatica(ruido);
      if (!feito) {
        segurar = c >= 0.96 ? segurar + dt : 0;
        if (segurar > 0.8) {
          feito = true;
          som.estatica(0);
          som.energia();
          pct.textContent = 'Sinal 100% — decodificando...';
          setTimeout(function () {
            fecharModal();
            flag('radioOk');
            doc('sinal', fimDoAto);
          }, 1200);
        }
      }
      puz.raf = requestAnimationFrame(quadro);
    }
    puz.raf = requestAnimationFrame(quadro);
  }

  /* ══════════════════════════════════════════════════════════════
     TELAS: título e fim do ato
  ══════════════════════════════════════════════════════════════ */
  function telaTitulo() {
    var temSave = !!carregar();
    el.bg.src = A + 'heliponto-v1.webp';
    el.pontos.innerHTML = ''; el.saidas.innerHTML = ''; el.inv.innerHTML = '';
    el.local.textContent = '';
    ligarNeve(true);
    el.titulo.innerHTML =
      '<div class="sb-tit-nome">SINAL BRANCO</div>' +
      '<div class="sb-tit-sub">Ato 1 — O Muro Branco</div>' +
      '<div class="sb-tit-botoes">' +
        (temSave ? '<button type="button" class="sb-btn" data-t="continuar">Continuar</button>' : '') +
        '<button type="button" class="sb-btn' + (temSave ? ' sb-btn-sec' : '') + '" data-t="novo">Novo jogo</button>' +
      '</div>' +
      '<div class="sb-tit-nota">Use fones de ouvido. Toque nas coisas da cena para examinar.</div>';
    el.titulo.style.display = '';
    partida(false);
    Array.prototype.forEach.call(el.titulo.querySelectorAll('[data-t]'), function (b) {
      b.addEventListener('click', function () {
        som.destravar(); som.clique();
        if (b.getAttribute('data-t') === 'novo') {
          if (temSave && !confirmarNovo(b)) return;
          S = novoEstado();
        } else S = carregar() || novoEstado();
        comecar();
      });
    });
  }
  function confirmarNovo(b) {
    if (b.getAttribute('data-ok') === '1') return true;
    b.setAttribute('data-ok', '1');
    b.textContent = 'Apagar o progresso? Toque de novo';
    return false;
  }
  function comecar() {
    el.titulo.style.display = 'none';
    tUltimo = Date.now();
    partida(true);
    desenharInv();
    atualizarBadge(false);
    var id = S.cena;
    if (S.flags.atoFim) { fimDoAto(); return; }
    S.cena = id;
    ir(id);
  }
  function fimDoAto() {
    fala(['Treze. Doze da equipe... e eu.', 'E aquela voz era da Ingrid. Igual à da gravação.', 'Debaixo do piso, alguma coisa começou a vibrar.'], function () {
      flag('atoFim');
      _tickTempo(); salvar();
      var min = Math.floor(S.tempo / 60000), seg = Math.floor(S.tempo / 1000) % 60;
      var achados = DOCS_ATO1.filter(function (d) { return S.docs.indexOf(d) >= 0; }).length;
      partida(false);
      el.titulo.innerHTML =
        '<div class="sb-tit-sub">Fim do</div>' +
        '<div class="sb-tit-nome sb-tit-menor">ATO 1</div>' +
        '<div class="sb-tit-stats">Tempo: ' + min + 'min ' + (seg < 10 ? '0' : '') + seg + 's · Arquivos: ' + achados + '/' + DOCS_ATO1.length + '</div>' +
        '<div class="sb-tit-sub2">Ato 2 — Subsolo Zero · em breve</div>' +
        '<div class="sb-tit-botoes"><button type="button" class="sb-btn" data-t="arquivo">Ver arquivos</button>' +
        '<button type="button" class="sb-btn sb-btn-sec" data-t="novo">Jogar de novo</button></div>';
      el.titulo.style.display = '';
      el.titulo.querySelector('[data-t="arquivo"]').addEventListener('click', function () {
        som.clique(); el.titulo.style.display = 'none'; abrirArquivo();
        modalAoFechar = function () { el.titulo.style.display = ''; };
      });
      el.titulo.querySelector('[data-t="novo"]').addEventListener('click', function () {
        som.clique(); S = novoEstado(); salvar(); comecar();
      });
    });
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
    function destravar() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
      master = ac.createGain(); master.gain.value = ligado() ? 0.8 : 0; master.connect(ac.destination);
      // vento: ruído marrom + passa-faixa com LFO
      vento = ac.createBufferSource(); vento.buffer = ruidoBuf(); vento.loop = true;
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
      var lfo = ac.createOscillator(); lfo.frequency.value = 0.13;
      var lfoG = ac.createGain(); lfoG.gain.value = 220; lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
      ventoG = ac.createGain(); ventoG.gain.value = 0;
      vento.connect(bp); bp.connect(ventoG); ventoG.connect(master); vento.start();
      // zumbido da estação (só com o gerador ligado)
      zumbido = ac.createOscillator(); zumbido.type = 'sawtooth'; zumbido.frequency.value = 55;
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
      zumbG = ac.createGain(); zumbG.gain.value = 0;
      zumbido.connect(lp); lp.connect(zumbG); zumbG.connect(master); zumbido.start();
      // estática do rádio
      var est = ac.createBufferSource(); est.buffer = brancoBuf(); est.loop = true;
      var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      estG = ac.createGain(); estG.gain.value = 0;
      est.connect(hp); hp.connect(estG); estG.connect(master); est.start();
      clearInterval(mudoT);
      mudoT = setInterval(function () { if (master) master.gain.value = ligado() ? 0.8 : 0; }, 500);
    }
    function alvo(g, v, t) { if (g) { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setTargetAtTime(v, ac.currentTime, t || 0.6); } }
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
    return {
      destravar: destravar,
      ambiente: function (onde) {
        if (!ac) return;
        alvo(ventoG, onde === 'fora' ? 0.55 : 0.1, 0.8);
        alvo(zumbG, S && S.flags.energia && onde !== 'fora' ? 0.05 : 0, 1.2);
      },
      estatica: function (v) { if (ac) estG.gain.setTargetAtTime(Math.max(0, v) * 0.16, ac.currentTime, 0.08); },
      clique: function () { bip(1800, 0.03, 'square', 0.025); },
      tique: function () { bip(2400, 0.02, 'square', 0.02); },
      giro: function () { bip(300, 0.06, 'triangle', 0.08, 180); sopro(0.05, 3000, 0.04); },
      passo: function () { sopro(0.12, 700, 0.12); setTimeout(function () { sopro(0.12, 600, 0.1); }, 170); },
      papel: function () { sopro(0.18, 4200, 0.07); },
      fita: function () { bip(140, 0.08, 'square', 0.05); sopro(0.5, 2500, 0.05); },
      pegar: function () { bip(660, 0.18, 'sine', 0.09); setTimeout(function () { bip(990, 0.25, 'sine', 0.08); }, 110); },
      energia: function () { bip(60, 1.4, 'sawtooth', 0.14, 110); setTimeout(function () { bip(880, 0.4, 'sine', 0.06); }, 500); },
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
      descricao: function () { return S ? 'Ato 1 · ' + cenaAtual().nome + ' · progresso salvo' : 'Ato 1'; }
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
    _estado: function () { return S ? JSON.parse(JSON.stringify(S)) : null; }
  };
})();
