param(
    [ValidateSet("approve", "reject")]
    [string]$FinalDecision = "approve",
    [string]$BackendJar = "",
    [switch]$Headed
)

$ErrorActionPreference = "Stop"
$frontend = Split-Path -Parent $PSScriptRoot
Set-Location $frontend

Write-Host "SWP REAL-DATA REACT UI AUTOMATION" -ForegroundColor Cyan
Write-Host "Frontend: $frontend"
Write-Host "Final decision: $FinalDecision"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is not installed or is not on PATH."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not installed or is not on PATH."
}

npm config set registry https://registry.npmjs.org/ | Out-Null
npm config delete proxy 2>$null
npm config delete https-proxy 2>$null

if (-not (Test-Path ".\node_modules\playwright-core")) {
    Write-Host "Installing frontend test dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
}

if ([string]::IsNullOrWhiteSpace($BackendJar)) {
    $candidate = Join-Path (Split-Path -Parent $frontend) "SWP_BACKEND\target\backend-0.0.1-SNAPSHOT.jar"
    if (Test-Path $candidate) { $BackendJar = $candidate }
}

$argsList = @("tests/real-data-e2e.mjs", "--final=$FinalDecision")
if ($Headed) { $argsList += "--headed" }
if (-not [string]::IsNullOrWhiteSpace($BackendJar)) {
    $resolvedJar = (Resolve-Path $BackendJar).Path
    $argsList += "--jar=$resolvedJar"
    Write-Host "Backend JAR: $resolvedJar"
} else {
    Write-Host "No JAR path found. The test will use an already-running backend on port 8080." -ForegroundColor Yellow
}

& node @argsList
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "Real-data UI automation FAILED. Check SWP_FRONTEND\e2e-results." -ForegroundColor Red
    exit $exitCode
}

Write-Host "Real-data UI automation PASSED. Check SWP_FRONTEND\e2e-results." -ForegroundColor Green
