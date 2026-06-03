# Fully automated ClientSideEdit installer.
# Clones Vencord if missing, installs deps, copies plugin, builds, and injects into Discord.

param(
    [string]$VencordPath = "$env:USERPROFILE\Vencord"
)

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# ── Check Node / pnpm ────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed. Download it from https://nodejs.org and re-run this script."
    exit 1
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "[setup] Installing pnpm..." -ForegroundColor Cyan
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) { Write-Error "pnpm install failed."; exit 1 }
}

# ── Clone Vencord if missing ─────────────────────────────────────────────────
if (-not (Test-Path $VencordPath)) {
    Write-Host "[setup] Cloning Vencord to $VencordPath..." -ForegroundColor Cyan
    git clone https://github.com/Vendicated/Vencord $VencordPath
    if ($LASTEXITCODE -ne 0) { Write-Error "git clone failed."; exit 1 }
}

# ── Install deps if node_modules missing ─────────────────────────────────────
if (-not (Test-Path (Join-Path $VencordPath "node_modules"))) {
    Write-Host "[setup] Installing Vencord dependencies..." -ForegroundColor Cyan
    Push-Location $VencordPath
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "pnpm install failed."; exit 1 }
    Pop-Location
}

# ── Auto-find clientSideEdit.tsx ─────────────────────────────────────────────
$pluginSrc = Join-Path $PSScriptRoot "clientSideEdit.tsx"

if (-not (Test-Path $pluginSrc)) {
    Write-Host "clientSideEdit.tsx not next to script, searching..." -ForegroundColor Yellow
    $found = Get-ChildItem -Path $env:USERPROFILE -Filter "clientSideEdit.tsx" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $pluginSrc = $found.FullName
        Write-Host "      Found: $pluginSrc" -ForegroundColor Yellow
    } else {
        Write-Error "Could not find clientSideEdit.tsx anywhere under $env:USERPROFILE"
        exit 1
    }
}

$pluginDest = Join-Path $VencordPath "src\userplugins\clientSideEdit.tsx"

# ── Copy plugin ───────────────────────────────────────────────────────────────
Write-Host "[1/3] Copying plugin..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force (Split-Path $pluginDest) | Out-Null
Copy-Item $pluginSrc $pluginDest -Force
Write-Host "      Copied to $pluginDest"

# ── Build ─────────────────────────────────────────────────────────────────────
Write-Host "[2/3] Building Vencord..." -ForegroundColor Cyan
Push-Location $VencordPath
pnpm build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Build failed."; exit 1 }

# ── Inject ────────────────────────────────────────────────────────────────────
Write-Host "[3/3] Injecting into Discord..." -ForegroundColor Cyan
pnpm inject
Pop-Location

Write-Host ""
Write-Host "Done! Restart Discord and enable ClientSideEdit in Vencord Settings -> Plugins." -ForegroundColor Green

Write-Host "[1/3] Copying plugin..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force (Split-Path $pluginDest) | Out-Null
Copy-Item $pluginSrc $pluginDest -Force
Write-Host "      Copied to $pluginDest"

Write-Host "[2/3] Building Vencord..." -ForegroundColor Cyan
Push-Location $VencordPath
pnpm build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Build failed."; exit 1 }

Write-Host "[3/3] Injecting into Discord..." -ForegroundColor Cyan
pnpm inject
Pop-Location

Write-Host ""
Write-Host "Done! Restart Discord and enable ClientSideEdit in Vencord Settings -> Plugins." -ForegroundColor Green
