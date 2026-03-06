// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyDU0rqDjPdMsjhS_7MmvCYaoPoXpqeqyRE",
  authDomain: "unno-f3338.firebaseapp.com",
  databaseURL: "https://unno-f3338-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "unno-f3338",
  storageBucket: "unno-f3338.firebasestorage.app",
  messagingSenderId: "925580365013",
  appId: "1:925580365013:web:651b38e0dc0383b28e265c",
  measurementId: "G-976XGC3C0F"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ==================== CONSTANTS ====================
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SPECIAL_VALUES = ['S', 'R', '+2'];
const WILD_VALUES = ['W', '+4'];
const BOT_NAMES = ['Alex', 'Blake', 'Casey', 'Drew', 'Ellis', 'Flynn'];
const TURN_TIME = 15;
const GAME_TIME = 300;
const AFK_TIMEOUT = 30000;
const RECONNECT_TIMEOUT = 60000;
const EMOTES = {
  angry: '😠', laugh: '😂', cry: '😢', fire: '🔥', cool: '😎', think: '🤔'
};

// Game Settings
const gameSettings = {
  stacking: true,
  timer: true,
  sound: true
};

// Player Stats
const playerStats = {
  name: 'Player',
  level: 12,
  xp: 2450,
  xpNeeded: 3000,
  coins: 1250
};

// Game State
let state = {
  deck: [],
  discard: [],
  players: [],
  turn: 0,
  direction: 1,
  activeColor: 'red',
  isOver: false,
  active: false,
  saidUno: new Set(),
  pendingWild: null,
  drawStack: 0,
  stackType: null,
  timer: TURN_TIME,
  timerInterval: null,
  gameTime: GAME_TIME,
  gameTimerInterval: null,
  discardRotation: 0,
  sortMode: null,
  dragCard: null,
  drawnCard: null,
  drawnCardPlayable: false,
  comboCount: 0,
  lastPlayTime: 0
};

// Multiplayer State
let multiplayerState = {
  isHost: false,
  lobbyId: null,
  playerId: null,
  playerName: 'Player_' + Math.random().toString(36).substr(2, 6),
  playerIndex: 0,
  maxPlayers: 4,
  gameMode: 'classic',
  isPrivate: false,
  isQuickMatch: false,
  lobbyRef: null,
  gameRef: null,
  presenceRef: null,
  playerPresenceRef: null,
  lastActivity: Date.now(),
  afkTimer: null,
  reconnectTimer: null,
  playerPositions: {},
  isSearching: false,
  searchRef: null,
  callbacks: {}
};

// Audio Context
let audioCtx = null;

// ==================== INITIALIZATION ====================
function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('Audio not supported');
    }
  }
}

function playSound(type) {
  if (!audioCtx || !gameSettings.sound) return;
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g);
    g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    
    const sounds = {
      card: { type: 'triangle', freq: [800, 400], dur: 0.1, vol: 0.08 },
      win: { type: 'sine', freq: [523, 659, 784, 1047], dur: 0.8, vol: 0.1 },
      lose: { type: 'sawtooth', freq: [200, 100], dur: 0.5, vol: 0.06 },
      draw: { type: 'sine', freq: [500, 400], dur: 0.08, vol: 0.05 },
      tick: { type: 'sine', freq: [900, 900], dur: 0.06, vol: 0.04 },
      deal: { type: 'triangle', freq: [600, 700], dur: 0.08, vol: 0.05 },
      skip: { type: 'square', freq: [350, 450, 350], dur: 0.35, vol: 0.06 },
      reverse: { type: 'sine', freq: [450, 550, 450], dur: 0.3, vol: 0.06 },
      wild: { type: 'sine', freq: [350, 500, 700, 900], dur: 0.5, vol: 0.08 },
      combo: { type: 'sine', freq: [700, 900, 1100], dur: 0.25, vol: 0.06 },
      uno: { type: 'sine', freq: [523, 659, 784], dur: 0.6, vol: 0.1 },
      emote: { type: 'sine', freq: [600, 800], dur: 0.15, vol: 0.05 },
      join: { type: 'sine', freq: [400, 600, 800], dur: 0.3, vol: 0.08 },
      start: { type: 'sine', freq: [600, 800, 1000], dur: 0.4, vol: 0.1 }
    };
    
    const s = sounds[type];
    if (!s) return;

    osc.type = s.type;
    if (Array.isArray(s.freq) && s.freq.length > 1) {
      const noteLength = s.dur / s.freq.length;
      s.freq.forEach((f, i) => {
        const startTime = t + (i * noteLength);
        osc.frequency.setValueAtTime(Math.max(1, f), startTime);
        if (i < s.freq.length - 1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, s.freq[i + 1]), startTime + noteLength);
      });
    } else {
      osc.frequency.setValueAtTime(Array.isArray(s.freq) ? s.freq[0] : s.freq, t);
    }
    
    g.gain.setValueAtTime(s.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + s.dur);
    osc.start(t);
    osc.stop(t + s.dur);
  } catch (e) {}
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ==================== UTILITY FUNCTIONS ====================
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'UNO-';
  for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function getPlayerColor(idx) {
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];
  return colors[idx % colors.length];
}

function getPositionClass(idx, totalPlayers) {
  if (totalPlayers === 2) return idx === 0 ? 'bottom' : 'top';
  if (totalPlayers === 3) {
    const positions = ['bottom', 'right', 'left']; // Bottom (You), Right (P2), Left (P3) for 3 players
    return positions[idx];
  }
  return ['bottom', 'left', 'top', 'right'][idx]; // Standard 4 player
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

function showGameMessage(text, duration = 1500) {
  const msgEl = document.getElementById('game-message');
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.display = 'block';
  setTimeout(() => { msgEl.style.display = 'none'; }, duration);
}

function showToast(message, duration = 2500) {
  let toast = document.getElementById('toast');
  if (!toast) return; // Should exist in HTML
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ==================== PARTICLES ====================
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];
  for (let i = 0; i < 15; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = 4 + Math.random() * 8;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = (Math.random() * 100) + '%';
    particle.style.top = (Math.random() * 100) + '%';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.animationDelay = (Math.random() * 15) + 's';
    container.appendChild(particle);
  }
}

