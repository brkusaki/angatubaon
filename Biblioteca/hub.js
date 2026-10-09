'use strict';

/* ══════════════════════════════════════════════════════════════
   BIBLIOTECA DA CORUJA — Biblioteca/hub.js
   Leitor de clássicos em domínio público, 100% dentro do app.
   Carrega sob demanda (ver _carregarBiblioteca em app.js), no
   primeiro toque no botão "Ler" da bottom nav do modo cliente — quem
   não usa a biblioteca nunca baixa este código nem o CSS dela.

   Peças:
   - Catálogo (BIB_LIVROS, abaixo) com busca e filtros combináveis
     de categoria e autor.
   - Página do livro: sinopse, listas (favorito / quero ler / já li),
     sumário, avaliação com estrelas + comentário (Firestore).
   - Leitor: modo vertical (rolagem) ou horizontal (páginas em
     colunas CSS, com swipe/toque nas laterais), temas claro/escuro/
     sépia, fonte, espaçamento, sumário, "manter tela ligada" (Wake
     Lock) e leitura em voz alta (Web Speech API).
   - Texto de cada livro: /Biblioteca/livros/<id>.json, baixado só
     quando o livro é aberto. O service worker guarda esses arquivos
     num cache próprio (CACHE_BIB) que sobrevive a deploys: livro
     aberto uma vez lê offline.

   Persistência:
   - Deslogado: tudo no localStorage (BIB_CHAVE_ANON).
   - Logado (conta nomeada, _cliUser): doc privado biblioteca/{uid}
     no Firestore + cópia local por conta (BIB_CHAVE_CONTA + uid).
     Se havia leituras feitas deslogado, oferece juntar à conta.
   - Preferências do leitor (tema, fonte, modo…) são do APARELHO,
     só localStorage.

   Mesmo escopo global do app.js (script clássico, sem módulo): usa
   direto _injetarScript, _injetarCSS, _carregarFirebaseAuthCore,
   FIREBASE_SDK_BASE, _cliUser, cliNomeExibicao, cliAbrirLogin,
   showToastSimples e _popstateNosso.
══════════════════════════════════════════════════════════════ */

  /* ── Acervo (v1: fixo, só domínio público) ─────────────────────
     cor: [fundo 1, fundo 2, destaque] — fundo da capa enquanto a imagem
     carrega (ou se ela falhar) e brilho atrás da capa na página do livro.
     Capa ilustrada: /Biblioteca/capas/<id>.jpg.
     trad: de onde veio o texto (aparece em "Sobre esta edição").    */
  var BIB_TRAD_EN = 'Tradução nova do inglês, feita para a Biblioteca da Coruja com auxílio de inteligência artificial, a partir do texto original em domínio público.';
  var BIB_TRAD_DE = 'Tradução nova do alemão, feita para a Biblioteca da Coruja com auxílio de inteligência artificial, a partir do texto original em domínio público.';
  var BIB_ORIG_BR = 'Texto integral em domínio público, com a ortografia atualizada para o Acordo de 1990.';

  var BIB_LIVROS = [
    { id: '1984', titulo: '1984', autor: 'George Orwell', ano: 1949, cats: ['Distopia', 'Ficção científica', 'Estrangeiros'],
      cor: ['#1f2937', '#7f1d1d', '#fca5a5'], trad: BIB_TRAD_EN,
      sinopse: 'Na Oceânia, o Partido controla tudo — até o passado. Winston Smith passa os dias reescrevendo notícias antigas no Ministério da Verdade e, em segredo, começa a duvidar. O romance que deu ao mundo o Grande Irmão, a teletela e o duplipensamento.' },
    { id: 'revolucao-dos-bichos', titulo: 'A Revolução dos Bichos', autor: 'George Orwell', ano: 1945, cats: ['Distopia', 'Sátira', 'Leitura rápida', 'Estrangeiros'],
      cor: ['#14532d', '#a16207', '#fde68a'], trad: BIB_TRAD_EN,
      sinopse: 'Cansados dos maus-tratos do sr. Jones, os animais da Granja do Solar se rebelam e prometem uma sociedade onde todos são iguais. Uma fábula curta e afiada sobre como uma revolução pode ser traída por quem chega ao poder.' },
    { id: 'metamorfose', titulo: 'A Metamorfose', autor: 'Franz Kafka', ano: 1915, cats: ['Absurdo', 'Leitura rápida', 'Estrangeiros'],
      cor: ['#3f3f46', '#1e3a2f', '#bef264'], trad: BIB_TRAD_DE,
      sinopse: 'Gregor Samsa acorda certa manhã transformado num inseto monstruoso — e sua primeira preocupação é ter perdido o trem para o trabalho. Uma novela curta, estranha e comovente sobre família, trabalho e solidão.' },
    { id: 'processo', titulo: 'O Processo', autor: 'Franz Kafka', ano: 1925, cats: ['Absurdo', 'Estrangeiros'],
      cor: ['#292524', '#57534e', '#e7e5e4'], trad: BIB_TRAD_DE,
      sinopse: 'Josef K. é detido numa manhã sem ter feito nada de errado — e nunca descobre do que é acusado. Tribunais escondidos em sótãos, advogados inúteis e regras sem lógica: o pesadelo burocrático que virou adjetivo, kafkiano.' },
    { id: 'frankenstein', titulo: 'Frankenstein', autor: 'Mary Shelley', ano: 1818, cats: ['Gótico', 'Terror', 'Ficção científica', 'Estrangeiros'],
      cor: ['#134e4a', '#0f172a', '#5eead4'], trad: BIB_TRAD_EN + ' Texto-base: edição revista de 1831.',
      sinopse: 'O jovem cientista Victor Frankenstein descobre como dar vida à matéria morta, cria um ser — e o abandona. Rejeitada por todos, a criatura vai atrás de quem a criou. O livro que fundou a ficção científica.' },
    { id: 'dracula', titulo: 'Drácula', autor: 'Bram Stoker', ano: 1897, cats: ['Gótico', 'Terror', 'Estrangeiros'],
      cor: ['#450a0a', '#0b0b0b', '#f87171'], trad: BIB_TRAD_EN,
      sinopse: 'O advogado Jonathan Harker viaja à Transilvânia para fechar negócio com um misterioso conde. Contado em diários, cartas e recortes de jornal, o romance que transformou o vampiro em lenda moderna.' },
    { id: 'maquina-do-tempo', titulo: 'A Máquina do Tempo', autor: 'H. G. Wells', ano: 1895, cats: ['Ficção científica', 'Aventura', 'Leitura rápida', 'Estrangeiros'],
      cor: ['#1e3a8a', '#0e7490', '#a5f3fc'], trad: BIB_TRAD_EN,
      sinopse: 'Um inventor constrói uma máquina capaz de atravessar os séculos e chega ao ano 802.701, onde a humanidade se dividiu em dois povos muito diferentes. Aventura e crítica social num clássico curto da ficção científica.' },
    { id: 'guerra-dos-mundos', titulo: 'A Guerra dos Mundos', autor: 'H. G. Wells', ano: 1898, cats: ['Ficção científica', 'Aventura', 'Estrangeiros'],
      cor: ['#7c2d12', '#1c1917', '#fdba74'], trad: BIB_TRAD_EN,
      sinopse: 'Cilindros caem do céu no interior da Inglaterra e deles saem marcianos armados com um raio de calor devastador. Narrado por um sobrevivente, o primeiro grande romance de invasão alienígena.' },
    { id: 'dorian-gray', titulo: 'O Retrato de Dorian Gray', autor: 'Oscar Wilde', ano: 1890, cats: ['Gótico', 'Drama', 'Estrangeiros'],
      cor: ['#4c1d95', '#831843', '#f9a8d4'], trad: BIB_TRAD_EN,
      sinopse: 'Um jovem de beleza extraordinária deseja que seu retrato envelheça no lugar dele — e o desejo se cumpre. Enquanto Dorian mergulha em prazeres e crueldades, a pintura escondida registra cada pecado.' },
    { id: 'coracao-das-trevas', titulo: 'Coração das Trevas', autor: 'Joseph Conrad', ano: 1899, cats: ['Aventura', 'Drama', 'Leitura rápida', 'Estrangeiros'],
      cor: ['#022c22', '#030712', '#86efac'], trad: BIB_TRAD_EN,
      sinopse: 'Marlow sobe um rio na África colonial à procura de Kurtz, um agente do marfim que ganhou fama e um poder sombrio no interior. Uma viagem curta e intensa ao horror do colonialismo e à escuridão humana.' },
    { id: 'chamado-da-floresta', titulo: 'O Chamado da Floresta', autor: 'Jack London', ano: 1903, cats: ['Aventura', 'Leitura rápida', 'Estrangeiros'],
      cor: ['#0c4a6e', '#1e293b', '#bae6fd'], trad: BIB_TRAD_EN,
      sinopse: 'Buck, um cão grande e mimado da Califórnia, é roubado e vendido para puxar trenós no gelo do Yukon, em plena corrida do ouro. Para sobreviver, vai ter de reencontrar o instinto selvagem.' },
    { id: 'dom-casmurro', titulo: 'Dom Casmurro', autor: 'Machado de Assis', ano: 1899, cats: ['Romance', 'Realismo', 'Brasileiros'],
      cor: ['#1e1b4b', '#0f766e', '#99f6e4'], trad: BIB_ORIG_BR,
      sinopse: 'Já velho, Bentinho resolve contar sua história: o amor de infância por Capitu, a amizade com Escobar e o ciúme que tomou conta de tudo. Capitu traiu ou não traiu? Quem julga é o leitor.' },
    { id: 'bras-cubas', titulo: 'Memórias Póstumas de Brás Cubas', autor: 'Machado de Assis', ano: 1881, cats: ['Realismo', 'Sátira', 'Brasileiros'],
      cor: ['#18181b', '#44403c', '#d6d3d1'], trad: BIB_ORIG_BR,
      sinopse: 'Um defunto autor resolve escrever suas memórias depois de morto e, livre de qualquer vergonha, conta uma vida de privilégios, amores e fracassos com ironia afiada. O livro que inaugurou o Realismo no Brasil.' },
    { id: 'cortico', titulo: 'O Cortiço', autor: 'Aluísio Azevedo', ano: 1890, cats: ['Naturalismo', 'Drama', 'Brasileiros'],
      cor: ['#78350f', '#b45309', '#fde68a'], trad: BIB_ORIG_BR,
      sinopse: 'João Romão enriquece à custa de um cortiço no Rio de Janeiro do século XIX, onde se amontoam lavadeiras, operários e imigrantes. Um retrato coletivo, vivo e brutal da vida popular — marco do Naturalismo brasileiro.' },
    { id: 'policarpo', titulo: 'Triste Fim de Policarpo Quaresma', autor: 'Lima Barreto', ano: 1915, cats: ['Sátira', 'Drama', 'Brasileiros'],
      cor: ['#166534', '#a16207', '#fef08a'], trad: BIB_ORIG_BR,
      sinopse: 'O major Quaresma ama o Brasil acima de tudo: toca modinhas ao violão, quer o tupi como língua oficial e se entrega à lavoura e à pátria. Seu patriotismo ingênuo esbarra numa realidade nada heroica.' }
  ];
  // Contagem de palavras (para o tempo de leitura) — gerada no build.
  var BIB_PALAVRAS = { '1984': 100926, 'revolucao-dos-bichos': 29138, 'metamorfose': 20096, 'processo': 74405,
    'frankenstein': 70953, 'dracula': 157380, 'maquina-do-tempo': 31939, 'guerra-dos-mundos': 59788,
    'dorian-gray': 74555, 'coracao-das-trevas': 36472, 'chamado-da-floresta': 30623, 'cortico': 80573,
    'dom-casmurro': 65464, 'bras-cubas': 60304, 'policarpo': 66515 };
  var BIB_PPM = 220; // palavras por minuto (leitura silenciosa média)

  var BIB_CHAVE_ANON = 'angatuba_biblioteca';
  var BIB_CHAVE_CONTA = 'angatuba_biblioteca_u_';
  var BIB_CHAVE_PREFS = 'angatuba_biblioteca_prefs';
  var BIB_CHAVE_MEDIAS = 'angatuba_biblioteca_medias';
  var BIB_CHAVE_RECUSA = 'angatuba_biblioteca_recusou_';
  var BIB_LISTA_MAX = 60;

  function _bibLivro(id) { for (var i = 0; i < BIB_LIVROS.length; i++) if (BIB_LIVROS[i].id === id) return BIB_LIVROS[i]; return null; }
  function _bibEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function _bibLS(k, v) {
    try {
      if (arguments.length === 1) { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  function _bibMinutos(id) { return Math.max(1, Math.round((BIB_PALAVRAS[id] || 0) / BIB_PPM)); }
  function _bibTempoTxt(min) {
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = Math.round((min % 60) / 10) * 10;
    if (m === 60) { h++; m = 0; }
    return h + 'h' + (m ? m : '');
  }

  /* ══ Estado do usuário (listas + progresso) ═════════════════════ */
  function _bibEstadoVazio() { return { fav: [], lidos: [], quero: [], prog: {}, t: 0 }; }
  function _bibNormalizar(e) {
    var o = _bibEstadoVazio();
    if (!e || typeof e !== 'object') return o;
    ['fav', 'lidos', 'quero'].forEach(function (k) {
      o[k] = (Array.isArray(e[k]) ? e[k] : []).filter(function (id) { return !!_bibLivro(id); }).slice(0, BIB_LISTA_MAX);
    });
    var p = e.prog && typeof e.prog === 'object' ? e.prog : {};
    Object.keys(p).forEach(function (id) {
      var x = p[id];
      if (!_bibLivro(id) || !x) return;
      o.prog[id] = { c: Math.max(0, x.c | 0), p: Math.max(0, x.p | 0), pct: Math.min(1, Math.max(0, +x.pct || 0)), t: +x.t || 0 };
    });
    o.t = +e.t || 0;
    return o;
  }
  function _bibVazio(e) { return !e || (!e.fav.length && !e.lidos.length && !e.quero.length && !Object.keys(e.prog).length); }

  // União das listas + progresso mais recente de cada livro. Nunca perde
  // nada feito num aparelho nem no outro (mesma regra do Aprender).
  function _bibMesclar(a, b) {
    a = _bibNormalizar(a); b = _bibNormalizar(b);
    var o = _bibEstadoVazio();
    ['fav', 'lidos', 'quero'].forEach(function (k) {
      a[k].concat(b[k]).forEach(function (id) { if (o[k].indexOf(id) === -1) o[k].push(id); });
    });
    [a.prog, b.prog].forEach(function (p) {
      Object.keys(p).forEach(function (id) { if (!o.prog[id] || p[id].t > o.prog[id].t) o.prog[id] = p[id]; });
    });
    o.t = Math.max(a.t, b.t);
    return o;
  }

  var _bibEstado = null;   // estado em uso (da conta logada ou do aparelho)
  var _bibDono = null;     // uid dono de _bibEstado (null = deslogado)
  var _bibNuvemLida = {};  // uid -> true depois da 1ª leitura do Firestore

  function _bibUid() { return (typeof _cliUser !== 'undefined' && _cliUser && _cliUser.uid) ? _cliUser.uid : null; }
  function _bibChave(uid) { return uid ? BIB_CHAVE_CONTA + uid : BIB_CHAVE_ANON; }

  function _bibCarregarEstado() {
    var uid = _bibUid();
    if (_bibEstado && _bibDono === uid) return;
    _bibDono = uid;
    _bibEstado = _bibNormalizar(_bibLS(_bibChave(uid)));
    if (uid) _bibLerNuvem(uid);
  }

  function _bibSalvar(soLocal) {
    if (!_bibEstado) return;
    _bibEstado.t = Date.now();
    _bibLS(_bibChave(_bibDono), _bibEstado);
    if (!soLocal && _bibDono) _bibAgendarNuvem();
  }

  /* ── Firestore: doc privado biblioteca/{uid} + avaliações ─────── */
  var _bibFbCarregado = null;
  function _bibCarregarFirebase() {
    if (_bibFbCarregado) return _bibFbCarregado;
    _bibFbCarregado = _carregarFirebaseAuthCore().then(function () {
      return _injetarScript(FIREBASE_SDK_BASE + 'firebase-firestore-compat.js');
    }).then(function () {
      if (!window.firebase || !firebase.firestore) throw new Error('Firestore indisponível');
      return firebase.firestore();
    }).catch(function (err) { _bibFbCarregado = null; throw err; });
    return _bibFbCarregado;
  }

  function _bibLerNuvem(uid) {
    _bibCarregarFirebase().then(function (db) {
      return db.collection('biblioteca').doc(uid).get();
    }).then(function (doc) {
      if (_bibDono !== uid) return; // trocou de conta no meio do caminho
      var remoto = doc && doc.exists ? doc.data() : null;
      _bibEstado = _bibMesclar(_bibEstado, remoto);
      _bibNuvemLida[uid] = true;
      _bibSalvar(true);
      if (!remoto || JSON.stringify(_bibNormalizar(remoto)) !== JSON.stringify(_bibEstado)) _bibAgendarNuvem();
      _bibRerender();
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[biblioteca] leitura da nuvem falhou:', err && err.message);
    });
  }

  var _bibNuvemTimer = null;
  function _bibAgendarNuvem(imediato) {
    clearTimeout(_bibNuvemTimer);
    _bibNuvemTimer = setTimeout(_bibGravarNuvem, imediato ? 0 : 4000);
  }
  function _bibGravarNuvem() {
    var uid = _bibDono;
    if (!uid || uid !== _bibUid() || !_bibEstado) return;
    var e = _bibEstado;
    _bibCarregarFirebase().then(function (db) {
      return db.collection('biblioteca').doc(uid).set({
        fav: e.fav, lidos: e.lidos, quero: e.quero, prog: e.prog, t: e.t,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[biblioteca] gravação na nuvem falhou:', err && err.message);
    });
  }

  // Chamado pelo app.js quando a conta muda (login/logout).
  function _bibAoMudarConta() {
    if (!_bibEstado) return; // biblioteca nunca aberta nesta sessão
    if (_bibDono && _bibDono !== _bibUid()) _bibGravarNuvem();
    _bibEstado = null;
    _bibCarregarEstado();
    _bibRerender();
  }
  window._bibAoMudarConta = _bibAoMudarConta;

  // Logado, com leituras feitas deslogado neste aparelho: oferece juntar.
  function _bibPrecisaOferecerJuntar() {
    var uid = _bibUid();
    if (!uid) return false;
    if (_bibLS(BIB_CHAVE_RECUSA + uid)) return false;
    return !_bibVazio(_bibNormalizar(_bibLS(BIB_CHAVE_ANON)));
  }
  function _bibJuntar(sim) {
    var uid = _bibUid();
    if (!uid) return;
    if (sim) {
      _bibEstado = _bibMesclar(_bibEstado, _bibLS(BIB_CHAVE_ANON));
      _bibLS(BIB_CHAVE_ANON, null);
      _bibSalvar();
      _bibAgendarNuvem(true);
      if (typeof showToastSimples === 'function') showToastSimples('Leituras guardadas na sua conta! 📚', '/webp/owl-thumbsup.webp');
    } else {
      _bibLS(BIB_CHAVE_RECUSA + uid, 1);
    }
    _bibRerender();
  }
  window._bibJuntar = _bibJuntar;

  /* ── Listas ─────────────────────────────────────────────────── */
  function _bibNaLista(lista, id) { return !!_bibEstado && _bibEstado[lista].indexOf(id) !== -1; }
  function _bibAlternarLista(lista, id, forcar) {
    _bibCarregarEstado();
    var arr = _bibEstado[lista];
    var i = arr.indexOf(id);
    var ligar = (typeof forcar === 'boolean') ? forcar : i === -1;
    if (ligar && i === -1) arr.unshift(id);
    if (!ligar && i !== -1) arr.splice(i, 1);
    // "Já li" tira de "Quero ler" (não faz sentido nos dois).
    if (lista === 'lidos' && ligar) { var q = _bibEstado.quero.indexOf(id); if (q !== -1) _bibEstado.quero.splice(q, 1); }
    if (lista === 'quero' && ligar) { var l = _bibEstado.lidos.indexOf(id); if (l !== -1) _bibEstado.lidos.splice(l, 1); }
    _bibEstado[lista] = arr.slice(0, BIB_LISTA_MAX);
    _bibSalvar();
    return ligar;
  }

  function _bibProgresso(id) { return (_bibEstado && _bibEstado.prog[id]) || null; }
  function _bibContinuar() {
    if (!_bibEstado) return [];
    return Object.keys(_bibEstado.prog)
      .filter(function (id) { var p = _bibEstado.prog[id]; return p.pct > 0.002 && p.pct < 0.995 && !_bibNaLista('lidos', id); })
      .sort(function (a, b) { return _bibEstado.prog[b].t - _bibEstado.prog[a].t; });
  }

  /* ── Preferências do leitor (do aparelho) ───────────────────── */
  var BIB_PREFS_PADRAO = { modo: 'v', tema: 'sepia', fonte: 19, linha: 1.65, familia: 'serif', justificar: false, tela: false, rate: 1, voz: '' };
  var _bibPrefs = (function () {
    var p = _bibLS(BIB_CHAVE_PREFS) || {};
    var o = {};
    Object.keys(BIB_PREFS_PADRAO).forEach(function (k) { o[k] = (p[k] !== undefined) ? p[k] : BIB_PREFS_PADRAO[k]; });
    // Primeira vez: tema escuro se o app estiver no escuro.
    if (!p.tema) o.tema = document.body.classList.contains('light-mode') ? 'sepia' : 'escuro';
    return o;
  })();
  function _bibSalvarPrefs() { _bibLS(BIB_CHAVE_PREFS, _bibPrefs); }

  /* ══ Tela cheia: abrir / fechar / voltar ═════════════════════════
     Pilha de telas: catálogo → livro → leitor. Cada nível empilha uma
     entrada no history (biblioteca-hub / bib-livro / bib-leitor), e o
     botão voltar do Android cai no handler único de popstate do app.js,
     que chama _bibVoltar(true) — um "voltar" desce exatamente um nível.
     Os botões de voltar da própria tela fazem history.back() quando a
     entrada do topo é nossa, então os dois caminhos ficam iguais. */
  var _bibTela = 'catalogo';
  var _bibLivroAberto = null;
  var _bibLeitorDe = 'livro'; // de onde o leitor foi aberto ('livro' | 'catalogo')

  function _bibliotecaAberta() {
    var hub = document.getElementById('biblioteca-hub');
    return !!(hub && hub.style.display !== 'none' && hub.style.display !== '');
  }
  window._bibliotecaAberta = _bibliotecaAberta;

  function _bibGarantirEsqueleto() {
    var hub = document.getElementById('biblioteca-hub');
    if (!hub || hub.getAttribute('data-montado')) return hub;
    hub.setAttribute('data-montado', '1');
    hub.innerHTML =
      '<div id="bib-tela-catalogo" class="bib-tela"></div>' +
      '<div id="bib-tela-livro" class="bib-tela" style="display:none"></div>';
    return hub;
  }

  function _abrirBiblioteca() {
    var hub = _bibGarantirEsqueleto();
    if (!hub) return;
    // Um hub em tela cheia por vez.
    if (typeof _gamesHubAberto === 'function' && _gamesHubAberto() && typeof _fecharGamesHub === 'function') _fecharGamesHub();
    if (typeof _aprenderAberto === 'function' && _aprenderAberto() && typeof _fecharAprender === 'function') _fecharAprender();
    _bibCarregarEstado();
    hub.style.display = 'block';
    document.body.classList.add('biblioteca-fs-open');
    _bibMostrarTela('catalogo');
    // Presença rica: amigos veem "Na Biblioteca" (ver AngatubaPresenca em app.js).
    if (window.AngatubaPresenca && typeof window.AngatubaPresenca.atividade === 'function') {
      window.AngatubaPresenca.atividade('biblioteca', null, 'Na Biblioteca');
    }
    if (history.state?.modal !== 'biblioteca-hub') history.pushState({ modal: 'biblioteca-hub' }, '');
  }
  window._abrirBiblioteca = _abrirBiblioteca;

  function _fecharBiblioteca(viaPopstate) {
    var hub = document.getElementById('biblioteca-hub');
    if (!hub) return;
    _bibFecharLeitor(true);
    _bibFecharSheet();
    hub.style.display = 'none';
    document.body.classList.remove('biblioteca-fs-open');
    _bibTela = 'catalogo';
    if (window.AngatubaPresenca && typeof window.AngatubaPresenca.limparAtividade === 'function') {
      window.AngatubaPresenca.limparAtividade('biblioteca');
    }
    if (!viaPopstate && history.state?.modal === 'biblioteca-hub') { _popstateNosso = true; history.back(); }
  }
  window._fecharBiblioteca = _fecharBiblioteca;

  function _bibEhNosso(s) { return s && (s.modal === 'biblioteca-hub' || s.modal === 'bib-livro' || s.modal === 'bib-leitor'); }

  // Volta UM nível. viaPopstate=true quando quem chamou foi o popstate
  // (a entrada do history já saiu).
  function _bibVoltar(viaPopstate) {
    if (_bibSheetAberto()) {
      _bibFecharSheet();
      // O "voltar" consumiu a entrada do nível atual: devolve.
      if (viaPopstate) history.pushState({ modal: _bibTela === 'leitor' ? 'bib-leitor' : (_bibTela === 'livro' ? 'bib-livro' : 'biblioteca-hub') }, '');
      return;
    }
    if (_bibTela === 'leitor') {
      _bibFecharLeitor();
      _bibMostrarTela(_bibLeitorDe === 'livro' ? 'livro' : 'catalogo');
      return;
    }
    if (_bibTela === 'livro') { _bibMostrarTela('catalogo'); return; }
    _fecharBiblioteca(true);
  }
  window._bibVoltar = _bibVoltar;

  // Botões de voltar desenhados na tela.
  function _bibVoltarUI() {
    if (_bibEhNosso(history.state)) history.back();
    else _bibVoltar(false);
  }
  window._bibVoltarUI = _bibVoltarUI;

  function _bibMostrarTela(nome) {
    _bibTela = nome;
    var cat = document.getElementById('bib-tela-catalogo');
    var liv = document.getElementById('bib-tela-livro');
    if (cat) cat.style.display = nome === 'catalogo' ? 'block' : 'none';
    if (liv) liv.style.display = nome === 'livro' ? 'block' : 'none';
    if (nome === 'catalogo') _bibRenderCatalogo();
    if (nome === 'livro') _bibRenderLivro();
    var hub = document.getElementById('biblioteca-hub');
    if (hub && nome !== 'leitor') hub.scrollTop = nome === 'catalogo' ? _bibScrollCatalogo : 0;
  }

  function _bibRerender() {
    // Painel "Minha conta" (app.js) mostra as listas — atualiza junto.
    if (typeof cliRenderBiblioteca === 'function') cliRenderBiblioteca();
    if (!_bibliotecaAberta()) return;
    if (_bibTela === 'catalogo') _bibRenderCatalogo();
    else if (_bibTela === 'livro') _bibRenderLivro();
  }

  /* ══ Capa ilustrada (/Biblioteca/capas/<id>.jpg) ═══════════════
     O SW guarda as capas no CACHE_BIB (cache-first): vista uma vez,
     aparece offline. Se a imagem falhar, o onerror remove o <img> e
     fica o fallback por baixo: gradiente do livro + título e autor. */
  function _bibCapaHtml(l, tam) {
    tam = tam || 'm';
    return '<div class="bib-capa bib-capa-' + tam + '" style="--c1:' + l.cor[0] + ';--c2:' + l.cor[1] + ';--c3:' + l.cor[2] + '" aria-hidden="true">' +
      '<div class="bib-capa-alt"><div class="bib-capa-titulo">' + _bibEsc(l.titulo) + '</div><div class="bib-capa-autor">' + _bibEsc(l.autor) + '</div></div>' +
      '<img class="bib-capa-img" src="/Biblioteca/capas/' + l.id + '.jpg" alt="" width="480" height="715" decoding="async"' +
      (tam === 'g' ? '' : ' loading="lazy"') + ' onerror="this.remove()">' +
      '</div>';
  }

  /* ── Resumo pro painel "Minha conta" (app.js, cliRenderBiblioteca) ──
     Só leitura: lendo agora (mesma regra de "Continuar lendo"),
     favoritos e quero ler, já com o HTML da capa pequena; mais o total
     de livros distintos nas listas e quantos já foram lidos. */
  function _bibContaDados() {
    _bibCarregarEstado();
    var e = _bibEstado;
    function info(id) {
      var l = _bibLivro(id);
      if (!l) return null;
      var p = e.prog[id];
      return { id: l.id, titulo: l.titulo, autor: l.autor, pct: p ? p.pct : 0, capa: _bibCapaHtml(l, 'p') };
    }
    function lista(ids) { return ids.map(info).filter(Boolean); }
    var lendo = _bibContinuar();
    var todos = {};
    [lendo, e.fav, e.quero, e.lidos].forEach(function (a) { a.forEach(function (id) { todos[id] = 1; }); });
    return { lendo: lista(lendo), fav: lista(e.fav), quero: lista(e.quero), lidos: e.lidos.length, total: Object.keys(todos).length };
  }
  window.bibContaDados = _bibContaDados;

  /* ══ Catálogo ═══════════════════════════════════════════════════ */
  var _bibFiltro = { aba: 'acervo', cat: '', autor: '', busca: '' };
  var _bibScrollCatalogo = 0;

  function _bibNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function _bibFiltrados() {
    var b = _bibNorm(_bibFiltro.busca).trim();
    return BIB_LIVROS.filter(function (l) {
      if (_bibFiltro.cat && l.cats.indexOf(_bibFiltro.cat) === -1) return false;
      if (_bibFiltro.autor && l.autor !== _bibFiltro.autor) return false;
      if (b && _bibNorm(l.titulo + ' ' + l.autor).indexOf(b) === -1) return false;
      return true;
    });
  }

  function _bibMedias() { return _bibLS(BIB_CHAVE_MEDIAS) || {}; }

  function _bibCardHtml(l) {
    var p = _bibProgresso(l.id);
    var media = _bibMedias()[l.id];
    var selos = '';
    if (_bibNaLista('fav', l.id)) selos += '<i class="fa-solid fa-heart" title="Favorito"></i>';
    if (_bibNaLista('lidos', l.id)) selos += '<i class="fa-solid fa-circle-check" title="Já li"></i>';
    else if (_bibNaLista('quero', l.id)) selos += '<i class="fa-solid fa-bookmark" title="Quero ler"></i>';
    return '<button type="button" class="bib-card" data-livro="' + l.id + '" aria-label="' + _bibEsc(l.titulo + ', de ' + l.autor) + '">' +
      '<div class="bib-card-capa">' + _bibCapaHtml(l, 'm') +
      (selos ? '<div class="bib-card-selos">' + selos + '</div>' : '') +
      (p && p.pct > 0.002 && !_bibNaLista('lidos', l.id) ? '<div class="bib-card-barra"><div style="width:' + Math.round(p.pct * 100) + '%"></div></div>' : '') +
      '</div>' +
      '<div class="bib-card-titulo">' + _bibEsc(l.titulo) + '</div>' +
      '<div class="bib-card-autor">' + _bibEsc(l.autor) + '</div>' +
      '<div class="bib-card-meta"><span><i class="fa-regular fa-clock"></i> ' + _bibTempoTxt(_bibMinutos(l.id)) + '</span>' +
      (media && media.n ? '<span class="bib-card-nota"><i class="fa-solid fa-star"></i> ' + media.m.toFixed(1).replace('.', ',') + '</span>' : '') +
      '</div></button>';
  }

  function _bibChipsHtml(valores, atual, tipo) {
    return '<div class="bib-chips" role="group" data-tipo="' + tipo + '">' +
      '<button type="button" class="bib-chip' + (!atual ? ' ativo' : '') + '" data-valor="">Todos</button>' +
      valores.map(function (v) {
        return '<button type="button" class="bib-chip' + (atual === v ? ' ativo' : '') + '" data-valor="' + _bibEsc(v) + '">' + _bibEsc(v) + '</button>';
      }).join('') + '</div>';
  }

  function _bibCategorias() {
    var vistas = [];
    BIB_LIVROS.forEach(function (l) { l.cats.forEach(function (c) { if (vistas.indexOf(c) === -1) vistas.push(c); }); });
    var ordem = ['Brasileiros', 'Estrangeiros', 'Leitura rápida'];
    return ordem.concat(vistas.filter(function (c) { return ordem.indexOf(c) === -1; }).sort(function (a, b) { return a.localeCompare(b, 'pt'); }));
  }
  function _bibAutores() {
    var a = [];
    BIB_LIVROS.forEach(function (l) { if (a.indexOf(l.autor) === -1) a.push(l.autor); });
    return a.sort(function (x, y) { return x.localeCompare(y, 'pt'); });
  }

  function _bibContinuarHtml() {
    var ids = _bibContinuar();
    if (!ids.length) return '';
    return '<section class="bib-secao"><h3 class="bib-secao-titulo"><i class="fa-solid fa-book-open-reader"></i> Continuar lendo</h3>' +
      '<div class="bib-continuar">' + ids.map(function (id) {
        var l = _bibLivro(id), p = _bibEstado.prog[id];
        return '<button type="button" class="bib-cont-item" data-ler="' + id + '">' +
          _bibCapaHtml(l, 'p') +
          '<div class="bib-cont-txt"><div class="bib-cont-titulo">' + _bibEsc(l.titulo) + '</div>' +
          '<div class="bib-cont-sub">' + Math.round(p.pct * 100) + '% lido</div>' +
          '<div class="bib-cont-barra"><div style="width:' + Math.round(p.pct * 100) + '%"></div></div>' +
          '<div class="bib-cont-cta"><i class="fa-solid fa-play"></i> Continuar</div></div></button>';
      }).join('') + '</div></section>';
  }

  function _bibJuntarHtml() {
    if (!_bibPrecisaOferecerJuntar()) return '';
    return '<div class="bib-aviso"><img src="/webp/owl-idea.webp" alt="" onerror="this.style.display=\'none\'">' +
      '<div class="bib-aviso-txt"><b>Leituras deste aparelho</b><span>Você leu ou salvou livros antes de entrar. Quer guardar tudo na sua conta?</span>' +
      '<div class="bib-aviso-acoes"><button type="button" class="bib-btn bib-btn-pri" onclick="_bibJuntar(true)">Juntar à conta</button>' +
      '<button type="button" class="bib-btn bib-btn-sec" onclick="_bibJuntar(false)">Agora não</button></div></div></div>';
  }

  function _bibRenderCatalogo() {
    var tela = document.getElementById('bib-tela-catalogo');
    if (!tela) return;
    _bibCarregarEstado();
    var html =
      '<div class="bib-head">' +
      '<button type="button" class="games-sair-btn" onclick="_bibVoltarUI()" aria-label="Voltar para a tela inicial" title="Voltar ao início"><i class="fa fa-chevron-left"></i></button>' +
      '<div class="bib-head-txt"><h2 class="bib-head-titulo">Biblioteca <span>da Coruja</span></h2>' +
      '<p class="bib-head-sub">Clássicos completos, de graça e offline 🦉</p></div></div>' +
      _bibJuntarHtml() +
      '<div class="bib-abas" role="tablist">' +
      '<button type="button" role="tab" class="bib-aba' + (_bibFiltro.aba === 'acervo' ? ' ativa' : '') + '" data-aba="acervo" aria-selected="' + (_bibFiltro.aba === 'acervo') + '"><i class="fa-solid fa-book"></i> Acervo</button>' +
      '<button type="button" role="tab" class="bib-aba' + (_bibFiltro.aba === 'listas' ? ' ativa' : '') + '" data-aba="listas" aria-selected="' + (_bibFiltro.aba === 'listas') + '"><i class="fa-solid fa-bookmark"></i> Minhas listas</button>' +
      '</div>';
    if (_bibFiltro.aba === 'acervo') {
      var lista = _bibFiltrados();
      var temFiltro = !!(_bibFiltro.cat || _bibFiltro.autor || _bibFiltro.busca);
      html += _bibContinuarHtml() +
        '<div class="bib-busca"><i class="fa-solid fa-magnifying-glass"></i>' +
        '<input type="search" id="bib-busca" placeholder="Buscar título ou autor" value="' + _bibEsc(_bibFiltro.busca) + '" autocomplete="off" aria-label="Buscar título ou autor"></div>' +
        '<div class="bib-filtro"><div class="bib-filtro-rot">Categoria</div>' + _bibChipsHtml(_bibCategorias(), _bibFiltro.cat, 'cat') + '</div>' +
        '<div class="bib-filtro"><div class="bib-filtro-rot">Autor</div>' + _bibChipsHtml(_bibAutores(), _bibFiltro.autor, 'autor') + '</div>' +
        '<div class="bib-resultado"><span>' + lista.length + (lista.length === 1 ? ' livro' : ' livros') + '</span>' +
        (temFiltro ? '<button type="button" class="bib-limpar" id="bib-limpar"><i class="fa-solid fa-xmark"></i> Limpar filtros</button>' : '') + '</div>' +
        (lista.length
          ? '<div class="bib-grade">' + lista.map(_bibCardHtml).join('') + '</div>'
          : '<div class="bib-vazio"><img src="/webp/owl-search.webp" alt="" onerror="this.style.display=\'none\'"><p>Nenhum livro com esses filtros.</p><button type="button" class="bib-btn bib-btn-sec" id="bib-limpar2">Limpar filtros</button></div>');
    } else {
      html += _bibListasHtml();
    }
    html += '<p class="bib-rodape">Todas as obras estão em domínio público. 📖</p>';
    tela.innerHTML = html;
    _bibLigarCatalogo(tela);
  }

  function _bibListasHtml() {
    var html = '';
    if (!_bibUid()) {
      html += '<div class="bib-aviso"><img src="/webp/owl-phone.webp" alt="" onerror="this.style.display=\'none\'">' +
        '<div class="bib-aviso-txt"><b>Suas listas ficam só neste aparelho</b><span>Entre na sua conta para levar favoritos e progresso para qualquer celular.</span>' +
        '<div class="bib-aviso-acoes"><button type="button" class="bib-btn bib-btn-pri" data-login="1">Entrar</button></div></div></div>';
    }
    var secoes = [
      { ids: _bibContinuar(), titulo: 'Continuar lendo', icone: 'fa-book-open-reader', vazio: 'Comece um livro e ele aparece aqui.' },
      { ids: _bibEstado.fav, titulo: 'Favoritos', icone: 'fa-heart', vazio: 'Toque no coração de um livro para favoritar.' },
      { ids: _bibEstado.quero, titulo: 'Quero ler', icone: 'fa-bookmark', vazio: 'Guarde aqui os próximos da fila.' },
      { ids: _bibEstado.lidos, titulo: 'Já li', icone: 'fa-circle-check', vazio: 'Os livros que você terminar aparecem aqui.' }
    ];
    secoes.forEach(function (s) {
      html += '<section class="bib-secao"><h3 class="bib-secao-titulo"><i class="fa-solid ' + s.icone + '"></i> ' + s.titulo +
        (s.ids.length ? ' <span class="bib-secao-n">' + s.ids.length + '</span>' : '') + '</h3>' +
        (s.ids.length
          ? '<div class="bib-grade">' + s.ids.map(function (id) { return _bibCardHtml(_bibLivro(id)); }).join('') + '</div>'
          : '<p class="bib-secao-vazio">' + s.vazio + '</p>') +
        '</section>';
    });
    return html;
  }

  function _bibLigarCatalogo(tela) {
    tela.querySelectorAll('.bib-aba').forEach(function (b) {
      b.addEventListener('click', function () { _bibFiltro.aba = b.dataset.aba; _bibRenderCatalogo(); });
    });
    tela.querySelectorAll('.bib-chips').forEach(function (g) {
      g.addEventListener('click', function (ev) {
        var b = ev.target.closest('.bib-chip');
        if (!b) return;
        var tipo = g.dataset.tipo, v = b.dataset.valor;
        _bibFiltro[tipo] = (_bibFiltro[tipo] === v) ? '' : v;
        var x = g.scrollLeft;
        _bibRenderCatalogo();
        var novo = document.querySelector('.bib-chips[data-tipo="' + tipo + '"]');
        if (novo) novo.scrollLeft = x;
      });
    });
    var busca = document.getElementById('bib-busca');
    if (busca) {
      var t = null;
      busca.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          _bibFiltro.busca = busca.value;
          var pos = busca.selectionStart;
          _bibRenderCatalogo();
          var nb = document.getElementById('bib-busca');
          if (nb) { nb.focus(); try { nb.setSelectionRange(pos, pos); } catch (e) {} }
        }, 220);
      });
    }
    ['bib-limpar', 'bib-limpar2'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener('click', function () { _bibFiltro.cat = ''; _bibFiltro.autor = ''; _bibFiltro.busca = ''; _bibRenderCatalogo(); });
    });
    tela.querySelectorAll('[data-livro]').forEach(function (b) {
      b.addEventListener('click', function () { _bibAbrirLivro(b.dataset.livro); });
    });
    tela.querySelectorAll('[data-ler]').forEach(function (b) {
      b.addEventListener('click', function () { _bibLeitorDe = 'catalogo'; _bibAbrirLeitor(b.dataset.ler); });
    });
    tela.querySelectorAll('[data-login]').forEach(function (b) {
      b.addEventListener('click', function () { if (typeof cliAbrirLogin === 'function') cliAbrirLogin('Entre para guardar seus livros, favoritos e progresso de leitura na sua conta.'); });
    });
  }

  /* ══ Texto do livro (JSON sob demanda, cacheado pelo SW) ═════════ */
  var _bibTextos = {};       // id -> { caps:[{t,s,p:[]}], tam:[chars por cap], total }
  var _bibBaixando = {};
  function _bibCarregarTexto(id) {
    if (_bibTextos[id]) return Promise.resolve(_bibTextos[id]);
    if (_bibBaixando[id]) return _bibBaixando[id];
    _bibBaixando[id] = fetch('/Biblioteca/livros/' + id + '.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      var tam = d.caps.map(function (c) { return c.p.reduce(function (s, p) { return s + p.length; }, 0) + 1; });
      var o = { caps: d.caps, tam: tam, total: tam.reduce(function (a, b) { return a + b; }, 0) };
      _bibTextos[id] = o;
      delete _bibBaixando[id];
      return o;
    }).catch(function (err) { delete _bibBaixando[id]; throw err; });
    return _bibBaixando[id];
  }

  // Já está guardado para ler offline? (best-effort; sem Cache API, "não sei")
  function _bibEstaOffline(id) {
    if (!('caches' in window)) return Promise.resolve(false);
    return caches.match('/Biblioteca/livros/' + id + '.json').then(function (r) { return !!r; }).catch(function () { return false; });
  }

  function _bibPct(texto, c, p) {
    if (!texto) return 0;
    var antes = 0;
    for (var i = 0; i < c && i < texto.tam.length; i++) antes += texto.tam[i];
    var cap = texto.caps[c];
    var frac = cap && cap.p.length ? Math.min(1, p / cap.p.length) : 0;
    return Math.min(1, (antes + frac * (texto.tam[c] || 0)) / texto.total);
  }

  /* ══ Página do livro ════════════════════════════════════════════ */
  function _bibAbrirLivro(id) {
    if (!_bibLivro(id)) return;
    var hub = document.getElementById('biblioteca-hub');
    if (hub && _bibTela === 'catalogo') _bibScrollCatalogo = hub.scrollTop;
    _bibLivroAberto = id;
    _bibSumarioAberto = false;
    _bibMinhaNota = 0;
    _bibMostrarTela('livro');
    history.pushState({ modal: 'bib-livro' }, '');
    _bibCarregarAvaliacoes(id);
  }
  window._bibAbrirLivro = _bibAbrirLivro;

  var _bibSumarioAberto = false;

  function _bibEstrelasHtml(n, classe) {
    var h = '';
    for (var i = 1; i <= 5; i++) {
      var cheia = n >= i - 0.25, meia = !cheia && n >= i - 0.75;
      h += '<i class="fa-' + (cheia || meia ? 'solid' : 'regular') + ' fa-star' + (meia ? '-half-stroke' : '') + '"></i>';
    }
    return '<span class="bib-estrelas ' + (classe || '') + '" aria-label="' + n.toFixed(1) + ' de 5">' + h + '</span>';
  }

  function _bibRenderLivro() {
    var tela = document.getElementById('bib-tela-livro');
    var l = _bibLivro(_bibLivroAberto);
    if (!tela || !l) return;
    _bibCarregarEstado();
    var p = _bibProgresso(l.id);
    var lido = _bibNaLista('lidos', l.id);
    var comecou = p && p.pct > 0.002 && p.pct < 0.995;
    var texto = _bibTextos[l.id];
    var html =
      '<div class="bib-livro-topo"><button type="button" class="games-sair-btn" onclick="_bibVoltarUI()" aria-label="Voltar ao acervo"><i class="fa fa-chevron-left"></i></button></div>' +
      '<div class="bib-livro-hero" style="--c1:' + l.cor[0] + ';--c2:' + l.cor[1] + '">' +
      _bibCapaHtml(l, 'g') +
      '<h2 class="bib-livro-titulo">' + _bibEsc(l.titulo) + '</h2>' +
      '<div class="bib-livro-autor">' + _bibEsc(l.autor) + ' · ' + l.ano + '</div>' +
      '<div class="bib-livro-cats">' + l.cats.map(function (c) { return '<span class="bib-tag">' + _bibEsc(c) + '</span>'; }).join('') + '</div>' +
      '<div class="bib-livro-meta"><span><i class="fa-regular fa-clock"></i> ' + _bibTempoTxt(_bibMinutos(l.id)) + ' de leitura</span>' +
      '<span id="bib-livro-media"></span><span id="bib-livro-offline"></span></div>' +
      '</div>' +
      '<div class="bib-livro-acoes">' +
      '<button type="button" class="bib-btn bib-btn-pri bib-btn-ler" id="bib-ler"><i class="fa-solid fa-book-open"></i> ' +
      (comecou ? 'Continuar · ' + Math.round(p.pct * 100) + '%' : (lido ? 'Ler de novo' : 'Ler agora')) + '</button>' +
      '<button type="button" class="bib-btn bib-btn-sec" id="bib-ouvir"' + (_bibTtsSuportado() ? '' : ' disabled title="Seu navegador não tem leitura em voz alta"') + '><i class="fa-solid fa-headphones"></i> Ouvir</button>' +
      '</div>' +
      '<div class="bib-livro-listas">' +
      _bibToggleHtml('fav', l.id, 'fa-heart', 'Favorito') +
      _bibToggleHtml('quero', l.id, 'fa-bookmark', 'Quero ler') +
      _bibToggleHtml('lidos', l.id, 'fa-circle-check', 'Já li') +
      '</div>' +
      '<section class="bib-bloco"><h3>Sinopse</h3><p class="bib-sinopse">' + _bibEsc(l.sinopse) + '</p></section>' +
      '<section class="bib-bloco"><button type="button" class="bib-sumario-btn" id="bib-sumario-btn" aria-expanded="' + _bibSumarioAberto + '">' +
      '<span><i class="fa-solid fa-list-ul"></i> Capítulos' + (texto ? ' (' + texto.caps.length + ')' : '') + '</span><i class="fa-solid fa-chevron-' + (_bibSumarioAberto ? 'up' : 'down') + '"></i></button>' +
      '<div id="bib-sumario-livro" class="bib-sumario-lista"' + (_bibSumarioAberto ? '' : ' hidden') + '></div></section>' +
      '<section class="bib-bloco" id="bib-avaliacoes">' + _bibAvaliacoesHtml(l.id) + '</section>' +
      '<section class="bib-bloco bib-edicao"><h3>Sobre esta edição</h3><p>' + _bibEsc(l.trad) + '</p>' +
      '<p>Obra em domínio público. Leitura gratuita dentro do AngatubaON.</p></section>';
    tela.innerHTML = html;

    document.getElementById('bib-ler').addEventListener('click', function () {
      _bibLeitorDe = 'livro';
      if (lido && !comecou && p) { _bibEstado.prog[l.id] = { c: 0, p: 0, pct: 0, t: Date.now() }; _bibSalvar(); }
      _bibAbrirLeitor(l.id);
    });
    document.getElementById('bib-ouvir').addEventListener('click', function () { _bibTtsDesbloquear(); _bibLeitorDe = 'livro'; _bibAbrirLeitor(l.id, { ouvir: true }); });
    tela.querySelectorAll('[data-lista]').forEach(function (b) {
      b.addEventListener('click', function () {
        var on = _bibAlternarLista(b.dataset.lista, l.id);
        b.classList.toggle('ativo', on);
        b.setAttribute('aria-pressed', on);
        if (b.dataset.lista !== 'fav') _bibRenderLivro(); // quero/lidos se excluem
        if (on && navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} }
      });
    });
    document.getElementById('bib-sumario-btn').addEventListener('click', function () {
      _bibSumarioAberto = !_bibSumarioAberto;
      _bibRenderLivro();
    });
    if (_bibSumarioAberto) _bibPreencherSumarioLivro(l.id);
    _bibLigarAvaliacao(l.id);
    _bibAtualizarMediaTopo(l.id);
    _bibEstaOffline(l.id).then(function (ok) {
      var el = document.getElementById('bib-livro-offline');
      if (el && ok && _bibLivroAberto === l.id) el.innerHTML = '<i class="fa-solid fa-circle-check"></i> Disponível offline';
    });
  }

  function _bibToggleHtml(lista, id, icone, rotulo) {
    var on = _bibNaLista(lista, id);
    return '<button type="button" class="bib-toggle' + (on ? ' ativo' : '') + '" data-lista="' + lista + '" aria-pressed="' + on + '">' +
      '<i class="fa-solid ' + icone + '"></i><span>' + rotulo + '</span></button>';
  }

  function _bibPreencherSumarioLivro(id) {
    var box = document.getElementById('bib-sumario-livro');
    if (!box) return;
    box.innerHTML = '<div class="bib-carregando"><span class="bib-spinner"></span> Carregando capítulos…</div>';
    _bibCarregarTexto(id).then(function (tx) {
      if (_bibLivroAberto !== id) return;
      var b = document.getElementById('bib-sumario-livro');
      if (!b) return;
      var p = _bibProgresso(id);
      b.innerHTML = _bibSumarioItensHtml(tx, p ? p.c : -1);
      b.querySelectorAll('[data-cap]').forEach(function (it) {
        it.addEventListener('click', function () { _bibLeitorDe = 'livro'; _bibAbrirLeitor(id, { cap: +it.dataset.cap }); });
      });
      var btn = document.getElementById('bib-sumario-btn');
      if (btn) btn.querySelector('span').innerHTML = '<i class="fa-solid fa-list-ul"></i> Capítulos (' + tx.caps.length + ')';
    }).catch(function () {
      var b = document.getElementById('bib-sumario-livro');
      if (b) b.innerHTML = '<p class="bib-erro">Sem conexão para baixar o livro agora.</p>';
    });
  }

  function _bibSumarioItensHtml(tx, atual) {
    return tx.caps.map(function (c, i) {
      return '<button type="button" class="bib-sum-item' + (i === atual ? ' atual' : '') + (i < atual ? ' lido' : '') + '" data-cap="' + i + '">' +
        '<span class="bib-sum-t">' + _bibEsc(c.t) + '</span>' + (c.s ? '<span class="bib-sum-s">' + _bibEsc(c.s) + '</span>' : '') +
        (i === atual ? '<i class="fa-solid fa-bookmark"></i>' : '') + '</button>';
    }).join('');
  }

  /* ── Avaliações (Firestore, públicas) ─────────────────────────
     biblioteca_avaliacoes/{livro}/notas/{uid}: uma nota por conta,
     regravável. A média é calculada no cliente sobre as últimas 300
     (escala de cidade; dá pra trocar por agregação no servidor se
     um dia passar disso). Médias ficam num cache local pra aparecer
     nos cards do catálogo sem ler o Firestore 15 vezes. */
  var _bibAval = {};  // id -> { carregando, erro, media, n, lista:[{uid,nome,photoURL,nota,comentario,t}], minha }
  var _bibMinhaNota = 0;

  function _bibCarregarAvaliacoes(id, forcar) {
    if (_bibAval[id] && !_bibAval[id].erro && !forcar) { _bibAtualizarAvaliacoesDom(id); return; }
    _bibAval[id] = { carregando: true };
    _bibAtualizarAvaliacoesDom(id);
    _bibCarregarFirebase().then(function (db) {
      return db.collection('biblioteca_avaliacoes').doc(id).collection('notas').orderBy('atualizadoEm', 'desc').limit(300).get();
    }).then(function (snap) {
      var lista = [], soma = 0, minha = null, uid = _bibUid();
      snap.forEach(function (d) {
        var x = d.data() || {};
        var n = Math.max(1, Math.min(5, x.nota | 0));
        soma += n;
        var item = { uid: d.id, nome: x.nome || 'Leitor', photoURL: x.photoURL || '', nota: n, comentario: x.comentario || '', t: x.atualizadoEm && x.atualizadoEm.toDate ? x.atualizadoEm.toDate() : null };
        lista.push(item);
        if (uid && d.id === uid) minha = item;
      });
      var o = { media: lista.length ? soma / lista.length : 0, n: lista.length, lista: lista, minha: minha };
      _bibAval[id] = o;
      var medias = _bibMedias();
      if (o.n) medias[id] = { m: Math.round(o.media * 10) / 10, n: o.n }; else delete medias[id];
      _bibLS(BIB_CHAVE_MEDIAS, medias);
      _bibAtualizarAvaliacoesDom(id);
    }).catch(function (err) {
      _bibAval[id] = { erro: true };
      _bibAtualizarAvaliacoesDom(id);
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[biblioteca] avaliações:', err && err.message);
    });
  }

  function _bibAtualizarMediaTopo(id) {
    var el = document.getElementById('bib-livro-media');
    var a = _bibAval[id];
    if (!el) return;
    el.innerHTML = (a && a.n) ? '<i class="fa-solid fa-star"></i> ' + a.media.toFixed(1).replace('.', ',') + ' (' + a.n + ')' : '';
  }

  function _bibAtualizarAvaliacoesDom(id) {
    if (_bibTela !== 'livro' || _bibLivroAberto !== id) return;
    var box = document.getElementById('bib-avaliacoes');
    if (!box) return;
    box.innerHTML = _bibAvaliacoesHtml(id);
    _bibLigarAvaliacao(id);
    _bibAtualizarMediaTopo(id);
  }

  function _bibAvaliacoesHtml(id) {
    var a = _bibAval[id] || { carregando: true };
    var h = '<h3>Avaliações</h3>';
    if (a.carregando) return h + '<div class="bib-carregando"><span class="bib-spinner"></span> Carregando avaliações…</div>';
    if (a.erro) return h + '<p class="bib-erro">Não deu pra carregar as avaliações agora. <button type="button" class="bib-link" id="bib-aval-retry">Tentar de novo</button></p>';
    h += a.n
      ? '<div class="bib-media"><div class="bib-media-num">' + a.media.toFixed(1).replace('.', ',') + '</div><div>' + _bibEstrelasHtml(a.media, 'bib-estrelas-g') +
        '<div class="bib-media-n">' + a.n + (a.n === 1 ? ' avaliação' : ' avaliações') + '</div></div></div>'
      : '<p class="bib-secao-vazio">Ninguém avaliou ainda. Seja a primeira pessoa! ⭐</p>';
    // Formulário
    if (_bibUid()) {
      var minha = a.minha;
      if (!_bibMinhaNota && minha) _bibMinhaNota = minha.nota;
      h += '<div class="bib-minha"><div class="bib-minha-rot">' + (minha ? 'Sua avaliação' : 'Avalie este livro') + '</div>' +
        '<div class="bib-estrelas-input" role="radiogroup" aria-label="Nota de 1 a 5">' +
        [1, 2, 3, 4, 5].map(function (i) {
          return '<button type="button" role="radio" aria-checked="' + (_bibMinhaNota === i) + '" aria-label="' + i + (i === 1 ? ' estrela' : ' estrelas') + '" data-nota="' + i + '" class="' + (i <= _bibMinhaNota ? 'on' : '') + '"><i class="fa-' + (i <= _bibMinhaNota ? 'solid' : 'regular') + ' fa-star"></i></button>';
        }).join('') + '</div>' +
        '<textarea id="bib-comentario" maxlength="500" rows="3" placeholder="Conte o que achou (opcional)">' + _bibEsc(minha ? minha.comentario : '') + '</textarea>' +
        '<div class="bib-minha-acoes"><span class="bib-minha-cont" id="bib-com-cont"></span>' +
        '<button type="button" class="bib-btn bib-btn-pri" id="bib-publicar"' + (_bibMinhaNota ? '' : ' disabled') + '>' + (minha ? 'Atualizar' : 'Publicar') + '</button></div></div>';
    } else {
      h += '<div class="bib-minha bib-minha-off"><span>Entre na sua conta para avaliar.</span><button type="button" class="bib-btn bib-btn-sec" data-login="aval">Entrar</button></div>';
    }
    var comComentario = (a.lista || []).filter(function (x) { return x.comentario; }).slice(0, 30);
    if (comComentario.length) {
      h += '<div class="bib-comentarios">' + comComentario.map(function (x) {
        var data = x.t ? x.t.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        return '<div class="bib-com"><div class="bib-com-topo">' +
          (x.photoURL ? '<img src="' + _bibEsc(x.photoURL) + '" alt="" class="bib-com-av" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '<span class="bib-com-av bib-com-av-ini">' + _bibEsc((x.nome || '?').charAt(0).toUpperCase()) + '</span>') +
          '<div><div class="bib-com-nome">' + _bibEsc(x.nome) + '</div>' + _bibEstrelasHtml(x.nota, 'bib-estrelas-p') + '</div>' +
          '<span class="bib-com-data">' + data + '</span></div>' +
          '<p class="bib-com-txt">' + _bibEsc(x.comentario) + '</p></div>';
      }).join('') + '</div>';
    }
    return h;
  }

  function _bibLigarAvaliacao(id) {
    var retry = document.getElementById('bib-aval-retry');
    if (retry) retry.addEventListener('click', function () { _bibCarregarAvaliacoes(id, true); });
    var box = document.getElementById('bib-avaliacoes');
    if (!box) return;
    box.querySelectorAll('[data-nota]').forEach(function (b) {
      b.addEventListener('click', function () {
        _bibMinhaNota = +b.dataset.nota;
        var com = document.getElementById('bib-comentario');
        var txt = com ? com.value : '';
        _bibAtualizarAvaliacoesDom(id);
        var c2 = document.getElementById('bib-comentario');
        if (c2) c2.value = txt;
      });
    });
    box.querySelectorAll('[data-login]').forEach(function (b) {
      b.addEventListener('click', function () { if (typeof cliAbrirLogin === 'function') cliAbrirLogin('Entre para avaliar livros e ver suas listas em qualquer aparelho.'); });
    });
    var com = document.getElementById('bib-comentario');
    var cont = document.getElementById('bib-com-cont');
    if (com && cont) {
      var atualizar = function () { cont.textContent = com.value.length ? com.value.length + '/500' : ''; };
      com.addEventListener('input', atualizar); atualizar();
    }
    var pub = document.getElementById('bib-publicar');
    if (pub) pub.addEventListener('click', function () { _bibPublicarAvaliacao(id); });
  }

  function _bibPublicarAvaliacao(id) {
    var uid = _bibUid();
    if (!uid || !_bibMinhaNota) return;
    var nome = (typeof cliNomeExibicao === 'function' && cliNomeExibicao()) || 'Leitor';
    if (nome.length < 2) nome = nome + '.';
    var foto = (_cliUser && _cliUser.photoURL) || '';
    if (!/^https:\/\/(lh3\.googleusercontent\.com|res\.cloudinary\.com)\//.test(foto) || foto.length >= 300) foto = '';
    var com = document.getElementById('bib-comentario');
    var texto = com ? com.value.replace(/\s+\n/g, '\n').trim().slice(0, 500) : '';
    var pub = document.getElementById('bib-publicar');
    if (pub) { pub.disabled = true; pub.textContent = 'Enviando…'; }
    _bibCarregarFirebase().then(function (db) {
      return db.collection('biblioteca_avaliacoes').doc(id).collection('notas').doc(uid).set({
        uid: uid, nome: nome.slice(0, 20), photoURL: foto, nota: _bibMinhaNota, comentario: texto,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }).then(function () {
      if (typeof showToastSimples === 'function') showToastSimples('Avaliação publicada! Obrigado 🦉', '/webp/owl-love.webp');
      _bibCarregarAvaliacoes(id, true);
    }).catch(function (err) {
      if (pub) { pub.disabled = false; pub.textContent = 'Publicar'; }
      if (typeof showToastSimples === 'function') showToastSimples('Não deu pra publicar agora. Tente de novo.', '/webp/owl-sign.webp');
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[biblioteca] publicar:', err && err.message);
    });
  }

  /* ══ LEITOR ══════════════════════════════════════════════════════
     Overlay próprio (fora do #biblioteca-hub) por cima de tudo, com:
     palco (área do texto), barras de cima/baixo que somem sozinhas,
     indicador fixo discreto de progresso, folhas (sumário/ajustes) e o
     mini-player da leitura em voz alta.
     Posição salva = capítulo + índice do 1º parágrafo visível (âncora):
     sobrevive a troca de fonte, de modo (vertical/horizontal) e de
     tamanho de tela, diferente de um pixel de rolagem. */
  var _bibL = null; // { id, tx, c, pagina, paginas, ancora }
  var _bibBarrasTimer = null;
  var _bibSwipeT = 0;

  function _bibLeitorEl() {
    var el = document.getElementById('bib-leitor');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'bib-leitor';
    el.className = 'bib-leitor';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Leitor');
    el.style.display = 'none';
    el.innerHTML =
      '<div class="bib-l-palco" id="bib-l-palco"><div class="bib-l-conteudo" id="bib-l-conteudo" lang="pt-BR"></div></div>' +
      '<div class="bib-l-indicador" id="bib-l-indicador" aria-hidden="true"></div>' +
      '<div class="bib-l-topo" id="bib-l-topo">' +
      '<button type="button" class="bib-l-btn" id="bib-l-voltar" aria-label="Fechar o livro"><i class="fa-solid fa-chevron-left"></i></button>' +
      '<div class="bib-l-titulos"><div class="bib-l-livro" id="bib-l-livro"></div><div class="bib-l-cap" id="bib-l-cap"></div></div>' +
      '<button type="button" class="bib-l-btn" id="bib-l-ouvir" aria-label="Ouvir em voz alta"><i class="fa-solid fa-headphones"></i></button>' +
      '<button type="button" class="bib-l-btn" id="bib-l-sumario" aria-label="Sumário"><i class="fa-solid fa-list-ul"></i></button>' +
      '<button type="button" class="bib-l-btn bib-l-aa" id="bib-l-ajustes" aria-label="Ajustes de leitura">Aa</button>' +
      '</div>' +
      '<div class="bib-l-base" id="bib-l-base">' +
      '<button type="button" class="bib-l-btn" id="bib-l-capant" aria-label="Capítulo anterior"><i class="fa-solid fa-backward-step"></i></button>' +
      '<div class="bib-l-prog"><input type="range" id="bib-l-slider" min="0" max="1000" value="0" aria-label="Posição no livro">' +
      '<div class="bib-l-prog-txt" id="bib-l-prog-txt"></div></div>' +
      '<button type="button" class="bib-l-btn" id="bib-l-capprox" aria-label="Próximo capítulo"><i class="fa-solid fa-forward-step"></i></button>' +
      '</div>' +
      '<div class="bib-tts" id="bib-tts" hidden>' +
      '<button type="button" id="bib-tts-ant" aria-label="Parágrafo anterior"><i class="fa-solid fa-backward"></i></button>' +
      '<button type="button" id="bib-tts-play" class="bib-tts-play" aria-label="Pausar"><i class="fa-solid fa-pause"></i></button>' +
      '<button type="button" id="bib-tts-prox" aria-label="Próximo parágrafo"><i class="fa-solid fa-forward"></i></button>' +
      '<button type="button" id="bib-tts-vel" class="bib-tts-vel" aria-label="Velocidade">1×</button>' +
      '<button type="button" id="bib-tts-fechar" aria-label="Parar leitura em voz alta"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>' +
      '<div class="bib-sheet-fundo" id="bib-sheet-fundo" hidden></div>' +
      '<div class="bib-sheet" id="bib-sheet" role="dialog" aria-modal="true" hidden><div class="bib-sheet-alca"></div><div id="bib-sheet-corpo"></div></div>';
    document.body.appendChild(el);
    _bibLigarLeitor(el);
    return el;
  }

  function _bibAplicarPrefs() {
    var el = document.getElementById('bib-leitor');
    if (!el) return;
    el.classList.remove('bib-tema-claro', 'bib-tema-escuro', 'bib-tema-sepia', 'bib-modo-v', 'bib-modo-h', 'bib-fam-serif', 'bib-fam-sans', 'bib-justificar');
    el.classList.add('bib-tema-' + _bibPrefs.tema, 'bib-modo-' + _bibPrefs.modo, 'bib-fam-' + _bibPrefs.familia);
    if (_bibPrefs.justificar) el.classList.add('bib-justificar');
    el.style.setProperty('--bib-fonte', _bibPrefs.fonte + 'px');
    el.style.setProperty('--bib-linha', _bibPrefs.linha);
    var meta = document.getElementById('meta-theme-color');
    if (meta && _bibTela === 'leitor') meta.setAttribute('content', { claro: '#fbfaf7', escuro: '#121212', sepia: '#f3e9d2' }[_bibPrefs.tema]);
  }

  function _bibAbrirLeitor(id, opts) {
    opts = opts || {};
    var l = _bibLivro(id);
    if (!l) return;
    _bibCarregarEstado();
    var el = _bibLeitorEl();
    var anterior = _bibTela;
    _bibTela = 'leitor';
    _bibAplicarPrefs();
    el.style.display = 'flex';
    document.body.classList.add('bib-leitor-open');
    document.getElementById('bib-l-livro').textContent = l.titulo;
    document.getElementById('bib-l-cap').textContent = '';
    var conteudo = document.getElementById('bib-l-conteudo');
    conteudo.style.transform = '';
    conteudo.innerHTML = '<div class="bib-l-carregando"><span class="bib-spinner"></span><p>Abrindo ' + _bibEsc(l.titulo) + '…</p></div>';
    if (history.state?.modal !== 'bib-leitor') history.pushState({ modal: 'bib-leitor' }, '');
    _bibMostrarBarras(true);
    _bibWakeLock();
    _bibL = { id: id, tx: null, c: 0, pagina: 0, paginas: 1, ancora: 0, fimMarcado: false, anterior: anterior };
    _bibCarregarTexto(id).then(function (tx) {
      if (!_bibL || _bibL.id !== id) return;
      _bibL.tx = tx;
      var p = _bibProgresso(id);
      var c = 0, a = 0;
      if (typeof opts.cap === 'number') { c = opts.cap; a = 0; }
      else if (p && p.pct < 0.995) { c = Math.min(p.c, tx.caps.length - 1); a = p.p; }
      _bibIrPara(c, a);
      if (opts.ouvir) setTimeout(function () { _bibTtsIniciar(); }, 250);
      // Guarda o progresso logo de cara: o livro já entra em "Continuar lendo".
      _bibSalvarPosicao(true);
    }).catch(function () {
      if (!_bibL || _bibL.id !== id) return;
      conteudo.innerHTML = '<div class="bib-l-carregando"><img src="/webp/owl-sleeping.webp" alt="" onerror="this.style.display=\'none\'">' +
        '<p>Não consegui baixar este livro agora.<br>Confira a internet — depois de aberto uma vez, ele fica disponível offline.</p>' +
        '<button type="button" class="bib-btn bib-btn-pri" id="bib-l-retry">Tentar de novo</button></div>';
      var r = document.getElementById('bib-l-retry');
      if (r) r.addEventListener('click', function () { _bibFecharLeitorSilencioso(); _bibAbrirLeitor(id, opts); });
    });
  }
  window._bibAbrirLeitor = _bibAbrirLeitor;

  // Fecha sem mexer no history (usado no "tentar de novo").
  function _bibFecharLeitorSilencioso() {
    _bibTtsParar();
    _bibL = null;
  }

  function _bibFecharLeitor(semSalvar) {
    var el = document.getElementById('bib-leitor');
    if (!el || el.style.display === 'none') return;
    if (!semSalvar) _bibSalvarPosicao(true);
    if (_bibDono) _bibAgendarNuvem(true);
    _bibTtsParar();
    _bibFecharSheet();
    el.style.display = 'none';
    document.body.classList.remove('bib-leitor-open');
    _bibLiberarWakeLock();
    // Devolve a cor da barra do sistema ao tema do app.
    if (typeof aplicarTema === 'function') { try { aplicarTema(); } catch (e) {} }
    _bibL = null;
  }

  /* ── Renderização de um capítulo ──────────────────────────────── */
  function _bibParagrafoHtml(txt) {
    return _bibEsc(txt).replace(/_([^_]+)_/g, '<em>$1</em>');
  }

  function _bibRenderCapitulo() {
    var L = _bibL, tx = L.tx, cap = tx.caps[L.c];
    var conteudo = document.getElementById('bib-l-conteudo');
    var ultimo = L.c >= tx.caps.length - 1;
    var l = _bibLivro(L.id);
    var h = '<header class="bib-cap-head">' +
      (cap.s ? '<div class="bib-cap-t">' + _bibEsc(cap.t) + '</div><h2 class="bib-cap-s">' + _bibEsc(cap.s) + '</h2>'
             : '<h2 class="bib-cap-s">' + _bibEsc(cap.t) + '</h2>') +
      '<div class="bib-cap-orn" aria-hidden="true">❦</div></header>';
    for (var i = 0; i < cap.p.length; i++) h += '<p data-i="' + i + '">' + _bibParagrafoHtml(cap.p[i]) + '</p>';
    if (!ultimo) {
      var prox = tx.caps[L.c + 1];
      h += '<div class="bib-fim-cap" id="bib-fim-cap"><div class="bib-fim-orn">❦</div>' +
        '<button type="button" class="bib-btn bib-btn-pri" data-acao="proxcap">Próximo: ' + _bibEsc(prox.s ? prox.t + ' — ' + prox.s : prox.t) + ' <i class="fa-solid fa-arrow-right"></i></button></div>';
    } else {
      h += '<div class="bib-fim-cap bib-fim-livro" id="bib-fim-cap"><img src="/webp/owl-tada.webp" alt="" onerror="this.style.display=\'none\'">' +
        '<div class="bib-fim-tit">Fim</div><p>Você terminou <b>' + _bibEsc(l.titulo) + '</b>. Que tal contar o que achou?</p>' +
        '<button type="button" class="bib-btn bib-btn-pri" data-acao="avaliar"><i class="fa-solid fa-star"></i> Avaliar o livro</button>' +
        '<button type="button" class="bib-btn bib-btn-sec" data-acao="biblioteca">Voltar à biblioteca</button></div>';
    }
    conteudo.innerHTML = h;
    document.getElementById('bib-l-cap').textContent = cap.s ? cap.t + ' — ' + cap.s : cap.t;
    var ant = document.getElementById('bib-l-capant'), px = document.getElementById('bib-l-capprox');
    if (ant) ant.disabled = L.c === 0;
    if (px) px.disabled = ultimo;
  }

  // Dimensiona as colunas do modo horizontal e conta as páginas.
  function _bibLayout() {
    var L = _bibL;
    var palco = document.getElementById('bib-l-palco');
    var conteudo = document.getElementById('bib-l-conteudo');
    if (!L || !palco || !conteudo) return;
    if (_bibPrefs.modo === 'h') {
      var W = palco.clientWidth, H = palco.clientHeight;
      var pad = Math.max(20, Math.min(56, Math.round(W * 0.07)));
      conteudo.style.width = W + 'px';
      conteudo.style.height = H + 'px';
      conteudo.style.padding = '26px ' + pad + 'px 30px';
      conteudo.style.columnWidth = (W - 2 * pad) + 'px';
      conteudo.style.columnGap = (2 * pad) + 'px';
      var fim = document.getElementById('bib-fim-cap') || conteudo.lastElementChild;
      L.W = W;
      L.paginas = Math.max(1, Math.floor(((fim ? fim.offsetLeft : 0) + 1) / W) + 1);
    } else {
      conteudo.style.width = ''; conteudo.style.height = ''; conteudo.style.padding = '';
      conteudo.style.columnWidth = ''; conteudo.style.columnGap = '';
      conteudo.style.transform = '';
      L.paginas = 1;
    }
  }

  function _bibParagrafos() { return document.querySelectorAll('#bib-l-conteudo p[data-i]'); }

  // Índice do 1º parágrafo visível.
  function _bibAncoraAtual() {
    var L = _bibL, ps = _bibParagrafos();
    if (!L || !ps.length) return 0;
    if (_bibPrefs.modo === 'h') {
      var achado = 0;
      for (var i = 0; i < ps.length; i++) {
        var pg = Math.floor((ps[i].offsetLeft + 2) / L.W);
        if (pg <= L.pagina) achado = i; else break;
      }
      return achado;
    }
    var palco = document.getElementById('bib-l-palco');
    var topo = palco.scrollTop + 70;
    for (var j = 0; j < ps.length; j++) {
      if (ps[j].offsetTop + ps[j].offsetHeight > topo) return j;
    }
    return ps.length - 1;
  }

  function _bibIrParaAncora(a, fimDoCap) {
    var L = _bibL, ps = _bibParagrafos();
    var palco = document.getElementById('bib-l-palco');
    if (_bibPrefs.modo === 'h') {
      var pg = 0;
      if (fimDoCap) pg = L.paginas - 1;
      else if (a > 0 && ps[a]) pg = Math.floor((ps[a].offsetLeft + 2) / L.W);
      _bibIrPagina(pg, true);
    } else {
      if (fimDoCap) palco.scrollTop = palco.scrollHeight;
      else palco.scrollTop = (a > 0 && ps[a]) ? Math.max(0, ps[a].offsetTop - 64) : 0;
    }
    _bibAtualizarIndicador();
  }

  function _bibIrPara(c, ancora, fimDoCap) {
    var L = _bibL;
    if (!L || !L.tx) return;
    L.c = Math.max(0, Math.min(c, L.tx.caps.length - 1));
    L.pagina = 0;
    _bibRenderCapitulo();
    _bibLayout();
    _bibIrParaAncora(ancora || 0, fimDoCap);
  }

  function _bibIrPagina(n, semAnimar) {
    var L = _bibL, conteudo = document.getElementById('bib-l-conteudo');
    if (!L || _bibPrefs.modo !== 'h') return;
    L.pagina = Math.max(0, Math.min(n, L.paginas - 1));
    conteudo.style.transition = semAnimar ? 'none' : '';
    conteudo.style.transform = 'translate3d(' + (-L.pagina * L.W) + 'px,0,0)';
    if (semAnimar) { void conteudo.offsetWidth; conteudo.style.transition = ''; }
    _bibAtualizarIndicador();
    _bibAgendarPosicao();
  }

  function _bibAvancar(dir) {
    var L = _bibL;
    if (!L || !L.tx) return;
    if (_bibPrefs.modo === 'h') {
      if (dir > 0) {
        if (L.pagina < L.paginas - 1) _bibIrPagina(L.pagina + 1);
        else if (L.c < L.tx.caps.length - 1) { _bibIrPara(L.c + 1, 0); _bibAgendarPosicao(); }
      } else {
        if (L.pagina > 0) _bibIrPagina(L.pagina - 1);
        else if (L.c > 0) { _bibIrPara(L.c - 1, 0, true); _bibAgendarPosicao(); }
      }
      _bibMostrarBarras(false);
    } else {
      var palco = document.getElementById('bib-l-palco');
      palco.scrollBy({ top: dir * (palco.clientHeight - 80), behavior: 'smooth' });
    }
  }

  function _bibTrocarCapitulo(delta) {
    var L = _bibL;
    if (!L || !L.tx) return;
    var n = L.c + delta;
    if (n < 0 || n >= L.tx.caps.length) return;
    var falando = _bibTts.ativo;
    _bibTtsParar();
    _bibIrPara(n, 0);
    _bibSalvarPosicao();
    if (falando) _bibTtsIniciar();
  }

  /* ── Progresso ─────────────────────────────────────────────────── */
  var _bibPosTimer = null;
  function _bibAgendarPosicao() {
    clearTimeout(_bibPosTimer);
    _bibPosTimer = setTimeout(function () { _bibSalvarPosicao(); }, 500);
  }
  function _bibSalvarPosicao(agora) {
    clearTimeout(_bibPosTimer);
    var L = _bibL;
    if (!L || !L.tx || !_bibEstado) return;
    var a = _bibAncoraAtual();
    L.ancora = a;
    var pct = _bibPct(L.tx, L.c, a);
    var noFim = _bibNoFimDoLivro();
    if (noFim) pct = 1;
    _bibEstado.prog[L.id] = { c: L.c, p: a, pct: Math.round(pct * 1000) / 1000, t: Date.now() };
    if (noFim && !L.fimMarcado) {
      L.fimMarcado = true;
      if (!_bibNaLista('lidos', L.id)) {
        _bibAlternarLista('lidos', L.id, true);
        if (typeof showToastSimples === 'function') showToastSimples('Livro concluído! Foi para "Já li" 🎉', '/webp/owl-trophy.webp');
      }
    }
    _bibSalvar();
    if (agora && _bibDono) _bibAgendarNuvem();
    _bibAtualizarIndicador();
  }

  function _bibNoFimDoLivro() {
    var L = _bibL;
    if (!L || !L.tx || L.c < L.tx.caps.length - 1) return false;
    if (_bibPrefs.modo === 'h') return L.pagina >= L.paginas - 1;
    var palco = document.getElementById('bib-l-palco');
    return palco.scrollTop + palco.clientHeight >= palco.scrollHeight - 40;
  }

  function _bibAtualizarIndicador() {
    var L = _bibL;
    if (!L || !L.tx) return;
    var a = _bibAncoraAtual();
    var pct = _bibNoFimDoLivro() ? 1 : _bibPct(L.tx, L.c, a);
    var ind = document.getElementById('bib-l-indicador');
    var txt = Math.round(pct * 100) + '%';
    if (_bibPrefs.modo === 'h') txt = 'pág. ' + (L.pagina + 1) + ' de ' + L.paginas + ' · ' + txt;
    else {
      var palco = document.getElementById('bib-l-palco');
      var falta = palco.scrollHeight - palco.clientHeight;
      txt = 'cap. ' + Math.round(falta > 0 ? Math.min(100, palco.scrollTop / falta * 100) : 100) + '% · livro ' + txt;
    }
    if (ind) ind.textContent = txt;
    var sl = document.getElementById('bib-l-slider');
    if (sl && !sl._arrastando) sl.value = Math.round(pct * 1000);
    var pt = document.getElementById('bib-l-prog-txt');
    if (pt) pt.textContent = 'Capítulo ' + (L.c + 1) + ' de ' + L.tx.caps.length + ' · ' + Math.round(pct * 100) + '%';
  }

  // Slider da barra de baixo: posição no livro inteiro → capítulo + parágrafo.
  function _bibIrParaPct(f) {
    var L = _bibL;
    if (!L || !L.tx) return;
    var alvo = f * L.tx.total, acc = 0;
    for (var c = 0; c < L.tx.caps.length; c++) {
      if (acc + L.tx.tam[c] >= alvo || c === L.tx.caps.length - 1) {
        var frac = L.tx.tam[c] ? (alvo - acc) / L.tx.tam[c] : 0;
        var a = Math.floor(Math.max(0, Math.min(0.999, frac)) * L.tx.caps[c].p.length);
        var falando = _bibTts.ativo;
        _bibTtsParar();
        _bibIrPara(c, a);
        _bibSalvarPosicao();
        if (falando) _bibTtsIniciar();
        return;
      }
      acc += L.tx.tam[c];
    }
  }

  /* ── Barras que somem ─────────────────────────────────────────── */
  function _bibMostrarBarras(mostrar) {
    var el = document.getElementById('bib-leitor');
    if (!el) return;
    if (typeof mostrar !== 'boolean') mostrar = el.classList.contains('bib-barras-off');
    el.classList.toggle('bib-barras-off', !mostrar);
    clearTimeout(_bibBarrasTimer);
    if (mostrar) _bibBarrasTimer = setTimeout(function () { if (!_bibSheetAberto()) el.classList.add('bib-barras-off'); }, 4000);
  }

  /* ── Eventos do leitor (ligados uma vez, na criação do overlay) ── */
  function _bibLigarLeitor(el) {
    var palco = document.getElementById('bib-l-palco');
    var conteudo = document.getElementById('bib-l-conteudo');

    document.getElementById('bib-l-voltar').addEventListener('click', _bibVoltarUI);
    document.getElementById('bib-l-sumario').addEventListener('click', function () { _bibAbrirSheet('sumario'); });
    document.getElementById('bib-l-ajustes').addEventListener('click', function () { _bibAbrirSheet('ajustes'); });
    document.getElementById('bib-l-ouvir').addEventListener('click', function () {
      if (_bibTts.ativo) _bibTtsParar(); else _bibTtsIniciar();
    });
    document.getElementById('bib-l-capant').addEventListener('click', function () { _bibTrocarCapitulo(-1); });
    document.getElementById('bib-l-capprox').addEventListener('click', function () { _bibTrocarCapitulo(1); });

    var sl = document.getElementById('bib-l-slider');
    sl.addEventListener('input', function () {
      sl._arrastando = true;
      var pt = document.getElementById('bib-l-prog-txt');
      if (pt) pt.textContent = 'Ir para ' + Math.round(sl.value / 10) + '%';
      _bibMostrarBarras(true);
    });
    sl.addEventListener('change', function () { sl._arrastando = false; _bibIrParaPct(sl.value / 1000); });

    // Botões dentro do texto (próximo capítulo, avaliar, voltar).
    conteudo.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-acao]');
      if (!b) return;
      ev.stopPropagation();
      var acao = b.dataset.acao;
      if (acao === 'proxcap') _bibTrocarCapitulo(1);
      if (acao === 'avaliar' || acao === 'biblioteca') {
        var id = _bibL && _bibL.id;
        var semEntradaLivro = _bibLeitorDe !== 'livro';
        _bibSalvarPosicao(true);
        if (acao === 'avaliar' && id) { _bibLivroAberto = id; _bibLeitorDe = 'livro'; _bibMinhaNota = 0; }
        else _bibLeitorDe = 'catalogo';
        _bibVoltarUI();
        if (acao === 'avaliar') setTimeout(function () {
          // Leitor aberto direto do catálogo: a página do livro não tinha
          // entrada no history — cria agora, pro "voltar" seguinte cair no acervo.
          if (semEntradaLivro && history.state?.modal !== 'bib-livro') history.pushState({ modal: 'bib-livro' }, '');
          _bibCarregarAvaliacoes(id);
          var av = document.getElementById('bib-avaliacoes');
          if (av) av.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
      }
    });

    // Toque: laterais viram página (horizontal); meio mostra/esconde barras.
    palco.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-acao], button, a')) return;
      if (Date.now() - _bibSwipeT < 400) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length) return;
      var r = palco.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width;
      if (_bibPrefs.modo === 'h' && x < 0.3) { _bibAvancar(-1); return; }
      if (_bibPrefs.modo === 'h' && x > 0.7) { _bibAvancar(1); return; }
      _bibMostrarBarras();
    });

    // Swipe horizontal.
    var t0 = null;
    palco.addEventListener('touchstart', function (ev) {
      if (ev.touches.length !== 1) { t0 = null; return; }
      t0 = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now() };
    }, { passive: true });
    palco.addEventListener('touchend', function (ev) {
      if (!t0 || _bibPrefs.modo !== 'h') return;
      var dx = ev.changedTouches[0].clientX - t0.x, dy = ev.changedTouches[0].clientY - t0.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3 && Date.now() - t0.t < 900) {
        _bibSwipeT = Date.now();
        _bibAvancar(dx < 0 ? 1 : -1);
      }
      t0 = null;
    }, { passive: true });

    // Rolagem (vertical): salva posição e esconde as barras ao descer.
    var ultimoTopo = 0;
    palco.addEventListener('scroll', function () {
      if (_bibPrefs.modo !== 'v' || !_bibL) return;
      var y = palco.scrollTop;
      if (y > ultimoTopo + 12 && !el.classList.contains('bib-barras-off') && !_bibSheetAberto()) el.classList.add('bib-barras-off');
      ultimoTopo = y;
      _bibAtualizarIndicador();
      _bibAgendarPosicao();
    }, { passive: true });

    // Teclado (computador / teclado bluetooth).
    document.addEventListener('keydown', function (ev) {
      if (_bibTela !== 'leitor' || !_bibL) return;
      if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || (ev.key === ' ' && _bibPrefs.modo === 'h')) { ev.preventDefault(); _bibAvancar(1); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); _bibAvancar(-1); }
      else if (ev.key === 'Escape') { ev.preventDefault(); _bibVoltarUI(); }
    });

    // Girou a tela / redimensionou: refaz as colunas mantendo o parágrafo.
    var rt = null;
    window.addEventListener('resize', function () {
      if (_bibTela !== 'leitor' || !_bibL || !_bibL.tx) return;
      clearTimeout(rt);
      var a = _bibAncoraAtual();
      rt = setTimeout(function () { if (_bibL && _bibL.tx) { _bibLayout(); _bibIrParaAncora(a); } }, 180);
    });

    // TTS mini-player.
    document.getElementById('bib-tts-play').addEventListener('click', function () { if (_bibTts.tocando) _bibTtsPausar(); else _bibTtsRetomar(); });
    document.getElementById('bib-tts-ant').addEventListener('click', function () { _bibTtsPular(-1); });
    document.getElementById('bib-tts-prox').addEventListener('click', function () { _bibTtsPular(1); });
    document.getElementById('bib-tts-fechar').addEventListener('click', function () { _bibTtsParar(); });
    document.getElementById('bib-tts-vel').addEventListener('click', function () {
      var vs = [0.8, 1, 1.2, 1.5, 1.75, 2];
      var i = vs.indexOf(_bibPrefs.rate);
      _bibPrefs.rate = vs[(i + 1) % vs.length];
      _bibSalvarPrefs();
      _bibTtsAtualizarUI();
      if (_bibTts.tocando) { _bibTtsPausar(); _bibTtsRetomar(); }
    });

    // Fundo das folhas.
    document.getElementById('bib-sheet-fundo').addEventListener('click', function () { _bibFecharSheet(); });

    // Wake Lock cai quando a aba some; volta ao reaparecer.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && _bibTela === 'leitor') _bibWakeLock();
      if (document.visibilityState === 'hidden' && _bibL) _bibSalvarPosicao(true);
    });
  }

  /* ── Folhas (bottom sheets): sumário e ajustes ───────────────── */
  var _bibSheetTipo = null;
  function _bibSheetAberto() { return !!_bibSheetTipo; }

  function _bibAbrirSheet(tipo) {
    var sheet = document.getElementById('bib-sheet');
    var fundo = document.getElementById('bib-sheet-fundo');
    if (!sheet || !_bibL) return;
    _bibSheetTipo = tipo;
    sheet.hidden = false; fundo.hidden = false;
    requestAnimationFrame(function () { sheet.classList.add('aberto'); fundo.classList.add('aberto'); });
    _bibRenderSheet(true);
    clearTimeout(_bibBarrasTimer);
  }

  function _bibFecharSheet() {
    var sheet = document.getElementById('bib-sheet');
    var fundo = document.getElementById('bib-sheet-fundo');
    _bibPreviaParar();
    if (!sheet || !_bibSheetTipo) { _bibSheetTipo = null; return; }
    _bibSheetTipo = null;
    sheet.classList.remove('aberto'); fundo.classList.remove('aberto');
    setTimeout(function () { if (!_bibSheetTipo) { sheet.hidden = true; fundo.hidden = true; } }, 260);
  }

  function _bibRenderSheet(doTopo) {
    var corpo = document.getElementById('bib-sheet-corpo');
    if (!corpo || !_bibL) return;
    var rolaAnt = corpo.querySelector('.bib-sheet-rola');
    var topoAnt = (doTopo !== true && rolaAnt && corpo.dataset.tipo === _bibSheetTipo) ? rolaAnt.scrollTop : 0;
    corpo.dataset.tipo = _bibSheetTipo || '';
    if (_bibSheetTipo === 'sumario') {
      var tx = _bibL.tx;
      corpo.innerHTML = '<div class="bib-sheet-head"><h3>Sumário</h3><button type="button" class="bib-l-btn" data-fechar aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></div>' +
        (tx ? '<div class="bib-sumario-lista bib-sheet-rola">' + _bibSumarioItensHtml(tx, _bibL.c) + '</div>' : '<p class="bib-erro">Carregando…</p>');
      corpo.querySelectorAll('[data-cap]').forEach(function (b) {
        b.addEventListener('click', function () {
          var falando = _bibTts.ativo;
          _bibTtsParar();
          _bibFecharSheet();
          _bibIrPara(+b.dataset.cap, 0);
          _bibSalvarPosicao();
          if (falando) _bibTtsIniciar();
        });
      });
      var at = corpo.querySelector('.bib-sum-item.atual');
      if (at) at.scrollIntoView({ block: 'center' });
    } else {
      var P = _bibPrefs;
      var seg = function (nome, opcoes) {
        return '<div class="bib-seg" data-pref="' + nome + '">' + opcoes.map(function (o) {
          return '<button type="button" data-v="' + o[0] + '" class="' + (String(P[nome]) === String(o[0]) ? 'ativo' : '') + '">' + o[1] + '</button>';
        }).join('') + '</div>';
      };
      corpo.innerHTML = '<div class="bib-sheet-head"><h3>Ajustes de leitura</h3><button type="button" class="bib-l-btn" data-fechar aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></div>' +
        '<div class="bib-sheet-rola">' +
        '<div class="bib-aj"><div class="bib-aj-rot">Modo de leitura</div>' + seg('modo', [['v', '<i class="fa-solid fa-arrows-up-down"></i> Rolagem'], ['h', '<i class="fa-solid fa-book-open"></i> Páginas']]) + '</div>' +
        '<div class="bib-aj"><div class="bib-aj-rot">Tema</div><div class="bib-temas" data-pref="tema">' +
        [['claro', 'Claro'], ['sepia', 'Sépia'], ['escuro', 'Escuro']].map(function (t) {
          return '<button type="button" data-v="' + t[0] + '" class="bib-tema-bola bib-tb-' + t[0] + (P.tema === t[0] ? ' ativo' : '') + '"><span>Aa</span>' + t[1] + '</button>';
        }).join('') + '</div></div>' +
        '<div class="bib-aj"><div class="bib-aj-rot">Tamanho da letra</div><div class="bib-fonte">' +
        '<button type="button" data-fonte="-1" aria-label="Diminuir letra">A−</button><span id="bib-fonte-val">' + P.fonte + '</span><button type="button" data-fonte="1" aria-label="Aumentar letra">A+</button></div></div>' +
        '<div class="bib-aj"><div class="bib-aj-rot">Espaçamento entre linhas</div>' + seg('linha', [['1.4', 'Justo'], ['1.65', 'Normal'], ['1.95', 'Amplo']]) + '</div>' +
        '<div class="bib-aj"><div class="bib-aj-rot">Fonte</div>' + seg('familia', [['serif', '<span style="font-family:Georgia,serif">Serifa</span>'], ['sans', '<span style="font-family:var(--font-b)">Sem serifa</span>']]) + '</div>' +
        '<label class="bib-aj bib-aj-lin"><span>Texto justificado</span><input type="checkbox" data-bool="justificar"' + (P.justificar ? ' checked' : '') + '><i class="bib-sw"></i></label>' +
        '<label class="bib-aj bib-aj-lin"><span>Manter tela ligada' + ('wakeLock' in navigator ? '' : ' <small>(não suportado aqui)</small>') + '</span><input type="checkbox" data-bool="tela"' + (P.tela ? ' checked' : '') + ('wakeLock' in navigator ? '' : ' disabled') + '><i class="bib-sw"></i></label>' +
        (_bibTtsSuportado()
          ? _bibVozesHtml() +
            '<div class="bib-aj"><div class="bib-aj-rot">Velocidade da voz</div>' + seg('rate', [['0.8', '0,8×'], ['1', '1×'], ['1.2', '1,2×'], ['1.5', '1,5×'], ['2', '2×']]) + '</div>'
          : '') +
        '</div>';
      corpo.querySelectorAll('[data-pref]').forEach(function (g) {
        g.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-v]');
          if (!b) return;
          var nome = g.dataset.pref, v = b.dataset.v;
          _bibMudarPref(nome, (nome === 'linha' || nome === 'rate') ? +v : v);
        });
      });
      corpo.querySelectorAll('[data-fonte]').forEach(function (b) {
        b.addEventListener('click', function () { _bibMudarPref('fonte', Math.max(14, Math.min(30, _bibPrefs.fonte + (+b.dataset.fonte)))); });
      });
      corpo.querySelectorAll('[data-bool]').forEach(function (c) {
        c.addEventListener('change', function () { _bibMudarPref(c.dataset.bool, c.checked); });
      });
      corpo.querySelectorAll('[data-voz]').forEach(function (b) {
        b.addEventListener('click', function () { _bibEscolherVoz(b.dataset.voz); });
      });
      corpo.querySelectorAll('[data-prev]').forEach(function (b) {
        b.addEventListener('click', function () { _bibPreviaTocar(b.dataset.prev); });
      });
      var outras = corpo.querySelector('.bib-vozes-outras');
      if (outras) outras.addEventListener('toggle', function () { _bibVozesOutrasAberto = outras.open; });
      _bibPreviaUI();
      var rola = corpo.querySelector('.bib-sheet-rola');
      if (rola && topoAnt) rola.scrollTop = topoAnt;
    }
    var f = corpo.querySelector('[data-fechar]');
    if (f) f.addEventListener('click', _bibFecharSheet);
  }

  function _bibMudarPref(nome, valor) {
    if (_bibPrefs[nome] === valor) return;
    var a = _bibL && _bibL.tx ? _bibAncoraAtual() : 0;
    _bibPrefs[nome] = valor;
    _bibSalvarPrefs();
    _bibAplicarPrefs();
    if (nome === 'tela') { if (valor) _bibWakeLock(); else _bibLiberarWakeLock(); }
    if (nome === 'rate') { _bibTtsAtualizarUI(); if (_bibTts.tocando) { _bibTtsPausar(); _bibTtsRetomar(); } }
    if (['modo', 'fonte', 'linha', 'familia', 'justificar'].indexOf(nome) !== -1 && _bibL && _bibL.tx) {
      _bibLayout();
      _bibIrParaAncora(a);
    }
    _bibRenderSheet();
  }

  /* ── Manter tela ligada (Screen Wake Lock) ─────────────────────── */
  var _bibWake = null;
  function _bibWakeLock() {
    if (!('wakeLock' in navigator) || _bibWake) return;
    if (!(_bibPrefs.tela || _bibTts.ativo) || _bibTela !== 'leitor') return;
    navigator.wakeLock.request('screen').then(function (w) {
      _bibWake = w;
      w.addEventListener('release', function () { _bibWake = null; });
    }).catch(function () { _bibWake = null; });
  }
  function _bibLiberarWakeLock() {
    if (_bibWake) { try { _bibWake.release(); } catch (e) {} }
    _bibWake = null;
  }

  /* ══ Leitura em voz alta (Web Speech API) ═══════════════════════
     Fala parágrafo por parágrafo (em trechos de até ~220 caracteres —
     o Chrome do Android corta falas longas), destaca o parágrafo atual
     e segue sozinho para o próximo capítulo. "Pausar" cancela e guarda
     o trecho: o pause() nativo é instável no Android. */
  var _bibTts = { ativo: false, tocando: false, i: 0, partes: [], parte: 0, token: 0, utt: null };

  function _bibTtsSuportado() {
    try { return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; } catch (e) { return false; }
  }
  if (_bibTtsSuportado()) { try { speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', function () { if (_bibSheetTipo === 'ajustes') _bibRenderSheet(); }); } catch (e) {} }

  /* ── Vozes ──────────────────────────────────────────────────────
     A lista chega assíncrona (Chrome: getVoices() vem vazio até o
     'voiceschanged'). Na preferência guardamos o NOME da voz; se ela
     sumir do aparelho, cai na padrão — a voz em português que o
     sistema marca como padrão (ou a 1ª pt-BR). Nada de apagar a
     preferência: em alguns aparelhos a voz volta quando a lista
     termina de carregar. */
  function _bibLangNorm(l) { return String(l || '').replace('_', '-'); }
  function _bibTodasVozes() {
    if (!_bibTtsSuportado()) return [];
    try { return (speechSynthesis.getVoices() || []).slice(); } catch (e) { return []; }
  }
  function _bibOrdemLang(l) { l = _bibLangNorm(l); return l === 'pt-BR' ? 0 : l === 'pt-PT' ? 1 : 2; }
  function _bibVozesPt() {
    return _bibTodasVozes().filter(function (v) { return /^pt/i.test(v.lang); })
      .sort(function (a, b) { return _bibOrdemLang(a.lang) - _bibOrdemLang(b.lang) || (a.localService === false) - (b.localService === false) || a.name.localeCompare(b.name); });
  }
  function _bibVozPorNome(nome) {
    if (!nome) return null;
    var vs = _bibTodasVozes();
    for (var i = 0; i < vs.length; i++) if (vs[i].name === nome) return vs[i];
    return null;
  }
  function _bibVozPadrao() {
    var vs = _bibVozesPt(), i;
    for (i = 0; i < vs.length; i++) if (vs[i].default && _bibLangNorm(vs[i].lang) === 'pt-BR') return vs[i];
    for (i = 0; i < vs.length; i++) if (_bibLangNorm(vs[i].lang) === 'pt-BR') return vs[i];
    for (i = 0; i < vs.length; i++) if (vs[i].default) return vs[i];
    return vs[0] || null;
  }
  function _bibVozEscolhida() { return _bibVozPorNome(_bibPrefs.voz) || _bibVozPadrao(); }

  // Espera a lista de vozes (no máx. 1,5 s, uma vez só) — senão o 1º
  // "Ouvir" do Chrome sairia na voz errada antes do 'voiceschanged'.
  var _bibVozesEsperou = false;
  function _bibEsperarVozes(cb) {
    if (_bibVozesEsperou || _bibTodasVozes().length) { cb(); return; }
    _bibVozesEsperou = true;
    var feito = false;
    var ok = function () {
      if (feito) return; feito = true;
      try { speechSynthesis.removeEventListener('voiceschanged', ok); } catch (e) {}
      cb();
    };
    try { speechSynthesis.addEventListener('voiceschanged', ok); } catch (e) {}
    setTimeout(ok, 1500);
  }

  function _bibVozNome(v) {
    var n = String(v.name || '').replace(/^(Microsoft|Google|Apple)\s+/i, '').replace(/\s+-\s+[^-]+$/, '').replace(/\s+Online(?=\s*\(Natural\))/i, '').trim();
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : _bibLangNorm(v.lang);
  }
  var _bibNomesLang = null;
  function _bibLangNome(lang) {
    var l = _bibLangNorm(lang);
    if (l === 'pt-BR') return 'Português (Brasil)';
    if (l === 'pt-PT') return 'Português (Portugal)';
    try {
      if (!_bibNomesLang) _bibNomesLang = new Intl.DisplayNames(['pt-BR'], { type: 'language' });
      var r = _bibNomesLang.of(l);
      if (r) return r.charAt(0).toUpperCase() + r.slice(1);
    } catch (e) {}
    return l;
  }

  /* ── Seletor de vozes (cards na folha de ajustes) ─────────────── */
  var _bibVozesOutrasAberto = false;
  function _bibVozCardHtml(chave, nome, sub, sel, pt) {
    return '<div class="bib-voz' + (sel ? ' ativo' : '') + (pt ? ' bib-voz-pt' : '') + '">' +
      '<button type="button" class="bib-voz-esc" role="radio" aria-checked="' + (sel ? 'true' : 'false') + '" data-voz="' + _bibEsc(chave) + '">' +
      '<span class="bib-voz-marca" aria-hidden="true"><i class="fa-solid fa-check"></i></span>' +
      '<span class="bib-voz-txt"><span class="bib-voz-nome">' + _bibEsc(nome) + '</span><span class="bib-voz-sub">' + sub + '</span></span>' +
      '</button>' +
      '<button type="button" class="bib-voz-prev" data-prev="' + _bibEsc(chave) + '" data-rot="' + _bibEsc(nome) + '" aria-label="Ouvir prévia: ' + _bibEsc(nome) + '"><i class="fa-solid fa-play"></i></button>' +
      '</div>';
  }
  function _bibVozSub(v) {
    return '<span class="bib-voz-lang">' + _bibEsc(_bibLangNorm(v.lang)) + '</span>' + _bibEsc(_bibLangNome(v.lang)) +
      (v.localService === false ? ' <span class="bib-voz-tag" title="Precisa de internet"><i class="fa-solid fa-wifi"></i> Online</span>' : '');
  }
  function _bibVozesHtml() {
    var todas = _bibTodasVozes(), pt = _bibVozesPt();
    var outras = todas.filter(function (v) { return !/^pt/i.test(v.lang); })
      .sort(function (a, b) { return _bibLangNome(a.lang).localeCompare(_bibLangNome(b.lang), 'pt') || a.name.localeCompare(b.name); });
    var salva = _bibVozPorNome(_bibPrefs.voz);
    var padrao = _bibVozPadrao();
    var aviso = '';
    if (!todas.length) aviso = '<i class="fa-solid fa-spinner fa-spin"></i> Carregando as vozes do aparelho…';
    else if (_bibPrefs.voz && !salva) aviso = '<i class="fa-solid fa-circle-info"></i> A voz que você tinha escolhido não está disponível neste aparelho. Usando a padrão.';
    else if (!pt.length) aviso = '<i class="fa-solid fa-circle-info"></i> Nenhuma voz em português instalada. Dá para baixar uma nas configurações de voz (texto para fala) do aparelho.';
    var abrirOutras = _bibVozesOutrasAberto || (salva && !/^pt/i.test(salva.lang));
    return '<div class="bib-aj"><div class="bib-aj-rot">Voz da leitura em voz alta</div>' +
      (aviso ? '<p class="bib-voz-aviso">' + aviso + '</p>' : '') +
      '<div class="bib-vozes" role="radiogroup" aria-label="Voz da leitura em voz alta">' +
      _bibVozCardHtml('', 'Padrão do aparelho', padrao ? 'Agora: ' + _bibEsc(_bibVozNome(padrao)) + ' · ' + _bibEsc(_bibLangNorm(padrao.lang)) : 'A voz que o sistema escolher', !salva, true) +
      pt.map(function (v) { return _bibVozCardHtml(v.name, _bibVozNome(v), _bibVozSub(v), !!salva && salva.name === v.name, true); }).join('') +
      '</div>' +
      (outras.length
        ? '<details class="bib-vozes-outras"' + (abrirOutras ? ' open' : '') + '><summary>Vozes de outros idiomas <span>' + outras.length + '</span></summary>' +
          '<p class="bib-voz-nota">Leem o texto com sotaque do idioma delas — as em português soam bem melhor.</p>' +
          '<div class="bib-vozes" role="radiogroup" aria-label="Vozes de outros idiomas">' +
          outras.map(function (v) { return _bibVozCardHtml(v.name, _bibVozNome(v), _bibVozSub(v), !!salva && salva.name === v.name, false); }).join('') +
          '</div></details>'
        : '') +
      '</div>';
  }

  function _bibEscolherVoz(nome) {
    _bibPrefs.voz = nome || '';
    _bibSalvarPrefs();
    if (_bibTts.tocando) { _bibTtsPausar(); _bibTtsRetomar(); }
    _bibRenderSheet();
  }

  /* ── Prévia de voz: fala uma frase curta com a voz do card ────── */
  var BIB_TXT_PREVIA = 'Olá, esta é a voz disponível para leitura na Biblioteca da Coruja.';
  var _bibPrevia = { chave: null, token: 0, u: null };

  function _bibPreviaUI() {
    document.querySelectorAll('#bib-sheet-corpo [data-prev]').forEach(function (b) {
      var on = _bibPrevia.chave !== null && b.dataset.prev === _bibPrevia.chave;
      if (b.classList.contains('tocando') === on && b.firstChild) return;
      b.classList.toggle('tocando', on);
      b.innerHTML = '<i class="fa-solid fa-' + (on ? 'stop' : 'play') + '"></i>';
      b.setAttribute('aria-label', (on ? 'Parar prévia: ' : 'Ouvir prévia: ') + (b.dataset.rot || ''));
    });
  }

  function _bibPreviaParar() {
    if (_bibPrevia.chave === null) return;
    _bibPrevia.chave = null;
    _bibPrevia.token++;
    try { speechSynthesis.cancel(); } catch (e) {}
    _bibPreviaUI();
  }

  function _bibPreviaTocar(chave) {
    if (!_bibTtsSuportado()) return;
    chave = chave || '';
    if (_bibPrevia.chave === chave) { _bibPreviaParar(); return; }
    // Para qualquer fala em andamento: a leitura do livro fica pausada
    // (o mini-player mostra "play" para continuar de onde estava).
    if (_bibTts.tocando) _bibTtsPausar();
    var token = ++_bibPrevia.token;
    _bibPrevia.chave = chave;
    _bibPreviaUI();
    try {
      speechSynthesis.cancel();
      var v = chave ? _bibVozPorNome(chave) : _bibVozPadrao();
      var u = new SpeechSynthesisUtterance(BIB_TXT_PREVIA);
      u.lang = 'pt-BR';
      u.rate = _bibPrefs.rate || 1;
      if (v) { u.voice = v; u.lang = v.lang; }
      u.onend = u.onerror = function () {
        if (token !== _bibPrevia.token) return;
        _bibPrevia.chave = null;
        _bibPreviaUI();
      };
      _bibPrevia.u = u; // mesma proteção contra o GC do Chrome
      speechSynthesis.speak(u);
    } catch (e) { _bibPrevia.chave = null; _bibPreviaUI(); }
  }

  function _bibTtsQuebrar(txt) {
    txt = String(txt).replace(/_/g, '').replace(/\s+/g, ' ').trim();
    var frases = txt.match(/[^.!?…;:]+[.!?…;:]+["”’)]*\s*|[^.!?…;:]+$/g) || [txt];
    var out = [], atual = '';
    frases.forEach(function (f) {
      if ((atual + f).length > 220 && atual) { out.push(atual.trim()); atual = ''; }
      while (f.length > 260) { var corte = f.lastIndexOf(',', 220); if (corte < 80) corte = f.lastIndexOf(' ', 220); out.push(f.slice(0, corte + 1).trim()); f = f.slice(corte + 1); }
      atual += f;
    });
    if (atual.trim()) out.push(atual.trim());
    return out;
  }

  // iOS só libera a fala se o 1º speak() vier direto de um toque: o
  // "Ouvir" da página do livro chama isto antes de baixar o texto.
  function _bibTtsDesbloquear() {
    if (!_bibTtsSuportado()) return;
    try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  }

  function _bibTtsIniciar() {
    if (!_bibTtsSuportado() || !_bibL || !_bibL.tx) return;
    _bibTts.ativo = true;
    _bibTts.i = _bibAncoraAtual();
    _bibTts.partes = [];
    _bibTts.parte = 0;
    document.getElementById('bib-tts').hidden = false;
    document.getElementById('bib-leitor').classList.add('bib-tts-on');
    _bibWakeLock();
    if (_bibTodasVozes().length || _bibVozesEsperou) { _bibTtsRetomar(); return; }
    _bibTtsDesbloquear(); // mantém o "toque" do iOS valendo durante a espera
    _bibEsperarVozes(_bibTtsRetomar);
  }

  function _bibTtsRetomar() {
    if (!_bibTts.ativo || !_bibL || !_bibL.tx) return;
    _bibPreviaParar();
    _bibTts.tocando = true;
    _bibTtsAtualizarUI();
    _bibTtsFalar();
  }

  function _bibTtsPausar() {
    _bibTts.tocando = false;
    _bibTts.token++;
    try { speechSynthesis.cancel(); } catch (e) {}
    _bibTtsAtualizarUI();
  }

  function _bibTtsParar() {
    if (!_bibTts.ativo) return;
    _bibTtsPausar();
    _bibTts.ativo = false;
    var box = document.getElementById('bib-tts');
    if (box) box.hidden = true;
    var el = document.getElementById('bib-leitor');
    if (el) el.classList.remove('bib-tts-on');
    document.querySelectorAll('#bib-l-conteudo p.bib-falando').forEach(function (p) { p.classList.remove('bib-falando'); });
    if (!_bibPrefs.tela) _bibLiberarWakeLock();
  }

  function _bibTtsPular(d) {
    if (!_bibTts.ativo) return;
    _bibTts.token++;
    try { speechSynthesis.cancel(); } catch (e) {}
    _bibTts.i = Math.max(0, _bibTts.i + d);
    _bibTts.partes = []; _bibTts.parte = 0;
    var cap = _bibL.tx.caps[_bibL.c];
    if (_bibTts.i >= cap.p.length) { _bibTtsProxCap(); return; }
    if (_bibTts.tocando) _bibTtsFalar(); else _bibTtsDestacar();
  }

  function _bibTtsDestacar() {
    var ps = _bibParagrafos();
    var alvo = ps[_bibTts.i];
    document.querySelectorAll('#bib-l-conteudo p.bib-falando').forEach(function (p) { if (p !== alvo) p.classList.remove('bib-falando'); });
    if (!alvo) return;
    alvo.classList.add('bib-falando');
    if (_bibPrefs.modo === 'h') {
      var pg = Math.floor((alvo.offsetLeft + 2) / _bibL.W);
      if (pg !== _bibL.pagina) _bibIrPagina(pg);
    } else {
      var palco = document.getElementById('bib-l-palco');
      var y = alvo.offsetTop;
      if (y < palco.scrollTop + 60 || y + Math.min(alvo.offsetHeight, palco.clientHeight * 0.5) > palco.scrollTop + palco.clientHeight - 90) {
        palco.scrollTo({ top: Math.max(0, y - palco.clientHeight * 0.25), behavior: 'smooth' });
      }
    }
  }

  function _bibTtsProxCap() {
    var L = _bibL;
    if (!L || L.c >= L.tx.caps.length - 1) { _bibTtsParar(); _bibSalvarPosicao(true); return; }
    _bibIrPara(L.c + 1, 0);
    _bibSalvarPosicao();
    _bibTts.i = 0; _bibTts.partes = []; _bibTts.parte = 0;
    if (_bibTts.tocando) setTimeout(_bibTtsFalar, 400);
  }

  function _bibTtsFalar() {
    var L = _bibL;
    if (!_bibTts.ativo || !_bibTts.tocando || !L || !L.tx) return;
    var cap = L.tx.caps[L.c];
    if (_bibTts.i >= cap.p.length) { _bibTtsProxCap(); return; }
    if (!_bibTts.partes.length) { _bibTts.partes = _bibTtsQuebrar(cap.p[_bibTts.i]); _bibTts.parte = 0; }
    if (_bibTts.parte >= _bibTts.partes.length) {
      _bibTts.i++; _bibTts.partes = []; _bibTts.parte = 0;
      _bibAgendarPosicao();
      _bibTtsFalar();
      return;
    }
    _bibTtsDestacar();
    var token = ++_bibTts.token;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(_bibTts.partes[_bibTts.parte]);
      u.lang = 'pt-BR';
      u.rate = _bibPrefs.rate || 1;
      var voz = _bibVozEscolhida();
      if (voz) { u.voice = voz; u.lang = voz.lang; }
      u.onend = function () {
        if (token !== _bibTts.token || !_bibTts.tocando) return;
        _bibTts.parte++;
        _bibTtsFalar();
      };
      u.onerror = function (ev) {
        if (token !== _bibTts.token) return;
        if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return;
        _bibTts.parte++;
        setTimeout(_bibTtsFalar, 150);
      };
      _bibTts.utt = u; // segura a referência (bug do Chrome: onend some com GC)
      speechSynthesis.speak(u);
    } catch (e) { _bibTtsParar(); }
  }

  function _bibTtsAtualizarUI() {
    var play = document.getElementById('bib-tts-play');
    if (play) {
      play.innerHTML = '<i class="fa-solid fa-' + (_bibTts.tocando ? 'pause' : 'play') + '"></i>';
      play.setAttribute('aria-label', _bibTts.tocando ? 'Pausar' : 'Continuar');
    }
    var vel = document.getElementById('bib-tts-vel');
    if (vel) vel.textContent = String(_bibPrefs.rate).replace('.', ',') + '×';
    var ouvir = document.getElementById('bib-l-ouvir');
    if (ouvir) ouvir.classList.toggle('ativo', _bibTts.ativo);
  }
