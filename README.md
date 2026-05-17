<img width="1920" height="962" alt="1 - Setup Screen" src="https://github.com/user-attachments/assets/d41111cb-92a8-40d4-80bc-49342a6ec8a6" />
<br>
<img width="1920" height="962" alt="2 - User Screen" src="https://github.com/user-attachments/assets/d39dd26a-3bee-4d19-8fca-fcdab4f1544d" />
<br>
<img width="1920" height="963" alt="3 - Master Screen" src="https://github.com/user-attachments/assets/9eb48abe-1b64-4d06-ae12-f2afa9ecaeba" />
<br>

# SECTalk — Secure Encrypted Communication

> A real-time, low-latency Push-to-Talk (PTT) voice communication dashboard for local networks. Designed for production, broadcast, live events, and team operations.

---

## Features

### Core Communication
- **Push-to-Talk (PTT)** — Hold or Toggle mode, fully configurable
- **Channel-based routing** — Broadcast to specific teams (e.g. Red, Blue, Green)
- **Broadcast to All** — Director sends voice to every connected user
- **Individual User Targeting** — Send voice directly to a specific user
- **Talkback** — Regular users can privately respond to Directors
- **Active Talker Indicator** — Real-time UI shows who is currently speaking

### Roles
- **Master (Director)** — Full control. Can broadcast to all/channels/users, manage channels, and set the Network PIN. Up to 3 Masters allowed simultaneously.
- **Regular User** — Joins a channel, uses PTT to communicate within it, can talkback to Directors

### Channel Management (Director Only)
- Dynamically create and delete channels
- Assign custom colors per channel
- Real-time sync to all connected clients

### StreamDeck / BitFocus Companion Integration
- Full HTTP REST API (`/api/companion`) for external control
- Supported actions: `ptt-down`, `ptt-up`, `ptt-toggle`, `toggle-target`, `clear-targets`
- No PIN required for Companion on local LAN

### Network & Security
- **SSL/TLS encrypted** (self-signed cert auto-generated on first run)
- **Global Network PIN** — set by the first Director, required for all users to join
- **Max payload size**: 1MB (protects against DoS)
- **LAN-only** — no internet dependency, no cloud required

### UI / UX
- Fullscreen mode
- Wake Lock (keeps screen on during operation)
- Hold / Toggle PTT mode selector
- Custom PTT keyboard key mapping
- Audio device selection (Input + Output)
- Settings persist across sessions (localStorage)

---

## Architecture

```
SECTalk/
├── SECTalk.exe              # Desktop launcher (GUI)
├── SECTalk-Setup-1.0.1.exe  # Windows installer (self-contained)
├── launcher.py              # Launcher source code
├── installer.iss            # Inno Setup installer script
├── backend/
│   ├── server.js            # Express + Socket.IO server with Companion API
│   ├── package.json
│   ├── node_modules/        # Backend dependencies
│   ├── key.pem              # Auto-generated SSL key (gitignored)
│   └── cert.pem             # Auto-generated SSL cert (gitignored)
├── frontend/
│   ├── dist/                # Pre-built production frontend
│   ├── src/
│   │   ├── App.jsx          # Main React component (all UI + socket logic)
│   │   ├── App.css          # Styling
│   │   └── main.jsx         # React entry point
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json             # Root package.json
├── .gitignore
├── README.md
├── DEPLOYMENT.md
└── PUBLISHING.md
```

---

## Quick Start (Windows Installer)

The easiest way to run SECTalk — **no development tools required**.

### 1. Run the Installer

Double-click **`SECTalk-Setup-1.0.1.exe`** and follow the wizard. This installs:
- `SECTalk.exe` — Desktop launcher
- Portable Node.js runtime (bundled)
- Backend server + all dependencies
- Pre-built frontend

### 2. Launch

Open **SECTalk** from the Start Menu or Desktop shortcut.

### 3. Start the Server

Click **▶ START SERVER** — the launcher starts the backend and opens your browser automatically.

### 4. Connect Devices

Open `https://YOUR_LOCAL_IP:3001/` on any device connected to the same LAN.

> ⚠️ Accept the self-signed SSL certificate warning in your browser on first visit.

---

## Quick Start (Manual / Development)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Build the Frontend

```bash
cd frontend
npm run build
```

### 3. Start the Server

```bash
cd ../backend
node server.js
```

Server output:
```
🔒 Self-signed SSL certificates generated.
🔒 SSL enabled.
🔌 SECTalk Server running on https://0.0.0.0:3001
📱 Access from devices: https://192.168.x.x:3001
```

### 4. Open in Browser

Go to `https://YOUR_LOCAL_IP:3001/` on any device connected to the same LAN.

---

## Setup & Usage

### First Launch — Creating a Network

1. Open the app in your browser
2. Set a **Username**
3. Select **Master (Director)** as your role
4. Enter a **Network PIN** (this becomes the password for your session)
5. Select your audio **Input** and **Output** devices
6. Map your **PTT Key** (press to bind any key)
7. Click **Join Network**

### Joining as a Regular User

1. Open `https://SERVER_IP:3001/` in browser
2. Set a **Username**
3. Select **Regular User** role
4. Enter the **Network PIN** provided by the Director
5. Select your **Channel** (Red Team, Blue Team, etc.)
6. Select audio devices and PTT key
7. Click **Join Network**

---

## Director Controls

| Control | Description |
|---------|-------------|
| Broadcast to All | Sends voice to every non-Master user |
| Channel Buttons | Toggle routing to a specific channel |
| User Tags | Click a username to target that individual |
| Add Channel | Create a new team channel with a custom color |
| Remove Channel | Delete a channel (trash icon) |
| Hold / Toggle Mode | Switch PTT behavior |

---

## BitFocus Companion & StreamDeck

SECTalk includes a REST API endpoint that BitFocus Companion can control via HTTP.

### Setup in Companion
Use the **"Generic HTTP"** module with **GET** requests to:

```
http://YOUR_BACKEND_IP:3001/api/companion?action=<action>&target=<target>
```

### Available Actions

| Button | URL |
|--------|-----|
| PTT Down (Key Down) | `?action=ptt-down` |
| PTT Up (Key Up) | `?action=ptt-up` |
| PTT Toggle | `?action=ptt-toggle` |
| Broadcast to All | `?action=toggle-target&target=all` |
| Red Team Toggle | `?action=toggle-target&target=red` |
| Blue Team Toggle | `?action=toggle-target&target=blue` |
| Target User "John" | `?action=toggle-target&target=John` |
| Clear All Targets | `?action=clear-targets` |

> **Note:** `target` for channels uses the channel ID (e.g. `red`, `blue`). For users, it uses the exact username entered on their setup screen.

---

## Audio Configuration

| Setting | Value |
|---------|-------|
| Sample Rate | 48kHz (device native) |
| Buffer Size | 8192 frames |
| Noise Gate | 0.01 RMS threshold |
| Transport | WebSocket (binary) |
| Max Payload | 1MB |

---

## Troubleshooting

### Can't connect to server
- Ensure the backend server is running
- Check your firewall allows port `3001`
- Use the server's **LAN IP**, not `localhost`
- Accept the SSL certificate warning in your browser

### Audio stuttering
- Move to a stronger WiFi signal (5GHz recommended)
- Reduce simultaneous active talkers
- Use wired ethernet on the server machine

### Certificate warning on browser
- This is expected with self-signed SSL
- Click "Advanced" → "Proceed anyway" to accept

### Companion actions not working
- Ensure the Director is logged in (Companion actions only fire to Master clients)
- Verify backend is reachable at `http://IP:3001/api/companion?action=ptt-down`

---

## License

ISC
