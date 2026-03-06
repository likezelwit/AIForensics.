// ==================== FIREBASE CONFIG ====================
/*
 * Firebase Database Rules - Add this to your Firebase Console:
 * 
 * {
 *   "rules": {
 *     "lobbies": {
 *       ".indexOn": ["isPrivate", "status", "createdAt"]
 *     },
 *     "presence": {
 *       ".read": true,
 *       ".write": true
 *     }
 *   }
 * }
 */

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
  let toast = document.getElementById('toast-message');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-message';
    toast.className = 'toast-message';
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

// ==================== MENU FUNCTIONS ====================
function showMultiplayerOptions() {
  // Corresponds to HTML onclick="showMultiplayerOptions()"
  let modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.add('active');
}

function closeMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.remove('active');
}

function showSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('active');
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('active');
}

function toggleSetting(settingKey) {
  gameSettings[settingKey] = !gameSettings[settingKey];
  const toggleBtn = document.getElementById('toggle-' + settingKey);
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', gameSettings[settingKey]);
  }
}

function showLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.add('active');
  // Optionally populate leaderboard data here
  populateLeaderboard();
}

function closeLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.remove('active');
}

function populateLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if(!list) return;
    // Dummy data for now
    list.innerHTML = `
        <div class="leaderboard-item current-player">
            <div class="leaderboard-rank gold">1</div>
            <div class="leaderboard-name">You</div>
            <div class="leaderboard-score">12,450</div>
        </div>
        <div class="leaderboard-item">
            <div class="leaderboard-rank silver">2</div>
            <div class="leaderboard-name">Bot Alex</div>
            <div class="leaderboard-score">11,200</div>
        </div>
         <div class="leaderboard-item">
            <div class="leaderboard-rank bronze">3</div>
            <div class="leaderboard-name">Bot Blake</div>
            <div class="leaderboard-score">9,800</div>
        </div>
    `;
}

// ==================== CREATE LOBBY ====================
function showCreateLobby() {
  closeMultiplayerOptions();
  
  let modal = document.getElementById('create-lobby-modal');
  if (!modal) {
    // Modal creation logic if not present in HTML (though your HTML has it)
    // In this case, we assume HTML has the modals defined based on your provided code.
    // We just need to show it.
    modal = document.getElementById('create-lobby-modal');
  }
  if (modal) modal.classList.add('active');
  
  // Pre-fill name
  const nameInput = document.getElementById('host-name');
  if(nameInput && !nameInput.value) nameInput.value = multiplayerState.playerName;
}

function closeCreateLobby() {
  const modal = document.getElementById('create-lobby-modal');
  if (modal) modal.classList.remove('active');
}

