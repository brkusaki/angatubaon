/* ═══════════════════════════════════════════════════════════════
   BATALHA DE TANQUES — módulo de jogo (lazy-loaded)
   1x1 em tempo real, arena quadrada vista de cima. Cada jogador
   controla um tanque, precisa girar antes de andar pra frente, e
   atira nos blocos de tijolo (destrutíveis) e no tanque adversário.
   Dois modos: sozinho contra a CPU, ou multiplayer de verdade via
   Jogos/multiplayer.js (AngatubaMP) — mesma sala por código de 4
   letras usada pelo Ping Pong, dados trafegando P2P (WebRTC).

   MODELO DE REDE (hibrido — diferente do Ping Pong porque aqui os
   DOIS tanques são controlados por pessoas, não só um lado):
     - Cada jogador simula o PRÓPRIO tanque localmente (rotação +
       avanço, colisão com parede) — responde na hora, sem esperar
       a rede. Como o layout de paredes é fixo (só o estado
       destruída/intacta muda), os dois lados calculam a mesma
       colisão sem precisar combinar nada.
     - Só o ANFITRIÃO simula os PROJÉTEIS (nascem, colidem com
       parede/tanque, morrem) e o estado das paredes (dano) — exidem
       autoridade única, senão os dois lados veem coisas diferentes
       (a bola no Ping Pong tem o mesmo motivo). O convidado manda
       {t:'p', x,y,ang} com a própria posição a cada quadro e
       {t:'tiro', x,y,ang} quando atira; o anfitrião manda de volta
       {t:'e', ...} com a posição dele, os projéteis, o estado das
       paredes e o placar da partida.
     - No modo sozinho não tem rede nenhuma: o próprio jogador simula
       o proprio tanque, e o "convidado" é a CPU (ver _tqAtualizarIA).

   FÍSICA DO TANQUE: ângulo 0 = mirando pro norte (cima da tela),
   cresce no sentido horário (mesma convenção do ctx.rotate). Empurrar
   o joystick numa direção GIRA o tanque pra lá (limitado por
   TQ_GIRO_VEL) e avança na direção que o tanque JÁ está apontando
   (não direto pro joystick) — é o que dá a sensação de "gira, depois
   anda" sem precisar de uma máquina de estados separada.

   PAREDES: layout fixo, simétrico (mesmo dos dois lados, sem
   sincronizar geometria — só o dano). Cada parede aguenta
   TQ_PAREDE_HP tiros antes de virar escombro (para de bloquear).

   Fala com o app só via window.AngatubaGames (a ponte) e com a rede
   só via window.AngatubaMP (Jogos/multiplayer.js). Expõe
   window.TanquesGame = { preparar, comecar, parar }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Ajustes do jogo ─────────────────────────────────────────── */
  var TQ_RODADAS_PARA_VENCER = 2;    // melhor de 3 — primeiro a 2 vitórias de rodada
  var TQ_RAIO_TANQUE   = 0.052;      // raio de colisão do tanque (espaço 0..1)
  var TQ_RAIO_PROJETIL = 0.010;
  var TQ_VELOCIDADE    = 0.34;       // unidades de arena por segundo, com o joystick no talo
  var TQ_GIRO_VEL       = 4.6;       // rad/s — quão rápido o tanque gira até apontar pro alvo
  var TQ_VEL_PROJETIL  = 0.95;
  var TQ_COOLDOWN_TIRO = 0.45;       // segundos entre tiros (por lado)
  var TQ_PAREDE_HP     = 2;          // tiros até a parede virar escombro
  var TQ_DEADZONE      = 0.12;       // magnitude mínima do joystick pra contar como "empurrado"
  var TQ_PAUSA_RODADA  = 1.4;        // segundos de pausa mostrando quem venceu a rodada

  /* ── Paredes: layout fixo, gerado a partir de metade + espelho
     180° (ver cabeçalho) — garante simetria sem risco de erro de
     conta manual. Coordenadas em fração da arena (0..1, quadrada). */
  var _TQ_PAREDES_BASE = [
    { x: 0.08, y: 0.42, w: 0.20, h: 0.07 },
    { x: 0.36, y: 0.08, w: 0.07, h: 0.18 },
    { x: 0.30, y: 0.46, w: 0.09, h: 0.09 }
  ];
  var _TQ_PAREDES_GEOM = (function () {
    var lista = _TQ_PAREDES_BASE.slice();
    for (var i = 0; i < _TQ_PAREDES_BASE.length; i++) {
      var b = _TQ_PAREDES_BASE[i];
      lista.push({ x: 1 - b.x - b.w, y: 1 - b.y - b.h, w: b.w, h: b.h });
    }
    lista.push({ x: 0.46, y: 0.46, w: 0.08, h: 0.08 }); // bloco central (auto-simétrico)
    return lista;
  })();

  var TQ_SPAWN_ANFITRIAO = { x: 0.5, y: 0.88, ang: 0 };          // embaixo, mirando pro norte
  var TQ_SPAWN_CONVIDADO = { x: 0.5, y: 0.12, ang: Math.PI };    // em cima, mirando pro sul

  var _tqCanvas = null, _tqCtx = null, _tqW = 0, _tqH = 0, _tqDpr = 1;
  var _tqRAF = 0, _tqUltimoTs = 0;
  var _tqEstado = 'inicio';   // inicio | sala | jogando | fim
  var _tqModo = null;         // 'solo' | 'multiplayer'
  var _tqSouAnfitriao = false;
  var _tqEventosLigados = false;
  var _tqSalasDesligar = null;
  var _tqSaindoVoluntariamente = false;
  var _tqApelidoAdversario = '';

  // Tanques: {x,y,ang} em espaço 0..1. O anfitrião é sempre azul, o
  // convidado (ou a CPU) é sempre vermelho — independe de quem
  // "ganhou" a sala, é só uma cor fixa de cada papel.
  var _tqTanqueAnfitriao = { x: TQ_SPAWN_ANFITRIAO.x, y: TQ_SPAWN_ANFITRIAO.y, ang: TQ_SPAWN_ANFITRIAO.ang };
  var _tqTanqueConvidado = { x: TQ_SPAWN_CONVIDADO.x, y: TQ_SPAWN_CONVIDADO.y, ang: TQ_SPAWN_CONVIDADO.ang };

  var _tqProjeteis = [];      // { x,y,vx,vy,dono } — dono: 'anfitriao' | 'convidado'
  var _tqParedes = [];        // { x,y,w,h,hp,destruida } — geometria de _TQ_PAREDES_GEOM + estado
  var _tqPlacarAnfitriao = 0, _tqPlacarConvidado = 0; // rodadas vencidas na partida
  var _tqRodadaEstado = 'jogando'; // 'jogando' | 'pausa'
  var _tqPausaTimer = 0, _tqPausaVencedor = null;
  var _tqCooldownAnfitriao = 0, _tqCooldownConvidado = 0;

  // Entrada local (joystick) — vetor normalizado -1..1, magnitude
  // até 1. Atualizado pelo widget DOM (ver _tqLigarJoystick).
  var _tqInputVec = { x: 0, y: 0 };
  var _tqMeuCooldown = 0;

  /* ── IA (modo sozinho) ───────────────────────────────────────── */
  var _tqIATimer = 0, _tqIAModo = 'patrulha', _tqIAAlvoPatrulha = { x: 0.5, y: 0.3 };

  /* ── Cenário/assets: mesmo padrão do cenario-floresta.webp da
     Corrida e da cenario-arena.webp do Ping Pong — carrega cedo,
     cai num visual vetorial de fallback se faltar/falhar. Base:
     /Jogos/assets/tanques/ (T maiúsculo no "Jogos"; GitHub Pages é
     case-sensitive). */
  var _TQ_ASSET_BASE = '/Jogos/assets/tanques/';
  var _tqAssets = {};
  function _tqAsset(nome) {
    if (_tqAssets[nome]) return _tqAssets[nome];
    var reg = { img: null, ok: false, w: 0, h: 0 };
    _tqAssets[nome] = reg;
    try {
      var im = new Image();
      im.onload = function () {
        reg.ok = true; reg.img = im;
        reg.w = im.naturalWidth || 0; reg.h = im.naturalHeight || 0;
      };
      im.src = _TQ_ASSET_BASE + nome;
      reg.img = im;
    } catch (e) {}
    return reg;
  }

  /* ── Ponte com o app ────────────────────────────────────────── */
  function _tqBridge() { return window.AngatubaGames || null; }

  /* ── Ciclo de vida ─────────────────────────────────────────────*/
  function _tqPreparar() {
    _tqCanvas = document.getElementById('tq-canvas');
    if (!_tqCanvas) return;
    _tqCtx = _tqCanvas.getContext('2d');
    _tqLigarJoystick();
    _tqLigarBotaoFogo();
    _tqLigarEventosRede();
    if (!_tqResizeOn) {
      var reaval = function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _tqDimensionar();
          _tqDesenhar();
        }
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', reaval);
      _tqResizeOn = true;
    }
    _tqDimensionar();
    _tqAsset('chao-arena.webp');
    _tqAsset('tank-azul.webp');
    _tqAsset('tank-vermelho.webp');
    _tqAsset('parede-tijolo.webp');
    _tqAsset('parede-escombros.webp');
    _tqMostrarTela('inicio');
    _tqLimparErroMenu();
    _tqResetParedes();
    _tqDesenhar();
  }
  var _tqResizeOn = false;

  function _tqComecar() { _tqPreparar(); }

  function _tqParar() {
    if (_tqRAF) { cancelAnimationFrame(_tqRAF); _tqRAF = 0; }
    if (window.AngatubaMP) { _tqSaindoVoluntariamente = true; window.AngatubaMP.sair(); }
    _tqPararListaSalas();
    _tqEstado = 'inicio';
    _tqModo = null;
    _tqSouAnfitriao = false;
  }

  window.TanquesGame = { preparar: _tqPreparar, comecar: _tqComecar, parar: _tqParar };

  /* ── Telas (overlays) ───────────────────────────────────────────
     3 overlays fixos no HTML: tq-menu (sozinho/criar/entrar), tq-sala
     (aguardando ou conectando) e tq-fim (resultado/erro). Durante
     'jogando' nenhum aparece — só o HUD + canvas + controles. */
  function _tqMostrarTela(qual) {
    _tqEstado = qual;
    var menu = document.getElementById('tq-menu');
    var sala = document.getElementById('tq-sala');
    var fim  = document.getElementById('tq-fim');
    if (menu) menu.style.display = (qual === 'inicio') ? '' : 'none';
    if (sala) sala.style.display = (qual === 'sala') ? '' : 'none';
    if (fim)  fim.style.display  = (qual === 'fim')  ? '' : 'none';
    var hud = document.getElementById('tq-hud');
    if (hud) hud.style.display = (qual === 'jogando') ? '' : 'none';
    var controles = document.getElementById('tq-controles');
    if (controles) controles.style.display = (qual === 'jogando') ? '' : 'none';
    if (qual === 'inicio') {
      var btnC = document.getElementById('tq-btn-criar');
      var btnE = document.getElementById('tq-btn-entrar');
      if (btnC) btnC.disabled = false;
      if (btnE) btnE.disabled = false;
      _tqIniciarListaSalas();
    } else {
      _tqPararListaSalas();
    }
  }

  function _tqErroMenu(msg) {
    var el = document.getElementById('tq-menu-erro');
    if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  }
  function _tqLimparErroMenu() { _tqErroMenu(''); }

  /* ── Lista de salas públicas abertas agora — mesmo padrão do
     Ping Pong (ver _ppIniciarListaSalas). */
  function _tqIniciarListaSalas() {
    if (_tqSalasDesligar || !window.AngatubaMP || typeof window.AngatubaMP.listarSalas !== 'function') return;
    _tqSalasDesligar = window.AngatubaMP.listarSalas(_tqRenderizarSalas);
  }
  function _tqPararListaSalas() {
    if (_tqSalasDesligar) { try { _tqSalasDesligar(); } catch (e) {} _tqSalasDesligar = null; }
  }
  function _tqEscaparHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _tqRenderizarSalas(lista) {
    var wrap = document.getElementById('tq-lista-salas');
    if (!wrap) return;
    if (!lista || !lista.length) {
      wrap.innerHTML = '<div class="tq-lista-vazia">Nenhuma sala pública aberta agora.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      html += '<div class="tq-sala-item">' +
                '<span class="tq-sala-item-nome">' + _tqEscaparHtml(s.nome) + '</span>' +
                '<button type="button" class="tq-sala-item-btn" onclick="_tqEntrarSala(\'' + _tqEscaparHtml(s.codigo) + '\')">Entrar</button>' +
              '</div>';
    }
    wrap.innerHTML = html;
  }

  /* ── Ações do menu inicial ───────────────────────────────────── */
  function _tqJogarSozinho() {
    _tqModo = 'solo';
    _tqSouAnfitriao = true;
    _tqApelidoAdversario = 'Computador';
    _tqReiniciarPartida();
    _tqComecarPartida();
  }

  function _tqCriarSala() {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _tqErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    _tqLimparErroMenu();
    var btn = document.getElementById('tq-btn-criar');
    if (btn) btn.disabled = true;
    var chkPrivada = document.getElementById('tq-privada-check');
    var publica = !(chkPrivada && chkPrivada.checked);
    window.AngatubaMP.criarSala(publica).then(function (codigo) {
      _tqModo = 'multiplayer';
      _tqSouAnfitriao = true;
      _tqMostrarSala('aguardando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _tqErroMenu((err && err.message) || 'Não consegui criar a sala.');
    });
  }

  function _tqEntrarSala(codigoForcado) {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _tqErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    var input = document.getElementById('tq-codigo-input');
    var codigo = codigoForcado || (input ? input.value : '');
    _tqLimparErroMenu();
    var btn = document.getElementById('tq-btn-entrar');
    if (btn) btn.disabled = true;
    window.AngatubaMP.entrarSala(codigo).then(function () {
      _tqModo = 'multiplayer';
      _tqSouAnfitriao = false;
      _tqMostrarSala('conectando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _tqErroMenu((err && err.message) || 'Não consegui entrar na sala.');
    });
  }

  function _tqMostrarSala(modo, codigo) {
    _tqMostrarTela('sala');
    var titulo = document.getElementById('tq-sala-titulo');
    var desc   = document.getElementById('tq-sala-desc');
    var codEl  = document.getElementById('tq-sala-codigo');
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

  function _tqCopiarCodigo() {
    var codEl = document.getElementById('tq-sala-codigo');
    var codigo = codEl ? codEl.textContent : '';
    if (!codigo || !navigator.clipboard) return;
    navigator.clipboard.writeText(codigo).then(function () {
      var btn = document.getElementById('tq-btn-copiar');
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(function () { btn.textContent = original; }, 1500);
    }).catch(function () {});
  }

  function _tqVoltarMenu() {
    if (_tqRAF) { cancelAnimationFrame(_tqRAF); _tqRAF = 0; }
    if (window.AngatubaMP) { _tqSaindoVoluntariamente = true; window.AngatubaMP.sair(); }
    _tqModo = null;
    _tqSouAnfitriao = false;
    var btnC = document.getElementById('tq-btn-criar');
    var btnE = document.getElementById('tq-btn-entrar');
    if (btnC) btnC.disabled = false;
    if (btnE) btnE.disabled = false;
    _tqMostrarTela('inicio');
  }

  window._tqJogarSozinho = _tqJogarSozinho;
  window._tqCriarSala = _tqCriarSala;
  window._tqEntrarSala = _tqEntrarSala;
  window._tqCopiarCodigo = _tqCopiarCodigo;
  window._tqVoltarMenu = _tqVoltarMenu;
  window._tqPedirRevanche = function () {
    if (_tqModo === 'solo') { _tqReiniciarPartida(); _tqComecarPartida(); }
    else if (_tqSouAnfitriao) { _tqReiniciarPartida(); _tqEnviarReinicio(); _tqComecarPartida(); }
    else if (window.AngatubaMP) window.AngatubaMP.enviar({ t: 'pr' });
    var btn = document.getElementById('tq-btn-revanche');
    if (btn) btn.disabled = true;
  };

  /* ── Rede: eventos do AngatubaMP (ligados uma única vez) ──────── */
  function _tqLigarEventosRede() {
    if (_tqEventosLigados || !window.AngatubaMP) return;
    _tqEventosLigados = true;

    window.AngatubaMP.on('conectado', function () {
      var bridge = _tqBridge();
      var meuNome = (bridge && bridge.apelido && bridge.apelido()) || 'Jogador';
      window.AngatubaMP.enviar({ t: 'oi', nome: meuNome });
      if (_tqSouAnfitriao) _tqReiniciarPartida();
      _tqComecarPartida();
    });

    window.AngatubaMP.on('mensagem', _tqReceberMensagem);

    window.AngatubaMP.on('desconectado', function () {
      if (_tqSaindoVoluntariamente) { _tqSaindoVoluntariamente = false; return; }
      if (_tqEstado === 'jogando' || _tqEstado === 'sala') _tqMostrarFim('desconexao');
    });

    window.AngatubaMP.on('erro', function (err) {
      if (_tqEstado === 'sala') _tqErroMenu((err && err.message) || 'Falha na conexão.');
    });
  }

  function _tqReceberMensagem(dado) {
    if (!dado || !dado.t) return;
    switch (dado.t) {
      case 'oi':
        _tqApelidoAdversario = String(dado.nome || 'Adversário').slice(0, 20);
        _tqAtualizarHUD();
        break;
      case 'p': // convidado -> anfitrião: posição/ângulo do tanque do convidado
        if (_tqSouAnfitriao) {
          if (typeof dado.x === 'number') _tqTanqueConvidado.x = _tqClamp(dado.x, 0, 1);
          if (typeof dado.y === 'number') _tqTanqueConvidado.y = _tqClamp(dado.y, 0, 1);
          if (typeof dado.ang === 'number') _tqTanqueConvidado.ang = dado.ang;
        }
        break;
      case 'tiro': // convidado avisa que atirou — só o anfitrião spawna o projétil (é quem tem autoridade)
        if (_tqSouAnfitriao && _tqRodadaEstado === 'jogando' && _tqCooldownConvidado <= 0) {
          _tqCooldownConvidado = TQ_COOLDOWN_TIRO;
          _tqCriarProjetil(dado.x, dado.y, dado.ang, 'convidado');
        }
        break;
      case 'e': // anfitrião -> convidado: estado do mundo inteiro
        if (!_tqSouAnfitriao) {
          _tqTanqueAnfitriao.x = dado.hx; _tqTanqueAnfitriao.y = dado.hy; _tqTanqueAnfitriao.ang = dado.hang;
          _tqProjeteis = dado.pj || [];
          if (dado.pd) {
            for (var i = 0; i < _tqParedes.length && i < dado.pd.length; i++) {
              _tqParedes[i].destruida = !!dado.pd[i];
            }
          }
          _tqPlacarAnfitriao = dado.sa || 0; _tqPlacarConvidado = dado.sg || 0;
          _tqRodadaEstado = dado.re || 'jogando';
          _tqAtualizarHUD();
          if (dado.fim) _tqMostrarFim('fim');
        }
        break;
      case 'rr':
        if (!_tqSouAnfitriao) { _tqReiniciarPartida(); _tqComecarPartida(); }
        break;
      case 'pr':
        if (_tqSouAnfitriao) { _tqReiniciarPartida(); _tqEnviarReinicio(); _tqComecarPartida(); }
        break;
    }
  }

  function _tqEnviarReinicio() {
    if (_tqModo === 'multiplayer' && window.AngatubaMP) window.AngatubaMP.enviar({ t: 'rr' });
  }

  /* ── Controles: joystick (DOM, arraste) + botão de fogo ──────────
     Um joystick só: a direção que ele aponta já gira o tanque pra lá
     E avança na direção que o tanque JÁ está apontando (ver cabeçalho
     do arquivo) — não precisa de controle separado pra girar. */
  var _tqJoyId = null, _tqJoyRaio = 44;
  function _tqLigarJoystick() {
    var base = document.getElementById('tq-joystick');
    var thumb = document.getElementById('tq-joystick-thumb');
    if (!base || !thumb || base._tqLigado) return;
    base._tqLigado = true;

    function aplicar(clientX, clientY) {
      var r = base.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = clientX - cx, dy = clientY - cy;
      var raio = r.width / 2 || _tqJoyRaio;
      var dist = Math.hypot(dx, dy);
      var mag = Math.min(1, dist / raio);
      var ang = Math.atan2(dy, dx);
      var nx = Math.cos(ang) * mag, ny = Math.sin(ang) * mag;
      _tqInputVec.x = nx; _tqInputVec.y = ny;
      thumb.style.transform = 'translate(' + (nx * raio * 0.55) + 'px,' + (ny * raio * 0.55) + 'px)';
    }
    function soltar() {
      _tqJoyId = null;
      _tqInputVec.x = 0; _tqInputVec.y = 0;
      thumb.style.transform = 'translate(0,0)';
    }
    base.addEventListener('pointerdown', function (e) {
      _tqJoyId = e.pointerId;
      try { base.setPointerCapture(e.pointerId); } catch (err) {}
      aplicar(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    });
    base.addEventListener('pointermove', function (e) {
      if (_tqJoyId !== e.pointerId) return;
      aplicar(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    });
    base.addEventListener('pointerup', function (e) { if (_tqJoyId === e.pointerId) soltar(); });
    base.addEventListener('pointercancel', function (e) { if (_tqJoyId === e.pointerId) soltar(); });
  }

  function _tqLigarBotaoFogo() {
    var btn = document.getElementById('tq-fire-btn');
    if (!btn || btn._tqLigado) return;
    btn._tqLigado = true;
    btn.addEventListener('pointerdown', function (e) {
      _tqTentarAtirar();
      if (e.cancelable) e.preventDefault();
    });
  }

  /* ── Dimensionamento (mesmo padrão dos outros jogos em canvas) ─ */
  function _tqDimensionar() {
    if (!_tqCanvas) return;
    var cssW = _tqCanvas.offsetWidth || 320;
    var cssH = _tqCanvas.offsetHeight || 320;
    if (cssW < 2) cssW = 320;
    if (cssH < 2) cssH = 320;
    _tqDpr = Math.min(2, window.devicePixelRatio || 1);
    _tqCanvas.width = Math.round(cssW * _tqDpr);
    _tqCanvas.height = Math.round(cssH * _tqDpr);
    _tqW = cssW; _tqH = cssH;
    if (_tqCtx) _tqCtx.setTransform(_tqDpr, 0, 0, _tqDpr, 0, 0);
  }

  function _tqClamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

  /* ── Paredes: estado (hp/destruída) — geometria vem de
     _TQ_PAREDES_GEOM (fixa, nunca muda). */
  function _tqResetParedes() {
    _tqParedes = _TQ_PAREDES_GEOM.map(function (g) {
      return { x: g.x, y: g.y, w: g.w, h: g.h, hp: TQ_PAREDE_HP, destruida: false };
    });
  }

  function _tqCircRect(cx, cy, r, rect) {
    var nx = _tqClamp(cx, rect.x, rect.x + rect.w);
    var ny = _tqClamp(cy, rect.y, rect.y + rect.h);
    var dx = cx - nx, dy = cy - ny;
    return (dx * dx + dy * dy) < (r * r);
  }

  function _tqColideParede(cx, cy, raio) {
    for (var i = 0; i < _tqParedes.length; i++) {
      var p = _tqParedes[i];
      if (p.destruida) continue;
      if (_tqCircRect(cx, cy, raio, p)) return true;
    }
    return false;
  }

  /* ── Partida ──────────────────────────────────────────────────*/
  function _tqReiniciarPartida() {
    _tqPlacarAnfitriao = 0; _tqPlacarConvidado = 0;
    _tqIniciarRodada();
    _tqAtualizarHUD();
  }

  function _tqIniciarRodada() {
    _tqTanqueAnfitriao.x = TQ_SPAWN_ANFITRIAO.x; _tqTanqueAnfitriao.y = TQ_SPAWN_ANFITRIAO.y; _tqTanqueAnfitriao.ang = TQ_SPAWN_ANFITRIAO.ang;
    _tqTanqueConvidado.x = TQ_SPAWN_CONVIDADO.x; _tqTanqueConvidado.y = TQ_SPAWN_CONVIDADO.y; _tqTanqueConvidado.ang = TQ_SPAWN_CONVIDADO.ang;
    _tqProjeteis = [];
    _tqResetParedes();
    _tqRodadaEstado = 'jogando';
    _tqPausaVencedor = null;
    _tqCooldownAnfitriao = 0; _tqCooldownConvidado = 0;
    _tqIAModo = 'patrulha'; _tqIATimer = 0;
  }

  function _tqComecarPartida() {
    _tqMostrarTela('jogando');
    _tqUltimoTs = 0;
    if (_tqRAF) cancelAnimationFrame(_tqRAF);
    _tqRAF = requestAnimationFrame(_tqLoop);
  }

  function _tqMeuTanque() { return _tqSouAnfitriao ? _tqTanqueAnfitriao : _tqTanqueConvidado; }

  function _tqLoop(ts) {
    if (_tqEstado !== 'jogando') return;
    var dt = _tqUltimoTs ? Math.min(0.05, (ts - _tqUltimoTs) / 1000) : 0;
    _tqUltimoTs = ts;
    if (dt) {
      _tqMeuCooldown = Math.max(0, _tqMeuCooldown - dt);
      if (_tqRodadaEstado === 'jogando') _tqAtualizarTanque(_tqMeuTanque(), _tqInputVec.x, _tqInputVec.y, dt);
      if (_tqSouAnfitriao) _tqSimularMundo(dt);
      else _tqEnviarMeuTanque();
    }
    _tqDesenhar();
    _tqRAF = requestAnimationFrame(_tqLoop);
  }

  // Gira o tanque em direção ao vetor de entrada (limitado por
  // TQ_GIRO_VEL) e avança na direção que ele JÁ está apontando —
  // não direto pro vetor. Colisão com parede resolvida por eixo
  // (desliza ao raspar numa quina, não trava).
  function _tqAtualizarTanque(t, ix, iy, dt) {
    var mag = Math.min(1, Math.hypot(ix, iy));
    if (mag <= TQ_DEADZONE) return;
    var alvo = Math.atan2(ix, -iy);
    var diff = alvo - t.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var maxDelta = TQ_GIRO_VEL * dt;
    if (diff > maxDelta) diff = maxDelta; else if (diff < -maxDelta) diff = -maxDelta;
    t.ang += diff;
    var v = TQ_VELOCIDADE * mag * dt;
    var dx = Math.sin(t.ang) * v, dy = -Math.cos(t.ang) * v;
    var novoX = _tqClamp(t.x + dx, TQ_RAIO_TANQUE, 1 - TQ_RAIO_TANQUE);
    if (!_tqColideParede(novoX, t.y, TQ_RAIO_TANQUE)) t.x = novoX;
    var novoY = _tqClamp(t.y + dy, TQ_RAIO_TANQUE, 1 - TQ_RAIO_TANQUE);
    if (!_tqColideParede(t.x, novoY, TQ_RAIO_TANQUE)) t.y = novoY;
  }

  // Só o anfitrião chama: avança a IA (modo sozinho), os projéteis e
  // a lógica de rodada/placar, e manda o estado pro convidado (se
  // for multiplayer).
  function _tqSimularMundo(dt) {
    if (_tqCooldownAnfitriao > 0) _tqCooldownAnfitriao -= dt;
    if (_tqCooldownConvidado > 0) _tqCooldownConvidado -= dt;

    if (_tqRodadaEstado === 'pausa') {
      _tqPausaTimer -= dt;
      if (_tqPausaTimer <= 0) _tqIniciarRodada();
      _tqEnviarEstado(false);
      return;
    }

    if (_tqModo === 'solo') _tqAtualizarIA(dt);
    _tqAtualizarProjeteis(dt);
    _tqEnviarEstado(false);
  }

  function _tqAtualizarProjeteis(dt) {
    for (var i = _tqProjeteis.length - 1; i >= 0; i--) {
      var pr = _tqProjeteis[i];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.x < 0 || pr.x > 1 || pr.y < 0 || pr.y > 1) { _tqProjeteis.splice(i, 1); continue; }

      var atingiuParede = false;
      for (var j = 0; j < _tqParedes.length; j++) {
        var p = _tqParedes[j];
        if (p.destruida) continue;
        if (_tqCircRect(pr.x, pr.y, TQ_RAIO_PROJETIL, p)) {
          p.hp--;
          if (p.hp <= 0) p.destruida = true;
          atingiuParede = true;
          break;
        }
      }
      if (atingiuParede) { _tqProjeteis.splice(i, 1); continue; }

      // Só pode acertar o tanque do OUTRO lado (não tem "fogo amigo"
      // consigo mesmo — nem faria sentido, o alvo é sempre o rival).
      var alvo = (pr.dono === 'anfitriao') ? _tqTanqueConvidado : _tqTanqueAnfitriao;
      var dist = Math.hypot(pr.x - alvo.x, pr.y - alvo.y);
      if (dist < TQ_RAIO_TANQUE + TQ_RAIO_PROJETIL) {
        _tqProjeteis.splice(i, 1);
        _tqFimDeRodada(pr.dono === 'anfitriao' ? 'anfitriao' : 'convidado');
        return;
      }
    }
  }

  function _tqFimDeRodada(vencedor) {
    if (vencedor === 'anfitriao') _tqPlacarAnfitriao++; else _tqPlacarConvidado++;
    _tqRodadaEstado = 'pausa';
    _tqPausaTimer = TQ_PAUSA_RODADA;
    _tqPausaVencedor = vencedor;
    _tqAtualizarHUD();

    var partidaAcabou = (_tqPlacarAnfitriao >= TQ_RODADAS_PARA_VENCER || _tqPlacarConvidado >= TQ_RODADAS_PARA_VENCER);
    if (partidaAcabou) {
      _tqEnviarEstado(true);
      _tqMostrarFim('fim');
      return;
    }
    _tqEnviarEstado(false);
  }

  function _tqCriarProjetil(x, y, ang, dono) {
    // nasce um pouco à frente do cano, já fora do próprio corpo do
    // tanque, senão colidiria com a própria parede/tanque no 1º quadro.
    var offset = TQ_RAIO_TANQUE + 0.02;
    var px = x + Math.sin(ang) * offset, py = y - Math.cos(ang) * offset;
    _tqProjeteis.push({
      x: px, y: py,
      vx: Math.sin(ang) * TQ_VEL_PROJETIL, vy: -Math.cos(ang) * TQ_VEL_PROJETIL,
      dono: dono
    });
  }

  function _tqTentarAtirar() {
    if (_tqEstado !== 'jogando' || _tqRodadaEstado !== 'jogando' || _tqMeuCooldown > 0) return;
    _tqMeuCooldown = TQ_COOLDOWN_TIRO;
    var t = _tqMeuTanque();
    if (_tqSouAnfitriao) {
      if (_tqCooldownAnfitriao <= 0) {
        _tqCooldownAnfitriao = TQ_COOLDOWN_TIRO;
        _tqCriarProjetil(t.x, t.y, t.ang, 'anfitriao');
      }
    } else if (window.AngatubaMP) {
      window.AngatubaMP.enviar({ t: 'tiro', x: t.x, y: t.y, ang: t.ang });
    }
  }

  var _tqUltimoEnvioTanque = 0;
  function _tqEnviarMeuTanque() {
    if (_tqModo !== 'multiplayer' || !window.AngatubaMP) return;
    var agora = performance.now();
    if ((agora - _tqUltimoEnvioTanque) < 33) return;
    _tqUltimoEnvioTanque = agora;
    var t = _tqMeuTanque();
    window.AngatubaMP.enviar({ t: 'p', x: t.x, y: t.y, ang: t.ang });
  }

  var _tqUltimoEnvioEstado = 0;
  function _tqEnviarEstado(fim) {
    if (_tqModo !== 'multiplayer' || !window.AngatubaMP) return;
    var agora = performance.now();
    if (!fim && (agora - _tqUltimoEnvioEstado) < 33) return;
    _tqUltimoEnvioEstado = agora;
    var pd = _tqParedes.map(function (p) { return p.destruida ? 1 : 0; });
    window.AngatubaMP.enviar({
      t: 'e', hx: _tqTanqueAnfitriao.x, hy: _tqTanqueAnfitriao.y, hang: _tqTanqueAnfitriao.ang,
      pj: _tqProjeteis, pd: pd,
      sa: _tqPlacarAnfitriao, sg: _tqPlacarConvidado, re: _tqRodadaEstado, fim: !!fim
    });
  }

  /* ── IA (modo sozinho) — controla o tanque "convidado" ────────── */
  function _tqLinhaLivre(a, b) {
    var passos = 8;
    for (var i = 1; i < passos; i++) {
      var t = i / passos;
      var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (_tqColideParede(x, y, 0.01)) return false;
    }
    return true;
  }

  function _tqAtualizarIA(dt) {
    var eu = _tqTanqueConvidado, alvo = _tqTanqueAnfitriao;
    _tqIATimer -= dt;
    if (_tqIATimer <= 0) {
      _tqIATimer = 0.4 + Math.random() * 0.5;
      var dist = Math.hypot(alvo.x - eu.x, alvo.y - eu.y);
      if (dist < 0.62 && _tqLinhaLivre(eu, alvo)) {
        _tqIAModo = 'engajar';
      } else {
        _tqIAModo = 'patrulha';
        _tqIAAlvoPatrulha = { x: 0.18 + Math.random() * 0.64, y: 0.18 + Math.random() * 0.64 };
      }
    }

    var ix = 0, iy = 0;
    if (_tqIAModo === 'engajar') {
      var angMira = Math.atan2(alvo.x - eu.x, -(alvo.y - eu.y));
      ix = Math.sin(angMira) * 0.7; iy = -Math.cos(angMira) * 0.7;
      var diff = angMira - eu.ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.16 && _tqCooldownConvidado <= 0 && _tqLinhaLivre(eu, alvo)) {
        _tqCooldownConvidado = TQ_COOLDOWN_TIRO * (1.1 + Math.random() * 0.6);
        _tqCriarProjetil(eu.x, eu.y, eu.ang, 'convidado');
      }
    } else {
      var dx = _tqIAAlvoPatrulha.x - eu.x, dy = _tqIAAlvoPatrulha.y - eu.y;
      var d = Math.hypot(dx, dy) || 1;
      ix = dx / d; iy = dy / d;
      if (d < 0.06) _tqIATimer = 0; // chegou: escolhe outro alvo já no próximo quadro
    }
    _tqAtualizarTanque(eu, ix, iy, dt);
  }

  function _tqMostrarFim(motivo) {
    if (_tqRAF) { cancelAnimationFrame(_tqRAF); _tqRAF = 0; }
    _tqMostrarTela('fim');
    var titulo = document.getElementById('tq-fim-titulo');
    var msg = document.getElementById('tq-fim-msg');
    var placar = document.getElementById('tq-fim-placar');
    var owlEl = document.getElementById('tq-fim-owl');
    var meu = _tqSouAnfitriao ? _tqPlacarAnfitriao : _tqPlacarConvidado;
    var dele = _tqSouAnfitriao ? _tqPlacarConvidado : _tqPlacarAnfitriao;
    var btnRev = document.getElementById('tq-btn-revanche');
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
    if (msg) msg.textContent = venceu ? 'Mandou bem contra ' + (_tqApelidoAdversario || 'seu adversário') + '!'
                                       : (_tqApelidoAdversario || 'Seu adversário') + ' levou essa.';
    if (placar) { placar.textContent = meu + ' x ' + dele; placar.style.display = ''; }
    if (btnRev) btnRev.style.display = '';
    if (owlEl) { owlEl.src = venceu ? '/webp/owl-trophy.webp' : '/webp/owl-wave.webp'; owlEl.style.display = ''; }

    var bridge = _tqBridge();
    if (venceu && bridge && bridge.efeitos) bridge.efeitos.confete('tq-fim', 80);
  }

  function _tqAtualizarHUD() {
    var meu = _tqSouAnfitriao ? _tqPlacarAnfitriao : _tqPlacarConvidado;
    var dele = _tqSouAnfitriao ? _tqPlacarConvidado : _tqPlacarAnfitriao;
    var elNome = document.getElementById('tq-hud-nome-adversario');
    if (elNome) elNome.textContent = _tqApelidoAdversario || 'Adversário';
    _tqAtualizarPips('tq-hud-meu-pips', meu);
    _tqAtualizarPips('tq-hud-dele-pips', dele);
  }
  function _tqAtualizarPips(id, valor) {
    var wrap = document.getElementById(id);
    if (!wrap) return;
    var pips = wrap.querySelectorAll('.tq-pip');
    for (var i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('tq-pip-cheio', i < valor);
    }
  }

  /* ── Desenho (top-down direto, sem perspectiva — arena quadrada) ─ */
  var TQ_COR_ANFITRIAO = '#3aa0ff';
  var TQ_COR_CONVIDADO = '#ff4757';

  function _tqDesenhar() {
    if (!_tqCtx || !_tqW || !_tqH) return;
    var ctx = _tqCtx;
    ctx.clearRect(0, 0, _tqW, _tqH);
    _tqDesenharChao();
    _tqDesenharParedes();

    var jogando = (_tqEstado === 'jogando');
    if (jogando) {
      for (var i = 0; i < _tqProjeteis.length; i++) _tqDesenharProjetil(_tqProjeteis[i]);
      _tqDesenharTanque(_tqTanqueAnfitriao, 'tank-azul.webp', TQ_COR_ANFITRIAO);
      _tqDesenharTanque(_tqTanqueConvidado, 'tank-vermelho.webp', TQ_COR_CONVIDADO);
      if (_tqRodadaEstado === 'pausa') _tqDesenharAvisoRodada();
    }
  }

  function _tqDesenharChao() {
    var ctx = _tqCtx;
    var reg = _tqAsset('chao-arena.webp');
    if (reg && reg.ok && reg.img && reg.w && reg.h) {
      var escala = Math.max(_tqW / reg.w, _tqH / reg.h);
      var dw = reg.w * escala, dh = reg.h * escala;
      ctx.drawImage(reg.img, (_tqW - dw) / 2, (_tqH - dh) / 2, dw, dh);
      return;
    }
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(0, 0, _tqW, _tqH);
  }

  function _tqDesenharParedes() {
    var ctx = _tqCtx;
    var regTijolo = _tqAsset('parede-tijolo.webp');
    var regEscombro = _tqAsset('parede-escombros.webp');
    for (var i = 0; i < _tqParedes.length; i++) {
      var p = _tqParedes[i];
      var px = p.x * _tqW, py = p.y * _tqH, pw = p.w * _tqW, ph = p.h * _tqH;
      var reg = p.destruida ? regEscombro : regTijolo;
      if (reg && reg.ok && reg.img) {
        ctx.drawImage(reg.img, px, py, pw, ph);
      } else {
        ctx.fillStyle = p.destruida ? 'rgba(120,90,70,0.35)' : '#8a4a3a';
        ctx.fillRect(px, py, pw, ph);
      }
    }
  }

  function _tqDesenharProjetil(pr) {
    var ctx = _tqCtx;
    var cor = pr.dono === 'anfitriao' ? TQ_COR_ANFITRIAO : TQ_COR_CONVIDADO;
    var x = pr.x * _tqW, y = pr.y * _tqH;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, TQ_RAIO_PROJETIL * _tqW * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = cor;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
  }

  // Pivô vertical do sprite (fração da altura, de cima pra baixo) —
  // os dois tanques têm o cano apontando pra cima na imagem-fonte,
  // então giram em torno do CENTRO DO CASCO (não do centro da
  // imagem, que inclui o cano saindo pra cima de forma assimétrica).
  var TQ_PIVO_Y = 0.63;
  function _tqDesenharTanque(t, arquivo, corFallback) {
    var ctx = _tqCtx;
    var reg = _tqAsset(arquivo);
    var cx = t.x * _tqW, cy = t.y * _tqH;
    var diametroTela = TQ_RAIO_TANQUE * 2 * _tqW;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t.ang);

    if (reg && reg.ok && reg.img && reg.w && reg.h) {
      var altura = diametroTela / (TQ_PIVO_Y * 1.32); // casco ocupa ~1.32x o raio em altura
      var largura = altura * (reg.w / reg.h);
      ctx.drawImage(reg.img, -largura / 2, -altura * TQ_PIVO_Y, largura, altura);
    } else {
      ctx.fillStyle = corFallback;
      ctx.beginPath();
      ctx.arc(0, 0, diametroTela / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-diametroTela * 0.08, -diametroTela * 0.65, diametroTela * 0.16, diametroTela * 0.6);
    }
    ctx.restore();
  }

  function _tqDesenharAvisoRodada() {
    var ctx = _tqCtx;
    var euGanhei = _tqPausaVencedor === (_tqSouAnfitriao ? 'anfitriao' : 'convidado');
    var texto = _tqModo === 'solo'
      ? (euGanhei ? 'Você acertou!' : 'O computador acertou!')
      : (euGanhei ? 'Você venceu a rodada!' : (_tqApelidoAdversario || 'Adversário') + ' venceu a rodada!');
    ctx.save();
    ctx.font = "700 16px 'Syne', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(texto, _tqW / 2, _tqH * 0.5);
    ctx.restore();
  }
})();
