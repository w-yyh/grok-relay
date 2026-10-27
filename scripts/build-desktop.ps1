param([string]$Go = 'go')
$ErrorActionPreference = 'Stop'
$bridgeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $bridgeRoot
try {
    & $Go mod tidy
    if ($LASTEXITCODE -ne 0) { throw 'Go dependencies failed' }
    & $Go build -trimpath -tags production -ldflags '-H windowsgui -s -w' -o GrokRelay.exe ./desktop
    if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed' }
    Write-Output (Join-Path $bridgeRoot 'GrokRelay.exe')
} finally { Pop-Location }