// ==================== LOADING SCREEN ====================
async function runLoadingScreen() {
  const loadingBar = document.getElementById('loading-bar');
  const loadingText = document.getElementById('loading-text');
  const loadingScreen = document.getElementById('loading-screen');
  
  const steps = [
    { progress: 25, text: "Connecting to server..." },
    { progress: 50, text: "Loading assets..." },
    { progress: 75, text: "Preparing game..." },
    { progress: 100, text: "Ready!" }
  ];
  
  for (const step of steps) {
    if (loadingBar) loadingBar.style.width = step.progress + '%';
    if (loadingText) loadingText.textContent = step.text;
    await sleep(400);
  }
  
  await sleep(500);
  if (loadingScreen) loadingScreen.classList.add('hidden');
  showScreen('menu-screen');
  setupConnectionMonitor();
  document.getElementById('player-name').textContent = multiplayerState.playerName;
}

// ==================== CONNECTION STATUS ====================
function setupConnectionMonitor() {
  const connectedRef = database.ref('.info/connected');
  connectedRef.on('value', (snap) => {
    const connected = snap.val() === true;
    updateConnectionStatus(connected);
    if (connected && multiplayerState.playerId && multiplayerState.lobbyId) setupPresence();
    if (!connected && state.active) showToast('Connection lost! Reconnecting...');
  });
}

function updateConnectionStatus(connected) {
  let statusEl = document.getElementById('connection-status');
  if (!statusEl) return;
  if (connected) {
    statusEl.className = 'connection-status connected';
    statusEl.innerHTML = '<div class="connection-dot"></div><span>Connected</span>';
  } else {
    statusEl.className = 'connection-status disconnected';
    statusEl.innerHTML = '<div class="connection-dot"></div><span>Disconnected</span>';
  }
}

// ==================== DECK CREATION ====================
function createDeck() {
  let deck = [];
  COLORS.forEach(color => {
    deck.push({ c: color, v: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ c: color, v: i.toString() });
      deck.push({ c: color, v: i.toString() });
    }
    SPECIAL_VALUES.forEach(value => {
      deck.push({ c: color, v: value });
      deck.push({ c: color, v: value });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ c: 'black', v: 'W' });
    deck.push({ c: 'black', v: '+4' });
  }
  return shuffle(deck);
}

// ==================== CARD RENDERING ====================
function renderCard(card, isBack = false) {
  const el = document.createElement('div');
  el.className = 'uno-card';

  if (isBack) {
    el.classList.add('card-back');
    const randId = Math.random().toString(36).substr(2, 9);
    el.innerHTML = `
      <svg width="240" height="360" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
         <defs><linearGradient id="unoRedLocal${randId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FF3B5C"/><stop offset="100%" stop-color="#E6194B"/></linearGradient></defs>
         <g><rect width="240" height="360" rx="18" fill="#1a1a2e"/><rect x="10" y="10" width="220" height="340" rx="12" fill="none" stroke="#ffffff" stroke-width="6"/><ellipse cx="120" cy="180" rx="80" ry="140" fill="url(#unoRedLocal${randId})" transform="rotate(20 120 180)"/><text x="120" y="195" font-family="Bebas Neue, Arial Black, sans-serif" font-size="60" font-weight="900" fill="#FFD43B" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 120 190)">UNO</text></g>
        </svg>`;
    return el;
  }

  let fill = '';
  let isWild = false;
  
  if (card.c === 'red') fill = 'url(#unoRed)';
  else if (card.c === 'blue') fill = 'url(#unoBlue)';
  else if (card.c === 'green') fill = 'url(#unoGreen)';
  else if (card.c === 'yellow') fill = 'url(#unoYellow)';
  else {
    fill = '#1a1a2e';
    isWild = true;
  }

  let centerContent = '';
  let cornerValue = card.v;
  let centerFontSize = 180;

  if (card.v === 'S') {
    cornerValue = '⊘'; centerFontSize = 120;
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${cornerValue}</text><text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">${cornerValue}</text>`;
  } else if (card.v === 'R') {
    cornerValue = '⟲'; centerFontSize = 120;
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${cornerValue}</text><text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">${cornerValue}</text>`;
  } else if (card.v === '+2') {
    centerFontSize = 120;
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">+2</text><text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">+2</text>`;
  } else if (card.v === 'W') {
    cornerValue = 'W'; centerContent = '';
  } else if (card.v === '+4') {
    cornerValue = '+4';
    centerContent = `<g transform="skewX(-10)"><text stroke-width="10" stroke="#000000" dominant-baseline="middle" text-anchor="middle" fill="#000000" font-weight="900" font-size="100" font-family="Arial Black, sans-serif" y="186" x="152.41306">+4</text><text dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-weight="900" font-size="100" font-family="Arial Black, sans-serif" y="179" x="145.41306">+4</text></g>`;
  } else {
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${card.v}</text><text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">${card.v}</text>`;
  }

  let wildPattern = '';
  if (isWild) {
    wildPattern = `<g transform="rotate(-50 120 180)"><path fill="#4DABF7" d="m120,180l0,-85a145,85 0 0 1 145,85l-145,0z"/><path fill="#51CF66" d="m120,180l145,0a145,85 0 0 1 -145,85l0,-85z"/><path fill="#FFD43B" d="m120,180l0,85a145,85 0 0 1 -145,-85l145,0z"/><path fill="#FF3B5C" d="m120,180l-145,0a145,85 0 0 1 145,-85l0,85z"/><ellipse stroke-width="4" stroke="#ffffff" fill="none" ry="85" rx="145" cy="180" cx="120"/></g>`;
  }

  let centerEllipse = '';
  if (!isWild) centerEllipse = `<ellipse transform="rotate(-60.409 117.875 181.408)" stroke="#ffffff" cx="117.87508" cy="181.40815" rx="159.19945" ry="82.07582" fill="none" stroke-width="6"/>`;

  el.innerHTML = `
    <svg width="240" height="360" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
     <g><rect x="0" y="0" width="240" height="360" rx="25" ry="25" fill="${fill}"/>
      <rect x="10" y="10" width="220" height="340" rx="20" ry="20" fill="none" stroke="#ffffff" stroke-width="8"/>
      ${centerEllipse}${wildPattern}${centerContent}
      <g><text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#000000" text-anchor="middle" x="44.67969" y="61">${cornerValue}</text><text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#ffffff" text-anchor="middle" y="58" x="41.67969">${cornerValue}</text></g>
      <g transform="rotate(180 162 238)"><text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#000000" text-anchor="middle" x="45" y="61">${cornerValue}</text><text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#ffffff" text-anchor="middle" y="58" x="42">${cornerValue}</text></g>
     </g>
    </svg>`;
  return el;
}

