'use strict';

  /* ══════════════════════════════════════════════════════════════
     CATEGORIAS
  ══════════════════════════════════════════════════════════════ */
  const CATEGORIAS = [
    { id:'todos',        label:'Tudo',          icon:'ti-bolt',                cor:'#ff4444', bg:'rgba(255,68,68,0.12)'    },
    // ── Alimentação e Bebidas ──────────────────────────────────────────────
    { id:'pizzaria',     label:'Pizzarias',     icon:'ti-pizza',               cor:'#f59e0b', bg:'rgba(245,158,11,0.12)'   },
    { id:'lanches',      label:'Lanches',       icon:'ti-burger',              cor:'#00d084', bg:'rgba(0,208,132,0.12)'    },
    { id:'adega',        label:'Adegas',        icon:'ti-bottle',              cor:'#a78bfa', bg:'rgba(167,139,250,0.12)'  },
    { id:'carnes',       label:'Carnes/Grill',  icon:'ti-meat',                cor:'#ef4444', bg:'rgba(239,68,68,0.12)'    },
    // ── Saúde, Beleza e Bem-Estar ──────────────────────────────────────────
    { id:'farmacia',     label:'Farmácias',     icon:'ti-pill',                cor:'#38bdf8', bg:'rgba(56,189,248,0.12)'   },
    { id:'clinica',      label:'Clínicas',      icon:'ti-stethoscope',         cor:'#34d399', bg:'rgba(52,211,153,0.12)'   },
    { id:'laboratorio',  label:'Laboratórios',  icon:'ti-flask',               cor:'#a3e635', bg:'rgba(163,230,53,0.12)'   },
    { id:'otica',        label:'Óticas',        icon:'ti-eyeglass',            cor:'#67e8f9', bg:'rgba(103,232,249,0.12)'  },
    { id:'barbearia',    label:'Barbearias',    icon:'ti-scissors',            cor:'#fbbf24', bg:'rgba(251,191,36,0.12)'   },
    { id:'salao',        label:'Salões',        icon:'ti-flower',              cor:'#f9a8d4', bg:'rgba(249,168,212,0.12)'  },
    { id:'academia',     label:'Academias',     icon:'ti-barbell',             cor:'#fb923c', bg:'rgba(251,146,60,0.12)'   },
    { id:'tattoo',       label:'Tatuagem',      icon:'ti-brush',               cor:'#c084fc', bg:'rgba(192,132,252,0.12)'  },
    // ── Comércio e Variedades ──────────────────────────────────────────────
    { id:'mercado',      label:'Mercados',      icon:'ti-building-store',      cor:'#2dd4bf', bg:'rgba(45,212,191,0.12)'   },
    { id:'roupas',       label:'Roupas',        icon:'ti-shirt',               cor:'#f472b6', bg:'rgba(244,114,182,0.12)'  },
    { id:'calcados',     label:'Calçados',      icon:'ti-shoe',                cor:'#a78bfa', bg:'rgba(167,139,250,0.12)'  },
    { id:'joalheria',    label:'Joalherias',    icon:'ti-diamond',             cor:'#facc15', bg:'rgba(250,204,21,0.12)'   },
    { id:'festas',       label:'Festas',        icon:'ti-cake',                cor:'#fb7185', bg:'rgba(251,113,133,0.12)'  },
    { id:'armarinho',    label:'Armarinho',     icon:'ti-needle-thread',       cor:'#d946ef', bg:'rgba(217,70,239,0.12)'   },
    { id:'floricultura', label:'Flores',        icon:'ti-plant-2',             cor:'#4ade80', bg:'rgba(74,222,128,0.12)'   },
    { id:'papelaria',    label:'Papelaria',     icon:'ti-book',                cor:'#60a5fa', bg:'rgba(96,165,250,0.12)'   },
    { id:'variedades',   label:'Variedades',    icon:'ti-shopping-bag',        cor:'#94a3b8', bg:'rgba(148,163,184,0.12)'  },
    // ── Automotivo ────────────────────────────────────────────────────────
    { id:'posto',        label:'Postos',        icon:'ti-gas-station',         cor:'#facc15', bg:'rgba(250,204,21,0.12)'   },
    { id:'gas',          label:'Gás/Água',      icon:'ti-flame',               cor:'#fb923c', bg:'rgba(251,146,60,0.12)'   },
    { id:'mecanica',     label:'Mecânicas',     icon:'ti-tool',                cor:'#94a3b8', bg:'rgba(148,163,184,0.12)'  },
    { id:'autopecas',    label:'Autopeças',     icon:'ti-settings',            cor:'#78716c', bg:'rgba(120,113,108,0.12)'  },
    { id:'borracharia',  label:'Borracharia',   icon:'ti-circle',              cor:'#a8a29e', bg:'rgba(168,162,158,0.12)'  },
    { id:'funilaria',    label:'Funilaria',     icon:'ti-car-crash',           cor:'#f87171', bg:'rgba(248,113,113,0.12)'  },
    { id:'lava-rapido',  label:'Lava-Rápido',   icon:'ti-droplet',             cor:'#38bdf8', bg:'rgba(56,189,248,0.12)'   },
    { id:'bicicletaria', label:'Bicicletaria',  icon:'ti-bike',                cor:'#4ade80', bg:'rgba(74,222,128,0.12)'   },
    // ── Casa e Construção ─────────────────────────────────────────────────
    { id:'construcao',   label:'Construção',    icon:'ti-hard-hat',            cor:'#f59e0b', bg:'rgba(245,158,11,0.12)'   },
    { id:'moveis',       label:'Móveis',        icon:'ti-armchair',            cor:'#a78bfa', bg:'rgba(167,139,250,0.12)'  },
    { id:'madeireira',   label:'Madeireira',    icon:'ti-tree',                cor:'#86efac', bg:'rgba(134,239,172,0.12)'  },
    { id:'tintas',       label:'Tintas',        icon:'ti-bucket',              cor:'#f472b6', bg:'rgba(244,114,182,0.12)'  },
    { id:'vidracaria',   label:'Vidraçaria',    icon:'ti-window',              cor:'#67e8f9', bg:'rgba(103,232,249,0.12)'  },
    { id:'serralheria',  label:'Serralheria',   icon:'ti-building-factory-2',  cor:'#94a3b8', bg:'rgba(148,163,184,0.12)'  },
    { id:'refrigeracao', label:'Refrigeração',  icon:'ti-snowflake',           cor:'#7dd3fc', bg:'rgba(125,211,252,0.12)'  },
    { id:'consertos',    label:'Consertos',     icon:'ti-screwdriver',         cor:'#fbbf24', bg:'rgba(251,191,36,0.12)'   },
    // ── Pet e Agropecuária ────────────────────────────────────────────────
    { id:'pet',          label:'Pet Shop',      icon:'ti-paw',                 cor:'#f472b6', bg:'rgba(244,114,182,0.12)'  },
    { id:'agropecuaria', label:'Agropecuária',  icon:'ti-tractor',             cor:'#86efac', bg:'rgba(134,239,172,0.12)'  },
    { id:'insumos',      label:'Insumos Agric.',icon:'ti-leaf',                cor:'#4ade80', bg:'rgba(74,222,128,0.12)'   },
    // ── Tecnologia e Serviços ─────────────────────────────────────────────
    { id:'informatica',  label:'Informática',   icon:'ti-laptop',              cor:'#60a5fa', bg:'rgba(96,165,250,0.12)'   },
    { id:'celular',      label:'Celulares',     icon:'ti-device-mobile',       cor:'#34d399', bg:'rgba(52,211,153,0.12)'   },
    { id:'grafica',      label:'Gráfica',       icon:'ti-printer',             cor:'#a78bfa', bg:'rgba(167,139,250,0.12)'  },
    { id:'imobiliaria',  label:'Imobiliária',   icon:'ti-home',                cor:'#38bdf8', bg:'rgba(56,189,248,0.12)'   },
    { id:'advocacia',    label:'Advocacia',     icon:'ti-scale',               cor:'#f59e0b', bg:'rgba(245,158,11,0.12)'   },
    { id:'contabilidade',label:'Contabilidade', icon:'ti-calculator',          cor:'#34d399', bg:'rgba(52,211,153,0.12)'   },
    { id:'fotografia',   label:'Fotografia',    icon:'ti-camera',              cor:'#f472b6', bg:'rgba(244,114,182,0.12)'  },
    { id:'viagens',      label:'Viagens',       icon:'ti-plane',               cor:'#38bdf8', bg:'rgba(56,189,248,0.12)'   },
    // ── Educação e Finanças ───────────────────────────────────────────────
    { id:'bancario',     label:'Bancos/Lotérica',icon:'ti-building-bank',      cor:'#facc15', bg:'rgba(250,204,21,0.12)'   },
    { id:'seguros',      label:'Seguros',       icon:'ti-shield',              cor:'#60a5fa', bg:'rgba(96,165,250,0.12)'   },
    { id:'idiomas',      label:'Cursos/Idiomas',icon:'ti-certificate',         cor:'#a3e635', bg:'rgba(163,230,53,0.12)'   },
    { id:'autoescola',   label:'Autoescola',    icon:'ti-car',                 cor:'#fb923c', bg:'rgba(251,146,60,0.12)'   },
    // ── Genérico ──────────────────────────────────────────────────────────
    { id:'servicos',     label:'Serviços',      icon:'ti-briefcase',           cor:'#94a3b8', bg:'rgba(148,163,184,0.12)'  },
  ];

  const CAT_BG = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.bg]));

  /* ══════════════════════════════════════════════════════════════
     LOJAS — carregadas dinamicamente do Google Sheets via Apps Script
     Lojas hardcoded abaixo são o fallback caso a API falhe
  ══════════════════════════════════════════════════════════════ */
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwmJMmvb5H6KkMWdXJV441SQ2h18SEfLrb_4-kvUYM0IiVL6Co-EKGGay7f_qvUEi0_cg/exec';
  const ADMIN_WPP_CONTATO = '5515981125349'; // número único — atualizar aqui se mudar

  /* ══════════════════════════════════════════════════════════════
     SPLASH SCREEN — vídeo da coruja (cacheado) ou CSS fallback
     Tempo mínimo: 1.8s. Máximo: 5s (failsafe).
  ══════════════════════════════════════════════════════════════ */
  const _splashInicio = Date.now();
  const _SPLASH_MIN   = 1800;
  const _SPLASH_MAX   = 5000;
  let   _splashOculta = false;

  // Inicia lógica do vídeo — só mostra se já estiver no cache (carrega < 400ms)
  (function _initSplashVideo() {
    const vid      = document.getElementById('spl-video');
    const fallback = document.getElementById('spl-fallback');
    const texto    = document.getElementById('spl-texto');
    if (!vid) return;

    const t0 = Date.now();
    vid.addEventListener('canplay', () => {
      if (Date.now() - t0 > 400) return; // demorou: não estava cacheado, mantém fallback
      // Vídeo cacheado: troca fallback pelo vídeo
      if (fallback) fallback.classList.add('oculto');
      vid.classList.add('pronto');
      if (texto) texto.classList.add('visivel');
      vid.play().catch(() => {});
    }, { once: true });

    // Se o vídeo não estiver disponível, garante que o fallback aparece limpo
    vid.addEventListener('error', () => {
      if (fallback) fallback.classList.remove('oculto');
    }, { once: true });
  })();

  function _esconderSplash() {
    if (_splashOculta) return;
    _splashOculta = true;
    const decorrido = Date.now() - _splashInicio;
    const espera    = Math.max(0, _SPLASH_MIN - decorrido);
    setTimeout(() => {
      const el = document.getElementById('splash-screen');
      if (!el) return;
      el.classList.add('splash-saindo');
      setTimeout(() => { try { el.remove(); } catch(e) {} }, 650);
    }, espera);
  }

  // Failsafe: some em no máximo 5s mesmo se algo travar
  setTimeout(_esconderSplash, _SPLASH_MAX);

  // Lojas fixas (fallback offline / enquanto carrega)
  const LOJAS_FIXAS = []; // migradas para a planilha

  // Array ativo — começa com as fixas, substituído pelas da API quando carregar
  let LOJAS = [...LOJAS_FIXAS];

  // Mapa nome→índice global — atualizado sempre que LOJAS muda.
  // Garante que abrirDetalhes(idx) sempre encontre a loja certa,
  // independente de filtros ativos na lista renderizada.
  let _lojaIdxMap = new Map();
  function _rebuildIdxMap() {
    _lojaIdxMap.clear();
    LOJAS.forEach((l, i) => _lojaIdxMap.set(l, i));
  }
  _rebuildIdxMap();

  /* ══════════════════════════════════════════════════════════════
     ENGINE
  ══════════════════════════════════════════════════════════════ */

  // Helper: escapa HTML para evitar XSS — definido cedo pois é usado em cardHTML
  function escHTML(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Extrai o @handle puro de qualquer formato de entrada do Instagram:
  // "@usuario", "usuario", "https://instagram.com/usuario", "https://www.instagram.com/usuario?igsh=...", "instagram.com/usuario/"
  function normalizarInstagramHandle(input) {
    let s = String(input || '').trim();
    if (!s) return '';
    // Remove protocolo + domínio (com ou sem www)
    s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
    // Remove qualquer coisa a partir de "?" (query string) ou "#" (hash)
    s = s.split('?')[0].split('#')[0];
    // Remove barra final e qualquer subcaminho extra (ex: /reels, /p/...)
    s = s.split('/')[0];
    // Remove @ inicial
    s = s.replace(/^@/, '').trim();
    return s;
  }

  // Gera slug de URL a partir do nome da loja
  function toSlug(nome) {
    return String(nome || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'');
  }

  let activeCat        = 'todos';
  let searchQuery      = '';
  let activePillFilter = 'all';
  let activeBairro     = '';  // bairro filtrado atualmente

  const BAIRROS_ANGATUBA = [
    // Urbanos
    'Centro', 'Vila Ribeiro', 'Vila Volpi', 'Vila Portela', 'Vila Nova',
    'Vila Salto', 'Vila Parque', 'Vila Maciel', 'Vila Progresso', 'Vila Catanduva',
    'Jardim Domingos dos Santos', 'Jardim Khouri', 'Jardim Monte Santo',
    'Jardim Primavera', 'Jardim Sol Nascente', 'Residencial Palas Atenas',
    'Chácara Santo Antônio',
    // Distritos e Zona Rural
    'Bom Retiro da Esperança', 'Bairro dos Rocinhos', 'Bairro dos Venâncios',
    'Bairro dos Pires', 'Bairro dos Oliveiras', 'Bairro dos Silveiras',
    'Bairro da Lagoa', 'Bairro do Guarei Velho', 'Bairro Chapada',
    'Bairro Palmital', 'Bairro Boa Vista', 'Bairro Campininha',
    'Bairro Faxinal', 'Bairro Morro Azul',
  ];

  // Normalização: remove acentos e lowercase para comparação fuzzy
  function normBairro(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  // Tenta detectar o bairro no display_name do Nominatim
  function detectarBairroDaRua(displayName) {
    const norm = normBairro(displayName);
    return BAIRROS_ANGATUBA.find(b => norm.includes(normBairro(b))) || '';
  }

  /* ── Calcula status pelo horário ─────────────────────────── */
  /* ── calcStatusInfo: retorna { status, fechaStr } ───────────
     fechaStr = hora de fechamento formatada (ex: "23:00") ou ''
  ─────────────────────────────────────────────────────────── */
  function calcStatusInfo(loja) {
    // Override manual do dono da loja (campo statusLoja)
    if (loja.statusLoja === 'ABERTO')   return { status: 'open',   fechaStr: '' };
    if (loja.statusLoja === 'VOLTAMOS') return { status: 'zap',    fechaStr: '' };
    if (loja.statusLoja === 'FECHADO')  return { status: 'closed', fechaStr: '' };

    // Aberto com horário manual: ABERTO_ATE_YYYY-MM-DD_HHMM (ou legado HHMM)
    if ((loja.statusLoja || '').startsWith('ABERTO_ATE_')) {
      const raw  = loja.statusLoja.replace('ABERTO_ATE_', '');
      const now3 = new Date();
      if (raw.includes('_')) {
        // Novo formato: YYYY-MM-DD_HHMM — compara data+hora exata
        const parts = raw.split('_');
        const datePart = parts[0];
        const hhmm2    = parts[1];
        const hh2 = parseInt(hhmm2.substring(0, 2));
        const mm2 = parseInt(hhmm2.substring(2, 4));
        const ateDate = new Date(`${datePart}T${String(hh2).padStart(2,'0')}:${String(mm2).padStart(2,'0')}:00`);
        if (now3 < ateDate) return { status: 'open', fechaStr: `${String(hh2).padStart(2,'0')}:${String(mm2).padStart(2,'0')}` };
      }
      // Formato legado ou expirado — cai no cálculo automático abaixo
    }

    if (!loja.horario) return { status: 'open', fechaStr: '' };

    // Convenção 24h: abre 00:00 e fecha 23:59 (ou abre === fecha em 00:00)
    const is24h = (loja.horario.abre === '00:00' && loja.horario.fecha === '23:59')
               || (loja.horario.abre === '00:00' && loja.horario.fecha === '00:00');
    if (is24h) {
      const hoje = new Date().getDay();
      if (loja.horario.dias.includes(hoje)) return { status: 'open', fechaStr: '24h' };
      return { status: 'closed', fechaStr: '' };
    }

    const now    = new Date();
    const dow    = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // 00:00 como fechamento = meia-noite (1440 min)
    const parse = s => {
      const [h, m] = s.split(':').map(Number);
      return (h === 0 && m === 0) ? 1440 : h * 60 + m;
    };

    const abre     = parse(loja.horario.abre);
    const fecha    = parse(loja.horario.fecha);
    const fechaStr = loja.horario.fecha;

    if (abre === fecha) return { status: 'closed', fechaStr };

    const viraNoite  = fecha < abre;   // ex: abre 22:00 fecha 02:00
    const abreHoje   = loja.horario.dias.includes(dow);
    const abriuOntem = loja.horario.dias.includes((dow + 6) % 7);

    // Caso 1: vira a noite — abriu ontem e ainda não chegou no horário de fechamento
    if (viraNoite && abriuOntem && nowMin < fecha)
      return { status: 'open', fechaStr };

    // Caso 2: não vira a noite — só abre se for hoje E ainda estiver dentro do intervalo
    if (abreHoje) {
      if (!viraNoite)
        return (nowMin >= abre && nowMin < fecha)
          ? { status: 'open',   fechaStr }
          : { status: 'closed', fechaStr: loja.horario.abre };
      // vira a noite e abre hoje: aberto se já passou do horário de abertura
      return nowMin >= abre
        ? { status: 'open',   fechaStr }
        : { status: 'closed', fechaStr: loja.horario.abre };
    }
    return { status: 'closed', fechaStr: loja.horario.abre };
  }

  // Compat: calcStatus continua retornando só a string (usado em vários lugares)
  function calcStatus(loja) { return calcStatusInfo(loja).status; }

  /* ── Badge de status ─────────────────────────────────────── */
  // fechaStr opcional: se fornecido, exibe "Aberto até HH:MM" ou "Abre às HH:MM"
  function badgeHTML(status, fechaStr) {
    if (status === 'open') {
      const label = fechaStr ? `Aberto até ${fechaStr}` : 'Aberto Agora';
      return `<span class="badge badge-open"><span class="badge-dot"></span>${label}</span>`;
    }
    if (status === 'zap') {
      return `<span class="badge badge-zap"><span class="badge-dot"></span>Chamar no Zap</span>`;
    }
    // closed
    const label = fechaStr ? `Abre às ${fechaStr}` : 'Fechado';
    return `<span class="badge badge-closed"><span class="badge-dot"></span>${label}</span>`;
  }

  /* ── Formata telefone para exibição ─────────────────────── */
  function formatTel(num) {
    const d = String(num || '').replace(/\D/g,'');
    // Fix 8: 0800 com 11 dígitos (ex: 08007257333 → 0800 725 7333)
    if (d.length === 11 && d.startsWith('0800')) return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    return num;
  }

  /* ── Escapa aspas em strings usadas em atributos HTML ───────── */
  function escAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Botão de contato ────────────────────────────────────── */
  function contatoHTML(loja, status) {
    const abre     = loja.horario ? loja.horario.abre : '';
    const nomeAttr = escAttr(loja.nome); // Fix 4: escapa aspas para data-attr seguro
    // Campos para métricas — escapados para uso seguro em onclick inline
    const mNome = escAttr(loja.nome);
    const mPlan = escAttr(loja.plano || 'GRATIS');
    const mCat  = escAttr(loja.categoria || '');

    if ((!loja.wpp || loja.wpp === 'PREENCHER') && !loja.tel) {
      return `<button class="btn-wpp disabled" disabled aria-label="Sem contato"><i class="fab fa-whatsapp"></i></button>`;
    }

    if (loja.tel && !loja.wpp) {
      if (status === 'closed') {
        return `<button class="btn-tel closed"
          data-nome="${nomeAttr}" data-abre="${abre}" data-tel="${loja.tel}"
          onclick="showToast(this.dataset.nome,this.dataset.abre,this.dataset.tel)"
          aria-label="Loja fechada"><i class="fa fa-phone"></i></button>`;
      }
      return `<a href="tel:${loja.tel}" class="btn-tel open" aria-label="Ligar"
        onclick="registrarClique('${mNome}','tel','${mPlan}','${mCat}')">
        <i class="fa fa-phone"></i></a>`;
    }

    const msg = encodeURIComponent('Olá, vi no AngatubaON! Está aberto agora?');
    const url = `https://wa.me/${loja.wpp}?text=${msg}`;

    if (status === 'open' || status === 'zap') {
      const cls = status === 'zap' ? 'zap' : 'open';
      return `<a href="${url}" target="_blank" rel="noopener" class="btn-wpp ${cls}" aria-label="WhatsApp"
        onclick="registrarClique('${mNome}','wpp','${mPlan}','${mCat}')">
        <i class="fab fa-whatsapp"></i></a>`;
    }

    return `<button class="btn-wpp closed"
      data-nome="${nomeAttr}" data-abre="${abre}"
      onclick="showToast(this.dataset.nome,this.dataset.abre)"
      aria-label="Loja fechada"><i class="fab fa-whatsapp"></i></button>`;
  }

  /* ── Thumb ───────────────────────────────────────────────── */
  function thumbHTML(loja) {
    const bg    = CAT_BG[loja.categoria] || 'rgba(255,255,255,0.06)';
    const isPro = (loja.plano || '').toUpperCase() === 'PRO';

    // Logo no card: só PRO
    if (isPro && loja.logo && loja.logo.trim()) {
      const alt = loja.logo.replace(/\.(png)$/i, '.jpg').replace(/\.(jpg|jpeg)$/i, '.png');
      return `<div class="store-thumb" style="background:${bg}; overflow:hidden;">
        <img src="${loja.logo}" alt="Logo ${loja.nome}" class="store-logo-img" loading="lazy"
          onerror="if(this.src !== '${alt}'){ this.src='${alt}'; } else { this.style.display='none'; this.parentElement.textContent='${loja.emoji}'; }" />
      </div>`;
    }

    if (!loja.recomendado && loja.foto && loja.foto.trim()) {
      return `<div class="store-thumb" style="background:${bg};">
        <img src="${loja.foto}" alt="${loja.nome}" loading="lazy" />
      </div>`;
    }

    return `<div class="store-thumb" style="background:${bg};">${loja.emoji}</div>`;
  }

  /* ── HTML de um card ─────────────────────────────────────── */
  // statusInfo pode ser string (compat) ou objeto { status, fechaStr }
  function cardHTML(loja, delay, statusInfo, idx) {
    // normaliza entrada: aceita string legada ou objeto novo
    let status, fechaStr;
    if (statusInfo && typeof statusInfo === 'object') {
      status   = statusInfo.status;
      fechaStr = statusInfo.fechaStr || '';
    } else {
      status   = statusInfo ?? calcStatus(loja);
      fechaStr = '';
    }

    const plano  = (loja.plano || 'GRATIS').toUpperCase();
    const isPro  = plano === 'PRO';
    const isPlus = plano === 'PLUS';
    const isPago = isPro || isPlus;

    // Foto de capa apenas no PRO
    const hasCover = isPro && loja.foto && loja.foto.trim();

    // Indicador visual de localização — SEM href para não abrir maps no clique acidental
    // A função de abrir o maps fica apenas dentro do modal de detalhes
    const mapPin = loja.maps
      ? `<span class="contact-tag maps" title="Localização disponível"><i class="fa fa-map-marker-alt"></i> MAPS</span>`
      : '';

    const ctTag = loja.tel && !loja.wpp
      ? `<span class="contact-tag tel">📞 TEL</span>`
      : `<span class="contact-tag wpp">💬 WPP</span>`;

    // Linha de indicadores visuais (mapPin + ctTag) — fica no rodapé do card
    // Posição abaixo de "Ver detalhes" para evitar cliques acidentais ao abrir o card
    const indicadoresFooter = (mapPin || ctTag)
      ? `<div style="display:flex;align-items:center;gap:4px;margin-top:3px;">${mapPin}${ctTag}</div>`
      : '';

    // Selo visual por plano
    let planBadge = '';
    if (isPro)  planBadge = `<span class="plan-badge badge-pro">⭐ PRO</span>`;
    if (isPlus) planBadge = `<span class="plan-badge badge-plus">✦ PLUS</span>`;

    // Classes do card
    let cardClass = 'store-card fade-in';
    if (isPro)    cardClass += ' plano-pro';
    if (isPlus)   cardClass += ' plano-plus';
    if (hasCover) cardClass += ' has-cover';

    const bgStyle = hasCover ? `background-image:url('${loja.foto}');` : '';

    // Todos os cards abrem o modal — pagos com visual completo, grátis simplificado
    const infoClick = `onclick="abrirDetalhes(${idx})" style="cursor:pointer;" role="button" tabindex="0"`;

    // Dica visual: "Ver detalhes" em todos, ícone diferente para grátis
    const expandHint = `<span style="font-size:9px;color:var(--muted);display:flex;align-items:center;gap:3px;margin-top:2px;">
           <i class="fa fa-${isPago ? 'expand-alt' : 'info-circle'}" style="font-size:8px;"></i> Ver detalhes
         </span>`;

    // Badge de anúncio do dia
    // Plus: texto + emoji | Pro: texto + emoji + indicador de foto (se houver)
    const temAnuncioPlus = (isPlus && loja.anuncio && loja.anuncio.texto);
    const temAnuncioPro  = (isPro  && loja.anuncio && loja.anuncio.texto);
    let anuncioBadge = '';
    if (temAnuncioPro) {
      const temFoto = !!loja.anuncio.imagemUrl;
      if (temFoto) {
        // Com foto: texto trunca com ellipsis, "📷 ver foto →" sempre visível à direita
        anuncioBadge = `<div class="store-anuncio-badge" style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            <span>${escHTML(loja.anuncio.emoji || '🎯')}</span> ${escHTML(loja.anuncio.texto)}
          </div>
          <span style="flex-shrink:0;font-size:9px;opacity:.8;white-space:nowrap;">📷 ver foto →</span>
        </div>`;
      } else {
        anuncioBadge = `<div class="store-anuncio-badge"><span>${escHTML(loja.anuncio.emoji || '🎯')}</span> ${escHTML(loja.anuncio.texto)}</div>`;
      }
    } else if (temAnuncioPlus) {
      anuncioBadge = `<div class="store-anuncio-badge"><span>${escHTML(loja.anuncio.emoji || '🎯')}</span> ${escHTML(loja.anuncio.texto)}</div>`;
    }

    // Estrelas de avaliação — linha própria, só quando há avaliações
    let starsHTML = '';
    const avals = loja.avaliacoes;
    if (avals && avals.length > 0) {
      const media = avals.reduce((s, a) => s + (a.nota || 0), 0) / avals.length;
      const mediaFmt = media.toFixed(1);
      // Monta string de estrelas cheias/meia/vazias
      let estrelasStr = '';
      for (let s = 1; s <= 5; s++) {
        if (media >= s - 0.25)      estrelasStr += '★';
        else if (media >= s - 0.75) estrelasStr += '⭑';
        else                        estrelasStr += '☆';
      }
      starsHTML = `<div class="store-stars">
        <span style="color:#f59e0b;letter-spacing:1px;font-size:11px;">${estrelasStr}</span>
        <span style="font-weight:700;font-size:11px;color:#f59e0b;">${mediaFmt}</span>
        <span style="font-size:10px;color:var(--muted);">· ${avals.length} avaliação${avals.length > 1 ? 'ões' : ''}</span>
      </div>`;
    }

    return `
      <div class="${cardClass}"
        data-status="${status}" data-category="${loja.categoria}" data-plano="${plano}"
        style="animation-delay:${delay}s;${bgStyle}">
        ${thumbHTML(loja)}
        <div class="store-info" ${infoClick}>
          <div class="store-name-row">
            <div class="store-name">${escHTML(loja.nome)}</div>
            ${planBadge}
          </div>
          <div class="store-sub">${escHTML(loja.sub)}</div>
          <div class="store-row">${badgeHTML(status, fechaStr)}</div>
          ${starsHTML}
          ${anuncioBadge}
          ${expandHint}
          ${indicadoresFooter}
        </div>
        ${contatoHTML(loja, status)}
      </div>`;
  }

  /* ── Skeleton Loading ───────────────────────────────────── */
  function showSkeleton() {
    const listEl = document.getElementById('store-list');
    listEl.style.display = 'flex';
    listEl.innerHTML = Array(6).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton-thumb"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line xshort"></div>
        </div>
      </div>`).join('');
  }

  function showSkeletonCat() {
    const bar = document.getElementById('cat-bar');
    bar.innerHTML = Array(9).fill(0).map(() => `
      <div class="skeleton-cat">
        <div class="skeleton-cat-icon"></div>
        <div class="skeleton-cat-label"></div>
      </div>`).join('');
  }

  /* ── Cache global de status — compartilhado entre renderLojas e renderCategorias ── */
  // Inicializado como Map vazio; populado por renderLojas a cada ciclo.
  // renderCategorias usa _statusSnapshot.get(l)?.status com fallback para calcStatus,
  // então é seguro mesmo antes do primeiro render.
  let _statusSnapshot = new Map();

  /* ── Renderiza lista principal ───────────────────────────── */
  function renderLojas() {
    const listEl   = document.getElementById('store-list');
    const emptyEl  = document.getElementById('empty-state');
    const titleEl  = document.getElementById('list-title');
    const infoEl   = document.getElementById('filter-info');
    const emptyMsg = document.getElementById('empty-msg');
    const emptySub = document.getElementById('empty-sub');

    const q = searchQuery.toLowerCase().trim();

    // Memoiza calcStatusInfo para este render — cada loja calculada 1x só
    const statusCache = new Map();
    const getStatusInfo = loja => {
      if (!statusCache.has(loja)) statusCache.set(loja, calcStatusInfo(loja));
      return statusCache.get(loja);
    };
    const getStatus = loja => getStatusInfo(loja).status;

    let filtradas = LOJAS.filter(loja => {
      const catOk = activeCat === 'todos' || loja.categoria === activeCat;
      if (!catOk) return false;
      if (!q) return true;
      // Guard: garante que campos string existam antes de chamar .toLowerCase()
      const nome = (loja.nome  || '').toLowerCase();
      const tags = (loja.tags  || '').toLowerCase();
      const sub  = (loja.sub   || '').toLowerCase();
      return nome.includes(q) || tags.includes(q) || sub.includes(q);
    });

    if (activePillFilter === 'open') {
      filtradas = filtradas.filter(l => getStatus(l) === 'open');
    } else if (activePillFilter === 'featured') {
      filtradas = filtradas.filter(l => l.recomendado === true);
    }

    if (activeBairro) {
      const nb = normBairro(activeBairro);
      filtradas = filtradas.filter(l => normBairro(l.bairro).includes(nb) || normBairro(l.endereco).includes(nb));
    }

    // Peso por plano: PRO=0, PLUS=1, GRATIS=2
    const planOrd   = { PRO:0, PLUS:1, GRATIS:2 };
    // Peso por status: open=0, zap=1, closed=2
    const statusOrd = { open:0, zap:1, closed:2 };

    filtradas.sort((a, b) => {
      const planoA = (a.plano || 'GRATIS').toUpperCase();
      const planoB = (b.plano || 'GRATIS').toUpperCase();

      // 1º critério: plano
      const diffPlano = (planOrd[planoA] ?? 2) - (planOrd[planoB] ?? 2);
      if (diffPlano !== 0) return diffPlano;

      // 2º critério: recomendado (true sobe)
      const diffRec = (b.recomendado ? 1 : 0) - (a.recomendado ? 1 : 0);
      if (diffRec !== 0) return diffRec;

      // 3º critério: status (aberto sobe)
      const diffStatus = (statusOrd[getStatus(a)] ?? 2) - (statusOrd[getStatus(b)] ?? 2);
      if (diffStatus !== 0) return diffStatus;

      // 4º critério: ordem alfabética
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    const abertas = filtradas.filter(l => getStatus(l) === 'open').length;

    const frag = document.createDocumentFragment();
    filtradas.forEach((loja, i) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = cardHTML(loja, i * 0.055, getStatusInfo(loja), _lojaIdxMap.get(loja) ?? 0);
      frag.appendChild(wrap.firstElementChild);
    });

    listEl.innerHTML = '';
    listEl.appendChild(frag);

    const temResultado = filtradas.length > 0;
    listEl.style.display = temResultado ? 'flex' : 'none';

    if (!temResultado) {
      emptyEl.style.display = 'block';
      if (LOJAS.length === 0) {
        document.getElementById('empty-icon').textContent = '🏗️';
        emptyMsg.textContent = 'Nenhuma loja cadastrada ainda.';
        emptySub.textContent = 'Seja o primeiro a cadastrar seu negócio!';
      } else {
        document.getElementById('empty-icon').textContent = '🔍';
        emptyMsg.textContent = 'Nenhuma loja encontrada.';
        emptySub.textContent = 'Tente outro termo ou selecione outra categoria.';
      }
    } else {
      emptyEl.style.display = 'none';
    }

    const catLabel = CATEGORIAS.find(c => c.id === activeCat)?.label ?? 'Todas';
    titleEl.textContent = q
      ? `🔍 "${q}"`
      : activeCat === 'todos' ? '📍 Todas as Lojas' : `📍 ${catLabel}`;

    infoEl.textContent = temResultado
      ? (abertas > 0 ? `${abertas} aberta${abertas>1?'s':''} agora` : 'Nenhuma aberta')
      : '';
    infoEl.className = 'filter-info' + (abertas > 0 ? ' has-open' : '');

    // Exporta snapshot para smartRefresh e renderCategorias
    _statusSnapshot = statusCache; // agora guarda { status, fechaStr }
  }

  /* ── Renderiza categorias ────────────────────────────────── */
  function renderCategorias() {
    const bar = document.getElementById('cat-bar');
    const getS = l => (_statusSnapshot.get(l)?.status) ?? calcStatus(l);

    bar.innerHTML = CATEGORIAS
      .filter(cat => {
        if (!cat || !cat.id || !cat.label) return false;
        // "Tudo" sempre aparece
        if (cat.id === 'todos') return true;
        // Só exibe se houver pelo menos 1 loja nessa categoria
        return LOJAS.some(l => l.categoria === cat.id);
      })
      .map(cat => {
        const qtd = cat.id === 'todos'
          ? LOJAS.filter(l => getS(l) === 'open').length
          : LOJAS.filter(l => l.categoria === cat.id && getS(l) === 'open').length;

        const badge    = qtd > 0 ? `<span class="cat-badge visible">${qtd}</span>` : '';
        const isActive = cat.id === activeCat;

        return `
          <button class="cat-item" data-cat="${cat.id}" onclick="setCat('${cat.id}',this)">
            <div class="cat-icon ${isActive?'active':''}" style="background:${cat.bg};">
              <i class="ti ${cat.icon}" style="color:${cat.cor};"></i>
              ${badge}
            </div>
            <span class="cat-label">${cat.label}</span>
          </button>`;
      }).join('');
  }

  /* ── Troca categoria ─────────────────────────────────────── */
  function setCat(cat, btn) {
    activeCat    = cat;
    searchQuery  = '';  // limpa busca ao trocar categoria
    const searchEl = document.getElementById('main-search');
    if (searchEl) searchEl.value = '';

    // Remove active de todos os ícones, marca só o clicado — sem re-renderizar o cat-bar inteiro
    document.querySelectorAll('.cat-icon').forEach(i => i.classList.remove('active'));
    btn.querySelector('.cat-icon').classList.add('active');

    activePillFilter = 'all';
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));

    renderLojas();
  }

  /* ── Toast ───────────────────────────────────────────────── */
  let toastTimer = null;

  function showToast(nomeLoja, horarioAbre, tel) {
    const el    = document.getElementById('toast');
    const title = document.getElementById('toast-title');
    const msg   = document.getElementById('toast-msg');

    title.textContent = `${nomeLoja} — fechado agora`;

    if (tel) {
      msg.innerHTML = horarioAbre
        ? `Abre às ${horarioAbre} · <a href="tel:${tel}" style="color:var(--zap);font-weight:600;">${formatTel(tel)}</a>`
        : `<a href="tel:${tel}" style="color:var(--zap);font-weight:600;">${formatTel(tel)}</a>`;
    } else {
      msg.textContent = horarioAbre
        ? `Atendimento começa às ${horarioAbre}`
        : 'Consulte o horário de funcionamento';
    }

    clearTimeout(toastTimer);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    document.getElementById('toast').classList.remove('show');
    clearTimeout(toastTimer);
  }

  /* ── Tema claro/escuro ───────────────────────────────────────── */
  function aplicarIconeTema() {
    const icon = document.getElementById('theme-toggle-icon');
    if (!icon) return;
    const isLight = document.body.classList.contains('light-mode');
    icon.classList.toggle('fa-moon', !isLight);
    icon.classList.toggle('fa-sun', isLight);
  }

  function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    try { localStorage.setItem('angatuba_theme', isLight ? 'light' : 'dark'); } catch(e) {}
    aplicarIconeTema();
  }
  window.toggleTheme = toggleTheme;

  // Sincroniza o ícone com o tema já aplicado pelo script inline no <body>
  aplicarIconeTema();

  /* ── Métricas de clique ──────────────────────────────────────── */
  // Fire-and-forget: registra na planilha sem bloquear a ação do usuário.
  // Chamado apenas em botões de lojas ABERTAS (wpp/tel ativos).
  function registrarClique(nome, tipo, plano, categoria) {
    const params = new URLSearchParams();
    params.append('payload', JSON.stringify({
      action:    'registrarClique',
      loja:      nome,
      tipo:      tipo,       // 'wpp' ou 'tel'
      plano:     plano,
      categoria: categoria,
    }));
    fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params })
      .catch(() => {}); // falha silenciosa — nunca interrompe o usuário
  }

  /* ── Debounce ────────────────────────────────────────────── */
  function debounce(fn, delay) {
    let t;
    return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this,args), delay); };
  }

  const searchEl = document.getElementById('main-search');

  const handleSearch = debounce(function(e) {
    searchQuery = e.target.value.trim();
    activeCat = 'todos';
    activePillFilter = 'all';
    document.querySelectorAll('.cat-icon').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-cat="todos"] .cat-icon')?.classList.add('active');
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));

    renderLojas();
  }, 300);

  searchEl.addEventListener('input', handleSearch);
  searchEl.addEventListener('search', handleSearch);

  /* ── Modal Cadastro ──────────────────────────────────────── */
  function openModal() {
    // Mostra seletor de planos primeiro
    openPlanModal();
  }

  function openCadastroModal() {
    const overlay = document.getElementById('modal-cadastro');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('modal-cadastro');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Reseta tela de sucesso após fechar (com delay para não piscar)
    setTimeout(() => {
      document.getElementById('cadastro-form').style.display = 'flex';
      document.getElementById('cadastro-success').classList.remove('show');
      document.getElementById('cadastro-success').querySelector('.success-wpp-btn')?.remove();
      document.getElementById('cadastro-form').reset();
      // Garante que o botão de submit está habilitado (pode ter ficado preso se modal foi fechado durante envio)
      const btn = document.querySelector('#cadastro-form .modal-submit');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar Cadastro'; btn.style.opacity = ''; }
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
      // Oculta grupos de foto (só visíveis para planos pagos)
      document.getElementById('foto-group').style.display = 'none';
      document.getElementById('logo-group').style.display = 'none';
      selectedPlan = 'GRATIS';
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
    closePlanModal();
    const hint = document.querySelector('#cadastro-form .field-hint');
    if (hint) {
      const icons = { GRATIS:'🏪', PLUS:'✦', PRO:'⭐' };
      const notas = {
        GRATIS: 'Cadastro gratuito. Entraremos em contato pelo WhatsApp.',
        PLUS:   'Você será contactado via WhatsApp para ativar o plano.',
        PRO:    'Você será contactado via WhatsApp para ativar o plano.',
      };
      hint.innerHTML = `${icons[selectedPlan]} Plano <strong>${selectedPlan}</strong> selecionado · ${notas[selectedPlan]}`;
    }
    const isPago = selectedPlan !== 'GRATIS';
    document.getElementById('foto-group').style.display = isPago ? '' : 'none';
    document.getElementById('logo-group').style.display = isPago ? '' : 'none';
    openCadastroModal();
  }

  // Fecha plan modal ao clicar fora
  document.getElementById('modal-planos').addEventListener('click', function(e) {
    if (e.target === this) closePlanModal();
  });

  /* ── Schedule Builder ───────────────────────────────────── */
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

    function mask(v) {
      const d = v.replace(/\D/g, '').slice(0, 11);
      if (d.length <= 2)  return d;
      if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
      return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    }

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
      ramoInput?.classList.add('invalid');
      setTimeout(() => ramoInput?.classList.remove('invalid'), 2500);
      alert('Selecione o ramo / categoria da loja.');
      return;
    }

    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Enviando...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

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

      // Valida horário
      if (!document.getElementById('f-horario').value) {
        alert('Selecione pelo menos um dia e horário de funcionamento.');
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar Cadastro';
        btn.style.opacity = '';
        btn.disabled = false;
        return;
      }

      const formData = new FormData(this);
      const payload  = Object.fromEntries(formData.entries());
      payload.planoSolicitado = selectedPlan; // envia o plano escolhido

      const params = new URLSearchParams();
      params.append('payload', JSON.stringify(payload));

      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body:   params,
        signal: AbortSignal.timeout(20000),
      });
      const json = await resp.json();
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro no servidor. Tente novamente.');

      this.style.display = 'none';

      // Monta tela de sucesso com botão de WPP para planos pagos
      const successEl = document.getElementById('cadastro-success');
      const nomeLoja  = payload.nome || payload.storeName || 'sua loja';
      const plano     = selectedPlan;
      const isPago    = plano !== 'GRATIS';

      // Troca a coruja animada conforme o plano
      const owlMap = { GRATIS: 'gratis', PLUS: 'plus', PRO: 'pro' };
      const owlEl  = document.getElementById('success-owl');
      if (owlEl) owlEl.src = `/webp/owl-celebrate-${owlMap[plano] || 'gratis'}.webp`;

      if (isPago) {
        const wppMsg = encodeURIComponent(
          `Olá! Acabei de cadastrar *${nomeLoja}* no AngatubaON e escolhi o Plano ${plano}. Gostaria de ativá-lo!`
        );
        const wppUrl = `https://wa.me/${ADMIN_WPP_CONTATO}?text=${wppMsg}`;
        successEl.querySelector('.success-sub').innerHTML =
          `Recebemos os dados da sua loja.<br>` +
          `Agora fale com a gente pelo WhatsApp para ativar o <strong>Plano ${plano}</strong>:`;
        // Adiciona/atualiza botão de WPP dinâmico
        let wppBtn = successEl.querySelector('.success-wpp-btn');
        if (!wppBtn) {
          wppBtn = document.createElement('a');
          wppBtn.className = 'success-wpp-btn';
          wppBtn.target    = '_blank';
          wppBtn.rel       = 'noopener';
          successEl.querySelector('.success-close').before(wppBtn);
        }
        wppBtn.href      = wppUrl;
        wppBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Ativar Plano ' + plano + ' →';
      } else {
        successEl.querySelector('.success-sub').innerHTML =
          `Recebemos os dados da sua loja.<br>Vamos analisar e entrar em contato pelo WhatsApp em breve.`;
        // Remove botão de WPP se existia de cadastro anterior na mesma sessão
        successEl.querySelector('.success-wpp-btn')?.remove();
      }

      successEl.classList.add('show');
    } catch {
      btn.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar Cadastro';
      btn.style.opacity = '';
      btn.disabled = false;
      alert('Erro ao enviar. Verifique sua conexão e tente novamente.');
    }
  });

  /* ══════════════════════════════════════════════════════════════
     SESSÃO DE LOJA — login via WhatsApp + código
  ══════════════════════════════════════════════════════════════ */
  let _lojaToken = localStorage.getItem('angatuba_loja_token') || null;
  let _lojaNome  = localStorage.getItem('angatuba_loja_nome')  || '';
  let _lojaWpp   = ''; // capturado no passo 1 do login

  /* ── Atualiza a bottom nav conforme sessão ───────────────── */
  function atualizarNav() {
    const navLojaBtn      = document.getElementById('nav-loja');
    const navCadastrarBtn = document.getElementById('nav-cadastrar');
    if (!navLojaBtn) return;
    if (_lojaToken) {
      // Logado: Minha Loja em verde, Cadastrar some
      navLojaBtn.innerHTML = `<i class="fa fa-store"></i><span>Minha Loja</span>`;
      navLojaBtn.classList.add('logado');
      navCadastrarBtn?.classList.add('hidden');
    } else {
      // Deslogado: Minha Loja normal, Cadastrar visível
      navLojaBtn.innerHTML = `<i class="fa fa-store"></i><span>Minha Loja</span>`;
      navLojaBtn.classList.remove('logado');
      navCadastrarBtn?.classList.remove('hidden');
    }
  }

  /* ── Bottom nav events ───────────────────────────────────── */
  document.getElementById('nav-inicio').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-inicio').classList.add('active');
    searchEl.value   = '';
    searchQuery      = '';
    activeCat        = 'todos';
    activePillFilter = 'all';
    document.querySelectorAll('.cat-icon').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-cat="todos"] .cat-icon')?.classList.add('active');
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));

    renderLojas();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('nav-buscar').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-buscar').classList.add('active');
    searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => searchEl.focus(), 320);
  });

  document.getElementById('nav-loja').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-loja').classList.add('active');
    if (_lojaToken) {
      abrirMinhaLoja();
    } else {
      openLoginLoja(); // abre direto o login
    }
  });

  document.getElementById('nav-cadastrar').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-cadastrar').classList.add('active');
    openModal(); // abre o seletor de planos → cadastro
  });

  /* ── Modais de login ─────────────────────────────────────── */
  function openLoginLoja() {
    loginStep(1);
    document.getElementById('ll-wpp').value    = '';
    document.getElementById('ll-codigo').value = '';
    document.getElementById('login-loja-title').innerHTML = 'Acessar <span>Minha Loja</span>';
    document.getElementById('login-loja-sub').textContent = 'Digite o WhatsApp cadastrado para receber seu código';
    document.getElementById('modal-login-loja').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('ll-wpp').focus(), 300);
  }

  function closeLoginLoja() {
    document.getElementById('modal-login-loja').classList.remove('open');
    document.body.style.overflow = '';
  }

  document.getElementById('modal-login-loja').addEventListener('click', function(e) {
    if (e.target === this) closeLoginLoja();
  });

  function loginStep(step) {
    document.getElementById('login-step1').style.display = step === 1 ? 'flex' : 'none';
    document.getElementById('login-step2').style.display = step === 2 ? 'flex' : 'none';
  }

  /* ── Passo 1: solicita código ──────────────────────────────── */
  async function lojaRequestCodigo() {
    const wppRaw = document.getElementById('ll-wpp').value.replace(/\D/g,'');
    const wpp = wppRaw.startsWith('55') ? wppRaw : '55' + wppRaw;
    if (wpp.length < 12) {
      alert('Digite o número de WhatsApp completo com DDD.');
      return;
    }
    _lojaWpp = wpp;

    const btn = document.querySelector('#login-step1 .modal-submit');
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Solicitando...';
    btn.disabled = true;

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaRequestCodigo', wpp }));
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', body: params,
        signal: AbortSignal.timeout(15000),
      });
      const json = await resp.json();

      if (json.status === 'ok') {
        loginStep(2);
        document.getElementById('login-loja-sub').textContent = 'Código enviado! Confira seu WhatsApp.';

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
              badgeEl.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
              badgeEl.style.color = '#000';
            } else if (plano === 'PLUS') {
              badgeEl.textContent = '✦ PLUS';
              badgeEl.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
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

        setTimeout(() => document.getElementById('ll-codigo').focus(), 100);
      } else if (json.msg === 'WPP_NAO_ENCONTRADO') {
        alert('Número não encontrado. Verifique se o WhatsApp cadastrado está correto.\n\nSe ainda não tem cadastro, use "Cadastrar" para se registrar.');
      } else if (json.msg === 'LOJA_NAO_APROVADA') {
        alert('Sua loja ainda está pendente de aprovação. Aguarde o contato pelo WhatsApp.');
      } else {
        alert('Erro: ' + (json.msg || 'Tente novamente.'));
      }
    } catch(e) {
      alert('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      btn.innerHTML = '<i class="fab fa-whatsapp"></i> Receber código';
      btn.disabled = false;
    }
  }

  /* ── Passo 2: verifica código ─────────────────────────────── */
  async function lojaVerificarCodigo() {
    const codigo = document.getElementById('ll-codigo').value.trim();
    if (codigo.length !== 6) {
      document.getElementById('login-codigo-hint').textContent = 'O código tem 6 dígitos.';
      return;
    }

    const btn = document.querySelector('#login-step2 .modal-submit');
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaVerificarCodigo', wpp: _lojaWpp, codigo }));
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', body: params,
        signal: AbortSignal.timeout(15000),
      });
      const json = await resp.json();

      if (json.status === 'ok' && json.data.token) {
        _lojaToken = json.data.token;
        _lojaNome  = json.data.nome || '';
        localStorage.setItem('angatuba_loja_token', _lojaToken);
        localStorage.setItem('angatuba_loja_nome',  _lojaNome);
        localStorage.setItem('angatuba_loja_wpp',   _lojaWpp);
        closeLoginLoja();
        atualizarNav();
        abrirMinhaLoja();
      } else if (json.msg === 'CODIGO_INVALIDO') {
        document.getElementById('login-codigo-hint').textContent = '❌ Código inválido ou expirado. Solicite um novo.';
        document.getElementById('ll-codigo').value = '';
      } else {
        alert('Erro: ' + (json.msg || 'Tente novamente.'));
      }
    } catch(e) {
      alert('Erro de conexão. Verifique sua internet.');
    } finally {
      btn.innerHTML = '<i class="fa fa-check"></i> Confirmar código';
      btn.disabled = false;
    }
  }

  /* ── Painel Minha Loja ─────────────────────────────────────── */
  // Aplica dados de lojaDados no painel (usado tanto pelo cache quanto pela API)
  function _aplicarDadosLoja(d, metJson, preservarToggle = false) {
    _lojaNome = d.nome;
    localStorage.setItem('angatuba_loja_nome', _lojaNome);

    document.getElementById('ml-nome').textContent = d.nome;
    document.getElementById('ml-ramo').textContent = d.ramo || '—';

    // ── Hero: foto de capa ────────────────────────────────
    const heroEl    = document.getElementById('ml-hero');
    const heroImgEl = document.getElementById('ml-hero-img');
    const plano     = d.plano || 'GRATIS';
    const isPago    = plano !== 'GRATIS';
    const isPro     = plano === 'PRO';
    const isPlus    = plano === 'PLUS';

    // Usa foto/logo do lojaDados; fallback na lista LOJAS já carregada
    const lojaLocal = LOJAS.find(l => l.nome === d.nome);
    const fotoUrl   = d.foto  || lojaLocal?.foto  || '';
    const logoUrl   = d.logo  || lojaLocal?.logo  || '';

    if (isPago && fotoUrl) {
      if (heroImgEl) { heroImgEl.src = fotoUrl; heroImgEl.style.display = ''; }
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
    const planBadge = document.getElementById('ml-plan-badge');
    if (plano === 'PRO') {
      planBadge.textContent = '⭐ PRO';
      planBadge.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
      planBadge.style.color = '#000';
    } else if (plano === 'PLUS') {
      planBadge.textContent = '✦ PLUS';
      planBadge.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
      planBadge.style.color = '#fff';
    } else {
      planBadge.textContent = 'GRÁTIS';
      planBadge.style.background = 'rgba(122,122,122,0.4)';
      planBadge.style.color = 'rgba(255,255,255,0.7)';
    }

    // ── Instagram da loja ─────────────────────────────────
    const mlIgWrap = document.getElementById('ml-instagram-wrap');
    if (mlIgWrap) {
      mlIgWrap.style.display = '';
      const igHandleAtual = normalizarInstagramHandle(d.instagram);
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
        <div id="ml-ig-status" style="font-size:10px;margin-top:6px;min-height:13px;"></div>`;
    }

    // ── Toggle FazEntrega ─────────────────────────────────
    const mlEntregaWrap = document.getElementById('ml-entrega-wrap');
    if (mlEntregaWrap) {
      const entregaOn = !!d.fazEntrega;
      mlEntregaWrap.innerHTML = `
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;">
          <span style="font-size:12px;color:var(--text);line-height:1.4;">Fazemos entrega</span>
          <div id="ml-entrega-toggle"
            onclick="mlToggleEntrega()"
            data-ativo="${entregaOn ? '1' : '0'}"
            style="flex-shrink:0;width:42px;height:24px;border-radius:12px;
                   background:${entregaOn ? '#10b981' : 'var(--border)'};
                   position:relative;cursor:pointer;transition:background .2s;">
            <div style="position:absolute;top:3px;left:${entregaOn ? '21px' : '3px'};
                        width:18px;height:18px;border-radius:50%;background:#fff;
                        transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3);"
                 id="ml-entrega-thumb"></div>
          </div>
        </label>
        <div id="ml-entrega-status" style="font-size:10px;margin-top:6px;min-height:13px;color:var(--muted);"></div>`;
    }

    // Toggle — só aplica se o dono não interagiu durante carregamento
    if (!preservarToggle) marcarToggle(d.statusLoja || '');

    // CTA upgrade
    const upgradeCta = document.getElementById('ml-upgrade-cta');
    upgradeCta.style.display = (plano === 'GRATIS') ? '' : 'none';
    if (plano === 'GRATIS') {
      const upgradeMsg = encodeURIComponent(`Olá! Sou dono da loja *${d.nome}* no AngatubaON e quero saber mais sobre os planos pagos!`);
      const upgradeUrl = `https://wa.me/${ADMIN_WPP_CONTATO}?text=${upgradeMsg}`;
      document.getElementById('ml-upgrade-link').href = upgradeUrl;
      const lockLink = document.getElementById('ml-lock-upgrade-link');
      if (lockLink) lockLink.href = upgradeUrl;
    }

    // ── Link de compartilhamento (Plus e Pro) ────────────
    const shareSection = document.getElementById('ml-share-section');
    if (shareSection) {
      shareSection.style.display = isPago ? '' : 'none';
      if (isPago) mlMontarCompartilhamento(d.nome);
    }

    // ── Upload de imagens (Plus e Pro) ───────────────────
    const uploadSection = document.getElementById('ml-upload-section');
    if (uploadSection) {
      uploadSection.style.display = isPago ? '' : 'none';
      if (isPago) {
        // Preenche nome/ramo no preview do card
        const nomePreview = document.getElementById('ml-up-nome-preview');
        const ramoPreview = document.getElementById('ml-up-ramo-preview');
        if (nomePreview) nomePreview.textContent = d.nome || '—';
        if (ramoPreview) ramoPreview.textContent = d.categoria || d.ramo || '—';
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

      if (temAnuncio && metJson && metJson.status === 'ok') {
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
    if (metJson && metJson.status === 'ok') {
      const m = metJson.data.metricas || { total:0, wpp:0, tel:0, d7:0, d30:0 };
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
      localStorage.setItem(`angatuba_ultima_visita_${_lojaToken?.slice(-8)}`, Date.now().toString());

      if (isPago) {
        if (lockEl) lockEl.style.display = 'none';
        document.getElementById('ml-m-7d').textContent    = m.d7   ?? 0;
        document.getElementById('ml-m-30d').textContent   = m.d30  ?? 0;
        document.getElementById('ml-m-total').textContent = m.total ?? 0;
        document.getElementById('ml-m-wpp').textContent   = m.wpp  ?? 0;
        document.getElementById('ml-m-tel').textContent   = m.tel  ?? 0;
        if (document.getElementById('ml-m-ig')) document.getElementById('ml-m-ig').textContent = m.ig ?? 0;
      } else {
        document.getElementById('ml-m-7d').textContent    = m.d7   ?? 0;
        document.getElementById('ml-m-30d').textContent   = m.d30  ?? 0;
        document.getElementById('ml-m-total').textContent = m.total ?? 0;
        document.getElementById('ml-m-wpp').textContent   = m.wpp  ?? 0;
        document.getElementById('ml-m-tel').textContent   = m.tel  ?? 0;
        if (document.getElementById('ml-m-ig')) document.getElementById('ml-m-ig').textContent = m.ig ?? 0;
        document.getElementById('ml-lock-total').textContent = m.total ?? 0;
        if (lockEl) lockEl.style.display = '';
      }

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

  async function abrirMinhaLoja() {
    if (!_lojaToken) { openLoginLoja(); return; }

    // ── Limpa cache de anúncio se for uma loja diferente da anterior ──
    const wppSalvo = localStorage.getItem('angatuba_loja_wpp') || '';
    if (_lojaWpp && wppSalvo && wppSalvo !== _lojaWpp) {
      localStorage.removeItem('angatuba_anuncio');
    }

    const overlay = document.getElementById('modal-minha-loja');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

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
    let _painelInteragido = false;
    ['ml-toggle-aberto','ml-toggle-voltamos','ml-toggle-fechado','ml-entrega-toggle'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => { _painelInteragido = true; }, { once: true });
    });
    try {
      // Token via POST — nunca em query string (logs de servidor, histórico do browser)
      const mkParams = action => {
        const p = new URLSearchParams();
        p.append('payload', JSON.stringify({ action, token: _lojaToken }));
        return p;
      };
      const [dadosResp, metResp] = await Promise.all([
        fetch(APPS_SCRIPT_URL, { method: 'POST', body: mkParams('lojaDados'),    signal: AbortSignal.timeout(10000) }),
        fetch(APPS_SCRIPT_URL, { method: 'POST', body: mkParams('lojaMetricas'), signal: AbortSignal.timeout(10000) }),
      ]);

      const dadosJson = await dadosResp.json();
      const metJson   = await metResp.json();

      // Sessão expirada
      if (dadosJson.msg === 'UNAUTHORIZED') {
        lojaLogout(true); return;
      }

      if (dadosJson.status === 'ok') {
        // Salva cache para próxima abertura ser instantânea
        try { localStorage.setItem('angatuba_loja_dados', JSON.stringify(dadosJson.data)); } catch(e) {}

        _aplicarDadosLoja(dadosJson.data, metJson, _painelInteragido);

        // ── Cardápio ─────────────────────────────────────
        await mlCardapioCarregar(dadosJson.data.plano || 'GRATIS');
      }
    } catch(e) {
      console.warn('[MinhaLoja] Erro ao carregar dados:', e.message);
    }
  }

  function fecharMinhaLoja() {
    document.getElementById('modal-minha-loja').classList.remove('open');
    document.body.style.overflow = '';
  }

  document.getElementById('modal-minha-loja').addEventListener('click', function(e) {
    if (e.target === this) fecharMinhaLoja();
  });

  /* ── Toggle de status manual ─────────────────────────────── */
  function marcarToggle(status) {
    document.querySelectorAll('.toggle-status-btn').forEach(btn => {
      const isActive = btn.dataset.status === status;
      btn.style.opacity    = isActive ? '1' : '0.45';
      btn.style.fontWeight = isActive ? '800' : '600';
      btn.style.boxShadow  = isActive ? '0 0 0 2px currentColor inset' : '';
    });
  }

  // Botão "Aberto" — mostra campo de horário opcional antes de confirmar
  function lojaToggleComHorario(status) {
    const wrap = document.getElementById('ml-aberto-ate-wrap');
    if (!wrap) { lojaToggle(status); return; }
    wrap.style.display = '';
    // Pré-preenche com horário atual + 1h como sugestão
    const agora = new Date();
    agora.setHours(agora.getHours() + 1, 0);
    const hh = String(agora.getHours()).padStart(2,'0');
    const mm = '00';
    document.getElementById('ml-aberto-ate-time').value = `${hh}:${mm}`;
    document.getElementById('ml-aberto-ate-time').focus();
  }

  // Confirma "Aberto" com horário personalizado
  async function lojaToggleAberto() {
    const time = document.getElementById('ml-aberto-ate-time')?.value;
    // Inclui data LOCAL para saber quando expirou (formato ABERTO_ATE_YYYY-MM-DD_HHMM)
    // IMPORTANTE: usa getFullYear/Month/Date (local) em vez de toISOString() que retorna UTC
    // Entre 21:00-23:59 BRT, o UTC já é amanhã — causaria status "aberto por 23h"
    const _agora = new Date();
    const hoje = `${_agora.getFullYear()}-${String(_agora.getMonth()+1).padStart(2,'0')}-${String(_agora.getDate()).padStart(2,'0')}`;
    const status = time ? `ABERTO_ATE_${hoje}_${time.replace(':','')}` : 'ABERTO';
    document.getElementById('ml-aberto-ate-wrap').style.display = 'none';
    await lojaToggle(status);
  }

  window.lojaToggleComHorario = lojaToggleComHorario;
  window.lojaToggleAberto     = lojaToggleAberto;

  async function lojaToggle(novoStatus) {
    if (!_lojaToken) return;
    marcarToggle(novoStatus); // feedback imediato
    // Esconde o campo "aberto até" se estiver visível
    const wrap = document.getElementById('ml-aberto-ate-wrap');
    if (wrap) wrap.style.display = 'none';

    // Atualiza cache do localStorage para que próxima abertura mostre status correto
    try {
      const cache = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
      if (cache) { cache.statusLoja = novoStatus; localStorage.setItem('angatuba_loja_dados', JSON.stringify(cache)); }
    } catch(e) {}

    const statusAnterior = document.querySelector('.toggle-status-btn.ativo')?.dataset?.status || '';
    try {
      // Token via POST — nunca em query string (logs de servidor, histórico do browser)
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:     'lojaToggle',
        token:      _lojaToken,
        statusLoja: novoStatus,
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(10000) });
      const json = await resp.json();
      if (json.msg === 'UNAUTHORIZED') { lojaLogout(true); return; }
    } catch(e) {
      console.warn('[lojaToggle] Erro:', e.message);
      // Reverte visual e avisa o dono
      if (statusAnterior) marcarToggle(statusAnterior);
      const errEl = document.getElementById('ml-toggle-erro');
      if (errEl) { errEl.textContent = '❌ Sem conexão. Status não foi salvo.'; setTimeout(() => { errEl.textContent = ''; }, 4000); }
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

    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    if (status) { status.textContent = ''; status.style.color = ''; }

    try {
      // Token via POST — nunca em query string
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:    'lojaAtualizarInstagram',
        token:     _lojaToken,
        instagram: valor,
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(10000) });
      const json = await resp.json();

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
    fecharMinhaLoja();
    atualizarNav();
    if (!silencioso) {
      // Reseta nav para Início
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.getElementById('nav-inicio').classList.add('active');
    }
  }

  // Número do admin para CTAs de WhatsApp — definido em ADMIN_WPP_CONTATO no topo do arquivo

  /* ── Inicializa nav ──────────────────────────────────────── */
  atualizarNav();
  // Se tem token de loja na session, valida silenciosamente ao carregar
  if (_lojaToken) {
    const _validParams = new URLSearchParams();
    _validParams.append('payload', JSON.stringify({ action: 'lojaDados', token: _lojaToken }));
    fetch(APPS_SCRIPT_URL, { method: 'POST', body: _validParams, signal: AbortSignal.timeout(8000) })
      .then(r => r.json())
      .then(j => { if (j.msg === 'UNAUTHORIZED') { _lojaToken = null; localStorage.removeItem('angatuba_loja_token'); atualizarNav(); } })
      .catch(() => {});
  }

  /* ── Pill filter events ──────────────────────────────────── */
  document.querySelectorAll('.pill-btn:not(.pill-bairro-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePillFilter = btn.dataset.filter;
      activeBairro     = '';
      document.getElementById('pill-bairro-label').textContent = 'Perto de mim';
      renderLojas();
    });
  });

  /* ── Chip de bairro ──────────────────────────────────────── */
  (function initBairroFilter() {
    const btn      = document.getElementById('pill-bairro-btn');
    const dropdown = document.getElementById('bairro-dropdown');
    const search   = document.getElementById('bairro-search');
    const list     = document.getElementById('bairro-list');
    const label    = document.getElementById('pill-bairro-label');
    if (!btn) return;

    function renderBairroList(query) {
      const norm = normBairro(query);
      const filtrados = norm
        ? BAIRROS_ANGATUBA.filter(b => normBairro(b).includes(norm))
        : BAIRROS_ANGATUBA;

      list.innerHTML = '';
      if (activeBairro) {
        const limpar = document.createElement('div');
        limpar.className = 'bairro-item bairro-item-clear';
        limpar.textContent = '✕ Limpar filtro';
        limpar.addEventListener('click', () => {
          activeBairro = '';
          label.textContent = 'Perto de mim';
          btn.classList.remove('active');
          dropdown.style.display = 'none';
          search.value = '';
          renderLojas();
        });
        list.appendChild(limpar);
      }

      if (!filtrados.length) {
        list.innerHTML += '<div class="bairro-item bairro-item-empty">Nenhum bairro encontrado</div>';
        return;
      }

      filtrados.forEach(b => {
        const el = document.createElement('div');
        el.className = 'bairro-item' + (normBairro(b) === normBairro(activeBairro) ? ' bairro-item-active' : '');
        el.textContent = b;
        el.addEventListener('click', () => {
          activeBairro = b;
          label.textContent = b;
          document.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          activePillFilter = 'all';
          dropdown.style.display = 'none';
          search.value = '';
          renderLojas();
        });
        list.appendChild(el);
      });
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdown.style.display !== 'none';
      if (open) {
        dropdown.style.display = 'none';
        return;
      }
      // Posiciona o dropdown abaixo do botão usando coordenadas absolutas na viewport
      const rect = btn.getBoundingClientRect();
      dropdown.style.display = 'block';
      dropdown.style.top  = (rect.bottom + 6) + 'px';
      // Garante que não saia da tela pela direita
      const ddW = Math.max(220, btn.offsetWidth);
      let left = rect.left;
      if (left + ddW > window.innerWidth - 8) left = window.innerWidth - ddW - 8;
      dropdown.style.left  = left + 'px';
      dropdown.style.width = ddW + 'px';
      search.value = '';
      renderBairroList('');
      search.focus();
    });

    search.addEventListener('input', () => renderBairroList(search.value));
    search.addEventListener('click', e => e.stopPropagation());
    list.addEventListener('click', e => e.stopPropagation());

    document.addEventListener('click', () => { dropdown.style.display = 'none'; });
  })();

  /* ── Autocomplete de bairro no formulário de cadastro ─────── */
  (function initBairroCadastro() {
    const input    = document.getElementById('f-bairro');
    const dropdown = document.getElementById('bairro-cad-dropdown');
    if (!input || !dropdown) return;

    function posicionarDropdown() {
      const rect = input.getBoundingClientRect();
      const ddH  = Math.min(200, window.innerHeight - rect.bottom - 8);
      dropdown.style.position  = 'fixed';
      dropdown.style.top       = (rect.bottom + 4) + 'px';
      dropdown.style.left      = rect.left + 'px';
      dropdown.style.width     = rect.width + 'px';
      dropdown.style.maxHeight = ddH + 'px';
      dropdown.style.zIndex    = '9100';
    }

    function renderCadList(query) {
      const norm = normBairro(query);
      const filtrados = norm
        ? BAIRROS_ANGATUBA.filter(b => normBairro(b).includes(norm))
        : BAIRROS_ANGATUBA;

      if (!filtrados.length || !query) { dropdown.style.display = 'none'; return; }

      dropdown.innerHTML = filtrados.map(b =>
        `<div class="addr-item" tabindex="0"><i class="fa fa-map-marker-alt"></i><div><div class="addr-item-main">${b}</div></div></div>`
      ).join('');

      dropdown.querySelectorAll('.addr-item').forEach((el, i) => {
        const b = filtrados[i];
        const select = () => { input.value = b; dropdown.style.display = 'none'; };
        el.addEventListener('click', select);
        el.addEventListener('keydown', e => { if (e.key === 'Enter') select(); });
      });

      posicionarDropdown();
      dropdown.style.display = 'block';
    }

    input.addEventListener('input', () => renderCadList(input.value));
    input.addEventListener('focus', () => { if (input.value) renderCadList(input.value); });
    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
    });
  })();

  /* ── Auto-refresh inteligente ───────────────────────────── */
  // Só re-renderiza se algum status mudou, evitando repaints desnecessários
  function smartRefresh() {
    const changed = LOJAS.some(l => calcStatus(l) !== (_statusSnapshot.get(l)?.status ?? ''));
    if (changed) {
      renderLojas();
      renderCategorias();
    }
  }

  // Intervalo de 60s — referência guardada; pausa/resume com visibilidade da aba
  const _smartRefreshInterval = setInterval(smartRefresh, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) smartRefresh(); // refresh imediato ao voltar para a aba
  }, { passive: true });

  /* ── Limpa will-change após animação ─────────────────────── */
  document.addEventListener('animationend', e => {
    if (e.target.classList.contains('fade-in')) e.target.style.willChange = 'auto';
  }, { passive: true });

  /* ── Instalação do PWA (banner customizado) ──────────────── */
  (function () {
    const ADIAR_KEY = 'angatuba_install_adiado_ate';
    let deferredPrompt = null;

    function appJaInstalado() {
      return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true; // iOS (modo "tela de início")
    }

    function podeMostrarBanner() {
      if (appJaInstalado()) return false;
      try {
        const adiadoAte = localStorage.getItem(ADIAR_KEY);
        if (adiadoAte && Date.now() < Number(adiadoAte)) return false;
      } catch (e) {}
      return true;
    }

    function adiarBanner(dias) {
      try {
        localStorage.setItem(ADIAR_KEY, String(Date.now() + dias * 24 * 60 * 60 * 1000));
      } catch (e) {}
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();          // bloqueia o mini-infobar nativo do Chrome
      deferredPrompt = e;
      if (podeMostrarBanner()) _mostrarBannerInstall();
    });

    // iOS/Safari não dispara beforeinstallprompt — exibe instruções manuais
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS && !appJaInstalado() && podeMostrarBanner()) {
      const banner = document.getElementById('pwa-install-banner');
      const btnInstalar = document.getElementById('pwa-install-btn');
      const btnFechar   = document.getElementById('pwa-install-dismiss');
      if (banner && btnInstalar) {
        banner.style.display = 'flex';
        btnInstalar.textContent = '📱 Como instalar no iPhone';
        btnInstalar.onclick = () => {
          banner.style.display = 'none';
          adiarBanner(7);
          alert('Para instalar o AngatubaON:\n\n1️⃣ Toque no botão Compartilhar ⬆️ (barra inferior do Safari)\n2️⃣ Role para baixo e toque em "Adicionar à Tela de Início"\n3️⃣ Confirme tocando em "Adicionar"');
        };
        if (btnFechar) btnFechar.onclick = () => { banner.style.display = 'none'; adiarBanner(7); };
      }
    }

    function _mostrarBannerInstall() {
      const banner = document.getElementById('pwa-install-banner');
      const btnInstalar = document.getElementById('pwa-install-btn');
      const btnFechar = document.getElementById('pwa-install-dismiss');
      if (!banner || !btnInstalar || !btnFechar) return;

      banner.style.display = 'flex';

      btnInstalar.onclick = async () => {
        banner.style.display = 'none';
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'dismissed') adiarBanner(7); // não insiste por 7 dias
      };

      btnFechar.onclick = () => {
        banner.style.display = 'none';
        adiarBanner(7);
      };
    }

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
      try { localStorage.removeItem(ADIAR_KEY); } catch (e) {}
    });
  })();

  /* ── Service Worker ──────────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then(reg => {
          // Verifica se há update a cada 60 segundos
          setInterval(() => { if (!document.hidden) reg.update(); }, 60_000);

          // SW esperando para ativar = há versão nova instalada
          const onUpdateFound = () => {
            const novo = reg.installing || reg.waiting;
            if (!novo) return;
            novo.addEventListener('statechange', () => {
              if (novo.state === 'installed' && navigator.serviceWorker.controller) {
                _mostrarBannerUpdate(novo);
              }
            });
          };

          if (reg.waiting) {
            // Já há update esperando (voltou para a aba após update)
            _mostrarBannerUpdate(reg.waiting);
          }
          reg.addEventListener('updatefound', onUpdateFound);
        })
        .catch(err => console.warn('[SW] Falha no registro:', err));

      // Quando o SW ativa (após skipWaiting), recarrega a página
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; window.location.reload(); }
      });
    });
  }

  function _mostrarBannerUpdate(swWaiting) {
    const banner = document.getElementById('sw-update-banner');
    const btn    = document.getElementById('sw-update-btn');
    if (!banner || !btn) return;
    banner.style.display = 'flex';
    btn.onclick = () => {
      btn.textContent = 'Atualizando...';
      btn.disabled = true;
      swWaiting.postMessage('SKIP_WAITING');
    };
  }

  /* ── Carrega lojas da API (Apps Script → Google Sheets) ─────── */
  const _retryDelays = [8000, 20000, 45000]; // backoff progressivo: 8s, 20s, 45s
  let   _retryCount  = 0;
  let   _retryTimer  = null; // referência para cancelar retry pendente

  async function carregarLojas() {
    try {
      const resp = await fetch(APPS_SCRIPT_URL, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      if (json.status === 'ok' && Array.isArray(json.data) && json.data.length > 0) {
        // Junta lojas da API com as fixas, evitando duplicatas pelo nome
        const nomesApi = new Set(json.data.map(l => l.nome.trim().toLowerCase()));
        const fixasSemDuplicata = LOJAS_FIXAS.filter(l => !nomesApi.has(l.nome.trim().toLowerCase()));
        LOJAS = [...json.data, ...fixasSemDuplicata].map(l => ({
          ...l,
          nome:      l.nome      || '',
          tags:      l.tags      || '',
          sub:       l.sub       || '',
          categoria: l.categoria || 'servicos',
          plano:     (l.plano    || 'GRATIS').toUpperCase(),
          emoji:     l.emoji     || '🏪',
        }));
        // Sucesso: cancela qualquer retry pendente e reseta contador
        if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
        _retryCount = 0;
        _rebuildIdxMap();
        renderLojas();
        renderCategorias();
        _esconderSplash(); // lojas prontas — desvela o app
        // Deep link: abre modal da loja se URL tiver #slug
        (function _checkDeepLink() {
          const hash = location.hash.slice(1);
          if (!hash) return;
          const idx = LOJAS.findIndex(l => toSlug(l.nome) === hash);
          if (idx >= 0) setTimeout(() => abrirDetalhes(idx), 100);
        })();
        console.log('[AngatubaON] ' + json.data.length + ' da API + ' + fixasSemDuplicata.length + ' fixas ✅');
        // Salva snapshot para uso offline (primeiro acesso sem internet mostra dados cacheados)
        try {
          localStorage.setItem('angatuba_lojas_cache', JSON.stringify(LOJAS));
          localStorage.setItem('angatuba_lojas_cache_ts', Date.now().toString());
        } catch(e) {}
      } else {
        console.warn('[AngatubaON] API retornou dados vazios — usando fallback');
        _mostrarErroCarregamento(false);
        _esconderSplash(); // sem dados mas não trava o usuário
      }
    } catch(err) {
      console.warn('[AngatubaON] API indisponível, usando lojas fixas:', err.message);
      _mostrarErroCarregamento(_retryCount < _retryDelays.length);
      _esconderSplash(); // erro de rede — desvela de qualquer forma
      // Retry com backoff progressivo (máx 3 tentativas)
      // Cancela timer anterior antes de agendar novo (evita chamadas duplicadas)
      if (_retryCount < _retryDelays.length) {
        const delay = _retryDelays[_retryCount++];
        console.log(`[AngatubaON] Retry ${_retryCount}/${_retryDelays.length} em ${delay/1000}s...`);
        if (_retryTimer) clearTimeout(_retryTimer);
        _retryTimer = setTimeout(() => { _retryTimer = null; carregarLojas(); }, delay);
      }
    }
  }

  function _mostrarErroCarregamento(vaiRetry) {
    // Tenta usar snapshot cacheado do último acesso com internet (válido por 24h)
    try {
      const cached = localStorage.getItem('angatuba_lojas_cache');
      const ts     = parseInt(localStorage.getItem('angatuba_lojas_cache_ts') || '0');
      if (cached && (Date.now() - ts) < 86_400_000) {
        const lojasCache = JSON.parse(cached);
        if (Array.isArray(lojasCache) && lojasCache.length > 0) {
          LOJAS = lojasCache.map(function(l){return Object.assign({},l,{plano:(l.plano||'GRATIS').toUpperCase(),emoji:l.emoji||'🏪'});});
          _rebuildIdxMap();
          renderLojas();
          renderCategorias();
          return; // não mostra tela de erro
        }
      }
    } catch(e) {}
    if (LOJAS.length > 0) return; // tem fallback fixo, não precisa mostrar erro
    const listEl  = document.getElementById('store-list');
    listEl.innerHTML = '';
    listEl.style.display = 'none';
    const emptyEl = document.getElementById('empty-state');
    emptyEl.style.display = 'block';
    document.getElementById('empty-icon').textContent = '📡';
    document.getElementById('empty-msg').textContent = 'Sem conexão com o servidor.';
    document.getElementById('empty-sub').textContent = vaiRetry
      ? 'Tentando novamente em alguns segundos...'
      : 'Verifique sua conexão e recarregue a página.';
  }

  /* ── Address Autocomplete (Nominatim / OpenStreetMap) ──────── */
  // Gratuito, sem chave de API, limitado a 1 req/s (respeitamos com debounce de 500ms)
  (function initAddressAutocomplete() {
    const inputRua   = document.getElementById('f-endereco-rua');
    const inputNum   = document.getElementById('f-endereco-numero');
    const dropdown   = document.getElementById('addr-suggestions');
    const hiddenEnd  = document.getElementById('f-endereco');   // endereço completo
    const hiddenMaps = document.getElementById('f-maps-url');
    const statusEl   = document.getElementById('maps-status');
    const hintEl     = document.getElementById('maps-hint');

    if (!inputRua) return;

    let debounceTimer = null;
    let currentQuery  = '';
    let ruaSelecionada = ''; // nome curto da rua selecionada (ex: "R. Salvador Rodrigues dos Santos")

    function setStatus(icon, text, color) {
      statusEl.textContent = icon + ' ' + text;
      statusEl.style.color = color || 'var(--muted)';
    }

    function clearMaps() {
      hiddenMaps.value  = '';
      hiddenEnd.value   = '';
      ruaSelecionada    = '';
      statusEl.textContent = '';
      statusEl.style.color = 'var(--muted)';
    }

    // Monta endereço completo e link Maps sempre que rua ou número mudam
    function atualizarEnderecoCompleto() {
      if (!ruaSelecionada) return;
      const num     = inputNum.value.trim();
      const endFull = num ? `${ruaSelecionada}, ${num}` : ruaSelecionada;
      hiddenEnd.value  = endFull;
      // Link do Maps por texto: legível na planilha
      hiddenMaps.value = `https://www.google.com/maps/search/${encodeURIComponent(endFull + ', Angatuba, SP')}`;
    }

    // Extrai o nome curto da rua a partir do display_name do Nominatim
    // Ex: "Rua Salvador Rodrigues dos Santos, Vila Progresso, Angatuba, ..." → "Rua Salvador Rodrigues dos Santos, Vila Progresso"
    function extrairNomeRua(displayName) {
      const parts = displayName.split(', ');
      // Pega até 2 partes (rua + bairro se houver)
      return parts.slice(0, 2).join(', ');
    }

    function buildSuggestionHTML(item) {
      const parts    = item.display_name.split(', ');
      // Mostra só a rua (parte[0]) para não confundir com bairros incorretos do Nominatim
      const ruaPart  = parts[0];
      // Subtítulo: cidade/estado para contexto
      const subPart  = parts.slice(2, 4).join(', ');
      return `
        <div class="addr-item" tabindex="0"
          data-display="${escAttr(item.display_name)}"
          data-rua="${escAttr(ruaPart)}">
          <i class="fa fa-map-marker-alt"></i>
          <div>
            <div class="addr-item-main">${ruaPart}</div>
            ${subPart ? `<div class="addr-item-sub">${subPart}</div>` : ''}
          </div>
        </div>`;
    }

    function showDropdown(items) {
      if (!items.length) {
        dropdown.innerHTML = '<div class="addr-loading">Nenhum endereço encontrado. Tente ser mais específico.</div>';
      } else {
        dropdown.innerHTML = items.map(buildSuggestionHTML).join('');
        dropdown.querySelectorAll('.addr-item').forEach(el => {
          const select = () => {
            ruaSelecionada    = el.dataset.rua;
            inputRua.value    = el.dataset.rua;
            dropdown.style.display = 'none';
            atualizarEnderecoCompleto();
            setStatus('✅', 'Rua confirmada — adicione o número ao lado', 'var(--green)');
            if (hintEl) hintEl.style.display = 'none';
            inputNum.focus();
          };
          el.addEventListener('click',   select);
          el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') select(); });
        });
      }
      dropdown.style.display = 'block';
    }

    async function buscarEnderecos(query) {
      if (query !== currentQuery) return;
      try {
        const url = `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query + ', Angatuba, SP, Brasil')}` +
          `&format=json&limit=5&countrycodes=br&addressdetails=1` +
          `&accept-language=pt-BR`;

        const resp = await fetch(url, {
          headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'AngatubaON/1.0' }
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();

        if (query !== currentQuery) return;

        if (data.length === 0) {
          const url2 = `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query + ', São Paulo, Brasil')}` +
            `&format=json&limit=5&countrycodes=br` +
            `&accept-language=pt-BR`;
          const resp2 = await fetch(url2, {
            headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'AngatubaON/1.0' }
          });
          const data2 = await resp2.json();
          showDropdown(data2);
        } else {
          showDropdown(data);
        }
      } catch (err) {
        dropdown.innerHTML = `<div class="addr-loading">Erro na busca. Verifique sua conexão.</div>`;
        dropdown.style.display = 'block';
        console.warn('[AngatubaON] Nominatim error:', err.message);
      }
    }

    // Digitar na rua → buscar sugestões
    inputRua.addEventListener('input', function() {
      const q = this.value.trim();
      clearMaps();
      clearTimeout(debounceTimer);

      if (q.length < 4) {
        dropdown.style.display = 'none';
        if (hintEl) hintEl.style.display = '';
        return;
      }

      currentQuery = q;
      dropdown.innerHTML = '<div class="addr-loading"><i class="fa fa-spinner fa-spin"></i> Buscando...</div>';
      dropdown.style.display = 'block';
      if (hintEl) hintEl.style.display = 'none';

      debounceTimer = setTimeout(() => buscarEnderecos(q), 500);
    });

    // Digitar número → atualiza endereço completo e link Maps
    inputNum.addEventListener('input', function() {
      atualizarEnderecoCompleto();
    });

    // Fecha dropdown ao clicar fora
    document.addEventListener('click', function(e) {
      if (!inputRua.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Navega entre itens com teclado
    inputRua.addEventListener('keydown', function(e) {
      if (!['ArrowDown','ArrowUp','Escape'].includes(e.key)) return;
      if (e.key === 'Escape') { dropdown.style.display = 'none'; return; }
      const items = [...dropdown.querySelectorAll('.addr-item')];
      if (!items.length) return;
      e.preventDefault();
      const focused = document.activeElement;
      const idx     = items.indexOf(focused);
      if (e.key === 'ArrowDown') (items[idx + 1] || items[0]).focus();
      if (e.key === 'ArrowUp')   (items[idx - 1] || items[items.length - 1]).focus();
    });
  })();

  /* ══════════════════════════════════════════════════════════════
     MODAL DE DETALHES — Planos Pagos (Plus / Pro)
  ══════════════════════════════════════════════════════════════ */

  const DIAS_NOMES_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  // Abre o modal preenchendo dinamicamente o conteúdo.
  // `idx` é o índice da loja no array LOJAS — evita serialização de objetos em onclick inline.
  function abrirDetalhes(idx) {
    const loja = LOJAS[idx];
    if (!loja) return;

    // Back button Android: empurra estado para que voltar feche o modal
    history.pushState({ modal: 'detalhes', idx }, '', '#' + toSlug(loja.nome));

    const overlay = document.getElementById('modal-detalhes');
    const sheet   = document.getElementById('detail-sheet');

    const plano  = (loja.plano || 'GRATIS').toUpperCase();
    const isPro  = plano === 'PRO';
    const isPlus = plano === 'PLUS';
    const isPago = isPro || isPlus;
    const { status, fechaStr } = calcStatusInfo(loja);

    // ── CAPA com logo sobreposto ───────────────────────────────
    const hasFoto = isPago && loja.foto && loja.foto.trim();
    const hasLogo = isPago && loja.logo && loja.logo.trim();

    const logoOverlay = hasLogo
      ? `<div style="position:absolute;bottom:12px;right:14px;z-index:3;
            width:52px;height:52px;border-radius:12px;overflow:hidden;
            border:2px solid rgba(255,255,255,0.2);box-shadow:0 4px 14px rgba(0,0,0,0.5);
            background:var(--surface);">
           <img src="${loja.logo}" style="width:100%;height:100%;object-fit:cover;"
             onerror="this.parentElement.style.display='none'" />
         </div>`
      : '';

    const coverHTML = hasFoto
      ? `<div class="detail-cover-wrap">
           <img class="detail-cover" src="${loja.foto}" alt="Foto ${escAttr(loja.nome)}"
             onerror="this.parentElement.innerHTML = placeholderCover('${escAttr(loja.emoji || '🏪')}', '${escAttr(loja.categoria || '')}');" />
           <div class="detail-top-bar">
             <div class="detail-handle"></div>
             <button class="detail-close" onclick="fecharDetalhes()" aria-label="Fechar">✕</button>
           </div>
           <div class="detail-cover-badge">${badgeHTML(status, fechaStr)}</div>
           ${logoOverlay}
         </div>`
      : isPago
      ? `<div class="detail-cover-wrap">
           <div class="detail-cover-placeholder" style="background:${CAT_BG[loja.categoria] || 'rgba(255,255,255,0.06)'};">
             ${loja.emoji || '🏪'}
           </div>
           <div class="detail-top-bar">
             <div class="detail-handle"></div>
             <button class="detail-close" onclick="fecharDetalhes()" aria-label="Fechar">✕</button>
           </div>
           <div class="detail-cover-badge">${badgeHTML(status, fechaStr)}</div>
         </div>`
      : `<div style="
            position:relative;height:80px;border-radius:20px 20px 0 0;overflow:hidden;
            background:linear-gradient(135deg,${CAT_BG[loja.categoria]||'rgba(99,102,241,0.15)'} 0%,#0d0d0d 100%);
            display:flex;align-items:center;justify-content:space-between;padding:0 16px;flex-shrink:0;">
           <div style="font-size:2.5rem;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.5));">${loja.emoji||'🏪'}</div>
           <div class="detail-handle" style="position:absolute;top:10px;left:50%;transform:translateX(-50%);"></div>
           <button class="detail-close" onclick="fecharDetalhes()" aria-label="Fechar"
             style="position:static;transform:none;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);color:#fff;">✕</button>
         </div>`;

    // ── BADGE DE PLANO — junto com o nome ─────────────────────
    let planBadge = '';
    if (isPro)         planBadge = `<span class="plan-badge badge-pro">⭐ PRO</span>`;
    else if (isPlus)   planBadge = `<span class="plan-badge badge-plus">✦ PLUS</span>`;

    // ── ANÚNCIO DO DIA ────────────────────────────────────────
    const temAnuncioModal = ((isPro || isPlus) && loja.anuncio && loja.anuncio.texto);
    let anuncioHTML = '';
    if (temAnuncioModal) {
      const imgHtml = (isPro && loja.anuncio.imagemUrl)
        ? `<img src="${escAttr(loja.anuncio.imagemUrl)}" alt="Foto do anúncio"
               style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-top:10px;"
               onerror="this.style.display='none'" />`
        : '';
      anuncioHTML = `<div style="
            display:flex;flex-direction:column;gap:0;
            background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.04));
            border:1px solid rgba(245,158,11,0.3);border-radius:10px;
            padding:10px 12px;margin-bottom:14px;">
           <div style="display:flex;align-items:center;gap:10px;">
             <span style="font-size:1.3rem;flex-shrink:0;">${escHTML(loja.anuncio.emoji || '🎯')}</span>
             <span style="font-size:12px;font-weight:600;color:var(--zap);line-height:1.4;">${escHTML(loja.anuncio.texto)}</span>
           </div>
           ${imgHtml}
         </div>`;
    }

    // ── BOTÃO CARDÁPIO ────────────────────────────────────────
    const temCardapio = loja.cardapio && loja.cardapio.length > 0;

    // Label e emoji dinâmico por categoria
    const _cat = (loja.categoria || '').toLowerCase();
    const _cardapioLabel = (() => {
      const _lblMap = {
        'pizzaria':['🍽️','Ver Cardápio'],'lanches':['🍽️','Ver Cardápio'],'restaurante':['🍽️','Ver Cardápio'],
        'carnes':['🍽️','Ver Cardápio'],'sorveteria':['🍽️','Ver Cardápio'],'padaria':['🍽️','Ver Cardápio'],
        'adega':['🛒','Ver Produtos'],'mercado':['🛒','Ver Produtos'],'farmacia':['🛒','Ver Produtos'],
        'pet':['🛒','Ver Produtos'],'calcados':['🛒','Ver Produtos'],'roupas':['🛒','Ver Produtos'],
        'joalheria':['🛒','Ver Produtos'],'informatica':['🛒','Ver Produtos'],'celular':['🛒','Ver Produtos'],
        'papelaria':['🛒','Ver Produtos'],'variedades':['🛒','Ver Produtos'],'moveis':['🛒','Ver Produtos'],
        'construcao':['🛒','Ver Produtos'],'autopecas':['🛒','Ver Produtos'],'agropecuaria':['🛒','Ver Produtos'],
        'barbearia':['✂️','Ver Serviços'],'salao':['💅','Ver Serviços'],'mecanica':['🔧','Ver Serviços'],
        'tattoo':['🎨','Ver Portfólio'],'fotografia':['📸','Ver Portfólio'],
        'clinica':['🩺','Ver Consultas'],'laboratorio':['🧪','Ver Exames'],
        'academia':['💪','Ver Planos'],'seguros':['📋','Ver Planos'],
        'imobiliaria':['🏠','Ver Imóveis'],'viagens':['✈️','Ver Pacotes'],
        'idiomas':['📚','Ver Cursos'],'grafica':['🖨️','Ver Serviços'],
        'advocacia':['⚖️','Ver Serviços'],'contabilidade':['📊','Ver Serviços'],
        'posto':['⛽','Ver Combustíveis'],
      };
      const _lbl = _lblMap[_cat] || ['🔧','Ver Serviços'];
      return { emoji:_lbl[0], label:_lbl[1] };
    })();

    const cardapioBtn = temCardapio
      ? `<button onclick="fecharDetalhes(true);abrirCardapioCliente(${idx});" style="
            width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
            padding:12px;border-radius:12px;margin-bottom:14px;
            background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));
            border:1px solid rgba(16,185,129,0.3);
            color:var(--green);font-family:var(--font-h);font-size:13px;font-weight:800;cursor:pointer;">
           ${_cardapioLabel.emoji} ${_cardapioLabel.label}
           <span style="background:var(--green);color:#000;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px;">
             ${loja.cardapio.length} item${loja.cardapio.length !== 1 ? 's' : ''}
           </span>
         </button>`
      : '';

    // ── ENDEREÇO ─────────────────────────────────────────────
    const enderecoHTML = loja.endereco
      ? `<div class="detail-info-row">
           <div class="detail-info-icon addr"><i class="fa fa-map-marker-alt"></i></div>
           <div class="detail-info-text">
             <span class="detail-info-label">Endereço</span>
             ${escHTML(loja.endereco)}
           </div>
         </div>`
      : '';

    // ── HORÁRIO ESTRUTURADO ───────────────────────────────────
    const horarioHTML = buildHorarioHTML(loja);

    // ── OBS — campo interno (tags de busca), não exibir no modal ──
    const obsHTML = '';

    // ── BOTÕES DE AÇÃO ────────────────────────────────────────
    const { main: actionsMain, ig: actionsIg } = buildActionsHTML(loja, status);

    // ── AVALIAÇÕES ────────────────────────────────────────────
    const avaliacoes = loja.avaliacoes || [];
    const mediaAval  = avaliacoes.length
      ? (avaliacoes.reduce((s, a) => s + (a.nota || 0), 0) / avaliacoes.length).toFixed(1)
      : null;

    const avalHTML = (isPago && avaliacoes.length > 0)
      ? `<div style="margin-bottom:14px;">
           <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
             <span style="font-size:1.4rem;font-weight:800;font-family:var(--font-h);">${mediaAval}</span>
             <div>
               <div style="display:flex;gap:2px;">${[1,2,3,4,5].map(s => {
                 const cor = s <= Math.round(mediaAval) ? '#f59e0b' : 'rgba(255,255,255,0.15)';
                 return `<span style="color:${cor};font-size:14px;">★</span>`;
               }).join('')}</div>
               <div style="font-size:10px;color:var(--muted);">${avaliacoes.length} avaliação${avaliacoes.length>1?'ões':''}</div>
             </div>
           </div>
           ${avaliacoes.slice(0,3).map((a, i) => {
             // Botão sinalizar: só aparece para o dono da loja logado
             const isDono = _lojaToken && _lojaNome === loja.nome;
             const sinalizarBtn = isDono
               ? `<button onclick="avalSinalizar(${idx},${i},'${escAttr(loja.nome)}')" title="Sinalizar para revisão"
                    style="font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer;
                           padding:2px 6px;border-radius:5px;border:1px solid var(--border);flex-shrink:0;">
                    🚩
                  </button>`
               : '';
             return `
             <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;">
               <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">
                 <span style="font-size:12px;font-weight:700;">${escHTML(a.autor || 'Anônimo')}</span>
                 <div style="display:flex;align-items:center;gap:6px;">
                   <span style="font-size:11px;color:#f59e0b;">${'★'.repeat(a.nota || 0)}${'☆'.repeat(5-(a.nota||0))}</span>
                   ${sinalizarBtn}
                 </div>
               </div>
               ${a.texto ? `<p style="font-size:11px;color:var(--muted);margin:0;line-height:1.5;">${escHTML(a.texto)}</p>` : ''}
             </div>
           `}).join('')}
         </div>`
      : '';

    // Formulário de avaliação (todos podem avaliar)
    const avalFormHTML = `
      <div id="aval-form-${idx}" style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
          Avaliar esta loja
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">
          <!-- Estrelas clicáveis -->
          <div style="display:flex;gap:4px;margin-bottom:8px;" id="aval-stars-${idx}">
            ${[1,2,3,4,5].map(s =>
              `<button onclick="avalSetNota(${idx},${s})" data-nota="${s}"
                style="font-size:1.6rem;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.15);
                       transition:color 0.1s;-webkit-tap-highlight-color:transparent;"
                class="aval-star">★</button>`
            ).join('')}
          </div>
          <textarea id="aval-texto-${idx}" maxlength="120" rows="2" placeholder="Conte sua experiência... (opcional)"
            style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;
                   padding:8px 10px;font-size:12px;color:var(--text);resize:none;box-sizing:border-box;
                   font-family:var(--font-b);line-height:1.5;margin-bottom:8px;"></textarea>
          <button onclick="avalEnviar(${idx},'${escAttr(loja.nome)}')"
            style="width:100%;padding:10px;border-radius:8px;
                   background:linear-gradient(135deg,#f59e0b,#d97706);
                   color:#000;font-family:var(--font-h);font-size:13px;font-weight:800;border:none;cursor:pointer;">
            ⭐ Enviar avaliação
          </button>
          <div id="aval-msg-${idx}" style="font-size:11px;text-align:center;margin-top:6px;min-height:16px;"></div>
        </div>
      </div>`;

    // ── MONTA SHEET ──────────────────────────────────────────
    sheet.innerHTML = `
      ${coverHTML}
      <div class="detail-body">
        <div class="detail-name-row">
          <div class="detail-name" id="detail-name-text">${escHTML(loja.nome)}</div>
          ${planBadge}
        </div>
        <div class="detail-sub">${escHTML(loja.sub || loja.categoria || '')}</div>
        ${!isPago ? `<div style="margin-bottom:12px;">${badgeHTML(status, fechaStr)}</div>` : ''}
        ${anuncioHTML}
        ${cardapioBtn}
        <div class="detail-info">
          ${enderecoHTML}
          ${horarioHTML}
          ${obsHTML}
        </div>
        ${avalHTML}
        ${avalFormHTML}
      </div>
      <div class="detail-actions">${actionsMain}</div>
      ${actionsIg ? `<div class="detail-actions" style="padding-top:8px;">${actionsIg}</div>` : ''}
    `;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // Compartilhar loja via Web Share API ou fallback para clipboard
  function detalhesCompartilhar(idx) {
    const loja = LOJAS[idx];
    if (!loja) return;
    const url = `${location.origin}/#${toSlug(loja.nome)}`;

    // Monta texto rico com status e horário
    const { status, fechaStr } = calcStatusInfo(loja);
    const statusTxt = status === 'open'   ? `✅ Aberto agora${fechaStr ? ` até ${fechaStr}` : ''}`
                    : status === 'closed' ? '🔴 Fechado agora'
                    : status === 'zap'    ? '⏰ Já voltamos em breve'
                    : '';
    const anuncioTxt = (loja.anuncio?.texto)
      ? `\n${loja.anuncio.emoji || '🎯'} *Promoção:* ${loja.anuncio.texto}`
      : '';

    const text = `${loja.emoji || '📍'} *${loja.nome}*\n${loja.sub || loja.categoria || ''}${loja.endereco ? `\n📍 ${loja.endereco}` : ''}\n${statusTxt}${anuncioTxt}\n\nVeja no AngatubaON: ${url}`;

    if (navigator.share) {
      navigator.share({ title: loja.nome, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        const t = document.getElementById('toast');
        document.getElementById('toast-title').textContent = 'Link copiado!';
        document.getElementById('toast-msg').textContent   = url;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
      }).catch(() => {});
    }
  }

  function fecharDetalhes(silencioso = false) {
    const overlay = document.getElementById('modal-detalhes');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (silencioso) {
      // Chamado antes de abrir outro modal — limpa o hash sem history.back()
      // para evitar que o popstate feche o próximo modal
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    } else if (history.state?.modal === 'detalhes') {
      history.back();
    } else if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  // Fecha ao clicar no overlay fora do sheet
  document.getElementById('modal-detalhes').addEventListener('click', function(e) {
    if (e.target === this) fecharDetalhes();
  });

  // Fecha com tecla Escape — respeita hierarquia de modais abertos
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modal-cardapio-cliente')?.classList.contains('open')) {
      fecharCardapioCliente(true); return;
    }
    if (document.getElementById('modal-login-loja')?.classList.contains('open')) {
      closeLoginLoja(); return;
    }
    if (document.getElementById('modal-detalhes').classList.contains('open')) {
      fecharDetalhes(); return;
    }
    if (document.getElementById('modal-cadastro').classList.contains('open')) {
      closeModal(); return;
    }
    if (document.getElementById('modal-planos').classList.contains('open')) {
      closePlanModal();
    }
  });

  // Back button Android — fecha o modal correto ao pressionar voltar
  window.addEventListener('popstate', function(e) {
    if (document.getElementById('modal-cardapio-cliente')?.classList.contains('open')) {
      fecharCardapioCliente(); return;
    }
    if (document.getElementById('modal-detalhes').classList.contains('open')) {
      fecharDetalhes(true); return;
    }
  });

  // Placeholder quando foto falha
  function placeholderCover(emoji, categoria) {
    const bg = CAT_BG[categoria] || 'rgba(255,255,255,0.06)';
    return `<div class="detail-cover-placeholder" style="background:${bg};">${emoji}</div>`;
  }

  // Constrói a seção de horários legível (grade de dias)
  function buildHorarioHTML(loja) {
    const txt = loja.horarioTexto || loja.horario_texto || '';

    // Se tem múltiplos turnos (separados por |), renderiza cada um como linha
    if (txt && txt.includes('|')) {
      const hoje = new Date().getDay();
      const DIAS_LABEL_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      const DIAS_IDX = { dom:0, seg:1, ter:2, qua:3, qui:4, sex:5, sáb:6, sab:6 };

      const linhas = txt.split('|').map(parte => {
        parte = parte.trim();
        // formato: "Seg, Ter, Qua, Qui, Sex 08:00-18:00"
        const match = parte.match(/^(.+?)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
        if (!match) return `<div class="detail-schedule-row"><span class="detail-schedule-day">${escHTML(parte)}</span></div>`;
        const diasStr = match[1];
        const horaStr = `${match[2]} – ${match[3]}`;
        // Verifica se hoje está nesse turno
        const diasMencioandos = diasStr.split(',').map(d => {
          const key = d.trim().toLowerCase().slice(0,3);
          return DIAS_IDX[key];
        }).filter(d => d !== undefined);
        const temHoje = diasMencioandos.includes(hoje);
        const hojeLabel = temHoje ? ` <span style="font-size:9px;opacity:0.7;">(hoje)</span>` : '';
        return `<div class="detail-schedule-row${temHoje ? ' today' : ''}">
          <span class="detail-schedule-day">${escHTML(diasStr)}${hojeLabel}</span>
          <span class="detail-schedule-time">${horaStr}</span>
        </div>`;
      }).join('');

      return `<div class="detail-info-row">
        <div class="detail-info-icon clock"><i class="fa fa-clock"></i></div>
        <div class="detail-info-text" style="flex:1;">
          <span class="detail-info-label">Horário de Funcionamento</span>
          <div class="detail-schedule">${linhas}</div>
        </div>
      </div>`;
    }

    if (!loja.horario) {
      if (!txt) return '';
      return `<div class="detail-info-row">
        <div class="detail-info-icon clock"><i class="fa fa-clock"></i></div>
        <div class="detail-info-text">
          <span class="detail-info-label">Horário</span>
          ${escHTML(txt)}
        </div>
      </div>`;
    }

    const { dias, abre, fecha } = loja.horario;
    const hoje   = new Date().getDay();
    const is24h  = abre === '00:00' && fecha === '23:59';
    const horaStr = is24h ? '24 horas' : `${abre} – ${fecha}`;
    const DIAS_ABREV = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    // ── Agrupa dias consecutivos com mesmo status ──────────────
    // Constrói array de segmentos: { label, horario, fechado, temHoje }
    const segmentos = [];
    let i = 0;
    while (i < 7) {
      const aberto = dias.includes(i);
      // Avança enquanto o próximo dia tiver mesmo status
      let j = i + 1;
      while (j < 7 && dias.includes(j) === aberto) j++;

      const diasDoSeg = Array.from({ length: j - i }, (_, k) => i + k);
      const temHoje   = diasDoSeg.includes(hoje);

      // Monta label do segmento
      let label;
      if (diasDoSeg.length === 1) {
        label = DIAS_NOMES_FULL[diasDoSeg[0]];
      } else if (diasDoSeg.length === 2) {
        label = `${DIAS_ABREV[diasDoSeg[0]]} e ${DIAS_ABREV[diasDoSeg[1]]}`;
      } else {
        label = `${DIAS_ABREV[diasDoSeg[0]]}–${DIAS_ABREV[diasDoSeg[diasDoSeg.length - 1]]}`;
      }

      segmentos.push({ label, aberto, temHoje, dias: diasDoSeg });
      i = j;
    }

    // ── Ordena: hoje primeiro, depois abertos, depois fechados ─
    segmentos.sort((a, b) => {
      if (a.temHoje && !b.temHoje) return -1;
      if (!a.temHoje && b.temHoje) return 1;
      if (a.aberto && !b.aberto)   return -1;
      if (!a.aberto && b.aberto)   return 1;
      return 0;
    });

    // ── Gera linhas HTML ───────────────────────────────────────
    const linhas = segmentos.map(seg => {
      const hojeLabel = seg.temHoje
        ? ` <span style="font-size:9px;opacity:0.7;">(hoje)</span>`
        : '';

      if (seg.aberto) {
        return `<div class="detail-schedule-row${seg.temHoje ? ' today' : ''}">
          <span class="detail-schedule-day">${seg.label}${hojeLabel}</span>
          <span class="detail-schedule-time">${horaStr}</span>
        </div>`;
      } else {
        return `<div class="detail-schedule-row day-closed${seg.temHoje ? ' today' : ''}">
          <span class="detail-schedule-day">${seg.label}${hojeLabel}</span>
          <span class="detail-schedule-closed">Fechado</span>
        </div>`;
      }
    });

    return `<div class="detail-info-row">
      <div class="detail-info-icon clock"><i class="fa fa-clock"></i></div>
      <div class="detail-info-text" style="flex:1;">
        <span class="detail-info-label">Horário de Funcionamento</span>
        <div class="detail-schedule">${linhas.join('')}</div>
      </div>
    </div>`;
  }

  // Constrói os botões de ação do modal
  // Retorna { main: html da linha principal, ig: html do botão instagram (linha separada) }
  function buildActionsHTML(loja, status) {
    const mNome = escAttr(loja.nome);
    const mPlan = escAttr(loja.plano || 'GRATIS');
    const mCat  = escAttr(loja.categoria || '');
    const abre  = loja.horario ? loja.horario.abre : '';

    let main = '';
    let ig   = '';

    // Botão WhatsApp
    if (loja.wpp) {
      const msg = encodeURIComponent('Olá, vi no AngatubaON! Está aberto agora?');
      const url = `https://wa.me/${loja.wpp}?text=${msg}`;
      if (status === 'open' || status === 'zap') {
        main += `<a href="${url}" target="_blank" rel="noopener"
          class="detail-btn-wpp"
          onclick="registrarClique('${mNome}','wpp','${mPlan}','${mCat}')">
          <i class="fab fa-whatsapp"></i> WhatsApp
        </a>`;
      } else {
        main += `<button class="detail-btn-wpp closed-wpp"
          onclick="fecharDetalhes(); showToast('${mNome}','${abre}');">
          <i class="fab fa-whatsapp"></i> Fechado agora
        </button>`;
      }
    }

    // Botão Telefone
    if (loja.tel) {
      if (status === 'closed') {
        const abreTel = loja.horario ? loja.horario.abre : '';
        main += `<button class="detail-btn-tel" style="opacity:0.55;"
          onclick="fecharDetalhes(); showToast('${mNome}','${abreTel}','${loja.tel}');">
          <i class="fa fa-phone"></i> Fechado
        </button>`;
      } else {
        main += `<a href="tel:${loja.tel}" class="detail-btn-tel"
          onclick="registrarClique('${mNome}','tel','${mPlan}','${mCat}')">
          <i class="fa fa-phone"></i> Ligar
        </a>`;
      }
    }

    // Botão Mapa — texto visível se não há WhatsApp, ícone se há
    // Fix #24: só insere o href se a URL começa com https:// (evita javascript: ou dados inválidos)
    if (loja.maps && loja.maps.startsWith('https://')) {
      const mapsUrl = escAttr(loja.maps);
      const temContato = loja.wpp || loja.tel;
      main += temContato
        ? `<a href="${mapsUrl}" target="_blank" rel="noopener"
            class="detail-btn-maps" aria-label="Como chegar">
            <i class="fa fa-map-marker-alt"></i>
          </a>`
        : `<a href="${mapsUrl}" target="_blank" rel="noopener"
            class="detail-btn-maps-full" aria-label="Como chegar">
            <i class="fa fa-map-marker-alt"></i> Como chegar
          </a>`;
    }

    // Botão compartilhar — sempre presente
    const _idx = _lojaIdxMap.get(loja) ?? LOJAS.indexOf(loja);
    main += `<button onclick="detalhesCompartilhar(${_idx})"
      class="detail-btn-maps" aria-label="Compartilhar"
      style="background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.25);color:var(--indigo);">
      <i class="fa fa-share-nodes"></i>
    </button>`;

    // Botão Instagram — linha separada
    if (loja.instagram) {
      const igHandle = normalizarInstagramHandle(loja.instagram);
      if (igHandle) {
        const igUrl = `https://instagram.com/${igHandle}`;
        ig = `<a href="${igUrl}" target="_blank" rel="noopener"
          class="detail-btn-ig"
          onclick="registrarClique('${mNome}','ig','${mPlan}','${mCat}')">
          <i class="fab fa-instagram"></i> @${igHandle}
        </a>`;
      }
    }

    return { main, ig };
  }

  /* ══════════════════════════════════════════════════════════════
     UPLOAD DE IMAGENS — proxy via Apps Script
     A chave da ImgBB fica no servidor (Script Properties),
     nunca exposta no JS público.
     Apps Script action: 'uploadImagem' — recebe base64 + mime,
     faz o upload e devolve { status:'ok', url:'https://...' }.
  ══════════════════════════════════════════════════════════════ */

  // Converte File em base64 (sem o prefixo data:...)
  async function _fileToBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result.split(',')[1]);
      r.onerror = () => rej(new Error('Leitura de arquivo falhou'));
      r.readAsDataURL(file);
    });
  }

  // Upload direto para Cloudinary — 2 etapas:
  // 1. Busca assinatura do GAS (chamada leve, sem base64)
  // 2. Envia imagem diretamente do browser para Cloudinary (sem passar pelo GAS)
  // Isso evita o problema de passar megabytes de base64 pelo Apps Script
  async function uploadImagem(file, statusEl) {
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) {
      statusEl.textContent = '❌ Arquivo muito grande (máx 5MB)';
      statusEl.style.color = 'var(--red)';
      return null;
    }

    statusEl.textContent = '⏳ Preparando upload...';
    statusEl.style.color = 'var(--muted)';

    try {
      // Etapa 1: pede assinatura ao GAS (só timestamp, token e folder — sem base64)
      const sigParams = new URLSearchParams();
      sigParams.append('payload', JSON.stringify({
        action: 'cloudinaryAssinar',
        token:  _lojaToken,
      }));
      const sigResp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', body: sigParams,
        signal: AbortSignal.timeout(15000),
      });
      const sigJson = await sigResp.json();
      if (sigJson.status !== 'ok') throw new Error(sigJson.msg || 'Erro ao assinar upload');

      const { cloud, apiKey, timestamp, folder, signature } = sigJson.data;

      // Etapa 2: upload direto do browser para Cloudinary (sem passar pelo GAS)
      statusEl.textContent = '⏳ Enviando imagem...';
      const formData = new FormData();
      formData.append('file',      file);
      formData.append('api_key',   apiKey);
      formData.append('timestamp', timestamp);
      formData.append('folder',    folder);
      formData.append('signature', signature);

      const uploadResp = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
        { method: 'POST', body: formData, signal: AbortSignal.timeout(60000) }
      );
      const uploadJson = await uploadResp.json();

      if (uploadJson.secure_url) {
        statusEl.textContent = '✅ Imagem enviada!';
        statusEl.style.color = 'var(--green)';
        return uploadJson.secure_url;
      } else {
        const msg = uploadJson.error?.message || 'Falha no upload';
        throw new Error(msg);
      }
    } catch (err) {
      statusEl.textContent = '❌ Erro: ' + err.message;
      statusEl.style.color = 'var(--red)';
      return null;
    }
  }

  function initImageUpload(fileInputId, hiddenId, previewImgId, previewWrapId, statusId) {
    const fileInput  = document.getElementById(fileInputId);
    const hiddenUrl  = document.getElementById(hiddenId);
    const previewImg = document.getElementById(previewImgId);
    const statusEl   = document.getElementById(statusId);

    if (!fileInput) return;

    fileInput.addEventListener('change', async function() {
      const file = this.files[0];
      if (!file) return;

      // Preview local imediato no card
      const reader = new FileReader();
      reader.onload = e => {
        if (previewImg) {
          previewImg.src = e.target.result;
          previewImg.style.display = 'block';
          // Esconde placeholder correspondente
          const isLogo = previewImgId === 'logo-preview-img';
          const placeholder = document.getElementById(isLogo ? 'prev-logo-placeholder' : 'prev-capa-placeholder');
          if (placeholder) placeholder.style.display = 'none';
        }
      };
      reader.readAsDataURL(file);

      // Upload real
      const url = await uploadImagem(file, statusEl);
      if (url) hiddenUrl.value = url;
    });
  }

  // Atualiza nome/ramo no preview do card em tempo real
  function initCardPreviewSync() {
    const nomeInput = document.getElementById('f-nome');
    const prevNome  = document.getElementById('prev-nome');
    const prevRamo  = document.getElementById('prev-ramo');

    if (nomeInput && prevNome) {
      nomeInput.addEventListener('input', () => {
        prevNome.textContent = nomeInput.value.trim() || 'Nome da sua loja';
      });
    }

    // Observar mudanças no campo oculto de ramo (preenchido pelo autocomplete)
    const ramoText = document.getElementById('f-ramo-text');
    if (ramoText && prevRamo) {
      ramoText.addEventListener('input', () => {
        prevRamo.textContent = ramoText.value.trim() || 'Ramo / categoria';
      });
    }

    // ── Drag para reposicionar a capa ──────────────────────────
    const capaWrap = document.getElementById('prev-capa-wrap');
    const capaImg  = document.getElementById('foto-preview-img');
    const capaPosEl= document.getElementById('f-foto-pos');
    const dragHint = document.getElementById('prev-capa-drag-hint');

    if (!capaWrap || !capaImg) return;

    let dragging = false;
    let startX = 0, startY = 0;
    // posição atual em % (0–100)
    let posX = 50, posY = 50;

    function applyPos() {
      capaImg.style.objectPosition = `${posX}% ${posY}%`;
      if (capaPosEl) capaPosEl.value = `${posX}% ${posY}%`;
    }

    function onDragStart(clientX, clientY) {
      if (capaImg.style.display === 'none') return; // sem foto
      dragging = true;
      startX = clientX;
      startY = clientY;
      capaWrap.style.cursor = 'grabbing';
      if (dragHint) dragHint.style.display = 'none';
    }

    function onDragMove(clientX, clientY) {
      if (!dragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      startX = clientX;
      startY = clientY;
      // sensibilidade: cada px de movimento = 0.3% de deslocamento
      posX = Math.min(100, Math.max(0, posX - dx * 0.3));
      posY = Math.min(100, Math.max(0, posY - dy * 0.3));
      applyPos();
    }

    function onDragEnd() {
      dragging = false;
      capaWrap.style.cursor = 'grab';
    }

    // Mouse
    capaWrap.addEventListener('mousedown', e => {
      if (e.target.closest('label')) return; // não interfere no botão trocar
      e.preventDefault();
      onDragStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', e => onDragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onDragEnd);

    // Touch
    capaWrap.addEventListener('touchstart', e => {
      if (e.target.closest('label')) return;
      const t = e.touches[0];
      onDragStart(t.clientX, t.clientY);
    }, { passive: true });
    capaWrap.addEventListener('touchmove', e => {
      if (!dragging) return;
      e.preventDefault();
      const t = e.touches[0];
      onDragMove(t.clientX, t.clientY);
    }, { passive: false });
    capaWrap.addEventListener('touchend', onDragEnd);

    // Ativa cursor grab quando há foto
    const observer = new MutationObserver(() => {
      if (capaImg.style.display !== 'none') {
        capaWrap.style.cursor = 'grab';
        if (dragHint) {
          dragHint.style.display = 'block';
          // esconde hint após 3s
          setTimeout(() => { dragHint.style.display = 'none'; }, 3000);
        }
      }
    });
    observer.observe(capaImg, { attributes: true, attributeFilter: ['style'] });
  }
  initCardPreviewSync();

  // Inicializa os dois campos de upload
  initImageUpload('f-foto-file', 'f-foto-url', 'foto-preview-img', null, 'foto-upload-status');
  initImageUpload('f-logo-file', 'f-logo-url', 'logo-preview-img', null, 'logo-upload-status');

  /* ══════════════════════════════════════════════════════════════
     RAMO AUTOCOMPLETE
     Substitui o <select> estático por um combobox com busca em tempo real.
     O campo oculto #f-ramo recebe o slug/valor real enviado ao servidor.
  ══════════════════════════════════════════════════════════════ */
  (function initRamoAutocomplete() {

    /* ── Catálogo completo ──────────────────────────────────── */
    const RAMOS = [
      // ── Alimentação e Bebidas ──────────────────────────────
      { emoji:'🍕', label:'Pizzaria',                        slug:'pizzaria',     grupo:'Alimentação e Bebidas',
        busca:['pizza','pizzaria','pizzaiolo'] },
      { emoji:'🍔', label:'Lanches / Hamburgueria',          slug:'lanches',      grupo:'Alimentação e Bebidas',
        busca:['lanche','hamburger','hamburguer','lanchonete','pastelaria','hot dog','hotdog','sanduiche'] },
      { emoji:'🍽️', label:'Restaurante / Lanchonete',        slug:'restaurante',  grupo:'Alimentação e Bebidas',
        busca:['restaurante','lanchonete','refeicao','refeição','almoço','almoco','jantar','comida','self service','buffet','prato feito'] },
      { emoji:'🍱', label:'Marmitaria / Comida Caseira',          slug:'marmita',      grupo:'Alimentação e Bebidas',
        busca:['marmita','marmitaria','comida caseira','genova','quentinha','rancho','almoço','almoco','quentinha','porção'] },
      { emoji:'🎂', label:'Doceria / Confeitaria',                slug:'doceria',      grupo:'Alimentação e Bebidas',
        busca:['doceria','confeitaria','doce','bolo','brigadeiro','cake','torta','sobremesa','doces finos','bem casado'] },
      { emoji:'🍦', label:'Sorveteria / Açaí',                    slug:'sorveteria',   grupo:'Alimentação e Bebidas',
        busca:['sorvete','sorveteria','acai','açaí','gelato','milkshake','shake'] },
      { emoji:'🥐', label:'Padaria / Pão de Queijo',              slug:'padaria',      grupo:'Alimentação e Bebidas',
        busca:['padaria','panificadora','pao','pão','panificio','padeiro','cafe da manha','café da manhã'] },
      { emoji:'☕', label:'Cafeteria / Café',                     slug:'cafeteria',    grupo:'Alimentação e Bebidas',
        busca:['cafe','café','cafeteria','cappuccino','espresso','coffee','lancheria'] },
      { emoji:'🍣', label:'Culinária Japonesa / Sushi',           slug:'japonesa',     grupo:'Alimentação e Bebidas',
        busca:['japones','japonesa','sushi','temaki','hashi','oriental','yakisoba','lamen','ramen'] },
      { emoji:'🍝', label:'Culinária Italiana / Massas',          slug:'italiana',     grupo:'Alimentação e Bebidas',
        busca:['italiana','massas','massa','macarrao','macarrão','lasanha','nhoque','ravioli','espaguete','pasta'] },
      { emoji:'🥗', label:'Alimentação Saudável / Vegano',        slug:'saudavel',     grupo:'Alimentação e Bebidas',
        busca:['saudavel','saudável','vegano','vegetariano','fit','detox','salada','organico','orgânico','natural'] },
      { emoji:'🍺', label:'Adega / Bebidas',                 slug:'adega',        grupo:'Alimentação e Bebidas',
        busca:['adega','bebida','bar','distribuidora','cerveja','drinks','bebidas'] },
      { emoji:'🥩', label:'Steakhouse / Casa de Carnes',     slug:'carnes',       grupo:'Alimentação e Bebidas',
        busca:['churrascaria','steakhouse','carnes','churrasco','açougue','acougue','grill'] },

      // ── Saúde, Beleza e Bem-Estar ─────────────────────────
      { emoji:'💊', label:'Farmácia / Drogaria',             slug:'farmacia',     grupo:'Saúde, Beleza e Bem-Estar',
        busca:['farmacia','farmácia','drogaria','remedio','medicamento','plantao','droga','drogal'] },
      { emoji:'🩺', label:'Clínica Médica / Odontológica',   slug:'clinica',      grupo:'Saúde, Beleza e Bem-Estar',
        busca:['clinica','clínica','medica','médica','odonto','dentista','consulta','saude','médico','medico'] },
      { emoji:'🧪', label:'Laboratório de Análises',         slug:'laboratorio',  grupo:'Saúde, Beleza e Bem-Estar',
        busca:['laboratorio','laboratório','exame','analise','análise','coleta'] },
      { emoji:'👓', label:'Ótica',                           slug:'otica',        grupo:'Saúde, Beleza e Bem-Estar',
        busca:['otica','ótica','oculista','oculos','óculos','lente','visao'] },
      { emoji:'💈', label:'Barbearia',                       slug:'barbearia',    grupo:'Saúde, Beleza e Bem-Estar',
        busca:['barbearia','barber','barbeiro','corte','barba','cabelo masculino'] },
      { emoji:'💅', label:'Salão de Beleza / Estética',      slug:'salao',        grupo:'Saúde, Beleza e Bem-Estar',
        busca:['salao','salão','beleza','estetica','estética','cabeleireiro','cabelereiro','manicure','sobrancelha','depilacao','depilação','spa'] },
      { emoji:'💪', label:'Academia / Pilates / Yoga',       slug:'academia',     grupo:'Saúde, Beleza e Bem-Estar',
        busca:['academia','pilates','yoga','ginasio','ginásio','musculacao','musculação','crossfit','funcional','fitness'] },
      { emoji:'🩸', label:'Estúdio de Tatuagem / Piercing',  slug:'tattoo',       grupo:'Saúde, Beleza e Bem-Estar',
        busca:['tattoo','tatuagem','piercing','estudio','estúdio','body art'] },

      // ── Automotivo ─────────────────────────────────────────
      { emoji:'⛽', label:'Posto de Combustível',            slug:'posto',        grupo:'Automotivo',
        busca:['posto','gasolina','diesel','combustivel','combustível','etanol','alvim'] },
      { emoji:'🛢️', label:'Gás / Água',                      slug:'gas',          grupo:'Automotivo',
        busca:['gas','gás','agua','água','botijao','botijão','liquigas','ultragaz','glp'] },
      { emoji:'⚙️', label:'Autopeças / Motopeças',           slug:'autopecas',    grupo:'Automotivo',
        busca:['autopecas','autopeças','motopecas','motopeças','peças','pecas','acessorio auto'] },
      { emoji:'🔧', label:'Oficina Mecânica / Auto Elétrica',slug:'mecanica',     grupo:'Automotivo',
        busca:['mecanica','mecânica','oficina','eletrica','elétrica','motor','freio','suspensao','retifica','funilaria','auto center'] },
      { emoji:'🎨', label:'Funilaria e Pintura',             slug:'funilaria',    grupo:'Automotivo',
        busca:['funilaria','funileiro','pintura','lanternagem','lataria'] },
      { emoji:'🛞', label:'Borracharia',                     slug:'borracharia',  grupo:'Automotivo',
        busca:['borracharia','pneu','pneus','borracha','remendo'] },
      { emoji:'🧼', label:'Lava-Rápido',                     slug:'lava-rapido',  grupo:'Automotivo',
        busca:['lava','lavagem','lavajato','autolavagem','limpeza veicular','car wash'] },
      { emoji:'🚲', label:'Bicicletaria',                    slug:'bicicletaria', grupo:'Automotivo',
        busca:['bicicletaria','bicicleta','ciclo','bike','bikes'] },

      // ── Casa e Construção ──────────────────────────────────
      { emoji:'🧱', label:'Material de Construção',          slug:'construcao',   grupo:'Casa e Construção',
        busca:['construção','construcao','material','cimento','ferragem','tijolo','telhado','obra'] },
      { emoji:'🛋️', label:'Móveis e Eletrodomésticos',       slug:'moveis',       grupo:'Casa e Construção',
        busca:['moveis','móveis','eletrodomestico','eletrodoméstico','armario','sofa','cama','geladeira'] },
      { emoji:'🛍️', label:'Loja de Variedades / Utilidades', slug:'variedades',   grupo:'Casa e Construção',
        busca:['variedades','utilidades','bazar','utilidade','descartavel','plastico'] },
      { emoji:'🪟', label:'Vidraçaria / Esquadrias',         slug:'vidracaria',   grupo:'Casa e Construção',
        busca:['vidraçaria','vidracaria','vidro','esquadria','janela','porta','espelho'] },
      { emoji:'🪵', label:'Madeireira',                      slug:'madeireira',   grupo:'Casa e Construção',
        busca:['madeira','madeireira','tabua','tábua','mdf','compensado'] },
      { emoji:'🎨', label:'Loja de Tintas',                  slug:'tintas',       grupo:'Casa e Construção',
        busca:['tinta','tintas','pintura','verniz','tinteiro','imobiliaria tintas'] },
      { emoji:'👨‍🏭', label:'Serralheria',                    slug:'serralheria',  grupo:'Casa e Construção',
        busca:['serralheria','serralheiro','grade','portao','portão','ferro','estrutura metalica'] },
      { emoji:'❄️', label:'Refrigeração e Ar-Condicionado',  slug:'refrigeracao', grupo:'Casa e Construção',
        busca:['refrigeração','refrigeracao','ar-condicionado','ar condicionado','freezer','climatizador'] },
      { emoji:'🛠️', label:'Conserto de Eletrodomésticos',    slug:'consertos',    grupo:'Casa e Construção',
        busca:['conserto','eletrodomestico','eletrodoméstico','reparo','assistencia','assistência','manutencao'] },

      // ── Comércio e Variedades ──────────────────────────────
      { emoji:'🛒', label:'Mercado / Supermercado',          slug:'mercado',      grupo:'Comércio e Variedades',
        busca:['mercado','supermercado','minimercado','mercearia','hortifruti','acougue'] },
      { emoji:'👗', label:'Loja de Roupas / Vestuário',      slug:'roupas',       grupo:'Comércio e Variedades',
        busca:['roupa','roupas','vestuario','vestuário','moda','confeccao','confecção','boutique','moda feminina','moda masculina'] },
      { emoji:'👟', label:'Loja de Calçados',                slug:'calcados',     grupo:'Comércio e Variedades',
        busca:['calcado','calçado','sapato','tenis','tênis','sandalia','bota','sapataria','calcados'] },
      { emoji:'💍', label:'Joalheria e Relojoaria',          slug:'joalheria',    grupo:'Comércio e Variedades',
        busca:['joalheria','joalheiro','joias','relogio','relógio','relojoaria','ouro','prata','alianca'] },
      { emoji:'🧸', label:'Artigos para Festas e Embalagens',slug:'festas',       grupo:'Comércio e Variedades',
        busca:['festa','festas','balao','balão','embalagem','decoracao','decoração','aniversario','brinquedo'] },
      { emoji:'🧵', label:'Armarinho / Aviamentos / Artesanato',slug:'armarinho', grupo:'Comércio e Variedades',
        busca:['armarinho','aviamento','artesanato','la','lã','fios','linhas','tecido','costura','croche'] },
      { emoji:'💐', label:'Floricultura e Paisagismo',       slug:'floricultura', grupo:'Comércio e Variedades',
        busca:['flor','flores','floricultura','paisagismo','plantas','buque','buquê','jardim','orquidea'] },

      // ── Pet e Agropecuária ─────────────────────────────────
      { emoji:'🐾', label:'Pet Shop / Veterinário',          slug:'pet',          grupo:'Pet e Agropecuária',
        busca:['pet','petshop','veterinario','veterinário','animal','racao','ração','banho','tosa','caes','gatos'] },
      { emoji:'🌾', label:'Agropecuária / Casa de Rações',   slug:'agropecuaria', grupo:'Pet e Agropecuária',
        busca:['agropecuaria','agropecuária','racoes','rações','agro','rural','casa rural','semente'] },
      { emoji:'🚜', label:'Insumos Agrícolas e Ferramentas', slug:'insumos',      grupo:'Pet e Agropecuária',
        busca:['insumo','agricola','agrícola','ferramenta','adubo','fertilizante','defensivo','trator','irrigacao'] },

      // ── Tecnologia e Serviços ──────────────────────────────
      { emoji:'📚', label:'Papelaria e Bazar',               slug:'papelaria',    grupo:'Tecnologia e Serviços',
        busca:['papelaria','bazar','livraria','caderno','caneta','escolar','material escolar'] },
      { emoji:'💻', label:'Informática e Assistência Técnica',slug:'informatica', grupo:'Tecnologia e Serviços',
        busca:['informatica','informática','computador','notebook','assistencia','suporte','hardware','software','ti','impressora'] },
      { emoji:'📱', label:'Loja de Celular e Acessórios',    slug:'celular',      grupo:'Tecnologia e Serviços',
        busca:['celular','smartphone','acessorio','acessório','capinha','carregador','mobile'] },
      { emoji:'🖨️', label:'Gráfica / Comunicação Visual',    slug:'grafica',      grupo:'Tecnologia e Serviços',
        busca:['grafica','gráfica','comunicação visual','banner','adesivo','impressao','impressão','plotagem','serigrafia'] },
      { emoji:'🏢', label:'Imobiliária',                     slug:'imobiliaria',  grupo:'Tecnologia e Serviços',
        busca:['imobiliaria','imobiliária','aluguel','venda','imoveis','imóveis','corretor','corretora'] },
      { emoji:'⚖️', label:'Escritório de Advocacia',         slug:'advocacia',    grupo:'Tecnologia e Serviços',
        busca:['advocacia','advogado','juridico','jurídico','direito','escritorio juridico'] },
      { emoji:'📊', label:'Escritório de Contabilidade',     slug:'contabilidade',grupo:'Tecnologia e Serviços',
        busca:['contabilidade','contador','contabil','contábil','fiscal','tributario','imposto','irpf'] },
      { emoji:'📸', label:'Estúdio de Fotografia / Filmagem',slug:'fotografia',   grupo:'Tecnologia e Serviços',
        busca:['fotografia','filmagem','estudio','estúdio','fotografo','fotógrafo','video','vídeo','foto','drone'] },
      { emoji:'✈️', label:'Agência de Viagens e Turismo',    slug:'viagens',      grupo:'Tecnologia e Serviços',
        busca:['viagem','viagens','turismo','agencia','agência','passagem','hotel','pacote','turista'] },

      // ── Educação e Finanças ────────────────────────────────
      { emoji:'🏦', label:'Agência Bancária / Lotérica',     slug:'bancario',     grupo:'Educação e Finanças',
        busca:['banco','bancaria','bancária','loterica','lotérica','loteria','financeiro','atm','caixa economica'] },
      { emoji:'🛡️', label:'Escritório de Seguros',           slug:'seguros',      grupo:'Educação e Finanças',
        busca:['seguro','seguros','corretora','apolice','apólice','plano de saude','previdencia'] },
      { emoji:'🗣️', label:'Escola de Idiomas / Cursos',      slug:'idiomas',      grupo:'Educação e Finanças',
        busca:['idioma','idiomas','ingles','inglês','curso','escola','ensino','educacao','educação','capacitacao'] },
      { emoji:'🚗', label:'Autoescola (CFC)',                 slug:'autoescola',   grupo:'Educação e Finanças',
        busca:['autoescola','cfc','habilitacao','habilitação','cnh','motorista','primeira habilitacao'] },
    ];

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
          <span class="ramo-opt-label">Usar <mark>${qRaw}</mark> como ramo</span>
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
    };

  })(); // ── fim initRamoAutocomplete ──────────────────────────

  /* ── INIT ────────────────────────────────────────────────── */
  // Mostra skeletons enquanto API carrega
  showSkeleton();
  showSkeletonCat();

  // Carrega lojas dinâmicas em background
  carregarLojas().then(() => {
    // Deep link: abre detalhes de loja pelo hash da URL (ex: /#mr-centro-automotivo)
    _resolverDeepLink();
  });

  /* ══════════════════════════════════════════════════════════════
     DEEP LINK — /#slug-da-loja
  ══════════════════════════════════════════════════════════════ */
  function _resolverDeepLink() {
    // Não abre modal de detalhes se outro modal já está aberto
    const modaisAbertos = ['modal-cadastro','modal-planos','modal-login-loja','modal-minha-loja','modal-detalhes'];
    if (modaisAbertos.some(id => document.getElementById(id)?.classList.contains('open'))) return;

    const hash = (location.hash || '').replace('#','').trim();
    if (!hash) return;
    const loja = LOJAS.find(l => toSlug(l.nome) === hash);
    if (!loja) return;
    const idx = _lojaIdxMap.get(loja);
    if (idx != null) {
      // Pequeno delay para garantir que o DOM está pronto
      setTimeout(() => abrirDetalhes(idx), 200);
    }
  }

  // Também resolve ao navegar pelo histórico (botão voltar/avançar)
  window.addEventListener('hashchange', _resolverDeepLink);

  // Back button Android no PWA — fecha o modal ativo em vez de sair do app
  window.addEventListener('popstate', function() {
    // Fecha modal de detalhes se aberto
    if (document.getElementById('modal-detalhes')?.classList.contains('open')) {
      const overlay = document.getElementById('modal-detalhes');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    // Fecha cardápio cliente se aberto (usuário abriu pelo botão Ver Cardápio)
    if (document.getElementById('modal-cardapio-cliente')?.classList.contains('open')) {
      fecharCardapioCliente(); return;
    }
    // Fecha painel Minha Loja
    if (document.getElementById('modal-minha-loja')?.classList.contains('open')) {
      fecharMinhaLoja(); return;
    }
    // Fecha modal de cadastro
    if (document.getElementById('modal-cadastro')?.classList.contains('open')) {
      closeModal(); return;
    }
  });

  /* ══════════════════════════════════════════════════════════════
     COMPARTILHAMENTO — painel Minha Loja
  ══════════════════════════════════════════════════════════════ */
  window.mlCopiarLink = function() {
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

  function mlMontarCompartilhamento(nome) {
    const slug    = toSlug(nome);
    const url     = `${location.origin}/#${slug}`;
    const urlEl   = document.getElementById('ml-share-url');
    const wppEl   = document.getElementById('ml-share-wpp');
    const igEl    = document.getElementById('ml-share-ig');
    if (urlEl) urlEl.textContent = url;
    if (wppEl) wppEl.href = `https://wa.me/?text=${encodeURIComponent(`Confira ${nome} no AngatubaON! 📍\n${url}`)}`;
    // Usa o handle do Instagram da loja (se disponível), senão abre o app
    if (igEl) {
      const lojaLocal = LOJAS.find(l => l.nome === nome);
      const igHandle  = lojaLocal ? normalizarInstagramHandle(lojaLocal.instagram || '') : '';
      igEl.href = igHandle ? `https://www.instagram.com/${igHandle}` : `https://www.instagram.com/`;
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
        destaqueEl.innerHTML = `🔥 Pico às <strong style="color:#f59e0b;">${fmt(idxPico)}–${fmt(idxPico+1)}</strong> · ${pico[idxPico]} clique${pico[idxPico]>1?'s':''}`;
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
      // Ativa drag sem mostrar hint (foto já existia, não é nova)
      mlInitCapaDrag(false);
    }
  }

  // Inicializa drag de reposicionamento da capa no painel (chamado após foto ser exibida)
  let _mlCapaDragInited = false;
  function mlInitCapaDrag(mostrarHint) {
    const capaWrap = document.getElementById('ml-up-capa-wrap');
    const capaImg  = document.getElementById('ml-up-foto-preview');
    const dragHint = document.getElementById('ml-up-capa-drag-hint');
    if (!capaWrap || !capaImg) return;

    // Atualiza cursor se já há foto
    if (capaImg.style.display !== 'none') {
      capaWrap.style.cursor = 'grab';
      if (mostrarHint && dragHint) {
        dragHint.style.display = 'block';
        setTimeout(() => { dragHint.style.display = 'none'; }, 3000);
      }
    }

    if (_mlCapaDragInited) return;
    _mlCapaDragInited = true;

    let dragging = false;
    let startX = 0, startY = 0;
    let posX = 50, posY = 50;

    function applyPos() {
      capaImg.style.objectPosition = `${posX}% ${posY}%`;
      // Replica no hero do painel para feedback em tempo real
      const heroImg = document.getElementById('ml-hero-img');
      if (heroImg) heroImg.style.objectPosition = `${posX}% ${posY}%`;
    }

    function onStart(cx, cy) {
      if (capaImg.style.display === 'none') return;
      dragging = true; startX = cx; startY = cy;
      capaWrap.style.cursor = 'grabbing';
      if (dragHint) dragHint.style.display = 'none';
    }
    function onMove(cx, cy) {
      if (!dragging) return;
      posX = Math.min(100, Math.max(0, posX - (cx - startX) * 0.3));
      posY = Math.min(100, Math.max(0, posY - (cy - startY) * 0.3));
      startX = cx; startY = cy;
      applyPos();
    }
    function onEnd() { dragging = false; capaWrap.style.cursor = capaImg.style.display !== 'none' ? 'grab' : 'default'; }

    capaWrap.addEventListener('mousedown', e => { if (!e.target.closest('label')) { e.preventDefault(); onStart(e.clientX, e.clientY); } });
    window.addEventListener('mousemove',  e => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup',    onEnd);
    capaWrap.addEventListener('touchstart', e => { if (!e.target.closest('label')) { const t=e.touches[0]; onStart(t.clientX, t.clientY); } }, { passive: true });
    capaWrap.addEventListener('touchmove',  e => { if (!dragging) return; e.preventDefault(); const t=e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: false });
    capaWrap.addEventListener('touchend', onEnd);
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
        mlInitCapaDrag(true); // foto nova — mostrar hint
      }
    };
    reader.readAsDataURL(file);

    if (file.size > 5 * 1024 * 1024) {
      statusEl.textContent = '❌ Máx 5MB';
      statusEl.style.color = 'var(--red)';
      return;
    }

    statusEl.textContent = '⏳ Enviando...';
    statusEl.style.color = 'var(--muted)';

    try {
      const url = await uploadImagem(file, statusEl);
      if (!url) return; // uploadImagem já exibiu erro no statusEl

      // Salva URL na planilha
      const campo = tipo === 'logo' ? 'logoUrl' : 'fotoUrl';
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'lojaAtualizarImagem',
        token:  _lojaToken,
        campo,
        url,
      }));
      const saveResp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(10000) });
      const saveJson = await saveResp.json();
      if (saveJson.status !== 'ok') throw new Error(saveJson.msg || 'Erro ao salvar');

      // Atualiza hero/logo no painel imediatamente
      if (tipo === 'foto') {
        const heroImg = document.getElementById('ml-hero-img');
        if (heroImg) { heroImg.src = url; heroImg.style.display = ''; }
        // Reseta o drag para usar a nova imagem do zero
        _mlCapaDragInited = false;
        mlInitCapaDrag(true);
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
      statusEl.textContent = '❌ ' + e.message;
      statusEl.style.color = 'var(--red)';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     ANÚNCIO DO DIA — painel Minha Loja
  ══════════════════════════════════════════════════════════════ */
  let _anuncioEmojiSelecionado = '🎯';
  let _anuncioImagemUrl = ''; // URL final após upload (Pro)

  function mlAnuncioPreviewImagem(input) {
    const file = input.files[0];
    if (!file) return;
    const imgNova   = document.getElementById('ml-anuncio-img-nova');
    const labelTxt  = document.getElementById('ml-anuncio-img-label-txt');
    const removerBtn= document.getElementById('ml-anuncio-img-remover');
    const statusEl  = document.getElementById('ml-anuncio-img-status');
    const reader = new FileReader();
    reader.onload = e => {
      if (imgNova) { imgNova.src = e.target.result; imgNova.style.display = ''; }
      if (labelTxt) labelTxt.textContent = file.name;
      if (removerBtn) removerBtn.style.display = '';
      if (statusEl) statusEl.textContent = '';
    };
    reader.readAsDataURL(file);
    _anuncioImagemUrl = ''; // Resetar URL — será gerado no publicar
  }

  function mlAnuncioRemoverImagem() {
    _anuncioImagemUrl = '';
    const imgNova   = document.getElementById('ml-anuncio-img-nova');
    const labelTxt  = document.getElementById('ml-anuncio-img-label-txt');
    const removerBtn= document.getElementById('ml-anuncio-img-remover');
    const statusEl  = document.getElementById('ml-anuncio-img-status');
    const input     = document.getElementById('ml-anuncio-img-input');
    if (imgNova)    { imgNova.src = ''; imgNova.style.display = 'none'; }
    if (labelTxt)   labelTxt.textContent = 'Toque para escolher uma foto';
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
    if (!anuncio || !anuncio.texto) return;
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
    document.getElementById('ml-anuncio-texto-preview').textContent = anuncio.texto;

    // Imagem do anúncio (só Pro)
    const imgPreview = document.getElementById('ml-anuncio-img-preview');
    if (imgPreview) {
      if (anuncio.imagemUrl) {
        imgPreview.src = anuncio.imagemUrl;
        imgPreview.style.display = '';
      } else {
        imgPreview.style.display = 'none';
      }
    }

    // Timer de expiração
    const timerEl = document.getElementById('ml-anuncio-timer');
    if (timerEl && anuncio.expira) {
      const restante = new Date(anuncio.expira) - new Date();
      if (restante > 0) {
        const h = Math.floor(restante / 3600000);
        const m = Math.floor((restante % 3600000) / 60000);
        timerEl.textContent = `Expira em ${h}h ${m}m`;
      } else {
        timerEl.textContent = 'Expirado';
        ativoEl.style.display = 'none';
        localStorage.removeItem('angatuba_anuncio');
        return;
      }
    }

    // Oculta o formulário enquanto há anúncio ativo
    const formEl = document.getElementById('ml-anuncio-form');
    if (formEl) formEl.style.display = 'none';

    // Guarda dados no form para caso o usuário remova e queira reeditar
    const textarea = document.getElementById('ml-anuncio-texto');
    if (textarea) {
      textarea.value = anuncio.texto;
      document.getElementById('ml-anuncio-chars').textContent = `${anuncio.texto.length}/80`;
    }
    const emojiBtn = document.querySelector(`.anuncio-emoji-btn[data-emoji="${anuncio.emoji}"]`);
    if (emojiBtn) mlSelectEmoji(emojiBtn);

    // Guarda URL da imagem atual para caso o usuário reedite
    if (anuncio.imagemUrl) {
      _anuncioImagemUrl = anuncio.imagemUrl;
      const imgNova    = document.getElementById('ml-anuncio-img-nova');
      const labelTxt   = document.getElementById('ml-anuncio-img-label-txt');
      const removerBtn = document.getElementById('ml-anuncio-img-remover');
      if (imgNova)    { imgNova.src = anuncio.imagemUrl; imgNova.style.display = ''; }
      if (labelTxt)   labelTxt.textContent = 'Foto atual (toque para trocar)';
      if (removerBtn) removerBtn.style.display = '';
    }
  }

  async function mlPublicarAnuncio() {
    const texto = document.getElementById('ml-anuncio-texto')?.value.trim();
    if (!texto) { alert('Escreva o texto do anúncio.'); return; }

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
        if (imgFile.size > 5 * 1024 * 1024) {
          alert('❌ Imagem do anúncio muito grande (máx 5MB). Reduza a resolução e tente de novo.');
          btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
          btn.disabled = false;
          return;
        }
        if (statusEl) { statusEl.textContent = '📤 Enviando foto...'; statusEl.style.color = 'var(--muted)'; }
        // Upload via proxy — chave ImgBB nunca exposta no JS
        const uploadedUrl = await uploadImagem(imgFile, statusEl || { textContent: '', style: {} });
        if (uploadedUrl) {
          imagemUrl = uploadedUrl;
          _anuncioImagemUrl = imagemUrl;
        } else {
          // uploadImagem já exibiu o erro no statusEl
          btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
          btn.disabled = false;
          return;
        }
      }

      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:    'lojaPublicarAnuncio',
        token:     _lojaToken,
        emoji:     _anuncioEmojiSelecionado,
        texto,
        imagemUrl: imagemUrl || '',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();

      if (json.status === 'ok') {
        mlExibirAnuncioAtivo({ emoji: _anuncioEmojiSelecionado, texto, expira: json.data?.expira, imagemUrl: imagemUrl || '' });
        // form já foi ocultado por mlExibirAnuncioAtivo; reabilita btn para quando reaparecer
        btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
        btn.disabled = false;
      } else {
        throw new Error(json.msg || 'Erro');
      }
    } catch(e) {
      alert('Erro ao publicar: ' + e.message);
      btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
      btn.disabled = false;
    }
  }

  async function mlRemoverAnuncio() {
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaRemoverAnuncio', token:_lojaToken }));
      await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(10000) });
      document.getElementById('ml-anuncio-ativo').style.display = 'none';
      document.getElementById('ml-anuncio-timer').textContent = '';
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
    }
  }

  /* ══════════════════════════════════════════════════════════════
     AVALIAÇÕES
  ══════════════════════════════════════════════════════════════ */
  let _avalNota = {};

  // Dono sinaliza avaliação para revisão
  window.avalSinalizar = async function(lojaIdx, avalIdx, nomeLoja) {
    if (!confirm('Sinalizar esta avaliação para revisão? Ela ficará oculta até ser analisada.')) return;
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'lojaSinalizarAvaliacao',
        token:  _lojaToken,
        idx:    avalIdx,
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(10000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        alert('Avaliação sinalizada! Será revisada em breve.');
        // Remove da lista local e reabre detalhes
        if (LOJAS[lojaIdx].avaliacoes) {
          LOJAS[lojaIdx].avaliacoes.splice(avalIdx, 1);
        }
        abrirDetalhes(lojaIdx);
      } else throw new Error(json.msg);
    } catch(e) {
      alert('Erro ao sinalizar: ' + e.message);
    }
  };

  window.avalSetNota = function(idx, nota) {
    _avalNota[idx] = nota;
    const stars = document.querySelectorAll(`#aval-stars-${idx} .aval-star`);
    stars.forEach((s, i) => {
      s.style.color = i < nota ? '#f59e0b' : 'rgba(255,255,255,0.15)';
    });
  };

  window.avalEnviar = async function(idx, nome) {
    const avalBtn = document.querySelector(`#aval-form-${idx} button[onclick*="avalEnviar"]`);
    if (avalBtn?.disabled) return;
    const nota  = _avalNota[idx];
    if (!nota || nota < 1) {
      const msgEl = document.getElementById(`aval-msg-${idx}`);
      if (msgEl) msgEl.textContent = '\u2b50 Selecione uma nota antes de enviar.';
      return;
    }
    if (avalBtn) avalBtn.disabled = true;
    const texto = document.getElementById(`aval-texto-${idx}`)?.value.trim() || '';
    const msgEl = document.getElementById(`aval-msg-${idx}`);

    if (!nota) {
      if (avalBtn) avalBtn.disabled = false;
      if (msgEl) { msgEl.textContent = 'Selecione uma nota de 1 a 5 ⭐'; msgEl.style.color = 'var(--red)'; }
      return;
    }

    // Bloqueia dono avaliando a própria loja
    if (_lojaToken && _lojaNome === nome) {
      if (msgEl) { msgEl.textContent = '❌ Você não pode avaliar sua própria loja.'; msgEl.style.color = 'var(--red)'; }
      return;
    }

    // Verifica se já avaliou esse loja (localStorage)
    const chave = `aval_${toSlug(nome)}`;
    if (localStorage.getItem(chave)) {
      if (msgEl) { msgEl.textContent = 'Você já avaliou esta loja!'; msgEl.style.color = 'var(--muted)'; }
      return;
    }

    if (msgEl) { msgEl.textContent = '⏳ Enviando...'; msgEl.style.color = 'var(--muted)'; }

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'registrarAvaliacao',
        loja:   nome,
        nota,
        texto,
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();

      if (json.status === 'ok') {
        localStorage.setItem(chave, Date.now().toString());
        if (msgEl) { msgEl.textContent = '✅ Avaliação enviada! Aparecerá após moderação.'; msgEl.style.color = 'var(--green)'; }
        // Desabilita o form
        document.getElementById(`aval-form-${idx}`).style.opacity = '0.5';
        document.getElementById(`aval-form-${idx}`).style.pointerEvents = 'none';
      } else {
        throw new Error(json.msg || 'Erro');
      }
    } catch(e) {
      if (msgEl) { msgEl.textContent = '❌ Erro ao enviar. Tente novamente.'; msgEl.style.color = 'var(--red)'; }
    }
  };

  /* ══════════════════════════════════════════════════════════════
     CARDÁPIO — PAINEL DO DONO
  ══════════════════════════════════════════════════════════════ */
  let _cardapioItens  = [];
  let _cardapioPlano  = 'GRATIS';
  let _cardapioLojaWpp = null;
  let _cardapioLojaInfo = null;
  let _cardapioUploadEmAndamento = false; // Fix #22: bloqueia salvar durante upload de foto

  async function mlCardapioCarregar(plano) {
    _cardapioPlano = plano;
    const isPro  = plano === 'PRO';
    const isPlus = plano === 'PLUS';

    const section = document.getElementById('ml-cardapio-section');
    if (!section) return;
    section.style.display = (isPro || isPlus) ? '' : 'none';
    if (!isPro && !isPlus) return;

    // Badge do plano
    const badge = document.getElementById('ml-cardapio-badge');
    if (badge) {
      if (isPro) {
        badge.textContent = 'PRO';
        badge.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
      } else {
        badge.textContent = 'PLUS · até 5 itens';
        badge.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
        badge.style.color = '#fff';
      }
    }

    // Plus não tem foto nem categoria
    document.getElementById('ml-cardapio-foto-wrap').style.display = isPro ? '' : 'none';
    document.getElementById('ml-cardapio-cat-wrap').style.display  = isPro ? '' : 'none';

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
  }

  function mlCardapioRenderLista() {
    const lista  = document.getElementById('ml-cardapio-lista');
    const limite = document.getElementById('ml-cardapio-limite');
    if (!lista) return;

    const isPro   = _cardapioPlano === 'PRO';
    const maxItens = isPro ? null : 5;
    const ativos  = _cardapioItens.filter(i => i.ativo !== 'NAO');

    if (limite) {
      limite.textContent = isPro
        ? `${ativos.length} item${ativos.length !== 1 ? 's' : ''} no cardápio`
        : `${ativos.length}/5 itens · ${5 - ativos.length} restante${5-ativos.length!==1?'s':''}`;
    }

    if (ativos.length === 0) {
      lista.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px;">
        Nenhum item ainda.<br>Clique em <strong>Adicionar</strong> para começar.
      </div>`;
      return;
    }

    lista.innerHTML = ativos.map(item => `
      <div class="ml-cardapio-item">
        ${item.foto
          ? `<img src="${item.foto}" class="ml-cardapio-item-foto" onerror="this.style.display='none'">`
          : `<div class="ml-cardapio-item-foto" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🍽️</div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-h);font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(item.nome)}</div>
          ${item.categoria ? `<div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-top:1px;">${escHTML(item.categoria)}</div>` : ''}
          <div style="font-size:12px;font-weight:700;color:var(--green);margin-top:3px;">R$ ${(parseFloat(item.preco) || 0).toFixed(2).replace('.',',')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="mlCardapioAbrirForm('${item.id}')"
            style="padding:6px 10px;border-radius:7px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:700;cursor:pointer;">
            <i class="fa fa-pencil"></i>
          </button>
          <button onclick="mlCardapioRemover('${item.id}','${escAttr(item.nome)}')"
            style="padding:6px 10px;border-radius:7px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);color:var(--red);font-size:10px;font-weight:700;cursor:pointer;">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  function mlCardapioAbrirForm(editId) {
    const form = document.getElementById('ml-cardapio-form');
    if (!form) return;
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
        ? `<img src="${item.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`
        : '<i class="fa fa-image" style="color:var(--muted);font-size:1.2rem;"></i>';
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
    }
    form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function mlCardapioFecharForm() {
    document.getElementById('ml-cardapio-form').style.display = 'none';
  }

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
    // Verifica tamanho antes de fazer upload
    if (file.size > 5 * 1024 * 1024) {
      msgEl.textContent = '❌ Imagem muito grande (máx 5MB). Reduza a resolução e tente de novo.';
      msgEl.style.color = 'var(--red)';
      input.value = '';
      return;
    }
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

  async function mlCardapioSalvar(manterAberto = false) {
    const nome  = document.getElementById('ml-cardapio-nome').value.trim();
    const preco = document.getElementById('ml-cardapio-preco').value;
    const msgEl = document.getElementById('ml-cardapio-form-msg');
    if (!nome)  { msgEl.textContent = '❌ Informe o nome do item.'; msgEl.style.color='var(--red)'; return; }
    if (!preco) { msgEl.textContent = '❌ Informe o preço.'; msgEl.style.color='var(--red)'; return; }
    if (parseFloat(preco) < 0) { msgEl.textContent = '❌ Preço não pode ser negativo.'; msgEl.style.color='var(--red)'; return; }
    // Fix #22: bloqueia se upload de foto ainda está em andamento
    if (_cardapioUploadEmAndamento) {
      msgEl.textContent = '⏳ Aguarde o upload da foto terminar antes de salvar.';
      msgEl.style.color = 'var(--muted)';
      return;
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
        preco:      parseFloat(preco),
        foto:       document.getElementById('ml-cardapio-foto-url').value,
        categoria:  document.getElementById('ml-cardapio-cat').value.trim(),
        destaque:   document.getElementById('ml-cardapio-destaque')?.checked ? 'SIM' : 'NAO',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(15000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        // Atualiza a lista sem fechar o form quando manterAberto=true
        await mlCardapioCarregar(_cardapioPlano);

        if (manterAberto) {
          // Modo rápido: limpa o form e deixa pronto para o próximo item
          // Mantém a categoria preenchida para agilizar quando os itens são da mesma categoria
          const catAtual = document.getElementById('ml-cardapio-cat').value;
          mlCardapioAbrirForm(null); // reseta form para novo item
          document.getElementById('ml-cardapio-cat').value = catAtual; // mantém a categoria
          msgEl.textContent = '✅ Salvo! Preencha o próximo.';
          msgEl.style.color = 'var(--green)';
          setTimeout(() => { msgEl.textContent = ''; }, 2500);
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
    if (!confirm(`Remover "${nome}" do cardápio?`)) return;
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaCardapioRemover', token:_lojaToken, id }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();
      if (json.status !== 'ok') {
        alert('Erro ao remover: ' + (json.msg || 'Tente novamente.'));
        return;
      }
      await mlCardapioCarregar(_cardapioPlano);
    } catch(e) { alert('Erro ao remover: ' + e.message); }
  }

  window.mlCardapioAbrirForm  = mlCardapioAbrirForm;
  window.mlCardapioFecharForm = mlCardapioFecharForm;
  window.mlCardapioSalvar     = mlCardapioSalvar;
  window.mlCardapioRemover    = mlCardapioRemover;
  window.mlSalvarInstagram    = mlSalvarInstagram;

  window.mlToggleEntrega = async function() {
    const toggle  = document.getElementById('ml-entrega-toggle');
    const thumb   = document.getElementById('ml-entrega-thumb');
    const statusEl = document.getElementById('ml-entrega-status');
    if (!toggle) return;
    const novoValor = toggle.dataset.ativo !== '1';
    toggle.dataset.ativo = novoValor ? '1' : '0';
    toggle.style.background = novoValor ? '#10b981' : 'var(--border)';
    if (thumb) thumb.style.left = novoValor ? '21px' : '3px';
    if (statusEl) { statusEl.textContent = 'Salvando…'; statusEl.style.color = 'var(--muted)'; }
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'lojaAtualizarEntrega',
        token:  _lojaToken,
        fazEntrega: novoValor ? 'SIM' : 'NAO',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        if (statusEl) {
          statusEl.textContent = novoValor ? '✅ Entrega ativada' : '✅ Entrega desativada';
          statusEl.style.color = 'var(--green)';
          setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
        }
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      toggle.dataset.ativo = novoValor ? '0' : '1';
      toggle.style.background = novoValor ? 'var(--border)' : '#10b981';
      if (thumb) thumb.style.left = novoValor ? '3px' : '21px';
      if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = 'var(--red)'; }
    }
  };

  /* ══════════════════════════════════════════════════════════════
     CARDÁPIO — TELA DO CLIENTE
  ══════════════════════════════════════════════════════════════ */
  let _ccLojaIdx   = null;
  let _ccCarrinho  = {}; // { itemId: { item, qty } }

  window.abrirCardapioCliente = function(idx) {
    const loja = LOJAS[idx];
    if (!loja || !loja.cardapio || loja.cardapio.length === 0) return;
    _ccLojaIdx  = idx;
    _ccCarrinho = {};

    // Label dinâmico por slug — cada categoria tem seu nome mais adequado
    const _slug = (loja.categoria || '').toLowerCase();
    const _labelMap = {
      // Alimentação — Cardápio
      'pizzaria':'Cardápio', 'lanches':'Cardápio', 'restaurante':'Cardápio',
      'sorveteria':'Cardápio', 'padaria':'Cardápio', 'doceria':'Cardápio',
      'carnes':'Cardápio', 'cafeteria':'Cardápio', 'saudavel':'Cardápio',
      'japonesa':'Cardápio', 'italiana':'Cardápio', 'marmita':'Cardápio',
      // Bebidas — Produtos
      'adega':'Produtos',
      // Comércio — Produtos
      'mercado':'Produtos', 'farmacia':'Produtos', 'pet':'Produtos',
      'calcados':'Produtos', 'roupas':'Produtos', 'joalheria':'Produtos',
      'otica':'Produtos', 'informatica':'Produtos', 'celular':'Produtos',
      'papelaria':'Produtos', 'variedades':'Produtos', 'festas':'Produtos',
      'armarinho':'Produtos', 'floricultura':'Produtos', 'moveis':'Produtos',
      'tintas':'Produtos', 'construcao':'Produtos', 'madeireira':'Produtos',
      'autopecas':'Produtos', 'agropecuaria':'Produtos', 'insumos':'Produtos',
      // Saúde — Serviços específicos
      'clinica':'Consultas', 'laboratorio':'Exames', 'hospital':'Atendimentos',
      // Beleza — Serviços específicos
      'barbearia':'Serviços', 'salao':'Serviços', 'estetica':'Serviços',
      'tattoo':'Portfólio', 'spa':'Serviços', 'academia':'Planos',
      // Automotivo — Serviços específicos
      'mecanica':'Serviços', 'borracharia':'Serviços', 'funilaria':'Serviços',
      'lava-rapido':'Serviços', 'posto':'Combustíveis', 'autopecas':'Produtos',
      'bicicletaria':'Serviços',
      // Casa — Serviços/Produtos
      'construcao':'Produtos', 'vidracaria':'Serviços', 'serralheria':'Serviços',
      'refrigeracao':'Serviços', 'consertos':'Serviços', 'eletricista':'Serviços',
      'encanamento':'Serviços', 'pintura':'Serviços',
      // Tecnologia — Serviços
      'grafica':'Serviços', 'informatica':'Produtos', 'celular':'Produtos',
      // Profissionais — Serviços específicos
      'advocacia':'Serviços', 'contabilidade':'Serviços', 'fotografia':'Portfólio',
      'imobiliaria':'Imóveis', 'viagens':'Pacotes', 'seguros':'Planos',
      // Educação
      'idiomas':'Cursos', 'escolinha':'Serviços', 'bancario':'Serviços',
      // Gas/Água
      'gas':'Produtos',
    };
    const label = _labelMap[_slug] || 'Itens';

    document.getElementById('cc-loja-nome').textContent = loja.nome;
    document.getElementById('cc-loja-sub').textContent  = label;

    // Mostrar/ocultar seção de entrega
    const entregaSec = document.getElementById('cc-entrega-section');
    if (entregaSec) {
      entregaSec.style.display = loja.fazEntrega ? '' : 'none';
      // Limpa campos a cada abertura
      const endEl = document.getElementById('cc-entrega-endereco');
      const pagEl = document.getElementById('cc-entrega-pagamento');
      if (endEl) endEl.value = '';
      if (pagEl) pagEl.value = '';
    }

    ccRenderItens(loja);
    ccAtualizarCarrinho();

    // Back button Android: empurra estado para que voltar feche o cardápio
    history.pushState({ modal: 'cardapio', idx }, '', location.pathname + location.search + location.hash);

    document.getElementById('modal-cardapio-cliente').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.fecharCardapioCliente = function(viaPopstate) {
    document.getElementById('modal-cardapio-cliente').classList.remove('open');
    document.body.style.overflow = '';
    if (!viaPopstate && history.state && history.state.modal === 'cardapio') history.back();
    // Reseta tela de sucesso para a próxima abertura
    const sucesso = document.getElementById('cc-pedido-sucesso');
    if (sucesso) sucesso.style.display = 'none';
    const wrap = document.getElementById('cc-itens-wrap');
    if (wrap) wrap.style.display = '';
  };

  function ccRenderItens(loja) {
    const wrap  = document.getElementById('cc-itens-wrap');
    const isPro = (loja.plano || '').toUpperCase() === 'PRO';

    // Emoji placeholder inteligente por categoria
    const _catEmoji = {
      'pizzaria':'🍕','lanches':'🍔','restaurante':'🍽️','carnes':'🥩','sorveteria':'🍦',
      'padaria':'🥐','adega':'🍺','mercado':'🛒','farmacia':'💊','pet':'🐾',
      'barbearia':'💈','salao':'💅','mecanica':'🔧','eletricista':'⚡','tattoo':'🎨',
      'academia':'💪','clinica':'🩺','laboratorio':'🧪','otica':'👓','calcados':'👟',
      'roupas':'👗','joalheria':'💍','informatica':'💻','celular':'📱',
      'construcao':'🧱','moveis':'🛋️','autopecas':'🔩','borracharia':'🚗','posto':'⛽',
      'floricultura':'💐','fotografia':'📸','agropecuaria':'🌾','insumos':'🚜',
    };
    const placeholderEmoji = _catEmoji[(loja.categoria||'').toLowerCase()] || loja.emoji || '🏪';

    // Agrupa por categoria
    const grupos = {};
    loja.cardapio.forEach(item => {
      const cat = (isPro && item.categoria) ? item.categoria : 'Itens';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(item);
    });

    wrap.innerHTML = Object.entries(grupos).map(([cat, itens]) => `
      <div class="cc-cat-label">${escHTML(cat)}</div>
      ${itens.map(item => `
        <div class="cc-item-card" id="cc-card-${item.id}" style="margin-bottom:8px;${item.destaque==='SIM'?'border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.05);':''}">
          ${item.foto
            ? `<img src="${item.foto}" class="cc-item-foto" onerror="this.style.display='none'">`
            : `<div class="cc-item-foto-placeholder">${placeholderEmoji}</div>`}
          <div class="cc-item-info">
            <div class="cc-item-nome">
              ${item.destaque === 'SIM' ? '<span style="font-size:10px;background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);border-radius:4px;padding:1px 5px;margin-right:4px;font-weight:800;">⭐ Mais pedido</span>' : ''}
              ${escHTML(item.nome)}
            </div>
            ${item.descricao ? `<div class="cc-item-desc">${escHTML(item.descricao)}</div>` : ''}
            <div class="cc-item-preco">R$ ${(parseFloat(item.preco) || 0).toFixed(2).replace('.',',')}</div>
          </div>
          <div class="cc-qty-ctrl" id="cc-qty-${item.id}">
            <button class="cc-item-add" onclick="ccAdicionarItem('${item.id}')">+</button>
          </div>
        </div>
      `).join('')}
    `).join('');
  }

  window.ccAdicionarItem = function(itemId) {
    const loja = LOJAS[_ccLojaIdx];
    const item = loja.cardapio.find(i => i.id === itemId);
    if (!item) return;

    if (!_ccCarrinho[itemId]) {
      _ccCarrinho[itemId] = { item, qty: 0 };
    }
    _ccCarrinho[itemId].qty++;

    // Troca botão "+" por controles de quantidade
    const qtyEl = document.getElementById(`cc-qty-${itemId}`);
    if (qtyEl) {
      qtyEl.innerHTML = `
        <button class="cc-qty-btn" onclick="ccAlterarQty('${itemId}',-1)">−</button>
        <span class="cc-qty-num">${_ccCarrinho[itemId].qty}</span>
        <button class="cc-qty-btn" onclick="ccAlterarQty('${itemId}',+1)" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;">+</button>
      `;
    }
    ccAtualizarCarrinho();
  };

  window.ccAlterarQty = function(itemId, delta) {
    if (!_ccCarrinho[itemId]) return;
    _ccCarrinho[itemId].qty += delta;
    if (_ccCarrinho[itemId].qty <= 0) {
      delete _ccCarrinho[itemId];
      // Volta para botão "+"
      const qtyEl = document.getElementById(`cc-qty-${itemId}`);
      if (qtyEl) qtyEl.innerHTML = `<button class="cc-item-add" onclick="ccAdicionarItem('${itemId}')">+</button>`;
    } else {
      const qtyEl = document.getElementById(`cc-qty-${itemId}`);
      if (qtyEl) qtyEl.querySelector('.cc-qty-num').textContent = _ccCarrinho[itemId].qty;
    }
    ccAtualizarCarrinho();
  };

  window.ccLimparCarrinho = function() {
    _ccCarrinho = {};
    const loja = LOJAS[_ccLojaIdx];
    if (loja) ccRenderItens(loja);
    ccAtualizarCarrinho();
  };

  function ccAtualizarCarrinho() {
    const bar    = document.getElementById('cc-carrinho-bar');
    const lista  = document.getElementById('cc-carrinho-itens');
    const totalEl = document.getElementById('cc-total');
    const itens  = Object.values(_ccCarrinho);

    if (itens.length === 0) {
      if (bar) bar.style.display = 'none';
      return;
    }

    if (bar) bar.style.display = '';

    let total = 0;
    if (lista) {
      lista.innerHTML = itens.map(({ item, qty }) => {
        const sub = (parseFloat(item.preco) || 0) * qty;
        total += sub;
        return `<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;">
          <span style="flex:1;color:var(--text);">${qty}× ${escHTML(item.nome)}</span>
          <span style="color:var(--green);font-weight:700;flex-shrink:0;">R$ ${sub.toFixed(2).replace('.',',')}</span>
        </div>`;
      }).join('');
    }
    if (totalEl) totalEl.textContent = `R$ ${total.toFixed(2).replace('.',',')}`;
  }

  window.ccFinalizarPedido = function() {
    const loja  = LOJAS[_ccLojaIdx];
    if (!loja || !loja.wpp) { alert('Esta loja não tem WhatsApp cadastrado.'); return; }

    const itens = Object.values(_ccCarrinho);
    if (itens.length === 0) return;

    // Proteção contra double-submit: desabilita o botão imediatamente
    const finalizarBtn = document.querySelector('#modal-cardapio-cliente button[onclick="ccFinalizarPedido()"]');
    if (finalizarBtn) {
      if (finalizarBtn.disabled) return;
      finalizarBtn.disabled = true;
      setTimeout(() => { if (finalizarBtn) finalizarBtn.disabled = false; }, 6000);
    }

    let total = 0;
    const linhas = itens.map(({ item, qty }) => {
      const sub = (parseFloat(item.preco) || 0) * qty;
      total += sub;
      return `• ${qty}× ${item.nome} — R$ ${sub.toFixed(2).replace('.',',')}`;
    });

    const obsEl = document.getElementById('cc-obs-input');
    const obs = obsEl ? obsEl.value.trim() : '';
    const obsLine = obs ? `\n\n📝 *Observações:* ${obs}` : '';

    // Dados de entrega (se loja faz entrega)
    let entregaLine = '';
    if (loja.fazEntrega) {
      const endEl = document.getElementById('cc-entrega-endereco');
      const pagEl = document.getElementById('cc-entrega-pagamento');
      const end = endEl ? endEl.value.trim() : '';
      const pag = pagEl ? pagEl.value.trim() : '';
      if (!end) { if (finalizarBtn) finalizarBtn.disabled = false; alert('Por favor, informe o endereço para entrega.'); return; }
      if (!pag) { if (finalizarBtn) finalizarBtn.disabled = false; alert('Por favor, selecione a forma de pagamento.'); return; }
      entregaLine = `\n\n📍 *Entrega para:* ${end}\n💰 *Pagamento:* ${pag}`;
    }

    const msg = `Olá! Fiz um pedido pelo AngatubaON 🛒\n\n${linhas.join('\n')}\n\n*Total: R$ ${total.toFixed(2).replace('.',',')}*${entregaLine}${obsLine}\n\nPoderia confirmar?`;
    const url = `https://wa.me/${loja.wpp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener');

    // Exibe botão de confirmação explícita em vez de detectar visibilitychange
    // (visibilitychange dispara para qualquer troca de app, não só para o WhatsApp)
    const carrinhoBar = document.getElementById('cc-carrinho-bar');
    if (carrinhoBar) {
      // Remove botão anterior se existir (evita acúmulo a cada chamada)
      carrinhoBar.querySelector('.cc-confirm-btn')?.remove();
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'cc-confirm-btn';
      confirmBtn.style.cssText = `
        width:100%;margin-top:8px;padding:13px;border-radius:12px;
        background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.4);
        color:#25d366;font-family:var(--font-h);font-size:13px;font-weight:800;
        cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
      `;
      confirmBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Pedido enviado! Confirmar';
      confirmBtn.onclick = () => _ccMostrarSucesso();
      carrinhoBar.appendChild(confirmBtn);
    }
  };

  window._ccMostrarSucesso = function() {
    // Esconde o carrinho e mostra a mensagem de sucesso dentro do modal
    const carrinhoBar = document.getElementById('cc-carrinho-bar');
    const wrap        = document.getElementById('cc-itens-wrap');

    // Cria (ou reutiliza) div de sucesso
    let sucesso = document.getElementById('cc-pedido-sucesso');
    if (!sucesso) {
      sucesso = document.createElement('div');
      sucesso.id = 'cc-pedido-sucesso';
      sucesso.style.cssText = `
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:12px; padding:40px 24px; text-align:center;
      `;
      sucesso.innerHTML = `
        <div style="font-size:3rem;">✅</div>
        <div style="font-family:var(--font-h);font-size:1.2rem;font-weight:800;color:var(--text);">Pedido enviado!</div>
        <p style="font-size:13px;color:var(--muted);margin:0;">Seu pedido foi enviado pelo WhatsApp.<br>Aguarde a confirmação da loja.</p>
        <button onclick="fecharCardapioCliente()" style="
          margin-top:8px; padding:12px 28px; border-radius:12px;
          background:linear-gradient(135deg,#25d366,#128c7e);
          color:#fff; font-family:var(--font-h); font-size:14px; font-weight:800;
          border:none; cursor:pointer;
        ">Fechar</button>
      `;
      // Insere dentro do modal de forma estável, após o wrap de itens
      const modalBody = document.getElementById('cc-itens-wrap')?.parentNode
                     || document.getElementById('modal-cardapio-cliente');
      if (modalBody) modalBody.appendChild(sucesso);
    }

    if (carrinhoBar) carrinhoBar.style.display = 'none';
    if (wrap)        wrap.style.display        = 'none';
    sucesso.style.display = 'flex';

    // Limpa carrinho
    _ccCarrinho = {};
  };

  document.getElementById('modal-cardapio-cliente')?.addEventListener('click', function(e) {
    if (e.target === this) fecharCardapioCliente();
  });