# LoComm — Deployment Guide

## Requirements

- **Node.js** v18 or higher
- **npm** v9 or higher
- A machine on the same LAN as all users
- Web browser with WebRTC + WebSocket support (Chrome, Edge, Firefox, Safari)
- Microphone and speakers/headset

---

## Option 1: LAN Server Deployment (Recommended)

This is the standard, recommended deployment for all production and live event use.

### Step 1: Clone or Copy the Project

```bash
git clone https://github.com/dev-j33zy/locomm.git
cd locomm
```

### Step 2: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 3: Build the Frontend

```bash
cd frontend
npm run build
```

This creates `frontend/dist/` — the production static files served by the backend.

### Step 4: Start the Backend

```bash
cd ../backend
node server.js
```

Expected output:
```
🔒 Self-signed SSL certificates generated (with SAN).
🔒 SSL enabled.
🔌 TribeTalk Server running on https://0.0.0.0:3001
📱 Access from devices: https://192.168.x.x:3001
```

### Step 5: Access on All Devices

Open this URL on any LAN device:
```
https://192.168.x.x:3001
```

> **Important:** Each device must accept the self-signed SSL certificate warning once. In Chrome, click **Advanced → Proceed to 192.168.x.x (unsafe)**.

---

## Option 2: Development Mode

For active frontend development with hot reload.

### Terminal 1 — Backend
```bash
cd backend
npm install
node server.js
```

### Terminal 2 — Frontend Dev Server
```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs at `https://localhost:5173` and proxies WebSocket traffic to the backend on port 3001.

---

## Option 3: Run with Auto-Restart (Production)

Install `nodemon` or `pm2` for production resilience:

```bash
# Using pm2
npm install -g pm2
cd backend
pm2 start server.js --name locomm
pm2 save
pm2 startup
```

---

## Firewall Configuration

Allow inbound TCP on port `3001`:

**Windows (PowerShell — run as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "LoComm" -Direction Inbound -Action Allow -LocalPort 3001 -Protocol TCP
```

**Linux (ufw):**
```bash
sudo ufw allow 3001/tcp
```

---

## Static IP Setup (Strongly Recommended)

Assign a static IP to the server machine so the URL never changes.

**Windows:**
`Control Panel → Network & Sharing Center → Change adapter settings → Right-click adapter → Properties → IPv4`

**Router DHCP Reservation:**
Log into your router admin panel and reserve a fixed IP for the server's MAC address.

**Example hostname shortcut (Windows hosts file):**
```
192.168.1.10   locomm.local
```
Then access: `https://locomm.local:3001`

---

## SSL Certificates

SSL certificates are **auto-generated on first server start** using the `selfsigned` package.

- Saved to `backend/key.pem` and `backend/cert.pem`
- Valid for 365 days
- Includes SAN entries for `localhost`, `127.0.0.1`, and the detected LAN IP

**Bring your own certificate (optional):**
Place your own `key.pem` and `cert.pem` files in the `backend/` folder before starting the server.

---

## BitFocus Companion REST API

The backend exposes a REST endpoint for StreamDeck control via BitFocus Companion:

```
GET http://SERVER_IP:3001/api/companion?action=<action>&target=<target>
```

| Parameter | Description |
|-----------|-------------|
| `action` | `ptt-down`, `ptt-up`, `ptt-toggle`, `toggle-target`, `clear-targets` |
| `target` | Channel ID (`red`, `blue`) or username (`John`) — used with `toggle-target` |

> No authentication required on LAN. Actions are routed only to connected Master (Director) clients.

---

## Production Checklist

### Before Going Live
- [ ] Server machine has a static IP
- [ ] Firewall allows port 3001
- [ ] Frontend has been built (`npm run build`)
- [ ] Backend dependencies installed (`npm install`)
- [ ] SSL certs exist or are auto-generated on first run

### Network
- [ ] All client devices are on the same LAN
- [ ] No port forwarding to the internet (LAN-only)
- [ ] 5GHz WiFi or wired ethernet on server machine

### Security
- [ ] Network PIN set by the first Director
- [ ] No unauthorized users on the LAN

---

## Updating the App

```bash
# 1. Stop the server (Ctrl+C or pm2 stop locomm)
# 2. Pull latest changes
git pull origin main

# 3. Rebuild frontend
cd frontend
npm install
npm run build

# 4. Restart backend
cd ../backend
npm install
node server.js
```

---

## Logs

To save server output to a log file:

```bash
node server.js > locomm.log 2>&1 &
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't reach server | Check firewall, verify LAN IP, ensure server is running |
| SSL certificate warning | Accept it in browser (one time per device) |
| "Server Offline" in app | Use the LAN IP URL served by the backend, not Vercel |
| Audio stuttering | Move to stronger WiFi or use wired connection |
| Companion not working | Ensure Director is logged in; test URL in browser manually |
| Port already in use | Kill the process using port 3001 or change `PORT` in `server.js` |