// ==================== MENU & MODAL FUNCTIONS ====================
function showMultiplayerOptions() {
  document.getElementById('multiplayer-options-modal').classList.add('active');
}

function closeMultiplayerOptions() {
  document.getElementById('multiplayer-options-modal').classList.remove('active');
}

function showSettings() {
  document.getElementById('settings-modal').classList.add('active');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('active');
}

function showLeaderboard() {
  document.getElementById('leaderboard-modal').classList.add('active');
  // Mock leaderboard data
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = [
    { rank: 1, name: 'ProGamer', score: 15400 },
    { rank: 2, name: 'CardMaster', score: 14200 },
    { rank: 3, name: 'LuckyDraw', score: 12800 },
    { rank: 4, name: multiplayerState.playerName, score: playerStats.xp }
  ].map(p => `
    <div class="leaderboard-item ${p.name === multiplayerState.playerName ? 'current-player' : ''}">
      <div class="leaderboard-rank ${p.rank <= 3 ? ['gold','silver','bronze'][p.rank-1] : ''}">${p.rank}</div>
      <div class="leaderboard-name">${p.name}</div>
      <div class="leaderboard-score">${p.score}</div>
    </div>
  `).join('');
}

function closeLeaderboard() {
  document.getElementById('leaderboard-modal').classList.remove('active');
}

function toggleSetting(setting) {
  const toggle = document.getElementById('toggle-' + setting);
  if (toggle) {
    gameSettings[setting] = !gameSettings[setting];
    toggle.classList.toggle('active', gameSettings[setting]);
  }
}

function togglePrivate() {
  const toggle = document.getElementById('private-toggle');
  if (toggle) toggle.classList.toggle('active');
}

// ==================== CREATE LOBBY ====================
function showCreateLobby() {
  closeMultiplayerOptions();
  document.getElementById('create-lobby-modal').classList.add('active');
}

function closeCreateLobby() {
  document.getElementById('create-lobby-modal').classList.remove('active');
}

async function createLobby() {
  const nameInput = document.getElementById('host-name');
  const activeMode = document.querySelector('#create-lobby-modal .mode-btn.active');
  const activeCount = document.querySelector('#create-lobby-modal .count-btn.active');
  const privateToggle = document.getElementById('private-toggle');
  
  multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
  multiplayerState.gameMode = activeMode?.dataset.mode || 'classic';
  multiplayerState.maxPlayers = parseInt(activeCount?.dataset.count) || 4;
  multiplayerState.isPrivate = privateToggle?.classList.contains('active') || false;
  multiplayerState.isHost = true;
  multiplayerState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  const roomCode = generateRoomCode();
  multiplayerState.lobbyId = roomCode;
  
  closeCreateLobby();
  showScreen('lobby-room');
  
  const lobbyRef = database.ref('lobbies/' + roomCode);
  multiplayerState.lobbyRef = lobbyRef;
  
  const lobbyData = {
    hostId: multiplayerState.playerId,
    hostName: multiplayerState.playerName,
    gameMode: multiplayerState.gameMode,
    maxPlayers: multiplayerState.maxPlayers,
    isPrivate: multiplayerState.isPrivate,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    status: 'waiting',
    players: {
      [multiplayerState.playerId]: {
        name: multiplayerState.playerName,
        isHost: true,
        isReady: true,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        isBot: false,
        isConnected: true
      }
    },
    playerOrder: [multiplayerState.playerId]
  };
  
  try {
    await lobbyRef.set(lobbyData);
    multiplayerState.playerIndex = 0;
    updateLobbyUI();
    setupLobbyListeners();
    setupPresence();
    playSound('join');
    showToast('Lobby created: ' + roomCode);
  } catch (error) {
    console.error('Error creating lobby:', error);
    showToast('Failed to create lobby');
    showScreen('menu-screen');
  }
}

// ==================== JOIN LOBBY ====================
function showJoinLobby() {
  closeMultiplayerOptions();
  document.getElementById('join-lobby-modal').classList.add('active');
  refreshPublicLobbies();
}

function closeJoinLobby() {
  document.getElementById('join-lobby-modal').classList.remove('active');
}

