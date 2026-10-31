/* ═══════════════════════════════════════════════════════════════
   SOM DOS JOGOS — síntese via Web Audio API (0 download, offline)
   Módulo compartilhado por todos os jogos. Não usa arquivos de áudio:
   sintetiza cada efeito na hora, no aparelho. Vantagens num PWA
   offline-first: nada pra baixar, nada pra cachear/versionar no SW,
   e toca desde o primeiro segundo mesmo sem rede.

   Exposto ao app pela ponte (window.AngatubaGames.som). Cada jogo
   chama som.acerto(), som.erro(), som.combo(n), som.fim(true/false)
   etc. — sem conhecer nada de Web Audio.

   iOS/Safari: um AudioContext só "acorda" dentro de um gesto do
   usuário (toque/clique). Por isso o áudio fica dormindo até o
   primeiro toque em qualquer lugar; destravamos ali (som._destravar).

   Preferência de mudo persiste em localStorage 'angatuba_som'
   ('1' = ligado, '0' = mudo). Default: ligado.

   SONS GRAVADOS (out/2026, ElevenLabs — claude/sons-catalogo-elevenlabs.md):
   além da síntese, toca arquivos mp3 pelo mesmo volume/mudo. tocar(nome)
   usa o arquivo se ele já estiver decodificado; senão começa a baixar e
   toca a síntese de reserva NA HORA (nada fica mudo nem atrasa). Os jogos
   chamam precarregar([...]) ao abrir pra o 1º som já sair gravado.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PREF_KEY = 'angatuba_som';
  var _ctx = null;          // AudioContext (criado no 1º gesto)
  var _master = null;       // GainNode master (volume geral + mute)
  var _ligado = true;       // preferência do usuário
  var _destravado = false;  // já rodou dentro de um gesto?

  // ── Preferência ──────────────────────────────────────────
  try {
    var pref = localStorage.getItem(PREF_KEY);
    if (pref === '0') _ligado = false;
  } catch (e) {}

  function _salvarPref() {
    try { localStorage.setItem(PREF_KEY, _ligado ? '1' : '0'); } catch (e) {}
  }

  // ── Criação/estado do contexto ───────────────────────────
  function _garantirCtx() {
    if (_ctx) return _ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null; // navegador sem Web Audio: silêncio, sem quebrar
    try {
      _ctx = new AC();
      _master = _ctx.createGain();
      _master.gain.value = _ligado ? 0.32 : 0; // teto de volume conservador (0 = mudo, cala os loops)
      _master.connect(_ctx.destination);
    } catch (e) {
      _ctx = null; _master = null;
    }
    return _ctx;
  }

  // Chamado no 1º gesto do usuário (toque em qualquer jogo). Cria e
  // "resume" o contexto — necessário no iOS e no Chrome com autoplay
  // policy. Idempotente.
  function _destravar() {
    var ctx = _garantirCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) {
      try { ctx.resume(); } catch (e) {}
    }
    _destravado = true;
  }

  // ── Primitiva: uma "voz" (oscilador + envelope ADSR simples) ──
  // freqIni→freqFim permite bends (subida/descida). tipo: 'sine',
  // 'square', 'triangle', 'sawtooth'. Envelope evita clicks (ataque
  // e release curtos).
  function _voz(opts) {
    if (!_ligado || !_destravado) return;
    var ctx = _garantirCtx();
    if (!ctx || !_master) return;
    var agora = ctx.currentTime;
    var t0 = agora + (opts.atraso || 0);

    var tipo = opts.tipo || 'sine';
    var f0 = opts.freq || 440;
    var f1 = (opts.freqFim != null) ? opts.freqFim : f0;
    var dur = opts.dur || 0.12;
    var vol = (opts.vol != null) ? opts.vol : 0.6;
    var ataque = (opts.ataque != null) ? opts.ataque : 0.006;
    var release = (opts.release != null) ? opts.release : Math.min(0.12, dur * 0.6);

    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) {
      // bend exponencial soa mais natural que linear (frequência é log)
      try { osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur); }
      catch (e) { osc.frequency.linearRampToValueAtTime(f1, t0 + dur); }
    }

    // Envelope: 0 → vol (ataque) → sustain → 0 (release)
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + ataque);
    g.gain.setValueAtTime(Math.max(0.0002, vol), t0 + Math.max(ataque, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g); g.connect(_master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    // Limpeza: desconecta ao terminar (evita acúmulo de nós)
    osc.onended = function () { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
  }

  // Ruído curto (para "shake"/erro mais encorpado). Buffer branco com
  // envelope. Usado com parcimônia.
  function _ruido(dur, vol, freqCorte) {
    if (!_ligado || !_destravado) return;
    var ctx = _garantirCtx();
    if (!ctx || !_master) return;
    var agora = ctx.currentTime;
    var n = Math.floor((ctx.sampleRate || 44100) * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate || 44100);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, vol || 0.2), agora);
    g.gain.exponentialRampToValueAtTime(0.0001, agora + dur);
    var chain = g;
    if (freqCorte) {
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = freqCorte;
      src.connect(lp); lp.connect(g);
    } else {
      src.connect(g);
    }
    chain.connect(_master);
    src.start(agora);
    src.stop(agora + dur + 0.02);
    src.onended = function () { try { src.disconnect(); g.disconnect(); } catch (e) {} };
  }

  // ── Sons gravados ────────────────────────────────────────
  // nome → arquivo em /Jogos/assets/<caminho>.mp3. Mudou o conteúdo de um
  // arquivo? Nome novo ou ?v= (CACHE_JOGOS é cache-first por URL).
  var _ARQ = {
    'hub-entrar': 'hub/sfx/hub-entrar', 'card-abrir': 'hub/sfx/card-abrir', 'moeda': 'hub/sfx/moeda',
    'comprar': 'hub/sfx/comprar', 'equipar': 'hub/sfx/equipar', 'bau-abrir': 'hub/sfx/bau-abrir',
    'insignia': 'hub/sfx/insignia', 'recorde': 'hub/sfx/recorde', 'contagem-tick': 'hub/sfx/contagem-tick',
    'contagem-ja': 'hub/sfx/contagem-ja', 'fim-de-jogo': 'hub/sfx/fim-de-jogo', 'vitoria': 'hub/sfx/vitoria',
    'risada': 'hub/sfx/risada', 'decolar': 'hub/sfx/decolar',
    'voz-tres': 'hub/voz/tres', 'voz-dois': 'hub/voz/dois', 'voz-um': 'hub/voz/um', 'voz-ja': 'hub/voz/ja',
    'voz-recorde': 'hub/voz/recorde', 'voz-oi': 'hub/voz/oi',
    'voz-truco': 'hub/voz/truco', 'voz-uno': 'hub/voz/uno',
    'voo-pulo': 'voo/sfx/pulo', 'voo-mola': 'voo/sfx/mola', 'voo-quebra': 'voo/sfx/quebra',
    'voo-foguete': 'voo/sfx/foguete', 'voo-queda': 'voo/sfx/queda', 'voo-tema': 'voo/musica/tema',
    'tom-1': 'sequencia/sfx/tom-1', 'tom-2': 'sequencia/sfx/tom-2', 'tom-3': 'sequencia/sfx/tom-3',
    'tom-4': 'sequencia/sfx/tom-4', 'seq-erro': 'sequencia/sfx/erro',
    'pega-aparece': 'speedtap/sfx/aparece', 'pega-pegou': 'speedtap/sfx/pegou', 'pega-combo': 'speedtap/sfx/combo',
    'ritmo-errou': 'ritmo/sfx/errou-nota', 'ritmo-energia': 'ritmo/sfx/energia', 'ritmo-falhou': 'ritmo/sfx/falhou',
    'ritmo-aplausos': 'ritmo/sfx/aplausos', 'ritmo-plateia': 'ritmo/sfx/plateia-show',
    'puff-estoura': 'puff/sfx/estoura',
    'baralho-embaralhar': 'baralho/sfx/embaralhar', 'baralho-distribuir': 'baralho/sfx/distribuir',
    'baralho-jogar': 'baralho/sfx/jogar-carta', 'baralho-uno': 'baralho/sfx/uno',
    'doces-trocar': 'doces/sfx/trocar', 'doces-combina': 'doces/sfx/combina-3',
    'doces-cascata': 'doces/sfx/cascata', 'doces-bomba': 'doces/sfx/bomba'
  };
  var _GANHO_ARQ = 2.0;     // arquivos já vêm nivelados; compensa o master conservador da síntese
  var _bufs = {};           // nome → AudioBuffer decodificado
  var _baixando = {};       // nome → Promise
  var _loops = [];          // loops tocando (parados em _suspender)

  function _carregar(nome) {
    if (_bufs[nome]) return Promise.resolve(_bufs[nome]);
    if (_baixando[nome]) return _baixando[nome];
    var ctx = _garantirCtx(), cam = _ARQ[nome];
    if (!ctx || !cam || !window.fetch) return Promise.reject(new Error('sem som'));
    _baixando[nome] = fetch('/Jogos/assets/' + cam + '.mp3')
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (ok, falha) { ctx.decodeAudioData(ab, ok, falha); }); })
      .then(function (buf) { _bufs[nome] = buf; return buf; });
    // Falhou (offline sem cache, 404): esquece, pra tentar de novo depois.
    _baixando[nome].catch(function () { delete _baixando[nome]; });
    return _baixando[nome];
  }

  function precarregar(lista) {
    if (!lista) return;
    for (var i = 0; i < lista.length; i++) { _carregar(lista[i]).catch(function () {}); }
  }

  function _tocarBuf(buf, vol, rate, emLoop) {
    var ctx = _garantirCtx();
    if (!ctx || !_master) return null;
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    if (rate && rate !== 1) src.playbackRate.value = rate;
    if (emLoop) {
      src.loop = true;
      // pula o respiro do mp3 nas pontas (mesma solução da Corrida)
      if (buf.duration > 0.2) { src.loopStart = 0.03; src.loopEnd = buf.duration - 0.03; }
    }
    g.gain.value = (vol != null ? vol : 1) * _GANHO_ARQ;
    src.connect(g); g.connect(_master);
    src.start(0, emLoop && buf.duration > 0.2 ? 0.03 : 0);
    src.onended = function () { try { src.disconnect(); g.disconnect(); } catch (e) {} };
    return { src: src, ganho: g };
  }

  // Toca o arquivo `nome`. reserva: função de síntese (ou nome de um efeito
  // desta API) tocada se o arquivo ainda não estiver pronto. vol 0..1
  // (padrão 1), rate = velocidade/tom (padrão 1). true = tocou o arquivo.
  function tocar(nome, reserva, vol, rate) {
    if (!_ligado || !_destravado) return false;
    var b = _bufs[nome];
    if (b) { _tocarBuf(b, vol, rate, false); return true; }
    _carregar(nome).catch(function () {});
    if (typeof reserva === 'function') reserva();
    else if (typeof reserva === 'string' && typeof _efeitos[reserva] === 'function') _efeitos[reserva]();
    return false;
  }

  // Voz gravada (locutor/Corujinha/truqueiro). Sem reserva sintetizada.
  function voz(nome, vol) { return tocar('voz-' + nome, null, vol != null ? vol : 1.1); }

  // Loop (música/ambiente). Devolve { parar(), volume(v) }. Se o arquivo
  // ainda não chegou, começa a tocar assim que decodificar (se ninguém
  // parou antes). O mudo zera o master, então o loop silencia e volta
  // junto com o som.
  function loop(nome, vol) {
    var ctl = { _no: null, _parado: false, _vol: (vol != null ? vol : 1) };
    ctl.parar = function () {
      ctl._parado = true;
      if (ctl._no) { try { ctl._no.src.stop(); } catch (e) {} ctl._no = null; }
      var i = _loops.indexOf(ctl); if (i >= 0) _loops.splice(i, 1);
    };
    ctl.volume = function (v) {
      ctl._vol = v;
      if (ctl._no) { try { ctl._no.ganho.gain.value = v * _GANHO_ARQ; } catch (e) {} }
    };
    _loops.push(ctl);
    _carregar(nome).then(function (buf) {
      if (ctl._parado) return;
      ctl._no = _tocarBuf(buf, ctl._vol, 1, true);
    }).catch(function () {});
    return ctl;
  }

  // Fechar o hub: para os loops e dorme o contexto (o indicador de mídia
  // do navegador some). _destravar acorda de novo no próximo gesto.
  function _suspender() {
    var l = _loops.slice();
    for (var i = 0; i < l.length; i++) l[i].parar();
    if (_ctx && _ctx.state === 'running' && _ctx.suspend) { try { _ctx.suspend(); } catch (e) {} }
  }

  // ── Efeitos nomeados (a API que os jogos usam) ───────────

  // Toque genérico (UI, selecionar). Curtinho e neutro.
  function toque() {
    _voz({ tipo: 'triangle', freq: 330, dur: 0.06, vol: 0.35 });
  }

  // Acerto simples (pegar coruja boa, passo certo). "Ploc" ascendente.
  function acerto() {
    _voz({ tipo: 'sine', freq: 620, freqFim: 880, dur: 0.10, vol: 0.5 });
  }

  // Acerto com combo/multiplicador: sobe de tom conforme o nível (1..).
  // nivel 1 = base; cada nível sobe ~1 semitom+ para dar sensação de escada.
  function combo(nivel) {
    var n = Math.max(1, nivel | 0);
    var base = 600 * Math.pow(1.0595, Math.min(24, (n - 1) * 2)); // ~2 semitons/nível
    // gravado: o mesmo "ding" sobe de tom a cada nível (até ~1 oitava)
    tocar('pega-combo', function () {
      _voz({ tipo: 'triangle', freq: base, freqFim: base * 1.5, dur: 0.11, vol: 0.5 });
    }, 0.8, Math.min(2, Math.pow(1.0595, Math.min(12, n - 1))));
  }

  // Bônus (coruja dourada, item especial): dois toques brilhantes.
  function bonus() {
    _voz({ tipo: 'sine', freq: 880, freqFim: 1320, dur: 0.10, vol: 0.5 });
    _voz({ tipo: 'sine', freq: 1320, dur: 0.12, vol: 0.42, atraso: 0.08 });
  }

  // Erro leve (perdeu ponto, tocou na fake mas ainda tem vida). Descida seca.
  function erro() {
    _voz({ tipo: 'sawtooth', freq: 300, freqFim: 150, dur: 0.16, vol: 0.42 });
    _ruido(0.10, 0.10, 1200);
  }

  // Perdeu uma vida (mais grave/impactante que 'erro').
  function dano() {
    _voz({ tipo: 'square', freq: 220, freqFim: 110, dur: 0.22, vol: 0.4 });
    _ruido(0.14, 0.14, 900);
  }

  // Uma coruja acende no playback do Simon. idx (0..5) muda a nota,
  // pra cada botão ter seu tom (como no Genius original).
  function nota(idx) {
    var escala = [392, 440, 523, 587, 659, 784]; // G A C D E G
    var i = idx | 0;
    var f = escala[i % escala.length];
    var sint = function () { _voz({ tipo: 'sine', freq: f, dur: 0.24, vol: 0.5, release: 0.14 }); };
    // gravado: 4 notas de marimba (Dó-Mi-Sol-Dó), uma por coruja da Sequência;
    // a 5ª e a 6ª coruja (rodada 6+) são Ré e Lá: Dó e Sol um tom acima.
    if (i >= 0 && i < 4) tocar('tom-' + (i + 1), sint);
    else if (i === 4) tocar('tom-1', sint, 1, 1.1225);
    else if (i === 5) tocar('tom-3', sint, 1, 1.1225);
    else sint();
  }

  // Subir de nível / expandir grade: arpejo curto pra cima.
  function nivelUp() {
    _voz({ tipo: 'triangle', freq: 523, dur: 0.09, vol: 0.45 });
    _voz({ tipo: 'triangle', freq: 659, dur: 0.09, vol: 0.45, atraso: 0.07 });
    _voz({ tipo: 'triangle', freq: 784, dur: 0.12, vol: 0.45, atraso: 0.14 });
  }

  // Pulo (Voo da Coruja). Bem curtinho pra não cansar (toca muito).
  function pulo() {
    // toca muito: volume mais baixo e leve variação de tom pra não cansar
    tocar('voo-pulo', function () {
      _voz({ tipo: 'sine', freq: 480, freqFim: 720, dur: 0.07, vol: 0.32, ataque: 0.004 });
    }, 0.45, 0.94 + Math.random() * 0.12);
  }

  // Trampolim/mola (plataforma especial do Voo): pulo mais alto/agudo.
  function mola() {
    tocar('voo-mola', function () {
      _voz({ tipo: 'sine', freq: 520, freqFim: 1040, dur: 0.14, vol: 0.4 });
    }, 0.7);
  }

  // Moeda ganha (fim de partida, loja). Gravado; reserva = bônus.
  function moeda() { tocar('moeda', bonus, 0.7); }

  // Fim de jogo. vitoria=true (novo recorde) → fanfarra; false → descida.
  function fim(vitoria) {
    // gravados: jingle de vitória / "wah-wah" de fim de jogo
    if (tocar(vitoria ? 'vitoria' : 'fim-de-jogo', null, 0.8)) return;
    if (vitoria) {
      // arpejo maior ascendente + oitava
      var seq = [523, 659, 784, 1047];
      for (var i = 0; i < seq.length; i++) {
        _voz({ tipo: 'triangle', freq: seq[i], dur: 0.16, vol: 0.5, atraso: i * 0.11 });
      }
    } else {
      // "trombone triste": três descidas
      _voz({ tipo: 'sawtooth', freq: 392, freqFim: 349, dur: 0.18, vol: 0.4 });
      _voz({ tipo: 'sawtooth', freq: 349, freqFim: 294, dur: 0.18, vol: 0.4, atraso: 0.16 });
      _voz({ tipo: 'sawtooth', freq: 294, freqFim: 220, dur: 0.30, vol: 0.4, atraso: 0.32 });
    }
  }

  // ── Controle de mudo (usado pelo botão no hub) ───────────
  function ativo() { return _ligado; }
  function definir(v) {
    _ligado = !!v;
    _salvarPref();
    if (_master) { try { _master.gain.value = _ligado ? 0.32 : 0; } catch (e) {} } // loops silenciam junto
    if (_ligado) _destravar(); // se acabou de ligar dentro de um gesto, acorda
    return _ligado;
  }
  function alternar() { return definir(!_ligado); }

  // ── API pública ──────────────────────────────────────────
  var _efeitos = window.AngatubaSom = {
    // destrava o áudio (chamar no 1º gesto de qualquer jogo)
    _destravar: _destravar,
    _suspender: _suspender,
    // sons gravados
    tocar: tocar,
    voz: voz,
    loop: loop,
    precarregar: precarregar,
    moeda: moeda,
    // efeitos
    toque: toque,
    acerto: acerto,
    combo: combo,
    bonus: bonus,
    erro: erro,
    dano: dano,
    nota: nota,
    nivelUp: nivelUp,
    pulo: pulo,
    mola: mola,
    fim: fim,
    // controle de mudo
    ativo: ativo,
    definir: definir,
    alternar: alternar
  };
})();
