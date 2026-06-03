# ClientSideEdit — Vencord Plugin Setup Guide

Right-click any Discord message → **Edit locally ✎** to change its displayed text.
Only you see the change. Nobody else is affected. Resets on reload.

---

## Prerequisites

- **Git** — https://git-scm.com/download/win
- **Node.js LTS** — https://nodejs.org (download and run the installer)
- **Discord desktop** with Vencord already installed via the GUI installer

---

## First-time setup

### 1. Clone Vencord source

```powershell
git clone https://github.com/Vendicated/Vencord C:\Users\<you>\Vencord
```

### 2. Install pnpm

```powershell
npm install -g pnpm
```

### 3. Install dependencies

```powershell
cd C:\Users\<you>\Vencord
pnpm install --frozen-lockfile
```

### 4. Copy the plugin

```powershell
New-Item -ItemType Directory -Force "C:\Users\<you>\Vencord\src\userplugins"
Copy-Item "clientSideEdit.tsx" "C:\Users\<you>\Vencord\src\userplugins\clientSideEdit.tsx"
```

### 5. Build

```powershell
pnpm build
```

### 6. Inject into Discord

```powershell
pnpm inject
```

Select **Stable** with the arrow keys and press Enter.

### 7. Enable in Discord

1. Fully quit Discord (tray icon → Quit)
2. Reopen Discord
3. Vencord Settings → Plugins → search **ClientSideEdit** → toggle on

---

## Updating the plugin after edits

```powershell
cd C:\Users\<you>\Vencord
Copy-Item "path\to\clientSideEdit.tsx" "src\userplugins\clientSideEdit.tsx" -Force
pnpm build
pnpm inject
```

Then restart Discord.

---

## Updating Vencord itself

```powershell
cd C:\Users\<you>\Vencord
git pull
pnpm install --frozen-lockfile
pnpm build
pnpm inject
```

---

## Usage

| Action | How |
|---|---|
| Edit a message locally | Right-click message → **Edit locally ✎** |
| Reset to original | Right-click → **Edit locally ✎ (active)** → Reset to original |
| Apply edit | Click Apply or press Enter |
| Cancel | Click Cancel or press Esc |

Edits are **in-memory only** — they reset when Discord reloads or you switch accounts.
