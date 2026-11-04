# ─────────────────────────────────────────────────────────────────────
#  Instala as ferramentas de trabalho do AngatubaON. Rode UMA vez:
#
#    1. Abra o PowerShell na pasta do projeto
#       (na pasta, Shift + clique direito > "Abrir janela do PowerShell aqui")
#    2. Cole:  powershell -ExecutionPolicy Bypass -File ferramentas\instalar.ps1
#
#  Pode rodar de novo sem medo: o que já estiver instalado é pulado.
#  Nada aqui mexe no app publicado.
# ─────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Continue'
$Repo = Split-Path $PSScriptRoot -Parent

function Titulo($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  OK  $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "  !!  $t" -ForegroundColor Yellow }
function Tem($cmd)  { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Perguntar($t) { (Read-Host "$t (s/N)") -match '^[sS]' }
function AtualizarPath {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path', 'User')
}
# Nome diferente de "winget" de propósito: o PowerShell não diferencia
# maiúsculas, e uma função chamada Winget chamaria a si mesma.
function InstalarPrograma($id, $nome) {
  $lista = winget.exe list --id $id -e --accept-source-agreements 2>$null | Out-String
  if ($lista -match [regex]::Escape($id)) { Ok "$nome (já instalado)"; return }
  Write-Host "  ->  instalando $nome..."
  winget.exe install --id $id -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok $nome } else { Aviso "${nome}: o winget devolveu código $LASTEXITCODE" }
}

if (-not (Tem 'winget')) {
  Aviso 'O winget não foi encontrado. Instale o "Instalador de Aplicativo" pela Microsoft Store e rode de novo.'
  exit 1
}

# ── 1. Programas ─────────────────────────────────────────────────────
Titulo '1/7  Programas (winget)'
$nodeOk = $false
if (Tem 'node') { $nodeOk = ([int]((node -v) -replace '^v(\d+).*', '$1')) -ge 22 }
if (-not $nodeOk) { InstalarPrograma 'OpenJS.NodeJS.LTS' 'Node.js LTS' } else { Ok "Node.js $(node -v)" }
if (-not (Tem 'git')) { InstalarPrograma 'Git.Git' 'Git' } else { Ok 'Git' }
InstalarPrograma 'GitHub.cli'               'GitHub CLI (gh)'
InstalarPrograma 'Gyan.FFmpeg'              'FFmpeg'
InstalarPrograma 'ImageMagick.ImageMagick'  'ImageMagick'
InstalarPrograma 'BlenderFoundation.Blender' 'Blender'
InstalarPrograma 'Python.Python.3.11'       'Python 3.11'
InstalarPrograma 'astral-sh.uv'             'uv (usado pelo Blender MCP)'
AtualizarPath

# ── 2. Ferramentas de linha de comando (npm global) ──────────────────
Titulo '2/7  clasp (Apps Script) e Firebase CLI'
npm install -g @google/clasp firebase-tools --no-fund --no-audit | Out-Null
if (Tem 'clasp')    { Ok "clasp $(clasp --version)" } else { Aviso 'clasp não instalou' }
if (Tem 'firebase') { Ok "Firebase CLI $(firebase --version)" } else { Aviso 'Firebase CLI não instalou' }

# ── 3. Dependências do projeto + primeiro build ──────────────────────
Titulo '3/7  Projeto: terser, ESLint, Playwright'
Push-Location $Repo
# O Claude não consegue gravar dentro de .github (pasta protegida), então
# o arquivo do GitHub Actions vem em ferramentas\ e é copiado aqui.
New-Item -ItemType Directory -Force -Path '.github\workflows' | Out-Null
Copy-Item 'ferramentas\github-verificar.yml' '.github\workflows\verificar.yml' -Force
Ok 'GitHub Actions: .github\workflows\verificar.yml'
npm install --no-fund --no-audit | Out-Null
Ok 'npm install'
npx playwright install chromium
Ok 'Chromium do Playwright'
Write-Host '  ->  primeiro build (registra o estado atual; não sobe versão do SW):'
npm run build --silent
Pop-Location

# ── 4. Python: rembg (fundo de imagem) e faster-whisper (legendas) ───
Titulo '4/7  rembg e faster-whisper'
$Ia = Join-Path $HOME 'angatuba-ia'
if (-not (Test-Path "$Ia\Scripts\python.exe")) { py -3.11 -m venv $Ia }
& "$Ia\Scripts\python.exe" -m pip install --upgrade pip --quiet
& "$Ia\Scripts\python.exe" -m pip install "rembg[cpu,cli]" faster-whisper --quiet
if (Test-Path "$Ia\Scripts\rembg.exe") { Ok "rembg e faster-whisper em $Ia" } else { Aviso 'rembg não instalou' }

