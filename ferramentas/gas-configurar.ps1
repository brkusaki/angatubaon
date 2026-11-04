# ─────────────────────────────────────────────────────────────────────
#  Liga o clasp ao Apps Script do AngatubaON. Rode UMA vez, depois do
#  instalar.ps1 e do "clasp login":
#    powershell -ExecutionPolicy Bypass -File ferramentas\gas-configurar.ps1
#
#  Baixa o código que está HOJE no Apps Script para ferramentas\gas\ e
#  guarda o ID da implantação (o mesmo da URL que o app usa), para o
#  gas-publicar.ps1 atualizar sempre a mesma URL.
# ─────────────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
$Repo = Split-Path $PSScriptRoot -Parent
$Gas  = Join-Path $PSScriptRoot 'gas'

if (Test-Path (Join-Path $Gas '.clasp.json')) {
  Write-Host 'O clasp já está configurado em ferramentas\gas. Para refazer, apague essa pasta.' -ForegroundColor Yellow
  exit 0
}

Write-Host 'No editor do Apps Script: Configurações do projeto (engrenagem) > "ID do script".'
$scriptId = (Read-Host 'Cole o ID do script').Trim()
if (-not $scriptId) { Write-Host 'Sem ID, nada feito.'; exit 1 }

New-Item -ItemType Directory -Force -Path $Gas | Out-Null
Push-Location $Gas
try { clasp clone $scriptId } finally { Pop-Location }
Write-Host "`nArquivos baixados do Apps Script:" -ForegroundColor Cyan
Get-ChildItem $Gas -File | Where-Object { $_.Name -ne '.clasp.json' } | ForEach-Object { Write-Host "  $($_.Name)" }

# O ID da implantação já está na URL que o app chama:
# https://script.google.com/macros/s/<ID>/exec
$deployId = $null
$app = Join-Path $Repo 'app.js'
if (Test-Path $app) {
  $m = Select-String -Path $app -Pattern 'script\.google\.com/macros/s/([\w-]+)/exec' | Select-Object -First 1
  if ($m) { $deployId = $m.Matches[0].Groups[1].Value }
}
if ($deployId) {
  Write-Host "`nID da implantação encontrado no app.js: $deployId"
  if ((Read-Host 'É esse? (S/n)') -match '^[nN]') { $deployId = $null }
}
if (-not $deployId) {
  Push-Location $Gas; clasp deployments; Pop-Location
  $deployId = (Read-Host 'Cole o ID da implantação que o app usa').Trim()
}
Set-Content -Path (Join-Path $Gas 'implantacao.txt') -Value $deployId -Encoding ASCII

# Confere se o que está no Apps Script bate com o "codigo gs.txt" local.
$txt = Join-Path $Repo 'codigo gs.txt'
$principal = Get-ChildItem $Gas -Filter *.js | Sort-Object Length -Descending | Select-Object -First 1
if ((Test-Path $txt) -and $principal) {
  $a = (Get-Content $txt -Raw -Encoding UTF8) -replace "`r`n", "`n"
  $b = (Get-Content $principal.FullName -Raw -Encoding UTF8) -replace "`r`n", "`n"
  if ($a.Trim() -eq $b.Trim()) {
    Write-Host "`n$($principal.Name) é idêntico ao 'codigo gs.txt'." -ForegroundColor Green
  } else {
    Write-Host "`nATENÇÃO: $($principal.Name) (o que está no ar) é diferente do 'codigo gs.txt'." -ForegroundColor Yellow
    Write-Host 'Não publique nada antes de conferir qual dos dois é o certo (o Claude pode comparar).'
  }
}
Write-Host "`nPronto. Daqui pra frente o código do GAS fica em ferramentas\gas\ e publica com: npm run gas:publicar"
