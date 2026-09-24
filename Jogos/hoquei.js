/* ═══════════════════════════════════════════════════════════════
   HÓQUEI DA CORUJA — air hockey 1x1 (lazy-loaded pelo hub)
   Vista de cima clássica, Canvas 2D, pixel art sem borrar.
   Dois modos: sozinho contra a CPU, ou 1x1 online via
   Jogos/multiplayer.js (AngatubaMP) — sala por código de 4 letras,
   dados P2P (WebRTC DataChannel). Mesmo fluxo do Ping Pong.

   MUNDO (compartilhado entre os dois lados, gerado por quem simula):
     - Unidade = 1 "pixel do mundo" (o mesmo pixel dos sprites em
       /Jogos/assets/hoquei/). A mesa jogável tem HQ_MESA_C x HQ_MESA_L.
     - u = eixo dos gols (0..HQ_MESA_C). O ANFITRIÃO defende o gol em
       u=0, o convidado (ou a CPU) defende o gol em u=HQ_MESA_C.
     - v = eixo lateral (0..HQ_MESA_L).
     Cada tela só GIRA esse mundo na hora de desenhar (nunca espelha):
     quem olha sempre vê o próprio gol perto de si — à esquerda com o
     celular deitado, embaixo com o celular em pé (ver _hqDimensionar e
     _hqMundoParaTela). Os sprites são desenhados sempre "em pé" (a
     carinha da coruja nunca fica de cabeça pra baixo).

   PIXEL SEM BORRAR (mesmo critério da Armadilha): a mesa é desenhada
   numa escala INTEIRA de pixels do aparelho (S) com imageSmoothing
   desligado; raquetes e disco usam a mesma escala S. Só a posição dos
   sprites é livre (sub-pixel do mundo), pra o movimento ficar liso.

   MODELO DE REDE (host-autoritativo, igual ao Ping Pong):
     - O anfitrião simula TUDO: disco, colisões, gols e placar, e manda
       o estado completo pro convidado a ~45 Hz (HQ_REDE_ESTADO_MS).
     - O convidado só manda a posição da PRÓPRIA raquete a cada quadro
       (teto de 60 Hz, HQ_REDE_RAQUETE_MS). Ele desenha a própria
       raquete na hora (resposta instantânea ao dedo) e o disco por
       extrapolação suavizada do último estado recebido.
     - Queda de conexão, sumiço do outro lado ou desistência (botão
       Sair) → volta pro menu com uma mensagem clara (_hqVoltarComAviso).

   SALAS: AngatubaMP não separa salas por jogo — a lista pública mostra
   salas do Ping Pong e do Tanques também. Por isso o 'oi' leva
   jogo:'hoquei'; se o outro lado não for Hóquei, os dois saem com um
   aviso em vez de ficarem trocando pacotes que não entendem.

   Fala com o app só via window.AngatubaGames (ponte), com a rede só via
   window.AngatubaMP e com o som só via window.AngatubaSom.
   Expõe window.HoqueiGame = { preparar, comecar, parar }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     CONSTANTES AJUSTÁVEIS — dá pra afinar tudo por aqui sem mexer no
     resto do código. Distâncias em px do MUNDO, tempos em segundos,
     velocidades em px do mundo por segundo.
     ══════════════════════════════════════════════════════════════ */

  /* ── Mesa (tem que bater com /Jogos/assets/hoquei/mesa.webp) ──── */
  var HQ_MESA_C = 256;        // comprimento jogável (de um gol ao outro)
  var HQ_MESA_L = 144;        // largura jogável (de um trilho lateral ao outro)
  var HQ_BORDA = 8;           // espessura do trilho desenhado em volta (mesa.webp = 272x160)
  var HQ_GOL_LARG = 56;       // abertura de cada gol, centrada no eixo v

  /* ── Peças (tem que bater com os sprites: raquete 24x24, disco 14x14) */
  var HQ_RAIO_DISCO = 7;
  var HQ_RAIO_RAQUETE = 12;

  /* ── Física do disco ─────────────────────────────────────────── */
  var HQ_ATRITO = 0.35;       // amortecimento exponencial por segundo: v *= e^(-ATRITO·dt).
                              //   0.35 ≈ o disco perde ~30% da velocidade por segundo (mesa de ar = pouco atrito)
  var HQ_REST_PAREDE = 0.9;   // coeficiente de restituição no trilho (0.85–0.95 = quique vivo)
  var HQ_REST_RAQUETE = 0.92; // restituição na batida com a raquete
  var HQ_MASSA_DISCO = 1;     // massas entram no impulso j = -(1+e)·vrel / (1/m1 + 1/m2).
  var HQ_MASSA_RAQUETE = 5;   //   raquete bem mais "pesada" que o disco: ela quase não cede na batida
                              //   (a raquete é controlada pelo jogador, então o impulso só é aplicado no disco)
  var HQ_DISCO_VEL_MAX = 560; // teto de velocidade do disco (≈ meia mesa em 0,23 s)
  var HQ_RAQUETE_VEL_MAX = 1100;     // quão rápido a raquete persegue o dedo/alvo (evita "teleporte" através do disco)
  var HQ_RAQUETE_VEL_IMPULSO = 800;  // teto da velocidade da raquete considerada na batida
  var HQ_SUBPASSO_PX = 3;     // deslocamento máximo por subpasso (evita o disco atravessar a raquete)
  var HQ_SUBPASSOS_MAX = 12;  // teto de subpassos por quadro
  var HQ_GOL_ZONA_MORTA = 3;  // gol vale quando o CENTRO do disco chega a menos disso da linha, dentro
                              //   da boca do gol — um disco "parado em cima da linha" não trava a partida
  var HQ_POSSE_TEMPO = 7;     // regra dos 7 segundos: disco que fica tanto tempo no MESMO campo (parado,
                              //   preso num canto ou "enrolado") vira saque no meio pro outro jogador

  /* ── Saque e pontuação ───────────────────────────────────────── */
  var HQ_SAQUE_VEL = 110;       // velocidade do disco saindo do meio
  var HQ_SAQUE_ANGULO = 35;     // desvio máximo (graus) em relação ao eixo dos gols — direção sorteada nessa faixa
  var HQ_SAQUE_CONTAGEM = 1.35; // "3, 2, 1" antes do disco sair (s)
  var HQ_GOL_PAUSA = 1.4;       // comemoração do gol antes do próximo saque (s)
  var HQ_GOLS_VITORIA = 7;      // primeiro a 7…
  var HQ_VANTAGEM = 2;          // …com 2 de vantagem (6x6 → segue até alguém abrir 2)

  /* ── CPU (modo sozinho) — "média": reage atrasada e erra um pouco ── */
  var HQ_CPU_REACAO = 0.12;      // a CPU enxerga o disco com esse atraso (s) — tempo de reação humano
  var HQ_CPU_DECISAO = 0.09;     // de quanto em quanto tempo ela reavalia o plano (s)
  var HQ_CPU_VEL = 330;          // velocidade máxima normal
  var HQ_CPU_VEL_ATAQUE = 500;   // velocidade máxima na hora de bater
  var HQ_CPU_ACEL = 2200;        // aceleração máxima (px/s²) — não muda de direção instantaneamente
  var HQ_CPU_ERRO = 5;           // erro aleatório de mira/posição (px, ±)
  var HQ_CPU_DISTRACAO = 0.08;   // chance, a cada decisão, de "piscar"…
  var HQ_CPU_DISTRACAO_T = 0.3;  // …e ficar esse tempo sem reagir
  var HQ_CPU_LINHA_DEFESA = 30;  // distância do próprio gol onde ela espera quando está defendendo
  var HQ_CPU_TABELA = 0.22;      // chance de tentar uma tabela (bate no trilho antes do gol)

  /* ── Controles ───────────────────────────────────────────────── */
  var HQ_TECLADO_VEL = 380;       // velocidade do alvo com setas/WASD
  var HQ_TOQUE_AFASTAR_CSS = 14;  // no toque, a raquete fica esse tanto (px CSS) à frente do dedo, pra não sumir embaixo dele

  /* ── Rede ────────────────────────────────────────────────────── */
  var HQ_REDE_ESTADO_MS = 22;     // anfitrião → convidado: estado completo (~45 Hz)
  var HQ_REDE_RAQUETE_MS = 16;    // convidado → anfitrião: posição da raquete (até 60 Hz)
  var HQ_CONGELADO_AVISO_MS = 3000;   // sem notícia do outro lado: mostra "Aguardando…"
  var HQ_CONGELADO_FIM_MS = 20000;    // …e depois disso trata como conexão perdida
  var HQ_CONECTANDO_TIMEOUT_MS = 20000;
  var HQ_SUAVIZACAO = 30;         // convidado: rapidez da correção rumo ao estado previsto (1/s)
  var HQ_EXTRAPOLA_MAX = 0.12;    // convidado: extrapola o disco no máximo esse tempo à frente (s)
  var HQ_SNAP_PX = 40;            // erro maior que isso (ex.: saque novo) teleporta em vez de suavizar

  /* ── Tela ────────────────────────────────────────────────────── */
  var HQ_TOPO_RESERVA_CSS = 52;   // faixa no topo pro placar/botões quando eles flutuam sobre a arena
  var HQ_MARGEM_CSS = 6;

  var _HQ_ASSET_BASE = '/Jogos/assets/hoquei/';
  var _HQ_CORUJA_PIXEL = '/img/pixel/coruja-pixel-idle-1x.png'; // emblema no círculo central (já existe no app)

  /* ── Estado ──────────────────────────────────────────────────── */
  var _hqCanvas = null, _hqCtx = null;
  var _hqCssW = 0, _hqCssH = 0, _hqDpr = 1, _hqW = 0, _hqH = 0;
  var _hqLay = null;             // layout calculado em _hqDimensionar
  var _hqFundoCache = null;      // canvas com fundo + mesa (camada estática)
  var _hqRAF = 0, _hqUltimoTs = 0;
  var _hqEstado = 'inicio';      // inicio | sala | jogando | fim
  var _hqModo = null;            // 'solo' | 'multiplayer'
  var _hqSouAnfitriao = false;
  var _hqEventosLigados = false;
  var _hqSaindoVoluntariamente = false;
  var _hqSemAdversario = false;
  var _hqApelidoAdversario = '';
  var _hqPausado = false;
  var _hqSalasDesligar = null, _hqListaListenerOn = false;
  var _hqResizeOn = false, _hqControlesOn = false, _hqTecladoOn = false;

  // Fase dentro da partida: 'saque' (contagem 3-2-1), 'jogo', 'gol' (comemoração).
  var _hqFase = 'saque', _hqTimer = 0, _hqSaqueReceptor = 0;
  var _hqGols = [0, 0];          // [anfitrião, convidado/CPU]
  var _hqVencedor = -1;          // índice de quem venceu (fica decidido no gol da vitória)
  var _hqSimT = 0;               // relógio da simulação (s), só avança jogando
  var _hqPosseT = 0, _hqPosseLado = -1;   // tempo que o disco está no mesmo campo, e qual campo

  // Disco e raquetes, sempre no referencial do anfitrião.
  // Raquete 0 = anfitrião (defende u=0) · raquete 1 = convidado/CPU (defende u=C).
  // au/av = alvo (dedo, teclado, rede ou CPU); cvu/cvv = velocidade própria (só a CPU usa).
  var _hqDisco = { u: 0, v: 0, vu: 0, vv: 0 };
  var _hqRaq = [
    { u: 0, v: 0, vu: 0, vv: 0, au: 0, av: 0, cvu: 0, cvv: 0 },
    { u: 0, v: 0, vu: 0, vv: 0, au: 0, av: 0, cvu: 0, cvv: 0 }
  ];
  // Contadores de eventos (vão no estado da rede: o convidado toca som /
  // solta partícula quando o número muda).
  var _hqNBatidas = 0, _hqNParedes = 0, _hqNGols = 0, _hqUltimoMarcador = -1;

  // CPU
  var _hqCpuHist = [];           // fotos do disco [{t,u,v,vu,vv}] pra simular o atraso de reação
  var _hqCpuTimer = 0, _hqCpuEspera = 0, _hqCpuAtacando = false, _hqCpuMira = 0, _hqCpuTabela = 0;
  var _hqCpuAlvo = { u: 0, v: 0 }, _hqCpuVelAlvo = HQ_CPU_VEL;

  // Rede
  var _hqUltimoEEm = 0;          // convidado: quando chegou o último estado
  var _hqUltimoPEm = 0;          // anfitrião: quando chegou a última raquete do convidado
  var _hqUltimoEnvio = 0, _hqUltimoEnvioRaq = 0;
  var _hqNet = { u: 0, v: 0, vu: 0, vv: 0, t: 0, hu: 0, hv: 0 }; // convidado: último estado recebido
  var _hqRender = { u: 0, v: 0, hu: 0, hv: 0, ok: false };        // convidado: posições suavizadas
  var _hqAguardandoOutro = false;
  var _hqNetAguardando = false;   // convidado: o anfitrião avisou que está esperando por mim
  var _hqPausaPedidaEm = 0, _hqTimerAntesNet = 0;

  // Controles
  var _hqPonteiroId = null;
  var _hqTeclas = {};
  var _hqTecladoAtivoAntes = false;

  // Efeitos
  var _hqRastro = [];            // últimas posições do disco (mundo)
  var _hqParticulas = [];
  var _hqFlash = 0, _hqTremor = 0;
  var _hqSomUltimo = {};

  /* ── Assets (carregam sob demanda; tudo tem desenho reserva) ───── */
  var _hqAssets = {};
  function _hqAsset(url) {
    if (_hqAssets[url]) return _hqAssets[url];
    var reg = { img: null, ok: false };
    _hqAssets[url] = reg;
    try {
      var im = new Image();
      im.onload = function () {
        reg.ok = true; reg.img = im;
        _hqFundoCache = null; // a mesa pode ter chegado agora: refaz a camada estática
      };
      im.src = url;
      reg.img = im;
    } catch (e) {}
    return reg;
  }
  function _hqCarregarAssets() {
    _hqAsset(_HQ_ASSET_BASE + 'mesa.webp');
    _hqAsset(_HQ_ASSET_BASE + 'raquete-azul.webp');
    _hqAsset(_HQ_ASSET_BASE + 'raquete-vermelha.webp');
    _hqAsset(_HQ_ASSET_BASE + 'disco.webp');
    _hqAsset(_HQ_CORUJA_PIXEL);
  }

  /* ── Ponte com o app / som (no-op se não existir) ────────────── */
  function _hqBridge() { return window.AngatubaGames || null; }

  // Sons: reaproveita os efeitos sintetizados do AngatubaSom (0 download).
  // Cada tipo tem um intervalo mínimo pra batidas seguidas não virarem ruído.
  var _HQ_SONS = {
    batida: { fn: 'pulo', minMs: 70 },
    parede: { fn: 'toque', minMs: 70 },
    golMeu: { fn: 'bonus', minMs: 300 },
    golDele: { fn: 'erro', minMs: 300 },
    contagem: { fn: 'nota', minMs: 200 }
  };
  function _hqSom(tipo, arg) {
    var S = window.AngatubaSom, cfg = _HQ_SONS[tipo];
    if (!S || !cfg || typeof S[cfg.fn] !== 'function') return;
    var agora = performance.now();
    if (_hqSomUltimo[tipo] && agora - _hqSomUltimo[tipo] < cfg.minMs) return;
    _hqSomUltimo[tipo] = agora;
    try { S[cfg.fn](arg); } catch (e) {}
  }

  /* ── Utilidades ──────────────────────────────────────────────── */
  function _hqClamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function _hqR1(x) { return Math.round(x * 10) / 10; }   // 0,1 px do mundo basta na rede
  function _hqNum(x, a, b, padrao) { return (typeof x === 'number' && isFinite(x)) ? _hqClamp(x, a, b) : padrao; }
  function _hqCodigoValido(c) { return /^[A-Z0-9]{4}$/.test(c || ''); }
  function _hqEscaparHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _hqEu() { return _hqSouAnfitriao ? 0 : 1; }
  function _hqNomeAdversario() {
    if (_hqModo === 'solo') return 'CPU';
    return _hqApelidoAdversario || 'Amigo';
  }

  /* ── Ciclo de vida ─────────────────────────────────────────────*/
  function _hqPreparar() {
    _hqCanvas = document.getElementById('hq-canvas');
    if (!_hqCanvas) return;
    _hqCtx = _hqCanvas.getContext('2d');
    _hqCarregarAssets();
    _hqLigarControles();
    _hqLigarEventosRede();
    if (!_hqResizeOn) {
      var reaval = function () {
        if (window._gamesHubAberto && window._gamesHubAberto()) {
          _hqDimensionar();
          _hqDesenhar();
        }
      };
      window.addEventListener('resize', reaval);
      window.addEventListener('orientationchange', function () { setTimeout(reaval, 250); });
      document.addEventListener('visibilitychange', function () {
        // Solo: app foi pro segundo plano no meio do lance → pausa (sem isto
        // o gol entrava enquanto a pessoa atendia uma ligação). Multiplayer
        // não pausa sozinho: quem cuida é o watchdog do outro lado.
        if (document.hidden && _hqEstado === 'jogando' && _hqModo === 'solo' && !_hqPausado) _hqAlternarPausa(true);
      });
      _hqResizeOn = true;
    }
    _hqMostrarTela('inicio');
    _hqLimparErroMenu();
    _hqAvisoMenu('');
    _hqDimensionar();
    _hqResetarPosicoes();
    _hqDesenhar();
  }

  function _hqComecar() { _hqPreparar(); }

  // Mesmo padrão do Ping Pong (_ppSairDaRede): AngatubaMP.sair() zera TODOS
  // os handlers do core, então quem continua no Hóquei (religar=true)
  // precisa se reinscrever; quem está fechando o jogo (religar=false) só
  // marca pra reinscrever no próximo _hqPreparar().
  function _hqSairDaRede(religar) {
    if (!window.AngatubaMP) return;
    _hqSaindoVoluntariamente = true;
    try { window.AngatubaMP.sair(); } catch (e) {}
    _hqSaindoVoluntariamente = false;
    _hqEventosLigados = false;
    _hqResetarMic();
    if (religar) _hqLigarEventosRede();
  }

  // Avisa o outro lado que é desistência (e não queda), antes de fechar o canal.
  function _hqAvisarSaida() {
    if (_hqModo === 'multiplayer' && window.AngatubaMP && (_hqEstado === 'jogando' || _hqEstado === 'fim')) {
      try { window.AngatubaMP.enviar({ t: 'tchau' }); } catch (e) {}
    }
  }

  function _hqParar() {
    if (_hqRAF) { cancelAnimationFrame(_hqRAF); _hqRAF = 0; }
    _hqAvisarSaida();
    _hqSairDaRede(false);
    _hqPararListaSalas();
    _hqPararTimerConectando();
    _hqEstado = 'inicio';
    _hqModo = null;
    _hqSouAnfitriao = false;
    _hqPausado = false;
    _hqTeclas = {};
    _hqPonteiroId = null;
    var tela = document.getElementById('jogo-hoquei');
    if (tela) tela.classList.remove('hq-jogando');
    _hqAtualizarMic();
  }

  window.HoqueiGame = { preparar: _hqPreparar, comecar: _hqComecar, parar: _hqParar };

  /* ── Telas (overlays) ─────────────────────────────────────────
     hq-menu (sozinho/criar/entrar/lista), hq-sala (aguardando ou
     conectando), hq-fim (resultado) e hq-pausa (por cima da partida).
     Durante 'jogando' só o HUD + canvas (+ pausa, se pausado). */
  function _hqMostrarTela(qual) {
    _hqEstado = qual;
    if (qual !== 'sala') _hqPararTimerConectando();
    var ids = { inicio: 'hq-menu', sala: 'hq-sala', fim: 'hq-fim' };
    ['inicio', 'sala', 'fim'].forEach(function (k) {
      var el = document.getElementById(ids[k]);
      if (el) el.style.display = (qual === k) ? '' : 'none';
    });
    var hud = document.getElementById('hq-hud');
    if (hud) hud.style.display = (qual === 'jogando') ? '' : 'none';
    var acoes = document.getElementById('hq-hud-acoes');
    if (acoes) acoes.style.display = (qual === 'jogando') ? '' : 'none';
    var tela = document.getElementById('jogo-hoquei');
    if (tela) tela.classList.toggle('hq-jogando', qual === 'jogando');
    _hqAtualizarPausaUI();
    _hqAtualizarMic();
    if (qual === 'inicio') {
      var btnC = document.getElementById('hq-btn-criar');
      var btnE = document.getElementById('hq-btn-entrar');
      if (btnC) btnC.disabled = false;
      if (btnE) btnE.disabled = false;
      _hqIniciarListaSalas();
    } else {
      _hqPararListaSalas();
    }
  }

  function _hqErroMenu(msg) {
    var el = document.getElementById('hq-menu-erro');
    if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  }
  function _hqLimparErroMenu() { _hqErroMenu(''); }
  // Aviso de destaque no topo do menu (queda, desistência, sala de outro jogo).
  function _hqAvisoMenu(msg) {
    var el = document.getElementById('hq-menu-aviso');
    if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  }

  /* ── Lista de salas públicas (igual ao Ping Pong) ─────────────── */
  function _hqIniciarListaSalas() {
    if (_hqSalasDesligar || !window.AngatubaMP || typeof window.AngatubaMP.listarSalas !== 'function') return;
    _hqSalasDesligar = window.AngatubaMP.listarSalas(_hqRenderizarSalas);
  }
  function _hqPararListaSalas() {
    if (_hqSalasDesligar) { try { _hqSalasDesligar(); } catch (e) {} _hqSalasDesligar = null; }
  }
  function _hqRenderizarSalas(lista) {
    var wrap = document.getElementById('hq-lista-salas');
    if (!wrap) return;
    if (!_hqListaListenerOn) {
      // Listener delegado único — nada de onclick inline com o código
      // interpolado (ver A1.1 no Ping Pong).
      wrap.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.hq-sala-item-btn[data-codigo]');
        if (btn) _hqEntrarSala(btn.getAttribute('data-codigo'));
      });
      _hqListaListenerOn = true;
    }
    var validas = (lista || []).filter(function (s) { return _hqCodigoValido(s.codigo); });
    if (!validas.length) {
      wrap.innerHTML = '<div class="hq-lista-vazia">Nenhuma sala aberta agora. Crie a primeira!</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < validas.length; i++) {
      var s = validas[i];
      html += '<div class="hq-sala-item">' +
                '<span class="hq-sala-item-nome">' + _hqEscaparHtml(s.nome) + '</span>' +
                '<button type="button" class="hq-sala-item-btn" data-codigo="' + s.codigo + '">Entrar</button>' +
              '</div>';
    }
    wrap.innerHTML = html;
  }

  /* ── Ações do menu ───────────────────────────────────────────── */
  function _hqJogarSozinho() {
    _hqModo = 'solo';
    _hqSouAnfitriao = true;
    _hqApelidoAdversario = '';
    _hqAvisoMenu('');
    _hqReiniciarPartida();
    _hqComecarPartida();
  }

  function _hqCriarSala() {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _hqErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    _hqLimparErroMenu();
    _hqAvisoMenu('');
    _hqApelidoAdversario = '';
    var btn = document.getElementById('hq-btn-criar');
    if (btn) btn.disabled = true;
    var chk = document.getElementById('hq-publica-check');
    var publica = !!(chk && chk.checked);
    window.AngatubaMP.criarSala(publica).then(function (codigo) {
      _hqModo = 'multiplayer';
      _hqSouAnfitriao = true;
      _hqMostrarSala('aguardando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _hqErroMenu((err && err.message) || 'Não consegui criar a sala.');
    });
  }

  function _hqEntrarSala(codigoForcado) {
    if (!window.AngatubaMP || !window.AngatubaMP.disponivel()) {
      _hqErroMenu('Multiplayer indisponível neste navegador.');
      return;
    }
    var input = document.getElementById('hq-codigo-input');
    var codigo = codigoForcado || (input ? input.value : '');
    _hqLimparErroMenu();
    _hqAvisoMenu('');
    _hqApelidoAdversario = '';
    var btn = document.getElementById('hq-btn-entrar');
    if (btn) btn.disabled = true;
    window.AngatubaMP.entrarSala(codigo).then(function () {
      _hqModo = 'multiplayer';
      _hqSouAnfitriao = false;
      _hqMostrarSala('conectando', codigo);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      _hqErroMenu((err && err.message) || 'Não consegui entrar na sala.');
    });
  }

  // Teto de espera do convidado em "Conectando…" (mesmo motivo do P2 no
  // Ping Pong). O anfitrião em "aguardando" não tem teto.
  var _hqTimerConectando = null;
  function _hqPararTimerConectando() {
    if (_hqTimerConectando) { clearTimeout(_hqTimerConectando); _hqTimerConectando = null; }
  }

  function _hqMostrarSala(modo, codigo) {
    _hqPararTimerConectando();
    _hqMostrarTela('sala');
    var titulo = document.getElementById('hq-sala-titulo');
    var desc = document.getElementById('hq-sala-desc');
    var codEl = document.getElementById('hq-sala-codigo');
    var btnCopiar = document.getElementById('hq-btn-copiar');
    if (modo === 'aguardando') {
      if (titulo) titulo.textContent = 'Aguardando o amigo…';
      if (desc) desc.textContent = 'Manda esse código pro seu amigo digitar em "Entrar com código":';
      if (codEl) { codEl.textContent = codigo; codEl.style.display = ''; }
      if (btnCopiar) btnCopiar.style.display = '';
    } else {
      if (titulo) titulo.textContent = 'Conectando…';
      if (desc) desc.textContent = 'Aguardando o anfitrião confirmar a conexão.';
      if (codEl) codEl.style.display = 'none';
      if (btnCopiar) btnCopiar.style.display = 'none';
      _hqTimerConectando = setTimeout(function () {
        _hqTimerConectando = null;
        if (_hqEstado !== 'sala') return;
        _hqVoltarMenu();
        _hqErroMenu('Não consegui conectar com o anfitrião. Confira o código ou peça um novo.');
      }, HQ_CONECTANDO_TIMEOUT_MS);
    }
  }

  function _hqCopiarCodigo() {
    var codEl = document.getElementById('hq-sala-codigo');
    var codigo = codEl ? codEl.textContent : '';
    if (!codigo || !navigator.clipboard) return;
    navigator.clipboard.writeText(codigo).then(function () {
      var btn = document.getElementById('hq-btn-copiar');
      if (!btn) return;
      var original = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(function () { btn.textContent = original; }, 1500);
    }).catch(function () {});
  }

  function _hqVoltarMenu() {
    if (_hqRAF) { cancelAnimationFrame(_hqRAF); _hqRAF = 0; }
    _hqSairDaRede(true);
    _hqModo = null;
    _hqSouAnfitriao = false;
    _hqSemAdversario = false;
    _hqPausado = false;
    _hqAguardandoOutro = false;
    _hqTeclas = {};
    _hqPonteiroId = null;
    _hqMostrarTela('inicio');
    _hqResetarPosicoes();
    _hqDesenhar();
  }

  // Volta pro menu (lobby) com uma mensagem clara no topo — usado em queda
  // de conexão, desistência do outro lado e sala de outro jogo.
  function _hqVoltarComAviso(msg) {
    _hqVoltarMenu();
    _hqAvisoMenu(msg);
  }

  // Botão "Sair da partida" (pausa): no multiplayer avisa o outro lado
  // que foi desistência antes de derrubar o canal.
  function _hqSairPartida() {
    _hqAvisarSaida();
    _hqVoltarMenu();
  }

  /* ── Voz opcional (mesmo ciclo do Ping Pong: off → on → mudo) ──── */
  var _hqMicPedindo = false, _hqMicRemoto = false, _hqMicAvisoTimer = 0;
  function _hqMicPronto() {
    return !!(window.AngatubaMP && typeof window.AngatubaMP.habilitarAudio === 'function');
  }
  function _hqAtualizarMic() {
    var base = _hqModo === 'multiplayer' && _hqMicPronto();
    var mostrar = base && (_hqEstado === 'sala' || _hqEstado === 'jogando');
    var estado = 'off';
    if (mostrar && window.AngatubaMP.audioAtivo()) {
      estado = window.AngatubaMP.microfoneMutado() ? 'mudo' : 'on';
    }
    var rotulo = _hqMicPedindo ? 'Pedindo…'
               : (estado === 'on' ? 'Mic ligado' : (estado === 'mudo' ? 'Mic mudo' : 'Ligar mic'));
    var icone = _hqMicPedindo ? 'fa-spinner fa-spin'
              : (estado === 'on' ? 'fa-microphone' : 'fa-microphone-slash');
    [['hq-mic-sala', 'sala'], ['hq-mic-hud', 'jogando']].forEach(function (par) {
      var btn = document.getElementById(par[0]);
      if (!btn) return;
      var aqui = base && _hqEstado === par[1];
      btn.style.display = aqui ? '' : 'none';
      if (!aqui) return;
      btn.setAttribute('data-mic', _hqMicPedindo ? 'carregando' : estado);
      btn.disabled = _hqMicPedindo;
      btn.setAttribute('aria-pressed', estado === 'on' ? 'true' : 'false');
      btn.setAttribute('aria-label', rotulo);
      btn.title = rotulo;
      var ic = btn.querySelector('i');
      if (ic) ic.className = 'fa ' + icone;
      var txt = btn.querySelector('.hq-mic-txt');
      if (txt) txt.textContent = rotulo;
      var pt = btn.querySelector('.hq-mic-dot');
      if (pt) pt.style.display = (_hqMicRemoto && !_hqMicPedindo) ? 'block' : 'none';
    });
    var aviso = document.getElementById('hq-mic-erro');
    if (aviso && !mostrar) { aviso.textContent = ''; aviso.style.display = 'none'; }
  }
  function _hqMicAviso(msg) {
    var aviso = document.getElementById('hq-mic-erro');
    if (_hqMicAvisoTimer) { clearTimeout(_hqMicAvisoTimer); _hqMicAvisoTimer = 0; }
    if (!aviso) return;
    aviso.textContent = msg || '';
    aviso.style.display = msg ? '' : 'none';
    if (msg) {
      _hqMicAvisoTimer = setTimeout(function () {
        _hqMicAvisoTimer = 0;
        aviso.textContent = '';
        aviso.style.display = 'none';
      }, 5000);
    }
  }
  function _hqAlternarMic() {
    if (_hqMicPedindo || _hqModo !== 'multiplayer' || !_hqMicPronto()) return;
    var MP = window.AngatubaMP;
    if (MP.audioAtivo()) {
      MP.setMicrofoneMutado(!MP.microfoneMutado());
      _hqAtualizarMic();
      return;
    }
    _hqMicPedindo = true;
    _hqMicAviso('');
    _hqAtualizarMic();
    MP.habilitarAudio().then(function () {
      _hqMicPedindo = false;
      _hqAtualizarMic();
    }).catch(function (err) {
      _hqMicPedindo = false;
      _hqMicAviso((err && err.message) || 'Não consegui ligar o microfone.');
      _hqAtualizarMic();
    });
  }
  function _hqResetarMic() {
    _hqMicPedindo = false;
    _hqMicRemoto = false;
    _hqMicAviso('');
    _hqAtualizarMic();
  }

  /* ── Pausa ─────────────────────────────────────────────────────
     Solo: congela a simulação na hora. Multiplayer: a pausa é da
     PARTIDA (vale pros dois) — quem simula é o anfitrião, então o
     convidado só pede ('pz') e o estado seguinte já chega pausado. */
  function _hqAlternarPausa(forcar) {
    if (_hqEstado !== 'jogando') return;
    var novo = (typeof forcar === 'boolean') ? forcar : !_hqPausado;
    if (_hqModo === 'multiplayer' && !_hqSouAnfitriao) {
      if (window.AngatubaMP) window.AngatubaMP.enviar({ t: 'pz', v: novo });
      _hqPausado = novo; // otimista; o próximo estado do anfitrião confirma
      _hqPausaPedidaEm = performance.now();
    } else {
      _hqPausado = novo;
      if (_hqModo === 'multiplayer') _hqEnviarEstado(true);
    }
    _hqTeclas = {};
    _hqAtualizarPausaUI();
  }
  function _hqAtualizarPausaUI() {
    var el = document.getElementById('hq-pausa');
    if (el) el.style.display = (_hqEstado === 'jogando' && _hqPausado) ? '' : 'none';
    var btn = document.getElementById('hq-btn-pausa');
    if (btn) {
      var ic = btn.querySelector('i');
      if (ic) ic.className = 'fa ' + (_hqPausado ? 'fa-play' : 'fa-pause');
      btn.setAttribute('aria-label', _hqPausado ? 'Continuar' : 'Pausar');
    }
    var desc = document.getElementById('hq-pausa-desc');
    if (desc) desc.textContent = (_hqModo === 'multiplayer')
      ? 'A partida está parada pros dois. Qualquer um pode continuar.'
      : 'Respira. O disco espera você.';
  }

  window._hqJogarSozinho = _hqJogarSozinho;
  window._hqCriarSala = _hqCriarSala;
  window._hqEntrarSala = _hqEntrarSala;
  window._hqCopiarCodigo = _hqCopiarCodigo;
  window._hqVoltarMenu = _hqVoltarMenu;
  window._hqAlternarMic = _hqAlternarMic;
  window._hqAlternarPausa = function () { _hqAlternarPausa(); };
  window._hqSairPartida = _hqSairPartida;
  window._hqPedirRevanche = function () {
    // Sem ninguém do outro lado o botão vira "Criar nova sala" (ver _hqMostrarFim).
    if (_hqSemAdversario) { _hqVoltarMenu(); _hqCriarSala(); return; }
    if (_hqModo === 'solo') { _hqReiniciarPartida(); _hqComecarPartida(); }
    else if (_hqSouAnfitriao) { _hqReiniciarPartida(); _hqEnviarReinicio(); _hqComecarPartida(); }
    else if (window.AngatubaMP) window.AngatubaMP.enviar({ t: 'pr' });
    var btn = document.getElementById('hq-btn-revanche');
    if (btn) btn.disabled = true;
  };

  /* ── Rede: eventos do AngatubaMP (ligados uma vez por "sessão" do core) ── */
  function _hqLigarEventosRede() {
    if (_hqEventosLigados || !window.AngatubaMP) return;
    _hqEventosLigados = true;

    window.AngatubaMP.on('conectado', function () {
      _hqSemAdversario = false;
      var bridge = _hqBridge();
      var meuNome = (bridge && bridge.apelido && bridge.apelido()) || 'Jogador';
      window.AngatubaMP.enviar({ t: 'oi', nome: meuNome, jogo: 'hoquei', v: 1 });
      _hqUltimoEEm = performance.now();
      _hqUltimoPEm = performance.now();
      _hqReiniciarPartida();
      _hqComecarPartida();
    });

    window.AngatubaMP.on('mensagem', _hqReceberMensagem);

    window.AngatubaMP.on('audio', function (e) {
      _hqMicRemoto = !!(e && e.remoto);
      _hqAtualizarMic();
    });

    // _hqSaindoVoluntariamente distingue "eu saí" de "caiu / o outro sumiu".
    window.AngatubaMP.on('desconectado', function () {
      if (_hqSaindoVoluntariamente) { _hqSaindoVoluntariamente = false; return; }
      if (_hqEstado === 'jogando' || _hqEstado === 'sala') {
        _hqVoltarComAviso('Conexão perdida: o outro jogador saiu ou a internet caiu.');
      } else if (_hqEstado === 'fim' && _hqModo === 'multiplayer' && !_hqSemAdversario) {
        _hqAdversarioSumiuNoFim();
      }
    });

    window.AngatubaMP.on('erro', function (err) {
      if (_hqEstado === 'sala') _hqErroMenu((err && err.message) || 'Falha na conexão.');
    });
  }

  function _hqReceberMensagem(dado) {
    if (!dado || !dado.t || _hqModo !== 'multiplayer') return;
    var C = HQ_MESA_C, L = HQ_MESA_L;
    switch (dado.t) {
      case 'oi':
        // Sala de outro jogo (a lista pública é compartilhada entre os
        // jogos do AngatubaMP): sai com aviso em vez de jogar às cegas.
        if (dado.jogo !== 'hoquei') {
          try { window.AngatubaMP.enviar({ t: 'tchau', motivo: 'jogo' }); } catch (e) {}
          _hqVoltarComAviso('Essa sala é de outro jogo (Ping Pong ou Tanques). Crie ou entre numa sala do Hóquei.');
          return;
        }
        _hqApelidoAdversario = String(dado.nome || 'Amigo').slice(0, 20);
        _hqAtualizarHUD();
        break;
      case 'tchau': // desistência do outro lado (antes de o canal cair)
        var nome = _hqApelidoAdversario || 'O outro jogador';
        if (_hqEstado === 'fim') { _hqAdversarioSumiuNoFim(); return; }
        _hqVoltarComAviso(dado.motivo === 'jogo'
          ? 'Essa sala é de outro jogo. Crie ou entre numa sala do Hóquei.'
          : nome + ' saiu da partida.');
        return;
      case 'p': // convidado → anfitrião: posição da raquete do convidado (no referencial do anfitrião)
        if (_hqSouAnfitriao) {
          _hqUltimoPEm = performance.now();
          var r = _hqRaq[1];
          r.au = _hqNum(dado.u, C / 2 + HQ_RAIO_RAQUETE, C - HQ_RAIO_RAQUETE, r.au);
          r.av = _hqNum(dado.v, HQ_RAIO_RAQUETE, L - HQ_RAIO_RAQUETE, r.av);
        }
        break;
      case 'pz': // convidado pediu pausa/continuar — quem decide é quem simula
        if (_hqSouAnfitriao && _hqEstado === 'jogando') {
          _hqPausado = !!dado.v;
          _hqAtualizarPausaUI();
          _hqEnviarEstado(true);
        }
        break;
      case 'e': // anfitrião → convidado: estado completo
        if (!_hqSouAnfitriao && _hqEstado === 'jogando') _hqAplicarEstado(dado);
        break;
      case 'rr': // anfitrião reiniciou (revanche aceita)
        if (!_hqSouAnfitriao) { _hqReiniciarPartida(); _hqComecarPartida(); }
        break;
      case 'pr': // convidado pediu revanche
        if (_hqSouAnfitriao && _hqEstado === 'fim') { _hqReiniciarPartida(); _hqEnviarReinicio(); _hqComecarPartida(); }
        break;
    }
  }

  function _hqEnviarReinicio() {
    if (_hqModo === 'multiplayer' && window.AngatubaMP) window.AngatubaMP.enviar({ t: 'rr' });
  }

  // Convidado: aplica o estado do anfitrião. Tudo validado (tipo + faixa)
  // antes de entrar no estado local — pacote torto não vira NaN na tela.
  function _hqAplicarEstado(d) {
    var C = HQ_MESA_C, L = HQ_MESA_L;
    _hqUltimoEEm = performance.now();
    _hqNet.u = _hqNum(d.du, -20, C + 20, _hqNet.u);
    _hqNet.v = _hqNum(d.dv, 0, L, _hqNet.v);
    _hqNet.vu = _hqNum(d.dvu, -HQ_DISCO_VEL_MAX, HQ_DISCO_VEL_MAX, 0);
    _hqNet.vv = _hqNum(d.dvv, -HQ_DISCO_VEL_MAX, HQ_DISCO_VEL_MAX, 0);
    _hqNet.hu = _hqNum(d.au, 0, C / 2, _hqNet.hu);
    _hqNet.hv = _hqNum(d.av, 0, L, _hqNet.hv);
    _hqNet.t = performance.now();
    if (!_hqRender.ok) {
      _hqRender.u = _hqNet.u; _hqRender.v = _hqNet.v;
      _hqRender.hu = _hqNet.hu; _hqRender.hv = _hqNet.hv;
      _hqRender.ok = true;
    }
    var golsAntes = _hqGols[0] + _hqGols[1];
    _hqGols[0] = _hqNum(d.ga, 0, 99, _hqGols[0]) | 0;
    _hqGols[1] = _hqNum(d.gc, 0, 99, _hqGols[1]) | 0;
    if (d.f === 'saque' || d.f === 'jogo' || d.f === 'gol') {
      var faseAntes = _hqFase;
      _hqFase = d.f;
      if (_hqFase === 'saque' && faseAntes !== 'saque') _hqRastro = [];
    }
    _hqTimer = _hqNum(d.tm, 0, 10, 0);
    // Pausa: ignora por um instante o que o anfitrião diz logo depois de EU
    // pedir (o pacote pode ter saído antes de o pedido chegar lá).
    if (performance.now() - _hqPausaPedidaEm > 400) {
      var pausadoAntes = _hqPausado;
      _hqPausado = !!d.pz;
      if (pausadoAntes !== _hqPausado) _hqAtualizarPausaUI();
    }
    _hqNetAguardando = !!d.ag;
    // Contagem do saque: mesmo bip do anfitrião.
    if (_hqFase === 'saque') {
      var passo = HQ_SAQUE_CONTAGEM / 3;
      var nAntes = Math.ceil(_hqTimerAntesNet / passo), nAgora = Math.ceil(_hqTimer / passo);
      if (nAgora !== nAntes && nAgora >= 1 && nAgora < 3) _hqSom('contagem', 3 - nAgora);
    }
    _hqTimerAntesNet = _hqTimer;
    // Eventos por contador: mudou o número → aconteceu desde o último pacote.
    var nb = _hqNum(d.nb, 0, 1e9, _hqNBatidas) | 0;
    var np = _hqNum(d.np, 0, 1e9, _hqNParedes) | 0;
    var ng = _hqNum(d.ng, 0, 1e9, _hqNGols) | 0;
    if (nb !== _hqNBatidas) { _hqNBatidas = nb; _hqEfeitoBatida(_hqNet.u, _hqNet.v, true); }
    if (np !== _hqNParedes) { _hqNParedes = np; _hqSom('parede'); }
    if (ng !== _hqNGols) {
      _hqNGols = ng;
      var ug = (d.ug === 0 || d.ug === 1) ? d.ug : (_hqGols[0] + _hqGols[1] > golsAntes ? 0 : 1);
      _hqUltimoMarcador = ug;
      _hqEfeitoGol(ug);
    }
    _hqAtualizarHUD();
    if (d.fim) {
      _hqVencedor = (d.w === 0 || d.w === 1) ? d.w : (_hqGols[0] > _hqGols[1] ? 0 : 1);
      _hqMostrarFim();
    }
  }

  /* ── Controles ─────────────────────────────────────────────────
     Toque/mouse: a raquete vai pra onde o dedo está (um pouco à frente
     dele, HQ_TOQUE_AFASTAR_CSS). Não arrasta "relativo": é direto, que
     é o jeito que todo mundo espera num air hockey de celular. Mouse no
     desktop segue o cursor mesmo sem clicar. Teclado: setas/WASD movem
     o alvo; P ou Esc pausam. O alvo é sempre travado no próprio campo
     (a raquete nunca passa da linha do meio — ver _hqLimitarRaquete). */
  function _hqLimitarRaquete(idx, u, v) {
    var C = HQ_MESA_C, L = HQ_MESA_L, R = HQ_RAIO_RAQUETE;
    var uMin = idx === 0 ? R : C / 2 + R;
    var uMax = idx === 0 ? C / 2 - R : C - R;
    return { u: _hqClamp(u, uMin, uMax), v: _hqClamp(v, R, L - R) };
  }
  function _hqAplicarPonteiro(e, ehToque) {
    if (!_hqLay || !_hqCanvas) return;
    var rect = _hqCanvas.getBoundingClientRect();
    var sx = (e.clientX - rect.left) * _hqDpr;
    var sy = (e.clientY - rect.top) * _hqDpr;
    var p = _hqTelaParaLocal(sx, sy);
    if (ehToque) p.a += (HQ_TOQUE_AFASTAR_CSS * _hqDpr) / _hqLay.S; // "a" cresce rumo ao adversário
    var w = _hqLocalParaMundo(p.a, p.b);
    var eu = _hqEu(), r = _hqRaq[eu];
    var lim = _hqLimitarRaquete(eu, w.u, w.v);
    r.au = lim.u; r.av = lim.v;
  }
  function _hqPodeControlar() {
    return _hqEstado === 'jogando' && !_hqPausado;
  }
  function _hqPointerDown(e) {
    if (window.AngatubaSom && window.AngatubaSom._destravar) window.AngatubaSom._destravar();
    if (!_hqPodeControlar()) return;
    if (_hqPonteiroId !== null && e.pointerType !== 'mouse') return; // segundo dedo: ignora
    _hqPonteiroId = e.pointerId;
    try { _hqCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    _hqAplicarPonteiro(e, e.pointerType !== 'mouse');
    if (e.cancelable) e.preventDefault();
  }
  function _hqPointerMove(e) {
    if (!_hqPodeControlar()) return;
    if (e.pointerType === 'mouse') { _hqAplicarPonteiro(e, false); return; }
    if (e.pointerId !== _hqPonteiroId) return;
    _hqAplicarPonteiro(e, true);
    if (e.cancelable) e.preventDefault();
  }
  function _hqPointerUp(e) {
    if (e.pointerId === _hqPonteiroId) _hqPonteiroId = null;
  }
  function _hqLigarControles() {
    if (!_hqControlesOn && _hqCanvas) {
      _hqCanvas.addEventListener('pointerdown', _hqPointerDown);
      _hqCanvas.addEventListener('pointermove', _hqPointerMove);
      _hqCanvas.addEventListener('pointerup', _hqPointerUp);
      _hqCanvas.addEventListener('pointercancel', _hqPointerUp);
      _hqControlesOn = true;
    }
    if (!_hqTecladoOn) {
      window.addEventListener('keydown', _hqKeyDown);
      window.addEventListener('keyup', _hqKeyUp);
      window.addEventListener('blur', function () { _hqTeclas = {}; });
      _hqTecladoOn = true;
    }
  }
  var _HQ_MAPA_TECLAS = {
    ArrowUp: 'c', KeyW: 'c', ArrowDown: 'b', KeyS: 'b',
    ArrowLeft: 'e', KeyA: 'e', ArrowRight: 'd', KeyD: 'd'
  };
  function _hqTelaVisivel() {
    var tela = document.getElementById('jogo-hoquei');
    return !!(tela && tela.style.display !== 'none' && _hqCanvas && _hqCanvas.offsetWidth > 0);
  }
  function _hqKeyDown(e) {
    if (_hqEstado !== 'jogando' || !_hqTelaVisivel()) return;
    var alvo = e.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyP' || e.key === 'Escape') { _hqAlternarPausa(); e.preventDefault(); return; }
    var dir = _HQ_MAPA_TECLAS[e.code] || _HQ_MAPA_TECLAS[e.key];
    if (!dir) return;
    if (window.AngatubaSom && window.AngatubaSom._destravar) window.AngatubaSom._destravar();
    _hqTeclas[dir] = true;
    e.preventDefault();
  }
  function _hqKeyUp(e) {
    var dir = _HQ_MAPA_TECLAS[e.code] || _HQ_MAPA_TECLAS[e.key];
    if (dir) _hqTeclas[dir] = false;
  }
  // Teclado em coordenadas de TELA → local → mundo, pra "seta pra cima"
  // ser sempre pra cima na tela, com o celular deitado ou em pé.
  function _hqAplicarTeclado(dt) {
    var dx = (_hqTeclas.d ? 1 : 0) - (_hqTeclas.e ? 1 : 0);
    var dy = (_hqTeclas.b ? 1 : 0) - (_hqTeclas.c ? 1 : 0);
    var ativo = !!(dx || dy);
    var eu = _hqEu(), r = _hqRaq[eu];
    if (ativo && !_hqTecladoAtivoAntes) { r.au = r.u; r.av = r.v; }
    _hqTecladoAtivoAntes = ativo;
    if (!ativo || !_hqLay) return;
    var n = Math.sqrt(dx * dx + dy * dy);
    dx /= n; dy /= n;
    var da, db;
    if (_hqLay.paisagem) { da = dx; db = dy; } else { da = -dy; db = dx; }
    if (!_hqSouAnfitriao) { da = -da; db = -db; }
    var lim = _hqLimitarRaquete(eu, r.au + da * HQ_TECLADO_VEL * dt, r.av + db * HQ_TECLADO_VEL * dt);
    r.au = lim.u; r.av = lim.v;
  }

  /* ── Layout: escala inteira + rotação por orientação ─────────────
     S = px do aparelho por px do mundo (inteiro). Deitado: gols à
     esquerda/direita; em pé: gols embaixo/em cima. O referencial LOCAL
     (a,b) é o de quem olha: a=0 é sempre o próprio gol. */
  function _hqDimensionar() {
    if (!_hqCanvas) return;
    var cssW = _hqCanvas.offsetWidth || 320;
    var cssH = _hqCanvas.offsetHeight || 480;
    if (cssW < 2) cssW = 320;
    if (cssH < 2) cssH = 480;
    _hqDpr = Math.min(2, window.devicePixelRatio || 1);
    _hqCssW = cssW; _hqCssH = cssH;
    _hqW = Math.round(cssW * _hqDpr);
    _hqH = Math.round(cssH * _hqDpr);
    if (_hqCanvas.width !== _hqW) _hqCanvas.width = _hqW;
    if (_hqCanvas.height !== _hqH) _hqCanvas.height = _hqH;

    // Placar flutuando por cima da arena (tela cheia)? Reserva a faixa do topo.
    var hud = document.getElementById('hq-hud');
    var flutua = false;
    try { flutua = !!(hud && window.getComputedStyle(hud).position === 'absolute'); } catch (e) {}
    var topo = (flutua ? HQ_TOPO_RESERVA_CSS : HQ_MARGEM_CSS) * _hqDpr;
    var margem = HQ_MARGEM_CSS * _hqDpr;
    var paisagem = cssW >= cssH;
    var C = HQ_MESA_C, L = HQ_MESA_L, B = HQ_BORDA;
    var imgW = (paisagem ? C : L) + 2 * B;
    var imgH = (paisagem ? L : C) + 2 * B;
    var dispW = _hqW - 2 * margem, dispH = _hqH - topo - margem;
    var S = Math.floor(Math.min(dispW / imgW, dispH / imgH));
    if (S < 1) S = Math.max(0.25, Math.min(dispW / imgW, dispH / imgH)); // tela minúscula: aceita fracionário
    var tw = imgW * S, th = imgH * S;
    var tx = Math.round((_hqW - tw) / 2);
    var ty = Math.round(topo + (dispH - th) / 2);
    _hqLay = {
      S: S, paisagem: paisagem, tx: tx, ty: ty, tw: tw, th: th,
      ox: tx + B * S, oy: ty + B * S   // canto do CAMPO (sem o trilho) na tela
    };
    _hqFundoCache = null;
  }

  // Tela (px do aparelho) → local (a,b)
  function _hqTelaParaLocal(sx, sy) {
    var y = _hqLay, a, b;
    if (y.paisagem) { a = (sx - y.ox) / y.S; b = (sy - y.oy) / y.S; }
    else { b = (sx - y.ox) / y.S; a = HQ_MESA_C - (sy - y.oy) / y.S; }
    return { a: a, b: b };
  }
  // Local → mundo (referencial do anfitrião). É uma rotação de 180° pro convidado.
  function _hqLocalParaMundo(a, b) {
    return _hqSouAnfitriao ? { u: a, v: b } : { u: HQ_MESA_C - a, v: HQ_MESA_L - b };
  }
  // Mundo → tela (px do aparelho)
  function _hqMundoParaTela(u, v) {
    var a = _hqSouAnfitriao ? u : HQ_MESA_C - u;
    var b = _hqSouAnfitriao ? v : HQ_MESA_L - v;
    var y = _hqLay;
    if (y.paisagem) return { x: y.ox + a * y.S, y: y.oy + b * y.S };
    return { x: y.ox + b * y.S, y: y.oy + (HQ_MESA_C - a) * y.S };
  }
  // Ângulo pra desenhar a mesa (imagem com u no eixo x) já girada.
  function _hqAnguloMesa() {
    if (_hqLay.paisagem) return _hqSouAnfitriao ? 0 : Math.PI;
    return _hqSouAnfitriao ? -Math.PI / 2 : Math.PI / 2;
  }

  /* ── Partida ─────────────────────────────────────────────────── */
  function _hqResetarPosicoes() {
    var C = HQ_MESA_C, L = HQ_MESA_L;
    _hqDisco.u = C / 2; _hqDisco.v = L / 2; _hqDisco.vu = 0; _hqDisco.vv = 0;
    var casa = [HQ_CPU_LINHA_DEFESA, C - HQ_CPU_LINHA_DEFESA];
    for (var i = 0; i < 2; i++) {
      var r = _hqRaq[i];
      r.u = r.au = casa[i]; r.v = r.av = L / 2;
      r.vu = r.vv = r.cvu = r.cvv = 0;
    }
    _hqNet.u = C / 2; _hqNet.v = L / 2; _hqNet.vu = 0; _hqNet.vv = 0;
    _hqNet.hu = casa[0]; _hqNet.hv = L / 2; _hqNet.t = performance.now();
    _hqRender.u = C / 2; _hqRender.v = L / 2; _hqRender.hu = casa[0]; _hqRender.hv = L / 2;
    _hqRender.ok = false;
    _hqRastro = [];
    _hqParticulas = [];
  }

  function _hqReiniciarPartida() {
    _hqGols = [0, 0];
    _hqVencedor = -1;
    _hqNBatidas = 0; _hqNParedes = 0; _hqNGols = 0; _hqUltimoMarcador = -1;
    _hqPausado = false;
    _hqAguardandoOutro = false; _hqNetAguardando = false;
    _hqSimT = 0; _hqPosseT = 0; _hqPosseLado = -1;
    _hqCpuHist = []; _hqCpuTimer = 0; _hqCpuEspera = 0; _hqCpuAtacando = false;
    _hqFlash = 0; _hqTremor = 0;
    _hqResetarPosicoes();
    _hqIniciarSaque(Math.random() < 0.5 ? 0 : 1);
    _hqAtualizarHUD();
  }

  // Disco parado no centro, contagem "3, 2, 1" e aí sai rumo a quem RECEBE
  // (quem sofreu o gol, ou sorteado no começo) com ângulo sorteado.
  function _hqIniciarSaque(receptor) {
    _hqFase = 'saque';
    _hqTimer = HQ_SAQUE_CONTAGEM;
    _hqSaqueReceptor = receptor;
    _hqDisco.u = HQ_MESA_C / 2; _hqDisco.v = HQ_MESA_L / 2;
    _hqDisco.vu = 0; _hqDisco.vv = 0;
    _hqPosseT = 0; _hqPosseLado = -1;
    _hqRastro = [];
  }
  function _hqLancarSaque() {
    var ang = (Math.random() * 2 - 1) * HQ_SAQUE_ANGULO * Math.PI / 180;
    var sentido = _hqSaqueReceptor === 0 ? -1 : 1;
    _hqDisco.vu = sentido * Math.cos(ang) * HQ_SAQUE_VEL;
    _hqDisco.vv = Math.sin(ang) * HQ_SAQUE_VEL;
    _hqFase = 'jogo';
  }

  function _hqComecarPartida() {
    _hqMostrarTela('jogando');
    _hqDimensionar();
    _hqUltimoTs = 0;
    if (_hqRAF) cancelAnimationFrame(_hqRAF);
    _hqRAF = requestAnimationFrame(_hqLoop);
  }

  function _hqLoop(ts) {
    if (_hqEstado !== 'jogando') { _hqRAF = 0; return; }
    var dt = _hqUltimoTs ? Math.min(0.05, (ts - _hqUltimoTs) / 1000) : 0;
    _hqUltimoTs = ts;
    var agora = performance.now();

    if (dt > 0 && !_hqPausado) _hqAplicarTeclado(dt);

    if (_hqSouAnfitriao) {
      // Watchdog do anfitrião: o convidado manda a raquete o tempo todo; se
      // parou (app em segundo plano, rede caiu sem avisar), congela o lance
      // em vez de fazer gol num gol vazio.
      _hqAguardandoOutro = (_hqModo === 'multiplayer' && (agora - _hqUltimoPEm) > HQ_CONGELADO_AVISO_MS);
      if (_hqModo === 'multiplayer' && (agora - _hqUltimoPEm) > HQ_CONGELADO_FIM_MS) {
        _hqVoltarComAviso('Conexão perdida: o outro jogador parou de responder.');
        return;
      }
      _hqSimular(dt);
      if (_hqEstado !== 'jogando') return; // a partida pode ter acabado dentro do simular
    } else {
      _hqAguardandoOutro = _hqNetAguardando || (agora - _hqUltimoEEm) > HQ_CONGELADO_AVISO_MS;
      if ((agora - _hqUltimoEEm) > HQ_CONGELADO_FIM_MS) {
        _hqVoltarComAviso('Conexão perdida: o anfitrião parou de responder.');
        return;
      }
      _hqAtualizarConvidado(dt);
    }
    _hqAtualizarEfeitos(dt);
    _hqDesenhar();
    _hqRAF = requestAnimationFrame(_hqLoop);
  }

  // Convidado: move a PRÓPRIA raquete localmente (resposta instantânea),
  // manda a posição pro anfitrião e suaviza disco/raquete do anfitrião.
  function _hqAtualizarConvidado(dt) {
    var r = _hqRaq[1];
    if (dt > 0 && !_hqPausado) {
      var fim = _hqPassoRaquete(r, dt, HQ_RAQUETE_VEL_MAX);
      r.u = fim.u; r.v = fim.v;
    }
    var agora = performance.now();
    if (window.AngatubaMP && (agora - _hqUltimoEnvioRaq) >= HQ_REDE_RAQUETE_MS) {
      _hqUltimoEnvioRaq = agora;
      window.AngatubaMP.enviar({ t: 'p', u: _hqR1(r.u), v: _hqR1(r.v) });
    }
    if (!dt) return;
    // Disco: estado recebido + extrapolação curta pela velocidade (só com o
    // disco em jogo), e o desenhado corre atrás disso suavemente.
    var idade = Math.min(HQ_EXTRAPOLA_MAX, (agora - _hqNet.t) / 1000);
    var emJogo = _hqFase === 'jogo' && !_hqPausado;
    var pu = _hqNet.u + (emJogo ? _hqNet.vu * idade : 0);
    var pv = _hqClamp(_hqNet.v + (emJogo ? _hqNet.vv * idade : 0), HQ_RAIO_DISCO, HQ_MESA_L - HQ_RAIO_DISCO);
    var k = 1 - Math.exp(-HQ_SUAVIZACAO * dt);
    if (Math.abs(pu - _hqRender.u) + Math.abs(pv - _hqRender.v) > HQ_SNAP_PX) { _hqRender.u = pu; _hqRender.v = pv; }
    else { _hqRender.u += (pu - _hqRender.u) * k; _hqRender.v += (pv - _hqRender.v) * k; }
    _hqRender.hu += (_hqNet.hu - _hqRender.hu) * k;
    _hqRender.hv += (_hqNet.hv - _hqRender.hv) * k;
    _hqDisco.u = _hqRender.u; _hqDisco.v = _hqRender.v;
    _hqRaq[0].u = _hqRender.hu; _hqRaq[0].v = _hqRender.hv;
    if (_hqFase === 'jogo') _hqGravarRastro();
  }

  // Raquete persegue o alvo com velocidade máxima (sem teleporte).
  function _hqPassoRaquete(r, dt, velMax) {
    var du = r.au - r.u, dv = r.av - r.v;
    var d = Math.sqrt(du * du + dv * dv), passo = velMax * dt;
    if (d <= passo || d < 0.0001) return { u: r.au, v: r.av };
    return { u: r.u + du / d * passo, v: r.v + dv / d * passo };
  }

  /* ── Simulação (só quem simula: anfitrião ou solo) ───────────── */
  function _hqSimular(dt) {
    if (!dt) { _hqEnviarEstado(false); return; }
    if (_hqPausado || _hqAguardandoOutro) { _hqEnviarEstado(false); return; }
    _hqSimT += dt;

    if (_hqFase === 'saque') {
      var antes = Math.ceil(_hqTimer / (HQ_SAQUE_CONTAGEM / 3));
      _hqTimer -= dt;
      var depois = Math.ceil(_hqTimer / (HQ_SAQUE_CONTAGEM / 3));
      if (depois !== antes && depois >= 1) _hqSom('contagem', 3 - depois);
      if (_hqTimer <= 0) _hqLancarSaque();
    } else if (_hqFase === 'gol') {
      _hqTimer -= dt;
      if (_hqTimer <= 0) {
        if (_hqVencedor >= 0) { _hqEnviarEstado(true); _hqMostrarFim(); return; }
        _hqIniciarSaque(1 - _hqUltimoMarcador); // quem sofreu recebe o saque
      }
    }

    // Alvos: a CPU decide o dela (solo). O do jogador local já veio do
    // toque/teclado; o do convidado veio pela rede.
    var ini = [], fim = [];
    for (var i = 0; i < 2; i++) ini.push({ u: _hqRaq[i].u, v: _hqRaq[i].v });
    fim.push(_hqPassoRaquete(_hqRaq[0], dt, HQ_RAQUETE_VEL_MAX));
    if (_hqModo === 'solo') fim.push(_hqCpuMover(dt));
    else fim.push(_hqPassoRaquete(_hqRaq[1], dt, HQ_RAQUETE_VEL_MAX));
    for (i = 0; i < 2; i++) {
      var lim = _hqLimitarRaquete(i, fim[i].u, fim[i].v);
      fim[i] = lim;
      var vu = (fim[i].u - ini[i].u) / dt, vv = (fim[i].v - ini[i].v) / dt;
      var vm = Math.sqrt(vu * vu + vv * vv);
      if (vm > HQ_RAQUETE_VEL_IMPULSO) { vu *= HQ_RAQUETE_VEL_IMPULSO / vm; vv *= HQ_RAQUETE_VEL_IMPULSO / vm; }
      _hqRaq[i].vu = vu; _hqRaq[i].vv = vv;
    }

    if (_hqFase === 'jogo') {
      _hqFisicaDisco(dt, ini, fim);
    } else {
      for (i = 0; i < 2; i++) { _hqRaq[i].u = fim[i].u; _hqRaq[i].v = fim[i].v; }
    }

    // Histórico pro atraso de reação da CPU.
    _hqCpuHist.push({ t: _hqSimT, u: _hqDisco.u, v: _hqDisco.v, vu: _hqDisco.vu, vv: _hqDisco.vv });
    if (_hqCpuHist.length > 60) _hqCpuHist.shift();

    if (_hqFase === 'jogo') _hqGravarRastro();
    _hqEnviarEstado(false);
  }

  // Integra o disco em SUBPASSOS (as raquetes andam junto, interpoladas),
  // resolvendo colisão com raquetes, trilhos e quinas dos gols a cada um.
  function _hqFisicaDisco(dt, ini, fim) {
    var D = _hqDisco, C = HQ_MESA_C, L = HQ_MESA_L;
    var velD = Math.sqrt(D.vu * D.vu + D.vv * D.vv);
    var deslocRaq = 0;
    for (var i = 0; i < 2; i++) {
      deslocRaq = Math.max(deslocRaq, Math.abs(fim[i].u - ini[i].u) + Math.abs(fim[i].v - ini[i].v));
    }
    var n = Math.ceil((velD * dt + deslocRaq) / HQ_SUBPASSO_PX);
    n = _hqClamp(n, 1, HQ_SUBPASSOS_MAX);
    var h = dt / n;
    var amort = Math.exp(-HQ_ATRITO * h);
    // Deslocamento extra que o disco "empurra" de volta numa raquete que
    // tentou esmagá-lo contra o trilho (fica valendo até o fim do quadro).
    var empurra = [{ u: 0, v: 0 }, { u: 0, v: 0 }];

    for (var k = 1; k <= n; k++) {
      var f = k / n;
      for (i = 0; i < 2; i++) {
        _hqRaq[i].u = ini[i].u + (fim[i].u - ini[i].u) * f + empurra[i].u;
        _hqRaq[i].v = ini[i].v + (fim[i].v - ini[i].v) * f + empurra[i].v;
      }
      D.u += D.vu * h;
      D.v += D.vv * h;
      D.vu *= amort; D.vv *= amort;

      for (i = 0; i < 2; i++) _hqColidirRaquete(_hqRaq[i]);
      _hqColidirParedes();

      // Disco espremido entre raquete e trilho: quem cede é a raquete.
      for (i = 0; i < 2; i++) {
        var r = _hqRaq[i];
        var du = D.u - r.u, dv = D.v - r.v, d = Math.sqrt(du * du + dv * dv);
        var minD = HQ_RAIO_DISCO + HQ_RAIO_RAQUETE;
        if (d < minD && d > 0.0001) {
          var sobra = minD - d;
          empurra[i].u -= du / d * sobra; empurra[i].v -= dv / d * sobra;
          r.u -= du / d * sobra; r.v -= dv / d * sobra;
        }
      }

      // Gol: centro do disco dentro da boca e a menos de HQ_GOL_ZONA_MORTA da linha.
      if (Math.abs(D.v - L / 2) < HQ_GOL_LARG / 2) {
        if (D.u < HQ_GOL_ZONA_MORTA) { _hqGol(1); break; }
        if (D.u > C - HQ_GOL_ZONA_MORTA) { _hqGol(0); break; }
      }
    }
    for (i = 0; i < 2; i++) {
      var lim = _hqLimitarRaquete(i, _hqRaq[i].u, _hqRaq[i].v);
      _hqRaq[i].u = lim.u; _hqRaq[i].v = lim.v;
    }

    // Teto de velocidade.
    velD = Math.sqrt(D.vu * D.vu + D.vv * D.vv);
    if (velD > HQ_DISCO_VEL_MAX) { D.vu *= HQ_DISCO_VEL_MAX / velD; D.vv *= HQ_DISCO_VEL_MAX / velD; }

    // Regra dos 7 segundos: o campo onde o disco ficou tempo demais "perde
    // a posse" — saque no meio indo pro outro lado. Resolve disco parado,
    // preso num canto ou alguém enrolando de propósito.
    if (_hqFase === 'jogo') {
      var lado = D.u < C / 2 ? 0 : 1;
      if (lado === _hqPosseLado) _hqPosseT += dt; else { _hqPosseLado = lado; _hqPosseT = 0; }
      if (_hqPosseT > HQ_POSSE_TEMPO) _hqIniciarSaque(1 - lado);
    }
  }

  // Colisão círculo-círculo disco × raquete com impulso (conservação de
  // momento na direção normal, massas HQ_MASSA_*). A raquete é cinemática
  // (quem manda nela é o jogador), então só o disco recebe o impulso.
  function _hqColidirRaquete(r) {
    var D = _hqDisco;
    var du = D.u - r.u, dv = D.v - r.v;
    var d = Math.sqrt(du * du + dv * dv);
    var minD = HQ_RAIO_DISCO + HQ_RAIO_RAQUETE;
    if (d >= minD) return;
    if (d < 0.0001) { du = 1; dv = 0; d = 1; } // centros coincidindo: empurra pra qualquer lado
    var nu = du / d, nv = dv / d;
    // Correção de posição: tira o disco de dentro da raquete.
    D.u = r.u + nu * minD;
    D.v = r.v + nv * minD;
    var vrel = (D.vu - r.vu) * nu + (D.vv - r.vv) * nv;
    if (vrel >= 0) return; // já estão se afastando
    var j = -(1 + HQ_REST_RAQUETE) * vrel / (1 / HQ_MASSA_DISCO + 1 / HQ_MASSA_RAQUETE);
    D.vu += (j / HQ_MASSA_DISCO) * nu;
    D.vv += (j / HQ_MASSA_DISCO) * nv;
    _hqNBatidas++;
    _hqEfeitoBatida(D.u - nu * HQ_RAIO_DISCO, D.v - nv * HQ_RAIO_DISCO, Math.abs(vrel) > 120);
  }

  function _hqColidirParedes() {
    var D = _hqDisco, C = HQ_MESA_C, L = HQ_MESA_L, R = HQ_RAIO_DISCO, e = HQ_REST_PAREDE;
    var bateu = false;
    if (D.v < R) { D.v = R; if (D.vv < 0) { D.vv = -D.vv * e; bateu = true; } }
    else if (D.v > L - R) { D.v = L - R; if (D.vv > 0) { D.vv = -D.vv * e; bateu = true; } }
    var naBoca = Math.abs(D.v - L / 2) < HQ_GOL_LARG / 2;
    if (!naBoca) {
      if (D.u < R) { D.u = R; if (D.vu < 0) { D.vu = -D.vu * e; bateu = true; } }
      else if (D.u > C - R) { D.u = C - R; if (D.vu > 0) { D.vu = -D.vu * e; bateu = true; } }
    } else {
      // Quinas (traves) dos gols: colisão círculo × ponto.
      var traves = [[0, L / 2 - HQ_GOL_LARG / 2], [0, L / 2 + HQ_GOL_LARG / 2],
                    [C, L / 2 - HQ_GOL_LARG / 2], [C, L / 2 + HQ_GOL_LARG / 2]];
      for (var i = 0; i < 4; i++) {
        var du = D.u - traves[i][0], dv = D.v - traves[i][1];
        var d = Math.sqrt(du * du + dv * dv);
        if (d < R && d > 0.0001) {
          var nu = du / d, nv = dv / d;
          D.u = traves[i][0] + nu * R; D.v = traves[i][1] + nv * R;
          var vn = D.vu * nu + D.vv * nv;
          if (vn < 0) { D.vu -= (1 + e) * vn * nu; D.vv -= (1 + e) * vn * nv; bateu = true; }
        }
      }
    }
    if (bateu) { _hqNParedes++; _hqSom('parede'); }
  }

  function _hqGol(marcador) {
    _hqGols[marcador]++;
    _hqNGols++;
    _hqUltimoMarcador = marcador;
    _hqFase = 'gol';
    _hqTimer = HQ_GOL_PAUSA;
    _hqPosseT = 0;
    // Primeiro a HQ_GOLS_VITORIA, com HQ_VANTAGEM de diferença.
    var a = _hqGols[0], b = _hqGols[1];
    if ((a >= HQ_GOLS_VITORIA || b >= HQ_GOLS_VITORIA) && Math.abs(a - b) >= HQ_VANTAGEM) {
      _hqVencedor = a > b ? 0 : 1;
    }
    _hqEfeitoGol(marcador);
    _hqDisco.vu *= 0.25; _hqDisco.vv *= 0.25; // "cai" dentro do gol
    _hqAtualizarHUD();
    _hqEnviarEstado(true);
  }

  /* ── CPU ────────────────────────────────────────────────────────
     Pensa no referencial DELA (a = distância do próprio gol), enxerga o
     disco com atraso (HQ_CPU_REACAO), replaneja a cada HQ_CPU_DECISAO,
     erra um pouco (HQ_CPU_ERRO) e às vezes "pisca" (HQ_CPU_DISTRACAO).
     Planos, em ordem de prioridade: salvar (disco passou por ela e vai
     pro gol → corre pra linha do gol), interceptar (disco vindo rápido →
     prevê o cruzamento com quiques laterais e dá um bote no fim), defender
     (disco no campo do adversário → fica na frente do gol sombreando o
     lado dele) e atacar (disco lento no campo dela → vai pra TRÁS do disco
     na linha do gol adversário, às vezes de tabela, e bate).
     Referência de força (simulação contra um bot "humano médio": reação
     0,2 s, mão a 520 px/s): a CPU ganha ~55% das partidas. */
  function _hqCpuFoto() {
    var alvo = _hqSimT - HQ_CPU_REACAO;
    for (var i = _hqCpuHist.length - 1; i >= 0; i--) {
      if (_hqCpuHist[i].t <= alvo) return _hqCpuHist[i];
    }
    return _hqCpuHist.length ? _hqCpuHist[0] : { u: _hqDisco.u, v: _hqDisco.v, vu: 0, vv: 0 };
  }
  // Onde o disco vai estar (em b) quando chegar em "a", com quiques laterais.
  function _hqRefletirLateral(b) {
    var min = HQ_RAIO_DISCO, max = HQ_MESA_L - HQ_RAIO_DISCO, larg = max - min;
    var x = (b - min) % (2 * larg);
    if (x < 0) x += 2 * larg;
    return min + (x > larg ? 2 * larg - x : x);
  }
  function _hqCpuDecidir() {
    var C = HQ_MESA_C, L = HQ_MESA_L, RD = HQ_RAIO_DISCO, RR = HQ_RAIO_RAQUETE;
    var s = _hqCpuFoto(), r = _hqRaq[1];
    var pa = C - s.u, pb = s.v, pva = -s.vu, pvb = s.vv;   // disco no referencial da CPU
    var ca = C - r.u, cb = r.v;                              // CPU no referencial dela
    var erro = (Math.random() * 2 - 1) * HQ_CPU_ERRO;
    var meio = C / 2;
    var alvoA, alvoB, vel = HQ_CPU_VEL;
    var atacando = false;

    if (Math.random() < HQ_CPU_DISTRACAO) _hqCpuEspera = HQ_CPU_DISTRACAO_T;

    if (_hqFase !== 'jogo') {
      alvoA = HQ_CPU_LINHA_DEFESA; alvoB = L / 2;
    } else if (pa < ca - 2) {
      // Disco ATRÁS da CPU (entre ela e o gol dela).
      var lado = cb < pb ? -1 : 1;
      if (pva < -40) {
        // Indo pro gol: corre pra linha do gol e fecha onde ele vai chegar.
        var tg = Math.max(0, (pa - RR) / (-pva));
        alvoA = RR; alvoB = _hqClamp(_hqRefletirLateral(pb + pvb * tg), L / 2 - HQ_GOL_LARG / 2, L / 2 + HQ_GOL_LARG / 2);
      } else if (pa < RR + RD + 3) {
        // Encostado no fundo (não dá pra ficar atrás dele): espera na frente em
        // vez de ficar cutucando o disco contra o trilho — a regra dos 7 s
        // (HQ_POSSE_TEMPO) resolve se ele não sair sozinho.
        alvoA = pa + RD + RR + 12; alvoB = pb;
      } else {
        // Parado/lento: contorna pelo lado e volta pra trás dele.
        alvoA = Math.max(RR, pa - (RD + RR + 3)); alvoB = pb + lado * (RD + RR + 6);
      }
      vel = HQ_CPU_VEL_ATAQUE;
    } else if (pva < -90) {
      // Vindo rápido na direção dela (de qualquer campo): prevê onde o disco
      // cruza a linha da raquete e fecha ali.
      var aInter = Math.max(HQ_CPU_LINHA_DEFESA * 0.8, Math.min(ca, pa, meio - RR));
      var t = (pa - aInter) / (-pva);
      alvoA = aInter; alvoB = _hqRefletirLateral(pb + pvb * t) + erro;
      // Disco quase chegando: dá um bote pra frente em vez de só bloquear.
      if (t < 0.18) alvoA += 16;
      vel = HQ_CPU_VEL_ATAQUE;
    } else if (pa > meio + RD) {
      // Defesa: fica perto do gol, "sombreando" o lado onde o disco está.
      alvoA = HQ_CPU_LINHA_DEFESA; alvoB = L / 2 + (pb - L / 2) * 0.45 + erro;
    } else {
      // Ataque: mira o gol adversário (às vezes de tabela no trilho).
      if (!_hqCpuAtacando) {
        _hqCpuMira = (Math.random() * 2 - 1) * HQ_GOL_LARG * 0.35;
        _hqCpuTabela = Math.random() < HQ_CPU_TABELA ? (Math.random() < 0.5 ? -1 : 1) : 0;
      }
      var golB = L / 2 + _hqCpuMira;
      // Tabela: mira o REFLEXO do gol no trilho lateral — o disco bate no
      // trilho e sai direto pro gol (ângulo de incidência = de reflexão).
      if (_hqCpuTabela < 0) golB = 2 * RD - golB;
      else if (_hqCpuTabela > 0) golB = 2 * (L - RD) - golB;
      var dA = C - pa, dB = golB - pb, dn = Math.sqrt(dA * dA + dB * dB) || 1;
      dA /= dn; dB /= dn;
      var atrasA = pa - dA * (RD + RR + 4), atrasB = pb - dB * (RD + RR + 4);
      var longe = Math.sqrt((ca - atrasA) * (ca - atrasA) + (cb - atrasB) * (cb - atrasB));
      if (_hqCpuAtacando || longe < 9) {
        alvoA = pa + dA * 22; alvoB = pb + dB * 22 + erro * 0.5;
        vel = HQ_CPU_VEL_ATAQUE;
        atacando = true;
      } else {
        alvoA = atrasA; alvoB = atrasB;
      }
      // Desiste do bote se o disco já está indo embora rápido.
      if (pva > 200) atacando = false;
    }
    _hqCpuAtacando = atacando;
    var lim = _hqLimitarRaquete(1, C - alvoA, alvoB);
    _hqCpuAlvo.u = lim.u; _hqCpuAlvo.v = lim.v;
    _hqCpuVelAlvo = vel;
  }
  // Move a raquete da CPU com aceleração limitada (não vira na hora).
  function _hqCpuMover(dt) {
    var r = _hqRaq[1];
    _hqCpuTimer -= dt;
    if (_hqCpuTimer <= 0) { _hqCpuTimer = HQ_CPU_DECISAO; _hqCpuDecidir(); }
    var desU = 0, desV = 0;
    if (_hqCpuEspera > 0) {
      _hqCpuEspera -= dt;
    } else {
      var du = _hqCpuAlvo.u - r.u, dv = _hqCpuAlvo.v - r.v, d = Math.sqrt(du * du + dv * dv);
      if (d > 0.5) {
        var vd = Math.min(_hqCpuVelAlvo, d * 9);
        desU = du / d * vd; desV = dv / d * vd;
      }
    }
    var au = desU - r.cvu, av = desV - r.cvv, am = Math.sqrt(au * au + av * av), maxA = HQ_CPU_ACEL * dt;
    if (am > maxA) { au *= maxA / am; av *= maxA / am; }
    r.cvu += au; r.cvv += av;
    var nu = r.u + r.cvu * dt, nv = r.v + r.cvv * dt;
    var lim = _hqLimitarRaquete(1, nu, nv);
    if (lim.u !== nu) r.cvu = 0;
    if (lim.v !== nv) r.cvv = 0;
    r.au = lim.u; r.av = lim.v;
    return lim;
  }

  /* ── Envio do estado (anfitrião) ─────────────────────────────── */
  function _hqEnviarEstado(forcar) {
    if (_hqModo !== 'multiplayer' || !_hqSouAnfitriao || !window.AngatubaMP) return;
    var agora = performance.now();
    if (!forcar && (agora - _hqUltimoEnvio) < HQ_REDE_ESTADO_MS) return;
    _hqUltimoEnvio = agora;
    var D = _hqDisco, h = _hqRaq[0];
    window.AngatubaMP.enviar({
      t: 'e',
      du: _hqR1(D.u), dv: _hqR1(D.v), dvu: _hqR1(D.vu), dvv: _hqR1(D.vv),
      au: _hqR1(h.u), av: _hqR1(h.v),
      ga: _hqGols[0], gc: _hqGols[1],
      f: _hqFase, tm: Math.round(_hqTimer * 100) / 100, pz: _hqPausado, ag: _hqAguardandoOutro,
      nb: _hqNBatidas, np: _hqNParedes, ng: _hqNGols, ug: _hqUltimoMarcador,
      fim: (_hqFase === 'gol' && _hqVencedor >= 0 && _hqTimer <= 0), w: _hqVencedor
    });
  }

  /* ── Fim de partida ──────────────────────────────────────────── */
  function _hqMostrarFim() {
    if (_hqRAF) { cancelAnimationFrame(_hqRAF); _hqRAF = 0; }
    _hqPausado = false;
    _hqMostrarTela('fim');
    var eu = _hqEu();
    var meu = _hqGols[eu], dele = _hqGols[1 - eu];
    var venceu = _hqVencedor === eu;
    var titulo = document.getElementById('hq-fim-titulo');
    var msg = document.getElementById('hq-fim-msg');
    var placar = document.getElementById('hq-fim-placar');
    var owl = document.getElementById('hq-fim-owl');
    var btnRev = document.getElementById('hq-btn-revanche');
    if (titulo) titulo.textContent = venceu ? 'Você venceu! 🏆' : 'Não foi dessa vez';
    if (msg) msg.textContent = venceu ? 'Mandou bem contra ' + _hqNomeAdversario() + '!'
                                      : _hqNomeAdversario() + ' levou essa.';
    if (placar) { placar.textContent = meu + ' x ' + dele; placar.style.display = ''; }
    if (btnRev) { btnRev.disabled = false; btnRev.style.display = ''; btnRev.textContent = 'Jogar de novo'; }
    if (owl) { owl.src = venceu ? '/webp/owl-trophy.webp' : '/webp/owl-wave.webp'; owl.style.display = ''; }
    if (window.AngatubaSom && typeof window.AngatubaSom.fim === 'function') {
      try { window.AngatubaSom.fim(venceu); } catch (e) {}
    }
    var bridge = _hqBridge();
    if (venceu && bridge && bridge.efeitos) bridge.efeitos.confete('hq-fim', 80);
    _hqDesenhar();
  }

  // Adversário saiu com a tela de resultado aberta: o placar continua
  // valendo, mas a revanche vira "Criar nova sala" (mesmo 2.2 do Ping Pong).
  function _hqAdversarioSumiuNoFim() {
    _hqSemAdversario = true;
    var btnRev = document.getElementById('hq-btn-revanche');
    var msg = document.getElementById('hq-fim-msg');
    if (btnRev) { btnRev.disabled = false; btnRev.style.display = ''; btnRev.textContent = 'Criar nova sala'; }
    if (msg) msg.textContent = (_hqApelidoAdversario || 'O adversário') + ' saiu. Crie uma sala nova pra jogar outra.';
    _hqSairDaRede(true);
  }

  function _hqAtualizarHUD() {
    var eu = _hqEu();
    var elMeu = document.getElementById('hq-hud-meu');
    var elDele = document.getElementById('hq-hud-dele');
    var elNome = document.getElementById('hq-hud-nome-adversario');
    if (elMeu) elMeu.textContent = _hqGols[eu];
    if (elDele) elDele.textContent = _hqGols[1 - eu];
    if (elNome) elNome.textContent = _hqNomeAdversario();
  }

  /* ── Efeitos (rastro, partículas, flash, tremida) ──────────────── */
  function _hqGravarRastro() {
    _hqRastro.push({ u: _hqDisco.u, v: _hqDisco.v });
    if (_hqRastro.length > 10) _hqRastro.shift();
  }
  function _hqSoltarParticulas(u, v, qtd, velMax, cores, vida) {
    for (var i = 0; i < qtd && _hqParticulas.length < 160; i++) {
      var ang = Math.random() * Math.PI * 2, vel = velMax * (0.3 + Math.random() * 0.7);
      _hqParticulas.push({
        u: u, v: v, vu: Math.cos(ang) * vel, vv: Math.sin(ang) * vel,
        vida: vida * (0.6 + Math.random() * 0.4), vidaMax: vida,
        cor: cores[(Math.random() * cores.length) | 0], tam: Math.random() < 0.3 ? 2 : 1
      });
    }
  }
  function _hqEfeitoBatida(u, v, forte) {
    _hqSom('batida');
    _hqSoltarParticulas(u, v, forte ? 7 : 3, forte ? 90 : 50, ['#ffffff', '#fbbf24', '#a5e8ff'], 0.25);
  }
  function _hqEfeitoGol(marcador) {
    var eu = _hqEu();
    _hqSom(marcador === eu ? 'golMeu' : 'golDele');
    _hqFlash = 1;
    _hqTremor = 0.3;
    // Partículas na boca do gol onde entrou (gol em u=0 = ponto do convidado).
    var u = marcador === 1 ? 0 : HQ_MESA_C;
    _hqSoltarParticulas(u, HQ_MESA_L / 2, 46, 170, ['#fbbf24', '#fb923c', '#ffffff', '#ff5470', '#38bdf8'], 0.9);
    _hqRastro = [];
  }
  function _hqAtualizarEfeitos(dt) {
    if (!dt) return;
    for (var i = _hqParticulas.length - 1; i >= 0; i--) {
      var p = _hqParticulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { _hqParticulas.splice(i, 1); continue; }
      p.u += p.vu * dt; p.v += p.vv * dt;
      p.vu *= Math.exp(-3 * dt); p.vv *= Math.exp(-3 * dt);
    }
    if (_hqFlash > 0) _hqFlash = Math.max(0, _hqFlash - dt * 2.6);
    if (_hqTremor > 0) _hqTremor = Math.max(0, _hqTremor - dt);
  }

  /* ── Desenho ─────────────────────────────────────────────────── */
  // Mesa procedural (reserva caso mesa.webp não carregue) — mesmo tamanho
  // e mesmas cores do asset, então nada muda de lugar.
  var _hqMesaReserva = null;
  function _hqMesaImagem() {
    var reg = _hqAssets[_HQ_ASSET_BASE + 'mesa.webp'];
    if (reg && reg.ok && reg.img) return reg.img;
    if (_hqMesaReserva) return _hqMesaReserva;
    var C = HQ_MESA_C, L = HQ_MESA_L, B = HQ_BORDA, G = HQ_GOL_LARG;
    var cv = document.createElement('canvas');
    cv.width = C + 2 * B; cv.height = L + 2 * B;
    var c = cv.getContext('2d');
    c.fillStyle = '#f59e0b'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#0f2c52'; c.fillRect(B, B, C, L);
    c.fillStyle = '#fbbf24'; c.fillRect(B + C / 2 - 1, B, 2, L);
    c.fillStyle = '#050a14';
    c.fillRect(0, B + L / 2 - G / 2, B, G);
    c.fillRect(B + C, B + L / 2 - G / 2, B, G);
    _hqMesaReserva = cv;
    return cv;
  }
  function _hqMontarFundo() {
    var y = _hqLay;
    var cv = _hqFundoCache || document.createElement('canvas');
    cv.width = _hqW; cv.height = _hqH;
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    var g = c.createRadialGradient(_hqW / 2, _hqH / 2, 10, _hqW / 2, _hqH / 2, Math.max(_hqW, _hqH) * 0.75);
    g.addColorStop(0, '#12213d');
    g.addColorStop(1, '#050913');
    c.fillStyle = g;
    c.fillRect(0, 0, _hqW, _hqH);
    // sombra da mesa (pixel: bloco deslocado, sem blur)
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(y.tx + 3 * y.S, y.ty + 4 * y.S, y.tw, y.th);
    var img = _hqMesaImagem();
    var iw = (HQ_MESA_C + 2 * HQ_BORDA) * y.S, ih = (HQ_MESA_L + 2 * HQ_BORDA) * y.S;
    c.save();
    c.translate(y.tx + y.tw / 2, y.ty + y.th / 2);
    c.rotate(_hqAnguloMesa());
    c.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    c.restore();
    // Emblema da coruja no círculo central — sempre em pé.
    var ow = _hqAssets[_HQ_CORUJA_PIXEL];
    if (ow && ow.ok && ow.img) {
      var ctr = _hqMundoParaTela(HQ_MESA_C / 2, HQ_MESA_L / 2);
      var w = ow.img.naturalWidth * y.S, h = ow.img.naturalHeight * y.S;
      c.globalAlpha = 0.2;
      c.drawImage(ow.img, Math.round(ctr.x - w / 2), Math.round(ctr.y - h / 2), w, h);
      c.globalAlpha = 1;
    }
    _hqFundoCache = cv;
  }

  function _hqSprite(nome, u, v, raio, corReserva) {
    var ctx = _hqCtx, y = _hqLay;
    var p = _hqMundoParaTela(u, v);
    var reg = _hqAssets[_HQ_ASSET_BASE + nome];
    if (reg && reg.ok && reg.img) {
      var w = reg.img.naturalWidth * y.S, h = reg.img.naturalHeight * y.S;
      ctx.drawImage(reg.img, Math.round(p.x - w / 2), Math.round(p.y - h / 2), w, h);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, raio * y.S, 0, Math.PI * 2);
      ctx.fillStyle = corReserva;
      ctx.fill();
    }
  }

  function _hqDesenhar() {
    if (!_hqCtx || !_hqW || !_hqH) return;
    if (!_hqLay) _hqDimensionar();
    var ctx = _hqCtx, y = _hqLay, S = y.S;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (!_hqFundoCache || _hqFundoCache.width !== _hqW || _hqFundoCache.height !== _hqH) _hqMontarFundo();

    ctx.save();
    if (_hqTremor > 0) {
      var amp = 3 * _hqDpr * (_hqTremor / 0.3);
      ctx.translate(Math.round((Math.random() * 2 - 1) * amp), Math.round((Math.random() * 2 - 1) * amp));
    }
    ctx.drawImage(_hqFundoCache, 0, 0);

    var jogando = _hqEstado === 'jogando' || _hqEstado === 'fim';
    var eu = _hqEu();

    // Placar gigante e apagado em cada metade (o seu do seu lado).
    if (jogando) {
      ctx.font = "900 " + Math.round(HQ_MESA_L * 0.42 * S) + "px 'Syne', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      var ladoMeu = _hqMundoParaTela(eu === 0 ? HQ_MESA_C / 4 : HQ_MESA_C * 3 / 4, HQ_MESA_L / 2);
      var ladoDele = _hqMundoParaTela(eu === 0 ? HQ_MESA_C * 3 / 4 : HQ_MESA_C / 4, HQ_MESA_L / 2);
      ctx.fillText(String(_hqGols[eu]), ladoMeu.x, ladoMeu.y);
      ctx.fillText(String(_hqGols[1 - eu]), ladoDele.x, ladoDele.y);
    }

    // Rastro do disco: quadradinhos pixel que somem.
    for (var i = 0; i < _hqRastro.length; i++) {
      var rp = _hqMundoParaTela(_hqRastro[i].u, _hqRastro[i].v);
      var f = (i + 1) / (_hqRastro.length + 1);
      var tam = Math.max(1, Math.round(HQ_RAIO_DISCO * 1.4 * f)) * S;
      ctx.fillStyle = 'rgba(251,191,36,' + (0.28 * f).toFixed(3) + ')';
      ctx.fillRect(Math.round(rp.x - tam / 2), Math.round(rp.y - tam / 2), tam, tam);
    }

    // Raquetes (você = azul, adversário = vermelha) e disco.
    _hqSprite('raquete-vermelha.webp', _hqRaq[1 - eu].u, _hqRaq[1 - eu].v, HQ_RAIO_RAQUETE, '#ff5470');
    _hqSprite('raquete-azul.webp', _hqRaq[eu].u, _hqRaq[eu].v, HQ_RAIO_RAQUETE, '#38bdf8');
    if (jogando && !(_hqFase === 'gol' && _hqTimer < HQ_GOL_PAUSA * 0.6)) {
      _hqSprite('disco.webp', _hqDisco.u, _hqDisco.v, HQ_RAIO_DISCO, '#15171e');
    }

    // Partículas.
    for (i = 0; i < _hqParticulas.length; i++) {
      var p = _hqParticulas[i];
      var pp = _hqMundoParaTela(p.u, p.v);
      var t = p.tam * S;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vida / p.vidaMax * 1.4));
      ctx.fillStyle = p.cor;
      ctx.fillRect(Math.round(pp.x - t / 2), Math.round(pp.y - t / 2), t, t);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Flash do gol (tela toda).
    if (_hqFlash > 0) {
      ctx.fillStyle = 'rgba(255,214,120,' + (_hqFlash * 0.32).toFixed(3) + ')';
      ctx.fillRect(0, 0, _hqW, _hqH);
    }

    if (_hqEstado === 'jogando') _hqDesenharTextos();
  }

  function _hqTexto(txt, x, y, px, cor, alpha) {
    var ctx = _hqCtx;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = "900 " + Math.round(px) + "px 'Syne', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // contorno "pixel": sombra dura deslocada, sem blur
    ctx.fillStyle = 'rgba(5,9,19,0.85)';
    var o = Math.max(2, Math.round(px / 14));
    ctx.fillText(txt, x + o, y + o);
    ctx.fillStyle = cor;
    ctx.fillText(txt, x, y);
    ctx.restore();
  }

  function _hqDesenharTextos() {
    var y = _hqLay, cx = y.tx + y.tw / 2, cy = y.ty + y.th / 2;
    var base = Math.min(y.tw, y.th);
    var eu = _hqEu();
    if (_hqPausado || _hqAguardandoOutro) {
      if (_hqAguardandoOutro) {
        _hqCtx.fillStyle = 'rgba(0,0,0,0.45)';
        _hqCtx.fillRect(0, 0, _hqW, _hqH);
        _hqTexto('Aguardando o outro jogador…', cx, cy, base * 0.07, '#ffffff');
      }
      return;
    }
    if (_hqFase === 'saque') {
      var n = Math.max(1, Math.ceil(_hqTimer / (HQ_SAQUE_CONTAGEM / 3)));
      var frac = (_hqTimer % (HQ_SAQUE_CONTAGEM / 3)) / (HQ_SAQUE_CONTAGEM / 3);
      _hqTexto(String(n), cx, cy, base * (0.22 + 0.08 * frac), '#fbbf24', 0.5 + 0.5 * frac);
      if (_hqGols[0] + _hqGols[1] === 0) {
        // Dica só no primeiro saque: aparece no SEU campo.
        var dica = _hqMundoParaTela(eu === 0 ? HQ_MESA_C * 0.32 : HQ_MESA_C * 0.68, HQ_MESA_L / 2);
        _hqTexto('Arraste a sua coruja azul', dica.x, dica.y, base * 0.055, '#a5e8ff');
      }
    } else if (_hqFase === 'gol') {
      var t = 1 - _hqTimer / HQ_GOL_PAUSA;           // 0 → 1 durante a comemoração
      var pop = t < 0.15 ? t / 0.15 : 1;
      var meu = _hqUltimoMarcador === eu;
      _hqTexto('GOL!', cx, cy - base * 0.06, base * 0.26 * (0.6 + 0.4 * pop), meu ? '#fbbf24' : '#ff5470');
      var sub = meu ? 'Você marcou!' : (_hqNomeAdversario() + ' marcou');
      if (_hqVencedor >= 0) sub = (_hqVencedor === eu) ? 'Gol da vitória!' : 'Fim de jogo';
      _hqTexto(sub, cx, cy + base * 0.14, base * 0.07, '#ffffff', pop);
    }
  }
})();