function togglePrivate() {
    const toggle = document.getElementById('private-toggle');
    if(toggle) toggle.classList.toggle('active');
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
  
  let modal = document.getElementById('join-lobby-modal');
  if (modal) modal.classList.add('active');
  
  const nameInput = document.getElementById('join-name');
  if(nameInput && !nameInput.value) nameInput.value = multiplayerState.playerName;
  
  refreshPublicLobbies();
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
        <div class="lobby-code">${lobby.id}</div>
        <div class="lobby-info">
          <div class="lobby-mode">${lobby.gameMode || 'Classic'}</div>
          <div class="lobby-players">${lobby.playerCount}/${lobby.maxPlayers} players</div>
        </div>
        <div class="lobby-host">by ${lobby.hostName}</div>
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
async function startQuickMatch() {
  closeMultiplayerOptions();
  
  showScreen('quick-match-screen');
  // Logic for quick match UI handling if needed, simplified here
  // ... (Logic from your previous file can be pasted here if complex, 
  // but for now using simplified flow)
  multiplayerState.playerName = 'Player_' + Math.random().toString(36).substr(2, 4);
  multiplayerState.playerId = 'player_' + Date.now();
  multiplayerState.isQuickMatch = true;

  // Try to find match or create
  try {
    const snapshot = await database.ref('lobbies').orderByChild('isPrivate').equalTo(false).once('value');
    let found = null;
    snapshot.forEach(child => {
        const d = child.val();
        if(d.status === 'waiting' && d.playerOrder && d.playerOrder.length < d.maxPlayers) found = {id: child.key, ...d};
    });

    if(found) {
        // join
        showScreen('menu-screen'); // go back to hide quick match screen if needed or handle transition
        await joinLobbyById(found.id);
    } else {
        // create
        multiplayerState.isHost = true;
        const roomCode = generateRoomCode();
        multiplayerState.lobbyId = roomCode;
        // ... create lobby logic similar to createLobby()
        // simplified:
        const lobbyRef = database.ref('lobbies/' + roomCode);
        multiplayerState.lobbyRef = lobbyRef;
        const lobbyData = {
            hostId: multiplayerState.playerId,
            hostName: multiplayerState.playerName,
            gameMode: 'classic',
            maxPlayers: 4,
            isPrivate: false,
            status: 'waiting',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            players: { [multiplayerState.playerId]: { name: multiplayerState.playerName, isHost: true, isReady: true, isBot: false, isConnected: true } },
            playerOrder: [multiplayerState.playerId]
        };
        await lobbyRef.set(lobbyData);
        multiplayerState.playerIndex = 0;
        showScreen('lobby-room');
        updateLobbyUI();
        setupLobbyListeners();
        setupPresence();
        showToast('Created lobby: ' + roomCode);
    }
  } catch(e) {
      console.error(e);
      showToast('Error finding match');
      showScreen('menu-screen');
  }
}

function cancelQuickMatch() {
  showScreen('menu-screen');
}

// ==================== LOBBY UI ====================
function updateLobbyUI() {
  const codeEl = document.getElementById('display-room-code');
  if (codeEl) codeEl.textContent = multiplayerState.lobbyId;
  
  const miniCode = document.getElementById('room-code-mini');
  if (miniCode) miniCode.textContent = multiplayerState.lobbyId;
}

function copyRoomCode() {
    navigator.clipboard.writeText(multiplayerState.lobbyId).then(() => {
        showToast('Room code copied!');
        playSound('card');
    }).catch(() => showToast('Failed to copy'));
}

function pasteCode() {
    navigator.clipboard.readText().then(text => {
        const input = document.getElementById('room-code-input');
        if(input) input.value = text;
    }).catch(err => console.log('Failed to read clipboard'));
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
      const statusClass = player.isReady ? 'ready' : 'not-ready';
      
      html += `
        <div class="lobby-player-slot ${statusClass} ${isYou ? 'you' : ''}">
          <div class="player-avatar-large" style="background: ${getPlayerColor(i)}">
            ${player.isBot ? '🤖' : '👤'}
          </div>
          <div class="player-slot-name">${player.name}${isYou ? ' (You)' : ''}</div>
          ${player.isHost ? '<div class="host-badge">HOST</div>' : ''}
          <div class="player-status ${player.isReady ? 'ready' : ''}">
            ${player.isReady ? '✓ Ready' : 'Waiting...'}
          </div>
          ${isYou || !multiplayerState.isHost ? '' : `<button class="kick-btn" onclick="kickPlayer('${playerId}')">✕</button>`}
        </div>
      `;
    } else {
      html += `
        <div class="lobby-player-slot empty">
          <div class="player-avatar-large empty">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </div>
          <div class="player-slot-name">Waiting...</div>
          <div class="player-status">Empty Slot</div>
        </div>
      `;
    }
  }
  
  grid.innerHTML = html;
}

