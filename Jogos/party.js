/* ═══════════════════════════════════════════════════════════════
   CORUJA PARTY — modo 2-4 jogadores (estilo Mario Party / Machine
   Party), lazy-loaded a partir de /Jogos/party.js quando o usuário
   abre o card "Coruja Party" no hub.
   ------------------------------------------------------------
   POR QUE NÃO REUTILIZA window.AngatubaMP (Jogos/multiplayer.js)?
   AngatubaMP é sinalização WebRTC pensada pra EXATAMENTE 2 pares
   (campos fixos "anfitriao"/"convidado", 1 canal de dados 1x1) — é a
   base do Ping Pong e da Batalha de Tanques. Coruja Party precisa de
   até 4 jogadores trocando pouquíssima informação (placar, "qual
   minigame agora", resultado final de cada rodada) — não dá pra
   encaixar isso num par WebRTC sem malabarismo (mesh de N conexões).
   Por isso este módulo fala DIRETO com o Firebase Realtime Database
   (o mesmo banco usado pela sinalização do multiplayer.js) como o
   próprio meio de sincronização — sem WebRTC nenhum. Isso combina
   com o pedido do produto: nada de sincronização frame-a-frame, o
   anfitrião é a fonte da verdade de "próximo jogo + seed + início da
   rodada", e cada aparelho só reporta o resultado final da rodada.
   Reaproveita, sim, os PADRÕES do multiplayer.js: código de sala de
   4 letras, sala pública com espelho leve em .../Publicas, identidade
   anônima via Firebase Auth, expiração automática (onDisconnect).
   Ver claude/database.rules.json (nó "salasParty") pras regras.

   POOL DE MINIGAMES (bloco 1 — estrutura + Puff):
   Cada rodada, o anfitrião sorteia um minigame da POOL abaixo. Dois
   tipos de adaptador:
     - "tela": reaproveita um jogo solo já existente (Pega a Coruja,
       Sequência, Piano), abrindo a tela normal dele e chamando
       comecar() direto — sem passar pela tela de menu solo. O jogo
       PRECISA ter o pulo de gato: ao chegar no fim, checa
       window.AngatubaGames.party.ativo() e, se true, chama
       reportarResultado(score) em vez do fluxo solo normal (ver o
       comentário "Modo Coruja Party" em speedtap.js/sequencia.js/
       piano.js — são 3-4 linhas cada, o resto do jogo é intocado).
     - "container": minigames feitos JÁ pensando em Party (todos os da
       Máquina, Jogos/maquina.js — inclusive Puff e Ervilhas, com todo
       mundo na mesma cena), que recebem um <div> vazio e desenham tudo
       sozinhos (não têm tela própria em index.html).
   ROBÔS: o anfitrião pode completar a sala com robôs (ver "Robôs (CPU)"
   abaixo) — dá pra jogar a Party sozinho.
   Exposto ao app pela ponte window.AngatubaGames.party (ver app.js).

   MODOS DA SALA (o anfitrião escolhe qual jogo a Party vai rodar):
   A sala sempre foi "um minigame surpresa por rodada". Agora isso é
   UM dos modos (MODOS.minigames, o padrão — nada muda pra quem não
   mexer). O outro tipo de modo é um "módulo": um jogo em que todo
   mundo joga JUNTO, na mesma partida (o primeiro é a Hex Arena,
   Jogos/hexarena.js). O anfitrião toca no modo no lobby (campo
   salasParty/{codigo}/modo) e "Começar" leva todo mundo pro mesmo
   jogo. Pra adicionar um jogo novo: uma entrada em MODOS + um módulo
   que exponha montar(container, ctx) — ver _iniciarModoLocal e o
   ctx montado lá. O módulo conversa pela MESMA sala do RTDB, em dois
   nós genéricos que valem pra qualquer modo futuro (as regras já
   cobrem, ver database.rules.json):
     modoEstado              -> só o anfitrião grava (fonte da verdade)
     modoJogadas/{n}/{uid}   -> cada um grava a própria jogada, 1 vez
   No fim, o anfitrião chama ctx.fim(colocacoes) e a Party segue pro
   pódio de sempre (status 'campeao', revanchinha etc.).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────────── */
  var ALFABETO_CODIGO   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
  var SALA_EXPIRA_MS    = 10 * 60 * 1000; // lobby sem começar por 10min = expirada
  var MIN_JOGADORES     = 2;
  var MAX_JOGADORES     = 4;
  var TOTAL_RODADAS_PADRAO = 4;
  var PONTOS_POR_COLOCACAO = [5, 3, 2, 1]; // 1º,2º,3º,4º lugar na rodada
  var FOLGA_SEGURANCA_MS   = 20000; // além da duração estimada do minigame, antes de fechar a rodada com 0 pra quem não reportou

  /* ── Pool de minigames da Party ──────────────────────────────── */
  // "tetoSeg" (só speedtap/sequencia/piano) é um corte de segurança PRÓPRIO
  // do Party pros jogos de resistência (sem cronômetro): decorrido esse
  // tempo, a rodada termina com o score alcançado até ali (ver
  // forcarFimParty em sequencia.js/piano.js). "duracaoSeg" é só a
  // estimativa usada no timeout de segurança do host (reportar 0 se nem
  // isso responder) — por isso fica um pouco maior que o tetoSeg.
  // Cada entrada também carrega o "cartão da Máquina" que aparece antes
  // da rodada (regra de sobrevivência + controle + ícone) e um "peso" no
  // sorteio: os minigames da Máquina (estilo Machine Party) saem mais que
  // os jogos solo reaproveitados. "eliminacao": quem termina antes do
  // tempo é porque MORREU — a faixa de rivais mostra "caiu" em vez de
  // "terminou".
  // Igual ao Machine Party: as de sobrevivência não têm relógio — vão até
  // sobrar um (duracaoSeg é só o teto de segurança, ver o modo
  // 'sobrevivencia' em Jogos/maquina.js). Campo Minado e Ervilhas são de
  // objetivo (chegar na saída / limpar o prato primeiro).
  // Os jogos de tela (Pega a Coruja, Sequência, Piano) saíram da Party em
  // nov/2026: não dá pra ver todo mundo junto neles. Continuam no hub.
  var TETO_SOBREV = 150;
  function _maq(chave, nome, icone, regra, controle, peso, objetivoSeg) {
    var dur = objetivoSeg || TETO_SOBREV;
    return {
      chave: chave, modulo: 'maquina', nome: nome, duracaoSeg: dur + 3, peso: peso, eliminacao: !objetivoSeg, icone: icone,
      regra: regra, controle: controle,
      iniciar: function (seed) { return _iniciarJogoContainer('maquina', dur, seed, chave === 'ervilhas' ? 'mesa' : chave); }
    };
  }
  var POOL = [
    _maq('laminas', 'Lâminas', '🪚', 'Serras quicando pela sala. A última de pé vence.', 'Arraste o dedo', 3),
    _maq('escada', 'Escada Errada', '⬆️', 'Aperte a seta do degrau de cima. A prensa pega quem ficar pra trás.', 'Botões de seta', 3),
    _maq('piso', 'Piso Falso', '🔷', 'Na sirene, esteja num piso com o símbolo do painel. Sobra um.', 'Toque no piso', 3),
    _maq('esteira', 'A Esteira', '🔥', 'Quadro pro fogo, peça passa. 3 erros e a máquina trava.', 'Toque nos quadros', 3),
    _maq('empurra', 'Empurra-Empurra', '💥', 'A plataforma encolhe sobre o poço. Empurre os outros pra fora.', 'Arraste · botão Empurrar', 3),
    _maq('minado', 'Campo Minado', '💣', 'Chegue na saída antes da colheitadeira. O número diz quantas minas há em volta.', 'Toque no piso do lado', 3, 46),
    _maq('tunel', 'O Túnel', '🚇', 'Os pistões descem pelo túnel. Troque de faixa pra passar no vão.', 'Toque nos lados', 3),
    _maq('puff', 'Puff da Coruja', '💨', 'Antes da sirene, solte um fôlego acima da marca. Passou do limite, tosse.', 'Segure e solte', 3),
    _maq('ervilhas', 'Ervilhas da Coruja', '🫛', 'Limpe o prato primeiro. Se a Chefe olhar e você se mexer, perde o garfo.', 'Espetar e comer', 3, 60)
  ];
  // Ícones gravados dos minigames (Jogos/assets/maquina/ico-*.webp). Sem
  // mapeamento (ou se a imagem falhar) cai no emoji da POOL.
  var ICO_ARQ = { laminas: 'laminas', escada: 'escada', piso: 'piso', esteira: 'esteira', puff: 'puff',
    ervilhas: 'ervilhas', speedtap: 'sirene', sequencia: 'misterio', piano: 'prensa',
    empurra: 'empurra', minado: 'minado', tunel: 'tunel' };
  function _icoHTML(j, cls) {
    var n = j && ICO_ARQ[j.chave];
    if (!n) return _escHTML((j && (j.icone || j.emoji)) || '⚙️');
    return '<img class="' + (cls || 'pty-ico') + '" src="/Jogos/assets/maquina/ico-' + n + '.webp" alt="" width="64" height="64" draggable="false">';
  }
  // Arte do cartão (Jogos/assets/maquina/cartao-<chave>.webp); sem arte
  // própria, mostra a Máquina.
  var CARTAO_ARTE = { laminas: 1, escada: 1, piso: 1, esteira: 1, empurra: 1, minado: 1, tunel: 1, puff: 1, ervilhas: 1 };
  function _cartaoSrc(j) { return '/Jogos/assets/maquina/cartao-' + (j && CARTAO_ARTE[j.chave] ? j.chave : 'maquina') + '.webp'; }
  var APRESENTACAO_MS = 2600; // o cartão da Máquina fica sozinho na tela antes do 3-2-1
  function _poolPorChave(chave) {
    for (var i = 0; i < POOL.length; i++) if (POOL[i].chave === chave) return POOL[i];
    return null;
  }

  /* ── Modos da sala (ver cabeçalho) ───────────────────────────────
     tipo 'pool'   -> o fluxo clássico de rodadas da POOL acima.
     tipo 'modulo' -> um jogo só, com todo mundo junto. `modulo` é o
                      nome no JOGOS_EXTERNOS do hub (window._jogoLoader). */
  var MODOS = {
    // 'minigames' é o Original (chave antiga mantida pras salas abertas).
    minigames: {
      chave: 'minigames', tipo: 'pool', nome: 'Original', emoji: '🎲', min: 2, max: 4,
      desc: 'Todos os minigames da Máquina, um de cada, em ordem surpresa.'
    },
    personalizado: {
      chave: 'personalizado', tipo: 'pool', nome: 'Personalizado', emoji: '🎛️', min: 2, max: 4,
      desc: 'O anfitrião escolhe quais minigames entram. Cada um cai uma vez.'
    },
    hexarena: {
      chave: 'hexarena', tipo: 'modulo', modulo: 'hexarena', nome: 'Hex Arena', emoji: '⬡', min: 2, max: 4,
      desc: 'Todos na mesma arena: escolham onde parar e pra onde atirar sem ver os outros. A arena encolhe a cada round.'
    }
  };
  var MODO_PADRAO = 'minigames';
  var MODOS_ORDEM = ['minigames', 'personalizado', 'hexarena'];
  function _modoDaSala(sala) { return (sala && sala.modo && MODOS[sala.modo]) ? MODOS[sala.modo] : MODOS[MODO_PADRAO]; }

  /* ── Estado local ────────────────────────────────────────────── */
  var _codigo = null;          // código da sala atual (4 letras)
  var _salaRef = null;         // referência RTDB da sala atual
  var _souAnfitriao = false;
  var _meuUid = null;
  var _meuNome = null;
  var _listeners = [];         // { ref, evento, cb } abertos, pra desligar depois
  var _sala = null;            // último snapshot conhecido de salasParty/{codigo}
  var _resultadosCache = {};   // { rodada: { uid: {score} } } — espelho de resultados/
  var _rodadaEmAndamento = false; // true entre "meu minigame começou" e "eu reportei"
  var _rodadaVistaEm = -1;     // último valor de rodadaAtual já processado (evita reprocessar)
  var _timeoutSeguranca = null;
  var _ultimoJogoUsado = null; // evita repetir o mesmo minigame 2x seguidas
  var _apiAtual = null;        // módulo do minigame em andamento — sair() chama .parar() nele (ver A2.2)
  var _contagemHandle = null;  // setTimeout em andamento de _contagemRegressiva — sair() cancela (ver A2.6)
  var _modoSeedVisto = null;   // seed da partida de módulo já aberta (igual _rodadaVistaEm, pros modos)
  var _modoApi = null;         // instância do módulo rodando (ex.: Hex Arena) — _pararModo() desmonta
  var _modoListeners = [];     // escutas abertas pelo módulo — saem junto com ele, não com a sala
  var _modoEmAndamento = false;
  var _recompensaModo = null;  // moedas que o módulo pagou nesta partida (mostra no pódio)
  var _moedasSessao = 0;       // moedas pegas nos minigames desta Party (mostra no pódio)
  var _podioPagoChave = null;  // evita pagar o bônus do pódio 2x (o 'campeao' re-emite a cada snapshot)
  var _posRef = null, _posCb = null; // escuta de posicoes/{rodada} (rivais na mesma arena)
  var _posCache = {};          // { uid: { v, em } } — última posição de cada rival e quando chegou
  var _assistindo = false;     // já reportei, mas sigo vendo a arena até a rodada fechar
  var _preCarga = null, _preCargaNome = null; // minigame baixando durante a roleta
  var _botTimers = [];         // anfitrião: relógios que reportam pelos robôs (jogos de tela / segurança)

  function disponivel() {
    return typeof firebase !== 'undefined' && !!firebase.database && !!firebase.auth;
  }

  /* ── Identidade (mesmo padrão do multiplayer.js) ────────────── */
  function _garantirIdentidade() {
    return new Promise(function (resolve, reject) {
      if (typeof firebase === 'undefined' || !firebase.auth) {
        reject(new Error('Coruja Party indisponível agora.'));
        return;
      }
      var auth = firebase.auth();
      var atual = auth.currentUser;
      if (atual) {
        var apelido = (window.AngatubaGames && window.AngatubaGames.apelido && window.AngatubaGames.apelido());
        resolve({ uid: atual.uid, nome: (apelido || atual.displayName || 'Jogador').slice(0, 20) });
        return;
      }
      auth.signInAnonymously()
        .then(function (cred) { resolve({ uid: cred.user.uid, nome: 'Jogador' }); })
        .catch(function () { reject(new Error('Não foi possível entrar pra jogar. Tente de novo.')); });
    });
  }

  function _db() {
    if (typeof firebase === 'undefined' || !firebase.database) return null;
    try { return firebase.database(); } catch (e) { return null; }
  }
  // Posições dos rivais ficam FORA da sala (posParty/{codigo}) — ver
  // _redeDaRodada e a regra em database.rules.json.
  function _posRaiz() { return _db().ref('posParty/' + _codigo); }
  function _limparPosicoes() {
    if (!_souAnfitriao || !_codigo) return;
    try { _posRaiz().remove().catch(function () {}); } catch (e) {}
  }

  /* ── Visual da coruja ("Monte sua coruja") ───────────────────────
     Cor da pena e skin (roupa completa) são itens da Loja da Coruja
     (slots pty_cor / pty_skin, hub.js). Vão pra sala como texto
     "cor|skin" em jogadores/{uid}/visual, e cada celular desenha os
     outros assim (ver SKINS em Jogos/maquina.js). */
  var SLOTS_VISUAL = ['pty_cor', 'pty_skin'];
  function _meuVisual() {
    var G = window.AngatubaGames;
    if (!G || typeof G.equipado !== 'function' || typeof G.lojaCatalogo !== 'function') return 'classica|';
    var cat = G.lojaCatalogo() || [];
    return SLOTS_VISUAL.map(function (slot) {
      var id = G.equipado(slot), it = null;
      for (var i = 0; i < cat.length; i++) if (cat[i].id === id) { it = cat[i]; break; }
      return (it && it.valor) || (slot === 'pty_cor' ? 'classica' : '');
    }).join('|');
  }
  // Mudou a coruja com a sala aberta: os outros veem na hora.
  function atualizarVisual() {
    if (!_salaRef || !_meuUid || !_sala || !(_sala.jogadores || {})[_meuUid]) return;
    _salaRef.child('jogadores/' + _meuUid + '/visual').set(_meuVisual()).catch(function () {});
  }
  // "Pronto!" no lobby. Quando todo mundo está pronto, a Party começa
  // sozinha depois de 5 s (ver _lobbyContagem na UI).
  function marcarPronto(v) {
    if (!_salaRef || !_meuUid || !_sala || _sala.status !== 'lobby') return;
    _salaRef.child('jogadores/' + _meuUid + '/pronto').set(!!v).catch(function () {});
  }
  // Todos prontos? (robô sempre está). Devolve false se falta gente.
  function _todosProntos(sala) {
    var jog = (sala && sala.jogadores) || {}, uids = Object.keys(jog), modo = _modoDaSala(sala);
    var humanos = uids.filter(function (u) { return !_ehBot(u); });
    var min = Math.max(MIN_JOGADORES, modo.min || 0);
    if ((modo.tipo === 'pool' ? uids.length : humanos.length) < min || !humanos.length) return false;
    if (modo.chave === 'personalizado' && _selecaoDaSala(sala).length < 2) return false;
    return humanos.every(function (u) { return jog[u].pronto === true; });
  }

  /* ── Robôs (CPU) ──────────────────────────────────────────────────
     Completam a sala quando falta gente (e deixam testar sozinho). Ficam
     em jogadores/bot-N com bot:true e quem joga por eles é o ANFITRIÃO:
     nos minigames da Máquina o motor (Jogos/maquina.js) simula cada robô
     na mesma armadilha e manda a posição dele pelo mesmo canal dos
     rivais (os outros celulares veem o robô como mais um jogador); nos
     jogos de tela (Pega a Coruja, Sequência, Piano) o anfitrião sorteia
     uma pontuação plausível. Só no modo de minigames — os módulos (Hex
     Arena) são só entre gente. */
  var BOT_NOMES = ['Robô Bolt', 'Robô Faísca', 'Robô Parafuso'];
  function _ehBot(uid) { return /^bot-/.test(String(uid || '')); }
  // Nome que cabe na arena e na faixa de rivais ("Robô Parafuso" → "Parafuso").
  function _nomeCurto(uid, nome) {
    nome = String(nome || (_ehBot(uid) ? 'Robô' : 'Jogador'));
    return (_ehBot(uid) ? nome.replace(/^Robô\s+/, '') : nome).slice(0, 10);
  }
  function _botsDaSala(sala) {
    return Object.keys((sala && sala.jogadores) || {}).filter(_ehBot).sort();
  }
  function _humanosDaSala(sala) {
    return Object.keys((sala && sala.jogadores) || {}).filter(function (u) { return !_ehBot(u); });
  }
  function adicionarRobo() {
    if (!_souAnfitriao || !_salaRef || !_sala || _sala.status !== 'lobby') return;
    if (_modoDaSala(_sala).tipo !== 'pool') return;
    var jog = _sala.jogadores || {};
    if (Object.keys(jog).length >= MAX_JOGADORES) return;
    for (var i = 1; i <= BOT_NOMES.length; i++) {
      var id = 'bot-' + i;
      if (jog[id]) continue;
      _salaRef.child('jogadores/' + id).set({
        nome: BOT_NOMES[i - 1], entrouEm: firebase.database.ServerValue.TIMESTAMP, pontosTotal: 0, bot: true,
        pronto: true, visual: _visualSorteado()
      }).catch(function () {});
      return;
    }
  }
  // Robô ganha um visual sorteado (cor + uma skin que já tenha arte).
  function _visualSorteado() {
    var MQ = window.MaquinaGame, V = MQ && MQ.visual, pega = function (l) { return l[Math.floor(Math.random() * l.length)]; };
    if (!V) return pega(['azul', 'vermelha', 'verde', 'roxa', 'laranja', 'rosa']) + '|';
    var skins = V.skins();
    return pega(V.cores.filter(function (c) { return c !== 'classica'; })) + '|' + (skins.length && Math.random() < 0.8 ? pega(skins) : '');
  }
  function removerRobo(uid) {
    if (!_souAnfitriao || !_salaRef || !_ehBot(uid)) return;
    _salaRef.child('jogadores/' + uid).remove().catch(function () {});
  }
  // Gente nova entrou numa sala cheia de robôs: sai o último robô.
  function _anfitriaoAjustarRobos(sala) {
    if (!_souAnfitriao || !sala || sala.status !== 'lobby') return;
    var bots = _botsDaSala(sala);
    var excesso = Object.keys(sala.jogadores || {}).length - MAX_JOGADORES;
    for (var i = 0; i < excesso && i < bots.length; i++) removerRobo(bots[bots.length - 1 - i]);
  }
  function _botReportar(uid, score, rodada) {
    if (!_souAnfitriao || !_salaRef || !_sala || _sala.status !== 'rodada') return;
    if (rodada != null && rodada !== _sala.rodadaAtual) return;
    var r = _sala.rodadaAtual;
    if (_resultadosCache[r] && _resultadosCache[r][uid]) return;
    _salaRef.child('resultados/' + r + '/' + uid).set({
      score: Math.max(0, Math.min(19999, Math.round(Number(score) || 0))),
      enviadoEm: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () {});
  }
  function _pararBotTimers() { _botTimers.forEach(clearTimeout); _botTimers = []; }
  // Anfitrião, começo da rodada: jogos de tela sorteiam a pontuação do
  // robô; em qualquer jogo, um corte de segurança reporta 0 pelo robô que
  // ainda não tiver resultado (o motor caiu, a aba dormiu…).
  function _botsRodada(entry, sala) {
    _pararBotTimers();
    if (!_souAnfitriao) return;
    var bots = _botsDaSala(sala);
    if (!bots.length) return;
    var rodada = sala.rodadaAtual;
    if (entry && entry.botFaixa) {
      bots.forEach(function (uid) {
        var f = entry.botFaixa, sc = f[0] + Math.random() * (f[1] - f[0]);
        var ate = (entry.botAte || entry.duracaoSeg || 30) * (0.45 + Math.random() * 0.5);
        _botTimers.push(setTimeout(function () { _botReportar(uid, sc, rodada); }, (APRESENTACAO_MS + 3200) + ate * 1000));
      });
    }
    var limite = APRESENTACAO_MS + 3200 + ((entry && entry.duracaoSeg) || 30) * 1000 + FOLGA_SEGURANCA_MS;
    _botTimers.push(setTimeout(function () {
      bots.forEach(function (uid) { _botReportar(uid, 0, rodada); });
    }, limite));
  }

  function _codigoAleatorio() {
    var c = '';
    for (var i = 0; i < 4; i++) c += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
    return c;
  }

  function _escutar(ref, evento, cb) {
    ref.on(evento, cb);
    _listeners.push({ ref: ref, evento: evento, cb: cb });
  }
  function _pararListeners() {
    _listeners.forEach(function (l) { try { l.ref.off(l.evento, l.cb); } catch (e) {} });
    _listeners = [];
  }

  /* ── Criar sala ──────────────────────────────────────────────── */
  function criarSala(publica) {
    if (!disponivel()) return Promise.reject(new Error('Coruja Party indisponível neste navegador.'));
    return _garantirIdentidade().then(function (eu) {
      _meuUid = eu.uid; _meuNome = eu.nome;
      var db = _db();
      if (!db) return Promise.reject(new Error('Coruja Party indisponível agora.'));
      return _tentarCriar(db, eu, !!publica, 0);
    });
  }

  function _tentarCriar(db, eu, publica, tentativa) {
    if (tentativa >= 5) return Promise.reject(new Error('Não consegui abrir uma sala. Tente de novo.'));
    var codigo = _codigoAleatorio();
    var ref = db.ref('salasParty/' + codigo);
    return ref.get().then(function (snap) {
      if (snap.exists()) return _tentarCriar(db, eu, publica, tentativa + 1);

      return ref.set({
        anfitriao: { uid: eu.uid, nome: eu.nome },
        publica: publica,
        criadoEm: firebase.database.ServerValue.TIMESTAMP,
        status: 'lobby',
        rodadaAtual: 0
      }).then(function () {
        return ref.child('jogadores/' + eu.uid).set({
          nome: eu.nome, entrouEm: firebase.database.ServerValue.TIMESTAMP, pontosTotal: 0, pronto: false, visual: _meuVisual()
        });
      }).then(function () {
        _codigo = codigo; _salaRef = ref; _souAnfitriao = true;
        // Sala sem ninguém a mais entrar / anfitrião cair = some sozinha.
        ref.onDisconnect().remove();
        _posRaiz().onDisconnect().remove();

        if (publica) {
          var refPublica = db.ref('salasPartyPublicas/' + codigo);
          refPublica.set({ nome: eu.nome, criadoEm: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
          refPublica.onDisconnect().remove();
        }
        _observarSala();
        return codigo;
      });
    });
  }

  /* ── Entrar em sala existente ────────────────────────────────── */
  function entrarSala(codigoBruto) {
    if (!disponivel()) return Promise.reject(new Error('Coruja Party indisponível neste navegador.'));
    var codigo = String(codigoBruto || '').trim().toUpperCase();
    if (!codigo) return Promise.reject(new Error('Digite o código da sala.'));

    return _garantirIdentidade().then(function (eu) {
      _meuUid = eu.uid; _meuNome = eu.nome;
      var db = _db();
      if (!db) return Promise.reject(new Error('Coruja Party indisponível agora.'));
      var ref = db.ref('salasParty/' + codigo);

      return ref.get().then(function (snap) {
        if (!snap.exists()) return Promise.reject(new Error('Sala não encontrada. Confira o código.'));
        var sala = snap.val();
        if (sala.status !== 'lobby') return Promise.reject(new Error('Essa Party já começou. Peça um código novo ou espere voltar ao lobby.'));
        var jogadores = sala.jogadores || {};
        // Robô não ocupa vaga de gente: o anfitrião tira um quando a sala
        // passa de 4 (ver _anfitriaoAjustarRobos).
        var qtd = Object.keys(jogadores).filter(function (u) { return !_ehBot(u); }).length;
        if (jogadores[eu.uid]) {
          // Reconexão: já era desta sala (ex.: recarregou a página).
        } else if (qtd >= MAX_JOGADORES) {
          return Promise.reject(new Error('Essa sala já está cheia (máximo 4 jogadores).'));
        }
        if (!sala.criadoEm || (Date.now() - sala.criadoEm) > SALA_EXPIRA_MS) {
          return Promise.reject(new Error('Essa sala expirou. Peça um código novo.'));
        }

        _codigo = codigo; _salaRef = ref;
        // Quem entra por código pode ser o próprio anfitrião voltando (a
        // conexão oscilou mas o onDisconnect da sala ainda não rodou).
        // Fixar false aqui apagava esse papel: ninguém mais via o botão
        // "Começar Party" e a sala travava no lobby pra sempre. Mesma
        // leitura que baralho.js/entrarSala já faz.
        _souAnfitriao = !!(sala.anfitriao && sala.anfitriao.uid === eu.uid);
        return ref.child('jogadores/' + eu.uid).set({
          nome: eu.nome, entrouEm: firebase.database.ServerValue.TIMESTAMP,
          pontosTotal: (jogadores[eu.uid] && jogadores[eu.uid].pontosTotal) || 0, pronto: false, visual: _meuVisual()
        }).then(function () {
          // Anfitrião de volta: rearma a limpeza da sala inteira nesta
          // conexão (a da sessão anterior já se foi) pra não deixar sala
          // fantasma. Convidado limpa só o próprio nó, como sempre.
          if (_souAnfitriao) { ref.onDisconnect().remove(); _posRaiz().onDisconnect().remove(); }
          else ref.child('jogadores/' + eu.uid).onDisconnect().remove();
          _observarSala();
          return codigo;
        });
      });
    });
  }

  /* ── Lista de salas públicas abertas agora ──────────────────── */
  function listarSalas(callback) {
    if (typeof callback !== 'function') callback = function () {};
    if (!disponivel()) { callback([]); return function () {}; }
    var cancelado = false;
    var desligar = function () {};
    _garantirIdentidade().then(function () {
      if (cancelado) return;
      var db = _db();
      if (!db) { callback([]); return; }
      var ref = db.ref('salasPartyPublicas');
      var handler = function (snap) {
        var lista = [];
        snap.forEach(function (filho) {
          var v = filho.val() || {};
          // Defesa extra contra sala "fantasma": se por algum motivo o
          // onDisconnect não rodou (app fechado sem desconectar limpo,
          // etc.) e a entrada ficou velha demais, não mostra na lista —
          // mesmo critério de expiração usado em entrarSala().
          if (!v.criadoEm || (Date.now() - v.criadoEm) > SALA_EXPIRA_MS) return;
          lista.push({ codigo: filho.key, nome: String(v.nome || 'Jogador').slice(0, 20) });
        });
        callback(lista);
      };
      ref.on('value', handler);
      desligar = function () { try { ref.off('value', handler); } catch (e) {} };
    }).catch(function () { callback([]); });
    return function () { cancelado = true; desligar(); };
  }

  /* ── Observação contínua da sala ─────────────────────────────── */
  function _observarSala() {
    if (!_salaRef) return;
    _escutar(_salaRef, 'value', _aoAtualizarSala);
    _escutar(_salaRef.child('resultados'), 'value', function (snap) {
      _resultadosCache = snap.val() || {};
      _emit('resultadosMudaram', _resultadosCache);
      if (_souAnfitriao) _anfitriaoChecarFechamentoRodada();
    });
  }

  function _aoAtualizarSala(snap) {
    var sala = snap.val();
    if (!sala) { _aoSalaFechada(); return; }
    _sala = sala;
    if (_reentrarNoLobbySePreciso(sala)) return; // o write dispara outro snapshot
    _emit('salaMudou', sala);

    // Voltou pro lobby (Revanchinha, 2.3): a numeração de rodada recomeça do
    // zero (ver revanche()), então o "já vi esta rodada" precisa recomeçar
    // junto. Sem isto, a SEGUNDA revanchinha da mesma sala travava: o
    // comecarParty() punha rodadaAtual = 1 de novo, _rodadaVistaEm ainda
    // valia 1 da revanche anterior, a comparação abaixo dava "igual" e o
    // minigame nunca abria — todo mundo ficava olhando o lobby.
    if (sala.status === 'lobby') { _rodadaVistaEm = -1; _modoSeedVisto = null; _recompensaModo = null; _moedasSessao = 0; _anfitriaoAjustarRobos(sala); }
    // Saiu do jogo-módulo (pódio, revanchinha): desmonta ele aqui.
    if (sala.status !== 'modo' && _modoEmAndamento) _pararModo();
    // A rodada fechou: para de ouvir as posições e desmonta a arena de quem
    // ficou assistindo (o placar vem por cima logo a seguir).
    if (sala.status !== 'rodada') {
      _pararPosicoes();
      if (_assistindo) {
        _assistindo = false;
        if (_apiAtual && typeof _apiAtual.parar === 'function') { try { _apiAtual.parar(); } catch (e) {} }
      }
    }

    if (sala.status === 'modo') {
      if (sala.seed !== _modoSeedVisto) {
        _modoSeedVisto = sala.seed;
        _iniciarModoLocal(sala);
      } else if (_modoApi && typeof _modoApi.salaMudou === 'function') {
        // Alguém saiu no meio: o módulo (anfitrião) decide o que fazer.
        try { _modoApi.salaMudou(sala); } catch (e) {}
      }
    } else if (sala.status === 'rodada' && sala.rodadaAtual !== _rodadaVistaEm) {
      _rodadaVistaEm = sala.rodadaAtual;
      _iniciarRodadaLocal(sala);
    } else if (sala.status === 'rodada' && _souAnfitriao) {
      // Rechecagem: quando um jogador cai no meio da rodada, o
      // onDisconnect() muda jogadores/{uid} e ESTA sala é notificada — mas
      // sozinho isso não fecharia a rodada, porque só o listener de
      // resultados chamava _anfitriaoChecarFechamentoRodada (ver A2.3).
      _anfitriaoChecarFechamentoRodada();
    } else if (sala.status === 'resultado') {
      _emit('resultadoRodada', sala);
    } else if (sala.status === 'campeao') {
      _emit('campeao', sala);
    }
  }

  /* Reconexão leve no lobby (P2) ────────────────────────────────────
     A rede caiu por tempo suficiente pro RTDB executar o onDisconnect
     (app no segundo plano, túnel, 4G oscilando), mas o app nunca fechou:
     quando a conexão volta, o SDK reconecta sozinho e o listener dispara
     de novo — só que agora sem a gente na lista de jogadores. Antes disso
     aqui, a pessoa ficava olhando o lobby dos outros sem aparecer nele e
     sem entender por quê. Só vale no 'lobby': com a Party em andamento,
     voltar pro meio da rodada é outro problema (não é este P2).
     Retorna true quando disparou a reentrada — o write gera um snapshot
     novo, então não vale seguir renderizando com o estado furado. */
  var _reentrando = false;
  var _tentativasReentrada = 0;
  var MAX_TENTATIVAS_REENTRADA = 3; // teto: se o write é negado, não insiste pra sempre
  function _reentrarNoLobbySePreciso(sala) {
    if (!_salaRef || !_meuUid) return false;
    if (sala.status !== 'lobby') return false;
    if (_souAnfitriao) return false;            // anfitrião sumindo = sala sumindo
    if ((sala.jogadores || {})[_meuUid]) { _tentativasReentrada = 0; return false; }
    if (_reentrando || _tentativasReentrada >= MAX_TENTATIVAS_REENTRADA) return false;
    if (Object.keys(sala.jogadores || {}).length >= MAX_JOGADORES) return false; // encheu sem mim
    _reentrando = true;
    _tentativasReentrada++;
    var ref = _salaRef.child('jogadores/' + _meuUid);
    ref.set({
      nome: _meuNome, entrouEm: firebase.database.ServerValue.TIMESTAMP, pontosTotal: 0, pronto: false, visual: _meuVisual()
    }).then(function () {
      ref.onDisconnect().remove();
    }).catch(function () {}).then(function () { _reentrando = false; });
    return true;
  }

  // A sala sumiu do RTDB (anfitrião saiu/caiu e o onDisconnect removeu,
  // ou ela expirou). P1: antes daqui só ir pra tela de erro, é preciso
  // desmontar o que estava rodando LOCALMENTE — sem isso o minigame da
  // rodada continuava com timers e countdown vivos por cima da tela de
  // aviso (mesmo problema do A2.2, mas neste caminho), e o onDisconnect
  // do próprio jogador ficava armado numa sala que não existe mais.
  function _aoSalaFechada() {
    var estavaEmPartida = !!(_sala && _sala.status && _sala.status !== 'lobby');
    _pararLocal();
    if (_salaRef) {
      try { _salaRef.onDisconnect().cancel(); } catch (e) {}
      if (_meuUid) { try { _salaRef.child('jogadores/' + _meuUid).onDisconnect().cancel(); } catch (e) {} }
    }
    _emit('salaFechada', { emAndamento: estavaEmPartida });
    _limparTudo();
  }

  /* Desmontagem só do que roda NESTE aparelho (timers, minigame em
     andamento, listeners e a classe de tela cheia). Usada tanto pelo
     sair() voluntário quanto pela queda da sala — ver _aoSalaFechada. */
  function _pararLocal() {
    _pararListeners();
    _pararPosicoes();
    _pararBotTimers();
    _assistindo = false;
    if (_timeoutSeguranca) { clearTimeout(_timeoutSeguranca); _timeoutSeguranca = null; }
    if (_contagemHandle) { clearTimeout(_contagemHandle); _contagemHandle = null; }
    _rodadaEmAndamento = false;
    // Sem isto, o minigame em andamento (Puff/Ervilhas sobretudo — os
    // outros já se auto-limpam por outros caminhos) continuava rodando
    // timers sobre uma tela já abandonada (ver A2.2).
    if (_apiAtual && typeof _apiAtual.parar === 'function') { try { _apiAtual.parar(); } catch (e) {} }
    _pararModo();
    document.body.classList.remove('angatuba-party-ativo');
  }

  /* ── Handlers (equivalente ao AngatubaMP.on) ─────────────────── */
  var _handlers = {};
  function on(evento, cb) {
    if (!_handlers[evento]) _handlers[evento] = [];
    _handlers[evento].push(cb);
  }
  function _emit(evento, dado) {
    (_handlers[evento] || []).forEach(function (cb) {
      try { cb(dado); } catch (e) { console.error('[AngatubaParty]', evento, e); }
    });
  }

  /* ── Rodada: iniciar localmente (todo mundo faz isso, cada um no
     próprio aparelho, ao ver status vira "rodada") ────────────── */
  function _iniciarRodadaLocal(sala) {
    var entry = _poolPorChave(sala.jogoAtual);
    _rodadaEmAndamento = true;
    _assistindo = false;
    // Baixa o minigame durante a roleta + 3-2-1: todo mundo larga junto
    // (sem isto, quem baixava o arquivo na hora começava atrasado e via
    // os rivais "adiantados" na arena).
    _preCarga = null; _preCargaNome = entry && entry.modulo;
    if (_preCargaNome && window._jogoLoader) {
      _preCarga = window._jogoLoader(_preCargaNome);
      _preCarga.catch(function () {});
    }
    document.body.classList.add('angatuba-party-ativo');
    _emit('countdown', { jogo: entry, sala: sala });
    _botsRodada(entry, sala);

    _apresentarEContar(function () {
      // Sair da sala durante o "3...2...1..." cancela a contagem (ver
      // sair()), mas ainda assim confere aqui: sem isto, o minigame podia
      // abrir por cima de qualquer tela em que a pessoa estivesse (A2.6).
      if (!_rodadaEmAndamento) return;
      if (!entry) { reportarResultado(0); return; }
      entry.iniciar(sala.seed).then(function (api) {
        // A sala pode ter caído enquanto o minigame carregava (P4): neste
        // ponto _pararLocal() já rodou e não teria nada pra parar, porque
        // _apiAtual ainda era null. Guarda a api pra ninguém, e desmonta o
        // que acabou de nascer.
        if (!_rodadaEmAndamento) {
          if (api && typeof api.parar === 'function') { try { api.parar(); } catch (e) {} }
          return;
        }
        _apiAtual = api;
      }).catch(function () {
        reportarResultado(0); // jogo não carregou: não trava a rodada pros outros
      });
      var limiteMs = (entry.duracaoSeg || 30) * 1000 + FOLGA_SEGURANCA_MS;
      _timeoutSeguranca = setTimeout(function () {
        if (_rodadaEmAndamento) reportarResultado(0);
      }, limiteMs);
    });
  }

  /* ── Modo "módulo": todo mundo no MESMO jogo ─────────────────────
     Mesmo compasso da rodada (3, 2, 1, Vai!), mas em vez de cada um
     abrir o próprio minigame, todos montam o módulo na arena da Party
     e ele conversa pela sala. O ctx abaixo é TUDO que o módulo vê da
     Party — nada de Firebase direto além das duas refs genéricas. */
  function _iniciarModoLocal(sala) {
    var modo = _modoDaSala(sala);
    _pararModo();
    _modoEmAndamento = true;
    _recompensaModo = null;
    _emit('countdown', { jogo: modo, sala: sala });
    _apresentarEContar(function () {
      if (!_modoEmAndamento || !_salaRef) return;
      _mostrarTelaJogo('party');
      _emit('mostrarArena');
      var seedDaPartida = sala.seed;
      window._jogoLoader(modo.modulo).then(function (api) {
        // Sala caiu / voltou pro lobby enquanto o módulo baixava.
        if (!_modoEmAndamento || !_salaRef || _modoSeedVisto !== seedDaPartida) return;
        var container = document.getElementById('pty-arena-container');
        if (!container || typeof api.montar !== 'function') throw new Error('Módulo ' + modo.modulo + ' inválido.');
        var salaRef = _salaRef;
        _modoApi = api.montar(container, {
          seed: seedDaPartida,
          meuUid: _meuUid,
          souAnfitriao: function () { return _souAnfitriao; },
          jogadores: function () {
            // Robôs só jogam os minigames; nos módulos eles nem entram.
            var j = (_sala && _sala.jogadores) || {}, o = {};
            Object.keys(j).forEach(function (u) { if (!_ehBot(u)) o[u] = j[u]; });
            return o;
          },
          estadoRef: salaRef.child('modoEstado'),
          jogadasRef: salaRef.child('modoJogadas'),
          agora: firebase.database.ServerValue.TIMESTAMP,
          escutar: function (ref, evento, cb) {
            ref.on(evento, cb);
            _modoListeners.push({ ref: ref, evento: evento, cb: cb });
          },
          fim: function (colocacoes) { _anfitriaoFimModo(colocacoes); },
          recompensa: function (qtd) { _recompensaModo = Math.max(0, Math.floor(Number(qtd) || 0)); }
        }) || null;
      }).catch(function () {
        // Módulo não carregou: avisa e deixa sair — o anfitrião ainda
        // pode voltar todo mundo pro lobby pela Revanchinha.
        _emit('salaFechada', { emAndamento: true });
      });
    });
  }

  function _pararModo() {
    _modoEmAndamento = false;
    _modoListeners.forEach(function (l) { try { l.ref.off(l.evento, l.cb); } catch (e) {} });
    _modoListeners = [];
    if (_modoApi && typeof _modoApi.parar === 'function') { try { _modoApi.parar(); } catch (e) {} }
    _modoApi = null;
  }

  /* O módulo terminou (só o anfitrião chama): colocação vira ponto
     pelo mesmo PONTOS_POR_COLOCACAO das rodadas e a Party vai pro
     pódio de sempre. Empatados no mesmo lugar ganham os mesmos pontos. */
  function _anfitriaoFimModo(colocacoes) {
    if (!_souAnfitriao || !_salaRef || !_sala || _sala.status !== 'modo') return;
    var jogadores = _sala.jogadores || {};
    var updates = { status: 'campeao' };
    Object.keys(jogadores).forEach(function (uid) {
      var c = Math.floor(Number(colocacoes && colocacoes[uid]) || 0);
      updates['jogadores/' + uid + '/pontosTotal'] = c > 0 ? (PONTOS_POR_COLOCACAO[c - 1] || 0) : 0;
    });
    _salaRef.update(updates).catch(function () {});
  }

  // Cartão da Máquina (nome + regra) sozinho na tela por um instante, e
  // só então o 3-2-1. O mesmo _contagemHandle cobre as duas esperas,
  // então sair() cancela as duas (ver A2.6).
  function _apresentarEContar(aoFim) {
    _contagemHandle = setTimeout(function () { _contagemRegressiva(3, aoFim); }, APRESENTACAO_MS);
  }

  function _contagemRegressiva(n, aoFim) {
    // Desce até n=0 (emite o "Vai!") antes de chamar aoFim — antes o
    // contador pulava de "1" direto pro jogo, sem mostrar o "Vai!"
    // que o handler de countdownTick já esperava (ver party.js/UI).
    if (n < 0) { _contagemHandle = null; aoFim(); return; }
    _emit('countdownTick', n);
    _contagemHandle = setTimeout(function () { _contagemRegressiva(n - 1, aoFim); }, n > 0 ? 800 : 500);
  }

  /* ── Mostra a tela cheia de um jogo já existente e chama comecar()
     direto (sem passar pela tela de menu solo dele). Não usa
     window._abrirJogo pra evitar corrida entre o preparar() dele e
     o nosso comecar() — ver comentário no topo do arquivo. ─────── */
  function _mostrarTelaJogo(nome) {
    var hubEl = document.getElementById('games-hub');
    if (hubEl) hubEl.classList.add('jogo-ativo');
    var menu = document.getElementById('games-menu');
    if (menu) menu.style.display = 'none';
    var telas = document.querySelectorAll('.jogo-tela');
    for (var i = 0; i < telas.length; i++) telas[i].style.display = 'none';
    var tela = document.getElementById('jogo-' + nome);
    if (tela) tela.style.display = 'block';
  }

  function _iniciarJogoTela(nome, comecarArgs, tetoSeg) {
    return window._jogoLoader(nome).then(function (api) {
      // P4: o anfitrião pode ter caído enquanto o arquivo do minigame
      // carregava. Sem esta guarda, o jogo abria em tela cheia POR CIMA do
      // aviso de "Party encerrada", com os timers dele soltos — e nada mais
      // o pararia, porque _pararLocal() já tinha rodado antes disto.
      if (!_rodadaEmAndamento) return null;
      if (typeof api.preparar === 'function') api.preparar();
      _mostrarTelaJogo(nome);
      if (typeof api.comecar === 'function') api.comecar.apply(api, comecarArgs || []);
      // Corte de segurança pros jogos de resistência (ver comentário na
      // POOL). Só dispara se a rodada ainda estiver rolando quando o
      // tempo vencer — se a pessoa já tiver errado sozinha antes disso,
      // reportarResultado já rodou e forcarFimParty vira no-op.
      if (tetoSeg && typeof api.forcarFimParty === 'function') {
        setTimeout(function () {
          if (_ativo()) { try { api.forcarFimParty(); } catch (e) {} }
        }, tetoSeg * 1000);
      }
      return api;
    });
  }

  /* ── Mostra a tela do próprio Party (arena) e deixa o minigame
     "container" desenhar tudo dentro do container que ela expõe. ── */
  function _iniciarJogoContainer(nome, duracaoSeg, seed, variante) {
    _mostrarTelaJogo('party');
    _emit('mostrarArena');
    // Reaproveita o download da roleta (o _jogoLoader resolve na hora um
    // <script> que ainda está baixando — chamar de novo quebraria).
    var rodadaDoJogo = _sala && _sala.rodadaAtual;
    var carga = (_preCarga && _preCargaNome === nome)
      ? _preCarga.catch(function () { return window._jogoLoader(nome); })
      : window._jogoLoader(nome);
    _preCarga = null;
    return carga.then(function (api) {
      // Mesma guarda do _iniciarJogoTela (P4): sala caiu durante o load,
      // não adianta montar a arena por cima da tela de aviso.
      if (!_rodadaEmAndamento) return null;
      var container = document.getElementById('pty-arena-container');
      if (!container) throw new Error('Arena da Party não encontrada.');
      if (typeof api.render !== 'function') throw new Error('Módulo ' + nome + ' não expõe render().');
      api.render(container, {
        duracaoSeg: duracaoSeg,
        // Mesma semente pra sala inteira: a armadilha sai igual em todos
        // os celulares (ver o cabeçalho de Jogos/maquina.js).
        seed: seed,
        jogo: variante,
        onMoedas: function (qtd) { _moedasSessao += Math.max(0, Math.floor(Number(qtd) || 0)); },
        rede: _redeDaRodada(),
        // Só o anfitrião simula os robôs (ver "Robôs" lá em cima).
        // Lugar fixo de cada um (ordem dos uids, igual em todo celular):
        // onde nasce nas arenas em que todo mundo começa junto.
        slot: _slotDe(_meuUid),
        visual: _meuVisual(),
        total: Object.keys((_sala && _sala.jogadores) || {}).length,
        // Quem ainda está no jogo = quem não mandou resultado (decide a
        // "última de pé" nas rodadas de sobrevivência).
        vivos: function () {
          if (!_sala || _sala.rodadaAtual !== rodadaDoJogo) return null;
          var res = _resultadosCache[rodadaDoJogo] || {};
          return Object.keys(_sala.jogadores || {}).filter(function (u) { return !res[u]; }).length;
        },
        bots: _souAnfitriao ? _botsDaSala(_sala).map(function (u) {
          return { uid: u, nome: _nomeCurto(u, _sala.jogadores[u].nome), cor: _ptyCor(_sala, u), slot: _slotDe(u), visual: _sala.jogadores[u].visual || '' };
        }) : [],
        onBotFim: function (uid, score) { _botReportar(uid, score, rodadaDoJogo); },
        onFim: function (score, assistir) { reportarResultado(score, assistir === true); }
      });
      return api;
    });
  }

  /* ── Rivais na mesma arena ─────────────────────────────────────
     Cada celular grava a própria posição em posicoes/{rodada}/{uid}
     (texto curto, ~10x por segundo — ver o motor em Jogos/maquina.js)
     e ouve a dos outros. Ninguém é dono de nada aqui: é só pra
     desenhar os rivais; quem decide a rodada continua sendo o
     resultados/ de cada um. */
  function _redeDaRodada() {
    if (!_salaRef || !_sala || !_meuUid || !_codigo) return null;
    _pararPosicoes();
    _posCache = {};
    var ref = _posRaiz().child(String(_sala.rodadaAtual));
    var minha = ref.child(_meuUid);
    var souAnf = _souAnfitriao;
    _posRef = ref;
    _posCb = function (snap) {
      var v = snap.val() || {}, agora = Date.now();
      Object.keys(v).forEach(function (u) {
        if (u === _meuUid || typeof v[u] !== 'string') return;
        var c = _posCache[u];
        if (!c || c.v !== v[u]) _posCache[u] = { v: v[u], em: agora };
      });
    };
    ref.on('value', _posCb);
    return {
      assistir: true,
      enviar: function (txt) {
        if (_posRef !== ref) return; // rodada já fechou
        minha.set(String(txt).slice(0, 60)).catch(function () {});
      },
      // Anfitrião manda a posição de cada robô que ele simula.
      enviarBot: function (uid, txt) {
        if (_posRef !== ref || !souAnf || !_ehBot(uid)) return;
        ref.child(uid).set(String(txt).slice(0, 60)).catch(function () {});
      },
      rivais: function () {
        var jog = (_sala && _sala.jogadores) || {};
        // No anfitrião os robôs vêm direto do motor (não pela rede).
        return Object.keys(jog).sort().filter(function (u) { return u !== _meuUid && _posCache[u] && !(souAnf && _ehBot(u)); }).map(function (u) {
          return { uid: u, nome: _nomeCurto(u, jog[u].nome), cor: _ptyCor(_sala, u), visual: jog[u].visual || '', v: _posCache[u].v, em: _posCache[u].em };
        });
      }
    };
  }
  function _slotDe(uid) {
    var i = Object.keys((_sala && _sala.jogadores) || {}).sort().indexOf(uid);
    return i < 0 ? 0 : i % MAX_JOGADORES;
  }
  function _pararPosicoes() {
    if (_posRef && _posCb) { try { _posRef.off('value', _posCb); } catch (e) {} }
    _posRef = null; _posCb = null;
  }

  /* ── Reportar resultado da minha rodada ──────────────────────── */
  function reportarResultado(score, ficarAssistindo) {
    if (!_rodadaEmAndamento || !_salaRef || !_sala) return;
    _rodadaEmAndamento = false;
    if (_timeoutSeguranca) { clearTimeout(_timeoutSeguranca); _timeoutSeguranca = null; }
    if (ficarAssistindo) {
      // Caiu (ou sobreviveu) mas a arena continua na tela com os rivais
      // até o anfitrião fechar a rodada — aí o placar entra por cima.
      _assistindo = true;
    } else {
      document.body.classList.remove('angatuba-party-ativo');
      _mostrarTelaJogo('party');
      _emit('aguardandoOutros', _sala.rodadaAtual);
    }

    var rodada = _sala.rodadaAtual;
    _salaRef.child('resultados/' + rodada + '/' + _meuUid).set({
      score: Math.max(0, Math.round(Number(score) || 0)),
      enviadoEm: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () {});

    if (_souAnfitriao) _anfitriaoChecarFechamentoRodada();
  }

  function _ativo() { return _rodadaEmAndamento; }

  /* ── Anfitrião: fecha a rodada quando todos reportaram (ou o
     timeout de segurança de cada um vence e reporta 0) ───────── */
  function _anfitriaoChecarFechamentoRodada() {
    if (!_souAnfitriao || !_sala || _sala.status !== 'rodada') return;
    var rodada = _sala.rodadaAtual;
    var resultados = _resultadosCache[rodada] || {};
    var jogadores = _sala.jogadores || {};
    var qtdJogadores = Object.keys(jogadores).length;
    var qtdResultados = Object.keys(resultados).length;
    if (qtdResultados < qtdJogadores) return; // ainda falta gente
    _anfitriaoFecharRodada(rodada, resultados, jogadores);
  }

  function _anfitriaoFecharRodada(rodada, resultados, jogadores) {
    var lista = [];
    Object.keys(jogadores).forEach(function (uid) {
      lista.push({ uid: uid, nome: jogadores[uid].nome, score: (resultados[uid] && resultados[uid].score) || 0 });
    });
    lista.sort(function (a, b) { return b.score - a.score; });

    var updates = {};
    var placar = {};
    lista.forEach(function (j, i) {
      // Empate (dois caíram juntos) divide o lugar e os pontos.
      var lugar = lista.filter(function (o) { return o.score > j.score; }).length;
      var pontosGanhos = PONTOS_POR_COLOCACAO[lugar] || 0;
      placar[j.uid] = { nome: j.nome, score: j.score, colocacao: lugar + 1, pontosGanhos: pontosGanhos };
      var totalAnterior = (jogadores[j.uid] && jogadores[j.uid].pontosTotal) || 0;
      updates['jogadores/' + j.uid + '/pontosTotal'] = totalAnterior + pontosGanhos;
    });
    updates['placarRodadas/' + rodada] = placar;
    updates['status'] = (rodada >= (_sala.totalRodadas || TOTAL_RODADAS_PADRAO)) ? 'campeao' : 'resultado';

    _salaRef.update(updates).catch(function () {});
  }

  /* ── Anfitrião: escolhe rodadas (lobby), começa e avança rodadas ── */
  // Personalizado: quais minigames entram (o anfitrião marca no lobby).
  function _selecaoDaSala(sala) {
    var sel = String((sala && sala.selecao) || '').split(',').filter(_poolPorChave);
    return sel.length ? sel : POOL.map(function (j) { return j.chave; });
  }
  function alternarMinigame(chave) {
    if (!_souAnfitriao || !_salaRef || !_sala || _sala.status !== 'lobby' || !_poolPorChave(chave)) return;
    var sel = _selecaoDaSala(_sala), i = sel.indexOf(chave);
    if (i >= 0) { if (sel.length <= 2) return; sel.splice(i, 1); } else sel.push(chave);
    _salaRef.child('selecao').set(sel.join(',')).catch(function () {});
  }
  function _embaralhar(arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }

  // Anfitrião escolhe o modo no lobby. Grava na sala pra todo mundo ver
  // (e pra "Começar" saber qual fluxo rodar).
  function definirModo(chave) {
    if (!_souAnfitriao || !_salaRef || !_sala || _sala.status !== 'lobby') return;
    if (!MODOS[chave]) return;
    _salaRef.child('modo').set(chave).catch(function () {});
    if (MODOS[chave].tipo !== 'pool') _botsDaSala(_sala).forEach(removerRobo);
  }

  // Sorteio com peso (ver "peso" na POOL), nunca o mesmo duas vezes seguidas.
  function _sortearProximoJogo() {
    var opcoes = POOL.filter(function (j) { return j.chave !== _ultimoJogoUsado; });
    if (!opcoes.length) opcoes = POOL;
    var total = 0;
    opcoes.forEach(function (j) { total += (j.peso || 1); });
    var r = Math.random() * total, escolhido = opcoes[opcoes.length - 1];
    for (var i = 0; i < opcoes.length; i++) { r -= (opcoes[i].peso || 1); if (r < 0) { escolhido = opcoes[i]; break; } }
    _ultimoJogoUsado = escolhido.chave;
    return escolhido.chave;
  }

  // "Começar Party": só aqui o totalRodadas é (re)calculado — fixa a linha
  // de chegada da sessão. baseRodada é 0 tanto numa sala nova quanto numa
  // revanche (que agora reseta rodadaAtual — ver A2.16 em revanche()).
  function comecarParty() {
    if (!_souAnfitriao || !_sala || !_salaRef) return;
    var qtd = Object.keys(_sala.jogadores || {}).length;
    var modo = _modoDaSala(_sala);
    // Robô conta como jogador só nos minigames (basta 1 pessoa + robôs).
    if (modo.tipo === 'modulo') qtd = _humanosDaSala(_sala).length;
    if (qtd < Math.max(MIN_JOGADORES, modo.min || 0)) return;
    if (modo.tipo === 'modulo') {
      // Um jogo só, todo mundo junto: limpa a partida anterior (se
      // houver) no mesmo update atômico que dá a largada.
      _salaRef.update({
        status: 'modo',
        modoEstado: null,
        modoJogadas: null,
        seed: Math.floor(Math.random() * 1e9),
        rodadaIniciadaEm: firebase.database.ServerValue.TIMESTAMP
      }).catch(function () {});
      _tirarDaListaPublica();
      return;
    }
    // Original: todos os minigames; Personalizado: os marcados. Cada um cai
    // UMA vez, em ordem sorteada (sala.fila) — igual ao Machine Party.
    var fila = _embaralhar(modo.chave === 'personalizado' ? _selecaoDaSala(_sala).slice() : POOL.map(function (j) { return j.chave; }));
    if (fila.length < 2) return;
    _salaRef.update({
      fila: fila.join(','),
      totalRodadas: fila.length,
      rodadaAtual: 1,
      jogoAtual: fila[0],
      seed: Math.floor(Math.random() * 1e9),
      status: 'rodada',
      rodadaIniciadaEm: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () {});
    // A Party começou: não dá mais pra entrar nela (entrarSala rejeita
    // sala fora do 'lobby'), então some do espelho público na hora —
    // senão ela ficava visível em "Parties abertas agora" com um
    // "Entrar" que sempre falhava, até o anfitrião sair de vez ou
    // desconectar (podia demorar bastante em segundo plano).
    _tirarDaListaPublica();
  }

  function _tirarDaListaPublica() {
    if (!_sala || !_sala.publica) return;
    try {
      var db = _db();
      if (db) {
        var refPublicaIniciada = db.ref('salasPartyPublicas/' + _codigo);
        refPublicaIniciada.onDisconnect().cancel();
        refPublicaIniciada.remove();
      }
    } catch (e) {}
  }

  // "Próxima rodada" (dentro da MESMA sessão): só avança rodadaAtual em 1.
  // NÃO mexe em totalRodadas — que already foi fixado no comecarParty() lá
  // em cima. (Bug corrigido: antes esta função recalculava totalRodadas =
  // rodadaAtual + N a cada rodada, o que empurrava a linha de chegada pra
  // frente pra sempre e a Party nunca terminava.)
  function proximaRodada() {
    if (!_souAnfitriao || !_sala || !_salaRef) return;
    _limparPosicoes(); // as posições da rodada anterior não servem mais pra ninguém
    var nova = (_sala.rodadaAtual || 0) + 1, fila = String(_sala.fila || '').split(',');
    _salaRef.update({
      rodadaAtual: nova,
      jogoAtual: _poolPorChave(fila[nova - 1]) ? fila[nova - 1] : _sortearProximoJogo(),
      seed: Math.floor(Math.random() * 1e9),
      status: 'rodada',
      rodadaIniciadaEm: firebase.database.ServerValue.TIMESTAMP
    }).catch(function () {});
  }

  // Revanchinha: zera o placar geral e reabre o lobby. Mesma sala, mesmo
  // código, mesma galera.
  // Fix A2.16: rodadaAtual volta a 0 (e resultados/placarRodadas somem)
  // a cada revanche — sem isto, a numeração de rodada nunca reiniciava e
  // uma sala muito usada (ex.: 25 revanches de 20 rodadas) passava do
  // teto de 500 da regra do RTDB; o update seguinte era negado em
  // silêncio e a Party simplesmente parava de começar.
  function revanche() {
    if (!_souAnfitriao || !_sala || !_salaRef) return;
    var jogadores = _sala.jogadores || {};
    var updates = { status: 'lobby', rodadaAtual: 0, resultados: null, placarRodadas: null, modoEstado: null, modoJogadas: null, fila: null };
    _limparPosicoes();
    Object.keys(jogadores).forEach(function (uid) {
      updates['jogadores/' + uid + '/pontosTotal'] = 0;
      if (!_ehBot(uid)) updates['jogadores/' + uid + '/pronto'] = false; // cada um confirma de novo
    });
    _salaRef.update(updates).catch(function () {});
  }

  /* ── Sair da sala / limpeza ───────────────────────────────────── */
  function sair() {
    _pararLocal();
    if (_salaRef) {
      try { _salaRef.onDisconnect().cancel(); } catch (e) {}
      if (_souAnfitriao) {
        // Ordem importa aqui: a regra de segurança de salasPartyPublicas
        // (database.rules.json) só deixa apagar a entrada enquanto
        // salasParty/{codigo}/anfitriao ainda existir — é ela que prova
        // pro Firebase "quem é o anfitrião" dessa sala. Apagar a sala
        // ANTES do espelho público derrubava essa prova no meio do
        // caminho: a remoção do espelho era rejeitada pela regra, em
        // silêncio (o .remove() vira uma Promise rejeitada que ninguém
        // aguardava) — a sala sumia de verdade, mas a Party ficava
        // fantasma em "Parties abertas agora" pra sempre, com um
        // "Entrar" que só dava "Sala não encontrada". Por isso o
        // espelho sai PRIMEIRO, e só then() é que apaga a sala em si.
        // Captura a ref AGORA: _limparTudo() (fim desta função) zera
        // _salaRef de forma síncrona, antes desta Promise resolver — usar
        // a variável do módulo direto dentro do then() pegaria null.
        var salaRefAoSair = _salaRef;
        try { _posRaiz().onDisconnect().cancel(); } catch (e) {}
        _limparPosicoes();
        var limparPublica = Promise.resolve();
        if (_sala && _sala.publica) {
          try {
            var db = _db();
            if (db) {
              var refPublica = db.ref('salasPartyPublicas/' + _codigo);
              refPublica.onDisconnect().cancel();
              limparPublica = refPublica.remove().catch(function () {});
            }
          } catch (e) {}
        }
        limparPublica.then(function () {
          try { salaRefAoSair.remove(); } catch (e) {}
        });
      } else if (_meuUid) {
        try {
          _salaRef.child('jogadores/' + _meuUid).onDisconnect().cancel();
          _salaRef.child('jogadores/' + _meuUid).remove();
        } catch (e) {}
      }
    }
    _limparTudo();
  }

  function _limparTudo() {
    _codigo = null; _salaRef = null; _souAnfitriao = false;
    _sala = null; _resultadosCache = {};
    _rodadaEmAndamento = false; _rodadaVistaEm = -1;
    _apiAtual = null;
    _reentrando = false; _tentativasReentrada = 0; // ver _reentrarNoLobbySePreciso
    _modoSeedVisto = null; _recompensaModo = null; _moedasSessao = 0;
    _pararBotTimers();
  }

  function estado() { return _sala; }
  function meuUid() { return _meuUid; }
  function souAnfitriao() { return _souAnfitriao; }
  function codigoSala() { return _codigo; }
  function pool() { return POOL; }
  function modos() { return MODOS; }

  window.AngatubaParty = {
    disponivel: disponivel,
    criarSala: criarSala,
    entrarSala: entrarSala,
    listarSalas: listarSalas,
    alternarMinigame: alternarMinigame,
    marcarPronto: marcarPronto,
    atualizarVisual: atualizarVisual,
    definirModo: definirModo,
    adicionarRobo: adicionarRobo,
    removerRobo: removerRobo,
    modos: modos,
    comecarParty: comecarParty,
    proximaRodada: proximaRodada,
    revanche: revanche,
    sair: sair,
    on: on,
    estado: estado,
    meuUid: meuUid,
    souAnfitriao: souAnfitriao,
    codigoSala: codigoSala,
    pool: pool,
    // Ponte usada pelos jogos da pool em modo "tela" (speedtap/
    // sequencia/piano) pra saber se estão rodando dentro de uma
    // rodada de Party e, se sim, reportar o resultado pra cá em vez
    // de seguir o fluxo solo normal. Ver window.AngatubaGames.party
    // em app.js — é só uma fachada segura sobre isto.
    ativo: _ativo,
    reportarResultado: reportarResultado,
    // Repete o último evento da sala (a UI redesenha quando a arte da
    // coruja termina de carregar).
    _reemitir: function () { if (_sala) _emit('salaMudou', _sala); }
  };

  // Controlador de UI (telas do #jogo-party) vive em party-ui.js? Não —
  // pra manter "arquivos completos, poucos arquivos novos", a UI do
  // hub/lobby/rodada/placar fica neste mesmo arquivo, na seção abaixo.
  // Ela só CONSOME a API pública acima (AngatubaParty.*) e os eventos
  // emitidos por on(...) — nenhuma função abaixo mexe em Firebase
  // direto.
  /* ═══════════════════ UI: telas do #jogo-party ═══════════════════ */

  function _q(id) { return document.getElementById(id); }
  function _mostrarSub(tela) {
    var nomes = ['menu', 'lobby', 'visual', 'countdown', 'arena', 'aguardando', 'resultado', 'campeao', 'erro'];
    nomes.forEach(function (n) {
      var el = _q('pty-' + n);
      if (el) el.style.display = (n === tela) ? 'flex' : 'none';
    });
  }
  function _erroMenu(msg) {
    var el = _q('pty-menu-erro');
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  var _pararListaSalas = null;
  var _ptyListaListenerOn = false;
  // Códigos de sala vêm sempre de _codigoAleatorio() (multiplayer.js), que só
  // usa este alfabeto de 4 caracteres. Uma chave fora desse formato não pode
  // ter vindo do fluxo normal de criarSala() — descarta em vez de renderizar.
  function _ptyCodigoValido(c) { return /^[A-Z0-9]{4}$/.test(c || ''); }

  // Catálogo da Máquina no menu: os minigames que podem cair na roleta.
  function _renderCatalogo() {
    var el = _q('pty-catalogo');
    if (!el || el.getAttribute('data-ok')) return;
    el.innerHTML = POOL.filter(function (j) { return (j.peso || 1) >= 2; }).map(function (j) {
      return '<span class="pty-cat-item">' + _icoHTML(j, 'pty-ico pty-ico-mini') + _escHTML(j.nome) + '</span>';
    }).join('');
    POOL.forEach(function (j) { var n = ICO_ARQ[j.chave]; if (n) { var im = new Image(); im.src = '/Jogos/assets/maquina/ico-' + n + '.webp'; } (new Image()).src = _cartaoSrc(j); }); // pré-carrega pra roleta não piscar
    el.setAttribute('data-ok', '1');
  }

  // A coruja de cada um é desenhada pelo motor da Máquina: baixa ele já
  // no menu (de qualquer jeito ele é o próximo a ser usado).
  var _maqPronta = false;
  function _carregarMaquina(cb) {
    if (_maqPronta && window.MaquinaGame) { if (cb) cb(); return; }
    if (!window._jogoLoader) return;
    window._jogoLoader('maquina').then(function (api) {
      if (!api || typeof api.carregarVisual !== 'function') return;
      api.carregarVisual(function () { _maqPronta = true; _ptyRedesenharCorujas(); if (cb) cb(); });
    }).catch(function () {});
  }
  function _ptyRedesenharCorujas() {
    _cenaMenu();
    var sala = window.AngatubaParty.estado();
    if (sala) window.AngatubaParty._reemitir && window.AngatubaParty._reemitir();
  }

  /* ── Cenários (arte do Gemini) com as corujas desenhadas por cima ──
     palco-lobby.webp (1024×459): 4 plataformas — centros e altura do
     piso medidos na arte. podio.webp (1024×1024): topo dos 3 pedestais.
     provador.webp (765×1024): chão no meio. */
  var CENAS = { palco: '/Jogos/assets/maquina/palco-lobby.webp', podio: '/Jogos/assets/maquina/podio.webp', provador: '/Jogos/assets/maquina/provador.webp' };
  var PALCO_X = [150, 392, 632, 872], PALCO_PE = 384;
  var _cenaImg = {};
  function _cena(nome, cb) {
    var r = _cenaImg[nome];
    if (!r) {
      r = _cenaImg[nome] = { img: new Image(), ok: false, cbs: [] };
      r.img.onload = function () { r.ok = true; r.cbs.forEach(function (f) { f(); }); r.cbs = []; };
      r.img.src = CENAS[nome];
    }
    if (r.ok) return r.img;
    if (cb && r.cbs.indexOf(cb) < 0) r.cbs.push(cb);
    return null;
  }
  // Coruja em pé com os pés em (x, pe), altura alt (em px do canvas).
  function _corujaEmPe(cv, visual, x, pe, alt, pose) {
    var MQ = window.MaquinaGame;
    if (!MQ || !_maqPronta) return;
    // na folha, a coruja ocupa ~65% da altura da célula e os pés ficam a 89%
    var cel = alt / 0.65;
    MQ.desenharCoruja(cv, visual, { manter: true, x: x, y: pe - cel * 0.39, escala: cel / Math.min(cv.width, cv.height), pose: pose });
  }
  function _luz(ctx, x, topo, base, larg, cor) {
    var g = ctx.createLinearGradient(0, topo, 0, base);
    g.addColorStop(0, 'rgba(' + cor + ',0)'); g.addColorStop(1, 'rgba(' + cor + ',.32)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 26, topo); ctx.lineTo(x + 26, topo); ctx.lineTo(x + larg, base); ctx.lineTo(x - larg, base); ctx.closePath(); ctx.fill();
  }
  function _rotuloCena(ctx, txt, x, y, cor, tam) {
    ctx.font = '800 ' + (tam || 24) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(txt, x, y);
    ctx.fillStyle = cor; ctx.fillText(txt, x, y);
  }
  // Menu: a sua coruja no meio do palco, na frente do olho da Máquina.
  var _menuAnim = null;
  function _cenaMenu() {
    var cv = _q('pty-menu-palco');
    if (!cv) return;
    if (_menuAnim) { clearTimeout(_menuAnim); _menuAnim = null; }
    // recorte do meio do palco (o olho da Máquina) cobrindo a altura toda
    var ctx = cv.getContext('2d'), img = _cena('palco', _cenaMenu), W = cv.width, H = cv.height, k = H / 459;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    if (img) ctx.drawImage(img, (W - 1024 * k) / 2, 0, 1024 * k, H);
    _luz(ctx, W / 2, 0, H * 0.93, 150, '255,230,170');
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.905, 120, 22, 0, 0, 6.283); ctx.fill();
    var t = Date.now() / 1000;
    _corujaEmPe(cv, _meuVisual(), W / 2, H * 0.91, H * 0.5, (t % 3.6) < 0.14 ? 1 : (t % 9) > 7.8 ? 5 : 0);
    var menu = _q('pty-menu');
    if (menu && menu.style.display !== 'none') _menuAnim = setTimeout(_cenaMenu, 140);
  }
  function _ptyPreparar() {
    _renderCatalogo();
    _carregarMaquina();
    _cenaMenu();
    _erroMenu('');
    var input = _q('pty-codigo-input'); if (input) input.value = '';
    _mostrarSub('menu');
    if (_pararListaSalas) { _pararListaSalas(); _pararListaSalas = null; }
    _pararListaSalas = window.AngatubaParty.listarSalas(_renderListaSalas);
  }

  function _renderListaSalas(lista) {
    var wrap = _q('pty-lista-salas');
    if (!wrap) return;
    if (!_ptyListaListenerOn) {
      // Um único listener delegado, montado uma vez: nada de onclick inline
      // com o código da sala interpolado na string (era um XSS estocado —
      // ver A1.1 na auditoria).
      wrap.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.pty-sala-item[data-codigo]');
        if (btn) _ptyEntrarSala(btn.getAttribute('data-codigo'));
      });
      _ptyListaListenerOn = true;
    }
    var validas = (lista || []).filter(function (s) { return _ptyCodigoValido(s.codigo); });
    if (!validas.length) {
      wrap.innerHTML = '<div class="pty-lista-vazia">Nenhuma sala aberta agora. Crie a primeira!</div>';
      return;
    }
    wrap.innerHTML = validas.map(function (s) {
      return '<button type="button" class="pty-sala-item" data-codigo="' + s.codigo + '">' +
        '<span class="pty-sala-item-nome">🦉 ' + _escHTML(s.nome) + '</span>' +
        '<span class="pty-sala-item-cta">Entrar</span></button>';
    }).join('');
  }

  function _escHTML(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _ptyCriarSala() {
    _ptyTreino = false;
    var publicaCheck = _q('pty-publica-check');
    var publica = !!(publicaCheck && publicaCheck.checked);
    _erroMenu('');
    window.AngatubaParty.criarSala(publica).then(function () {
      _rendarLobby();
    }).catch(function (err) { _erroMenu(err && err.message ? err.message : 'Não foi possível criar a sala.'); });
  }
  window._ptyCriarSala = _ptyCriarSala;

  function _ptyEntrarSala(codigoDireto) {
    var input = _q('pty-codigo-input');
    var codigo = codigoDireto || (input ? input.value : '');
    _erroMenu('');
    window.AngatubaParty.entrarSala(codigo).then(function () {
      _rendarLobby();
    }).catch(function (err) { _erroMenu(err && err.message ? err.message : 'Não foi possível entrar na sala.'); });
  }
  window._ptyEntrarSala = _ptyEntrarSala; // usado no onclick da lista de salas

  function _rendarLobby() {
    if (_pararListaSalas) { _pararListaSalas(); _pararListaSalas = null; }
    _mostrarSub('lobby');
  }

  function _ptySairSala() {
    window.AngatubaParty.sair();
    if (typeof window._voltarAoMenu === 'function') window._voltarAoMenu();
  }
  window._ptySairSala = _ptySairSala;

  function _ptyVoltarMenuLobby() {
    window.AngatubaParty.sair();
    _ptyPreparar();
  }
  window._ptyVoltarMenuLobby = _ptyVoltarMenuLobby;

  function _ptyCopiarCodigo() {
    var codigo = window.AngatubaParty.codigoSala();
    if (!codigo) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(codigo).catch(function () {});
    }
    var btn = _q('pty-btn-copiar');
    if (btn) {
      var original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(function () { btn.textContent = original; }, 1400);
    }
  }
  window._ptyCopiarCodigo = _ptyCopiarCodigo;


  function _ptyEscolherModo(chave) { window.AngatubaParty.definirModo(chave); }
  window._ptyEscolherModo = _ptyEscolherModo;

  // Chips do modo: o anfitrião toca; os outros só veem qual está valendo.
  // Desenhado a partir de MODOS — modo novo aparece aqui sozinho.
  var _ptyModoListenerOn = false;
  function _renderModos(sala, souAnf) {
    var wrap = _q('pty-modo-escolha');
    if (!wrap) return;
    if (!_ptyModoListenerOn) {
      wrap.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-pty-modo]');
        if (b && !b.disabled) _ptyEscolherModo(b.getAttribute('data-pty-modo'));
        var sb = e.target.closest && e.target.closest('[data-pty-sel]');
        if (sb && !sb.disabled) window.AngatubaParty.alternarMinigame(sb.getAttribute('data-pty-sel'));
      });
      _ptyModoListenerOn = true;
    }
    var atual = _modoDaSala(sala);
    var chips = MODOS_ORDEM.map(function (k) {
      var m = MODOS[k], on = (m.chave === atual.chave);
      return '<button type="button" class="pty-modo-chip' + (on ? ' pty-modo-ativo' : '') + '" data-pty-modo="' + k + '"' +
        (souAnf ? '' : ' disabled') + ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="pty-modo-emoji">' + m.emoji + '</span><span>' + _escHTML(m.nome) + '</span></button>';
    }).join('');
    var grade = '';
    if (atual.chave === 'personalizado') {
      var sel = _selecaoDaSala(sala);
      grade = '<div class="pty-sel-grade">' + POOL.map(function (j) {
        var on = sel.indexOf(j.chave) >= 0;
        return '<button type="button" class="pty-sel-item' + (on ? ' pty-sel-on' : '') + '" data-pty-sel="' + j.chave + '"' + (souAnf ? '' : ' disabled') + '>' +
          _icoHTML(j, 'pty-ico pty-ico-mini') + '<span>' + _escHTML(j.nome) + '</span></button>';
      }).join('') + '</div><div class="pty-modo-desc">' + sel.length + ' minigames · ' + sel.length + ' rodadas</div>';
    }
    wrap.innerHTML = '<span class="pty-rodadas-label">' + (souAnf ? 'Qual jogo?' : 'Jogo da sala') + '</span>' +
      '<div class="pty-modo-chips">' + chips + '</div>' +
      '<div class="pty-modo-desc">' + _escHTML(atual.desc) + '</div>' + grade +
      // Hex Arena tem skins de piso (slot hx_tema): cada um escolhe a sua.
      (atual.chave === 'hexarena' && typeof window.lojaJogoAbrir === 'function'
        ? '<button type="button" class="jogo-btn-skins pty-hx-skins" onclick="lojaJogoAbrir(\'hexarena\')">🎨 Skins da arena</button>'
        : '');
  }

  function _ptyComecarParty() { window.AngatubaParty.comecarParty(); }
  window._ptyComecarParty = _ptyComecarParty;

  function _ptyPronto() {
    var sala = window.AngatubaParty.estado(), eu = sala && (sala.jogadores || {})[window.AngatubaParty.meuUid()];
    window.AngatubaParty.marcarPronto(!(eu && eu.pronto));
  }
  window._ptyPronto = _ptyPronto;

  // Contagem do lobby: cada celular mostra; quem dá a largada é o anfitrião.
  var _contagemLobby = null, _contagemChave = null;
  function _lobbyContagem(sala) {
    var el = _q('pty-lobby-contagem');
    var pronto = sala.status === 'lobby' && _todosProntos(sala);
    // A "chave" muda com qualquer coisa que importa (gente, prontos, modo,
    // seleção): mudou no meio da conta, recomeça.
    var chave = pronto ? JSON.stringify([Object.keys(sala.jogadores || {}).sort(), sala.modo || '', sala.selecao || '']) : null;
    if (chave === _contagemChave) return;
    _contagemChave = chave;
    if (_contagemLobby) { clearInterval(_contagemLobby); _contagemLobby = null; }
    if (!pronto) {
      if (el) {
        var jog = sala.jogadores || {}, falta = Object.keys(jog).filter(function (u) { return !_ehBot(u) && !jog[u].pronto; }).length;
        el.textContent = Object.keys(jog).length < 2 ? 'Chame alguém ou adicione um robô' : (falta ? 'Esperando ' + falta + (falta > 1 ? ' jogadores ficarem' : ' jogador ficar') + ' pronto…' : '');
        el.classList.remove('pty-contagem-on');
      }
      return;
    }
    var n = 5;
    var tique = function () {
      if (el) { el.textContent = 'Começando em ' + n + '…'; el.classList.add('pty-contagem-on'); }
      if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.toque();
      if (n <= 0) {
        clearInterval(_contagemLobby); _contagemLobby = null; _contagemChave = null;
        if (el) el.textContent = 'Vai!';
        if (window.AngatubaParty.souAnfitriao()) window.AngatubaParty.comecarParty();
        return;
      }
      n--;
    };
    tique();
    _contagemLobby = setInterval(tique, 1000);
  }

  /* ── Palco do lobby: cada um na sua plataforma ───────────────────
     Pronto = luz verde e a coruja comemorando. O anfitrião toca numa vaga
     vazia pra chamar um robô, ou num robô pra tirar. */
  var _palcoAnim = null, _palcoListener = false;
  function _palcoDesenhar(sala) {
    var cv = _q('pty-palco');
    if (!cv) return;
    if (_palcoAnim) { clearTimeout(_palcoAnim); _palcoAnim = null; }
    if (!_palcoListener) {
      _palcoListener = true;
      cv.addEventListener('click', function (e) {
        var s2 = window.AngatubaParty.estado();
        if (!s2 || s2.status !== 'lobby' || !window.AngatubaParty.souAnfitriao()) return;
        var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * cv.width;
        var i = Math.max(0, Math.min(3, Math.round((x - 150) / 240)));
        var u = Object.keys(s2.jogadores || {}).sort()[i];
        if (!u) { if (_modoDaSala(s2).tipo === 'pool') window.AngatubaParty.adicionarRobo(); }
        else if (_ehBot(u)) window.AngatubaParty.removerRobo(u);
      });
    }
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height, img = _cena('palco', function () { var s3 = window.AngatubaParty.estado(); if (s3) _palcoDesenhar(s3); });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    if (img) ctx.drawImage(img, 0, 0, W, H);
    var jog = sala.jogadores || {}, uids = Object.keys(jog).sort(), t = Date.now() / 1000, souAnf = window.AngatubaParty.souAnfitriao();
    var podeRobo = souAnf && _modoDaSala(sala).tipo === 'pool';
    for (var i = 0; i < 4; i++) {
      var u = uids[i], x = PALCO_X[i];
      if (!u) {
        _rotuloCena(ctx, podeRobo ? '+ 🤖' : 'vaga', x, PALCO_PE - 80, 'rgba(255,255,255,.55)', 40);
        if (podeRobo) _rotuloCena(ctx, 'chamar robô', x, PALCO_PE + 40, 'rgba(255,255,255,.65)', 26);
        continue;
      }
      var pronto = !!jog[u].pronto || _ehBot(u);
      if (pronto) _luz(ctx, x, 0, PALCO_PE + 6, 105, '74,222,128');
      var pisca = ((t + i * 0.7) % 3.3) < 0.14;
      _corujaEmPe(ctx.canvas, jog[u].visual || 'classica|', x, PALCO_PE + 6, 175, pronto ? 5 : (pisca ? 1 : 0));
      _rotuloCena(ctx, (_ehBot(u) ? '🤖 ' : '') + _nomeCurto(u, jog[u].nome), x, PALCO_PE + 36, _ptyCor(sala, u), 32);
      _rotuloCena(ctx, pronto ? 'PRONTO' : 'esperando…', x, PALCO_PE + 64, pronto ? '#4ade80' : '#cbd5e1', 24);
      if (_ehBot(u) && souAnf) _rotuloCena(ctx, '✕', x + 62, PALCO_PE - 178, '#ff8fa3', 34);
    }
    if (sala.status === 'lobby') _palcoAnim = setTimeout(function () {
      var s2 = window.AngatubaParty.estado();
      if (s2 && s2.status === 'lobby' && _q('pty-lobby') && _q('pty-lobby').style.display !== 'none') _palcoDesenhar(s2);
    }, 140);
  }

  // Pódio do fim da Party: 1º no meio, 2º à esquerda, 3º à direita.
  var PODIO = [{ x: 512, pe: 592, alt: 270 }, { x: 270, pe: 676, alt: 240 }, { x: 756, pe: 738, alt: 230 }];
  var _podioAnim = null;
  function _cenaPodio(sala, geral) {
    var cv = _q('pty-podio-cena');
    if (!cv) return;
    if (_podioAnim) { clearTimeout(_podioAnim); _podioAnim = null; }
    var ctx = cv.getContext('2d'), img = _cena('podio', function () { _cenaPodio(sala, geral); });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (img) ctx.drawImage(img, 0, 0, cv.width, cv.height);
    var jog = sala.jogadores || {}, t = Date.now() / 1000;
    geral.slice(0, 3).forEach(function (j, i) {
      var P = PODIO[i];
      _corujaEmPe(cv, (jog[j.uid] && jog[j.uid].visual) || 'classica|', P.x, P.pe + 6, P.alt, i === 0 ? ((t % 1.2) < 0.6 ? 5 : 2) : ((t + i) % 3.3) < 0.14 ? 1 : 0);
      _rotuloCena(ctx, (_ehBot(j.uid) ? '🤖 ' : '') + _nomeCurto(j.uid, j.nome), P.x, P.pe + 70, _ptyCor(sala, j.uid), 34);
    });
    var tela = _q('pty-campeao');
    if (tela && tela.style.display !== 'none') _podioAnim = setTimeout(function () { _cenaPodio(sala, geral); }, 160);
  }

  /* ── "Treinar com robôs": sala privada + 3 robôs ─────────────────── */
  function _ptyTreinar() {
    _erroMenu('');
    var chk = _q('pty-publica-check'); if (chk) chk.checked = false;
    window.AngatubaParty.criarSala(false).then(function () {
      _ptyTreino = true;
      _rendarLobby();
      // um robô por vez, cada um depois que a sala confirmou o anterior
      var tentativas = 0;
      (function mais() {
        var sala = window.AngatubaParty.estado();
        if (++tentativas > 40 || (sala && Object.keys(sala.jogadores || {}).length >= MAX_JOGADORES)) return;
        if (sala && sala.status === 'lobby') window.AngatubaParty.adicionarRobo();
        setTimeout(mais, 300);
      })();
    }).catch(function (err) { _erroMenu(err && err.message ? err.message : 'Não foi possível criar a sala.'); });
  }
  window._ptyTreinar = _ptyTreinar;

  /* ── Tela "Monte sua coruja" ──────────────────────────────────────
     Os itens são da Loja da Coruja (jogo 'party', slots pty_*): o que já
     é seu equipa na hora; o resto mostra o preço e compra com moedas.
     Acessório só aparece quando a arte dele existe (MaquinaGame.visual). */
  var _visualAberto = false, _visualVolta = 'menu', _visualAba = 'pty_cor', _visualSel = null, _visualAnim = null, _visualListener = false;
  var ABAS_VISUAL = [
    { slot: 'pty_cor', nome: 'Cor da pena' },
    { slot: 'pty_skin', nome: 'Skins' }
  ];
  function _catalogoParty() {
    var G = window.AngatubaGames;
    return (G && typeof G.lojaCatalogo === 'function' ? G.lojaCatalogo() : []).filter(function (it) { return it.jogo === 'party'; });
  }
  // Visual de prévia: o equipado, trocando o slot da aba pelo item tocado.
  function _visualPrevia() {
    var v = _meuVisual().split('|');
    if (_visualSel) {
      var idx = SLOTS_VISUAL.indexOf(_visualSel.slot);
      if (idx >= 0) v[idx] = _visualSel.valor || (idx === 0 ? 'classica' : '');
    }
    return v.join('|');
  }
  function _ptyAbrirVisual() {
    var sala = window.AngatubaParty.estado();
    _visualVolta = sala && sala.status === 'lobby' ? 'lobby' : 'menu';
    _visualAberto = true; _visualSel = null;
    _carregarMaquina(_visualRender);
    _visualRender();
    _mostrarSub('visual');
    _visualAnimar();
  }
  window._ptyAbrirVisual = _ptyAbrirVisual;
  function _ptyFecharVisual() {
    _visualAberto = false; _visualSel = null;
    if (_visualAnim) { clearTimeout(_visualAnim); _visualAnim = null; }
    window.AngatubaParty.atualizarVisual();
    if (_visualVolta === 'lobby' && window.AngatubaParty.estado()) { _mostrarSub('lobby'); window.AngatubaParty._reemitir(); }
    else { _mostrarSub('menu'); _cenaMenu(); }
  }
  window._ptyFecharVisual = _ptyFecharVisual;
  // Provador: a coruja no chão, no meio da sala.
  function _visualAnimar() {
    if (!_visualAberto) return;
    var cv = _q('pty-visual-preview');
    if (cv) {
      var ctx = cv.getContext('2d'), img = _cena('provador');
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      if (img) ctx.drawImage(img, 0, 0, cv.width, cv.height);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(400, 905, 130, 26, 0, 0, 6.283); ctx.fill();
      var t = Date.now() / 1000;
      _corujaEmPe(cv, _visualPrevia(), 400, 915, 380, (t % 4) < 0.14 ? 1 : (t % 8) > 6.6 ? 5 : 0);
    }
    _visualAnim = setTimeout(_visualAnimar, 120);
  }
  function _visualRender() {
    var G = window.AngatubaGames, MQ = window.MaquinaGame;
    var saldo = _q('pty-visual-saldo');
    if (saldo) saldo.textContent = G && typeof G.moedasSaldo === 'function' ? '🪙 ' + G.moedasSaldo() + ' moedas' : '';
    var abas = _q('pty-visual-abas'), grade = _q('pty-visual-grade'), acao = _q('pty-visual-acao');
    if (!abas || !grade) return;
    if (!_visualListener) {
      _visualListener = true;
      abas.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-aba]');
        if (b) { _visualAba = b.getAttribute('data-aba'); _visualSel = null; _visualRender(); }
      });
      grade.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-item]');
        if (!b) return;
        var it = _catalogoParty().filter(function (x) { return x.id === b.getAttribute('data-item'); })[0];
        if (!it) return;
        var G2 = window.AngatubaGames;
        if (G2 && G2.temItem(it.id)) { G2.equiparItem(it.slot, it.id); _visualSel = null; window.AngatubaParty.atualizarVisual(); }
        else _visualSel = it;
        _visualRender();
      });
      acao.addEventListener('click', function (e) {
        if (!(e.target.closest && e.target.closest('[data-comprar]')) || !_visualSel) return;
        var G3 = window.AngatubaGames, r = G3 && G3.comprarItem(_visualSel.id);
        if (r && r.ok) { G3.equiparItem(_visualSel.slot, _visualSel.id); _visualSel = null; window.AngatubaParty.atualizarVisual(); if (G3.som) G3.som.nivelUp(); }
        else if (r && r.motivo === 'saldo_insuficiente') acao.innerHTML = '<div class="pty-visual-aviso">Moedas insuficientes — jogue mais um pouco!</div>';
        _visualRender();
      });
    }
    abas.innerHTML = ABAS_VISUAL.map(function (a) {
      return '<button type="button" class="pty-visual-aba' + (a.slot === _visualAba ? ' pty-visual-aba-on' : '') + '" data-aba="' + a.slot + '">' + a.nome + '</button>';
    }).join('');
    var prontas = MQ && MQ.visual ? MQ.visual.skins() : [];
    var itens = _catalogoParty().filter(function (it) { return it.slot === _visualAba; });
    var equip = G && typeof G.equipado === 'function' ? G.equipado(_visualAba) : null;
    var corEu = _meuVisual().split('|')[0];
    grade.innerHTML = itens.map(function (it) {
      var tem = G && G.temItem(it.id), on = it.id === equip, sel = _visualSel && _visualSel.id === it.id;
      // skin sem arte ainda: aparece, mas "em breve"
      var breve = _visualAba === 'pty_skin' && it.valor && prontas.indexOf(it.valor) < 0;
      var amostra;
      if (_visualAba === 'pty_cor') amostra = '<i class="pty-visual-cor" style="background:' + (it.amostra || '#7189a6') + '"></i>';
      else {
        var url = MQ && _maqPronta && !breve ? MQ.avatar(corEu + '|' + (it.valor || ''), 96) : null;
        amostra = url ? '<img src="' + url + '" alt="">' : '<i class="pty-visual-nada">' + (breve ? '🔒' : '🦉') + '</i>';
      }
      return '<button type="button" class="pty-visual-item' + (on ? ' pty-visual-on' : '') + (sel ? ' pty-visual-sel' : '') + (tem ? '' : ' pty-visual-bloq') + (breve ? ' pty-visual-breve' : '') + '" data-item="' + it.id + '"' + (breve ? ' disabled' : '') + '>' +
        amostra + '<span>' + _escHTML(it.nome) + '</span>' + (breve ? '<b class="pty-breve">em breve</b>' : tem ? (on ? '<b>✔</b>' : '') : '<b>🪙 ' + it.preco + '</b>') + '</button>';
    }).join('');
    if (acao) {
      if (_visualSel && !(G && G.temItem(_visualSel.id))) {
        acao.innerHTML = '<button type="button" class="pty-btn pty-btn-comprar" data-comprar="1">Comprar ' + _escHTML(_visualSel.nome) + ' · 🪙 ' + _visualSel.preco + '</button>';
      } else if (!acao.querySelector('.pty-visual-aviso')) acao.innerHTML = '';
    }
  }

  // Continuar na MESMA sala é o caminho principal do fim de rodada e do fim
  // de Party (2.3): nenhuma das duas encosta em sair() — quem sai da sala é
  // só o botão explícito "Sair da sala" (_ptyVoltarMenuLobby) ou o
  // "Voltar ao hub" (_ptyVoltarHubFinal).
  function _ptyProximaRodada() { window.AngatubaParty.proximaRodada(); }
  window._ptyProximaRodada = _ptyProximaRodada;

  function _ptyRevanche() { window.AngatubaParty.revanche(); }
  window._ptyRevanche = _ptyRevanche;

  function _ptyVoltarHubFinal() {
    window.AngatubaParty.sair();
    if (typeof window._voltarAoMenu === 'function') window._voltarAoMenu();
  }
  window._ptyVoltarHubFinal = _ptyVoltarHubFinal;

  /* ── Cor e avatar de cada jogador ─────────────────────────────────
     A ordem é a dos uids (igual em todos os aparelhos), então a mesma
     pessoa tem a mesma cor no lobby, na faixa de rivais e no placar. */
  var CORES_JOGADOR = ['#ff4d6d', '#38bdf8', '#4ade80', '#facc15'];
  var BONUS_PODIO = [30, 15, 8, 4]; // moedas no fim da Party, por lugar
  function _ptyCor(sala, uid) {
    var uids = Object.keys((sala && sala.jogadores) || {}).sort();
    var i = uids.indexOf(uid);
    return CORES_JOGADOR[(i < 0 ? 0 : i) % CORES_JOGADOR.length];
  }
  function _ptyAvatar(sala, uid) {
    var MQ = window.MaquinaGame, j = ((sala && sala.jogadores) || {})[uid] || {};
    var url = MQ && _maqPronta && typeof MQ.avatar === 'function' ? MQ.avatar(j.visual || 'classica|||', 72) : null;
    if (url) return '<span class="pty-av pty-av-img" style="--pty-cor:' + _ptyCor(sala, uid) + '"><img src="' + url + '" alt=""></span>';
    return '<span class="pty-av" style="--pty-cor:' + _ptyCor(sala, uid) + '">' + (_ehBot(uid) ? '🤖' : '🦉') + '</span>';
  }

  /* ── Faixa dos rivais (durante a rodada) ──────────────────────────
     Fica no topo da tela por cima de QUALQUER minigame (os de tela
     própria também), só enquanto body.angatuba-party-ativo. Não precisa
     de nó novo no Firebase: quem reportou o resultado da rodada acabou
     — nos minigames de eliminação, isso quer dizer que caiu. */
  var _rivaisVistos = {};
  var _rivaisJogo = null;
  function _rivaisEl() {
    var el = document.getElementById('pty-rivais');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pty-rivais';
      el.setAttribute('aria-live', 'polite');
      el.innerHTML = '<div class="pty-rivais-lista"></div><div class="pty-rivais-aviso"></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  function _rivaisMontar(sala, jogo) {
    _rivaisJogo = jogo || null;
    _rivaisVistos = {};
    var el = _rivaisEl();
    var meu = window.AngatubaParty.meuUid();
    var jogadores = (sala && sala.jogadores) || {};
    var lista = el.querySelector('.pty-rivais-lista');
    lista.innerHTML = Object.keys(jogadores).filter(function (u) { return u !== meu; }).map(function (u) {
      return '<span class="pty-rival" data-uid="' + _escHTML(u) + '" style="--pty-cor:' + _ptyCor(sala, u) + '">' +
        '<i></i>' + (_ehBot(u) ? '🤖 ' : '') + _escHTML(_nomeCurto(u, jogadores[u].nome)) + '</span>';
    }).join('');
    el.querySelector('.pty-rivais-aviso').classList.remove('pty-rivais-aviso-on');
  }
  function _rivaisAtualizar(rodada) {
    var el = document.getElementById('pty-rivais');
    if (!el) return;
    var res = _resultadosCache[rodada] || {};
    var sala = window.AngatubaParty.estado() || {};
    var jogadores = sala.jogadores || {};
    Object.keys(res).forEach(function (u) {
      if (_rivaisVistos[u] || u === window.AngatubaParty.meuUid()) return;
      _rivaisVistos[u] = true;
      var chip = el.querySelector('.pty-rival[data-uid="' + u + '"]');
      if (chip) chip.classList.add('pty-rival-fora');
      var elim = _rivaisJogo && _rivaisJogo.eliminacao;
      var aviso = el.querySelector('.pty-rivais-aviso');
      aviso.textContent = (elim ? '💥 ' : '✔ ') + String((jogadores[u] && jogadores[u].nome) || 'Alguém').slice(0, 14) + (elim ? ' caiu!' : ' terminou');
      aviso.classList.remove('pty-rivais-aviso-on'); void aviso.offsetWidth; aviso.classList.add('pty-rivais-aviso-on');
    });
  }

  /* ── Renderização reativa a partir dos eventos do AngatubaParty ── */
  var _ptyTreino = false; // a sala foi aberta pelo "Treinar com robôs"
  window.AngatubaParty.on('salaMudou', function (sala) {
    var codEl = _q('pty-lobby-codigo'); if (codEl) codEl.textContent = window.AngatubaParty.codigoSala() || '';
    var jogadores = sala.jogadores || {};
    var lista = Object.keys(jogadores).map(function (uid) { return { uid: uid, nome: jogadores[uid].nome, pontosTotal: jogadores[uid].pontosTotal || 0, anfitriao: sala.anfitriao && sala.anfitriao.uid === uid }; });

    if (sala.status === 'lobby') {
      var souAnf = window.AngatubaParty.souAnfitriao();
      var modoSala = _modoDaSala(sala);
      var humanos = lista.filter(function (j) { return !_ehBot(j.uid); }).length;
      // Topo: código da sala (no treino com robôs, só "TREINO") e quantos são.
      var treino = !sala.publica && humanos === 1 && lista.length > 1 && souAnf && _ptyTreino;
      var rot = _q('pty-sala-rotulo'), cop = _q('pty-sala-copiar'), codEl2 = _q('pty-lobby-codigo');
      if (rot) rot.textContent = treino ? 'TREINO' : 'SALA';
      if (codEl2) codEl2.style.display = treino ? 'none' : '';
      if (cop) cop.style.display = treino ? 'none' : '';
      var contador = _q('pty-lobby-contador');
      if (contador) contador.textContent = '👥 ' + lista.length + '/4';
      var dica = _q('pty-lobby-jogadores');
      if (dica) {
        dica.textContent = souAnf && modoSala.tipo === 'pool'
          ? (lista.length < MAX_JOGADORES ? 'Toque numa vaga do palco pra chamar um robô (ou no ✕ pra tirar).' : 'Toque no ✕ de um robô pra liberar a vaga.')
          : (modoSala.tipo === 'pool' ? '' : 'Hex Arena é só entre pessoas (mínimo 2).');
      }
      _renderModos(sala, souAnf);
      // "Pronto!" de cada um; todos prontos → contagem de 5 s (igual ao
      // Machine Party). Qualquer mudança no lobby recomeça a conta.
      var eu = jogadores[window.AngatubaParty.meuUid()] || {};
      var btnComecar = _q('pty-btn-comecar');
      if (btnComecar) {
        btnComecar.textContent = eu.pronto ? '✔ Pronto · cancelar' : 'Pronto!';
        btnComecar.classList.toggle('pty-btn-pronto', !!eu.pronto);
      }
      _lobbyContagem(sala);
      _palcoDesenhar(sala);
      if (!_visualAberto) _mostrarSub('lobby');
    }
  });

  // Cartão da Máquina: uma roleta rápida pelos nomes da pool e para no
  // minigame sorteado, com a regra e o controle — é o tempo de ler antes
  // do 3-2-1 (APRESENTACAO_MS lá em cima).
  var _roletaHandle = null;
  window.AngatubaParty.on('countdown', function (info) {
    var jogo = info.jogo || {}, sala = info.sala || {};
    if (_visualAberto) { _visualAberto = false; if (_visualAnim) { clearTimeout(_visualAnim); _visualAnim = null; } }
    var nomeEl = _q('pty-countdown-jogo'), iconeEl = _q('pty-countdown-icone');
    var regraEl = _q('pty-countdown-regra'), ctrlEl = _q('pty-countdown-controle');
    var rodEl = _q('pty-countdown-rodada'), numEl = _q('pty-countdown-num');
    var cartao = _q('pty-countdown-cartao'), arteEl = _q('pty-countdown-arte');
    if (rodEl) {
      rodEl.textContent = (jogo.tipo === 'modulo' || !sala.rodadaAtual)
        ? 'A Máquina escolheu'
        : 'Rodada ' + sala.rodadaAtual + ' de ' + (sala.totalRodadas || sala.rodadaAtual);
    }
    if (numEl) { numEl.textContent = ''; numEl.classList.remove('pty-countdown-vai'); }
    if (regraEl) regraEl.textContent = '';
    if (ctrlEl) ctrlEl.textContent = '';
    if (cartao) cartao.classList.remove('pty-cartao-pronto');
    _rivaisMontar(sala, jogo);
    _mostrarSub('countdown');
    if (_roletaHandle) { clearInterval(_roletaHandle); _roletaHandle = null; }
    var giros = 0, nomes = POOL.map(function (j) { return j; });
    function _pousar() {
      if (nomeEl) nomeEl.textContent = jogo.nome || 'Minigame surpresa';
      if (iconeEl) iconeEl.innerHTML = _icoHTML(jogo);
      if (arteEl) arteEl.src = _cartaoSrc(jogo);
      if (regraEl) regraEl.textContent = jogo.regra || jogo.desc || '';
      if (ctrlEl) { ctrlEl.textContent = jogo.controle || ''; ctrlEl.style.display = jogo.controle ? '' : 'none'; }
      if (cartao) cartao.classList.add('pty-cartao-pronto');
      if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.nivelUp();
    }
    if (jogo.tipo === 'modulo') { _pousar(); return; }
    _roletaHandle = setInterval(function () {
      giros++;
      var j = nomes[giros % nomes.length];
      if (nomeEl) nomeEl.textContent = j.nome;
      if (iconeEl) iconeEl.innerHTML = _icoHTML(j);
      if (arteEl) arteEl.src = _cartaoSrc(j);
      if (window.AngatubaGames && window.AngatubaGames.som && giros % 2) window.AngatubaGames.som.toque();
      if (giros >= 11) { clearInterval(_roletaHandle); _roletaHandle = null; _pousar(); }
    }, 85);
  });
  window.AngatubaParty.on('countdownTick', function (n) {
    if (_roletaHandle) { clearInterval(_roletaHandle); _roletaHandle = null; }
    var numEl = _q('pty-countdown-num');
    if (numEl) {
      numEl.textContent = n > 0 ? n : 'Vai!';
      numEl.classList.toggle('pty-countdown-vai', n <= 0);
      numEl.classList.remove('pty-countdown-pulse'); void numEl.offsetWidth; numEl.classList.add('pty-countdown-pulse');
    }
    // Bip gravado + locutor contando ("Três… dois… um… JÁ!"), cada palavra
    // no seu tique. Sem os arquivos: o tique-taque sintetizado de antes.
    var Sc = window.AngatubaGames && window.AngatubaGames.som;
    if (Sc) {
      if (n === 3 && Sc.precarregar) Sc.precarregar(['contagem-tick', 'contagem-ja', 'voz-tres', 'voz-dois', 'voz-um', 'voz-ja']);
      if (n > 0) Sc.tocar('contagem-tick', 'toque', 0.45); else Sc.tocar('contagem-ja', 'nivelUp', 0.55);
      var palavra = { 3: 'tres', 2: 'dois', 1: 'um', 0: 'ja' }[n];
      if (palavra) Sc.voz(palavra);
    }
  });
  window.AngatubaParty.on('mostrarArena', function () { _mostrarSub('arena'); /* o render() do minigame injeta o jogo em #pty-arena-container */ });

  window.AngatubaParty.on('aguardandoOutros', function (rodada) {
    _atualizarAguardando(rodada);
    _mostrarSub('aguardando');
  });
  window.AngatubaParty.on('resultadosMudaram', function () {
    var sala = window.AngatubaParty.estado();
    if (sala && sala.status === 'rodada') { _atualizarAguardando(sala.rodadaAtual); _rivaisAtualizar(sala.rodadaAtual); }
  });
  function _atualizarAguardando(rodada) {
    var sala = window.AngatubaParty.estado();
    if (!sala) return;
    var jogadores = sala.jogadores || {};
    var resultados = _resultadosCache[rodada] || {};
    var wrap = _q('pty-aguardando-lista');
    if (!wrap) return;
    wrap.innerHTML = Object.keys(jogadores).map(function (uid) {
      var pronto = !!resultados[uid];
      return '<div class="pty-jogador-chip' + (pronto ? ' pty-jogador-pronto' : '') + '">' + _ptyAvatar(sala, uid) +
        _escHTML(jogadores[uid].nome) + (pronto ? ' ✅' : ' ⏳') + '</div>';
    }).join('');
  }

  window.AngatubaParty.on('resultadoRodada', function (sala) {
    var rodada = sala.rodadaAtual;
    var placar = (sala.placarRodadas && sala.placarRodadas[rodada]) || {};
    var itens = Object.keys(placar).map(function (uid) { return placar[uid]; });
    itens.sort(function (a, b) { return a.colocacao - b.colocacao; });

    var medalhas = ['🥇', '🥈', '🥉', '🎖️'];
    var listaEl = _q('pty-resultado-lista');
    // Revelação de baixo pra cima (último lugar primeiro, o vencedor por
    // último com carimbo) — o atraso de cada linha vai no style.
    var n = itens.length;
    var uidsPlacar = Object.keys(placar);
    // Chave com a semente: depois de uma revanchinha a rodada 1 volta a existir.
    var chaveRodada = rodada + ':' + sala.seed;
    if (listaEl && listaEl.getAttribute('data-rodada') !== chaveRodada) {
      listaEl.setAttribute('data-rodada', chaveRodada);
      listaEl.innerHTML = itens.map(function (it, i) {
        var uid = uidsPlacar.filter(function (u) { return placar[u] === it; })[0];
        var eu = uid === window.AngatubaParty.meuUid();
        return '<div class="pty-resultado-item' + (i === 0 ? ' pty-resultado-1' : '') + (eu ? ' pty-resultado-eu' : '') + '" style="animation-delay:' + ((n - 1 - i) * 0.32 + 0.1).toFixed(2) + 's">' +
          '<span class="pty-resultado-pos">' + (medalhas[i] || (i + 1) + 'º') + '</span>' +
          '<span class="pty-resultado-nome">' + _ptyAvatar(sala, uid) + _escHTML(it.nome) + '</span>' +
          '<span class="pty-resultado-score">' + it.score + '</span>' +
          '<span class="pty-resultado-pts">+' + it.pontosGanhos + '</span></div>';
      }).join('');
    }

    var jogadores = sala.jogadores || {};
    var geral = Object.keys(jogadores).map(function (uid) { return { uid: uid, nome: jogadores[uid].nome, pontosTotal: jogadores[uid].pontosTotal || 0 }; });
    geral.sort(function (a, b) { return b.pontosTotal - a.pontosTotal; });
    var maxPts = Math.max(1, geral.length ? geral[0].pontosTotal : 1);
    var geralEl = _q('pty-resultado-geral');
    if (geralEl) {
      geralEl.innerHTML = geral.map(function (j) {
        return '<div class="pty-geral-item">' + _ptyAvatar(sala, j.uid) +
          '<span class="pty-geral-nome">' + _escHTML(j.nome) + '</span>' +
          '<span class="pty-geral-barra"><i style="width:' + Math.round(j.pontosTotal / maxPts * 100) + '%;background:' + _ptyCor(sala, j.uid) + '"></i></span>' +
          '<span class="pty-geral-pts">' + j.pontosTotal + '</span></div>';
      }).join('');
    }

    var tituloEl = _q('pty-resultado-titulo');
    if (tituloEl) tituloEl.textContent = 'Fim da rodada ' + rodada + ' de ' + (sala.totalRodadas || rodada);

    var btnProx = _q('pty-btn-proxima-rodada');
    if (btnProx) btnProx.style.display = window.AngatubaParty.souAnfitriao() ? '' : 'none';
    var esperaEl = _q('pty-resultado-espera-anfitriao');
    if (esperaEl) esperaEl.style.display = window.AngatubaParty.souAnfitriao() ? 'none' : '';

    document.body.classList.remove('angatuba-party-ativo');
    _mostrarTelaJogo('party');
    _mostrarSub('resultado');
  });

  window.AngatubaParty.on('campeao', function (sala) {
    var jogadores = sala.jogadores || {};
    var geral = Object.keys(jogadores).map(function (uid) { return { uid: uid, nome: jogadores[uid].nome, pontosTotal: jogadores[uid].pontosTotal || 0 }; });
    geral.sort(function (a, b) { return b.pontosTotal - a.pontosTotal; });

    var medalhas = ['🥇', '🥈', '🥉', '🎖️'];
    var podioEl = _q('pty-campeao-podio');
    if (podioEl) {
      podioEl.innerHTML = geral.map(function (j) {
        // Lugar = 1 + quantos fizeram MAIS pontos: empatados dividem a medalha.
        var i = geral.filter(function (o) { return o.pontosTotal > j.pontosTotal; }).length;
        return '<div class="pty-podio-item pty-podio-' + (i + 1) + '"><span class="pty-podio-medalha">' + (medalhas[i] || '') + '</span>' +
          '<span class="pty-podio-nome">' + _ptyAvatar(sala, j.uid) + _escHTML(j.nome) + '</span><span class="pty-podio-pts">' + j.pontosTotal + ' pts</span></div>';
      }).join('');
    }
    var tituloEl = _q('pty-campeao-titulo');
    if (tituloEl && geral[0]) {
      // Empate no topo acontece de verdade na Hex Arena (dois caem no
      // mesmo round / dois sobrevivem até o fim).
      var empatados = geral.filter(function (j) { return j.pontosTotal === geral[0].pontosTotal; });
      tituloEl.textContent = (empatados.length > 1 && geral.length > 1)
        ? '🤝 Empate: ' + empatados.map(function (j) { return j.nome; }).join(' e ') + '!'
        : '🏆 ' + geral[0].nome + ' venceu a Party!';
      // Entrada mais festiva do título (mesmo padrão de "pulse" do countdown).
      tituloEl.classList.remove('pty-campeao-titulo-anim'); void tituloEl.offsetWidth; tituloEl.classList.add('pty-campeao-titulo-anim');
    }

    // Moedas: os modos-módulo pagam sozinhos (a Hex Arena credita no
    // próprio aparelho e conta pra cá quanto foi). No modo de minigames,
    // somam as moedas pegas nas rodadas (já creditadas pelo maquina.js)
    // + o bônus do pódio, pago UMA vez por Party (_podioPagoChave).
    var bonusPodio = 0;
    if (_modoDaSala(sala).tipo === 'pool') {
      var meu = window.AngatubaParty.meuUid();
      var minhaPos = -1;
      geral.forEach(function (j, idx) { if (j.uid === meu) minhaPos = geral.filter(function (o) { return o.pontosTotal > j.pontosTotal; }).length; });
      bonusPodio = minhaPos >= 0 ? (BONUS_PODIO[minhaPos] || 0) : 0;
      var chavePodio = (window.AngatubaParty.codigoSala() || '') + ':' + sala.seed + ':' + sala.rodadaAtual;
      if (bonusPodio > 0 && _podioPagoChave !== chavePodio) {
        _podioPagoChave = chavePodio;
        var G = window.AngatubaGames;
        if (G && typeof G.moedasAdd === 'function') { try { G.moedasAdd(bonusPodio, 'party'); } catch (e) {} }
      }
    }
    var totalMoedas = (_recompensaModo || 0) + _moedasSessao + bonusPodio;
    var moedasEl = _q('pty-campeao-moedas');
    if (moedasEl) {
      moedasEl.textContent = totalMoedas ? '+' + totalMoedas + ' 🪙' + (bonusPodio ? ' (pódio +' + bonusPodio + ')' : '') : '';
      moedasEl.style.display = totalMoedas ? '' : 'none';
    }

    var souAnf = window.AngatubaParty.souAnfitriao();
    var btnRev = _q('pty-btn-revanche');
    if (btnRev) btnRev.style.display = souAnf ? '' : 'none';
    // Quem não é anfitrião via só "Voltar ao hub" aqui: parecia que a Party
    // tinha acabado de vez e o jeito era ir embora. Agora sabe que dá pra
    // ficar — a revanchinha reabre o lobby com a mesma galera e o mesmo
    // código (ver revanche()).
    var esperaRev = _q('pty-campeao-espera-anfitriao');
    if (esperaRev) esperaRev.style.display = souAnf ? 'none' : '';

    document.body.classList.remove('angatuba-party-ativo');
    _mostrarTelaJogo('party');
    _mostrarSub('campeao');
    _cenaPodio(sala, geral);
    if (window.AngatubaGames && window.AngatubaGames.efeitos) {
      window.AngatubaGames.efeitos.confete('pty-campeao-podio');
      // Segunda leva de confete um instante depois — reforça o clima de
      // comemoração sem exigir nenhum asset ou elemento novo.
      setTimeout(function () { window.AngatubaGames.efeitos.confete('pty-campeao-podio'); }, 650);
    }
    if (window.AngatubaGames && window.AngatubaGames.som) window.AngatubaGames.som.fim(true);
  });

  window.AngatubaParty.on('salaFechada', function (info) {
    document.body.classList.remove('angatuba-party-ativo');
    // Duas situações bem diferentes pra quem está olhando: a Party caiu no
    // meio (o que a pessoa quer saber é "o que aconteceu com a partida?")
    // ou a sala do lobby sumiu antes de começar.
    var tit = _q('pty-erro-titulo');
    var desc = _q('pty-erro-desc');
    if (info && info.emAndamento) {
      if (tit) tit.textContent = 'Conexão perdida';
      if (desc) desc.textContent = 'Alguém saiu ou a conexão caiu no meio da partida.';
    } else {
      if (tit) tit.textContent = 'A Party foi encerrada';
      if (desc) desc.textContent = 'O anfitrião saiu ou a sala expirou.';
    }
    _mostrarTelaJogo('party');
    _mostrarSub('erro');
  });

  // API pública consumida pelo loader do app (_jogoLoader) — o card do
  // hub chama _abrirJogo('party'), que chama preparar() ao abrir.
  window.PartyGame = {
    preparar: _ptyPreparar,
    // Chamado quando o app fecha a tela do jogo por fora das telas
    // próprias do Party (botão genérico "← Voltar aos jogos" / troca de
    // jogo) — ver _pararJogosExternos em app.js. Sem isto, sair da
    // lobby por esse caminho deixava a sala (e o espelho público) para
    // trás: o anfitrião "saía" mas o Firebase nunca ficava sabendo, e a
    // Party ficava fantasma na lista até o navegador desconectar de
    // verdade. Mesma limpeza do botão "Sair da sala" — chamar sair()
    // sem sala ativa é no-op seguro (ver AngatubaParty.sair()).
    parar: function () {
      if (_pararListaSalas) { _pararListaSalas(); _pararListaSalas = null; }
      if (window.AngatubaParty && window.AngatubaParty.codigoSala()) window.AngatubaParty.sair();
    }
  };
})();
