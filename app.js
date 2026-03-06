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
  angry: '😠',
  laugh: '😂',
  cry: '😢',
  fire: '🔥',
  cool: '😎',
  think: '🤔'
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
        if (i < s.freq.length - 1) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, s.freq[i + 1]), startTime + noteLength);
        }
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
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// ==================== UTILITY FUNCTIONS ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getPlayerColor(idx) {
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];
  return colors[idx % colors.length];
}

function getPositionClass(idx, totalPlayers) {
  if (totalPlayers === 2) return idx === 0 ? 'bottom' : 'top';
  if (totalPlayers === 3) {
    const positions = ['bottom', 'right', 'left'];
    return positions[idx];
  }
  return ['bottom', 'left', 'top', 'right'][idx];
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
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
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
  
  // Setup connection monitor
  setupConnectionMonitor();
}

// ==================== CONNECTION STATUS ====================
function setupConnectionMonitor() {
  const connectedRef = database.ref('.info/connected');
  connectedRef.on('value', (snap) => {
    const connected = snap.val() === true;
    updateConnectionStatus(connected);
    
    if (connected && multiplayerState.playerId && multiplayerState.lobbyId) {
      setupPresence();
    }
    
    if (!connected && state.active) {
      showToast('Connection lost! Reconnecting...');
    }
  });
}

function updateConnectionStatus(connected) {
  let statusEl = document.getElementById('connection-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'connection-status';
    statusEl.className = 'connection-status';
    document.body.appendChild(statusEl);
  }
  
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
         <defs>
          <linearGradient id="unoRedLocal${randId}" x1="0%" y1="0%" x2="100%" y2="100%">
           <stop offset="0%" stop-color="#FF3B5C"/>
           <stop offset="100%" stop-color="#E6194B"/>
          </linearGradient>
         </defs>
         <g>
          <rect width="240" height="360" rx="18" fill="#1a1a2e"/>
          <rect x="10" y="10" width="220" height="340" rx="12" fill="none" stroke="#ffffff" stroke-width="6"/>
          <ellipse cx="120" cy="180" rx="80" ry="140" fill="url(#unoRedLocal${randId})" transform="rotate(20 120 180)"/>
          <text x="120" y="195" font-family="Bebas Neue, Arial Black, sans-serif" font-size="60" font-weight="900" fill="#FFD43B" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 120 190)">UNO</text>
         </g>
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
    cornerValue = '⊘';
    centerFontSize = 120;
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${cornerValue}</text>
                      <text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">${cornerValue}</text>`;
  } else if (card.v === 'R') {
    cornerValue = '⟲';
    centerFontSize = 120;
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${cornerValue}</text>
                      <text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">${cornerValue}</text>`;
  } else if (card.v === '+2') {
    centerFontSize = 120;
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">+2</text>
                      <text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">+2</text>`;
  } else if (card.v === 'W') {
    cornerValue = 'W';
    centerContent = '';
  } else if (card.v === '+4') {
    cornerValue = '+4';
    centerContent = `<g transform="skewX(-10)">
        <text stroke-width="10" stroke="#000000" dominant-baseline="middle" text-anchor="middle" fill="#000000" font-weight="900" font-size="100" font-family="Arial Black, sans-serif" y="186" x="152.41306">+4</text>
        <text dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-weight="900" font-size="100" font-family="Arial Black, sans-serif" y="179" x="145.41306">+4</text>
      </g>`;
  } else {
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${card.v}</text>
                      <text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">${card.v}</text>`;
  }

  let wildPattern = '';
  if (isWild) {
    wildPattern = `
      <g transform="rotate(-50 120 180)">
       <path fill="#4DABF7" d="m120,180l0,-85a145,85 0 0 1 145,85l-145,0z"/>
       <path fill="#51CF66" d="m120,180l145,0a145,85 0 0 1 -145,85l0,-85z"/>
       <path fill="#FFD43B" d="m120,180l0,85a145,85 0 0 1 -145,-85l145,0z"/>
       <path fill="#FF3B5C" d="m120,180l-145,0a145,85 0 0 1 145,-85l0,85z"/>
       <ellipse stroke-width="4" stroke="#ffffff" fill="none" ry="85" rx="145" cy="180" cx="120"/>
      </g>`;
  }

  let centerEllipse = '';
  if (!isWild) {
    centerEllipse = `<ellipse transform="rotate(-60.409 117.875 181.408)" stroke="#ffffff" cx="117.87508" cy="181.40815" rx="159.19945" ry="82.07582" fill="none" stroke-width="6"/>`;
  }

  el.innerHTML = `
    <svg width="240" height="360" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
     <g>
      <rect x="0" y="0" width="240" height="360" rx="25" ry="25" fill="${fill}"/>
      <rect x="10" y="10" width="220" height="340" rx="20" ry="20" fill="none" stroke="#ffffff" stroke-width="8"/>
      ${centerEllipse}
      ${wildPattern}
      ${centerContent}
      <g>
       <text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#000000" text-anchor="middle" x="44.67969" y="61">${cornerValue}</text>
       <text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#ffffff" text-anchor="middle" y="58" x="41.67969">${cornerValue}</text>
      </g>
      <g transform="rotate(180 162 238)">
       <text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#000000" text-anchor="middle" x="45" y="61">${cornerValue}</text>
       <text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#ffffff" text-anchor="middle" y="58" x="42">${cornerValue}</text>
      </g>
     </g>
    </svg>`;

  return el;
}

// ==================== MENU & MODAL FUNCTIONS ====================
function showMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.add('active');
}

function closeMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.remove('active');
}

function showCreateLobby() {
  closeMultiplayerOptions();
  const modal = document.getElementById('create-lobby-modal');
  if (modal) {
    modal.classList.add('active');
    const nameInput = document.getElementById('host-name');
    if (nameInput) nameInput.value = multiplayerState.playerName;
    setupModalButtons(modal);
  }
}

function setupModalButtons(modal) {
    modal.querySelectorAll('.mode-btn').forEach(btn => {
      if (!btn.dataset.initialized) {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
        btn.dataset.initialized = "true";
      }
    });
    
    modal.querySelectorAll('.count-btn').forEach(btn => {
      if (!btn.dataset.initialized) {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
        btn.dataset.initialized = "true";
      }
    });
}

function closeCreateLobby() {
  const modal = document.getElementById('create-lobby-modal');
  if (modal) modal.classList.remove('active');
}

function togglePrivate() {
  const toggle = document.getElementById('private-toggle');
  if (toggle) toggle.classList.toggle('active');
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
  
  // Create lobby in Firebase
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
    showToast('Failed to create lobby. Please try again.');
    showScreen('menu-screen');
  }
}

