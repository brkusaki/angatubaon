'use strict';
/* ══════════════════════════════════════════════════════════════
   SOCIAL — presença, amigos, convites pra jogar, chat 1x1, avisos do
   topo, lobby social e push (FCM). Saiu do app.js para não pesar o boot
   de quem não usa conta: o app.js carrega este arquivo sob demanda (ver
   "SOCIAL SOB DEMANDA" lá). Roda no MESMO escopo global do app.js (script
   clássico), então usa direto _cliUser, _presDb, showToastSimples etc. —
   e só pode rodar DEPOIS dele. Build: npm run build gera social.min.js.
   As funções daqui chamadas de fora têm stub com o mesmo nome no app.js.
══════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════
     PRESENÇA (Realtime Database) — Etapa 4.2
     ------------------------------------------------------------
     Diz se uma CONTA NOMEADA está online. É a base pra lista de
     amigos (4.3) e convites (4.4). Aqui não há UI de "quem está
     online na cidade" — de propósito: privacidade e escala. A UI de
     outras pessoas nasce na 4.3, sobre a lista de amigos.

     Nó no RTDB:
       presence/{uid} = {
         state:        'online' | 'away' | 'offline',
         nome:         string (cliNomeExibicao, máx 20),
         atualizadoEm: timestamp do servidor,
         jogo?:        string (máx 20) — id do jogo aberto (ex.: 'voo')
         texto?:       string (máx 40) — "Jogando Voo da Coruja",
                       "Na Biblioteca", "Aprendendo inglês"
       }

     PRESENÇA RICA (Fase 1, item 4): "jogando" NÃO é um valor novo de
     `state` — de propósito. Aparelhos com o bundle antigo em cache
     pintam qualquer state desconhecido como "Offline" (ver
     _amPintarPresenca antigo) e o botão "Chamar pra jogar" só acende
     com 'online'. Então o state segue online/away/offline e a
     atividade vem nos campos opcionais jogo/texto: o app novo mostra
     "Jogando Voo da Coruja", o velho continua vendo "Online". O rótulo
     final sai de AngatubaPresenca.rotulo(p) — fonte única pra lista de
     amigos, lobby e perfil. 'offline' nunca carrega atividade (o
     onDisconnect grava o nó limpo).

     `atualizadoEm` (e não `atualmenteEm`) pra casar com o nome que os
     docs de ranking no Firestore já usam.

     Quem entra: SÓ conta nomeada. Sessão anônima de sala (multiplayer,
     party, baralho) não grava presença — as regras do RTDB também
     barram por sign_in_provider, então não depende só do cliente.

     Mecânica padrão de presença do Firebase:
       1. ouvir .info/connected
       2. ao conectar, registrar o onDisconnect ANTES de escrever
          'online' — se a ordem inverter e a queda acontecer no meio,
          o nó fica 'online' pra sempre
       3. onDisconnect().set() em vez de .remove(): guarda o último
          `atualizadoEm`, que a 4.3 vai querer pra "offline há 2h"

     'away': após ~60s com a aba escondida. Em celular isso quase
     nunca chega a acontecer — o navegador congela a aba, a conexão
     com o RTDB cai e o onDisconnect já marca 'offline' direto. Ou
     seja, na prática 'away' é um estado de desktop; o par
     online/offline é que carrega o peso.

     API pública (window.AngatubaPresenca):
       disponivel()        -> bool, se dá pra usar presença agora
       meuEstado()         -> 'online'|'away'|'offline'|null
       observar(uid, cb)   -> escuta a presença de UM uid; cb recebe
                              {state, nome, atualizadoEm} ou null.
                              Devolve uma função pra parar de ouvir.
       atualizarNome()     -> reescreve o nome (chamado ao trocar o
                              apelido), sem mexer no state
       atividade(origem, jogo, texto)
                           -> publica a atividade atual ('jogo',
                              'aprender', 'biblioteca'...). Sem conta
                              logada só guarda em memória.
       limparAtividade(origem)
                           -> tira a atividade, mas SÓ se ela for da
                              mesma origem (fechar a Biblioteca não
                              apaga um "Jogando" que veio depois)
       rotulo(p)           -> { estado: 'online'|'ausente'|'jogando'|
                              'offline', texto } pra pintar a UI
     As regras não permitem LISTAR presence/ — só ler presence/{uid}
     um a um. Isso é proposital: impede o feed "toda Angatuba online"
     mesmo que alguém tente pelo console.
  ══════════════════════════════════════════════════════════════ */

  var PRES_AWAY_MS = 60000;      // tempo escondido antes de virar 'away'
  var _presRef = null;           // ref de presence/{uid} do usuário atual
  var _presConnRef = null;       // ref de .info/connected
  var _presConnCb = null;        // handler do .info/connected (pra .off)
  var _presUid = null;           // uid que está publicando presença
  var _presEstado = null;        // último state publicado
  var _presAwayTimer = null;
  var _presVisBind = false;      // visibilitychange ligado uma única vez
  var _presIniciando = false;    // evita dois _presencaIniciar em paralelo
  // Atividade atual (presença rica): { origem, jogo, texto } ou null.
  // Vive em memória mesmo sem presença ligada — quando a presença liga
  // (login depois de abrir um jogo), o 1º _presPublicar já leva junto.
  var _presAtividade = null;
  var PRES_JOGO_MAX = 20;        // mesmos tetos de database.rules.json
  var PRES_TEXTO_MAX = 40;

  function _presDb() {
    if (typeof firebase === 'undefined' || !firebase.database) return null;
    try { return firebase.database(); } catch (e) { return null; }
  }

  // Objeto gravado no nó. nome sempre pelo cliNomeExibicao (mesma
  // identidade do header, do painel e do ranking).
  function _presValor(state) {
    var v = {
      state: state,
      nome: cliNomeExibicao() || 'Jogador',
      atualizadoEm: firebase.database.ServerValue.TIMESTAMP
    };
    // Atividade só acompanha quem está no app ('offline' sai limpo —
    // inclusive o valor que o onDisconnect deixa registrado).
    if (state !== 'offline' && _presAtividade) {
      if (_presAtividade.jogo) v.jogo = _presAtividade.jogo;
      if (_presAtividade.texto) v.texto = _presAtividade.texto;
    }
    return v;
  }

  /* Rótulo de exibição de um nó de presença (de qualquer pessoa).
     'jogando' só vale com state 'online' — ausente/offline ganham do
     jogo (quem minimizou o app no meio da partida não está jogando). */
  function _presRotulo(p) {
    var st = (p && p.state) || 'offline';
    if (st === 'online') {
      var texto = (p.texto && String(p.texto).slice(0, PRES_TEXTO_MAX)) || '';
      if (p.jogo) return { estado: 'jogando', texto: texto || 'Jogando' };
      return { estado: 'online', texto: texto || 'Online' };
    }
    if (st === 'away') return { estado: 'ausente', texto: 'Ausente' };
    return { estado: 'offline', texto: 'Offline' };
  }
  // Classe do pontinho (.cli-amigo-dot) — 'jogando' é um verde com anel.
  function _presClasseDot(p) {
    var e = _presRotulo(p).estado;
    if (e === 'jogando') return ' online jogando';
    if (e === 'online') return ' online';
    if (e === 'ausente') return ' away';
    return '';
  }

  // Publica um state no nó do próprio usuário. Silencioso: presença é
  // enfeite, nunca pode quebrar nada se falhar.
  function _presPublicar(state) {
    if (!_presRef) return;
    _presEstado = state;
    try { _presRef.set(_presValor(state)).catch(function () {}); } catch (e) {}
    _presPintarIndicador();
  }

  /* Indicador no painel de conta — só o SEU próprio estado. Não existe
     lista de quem está online: isso é 4.3, sobre amigos. O elemento é
     criado por cliPintarAvatarPainel; se o painel estiver fechado, aqui
     não faz nada. */
  function _presPintarIndicador() {
    var el = document.getElementById('cli-conta-presenca');
    if (!el) return;
    var mapa = {
      online:  { cor: '#22c55e', txt: 'Online' },
      away:    { cor: '#f59e0b', txt: 'Ausente' },
      offline: { cor: '#94a3b8', txt: 'Offline' }
    };
    var m = mapa[_presEstado] || { cor: '#94a3b8', txt: 'Conectando…' };
    el.style.background = m.cor;
    el.title = m.txt;
    el.setAttribute('aria-label', m.txt);
  }

  function _presCancelarAwayTimer() {
    if (_presAwayTimer) { clearTimeout(_presAwayTimer); _presAwayTimer = null; }
  }

  // Aba escondida por PRES_AWAY_MS -> 'away'. Voltou -> 'online'.
  function _presVisibilidade() {
    if (!_presRef) return;
    _presCancelarAwayTimer();
    if (document.hidden) {
      _presAwayTimer = setTimeout(function () {
        _presAwayTimer = null;
        if (_presRef && document.hidden) _presPublicar('away');
      }, PRES_AWAY_MS);
    } else if (_presEstado !== 'online') {
      _presPublicar('online');
    }
  }

  /* CONEXÃO OCIOSA (limite de conexões do Realtime Database)
     O plano grátis do Firebase aceita 100 conexões simultâneas ao RTDB, e
     toda conta logada com o app aberto segura uma (presença + convites),
     mesmo quem está só no guia de lojas. Celular já derruba a conexão ao
     congelar a aba; no PC uma aba esquecida aberta ocupava a vaga pra
     sempre. Aqui: escondido por RTDB_OCIOSO_MS e sem nenhuma sala aberta
     (lobby social, Party, Baralho, multiplayer 1×1) → goOffline() (o
     onDisconnect da presença marca "offline" sozinho). Voltou → goOnline()
     e o .info/connected da presença republica "online" e rearma tudo. Com
     sala aberta não desliga: tenta de novo a cada minuto. */
  var RTDB_OCIOSO_MS = 5 * 60000;
  var _rtdbOciosoTimer = null, _rtdbDesligado = false;
  function _rtdbEmSala() {
    try {
      if (_lobRef) return true;
      if (window.AngatubaParty && typeof AngatubaParty.codigoSala === 'function' && AngatubaParty.codigoSala()) return true;
      if (window.AngatubaBaralho && typeof AngatubaBaralho.codigoSala === 'function' && AngatubaBaralho.codigoSala()) return true;
      if (window.AngatubaMP && typeof AngatubaMP.emSala === 'function' && AngatubaMP.emSala()) return true;
    } catch (e) {}
    return false;
  }
  function _rtdbVisibilidade() {
    if (_rtdbOciosoTimer) { clearTimeout(_rtdbOciosoTimer); _rtdbOciosoTimer = null; }
    // SDK do RTDB nunca baixou nesta sessão: não há conexão pra desligar.
    if (typeof firebase === 'undefined' || !firebase.database) return;
    if (document.hidden) {
      _rtdbOciosoTimer = setTimeout(function tentar() {
        _rtdbOciosoTimer = null;
        if (!document.hidden) return;
        if (_rtdbEmSala()) { _rtdbOciosoTimer = setTimeout(tentar, 60000); return; }
        try { firebase.database().goOffline(); _rtdbDesligado = true; } catch (e) {}
      }, RTDB_OCIOSO_MS);
    } else if (_rtdbDesligado) {
      _rtdbDesligado = false;
      try { firebase.database().goOnline(); } catch (e) {}
    }
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', _rtdbVisibilidade);
  }

  /* Liga a presença do usuário logado. Idempotente: chamar de novo com
     o mesmo uid não faz nada. Carrega o SDK do Realtime Database sob
     demanda — quem nunca loga jamais baixa esse script. */
  function _presencaIniciar() {
    if (!_cliContaReal(_cliUser)) return;
    var uid = _cliUser.uid;
    if (_presUid === uid || _presIniciando) return;
    _presIniciando = true;
    _carregarFirebaseDb().then(function () {
      _presIniciando = false;
      // A pessoa pode ter saído (ou trocado de conta) enquanto o SDK
      // baixava — nesse caso não publica nada.
      if (!_cliContaReal(_cliUser) || _cliUser.uid !== uid) return;
      var db = _presDb();
      if (!db) return;
      _presencaParar();
      _presUid = uid;
      _presRef = db.ref('presence/' + uid);
      _presConnRef = db.ref('.info/connected');
      _presConnCb = function (snap) {
        if (snap.val() !== true) return;
        // onDisconnect PRIMEIRO, 'online' depois (ver comentário acima).
        try { _presRef.onDisconnect().set(_presValor('offline')); } catch (e) {}
        _presPublicar(document.hidden ? 'away' : 'online');
      };
      _presConnRef.on('value', _presConnCb);
      if (!_presVisBind && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', _presVisibilidade);
        _presVisBind = true;
      }
      _presPintarIndicador();
    }).catch(function () {
      _presIniciando = false;
      // Sem RTDB (offline, rede bloqueada): app segue igual, sem presença.
    });
  }

  /* Desliga: cancela o onDisconnect (senão ele dispararia depois, já
     deslogado) e marca offline na hora. Chamado no cliSair e antes de
     religar com outro uid. */
  function _presencaParar() {
    _presCancelarAwayTimer();
    if (_presConnRef && _presConnCb) {
      try { _presConnRef.off('value', _presConnCb); } catch (e) {}
    }
    if (_presRef) {
      var ref = _presRef;
      // Ordem de propósito: marca offline ANTES de cancelar o
      // onDisconnect. Se o set falhar (token já expirado, rede caindo),
      // o onDisconnect ainda não foi cancelado e marca offline sozinho
      // quando a conexão cair — o nó nunca fica preso em 'online'.
      try {
        ref.set(_presValor('offline')).then(function () {
          try { ref.onDisconnect().cancel(); } catch (e) {}
        }).catch(function () {});
      } catch (e) {}
    }
    _presRef = null; _presConnRef = null; _presConnCb = null;
    _presUid = null; _presEstado = null;
  }

  window.AngatubaPresenca = {
    disponivel: function () { return !!_presRef; },
    meuEstado: function () { return _presEstado; },
    // Escuta a presença de UM uid (a 4.3 chama isto por amigo).
    // cb recebe {state, nome, atualizadoEm} ou null se não houver nó.
    observar: function (uid, cb) {
      if (!uid || typeof cb !== 'function') return function () {};
      var parado = false, off = function () {};
      _carregarFirebaseDb().then(function () {
        if (parado) return;
        var db = _presDb();
        if (!db) { cb(null); return; }
        var ref = db.ref('presence/' + uid);
        var h = function (snap) { cb(snap.val() || null); };
        ref.on('value', h, function () { cb(null); });
        off = function () { try { ref.off('value', h); } catch (e) {} };
      }).catch(function () { if (!parado) cb(null); });
      return function () { parado = true; off(); };
    },
    // Trocou o apelido: reescreve o nome mantendo o state atual.
    atualizarNome: function () {
      if (_presRef && _presEstado) _presPublicar(_presEstado);
    },
    // Presença rica: o que a pessoa está fazendo agora. Só reescreve o
    // nó se algo mudou de verdade (abrir/fechar telas chama isto várias
    // vezes seguidas).
    atividade: function (origem, jogo, texto) {
      if (!origem) return;
      var nova = {
        origem: String(origem),
        jogo: jogo ? String(jogo).slice(0, PRES_JOGO_MAX) : '',
        texto: texto ? String(texto).trim().slice(0, PRES_TEXTO_MAX) : ''
      };
      var a = _presAtividade;
      if (a && a.origem === nova.origem && a.jogo === nova.jogo && a.texto === nova.texto) return;
      _presAtividade = nova;
      if (_presRef && _presEstado && _presEstado !== 'offline') _presPublicar(_presEstado);
    },
    limparAtividade: function (origem) {
      if (!_presAtividade) return;
      if (origem && _presAtividade.origem !== origem) return;
      _presAtividade = null;
      if (_presRef && _presEstado && _presEstado !== 'offline') _presPublicar(_presEstado);
    },
    rotulo: function (p) { return _presRotulo(p); }
  };

  /* ══════════════════════════════════════════════════════════════
     AMIGOS (Realtime Database) — Etapa 4.3
     ------------------------------------------------------------
     Pedir, aceitar, listar e remover amigo. Só conta nomeada. É a
     base dos convites pra jogar (4.4), que NÃO estão aqui.

     Nós (ver database.rules.json pro raciocínio das regras):
       friendRequests/{paraUid}/{deUid} = { nome, em }
       friends/{donoUid}/{amigoUid}     = { nome, desde }

     A amizade fica gravada nos DOIS lados pra cada um listar a
     própria lista lendo só o seu ramo — nenhum dos dois nós tem
     leitura na raiz, então continua impossível varrer os usuários
     da cidade (mesma disciplina de presence/).

     Aceite e remoção saem num update() multi-caminho, que o RTDB
     aplica de forma atômica: ou os dois lados entram/saem, ou
     nenhum. É isso que evita amizade meio-feita sem precisar de
     Cloud Function.

     COMO ALGUÉM TE ACHA — pelo "código de amigo". Não existe busca
     por nome, de propósito: para buscar seria preciso um índice
     legível de todo mundo, que é exatamente o que as regras impedem.

     O código nasceu como AON-<uid>: 28 caracteres, impossível de
     passar de boca. A P2 trocou pelo CURTO (AON-AB12CD, 6 chars),
     mantendo o antigo aceito na colagem pra ninguém ficar com um
     código morto no WhatsApp. Ver o bloco de código curto abaixo.

     NOME EXIBIDO — o `nome` gravado nos nós é uma fotografia do
     momento. Quem renomear depois apareceria com o nome velho na
     lista dos outros; por isso a UI prefere o nome que vem VIVO da
     presença (AngatubaPresenca.observar devolve {state, nome}) e só
     cai no nome gravado quando não há presença. Sem escrita extra e
     sem regra nova.

     API pública (window.AngatubaAmigos):
       meuCodigo()             -> 'AON-<uid>' ou null (legado/fallback)
       meuCodigoCurto()        -> 'AON-AB12CD' do cache, ou null
       garantirCodigo()        -> Promise<'AON-AB12CD'> (gera se falta)
       pedir(codigo)           -> Promise; erros já em PT-BR
       aceitar(uid)            -> Promise (grava os dois lados)
       recusar(uid)            -> Promise
       remover(uid)            -> Promise (apaga os dois lados)
       atualizarFoto()         -> Promise; espelha a foto nova (P3)
       observarAmigos(cb)      -> cb([{uid, nome, foto, desde}]);
                                  devolve a função de parar de ouvir
       observarPedidos(cb)     -> cb([{uid, nome, foto, em}]); idem
  ══════════════════════════════════════════════════════════════ */

  var AMIGO_PREFIXO = 'AON-';

  /* ── Código curto de amigo (P2) ────────────────────────────────
     AON-<uid> tinha 32 caracteres: dava pra copiar e colar, mas não
     pra ditar no balcão nem digitar no celular do amigo. O curto tem
     6, num alfabeto sem os pares que todo mundo erra (0/O, 1/I/L).

       friendCodes/{CODIGO} = { uid, em }     <- resolve código -> uid
       friendCodeOf/{uid}   = { codigo, em }  <- resolve uid -> código

     Dois nós porque cada um responde uma pergunta diferente, e nenhum
     dos dois tem leitura na RAIZ: dá pra ler UM código (é o que o
     "colar" precisa), nunca pra listar todos. O reverso só o dono lê.

     ESTÁVEL POR CONTA, não regenerável pela UI. É por isso que existe
     o friendCodeOf: sem ele, abrir o app noutro aparelho sortearia um
     código novo e a pessoa passaria pro amigo um código diferente do
     que passou ontem. Não há botão de "trocar meu código" — se um dia
     precisar (código vazado virando spam), é apagar os dois nós e
     deixar o garantir sortear de novo.

     COLISÃO — quem decide não é o cliente: a regra do RTDB só deixa
     CRIAR friendCodes/{codigo} que ainda não existe. Duas pessoas
     sorteando o mesmo código no mesmo instante: uma escreve, a outra
     leva permission_denied e sorteia outro. 31^6 ≈ 887 milhões de
     combinações pra uma cidade de 20 mil habitantes — a colisão é
     teórica, mas o tratamento é de graça.

     GERAÇÃO SOB DEMANDA, não no login: quem nunca abre "Meus amigos"
     não gasta uma escrita no banco. A garantia roda ao pintar o
     painel (aquece o cache) e no toque de "Copiar meu código". */
  var AMIGO_COD_ALFA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  // sem 0 O 1 I L
  var AMIGO_COD_LEN  = 6;
  var AMIGO_COD_TENT = 6;      // tentativas antes de desistir
  var AMIGO_FOTO_MAX = 300;    // teto da photoURL gravada (igual na regra)

  var _amCodRe = new RegExp('^[' + AMIGO_COD_ALFA + ']{' + AMIGO_COD_LEN + '}$');
  var _amCodigoCurto = null;   // código da conta atual, já garantido
  var _amCodigoUid   = null;   // uid a que o cache pertence
  var _amCodigoProm  = null;   // garantia em voo (não dispara duas)

  function _amCodigoLimpar() {
    _amCodigoCurto = null; _amCodigoUid = null; _amCodigoProm = null;
  }

  // Math.random basta: o código é um apelido público, não um segredo.
  // Quem impede de adivinhar não é a entropia, é o fato de o pedido
  // não criar vínculo nenhum sem o aceite do outro lado.
  function _amCodigoSortear() {
    var s = '', n = AMIGO_COD_ALFA.length;
    for (var i = 0; i < AMIGO_COD_LEN; i++) {
      s += AMIGO_COD_ALFA.charAt(Math.floor(Math.random() * n));
    }
    return s;
  }

  // Tira espaços e o prefixo AON- (em qualquer caixa) do que a pessoa
  // colou, sem decidir ainda se o miolo é uid ou código curto.
  function _amigosMiolo(codigo) {
    var s = String(codigo || '').trim().replace(/\s+/g, '');
    if (s.toUpperCase().indexOf(AMIGO_PREFIXO) === 0) s = s.slice(AMIGO_PREFIXO.length);
    return s;
  }

  // Código ANTIGO (AON-<uid>): devolve o uid, ou null.
  // uid do Firebase: alfanumérico, tipicamente 28 chars. A faixa
  // larga aceita variações sem deixar passar texto solto — e nunca
  // colide com o curto, que tem 6.
  function _amigosUidDoCodigo(codigo) {
    var s = _amigosMiolo(codigo);
    return /^[A-Za-z0-9]{20,64}$/.test(s) ? s : null;
  }

  // Código CURTO normalizado (sem prefixo, maiúsculo), ou null.
  function _amigosCurtoDoCodigo(codigo) {
    var s = _amigosMiolo(codigo).replace(/-/g, '').toUpperCase();
    return _amCodRe.test(s) ? s : null;
  }

  /* photoURL pra gravar nos nós de amizade (P3). Só https e com teto
     de tamanho — é o mesmo endereço do Cloudinary que o avatar já
     usa, e a regra do RTDB repete os dois limites. */
  function _amigosFotoValida(url) {
    var f = String(url || '').trim();
    // Só Cloudinary e foto do Google (mesma lista das regras do RTDB e do
    // Firestore): foto de outro site mostrava ao dono do site o IP de quem
    // abria o aviso de amizade (auditoria 10/11, P2-7).
    var hostOk = f.indexOf('https://res.cloudinary.com/') === 0 || f.indexOf('https://lh3.googleusercontent.com/') === 0;
    return (hostOk && f.length <= AMIGO_FOTO_MAX) ? f : '';
  }

  function _amigosMinhaFoto() {
    return _amigosFotoValida(_cliUser && _cliUser.photoURL);
  }

  // Carrega o RTDB e devolve {db, uid} — ou rejeita com uma
  // mensagem que já dá pra mostrar na tela.
  function _amigosCtx() {
    if (!_cliContaReal(_cliUser)) {
      return Promise.reject(new Error('Entre na sua conta pra usar a lista de amigos.'));
    }
    var uid = _cliUser.uid;
    return _carregarFirebaseDb().then(function () {
      var db = _presDb();
      if (!db) throw new Error('Sem conexão agora. Tente de novo em instantes.');
      if (!_cliContaReal(_cliUser) || _cliUser.uid !== uid) {
        throw new Error('Entre na sua conta pra usar a lista de amigos.');
      }
      return { db: db, uid: uid };
    });
  }

  // Erros do RTDB em PT-BR, no tom do resto do app.
  function _amigosErroPt(err) {
    var msg = String((err && (err.message || err.code)) || '');
    if (/permission_denied/i.test(msg)) {
      return 'Não foi possível concluir. O pedido pode ter expirado — peça pra pessoa mandar de novo.';
    }
    if (/network|offline/i.test(msg)) return 'Sem conexão. Verifique a internet e tente de novo.';
    return 'Algo deu errado. Tente de novo em instantes.';
  }

  /* Sorteia um código livre e o grava nos dois nós. Quem garante que
     não houve colisão são as REGRAS (só deixam criar um friendCodes
     inexistente), não o cliente: permission_denied aqui quase sempre
     quer dizer "esse já é de alguém", então tenta outro. */
  function _amigosCodigoCriar(ctx, resta) {
    if (resta <= 0) {
      return Promise.reject(new Error('Não deu pra gerar seu código agora. Tente de novo em instantes.'));
    }
    var cod = _amCodigoSortear();
    return ctx.db.ref('friendCodes/' + cod).set({
      uid: ctx.uid,
      em: firebase.database.ServerValue.TIMESTAMP
    }).then(function () {
      // Espelho reverso: é ele que faz o código ser o MESMO em
      // qualquer aparelho. Se falhar, o código vale igual — só o
      // próximo aparelho é que sortearia outro.
      return ctx.db.ref('friendCodeOf/' + ctx.uid).set({
        codigo: cod, em: firebase.database.ServerValue.TIMESTAMP
      }).then(function () { return cod; }, function () { return cod; });
    }, function (err) {
      if (/permission_denied/i.test(String((err && (err.message || err.code)) || ''))) {
        return _amigosCodigoCriar(ctx, resta - 1);
      }
      throw err;
    });
  }

  // Devolve o código curto da conta (sem prefixo), criando na
  // primeira vez. Idempotente e com cache — chamar de novo enquanto
  // a primeira está em voo devolve a MESMA promessa.
  function _amigosCodigoGarantir() {
    return _amigosCtx().then(function (ctx) {
      if (_amCodigoUid === ctx.uid) {
        if (_amCodigoCurto) return _amCodigoCurto;
        if (_amCodigoProm) return _amCodigoProm;
      }
      _amCodigoLimpar();
      _amCodigoUid = ctx.uid;
      _amCodigoProm = ctx.db.ref('friendCodeOf/' + ctx.uid + '/codigo').get()
        .then(function (snap) {
          var v = snap.val();
          return (typeof v === 'string' && _amCodRe.test(v)) ? v : _amigosCodigoCriar(ctx, AMIGO_COD_TENT);
        })
        .then(function (cod) {
          if (_amCodigoUid === ctx.uid) { _amCodigoCurto = cod; _amCodigoProm = null; }
          return cod;
        }, function (err) {
          if (_amCodigoUid === ctx.uid) _amCodigoProm = null;
          throw err;
        });
      return _amCodigoProm;
    });
  }

  /* Transforma o que a pessoa colou num uid. O antigo (AON-<uid>)
     resolve sem tocar no banco; o curto custa UMA leitura de
     friendCodes/{codigo} — que é o único acesso que as regras dão a
     esse nó (ler um código de cada vez, nunca a lista). */
  function _amigosResolverCodigo(ctx, codigo) {
    var uid = _amigosUidDoCodigo(codigo);
    if (uid) return Promise.resolve(uid);
    var curto = _amigosCurtoDoCodigo(codigo);
    if (!curto) return Promise.resolve(null);
    return ctx.db.ref('friendCodes/' + curto + '/uid').get().then(function (snap) {
      var v = snap.val();
      return (typeof v === 'string' && /^[A-Za-z0-9]{20,64}$/.test(v)) ? v : null;
    }, function () { return null; });
  }

  // Lê um nó de lista (friends/{uid} ou friendRequests/{uid}) e
  // entrega um array ordenado pelo campo de data, mais novo em cima.
  function _amigosObservarLista(caminho, campoData, cb) {
    if (typeof cb !== 'function') return function () {};
    var parado = false, off = function () {};
    _amigosCtx().then(function (ctx) {
      if (parado) return;
      var ref = ctx.db.ref(caminho + '/' + ctx.uid);
      var h = function (snap) {
        var val = snap.val() || {};
        var lista = Object.keys(val).map(function (uid) {
          var d = val[uid] || {};
          return {
            uid: uid,
            nome: String(d.nome || 'Jogador').slice(0, CLI_NOME_MAX),
            foto: _amigosFotoValida(d.foto),
            data: d[campoData] || 0
          };
        });
        lista.sort(function (a, b) { return b.data - a.data; });
        cb(lista);
      };
      ref.on('value', h, function () { cb([]); });
      off = function () { try { ref.off('value', h); } catch (e) {} };
    }).catch(function () { if (!parado) cb([]); });
    return function () { parado = true; off(); };
  }

  window.AngatubaAmigos = {
    /* Código LONGO (AON-<uid>). Continua aqui como fallback pra quando
       o RTDB não responde e o curto não pode ser garantido — e porque
       códigos antigos ainda circulam no WhatsApp das pessoas. */
    meuCodigo: function () {
      return _cliContaReal(_cliUser) ? (AMIGO_PREFIXO + _cliUser.uid) : null;
    },

    // Código CURTO já garantido nesta sessão, ou null (sem I/O).
    meuCodigoCurto: function () {
      return (_amCodigoCurto && _cliContaReal(_cliUser) && _cliUser.uid === _amCodigoUid)
        ? (AMIGO_PREFIXO + _amCodigoCurto) : null;
    },

    // Garante o curto (cria na primeira vez) e devolve com prefixo.
    garantirCodigo: function () {
      return _amigosCodigoGarantir().then(function (cod) { return AMIGO_PREFIXO + cod; });
    },

    /* Manda pedido. Só escreve no ramo de quem RECEBE — é o único nó
       que as regras liberam pra isso, e é o que mantém o pedido sem
       nenhum efeito até a outra pessoa aceitar.

       Aceita os DOIS formatos de código: o curto (uma leitura em
       friendCodes) e o antigo AON-<uid> (sem leitura nenhuma). */
    pedir: function (codigo) {
      if (!String(codigo || '').trim()) {
        return Promise.reject(new Error('Cole aqui o código do seu amigo.'));
      }
      return _amigosCtx().then(function (ctx) {
        return _amigosResolverCodigo(ctx, codigo).then(function (alvo) {
          if (!alvo) throw new Error('Código inválido. Peça pra pessoa copiar o código dela de novo.');
          if (alvo === ctx.uid) throw new Error('Esse é o seu próprio código.');
          // Já são amigos? Evita um pedido que não levaria a nada.
          return ctx.db.ref('friends/' + ctx.uid + '/' + alvo).get().then(function (snap) {
            if (snap.exists()) throw new Error('Vocês já são amigos.');
            // A foto vai junto pra quem recebe já ver o rosto no aviso
            // e, ao aceitar, gravá-la na própria lista (P3).
            var pedido = {
              nome: cliNomeExibicao() || 'Jogador',
              em: firebase.database.ServerValue.TIMESTAMP
            };
            var minhaFoto = _amigosMinhaFoto();
            if (minhaFoto) pedido.foto = minhaFoto;
            return ctx.db.ref('friendRequests/' + alvo + '/' + ctx.uid).set(pedido);
          });
        });
      }).catch(function (err) {
        // Mensagens que já são nossas passam direto; o resto vira PT-BR.
        throw new Error(/Código inválido|próprio código|já são amigos|Entre na sua conta|Sem conexão agora|Cole aqui/.test(String(err && err.message))
          ? err.message : _amigosErroPt(err));
      });
    },

    /* Aceita: grava os dois lados e apaga o pedido, tudo num update
       atômico. A regra que libera friends/{outro}/{eu} confere que o
       pedido existe — e o `root` das regras é o estado ANTERIOR ao
       update, então apagar o pedido aqui não atrapalha. */
    aceitar: function (outroUid) {
      if (!outroUid) return Promise.reject(new Error('Pedido inválido.'));
      return _amigosCtx().then(function (ctx) {
        return ctx.db.ref('friendRequests/' + ctx.uid + '/' + outroUid).get().then(function (snap) {
          if (!snap.exists()) throw new Error('Esse pedido não está mais valendo.');
          var d = snap.val() || {};
          var nomeDele = String(d.nome || 'Jogador').slice(0, CLI_NOME_MAX);
          var fotoDele = _amigosFotoValida(d.foto);      // veio no pedido (P3)
          var meuNome = cliNomeExibicao() || 'Jogador';
          var minhaFoto = _amigosMinhaFoto();
          var agora = firebase.database.ServerValue.TIMESTAMP;
          var dele = { nome: nomeDele, desde: agora };
          if (fotoDele) dele.foto = fotoDele;
          var meu = { nome: meuNome, desde: agora };
          if (minhaFoto) meu.foto = minhaFoto;
          var updates = {};
          updates['friends/' + ctx.uid + '/' + outroUid] = dele;
          updates['friends/' + outroUid + '/' + ctx.uid] = meu;
          updates['friendRequests/' + ctx.uid + '/' + outroUid] = null;
          return ctx.db.ref().update(updates);
        });
      }).catch(function (err) {
        throw new Error(/não está mais valendo|Entre na sua conta|Sem conexão agora/.test(String(err && err.message))
          ? err.message : _amigosErroPt(err));
      });
    },

    // Recusar é só apagar o pedido da própria caixa.
    recusar: function (outroUid) {
      if (!outroUid) return Promise.reject(new Error('Pedido inválido.'));
      return _amigosCtx().then(function (ctx) {
        return ctx.db.ref('friendRequests/' + ctx.uid + '/' + outroUid).remove();
      }).catch(function (err) {
        throw new Error(/Entre na sua conta|Sem conexão agora/.test(String(err && err.message))
          ? err.message : _amigosErroPt(err));
      });
    },

    /* Remove dos DOIS lados. Apagar a própria entrada na lista do
       outro é o segundo caso que as regras liberam (remoção, nunca
       escrita). Atômico pelo mesmo update multi-caminho. */
    remover: function (outroUid) {
      if (!outroUid) return Promise.reject(new Error('Amigo inválido.'));
      return _amigosCtx().then(function (ctx) {
        var updates = {};
        updates['friends/' + ctx.uid + '/' + outroUid] = null;
        updates['friends/' + outroUid + '/' + ctx.uid] = null;
        return ctx.db.ref().update(updates);
      }).catch(function (err) {
        throw new Error(/Entre na sua conta|Sem conexão agora/.test(String(err && err.message))
          ? err.message : _amigosErroPt(err));
      });
    },

    /* Espelha a foto NOVA no meu cartão dentro da lista de cada amigo
       (P3). Sem isto, a foto gravada no aceite envelheceria e a pessoa
       apareceria pros amigos com o rosto de meses atrás.

       Uma escrita por amigo, cada uma com seu próprio catch, em vez de
       um update multi-caminho: o multi-caminho é atômico, e bastaria
       UM amigo que já tivesse me removido (nó inexistente, validate
       exige nome+desde) pra derrubar o espelho de todos os outros.

       A regra libera porque o nó JÁ existe e quem escreve é o dono da
       própria entrada — é o cartão dele na lista alheia, não uma
       entrada nova. Silencioso: foto é enfeite, nunca pode quebrar a
       troca de foto em si. */
    atualizarFoto: function () {
      var foto = _amigosMinhaFoto();
      return _amigosCtx().then(function (ctx) {
        return ctx.db.ref('friends/' + ctx.uid).get().then(function (snap) {
          var uids = Object.keys(snap.val() || {});
          if (!uids.length) return;
          return Promise.all(uids.map(function (u) {
            return ctx.db.ref('friends/' + u + '/' + ctx.uid + '/foto')
              .set(foto || null).catch(function () {});
          }));
        });
      }).catch(function () {});
    },

    observarAmigos: function (cb) {
      return _amigosObservarLista('friends', 'desde', function (l) {
        cb(l.map(function (i) { return { uid: i.uid, nome: i.nome, foto: i.foto, desde: i.data }; }));
      });
    },

    observarPedidos: function (cb) {
      return _amigosObservarLista('friendRequests', 'em', function (l) {
        cb(l.map(function (i) { return { uid: i.uid, nome: i.nome, foto: i.foto, em: i.data }; }));
      });
    }
  };

  /* ── UI de amigos, dentro do painel de conta ──────────────────
     Só monta quando o painel abre e desliga tudo quando ele fecha:
     são listeners de RTDB (a lista, os pedidos e uma presença por
     amigo), e deixá-los vivos com o painel fechado seria tráfego à
     toa no celular de quem nem está olhando. */
  var _amUnsubLista = null;     // para de ouvir friends/{uid}
  var _amUnsubPedidos = null;   // para de ouvir friendRequests/{uid}
  var _amUnsubPresenca = {};    // uid do amigo -> função de parar
  /* _amNomeVivo: declarada no app.js (bloco SOCIAL SOB DEMANDA) */         // uid -> nome que veio da presença

  function _amSoltarPresencas() {
    Object.keys(_amUnsubPresenca).forEach(function (uid) {
      try { _amUnsubPresenca[uid](); } catch (e) {}
    });
    _amUnsubPresenca = {};
  }

  // Avatar (foto ou inicial) + pontinho de presença. O estado entra
  // como classe pra não recriar a linha inteira a cada mudança.
  // semDot: o convite (4.4) reusa o avatar mas NÃO pode repetir o
  // data-pres do amigo — _amPintarPresenca pinta o primeiro que
  // acha, e o pontinho da lista pararia de atualizar.
  // foto (P3): a photoURL gravada no nó. Mesma mecânica de fallback do
  // avatar do header e do painel — onerror esconde a imagem e revela a
  // inicial que já está montada atrás dela.
  /* attrPres: nome do atributo do pontinho ('pres' por padrão). O lobby
     (5.2) desenha a MESMA pessoa numa lista que pode estar na tela junto
     com esta — com dois data-pres iguais, o querySelector do
     _amPintarPresenca pintaria sempre o primeiro. */
  function _amLinhaAvatar(uid, nome, semDot, foto, attrPres) {
    var ini = escHTML((String(nome).trim()[0] || '?').toUpperCase());
    var f = _amigosFotoValida(foto);
    return '<span class="cli-amigo-av">' +
      (f
        ? '<img src="' + escHTML(f) + '" alt="" class="cli-amigo-av-img" ' +
          'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
          '<span class="cli-amigo-av-ini" style="display:none">' + ini + '</span>'
        : ini) +
      (semDot ? '' : '<span class="cli-amigo-dot" data-' + (attrPres || 'pres') +
        '="' + escHTML(uid) + '"></span>') + '</span>';
  }

  function cliAmigosRender() {
    var elLista = document.getElementById('cli-amigos-lista');
    var elVazio = document.getElementById('cli-amigos-vazio');
    var elPed = document.getElementById('cli-amigos-pedidos');
    if (!elLista) return;

    // Convites pra jogar (4.4) vêm do cache da escuta global — pinta
    // já na abertura do painel, sem esperar snapshot novo.
    cliConvitesRender();

    // Sem conta nomeada não há lista: o painel nem abre nesse caso
    // (o header só mostra o avatar pra quem está logado), mas se
    // chegar aqui, mostra o vazio em vez de listener nenhum.
    if (!_cliContaReal(_cliUser)) {
      elLista.innerHTML = '';
      if (elPed) { elPed.innerHTML = ''; elPed.style.display = 'none'; }
      if (elVazio) elVazio.style.display = 'block';
      cliContaResumoSet('amigos', 0);
      return;
    }

    cliAmigosSoltar();

    /* Aquece o código curto (P2) enquanto a pessoa olha a lista. Sem
       isto, o primeiro toque em "Copiar meu código" teria que ir ao
       banco ANTES de escrever na área de transferência — e alguns
       navegadores (Safari) recusam o clipboard fora do gesto. Com o
       cache quente, a cópia é síncrona. Falhou? O botão tenta de novo
       sozinho no toque. */
    window.AngatubaAmigos.garantirCodigo().catch(function () {});

    _amUnsubLista = window.AngatubaAmigos.observarAmigos(function (amigos) {
      _amSoltarPresencas();
      cliContaResumoSet('amigos', amigos.length);
      if (!amigos.length) {
        elLista.innerHTML = '';
        if (elVazio) elVazio.style.display = 'block';
        return;
      }
      if (elVazio) elVazio.style.display = 'none';
      elLista.innerHTML = amigos.map(function (a) {
        var nome = _amNomeVivo[a.uid] || a.nome;
        _chatLembrarPessoa(a.uid, nome, a.foto);
        return '<div class="cli-amigo-item" data-amigo="' + escHTML(a.uid) + '">' +
          '<span class="cli-amigo-clicavel" role="button" tabindex="0" ' +
            'onclick="cliAbrirPerfilAmigo(\'' + escHTML(a.uid) + '\')" ' +
            'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();cliAbrirPerfilAmigo(\'' +
              escHTML(a.uid) + '\');}">' +
            _amLinhaAvatar(a.uid, nome, false, a.foto) +
            '<span class="cli-amigo-txt">' +
              '<span class="cli-amigo-nome">' + escHTML(nome) + '</span>' +
              '<span class="cli-amigo-sub" data-pres-txt="' + escHTML(a.uid) + '">—</span>' +
            '</span>' +
          '</span>' +
          '<span class="cli-amigo-acoes">' +
            // Chat 1x1 (Fase 2): conversa direta, com o contador de
            // não lidas desse amigo (pintado por _chatPintarBadges).
            '<button type="button" class="cli-amigo-btn chat" data-chat="' + escHTML(a.uid) + '" ' +
              'onclick="cliAbrirChat(\'' + escHTML(a.uid) + '\')" ' +
              'aria-label="Conversar" title="Conversar">' +
              '<i class="fa fa-comment"></i><span class="cli-amigo-chat-n" style="display:none"></span></button>' +
            // Chamar pra jogar (4.4): abre a fileira de jogos logo
            // abaixo desta linha. Ganha destaque quando a presença
            // diz que a pessoa está online.
            '<button type="button" class="cli-amigo-btn jogar" data-jogar="' + escHTML(a.uid) + '" ' +
              'onclick="cliAmigosJogar(\'' + escHTML(a.uid) + '\')" ' +
              'aria-label="Chamar pra jogar" title="Chamar pra jogar">' +
              '<i class="fa fa-gamepad"></i></button>' +
            '<button type="button" class="cli-amigo-btn no" onclick="cliAmigosRemover(\'' +
              escHTML(a.uid) + '\')" aria-label="Remover amigo" title="Remover amigo">' +
              '<i class="fa fa-user-minus"></i></button>' +
          '</span></div>';
      }).join('');
      _chatPintarBadges();
      // Uma escuta de presença por amigo (AngatubaPresenca.observar).
      // As regras só deixam ler presence/{uid} um a um — é exatamente
      // este acesso, e é o que impede varrer a cidade inteira.
      amigos.forEach(function (a) {
        _amUnsubPresenca[a.uid] = window.AngatubaPresenca.observar(a.uid, function (p) {
          // O nome da presença é o VIVO; o gravado em friends/ é uma
          // fotografia de quando a amizade nasceu.
          if (p && p.nome) _amNomeVivo[a.uid] = String(p.nome).slice(0, CLI_NOME_MAX);
          _amPintarPresenca(a.uid, p);
        });
      });
    });

    _amUnsubPedidos = window.AngatubaAmigos.observarPedidos(function (pedidos) {
      if (!elPed) return;
      if (!pedidos.length) { elPed.innerHTML = ''; elPed.style.display = 'none'; return; }
      elPed.style.display = 'flex';
      elPed.innerHTML = pedidos.map(function (p) {
        return '<div class="cli-amigo-item pedido">' +
          '<span class="cli-amigo-clicavel" role="button" tabindex="0" ' +
            'onclick="cliAbrirPerfilAmigo(\'' + escHTML(p.uid) + '\')" ' +
            'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();cliAbrirPerfilAmigo(\'' +
              escHTML(p.uid) + '\');}">' +
            _amLinhaAvatar(p.uid, p.nome, false, p.foto) +
            '<span class="cli-amigo-txt">' +
              '<span class="cli-amigo-nome">' + escHTML(p.nome) + '</span>' +
              '<span class="cli-amigo-sub">quer ser seu amigo</span>' +
            '</span>' +
          '</span>' +
          '<span class="cli-amigo-acoes">' +
            '<button type="button" class="cli-amigo-btn ok" onclick="cliAmigosAceitar(\'' +
              escHTML(p.uid) + '\')" aria-label="Aceitar" title="Aceitar"><i class="fa fa-check"></i></button>' +
            '<button type="button" class="cli-amigo-btn no" onclick="cliAmigosRecusar(\'' +
              escHTML(p.uid) + '\')" aria-label="Recusar" title="Recusar"><i class="fa fa-xmark"></i></button>' +
          '</span></div>';
      }).join('');
    });
  }

  // Pinta o pontinho e o rótulo de UM amigo, sem redesenhar a lista.
  function _amPintarPresenca(uid, p) {
    var estado = (p && p.state) || 'offline';
    var dot = document.querySelector('.cli-amigo-dot[data-pres="' + uid + '"]');
    if (dot) dot.className = 'cli-amigo-dot' + _presClasseDot(p);
    // Presença rica: "Jogando Voo da Coruja", "Na Biblioteca"... (textContent:
    // o texto vem do nó de outra pessoa, nunca vira HTML).
    var txt = document.querySelector('.cli-amigo-sub[data-pres-txt="' + uid + '"]');
    if (txt) txt.textContent = _presRotulo(p).texto;
    // Botão de chamar pra jogar (4.4) em destaque só pra quem está
    // online — offline continua clicável, o convite espera na caixa.
    var jg = document.querySelector('.cli-amigo-btn.jogar[data-jogar="' + uid + '"]');
    if (jg) jg.classList.toggle('on', estado === 'online');
  }

  // Desliga todos os listeners de amigos (chamado ao fechar o painel).
  function cliAmigosSoltar() {
    if (_amUnsubLista) { try { _amUnsubLista(); } catch (e) {} _amUnsubLista = null; }
    if (_amUnsubPedidos) { try { _amUnsubPedidos(); } catch (e) {} _amUnsubPedidos = null; }
    _amSoltarPresencas();
  }

  function _amMsg(texto, tipo) {
    var el = document.getElementById('cli-amigos-msg');
    if (!el) return;
    el.textContent = texto || '';
    el.className = 'cli-amigos-msg' + (tipo ? ' ' + tipo : '');
  }

  /* Copiar o código CURTO (P2). navigator.clipboard falha em contexto
     não seguro e em alguns WebViews, então caímos pra seleção manual
     mostrando o código na própria mensagem — a pessoa copia à mão (e
     com 6 caracteres agora dá até pra ditar).

     Três caminhos, nesta ordem: cache quente (o comum, síncrono, vindo
     do garantirCodigo do render), garantia sob demanda, e o código
     antigo AON-<uid> se o banco não responder — melhor um código longo
     que código nenhum. */
  function cliAmigosCopiarCodigo() {
    if (!_cliContaReal(_cliUser)) { _amMsg('Entre na sua conta pra ter um código.', 'erro'); return; }
    var btn = document.getElementById('cli-amigos-cod-btn');
    var copiar = function (cod) {
      var mostrar = function () { _amMsg('Seu código: ' + cod, ''); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cod)
          .then(function () { _uiSom('copiar'); _amMsg('Código copiado: ' + cod + ' — mande pro seu amigo.', 'ok'); })
          .catch(mostrar);
      } else {
        mostrar();
      }
    };

    var pronto = window.AngatubaAmigos.meuCodigoCurto();
    if (pronto) { copiar(pronto); return; }

    if (btn) btn.disabled = true;
    _amMsg('Gerando seu código…', '');
    window.AngatubaAmigos.garantirCodigo().then(copiar).catch(function () {
      var velho = window.AngatubaAmigos.meuCodigo();
      if (velho) copiar(velho);
      else _amMsg('Não deu pra gerar seu código agora. Tente de novo em instantes.', 'erro');
    }).then(function () { if (btn) btn.disabled = false; });
  }

  function cliAmigosPedir() {
    var inp = document.getElementById('cli-amigos-cod-input');
    var btn = document.getElementById('cli-amigos-add-ok');
    if (!inp) return;
    var cod = inp.value || '';
    if (!cod.trim()) { _amMsg('Cole aqui o código do seu amigo.', 'erro'); return; }
    if (btn) btn.disabled = true;
    _amMsg('Enviando…', '');
    window.AngatubaAmigos.pedir(cod).then(function () {
      inp.value = '';
      _amMsg('Pedido enviado! Agora é só a pessoa aceitar.', 'ok');
    }).catch(function (err) {
      _amMsg((err && err.message) || 'Não deu pra enviar o pedido.', 'erro');
    }).then(function () { if (btn) btn.disabled = false; });
  }

  function cliAmigosAceitar(uid) {
    _amMsg('', '');
    window.AngatubaAmigos.aceitar(uid).then(function () {
      if (typeof showToastSimples === 'function') showToastSimples('Amizade confirmada!', '/webp/owl-thumbsup.webp');
    }).catch(function (err) { _amMsg((err && err.message) || 'Não deu pra aceitar.', 'erro'); });
  }

  function cliAmigosRecusar(uid) {
    _amMsg('', '');
    window.AngatubaAmigos.recusar(uid).catch(function (err) {
      _amMsg((err && err.message) || 'Não deu pra recusar.', 'erro');
    });
  }

  function cliAmigosRemover(uid) {
    if (!confirm('Remover esta pessoa dos seus amigos?')) return;
    _amMsg('', '');
    window.AngatubaAmigos.remover(uid).catch(function (err) {
      _amMsg((err && err.message) || 'Não deu pra remover.', 'erro');
    });
  }

  window.cliAmigosCopiarCodigo = cliAmigosCopiarCodigo;
  window.cliAmigosPedir        = cliAmigosPedir;
  window.cliAmigosAceitar      = cliAmigosAceitar;
  window.cliAmigosRecusar      = cliAmigosRecusar;
  window.cliAmigosRemover      = cliAmigosRemover;

  /* ══════════════════════════════════════════════════════════════
     CONVITES PRA JOGAR (Realtime Database) — Etapa 4.4
     ------------------------------------------------------------
     "Chamar pra jogar" de dentro da lista de amigos, sem depender do
     WhatsApp. Só conta nomeada, só entre amigos já aceitos (4.3).

     Nó (ver database.rules.json pro raciocínio das regras):
       gameInvites/{paraUid}/{inviteId} = {
         de, nome, jogo, codigo, em, expiraEm
       }

     O inviteId NÃO é aleatório: é `{deUid}_{jogo}`, e as regras
     exigem exatamente esse formato. Isso resolve duas coisas de uma
     vez — reconvidar pro mesmo jogo sobrescreve em vez de empilhar,
     e ninguém consegue entupir a caixa de alguém com mil chaves
     diferentes (o teto é o número de jogos, por amigo).

     O QUE O CONVITE CARREGA é só o CÓDIGO da sala. Entrar continua
     sendo o fluxo normal do jogo (salas/, salasParty/,
     salasBaralho/, com as regras daqueles nós valendo iguais); o
     convite é um recado, não um atalho pra dentro de sala nenhuma.

     COMO O CÓDIGO É CAPTURADO — quem abre a sala é o próprio jogo,
     pela tela dele, com as opções dele (sala pública, classe do
     tanque, modo do baralho). Tentar criar a sala por fora daria uma
     sala órfã: a UI do jogo não saberia que ela existe. Então o
     caminho é o inverso — ao escolher "chamar pra jogar", o app
     guarda o convite PENDENTE, abre a tela do jogo e embrulha o
     criarSala() da API pública daquele jogo. Quando o anfitrião
     toca em "Criar sala" e a promise resolve com o código, o convite
     sai sozinho. Nenhum jogo precisou saber que convites existem.

     PUSH NOTIFICATION NÃO IMPLEMENTADA — o convite só chega em quem
     está com o app aberto e logado. FCM ficaria pra uma etapa
     futura (exige service worker de push, chave VAPID e um nó de
     tokens por usuário).

     API pública (window.AngatubaConvites):
       jogos()              -> catálogo {chave: {nome, emoji}}
       convidar(uid, jogo)  -> arma o pendente e abre a tela do jogo
       observarCaixa()      -> liga a escuta da própria caixa
       lista()              -> convites válidos em cache
       aceitar(id)          -> abre o jogo e entra na sala do código
       recusar(id)          -> apaga o convite da própria caixa
  ══════════════════════════════════════════════════════════════ */

  var CONV_VALIDADE_MS = 15 * 60 * 1000;  // convite vale 15 min
  var CONV_PENDENTE_MS = 5 * 60 * 1000;   // janela pro anfitrião criar a sala
  /* Teto da espera pela tela do jogo ficar pronta. Subiu de 20s pra
     30s na 5.3.1: no 4G ruim daqui a abertura do Baralho pelo lobby
     baixa hub.min.js + baralho.min.js + truco.min.js + o SDK do
     Realtime Database, e estourar o teto era o começo da história em
     que a sala nasce sem o lobby saber (ver iniciarJogo). */
  var CONV_ESPERA_MS   = 30000;
  var CONV_ESPERA_PASSO = 80;

  /* Catálogo dos jogos que têm sala em rede. `pronto` é o teste de
     "a tela do jogo já montou e dá pra mexer"; `entrar` é o ponto de
     entrada que o próprio jogo já expunha pra lista de salas
     públicas (é o mesmo caminho de quem toca em "Entrar" ali, só que
     com o código vindo do convite). Os 2048/Voo/etc. da vida não
     entram aqui: não têm sala.

     `codigoAtual` (5.3.1) é o TERCEIRO teste, e o mais importante pro
     lobby: "qual é o código da sala que este módulo tem aberta agora".
     Serve de rede de segurança pro embrulho de criarSala — ver
     `_lobVigiarSala`. Não é API nova em jogo nenhum: Party e Baralho
     já expunham `codigoSala()`, e Ping Pong/Tanques já escrevem o
     código no próprio elemento que mostram pro anfitrião.

     CATÁLOGO ÚNICO (Lobby de seleção). Cada entrada carrega também o
     que o lobby precisa saber do jogo, pra adicionar um jogo novo ser
     UMA entrada aqui (+ o id na lista de database.rules.json):
       max          -> teto de jogadores do jogo (LOB_JOGO_MAX)
       exato        -> true = 1x1, não aceita sobra (LOB_JOGO_EXATO)
       publicaCheck -> id do "sala pública" na tela do jogo (o lobby
                       desmarca: sala do lobby é do grupo)
       criar        -> nome do global que o botão "Criar sala" chama;
                       sem ele o anfitrião cria à mão (Baralho)
     NÃO confundir com os modos da Coruja Party (Minigames / Hex
     Arena): esses são escolhidos DENTRO da sala da Party, em party.js.
     Aqui a Party é uma opção como as outras. */

  /* Lê o código da sala do elemento que o jogo já pinta pro anfitrião.
     Só vale o que está VISÍVEL: o texto sobrevive ao fim da sala, e um
     código velho aqui apontaria o lobby pra uma sala que não existe. */
  function _convCodigoNoDom(id) {
    var el = document.getElementById(id);
    // offsetParent não serve de teste sozinho (elemento em position:fixed
    // tem offsetParent null mesmo visível): o par largura/altura é o
    // jeito honesto de perguntar "isto está renderizado?".
    if (!el || el.style.display === 'none' || !(el.offsetWidth || el.offsetHeight)) return null;
    var s = String(el.textContent || '').trim().toUpperCase();
    return /^[A-Z0-9]{3,8}$/.test(s) ? s : null;
  }

  function _convCodigoDaApi(nomeApi) {
    try {
      var api = window[nomeApi];
      if (!api || typeof api.codigoSala !== 'function') return null;
      var s = api.codigoSala();
      return s ? String(s).toUpperCase() : null;
    } catch (e) { return null; }
  }

  var CONV_JOGOS = {
    pingpong: {
      nome: 'Ping Pong', emoji: '🏓', api: 'AngatubaMP',
      pronto: function () {
        return !!document.getElementById('pp-btn-entrar') && typeof window._ppEntrarSala === 'function';
      },
      entrar: function (codigo) { window._ppEntrarSala(codigo); },
      codigoAtual: function () { return _convCodigoNoDom('pp-sala-codigo'); },
      max: 2, exato: true, publicaCheck: 'pp-publica-check', criar: '_ppCriarSala'
    },
    tanques: {
      nome: 'Tanques', emoji: '💥', api: 'AngatubaMP',
      pronto: function () {
        return !!document.getElementById('tq-btn-entrar') && typeof window._tqEntrarSala === 'function';
      },
      entrar: function (codigo) { window._tqEntrarSala(codigo); },
      codigoAtual: function () { return _convCodigoNoDom('tq-sala-codigo'); },
      max: 2, exato: true, publicaCheck: 'tq-publica-check', criar: '_tqCriarSala'
    },
    // Hóquei da Coruja: 1x1 em tempo real pelo AngatubaMP, igual Ping
    // Pong/Tanques — a tela já expunha _hqCriarSala/_hqEntrarSala(codigo)
    // e pinta o código em #hq-sala-codigo. Nada mudou em hoquei.js.
    hoquei: {
      nome: 'Hóquei', emoji: '🏒', api: 'AngatubaMP',
      pronto: function () {
        return !!document.getElementById('hq-btn-entrar') && typeof window._hqEntrarSala === 'function';
      },
      entrar: function (codigo) { window._hqEntrarSala(codigo); },
      codigoAtual: function () { return _convCodigoNoDom('hq-sala-codigo'); },
      max: 2, exato: true, publicaCheck: 'hq-publica-check', criar: '_hqCriarSala'
    },
    party: {
      nome: 'Party', emoji: '🎉', api: 'AngatubaParty',
      pronto: function () {
        return !!document.getElementById('pty-codigo-input') && typeof window._ptyEntrarSala === 'function';
      },
      entrar: function (codigo) { window._ptyEntrarSala(codigo); },
      codigoAtual: function () { return _convCodigoDaApi('AngatubaParty'); },
      max: 4, publicaCheck: 'pty-publica-check', criar: '_ptyCriarSala'
    },
    baralho: {
      nome: 'Baralho', emoji: '🃏', api: 'AngatubaBaralho',
      /* 5.3.3 — o teste era `#baralho-root` ter filho, e isso é frágil
         justamente aqui: `BaralhoGame.parar()` (chamado por
         `_pararJogosExternos`, que roda em toda abertura do hub e em
         todo "voltar") esvazia a raiz. Um único popstate atravessado
         zerava o firstChild e a tela "nunca abria" pra sempre. Agora a
         pergunta é a certa — "dá pra chamar entrarPorCodigo?" — e quem
         responde é o próprio módulo (`BaralhoGame.pronto()`, que vive
         do `preparar()`). O teste antigo fica de reserva pra um
         baralho.min.js velho ainda em cache. */
      pronto: function () {
        if (!window.BaralhoGame || typeof window.BaralhoGame.entrarPorCodigo !== 'function') return false;
        if (typeof window.BaralhoGame.pronto === 'function') return !!window.BaralhoGame.pronto();
        var raiz = document.getElementById('baralho-root');
        return !!(raiz && raiz.firstChild);
      },
      // entrarPorCodigo devolve Promise: o `return` é o que deixa o
      // lobby saber que a entrada falhou (ver _lobEntrarNaSala).
      entrar: function (codigo) { return window.BaralhoGame.entrarPorCodigo(codigo); },
      codigoAtual: function () { return _convCodigoDaApi('AngatubaBaralho'); },
      // Sem `criar`: o modo (Truco/Uno) e o nº de jogadores são escolhidos
      // na tela do baralho, e o anfitrião toca "Criar sala" lá.
      max: 8
    }
  };

  // Uma API serve mais de um jogo (AngatubaMP é Ping Pong E Tanques),
  // então o embrulho de criarSala precisa saber quais jogos aquele
  // global cobre pra não mandar convite de Ping Pong quando a sala
  // criada era de Tanques.
  var CONV_API_JOGOS = {};
  Object.keys(CONV_JOGOS).forEach(function (k) {
    var api = CONV_JOGOS[k].api;
    (CONV_API_JOGOS[api] = CONV_API_JOGOS[api] || []).push(k);
  });

  var _convUnsub = null;      // desliga a escuta da própria caixa
  var _convUid = null;        // uid que está ouvindo
  var _convLista = [];        // convites válidos em cache (mais novo em cima)
  var _convVistos = {};       // "id|codigo" -> true, pra só avisar de convite novo
  var _convPendente = null;   // {paraUid, nome, jogo, ate} esperando o código da sala
  var _convEnvolvidos = {};   // nome do global -> a função embrulhada que penduramos
  var _convPrimeira = true;   // primeiro snapshot da caixa (ver _convReceber)

  /* ── Caixa de entrada ──────────────────────────────────────────
     A escuta fica viva enquanto a conta estiver logada, não só com o
     painel aberto (como a de amigos): é ela que faz o aviso chegar
     em quem está na home. O nó é minúsculo e só o próprio dono lê. */
  function _convObservarCaixa() {
    if (!_cliContaReal(_cliUser)) return;
    var uid = _cliUser.uid;
    if (_convUid === uid) return;
    _convPararCaixa();
    _convUid = uid;
    var parado = false, off = function () {};
    _convUnsub = function () { parado = true; off(); };
    _amigosCtx().then(function (ctx) {
      if (parado || ctx.uid !== uid) return;
      var ref = ctx.db.ref('gameInvites/' + uid);
      var h = function (snap) { _convReceber(snap.val() || {}); };
      ref.on('value', h, function () { _convReceber({}); });
      off = function () { try { ref.off('value', h); } catch (e) {} };
    }).catch(function () { /* sem RTDB: o app segue igual, só não recebe convite */ });
  }

  function _convPararCaixa() {
    if (_convUnsub) { try { _convUnsub(); } catch (e) {} _convUnsub = null; }
    _convUid = null;
    _convLista = [];
    _convVistos = {};
    _convPendente = null;
    _convPrimeira = true;
    cliConvitesRender();
  }

  // Apaga um convite da PRÓPRIA caixa (aceitou, recusou ou expirou).
  function _convApagar(id) {
    if (!id || !_convUid) return;
    _amigosCtx().then(function (ctx) {
      return ctx.db.ref('gameInvites/' + ctx.uid + '/' + id).remove();
    }).catch(function () {});
  }

  /* Cada snapshot da caixa: filtra o que expirou (e aproveita pra
     apagar do banco — é a faxina, já que não há Cloud Function),
     guarda em cache e avisa do que é novo. O "novo" leva o código
     junto na chave: reconvidar pro mesmo jogo reusa o mesmo id, e
     sem isso a segunda chamada entraria muda. */
  function _convReceber(val) {
    var agora = Date.now();
    var lista = [];
    Object.keys(val || {}).forEach(function (id) {
      var c = val[id] || {};
      if (!c.de || !c.codigo || !CONV_JOGOS[c.jogo]) return;
      var ate = c.expiraEm || ((c.em || agora) + CONV_VALIDADE_MS);
      if (ate <= agora) { _convApagar(id); return; }
      lista.push({
        id: id,
        de: c.de,
        nome: String(c.nome || 'Jogador').slice(0, CLI_NOME_MAX),
        jogo: c.jogo,
        codigo: String(c.codigo).toUpperCase(),
        em: c.em || 0,
        expiraEm: ate
      });
    });
    lista.sort(function (a, b) { return b.em - a.em; });

    var novos = lista.filter(function (c) { return !_convVistos[c.id + '|' + c.codigo]; });
    _convVistos = {};
    lista.forEach(function (c) { _convVistos[c.id + '|' + c.codigo] = true; });
    _convLista = lista;
    cliConvitesRender();

    /* Aviso no TOPO (P1) no lugar do toast de baixo, que sumia em
       2,2s. A pilha primeiro se sincroniza com o nó — convite aceito,
       recusado ou expirado não pode deixar card pra trás — e só
       depois abre os novos. */
    var vivas = {};
    lista.forEach(function (c) { vivas['conv:' + c.id + '|' + c.codigo] = true; });
    _avisoSincronizar('conv:', vivas);

    var primeira = _convPrimeira;
    _convPrimeira = false;
    if (novos.length) {
      // Mesma regra dos pedidos: entrar no app com a caixa cheia
      // mostra só o mais recente; depois disso, até AVISO_MAX por
      // snapshot, com o mais novo em cima (daí o reverse).
      (primeira ? novos.slice(0, 1) : novos.slice(0, AVISO_MAX))
        .reverse().forEach(_avisoConvite);
    }
  }

  /* ── Abrir a tela do jogo e esperar ela montar ─────────────────
     Carrega o hub (que troca window._abrirGamesHub pela versão real),
     abre o hub, abre a tela do jogo e espera o `pronto` do catálogo.
     A espera existe porque _abrirJogo() dispara o loader do jogo e
     não devolve promise nenhuma. */
  function _convEsperarPronto(teste) {
    return new Promise(function (resolve, reject) {
      var gasto = 0;
      (function checar() {
        var ok = false;
        try { ok = !!teste(); } catch (e) { ok = false; }
        if (ok) { resolve(); return; }
        gasto += CONV_ESPERA_PASSO;
        if (gasto > CONV_ESPERA_MS) { reject(new Error('A tela do jogo não abriu.')); return; }
        setTimeout(checar, CONV_ESPERA_PASSO);
      })();
    });
  }

  /* 5.3.3 — uma segunda tentativa antes de desistir. Abrir a tela do
     jogo é um caminho com muita peça móvel (hub, loader do módulo,
     histórico do navegador); se alguma delas desmontou a tela no meio
     do caminho, reabrir resolve — e desistir na primeira era trocar
     "demorou um segundo a mais" por um grupo parado com "A tela do
     jogo não abriu". Só a espera é repetida: o hub já está carregado e
     `_abrirJogo` é idempotente. */
  function _convAbrirTelaJogo(jogo, _segunda) {
    var cfg = CONV_JOGOS[jogo];
    if (!cfg) return Promise.reject(new Error('Jogo desconhecido.'));
    return _carregarHubJogos().then(function () {
      if (typeof window._abrirGamesHub !== 'function' || typeof window._abrirJogo !== 'function') {
        throw new Error('Hub de jogos indisponível.');
      }
      window._abrirGamesHub();
      window._abrirJogo(jogo);
      return _convEsperarPronto(cfg.pronto).catch(function (err) {
        if (_segunda) throw err;
        return _convAbrirTelaJogo(jogo, true);
      });
    });
  }

  /* ── Lado de quem convida ──────────────────────────────────────
     Embrulha o criarSala() da API pública do jogo UMA vez, e só em
     quem realmente usou "chamar pra jogar" — quem nunca convida não
     paga nem esse wrapper. O jogo continua chamando o mesmo
     criarSala de sempre; o embrulho só olha o código que passa. */
  function _convEnvolverCriar(jogo) {
    var cfg = CONV_JOGOS[jogo];
    if (!cfg) return;
    var nomeApi = cfg.api;
    var api = window[nomeApi];
    if (!api || typeof api.criarSala !== 'function') return;
    // 5.3.1 — a guarda era um booleano, e por isso mentia em um caso
    // real: se o módulo do jogo reescrevesse window.<API> depois do
    // embrulho (recarga do script, módulo que se redefine), o embrulho
    // ia junto e o booleano impedia pendurar outro pra sempre. Guardar
    // a PRÓPRIA função embrulhada torna a checagem honesta: se o que
    // está lá não é a nossa, embrulha de novo.
    if (_convEnvolvidos[nomeApi] === api.criarSala) return;
    var original = api.criarSala;
    var embrulho = function () {
      var r = original.apply(this, arguments);
      if (!r || typeof r.then !== 'function') return r;
      return r.then(function (codigo) {
        _convEnviarSePendente(nomeApi, codigo);
        // 5.3: o lobby usa o MESMO embrulho pra descobrir o código da
        // sala que acabou de nascer. Um embrulho só por API — duas
        // formas de espiar o criarSala seriam duas formas de errar.
        _lobCapturarSala(nomeApi, codigo);
        return codigo;
      });
    };
    api.criarSala = embrulho;
    _convEnvolvidos[nomeApi] = embrulho;
  }

  function _convEnviarSePendente(nomeApi, codigo) {
    var p = _convPendente;
    if (!p || !codigo) return;
    // A sala criada é de outro jogo da mesma API (criou Tanques mas o
    // convite pendente era de Ping Pong): não é esta.
    if ((CONV_API_JOGOS[nomeApi] || []).indexOf(p.jogo) < 0) return;
    _convPendente = null;
    if (Date.now() > p.ate) return;  // demorou demais: o convite pendente caducou
    _convEnviar(p.paraUid, p.jogo, String(codigo)).then(function () {
      if (typeof showToastSimples === 'function') {
        showToastSimples('Convite enviado pro ' + p.nome + '!', '/webp/owl-thumbsup.webp');
      }
    }).catch(function () {
      if (typeof showToastSimples === 'function') {
        showToastSimples('Não deu pra enviar o convite. Mande o código ' + String(codigo).toUpperCase() + '.', '/webp/owl-sign.webp');
      }
    });
  }

  function _convEnviar(paraUid, jogo, codigo) {
    return _amigosCtx().then(function (ctx) {
      // A chave é imposta pelas regras: {deUid}_{jogo}.
      return ctx.db.ref('gameInvites/' + paraUid + '/' + ctx.uid + '_' + jogo).set({
        de: ctx.uid,
        nome: cliNomeExibicao() || 'Jogador',
        jogo: jogo,
        codigo: codigo,
        em: firebase.database.ServerValue.TIMESTAMP,
        expiraEm: Date.now() + CONV_VALIDADE_MS
      });
    });
  }

  window.AngatubaConvites = {
    jogos: function () { return CONV_JOGOS; },
    lista: function () { return _convLista.slice(); },
    observarCaixa: _convObservarCaixa,

    // Arma o convite e leva pra tela do jogo. O envio acontece quando
    // o anfitrião criar a sala ali (ver _convEnvolverCriar).
    convidar: function (paraUid, jogo, nomeAmigo) {
      var cfg = CONV_JOGOS[jogo];
      if (!cfg) return Promise.reject(new Error('Jogo desconhecido.'));
      if (!_cliContaReal(_cliUser)) return Promise.reject(new Error('Entre na sua conta pra convidar.'));
      var nome = String(nomeAmigo || 'seu amigo').slice(0, CLI_NOME_MAX);
      _convPendente = { paraUid: paraUid, nome: nome, jogo: jogo, ate: Date.now() + CONV_PENDENTE_MS };
      return _convAbrirTelaJogo(jogo).then(function () {
        _convEnvolverCriar(jogo);
        if (typeof showToastSimples === 'function') {
          showToastSimples('Crie a sala — o convite vai sozinho pro ' + nome + '.', '/webp/owl-point.webp');
        }
      }).catch(function (err) {
        _convPendente = null;
        throw err;
      });
    },

    aceitar: function (id) {
      var c = null;
      for (var i = 0; i < _convLista.length; i++) if (_convLista[i].id === id) { c = _convLista[i]; break; }
      if (!c) return Promise.reject(new Error('Esse convite não está mais valendo.'));
      if (Date.now() > c.expiraEm) { _convApagar(id); return Promise.reject(new Error('Esse convite expirou.')); }
      // Apaga já: o convite cumpriu o papel, e deixá-lo na caixa só
      // daria um segundo "Entrar" numa sala onde a pessoa já está.
      _convApagar(id);
      return _convAbrirTelaJogo(c.jogo).then(function () { CONV_JOGOS[c.jogo].entrar(c.codigo); });
    },

    recusar: function (id) { _convApagar(id); return Promise.resolve(); }
  };

  /* ── UI: convites recebidos, no painel de conta ────────────────
     Mesma linha visual dos pedidos de amizade (4.3). Renderiza do
     cache: quem atualiza é a escuta global, que roda com o painel
     aberto ou fechado. */
  function cliConvitesRender() {
    var el = document.getElementById('cli-amigos-convites');
    if (!el) return;
    if (!_convLista.length || !_cliContaReal(_cliUser)) {
      el.innerHTML = ''; el.style.display = 'none';
      return;
    }
    el.style.display = 'flex';
    el.innerHTML = _convLista.map(function (c) {
      var j = CONV_JOGOS[c.jogo];
      return '<div class="cli-amigo-item convite">' +
        '<span class="cli-amigo-clicavel" role="button" tabindex="0" ' +
          'onclick="cliAbrirPerfilAmigo(\'' + escHTML(c.de) + '\')" ' +
          'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();cliAbrirPerfilAmigo(\'' +
            escHTML(c.de) + '\');}">' +
          _amLinhaAvatar(c.de, c.nome, true) +
          '<span class="cli-amigo-txt">' +
            '<span class="cli-amigo-nome">' + escHTML(c.nome) + '</span>' +
            '<span class="cli-amigo-sub">te chamou pro ' + j.emoji + ' ' + escHTML(j.nome) + '</span>' +
          '</span>' +
        '</span>' +
        '<span class="cli-amigo-acoes">' +
          '<button type="button" class="cli-amigo-btn ok" onclick="cliConviteEntrar(\'' +
            escHTML(c.id) + '\')" aria-label="Entrar no jogo" title="Entrar"><i class="fa fa-play"></i></button>' +
          '<button type="button" class="cli-amigo-btn no" onclick="cliConviteRecusar(\'' +
            escHTML(c.id) + '\')" aria-label="Recusar" title="Recusar"><i class="fa fa-xmark"></i></button>' +
        '</span></div>';
    }).join('');
  }

  /* Abre (ou fecha) a fileira de jogos embaixo do amigo. Mexe direto
     no DOM em vez de entrar no render da lista: a fileira é efêmera e
     some sozinha no próximo redesenho da lista, que é o que a gente
     quer mesmo. */
  function cliAmigosJogar(uid) {
    var item = document.querySelector('.cli-amigo-item[data-amigo="' + uid + '"]');
    if (!item) return;
    var prox = item.nextElementSibling;
    var jaAberto = !!(prox && prox.classList.contains('cli-amigo-jogos'));
    var abertos = document.querySelectorAll('.cli-amigo-jogos');
    for (var i = 0; i < abertos.length; i++) abertos[i].parentNode.removeChild(abertos[i]);
    if (jaAberto) return;
    var box = document.createElement('div');
    box.className = 'cli-amigo-jogos';
    // Lobby (5.2): quando você está num, o primeiro botão da fileira
    // chama pro lobby em vez de abrir sala de jogo nenhuma.
    var _lobAtual = window.AngatubaLobby && window.AngatubaLobby.meuLobby();
    box.innerHTML = (_lobAtual
      ? '<button type="button" class="cli-amigo-jogo lobby" onclick="cliLobbyChamar(\'' +
        escHTML(uid) + '\')">\uD83C\uDFAA Chamar pro lobby</button>'
      : '') + Object.keys(CONV_JOGOS).map(function (k) {
      return '<button type="button" class="cli-amigo-jogo" onclick="cliConviteEnviar(\'' +
        escHTML(uid) + '\',\'' + k + '\')">' + CONV_JOGOS[k].emoji + ' ' + escHTML(CONV_JOGOS[k].nome) + '</button>';
    }).join('');
    item.parentNode.insertBefore(box, item.nextSibling);
  }

  function cliConviteEnviar(uid, jogo) {
    var nomeEl = document.querySelector('.cli-amigo-item[data-amigo="' + uid + '"] .cli-amigo-nome');
    var nome = (nomeEl && nomeEl.textContent) || _amNomeVivo[uid] || 'seu amigo';
    _amMsg('', '');
    // Mesmo compasso do cliAbrirLojaFav: fechar o painel dispara um
    // history.back(), e o hub de jogos empilha a entrada dele logo em
    // seguida. Sem a folga, o popstate atrasado derrubaria a tela do
    // jogo que acabou de abrir.
    cliFecharPainelConta();
    setTimeout(function () {
      window.AngatubaConvites.convidar(uid, jogo, nome).catch(function (err) {
        if (typeof showToastSimples === 'function') {
          showToastSimples((err && err.message) || 'Não deu pra abrir o jogo.', '/webp/owl-sign.webp');
        }
      });
    }, 220);
  }

  function cliConviteEntrar(id) {
    cliFecharPainelConta();
    setTimeout(function () {   // ver cliConviteEnviar: mesma folga pro popstate
      window.AngatubaConvites.aceitar(id).catch(function (err) {
        if (typeof showToastSimples === 'function') {
          showToastSimples((err && err.message) || 'Não deu pra entrar na sala.', '/webp/owl-sign.webp');
        }
      });
    }, 220);
  }

  function cliConviteRecusar(id) {
    window.AngatubaConvites.recusar(id);
  }

  window.cliAmigosJogar    = cliAmigosJogar;
  window.cliConviteEnviar  = cliConviteEnviar;
  window.cliConviteEntrar  = cliConviteEntrar;
  window.cliConviteRecusar = cliConviteRecusar;

  /* ── Abrir perfil a partir da lista de amigos/pedidos/convites ─────
     Toque no avatar/nome abre o perfil daquela pessoa — mesmo destino
     do ranking (perfilAbrirUid, em Jogos/hub.js).

     A primeira versão fechava o painel com history.back() e só abria
     o perfil 220ms depois — no celular o popstate do back costuma
     chegar DEPOIS desses 220ms (ou depois do pushState do próprio
     perfil), derrubando a tela que acabara de abrir. Aqui a gente evita
     a corrida de outro jeito: fecha o overlay SEM back (viaPopstate),
     limpa a entrada 'cli-conta' no lugar (replaceState) pra não deixar
     lixo no histórico embaixo do perfil, e só então chama
     perfilAbrirUid — que empilha o próprio pushState({modal:'perfil'})
     em cima do estado já neutro. Não existe mais history.back()
     nenhum nesse caminho, então não tem popstate atrasado pra
     atrapalhar. */
  function cliAbrirPerfilAmigo(uid) {
    if (!uid) return;
    cliFecharPainelConta(true); // true = viaPopstate: só esconde, sem history.back()
    if (history.state && history.state.modal === 'cli-conta') {
      // Troca a entrada 'cli-conta' (que já não corresponde a nada na
      // tela, o painel acabou de fechar) por uma neutra, no MESMO
      // degrau do histórico — sem empilhar nada novo.
      try {
        history.replaceState({}, '', location.pathname + location.search + location.hash);
      } catch (e) {}
    }
    var abrirPerfil = function () {
      if (typeof window.perfilAbrirUid === 'function') { window.perfilAbrirUid(uid); return; }
      if (typeof _carregarHubJogos === 'function') {
        _carregarHubJogos().then(function () {
          if (typeof window.perfilAbrirUid === 'function') window.perfilAbrirUid(uid);
        }).catch(function () {});
      }
    };
    // Só 1 frame de folga pro overlay sumir visualmente antes do
    // perfil entrar por cima — nada a ver com o back de antes.
    setTimeout(abrirPerfil, 30);
  }
  window.cliAbrirPerfilAmigo = cliAbrirPerfilAmigo;

  /* ══════════════════════════════════════════════════════════════
     CHAT 1x1 ENTRE AMIGOS (Realtime Database) — Fase 2, item 1
     ------------------------------------------------------------
     POR QUE NO RTDB E NÃO NO FIRESTORE: a amizade mora no RTDB
     (friends/{uid}/{amigo}, Etapa 4.3) e as regras do Firestore não
     enxergam o RTDB. Aqui a regra checa a amizade NO SERVIDOR a cada
     mensagem — mesma trava do gameInvites/lobbyInvites. Desfez a
     amizade, o envio trava na hora (o histórico continua legível pros
     dois, que já tinham lido).

     Nós (ver database.rules.json):
       chats/{A_B}/msgs/{pushId} = { de, txt, em }   A_B = uids em ordem
       chats/{A_B}/lido/{uid}    = timestamp          "visto" de cada um
       chats/{A_B}/typing/{uid}  = timestamp          "digitando…" (chat v2)
       chatInbox/{dono}/{outro}  = {
         ultima, de, em, naoLidas, nome, foto?        lista de conversas
       }

     ENVIO NUM update() MULTI-CAMINHO (atômico): a mensagem, a minha
     entrada na caixa (naoLidas 0) e a do amigo (naoLidas +1 via
     ServerValue.increment). Ou entra tudo, ou nada — sem conversa
     "meio enviada" e sem Cloud Function. `nome`/`foto` da entrada
     descrevem sempre o OUTRO lado (cada um escreve o próprio na caixa
     do amigo).

     LEITURA BARATA: a conversa aberta escuta só as últimas
     CHAT_JANELA mensagens (limitToLast). A caixa é uma escuta global
     (irmã de _convObservarCaixa/_pedObservarGlobal), viva enquanto
     logado: é ela que pinta os contadores e o aviso do topo.

     Só texto: sem mídia, sem áudio, sem figurinha. Sempre textContent/
     escHTML na tela — o texto vem de outra pessoa.

     API (window.AngatubaChat):
       idConversa(a, b)       -> 'A_B'
       observarCaixa(cb)      -> lista [{uid,nome,foto,ultima,de,em,naoLidas}]
       observarConversa(uid, cb) -> cb({ msgs:[{id,de,txt,em}], lidoDele })
       enviar(uid, texto)     -> Promise
       marcarLida(uid)        -> Promise
       digitando(uid, bool)   -> grava/apaga o meu "digitando…"
       observarDigitando(uid, cb) -> cb(true|false) do outro lado
       naoLidasTotal()
  ══════════════════════════════════════════════════════════════ */
  var CHAT_MAX = 500;            // = teto de database.rules.json (txt)
  var CHAT_PREVIA = 80;          // = teto de chatInbox/.../ultima
  var CHAT_JANELA = 50;          // mensagens carregadas por conversa
  var CHAT_DIG_INTERVALO_MS = 2000; // no máx. 1 gravação de "digitando" a cada 2s
  var CHAT_DIG_PARADO_MS = 2500;    // sem tecla por 2,5s = parou de digitar
  var CHAT_DIG_EXPIRA_MS = 6000;    // leitor esconde se não renovar em 6s
  var _chatDigOnDisc = {};          // cid -> onDisconnect já registrado
  var _chatCaixa = {};           // uid -> entrada da caixa (cache da escuta global)
  var _chatCaixaUnsub = null;
  var _chatCaixaUid = null;
  var _chatCaixaPrimeira = true;
  var _chatVistoEm = {};         // uid -> em da última mensagem já avisada
  var _chatPessoas = {};         // uid -> { nome, foto } (amigos/caixa/perfil)

  function _chatDb() {
    if (typeof firebase === 'undefined' || !firebase.database) return null;
    try { return firebase.database(); } catch (e) { return null; }
  }
  function _chatId(a, b) { return (a < b) ? (a + '_' + b) : (b + '_' + a); }
  function _chatEu() { return (_cliContaReal(_cliUser) && _cliUser.uid) || null; }
  function _chatNomeDe(uid) {
    var p = _chatPessoas[uid] || {};
    var n = (typeof _amNomeVivo !== 'undefined' && _amNomeVivo[uid]) || p.nome || (_chatCaixa[uid] && _chatCaixa[uid].nome) || 'Amigo';
    return String(n).trim().slice(0, CLI_NOME_MAX) || 'Amigo';
  }
  function _chatFotoDe(uid) {
    var p = _chatPessoas[uid] || {};
    return _amigosFotoValida(p.foto || (_chatCaixa[uid] && _chatCaixa[uid].foto));
  }
  // Quem fala o nome/foto de um uid ao app (lista de amigos, perfil).
  function _chatLembrarPessoa(uid, nome, foto) {
    if (!uid) return;
    var p = _chatPessoas[uid] || (_chatPessoas[uid] = {});
    if (nome) p.nome = String(nome).slice(0, CLI_NOME_MAX);
    if (foto) p.foto = foto;
  }
  function _chatErro(err) {
    var code = String((err && (err.code || err.message)) || '').toLowerCase();
    if (code.indexOf('permission') !== -1) return new Error('Só dá pra conversar com quem é seu amigo.');
    return new Error('Não deu pra enviar agora. Confira a conexão.');
  }

  window.AngatubaChat = {
    idConversa: _chatId,

    observarCaixa: function (cb) {
      var eu = _chatEu();
      if (!eu || typeof cb !== 'function') return function () {};
      var parado = false, off = function () {};
      _carregarFirebaseDb().then(function () {
        if (parado) return;
        var db = _chatDb();
        if (!db) return;
        var ref = db.ref('chatInbox/' + eu);
        var h = function (snap) {
          var val = snap.val() || {};
          var lista = Object.keys(val).map(function (uid) {
            var e = val[uid] || {};
            return {
              uid: uid,
              nome: String(e.nome || 'Amigo').slice(0, CLI_NOME_MAX),
              foto: _amigosFotoValida(e.foto),
              ultima: String(e.ultima || '').slice(0, CHAT_PREVIA),
              de: String(e.de || ''),
              em: Number(e.em) || 0,
              naoLidas: Math.max(0, Math.floor(Number(e.naoLidas) || 0))
            };
          });
          lista.sort(function (a, b) { return b.em - a.em; });
          try { cb(lista); } catch (e) {}
        };
        ref.on('value', h, function () { try { cb([]); } catch (e) {} });
        off = function () { try { ref.off('value', h); } catch (e) {} };
      }).catch(function () {});
      return function () { parado = true; off(); };
    },

    observarConversa: function (uid, cb) {
      var eu = _chatEu();
      if (!eu || !uid || typeof cb !== 'function') return function () {};
      var parado = false, offs = [];
      var msgs = [], lidoDele = 0, erro = false;
      var emitir = function () { try { cb({ msgs: msgs, lidoDele: lidoDele, erro: erro }); } catch (e) {} };
      _carregarFirebaseDb().then(function () {
        if (parado) return;
        var db = _chatDb();
        if (!db) return;
        var base = db.ref('chats/' + _chatId(eu, uid));
        var q = base.child('msgs').limitToLast(CHAT_JANELA);
        var hm = function (snap) {
          var val = snap.val() || {};
          msgs = Object.keys(val).map(function (id) {
            var m = val[id] || {};
            return { id: id, de: String(m.de || ''), txt: String(m.txt || '').slice(0, CHAT_MAX), em: Number(m.em) || 0 };
          }).filter(function (m) { return m.de && m.txt; });
          msgs.sort(function (a, b) { return (a.em - b.em) || (a.id < b.id ? -1 : 1); });
          emitir();
        };
        var lref = base.child('lido/' + uid);
        var hl = function (snap) { lidoDele = Number(snap.val()) || 0; emitir(); };
        q.on('value', hm, function () { erro = true; emitir(); });
        lref.on('value', hl, function () {});
        offs.push(function () { try { q.off('value', hm); } catch (e) {} });
        offs.push(function () { try { lref.off('value', hl); } catch (e) {} });
      }).catch(function () { if (!parado) { erro = true; emitir(); } });
      return function () { parado = true; offs.forEach(function (f) { f(); }); };
    },

    enviar: function (uid, texto) {
      var eu = _chatEu();
      var t = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n').trim().slice(0, CHAT_MAX);
      if (!t) return Promise.resolve(null);
      if (!eu || !uid || uid === eu) return Promise.reject(new Error('Entre na sua conta pra conversar.'));
      return _carregarFirebaseDb().then(function () {
        var db = _chatDb();
        if (!db) throw new Error('Sem conexão com o chat agora.');
        var TS = firebase.database.ServerValue.TIMESTAMP;
        var cid = _chatId(eu, uid);
        var key = db.ref('chats/' + cid + '/msgs').push().key;
        var previa = t.replace(/\s+/g, ' ').slice(0, CHAT_PREVIA);
        var meuNome = String(cliNomeExibicao() || 'Jogador').slice(0, CLI_NOME_MAX);
        var minhaFoto = _amigosMinhaFoto();
        var up = {};
        up['chats/' + cid + '/msgs/' + key] = { de: eu, txt: t, em: TS };
        up['chats/' + cid + '/lido/' + eu] = TS;
        // Enviou = parou de digitar, no mesmo update (o "digitando…" do
        // outro lado some junto com a mensagem chegando).
        up['chats/' + cid + '/typing/' + eu] = null;
        var minha = { ultima: previa, de: eu, em: TS, naoLidas: 0, nome: _chatNomeDe(uid) };
        var fotoDele = _chatFotoDe(uid);
        if (fotoDele) minha.foto = fotoDele;
        up['chatInbox/' + eu + '/' + uid] = minha;
        var dele = 'chatInbox/' + uid + '/' + eu + '/';
        up[dele + 'ultima'] = previa;
        up[dele + 'de'] = eu;
        up[dele + 'em'] = TS;
        up[dele + 'nome'] = meuNome;
        up[dele + 'naoLidas'] = firebase.database.ServerValue.increment(1);
        if (minhaFoto) up[dele + 'foto'] = minhaFoto;
        return db.ref().update(up).then(function () { return key; });
      }).catch(function (err) { throw (err && err.message && !err.code) ? err : _chatErro(err); });
    },

    // Zera o contador da minha entrada e carimba o "visto". Só mexe na
    // caixa se a entrada existe (senão o validate da entrada recusaria
    // o update inteiro por faltar campo).
    marcarLida: function (uid) {
      var eu = _chatEu();
      if (!eu || !uid) return Promise.resolve();
      return _carregarFirebaseDb().then(function () {
        var db = _chatDb();
        if (!db) return;
        var up = {};
        up['chats/' + _chatId(eu, uid) + '/lido/' + eu] = firebase.database.ServerValue.TIMESTAMP;
        if (_chatCaixa[uid] && _chatCaixa[uid].naoLidas > 0) up['chatInbox/' + eu + '/' + uid + '/naoLidas'] = 0;
        return db.ref().update(up);
      }).catch(function () {});
    },

    /* "digitando…" (chat v2). Quem chama controla a frequência (no máx.
       1 gravação a cada CHAT_DIG_INTERVALO_MS enquanto digita — ver
       cliChatDigitou); aqui é só gravar/apagar. O onDisconnect é
       registrado uma vez por conversa: fechou o app no meio da frase,
       o servidor apaga sozinho. */
    digitando: function (uid, ligado) {
      var eu = _chatEu();
      if (!eu || !uid) return;
      var db = _chatDb();
      if (!db) return;
      var cid = _chatId(eu, uid);
      var ref = db.ref('chats/' + cid + '/typing/' + eu);
      try {
        if (ligado) {
          if (!_chatDigOnDisc[cid]) { _chatDigOnDisc[cid] = true; ref.onDisconnect().remove(); }
          ref.set(firebase.database.ServerValue.TIMESTAMP).catch(function () {});
        } else {
          ref.remove().catch(function () {});
        }
      } catch (e) {}
    },
    // cb(true) quando o outro grava (cada gravação renova), cb(false) quando
    // apaga — ou sozinho, CHAT_DIG_EXPIRA_MS depois da última renovação
    // (rede caiu do lado de lá sem o remove chegar). Sem comparar relógio.
    observarDigitando: function (uid, cb) {
      var eu = _chatEu();
      if (!eu || !uid || typeof cb !== 'function') return function () {};
      var parado = false, off = function () {}, timer = null;
      var avisar = function (v) { try { cb(v); } catch (e) {} };
      _carregarFirebaseDb().then(function () {
        if (parado) return;
        var db = _chatDb();
        if (!db) return;
        var ref = db.ref('chats/' + _chatId(eu, uid) + '/typing/' + uid);
        var h = function (snap) {
          clearTimeout(timer);
          if (snap.val()) {
            avisar(true);
            timer = setTimeout(function () { avisar(false); }, CHAT_DIG_EXPIRA_MS);
          } else avisar(false);
        };
        ref.on('value', h, function () {});
        off = function () { clearTimeout(timer); try { ref.off('value', h); } catch (e) {} };
      }).catch(function () {});
      return function () { parado = true; off(); };
    },

    naoLidasTotal: function () {
      var n = 0;
      Object.keys(_chatCaixa).forEach(function (u) { n += _chatCaixa[u].naoLidas || 0; });
      return n;
    }
  };

  /* ── Escuta global da caixa (login → logout) ──────────────────── */
  function _chatObservarCaixa() {
    var eu = _chatEu();
    if (!eu || _chatCaixaUid === eu) return;
    _chatPararCaixa();
    _chatCaixaUid = eu;
    _chatCaixaUnsub = window.AngatubaChat.observarCaixa(function (lista) {
      var novo = {};
      lista.forEach(function (e) { novo[e.uid] = e; if (e.nome) _chatLembrarPessoa(e.uid, e.nome, e.foto); });
      _chatCaixa = novo;
      var primeira = _chatCaixaPrimeira;
      _chatCaixaPrimeira = false;
      // Aviso do topo pra mensagem NOVA de alguém (não no 1º snapshot:
      // entrar no app com mensagens paradas mostra só os contadores).
      var vivas = {};
      lista.forEach(function (e) {
        if (e.naoLidas > 0 && e.de !== eu) vivas['chat:' + e.uid] = true;
        var visto = _chatVistoEm[e.uid] || 0;
        _chatVistoEm[e.uid] = Math.max(visto, e.em);
        if (primeira || e.de === eu || !(e.naoLidas > 0) || e.em <= visto) return;
        if (_chatCom === e.uid && _chatAberto()) { window.AngatubaChat.marcarLida(e.uid); return; }
        _chatAvisar(e);
      });
      if (typeof _avisoSincronizar === 'function') _avisoSincronizar('chat:', vivas);
      _chatPintarBadges();
      if (_chatAberto() && !_chatCom) _chatRenderLista();
    });
  }
  function _chatPararCaixa() {
    if (_chatCaixaUnsub) { try { _chatCaixaUnsub(); } catch (e) {} _chatCaixaUnsub = null; }
    _chatCaixaUid = null;
    _chatCaixa = {};
    _chatVistoEm = {};
    _chatCaixaPrimeira = true;
    if (typeof _avisoSincronizar === 'function') _avisoSincronizar('chat:', {});
    _chatPintarBadges();
  }

  function _chatAvisar(e) {
    if (typeof _avisoMostrar !== 'function') return;
    _uiSom('mensagem');
    _avisoMostrar({
      chave: 'chat:' + e.uid,
      tipo: 'chat',
      nome: e.nome,
      foto: e.foto,
      owl: '/webp/owl-phone.webp',
      texto: escHTML(e.ultima),
      acoes: [{ rotulo: 'Responder', classe: 'ok', fn: function () { cliAbrirChat(e.uid); } }]
    });
  }

  // Contadores: avatar do header, botão "Conversas" e o balão de cada amigo.
  function _chatBadgeHtml(n) { return n > 0 ? String(n > 99 ? '99+' : n) : ''; }
  function _chatPintarBadges() {
    var total = window.AngatubaChat ? window.AngatubaChat.naoLidasTotal() : 0;
    // O balão mora no #cli-account-slot (irmão do botão): o botão do
    // avatar tem overflow:hidden por causa da foto redonda e cortaria.
    var slot = document.getElementById('cli-account-slot');
    var av = document.getElementById('cli-avatar-btn');
    if (slot && av) {
      var b = slot.querySelector('.cli-avatar-badge');
      if (total > 0) {
        if (!b) { b = document.createElement('span'); b.className = 'cli-avatar-badge'; b.setAttribute('aria-hidden', 'true'); slot.appendChild(b); }
        b.textContent = _chatBadgeHtml(total);
        av.setAttribute('aria-label', 'Minha conta — ' + total + (total === 1 ? ' mensagem nova' : ' mensagens novas'));
      } else {
        if (b) b.parentNode.removeChild(b);
        av.setAttribute('aria-label', 'Minha conta');
      }
    }
    var conv = document.getElementById('cli-chat-abrir-n');
    if (conv) { conv.textContent = _chatBadgeHtml(total); conv.style.display = total > 0 ? '' : 'none'; }
    document.querySelectorAll('.cli-amigo-btn.chat[data-chat]').forEach(function (btn) {
      var e = _chatCaixa[btn.getAttribute('data-chat')];
      var n = (e && e.naoLidas) || 0;
      var s = btn.querySelector('.cli-amigo-chat-n');
      if (s) { s.textContent = _chatBadgeHtml(n); s.style.display = n > 0 ? '' : 'none'; }
      btn.classList.toggle('on', n > 0);
    });
  }

  /* ── Tela (#modal-chat) ────────────────────────────────────────
     Duas vistas na mesma casca: a lista de conversas (_chatCom null)
     e uma conversa (_chatCom = uid). Abre POR CIMA do painel de conta
     ou do perfil do amigo; o popstate testa o chat antes de tudo que
     pode estar por baixo. Histórico: 'chat' ao abrir o overlay e
     'chat-conversa' quando a conversa foi aberta a partir da lista —
     aí o "voltar" desce pra lista em vez de fechar tudo. */
  var _chatCom = null;           // uid da conversa aberta (null = lista)
  var _chatVeioDaLista = false;
  var _chatConvUnsub = null;
  var _chatConvDados = { msgs: [], lidoDele: 0 };
  var _chatRascunhos = {};       // uid -> texto digitado e não enviado
  var _chatEnviando = false;

  function _chatEl() { return document.getElementById('modal-chat'); }
  function _chatAberto() { var o = _chatEl(); return !!(o && o.classList.contains('open')); }

  // Chat v2 — cabeçalho vivo (presença + "digitando…") e o meu digitando.
  var _chatPresUnsub = null;     // escuta da presença do amigo da conversa
  var _chatPres = null;          // último nó de presença dele
  var _chatDigOutroUnsub = null; // escuta do "digitando" dele
  var _chatDigOutro = false;
  var _chatDigCom = null;        // conversa onde EU marquei "digitando"
  var _chatDigUltima = 0;        // quando gravei pela última vez
  var _chatDigTimer = null;      // "parou de digitar"

  function _chatPararDigitando() {
    clearTimeout(_chatDigTimer); _chatDigTimer = null;
    if (_chatDigCom) { window.AngatubaChat.digitando(_chatDigCom, false); _chatDigCom = null; }
    _chatDigUltima = 0;
  }

  // oninput do campo: liga/desliga o botão de enviar e cuida do
  // "digitando…" com freio — grava no máx. 1x a cada 2s enquanto a
  // pessoa digita e apaga 2,5s depois da última tecla (ou ao enviar).
  function cliChatDigitou() {
    _chatAtualizarBotao();
    var inp = document.getElementById('dm-input');
    if (!inp || !_chatCom) return;
    if (!inp.value.trim()) { _chatPararDigitando(); return; }
    var agora = Date.now();
    if (_chatDigCom !== _chatCom || agora - _chatDigUltima >= CHAT_DIG_INTERVALO_MS) {
      if (_chatDigCom && _chatDigCom !== _chatCom) _chatPararDigitando();
      _chatDigCom = _chatCom;
      _chatDigUltima = agora;
      window.AngatubaChat.digitando(_chatCom, true);
    }
    clearTimeout(_chatDigTimer);
    _chatDigTimer = setTimeout(_chatPararDigitando, CHAT_DIG_PARADO_MS);
  }

  function _chatAtualizarBotao() {
    var inp = document.getElementById('dm-input');
    var btn = document.getElementById('dm-enviar');
    if (btn) btn.disabled = !(inp && inp.value.trim());
  }

  // "hoje às 14:32" / "ontem às 09:10" / "07/10 às 22:05"
  function _chatVistoPorUltimo(em) {
    if (!em) return '';
    var dia = _chatDia(em);
    var d = dia === 'Hoje' ? 'hoje' : (dia === 'Ontem' ? 'ontem' : dia);
    return 'Visto por último ' + d + ' às ' + _chatHora(em);
  }

  // Linha de baixo do cabeçalho: digitando > presença (mesmo rótulo da
  // lista de amigos, ver AngatubaPresenca.rotulo) > visto por último.
  function _chatPintarStatus() {
    var subEl = document.getElementById('dm-topo-sub');
    if (!subEl || !_chatCom) return;
    var txt = '', cls = '';
    if (_chatDigOutro) { txt = 'digitando…'; cls = 'digitando'; }
    else if (_chatPres && window.AngatubaPresenca && typeof window.AngatubaPresenca.rotulo === 'function') {
      var r = window.AngatubaPresenca.rotulo(_chatPres);
      if (r.estado === 'offline') txt = _chatVistoPorUltimo(_chatPres.atualizadoEm) || 'Offline';
      else { txt = r.texto; cls = r.estado; }
    }
    subEl.textContent = txt;
    subEl.className = 'dm-topo-sub' + (cls ? ' ' + cls : '');
  }

  function _chatLigarCabecalho(uid) {
    _chatSoltarCabecalho();
    if (window.AngatubaPresenca && typeof window.AngatubaPresenca.observar === 'function') {
      _chatPresUnsub = window.AngatubaPresenca.observar(uid, function (p) {
        if (_chatCom !== uid) return;
        _chatPres = p || null;
        // Nome vivo (renomeou depois de virar amigo) — igual à lista de amigos.
        if (p && p.nome) {
          _chatLembrarPessoa(uid, p.nome);
          var nomeEl = document.getElementById('dm-topo-nome');
          if (nomeEl) nomeEl.textContent = _chatNomeDe(uid);
        }
        _chatPintarStatus();
      });
    }
    _chatDigOutroUnsub = window.AngatubaChat.observarDigitando(uid, function (sim) {
      if (_chatCom !== uid) return;
      _chatDigOutro = !!sim;
      _chatPintarStatus();
    });
  }
  function _chatSoltarCabecalho() {
    if (_chatPresUnsub) { try { _chatPresUnsub(); } catch (e) {} _chatPresUnsub = null; }
    if (_chatDigOutroUnsub) { try { _chatDigOutroUnsub(); } catch (e) {} _chatDigOutroUnsub = null; }
    _chatPres = null;
    _chatDigOutro = false;
  }

  function _chatSoltarConversa() {
    if (_chatConvUnsub) { try { _chatConvUnsub(); } catch (e) {} _chatConvUnsub = null; }
    _chatConvDados = { msgs: [], lidoDele: 0 };
    _chatSoltarCabecalho();
    _chatPararDigitando();
  }

  function _chatHora(em) {
    var d = new Date(em);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function _chatDia(em) {
    var d = new Date(em), h = new Date();
    var ini = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var dif = Math.round((ini(h) - ini(d)) / 86400000);
    if (dif === 0) return 'Hoje';
    if (dif === 1) return 'Ontem';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + (d.getFullYear() !== h.getFullYear() ? '/' + d.getFullYear() : '');
  }
  // Hora na lista: hoje = HH:MM; antes = Ontem / dd/mm.
  function _chatQuando(em) {
    if (!em) return '';
    var dia = _chatDia(em);
    return dia === 'Hoje' ? _chatHora(em) : dia;
  }

  function _chatAvatarHtml(uid, nome, foto) {
    var ini = escHTML((String(nome).trim()[0] || '?').toUpperCase());
    var f = _amigosFotoValida(foto);
    return '<span class="cli-amigo-av dm-av">' +
      (f
        ? '<img src="' + escHTML(f) + '" alt="" class="cli-amigo-av-img" ' +
          'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
          '<span class="cli-amigo-av-ini" style="display:none">' + ini + '</span>'
        : ini) + '</span>';
  }

  function _chatPintarTopo() {
    var nomeEl = document.getElementById('dm-topo-nome');
    var subEl = document.getElementById('dm-topo-sub');
    var voltar = document.getElementById('dm-voltar');
    var barra = document.getElementById('dm-barra');
    var av = document.getElementById('dm-topo-av');
    var topo = document.getElementById('dm-topo');
    // Lista: o botão de voltar some (e não ocupa espaço). Conversa aberta
    // direto (amigo/perfil/aviso): ele também some, o X fecha.
    if (voltar) voltar.hidden = !(_chatCom && _chatVeioDaLista);
    if (barra) barra.hidden = !_chatCom;
    if (topo) topo.classList.toggle('conversa', !!_chatCom);
    // O fundo escolhido (tema/foto) vale só atrás das mensagens.
    var corpoEl = document.getElementById('dm-corpo');
    if (corpoEl) corpoEl.classList.toggle('conversa', !!_chatCom);
    if (!_chatCom) {
      if (av) { av.hidden = true; av.innerHTML = ''; }
      if (nomeEl) nomeEl.textContent = 'Conversas';
      if (subEl) { subEl.textContent = 'Só entre amigos'; subEl.className = 'dm-topo-sub'; }
      return;
    }
    if (av) { av.innerHTML = _chatAvatarHtml(_chatCom, _chatNomeDe(_chatCom), _chatFotoDe(_chatCom)); av.hidden = false; }
    if (nomeEl) nomeEl.textContent = _chatNomeDe(_chatCom);
    _chatPintarStatus();
  }

  function _chatRenderLista() {
    var corpo = document.getElementById('dm-corpo');
    if (!corpo || _chatCom) return;
    var eu = _chatEu();
    var lista = Object.keys(_chatCaixa).map(function (u) { return _chatCaixa[u]; })
      .sort(function (a, b) { return b.em - a.em; });
    if (!lista.length) {
      corpo.innerHTML =
        '<div class="dm-vazio">' +
          '<img src="/webp/owl-phone.webp" alt="" class="dm-vazio-owl" onerror="this.style.display=\'none\'" />' +
          '<p>Nenhuma conversa ainda.</p>' +
          '<p class="dm-vazio-sub">Abra "Meus amigos" e toque no balão ao lado de um amigo pra mandar a primeira mensagem.</p>' +
        '</div>';
      return;
    }
    corpo.innerHTML = '<div class="dm-lista">' + lista.map(function (e) {
      var nome = _chatNomeDe(e.uid);
      var prefixo = (e.de === eu) ? 'Você: ' : '';
      return '<button type="button" class="dm-conv' + (e.naoLidas > 0 ? ' nova' : '') + '" ' +
          'onclick="cliChatAbrirConversa(\'' + escHTML(e.uid) + '\', true)">' +
          _chatAvatarHtml(e.uid, nome, e.foto || _chatFotoDe(e.uid)) +
          '<span class="dm-conv-txt">' +
            '<span class="dm-conv-linha"><span class="dm-conv-nome">' + escHTML(nome) + '</span>' +
              '<span class="dm-conv-em">' + escHTML(_chatQuando(e.em)) + '</span></span>' +
            '<span class="dm-conv-linha"><span class="dm-conv-ultima">' + escHTML(prefixo + e.ultima) + '</span>' +
              (e.naoLidas > 0 ? '<span class="dm-conv-n">' + _chatBadgeHtml(e.naoLidas) + '</span>' : '') + '</span>' +
          '</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  function _chatRenderConversa() {
    var corpo = document.getElementById('dm-corpo');
    if (!corpo || !_chatCom) return;
    var eu = _chatEu();
    var msgs = _chatConvDados.msgs || [];
    var box = document.getElementById('dm-msgs');
    if (!box) {
      corpo.innerHTML = '<div class="dm-msgs" id="dm-msgs" aria-live="polite"></div>';
      box = document.getElementById('dm-msgs');
    }
    var pertoDoFim = (box.scrollHeight - box.scrollTop - box.clientHeight) < 80;
    if (!msgs.length) {
      box.innerHTML = _chatConvDados.erro
        ? '<p class="dm-msgs-vazio">Não deu pra carregar a conversa.<br>Confira a conexão e tente de novo.</p>'
        : '<p class="dm-msgs-vazio">Diga oi pra ' + escHTML(_chatNomeDe(_chatCom)) + '! 👋</p>';
      return;
    }
    // Chat v2: tique em TODA mensagem minha, estilo WhatsApp — um tique
    // cinza = enviada; dois azuis = ele já viu (lido dele >= em dela).
    var lidoDele = _chatConvDados.lidoDele || 0;
    var html = '', diaAnterior = '', anterior = null;
    msgs.forEach(function (m) {
      var dia = m.em ? _chatDia(m.em) : '';
      var virouDia = !!(dia && dia !== diaAnterior);
      if (virouDia) { html += '<div class="dm-dia">' + escHTML(dia) + '</div>'; diaAnterior = dia; }
      var minha = m.de === eu;
      // Visual v3 (estilo WhatsApp): mensagens seguidas da mesma pessoa,
      // com menos de 5 min entre elas, formam um GRUPO — colam umas nas
      // outras e só a primeira ganha o "bico" da bolha.
      var continua = !!(anterior && !virouDia && anterior.de === m.de && m.em - anterior.em < 300000);
      anterior = m;
      // A hora (e os tiques) ficam no canto de baixo da bolha, por cima
      // de um espaçador invisível no fim do texto — a última linha
      // reserva o lugar dela, como no WhatsApp.
      html += '<div class="dm-msg' + (minha ? ' minha' : '') + (continua ? ' cont' : ' cauda') + '">' +
          '<span class="dm-msg-txt">' + escHTML(m.txt) + '<span class="dm-msg-espaco" aria-hidden="true"></span></span>' +
          '<span class="dm-msg-em">' + (m.em ? _chatHora(m.em) : '') +
            (minha ? _chatTiqueHtml(!!(lidoDele && m.em && lidoDele >= m.em)) : '') + '</span>' +
        '</div>';
    });
    box.innerHTML = html;
    if (pertoDoFim || box.getAttribute('data-primeira') !== '0') {
      box.scrollTop = box.scrollHeight;
      box.setAttribute('data-primeira', '0');
    }
  }

  function _chatTiqueHtml(visto) {
    return visto
      ? '<svg class="dm-tique visto" viewBox="0 0 18 11" width="17" height="11" role="img" aria-label="Visto"><path d="M1 6l3.2 3.2L11 2.2M6.8 8.4l.9.8L14.5 2.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg class="dm-tique" viewBox="0 0 18 11" width="17" height="11" role="img" aria-label="Enviada"><path d="M3.5 6l3.2 3.2L13.5 2.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function _chatLigarConversa(uid) {
    // Solta SÓ a escuta das mensagens. Não chamar _chatSoltarConversa()
    // aqui: desde o chat v2 ela também solta o cabeçalho (presença +
    // "digitando…"), que _chatMostrarConversa acabou de ligar logo antes —
    // era isso que deixava o status e o "digitando…" sempre vazios.
    if (_chatConvUnsub) { try { _chatConvUnsub(); } catch (e) {} _chatConvUnsub = null; }
    _chatConvDados = { msgs: [], lidoDele: 0 };
    _chatConvUnsub = window.AngatubaChat.observarConversa(uid, function (dados) {
      if (_chatCom !== uid) return;
      _chatConvDados = dados || { msgs: [], lidoDele: 0 };
      _chatRenderConversa();
      // Chegou mensagem com a conversa aberta e o app visível: já leu.
      var ult = _chatConvDados.msgs[_chatConvDados.msgs.length - 1];
      if (ult && ult.de !== _chatEu() && !document.hidden) window.AngatubaChat.marcarLida(uid);
    });
  }

  function _chatMostrarConversa(uid) {
    if (_chatCom && _chatCom !== uid) _chatPararDigitando();
    _chatCom = uid;
    _chatPintarTopo();
    var corpo = document.getElementById('dm-corpo');
    if (corpo) corpo.innerHTML = '<div class="dm-msgs" id="dm-msgs" aria-live="polite"><p class="dm-msgs-vazio">Carregando…</p></div>';
    var inp = document.getElementById('dm-input');
    if (inp) { inp.value = _chatRascunhos[uid] || ''; inp.style.height = ''; }
    _chatAtualizarBotao();
    _chatLigarCabecalho(uid);
    _chatPintarStatus();
    _chatLigarConversa(uid);
    window.AngatubaChat.marcarLida(uid);
    if (typeof _avisoFecharChave === 'function') _avisoFecharChave('chat:' + uid);
  }

  function _chatMostrarLista() {
    _chatGuardarRascunho();
    _chatSoltarConversa();
    _chatCom = null;
    _chatPintarTopo();
    _chatRenderLista();
  }

  function _chatGuardarRascunho() {
    var inp = document.getElementById('dm-input');
    if (inp && _chatCom) _chatRascunhos[_chatCom] = inp.value;
  }

  // Abre o overlay. uid = conversa direta (painel de amigos, perfil,
  // aviso do topo); sem uid = lista de conversas.
  function cliAbrirChat(uid, nome, foto) {
    if (!_cliContaReal(_cliUser)) {
      if (typeof cliAbrirLogin === 'function') cliAbrirLogin('Entre na sua conta pra conversar com seus amigos.');
      return;
    }
    var overlay = _chatEl();
    if (!overlay) return;
    if (uid && nome) _chatLembrarPessoa(uid, nome, foto);
    // O chat é overlay do documento: com o hub em tela cheia nativa ele
    // ficaria por trás (mesmo cuidado do _perfilPedirLogin).
    if (typeof _sairTelaCheia === 'function') { try { _sairTelaCheia(); } catch (e) {} }
    _chatObservarCaixa();
    var jaAberto = _chatAberto();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (!jaAberto) {
      if (!history.state || history.state.modal !== 'chat') history.pushState({ modal: 'chat' }, '');
      _chatHist = 1;
      // Fundo (tema/foto) da conta + teclado do celular (ver CHAT v3).
      _chatFundoAplicar();
      _chatFundoSincronizar();
      _chatViewportLigar(true);
    }
    _chatVeioDaLista = false;
    if (uid) _chatMostrarConversa(uid);
    else _chatMostrarLista();
  }

  // Da lista pra uma conversa: empilha 'chat-conversa' pro "voltar"
  // descer pra lista.
  function cliChatAbrirConversa(uid, daLista) {
    if (!uid) return;
    _chatVeioDaLista = !!daLista;
    if (daLista) { history.pushState({ modal: 'chat-conversa' }, ''); _chatHist++; }
    _chatMostrarConversa(uid);
    _chatPintarTopo();
  }

  function cliChatVoltar(viaPopstate) {
    // Folha "Fundo das conversas" aberta: o voltar fecha só ela.
    if (_chatFundoAberta()) { cliChatFundoFechar(viaPopstate); return; }
    if (_chatCom && _chatVeioDaLista) {
      _chatVeioDaLista = false;
      _chatMostrarLista();
      _chatHist = Math.max(1, _chatHist - 1);
      if (!viaPopstate && history.state && history.state.modal === 'chat-conversa') { _popstateNosso = true; history.back(); }
      return;
    }
    cliFecharChat(viaPopstate);
  }

  function cliFecharChat(viaPopstate) {
    var overlay = _chatEl();
    if (overlay) overlay.classList.remove('open');
    _chatFundoFolha(false);
    _chatViewportLigar(false);
    _chatGuardarRascunho();
    _chatSoltarConversa();
    _chatCom = null;
    _chatVeioDaLista = false;
    // Painel de conta (ou lobby) por baixo mantém o scroll travado.
    var conta = document.getElementById('modal-cli-conta');
    document.body.style.overflow = (conta && conta.classList.contains('open')) ? 'hidden' : '';
    // Desfaz TODAS as entradas que o chat empilhou ('chat', 'chat-conversa',
    // 'chat-fundo') de uma vez — _chatHist conta quantas são.
    if (!viaPopstate && _chatHist > 0 && history.state && /^chat/.test(history.state.modal || '')) {
      _popstateNosso = true; history.go(-_chatHist);
    }
    _chatHist = 0;
  }

  // Enviar: limpa o campo na hora e devolve o texto se o banco recusar
  // (mesmo cuidado do chat do lobby — ninguém perde a frase).
  function cliChatEnviar() {
    var inp = document.getElementById('dm-input');
    if (!inp || !_chatCom || _chatEnviando) return;
    var txt = inp.value;
    if (!String(txt || '').trim()) return;
    var uid = _chatCom;
    inp.value = '';
    inp.style.height = '';
    _chatRascunhos[uid] = '';
    // O update do envio já apaga o meu "digitando" no banco; aqui só
    // desarma os timers locais (sem gravar de novo).
    clearTimeout(_chatDigTimer); _chatDigTimer = null; _chatDigCom = null; _chatDigUltima = 0;
    _chatAtualizarBotao();
    _chatEnviando = true;
    window.AngatubaChat.enviar(uid, txt).then(function () {
      _chatEnviando = false;
      _uiSom('enviar');
    }).catch(function (err) {
      _chatEnviando = false;
      if (_chatCom === uid) {
        var el = document.getElementById('dm-input');
        if (el && !el.value) el.value = txt;
        _chatAtualizarBotao();
      } else { _chatRascunhos[uid] = txt; }
      if (typeof showToastSimples === 'function') showToastSimples((err && err.message) || 'Não deu pra enviar agora.', '/webp/owl-sign.webp');
    });
    try { inp.focus(); } catch (e) {}
  }
  // Enter envia; Shift+Enter quebra a linha.
  function cliChatTecla(ev) {
    if (ev && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); cliChatEnviar(); }
  }

  // Voltou pro app com uma conversa aberta: marca como lida o que chegou.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { _chatPararDigitando(); return; }   // saiu do app = parou de digitar
    if (_chatCom && _chatAberto()) window.AngatubaChat.marcarLida(_chatCom);
  });


  /* ══════════════════════════════════════════════════════════════
     CHAT v3 — FUNDO DAS CONVERSAS (temas + foto) e teclado no celular
     ------------------------------------------------------------
     Preferência GLOBAL da pessoa (vale pra todas as conversas):
       { tema: 'padrao'|'escuro'|'claro'|'pontos'|'linhas'|'noite',
         foto: '' | URL do Cloudinary, t: ms da última mudança }
       · local:  angatuba_chat_fundo_u_<uid>   (o chat só existe logado)
       · nuvem:  Firestore preferencias/{uid} = { chatTema, chatFoto, t,
                 atualizadoEm } — mesmo padrão dos docs privados
                 (lang_progress, biblioteca, favoritos). Vence o `t` mais
                 novo; lida 1x por sessão ao abrir o chat.
     A foto, quando existe, ganha do tema (e "Remover foto" volta pro
     tema). Sobe pelo MESMO fluxo da foto de perfil: comprime no
     aparelho (_mlRedimensionarImagem, 1280px) e manda pro Cloudinary com
     o preset unsigned do cliente; a URL guardada já pede a versão
     otimizada (c_limit,w_1280,q_auto,f_auto).
     Visual: o tema mexe só em variáveis CSS (--dm-*) do #modal-chat;
     com foto, as bolhas passam pra paleta escura semitransparente e a
     foto ganha um véu escuro — o texto fica legível em foto clara ou
     escura.
  ══════════════════════════════════════════════════════════════ */
  var CHAT_TEMAS = [
    { id: 'padrao', nome: 'Padrão' },
    { id: 'escuro', nome: 'Escuro' },
    { id: 'claro',  nome: 'Claro' },
    { id: 'pontos', nome: 'Pontilhado' },
    { id: 'linhas', nome: 'Listras' },
    { id: 'noite',  nome: 'Noite' }
  ];
  var CHAT_FUNDO_KEY = 'angatuba_chat_fundo_u_';
  var CHAT_FOTO_RE = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_\-\/.,:]+$/;
  var _chatHist = 0;             // entradas de histórico empilhadas pelo chat
  var _chatFundoSincUid = null;  // uid já conferido com o Firestore nesta sessão

  function _chatFundoValido(o) {
    o = (o && typeof o === 'object') ? o : {};
    var tema = String(o.tema || '');
    var foto = String(o.foto || '');
    return {
      tema: CHAT_TEMAS.some(function (t) { return t.id === tema; }) ? tema : 'padrao',
      foto: (foto.length < 300 && CHAT_FOTO_RE.test(foto)) ? foto : '',
      t: Math.max(0, Math.floor(Number(o.t) || 0))
    };
  }
  function _chatFundoLer() {
    var eu = _chatEu();
    if (!eu) return _chatFundoValido(null);
    try { return _chatFundoValido(JSON.parse(localStorage.getItem(CHAT_FUNDO_KEY + eu) || 'null')); }
    catch (e) { return _chatFundoValido(null); }
  }
  function _chatFundoGravarLocal(f) {
    var eu = _chatEu();
    if (!eu) return;
    try { localStorage.setItem(CHAT_FUNDO_KEY + eu, JSON.stringify(f)); } catch (e) {}
  }

  // Pinta o fundo atual no #modal-chat (atributo do tema + foto).
  function _chatFundoAplicar() {
    var o = _chatEl();
    if (!o) return;
    var f = _chatFundoLer();
    o.setAttribute('data-dm-tema', f.tema);
    if (f.foto) {
      o.style.setProperty('--dm-foto', 'url("' + f.foto + '")');
      o.classList.add('dm-com-foto');
    } else {
      o.style.removeProperty('--dm-foto');
      o.classList.remove('dm-com-foto');
    }
    _chatFundoPintarFolha();
  }

  // Muda e salva (local na hora + nuvem em segundo plano).
  function _chatFundoMudar(parcial) {
    var f = _chatFundoLer();
    if (parcial && 'tema' in parcial) f.tema = parcial.tema;
    if (parcial && 'foto' in parcial) f.foto = parcial.foto;
    f = _chatFundoValido(f);
    f.t = Date.now();
    _chatFundoGravarLocal(f);
    _chatFundoAplicar();
    _chatFundoGravarNuvem(f);
  }

  function _chatFundoGravarNuvem(f) {
    var eu = _chatEu();
    if (!eu || typeof _favCarregarFirestore !== 'function') return;
    _favCarregarFirestore().then(function (db) {
      return db.collection('preferencias').doc(eu).set({
        chatTema: f.tema, chatFoto: f.foto, t: f.t,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[chat] fundo na nuvem falhou:', err && (err.code || err.message));
    });
  }

  // 1x por sessão (por conta): o lado com `t` mais novo vence.
  function _chatFundoSincronizar() {
    var eu = _chatEu();
    if (!eu || _chatFundoSincUid === eu || typeof _favCarregarFirestore !== 'function') return;
    _chatFundoSincUid = eu;
    _favCarregarFirestore().then(function (db) {
      return db.collection('preferencias').doc(eu).get();
    }).then(function (doc) {
      if (_chatEu() !== eu) return;
      var d = (doc && doc.exists) ? (doc.data() || {}) : null;
      var remoto = d ? _chatFundoValido({ tema: d.chatTema, foto: d.chatFoto, t: d.t }) : null;
      var local = _chatFundoLer();
      if (remoto && remoto.t > local.t) { _chatFundoGravarLocal(remoto); _chatFundoAplicar(); }
      else if (local.t > 0 && (!remoto || local.t > remoto.t)) _chatFundoGravarNuvem(local);
    }).catch(function () { _chatFundoSincUid = null; });
  }

  /* ── Folha "Fundo das conversas" ─────────────────────────────── */
  function _chatFundoAberta() {
    var f = document.getElementById('dm-fundo-folha');
    return !!(f && !f.hidden);
  }
  function _chatFundoFolha(abrir) {
    var f = document.getElementById('dm-fundo-folha');
    if (!f) return;
    f.hidden = !abrir;
    if (abrir) _chatFundoPintarFolha();
  }
  function _chatFundoPintarFolha() {
    var grade = document.getElementById('dm-fundo-grade');
    if (!grade) return;
    var f = _chatFundoLer();
    grade.innerHTML = CHAT_TEMAS.map(function (t) {
      var on = !f.foto && f.tema === t.id;
      return '<button type="button" class="dm-fundo-op' + (on ? ' on' : '') + '" ' +
          'onclick="cliChatFundoTema(\'' + t.id + '\')" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="dm-fundo-amostra" data-dm-tema="' + t.id + '">' +
            '<span class="dm-fundo-b"></span><span class="dm-fundo-b minha"></span>' +
          '</span>' +
          '<span class="dm-fundo-nome">' + escHTML(t.nome) + '</span>' +
        '</button>';
    }).join('') +
      '<button type="button" class="dm-fundo-op dm-fundo-op-foto' + (f.foto ? ' on' : '') + '" onclick="cliChatFundoEscolherFoto()">' +
        '<span class="dm-fundo-amostra dm-fundo-amostra-foto"' + (f.foto ? ' style="background-image:url(&quot;' + escHTML(f.foto) + '&quot;)"' : '') + '>' +
          (f.foto ? '' : '<span class="dm-fundo-mais" aria-hidden="true">+</span>') +
        '</span>' +
        '<span class="dm-fundo-nome">' + (f.foto ? 'Sua foto' : 'Usar foto') + '</span>' +
      '</button>';
    var rem = document.getElementById('dm-fundo-remover');
    if (rem) rem.hidden = !f.foto;
  }
  function _chatFundoStatus(txt, erro) {
    var el = document.getElementById('dm-fundo-status');
    if (!el) return;
    el.textContent = txt || '';
    el.classList.toggle('erro', !!erro);
  }

  function cliChatFundoAbrir() {
    if (_chatFundoAberta()) return;
    _chatFundoStatus('');
    _chatFundoFolha(true);
    history.pushState({ modal: 'chat-fundo' }, '');
    _chatHist++;
  }
  function cliChatFundoFechar(viaPopstate) {
    if (!_chatFundoAberta()) return;
    _chatFundoFolha(false);
    _chatHist = Math.max(1, _chatHist - 1);
    if (!viaPopstate && history.state && history.state.modal === 'chat-fundo') { _popstateNosso = true; history.back(); }
  }
  function cliChatFundoTema(id) {
    // Escolher um tema pronto tira a foto (é o "voltar pros temas").
    _chatFundoMudar({ tema: id, foto: '' });
    _chatFundoStatus('');
  }
  function cliChatFundoRemoverFoto() {
    _chatFundoMudar({ foto: '' });
    _chatFundoStatus('Foto removida. Voltou pro tema ' + ((CHAT_TEMAS.filter(function (t) { return t.id === _chatFundoLer().tema; })[0] || {}).nome || 'Padrão') + '.');
  }
  function cliChatFundoEscolherFoto() {
    var inp = document.getElementById('dm-fundo-input');
    if (!inp) return;
    if (!inp._ligado) {
      inp._ligado = true;
      inp.addEventListener('change', function () {
        var file = inp.files && inp.files[0];
        inp.value = '';
        if (file) _chatFundoEnviarFoto(file);
      });
    }
    inp.click();
  }

  var _chatFundoEnviando = false;
  async function _chatFundoEnviarFoto(file) {
    if (_chatFundoEnviando) return;
    if (!file || !/^image\//.test(file.type)) { _chatFundoStatus('Escolha uma imagem.', true); return; }
    _chatFundoEnviando = true;
    try {
      _chatFundoStatus('Otimizando a foto…');
      // Fundo de tela: 1280px no lado maior dá conta de qualquer celular.
      if (typeof _mlRedimensionarImagem === 'function') file = await _mlRedimensionarImagem(file, 1280, 0.8);
      if (file.size > 5 * 1024 * 1024) { _chatFundoStatus('Imagem muito grande (máx 5MB).', true); return; }
      _chatFundoStatus('Enviando…');
      var fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', CLI_UPLOAD_PRESET);
      fd.append('tags', 'chat_fundo');
      var resp = await fetch('https://api.cloudinary.com/v1_1/' + CLI_CLOUD_NAME + '/image/upload',
        { method: 'POST', body: fd, signal: AbortSignal.timeout(60000) });
      var json = await resp.json();
      if (!json || !json.secure_url) throw new Error((json && json.error && json.error.message) || 'Falha no upload');
      // Entrega otimizada: limita a 1280px e deixa o Cloudinary escolher
      // formato/qualidade pro aparelho (webp/avif onde der).
      var url = String(json.secure_url).replace('/image/upload/', '/image/upload/c_limit,w_1280,q_auto,f_auto/');
      if (!CHAT_FOTO_RE.test(url) || url.length >= 300) throw new Error('Endereço da foto inesperado');
      // Pré-carrega antes de trocar: sem "piscar" fundo vazio.
      await new Promise(function (ok) { var im = new Image(); im.onload = im.onerror = function () { ok(); }; im.src = url; });
      _chatFundoMudar({ foto: url });
      _chatFundoStatus('Pronto! A foto vale pra todas as suas conversas.');
    } catch (err) {
      _chatFundoStatus('Não deu pra enviar: ' + ((err && err.message) || 'tente de novo') + '.', true);
    } finally {
      _chatFundoEnviando = false;
    }
  }

  /* ── Teclado do celular ─────────────────────────────────────────
     Com o teclado aberto, a área VISÍVEL (visualViewport) encolhe mas a
     tela "de layout" não (iOS, e Chrome com resizes-visual). Sem isto a
     barra de digitar ficava escondida atrás do teclado. O chat passa a
     ocupar exatamente a área visível, e a conversa desce pro fim. */
  function _chatViewportAjustar() {
    var o = _chatEl(), vv = window.visualViewport;
    if (!o || !vv || !o.classList.contains('open')) return;
    o.style.setProperty('--dm-altura', vv.height + 'px');
    o.style.setProperty('--dm-topo-vv', vv.offsetTop + 'px');
    var inp = document.getElementById('dm-input');
    var box = document.getElementById('dm-msgs');
    if (box && inp && document.activeElement === inp) box.scrollTop = box.scrollHeight;
  }
  var _chatVvLigado = false;
  function _chatViewportLigar(ligar) {
    var vv = window.visualViewport, o = _chatEl();
    if (!vv) return;
    if (ligar && !_chatVvLigado) {
      vv.addEventListener('resize', _chatViewportAjustar);
      vv.addEventListener('scroll', _chatViewportAjustar);
      _chatVvLigado = true;
      _chatViewportAjustar();
    } else if (!ligar && _chatVvLigado) {
      vv.removeEventListener('resize', _chatViewportAjustar);
      vv.removeEventListener('scroll', _chatViewportAjustar);
      _chatVvLigado = false;
      if (o) { o.style.removeProperty('--dm-altura'); o.style.removeProperty('--dm-topo-vv'); }
    }
  }

  window.cliChatFundoAbrir = cliChatFundoAbrir;
  window.cliChatFundoFechar = cliChatFundoFechar;
  window.cliChatFundoTema = cliChatFundoTema;
  window.cliChatFundoRemoverFoto = cliChatFundoRemoverFoto;
  window.cliChatFundoEscolherFoto = cliChatFundoEscolherFoto;

  window.cliAbrirChat = cliAbrirChat;
  window.cliFecharChat = cliFecharChat;
  window.cliChatVoltar = cliChatVoltar;
  window.cliChatAbrirConversa = cliChatAbrirConversa;
  window.cliChatEnviar = cliChatEnviar;
  window.cliChatTecla = cliChatTecla;
  window.cliChatDigitou = cliChatDigitou;

  /* ══════════════════════════════════════════════════════════════
     AVISOS NO TOPO — polimento social P1
     ------------------------------------------------------------
     O convite pra jogar (4.4) chegava só como toast na BASE da tela,
     sumindo em 2,2s; o pedido de amizade (4.3) não chegava de jeito
     nenhum — só aparecia pra quem abrisse o painel de conta e
     rolasse até "Meus amigos". Os dois viram agora um card no TOPO,
     que fica tempo suficiente pra reagir e já traz as ações.

     NÃO É PUSH — continua valendo só com o app aberto e logado. FCM
     é outra etapa (service worker de push, chave VAPID, nó de tokens
     por usuário).

     SEM MODELO NOVO — a pilha é só apresentação, não existe nó novo
     no banco. O convite vem da escuta de gameInvites que a 4.4 já
     mantinha viva enquanto logado. O pedido de amizade ganhou aqui
     uma escuta GLOBAL de friendRequests, irmã daquela: a do painel
     (cliAmigosRender) continua existindo e continua sendo solta ao
     fechar o painel. Duas escutas no mesmo caminho não custam duas
     conexões — o SDK do RTDB compartilha a subscrição e entrega o
     mesmo snapshot pras duas.

     SINCRONIA COM A LISTA — a cada snapshot a pilha fecha os cards
     cuja chave sumiu do nó. Aceitar/recusar pelo painel, ou em outro
     aparelho, apaga o card do topo sozinho; nunca sobra botão pra
     uma ação que já aconteceu.

     O TOAST DE BAIXO FOI SUBSTITUÍDO, não somado: _convReceber não
     chama mais showToastSimples pro convite que chega. O toast segue
     vivo pras confirmações curtas ("Amizade confirmada!", "Convite
     enviado pro Fulano!"), que são resposta a um toque e não têm
     ação nenhuma pra oferecer.

     API pública (window.AngatubaAvisos):
       mostrar(opts) -> id do card ('' se não deu pra montar)
       fechar(id)
       limpar()      -> logout (cliSair e onAuthStateChanged)
  ══════════════════════════════════════════════════════════════ */

  var AVISO_MAX      = 3;      // teto de cards empilhados
  var AVISO_AUTO_MS  = 45000;  // some sozinho; o item continua no painel
  var AVISO_SAIDA_MS = 220;    // igual à transição do .aon-aviso no CSS

  var _avisoSeq = 0;
  var _avisoCards = {};      // id -> {el, chave, acoes, timer}
  var _avisoPorChave = {};   // chave -> id (um card por convite/pedido)

  function _avisoRaiz() { return document.getElementById('aon-avisos'); }

  function _avisoFechar(id) {
    var c = _avisoCards[id];
    if (!c) return;
    if (c.timer) { clearTimeout(c.timer); c.timer = null; }
    delete _avisoCards[id];
    if (_avisoPorChave[c.chave] === id) delete _avisoPorChave[c.chave];
    var el = c.el;
    if (!el) return;
    // A classe sai primeiro (anima), o nó some depois. Enquanto isso o
    // card conta como "saindo" e não entra mais no teto do AVISO_MAX.
    el.classList.remove('on');
    el.classList.add('saindo');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, AVISO_SAIDA_MS);
  }

  function _avisoFecharChave(chave) {
    if (_avisoPorChave[chave]) _avisoFechar(_avisoPorChave[chave]);
  }

  function _avisoLimpar() {
    Object.keys(_avisoCards).forEach(function (id) { _avisoFechar(id); });
    _avisoCards = {}; _avisoPorChave = {};
    var raiz = _avisoRaiz();
    if (raiz) raiz.innerHTML = '';
  }

  /* Fecha os cards de um prefixo cuja chave não está mais viva no nó.
     É o que mantém a pilha em dia com a lista do painel. */
  function _avisoSincronizar(prefixo, vivas) {
    Object.keys(_avisoPorChave).forEach(function (k) {
      if (k.indexOf(prefixo) === 0 && !vivas[k]) _avisoFechar(_avisoPorChave[k]);
    });
  }

  /* o.texto entra como HTML — quem chama já escapou o que veio do
     banco (escHTML) e pode mandar o emoji do jogo junto. o.nome e a
     inicial são escapados aqui. */
  function _avisoHtml(id, o) {
    var acoes = (o.acoes || []).map(function (a, i) {
      return '<button type="button" class="aon-aviso-btn ' + (a.classe || '') + '" ' +
        'onclick="aonAvisoAcao(\'' + id + '\',' + i + ')">' + escHTML(a.rotulo) + '</button>';
    }).join('');
    var nome = String(o.nome || 'Jogador');
    var ini = escHTML((nome.trim()[0] || '?').toUpperCase());
    // Foto (P3): o pedido de amizade traz a photoURL de quem pediu; o
    // convite pra jogar (4.4) não tem esse campo no nó e fica na
    // inicial, que é o comportamento de sempre.
    // Aviso do próprio app (o.avatar, ex.: pedido de notificação): a coruja
    // ocupa o avatar inteiro, sem a inicial "A" por trás.
    var foto = o.avatar || _amigosFotoValida(o.foto);
    return '<span class="aon-aviso-av' + (o.avatar ? ' aon-aviso-av-app' : '') + '">' +
        (foto
          ? '<img src="' + escHTML(foto) + '" alt="" class="aon-aviso-av-img" ' +
            'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" />' +
            '<span class="aon-aviso-av-ini" style="display:none">' + ini + '</span>'
          : ini) +
        (o.owl ? '<img src="' + o.owl + '" alt="" class="aon-aviso-owl" onerror="this.style.display=\'none\'" />' : '') +
      '</span>' +
      '<span class="aon-aviso-txt">' +
        '<span class="aon-aviso-nome">' + escHTML(nome) + '</span>' +
        '<span class="aon-aviso-sub">' + (o.texto || '') + '</span>' +
      '</span>' +
      '<span class="aon-aviso-acoes">' + acoes + '</span>' +
      '<button type="button" class="aon-aviso-x" onclick="aonAvisoAcao(\'' + id + '\',-1)" ' +
        'aria-label="Dispensar aviso" title="Dispensar">✕</button>';
  }

  // opts: {chave, tipo:'convite'|'pedido', nome, foto, texto, owl, acoes:[{rotulo,classe,fn}]}
  function _avisoMostrar(o) {
    var raiz = _avisoRaiz();
    if (!raiz || !o || !o.chave) return '';
    // Mesmo item chegando de novo (reconvite pro mesmo jogo reusa o
    // inviteId): troca o card em vez de empilhar dois iguais.
    _avisoFecharChave(o.chave);

    var id = 'aon-av-' + (++_avisoSeq);
    var el = document.createElement('div');
    el.id = id;
    el.className = 'aon-aviso' + (o.tipo ? ' ' + o.tipo : '');
    el.setAttribute('role', 'alert');
    el.innerHTML = _avisoHtml(id, o);
    raiz.insertBefore(el, raiz.firstChild);   // mais novo em cima
    _avisoCards[id] = { el: el, chave: o.chave, acoes: (o.acoes || []).slice(), timer: null };
    _avisoPorChave[o.chave] = id;

    // A classe de entrada só no frame seguinte, senão o navegador
    // pinta já no estado final e a transição não roda.
    var ligar = function () { el.classList.add('on'); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(ligar);
    else setTimeout(ligar, 16);

    if (AVISO_AUTO_MS > 0) {
      _avisoCards[id].timer = setTimeout(function () { _avisoFechar(id); }, AVISO_AUTO_MS);
    }

    // Teto da pilha: os mais antigos caem. Conta só os que não estão
    // saindo — os que estão já foram fechados e o nó some sozinho.
    var vivos = raiz.querySelectorAll('.aon-aviso:not(.saindo)');
    for (var i = AVISO_MAX; i < vivos.length; i++) _avisoFechar(vivos[i].id);
    return id;
  }

  /* Handler único dos botões do card. i >= 0 é uma ação do array;
     -1 é o ✕. Fecha sempre antes de agir: a ação pode abrir o hub de
     jogos, e o card não pode ficar pendurado por cima da partida. */
  function aonAvisoAcao(id, i) {
    var c = _avisoCards[id];
    if (!c) return;
    var acao = (i >= 0) ? c.acoes[i] : null;
    _avisoFechar(id);
    if (acao && typeof acao.fn === 'function') { try { acao.fn(); } catch (e) {} }
  }

  window.AngatubaAvisos = {
    mostrar: _avisoMostrar,
    fechar: _avisoFechar,
    limpar: _avisoLimpar
  };
  window.aonAvisoAcao = aonAvisoAcao;

  /* ── Convite pra jogar no topo ─────────────────────────────────
     Entrar/Recusar caem nos MESMOS cliConviteEntrar/cliConviteRecusar
     da lista do painel — inclusive o fechamento do painel com a folga
     de 220ms pro popstate, que é inofensiva com o painel já fechado. */
  function _avisoConvite(c) {
    var j = CONV_JOGOS[c.jogo];
    if (!j) return;
    _avisoMostrar({
      chave: 'conv:' + c.id + '|' + c.codigo,
      tipo: 'convite',
      nome: c.nome,
      owl: '/webp/owl-tada.webp',
      texto: 'te chamou pro ' + j.emoji + ' ' + escHTML(j.nome),
      acoes: [
        { rotulo: 'Entrar',  classe: 'ok', fn: function () { cliConviteEntrar(c.id); } },
        { rotulo: 'Recusar', classe: 'no', fn: function () { cliConviteRecusar(c.id); } }
      ]
    });
  }

  /* ── Pedido de amizade no topo ─────────────────────────────────
     Aceitar/Recusar chamam a MESMA AngatubaAmigos.aceitar/recusar da
     lista. Não dá pra reusar cliAmigosAceitar/cliAmigosRecusar
     direto: elas reportam erro no #cli-amigos-msg, que não existe com
     o painel fechado — justamente o caso do aviso no topo. Mesma
     ação, erro em toast. */
  function _avisoPedidoAceitar(uid) {
    window.AngatubaAmigos.aceitar(uid).then(function () {
      if (typeof showToastSimples === 'function') showToastSimples('Amizade confirmada!', '/webp/owl-thumbsup.webp');
    }).catch(function (err) {
      if (typeof showToastSimples === 'function') {
        showToastSimples((err && err.message) || 'Não deu pra aceitar.', '/webp/owl-sign.webp');
      }
    });
  }

  function _avisoPedidoRecusar(uid) {
    window.AngatubaAmigos.recusar(uid).catch(function (err) {
      if (typeof showToastSimples === 'function') {
        showToastSimples((err && err.message) || 'Não deu pra recusar.', '/webp/owl-sign.webp');
      }
    });
  }

  function _avisoPedido(p) {
    _avisoMostrar({
      chave: 'ped:' + p.uid,
      tipo: 'pedido',
      nome: p.nome,
      foto: p.foto,
      owl: '/webp/owl-wave.webp',
      texto: 'quer ser seu amigo',
      acoes: [
        { rotulo: 'Aceitar', classe: 'ok', fn: function () { _avisoPedidoAceitar(p.uid); } },
        { rotulo: 'Recusar', classe: 'no', fn: function () { _avisoPedidoRecusar(p.uid); } }
      ]
    });
  }

  /* ── Escuta global de pedidos de amizade ───────────────────────
     Irmã de _convObservarCaixa: vive enquanto a conta nomeada estiver
     logada, com painel aberto ou fechado. É ela que faz o pedido de
     amizade aparecer sem a pessoa precisar abrir o painel. */
  var _pedUnsub = null;       // desliga a escuta global
  var _pedUid = null;         // uid que está ouvindo
  var _pedVistos = {};        // uid -> true, pra só avisar de pedido novo
  var _pedPrimeira = true;    // primeiro snapshot = caixa que já estava lá

  function _pedObservarGlobal() {
    if (!_cliContaReal(_cliUser)) return;
    var uid = _cliUser.uid;
    if (_pedUid === uid) return;
    _pedPararGlobal();
    _pedUid = uid;
    _pedUnsub = window.AngatubaAmigos.observarPedidos(function (pedidos) {
      // Some do nó (aceito/recusado aqui, no painel ou em outro
      // aparelho) -> o card do topo sai junto.
      var vivas = {};
      pedidos.forEach(function (p) { vivas['ped:' + p.uid] = true; });
      _avisoSincronizar('ped:', vivas);

      var novos = pedidos.filter(function (p) { return !_pedVistos[p.uid]; });
      _pedVistos = {};
      pedidos.forEach(function (p) { _pedVistos[p.uid] = true; });

      var primeira = _pedPrimeira;
      _pedPrimeira = false;
      if (!novos.length) return;
      // Entrar no app com três pedidos parados não vira parede de
      // cards: no primeiro snapshot mostra só o mais recente.
      // `pedidos` vem do mais novo pro mais velho; o reverse faz o
      // mais novo ser o ÚLTIMO inserido, e portanto o de cima.
      (primeira ? novos.slice(0, 1) : novos.slice(0, AVISO_MAX))
        .reverse().forEach(_avisoPedido);
    });
  }

  function _pedPararGlobal() {
    if (_pedUnsub) { try { _pedUnsub(); } catch (e) {} _pedUnsub = null; }
    _pedUid = null;
    _pedVistos = {};
    _pedPrimeira = true;
  }

  /* ══════════════════════════════════════════════════════════════
     LOBBY SOCIAL (Realtime Database) — Etapa 5.1 (núcleo)
     ------------------------------------------------------------
     O QUE FALTAVA. Até a 4.4 dava pra chamar um amigo pra jogar,
     mas o jogo tinha que ser escolhido ANTES: a pessoa abria a tela
     do Ping Pong, criava a sala e só então o convite saía com o
     código. Não havia lugar pra "reunir a galera" e só depois
     decidir o que jogar — nem pra trocar de jogo mantendo o mesmo
     grupo. O lobby é esse lugar: um cômodo que existe antes de
     qualquer sala de jogo e sobrevive à troca de jogo.

     ESTA SUBTAREFA É SÓ O NÚCLEO: nó no banco, regras e API. A UI
     (painel, lista de gente, botão "vamos de...") é a 5.2, e criar
     a sala do jogo a partir do lobby é a 5.3. Aqui não se desenha
     nada na tela.

     NÃO CONFUNDIR COM O LOBBY DA PARTY. O `salasParty` também tem
     uma antessala, mas ela é de DENTRO de um jogo (a Party é um
     jogo). Este lobby é uma camada acima: existe sem jogo nenhum
     escolhido e vai APONTAR pra sala de um jogo quando a 5.3
     chegar. Os dois convivem, não se substituem.

     Nó no RTDB (ver database.rules.json pro raciocínio das regras):
       socialLobbies/{CODIGO} = {
         anfitriao:      { uid, nome },
         criadoEm:       timestamp do servidor,
         status:         'aberto' | 'em_jogo' | 'fechado',
         jogoSugerido:   null | 'pingpong'|'tanques'|'hoquei'|'party'|'baralho',
         codigoSalaJogo: null | 'ABCD'   <- só a 5.3 preenche
         membros: {
           {uid}: { nome, foto?, entrouEm, pronto }
         }
       }

     A CHAVE É O PRÓPRIO CÓDIGO — não existe `socialLobbyCodes`
     espelhando código -> id. Com o id sendo o código não há dois nós
     pra manter em sincronia nem uma segunda chance de sobrar lixo, e
     "achar pelo código" vira ler a chave direto. O código usa o MESMO
     sorteio do código de amigo (`_amCodigoSortear`, 6 chars num
     alfabeto sem 0/O e 1/I/L) porque o problema é idêntico: alguém
     vai ditar isso no grupo do WhatsApp.

     É um código DIFERENTE do código de amigo, ainda que com a mesma
     cara. O de amigo é permanente e identifica uma pessoa; o do
     lobby é descartável e identifica uma reunião. O `entrar` tolera
     o prefixo AON- colado por engano (o alfabeto não tem 'O', então
     "AON" nunca é começo de código de verdade) e devolve "esse lobby
     não existe" — que é a verdade.

     COLISÃO é resolvida pela REGRA, igual ao código de amigo: só dá
     pra CRIAR socialLobbies/{CODIGO} que ainda não existe. Quem
     sorteou um código já usado leva permission_denied e sorteia
     outro.

     LIMITE DE 6 PESSOAS. Seis e não quatro porque o lobby é o lugar
     de juntar gente ANTES de saber o que vai rolar — obrigar o grupo
     a encolher pra caber no lobby inverteria o propósito. E não oito
     (o teto do Uno) porque a maioria dos jogos com sala para em 2 ou
     4, e um lobby de oito passaria a maior parte do tempo sem caber
     inteiro na partida. QUEM IMPÕE O LIMITE É O CLIENTE: as regras
     do RTDB não sabem contar filhos. Isso é assumido, não esquecido
     — o estrago possível é alguém com o código entrar num lobby
     lotado pelo console, que é o mesmo grupo de pessoas que já tem o
     código. Nada além de um sétimo nome na lista.

     ANFITRIÃO CAIU, LOBBY ACABOU. O onDisconnect do anfitrião apaga
     o nó INTEIRO; o de cada membro apaga só a si mesmo. É a opção
     mais simples e a mais segura das duas: um lobby sem anfitrião
     não consegue sugerir jogo nem (na 5.3) abrir sala, então manter
     o nó vivo só criaria fantasma eterno no banco — e não há Cloud
     Function pra varrer. O preço é real e conhecido: se o celular do
     anfitrião dormir, o grupo perde o lobby e alguém abre outro.
     Quem fica vê o nó sumir pela própria escuta e recebe null.

     O onDisconnect é armado ANTES da escrita e DE NOVO depois dela
     (mesma disciplina da presença 4.2): antes, pra não existir uma
     janela em que o lobby está no banco sem ninguém pra apagá-lo;
     depois, porque o registro anterior pode ter sido recusado
     enquanto o nó ainda não existia. Registrar duas vezes na mesma
     ref só substitui o registro.

     RECONEXÃO. O RTDB descarta os onDisconnect ao cair, então a
     escuta de `.info/connected` rearma tudo a cada volta — e, se a
     queda tiver removido o membro de um lobby que continua de pé,
     reescreve a própria entrada (preservando o `pronto`). Sem isso,
     quem oscila de rede sairia do lobby sozinho e não voltaria.

     API pública (window.AngatubaLobby):
       disponivel()        -> bool (conta nomeada e num lobby)
       limite()            -> 6
       jogos()             -> catálogo de jogos com sala (o da 4.4)
       criar()             -> Promise<{codigo, lobbyId}>
       entrar(codigo)      -> Promise<{codigo, lobbyId}>
       sair()              -> Promise
       meuLobby()          -> estado atual em cache, ou null (sem I/O)
       observar(cb)        -> cb(estado|null) agora e a cada mudança;
                              devolve a função de parar de ouvir
       definirPronto(bool) -> Promise (o membro marca o próprio pronto)
       sugerirJogo(jogo)   -> Promise (só o anfitrião)
       iniciarJogo()       -> Promise<{jogo, automatico, aviso}> (5.3)
       entrarNaPartida()   -> Promise (entrar/voltar na sala apontada)
       encerrarPartida()   -> Promise (só o anfitrião; volta a 'aberto')

     Estado entregue por meuLobby()/observar():
       { codigo, lobbyId, status, jogoSugerido, codigoSalaJogo,
         anfitriao: {uid, nome}, souAnfitriao, criadoEm, cheio,
         membros: [{uid, nome, foto, entrouEm, pronto, anfitriao}] }
  ══════════════════════════════════════════════════════════════ */

  var LOB_RAIZ = 'socialLobbies';
  var LOB_MAX_MEMBROS = 6;     // ver comentário acima; regra não conta filhos
  var LOB_COD_TENT = 6;        // sorteios antes de desistir (colisão)

  /* ── 5.3: quanta gente cabe em cada jogo ──────────────────────
     O lobby vai a 6, mas cada jogo tem o teto DELE. Os números são
     os dos próprios módulos (MAX_JOGADORES da Party = 4; o Uno do
     baralho vai a 8, o Truco a 4 — fica o maior, porque o modo só é
     escolhido lá dentro), repetidos aqui porque party.js/baralho.js
     só carregam quando alguém abre o jogo, e a checagem precisa
     acontecer ANTES disso, no lobby.

     LOB_JOGO_EXATO marca quem NÃO aceita sobra: Ping Pong e Tanques
     são 1x1: o terceiro não fica de fora, ele simplesmente não tem
     onde entrar — então ali a gente barra em vez de avisar. */
  // Derivados do catálogo (CONV_JOGOS.max/.exato) — antes eram duas
  // listas à mão que precisavam ser lembradas a cada jogo novo.
  var LOB_JOGO_MAX   = {};
  var LOB_JOGO_EXATO = {};
  Object.keys(CONV_JOGOS).forEach(function (k) {
    LOB_JOGO_MAX[k] = CONV_JOGOS[k].max || 0;
    if (CONV_JOGOS[k].exato) LOB_JOGO_EXATO[k] = true;
  });
  var LOB_MIN_MEMBROS = 2;                 // sozinho não é partida em grupo
  var LOB_CHAT_MAX    = 160;               // teto do texto de uma mensagem (bate com a regra)
  var LOB_CHAT_JANELA = 40;                // últimas mensagens que a tela carrega
  var LOB_PENDENTE_MS = 5 * 60 * 1000;     // janela pro código da sala aparecer
  var LOB_FECHAR_MS   = 220;               // folga pro popstate do overlay (ver cliConviteEntrar)

  var _lobCodigo = null;       // código do lobby em que estou, ou null
  var _lobUid = null;          // uid que está no lobby (guarda troca de conta)
  var _lobAnfitriao = false;   // sou o anfitrião deste lobby
  var _lobRef = null;          // ref de socialLobbies/{codigo}
  var _lobValCb = null;        // handler do .on('value')
  var _lobConnRef = null;      // ref de .info/connected
  var _lobConnCb = null;       // handler dela (pra .off)
  var _lobEstado = null;       // último estado normalizado, ou null
  var _lobPronto = false;      // meu "pronto", guardado à parte (ver reconexão)
  var _lobSubs = [];           // callbacks de observar()
  var _lobPendente = null;     // 5.3: {jogo, ate} esperando o código da sala
  var _lobSalaVista = null;    // 5.3: codigoSalaJogo que já me levou pra dentro
  /* _lobIndoPraSala: declarada no app.js (bloco SOCIAL SOB DEMANDA) */ // 5.3: uma entrada em voo (guarda de corrida)

  // Mesmo ctx de amigos/convites ({db, uid}), só com a mensagem no
  // vocabulário daqui — quem cai nesse erro está tentando abrir lobby,
  // não lista de amigos.
  function _lobCtx() {
    return _amigosCtx().catch(function (err) {
      var msg = String((err && err.message) || '');
      throw new Error(/lista de amigos/.test(msg) ? 'Entre na sua conta pra usar o lobby.' : msg);
    });
  }

  // Mensagens nossas passam direto; o resto do RTDB vira PT-BR.
  function _lobErro(err) {
    var msg = String((err && err.message) || '');
    return /lobby|Código inválido|Entre na sua conta|Sem conexão|jogo/i.test(msg)
      ? new Error(msg) : new Error(_amigosErroPt(err));
  }

  /* Aceita o código como a pessoa colou: com espaços, com traço, em
     minúscula, e até com o AON- do código de amigo grudado na frente
     (o alfabeto não tem 'O', então "AON" jamais começa um código
     legítimo). Devolve o código limpo ou null. */
  function _lobNormalizarCodigo(codigo) {
    var s = String(codigo || '').trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
    if (s.length > AMIGO_COD_LEN && s.indexOf('AON') === 0) s = s.slice(3);
    return _amCodRe.test(s) ? s : null;
  }

  // O cartão do próprio membro. `pronto` vem por fora pra reescrita de
  // reconexão não desmarcar quem já tinha marcado.
  function _lobMeuValor(pronto) {
    var v = {
      nome: cliNomeExibicao() || 'Jogador',
      entrouEm: firebase.database.ServerValue.TIMESTAMP,
      pronto: pronto === true
    };
    var foto = _amigosMinhaFoto();
    if (foto) v.foto = foto;
    return v;
  }

  /* Snapshot cru -> estado que a 5.2 consegue desenhar sem pensar.
     Devolve null pro nó que não existe mais ou que perdeu o
     anfitrião: pros dois casos a resposta da UI é a mesma. */
  function _lobNormalizar(codigo, val) {
    if (!val || !val.anfitriao || !val.anfitriao.uid) return null;
    var membrosVal = val.membros || {};
    var membros = Object.keys(membrosVal).map(function (uid) {
      var m = membrosVal[uid] || {};
      return {
        uid: uid,
        nome: String(m.nome || 'Jogador').slice(0, CLI_NOME_MAX),
        foto: _amigosFotoValida(m.foto),
        entrouEm: m.entrouEm || 0,
        pronto: m.pronto === true,
        anfitriao: uid === val.anfitriao.uid
      };
    });
    // Mais antigo em cima: o anfitrião encabeça a lista naturalmente.
    membros.sort(function (a, b) { return a.entrouEm - b.entrouEm; });
    var jogo = val.jogoSugerido;
    return {
      codigo: codigo,
      lobbyId: codigo,
      status: String(val.status || 'aberto'),
      jogoSugerido: (jogo && CONV_JOGOS[jogo]) ? jogo : null,
      codigoSalaJogo: val.codigoSalaJogo ? String(val.codigoSalaJogo).toUpperCase() : null,
      anfitriao: {
        uid: val.anfitriao.uid,
        nome: String(val.anfitriao.nome || 'Jogador').slice(0, CLI_NOME_MAX)
      },
      souAnfitriao: !!(_lobUid && val.anfitriao.uid === _lobUid),
      criadoEm: val.criadoEm || 0,
      cheio: membros.length >= LOB_MAX_MEMBROS,
      membros: membros
    };
  }

  // Avisa todo mundo que chamou observar(). Cópia do array porque um
  // callback pode cancelar a própria inscrição aqui dentro.
  function _lobAvisar() {
    _lobSubs.slice().forEach(function (cb) {
      try { cb(_lobEstado); } catch (e) {}
    });
  }

  // Solta as escutas e zera o local. NÃO escreve nada no banco e NÃO
  // mexe em _lobSubs — quem observa continua observando, e recebe o
  // null logo em seguida.
  function _lobDesligar() {
    if (_lobRef && _lobValCb) { try { _lobRef.off('value', _lobValCb); } catch (e) {} }
    if (_lobConnRef && _lobConnCb) { try { _lobConnRef.off('value', _lobConnCb); } catch (e) {} }
    _lobRef = null; _lobValCb = null; _lobConnRef = null; _lobConnCb = null;
    _lobCodigo = null; _lobUid = null; _lobAnfitriao = false; _lobEstado = null;
    _lobPronto = false;
    // 5.3: saí deste lobby — nada do que ele apontava vale mais. Sem
    // isto, entrar em OUTRO lobby herdaria a guarda do anterior e a
    // sala nova poderia passar batida.
    _lobPendente = null; _lobSalaVista = null; _lobIndoPraSala = false;
    _lobSalaFalhou = null;
    _lobPararVigia();
  }

  /* Arma (ou rearma) o onDisconnect desta sessão. O anfitrião derruba
     o lobby inteiro; o membro tira só a si. Chamado no entrar/criar e
     a cada volta de conexão. */
  function _lobArmarQueda() {
    if (!_lobRef) return;
    try {
      if (_lobAnfitriao) _lobRef.onDisconnect().remove().catch(function () {});
      else _lobRef.child('membros/' + _lobUid).onDisconnect().remove().catch(function () {});
    } catch (e) {}
  }

  /* Liga tudo depois de entrar/criar: a escuta do nó (que é o que
     alimenta observar) e a de .info/connected (que rearma o
     onDisconnect e me traz de volta depois de uma queda curta). */
  function _lobLigar(ctx, codigo, souAnfitriao) {
    _lobDesligar();
    _lobCodigo = codigo;
    _lobUid = ctx.uid;
    _lobAnfitriao = !!souAnfitriao;
    _lobRef = ctx.db.ref(LOB_RAIZ + '/' + codigo);

    _lobValCb = function (snap) {
      var est = _lobNormalizar(codigo, snap.val());
      if (!est) { _lobEncerrado(); return; }   // anfitrião caiu/fechou
      // Guarda o meu "pronto" à parte: na queda a minha entrada some do
      // nó, e é justamente daí que a reescrita de reconexão precisa
      // dele. Ler do estado não serve — lá eu já não estou.
      for (var i = 0; i < est.membros.length; i++) {
        if (est.membros[i].uid === _lobUid) { _lobPronto = est.membros[i].pronto; break; }
      }
      _lobEstado = est;
      _lobAvisar();
      // 5.3: o nó passou a apontar pra uma sala de jogo — quem ainda
      // não está lá dentro é levado. Depois do _lobAvisar de
      // propósito: a UI já desenhou o estado novo quando (e se) a
      // tela do jogo subir por cima.
      _lobTalvezEntrarNaSala(est);
    };
    _lobRef.on('value', _lobValCb, function () { _lobEncerrado(); });

    _lobConnRef = ctx.db.ref('.info/connected');
    _lobConnCb = function (snap) {
      if (snap.val() !== true || !_lobRef) return;
      _lobArmarQueda();
      // Caí e voltei: se o lobby seguiu de pé sem mim, volto pra lista.
      if (!_lobAnfitriao && _lobEstado && _lobEstado.status !== 'fechado') {
        try {
          _lobRef.child('membros/' + _lobUid).set(_lobMeuValor(_lobPronto)).catch(function () {});
        } catch (e) {}
      }
    };
    _lobConnRef.on('value', _lobConnCb);
    _lobArmarQueda();
  }

  // O lobby sumiu por fora (anfitrião caiu, anfitrião fechou). Solta
  // tudo e avisa com null — a UI da 5.2 volta pro estado "sem lobby".
  function _lobEncerrado() {
    if (!_lobCodigo) return;
    _lobDesligar();
    _lobAvisar();
  }

  /* Sai de verdade: apaga do banco e solta tudo. Anfitrião apaga o
     lobby inteiro (ver "anfitrião caiu, lobby acabou" no cabeçalho);
     membro apaga só a própria entrada.

     A ordem importa. Solta a escuta ANTES de apagar pra não disparar
     o _lobEncerrado por cima do que já estamos fazendo, e cancela o
     onDisconnect DEPOIS que o remove confirmou — se o remove falhar
     (token vencido, rede caindo), o onDisconnect continua armado e
     limpa sozinho na queda. */
  function _lobSair() {
    if (!_lobCodigo || !_lobRef) { return Promise.resolve(); }
    var ref = _lobRef, uid = _lobUid, anf = _lobAnfitriao;
    _lobDesligar();
    _lobAvisar();
    var meu = ref.child('membros/' + uid);
    return (anf ? ref.remove() : meu.remove()).then(function () {
      try { ref.onDisconnect().cancel(); } catch (e) {}
      try { meu.onDisconnect().cancel(); } catch (e) {}
    }).catch(function () { /* o onDisconnect armado limpa na queda */ });
  }

  /* Sorteia um código livre e grava o lobby. Quem garante que o
     código estava livre são as REGRAS (só criam o que não existe):
     permission_denied aqui quase sempre é "esse código já é de
     alguém", então tenta outro. Mesma mecânica do código de amigo. */
  function _lobCriarTentar(ctx, resta) {
    if (resta <= 0) {
      return Promise.reject(new Error('Não deu pra abrir o lobby agora. Tente de novo em instantes.'));
    }
    var cod = _amCodigoSortear();
    var ref = ctx.db.ref(LOB_RAIZ + '/' + cod);
    var no = {
      anfitriao: { uid: ctx.uid, nome: cliNomeExibicao() || 'Jogador' },
      criadoEm: firebase.database.ServerValue.TIMESTAMP,
      status: 'aberto',
      membros: {}
    };
    no.membros[ctx.uid] = _lobMeuValor(false);
    // Antes do set: fecha a janela em que o lobby existiria sem
    // ninguém pra apagá-lo. Pode ser recusado (o nó ainda não é meu),
    // por isso o segundo registro depois do set é o que vale.
    try { ref.onDisconnect().remove().catch(function () {}); } catch (e) {}
    return ref.set(no).then(function () {
      return cod;
    }, function (err) {
      try { ref.onDisconnect().cancel(); } catch (e) {}
      if (/permission_denied/i.test(String((err && (err.message || err.code)) || ''))) {
        return _lobCriarTentar(ctx, resta - 1);
      }
      throw err;
    });
  }

  function _lobCriar() {
    return _lobCtx().then(function (ctx) {
      return _lobSair().then(function () {     // um lobby por vez
        return _lobCriarTentar(ctx, LOB_COD_TENT).then(function (cod) {
          _lobLigar(ctx, cod, true);
          return { codigo: cod, lobbyId: cod };
        });
      });
    }).catch(function (err) { throw _lobErro(err); });
  }

  function _lobEntrar(codigo) {
    var cod = _lobNormalizarCodigo(codigo);
    if (!cod) {
      return Promise.reject(new Error('Código inválido. São 6 letras e números — confira e tente de novo.'));
    }
    return _lobCtx().then(function (ctx) {
      // Já estou NESTE lobby: não saio pra entrar de novo (a UI
      // piscaria e os outros me veriam sumir). Só reescrevo a minha
      // entrada — que é o que resolve o caso de ter sido removido por
      // uma queda que o .info/connected não pegou.
      var jaAqui = (_lobCodigo === cod && _lobUid === ctx.uid);
      return (jaAqui ? Promise.resolve() : _lobSair()).then(function () {
        var ref = ctx.db.ref(LOB_RAIZ + '/' + cod);
        // Uma leitura só pra decidir se dá pra entrar. As regras
        // repetem status e existência; o que elas NÃO conseguem
        // conferir é a lotação (não dá pra contar filhos).
        return ref.get().then(function (snap) { return snap.val(); },
                             function () { return null; })
          .then(function (val) {
            if (!val || !val.anfitriao || !val.anfitriao.uid) {
              throw new Error('Esse lobby não existe mais. Confira o código com quem te chamou.');
            }
            if (String(val.status || 'aberto') !== 'aberto') {
              throw new Error('Esse lobby já está em partida.');
            }
            var membros = val.membros || {};
            if (!membros[ctx.uid] && Object.keys(membros).length >= LOB_MAX_MEMBROS) {
              throw new Error('Esse lobby já está cheio (' + LOB_MAX_MEMBROS + ' pessoas).');
            }
            var meu = ref.child('membros/' + ctx.uid);
            try { meu.onDisconnect().remove().catch(function () {}); } catch (e) {}
            _lobPronto = !!(membros[ctx.uid] && membros[ctx.uid].pronto === true);
            return meu.set(_lobMeuValor(_lobPronto))
              .then(function () {
                _lobLigar(ctx, cod, val.anfitriao.uid === ctx.uid);
                return { codigo: cod, lobbyId: cod };
              });
          });
      });
    }).catch(function (err) { throw _lobErro(err); });
  }

  /* ══════════════════════════════════════════════════════════════
     COMEÇAR A PARTIDA PELO LOBBY — Etapa 5.3
     ------------------------------------------------------------
     O que faltava pro lobby servir pra alguma coisa: até aqui o
     grupo se juntava, escolhia o jogo e... abria a sala na mão, cada
     um pelo hub, ditando código. A 5.3 fecha o circuito — o
     anfitrião toca "Começar a partida" e todo mundo cai na mesma
     sala.

     A SALA NASCE PELA TELA DO JOGO, NÃO PELA API CRUA. Essa é a
     decisão que sustenta o resto. Chamar `AngatubaMP.criarSala()`
     por fora criaria uma sala ÓRFÃ: o RTDB teria a sala, mas a tela
     do Ping Pong continuaria no menu, sem saber que ela existe e sem
     mostrar o código nem o "aguardando adversário". É exatamente a
     razão pela qual o convite 4.4 também não cria sala sozinho. Aqui
     o caminho é o mesmo dele: abre a tela do jogo, embrulha o
     criarSala daquela API pra espiar o código, e dispara o MESMO
     botão que a pessoa tocaria (`_ppCriarSala` / `_tqCriarSala` /
     `_ptyCriarSala`, já expostos desde antes). Nenhum arquivo de
     jogo precisou mudar pra 5.3.

     SALA DO LOBBY NASCE PRIVADA. O único enfeite antes do disparo é
     desmarcar "sala pública". Num 1x1 a vaga é uma só: se um
     desconhecido da lista pública entrar primeiro, o amigo que está
     no lobby fica de fora — e o grupo não teria como saber por quê.

     BARALHO É A EXCEÇÃO, E DE PROPÓSITO. Truco, Uno e companhia são
     modos diferentes com números de jogadores diferentes, escolhidos
     na tela do próprio jogo. Não existe padrão honesto pra chutar
     daqui — "começar" abre a tela do baralho no seletor de modo e o
     anfitrião toca "Criar sala" ali. O embrulho captura o código do
     mesmo jeito e o grupo é levado igual; o que muda é um toque a
     mais pro anfitrião. `iniciarJogo()` devolve `automatico: false`
     nesse caso pra UI poder dizer isso em voz alta.

     COMO O GRUPO ENTRA. O anfitrião grava `status: 'em_jogo'` e
     `codigoSalaJogo` no nó. Todo mundo já está escutando esse nó
     desde a 5.1 — não precisou de convite, notificação nem nó novo:
     o snapshot chega e `_lobTalvezEntrarNaSala` abre a tela do jogo
     e chama o `entrar` do catálogo da 4.4 (`_ppEntrarSala`,
     `_ptyEntrarSala`, `BaralhoGame.entrarPorCodigo`…).

     5.3.1 — POR QUE ISSO NÃO FUNCIONAVA NO BARALHO. O parágrafo
     acima descrevia o caminho certo, mas ele tinha um elo só: o
     embrulho de `criarSala`. Nos jogos em que o lobby aperta o botão
     sozinho (`_lobDispararCriar`) a sala nasce no mesmo instante em
     que o embrulho é pendurado, e a janela pra dar errado é de
     milissegundos. No Baralho não: entre "Começar" e "Criar sala"
     passam a escolha do modo, o número de jogadores e vários
     segundos — tempo de sobra pro teto de espera de
     `_convEsperarPronto` estourar e `iniciarJogo` desistir, LIMPANDO
     o pendente. A tela do jogo ficava aberta do mesmo jeito, o
     anfitrião criava a sala e o código morria no embrulho: sala com
     uma pessoa só, grupo preso no lobby, e nenhuma mensagem de erro
     em lugar nenhum. Três coisas mudaram: o pendente sobrevive à
     falha de abertura da tela, um vigia lê o código direto do módulo
     do jogo (`cfg.codigoAtual`) e qualquer falha de escrita no nó
     agora reabre o lobby com o código na tela em vez de sumir.

     UMA VEZ POR CÓDIGO. `_lobSalaVista` guarda o código que já me
     levou pra dentro. Sem ele, todo snapshot do lobby (alguém marca
     "pronto", alguém entra) reabriria o jogo, e quem saiu da partida
     de propósito seria arrastado de volta pra sempre. O anfitrião
     marca a guarda ANTES de escrever no nó — a escrita dele volta
     pela própria escuta, e ele já está na sala.

     O LOBBY NÃO SOME. `status: 'em_jogo'` mantém o nó de pé, com a
     lista de gente e o jogo escolhido. "Encerrar a partida" (só o
     anfitrião) devolve `status: 'aberto'` e limpa o código — o grupo
     volta pra escolher outro jogo sem refazer o lobby, que era o
     ponto do lobby existir.

     O QUE NÃO DÁ PRA FAZER AINDA — voltar sozinho. Sair da tela do
     jogo NÃO devolve o lobby pra 'aberto': os jogos não avisam
     ninguém quando a partida acaba ou quando a pessoa fecha a tela,
     e inventar essa ponte seria mexer em quatro módulos de jogo pra
     resolver o que um botão resolve. Então o lobby fica 'em_jogo'
     até o anfitrião encerrar (ou até ele cair, e aí o lobby some
     inteiro, como sempre). Está na tela, escrito, pra ninguém achar
     que travou.
  ══════════════════════════════════════════════════════════════ */

  /* Fecha o overlay do lobby e espera a folga do popstate antes de
     deixar a tela do jogo subir — mesma disciplina do
     cliConviteEntrar, que fecha o painel de conta e só então abre o
     jogo. Sem a folga, o `history.back()` do lobby chegaria DEPOIS
     do push do hub e fecharia a tela errada. */
  /* 5.3.3 — o `true` aqui é o conserto. `cliFecharLobby()` sem ele faz
     `history.back()` pra desfazer o pushState do overlay, e esse back é
     ASSÍNCRONO: no celular o popstate dele chega depois de
     `_abrirGamesHub` + `_abrirJogo` já terem empilhado 'jogos-hub' e
     'jogo'. Aí ele deixa de ser "o back do lobby" e vira, aos olhos do
     handler global, o "voltar" do usuário em cima de um jogo aberto —
     que responde com `_voltarAoMenu()` → `_pararJogosExternos()` →
     `BaralhoGame.parar()`, e esse `parar()` ESVAZIA o #baralho-root. O
     `pronto` do catálogo nunca mais ficava true e a espera morria em
     "A tela do jogo não abriu" (o convidado ficava com essa mensagem
     no lobby enquanto o anfitrião já estava na sala).
     Fechando com viaPopstate=true, o overlay some sem back nenhum e o
     pushState do hub entra por cima — nada pra chegar atrasado. A
     entrada 'lobby' que fica embaixo é consumida depois, quando a
     pessoa sai do hub pelo "voltar". */
  function _lobFecharUiEEsperar() {
    if (!_lobUiAberto()) return Promise.resolve();
    cliFecharLobby(true);
    return new Promise(function (r) { setTimeout(r, LOB_FECHAR_MS); });
  }

  /* Dispara o "criar sala" pela tela do jogo (ver o cabeçalho: sala
     criada por fora nasce órfã). Devolve true se deu pra disparar
     sozinho; false quando a escolha é do anfitrião (baralho). */
  function _lobDispararCriar(jogo) {
    var cfg = CONV_JOGOS[jogo];
    if (!cfg) return false;
    var chk = cfg.publicaCheck ? document.getElementById(cfg.publicaCheck) : null;
    if (chk) chk.checked = false;   // sala do lobby é do grupo
    var criar = cfg.criar ? window[cfg.criar] : null;
    if (typeof criar === 'function') { criar(); return true; }
    return false;                    // jogo em que o anfitrião cria à mão (Baralho)
  }

  /* Chamado pelo embrulho de criarSala da 4.4 toda vez que uma sala
     nasce. Se este lobby estava esperando por ela, o nó passa a
     apontar pra sala — e é a escuta de cada um que leva o grupo pra
     dentro. */
  function _lobCapturarSala(nomeApi, codigo) {
    var p = _lobPendente;
    if (!p || !codigo) return;
    // A sala é de outro jogo da mesma API (o anfitrião desistiu do
    // Ping Pong e criou uma de Tanques na mesma tela): não é esta.
    if ((CONV_API_JOGOS[nomeApi] || []).indexOf(p.jogo) < 0) return;
    _lobRegistrarSala(codigo);
  }

  /* ── 5.3.1: a captura deixou de depender de um caminho só ──────
     O circuito da 5.3 tinha UM elo e ele era fino: o embrulho de
     `criarSala`. Se o embrulho não estivesse pendurado na hora do
     toque — porque a tela do jogo demorou mais que o teto de espera
     e `iniciarJogo` já tinha desistido (limpando o pendente), porque
     o módulo reexportou a API por cima do embrulho, ou porque o
     `criarSala` de verdade foi chamado por um caminho que não passa
     pela API pública — o código da sala nascia e MORRIA ali. O
     anfitrião entrava na sala e o resto do grupo ficava olhando
     "quando ele começar, você entra sozinho" pra sempre, sem erro
     nenhum na tela: o silêncio era o bug.

     Agora são dois caminhos que desembocam no mesmo lugar:
       1. o embrulho (rápido, continua sendo o caminho normal);
       2. `_lobVigiarSala`, que enquanto houver pedido pendente
          pergunta ao PRÓPRIO módulo do jogo qual é o código da sala
          aberta (cfg.codigoAtual) — Party/Baralho respondem por
          `codigoSala()`, Ping Pong/Tanques pelo código que já pintam
          na tela do anfitrião.
     `_lobRegistrarSala` é idempotente (o pendente vira null no
     primeiro que chegar), então os dois podem correr juntos sem
     medo. E a escrita no nó não é mais engolida: falhou, o anfitrião
     vê o porquê e o código pra ditar à mão. */
  function _lobRegistrarSala(codigo, _retentativa) {
    var p = _lobPendente;
    if (!p || !codigo) return;
    var cod = String(codigo).toUpperCase();
    if (!_lobRef || !_lobAnfitriao) {
      _lobPendente = null; _lobPararVigia();
      _lobFalhouCaptura(cod, 'Você saiu do lobby antes de a sala abrir.');
      return;
    }
    if (Date.now() > p.ate) {        // demorou demais: o pedido caducou
      _lobPendente = null; _lobPararVigia();
      _lobFalhouCaptura(cod, 'Demorou demais entre "Começar" e criar a sala.');
      return;
    }
    _lobPendente = null;
    _lobPararVigia();
    // Antes da escrita: eu criei a sala, já estou nela. A guarda evita
    // que a minha própria escuta me mande "entrar" de novo.
    _lobSalaVista = cod;
    var ref = _lobRef;
    ref.update({ status: 'em_jogo', codigoSalaJogo: cod }).catch(function (err) {
      // Uma segunda chance antes de desistir: a primeira escrita
      // acontece no pior momento possível (tela do jogo subindo, rede
      // do celular oscilando), e recusar por isso seria trocar um erro
      // de rede por um grupo parado.
      if (!_retentativa && _lobRef === ref && _lobAnfitriao) {
        _lobPendente = { jogo: (p && p.jogo), ate: Date.now() + 15000 };
        setTimeout(function () { _lobRegistrarSala(cod, true); }, 900);
        return;
      }
      _lobSalaVista = null;
      _lobFalhouCaptura(cod, _amigosErroPt(err));
    });
  }

  /* A sala existe mas o lobby não soube dela. Isto NÃO pode ser um
     toast de 2s no meio da tela do jogo: o anfitrião precisa entender
     que o grupo ficou pra trás e ter o código na mão. Então reabre o
     lobby, escreve o motivo lá dentro (onde fica) e ainda toca o
     toast pra quem estiver olhando a tela do jogo. */
  function _lobFalhouCaptura(cod, motivo) {
    var txt = 'A sala ' + cod + ' abriu, mas o lobby não foi avisado' +
              (motivo ? ' (' + motivo + ')' : '') +
              '. Passe o código ' + cod + ' pra galera entrar por "Entrar com código".';
    if (typeof showToastSimples === 'function') {
      showToastSimples('O lobby não foi avisado da sala ' + cod + '. Toque no chip do lobby.', '/webp/owl-sign.webp');
    }
    try { cliAbrirLobby(); } catch (e) {}
    _lobUiMsg(txt, 'erro');
  }

  /* ── Vigia do código da sala (rede de segurança da captura) ────
     Roda só entre "Começar" e o nascimento da sala, e morre no
     primeiro código capturado, no fim do pendente ou na saída do
     lobby. `codigoBase` é o que o módulo já tinha aberto ANTES de
     começarmos a olhar: sem isso, uma sala velha ainda pintada na
     tela do jogo seria capturada como se fosse a nova. */
  var LOB_VIGIA_MS     = 700;               // passo do vigia
  var LOB_LEMBRETE_MS  = 45 * 1000;         // lembrete do "toque em Criar sala"
  var LOB_VIGIA_TETO_MS = 15 * 60 * 1000;   // 5.3.2: teto duro do vigia
  var _lobVigiaTimer = null;
  var _lobVigiaLembrou = false;
  var _lobVigiaJogo = null;    // 5.3.2: jogo que o vigia está olhando agora
  var _lobVigiaBase = null;    // 5.3.2: código que o módulo já tinha ao ARMAR
  var _lobVigiaAuto = false;   // 5.3.2: a sala nasce sozinha neste jogo?

  function _lobPararVigia() {
    if (_lobVigiaTimer) { clearInterval(_lobVigiaTimer); _lobVigiaTimer = null; }
    _lobVigiaLembrou = false;
    _lobVigiaJogo = null;
    _lobVigiaBase = null;
    _lobVigiaAuto = false;
  }

  /* 5.3.2 — QUANDO o vigia arma passou a importar mais que como ele
     olha. Antes ele era armado só DEPOIS de `_convAbrirTelaJogo`
     resolver, e a "base" era lida ali, com o módulo do jogo já de pé.
     No Baralho isso abria um buraco mudo: o módulo guarda a sala pra
     você retomar ao reabrir o card (`BaralhoGame.parar` não sai da
     sala), então quem tinha acabado de jogar Truco voltava pro lobby
     social com `codigoSala()` ainda apontando pra aquela sala. Essa
     sala virava a base, a tela do jogo abria direto no lobby DELA (não
     no seletor de modo), nenhum código novo aparecia — e o nó ficava
     'aberto' pra sempre, sem erro em canto nenhum. Agora:
       1. o vigia arma em `iniciarJogo`, ANTES de a tela do jogo subir
          (base normalmente null, porque o módulo nem foi baixado);
       2. rearmar o mesmo jogo não recomeça nada (nem a base, nem o
          relógio do lembrete) — só conta que o disparo foi automático;
       3. a cada passo ele tenta pendurar o embrulho de novo, de graça:
          o caminho rápido volta a existir assim que o global do jogo
          aparece, mesmo que na primeira tentativa ele não existisse. */
  function _lobVigiarSala(jogo, automatico) {
    var cfg = CONV_JOGOS[jogo];
    if (!cfg || typeof cfg.codigoAtual !== 'function') return;
    if (_lobVigiaTimer && _lobVigiaJogo === jogo) {
      _lobVigiaAuto = _lobVigiaAuto || !!automatico;
      return;
    }
    _lobPararVigia();
    _lobVigiaJogo = jogo;
    _lobVigiaAuto = !!automatico;
    try { _lobVigiaBase = cfg.codigoAtual(); } catch (e) { _lobVigiaBase = null; }
    var comecou = Date.now();
    _lobVigiaTimer = setInterval(function () {
      var p = _lobPendente;
      if (!p || p.jogo !== jogo || !_lobRef || !_lobAnfitriao) {
        _lobPararVigia();
        return;
      }
      try { _convEnvolverCriar(jogo); } catch (e) {}
      var cod = null;
      try { cod = cfg.codigoAtual(); } catch (e) { cod = null; }
      if (cod && cod !== _lobVigiaBase) { _lobRegistrarSala(cod); return; }
      /* 5.3.2 — enquanto o vigia estiver de pé e o anfitrião ainda no
         lobby, a janela do pendente se renova. Escolher o modo do
         Baralho leva o tempo que leva, e perder a captura por causa
         disso era trocar um relógio por um grupo parado. O teto duro
         é LOB_VIGIA_TETO_MS contado do "Começar" — e quando ele chega,
         o anfitrião FICA SABENDO. */
      if (Date.now() - comecou > LOB_VIGIA_TETO_MS) {
        _lobPendente = null;
        _lobPararVigia();
        if (typeof showToastSimples === 'function') {
          showToastSimples('Desisti de esperar a sala. Toque em "Começar a partida" de novo.', '/webp/owl-sign.webp');
        }
        try { cliAbrirLobby(); } catch (e) {}
        _lobUiMsg('Ninguém criou a sala a tempo — o lobby parou de esperar. ' +
                  'Toque em "Começar a partida" de novo.', 'erro');
        return;
      }
      if (p.ate - Date.now() < LOB_PENDENTE_MS / 2) p.ate = Date.now() + LOB_PENDENTE_MS;
      // Baralho (e qualquer jogo em que o anfitrião ainda toca "Criar
      // sala"): passou tempo demais parado no seletor de modo. Um
      // lembrete só — o grupo está esperando e não tem como saber.
      if (!_lobVigiaAuto && !_lobVigiaLembrou && Date.now() - comecou > LOB_LEMBRETE_MS) {
        _lobVigiaLembrou = true;
        if (typeof showToastSimples === 'function') {
          showToastSimples('A galera ainda está no lobby — escolha o modo e toque em "Criar sala".', '/webp/owl-point.webp');
        }
      }
    }, LOB_VIGIA_MS);
  }

  /* Abre a tela do jogo e entra na sala apontada pelo lobby. Serve a
     entrada automática e o botão "Entrar na partida" — é o mesmo
     caminho, e por isso a guarda mora aqui e não no chamador. */
  function _lobEntrarNaSala(jogo, codigo, aMao) {
    var cfg = CONV_JOGOS[jogo];
    if (!cfg) return Promise.reject(new Error('Jogo desconhecido.'));
    if (_lobIndoPraSala) return Promise.resolve();
    _lobIndoPraSala = true;
    _lobSalaVista = codigo;
    if (typeof showToastSimples === 'function') {
      showToastSimples(aMao ? 'Voltando pra sala ' + codigo + '…' : 'A partida começou! Entrando na sala…',
                       '/webp/owl-marching.webp');
    }
    return _lobFecharUiEEsperar().then(function () {
      return _convAbrirTelaJogo(jogo);
    }).then(function () {
      // 5.3.1 — o `return` é o conserto: `entrar` do Baralho devolve a
      // Promise de entrarSala(), e antes ela era descartada. Sala que
      // não existe mais, partida que já começou, rede caindo: tudo
      // isso falhava em silêncio, com a tela do jogo aberta no menu e
      // a pessoa sem saber por quê. Ping Pong/Tanques/Party não
      // devolvem nada, e aí o `then` segue direto, como antes.
      return cfg.entrar(codigo);
    }).then(function () {
      _lobIndoPraSala = false;
      _lobSalaFalhou = null;
    }).catch(function (err) {
      _lobIndoPraSala = false;
      _lobSalaVista = null;   // deixa tentar de novo pelo botão da tela
      throw new Error((err && err.message) || 'Não deu pra abrir o jogo. Tente de novo pelo lobby.');
    });
  }

  /* Cada snapshot passa por aqui. Só age quando o lobby aponta pra
     uma sala que eu ainda não vi — ver "UMA VEZ POR CÓDIGO". */
  function _lobTalvezEntrarNaSala(est) {
    if (!est || est.status !== 'em_jogo') return;
    if (!est.codigoSalaJogo || !est.jogoSugerido) return;
    if (_lobIndoPraSala || _lobSalaVista === est.codigoSalaJogo) return;
    // Já tentou sozinho e falhou nesta sala: não insiste a cada
    // snapshot (alguém marcando "pronto" reabriria o lobby na cara da
    // pessoa em looping). Daqui pra frente é pelo botão, que é
    // justamente o que a mensagem de erro manda fazer.
    if (_lobSalaFalhou === est.codigoSalaJogo) return;
    var cod = est.codigoSalaJogo;
    _lobEntrarNaSala(est.jogoSugerido, cod).catch(function (err) {
      _lobEntradaFalhou(cod, err);
    });
  }

  /* 5.3.1 — o convidado nunca mais fica mudo. A entrada automática é
     um luxo: ela depende do hub carregar, da tela do jogo montar e da
     sala aceitar mais um. Quando qualquer um desses falha, o caminho
     de volta tem que estar na cara — e o botão já existe desde a 5.3
     ("Entrar na partida", que chama o MESMO _lobEntrarNaSala). Então
     aqui a gente só garante que a pessoa o encontre: reabre o lobby,
     escreve o motivo dentro dele e toca o toast. */
  var _lobSalaFalhou = null;   // código que a entrada automática já não conseguiu

  function _lobEntradaFalhou(cod, err) {
    _lobSalaFalhou = cod;
    var msg = (err && err.message) || 'Não deu pra entrar na partida.';
    if (typeof showToastSimples === 'function') {
      showToastSimples(msg + ' Toque em "Entrar na partida".', '/webp/owl-sign.webp');
    }
    try { cliAbrirLobby(); } catch (e) {}
    _lobUiMsg(msg + ' A partida está na sala ' + cod +
              ' — use o botão "Entrar na partida" aqui embaixo.', 'erro');
  }

  /* Por que este lobby NÃO pode começar agora. String vazia = pode.
     Vive aqui, e não na UI, porque `iniciarJogo` precisa da mesma
     resposta — a UI só a repete antes do toque.

     POLIMENTO — "PRONTO" PASSOU A VALER. Até aqui o botão "Pronto"
     era decoração: o anfitrião começava com metade da sala ainda
     escolhendo, e a partida nascia com gente caindo dentro sem ter
     dito que estava pronta. A checagem entra POR ÚLTIMO de propósito
     — falta de jogo e falta de gente são problemas mais concretos, e
     mandar "esperando todo mundo ficar pronto" pra quem está sozinho
     no lobby seria mentira. Como a UI e o `iniciarJogo` leem a mesma
     função, travar aqui trava nos dois lugares. */
  function _lobPorQueNaoComecar(est) {
    if (!est) return 'Você não está num lobby.';
    if (!est.souAnfitriao) return 'Só quem abriu o lobby começa a partida.';
    var jogo = est.jogoSugerido;
    if (!jogo || !CONV_JOGOS[jogo]) return 'Escolha um jogo pra liberar o começo.';
    var n = est.membros.length;
    if (n < LOB_MIN_MEMBROS) {
      return 'Falta gente: chame pelo menos mais uma pessoa pro lobby.';
    }
    if (LOB_JOGO_EXATO[jogo] && n > LOB_JOGO_MAX[jogo]) {
      // Sugere os jogos do catálogo que aceitam mais gente (hoje Party e
      // Baralho) — sai do próprio catálogo, sem nome fixo no texto.
      var cabem = Object.keys(CONV_JOGOS).filter(function (k) { return !LOB_JOGO_EXATO[k] && LOB_JOGO_MAX[k] > 2; })
        .map(function (k) { return CONV_JOGOS[k].nome; });
      return CONV_JOGOS[jogo].nome + ' é 1x1 e vocês são ' + n + '. Escolham ' +
        (cabem.length ? cabem.join(' ou ') : 'outro jogo') + ' — ou fiquem só em 2 no lobby.';
    }
    /* O anfitrião conta junto: ele também tem o botão "Pronto", e
       começar sem ter marcado o próprio seria a mesma pressa por
       outro caminho. */
    var faltam = 0;
    for (var i = 0; i < n; i++) { if (!est.membros[i].pronto) faltam++; }
    if (faltam) {
      return 'Esperando todo mundo ficar pronto — ' +
        (faltam === 1 ? 'falta 1.' : 'faltam ' + faltam + '.');
    }
    return '';
  }

  /* O recado que não impede de começar: Party/Baralho aceitam menos
     gente que o lobby comporta, e quem sobrar entra na próxima. */
  function _lobAvisoLotacao(est) {
    var jogo = est && est.jogoSugerido;
    var teto = jogo ? LOB_JOGO_MAX[jogo] : 0;
    if (!teto || LOB_JOGO_EXATO[jogo] || est.membros.length <= teto) return '';
    return CONV_JOGOS[jogo].nome + ' vai até ' + teto + ' jogadores e vocês são ' +
      est.membros.length + ' — quem chegar depois fica de fora desta.';
  }

  window.AngatubaLobby = {
    disponivel: function () { return !!_lobCodigo && _cliContaReal(_cliUser); },
    limite: function () { return LOB_MAX_MEMBROS; },

    // Catálogo dos jogos com sala — o MESMO da 4.4, pra 5.2/5.3 não
    // manterem uma segunda lista que envelhece sozinha.
    jogos: function () { return CONV_JOGOS; },

    criar: _lobCriar,
    entrar: _lobEntrar,
    sair: _lobSair,

    // Estado em cache, sem I/O. null = não estou em lobby nenhum.
    meuLobby: function () { return _lobEstado; },

    /* Escuta o lobby atual. Chama o cb JÁ com o estado de agora
       (inclusive null) pra quem se inscreve depois do lobby montado
       não ficar esperando a próxima mudança. Devolve a função de
       parar. Vários inscritos convivem: a 5.2 vai querer o painel e o
       aviso do topo olhando a mesma coisa. */
    observar: function (cb) {
      if (typeof cb !== 'function') return function () {};
      _lobSubs.push(cb);
      try { cb(_lobEstado); } catch (e) {}
      return function () {
        var i = _lobSubs.indexOf(cb);
        if (i >= 0) _lobSubs.splice(i, 1);
      };
    },

    // O membro marca o próprio "pronto". Só o próprio — é o que as
    // regras deixam, e é o que a 5.2 precisa.
    definirPronto: function (pronto) {
      if (!_lobRef || !_lobUid) return Promise.reject(new Error('Você não está num lobby.'));
      _lobPronto = pronto === true;
      return _lobRef.child('membros/' + _lobUid + '/pronto').set(_lobPronto)
        .catch(function (err) { throw _lobErro(err); });
    },

    /* Anfitrião aponta o jogo da vez. É só uma SUGESTÃO gravada no nó:
       ninguém entra em sala nenhuma por causa dela. Trocar de jogo
       mantendo o grupo é reescrever este campo — que era justamente o
       que não dava pra fazer antes do lobby existir. Passar null
       limpa. */
    sugerirJogo: function (jogo) {
      if (jogo && !CONV_JOGOS[jogo]) return Promise.reject(new Error('Jogo desconhecido.'));
      if (!_lobRef || !_lobAnfitriao) {
        return Promise.reject(new Error('Só quem abriu o lobby escolhe o jogo.'));
      }
      return _lobRef.child('jogoSugerido').set(jogo || null)
        .catch(function (err) { throw _lobErro(err); });
    },

    /* 5.3 — o anfitrião começa a partida. Abre a tela do jogo e
       deixa a sala nascer pelo caminho normal dele; o nó só passa a
       apontar pra sala quando o código aparece (ver
       _lobCapturarSala). Resolve assim que a tela do jogo está de
       pé, não quando a sala existe: a promise é "o caminho está
       aberto", e o resto o grupo vê acontecer no nó.

       Devolve { jogo, automatico, aviso }:
         automatico=false -> o anfitrião ainda toca "Criar sala" na
                             tela do jogo (baralho; ver cabeçalho)
         aviso            -> lotação acima do teto do jogo, sem
                             impedir (Party/Baralho) */
    iniciarJogo: function () {
      var est = _lobEstado;
      var motivo = _lobPorQueNaoComecar(est);
      if (motivo) return Promise.reject(new Error(motivo));
      if (!_lobRef) return Promise.reject(new Error('Você não está num lobby.'));
      if (est.status === 'em_jogo' && est.codigoSalaJogo) {
        return Promise.reject(new Error('A partida já começou — use "Entrar na partida".'));
      }
      var jogo = est.jogoSugerido;
      var aviso = _lobAvisoLotacao(est);
      _lobPendente = { jogo: jogo, ate: Date.now() + LOB_PENDENTE_MS };
      _lobSalaVista = null;
      _lobPararVigia();
      /* 5.3.2 — o vigia arma AQUI, antes de a tela do jogo subir. Ver o
         cabeçalho de _lobVigiarSala: armado depois, ele lia a "base"
         com o módulo do jogo já carregado e adotava como "sala velha"
         justamente a sala que o grupo precisava ver. */
      _lobVigiarSala(jogo, false);
      return _lobFecharUiEEsperar().then(function () {
        return _convAbrirTelaJogo(jogo);
      }).then(function () {
        // O embrulho só pode ser pendurado com o módulo do jogo já
        // carregado — window.AngatubaMP/Party/Baralho nascem com ele.
        _convEnvolverCriar(jogo);
        var automatico = _lobDispararCriar(jogo);
        // O vigia já está de pé desde antes da tela; isto só conta pra
        // ele que o disparo foi automático (muda o lembrete).
        _lobVigiarSala(jogo, automatico);
        /* 5.3.2 — jogo em que a sala nasce À MÃO (Baralho): se o módulo
           JÁ está numa sala, é ela que o grupo tem que ver. É o caso
           real de quem acabou de jogar Truco e voltou pro lobby: a tela
           reabre direto no lobby daquela sala, não no seletor de modo,
           e não existe "Criar sala" pra tocar. Sem esta linha ninguém
           era avisado de nada. */
        if (!automatico) {
          var jaTem = null;
          try { jaTem = CONV_JOGOS[jogo].codigoAtual(); } catch (e) { jaTem = null; }
          if (jaTem) _lobRegistrarSala(jaTem);
        }
        return { jogo: jogo, automatico: automatico, aviso: aviso };
      }).catch(function (err) {
        /* 5.3.1 — o pendente NÃO morre aqui. A falha mais comum deste
           caminho é o teto de espera de `_convEsperarPronto`: a tela
           do jogo demorou mais que o esperado, mas ela ABRIU — e o
           anfitrião vai criar a sala nela daqui a pouco. Matar o
           pendente aqui era o que fazia a sala nascer órfã, com o
           grupo preso no lobby sem nenhum aviso. Mantemos o pendente,
           deixamos o vigia de pé (é ele que captura o código sem
           depender do embrulho) e mesmo assim contamos o erro. */
        try { _convEnvolverCriar(jogo); } catch (e) {}
        _lobVigiarSala(jogo, false);
        throw _lobErro(err);
      });
    },

    /* Entrar (ou VOLTAR) na sala que o lobby está apontando. É o
       mesmo caminho da entrada automática — quem saiu da partida sem
       querer volta por aqui, e quem chegou depois do começo também. */
    entrarNaPartida: function () {
      var est = _lobEstado;
      if (!est || est.status !== 'em_jogo' || !est.codigoSalaJogo || !est.jogoSugerido) {
        return Promise.reject(new Error('Não tem partida em andamento neste lobby.'));
      }
      // Toque explícito zera a marca de "já falhou sozinho": a pessoa
      // quer tentar de novo, e uma nova falha volta a ser contada.
      _lobSalaFalhou = null;
      return _lobEntrarNaSala(est.jogoSugerido, est.codigoSalaJogo, true)
        .catch(function (err) { throw _lobErro(err); });
    },

    /* Devolve o lobby pro estado 'aberto' e larga o código da sala.
       NÃO encosta na sala do jogo: quem ainda estiver jogando segue
       jogando: o lobby só para de apontar pra lá e volta a ser o
       cômodo onde se escolhe o próximo. */
    encerrarPartida: function () {
      if (!_lobRef || !_lobAnfitriao) {
        return Promise.reject(new Error('Só quem abriu o lobby encerra a partida.'));
      }
      _lobPendente = null;
      _lobSalaVista = null;
      _lobSalaFalhou = null;
      _lobPararVigia();
      return _lobRef.update({ status: 'aberto', codigoSalaJogo: null })
        .catch(function (err) { throw _lobErro(err); });
    },

    /* A UI da 5.2 pergunta as duas coisas antes de desenhar o botão:
       por que está travado, e o que avisar se não estiver. */
    porQueNaoComecar: function () { return _lobPorQueNaoComecar(_lobEstado); },
    avisoLotacao: function () { return _lobAvisoLotacao(_lobEstado); },

    /* ── Chat de texto do lobby (Etapa L3) ──────────────────────
       socialLobbies/{codigo}/chat/{pushId} = { uid, nome, texto, em }

       Mora DENTRO do nó do lobby: o remove()/onDisconnect do
       anfitrião leva o chat junto e não sobra lixo pra varrer. A
       janela é curta de propósito (limitToLast) — é recado de
       "cheguei", "bora", "espera aí", não histórico.

       Escuta por 'value' e não por 'child_added': com 40 filhos no
       teto, o redesenho inteiro custa menos que a contabilidade de
       entrada/saída — e o corpo da tela já é redesenhado por
       snapshot do lobby de qualquer jeito. */
    chatLimite: function () { return LOB_CHAT_MAX; },

    observarChat: function (cb) {
      if (typeof cb !== 'function' || !_lobRef) return function () {};
      var q = _lobRef.child('chat').limitToLast(LOB_CHAT_JANELA);
      var h = function (snap) {
        var val = snap.val() || {};
        var msgs = Object.keys(val).map(function (id) {
          var m = val[id] || {};
          return {
            id: id,
            uid: String(m.uid || ''),
            nome: String(m.nome || 'Jogador').slice(0, CLI_NOME_MAX),
            texto: String(m.texto || '').slice(0, LOB_CHAT_MAX),
            em: m.em || 0
          };
        }).filter(function (m) { return m.uid && m.texto; });
        // A chave do push já é cronológica; `em` desempata o que o
        // servidor carimbou no mesmo milissegundo.
        msgs.sort(function (a, b) { return (a.em - b.em) || (a.id < b.id ? -1 : 1); });
        try { cb(msgs); } catch (e) {}
      };
      q.on('value', h);
      return function () { try { q.off('value', h); } catch (e) {} };
    },

    enviarChat: function (texto) {
      var t = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim().slice(0, LOB_CHAT_MAX);
      if (!t) return Promise.resolve(null);
      if (!_lobRef || !_lobUid) return Promise.reject(new Error('Você não está num lobby.'));
      return _lobRef.child('chat').push({
        uid: _lobUid,
        nome: String(cliNomeExibicao() || 'Jogador').slice(0, CLI_NOME_MAX),
        texto: t,
        em: firebase.database.ServerValue.TIMESTAMP
      }).then(function (ref) { return ref.key; })
        .catch(function (err) { throw _lobErro(err); });
    }
  };

  /* ══════════════════════════════════════════════════════════════
     LOBBY SOCIAL — UI (Etapa 5.2)
     ------------------------------------------------------------
     A 5.1 deixou o lobby funcionando no banco e uma API (window.
     AngatubaLobby) sem nenhuma tela. Aqui ele ganha rosto: criar,
     entrar por código, ver quem está, marcar "pronto", o anfitrião
     apontar o jogo da vez, e sair.

     O BOTÃO "COMEÇAR" GANHOU FUNÇÃO NA 5.3. Ele deixa de ser enfeite
     desabilitado e chama `AngatubaLobby.iniciarJogo()`. Continua
     travado quando não dá pra começar — mas agora o motivo é o
     mesmo que a API usaria (`porQueNaoComecar()`), escrito embaixo
     do botão em vez de um "chega na próxima etapa". Com a partida em
     curso, o bloco vira "Entrar na partida" + "Encerrar a partida"
     (este só pro anfitrião).

     POR ONDE SE CHEGA
       1. Painel de conta -> "Meus amigos" -> botão "Jogar em grupo".
          É onde a pessoa já está quando pensa em jogar com alguém.
       2. Pilha de avisos do topo: enquanto você estiver num lobby,
          um chip "Lobby XXXXXX · n/6" fica ali. Tocar reabre a tela.
          Ele mora DENTRO do #aon-avisos de propósito — aquela faixa
          já é o lugar reservado do app pra recado flutuante, então o
          chip não inventa posição nova nem briga com o header, com o
          botão do WhatsApp ou com a barra do celular.
       3. Conta anônima/deslogada não tem lobby: o botão leva pro
          login, igual ao resto do social.

     UMA ESCUTA SÓ, VIVA O TEMPO TODO. `AngatubaLobby.observar` é
     assinado no login (irmão do _convObservarCaixa e do
     _pedObservarGlobal) e não ao abrir a tela: é isso que faz o chip
     aparecer pra quem está na home e o "o lobby acabou" chegar sem a
     tela aberta. O desenho pesado (lista de membros, escutas de
     presença) só roda com o overlay ABERTO — fechado, a UI só cuida
     do chip.

     PRESENÇA NA LISTA. Mesmo mecanismo da lista de amigos (uma
     escuta de presence/{uid} por pessoa, que é o único acesso que as
     regras dão), mas com o atributo `data-lobpres` em vez de
     `data-pres`. Não é preciosismo: o painel de conta pode estar
     aberto POR BAIXO com o mesmo amigo na lista, e dois elementos
     com o mesmo data-pres fariam o querySelector pintar sempre o
     primeiro.

     "CHAMAR PRO LOBBY" É COPIAR O CÓDIGO. Na fileira de jogos que já
     abre embaixo de cada amigo (4.4), entra um primeiro botão
     "Chamar pro lobby" quando você está num lobby — ele copia o
     código e manda avisar no Zap. Não inventei um convite de lobby
     no RTDB: seria nó novo, regra nova e caixa de entrada nova pra
     entregar o que 6 caracteres no WhatsApp já entregam. Se um dia
     valer a pena, o padrão a copiar é o gameInvites da 4.4 — mas
     `jogo` e `codigo` de lá são de sala de jogo, não de lobby, então
     seria nó separado mesmo.

     Funções globais (onclick do HTML gerado):
       cliAbrirLobby / cliFecharLobby
       cliLobbyCriar / cliLobbyEntrar / cliLobbySair
       cliLobbyCopiar / cliLobbyPronto / cliLobbySugerir
       cliLobbyChamar(uid)
       cliLobbyComecar / cliLobbyEntrarPartida / cliLobbyEncerrarPartida (5.3)
       cliLobbyChatEnviar / cliLobbyChatRascunho / cliLobbyChamarAberto (L3)

     L3 REDESENHOU A TELA (e só a tela): o corpo virou três peças —
     topo com o código, miolo rolável, rodapé preso — e ganhou o
     chat de texto. Nenhum handler mudou de nome nem de regra; ver o
     cabeçalho de _lobUiHtmlDentro pro que saiu e o que entrou.

     O POLIMENTO SEGUINTE mexeu na MESMA camada, e só nela: o lobby
     deixou de parecer uma janela cinza e virou tela cheia com a
     igreja à noite atrás (CSS, em #modal-lobby), perdeu o título
     "Jogar em grupo" e o chip permanente do código, e o "Pronto"
     passou a valer — o "Começar" só libera com a sala inteira
     pronta (a regra mora no _lobPorQueNaoComecar, de onde a UI e o
     iniciarJogo já liam). Rede, RTDB, convites e o caminho da 5.3
     estão exatamente como estavam.
  ══════════════════════════════════════════════════════════════ */

  var _lobUiUnsub = null;     // desliga o observar() da 5.1
  var _lobUiPres = {};        // uid -> função de parar a escuta de presença
  var _lobUiPill = null;      // chip "Lobby XXXXXX" na faixa de avisos
  var _lobUiTinha = false;    // eu estava num lobby no snapshot anterior
  var _lobUiOcupado = false;  // uma ação (criar/entrar/sair) em voo

  function _lobUiEl() { return document.getElementById('modal-lobby'); }

  function _lobUiAberto() {
    var el = _lobUiEl();
    return !!(el && el.classList.contains('open'));
  }

  /* A mensagem fica guardada, não só escrita na tela: qualquer snapshot
     do lobby redesenha o corpo inteiro, e sem isto o "Lobby aberto!
     Código: XXXXXX" sumiria no redesenho que o próprio criar() provoca
     — uma corrida que depende de quem chega primeiro, o `then` ou o
     snapshot.

     E É EXATAMENTE POR ISSO QUE ELA PRECISOU APRENDER A IR EMBORA.
     Guardar a mensagem resolveu o sumiço no redesenho e criou o
     problema oposto: "Convite enviado pro Fulano — ele aceita e cai
     aqui" ficava no rodapé até alguém escrever outra coisa. Uma
     linha verde permanente embaixo de "Pronto/Começar" parece
     estado da sala, e não é: é o eco de um toque que já aconteceu.

     A REGRA, por TIPO da mensagem:
       'erro'  -> FICA. Ele pede uma ação de quem está lendo ("cole o
                  código que te mandaram", "não deu pra entrar na
                  partida — use o botão"). Sair sozinho esconderia o
                  que a pessoa precisa resolver.
       'ok'/'' -> APAGA SOZINHO em LOB_MSG_MS. Feedback de ação
                  (convite enviado, código copiado, convite cancelado)
                  e recado de progresso ("Entrando…") já cumpriram o
                  papel no instante em que foram lidos.

     O BLOQUEIO REAL NUNCA PASSOU POR AQUI, e continua não passando:
     "Esperando todo mundo ficar pronto", "Escolha um jogo" e afins
     são o <p class="lobby-dica">, recalculado do porQueNaoComecar()
     a cada redesenho — ele aparece e some sozinho porque a CONDIÇÃO
     mudou, que é o certo pra um bloqueio. Este temporizador não
     encosta nele. */
  var LOB_MSG_MS = 3200;       // feedback de ação no rodapé: vida útil
  var _lobUiMsgAtual = null;   // {texto, tipo}
  var _lobUiMsgTimer = null;   // apagador do feedback não-erro

  function _lobUiMsgParar() {
    if (_lobUiMsgTimer) { clearTimeout(_lobUiMsgTimer); _lobUiMsgTimer = null; }
  }

  function _lobUiPintarMsg() {
    var el = document.getElementById('lobby-msg');
    if (!el) return;
    el.textContent = _lobUiMsgAtual ? _lobUiMsgAtual.texto : '';
    el.className = 'cli-amigos-msg' +
      (_lobUiMsgAtual && _lobUiMsgAtual.tipo ? ' ' + _lobUiMsgAtual.tipo : '');
  }

  function _lobUiMsg(texto, tipo) {
    /* Sempre zera o anterior: duas ações seguidas (copiar e depois
       convidar) não podem deixar o apagador da primeira levando a
       segunda embora antes da hora. */
    _lobUiMsgParar();
    _lobUiMsgAtual = texto ? { texto: texto, tipo: tipo || '' } : null;
    _lobUiPintarMsg();
    if (!_lobUiMsgAtual || _lobUiMsgAtual.tipo === 'erro') return;
    _lobUiMsgTimer = setTimeout(function () {
      _lobUiMsgTimer = null;
      _lobUiMsgAtual = null;
      /* Só repinta. Não redesenha o corpo: o rodapé some a linha e o
         resto da tela (grade, chat, rascunho, foco) fica onde está. */
      _lobUiPintarMsg();
    }, LOB_MSG_MS);
  }

  /* Trava os botões enquanto uma ação está em voo: criar e entrar
     demoram uma ida ao banco, e dois toques seguidos abririam dois
     lobbies (o segundo apagando o primeiro no sair implícito).

     `data-travar="nao"` marca quem fica de fora nos DOIS sentidos —
     o "Copiar", que não precisa esperar nada, e o "Começar" quando
     ele está travado por falta de gente ou de jogo (5.3): soltar a
     trava não pode reabilitá-lo de brinde. Com o "Começar" liberado,
     a marca não vai, e ele trava junto com o resto. */
  function _lobUiTravar(on) {
    _lobUiOcupado = !!on;
    var box = document.getElementById('lobby-corpo');
    if (!box) return;
    var bts = box.querySelectorAll('button');
    for (var i = 0; i < bts.length; i++) {
      if (bts[i].getAttribute('data-travar') === 'nao') continue;
      bts[i].disabled = !!on;
    }
  }

  /* ── Chip na faixa de avisos ───────────────────────────────────
     Vive dentro do #aon-avisos, mas com classe própria: o teto de
     cards do _avisoMostrar conta `.aon-aviso`, então o chip não
     empurra nenhum aviso pra fora da pilha. */
  function _lobUiPintarPill(est) {
    var raiz = _avisoRaiz();
    var esconder = !est || !raiz || _lobUiAberto() ||
      (typeof _gamesHubAberto === 'function' && _gamesHubAberto());
    if (esconder) {
      if (_lobUiPill && _lobUiPill.parentNode) _lobUiPill.parentNode.removeChild(_lobUiPill);
      if (!est) _lobUiPill = null;
      return;
    }
    // O _avisoLimpar() zera o innerHTML da faixa: se o chip foi junto,
    // monta outro em vez de ressuscitar um nó solto.
    if (!_lobUiPill || !_lobUiPill.parentNode) {
      _lobUiPill = document.createElement('button');
      _lobUiPill.type = 'button';
      _lobUiPill.className = 'aon-lobby-chip';
      _lobUiPill.setAttribute('aria-label', 'Abrir o lobby');
      _lobUiPill.onclick = function () { cliAbrirLobby(); };
      raiz.appendChild(_lobUiPill);
    }
    _lobUiPill.innerHTML =
      '<i class="fa fa-users"></i>' +
      '<span>Lobby <b>' + escHTML(est.codigo) + '</b></span>' +
      '<span class="aon-lobby-chip-n">' + est.membros.length + '/' +
        window.AngatubaLobby.limite() + '</span>';
  }

  /* ── Escutas de presença dos membros ───────────────────────────*/
  function _lobUiSoltarPresencas() {
    Object.keys(_lobUiPres).forEach(function (uid) {
      try { _lobUiPres[uid](); } catch (e) {}
    });
    _lobUiPres = {};
    // A lista "Chamar amigos" (L1) mantém as presenças DELA, com outro
    // atributo; o redesenho do corpo derruba as duas juntas.
    _lobAmiSoltarPresencas();
  }

  function _lobUiPintarPresenca(uid, p) {
    var dot = document.querySelector('.cli-amigo-dot[data-lobpres="' + uid + '"]');
    if (dot) {
      dot.className = 'cli-amigo-dot' + _presClasseDot(p);
      dot.title = _presRotulo(p).texto;
    }
  }

  function _lobUiLigarPresencas(est) {
    est.membros.forEach(function (m) {
      if (m.uid === (_cliUser && _cliUser.uid)) return;   // o meu ponto sou eu
      _lobUiPres[m.uid] = window.AngatubaPresenca.observar(m.uid, function (p) {
        _lobUiPintarPresenca(m.uid, p);
      });
    });
  }

  /* ── HTML: fora de lobby ───────────────────────────────────────*/
  function _lobUiHtmlFora() {
    return '' +
      '<div class="lobby-simples">' +
      '<div class="lobby-vazio">' +
        '<img src="/webp/owl-marching.webp" alt="" class="lobby-owl" onerror="this.style.display=\'none\'" />' +
        '<p class="lobby-lead">Junte a galera primeiro e escolha o jogo depois.</p>' +
      '</div>' +
      '<button type="button" class="lobby-btn grande" onclick="cliLobbyCriar()">' +
        '<i class="fa fa-plus"></i> Criar um lobby</button>' +
      '<div class="lobby-ou"><span>ou entre com o código</span></div>' +
      '<div class="lobby-entrar">' +
        '<input id="lobby-cod-input" class="lobby-input" type="text" inputmode="latin" ' +
          'autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="14" ' +
          'placeholder="Ex.: AB12CD" aria-label="Código do lobby" ' +
          'onkeydown="if(event.key===\'Enter\'){event.preventDefault();cliLobbyEntrar();}" />' +
        '<button type="button" class="lobby-btn" onclick="cliLobbyEntrar()">Entrar</button>' +
      '</div>' +
      '<p id="lobby-msg" class="cli-amigos-msg"></p>' +
      '</div>';
  }

  /* ── HTML: dentro do lobby ─────────────────────────────────────
     L3 — a lista virou GRADE DE VAGAS. Em 360px, seis linhas de
     avatar+nome+tag comiam a tela inteira e empurravam o resto pra
     baixo da dobra; três colunas de tile mostram o grupo todo de uma
     vez, que é a única coisa que a pessoa realmente veio ver aqui.
     O avatar continua sendo o _amLinhaAvatar da lista de amigos —
     mesmo componente, mesmo `data-lobpres`, então as escutas de
     presença da 5.2 seguem pintando o pontinho sem saber de nada. */
  function _lobUiHtmlSlot(m) {
    var eu = (_cliUser && m.uid === _cliUser.uid);
    return '<div class="lobby-slot' + (m.pronto ? ' pronto' : '') + '">' +
      '<span class="lobby-slot-av">' +
        _amLinhaAvatar(m.uid, m.nome, false, m.foto, 'lobpres') +
        (m.anfitriao ? '<i class="fa fa-crown lobby-slot-coroa" aria-label="Anfitrião" title="Anfitrião"></i>' : '') +
      '</span>' +
      '<span class="lobby-slot-nome">' + escHTML(m.nome) + (eu ? ' <i>(você)</i>' : '') + '</span>' +
      '<span class="lobby-slot-st' + (m.pronto ? ' ok' : '') + '">' +
        (m.pronto ? 'Pronto' : 'Escolhendo') + '</span>' +
    '</div>';
  }

  /* Vaga vazia. Só as que FECHAM A LINHA da grade: com dois na sala
     aparece uma vaga, não quatro — a grade fica inteira sem virar um
     tabuleiro de buracos. */
  function _lobUiHtmlVaga() {
    return '<div class="lobby-slot vago" aria-hidden="true">' +
      '<span class="lobby-slot-av"><span class="lobby-slot-mais">+</span></span>' +
      '<span class="lobby-slot-nome">Vaga</span>' +
      '<span class="lobby-slot-st"></span>' +
    '</div>';
  }

  function _lobUiHtmlJogos(est) {
    var cat = window.AngatubaLobby.jogos();
    var chips = Object.keys(cat).map(function (k) {
      var on = (est.jogoSugerido === k);
      return '<button type="button" class="lobby-jogo' + (on ? ' on' : '') + '" ' +
        'onclick="cliLobbySugerir(\'' + k + '\')" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        cat[k].emoji + ' ' + escHTML(cat[k].nome) + '</button>';
    }).join('');
    return '<div class="lobby-jogos">' + chips + '</div>';
  }

  /* L3 — HIERARQUIA DA TELA, em três peças fixas dentro do
     #lobby-corpo: topo (o código, compacto), miolo rolável, rodapé
     preso embaixo. O que mudou e por quê:

       - o código saiu da caixa de largura inteira com rótulo. Ele é
         consulta, não a atração: quem chega aqui quer ver QUEM está
         na sala. (No polimento seguinte ele saiu TAMBÉM do topo e
         virou "Copiar código" na fila secundária do rodapé — o topo
         é do título "Na sala n/6", que antes era uma seção à parte.)
       - "Na sala" subiu pro primeiro lugar e virou grade;
       - "Chamar amigos" virou <details>, fechado quando já tem gente
         na sala — a lista de amigos offline não pode competir com o
         grupo que já está de pé;
       - a pilha de <p class="lobby-dica"> em itálico foi embora.
         Sobrou UMA linha, no rodapé, e só quando ela explica um botão
         travado (ou avisa da lotação acima do teto do jogo);
       - as ações pararam de aparecer no meio do texto: "pronto" e
         "começar" moram no rodapé, e "sair/encerrar" fica abaixo
         deles, em contorno, sem disputar o toque.

     A LÓGICA é a mesma da 5.3/L1/L2: mesmos handlers, mesmo
     porQueNaoComecar(), mesmo `emJogo`, mesmo #lobby-amigos pro
     _lobAmiRender achar. */
  function _lobUiHtmlDentro(est) {
    var cat = window.AngatubaLobby.jogos();
    var jogo = est.jogoSugerido ? cat[est.jogoSugerido] : null;
    var lim = window.AngatubaLobby.limite();
    var n = est.membros.length;
    /* 5.3 — com a partida em curso o bloco de baixo muda de assunto.
       Subiu pra cá na L1 porque a seção "Chamar amigos" também some
       nesse estado: ninguém entra num lobby que não está 'aberto'. */
    var emJogo = (est.status === 'em_jogo' && !!est.codigoSalaJogo && !!jogo);

    // "Estou pronto" — cada um marca o seu (a regra só deixa o próprio).
    var euPronto = false;
    for (var i = 0; i < n; i++) {
      if (_cliUser && est.membros[i].uid === _cliUser.uid) { euPronto = est.membros[i].pronto; break; }
    }

    /* ── 1. Topo fixo: "Na sala n/6" ────────────────────────────
       POLIMENTO: o chip do código saiu daqui. Ele era permanente e
       não precisava ser — a pessoa lê o código uma vez, quando vai
       chamar alguém, e o resto da sessão ele só ocupava a primeira
       linha da tela. Desceu pro rodapé como "Copiar código" (abaixo,
       na fila secundária). No lugar entrou o título que era a
       primeira seção do miolo: uma faixa faz o trabalho de duas, e o
       X do canto (HTML) mora nesta mesma linha. */
    var html = '' +
      '<div class="lobby-topo">' +
        '<span class="lobby-topo-tit">Na sala' +
          '<span class="lobby-cont">' + n + '/' + lim + '</span></span>' +
        (emJogo ? '<span class="lobby-tag ok">Em partida</span>' : '') +
      '</div>' +
      '<div class="lobby-scroll">';

    /* ── 2. Na sala ─────────────────────────────────────────────*/
    var slots = est.membros.map(_lobUiHtmlSlot).join('');
    var vagas = Math.min(lim, Math.ceil(n / 3) * 3) - n;
    for (var v = 0; v < vagas; v++) slots += _lobUiHtmlVaga();
    html += '<div class="lobby-slots">' + slots + '</div>';

    /* ── 3. Chamar amigos (L1), agora colapsável ────────────────
       O miolo é pintado pelo _lobAmiRender (que tem a lista e as
       presenças), não aqui: esta string só reserva o lugar — e ele
       existe no DOM mesmo com o <details> fechado, então nada muda
       pro render de lá. Qualquer membro convida: as regras pedem
       amizade entre quem manda e quem recebe, não anfitrião (ver o
       bloco "CONVIDAR AMIGO PRO LOBBY"). */
    if (!emJogo) {
      var aberto = (_lobChamarAberto === null) ? (n <= 1) : !!_lobChamarAberto;
      html +=
        /* O <summary> fica display:block e quem vira flex é o <span>
           de dentro: Safari tem histórico de engasgar com summary
           display:flex/grid, e o preço de descobrir isso no iPhone de
           alguém é a seção não abrir mais. */
        '<details class="lobby-chamar"' + (aberto ? ' open' : '') +
          ' ontoggle="window.cliLobbyChamarAberto(this.open)">' +
          '<summary class="lobby-chamar-tit">' +
            '<span class="lobby-sec-tit">' +
              '<span>Chamar amigos</span><i class="fa fa-chevron-down"></i>' +
            '</span>' +
          '</summary>' +
          '<div id="lobby-amigos" class="lobby-amigos"></div>' +
        '</details>';
    }

    /* ── 4. Modo ────────────────────────────────────────────────
       Com a partida em curso o bloco muda de assunto: não é mais "o
       que vamos jogar", é "a partida está lá". Os chips somem de
       propósito — trocar o jogo com o grupo dentro de uma sala só
       confundiria quem está lá. */
    if (emJogo) {
      html +=
        '<div class="lobby-sec-tit"><span>Partida</span></div>' +
        '<div class="lobby-emjogo">' +
          '<span class="lobby-emjogo-txt">' + jogo.emoji + ' ' + escHTML(jogo.nome) +
            ' · sala <b>' + escHTML(est.codigoSalaJogo) + '</b></span>' +
        '</div>';
    } else if (est.souAnfitriao) {
      /* O nome do jogo escolhido NÃO se repete aqui: o chip aceso
         logo abaixo já diz qual é, e o rótulo à direita era um dos
         labels duplicados que enchiam a tela. */
      html +=
        '<div class="lobby-sec-tit"><span>Modo</span></div>' +
        _lobUiHtmlJogos(est);
    } else {
      html +=
        '<div class="lobby-sec-tit"><span>Modo</span></div>' +
        '<p class="lobby-modo-ro">' +
          (jogo ? jogo.emoji + ' <b>' + escHTML(jogo.nome) + '</b> — escolha do anfitrião.'
                : 'O anfitrião ainda não escolheu.') +
        '</p>';
    }

    /* ── 5. Chat (L3) ───────────────────────────────────────────
       Fica DEPOIS do modo e antes do rodapé, com altura fixa: a
       janela é dele, e o resto da tela não pode encolher porque
       alguém falou muito. O miolo é pintado pelo _lobChatRender a
       partir do cache da escuta — aqui só nasce a casca. */
    html +=
      '<div class="lobby-sec-tit"><span>Chat</span></div>' +
      '<div class="lobby-chat">' +
        '<div class="lobby-chat-msgs" id="lobby-chat-msgs" aria-live="polite"></div>' +
        '<div class="lobby-chat-barra">' +
          '<input id="lobby-chat-input" class="lobby-chat-input" type="text" ' +
            'maxlength="' + window.AngatubaLobby.chatLimite() + '" autocomplete="off" ' +
            'placeholder="Falar com a sala…" aria-label="Mensagem pra sala" ' +
            'oninput="window.cliLobbyChatRascunho(this.value)" ' +
            'onkeydown="if(event.key===\'Enter\'){event.preventDefault();cliLobbyChatEnviar();}" />' +
          '<button type="button" class="lobby-chat-env" onclick="cliLobbyChatEnviar()" ' +
            'data-travar="nao" aria-label="Enviar"><i class="fa fa-paper-plane"></i></button>' +
        '</div>' +
      '</div>';

    /* ── 6. Rodapé fixo ─────────────────────────────────────────*/
    var dica = '', acoes = '', sec = '';
    if (emJogo) {
      acoes =
        '<button type="button" class="lobby-btn grande" onclick="cliLobbyEntrarPartida()">' +
          '<i class="fa fa-play"></i> Entrar na partida</button>';
      sec = est.souAnfitriao
        ? '<button type="button" class="lobby-btn sec" onclick="cliLobbyEncerrarPartida()">' +
            '<i class="fa fa-flag-checkered"></i> Encerrar a partida</button>' +
          '<button type="button" class="lobby-btn sair" onclick="cliLobbySair()">Encerrar o lobby</button>'
        : '<button type="button" class="lobby-btn sair" onclick="cliLobbySair()">' +
            '<i class="fa fa-right-from-bracket"></i> Sair do lobby</button>';
    } else if (est.souAnfitriao) {
      var motivo = window.AngatubaLobby.porQueNaoComecar();
      // UMA linha só: o que trava o botão vence; sem trava, o aviso de
      // lotação acima do teto do jogo (que não impede, mas importa).
      dica = motivo || window.AngatubaLobby.avisoLotacao();
      acoes =
        '<button type="button" class="lobby-btn pronto' + (euPronto ? ' on' : '') + '" ' +
          'onclick="cliLobbyPronto()" aria-pressed="' + (euPronto ? 'true' : 'false') + '">' +
          '<i class="fa fa-' + (euPronto ? 'check' : 'hourglass-half') + '"></i> Pronto</button>' +
        // Travado, ele carrega o data-travar="nao" pra trava de
        // criar/entrar não reabilitá-lo ao soltar (ver _lobUiTravar).
        '<button type="button" class="lobby-btn grande" onclick="cliLobbyComecar()"' +
          (motivo ? ' disabled data-travar="nao" title="' + escHTML(motivo) + '"' : '') + '>' +
          '<i class="fa fa-play"></i> Começar</button>';
      sec = '<button type="button" class="lobby-btn sair" onclick="cliLobbySair()">' +
        '<i class="fa fa-right-from-bracket"></i> Encerrar o lobby</button>';
    } else {
      acoes =
        '<button type="button" class="lobby-btn grande pronto' + (euPronto ? ' on' : '') + '" ' +
          'onclick="cliLobbyPronto()" aria-pressed="' + (euPronto ? 'true' : 'false') + '">' +
          '<i class="fa fa-' + (euPronto ? 'check' : 'hourglass-half') + '"></i> ' +
          (euPronto ? 'Estou pronto' : 'Marcar que estou pronto') + '</button>';
      sec = '<button type="button" class="lobby-btn sair" onclick="cliLobbySair()">' +
        '<i class="fa fa-right-from-bracket"></i> Sair do lobby</button>';
    }

    /* O código da sala virou ISTO: primeiro item da fila secundária,
       botão de texto, sem caixa e sem o código à mostra — ele aparece
       na mensagem depois do toque (ver cliLobbyCopiar). data-travar
       ="nao" pelo mesmo motivo do antigo chip: copiar não espera
       ida nenhuma ao banco. */
    sec = '<button type="button" class="lobby-btn cod" onclick="cliLobbyCopiar()" ' +
        'data-travar="nao" aria-label="Copiar o código da sala">' +
        '<i class="fa fa-copy"></i> Copiar código</button>' + sec;

    html +=
      '</div>' +                       // fecha .lobby-scroll
      '<div class="lobby-rodape">' +
        '<p id="lobby-msg" class="cli-amigos-msg"></p>' +
        (dica ? '<p class="lobby-dica">' + escHTML(dica) + '</p>' : '') +
        '<div class="lobby-acoes">' + acoes + '</div>' +
        '<div class="lobby-acoes sec">' + sec + '</div>' +
      '</div>';
    return html;
  }

  /* ══════════════════════════════════════════════════════════════
     CHAT DO LOBBY — Etapa L3 (UI)
     ------------------------------------------------------------
     O banco é da 5.1 (AngatubaLobby.observarChat/enviarChat, nó
     socialLobbies/{codigo}/chat). Aqui é só tela.

     O CACHE EXISTE PORQUE O CORPO É REDESENHADO INTEIRO. Qualquer
     snapshot do lobby (alguém marcou pronto, alguém entrou) refaz o
     innerHTML do #lobby-corpo e leva o chat junto — então as
     mensagens ficam guardadas em _lobChatMsgs e são repintadas
     depois de cada redesenho, igual ao que o _lobAmiRender faz com a
     lista de amigos.

     E POR ISSO O RASCUNHO E O FOCO TAMBÉM SÃO GUARDADOS: sem isso,
     bastava alguém entrar na sala pra você perder o que estava
     digitando no meio da frase (e o teclado do celular fechar na
     sua cara).

     A ESCUTA SEGUE O LOBBY, não a tela: religa quando o código muda,
     e cai no fechar do overlay e no sair do lobby. Um lobby só tem
     40 mensagens em memória — é recado, não histórico.

     MIC E VOZ CONTINUAM NÃO EXISTINDO. Só texto.
  ══════════════════════════════════════════════════════════════ */
  var _lobChatUnsub = null;     // desliga o observarChat
  var _lobChatCod = null;       // código do lobby que a escuta segue
  var _lobChatMsgs = [];        // últimas mensagens, pra repintar no redesenho
  var _lobChatRascunho = '';    // o que estava digitado antes do redesenho
  var _lobChatRefoco = false;   // o input estava com o foco antes do redesenho
  var _lobChamarAberto = null;  // <details> "Chamar amigos": null = automático

  function _lobChatSoltar() {
    if (_lobChatUnsub) { try { _lobChatUnsub(); } catch (e) {} _lobChatUnsub = null; }
    _lobChatCod = null;
    _lobChatMsgs = [];
    _lobChatRascunho = '';
    _lobChatRefoco = false;
  }

  function _lobChatLigar(est) {
    if (!est) { _lobChatSoltar(); return; }
    if (_lobChatUnsub && _lobChatCod === est.codigo) return;   // já estou nesse
    _lobChatSoltar();
    _lobChatCod = est.codigo;
    _lobChatUnsub = window.AngatubaLobby.observarChat(function (msgs) {
      _lobChatMsgs = msgs || [];
      _lobChatRender();
    });
  }

  function _lobChatRender() {
    var box = document.getElementById('lobby-chat-msgs');
    if (!box) return;
    var meu = (_cliUser && _cliUser.uid) || '';
    box.innerHTML = _lobChatMsgs.length
      ? _lobChatMsgs.map(function (m) {
          return '<div class="lobby-msg' + (m.uid === meu ? ' minha' : '') + '">' +
            (m.uid === meu ? '' : '<span class="lobby-msg-de">' + escHTML(m.nome) + '</span>') +
            '<span class="lobby-msg-txt">' + escHTML(m.texto) + '</span>' +
          '</div>';
        }).join('')
      : '<p class="lobby-chat-vazio">Ninguém falou nada ainda.</p>';
    // Novas embaixo: a janela abre sempre no fim da conversa.
    box.scrollTop = box.scrollHeight;
    var inp = document.getElementById('lobby-chat-input');
    if (!inp) return;
    if (inp.value !== _lobChatRascunho) inp.value = _lobChatRascunho;
    if (_lobChatRefoco) {
      _lobChatRefoco = false;
      try { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
    }
  }

  /* Enviar. Limpa o campo na hora e devolve o texto se o banco
     recusar — quem escreveu não perde a frase por causa de uma regra
     ou de uma queda de rede. */
  function cliLobbyChatEnviar() {
    var inp = document.getElementById('lobby-chat-input');
    if (!inp) return;
    var txt = inp.value;
    if (!String(txt || '').trim()) return;
    inp.value = '';
    _lobChatRascunho = '';
    window.AngatubaLobby.enviarChat(txt).catch(function (err) {
      _lobChatRascunho = txt;
      var el = document.getElementById('lobby-chat-input');
      if (el) el.value = txt;
      _lobUiMsg((err && err.message) || 'Não deu pra enviar agora.', 'erro');
    });
  }

  function _lobUiHtmlDeslogado() {
    return '' +
      '<div class="lobby-simples">' +
        '<div class="lobby-vazio">' +
          '<img src="/webp/owl-wave.webp" alt="" class="lobby-owl" onerror="this.style.display=\'none\'" />' +
          '<p class="lobby-lead">Entre na sua conta pra jogar em grupo.</p>' +
        '</div>' +
        '<button type="button" class="lobby-btn grande" onclick="cliFecharLobby();cliAbrirLogin();">' +
          'Entrar na conta</button>' +
      '</div>';
  }

  /* ── Desenho ───────────────────────────────────────────────────
     Só roda com o overlay aberto: fechado, a UI do lobby é só o chip
     (e nenhuma escuta de presença pendurada). */
  function _lobUiRender(est) {
    var box = document.getElementById('lobby-corpo');
    if (!box) return;
    _lobUiSoltarPresencas();
    if (!_lobUiAberto()) return;
    if (!_cliContaReal(_cliUser)) { box.innerHTML = _lobUiHtmlDeslogado(); _lobChatSoltar(); return; }
    // L3: quem estava digitando no chat volta a digitar depois do
    // redesenho — o innerHTML abaixo mata o input com foco e tudo.
    var ae = document.activeElement;
    _lobChatRefoco = !!(ae && ae.id === 'lobby-chat-input');
    box.innerHTML = est ? _lobUiHtmlDentro(est) : _lobUiHtmlFora();
    if (est) _lobUiLigarPresencas(est);
    // L1: o miolo do "Chamar amigos" entra depois do corpo montado —
    // ele depende da lista de amigos, que tem escuta própria.
    _lobAmiRender();
    // L3: mesma ideia pro chat — a escuta é do lobby, o desenho é daqui.
    if (est) { _lobChatLigar(est); _lobChatRender(); } else { _lobChatSoltar(); }
    _lobUiPintarMsg();
    if (_lobUiOcupado) _lobUiTravar(true);
  }

  /* ── Escuta global (irmã da caixa de convites e dos pedidos) ────*/
  function _lobUiEstado(est) {
    // Entrou ou saiu de lobby: a mensagem da tela anterior não vale
    // mais — e o "Chamar amigos" volta ao padrão automático (L3).
    if (!!est !== _lobUiTinha) { _lobUiMsgParar(); _lobUiMsgAtual = null; _lobChamarAberto = null; }
    // Estava num lobby e agora não estou mais, sem ter tocado em sair:
    // o anfitrião caiu ou encerrou. Ver "ANFITRIÃO CAIU" na 5.1.
    if (!est && _lobUiTinha && !_lobUiOcupado) {
      if (typeof showToastSimples === 'function') {
        showToastSimples('O lobby foi encerrado.', '/webp/owl-sleeping.webp');
      }
      _lobUiMsg('O lobby foi encerrado — o anfitrião saiu. Crie outro ou entre com um código.', 'erro');
    }
    _lobUiTinha = !!est;
    _lobUiRender(est);
    _lobUiPintarPill(est);
  }

  function _lobUiObservar() {
    if (_lobUiUnsub || !_cliContaReal(_cliUser)) return;
    _lobUiUnsub = window.AngatubaLobby.observar(_lobUiEstado);
  }

  function _lobUiSoltar() {
    if (_lobUiUnsub) { try { _lobUiUnsub(); } catch (e) {} _lobUiUnsub = null; }
    _lobUiSoltarPresencas();
    _lobAmiSoltar();
    _lobChatSoltar();
    _lobChamarAberto = null;
    _lobUiTinha = false;
    _lobUiOcupado = false;
    _lobUiMsgParar();
    _lobUiMsgAtual = null;
    _lobUiPintarPill(null);
    var box = document.getElementById('lobby-corpo');
    if (box && _lobUiAberto()) box.innerHTML = _lobUiHtmlDeslogado();
  }

  /* ── Abrir e fechar ────────────────────────────────────────────*/
  function cliAbrirLobby() {
    var overlay = _lobUiEl();
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Empilha sobre o painel de conta em vez de fechá-lo: o handler de
    // popstate testa o lobby ANTES do painel, então um "voltar" fecha
    // só o de cima e a pessoa cai de volta em "Meus amigos".
    if (!history.state || history.state.modal !== 'lobby') {
      history.pushState({ modal: 'lobby' }, '');
    }
    _lobUiObservar();
    // L1: a lista de amigos vive só com a tela aberta (igual à do
    // painel de conta) — são listeners de RTDB.
    _lobAmiLigar();
    _lobUiRender(_cliContaReal(_cliUser) ? window.AngatubaLobby.meuLobby() : null);
    _lobUiPintarPill(window.AngatubaLobby.meuLobby());
  }

  function cliFecharLobby(viaPopstate) {
    var overlay = _lobUiEl();
    if (overlay) overlay.classList.remove('open');
    _lobUiSoltarPresencas();
    _lobAmiSoltar();
    // L3: a escuta do chat vive com a tela aberta, como a dos amigos.
    _lobChatSoltar();
    // O painel de conta pode ter ficado aberto por baixo — nesse caso o
    // scroll do body continua travado, que é o estado certo pra ele.
    var conta = document.getElementById('modal-cli-conta');
    document.body.style.overflow = (conta && conta.classList.contains('open')) ? 'hidden' : '';
    if (!viaPopstate && history.state && history.state.modal === 'lobby') {
      _popstateNosso = true; history.back();
    }
    _lobUiPintarPill(window.AngatubaLobby.meuLobby());
  }

  /* ── Ações ─────────────────────────────────────────────────────*/
  function _lobUiFalhar(err) {
    _lobUiTravar(false);
    _lobUiMsg((err && err.message) || 'Algo deu errado. Tente de novo em instantes.', 'erro');
  }

  function cliLobbyCriar() {
    if (_lobUiOcupado) return;
    _lobUiMsg('Abrindo o lobby…', '');
    _lobUiTravar(true);
    window.AngatubaLobby.criar().then(function (r) {
      _lobUiTravar(false);
      _lobUiMsg('Lobby aberto! Código: ' + r.codigo, 'ok');
    }).catch(_lobUiFalhar);
  }

  function cliLobbyEntrar() {
    if (_lobUiOcupado) return;
    var inp = document.getElementById('lobby-cod-input');
    var cod = inp ? inp.value : '';
    if (!String(cod || '').trim()) { _lobUiMsg('Cole o código que te mandaram.', 'erro'); return; }
    _lobUiMsg('Entrando…', '');
    _lobUiTravar(true);
    window.AngatubaLobby.entrar(cod).then(function () {
      _lobUiTravar(false);
      _lobUiMsg('', '');
    }).catch(_lobUiFalhar);
  }

  /* Sair. O anfitrião derruba o lobby pra todo mundo (ver 5.1), então
     ele confirma antes — e a confirmação diz exatamente isso. */
  function cliLobbySair() {
    if (_lobUiOcupado) return;
    var est = window.AngatubaLobby.meuLobby();
    if (!est) { cliFecharLobby(); return; }
    var fim = function () {
      _lobUiTravar(true);
      window.AngatubaLobby.sair().then(function () {
        _lobUiTravar(false);
        _lobUiMsg('', '');
      }).catch(_lobUiFalhar);
    };
    if (!est.souAnfitriao) { fim(); return; }
    var perguntar = (typeof mlConfirmar === 'function')
      ? mlConfirmar('Encerrar o lobby?',
          'Você é o anfitrião: sair encerra o lobby pra todo mundo que está nele.',
          { okLabel: 'Encerrar', owlSrc: '/webp/owl-shy.webp' })
      : Promise.resolve(true);
    perguntar.then(function (sim) { if (sim) fim(); });
  }

  /* Copiar o código. Mesmo caminho do "copiar meu código de amigo":
     clipboard quando dá, e o código na mensagem quando o navegador
     recusa (WebView, contexto não seguro) — com 6 caracteres, dá pra
     ditar. */
  function cliLobbyCopiar() {
    var est = window.AngatubaLobby.meuLobby();
    if (!est) return;
    var cod = est.codigo;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cod)
        // Sem "manda pra galera": o botão já é "Copiar código", e o
        // recado extra era uma das linhas que poluíam a tela.
        .then(function () { _lobUiMsg('Código copiado: ' + cod, 'ok'); })
        .catch(function () { _lobUiMsg('Seu código: ' + cod, ''); });
    } else {
      _lobUiMsg('Seu código: ' + cod, '');
    }
  }

  function cliLobbyPronto() {
    var est = window.AngatubaLobby.meuLobby();
    if (!est || !_cliUser) return;
    var atual = false;
    for (var i = 0; i < est.membros.length; i++) {
      if (est.membros[i].uid === _cliUser.uid) { atual = est.membros[i].pronto; break; }
    }
    window.AngatubaLobby.definirPronto(!atual).catch(function (err) {
      _lobUiMsg((err && err.message) || 'Não deu pra marcar agora.', 'erro');
    });
  }

  function cliLobbySugerir(jogo) {
    var est = window.AngatubaLobby.meuLobby();
    if (!est) return;
    // Tocar no jogo já escolhido desmarca — é como se desfaz sem ter
    // que inventar um botão "limpar".
    var alvo = (est.jogoSugerido === jogo) ? null : jogo;
    window.AngatubaLobby.sugerirJogo(alvo).catch(function (err) {
      _lobUiMsg((err && err.message) || 'Não deu pra escolher agora.', 'erro');
    });
  }

  /* ── 5.3: começar, entrar e encerrar a partida ─────────────────
     As três chamam a API e deixam o resto acontecer pelo nó. A
     mensagem de erro vai POR TOAST além do #lobby-msg: quando
     iniciarJogo/entrarNaPartida falham, o overlay do lobby já
     fechou, e o recado escrito lá dentro ninguém veria. */
  function _lobUiFalharComToast(err) {
    _lobUiFalhar(err);
    if (typeof showToastSimples === 'function') {
      showToastSimples((err && err.message) || 'Algo deu errado. Tente de novo.', '/webp/owl-sign.webp');
    }
  }

  function cliLobbyComecar() {
    if (_lobUiOcupado) return;
    var motivo = window.AngatubaLobby.porQueNaoComecar();
    if (motivo) { _lobUiMsg(motivo, 'erro'); return; }
    _lobUiMsg('Abrindo a sala do jogo…', '');
    _lobUiTravar(true);
    window.AngatubaLobby.iniciarJogo().then(function (r) {
      _lobUiTravar(false);
      _lobUiMsg('', '');
      // Um toast só: dois empilhados no meio da abertura do jogo
      // viram ruído em cima da tela que acabou de subir.
      var recado = r.automatico
        ? '' : 'Escolha o modo e toque em "Criar sala" — a galera entra sozinha.';
      if (r.aviso) recado = r.aviso + (recado ? ' ' + recado : '');
      if (recado && typeof showToastSimples === 'function') {
        showToastSimples(recado, '/webp/owl-point.webp');
      }
    }).catch(_lobUiFalharComToast);
  }

  function cliLobbyEntrarPartida() {
    if (_lobUiOcupado) return;
    _lobUiMsg('Entrando na partida…', '');
    _lobUiTravar(true);
    window.AngatubaLobby.entrarNaPartida().then(function () {
      _lobUiTravar(false);
      _lobUiMsg('', '');
    }).catch(_lobUiFalharComToast);
  }

  function cliLobbyEncerrarPartida() {
    if (_lobUiOcupado) return;
    _lobUiTravar(true);
    window.AngatubaLobby.encerrarPartida().then(function () {
      _lobUiTravar(false);
      _lobUiMsg('Partida encerrada — escolham o próximo jogo.', 'ok');
    }).catch(_lobUiFalhar);
  }

  /* Chamar um amigo pro lobby, da fileira de jogos da lista de amigos.
     É copiar o código + um empurrão pro WhatsApp — ver o cabeçalho
     deste bloco pra por que não virou convite no banco. */
  function cliLobbyChamar(uid) {
    var est = window.AngatubaLobby.meuLobby();
    if (!est) return;
    var nomeEl = document.querySelector('.cli-amigo-item[data-amigo="' + uid + '"] .cli-amigo-nome');
    var nome = (nomeEl && nomeEl.textContent) || 'seu amigo';
    var pronto = function (copiou) {
      if (typeof showToastSimples === 'function') {
        showToastSimples(copiou
          ? 'Código ' + est.codigo + ' copiado — manda pro ' + nome + ' no Zap!'
          : 'Passe o código ' + est.codigo + ' pro ' + nome + '.', '/webp/owl-phone.webp');
      }
      _amMsg('Código do lobby: ' + est.codigo, 'ok');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(est.codigo)
        .then(function () { pronto(true); })
        .catch(function () { pronto(false); });
    } else {
      pronto(false);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     CONVIDAR AMIGO PRO LOBBY — Etapa L1
     ------------------------------------------------------------
     Até a 5.2, "chamar pro lobby" era copiar 6 caracteres e mandar
     no Zap. Funciona, mas é o único lugar do social onde a pessoa
     ainda precisa DIGITAR alguma coisa: o pedido de amizade (4.3) e
     o convite pra jogar (4.4) já chegam como card no topo com um
     botão. Aqui o lobby ganha o mesmo tratamento — com o lobby
     aberto, você vê a lista de amigos, toca "Convidar", e do outro
     lado aparece "Fulano te chamou pro lobby XXXXXX · Aceitar".
     Aceitar ENTRA no lobby. Nenhum código passa pela mão de
     ninguém.

     NÓ NOVO, e de propósito não é o gameInvites da 4.4:

       lobbyInvites/{paraUid}/{deUid} = {
         nome, codigoLobby, em, expiraEm, foto?
       }

     L2 acrescentou duas coisas a isto, sem mexer no resto:
     `foto` (opcional) no convite, pra o card do topo mostrar o rosto
     de quem chamou em vez da inicial — ele já sabia desenhar foto
     desde o P3, só não recebia nenhuma daqui; e o ramo espelho
     lobbyInvitesSent, que é o que faz o botão do remetente dizer
     "Aguardando" e oferecer cancelar (ver o bloco logo abaixo).

     São coisas diferentes e misturá-las custaria caro. O gameInvites
     carrega `jogo` + `codigo` de uma SALA DE JOGO que já existe, e a
     chave dele é `{deUid}_{jogo}` porque uma pessoa pode te chamar
     pro Truco e pro Ping Pong ao mesmo tempo. O lobby não tem jogo
     nenhum escolhido ainda, e uma pessoa só pode te chamar pro lobby
     em que ELA está — um por vez. Então a chave aqui é só o `deUid`:
     reconvidar SOBRESCREVE em vez de empilhar, e o teto da sua caixa
     é o número de amigos que você mesmo aceitou.

     REGRAS (ver database.rules.json): escrever exige `de == auth.uid`
     E `friends/{de}/{para}` — ou seja, só amigo de verdade convida,
     mesma trava do gameInvites. Ler e apagar, só o dono da caixa;
     cancelar, só quem mandou. Não existe `.read` na raiz, então
     ninguém varre as caixas do app. `expiraEm` é 12 min no cliente,
     com teto de 1h na regra (mesmo raciocínio da 4.4: teto de
     sanidade, quem filtra o velho na tela é o cliente).

     QUALQUER MEMBRO CONVIDA, não só o anfitrião. As regras pedem
     amizade entre quem manda e quem recebe, e o anfitrião não é
     necessariamente amigo dos amigos dos outros — exigir que tudo
     passasse por ele deixaria metade dos convites impossíveis sem
     ganhar segurança nenhuma (o código do lobby já circula entre
     todos os membros de qualquer jeito).

     NÃO É PUSH — igual a 4.4 e a P1: o card só chega em quem está
     com o app aberto e logado. FCM continua sendo outra etapa.

     O CÓDIGO CONTINUA VALENDO como plano B: o botão "Copiar" da tela
     e o "Chamar pro lobby" da fileira de amigos (5.2) não saíram do
     lugar. É por eles que se chama quem não é amigo aqui dentro, ou
     quem está com o app fechado.

     MIC E VOZ NÃO EXISTEM NO LOBBY. O CHAT DE TEXTO passou a
     existir na L3 (nó socialLobbies/{codigo}/chat; ver o bloco
     "CHAT DO LOBBY" mais abaixo) — voz, não.

     Funções globais (onclick do HTML gerado):
       cliLobbyConvidar(uid)
       cliLobbyConviteAceitar(deUid) / cliLobbyConviteRecusar(deUid)
       cliLobbyConviteCancelar(paraUid)   (L2)
  ══════════════════════════════════════════════════════════════ */

  var LOBCONV_RAIZ = 'lobbyInvites';
  var LOBCONV_VALIDADE_MS = 12 * 60 * 1000;   // convite de lobby vale 12 min

  /* ── Etapa L2: espelho do que EU mandei ────────────────────────
     Na L1 o botão "Convidar" virava "Convidado" só na memória da
     tela: recarregou a página, trocou de aparelho ou fechou o lobby,
     e o estado sumia — quem convidou reconvidava no escuro.

       lobbyInvitesSent/{deUid}/{paraUid} = { codigoLobby, em, expiraEm }

     É ESPELHO, não fonte: o convite de verdade continua sendo o
     lobbyInvites/{para}/{de}. A caixa alheia ninguém lê (as regras
     não dão), então a única forma honesta de o remetente saber que o
     convite ainda está de pé é ele guardar uma cópia no PRÓPRIO
     ramo, escrita no mesmo gesto do convite.

     QUEM APAGA: o remetente (cancelou, o amigo entrou, venceu) e o
     destinatário (aceitou ou recusou — ele apaga o convite dele e o
     espelho do outro, e só a chave com o próprio uid). É por isso
     que "Recusar" devolve o botão pra "Convidar" em vez de deixar
     "Aguardando" até vencer.

     As duas escritas NÃO vão num update atômico só: espelho é
     conveniência, convite é o que importa. Se o ramo novo ainda não
     tiver regra publicada, o convite precisa continuar saindo. */
  var LOBENV_RAIZ = 'lobbyInvitesSent';

  /* ── Lado de quem RECEBE: caixa de entrada ─────────────────────
     Irmã de _convObservarCaixa (4.4) e de _pedObservarGlobal (P1):
     vive enquanto a conta nomeada estiver logada, com tela aberta ou
     fechada — é isso que faz o card chegar em quem está na home. */
  var _lobConvUnsub = null;     // desliga a escuta da própria caixa
  var _lobConvUid = null;       // uid que está ouvindo
  var _lobConvLista = [];       // convites válidos em cache
  var _lobConvVistos = {};      // "de|codigo" -> true, pra só avisar do novo
  var _lobConvPrimeira = true;  // primeiro snapshot = caixa que já estava lá

  /* ── Lado de quem CONVIDA ──────────────────────────────────────
     Dois mapas, de propósito. _lobEnvMapa é o que o BANCO diz (o
     espelho da L2) e sobrevive a recarregar a página; _lobConvEnviados
     é o otimista de tela, que pinta "Aguardando" no toque e vale só
     até o snapshot do espelho chegar com a mesma chave. Sem o otimista
     o botão ficaria um instante em "Convidar" depois do toque; sem o
     do banco ele voltaria pra "Convidar" a cada recarga. */
  var _lobConvEnviados = {};    // otimista: uid -> {codigo, ate}
  var _lobEnvUnsub = null;      // desliga a escuta do próprio espelho
  var _lobEnvUid   = null;      // uid que está ouvindo
  var _lobEnvMapa  = {};        // uid -> {codigo, ate}, do banco
  var _lobEnvTimer = null;      // redesenha quando o convite mais próximo vence

  function _lobConvParar() {
    if (_lobConvUnsub) { try { _lobConvUnsub(); } catch (e) {} _lobConvUnsub = null; }
    _lobConvUid = null;
    _lobConvLista = [];
    _lobConvVistos = {};
    _lobConvEnviados = {};
    _lobConvPrimeira = true;
    _lobEnvParar();
  }

  function _lobConvObservar() {
    if (!_cliContaReal(_cliUser)) return;
    var uid = _cliUser.uid;
    if (_lobConvUid === uid) return;
    _lobConvParar();
    _lobConvUid = uid;
    var parado = false, off = function () {};
    _lobConvUnsub = function () { parado = true; off(); };
    _amigosCtx().then(function (ctx) {
      if (parado || ctx.uid !== uid) return;
      var ref = ctx.db.ref(LOBCONV_RAIZ + '/' + uid);
      var h = function (snap) { _lobConvReceber(snap.val() || {}); };
      ref.on('value', h, function () { _lobConvReceber({}); });
      off = function () { try { ref.off('value', h); } catch (e) {} };
    }).catch(function () { /* sem RTDB: o app segue igual, só não recebe convite */ });
  }

  /* Apaga um convite da PRÓPRIA caixa (aceitou, recusou ou expirou) e,
     junto, o espelho no ramo de quem mandou — é isso que faz o botão
     do outro lado voltar de "Aguardando" pra "Convidar" quando alguém
     recusa. Duas escritas soltas, não um update atômico: o convite
     precisa sair da caixa mesmo que a regra do ramo novo ainda não
     esteja publicada. */
  function _lobConvApagar(deUid) {
    if (!deUid || !_lobConvUid) return;
    _amigosCtx().then(function (ctx) {
      ctx.db.ref(LOBCONV_RAIZ + '/' + ctx.uid + '/' + deUid).remove().catch(function () {});
      ctx.db.ref(LOBENV_RAIZ + '/' + deUid + '/' + ctx.uid).remove().catch(function () {});
    }).catch(function () {});
  }

  /* Cada snapshot: descarta o que expirou (e aproveita pra apagar do
     banco — é a faxina, já que não há Cloud Function), ignora convite
     pro lobby em que eu JÁ estou, guarda em cache e abre card pro que
     é novo. A chave do "novo" leva o código junto: reconvidar reusa a
     mesma chave do nó, e sem isso o segundo convite entraria mudo. */
  function _lobConvReceber(val) {
    var agora = Date.now();
    var lista = [];
    Object.keys(val || {}).forEach(function (de) {
      var c = val[de] || {};
      var cod = _lobNormalizarCodigo(c.codigoLobby);
      if (!cod) return;
      var ate = c.expiraEm || ((c.em || agora) + LOBCONV_VALIDADE_MS);
      if (ate <= agora) { _lobConvApagar(de); return; }
      // Já estou nesse lobby (entrei pelo código, ou aceitei noutro
      // aparelho): o convite não tem mais o que oferecer.
      if (_lobCodigo === cod) { _lobConvApagar(de); return; }
      lista.push({
        de: de,
        nome: String(c.nome || 'Jogador').slice(0, CLI_NOME_MAX),
        // Foto (L2): o convite passou a carregar a photoURL de quem
        // chamou, com as mesmas travas dos nós de amizade. Convite
        // antigo, gravado antes disso, simplesmente não tem o campo e
        // cai na inicial — que era o comportamento da L1.
        foto: _amigosFotoValida(c.foto),
        codigo: cod,
        em: c.em || 0,
        expiraEm: ate
      });
    });
    lista.sort(function (a, b) { return b.em - a.em; });

    var novos = lista.filter(function (c) { return !_lobConvVistos[c.de + '|' + c.codigo]; });
    _lobConvVistos = {};
    lista.forEach(function (c) { _lobConvVistos[c.de + '|' + c.codigo] = true; });
    _lobConvLista = lista;

    // Sincroniza a pilha do topo com o nó: convite aceito, recusado ou
    // expirado (aqui ou noutro aparelho) não deixa card pra trás.
    var vivas = {};
    lista.forEach(function (c) { vivas['lobconv:' + c.de + '|' + c.codigo] = true; });
    _avisoSincronizar('lobconv:', vivas);

    var primeira = _lobConvPrimeira;
    _lobConvPrimeira = false;
    if (!novos.length) return;
    // Mesma regra dos pedidos e dos convites de jogo: abrir o app com
    // a caixa cheia mostra só o mais recente.
    (primeira ? novos.slice(0, 1) : novos.slice(0, AVISO_MAX))
      .reverse().forEach(_lobConvAviso);
  }

  /* ── Card no topo ──────────────────────────────────────────────*/
  function _lobConvAviso(c) {
    _avisoMostrar({
      chave: 'lobconv:' + c.de + '|' + c.codigo,
      tipo: 'lobby',
      nome: c.nome,
      foto: c.foto,
      owl: '/webp/owl-marching.webp',
      texto: 'te chamou pro lobby <b>' + escHTML(c.codigo) + '</b>',
      acoes: [
        { rotulo: 'Aceitar', classe: 'ok', fn: function () { cliLobbyConviteAceitar(c.de); } },
        { rotulo: 'Recusar', classe: 'no', fn: function () { cliLobbyConviteRecusar(c.de); } }
      ]
    });
  }

  function _lobConvToast(msg, owl) {
    if (typeof showToastSimples === 'function') {
      showToastSimples(msg, owl || '/webp/owl-sign.webp');
    }
  }

  /* Aceitar = entrar no lobby. Apaga o convite ANTES de entrar: ele
     cumpriu o papel, e deixá-lo na caixa daria um segundo "Aceitar"
     pra um lobby onde a pessoa já está.

     A folga de LOB_FECHAR_MS é a mesma do cliConviteEntrar (4.4):
     fechar o painel de conta dispara um history.back(), e a tela do
     lobby empilha a entrada dela logo em seguida — sem a folga, o
     popstate atrasado derrubaria a tela que acabou de abrir. Com o
     painel já fechado, é inofensiva. */
  function cliLobbyConviteAceitar(deUid) {
    var c = null;
    for (var i = 0; i < _lobConvLista.length; i++) {
      if (_lobConvLista[i].de === deUid) { c = _lobConvLista[i]; break; }
    }
    if (!c) { _lobConvToast('Esse convite não está mais valendo.'); return; }
    _lobConvApagar(deUid);
    if (Date.now() > c.expiraEm) { _lobConvToast('Esse convite expirou. Peça pra pessoa chamar de novo.'); return; }
    var codigo = c.codigo, nome = c.nome;
    cliFecharPainelConta();
    setTimeout(function () {
      window.AngatubaLobby.entrar(codigo).then(function () {
        _lobConvToast('Você entrou no lobby do ' + nome + '!', '/webp/owl-tada.webp');
        // Com o hub de jogos aberto por cima, não roubamos a tela: o
        // chip do lobby na faixa de avisos já leva pra lá num toque.
        var hub = (typeof _gamesHubAberto === 'function' && _gamesHubAberto());
        if (!hub) cliAbrirLobby();
      }).catch(function (err) {
        _lobConvToast((err && err.message) || 'Não deu pra entrar no lobby.');
      });
    }, LOB_FECHAR_MS);
  }

  function cliLobbyConviteRecusar(deUid) { _lobConvApagar(deUid); }

  /* ── Lado de quem convida: escrita no nó ───────────────────────*/
  function _lobConvErroPt(err) {
    var msg = String((err && (err.message || err.code)) || '');
    // O permission_denied aqui tem uma causa provável só: a regra pede
    // friends/{eu}/{ele}, e a amizade pode ter sido desfeita.
    if (/permission_denied/i.test(msg)) {
      return 'Não deu pra convidar. Vocês precisam ser amigos aqui no app.';
    }
    return _amigosErroPt(err);
  }

  function _lobConvEnviar(paraUid, codigo) {
    return _amigosCtx().then(function (ctx) {
      var expira = Date.now() + LOBCONV_VALIDADE_MS;
      var convite = {
        nome: cliNomeExibicao() || 'Jogador',
        codigoLobby: codigo,
        em: firebase.database.ServerValue.TIMESTAMP,
        expiraEm: expira
      };
      // Foto opcional (L2): só entra se existir e passar nas mesmas
      // travas dos nós de amizade (https e teto de tamanho). Campo
      // ausente é válido na regra — quem não tem foto grava sem ele.
      var foto = _amigosMinhaFoto();
      if (foto) convite.foto = foto;
      // A chave é o próprio remetente: reconvidar sobrescreve.
      return ctx.db.ref(LOBCONV_RAIZ + '/' + paraUid + '/' + ctx.uid).set(convite)
        .then(function () {
          // Espelho (L2), DEPOIS e à parte: se ele falhar, o convite já
          // está de pé e quem perde é só o "Aguardando" desta tela.
          ctx.db.ref(LOBENV_RAIZ + '/' + ctx.uid + '/' + paraUid).set({
            codigoLobby: codigo,
            em: firebase.database.ServerValue.TIMESTAMP,
            expiraEm: expira
          }).catch(function () {});
        });
    });
  }

  /* ── Espelho do remetente: escuta do próprio ramo ───────────────
     Vive junto com a lista de amigos do lobby (tela aberta), porque é
     só ela que usa o estado. Cada snapshot joga fora o que venceu —
     essa é a faxina do ramo, já que não há Cloud Function. */
  function _lobEnvParar() {
    if (_lobEnvUnsub) { try { _lobEnvUnsub(); } catch (e) {} _lobEnvUnsub = null; }
    if (_lobEnvTimer) { clearTimeout(_lobEnvTimer); _lobEnvTimer = null; }
    _lobEnvUid = null;
    _lobEnvMapa = {};
  }

  function _lobEnvObservar() {
    if (!_cliContaReal(_cliUser)) return;
    var uid = _cliUser.uid;
    if (_lobEnvUid === uid && _lobEnvUnsub) return;
    _lobEnvParar();
    _lobEnvUid = uid;
    var parado = false, off = function () {};
    _lobEnvUnsub = function () { parado = true; off(); };
    _amigosCtx().then(function (ctx) {
      if (parado || ctx.uid !== uid) return;
      var ref = ctx.db.ref(LOBENV_RAIZ + '/' + uid);
      var h = function (snap) { _lobEnvReceber(snap.val() || {}); };
      // Sem o ramo (regra não publicada ainda), o lobby segue igual:
      // o botão volta a ser só o otimista da L1.
      ref.on('value', h, function () { _lobEnvReceber({}); });
      off = function () { try { ref.off('value', h); } catch (e) {} };
    }).catch(function () {});
  }

  function _lobEnvApagar(paraUid) {
    if (!paraUid) return;
    if (_lobEnvMapa[paraUid]) delete _lobEnvMapa[paraUid];
    delete _lobConvEnviados[paraUid];
    _amigosCtx().then(function (ctx) {
      return ctx.db.ref(LOBENV_RAIZ + '/' + ctx.uid + '/' + paraUid).remove();
    }).catch(function () {});
  }

  function _lobEnvReceber(val) {
    var agora = Date.now();
    var mapa = {}, proximo = 0;
    Object.keys(val || {}).forEach(function (para) {
      var c = val[para] || {};
      var cod = _lobNormalizarCodigo(c.codigoLobby);
      if (!cod) return;
      var ate = c.expiraEm || ((c.em || agora) + LOBCONV_VALIDADE_MS);
      if (ate <= agora) { _lobEnvApagar(para); return; }
      mapa[para] = { codigo: cod, ate: ate };
      // O otimista cumpriu o papel: daqui pra frente quem manda é o banco.
      delete _lobConvEnviados[para];
      if (!proximo || ate < proximo) proximo = ate;
    });
    _lobEnvMapa = mapa;

    // Um despertador só, no convite que vence primeiro: sem isso o
    // botão ficaria "Aguardando" pra sempre numa tela parada.
    if (_lobEnvTimer) { clearTimeout(_lobEnvTimer); _lobEnvTimer = null; }
    if (proximo) {
      _lobEnvTimer = setTimeout(function () {
        _lobEnvTimer = null;
        _lobEnvReceber(val);
        _lobAmiRender();
      }, Math.max(1000, proximo - agora + 250));
    }
    _lobAmiRender();
  }

  /* Estado do amigo na lista "Chamar amigos": o do banco tem a
     palavra, o otimista cobre a janela entre o toque e o snapshot. */
  function _lobEnvEstado(uid, codigo) {
    var agora = Date.now();
    var e = _lobEnvMapa[uid];
    if (e && e.codigo === codigo && e.ate > agora) return e;
    var o = _lobConvEnviados[uid];
    if (o && o.codigo === codigo && o.ate > agora) return o;
    return null;
  }

  /* Cancelar o convite que EU mandei: apaga a caixa do amigo e o
     espelho. O botão volta pra "Convidar" na hora. */
  function cliLobbyConviteCancelar(uid) {
    if (!uid) return;
    delete _lobConvEnviados[uid];
    delete _lobEnvMapa[uid];
    _lobAmiRender();
    _amigosCtx().then(function (ctx) {
      ctx.db.ref(LOBCONV_RAIZ + '/' + uid + '/' + ctx.uid).remove().catch(function () {});
      ctx.db.ref(LOBENV_RAIZ + '/' + ctx.uid + '/' + uid).remove().catch(function () {});
      _lobUiMsg('Convite cancelado.', 'ok');
    }).catch(function () {});
  }

  /* ── Lista de amigos DENTRO da tela do lobby ───────────────────
     Vive só com o overlay aberto (igual à lista do painel de conta):
     são listeners de RTDB, e mantê-los com a tela fechada seria
     tráfego à toa. Quem já é membro do lobby não aparece — o lugar
     dele é a lista "Na sala", logo acima.

     PRESENÇA com atributo PRÓPRIO (`data-lobami`): a mesma pessoa
     pode estar desenhada em "Na sala" (data-lobpres) e no painel de
     conta por baixo (data-pres); três data-pres iguais fariam o
     querySelector pintar sempre o primeiro. */
  var _lobAmiUnsub = null;      // desliga o observarAmigos
  var _lobAmiLista = [];        // [{uid, nome, foto, desde}]
  var _lobAmiPres = {};         // uid -> 'online'|'away'|'offline'
  var _lobAmiPresOff = {};      // uid -> função de parar a escuta
  var _lobAmiTimer = null;      // junta redesenhos de presença

  function _lobAmiSoltarPresencas() {
    Object.keys(_lobAmiPresOff).forEach(function (uid) {
      try { _lobAmiPresOff[uid](); } catch (e) {}
    });
    _lobAmiPresOff = {};
  }

  function _lobAmiLigar() {
    if (_lobAmiUnsub || !_cliContaReal(_cliUser)) return;
    // L2: o espelho dos convites que EU mandei sobe junto — é o que
    // pinta "Aguardando" no lugar de "Convidar".
    _lobEnvObservar();
    _lobAmiUnsub = window.AngatubaAmigos.observarAmigos(function (amigos) {
      _lobAmiLista = amigos || [];
      _lobAmiRender();
    });
  }

  function _lobAmiSoltar() {
    if (_lobAmiUnsub) { try { _lobAmiUnsub(); } catch (e) {} _lobAmiUnsub = null; }
    _lobAmiSoltarPresencas();
    if (_lobAmiTimer) { clearTimeout(_lobAmiTimer); _lobAmiTimer = null; }
    _lobAmiLista = [];
    _lobAmiPres = {};
    _lobEnvParar();
  }

  // Um redesenho por rajada: ao abrir a tela chega um snapshot de
  // presença por amigo, e cada um deles pode mudar a ORDEM da lista.
  function _lobAmiRenderBreve() {
    if (_lobAmiTimer) return;
    _lobAmiTimer = setTimeout(function () { _lobAmiTimer = null; _lobAmiRender(); }, 120);
  }

  /* Uma escuta de presence/{uid} por amigo listado — o único acesso
     que as regras dão (não existe listar presence/). Solta quem saiu
     da lista e não reassina quem já está de pé. */
  function _lobAmiLigarPresencas(uids) {
    Object.keys(_lobAmiPresOff).forEach(function (uid) {
      if (uids.indexOf(uid) < 0) {
        try { _lobAmiPresOff[uid](); } catch (e) {}
        delete _lobAmiPresOff[uid];
      }
    });
    uids.forEach(function (uid) {
      if (_lobAmiPresOff[uid]) return;
      _lobAmiPresOff[uid] = window.AngatubaPresenca.observar(uid, function (p) {
        var antes = _lobAmiPres[uid] || '';
        var agora = (p && p.state) || 'offline';
        // O nome que vem da presença é o VIVO (ver 4.3): quem renomeou
        // depois de virar seu amigo aparece com o nome de hoje.
        if (p && p.nome) _amNomeVivo[uid] = String(p.nome).slice(0, CLI_NOME_MAX);
        _lobAmiPres[uid] = agora;
        var dot = document.querySelector('.cli-amigo-dot[data-lobami="' + uid + '"]');
        if (dot) {
          dot.className = 'cli-amigo-dot' + _presClasseDot(p);
          dot.title = _presRotulo(p).texto;
        }
        // Só redesenha quando a ORDEM muda (entrou ou saiu do grupo
        // "online"): o pontinho acima já resolveu o resto.
        if ((antes === 'online') !== (agora === 'online')) _lobAmiRenderBreve();
      });
    });
  }

  function _lobAmiNome(a) {
    return _amNomeVivo[a.uid] || a.nome || 'Jogador';
  }

  function _lobAmiPeso(uid) {
    var s = _lobAmiPres[uid];
    return s === 'online' ? 0 : (s === 'away' ? 1 : 2);
  }

  /* L2 — o botão agora conta a história em vez de só desligar:
     "Convidar" (ainda não chamei), "Aguardando" (convite de pé, e
     tocar cancela). "Já no lobby" não aparece aqui porque quem é
     membro sai desta lista e entra na de cima, "Na sala". A linha de
     baixo do OFFLINE continua sendo a da L1 — o convite espera. */
  function _lobAmiHtmlItem(a, convidado, cheio) {
    var nome = _lobAmiNome(a);
    var st = _lobAmiPres[a.uid] || 'offline';
    var sub = convidado
      ? (st === 'offline'
          ? 'Convite enviado — espera ele abrir o app · toque pra cancelar'
          : 'Convite enviado — aguardando resposta · toque pra cancelar')
      : ((st === 'online')
          ? 'Online agora'
          : (st === 'away' ? 'Ausente' : 'Offline — o convite espera até ele abrir o app'));
    var botao = convidado
      ? '<button type="button" class="lobby-ami-btn aguardando" ' +
          'onclick="cliLobbyConviteCancelar(\'' + escHTML(a.uid) + '\')" ' +
          'title="Cancelar o convite" data-travar="nao">' +
          '<i class="fa fa-hourglass-half"></i> Aguardando</button>'
      : '<button type="button" class="lobby-ami-btn" onclick="cliLobbyConvidar(\'' +
          escHTML(a.uid) + '\')"' + (cheio ? ' disabled data-travar="nao"' : '') + '>' +
          '<i class="fa fa-user-plus"></i> Convidar</button>';
    return '<div class="cli-amigo-item lobby-ami">' +
      _amLinhaAvatar(a.uid, nome, false, a.foto, 'lobami') +
      '<span class="cli-amigo-txt">' +
        '<span class="cli-amigo-nome">' + escHTML(nome) + '</span>' +
        '<span class="cli-amigo-sub">' + escHTML(sub) + '</span>' +
      '</span>' +
      '<span class="cli-amigo-acoes">' + botao + '</span>' +
    '</div>';
  }

  /* Pinta só o #lobby-amigos, sem passar pelo redesenho do corpo
     inteiro: a lista de amigos muda por conta própria (presença,
     convite enviado) e o resto da tela não tem por que piscar. */
  function _lobAmiRender() {
    var box = document.getElementById('lobby-amigos');
    if (!box) { _lobAmiSoltarPresencas(); return; }
    var est = window.AngatubaLobby.meuLobby();
    if (!est) { box.innerHTML = ''; _lobAmiSoltarPresencas(); return; }

    var dentro = {};
    est.membros.forEach(function (m) { dentro[m.uid] = true; });
    var fora = _lobAmiLista.filter(function (a) { return !dentro[a.uid]; });

    /* L2 — o amigo aceitou e entrou: o convite virou passado. Some da
       lista "Chamar" (já é membro, filtrado acima) e o espelho sai do
       banco aqui, senão ele ficaria vencendo sozinho por 12 min. */
    Object.keys(_lobEnvMapa).forEach(function (uid) {
      if (dentro[uid]) _lobEnvApagar(uid);
    });
    Object.keys(_lobConvEnviados).forEach(function (uid) {
      if (dentro[uid]) delete _lobConvEnviados[uid];
    });

    _lobAmiLigarPresencas(fora.map(function (a) { return a.uid; }));

    if (!_lobAmiLista.length) {
      box.innerHTML = '<p class="lobby-dica">Você ainda não tem amigos por aqui. ' +
        'Adicione pelo painel de conta e depois chame direto, sem ditar código.</p>';
      return;
    }
    if (!fora.length) {
      box.innerHTML = '<p class="lobby-dica">Todo mundo da sua lista já está aqui no lobby.</p>';
      return;
    }

    var cheio = est.membros.length >= window.AngatubaLobby.limite();
    fora.sort(function (x, y) {
      var d = _lobAmiPeso(x.uid) - _lobAmiPeso(y.uid);
      if (d) return d;
      return String(_lobAmiNome(x)).localeCompare(String(_lobAmiNome(y)));
    });

    box.innerHTML = fora.map(function (a) {
      return _lobAmiHtmlItem(a, !!_lobEnvEstado(a.uid, est.codigo), cheio);
    }).join('') +
      (cheio ? '<p class="lobby-dica">O lobby está cheio — alguém precisa sair pra caber mais gente.</p>' : '');

    // Uma ação de criar/entrar/sair pode estar em voo: os botões que
    // acabaram de nascer entram travados junto com o resto.
    if (_lobUiOcupado) _lobUiTravar(true);
  }

  /* Convidar. Pinta "Convidado" na hora e só depois espera o banco —
     se a escrita falhar, o botão volta ao que era e o erro aparece no
     #lobby-msg, que é onde a pessoa está olhando. */
  function cliLobbyConvidar(uid) {
    var est = window.AngatubaLobby.meuLobby();
    if (!est) return;
    if (est.status !== 'aberto') { _lobUiMsg('Com a partida rolando ninguém entra no lobby.', 'erro'); return; }
    if (est.membros.length >= window.AngatubaLobby.limite()) {
      _lobUiMsg('O lobby está cheio (' + window.AngatubaLobby.limite() + ' pessoas).', 'erro');
      return;
    }
    var nome = 'seu amigo';
    for (var i = 0; i < _lobAmiLista.length; i++) {
      if (_lobAmiLista[i].uid === uid) { nome = _lobAmiNome(_lobAmiLista[i]); break; }
    }
    _lobConvEnviados[uid] = { codigo: est.codigo, ate: Date.now() + LOBCONV_VALIDADE_MS };
    _lobAmiRender();
    _lobConvEnviar(uid, est.codigo).then(function () {
      _lobUiMsg('Convite enviado pro ' + nome + ' — ele aceita e cai aqui.', 'ok');
    }).catch(function (err) {
      delete _lobConvEnviados[uid];
      _lobAmiRender();
      _lobUiMsg(_lobConvErroPt(err), 'erro');
    });
  }

  window.cliLobbyConvidar        = cliLobbyConvidar;
  window.cliLobbyConviteAceitar  = cliLobbyConviteAceitar;
  window.cliLobbyConviteRecusar  = cliLobbyConviteRecusar;
  window.cliLobbyConviteCancelar = cliLobbyConviteCancelar;

  window.cliAbrirLobby   = cliAbrirLobby;
  window.cliFecharLobby  = cliFecharLobby;
  window.cliLobbyCriar   = cliLobbyCriar;
  window.cliLobbyEntrar  = cliLobbyEntrar;
  window.cliLobbySair    = cliLobbySair;
  window.cliLobbyCopiar  = cliLobbyCopiar;
  window.cliLobbyPronto  = cliLobbyPronto;
  window.cliLobbySugerir = cliLobbySugerir;
  window.cliLobbyChamar  = cliLobbyChamar;
  window.cliLobbyComecar         = cliLobbyComecar;
  window.cliLobbyEntrarPartida   = cliLobbyEntrarPartida;
  window.cliLobbyEncerrarPartida = cliLobbyEncerrarPartida;

  // L3 — chat e o estado do "Chamar amigos" (onclick/oninput do HTML gerado).
  window.cliLobbyChatEnviar   = cliLobbyChatEnviar;
  window.cliLobbyChatRascunho = function (v) { _lobChatRascunho = String(v == null ? '' : v); };
  window.cliLobbyChamarAberto = function (on) { _lobChamarAberto = !!on; };

  /* ══════════════════════════════════════════════════════════════
     PUSH NOTIFICATIONS (FCM) — Preparação
     ------------------------------------------------------------
     Só o token: pedir permissão, obter o token do navegador e
     guardá-lo em fcmTokens/{uid}/{tokenId} (ver database.rules.json).
     O ENVIO real (uma Cloud Function escutando gameInvites/
     lobbyInvites e chamando a Admin SDK) é etapa futura — aqui o
     convite/pedido só chega em quem está com o app aberto e logado,
     exatamente como hoje. Isto prepara o terreno pra quando o envio
     existir: o Service Worker já sabe mostrar a notificação em
     segundo plano e abrir o app no lugar certo ao clicar nela (ver
     service-worker.js).

     PENDÊNCIA MANUAL: FCM_VAPID_KEY abaixo precisa da chave pública
     gerada no console do Firebase (Project Settings → Cloud
     Messaging → Web Push certificates → gerar par, se ainda não
     existir um). Enquanto ficar vazia, _fcmObterToken desiste cedo
     e o app segue normal — só não grava token nenhum. Mesma
     disciplina da databaseURL vazia lá em cima.

     Nó no RTDB:
       fcmTokens/{uid}/{tokenId} = { token, criadoEm }
     $tokenId é gerado por push() aqui no cliente — o token cru tem
     caracteres que o RTDB não aceita como chave. Um token novo
     (rotação) grava numa chave NOVA e apaga a antiga; nunca
     sobrescreve, pra rotação nunca parecer "continua o mesmo".

     NÃO AGRESSIVO — como o pedido de permissão é decidido: liga
     3s após o login nomeado (depois de presença/amigos/convites/
     lobby já terem assentado, mesma disciplina dos outros timers
     abaixo do onAuthStateChanged), só entra em cena se
     Notification.permission ainda for 'default' (nunca insiste
     depois de 'denied', e não pede de novo se já for 'granted'), e
     aparece como um CARD dispensável na mesma pilha de avisos do
     topo — nunca chama Notification.requestPermission() sozinho: só
     quando a pessoa toca "Ativar". Dispensado (X, "Agora não", ou
     nem tocado — o card some sozinho como os outros) => não pergunta
     de novo por 7 dias (FCM_ASK_COOLDOWN_MS, mesmo prazo do banner
     de instalar o PWA).

     API pública (window.AngatubaFCM):
       disponivel()   -> bool, se o navegador suporta Notification/SW/Push
       permissao()    -> 'default' | 'granted' | 'denied' | 'unsupported'
       ativar()       -> pede permissão agora (chamado pelo botão do card;
                          pode ser chamado à mão de outro lugar também)
       tokenAtual()   -> o token gravado nesta sessão, ou null
  ══════════════════════════════════════════════════════════════ */

  // Chave pública VAPID (Project Settings → Cloud Messaging → Web Push
  // certificates, console do Firebase). Pública por design, igual ao
  // resto do _fbConfig lá em cima.
  var FCM_VAPID_KEY = 'BOdWtmORdRrXsyYMuVNlXIxgRxJYx-tXfJeDJrfR2g8q988ISKPonUWkk1IYzgtvWkbzHqlZSIN2kpy7S3kU81I';

  var FCM_TOKEN_KEY        = 'angatuba_fcm_token_v1';  // cache local: {uid, tokenId, token}
  var FCM_ASK_KEY           = 'angatuba_fcm_pedir_em';  // timestamp do último card mostrado/dispensado
  var FCM_ASK_COOLDOWN_MS   = 7 * 24 * 60 * 60 * 1000;  // 7 dias — mesmo prazo do banner de instalar

  var _fcmMsg           = null;  // instância do firebase.messaging(), cacheada
  var _fcmTokenObtendo  = false; // evita duas corridas de getToken em paralelo
  var _fcmOnMessageLigado = false;

  function _fcmSuportado() {
    return typeof Notification !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof window.PushManager !== 'undefined';
  }

  function _fcmMsgObter() {
    if (_fcmMsg) return _fcmMsg;
    if (typeof firebase === 'undefined' || !firebase.messaging) return null;
    try { _fcmMsg = firebase.messaging(); } catch (e) { _fcmMsg = null; }
    return _fcmMsg;
  }

  // A registration do SW já vem pronta (ver var _swRegistration lá em
  // cima, perto do navigator.serviceWorker.register); se por algum
  // motivo o boot ainda não terminou de registrar, espera o 'ready'.
  function _swRegistrationObter() {
    if (_swRegistration) return Promise.resolve(_swRegistration);
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.ready.then(function (reg) {
      _swRegistration = reg;
      return reg;
    }).catch(function () { return null; });
  }

  function _fcmLerCache() {
    try { return JSON.parse(localStorage.getItem(FCM_TOKEN_KEY) || 'null'); } catch (e) { return null; }
  }
  function _fcmGravarCache(o) {
    try { localStorage.setItem(FCM_TOKEN_KEY, JSON.stringify(o)); } catch (e) {}
  }

  // Grava o token em fcmTokens/{uid}/{tokenId} (chave nova por
  // push()) e, se havia um token ANTERIOR desta mesma conta neste
  // aparelho, apaga a entrada velha — best-effort: se a conta trocou
  // no meio do caminho, não há mais permissão pra apagar o ramo
  // alheio mesmo, então nem tenta.
  function _fcmSalvarToken(uid, token) {
    var db = _presDb();
    if (!db) return;
    var cache = _fcmLerCache();
    if (cache && cache.uid === uid && cache.token === token && cache.tokenId) return; // nada mudou
    var novaRef = db.ref('fcmTokens/' + uid).push();
    var tokenId = novaRef.key;
    novaRef.set({ token: token, criadoEm: firebase.database.ServerValue.TIMESTAMP }).then(function () {
      if (cache && cache.uid === uid && cache.tokenId && cache.tokenId !== tokenId) {
        try { db.ref('fcmTokens/' + uid + '/' + cache.tokenId).remove().catch(function () {}); } catch (e) {}
      }
      _fcmGravarCache({ uid: uid, tokenId: tokenId, token: token });
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.warn('[FCM] salvar token falhou:', err && err.message);
    });
  }

  // Mensagem chegando com o app em PRIMEIRO plano: o Messaging não
  // mostra notificação de sistema sozinho nesse caso (quem faz isso
  // em segundo plano é o onBackgroundMessage do service-worker.js) —
  // aqui só um toast, reaproveitando o que já existe.
  function _fcmOnMessageLigar() {
    if (_fcmOnMessageLigado) return;
    var msg = _fcmMsgObter();
    if (!msg || typeof msg.onMessage !== 'function') return;
    _fcmOnMessageLigado = true;
    try {
      msg.onMessage(function (payload) {
        var n = (payload && payload.notification) || {};
        _uiSom('notificacao');
        if (typeof showToastSimples === 'function') {
          showToastSimples(n.title ? (n.body ? n.title + ' — ' + n.body : n.title) : 'Nova notificação.', '/webp/owl-wave.webp');
        }
      });
    } catch (e) {}
  }

  // Carrega o SDK (Messaging + Database, em paralelo) e a registration
  // do SW, arma o SW customizado no Messaging e pede o token.
  function _fcmObterToken() {
    if (!_cliContaReal(_cliUser) || _fcmTokenObtendo) return;
    if (!FCM_VAPID_KEY) return; // pendência manual — ver comentário do bloco
    var uid = _cliUser.uid;
    _fcmTokenObtendo = true;
    Promise.all([_carregarFirebaseMessaging(), _carregarFirebaseDb(), _swRegistrationObter()])
      .then(function (r) {
        var reg = r[2];
        var msg = _fcmMsgObter();
        if (!msg) throw new Error('Messaging indisponível.');
        if (reg && typeof msg.useServiceWorker === 'function') {
          try { msg.useServiceWorker(reg); } catch (e) {}
        }
        return msg.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: reg || undefined });
      })
      .then(function (token) {
        _fcmTokenObtendo = false;
        if (!token || !_cliContaReal(_cliUser) || _cliUser.uid !== uid) return;
        _fcmSalvarToken(uid, token);
        _fcmOnMessageLigar();
      })
      .catch(function (err) {
        _fcmTokenObtendo = false;
        if (typeof DEBUG !== 'undefined' && DEBUG) console.warn('[FCM] getToken falhou:', err && err.message);
      });
  }

  function _fcmPedirPermissao() {
    if (!_fcmSuportado()) return;
    try {
      Notification.requestPermission().then(function (perm) {
        if (perm === 'granted') _fcmObterToken();
        // 'denied' ou fechou sem escolher: o navegador já lembra a
        // escolha pra esta origem — insistir de novo só irrita.
      }).catch(function () {});
    } catch (e) {}
  }

  function _fcmPodePerguntar() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return false;
    try {
      var t = parseInt(localStorage.getItem(FCM_ASK_KEY) || '0', 10);
      return !t || (Date.now() - t) > FCM_ASK_COOLDOWN_MS;
    } catch (e) { return true; }
  }

  // Marca "perguntado agora" no instante em que o CARD aparece, não só
  // quando a pessoa toca "Agora não" — senão dispensar pelo X (que o
  // handler genérico do aviso trata sem chamar nenhuma ação) deixaria
  // o card voltando no próximo login, o que é exatamente o "agressivo"
  // que essa etapa pediu pra evitar.
  function _fcmMostrarPedido() {
    if (!_fcmSuportado() || !_fcmPodePerguntar()) return;
    try { localStorage.setItem(FCM_ASK_KEY, String(Date.now())); } catch (e) {}
    _avisoMostrar({
      chave: 'fcm:pedir',
      nome: 'AngatubaON',
      avatar: '/webp/owl-wave.webp',
      texto: 'Ativar avisos de convite e amigo mesmo com o app fechado?',
      acoes: [
        { rotulo: 'Ativar',    classe: 'ok', fn: _fcmPedirPermissao },
        { rotulo: 'Agora não', classe: 'no', fn: function () {} }
      ]
    });
  }

  // Chamado 3s após o login nomeado (ver onAuthStateChanged). Só
  // decide alguma coisa se o navegador ainda não tiver uma resposta —
  // 'granted' busca o token direto, sem card; 'denied' não faz nada.
  function _fcmIniciar() {
    if (!_cliContaReal(_cliUser) || !_fcmSuportado()) return;
    if (Notification.permission === 'granted') _fcmObterToken();
    else if (Notification.permission === 'default') _fcmMostrarPedido();
  }

  // Chamado no cliSair (antes do signOut) e no onAuthStateChanged
  // quando a sessão cai por qualquer outro motivo — mesma disciplina
  // da presença: apagar ANTES do token morrer, senão a regra recusa.
  function _fcmParar() {
    var cache = _fcmLerCache();
    if (cache && _cliContaReal(_cliUser) && _cliUser.uid === cache.uid && cache.tokenId) {
      var db = _presDb();
      if (db) {
        try { db.ref('fcmTokens/' + cache.uid + '/' + cache.tokenId).remove().catch(function () {}); } catch (e) {}
      }
    }
    try { localStorage.removeItem(FCM_TOKEN_KEY); } catch (e) {}
    _fcmTokenObtendo = false;
  }

  window.AngatubaFCM = {
    disponivel: _fcmSuportado,
    permissao: function () { return _fcmSuportado() ? Notification.permission : 'unsupported'; },
    ativar: _fcmPedirPermissao,
    tokenAtual: function () { var c = _fcmLerCache(); return c ? c.token : null; }
  };
