# ─────────────────────────────────────────────────────────────────────
#  Publica o Apps Script: envia o código de ferramentas\gas\ e cria uma
#  nova versão NA MESMA implantação (a URL do app não muda).
#    npm run gas:publicar
# ─────────────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'
$Gas = Join-Path $PSScriptRoot 'gas'
$arqId = Join-Path $Gas 'implantacao.txt'
if (-not (Test-Path (Join-Path $Gas '.clasp.json')) -or -not (Test-Path $arqId)) {
  Write-Host 'Rode antes: powershell -ExecutionPolicy Bypass -File ferramentas\gas-configurar.ps1' -ForegroundColor Yellow
  exit 1
}
$deployId = (Get-Content $arqId -Raw).Trim()
$desc = Read-Host 'Descrição da nova versão (ex.: corrige horário das lojas)'
if (-not $desc) { $desc = "Publicado em $(Get-Date -Format 'dd/MM/yyyy HH:mm')" }

Push-Location $Gas
try {
  clasp push
  if ($LASTEXITCODE -ne 0) { throw 'clasp push falhou; nada foi implantado.' }
  clasp redeploy $deployId -d $desc
  if ($LASTEXITCODE -ne 0) { throw 'clasp redeploy falhou.' }
  Write-Host "`nPublicado: nova versão na implantação $deployId." -ForegroundColor Green
} finally { Pop-Location }
