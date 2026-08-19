/* ═══════════════════════════════════════════════════════════════
   PING PONG DA CORUJA — módulo de jogo (lazy-loaded)
   1x1 em tempo real, em 1ª pessoa: a câmera fica atrás da sua
   raquete olhando pra mesa, só as raquetes aparecem (sem bonecos).
   Multiplayer de verdade via Jogos/multiplayer.js (AngatubaMP) —
   sala por código de 4 letras, dados trafegando P2P (WebRTC).

   MODELO DE REDE (host-autoritativo, o jeito mais simples de
   acertar num jogo 1x1 casual sem servidor):
     - Quem CRIA a sala (anfitrião) simula a bola sozinho e manda o
       estado (posição da bola + placar) pro adversário a cada
       quadro. O adversário só desenha o que recebe.
     - Quem ENTRA na sala (convidado) só manda a posição da PRÓPRIA
       raquete; nunca decide o que a bola faz.
     - Isso evita o problema clássico de física duplicada/dessincro-
       nizada entre os dois lados — só existe UMA simulação, a do
       anfitrião, e o resto é sincronia de tela.

   COORDENADAS (compartilhadas entre os dois, geradas pelo
   anfitrião): x em [-1,1] (lateral, não é espelhado — os dois lados
   enxergam "esquerda" do mesmo jeito, é um jogo estilizado, não uma
   simulação física da mesa real) · d em [0,1] (profundidade: d=0 é
   o fundo do ANFITRIÃO, d=1 é o fundo do CONVIDADO). Cada tela
   converte d pra "perto de mim" na hora de desenhar — ver _ppRenderD.

   Fala com o app só via window.AngatubaGames (a ponte) e com a rede
   só via window.AngatubaMP (Jogos/multiplayer.js). Expõe
   window.PingPongGame = { preparar, comecar, parar }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Ajustes do jogo ─────────────────────────────────────────── */
  var PP_PONTOS_VITORIA   = 7;      // primeiro a chegar aqui vence
  var PP_RAQUETE_MEIA_LARG = 0.22;  // metade da largura da raquete, em x (-1..1)
  var PP_VEL_D_INICIAL    = 1.05;   // "unidades de profundidade" por segundo
  var PP_VEL_D_INCREMENTO = 1.035;  // acelera um pouco a cada rebatida
  var PP_VEL_D_MAX        = 2.3;
  var PP_VEL_X_MAX        = 1.6;
  var PP_EFEITO_TOQUE     = 2.4;    // o quanto tocar fora do centro da raquete desvia a bola
  var PP_ARCO_ALTURA      = 0.32;   // altura visual do arco da bola (curva pra cima no meio)

  /* ── Perspectiva (projeção falsa-3D em canvas 2D) ────────────── */
  var PP_Y_PERTO   = 0.90;  // fração da altura da tela onde fica o fundo PERTO (embaixo)
  var PP_Y_LONGE   = 0.16;  // fração da altura da tela onde fica o fundo LONGE (em cima)
  var PP_LARG_PERTO = 0.46; // meia-largura da mesa PERTO, fração da largura da tela
  var PP_LARG_LONGE = 0.15; // meia-largura da mesa LONGE, fração da largura da tela
  var PP_ESCALA_PERTO = 1.0;
  var PP_ESCALA_LONGE = 0.34;

  var _ppCanvas = null, _ppCtx = null, _ppW = 0, _ppH = 0, _ppDpr = 1;
  var _ppRAF = 0, _ppUltimoTs = 0;
  var _ppEstado = 'inicio';   // inicio | sala | jogando | fim
  var _ppSouAnfitriao = false;
  var _ppEventosLigados = false;

  // Estado da partida (referencial do ANFITRIÃO; só ele escreve nele).
  var _ppBola = { x: 0, d: 0.5, vx: 0, vd: 0 };
  var _ppVelD = PP_VEL_D_INICIAL;
  var _ppPlacarAnfitriao = 0, _ppPlacarConvidado = 0;

  // Raquetes (x em -1..1). A própria é controlada por toque; a do
  // adversário só é atualizada pela rede.
  var _ppMinhaRaqueteX = 0;
  var _ppRaqueteAdversarioX = 0; // no anfitrião: última posição recebida do convidado
                                  // no convidado: última posição recebida do anfitrião (via estado 'e')

  var _ppApelidoAdversario = '';
  var _ppArrastando = false;
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
    _ppEstado = 'inicio';
    _ppSouAnfitriao = false;
  }

  window._ppComecar = _ppComecar;
  window.PingPongGame = { preparar: _ppPreparar, comecar: _ppComecar, parar: _ppParar };

  /* ── Telas (overlays) ─────────────────────────────────────────
     3 overlays fixos no HTML: pp-menu (criar/entrar), pp-sala
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
  }

  function _ppErroMenu(msg) {
    var el = document.getElementById('pp-menu-erro');
    if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  }
  function _ppLimparErroMenu() { _ppErroMenu(''); }

  /* ── Ações do menu inicial ───────────────────────────────────── */
  function _ppCriarSala() {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _ppErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    _ppLimparErroMenu();
    var btn = document.getElementById('pp-btn-criar');
    if (btn) btn.disabled = true;
    window.AngatubaMP.criarSala().then(function (codigo) {
      _ppSouAnfitriao = true;
      _ppMostrarSala('aguardando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _ppErroMenu((err && err.message) || 'Não consegui criar a sala.');
    });
  }

  function _ppEntrarSala() {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _ppErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    var input = document.getElementById('pp-codigo-input');
    var codigo = input ? input.value : '';
    _ppLimparErroMenu();
    var btn = document.getElementById('pp-btn-entrar');
    if (btn) btn.disabled = true;
    window.AngatubaMP.entrarSala(codigo).then(function () {
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
    _ppSouAnfitriao = false;
    var btnC = document.getElementById('pp-btn-criar');
    var btnE = document.getElementById('pp-btn-entrar');
    if (btnC) btnC.disabled = false;
    if (btnE) btnE.disabled = false;
    _ppMostrarTela('inicio');
  }

  window._ppCriarSala  = _ppCriarSala;
  window._ppEntrarSala = _ppEntrarSala;
  window._ppCopiarCodigo = _ppCopiarCodigo;
  window._ppVoltarMenu = _ppVoltarMenu;
  window._ppPedirRevanche = function () {
    if (_ppSouAnfitriao) { _ppReiniciarPartida(); _ppEnviarReinicio(); _ppComecarPartida(); }
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
      case 'p': // convidado -> anfitrião: posição da raquete do convidado
        if (_ppSouAnfitriao && typeof dado.x === 'number') _ppRaqueteAdversarioX = _ppClamp(dado.x, -1, 1);
        break;
      case 'e': // anfitrião -> convidado: estado da bola + placar
        if (!_ppSouAnfitriao) {
          _ppBola.x = dado.bx; _ppBola.d = dado.bd;
          _ppRaqueteAdversarioX = dado.hx;
          _ppPlacarAnfitriao = dado.sh; _ppPlacarConvidado = dado.sg;
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
    if (window.AngatubaMP) window.AngatubaMP.enviar({ t: 'rr' });
  }

  /* ── Controles (arrastar a própria raquete) ─────────────────────
     Pointer Events cobrem toque e mouse com a mesma API; captura o
     ponteiro pra continuar recebendo o arraste mesmo se o dedo sair
     da área do canvas. */
  function _ppXDoEvento(clientX) {
    var r = _ppCanvas.getBoundingClientRect();
    var frac = (clientX - r.left) / (r.width || 1);
    return _ppClamp(frac * 2 - 1, -1, 1);
  }
  function _ppPointerDown(e) {
    if (_ppEstado !== 'jogando') return;
    _ppArrastando = true;
    try { _ppCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    _ppMinhaRaqueteX = _ppXDoEvento(e.clientX);
    _ppEnviarMinhaRaquete();
    if (e.cancelable) e.preventDefault();
  }
  function _ppPointerMove(e) {
    if (!_ppArrastando || _ppEstado !== 'jogando') return;
    _ppMinhaRaqueteX = _ppXDoEvento(e.clientX);
    _ppEnviarMinhaRaquete();
    if (e.cancelable) e.preventDefault();
  }
  function _ppPointerUp() { _ppArrastando = false; }
  function _ppEnviarMinhaRaquete() {
    if (!window.AngatubaMP) return;
    if (_ppSouAnfitriao) return; // o anfitrião já tem a própria posição local; só o convidado precisa mandar
    window.AngatubaMP.enviar({ t: 'p', x: _ppMinhaRaqueteX });
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
     Só o ANFITRIÃO chama _ppSimular/_ppLoop de verdade calculando
     física; o CONVIDADO só redesenha o que chega pela rede — mas os
     dois compartilham o mesmo _ppLoop (requestAnimationFrame) pra
     desenhar a cada quadro. */
  function _ppReiniciarPartida() {
    _ppPlacarAnfitriao = 0; _ppPlacarConvidado = 0;
    _ppVelD = PP_VEL_D_INICIAL;
    _ppServir(Math.random() < 0.5 ? 0 : 1);
    _ppAtualizarHUD();
  }
  function _ppServir(paraD) {
    _ppBola.x = 0;
    _ppBola.d = paraD; // sai do fundo de quem tomou o ponto (ou sorteado no saque inicial)
    var sentido = paraD === 0 ? 1 : -1;
    _ppBola.vd = sentido * _ppVelD;
    _ppBola.vx = (Math.random() * 0.6 - 0.3);
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

  // Só roda no anfitrião: move a bola, checa colisão com as duas
  // raquetes e paredes, e manda o estado pro convidado.
  function _ppSimular(dt) {
    if (!dt) { _ppEnviarEstado(false); return; }
    _ppBola.d += _ppBola.vd * dt;
    _ppBola.x += _ppBola.vx * dt;
    if (_ppBola.x > 1) { _ppBola.x = 1; _ppBola.vx = -Math.abs(_ppBola.vx); }
    if (_ppBola.x < -1) { _ppBola.x = -1; _ppBola.vx = Math.abs(_ppBola.vx); }

    var fimDePonto = null; // 'anfitriao' | 'convidado' — quem MARCOU o ponto

    if (_ppBola.d <= 0) {
      if (Math.abs(_ppBola.x - _ppMinhaRaqueteX) <= PP_RAQUETE_MEIA_LARG) {
        _ppRebater(_ppMinhaRaqueteX, 1);
      } else {
        fimDePonto = 'convidado';
      }
    } else if (_ppBola.d >= 1) {
      if (Math.abs(_ppBola.x - _ppRaqueteAdversarioX) <= PP_RAQUETE_MEIA_LARG) {
        _ppRebater(_ppRaqueteAdversarioX, -1);
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
      _ppVelD = PP_VEL_D_INICIAL;
      // Quem tomou o ponto saca em seguida (sai do fundo dele).
      _ppServir(fimDePonto === 'anfitriao' ? 1 : 0);
    }

    _ppEnviarEstado(false);
  }

  function _ppRebater(raqueteX, novoSentidoVd) {
    _ppVelD = Math.min(PP_VEL_D_MAX, _ppVelD * PP_VEL_D_INCREMENTO);
    _ppBola.vd = novoSentidoVd * _ppVelD;
    _ppBola.vx = _ppClamp(_ppBola.vx + (_ppBola.x - raqueteX) * PP_EFEITO_TOQUE, -PP_VEL_X_MAX, PP_VEL_X_MAX);
    _ppBola.d = _ppClamp(_ppBola.d, 0, 1);
  }

  var _ppUltimoEnvio = 0;
  function _ppEnviarEstado(fim) {
    if (!window.AngatubaMP) return;
    // ~30 msgs/s é de sobra pra um jogo casual e não sobrecarrega o canal.
    var agora = performance.now();
    if (!fim && (agora - _ppUltimoEnvio) < 33) return;
    _ppUltimoEnvio = agora;
    window.AngatubaMP.enviar({
      t: 'e', bx: _ppBola.x, bd: _ppBola.d, hx: _ppMinhaRaqueteX,
      sh: _ppPlacarAnfitriao, sg: _ppPlacarConvidado, fim: !!fim
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
     quem desenha é o convidado (ver a chamada abaixo). As raquetes
     não precisam inverter nada: a minha é sempre "perto", a do
     adversário é sempre "longe". */
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

  function _ppDesenhar() {
    if (!_ppCtx || !_ppW || !_ppH) return;
    var ctx = _ppCtx;
    ctx.clearRect(0, 0, _ppW, _ppH);

    // Fundo
    var grad = ctx.createLinearGradient(0, 0, 0, _ppH);
    grad.addColorStop(0, '#0a0f1a');
    grad.addColorStop(1, '#0d1626');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, _ppW, _ppH);

    // Mesa (trapézio em perspectiva)
    var perto = _ppProjetar(0, 0, 0), longe = _ppProjetar(0, 1, 0);
    ctx.beginPath();
    ctx.moveTo(_ppW / 2 - perto.largMesa, perto.chaoY);
    ctx.lineTo(_ppW / 2 + perto.largMesa, perto.chaoY);
    ctx.lineTo(_ppW / 2 + longe.largMesa, longe.chaoY);
    ctx.lineTo(_ppW / 2 - longe.largMesa, longe.chaoY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(45, 212, 150, 0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(45, 212, 150, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Linha central (rede) — só decorativa, sem física de rede.
    var meio = _ppProjetar(0, 0.5, 0);
    var meioLarg = meio.largMesa;
    ctx.beginPath();
    ctx.moveTo(_ppW / 2 - meioLarg, meio.chaoY);
    ctx.lineTo(_ppW / 2 + meioLarg, meio.chaoY);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (_ppEstado === 'jogando') {
      // Sombra + bola
      var renderDBola = _ppSouAnfitriao ? _ppBola.d : (1 - _ppBola.d);
      var chaoBola = _ppProjetar(_ppBola.x, renderDBola, 0);
      var arco = Math.sin(_ppClamp(_ppBola.d, 0, 1) * Math.PI) * PP_ARCO_ALTURA;
      var bola = _ppProjetar(_ppBola.x, renderDBola, arco);

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

    // Raquete do adversário (longe, em cima)
    _ppDesenharRaquete(_ppRaqueteAdversarioX, 1, '#ff6b81');
    // Minha raquete (perto, embaixo)
    _ppDesenharRaquete(_ppMinhaRaqueteX, 0, '#38bdf8');
  }

  function _ppDesenharRaquete(x, renderD, cor) {
    var p = _ppProjetar(x, renderD, 0);
    var largura = 46 * p.escala, altura = 14 * p.escala;
    var ctx = _ppCtx;
    ctx.save();
    ctx.translate(p.x, p.chaoY);
    ctx.beginPath();
    ctx.ellipse(0, 0, largura / 2, altura / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 10 * p.escala;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
})();
