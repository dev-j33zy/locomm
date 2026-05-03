# LoComm - Local Voice Communication

A real-time voice chat application for local networks. Perfect for gaming, teams, and small groups that need low-latency voice communication without internet dependency.

## Features

- **Push-to-Talk (PTT)** voice communication
- **Channel-based** team groups (Red, Blue, Green)
- **Master/Director** role for network control
- **Talkback** feature for private responses to masters
- **LAN-optimized** for minimal latency
- **Multi-user support** (up to 20 simultaneous users)
- **SSL-secured** local communication
- **Dynamic channel** creation and management

## Architecture

```
LoComm/
├── backend/           # Node.js + Express + Socket.IO server
│   ├── server.js     # Main server (Express + WebSocket)
│   ├── key.pem      # Auto-generated SSL key
│   └── cert.pem     # Auto-generated SSL cert
└── frontend/        # React + Vite web app
    ├── src/
    │   ├── App.jsx # Main React component
    │   └── index.css
    └── dist/       # Built production files
```

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Build Frontend

```bash
cd frontend
npm run build
```

### 3. Start Server

```bash
cd backend
node server.js
```

The server runs on **https://YOUR_LOCAL_IP:3001**

### 4. Access the App

Open in browser: `https://YOUR_LOCAL_IP:3001`

On mobile devices connected to the same LAN, use the same URL.

## Network Setup

### For First Use (Creating Network)

1. Open the app
2. Select **Master (Director)** role
3. Enter a **Network PIN** (password) for your network
4. Click **Join Network**

### For Subsequent Users

1. Open the app
2. Select **Regular User** role
3. Enter the **Network PIN** provided by the Director
4. Select a **Channel** (Red/Blue/Green)
5. Click **Join Network**

## Usage

### Push-to-Talk

- **Hold** the PTT button or key to talk
- **Release** to stop transmitting
- Works with keyboard key set in settings

### Talkback (Private to Master)

- Use the separate Talkback button on regular user view
- Only the masters will hear your response

### Director Controls

- **Broadcast to All**: Send voice to all regular users
- **Channel Select**: Send voice to specific team channels
- **User Select**: Send voice to specific users
- **Add Channel**: Create new team channels
- **Remove Channel**: Delete channels

## Configuration

### Audio Settings

- Input device selection (microphone)
- Output device selection (speaker)
- Custom PTT key mapping

### Network Settings

- Network PIN (set by first Director)
- Channel assignment

## Technical Details

### Audio Processing

- Sample rate: 48kHz
- Buffer size: 8192 frames (optimized for LAN)
- Noise threshold: 0.01 RMS
- WebSocket transport for real-time delivery

### Network

- Port: 3001
- Protocol: HTTPS (self-signed SSL)
- Max users: 20 simultaneous

## Troubleshooting

### Can't connect to server

1. Ensure server is running
2. Check firewall allows port 3001
3. Verify you're on the same LAN
4. Use correct IP address (not localhost)

### Audio stuttering

1. Check network bandwidth
2. Reduce number of simultaneous talkers
3. Ensure stable WiFi connection

### Fullscreen not working

1. Ensure browser supports Fullscreen API
2. Check browser permissions

## License

ISC