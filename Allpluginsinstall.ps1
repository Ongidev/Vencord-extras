# install-all.ps1 — Downloads and installs ALL Vencord extras plugins.
# Plugins fetched from: https://github.com/Ongidev/Vencord-extras
#
# ── Run directly from PowerShell (no download needed) ──────────────────────────
#
#   irm https://raw.githubusercontent.com/Ongidev/Vencord-extras/refs/heads/main/install-all.ps1 | iex
#
# ── Or install individual plugins ─────────────────────────────────────────────
#
#   irm https://raw.githubusercontent.com/Ongidev/Vencord-extras/refs/heads/main/clientSideEdit/install-clientSideEdit.ps1 | iex
#   irm https://raw.githubusercontent.com/Ongidev/Vencord-extras/refs/heads/main/channelPurge/install-channelPurge.ps1 | iex
#
# ──────────────────────────────────────────────────────────────────────────────

param(
    [string]$VencordPath = "$env:USERPROFILE\Vencord"
)

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Force TLS 1.2 so GitHub doesn't silently hang the connection
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Plugins = @(
    @{
        Name     = "clientSideEdit"
        Url      = "https://raw.githubusercontent.com/Ongidev/Vencord-extras/refs/heads/main/Client-side-edit/clientSideEdit.tsx"
        DestFile = "clientSideEdit.tsx"
    },
    @{
        Name     = "channelPurge"
        Url      = "https://raw.githubusercontent.com/Ongidev/Vencord-extras/refs/heads/main/channel-purge/channelpurge.tsx"
        DestFile = "channelPurge.tsx"
    }
)

# ── Check Node ────────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed. Download it from https://nodejs.org and re-run this script."
    exit 1
}

# ── Check / install pnpm ──────────────────────────────────────────────────────
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "[setup] Installing pnpm..." -ForegroundColor Cyan
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) { Write-Error "pnpm install failed."; exit 1 }
}

# ── Clone Vencord if missing ──────────────────────────────────────────────────
if (-not (Test-Path $VencordPath)) {
    Write-Host "[setup] Cloning Vencord to $VencordPath..." -ForegroundColor Cyan
    git clone https://github.com/Vendicated/Vencord $VencordPath
    if ($LASTEXITCODE -ne 0) { Write-Error "git clone failed."; exit 1 }
}

# ── Install deps if node_modules missing ──────────────────────────────────────
if (-not (Test-Path (Join-Path $VencordPath "node_modules"))) {
    Write-Host "[setup] Installing Vencord dependencies..." -ForegroundColor Cyan
    Push-Location $VencordPath
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "pnpm install failed."; exit 1 }
    Pop-Location
}

# ── Download all plugins ──────────────────────────────────────────────────────
$pluginsDir = Join-Path $VencordPath "src\userplugins"
New-Item -ItemType Directory -Force $pluginsDir | Out-Null

$i = 1
foreach ($p in $Plugins) {
    $dest = Join-Path $pluginsDir $p.DestFile
    Write-Host "[$i/$($Plugins.Count)] Downloading $($p.Name)..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $p.Url -OutFile $dest -UseBasicParsing -TimeoutSec 30
        Write-Host "      Saved to $dest"
    } catch {
        Write-Error "Failed to download $($p.Name): $_"
        exit 1
    }
    $i++
}

# ── Build ─────────────────────────────────────────────────────────────────────
Write-Host "[$i/$($Plugins.Count + 1)] Building Vencord..." -ForegroundColor Cyan
Push-Location $VencordPath
pnpm build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Build failed."; exit 1 }

# ── Inject ────────────────────────────────────────────────────────────────────
Write-Host "[$($Plugins.Count + 2)/$($Plugins.Count + 2)] Injecting into Discord..." -ForegroundColor Cyan
pnpm inject
Pop-Location

Write-Host ""
Write-Host "Done! Restart Discord and enable the plugins in Vencord Settings -> Plugins:" -ForegroundColor Green
foreach ($p in $Plugins) {
    Write-Host "  • $($p.Name)" -ForegroundColor Green
}
