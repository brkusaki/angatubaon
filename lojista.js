'use strict';
/* ══════════════════════════════════════════════════════════════
   LOJISTA — cadastro de loja, planos e Mercado Pago, login da loja
   (WhatsApp + código), painel Minha Loja e cardápio do dono. Saiu do
   app.js para não pesar o boot de quem só procura loja: o app.js carrega
   este arquivo sob demanda (ver "LOJISTA SOB DEMANDA" lá). Roda no MESMO
   escopo global do app.js (script clássico): usa direto _lojaToken,
   apiPost, LOJAS, showToastSimples etc. — e só roda DEPOIS dele.
   Os trechos estão na mesma ordem em que ficavam no app.js.
   Build: npm run build gera lojista.min.js. Funções daqui chamadas de
   fora têm stub com o mesmo nome no app.js.
══════════════════════════════════════════════════════════════ */

  /* ── Modal Cadastro ──────────────────────────────────────── */
  function openModal() {
    // Abre direto no cadastro — plano é escolhido na etapa 3
    openCadastroModal();
  }

  function openCadastroModal() {
    const overlay = document.getElementById('modal-cadastro');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Fix #6: entrada no histórico para o botão "voltar" (Android) fechar o modal
    if (history.state?.modal !== 'cadastro') history.pushState({ modal: 'cadastro' }, '');
    // Garante que começa na etapa 1
    cadIrParaEtapa(1);
    // Garante preços coerentes com o ciclo atual (default mensal)
    if (typeof cadAtualizarPrecos === 'function') cadAtualizarPrecos();
  }

  function closeModal(viaPopstate) {
    const overlay = document.getElementById('modal-cadastro');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Fix #6: desfaz a entrada do histórico ao fechar manualmente (popstate já consumiu)
    if (!viaPopstate && history.state?.modal === 'cadastro') { _popstateNosso = true; history.back(); }
    // Reseta tela de sucesso após fechar (com delay para não piscar)
    setTimeout(() => {
      document.getElementById('cadastro-form').style.display = 'flex';
      document.getElementById('cadastro-success').classList.remove('show');
      document.getElementById('cadastro-success').querySelector('.success-wpp-btn')?.remove();
      document.getElementById('cadastro-form').reset();
      // Reseta o estado do toggle de agendamento (form.reset desmarca o checkbox,
      // mas o visual do switch/nota/botão precisa ser re-sincronizado) e a flag
      // de horário-tocado, para o próximo cadastro começar limpo.
      _schedTouched = false;
      if (typeof window.cadToggleAgendamento === 'function') window.cadToggleAgendamento(false);
      // Garante que o botão de submit está habilitado (pode ter ficado preso se modal foi fechado durante envio)
      const btn = document.querySelector('#cadastro-form .modal-submit');
      if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
      // Reinicia o schedule builder visualmente
      scheduleTurnos = [{ dias: [1,2,3,4,5], abre: '08:00', fecha: '18:00' }];
      renderScheduleCards();
      syncHiddenFields();
      // Reseta campos de foto/logo
      ['foto', 'logo'].forEach(k => {
        const previewWrap = document.getElementById(k + '-preview-wrap');
        const previewImg  = document.getElementById(k + '-preview-img');
        const statusEl    = document.getElementById(k + '-upload-status');
        const hiddenUrl   = document.getElementById('f-' + k + '-url');
        if (previewWrap) previewWrap.style.display = 'none';
        if (previewImg)  previewImg.src = '';
        if (statusEl)    statusEl.textContent = '';
        if (hiddenUrl)   hiddenUrl.value = '';
      });
      // Reseta aviso de foto e plano selecionado
      const avisoEl = document.getElementById('cad-foto-aviso');
      if (avisoEl) avisoEl.style.display = 'none';
      selectedPlan = 'GRATIS';
      cadIrParaEtapa(1);
      // Reseta campo de ramo autocomplete
      if (typeof ramoReset === 'function') ramoReset();
    }, 300);
  }

  // Fecha ao clicar no overlay (fora do sheet)
  document.getElementById('modal-cadastro').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  /* ── Modal de Planos ─────────────────────────────────────── */
  let selectedPlan = 'GRATIS';
  // A1: quando true, modal-planos foi aberto a partir do painel (loja já
  // logada, querendo upgrade) em vez do fluxo de cadastro. Muda o que o
  // CTA principal faz ao confirmar — ver confirmPlan().
  let _planosCtxPainel = false;

  /* ── Ciclos de cobrança e preços ──────────────────────────────
     Base mensal: Plus R$29,90 · Pro R$49,90.
     Trimestral: -10%.  Anual: paga 10 meses (≈ -17%, "2 meses grátis").
     Tudo calculado a partir do mensal pra ficar fácil ajustar depois. */
  const PLANO_MENSAL = { PLUS: 29.90, PRO: 49.90 };
  const CICLOS = {
    mensal:     { meses: 1,  rotulo: 'Mensal',     fator: 1,    selo: '' },
    trimestral: { meses: 3,  rotulo: 'Trimestral', fator: 0.90, selo: '-10%' },
    anual:      { meses: 12, rotulo: 'Anual',      fator: null, selo: '2 meses grátis' }, // fator null = paga 10
  };
  let _cicloSelecionado = 'mensal';

  // Retorna { total, porMes, economia } de um plano pago num ciclo.
  function calcPreco(plano, ciclo) {
    const base = PLANO_MENSAL[plano];
    if (!base) return null;
    const c = CICLOS[ciclo] || CICLOS.mensal;
    let total;
    if (ciclo === 'anual') {
      total = base * 10;            // paga 10, leva 12
    } else {
      total = base * c.meses * c.fator;
    }
    const cheio   = base * c.meses; // o que custaria sem desconto
    const porMes  = total / c.meses;
    const economia = cheio - total;
    return { total, porMes, economia, meses: c.meses };
  }

  // Formata número como moeda BRL (R$ 1.234,56)
  function fmtBRL(v) {
    return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* ── Pagamento Mercado Pago ────────────────────────────────────
     Chama o backend para criar a preference e redireciona o usuário
     para o checkout do Mercado Pago. O valor é calculado no servidor. */
  async function iniciarPagamentoMP(wpp, plano, ciclo, btnEl) {
    const labelOrig = btnEl ? btnEl.innerHTML : '';
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="ti ti-loader-2"></i> Gerando pagamento…'; }
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'criarPreferenciaMP',
        wpp:    (() => { let n = String(wpp || '').replace(/\D/g, ''); return n && !n.startsWith('55') ? '55' + n : n; })(),
        plano:  plano,
        ciclo:  ciclo || 'mensal',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body:   params,
        signal: AbortSignal.timeout(20000),
      });
      const json = await resp.json();
      if (json.status !== 'ok' || !json.data || !json.data.initPoint) {
        throw new Error((json && json.msg) || 'Não foi possível gerar o pagamento');
      }
      // Redireciona para o checkout do Mercado Pago
      window.location.href = json.data.initPoint;
    } catch (err) {
      if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = labelOrig; }
      mlAviso('Não foi possível gerar o pagamento',
              (err.message || 'Tente novamente.') + '\n\nVocê também pode ativar pelo WhatsApp no botão abaixo.',
              '/webp/owl-sign.webp');
    }
  }
  window.iniciarPagamentoMP = iniciarPagamentoMP;

  /* ── Polling do plano após pagamento aprovado ─────────────────
     Consulta lojaDados em intervalos crescentes. Para assim que detectar
     plano != GRATIS (webhook processou) ou após esgotar as tentativas. */
  let _pollPlanoTimers = [];
  function pararPollingPlano() {
    _pollPlanoTimers.forEach(t => clearTimeout(t));
    _pollPlanoTimers = [];
  }
  function iniciarPollingPlano() {
    const token = localStorage.getItem('angatuba_loja_token');
    if (!token) return; // só faz sentido com loja logada
    pararPollingPlano();
    const atrasos = [3000, 7000, 13000, 22000]; // ~45s no total
    atrasos.forEach(ms => {
      const t = setTimeout(async () => {
        try {
          const json = await apiPost('lojaDados', { token }, { timeout: 10000, ignoreUnauthorized: true });
          if (json && json.status === 'ok' && json.data) {
            const plano = (json.data.plano || 'GRATIS').toUpperCase();
            // Atualiza o cache sempre (mantém painel fresco)
            try { localStorage.setItem('angatuba_loja_dados', JSON.stringify(json.data)); } catch(e) {}
            if (plano !== 'GRATIS') {
              pararPollingPlano();
              // Atualiza o badge ao vivo se o painel estiver aberto
              if (typeof _aplicarBadgePlano === 'function') _aplicarBadgePlano(plano);
              const overlay = document.getElementById('modal-minha-loja');
              if (overlay && overlay.classList.contains('open') && typeof _aplicarDadosLoja === 'function') {
                _aplicarDadosLoja(json.data, null, true);
                if (typeof mlCardapioCarregar === 'function') mlCardapioCarregar(plano);
              }
            }
          }
        } catch(e) { /* silencioso — é só um upgrade de UX */ }
      }, ms);
      _pollPlanoTimers.push(t);
    });
  }
  window.iniciarPollingPlano = iniciarPollingPlano;

  /* ── Polling de aprovação pós-cadastro ────────────────────────
     Após o cadastro (ou ao reabrir o app com cadastro pendente), verifica
     periodicamente se a loja foi aprovada. Enquanto aguarda, mostra a tela
     "Aguardando aprovação" (coruja analisando). Quando aprovada, troca para a
     coruja de celebração do plano, faz login automático e abre Minha Loja. */
  let _pollAprovTimers = [];
  function pararPollingAprovacao() {
    _pollAprovTimers.forEach(t => clearTimeout(t));
    _pollAprovTimers = [];
  }

  // Aplica o login e transição visual quando a loja é aprovada.
  function _aoAprovar(wpp, data) {
    // Plano escolhido no cadastro (a loja entra no Grátis até pagar).
    const planoPend = String(localStorage.getItem('angatuba_pendente_plano') || 'GRATIS').toUpperCase();
    const cicloPend = localStorage.getItem('angatuba_pendente_ciclo') || 'mensal';
    pararPollingAprovacao();
    localStorage.removeItem('angatuba_pendente_wpp');
    localStorage.removeItem('angatuba_pendente_plano');
    localStorage.removeItem('angatuba_pendente_ciclo');
    _lojaToken = data.token;
    _lojaNome  = data.nome || '';
    localStorage.setItem('angatuba_loja_token', _lojaToken);
    localStorage.setItem('angatuba_loja_nome',  _lojaNome);
    localStorage.setItem('angatuba_loja_wpp',   wpp);
    _lojaWpp = wpp; // Fix onboarding: sem isto a flag por-loja não resolvia no fluxo de aprovação
    atualizarNav();

    const aguardando = document.getElementById('modal-aguardando');
    const aguardandoAberto = aguardando && aguardando.classList.contains('open');

    if (aguardandoAberto) {
      // Transição comemorativa: troca a coruja analisando pela de celebração
      // do plano e mostra "Aprovado!" por ~1,6s antes de abrir o painel.
      const plano = (data.plano || 'GRATIS').toUpperCase();
      const owlMap = { GRATIS: 'gratis', PLUS: 'plus', PRO: 'pro' };
      const owlEl = document.getElementById('aguardando-owl');
      if (owlEl) {
        owlEl.dataset.failed = '';
        owlEl.style.display = '';
        owlEl.src = `/webp/owl-celebrate-${owlMap[plano] || 'gratis'}.webp`;
      }
      const bigEl = document.getElementById('aguardando-title-big');
      if (bigEl) bigEl.innerHTML = 'Sua loja está no ar! 🎉';
      const subEl = document.getElementById('aguardando-sub');
      if (subEl) subEl.innerHTML = 'Tudo certo! Estamos abrindo a sua loja…';
      const statusEl = document.getElementById('aguardando-status');
      if (statusEl) statusEl.classList.add('aprovado');
      const statusTxt = document.getElementById('aguardando-status-text');
      if (statusTxt) statusTxt.textContent = 'Acesso liberado';
      const acoesEl = document.getElementById('aguardando-acoes');
      const hintEl = document.getElementById('aguardando-hint');
      if (hintEl) hintEl.style.display = 'none';
      const titEl = document.getElementById('aguardando-title');
      if (titEl) titEl.innerHTML = 'Pronto! <span>🎊</span>';

      // Escolheu Plus/Pro: a loja já está no ar no Grátis; mantém os botões
      // de pagamento na tela (o plano ativa sozinho quando o pagamento cair).
      if (planoPend === 'PLUS' || planoPend === 'PRO') {
        if (subEl) subEl.innerHTML = `Sua loja já aparece no app. <strong>Ative o Plano ${planoPend}</strong> pagando agora — ele entra sozinho assim que o pagamento for aprovado:`;
        if (acoesEl) {
          acoesEl.innerHTML = '';
          const payBtn = document.createElement('button');
          payBtn.type = 'button'; payBtn.className = 'success-pay-btn';
          payBtn.innerHTML = '<i class="ti ti-credit-card"></i> Pagar e ativar o ' + planoPend + ' →';
          payBtn.onclick = () => iniciarPagamentoMP(wpp, planoPend, cicloPend, payBtn);
          acoesEl.appendChild(payBtn);
          const verBtn = document.createElement('button');
          verBtn.type = 'button'; verBtn.className = 'success-wpp-btn';
          verBtn.textContent = 'Ver minha loja agora';
          verBtn.onclick = () => {
            if (history.state?.modal === 'aguardando') history.replaceState({ modal: 'minha-loja' }, '');
            fecharAguardando(true);
            setTimeout(() => abrirMinhaLoja(), 250);
          };
          acoesEl.appendChild(verBtn);
        }
        return;
      }
      if (acoesEl) acoesEl.innerHTML = '';

      setTimeout(() => {
        if (history.state?.modal === 'aguardando') history.replaceState({ modal: 'minha-loja' }, '');
        fecharAguardando(true);
        setTimeout(() => abrirMinhaLoja(), 250);
      }, 1600);
    } else {
      // App não estava na tela de aguardando (ex.: ainda no modal de cadastro,
      // ou aprovação detectada em background). Fecha o cadastro se aberto e abre.
      const modalCad = document.getElementById('modal-cadastro');
      if (modalCad && modalCad.classList.contains('open')) closeModal(false);
      setTimeout(() => abrirMinhaLoja(), 400);
    }
  }

  function iniciarPollingAprovacao(wpp) {
    if (!wpp) return;
    pararPollingAprovacao();
    const INTERVALO_MS = 20000;            // 20s entre checagens
    const PRIMEIRA_MS  = 1500;             // 1ª checagem quase imediata
    const MAX_TENTATIVAS = 90;             // ~30 min de espera
    let tentativa = 0;
    function tentar() {
      if (_lojaToken) { pararPollingAprovacao(); return; }
      tentativa++;
      if (tentativa > MAX_TENTATIVAS) { pararPollingAprovacao(); return; }
      const delay = (tentativa === 1) ? PRIMEIRA_MS : INTERVALO_MS;
      const t = setTimeout(async () => {
        if (_lojaToken) { pararPollingAprovacao(); return; }
        try {
          const params = new URLSearchParams();
          let claim = '';
          try { claim = localStorage.getItem('angatuba_pendente_claim') || ''; } catch (e) {}
          params.append('payload', JSON.stringify({ action: 'lojaVerificarAprovacao', wpp, claim }));
          const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST', body: params,
            signal: AbortSignal.timeout(20000),
          });
          const json = await resp.json();
          const stAprov = json && json.data && json.data.status;
          if (json.status === 'ok' && json.data && json.data.token) {
            try { localStorage.removeItem('angatuba_pendente_claim'); } catch (e) {}
            _aoAprovar(wpp, json.data);
          } else if (stAprov === 'REJEITADO' || stAprov === 'SEM_CLAIM') {
            // Sem auto-login possível: para o polling e explica o próximo passo.
            pararPollingAprovacao();
            const rejeitado = stAprov === 'REJEITADO';
            if (!rejeitado) {
              // Cadastro antigo (sem segredo): segue em análise, entra pelo login.
              ['angatuba_pendente_wpp','angatuba_pendente_plano','angatuba_pendente_ciclo','angatuba_pendente_claim']
                .forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
            }
            const bigEl = document.getElementById('aguardando-title-big');
            const subEl = document.getElementById('aguardando-sub');
            const stTxt = document.getElementById('aguardando-status-text');
            const acoes = document.getElementById('aguardando-acoes');
            const hint  = document.getElementById('aguardando-hint');
            if (hint) hint.style.display = 'none';
            if (rejeitado) {
              if (bigEl) bigEl.innerHTML = 'Cadastro não aprovado';
              if (subEl) subEl.innerHTML = 'Não conseguimos aprovar este cadastro. Fale com a gente no WhatsApp para entender o motivo — depois você pode se cadastrar de novo com o mesmo número.';
              if (stTxt) stTxt.textContent = 'Não aprovado';
              if (acoes) {
                acoes.innerHTML = '';
                const a = document.createElement('a');
                a.className = 'success-wpp-btn'; a.target = '_blank'; a.rel = 'noopener';
                a.href = `https://wa.me/${ADMIN_WPP_CONTATO}?text=${encodeURIComponent('Olá! Meu cadastro no AngatubaON não foi aprovado. Pode me explicar o motivo?')}`;
                a.innerHTML = '<i class="fab fa-whatsapp"></i> Falar no WhatsApp →';
                acoes.appendChild(a);
              }
            } else {
              if (subEl) subEl.innerHTML = 'Seu cadastro está em análise. Quando for aprovado, entre em <strong>Minha Loja</strong> com o seu WhatsApp para receber o código de acesso.';
              if (stTxt) stTxt.textContent = 'Em análise';
            }
          } else { tentar(); }
        } catch(e) { tentar(); }
      }, delay);
      _pollAprovTimers.push(t);
    }
    tentar();
  }
  window.iniciarPollingAprovacao = iniciarPollingAprovacao;

  /* ── Tela "Aguardando aprovação" ──────────────────────────────
     Mostra a coruja analisando enquanto o cadastro não é aprovado. Pode ser
     aberta logo após o cadastro OU ao reabrir o app e tocar em "Minha Loja"
     com um cadastro ainda pendente. Reconstrói os botões de pagamento (planos
     pagos) a partir do plano/ciclo salvos. */
  function abrirAguardando(wpp, plano, ciclo) {
    const overlay = document.getElementById('modal-aguardando');
    if (!overlay) return;

    plano = (plano || 'GRATIS').toUpperCase();
    ciclo = ciclo || 'mensal';

    // Reseta o visual para o estado "analisando" (caso tenha ficado no estado
    // aprovado de uma sessão anterior na mesma aba)
    const owlEl = document.getElementById('aguardando-owl');
    if (owlEl) { owlEl.dataset.failed = ''; owlEl.style.display = ''; owlEl.src = '/webp/owl-search.webp'; }
    const titEl = document.getElementById('aguardando-title');
    if (titEl) titEl.innerHTML = 'Quase <span>lá!</span>';
    const bigEl = document.getElementById('aguardando-title-big');
    if (bigEl) bigEl.innerHTML = 'Estamos analisando 🔍';
    const statusEl = document.getElementById('aguardando-status');
    if (statusEl) statusEl.classList.remove('aprovado');
    const statusTxt = document.getElementById('aguardando-status-text');
    if (statusTxt) statusTxt.textContent = 'Verificando aprovação…';
    const hintEl = document.getElementById('aguardando-hint');
    if (hintEl) hintEl.style.display = '';

    const subEl   = document.getElementById('aguardando-sub');
    const acoesEl = document.getElementById('aguardando-acoes');
    if (acoesEl) acoesEl.innerHTML = '';

    const isPago = plano !== 'GRATIS';
    if (isPago && subEl) {
      const calc     = calcPreco(plano, ciclo);
      const cicloTxt = (CICLOS[ciclo] || CICLOS.mensal).rotulo.toLowerCase();
      const valorTxt = calc ? ` (${fmtBRL(calc.total)}${ciclo !== 'mensal' ? ' a cada ' + calc.meses + ' meses' : '/mês'})` : '';
      subEl.innerHTML =
        `Sua loja está em análise. <strong>Adiante a ativação do Plano ${plano}</strong> ` +
        `pagando agora — assim que aprovarmos, seu plano já entra ativo:`;

      // Botão "Pagar agora" (Mercado Pago) — ação primária
      const payBtn = document.createElement('button');
      payBtn.type = 'button';
      payBtn.className = 'success-pay-btn';
      payBtn.innerHTML = '<i class="ti ti-credit-card"></i> Pagar agora ' + (calc ? fmtBRL(calc.total) : '') + ' →';
      payBtn.onclick = () => iniciarPagamentoMP(wpp, plano, ciclo, payBtn);
      acoesEl.appendChild(payBtn);

      // Botão "Ativar via WhatsApp" — alternativa
      const wppMsg = encodeURIComponent(
        `Olá! Cadastrei minha loja no AngatubaON e escolhi o Plano ${plano} ${cicloTxt}${valorTxt}. Gostaria de ativá-lo!`
      );
      const wppBtn = document.createElement('a');
      wppBtn.className = 'success-wpp-btn';
      wppBtn.target = '_blank';
      wppBtn.rel = 'noopener';
      wppBtn.href = `https://wa.me/${ADMIN_WPP_CONTATO}?text=${wppMsg}`;
      wppBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Ativar pelo WhatsApp →';
      acoesEl.appendChild(wppBtn);
    } else if (subEl) {
      subEl.innerHTML =
        `Recebemos os dados da sua loja e logo liberamos seu acesso.<br>` +
        `<strong>Assim que aprovarmos, sua loja abre aqui automaticamente.</strong>`;
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (history.state?.modal !== 'aguardando') history.pushState({ modal: 'aguardando' }, '');

    // Garante o polling rodando (normaliza WPP com 55, igual à planilha)
    const wppNorm = (() => { const n = String(wpp || '').replace(/\D/g, ''); return n && !n.startsWith('55') ? '55' + n : n; })();
    if (wppNorm) iniciarPollingAprovacao(wppNorm);
  }
  window.abrirAguardando = abrirAguardando;

  function fecharAguardando(manterPolling, viaPopstate) {
    const overlay = document.getElementById('modal-aguardando');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (viaPopstate !== true && history.state?.modal === 'aguardando') { _popstateNosso = true; history.back(); }
    // Ao fechar manualmente, o polling continua rodando em background até o
    // limite de tempo — mas só faz sentido se ainda há cadastro pendente.
    if (!manterPolling && !_lojaToken && !localStorage.getItem('angatuba_pendente_wpp')) {
      pararPollingAprovacao();
    }
  }
  window.fecharAguardando = fecharAguardando;

  let _carouselIdx = 0;
  const PLANS_ORDER = ['GRATIS', 'PLUS', 'PRO'];

  const PLAN_LABELS = {
    GRATIS: { btn: 'Continuar com Grátis →',  cls: 'cta-gratis', note: 'Cadastro gratuito, sem compromisso.' },
    PLUS:   { btn: '✦ Quero o Plano Plus →',  cls: 'cta-plus',   note: 'Você será contactado via WhatsApp para ativar o plano.' },
    PRO:    { btn: '⭐ Quero o Plano Pro →',   cls: 'cta-pro',    note: 'Você será contactado via WhatsApp para ativar o plano.' },
  };

  function openPlanModal() {
    document.getElementById('modal-planos').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Começa sempre no Plus (índice 1) para aumentar conversão
    _irParaSlide(1, false);
  }

  function closePlanModal() {
    document.getElementById('modal-planos').classList.remove('open');
    document.body.style.overflow = '';
    // A1: sempre limpa o contexto de painel ao fechar (inclusive fechar sem
    // confirmar, ex.: clique fora) — não deve vazar pro próximo uso do modal.
    _planosCtxPainel = false;
    _cicloSelecionado = 'mensal';
  }

  // A1: abre o modal de planos a partir do painel Minha Loja (loja já
  // logada). Reaproveita o carrossel existente; ao confirmar, chama
  // iniciarPagamentoMP direto — sem passar pelo cadastro — com o WhatsApp
  // da loja já logada. Ver confirmPlan() para a ramificação do CTA.
  window.mlAbrirUpgrade = function () {
    const wpp = _lojaWpp || localStorage.getItem('angatuba_loja_wpp') || '';
    if (!wpp) {
      // Sem wpp resolvido ainda não dá pra cobrar — cai pro WhatsApp direto.
      window.open(_mlUpgradeWppUrl || `https://wa.me/${ADMIN_WPP_CONTATO}`, '_blank', 'noopener');
      return;
    }
    _planosCtxPainel = true;
    openPlanModal();
  };

  // Ajusta o modal-planos para o contexto do painel: mostra o seletor de
  // ciclo, troca o texto/ação do CTA principal e oferece WhatsApp como
  // alternativa secundária. No-op fora do contexto de painel (fluxo normal
  // de cadastro fica intocado).
  function _mlPlanosAtualizarContexto() {
    const cicloWrap = document.getElementById('plan-ciclo-toggle');
    const wppLink   = document.getElementById('plan-wpp-secundario');
    if (!_planosCtxPainel) {
      if (cicloWrap) cicloWrap.style.display = 'none';
      if (wppLink) wppLink.style.display = 'none';
      return;
    }
    const btn  = document.getElementById('plan-cta-btn');
    const note = document.getElementById('plan-note');
    const isPago = selectedPlan !== 'GRATIS';
    if (cicloWrap) cicloWrap.style.display = isPago ? '' : 'none';
    if (wppLink) {
      wppLink.style.display = isPago ? 'flex' : 'none';
      if (_mlUpgradeWppUrl) wppLink.href = _mlUpgradeWppUrl;
    }
    if (isPago) {
      if (btn) {
        btn.textContent = 'Assinar ' + (selectedPlan === 'PRO' ? 'Pro' : 'Plus') + ' →';
        btn.className = 'plan-cta ' + (selectedPlan === 'PRO' ? 'cta-pro' : 'cta-plus');
      }
      if (note) note.textContent = 'Pagamento seguro via Mercado Pago.';
      mlPlanosAtualizarPreco();
    } else {
      if (btn) { btn.textContent = 'Fechar'; btn.className = 'plan-cta cta-gratis'; }
      if (note) note.textContent = 'Disponível apenas nos planos pagos.';
    }
  }

  // Troca o ciclo de cobrança dentro do modal-planos (contexto painel).
  window.mlPlanosCiclo = function (ciclo) {
    if (!CICLOS[ciclo]) ciclo = 'mensal';
    _cicloSelecionado = ciclo;
    document.querySelectorAll('#plan-ciclo-toggle .ciclo-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.ciclo === ciclo);
    });
    mlPlanosAtualizarPreco();
  };

  // Atualiza o preço exibido no card do plano selecionado conforme o ciclo.
  function mlPlanosAtualizarPreco() {
    if (selectedPlan === 'GRATIS') return;
    const calc = calcPreco(selectedPlan, _cicloSelecionado);
    if (!calc) return;
    const sufixo = selectedPlan.toLowerCase();
    const valEl = document.getElementById('plan-price-val-' + sufixo);
    const perEl = document.getElementById('plan-price-per-' + sufixo);
    if (valEl) valEl.textContent = fmtBRL(calc.porMes);
    if (perEl) perEl.textContent = (_cicloSelecionado === 'mensal')
      ? 'por mês'
      : ('por mês · ' + CICLOS[_cicloSelecionado].rotulo.toLowerCase());
  }

  function _irParaSlide(idx, animado = true) {
    const carousel = document.getElementById('plan-carousel');
    if (!carousel) return;
    _carouselIdx = Math.max(0, Math.min(idx, PLANS_ORDER.length - 1));
    carousel.style.transition = animado ? 'transform 0.35s cubic-bezier(0.32,0.72,0,1)' : 'none';
    carousel.style.transform  = `translateX(-${_carouselIdx * 100}%)`;

    // Dots
    document.querySelectorAll('.plan-dot').forEach((d, i) => {
      d.classList.toggle('active', i === _carouselIdx);
    });

    // Card selecionado
    selectedPlan = PLANS_ORDER[_carouselIdx];
    document.querySelectorAll('.plan-slide .plan-card').forEach((c, i) => {
      c.classList.toggle('selected', i === _carouselIdx);
    });

    // Botão e nota
    const cfg  = PLAN_LABELS[selectedPlan];
    const btn  = document.getElementById('plan-cta-btn');
    const note = document.getElementById('plan-note');
    if (btn)  { btn.textContent = cfg.btn; btn.className = 'plan-cta ' + cfg.cls; }
    if (note) note.textContent = cfg.note;

    // A1: no contexto de painel, sobrescreve texto/ação do CTA e mostra ciclo.
    _mlPlanosAtualizarContexto();
  }

  // Dots clicáveis
  document.querySelectorAll('.plan-dot').forEach(dot => {
    dot.addEventListener('click', () => _irParaSlide(+dot.dataset.idx));
  });

  // Swipe touch no carrossel
  (function initCarouselSwipe() {
    const wrap = document.querySelector('.plan-carousel-wrap');
    if (!wrap) return;
    let startX = 0, startY = 0, isDragging = false, isHoriz = null;

    wrap.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true; isHoriz = null;
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (isHoriz === null) isHoriz = Math.abs(dx) > Math.abs(dy);
      if (isHoriz) e.preventDefault();
    }, { passive: false });

    wrap.addEventListener('touchend', e => {
      if (!isDragging || !isHoriz) { isDragging = false; return; }
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) _irParaSlide(_carouselIdx + 1);
        else        _irParaSlide(_carouselIdx - 1);
      }
      isDragging = false;
    });

    // Mouse drag para desktop
    let mouseStartX = 0, mouseDragging = false;
    wrap.addEventListener('mousedown', e => { mouseStartX = e.clientX; mouseDragging = true; });
    wrap.addEventListener('mousemove', e => { if (mouseDragging) e.preventDefault(); });
    wrap.addEventListener('mouseup', e => {
      if (!mouseDragging) return;
      const dx = e.clientX - mouseStartX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) _irParaSlide(_carouselIdx + 1);
        else        _irParaSlide(_carouselIdx - 1);
      }
      mouseDragging = false;
    });
    wrap.addEventListener('mouseleave', () => { mouseDragging = false; });
  })();

  function selectPlan(card) {
    // Mantido por compatibilidade, mas o carrossel gerencia tudo
    const idx = PLANS_ORDER.indexOf(card.dataset.plan);
    if (idx >= 0) _irParaSlide(idx);
  }

  function confirmPlan() {
    // A1: contexto painel (loja já logada, querendo upgrade) — chama o
    // pagamento direto, sem passar pelo cadastro. Mesma função usada em
    // abrirAguardando() para "Pagar agora".
    if (_planosCtxPainel) {
      _planosCtxPainel = false;
      const plano = selectedPlan;
      const ciclo = _cicloSelecionado;
      const wpp   = _lojaWpp || localStorage.getItem('angatuba_loja_wpp') || '';
      const btn   = document.getElementById('plan-cta-btn');
      closePlanModal();
      if (plano === 'GRATIS') return; // nada a fazer — loja já está no Grátis
      iniciarPagamentoMP(wpp, plano, ciclo, btn);
      return;
    }
    closePlanModal();
    // Aplica o plano selecionado na etapa 3 do cadastro
    cadSelecionarPlano(selectedPlan);
    openCadastroModal();
    // Vai direto para etapa 3 se veio do modal de planos
    setTimeout(() => cadIrParaEtapa(3), 50);
  }

  // Fecha plan modal ao clicar fora
  document.getElementById('modal-planos').addEventListener('click', function(e) {
    if (e.target === this) closePlanModal();
  });

  /* ── STEPPER DE CADASTRO ───────────────────────────────── */
  let _cadEtapaAtual = 1;

  let _cadIndoVoltar = false;
  function cadIrParaEtapa(n) {
    _cadEtapaAtual = n;
    const voltando = _cadIndoVoltar; _cadIndoVoltar = false;
    // Painéis
    [1,2,3].forEach(i => {
      const panel = document.getElementById('cad-panel-' + i);
      if (!panel) return;
      const ativo = (i === n);
      panel.classList.toggle('active', ativo);
      panel.classList.toggle('cad-back', ativo && voltando);
    });
    // Stepper visual
    [1,2,3].forEach(i => {
      const stepEl = document.getElementById('cad-step-ind-' + i);
      const circEl = document.getElementById('cad-step-circ-' + i);
      if (!stepEl) return;
      stepEl.classList.remove('active','done');
      if (i < n) { stepEl.classList.add('done'); if(circEl) circEl.innerHTML = '✓'; }
      else if (i === n) { stepEl.classList.add('active'); if(circEl) circEl.textContent = i; }
      else { if(circEl) circEl.textContent = i; }
    });
    // Linhas
    [1,2].forEach(i => {
      const lineEl = document.getElementById('cad-line-' + i);
      if (lineEl) lineEl.classList.toggle('done', i < n);
    });
    // Subtitle
    const subtitles = {1:'Dados da sua loja', 2:'Horário de funcionamento', 3:'Plano e fotos'};
    const subEl = document.getElementById('cad-modal-subtitle');
    if (subEl) subEl.textContent = subtitles[n] || '';
    // Rola para o topo do modal
    const sheet = document.querySelector('#modal-cadastro .modal-sheet');
    if (sheet) sheet.scrollTop = 0;
  }

  /* ── Acordeão de planos (etapa 3) ────────────────────────────
     Substituiu o carousel. _cadCarouselIdx é mantido só por
     compatibilidade com confirmPlan(). cadCarouselIr() vira um
     atalho que apenas seleciona o plano correspondente. */
  let _cadCarouselIdx = 1; // Plus por padrão
  const _CAD_PLANS = ['GRATIS','PLUS','PRO'];

  window.cadCarouselIr = function(idx) {
    idx = Math.max(0, Math.min(idx, 2));
    cadSelecionarPlano(_CAD_PLANS[idx]);
  };

  // ── Toggle 'Atendo por agendamento' no cadastro ─────────────
  // Liga/desliga o visual do switch e, principalmente, torna endereço e
  // horário opcionais (mão de obra não tem ponto fixo nem horário fixo).
  window.cadToggleAgendamento = function(on) {
    const sw    = document.getElementById('f-agendamento-switch');
    const thumb = document.getElementById('f-agendamento-thumb');
    const endReq  = document.getElementById('f-endereco-req');
    const horReq  = document.getElementById('f-horario-req');
    const endRua  = document.getElementById('f-endereco-rua');
    if (sw) {
      sw.style.background = on ? 'var(--green)' : 'var(--border)';
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    if (thumb) thumb.style.left = on ? '21px' : '3px';
    // Endereço: some o asterisco e remove o required nativo do input de rua.
    if (endReq) endReq.style.display = on ? 'none' : '';
    if (endRua) { if (on) endRua.removeAttribute('required'); else endRua.setAttribute('required',''); }
    if (horReq) horReq.style.display = on ? 'none' : '';
    // Nota informativa na etapa de horário + esmaece o schedule builder.
    const note   = document.getElementById('f-agend-horario-note');
    const sched  = document.getElementById('sched-simple');
    const schedA = document.getElementById('sched-advanced');
    if (note) note.style.display = on ? '' : 'none';
    [sched, schedA].forEach(function(elx){
      if (!elx) return;
      elx.style.opacity = on ? '0.55' : '';
    });
    // Botão 'Próximo' da etapa de horário vira um 'pular' explícito, já que
    // a nota promete que dá pra pular. Sem isso o usuário não percebe que
    // clicar em Próximo já é o pulo.
    const nextBtn = document.querySelector('#cad-panel-2 .cad-next-btn');
    if (nextBtn) {
      nextBtn.innerHTML = on
        ? 'Pular horário — Escolher plano <i class="fa fa-arrow-right"></i>'
        : 'Próximo — Escolher plano <i class="fa fa-arrow-right"></i>';
    }
  };

  window.cadAvancar = function(etapa) {
    // Validação básica antes de avançar
    if (etapa === 2) {
      const nome   = document.getElementById('f-nome');
      const ramo   = document.getElementById('f-ramo');
      const wpp    = document.getElementById('f-wpp');
      const end    = document.getElementById('f-endereco-rua');
      const bairro = document.getElementById('f-bairro');
      if (!nome?.value.trim()) { cadShake(nome); nome?.focus(); return; }
      nome?.classList.remove('invalid');
      if (!ramo?.value.trim()) {
        document.getElementById('f-ramo-text')?.focus();
        return;
      }
      const _agendOn = document.getElementById('f-agendamento')?.checked;
      if (!_agendOn && !end?.value.trim()) { cadShake(end); end?.focus(); return; }
      end?.classList.remove('invalid');
      // Fix: valida o comprimento real do WPP (10-11 dígitos) em vez de só checar a classe
      // .invalid — um número incompleto que nunca recebeu blur passava direto pro step 2.
      const _wppDigits = (wpp?.value || '').replace(/\D/g, '');
      if (_wppDigits.length !== 10 && _wppDigits.length !== 11) {
        cadShake(wpp);
        wpp?.focus();
        return;
      }
      wpp?.classList.remove('invalid');
      // Bairro: obrigatório para lojas com ponto fixo (alimenta o filtro por
      // bairro). Para agendamento (mão de obra) é opcional — o autônomo atende
      // a cidade/região. Se preencher mesmo assim, validamos contra a lista.
      if (bairro) {
        const bv = bairro.value.trim();
        // Vazio + agendamento: pode seguir sem bairro.
        if (!bv && _agendOn) {
          bairro.classList.remove('invalid');
        } else {
          const bvNorm = normBairro(bv);
          const ehValido = BAIRROS_ANGATUBA.some(b => normBairro(b) === bvNorm);
          if (!bv || !ehValido) {
            const canonico = BAIRROS_ANGATUBA.find(b => normBairro(b) === bvNorm);
            if (canonico) {
              bairro.value = canonico;
            } else {
              cadShake(bairro);
              bairro.focus();
              setTimeout(() => bairro.classList.remove('invalid'), 2500);
              return;
            }
          }
        }
      }
      bairro?.classList.remove('invalid');
    }
    cadIrParaEtapa(etapa);
    if (etapa === 3) {
      // Abre já no Plus (mais escolhido) expandido; Grátis e Pro recolhidos.
      setTimeout(function() { cadSelecionarPlano('PLUS'); }, 60);
    }
  };

  // (Removido) O hint de swipe do carousel não existe mais no acordeão.
  function cadToggleVerTudo(plano, btn) {
    var ul = document.getElementById('acc-extra-' + plano);
    if (!ul) return;
    var aberto = ul.style.display !== 'none';
    ul.style.display = aberto ? 'none' : '';
    if (btn) {
      var ic  = btn.querySelector('i');
      var txt = btn.querySelector('span');
      if (ic)  ic.className = aberto ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
      if (txt) txt.textContent = aberto ? 'ver o que mais vem no Plus' : 'ver menos';
    }
  }
  window.cadToggleVerTudo = cadToggleVerTudo;

  // Marca campo inválido + dispara shake (sem duplicar listeners).
  function cadShake(el) {
    if (!el) return;
    el.classList.add('invalid');
    el.classList.remove('cad-shake');
    void el.offsetWidth;
    el.classList.add('cad-shake');
    setTimeout(function () { el.classList.remove('cad-shake'); }, 450);
  }
  window.cadVoltar = function(etapa) { _cadIndoVoltar = true; cadIrParaEtapa(etapa); };

  /* ── Seletor de plano inline (etapa 3) ─────────────────── */
  window.cadSelecionarPlano = function(plano) {
    if (!_CAD_PLANS.includes(plano)) plano = 'GRATIS';
    selectedPlan = plano;
    _cadCarouselIdx = _CAD_PLANS.indexOf(plano);

    const isPago = plano !== 'GRATIS';

    // Acordeão: marca selecionado (expande) e recolhe os demais.
    ['GRATIS','PLUS','PRO'].forEach(p => {
      const el = document.getElementById('plan-sel-' + p.toLowerCase());
      if (!el) return;
      const ativo = (p === plano);
      el.classList.toggle('selected', ativo);
      el.setAttribute('aria-checked', ativo ? 'true' : 'false');
    });

    // Aviso "foto depois" só aparece em plano pago.
    const avisoEl = document.getElementById('cad-foto-aviso');
    if (avisoEl) avisoEl.style.display = isPago ? '' : 'none';

    // Mantém os previews todos renderizados (cada um vive dentro do seu card),
    // mas o card recolhido esconde o corpo via CSS, então não precisa toggle aqui.

    // Gera as barras de pico do Pro uma única vez.
    if (plano === 'PRO') {
      const barsEl = document.getElementById('cpp-pico-bars');
      if (barsEl && !barsEl.dataset.rendered) {
        const vals = [12, 18, 35, 28, 45, 60, 72, 55, 48, 65, 80, 58];
        const peak = Math.max(...vals);
        barsEl.innerHTML = vals.map(v =>
          `<div class="cpp-pico-bar${v === peak ? ' peak' : ''}" style="height:${Math.round((v/peak)*100)}%"></div>`
        ).join('');
        barsEl.dataset.rendered = '1';
      }
    }

    // Garante que os preços do ciclo atual estão aplicados nos cards pagos.
    if (typeof cadAtualizarPrecos === 'function') cadAtualizarPrecos();
  };

  /* ── Seleção de ciclo de cobrança ─────────────────────────── */
  window.cadSelecionarCiclo = function(ciclo) {
    if (!CICLOS[ciclo]) ciclo = 'mensal';
    _cicloSelecionado = ciclo;

    // Marca o botão ativo em TODOS os toggles de ciclo (Plus e Pro espelham o mesmo estado).
    document.querySelectorAll('#cad-ciclo-toggle .ciclo-btn, #cad-ciclo-toggle-pro .ciclo-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.ciclo === ciclo);
    });

    cadAtualizarPrecos();
  };

  // Atualiza os preços exibidos nos cards Plus/Pro conforme o ciclo escolhido.
  function cadAtualizarPrecos() {
    const ciclo = _cicloSelecionado;
    ['PLUS','PRO'].forEach(plano => {
      const sufixo  = plano.toLowerCase();
      const precoEl = document.getElementById('cad-preco-' + sufixo);
      const perEl   = document.getElementById('cad-per-' + sufixo);
      const infoEl  = document.getElementById('cad-ciclo-' + sufixo);
      const calc    = calcPreco(plano, ciclo);
      if (!precoEl || !calc) return;

      // micro-animação ao trocar o preço (fade rápido)
      precoEl.classList.remove('price-flash');
      void precoEl.offsetWidth;
      precoEl.classList.add('price-flash');

      if (ciclo === 'mensal') {
        precoEl.classList.remove('price-riscado');
        precoEl.textContent = fmtBRL(calc.porMes);
        if (perEl)  perEl.textContent = 'por mês';
        if (infoEl) { infoEl.style.display = 'none'; infoEl.innerHTML = ''; }
      } else {
        // Mostra preço POR MÊS em destaque (mais convertível) + total no rodapé
        precoEl.classList.remove('price-riscado');
        precoEl.textContent = fmtBRL(calc.porMes);
        if (perEl) perEl.textContent = 'por mês';
        if (infoEl) {
          const totalTxt = `${fmtBRL(calc.total)} a cada ${calc.meses} meses`;
          const econTxt  = calc.economia > 0
            ? ` · <span class="plan-ciclo-economia">economize ${fmtBRL(calc.economia)}</span>`
            : '';
          infoEl.innerHTML = totalTxt + econTxt;
          infoEl.style.display = '';
        }
      }
    });
  }


  /* ── Schedule simplificado ──────────────────────────────── */
  let _schedPreset = 'semana';
  // Marca se o usuário mexeu no horário. Usado no submit: loja de agendamento
  // que NÃO tocou no horário tem os campos zerados (vira 'Sob agendamento');
  // se tocou, mantém como horário de referência.
  let _schedTouched = false;
  window._schedFoiTocado = function() { return _schedTouched; };
  window._schedMarcarTocado = function() { _schedTouched = true; };

  const PRESET_DIAS = {
    semana:     [1,2,3,4,5],
    semana_sab: [1,2,3,4,5,6],
    todos:      [0,1,2,3,4,5,6],
    custom:     [],
  };

  window.schedPreset = function(preset, btn) {
    _schedTouched = true;
    _schedPreset = preset;
    document.querySelectorAll('.sched-preset-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (preset === 'custom') {
      schedMostrarAvancado();
    } else {
      schedSyncSimples();
    }
  };

  window.schedSyncSimples = function() {
    if (_schedPreset === 'custom') return;
    const dias  = PRESET_DIAS[_schedPreset] || [1,2,3,4,5];
    const abre  = document.getElementById('sched-abre')?.value  || '08:00';
    const fecha = document.getElementById('sched-fecha')?.value || '18:00';
    // Atualiza o scheduleTurnos para o builder avançado ficar em sincronia
    scheduleTurnos = [{ dias, abre, fecha }];
    renderScheduleCards();
    syncHiddenFields();
  };

  window.schedMostrarAvancado = function() {
    document.getElementById('sched-simple').style.display = 'none';
    document.getElementById('sched-advanced').style.display = '';
    // Sincroniza turno atual para o builder
    if (scheduleTurnos.length === 0) {
      scheduleTurnos = [{ dias: [1,2,3,4,5], abre: '08:00', fecha: '18:00' }];
      renderScheduleCards();
      syncHiddenFields();
    }
  };

  window.schedOcultarAvancado = function() {
    document.getElementById('sched-simple').style.display = '';
    document.getElementById('sched-advanced').style.display = 'none';
    _schedPreset = 'semana';
    document.querySelectorAll('.sched-preset-btn').forEach((b,i) => b.classList.toggle('active', i===0));
    schedSyncSimples();
  };

  /* ── Schedule Builder (avançado — acessível via link) ───── */
  const DIAS_LABEL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const scheduleBuilder = document.getElementById('schedule-builder');
  const scheduleAddBtn  = document.getElementById('schedule-add-btn');
  let scheduleTurnos = []; // [{dias:[1,2,3,4,5], abre:'08:00', fecha:'18:00'}]

  function criarCardTurno(idx) {
    const turno = scheduleTurnos[idx];
    const card = document.createElement('div');
    card.className = 'schedule-card';
    card.dataset.idx = idx;

    const title = document.createElement('div');
    title.className = 'schedule-card-title';
    title.textContent = idx === 0 ? 'Dias e horário principal' : 'Turno adicional';
    card.appendChild(title);

    // Dias
    const daysRow = document.createElement('div');
    daysRow.className = 'schedule-days';
    DIAS_LABEL.forEach((label, d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'schedule-day-btn' + (turno.dias.includes(d) ? ' active' : '');
      btn.textContent = label;
      btn.dataset.day = d;
      btn.addEventListener('click', () => {
        const di = turno.dias.indexOf(d);
        if (di >= 0) turno.dias.splice(di, 1);
        else turno.dias.push(d);
        btn.classList.toggle('active');
        syncHiddenFields();
      });
      daysRow.appendChild(btn);
    });
    card.appendChild(daysRow);

    // Horários
    const timesRow = document.createElement('div');
    timesRow.className = 'schedule-times';

    const inAbre = document.createElement('input');
    inAbre.type = 'time'; inAbre.value = turno.abre;
    inAbre.addEventListener('change', () => { turno.abre = inAbre.value; syncHiddenFields(); });

    const sep = document.createElement('span');
    sep.textContent = 'até';

    const inFecha = document.createElement('input');
    inFecha.type = 'time'; inFecha.value = turno.fecha;
    inFecha.addEventListener('change', () => { turno.fecha = inFecha.value; syncHiddenFields(); });

    timesRow.appendChild(inAbre);
    timesRow.appendChild(sep);
    timesRow.appendChild(inFecha);
    card.appendChild(timesRow);

    // Botão remover (só em cards extras)
    if (idx > 0) {
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'schedule-remove';
      rmBtn.innerHTML = '<i class="fa fa-times"></i>';
      rmBtn.addEventListener('click', () => {
        scheduleTurnos.splice(idx, 1);
        renderScheduleCards();
        syncHiddenFields();
      });
      card.appendChild(rmBtn);
    }

    return card;
  }

  function renderScheduleCards() {
    scheduleBuilder.innerHTML = '';
    scheduleTurnos.forEach((_, idx) => {
      scheduleBuilder.appendChild(criarCardTurno(idx));
    });
  }

  function syncHiddenFields() {
    // Monta texto legível: "Seg-Sex 08:00-18:00 | Sáb 08:00-12:00"
    const texto = scheduleTurnos.map(t => {
      if (!t.dias.length) return null;
      const diasNomes = t.dias.sort((a,b)=>a-b).map(d => DIAS_LABEL[d]).join(', ');
      return diasNomes + ' ' + t.abre + '-' + t.fecha;
    }).filter(Boolean).join(' | ');

    // Usa o primeiro turno como principal para os campos estruturados
    const principal = scheduleTurnos[0];
    const diasStr = scheduleTurnos.flatMap(t => t.dias).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b).join(',');

    document.getElementById('f-horario').value   = texto;
    document.getElementById('f-dias').value      = diasStr;
    document.getElementById('f-hora-abre').value  = principal ? principal.abre  : '';
    document.getElementById('f-hora-fecha').value = principal ? principal.fecha : '';
  }

  // Inicializa com um card padrão Seg-Sex
  scheduleTurnos = [{ dias: [1,2,3,4,5], abre: '08:00', fecha: '18:00' }];
  renderScheduleCards();
  syncHiddenFields();
  // Sincroniza campos simples na inicialização
  if (typeof schedSyncSimples === 'function') schedSyncSimples();

  scheduleAddBtn.addEventListener('click', () => {
    if (scheduleTurnos.length >= 3) return; // máximo 3 turnos
    scheduleTurnos.push({ dias: [], abre: '08:00', fecha: '12:00' });
    renderScheduleCards();
    syncHiddenFields();
  });

  // Submissão via Google Apps Script — funciona no GitHub Pages

  /* ── Máscara e validação de WhatsApp ─────────────────────── */
  (function initWppField() {
    const input = document.getElementById('f-wpp');
    const errEl = document.getElementById('f-wpp-err');
    if (!input) return;

    // Usa a máscara única (mascararWppBR) — antes havia duas implementações divergentes.
    function mask(v) { return mascararWppBR(v); }

    function validate(showErr) {
      const digits = input.value.replace(/\D/g,'');
      const ok = digits.length === 10 || digits.length === 11;
      input.classList.toggle('invalid', showErr && !ok);
      errEl.classList.toggle('show', showErr && !ok);
      return ok;
    }

    input.addEventListener('input', function() {
      const pos  = this.selectionStart;
      const prev = this.value.length;
      this.value = mask(this.value);
      const diff = this.value.length - prev;
      try { this.setSelectionRange(pos + diff, pos + diff); } catch(e) {}
      if (this.value.replace(/\D/g,'').length >= 10) validate(true);
      else { input.classList.remove('invalid'); errEl.classList.remove('show'); }
    });

    input.addEventListener('blur', () => {
      if (input.value.trim()) validate(true);
    });

    // Limpa erro ao focar de novo
    input.addEventListener('focus', () => {
      input.classList.remove('invalid');
      errEl.classList.remove('show');
    });

    window._validateWpp = () => validate(true);
  })();

  document.getElementById('cadastro-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('.modal-submit');

    // Valida WPP antes de qualquer coisa
    if (window._validateWpp && !window._validateWpp()) {
      document.getElementById('f-wpp').scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('f-wpp').focus();
      return;
    }

    // Valida ramo (categoria) — campo obrigatório mas sem required nativo
    const ramoVal = document.getElementById('f-ramo')?.value.trim();
    if (!ramoVal) {
      const ramoInput = document.getElementById('f-ramo-text');
      ramoInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ramoInput?.focus();
      cadShake(ramoInput);
      setTimeout(() => ramoInput?.classList.remove('invalid'), 2500);
      mlToast('Selecione o ramo / categoria da loja.', 'erro');
      return;
    }

    btn.classList.add('is-loading');
    btn.disabled = true;

    // Declarado fora do try: o catch precisa dele para decidir o que fazer
    // quando o servidor não responde (ver o catch no fim deste handler).
    let wppCadastro = '';
    const _salvarCadastroPendente = () => {
      if (!wppCadastro) return;
      localStorage.setItem('angatuba_pendente_wpp',   wppCadastro);
      localStorage.setItem('angatuba_pendente_plano', selectedPlan);
      localStorage.setItem('angatuba_pendente_ciclo', _cicloSelecionado);
    };

    try {
      // Garante que endereço completo foi montado (rua selecionada da lista)
      const ruaInput  = document.getElementById('f-endereco-rua');
      const endOculto = document.getElementById('f-endereco');
      if (ruaInput && ruaInput.value.trim() && !endOculto.value) {
        endOculto.value = ruaInput.value.trim();
        const num = document.getElementById('f-endereco-numero')?.value.trim();
        if (num) endOculto.value += ', ' + num;
        document.getElementById('f-maps-url').value =
          `https://www.google.com/maps/search/${encodeURIComponent(endOculto.value + ', Angatuba, SP')}`;
      }

      // Valida horário — exceto quando a loja atende só por agendamento
      // (mão de obra não tem horário fixo).
      const _agendOn = document.getElementById('f-agendamento')?.checked;
      if (!_agendOn && !document.getElementById('f-horario').value) {
        mlToast('Selecione pelo menos um dia e horário de funcionamento.', 'erro');
        btn.classList.remove('is-loading');
        btn.disabled = false;
        return;
      }

      const formData = new FormData(this);
      const payload  = Object.fromEntries(formData.entries());
      payload.planoSolicitado = selectedPlan; // envia o plano escolhido
      // Agendamento: se o dono NÃO mexeu no horário, zera os campos (o schedule
      // tem um default Seg-Sex 08-18 que não faz sentido para mão de obra) →
      // a loja aparece como 'Sob agendamento'. Se ele mexeu de propósito,
      // mantém como horário de referência (a nota promete isso).
      const _tocou = (typeof window._schedFoiTocado === 'function') && window._schedFoiTocado();
      if (payload.agendamento === 'SIM' && !_tocou) {
        payload.horario  = '';
        payload.dias     = '';
        payload.horaAbre = '';
        payload.horaFecha = '';
      }

      const params = new URLSearchParams();
      params.append('payload', JSON.stringify(payload));

      // Normaliza o WPP com DDI 55, pois é assim que salvarNaPlanilha() grava na
      // planilha (col E). Sem o 55, buscarLojaPorWpp() faz comparação exata e
      // NUNCA encontra a loja — o auto-login ficaria preso em "PENDENTE".
      // Calculado ANTES do fetch: o catch precisa dele para salvar o pendente
      // quando o servidor não responde a tempo (ver abaixo).
      wppCadastro = (() => {
        const n = String(payload.whatsapp || '').replace(/\D/g, '');
        return n && !n.startsWith('55') ? '55' + n : n;
      })();

      // Timeout generoso: este é o POST mais pesado do app (grava na planilha
      // E dispara o e-mail de aprovação) e o GAS ainda pode estar "frio". Com
      // 20s o cadastro entrava no servidor e o app dizia "sem conexão".
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body:   params,
        signal: AbortSignal.timeout(45000),
      });
      const json = await resp.json();
      if (json.status !== 'ok') {
        // Servidor respondeu recusando: nada foi criado, dá pra tentar de novo
        // com segurança (sem risco de loja duplicada).
        const errServidor = new Error(json.msg || 'Erro no servidor. Tente novamente.');
        errServidor.respondido = true;
        throw errServidor;
      }

      this.style.display = 'none';

      // Segredo de uso único do auto-login (só quem cadastrou recebe).
      try {
        if (json.data && json.data.claim) localStorage.setItem('angatuba_pendente_claim', json.data.claim);
        else localStorage.removeItem('angatuba_pendente_claim');
      } catch (e) {}

      const plano = selectedPlan;

      // Persiste o cadastro pendente (WPP + plano + ciclo) para que, se a pessoa
      // fechar e reabrir o app, a tela de aguardando seja reconstruída igual.
      _salvarCadastroPendente();

      // Fecha o modal de cadastro e abre a tela "Aguardando aprovação".
      // Ela mostra a coruja analisando, faz o polling e, ao aprovar, troca para
      // a coruja de celebração do plano e entra direto na conta.
      const modalCad = document.getElementById('modal-cadastro');
      if (modalCad && modalCad.classList.contains('open')) closeModal(false);
      setTimeout(() => abrirAguardando(wppCadastro, plano, _cicloSelecionado), 350);
    } catch (err) {
      btn.classList.remove('is-loading');
      btn.disabled = false;

      // Sem resposta do servidor (timeout) é MUITO diferente de sem rede:
      // no timeout a requisição saiu do celular e o GAS provavelmente gravou
      // a loja e mandou o e-mail — só demorou mais que o limite. Tratar isso
      // como "erro de conexão" fazia o lojista ficar preso na última etapa do
      // cadastro, sem polling de aprovação, e um novo envio criaria loja
      // duplicada. Nesse caso guardamos o pendente e mandamos pra tela de
      // aguardando, que confirma sozinha pelo polling.
      const semRede = (err instanceof TypeError) || navigator.onLine === false;
      const semResposta = !err?.respondido && !semRede &&
                          (err?.name === 'TimeoutError' || err?.name === 'AbortError');

      if (semResposta && wppCadastro) {
        _salvarCadastroPendente();
        const modalCad = document.getElementById('modal-cadastro');
        if (modalCad && modalCad.classList.contains('open')) closeModal(false);
        setTimeout(() => {
          abrirAguardando(wppCadastro, selectedPlan, _cicloSelecionado);
          // Honestidade: não sabemos se entrou — a tela padrão diz "recebemos
          // os dados", o que seria mentira aqui.
          const subEl = document.getElementById('aguardando-sub');
          if (subEl) subEl.innerHTML =
            'Enviamos seu cadastro, mas a confirmação não chegou a tempo.<br>' +
            '<strong>Se ele entrou, sua loja abre aqui assim que for aprovada.</strong> ' +
            'Se em alguns minutos nada aparecer, faça o cadastro de novo.';
          const stEl = document.getElementById('aguardando-status-text');
          if (stEl) stEl.textContent = 'Confirmando o envio…';
        }, 350);
        return;
      }

      mlToast(err?.respondido
        ? (err.message || 'Erro ao enviar. Tente novamente.')
        : 'Erro ao enviar. Verifique sua conexão e tente novamente.', 'erro');
    }
  });

  /* ── Modais de login ─────────────────────────────────────── */
  function openLoginLoja() {
    loginStep(1);
    document.getElementById('ll-wpp').value    = '';
    document.getElementById('ll-codigo').value = '';
    const errEl = document.getElementById('ll-wpp-err');
    if (errEl) errEl.classList.remove('show');
    document.getElementById('ll-wpp').classList.remove('invalid');
    llOtpInit();
    // Melhoria: retoma o cooldown de reenvio se ainda estava ativo (reload da página).
    llIniciarCooldown(true);
    llOtpReset();
    document.getElementById('login-loja-title').innerHTML = 'Acessar <span>Minha Loja</span>';
    document.getElementById('login-loja-sub').textContent = 'Digite o WhatsApp cadastrado para receber seu código';
    document.getElementById('modal-login-loja').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (history.state?.modal !== 'login-loja') history.pushState({ modal: 'login-loja' }, '');
    setTimeout(() => document.getElementById('ll-wpp').focus(), 300);
  }

  function closeLoginLoja(viaPopstate) {
    llPararTimer();
    if (_llCooldownInt) { clearInterval(_llCooldownInt); _llCooldownInt = null; }
    document.getElementById('modal-login-loja').classList.remove('open');
    document.body.style.overflow = '';
    if (viaPopstate !== true && history.state?.modal === 'login-loja') { _popstateNosso = true; history.back(); }
  }

  document.getElementById('modal-login-loja').addEventListener('click', function(e) {
    if (e.target === this) closeLoginLoja();
  });

  function loginStep(step) {
    document.getElementById('login-step1').style.display = step === 1 ? 'flex' : 'none';
    document.getElementById('login-step2').style.display = step === 2 ? 'flex' : 'none';
    if (step === 1) {
      llPararTimer();
      if (_llCooldownInt) { clearInterval(_llCooldownInt); _llCooldownInt = null; }
      const otp = document.getElementById('ll-otp');
      if (otp) otp.classList.remove('error','success');
    }
  }

  /* ════════════ OTP: 6 caixinhas com auto-advance/paste ═══════ */
  function llOtpBoxes() {
    return Array.from(document.querySelectorAll('#ll-otp .ll-otp-box'));
  }
  function llOtpFocus(i) {
    const b = llOtpBoxes();
    if (b[i]) { b[i].focus(); b[i].select && b[i].select(); }
  }
  function llOtpValor() {
    return llOtpBoxes().map(x => x.value).join('').replace(/\D/g,'');
  }
  function llOtpSync() {
    const hid = document.getElementById('ll-codigo');
    if (hid) hid.value = llOtpValor();
  }
  function llOtpReset() {
    const otp = document.getElementById('ll-otp');
    if (otp) otp.classList.remove('error','success');
    llOtpBoxes().forEach(b => { b.value = ''; b.classList.remove('filled'); });
    llOtpSync();
    llOtpFocus(0);
  }
  function llOtpErro(msg) {
    const hint = document.getElementById('login-codigo-hint');
    const otp  = document.getElementById('ll-otp');
    if (hint) hint.textContent = msg;
    if (otp) {
      otp.classList.add('error','shake');
      setTimeout(() => otp.classList.remove('shake'), 420);
    }
    setTimeout(() => llOtpReset(), 450);
  }
  // Liga os eventos das caixinhas (uma única vez)
  function llOtpInit() {
    const boxes = llOtpBoxes();
    if (!boxes.length || boxes[0].dataset.bound) return;
    boxes.forEach((box, i) => {
      box.dataset.bound = '1';
      box.addEventListener('input', () => {
        // Sugestão do teclado (Gboard) ou autofill do SMS coloca o código
        // inteiro numa caixinha só: espalha os dígitos pelas seguintes.
        const _dig = box.value.replace(/\D/g,'');
        if (_dig.length > 1) {
          for (let k = 0; k < _dig.length && i + k < boxes.length; k++) {
            boxes[i + k].value = _dig[k];
            boxes[i + k].classList.add('filled');
          }
          llOtpSync();
          llOtpFocus(Math.min(i + _dig.length, boxes.length - 1));
          if (llOtpValor().length === 6) setTimeout(() => lojaVerificarCodigo(), 120);
          return;
        }
        box.value = _dig.slice(0,1);
        box.classList.toggle('filled', !!box.value);
        const otp = document.getElementById('ll-otp');
        if (otp) otp.classList.remove('error');
        if (box.value && i < boxes.length - 1) llOtpFocus(i + 1);
        llOtpSync();
        if (llOtpValor().length === 6) {
          setTimeout(() => lojaVerificarCodigo(), 120); // pequeno debounce p/ paste
        }
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          const prev = boxes[i-1];
          prev.value = ''; prev.classList.remove('filled');
          llOtpFocus(i-1); llOtpSync(); e.preventDefault();
        } else if (e.key === 'ArrowLeft' && i > 0) {
          llOtpFocus(i-1); e.preventDefault();
        } else if (e.key === 'ArrowRight' && i < boxes.length-1) {
          llOtpFocus(i+1); e.preventDefault();
        }
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
        if (!txt) return;
        boxes.forEach((b, k) => {
          b.value = txt[k] || '';
          b.classList.toggle('filled', !!b.value);
        });
        llOtpSync();
        llOtpFocus(Math.min(txt.length, 5));
        if (txt.length === 6) setTimeout(() => lojaVerificarCodigo(), 120);
      });
    });
  }

  /* ════════════ Timer de expiração (10 min) ═══════════════════ */
  function llIniciarTimer() {
    llPararTimer();
    _llTimerRestante = 1800; // 30 minutos (igual ao CODIGO_TTL_MS do GAS)
    llRenderTimer();
    _llTimerInt = setInterval(() => {
      _llTimerRestante--;
      if (_llTimerRestante <= 0) {
        llPararTimer();
        const hint = document.getElementById('login-codigo-hint');
        if (hint) hint.textContent = '⏱️ Código expirado. Toque em "Reenviar código".';
      } else {
        llRenderTimer();
      }
    }, 1000);
  }
  function llRenderTimer() {
    const el = document.getElementById('ll-timer');
    if (!el) return;
    const m = Math.floor(_llTimerRestante / 60);
    const s = _llTimerRestante % 60;
    el.textContent = m + ':' + String(s).padStart(2,'0');
  }
  function llPararTimer() {
    if (_llTimerInt) { clearInterval(_llTimerInt); _llTimerInt = null; }
  }

  /* ════════════ Cooldown do botão "Reenviar" (45s) ════════════ */
  const _LL_COOLDOWN_KEY = 'angatuba_otp_cooldown_ate';
  const _LL_COOLDOWN_SEG  = 60; // alinhado ao rate-limit do backend

  // Inicia o cooldown e grava o timestamp-alvo. Se 'restaurar' for true, retoma
  // um cooldown já em andamento (ex: usuário recarregou a página).
  function llIniciarCooldown(restaurar) {
    const btn = document.getElementById('ll-reenviar');
    if (!btn) return;
    if (_llCooldownInt) clearInterval(_llCooldownInt);

    let alvo;
    if (restaurar) {
      try { alvo = Number(localStorage.getItem(_LL_COOLDOWN_KEY)) || 0; } catch(e) { alvo = 0; }
      if (!alvo || alvo <= Date.now()) return; // nada a restaurar
    } else {
      alvo = Date.now() + _LL_COOLDOWN_SEG * 1000;
      try { localStorage.setItem(_LL_COOLDOWN_KEY, String(alvo)); } catch(e) {}
    }

    const tick = () => {
      const restante = Math.ceil((alvo - Date.now()) / 1000);
      if (restante <= 0) {
        clearInterval(_llCooldownInt); _llCooldownInt = null;
        btn.disabled = false;
        btn.textContent = 'Reenviar código';
        try { localStorage.removeItem(_LL_COOLDOWN_KEY); } catch(e) {}
      } else {
        btn.disabled = true;
        btn.textContent = `Reenviar em ${restante}s`;
      }
    };
    tick();
    _llCooldownInt = setInterval(tick, 1000);
  }
  function lojaReenviarCodigo() {
    const btn = document.getElementById('ll-reenviar');
    if (btn && btn.disabled) return;
    llOtpReset();
    const hint = document.getElementById('login-codigo-hint');
    if (hint) hint.innerHTML = 'Reenviando código…';
    // reaproveita o fluxo: _lojaWpp já está setado
    lojaRequestCodigo(true);
  }

  /* ── Máscara progressiva de WhatsApp: (15) 9 9999-9999 ─────── */
  function llMascaraWpp(el) {
    // Máscara única (mascararWppBR) — mesma lógica do campo de cadastro.
    el.value = mascararWppBR(el.value);
    // limpa erro ao digitar
    el.classList.remove('invalid');
    const errEl = document.getElementById('ll-wpp-err');
    if (errEl) errEl.classList.remove('show');
  }

  function llWppErro(msg) {
    const input = document.getElementById('ll-wpp');
    const errEl = document.getElementById('ll-wpp-err');
    if (input) input.classList.add('invalid');
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
  }

  /* ── Passo 1: solicita código ──────────────────────────────── */
  async function lojaRequestCodigo(_ehReenvio) {
    const wppRaw = document.getElementById('ll-wpp').value.replace(/\D/g,'');
    const wpp = wppRaw.startsWith('55') ? wppRaw : '55' + wppRaw;
    if (wpp.length < 12) {
      llWppErro('Digite o número completo com DDD.');
      return;
    }
    _lojaWpp = wpp;

    // Fix: no reenvio o usuário está no step 2 — o botão do step 1 está oculto.
    // Mostra o loading no botão correto conforme o contexto.
    const btn = _ehReenvio
      ? document.getElementById('ll-reenviar')
      : document.querySelector('#login-step1 .modal-submit');
    const _btnLabelOrig = btn ? btn.innerHTML : '';
    if (btn) {
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> ' + (_ehReenvio ? 'Reenviando...' : 'Solicitando...');
      btn.disabled = true;
    }

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaRequestCodigo', wpp }));
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', body: params,
        signal: AbortSignal.timeout(30000),
      });
      const json = await resp.json();

      // Fix: backend devolve status:'ok' com cooldown:true quando o código já foi pedido
      // há pouco (rate-limit). Tratar como sucesso mostrava "código enviado" sem enviar nada.
      if (json.status === 'ok' && (json.data?.cooldown || json.cooldown)) {
        loginStep(2);
        const hintEl = document.getElementById('login-codigo-hint');
        if (hintEl) hintEl.textContent = json.msg || 'Código já enviado há pouco. Aguarde antes de pedir outro.';
        setTimeout(() => { llOtpFocus(0); }, 120);
        llIniciarCooldown();
      } else if (json.status === 'ok') {
        loginStep(2);
        document.getElementById('login-loja-sub').textContent = 'Pedido recebido! Vamos te mandar o código no WhatsApp em alguns minutos.';

        // ── Preenche card de identidade da loja ─────────────────
        const infoLoja = json.data || {};
        const cardEl = document.getElementById('login-loja-card');
        if (cardEl) {
          cardEl.style.display = '';

          // Nome e ramo
          const nomeEl = document.getElementById('login-loja-nome');
          const ramoEl = document.getElementById('login-loja-ramo');
          if (nomeEl) nomeEl.textContent = infoLoja.nome || '—';
          if (ramoEl) ramoEl.textContent = infoLoja.ramo || '';

          // Badge de plano
          const badgeEl = document.getElementById('login-loja-badge');
          if (badgeEl) {
            const plano = (infoLoja.plano || 'GRATIS').toUpperCase();
            if (plano === 'PRO') {
              badgeEl.textContent = '⭐ PRO';
              badgeEl.style.background = 'linear-gradient(135deg, var(--plano-pro-1), var(--plano-pro-2))';
              badgeEl.style.color = '#000';
            } else if (plano === 'PLUS') {
              badgeEl.textContent = '✦ PLUS';
              badgeEl.style.background = 'linear-gradient(135deg, var(--plano-plus-1), var(--plano-plus-2))';
              badgeEl.style.color = '#fff';
            } else {
              badgeEl.textContent = 'GRÁTIS';
              badgeEl.style.background = 'rgba(122,122,122,0.3)';
              badgeEl.style.color = 'rgba(255,255,255,0.6)';
            }
          }

          // Logo da loja
          const logoImg   = document.getElementById('login-loja-logo-img');
          const logoEmoji = document.getElementById('login-loja-logo-emoji');
          if (logoImg && logoEmoji) {
            if (infoLoja.logo) {
              logoImg.src = infoLoja.logo;
              logoImg.style.display = '';
              logoEmoji.style.display = 'none';
            } else {
              logoImg.style.display = 'none';
              logoEmoji.style.display = '';
              // Tenta achar emoji na lista já carregada
              const lojaLocal = LOJAS.find(l => l.nome === infoLoja.nome);
              logoEmoji.textContent = lojaLocal?.emoji || '🏪';
            }
          }

          // BG foto de capa (borrada)
          const bgEl = document.getElementById('login-loja-bg');
          if (bgEl) {
            if (infoLoja.foto) {
              bgEl.style.backgroundImage = `url('${infoLoja.foto}')`;
              bgEl.style.display = '';
            } else {
              bgEl.style.display = 'none';
            }
          }

          // Cor de fundo baseada em categoria quando não tem foto
          const bgColorEl = document.getElementById('login-loja-bg-color');
          if (bgColorEl) {
            const cat = infoLoja.categoria || infoLoja.ramo || '';
            const catBg = CAT_BG[cat] || 'rgba(99,102,241,0.15)';
            bgColorEl.style.background = `linear-gradient(135deg,${catBg},rgba(13,13,13,0.9))`;
          }
        }

        setTimeout(() => { llOtpFocus(0); }, 120);
        llIniciarTimer();
        llIniciarCooldown();
      } else if (json.msg === 'WPP_NAO_ENCONTRADO') {
        llWppErro('Número não encontrado. Confira o WhatsApp ou use "Cadastrar".');
      } else if (json.msg === 'LOJA_NAO_APROVADA') {
        llWppErro('Seu cadastro ainda não foi aprovado. Dúvidas? Fale com a gente pelo WhatsApp.');
      } else {
        llWppErro(json.msg || 'Erro ao solicitar. Tente novamente.');
      }
    } catch(e) {
      // Timeout não significa falha: o backend quase sempre já gerou e enviou
      // o código (o e-mail/WhatsApp chega), só não devolveu a resposta a tempo.
      // Em vez de travar, avança para a tela do código.
      const ehTimeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      if (ehTimeout) {
        loginStep(2);
        document.getElementById('login-loja-sub').textContent =
          'Se você está cadastrado, vamos te mandar o código no WhatsApp em alguns minutos.';
        const cardEl = document.getElementById('login-loja-card');
        if (cardEl) cardEl.style.display = 'none';
        setTimeout(() => { llOtpFocus(0); }, 120);
        llIniciarTimer();
        llIniciarCooldown();
      } else {
        llWppErro('Erro de conexão. Verifique sua internet.');
      }
    } finally {
      // Fix: restaura o botão certo. No reenvio o cooldown (llIniciarCooldown) cuida do
      // texto/disabled do link; só restauramos o botão do step 1 aqui.
      if (btn && !_ehReenvio) {
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Receber código';
        btn.disabled = false;
      } else if (btn && _ehReenvio && !btn.disabled) {
        btn.innerHTML = _btnLabelOrig || 'Reenviar código';
      }
    }
  }

  /* ── Passo 2: verifica código ─────────────────────────────── */
  async function lojaVerificarCodigo() {
    if (_llVerificando) return;            // evita disparo duplo (auto + clique)
    const codigo = (document.getElementById('ll-codigo').value || '').trim();
    if (!/^\d{6}$/.test(codigo)) {
      document.getElementById('login-codigo-hint').textContent = 'O código tem 6 dígitos.';
      return;
    }
    _llVerificando = true;

    const btn = document.querySelector('#login-step2 .modal-submit');
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaVerificarCodigo', wpp: _lojaWpp, codigo }));
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', body: params,
        signal: AbortSignal.timeout(30000),
      });
      const json = await resp.json();

      if (json.status === 'ok' && json.data.token) {
        llPararTimer();
        const otp = document.getElementById('ll-otp');
        if (otp) { otp.classList.remove('error'); otp.classList.add('success'); }
        _lojaToken = json.data.token;
        _lojaNome  = json.data.nome || '';
        localStorage.setItem('angatuba_loja_token', _lojaToken);
        localStorage.setItem('angatuba_loja_nome',  _lojaNome);
        localStorage.setItem('angatuba_loja_wpp',   _lojaWpp);
        setTimeout(() => {
          if (history.state?.modal === 'login-loja') history.replaceState({ modal: 'minha-loja' }, '');
          closeLoginLoja();
          atualizarNav();
          abrirMinhaLoja();
        }, 350);
      } else if (json.msg === 'CODIGO_INVALIDO') {
        llOtpErro('❌ Código inválido. Confira os dígitos ou solicite um novo.');
      } else if (json.msg === 'CODIGO_EXPIRADO') {
        llOtpErro('⏱️ Código expirado. Toque em "Reenviar código".');
      } else if (json.msg === 'CODIGO_BLOQUEADO') {
        llOtpErro('🔒 Muitas tentativas. Aguarde e reenvie o código.');
      } else {
        llOtpErro(json.msg || 'Erro ao verificar. Tente novamente.');
      }
    } catch(e) {
      const ehTimeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      const hintEl = document.getElementById('login-codigo-hint');
      if (ehTimeout && hintEl) {
        hintEl.textContent = '⏱️ O servidor demorou a responder. Aguarde alguns segundos e toque em Confirmar de novo.';
      } else {
        mlToast('Erro de conexão. Verifique sua internet.', 'erro');
      }
    } finally {
      _llVerificando = false;
      btn.innerHTML = '<i class="fa fa-check"></i> Confirmar código';
      btn.disabled = false;
    }
  }

  // Atualiza só o badge de plano no hero do painel. Extraído para ser reutilizado
  // pelo polling pós-pagamento (atualiza ao vivo mesmo fora do _aplicarDadosLoja).
  function _aplicarBadgePlano(plano) {
    const planBadge = document.getElementById('ml-plan-badge');
    if (!planBadge) return;
    const p = (plano || 'GRATIS').toUpperCase();
    // Item 12: usa os tokens canônicos de plano (var(--plano-*)) em vez de hex soltos.
    if (p === 'PRO') {
      planBadge.textContent = '⭐ PRO';
      planBadge.style.background = 'linear-gradient(135deg, var(--plano-pro-1), var(--plano-pro-2))';
      planBadge.style.color = '#000';
    } else if (p === 'PLUS') {
      planBadge.textContent = '✦ PLUS';
      planBadge.style.background = 'linear-gradient(135deg, var(--plano-plus-1), var(--plano-plus-2))';
      planBadge.style.color = '#fff';
    } else {
      planBadge.textContent = 'GRÁTIS';
      planBadge.style.background = 'rgba(122,122,122,0.4)';
      planBadge.style.color = 'rgba(255,255,255,0.7)';
    }
  }
  window._aplicarBadgePlano = _aplicarBadgePlano;

  // Aplica dados de lojaDados no painel (usado tanto pelo cache quanto pela API)
  function _aplicarDadosLoja(d, metJson, preservarToggle = false) {
    _lojaNome = d.nome;
    localStorage.setItem('angatuba_loja_nome', _lojaNome);
    // A1: guarda os dados da loja para o checklist de ativação renderizar/re-renderizar
    // (ex.: depois que o cardápio carrega em separado, ver mlCardapioCarregar).
    _mlChecklistD = d;

    document.getElementById('ml-nome').textContent = d.nome;
    document.getElementById('ml-ramo').textContent = d.ramo || '—';

    // ── Hero: foto de capa ────────────────────────────────
    const heroEl    = document.getElementById('ml-hero');
    const heroImgEl = document.getElementById('ml-hero-img');
    const plano     = d.plano || 'GRATIS';
    const isPago    = plano !== 'GRATIS';
    const isPro     = plano === 'PRO';
    _mlPlanoAtual = (plano || 'GRATIS').toUpperCase();
    const isPlus    = plano === 'PLUS';

    // Usa foto/logo do lojaDados; fallback na lista LOJAS já carregada.
    // Item 2: junção por WhatsApp (estável a renomeações), não por nome.
    const lojaLocal = _mlAcharLojaLocal(d);
    const fotoUrl   = d.foto  || lojaLocal?.foto  || '';
    const logoUrl   = d.logo  || lojaLocal?.logo  || '';
    _mlFotoPosSalva = fotoPosCss(d.foto ? d : lojaLocal) || '50% 50%';

    if (isPago && fotoUrl) {
      if (heroImgEl) { heroImgEl.src = fotoUrl; heroImgEl.style.display = ''; heroImgEl.style.objectPosition = _mlFotoPosSalva; }
      if (heroEl) heroEl.style.background = '#0d0d0d';
    } else {
      if (heroImgEl) heroImgEl.style.display = 'none';
      const cat   = lojaLocal?.categoria || '';
      const catBg = CAT_BG[cat] || 'rgba(99,102,241,0.12)';
      if (heroEl) heroEl.style.background = `linear-gradient(135deg, ${catBg} 0%, #0d0d0d 100%)`;
    }

    // ── Logo / emoji ──────────────────────────────────────
    const logoImgEl = document.getElementById('ml-logo-img');
    const emojiEl   = document.getElementById('ml-emoji');

    if (isPago && logoUrl) {
      if (logoImgEl) { logoImgEl.src = logoUrl; logoImgEl.style.display = ''; }
      if (emojiEl)   emojiEl.style.display = 'none';
    } else {
      if (logoImgEl) logoImgEl.style.display = 'none';
      if (emojiEl) {
        emojiEl.style.display = '';
        emojiEl.textContent = lojaLocal?.emoji || '🏪';
      }
    }

    // Badge de plano
    _aplicarBadgePlano(plano);

    // ── Instagram da loja ─────────────────────────────────
    const mlIgWrap = document.getElementById('ml-instagram-wrap');
    if (mlIgWrap) {
      mlIgWrap.style.display = '';
      const igHandleAtual = _igHandleSeguro(d.instagram);
      mlIgWrap.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;">
          <div style="position:relative;flex:1;display:flex;align-items:center;">
            <span style="position:absolute;left:11px;color:#e1306c;font-size:13px;pointer-events:none;">
              <i class="fab fa-instagram"></i>
            </span>
            <input type="text" id="ml-ig-input" value="${igHandleAtual ? '@'+igHandleAtual : ''}"
              placeholder="@nomedoperfil"
              style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:9px;
                     padding:9px 10px 9px 32px;font-size:12px;color:var(--text);box-sizing:border-box;"/>
          </div>
          <button onclick="mlSalvarInstagram()" id="ml-ig-save-btn"
            style="flex-shrink:0;padding:9px 14px;border-radius:9px;
                   background:linear-gradient(135deg,#e1306c,#c13584);color:#fff;
                   font-family:var(--font-h);font-size:11px;font-weight:800;border:none;cursor:pointer;">
            Salvar
          </button>
        </div>
        ${igHandleAtual ? `
        <a href="https://instagram.com/${igHandleAtual}" target="_blank" rel="noopener"
          style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:#e1306c;text-decoration:none;">
          <i class="fa fa-external-link-alt" style="font-size:9px;"></i> Ver perfil atual: @${igHandleAtual}
        </a>` : ''}
        <div id="ml-ig-status" role="status" aria-live="polite" style="font-size:10px;margin-top:6px;min-height:13px;"></div>`;
    }

    // ── Toggle FazEntrega ─────────────────────────────────
    // Informacoes da loja (nome, telefone, endereco, horario, tags, descricao)
    if (typeof window.mlRenderInfo === 'function') window.mlRenderInfo(d);

    const mlEntregaWrap = document.getElementById('ml-entrega-wrap');
    if (mlEntregaWrap) {
      const entregaOn = !!d.fazEntrega;
      // Item 15: rótulo textual do estado ao lado do switch (antes a cor era o único
      // sinal de on/off, destoando dos botões de status que dizem o estado por extenso).
      // Item 12: cor verde padronizada em var(--green) (era #10b981, fora da paleta).
      mlEntregaWrap.innerHTML = `
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;">
          <span style="font-size:12px;color:var(--text);line-height:1.4;">Fazemos entrega</span>
          <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span id="ml-entrega-label" style="font-size:11px;font-weight:700;color:${entregaOn ? 'var(--green)' : 'var(--muted)'};min-width:64px;text-align:right;">${entregaOn ? 'Ativado' : 'Desativado'}</span>
            <div id="ml-entrega-toggle"
              onclick="mlToggleEntrega()"
              role="switch" tabindex="0" aria-checked="${entregaOn ? 'true' : 'false'}" aria-label="Fazemos entrega"
              data-ativo="${entregaOn ? '1' : '0'}"
              style="flex-shrink:0;width:42px;height:24px;border-radius:12px;
                     background:${entregaOn ? 'var(--green)' : 'var(--border)'};
                     position:relative;cursor:pointer;transition:background .2s;">
              <div style="position:absolute;top:3px;left:${entregaOn ? '21px' : '3px'};
                          width:18px;height:18px;border-radius:50%;background:#fff;
                          transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3);"
                   id="ml-entrega-thumb"></div>
            </div>
          </span>
        </label>
        <div id="ml-entrega-status" role="status" aria-live="polite" style="font-size:10px;margin-top:6px;min-height:13px;color:var(--muted);"></div>
        <!-- Painel de taxa: visível só quando 'Fazemos entrega' está ligado -->
        <div id="ml-taxa-wrap" style="display:${entregaOn ? 'block' : 'none'};margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <div style="font-size:11px;color:var(--text);font-weight:600;margin-bottom:8px;">Como você cobra a entrega?</div>
          <select id="ml-taxa-modo" onchange="mlTaxaModoChange()"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:10px;color:var(--text);font-size:12px;font-family:var(--font-b);box-sizing:border-box;outline:none;-webkit-appearance:none;appearance:none;margin-bottom:8px;">
            <option value="GRATIS">🎉 Entrega grátis (não cobro)</option>
            <option value="FIXA">💵 Valor fixo</option>
            <option value="MINIMO">🎁 Grátis acima de um valor</option>
            <option value="COMBINAR">💬 A combinar com o cliente</option>
          </select>
          <!-- Campo: valor fixo -->
          <div id="ml-taxa-fixa-box" style="display:none;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 10px;">
              <span style="font-size:12px;color:var(--muted);">R$</span>
              <input type="text" id="ml-taxa-fixa-val" inputmode="decimal" placeholder="5,00"
                style="flex:1;background:none;border:none;color:var(--text);font-size:12px;font-family:var(--font-b);outline:none;">
            </div>
          </div>
          <!-- Campos: mínimo (piso + taxa) -->
          <div id="ml-taxa-min-box" style="display:none;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 10px;margin-bottom:6px;">
              <span style="font-size:11px;color:var(--muted);white-space:nowrap;">Grátis acima de R$</span>
              <input type="text" id="ml-taxa-min-piso" inputmode="decimal" placeholder="100,00"
                style="flex:1;background:none;border:none;color:var(--text);font-size:12px;font-family:var(--font-b);outline:none;">
            </div>
            <div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 10px;">
              <span style="font-size:11px;color:var(--muted);white-space:nowrap;">Senão, cobro R$</span>
              <input type="text" id="ml-taxa-min-val" inputmode="decimal" placeholder="8,00"
                style="flex:1;background:none;border:none;color:var(--text);font-size:12px;font-family:var(--font-b);outline:none;">
            </div>
          </div>
          <button onclick="mlSalvarTaxaEntrega()" id="ml-taxa-salvar-btn"
            style="width:100%;padding:10px;border-radius:9px;background:var(--surface2);border:1px solid var(--green);color:var(--green);font-family:var(--font-h);font-size:12px;font-weight:700;cursor:pointer;">
            Salvar forma de cobrança
          </button>
          <div id="ml-taxa-status" role="status" aria-live="polite" style="font-size:10px;margin-top:6px;min-height:13px;color:var(--muted);"></div>
        </div>`;
      // Preenche a UI de taxa com o valor salvo (parse do formato MODO:VALOR).
      _mlPreencherTaxa(String(d.taxaEntrega || ''));
    }

    // ── Toggle Agendamento (espelho do FazEntrega) ───────────
    const mlAgendWrap = document.getElementById('ml-agendamento-wrap');
    if (mlAgendWrap) {
      const agendOn = !!d.agendamento;
      mlAgendWrap.innerHTML = `
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;">
          <span style="font-size:12px;color:var(--text);line-height:1.4;">Atendo por agendamento</span>
          <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span id="ml-agend-label" style="font-size:11px;font-weight:700;color:${agendOn ? 'var(--green)' : 'var(--muted)'};min-width:64px;text-align:right;">${agendOn ? 'Ativado' : 'Desativado'}</span>
            <div id="ml-agend-toggle"
              onclick="mlToggleAgendamento()"
              role="switch" tabindex="0" aria-checked="${agendOn ? 'true' : 'false'}" aria-label="Atendo por agendamento"
              data-ativo="${agendOn ? '1' : '0'}"
              style="flex-shrink:0;width:42px;height:24px;border-radius:12px;
                     background:${agendOn ? 'var(--green)' : 'var(--border)'};
                     position:relative;cursor:pointer;transition:background .2s;">
              <div style="position:absolute;top:3px;left:${agendOn ? '21px' : '3px'};
                          width:18px;height:18px;border-radius:50%;background:#fff;
                          transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3);"
                   id="ml-agend-thumb"></div>
            </div>
          </span>
        </label>
        <div id="ml-agend-status" role="status" aria-live="polite" style="font-size:10px;margin-top:6px;min-height:13px;color:var(--muted);"></div>`;
    }

    // Toggle — só aplica se o dono não interagiu durante carregamento
    if (!preservarToggle) marcarToggle(d.statusLoja || '');

    // Atualiza hero com status + cliques do dia
    const cliquesHoje = (metJson && metJson.status === 'ok' && metJson.data.metricas)
      ? (metJson.data.metricas.hoje ?? 0) : 0;
    if (typeof mlAtualizarHeroStatus === 'function') {
      mlAtualizarHeroStatus(d.statusLoja || '', cliquesHoje);
    }

    // CTA upgrade
    const upgradeCta = document.getElementById('ml-upgrade-cta');
    upgradeCta.style.display = (plano === 'GRATIS') ? '' : 'none';
    if (plano === 'GRATIS') {
      // A1: WhatsApp vira alternativa secundária — o botão principal agora abre
      // o modal de planos (mlAbrirUpgrade → modal-planos → Mercado Pago).
      const upgradeMsg = encodeURIComponent(`Olá! Sou dono da loja *${d.nome}* no AngatubaON e quero saber mais sobre os planos pagos!`);
      const upgradeUrl = `https://wa.me/${ADMIN_WPP_CONTATO}?text=${upgradeMsg}`;
      _mlUpgradeWppUrl = upgradeUrl;
      const wppLink = document.getElementById('ml-upgrade-wpp-link');
      if (wppLink) wppLink.href = upgradeUrl;
    }

    // ── Banners da aba Hoje: vencimento (#3) e nova avaliação (#5) ──
    mlRenderVencimento(d);
    mlDiasFechadosRender(d.diasFechados || '');
    mlRenderAvaliacaoNova(d);

    // ── Link de compartilhamento (todos os planos) ───────
    const shareSection = document.getElementById('ml-share-section');
    if (shareSection) {
      shareSection.style.display = '';
      mlMontarCompartilhamento(d.nome, d.wpp);
    }

    // ── Upload de imagens (capa: todos · logo: Plus e Pro) ─
    const uploadSection = document.getElementById('ml-upload-section');
    if (uploadSection) {
      uploadSection.style.display = '';
      // Grátis: o seletor de logo vira convite para os planos pagos.
      const logoInput = document.getElementById('ml-up-logo-file');
      if (logoInput) logoInput.disabled = !isPago;
      document.querySelectorAll('label[for="ml-up-logo-file"]').forEach(function (lb) {
        if (!lb.dataset.htmlOrig) lb.dataset.htmlOrig = lb.innerHTML;
        if (isPago) { lb.innerHTML = lb.dataset.htmlOrig; lb.onclick = null; }
        else {
          if (lb.textContent.trim()) lb.innerHTML = '🔒 Logo no Plus/Pro';
          lb.onclick = function (e) { e.preventDefault(); if (typeof mlAbrirUpgrade === 'function') mlAbrirUpgrade(); };
        }
      });
      {
        // Preenche nome/ramo no preview do card
        const nomePreview = document.getElementById('ml-up-nome-preview');
        const ramoPreview = document.getElementById('ml-up-ramo-preview');
        if (nomePreview) nomePreview.textContent = d.nome || '—';
        // Item 14: lojaDados devolve `ramo` (não `categoria`) — usa a fonte real.
        // Antes usava `d.categoria || d.ramo`, e d.categoria era sempre undefined.
        if (ramoPreview) ramoPreview.textContent = d.ramo || '—';
        if (fotoUrl) mlSetPreviewUpload('foto', fotoUrl);
        if (logoUrl) mlSetPreviewUpload('logo', logoUrl);
      }
    }

    // ── Anúncio do dia (Plus = texto; Pro = texto + foto) ──
    const anuncioSection = document.getElementById('ml-anuncio-section');
    if (anuncioSection) {
      const temAnuncio = isPro || isPlus;
      anuncioSection.style.display = temAnuncio ? '' : 'none';

      // Badge dinâmico: Plus ou Pro
      const planoBadgeEl = document.getElementById('ml-anuncio-plano-badge');
      if (planoBadgeEl) planoBadgeEl.textContent = isPro ? 'PRO' : 'PLUS';

      // Seção upload de imagem: só Pro
      const imgSection = document.getElementById('ml-anuncio-img-section');
      if (imgSection) imgSection.style.display = isPro ? '' : 'none';

      if (isPro) {
        // Fase 2: Pro usa lista de stories (até 5). Esconde o card único
        // e carrega a lista do backend.
        var _av = document.getElementById('ml-anuncio-ativo');
        if (_av) _av.style.display = 'none';
        var _lst = document.getElementById('ml-stories-lista');
        var _cnt = document.getElementById('ml-stories-contador');
        if (_lst) _lst.style.display = '';
        if (_cnt) _cnt.style.display = '';
        mlStoriesCarregar();
        // Fase 3: agendamento automático — só Pro.
        var _ag = document.getElementById('ml-agenda-section');
        if (_ag) _ag.style.display = '';
        mlAgendaCarregar();
      } else if (temAnuncio && metJson && metJson.status === 'ok') {
        // PLUS: comportamento Fase 1 (anúncio único de texto).
        if (metJson.data.anuncio) {
          mlExibirAnuncioAtivo(metJson.data.anuncio);
        } else {
          try {
            const cache = localStorage.getItem('angatuba_anuncio');
            if (cache) {
              const obj = JSON.parse(cache);
              if (obj.expira && new Date(obj.expira) > new Date()) {
                mlExibirAnuncioAtivo(obj);
              } else {
                localStorage.removeItem('angatuba_anuncio');
                document.getElementById('ml-anuncio-ativo').style.display = 'none';
              }
            }
          } catch(e) {}
        }
      }
    }

    // ── Métricas ─────────────────────────────────────────
    _mlAplicarMetricas(metJson, isPago, isPro);

    // ── Checklist de ativação (A1) ────────────────────────
    if (typeof mlChecklistRender === 'function') mlChecklistRender();
  }

  // Métricas do painel. Separado de _aplicarDadosLoja para o painel não
  // esperar a chamada lenta de métricas: elas entram quando chegarem.
  function _mlAplicarMetricas(metJson, isPago, isPro) {
    if (metJson && metJson.status === 'ok') {
      const m = metJson.data.metricas || { total:0, wpp:0, tel:0, d7:0, d30:0 };

      // ── Card "Sua semana" (aba Hoje): resumo de 7 dias ──
      const semEl = document.getElementById('ml-semana-card');
      const semTxt = document.getElementById('ml-semana-txt');
      const semSub = document.getElementById('ml-semana-sub');
      if (semEl && semTxt) {
        const v7 = m.views7d || 0, p7 = m.pedidos7d || 0;
        if (isPago) {
          const c7 = m.d7 || 0, cAnt = m.d7ant || 0;
          semTxt.innerHTML = `👀 <strong>${v7}</strong> ${v7 === 1 ? 'visita' : 'visitas'} · 💬 <strong>${c7}</strong> ${c7 === 1 ? 'contato' : 'contatos'} · 🛒 <strong>${p7}</strong> ${p7 === 1 ? 'pedido' : 'pedidos'}` +
            ((m.pedidosValor7d || 0) > 0 ? ` <span style="color:var(--green);">(${fmtBRL(m.pedidosValor7d)})</span>` : '');
          if (semSub) semSub.textContent = (v7 + c7 + p7) === 0
            ? 'Semana começando: mande o link da loja no WhatsApp para atrair visitas.'
            : (cAnt > 0 ? `Contatos: ${c7} nesta semana contra ${cAnt} na anterior.` : 'Últimos 7 dias.');
        } else {
          semTxt.innerHTML = `👀 <strong>${v7}</strong> ${v7 === 1 ? 'pessoa abriu' : 'pessoas abriram'} sua loja nos últimos 7 dias` +
            (p7 > 0 ? ` · 🛒 <strong>${p7}</strong> ${p7 === 1 ? 'pedido' : 'pedidos'}` : '');
          if (semSub) semSub.textContent = v7 === 0
            ? 'Mande o link da loja no WhatsApp e deixe o QR no balcão para atrair visitas.'
            : 'No Plus você vê quem chamou no WhatsApp e quanto os pedidos renderam.';
        }
        semEl.style.display = '';
      }
      const lockEl = document.getElementById('ml-metricas-lock');

      // Badge de novos cliques desde última visita
      const novos = metJson.data.novosCliques ?? 0;
      const tituloMetricas = document.querySelector('#ml-metricas-wrap')?.previousElementSibling;
      if (tituloMetricas && novos > 0) {
        const existeBadge = tituloMetricas.querySelector('.ml-badge-novo');
        if (!existeBadge) {
          tituloMetricas.insertAdjacentHTML('beforeend',
            `<span class="ml-badge-novo">+${novos} hoje</span>`);
        }
      }
      // Item 4: removida a escrita de `angatuba_ultima_visita_<token>` — a chave
      // era gravada aqui mas NUNCA lida em nenhum ponto do código (código morto que
      // ainda acumulava uma chave órfã por sessão no localStorage). O cálculo de
      // "novos cliques hoje" é feito 100% no backend (calcNovosHojeComDados).
      if (typeof mlAtualizarBadgeMetricas === 'function') {
        mlAtualizarBadgeMetricas(novos);
      }

      if (isPago) {
        if (lockEl) lockEl.style.display = 'none';
        document.getElementById('ml-m-7d').textContent    = m.d7   ?? 0;
        document.getElementById('ml-m-30d').textContent   = m.d30  ?? 0;
        document.getElementById('ml-m-total').textContent = m.total ?? 0;
        document.getElementById('ml-m-wpp').textContent   = m.wpp  ?? 0;
        document.getElementById('ml-m-tel').textContent   = m.tel  ?? 0;
        if (document.getElementById('ml-m-ig')) document.getElementById('ml-m-ig').textContent = m.ig ?? 0;
        const pedEl = document.getElementById('ml-m-pedidos');
        if (pedEl) pedEl.textContent = m.pedidos30d ?? 0;
        const pedBtn = document.getElementById('ml-pedidos-btn');
        if (pedBtn) pedBtn.style.display = '';
        const pedValEl = document.getElementById('ml-m-pedidos-valor');
        if (pedValEl) pedValEl.textContent = (m.pedidosValor30d || 0) > 0 ? fmtBRL(m.pedidosValor30d) : '';
      } else {
        // Item 1: plano Grátis NÃO deve renderizar os números detalhados no DOM.
        // O backend já envia só { total, bloqueado } — aqui escrevemos '—' nos
        // campos travados (o overlay de bloqueio cobre o grid) e populamos apenas
        // o total do overlay ("você já tem N cliques"). Nada de dado real no DOM.
        document.getElementById('ml-m-7d').textContent    = '—';
        document.getElementById('ml-m-30d').textContent   = '—';
        document.getElementById('ml-m-total').textContent = '—';
        document.getElementById('ml-m-wpp').textContent   = '—';
        document.getElementById('ml-m-tel').textContent   = '—';
        if (document.getElementById('ml-m-ig')) document.getElementById('ml-m-ig').textContent = '—';
        if (document.getElementById('ml-m-pedidos')) document.getElementById('ml-m-pedidos').textContent = '—';
        if (document.getElementById('ml-pedidos-btn')) document.getElementById('ml-pedidos-btn').style.display = 'none';
        if (document.getElementById('ml-m-pedidos-valor')) document.getElementById('ml-m-pedidos-valor').textContent = '';
        // A2: teaser com copy de dor/valor — usa só o total (já público no
        // GRÁTIS) pra não inventar número nem depender de campo novo do GAS.
        const lockTeaserEl = document.getElementById('ml-lock-teaser');
        if (lockTeaserEl) {
          const total = m.total ?? 0;
          const ped30 = m.pedidos30d ?? 0;
          lockTeaserEl.innerHTML = ped30 > 0
            ? `Sua loja recebeu <strong style="color:#fff;">${ped30}</strong> ${ped30 === 1 ? 'pedido' : 'pedidos'} pelo AngatubaON nos últimos 30 dias.<br>` +
              `No <strong style="color:var(--plano-plus-txt);">Plus</strong> você vê quanto isso rendeu em R$ e de onde vêm os contatos.`
            : total > 0
            ? `Sua loja já despertou interesse: <strong style="color:#fff;">${total}</strong> ${total === 1 ? 'clique registrado' : 'cliques registrados'}.<br>` +
              `No <strong style="color:var(--plano-plus-txt);">Plus</strong> você vê de onde vieram (WhatsApp, telefone) e o que está funcionando.`
            : `Assim que o movimento começar, o <strong style="color:var(--plano-plus-txt);">Plus</strong> mostra de onde vêm os cliques.<br>` +
              `Enquanto isso, complete o checklist da aba <strong>Hoje</strong> pra loja aparecer melhor.`;
        }
        if (lockEl) lockEl.style.display = '';
      }

      // ── Visibilidade / Crescimento / Conversão (só Pro) ──
      mlRenderMetricasExtra(m, isPro);

      // ── Melhor mês histórico (#6, só Pro) ──
      mlRenderMelhorMes(metJson.data.melhorMes, isPro);

      // ── Horário de pico (só Pro) ──────────────────────
      const picoSection = document.getElementById('ml-pico-section');
      if (picoSection) {
        picoSection.style.display = isPro ? '' : 'none';
        if (isPro && metJson.data.pico) {
          requestAnimationFrame(() => mlRenderizarPico(metJson.data.pico));
        }
      }
    }

  }

  /* ══════════════════════════════════════════════════════════════
     CHECKLIST DE ATIVAÇÃO (A1) — aba Hoje do painel
     ----------------------------------------------------------
     Nudge com progresso real: cada item é inferido dos dados da loja
     sempre que dá (nome/ramo, horário, itens do cardápio, foto/logo).
     Só "status testado" precisa de uma flag própria, gravada quando o
     lojista mexe em qualquer toggle de status (ver lojaToggle).
     Persistido por loja (chave por WhatsApp, como o onboarding).
     Cardápio e foto/logo são recursos pagos: no GRÁTIS aparecem como
     linhas "bloqueadas" com CTA de upgrade, e NÃO contam no total —
     assim uma loja Grátis também consegue chegar a "100%" nos itens
     que ela pode de fato completar.
  ══════════════════════════════════════════════════════════════ */
  function _mlChecklistKey() {
    const n = _wppFlagOnb();
    return n ? ('angatuba_ml_checklist_' + n) : '';
  }
  function _mlChecklistState() {
    const key = _mlChecklistKey();
    const padrao = { dismissed: false, statusTestado: false };
    if (!key) return padrao;
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      return Object.assign({}, padrao, raw || {});
    } catch (e) { return padrao; }
  }
  function _mlChecklistSalvar(state) {
    const key = _mlChecklistKey();
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
  }

  // Chamado pelo toggle de status (lojaToggle) assim que o lojista mexe em
  // Aberto/Já voltamos/Fechado com sucesso — não dá pra inferir isso só
  // olhando o status atual, por isso precisa de uma flag própria.
  function mlChecklistMarcarStatusTestado() { mlChecklistMarcar('statusTestado'); }
  // Marca uma tarefa do checklist que não dá pra inferir dos dados
  // ('statusTestado', 'compartilhou', 'qrBaixado').
  function mlChecklistMarcar(flag) {
    if (!_mlChecklistKey()) return;
    const state = _mlChecklistState();
    if (state[flag]) return; // já marcado — evita gravação redundante
    state[flag] = true;
    _mlChecklistSalvar(state);
    mlChecklistRender();
  }
  window.mlChecklistMarcar = mlChecklistMarcar;

  // "Dispensar" esconde o card (progresso continua salvo).
  function mlChecklistDispensar() {
    const state = _mlChecklistState();
    state.dismissed = true;
    _mlChecklistSalvar(state);
    const card = document.getElementById('ml-checklist');
    if (card) card.style.display = 'none';
  }
  window.mlChecklistDispensar = mlChecklistDispensar;

  // Toque num item incompleto: troca de aba e rola o alvo pra dentro da tela.
  function mlChecklistIrPara(tab, sel) {
    if (tab && typeof mlSwitchTab === 'function') { try { mlSwitchTab(tab); } catch (e) {} }
    if (sel) {
      setTimeout(function () {
        const el = document.querySelector(sel);
        if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
      }, 60);
    }
  }
  window.mlChecklistIrPara = mlChecklistIrPara;

  function mlChecklistRender() {
    const card = document.getElementById('ml-checklist');
    if (!card) return;
    const d = _mlChecklistD;
    if (!d || !_lojaToken) { card.style.display = 'none'; return; }

    const state = _mlChecklistState();
    if (state.dismissed) { card.style.display = 'none'; return; }

    const plano  = (d.plano || _mlPlanoAtual || 'GRATIS').toUpperCase();
    const isPago = plano !== 'GRATIS';
    const cardapioAtivos = (typeof _cardapioItens !== 'undefined' ? _cardapioItens : [])
      .filter(function (i) { return i.ativo !== 'NAO'; }).length;

    const itens = [
      {
        id: 'status', titulo: 'Status testado',
        done: !!state.statusTestado,
        tab: 'hoje', sel: '.toggle-status-btn[data-status="ABERTO"]'
      },
      {
        id: 'horario', titulo: 'Horário preenchido',
        done: !!(d.horario && String(d.horario).trim()),
        tab: 'loja', sel: '#ml-info-section'
      },
      {
        id: 'foto', titulo: isPago ? 'Foto ou logo da loja' : 'Foto de capa da loja',
        done: !!(d.foto || (isPago && d.logo)),
        tab: 'loja', sel: '#ml-upload-section'
      },
      {
        id: 'compartilhou', titulo: 'Mande o link da loja no WhatsApp',
        done: !!state.compartilhou,
        tab: 'loja', sel: '#ml-share-section'
      },
      {
        id: 'qr', titulo: 'Baixe o QR code para o balcão',
        done: !!state.qrBaixado,
        tab: 'loja', sel: '#ml-share-qr-btn'
      },
      isPago ? {
        id: 'cardapio', titulo: 'Cardápio com pelo menos 1 item',
        done: cardapioAtivos > 0,
        tab: 'loja', sel: '#ml-cardapio-add-btn'
      } : {
        id: 'cardapio', locked: true,
        titulo: 'Cardápio (Plus/Pro)',
        texto: 'No Grátis sua loja aparece na lista. No Plus você monta o cardápio e o cliente pede pelo WhatsApp com os itens.'
      }
    ];

    const contaveis = itens.filter(function (i) { return !i.locked; });
    const feitos = contaveis.filter(function (i) { return i.done; }).length;
    const total  = contaveis.length;
    const pct    = total ? Math.round((feitos / total) * 100) : 100;
    const tudoOk = total > 0 && feitos === total;

    card.style.display = '';
    const bar = document.getElementById('ml-checklist-bar');
    if (bar) bar.style.width = pct + '%';
    const titulo = document.getElementById('ml-checklist-titulo');
    if (titulo) titulo.textContent = tudoOk
      ? 'Sua loja está redonda! 🎉'
      : ('Deixe sua loja redonda · ' + feitos + ' de ' + total);

    const lista = document.getElementById('ml-checklist-itens');
    if (lista) {
      lista.innerHTML = itens.map(function (item) {
        if (item.locked) {
          return '<div class="ml-checklist-item ml-checklist-item-locked">' +
            '<div class="ml-checklist-item-locked-head"><span class="ml-checklist-check">🔒</span>' +
            '<span class="ml-checklist-txt">' + escHTML(item.titulo) + '</span></div>' +
            '<div class="ml-checklist-locked-texto">' + escHTML(item.texto) + '</div>' +
            '<button type="button" class="ml-checklist-upsell-btn" onclick="mlAbrirUpgrade()">⭐ Ver planos</button>' +
          '</div>';
        }
        const acao = "mlChecklistIrPara('" + item.tab + "','" + item.sel.replace(/'/g, "\\'") + "')";
        return '<button type="button" class="ml-checklist-item' + (item.done ? ' done' : '') + '" onclick="' + acao + '">' +
          '<span class="ml-checklist-check">' + (item.done ? '✓' : '○') + '</span>' +
          '<span class="ml-checklist-txt">' + escHTML(item.titulo) + '</span>' +
          (item.done ? '' : '<span class="ml-checklist-seta">›</span>') +
        '</button>';
      }).join('');
    }

    const completoEl = document.getElementById('ml-checklist-completo');
    if (completoEl) completoEl.style.display = tudoOk ? '' : 'none';
  }
  window.mlChecklistRender = mlChecklistRender;

  // ── Banner de vencimento do plano (#3) ───────────────────
  // Usa d.planoValidade ('dd/mm/yyyy') que já vem do backend. Mostra o banner
  // quando faltam <= 7 dias, ou quando já venceu (edge: cache antigo). Só pagas.
  function mlRenderVencimento(d) {
    const banner = document.getElementById('ml-vencimento-banner');
    if (!banner) return;
    const plano = (d.plano || 'GRATIS').toUpperCase();
    const val   = String(d.planoValidade || '').trim();
    // Grátis, ou sem validade (vitalício admin): nunca mostra.
    if (plano === 'GRATIS' || !val) { banner.style.display = 'none'; return; }
    const partes = val.split('/');
    if (partes.length !== 3) { banner.style.display = 'none'; return; }
    // Meia-noite BRT do dia de validade vs. hoje BRT (mesma referência do backend)
    const validade = new Date(Date.UTC(
      parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10), 3, 0, 0));
    const now  = new Date();
    const hoje = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
    const dias = Math.round((validade.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));

    const titulo = document.getElementById('ml-vencimento-titulo');
    const texto  = document.getElementById('ml-vencimento-texto');
    const owl    = document.getElementById('ml-vencimento-owl');
    const nomePlano = plano === 'PRO' ? 'Pro' : 'Plus';

    // Só avisa a partir de 7 dias antes. Mais que isso: não incomoda.
    if (dias > 7) { banner.style.display = 'none'; return; }

    let urgente = false;
    let msg = '';
    if (dias > 1) {
      msg = `Seu plano ${nomePlano} vence em ${dias} dias. Renove para não perder o destaque e as métricas.`;
    } else if (dias === 1) {
      urgente = true;
      msg = `Seu plano ${nomePlano} vence amanhã. Renove para não cair para o Grátis.`;
    } else if (dias === 0) {
      urgente = true;
      msg = `Seu plano ${nomePlano} vence hoje. Renove agora para não perder seus benefícios.`;
    } else if (dias >= -3) {
      // Carência (CARENCIA_DIAS do GAS): venceu, mas a loja segue com o plano
      urgente = true;
      const fimCar = new Date(validade.getTime() + 3 * 24 * 60 * 60 * 1000 - 3 * 3600 * 1000);
      const fimTxt = ('0' + fimCar.getUTCDate()).slice(-2) + '/' + ('0' + (fimCar.getUTCMonth() + 1)).slice(-2);
      msg = dias === -3
        ? `Último dia: seu plano ${nomePlano} venceu e amanhã a loja volta para o Grátis. Renove agora.`
        : `Seu plano ${nomePlano} venceu, mas sua loja segue com os benefícios até ${fimTxt}. Renove para não perder nada.`;
    } else {
      // já venceu (backend ainda não rebaixou, ou cache antigo)
      urgente = true;
      msg = `Seu plano ${nomePlano} venceu. Renove para reativar o destaque e as métricas.`;
    }

    // Cor: âmbar (aviso) até 2 dias, vermelho (urgente) em 0/1/vencido
    if (urgente) {
      banner.style.background = 'linear-gradient(135deg,rgba(239,68,68,0.14),rgba(239,68,68,0.05))';
      banner.style.border = '1px solid rgba(239,68,68,0.35)';
      if (titulo) titulo.style.color = 'var(--red)';
      if (owl) owl.src = '/webp/owl-empty-wallet.webp';
    } else {
      banner.style.background = 'linear-gradient(135deg,rgba(245,158,11,0.14),rgba(245,158,11,0.05))';
      banner.style.border = '1px solid rgba(245,158,11,0.3)';
      if (titulo) titulo.style.color = 'var(--zap)';
      if (owl) owl.src = '/webp/owl-sign.webp';
    }
    if (texto) texto.textContent = msg;
    banner.style.display = 'flex';
  }

  // ── Banner de nova avaliação (#5, só pagas) ──────────────
  // Compara nº de avaliações atual (da lista pública LOJAS) com o total
  // guardado na última visita ao painel. Se aumentou, avisa. Chave por loja.
  function mlRenderAvaliacaoNova(d) {
    const banner = document.getElementById('ml-aval-nova-banner');
    if (!banner) return;
    const plano = (d.plano || 'GRATIS').toUpperCase();
    if (plano === 'GRATIS') { banner.style.display = 'none'; return; }

    // Item 2: junção por WhatsApp (estável a renomeações), não por nome.
    const lojaLocal = _mlAcharLojaLocal(d);
    const avals = (lojaLocal && lojaLocal.avaliacoes) ? lojaLocal.avaliacoes : null;
    // Sem dados de avaliação carregados ainda: não arrisca falso positivo.
    if (!avals) { banner.style.display = 'none'; return; }
    const atual = avals.length;

    const chave = `angatuba_aval_count_${toSlug(d.nome)}`;
    let anterior = null;
    try {
      const v = localStorage.getItem(chave);
      if (v !== null) anterior = parseInt(v, 10);
    } catch(e) {}

    // Primeira visita (sem baseline): só registra, não mostra banner.
    if (anterior === null || isNaN(anterior)) {
      try { localStorage.setItem(chave, String(atual)); } catch(e) {}
      banner.style.display = 'none';
      return;
    }

    const novas = atual - anterior;
    if (novas <= 0) {
      // Empatou ou diminuiu (avaliação removida/sinalizada): atualiza baseline.
      try { localStorage.setItem(chave, String(atual)); } catch(e) {}
      banner.style.display = 'none';
      return;
    }

    // Há avaliações novas: monta mensagem com a nota mais recente, se houver.
    const texto = document.getElementById('ml-aval-nova-texto');
    let msg;
    if (novas === 1) {
      // Tenta destacar a nota da avaliação mais recente (última do array)
      const ultima = avals[avals.length - 1];
      const nota = ultima && ultima.nota ? ultima.nota : null;
      msg = nota
        ? `Você recebeu uma nova avaliação ${nota}★! Toque para ver.`
        : `Você recebeu uma nova avaliação! Toque para ver.`;
    } else {
      msg = `Você recebeu ${novas} novas avaliações! Toque para ver.`;
    }
    if (texto) texto.textContent = msg;
    banner.style.display = 'flex';

    // NÃO atualiza o baseline aqui: só depois que o lojista abrir as avaliações
    // (mlIrParaAvaliacoes). Assim o aviso persiste até ele de fato conferir.
    banner.dataset.avalCount = String(atual);
    banner.dataset.avalChave = chave;
  }

  // Abre os detalhes públicos da própria loja (onde ficam as avaliações)
  // e zera o baseline de "novas avaliações".
  window.mlIrParaAvaliacoes = function() {
    const banner = document.getElementById('ml-aval-nova-banner');
    // Consolida baseline: o lojista está indo conferir.
    if (banner && banner.dataset.avalChave) {
      try { localStorage.setItem(banner.dataset.avalChave, banner.dataset.avalCount || '0'); } catch(e) {}
      banner.style.display = 'none';
    }
    const nome = _lojaNome || localStorage.getItem('angatuba_loja_nome') || '';
    // Item 2: acha a própria loja por WhatsApp (estável a renomeações); nome é fallback.
    const idx = _mlAcharIdxLojaLocal(null, nome);
    if (idx < 0) return;
    // Fecha o painel e abre os detalhes da loja
    if (typeof fecharMinhaLoja === 'function') fecharMinhaLoja();
    setTimeout(() => { if (typeof abrirDetalhes === 'function') abrirDetalhes(idx); }, 200);
  };

  // Botão "Renovar" do banner de vencimento → WhatsApp de contato (mesmo do upgrade)
  // Renovar em 1 toque: vai direto ao Checkout do Mercado Pago (plano atual,
  // mensal). Se falhar, iniciarPagamentoMP já oferece o WhatsApp como saída.
  window.mlRenovarPlano = function() {
    const wpp   = _lojaWpp || localStorage.getItem('angatuba_loja_wpp') || '';
    const plano = String(_mlPlanoAtual || '').toUpperCase();
    if (wpp && (plano === 'PLUS' || plano === 'PRO')) {
      iniciarPagamentoMP(wpp, plano, 'mensal', document.getElementById('ml-vencimento-btn'));
      return;
    }
    const nome = _lojaNome || localStorage.getItem('angatuba_loja_nome') || 'minha loja';
    const msg = encodeURIComponent(`Olá! Sou dono da loja *${nome}* no AngatubaON e quero renovar meu plano.`);
    window.open(`https://wa.me/${ADMIN_WPP_CONTATO}?text=${msg}`, '_blank', 'noopener');
  };

  // ── Card "Seu melhor mês" (#6, só Pro) ───────────────────
  // Recebe { rotulo, total, ym } do backend (calcMelhorMesComDados) ou null.
  function mlRenderMelhorMes(mm, isPro) {
    const box = document.getElementById('ml-melhormes-box');
    if (!box) return;
    if (!isPro || !mm || !mm.total) { box.style.display = 'none'; return; }

    const elRot   = document.getElementById('ml-melhormes-rotulo');
    const elTotal = document.getElementById('ml-melhormes-total');
    const elMsg   = document.getElementById('ml-melhormes-msg');
    if (elRot)   elRot.textContent = mm.rotulo || '—';
    if (elTotal) elTotal.textContent = mm.total;

    if (elMsg) {
      // Se o melhor mês é o mês atual, celebra recorde em andamento.
      const now = new Date();
      const ymAtual = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
      if (mm.ym === ymAtual) {
        elMsg.textContent = 'É este mês! Você está batendo seu próprio recorde. 🚀';
      } else {
        elMsg.textContent = `Seu recorde de cliques de contato num único mês. Bora superar?`;
      }
    }
    box.style.display = '';
  }

  // Renderiza os blocos extra de métricas: visualizações, crescimento semanal
  // e conversão por canal. Exclusivos do plano Pro. Tudo a partir do objeto
  // que o backend já devolve.
  function mlRenderMetricasExtra(m, isPro) {
    const visRow   = document.getElementById('ml-visibilidade-row');
    const crescBox = document.getElementById('ml-crescimento-box');
    const convBox  = document.getElementById('ml-conversao-box');

    // Só Pro: nos demais planos esses blocos ficam escondidos.
    if (!isPro) {
      if (visRow)   visRow.style.display   = 'none';
      if (crescBox) crescBox.style.display = 'none';
      if (convBox)  convBox.style.display  = 'none';
      const taxaBoxHide = document.getElementById('ml-taxaconv-box');
      if (taxaBoxHide) taxaBoxHide.style.display = 'none';
      return;
    }

    const views = m.views ?? 0;
    const menu  = m.menu  ?? 0;
    const wpp   = m.wpp   ?? 0;
    const tel   = m.tel   ?? 0;
    const ig    = m.ig    ?? 0;
    const totalContato = wpp + tel + ig;

    // ── Visualizações ──
    if (visRow) {
      const elV = document.getElementById('ml-m-views');
      const elM = document.getElementById('ml-m-menu');
      if (elV) elV.textContent = views;
      if (elM) elM.textContent = menu;
      visRow.style.display = 'flex';
    }

    // ── Viram anúncio — HOJE, não acumulado ──────────────────
    //  O total de 90 dias não dizia nada: com story diário, a view de
    //  ontem somava com a de hoje e o número só crescia. Agora mostra o
    //  número do dia com comparação, que é o que responde 'tá indo bem?'.
    const anunHoje  = m.anunHoje  ?? 0;
    const anunOntem = m.anunOntem ?? 0;
    const anun7d    = m.anun7d    ?? 0;
    const anuncioCard = document.getElementById('ml-m-anuncio-card');
    const elAnuncio = document.getElementById('ml-m-anuncio');
    if (anuncioCard && elAnuncio) {
      if (anunHoje > 0 || anun7d > 0) {
        elAnuncio.textContent = anunHoje;
        // Sublegenda: comparação com ontem.
        var subEl = document.getElementById('ml-m-anuncio-sub');
        if (subEl) {
          var txt = '';
          if (anunOntem > 0) {
            var dif = anunHoje - anunOntem;
            if (dif > 0)      txt = '\u2191 ' + dif + ' a mais que ontem';
            else if (dif < 0) txt = '\u2193 ' + Math.abs(dif) + ' a menos que ontem';
            else              txt = 'igual a ontem (' + anunOntem + ')';
          } else if (anunHoje > 0) {
            txt = 'primeiro dia com views';
          } else {
            txt = 'ontem foram ' + anunOntem;
          }
          subEl.textContent = txt;
        }
        // Total dos 7 dias — contexto sem poluir o número principal.
        var sem = document.getElementById('ml-m-anuncio-7d');
        if (sem) sem.textContent = anun7d + ' nos últimos 7 dias';
        anuncioCard.style.display = '';
      } else {
        anuncioCard.style.display = 'none';
      }
    }

    // ── Qual story rendeu mais (7 dias) ─────────────────────
    try {
      var porStory = m.anunPorStory || {};
      var boxTop = document.getElementById('ml-m-anuncio-top');
      if (boxTop) {
        var chaves = Object.keys(porStory);
        if (chaves.length >= 2) {
          chaves.sort(function(x, y){ return porStory[y] - porStory[x]; });
          var melhorId = chaves[0];
          // Casa o ID com o texto do story, se ele ainda existir na lista.
          var achado = null;
          try {
            achado = (_mlStoriesCache || []).filter(function(s){ return s.id === melhorId; })[0];
          } catch(eS) {}
          var rotulo = achado && achado.texto
            ? '"' + escHTML(achado.texto.substring(0, 34)) + '"'
            : 'um anúncio anterior';
          boxTop.innerHTML = '<i class="ti ti-trophy" style="color:var(--zap);"></i> ' +
            'O que mais funcionou: ' + rotulo + ' \u2014 ' + porStory[melhorId] + ' views';
          boxTop.style.display = '';
        } else {
          boxTop.style.display = 'none';
        }
      }
    } catch (eTop) {}

    // ── Taxa de conversão (views → cliques de contato) ──
    const taxaBox = document.getElementById('ml-taxaconv-box');
    if (taxaBox) {
      const elVal = document.getElementById('ml-taxaconv-val');
      const elMsg = document.getElementById('ml-taxaconv-msg');
      if (views === 0) {
        if (elVal) elVal.textContent = '—';
        if (elMsg) elMsg.textContent = 'Quando as pessoas começarem a ver sua loja, mostramos aqui quantas chamam você.';
      } else {
        const taxa = (totalContato / views) * 100;
        // 1 casa decimal só quando < 10%, senão inteiro (fica mais limpo)
        const taxaTxt = taxa < 10 ? taxa.toFixed(1) : Math.round(taxa).toString();
        if (elVal) elVal.textContent = taxaTxt + '%';
        if (elMsg) {
          elMsg.textContent =
            `De cada 100 pessoas que veem sua loja, cerca de ${Math.round(taxa)} entram em contato ` +
            `(${totalContato} de ${views} visualizações).`;
        }
      }
      taxaBox.style.display = '';
    }

    // ── Crescimento semanal (d7 vs d7ant) ──
    if (crescBox) {
      const d7    = m.d7    ?? 0;
      const d7ant = m.d7ant ?? 0;
      const elAtual = document.getElementById('ml-cresc-atual');
      const elBadge = document.getElementById('ml-cresc-badge');
      const elMsg   = document.getElementById('ml-cresc-msg');
      if (elAtual) elAtual.textContent = d7;

      let pct = null;
      if (d7ant > 0) pct = Math.round(((d7 - d7ant) / d7ant) * 100);

      if (elBadge && elMsg) {
        if (d7ant === 0 && d7 === 0) {
          elBadge.textContent = '—';
          elBadge.style.background = 'var(--surface2)';
          elBadge.style.color = 'var(--muted)';
          elMsg.textContent = 'Ainda sem dados suficientes pra comparar com a semana passada.';
        } else if (pct === null) {
          // Semana anterior teve 0, esta teve algo: novo movimento
          elBadge.textContent = '↑ novo';
          elBadge.style.background = 'rgba(37,211,102,0.15)';
          elBadge.style.color = '#25d366';
          elMsg.textContent = `Você teve ${d7} ${d7 === 1 ? 'clique' : 'cliques'} esta semana. Semana passada não houve nenhum.`;
        } else if (pct >= 0) {
          elBadge.textContent = `↑ ${pct}%`;
          elBadge.style.background = 'rgba(37,211,102,0.15)';
          elBadge.style.color = '#25d366';
          elMsg.textContent = `${pct === 0 ? 'Estável' : 'Subiu'} em relação à semana passada (${d7ant} → ${d7}).`;
        } else {
          elBadge.textContent = `↓ ${Math.abs(pct)}%`;
          elBadge.style.background = 'rgba(239,68,68,0.13)';
          elBadge.style.color = 'var(--red)';
          elMsg.textContent = `Caiu em relação à semana passada (${d7ant} → ${d7}). Que tal publicar um anúncio?`;
        }
      }
      crescBox.style.display = '';
    }

    // ── Conversão por canal ──
    if (convBox) {
      const legenda = document.getElementById('ml-conv-legenda');
      const bWpp = document.getElementById('ml-conv-wpp');
      const bTel = document.getElementById('ml-conv-tel');
      const bIg  = document.getElementById('ml-conv-ig');
      if (totalContato === 0) {
        if (bWpp) bWpp.style.width = '0%';
        if (bTel) bTel.style.width = '0%';
        if (bIg)  bIg.style.width  = '0%';
        if (legenda) legenda.textContent = 'Sem contatos registrados ainda.';
      } else {
        const pW = Math.round((wpp / totalContato) * 100);
        const pT = Math.round((tel / totalContato) * 100);
        const pI = Math.max(0, 100 - pW - pT);
        if (bWpp) bWpp.style.width = pW + '%';
        if (bTel) bTel.style.width = pT + '%';
        if (bIg)  bIg.style.width  = pI + '%';
        const partes = [];
        if (wpp) partes.push(`${pW}% WhatsApp`);
        if (tel) partes.push(`${pT}% telefone`);
        if (ig)  partes.push(`${pI}% Instagram`);
        if (legenda) legenda.textContent = partes.join(' · ');
      }
      convBox.style.display = '';
    }
  }

  // ── Dicas da Coruja (painel do lojista) ──────────────────
  const ML_DICAS = [
    'Mantenha seu status sempre atualizado — lojas abertas aparecem primeiro na busca.',
    'Adicione uma foto de capa caprichada: lojas com foto recebem muito mais cliques.',
    'Responda no WhatsApp o mais rápido possível — agilidade fecha mais vendas.',
    'Peça aos clientes satisfeitos para avaliarem sua loja. Estrelas atraem novos clientes.',
    'Confira o endereço e o horário de funcionamento: dados certos evitam clientes perdidos.',
    'Use o botão "Já voltamos" quando sair rapidinho — assim ninguém pensa que fechou de vez.',
    'Compartilhe o link da sua loja nas suas redes sociais para alcançar mais gente.',
    'No plano Pro você adiciona logo, cardápio e vê métricas detalhadas dos seus cliques.',
  ];
  let _mlDicaIdx = -1;

  function mlSortearDica() {
    _mlDicaIdx = Math.floor(Math.random() * ML_DICAS.length);
    mlAplicarDica();
  }
  function mlProximaDica() {
    _mlDicaIdx = (_mlDicaIdx + 1) % ML_DICAS.length;
    mlAplicarDica();
  }
  function mlAplicarDica() {
    const el = document.getElementById('ml-dica-texto');
    if (el) el.textContent = ML_DICAS[_mlDicaIdx] || ML_DICAS[0];
  }
  window.mlProximaDica = mlProximaDica;

  //  ONBOARDING — tour guiado (spotlight) no 1º acesso ao painel
  //  Aparece uma única vez por loja. A chave usa o WhatsApp NORMALIZADO
  //  (DDI 55) para que login e aprovação gerem a mesma flag — sem isso,
  //  conta nova (fluxo de aprovação) não casava com a flag e reaparecia
  //  ou (no caso atual) o número vazio fazia a flag virar 'angatuba_onboarded_'.
  //  Substitui a antiga tela de boas-vindas estática por destaques ancorados
  //  nos elementos reais do painel (status, cardápio, métricas...). Cada passo
  //  troca de aba automaticamente (mlSwitchTab) e rola o alvo pra dentro da tela
  //  antes de medir. Passos de features de plano superior (stories/agenda) são
  //  pulados sozinhos quando o elemento está oculto para o plano atual — então
  //  o mesmo tour serve free, Plus e Pro sem duplicar código.
  //  Reaproveita o CSS .conb-* do tour do cliente (mesmo visual).
  // ══════════════════════════════════════════════════════════
  // Versionada por loja: bump o sufixo (v2 -> v3) para relançar quando
  // adicionar features novas ao painel.
  // A1: v3 — passos agora são filtrados por plano ANTES de trocar de aba
  // (_lojistaOnbEscondidoPorPlano) e o último passo no GRÁTIS vira um CTA
  // de upgrade. Bump para quem já viu o v2 ver a versão nova 1x.
  const LOJISTA_ONB_VER = 'v3';
  function _wppFlagOnb() {
    let n = String(_lojaWpp || localStorage.getItem('angatuba_loja_wpp') || '').replace(/\D/g, '');
    if (n && !n.startsWith('55')) n = '55' + n;
    return n;
  }
  // Passos do tour. `tab` = aba onde o alvo vive (o tour troca sozinho).
  // `sel` = seletor do elemento real. `plano` (opcional) = só faz sentido a
  // partir deste plano, mas a decisão real de mostrar/pular é por VISIBILIDADE
  // (offsetParent), então mesmo sem `plano` um alvo oculto é ignorado.
  const LOJISTA_ONB_STEPS = [
    {
      hero: true, tab: 'hoje',
      owl: '/webp/owl-wave.webp', icon: '👋',
      titulo: '', // preenchido com o nome da loja em runtime
      texto: 'Sua loja está no ar! Deixa eu te mostrar rapidinho o que dá pra fazer aqui no painel.'
    },
    {
      tab: 'hoje', sel: '.toggle-status-btn[data-status="ABERTO"]',
      owl: '/webp/owl-thumbsup.webp', icon: '⚡',
      titulo: 'Abra e feche na hora',
      texto: 'Toque aqui pra mudar seu status <strong>na hora</strong>. O cliente vê Aberto, Já voltamos ou Fechado na mesma hora.'
    },
    {
      tab: 'loja', sel: '#ml-share-section',
      owl: '/webp/owl-phone.webp', icon: '🔗',
      titulo: 'Divulgue sua loja',
      texto: 'Mande o <strong>link da sua loja</strong> no WhatsApp e baixe o <strong>QR code</strong> para deixar no balcão.'
    },
    {
      tab: 'metricas', sel: '#ml-metricas-wrap',
      owl: '/webp/owl-badge.webp', icon: '📊',
      titulo: 'Veja o resultado',
      texto: 'Aqui você vê <strong>quantas pessoas viram</strong> sua loja, <strong>chamaram no WhatsApp</strong> e fizeram <strong>pedido pelo app</strong>.'
    }
  ];
  let _lojistaOnbIdx = 0;
  let _lojistaOnbFlag = '';
  let _lojistaOnbReposHandler = null;

  // Elemento existe E está visível (não display:none, dentro de aba ativa).
  // offsetParent é null quando o elemento (ou um ancestral) está display:none.
  function _lojistaOnbVisivel(sel) {
    if (!sel) return false;
    const el = document.querySelector(sel);
    if (!el) return false;
    if (el.offsetParent === null && el.getClientRects().length === 0) return false;
    return true;
  }

  // A1: alvo escondido por PLANO (feature de plano superior), diferente de
  // escondido só porque a aba dele não está ativa agora. Sobe pelos
  // ancestrais do alvo procurando um display:none inline — mas para assim
  // que chega num .ml-tab-content, porque ESSE display:none é controlado
  // pela troca de aba (mlSwitchTab), não pelo plano da loja. Isso permite
  // filtrar os passos ANTES de trocar de aba, sem falso-positivo pra alvos
  // que só ainda não estão na aba visível.
  function _lojistaOnbEscondidoPorPlano(sel) {
    if (!sel) return false;
    let el = document.querySelector(sel);
    if (!el) return true; // nem existe no DOM — trata como indisponível
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('ml-tab-content')) return false;
      if (el.style && el.style.display === 'none') return true;
      el = el.parentElement;
    }
    return false;
  }

  // Próximo passo "servível" a partir de `from`. Filtra hero, existência no
  // DOM e ocultação por plano de uma vez. Ocultação só por aba inativa (o
  // alvo está numa aba que ainda não foi trocada) NÃO é filtrada aqui — só
  // é checada depois de trocar de aba, em posicionarOnboardingLojista.
  function _lojistaOnbProx(from) {
    for (let i = from; i < LOJISTA_ONB_STEPS.length; i++) {
      const st = LOJISTA_ONB_STEPS[i];
      if (st.hero) return i;
      if (st.sel && document.querySelector(st.sel) && !_lojistaOnbEscondidoPorPlano(st.sel)) return i;
    }
    return -1;
  }

  // Lista de índices efetivamente "servíveis" no momento (mesma regra do
  // _lojistaOnbProx, só que colhendo todos em vez de parar no primeiro).
  // Usado pelas bolinhas do tour pra não contar passo que o plano pula.
  function _lojistaOnbIndicesValidos() {
    const out = [];
    let i = 0;
    while (i < LOJISTA_ONB_STEPS.length) {
      const prox = _lojistaOnbProx(i);
      if (prox < 0) break;
      out.push(prox);
      i = prox + 1;
    }
    return out;
  }

  // O painel está realmente aberto? `.detail-overlay` fechado é opacity:0 com
  // pointer-events:none — NÃO display:none. Ou seja: com o painel fechado os
  // elementos dele continuam no layout, com bounding rect válido, e a checagem
  // de visibilidade do posicionamento (offsetParent/getClientRects) não pega
  // esse caso. Por isso o tour precisa olhar a classe .open explicitamente.
  function _mlPainelAberto() {
    const ov = document.getElementById('modal-minha-loja');
    return !!(ov && ov.classList.contains('open'));
  }

  function mostrarOnboarding(_tentativa) {
    // Sem o painel aberto o tour ancoraria em elementos invisíveis e o "furo"
    // apareceria sobre a tela inicial das lojas. Acontecia quando o painel
    // fechava antes dos 900ms do disparo (voltar do Android, sessão expirada,
    // toque no fundo). Sai sem gravar a flag — o tour continua pendente para
    // a próxima abertura do painel.
    if (!_mlPainelAberto()) return;
    const wppN = _wppFlagOnb();
    // Sem WhatsApp resolvido ainda (token via cache, dados a caminho): tenta de novo
    // até 3x com intervalo curto, em vez de gravar uma flag genérica vazia.
    if (!wppN) {
      const t = (_tentativa || 0) + 1;
      if (t <= 3) { setTimeout(() => mostrarOnboarding(t), 500); }
      return;
    }
    _lojistaOnbFlag = 'angatuba_onboarded_' + LOJISTA_ONB_VER + '_' + wppN;
    try { if (localStorage.getItem(_lojistaOnbFlag) === '1') return; } catch(e) { return; }
    if (document.getElementById('lojista-onb-overlay')) return;

    const nome = (_lojaNome || localStorage.getItem('angatuba_loja_nome') || '').trim();
    const primeiroNome = nome ? nome.split(' ')[0] : '';
    LOJISTA_ONB_STEPS[0].titulo = primeiroNome ? ('Bem-vindo, ' + primeiroNome + '! 🎉') : 'Bem-vindo! 🎉';

    _lojistaOnbIdx = _lojistaOnbProx(0);
    if (_lojistaOnbIdx < 0) { try { localStorage.setItem(_lojistaOnbFlag, '1'); } catch(e) {} return; }

    const ov = document.createElement('div');
    ov.id = 'lojista-onb-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Tour do painel da loja');
    ov.innerHTML =
      '<div class="conb-mask" id="lonb-mask">' +
        '<div class="conb-mask-pane" data-p="top"></div>' +
        '<div class="conb-mask-pane" data-p="right"></div>' +
        '<div class="conb-mask-pane" data-p="bottom"></div>' +
        '<div class="conb-mask-pane" data-p="left"></div>' +
      '</div>' +
      '<div class="conb-ring" id="lonb-ring"></div>' +
      '<button type="button" class="conb-skip" id="lonb-skip" onclick="pularOnboardingLojista()">Pular</button>' +
      '<div class="conb-pop" id="lonb-pop" role="document">' +
        '<div class="conb-pop-arrow" id="lonb-pop-arrow"></div>' +
        '<div class="conb-owl-wrap"><img class="conb-owl" id="lonb-owl" src="" alt="" ' +
          'onerror="if(!this.dataset.f){this.dataset.f=1;this.style.display=\'none\';this.parentNode.nextElementSibling.style.display=\'\';}" /></div>' +
        '<div class="conb-icon" id="lonb-icon"></div>' +
        '<div class="conb-title" id="lonb-title"></div>' +
        '<div class="conb-text" id="lonb-text"></div>' +
        '<div class="conb-foot">' +
          '<div class="conb-dots" id="lonb-dots"></div>' +
          '<button type="button" class="conb-cta" id="lonb-cta" onclick="avancarOnboardingLojista()">Próximo</button>' +
        '</div>' +
      '</div>';
    // Anexa dentro do modal do painel para ficar por cima do conteúdo dele,
    // mas ainda respeitando o container (z-index alto no CSS garante o topo).
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });

    _lojistaOnbReposHandler = function () { posicionarOnboardingLojista(); };
    window.addEventListener('resize', _lojistaOnbReposHandler, { passive: true });
    window.addEventListener('scroll', _lojistaOnbReposHandler, { passive: true, capture: true });
    window.addEventListener('orientationchange', _lojistaOnbReposHandler, { passive: true });

    aplicarPassoLojista();
    if (typeof _focusTrapAtivar === 'function') _focusTrapAtivar(ov);
    try { localStorage.setItem(_lojistaOnbFlag, '1'); } catch(e) {}
  }

  // Troca pra aba do passo, rola o alvo pra dentro da tela, pinta o conteúdo
  // e posiciona. Feito com pequenos delays pra dar tempo do layout assentar
  // (troca de aba mexe em display; scroll precisa de um frame).
  function aplicarPassoLojista() {
    // Painel fechou no meio do tour: encerra em vez de seguir apontando para
    // elementos que ninguém mais vê.
    if (!_mlPainelAberto()) { fecharOnboardingLojista(); return; }
    const s = LOJISTA_ONB_STEPS[_lojistaOnbIdx];
    if (!s) return;
    // 1) Aba certa.
    if (s.tab && typeof mlSwitchTab === 'function') {
      try { mlSwitchTab(s.tab); } catch(e) {}
    }
    // 2) Conteúdo do balão.
    const owl = document.getElementById('lonb-owl');
    const icon = document.getElementById('lonb-icon');
    const titulo = document.getElementById('lonb-title');
    const texto = document.getElementById('lonb-text');
    const dots = document.getElementById('lonb-dots');
    const cta = document.getElementById('lonb-cta');
    if (owl) { owl.dataset.f = ''; owl.style.display = ''; owl.src = s.owl || ''; }
    // Emoji do passo é só reserva: com a coruja na tela ele repetia a ideia
    // (👋 embaixo da coruja acenando). Volta pelo onerror da coruja.
    if (icon) { icon.textContent = s.icon || ''; icon.style.display = s.owl ? 'none' : ''; }
    if (titulo) titulo.textContent = s.titulo || '';
    if (texto) texto.innerHTML = s.texto || '';
    // Bolinhas = só os passos que o plano atual realmente mostra (mesma
    // regra do avançar). Ativa = posição do passo atual DENTRO dessa lista,
    // não o índice bruto no array — senão a bolinha "salta" quando o plano
    // pula anúncio/agenda/share. Se por corrida o idx atual não estiver na
    // lista (plano mudou no meio do tour), nenhuma bolinha fica ativa.
    const _lojistaOnbValidos = _lojistaOnbIndicesValidos();
    if (dots) {
      dots.innerHTML = _lojistaOnbValidos.map(function (idx) {
        return '<span class="conb-dot' + (idx === _lojistaOnbIdx ? ' active' : '') + '"></span>';
      }).join('');
    }
    // A1: último passo (métricas — sempre visível, nunca pulado) no plano
    // GRÁTIS vira um CTA de upgrade em vez de um "Entendi" genérico.
    // Usa o último ÍNDICE VÁLIDO, não length-1 do array cheio, pra não
    // depender de métricas ser sempre o último item físico do array.
    const _ehUltimoPasso = _lojistaOnbValidos.length > 0 &&
      _lojistaOnbIdx === _lojistaOnbValidos[_lojistaOnbValidos.length - 1];
    const _ehGratisOnb   = (_mlPlanoAtual || 'GRATIS') === 'GRATIS';
    if (cta) {
      if (_ehUltimoPasso && _ehGratisOnb) {
        cta.textContent = '⭐ Ver planos';
        cta.onclick = finalizarOnboardingLojistaComUpgrade;
      } else {
        cta.textContent = _ehUltimoPasso ? 'Entendi! 🚀' : 'Próximo';
        cta.onclick = window.avancarOnboardingLojista;
      }
    }
    // 3) Rola o alvo pra dentro da área visível, depois posiciona.
    if (!s.hero && s.sel) {
      const el = document.querySelector(s.sel);
      if (el && el.scrollIntoView) {
        try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch(e) {}
      }
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { posicionarOnboardingLojista(); });
    });
  }

  function posicionarOnboardingLojista() {
    const ov = document.getElementById('lojista-onb-overlay');
    if (!ov) return;
    // Roda também em scroll/resize: é aqui que pegamos o painel fechando
    // enquanto o tour está no ar.
    if (!_mlPainelAberto()) { fecharOnboardingLojista(); return; }
    const s = LOJISTA_ONB_STEPS[_lojistaOnbIdx];
    const pop = document.getElementById('lonb-pop');
    const ring = document.getElementById('lonb-ring');
    const arrow = document.getElementById('lonb-pop-arrow');
    const mask = document.getElementById('lonb-mask');
    if (!mask) return;
    const panes = {
      top: mask.querySelector('[data-p="top"]'),
      right: mask.querySelector('[data-p="right"]'),
      bottom: mask.querySelector('[data-p="bottom"]'),
      left: mask.querySelector('[data-p="left"]')
    };
    const vw = window.innerWidth, vh = window.innerHeight;

    if (s.hero || !s.sel) {
      ov.classList.add('is-hero');
      if (ring) ring.style.display = 'none';
      if (arrow) arrow.style.display = 'none';
      panes.top.style.cssText = 'top:0;left:0;width:100%;height:100%;';
      panes.right.style.cssText = 'width:0;height:0;';
      panes.bottom.style.cssText = 'width:0;height:0;';
      panes.left.style.cssText = 'width:0;height:0;';
      if (pop) { pop.classList.add('centered'); pop.style.left = ''; pop.style.top = ''; }
      return;
    }

    const el = document.querySelector(s.sel);
    // Alvo ausente OU oculto (feature de plano superior): pula sozinho.
    // Faz o "salto" no próximo tick para não crescer a pilha quando vários
    // passos seguidos estão ocultos (ex.: free pula anúncio E agenda).
    if (!el || (el.offsetParent === null && el.getClientRects().length === 0)) {
      setTimeout(avancarOnboardingLojista, 0);
      return;
    }
    ov.classList.remove('is-hero');
    if (pop) pop.classList.remove('centered');

    const r = el.getBoundingClientRect();
    const pad = 8;
    const hx = Math.max(0, r.left - pad);
    const hy = Math.max(0, r.top - pad);
    const hw = Math.min(vw, r.right + pad) - hx;
    const hh = Math.min(vh, r.bottom + pad) - hy;

    panes.top.style.cssText = 'top:0;left:0;width:100%;height:' + hy + 'px;';
    panes.bottom.style.cssText = 'top:' + (hy + hh) + 'px;left:0;width:100%;height:' + Math.max(0, vh - (hy + hh)) + 'px;';
    panes.left.style.cssText = 'top:' + hy + 'px;left:0;width:' + hx + 'px;height:' + hh + 'px;';
    panes.right.style.cssText = 'top:' + hy + 'px;left:' + (hx + hw) + 'px;width:' + Math.max(0, vw - (hx + hw)) + 'px;height:' + hh + 'px;';

    if (ring) {
      ring.style.display = 'block';
      ring.style.left = hx + 'px'; ring.style.top = hy + 'px';
      ring.style.width = hw + 'px'; ring.style.height = hh + 'px';
    }

    if (pop) {
      pop.style.left = '-9999px'; pop.style.top = '0px';
      const pw = pop.offsetWidth || 320;
      const ph = pop.offsetHeight || 200;
      const gap = 16;
      const belowTop = hy + hh + gap;
      const fitsBelow = (belowTop + ph) <= (vh - 12);
      let popTop, arrowUp;
      if (fitsBelow) { popTop = belowTop; arrowUp = true; }
      else { popTop = Math.max(12, hy - gap - ph); arrowUp = false; }
      const targetCx = hx + hw / 2;
      let popLeft = targetCx - pw / 2;
      popLeft = Math.max(12, Math.min(popLeft, vw - pw - 12));
      pop.style.left = popLeft + 'px';
      pop.style.top = popTop + 'px';
      if (arrow) {
        arrow.style.display = 'block';
        arrow.classList.toggle('up', arrowUp);
        arrow.classList.toggle('down', !arrowUp);
        let ax = targetCx - popLeft;
        ax = Math.max(18, Math.min(ax, pw - 18));
        arrow.style.left = ax + 'px';
      }
    }
  }

  window.avancarOnboardingLojista = function () {
    const prox = _lojistaOnbProx(_lojistaOnbIdx + 1);
    if (prox >= 0) {
      _lojistaOnbIdx = prox;
      aplicarPassoLojista();
    } else {
      fecharOnboardingLojista();
    }
  };
  window.pularOnboardingLojista = function () { fecharOnboardingLojista(); };
  // A1: fecha o tour e, na sequência, abre o modal de planos (fluxo de upgrade).
  function finalizarOnboardingLojistaComUpgrade() {
    fecharOnboardingLojista();
    setTimeout(function () { if (typeof mlAbrirUpgrade === 'function') mlAbrirUpgrade(); }, 320);
  }
  window.finalizarOnboardingLojistaComUpgrade = finalizarOnboardingLojistaComUpgrade;

  function fecharOnboardingLojista() {
    if (_lojistaOnbFlag) { try { localStorage.setItem(_lojistaOnbFlag, '1'); } catch(e) {} }
    const ov = document.getElementById('lojista-onb-overlay');
    if (_lojistaOnbReposHandler) {
      window.removeEventListener('resize', _lojistaOnbReposHandler);
      window.removeEventListener('scroll', _lojistaOnbReposHandler, { capture: true });
      window.removeEventListener('orientationchange', _lojistaOnbReposHandler);
      _lojistaOnbReposHandler = null;
    }
    // Volta pra aba inicial pra loja começar na visão "Hoje".
    if (typeof mlSwitchTab === 'function') { try { mlSwitchTab('hoje'); } catch(e) {} }
    if (!ov) return;
    ov.classList.remove('open');
    if (typeof _focusTrapDesativar === 'function') _focusTrapDesativar();
    setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
  }
  // Compat: nome antigo ainda referenciado em algum lugar aponta pro novo fluxo.
  function fecharOnboarding() { fecharOnboardingLojista(); }
  window.fecharOnboarding = fecharOnboarding;
  // Exposto para permitir re-disparar manualmente (QA) e paridade com o tour
  // do cliente. O gate de flag continua valendo — só mostra se ainda não viu.
  window.mostrarOnboarding = mostrarOnboarding;

  // Topo do painel encolhe ao rolar (CSS: #modal-minha-loja.ml-compacto).
  // Histerese (liga >48px, desliga <8px) para não piscar quando a altura muda.
  function _mlBindTopoCompacto() {
    const sc = document.getElementById('ml-scroll');
    const md = document.getElementById('modal-minha-loja');
    if (!sc || !md) return;
    md.classList.remove('ml-compacto');
    if (sc.dataset.compactoBound) return;
    sc.dataset.compactoBound = '1';
    let _raf = 0;
    sc.addEventListener('scroll', () => {
      if (_raf) return;
      _raf = requestAnimationFrame(() => {
        _raf = 0;
        const y = sc.scrollTop;
        if (y > 48) md.classList.add('ml-compacto');
        else if (y < 8) md.classList.remove('ml-compacto');
      });
    }, { passive: true });
  }

  async function abrirMinhaLoja() {
    _mlBindTopoCompacto();
    if (!_lojaToken) { openLoginLoja(); return; }

    // ── Limpa cache de anúncio se for uma loja diferente da anterior ──
    const wppSalvo = localStorage.getItem('angatuba_loja_wpp') || '';
    if (_lojaWpp && wppSalvo && wppSalvo !== _lojaWpp) {
      localStorage.removeItem('angatuba_anuncio');
    }

    const overlay = document.getElementById('modal-minha-loja');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // A3: primeira aterrissagem (tour ainda não visto ou checklist não
    // dispensado) sempre cai na aba Hoje — onde vivem o checklist e o
    // início do tour. Sem isto, abrir o painel podia manter a aba que
    // ficou selecionada numa sessão bem anterior (ex.: recém-aprovado,
    // ou entrando pelo atalho "Meu painel" com sessão já salva).
    try {
      const wppN = _wppFlagOnb();
      const tourVisto = wppN && localStorage.getItem('angatuba_onboarded_' + LOJISTA_ONB_VER + '_' + wppN) === '1';
      if ((!tourVisto || !_mlChecklistState().dismissed) && typeof mlSwitchTab === 'function') mlSwitchTab('hoje');
    } catch (e) {}

    if (typeof mlAvisoOffline === 'function') mlAvisoOffline(false); // Item 3: reseta aviso ao (re)abrir
    mlSortearDica();
    // Onboarding de boas-vindas: só na 1ª vez que esta loja abre o painel.
    // Espera o painel pintar antes de sobrepor (evita corrida com a transição de aprovação).
    setTimeout(() => mostrarOnboarding(), 900);
    // Fix #6: entrada no histórico para o botão "voltar" (Android) fechar o painel
    if (history.state?.modal !== 'minha-loja') history.pushState({ modal: 'minha-loja' }, '');

    // ── Abre instantaneamente com cache do localStorage ───────
    const dadosCache = (() => {
      try { return JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null'); } catch(e) { return null; }
    })();

    if (dadosCache) {
      // Painel visível imediatamente com dados do cache
      _aplicarDadosLoja(dadosCache, null);
      // Restaura anúncio do cache local
      try {
        const anuncioCache = localStorage.getItem('angatuba_anuncio');
        if (anuncioCache) {
          const obj = JSON.parse(anuncioCache);
          if (obj.expira && new Date(obj.expira) > new Date()) {
            const anuncioSection = document.getElementById('ml-anuncio-section');
            if (anuncioSection) anuncioSection.style.display = '';
            mlExibirAnuncioAtivo(obj);
          } else {
            localStorage.removeItem('angatuba_anuncio');
          }
        }
      } catch(e) {}
    } else {
      // Sem cache: placeholders mínimos
      document.getElementById('ml-nome').textContent = _lojaNome || '...';
      document.getElementById('ml-ramo').textContent = '—';
      document.getElementById('ml-m-7d').textContent  = '—';
      document.getElementById('ml-m-30d').textContent = '—';
      document.getElementById('ml-m-total').textContent = '—';
      document.getElementById('ml-m-wpp').textContent = '—';
      document.getElementById('ml-m-tel').textContent = '—';
    }

    // ── Busca dados frescos em background ─────────────────────
    // Fix: bind único por botão (dataset.flagBound) — antes acumulava um listener a cada
    // abertura do painel quando o usuário não clicava em nenhum toggle.
    window._mlPainelInteragido = false;
    ['ml-toggle-aberto','ml-toggle-voltamos','ml-toggle-fechado','ml-entrega-toggle'].forEach(id => {
      const elT = document.getElementById(id);
      if (elT && !elT.dataset.flagBound) {
        elT.dataset.flagBound = '1';
        elT.addEventListener('click', () => { window._mlPainelInteragido = true; });
      }
    });
    try {
      // Token via POST — nunca em query string (logs de servidor, histórico do browser)
      const mkParams = action => {
        const p = new URLSearchParams();
        p.append('payload', JSON.stringify({ action, token: _lojaToken }));
        return p;
      };
      // 20s (era 10s): o GAS "frio" passa fácil de 10s na primeira chamada e o
      // painel mostrava "Sem conexão" com a internet funcionando normalmente.
      // Métricas varrem a aba inteira (a chamada mais lenta): saem em paralelo
      // mas NÃO seguram o painel — antes, se estourassem o tempo, o painel todo
      // mostrava "Sem conexão" e o cardápio nem começava a carregar.
      const metPromise = fetch(APPS_SCRIPT_URL, { method: 'POST', body: mkParams('lojaMetricas'), signal: AbortSignal.timeout(30000) })
        .then(r => r.json()).catch(() => null);
      const dadosResp = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: mkParams('lojaDados'), signal: AbortSignal.timeout(20000) });
      const dadosJson = await dadosResp.json();

      // Sessão expirada
      if (dadosJson.msg === 'UNAUTHORIZED') {
        lojaLogout(true); return;
      }

      if (dadosJson.status === 'ok') {
        // Salva cache para próxima abertura ser instantânea
        try { localStorage.setItem('angatuba_loja_dados', JSON.stringify(dadosJson.data)); } catch(e) {}

        _aplicarDadosLoja(dadosJson.data, null, window._mlPainelInteragido);
        mlAvisoOffline(false); // Item 3: rede ok — garante que o aviso não fica preso

        // Métricas: aplicam quando chegarem (sem bloquear nada)
        metPromise.then(metJson => {
          if (!metJson || metJson.status !== 'ok' || !_lojaToken) return;
          const _pl = String(dadosJson.data.plano || 'GRATIS').toUpperCase();
          _mlAplicarMetricas(metJson, _pl !== 'GRATIS', _pl === 'PRO');
          // Plus: anúncio do dia vem junto das métricas
          if (_pl === 'PLUS' && metJson.data && metJson.data.anuncio) mlExibirAnuncioAtivo(metJson.data.anuncio);
        });

        // ── Cardápio ─────────────────────────────────────
        await mlCardapioCarregar(dadosJson.data.plano || 'GRATIS');
      }
    } catch(e) {
      console.warn('[MinhaLoja] Erro ao carregar dados:', e.message);
      // Item 3: a atualização de rede falhou. Antes ficava só no console e o painel
      // exibia cache (ou placeholders '—') sem avisar — dava impressão de "zerou".
      // Mostra um aviso discreto, diferenciando ter dados salvos de não ter.
      mlAvisoOffline(true, dadosCache
        ? 'Sem conexão — mostrando os últimos dados salvos.'
        : 'Sem conexão — não foi possível carregar seus dados agora.');
    }
  }

  // Item 3: controla o banner de aviso offline do painel Minha Loja.
  function mlAvisoOffline(mostrar, txt) {
    const box = document.getElementById('ml-aviso-offline');
    if (!box) return;
    if (mostrar) {
      const t = document.getElementById('ml-aviso-offline-txt');
      if (t && txt) t.textContent = txt;
      box.style.display = 'flex';
    } else {
      box.style.display = 'none';
    }
  }

  function fecharMinhaLoja(viaPopstate) {
    // O tour vive no <body>, acima do painel: se o painel fecha, ele vai junto.
    // Sem isto o tour ficava órfão sobre a tela inicial das lojas.
    if (document.querySelector('#lojista-onb-overlay.open')) fecharOnboardingLojista();
    document.getElementById('modal-minha-loja').classList.remove('open');
    document.body.style.overflow = '';
    if (typeof _mlPararTimerAnuncio === 'function') _mlPararTimerAnuncio(); // Item 17: não deixa o interval rodando com o painel fechado
    // Fix #6: desfaz a entrada do histórico ao fechar manualmente (popstate já consumiu)
    if (!viaPopstate && history.state?.modal === 'minha-loja') { _popstateNosso = true; history.back(); }
  }

  document.getElementById('modal-minha-loja').addEventListener('click', function(e) {
    if (e.target === this) fecharMinhaLoja();
  });

  // "Ver como cliente": fecha o painel e abre a página pública da loja,
  // do jeito que o morador vê. Espera o history.back do fechamento terminar
  // para o popstate não fechar o detalhe recém-aberto.
  window.mlVerComoCliente = function () {
    const idx = _mlAcharIdxLojaLocal(null, _lojaNome);
    if (idx < 0) { mlToast('Sua loja ainda não apareceu na lista. Tente de novo em instantes.', 'erro'); return; }
    let abriu = false;
    const abrir = () => { if (abriu) return; abriu = true; window.removeEventListener('popstate', onPop); abrirDetalhes(idx); };
    const onPop = () => setTimeout(abrir, 60);
    const vaiVoltar = history.state?.modal === 'minha-loja';
    if (vaiVoltar) window.addEventListener('popstate', onPop);
    fecharMinhaLoja();
    setTimeout(abrir, vaiVoltar ? 700 : 250);
  };

  /* ── Toggle de status manual ─────────────────────────────── */
  function marcarToggle(status) {
    const BORDERS = {
      'ABERTO':   '2px solid rgba(0,208,132,0.3)',
      'VOLTAMOS': '2px solid rgba(245,158,11,0.3)',
      'FECHADO':  '2px solid rgba(255,68,68,0.3)',
    };
    document.querySelectorAll('.toggle-status-btn').forEach(btn => {
      const isActive = btn.dataset.status === status ||
                       (btn.dataset.status === 'ABERTO'   && (status || '').startsWith('ABERTO_ATE_')) ||
                       (btn.dataset.status === 'VOLTAMOS' && (status || '').startsWith('VOLTAMOS_ATE_')) ||
                       (btn.dataset.status === 'FECHADO'  && (status || '').startsWith('FECHADO_HOJE_'));
      btn.style.opacity    = isActive ? '1' : '0.45';
      btn.style.fontWeight = isActive ? '800' : '600';
      btn.style.boxShadow  = isActive ? '0 0 0 2px currentColor inset' : '';
      btn.style.border     = isActive ? '2px solid currentColor' : (BORDERS[btn.dataset.status] || '');
      // Fix #4: marca a classe .ativo para que o rollback de lojaToggle saiba o status anterior
      btn.classList.toggle('ativo', isActive);
    });
  }

  // Botão "Aberto" e "Já voltamos" — mostra painel de opções antes de confirmar
  function lojaToggleComHorario(status) {
    // Item 6: escolher ABERTO/VOLTAMOS cancela uma confirmação de "Fechado" pendente.
    if (typeof _mlResetFechadoConfirm === 'function') _mlResetFechadoConfirm();
    const wrapAberto   = document.getElementById('ml-aberto-ate-wrap');
    const wrapVoltamos = document.getElementById('ml-voltamos-ate-wrap');
    // Feedback visual imediato — marca o botão clicado mesmo antes de confirmar
    marcarToggle(status);
    if (status === 'ABERTO') _uiSom('loja-abriu');
    if (status === 'ABERTO') {
      if (wrapVoltamos) wrapVoltamos.style.display = 'none';
      if (!wrapAberto) { lojaToggle(status); return; }
      wrapAberto.style.display = '';
      const agora = new Date();
      agora.setHours(agora.getHours() + 1, 0);
      const hh = String(agora.getHours()).padStart(2,'0');
      document.getElementById('ml-aberto-ate-time').value = `${hh}:00`;
      document.getElementById('ml-aberto-ate-time').focus();
    } else if (status === 'VOLTAMOS') {
      if (wrapAberto) wrapAberto.style.display = 'none';
      if (!wrapVoltamos) { lojaToggle(status); return; }
      wrapVoltamos.style.display = '';
    }
  }

  // Confirma "Já voltamos" com prazo em minutos (0 = sem previsão)
  async function lojaToggleVoltamos(minutos) {
    document.getElementById('ml-voltamos-ate-wrap').style.display = 'none';
    // "Sem previsão" vale 3h: depois a loja volta ao horário automático
    // (antes ficava "Já voltamos" para sempre se o dono esquecesse).
    if (!minutos) minutos = 180;
    const ate = new Date(Date.now() + minutos * 60000);
    const yyyy = ate.getFullYear();
    const mm   = String(ate.getMonth() + 1).padStart(2, '0');
    const dd   = String(ate.getDate()).padStart(2, '0');
    const hh   = String(ate.getHours()).padStart(2, '0');
    const min  = String(ate.getMinutes()).padStart(2, '0');
    await lojaToggle(`VOLTAMOS_ATE_${yyyy}-${mm}-${dd}_${hh}${min}`);
  }

  // Confirma "Aberto" com horário personalizado
  async function lojaToggleAberto() {
    const time = document.getElementById('ml-aberto-ate-time')?.value;
    // Inclui data LOCAL para saber quando expirou (formato ABERTO_ATE_YYYY-MM-DD_HHMM)
    // IMPORTANTE: usa getFullYear/Month/Date (local) em vez de toISOString() que retorna UTC
    // Entre 21:00-23:59 BRT, o UTC já é amanhã — causaria status "aberto por 23h"
    const _agora = new Date();
    // Fix #5: "aberto até" com horário menor/igual ao horário atual (ex: 00:00 = meia-noite)
    // significa amanhã. Sem isto, ABERTO_ATE_<hoje>_0000 vira "início de hoje", já no passado.
    // Sem horário digitado: "aberto até" o fechamento do horário de hoje (ou
    // 23:59). Antes virava 'ABERTO' sem prazo e a loja ficava aberta para sempre.
    let _ate = /^\d{2}:\d{2}$/.test(time || '') ? time : '';
    if (!_ate) {
      try {
        const _lj = _mlAcharLojaLocal(null, _lojaNome);
        const _si = _lj ? calcStatusInfo(Object.assign({}, _lj, { statusLoja: '' })) : null;
        if (_si && _si.status === 'open' && /^\d{2}:\d{2}$/.test(_si.fechaStr || '')) _ate = _si.fechaStr;
      } catch (e) {}
      if (!_ate) _ate = '23:59';
    }
    const _alvo = new Date(_agora);
    const [_h, _m] = _ate.split(':').map(Number);
    _alvo.setHours(_h, _m, 0, 0);
    if (_alvo <= _agora) _alvo.setDate(_alvo.getDate() + 1); // rola para o dia seguinte
    const hoje = `${_alvo.getFullYear()}-${String(_alvo.getMonth()+1).padStart(2,'0')}-${String(_alvo.getDate()).padStart(2,'0')}`;
    const status = `ABERTO_ATE_${hoje}_${_ate.replace(':','')}`;
    document.getElementById('ml-aberto-ate-wrap').style.display = 'none';
    await lojaToggle(status);
  }

  window.lojaToggleComHorario = lojaToggleComHorario;
  window.lojaToggleAberto     = lojaToggleAberto;
  window.lojaToggleVoltamos   = lojaToggleVoltamos;

  // Botão "Fechado": fecha apenas até o fim do dia. Grava FECHADO_HOJE_<hoje>
  // (data LOCAL/BRT) para que o status volte ao automático na virada do dia.
  // Item 6: fechar a loja some da descoberta pública — é destrutivo e acontecia
  // com um único toque. Exige confirmação de dois toques (sem confirm() nativo,
  // pra não quebrar o tema dark).
  let _mlFechadoConfirmar = false;
  let _mlFechadoTimer = null;
  async function lojaToggleFechado() {
    if (!_mlFechadoConfirmar) {
      _mlFechadoConfirmar = true;
      _mlToggleFeedback('aviso', '⚠️ Isso fecha sua loja para os clientes hoje. Toque de novo em "Fechado" para confirmar.');
      const btn = document.querySelector('.toggle-status-btn[data-status="FECHADO"]');
      if (btn) btn.textContent = 'Confirmar?';
      // Reseta a intenção se o lojista não confirmar em 5s
      if (_mlFechadoTimer) clearTimeout(_mlFechadoTimer);
      _mlFechadoTimer = setTimeout(() => { _mlResetFechadoConfirm(); }, 5000);
      return;
    }
    _mlResetFechadoConfirm();
    _uiSom('loja-fechou');
    const d = new Date();
    const hoje = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    await lojaToggle(`FECHADO_HOJE_${hoje}`);
  }
  function _mlResetFechadoConfirm() {
    _mlFechadoConfirmar = false;
    if (_mlFechadoTimer) { clearTimeout(_mlFechadoTimer); _mlFechadoTimer = null; }
    const btn = document.querySelector('.toggle-status-btn[data-status="FECHADO"]');
    if (btn) btn.textContent = 'Fechado';
  }
  window.lojaToggleFechado = lojaToggleFechado;

  // Item 6: feedback unificado e à prova de corrida para o toggle de status.
  // Antes sucesso e erro escreviam no mesmo #ml-toggle-erro trocando a cor na mão,
  // e uma troca rápida de status fazia um setTimeout apagar a mensagem da outra.
  // Aqui cancelamos qualquer timer pendente antes de exibir a nova mensagem.
  let _mlToggleMsgTimer = null;
  function _mlToggleFeedback(tipo, texto) {
    const box = document.getElementById('ml-toggle-erro');
    if (!box) return;
    if (_mlToggleMsgTimer) { clearTimeout(_mlToggleMsgTimer); _mlToggleMsgTimer = null; }
    const cor = tipo === 'ok' ? 'var(--green)' : (tipo === 'aviso' ? 'var(--zap)' : 'var(--red)');
    box.style.color = cor;
    box.textContent = texto;
    // Avisos de confirmação não somem sozinhos (o fluxo do botão os limpa);
    // sucesso/erro auto-limpam.
    if (tipo === 'ok' || tipo === 'erro') {
      const ms = tipo === 'ok' ? 2500 : 4000;
      _mlToggleMsgTimer = setTimeout(() => { if (box) { box.textContent = ''; box.style.color = 'var(--red)'; } _mlToggleMsgTimer = null; }, ms);
    }
  }

  async function lojaToggle(novoStatus) {
    if (!_lojaToken) return;
    // Fix #4: captura o status anterior ANTES do feedback otimista (para rollback em falha)
    const statusAnterior = document.querySelector('.toggle-status-btn.ativo')?.dataset?.status || '';
    let statusCacheAnterior = null;
    try {
      const c = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
      if (c) statusCacheAnterior = c.statusLoja ?? '';
    } catch(e) {}

    marcarToggle(novoStatus); // feedback imediato
    // Esconde os painéis de opções se estiverem visíveis
    const wrap = document.getElementById('ml-aberto-ate-wrap');
    if (wrap) wrap.style.display = 'none';
    const wrapV = document.getElementById('ml-voltamos-ate-wrap');
    if (wrapV) wrapV.style.display = 'none';

    // Atualiza cache do localStorage para que próxima abertura mostre status correto
    try {
      const cache = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
      if (cache) { cache.statusLoja = novoStatus; localStorage.setItem('angatuba_loja_dados', JSON.stringify(cache)); }
    } catch(e) {}
    try {
      // Token via POST — nunca em query string (logs de servidor, histórico do browser)
      const json = await apiPost('lojaToggle', { token: _lojaToken, statusLoja: novoStatus }, { timeout: 25000 });
      // backend pode devolver erro de negócio (linha mudou, data inválida) com status != ok.
      if (json.status !== 'ok') throw new Error(json.msg || 'Falha ao salvar status');
      // Item 6: feedback de sucesso via helper à prova de corrida.
      _mlToggleFeedback('ok', '✅ Status salvo');
      // A1: marca o item "Status testado" do checklist de ativação.
      if (typeof mlChecklistMarcarStatusTestado === 'function') mlChecklistMarcarStatusTestado();
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return; // apiPost já fez logout
      console.warn('[lojaToggle] Erro:', e.message);
      // Timeout ≠ falha: o GAS lento costuma gravar mesmo assim. Confere o
      // status real antes de desfazer (antes o painel dizia "não salvou" e o
      // público mostrava o status novo).
      if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        _mlToggleFeedback('aviso', '⏳ Servidor lento — conferindo…');
        try {
          const jd = await apiPost('lojaDados', { token: _lojaToken }, { timeout: 25000 });
          if (jd && jd.status === 'ok' && jd.data) {
            const real = String(jd.data.statusLoja || '');
            marcarToggle(real);
            try { localStorage.setItem('angatuba_loja_dados', JSON.stringify(jd.data)); } catch (e4) {}
            if (real === novoStatus) {
              _mlToggleFeedback('ok', '✅ Status salvo');
              if (typeof mlChecklistMarcarStatusTestado === 'function') mlChecklistMarcarStatusTestado();
            } else {
              _mlToggleFeedback('erro', '❌ Status não foi salvo. Tente de novo.');
            }
            return;
          }
        } catch (e3) { if (e3 && e3.message === 'UNAUTHORIZED') return; }
      }
      // Fix #4: reverte visual E cache do localStorage (estava sobrescrevendo otimista)
      if (statusAnterior) marcarToggle(statusAnterior);
      if (statusCacheAnterior !== null) {
        try {
          const cache = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
          if (cache) { cache.statusLoja = statusCacheAnterior; localStorage.setItem('angatuba_loja_dados', JSON.stringify(cache)); }
        } catch(e2) {}
      }
      _mlToggleFeedback('erro', '❌ Sem conexão. Status não foi salvo.');
    }
  }

  /* ── Salvar Instagram (painel Minha Loja) ────────────────── */
  async function mlSalvarInstagram() {
    if (!_lojaToken) return;
    const input  = document.getElementById('ml-ig-input');
    const status = document.getElementById('ml-ig-status');
    const btn    = document.getElementById('ml-ig-save-btn');
    if (!input) return;

    const valor = normalizarInstagramHandle(input.value);

    // Item 7: valida o formato antes de salvar. Sem isto, um valor com espaços,
    // acentos ou caracteres inválidos era aceito e o link "Ver perfil atual"
    // apontava para instagram.com/<lixo> — o lojista achava que salvou certo.
    if (!_igHandleValido(valor)) {
      if (status) {
        status.textContent = '⚠️ Usuário do Instagram inválido. Use só letras, números, ponto e "_" (ex.: minha.loja).';
        status.style.color = 'var(--zap)';
      }
      input.focus();
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    if (status) { status.textContent = ''; status.style.color = ''; }

    try {
      const json = await apiPost('lojaAtualizarInstagram', { token: _lojaToken, instagram: valor }, { timeout: 20000, ignoreUnauthorized: true });

      if (json.status === 'erro' || json.msg === 'UNAUTHORIZED') {
        if (status) { status.textContent = '❌ Erro ao salvar. Tente novamente.'; status.style.color = 'var(--red)'; }
        return;
      }

      if (status) { status.textContent = '✅ Instagram atualizado!'; status.style.color = 'var(--green)'; }
      input.value = valor ? '@' + valor : '';

      // Atualiza o link "Ver perfil atual" inline sem re-abrir o painel inteiro
      const igWrap = document.getElementById('ml-instagram-wrap');
      if (igWrap && valor) {
        const linkExistente = igWrap.querySelector('a[href*="instagram.com"]');
        if (linkExistente) {
          linkExistente.href = `https://instagram.com/${valor}`;
          linkExistente.innerHTML = `<i class="fa fa-external-link-alt" style="font-size:9px;"></i> Ver perfil atual: @${valor}`;
        } else {
          const a = document.createElement('a');
          a.href = `https://instagram.com/${valor}`;
          a.target = '_blank'; a.rel = 'noopener';
          a.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:#e1306c;text-decoration:none;';
          a.innerHTML = `<i class="fa fa-external-link-alt" style="font-size:9px;"></i> Ver perfil atual: @${valor}`;
          igWrap.appendChild(a);
        }
      }

    } catch(e) {
      if (status) { status.textContent = '❌ Erro de conexão.'; status.style.color = 'var(--red)'; }
      console.warn('[mlSalvarInstagram] Erro:', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    }
  }

  /* ── Logout de loja ──────────────────────────────────────── */
  // Botão "Sair da conta" (fim da aba Loja). Pede confirmação porque, sem a
  // sessão, entrar de novo depende do código pelo WhatsApp.
  async function mlSairDaConta() {
    const ok = await mlConfirmar('Sair da sua loja?',
      'Para entrar de novo neste celular você vai precisar de um novo código pelo WhatsApp. Para só fechar o painel, use o ✕ lá em cima.',
      { okLabel: 'Sair', owlSrc: '/webp/owl-sign.webp' });
    if (ok) lojaLogout();
  }
  window.mlSairDaConta = mlSairDaConta;

  function lojaLogout(silencioso) {
    if (_lojaToken) {
      // Token via POST — nunca em query string
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaLogout', token: _lojaToken }));
      fetch(APPS_SCRIPT_URL, { method: 'POST', body: params }).catch(() => {});
    }
    _lojaToken = null;
    _lojaNome  = '';
    localStorage.removeItem('angatuba_loja_token');
    localStorage.removeItem('angatuba_loja_nome');
    localStorage.removeItem('angatuba_loja_wpp');
    localStorage.removeItem('angatuba_anuncio');
    localStorage.removeItem('angatuba_loja_dados');
    localStorage.removeItem('angatuba_pendente_wpp');
    localStorage.removeItem('angatuba_pendente_plano');
    localStorage.removeItem('angatuba_pendente_ciclo');
    pararPollingAprovacao();
    fecharMinhaLoja();
    atualizarNav();
    if (!silencioso) {
      // Reseta nav para Início
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.getElementById('nav-inicio').classList.add('active');
    }
  }

  // Número do admin para CTAs de WhatsApp — definido em ADMIN_WPP_CONTATO no topo do arquivo

  /* ══════════════════════════════════════════════════════════════
     RAMO AUTOCOMPLETE
     Substitui o <select> estático por um combobox com busca em tempo real.
     O campo oculto #f-ramo recebe o slug/valor real enviado ao servidor.
  ══════════════════════════════════════════════════════════════ */
  (function initRamoAutocomplete() {

    /* ── Catálogo completo ──────────────────────────────────── */
    // RAMOS agora é derivado de CAT_DEF (definido no topo do arquivo).

    /* ── Helpers ──────────────────────────────────────────── */
    // Remove acentos e converte para minúsculas para busca insensível
    function norm(s) {
      return String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').trim();
    }
    // Envolve o trecho coincidente em <mark> para highlight
    function hl(label, raw) {
      if (!raw) return label;
      const re = new RegExp(`(${raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
      return label.replace(re, '<mark>$1</mark>');
    }

    /* ── DOM refs ─────────────────────────────────────────── */
    const inputEl    = document.getElementById('f-ramo-text');
    const hiddenEl   = document.getElementById('f-ramo');
    const dropEl     = document.getElementById('ramo-dropdown');
    const emojiEl    = document.getElementById('ramo-emoji');
    const clearEl    = document.getElementById('ramo-clear');
    const okEl       = document.getElementById('ramo-ok');
    if (!inputEl) return;

    /* ── Estado interno ───────────────────────────────────── */
    let chosen  = null;   // objeto RAMOS escolhido
    let kbIdx   = -1;     // índice com foco via teclado
    let visible = [];     // itens renderizados no momento

    /* ── Renderiza o dropdown ─────────────────────────────── */
    function renderDrop(q) {
      const qn  = norm(q);
      const qRaw = q.trim();

      const matched = qn
        ? RAMOS.filter(r =>
            norm(r.label).includes(qn) ||
            r.busca.some(b => norm(b).includes(qn))
          )
        : RAMOS;   // vazio = mostra todos

      // Agrupa por grupo
      const map = new Map();
      matched.forEach(r => {
        if (!map.has(r.grupo)) map.set(r.grupo, []);
        map.get(r.grupo).push(r);
      });

      visible = [];
      let html = '';

      if (!matched.length && qRaw) {
        // Sem resultado: opção de usar o texto livre
        visible = [{ emoji:'➕', label:`"${qRaw}"`, slug: qRaw, grupo:'', busca:[], _custom: true }];
        html = `<div class="ramo-opt is-outro" role="option" data-idx="0">
          <span class="ramo-opt-emoji">➕</span>
          <span class="ramo-opt-label">Usar <mark>${escHTML(qRaw)}</mark> como ramo</span>
        </div>`;
      } else {
        map.forEach((items, grupo) => {
          html += `<div class="ramo-group-label">${grupo}</div>`;
          items.forEach(r => {
            const i = visible.length;
            visible.push(r);
            html += `<div class="ramo-opt" role="option" data-idx="${i}">
              <span class="ramo-opt-emoji">${r.emoji}</span>
              <span class="ramo-opt-label">${hl(r.label, qRaw)}</span>
            </div>`;
          });
        });
        // "Outro ramo" sempre disponível no final
        const oi = visible.length;
        visible.push({ emoji:'➕', label:'Outro ramo (não listado)', slug:'outro', grupo:'', busca:[] });
        html += `<div class="ramo-opt is-outro" role="option" data-idx="${oi}">
          <span class="ramo-opt-emoji">➕</span>
          <span class="ramo-opt-label">Outro ramo (não listado)</span>
        </div>`;
      }

      dropEl.innerHTML = html;
      kbIdx = -1;

      // Clicks nas opções
      dropEl.querySelectorAll('.ramo-opt').forEach(el => {
        el.addEventListener('mousedown', ev => {
          ev.preventDefault();               // impede blur antes do click
          escolher(visible[+el.dataset.idx]);
        });
      });
    }

    /* ── Aplica a escolha ─────────────────────────────────── */
    function escolher(ramo) {
      if (!ramo) return;
      chosen = ramo;
      inputEl.value    = ramo._custom ? ramo.slug : ramo.label;
      hiddenEl.value   = ramo._custom ? ramo.slug : ramo.slug;
      emojiEl.textContent = ramo._custom ? '' : ramo.emoji;
      okEl.classList.add('show');
      clearEl.classList.add('show');
      fecharDrop();
      inputEl.setAttribute('aria-expanded', 'false');
      // Sugere tags padrão da categoria escolhida (balões no campo de tags)
      if (window.tagsInjectDefaults) window.tagsInjectDefaults(ramo._custom ? '' : ramo.slug);
    }

    /* ── Abre / fecha ─────────────────────────────────────── */
    function abrirDrop() {
      renderDrop(inputEl.value);
      dropEl.classList.add('open');
      inputEl.setAttribute('aria-expanded', 'true');
    }
    function fecharDrop() {
      dropEl.classList.remove('open');
      inputEl.setAttribute('aria-expanded', 'false');
      kbIdx = -1;
    }

    /* ── Foco via teclado ─────────────────────────────────── */
    function moverKb(dir) {
      const opts = dropEl.querySelectorAll('.ramo-opt');
      if (!opts.length) return;
      opts[kbIdx]?.classList.remove('kb-focus');
      kbIdx = (kbIdx + dir + opts.length) % opts.length;
      opts[kbIdx]?.classList.add('kb-focus');
      opts[kbIdx]?.scrollIntoView({ block: 'nearest' });
    }

    /* ── Eventos ──────────────────────────────────────────── */
    inputEl.addEventListener('focus', () => {
      if (chosen) inputEl.select();
      abrirDrop();
    });

    inputEl.addEventListener('input', () => {
      chosen = null;
      hiddenEl.value = '';
      okEl.classList.remove('show');
      emojiEl.textContent = '';
      clearEl.classList.toggle('show', inputEl.value.length > 0);
      renderDrop(inputEl.value);
      dropEl.classList.add('open');
      inputEl.setAttribute('aria-expanded', 'true');
    });

    inputEl.addEventListener('keydown', e => {
      if (!dropEl.classList.contains('open')) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') abrirDrop();
        return;
      }
      switch (e.key) {
        case 'ArrowDown':  e.preventDefault(); moverKb(+1); break;
        case 'ArrowUp':    e.preventDefault(); moverKb(-1); break;
        case 'Escape':     fecharDrop(); break;
        case 'Tab':
        case 'Enter':
          if (kbIdx >= 0 && visible[kbIdx]) { e.preventDefault(); escolher(visible[kbIdx]); }
          else if (e.key === 'Enter') fecharDrop();
          break;
      }
    });

    inputEl.addEventListener('blur', () => {
      // Delay pequeno para o mousedown dos itens disparar antes
      setTimeout(() => {
        fecharDrop();
        // Se digitou algo sem confirmar: tenta autocomplete pelo melhor match
        if (!chosen && inputEl.value.trim()) {
          const qn = norm(inputEl.value);
          const hit = RAMOS.find(r =>
            norm(r.label).includes(qn) || r.busca.some(b => norm(b).includes(qn))
          );
          if (hit) {
            escolher(hit);
          } else {
            // Mantém como texto livre (ramo customizado)
            hiddenEl.value = inputEl.value.trim();
            okEl.classList.add('show');
          }
        }
      }, 200);
    });

    clearEl.addEventListener('click', () => ramoReset());

    // Fecha ao clicar fora
    document.addEventListener('click', e => {
      if (!e.target.closest('.ramo-wrap')) fecharDrop();
    });

    /* ── API pública — usada no closeModal ────────────────── */
    window.ramoReset = function () {
      chosen = null;
      inputEl.value       = '';
      hiddenEl.value      = '';
      emojiEl.textContent = '';
      okEl.classList.remove('show');
      clearEl.classList.remove('show');
      fecharDrop();
      if (window.tagsClearDefaults) window.tagsClearDefaults();
    };

  })(); // ── fim initRamoAutocomplete ──────────────────────────

  /* ──────────────────────────────────────────────────────────
     TAGS DE BUSCA — caixa de balões (chips)
     ----------------------------------------------------------
     Sementes vindas de CAT_DEF[].busca da categoria escolhida.
     Os chips sincronizam SEMPRE para #f-tags (textarea oculto),
     que é o que o FormData do cadastro envia ao servidor — sem
     alterar nem o submit nem o backend.
     • Chip "padrão" (veio da categoria) tem visual neutro.
     • Chip "manual" (digitado) tem visual âmbar.
     • Trocar de ramo: recarrega os padrões e PRESERVA os manuais.
     • Enter ou vírgula adiciona; ✕ remove; teto de 20; dedupe.
     ────────────────────────────────────────────────────────── */
  (function initTagChips() {
    const box     = document.getElementById('f-tags-box');
    const chipsEl = document.getElementById('f-tags-chips');
    const inputEl = document.getElementById('f-tags-input');
    const hidden  = document.getElementById('f-tags'); // textarea oculto (name="tags")
    if (!box || !chipsEl || !inputEl || !hidden) return;

    const MAX_TAGS = 20;
    const MAX_LEN  = 28;

    // Normaliza p/ comparação (dedupe): minúsculas, sem acento, espaços colapsados.
    function norm(s) {
      return String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();
    }
    // Limpa o texto exibido no chip (preserva acentos, corta tamanho).
    function limpar(s) {
      return String(s).replace(/[,\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    }

    // Estado: cada tag = { texto, isDefault }
    let tags = [];

    function sincronizarHidden() {
      hidden.value = tags.map(t => t.texto).join(', ');
    }

    function jaExiste(txt) {
      const n = norm(txt);
      return tags.some(t => norm(t.texto) === n);
    }

    function atualizarEstadoCaixa() {
      const cheio = tags.length >= MAX_TAGS;
      box.classList.toggle('is-full', cheio);
      inputEl.disabled = cheio;
      inputEl.placeholder = cheio
        ? `Máximo de ${MAX_TAGS} tags atingido`
        : (tags.length ? 'Adicionar outra…' : 'Digite e tecle Enter (ex: açaí, marmita...)');
    }

    function render() {
      chipsEl.innerHTML = '';
      tags.forEach((t, i) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip' + (t.isDefault ? ' is-default' : '');
        const txt = document.createElement('span');
        txt.className = 'tag-chip-txt';
        txt.textContent = t.texto;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'tag-chip-x';
        x.setAttribute('aria-label', 'Remover ' + t.texto);
        x.textContent = '✕';
        x.addEventListener('click', (e) => { e.stopPropagation(); removerIdx(i); });
        chip.appendChild(txt);
        chip.appendChild(x);
        chipsEl.appendChild(chip);
      });
      atualizarEstadoCaixa();
      sincronizarHidden();
    }

    function adicionar(textoRaw, isDefault) {
      const texto = limpar(textoRaw);
      if (!texto) return false;
      if (tags.length >= MAX_TAGS) return false;
      if (jaExiste(texto)) return false;
      tags.push({ texto, isDefault: !!isDefault });
      return true;
    }

    function removerIdx(i) {
      tags.splice(i, 1);
      render();
    }

    // Processa o que está no input (Enter/vírgula/blur). Aceita vários separados por vírgula.
    function consumirInput() {
      const partes = inputEl.value.split(',');
      let mudou = false;
      partes.forEach(p => { if (adicionar(p, false)) mudou = true; });
      inputEl.value = '';
      if (mudou) render();
      else atualizarEstadoCaixa();
    }

    /* ── API pública (chamada pelo combobox de ramo) ───────── */
    // Injeta as tags padrão da categoria; preserva tags manuais já digitadas
    // e remove as tags-padrão de uma categoria anterior.
    window.tagsInjectDefaults = function (slug) {
      // Mantém só os chips manuais (digitados pela pessoa)
      tags = tags.filter(t => !t.isDefault);
      if (slug) {
        const def = (typeof CAT_DEF !== 'undefined')
          ? CAT_DEF.find(c => c.id === slug)
          : null;
        const sementes = (def && Array.isArray(def.busca)) ? def.busca : [];
        sementes.forEach(s => adicionar(s, true)); // adicionar() já dedupa contra os manuais
      }
      render();
    };

    // Limpa tudo (usado no ramoReset / fechar modal de cadastro)
    window.tagsClearDefaults = function () {
      tags = [];
      inputEl.value = '';
      render();
    };

    /* ── Eventos ───────────────────────────────────────────── */
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        consumirInput();
      } else if (e.key === 'Backspace' && inputEl.value === '' && tags.length) {
        // Backspace com input vazio remove o último chip
        removerIdx(tags.length - 1);
      }
    });
    // Vírgula digitada/colada também separa
    inputEl.addEventListener('input', () => {
      if (inputEl.value.includes(',')) consumirInput();
    });
    inputEl.addEventListener('blur', () => {
      box.classList.remove('is-focused');
      if (inputEl.value.trim()) consumirInput();
    });
    inputEl.addEventListener('focus', () => box.classList.add('is-focused'));
    // Clicar em qualquer ponto da caixa foca o input
    box.addEventListener('click', () => { if (!inputEl.disabled) inputEl.focus(); });

    render(); // estado inicial vazio
  })(); // ── fim initTagChips ──────────────────────────────────

  /* ══════════════════════════════════════════════════════════════
     MINHA LOJA — Edição de informações (nome, telefone, endereço,
     descrição, tags, horário). UI inline com leitura→edição.
     Cada save chama um endpoint dedicado do GAS.
  ══════════════════════════════════════════════════════════════ */
  (function initMlInfoEditor() {
    const DIAS_LBL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    // Estado dos dados atuais da loja (preenchido por mlRenderInfo)
    let cur = {};
    // Flag: há um editor de campo aberto? Bloqueia re-render (evita perder edição
    // quando os dados frescos da API chegam logo após o cache — race condition).
    let editando = false;

    // Helpers locais ----------------------------------------------------
    function el(id) { return document.getElementById(id); }
    // Persiste o cur atualizado no cache local, para que ao reabrir o painel
    // o valor editado já apareça (evita piscar o valor antigo até o fetch).
    function persistirCache() {
      try {
        const c = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
        if (c) {
          // Sincroniza só os campos que o painel edita
          ['nome','tel','endereco','horario','tags','obs','bairro'].forEach(function (k) {
            if (cur[k] !== undefined) c[k] = cur[k];
          });
          localStorage.setItem('angatuba_loja_dados', JSON.stringify(c));
        }
      } catch (e) { /* cache é só otimização — falha silenciosa */ }
    }
    function fmtTel(d) {
      d = String(d || '').replace(/\D/g, '');
      if (!d) return '';
      if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
      return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
    }

    // ── Render principal: monta as linhas de info ─────────────────────
    window.mlRenderInfo = function (d) {
      // Se o usuário está editando um campo, NÃO re-renderiza (perderia a edição).
      // Apenas atualiza os dados de fundo para refletir os valores frescos da API
      // nos campos que NÃO estão sendo editados (visíveis na próxima vez que abrir).
      if (editando) {
        if (d) {
          // Preserva o objeto cur (mesma referência) mesclando os campos novos
          Object.keys(d).forEach(function (k) { cur[k] = d[k]; });
        }
        return;
      }
      cur = d || {};
      const list = el('ml-info-list');
      if (!list) return;

      const rows = [
        { key:'nome',      icon:'fa-store',        label:'Nome da loja',  val: cur.nome || '',                empty:'Sem nome' },
        { key:'telefone',  icon:'fa-phone',        label:'Telefone fixo', val: fmtTel(cur.tel),               empty:'Não informado' },
        { key:'endereco',  icon:'fa-location-dot', label:'Endereço',      val: cur.endereco || '',            empty:'Não informado' },
        { key:'horario',   icon:'fa-clock',        label:'Horário',       val: cur.horario || '',             empty:'Não informado' },
        { key:'tags',      icon:'fa-magnifying-glass', label:'Tags de busca', val: String(cur.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean).join(', '),            empty:'Nenhuma palavra-chave' },
        { key:'descricao', icon:'fa-align-left',   label:'Descrição',     val: cur.obs || '',                 empty:'Sem descrição' },
      ];

      list.innerHTML = rows.map(function (r) {
        const isEmpty = !r.val;
        const shown = isEmpty ? r.empty : escHTML(r.val);
        return `
        <div class="ml-info-row" id="ml-info-row-${r.key}">
          <div class="ml-info-icon"><i class="fa ${r.icon}"></i></div>
          <div class="ml-info-body">
            <div class="ml-info-label">${r.label}</div>
            <div class="ml-info-value${isEmpty ? ' is-empty' : ''}" id="ml-info-val-${r.key}">${shown}</div>
          </div>
          <button class="ml-info-edit-btn" aria-label="Editar ${r.label}" onclick="mlEditField('${r.key}')">
            <i class="fa fa-pen"></i>
          </button>
        </div>`;
      }).join('');
    };

    // ── Fecha o editor: zera a flag e re-renderiza ────────────────────
    // Usado por Cancelar e após salvar com sucesso.
    // keyDestaque (opcional): chave do campo salvo, para flash de confirmação.
    window.mlFecharEditor = function (d, keyDestaque) {
      editando = false;
      window.mlRenderInfo(d || cur);
      if (keyDestaque) {
        const row = el('ml-info-row-' + keyDestaque);
        if (row) {
          row.classList.add('salvou');
          setTimeout(function () { row.classList.remove('salvou'); }, 1100);
        }
      }
    };

    // ── Entra em modo edição de um campo ──────────────────────────────
    window.mlEditField = function (key) {
      const row = el('ml-info-row-' + key);
      if (!row) return;
      editando = true; // bloqueia re-render enquanto edita

      if (key === 'tags')     return abrirEditorTags(row);
      if (key === 'horario')  return abrirEditorHorario(row);
      if (key === 'endereco') return abrirEditorEndereco(row);

      // Campos simples: nome, telefone, descrição
      const cfg = {
        nome:      { label:'Nome da loja',  ph:'Nome da sua loja',          max:60,  multiline:false, val: cur.nome || '' },
        telefone:  { label:'Telefone fixo', ph:'(15) 3255-0000',            max:16,  multiline:false, val: fmtTel(cur.tel), tel:true },
        descricao: { label:'Descrição',     ph:'Ex: Hambúrguer artesanal na chapa, massa de pizza fermentada 48h…', max:200, multiline:true, val: cur.obs || '',
                     hint:'Conte o diferencial da sua loja — não repita as palavras-chave de busca. É o texto que aparece no seu anúncio.' },
      }[key];
      if (!cfg) return;

      const inputHTML = cfg.multiline
        ? `<textarea class="ml-info-input" id="ml-info-edit-input" maxlength="${cfg.max}" placeholder="${escAttr(cfg.ph)}" rows="3">${escHTML(cfg.val)}</textarea>`
        : `<input type="${cfg.tel ? 'tel' : 'text'}" class="ml-info-input" id="ml-info-edit-input" maxlength="${cfg.max}" placeholder="${escAttr(cfg.ph)}" value="${escAttr(cfg.val)}" ${cfg.tel ? 'inputmode="numeric"' : ''}/>`;

      row.innerHTML = `
        <div class="ml-info-icon"><i class="fa fa-pen"></i></div>
        <div class="ml-info-editor">
          <div class="ml-info-label">${cfg.label}</div>
          ${inputHTML}
          ${cfg.hint ? `<div class="ml-info-hint">${escHTML(cfg.hint)}</div>` : ''}
          <div class="ml-info-actions">
            <button class="ml-info-btn ml-info-btn-cancel" onclick="mlFecharEditor()">Cancelar</button>
            <button class="ml-info-btn ml-info-btn-save" id="ml-info-save-btn" onclick="mlSaveField('${key}')">Salvar</button>
          </div>
          <div class="ml-info-msg" id="ml-info-msg"></div>
        </div>`;

      const inp = el('ml-info-edit-input');
      if (inp) {
        inp.focus();
        if (cfg.tel) inp.addEventListener('input', function () { inp.value = mascararWppBR(inp.value); });
      }
    };
    // Guarda referência para o cancelar reconstruir
    Object.defineProperty(window, '_mlInfoCur', { get: function () { return cur; }, configurable: true });

    // ── Salva campo simples ───────────────────────────────────────────
    window.mlSaveField = async function (key) {
      const inp = el('ml-info-edit-input');
      const msg = el('ml-info-msg');
      const btn = el('ml-info-save-btn');
      if (!inp) return;
      const raw = inp.value.trim();

      // Validações leves client-side
      if (key === 'nome' && !raw) { if (msg) { msg.textContent = 'O nome não pode ficar vazio.'; msg.style.color = '#ef4444'; } return; }

      const map = {
        // Item 2: ao renomear, propaga o novo nome para todos os pontos que ainda
        // usam nome como referência (global _lojaNome, objeto em LOJAS via wpp,
        // e o cache do localStorage). Assim a renomeação fica consistente na hora,
        // sem esperar o feed público revalidar (cache de até 60s no GAS).
        nome:      { action:'lojaAtualizarNome',      payload:{ nome: raw },                          apply:function(){
                       cur.nome = raw;
                       _lojaNome = raw;
                       try { localStorage.setItem('angatuba_loja_nome', raw); } catch(e) {}
                       // _lojaIdxMap indexa por REFERÊNCIA do objeto (não por nome),
                       // então mutar lj.nome não invalida o índice — basta atualizar o campo.
                       const lj = _mlAcharLojaLocal(cur);
                       if (lj) lj.nome = raw;
                     } },
        telefone:  { action:'lojaAtualizarTelefone',  payload:{ telefone: raw.replace(/\D/g,'') },    apply:function(){ cur.tel = raw.replace(/\D/g,''); } },
        descricao: { action:'lojaAtualizarDescricao', payload:{ descricao: raw },                     apply:function(){ cur.obs = raw; } },
      }[key];
      if (!map) return;

      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      try {
        const json = await apiPost(map.action, Object.assign({ token: _lojaToken }, map.payload), { timeout: 20000, ignoreUnauthorized: true });
        if (json.status === 'ok') {
          map.apply();
          persistirCache();
          mlFecharEditor(cur, key);
        } else {
          throw new Error(json.msg || 'Erro');
        }
      } catch (e) {
        if (msg) { msg.textContent = 'Erro ao salvar: ' + e.message; msg.style.color = '#ef4444'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
      }
    };

    /* ════════════════ TAGS (chips) ════════════════ */
    let tagState = []; // [{texto, isDefault}]

    function normTag(s) {
      return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
    }
    function limparTag(s) {
      return String(s).replace(/[,\n\r]/g,' ').replace(/\s+/g,' ').trim().slice(0, 28);
    }

    function abrirEditorTags(row) {
      // Semeia o estado com as tags atuais (todas como "manuais" — já são da loja)
      const atuais = String(cur.tags || '').split(',').map(function(t){return t.trim();}).filter(Boolean);
      tagState = atuais.map(function(t){ return { texto: t, isDefault: false }; });

      // Descobre a categoria da loja p/ oferecer sugestões padrão
      const slug = mlSlugDaLoja();
      const def = (typeof CAT_DEF !== 'undefined' && slug) ? CAT_DEF.find(function(c){ return c.id === slug; }) : null;
      const sementes = (def && Array.isArray(def.busca)) ? def.busca : [];

      row.innerHTML = `
        <div class="ml-info-icon"><i class="fa fa-magnifying-glass"></i></div>
        <div class="ml-info-editor">
          <div class="ml-info-label">Tags de busca</div>
          <div class="tags-box" id="mle-tags-box">
            <div class="tags-chips" id="mle-tags-chips"></div>
            <input type="text" class="tags-input" id="mle-tags-input" placeholder="Adicionar palavra…" autocomplete="off" maxlength="28"/>
          </div>
          ${sementes.length ? `<div class="ml-info-hint" id="mle-tags-sugestoes-wrap"><span style="opacity:.7;">Sugestões da sua categoria:</span> <span id="mle-tags-sugestoes"></span></div>` : ''}
          <div class="ml-info-actions">
            <button class="ml-info-btn ml-info-btn-cancel" onclick="mlFecharEditor()">Cancelar</button>
            <button class="ml-info-btn ml-info-btn-save" id="mle-tags-save" onclick="mlSaveTags()">Salvar</button>
          </div>
          <div class="ml-info-msg" id="mle-tags-msg"></div>
        </div>`;

      renderTagChips();
      renderSugestoes(sementes);

      const inp = el('mle-tags-input');
      if (inp) {
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); consumirTagInput(); }
          else if (e.key === 'Backspace' && inp.value === '' && tagState.length) { tagState.pop(); renderTagChips(); }
        });
        inp.addEventListener('input', function () { if (inp.value.includes(',')) consumirTagInput(); });
        inp.addEventListener('blur', function () {
          el('mle-tags-box')?.classList.remove('is-focused');
          if (inp.value.trim()) consumirTagInput();
        });
        inp.addEventListener('focus', function () { el('mle-tags-box')?.classList.add('is-focused'); });
      }
      const box = el('mle-tags-box');
      if (box) box.addEventListener('click', function () { if (!inp.disabled) inp.focus(); });
    }

    function tagExiste(txt) {
      const n = normTag(txt);
      return tagState.some(function (t) { return normTag(t.texto) === n; });
    }
    function addTag(raw, isDef) {
      const t = limparTag(raw);
      if (!t) return false;
      if (tagState.length >= 20) return false;
      if (tagExiste(t)) return false;
      tagState.push({ texto: t, isDefault: !!isDef });
      return true;
    }
    function consumirTagInput() {
      const inp = el('mle-tags-input');
      if (!inp) return;
      let mudou = false;
      inp.value.split(',').forEach(function (p) { if (addTag(p, false)) mudou = true; });
      inp.value = '';
      if (mudou) { renderTagChips(); renderSugestoes(); }
    }
    function renderTagChips() {
      const wrap = el('mle-tags-chips');
      if (!wrap) return;
      wrap.innerHTML = '';
      tagState.forEach(function (t, i) {
        const chip = document.createElement('span');
        chip.className = 'tag-chip' + (t.isDefault ? ' is-default' : '');
        const txt = document.createElement('span');
        txt.className = 'tag-chip-txt';
        txt.textContent = t.texto;
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'tag-chip-x'; x.textContent = '✕';
        x.setAttribute('aria-label', 'Remover ' + t.texto);
        x.addEventListener('click', function (e) { e.stopPropagation(); tagState.splice(i, 1); renderTagChips(); renderSugestoes(); });
        chip.appendChild(txt); chip.appendChild(x);
        wrap.appendChild(chip);
      });
      const inp = el('mle-tags-input');
      const cheio = tagState.length >= 20;
      if (inp) { inp.disabled = cheio; inp.placeholder = cheio ? 'Máximo de 20 tags' : 'Adicionar palavra…'; }
    }
    // Sugestões clicáveis (só mostra as que ainda não estão no estado)
    let _sementesCache = [];
    function renderSugestoes(sementes) {
      if (sementes) _sementesCache = sementes;
      const wrap = el('mle-tags-sugestoes');
      if (!wrap) return;
      const disponiveis = _sementesCache.filter(function (s) { return !tagExiste(s); });
      const sugWrap = el('mle-tags-sugestoes-wrap');
      if (!disponiveis.length) { if (sugWrap) sugWrap.style.display = 'none'; return; }
      if (sugWrap) sugWrap.style.display = '';
      // Monta os botões com textContent (sem injeção) e liga via listener (evita
      // quebra se um termo tiver apóstrofo).
      wrap.innerHTML = '';
      disponiveis.forEach(function (s) {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'display:inline-flex;align-items:center;gap:3px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);color:var(--zap);border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;cursor:pointer;margin:2px 3px 2px 0;font-family:var(--font-b);';
        b.textContent = '+ ' + s;
        b.addEventListener('click', function () {
          if (addTag(s, true)) { renderTagChips(); renderSugestoes(); }
        });
        wrap.appendChild(b);
      });
    }
    window.mlAddSugestao = function (s) {
      if (addTag(s, true)) { renderTagChips(); renderSugestoes(); }
    };

    window.mlSaveTags = async function () {
      const btn = el('mle-tags-save');
      const msg = el('mle-tags-msg');
      const valor = tagState.map(function (t) { return String(t.texto || '').trim(); }).filter(Boolean).join(', ');
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      try {
        const json = await apiPost('lojaAtualizarTags', { token: _lojaToken, tags: valor }, { timeout: 20000, ignoreUnauthorized: true });
        if (json.status === 'ok') {
          cur.tags = json.data && typeof json.data.tags === 'string' ? json.data.tags : valor;
          persistirCache();
          mlFecharEditor(cur, 'tags');
        } else { throw new Error(json.msg || 'Erro'); }
      } catch (e) {
        if (msg) { msg.textContent = 'Erro ao salvar: ' + e.message; msg.style.color = '#ef4444'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
      }
    };

    /* ════════════════ ENDEREÇO (com autocomplete) ════════════════ */
    let mleAddrRua = '';
    let mleAddrTimer = null;

    function abrirEditorEndereco(row) {
      mleAddrRua = '';
      // Separa rua e número do endereço atual. Ex: "Rua X, 123" → rua "Rua X", num "123".
      // Pega o último trecho após vírgula se for só dígitos; senão deixa tudo na rua.
      let ruaInicial = cur.endereco || '';
      let numInicial = '';
      const mNum = ruaInicial.match(/^(.*),\s*(\d+[A-Za-z]?)\s*$/);
      if (mNum) { ruaInicial = mNum[1].trim(); numInicial = mNum[2].trim(); }
      row.innerHTML = `
        <div class="ml-info-icon"><i class="fa fa-location-dot"></i></div>
        <div class="ml-info-editor">
          <div class="ml-info-label">Endereço</div>
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <div style="flex:1;position:relative;">
              <input type="text" class="ml-info-input" id="mle-addr-rua" placeholder="Digite a rua…" value="${escAttr(ruaInicial)}" autocomplete="off"/>
              <div class="mle-addr-suggestions" id="mle-addr-sugg" style="display:none;"></div>
            </div>
            <input type="text" class="ml-info-input" id="mle-addr-num" placeholder="Nº" inputmode="numeric" value="${escAttr(numInicial)}" style="width:70px;flex-shrink:0;"/>
          </div>
          <div class="ml-info-hint" id="mle-addr-status">📍 Digite ao menos 4 letras para buscar a rua.</div>
          <div class="ml-info-label" style="margin-top:10px;">Bairro</div>
          <select class="ml-info-input" id="mle-addr-bairro" style="cursor:pointer;">
            <option value="">Selecione o bairro…</option>
            ${BAIRROS_ANGATUBA.map(function (b) {
              const sel = (normBairro(b) === normBairro(cur.bairro || '')) ? ' selected' : '';
              return `<option value="${escAttr(b)}"${sel}>${escHTML(b)}</option>`;
            }).join('')}
          </select>
          <div class="ml-info-actions">
            <button class="ml-info-btn ml-info-btn-cancel" onclick="mlFecharEditor()">Cancelar</button>
            <button class="ml-info-btn ml-info-btn-save" id="mle-addr-save" onclick="mlSaveEndereco()">Salvar</button>
          </div>
          <div class="ml-info-msg" id="mle-addr-msg"></div>
        </div>`;

      const inpRua = el('mle-addr-rua');
      const sugg   = el('mle-addr-sugg');
      if (inpRua) {
        inpRua.focus();
        inpRua.addEventListener('input', function () {
          mleAddrRua = ''; // invalida seleção ao digitar
          // Item 10: mudou o texto → reseta o estado de confirmação de endereço livre.
          _mleEndConfirmarLivre = false;
          const btnS = el('mle-addr-save'); if (btnS && !btnS.disabled) btnS.textContent = 'Salvar';
          const q = inpRua.value.trim();
          if (mleAddrTimer) clearTimeout(mleAddrTimer);
          if (q.length < 4) { if (sugg) sugg.style.display = 'none'; return; }
          mleAddrTimer = setTimeout(function () { mleBuscarEndereco(q); }, 500);
        });
      }
    }

    async function mleBuscarEndereco(query) {
      const sugg = el('mle-addr-sugg');
      const status = el('mle-addr-status');
      if (status) status.textContent = '🔎 Buscando…';
      try {
        const headers = { 'Accept-Language': 'pt-BR', 'User-Agent': 'AngatubaON/1.0' };
        const url = 'https://nominatim.openstreetmap.org/search?q=' +
          encodeURIComponent(query + ', Angatuba, SP, Brasil') +
          '&format=json&limit=5&countrycodes=br&addressdetails=1&accept-language=pt-BR';
        const resp = await fetch(url, { headers: headers, signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        let items = await resp.json();
        // Fallback: amplia a busca se nada vier (mesma estratégia do cadastro)
        if (!items.length) {
          const url2 = 'https://nominatim.openstreetmap.org/search?q=' +
            encodeURIComponent(query + ', São Paulo, Brasil') +
            '&format=json&limit=5&countrycodes=br&accept-language=pt-BR';
          const resp2 = await fetch(url2, { headers: headers, signal: AbortSignal.timeout(8000) });
          if (resp2.ok) items = await resp2.json();
        }
        if (!sugg) return;
        if (!items.length) {
          sugg.innerHTML = '<div class="mle-addr-item" style="cursor:default;color:var(--muted);">Nenhum endereço encontrado.</div>';
          sugg.style.display = 'block';
          if (status) status.textContent = '📍 Tente ser mais específico ou digite manualmente.';
          return;
        }
        sugg.innerHTML = items.map(function (it) {
          const parts = it.display_name.split(', ');
          const rua = parts[0];
          const sub = parts.slice(2, 4).join(', ');
          return `<div class="mle-addr-item" data-rua="${escAttr(rua)}">
            <i class="fa fa-map-marker-alt"></i>
            <div><div>${escHTML(rua)}</div>${sub ? `<div class="mle-addr-item-sub">${escHTML(sub)}</div>` : ''}</div>
          </div>`;
        }).join('');
        sugg.querySelectorAll('.mle-addr-item').forEach(function (elItem) {
          if (!elItem.dataset.rua) return;
          elItem.addEventListener('click', function () {
            mleAddrRua = elItem.dataset.rua;
            el('mle-addr-rua').value = mleAddrRua;
            sugg.style.display = 'none';
            // Item 10: seleção confirmada no mapa → limpa estado de confirmação livre.
            _mleEndConfirmarLivre = false;
            const btnS = el('mle-addr-save'); if (btnS && !btnS.disabled) btnS.textContent = 'Salvar';
            const msgE = el('mle-addr-msg'); if (msgE) { msgE.textContent = ''; }
            if (status) { status.textContent = '✅ Rua confirmada — adicione o número ao lado.'; }
            el('mle-addr-num')?.focus();
          });
        });
        sugg.style.display = 'block';
      } catch (e) {
        if (status) status.textContent = '⚠️ Erro na busca. Você pode digitar o endereço manualmente.';
      }
    }

    // Item 10: guarda o estado "endereço digitado à mão, sem confirmar no mapa".
    // Se o lojista não escolheu uma sugestão do autocomplete, o backend gera o link
    // do Maps por busca textual — que pode cair no lugar errado. Em vez de salvar
    // silenciosamente, exigimos um segundo toque de confirmação (sem confirm() nativo,
    // pra não quebrar o tema dark — o próprio botão vira o aviso).
    let _mleEndConfirmarLivre = false;

    window.mlSaveEndereco = async function () {
      const inpRua = el('mle-addr-rua');
      const inpNum = el('mle-addr-num');
      const selBairro = el('mle-addr-bairro');
      const msg = el('mle-addr-msg');
      const btn = el('mle-addr-save');
      if (!inpRua) return;
      // Usa a rua selecionada se houver; senão o texto digitado (permite endereço manual)
      const ruaBase = mleAddrRua || inpRua.value.trim();
      if (!ruaBase) { if (msg) { msg.textContent = 'Informe o endereço.'; msg.style.color = '#ef4444'; _mleEndConfirmarLivre = false; return; } return; }

      // Item 10: endereço não veio de uma sugestão do mapa → confirma antes de salvar.
      const enderecoNaoConfirmado = !mleAddrRua;
      if (enderecoNaoConfirmado && !_mleEndConfirmarLivre) {
        _mleEndConfirmarLivre = true;
        if (msg) {
          msg.innerHTML = '⚠️ Não confirmamos esse endereço no mapa — o link de "como chegar" pode ficar impreciso. Toque em <b>Salvar assim mesmo</b> para continuar, ou escolha uma sugestão da lista.';
          msg.style.color = 'var(--zap)';
        }
        if (btn) { btn.textContent = 'Salvar assim mesmo'; }
        return;
      }

      const num = (inpNum?.value || '').trim();
      const endFull = num ? (ruaBase + ', ' + num) : ruaBase;
      const bairro = selBairro ? selBairro.value : '';

      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      try {
        const json = await apiPost('lojaAtualizarEndereco', { token: _lojaToken, endereco: endFull, bairro: bairro }, { timeout: 20000, ignoreUnauthorized: true });
        if (json.status === 'ok') {
          cur.endereco = endFull;
          cur.bairro = bairro;
          _mleEndConfirmarLivre = false;
          persistirCache();
          mlFecharEditor(cur, 'endereco');
        } else { throw new Error(json.msg || 'Erro'); }
      } catch (e) {
        if (msg) { msg.textContent = 'Erro ao salvar: ' + e.message; msg.style.color = '#ef4444'; }
        if (btn) { btn.disabled = false; btn.textContent = _mleEndConfirmarLivre ? 'Salvar assim mesmo' : 'Salvar'; }
      }
    };

    /* ════════════════ HORÁRIO (turnos) ════════════════ */
    let mleTurnos = []; // [{dias:[...], abre, fecha}]

    const MLE_PRESET_DIAS = {
      semana:     [1,2,3,4,5],
      semana_sab: [1,2,3,4,5,6],
      todos:      [0,1,2,3,4,5,6],
    };

    function abrirEditorHorario(row) {
      // Tenta parsear o horarioTexto atual.
      const parsed = mleParseHorario(cur.horario);
      // Se NÃO conseguiu parsear mas HAVIA um horário salvo, não assume Seg-Sex
      // silenciosamente (sobrescreveria o horário real). Avisa e começa vazio.
      const horarioSalvoNaoReconhecido = !parsed && !!String(cur.horario || '').trim();
      // Item 9: se havia horário salvo mas o formato não foi reconhecido, NÃO semeia
      // Seg-Sex 08-18 (o lojista poderia salvar sem reparar e sobrescrever o horário
      // real por um genérico). Começa com um turno de DIAS VAZIOS: os cards aparecem
      // sem nenhum dia marcado, o preview pede "selecione um dia" e o mlSaveHorario
      // bloqueia salvar enquanto não houver dia+horário escolhidos de fato.
      // Só quando não há horário nenhum (loja nova) usamos o default de conveniência.
      mleTurnos = parsed
        ? parsed
        : (horarioSalvoNaoReconhecido
            ? [{ dias:[], abre:'08:00', fecha:'18:00' }]
            : [{ dias:[1,2,3,4,5], abre:'08:00', fecha:'18:00' }]);

      row.innerHTML = `
        <div class="ml-info-icon"><i class="fa fa-clock"></i></div>
        <div class="ml-info-editor">
          <div class="ml-info-label">Horário de funcionamento</div>
          ${horarioSalvoNaoReconhecido ? `<div class="ml-info-msg" style="color:var(--zap);margin:0 0 8px;">⚠️ Seu horário atual ("${escHTML(String(cur.horario).slice(0,40))}") está num formato antigo. Monte abaixo para atualizar.</div>` : ''}
          <div class="mle-sched-presets">
            <button type="button" class="mle-sched-preset" data-preset="semana" onclick="mlSchedPreset('semana')">📅 Seg a Sex</button>
            <button type="button" class="mle-sched-preset" data-preset="semana_sab" onclick="mlSchedPreset('semana_sab')">📅 Seg a Sáb</button>
            <button type="button" class="mle-sched-preset" data-preset="todos" onclick="mlSchedPreset('todos')">🗓️ Todos os dias</button>
            <button type="button" class="mle-sched-preset" data-preset="custom" onclick="mlSchedPreset('custom')">✏️ Personalizar</button>
          </div>
          <div id="mle-sched-cards"></div>
          <button type="button" class="mle-sched-add" id="mle-sched-add" onclick="mlSchedAddTurno()" style="display:none;"><i class="fa fa-plus"></i> Adicionar turno diferente</button>
          <div class="ml-info-hint" id="mle-sched-preview"></div>
          <div class="ml-info-actions">
            <button class="ml-info-btn ml-info-btn-cancel" onclick="mlFecharEditor()">Cancelar</button>
            <button class="ml-info-btn ml-info-btn-save" id="mle-sched-save" onclick="mlSaveHorario()">Salvar</button>
          </div>
          <div class="ml-info-msg" id="mle-sched-msg"></div>
        </div>`;

      mleRenderCards();
      mleMarcarPreset();
    }

    // Parse "Seg, Ter 08:00-18:00 | Sáb 08:00-12:00" → [{dias,abre,fecha}]
    // Tolerante: aceita acento ou não (Sáb/Sab), separador vírgula OU hífen (Seg-Sex).
    function mleParseHorario(txt) {
      if (!txt) return null;
      try {
        // Normaliza acentos para casar "Sab"/"Sáb", "Ter"/"Têr" etc.
        const semAcento = function (s) {
          return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        const LBL_NORM = DIAS_LBL.map(semAcento); // ['Dom','Seg',...,'Sab']
        const blocos = String(txt).split('|').map(function (b) { return b.trim(); }).filter(Boolean);
        const turnos = [];
        blocos.forEach(function (bl) {
          const m = bl.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
          if (!m) return;
          const abre = m[1].padStart(5, '0');
          const fecha = m[2].padStart(5, '0');
          const diasParte = semAcento(bl.slice(0, m.index).trim());
          let dias = [];

          // Caso 1: range com hífen entre dois dias (ex: "Seg-Sex", "Seg - Sab")
          const rangeMatch = diasParte.match(new RegExp('(' + LBL_NORM.join('|') + ')\\s*[-–]\\s*(' + LBL_NORM.join('|') + ')', 'i'));
          if (rangeMatch) {
            const ini = LBL_NORM.findIndex(function (l) { return l.toLowerCase() === rangeMatch[1].toLowerCase(); });
            const fim = LBL_NORM.findIndex(function (l) { return l.toLowerCase() === rangeMatch[2].toLowerCase(); });
            if (ini >= 0 && fim >= 0 && fim >= ini) {
              for (let d = ini; d <= fim; d++) dias.push(d);
            }
          }
          // Caso 2 (ou complemento): dias listados individualmente
          if (!dias.length) {
            LBL_NORM.forEach(function (lbl, idx) {
              const re = new RegExp('(^|[,\\s])' + lbl + '([,\\s]|$)', 'i');
              if (re.test(diasParte)) dias.push(idx);
            });
          }
          if (dias.length) {
            // Remove duplicatas e ordena
            dias = dias.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
            turnos.push({ dias: dias, abre: abre, fecha: fecha });
          }
        });
        return turnos.length ? turnos : null;
      } catch (e) { return null; }
    }

    window.mlSchedPreset = function (preset) {
      if (preset === 'custom') {
        // Modo livre: mostra botão de adicionar turno, mantém turnos atuais
        el('mle-sched-add').style.display = '';
        mleMarcarPreset('custom');
        return;
      }
      mleTurnos = [{ dias: MLE_PRESET_DIAS[preset].slice(), abre: mleTurnos[0]?.abre || '08:00', fecha: mleTurnos[0]?.fecha || '18:00' }];
      el('mle-sched-add').style.display = 'none';
      mleRenderCards();
      mleMarcarPreset(preset);
    };

    function mleMarcarPreset(forcado) {
      let presetAtivo = forcado || null;
      if (!presetAtivo) {
        // Detecta preset pelos dias do turno único
        if (mleTurnos.length === 1) {
          const ds = mleTurnos[0].dias.slice().sort().join(',');
          if (ds === '1,2,3,4,5') presetAtivo = 'semana';
          else if (ds === '1,2,3,4,5,6') presetAtivo = 'semana_sab';
          else if (ds === '0,1,2,3,4,5,6') presetAtivo = 'todos';
          else presetAtivo = 'custom';
        } else {
          presetAtivo = 'custom';
        }
      }
      document.querySelectorAll('.mle-sched-preset').forEach(function (b) {
        b.classList.toggle('active', b.dataset.preset === presetAtivo);
      });
      if (presetAtivo === 'custom') el('mle-sched-add').style.display = '';
      mleAtualizarPreview();
    }

    window.mlSchedAddTurno = function () {
      mleTurnos.push({ dias: [6], abre: '08:00', fecha: '12:00' });
      mleRenderCards();
      mleAtualizarPreview();
    };

    function mleRenderCards() {
      const wrap = el('mle-sched-cards');
      if (!wrap) return;
      wrap.innerHTML = '';
      mleTurnos.forEach(function (turno, idx) {
        const card = document.createElement('div');
        card.className = 'mle-sched-card';

        const title = document.createElement('div');
        title.className = 'mle-sched-card-title';
        title.textContent = idx === 0 ? 'Dias e horário' : 'Turno adicional';
        card.appendChild(title);

        const daysRow = document.createElement('div');
        daysRow.className = 'mle-sched-days';
        DIAS_LBL.forEach(function (lbl, d) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'mle-sched-day' + (turno.dias.includes(d) ? ' active' : '');
          b.textContent = lbl;
          b.addEventListener('click', function () {
            const di = turno.dias.indexOf(d);
            if (di >= 0) turno.dias.splice(di, 1); else turno.dias.push(d);
            b.classList.toggle('active');
            mleMarcarPreset();
          });
          daysRow.appendChild(b);
        });
        card.appendChild(daysRow);

        const times = document.createElement('div');
        times.className = 'mle-sched-times';
        const inA = document.createElement('input');
        inA.type = 'time'; inA.value = turno.abre;
        inA.addEventListener('change', function () { turno.abre = inA.value; mleAtualizarPreview(); });
        const sep = document.createElement('span'); sep.textContent = 'até';
        const inF = document.createElement('input');
        inF.type = 'time'; inF.value = turno.fecha;
        inF.addEventListener('change', function () { turno.fecha = inF.value; mleAtualizarPreview(); });
        times.appendChild(inA); times.appendChild(sep); times.appendChild(inF);
        card.appendChild(times);

        if (idx > 0) {
          const rm = document.createElement('button');
          rm.type = 'button'; rm.className = 'mle-sched-remove';
          rm.innerHTML = '<i class="fa fa-times"></i>';
          rm.addEventListener('click', function () { mleTurnos.splice(idx, 1); mleRenderCards(); mleMarcarPreset(); });
          card.appendChild(rm);
        }
        wrap.appendChild(card);
      });
      mleAtualizarPreview();
    }

    function mleMontarTexto() {
      return mleTurnos.map(function (t) {
        if (!t.dias.length) return null;
        const nomes = t.dias.slice().sort(function (a, b) { return a - b; }).map(function (d) { return DIAS_LBL[d]; }).join(', ');
        return nomes + ' ' + t.abre + '-' + t.fecha;
      }).filter(Boolean).join(' | ');
    }
    function mleMontarDias() {
      return mleTurnos.flatMap(function (t) { return t.dias; })
        .filter(function (v, i, a) { return a.indexOf(v) === i; })
        .sort(function (a, b) { return a - b; }).join(',');
    }
    function mleAtualizarPreview() {
      const pv = el('mle-sched-preview');
      if (!pv) return;
      const txt = mleMontarTexto();
      pv.textContent = txt ? ('Resumo: ' + txt) : 'Selecione pelo menos um dia.';
    }

    window.mlSaveHorario = async function () {
      const btn = el('mle-sched-save');
      const msg = el('mle-sched-msg');
      const texto = mleMontarTexto();
      if (!texto) { if (msg) { msg.textContent = 'Selecione ao menos um dia e horário.'; msg.style.color = '#ef4444'; } return; }
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      try {
        const json = await apiPost('lojaAtualizarHorario', { token: _lojaToken, horario: texto, dias: mleMontarDias() }, { timeout: 20000, ignoreUnauthorized: true });
        if (json.status === 'ok') {
          cur.horario = texto;
          persistirCache();
          mlFecharEditor(cur, 'horario');
        } else { throw new Error(json.msg || 'Erro'); }
      } catch (e) {
        if (msg) { msg.textContent = 'Erro ao salvar: ' + e.message; msg.style.color = '#ef4444'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
      }
    };

    /* ── Descobre o slug da categoria da loja (p/ sugestões de tags) ── */
    function mlSlugDaLoja() {
      // 1) tenta pela lista LOJAS (já tem categoria mapeada)
      // Item 2: junção por WhatsApp (estável a renomeações), não por nome.
      const lj = _mlAcharLojaLocal(cur);
      if (lj && lj.categoria) return lj.categoria;
      // 2) tenta casar o ramo textual contra os ramoLabel de CAT_DEF
      if (typeof CAT_DEF !== 'undefined' && cur.ramo) {
        const rn = String(cur.ramo).toLowerCase();
        const hit = CAT_DEF.find(function (c) {
          return String(c.ramoLabel || '').toLowerCase() === rn ||
                 String(c.chipLabel || '').toLowerCase() === rn ||
                 (Array.isArray(c.busca) && c.busca.some(function (b) { return rn.includes(String(b).toLowerCase()); }));
        });
        if (hit) return hit.id;
      }
      return '';
    }

  // ── Acordeão das "Informações da loja" ────────────────────
  // Alterna a visibilidade do corpo (#ml-info-body) e gira a seta.
  // forcar (opcional): true = abrir, false = fechar; ausente = alterna.
  window.mlToggleInfoSection = function (forcar) {
    const body = document.getElementById('ml-info-body');
    const chev = document.getElementById('ml-info-chev');
    const hdr  = document.getElementById('ml-info-header');
    if (!body) return;
    const estaAberto = body.style.display !== 'none';
    const abrir = (typeof forcar === 'boolean') ? forcar : !estaAberto;
    body.style.display = abrir ? '' : 'none';
    if (chev) chev.style.transform = abrir ? 'rotate(180deg)' : 'rotate(0deg)';
    if (hdr)  hdr.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  };

  // Acordeao da secao de grupos de opcoes (mesmo padrao da secao de infos).
  window.mlToggleGruposSection = function (forcar) {
    const body = document.getElementById('ml-grupos-body');
    const chev = document.getElementById('ml-grupos-chev');
    const hdr  = document.getElementById('ml-grupos-header');
    if (!body) return;
    const estaAberto = body.style.display !== 'none';
    const abrir = (typeof forcar === 'boolean') ? forcar : !estaAberto;
    body.style.display = abrir ? '' : 'none';
    if (chev) chev.style.transform = abrir ? 'rotate(180deg)' : 'rotate(0deg)';
    if (hdr)  hdr.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  };

  })(); // ── fim initMlInfoEditor ──────────────────────────────────

  /* ══════════════════════════════════════════════════════════════
     COMPARTILHAMENTO — painel Minha Loja
  ══════════════════════════════════════════════════════════════ */
  window.mlCopiarLink = function() {
    if (window.mlChecklistMarcar) window.mlChecklistMarcar('compartilhou');
    const urlEl = document.getElementById('ml-share-url');
    const btn   = document.getElementById('ml-copy-btn');
    if (!urlEl) return;
    navigator.clipboard.writeText(urlEl.textContent.trim()).then(() => {
      btn.innerHTML = '<i class="fa fa-check"></i> Copiado!';
      btn.style.color = 'var(--green)';
      setTimeout(() => {
        btn.innerHTML = '<i class="fa fa-copy"></i> Copiar';
        btn.style.color = '';
      }, 2000);
    }).catch(() => {
      // Fallback para browsers sem clipboard API
      const tmp = document.createElement('input');
      tmp.value = urlEl.textContent.trim();
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
      btn.innerHTML = '<i class="fa fa-check"></i> Copiado!';
      setTimeout(() => { btn.innerHTML = '<i class="fa fa-copy"></i> Copiar'; }, 2000);
    });
  };

  // Copia o link direto do cardápio (mesma UX do mlCopiarLink, botão próprio).
  window.mlCopiarCardapio = function() {
    if (window.mlChecklistMarcar) window.mlChecklistMarcar('compartilhou');
    const urlEl = document.getElementById('ml-share-cardapio-url');
    const btn   = document.getElementById('ml-copy-cardapio-btn');
    if (!urlEl || !btn) return;
    const texto = urlEl.textContent.trim();
    const feedback = () => {
      btn.innerHTML = '<i class="fa fa-check"></i> Copiado!';
      btn.style.color = 'var(--green)';
      setTimeout(() => { btn.innerHTML = '<i class="fa fa-copy"></i> Copiar'; btn.style.color = ''; }, 2000);
    };
    navigator.clipboard.writeText(texto).then(feedback).catch(() => {
      const tmp = document.createElement('input');
      tmp.value = texto;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
      feedback();
    });
  };

  // ── Dias fechados (feriado/folga) ─────────────────────────
  function mlDiasFechadosRender(csv) {
    const box = document.getElementById('ml-fechados-lista');
    if (!box) return;
    const hj = (() => { const n = _agoraSP(); return `${n.y}-${String(n.mo).padStart(2,'0')}-${String(n.d).padStart(2,'0')}`; })();
    const datas = String(csv || '').split(',').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= hj);
    box.dataset.datas = datas.join(',');
    const inp = document.getElementById('ml-fechados-data');
    if (inp) inp.min = hj;
    box.innerHTML = datas.length ? datas.map(dt => {
      const [y, m, dd] = dt.split('-');
      return `<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);font-size:11px;font-weight:700;color:var(--red);">` +
        `${dd}/${m}${dt === hj ? ' (hoje)' : ''}<button type="button" onclick="mlDiasFechadosRemover('${dt}')" aria-label="Remover" style="background:none;border:none;color:var(--red);font-size:13px;cursor:pointer;padding:0;line-height:1;">×</button></span>`;
    }).join('') : '<span style="font-size:11px;color:var(--muted);">Nenhum dia marcado.</span>';
  }
  async function _mlDiasFechadosSalvar(lista) {
    const json = await apiPost('lojaAtualizarDiasFechados', { token: _lojaToken, datas: lista.join(',') }, { timeout: 25000 });
    if (json.status !== 'ok') throw new Error(json.msg || 'Falha ao salvar');
    const csv = (json.data && json.data.diasFechados) || '';
    try {
      const c = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
      if (c) { c.diasFechados = csv; localStorage.setItem('angatuba_loja_dados', JSON.stringify(c)); }
    } catch (e) {}
    mlDiasFechadosRender(csv);
  }
  window.mlDiasFechadosAdd = async function () {
    const inp = document.getElementById('ml-fechados-data');
    const box = document.getElementById('ml-fechados-lista');
    const v = inp ? inp.value : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { mlToast('Escolha a data primeiro.', 'erro'); return; }
    const atual = (box && box.dataset.datas) ? box.dataset.datas.split(',').filter(Boolean) : [];
    if (atual.indexOf(v) !== -1) return;
    try { await _mlDiasFechadosSalvar(atual.concat(v)); if (inp) inp.value = ''; mlToast('Pronto! Nesse dia sua loja aparece fechada.', 'ok'); }
    catch (e) { if (e.message !== 'UNAUTHORIZED') mlToast('Não foi possível salvar agora. Tente de novo.', 'erro'); }
  };
  window.mlDiasFechadosRemover = async function (dt) {
    const box = document.getElementById('ml-fechados-lista');
    const atual = (box && box.dataset.datas) ? box.dataset.datas.split(',').filter(Boolean) : [];
    try { await _mlDiasFechadosSalvar(atual.filter(x => x !== dt)); }
    catch (e) { if (e.message !== 'UNAUTHORIZED') mlToast('Não foi possível salvar agora. Tente de novo.', 'erro'); }
  };

  // Lista os pedidos do carrinho dos últimos 30 dias (planos pagos).
  window.mlVerPedidos = async function () {
    const box = document.getElementById('ml-pedidos-lista');
    const btn = document.getElementById('ml-pedidos-btn');
    if (!box || !_lojaToken) return;
    if (box.dataset.aberto === '1') { box.style.display = 'none'; box.dataset.aberto = ''; if (btn) btn.textContent = 'Ver pedidos'; return; }
    if (btn) btn.textContent = 'Carregando…';
    try {
      const json = await apiPost('lojaPedidosListar', { token: _lojaToken }, { timeout: 30000 });
      if (json.status !== 'ok') {
        box.innerHTML = json.msg === 'PLANO'
          ? '<div style="font-size:11px;color:var(--muted);">O histórico de pedidos é dos planos Plus e Pro.</div>'
          : '<div style="font-size:11px;color:var(--red);">Não foi possível carregar agora.</div>';
      } else {
        const ps = (json.data && json.data.pedidos) || [];
        box.innerHTML = ps.length ? ps.map(pd => {
          const dt = pd.ts ? new Date(pd.ts) : null;
          const quando = dt ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
                              dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
          return '<div style="padding:8px 0;border-top:1px solid var(--border);">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:700;">' +
              '<span>' + (pd.id ? '#' + escHTML(pd.id) : 'Pedido') + ' <span style="color:var(--muted);font-weight:600;">· ' + escHTML(quando) + '</span></span>' +
              '<span style="color:var(--green);">' + (pd.valor ? fmtBRL(pd.valor) : '') + '</span>' +
            '</div>' +
            (pd.resumo ? '<div style="font-size:10.5px;color:var(--muted);margin-top:2px;line-height:1.4;">' + escHTML(pd.resumo) + '</div>' : '') +
          '</div>';
        }).join('') : '<div style="font-size:11px;color:var(--muted);">Nenhum pedido pelo app nos últimos 30 dias.</div>';
      }
      box.style.display = ''; box.dataset.aberto = '1';
      if (btn) btn.textContent = 'Esconder pedidos';
    } catch (e) {
      if (btn) btn.textContent = 'Ver pedidos';
      if (e && e.message === 'UNAUTHORIZED') return;
      mlToast('Não foi possível carregar os pedidos.', 'erro');
    }
  };

  // Entrar em outro celular sem pedir código: gera um link de uso único
  // (10 min) e mostra o QR para o outro aparelho escanear.
  window.mlEntrarOutroCelular = async function () {
    if (!_lojaToken) return;
    const btn = document.getElementById('ml-outro-cel-btn');
    const rotulo = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Gerando…'; }
    try {
      const json = await apiPost('lojaGerarLinkLogin', { token: _lojaToken }, { timeout: 25000 });
      if (json.status !== 'ok' || !json.data || !json.data.code) throw new Error(json.msg || 'Falha ao gerar');
      const link = location.origin + '/?entrar=' + json.data.code;
      if (typeof QRCode === 'undefined') await _injetarScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;';
      ov.innerHTML =
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:18px;max-width:340px;width:100%;text-align:center;">' +
          '<div style="font-family:var(--font-h);font-size:15px;font-weight:800;margin-bottom:6px;">Entrar em outro celular</div>' +
          '<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px;">Aponte a câmera do outro celular para o QR. O link vale <strong>10 minutos</strong> e funciona <strong>uma vez só</strong>. Não mande para quem não é da loja.</div>' +
          '<div id="ml-outro-cel-qr" style="background:#fff;border-radius:12px;padding:12px;display:inline-block;"></div>' +
          '<div style="display:flex;gap:8px;margin-top:12px;">' +
            '<button type="button" data-acao="copiar" style="flex:1;padding:10px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);color:var(--text);font-weight:700;font-size:12px;cursor:pointer;"><i class="fa fa-copy"></i> Copiar link</button>' +
            '<button type="button" data-acao="fechar" style="flex:1;padding:10px;border-radius:10px;background:var(--red);border:none;color:#fff;font-weight:700;font-size:12px;cursor:pointer;">Fechar</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      new QRCode(ov.querySelector('#ml-outro-cel-qr'), { text: link, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
      const fechar = () => { clearTimeout(tExp); ov.remove(); };
      const tExp = setTimeout(fechar, 600000);
      ov.addEventListener('click', function (e) {
        const acao = e.target.closest('[data-acao]')?.dataset.acao;
        if (e.target === ov || acao === 'fechar') fechar();
        else if (acao === 'copiar') {
          navigator.clipboard.writeText(link).then(() => mlToast('Link copiado! Abra no outro celular.', 'ok'))
            .catch(() => mlToast('Não deu pra copiar — use o QR.', 'erro'));
        }
      });
    } catch (e) {
      if (e && e.message === 'UNAUTHORIZED') return;
      mlToast('Não foi possível gerar o link agora. Tente de novo.', 'erro');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = rotulo; }
    }
  };

  // Gera um cartaz PNG (nome da loja + QR + link) para imprimir no balcão.
  // A lib de QR só carrega quando o lojista pede (não pesa no app).
  window.mlBaixarQR = async function () {
    const btn = document.getElementById('ml-share-qr-btn');
    const urlEl = document.getElementById('ml-share-url');
    const url = urlEl ? urlEl.textContent.trim() : '';
    if (!url) return;
    const nome = (document.getElementById('ml-nome')?.textContent || _lojaNome || '').trim();
    const rotulo = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Gerando…'; }
    try {
      if (typeof QRCode === 'undefined') await _injetarScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
      const tmp = document.createElement('div');
      new QRCode(tmp, { text: url, width: 760, height: 760, correctLevel: QRCode.CorrectLevel.M });
      const qrCanvas = tmp.querySelector('canvas');
      if (!qrCanvas) throw new Error('QR indisponível');
      const W = 1080, H = 1440;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#111111'; g.textAlign = 'center';
      g.font = 'bold 64px sans-serif';
      let titulo = nome || 'Nossa loja';
      while (g.measureText(titulo).width > W - 120 && titulo.length > 4) titulo = titulo.slice(0, -2);
      if (titulo !== (nome || 'Nossa loja')) titulo = titulo.trim() + '…';
      g.fillText(titulo, W / 2, 150);
      g.font = '40px sans-serif'; g.fillStyle = '#444444';
      g.fillText('Veja o cardápio e chame no WhatsApp', W / 2, 220);
      g.drawImage(qrCanvas, (W - 760) / 2, 290, 760, 760);
      g.font = 'bold 44px sans-serif'; g.fillStyle = '#e11d48';
      g.fillText('📱 Aponte a câmera do celular', W / 2, 1140);
      g.font = '34px sans-serif'; g.fillStyle = '#666666';
      g.fillText(url.replace(/^https?:\/\//, ''), W / 2, 1210);
      g.font = 'bold 38px sans-serif'; g.fillStyle = '#111111';
      g.fillText('AngatubaON', W / 2, 1350);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'qr-' + (toSlug(nome) || 'loja') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      if (window.mlChecklistMarcar) window.mlChecklistMarcar('qrBaixado');
      mlToast('QR baixado! Imprima e deixe no balcão ou na vitrine.', 'ok');
    } catch (e) {
      mlToast('Não foi possível gerar o QR agora. Tente de novo.', 'erro');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = rotulo; }
    }
  };

  // Imagem pronta para o Status do WhatsApp / Stories (1080×1920): capa da
  // loja ao fundo, logo, nome, horário e o link. No celular abre o
  // compartilhar do sistema (dá para mandar direto pro Status); senão baixa.
  window.mlBaixarStatus = async function () {
    const btn = document.getElementById('ml-share-status-btn');
    const lj = _mlAcharLojaLocal(null, _lojaNome);
    const nome = ((lj && lj.nome) || document.getElementById('ml-nome')?.textContent || _lojaNome || '').trim();
    if (!nome) return;
    const rotulo = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Montando…'; }
    // Imagem com CORS (Cloudinary libera). Se o host não liberar, cai no fundo
    // padrão em vez de "sujar" o canvas e travar o toBlob.
    const carregar = (src) => new Promise(ok => {
      if (!src) return ok(null);
      const im = new Image(); im.crossOrigin = 'anonymous';
      const t = setTimeout(() => ok(null), 8000);
      im.onload = () => { clearTimeout(t); ok(im.naturalWidth > 200 ? im : null); };
      im.onerror = () => { clearTimeout(t); ok(null); };
      im.src = src;
    });
    const cobrir = (g, im, x, y, w, h) => {
      const r = Math.max(w / im.naturalWidth, h / im.naturalHeight);
      const iw = im.naturalWidth * r, ih = im.naturalHeight * r;
      g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    };
    const quebrar = (g, txt, max) => {
      const pal = String(txt || '').split(/\s+/); const linhas = []; let l = '';
      pal.forEach(p => { const t = l ? l + ' ' + p : p; if (g.measureText(t).width > max && l) { linhas.push(l); l = p; } else l = t; });
      if (l) linhas.push(l); return linhas;
    };
    try {
      try { await Promise.all([document.fonts.load("800 80px 'Syne'"), document.fonts.load("700 40px 'DM Sans'")]); } catch (e) {}
      const [capa, logo] = await Promise.all([carregar(lj && lj.foto), carregar(lj && lj.logo)]);
      const W = 1080, H = 1920;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      // Fundo: capa escurecida, ou o degradê do app
      const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1a1a2e'); bg.addColorStop(1, '#0b0b12');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      if (capa) { cobrir(g, capa, 0, 0, W, H); }
      const vela = g.createLinearGradient(0, 0, 0, H);
      vela.addColorStop(0, 'rgba(0,0,0,0.15)'); vela.addColorStop(0.45, 'rgba(0,0,0,0.55)'); vela.addColorStop(1, 'rgba(0,0,0,0.92)');
      g.fillStyle = vela; g.fillRect(0, 0, W, H);
      g.textAlign = 'center';
      // Logo
      let y = 900;
      if (logo) {
        const L = 260, lx = (W - L) / 2, ly = y - L;
        g.save(); g.beginPath(); g.roundRect(lx, ly, L, L, 56); g.clip();
        g.fillStyle = '#fff'; g.fillRect(lx, ly, L, L); cobrir(g, logo, lx, ly, L, L); g.restore();
        g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.roundRect(lx, ly, L, L, 56); g.stroke();
        y += 120;
      } else { y += 40; }
      // Nome (até 2 linhas)
      g.fillStyle = '#ffffff'; g.font = "800 96px 'Syne', sans-serif";
      quebrar(g, nome, W - 140).slice(0, 2).forEach(l => { g.fillText(l, W / 2, y); y += 110; });
      // Ramo
      const ramo = (document.getElementById('ml-ramo')?.textContent || (lj && lj.ramo) || '').trim();
      if (ramo && ramo !== '—') { g.font = "600 46px 'DM Sans', sans-serif"; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText(ramo, W / 2, y); y += 90; }
      // Horário (texto que o lojista cadastrou)
      const hor = String((lj && (lj.horarioTexto || lj.horario_texto || (typeof lj.horario === 'string' ? lj.horario : ''))) || '').replace(/\s*\|\s*/g, ' · ').trim();
      // "Seg, Ter, Qua, Qui, Sex, Sáb" → "Seg a Sáb" (3+ dias seguidos)
      const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      const horCurto = hor.replace(/((?:Dom|Seg|Ter|Qua|Qui|Sex|Sáb)(?:\s*,\s*(?:Dom|Seg|Ter|Qua|Qui|Sex|Sáb))+)/g, (m) => {
        const ds = m.split(/\s*,\s*/); const ix = ds.map(d => DIAS.indexOf(d));
        const seguido = ix.every((v, k) => k === 0 || v === ix[k - 1] + 1);
        return (seguido && ds.length >= 3) ? ds[0] + ' a ' + ds[ds.length - 1] : m;
      });
      if (hor) {
        g.font = "700 40px 'DM Sans', sans-serif"; g.fillStyle = '#fbbf24';
        quebrar(g, '🕒 ' + horCurto, W - 160).slice(0, 2).forEach(l => { g.fillText(l, W / 2, y); y += 56; });
      }
      // Chamada + link
      const by = H - 430;
      g.fillStyle = '#e11d48'; g.beginPath(); g.roundRect(110, by, W - 220, 150, 75); g.fill();
      g.fillStyle = '#fff'; g.font = "800 52px 'Syne', sans-serif";
      g.fillText((lj && Array.isArray(lj.cardapio) && lj.cardapio.length) ? 'Veja o cardápio e peça' : 'Chame a gente no WhatsApp', W / 2, by + 92);
      g.font = "700 46px 'DM Sans', sans-serif"; g.fillStyle = '#ffffff';
      g.fillText('angatubaon.com.br', W / 2, by + 250);
      g.font = "600 34px 'DM Sans', sans-serif"; g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText('Procure por “' + (nome.length > 28 ? nome.slice(0, 27) + '…' : nome) + '” no AngatubaON', W / 2, by + 310);

      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('canvas');
      const arq = 'status-' + (toSlug(nome) || 'loja') + '.jpg';
      let compartilhou = false;
      try {
        const file = new File([blob], arq, { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          const urlEl = document.getElementById('ml-share-url');
          await navigator.share({ files: [file], text: urlEl ? urlEl.textContent.trim() : '' });
          compartilhou = true;
        }
      } catch (e) { if (e && e.name === 'AbortError') compartilhou = true; }
      if (!compartilhou) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = arq;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        mlToast('Imagem baixada! Poste no Status do WhatsApp ou nos Stories.', 'ok');
      }
      if (window.mlChecklistMarcar) window.mlChecklistMarcar('compartilhou');
    } catch (e) {
      mlToast('Não foi possível montar a imagem agora. Tente de novo.', 'erro');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = rotulo; }
    }
  };

  function mlMontarCompartilhamento(nome, wpp) {
    // Link estável a renomeação (#nome--id) — vale também pro QR do balcão,
    // que lê o texto de #ml-share-url.
    const slug    = lojaHash(nome, wpp);
    const url     = `${location.origin}/#${slug}`;
    const urlEl   = document.getElementById('ml-share-url');
    const wppEl   = document.getElementById('ml-share-wpp');
    const igEl    = document.getElementById('ml-share-ig');
    if (urlEl) urlEl.textContent = url;
    if (wppEl) {
      wppEl.href = `https://wa.me/?text=${encodeURIComponent(`Confira ${nome} no AngatubaON! 📍\n${url}`)}`;
      wppEl.onclick = function () { if (window.mlChecklistMarcar) window.mlChecklistMarcar('compartilhou'); };
    }
    // Usa o handle do Instagram da loja (se disponível), senão abre o app
    const lojaLocal = _mlAcharLojaLocal(null, nome);
    if (igEl) {
      // Item 2: junção por WhatsApp (estável a renomeações); nome é fallback.
      const igHandle  = lojaLocal ? _igHandleSeguro(lojaLocal.instagram || '') : '';
      igEl.href = igHandle ? `https://www.instagram.com/${igHandle}` : `https://www.instagram.com/`;
    }
    // Link direto do cardápio: só aparece se a loja tem itens no menu.
    // Usa o sufixo /cardapio que o _resolverDeepLink entende (abre a loja
    // e já sobe o cardápio por cima).
    const cardWrap = document.getElementById('ml-share-cardapio-wrap');
    if (cardWrap) {
      const temCardapio = !!(lojaLocal && Array.isArray(lojaLocal.cardapio) && lojaLocal.cardapio.length > 0);
      if (temCardapio) {
        const urlCard = `${location.origin}/#${slug}/cardapio`;
        const urlCardEl = document.getElementById('ml-share-cardapio-url');
        const wppCardEl = document.getElementById('ml-share-cardapio-wpp');
        if (urlCardEl) urlCardEl.textContent = urlCard;
        if (wppCardEl) wppCardEl.href = `https://wa.me/?text=${encodeURIComponent(`Veja o cardápio de ${nome} no AngatubaON! 📖
${urlCard}`)}`;
        cardWrap.style.display = '';
      } else {
        cardWrap.style.display = 'none';
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     GRÁFICO DE PICO — canvas simples, sem lib externa
  ══════════════════════════════════════════════════════════════ */
  function mlRenderizarPico(pico) {
    const canvas = document.getElementById('ml-pico-chart');
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const W      = canvas.offsetWidth || 300;
    const H      = 80;
    canvas.width  = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const max  = Math.max(...pico, 1);
    const barW = W / 24;
    const pad  = 2;

    // Cor do horário atual
    const horaAtual = new Date().getHours();

    pico.forEach((val, h) => {
      const barH   = Math.max(2, (val / max) * (H - 10));
      const x      = h * barW + pad / 2;
      const y      = H - barH;
      const isPico = val === max && val > 0;
      const isNow  = h === horaAtual;

      // Gradiente da barra
      const grad = ctx.createLinearGradient(0, y, 0, H);
      if (isPico) {
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, 'rgba(245,158,11,0.3)');
      } else if (isNow) {
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(1, 'rgba(99,102,241,0.3)');
      } else {
        grad.addColorStop(0, 'rgba(255,255,255,0.25)');
        grad.addColorStop(1, 'rgba(255,255,255,0.05)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW - pad, barH, [2, 2, 0, 0]);
      ctx.fill();
    });

    // Destaque textual
    const idxPico = pico.indexOf(Math.max(...pico));
    const destaqueEl = document.getElementById('ml-pico-destaque');
    if (destaqueEl) {
      if (Math.max(...pico) === 0) {
        destaqueEl.textContent = 'Nenhum clique registrado nos últimos 30 dias.';
      } else {
        const fmt = h => `${String(h).padStart(2,'0')}h`;
        destaqueEl.innerHTML =
          `🔥 Pico às <strong style="color:#f59e0b;">${fmt(idxPico)}–${fmt(idxPico+1)}</strong> · ${pico[idxPico]} clique${pico[idxPico]>1?'s':''}` +
          // Só sugere horário com um mínimo de movimento e fora da madrugada:
          // com poucos dados o "pico" costuma ser o próprio dono testando.
          ((pico[idxPico] >= 5 && idxPico >= 6)
            ? `<div style="margin-top:5px;color:var(--muted);font-size:10px;line-height:1.4;">💡 Publique seu anúncio do dia perto das ${fmt(idxPico)} — é quando mais gente vê sua loja.</div>`
            : `<div style="margin-top:5px;color:var(--muted);font-size:10px;line-height:1.4;">Ainda há pouco movimento para indicar o melhor horário. Com mais visitas, a dica aparece aqui.</div>`);
      }
    }
  }
  /* ══════════════════════════════════════════════════════════════
     UPLOAD DE IMAGENS — painel Minha Loja
  ══════════════════════════════════════════════════════════════ */
  // Atualiza preview da logo ou da capa na seção de configurações
  function mlSetPreviewUpload(tipo, url) {
    if (!url) return;
    if (tipo === 'logo') {
      const previewEl = document.getElementById('ml-up-logo-preview');
      if (previewEl) previewEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:contain;border-radius:9px;" onerror="this.parentElement.innerHTML='<i class=\\'fa fa-store\\' style=\\'color:var(--border);font-size:1.1rem;\\'></i>'" />`;
    } else {
      const img = document.getElementById('ml-up-foto-preview');
      const ph  = document.getElementById('ml-up-capa-placeholder');
      if (img) { img.src = url; img.style.display = ''; }
      if (ph)  ph.style.display = 'none';
      // Foto JÁ SALVA, só visualização: NÃO ativa edição/drag.
      // Reposicionar só vale quando a pessoa upa/troca a foto (mlUploadImagem).
      // Mantém a posição salva (col AG; 50% padrão) e deixa o scroll da página livre.
      const _pos = String(_mlFotoPosSalva || '50% 50%').split(' ');
      _mlPosX = parseFloat(_pos[0]) || 0; _mlPosY = parseFloat(_pos[1]) || 0;
      if (img) img.style.objectPosition = _mlFotoPosSalva;
      _mlEditandoCapa = false;
      mlInitCapaDrag(false);
    }
  }

  // Inicializa drag de reposicionamento da capa no painel (chamado após foto ser exibida)
  // Fix #8: estado de posição no escopo pai — listeners são anexados UMA vez só.
  // Antes, o reset (foto nova) zerava o guard e re-anexava window mousemove/mouseup,
  // vazando um par de listeners globais a cada troca de foto.
  let _mlCapaDragInited = false;
  let _mlEditandoCapa = false; // só true após upload/troca — libera arraste e bloqueia scroll
  let _mlPosX = 50, _mlPosY = 50;
  let _mlFotoPosSalva = '50% 50%'; // posição gravada na planilha (col AG)
  let _mlCapaSalvando = false;     // upload da capa em andamento: a posição vai junto
  let _mlPosTimer = null;
  function _mlPosStr() { return `${Math.round(_mlPosX)}% ${Math.round(_mlPosY)}%`; }

  // Grava a posição da capa (arraste do painel). Debounce: só depois que a
  // pessoa solta o dedo e para de mexer.
  async function _mlSalvarCapaPos() {
    const pos = _mlPosStr();
    if (pos === _mlFotoPosSalva || _mlCapaSalvando) return;
    const statusEl = document.getElementById('ml-up-foto-status');
    if (statusEl) { statusEl.textContent = '⏳ Salvando posição...'; statusEl.style.color = 'var(--muted)'; }
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaAtualizarFotoPos', token: _lojaToken, posicao: pos }));
      const r = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(20000) });
      const j = await r.json();
      if (j.status !== 'ok') throw new Error(j.msg || 'Erro ao salvar');
      _mlFotoPosSalva = pos;
      if (statusEl) { statusEl.textContent = '✅ Posição salva!'; statusEl.style.color = 'var(--green)'; setTimeout(() => { statusEl.textContent = ''; }, 3000); }
    } catch (e) {
      if (statusEl) { statusEl.textContent = '❌ Posição não salva: ' + e.message; statusEl.style.color = 'var(--red)'; }
    }
  }

  function mlInitCapaDrag(mostrarHint) {
    const capaWrap = document.getElementById('ml-up-capa-wrap');
    const capaImg  = document.getElementById('ml-up-foto-preview');
    const dragHint = document.getElementById('ml-up-capa-drag-hint');
    if (!capaWrap || !capaImg) return;

    // Cursor/hint de arraste SÓ quando em modo edição (foto recém-trocada).
    // Em visualização, cursor normal e sem hint — nada sugere arraste.
    if (capaImg.style.display !== 'none' && _mlEditandoCapa) {
      capaWrap.style.cursor = 'grab';
      if (mostrarHint && dragHint) {
        dragHint.style.display = 'block';
        setTimeout(() => { dragHint.style.display = 'none'; }, 3000);
      }
    } else {
      capaWrap.style.cursor = 'default';
      if (dragHint) dragHint.style.display = 'none';
    }

    if (_mlCapaDragInited) return;
    _mlCapaDragInited = true;

    let dragging = false;
    let startX = 0, startY = 0;

    function applyPos() {
      capaImg.style.objectPosition = `${_mlPosX}% ${_mlPosY}%`;
      // Replica no hero do painel para feedback em tempo real
      const heroImg = document.getElementById('ml-hero-img');
      if (heroImg) heroImg.style.objectPosition = `${_mlPosX}% ${_mlPosY}%`;
    }

    function onStart(cx, cy) {
      // Bloqueio principal: sem modo edição, não inicia arraste algum.
      if (!_mlEditandoCapa) return;
      if (capaImg.style.display === 'none') return;
      dragging = true; startX = cx; startY = cy;
      capaWrap.style.cursor = 'grabbing';
      if (dragHint) dragHint.style.display = 'none';
    }
    function onMove(cx, cy) {
      if (!dragging) return;
      _mlPosX = Math.min(100, Math.max(0, _mlPosX - (cx - startX) * 0.3));
      _mlPosY = Math.min(100, Math.max(0, _mlPosY - (cy - startY) * 0.3));
      startX = cx; startY = cy;
      applyPos();
    }
    function onEnd() {
      if (dragging) { clearTimeout(_mlPosTimer); _mlPosTimer = setTimeout(_mlSalvarCapaPos, 700); }
      dragging = false; capaWrap.style.cursor = capaImg.style.display !== 'none' ? 'grab' : 'default';
    }

    capaWrap.addEventListener('mousedown', e => { if (!e.target.closest('label')) { e.preventDefault(); onStart(e.clientX, e.clientY); } });
    window.addEventListener('mousemove',  e => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup',    onEnd);
    capaWrap.addEventListener('touchstart', e => { if (!_mlEditandoCapa) return; if (!e.target.closest('label')) { const t=e.touches[0]; onStart(t.clientX, t.clientY); } }, { passive: true });
    capaWrap.addEventListener('touchmove',  e => { if (!dragging) return; e.preventDefault(); const t=e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: false });
    capaWrap.addEventListener('touchend', onEnd);
  }

  // Fix #8: reseta posição da capa para o centro SEM re-anexar listeners.
  function _mlResetCapaPos(mostrarHint) {
    _mlPosX = 50; _mlPosY = 50;
    const capaImg = document.getElementById('ml-up-foto-preview');
    const heroImg = document.getElementById('ml-hero-img');
    if (capaImg) capaImg.style.objectPosition = '50% 50%';
    if (heroImg) heroImg.style.objectPosition = '50% 50%';
    mlInitCapaDrag(mostrarHint); // garante init na 1ª vez; nas seguintes só atualiza cursor/hint
  }

  async function mlUploadImagem(tipo, input) {
    const file = input.files[0];
    if (!file) return;
    const statusEl = document.getElementById(`ml-up-${tipo}-status`);

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = e => {
      if (tipo === 'logo') {
        const previewEl = document.getElementById('ml-up-logo-preview');
        if (previewEl) previewEl.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;border-radius:9px;" />`;
      } else {
        const img = document.getElementById('ml-up-foto-preview');
        const ph  = document.getElementById('ml-up-capa-placeholder');
        if (img) { img.src = e.target.result; img.style.display = ''; }
        if (ph)  ph.style.display = 'none';
        _mlEditandoCapa = true;   // foto nova: libera arraste de reposicionamento
        _mlResetCapaPos(true);    // foto nova — centro + hint
      }
    };
    reader.readAsDataURL(file);

    // Item 13: a checagem de tamanho saiu daqui — uploadImagem() redimensiona a
    // imagem antes de validar, então uma foto grande de celular passa a ser aceita
    // (vira poucos KB) em vez de barrada de cara.
    statusEl.textContent = '⏳ Enviando...';
    statusEl.style.color = 'var(--muted)';

    if (tipo === 'foto') _mlCapaSalvando = true;
    try {
      const url = await uploadImagem(file, statusEl);
      if (!url) { _mlCapaSalvando = false; return; } // uploadImagem já exibiu erro no statusEl

      // Salva URL na planilha
      const campo = tipo === 'logo' ? 'logoUrl' : 'fotoUrl';
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'lojaAtualizarImagem',
        token:  _lojaToken,
        campo,
        url,
        // Capa: a posição do arraste (até aqui) vai junto e substitui a da foto antiga.
        posicao: tipo === 'foto' ? _mlPosStr() : undefined,
      }));
      const posEnviada = _mlPosStr();
      const saveResp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(20000) });
      const saveJson = await saveResp.json();
      if (saveJson.status !== 'ok') throw new Error(saveJson.msg || 'Erro ao salvar');

      // Atualiza hero/logo no painel imediatamente
      if (tipo === 'foto') {
        const heroImg = document.getElementById('ml-hero-img');
        if (heroImg) { heroImg.src = url; heroImg.style.display = ''; heroImg.style.objectPosition = _mlPosStr(); }
        // A posição já foi zerada quando a foto nova apareceu; não zera de novo
        // aqui (apagaria o arraste feito durante o envio).
        _mlFotoPosSalva = posEnviada;
        _mlCapaSalvando = false;
        // Arrastou enquanto enviava? Grava a posição final.
        if (_mlPosStr() !== posEnviada) _mlSalvarCapaPos();
      } else {
        const logoImg = document.getElementById('ml-logo-img');
        const emojiEl = document.getElementById('ml-emoji');
        if (logoImg) { logoImg.src = url; logoImg.style.display = ''; }
        if (emojiEl) emojiEl.style.display = 'none';
      }

      statusEl.textContent = '✅ Salvo!';
      statusEl.style.color = 'var(--green)';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch(e) {
      if (tipo === 'foto') _mlCapaSalvando = false;
      statusEl.textContent = '❌ ' + e.message;
      statusEl.style.color = 'var(--red)';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     ANÚNCIO DO DIA — painel Minha Loja
  ══════════════════════════════════════════════════════════════ */
  let _anuncioEmojiSelecionado = '🎯';
  let _anuncioImagemUrl = ''; // URL final após upload (Pro)
  let _anuncioMidiaTipo = 'foto'; // 'foto' | 'video' — tipo da mídia selecionada (Pro)
  let _mlStoriesCache = []; // Fase 2: stories atuais do painel (Pro)
  // Fase 3: estado do agendamento automático (Pro).
  let _mlAgendaCache = [];
  let _agendaImagemUrl = '';
  let _agendaMidiaTipo = 'foto';
  let _agendaEmojiSelecionado = '\ud83c\udfaf';
  let _agendaDiasSel = [];

  let _anuncioTimerInterval = null; // Item 17: handle do setInterval do contador de expiração

  // Garante um <video> de preview ao lado do <img> de preview. Criado sob
  // demanda para não mexer no HTML. Reutiliza o mesmo espaço visual.
  function _mlAnuncioVideoPreviewEl() {
    var v = document.getElementById('ml-anuncio-video-nova');
    if (v) return v;
    var img = document.getElementById('ml-anuncio-img-nova');
    if (!img || !img.parentNode) return null;
    v = document.createElement('video');
    v.id = 'ml-anuncio-video-nova';
    v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.muted = true; v.loop = true; v.controls = true; v.preload = 'metadata';
    v.style.cssText = 'display:none;width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-top:8px;border:1px solid var(--border);';
    img.parentNode.insertBefore(v, img.nextSibling);
    return v;
  }

  function mlAnuncioPreviewImagem(input) {
    const file = input.files[0];
    if (!file) return;
    const imgNova   = document.getElementById('ml-anuncio-img-nova');
    const vidNova   = _mlAnuncioVideoPreviewEl();
    const labelTxt  = document.getElementById('ml-anuncio-img-label-txt');
    const removerBtn= document.getElementById('ml-anuncio-img-remover');
    const statusEl  = document.getElementById('ml-anuncio-img-status');
    const ehVideo   = /^video\//.test(file.type);
    _anuncioMidiaTipo = ehVideo ? 'video' : 'foto';
    if (ehVideo) {
      // Preview de vídeo via object URL (base64 de vídeo estoura memória).
      if (imgNova) { imgNova.style.display = 'none'; imgNova.src = ''; }
      if (vidNova) {
        try { if (vidNova.dataset.objurl) URL.revokeObjectURL(vidNova.dataset.objurl); } catch(e){}
        var u = URL.createObjectURL(file);
        vidNova.dataset.objurl = u;
        vidNova.src = u; vidNova.style.display = '';
      }
      if (labelTxt) labelTxt.textContent = file.name + ' (vídeo)';
      if (removerBtn) removerBtn.style.display = '';
      if (statusEl) statusEl.textContent = '';
    } else {
      if (vidNova) { vidNova.style.display = 'none'; vidNova.removeAttribute('src'); }
      const reader = new FileReader();
      reader.onload = e => {
        if (imgNova) { imgNova.src = e.target.result; imgNova.style.display = ''; }
        if (labelTxt) labelTxt.textContent = file.name;
        if (removerBtn) removerBtn.style.display = '';
        if (statusEl) statusEl.textContent = '';
      };
      reader.readAsDataURL(file);
    }
    _anuncioImagemUrl = ''; // Resetar URL — será gerado no publicar
  }

  function mlAnuncioRemoverImagem() {
    _anuncioImagemUrl = '';
    _anuncioMidiaTipo = 'foto';
    const imgNova   = document.getElementById('ml-anuncio-img-nova');
    const vidNova   = document.getElementById('ml-anuncio-video-nova');
    const labelTxt  = document.getElementById('ml-anuncio-img-label-txt');
    const removerBtn= document.getElementById('ml-anuncio-img-remover');
    const statusEl  = document.getElementById('ml-anuncio-img-status');
    const input     = document.getElementById('ml-anuncio-img-input');
    if (imgNova)    { imgNova.src = ''; imgNova.style.display = 'none'; }
    if (vidNova)    { try { if (vidNova.dataset.objurl) URL.revokeObjectURL(vidNova.dataset.objurl); } catch(e){}
                      vidNova.removeAttribute('src'); vidNova.style.display = 'none'; }
    if (labelTxt)   labelTxt.textContent = 'Toque para escolher foto ou vídeo';
    if (removerBtn) removerBtn.style.display = 'none';
    if (statusEl)   statusEl.textContent = '';
    if (input)      input.value = '';
  }

  function mlSelectEmoji(btn) {
    document.querySelectorAll('.anuncio-emoji-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _anuncioEmojiSelecionado = btn.dataset.emoji;
  }

  // Contador de caracteres
  document.getElementById('ml-anuncio-texto')?.addEventListener('input', function() {
    const charEl = document.getElementById('ml-anuncio-chars');
    if (charEl) charEl.textContent = `${this.value.length}/80`;
  });

  function mlExibirAnuncioAtivo(anuncio) {
    if (!anuncio || (!anuncio.texto && !anuncio.imagemUrl)) return;
    const ativoEl = document.getElementById('ml-anuncio-ativo');
    if (!ativoEl) return;

    // Verifica se ainda não expirou
    if (anuncio.expira && new Date(anuncio.expira) <= new Date()) {
      localStorage.removeItem('angatuba_anuncio');
      return;
    }

    // Persiste no sessionStorage para sobreviver ao recarregar
    localStorage.setItem('angatuba_anuncio', JSON.stringify(anuncio));

    ativoEl.style.display = '';
    document.getElementById('ml-anuncio-emoji-preview').textContent = anuncio.emoji || '🎯';
    const _txtPrev = document.getElementById('ml-anuncio-texto-preview');
    if (_txtPrev) {
      _txtPrev.textContent = anuncio.texto || '';
      _txtPrev.style.display = anuncio.texto ? '' : 'none';
    }

    // Mídia do anúncio (só Pro): foto no <img> existente; vídeo num <video>
    // criado sob demanda ao lado (mesmo espaço visual).
    const imgPreview = document.getElementById('ml-anuncio-img-preview');
    const _ehVideoAtivo = String(anuncio.midiaTipo || 'foto') === 'video';
    let vidPreview = document.getElementById('ml-anuncio-video-preview');
    if (_ehVideoAtivo && anuncio.imagemUrl && imgPreview && imgPreview.parentNode && !vidPreview) {
      vidPreview = document.createElement('video');
      vidPreview.id = 'ml-anuncio-video-preview';
      vidPreview.setAttribute('playsinline', ''); vidPreview.setAttribute('webkit-playsinline', '');
      vidPreview.muted = true; vidPreview.loop = true; vidPreview.controls = true; vidPreview.preload = 'metadata';
      vidPreview.style.cssText = 'display:none;width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px;';
      imgPreview.parentNode.insertBefore(vidPreview, imgPreview.nextSibling);
    }
    if (anuncio.imagemUrl) {
      if (_ehVideoAtivo) {
        if (imgPreview) imgPreview.style.display = 'none';
        if (vidPreview) { vidPreview.src = anuncio.imagemUrl; vidPreview.style.display = ''; }
      } else {
        if (vidPreview) { vidPreview.style.display = 'none'; vidPreview.removeAttribute('src'); }
        if (imgPreview) { imgPreview.src = anuncio.imagemUrl; imgPreview.style.display = ''; }
      }
    } else {
      if (imgPreview) imgPreview.style.display = 'none';
      if (vidPreview) vidPreview.style.display = 'none';
    }

    // Timer de expiração — Item 17: atualiza a cada 60s (antes era calculado uma
    // única vez; com o painel aberto o número ficava velho e, ao cruzar a virada
    // do dia, o anúncio sumia no público mas o painel ainda mostrava tempo restante).
    if (anuncio.expira) {
      _mlIniciarTimerAnuncio(anuncio.expira, ativoEl);
      // Se já expirou na primeira checagem, aborta a exibição.
      if (new Date(anuncio.expira) - new Date() <= 0) return;
    }

    // Oculta o formulário enquanto há anúncio ativo
    const formEl = document.getElementById('ml-anuncio-form');
    if (formEl) formEl.style.display = 'none';

    // Guarda dados no form para caso o usuário remova e queira reeditar
    const textarea = document.getElementById('ml-anuncio-texto');
    if (textarea) {
      textarea.value = anuncio.texto || '';
      document.getElementById('ml-anuncio-chars').textContent = `${(anuncio.texto || '').length}/80`;
    }
    const emojiBtn = document.querySelector(`.anuncio-emoji-btn[data-emoji="${anuncio.emoji}"]`);
    if (emojiBtn) mlSelectEmoji(emojiBtn);

    // Guarda URL da mídia atual para caso o usuário reedite
    if (anuncio.imagemUrl) {
      _anuncioImagemUrl = anuncio.imagemUrl;
      _anuncioMidiaTipo = _ehVideoAtivo ? 'video' : 'foto';
      const imgNova    = document.getElementById('ml-anuncio-img-nova');
      const labelTxt   = document.getElementById('ml-anuncio-img-label-txt');
      const removerBtn = document.getElementById('ml-anuncio-img-remover');
      if (_ehVideoAtivo) {
        const vidNova = _mlAnuncioVideoPreviewEl();
        if (imgNova) imgNova.style.display = 'none';
        if (vidNova) { vidNova.src = anuncio.imagemUrl; vidNova.style.display = ''; }
        if (labelTxt) labelTxt.textContent = 'Vídeo atual (toque para trocar)';
      } else {
        const vidNova = document.getElementById('ml-anuncio-video-nova');
        if (vidNova) { vidNova.style.display = 'none'; vidNova.removeAttribute('src'); }
        if (imgNova)    { imgNova.src = anuncio.imagemUrl; imgNova.style.display = ''; }
        if (labelTxt)   labelTxt.textContent = 'Foto atual (toque para trocar)';
      if (removerBtn) removerBtn.style.display = '';
      }
    }
  }

  // Item 17: contador de expiração do anúncio que se atualiza sozinho a cada 60s.
  // Renderiza imediatamente e reagenda; ao expirar, esconde o card, limpa o cache
  // e para o timer. Também para no visibilitychange→hidden e ao fechar o painel.
  function _mlIniciarTimerAnuncio(expira, ativoEl) {
    _mlPararTimerAnuncio(); // nunca acumula mais de um interval
    const render = () => {
      const timerEl = document.getElementById('ml-anuncio-timer');
      const restante = new Date(expira) - new Date();
      if (restante <= 0) {
        if (timerEl) timerEl.textContent = 'Expirado';
        if (ativoEl) ativoEl.style.display = 'none';
        try { localStorage.removeItem('angatuba_anuncio'); } catch(e) {}
        _mlPararTimerAnuncio();
        return;
      }
      if (timerEl) {
        const h = Math.floor(restante / 3600000);
        const m = Math.floor((restante % 3600000) / 60000);
        timerEl.textContent = `Expira em ${h}h ${m}m`;
      }
    };
    render();
    _anuncioTimerInterval = setInterval(render, 60000);
  }
  function _mlPararTimerAnuncio() {
    if (_anuncioTimerInterval) { clearInterval(_anuncioTimerInterval); _anuncioTimerInterval = null; }
  }

  async function mlPublicarAnuncio() {
    // Fase 2: no Pro, publicar = adicionar um story à lista (até 5).
    if (_mlPlanoAtual === 'PRO') { return mlStoryAdicionar(); }
    const texto = document.getElementById('ml-anuncio-texto')?.value.trim() || '';

    const btn = document.getElementById('ml-anuncio-btn');
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Publicando...';
    btn.disabled = true;

    try {
      // Upload da imagem (só Pro, se houver arquivo novo)
      const imgInput  = document.getElementById('ml-anuncio-img-input');
      const statusEl  = document.getElementById('ml-anuncio-img-status');
      let imagemUrl   = _anuncioImagemUrl; // Pode ser URL já salva ou vazia

      if (imgInput && imgInput.files[0]) {
        const imgFile = imgInput.files[0];
        const _ehVideoUp = /^video\//.test(imgFile.type) || _anuncioMidiaTipo === 'video';
        const _dst = statusEl || { textContent: '', style: {} };
        // Vídeo e foto têm caminhos de upload distintos (endpoint e validação).
        const uploadedUrl = _ehVideoUp
          ? await uploadVideoAnuncio(imgFile, _dst)
          : await uploadImagem(imgFile, _dst);
        if (uploadedUrl) {
          imagemUrl = uploadedUrl;
          _anuncioImagemUrl = imagemUrl;
          _anuncioMidiaTipo = _ehVideoUp ? 'video' : 'foto';
        } else {
          // uploadImagem/uploadVideoAnuncio já exibiu o erro no statusEl
          btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
          btn.disabled = false;
          return;
        }
      }

      // Exige pelo menos texto OU mídia (mídia sozinha vale para PRO)
      if (!texto && !imagemUrl) {
        mlToast('Escreva um texto ou escolha uma foto/vídeo para o anúncio.', 'erro');
        btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
        btn.disabled = false;
        return;
      }

      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:    'lojaPublicarAnuncio',
        token:     _lojaToken,
        emoji:     _anuncioEmojiSelecionado,
        texto,
        imagemUrl: imagemUrl || '',
        midiaTipo: imagemUrl ? _anuncioMidiaTipo : 'foto',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();

      if (json.status === 'ok') {
        mlExibirAnuncioAtivo({ emoji: _anuncioEmojiSelecionado, texto, expira: json.data?.expira, imagemUrl: imagemUrl || '', midiaTipo: imagemUrl ? _anuncioMidiaTipo : 'foto' });
        // form já foi ocultado por mlExibirAnuncioAtivo; reabilita btn para quando reaparecer
        btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
        btn.disabled = false;
      } else {
        throw new Error(json.msg || 'Erro');
      }
    } catch(e) {
      mlToast('Erro ao publicar: ' + e.message, 'erro');
      btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
      btn.disabled = false;
    }
  }

  // ── Fase 2: lista de stories no painel (Pro) ─────────────────
  function _mlLimparFormAnuncio() {
    var t = document.getElementById('ml-anuncio-texto'); if (t) t.value = '';
    var c = document.getElementById('ml-anuncio-chars'); if (c) c.textContent = '0/80';
    if (typeof mlAnuncioRemoverImagem === 'function') { try { mlAnuncioRemoverImagem(); } catch(e){} }
    _anuncioImagemUrl = ''; _anuncioMidiaTipo = 'foto';
  }

  async function mlStoriesCarregar() {
    var lst = document.getElementById('ml-stories-lista');
    var cnt = document.getElementById('ml-stories-contador');
    if (!lst) return;
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaStoriesListar', token:_lojaToken }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      var json = await resp.json();
      if (json.status !== 'ok') { lst.innerHTML = ''; return; }
      var stories = json.data.stories || [];
      var limite = json.data.limite || 5;
      _mlStoriesCache = stories;
      if (cnt) cnt.textContent = stories.length + ' de ' + limite + ' anúncios no ar';
      if (!stories.length) {
        // A1: copy de neg\u00f3cio \u2014 refor\u00e7a o benef\u00edcio (destaque na cidade) em vez de s\u00f3 instruir.
        lst.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:6px 2px;">Publique o primeiro an\u00fancio e apare\u00e7a em destaque na cidade \u2014 pode ter at\u00e9 ' + limite + ' no ar.</div>';
      } else {
        lst.innerHTML = stories.map(function(st){
          var ehVideo = String(st.midiaTipo||'foto') === 'video';
          var thumb = st.imagemUrl
            ? (ehVideo
                ? '<div style="width:44px;height:44px;border-radius:8px;background:#000;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="ti ti-player-play" style="color:#fff;font-size:16px;"></i></div>'
                : '<img src="' + escAttr(st.imagemUrl) + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" />')
            : '<div style="width:44px;height:44px;border-radius:8px;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.2rem;">' + escHTML(st.emoji||'\ud83c\udfaf') + '</div>';
          var txt = st.texto ? escHTML(st.texto) : '<span style="opacity:.5;">(sem texto)</span>';
          var tag = ehVideo ? '<span style="font-size:8px;background:rgba(245,158,11,.2);color:var(--zap);padding:1px 5px;border-radius:4px;font-weight:700;margin-left:4px;">V\u00cdDEO</span>' : '';
          return '<div style="display:flex;align-items:center;gap:9px;padding:7px;background:var(--surface);border:1px solid var(--border);border-radius:9px;margin-bottom:6px;">' +
            thumb +
            '<div style="flex:1;min-width:0;font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + txt + tag + '</div>' +
            '<button onclick="mlStoryRemover(\'' + escAttr(st.id) + '\')" style="font-size:10px;color:var(--red);background:none;border:1px solid rgba(255,68,68,0.3);border-radius:6px;cursor:pointer;padding:3px 8px;flex-shrink:0;">Remover</button>' +
          '</div>';
        }).join('');
      }
      // Esconde/mostra o form conforme o limite.
      var form = document.getElementById('ml-anuncio-form');
      var btn = document.getElementById('ml-anuncio-btn');
      if (stories.length >= limite) {
        if (form) form.style.opacity = '.5';
        if (btn) { btn.disabled = true; btn.title = 'Limite de ' + limite + ' stories atingido'; }
      } else {
        if (form) form.style.opacity = '';
        if (btn) { btn.disabled = false; btn.title = ''; }
      }
    } catch(e) { lst.innerHTML = '<div style="font-size:11px;color:var(--red);">Erro ao carregar os anúncios.</div>'; }
  }
  window.mlStoriesCarregar = mlStoriesCarregar;

  async function mlStoryAdicionar() {
    var texto = (document.getElementById('ml-anuncio-texto')||{}).value;
    texto = (texto || '').trim();
    var btn = document.getElementById('ml-anuncio-btn');
    if (btn) { btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Publicando...'; btn.disabled = true; }
    try {
      var imgInput = document.getElementById('ml-anuncio-img-input');
      var statusEl = document.getElementById('ml-anuncio-img-status');
      var imagemUrl = _anuncioImagemUrl;
      var midiaTipo = _anuncioMidiaTipo;
      if (imgInput && imgInput.files[0]) {
        var f = imgInput.files[0];
        var ehVid = /^video\//.test(f.type) || _anuncioMidiaTipo === 'video';
        var dst = statusEl || { textContent:'', style:{} };
        var url = ehVid ? await uploadVideoAnuncio(f, dst) : await uploadImagem(f, dst);
        if (!url) { if (btn){ btn.innerHTML='<i class="fa fa-bullhorn"></i> Publicar'; btn.disabled=false; } return; }
        imagemUrl = url; midiaTipo = ehVid ? 'video' : 'foto';
      }
      if (!texto && !imagemUrl) {
        mlToast('Escreva um texto ou escolha uma foto/vídeo.', 'erro');
        if (btn){ btn.innerHTML='<i class="fa fa-bullhorn"></i> Publicar'; btn.disabled=false; } return;
      }
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:'lojaStorySalvar', token:_lojaToken,
        emoji:_anuncioEmojiSelecionado, texto:texto,
        imagemUrl: imagemUrl || '', midiaTipo: imagemUrl ? midiaTipo : 'foto',
      }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(15000) });
      var json = await resp.json();
      if (json.status === 'ok') {
        mlToast('Anúncio publicado!', 'ok');
        _mlLimparFormAnuncio();
        await mlStoriesCarregar();
      } else { throw new Error(json.msg || 'Erro'); }
    } catch(e) { mlToast('Erro ao publicar: ' + e.message, 'erro'); }
    finally { if (btn){ btn.innerHTML='<i class="fa fa-bullhorn"></i> Publicar'; btn.disabled=false; } }
  }
  window.mlStoryAdicionar = mlStoryAdicionar;

  // ══════════════════════════════════════════════════════════
  //  FASE 3 — AGENDAMENTO AUTOMÁTICO DE STORIES (Pro)
  // ══════════════════════════════════════════════════════════

  function mlAgendaSelectEmoji(btn) {
    var pais = document.getElementById('ml-agenda-emojis');
    if (pais) Array.prototype.forEach.call(pais.querySelectorAll('.anuncio-emoji-btn'), function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    _agendaEmojiSelecionado = btn.getAttribute('data-emoji') || '\ud83c\udfaf';
  }
  window.mlAgendaSelectEmoji = mlAgendaSelectEmoji;

  function mlAgendaToggleDia(btn) {
    var dia = btn.getAttribute('data-dia');
    if (!dia) return;
    var i = _agendaDiasSel.indexOf(dia);
    if (i === -1) { _agendaDiasSel.push(dia); btn.classList.add('active'); }
    else { _agendaDiasSel.splice(i, 1); btn.classList.remove('active'); }
  }
  window.mlAgendaToggleDia = mlAgendaToggleDia;

  function mlAgendaRecorrenciaChange() {
    var sel = document.getElementById('ml-agenda-recorrencia');
    var box = document.getElementById('ml-agenda-dias');
    if (box) box.style.display = (sel && sel.value === 'dias') ? '' : 'none';
  }
  window.mlAgendaRecorrenciaChange = mlAgendaRecorrenciaChange;

  function mlAgendaPreviewImagem(input) {
    var f = input && input.files && input.files[0];
    if (!f) return;
    var ehVid = /^video\//.test(f.type);
    _agendaMidiaTipo = ehVid ? 'video' : 'foto';
    var lbl = document.getElementById('ml-agenda-img-label-txt');
    if (lbl) lbl.textContent = (ehVid ? '\ud83c\udfac ' : '\ud83d\uddbc\ufe0f ') + f.name;
    var img = document.getElementById('ml-agenda-img-nova');
    var rem = document.getElementById('ml-agenda-img-remover');
    if (rem) rem.style.display = '';
    if (img) {
      if (ehVid) { img.style.display = 'none'; }
      else {
        var r = new FileReader();
        r.onload = function(ev){ img.src = ev.target.result; img.style.display = ''; };
        r.readAsDataURL(f);
      }
    }
  }
  window.mlAgendaPreviewImagem = mlAgendaPreviewImagem;

  function mlAgendaRemoverImagem() {
    _agendaImagemUrl = ''; _agendaMidiaTipo = 'foto';
    var inp = document.getElementById('ml-agenda-img-input'); if (inp) inp.value = '';
    var img = document.getElementById('ml-agenda-img-nova'); if (img) { img.src = ''; img.style.display = 'none'; }
    var rem = document.getElementById('ml-agenda-img-remover'); if (rem) rem.style.display = 'none';
    var lbl = document.getElementById('ml-agenda-img-label-txt'); if (lbl) lbl.textContent = 'Toque para escolher foto ou v\u00eddeo';
    var st = document.getElementById('ml-agenda-img-status'); if (st) st.textContent = '';
  }
  window.mlAgendaRemoverImagem = mlAgendaRemoverImagem;

  function _mlAgendaLimparForm() {
    var id = document.getElementById('ml-agenda-id'); if (id) id.value = '';
    var t = document.getElementById('ml-agenda-texto'); if (t) t.value = '';
    var h = document.getElementById('ml-agenda-hora'); if (h) h.value = '18:00';
    var r = document.getElementById('ml-agenda-recorrencia'); if (r) r.value = 'diario';
    _agendaDiasSel = [];
    var btns = document.getElementById('ml-agenda-dias-btns');
    if (btns) Array.prototype.forEach.call(btns.querySelectorAll('.ml-dia-btn'), function(b){ b.classList.remove('active'); });
    mlAgendaRecorrenciaChange();
    mlAgendaRemoverImagem();
    var pais = document.getElementById('ml-agenda-emojis');
    if (pais) {
      Array.prototype.forEach.call(pais.querySelectorAll('.anuncio-emoji-btn'), function(b, idx){
        if (idx === 0) b.classList.add('active'); else b.classList.remove('active');
      });
    }
    _agendaEmojiSelecionado = '\ud83c\udfaf';
  }

  function mlAgendaToggleForm() {
    var f = document.getElementById('ml-agenda-form');
    if (!f) return;
    var abrindo = f.style.display === 'none';
    if (abrindo) _mlAgendaLimparForm();
    f.style.display = abrindo ? '' : 'none';
  }
  window.mlAgendaToggleForm = mlAgendaToggleForm;

  function mlAgendaCancelar() {
    var f = document.getElementById('ml-agenda-form');
    if (f) f.style.display = 'none';
    _mlAgendaLimparForm();
  }
  window.mlAgendaCancelar = mlAgendaCancelar;

  // Texto legível da recorrência para o card da lista.
  function _mlAgendaLabelRec(rec) {
    var r = String(rec || '').toLowerCase();
    if (r === 'diario') return 'Todo dia';
    if (r === 'unico') return 'Uma vez';
    var mapa = { dom:'Dom', seg:'Seg', ter:'Ter', qua:'Qua', qui:'Qui', sex:'Sex', sab:'S\u00e1b' };
    return r.split(',').map(function(d){ return mapa[d.trim()] || d; }).join(', ');
  }

  async function mlAgendaCarregar() {
    var lst = document.getElementById('ml-agenda-lista');
    if (!lst) return;
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaStoryAgendaListar', token:_lojaToken }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      var json = await resp.json();
      if (json.status !== 'ok') { lst.innerHTML = ''; return; }
      var ags = json.data.agendamentos || [];
      var limite = json.data.limite || 5;
      _mlAgendaCache = ags;
      if (!ags.length) {
        lst.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:4px 2px;">Nenhuma postagem autom\u00e1tica ainda.</div>';
      } else {
        lst.innerHTML = ags.map(function(g){
          var ehVideo = String(g.midiaTipo||'foto') === 'video';
          var thumb = g.imagemUrl
            ? (ehVideo
                ? '<div style="width:40px;height:40px;border-radius:8px;background:#000;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="ti ti-player-play" style="color:#fff;font-size:15px;"></i></div>'
                : '<img src="' + escAttr(g.imagemUrl) + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;" />')
            : '<div style="width:40px;height:40px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem;">' + escHTML(g.emoji||'\ud83c\udfaf') + '</div>';
          var txt = g.texto ? escHTML(g.texto) : '<span style="opacity:.5;">(sem texto)</span>';
          var meta = escHTML(g.horaPost || '--:--') + ' \u00b7 ' + escHTML(_mlAgendaLabelRec(g.recorrencia));
          var pausado = g.ativo ? '' : ' pausado';
          var icone = g.ativo ? 'ti-player-pause' : 'ti-player-play';
          var titulo = g.ativo ? 'Pausar' : 'Ativar';
          return '<div class="ml-agenda-card' + pausado + '">' +
            thumb +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + txt + '</div>' +
              '<div style="font-size:9px;color:var(--muted);margin-top:2px;"><i class="ti ti-clock"></i> ' + meta + (g.ativo ? '' : ' \u00b7 PAUSADO') + '</div>' +
            '</div>' +
            '<button onclick="mlAgendaToggleAtivo(\'' + escAttr(g.id) + '\')" title="' + titulo + '" style="font-size:11px;color:var(--muted);background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:4px 7px;flex-shrink:0;"><i class="ti ' + icone + '"></i></button>' +
            '<button onclick="mlAgendaRemover(\'' + escAttr(g.id) + '\')" style="font-size:10px;color:var(--red);background:none;border:1px solid rgba(255,68,68,0.3);border-radius:6px;cursor:pointer;padding:4px 8px;flex-shrink:0;">Excluir</button>' +
          '</div>';
        }).join('');
      }
      var btnAbrir = document.getElementById('ml-agenda-abrir');
      if (btnAbrir) {
        if (ags.length >= limite) { btnAbrir.disabled = true; btnAbrir.style.opacity = '.5'; btnAbrir.title = 'Limite de ' + limite + ' agendamentos'; }
        else { btnAbrir.disabled = false; btnAbrir.style.opacity = ''; btnAbrir.title = ''; }
      }
    } catch(e) { lst.innerHTML = '<div style="font-size:11px;color:var(--red);">Erro ao carregar agendamentos.</div>'; }
  }
  window.mlAgendaCarregar = mlAgendaCarregar;

  async function mlAgendaSalvar() {
    var btn = document.getElementById('ml-agenda-btn');
    var texto = (document.getElementById('ml-agenda-texto')||{}).value;
    texto = (texto || '').trim();
    var hora = (document.getElementById('ml-agenda-hora')||{}).value || '';
    var recSel = (document.getElementById('ml-agenda-recorrencia')||{}).value || 'diario';
    var agId = (document.getElementById('ml-agenda-id')||{}).value || '';

    if (!hora) { mlToast('Escolha um hor\u00e1rio.', 'erro'); return; }
    var recorrencia = recSel;
    if (recSel === 'dias') {
      if (!_agendaDiasSel.length) { mlToast('Escolha pelo menos um dia da semana.', 'erro'); return; }
      recorrencia = _agendaDiasSel.join(',');
    }

    if (btn) { btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true; }
    try {
      var inp = document.getElementById('ml-agenda-img-input');
      var statusEl = document.getElementById('ml-agenda-img-status');
      var imagemUrl = _agendaImagemUrl;
      var midiaTipo = _agendaMidiaTipo;
      if (inp && inp.files[0]) {
        var f = inp.files[0];
        var ehVid = /^video\//.test(f.type) || _agendaMidiaTipo === 'video';
        var dst = statusEl || { textContent:'', style:{} };
        var url = ehVid ? await uploadVideoAnuncio(f, dst) : await uploadImagem(f, dst);
        if (!url) { if (btn){ btn.innerHTML='<i class="fa fa-clock"></i> Salvar agendamento'; btn.disabled=false; } return; }
        imagemUrl = url; midiaTipo = ehVid ? 'video' : 'foto';
      }
      if (!texto && !imagemUrl) {
        mlToast('Escreva um texto ou escolha uma foto/v\u00eddeo.', 'erro');
        if (btn){ btn.innerHTML='<i class="fa fa-clock"></i> Salvar agendamento'; btn.disabled=false; } return;
      }
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:'lojaStoryAgendaSalvar', token:_lojaToken, id: agId,
        emoji:_agendaEmojiSelecionado, texto:texto,
        imagemUrl: imagemUrl || '', midiaTipo: imagemUrl ? midiaTipo : 'foto',
        horaPost: hora, recorrencia: recorrencia,
      }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(15000) });
      var json = await resp.json();
      if (json.status === 'ok') {
        mlToast('Agendamento salvo! Vai postar sozinho \u00e0s ' + hora + '.', 'ok');
        mlAgendaCancelar();
        await mlAgendaCarregar();
      } else { throw new Error(json.msg || 'Erro'); }
    } catch(e) { mlToast('Erro ao salvar: ' + e.message, 'erro'); }
    finally { if (btn){ btn.innerHTML='<i class="fa fa-clock"></i> Salvar agendamento'; btn.disabled=false; } }
  }
  window.mlAgendaSalvar = mlAgendaSalvar;

  async function mlAgendaToggleAtivo(id) {
    if (!id) return;
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaStoryAgendaToggle', token:_lojaToken, id:id }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      var json = await resp.json();
      if (json.status === 'ok') { mlToast(json.msg || 'Atualizado.', 'ok'); await mlAgendaCarregar(); }
      else { mlToast('Erro: ' + (json.msg||''), 'erro'); }
    } catch(e) { mlToast('Erro ao atualizar.', 'erro'); }
  }
  window.mlAgendaToggleAtivo = mlAgendaToggleAtivo;

  async function mlAgendaRemover(id) {
    if (!id) return;
    if (!confirm('Excluir esta postagem autom\u00e1tica?')) return;
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaStoryAgendaRemover', token:_lojaToken, id:id }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      var json = await resp.json();
      if (json.status === 'ok') { mlToast('Agendamento removido.', 'ok'); await mlAgendaCarregar(); }
      else { mlToast('Erro ao remover: ' + (json.msg||''), 'erro'); }
    } catch(e) { mlToast('Erro ao remover.', 'erro'); }
  }
  window.mlAgendaRemover = mlAgendaRemover;

  async function mlStoryRemover(id) {
    if (!id) return;
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaStoryRemover', token:_lojaToken, id:id }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      var json = await resp.json();
      if (json.status === 'ok') { mlToast('Anúncio removido.', 'ok'); await mlStoriesCarregar(); }
      else { mlToast('Erro ao remover: ' + (json.msg||''), 'erro'); }
    } catch(e) { mlToast('Erro ao remover.', 'erro'); }
  }
  window.mlStoryRemover = mlStoryRemover;

  async function mlRemoverAnuncio() {
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaRemoverAnuncio', token:_lojaToken }));
      const respRm = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(20000) });
      const jsonRm = await respRm.json();
      if (jsonRm.msg === 'UNAUTHORIZED') { lojaLogout(true); return; }
      if (jsonRm.status !== 'ok') throw new Error(jsonRm.msg || 'Falha ao remover');
      document.getElementById('ml-anuncio-ativo').style.display = 'none';
      document.getElementById('ml-anuncio-timer').textContent = '';
      if (typeof _mlPararTimerAnuncio === 'function') _mlPararTimerAnuncio(); // Item 17
      localStorage.removeItem('angatuba_anuncio');
      // Limpa imagem e texto
      _anuncioImagemUrl = '';
      mlAnuncioRemoverImagem();
      const textarea = document.getElementById('ml-anuncio-texto');
      if (textarea) { textarea.value = ''; }
      document.getElementById('ml-anuncio-chars').textContent = '0/80';
      // Mostra o formulário de novo
      const formEl = document.getElementById('ml-anuncio-form');
      if (formEl) formEl.style.display = '';
    } catch(e) {
      console.warn('[Anuncio] Erro ao remover:', e.message);
      mlToast('Não foi possível remover o anúncio agora. Ele continua no ar — tente de novo.', 'erro');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     CARDÁPIO — PAINEL DO DONO
  ══════════════════════════════════════════════════════════════ */
  let _cardapioItens  = [];
  const PLUS_LIMITE_ITENS = 40; // fonte única do limite de itens do plano PLUS (espelho do GAS)
  let _cardapioBusca = '';           // termo de busca atual (em memória)
  let _cardapioGruposFechados = {};  // { categoria: true } = colapsado
  let _cardapioPlano  = 'GRATIS';
  let _cardapioLojaWpp = null;
  let _cardapioLojaInfo = null;
  let _cardapioUploadEmAndamento = false; // Fix #22: bloqueia salvar durante upload de foto
  let _mlGrupos = [];            // grupos de opcoes da loja (PRO). [{id,nome,tipo,min,max,precoModo,ativo,opcoes:[...]}]
  let _mlGrupoEditId = null;     // grupo aberto no editor de opcoes, ou null
  // ID da opcao em edicao. null = form de opcao esta no modo 'criar nova'.
  // Declarado aqui (junto do estado irmao) porque mlGrupoAbrirOpcoes e
  // mlOpcoesFechar referenciam esta variavel antes deste ponto no arquivo.
  let _mlOpcaoEditId = null;

  async function mlCardapioCarregar(plano) {
    _cardapioPlano = plano;
    _cardapioBusca = '';
    const buscaInput = document.getElementById('ml-cardapio-busca');
    if (buscaInput) buscaInput.value = '';
    const isPro  = plano === 'PRO';
    const isPlus = plano === 'PLUS';

    const section = document.getElementById('ml-cardapio-section');
    if (!section) return;
    section.style.display = (isPro || isPlus) ? '' : 'none';
    // Grupos de opcoes: PRO-only. Aparece logo abaixo do cardapio.
    const gruposSection = document.getElementById('ml-grupos-section');
    if (gruposSection) gruposSection.style.display = isPro ? '' : 'none';
    // Acordeão de infos: loja paga (com cardápio no topo) começa fechada;
    // loja Grátis (sem cardápio) começa aberta — senão a aba abriria vazia.
    if (typeof window.mlToggleInfoSection === 'function') {
      window.mlToggleInfoSection(!(isPro || isPlus));
    }
    if (!isPro && !isPlus) return;

    // Badge do plano
    const badge = document.getElementById('ml-cardapio-badge');
    if (badge) {
      if (isPro) {
        badge.textContent = 'PRO';
        badge.style.background = 'linear-gradient(135deg, var(--plano-pro-1), var(--plano-pro-2))';
      } else {
        badge.textContent = 'PLUS · até ' + PLUS_LIMITE_ITENS + ' itens';
        badge.style.background = 'linear-gradient(135deg, var(--plano-plus-1), var(--plano-plus-2))';
        badge.style.color = '#fff';
      }
    }

    // Plus não tem foto, categoria nem destaque (recursos só do PRO)
    document.getElementById('ml-cardapio-foto-wrap').style.display = isPro ? '' : 'none';
    document.getElementById('ml-cardapio-cat-wrap').style.display  = isPro ? '' : 'none';
    // Fix #1: gate do checkbox de destaque na UI (gate real é server-side)
    const _destWrap = document.getElementById('ml-cardapio-destaque-wrap');
    if (_destWrap) _destWrap.style.display = isPro ? 'flex' : 'none';

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaCardapioListar', token:_lojaToken }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        _cardapioItens = json.data.itens || [];
        mlCardapioRenderLista();
      }
    } catch(e) { console.warn('[Cardapio] Erro ao carregar:', e.message); }
    // Grupos de opcoes sao PRO-only; carrega em paralelo (nao bloqueia o cardapio).
    if (isPro) { mlGruposCarregar(); }
    // A1: re-renderiza o checklist agora que a contagem real de itens chegou.
    if (typeof mlChecklistRender === 'function') mlChecklistRender();
  }

  /* ═══════════════════════════════════════════════════════════
     GRUPOS DE OPCOES — painel do lojista (PRO)
  ═══════════════════════════════════════════════════════════ */
  async function mlGruposCarregar() {
    try {
      const json = await apiPost('lojaOpcoesListar', { token: _lojaToken }, { timeout: 12000, ignoreUnauthorized: true });
      if (json.status === 'ok') {
        _mlGrupos = json.data.grupos || [];
        mlGruposRenderLista();
      }
    } catch(e) { console.warn('[Grupos] Erro ao carregar:', e.message); }
  }

  function mlGruposRenderLista() {
    const lista = document.getElementById('ml-grupos-lista');
    if (!lista) return;
    if (!_mlGrupos.length) {
      lista.innerHTML = `<div style="text-align:center;padding:18px 12px;color:var(--muted);font-size:11px;line-height:1.5;">
        Nenhum grupo ainda. Crie grupos como <strong>Tamanho</strong>, <strong>Acréscimos</strong> ou <strong>Borda</strong><br>e depois vincule aos itens do cardápio.
      </div>`;
      return;
    }
    lista.innerHTML = _mlGrupos.map(g => {
      const tipoTxt = g.tipo === 'UNICA' ? 'Escolha única' : 'Múltipla';
      const modoTxt = g.precoModo === 'ABSOLUTO' ? 'preço final' : g.precoModo === 'POR_ITEM' ? 'preço por item' : 'acréscimo';
      const nOps = (g.opcoes || []).length;
      return `<div class="ml-grupo-card">
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-h);font-size:12px;font-weight:800;">${escHTML(g.nome)}</div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-top:2px;">${tipoTxt} · ${modoTxt} · ${nOps} ${nOps!==1?'opções':'opção'}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="mlGrupoAbrirAplicar('${g.id}')" style="padding:6px 10px;border-radius:7px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981;font-size:10px;font-weight:700;cursor:pointer;"><i class="fa fa-layer-group"></i> Aplicar</button>
          <button onclick="mlGrupoAbrirOpcoes('${g.id}')" style="padding:6px 10px;border-radius:7px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.25);color:#7c3aed;font-size:10px;font-weight:700;cursor:pointer;"><i class="fa fa-list"></i> Opções</button>
          <button onclick="mlGrupoAbrirForm('${g.id}')" style="padding:6px 10px;border-radius:7px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:700;cursor:pointer;"><i class="fa fa-pencil"></i></button>
          <button onclick="mlGrupoRemover('${g.id}','${escJsArg(g.nome)}')" style="padding:6px 10px;border-radius:7px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);color:var(--red);font-size:10px;font-weight:700;cursor:pointer;"><i class="fa fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  window.mlGrupoAbrirForm = function(editId) {
    const form = document.getElementById('ml-grupo-form');
    if (!form) return;
    form.style.display = '';
    document.getElementById('ml-grupo-form-msg').textContent = '';
    const g = editId ? _mlGrupos.find(x => x.id === editId) : null;
    document.getElementById('ml-grupo-form-title').textContent = g ? 'Editar grupo' : 'Novo grupo';
    document.getElementById('ml-grupo-edit-id').value = editId || '';
    document.getElementById('ml-grupo-nome').value = g ? g.nome : '';
    document.getElementById('ml-grupo-tipo').value = g ? g.tipo : 'MULTIPLA';
    document.getElementById('ml-grupo-modo').value = g ? g.precoModo : 'DELTA';
    document.getElementById('ml-grupo-min').value = g ? g.min : 0;
    document.getElementById('ml-grupo-max').value = g ? g.max : 0;
    mlGrupoSyncTipo();
    form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  window.mlGrupoFecharForm = function() {
    document.getElementById('ml-grupo-form').style.display = 'none';
  };

  // Ajusta os campos min/max conforme o tipo: UNICA esconde max (sempre 1) e
  // troca min por um checkbox 'obrigatorio'. Mantem a UI simples pro lojista.
  // Mostra/esconde o aviso do modo POR_ITEM no form do grupo.
  window.mlGrupoSyncModo = function() {
    const modo = document.getElementById('ml-grupo-modo').value;
    const aviso = document.getElementById('ml-grupo-modo-aviso');
    if (!aviso) return;
    if (modo === 'POR_ITEM') {
      aviso.style.display = '';
      aviso.innerHTML = '\uD83D\uDCA1 As op\u00e7\u00f5es aqui s\u00e3o s\u00f3 os <strong>nomes</strong> dos tamanhos. '
                      + 'O <strong>pre\u00e7o de cada tamanho</strong> voc\u00ea define em cada item do card\u00e1pio.';
    } else {
      aviso.style.display = 'none';
    }
  };

  window.mlGrupoSyncTipo = function() {
    const tipo = document.getElementById('ml-grupo-tipo').value;
    const maxWrap = document.getElementById('ml-grupo-max-wrap');
    const minLabel = document.getElementById('ml-grupo-min-label');
    const hint = document.getElementById('ml-grupo-tipo-hint');
    if (tipo === 'UNICA') {
      if (maxWrap) maxWrap.style.display = 'none';
      if (minLabel) minLabel.textContent = 'Obrigatório escolher? (0 = opcional, 1 = sim)';
      if (hint) hint.textContent = 'Ex.: Tamanho (Broto/Grande) ou Borda (nenhuma/catupiry).';
    } else {
      if (maxWrap) maxWrap.style.display = '';
      if (minLabel) minLabel.textContent = 'Mínimo de escolhas (0 = livre)';
      if (hint) hint.textContent = 'Ex.: Acréscimos (bacon, cheddar...). Máx 0 = sem limite.';
    }
  };

  window.mlGrupoSalvar = async function() {
    const nome = document.getElementById('ml-grupo-nome').value.trim();
    const msg  = document.getElementById('ml-grupo-form-msg');
    if (!nome) { msg.textContent = '❌ Informe o nome do grupo.'; msg.style.color = 'var(--red)'; return; }
    const tipo = document.getElementById('ml-grupo-tipo').value;
    const modo = document.getElementById('ml-grupo-modo').value;
    let min = parseInt(document.getElementById('ml-grupo-min').value, 10) || 0;
    let max = parseInt(document.getElementById('ml-grupo-max').value, 10) || 0;
    const btn = document.getElementById('ml-grupo-salvar-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...'; }
    try {
      const json = await apiPost('lojaGrupoSalvar', {
        token: _lojaToken,
        id: document.getElementById('ml-grupo-edit-id').value,
        nome, tipo, precoModo: modo, min, max,
      }, { timeout: 15000, ignoreUnauthorized: true });
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro');
      mlGrupoFecharForm();
      await mlGruposCarregar();
      mlToast('Grupo salvo!', 'ok');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      msg.textContent = '❌ ' + e.message; msg.style.color = 'var(--red)';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-check"></i> Salvar grupo'; }
    }
  };

  window.mlGrupoRemover = async function(id, nome) {
    const ok = await mlConfirmar('Remover grupo?', `“${nome}” e suas opções serão removidos, e desvinculados de todos os itens.`, { okLabel: 'Remover', owlSrc: '/webp/owl-sign.webp' });
    if (!ok) return;
    try {
      const json = await apiPost('lojaGrupoRemover', { token: _lojaToken, id }, { timeout: 15000, ignoreUnauthorized: true });
      if (json.status !== 'ok') { mlToast('Erro: ' + (json.msg || 'tente de novo.'), 'erro'); return; }
      if (_mlGrupoEditId === id) { _mlGrupoEditId = null; const ed = document.getElementById('ml-opcoes-editor'); if (ed) ed.style.display = 'none'; }
      if (_mlAplicarGrupoId === id) { mlAplicarFechar(); }
      await mlGruposCarregar();
      await mlCardapioCarregar(_cardapioPlano); // vinculos podem ter mudado
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      mlToast('Erro: ' + e.message, 'erro');
    }
  };

  // ── Editor de opcoes de um grupo ──
  window.mlGrupoAbrirOpcoes = function(grupoId) {
    _mlGrupoEditId = grupoId;
    const g = _mlGrupos.find(x => x.id === grupoId);
    const ed = document.getElementById('ml-opcoes-editor');
    if (!g || !ed) return;
    document.getElementById('ml-opcoes-grupo-nome').textContent = g.nome;
    ed.style.display = '';
    // Abrir outro grupo cancela qualquer edicao pendente: o id em _mlOpcaoEditId
    // pertence ao grupo anterior e salvaria no lugar errado.
    _mlOpcaoEditId = null;
    mlOpcoesRenderLista();
    // limpa o form de nova opcao
    const nome = document.getElementById('ml-opcao-nome'); if (nome) nome.value = '';
    const preco = document.getElementById('ml-opcao-preco'); if (preco) preco.value = '';
    const qmax = document.getElementById('ml-opcao-qtdmax'); if (qmax) qmax.value = '';
    _mlOpcaoSyncBotoes();
    ed.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  /* ─── Aplicar grupo em massa (por categoria) ─────────────────
     Resolve o caso real: cardapio ja montado com dezenas de itens.
     Em vez de abrir item por item, o lojista escolhe as categorias.
     O vinculo continua morando no item (coluna K) — isto e so um
     atalho de preenchimento, entao da pra ajustar item a item depois. */
  let _mlAplicarGrupoId = null;

  window.mlGrupoAbrirAplicar = function(grupoId) {
    _mlAplicarGrupoId = grupoId;
    const g = _mlGrupos.find(x => x.id === grupoId);
    const painel = document.getElementById('ml-aplicar-painel');
    if (!g || !painel) return;
    const nomeEl = document.getElementById('ml-aplicar-grupo-nome');
    if (nomeEl) nomeEl.textContent = g.nome;
    painel.style.display = '';
    mlAplicarRenderCategorias();
    painel.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  window.mlAplicarFechar = function() {
    _mlAplicarGrupoId = null;
    const p = document.getElementById('ml-aplicar-painel');
    if (p) p.style.display = 'none';
  };

  // Monta a lista de categorias com contagem total e quantos ja tem o grupo.
  function mlAplicarRenderCategorias() {
    const lista = document.getElementById('ml-aplicar-cats');
    const gid = _mlAplicarGrupoId;
    if (!lista || !gid) return;

    const ativos = _cardapioItens.filter(i => i.ativo !== 'NAO');
    if (!ativos.length) {
      lista.innerHTML = '<div style="font-size:11px;color:var(--muted);text-align:center;padding:10px;">Nenhum item no cardápio ainda.</div>';
      return;
    }

    // Agrupa por categoria preservando ordem de aparicao (igual a lista principal).
    const porCat = {}; const ordem = [];
    ativos.forEach(item => {
      const cat = (item.categoria || '').trim() || 'Sem categoria';
      if (!porCat[cat]) { porCat[cat] = []; ordem.push(cat); }
      porCat[cat].push(item);
    });

    lista.innerHTML = ordem.map(cat => {
      const itens = porCat[cat];
      // Quantos itens desta categoria ja tem o grupo vinculado.
      const jaTem = itens.filter(it => Array.isArray(it.grupos) && it.grupos.some(gg => gg.id === gid)).length;
      const total = itens.length;
      const todos = jaTem === total;
      const status = jaTem === 0 ? ''
        : (todos ? '<span style="color:#10b981;font-weight:700;">todos já têm</span>'
                 : `<span style="color:#f59e0b;font-weight:700;">${jaTem} de ${total} já têm</span>`);
      return `<label class="ml-aplicar-cat">
        <input type="checkbox" value="${escAttr(cat)}" data-total="${total}" onchange="this.closest('.ml-aplicar-cat').classList.toggle('on', this.checked);mlAplicarAtualizarResumo()">
        <span style="flex:1;min-width:0;">
          <span style="font-family:var(--font-h);font-size:12px;font-weight:800;display:block;">${escHTML(cat)}</span>
          <span style="font-size:9px;color:var(--muted);">${total} ${total!==1?'itens':'item'} ${status ? '· ' + status : ''}</span>
        </span>
      </label>`;
    }).join('');
    mlAplicarAtualizarResumo();
  }

  // Atualiza o contador do botao conforme as categorias marcadas.
  window.mlAplicarAtualizarResumo = function() {
    const lista = document.getElementById('ml-aplicar-cats');
    const btn   = document.getElementById('ml-aplicar-btn');
    const btnR  = document.getElementById('ml-aplicar-btn-remover');
    if (!lista || !btn) return;
    const marcadas = Array.from(lista.querySelectorAll('input[type=checkbox]:checked'));
    const totalItens = marcadas.reduce((s, c) => s + (parseInt(c.dataset.total, 10) || 0), 0);
    btn.disabled = marcadas.length === 0;
    if (btnR) btnR.disabled = marcadas.length === 0;
    btn.innerHTML = marcadas.length
      ? `<i class="fa fa-check"></i> Aplicar a ${totalItens} ${totalItens!==1?'itens':'item'}`
      : '<i class="fa fa-check"></i> Selecione as categorias';
  };

  // Envia a aplicacao (ou remocao) em lote.
  async function _mlAplicarExecutar(modo) {
    const gid = _mlAplicarGrupoId;
    const lista = document.getElementById('ml-aplicar-cats');
    const msg = document.getElementById('ml-aplicar-msg');
    if (!gid || !lista) return;
    const marcadas = Array.from(lista.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
    if (!marcadas.length) return;

    const g = _mlGrupos.find(x => x.id === gid);
    const nomeGrupo = g ? g.nome : 'grupo';
    if (modo === 'REMOVER') {
      const ok = await mlConfirmar('Remover dos itens?', `“${nomeGrupo}” será desvinculado dos itens dessas categorias.`, { okLabel: 'Remover', owlSrc: '/webp/owl-sign.webp' });
      if (!ok) return;
    }

    const btn  = document.getElementById('ml-aplicar-btn');
    const btnR = document.getElementById('ml-aplicar-btn-remover');
    if (btn)  btn.disabled = true;
    if (btnR) btnR.disabled = true;
    if (msg) { msg.textContent = '⏳ Aplicando...'; msg.style.color = 'var(--muted)'; }

    try {
      // Separador |~| porque nome de categoria pode conter virgula.
      const json = await apiPost('lojaGrupoAplicarEmMassa', {
        token: _lojaToken,
        grupoId: gid,
        categorias: marcadas.join('|~|'),
        modo: modo,
      }, { timeout: 30000, ignoreUnauthorized: true });
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro');
      const n = (json.data && json.data.afetados) || 0;
      if (msg) {
        msg.textContent = n > 0
          ? `✅ ${n} ${n!==1?'itens atualizados':'item atualizado'}!`
          : 'ℹ️ Nada mudou (os itens já estavam assim).';
        msg.style.color = n > 0 ? 'var(--green)' : 'var(--muted)';
      }
      // Recarrega o cardapio para refletir os novos vinculos nos contadores.
      await mlCardapioCarregar(_cardapioPlano);
      mlAplicarRenderCategorias();
      setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      if (msg) { msg.textContent = '❌ ' + e.message; msg.style.color = 'var(--red)'; }
    } finally {
      mlAplicarAtualizarResumo();
    }
  }

  window.mlAplicarConfirmar = function() { _mlAplicarExecutar('ADICIONAR'); };
  window.mlAplicarRemover   = function() { _mlAplicarExecutar('REMOVER'); };
  window.mlOpcoesFechar = function() {
    // Fechar o painel tambem encerra a edicao em andamento.
    _mlOpcaoEditId = null;
    _mlOpcaoSyncBotoes();
    _mlGrupoEditId = null;
    const ed = document.getElementById('ml-opcoes-editor');
    if (ed) ed.style.display = 'none';
  };

  function mlOpcoesRenderLista() {
    const g = _mlGrupos.find(x => x.id === _mlGrupoEditId);
    const lista = document.getElementById('ml-opcoes-lista');
    if (!g || !lista) return;
    const modoAbs = g.precoModo === 'ABSOLUTO';
    const modoPorItem = g.precoModo === 'POR_ITEM';
    const label = document.getElementById('ml-opcao-preco-label');
    if (label) {
      label.textContent = modoPorItem ? 'Preço padrão (opcional)'
                        : modoAbs      ? 'Preço final (R$)'
                                       : 'Acréscimo (R$, 0 = grátis)';
    }
    // No modo POR_ITEM o preco de verdade vem do item; explica isso na lista.
    const dicaEl = document.getElementById('ml-opcoes-dica');
    if (dicaEl) {
      dicaEl.style.display = modoPorItem ? '' : 'none';
      dicaEl.textContent = 'Cada item do cardápio define o preço destes tamanhos. '
                         + 'Edite um item para preencher.';
    }
    // Repetir a mesma opcao so faz sentido em MULTIPLA + DELTA: em UNICA a
    // escolha e exclusiva e em ABSOLUTO o preco substitui a base do item.
    const podeRepetir = !modoAbs && g.tipo !== 'UNICA';
    const qtdWrap = document.getElementById('ml-opcao-qtdmax-wrap');
    if (qtdWrap) qtdWrap.style.display = podeRepetir ? '' : 'none';
    if (!podeRepetir) { const qi = document.getElementById('ml-opcao-qtdmax'); if (qi) qi.value = ''; }
    if (!g.opcoes.length) {
      lista.innerHTML = `<div style="text-align:center;padding:12px;color:var(--muted);font-size:11px;">Nenhuma opção. Adicione abaixo.</div>`;
      return;
    }
    lista.innerHTML = g.opcoes.map(op => {
      const p = parseFloat(op.preco) || 0;
      const precoTxt = modoPorItem ? 'definido no item'
                     : modoAbs      ? 'R$ ' + p.toFixed(2).replace('.',',')
                     : (p > 0 ? '+ R$ ' + p.toFixed(2).replace('.',',') : 'grátis');
      // Badge so aparece quando a opcao realmente repete (qtdMax > 1).
      const qMax = parseInt(op.qtdMax, 10) || 0;
      const qBadge = (podeRepetir && qMax > 1)
        ? `<span style="font-size:9px;font-weight:800;color:#7c3aed;background:rgba(124,58,237,0.12);border-radius:5px;padding:2px 5px;margin-right:6px;">até ${qMax}x</span>`
        : '';
      // Linha em edicao ganha borda roxa, p/ o lojista saber o que o form edita.
      const emEdicao = (_mlOpcaoEditId === op.id);
      return `<div class="ml-opcao-row${emEdicao ? ' editando' : ''}">
        <span style="flex:1;font-size:12px;font-weight:600;">${escHTML(op.nome)}</span>
        ${qBadge}
        <span style="font-size:11px;color:var(--green);font-weight:700;margin-right:6px;">${precoTxt}</span>
        <button onclick="mlOpcaoEditar('${op.id}')" aria-label="Editar ${escAttr(op.nome)}" style="padding:4px 8px;border-radius:6px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;cursor:pointer;"><i class="fa fa-pencil"></i></button>
        <button onclick="mlOpcaoRemover('${op.id}','${escJsArg(op.nome)}')" style="padding:4px 8px;border-radius:6px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);color:var(--red);font-size:10px;cursor:pointer;"><i class="fa fa-trash"></i></button>
      </div>`;
    }).join('');
  }

  // Carrega uma opcao existente no form, que passa a operar em modo edicao.
  // Reusa o mesmo form da criacao — so muda o rotulo do botao e o estado.
  window.mlOpcaoEditar = function(opcaoId) {
    const g = _mlGrupos.find(x => x.id === _mlGrupoEditId); if (!g) return;
    const op = (g.opcoes || []).find(o => o.id === opcaoId); if (!op) return;
    _mlOpcaoEditId = opcaoId;
    const nomeEl  = document.getElementById('ml-opcao-nome');
    const precoEl = document.getElementById('ml-opcao-preco');
    const qtdEl   = document.getElementById('ml-opcao-qtdmax');
    if (nomeEl)  nomeEl.value  = op.nome || '';
    // Preco vem numerico do backend; exibe no formato brasileiro pra edicao.
    if (precoEl) precoEl.value = (parseFloat(op.preco) || 0).toFixed(2).replace('.', ',');
    if (qtdEl) {
      const q = parseInt(op.qtdMax, 10) || 0;
      qtdEl.value = q > 1 ? String(q) : '';
    }
    const msg = document.getElementById('ml-opcao-form-msg');
    if (msg) msg.textContent = '';
    mlOpcoesRenderLista();   // redesenha p/ marcar a linha em edicao
    _mlOpcaoSyncBotoes();
    setTimeout(() => nomeEl?.focus(), 60);
  };

  // Volta o form para o modo 'criar nova opcao'.
  window.mlOpcaoCancelarEdicao = function() {
    _mlOpcaoEditId = null;
    const nomeEl  = document.getElementById('ml-opcao-nome');
    const precoEl = document.getElementById('ml-opcao-preco');
    const qtdEl   = document.getElementById('ml-opcao-qtdmax');
    if (nomeEl)  nomeEl.value  = '';
    if (precoEl) precoEl.value = '';
    if (qtdEl)   qtdEl.value   = '';
    const msg = document.getElementById('ml-opcao-form-msg');
    if (msg) msg.textContent = '';
    mlOpcoesRenderLista();
    _mlOpcaoSyncBotoes();
  };

  // Ajusta rotulo do botao principal e visibilidade do 'Cancelar' conforme
  // o modo (criar x editar). Chamado sempre que _mlOpcaoEditId muda.
  function _mlOpcaoSyncBotoes() {
    const btn = document.getElementById('ml-opcao-add-btn');
    const cancelar = document.getElementById('ml-opcao-cancelar-btn');
    const editando = !!_mlOpcaoEditId;
    if (btn) btn.innerHTML = editando
      ? '<i class="fa fa-check"></i> Salvar alteração'
      : '<i class="fa fa-plus"></i> Adicionar';
    if (cancelar) cancelar.style.display = editando ? '' : 'none';
  }

  window.mlOpcaoSalvar = async function() {
    const g = _mlGrupos.find(x => x.id === _mlGrupoEditId);
    if (!g) return;
    const nome = document.getElementById('ml-opcao-nome').value.trim();
    const precoRaw = document.getElementById('ml-opcao-preco').value;
    const msg = document.getElementById('ml-opcao-form-msg');
    if (!nome) { if (msg) { msg.textContent = '❌ Informe o nome.'; msg.style.color = 'var(--red)'; } return; }
    const preco = parseFloat(String(precoRaw).replace(/[^\d,.-]/g,'').replace(',','.'));
    if (isNaN(preco) || preco < 0) { if (msg) { msg.textContent = '❌ Preço inválido.'; msg.style.color = 'var(--red)'; } return; }
    // Repeticao: vazio/0/1 = opcao simples. Só vale em MULTIPLA + DELTA.
    const podeRepetir = g.precoModo !== 'ABSOLUTO' && g.tipo !== 'UNICA';
    let qtdMax = 0;
    if (podeRepetir) {
      const qRaw = String(document.getElementById('ml-opcao-qtdmax')?.value || '').trim();
      if (qRaw) {
        qtdMax = parseInt(qRaw, 10);
        if (isNaN(qtdMax) || qtdMax < 0 || qtdMax > 99) {
          if (msg) { msg.textContent = '❌ Repetição inválida (0 a 99).'; msg.style.color = 'var(--red)'; }
          return;
        }
      }
    }
    const btn = document.getElementById('ml-opcao-add-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>'; }
    // Em edicao envia o id (backend faz update) e PRESERVA a ordem atual —
    // recalcular como length+1 jogaria a opcao editada para o fim da lista.
    const editandoId = _mlOpcaoEditId;
    const opAtual = editandoId ? (g.opcoes || []).find(o => o.id === editandoId) : null;
    const ordemEnviar = editandoId
      ? (parseInt(opAtual && opAtual.ordem, 10) || 0)
      : ((g.opcoes || []).reduce((mx, o) => Math.max(mx, parseInt(o.ordem, 10) || 0), 0) + 1);
    try {
      const json = await apiPost('lojaOpcaoSalvar', {
        token: _lojaToken, grupoId: g.id, nome, preco, qtdMax,
        id: editandoId || '',
        ordem: ordemEnviar,
      }, { timeout: 15000, ignoreUnauthorized: true });
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro');
      document.getElementById('ml-opcao-nome').value = '';
      document.getElementById('ml-opcao-preco').value = '';
      const _qi = document.getElementById('ml-opcao-qtdmax'); if (_qi) _qi.value = '';
      // Sai do modo edicao ANTES de redesenhar, senao a linha continua marcada.
      _mlOpcaoEditId = null;
      if (msg) {
        msg.textContent = editandoId ? '✅ Opção atualizada.' : '';
        msg.style.color = 'var(--green)';
        if (editandoId) setTimeout(() => { if (msg) msg.textContent = ''; }, 2500);
      }
      await mlGruposCarregar();
      // reabre o editor no mesmo grupo (dados atualizados)
      mlOpcoesRenderLista();
      _mlOpcaoSyncBotoes();
      setTimeout(() => document.getElementById('ml-opcao-nome')?.focus(), 60);
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      if (msg) { msg.textContent = '❌ ' + e.message; msg.style.color = 'var(--red)'; }
    } finally {
      // _mlOpcaoSyncBotoes decide o rotulo: se o salvamento falhou continuamos
      // em edicao e o botao precisa voltar como 'Salvar alteração'.
      if (btn) btn.disabled = false;
      _mlOpcaoSyncBotoes();
    }
  };

  window.mlOpcaoRemover = async function(id, nome) {
    const ok = await mlConfirmar('Remover opção?', `“${nome}” será removida do grupo.`, { okLabel: 'Remover', owlSrc: '/webp/owl-sign.webp' });
    if (!ok) return;
    try {
      const json = await apiPost('lojaOpcaoRemover', { token: _lojaToken, id }, { timeout: 15000, ignoreUnauthorized: true });
      if (json.status !== 'ok') { mlToast('Erro: ' + (json.msg || 'tente de novo.'), 'erro'); return; }
      // Se a opcao removida era a que estava no form, sai do modo edicao —
      // senao 'Salvar alteração' apontaria para um id que nao existe mais.
      if (_mlOpcaoEditId === id) {
        _mlOpcaoEditId = null;
        const _n = document.getElementById('ml-opcao-nome');   if (_n) _n.value = '';
        const _p = document.getElementById('ml-opcao-preco');  if (_p) _p.value = '';
        const _q = document.getElementById('ml-opcao-qtdmax'); if (_q) _q.value = '';
      }
      await mlGruposCarregar();
      mlOpcoesRenderLista();
      _mlOpcaoSyncBotoes();
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      mlToast('Erro: ' + e.message, 'erro');
    }
  };

  // ── Vinculo item -> grupos (checkboxes no form do item) ──
  // Renderiza a lista de grupos disponiveis com o estado atual do item.
  function mlRenderVinculoGrupos(item) {
    const wrap = document.getElementById('ml-cardapio-grupos-wrap');
    const lista = document.getElementById('ml-cardapio-grupos-lista');
    if (!wrap || !lista) return;
    // So faz sentido no PRO e se ha grupos criados.
    if (_cardapioPlano !== 'PRO' || !_mlGrupos.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    const vinculados = (item && Array.isArray(item.grupos)) ? item.grupos.map(g => g.id) : [];
    lista.innerHTML = _mlGrupos.map(g => {
      const on = vinculados.indexOf(g.id) >= 0;
      return `<label class="ml-vinculo-chip${on?' on':''}">
        <input type="checkbox" value="${g.id}" ${on?'checked':''} style="display:none;" onchange="this.parentNode.classList.toggle('on', this.checked);mlSyncPrecosPorItem()">
        <i class="fa fa-${on?'check-':''}circle"></i> ${escHTML(g.nome)}
      </label>`;
    }).join('');
  }

  // Chamada pelo onchange dos chips: re-renderiza os campos de preco
  // preservando o que ja foi digitado (para nao perder valores ao marcar
  // outro grupo antes de salvar).
  window.mlSyncPrecosPorItem = function() {
    const atuais = mlLerPrecosPorItem();
    const editId = document.getElementById('ml-cardapio-edit-id').value;
    const itemSalvo = editId ? _cardapioItens.find(i => i.id === editId) : null;
    // Mescla: o que esta na tela vence o que estava salvo.
    const merged = Object.assign({}, (itemSalvo && itemSalvo.precosOpcao) || {}, atuais);
    mlRenderPrecosPorItem({ precosOpcao: merged });
  };

  // Campos de preco por tamanho (grupos POR_ITEM vinculados ao item).
  // Aparecem no form do item logo abaixo dos chips de vinculo.
  function mlRenderPrecosPorItem(item) {
    const wrap  = document.getElementById('ml-cardapio-precos-wrap');
    const lista = document.getElementById('ml-cardapio-precos-lista');
    if (!wrap || !lista) return;

    // Quais grupos POR_ITEM estao vinculados a este item? Usa os chips
    // marcados (estado atual da tela), nao o item salvo — assim o lojista
    // marca 'Tamanho' e os campos aparecem na hora.
    const vinculados = mlLerVinculoGrupos();
    const gruposPI = _mlGrupos.filter(g => g.precoModo === 'POR_ITEM' && vinculados.indexOf(g.id) >= 0);
    if (!gruposPI.length) { wrap.style.display = 'none'; lista.innerHTML = ''; return; }

    const precos = (item && item.precosOpcao) || {};
    wrap.style.display = '';
    lista.innerHTML = gruposPI.map(g => {
      const campos = (g.opcoes || []).map(op => {
        const v = (precos[op.id] != null) ? precos[op.id] : '';
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="flex:1;font-size:12px;font-weight:600;color:var(--text);">${escHTML(op.nome)}</span>
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:11px;color:var(--muted);">R$</span>
              <input type="text" inputmode="decimal" class="ml-preco-opcao"
                data-opcao-id="${escAttr(op.id)}" value="${escAttr(String(v).replace('.',','))}"
                placeholder="0,00"
                style="width:82px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:7px;font-size:13px;color:var(--text);text-align:right;">
            </div>
          </div>`;
      }).join('');
      return `<div style="margin-bottom:8px;">
          <div style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:5px;">${escHTML(g.nome)}</div>
          ${campos}
        </div>`;
    }).join('');
  }

  // Le os campos de preco por tamanho. Vazio = nao definido (cai no base).
  function mlLerPrecosPorItem() {
    const lista = document.getElementById('ml-cardapio-precos-lista');
    if (!lista) return {};
    const out = {};
    lista.querySelectorAll('.ml-preco-opcao').forEach(inp => {
      const id = inp.dataset.opcaoId;
      const raw = String(inp.value || '').trim();
      if (!id || !raw) return;
      const v = parseFloat(raw.replace(/[^\d,.-]/g,'').replace(',','.'));
      if (!isNaN(v) && v >= 0) out[id] = v;
    });
    return out;
  }

  // Le os checkboxes marcados no form do item.
  function mlLerVinculoGrupos() {
    const lista = document.getElementById('ml-cardapio-grupos-lista');
    if (!lista) return [];
    return Array.from(lista.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
  }

  function mlCardapioRenderLista() {
    const lista  = document.getElementById('ml-cardapio-lista');
    const limite = document.getElementById('ml-cardapio-limite');
    if (!lista) return;

    const isPro   = _cardapioPlano === 'PRO';
    const ativos  = _cardapioItens.filter(i => i.ativo !== 'NAO');

    if (limite) {
      // Fix #7: restaura cor padrão (mlCardapioAbrirForm pinta de vermelho ao bloquear)
      limite.style.color = 'var(--muted)';
      const restam = PLUS_LIMITE_ITENS - ativos.length;
      if (isPro) {
        limite.textContent = `${ativos.length} ${ativos.length !== 1 ? 'itens' : 'item'} no cardápio`;
        limite.style.color = 'var(--muted)';
      } else if (restam < 0) {
        // Acima do limite: avisa que itens extras ficam ocultos no app
        limite.textContent = `${ativos.length}/${PLUS_LIMITE_ITENS} itens · ${Math.abs(restam)} oculto${Math.abs(restam)!==1?'s':''} no app (faça upgrade para PRO)`;
        limite.style.color = 'var(--orange, #f59e0b)';
      } else {
        limite.textContent = `${ativos.length}/${PLUS_LIMITE_ITENS} itens · ${restam} restante${restam!==1?'s':''}`;
        limite.style.color = 'var(--muted)';
      }
    }

    // Mostra busca apenas para PRO com itens suficientes para justificar
    const buscaWrap = document.getElementById('ml-cardapio-busca-wrap');
    if (buscaWrap) buscaWrap.style.display = (isPro && ativos.length >= 6) ? '' : 'none';

    if (ativos.length === 0) {
      // A1: empty state com copy de negócio — reforça o benefício (pedido pelo
      // WhatsApp) e já abre o form do 1º item, sem depender de achar o botão
      // "+ Adicionar" lá em cima.
      lista.innerHTML = `<div style="text-align:center;padding:24px 16px 20px;color:var(--muted);">
        <img src="/webp/owl-idea.webp" alt="" style="width:72px;height:72px;object-fit:contain;margin-bottom:8px;opacity:.9;" onerror="this.style.display='none'" />
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;">Nenhum item ainda</div>
        <div style="font-size:11px;line-height:1.5;margin-bottom:12px;">Adicione o primeiro produto com preço — o cliente<br>abre o cardápio e manda o pedido no WhatsApp.</div>
        <button type="button" onclick="mlCardapioAbrirForm()" style="padding:9px 16px;border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-family:var(--font-h);font-size:11px;font-weight:800;border:none;cursor:pointer;">
          <i class="fa fa-plus"></i> Adicionar primeiro item
        </button>
      </div>`;
      return;
    }

    // Aplica filtro de busca (em memória)
    const termo = (_cardapioBusca || '').trim().toLowerCase();
    const visiveis = termo
      ? ativos.filter(i => (i.nome||'').toLowerCase().includes(termo) || (i.categoria||'').toLowerCase().includes(termo))
      : ativos;

    if (visiveis.length === 0) {
      lista.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px;">
        Nenhum item encontrado para "<strong>${escHTML(termo)}</strong>".
      </div>`;
      return;
    }

    // PRO + sem busca ativa + tem categorias → agrupa em seções colapsáveis
    const usarGrupos = isPro && !termo && ativos.some(i => i.categoria);

    if (!usarGrupos) {
      lista.innerHTML = visiveis.map(mlCardapioItemHTML).join('');
      return;
    }

    // Agrupa por categoria. A ordem espelha exatamente a do cardápio público:
    // catOrdem primeiro, ordem de aparição como desempate/legado.
    const grupos = {};
    const ordemDef = {};   // categoria -> menor catOrdem
    const apareceu = {};   // categoria -> índice de primeira aparição
    visiveis.forEach((item, i) => {
      const cat = (item.categoria || '').trim() || 'Sem categoria';
      if (!grupos[cat]) { grupos[cat] = []; apareceu[cat] = i; }
      grupos[cat].push(item);
      const o = parseInt(item.catOrdem, 10) || 0;
      if (o > 0 && (ordemDef[cat] === undefined || o < ordemDef[cat])) ordemDef[cat] = o;
    });
    const ordemCats = Object.keys(grupos).sort((a, b) => {
      const oa = ordemDef[a] || 0, ob = ordemDef[b] || 0;
      if (oa && ob) return oa - ob;
      if (oa) return -1;
      if (ob) return 1;
      return apareceu[a] - apareceu[b];
    });
    // Guarda a ordem corrente para as setas ↑/↓ saberem quem troca com quem.
    _cardapioOrdemAtual = ordemCats.slice();

    const totalCats = ordemCats.length;
    lista.innerHTML = ordemCats.map((cat, idx) => {
      const aberto = _cardapioGruposFechados[cat] === true; // padrão: fechado — lojista expande
      const itens = grupos[cat].map(mlCardapioItemHTML).join('');
      // Quantos itens do grupo ainda estão sem foto — alimenta o badge do botão
      const semFoto = grupos[cat].filter(i => !i.foto).length;
      return `
        <div class="ml-cardapio-grupo">
          <div class="ml-cardapio-grupo-row">
            <button type="button" class="ml-cardapio-grupo-head" onclick="mlCardapioToggleGrupo('${escJsArg(cat)}')">
              <span><i class="fa fa-chevron-${aberto ? 'down' : 'right'}" style="font-size:9px;margin-right:6px;opacity:.7;"></i>${escHTML(cat)}</span>
              <span class="ml-cardapio-grupo-count">${grupos[cat].length}</span>
            </button>
            <button type="button" class="ml-cardapio-grupo-foto"
              title="Aplicar uma foto a todos os itens de ${escAttr(cat)}"
              aria-label="Aplicar foto a todos os itens de ${escAttr(cat)}"
              onclick="mlCardapioFotoLoteAbrir('${escJsArg(cat)}')">
              <i class="fa fa-camera"></i>
              ${semFoto ? `<span class="ml-cardapio-grupo-foto-badge">${semFoto}</span>` : ''}
            </button>
          </div>
          <div class="ml-cardapio-grupo-acoes">
            <button type="button" class="ml-cat-acao" ${idx === 0 ? 'disabled' : ''}
              title="Mover para cima" aria-label="Mover ${escAttr(cat)} para cima"
              onclick="mlCategoriaMover('${escJsArg(cat)}',-1)">
              <i class="fa fa-arrow-up"></i>
            </button>
            <button type="button" class="ml-cat-acao" ${idx === totalCats - 1 ? 'disabled' : ''}
              title="Mover para baixo" aria-label="Mover ${escAttr(cat)} para baixo"
              onclick="mlCategoriaMover('${escJsArg(cat)}',1)">
              <i class="fa fa-arrow-down"></i>
            </button>
            <button type="button" class="ml-cat-acao ml-cat-acao-txt"
              title="Renomear categoria" aria-label="Renomear ${escAttr(cat)}"
              onclick="mlCategoriaRenomear('${escJsArg(cat)}')">
              <i class="fa fa-pencil"></i> Renomear
            </button>
          </div>
          <div class="ml-cardapio-grupo-body" style="display:${aberto ? 'flex' : 'none'};">${itens}</div>
        </div>`;
    }).join('');
  }

  // HTML de um único item do cardápio (reutilizado em lista plana e agrupada)
  function mlCardapioItemHTML(item) {
    const esg = _cardEsgotadoHoje(item);
    return `
      <div class="ml-cardapio-item"${esg ? ' style="opacity:.6;"' : ''}>
        ${item.foto
          ? `<img loading="lazy" decoding="async" src="${escAttr(item.foto)}" class="ml-cardapio-item-foto" onerror="this.style.display='none'">`
          : `<div class="ml-cardapio-item-foto" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;">${_ccEmojiItem(item, '🍽️')}</div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-h);font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(item.nome)}</div>
          ${item.categoria ? `<div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-top:1px;">${escHTML(item.categoria)}</div>` : ''}
          <div style="font-size:12px;font-weight:700;color:var(--green);margin-top:3px;">R$ ${(parseFloat(item.preco) || 0).toFixed(2).replace('.',',')}</div>
          ${esg ? '<div style="margin-top:3px;"><span style="display:inline-block;white-space:nowrap;font-size:9px;font-weight:800;color:#f59e0b;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);padding:1px 6px;border-radius:5px;">ESGOTADO HOJE</span></div>' : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="mlCardapioPausar('${escJsArg(item.id)}', ${esg ? 'false' : 'true'})"
            title="${esg ? 'Voltar a vender' : 'Acabou hoje'}" aria-label="${esg ? 'Voltar a vender ' : 'Marcar como esgotado hoje: '}${escAttr(item.nome)}"
            style="padding:6px 8px;border-radius:7px;background:${esg ? 'rgba(16,185,129,0.12)' : 'var(--surface)'};border:1px solid ${esg ? 'rgba(16,185,129,0.35)' : 'var(--border)'};color:${esg ? '#10b981' : 'var(--muted)'};font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">
            ${esg ? '<i class="fa fa-rotate-left"></i> Voltou' : '<i class="fa fa-ban"></i> Acabou'}
          </button>
          <button onclick="mlCardapioAbrirForm('${escJsArg(item.id)}')"
            style="padding:6px 10px;border-radius:7px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:700;cursor:pointer;">
            <i class="fa fa-pencil"></i>
          </button>
          <button onclick="mlCardapioRemover('${escJsArg(item.id)}','${escJsArg(item.nome)}')"
            style="padding:6px 10px;border-radius:7px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);color:var(--red);font-size:10px;font-weight:700;cursor:pointer;">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      </div>`;
  }

  // "Acabou hoje" / "Voltou": pausa o item só no dia de hoje (amanhã volta sozinho).
  window.mlCardapioPausar = async function (id, pausar) {
    const item = _cardapioItens.find(i => i.id === id);
    if (!item || !_lojaToken) return;
    const antes = item.ativo;
    const a = _agoraSP();
    item.ativo = pausar ? `PAUSADO_${a.y}-${String(a.mo).padStart(2,'0')}-${String(a.d).padStart(2,'0')}` : 'SIM';
    mlCardapioRenderLista(); // otimista
    try {
      const json = await apiPost('lojaCardapioPausar', { token: _lojaToken, id, pausar: !!pausar }, { timeout: 25000 });
      if (json.status !== 'ok') throw new Error(json.msg || 'Falha');
      if (json.data && json.data.ativo) item.ativo = json.data.ativo;
      // Reflete no cardápio público em memória (mesmo aparelho)
      try {
        const lj = _mlAcharLojaLocal(null, _lojaNome);
        const pub = lj && Array.isArray(lj.cardapio) ? lj.cardapio.find(i => i.id === id) : null;
        if (pub) pub.esgotado = pausar ? item.ativo.slice(8) : '';
      } catch (e) {}
      mlToast(pausar ? `“${item.nome}” aparece como esgotado até o fim do dia.` : `“${item.nome}” voltou ao cardápio.`, 'ok');
    } catch (e) {
      item.ativo = antes;
      if (e && e.message === 'UNAUTHORIZED') return;
      mlToast('Não deu para salvar agora. Tente de novo.', 'erro');
    }
    mlCardapioRenderLista();
  };

  // Busca: filtra em memória e re-renderiza
  function mlCardapioFiltrar(termo) {
    _cardapioBusca = termo || '';
    mlCardapioRenderLista();
  }

  // Colapsa/expande um grupo de categoria
  function mlCardapioToggleGrupo(cat) {
    _cardapioGruposFechados[cat] = !_cardapioGruposFechados[cat];
    mlCardapioRenderLista();
  }

  function mlCardapioAbrirForm(editId) {
    const form = document.getElementById('ml-cardapio-form');
    if (!form) return;
    // Fix #7: PLUS é limitado a 5 itens — bloqueia abrir form para NOVO item ao atingir o limite
    if (!editId && _cardapioPlano !== 'PRO') {
      const ativos = _cardapioItens.filter(i => i.ativo !== 'NAO').length;
      if (ativos >= PLUS_LIMITE_ITENS) {
        const limiteEl = document.getElementById('ml-cardapio-limite');
        if (limiteEl) {
          limiteEl.textContent = `⚠️ Limite de ${PLUS_LIMITE_ITENS} itens do plano PLUS atingido. Faça upgrade para PRO para itens ilimitados.`;
          limiteEl.style.color = 'var(--red)';
          setTimeout(() => { mlCardapioRenderLista(); }, 4000); // restaura o texto normal do contador
        }
        return;
      }
    }
    form.style.display = '';
    document.getElementById('ml-cardapio-form-msg').textContent = '';

    if (editId) {
      const item = _cardapioItens.find(i => i.id === editId);
      if (!item) return;
      document.getElementById('ml-cardapio-form-title').textContent = 'Editar item';
      document.getElementById('ml-cardapio-edit-id').value = editId;
      document.getElementById('ml-cardapio-nome').value    = item.nome;
      document.getElementById('ml-cardapio-desc').value    = item.descricao || '';
      document.getElementById('ml-cardapio-preco').value   = item.preco;
      document.getElementById('ml-cardapio-cat').value     = item.categoria || '';
      document.getElementById('ml-cardapio-foto-url').value = item.foto || '';
      const destaqueChk = document.getElementById('ml-cardapio-destaque');
      if (destaqueChk) destaqueChk.checked = item.destaque === 'SIM';
      const prev = document.getElementById('ml-cardapio-foto-preview');
      if (prev) prev.innerHTML = item.foto
        ? `<img src="${escAttr(item.foto)}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`
        : '<i class="fa fa-image" style="color:var(--muted);font-size:1.2rem;"></i>';
      mlRenderVinculoGrupos(item);
      mlRenderPrecosPorItem(item);
    } else {
      document.getElementById('ml-cardapio-form-title').textContent = 'Novo item';
      document.getElementById('ml-cardapio-edit-id').value = '';
      document.getElementById('ml-cardapio-nome').value    = '';
      document.getElementById('ml-cardapio-desc').value    = '';
      document.getElementById('ml-cardapio-preco').value   = '';
      document.getElementById('ml-cardapio-cat').value     = '';
      document.getElementById('ml-cardapio-foto-url').value = '';
      const destaqueChkN = document.getElementById('ml-cardapio-destaque');
      if (destaqueChkN) destaqueChkN.checked = false;
      const prev = document.getElementById('ml-cardapio-foto-preview');
      if (prev) prev.innerHTML = '<i class="fa fa-image" style="color:var(--muted);font-size:1.2rem;"></i>';
      mlRenderVinculoGrupos(null);
      mlRenderPrecosPorItem(null);
    }
    form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function mlCardapioFecharForm() {
    document.getElementById('ml-cardapio-form').style.display = 'none';
  }

  /* ─────────────────────────────────────────────────────
     CATEGORIAS — renomear e reordenar
     Categoria não é entidade própria: é o texto da coluna
     Categoria repetido em cada item. Por isso renomear é
     uma operação em lote no backend, e a ordem mora numa
     coluna (CatOrdem) replicada nos itens da categoria.
  ───────────────────────────────────────────────────── */
  let _cardapioOrdemAtual = [];
  let _catOperacaoEmAndamento = false;

  // Envia a ordem corrente inteira; o backend grava o índice de cada
  // categoria em todos os itens dela.
  async function _mlCategoriasSalvarOrdem(ordem) {
    const json = await apiPost('lojaCategoriasReordenar', {
      token: _lojaToken,
      ordem: ordem.filter(c => c !== 'Sem categoria').join('|||'),
    }, { timeout: 30000 });
    if (json.status !== 'ok') throw new Error(json.msg || 'Erro ao salvar ordem');
    return json;
  }

  async function mlCategoriaMover(cat, delta) {
    if (_catOperacaoEmAndamento) return;
    const ordem = _cardapioOrdemAtual.slice();
    const i = ordem.indexOf(cat);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= ordem.length) return;
    // Troca as duas posições
    const tmp = ordem[i]; ordem[i] = ordem[j]; ordem[j] = tmp;

    _catOperacaoEmAndamento = true;
    // Otimista: reordena na tela antes da resposta para o toque parecer
    // instantâneo. Se o servidor recusar, mlCardapioCarregar restaura.
    _cardapioOrdemAtual = ordem;
    try {
      await _mlCategoriasSalvarOrdem(ordem);
      await mlCardapioCarregar(_cardapioPlano);
    } catch (e) {
      if (e.message !== 'UNAUTHORIZED') {
        mlToast('Não foi possível salvar a ordem: ' + e.message, 'erro');
        await mlCardapioCarregar(_cardapioPlano);
      }
    } finally {
      _catOperacaoEmAndamento = false;
    }
  }

  async function mlCategoriaRenomear(cat) {
    if (_catOperacaoEmAndamento) return;
    if (cat === 'Sem categoria') {
      mlAviso('Categoria automática',
        'Os itens sem categoria aparecem juntos aqui. Para nomear esse grupo, edite os itens e preencha o campo Categoria.',
        '/webp/owl-tip.webp');
      return;
    }
    const qtd = (_cardapioItens || []).filter(i =>
      i.ativo !== 'NAO' && ((i.categoria || '').trim() || 'Sem categoria') === cat).length;

    const novo = await mlPrompt('Renomear categoria',
      `O novo nome será aplicado aos ${qtd} item(ns) de "${cat}".`,
      { valor: cat, maxlength: 40, okLabel: 'Renomear', placeholder: 'Nome da categoria' });
    if (novo === null) return;                 // cancelou
    const limpo = String(novo).trim();
    if (!limpo || limpo === cat) return;       // vazio ou sem mudança

    _catOperacaoEmAndamento = true;
    try {
      const json = await apiPost('lojaCategoriaRenomear', {
        token: _lojaToken, de: cat, para: limpo,
      }, { timeout: 30000 });
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro ao renomear');
      // O estado de expandido/colapsado é indexado pelo nome: migra a chave
      // para o nome novo, senão a categoria renomeada volta fechada.
      if (_cardapioGruposFechados[cat] !== undefined) {
        _cardapioGruposFechados[limpo] = _cardapioGruposFechados[cat];
        delete _cardapioGruposFechados[cat];
      }
      // A ordem é gravada por nome; reenvia com o nome novo no mesmo lugar.
      const idx = _cardapioOrdemAtual.indexOf(cat);
      if (idx !== -1) {
        const ordem = _cardapioOrdemAtual.slice();
        ordem[idx] = limpo;
        try { await _mlCategoriasSalvarOrdem(ordem); } catch (e) { /* ordem é secundária */ }
      }
      await mlCardapioCarregar(_cardapioPlano);
      mlToast(json.data && json.data.msg ? json.data.msg : 'Categoria renomeada', 'ok');
    } catch (e) {
      if (e.message !== 'UNAUTHORIZED') mlToast('Erro: ' + e.message, 'erro');
    } finally {
      _catOperacaoEmAndamento = false;
    }
  }

  window.mlCategoriaMover    = mlCategoriaMover;
  window.mlCategoriaRenomear = mlCategoriaRenomear;

  /* ─────────────────────────────────────────────────────
     FOTO EM LOTE — uma imagem para todos os itens de uma categoria
     Fluxo: escolhe arquivo → 1 upload no Cloudinary → 1 POST no GAS
     que grava a mesma URL em todas as linhas da categoria.
     Sem isso, aplicar foto em 19 itens seriam 19 requisições.
  ───────────────────────────────────────────────────── */
  let _fotoLoteCategoria = null;

  function mlCardapioFotoLoteAbrir(cat) {
    // Recurso de plano pago — igual à foto unitária.
    if (_cardapioPlano !== 'PRO' && _cardapioPlano !== 'PLUS') {
      mlAviso('Recurso do plano Plus', 'Fotos nos itens do cardápio fazem parte dos planos Plus e Pro.', '/webp/owl-tip.webp');
      return;
    }
    _fotoLoteCategoria = cat;
    const input = document.getElementById('ml-cardapio-lote-input');
    if (!input) return;
    input.value = ''; // permite reescolher o mesmo arquivo
    input.click();
  }

  async function mlCardapioFotoLoteSelecionado(input) {
    const file = input.files && input.files[0];
    const cat  = _fotoLoteCategoria;
    if (!file || cat === null || cat === undefined) return;

    const itensCat = _cardapioItens.filter(i =>
      i.ativo !== 'NAO' &&
      ((i.categoria || '').trim() || 'Sem categoria') === cat
    );
    if (!itensCat.length) return;

    const comFoto = itensCat.filter(i => i.foto).length;
    const total   = itensCat.length;

    // Se alguns já têm foto, pergunta se sobrescreve — evita apagar
    // trabalho que o lojista já teve.
    let somenteSemFoto = false;
    if (comFoto > 0) {
      const manter = await mlConfirmar(
        'Alguns itens já têm foto',
        `${comFoto} de ${total} itens de "${cat}" já têm foto própria.\n\nQuer manter essas fotos e preencher só os ${total - comFoto} que estão sem?`,
        { okLabel: 'Manter as existentes', cancelLabel: 'Substituir todas', owlSrc: '/webp/owl-tip.webp' }
      );
      somenteSemFoto = !!manter;
      if (somenteSemFoto && total - comFoto === 0) return;
    }

    const msgEl = document.getElementById('ml-cardapio-lote-msg');
    const alvo  = somenteSemFoto ? (total - comFoto) : total;
    if (msgEl) {
      msgEl.style.display = '';
      msgEl.style.color = 'var(--muted)';
      msgEl.textContent = '\u23F3 Otimizando imagem...';
    }

    _cardapioUploadEmAndamento = true;
    try {
      // 1 upload só — a mesma URL é reaproveitada em todos os itens
      const url = await uploadImagem(file, msgEl || { textContent: '', style: {} });
      if (!url) return;

      if (msgEl) msgEl.textContent = `\u23F3 Aplicando em ${alvo} item(ns)...`;

      const json = await apiPost('lojaCardapioFotoLote', {
        token: _lojaToken,
        categoria: cat === 'Sem categoria' ? '' : cat,
        foto: url,
        somenteSemFoto: somenteSemFoto ? 'SIM' : 'NAO',
      }, { timeout: 30000 });

      if (json.status !== 'ok') throw new Error(json.msg || 'Erro ao aplicar foto');

      await mlCardapioCarregar(_cardapioPlano);
      if (msgEl) {
        msgEl.style.color = 'var(--green)';
        msgEl.textContent = '\u2705 ' + (json.data && json.data.msg ? json.data.msg : 'Foto aplicada!');
        setTimeout(() => { msgEl.textContent = ''; msgEl.style.display = 'none'; }, 3000);
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      if (msgEl) {
        msgEl.style.color = 'var(--red)';
        msgEl.textContent = '\u274C ' + e.message;
      }
    } finally {
      _cardapioUploadEmAndamento = false;
      _fotoLoteCategoria = null;
      input.value = '';
    }
  }

  window.mlCardapioFotoLoteAbrir      = mlCardapioFotoLoteAbrir;
  window.mlCardapioFotoLoteSelecionado = mlCardapioFotoLoteSelecionado;

  async function mlCardapioFotoPreview(input) {
    const file = input.files[0];
    if (!file) return;
    const prev = document.getElementById('ml-cardapio-foto-preview');
    const msgEl = document.getElementById('ml-cardapio-form-msg');
    // Preview local
    const reader = new FileReader();
    reader.onload = e => {
      prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`;
    };
    reader.readAsDataURL(file);
    // Item 13: sem barreira antecipada de 5MB — uploadImagem() reduz antes de validar.
    // Upload via proxy (Apps Script → ImgBB) — chave nunca exposta no JS
    msgEl.textContent = '⏳ Enviando foto...';
    _cardapioUploadEmAndamento = true;
    try {
      const url = await uploadImagem(file, msgEl);
      if (url) {
        document.getElementById('ml-cardapio-foto-url').value = url;
        setTimeout(() => { msgEl.textContent = ''; }, 2000);
      }
    } finally {
      _cardapioUploadEmAndamento = false;
    }
  }

  window.mlCardapioFotoPreview = mlCardapioFotoPreview;

  /* ─────────────────────────────────────────────────────
     PAINEL MINHA LOJA — funções das abas e hero
  ───────────────────────────────────────────────────── */

  window.mlSwitchTab = function(tab) {
    document.querySelectorAll('.ml-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.ml-tab-btn').forEach(btn => {
      btn.classList.remove('ml-tab-active');
      btn.style.color = 'var(--muted)';
      btn.style.borderBottomColor = 'transparent';
    });
    var content = document.getElementById('ml-tab-' + tab);
    if (content) {
      content.style.display = '';
      // Cada aba começa do topo (antes herdava a rolagem da aba anterior)
      var sc = document.getElementById('ml-scroll');
      if (sc) sc.scrollTop = 0;
    }
    var btn = document.querySelector('.ml-tab-btn[data-tab="' + tab + '"]');
    if (btn) {
      btn.classList.add('ml-tab-active');
      btn.style.color = 'var(--red)';
      btn.style.borderBottomColor = 'var(--red)';
    }
  };

  window.mlAplicarTemplate = function(btn) {
    var tpl = btn.dataset.tpl;
    if (!tpl) return;
    var textarea = document.getElementById('ml-anuncio-texto');
    if (!textarea) return;
    textarea.value = tpl;
    var chars = document.getElementById('ml-anuncio-chars');
    if (chars) chars.textContent = tpl.length + '/80';
    textarea.focus();
    // Dispara evento input para o contador do app.js reagir
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  window.mlAtualizarHeroStatus = function(statusLoja, cliquesHoje) {
    var dot  = document.getElementById('ml-hero-status-dot');
    var txt  = document.getElementById('ml-hero-status-txt');
    var hDiv = document.getElementById('ml-hero-cliques');
    var hNum = document.getElementById('ml-hero-cliques-num');
    if (!dot || !txt) return;
    var s = (statusLoja || '').toUpperCase();
    if (s.indexOf('ABERTO') === 0) {
      dot.style.background = '#00d084'; dot.style.animation = 'blink 1.5s infinite';
      txt.textContent = 'Aberta agora';
    } else if (s.indexOf('VOLTAMOS') === 0) {
      dot.style.background = '#f59e0b'; dot.style.animation = '';
      txt.textContent = 'Já voltamos';
    } else if (s === 'FECHADO' || s.indexOf('FECHADO_HOJE_') === 0) {
      dot.style.background = '#ff4444'; dot.style.animation = '';
      txt.textContent = 'Fechada agora';
    } else {
      // Automático: diz o que o cliente está vendo agora (antes só "Status automático")
      var _si = null;
      try {
        var _lj = (typeof _mlAcharLojaLocal === 'function') ? _mlAcharLojaLocal(null, _lojaNome) : null;
        if (_lj) _si = calcStatusInfo(Object.assign({}, _lj, { statusLoja: '' }));
      } catch (e) {}
      dot.style.animation = '';
      if (_si && _si.status === 'open') {
        dot.style.background = '#00d084'; dot.style.animation = 'blink 1.5s infinite';
        txt.textContent = 'Automático · ' + (/^\d{2}:\d{2}$/.test(_si.fechaStr || '') ? 'aberta até ' + _si.fechaStr : 'aberta agora');
      } else if (_si && _si.agendado) {
        dot.style.background = '#f59e0b';
        txt.textContent = 'Sob agendamento';
      } else if (_si) {
        dot.style.background = '#ff4444';
        txt.textContent = 'Automático · ' + (/^\d{2}:\d{2}$/.test(_si.fechaStr || '') ? 'fechada, abre às ' + _si.fechaStr : 'fechada agora');
      } else {
        dot.style.background = '#555';
        txt.textContent = 'Status automático';
      }
    }
    if (hDiv && hNum && typeof cliquesHoje === 'number' && cliquesHoje > 0) {
      hNum.textContent = cliquesHoje;
      hDiv.style.display = 'flex';
    }
  };

  window.mlAtualizarBadgeMetricas = function(novos) {
    var badge = document.getElementById('ml-tab-badge-metricas');
    if (!badge) return;
    if (novos > 0) {
      badge.textContent = '+' + novos;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  };

  /* ─────────────────────────────────────────────────────
     FILA DE ITENS (lote otimista) — só PRO.
     O lojista salva um item e já digita o próximo; o envio real
     (item + vínculo de grupos + preços) roda em segundo plano, um
     de cada vez (preserva a ordem e não martela o Sheets). Falhas
     ficam listadas com botão de reenvio, e ao esvaziar a fila o
     cardápio recarrega UMA vez só.
  ───────────────────────────────────────────────────── */
  let _filaItens    = [];    // snapshots pendentes
  let _filaEnviando = false;
  let _filaOk       = 0;     // enviados nesta leva
  let _filaTotal    = 0;     // total desta leva (ok + em curso + pendentes)
  let _filaFalhas   = [];    // { snap, erro }
  let _filaAtual    = null;  // nome do item em envio agora
  let _filaWaiters  = [];    // resolves aguardando o fim da fila
  let _filaUnloadArmado = false;

  function _filaArmarUnload() {
    if (_filaUnloadArmado) return;
    _filaUnloadArmado = true;
    window.addEventListener('beforeunload', function(ev) {
      if (_filaEnviando || _filaItens.length) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }

  function mlFilaEnfileirar(snap) {
    _filaArmarUnload();
    _filaItens.push(snap);
    _filaTotal++;
    mlFilaRenderStrip();
    mlFilaProcessar(); // idempotente: não reentra se já rodando
  }

  async function mlFilaProcessar() {
    if (_filaEnviando) return;
    _filaEnviando = true;
    mlFilaRenderStrip();
    while (_filaItens.length) {
      const snap = _filaItens.shift();
      _filaAtual = snap.nome;
      mlFilaRenderStrip();
      try {
        await mlEnviarItemSnap(snap);
        _filaOk++;
      } catch (e) {
        if (e && e.message === 'UNAUTHORIZED') {
          // Sessão caiu: devolve o item e para (o login já foi disparado).
          _filaItens.unshift(snap);
          _filaEnviando = false; _filaAtual = null;
          mlFilaRenderStrip();
          return;
        }
        _filaFalhas.push({ snap, erro: (e && e.message) || 'falha' });
        _filaTotal--; // sai da contagem "/N" e passa a contar como falha
      }
      _filaAtual = null;
      mlFilaRenderStrip();
    }
    _filaEnviando = false;
    mlFilaRenderStrip();

    // Recarrega uma única vez quando tudo drenou.
    try { await mlCardapioCarregar(_cardapioPlano); } catch (_) {}

    // Acorda quem esperava o fim (saída final / fechamento).
    const ws = _filaWaiters; _filaWaiters = [];
    ws.forEach(fn => { try { fn(); } catch (_) {} });

    // Sem falhas: some com a barra depois de um tempo.
    if (!_filaFalhas.length) {
      setTimeout(() => {
        if (!_filaEnviando && !_filaItens.length && !_filaFalhas.length) {
          _filaOk = 0; _filaTotal = 0; mlFilaRenderStrip();
        }
      }, 4000);
    }
  }

  // Envia UM item: cria no cardápio e, se houver, vincula grupos e grava preços.
  async function mlEnviarItemSnap(snap) {
    const json = await apiPost('lojaCardapioSalvar', {
      token:     _lojaToken,
      id:        '',
      nome:      snap.nome,
      descricao: snap.descricao,
      preco:     snap.preco,
      foto:      snap.foto,
      categoria: snap.categoria,
      destaque:  snap.destaque,
    }, { timeout: 30000 });
    if (!json || json.status !== 'ok') throw new Error((json && json.msg) || 'Erro ao salvar');

    const itemId = json.data && json.data.id;
    if (itemId) {
      try {
        await apiPost('lojaItemVincularGrupos',
          { token: _lojaToken, itemId, grupos: (snap.grupos || []).join(',') },
          { timeout: 12000, ignoreUnauthorized: true });
      } catch (eV) { if (eV.message === 'UNAUTHORIZED') throw eV; console.warn('[Vinculo] ' + eV.message); }
      try {
        await apiPost('lojaItemPrecosSalvar',
          { token: _lojaToken, itemId, precos: JSON.stringify(snap.precos || {}) },
          { timeout: 12000, ignoreUnauthorized: true });
      } catch (eP) { if (eP.message === 'UNAUTHORIZED') throw eP; console.warn('[Precos] ' + eP.message); }
    }
    return itemId;
  }

  // Promise que resolve quando a fila esvazia (usado na saída final/fechamento).
  function mlFilaAguardarFim() {
    if (!_filaEnviando && !_filaItens.length) return Promise.resolve();
    return new Promise(res => { _filaWaiters.push(res); });
  }

  window.mlFilaRetry = function(idx) {
    const f = _filaFalhas[idx];
    if (!f) return;
    _filaFalhas.splice(idx, 1);
    _filaTotal++;
    _filaItens.push(f.snap);
    mlFilaRenderStrip();
    mlFilaProcessar();
  };
  window.mlFilaRetryTodos = function() {
    if (!_filaFalhas.length) return;
    const pend = _filaFalhas.map(f => f.snap);
    _filaFalhas = [];
    _filaTotal += pend.length;
    pend.forEach(s => _filaItens.push(s));
    mlFilaRenderStrip();
    mlFilaProcessar();
  };
  window.mlFilaDescartarFalhas = function() {
    _filaFalhas = [];
    if (!_filaEnviando && !_filaItens.length) { _filaOk = 0; _filaTotal = 0; }
    mlFilaRenderStrip();
  };

  function mlFilaRenderStrip() {
    const el = document.getElementById('ml-cardapio-fila');
    if (!el) return;
    const temAlgo = _filaEnviando || _filaItens.length || _filaFalhas.length || (_filaOk && _filaTotal);
    if (!temAlgo) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';

    let html = '';
    if (_filaEnviando || _filaItens.length) {
      const feitos = _filaOk, total = _filaTotal;
      const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
      const atual = _filaAtual ? (' · ' + escHTML(_filaAtual)) : '';
      html += '<div style="display:flex;align-items:center;gap:8px;">'
        + '<i class="fa fa-spinner fa-spin" style="color:#10b981;"></i>'
        + '<span style="font-size:11px;font-weight:700;color:var(--text);white-space:nowrap;">Enviando ' + feitos + '/' + total + '</span>'
        + '<span style="font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + atual + '</span>'
        + '</div>'
        + '<div style="height:4px;border-radius:3px;background:rgba(255,255,255,0.08);margin-top:6px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#10b981,#059669);transition:width .3s ease;"></div>'
        + '</div>';
    } else if (_filaOk && !_filaFalhas.length) {
      html += '<div style="font-size:11px;font-weight:700;color:#10b981;">\u2705 ' + _filaOk + ' item(ns) enviados</div>';
    }

    if (_filaFalhas.length) {
      html += '<div style="margin-top:' + ((_filaEnviando || _filaItens.length) ? '8px' : '0') + ';">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">'
        + '<span style="font-size:11px;font-weight:700;color:#f59e0b;">\u26A0\uFE0F ' + _filaFalhas.length + ' não enviaram</span>'
        + '<span style="display:flex;gap:6px;flex-shrink:0;">'
        + '<button onclick="mlFilaRetryTodos()" style="font-size:10px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.35);border-radius:6px;padding:3px 8px;cursor:pointer;">Tentar todos</button>'
        + '<button onclick="mlFilaDescartarFalhas()" style="font-size:10px;font-weight:700;color:var(--muted);background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;">Descartar</button>'
        + '</span></div>';
      _filaFalhas.forEach((f, i) => {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid var(--border);">'
          + '<span style="font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHTML(f.snap.nome) + '</span>'
          + '<button onclick="mlFilaRetry(' + i + ')" style="font-size:10px;font-weight:700;color:#10b981;background:none;border:1px solid rgba(16,185,129,0.35);border-radius:6px;padding:3px 8px;cursor:pointer;flex-shrink:0;">Tentar de novo</button>'
          + '</div>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
  }

  async function mlCardapioSalvar(manterAberto = false) {
    const nome  = document.getElementById('ml-cardapio-nome').value.trim();
    const preco = document.getElementById('ml-cardapio-preco').value;
    const msgEl = document.getElementById('ml-cardapio-form-msg');
    if (!nome)  { msgEl.textContent = '❌ Informe o nome do item.'; msgEl.style.color='var(--red)'; return; }
    if (!preco) { msgEl.textContent = '❌ Informe o preço.'; msgEl.style.color='var(--red)'; return; }
    const precoNum = parseFloat(String(preco).replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (isNaN(precoNum)) { msgEl.textContent = '❌ Preço inválido. Use apenas números (ex: 15,00).'; msgEl.style.color='var(--red)'; return; }
    if (precoNum < 0) { msgEl.textContent = '❌ Preço não pode ser negativo.'; msgEl.style.color='var(--red)'; return; }
    // Fix #22: bloqueia se upload de foto ainda está em andamento
    if (_cardapioUploadEmAndamento) {
      msgEl.textContent = '⏳ Aguarde o upload da foto terminar antes de salvar.';
      msgEl.style.color = 'var(--muted)';
      return;
    }

    // ── Modo lote otimista (só PRO, item novo): libera o próximo NA HORA.
    //    Tira um retrato do form, reseta preservando o que se repete e
    //    envia em segundo plano via fila. Não trava esperando a rede.
    const _editIdAtual = document.getElementById('ml-cardapio-edit-id').value;
    if (manterAberto && _cardapioPlano === 'PRO' && !_editIdAtual) {
      const snap = {
        nome,
        descricao: document.getElementById('ml-cardapio-desc').value.trim(),
        preco:     precoNum,
        foto:      document.getElementById('ml-cardapio-foto-url').value,
        categoria: document.getElementById('ml-cardapio-cat').value.trim(),
        destaque:  document.getElementById('ml-cardapio-destaque')?.checked ? 'SIM' : 'NAO',
        grupos:    mlLerVinculoGrupos(),
        precos:    mlLerPrecosPorItem(),
      };
      // Preserva categoria/preço/grupos/tamanhos e reseta o form imediatamente.
      const catAtual   = document.getElementById('ml-cardapio-cat').value;
      const precoAtual = document.getElementById('ml-cardapio-preco').value;
      mlCardapioAbrirForm(null);
      document.getElementById('ml-cardapio-cat').value   = catAtual;
      document.getElementById('ml-cardapio-preco').value = precoAtual;
      mlRenderVinculoGrupos({ grupos: snap.grupos.map(id => ({ id })) });
      mlRenderPrecosPorItem({ precosOpcao: snap.precos });
      setTimeout(() => document.getElementById('ml-cardapio-nome')?.focus(), 60);

      mlFilaEnfileirar(snap);
      msgEl.textContent = '';
      return;
    }
    // Saída final (ou edição) com fila ainda enviando: espera esvaziar para
    // não perder itens nem embaralhar a ordem no Sheets.
    if (!manterAberto && (_filaEnviando || _filaItens.length)) {
      msgEl.textContent = '\u23F3 Terminando de enviar a fila...';
      msgEl.style.color = 'var(--muted)';
      await mlFilaAguardarFim();
    }

    const btn      = document.getElementById('ml-cardapio-salvar-btn');
    const btnProx  = document.getElementById('ml-cardapio-proximo-btn');
    const salvarEl = manterAberto ? btnProx : btn;
    if (btn)      { btn.disabled = true; }
    if (btnProx)  { btnProx.disabled = true; }
    if (salvarEl) salvarEl.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:     'lojaCardapioSalvar',
        token:      _lojaToken,
        id:         document.getElementById('ml-cardapio-edit-id').value,
        nome,
        descricao:  document.getElementById('ml-cardapio-desc').value.trim(),
        preco:      precoNum,
        foto:       document.getElementById('ml-cardapio-foto-url').value,
        categoria:  document.getElementById('ml-cardapio-cat').value.trim(),
        destaque:   document.getElementById('ml-cardapio-destaque')?.checked ? 'SIM' : 'NAO',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(30000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        // Vincula grupos ao item (PRO). Usa o id retornado (novo) ou o edit-id.
        if (_cardapioPlano === 'PRO') {
          const itemIdFinal = (json.data && json.data.id) || document.getElementById('ml-cardapio-edit-id').value;
          const gruposSel = mlLerVinculoGrupos();
          if (itemIdFinal) {
            try {
              await apiPost('lojaItemVincularGrupos', { token: _lojaToken, itemId: itemIdFinal, grupos: gruposSel.join(',') }, { timeout: 12000, ignoreUnauthorized: true });
            } catch(eV) { if (eV.message !== 'UNAUTHORIZED') console.warn('[Vinculo] ' + eV.message); }
            // Precos por tamanho (grupos POR_ITEM). Enviado sempre: objeto
            // vazio limpa os precos do item (volta ao preco base).
            try {
              const precosPI = mlLerPrecosPorItem();
              await apiPost('lojaItemPrecosSalvar', { token: _lojaToken, itemId: itemIdFinal, precos: JSON.stringify(precosPI) }, { timeout: 12000, ignoreUnauthorized: true });
            } catch(eP) { if (eP.message !== 'UNAUTHORIZED') console.warn('[Precos] ' + eP.message); }
          }
        }
        // Atualiza a lista sem fechar o form quando manterAberto=true
        await mlCardapioCarregar(_cardapioPlano);

        if (manterAberto) {
          // Modo rápido: limpa o form e deixa pronto para o próximo item.
          // Preserva o que normalmente se REPETE entre itens seguidos da mesma
          // leva: categoria, preço, grupos vinculados e preços por tamanho.
          // Ex.: cadastrar as 13 pizzas de R$42 vira só digitar nome+descrição.
          const catAtual    = document.getElementById('ml-cardapio-cat').value;
          const precoAtual  = document.getElementById('ml-cardapio-preco').value;
          const gruposAtual = mlLerVinculoGrupos();
          const precosAtual = mlLerPrecosPorItem();

          mlCardapioAbrirForm(null); // reseta form para novo item

          document.getElementById('ml-cardapio-cat').value   = catAtual;
          document.getElementById('ml-cardapio-preco').value = precoAtual;
          // Remarca os chips dos mesmos grupos e repõe os preços por tamanho.
          mlRenderVinculoGrupos({ grupos: gruposAtual.map(id => ({ id })) });
          mlRenderPrecosPorItem({ precosOpcao: precosAtual });

          // Avisa o que foi mantido, para não parecer que o form não limpou.
          const mantidos = [];
          if (catAtual)   mantidos.push('categoria');
          if (precoAtual) mantidos.push('preço');
          if (Object.keys(precosAtual).length) mantidos.push('tamanhos');
          msgEl.textContent = mantidos.length
            ? '✅ Salvo! Mantive ' + mantidos.join(', ') + ' para o próximo.'
            : '✅ Salvo! Preencha o próximo.';
          msgEl.style.color = 'var(--green)';
          setTimeout(() => { msgEl.textContent = ''; }, 3500);
          // Auto-foco no nome para digitação imediata
          setTimeout(() => document.getElementById('ml-cardapio-nome')?.focus(), 100);
        } else {
          mlCardapioFecharForm();
          msgEl.textContent = '';
        }
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      msgEl.textContent = '❌ ' + e.message;
      msgEl.style.color = 'var(--red)';
    } finally {
      if (btn)     { btn.innerHTML = '<i class="fa fa-check"></i> Salvar item'; btn.disabled = false; }
      if (btnProx) { btnProx.innerHTML = '<i class="fa fa-plus"></i> Salvar e adicionar próximo'; btnProx.disabled = false; }
    }
  }

  async function mlCardapioRemover(id, nome) {
    const ok = await mlConfirmar('Remover do cardápio?', `"${nome}" será removido do seu cardápio.`, { okLabel: 'Remover', owlSrc: '/webp/owl-sign.webp' });
    if (!ok) return;
    try {
      const json = await apiPost('lojaCardapioRemover', { token: _lojaToken, id });
      if (json.status !== 'ok') {
        mlToast('Erro ao remover: ' + (json.msg || 'tente novamente.'), 'erro');
        return;
      }
      await mlCardapioCarregar(_cardapioPlano);
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return; // apiPost já fez logout
      mlToast('Erro ao remover: ' + e.message, 'erro');
    }
  }

  window.mlCardapioAbrirForm  = mlCardapioAbrirForm;
  window.mlCardapioFiltrar    = mlCardapioFiltrar;
  window.mlCardapioToggleGrupo = mlCardapioToggleGrupo;
  window.mlCardapioFecharForm = mlCardapioFecharForm;
  window.mlCardapioSalvar     = mlCardapioSalvar;
  window.mlCardapioRemover    = mlCardapioRemover;
  window.mlGruposCarregar     = mlGruposCarregar;
  window.mlSalvarInstagram    = mlSalvarInstagram;

  window.mlToggleEntrega = async function() {
    const toggle  = document.getElementById('ml-entrega-toggle');
    const thumb   = document.getElementById('ml-entrega-thumb');
    const label   = document.getElementById('ml-entrega-label');
    const statusEl = document.getElementById('ml-entrega-status');
    if (!toggle) return;
    const novoValor = toggle.dataset.ativo !== '1';
    toggle.dataset.ativo = novoValor ? '1' : '0';
    toggle.setAttribute('aria-checked', novoValor ? 'true' : 'false');
    toggle.style.background = novoValor ? 'var(--green)' : 'var(--border)';
    if (thumb) thumb.style.left = novoValor ? '21px' : '3px';
    // Item 15: mantém o rótulo textual sincronizado com o estado.
    if (label) { label.textContent = novoValor ? 'Ativado' : 'Desativado'; label.style.color = novoValor ? 'var(--green)' : 'var(--muted)'; }
    if (statusEl) { statusEl.textContent = 'Salvando…'; statusEl.style.color = 'var(--muted)'; }
    // Mostra/esconde o painel de forma de cobrança junto com o toggle.
    const taxaWrap = document.getElementById('ml-taxa-wrap');
    if (taxaWrap) taxaWrap.style.display = novoValor ? 'block' : 'none';
    try {
      const json = await apiPost('lojaAtualizarEntrega', { token: _lojaToken, fazEntrega: novoValor ? 'SIM' : 'NAO' });
      if (json.status === 'ok') {
        if (statusEl) {
          statusEl.textContent = novoValor ? '✅ Entrega ativada' : '✅ Entrega desativada';
          statusEl.style.color = 'var(--green)';
          setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
        }
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return; // apiPost já fez logout
      // Reverte estado, cor, thumb E rótulo
      toggle.dataset.ativo = novoValor ? '0' : '1';
      toggle.setAttribute('aria-checked', novoValor ? 'false' : 'true');
      toggle.style.background = novoValor ? 'var(--border)' : 'var(--green)';
      if (thumb) thumb.style.left = novoValor ? '3px' : '21px';
      if (label) { label.textContent = novoValor ? 'Desativado' : 'Ativado'; label.style.color = novoValor ? 'var(--muted)' : 'var(--green)'; }
      if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = 'var(--red)'; }
    }
  };
  // Item 15: acessibilidade — o switch agora é focável (role="switch"); Enter/Espaço alternam.
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.id === 'ml-entrega-toggle') {
      e.preventDefault();
      if (typeof window.mlToggleEntrega === 'function') window.mlToggleEntrega();
    }
  });

  // ── Taxa de entrega (painel lojista) ────────────────────────
  // Converte 'reais' digitado para número (aceita vírgula ou ponto).
  function _mlParseReais(str) {
    const v = parseFloat(String(str || '').replace(/\s/g, '').replace(',', '.'));
    return (isNaN(v) || v < 0) ? null : v;
  }
  function _mlFmtInput(n) {
    return (Number(n) || 0).toFixed(2).replace('.', ',');
  }

  // Preenche a UI de taxa a partir do valor salvo (formato MODO:VALOR).
  window._mlPreencherTaxa = function(taxaStr) {
    const s = String(taxaStr || '').trim().toUpperCase();
    const modoEl = document.getElementById('ml-taxa-modo');
    const fixaEl = document.getElementById('ml-taxa-fixa-val');
    const pisoEl = document.getElementById('ml-taxa-min-piso');
    const minValEl = document.getElementById('ml-taxa-min-val');
    if (!modoEl) return;

    let modo = 'GRATIS';
    if (s.indexOf('FIXA:') === 0) {
      modo = 'FIXA';
      if (fixaEl) fixaEl.value = _mlFmtInput(parseFloat(s.slice(5).replace(',', '.')));
    } else if (s.indexOf('MINIMO:') === 0) {
      modo = 'MINIMO';
      const p = s.slice(7).split(':');
      if (pisoEl)  pisoEl.value  = _mlFmtInput(parseFloat(String(p[0] || '').replace(',', '.')));
      if (minValEl) minValEl.value = _mlFmtInput(parseFloat(String(p[1] || '').replace(',', '.')));
    } else if (s === 'COMBINAR') {
      modo = 'COMBINAR';
    } else {
      modo = 'GRATIS'; // '' ou 'GRATIS'
    }
    modoEl.value = modo;
    if (typeof window.mlTaxaModoChange === 'function') window.mlTaxaModoChange();
  };

  // Mostra/esconde os campos conforme o modo escolhido.
  window.mlTaxaModoChange = function() {
    const modo = (document.getElementById('ml-taxa-modo') || {}).value || 'GRATIS';
    const fixaBox = document.getElementById('ml-taxa-fixa-box');
    const minBox  = document.getElementById('ml-taxa-min-box');
    if (fixaBox) fixaBox.style.display = (modo === 'FIXA')   ? 'block' : 'none';
    if (minBox)  minBox.style.display  = (modo === 'MINIMO') ? 'block' : 'none';
  };

  // Valida e salva a forma de cobrança da entrega.
  window.mlSalvarTaxaEntrega = async function() {
    const modo = (document.getElementById('ml-taxa-modo') || {}).value || 'GRATIS';
    const statusEl = document.getElementById('ml-taxa-status');
    const btn = document.getElementById('ml-taxa-salvar-btn');
    const setStatus = (txt, cor) => { if (statusEl) { statusEl.textContent = txt; statusEl.style.color = cor || 'var(--muted)'; } };

    // Monta a string MODO:VALOR e valida no cliente antes de enviar.
    let taxa = '';
    if (modo === 'GRATIS')   taxa = 'GRATIS';
    else if (modo === 'COMBINAR') taxa = 'COMBINAR';
    else if (modo === 'FIXA') {
      const v = _mlParseReais((document.getElementById('ml-taxa-fixa-val') || {}).value);
      if (v === null || v === 0) { setStatus('❌ Digite um valor de entrega válido', 'var(--red)'); return; }
      taxa = 'FIXA:' + v.toFixed(2);
    } else if (modo === 'MINIMO') {
      const piso = _mlParseReais((document.getElementById('ml-taxa-min-piso') || {}).value);
      const val  = _mlParseReais((document.getElementById('ml-taxa-min-val') || {}).value);
      if (piso === null || piso === 0) { setStatus('❌ Digite o valor mínimo para frete grátis', 'var(--red)'); return; }
      if (val === null || val === 0)   { setStatus('❌ Digite a taxa cobrada abaixo do mínimo', 'var(--red)'); return; }
      taxa = 'MINIMO:' + piso.toFixed(2) + ':' + val.toFixed(2);
    }

    if (btn) btn.disabled = true;
    setStatus('Salvando…', 'var(--muted)');
    try {
      const json = await apiPost('lojaAtualizarTaxaEntrega', { token: _lojaToken, taxa });
      if (json.status === 'ok') {
        setStatus('✅ Forma de cobrança salva', 'var(--green)');
        // Atualiza o objeto da loja em memória para refletir no cardápio sem recarregar.
        try {
          const wppLoja = (typeof _lojaWpp !== 'undefined') ? _lojaWpp : '';
          if (wppLoja) {
            const alvo = String(wppLoja).replace(/\D/g, '');
            for (let i = 0; i < LOJAS.length; i++) {
              if (LOJAS[i] && String(LOJAS[i].wpp).replace(/\D/g, '') === alvo) { LOJAS[i].taxaEntrega = json.data.taxaEntrega; break; }
            }
          }
        } catch(e) {}
        setTimeout(() => setStatus('', 'var(--muted)'), 3000);
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return; // apiPost já fez logout
      setStatus('❌ ' + e.message, 'var(--red)');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ── Toggle 'Atendo por agendamento' no painel Minha Loja ────
  window.mlToggleAgendamento = async function() {
    const toggle   = document.getElementById('ml-agend-toggle');
    const thumb    = document.getElementById('ml-agend-thumb');
    const label    = document.getElementById('ml-agend-label');
    const statusEl = document.getElementById('ml-agend-status');
    if (!toggle) return;
    const novoValor = toggle.dataset.ativo !== '1';
    toggle.dataset.ativo = novoValor ? '1' : '0';
    toggle.setAttribute('aria-checked', novoValor ? 'true' : 'false');
    toggle.style.background = novoValor ? 'var(--green)' : 'var(--border)';
    if (thumb) thumb.style.left = novoValor ? '21px' : '3px';
    if (label) { label.textContent = novoValor ? 'Ativado' : 'Desativado'; label.style.color = novoValor ? 'var(--green)' : 'var(--muted)'; }
    if (statusEl) { statusEl.textContent = 'Salvando…'; statusEl.style.color = 'var(--muted)'; }
    try {
      const json = await apiPost('lojaAtualizarAgendamento', { token: _lojaToken, agendamento: novoValor ? 'SIM' : 'NAO' });
      if (json.status === 'ok') {
        if (statusEl) {
          statusEl.textContent = novoValor ? '✅ Agendamento ativado' : '✅ Agendamento desativado';
          statusEl.style.color = 'var(--green)';
          setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
        }
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      toggle.dataset.ativo = novoValor ? '0' : '1';
      toggle.setAttribute('aria-checked', novoValor ? 'false' : 'true');
      toggle.style.background = novoValor ? 'var(--border)' : 'var(--green)';
      if (thumb) thumb.style.left = novoValor ? '3px' : '21px';
      if (label) { label.textContent = novoValor ? 'Desativado' : 'Ativado'; label.style.color = novoValor ? 'var(--muted)' : 'var(--green)'; }
      if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = 'var(--red)'; }
    }
  };
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.id === 'ml-agend-toggle') {
      e.preventDefault();
      if (typeof window.mlToggleAgendamento === 'function') window.mlToggleAgendamento();
    }
  });