// ==================== JOIN LOBBY ====================
function showJoinLobby() {
  closeMultiplayerOptions();
  const modal = document.getElementById('join-lobby-modal');
  if (modal) {
    modal.classList.add('active');
    const nameInput = document.getElementById('join-name');
    if (nameInput) nameInput.value = multiplayerState.playerName;
    refreshPublicLobbies();
  }
}

function closeJoinLobby() {
  const modal = document.getElementById('join-lobby-modal');
  if (modal) modal.classList.remove('active');
}

async function refreshPublicLobbies() {
  const listEl = document.getElementById('public-lobby-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="lobby-empty">Searching...</div>';
  
  try {
    const snapshot = await database.ref('lobbies')
      .orderByChild('isPrivate')
      .equalTo(false)
      .once('value');
    
    const lobbies = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === 'waiting') {
        const playerCount = data.playerOrder ? data.playerOrder.length : 0;
        if (playerCount < data.maxPlayers) {
          lobbies.push({
            id: child.key,
            ...data,
            playerCount: playerCount
          });
        }
      }
    });
    
    if (lobbies.length === 0) {
      listEl.innerHTML = '<div class="lobby-empty">No public lobbies available</div>';
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
    listEl.innerHTML = '<div class="lobby-empty">Failed to load lobbies</div>';
  }
}

async function joinLobbyByCode() {
  const nameInput = document.getElementById('join-name');
  const codeInput = document.getElementById('room-code-input');
  
  multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
  const roomCode = codeInput?.value?.toUpperCase().trim();
  
  if (!roomCode || roomCode.length < 8) {
    showToast('Please enter a valid room code');
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
    
    if (!lobbyData) {
      showToast('Lobby not found!');
      showScreen('menu-screen');
      return;
    }
    
    if (lobbyData.status !== 'waiting') {
      showToast('Game already in progress!');
      showScreen('menu-screen');
      return;
    }
    
    const currentCount = lobbyData.playerOrder ? lobbyData.playerOrder.length : 0;
    if (currentCount >= lobbyData.maxPlayers) {
      showToast('Lobby is full!');
      showScreen('menu-screen');
      return;
    }
    
    // Add player to lobby
    const updates = {};
    updates['/players/' + multiplayerState.playerId] = {
      name: multiplayerState.playerName,
      isHost: false,
      isReady: false,
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
      isBot: false,
      isConnected: true
    };
    
    const newOrder = [...(lobbyData.playerOrder || []), multiplayerState.playerId];
    updates['/playerOrder'] = newOrder;
    
    await lobbyRef.update(updates);
    
    multiplayerState.playerIndex = newOrder.indexOf(multiplayerState.playerId);
    multiplayerState.gameMode = lobbyData.gameMode || 'classic';
    multiplayerState.maxPlayers = lobbyData.maxPlayers || 4;
    
    updateLobbyUI();
    setupLobbyListeners();
    setupPresence();
    playSound('join');
    showToast('Joined lobby: ' + lobbyId);
    
  } catch (error) {
    console.error('Error joining lobby:', error);
    showToast('Failed to join lobby');
    showScreen('menu-screen');
  }
}

// ==================== QUICK MATCH ====================
function startQuickMatch() {
  showScreen('quick-match-screen');
  performQuickMatch();
}

async function performQuickMatch() {
  multiplayerState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  multiplayerState.isQuickMatch = true;
  
  try {
    // Search for available public lobbies
    const snapshot = await database.ref('lobbies')
      .orderByChild('isPrivate')
      .equalTo(false)
      .once('value');
    
    let foundLobby = null;
    
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === 'waiting') {
        const playerCount = data.playerOrder ? data.playerOrder.length : 0;
        if (playerCount < data.maxPlayers && playerCount > 0) {
          foundLobby = { id: child.key, ...data };
        }
      }
    });
    
    if (foundLobby) {
      await joinLobbyById(foundLobby.id);
    } else {
      await createQuickMatchLobby();
    }
    
  } catch (error) {
    console.error('Quick match error:', error);
    showToast('Failed to find match. Please try again.');
    showScreen('menu-screen');
  }
}

function cancelQuickMatch() {
  showScreen('menu-screen');
}

