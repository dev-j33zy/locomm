const express = require('express');
const https = require('https');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Detect best local LAN IPv4 address
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// SSL Certificate handling (for LAN use)
const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');

async function getSSLOptions() {
  try {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  } catch {
    try {
      const selfsigned = require('selfsigned');
      const pems = await selfsigned.generate(
        [{ name: 'commonName', value: 'TribeTalk' }],
        { 
          days: 365,
          extensions: [{
            name: 'subjectAltName',
            altNames: [
              { type: 2, value: 'localhost' },
              { type: 7, ip: '127.0.0.1' },
              { type: 7, ip: getLocalIP() }
            ]
          }]
        }
      );
      fs.writeFileSync(keyPath, pems.private);
      fs.writeFileSync(certPath, pems.cert);
      console.log('🔒 Self-signed SSL certificates generated (with SAN).');
      return { key: pems.private, cert: pems.cert };
    } catch (e) {
      console.warn('⚠️  SSL unavailable. Running HTTP.');
      return null;
    }
  }
}

async function startServer() {
const sslOptions = await getSSLOptions();
if (sslOptions) console.log('🔒 SSL enabled.');


const app = express();
app.use(cors());

const APP_VERSION = '1.0.0';
const UPDATE_URL = process.env.UPDATE_URL || null;

// Version check endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: APP_VERSION, updateUrl: UPDATE_URL });
});

// Serve the production frontend
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));

// SPA fallback — serve index.html for any non-API/socket route
app.use((req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = sslOptions
  ? https.createServer(sslOptions, app)
  : http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  perMessageDeflate: false,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket'],
  maxHttpBufferSize: 1e8
});

// Dynamic global channel state
let channels = [
  { id: 'red', name: 'Red Team', color: '#ef4444' },
  { id: 'blue', name: 'Blue Team', color: '#3b82f6' },
  { id: 'green', name: 'Green Team', color: '#10b981' }
];

let GLOBAL_PIN = null; // Uninitialized network password

async function broadcastOnlineUsers() {
  const sockets = await io.fetchSockets();
  const users = sockets.map(s => ({
    id: s.id,
    username: s.username,
    role: s.role,
    channel: s.currentChannel
  })).filter(u => u.username); // Only broadcast those who have fully joined

  io.emit('sync-users', users);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send server network info so the frontend can display connection details
  socket.emit('server-info', { ip: getLocalIP(), port: PORT, version: APP_VERSION });

  // Immediately synchronize the channels array to the connected client
  socket.emit('sync-channels', channels);

  socket.on('join-channel', ({ channel, role, username, password }, callback) => {
    
    if (GLOBAL_PIN === null) {
      if (role === 'master' && password && password.trim() !== '') {
        GLOBAL_PIN = password.trim();
        console.log(`Network claimed. Global PIN initialized by ${username}`);
      } else {
        if (callback) callback({ error: 'System locked: A Director must join first to initialize the Network PIN.' });
        return;
      }
    } else {
      if (password !== GLOBAL_PIN) {
        if (callback) callback({ error: 'Access Denied: Invalid Network PIN.' });
        return;
      }
    }

    socket.username = username || 'Anonymous';
    socket.role = role;
    socket.currentChannel = channel;

    // Leave any previous rooms
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) socket.leave(room);
    });

    if (role === 'master') {
      const masterRoom = io.sockets.adapter.rooms.get('master');
      if (masterRoom && masterRoom.size >= 3) {
        if (callback) callback({ error: 'Director capacity reached (Max 3 Masters allowed).' });
        return;
      }
      socket.join('master'); // Allow master to receive broadcasts
      console.log(`${socket.username} (${socket.id}) joined as MASTER`);
      if (callback) callback({ success: true });
    } else if (channel) {
      socket.join(channel);
      console.log(`${socket.username} (${socket.id}) joined regular channel: ${channel}`);
      if (callback) callback({ success: true });
    }
    broadcastOnlineUsers();
  });

  // Dynamic Channel Configuration (Master Only)
  socket.on('add-channel', (channelData) => {
    if (socket.role === 'master') {
      const exists = channels.find(c => c.id === channelData.id);
      if(!exists) {
        channels.push(channelData);
        io.emit('sync-channels', channels);
      }
    }
  });

  socket.on('update-channel', (channelData) => {
    if (socket.role === 'master') {
      channels = channels.map(c => c.id === channelData.id ? channelData : c);
      io.emit('sync-channels', channels);
    }
  });
  
  socket.on('remove-channel', (channelId) => {
    if (socket.role === 'master') {
      console.log(`Master ${socket.username} requested removal of channel: ${channelId}`);
      channels = channels.filter(c => c.id !== channelId);
      io.emit('sync-channels', channels);
    } else {
      console.warn(`Unauthorized channel removal attempt by ${socket.username} (${socket.role})`);
    }
  });

  socket.on('audio-chunk', ({ chunk, targetChannels, targetUsers, talkbackOnly }) => {
    if (socket.role === 'master') {
      const destinations = new Set();
      
      if (Array.isArray(targetChannels)) {
        if (targetChannels.includes('all')) {
          // Broadcast to everyone EXCEPT other masters who have joined
          for (const [id, s] of io.sockets.sockets) {
            if (s.username && s.role !== 'master' && id !== socket.id) {
              destinations.add(id);
            }
          }
        } else {
          targetChannels.forEach(chan => {
            const room = io.sockets.adapter.rooms.get(chan);
            if (room) {
              for (const id of room) {
                const targetSocket = io.sockets.sockets.get(id);
                if (targetSocket && targetSocket.username && targetSocket.role !== 'master' && id !== socket.id) {
                  destinations.add(id);
                }
              }
            }
          });
        }
      }

      if (Array.isArray(targetUsers)) {
        targetUsers.forEach(userId => {
          const targetSocket = io.sockets.sockets.get(userId);
          if (targetSocket && targetSocket.username && targetSocket.role !== 'master' && userId !== socket.id) {
            destinations.add(userId);
          }
        });
      }

      destinations.forEach(socketId => {
        io.to(socketId).emit('audio-broadcast', { chunk, from: socket.username, channel: 'master-direct' });
      });
    } else {
      // Regular user talking - only to users who have joined
      if (socket.username && socket.currentChannel) {
        if (talkbackOnly) {
          socket.to('master').emit('audio-broadcast', { chunk, from: socket.username, channel: socket.currentChannel });
        } else {
          socket.to(socket.currentChannel).emit('audio-broadcast', { chunk, from: socket.username, channel: socket.currentChannel });
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    broadcastOnlineUsers();
  });
});

const PORT = 3001;
const PROTOCOL = sslOptions ? 'https' : 'http';
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔌 TribeTalk Server running on ${PROTOCOL}://0.0.0.0:${PORT}`);
  console.log(`📱 Access from devices: ${PROTOCOL}://YOUR_LOCAL_IP:${PORT}`);
});
} // end startServer

startServer();