async function refreshPublicLobbies() {
  const listEl = document.getElementById('public-lobby-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="lobby-empty">Searching...</div>';
  
  try {
    const snapshot = await database.ref('lobbies').orderByChild('isPrivate').equalTo(false).once('value');
    const lobbies = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === 'waiting') {
        const playerCount = data.playerOrder ? data.playerOrder.length : 0;
        if (playerCount < data.maxPlayers) {
          lobbies.push({ id: child.key, ...data, playerCount: playerCount });
        }
      }
    });
    
    if (lobbies.length === 0) {
      listEl.innerHTML = '<div class="lobby-empty">No public lobbies found</div>';
      return;
    }
    
    listEl.innerHTML = lobbies.map(lobby => `
      <div class="lobby-item" onclick="joinLobbyById('${lobby.id}')">
        <div class="lobby-item-info">
          <div class="lobby-item-name">${lobby.id}</div>
          <div class="lobby-item-host">${lobby.hostName}</div>
        </div>
        <div class="lobby-item-players">${lobby.playerCount}/${lobby.maxPlayers}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error fetching lobbies:', error);
    listEl.innerHTML = '<div class="lobby-empty">Error loading lobbies</div>';
  }
}

function pasteCode() {
  navigator.clipboard.readText().then(text => {
    document.getElementById('room-code-input').value = text.toUpperCase();
  });
}

async function joinLobbyByCode() {
  const nameInput = document.getElementById('join-name');
  const codeInput = document.getElementById('room-code-input');
  
  multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
  const roomCode = codeInput?.value?.toUpperCase().trim();
  
  if (!roomCode) {
    showToast('Enter a room code');
    return;
  }
  await joinLobbyById(roomCode);
}

async function joinLobbyById(lobbyId) {
  multiplayerState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  multiplayerState.lobbyId = lobbyId;
  multiplayerState.isHost = false;
  
  closeJoinLobby();
  showScreen('lobby-room');
  
  const lobbyRef = database.ref('lobbies/' + lobbyId);
  multiplayerState.lobbyRef = lobbyRef;
  
  try {
    const snapshot = await lobbyRef.once('value');
    const lobbyData = snapshot.val();
    
    if (!lobbyData) { showToast('Lobby not found'); showScreen('menu-screen'); return; }
    if (lobbyData.status !== 'waiting') { showToast('Game in progress'); showScreen('menu-screen'); return; }
    if (lobbyData.playerOrder.length >= lobbyData.maxPlayers) { showToast('Lobby full'); showScreen('menu-screen'); return; }
    
    const updates = {};
    updates['/players/' + multiplayerState.playerId] = {
      name: multiplayerState.playerName, isHost: false, isReady: false,
      joinedAt: firebase.database.ServerValue.TIMESTAMP, isBot: false, isConnected: true
    };
    const newOrder = [...lobbyData.playerOrder, multiplayerState.playerId];
    updates['/playerOrder'] = newOrder;
    
    await lobbyRef.update(updates);
    
    multiplayerState.playerIndex = newOrder.indexOf(multiplayerState.playerId);
    multiplayerState.gameMode = lobbyData.gameMode || 'classic';
    multiplayerState.maxPlayers = lobbyData.maxPlayers || 4;
    
    updateLobbyUI();
    setupLobbyListeners();
    setupPresence();
    playSound('join');
    showToast('Joined lobby');
  } catch (error) {
    console.error('Error joining lobby:', error);
    showToast('Failed to join');
    showScreen('menu-screen');
  }
}

// ==================== QUICK MATCH ====================
async function startQuickMatch() {
  closeMultiplayerOptions();
  multiplayerState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  multiplayerState.playerName = document.getElementById('player-name').textContent || 'Player';
  multiplayerState.isQuickMatch = true;
  showScreen('quick-match-screen');
  
  try {
    const snapshot = await database.ref('lobbies').orderByChild('isPrivate').equalTo(false).once('value');
    let foundLobby = null;
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === 'waiting' && data.playerOrder.length < data.maxPlayers && data.playerOrder.length > 0) {
        foundLobby = { id: child.key, ...data };
      }
    });
    
    if (foundLobby) {
      await joinLobbyById(foundLobby.id);
    } else {
      // Auto-create if none found
      multiplayerState.isHost = true;
      const roomCode = generateRoomCode();
      multiplayerState.lobbyId = roomCode;
      multiplayerState.lobbyRef = database.ref('lobbies/' + roomCode);
      
      const lobbyData = {
        hostId: multiplayerState.playerId, hostName: multiplayerState.playerName,
        gameMode: 'classic', maxPlayers: 4, isPrivate: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP, status: 'waiting', isQuickMatch: true,
        players: { [multiplayerState.playerId]: { name: multiplayerState.playerName, isHost: true, isReady: true, isBot: false, isConnected: true, joinedAt: firebase.database.ServerValue.TIMESTAMP } },
        playerOrder: [multiplayerState.playerId]
      };
      
      await multiplayerState.lobbyRef.set(lobbyData);
      multiplayerState.playerIndex = 0;
      showScreen('lobby-room');
      updateLobbyUI();
      setupLobbyListeners();
      setupPresence();
      showToast('Waiting for players...');
    }
  } catch (error) {
    console.error(error);
    showToast('Matchmaking failed');
    showScreen('menu-screen');
  }
}

function cancelQuickMatch() {
  showScreen('menu-screen');
}

// ==================== LOBBY UI & LOGIC ====================
function updateLobbyUI() {
  const codeEl = document.getElementById('display-room-code');
  if (codeEl) codeEl.textContent = multiplayerState.lobbyId;
  const codeElMini = document.getElementById('room-code-mini');
  if (codeElMini) codeElMini.textContent = multiplayerState.lobbyId;
  
  const modeEl = document.getElementById('lobby-mode-display');
  if (modeEl) modeEl.textContent = multiplayerState.gameMode.charAt(0).toUpperCase() + multiplayerState.gameMode.slice(1) + ' Mode';
}

function copyRoomCode() {
  navigator.clipboard.writeText(multiplayerState.lobbyId).then(() => {
    showToast('Code copied!');
    playSound('card');
  });
}

function setupLobbyListeners() {
  if (!multiplayerState.lobbyRef) return;
  
  multiplayerState.lobbyRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    
    renderLobbyPlayers(data.players || {}, data.playerOrder || []);
    updateLobbyInfo(data);
    
    if (data.status === 'playing') startGameFromLobby();
  });
  
  multiplayerState.lobbyRef.child('chat').limitToLast(20).on('child_added', (snap) => {
    const msg = snap.val();
    if (msg) displayChatMessage(msg);
  });
}

function updateLobbyInfo(data) {
  const countEl = document.getElementById('lobby-player-count');
  const maxEl = document.getElementById('lobby-max-players');
  const startBtn = document.getElementById('start-game-btn');
  
  if (countEl) countEl.textContent = data.playerOrder ? data.playerOrder.length : 0;
  if (maxEl) maxEl.textContent = data.maxPlayers || 4;
  
  if (startBtn) {
    const isHost = data.hostId === multiplayerState.playerId;
    const allReady = Object.values(data.players).every(p => p.isReady || p.isBot);
    const enoughPlayers = data.playerOrder.length >= 2;
    startBtn.disabled = !(isHost && allReady && enoughPlayers);
  }
}

function renderLobbyPlayers(players, playerOrder) {
  const grid = document.getElementById('lobby-players-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  for (let i = 0; i < multiplayerState.maxPlayers; i++) {
    const pId = playerOrder[i];
    const player = pId ? players[pId] : null;
    
    const slot = document.createElement('div');
    slot.className = 'lobby-player-slot ' + (player ? 'filled' : '');
    if (player) {
      if (player.isHost) slot.classList.add('host');
      if (pId === multiplayerState.playerId) slot.classList.add('you');
      slot.innerHTML = `
        <div class="slot-avatar" style="background: ${getPlayerColor(i)}">${player.isBot ? '🤖' : '👤'}</div>
        <span class="slot-name">${player.name}</span>
        <span class="slot-status">${player.isReady ? 'Ready' : 'Waiting'}</span>
        ${player.isHost ? '<div class="slot-host-badge">HOST</div>' : ''}
      `;
    } else {
      slot.innerHTML = `<div class="slot-avatar"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg></div><span class="slot-name">Waiting...</span>`;
    }
    grid.appendChild(slot);
  }
}

function toggleReady() {
  if (!multiplayerState.lobbyRef) return;
  multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId + '/isReady').transaction(ready => !ready);
  playSound('card');
}

async function startMultiplayerGame() {
  if (!multiplayerState.isHost || !multiplayerState.lobbyRef) return;
  
  const snapshot = await multiplayerState.lobbyRef.once('value');
  const lobbyData = snapshot.val();
  if (!lobbyData) return;
  
  const deck = createDeck();
  const startCard = deck.pop();
  
  const playerHands = {};
  lobbyData.playerOrder.forEach(pid => { playerHands[pid] = []; for(let i=0; i<7; i++) playerHands[pid].push(deck.pop()); });
  
  const gameData = {
    deck, discard: [startCard], activeColor: startCard.c,
    turn: 0, direction: 1, drawStack: 0, stackType: null,
    playerOrder: lobbyData.playerOrder, playerHands, playerData: lobbyData.players,
    status: 'playing', startedAt: firebase.database.ServerValue.TIMESTAMP,
    gameMode: lobbyData.gameMode
  };
  
  await multiplayerState.lobbyRef.update({ status: 'playing' });
  await multiplayerState.lobbyRef.child('game').set(gameData);
  playSound('start');
}

function startGameFromLobby() {
  showScreen('game-app');
  initAudio();
  multiplayerState.gameRef = multiplayerState.lobbyRef.child('game');
  setupGameListeners();
}

async function leaveLobby() {
  cleanupLobby();
  showScreen('menu-screen');
}

function cleanupLobby() {
  if (multiplayerState.lobbyRef && multiplayerState.playerId) {
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId).remove();
    multiplayerState.lobbyRef.child('playerOrder').transaction(order => {
      if (!order) return null;
      const newOrder = order.filter(id => id !== multiplayerState.playerId);
      if (newOrder.length === 0) return null;
      // Transfer host
      if (multiplayerState.isHost) {
        multiplayerState.lobbyRef.child('hostId').set(newOrder[0]);
        multiplayerState.lobbyRef.child('players/' + newOrder[0] + '/isHost').set(true);
      }
      return newOrder;
    });
    multiplayerState.lobbyRef.off();
  }
  multiplayerState.lobbyRef = null;
  multiplayerState.lobbyId = null;
  multiplayerState.isHost = false;
}

// ==================== CHAT ====================
function displayChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'chat-message';
  el.innerHTML = `<span class="chat-message-sender" style="color:${getPlayerColor(msg.idx || 0)}">${msg.name}:</span> <span class="chat-message-text">${msg.text}</span>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || !multiplayerState.lobbyRef) return;
  const text = input.value.trim();
  if (!text) return;
  await multiplayerState.lobbyRef.child('chat').push({
    name: multiplayerState.playerName, idx: multiplayerState.playerIndex, text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  input.value = '';
}

// ==================== PRESENCE ====================
function setupPresence() {
  if (!multiplayerState.lobbyId || !multiplayerState.playerId) return;
  const pRef = database.ref('presence/' + multiplayerState.lobbyId + '/' + multiplayerState.playerId);
  multiplayerState.playerPresenceRef = pRef;
  pRef.set({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP, name: multiplayerState.playerName });
  pRef.onDisconnect().update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
}

// ==================== GAME SYNC ====================
function setupGameListeners() {
  if (!multiplayerState.gameRef) return;
  multiplayerState.gameRef.on('value', (snap) => {
    const data = snap.val();
    if (!data) return;
    syncGameState(data);
  });
}

function syncGameState(data) {
  const idx = data.playerOrder.indexOf(multiplayerState.playerId);
  multiplayerState.playerIndex = idx;
  
  state.players = data.playerOrder.map((pid, i) => {
    const pData = data.playerData[pid];
    return {
      id: pid, name: pData.name, hand: data.playerHands[pid] || [],
      isBot: pData.isBot || false, isConnected: pData.isConnected !== false
    };
  });
  
  state.deck = data.deck || [];
  state.discard = data.discard || [];
  state.activeColor = data.activeColor || 'red';
  state.turn = data.turn || 0;
  state.direction = data.direction || 1;
  state.drawStack = data.drawStack || 0;
  state.stackType = data.stackType || null;
  state.active = true;
  state.isOver = false;
  
  renderHand();
  updateUI();
  updatePlayerZones();
  
  const curr = state.players[state.turn];
  if (state.turn === idx && !curr.isBot && curr.isConnected) {
    startTimer();
    vibrate(100);
  } else {
    stopTimer();
    if (curr && (curr.isBot || !curr.isConnected)) setTimeout(botTurn, 1000);
  }
}

async function sendGameAction(actionType, actionData) {
  if (!multiplayerState.gameRef) return;
  await multiplayerState.gameRef.child('lastAction').set({
    type: actionType, pid: multiplayerState.playerId, idx: multiplayerState.playerIndex,
    data: actionData, time: firebase.database.ServerValue.TIMESTAMP
  });
}

// ==================== GAME LOGIC ====================
function checkValidPlay(card) {
  const top = state.discard[state.discard.length - 1];
  if (!top) return true;
  if (card.c === 'black') return true;
  if (card.c === state.activeColor) return true;
  if (card.v === top.v) return true;
  return false;
}

function canStackCard(card) {
  if (!gameSettings.stacking) return false;
  if (state.stackType === '+2') return card.v === '+2' || card.v === '+4';
  if (state.stackType === '+4') return card.v === '+4';
  return false;
}

function drawCards(count) {
  let drawn = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) break;
      const top = state.discard.pop();
      state.deck = shuffle(state.discard);
      state.discard = [top];
    }
    if (state.deck.length > 0) drawn.push(state.deck.pop());
  }
  return drawn;
}

