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
pyinstaller --onefile --windowed --name "SECTalk" --icon SECTalk.ico --add-data "SECTalk.ico;." --clean launcher.py
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

### Step 5: Code-Sign the Binaries (optional but required to clear SmartScreen)

Windows flags unsigned installers with "Windows protected your PC". To remove that warning, sign the binaries with a trusted code-signing certificate (see Part 2B below).

```powershell
# Signed with a code-signing cert (.pfx):
.\sign-installer.ps1 -CertPath ".\cert\SECTalkSigning.pfx" -CertPassword "your-password"

# Or let signtool pick the cert from the current user's certificate store:
.\sign-installer.ps1 -CertPath ".\cert\SECTalkSigning.pfx"
```

`sign-installer.ps1` signs **both** the installer (`SECTalk-Setup-*.exe`) and the launcher (`dist\SECTalk.exe`), adds an SHA-256 DigiCert timestamp, and verifies the result. SmartScreen reputation itself still builds gradually with downloads.

`signtool.exe` comes with the Windows SDK; if it's not at the default path, install "Windows SDK" via the Visual Studio Installer, or run `dotnet tool install --tool-path . signtool`. Pass its full path with `-SignToolPath`.

### Step 6: Clean Up

```powershell
Remove-Item -Recurse -Force node
```

The `node/` folder is only needed during installer build and is gitignored.

---

## Part 2B: Code-Signing Certificate Options

| Option | Cost | SmartScreen warning gone? | Notes |
|--------|------|--------------------------|-------|
| **EV (Extended Validation)** | ~$300–400/yr | Yes, immediately | Requires USB token/HSM or cloud signing; company identity verification. Best result. |
| **OV (Organization Validation)** | ~$200–300/yr | Gains reputation over time | Good value; warning disappears for most users after enough downloads. |
| **Azure Trusted Signing** | ~$10/mo | Partial (reputation over time) | Cheap cloud signing; no hardware token needed. No instant reputation. |
| Self-signed | Free | No | Only silences the warning on machines you explicitly trust. |

**Manual signing without the script:**

```bash
signtool sign /fd SHA256 /t http://timestamp.digicert.com /f yourcert.pfx /p <password> /a dist\SECTalk.exe
signtool sign /fd SHA256 /t http://timestamp.digicert.com /f yourcert.pfx /p <password> /a SECTalk-Setup-1.1.0.exe
```

Key rules:
- **Sign the installer `.exe` itself** — that's what SmartScreen examines, not just the launcher.
- **Always use a timestamp** (`/t http://timestamp.digicert.com`). An undated signature looks expired and re-triggers the warning.
- **Never re-sign without a timestamp** and never strip existing signatures (`SignTool remove`) unless re-signing immediately.

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
pyinstaller --onefile --windowed --name "SECTalk" --icon SECTalk.ico --add-data "SECTalk.ico;." --clean launcher.py

# 4. Download portable Node.js (if not cached)
# 5. Compile installer
"path\to\ISCC.exe" installer.iss

# 6. Code-sign both exes (skip if you have no cert yet)
.\sign-installer.ps1 -CertPath ".\cert\SECTalkSigning.pfx" -CertPassword "your-password"

# 7. Tag and push
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
| 7 | Code-sign installer + launcher (`sign-installer.ps1`, optional) |
| 8 | Create GitHub release with `.exe` attached |
| 9 | Distribute installer to users |

---

## Support

- GitHub Issues: https://github.com/dev-j33zy/locomm/issues
- Browser Console (F12 → Console) for frontend errors
- SECTalk Launcher log panel for server errors