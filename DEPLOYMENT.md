# LoComm Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Network access to all devices (same LAN)
- Web browser with WebRTC support
- Microphone and speakers

## Deployment Options

### Option 1: Single Server Deployment (Recommended)

This is the simplest deployment for LAN use.

#### Step 1: Prepare Server Machine

1. Install Node.js from https://nodejs.org/
2. Create a folder for LoComm

#### Step 2: Deploy Files

Copy the following structure to server:

```
LoComm/
├── backend/
│   ├── server.js
│   ├── key.pem (auto-generated)
│   ├── cert.pem (auto-generated)
│   └── package.json
└── frontend/
    └── dist/ (pre-built)
```

#### Step 3: Start Server

```bash
cd backend
npm install
npm start
```

Server will output:
```
🔒 SSL enabled.
🔌 TribeTalk Server running on https://0.0.0.0:3001
📱 Access from devices: https://YOUR_LOCAL_IP:3001
```

#### Step 4: Client Access

All devices access: `https://SERVER_IP:3001`

---

### Option 2: Development Deployment

For making changes to the application.

#### Backend Development

```bash
cd backend
npm install
npm run dev
```

#### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Development server runs on http://localhost:5173

---

### Option 3: Custom Port Deployment

To run on a different port:

1. Edit `backend/server.js`
2. Change `const PORT = 3001;` to desired port
3. Rebuild frontend to match (optional)

---

## Network Configuration

### Firewall Setup

Allow inbound connections on port 3001:

**Windows (PowerShell as Admin):**
```powershell
New-NetFirewallRule -DisplayName "LoComm" -Direction Inbound -Action Allow -LocalPort 3001 -Protocol TCP
```

**Linux (ufw):**
```bash
sudo ufw allow 3001/tcp
```

### Static IP (Recommended)

Set a static IP for the server machine:

**Windows:** Control Panel > Network and Sharing Center > Change adapter settings > Right-click > Properties > IPv4

**Router:** Access router admin panel and reserve DHCP lease

### DNS (Optional)

For easier access, set up a local DNS entry:

```
locomm.local -> SERVER_IP
```

---

## Production Checklist

### Pre-Deployment

- [ ] Server machine has static IP
- [ ] Firewall configured
- [ ] Frontend built (`npm run build`)
- [ ] Dependencies installed (`npm install`)
- [ ] SSL certificates generated (auto-generated on first run)

### Security

- [ ] Network PIN set by first Director
- [ ] Only trusted users on LAN
- [ ] No port forwarding to internet (keep local-only)

### Performance

- [ ] No more than 20 simultaneous users
- [ ] Stable WiFi connection (5GHz recommended)
- [ ] Low network congestion

---

## Maintenance

### Backup

Back up these files:
- `backend/key.pem`
- `backend/cert.pem`

### Logs

Server outputs to console. To save logs:

```bash
npm start > locomm.log 2>&1 &
```

### Updates

To update the application:

1. Stop server
2. Replace frontend/dist/ files
3. Restart server

---

## Troubleshooting

### Connection Issues

| Issue | Solution |
|-------|----------|
| Can't reach server | Check firewall, verify IP |
| Certificate warning | Accept self-signed cert |
| Slow performance | Check network, reduce users |

### Audio Issues

| Issue | Solution |
|-------|----------|
| Audio stuttering | Reduce simultaneous talkers |
| High latency | Use wired network |
| No audio | Check microphone permissions |

---

## Support

For issues, check:
1. Console errors (F12 > Console)
2. Network tab for connection status
3. Server console for errors