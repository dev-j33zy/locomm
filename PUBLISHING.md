# SECTalk — Publishing & Release Guide

This guide covers GitHub publishing, building the Windows installer, and creating releases.

---

## Part 1: GitHub Repository Setup

### 1. Install Git

Download from: https://git-scm.com/

### 2. Create a GitHub Repository

1. Go to https://github.com/new
2. Repository name: `sectalk`
3. Description: `Real-time PTT voice communication for local networks`
4. Visibility: **Public** (or Private)
5. Click **Create repository**

### 3. Initialize and Push

```bash
cd SECTalk

git init
git add .
git commit -m "feat: initial release v1.0.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sectalk.git
git push -u origin main
```

### 4. What's in .gitignore

The project `.gitignore` excludes:
- `node_modules/` (both frontend and backend)
- `.env` and `.env.local` (secrets)
- `backend/key.pem` and `backend/cert.pem` (SSL certificates)
- `node/` (portable Node.js, only needed during installer build)
- PyInstaller temp files (`*.spec`, `__pycache__/`)

---

## Part 2: Building the Windows Installer

### Prerequisites

- **Python 3.10+** with `pyinstaller` (`pip install pyinstaller`)
- **Inno Setup 6** (https://jrsoftware.org/isdown.php)
- **Node.js** installed on your build machine

### Step 1: Build the Frontend

```bash
cd frontend
npm install
npm run build
```

### Step 2: Build the Launcher .exe

```bash
pyinstaller --onefile --windowed --name "SECTalk" --clean launcher.py
move dist\SECTalk.exe .\SECTalk.exe
rmdir /s /q build dist
del SECTalk.spec
```

### Step 3: Download Portable Node.js

Download the Windows x64 ZIP from https://nodejs.org/ and extract to a `node/` folder in the project root. Only `node.exe` is required for the installer.

```powershell
Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip" -OutFile "node-portable.zip"
Expand-Archive "node-portable.zip" -DestinationPath "node-temp"
Move-Item "node-temp\node-v22.14.0-win-x64" "node"
Remove-Item -Recurse -Force "node-temp", "node-portable.zip"
```

### Step 4: Compile the Installer

```bash
"C:\Users\USERNAME\AppData\Local\Programs\Inno Setup 6\ISCC.exe" installer.iss
```

Output: `SECTalk-Setup-1.0.1.exe`

### Step 5: Clean Up

```powershell
Remove-Item -Recurse -Force node
```

The `node/` folder is only needed during installer build and is gitignored.

---

## Part 3: Creating GitHub Releases

### 1. Tag and Create Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

Then on GitHub:
1. Go to **Releases → Create a new release**
2. Tag: `v1.0.0`
3. Title: `v1.0.0 — Initial Release`
4. Add release notes
5. Attach `SECTalk-Setup-1.0.1.exe` as a binary asset
6. Publish

### 2. Subsequent Releases

For each new version:

```bash
# 1. Make your changes
# 2. Rebuild frontend
cd frontend && npm run build

# 3. Rebuild launcher
pyinstaller --onefile --windowed --name "SECTalk" --clean launcher.py

# 4. Download portable Node.js (if not cached)
# 5. Compile installer
"path\to\ISCC.exe" installer.iss

# 6. Tag and push
git add -A
git commit -m "release: v1.1.0"
git tag v1.1.0
git push origin main --tags
```

Then create a GitHub Release and attach the new `.exe`.

---

## Part 4: Distribution

### Windows Installer (Recommended)

Share `SECTalk-Setup-x.x.x.exe` with your users. It includes:
- SECTalk launcher GUI
- Portable Node.js runtime
- Backend server + all dependencies
- Pre-built production frontend

**No Node.js, npm, or any development tools** are required on the target machine.

### Manual Deployment

For advanced users or non-Windows platforms, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Part 5: Summary Checklist

| Step | Action |
|------|--------|
| 1 | Create GitHub repository |
| 2 | Push code with git |
| 3 | Build frontend (`npm run build`) |
| 4 | Build launcher (`pyinstaller`) |
| 5 | Download portable Node.js |
| 6 | Compile installer (Inno Setup) |
| 7 | Create GitHub release with `.exe` attached |
| 8 | Distribute installer to users |

---

## Support

- GitHub Issues: https://github.com/dev-j33zy/locomm/issues
- Browser Console (F12 → Console) for frontend errors
- SECTalk Launcher log panel for server errors