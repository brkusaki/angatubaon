/* ═══════════════════════════════════════════════════════════════
   BATALHA DE TANQUES — módulo de jogo (lazy-loaded)
   1x1 em tempo real, arena widescreen (16:9) vista de cima. Cada
   jogador controla um tanque, precisa girar antes de andar pra
   frente, e atira nos blocos de tijolo (destrutíveis) e no tanque
   adversário.
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

   PAREDES: sorteadas de um POOL de mapas fixos (_TQ_MAPAS) no início
   de cada PARTIDA (não a cada rodada) — cada mapa é simétrico (metade
   + espelho 180°, ver _tqMontarMapa). Só o ANFITRIÃO sorteia; o mapa
   escolhido viaja pro convidado dentro da mensagem 'oi' (conexão) ou
   'rr' (revanche) — depois disso os dois lados têm a MESMA geometria
   e só sincronizam o dano (destruída/intacta), igual antes. Cada
   parede aguenta TQ_PAREDE_HP tiros antes de virar escombro (para de
   bloquear). Tiros que saem da arena (borda) quicam UMA vez antes de
   sumir (ver TQ_RICOCHETE_MAX em _tqAtualizarProjeteis). Cada mapa
   também tem moitas (não bloqueiam) — escondem o tanque que estiver
   dentro E não tiver atirado nos últimos TQ_MOITA_REVELA_SEG segundos
   (ver _tqEmMoita/_tqEscondido*), tanto do desenho do adversário
   quanto da mira da IA.

   ARENA E LANDSCAPE: mundo vai de x:0..MUNDO_LARGURA (16/9) e y:0..1
   — todo pixel-por-unidade usa _tqH (altura real do canvas) como
   fator uniforme pros dois eixos, porque o CSS trava aspect-ratio:
   16/9 na arena (_tqW = _tqH × MUNDO_LARGURA sempre). Em celular
   deitado ou com o lock nativo de tela (screen.orientation.lock), o
   canvas já nasce nessa proporção; em retrato sem o lock, o wrapper
   #tq-rot gira 90° por CSS (mesmo padrão da Corrida, ver
   _tqAplicarOrientacao) — o joystick então precisa converter toque em
   tela pra espaço local antes de calcular direção (_tqDeltaLocal).

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
  var TQ_RICOCHETE_MAX = 1;          // quantas vezes um tiro pode quicar na borda da arena antes de sumir

  var MUNDO_LARGURA = 16 / 9;   // arena widescreen — x vai de 0..MUNDO_LARGURA, y continua 0..1
  var TQ_IA_DIST_ENGAJAR = 0.86; // distância (mundo largo) até a IA trocar patrulha por engajar

  /* ── Pool de mapas: cada um é "metade" + espelho 180° (ver
     cabeçalho) — garante simetria sem risco de erro de conta manual.
     Coordenadas em fração da arena: x 0..MUNDO_LARGURA, y 0..1. Um
     mapa é sorteado por PARTIDA (não por rodada), ver _tqEscolherMapa
     e o campo "mapa" nas mensagens 'oi'/'rr'. Cada mapa tem paredes
     (bloqueiam e levam dano) e moitas (não bloqueiam — escondem o
     tanque que estiver dentro, ver _tqEmMoita/_tqEscondido*). */
  function _tqMontarMapa(metade, centro) {
    var lista = metade.slice();
    for (var i = 0; i < metade.length; i++) {
      var b = metade[i];
      lista.push({ x: MUNDO_LARGURA - b.x - b.w, y: 1 - b.y - b.h, w: b.w, h: b.h });
    }
    if (centro) lista.push(centro);
    return lista;
  }
  var _TQ_MAPAS = [
    // 1. Clássico — pilar + bloco, variação do layout original
    {
      paredes: _tqMontarMapa([
        { x: 0.42, y: 0.10, w: 0.07, h: 0.22 },
        { x: 0.40, y: 0.66, w: 0.20, h: 0.08 }
      ], { x: 0.8439, y: 0.46, w: 0.09, h: 0.09 }),
      moitas: _tqMontarMapa([{ x: 0.26, y: 0.40, w: 0.13, h: 0.18 }])
    },
    // 2. Corredores — paredes verticais formando 2 corredores
    {
      paredes: _tqMontarMapa([
        { x: 0.50, y: 0.00, w: 0.06, h: 0.30 },
        { x: 0.50, y: 0.70, w: 0.06, h: 0.30 },
        { x: 0.78, y: 0.30, w: 0.06, h: 0.40 }
      ]),
      moitas: _tqMontarMapa([{ x: 0.30, y: 0.62, w: 0.14, h: 0.16 }])
    },
    // 3. Cantos — blocos protegendo os 4 cantos do centro
    {
      paredes: _tqMontarMapa([
        { x: 0.34, y: 0.06, w: 0.16, h: 0.09 },
        { x: 0.34, y: 0.85, w: 0.16, h: 0.09 },
        { x: 0.66, y: 0.44, w: 0.10, h: 0.12 }
      ]),
      moitas: _tqMontarMapa([{ x: 0.28, y: 0.28, w: 0.12, h: 0.14 }])
    },
    // 4. Cruz — pilar vertical no centro + 2 blocos laterais
    {
      paredes: _tqMontarMapa([
        { x: 0.62, y: 0.42, w: 0.20, h: 0.16 }
      ], { x: 0.8389, y: 0.10, w: 0.10, h: 0.80 }),
      moitas: _tqMontarMapa([{ x: 0.32, y: 0.66, w: 0.14, h: 0.16 }])
    },
    // 5. Zigue-zague — blocos escalonados
    {
      paredes: _tqMontarMapa([
        { x: 0.38, y: 0.06, w: 0.09, h: 0.24 },
        { x: 0.55, y: 0.38, w: 0.09, h: 0.24 },
        { x: 0.72, y: 0.70, w: 0.09, h: 0.24 }
      ]),
      moitas: _tqMontarMapa([{ x: 0.26, y: 0.44, w: 0.12, h: 0.14 }])
    },
    // 6. Aberto — poucos obstáculos, mapa rápido (2 moitas — mais espaço livre)
    {
      paredes: _tqMontarMapa([
        { x: 0.55, y: 0.42, w: 0.11, h: 0.16 }
      ]),
      moitas: _tqMontarMapa([
        { x: 0.30, y: 0.20, w: 0.15, h: 0.17 },
        { x: 0.34, y: 0.64, w: 0.13, h: 0.15 }
      ])
    }
  ];
  var _tqMapaAtualIdx = 0;
  function _tqEscolherMapa() { return Math.floor(Math.random() * _TQ_MAPAS.length); }

  var TQ_SPAWN_ANFITRIAO = { x: 0.14, y: 0.5, ang: Math.PI / 2 };                  // esquerda, mirando pro leste
  var TQ_SPAWN_CONVIDADO = { x: MUNDO_LARGURA - 0.14, y: 0.5, ang: -Math.PI / 2 }; // direita, mirando pro oeste

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
  var _tqParedes = [];        // { x,y,w,h,hp,destruida } — geometria de _TQ_MAPAS[_tqMapaAtualIdx] + estado
  var _tqPlacarAnfitriao = 0, _tqPlacarConvidado = 0; // rodadas vencidas na partida
  var _tqRodadaEstado = 'jogando'; // 'jogando' | 'pausa'
  var _tqPausaTimer = 0, _tqPausaVencedor = null;
  var _tqCooldownAnfitriao = 0, _tqCooldownConvidado = 0;

  /* ── Moitas (furtividade): só o ANFITRIÃO calcula (tem as duas
     posições) — _tqRevelar* conta quanto tempo falta pro tanque parar
     de ficar "revelado" depois de atirar (mesmo dentro da moita, atirar
     denuncia a posição por TQ_MOITA_REVELA_SEG). _tqEscondido* é o
     resultado (dentro da moita E não revelado) — usado pro desenho
     (não renderiza o tanque escondido do adversário) e pela IA (não
     mira o que não vê). _tqEscondidoAnfitriao viaja pro convidado via
     'e' (campo "ea"); _tqEscondidoConvidado só importa pro anfitrião
     (ele já calcula e desenha os dois lados). */
  var TQ_MOITA_REVELA_SEG = 1.2;
  var _tqRevelarAnfitriao = 0, _tqRevelarConvidado = 0;
  var _tqEscondidoAnfitriao = false, _tqEscondidoConvidado = false;

  // Entrada local (joystick) — vetor normalizado -1..1, magnitude
  // até 1. Atualizado pelo widget DOM (ver _tqLigarJoystick).
  var _tqInputVec = { x: 0, y: 0 };
  var _tqMeuCooldown = 0;

  /* ── Game feel: screen shake, recuo do canhão e rastro de esteira ─
     Puramente visuais/locais — cada cliente calcula por conta própria
     a partir do que já está sincronizado (posição, parede destruída,
     fim de rodada), sem precisar de mensagem nova na rede. */
  var _tqShakeTimer = 0, _tqShakeDuracaoBase = 0, _tqShakeForcaBase = 0;
  var TQ_SHAKE_PAREDE_DUR = 0.22, TQ_SHAKE_PAREDE_FORCA = 6;   // parede destruída
  var TQ_SHAKE_ACERTO_DUR = 0.38, TQ_SHAKE_ACERTO_FORCA = 11;  // fim de rodada (tanque atingido)

  var _tqRecuoAnfitriao = 0, _tqRecuoConvidado = 0; // 0..1, decai a cada quadro
  var TQ_RECUO_DECAI = 7.5; // por segundo

  var _tqRastro = [];              // { x, y, ang, vida } em espaço 0..1
  var _tqUltimaPosAnfitriao = null, _tqUltimaPosConvidado = null;
  var TQ_RASTRO_DIST_MIN = 0.018;  // distância mínima entre marcas
  var TQ_RASTRO_VIDA     = 2.2;    // segundos até sumir
  var TQ_RASTRO_MAX      = 220;    // teto de marcas simultâneas (performance)

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
        if (window._gamesHubAberto && window._gamesHubAberto()) _tqAplicarOrientacao();
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', reaval);
      // O giro do lock nativo dispara 'change' no screen.orientation
      // QUANDO a tela termina de girar de verdade (o .then do lock
      // resolve antes) — remede em passos, o layout assenta aos poucos.
      try {
        if (screen && screen.orientation && screen.orientation.addEventListener) {
          screen.orientation.addEventListener('change', function () {
            reaval();
            setTimeout(reaval, 60);
            setTimeout(reaval, 200);
            setTimeout(reaval, 450);
          });
        }
      } catch (e) {}
      _tqResizeOn = true;
    }
    _tqDimensionar();
    _tqAsset('chao-arena.webp');
    _tqAsset('tank-azul.webp');
    _tqAsset('tank-vermelho.webp');
    _tqAsset('parede-tijolo.webp');
    _tqAsset('parede-escombros.webp');
    // Pede ao sistema pra girar pra landscape (instalado/fullscreen);
    // em navegador comum é recusado e cai na rotação por CSS.
    _tqTravarLandscape();
    _tqMostrarTela('inicio');
    _tqLimparErroMenu();
    _tqResetParedes();
    _tqAplicarOrientacaoRepetido();
    _tqDesenhar();
  }
  var _tqResizeOn = false;

  function _tqComecar() { _tqPreparar(); }

  function _tqParar() {
    if (_tqRAF) { cancelAnimationFrame(_tqRAF); _tqRAF = 0; }
    if (window.AngatubaMP) { _tqSaindoVoluntariamente = true; window.AngatubaMP.sair(); }
    _tqPararListaSalas();
    _tqDestravarOrientacao();
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
    if (qual !== 'jogando') _tqResetJoystickVisual();
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
      var msg = { t: 'oi', nome: meuNome };
      if (_tqSouAnfitriao) {
        // Anfitrião sorteia o mapa da partida e avisa o convidado dentro
        // do próprio "oi" — sem isso os dois lados desenhariam paredes
        // em lugares diferentes (só o dano é sincronizado depois).
        _tqReiniciarPartida();
        msg.mapa = _tqMapaAtualIdx;
      }
      window.AngatubaMP.enviar(msg);
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
        // Só o convidado aplica: o mapa que o anfitrião sorteou (ver
        // 'conectado' acima) — sem isso o convidado ficaria com o mapa
        // 0 (o default do _tqPreparar), diferente do lado do anfitrião.
        if (!_tqSouAnfitriao && typeof dado.mapa === 'number' && _TQ_MAPAS[dado.mapa]) {
          _tqMapaAtualIdx = dado.mapa;
          _tqResetParedes();
        }
        _tqAtualizarHUD();
        break;
      case 'p': // convidado -> anfitrião: posição/ângulo do tanque do convidado
        if (_tqSouAnfitriao) {
          if (typeof dado.x === 'number') _tqTanqueConvidado.x = _tqClamp(dado.x, 0, MUNDO_LARGURA);
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
          _tqEscondidoAnfitriao = !!dado.ea; // o anfitrião já calculou (tem as duas posições) — só aplica
          if (dado.pd) {
            // Detecta a TRANSIÇÃO intacta→destruída pra tremer a tela
            // também do lado do convidado (o anfitrião já treme sozinho
            // em _tqAtualizarProjeteis, que só roda nele).
            for (var i = 0; i < _tqParedes.length && i < dado.pd.length; i++) {
              var novaDestruida = !!dado.pd[i];
              if (novaDestruida && !_tqParedes[i].destruida) _tqAcionarShake(TQ_SHAKE_PAREDE_DUR, TQ_SHAKE_PAREDE_FORCA);
              _tqParedes[i].destruida = novaDestruida;
            }
          }
          _tqPlacarAnfitriao = dado.sa || 0; _tqPlacarConvidado = dado.sg || 0;
          // Mesma lógica pro tremor de "acertou o tanque": entrou em
          // pausa agora (não estava antes) = a rodada acabou de terminar.
          if (dado.re === 'pausa' && _tqRodadaEstado !== 'pausa') _tqAcionarShake(TQ_SHAKE_ACERTO_DUR, TQ_SHAKE_ACERTO_FORCA);
          _tqRodadaEstado = dado.re || 'jogando';
          _tqAtualizarHUD();
          if (dado.fim) _tqMostrarFim('fim');
        }
        break;
      case 'rr':
        // dado.mapa: o anfitrião já sorteou o mapa da revanche (ver
        // _tqEnviarReinicio) — o convidado usa o MESMO índice, nunca
        // sorteia por conta própria (senão os lados desincronizam).
        if (!_tqSouAnfitriao) { _tqReiniciarPartida(dado.mapa); _tqComecarPartida(); }
        break;
      case 'pr':
        if (_tqSouAnfitriao) { _tqReiniciarPartida(); _tqEnviarReinicio(); _tqComecarPartida(); }
        break;
    }
  }

  function _tqEnviarReinicio() {
    if (_tqModo === 'multiplayer' && window.AngatubaMP) window.AngatubaMP.enviar({ t: 'rr', mapa: _tqMapaAtualIdx });
  }

  /* ── Controles: joystick FLUTUANTE (DOM) + botão de fogo ──────────
     Um joystick só: a direção que ele aponta já gira o tanque pra lá
     E avança na direção que o tanque JÁ está apontando (ver cabeçalho
     do arquivo) — não precisa de controle separado pra girar.
     Flutuante: o círculo (tq-joystick) começa invisível; tq-joy-zona
     é a metade esquerda invisível da arena que captura o toque, e o
     círculo nasce exatamente onde o dedo encostou — evita o jogador
     ter que acertar um alvo fixo e olhar pro dedo em vez do jogo. */
  var _tqJoyId = null, _tqJoyRaio = 48;
  var _tqJoyOrigem = { x: 0, y: 0 }; // ponto (client coords) onde o dedo tocou — centro fixo até soltar

  // Girado por CSS (retrato sem lock nativo — ver _tqAplicarOrientacao),
  // tela e local deixam de ser os mesmos eixos: converte um delta em
  // coordenadas de TELA pro espaço LOCAL do canvas/controles antes de
  // calcular a direção do joystick. Sem rotação, é a identidade.
  function _tqRotacionado() {
    try {
      var rot = document.getElementById('tq-rot');
      if (rot && rot.getAttribute('data-rot') === '1') return true;
    } catch (e) {}
    return false;
  }
  function _tqDeltaLocal(dxTela, dyTela) {
    return _tqRotacionado() ? { x: dyTela, y: -dxTela } : { x: dxTela, y: dyTela };
  }
  // Chamado ao sair da tela 'jogando' (fim de rodada, desconexão, voltar
  // ao menu) — evita o círculo ficar "preso" visível/deslocado da
  // última posição na próxima vez que os controles aparecerem.
  function _tqResetJoystickVisual() {
    _tqJoyId = null;
    _tqInputVec.x = 0; _tqInputVec.y = 0;
    var base = document.getElementById('tq-joystick');
    var thumb = document.getElementById('tq-joystick-thumb');
    if (base) base.classList.remove('tq-joystick-ativo');
    if (thumb) thumb.style.transform = 'translate(0,0)';
  }
  function _tqLigarJoystick() {
    var zona = document.getElementById('tq-joy-zona');
    var base = document.getElementById('tq-joystick');
    var thumb = document.getElementById('tq-joystick-thumb');
    if (!zona || !base || !thumb || zona._tqLigado) return;
    zona._tqLigado = true;

    function aplicar(clientX, clientY) {
      var d = _tqDeltaLocal(clientX - _tqJoyOrigem.x, clientY - _tqJoyOrigem.y);
      var raio = _tqJoyRaio;
      var dist = Math.hypot(d.x, d.y);
      var mag = Math.min(1, dist / raio);
      var ang = Math.atan2(d.y, d.x);
      var nx = Math.cos(ang) * mag, ny = Math.sin(ang) * mag;
      _tqInputVec.x = nx; _tqInputVec.y = ny;
      thumb.style.transform = 'translate(' + (nx * raio * 0.55) + 'px,' + (ny * raio * 0.55) + 'px)';
    }
    function soltar() {
      _tqJoyId = null;
      _tqInputVec.x = 0; _tqInputVec.y = 0;
      thumb.style.transform = 'translate(0,0)';
      base.classList.remove('tq-joystick-ativo');
    }
    zona.addEventListener('pointerdown', function (e) {
      _tqJoyId = e.pointerId;
      try { zona.setPointerCapture(e.pointerId); } catch (err) {}
      _tqJoyOrigem.x = e.clientX; _tqJoyOrigem.y = e.clientY;
      var controles = zona.parentElement;
      var margem = _tqJoyRaio + 4;
      var localX, localY;
      if (_tqRotacionado() && controles && _tqRotLocalW && _tqRotLocalH) {
        // Girado: getBoundingClientRect() já reflete o retângulo visível
        // NA TELA (o CSS gira .tq-controles inteiro). Pra achar onde o
        // círculo nasce no espaço LOCAL (pré-rotação, eixos trocados —
        // ver _tqAplicarOrientacao), medimos o toque relativo ao CENTRO
        // e desfazemos a rotação com o mesmo _tqDeltaLocal do joystick.
        var cr = controles.getBoundingClientRect();
        var centroX = cr.left + cr.width / 2, centroY = cr.top + cr.height / 2;
        var d = _tqDeltaLocal(e.clientX - centroX, e.clientY - centroY);
        localX = d.x + _tqRotLocalW / 2;
        localY = d.y + _tqRotLocalH / 2;
        localX = Math.max(margem, Math.min(_tqRotLocalW - margem, localX));
        localY = Math.max(margem, Math.min(_tqRotLocalH - margem, localY));
      } else {
        // Sem rotação: posiciona o círculo no ponto tocado, em
        // coordenadas locais à zona (que cobre left:0/top:0 da
        // .tq-controles, mesma origem do .tq-joystick). Clampa pra não
        // desenhar cortado perto das bordas (usa a largura/altura da
        // própria .tq-controles, maior que a zona).
        var r = zona.getBoundingClientRect();
        localX = e.clientX - r.left; localY = e.clientY - r.top;
        if (controles) {
          var cr2 = controles.getBoundingClientRect();
          localX = Math.max(margem, Math.min(cr2.width - margem, localX));
          localY = Math.max(margem, Math.min(cr2.height - margem, localY));
        }
      }
      base.style.left = localX + 'px';
      base.style.top = localY + 'px';
      base.classList.add('tq-joystick-ativo');
      aplicar(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    });
    zona.addEventListener('pointermove', function (e) {
      if (_tqJoyId !== e.pointerId) return;
      aplicar(e.clientX, e.clientY);
      if (e.cancelable) e.preventDefault();
    });
    zona.addEventListener('pointerup', function (e) { if (_tqJoyId === e.pointerId) soltar(); });
    zona.addEventListener('pointercancel', function (e) { if (_tqJoyId === e.pointerId) soltar(); });
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
    var cssW, cssH;
    // Com lock nativo, o offsetWidth do canvas pode demorar a refletir
    // o giro do SO — medimos preferencialmente pela ARENA (o container
    // real, já no tamanho da tela girada); mesmo truque da Corrida.
    var arena = document.getElementById('tq-arena');
    if (_tqLockNativo && arena) {
      var ar = arena.getBoundingClientRect();
      cssW = Math.round(ar.width) || _tqCanvas.offsetWidth || 320;
      cssH = Math.round(ar.height) || _tqCanvas.offsetHeight || 320;
    } else {
      cssW = _tqCanvas.offsetWidth || 320;
      cssH = _tqCanvas.offsetHeight || 320;
    }
    if (cssW < 2) cssW = 320;
    if (cssH < 2) cssH = 320;
    _tqDpr = Math.min(2, window.devicePixelRatio || 1);
    _tqCanvas.width = Math.round(cssW * _tqDpr);
    _tqCanvas.height = Math.round(cssH * _tqDpr);
    _tqW = cssW; _tqH = cssH;
    if (_tqCtx) _tqCtx.setTransform(_tqDpr, 0, 0, _tqDpr, 0, 0);
  }

  /* ── Orientação nativa — pede ao sistema pra girar pra landscape (só
     funciona instalado/fullscreen; navegador comum recusa). Quando o
     lock nativo PEGA, o próprio SO gira a tela: a arena já nasce
     paisagem e NÃO rotacionamos por CSS (senão giraria 2x). Mesmo
     padrão da Corrida (_corTravarLandscape). ── */
  var _tqLockNativo = false;
  var _tqRotLocalW = 0, _tqRotLocalH = 0; // dimensões LOCAIS (pré-rotação) de #tq-rot/#tq-controles quando girados
  function _tqTravarLandscape() {
    try {
      if (screen && screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock('landscape');
        if (p && p.then) {
          p.then(function () {
            _tqLockNativo = true;
            _tqAplicarOrientacao();
          }).catch(function () {
            _tqLockNativo = false;   // navegador comum recusa → usa CSS
          });
        }
      }
    } catch (e) { _tqLockNativo = false; }
  }
  function _tqDestravarOrientacao() {
    try {
      if (screen && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {}
    _tqLockNativo = false;
  }

  /* ── Rotaciona a arena por CSS quando o device está em retrato e o
     lock nativo não pegou (data-rot=1 em #tq-rot e #tq-controles,
     dimensionados em px pelo JS — eixos trocados). Reavalia em
     resize/orientationchange. Mesmo padrão da Corrida
     (_corAplicarOrientacao). ── */
  function _tqAplicarOrientacao() {
    var rot = document.getElementById('tq-rot');
    var controles = document.getElementById('tq-controles');
    var arena = document.getElementById('tq-arena');
    var dica = document.getElementById('tq-gire');
    if (!rot) return;
    function limpar(el) {
      if (!el) return;
      el.setAttribute('data-rot', '0');
      el.style.width = ''; el.style.height = ''; el.style.top = ''; el.style.left = '';
    }
    if (_tqLockNativo) {
      limpar(rot); limpar(controles);
      if (dica) dica.style.display = 'none';
      _tqRotLocalW = 0; _tqRotLocalH = 0;
      _tqDimensionar();
      if (_tqEstado === 'jogando') _tqDesenhar();
      return;
    }
    // Detecta retrato pelas dimensões REAIS da arena (mais confiável em
    // fullscreen PWA que window.innerWidth/Height). Fallback pro window
    // se a arena ainda não tiver dimensões.
    var retrato;
    var ar = arena ? arena.getBoundingClientRect() : null;
    if (ar && ar.width > 2 && ar.height > 2) {
      retrato = (ar.height >= ar.width);
    } else {
      retrato = (window.innerHeight >= window.innerWidth);
    }
    if (retrato && arena && ar) {
      var pw = Math.max(1, Math.round(ar.width));
      var ph = Math.max(1, Math.round(ar.height));
      [rot, controles].forEach(function (el) {
        if (!el) return;
        el.setAttribute('data-rot', '1');
        el.style.width = ph + 'px'; el.style.height = pw + 'px';
        el.style.top = '50%'; el.style.left = '50%';
      });
      _tqRotLocalW = ph; _tqRotLocalH = pw;
      if (dica) dica.style.display = '';
    } else {
      limpar(rot); limpar(controles);
      _tqRotLocalW = 0; _tqRotLocalH = 0;
      if (dica) dica.style.display = 'none';
    }
    _tqDimensionar();
    if (_tqEstado === 'jogando') _tqDesenhar();
  }

  // O fullscreen do celular muda o tamanho da arena de forma ASSÍNCRONA
  // e em tempo variável — reaplica a orientação várias vezes após abrir
  // pra garantir que a rotação use as dimensões finais (mesmo padrão da
  // Corrida, _corAplicarOrientacaoRepetido).
  function _tqAplicarOrientacaoRepetido() {
    _tqAplicarOrientacao();
    var atrasos = [50, 150, 300, 500, 800];
    for (var i = 0; i < atrasos.length; i++) {
      setTimeout(function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) _tqAplicarOrientacao();
      }, atrasos[i]);
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { _tqAplicarOrientacao(); });
    }
  }

  function _tqClamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

  // Dispara/reinicia o tremor de tela. Uma segunda chamada enquanto um
  // tremor já está em andamento simplesmente substitui pelos novos
  // valores (o de fim de rodada, mais forte, "vence" um de parede que
  // esteja tocando ao mesmo tempo — é o comportamento certo).
  function _tqAcionarShake(duracao, forcaPx) {
    _tqShakeTimer = duracao; _tqShakeDuracaoBase = duracao; _tqShakeForcaBase = forcaPx;
  }

  /* ── Paredes: estado (hp/destruída) — geometria vem do mapa
     sorteado da partida (_TQ_MAPAS[_tqMapaAtualIdx].paredes, fixo até
     o próximo _tqReiniciarPartida). */
  function _tqResetParedes() {
    _tqParedes = _TQ_MAPAS[_tqMapaAtualIdx].paredes.map(function (g) {
      return { x: g.x, y: g.y, w: g.w, h: g.h, hp: TQ_PAREDE_HP, destruida: false };
    });
  }

  // Moitas: não bloqueiam movimento nem tiro — só escondem quem estiver
  // dentro (ver _tqEmMoita/_tqEscondido*, cabeçalho do arquivo). Geometria
  // fixa do mapa, sem estado próprio (ao contrário das paredes).
  function _tqEmMoita(t) {
    var moitas = _TQ_MAPAS[_tqMapaAtualIdx].moitas;
    for (var i = 0; i < moitas.length; i++) {
      var m = moitas[i];
      if (t.x >= m.x && t.x <= m.x + m.w && t.y >= m.y && t.y <= m.y + m.h) return true;
    }
    return false;
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

  /* ── Partida ──────────────────────────────────────────────────
     mapaIdx: índice do mapa a usar (sincronizado via rede — ver
     cabeçalho); omitido = sorteia um novo (anfitrião e modo sozinho). */
  function _tqReiniciarPartida(mapaIdx) {
    _tqPlacarAnfitriao = 0; _tqPlacarConvidado = 0;
    _tqMapaAtualIdx = (typeof mapaIdx === 'number' && _TQ_MAPAS[mapaIdx]) ? mapaIdx : _tqEscolherMapa();
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
    // Reset do "game feel" — sem isso um tremor/recuo em andamento ou
    // marcas de esteira da rodada anterior vazariam pro respawn.
    _tqShakeTimer = 0;
    _tqRecuoAnfitriao = 0; _tqRecuoConvidado = 0;
    _tqRastro = [];
    _tqUltimaPosAnfitriao = null; _tqUltimaPosConvidado = null;
    _tqRevelarAnfitriao = 0; _tqRevelarConvidado = 0;
    _tqEscondidoAnfitriao = false; _tqEscondidoConvidado = false;
  }

  function _tqComecarPartida() {
    _tqMostrarTela('jogando');
    // Reforça o pedido de landscape aqui (a tela cheia do hub muitas
    // vezes só termina de abrir agora) — mesmo padrão da Corrida.
    _tqTravarLandscape();
    _tqAplicarOrientacaoRepetido();
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
      _tqAtualizarGameFeel(dt);
    }
    _tqDesenhar();
    _tqRAF = requestAnimationFrame(_tqLoop);
  }

  // Roda todo quadro (dos dois lados): decai tremor/recuo e registra
  // marcas de esteira com base no deslocamento OBSERVADO dos tanques —
  // funciona igual pro tanque local, pra IA e pro tanque remoto (cuja
  // posição só chega via rede), sem precisar de mensagem nova.
  function _tqAtualizarGameFeel(dt) {
    if (_tqShakeTimer > 0) _tqShakeTimer = Math.max(0, _tqShakeTimer - dt);
    if (_tqRecuoAnfitriao > 0) _tqRecuoAnfitriao = Math.max(0, _tqRecuoAnfitriao - dt * TQ_RECUO_DECAI);
    if (_tqRecuoConvidado > 0) _tqRecuoConvidado = Math.max(0, _tqRecuoConvidado - dt * TQ_RECUO_DECAI);

    if (_tqRodadaEstado === 'jogando') {
      _tqUltimaPosAnfitriao = _tqRegistrarRastro(_tqTanqueAnfitriao, _tqUltimaPosAnfitriao);
      _tqUltimaPosConvidado = _tqRegistrarRastro(_tqTanqueConvidado, _tqUltimaPosConvidado);
    }
    for (var i = _tqRastro.length - 1; i >= 0; i--) {
      _tqRastro[i].vida -= dt;
      if (_tqRastro[i].vida <= 0) _tqRastro.splice(i, 1);
    }
  }

  function _tqRegistrarRastro(t, ultimaPos) {
    if (!ultimaPos) return { x: t.x, y: t.y };
    var dx = t.x - ultimaPos.x, dy = t.y - ultimaPos.y;
    if (Math.hypot(dx, dy) < TQ_RASTRO_DIST_MIN) return ultimaPos;
    _tqRastro.push({ x: t.x, y: t.y, ang: t.ang, vida: TQ_RASTRO_VIDA });
    if (_tqRastro.length > TQ_RASTRO_MAX) _tqRastro.shift();
    return { x: t.x, y: t.y };
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
    var novoX = _tqClamp(t.x + dx, TQ_RAIO_TANQUE, MUNDO_LARGURA - TQ_RAIO_TANQUE);
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

    // Moitas: só o anfitrião calcula (tem as duas posições) — decai o
    // timer de "revelado" e recalcula quem está escondido. Sempre
    // atualizado (mesmo em pausa) pra já valer no respawn seguinte.
    if (_tqRevelarAnfitriao > 0) _tqRevelarAnfitriao = Math.max(0, _tqRevelarAnfitriao - dt);
    if (_tqRevelarConvidado > 0) _tqRevelarConvidado = Math.max(0, _tqRevelarConvidado - dt);
    _tqEscondidoAnfitriao = _tqRevelarAnfitriao <= 0 && _tqEmMoita(_tqTanqueAnfitriao);
    _tqEscondidoConvidado = _tqRevelarConvidado <= 0 && _tqEmMoita(_tqTanqueConvidado);

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

      // Ricochete: passou da borda da arena e ainda tem quique sobrando
      // (rebotes < TQ_RICOCHETE_MAX) — inverte a velocidade do eixo que
      // estourou e volta a posição pra dentro, em vez de sumir. Sem
      // quique sobrando, some como antes.
      var estourouX = pr.x < 0 || pr.x > MUNDO_LARGURA;
      var estourouY = pr.y < 0 || pr.y > 1;
      if (estourouX || estourouY) {
        if (pr.rebotes >= TQ_RICOCHETE_MAX) { _tqProjeteis.splice(i, 1); continue; }
        pr.rebotes++;
        if (estourouX) { pr.vx = -pr.vx; pr.x = _tqClamp(pr.x, 0, MUNDO_LARGURA); }
        if (estourouY) { pr.vy = -pr.vy; pr.y = _tqClamp(pr.y, 0, 1); }
      }

      var atingiuParede = false;
      for (var j = 0; j < _tqParedes.length; j++) {
        var p = _tqParedes[j];
        if (p.destruida) continue;
        if (_tqCircRect(pr.x, pr.y, TQ_RAIO_PROJETIL, p)) {
          p.hp--;
          if (p.hp <= 0) { p.destruida = true; _tqAcionarShake(TQ_SHAKE_PAREDE_DUR, TQ_SHAKE_PAREDE_FORCA); }
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
    _tqAcionarShake(TQ_SHAKE_ACERTO_DUR, TQ_SHAKE_ACERTO_FORCA);
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
      dono: dono, rebotes: 0
    });
    // Recuo — cobre a IA (modo sozinho) e a visão que o anfitrião tem
    // do tiro do convidado (autoridade nasce aqui pros dois casos). O
    // feedback do PRÓPRIO jogador ao apertar fogo já é instantâneo via
    // _tqTentarAtirar, sem esperar a rede.
    if (dono === 'anfitriao') _tqRecuoAnfitriao = 1; else _tqRecuoConvidado = 1;
    // Atirar denuncia a posição mesmo dentro de moita — _tqCriarProjetil
    // só roda no lado com autoridade (anfitrião), então é o ponto certo
    // pra marcar os dois lados como "revelados" por um tempo.
    if (dono === 'anfitriao') _tqRevelarAnfitriao = TQ_MOITA_REVELA_SEG; else _tqRevelarConvidado = TQ_MOITA_REVELA_SEG;
  }

  function _tqTentarAtirar() {
    if (_tqEstado !== 'jogando' || _tqRodadaEstado !== 'jogando' || _tqMeuCooldown > 0) return;
    _tqMeuCooldown = TQ_COOLDOWN_TIRO;
    if (_tqSouAnfitriao) _tqRecuoAnfitriao = 1; else _tqRecuoConvidado = 1;
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
      pj: _tqProjeteis, pd: pd, ea: _tqEscondidoAnfitriao,
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
      if (dist < TQ_IA_DIST_ENGAJAR && !_tqEscondidoAnfitriao && _tqLinhaLivre(eu, alvo)) {
        _tqIAModo = 'engajar';
      } else {
        _tqIAModo = 'patrulha';
        _tqIAAlvoPatrulha = { x: 0.18 + Math.random() * (MUNDO_LARGURA - 0.36), y: 0.18 + Math.random() * 0.64 };
      }
    }

    var ix = 0, iy = 0;
    if (_tqIAModo === 'engajar') {
      var angMira = Math.atan2(alvo.x - eu.x, -(alvo.y - eu.y));
      ix = Math.sin(angMira) * 0.7; iy = -Math.cos(angMira) * 0.7;
      var diff = angMira - eu.ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.16 && !_tqEscondidoAnfitriao && _tqCooldownConvidado <= 0 && _tqLinhaLivre(eu, alvo)) {
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

  /* ── Desenho (top-down direto, sem perspectiva — arena widescreen) ─ */
  var TQ_COR_ANFITRIAO = '#3aa0ff';
  var TQ_COR_CONVIDADO = '#ff4757';

  function _tqDesenhar() {
    if (!_tqCtx || !_tqW || !_tqH) return;
    var ctx = _tqCtx;
    // O clear fica FORA do save/translate do tremor — limpa o quadro
    // inteiro sem deslocamento, senão sobrariam frestas nas bordas.
    ctx.clearRect(0, 0, _tqW, _tqH);
    ctx.save();
    if (_tqShakeTimer > 0 && _tqShakeDuracaoBase > 0) {
      var intensidade = _tqShakeForcaBase * (_tqShakeTimer / _tqShakeDuracaoBase);
      ctx.translate((Math.random() * 2 - 1) * intensidade, (Math.random() * 2 - 1) * intensidade);
    }
    _tqDesenharChao();
    _tqDesenharRastro();
    _tqDesenharMoitas();
    _tqDesenharParedes();

    var jogando = (_tqEstado === 'jogando');
    if (jogando) {
      for (var i = 0; i < _tqProjeteis.length; i++) _tqDesenharProjetil(_tqProjeteis[i]);
      // O PRÓPRIO tanque sempre aparece; o do adversário só se ele não
      // estiver escondido numa moita (ver _tqEscondido* em _tqSimularMundo).
      if (_tqSouAnfitriao || !_tqEscondidoAnfitriao) _tqDesenharTanque(_tqTanqueAnfitriao, 'tank-azul.webp', TQ_COR_ANFITRIAO, _tqRecuoAnfitriao);
      if (!_tqSouAnfitriao || !_tqEscondidoConvidado) _tqDesenharTanque(_tqTanqueConvidado, 'tank-vermelho.webp', TQ_COR_CONVIDADO, _tqRecuoConvidado);
      if (_tqRodadaEstado === 'pausa') _tqDesenharAvisoRodada();
    }
    ctx.restore();
  }

  // Marcas de esteira: um par de tracinhos escuros por marca, girados
  // pro ângulo do tanque no momento em que passou ali, sumindo aos
  // poucos (fade por alpha) — desenhadas sobre o chão, embaixo de
  // paredes/tanques.
  function _tqDesenharRastro() {
    if (!_tqRastro.length) return;
    var ctx = _tqCtx;
    // _tqH (não _tqW) é o fator uniforme px-por-unidade nos dois eixos —
    // ver nota "ARENA E LANDSCAPE" no cabeçalho do arquivo.
    var diametroTela = TQ_RAIO_TANQUE * 2 * _tqH;
    var afastamento = diametroTela * 0.30;
    var compr = diametroTela * 0.22, larg = diametroTela * 0.09;
    for (var i = 0; i < _tqRastro.length; i++) {
      var m = _tqRastro[i];
      var alpha = Math.max(0, Math.min(1, m.vida / TQ_RASTRO_VIDA)) * 0.28;
      if (alpha <= 0.01) continue;
      ctx.save();
      ctx.translate(m.x * _tqH, m.y * _tqH);
      ctx.rotate(m.ang);
      ctx.fillStyle = 'rgba(0,0,0,' + alpha.toFixed(3) + ')';
      ctx.fillRect(-afastamento - larg / 2, -compr / 2, larg, compr);
      ctx.fillRect(afastamento - larg / 2, -compr / 2, larg, compr);
      ctx.restore();
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

  // Moitas: elipse verde translúcida — desenhada depois do rastro e
  // antes das paredes/tanques (fica no chão, sob quem passa por cima).
  // Puramente visual: quem esconde é a checagem em _tqEmMoita.
  function _tqDesenharMoitas() {
    var moitas = _TQ_MAPAS[_tqMapaAtualIdx].moitas;
    if (!moitas.length) return;
    var ctx = _tqCtx;
    ctx.save();
    ctx.fillStyle = 'rgba(46,125,50,0.55)';
    ctx.strokeStyle = 'rgba(27,79,31,0.65)';
    ctx.lineWidth = 2;
    for (var i = 0; i < moitas.length; i++) {
      var m = moitas[i];
      var cx = (m.x + m.w / 2) * _tqH, cy = (m.y + m.h / 2) * _tqH;
      var rx = (m.w / 2) * _tqH, ry = (m.h / 2) * _tqH;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function _tqDesenharParedes() {
    var ctx = _tqCtx;
    var regTijolo = _tqAsset('parede-tijolo.webp');
    var regEscombro = _tqAsset('parede-escombros.webp');
    for (var i = 0; i < _tqParedes.length; i++) {
      var p = _tqParedes[i];
      var px = p.x * _tqH, py = p.y * _tqH, pw = p.w * _tqH, ph = p.h * _tqH;
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
    var x = pr.x * _tqH, y = pr.y * _tqH;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, TQ_RAIO_PROJETIL * _tqH * 1.1, 0, Math.PI * 2);
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
  function _tqDesenharTanque(t, arquivo, corFallback, recuo) {
    var ctx = _tqCtx;
    var reg = _tqAsset(arquivo);
    var cx = t.x * _tqH, cy = t.y * _tqH;
    var diametroTela = TQ_RAIO_TANQUE * 2 * _tqH;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t.ang);
    // Recuo do canhão: empurra o desenho pra TRÁS (oposto de onde
    // mira) por um instante ao atirar. Local: y positivo já é "atrás"
    // aqui, porque o sprite é desenhado apontando pro -Y (ver comentário
    // do pivô abaixo) e t.ang=0 mira pro norte.
    if (recuo > 0) ctx.translate(0, diametroTela * 0.16 * recuo);

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
