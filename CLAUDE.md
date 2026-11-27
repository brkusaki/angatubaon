# AngatubaON — mapa para o Claude

Guia comercial hiperlocal (PWA) de Angatuba-SP + hub de mini-jogos. Vanilla JS/HTML/CSS, sem framework, sem bundler.
Este arquivo é carregado inteiro em toda conversa: mantenha curto. Os números de linha são aproximados (o arquivo muda); **procure pelo título da seção** e leia só aquele trecho.

## Como o app carrega
- `index.html` → `/styles.min.css` + `/fonts/icones/icones.css` → no fim do body `/app_min.js`.
- Carregados sob demanda pelo app.js: Firebase (SDK compat), `lojista.min.js`, `social.min.js`, `Jogos/hub.min.js` (+ cada jogo), `Aprender/`, `Biblioteca/hub.min.js`.
- `lojista.js` e `social.js` rodam no MESMO escopo global do app.js (script clássico, depois dele). No app.js, os blocos `LOJISTA SOB DEMANDA` e `SOCIAL SOB DEMANDA` têm um stub com o mesmo nome para cada função desses arquivos chamada de fora (app.js, onclick do index.html, outros arquivos). **Função nova num desses arquivos chamada de fora dele precisa de stub lá**, senão dá ReferenceError antes do módulo carregar.
  - lojista: carrega no toque em Minha Loja/Cadastrar, no `?pagamento=`, com cadastro pendente e, para loja logada, 4 s após o boot.
  - social: carrega no login de conta, com o hub de jogos ou no 1º toque social.
- `service-worker.js`: lista `STATIC` (precache), caches `CACHE` (sobe a cada deploy), `CACHE_JOGOS` e `CACHE_BIB` (só sobem quando os assets deles mudam).

## Regras
- Arquivos gerados — **nunca editar nem ler para entender o código**: `app_min.js`, `*.min.js`, `styles.min.css`, `fonts/icones/*`. Edite a fonte (`app.js`, `X.js`, `styles.css`) e rode `npm run build`.
- `npm run build` minifica tudo, confere os globais `window.*` e sobe a versão do SW. Não rode terser/csso na mão.
- Mudanças mínimas e cirúrgicas; nada de função/elemento novo sem necessidade. Comentários em português.
- Credenciais só em GAS Script Properties. O código do GAS fica em `ferramentas/gas/` (fora do GitHub); publicar: `npm run gas:publicar`.
- Regras do Firebase: `firestore.rules` / `database.rules.json` → `npm run regras:firestore` / `npm run regras:realtime`.
- Antes de publicar: `npm run build:checar` e `npm run lint` (é o que o GitHub Actions roda). `npm run testar` = testes de fumaça (Playwright).
- Deploy = push na `main` (GitHub Pages, angatubaon.com.br). `_headers.txt` é legado da Netlify, sem efeito.

## Mapa do app.js (~11 mil linhas — o que todo mundo carrega)
Tudo no escopo global (indentado 2 espaços); handlers inline do `index.html` chamam essas funções direto.

| ~Linha | Seção (título para buscar) |
| --- | --- |
| 17 | `CAT_DEF — FONTE ÚNICA DE CATEGORIAS` |
| 282–400 | `LOJAS — carregadas dinamicamente`, `HELPER de API` (POST ao Apps Script) |
| 397–1060 | Firebase sob demanda, `REMOTE CONFIG`, loaders do Hub de jogos / Aprender / Biblioteca |
| 1068–1510 | `FAVORITOS` (local e sincronizados no Firestore) |
| 1510–1855 | Status aberto/fechado (`calcStatusInfo`, `extrairTurnos`), badges, contato |
| 1855–2608 | Lightbox de foto/stories do anúncio |
| 2608–3015 | Cards, skeleton, `Renderiza lista principal`, categorias |
| 3015–3405 | `Toast`, avisos (`mlAviso`), tema dia/noite, métricas, busca |
| 3405–3557 | `LOJISTA SOB DEMANDA` (carregador + stubs do lojista.js) |
| 3557–3758 | Retorno do Mercado Pago, `SESSÃO DE LOJA` (token, cadastro pendente, entrar por link), bottom nav |
| 3758–3797 | Helpers da loja usados pelo cliente (`_mlMesmoWpp`, `_mlAcharLojaLocal`) |
| 3797–4299 | Onboarding do cliente (tour), `NUDGE DE AVALIAÇÃO` |
| 4299–4987 | Filtros, bairro, PWA install, `Service Worker`, carga da API, autocomplete de endereço |
| 4987–5705 | `MODAL DE DETALHES` da loja (cliente) |
| 5705–6069 | Upload de imagens (proxy GAS), `INIT` |
| 6145–7719 | Carrossel da home, Página 2: clima, `Hoje em Angatuba` (posts, curtidas, postar) |
| 7719–7884 | `DEEP LINK` |
| 7884–8232 | `AVALIAÇÕES` |
| 8232–9733 | `CARDÁPIO — TELA DO CLIENTE` (modificadores, personalização, swipe) |
| 9733–10742 | `AUTENTICAÇÃO DE CLIENTE` (Firebase Auth), painel da conta |
| 10742–10866 | `SOCIAL SOB DEMANDA` (carregador + stubs do social.js) |
| 10866–fim | Clique em notificação, atalhos do manifest (`?atalho=`) |

`lojista.js` (~7,8 mil linhas, trechos na ordem antiga do app.js): cadastro (`Modal Cadastro`, planos, Mercado Pago, polling, `Tela "Aguardando aprovação"`, `STEPPER DE CADASTRO`, horários) · `Modais de login` (WhatsApp + OTP) · painel (`CHECKLIST DE ATIVAÇÃO`, tour do lojista, `abrirMinhaLoja`, status manual, Instagram, logout) · `RAMO AUTOCOMPLETE`, tags, `MINHA LOJA — Edição de informações` · `COMPARTILHAMENTO`, gráfico de pico, `ANÚNCIO DO DIA`, stories agendados · `CARDÁPIO — PAINEL DO DONO` (grupos de opções, foto em lote, `FILA DE ITENS`, entrega).

`social.js` (~5,6 mil linhas): `PRESENÇA`, `AMIGOS`, `CONVITES PRA JOGAR`, `CHAT 1x1`, `AVISOS NO TOPO`, `LOBBY SOCIAL`, `PUSH NOTIFICATIONS (FCM)`.

## Outras pastas
- `Jogos/`: `hub.js` (hub, ranking, perfil) + um `X.js`/`X.css` por jogo; `Jogos/assets/` sprites e sons (cache dos jogos); `Jogos/caca-folclore/` roda em iframe.
- `Biblioteca/` (leitor + livros JSON), `Aprender/` (lições), `admin.html` (painel do admin).
- `webp/` mascote coruja, `img/` fotos, `icons/` PWA, `sons/` e `musicas/` áudio, `fonts/` fontes servidas daqui.
- `ferramentas/`: build, ícones, scripts PowerShell (o PC do Bruno é Windows) — ver `ferramentas/LEIA-ME.md`.
