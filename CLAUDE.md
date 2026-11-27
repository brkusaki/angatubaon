# AngatubaON — mapa para o Claude

Guia comercial hiperlocal (PWA) de Angatuba-SP + hub de mini-jogos. Vanilla JS/HTML/CSS, sem framework, sem bundler.
Este arquivo é carregado inteiro em toda conversa: mantenha curto. Os números de linha são aproximados (o arquivo muda); **procure pelo título da seção** e leia só aquele trecho.

## Como o app carrega
- `index.html` → `/styles.min.css` + `/fonts/icones/icones.css` → no fim do body `/app_min.js`.
- Carregados sob demanda pelo app.js: Firebase (SDK compat), `Jogos/hub.min.js` (+ cada jogo), `Aprender/`, `Biblioteca/hub.min.js`.
- `service-worker.js`: lista `STATIC` (precache), caches `CACHE` (sobe a cada deploy), `CACHE_JOGOS` e `CACHE_BIB` (só sobem quando os assets deles mudam).

## Regras
- Arquivos gerados — **nunca editar nem ler para entender o código**: `app_min.js`, `*.min.js`, `styles.min.css`, `fonts/icones/*`. Edite a fonte (`app.js`, `X.js`, `styles.css`) e rode `npm run build`.
- `npm run build` minifica tudo, confere os globais `window.*` e sobe a versão do SW. Não rode terser/csso na mão.
- Mudanças mínimas e cirúrgicas; nada de função/elemento novo sem necessidade. Comentários em português.
- Credenciais só em GAS Script Properties. O código do GAS fica em `ferramentas/gas/` (fora do GitHub); publicar: `npm run gas:publicar`.
- Regras do Firebase: `firestore.rules` / `database.rules.json` → `npm run regras:firestore` / `npm run regras:realtime`.
- Antes de publicar: `npm run build:checar` e `npm run lint` (é o que o GitHub Actions roda). `npm run testar` = testes de fumaça (Playwright).
- Deploy = push na `main` (GitHub Pages, angatubaon.com.br). `_headers.txt` é legado da Netlify, sem efeito.

## Mapa do app.js (~24 mil linhas, 1,2 MB)
Tudo no escopo global (indentado 2 espaços); handlers inline do `index.html` chamam essas funções direto.

| ~Linha | Seção (título para buscar) |
| --- | --- |
| 16 | `CAT_DEF — FONTE ÚNICA DE CATEGORIAS` |
| 281–400 | `LOJAS — carregadas dinamicamente`, `HELPER de API` (POST ao Apps Script) |
| 397–850 | Firebase sob demanda, `REMOTE CONFIG`, loaders do Hub de jogos / Aprender / Biblioteca |
| 1060–1500 | `FAVORITOS` (local e sincronizados no Firestore) |
| 1500–1850 | Status aberto/fechado (`calcStatusInfo`, `extrairTurnos`), badges, contato |
| 1850–2560 | Lightbox de foto/stories do anúncio |
| 2560–3010 | Cards, skeleton, `Renderiza lista principal`, categorias |
| 3010–3400 | `Toast`, tema dia/noite, métricas, debounce |
| 3400–4520 | Cadastro de loja: modal, planos, Mercado Pago, polling, aguardando aprovação, stepper, horários |
| 4520–5310 | Login da loja (WhatsApp + código OTP), bottom nav |
| 5313–6730 | `Painel Minha Loja`, `CHECKLIST DE ATIVAÇÃO` |
| 6730–7420 | Onboarding do cliente (tour), `NUDGE DE AVALIAÇÃO` |
| 7420–8420 | Status manual, Instagram, logout, filtros, bairro, PWA install, `Service Worker`, carga da API, autocomplete de endereço |
| 8425–9140 | `MODAL DE DETALHES` da loja (cliente) |
| 9143–10640 | Upload de imagens, ramo/tags, `MINHA LOJA — Edição de informações`, `INIT` |
| 10711–12285 | Carrossel da home, Página 2: clima, `Hoje em Angatuba` (posts, curtidas, postar) |
| 12285–13740 | `DEEP LINK`, compartilhamento, gráfico de pico, upload do painel, `ANÚNCIO DO DIA`, stories agendados |
| 13741–14090 | `AVALIAÇÕES` |
| 14087–15840 | `CARDÁPIO — PAINEL DO DONO` (grupos de opções, lote, fila de itens PRO) |
| 15837–17340 | `CARDÁPIO — TELA DO CLIENTE` (modificadores, personalização, swipe) |
| 17338–18345 | `AUTENTICAÇÃO DE CLIENTE` (Firebase Auth), painel da conta |
| 18347–21225 | Social: `PRESENÇA`, `AMIGOS`, `CONVITES PRA JOGAR`, `CHAT 1x1`, `AVISOS NO TOPO` |
| 21225–23760 | `LOBBY SOCIAL` (núcleo, UI, chat do lobby, convites) |
| 23758–fim | `PUSH NOTIFICATIONS (FCM)` |

## Outras pastas
- `Jogos/`: `hub.js` (hub, ranking, perfil) + um `X.js`/`X.css` por jogo; `Jogos/assets/` sprites e sons (cache dos jogos); `Jogos/caca-folclore/` roda em iframe.
- `Biblioteca/` (leitor + livros JSON), `Aprender/` (lições), `admin.html` (painel do admin).
- `webp/` mascote coruja, `img/` fotos, `icons/` PWA, `sons/` e `musicas/` áudio, `fonts/` fontes servidas daqui.
- `ferramentas/`: build, ícones, scripts PowerShell (o PC do Bruno é Windows) — ver `ferramentas/LEIA-ME.md`.
