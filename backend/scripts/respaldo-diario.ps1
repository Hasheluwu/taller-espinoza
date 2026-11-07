# Respaldo diario del Taller Espinoza. Lo ejecuta la tarea programada de Windows
# "Respaldo diario Taller Espinoza". Crea el SQL y su huella SHA-256 en la carpeta de
# backup.config.json y anota cada ejecución en respaldo-diario.log dentro de esa carpeta.
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$config = Get-Content (Join-Path $backend 'backup.config.json') -Raw | ConvertFrom-Json
$folder = $config.directory
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$log = Join-Path $folder 'respaldo-diario.log'
function Write-Log($text) { Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $text" -Encoding utf8 }

$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
try {
  Set-Location $backend
  $output = & $node 'scripts/backup.cjs' 'create' 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "El respaldo terminó con código $LASTEXITCODE. $($output.Trim())" }
  $file = ($output -split "`r?`n" | Where-Object { $_ -like 'Respaldo creado:*' }) -replace '^Respaldo creado:\s*', ''
  if (-not $file -or -not (Test-Path $file) -or -not (Test-Path "$file.json")) { throw "No se encontró el archivo del respaldo. $($output.Trim())" }
  # The manifest's SHA-256 must match the file just written.
  $expected = (Get-Content "$file.json" -Raw | ConvertFrom-Json).sha256
  $actual = (Get-FileHash -Algorithm SHA256 -Path $file).Hash.ToLower()
  if ($expected -and $expected.ToLower() -ne $actual) { throw "La huella del respaldo no coincide: $file" }
  Write-Log "OK $(Split-Path $file -Leaf) ($([math]::Round((Get-Item $file).Length / 1MB, 2)) MB)"
} catch {
  Write-Log "FALLO $($_.Exception.Message)"
  exit 1
}