# ── 5. Chatterbox (voz) — opcional, pesado ───────────────────────────
Titulo '5/7  Chatterbox (narração grátis em pt-BR)'
Write-Host '  Baixa uns 3 a 5 GB (PyTorch + modelos). Roda no processador.'
if (Perguntar '  Instalar agora?') {
  $Voz = Join-Path $HOME 'angatuba-voz'
  if (-not (Test-Path "$Voz\Scripts\python.exe")) { py -3.11 -m venv $Voz }
  & "$Voz\Scripts\python.exe" -m pip install --upgrade pip --quiet
  & "$Voz\Scripts\python.exe" -m pip install chatterbox-tts
  if ($LASTEXITCODE -eq 0) { Ok "Chatterbox em $Voz (os modelos baixam no primeiro uso)" } else { Aviso 'Chatterbox deu erro na instalação' }
} else { Aviso 'Pulado. Para instalar depois, rode este script de novo.' }

# ── 6. Conectores no Claude: Chrome DevTools e Blender ───────────────
Titulo '6/7  Conectores no app do Claude (Chrome DevTools MCP e Blender MCP)'
$cfg = Join-Path $env:APPDATA 'Claude\claude_desktop_config.json'
if (-not (Test-Path $cfg)) {
  $loja = Get-ChildItem "$env:LOCALAPPDATA\Packages\Claude_*\LocalCache\Roaming\Claude\claude_desktop_config.json" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($loja) { $cfg = $loja.FullName }
}
if (Test-Path $cfg) {
  Write-Host "  Configuração: $cfg"
  if (Perguntar '  Adicionar os dois conectores (faz backup antes)?') {
    Copy-Item $cfg "$cfg.bak" -Force
    $json = Get-Content $cfg -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $json.mcpServers) { $json | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{}) }
    if (-not $json.mcpServers.'chrome-devtools') {
      $json.mcpServers | Add-Member -NotePropertyName 'chrome-devtools' -NotePropertyValue ([pscustomobject]@{ command = 'cmd'; args = @('/c', 'npx', '-y', 'chrome-devtools-mcp@latest') })
    }
    if (-not $json.mcpServers.blender) {
      $json.mcpServers | Add-Member -NotePropertyName 'blender' -NotePropertyValue ([pscustomobject]@{ command = 'uvx'; args = @('blender-mcp') })
    }
    $texto = $json | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($cfg, $texto, (New-Object Text.UTF8Encoding $false))
    Ok 'Conectores adicionados (backup em .bak). Feche e abra o app do Claude para valerem.'
  }
} else {
  Aviso 'Não achei o claude_desktop_config.json. Veja ferramentas\LEIA-ME.md, seção "Conectores".'
}
$addon = Join-Path $PSScriptRoot 'blender-mcp-addon.py'
try {
  Invoke-WebRequest 'https://raw.githubusercontent.com/ahujasid/blender-mcp/main/addon.py' -OutFile $addon -UseBasicParsing
  Ok "Add-on do Blender salvo em $addon (instalar pelo Blender: veja o LEIA-ME)"
} catch { Aviso 'Não consegui baixar o add-on do Blender MCP; baixe pelo GitHub (ahujasid/blender-mcp, arquivo addon.py).' }

# ── 7. Logins ────────────────────────────────────────────────────────
Titulo '7/7  Logins (abrem o navegador)'
if (Perguntar '  Entrar no clasp com a conta Google dona do Apps Script?') { clasp login }
if (Perguntar '  Entrar no Firebase CLI?') { firebase login }
if (Perguntar '  Entrar no GitHub CLI?') { gh auth login }

Titulo 'Pronto'
Write-Host @"
  Próximos passos (detalhes em ferramentas\LEIA-ME.md):
   - Apps Script: rode  powershell -ExecutionPolicy Bypass -File ferramentas\gas-configurar.ps1
   - Firebase: no site do Google Cloud, crie um alerta de orçamento para o projeto angatubaon-cd333
   - Blender: instale o add-on ferramentas\blender-mcp-addon.py
   - Contas para criar perto do lançamento: Sentry, Cloudflare Web Analytics, UptimeRobot, OneSignal, Meta Business Suite
"@