async function createQuickMatchLobby() {
  multiplayerState.isHost = true;
  multiplayerState.playerName = 'Player_' + Math.random().toString(36).substr(2, 4);
  
  const roomCode = generateRoomCode();
  multiplayerState.lobbyId = roomCode;
  
  showScreen('lobby-room');
  
  const lobbyRef = database.ref('lobbies/' + roomCode);
  multiplayerState.lobbyRef = lobbyRef;
  
  const lobbyData = {
    hostId: multiplayerState.playerId,
    hostName: multiplayerState.playerName,
    gameMode: 'classic',
    maxPlayers: 4,
    isPrivate: false,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    status: 'waiting',
    isQuickMatch: true,
    players: {
      [multiplayerState.playerId]: {
        name: multiplayerState.playerName,
        isHost: true,
        isReady: true,
        isBot: false,
        isConnected: true,
        joinedAt: firebase.database.ServerValue.TIMESTAMP
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
  } catch (error) {
    console.error('Error creating quick match:', error);
    showToast('Failed to create match');
    showScreen('menu-screen');
  }
}

// ==================== LOBBY UI ====================
function updateLobbyUI() {
  // Update Room Code
  const codeEl = document.getElementById('display-room-code');
  if (codeEl) codeEl.textContent = multiplayerState.lobbyId;
  
  const codeEl2 = document.getElementById('room-code-mini');
  if (codeEl2) codeEl2.textContent = multiplayerState.lobbyId;

  // Update Mode & Player Count
  const modeEl = document.getElementById('lobby-mode-display');
  if (modeEl) modeEl.textContent = multiplayerState.gameMode.charAt(0).toUpperCase() + multiplayerState.gameMode.slice(1) + " Mode";
}

function copyRoomCode() {
  navigator.clipboard.writeText(multiplayerState.lobbyId).then(() => {
    showToast('Room code copied!');
    playSound('card');
  }).catch(() => {
    showToast('Failed to copy');
  });
}

function pasteCode() {
  navigator.clipboard.readText().then(text => {
    const input = document.getElementById('room-code-input');
    if (input) input.value = text;
  }).catch(err => {
    showToast('Failed to paste');
  });
}

function changeTeam() {
  // Placeholder for team mode logic if implemented
  showToast("Team changing not implemented in this mode.");
}

function renderLobbyPlayers(players, playerOrder) {
  const grid = document.getElementById('lobby-players-grid');
  if (!grid) return;
  
  const maxPlayers = multiplayerState.maxPlayers;
  const orderedPlayers = playerOrder || Object.keys(players);
  
  let html = '';
  
  for (let i = 0; i < maxPlayers; i++) {
    const playerId = orderedPlayers[i];
    const player = playerId ? players[playerId] : null;
    
    if (player) {
      const isYou = playerId === multiplayerState.playerId;
      let slotClass = "lobby-player-slot filled";
      if (player.isHost) slotClass += " host";
      if (isYou) slotClass += " you";
      
      html += `
        <div class="${slotClass}">
          <div class="slot-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <span class="slot-name">${player.name}</span>
          ${player.isHost ? '<div class="slot-host-badge">HOST</div>' : ''}
          <div class="slot-status">${player.isReady ? 'Ready' : 'Waiting...'}</div>
        </div>
      `;
    } else {
      html += `
        <div class="lobby-player-slot">
          <div class="slot-avatar">
             <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <span class="slot-name">Waiting...</span>
        </div>
      `;
    }
  }
  
  grid.innerHTML = html;
}

function setupLobbyListeners() {
  if (!multiplayerState.lobbyRef) return;
  
  // Listen for player changes
  multiplayerState.lobbyRef.child('players').on('value', (snapshot) => {
    const players = snapshot.val();
    if (!players) return;
    
    multiplayerState.lobbyRef.child('playerOrder').once('value', (orderSnap) => {
      const playerOrder = orderSnap.val() || Object.keys(players);
      renderLobbyPlayers(players, playerOrder);
      updateStartButton(players, playerOrder);
      updatePlayerCountDisplay(players, playerOrder);
    });
  });
  
  multiplayerState.lobbyRef.child('playerOrder').on('value', (snapshot) => {
    const playerOrder = snapshot.val();
    multiplayerState.lobbyRef.child('players').once('value', (playersSnap) => {
      const players = playersSnap.val();
      if (players) {
        renderLobbyPlayers(players, playerOrder);
        updateStartButton(players, playerOrder);
      }
    });
  });
  
  multiplayerState.lobbyRef.child('status').on('value', (snapshot) => {
    const status = snapshot.val();
    if (status === 'playing') {
      startGameFromLobby();
    }
  });
  
  multiplayerState.lobbyRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
      showToast('Lobby has been closed');
      leaveLobby();
    }
  });
  
  // Chat Listener
  multiplayerState.lobbyRef.child('chat').limitToLast(50).on('child_added', (snapshot) => {
    const msg = snapshot.val();
    if (msg) displayChatMessage(msg);
  });
}

function updateStartButton(players, playerOrder) {
  const startBtn = document.getElementById('start-game-btn');
  if (!startBtn) return;
  
  const playerCount = playerOrder ? playerOrder.length : Object.keys(players).length;
  const allReady = Object.values(players).every(p => p.isReady || p.isBot);
  const minPlayers = multiplayerState.gameMode === 'team' ? 4 : 2;
  
  const canStart = multiplayerState.isHost && playerCount >= minPlayers && allReady;
  startBtn.disabled = !canStart;
}

function updatePlayerCountDisplay(players, playerOrder) {
  const countEl = document.getElementById('lobby-player-count');
  const maxEl = document.getElementById('lobby-max-players');
  const count = playerOrder ? playerOrder.length : Object.keys(players).length;
  
  if (countEl) countEl.textContent = count;
  if (maxEl) maxEl.textContent = multiplayerState.maxPlayers;
}

async function toggleReady() {
  if (!multiplayerState.lobbyRef || !multiplayerState.playerId) return;
  
  const playerRef = multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId);
  const snapshot = await playerRef.once('value');
  const playerData = snapshot.val();
  
  if (playerData) {
    await playerRef.update({ isReady: !playerData.isReady });
    playSound('card');
    
    // Update button text
    const btn = document.getElementById('ready-btn');
    if(btn) btn.textContent = !playerData.isReady ? "Cancel" : "Ready Up";
  }
}

async function leaveLobby() {
  cleanupLobby();
  showScreen('menu-screen');
}

function cleanupLobby() {
  if (multiplayerState.lobbyRef && multiplayerState.playerId) {
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId).remove();
    
    multiplayerState.lobbyRef.child('playerOrder').once('value', (snapshot) => {
      const order = snapshot.val() || [];
      const newOrder = order.filter(id => id !== multiplayerState.playerId);
      
      if (newOrder.length === 0) {
        multiplayerState.lobbyRef.remove();
      } else {
        multiplayerState.lobbyRef.child('playerOrder').set(newOrder);
        if (multiplayerState.isHost) {
          const newHostId = newOrder[0];
          multiplayerState.lobbyRef.child('hostId').set(newHostId);
          multiplayerState.lobbyRef.child('players/' + newHostId + '/isHost').set(true);
        }
      }
    });
    multiplayerState.lobbyRef.off();
  }
  
  if (multiplayerState.playerPresenceRef) {
    multiplayerState.playerPresenceRef.remove();
    multiplayerState.playerPresenceRef.off();
  }
  
  multiplayerState.lobbyRef = null;
  multiplayerState.lobbyId = null;
  multiplayerState.isHost = false;
  multiplayerState.playerIndex = 0;
}

// ==================== CHAT SYSTEM ====================
function displayChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message';
  if (msg.playerId === multiplayerState.playerId) msgEl.classList.add('own');
  
  msgEl.innerHTML = `
    <span class="chat-message-sender" style="color: ${getPlayerColor(msg.playerIndex || 0)}">${msg.sender}:</span>
    <span class="chat-message-text">${msg.text}</span>
  `;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || !multiplayerState.lobbyRef) return;
  
  const text = input.value.trim();
  if (!text) return;
  
  const msgData = {
    sender: multiplayerState.playerName,
    playerId: multiplayerState.playerId,
    playerIndex: multiplayerState.playerIndex,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };
  
  await multiplayerState.lobbyRef.child('chat').push(msgData);
  input.value = '';
}

// ==================== PRESENCE SYSTEM ====================
function setupPresence() {
  if (!multiplayerState.lobbyId || !multiplayerState.playerId) return;
  
  const presenceRef = database.ref('presence/' + multiplayerState.lobbyId + '/' + multiplayerState.playerId);
  multiplayerState.playerPresenceRef = presenceRef;
  
  presenceRef.set({
    online: true,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    playerName: multiplayerState.playerName
  });
  
  presenceRef.onDisconnect().update({
    online: false,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });
  
  if (multiplayerState.lobbyRef) {
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId + '/isConnected').set(true);
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId + '/isConnected').onDisconnect().set(false);
  }
  
  const lobbyPresenceRef = database.ref('presence/' + multiplayerState.lobbyId);
  lobbyPresenceRef.on('value', (snapshot) => {
    handlePresenceChanges(snapshot.val());
  });
}

