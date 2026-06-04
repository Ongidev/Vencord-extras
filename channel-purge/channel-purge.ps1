# Fully automated ChannelPurge installer.
# Clones Vencord if missing, installs deps, downloads plugin from GitHub, builds, and injects into Discord.
#
# ── Run directly from PowerShell (no download needed) ──────────────────────────
#
#   irm https://raw.githubusercontent.com/Ongidev/Vencord-extras/refs/heads/main/channelPurge/install-channelPurge.ps1 | iex
#
# ──────────────────────────────────────────────────────────────────────────────

param(
    [string]$VencordPath = "$env:USERPROFILE\Vencord"
)

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Force TLS 1.2 so GitHub doesn't silently hang the connection
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ── Check Node / pnpm ────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not installed. Download it from https://nodejs.org and re-run this script." -ForegroundColor Red
    return
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "[setup] Installing pnpm..." -ForegroundColor Cyan
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] pnpm install failed." -ForegroundColor Red; return }
}

# ── Clone Vencord if missing ─────────────────────────────────────────────────
if (-not (Test-Path $VencordPath)) {
    Write-Host "[setup] Cloning Vencord to $VencordPath..." -ForegroundColor Cyan
    git clone https://github.com/Vendicated/Vencord $VencordPath
    if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] git clone failed." -ForegroundColor Red; return }
}

# ── Install deps if node_modules missing ─────────────────────────────────────
if (-not (Test-Path (Join-Path $VencordPath "node_modules"))) {
    Write-Host "[setup] Installing Vencord dependencies..." -ForegroundColor Cyan
    Push-Location $VencordPath
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "[ERROR] pnpm install failed." -ForegroundColor Red; return }
    Pop-Location
}

# ── Download channelPurge.tsx from GitHub ────────────────────────────────────
$pluginUrl  = "https://raw.githubusercontent.com/Ongidev/Vencord-extras/refs/heads/main/channel-purge/channelpurge.tsx"
$pluginDest = Join-Path $VencordPath "src\userplugins\channelPurge.tsx"

Write-Host "[1/3] Downloading plugin from GitHub..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force (Split-Path $pluginDest) | Out-Null
try {
    Invoke-WebRequest -Uri $pluginUrl -OutFile $pluginDest -UseBasicParsing -TimeoutSec 30
    Write-Host "      Saved to $pluginDest"
} catch {
    Write-Host "[ERROR] Failed to download plugin: $_" -ForegroundColor Red
    return
}

# ── Build ─────────────────────────────────────────────────────────────────────
Write-Host "[2/3] Building Vencord..." -ForegroundColor Cyan
Push-Location $VencordPath
pnpm build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "[ERROR] Build failed." -ForegroundColor Red; return }

# ── Inject ────────────────────────────────────────────────────────────────────
Write-Host "[3/3] Injecting into Discord..." -ForegroundColor Cyan
pnpm inject
Pop-Location

Write-Host ""
Write-Host "Done! Restart Discord and enable ChannelPurge in Vencord Settings -> Plugins." -ForegroundColor Green