function setupLobbyListeners() {
  if (!multiplayerState.lobbyRef) return;
  
  multiplayerState.lobbyRef.child('players').on('value', (snapshot) => {
    const players = snapshot.val();
    if (!players) return;
    multiplayerState.lobbyRef.child('playerOrder').once('value', (orderSnap) => {
      const playerOrder = orderSnap.val() || Object.keys(players);
      renderLobbyPlayers(players, playerOrder);
      updateStartButton(players, playerOrder);
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
}

function updateStartButton(players, playerOrder) {
  const startBtn = document.getElementById('start-game-btn');
  const readyBtn = document.getElementById('ready-btn'); // Note: HTML might need a Ready button or use Start button
  
  if (!startBtn) return;
  
  const playerCount = playerOrder ? playerOrder.length : Object.keys(players).length;
  const allReady = Object.values(players).every(p => p.isReady || p.isBot);
  const minPlayers = 2; // Or dynamic based on mode
  
  const canStart = multiplayerState.isHost && playerCount >= minPlayers && allReady;
  
  startBtn.disabled = !canStart;
  
  // Update lobby status text
  const statusEl = document.getElementById('lobby-status');
  if(statusEl) statusEl.textContent = canStart ? 'Ready to start!' : 'Waiting for players...';
}

async function toggleReady() {
  if (!multiplayerState.lobbyRef || !multiplayerState.playerId) return;
  
  const playerRef = multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId);
  const snapshot = await playerRef.once('value');
  const playerData = snapshot.val();
  
  if (playerData) {
    await playerRef.update({ isReady: !playerData.isReady });
    playSound('card');
  }
}

async function kickPlayer(playerId) {
  if (!multiplayerState.isHost || !multiplayerState.lobbyRef) return;
  
  const snapshot = await multiplayerState.lobbyRef.once('value');
  const lobbyData = snapshot.val();
  
  if (!lobbyData) return;
  
  const newOrder = (lobbyData.playerOrder || []).filter(id => id !== playerId);
  
  const updates = {};
  updates['/players/' + playerId] = null;
  updates['/playerOrder'] = newOrder;
  
  await multiplayerState.lobbyRef.update(updates);
  playSound('card');
  showToast('Player kicked');
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

// ==================== PRESENCE ====================
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
}

// ==================== GAME LOGIC ====================
function startGameFromLobby() {
  showScreen('game-app');
  initAudio();
  
  multiplayerState.gameRef = multiplayerState.lobbyRef.child('game');
  setupGameListeners();
}

function setupGameListeners() {
  if (!multiplayerState.gameRef) return;
  
  multiplayerState.gameRef.on('value', (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;
    
    syncGameState(gameData);
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
    // startTimer();
  }
}

async function startMultiplayerGame() {
    // Logic for host to initialize game in Firebase
    if(!multiplayerState.isHost) return;
    
    const deck = createDeck();
    const startCard = deck.pop();
    
    const playerHands = {};
    const snapshot = await multiplayerState.lobbyRef.once('value');
    const lobbyData = snapshot.val();
    
    lobbyData.playerOrder.forEach(pid => {
        playerHands[pid] = [];
        for(let i=0; i<7; i++) playerHands[pid].push(deck.pop());
    });

    const gameData = {
        deck: deck,
        discard: [startCard],
        activeColor: startCard.c,
        turn: 0,
        direction: 1,
        playerOrder: lobbyData.playerOrder,
        playerHands: playerHands,
        playerData: lobbyData.players,
        status: 'playing'
    };

    await multiplayerState.lobbyRef.update({ status: 'playing' });
    await multiplayerState.gameRef.set(gameData);
}

function checkValidPlay(card) {
  const top = state.discard[state.discard.length - 1];
  if (!top) return true;
  if (card.c === 'black') return true;
  if (card.c === state.activeColor) return true;
  if (card.v === top.v) return true;
  return false;
}

function renderHand() {
    const container = document.getElementById('player-hand');
    if(!container) return;
    container.innerHTML = '';
    
    const myPlayer = state.players[multiplayerState.playerIndex];
    if(!myPlayer) return;
    
    myPlayer.hand.forEach((card, idx) => {
        const el = renderCard(card);
        const isValid = checkValidPlay(card);
        
        if(state.turn === multiplayerState.playerIndex && state.active && isValid) {
            el.classList.add('playable');
            el.onclick = () => playCardLocal(idx);
        }
        container.appendChild(el);
    });
}

async function playCardLocal(index) {
    // Send play action to Firebase
    // Simplified for brevity
    console.log("Playing card", index);
}

function updateUI() {
    const discardPile = document.getElementById('discard-pile');
    if (discardPile) {
        const top = state.discard[state.discard.length - 1];
        if(top) {
            discardPile.innerHTML = '';
            discardPile.appendChild(renderCard(top));
        }
    }
    
    const deckCount = document.getElementById('deck-count');
    if(deckCount) deckCount.textContent = state.deck.length;
    
    updateTurnIndicator();
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    const text = document.getElementById('turn-text');
    if(!indicator) return;
    
    if(state.active) {
        indicator.style.display = 'flex';
        if(state.turn === multiplayerState.playerIndex) {
            text.textContent = 'Your Turn';
        } else {
            text.textContent = (state.players[state.turn]?.name || 'Player') + "'s Turn";
        }
    } else {
        indicator.style.display = 'none';
    }
}

function updatePlayerZones() {
    // Update UI for all players
    state.players.forEach((player, idx) => {
        const zone = document.querySelector(`.player-zone.player-${getPositionClass(idx, state.players.length)}`);
        if (!zone) return;
        
        const nameEl = zone.querySelector('.player-name');
        const countEl = zone.querySelector('.card-count');
        
        if (nameEl) nameEl.textContent = player.name;
        if (countEl) countEl.textContent = player.hand.length + ' cards';
        
        // Highlight current turn
        const info = zone.querySelector('.player-info');
        if(info) {
            info.classList.toggle('active', state.turn === idx);
        }
    });
}

function sortHand(type) {
    // Client side sorting logic
    console.log("Sorting by: ", type);
}

function toggleEmotePanel(idx) {
    const panel = document.getElementById('emote-panel');
    if(panel) panel.classList.toggle('active');
}

function sendEmote(emoteKey) {
    console.log("Sending emote: ", emoteKey);
    const panel = document.getElementById('emote-panel');
    if(panel) panel.classList.remove('active');
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  runLoadingScreen();
  
  // Setup existing UI listeners if needed
  const codeInput = document.getElementById('room-code-input');
  if (codeInput) {
    codeInput.addEventListener('input', (e) => {
      let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (value.length > 4 && !value.includes('-')) {
        value = value.slice(0, 3) + '-' + value.slice(3);
      }
      e.target.value = value;
    });
  }

  // Handle Drag and Drop for cards if needed
  const discardPile = document.getElementById('discard-pile');
  if(discardPile) {
      discardPile.addEventListener('dragover', e => e.preventDefault());
      discardPile.addEventListener('drop', e => {
          e.preventDefault();
          console.log("Card dropped");
      });
  }
});