function handlePresenceChanges(presenceData) {
  if (!presenceData || !state.active) return;
  
  Object.keys(presenceData).forEach(playerId => {
    const presence = presenceData[playerId];
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    
    if (playerIndex !== -1 && !presence.online) {
      handlePlayerDisconnect(playerId, playerIndex);
    }
  });
}

function handlePlayerDisconnect(playerId, playerIndex) {
  if (!state.active) return;
  
  const player = state.players[playerIndex];
  if (!player) return;
  
  player.isBot = true;
  player.isConnected = false;
  player.botReason = 'disconnected';
  
  showGameMessage(player.name + ' disconnected! Bot taking over...');
  updateUI();
  updatePlayerZones();
  
  if (state.turn === playerIndex) {
    setTimeout(botTurn, 1000);
  }
}

// ==================== AFK DETECTION ====================
function startAfkTimer() {
  stopAfkTimer();
  
  multiplayerState.afkTimer = setInterval(() => {
    const timeSinceActivity = Date.now() - multiplayerState.lastActivity;
    
    if (timeSinceActivity > AFK_TIMEOUT && state.turn === multiplayerState.playerIndex) {
      handleAfkTimeout();
    }
  }, 5000);
}

function stopAfkTimer() {
  if (multiplayerState.afkTimer) {
    clearInterval(multiplayerState.afkTimer);
    multiplayerState.afkTimer = null;
  }
}

function updateActivity() {
  multiplayerState.lastActivity = Date.now();
}

function handleAfkTimeout() {
  showGameMessage('You are AFK! Bot taking over...');
  
  const player = state.players[multiplayerState.playerIndex];
  if (player) {
    player.isBot = true;
    player.botReason = 'afk';
  }
  
  if (state.turn === multiplayerState.playerIndex) {
    botTurn();
  }
  
  updateUI();
}

// ==================== START MULTIPLAYER GAME ====================
async function startMultiplayerGame() {
  if (!multiplayerState.isHost || !multiplayerState.lobbyRef) return;
  
  const snapshot = await multiplayerState.lobbyRef.once('value');
  const lobbyData = snapshot.val();
  
  if (!lobbyData || lobbyData.status !== 'waiting') return;
  
  const playerCount = lobbyData.playerOrder ? lobbyData.playerOrder.length : 0;
  const minPlayers = multiplayerState.gameMode === 'team' ? 4 : 2;
  
  if (playerCount < minPlayers) {
    showToast('Need at least ' + minPlayers + ' players');
    return;
  }
  
  const deck = createDeck();
  let startCard = deck.pop();
  
  // Ensure first card is not a wild or action card for simplicity
  while (startCard.c === 'black' || ['S', 'R', '+2'].includes(startCard.v)) {
    deck.unshift(startCard);
    shuffle(deck);
    startCard = deck.pop();
  }

  const playerHands = {};
  lobbyData.playerOrder.forEach(playerId => {
    playerHands[playerId] = [];
    for (let i = 0; i < 7; i++) {
      playerHands[playerId].push(deck.pop());
    }
  });
  
  const gameData = {
    deck: deck,
    discard: [startCard],
    activeColor: startCard.c,
    turn: 0,
    direction: 1,
    drawStack: 0,
    stackType: null,
    playerOrder: lobbyData.playerOrder,
    playerHands: playerHands,
    playerData: lobbyData.players,
    status: 'playing',
    startedAt: firebase.database.ServerValue.TIMESTAMP,
    gameMode: lobbyData.gameMode,
    lastAction: null
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
  
  startAfkTimer();
  
  document.addEventListener('click', updateActivity);
  document.addEventListener('keydown', updateActivity);
  document.addEventListener('touchstart', updateActivity);
}

// ==================== GAME SYNC ====================
function setupGameListeners() {
  if (!multiplayerState.gameRef) return;
  
  multiplayerState.gameRef.on('value', (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;
    
    syncGameState(gameData);
  });
  
  multiplayerState.gameRef.child('lastAction').on('value', (snapshot) => {
    const action = snapshot.val();
    if (action && action.timestamp > Date.now() - 5000) {
      handleRemoteAction(action);
    }
  });
}

function syncGameState(gameData) {
  const playerOrder = gameData.playerOrder;
  const myIndex = playerOrder.indexOf(multiplayerState.playerId);
  
  multiplayerState.playerIndex = myIndex;
  
  state.players = playerOrder.map((playerId, idx) => {
    const pData = gameData.playerData[playerId];
    const hand = gameData.playerHands[playerId] || [];
    
    return {
      id: playerId,
      name: pData.name,
      hand: hand,
      isBot: pData.isBot || false,
      isConnected: pData.isConnected !== false,
      isHost: pData.isHost
    };
  });
  
  state.deck = gameData.deck || [];
  state.discard = gameData.discard || [];
  state.activeColor = gameData.activeColor || 'red';
  state.turn = gameData.turn || 0;
  state.direction = gameData.direction || 1;
  state.drawStack = gameData.drawStack || 0;
  state.stackType = gameData.stackType || null;
  state.active = true;
  state.isOver = false;
  
  renderHand();
  updateUI();
  updatePlayerZones();
  
  if (state.turn === myIndex && !state.players[myIndex].isBot) {
    startTimer();
    vibrate(100);
  } else {
    stopTimer();
  }
}

async function sendGameAction(actionType, actionData) {
  if (!multiplayerState.gameRef) return;
  
  const action = {
    type: actionType,
    playerId: multiplayerState.playerId,
    playerIndex: multiplayerState.playerIndex,
    data: actionData,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };
  
  await multiplayerState.gameRef.child('lastAction').set(action);
}

function handleRemoteAction(action) {
  if (action.playerId === multiplayerState.playerId) return;
  
  switch (action.type) {
    case 'playCard':
      playSound('card');
      break;
    case 'drawCard':
      playSound('draw');
      break;
    case 'skip':
      playSound('skip');
      showActionFlash('skip');
      break;
    case 'reverse':
      playSound('reverse');
      showActionFlash('reverse');
      showReverseSymbol();
      break;
    case 'wild':
      playSound('wild');
      showActionFlash('wild');
      createWildExplosion();
      break;
    case 'drawStack':
      showGameMessage(`${state.players[action.playerIndex]?.name} drew ${action.data.count} cards!`);
      break;
    case 'uno':
      playSound('uno');
      showGameMessage('UNO!');
      break;
    case 'emote':
      showEmote(action.playerIndex, action.data.emote);
      break;
  }
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
  count = Math.max(0, Math.floor(count));
  let drawn = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) break;
      const topCard = state.discard.pop();
      state.deck = shuffle(state.discard);
      state.discard = [topCard];
    }
    if (state.deck.length > 0) drawn.push(state.deck.pop());
  }
  return drawn;
}