async function playCard(pIdx, cIdx) {
  if (!multiplayerState.gameRef) return;
  
  const player = state.players[pIdx];
  const card = player.hand.splice(cIdx, 1)[0];
  state.discard.push(card);
  
  if (gameSettings.stacking) {
    if (card.v === '+2') { state.drawStack += 2; state.stackType = '+2'; }
    else if (card.v === '+4') { state.drawStack += 4; state.stackType = '+4'; }
    else { state.drawStack = 0; state.stackType = null; }
  }
  
  if (card.c === 'black') {
    if (pIdx === multiplayerState.playerIndex) {
      state.pendingWild = card;
      showColorPicker3D();
      updateUI();
      return;
    } else {
      state.activeColor = chooseColor(pIdx);
    }
  } else {
    state.activeColor = card.c;
  }
  
  if (player.hand.length === 0) { await endMultiplayerGame(pIdx); return; }
  if (player.hand.length === 1) state.saidUno.add(pIdx);
  
  await applyCardEffect(card, pIdx);
  await advanceTurn();
  
  // Sounds/Effects
  if (card.v === 'S') { playSound('skip'); showActionFlash('skip'); showSkipSymbol(getNextPlayerIndex()); }
  else if (card.v === 'R') { playSound('reverse'); showActionFlash('reverse'); showReverseSymbol(); }
  else if (card.c === 'black') { playSound('wild'); createWildExplosion(); }
  else playSound('card');
  
  vibrate(50);
  updateUI(); renderHand();
}

