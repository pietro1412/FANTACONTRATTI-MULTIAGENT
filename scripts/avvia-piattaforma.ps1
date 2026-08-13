# Avvia la piattaforma FantaContratti in locale (API + client Vite)
# Idempotente: verifica porte, non killare processi altrui.
# Uso: powershell -File scripts/avvia-piattaforma.ps1

param(
  [switch]$SkipClient,
  [switch]$SkipApi
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# === Carica .env.local ===
$envFile = Join-Path $root '.env.local'
$envVars = @{}
Get-Content $envFile | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
  $parts = $_ -split '=', 2
  $key = $parts[0].Trim()
  $value = $parts[1].Trim() -replace '^"|"$', ''
  $envVars[$key] = $value
}
# Forza coerenza porte
$envVars['FRONTEND_URL'] = 'http://localhost:5174'
$envVars['VITE_API_URL'] = 'http://localhost:3003'

# === Allinea FRONTEND_URL in .env.local se diverso ===
$currentLine = "FRONTEND_URL=`"http://localhost:5174`""
$content = Get-Content $envFile
$changed = $false
for ($i = 0; $i -lt $content.Count; $i++) {
  if ($content[$i] -match '^FRONTEND_URL=') {
    if ($content[$i] -ne $currentLine) {
      $content[$i] = $currentLine
      $changed = $true
    }
    break
  }
}
if ($changed) {
  $content | Set-Content $envFile
  Write-Host ">> FRONTEND_URL aggiornato a :5174" -ForegroundColor Yellow
}

# === Verifica porta occupata ===
function Test-PortInUse($Port) {
  $result = netstat -ano | Select-String ":$Port\s"
  return $null -ne $result
}

# === Crea cmd wrapper con env vars ===
function Start-WithEnvVars($Name, $Command, $Port, $Label) {
  if (Test-PortInUse $Port) {
    Write-Host "OK $Label gia attivo su :$Port" -ForegroundColor Green
    return
  }
  Write-Host "-> Avvio $Label su :$Port..." -ForegroundColor Cyan
  $lines = New-Object System.Collections.ArrayList
  $lines.Add('@echo off') | Out-Null
  foreach ($kv in $envVars.GetEnumerator()) {
    $v = $kv.Value.Replace('"', '')
    $lines.Add("set $($kv.Key)=$v") | Out-Null
  }
  $lines.Add("cd /d `"$root`"") | Out-Null
  $lines.Add($Command) | Out-Null
  $cmdContent = $lines -join [Environment]::NewLine
  $cmdFile = Join-Path $env:TEMP "fantacontratti-$Name.cmd"
  Set-Content -Path $cmdFile -Value $cmdContent -Encoding ASCII
  Start-Process -WindowStyle Hidden -FilePath $cmdFile
  $waited = 0
  while ($waited -lt 12) {
    Start-Sleep -Seconds 2
    $waited += 2
    if (Test-PortInUse $Port) {
      Write-Host "OK $Label avviato su :$Port (${waited}s)" -ForegroundColor Green
      return
    }
  }
  Write-Host "?? $Label non risponde dopo ${waited}s - verifica manuale" -ForegroundColor Yellow
}

# === Avvia API ===
if (-not $SkipApi) {
  Start-WithEnvVars -Name "api" -Command "npx.cmd tsx watch src/api/index.ts" -Port 3003 -Label "API"
}

# === Avvia Client Vite ===
if (-not $SkipClient) {
  Start-WithEnvVars -Name "client" -Command "npx.cmd vite --port 5174" -Port 5174 -Label "Client"
}

# === Report ===
Write-Host "`n=== Piattaforma FantaContratti ==="
Write-Host "API:    http://localhost:3003" -ForegroundColor White
Write-Host "Client: http://localhost:5174" -ForegroundColor White
