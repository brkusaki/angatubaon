# Ferramentas do AngatubaON

Tudo aqui é para trabalhar no app. Nada disso é carregado pelo app publicado.

## Instalar (uma vez)

Na pasta do projeto, Shift + clique direito > "Abrir janela do PowerShell aqui", e cole:

```
powershell -ExecutionPolicy Bypass -File ferramentas\instalar.ps1
```

Ele instala os programas, as dependências do projeto, faz o primeiro build, pergunta se instala o Chatterbox (3 a 5 GB) e faz os logins.

Depois, uma vez só, para ligar o Apps Script:

```
powershell -ExecutionPolicy Bypass -File ferramentas\gas-configurar.ps1
```

## Comandos do dia a dia

| Comando | O que faz |
| --- | --- |
| `npm run build` | Minifica todos os pares `X.js` → `X.min.js` (e `app.js` → `app_min.js`), confere se algum `window.*` sumiu e sobe a versão do CACHE no `service-worker.js` quando JS/CSS/HTML mudou. Se algo der errado, não grava nada. |
| `npm run build:checar` | Só confere, sem gravar (o GitHub Actions roda isso a cada push). |
| `npm run lint` | ESLint: pega chave duplicada, código inalcançável, atribuição a const etc. Variável não declarada aparece só como aviso. |
| `npm run testar` | Sobe o site local e testa num celular simulado: carga sem erro de JS, service worker ativo, arquivos essenciais respondendo. |
| `npm run servir` | Sobe o site em http://localhost:4173 para testar à mão. |
| `npm run gas:publicar` | Envia `ferramentas\gas\` para o Apps Script e cria nova versão na mesma implantação (a URL não muda). |
| `npm run regras:firestore` | Publica o `firestore.rules`. |
| `npm run regras:realtime` | Publica o `database.rules.json`. |

## GitHub Actions

`.github/workflows/verificar.yml` (copiado de `ferramentas/github-verificar.yml` pelo instalador) roda a cada push. Ele não publica nada: só falha (X vermelho e e-mail do GitHub) se um `.min.js` ficou desatualizado, se um global sumiu, se a versão do SW não subiu, ou se o ESLint achou erro.

## Imagens, áudio e vídeo

Os programas Python ficam em ambientes próprios, para não bagunçar o resto do PC:

- `%USERPROFILE%\angatuba-ia`: rembg (tira fundo) e faster-whisper (legendas)
- `%USERPROFILE%\angatuba-voz`: Chatterbox (narração), se você instalou

Exemplos:

```
%USERPROFILE%\angatuba-ia\Scripts\rembg i entrada.png saida.png
magick montage frames\*.png -tile 3x -geometry +0+0 -background none sheet.png
ffmpeg -i som.mp3 -c:a libopus -b:a 64k som.ogg
```

O HyperFrames (vídeos em HTML) roda com `npx hyperframes` quando for usar; não precisa instalar.

## Conectores no app do Claude

O instalador adiciona dois conectores no `claude_desktop_config.json` (com backup em `.bak`):

```json
"chrome-devtools": { "command": "cmd", "args": ["/c", "npx", "-y", "chrome-devtools-mcp@latest"] },
"blender": { "command": "uvx", "args": ["blender-mcp"] }
```

Feche e abra o app do Claude depois. Cada conector ligado gasta tokens em toda conversa, então desligue nas configurações do app quando não estiver usando.

**Blender:** abra o Blender > Edit > Preferences > Add-ons > Install from Disk, escolha `ferramentas\blender-mcp-addon.py` e ative. Na vista 3D, aperte N, abra a aba BlenderMCP e clique em Connect.

## Contas para criar perto do lançamento

- **Sentry** (grátis até 5 mil erros por mês): avisa erros no celular dos usuários.
- **Cloudflare Web Analytics** (grátis): visitas, sem cookies.
- **UptimeRobot** (grátis): avisa se o site ou o GAS caírem.
- **OneSignal** (web push grátis): notificações.
- **Meta Business Suite** (grátis): agendar posts e Reels.
- **Alertas de orçamento** no Google Cloud (projeto `angatubaon-cd333`) e no Cloudinary.

Sentry e Cloudflare entram no `index.html`: quando as contas existirem, é só passar as chaves públicas.
