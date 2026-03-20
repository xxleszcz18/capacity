# Wypchnięcie gałęzi main na GitHub (po utworzeniu pustego repozytorium na github.com).
# Użycie:
#   .\scripts\push-to-github.ps1 -RemoteUrl "https://github.com/TWOJ_USER/capacity-planning.git"
#
# HTTPS: użyj Personal Access Token zamiast hasła (Settings → Developer settings → PAT).
# SSH:  -RemoteUrl "git@github.com:TWOJ_USER/capacity-planning.git"

param(
  [Parameter(Mandatory = $true)]
  [string] $RemoteUrl
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root ".git"))) {
  Write-Error "Brak repozytorium Git w $root — uruchom najpierw inicjalizację (patrz README, sekcja GitHub)."
}

$gitExe = Join-Path $root ".tools\MinGit\cmd\git.exe"
if (-not (Test-Path $gitExe)) { $gitExe = "git" }

Push-Location $root
try {
  & $gitExe remote remove origin 2>$null
  & $gitExe remote add origin $RemoteUrl
  & $gitExe push -u origin main
  Write-Host "Gotowe: $RemoteUrl (gałąź main)"
}
finally {
  Pop-Location
}
