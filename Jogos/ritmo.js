/* ═══════════════════════════════════════════════════════════════
   RITMO DA CORUJA — módulo de jogo (lazy-loaded)
   Jogo de ritmo estilo osu!mania com 4 colunas: as notas descem pelas
   pistas e a pessoa toca na coluna certa quando a nota passa pela
   linha de acerto, no tempo da música.

   Fluxo:  seleção (música + dificuldade) → partida → resultado → 🪙

   Peças principais:
   - RT_CATALOGO ........ lista das músicas (arquivo, BPM, duração, níveis)
   - Beatmaps ........... /Jogos/ritmo/beatmaps/<id>.<normal|hard>.json
                          { songId, difficulty, bpm, offset, notes:[{time,column}] }
   - Relógio ............ Web Audio (AudioContext). A música é decodificada
                          inteira e tocada por um AudioBufferSourceNode; o
                          tempo da música sai do ctx.currentTime (preciso,
                          ao contrário do <audio>.currentTime no celular).
   - Julgamento ......... RT_JANELAS (Perfeito / Ótimo / Bom / Erro)
   - Pontuação .......... até 1.000.000 (90% precisão + 10% combo máximo)
   - Recompensa ......... _rtMoedas(): rank × dificuldade × precisão

   Fala com o app APENAS via window.AngatubaGames (a ponte do hub):
   moedasAdd, statsRegistrarPartida, menu (pausa unificada), efeitos.
   Expõe window.RitmoGame = { preparar, parar, suspenderAudio }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     CATÁLOGO
     arquivo ... caminho do MP3 (pasta /musicas/ do site)
     bpm ....... aproximado (só informativo — o tempo das notas vem do beatmap)
     duracao ... segundos
     previa .... segundo em que começa a prévia na tela de seleção (refrão/trecho forte)
     dif ....... por dificuldade: quantidade de notas e nível (1–10)
     Para adicionar uma música: suba o MP3 em /musicas/, gere/escreva os
     dois beatmaps em /Jogos/ritmo/beatmaps/ e acrescente uma linha aqui.
  ══════════════════════════════════════════════════════════════ */
  var RT_CATALOGO = [
    { id: 'ninguem-te-repara', previa: 76,      titulo: 'Ninguém Te Repara', sub: 'Brega romântico',        arquivo: '/musicas/Ninguém Te Repara.mp3',               bpm: 92,  duracao: 212, dif: { normal: { notas: 322, nivel: 3 }, hard: { notas: 689, nivel: 7 } } },
    { id: 'estatica', previa: 121,               titulo: 'Estática',          sub: 'Rock alternativo',       arquivo: '/musicas/Estática.mp3',                        bpm: 131, duracao: 167, dif: { normal: { notas: 263, nivel: 4 }, hard: { notas: 560, nivel: 7 } } },
    { id: 'estatica-v2', previa: 147,            titulo: 'Estática',          sub: 'Versão 2',               arquivo: '/musicas/Estática versao 2.mp3',               bpm: 131, duracao: 199, dif: { normal: { notas: 312, nivel: 4 }, hard: { notas: 684, nivel: 8 } } },
    { id: 'estatica-eletronica', previa: 37,    titulo: 'Estática',          sub: 'Eletrônica',             arquivo: '/musicas/Estática eletronica.mp3',             bpm: 109, duracao: 162, dif: { normal: { notas: 254, nivel: 3 }, hard: { notas: 543, nivel: 7 } } },
    { id: 'estatica-eletronica-v2', previa: 128, titulo: 'Estática',          sub: 'Eletrônica · versão 2',  arquivo: '/musicas/Estática eletronica versao 2.mp3',    bpm: 110, duracao: 176, dif: { normal: { notas: 276, nivel: 3 }, hard: { notas: 604, nivel: 7 } } },
    { id: 'transborda', previa: 58,             titulo: 'Transborda',        sub: 'Melodic house',          arquivo: '/musicas/Transborda.mp3',                      bpm: 125, duracao: 240, dif: { normal: { notas: 379, nivel: 4 }, hard: { notas: 833, nivel: 8 } } },
    { id: 'plateia', previa: 56,                titulo: 'Plateia',           sub: 'Pop / R&B',              arquivo: '/musicas/Plateia.mp3',                         bpm: 101, duracao: 180, dif: { normal: { notas: 281, nivel: 3 }, hard: { notas: 604, nivel: 7 } } },
    { id: 'plateia-v2', previa: 127,             titulo: 'Plateia',           sub: 'Versão 2',               arquivo: '/musicas/Plateia versao 2.mp3',                bpm: 101, duracao: 218, dif: { normal: { notas: 344, nivel: 3 }, hard: { notas: 745, nivel: 7 } } },
    { id: 'bateria-fraca', previa: 86,          titulo: 'Bateria Fraca',     sub: 'Neo-soul',               arquivo: '/musicas/Bateria Fraca.mp3',                   bpm: 92,  duracao: 206, dif: { normal: { notas: 314, nivel: 3 }, hard: { notas: 656, nivel: 7 } } },
    { id: 'mare-alta', previa: 132,              titulo: 'Maré Alta',         sub: 'Trap',                   arquivo: '/musicas/Maré Alta.mp3',                       bpm: 138, duracao: 187, dif: { normal: { notas: 296, nivel: 4 }, hard: { notas: 655, nivel: 8 } } }
  ];

  // Sobe este número sempre que editar QUALQUER beatmap: ele entra na URL
  // (?v=N) e faz o navegador/Service Worker buscar a versão nova em vez
  // da cópia guardada (os beatmaps ficam no cache pra jogar offline).
  var RT_MAPAS_VERSAO = 1;
  var RT_MAPAS_PASTA = '/Jogos/ritmo/beatmaps/';
  // Mesmo nome do CACHE_JOGOS do service-worker.js (o MP3 já cai lá
  // sozinho pelo SW; aqui guardamos também o JSON do beatmap).
  var RT_CACHE_JOGOS = 'angatubaon-jogos-v4';

  /* ── Julgamento (ms de distância da nota) ──────────────────────
     Um pouco mais folgado que o osu!mania de PC: toque de tela tem
     latência maior que teclado. "erro" é até onde um toque ainda
     "consome" a nota (como Erro); depois disso a nota passa direto. */
  var RT_JANELAS = { perfeito: 45, otimo: 90, bom: 135, erro: 170 };
  var RT_VALOR   = { perfeito: 1, otimo: 0.7, bom: 0.4, erro: 0 };
  var RT_ROTULO  = { perfeito: 'PERFEITO', otimo: 'ÓTIMO', bom: 'BOM', erro: 'ERRO' };
  var RT_COR_JULG = { perfeito: '#7cf5ff', otimo: '#5eead4', bom: '#fbbf24', erro: '#f87171' };

  // Cores das pistas (externas roxo-coruja, internas âmbar).
  var RT_COR_COL = ['#a78bfa', '#fbbf24', '#fbbf24', '#a78bfa'];
  // Teclado (PC): D F J K.
  var RT_TECLAS = { d: 0, f: 1, j: 2, k: 3 };

  var RT_LEAD_S = 2.2;         // silêncio antes da música começar (as notas já vêm descendo)
  var RT_RETOMAR_S = 2.0;      // ao continuar da pausa, a música volta com esse "respiro"

  var RT_KEY_REC = 'angatuba_ritmo_recordes';  // { "<id>|<dif>": {score, acc, rank, combo} }
  var RT_KEY_CFG = 'angatuba_ritmo_cfg';       // { dif, velocidade, ajuste, ultima }

  /* ── Estado ──────────────────────────────────────────────────── */
  var _rtRoot = null;            // #ritmo-root
  var _rtEls = {};               // atalhos do DOM
  var _rtCfg = _rtCfgLer();
  var _rtSelId = _rtCfg.ultima || RT_CATALOGO[0].id;

  var _rtCtx = null, _rtGanho = null, _rtFonte = null;
  var _rtBufId = null, _rtBuf = null;    // última música decodificada (só uma na memória)
  var _rtMapas = {};                     // "<id>|<dif>" -> beatmap já baixado

  var _rtEstado = 'selecao';   // selecao | carregando | jogando | resultado
  var _rtPausado = false;
  var _rtPosPausa = 0;         // ms da música quando pausou
  var _rtInicioCtx = 0;        // ctx.currentTime em que a música estaria em 0 ms
  var _rtUltCtx = -1, _rtUltPerf = 0;
  var _rtRAF = 0;
  var _rtTokenCarga = 0;       // invalida cargas antigas se a pessoa trocar de tela
  var _rtInicioReal = 0, _rtPausaMs = 0, _rtPausaDesde = 0; // pra contar segundos jogados

  // Partida
  var _rtMusica = null, _rtDif = 'normal', _rtMapa = null;
  var _rtNotas = [];           // todas, ordenadas por tempo: {t, c, j:null|'perfeito'...}
  var _rtPorCol = [[], [], [], []];
  var _rtPonteiro = [0, 0, 0, 0];  // próxima nota não julgada por coluna
  var _rtDesenhoIni = 0;       // primeira nota que ainda pode aparecer na tela
  var _rtCont = null;          // contadores {perfeito, otimo, bom, erro}
  var _rtSoma = 0, _rtJulgadas = 0, _rtCombo = 0, _rtComboMax = 0;
  var _rtDesvioSoma = 0, _rtDesvioN = 0;   // toques acertados: média >0 = atrasado
  var _rtFim = 0;              // ms em que a partida termina
  var _rtSaindo = false;

  // Visual
  var _rtCanvas = null, _rtG = null, _rtW = 0, _rtH = 0, _rtDpr = 1;
  var _rtApertada = [0, 0, 0, 0];      // pista pressionada (contagem de dedos/teclas)
  var _rtBrilho = [0, 0, 0, 0];        // flash de acerto por pista (0..1)
  var _rtPonteiros = {};               // pointerId -> coluna
  var _rtJulgVis = null;               // {tipo, ate, desvio}
  var _rtUltimoFrame = 0;

  /* ── Utilidades ─────────────────────────────────────────────── */
  function _rtG_() { return window.AngatubaGames || null; }
  function _rtEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _rtMMSS(seg) {
    seg = Math.max(0, Math.round(seg));
    return Math.floor(seg / 60) + ':' + ('0' + (seg % 60)).slice(-2);
  }
  function _rtMusicaPorId(id) {
    for (var i = 0; i < RT_CATALOGO.length; i++) if (RT_CATALOGO[i].id === id) return RT_CATALOGO[i];
    return null;
  }
  // Caminho do MP3 com cada pedaço codificado (nomes têm espaço e acento).
  function _rtUrlAudio(m) {
    return m.arquivo.split('/').map(function (p) { return p ? encodeURIComponent(p) : p; }).join('/');
  }
  function _rtCfgLer() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(RT_KEY_CFG) || '{}') || {}; } catch (e) {}
    return {
      dif: c.dif === 'hard' ? 'hard' : 'normal',
      velocidade: Math.max(1, Math.min(10, Math.round(Number(c.velocidade) || 6))),
      ajuste: Math.max(-200, Math.min(200, Math.round(Number(c.ajuste) || 0))),
      ultima: typeof c.ultima === 'string' ? c.ultima : ''
    };
  }
  function _rtCfgSalvar() {
    try { localStorage.setItem(RT_KEY_CFG, JSON.stringify(_rtCfg)); } catch (e) {}
  }
  function _rtRecLer() {
    try { var o = JSON.parse(localStorage.getItem(RT_KEY_REC) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function _rtRecSalvar(o) {
    try { localStorage.setItem(RT_KEY_REC, JSON.stringify(o)); } catch (e) {}
  }
  // Velocidade 1..10 → tempo (ms) que a nota leva do topo até a linha de acerto.
  function _rtTempoQueda() { return 2100 - _rtCfg.velocidade * 150; }

  /* ══════════════════════════════════════════════════════════════
     ÁUDIO (Web Audio)
  ══════════════════════════════════════════════════════════════ */
  // Cria/destrava o AudioContext. Precisa rodar DENTRO do toque em "Jogar"
  // (iOS/Chrome só liberam áudio num gesto da pessoa).
  function _rtAudioGarantir() {
    if (!_rtCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { _rtCtx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { _rtCtx = new AC(); } catch (e2) { return null; } }
      _rtGanho = _rtCtx.createGain();
      _rtGanho.connect(_rtCtx.destination);
    }
    // iOS 17+: toca mesmo com a chave de silencioso ligada (é uma música).
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (_rtCtx.state !== 'running' && _rtCtx.resume) { try { _rtCtx.resume(); } catch (e) {} }
    return _rtCtx;
  }
  function _rtAudioSuspender() {
    if (_rtCtx && _rtCtx.state === 'running' && _rtCtx.suspend) { try { _rtCtx.suspend(); } catch (e) {} }
  }
  function _rtSomAtivo() {
    var S = window.AngatubaSom;
    return !S || typeof S.ativo !== 'function' || S.ativo();
  }
  function _rtPararFonte() {
    if (_rtFonte) {
      try { _rtFonte.onended = null; _rtFonte.stop(); } catch (e) {}
      try { _rtFonte.disconnect(); } catch (e) {}
      _rtFonte = null;
    }
  }
  // Toca a música a partir de "posMs", começando daqui a "atrasoS" segundos.
  // Define o relógio: tempo da música = (ctx.currentTime - _rtInicioCtx) * 1000.
  function _rtTocarDe(posMs, atrasoS) {
    _rtPararFonte();
    var ctx = _rtCtx;
    var quando = ctx.currentTime + atrasoS;
    var fonte = ctx.createBufferSource();
    fonte.buffer = _rtBuf;
    fonte.connect(_rtGanho);
    var posS = posMs / 1000;
    if (posS >= 0) fonte.start(quando, posS);
    else fonte.start(quando - posS, 0);          // começa antes do 0: espera em silêncio
    _rtInicioCtx = quando - posS;
    _rtFonte = fonte;
    _rtGanho.gain.cancelScheduledValues(ctx.currentTime);
    _rtGanho.gain.setValueAtTime(_rtSomAtivo() ? 1 : 0, ctx.currentTime);
    _rtUltCtx = -1;
  }

  /* ── Prévia na tela de seleção (estilo Guitar Hero) ──────────────
     Tocar no card da música toca RT_PREVIA_S segundos a partir de
     m.previa, com fade de entrada/saída. Usa o MESMO download/decodificação
     da partida: se a pessoa tocar "Jogar" em seguida, a música já está
     pronta. Para ao trocar de música, ao começar a partida e ao sair. */
  var RT_PREVIA_S = 12;
  var _rtPrev = { id: null, carregando: null, fonte: null, ganho: null, token: 0 };
  function _rtPreviaParar() {
    _rtPrev.token++;
    _rtPrev.carregando = null;
    if (_rtPrev.fonte) {
      var f = _rtPrev.fonte, g = _rtPrev.ganho;
      try {
        var t = _rtCtx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.15);   // corta sem "estalo"
        f.onended = null;
        f.stop(t + 0.16);
      } catch (e) { try { f.stop(); } catch (e2) {} }
      setTimeout(function () { try { f.disconnect(); g.disconnect(); } catch (e) {} }, 300);
    }
    _rtPrev.fonte = null; _rtPrev.ganho = null; _rtPrev.id = null;
    _rtPreviaIcones();
  }
  function _rtPreviaTocar(m) {
    _rtPreviaParar();
    if (!_rtAudioGarantir()) return;            // dentro do toque no card
    var token = _rtPrev.token;
    _rtPrev.carregando = m.id;
    _rtPreviaIcones();
    _rtCarregarAudio(m, null).then(function (buf) {
      if (token !== _rtPrev.token || _rtEstado !== 'selecao') return;
      _rtPrev.carregando = null;
      var ctx = _rtCtx, t0 = ctx.currentTime + 0.05;
      var dur = Math.min(RT_PREVIA_S, buf.duration);
      var ini = Math.max(0, Math.min(m.previa || buf.duration * 0.4, buf.duration - dur - 0.5));
      var vol = _rtSomAtivo() ? 0.9 : 0;
      var g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.8);
      g.gain.setValueAtTime(vol, t0 + dur - 1.5);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      var f = ctx.createBufferSource();
      f.buffer = buf;
      f.connect(g);
      f.onended = function () {
        if (_rtPrev.fonte !== f) return;
        try { f.disconnect(); g.disconnect(); } catch (e) {}
        _rtPrev.fonte = null; _rtPrev.ganho = null; _rtPrev.id = null;
        _rtPreviaIcones();
      };
      f.start(t0, ini, dur);
      _rtPrev.fonte = f; _rtPrev.ganho = g; _rtPrev.id = m.id;
      _rtPreviaIcones();
    }).catch(function (err) {
      if (token !== _rtPrev.token) return;
      _rtPrev.carregando = null;
      _rtPreviaIcones();
      _rtMostrarErro(_rtMsgDoErro(err));
    });
  }
  // Atualiza só os ícones dos cards (sem redesenhar a lista toda).
  function _rtPreviaIcones() {
    if (!_rtEls.lista) return;
    var cards = _rtEls.lista.querySelectorAll('[data-musica]');
    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].getAttribute('data-musica');
      var ico = cards[i].querySelector('.rt-musica-ico');
      if (!ico) continue;
      var carregando = _rtPrev.carregando === id, tocando = _rtPrev.id === id;
      ico.className = 'rt-musica-ico' + (carregando ? ' rt-ico-carregando' : '') + (tocando ? ' rt-ico-tocando' : '');
      ico.innerHTML = carregando ? '' : tocando ? '<span class="rt-eq"><i></i><i></i><i></i></span>' : (id === _rtSelId ? '▶' : '♪');
      cards[i].setAttribute('aria-label', cards[i].getAttribute('data-titulo') + (tocando ? ' — tocando prévia (toque para parar)' : ' — toque para ouvir a prévia'));
    }
  }

  /* ── Relógio da música (ms) ─────────────────────────────────────
     ctx.currentTime anda em "degraus" (blocos de áudio); entre um degrau
     e outro interpolamos com performance.now() — no máximo 40 ms — pra
     o movimento ficar liso. Desconta a latência de saída (Bluetooth) e
     soma o ajuste manual de sincronia escolhido pela pessoa. */
  function _rtAgoraMs() {
    if (!_rtCtx) return 0;
    if (_rtPausado) return _rtPosPausa;
    var ct = _rtCtx.currentTime, pn = performance.now();
    if (ct !== _rtUltCtx) { _rtUltCtx = ct; _rtUltPerf = pn; }
    var extra = Math.min(40, pn - _rtUltPerf);
    var lat = _rtCtx.outputLatency || _rtCtx.baseLatency || 0;
    return (ct - _rtInicioCtx - lat) * 1000 + extra - _rtCfg.ajuste;
  }

  /* ── Download + decodificação ─────────────────────────────────── */
  // Erro com tipo, pra mensagem certa na tela:
  //   'rede'    → sem internet / servidor fora
  //   'arquivo' → o MP3 chegou, mas não é um áudio válido (ex.: arquivo
  //               quebrado no servidor) ou não existe (404)
  //   'mapa'    → o beatmap não carregou
  function _rtErro(tipo, msg) { var e = new Error(msg || tipo); e.tipo = tipo; return e; }
  // Um MP3 de 2–4 min tem vários MB; abaixo disso é arquivo quebrado
  // (foi o caso de 5 faixas que subiram pro GitHub com 2 bytes).
  var RT_AUDIO_MIN_BYTES = 100000;

  function _rtBaixarComProgresso(url, aoProgresso, recarregar) {
    // recarregar: pula o cache HTTP do navegador (o GitHub Pages manda max-age=600)
    return fetch(url, recarregar ? { cache: 'reload' } : undefined).catch(function () {
      throw _rtErro('rede', 'fetch falhou');
    }).then(function (r) {
      if (!r.ok) throw _rtErro(r.status === 404 ? 'arquivo' : 'rede', 'HTTP ' + r.status);
      var total = Number(r.headers.get('content-length')) || 0;
      if (!total || !r.body || !r.body.getReader) return r.arrayBuffer();
      var leitor = r.body.getReader(), partes = [], recebido = 0;
      function ler() {
        return leitor.read().then(function (p) {
          if (p.done) {
            var tudo = new Uint8Array(recebido), o = 0;
            for (var i = 0; i < partes.length; i++) { tudo.set(partes[i], o); o += partes[i].length; }
            return tudo.buffer;
          }
          partes.push(p.value); recebido += p.value.length;
          aoProgresso(Math.min(1, recebido / total));
          return ler();
        });
      }
      return ler();
    });
  }
  function _rtDecodificar(ab) {
    return new Promise(function (ok, falha) {
      // Forma com callbacks: o Safari antigo não devolve Promise.
      var p = _rtCtx.decodeAudioData(ab, ok, falha);
      if (p && typeof p.then === 'function') p.then(ok, falha);
    });
  }
  // Apaga a URL de todos os caches do app. O SW guarda MP3 em cache-first
  // (CACHE_JOGOS): se uma vez chegou um arquivo quebrado, ele ficaria preso
  // ali pra sempre — mesmo depois de corrigido no servidor.
  function _rtApagarDoCache(url) {
    if (!window.caches || !caches.keys) return Promise.resolve();
    var abs = new URL(url, location.href).href;
    return caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (n) {
        return caches.open(n).then(function (c) {
          return Promise.all([c.delete(url), c.delete(abs)]);
        });
      }));
    }).catch(function () {});
  }

  // Baixa + decodifica a música. Se o arquivo vier inválido, apaga a cópia
  // do cache e tenta UMA vez direto da rede (auto-cura). Pedidos repetidos
  // da mesma música (prévia → Jogar) reaproveitam o mesmo download.
  var _rtCarga = null;   // { id, p, ouvintes[] } — download em andamento
  function _rtCarregarAudio(m, aoProgresso) {
    if (_rtBufId === m.id && _rtBuf) return Promise.resolve(_rtBuf);
    if (_rtCarga && _rtCarga.id === m.id) {
      if (aoProgresso) _rtCarga.ouvintes.push(aoProgresso);
      return _rtCarga.p;
    }
    _rtBuf = null; _rtBufId = null;            // solta a anterior (memória do celular)
    var url = _rtUrlAudio(m);
    var carga = { id: m.id, ouvintes: aoProgresso ? [aoProgresso] : [] };
    function prog(x) { for (var i = 0; i < carga.ouvintes.length; i++) { try { carga.ouvintes[i](x); } catch (e) {} } }
    function tentar(n) {
      return _rtBaixarComProgresso(url, prog, n > 0).then(function (ab) {
        if (!ab || ab.byteLength < RT_AUDIO_MIN_BYTES) throw _rtErro('arquivo', 'MP3 com ' + (ab ? ab.byteLength : 0) + ' bytes');
        return _rtDecodificar(ab).catch(function () { throw _rtErro('arquivo', 'MP3 não decodifica'); });
      }).catch(function (err) {
        if (n > 0 || err.tipo !== 'arquivo') throw err;
        return _rtApagarDoCache(url).then(function () { return tentar(1); });
      });
    }
    carga.p = tentar(0).then(function (buf) {
      // Só vira a "música atual" se ninguém pediu outra no meio do caminho.
      if (_rtCarga === carga) { _rtCarga = null; _rtBuf = buf; _rtBufId = m.id; }
      return buf;
    }, function (err) {
      if (_rtCarga === carga) _rtCarga = null;
      throw err;
    });
    _rtCarga = carga;
    return carga.p;
  }
  function _rtCarregarMapa(id, dif) {
    var chave = id + '|' + dif;
    if (_rtMapas[chave]) return Promise.resolve(_rtMapas[chave]);
    var url = RT_MAPAS_PASTA + id + '.' + dif + '.json?v=' + RT_MAPAS_VERSAO;
    return fetch(url).then(function (r) {
      if (!r.ok) throw _rtErro('mapa', 'HTTP ' + r.status);
      // Guarda uma cópia no cache dos jogos pra abrir offline depois.
      try {
        if (window.caches && caches.open) {
          var copia = r.clone();
          caches.open(RT_CACHE_JOGOS).then(function (c) { return c.put(url, copia); }).catch(function () {});
        }
      } catch (e) {}
      return r.json().catch(function () { throw _rtErro('mapa', 'JSON inválido'); });
    }, function (err) { throw err.tipo ? err : _rtErro('rede', 'fetch do mapa falhou'); }).then(function (mapa) {
      if (!mapa || !Array.isArray(mapa.notes) || !mapa.notes.length) throw _rtErro('mapa', 'beatmap inválido');
      _rtMapas[chave] = mapa;
      return mapa;
    });
  }

  /* ══════════════════════════════════════════════════════════════
     DOM — tudo é montado aqui dentro de #ritmo-root (index.html só
     tem o contêiner e o "Voltar aos jogos").
  ══════════════════════════════════════════════════════════════ */
  function _rtMontar() {
    _rtRoot = document.getElementById('ritmo-root');
    if (!_rtRoot) return false;
    if (_rtRoot.getAttribute('data-montado')) return true;
    _rtRoot.setAttribute('data-montado', '1');
    _rtRoot.innerHTML =
      // ── Seleção ──
      '<div class="rt-sel" id="rt-sel">' +
        '<div class="rt-sel-topo">' +
          '<div class="rt-sel-titulo">🎵 Ritmo da Coruja</div>' +
          '<div class="rt-sel-sub">Toque nas 4 colunas quando as notas chegarem na linha.</div>' +
          '<button type="button" class="rt-aviso-som" id="rt-aviso-som" style="display:none;">🔇 O som dos jogos está desligado — toque para ligar</button>' +
          '<div class="rt-erro" id="rt-erro" role="alert" style="display:none;"></div>' +
        '</div>' +
        '<div class="rt-lista" id="rt-lista"></div>' +
        '<div class="rt-painel">' +
          '<div class="rt-difs" role="radiogroup" aria-label="Dificuldade">' +
            '<button type="button" class="rt-dif" data-dif="normal" role="radio"><span class="rt-dif-nome">Normal</span><span class="rt-dif-info" id="rt-dif-normal"></span></button>' +
            '<button type="button" class="rt-dif rt-dif-hard" data-dif="hard" role="radio"><span class="rt-dif-nome">Hard</span><span class="rt-dif-info" id="rt-dif-hard"></span></button>' +
          '</div>' +
          '<div class="rt-ajustes">' +
            '<div class="rt-ajuste"><span class="rt-ajuste-rot">Velocidade</span>' +
              '<button type="button" class="rt-step" data-aj="vel" data-d="-1" aria-label="Diminuir velocidade">−</button>' +
              '<span class="rt-ajuste-val" id="rt-vel"></span>' +
              '<button type="button" class="rt-step" data-aj="vel" data-d="1" aria-label="Aumentar velocidade">+</button></div>' +
            '<div class="rt-ajuste"><span class="rt-ajuste-rot">Atraso do áudio <button type="button" class="rt-ajuda" id="rt-ajuda" aria-expanded="false" aria-controls="rt-ajuda-txt" aria-label="O que é o atraso do áudio?">?</button></span>' +
              '<button type="button" class="rt-step" data-aj="sync" data-d="-10" aria-label="Diminuir atraso do áudio">−</button>' +
              '<span class="rt-ajuste-val" id="rt-sync"></span>' +
              '<button type="button" class="rt-step" data-aj="sync" data-d="10" aria-label="Aumentar atraso do áudio">+</button></div>' +
          '</div>' +
          '<div class="rt-ajuda-txt" id="rt-ajuda-txt" style="display:none;">' +
            'Compensa a demora do som chegar no seu ouvido. Se você toca no tempo da música e aparece <b>“tarde”</b>, aumente (+). ' +
            'Se aparece <b>“cedo”</b>, diminua (−). Fone Bluetooth costuma precisar de +100 a +200 ms. Deixe em 0 ms se estiver tudo certo.' +
          '</div>' +
          '<button type="button" class="rt-jogar" id="rt-jogar">Jogar</button>' +
        '</div>' +
      '</div>' +
      // ── Partida ──
      '<div class="rt-jogo" id="rt-jogo" style="display:none;">' +
        '<canvas class="rt-canvas" id="rt-canvas"></canvas>' +
        '<div class="rt-progresso"><div class="rt-progresso-barra" id="rt-prog"></div></div>' +
        '<div class="rt-hud">' +
          '<div class="rt-hud-score" id="rt-score">0</div>' +
          '<div class="rt-hud-acc" id="rt-acc">100,00%</div>' +
        '</div>' +
        '<div class="rt-aviso" id="rt-aviso" style="display:none;"></div>' +
      '</div>' +
      // ── Resultado ──
      '<div class="rt-res" id="rt-res" style="display:none;">' +
        '<div class="rt-res-musica" id="rt-res-musica"></div>' +
        '<div class="rt-res-rank" id="rt-res-rank">A</div>' +
        '<div class="rt-res-recorde" id="rt-res-recorde" style="display:none;">🏆 Novo recorde!</div>' +
        '<div class="rt-res-score" id="rt-res-score">0</div>' +
        '<div class="rt-res-grade">' +
          '<div><span>Precisão</span><b id="rt-res-acc">0%</b></div>' +
          '<div><span>Combo máx.</span><b id="rt-res-combo">0</b></div>' +
        '</div>' +
        '<div class="rt-res-cont" id="rt-res-cont"></div>' +
        '<div class="rt-res-moedas" id="rt-res-moedas" style="display:none;"></div>' +
        '<div class="rt-res-dica" id="rt-res-dica" style="display:none;"></div>' +
        '<button type="button" class="rt-jogar" id="rt-res-denovo">Jogar de novo</button>' +
        '<button type="button" class="rt-link" id="rt-res-voltar">Escolher outra música</button>' +
      '</div>';

    var q = function (id) { return document.getElementById(id); };
    _rtEls = {
      sel: q('rt-sel'), lista: q('rt-lista'), jogo: q('rt-jogo'), res: q('rt-res'),
      difN: q('rt-dif-normal'), difH: q('rt-dif-hard'), vel: q('rt-vel'), sync: q('rt-sync'),
      avisoSom: q('rt-aviso-som'), score: q('rt-score'), acc: q('rt-acc'), prog: q('rt-prog'),
      aviso: q('rt-aviso'), erro: q('rt-erro')
    };
    _rtCanvas = q('rt-canvas');
    _rtG = _rtCanvas.getContext('2d');

    // Lista de músicas (clique escolhe; duplo toque/“Jogar” começa).
    _rtEls.lista.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-musica]');
      if (!b) return;
      var id = b.getAttribute('data-musica');
      _rtMostrarErro('');
      if (id === _rtSelId && (_rtPrev.id === id || _rtPrev.carregando === id)) { _rtPreviaParar(); return; }
      _rtSelId = id;
      _rtRenderSelecao();
      _rtPreviaTocar(_rtMusicaPorId(id));
    });
    // App foi pro segundo plano: a prévia não continua tocando escondida.
    document.addEventListener('visibilitychange', function () { if (document.hidden) _rtPreviaParar(); });
    _rtRoot.querySelector('.rt-difs').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-dif]');
      if (!b) return;
      _rtCfg.dif = b.getAttribute('data-dif');
      _rtCfgSalvar();
      _rtRenderSelecao();
    });
    _rtRoot.querySelector('.rt-ajustes').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-aj]');
      if (!b) return;
      var d = Number(b.getAttribute('data-d'));
      if (b.getAttribute('data-aj') === 'vel') _rtCfg.velocidade = Math.max(1, Math.min(10, _rtCfg.velocidade + d));
      else _rtCfg.ajuste = Math.max(-200, Math.min(200, _rtCfg.ajuste + d));
      _rtCfgSalvar();
      _rtRenderAjustes();
    });
    q('rt-ajuda').addEventListener('click', function (e) {
      e.stopPropagation();
      var t = q('rt-ajuda-txt'), abrir = t.style.display === 'none';
      t.style.display = abrir ? '' : 'none';
      this.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    });
    _rtEls.avisoSom.addEventListener('click', function () {
      if (typeof window._alternarSomJogos === 'function') window._alternarSomJogos();
      _rtRenderAvisoSom();
    });
    q('rt-jogar').addEventListener('click', function () { _rtComecar(_rtSelId, _rtCfg.dif); });
    q('rt-res-denovo').addEventListener('click', function () { if (_rtMusica) _rtComecar(_rtMusica.id, _rtDif); });
    q('rt-res-voltar').addEventListener('click', _rtMostrarSelecao);

    // Toque nas pistas (multitoque: cada dedo é um pointerId).
    _rtCanvas.addEventListener('pointerdown', _rtPointerDown, { passive: false });
    _rtCanvas.addEventListener('pointerup', _rtPointerUp);
    _rtCanvas.addEventListener('pointercancel', _rtPointerUp);
    _rtCanvas.addEventListener('lostpointercapture', _rtPointerUp);
    _rtCanvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', _rtKeyDown);
    document.addEventListener('keyup', _rtKeyUp);
    window.addEventListener('resize', _rtRedimensionar);
    window.addEventListener('orientationchange', _rtRedimensionar);
    return true;
  }

  function _rtMostrar(qual) {
    _rtEls.sel.style.display = qual === 'sel' ? '' : 'none';
    _rtEls.jogo.style.display = qual === 'jogo' ? '' : 'none';
    _rtEls.res.style.display = qual === 'res' ? '' : 'none';
  }

  /* ── Tela de seleção ─────────────────────────────────────────── */
  var RT_ORDEM_RANK = { SS: 6, S: 5, A: 4, B: 3, C: 2, D: 1 };
  function _rtRenderSelecao() {
    var rec = _rtRecLer();
    var html = '';
    for (var i = 0; i < RT_CATALOGO.length; i++) {
      var m = RT_CATALOGO[i];
      var rn = rec[m.id + '|normal'], rh = rec[m.id + '|hard'];
      var sel = m.id === _rtSelId;
      html += '<button type="button" class="rt-musica' + (sel ? ' rt-musica-sel' : '') + '" data-musica="' + _rtEsc(m.id) + '" data-titulo="' + _rtEsc(m.titulo + (m.sub ? ' (' + m.sub + ')' : '')) + '" aria-pressed="' + sel + '">' +
        '<span class="rt-musica-ico">' + (sel ? '▶' : '♪') + '</span>' +
        '<span class="rt-musica-txt">' +
          '<span class="rt-musica-tit">' + _rtEsc(m.titulo) + '</span>' +
          '<span class="rt-musica-meta">' + _rtEsc(m.sub) + ' · ' + m.bpm + ' BPM · ' + _rtMMSS(m.duracao) + '</span>' +
        '</span>' +
        // Melhor rank em cada dificuldade: rótulo pequeno em cima, rank embaixo
        // ("—" enquanto não jogou).
        '<span class="rt-musica-ranks">' +
          _rtRankChip('Normal', 'rt-rk-n', rn) +
          _rtRankChip('Hard', 'rt-rk-h', rh) +
        '</span>' +
      '</button>';
    }
    _rtEls.lista.innerHTML = html;
    _rtPreviaIcones();
    var m2 = _rtMusicaPorId(_rtSelId) || RT_CATALOGO[0];
    _rtSelId = m2.id;
    _rtEls.difN.textContent = 'Nível ' + m2.dif.normal.nivel + ' · ' + m2.dif.normal.notas + ' notas';
    _rtEls.difH.textContent = 'Nível ' + m2.dif.hard.nivel + ' · ' + m2.dif.hard.notas + ' notas';
    var difs = _rtRoot.querySelectorAll('.rt-dif');
    for (var j = 0; j < difs.length; j++) {
      var ativo = difs[j].getAttribute('data-dif') === _rtCfg.dif;
      difs[j].classList.toggle('rt-dif-ativa', ativo);
      difs[j].setAttribute('aria-checked', ativo ? 'true' : 'false');
    }
    _rtRenderAjustes();
    _rtRenderAvisoSom();
  }
  function _rtRankChip(rotulo, cls, rec) {
    return '<span class="rt-rk ' + cls + (rec ? '' : ' rt-rk-vazio') + '" title="' + (rec ? 'Melhor no ' + rotulo + ': ' + rec.rank + ' (' + _rtFmtAcc(rec.acc || 0) + ')' : 'Ainda não jogou no ' + rotulo) + '">' +
      '<span class="rt-rk-dif">' + rotulo + '</span>' +
      '<span class="rt-rk-val' + (rec ? ' rt-r-' + rec.rank : '') + '">' + (rec ? rec.rank : '—') + '</span>' +
    '</span>';
  }
  function _rtRenderAjustes() {
    _rtEls.vel.textContent = _rtCfg.velocidade;
    _rtEls.sync.textContent = (_rtCfg.ajuste > 0 ? '+' : '') + _rtCfg.ajuste + ' ms';
    _rtEls.sync.classList.toggle('rt-ajuste-val-mudado', _rtCfg.ajuste !== 0);
  }
  function _rtRenderAvisoSom() {
    _rtEls.avisoSom.style.display = _rtSomAtivo() ? 'none' : '';
  }
  function _rtMostrarSelecao() {
    _rtPararPartida();
    _rtEstado = 'selecao';
    _rtMostrar('sel');
    _rtRenderSelecao();
    var sel = _rtEls.lista.querySelector('.rt-musica-sel');
    if (sel && sel.scrollIntoView) { try { sel.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  }

  /* ══════════════════════════════════════════════════════════════
     PARTIDA
  ══════════════════════════════════════════════════════════════ */
  function _rtComecar(id, dif) {
    var m = _rtMusicaPorId(id);
    if (!m) return;
    _rtPreviaParar();
    _rtMostrarErro('');
    // Áudio destravado AQUI, dentro do toque (antes de qualquer await).
    if (!_rtAudioGarantir()) { _rtAvisoErro('Seu navegador não toca áudio do jeito que o jogo precisa.'); return; }
    _rtPararPartida();
    _rtMusica = m; _rtDif = dif;
    _rtCfg.ultima = m.id; _rtCfgSalvar();
    _rtEstado = 'carregando';
    _rtMostrar('jogo');
    _rtRedimensionar();
    _rtZerarPlacar();
    _rtNotas = []; _rtDesenhar(0);
    _rtAviso('Carregando ' + m.titulo + '…');
    var token = ++_rtTokenCarga;
    Promise.all([
      _rtCarregarAudio(m, function (p) {
        if (token === _rtTokenCarga) _rtAviso('Carregando ' + m.titulo + '… ' + Math.round(p * 100) + '%');
      }),
      _rtCarregarMapa(m.id, dif)
    ]).then(function (r) {
      if (token !== _rtTokenCarga || _rtEstado !== 'carregando') return;
      _rtBuf = r[0]; _rtBufId = m.id;
      _rtIniciar(r[1]);
    }).catch(function (err) {
      if (token !== _rtTokenCarga) return;
      try { console.warn('[ritmo] falha ao carregar ' + m.id + ':', err && err.message); } catch (e) {}
      _rtAvisoErro(_rtMsgDoErro(err));
    });
  }

  var RT_MSG_ERRO = {
    rede: 'Sem conexão pra baixar a música. Confira a internet e tente de novo.',
    arquivo: 'O arquivo desta música está com defeito no servidor. Escolha outra por enquanto.',
    mapa: 'Não deu pra carregar as notas desta música. Tente de novo em instantes.'
  };
  function _rtMsgDoErro(err) { return RT_MSG_ERRO[err && err.tipo] || RT_MSG_ERRO.rede; }
  // Mostra o erro na própria tela de seleção (não some, a pessoa vê o motivo).
  function _rtMostrarErro(msg) {
    if (!_rtEls.erro) return;
    _rtEls.erro.textContent = msg || '';
    _rtEls.erro.style.display = msg ? '' : 'none';
  }
  function _rtAvisoErro(msg) {
    _rtEstado = 'selecao';
    _rtMostrar('sel');
    _rtRenderSelecao();
    _rtMostrarErro(msg);
    try { console.warn('[ritmo] ' + msg); } catch (e) {}
  }

  function _rtZerarPlacar() {
    _rtCont = { perfeito: 0, otimo: 0, bom: 0, erro: 0 };
    _rtSoma = 0; _rtJulgadas = 0; _rtCombo = 0; _rtComboMax = 0;
    _rtDesvioSoma = 0; _rtDesvioN = 0;
    _rtJulgVis = null;
    _rtApertada = [0, 0, 0, 0]; _rtBrilho = [0, 0, 0, 0]; _rtPonteiros = {};
    _rtEls.score.textContent = '0';
    _rtEls.acc.textContent = '100,00%';
    _rtEls.prog.style.width = '0%';
  }

  function _rtIniciar(mapa) {
    _rtMapa = mapa;
    var off = Number(mapa.offset) || 0;
    _rtNotas = [];
    _rtPorCol = [[], [], [], []];
    for (var i = 0; i < mapa.notes.length; i++) {
      var n = mapa.notes[i];
      var c = Math.round(Number(n.column));
      var t = Number(n.time) + off;
      if (!(c >= 0 && c <= 3) || !isFinite(t)) continue;
      _rtNotas.push({ t: t, c: c, j: null });
    }
    _rtNotas.sort(function (a, b) { return a.t - b.t || a.c - b.c; });
    for (var k = 0; k < _rtNotas.length; k++) _rtPorCol[_rtNotas[k].c].push(_rtNotas[k]);
    _rtPonteiro = [0, 0, 0, 0];
    _rtDesenhoIni = 0;
    var ultima = _rtNotas.length ? _rtNotas[_rtNotas.length - 1].t : 0;
    // Termina 2,5 s depois da última nota (ou no fim do áudio, o que vier
    // primeiro) — músicas com outro longo não prendem a pessoa à toa.
    _rtFim = Math.min(_rtBuf.duration * 1000, ultima + 2500);
    _rtSaindo = false;
    _rtPausado = false; _rtPausaMs = 0; _rtPausaDesde = 0;
    _rtInicioReal = Date.now();
    _rtTocarDe(-RT_LEAD_S * 1000, 0);
    _rtEstado = 'jogando';
    _rtAviso('');
    _rtMenuPartida(true);
    _rtLoopIniciar();
  }

  function _rtPararPartida() {
    _rtTokenCarga++;
    if (_rtRAF) { cancelAnimationFrame(_rtRAF); _rtRAF = 0; }
    _rtPararFonte();
    _rtPausado = false;
    _rtSaindo = false;
    _rtMenuPartida(false);
    if (_rtEstado === 'jogando' || _rtEstado === 'carregando') _rtEstado = 'selecao';
  }

  function _rtLoopIniciar() {
    if (_rtRAF) cancelAnimationFrame(_rtRAF);
    _rtRAF = requestAnimationFrame(_rtLoop);
  }

  function _rtLoop(ts) {
    _rtRAF = 0;
    if (_rtEstado !== 'jogando') return;
    var agora = _rtAgoraMs();
    var dt = _rtUltimoFrame ? Math.min(100, ts - _rtUltimoFrame) : 16;
    _rtUltimoFrame = ts;
    if (!_rtPausado) {
      _rtVerificarPassadas(agora);
      // som ligado/desligado pelo menu de pausa vale na hora
      if (_rtGanho && !_rtSaindo) {
        var alvo = _rtSomAtivo() ? 1 : 0;
        if (_rtGanho.gain.value !== alvo) _rtGanho.gain.setValueAtTime(alvo, _rtCtx.currentTime);
      }
      if (agora >= _rtFim && !_rtSaindo) _rtTerminar();
    }
    for (var i = 0; i < 4; i++) _rtBrilho[i] = Math.max(0, _rtBrilho[i] - dt / 180);
    _rtDesenhar(agora);
    _rtRAF = requestAnimationFrame(_rtLoop);
  }

  // Notas que passaram da janela sem toque viram Erro.
  function _rtVerificarPassadas(agora) {
    for (var c = 0; c < 4; c++) {
      var lista = _rtPorCol[c];
      while (_rtPonteiro[c] < lista.length) {
        var n = lista[_rtPonteiro[c]];
        if (n.j) { _rtPonteiro[c]++; continue; }
        if (agora - n.t > RT_JANELAS.erro) { _rtJulgar(n, 'erro', agora - n.t); _rtPonteiro[c]++; }
        else break;
      }
    }
  }

  // Toque numa coluna: pega a nota mais antiga ainda não julgada dela.
  function _rtTocar(c) {
    if (_rtEstado !== 'jogando' || _rtPausado) return;
    var agora = _rtAgoraMs();
    var lista = _rtPorCol[c];
    while (_rtPonteiro[c] < lista.length && lista[_rtPonteiro[c]].j) _rtPonteiro[c]++;
    var n = lista[_rtPonteiro[c]];
    if (!n) return;
    var dt = agora - n.t;              // < 0 = adiantado, > 0 = atrasado
    if (dt < -RT_JANELAS.erro) return; // cedo demais: toque "no vazio", sem punição
    var a = Math.abs(dt), tipo;
    if (a <= RT_JANELAS.perfeito) tipo = 'perfeito';
    else if (a <= RT_JANELAS.otimo) tipo = 'otimo';
    else if (a <= RT_JANELAS.bom) tipo = 'bom';
    else tipo = 'erro';
    _rtJulgar(n, tipo, dt);
    _rtPonteiro[c]++;
    if (tipo !== 'erro') { _rtBrilho[c] = 1; _rtDesvioSoma += dt; _rtDesvioN++; }
  }

  function _rtJulgar(n, tipo, desvio) {
    n.j = tipo;
    _rtCont[tipo]++;
    _rtJulgadas++;
    _rtSoma += RT_VALOR[tipo];
    if (tipo === 'erro') _rtCombo = 0;
    else { _rtCombo++; if (_rtCombo > _rtComboMax) _rtComboMax = _rtCombo; }
    _rtJulgVis = { tipo: tipo, ate: performance.now() + 420, desvio: desvio };
    _rtEls.score.textContent = _rtFmtNum(_rtScoreAtual());
    _rtEls.acc.textContent = _rtFmtAcc(_rtPrecisao());
  }

  /* ── Pontuação ───────────────────────────────────────────────────
     Estilo osu!mania: teto de 1.000.000. 90% vem da precisão de cada
     nota (Perfeito 100%, Ótimo 70%, Bom 40%, Erro 0) e 10% do combo
     máximo em relação ao total de notas. */
  function _rtScoreAtual() {
    var total = _rtNotas.length || 1;
    return Math.round(900000 * (_rtSoma / total) + 100000 * (_rtComboMax / total));
  }
  function _rtPrecisao() { return _rtJulgadas ? (_rtSoma / _rtJulgadas) * 100 : 100; }
  function _rtFmtAcc(v) { return v.toFixed(2).replace('.', ',') + '%'; }
  function _rtFmtNum(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function _rtRank(acc, cont) {
    if (cont.erro === 0 && cont.bom === 0 && cont.otimo === 0) return 'SS';
    if (acc >= 95) return 'S';
    if (acc >= 90) return 'A';
    if (acc >= 80) return 'B';
    if (acc >= 70) return 'C';
    return 'D';
  }

  /* ── Recompensa 🪙 ──────────────────────────────────────────────
     Base pelo rank × dificuldade (Hard vale 1,5×) × fator de precisão
     (0,5 a 1,0). Rank D só paga com pelo menos 50% de precisão — sem
     isso, deixar a música tocando sozinha renderia moeda. O teto diário
     (500) e o multiplicador de evento ficam a cargo do moedasAdd. */
  var RT_MOEDAS_BASE = { SS: 30, S: 25, A: 20, B: 14, C: 9, D: 4 };
  function _rtMoedas(rank, acc, dif) {
    if (rank === 'D' && acc < 50) return 0;
    var mult = dif === 'hard' ? 1.5 : 1;
    return Math.max(0, Math.round(RT_MOEDAS_BASE[rank] * mult * (0.5 + 0.5 * acc / 100)));
  }

  function _rtTerminar() {
    _rtSaindo = true;
    // fade-out curto em vez de cortar a música no meio da frase
    try {
      var t0 = _rtCtx.currentTime;
      _rtGanho.gain.cancelScheduledValues(t0);
      _rtGanho.gain.setValueAtTime(_rtGanho.gain.value, t0);
      _rtGanho.gain.linearRampToValueAtTime(0, t0 + 1.2);
    } catch (e) {}
    setTimeout(function () {
      if (_rtEstado !== 'jogando') return;
      _rtResultado();
    }, 1200);
  }

  function _rtResultado() {
    if (_rtRAF) { cancelAnimationFrame(_rtRAF); _rtRAF = 0; }
    _rtPararFonte();
    _rtMenuPartida(false);
    _rtEstado = 'resultado';
    // Garante que toda nota foi contada (quem saiu antes do fim já foi tratado).
    for (var i = 0; i < _rtNotas.length; i++) if (!_rtNotas[i].j) _rtJulgar(_rtNotas[i], 'erro', 0);
    var acc = _rtPrecisao();
    var score = _rtScoreAtual();
    var rank = _rtRank(acc, _rtCont);
    var segundos = Math.max(0, Math.round((Date.now() - _rtInicioReal - _rtPausaMs) / 1000));

    // Recorde local por música + dificuldade
    var rec = _rtRecLer(), chave = _rtMusica.id + '|' + _rtDif;
    var antes = rec[chave];
    var novo = !antes || score > (antes.score || 0);
    if (novo) {
      rec[chave] = { score: score, acc: Math.round(acc * 100) / 100, rank: rank, combo: _rtComboMax };
      _rtRecSalvar(rec);
    }

    // Moedas + stats (mesmo padrão dos outros jogos do hub)
    var G = _rtG_();
    var moedas = _rtMoedas(rank, acc, _rtDif);
    if (G) {
      if (moedas > 0 && typeof G.moedasAdd === 'function') G.moedasAdd(moedas, 'ritmo');
      if (typeof G.statsRegistrarPartida === 'function') G.statsRegistrarPartida('ritmo', { segundos: segundos, score: score });
    }

    // Tela
    var q = function (id) { return document.getElementById(id); };
    q('rt-res-musica').textContent = _rtMusica.titulo + (_rtMusica.sub ? ' · ' + _rtMusica.sub : '') + ' — ' + (_rtDif === 'hard' ? 'Hard' : 'Normal');
    var rk = q('rt-res-rank');
    rk.textContent = rank;
    rk.className = 'rt-res-rank rt-r-' + rank;
    q('rt-res-recorde').style.display = (novo && antes) ? '' : 'none';
    q('rt-res-score').textContent = _rtFmtNum(score);
    q('rt-res-acc').textContent = _rtFmtAcc(acc);
    q('rt-res-combo').textContent = _rtComboMax + 'x';
    q('rt-res-cont').innerHTML =
      '<span style="color:' + RT_COR_JULG.perfeito + '">Perfeito <b>' + _rtCont.perfeito + '</b></span>' +
      '<span style="color:' + RT_COR_JULG.otimo + '">Ótimo <b>' + _rtCont.otimo + '</b></span>' +
      '<span style="color:' + RT_COR_JULG.bom + '">Bom <b>' + _rtCont.bom + '</b></span>' +
      '<span style="color:' + RT_COR_JULG.erro + '">Erro <b>' + _rtCont.erro + '</b></span>';
    var me = q('rt-res-moedas');
    if (moedas > 0) { me.textContent = '+' + moedas + ' 🪙'; me.style.display = ''; }
    else { me.textContent = 'Acerte mais da metade das notas pra ganhar 🪙'; me.style.display = ''; }
    me.classList.toggle('rt-res-moedas-zero', moedas <= 0);
    _rtDicaCalibrar();
    _rtMostrar('res');
    if (G && G.som && typeof G.som.fim === 'function') { try { G.som.fim(RT_ORDEM_RANK[rank] >= 5); } catch (e) {} }
    if (RT_ORDEM_RANK[rank] >= 5 && G && G.efeitos) G.efeitos.confete('rt-res', 90);
  }

  // Se os toques acertados vieram em média bem atrasados/adiantados, sugere
  // um "Atraso do áudio" novo (com botão pra aplicar na hora).
  function _rtDicaCalibrar() {
    var el = document.getElementById('rt-res-dica');
    if (!el) return;
    var media = _rtDesvioN >= 20 ? _rtDesvioSoma / _rtDesvioN : 0;
    if (Math.abs(media) < 25) { el.style.display = 'none'; return; }
    var novo = Math.max(-200, Math.min(200, Math.round((_rtCfg.ajuste + media) / 10) * 10));
    el.innerHTML = 'Seus toques vieram em média <b>' + Math.round(Math.abs(media)) + ' ms ' + (media > 0 ? 'atrasados' : 'adiantados') + '</b>. ' +
      'Quer ajustar o atraso do áudio para <b>' + (novo > 0 ? '+' : '') + novo + ' ms</b>? ' +
      '<button type="button" class="rt-res-dica-btn">Ajustar</button>';
    el.style.display = '';
    el.querySelector('button').onclick = function () {
      _rtCfg.ajuste = novo; _rtCfgSalvar(); _rtRenderAjustes();
      el.innerHTML = '✔ Atraso do áudio ajustado para ' + (novo > 0 ? '+' : '') + novo + ' ms.';
    };
  }

  /* ── Menu de pausa unificado (hub.js → AngatubaGames.menu) ───────
     Pausar para a música e guarda a posição. Continuar recomeça o áudio
     do mesmo ponto, com RT_RETOMAR_S de respiro (as notas que faltam
     voltam a descer antes, como numa contagem). */
  function _rtMenu() { var G = _rtG_(); return (G && G.menu) || window.AngatubaJogoMenu || null; }
  function _rtMenuPartida(ativa) { var M = _rtMenu(); if (M) M.partida('jogo-ritmo', ativa); }
  function _rtRegistrarMenu() {
    var M = _rtMenu();
    if (!M) return;
    M.registrar('jogo-ritmo', {
      podePausar: function () { return _rtEstado === 'jogando' && !_rtSaindo; },
      pausar: _rtPausar,
      continuar: _rtContinuar,
      descricao: function () { return _rtMusica ? _rtMusica.titulo + ' · ' + (_rtDif === 'hard' ? 'Hard' : 'Normal') : ''; },
      extra: { rotulo: 'Escolher outra música', acao: _rtMostrarSelecao }
    });
    // O hub desenha o "extra" como link de texto (.jm-link). Aqui ele vira
    // botão igual aos outros (.jm-opcao) e sobe pra antes de "Voltar aos
    // jogos". O hub só troca o texto dele a cada abertura — a classe fica.
    var tela = document.getElementById('jogo-ritmo');
    var bx = tela && tela.querySelector('.jm-overlay [data-jm="extra"]');
    var sair = tela && tela.querySelector('.jm-overlay [data-jm="sair"]');
    if (bx) {
      bx.classList.remove('jm-link');
      bx.classList.add('jm-opcao', 'rt-jm-musica');
      if (sair && sair.parentNode === bx.parentNode) sair.parentNode.insertBefore(bx, sair);
    }
  }
  function _rtPausar() {
    if (_rtEstado !== 'jogando' || _rtPausado) return;
    _rtPosPausa = _rtAgoraMs();
    _rtPausado = true;
    _rtPausaDesde = Date.now();
    _rtPararFonte();
    _rtAudioSuspender();
    _rtApertada = [0, 0, 0, 0]; _rtPonteiros = {};
  }
  function _rtContinuar() {
    if (!_rtPausado || _rtEstado !== 'jogando') return;
    if (!_rtAudioGarantir()) return;   // chamado no toque em "Continuar": destrava de novo
    if (_rtPausaDesde) { _rtPausaMs += Date.now() - _rtPausaDesde; _rtPausaDesde = 0; }
    _rtPausado = false;
    // Volta a tocar RT_RETOMAR_S antes do ponto da pausa: a pessoa ouve de
    // novo o trecho final e as notas que faltam já chegam no tempo certo.
    // (posição do áudio = tempo da música + latência + ajuste — o inverso
    // de _rtAgoraMs.)
    var lat = (_rtCtx.outputLatency || _rtCtx.baseLatency || 0) * 1000;
    _rtTocarDe(_rtPosPausa + lat + _rtCfg.ajuste - (RT_RETOMAR_S * 1000), 0);
    _rtUltimoFrame = 0;
    if (!_rtRAF) _rtLoopIniciar();
  }

  /* ══════════════════════════════════════════════════════════════
     ENTRADA (toque e teclado)
  ══════════════════════════════════════════════════════════════ */
  function _rtColunaDoX(clientX) {
    var r = _rtCanvas.getBoundingClientRect();
    var L = _rtLayout();
    var x = (clientX - r.left) - L.x0;
    // fora das pistas (telas largas) conta como a pista mais perto
    return Math.max(0, Math.min(3, Math.floor(x / L.lw)));
  }
  function _rtPointerDown(e) {
    if (_rtEstado !== 'jogando') return;
    e.preventDefault();
    var c = _rtColunaDoX(e.clientX);
    _rtPonteiros[e.pointerId] = c;
    _rtApertada[c]++;
    try { _rtCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    _rtTocar(c);
  }
  function _rtPointerUp(e) {
    var c = _rtPonteiros[e.pointerId];
    if (c === undefined) return;
    delete _rtPonteiros[e.pointerId];
    _rtApertada[c] = Math.max(0, _rtApertada[c] - 1);
  }
  var _rtTeclasDown = {};
  function _rtKeyDown(e) {
    if (_rtEstado !== 'jogando' || e.repeat) return;
    var c = RT_TECLAS[(e.key || '').toLowerCase()];
    if (c === undefined) return;
    var tela = document.getElementById('jogo-ritmo');
    if (!tela || tela.style.display === 'none') return;
    e.preventDefault();
    if (_rtTeclasDown[c]) return;
    _rtTeclasDown[c] = true;
    _rtApertada[c]++;
    _rtTocar(c);
  }
  function _rtKeyUp(e) {
    var c = RT_TECLAS[(e.key || '').toLowerCase()];
    if (c === undefined || !_rtTeclasDown[c]) return;
    _rtTeclasDown[c] = false;
    _rtApertada[c] = Math.max(0, _rtApertada[c] - 1);
  }

  /* ══════════════════════════════════════════════════════════════
     DESENHO (canvas)
  ══════════════════════════════════════════════════════════════ */
  function _rtRedimensionar() {
    if (!_rtCanvas || !_rtEls.jogo || _rtEls.jogo.style.display === 'none') return;
    var r = _rtCanvas.getBoundingClientRect();
    _rtDpr = Math.min(2, window.devicePixelRatio || 1);
    _rtW = Math.max(1, Math.round(r.width));
    _rtH = Math.max(1, Math.round(r.height));
    _rtCanvas.width = Math.round(_rtW * _rtDpr);
    _rtCanvas.height = Math.round(_rtH * _rtDpr);
  }
  // Pistas centralizadas: no celular ocupam a largura toda; em tela
  // larga ficam com no máximo 110 px cada.
  function _rtLayout() {
    var lw = Math.min(_rtW / 4, 110);
    var x0 = (_rtW - lw * 4) / 2;
    var hitY = _rtH - Math.max(96, Math.min(150, _rtH * 0.15));
    return { lw: lw, x0: x0, hitY: hitY };
  }
  // Raio das notas/receptores: cabe na pista com folga, nunca gigante.
  function _rtRaioNota(lw) { return Math.max(14, Math.min(lw * 0.36, 40)); }
  // Nota redonda ("gema"): borda na cor da pista, anel escuro e miolo
  // claro, com um brilho no alto — lê bem em qualquer velocidade.
  function _rtDesenharNota(g, x, y, r, cor) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = cor; g.fill();
    g.beginPath(); g.arc(x, y, r * 0.66, 0, Math.PI * 2);
    g.fillStyle = 'rgba(12,8,28,0.55)'; g.fill();
    g.beginPath(); g.arc(x, y, r * 0.42, 0, Math.PI * 2);
    g.fillStyle = cor; g.fill();
    g.beginPath(); g.arc(x, y, r * 0.42, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill();
    g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
  }

  function _rtDesenhar(agora) {
    var g = _rtG;
    if (!g || !_rtW) return;
    g.setTransform(_rtDpr, 0, 0, _rtDpr, 0, 0);
    var L = _rtLayout(), lw = L.lw, x0 = L.x0, hitY = L.hitY;
    var queda = _rtTempoQueda();
    var px = hitY / queda;          // pixels por ms
    g.clearRect(0, 0, _rtW, _rtH);

    // Fundo das pistas
    for (var c = 0; c < 4; c++) {
      var x = x0 + c * lw;
      g.fillStyle = c % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.02)';
      g.fillRect(x, 0, lw, _rtH);
      if (_rtApertada[c] > 0) {
        var grad = g.createLinearGradient(0, hitY, 0, hitY - _rtH * 0.45);
        grad.addColorStop(0, 'rgba(167,139,250,0.22)');
        grad.addColorStop(1, 'rgba(167,139,250,0)');
        g.fillStyle = grad;
        g.fillRect(x, 0, lw, hitY);
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 1;
    for (var s = 0; s <= 4; s++) {
      g.beginPath(); g.moveTo(x0 + s * lw + 0.5, 0); g.lineTo(x0 + s * lw + 0.5, _rtH); g.stroke();
    }

    // Linha de acerto + receptores (anéis redondos, estilo Guitar Hero)
    var raio = _rtRaioNota(lw);
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, hitY); g.lineTo(x0 + lw * 4, hitY); g.stroke();
    for (var r = 0; r < 4; r++) {
      var cxr = x0 + r * lw + lw / 2, apertada = _rtApertada[r] > 0;
      var rr = raio * (apertada ? 0.92 : 1);
      g.beginPath(); g.arc(cxr, hitY, rr, 0, Math.PI * 2);
      g.fillStyle = apertada ? 'rgba(255,255,255,0.18)' : 'rgba(9,14,22,0.75)';
      g.fill();
      g.lineWidth = Math.max(3, raio * 0.16);
      g.strokeStyle = RT_COR_COL[r];
      g.globalAlpha = apertada ? 1 : 0.6;
      g.stroke();
      g.globalAlpha = 1;
      if (_rtBrilho[r] > 0) {
        // anel que se expande no acerto + faísca subindo pela pista
        var b = _rtBrilho[r];
        g.globalAlpha = b;
        g.lineWidth = 3;
        g.strokeStyle = RT_COR_COL[r];
        g.beginPath(); g.arc(cxr, hitY, raio * (1 + (1 - b) * 0.7), 0, Math.PI * 2); g.stroke();
        var fg = g.createLinearGradient(0, hitY, 0, hitY - 130);
        fg.addColorStop(0, RT_COR_COL[r]);
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = fg;
        g.globalAlpha = b * 0.35;
        g.fillRect(x0 + r * lw + lw * 0.18, hitY - 130, lw * 0.64, 130);
        g.globalAlpha = 1;
      }
    }

    // Notas visíveis: do ponteiro de desenho até sair pelo topo
    while (_rtDesenhoIni < _rtNotas.length) {
      var n0 = _rtNotas[_rtDesenhoIni];
      if (n0.j && (agora - n0.t) > 0) _rtDesenhoIni++;
      else if (agora - n0.t > RT_JANELAS.erro + 400) _rtDesenhoIni++;
      else break;
    }
    for (var i = _rtDesenhoIni; i < _rtNotas.length; i++) {
      var n = _rtNotas[i];
      var dtn = n.t - agora;
      if (dtn > queda * 1.05) break;
      if (n.j && n.j !== 'erro') continue;
      var y = hitY - dtn * px;
      if (y < -raio || y > _rtH + raio) continue;
      g.globalAlpha = n.j === 'erro' ? 0.25 : 1;
      _rtDesenharNota(g, x0 + n.c * lw + lw / 2, y, raio, RT_COR_COL[n.c]);
      g.globalAlpha = 1;
    }

    // Julgamento + combo (centro)
    var cx = _rtW / 2, cy = hitY - Math.min(_rtH * 0.33, 230);
    var pn = performance.now();
    if (_rtCombo >= 3) {
      g.font = '800 ' + Math.round(Math.min(46, _rtW * 0.11)) + 'px Syne, system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.fillText(String(_rtCombo), cx, cy);
      g.font = '700 11px system-ui, sans-serif';
      g.fillStyle = 'rgba(199,209,224,0.7)';
      g.fillText('COMBO', cx, cy + Math.min(30, _rtW * 0.07));
    }
    if (_rtJulgVis && pn < _rtJulgVis.ate) {
      var resto = (_rtJulgVis.ate - pn) / 420;          // 1 → 0
      var esc = 1 + (1 - Math.min(1, (1 - resto) * 5)) * 0.25;
      g.save();
      g.translate(cx, cy + 52);
      g.scale(esc, esc);
      g.globalAlpha = Math.min(1, resto * 2);
      g.font = '900 ' + Math.round(Math.min(26, _rtW * 0.065)) + 'px Syne, system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = RT_COR_JULG[_rtJulgVis.tipo];
      g.fillText(RT_ROTULO[_rtJulgVis.tipo], 0, 0);
      if (_rtJulgVis.tipo !== 'perfeito' && _rtJulgVis.tipo !== 'erro' && _rtJulgVis.desvio) {
        g.font = '700 11px system-ui, sans-serif';
        g.fillStyle = 'rgba(199,209,224,0.85)';
        g.fillText(_rtJulgVis.desvio < 0 ? 'cedo' : 'tarde', 0, 20);
      }
      g.restore();
    }

    // "Prepare-se" antes da primeira nota
    if (_rtEstado === 'jogando' && agora < 0) {
      g.font = '800 18px Syne, system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,255,255,' + Math.min(1, -agora / 600).toFixed(2) + ')';
      g.fillText(_rtPausado ? '' : 'Prepare-se!', cx, _rtH * 0.3);
    }

    // Barra de progresso
    if (_rtFim > 0 && _rtEls.prog) _rtEls.prog.style.width = Math.max(0, Math.min(100, agora / _rtFim * 100)).toFixed(1) + '%';
  }

  function _rtAviso(txt) {
    if (!_rtEls.aviso) return;
    _rtEls.aviso.textContent = txt || '';
    _rtEls.aviso.style.display = txt ? '' : 'none';
  }

  /* ══════════════════════════════════════════════════════════════
     API PÚBLICA (chamada pelo hub)
  ══════════════════════════════════════════════════════════════ */
  // Ao abrir a tela do jogo: monta (1ª vez) e mostra a seleção.
  function _rtPreparar() {
    if (!_rtMontar()) return;
    _rtRegistrarMenu();
    _rtMostrarSelecao();
  }
  // Ao sair pro menu de jogos / fechar o hub: para tudo e libera o áudio.
  function _rtParar() {
    _rtPreviaParar();
    _rtCarga = null;
    _rtPararPartida();
    _rtAudioSuspender();
    // Solta a música decodificada (~50–90 MB de PCM): fora do jogo ela só
    // ocuparia memória do celular. Reabrir baixa do cache do SW, rápido.
    _rtBuf = null; _rtBufId = null;
    _rtEstado = 'selecao';
  }

  window.RitmoGame = { preparar: _rtPreparar, parar: _rtParar, suspenderAudio: _rtAudioSuspender };
})();
