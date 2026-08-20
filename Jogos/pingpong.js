/* ═══════════════════════════════════════════════════════════════
   PING PONG DA CORUJA — módulo de jogo (lazy-loaded)
   1x1 em tempo real, em 1ª pessoa: a câmera fica atrás da sua
   raquete olhando pra mesa, só as raquetes aparecem (sem bonecos).
   Dois modos: sozinho contra a CPU, ou multiplayer de verdade via
   Jogos/multiplayer.js (AngatubaMP) — sala por código de 4 letras,
   dados trafegando P2P (WebRTC).

   FÍSICA DA BOLA: gravidade + quique na mesa de verdade (não é um
   arco decorativo fixo). A bola tem altura própria (h), a raquete
   também — você arrasta pra cima/baixo pra levantar a raquete e
   pega a bola em alturas diferentes, e a altura em que você rebate
   define o quanto a bola sai empinada (rebater baixo = tacada
   rasteira/rápida; rebater alto = bola mais alta/lenta). Arrastar
   de lado rápido no instante da rebatida soma um "efeito" extra na
   trajetória lateral.

   SAQUE: cada ponto começa com a bola parada do lado de quem vai
   sacar (_ppAguardandoSaque) — o próprio jogador toca a tela pra
   sacar (dá o respiro que faltava entre os pontos). O saque sai
   devagar (PP_VEL_D_SAQUE) e, como a gravidade roda o tempo todo,
   ele quica sozinho ainda do lado de quem sacou antes de cruzar a
   rede — exatamente como um saque de verdade. Depois desse primeiro
   quique a bola volta pra velocidade normal de rali. No modo
   sozinho, quando quem saca é a CPU, ela saca automaticamente após
   um instante; no multiplayer, quem não é o anfitrião manda um
   aviso de saque pra quem simula.

   MODELO DE REDE (host-autoritativo, o jeito mais simples de
   acertar num jogo 1x1 casual sem servidor):
     - Quem CRIA a sala (anfitrião) simula a bola sozinho e manda o
       estado (posição/altura da bola + placar) pro adversário a
       cada quadro. O adversário só desenha o que recebe.
     - Quem ENTRA na sala (convidado) só manda a posição/altura da
       PRÓPRIA raquete (e um aviso quando quer sacar); nunca decide
       o que a bola faz.
     - Isso evita o problema clássico de física duplicada/dessincro-
       nizada entre os dois lados — só existe UMA simulação, a do
       anfitrião, e o resto é sincronia de tela. No modo sozinho não
       tem rede nenhuma: o próprio jogador simula tudo, e a raquete
       "adversária" é movida pela CPU (ver _ppAtualizarIA).

   SALAS: criar sala aceita pública (aparece na lista "salas abertas
   agora", 1 toque pra entrar) ou privada (só quem tem o código
   entra) — ver _ppCriarSala / o checkbox #pp-privada-check. A lista
   de salas públicas é mantida viva enquanto a tela inicial estiver
   visível (_ppIniciarListaSalas/_ppPararListaSalas).

   COORDENADAS (compartilhadas entre os dois, geradas por quem
   simula): x em [-1,1] (lateral, não é espelhado — os dois lados
   enxergam "esquerda" do mesmo jeito, é um jogo estilizado, não uma
   simulação física da mesa real) · d em [0,1] (profundidade: d=0 é
   o fundo de QUEM SIMULA, d=1 é o fundo do outro lado) · h em [0,∞)
   (altura acima da mesa). Cada tela converte d pra "perto de mim"
   na hora de desenhar — ver _ppDesenhar.

   Fala com o app só via window.AngatubaGames (a ponte) e com a rede
   só via window.AngatubaMP (Jogos/multiplayer.js). Expõe
   window.PingPongGame = { preparar, comecar, parar }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Ajustes do jogo ─────────────────────────────────────────── */
  var PP_PONTOS_VITORIA    = 7;      // primeiro a chegar aqui vence
  var PP_RAQUETE_MEIA_LARG = 0.24;   // metade da largura da raquete, em x (-1..1)
  var PP_RAQUETE_ALCANCE_H = 0.24;   // o quanto a altura da raquete pode diferir da bola e ainda acertar
  var PP_RAQUETE_ALTURA_MAX = 0.6;   // até onde dá pra levantar a raquete arrastando
  var PP_VEL_D_INICIAL      = 0.92;  // "unidades de profundidade" por segundo — velocidade normal de rali
  var PP_VEL_D_INCREMENTO   = 1.022; // acelera aos poucos a cada rebatida — bem mais suave que antes
  var PP_VEL_D_MAX          = 1.75;  // teto de velocidade — não sai mais impossível de rebater
  var PP_VEL_D_SAQUE        = 0.35;  // velocidade lenta do saque, só até o 1º quique (ver _ppExecutarSaque)
  var PP_VEL_X_MAX          = 2.4;   // teto de velocidade lateral — dá pra mandar uma cruzada de verdade
  var PP_EFEITO_TOQUE       = 3.2;   // o quanto tocar fora do centro da raquete desvia a bola
  var PP_EFEITO_ARRASTO     = 1.1;   // "efeito": arrastar rápido de lado ao rebater desvia mais ainda
  var PP_CARREGO_VX         = 0.25;  // o quanto da direção anterior "sobra" numa rebatida (o resto é a tacada nova)
  var PP_GRAVIDADE          = 3.4;   // puxa a bola pra baixo — física de verdade, não um arco fixo
  var PP_RESTITUICAO        = 0.68;  // quanto da velocidade vertical sobra depois de quicar na mesa
  var PP_LIFT_BASE          = 0.85;  // impulso vertical mínimo de toda rebatida
  var PP_LIFT_POR_ALTURA    = 1.7;   // rebater com a raquete mais alta empina mais a bola

  /* ── Perspectiva (projeção falsa-3D em canvas 2D) ────────────── */
  var PP_Y_PERTO   = 0.88;  // fração da altura da tela onde fica o fundo PERTO (embaixo)
  var PP_Y_LONGE   = 0.40;  // fração da altura da tela onde fica o fundo LONGE (em cima) — mesa curta, não corredor
  var PP_LARG_PERTO = 0.44; // meia-largura da mesa PERTO, fração da largura da tela
  var PP_LARG_LONGE = 0.25; // meia-largura da mesa LONGE, fração da largura da tela
  var PP_ESCALA_PERTO = 1.0;
  var PP_ESCALA_LONGE = 0.52;
  var PP_REDE_ALTURA  = 0.16; // altura visual da rede (só decorativa, sem física própria)

  var _ppCanvas = null, _ppCtx = null, _ppW = 0, _ppH = 0, _ppDpr = 1;
  var _ppRAF = 0, _ppUltimoTs = 0;
  var _ppEstado = 'inicio';   // inicio | sala | jogando | fim
  var _ppModo = null;         // 'solo' (contra a CPU) | 'multiplayer' (via AngatubaMP)
  var _ppSouAnfitriao = false;
  var _ppEventosLigados = false;
  var _ppSalasDesligar = null; // função pra parar de ouvir a lista de salas públicas (ver _ppIniciarListaSalas)

  // Estado da bola (referencial de quem simula; só quem simula escreve nele).
  // h/vh = altura acima da mesa e velocidade vertical — física de
  // gravidade de verdade, não um arco decorativo.
  var _ppBola = { x: 0, d: 0.5, h: 0, vx: 0, vd: 0, vh: 0 };
  var _ppVelD = PP_VEL_D_INICIAL;
  var _ppPlacarAnfitriao = 0, _ppPlacarConvidado = 0;

  // Saque: cada ponto começa "parado" do lado de quem vai sacar, à
  // espera de um toque (ver cabeçalho do arquivo). _ppSaquePara usa
  // a mesma convenção de _ppExecutarSaque: 0 = fundo do anfitrião,
  // 1 = fundo do convidado. _ppFaseSaque marca a bola já lançada mas
  // ainda "lenta", antes do 1º quique do próprio saque.
  var _ppAguardandoSaque = false, _ppSaquePara = 0, _ppFaseSaque = false, _ppSaqueTimer = 0;

  // Raquetes: x (lateral, -1..1) e altura (0..PP_RAQUETE_ALTURA_MAX,
  // controlada arrastando o dedo pra cima/baixo). A própria é
  // controlada por toque; a do adversário só é atualizada pela rede
  // (ou pela IA, no modo sozinho). *VX guarda uma velocidade lateral
  // suavizada, usada só pro "efeito" (curva extra) na rebatida.
  var _ppMinhaRaqueteX = 0, _ppMinhaRaqueteH = 0, _ppMinhaRaqueteVX = 0;
  var _ppRaqueteAdversarioX = 0, _ppRaqueteAdversarioH = 0, _ppRaqueteAdversarioVX = 0;
  var _ppArrastoAnterior = null; // { x, clientY, ts } — pra calcular velocidade do arraste

  var _ppApelidoAdversario = '';
  var _ppSaindoVoluntariamente = false; // true durante um sair() pedido pelo próprio jogador

  /* ── Ponte com o app (fachada segura — no-op se não existir) ──── */
  function _ppBridge() { return window.AngatubaGames || null; }

  /* ── Ciclo de vida ─────────────────────────────────────────────*/
  function _ppPreparar() {
    _ppCanvas = document.getElementById('pp-canvas');
    if (!_ppCanvas) return;
    _ppCtx = _ppCanvas.getContext('2d');
    _ppLigarControles();
    _ppLigarEventosRede();
    if (!_ppResizeOn) {
      var reaval = function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _ppDimensionar();
          _ppDesenhar();
        }
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', reaval);
      _ppResizeOn = true;
    }
    _ppDimensionar();
    _ppMostrarTela('inicio');
    _ppLimparErroMenu();
    _ppDesenhar();
  }
  var _ppResizeOn = false;

  function _ppComecar() { _ppPreparar(); } // exigido pelo contrato { preparar, comecar, parar }

  function _ppParar() {
    if (_ppRAF) { cancelAnimationFrame(_ppRAF); _ppRAF = 0; }
    if (window.AngatubaMP) { _ppSaindoVoluntariamente = true; window.AngatubaMP.sair(); }
    _ppPararListaSalas();
    _ppEstado = 'inicio';
    _ppModo = null;
    _ppSouAnfitriao = false;
  }

  window._ppComecar = _ppComecar;
  window.PingPongGame = { preparar: _ppPreparar, comecar: _ppComecar, parar: _ppParar };

  /* ── Telas (overlays) ─────────────────────────────────────────
     3 overlays fixos no HTML: pp-menu (sozinho/criar/entrar), pp-sala
     (aguardando ou conectando) e pp-fim (resultado/erro). Durante
     'jogando' nenhum aparece — só o HUD + canvas. */
  function _ppMostrarTela(qual) {
    _ppEstado = qual;
    var menu = document.getElementById('pp-menu');
    var sala = document.getElementById('pp-sala');
    var fim  = document.getElementById('pp-fim');
    if (menu) menu.style.display = (qual === 'inicio') ? '' : 'none';
    if (sala) sala.style.display = (qual === 'sala') ? '' : 'none';
    if (fim)  fim.style.display  = (qual === 'fim')  ? '' : 'none';
    var hud = document.getElementById('pp-hud');
    if (hud) hud.style.display = (qual === 'jogando') ? '' : 'none';
    if (qual === 'inicio') {
      // Blindagem: garante que os botões nunca fiquem travados de uma
      // tentativa anterior (ex.: o app foi pro segundo plano e voltou no
      // meio de "Criar sala", sem passar por _ppVoltarMenu).
      var btnC = document.getElementById('pp-btn-criar');
      var btnE = document.getElementById('pp-btn-entrar');
      if (btnC) btnC.disabled = false;
      if (btnE) btnE.disabled = false;
      _ppIniciarListaSalas();
    } else {
      _ppPararListaSalas();
    }
  }

  function _ppErroMenu(msg) {
    var el = document.getElementById('pp-menu-erro');
    if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  }
  function _ppLimparErroMenu() { _ppErroMenu(''); }

  /* ── Lista de salas públicas abertas agora ───────────────────────
     Ouve window.AngatubaMP.listarSalas() enquanto a tela inicial
     estiver visível (ver _ppMostrarTela) — pra não gastar leitura à
     toa quando o jogador já entrou numa partida. */
  function _ppIniciarListaSalas() {
    if (_ppSalasDesligar || !window.AngatubaMP || typeof window.AngatubaMP.listarSalas !== 'function') return;
    _ppSalasDesligar = window.AngatubaMP.listarSalas(_ppRenderizarSalas);
  }
  function _ppPararListaSalas() {
    if (_ppSalasDesligar) { try { _ppSalasDesligar(); } catch (e) {} _ppSalasDesligar = null; }
  }
  function _ppEscaparHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _ppRenderizarSalas(lista) {
    var wrap = document.getElementById('pp-lista-salas');
    if (!wrap) return;
    if (!lista || !lista.length) {
      wrap.innerHTML = '<div class="pp-lista-vazia">Nenhuma sala pública aberta agora.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      html += '<div class="pp-sala-item">' +
                '<span class="pp-sala-item-nome">' + _ppEscaparHtml(s.nome) + '</span>' +
                '<button type="button" class="pp-sala-item-btn" onclick="_ppEntrarSala(\'' + _ppEscaparHtml(s.codigo) + '\')">Entrar</button>' +
              '</div>';
    }
    wrap.innerHTML = html;
  }

  /* ── Ações do menu inicial ───────────────────────────────────── */
  // Modo 1 jogador: sem rede nenhuma, a raquete "adversária" é
  // controlada pela CPU (ver _ppAtualizarIA, chamada de dentro de
  // _ppSimular quando _ppModo === 'solo').
  function _ppJogarSozinho() {
    _ppModo = 'solo';
    _ppSouAnfitriao = true;
    _ppApelidoAdversario = 'Computador';
    _ppRaqueteAdversarioX = 0;
    _ppRaqueteAdversarioH = 0;
    _ppReiniciarPartida();
    _ppComecarPartida();
  }

  function _ppCriarSala() {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _ppErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    _ppLimparErroMenu();
    var btn = document.getElementById('pp-btn-criar');
    if (btn) btn.disabled = true;
    var chkPrivada = document.getElementById('pp-privada-check');
    var publica = !(chkPrivada && chkPrivada.checked);
    window.AngatubaMP.criarSala(publica).then(function (codigo) {
      _ppModo = 'multiplayer';
      _ppSouAnfitriao = true;
      _ppMostrarSala('aguardando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _ppErroMenu((err && err.message) || 'Não consegui criar a sala.');
    });
  }

  // codigoForcado: usado pela lista de salas públicas (toque em
  // "Entrar" já manda o código, sem precisar digitar). Sem argumento,
  // lê do campo de código manual (fluxo de sala privada).
  function _ppEntrarSala(codigoForcado) {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _ppErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    var input = document.getElementById('pp-codigo-input');
    var codigo = codigoForcado || (input ? input.value : '');
    _ppLimparErroMenu();
    var btn = document.getElementById('pp-btn-entrar');
    if (btn) btn.disabled = true;
    window.AngatubaMP.entrarSala(codigo).then(function () {
      _ppModo = 'multiplayer';
      _ppSouAnfitriao = false;
      _ppMostrarSala('conectando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _ppErroMenu((err && err.message) || 'Não consegui entrar na sala.');
    });
  }

  function _ppMostrarSala(modo, codigo) {
    _ppMostrarTela('sala');
    var titulo = document.getElementById('pp-sala-titulo');
    var desc   = document.getElementById('pp-sala-desc');
    var codEl  = document.getElementById('pp-sala-codigo');
    if (modo === 'aguardando') {
      if (titulo) titulo.textContent = 'Chame um amigo!';
      if (desc) desc.textContent = 'Manda esse código pro seu amigo digitar em "Entrar com código":';
      if (codEl) { codEl.textContent = codigo; codEl.style.display = ''; }
    } else {
      if (titulo) titulo.textContent = 'Conectando…';
      if (desc) desc.textContent = 'Aguardando o anfitrião confirmar a conexão.';
      if (codEl) codEl.style.display = 'none';
    }
  }

  function _ppCopiarCodigo() {
    var codEl = document.getElementById('pp-sala-codigo');
    var codigo = codEl ? codEl.textContent : '';
    if (!codigo || !navigator.clipboard) return;
    navigator.clipboard.writeText(codigo).then(function () {
      var btn = document.getElementById('pp-btn-copiar');
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(function () { btn.textContent = original; }, 1500);
    }).catch(function () {});
  }

  function _ppVoltarMenu() {
    if (_ppRAF) { cancelAnimationFrame(_ppRAF); _ppRAF = 0; }
    if (window.AngatubaMP) { _ppSaindoVoluntariamente = true; window.AngatubaMP.sair(); }
    _ppModo = null;
    _ppSouAnfitriao = false;
    var btnC = document.getElementById('pp-btn-criar');
    var btnE = document.getElementById('pp-btn-entrar');
    if (btnC) btnC.disabled = false;
    if (btnE) btnE.disabled = false;
    _ppMostrarTela('inicio');
  }

  window._ppJogarSozinho = _ppJogarSozinho;
  window._ppCriarSala  = _ppCriarSala;
  window._ppEntrarSala = _ppEntrarSala;
  window._ppCopiarCodigo = _ppCopiarCodigo;
  window._ppVoltarMenu = _ppVoltarMenu;
  window._ppPedirRevanche = function () {
    if (_ppModo === 'solo') { _ppReiniciarPartida(); _ppComecarPartida(); }
    else if (_ppSouAnfitriao) { _ppReiniciarPartida(); _ppEnviarReinicio(); _ppComecarPartida(); }
    else if (window.AngatubaMP) window.AngatubaMP.enviar({ t: 'pr' });
    var btn = document.getElementById('pp-btn-revanche');
    if (btn) btn.disabled = true;
  };

  /* ── Rede: eventos do AngatubaMP (ligados uma única vez) ──────── */
  function _ppLigarEventosRede() {
    if (_ppEventosLigados || !window.AngatubaMP) return;
    _ppEventosLigados = true;

    window.AngatubaMP.on('conectado', function () {
      var bridge = _ppBridge();
      var meuNome = (bridge && bridge.apelido && bridge.apelido()) || 'Jogador';
      window.AngatubaMP.enviar({ t: 'oi', nome: meuNome });
      if (_ppSouAnfitriao) _ppReiniciarPartida();
      _ppComecarPartida();
    });

    window.AngatubaMP.on('mensagem', _ppReceberMensagem);

    // sair()/_ppParar()/_ppVoltarMenu() também fecham o canal (o que
    // dispara este mesmo evento) — _ppSaindoVoluntariamente distingue
    // "eu que saí" de "a conexão caiu/o outro lado sumiu", pra não
    // mostrar um aviso de erro numa saída pedida pelo próprio jogador.
    window.AngatubaMP.on('desconectado', function () {
      if (_ppSaindoVoluntariamente) { _ppSaindoVoluntariamente = false; return; }
      if (_ppEstado === 'jogando' || _ppEstado === 'sala') _ppMostrarFim('desconexao');
    });

    window.AngatubaMP.on('erro', function (err) {
      if (_ppEstado === 'sala') _ppErroMenu((err && err.message) || 'Falha na conexão.');
    });
  }

  function _ppReceberMensagem(dado) {
    if (!dado || !dado.t) return;
    switch (dado.t) {
      case 'oi': // apresentação (nome do adversário)
        _ppApelidoAdversario = String(dado.nome || 'Adversário').slice(0, 20);
        _ppAtualizarHUD();
        break;
      case 'p': // convidado -> anfitrião: posição/altura/velocidade da raquete do convidado
        if (_ppSouAnfitriao) {
          if (typeof dado.x === 'number') _ppRaqueteAdversarioX = _ppClamp(dado.x, -1, 1);
          if (typeof dado.h === 'number') _ppRaqueteAdversarioH = _ppClamp(dado.h, 0, PP_RAQUETE_ALTURA_MAX);
          if (typeof dado.v === 'number') _ppRaqueteAdversarioVX = dado.v;
        }
        break;
      case 'saque': // convidado avisa que quer sacar — só o anfitrião decide (é quem simula)
        if (_ppSouAnfitriao && _ppAguardandoSaque && _ppSaquePara === 1) _ppExecutarSaque();
        break;
      case 'e': // anfitrião -> convidado: estado da bola + placar + saque
        if (!_ppSouAnfitriao) {
          _ppBola.x = dado.bx; _ppBola.d = dado.bd; _ppBola.h = dado.bh;
          _ppRaqueteAdversarioX = dado.hx; _ppRaqueteAdversarioH = dado.hh;
          _ppPlacarAnfitriao = dado.sh; _ppPlacarConvidado = dado.sg;
          _ppAguardandoSaque = !!dado.ag; _ppSaquePara = dado.qs;
          _ppAtualizarHUD();
          if (dado.fim) _ppMostrarFim('fim');
        }
        break;
      case 'rr': // reiniciar partida (o anfitrião reiniciou ou aceitou o pedido de revanche)
        if (!_ppSouAnfitriao) { _ppReiniciarPartida(); _ppComecarPartida(); }
        break;
      case 'pr': // convidado pediu revanche — só o anfitrião decide e reinicia (ele é quem simula)
        if (_ppSouAnfitriao) { _ppReiniciarPartida(); _ppEnviarReinicio(); _ppComecarPartida(); }
        break;
    }
  }

  function _ppEnviarReinicio() {
    if (_ppModo === 'multiplayer' && window.AngatubaMP) window.AngatubaMP.enviar({ t: 'rr' });
  }

  /* ── Controles (arrastar a própria raquete em x E em altura) ────
     Pointer Events cobrem toque e mouse com a mesma API; captura o
     ponteiro pra continuar recebendo o arraste mesmo se o dedo sair
     da área do canvas. Horizontal = posição lateral; vertical = o
     quanto a raquete sobe da mesa (arrastar pra cima levanta a
     raquete, pra baixo volta pro nível da mesa) — assim dá pra
     escolher em que altura interceptar a bola. Um toque enquanto o
     jogo está "aguardando saque" e é a vez do jogador local também
     dispara o saque (ver _ppEhMinhaVezDeSacar). */
  function _ppPosicaoDoEvento(clientX, clientY) {
    var r = _ppCanvas.getBoundingClientRect();
    var fracX = (clientX - r.left) / (r.width || 1);
    var x = _ppClamp(fracX * 2 - 1, -1, 1);
    // Minha raquete sempre desenha em renderD=0 (escala/chão fixos),
    // então a conversão de pixel pra altura é a inversa exata de
    // _ppProjetar com renderD=0.
    var perto = _ppProjetar(0, 0, 0);
    var yTela = (clientY - r.top) * (_ppH / (r.height || 1));
    var h = (perto.chaoY - yTela) / (PP_ESCALA_PERTO * (_ppH * 0.5));
    return { x: x, h: _ppClamp(h, 0, PP_RAQUETE_ALTURA_MAX) };
  }
  function _ppAplicarArrasto(clientX, clientY) {
    var pos = _ppPosicaoDoEvento(clientX, clientY);
    var agora = performance.now();
    if (_ppArrastoAnterior) {
      var dt = (agora - _ppArrastoAnterior.ts) / 1000;
      if (dt > 0.001) _ppMinhaRaqueteVX = _ppClamp((pos.x - _ppArrastoAnterior.x) / dt, -8, 8);
    }
    _ppArrastoAnterior = { x: pos.x, ts: agora };
    _ppMinhaRaqueteX = pos.x;
    _ppMinhaRaqueteH = pos.h;
    _ppEnviarMinhaRaquete();
  }
  // true quando é a vez do jogador LOCAL sacar (0 = fundo do
  // anfitrião, 1 = fundo do convidado — mesma convenção de _ppBola.d).
  function _ppEhMinhaVezDeSacar() {
    return (_ppSaquePara === 0 && _ppSouAnfitriao) || (_ppSaquePara === 1 && !_ppSouAnfitriao);
  }
  function _ppPointerDown(e) {
    if (_ppEstado !== 'jogando') return;
    try { _ppCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    _ppArrastoAnterior = null;
    _ppAplicarArrasto(e.clientX, e.clientY);
    if (_ppAguardandoSaque && _ppEhMinhaVezDeSacar()) {
      if (_ppSouAnfitriao) _ppExecutarSaque();
      else if (window.AngatubaMP) window.AngatubaMP.enviar({ t: 'saque' });
    }
    if (e.cancelable) e.preventDefault();
  }
  function _ppPointerMove(e) {
    if (_ppEstado !== 'jogando' || e.buttons === 0 && e.pointerType === 'mouse') {
      // (sem botão pressionado no mouse: ignora — só arrasta com o botão preso ou por toque)
    }
    if (_ppEstado !== 'jogando') return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) return;
    _ppAplicarArrasto(e.clientX, e.clientY);
    if (e.cancelable) e.preventDefault();
  }
  function _ppPointerUp() { _ppArrastoAnterior = null; _ppMinhaRaqueteVX = 0; }
  function _ppEnviarMinhaRaquete() {
    if (_ppModo !== 'multiplayer' || !window.AngatubaMP) return;
    if (_ppSouAnfitriao) return; // o anfitrião já tem a própria posição local; só o convidado precisa mandar
    window.AngatubaMP.enviar({ t: 'p', x: _ppMinhaRaqueteX, h: _ppMinhaRaqueteH, v: _ppMinhaRaqueteVX });
  }
  var _ppControlesOn = false;
  function _ppLigarControles() {
    if (_ppControlesOn || !_ppCanvas) return;
    _ppCanvas.addEventListener('pointerdown', _ppPointerDown);
    _ppCanvas.addEventListener('pointermove', _ppPointerMove);
    _ppCanvas.addEventListener('pointerup', _ppPointerUp);
    _ppCanvas.addEventListener('pointercancel', _ppPointerUp);
    _ppControlesOn = true;
  }

  /* ── Dimensionamento (mesmo padrão dos outros jogos em canvas) ─ */
  function _ppDimensionar() {
    if (!_ppCanvas) return;
    var cssW = _ppCanvas.offsetWidth || 320;
    var cssH = _ppCanvas.offsetHeight || 480;
    if (cssW < 2) cssW = 320;
    if (cssH < 2) cssH = 480;
    _ppDpr = Math.min(2, window.devicePixelRatio || 1);
    _ppCanvas.width = Math.round(cssW * _ppDpr);
    _ppCanvas.height = Math.round(cssH * _ppDpr);
    _ppW = cssW; _ppH = cssH;
    if (_ppCtx) _ppCtx.setTransform(_ppDpr, 0, 0, _ppDpr, 0, 0);
  }

  function _ppClamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

  /* ── Partida ──────────────────────────────────────────────────
     Só QUEM SIMULA (o anfitrião no multiplayer, ou o único jogador
     no modo solo) chama _ppSimular de verdade calculando física; o
     convidado só redesenha o que chega pela rede — mas os dois
     compartilham o mesmo _ppLoop (requestAnimationFrame) pra
     desenhar a cada quadro. */
  function _ppReiniciarPartida() {
    _ppPlacarAnfitriao = 0; _ppPlacarConvidado = 0;
    _ppVelD = PP_VEL_D_INICIAL;
    _ppIniciarAguardoSaque(Math.random() < 0.5 ? 0 : 1);
    _ppAtualizarHUD();
  }

  // Bola "parada" do lado de quem vai sacar, esperando um toque
  // (ver _ppPointerDown/_ppEhMinhaVezDeSacar) — é o respiro entre um
  // ponto e outro que faltava (antes a bola já saía sozinha).
  function _ppIniciarAguardoSaque(paraD) {
    _ppAguardandoSaque = true;
    _ppFaseSaque = false;
    _ppSaquePara = paraD;
    _ppSaqueTimer = 0;
    _ppBola.x = 0; _ppBola.d = paraD; _ppBola.h = 0.05;
    _ppBola.vx = 0; _ppBola.vd = 0; _ppBola.vh = 0;
  }

  // Lança o saque: toss vertical + velocidade horizontal BEM mais
  // lenta que o rali (PP_VEL_D_SAQUE) — como a gravidade roda o
  // tempo todo, a bola quica sozinha ainda do lado de quem sacou
  // antes de chegar na rede (quique legal de verdade, não decorativo).
  // Esse 1º quique (tratado em _ppSimular) desliga _ppFaseSaque e
  // devolve a bola pra velocidade normal de rali.
  function _ppExecutarSaque() {
    if (!_ppAguardandoSaque) return;
    _ppAguardandoSaque = false;
    _ppFaseSaque = true;
    var paraD = _ppSaquePara;
    var sentido = paraD === 0 ? 1 : -1;
    _ppBola.x = 0; _ppBola.d = paraD; _ppBola.h = 0.05;
    _ppBola.vh = 2.0;
    _ppBola.vd = sentido * PP_VEL_D_SAQUE;
    _ppBola.vx = (Math.random() * 0.3 - 0.15);
  }

  function _ppComecarPartida() {
    _ppMostrarTela('jogando');
    _ppUltimoTs = 0;
    if (_ppRAF) cancelAnimationFrame(_ppRAF);
    _ppRAF = requestAnimationFrame(_ppLoop);
  }

  function _ppLoop(ts) {
    if (_ppEstado !== 'jogando') return;
    var dt = _ppUltimoTs ? Math.min(0.05, (ts - _ppUltimoTs) / 1000) : 0;
    _ppUltimoTs = ts;
    if (_ppSouAnfitriao) _ppSimular(dt);
    _ppDesenhar();
    _ppRAF = requestAnimationFrame(_ppLoop);
  }

  // Modo 1 jogador: move a raquete da CPU até a bola (x e altura),
  // com velocidade limitada e um pouco de erro — assim dá pra
  // vencer, mas exige atenção.
  function _ppAtualizarIA(dt) {
    var erro = Math.sin(performance.now() * 0.0017) * 0.10;
    var alvoX = _ppClamp(_ppBola.x + erro, -1, 1);
    var alvoH = _ppClamp(_ppBola.h, 0, PP_RAQUETE_ALTURA_MAX);
    var passoX = 1.15 * dt, passoH = 1.4 * dt;
    var dx = alvoX - _ppRaqueteAdversarioX, dh = alvoH - _ppRaqueteAdversarioH;
    _ppRaqueteAdversarioVX = Math.abs(dx) <= passoX ? 0 : (dx > 0 ? 1 : -1) * (passoX / dt);
    _ppRaqueteAdversarioX += Math.abs(dx) <= passoX ? dx : (dx > 0 ? passoX : -passoX);
    _ppRaqueteAdversarioH += Math.abs(dh) <= passoH ? dh : (dh > 0 ? passoH : -passoH);
  }

  // Só roda em quem simula: aplica gravidade/quique na bola, move
  // em x/d, checa colisão com as duas raquetes (posição E altura) e
  // paredes, e manda o estado pro outro lado (se for multiplayer).
  function _ppSimular(dt) {
    if (!dt) { _ppEnviarEstado(false); return; }

    // Aguardando saque: bola parada, sem física — só espera o toque
    // de quem tem que sacar (ou, no modo sozinho, a CPU saca sozinha
    // depois de um instante, senão o jogo travaria esperando pra sempre).
    if (_ppAguardandoSaque) {
      if (_ppModo === 'solo' && _ppSaquePara === 1) {
        _ppSaqueTimer += dt;
        if (_ppSaqueTimer > 0.7) _ppExecutarSaque();
      }
      _ppEnviarEstado(false);
      return;
    }

    if (_ppModo === 'solo') _ppAtualizarIA(dt);

    _ppBola.vh -= PP_GRAVIDADE * dt;
    _ppBola.h += _ppBola.vh * dt;
    if (_ppBola.h <= 0) {
      _ppBola.h = 0;
      if (_ppBola.vh < 0) _ppBola.vh = -_ppBola.vh * PP_RESTITUICAO;
      // 1º quique do saque, ainda do lado de quem sacou: acabou a
      // fase "lenta", a bola volta pra velocidade normal de rali.
      if (_ppFaseSaque) {
        _ppFaseSaque = false;
        _ppBola.vd = (_ppBola.vd < 0 ? -1 : 1) * PP_VEL_D_INICIAL;
      }
    }
    _ppBola.d += _ppBola.vd * dt;
    _ppBola.x += _ppBola.vx * dt;
    if (_ppBola.x > 1) { _ppBola.x = 1; _ppBola.vx = -Math.abs(_ppBola.vx); }
    if (_ppBola.x < -1) { _ppBola.x = -1; _ppBola.vx = Math.abs(_ppBola.vx); }

    var fimDePonto = null; // 'anfitriao' | 'convidado' — quem MARCOU o ponto

    if (_ppBola.d <= 0) {
      if (Math.abs(_ppBola.x - _ppMinhaRaqueteX) <= PP_RAQUETE_MEIA_LARG &&
          Math.abs(_ppBola.h - _ppMinhaRaqueteH) <= PP_RAQUETE_ALCANCE_H) {
        _ppRebater(_ppMinhaRaqueteX, _ppMinhaRaqueteH, _ppMinhaRaqueteVX, 1);
      } else {
        fimDePonto = 'convidado';
      }
    } else if (_ppBola.d >= 1) {
      if (Math.abs(_ppBola.x - _ppRaqueteAdversarioX) <= PP_RAQUETE_MEIA_LARG &&
          Math.abs(_ppBola.h - _ppRaqueteAdversarioH) <= PP_RAQUETE_ALCANCE_H) {
        _ppRebater(_ppRaqueteAdversarioX, _ppRaqueteAdversarioH, _ppRaqueteAdversarioVX, -1);
      } else {
        fimDePonto = 'anfitriao';
      }
    }

    var partidaAcabou = false;
    if (fimDePonto) {
      if (fimDePonto === 'anfitriao') _ppPlacarAnfitriao++; else _ppPlacarConvidado++;
      _ppAtualizarHUD();
      partidaAcabou = (_ppPlacarAnfitriao >= PP_PONTOS_VITORIA || _ppPlacarConvidado >= PP_PONTOS_VITORIA);
      if (partidaAcabou) {
        _ppEnviarEstado(true);
        _ppMostrarFim('fim');
        return;
      }
      // Quem tomou o ponto saca em seguida (sai do fundo dele).
      _ppIniciarAguardoSaque(fimDePonto === 'anfitriao' ? 1 : 0);
    }

    _ppEnviarEstado(false);
  }

  function _ppRebater(raqueteX, raqueteH, raqueteVX, novoSentidoVd) {
    _ppVelD = Math.min(PP_VEL_D_MAX, _ppVelD * PP_VEL_D_INCREMENTO);
    _ppBola.vd = novoSentidoVd * _ppVelD;
    // A tacada nova pesa bem mais que o "resto" da trajetória
    // anterior (PP_CARREGO_VX) — assim a bola realmente vai na
    // direção que você acabou de rebater, em vez de só desviar um
    // pouco da rota antiga. Duas fontes de direção: onde a bola bate
    // na raquete (fora do centro = cruzada) e o quanto você tá
    // arrastando o dedo de lado no instante da rebatida (efeito).
    _ppBola.vx = _ppClamp(
      _ppBola.vx * PP_CARREGO_VX + (_ppBola.x - raqueteX) * PP_EFEITO_TOQUE + (raqueteVX || 0) * PP_EFEITO_ARRASTO,
      -PP_VEL_X_MAX, PP_VEL_X_MAX
    );
    // Rebater com a raquete mais alta empina mais a bola (defensiva/
    // lenta); mais baixa sai mais rasteira e rápida.
    _ppBola.vh = PP_LIFT_BASE + raqueteH * PP_LIFT_POR_ALTURA;
    _ppBola.d = _ppClamp(_ppBola.d, 0, 1);
  }

  var _ppUltimoEnvio = 0;
  function _ppEnviarEstado(fim) {
    if (_ppModo !== 'multiplayer' || !window.AngatubaMP) return;
    // ~30 msgs/s é de sobra pra um jogo casual e não sobrecarrega o canal.
    var agora = performance.now();
    if (!fim && (agora - _ppUltimoEnvio) < 33) return;
    _ppUltimoEnvio = agora;
    window.AngatubaMP.enviar({
      t: 'e', bx: _ppBola.x, bd: _ppBola.d, bh: _ppBola.h,
      hx: _ppMinhaRaqueteX, hh: _ppMinhaRaqueteH,
      sh: _ppPlacarAnfitriao, sg: _ppPlacarConvidado,
      ag: _ppAguardandoSaque, qs: _ppSaquePara, fim: !!fim
    });
  }

  function _ppMostrarFim(motivo) {
    if (_ppRAF) { cancelAnimationFrame(_ppRAF); _ppRAF = 0; }
    _ppMostrarTela('fim');
    var titulo = document.getElementById('pp-fim-titulo');
    var msg = document.getElementById('pp-fim-msg');
    var placar = document.getElementById('pp-fim-placar');
    var owlEl = document.getElementById('pp-fim-owl');
    var meu = _ppSouAnfitriao ? _ppPlacarAnfitriao : _ppPlacarConvidado;
    var dele = _ppSouAnfitriao ? _ppPlacarConvidado : _ppPlacarAnfitriao;
    var btnRev = document.getElementById('pp-btn-revanche');
    if (btnRev) btnRev.disabled = false;

    if (motivo === 'desconexao') {
      if (titulo) titulo.textContent = 'Conexão perdida';
      if (msg) msg.textContent = 'O outro jogador saiu ou a conexão caiu.';
      if (placar) placar.style.display = 'none';
      if (btnRev) btnRev.style.display = 'none';
      if (owlEl) { owlEl.src = '/webp/owl-wave.webp'; owlEl.style.display = ''; }
      return;
    }
    var venceu = meu > dele;
    if (titulo) titulo.textContent = venceu ? 'Você venceu! 🏆' : 'Não foi dessa vez';
    if (msg) msg.textContent = venceu ? 'Mandou bem contra ' + (_ppApelidoAdversario || 'seu adversário') + '!'
                                       : (_ppApelidoAdversario || 'Seu adversário') + ' levou essa.';
    if (placar) { placar.textContent = meu + ' x ' + dele; placar.style.display = ''; }
    if (btnRev) btnRev.style.display = '';
    if (owlEl) { owlEl.src = venceu ? '/webp/owl-trophy.webp' : '/webp/owl-wave.webp'; owlEl.style.display = ''; }

    var bridge = _ppBridge();
    if (venceu && bridge && bridge.efeitos) bridge.efeitos.confete('pp-fim', 80);
  }

  function _ppAtualizarHUD() {
    var meu = _ppSouAnfitriao ? _ppPlacarAnfitriao : _ppPlacarConvidado;
    var dele = _ppSouAnfitriao ? _ppPlacarConvidado : _ppPlacarAnfitriao;
    var elMeu = document.getElementById('pp-hud-meu');
    var elDele = document.getElementById('pp-hud-dele');
    var elNome = document.getElementById('pp-hud-nome-adversario');
    if (elMeu) elMeu.textContent = meu;
    if (elDele) elDele.textContent = dele;
    if (elNome) elNome.textContent = _ppApelidoAdversario || 'Adversário';
  }

  /* ── Desenho (perspectiva falsa-3D em canvas 2D) ─────────────────
     'renderD' é sempre "distância de mim" (0 = perto/embaixo, 1 =
     longe/em cima) do ponto de vista de QUEM ESTÁ OLHANDO a tela —
     é por isso que a bola precisa inverter a profundidade quando
     quem desenha não é quem simula (ver a chamada abaixo). As
     raquetes não precisam inverter nada: a minha é sempre "perto",
     a do adversário é sempre "longe". */
  function _ppProjetar(x, renderD, altura) {
    var t = _ppClamp(renderD, 0, 1);
    var fracY = PP_Y_PERTO - (PP_Y_PERTO - PP_Y_LONGE) * t;
    var largFrac = PP_LARG_PERTO - (PP_LARG_PERTO - PP_LARG_LONGE) * t;
    var escala = PP_ESCALA_PERTO - (PP_ESCALA_PERTO - PP_ESCALA_LONGE) * t;
    var chaoY = fracY * _ppH;
    var px = _ppW / 2 + x * (largFrac * _ppW);
    var py = chaoY - (altura || 0) * escala * (_ppH * 0.5);
    return { x: px, y: py, chaoY: chaoY, escala: escala, largMesa: largFrac * _ppW };
  }

  var PP_MESA_COR_PERTO = '#2f7fe0';
  var PP_MESA_COR_LONGE = '#123863';
  var PP_APRON_COR      = '#081527';

  function _ppDesenhar() {
    if (!_ppCtx || !_ppW || !_ppH) return;
    var ctx = _ppCtx;
    ctx.clearRect(0, 0, _ppW, _ppH);

    // Fundo: arena escura com um brilho suave atrás da mesa.
    var fundo = ctx.createRadialGradient(_ppW / 2, _ppH * 0.28, _ppH * 0.06, _ppW / 2, _ppH * 0.28, _ppH * 0.85);
    fundo.addColorStop(0, '#182a44');
    fundo.addColorStop(1, '#05070c');
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, _ppW, _ppH);

    _ppDesenharMesa();

    var jogando = (_ppEstado === 'jogando');
    var renderDBola = _ppSouAnfitriao ? _ppBola.d : (1 - _ppBola.d);

    // Ordem de desenho por profundidade (a rede fica sempre em d=0.5):
    // a raquete do adversário é sempre mais longe que a rede, a minha
    // é sempre mais perto — só a bola muda de lado.
    _ppDesenharRaquete(_ppRaqueteAdversarioX, _ppRaqueteAdversarioH, 1, '#ff5470');
    if (jogando && renderDBola < 0.5) _ppDesenharBola(renderDBola);
    _ppDesenharRede();
    if (jogando && renderDBola >= 0.5) _ppDesenharBola(renderDBola);
    _ppDesenharRaquete(_ppMinhaRaqueteX, _ppMinhaRaqueteH, 0, '#38bdf8');

    if (jogando && _ppAguardandoSaque) _ppDesenharPromptSaque();
  }

  // Tampo + friso branco + linha central (padrão de mesa oficial) +
  // aba lateral (dá espessura) + piso embaixo, pra mesa não parecer
  // um adesivo flutuando no vazio nem uma pista esticada.
  function _ppDesenharMesa() {
    var ctx = _ppCtx;
    var perto = _ppProjetar(0, 0, 0), longe = _ppProjetar(0, 1, 0);

    var piso = ctx.createLinearGradient(0, perto.chaoY, 0, _ppH);
    piso.addColorStop(0, '#0a1120');
    piso.addColorStop(1, '#04060a');
    ctx.fillStyle = piso;
    ctx.fillRect(0, perto.chaoY, _ppW, Math.max(0, _ppH - perto.chaoY));

    var tampo = ctx.createLinearGradient(0, longe.chaoY, 0, perto.chaoY);
    tampo.addColorStop(0, PP_MESA_COR_LONGE);
    tampo.addColorStop(1, PP_MESA_COR_PERTO);
    ctx.beginPath();
    ctx.moveTo(_ppW / 2 - perto.largMesa, perto.chaoY);
    ctx.lineTo(_ppW / 2 + perto.largMesa, perto.chaoY);
    ctx.lineTo(_ppW / 2 + longe.largMesa, longe.chaoY);
    ctx.lineTo(_ppW / 2 - longe.largMesa, longe.chaoY);
    ctx.closePath();
    ctx.fillStyle = tampo;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();

    // Linha central branca, do fundo perto até o fundo longe.
    ctx.beginPath();
    ctx.moveTo(_ppW / 2, perto.chaoY);
    ctx.lineTo(_ppW / 2, longe.chaoY);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = Math.max(1, 2 * perto.escala);
    ctx.stroke();

    var apronAltura = 15 * perto.escala;
    ctx.beginPath();
    ctx.moveTo(_ppW / 2 - perto.largMesa, perto.chaoY);
    ctx.lineTo(_ppW / 2 + perto.largMesa, perto.chaoY);
    ctx.lineTo(_ppW / 2 + perto.largMesa, perto.chaoY + apronAltura);
    ctx.lineTo(_ppW / 2 - perto.largMesa, perto.chaoY + apronAltura);
    ctx.closePath();
    ctx.fillStyle = PP_APRON_COR;
    ctx.fill();
  }

  // Rede decorativa em d=0.5 (mesmo ponto pros dois lados — 0.5 não
  // muda ao inverter profundidade). Não é física de verdade — é só
  // desenhada na frente ou atrás da bola conforme a profundidade
  // dela em _ppDesenhar.
  function _ppDesenharRede() {
    var ctx = _ppCtx;
    var baseE = _ppProjetar(-1, 0.5, 0), baseD = _ppProjetar(1, 0.5, 0);
    var topoE = _ppProjetar(-1, 0.5, PP_REDE_ALTURA), topoD = _ppProjetar(1, 0.5, PP_REDE_ALTURA);

    ctx.beginPath();
    ctx.moveTo(baseE.x, baseE.chaoY);
    ctx.lineTo(baseD.x, baseD.chaoY);
    ctx.lineTo(topoD.x, topoD.y);
    ctx.lineTo(topoE.x, topoE.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(230,238,245,0.5)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (var i = 1; i <= 2; i++) {
      var f = i / 3;
      var e = _ppProjetar(-1, 0.5, PP_REDE_ALTURA * f);
      var d = _ppProjetar(1, 0.5, PP_REDE_ALTURA * f);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(topoE.x, topoE.y);
    ctx.lineTo(topoD.x, topoD.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.5, 2.5 * baseE.escala);
    ctx.stroke();

    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(baseE.x - 1.5, topoE.y, 3, Math.max(0, baseE.chaoY - topoE.y));
    ctx.fillRect(baseD.x - 1.5, topoD.y, 3, Math.max(0, baseD.chaoY - topoD.y));
  }

  function _ppDesenharBola(renderD) {
    var ctx = _ppCtx;
    var chaoBola = _ppProjetar(_ppBola.x, renderD, 0);
    var bola = _ppProjetar(_ppBola.x, renderD, _ppBola.h);

    ctx.beginPath();
    ctx.ellipse(chaoBola.x, chaoBola.chaoY, 7 * chaoBola.escala, 2.5 * chaoBola.escala, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(bola.x, bola.y, Math.max(2, 6 * bola.escala), 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Raquete estilizada (naipe + cabo), sem braço/boneco — só a peça,
  // desenhada na altura em que o jogador (ou a CPU) a está segurando.
  // O cabo sempre aponta pra "fora da rede": pra baixo/perto na
  // minha (renderD perto de 0), pra cima/longe na do adversário.
  function _ppDesenharRaquete(x, altura, renderD, cor) {
    var p = _ppProjetar(x, renderD, altura);
    var raio = 21 * p.escala;
    var caboComp = 15 * p.escala, caboLarg = 8 * p.escala;
    var paraFora = (renderD < 0.5) ? 1 : -1;
    var caboY = paraFora > 0 ? raio * 0.55 : -(raio * 0.55 + caboComp);
    var ctx = _ppCtx;

    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-caboLarg / 2, caboY, caboLarg, caboComp, caboLarg / 2);
    else ctx.rect(-caboLarg / 2, caboY, caboLarg, caboComp);
    ctx.fillStyle = '#3a2a1a';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, 0, raio, raio * 0.82, 0, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 12 * p.escala;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, 2 * p.escala);
    ctx.stroke();

    var brilho = ctx.createRadialGradient(-raio * 0.3, -raio * 0.3, 1, 0, 0, raio * 1.15);
    brilho.addColorStop(0, 'rgba(255,255,255,0.35)');
    brilho.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.ellipse(0, 0, raio, raio * 0.82, 0, 0, Math.PI * 2);
    ctx.fillStyle = brilho;
    ctx.fill();

    // Sombra no chão embaixo da raquete — reforça a leitura de altura.
    if (altura > 0.02) {
      var chao = _ppProjetar(x, renderD, 0);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(chao.x, chao.chaoY, raio * 0.7, raio * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.35, 0.12 + altura * 0.3) + ')';
      ctx.fill();
    }
    ctx.restore();
  }

  // Aviso central quando a bola está parada esperando o saque — some
  // assim que _ppExecutarSaque roda (local ou pelo estado da rede).
  function _ppDesenharPromptSaque() {
    var ctx = _ppCtx;
    var minha = _ppEhMinhaVezDeSacar();
    var texto = minha ? 'Toque para sacar' : 'Aguardando o saque…';
    ctx.save();
    ctx.font = "600 15px 'Syne', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 6;
    ctx.fillText(texto, _ppW / 2, _ppH * 0.5);
    ctx.restore();
  }
})();