async function applyCardEffect(card, pIdx) {
  const nextIdx = getNextPlayerIndex();
  const nextP = state.players[nextIdx];
  
  if (state.drawStack === 0 || !gameSettings.stacking) {
    if (card.v === 'S') {
      showGameMessage(nextP.name + ' Skipped!');
      state.turn = nextIdx;
    } else if (card.v === 'R') {
      state.direction *= -1;
      showGameMessage('Reversed!');
      if (state.players.length === 2) state.turn = nextIdx;
    }
  }
  
  if (state.drawStack > 0 && gameSettings.stacking) {
    const canStack = nextP.hand.some(c => canStackCard(c));
    if (!canStack) {
      const drawn = drawCards(state.drawStack);
      nextP.hand.push(...drawn);
      showGameMessage(nextP.name + ' drew ' + state.drawStack + '!');
      state.drawStack = 0; state.stackType = null;
      state.turn = nextIdx;
    }
  }
}

function getNextPlayerIndex() {
  let next = state.turn + state.direction;
  if (next >= state.players.length) next = 0;
  if (next < 0) next = state.players.length - 1;
  return next;
}

async function advanceTurn() {
  state.turn = getNextPlayerIndex();
  
  const updates = {
    turn: state.turn, direction: state.direction, discard: state.discard, deck: state.deck,
    activeColor: state.activeColor, drawStack: state.drawStack, stackType: state.stackType,
    playerHands: {}
  };
  state.players.forEach(p => updates.playerHands[p.id] = p.hand);
  await multiplayerState.gameRef.update(updates);
  
  updateUI(); renderHand();
}

// ==================== BOT AI ====================
async function botTurn() {
  if (state.isOver || !state.active) return;
  const player = state.players[state.turn];
  if (!player || !player.isBot) return;
  
  if (state.drawStack > 0 && gameSettings.stacking) {
    const sIdx = player.hand.findIndex(c => canStackCard(c));
    if (sIdx !== -1) { await playCard(state.turn, sIdx); return; }
    else {
      const drawn = drawCards(state.drawStack);
      player.hand.push(...drawn);
      showGameMessage(player.name + ' drew ' + state.drawStack + '!');
      state.drawStack = 0; state.stackType = null;
      await advanceTurn(); return;
    }
  }
  
  const validMoves = [];
  player.hand.forEach((c, i) => { if (checkValidPlay(c)) validMoves.push({ c, i }); });
  
  await sleep(800);
  
  if (validMoves.length > 0) {
    validMoves.sort((a, b) => getCardPriority(b.c) - getCardPriority(a.c));
    await playCard(state.turn, validMoves[0].i);
  } else {
    const drawn = drawCards(1);
    if (drawn.length > 0) {
      player.hand.push(drawn[0]);
      showGameMessage(player.name + ' drew');
      playSound('draw');
      await sleep(400);
      if (checkValidPlay(drawn[0])) await playCard(state.turn, player.hand.length - 1);
      else await advanceTurn();
    } else await advanceTurn();
  }
}

function getCardPriority(c) {
  if (c.v === '+4') return 20;
  if (c.v === '+2') return 18;
  if (c.v === 'S') return 15;
  if (c.v === 'R') return 14;
  if (c.v === 'W') return 10;
  return parseInt(c.v) || 5;
}

