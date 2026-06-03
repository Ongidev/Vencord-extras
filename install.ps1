# Run this from the clientSideEdit folder.
# It will copy the plugin, build Vencord, and inject it into Discord.
# Requires Vencord already cloned to C:\Users\<you>\Vencord and pnpm installed.

param(
    [string]$VencordPath = "$env:USERPROFILE\Vencord"
)

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$pluginSrc  = Join-Path $PSScriptRoot "clientSideEdit.tsx"
$pluginDest = Join-Path $VencordPath  "src\userplugins\clientSideEdit.tsx"

if (-not (Test-Path $VencordPath)) {
    Write-Error "Vencord not found at $VencordPath. Clone it first: git clone https://github.com/Vendicated/Vencord $VencordPath"
    exit 1
}

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