async function playCard(playerIndex, cardIndex) {
  if (!multiplayerState.gameRef) return;
  
  const player = state.players[playerIndex];
  if (!player) return;
  
  const card = player.hand.splice(cardIndex, 1)[0];
  state.discard.push(card);
  
  if (gameSettings.stacking) {
    if (card.v === '+2') {
      state.drawStack += 2;
      state.stackType = '+2';
    } else if (card.v === '+4') {
      state.drawStack += 4;
      state.stackType = '+4';
    } else {
      state.drawStack = 0;
      state.stackType = null;
    }
  }
  
  if (card.c === 'black') {
    if (playerIndex === multiplayerState.playerIndex) {
      state.pendingWild = card;
      showColorPicker3D();
      updateUI();
      return;
    }
  } else {
    state.activeColor = card.c;
  }
  
  if (player.hand.length === 0) {
    await endMultiplayerGame(playerIndex);
    return;
  }
  
  if (player.hand.length === 1) {
    state.saidUno.add(playerIndex);
  }
  
  await applyCardEffect(card, playerIndex);
  await advanceTurn();
  
  await sendGameAction('playCard', { card: card, cardIndex: cardIndex });
  
  if (card.v === 'S') {
    playSound('skip');
    showActionFlash('skip');
    const skippedIdx = getNextPlayerIndex();
    setTimeout(() => showSkipSymbol(skippedIdx), 200);
  } else if (card.v === 'R') {
    playSound('reverse');
    showActionFlash('reverse');
    showReverseSymbol();
  } else if (card.v === 'W' || card.v === '+4') {
    playSound('wild');
    showActionFlash('wild');
    createWildExplosion();
  } else {
    playSound('card');
  }
  
  vibrate(50);
  updateUI();
  renderHand();
}

