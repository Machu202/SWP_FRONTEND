param(
    [string]$BackendJar = "",
    [switch]$Headed
)

$ErrorActionPreference = "Stop"
$frontend = Split-Path -Parent $PSScriptRoot
Set-Location $frontend

Write-Host "SWP REAL-DATA ROLE DISPLAY AUDIT" -ForegroundColor Cyan
Write-Host "This audit is read-only: it logs in and views current data without creating or updating records."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed or is not on PATH." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not installed or is not on PATH." }

npm config set registry https://registry.npmjs.org/ | Out-Null
npm config delete proxy 2>$null
npm config delete https-proxy 2>$null

if (-not (Test-Path ".\node_modules\playwright-core")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
}

if ([string]::IsNullOrWhiteSpace($BackendJar)) {
    $candidate = Join-Path (Split-Path -Parent $frontend) "SWP_BACKEND\target\backend-0.0.1-SNAPSHOT.jar"
    if (Test-Path $candidate) { $BackendJar = $candidate }
}

$argsList = @("tests/role-display-audit.mjs")
if ($Headed) { $argsList += "--headed" }
if (-not [string]::IsNullOrWhiteSpace($BackendJar)) {
    $argsList += "--jar=$((Resolve-Path $BackendJar).Path)"
}

& node @argsList
$exitCode = $LASTEXITCODE

$latest = Get-ChildItem ".\display-audit-results" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($latest) {
    $html = Join-Path $latest.FullName "display-audit.html"
    Write-Host "Audit output: $($latest.FullName)" -ForegroundColor Green
    if (Test-Path $html) { Start-Process $html }
}

exit $exitCode
