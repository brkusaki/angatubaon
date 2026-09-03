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
  function _aprMostrarTela(nome) {
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
    var html = '';
    unidades.forEach(function (u, idx) {
      var prog = _aprProgressoUnidade(u.id);
      var total = u.licoes.length;
      var feitas = u.licoes.filter(function (l) { return prog.completedLessons.indexOf(l.id) !== -1; }).length;
      var desbloqueada = _aprUnidadeDesbloqueada(idx);
      var completa = feitas === total;
      html += '<button type="button" class="apr-unidade-card' +
        (desbloqueada ? '' : ' apr-unidade-bloqueada') +
        (completa ? ' apr-unidade-completa' : '') +
        '" data-unidade="' + u.id + '"' + (desbloqueada ? '' : ' disabled aria-disabled="true"') + '>' +
        '<div class="apr-unidade-icone">' + (desbloqueada ? u.icone : '<i class="fa fa-lock"></i>') + '</div>' +
        '<div class="apr-unidade-corpo">' +
        '<div class="apr-unidade-titulo">' + u.titulo + '</div>' +
        '<div class="apr-unidade-sub">' + feitas + '/' + total + ' lições' + (completa ? ' · concluída ✓' : '') + '</div>' +
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

  function _aprAbrirUnidade(unidadeId) {
    var unidade = _aprUnidade(unidadeId);
    if (!unidade) return;
    _aprUnidadeAtualId = unidadeId;
    var idxUnidade = _aprUnidades().indexOf(unidade);
    var prog = _aprProgressoUnidade(unidadeId);

    var head = document.getElementById('apr-unidade-head');
    if (head) {
      head.innerHTML = '<div class="apr-unidade-head-icone">' + unidade.icone + '</div>' +
        '<h2 class="apr-unidade-head-titulo">' + unidade.titulo + '</h2>';
    }
    var lista = document.getElementById('apr-lista-licoes');
    if (lista) {
      var html = '';
      unidade.licoes.forEach(function (l, idx) {
        var feita = prog.completedLessons.indexOf(l.id) !== -1;
        var desbloqueada = _aprLicaoDesbloqueada(unidade, idxUnidade, idx);
        html += '<button type="button" class="apr-licao-item' +
          (feita ? ' apr-licao-feita' : '') + (desbloqueada ? '' : ' apr-licao-bloqueada') +
          '" data-licao="' + l.id + '"' + (desbloqueada ? '' : ' disabled aria-disabled="true"') + '>' +
          '<div class="apr-licao-bolha">' + (feita ? '<i class="fa fa-check"></i>' : (desbloqueada ? (idx + 1) : '<i class="fa fa-lock"></i>')) + '</div>' +
          '<div class="apr-licao-titulo">' + l.titulo + '</div>' +
          (feita ? '<i class="fa fa-star apr-licao-star"></i>' : '') +
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
    _aprLicaoAtual = { unidadeId: unidadeId, licaoId: licaoId, exercicios: licao.exercicios, idx: 0, acertos: 0 };
    _aprMostrarTela('licao');
    _aprRenderExercicio();
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

  function _aprRenderExercicio() {
    if (!_aprLicaoAtual) return;
    _aprAtualizarBarraLicao();
    var corpo = document.getElementById('apr-exercicio-corpo');
    if (!corpo) return;
    var ex = _aprLicaoAtual.exercicios[_aprLicaoAtual.idx];
    if (!ex) { _aprConcluirLicao(); return; }
    if (ex.tipo === 'escolha') _aprRenderEscolha(corpo, ex);
    else if (ex.tipo === 'completar') _aprRenderCompletar(corpo, ex);
    else if (ex.tipo === 'parear') _aprRenderParear(corpo, ex);
  }

  function _aprProximoExercicio() {
    _aprLicaoAtual.idx++;
    _aprRenderExercicio();
  }

  // Múltipla escolha (PT→EN ou EN→PT): pergunta + 4 opções, uma correta.
  function _aprRenderEscolha(corpo, ex) {
    var pergLabel = (ex.direcao === 'en-pt') ? 'Traduza para o português:' : 'Traduza para o inglês:';
    corpo.innerHTML =
      '<div class="apr-ex-instrucao">' + pergLabel + '</div>' +
      '<div class="apr-ex-pergunta">' + ex.pergunta + '</div>' +
      '<div class="apr-ex-opcoes" id="apr-ex-opcoes"></div>';
    _aprMontarOpcoes(ex.opcoes, ex.correta);
  }

  // Completar frase: mostra a frase com a lacuna (___) destacada + opções.
  function _aprRenderCompletar(corpo, ex) {
    var fraseHtml = ex.frase.replace('___', '<span class="apr-lacuna">___</span>');
    corpo.innerHTML =
      '<div class="apr-ex-instrucao">Complete a frase:</div>' +
      '<div class="apr-ex-pergunta apr-ex-frase">' + fraseHtml + '</div>' +
      '<div class="apr-ex-opcoes" id="apr-ex-opcoes"></div>';
    _aprMontarOpcoes(ex.opcoes, ex.correta);
  }

  // Monta os botões de opção (reaproveitado por escolha e completar) e
  // trata o clique: trava, marca certo/errado, avança após um instante —
  // mesmo padrão do Quiz da Coruja (ver _quizResponder em Jogos/hub.js).
  function _aprMontarOpcoes(opcoes, correta) {
    var wrap = document.getElementById('apr-ex-opcoes');
    if (!wrap) return;
    var travado = false;
    wrap.innerHTML = '';
    opcoes.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'apr-ex-opt';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        if (travado) return;
        travado = true;
        var acertou = (opt === correta);
        if (acertou) _aprLicaoAtual.acertos++;
        var botoes = wrap.querySelectorAll('.apr-ex-opt');
        botoes.forEach(function (b) {
          b.disabled = true;
          if (b.textContent === correta) b.classList.add('apr-certa');
          else if (b === btn) b.classList.add('apr-errada');
        });
        if (acertou && navigator.vibrate) { try { navigator.vibrate(35); } catch (e) {} }
        setTimeout(_aprProximoExercicio, 1000);
      });
      wrap.appendChild(btn);
    });
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

  function _aprRenderParear(corpo, ex) {
    var esquerda = _aprEmbaralhar(ex.pares.map(function (p) { return p[0]; }));
    var direita = _aprEmbaralhar(ex.pares.map(function (p) { return p[1]; }));
    var mapaCorreto = {};
    ex.pares.forEach(function (p) { mapaCorreto[p[0]] = p[1]; });

    corpo.innerHTML =
      '<div class="apr-ex-instrucao">Toque para formar os pares:</div>' +
      '<div class="apr-par-colunas">' +
      '<div class="apr-par-col" id="apr-par-esq"></div>' +
      '<div class="apr-par-col" id="apr-par-dir"></div>' +
      '</div>';

    var colEsq = document.getElementById('apr-par-esq');
    var colDir = document.getElementById('apr-par-dir');
    var selEsq = null;   // { valor, el }
    var matched = 0;
    var total = ex.pares.length;

    function criarItem(valor) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'apr-par-item';
      b.textContent = valor;
      return b;
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
      var b = criarItem(valor);
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
            _aprLicaoAtual.acertos++; // conta o exercício de parear como 1 acerto
            setTimeout(_aprProximoExercicio, 700);
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
      colDir.appendChild(b);
    });
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
    var owl = pct >= 0.8 ? '/webp/owl-celebrate-pro.webp' : (pct >= 0.4 ? '/webp/owl-thumbsup.webp' : '/webp/owl-idea.webp');

    var corpo = document.getElementById('apr-tela-resultado');
    if (corpo) {
      corpo.innerHTML =
        '<img src="' + owl + '" alt="" class="apr-resultado-owl" onerror="this.style.display=\'none\'">' +
        '<h2 class="apr-resultado-titulo">Lição concluída!</h2>' +
        '<div class="apr-resultado-stats">' +
        '<div class="apr-resultado-stat"><span>⭐</span>' + (jaFeita ? '+0' : ('+' + APR_XP_POR_LICAO)) + ' XP</div>' +
        (subiu ? '<div class="apr-resultado-stat"><span>🔥</span>' + en.streak + (en.streak === 1 ? ' dia' : ' dias') + '</div>' : '') +
        '</div>' +
        '<button type="button" class="apr-resultado-btn" id="apr-resultado-continuar">Continuar</button>';
      var btn = document.getElementById('apr-resultado-continuar');
      if (btn) btn.addEventListener('click', function () {
        _aprLicaoAtual = null;
        _aprRenderStats();
        _aprAbrirUnidade(unidadeId);
      });
    }
    _aprMostrarTela('resultado');
  }