async function applyCardEffect(card, currentPlayerIndex) {
  const nextIdx = getNextPlayerIndex();
  const nextPlayer = state.players[nextIdx];
  
  if (state.drawStack === 0 || !gameSettings.stacking) {
    if (card.v === 'S') {
      showGameMessage(nextPlayer.name + ' Skipped!');
      state.turn = nextIdx;
    } else if (card.v === 'R') {
      state.direction *= -1;
      showGameMessage('Reversed!');
      if (state.players.length === 2) state.turn = nextIdx;
    }
  }
  
  if (state.drawStack > 0 && gameSettings.stacking) {
    const canStack = nextPlayer.hand.some(c => canStackCard(c));
    if (!canStack) {
      const drawn = drawCards(state.drawStack);
      nextPlayer.hand.push(...drawn);
      showGameMessage(nextPlayer.name + ' drew ' + state.drawStack + ' cards!');
      state.drawStack = 0;
      state.stackType = null;
      state.turn = nextIdx;
      
      await sendGameAction('drawStack', { count: drawn.length });
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
  
  if (multiplayerState.gameRef) {
    const updates = {
      turn: state.turn,
      direction: state.direction,
      discard: state.discard,
      deck: state.deck,
      activeColor: state.activeColor,
      drawStack: state.drawStack,
      stackType: state.stackType,
      playerHands: {}
    };
    
    state.players.forEach((player, idx) => {
      updates.playerHands[player.id] = player.hand;
    });
    
    await multiplayerState.gameRef.update(updates);
  }
  
  updateUI();
  renderHand();
  
  const currentPlayer = state.players[state.turn];
  if (currentPlayer && (currentPlayer.isBot || !currentPlayer.isConnected)) {
    setTimeout(botTurn, 800 + Math.random() * 500);
  } else if (state.turn === multiplayerState.playerIndex) {
    startTimer();
    vibrate(100);
  } else {
    stopTimer();
  }
}

// ==================== BOT AI ====================
async function botTurn() {
  if (state.isOver || !state.active) return;
  
  const player = state.players[state.turn];
  if (!player || !player.isBot) return;
  
  if (state.drawStack > 0 && gameSettings.stacking) {
    const stackCardIdx = player.hand.findIndex(c => canStackCard(c));
    if (stackCardIdx !== -1) {
      showGameMessage(player.name + ' stacks!');
      await playCard(state.turn, stackCardIdx);
      return;
    } else {
      const drawn = drawCards(state.drawStack);
      player.hand.push(...drawn);
      showGameMessage(player.name + ' drew ' + state.drawStack + ' cards!');
      state.drawStack = 0;
      state.stackType = null;
      await advanceTurn();
      return;
    }
  }
  
  let validMoves = [];
  player.hand.forEach((card, index) => {
    if (checkValidPlay(card)) validMoves.push({ card, index });
  });
  
  if (validMoves.length > 0) {
    validMoves.sort((a, b) => getCardPriority(b.card) - getCardPriority(a.card));
    
    await sleep(300 + Math.random() * 400);
    await playCard(state.turn, validMoves[0].index);
  } else {
    const drawn = drawCards(1);
    if (drawn.length > 0) {
      player.hand.push(drawn[0]);
      showGameMessage(player.name + ' drew a card');
      playSound('draw');
      
      if (checkValidPlay(drawn[0])) {
        await sleep(400);
        await playCard(state.turn, player.hand.length - 1);
      } else {
        await advanceTurn();
      }
    } else {
      await advanceTurn();
    }
  }
}

function getCardPriority(card) {
  if (card.v === '+4') return 20;
  if (card.v === '+2') return 18;
  if (card.v === 'S') return 15;
  if (card.v === 'R') return 14;
  if (card.v === 'W') return 10;
  return parseInt(card.v) || 5;
}

function chooseColor(playerIndex) {
  const player = state.players[playerIndex];
  if (!player) return 'red';
  let counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  player.hand.forEach(c => { if (c.c !== 'black') counts[c.c]++; });
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
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
    
    if (state.timer <= 3 && state.timer > 0) {
      playSound('tick');
      vibrate(50);
    }
    
    if (state.timer <= 0) {
      stopTimer();
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

async function handleTimeout() {
  if (state.turn !== multiplayerState.playerIndex) return;
  
  showGameMessage('Time Out!');
  vibrate([100, 50, 100]);
  
  if (state.drawStack > 0) {
    const drawn = drawCards(state.drawStack);
    state.players[multiplayerState.playerIndex].hand.push(...drawn);
    state.drawStack = 0;
    state.stackType = null;
  } else {
    const card = drawCards(1)[0];
    if (card) state.players[multiplayerState.playerIndex].hand.push(card);
  }
  
  renderHand();
  updateUI();
  await advanceTurn();
}

// ==================== UI UPDATES ====================
function updateUI() {
  const discardPile = document.getElementById('discard-pile');
  if (discardPile) {
    const topCard = state.discard[state.discard.length - 1];
    if (topCard) {
      discardPile.innerHTML = '';
      const cardEl = renderCard(topCard);
      state.discardRotation = (state.discardRotation || 0) + (Math.random() * 20 - 10);
      cardEl.style.transform = 'rotate(' + state.discardRotation + 'deg)';
      cardEl.style.animation = 'none';
      discardPile.appendChild(cardEl);
    }
  }
  
  const colorIndicator = document.getElementById('color-indicator');
  if (colorIndicator) {
    colorIndicator.className = 'color-indicator ' + state.activeColor;
  }
  
  const deckCount = document.getElementById('deck-count');
  if (deckCount) deckCount.textContent = state.deck.length;
  
  const directionIndicator = document.getElementById('direction-indicator');
  if (directionIndicator) {
    directionIndicator.classList.add('active');
    directionIndicator.classList.remove('clockwise', 'counter');
    directionIndicator.classList.add(state.direction === 1 ? 'clockwise' : 'counter');
  }
  
  const unoBtn = document.getElementById('uno-btn');
  const currentPlayer = state.players[state.turn];
  if (unoBtn && currentPlayer) {
    const isMyTurn = state.turn === multiplayerState.playerIndex;
    const shouldShow = isMyTurn && currentPlayer.hand.length === 2 && state.active && !state.saidUno.has(multiplayerState.playerIndex);
    unoBtn.classList.toggle('active', shouldShow);
  }
  
  updateTurnIndicator();
}

function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');
  const turnText = document.getElementById('turn-text');
  const dot = indicator ? indicator.querySelector('.dot') : null;
  
  if (!indicator) return;
  
  if (state.active && !state.isOver) {
    indicator.style.display = 'flex';
    const currentPlayer = state.players[state.turn];
    const isMyTurn = state.turn === multiplayerState.playerIndex;
    
    if (isMyTurn) {
      turnText.textContent = 'Your Turn';
      if (dot) dot.style.background = 'var(--uno-green)';
    } else {
      turnText.textContent = currentPlayer?.name + "'s Turn";
      if (dot) dot.style.background = getPlayerColor(state.turn);
    }
  } else {
    indicator.style.display = 'none';
  }
}

function updatePlayerZones() {
  state.players.forEach((player, idx) => {
    const zone = document.querySelector('.player-zone.player-' + getPositionClass(idx, state.players.length));
    if (!zone) return;
    
    const info = zone.querySelector('.player-info');
    const nameEl = zone.querySelector('.player-name');
    const countEl = zone.querySelector('.card-count');
    const avatar = zone.querySelector('.player-avatar');
    
    if (nameEl) nameEl.textContent = player.name;
    if (countEl) countEl.textContent = player.hand.length + ' cards';
    
    if (info) {
      info.classList.remove('active', 'warning');
      if (state.turn === idx) {
        info.classList.add('active');
        if (state.timer <= 3 && gameSettings.timer) {
          info.classList.add('warning');
        }
      }
    }
    
    // Update player timer
    let timerEl = info?.querySelector('.player-turn-timer');
    if (!timerEl && info) {
      timerEl = document.createElement('div');
      timerEl.className = 'player-turn-timer';
      info.appendChild(timerEl);
    }
    
    if (timerEl) {
      timerEl.classList.remove('show', 'warning', 'danger');
      if (state.turn === idx && state.active && !state.isOver) {
        timerEl.textContent = state.timer;
        timerEl.classList.add('show');
        if (state.timer <= 3) timerEl.classList.add('danger');
        else if (state.timer <= 5) timerEl.classList.add('warning');
      }
    }
    
    if (avatar) {
      avatar.style.background = getPlayerColor(idx);
      avatar.classList.remove('color-glow', 'red', 'blue', 'green', 'yellow');
      avatar.classList.add('color-glow', state.activeColor);
    }
    
    // UNO alert
    let unoAlert = zone.querySelector('.uno-alert');
    if (player.hand.length === 1) {
      if (!unoAlert) {
        unoAlert = document.createElement('div');
        unoAlert.className = 'uno-alert';
        unoAlert.textContent = 'UNO!';
        info.appendChild(unoAlert);
      }
    } else if (unoAlert) {
      unoAlert.remove();
    }
    
    // Bot/disconnected indicator
    if (player.isBot || !player.isConnected) {
      nameEl.innerHTML = player.name + ' <span class="bot-indicator">🤖</span>';
    }
    
    // Opponent cards
    if (idx !== multiplayerState.playerIndex) {
      const cardsContainer = zone.querySelector('.bot-cards-horizontal, .bot-cards-vertical');
      if (cardsContainer) {
        cardsContainer.innerHTML = '';
        const displayCount = Math.min(player.hand.length, 7);
        for (let i = 0; i < displayCount; i++) {
          cardsContainer.appendChild(renderCard(null, true));
        }
      }
    }
  });
}

// ==================== HAND RENDERING ====================
function renderHand() {
  const handContainer = document.getElementById('player-hand');
  if (!handContainer) return;
  handContainer.innerHTML = '';
  
  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;
  
  const isMyTurn = state.turn === multiplayerState.playerIndex;
  
  player.hand.forEach((card, idx) => {
    const el = renderCard(card);
    let isValid = false;
    
    if (isMyTurn && state.active && !player.isBot) {
      if (state.drawStack > 0 && gameSettings.stacking) {
        isValid = canStackCard(card);
      } else {
        isValid = checkValidPlay(card);
      }
    }
    
    if (isValid) {
      el.classList.add('playable');
    }
    
    el.draggable = true;
    
    el.addEventListener('dragstart', (e) => {
      if (!isValid) {
        e.preventDefault();
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
        return;
      }
      state.dragCard = idx;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      state.dragCard = null;
    });
    
    el.onclick = async function() {
      if (!state.active || state.turn !== multiplayerState.playerIndex || player.isBot) return;
      if (isValid) {
        await playCard(multiplayerState.playerIndex, idx);
      } else if (isMyTurn) {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
      }
    };
    
    handContainer.appendChild(el);
  });
}

// ==================== COLOR PICKER ====================
function showColorPicker3D() {
  const picker = document.getElementById('color-picker-3d');
  if (picker) {
    picker.classList.add('active');
    picker.querySelectorAll('.color-box-3d').forEach(box => {
      box.classList.remove('selected', 'fade-out');
    });
  }
}

function hideColorPicker3D() {
  const picker = document.getElementById('color-picker-3d');
  if (picker) picker.classList.remove('active');
}

async function selectWildColor(color) {
  state.activeColor = color;
  hideColorPicker3D();
  
  if (multiplayerState.gameRef) {
    await multiplayerState.gameRef.update({ activeColor: color });
  }
  
  await applyCardEffect(state.pendingWild, multiplayerState.playerIndex);
  state.pendingWild = null;
  await advanceTurn();
  
  playSound('wild');
  showActionFlash('wild');
}

// ==================== SORT HAND ====================
function sortHand(mode) {
  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;
  
  if (mode === 'color') {
    const colorOrder = { red: 1, blue: 2, green: 3, yellow: 4, black: 5 };
    player.hand.sort((a, b) => colorOrder[a.c] - colorOrder[b.c]);
  } else {
    const valueOrder = { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'S': 10, 'R': 11, '+2': 12, 'W': 13, '+4': 14 };
    player.hand.sort((a, b) => valueOrder[a.v] - valueOrder[b.v]);
  }
  
  renderHand();
  playSound('card');
}

// ==================== DRAW CARD ====================
async function handleDrawPile() {
  if (state.turn !== multiplayerState.playerIndex || !state.active) return;
  
  const player = state.players[multiplayerState.playerIndex];
  if (player.isBot) return;
  
  stopTimer();
  
  if (state.drawStack > 0 && gameSettings.stacking) {
    const canStack = player.hand.some(c => canStackCard(c));
    if (canStack) {
      showGameMessage("You have a card to stack!");
      startTimer();
      return;
    }
    
    const drawn = drawCards(state.drawStack);
    player.hand.push(...drawn);
    showGameMessage('You drew ' + state.drawStack + ' cards!');
    vibrate([50, 30, 50]);
    state.drawStack = 0;
    state.stackType = null;
    
    renderHand();
    updateUI();
    await advanceTurn();
    return;
  }
  
  const card = drawCards(1)[0];
  if (!card) {
    startTimer();
    return;
  }
  
  player.hand.push(card);
  renderHand();
  updateUI();
  
  const isPlayable = checkValidPlay(card);
  
  if (isPlayable) {
    showDrawnCardPopup(card, true);
  } else {
    showGameMessage("Cannot play this card");
    await sleep(500);
    await advanceTurn();
  }
}

function showDrawnCardPopup(card, canPlay) {
  const popup = document.getElementById('drawn-card-popup');
  const display = document.getElementById('drawn-card-display');
  const playBtn = document.getElementById('play-btn');
  
  if (popup && display) {
    display.innerHTML = '';
    display.appendChild(renderCard(card));
    
    if (playBtn) playBtn.style.display = canPlay ? 'block' : 'none';
    
    popup.classList.add('active');
    state.drawnCard = card;
    state.drawnCardPlayable = canPlay;
  }
}

function hideDrawnCardPopup() {
  const popup = document.getElementById('drawn-card-popup');
  if (popup) popup.classList.remove('active');
  state.drawnCard = null;
  state.drawnCardPlayable = false;
}

async function handleKeepCard() {
  hideDrawnCardPopup();
  await advanceTurn();
}

async function handlePlayDrawnCard() {
  if (!state.drawnCard || !state.drawnCardPlayable) return;
  
  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;
  
  const cardIndex = player.hand.length - 1;
  hideDrawnCardPopup();
  await playCard(multiplayerState.playerIndex, cardIndex);
}

// ==================== UNO BUTTON ====================
async function handleUnoButton() {
  if (state.turn !== multiplayerState.playerIndex || !state.active) return;
  
  const player = state.players[multiplayerState.playerIndex];
  if (!player || player.hand.length !== 2) return;
  
  state.saidUno.add(multiplayerState.playerIndex);
  playSound('uno');
  vibrate(100);
  showGameMessage('UNO!');
  
  await sendGameAction('uno', {});
}

// ==================== EMOTE SYSTEM ====================
function toggleEmotePanel(playerIndex) {
  const panel = document.getElementById('emote-panel');
  if (panel) panel.classList.toggle('active');
}

async function sendEmote(emoteKey) {
  const emote = EMOTES[emoteKey];
  if (!emote) return;
  
  showEmote(multiplayerState.playerIndex, emote);
  playSound('emote');
  
  await sendGameAction('emote', { emote: emote });
  
  const panel = document.getElementById('emote-panel');
  if (panel) panel.classList.remove('active');
}

function showEmote(playerIndex, emote) {
  const zone = document.querySelector('.player-zone.player-' + getPositionClass(playerIndex, state.players.length));
  if (!zone) return;
  
  let bubble = zone.querySelector('.emote-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'emote-bubble';
    zone.appendChild(bubble);
  }
  
  bubble.textContent = emote;
  bubble.classList.add('show');
  
  setTimeout(() => {
    bubble.classList.remove('show');
  }, 2500);
}

// ==================== EFFECTS ====================
function showActionFlash(type) {
  let overlay = document.getElementById('action-flash-overlay');
  if (overlay) {
    overlay.className = 'action-flash-overlay ' + type;
    void overlay.offsetWidth;
    overlay.classList.add('active');
    
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 500);
  }
}

function showSkipSymbol(playerIndex) {
  const zone = document.querySelector('.player-zone.player-' + getPositionClass(playerIndex, state.players.length));
  if (!zone) return;
  
  let skipSymbol = zone.querySelector('.skip-symbol');
  if (!skipSymbol) {
    skipSymbol = document.createElement('div');
    skipSymbol.className = 'skip-symbol';
    skipSymbol.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>`;
    zone.appendChild(skipSymbol);
  }
  
  skipSymbol.classList.add('show');
  
  setTimeout(() => {
    skipSymbol.classList.remove('show');
  }, 1200);
}

function showReverseSymbol() {
  let reverseSymbol = document.getElementById('reverse-symbol');
  if (!reverseSymbol) {
    reverseSymbol = document.createElement('div');
    reverseSymbol.id = 'reverse-symbol';
    reverseSymbol.className = 'reverse-symbol';
    reverseSymbol.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
    document.body.appendChild(reverseSymbol);
  }
  
  reverseSymbol.classList.remove('show');
  void reverseSymbol.offsetWidth;
  reverseSymbol.classList.add('show');
  
  setTimeout(() => {
    reverseSymbol.classList.remove('show');
  }, 800);
}

function createWildExplosion() {
  let container = document.getElementById('wild-explosion');
  if (!container) {
    container = document.createElement('div');
    container.id = 'wild-explosion';
    container.className = 'wild-explosion';
    document.body.appendChild(container);
  }
  
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B'];
  const particleCount = 30;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'wild-particle';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    const angle = (Math.PI * 2 * i) / particleCount;
    const distance = 100 + Math.random() * 100;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    
    particle.style.setProperty('--tx', tx + 'px');
    particle.style.setProperty('--ty', ty + 'px');
    
    container.appendChild(particle);
    
    setTimeout(() => particle.remove(), 800);
  }
}

// ==================== END GAME ====================
async function endMultiplayerGame(winnerIndex) {
  state.isOver = true;
  state.active = false;
  stopTimer();
  stopAfkTimer();
  
  const isWin = winnerIndex === multiplayerState.playerIndex;
  
  if (multiplayerState.lobbyRef) {
    await multiplayerState.lobbyRef.update({ status: 'finished' });
  }
  
  if (isWin) {
    createConfetti();
    playSound('win');
    vibrate([100, 50, 100, 50, 200]);
  } else {
    playSound('lose');
    vibrate([200, 100, 200]);
  }
  
  showGameResults(winnerIndex, isWin);
}

function showGameResults(winnerIndex, isWin) {
  const modal = document.getElementById('game-over');
  if (!modal) return;
  
  modal.classList.add('active');
  
  const resultIcon = document.getElementById('result-icon');
  const winnerText = document.getElementById('winner-text');
  const resultsList = document.getElementById('results-container');
  const xpValue = document.getElementById('xp-value');
  
  if (resultIcon) {
    resultIcon.className = 'result-icon ' + (isWin ? 'win' : 'lose');
    resultIcon.innerHTML = isWin 
      ? '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>';
  }
  
  if (winnerText) {
    winnerText.textContent = isWin ? 'YOU WIN!' : 'YOU LOSE';
  }
  
  if (resultsList) {
    const results = state.players.map((p, idx) => ({
      name: p.name,
      cards: p.hand.length,
      isWinner: idx === winnerIndex
    })).sort((a, b) => a.cards - b.cards);
    
    resultsList.innerHTML = results.map((r, i) => `
      <div class="result-item ${r.isWinner ? 'winner' : ''}">
        <div class="result-rank">${i + 1}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-cards">${r.cards} cards</div>
      </div>
    `).join('');
  }
  
  if (xpValue) {
    const xp = isWin ? 250 : 50;
    xpValue.textContent = '+' + xp;
  }
}

function createConfetti() {
  let container = document.getElementById('confetti-container');
  if (!container) return;
  
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];
  
  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 1 + 's';
    confetti.style.width = (6 + Math.random() * 10) + 'px';
    confetti.style.height = confetti.style.width;
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    container.appendChild(confetti);
  }
  
  setTimeout(() => container.innerHTML = '', 4000);
}

async function rematch() {
  const modal = document.getElementById('game-over');
  if (modal) modal.classList.remove('active');
  
  if (multiplayerState.isHost) {
    await multiplayerState.lobbyRef?.update({ status: 'waiting', game: null });
  }
  
  showScreen('lobby-room');
  updateLobbyUI();
}

async function backToLobby() {
  const modal = document.getElementById('game-over');
  if (modal) modal.classList.remove('active');
  
  showScreen('lobby-room');
  updateLobbyUI();
}

function backToMenu() {
  const modal = document.getElementById('game-over');
  if (modal) modal.classList.remove('active');
  
  cleanupLobby();
  showScreen('menu-screen');
}

// ==================== SETTINGS & LEADERBOARD ====================
function showSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('active');
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('active');
}

function toggleSetting(setting) {
  gameSettings[setting] = !gameSettings[setting];
  const toggle = document.getElementById('toggle-' + setting);
  if (toggle) toggle.classList.toggle('active', gameSettings[setting]);
}

function showLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) {
    modal.classList.add('active');
    // Load dummy leaderboard for now
    const list = document.getElementById('leaderboard-list');
    if (list) {
      list.innerHTML = `
        <div class="leaderboard-item current-player">
          <div class="leaderboard-rank">1</div>
          <div class="leaderboard-name">You</div>
          <div class="leaderboard-score">2,450</div>
        </div>
        <div class="leaderboard-item">
          <div class="leaderboard-rank">2</div>
          <div class="leaderboard-name">Bot Alex</div>
          <div class="leaderboard-score">2,100</div>
        </div>
      `;
    }
  }
}

function closeLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.remove('active');
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  runLoadingScreen();
  
  // Draw pile
  document.getElementById('draw-pile')?.addEventListener('click', handleDrawPile);
  
  // UNO button
  document.getElementById('uno-btn')?.addEventListener('click', handleUnoButton);
  
  // Color picker
  document.querySelectorAll('.color-box-3d').forEach(box => {
    box.addEventListener('click', () => selectWildColor(box.dataset.color));
  });
  
  // Drawn Card Popup Buttons
  document.getElementById('keep-btn')?.addEventListener('click', handleKeepCard);
  document.getElementById('play-btn')?.addEventListener('click', handlePlayDrawnCard);
  
  // Drag and drop
  const discardPile = document.getElementById('discard-pile');
  if (discardPile) {
    discardPile.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (state.dragCard !== null) {
        discardPile.classList.add('drop-target');
      }
    });
    
    discardPile.addEventListener('dragleave', () => {
      discardPile.classList.remove('drop-target');
    });
    
    discardPile.addEventListener('drop', async (e) => {
      e.preventDefault();
      discardPile.classList.remove('drop-target');
      
      if (state.dragCard !== null && state.turn === multiplayerState.playerIndex && state.active) {
        const player = state.players[multiplayerState.playerIndex];
        const card = player.hand[state.dragCard];
        if (checkValidPlay(card)) {
          await playCard(multiplayerState.playerIndex, state.dragCard);
        }
      }
      state.dragCard = null;
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (state.isOver || !state.active) return;
    if (e.key === 'u' || e.key === 'U') handleUnoButton();
    if (e.key === 'd' || e.key === 'D') handleDrawPile();
    if (e.key === 'Escape') {
      hideColorPicker3D();
      hideDrawnCardPopup();
    }
    if (e.key >= '1' && e.key <= '6') {
      const emoteKeys = ['angry', 'laugh', 'cry', 'fire', 'cool', 'think'];
      sendEmote(emoteKeys[parseInt(e.key) - 1]);
    }
  });
  
  // Chat input
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (multiplayerState.playerPresenceRef) {
      multiplayerState.playerPresenceRef.update({
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });
    }
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  cleanupLobby();
});