function chooseColor(pIdx) {
  const p = state.players[pIdx];
  if (!p) return 'red';
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  p.hand.forEach(c => { if (c.c !== 'black') counts[c.c]++; });
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

// ==================== UI UPDATES ====================
function updateUI() {
  const discard = document.getElementById('discard-pile');
  if (discard) {
    const top = state.discard[state.discard.length - 1];
    if (top) {
      discard.innerHTML = '';
      const el = renderCard(top);
      state.discardRotation = (state.discardRotation || 0) + (Math.random() * 20 - 10);
      el.style.transform = 'rotate(' + state.discardRotation + 'deg)';
      discard.appendChild(el);
    }
  }
  
  const colorInd = document.getElementById('color-indicator');
  if (colorInd) colorInd.className = 'color-indicator ' + state.activeColor;
  
  const deckC = document.getElementById('deck-count');
  if (deckC) deckC.textContent = state.deck.length;
  
  const dir = document.getElementById('direction-indicator');
  if (dir) {
    dir.classList.add('active');
    dir.classList.toggle('clockwise', state.direction === 1);
    dir.classList.toggle('counter', state.direction === -1);
  }
  
  const unoBtn = document.getElementById('uno-btn');
  const curr = state.players[state.turn];
  if (unoBtn && curr) {
    const show = state.turn === multiplayerState.playerIndex && curr.hand.length === 2 && state.active && !state.saidUno.has(multiplayerState.playerIndex);
    unoBtn.classList.toggle('active', show);
  }
  
  updateTurnIndicator();
}

function updateTurnIndicator() {
  const ind = document.getElementById('turn-indicator');
  const txt = document.getElementById('turn-text');
  if (!ind) return;
  if (state.active && !state.isOver) {
    ind.style.display = 'flex';
    const curr = state.players[state.turn];
    txt.textContent = state.turn === multiplayerState.playerIndex ? 'Your Turn' : curr?.name + "'s Turn";
  } else ind.style.display = 'none';
}

function updatePlayerZones() {
  state.players.forEach((p, i) => {
    const zone = document.querySelector('.player-zone.player-' + getPositionClass(i, state.players.length));
    if (!zone) return;
    
    const nameEl = zone.querySelector('.player-name');
    const countEl = zone.querySelector('.card-count');
    const info = zone.querySelector('.player-info');
    
    if (nameEl) nameEl.textContent = p.name + (p.isBot ? ' 🤖' : '');
    if (countEl) countEl.textContent = p.hand.length + ' cards';
    if (info) {
      info.classList.toggle('active', state.turn === i);
      info.classList.toggle('warning', state.turn === i && state.timer <= 3);
    }
    
    const cardsCon = zone.querySelector('.bot-cards-horizontal, .bot-cards-vertical');
    if (cardsCon && i !== multiplayerState.playerIndex) {
      cardsCon.innerHTML = '';
      const cnt = Math.min(p.hand.length, 7);
      for (let j = 0; j < cnt; j++) cardsCon.appendChild(renderCard(null, true));
    }
    
    let alert = zone.querySelector('.uno-alert');
    if (p.hand.length === 1) {
      if (!alert) { alert = document.createElement('div'); alert.className = 'uno-alert'; alert.textContent = 'UNO!'; info?.appendChild(alert); }
    } else alert?.remove();
  });
}

// ==================== HAND RENDERING ====================
function renderHand() {
  const con = document.getElementById('player-hand');
  if (!con) return;
  con.innerHTML = '';
  
  const p = state.players[multiplayerState.playerIndex];
  if (!p) return;
  const isMyTurn = state.turn === multiplayerState.playerIndex;
  
  p.hand.forEach((card, i) => {
    const el = renderCard(card);
    let valid = false;
    if (isMyTurn && state.active && !p.isBot) {
      valid = (state.drawStack > 0 && gameSettings.stacking) ? canStackCard(card) : checkValidPlay(card);
    }
    
    if (valid) el.classList.add('playable');
    
    el.onclick = async () => {
      if (!state.active || state.turn !== multiplayerState.playerIndex || p.isBot) return;
      if (valid) await playCard(multiplayerState.playerIndex, i);
      else { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); }
    };
    
    con.appendChild(el);
  });
}

