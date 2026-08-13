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
      _master.gain.value = 0.32; // teto de volume conservador
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
    _voz({ tipo: 'triangle', freq: base, freqFim: base * 1.5, dur: 0.11, vol: 0.5 });
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
    var f = escala[(idx | 0) % escala.length];
    _voz({ tipo: 'sine', freq: f, dur: 0.24, vol: 0.5, release: 0.14 });
  }

  // Subir de nível / expandir grade: arpejo curto pra cima.
  function nivelUp() {
    _voz({ tipo: 'triangle', freq: 523, dur: 0.09, vol: 0.45 });
    _voz({ tipo: 'triangle', freq: 659, dur: 0.09, vol: 0.45, atraso: 0.07 });
    _voz({ tipo: 'triangle', freq: 784, dur: 0.12, vol: 0.45, atraso: 0.14 });
  }

  // Pulo (Voo da Coruja). Bem curtinho pra não cansar (toca muito).
  function pulo() {
    _voz({ tipo: 'sine', freq: 480, freqFim: 720, dur: 0.07, vol: 0.32, ataque: 0.004 });
  }

  // Trampolim/mola (plataforma especial do Voo): pulo mais alto/agudo.
  function mola() {
    _voz({ tipo: 'sine', freq: 520, freqFim: 1040, dur: 0.14, vol: 0.4 });
  }

  // Fim de jogo. vitoria=true (novo recorde) → fanfarra; false → descida.
  function fim(vitoria) {
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
    if (_ligado) _destravar(); // se acabou de ligar dentro de um gesto, acorda
    return _ligado;
  }
  function alternar() { return definir(!_ligado); }

  // ── API pública ──────────────────────────────────────────
  window.AngatubaSom = {
    // destrava o áudio (chamar no 1º gesto de qualquer jogo)
    _destravar: _destravar,
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
