# LoComm — Local Voice Communication

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

### Supabase Update Checker (Optional)
- Frontend checks for new versions via Supabase
- Shows an update banner when a newer version is available

---

## Architecture

```
LoComm/
├── backend/
│   ├── server.js          # Express + Socket.IO server with Companion API
│   ├── package.json
│   ├── key.pem            # Auto-generated SSL key (gitignored)
│   └── cert.pem           # Auto-generated SSL cert (gitignored)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component (all UI + socket logic)
│   │   ├── App.css        # Styling
│   │   └── main.jsx       # React entry point
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── vercel.json            # Vercel deployment config (frontend only)
├── package.json           # Root package.json (build proxy for Vercel)
├── .gitignore
├── README.md
├── DEPLOYMENT.md
└── PUBLISHING.md
```

---

## Quick Start

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
🔌 TribeTalk Server running on https://0.0.0.0:3001
📱 Access from devices: https://192.168.x.x:3001
```

### 4. Open in Browser

Go to `https://YOUR_LOCAL_IP:3001` on any device connected to the same LAN.

> ⚠️ Accept the self-signed SSL certificate warning in your browser on first visit.

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

1. Open `https://SERVER_IP:3001` in browser
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

LoComm includes a REST API endpoint that BitFocus Companion can control via HTTP.

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

### Server shows "Offline" in the app
- The app connects to the server that served it — both must come from the same backend
- Do not open the frontend from Vercel/GitHub Pages and expect it to connect to a local backend

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

## Environment Variables (Frontend)

Create `frontend/.env.local` for optional Supabase update checking:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-public-key
```

---

## License

ISC