function sortHand(type) {
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sort-' + type)?.classList.add('active');
  
  const p = state.players[multiplayerState.playerIndex];
  if (!p) return;
  
  if (type === 'color') p.hand.sort((a, b) => (a.c === 'black ? 1 : 0) - (b.c === 'black' ? 1 : 0) || a.c.localeCompare(b.c));
  else p.hand.sort((a, b) => (parseInt(a.v) || 20) - (parseInt(b.v) || 20));
  
  renderHand();
}

// ==================== COLOR PICKER ====================
function showColorPicker3D() { document.getElementById('color-picker-3d')?.classList.add('active'); }
function hideColorPicker3D() { document.getElementById('color-picker-3d')?.classList.remove('active'); }

async function selectWildColor(color) {
  state.activeColor = color;
  hideColorPicker3D();
  await multiplayerState.gameRef?.update({ activeColor: color });
  await applyCardEffect(state.pendingWild, multiplayerState.playerIndex);
  state.pendingWild = null;
  await advanceTurn();
  playSound('wild');
  createWildExplosion();
}

// ==================== DRAW CARD ====================
async function handleDrawPile() {
  if (state.turn !== multiplayerState.playerIndex || !state.active) return;
  const p = state.players[multiplayerState.playerIndex];
  if (p.isBot) return;
  
  stopTimer();
  
  if (state.drawStack > 0 && gameSettings.stacking && p.hand.some(c => canStackCard(c))) {
    showGameMessage("You can stack!"); startTimer(); return;
  }
  
  const cards = drawCards(state.drawStack > 0 ? state.drawStack : 1);
  if (state.drawStack > 0) { p.hand.push(...cards); state.drawStack = 0; state.stackType = null; }
  else if (cards[0]) {
    p.hand.push(cards[0]);
    const playable = checkValidPlay(cards[0]);
    if (playable) showDrawnCardPopup(cards[0], true);
    else { showGameMessage("Cannot play"); await sleep(500); await advanceTurn(); }
  }
  
  renderHand(); updateUI();
}

function showDrawnCardPopup(card, canPlay) {
  const popup = document.getElementById('drawn-card-popup');
  const display = document.getElementById('drawn-card-display');
  const playBtn = document.getElementById('play-btn');
  if (!popup || !display) return;
  
  display.innerHTML = ''; display.appendChild(renderCard(card));
  if (playBtn) playBtn.style.display = canPlay ? 'block' : 'none';
  popup.classList.add('active');
  state.drawnCard = card;
}

function hideDrawnCardPopup() { document.getElementById('drawn-card-popup')?.classList.remove('active'); }

async function handlePlayDrawnCard() {
  const p = state.players[multiplayerState.playerIndex];
  if (!p || !state.drawnCard) return;
  hideDrawnCardPopup();
  await playCard(multiplayerState.playerIndex, p.hand.length - 1);
}

async function handleKeepCard() { hideDrawnCardPopup(); await advanceTurn(); }

// ==================== UNO BUTTON ====================
async function handleUnoButton() {
  if (state.turn !== multiplayerState.playerIndex || !state.active) return;
  const p = state.players[multiplayerState.playerIndex];
  if (!p || p.hand.length !== 2) return;
  state.saidUno.add(multiplayerState.playerIndex);
  playSound('uno');
  showGameMessage('UNO!');
}

// ==================== EMOTES ====================
function toggleEmotePanel(idx) {
  const panel = document.getElementById('emote-panel');
  if (panel) panel.classList.toggle('active');
}

async function sendEmote(key) {
  const emote = EMOTES[key];
  if (!emote) return;
  showEmote(multiplayerState.playerIndex, emote);
  playSound('emote');
  document.getElementById('emote-panel')?.classList.remove('active');
}

function showEmote(idx, emote) {
  const zone = document.querySelector('.player-zone.player-' + getPositionClass(idx, state.players.length));
  if (!zone) return;
  let bubble = zone.querySelector('.emote-bubble');
  if (!bubble) { bubble = document.createElement('div'); bubble.className = 'emote-bubble'; zone.appendChild(bubble); }
  bubble.textContent = emote;
  bubble.classList.add('show');
  setTimeout(() => bubble.classList.remove('show'), 2000);
}

// ==================== EFFECTS ====================
function showActionFlash(type) {
  const ov = document.getElementById('action-flash-overlay');
  if (!ov) return;
  ov.className = 'action-flash-overlay ' + type;
  void ov.offsetWidth;
  ov.classList.add('active');
  setTimeout(() => ov.classList.remove('active'), 500);
}

function showSkipSymbol(idx) {
  const zone = document.querySelector('.player-zone.player-' + getPositionClass(idx, state.players.length));
  if (!zone) return;
  let sym = zone.querySelector('.skip-symbol');
  if (!sym) { sym = document.createElement('div'); sym.className = 'skip-symbol'; sym.innerHTML = '⊘'; zone.appendChild(sym); }
  sym.classList.add('show');
  setTimeout(() => sym.classList.remove('show'), 1000);
}

function showReverseSymbol() {
  showGameMessage('Direction Reversed!');
  const dir = document.getElementById('direction-indicator');
  if (dir) {
    dir.style.transform = 'scale(1.5)';
    setTimeout(() => dir.style.transform = '', 300);
  }
}

function createWildExplosion() {
  const cont = document.getElementById('wild-explosion');
  if (!cont) return;
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B'];
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'wild-particle';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');
    p.style.setProperty('--ty', (Math.random() - 0.5) * 200 + 'px');
    cont.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

// ==================== END GAME ====================
async function endMultiplayerGame(winnerIdx) {
  state.isOver = true; state.active = false;
  stopTimer();
  
  const isWin = winnerIdx === multiplayerState.playerIndex;
  if (isWin) { createConfetti(); playSound('win'); }
  else playSound('lose');
  
  document.getElementById('game-over')?.classList.add('active');
  const resIcon = document.getElementById('result-icon');
  const winText = document.getElementById('winner-text');
  const xpVal = document.getElementById('xp-value');
  
  if (resIcon) resIcon.innerHTML = isWin ? '🏆' : '😢';
  if (winText) winText.textContent = isWin ? 'YOU WIN!' : 'YOU LOSE';
  if (xpVal) xpVal.textContent = '+' + (isWin ? 300 : 50);
  
  multiplayerState.lobbyRef?.update({ status: 'finished' });
}

function createConfetti() {
  const cont = document.getElementById('confetti-container');
  if (!cont) return;
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B'];
  for (let i = 0; i < 50; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    cont.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

function rematch() {
  document.getElementById('game-over')?.classList.remove('active');
  if (multiplayerState.isHost) multiplayerState.lobbyRef?.update({ status: 'waiting', game: null });
  showScreen('lobby-room');
}

function backToLobby() {
  document.getElementById('game-over')?.classList.remove('active');
  showScreen('lobby-room');
}

function backToMenu() {
  document.getElementById('game-over')?.classList.remove('active');
  cleanupLobby();
  showScreen('menu-screen');
}

// ==================== TIMER ====================
function startTimer() {
  if (!gameSettings.timer) return;
  stopTimer();
  state.timer = TURN_TIME;
  updatePlayerZones();
  
  state.timerInterval = setInterval(() => {
    state.timer--;
    updatePlayerZones();
    if (state.timer <= 3 && state.timer > 0) playSound('tick');
    if (state.timer <= 0) { stopTimer(); handleTimeout(); }
  }, 1000);
}

function stopTimer() { if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; } }

async function handleTimeout() {
  if (state.turn !== multiplayerState.playerIndex) return;
  showGameMessage('Time Out!');
  
  if (state.drawStack > 0) {
    const drawn = drawCards(state.drawStack);
    state.players[multiplayerState.playerIndex].hand.push(...drawn);
    state.drawStack = 0; state.stackType = null;
  } else {
    const c = drawCards(1)[0];
    if (c) state.players[multiplayerState.playerIndex].hand.push(c);
  }
  renderHand(); updateUI();
  await advanceTurn();
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  runLoadingScreen();
  
  // Theme cards selection (solo vs multiplayer handled via buttons inside)
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });
  
  // Mode buttons in Create Lobby
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Player count buttons
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Color picker
  document.querySelectorAll('.color-box-3d').forEach(box => {
    box.addEventListener('click', () => selectWildColor(box.dataset.color));
  });
  
  // Draw pile
  document.getElementById('draw-pile')?.addEventListener('click', handleDrawPile);
  
  // UNO button
  document.getElementById('uno-btn')?.addEventListener('click', handleUnoButton);
  
  // Drawn card buttons
  document.getElementById('keep-btn')?.addEventListener('click', handleKeepCard);
  document.getElementById('play-btn')?.addEventListener('click', handlePlayDrawnCard);
  
  // Chat
  document.getElementById('chat-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendChatMessage(); });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (state.isOver || !state.active) return;
    if (e.key === 'u' || e.key === 'U') handleUnoButton();
    if (e.key === 'd' || e.key === 'D') handleDrawPile();
    if (e.key === 'Escape') { hideColorPicker3D(); hideDrawnCardPopup(); }
  });
});
