'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO APRENDER — Aprender/hub.js
   Aprendizado de idiomas estilo Duolingo (MVP: só Inglês). Carrega
   sob demanda (ver _carregarHubAprender em app.js), disparado no
   primeiro toque na pill "Aprender" — quem não usa o módulo nunca
   baixa este código.

   Escopo: menu de unidades, lista de lições de uma unidade, motor de
   exercícios (múltipla escolha, parear, completar frase), progresso
   (XP + ofensiva) local e sincronizado no Firestore quando logado.

   Roda no MESMO escopo global do app.js (script clássico, sem
   módulo/IIFE) — os dois se enxergam por identificador direto, sem
   precisar de window.* pra se chamar. Depende de app.js já ter
   rodado antes (_injetarScript, _carregarFirebaseAuthCore, _cliUser)
   e de Aprender/conteudo.js já ter carregado (window.APRENDER_CONTEUDO)
   — ambos são injetados juntos por _carregarHubAprender, nessa ordem.
══════════════════════════════════════════════════════════════ */

  var APR_XP_POR_LICAO = 10;         // XP simples por lição concluída (MVP)
  var APR_CHAVE_LOCAL = 'angatuba_aprender';
  var APR_UNIDADE_IDS = ['u1', 'u2', 'u3', 'u4'];

  /* ── Estado em memória (carregado de localStorage/Firestore) ── */
  var _aprEstado = null;   // { en: { totalXp, streak, lastDate, units:{u1:{completedLessons:[],xp:0}, ...} } }
  var _aprSincronizado = false; // true depois da 1ª mesclagem com o Firestore nesta sessão

  function _aprEstadoPadrao() {
    var units = {};
    for (var i = 0; i < APR_UNIDADE_IDS.length; i++) {
      units[APR_UNIDADE_IDS[i]] = { completedLessons: [], xp: 0 };
    }
    return { totalXp: 0, streak: 0, lastDate: null, units: units };
  }

  function _aprLerLocal() {
    try {
      var raw = localStorage.getItem(APR_CHAVE_LOCAL);
      if (!raw) return { en: _aprEstadoPadrao() };
      var obj = JSON.parse(raw);
      if (!obj || !obj.en) return { en: _aprEstadoPadrao() };
      // Garante que todas as unidades existam mesmo se o conteúdo cresceu.
      var padrao = _aprEstadoPadrao();
      obj.en.units = obj.en.units || {};
      for (var i = 0; i < APR_UNIDADE_IDS.length; i++) {
        var id = APR_UNIDADE_IDS[i];
        if (!obj.en.units[id]) obj.en.units[id] = padrao.units[id];
      }
      obj.en.totalXp = Number(obj.en.totalXp) || 0;
      obj.en.streak = Number(obj.en.streak) || 0;
      return obj;
    } catch (e) { return { en: _aprEstadoPadrao() }; }
  }

  function _aprSalvarLocal() {
    try { localStorage.setItem(APR_CHAVE_LOCAL, JSON.stringify(_aprEstado)); } catch (e) {}
  }

  /* ── Data local (YYYY-MM-DD) — usada pra ofensiva do módulo ──── */
  function _aprDataStr(offsetDias) {
    var d = new Date();
    if (offsetDias) d.setDate(d.getDate() + offsetDias);
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dia = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dia;
  }

  // Marco de dias seguidos (mesma ideia do streak dos jogos, self-contido
  // aqui pra não depender de Jogos/hub.js — Aprender funciona sozinho).
  function _aprProxMarco(dias) {
    var marcos = [3, 7, 14, 30, 60, 100, 200, 365];
    for (var i = 0; i < marcos.length; i++) { if (marcos[i] > dias) return marcos[i]; }
    return null;
  }

  // Registra atividade de hoje na ofensiva do módulo. Chamado ao concluir
  // uma lição. Retorna true se a ofensiva AUMENTOU nesta chamada.
  function _aprRegistrarStreak(en) {
    var hoje = _aprDataStr(0);
    if (en.lastDate === hoje) return false; // já contou hoje
    var ontem = _aprDataStr(-1);
    en.streak = (en.lastDate === ontem) ? (Number(en.streak) || 0) + 1 : 1;
    en.lastDate = hoje;
    return true;
  }

  /* ── Firestore (progresso sincronizado quando logado) ─────────
     Reaproveita a mesma sessão do Firebase Auth já carregada por
     app.js (login usado no ranking dos jogos e no cliente); só
     acrescenta o SDK do Firestore, sob demanda, quando o hub abre. */
  var _aprFbCarregado = null;
  function _carregarFirebaseAprender() {
    if (_aprFbCarregado) return _aprFbCarregado;
    _aprFbCarregado = _carregarFirebaseAuthCore().then(function () {
      return _injetarScript(FIREBASE_SDK_BASE + 'firebase-firestore-compat.js');
    }).catch(function (err) { _aprFbCarregado = null; throw err; });
    return _aprFbCarregado;
  }

  var _aprFbDb = null;
  function _aprDb() {
    if (_aprFbDb) return _aprFbDb;
    if (typeof firebase === 'undefined' || !firebase.firestore) return null;
    try { _aprFbDb = firebase.firestore(); } catch (e) { _aprFbDb = null; }
    return _aprFbDb;
  }

  // Mescla o progresso local com o que veio do Firestore: fica sempre com
  // o "mais avançado" dos dois lados (união das lições concluídas, maior
  // XP/ofensiva) — nunca perde progresso feito em outro aparelho nem no
  // atual. Não mexe no idioma além de 'en' (único do MVP).
  function _aprMesclar(local, remoto) {
    if (!remoto) return local;
    var out = {
      totalXp: Math.max(Number(local.totalXp) || 0, Number(remoto.totalXp) || 0),
      streak: Math.max(Number(local.streak) || 0, Number(remoto.streak) || 0),
      lastDate: ((local.lastDate || '') > (remoto.lastDate || '')) ? local.lastDate : (remoto.lastDate || local.lastDate),
      units: {}
    };
    for (var i = 0; i < APR_UNIDADE_IDS.length; i++) {
      var id = APR_UNIDADE_IDS[i];
      var lu = (local.units && local.units[id]) || { completedLessons: [], xp: 0 };
      var ru = (remoto.units && remoto.units[id]) || { completedLessons: [], xp: 0 };
      var vistos = {}; var licoes = [];
      (lu.completedLessons || []).concat(ru.completedLessons || []).forEach(function (lid) {
        if (!vistos[lid]) { vistos[lid] = true; licoes.push(lid); }
      });
      out.units[id] = { completedLessons: licoes, xp: Math.max(Number(lu.xp) || 0, Number(ru.xp) || 0) };
    }
    return out;
  }

  // Chamado ao abrir o hub, se houver cliente logado: lê o doc do Firestore
  // uma vez, mescla com o local e regrava dos dois lados. Falha silenciosa
  // — sem Firestore, o módulo segue 100% funcional só com localStorage.
  function _aprSincronizarNuvem() {
    if (_aprSincronizado) return;
    if (typeof _cliUser === 'undefined' || !_cliUser) return;
    _carregarFirebaseAprender().then(function () {
      var db = _aprDb();
      if (!db) return;
      return db.collection('lang_progress').doc(_cliUser.uid).get().then(function (doc) {
        var remoto = (doc && doc.exists) ? (doc.data() || {}).en : null;
        var mesclado = _aprMesclar(_aprEstado.en, remoto);
        _aprEstado.en = mesclado;
        _aprSalvarLocal();
        _aprSalvarNuvem();
        _aprSincronizado = true;
        // Se a mesclagem trouxe progresso de outro aparelho, atualiza a tela.
        if (_aprenderAberto()) { _aprRenderStats(); _aprRenderMenu(); }
      });
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[aprender] sync falhou:', err && err.message);
    });
  }

  // Grava o estado atual no Firestore (best-effort, silencioso). Chamado
  // depois de cada lição concluída e depois da 1ª mesclagem no login.
  function _aprSalvarNuvem() {
    if (typeof _cliUser === 'undefined' || !_cliUser) return;
    var db = _aprDb();
    if (!db) return;
    db.collection('lang_progress').doc(_cliUser.uid).set({
      en: _aprEstado.en,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[aprender] gravação na nuvem falhou:', err && err.message);
    });
  }

  /* ── Conteúdo: helpers de leitura ──────────────────────────── */
  function _aprUnidades() { return (window.APRENDER_CONTEUDO && APRENDER_CONTEUDO.unidades) || []; }
  function _aprUnidade(id) { var us = _aprUnidades(); for (var i = 0; i < us.length; i++) if (us[i].id === id) return us[i]; return null; }
  function _aprLicao(unidade, id) { var ls = unidade.licoes || []; for (var i = 0; i < ls.length; i++) if (ls[i].id === id) return ls[i]; return null; }

  function _aprProgressoUnidade(id) {
    var en = _aprEstado.en;
    return (en.units && en.units[id]) || { completedLessons: [], xp: 0 };
  }

  // Unidade 0 sempre desbloqueada; as demais liberam quando TODAS as
  // lições da unidade anterior estiverem concluídas.
  function _aprUnidadeDesbloqueada(idxUnidade) {
    if (idxUnidade <= 0) return true;
    var anterior = _aprUnidades()[idxUnidade - 1];
    if (!anterior) return true;
    var prog = _aprProgressoUnidade(anterior.id);
    return anterior.licoes.every(function (l) { return prog.completedLessons.indexOf(l.id) !== -1; });
  }

  // 1ª lição de uma unidade desbloqueada libera se a unidade está
  // desbloqueada; as demais liberam quando a lição anterior foi concluída.
  function _aprLicaoDesbloqueada(unidade, idxUnidade, idxLicao) {
    if (!_aprUnidadeDesbloqueada(idxUnidade)) return false;
    if (idxLicao <= 0) return true;
    var prog = _aprProgressoUnidade(unidade.id);
    var anterior = unidade.licoes[idxLicao - 1];
    return prog.completedLessons.indexOf(anterior.id) !== -1;
  }

  // Unidade "atual" pro destaque do menu: a primeira desbloqueada que ainda
  // não está 100% completa. Se tudo estiver completo, não há destaque (-1).
  function _aprUnidadeAtualIdx() {
    var unidades = _aprUnidades();
    for (var i = 0; i < unidades.length; i++) {
      if (!_aprUnidadeDesbloqueada(i)) continue;
      var prog = _aprProgressoUnidade(unidades[i].id);
      var completa = unidades[i].licoes.every(function (l) { return prog.completedLessons.indexOf(l.id) !== -1; });
      if (!completa) return i;
    }
    return -1;
  }

  // Lição "atual" pro destaque da lista: a primeira desbloqueada e não
  // concluída dentro da unidade aberta.
  function _aprLicaoAtualIdx(unidade, idxUnidade, prog) {
    for (var i = 0; i < unidade.licoes.length; i++) {
      if (!_aprLicaoDesbloqueada(unidade, idxUnidade, i)) continue;
      if (prog.completedLessons.indexOf(unidade.licoes[i].id) === -1) return i;
    }
    return -1;
  }

  /* ── Áudio (Web Speech API) — só inglês, botão manual ──────────
     Degrada de forma totalmente silenciosa: sem suporte no navegador,
     _aprSuportaAudio() volta false e nenhum botão de áudio é criado em
     lugar nenhum — o resto do módulo funciona exatamente igual. */
  function _aprSuportaAudio() {
    try { return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'; }
    catch (e) { return false; }
  }

  var _aprVozesProntas = false;
  if (_aprSuportaAudio()) {
    try {
      speechSynthesis.getVoices();
      speechSynthesis.addEventListener('voiceschanged', function () { _aprVozesProntas = true; });
    } catch (e) {}
  }

  function _aprEscolherVoz() {
    if (!_aprSuportaAudio()) return null;
    try {
      var vozes = speechSynthesis.getVoices() || [];
      if (!vozes.length) return null;
      var v = null, i;
      for (i = 0; i < vozes.length; i++) if (vozes[i].lang === 'en-US') { v = vozes[i]; break; }
      if (!v) for (i = 0; i < vozes.length; i++) if (vozes[i].lang === 'en-GB') { v = vozes[i]; break; }
      if (!v) for (i = 0; i < vozes.length; i++) if (/^en/i.test(vozes[i].lang)) { v = vozes[i]; break; }
      return v;
    } catch (e) { return null; }
  }

  // Fala um texto em inglês (best-effort, nunca lança erro pro chamador).
  function _aprFalar(texto) {
    if (!_aprSuportaAudio() || !texto) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(texto);
      u.lang = 'en-US';
      u.rate = 0.92;
      var voz = _aprEscolherVoz();
      if (voz) u.voice = voz;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // Cria o botão de áudio (sempre IRMÃO do botão de opção/pergunta, nunca
  // filho — <button> não pode conter <button>). Retorna null sem suporte.
  function _aprCriarBotaoAudio(texto, classeExtra) {
    if (!_aprSuportaAudio()) return null;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'apr-audio-btn' + (classeExtra ? ' ' + classeExtra : '');
    b.setAttribute('aria-label', 'Ouvir pronúncia');
    b.innerHTML = '<i class="fa fa-volume-up"></i>';
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      _aprFalar(texto);
    });
    return b;
  }

  /* ── Tela cheia (mesmo mecanismo do hub de jogos, com classe própria
     — os dois hubs nunca ficam abertos ao mesmo tempo, ver mútua
     exclusão em _abrirAprender/_abrirGamesHub) ─────────────────── */
  function _aprenderAberto() {
    var hub = document.getElementById('aprender-hub');
    return !!(hub && hub.style.display !== 'none');
  }

  function _abrirAprender() {
    var hub = document.getElementById('aprender-hub');
    if (!hub) return;
    // Mútua exclusão: se o hub de jogos estava aberto, fecha antes.
    if (typeof _gamesHubAberto === 'function' && _gamesHubAberto()) {
      if (typeof _fecharGamesHub === 'function') _fecharGamesHub();
    }
    if (!_aprEstado) _aprEstado = _aprLerLocal();

    var secao = document.getElementById('home-carousel-wrap');
    var dots = document.getElementById('home-dots');
    var footer = document.querySelector('main.main .footer');
    var siga = document.getElementById('bloco-siga');
    if (secao) secao.style.display = 'none';
    if (dots) dots.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (siga) siga.style.display = 'none';

    hub.style.display = 'block';
    document.body.classList.add('aprender-fs-open');
    _aprVoltarMenu(); // sempre abre mostrando o menu de unidades (já renderiza os cards)
    _aprRenderStats();
    _aprSincronizarNuvem();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    if (history.state?.modal !== 'aprender-hub') history.pushState({ modal: 'aprender-hub' }, '');
  }
  // Exposto pra pill "Aprender" (index.html) e pro loader em app.js, que
  // troca este stub pela versão real assim que Aprender/hub.js carrega.
  window._abrirAprender = _abrirAprender;

  function _fecharAprender(viaPopstate) {
    var hub = document.getElementById('aprender-hub');
    if (!hub) return;
    hub.style.display = 'none';
    document.body.classList.remove('aprender-fs-open');
    var secao = document.getElementById('home-carousel-wrap');
    var dots = document.getElementById('home-dots');
    var footer = document.querySelector('main.main .footer');
    var siga = document.getElementById('bloco-siga');
    if (secao) secao.style.display = '';
    if (dots) dots.style.display = '';
    if (footer) footer.style.display = '';
    if (siga) siga.style.display = '';
    var pill = document.getElementById('pill-aprender-btn');
    if (pill) pill.classList.remove('active');
    if (!viaPopstate && history.state?.modal === 'aprender-hub') { _popstateNosso = true; history.back(); }
  }
  window._fecharAprender = _fecharAprender;
  window._aprenderAberto = _aprenderAberto;

  // Botão de voltar do cabeçalho (chevron) — sempre sai do hub inteiro,
  // de qualquer tela (menu, unidade ou lição em andamento).
  function _sairDoAprender() {
    _fecharAprender();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }
  window._sairDoAprender = _sairDoAprender;

  /* ── Navegação entre as 4 telas do hub ─────────────────────── */
  // BUG real do botão "preso embaixo" (relatado mesmo após tirar o rodapé
  // da área que rola): #aprender-hub é o container de tela cheia (fixed,
  // 100dvh, overflow-y:auto) e .games-hub-head (título "Aprender Inglês")
  // continua visível e ocupando espaço ACIMA de qualquer sub-tela. Como
  // cada sub-tela (unidade/licão/resultado) também reivindica 100vh de
  // altura, a soma (cabeçalho + sub-tela de 100vh) estoura a altura do
  // container fixo — e é ESSE overflow do #aprender-hub que obriga a
  // rolar pra ver o rodapé, não o scroll interno do #apr-exercicio-corpo
  // (que já está correto). Correção: esconder .games-hub-head assim que
  // qualquer sub-tela abre — mesmo mecanismo já usado no hub de jogos
  // (ver #games-hub.jogo-ativo no styles.css) — cada sub-tela já tem seu
  // próprio botão de voltar/fechar/continuar, então a saída nunca fica
  // bloqueada, só precisa passar pelo menu de novo pra sair do módulo.
  function _aprMostrarTela(nome) {
    var hub = document.getElementById('aprender-hub');
    var menu = document.getElementById('apr-menu-unidades');
    var tUnidade = document.getElementById('apr-tela-unidade');
    var tLicao = document.getElementById('apr-tela-licao');
    var tResultado = document.getElementById('apr-tela-resultado');
    var faixa = document.getElementById('apr-stats-faixa');
    [menu, tUnidade, tLicao, tResultado].forEach(function (el) { if (el) el.style.display = 'none'; });
    if (nome === 'menu' && menu) menu.style.display = 'block';
    if (nome === 'unidade' && tUnidade) tUnidade.style.display = 'block';
    if (nome === 'licao' && tLicao) tLicao.style.display = 'flex';
    if (nome === 'resultado' && tResultado) tResultado.style.display = 'flex';
    // A faixa de ofensiva/XP só aparece no menu principal (mesma lógica
    // do hub de jogos, que some a faixa durante uma partida).
    if (faixa) faixa.style.display = (nome === 'menu') ? 'flex' : 'none';
    if (hub) hub.classList.toggle('apr-tela-ativa', nome !== 'menu');
  }

  function _aprRenderStats() {
    var faixa = document.getElementById('apr-stats-faixa');
    if (!faixa) return;
    var en = _aprEstado.en;
    if (!en.streak) { faixa.style.display = 'none'; }
    var hoje = _aprDataStr(0), ontem = _aprDataStr(-1);
    var vivo = (en.lastDate === hoje || en.lastDate === ontem);
    faixa.classList.toggle('streak-apagada', !vivo && !!en.streak);
    var numEl = document.getElementById('apr-streak-num');
    var subEl = document.getElementById('apr-streak-sub');
    var xpEl = document.getElementById('apr-xp-pill');
    if (numEl) numEl.textContent = en.streak + (en.streak === 1 ? ' dia' : ' dias');
    if (subEl) {
      if (!en.streak) subEl.textContent = 'Complete uma lição pra começar sua ofensiva!';
      else if (!vivo) subEl.textContent = 'Sua ofensiva esfriou! Estude pra reacender 🔥';
      else if (en.lastDate === hoje) {
        var prox = _aprProxMarco(en.streak);
        subEl.textContent = prox ? ('Faltam ' + (prox - en.streak) + ' pra ' + prox + ' dias 🎯') : 'Você está on fire! 🔥';
      } else {
        subEl.textContent = 'Estude hoje pra manter a ofensiva!';
      }
    }
    if (xpEl) xpEl.textContent = '⭐ ' + (en.totalXp || 0) + ' XP';
  }

  /* ── Tela 1: menu de unidades ──────────────────────────────── */
  function _aprRenderMenu() {
    var wrap = document.getElementById('apr-menu-unidades');
    if (!wrap) return;
    var unidades = _aprUnidades();
    var atualIdx = _aprUnidadeAtualIdx();
    var html = '';
    unidades.forEach(function (u, idx) {
      var prog = _aprProgressoUnidade(u.id);
      var total = u.licoes.length;
      var feitas = u.licoes.filter(function (l) { return prog.completedLessons.indexOf(l.id) !== -1; }).length;
      var desbloqueada = _aprUnidadeDesbloqueada(idx);
      var completa = feitas === total;
      var atual = idx === atualIdx;
      // Coruja da unidade atual: presença de personagem real na tela de
      // unidades (não só decoração) — só aparece na unidade em andamento
      // e ainda não concluída (a concluída já tem a owl-trophy no ícone).
      html += '<button type="button" class="apr-unidade-card' +
        (desbloqueada ? '' : ' apr-unidade-bloqueada') +
        (completa ? ' apr-unidade-completa' : '') +
        (atual ? ' apr-unidade-atual' : '') +
        '" data-unidade="' + u.id + '"' + (desbloqueada ? '' : ' disabled aria-disabled="true"') + '>' +
        (atual && !completa ? '<img src="/webp/owl-wave.webp" class="apr-unidade-atual-owl" alt="" onerror="this.style.display=\'none\'">' : '') +
        '<div class="apr-unidade-icone">' + (desbloqueada ? u.icone : '<i class="fa fa-lock"></i>') +
        (completa ? '<img src="/webp/owl-trophy.webp" class="apr-unidade-owl-mini" alt="" onerror="this.style.display=\'none\'">' : '') +
        '</div>' +
        '<div class="apr-unidade-corpo">' +
        '<div class="apr-unidade-titulo">' + u.titulo + '</div>' +
        '<div class="apr-unidade-sub">Nível ' + (idx + 1) + ' · ' + feitas + '/' + total + ' lições' + (completa ? ' · concluída ✓' : '') + '</div>' +
        '<div class="apr-unidade-barra"><div class="apr-unidade-barra-fill" style="width:' + Math.round((total ? feitas / total : 0) * 100) + '%"></div></div>' +
        '</div>' +
        (desbloqueada ? '<i class="fa fa-chevron-right apr-unidade-seta"></i>' : '') +
        '</button>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.apr-unidade-card:not(.apr-unidade-bloqueada)').forEach(function (btn) {
      btn.addEventListener('click', function () { _aprAbrirUnidade(btn.dataset.unidade); });
    });
  }

  /* ── Tela 2: lições de uma unidade ─────────────────────────── */
  var _aprUnidadeAtualId = null;

  // SEM linha conectora (removida a pedido — só as bolhas, mais "ar" entre
  // elas, sensação de caminho que sobe/desce sem poluição visual). Volta a
  // ser flexbox simples em coluna: .apr-licao-esq/.apr-licao-dir (ver
  // styles.css) alternam a margem lateral pra dar o zigue-zague só com o
  // posicionamento das próprias bolhas, sem precisar de SVG nem CSS Grid.
  function _aprAbrirUnidade(unidadeId) {
    var unidade = _aprUnidade(unidadeId);
    if (!unidade) return;
    _aprUnidadeAtualId = unidadeId;
    var idxUnidade = _aprUnidades().indexOf(unidade);
    var prog = _aprProgressoUnidade(unidadeId);
    var licaoAtualIdx = _aprLicaoAtualIdx(unidade, idxUnidade, prog);

    var head = document.getElementById('apr-unidade-head');
    if (head) {
      head.innerHTML = '<div class="apr-unidade-head-icone">' + unidade.icone + '</div>' +
        '<h2 class="apr-unidade-head-titulo">' + unidade.titulo + '</h2>' +
        '<img src="/webp/owl-wave.webp" class="apr-unidade-head-owl" alt="" onerror="this.style.display=\'none\'">';
    }
    var lista = document.getElementById('apr-lista-licoes');
    if (lista) {
      lista.setAttribute('data-unidade', unidadeId); // dá cor própria às bolhas (ver CSS)
      var html = '';
      unidade.licoes.forEach(function (l, idx) {
        var feita = prog.completedLessons.indexOf(l.id) !== -1;
        var desbloqueada = _aprLicaoDesbloqueada(unidade, idxUnidade, idx);
        html += '<button type="button" class="apr-licao-item' +
          (feita ? ' apr-licao-feita' : '') + (desbloqueada ? '' : ' apr-licao-bloqueada') +
          (idx === licaoAtualIdx ? ' apr-licao-atual' : '') +
          (idx % 2 === 0 ? ' apr-licao-esq' : ' apr-licao-dir') +
          '" data-licao="' + l.id + '"' + (desbloqueada ? '' : ' disabled aria-disabled="true"') + '>' +
          '<div class="apr-licao-bolha">' + (feita ? '<i class="fa fa-check"></i>' : (desbloqueada ? (idx + 1) : '<i class="fa fa-lock"></i>')) +
          (feita ? '<i class="fa fa-star apr-licao-star"></i>' : '') +
          '</div>' +
          '<div class="apr-licao-titulo">' + l.titulo + '</div>' +
          '</button>';
      });
      lista.innerHTML = html;
      lista.querySelectorAll('.apr-licao-item:not(.apr-licao-bloqueada)').forEach(function (btn) {
        btn.addEventListener('click', function () { _aprAbrirLicao(unidadeId, btn.dataset.licao); });
      });
    }
    _aprMostrarTela('unidade');
  }

  function _aprVoltarMenu() {
    _aprRenderMenu();
    _aprMostrarTela('menu');
  }
  window._aprVoltarMenu = _aprVoltarMenu;

  /* ── Tela 3: motor de exercícios de uma lição ──────────────── */
  var _aprLicaoAtual = null; // { unidadeId, licaoId, exercicios, idx, acertos }

  function _aprAbrirLicao(unidadeId, licaoId) {
    var unidade = _aprUnidade(unidadeId);
    var licao = unidade && _aprLicao(unidade, licaoId);
    if (!licao) return;
    _aprLicaoAtual = { unidadeId: unidadeId, licaoId: licaoId, exercicios: licao.exercicios, idx: 0, acertos: 0, combo: 0, inicio: Date.now() };
    _aprGarantirComboBadge();
    _aprMostrarTela('licao');
    // Estilo Duolingo: ensina antes de testar. Só entra direto nos exercícios
    // se a lição não tiver vocabulário cadastrado (robustez/retrocompatibilidade).
    if (licao.vocabulario && licao.vocabulario.length) _aprRenderEnsinar(licao);
    else _aprRenderExercicio();
  }

  // Tela "Aprenda": mostra as palavras/frases novas da lição (inglês em
  // destaque + tradução + áudio) antes do primeiro exercício. Reaproveita
  // o mesmo container #apr-exercicio-corpo dos exercícios — sem precisar
  // de nenhum elemento novo no index.html.
  function _aprRenderEnsinar(licao) {
    var fill = document.getElementById('apr-licao-barra-fill');
    if (fill) fill.style.width = '0%';
    var corpo = document.getElementById('apr-exercicio-corpo');
    if (!corpo) return;
    var owl = _aprSortear(['/webp/owl-wave.webp', '/webp/owl-idea.webp', '/webp/owl-point.webp']);
    var vocab = licao.vocabulario || [];
    var itensHtml = '';
    vocab.forEach(function (item, i) {
      itensHtml +=
        '<div class="apr-voc-item">' +
        '<div class="apr-voc-textos">' +
        '<div class="apr-voc-en">' + item.en + '</div>' +
        '<div class="apr-voc-pt">' + item.pt + '</div>' +
        '</div>' +
        '<div class="apr-voc-audio-slot" id="apr-voc-audio-' + i + '"></div>' +
        '</div>';
    });
    corpo.innerHTML =
      '<div class="apr-ensinar-topo">' +
      '<img src="' + owl + '" alt="" class="apr-ensinar-owl" onerror="this.style.display=\'none\'">' +
      '<div class="apr-ensinar-cabecalho">' +
      '<div class="apr-ex-instrucao">Vamos aprender</div>' +
      '<h2 class="apr-ensinar-titulo">' + licao.titulo + '</h2>' +
      '</div>' +
      '</div>' +
      '<div class="apr-voc-lista">' + itensHtml + '</div>';

    // Botões de áudio são adicionados via DOM (nunca por innerHTML) porque
    // carregam um listener — mesmo padrão usado nas opções/perguntas dos
    // exercícios. Sem suporte a speechSynthesis, o slot fica vazio (nada quebra).
    vocab.forEach(function (item, i) {
      var slot = document.getElementById('apr-voc-audio-' + i);
      var botaoAudio = _aprCriarBotaoAudio(item.en);
      if (slot && botaoAudio) slot.appendChild(botaoAudio);
    });

    // O botão "Começar a praticar" mora em #apr-licao-rodape — elemento
    // IRMÃO de #apr-exercicio-corpo (ver index.html), fora da área que
    // rola. Sem position:sticky/fixed: como .apr-tela-licao é flex-column
    // de altura fixa e o corpo é quem tem flex:1 + scroll próprio, o
    // rodapé é só o último item da coluna — nunca precisa "grudar" em
    // lugar nenhum porque nunca esteve dentro do que rola.
    var rodape = document.getElementById('apr-licao-rodape');
    if (rodape) {
      rodape.classList.remove('apr-licao-rodape-oculto'); // desfaz estado deixado por um "parear" anterior
      rodape.innerHTML = '<button type="button" class="apr-resultado-btn apr-ensinar-praticar" id="apr-ensinar-praticar">Começar a praticar</button>';
      var btnPraticar = document.getElementById('apr-ensinar-praticar');
      if (btnPraticar) btnPraticar.addEventListener('click', function () { _aprRenderExercicio(); });
    }
  }

  function _aprSairLicao() {
    // Sai sem salvar progresso da lição em andamento (MVP: só grava ao concluir).
    _aprLicaoAtual = null;
    _aprAbrirUnidade(_aprUnidadeAtualId);
  }
  window._aprSairLicao = _aprSairLicao;

  function _aprAtualizarBarraLicao() {
    var fill = document.getElementById('apr-licao-barra-fill');
    if (!fill || !_aprLicaoAtual) return;
    var pct = Math.round((_aprLicaoAtual.idx / _aprLicaoAtual.exercicios.length) * 100);
    fill.style.width = pct + '%';
  }

  // Combo de acertos seguidos: mostrado de forma sutil no topo (dentro de
  // .apr-licao-topo, ao lado da barra de progresso já existente no HTML
  // estático). Criado uma vez via JS na primeira lição — evita mexer no
  // esqueleto do index.html só por causa de um badge que só existe quando
  // combo >= 2 (fica vazio/oculto o resto do tempo, ver :empty no CSS).
  function _aprGarantirComboBadge() {
    var topo = document.querySelector('#apr-tela-licao .apr-licao-topo');
    if (topo && !document.getElementById('apr-licao-combo')) {
      var el = document.createElement('div');
      el.id = 'apr-licao-combo';
      el.className = 'apr-licao-combo';
      topo.appendChild(el);
    }
    var badge = document.getElementById('apr-licao-combo');
    if (badge) badge.textContent = ''; // reseta ao abrir uma lição nova
  }

  function _aprRegistrarCombo(acertou) {
    if (!_aprLicaoAtual) return;
    _aprLicaoAtual.combo = acertou ? ((_aprLicaoAtual.combo || 0) + 1) : 0;
    _aprAtualizarComboUI();
  }

  function _aprAtualizarComboUI() {
    var el = document.getElementById('apr-licao-combo');
    if (!el) return;
    var combo = (_aprLicaoAtual && _aprLicaoAtual.combo) || 0;
    if (combo >= 2) {
      el.textContent = '🔥 Combo x' + combo;
      el.classList.remove('apr-combo-pop');
      void el.offsetWidth; // reforça a animação a cada novo acerto
      el.classList.add('apr-combo-pop');
    } else {
      el.textContent = '';
    }
  }

  /* ── Rodapé fixo dos exercícios: botão VERIFICAR → feedback → CONTINUAR.
     Um único botão troca de fase (dataset.fase) em vez de dois elementos —
     cada tipo de exercício só precisa registrar em _aprExVerificarFn como
     conferir a resposta atual (chamado na hora de Verificar) e habilitar
     o botão via _aprExHabilitarVerificar quando já houver algo pra checar.
     "parear" foge um pouco desse padrão (cada par já se autoconfere na
     hora do toque, como no Duolingo real) — usa _aprExRodapeOculto e só
     mostra o CONTINUAR quando todos os pares já foram formados. ────── */
  var _aprExVerificarFn = null;

  function _aprExHabilitarVerificar() {
    var btn = document.getElementById('apr-ex-verificar');
    if (btn && btn.dataset.fase === 'verificar') btn.disabled = false;
  }

  function _aprExOnClickRodape() {
    var btn = document.getElementById('apr-ex-verificar');
    if (!btn) return;
    if (btn.dataset.fase === 'verificar') {
      if (!_aprExVerificarFn) return;
      var acertou = !!_aprExVerificarFn();
      if (acertou) _aprLicaoAtual.acertos++;
      _aprRegistrarCombo(acertou);
      _aprMostrarFeedback(acertou);
      btn.textContent = 'Continuar';
      btn.classList.remove('apr-ex-verificar-certa', 'apr-ex-verificar-errada');
      btn.classList.add(acertou ? 'apr-ex-verificar-certa' : 'apr-ex-verificar-errada');
      btn.dataset.fase = 'continuar';
      btn.disabled = false;
    } else {
      _aprProximoExercicio();
    }
  }

  // Coruja "em repouso" no topo do exercício — varia por tipo pra dar a
  // sensação de personagem reagindo ao que está acontecendo na tela (aponta
  // pra pergunta, "pensa" na lacuna, procura os pares). Some pro estado de
  // acerto/erro em _aprMostrarFeedback.
  function _aprOwlIdle(tipo) {
    if (tipo === 'parear') return _aprSortear(['/webp/owl-search.webp', '/webp/owl-point.webp']);
    if (tipo === 'completar') return _aprSortear(['/webp/owl-idea.webp', '/webp/owl-tip.webp']);
    if (tipo === 'formar') return _aprSortear(['/webp/owl-idea.webp', '/webp/owl-point.webp']);
    return _aprSortear(['/webp/owl-point.webp', '/webp/owl-wave.webp', '/webp/owl-idea.webp']);
  }

  function _aprRenderExercicio() {
    if (!_aprLicaoAtual) return;
    _aprAtualizarBarraLicao();
    var corpo = document.getElementById('apr-exercicio-corpo');
    if (!corpo) return;
    var ex = _aprLicaoAtual.exercicios[_aprLicaoAtual.idx];
    if (!ex) { _aprConcluirLicao(); return; }
    // Personagem sempre presente: a coruja + a "bolha de fala" com a
    // instrução/pergunta ficam fixas aqui; cada tipo de exercício só
    // preenche a bolha e a área de opções abaixo. O botão VERIFICAR/
    // CONTINUAR mora em #apr-licao-rodape — irmão de #apr-exercicio-corpo,
    // fora da área que rola (ver comentário em _aprRenderEnsinar e o
    // index.html). "parear" começa com o rodapé oculto (cada par já se
    // confere sozinho no toque).
    corpo.innerHTML =
      '<div class="apr-ex-topo">' +
      '<img src="' + _aprOwlIdle(ex.tipo) + '" alt="" class="apr-ex-owl" id="apr-ex-owl" onerror="this.style.display=\'none\'">' +
      '<div class="apr-ex-bolha" id="apr-ex-bolha"></div>' +
      '</div>' +
      '<div class="apr-ex-area" id="apr-ex-area"></div>';
    var bolha = document.getElementById('apr-ex-bolha');
    var area = document.getElementById('apr-ex-area');
    _aprExVerificarFn = null;
    var rodape = document.getElementById('apr-licao-rodape');
    if (rodape) {
      rodape.classList.toggle('apr-licao-rodape-oculto', ex.tipo === 'parear');
      rodape.innerHTML = '<button type="button" class="apr-resultado-btn apr-ex-verificar" id="apr-ex-verificar" disabled>Verificar</button>';
    }
    var btnVerificar = document.getElementById('apr-ex-verificar');
    if (btnVerificar) {
      btnVerificar.dataset.fase = 'verificar';
      btnVerificar.addEventListener('click', _aprExOnClickRodape);
    }
    if (ex.tipo === 'escolha') _aprRenderEscolha(bolha, area, ex);
    else if (ex.tipo === 'completar') _aprRenderCompletar(bolha, area, ex);
    else if (ex.tipo === 'parear') _aprRenderParear(bolha, area, ex);
    else if (ex.tipo === 'formar') _aprRenderFormar(bolha, area, ex);
  }

  function _aprProximoExercicio() {
    _aprLicaoAtual.idx++;
    _aprRenderExercicio();
  }

  // Múltipla escolha (PT→EN ou EN→PT): pergunta + 4 opções, uma correta.
  // Ganha botão de áudio no lado que estiver em inglês: na pergunta quando
  // en-pt, nas opções quando pt-en (a própria _aprMontarOpcoes decide).
  function _aprRenderEscolha(bolha, area, ex) {
    var enPt = (ex.direcao === 'en-pt');
    var pergLabel = enPt ? 'Traduza para o português:' : 'Traduza para o inglês:';
    var audioPergunta = enPt ? _aprCriarBotaoAudio(ex.pergunta) : null;
    if (audioPergunta) {
      bolha.innerHTML =
        '<div class="apr-ex-instrucao">' + pergLabel + '</div>' +
        '<div class="apr-ex-pergunta-row"><div class="apr-ex-pergunta">' + ex.pergunta + '</div></div>';
      bolha.querySelector('.apr-ex-pergunta-row').appendChild(audioPergunta);
    } else {
      bolha.innerHTML =
        '<div class="apr-ex-instrucao">' + pergLabel + '</div>' +
        '<div class="apr-ex-pergunta">' + ex.pergunta + '</div>';
    }
    area.innerHTML = '<div class="apr-ex-opcoes" id="apr-ex-opcoes"></div>';
    _aprMontarOpcoes(ex.opcoes, ex.correta, /* opcoesEmIngles */ enPt);
  }

  // Completar frase: mostra a frase com a lacuna (___) destacada + opções.
  // As opções aqui são sempre palavras em inglês → sempre ganham áudio.
  function _aprRenderCompletar(bolha, area, ex) {
    var fraseHtml = ex.frase.replace('___', '<span class="apr-lacuna">___</span>');
    bolha.innerHTML =
      '<div class="apr-ex-instrucao">Complete a frase:</div>' +
      '<div class="apr-ex-pergunta apr-ex-frase">' + fraseHtml + '</div>';
    area.innerHTML = '<div class="apr-ex-opcoes" id="apr-ex-opcoes"></div>';
    _aprMontarOpcoes(ex.opcoes, ex.correta, /* opcoesEmIngles */ true);
  }

  // Monta os botões de opção (reaproveitado por escolha e completar).
  // Estilo Duolingo: tocar numa opção só SELECIONA (destaque azul) e
  // libera o botão VERIFICAR do rodapé; a conferência de verdade (travar,
  // marcar certo/errado, feedback) só roda quando o usuário toca em
  // Verificar — ver _aprExVerificarFn/_aprExOnClickRodape. opcoesEmIngles
  // controla se cada opção ganha um botão de áudio ao lado (irmão, nunca
  // aninhado — <button> não pode conter <button>).
  function _aprMontarOpcoes(opcoes, correta, opcoesEmIngles) {
    var wrap = document.getElementById('apr-ex-opcoes');
    if (!wrap) return;
    var selecionada = null;
    var comAudio = !!opcoesEmIngles && _aprSuportaAudio();
    var botoes = [];
    wrap.innerHTML = '';
    opcoes.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'apr-ex-opt';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        botoes.forEach(function (b) { b.classList.remove('apr-ex-opt-selecionada'); });
        btn.classList.add('apr-ex-opt-selecionada');
        selecionada = opt;
        _aprExHabilitarVerificar();
      });
      botoes.push(btn);
      if (comAudio) {
        var row = document.createElement('div');
        row.className = 'apr-ex-opt-row';
        row.appendChild(btn);
        var botaoAudio = _aprCriarBotaoAudio(opt);
        if (botaoAudio) row.appendChild(botaoAudio);
        wrap.appendChild(row);
      } else {
        wrap.appendChild(btn);
      }
    });
    _aprExVerificarFn = function () {
      var acertou = (selecionada === correta);
      botoes.forEach(function (b) {
        b.disabled = true;
        if (b.textContent === correta) b.classList.add('apr-certa');
        else if (b.textContent === selecionada) b.classList.add('apr-errada');
      });
      if (acertou && navigator.vibrate) { try { navigator.vibrate(35); } catch (e) {} }
      return acertou;
    };
  }

  /* ── Feedback de acerto/erro: a coruja do topo muda de cara na hora,
     a tela pisca um flash de cor forte e um banner reforça a mensagem
     no rodapé — tudo some sozinho, sem precisar de clique extra pra
     continuar. É o momento de maior "personalidade" do módulo. ────── */
  var _aprTextosCerto = ['Muito bem! 🎉', 'Isso aí! 🙌', 'Mandou bem!', 'Perfeito!', 'Você arrasou!'];
  var _aprTextosErrado = ['Quase!', 'Não foi dessa vez', 'Vamos na próxima!', 'Continue tentando!'];
  var _aprOwlsCerto = ['/webp/owl-thumbsup.webp', '/webp/owl-celebrate-pro.webp', '/webp/owl-tada.webp', '/webp/owl-love.webp'];
  var _aprOwlsErrado = ['/webp/owl-surprised.webp', '/webp/owl-angry.webp'];

  function _aprSortear(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function _aprMostrarFeedback(acertou) {
    var tela = document.getElementById('apr-tela-licao');
    if (!tela) return;
    var antigo = document.getElementById('apr-feedback-banner');
    if (antigo) antigo.remove();
    var owl = acertou ? _aprSortear(_aprOwlsCerto) : _aprSortear(_aprOwlsErrado);
    var texto = acertou ? _aprSortear(_aprTextosCerto) : _aprSortear(_aprTextosErrado);

    // A coruja-personagem no topo do exercício reage na hora.
    var owlEl = document.getElementById('apr-ex-owl');
    if (owlEl) {
      owlEl.src = owl;
      owlEl.classList.remove('apr-ex-owl-reagindo');
      void owlEl.offsetWidth; // força reflow pra reiniciar a animação
      owlEl.classList.add('apr-ex-owl-reagindo');
    }

    // Flash de cor forte na tela inteira — "cores saturadas em acerto/erro".
    tela.classList.remove('apr-tela-flash-certa', 'apr-tela-flash-errada');
    void tela.offsetWidth;
    tela.classList.add(acertou ? 'apr-tela-flash-certa' : 'apr-tela-flash-errada');
    setTimeout(function () { tela.classList.remove('apr-tela-flash-certa', 'apr-tela-flash-errada'); }, 700);

    // Banner de reforço no rodapé (cor + ícone + texto).
    var div = document.createElement('div');
    div.id = 'apr-feedback-banner';
    div.className = 'apr-feedback-banner ' + (acertou ? 'apr-feedback-certa' : 'apr-feedback-errada');
    div.innerHTML =
      '<i class="fa ' + (acertou ? 'fa-check-circle' : 'fa-times-circle') + ' apr-feedback-icone"></i>' +
      '<div class="apr-feedback-texto">' + texto + '</div>';
    tela.appendChild(div);
    setTimeout(function () { div.classList.add('apr-feedback-saindo'); }, 650);
    setTimeout(function () { if (div && div.parentNode) div.remove(); }, 900);
  }

  // Parear: duas colunas (PT embaralhado / EN embaralhado). Toca uma
  // palavra de cada coluna pra formar o par; certo trava em verde,
  // errado pisca vermelho e libera pra tentar de novo.
  function _aprEmbaralhar(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function _aprRenderParear(bolha, area, ex) {
    var esquerda = _aprEmbaralhar(ex.pares.map(function (p) { return p[0]; }));
    var direita = _aprEmbaralhar(ex.pares.map(function (p) { return p[1]; }));
    var mapaCorreto = {};
    ex.pares.forEach(function (p) { mapaCorreto[p[0]] = p[1]; });

    bolha.innerHTML = '<div class="apr-ex-instrucao">Toque para formar os pares:</div>';
    area.innerHTML =
      '<div class="apr-par-colunas">' +
      '<div class="apr-par-col" id="apr-par-esq"></div>' +
      '<div class="apr-par-col" id="apr-par-dir"></div>' +
      '</div>';

    var colEsq = document.getElementById('apr-par-esq');
    var colDir = document.getElementById('apr-par-dir');
    var selEsq = null;   // { valor, el }
    var matched = 0;
    var total = ex.pares.length;

    // Item simples (coluna esquerda, português — sem áudio).
    function criarItem(valor) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'apr-par-item';
      b.textContent = valor;
      return b;
    }

    // Item com botão de áudio ao lado (coluna direita, inglês). O botão é
    // IRMÃO do item numa div wrapper, nunca filho dele.
    function criarItemComAudio(valor) {
      var b = criarItem(valor);
      var botaoAudio = _aprCriarBotaoAudio(valor);
      if (!botaoAudio) return { el: b, btn: b };
      var row = document.createElement('div');
      row.className = 'apr-par-item-row';
      row.appendChild(b);
      row.appendChild(botaoAudio);
      return { el: row, btn: b };
    }

    esquerda.forEach(function (valor) {
      var b = criarItem(valor);
      b.addEventListener('click', function () {
        if (b.classList.contains('apr-par-certa') || b.disabled) return;
        if (selEsq) selEsq.el.classList.remove('apr-par-selecionada');
        selEsq = { valor: valor, el: b };
        b.classList.add('apr-par-selecionada');
      });
      colEsq.appendChild(b);
    });

    direita.forEach(function (valor) {
      var item = criarItemComAudio(valor);
      var b = item.btn;
      b.addEventListener('click', function () {
        if (!selEsq || b.classList.contains('apr-par-certa')) return;
        var certo = (mapaCorreto[selEsq.valor] === valor);
        if (certo) {
          selEsq.el.classList.remove('apr-par-selecionada');
          selEsq.el.classList.add('apr-par-certa'); selEsq.el.disabled = true;
          b.classList.add('apr-par-certa'); b.disabled = true;
          matched++;
          selEsq = null;
          if (matched >= total) {
            // "parear" já se autoconfere par a par (como no Duolingo real);
            // ao formar o último par, só revela o CONTINUAR do rodapé —
            // sem pular sozinho pro próximo exercício.
            _aprLicaoAtual.acertos++; // conta o exercício de parear como 1 acerto
            _aprRegistrarCombo(true);
            _aprMostrarFeedback(true);
            var rodapePar = document.getElementById('apr-licao-rodape');
            var btnPar = document.getElementById('apr-ex-verificar');
            if (rodapePar) rodapePar.classList.remove('apr-licao-rodape-oculto');
            if (btnPar) {
              btnPar.textContent = 'Continuar';
              btnPar.disabled = false;
              btnPar.dataset.fase = 'continuar';
              btnPar.classList.add('apr-ex-verificar-certa');
            }
          }
        } else {
          b.classList.add('apr-par-errada');
          var elEsq = selEsq.el;
          elEsq.classList.add('apr-par-errada');
          setTimeout(function () {
            b.classList.remove('apr-par-errada');
            elEsq.classList.remove('apr-par-errada', 'apr-par-selecionada');
          }, 420);
          selEsq = null;
        }
      });
      colDir.appendChild(item.el);
    });
  }

  // "Formar a frase": mostra a frase em inglês (com áudio) e um banco de
  // palavras em português embaralhadas (as certas + distratores); o
  // usuário toca as palavras na ordem certa pra montar a tradução numa
  // área de montagem separada. Toca de novo numa palavra já montada pra
  // devolvê-la ao banco. ex = { tipo:'formar', en, partes:[...], distratores:[...] }
  // — content design garante palavras sem repetição dentro do mesmo
  // exercício, então comparar por texto (sem precisar rastrear instância
  // por instância) é seguro.
  function _aprRenderFormar(bolha, area, ex) {
    var partes = ex.partes || [];
    var todas = _aprEmbaralhar(partes.concat(ex.distratores || []));
    var montagem = []; // palavras já colocadas na área de montagem, na ordem
    var audioPergunta = _aprCriarBotaoAudio(ex.en);

    bolha.innerHTML =
      '<div class="apr-ex-instrucao">Monte a frase em português:</div>' +
      '<div class="apr-ex-pergunta-row"><div class="apr-ex-pergunta apr-ex-frase">' + ex.en + '</div></div>';
    if (audioPergunta) bolha.querySelector('.apr-ex-pergunta-row').appendChild(audioPergunta);

    area.innerHTML =
      '<div class="apr-formar-montagem apr-formar-vazio" id="apr-formar-montagem"></div>' +
      '<div class="apr-formar-banco" id="apr-formar-banco"></div>';
    var montEl = document.getElementById('apr-formar-montagem');
    var bancoEl = document.getElementById('apr-formar-banco');

    function atualizarVazio() {
      montEl.classList.toggle('apr-formar-vazio', montagem.length === 0);
    }

    function criarChipBanco(palavra) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'apr-formar-chip';
      chip.textContent = palavra;
      chip.addEventListener('click', function () {
        if (chip.disabled) return;
        chip.disabled = true;
        chip.classList.add('apr-formar-chip-usado');
        montagem.push(palavra);
        var chipMontada = document.createElement('button');
        chipMontada.type = 'button';
        chipMontada.className = 'apr-formar-chip apr-formar-chip-montada';
        chipMontada.textContent = palavra;
        chipMontada.addEventListener('click', function () {
          if (chipMontada.disabled) return;
          montEl.removeChild(chipMontada);
          chip.disabled = false;
          chip.classList.remove('apr-formar-chip-usado');
          var pos = montagem.lastIndexOf(palavra);
          if (pos !== -1) montagem.splice(pos, 1);
          atualizarVazio();
          if (!montagem.length) document.getElementById('apr-ex-verificar').disabled = true;
        });
        montEl.appendChild(chipMontada);
        atualizarVazio();
        _aprExHabilitarVerificar();
      });
      return chip;
    }

    todas.forEach(function (palavra) { bancoEl.appendChild(criarChipBanco(palavra)); });

    _aprExVerificarFn = function () {
      var certo = montagem.length === partes.length && montagem.every(function (p, i) { return p === partes[i]; });
      bancoEl.querySelectorAll('.apr-formar-chip').forEach(function (c) { c.disabled = true; });
      montEl.querySelectorAll('.apr-formar-chip').forEach(function (c) { c.disabled = true; });
      montEl.classList.add(certo ? 'apr-formar-certa' : 'apr-formar-errada');
      if (!certo) {
        var correta = document.createElement('div');
        correta.className = 'apr-formar-correta';
        correta.textContent = 'Resposta certa: ' + partes.join(' ');
        area.appendChild(correta);
      }
      return certo;
    };
  }

  // Formata a duração da lição pro card de resultado: "42s" ou "2m 05s".
  function _aprFormatarDuracao(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), r = s % 60;
    return m + 'm ' + String(r).padStart(2, '0') + 's';
  }

  /* ── Conclusão da lição: grava XP/ofensiva e mostra resultado ── */
  function _aprConcluirLicao() {
    var unidadeId = _aprLicaoAtual.unidadeId, licaoId = _aprLicaoAtual.licaoId;
    var en = _aprEstado.en;
    var prog = en.units[unidadeId] || (en.units[unidadeId] = { completedLessons: [], xp: 0 });
    var jaFeita = prog.completedLessons.indexOf(licaoId) !== -1;
    if (!jaFeita) {
      prog.completedLessons.push(licaoId);
      prog.xp = (prog.xp || 0) + APR_XP_POR_LICAO;
      en.totalXp = (en.totalXp || 0) + APR_XP_POR_LICAO;
    }
    var subiu = _aprRegistrarStreak(en);
    _aprSalvarLocal();
    _aprSalvarNuvem();

    var total = _aprLicaoAtual.exercicios.length;
    var acertos = Math.min(_aprLicaoAtual.acertos, total);
    var pct = total ? acertos / total : 1;
    var owl, titulo;
    if (pct >= 1) {
      owl = _aprSortear(['/webp/owl-trophy.webp', '/webp/owl-celebrate-flying.webp']);
      titulo = _aprSortear(['Perfeito! 🏆', 'Mandou muito bem!', 'Você arrasou!', 'Impecável!']);
    } else if (pct >= 0.8) {
      owl = _aprSortear(['/webp/owl-celebrate-pro.webp', '/webp/owl-tada.webp']);
      titulo = _aprSortear(['Muito bem!', 'Ótimo trabalho!', 'Mandou bem!']);
    } else if (pct >= 0.4) {
      owl = '/webp/owl-thumbsup.webp';
      titulo = _aprSortear(['Lição concluída!', 'Você está indo bem!', 'Continue assim!']);
    } else {
      owl = '/webp/owl-idea.webp';
      titulo = _aprSortear(['Lição concluída!', 'Cada passo conta!', 'Vamos praticar mais!']);
    }

    var pctTexto = Math.round(pct * 100) + '%';
    var duracaoTexto = _aprFormatarDuracao(Date.now() - (_aprLicaoAtual.inicio || Date.now()));

    var corpo = document.getElementById('apr-tela-resultado');
    if (corpo) {
      corpo.innerHTML =
        (pct >= 0.8 ? _aprConfeteHtml() : '') +
        '<img src="' + owl + '" alt="" class="apr-resultado-owl" onerror="this.style.display=\'none\'">' +
        '<div class="apr-resultado-eyebrow">Lição concluída!</div>' +
        '<h2 class="apr-resultado-titulo">' + titulo + '</h2>' +
        '<div class="apr-resultado-stats">' +
        '<div class="apr-resultado-stat apr-resultado-xp"><span>⭐</span>' + (jaFeita ? '+0' : ('+' + APR_XP_POR_LICAO)) + ' XP</div>' +
        '<div class="apr-resultado-stat"><span>🎯</span>' + pctTexto + '</div>' +
        '<div class="apr-resultado-stat"><span>⏱️</span>' + duracaoTexto + '</div>' +
        (subiu ? '<div class="apr-resultado-stat"><span>🔥</span>' + en.streak + (en.streak === 1 ? ' dia' : ' dias') + '</div>' : '') +
        '</div>' +
        '<button type="button" class="apr-resultado-btn" id="apr-resultado-continuar">' + (jaFeita ? 'Continuar' : 'Receber XP 🎉') + '</button>';
      var btn = document.getElementById('apr-resultado-continuar');
      if (btn) btn.addEventListener('click', function () {
        _aprLicaoAtual = null;
        _aprRenderStats();
        _aprAbrirUnidade(unidadeId);
      });
    }
    _aprMostrarTela('resultado');
  }

  // Confete simples em CSS puro (sem lib): uma dezena de tarjetas coloridas
  // caindo com posição/cor/atraso aleatórios. Só aparece em lições muito
  // bem-sucedidas (pct >= 0.8) pra manter especial a sensação de conquista.
  var APR_CONFETE_CORES = ['#38bdf8', '#22c55e', '#fbbf24', '#a855f7', '#fb923c', '#f472b6'];
  function _aprConfeteHtml() {
    var pecas = '';
    for (var i = 0; i < 22; i++) {
      var esquerda = Math.round(Math.random() * 100);
      var atraso = (Math.random() * 0.35).toFixed(2);
      var cor = APR_CONFETE_CORES[i % APR_CONFETE_CORES.length];
      var giro = Math.round(Math.random() * 360);
      pecas += '<span class="apr-confete" style="left:' + esquerda + '%;background:' + cor +
        ';animation-delay:' + atraso + 's;transform:rotate(' + giro + 'deg)"></span>';
    }
    return '<div class="apr-confete-wrap" aria-hidden="true">' + pecas + '</div>';
  }
