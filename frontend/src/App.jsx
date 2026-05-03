import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { createClient } from '@supabase/supabase-js';
import { Mic, MicOff, Sun, Maximize, Minimize, Settings2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

const SOCKET_SERVER_URL = '/';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const CURRENT_VERSION = '1.0.0';

const getContrastYIQ = (hexcolor) => {
  if (!hexcolor) return 'white';
  const hex = hexcolor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
};

export default function App() {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState(() => localStorage.getItem('locomm_username') || 'User' + Math.floor(Math.random() * 1000));
  const [role, setRole] = useState(() => localStorage.getItem('locomm_role') || 'regular'); // 'regular' or 'master'
  const [password, setPassword] = useState(() => localStorage.getItem('locomm_password') || '');
  const [showConfig, setShowConfig] = useState(true);
  
  // Dynamic Network State
  const [channels, setChannels] = useState([]);
  const [channel, setChannel] = useState(() => localStorage.getItem('locomm_channel') || ''); // Regular user selected channel
  const [masterTargets, setMasterTargets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('locomm_masterTargets')) || ['all']; } 
    catch { return ['all']; }
  }); // Master broadcast targets (array)

  // Track specific user targets for 1-on-1 comms
  const [targetUsers, setTargetUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('locomm_targetUsers')) || []; }
    catch { return []; }
  });
  
  // Refs to ensure audio processor always reads the latest targeting data without restarting
  const masterTargetsRef = useRef(masterTargets);
  useEffect(() => { masterTargetsRef.current = masterTargets; }, [masterTargets]);
  
  const targetUsersRef = useRef(targetUsers);
  useEffect(() => { targetUsersRef.current = targetUsers; }, [targetUsers]);
  
  // Track all online users sent by server
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // Audio configuration
  const [inputs, setInputs] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [selectedInput, setSelectedInput] = useState(() => localStorage.getItem('locomm_selectedInput') || '');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('locomm_selectedOutput') || '');
  
  // PTT State
  const [isTyping, setIsTyping] = useState(false);
  const [pttKey, setPttKey] = useState(() => localStorage.getItem('locomm_pttKey') || 'Space');
  const [isPressing, setIsPressing] = useState(false);
  const [isTalkbackPressing, setIsTalkbackPressing] = useState(false);
  const [pttMode, setPttMode] = useState(() => localStorage.getItem('locomm_pttMode') || 'hold'); // 'hold' | 'toggle'
  
  // WakeLock & Fullscreen
  const [wakeLock, setWakeLock] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Server network info (IP + port emitted by backend)
  const [serverInfo, setServerInfo] = useState({ ip: '', port: 3001, version: '' });
  const [showPin, setShowPin] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  // Audio Capture Refs
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  // Audio Playback Refs
  const playContextRef = useRef(null);
  const playTimeByUserRef = useRef({});
  
  // Channel Builder Form State
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelColor, setNewChannelColor] = useState('#3b82f6');

  // Save settings to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem('locomm_username', username);
    localStorage.setItem('locomm_role', role);
    localStorage.setItem('locomm_channel', channel);
    localStorage.setItem('locomm_masterTargets', JSON.stringify(masterTargets));
    localStorage.setItem('locomm_selectedInput', selectedInput);
    localStorage.setItem('locomm_selectedOutput', selectedOutput);
    localStorage.setItem('locomm_pttKey', pttKey);
    localStorage.setItem('locomm_password', password);
    localStorage.setItem('locomm_pttMode', pttMode);
    localStorage.setItem('locomm_targetUsers', JSON.stringify(targetUsers));
  }, [username, role, channel, masterTargets, selectedInput, selectedOutput, pttKey, password, pttMode, targetUsers]);

  // Keep a ref to the latest playAudioChunk so the socket listener never goes stale
  const playAudioChunkRef = useRef(null);

  const [activeTalkers, setActiveTalkers] = useState({}); // { [username]: timeoutID }

  // Connect socket
  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL, {
      secure: true,
      rejectUnauthorized: false,
      transports: ['websocket']
    });
    socketRef.current = newSocket;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(newSocket);

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));
    
    newSocket.on('sync-channels', (syncedChannels) => {
      setChannels(syncedChannels);
      // Ensure regular user has a valid channel selected
      setChannel(prev => (syncedChannels.find(c => c.id === prev) ? prev : syncedChannels[0]?.id || ''));
    });
    
    // Use ref so we always call the latest version of playAudioChunk
    newSocket.on('audio-broadcast', async ({ chunk, from }) => {
      playAudioChunkRef.current?.(chunk, from);
      
      // Update active talkers UI
      setActiveTalkers(prev => {
        if (prev[from]) clearTimeout(prev[from]);
        const timeout = setTimeout(() => {
          setActiveTalkers(current => {
            const next = { ...current };
            delete next[from];
            return next;
          });
        }, 1000);
        return { ...prev, [from]: timeout };
      });
    });

    newSocket.on('server-info', ({ ip, port, version }) => {
      setServerInfo({ ip, port, version });
      
      // Check for updates from Supabase
      if (supabase && version) {
        checkForUpdates(version);
      }
    });

    newSocket.on('sync-users', (users) => {
      setOnlineUsers(users);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Check for updates via Supabase
  const checkForUpdates = async (serverVersion) => {
    try {
      const { data, error } = await supabase
        .from('updates')
        .select('version, download_url, release_notes')
        .eq('app_name', 'locomm')
        .eq('platform', 'web')
        .order('version', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.error('Update check error:', error.message);
        return;
      }
      
      if (data && data.version !== CURRENT_VERSION) {
        setUpdateInfo(data);
      }
    } catch (err) {
      console.error('Update check failed:', err);
    }
  };

  const handleJoinNetwork = () => {
    if (!socket || !connected) return alert("System disconnected. Please wait.");
    socket.emit('join-channel', { channel, role, username, password }, (response) => {
      if (response && response.error) {
        alert(response.error);
      } else {
        setShowConfig(false);
      }
    });
  };

  // Devices Enumeration
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioIns = devices.filter(d => d.kind === 'audioinput');
        const audioOuts = devices.filter(d => d.kind === 'audiooutput');
        setInputs(audioIns);
        setOutputs(audioOuts);
        if (audioIns.length > 0) setSelectedInput(audioIns[0].deviceId);
        if (audioOuts.length > 0) setSelectedOutput(audioOuts[0].deviceId);
      } catch (err) {
        console.error('Error fetching devices', err);
      }
    };
    getDevices();
  }, []);

  // Audio Playback
  const playAudioChunk = useCallback(async (arrayBuffer, fromUsername) => {
    try {
      if (!playContextRef.current) {
        playContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        if (selectedOutput && typeof playContextRef.current.setSinkId === 'function') {
           await playContextRef.current.setSinkId(selectedOutput).catch(e => console.error(e));
        }
      }
      
      const ctx = playContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const pcmData = new Float32Array(arrayBuffer);
      const buffer = ctx.createBuffer(1, pcmData.length, ctx.sampleRate);
      buffer.getChannelData(0).set(pcmData);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      const userKey = fromUsername || 'unknown';
      const lastPlayTime = playTimeByUserRef.current[userKey] || 0;
      const playTime = Math.max(lastPlayTime, ctx.currentTime + 0.04);
      source.start(playTime);
      playTimeByUserRef.current[userKey] = playTime + buffer.duration;
    } catch (e) {
      console.error("Audio play error", e);
    }
  }, [selectedOutput]);

  // Keep the ref in sync whenever playAudioChunk changes (e.g. output device changed)
  useEffect(() => {
    playAudioChunkRef.current = playAudioChunk;
  }, [playAudioChunk]);

  // PTT Logic — wrapped in useCallback for stable references in keyboard/MediaSession effects
  const startRecording = useCallback(async (talkbackOnly = false) => {
    if (isPressing || isTalkbackPressing || showConfig) return;
    
    if (talkbackOnly) {
      setIsTalkbackPressing(true);
    } else {
      setIsPressing(true);
    }
    
    if (playContextRef.current && playContextRef.current.state === 'suspended') {
      await playContextRef.current.resume();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          deviceId: selectedInput ? { exact: selectedInput } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      streamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(8192, 1, 1);
      processorRef.current = processor;
      
      const NOISE_THRESHOLD = 0.01;
      
      processor.onaudioprocess = (e) => {
        if (!socket) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        let rms = 0;
        for (let i = 0; i < inputData.length; i++) {
          rms += inputData[i] * inputData[i];
        }
        rms = Math.sqrt(rms / inputData.length);
        
        if (rms < NOISE_THRESHOLD) return;
        
        const pcmData = new Float32Array(inputData);
        socket.emit('audio-chunk', { 
          chunk: pcmData.buffer, 
          targetChannels: role === 'master' ? masterTargetsRef.current : undefined,
          targetUsers: role === 'master' ? targetUsersRef.current : undefined,
          talkbackOnly: talkbackOnly
        });
      };

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0; 
      
      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
    } catch (err) {
      console.error("Could not start recording", err);
      setIsPressing(false);
      setIsTalkbackPressing(false);
    }
  }, [isPressing, isTalkbackPressing, showConfig, selectedInput, socket, role]);

  const stopRecording = useCallback((talkbackOnly = false) => {
    if (!isPressing && !isTalkbackPressing) return;
    if (talkbackOnly) {
      setIsTalkbackPressing(false);
    } else {
      setIsPressing(false);
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    Object.keys(playTimeByUserRef.current).forEach(key => {
      playTimeByUserRef.current[key] = 0;
    });
  }, [isPressing, isTalkbackPressing]);

  // Keyboard mapping — respects pttMode ('hold' = classic PTT, 'toggle' = press once to lock on/off)
  const handleKeyDown = useCallback((e) => {
    if (showConfig || isTyping) return;
    if (e.code === pttKey) {
      e.preventDefault();
      if (pttMode === 'toggle') {
        isPressing ? stopRecording() : startRecording(false);
      } else {
        startRecording(false);
      }
    }
  }, [pttKey, showConfig, isTyping, pttMode, isPressing, startRecording, stopRecording]);

  const handleKeyUp = useCallback((e) => {
    if (showConfig || isTyping) return;
    if (e.code === pttKey && pttMode === 'hold') {
      e.preventDefault();
      stopRecording();
    }
  }, [pttKey, showConfig, isTyping, pttMode, stopRecording]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Attempt Media Session API — safe now that startRecording/stopRecording are stable callbacks
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => startRecording(false));
      navigator.mediaSession.setActionHandler('pause', () => { stopRecording(false); stopRecording(true); });
    }
  }, [startRecording, stopRecording]);

  // WakeLock & Fullscreen
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    } catch (err) {
      console.error("Fullscreen err:", err);
    }
  };
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleWakeLock = async () => {
    if (wakeLock !== null) {
      await wakeLock.release();
      setWakeLock(null);
    } else {
      try {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
      } catch (err) {
        console.error("WakeLock failed:", err);
      }
    }
  };

  // Channel Admin Functions
  const createChannel = () => {
    if (!newChannelName.trim()) return;
    const id = newChannelName.toLowerCase().replace(/\s+/g, '-');
    socket.emit('add-channel', { id, name: newChannelName, color: newChannelColor });
    setNewChannelName('');
  };
  const deleteChannel = (id) => {
    console.log("Deleting channel:", id);
    socket.emit('remove-channel', id);
  };

  // Toggling Targets
  const toggleTarget = (id) => {
    setMasterTargets(prev => {
      if (id === 'all') {
        setTargetUsers([]); // Clear individual users when selecting 'all'
        return ['all'];
      }
      // Deselect 'all' when picking specific ones
      let next = prev.filter(t => t !== 'all');
      if (next.includes(id)) {
        next = next.filter(t => t !== id);
      } else {
        next.push(id);
      }
      return next.length === 0 ? ['all'] : next;
    });
  };

  const toggleTargetUser = (socketId) => {
    setTargetUsers(prev => {
      if (prev.includes(socketId)) {
        return prev.filter(id => id !== socketId);
      } else {
        return [...prev, socketId];
      }
    });
    // Remove 'all' from channels if we specifically pick a user
    setMasterTargets(prev => prev.filter(t => t !== 'all'));
  };

  const renderMasterAdminPanel = () => (
    <div className="admin-panel mt-4 pt-4" style={{borderTop: '1px solid var(--border-color)'}}>
      <h3 className="mb-4 text-muted">Network Manager (Master Only)</h3>
      <div className="channel-list mb-4" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {channels.map(c => (
          <div key={c.id} className="admin-channel-row flex-row justify-between" style={{background: 'rgba(0,0,0,0.2)', borderRadius: '6px', flex: '1 1 auto', minWidth: '150px', paddingTop: '0.5rem', paddingLeft: '0.75rem', paddingRight: '0.5rem', paddingBottom: '0.35rem'}}>
            <div className="flex-row">
              <span className="dot" style={{background: c.color, width: '12px', height: '12px'}}></span>
              <span>{c.name}</span>
            </div>
            <button className="danger" style={{padding: '0.4rem 0.6rem', marginLeft: '0.5rem'}} onClick={() => deleteChannel(c.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex-row gap-2">
        <input 
          type="text" 
          placeholder="New Channel Name" 
          value={newChannelName}
          onChange={e => setNewChannelName(e.target.value)}
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
        />
        <input 
          type="color" 
          value={newChannelColor} 
          onChange={e => setNewChannelColor(e.target.value)}
          style={{width: '50px', height: '42px', padding: '0', background: 'transparent', border: 'none', cursor: 'pointer'}}
        />
        <button className="outline" onClick={createChannel}><Plus size={18} /></button>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <header className="header glass-panel" style={{flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem'}}>
        <div className="flex-row" style={{justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem'}}>
          <h1>TribeTalk</h1>
          <div className="flex-row" style={{flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', justifyContent: 'flex-end'}}>
            {Object.keys(activeTalkers).length > 0 && Object.keys(activeTalkers).map(talker => (
              <span key={talker} className="active-talker-tag">
                {talker}
              </span>
            ))}
            <div className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
              <div className="dot" style={{background: Object.keys(activeTalkers).length > 0 ? 'var(--danger)' : ''}}></div>
              {connected && !showConfig ? 'Live' : connected ? 'Ready' : 'Offline'}
            </div>
          </div>
        </div>
        
        <div className="top-bar-buttons" style={{justifyContent: 'flex-end', width: '100%'}}>
          <button className="outline" onClick={toggleWakeLock} title="Keep Screen On">
            <Sun size={18} color={wakeLock ? 'var(--success)' : 'currentColor'} />
          </button>
          <button className="outline" onClick={toggleFullscreen} title="Toggle Fullscreen">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          {!showConfig && (
            <button className="outline" onClick={() => setShowConfig(true)}>
              <Settings2 size={18} />
            </button>
          )}
        </div>
        
        {updateInfo && (
          <div className="update-banner" style={{
            background: 'var(--accent)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <span>Update available: v{updateInfo.version}</span>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button 
                className="outline" 
                style={{borderColor: 'white', color: 'white', padding: '0.25rem 0.75rem'}}
                onClick={() => window.open(updateInfo.download_url, '_blank')}
              >
                Update
              </button>
              <button 
                className="outline" 
                style={{borderColor: 'white', color: 'white', padding: '0.25rem 0.5rem'}}
                onClick={() => setUpdateInfo(null)}
              >
                X
              </button>
            </div>
          </div>
        )}
      </header>

      {showConfig ? (
        <div className="glass-panel" style={{ overflowY: 'auto' }}>
          <h2 className="mb-4">Setup Configuration</h2>
          <div className="controls-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="regular">Regular User</option>
                <option value="master">Master (Director)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Network PIN</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                placeholder="Enter global PIN"
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontFamily: 'inherit',
                  width: '100%',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            {role === 'regular' && (
              <div className="form-group">
                <label>Channel</label>
                <select value={channel} onChange={e => setChannel(e.target.value)}>
                  {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Input Device</label>
                <select value={selectedInput} onChange={e => setSelectedInput(e.target.value)}>
                  {inputs.map(i => <option key={i.deviceId} value={i.deviceId}>{i.label || 'Default Mic'}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Output Device</label>
                <select value={selectedOutput} onChange={e => setSelectedOutput(e.target.value)}>
                  {outputs.map(o => <option key={o.deviceId} value={o.deviceId}>{o.label || 'Default Speaker'}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Map PTT Key (Press to bind)</label>
              <input 
                type="text" 
                value={pttKey} 
                readOnly
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                onKeyDown={(e) => {
                  e.preventDefault();
                  setPttKey(e.code);
                }}
              />
            </div>
          </div>
          
          <button className="primary mt-4" style={{width: '100%', maxWidth: '500px', margin: '1rem auto', display: 'block'}} onClick={handleJoinNetwork}>
            Join Network
          </button>

          {/* End of Setup View */}

        </div>
      ) : (
        <main className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="header mb-4">
            <div>
              <h3 style={{fontSize: '1.2rem'}}>{username}</h3>
              <div className="flex-row" style={{marginTop: '0.25rem', gap: '0.6rem', flexWrap: 'wrap'}}>
                <span className="text-muted" style={{fontSize: '0.85rem'}}>Role: {role.toUpperCase()}</span>
                
                {role === 'regular' && (
                  <span className="dynamic-tag" style={{
                    backgroundColor: `${channels.find(c => c.id === channel)?.color}33`, 
                    color: channels.find(c => c.id === channel)?.color,
                    border: `1px solid ${channels.find(c => c.id === channel)?.color}66`
                  }}>
                    {channels.find(c => c.id === channel)?.name}
                  </span>
                )}

                <div className="flex-row" style={{gap: '0.4rem', flexWrap: 'wrap', marginLeft: '0.4rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.6rem'}}>
                  <span className="text-muted" style={{fontSize: '0.75rem'}}>Directors:</span>
                  {onlineUsers.filter(u => u.role === 'master').map(u => (
                    <span key={u.id} className="dynamic-tag" style={{backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '0.75rem', padding: '0.1rem 0.4rem'}}>
                      {u.username} {u.id === socket?.id ? '(You)' : ''}
                    </span>
                  ))}
                  {onlineUsers.filter(u => u.role === 'master').length === 0 && (
                    <span className="text-muted" style={{fontSize: '0.75rem', fontStyle: 'italic'}}>None</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {role === 'master' ? (
            <>
              <div className="director-layout mb-4">
                {/* Left Column: Targets */}
                <div className="director-targets">
                  <div className="form-group glass-panel compact-panel" style={{background: 'rgba(0,0,0,0.2)', height: '100%', margin: 0}}>
                    <label className="mb-2 block">Network Targets</label>
                    <div className="flex-row mb-3">
                      <button 
                        className={`toggle-btn ${masterTargets.includes('all') ? 'active' : ''}`}
                        onClick={() => toggleTarget('all')}
                        style={{ 
                          width: '100%', 
                          justifyContent: 'center',
                          background: masterTargets.includes('all') ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                          color: masterTargets.includes('all') ? getContrastYIQ('#3b82f6') : 'var(--text-muted)',
                          borderColor: masterTargets.includes('all') ? 'var(--accent)' : 'var(--border-color)',
                          borderStyle: 'solid',
                          borderWidth: '1px'
                        }}
                      >
                        BROADCAST TO ALL
                      </button>
                    </div>
                    <div className="channel-targets-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {channels.map(c => {
                        const channelUsers = onlineUsers.filter(u => u.channel === c.id && u.role !== 'master');
                        return (
                          <div key={c.id} className="channel-row">
                            <button 
                              className={`toggle-btn channel-btn-fixed ${masterTargets.includes(c.id) ? 'active' : ''}`}
                              onClick={() => toggleTarget(c.id)}
                              style={{
                                background: masterTargets.includes(c.id) ? c.color : 'rgba(255,255,255,0.05)',
                                color: masterTargets.includes(c.id) ? getContrastYIQ(c.color) : 'var(--text-muted)',
                                borderColor: masterTargets.includes(c.id) ? c.color : 'var(--border-color)',
                                borderStyle: 'solid',
                                borderWidth: '1px'
                              }}
                            >
                              {c.name}
                            </button>
                            
                            <div className="user-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {channelUsers.length === 0 ? (
                                <span className="text-muted" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>No users online</span>
                              ) : channelUsers.map(u => (
                                <button
                                  key={u.id}
                                  className={`user-tag ${targetUsers.includes(u.id) ? 'active' : ''}`}
                                  onClick={() => toggleTargetUser(u.id)}
                                  style={{ 
                                    padding: '0.2rem 0.6rem', 
                                    fontSize: '0.75rem', 
                                    borderRadius: '4px',
                                    background: targetUsers.includes(u.id) ? c.color : 'rgba(255,255,255,0.05)',
                                    color: targetUsers.includes(u.id) ? getContrastYIQ(c.color) : 'var(--text-muted)',
                                    border: `1px solid ${c.color}66`,
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {u.username}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: PTT */}
                <div className="director-ptt">
                  <div className="ptt-container" style={{ height: '100%', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="ptt-mode-toggle flex-row mb-4" style={{justifyContent: 'center', width: '100%'}}>
                      <span className={`text-muted ${pttMode === 'hold' ? 'active' : ''}`} style={{fontSize: '0.85rem', color: pttMode === 'hold' ? 'var(--text-main)' : ''}}>Hold to Speak</span>
                      <label className="switch" style={{margin: '0 0.5rem'}}>
                        <input type="checkbox" checked={pttMode === 'toggle'} onChange={() => setPttMode(prev => prev === 'hold' ? 'toggle' : 'hold')} />
                        <span className="slider round"></span>
                      </label>
                      <span className={`text-muted ${pttMode === 'toggle' ? 'active' : ''}`} style={{fontSize: '0.85rem', color: pttMode === 'toggle' ? 'var(--text-main)' : ''}}>Toggle to Speak</span>
                    </div>
                    <button 
                      className={`ptt-button ${isPressing ? 'active' : ''}`}
                      onMouseDown={() => {
                        if (pttMode === 'toggle') {
                          isPressing ? stopRecording() : startRecording(false);
                        } else {
                          startRecording(false);
                        }
                      }}
                      onMouseUp={() => {
                        if (pttMode === 'hold') stopRecording();
                      }}
                      onMouseLeave={() => {
                        if (pttMode === 'hold') stopRecording();
                      }}
                      onTouchStart={(e) => { 
                        e.preventDefault(); 
                        if (pttMode === 'toggle') {
                          isPressing ? stopRecording() : startRecording(false);
                        } else {
                          startRecording(false);
                        }
                      }}
                      onTouchEnd={(e) => { 
                        e.preventDefault(); 
                        if (pttMode === 'hold') stopRecording();
                      }}
                    >
                      <div className="radar"></div>
                      {isPressing ? <Mic size={48} /> : <MicOff size={48} />}
                    </button>
                    <p className="text-muted" style={{ textAlign: 'center' }}>
                      {pttMode === 'hold' ? 'Hold' : 'Press'} button or <strong>{pttKey}</strong> to speak globally
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Master Admin Panel - Restored */}
              {role === 'master' && renderMasterAdminPanel()}
            </>
          ) : (
            <div className="ptt-container">
              <div className="ptt-mode-toggle flex-row mb-4" style={{justifyContent: 'center', width: '100%'}}>
                <span className={`text-muted ${pttMode === 'hold' ? 'active' : ''}`} style={{fontSize: '0.85rem', color: pttMode === 'hold' ? 'var(--text-main)' : ''}}>Hold to Speak</span>
                <label className="switch" style={{margin: '0 0.5rem'}}>
                  <input type="checkbox" checked={pttMode === 'toggle'} onChange={() => setPttMode(prev => prev === 'hold' ? 'toggle' : 'hold')} />
                  <span className="slider round"></span>
                </label>
                <span className={`text-muted ${pttMode === 'toggle' ? 'active' : ''}`} style={{fontSize: '0.85rem', color: pttMode === 'toggle' ? 'var(--text-main)' : ''}}>Toggle to Speak</span>
              </div>
              <button 
                className={`ptt-button ${isPressing ? 'active' : ''}`}
                onMouseDown={() => {
                  if (pttMode === 'toggle') {
                    isPressing ? stopRecording() : startRecording(false);
                  } else {
                    startRecording(false);
                  }
                }}
                onMouseUp={() => {
                  if (pttMode === 'hold') stopRecording();
                }}
                onMouseLeave={() => {
                  if (pttMode === 'hold') stopRecording();
                }}
                onTouchStart={(e) => { 
                  e.preventDefault(); 
                  if (pttMode === 'toggle') {
                    isPressing ? stopRecording() : startRecording(false);
                  } else {
                    startRecording(false);
                  }
                }}
                onTouchEnd={(e) => { 
                  e.preventDefault(); 
                  if (pttMode === 'hold') stopRecording();
                }}
              >
                <div className="radar"></div>
                {isPressing ? <Mic size={48} /> : <MicOff size={48} />}
              </button>
              <p className="text-muted" style={{ textAlign: 'center' }}>
                {pttMode === 'hold' ? 'Hold' : 'Press'} button or <strong>{pttKey}</strong> to speak to channel
              </p>

              {role === 'regular' && (
                <button 
                  className={`outline mt-4 ${isTalkbackPressing ? 'danger active-talkback' : ''}`}
                  style={{
                     width: '100%', 
                     padding: '1rem', 
                     fontWeight: 'bold', 
                     backgroundColor: isTalkbackPressing ? 'var(--danger)' : 'rgba(255,255,255,0.05)',
                     color: isTalkbackPressing ? getContrastYIQ('#ef4444') : 'var(--text-muted)'
                   }}
                   onMouseDown={() => {
                     if (pttMode === 'hold') startRecording(true);
                   }}
                   onMouseUp={() => {
                     if (pttMode === 'hold') stopRecording(true);
                   }}
                   onMouseLeave={() => {
                     if (pttMode === 'hold') stopRecording(true);
                   }}
                   onClick={() => {
                     if (pttMode === 'toggle') {
                       isTalkbackPressing ? stopRecording(true) : startRecording(true);
                     }
                   }}
                   onTouchStart={(e) => { 
                     e.preventDefault(); 
                     if (pttMode === 'toggle') {
                       isTalkbackPressing ? stopRecording(true) : startRecording(true);
                     } else {
                       startRecording(true);
                     }
                   }}
                   onTouchEnd={(e) => { 
                     e.preventDefault(); 
                     if (pttMode === 'hold') stopRecording(true);
                   }}
                 >
                  {isTalkbackPressing ? 'TALKING TO MASTER (RELEASE TO STOP)' : 'TALK DIRECT TO MASTER (PRIVATE)'}
                </button>
              )}
            </div>
          )}

          {/* Network Info Card */}
          {serverInfo.ip && (
            <div className="network-info-card glass-panel">
              <div className="network-info-header">
                <span className="network-info-title">📡 Network Info</span>
                <span className="text-muted" style={{fontSize:'0.75rem'}}>Share with your team</span>
              </div>
              <div className="network-info-row">
                <span className="network-info-label">Server URL</span>
                <code className="network-info-value">
                  https://{serverInfo.ip}:{serverInfo.port}
                </code>
              </div>
              <div className="network-info-row">
                <span className="network-info-label">Network PIN</span>
                {role === 'master' ? (
                  <div className="network-info-pin-row">
                    <code className="network-info-value">
                      {showPin ? password : '•'.repeat(password.length || 4)}
                    </code>
                    <button
                      className="outline"
                      style={{padding:'0.3rem 0.6rem', marginLeft:'0.5rem'}}
                      onClick={() => setShowPin(p => !p)}
                      title={showPin ? 'Hide PIN' : 'Reveal PIN'}
                    >
                      {showPin ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>
                ) : (
                  <span className="text-muted" style={{fontSize:'0.85rem', fontStyle:'italic'}}>
                    Ask your Director
                  </span>
                )}
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
