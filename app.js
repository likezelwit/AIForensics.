const COLORS = ['red', 'blue', 'green', 'yellow'];
const SPECIAL_VALUES = ['S', 'R', '+2'];
const WILD_VALUES = ['W', '+4'];
const BOT_NAMES = ['Alex', 'Blake', 'Casey', 'Drew'];
const BOT_PERSONALITIES = ['aggressive', 'defensive', 'balanced', 'chaotic'];
const TURN_TIME = 10;
const GAME_TIME = 180;
const EMOTES = {
  draw: ['😤', '😫', '😢'],
  skip: ['😵', '😤', '🙄'],
  reverse: ['🔄', '🤔', '😲'],
  plus4: ['😱', '😡', '🤬'],
  win: ['🎉', '😎', '🏆'],
  lose: ['😢', '😞', '💔'],
  uno: ['Uno!', '😱', '👀']
};

// Game Settings
const gameSettings = {
  stacking: true,
  jumpIn: false,
  timer: true,
  sound: true,
  botDifficulty: 'easy'
};

// Game State
let gameMode = 'solo';
let matchmakingState = {
  found: [true, false, false, false],
  names: ['You', '', '', '']
};

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
  teams: [],
  drawStack: 0,
  stackType: null,
  timer: TURN_TIME,
  timerInterval: null,
  gameTime: GAME_TIME,
  gameTimerInterval: null,
  discardRotation: 0,
  sortMode: null,
  dragCard: null,
  comboCount: 0,
  lastPlayTime: 0
};

// Audio Context
let audioCtx = null;

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
      card: { type: 'triangle', freq: [700, 350], dur: 0.08, vol: 0.06 },
      win: { type: 'sine', freq: [523, 659, 784, 1047], dur: 0.6, vol: 0.07 },
      lose: { type: 'sawtooth', freq: [200, 100], dur: 0.4, vol: 0.05 },
      draw: { type: 'sine', freq: [450, 380], dur: 0.06, vol: 0.04 },
      tick: { type: 'sine', freq: [800, 800], dur: 0.05, vol: 0.03 },
      deal: { type: 'triangle', freq: [550, 650], dur: 0.07, vol: 0.04 },
      skip: { type: 'square', freq: [300, 400, 300], dur: 0.3, vol: 0.05 },
      reverse: { type: 'sine', freq: [400, 500, 400], dur: 0.25, vol: 0.05 },
      wild: { type: 'sine', freq: [300, 450, 600], dur: 0.4, vol: 0.06 },
      combo: { type: 'sine', freq: [600, 800, 1000], dur: 0.2, vol: 0.05 },
      uno: { type: 'sine', freq: [523, 659, 784], dur: 0.5, vol: 0.07 }
    };
    
    const s = sounds[type];
    if (!s) return;

    osc.type = s.type;
    
    if (Array.isArray(s.freq) && s.freq.length > 1) {
      s.freq.forEach((f, i) => {
        setTimeout(() => {
          if (i === 0) {
            osc.frequency.setValueAtTime(f, t);
          } else {
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, f), t + (s.dur * i / s.freq.length));
          }
        }, 0);
      });
    } else {
      osc.frequency.setValueAtTime(Array.isArray(s.freq) ? s.freq[0] : s.freq, t);
    }
    
    g.gain.setValueAtTime(s.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + s.dur);
    
    osc.start(t);
    osc.stop(t + s.dur);
  } catch (e) {
    // Silently fail
  }
}

// Haptic Feedback
function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// Particles
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  
  const colors = ['#ff4757', '#3742fa', '#2ed573', '#ffa502', '#a55eea'];
  
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = 4 + Math.random() * 10;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = (Math.random() * 100) + '%';
    particle.style.top = (Math.random() * 100) + '%';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.animationDelay = (Math.random() * 15) + 's';
    particle.style.animationDuration = (20 + Math.random() * 15) + 's';
    container.appendChild(particle);
  }
}

// Loading Screen
async function runLoadingScreen() {
  const loadingBar = document.getElementById('loading-bar');
  const loadingText = document.getElementById('loading-text');
  const loadingScreen = document.getElementById('loading-screen');
  
  const steps = [
    { progress: 20, text: "Loading assets..." },
    { progress: 45, text: "Preparing game..." },
    { progress: 70, text: "Shuffling deck..." },
    { progress: 90, text: "Almost ready..." },
    { progress: 100, text: "Ready!" }
  ];
  
  for (const step of steps) {
    if (loadingBar) loadingBar.style.width = step.progress + '%';
    if (loadingText) loadingText.textContent = step.text;
    await new Promise(r => setTimeout(r, 350));
  }
  
  await new Promise(r => setTimeout(r, 400));
  
  if (loadingScreen) loadingScreen.classList.add('hidden');
  showScreen('menu-screen');
}

// Utilities
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

function getPlayerColor(idx) {
  const colors = ['#ff4757', '#3742fa', '#2ed573', '#ffa502', '#a55eea'];
  return colors[idx % colors.length];
}

function getRandomEmote(category) {
  const emotes = EMOTES[category] || ['😊'];
  return emotes[Math.floor(Math.random() * emotes.length)];
}

// Navigation
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

// Game Message
function showGameMessage(text, duration = 1200) {
  const msgEl = document.getElementById('game-message');
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.display = 'block';
  setTimeout(() => { msgEl.style.display = 'none'; }, duration);
}

// Show Emote
function showEmote(playerIndex, emote) {
  const zone = document.querySelector('.player-zone.' + getPositionClass(playerIndex));
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
  }, 2000);
}

function getPositionClass(idx) {
  const count = state.players.length;
  if (count === 2) return idx === 0 ? 'bottom' : 'top';
  if (count === 3) return ['bottom', 'right', 'left'][idx];
  return ['bottom', 'right', 'top', 'left'][idx];
}

// Deck Creation
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

// ==========================================
// CARD RENDERING (FIXED WITH SVG)
// ==========================================
function renderCard(card, isBack = false) {
  const el = document.createElement('div');
  el.className = 'uno-card';

  // --- 1. RENDER Back of Card ---
  if (isBack) {
    el.classList.add('card-back');
    // Using the SVG structure from your HTML for the back
    el.innerHTML = `
      <svg width="240" height="360" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
         <defs>
          <linearGradient id="unoRedLocal" x1="0%" y1="0%" x2="100%" y2="100%">
           <stop offset="0%" stop-color="#FF1744"/>
           <stop offset="100%" stop-color="#D50000"/>
          </linearGradient>
          <linearGradient id="unoYellowLocal" x1="0%" y1="0%" x2="0%" y2="100%">
           <stop offset="0%" stop-color="#FFEB3B"/>
           <stop offset="100%" stop-color="#FBC02D"/>
          </linearGradient>
         </defs>
         <g>
          <rect width="240" height="360" rx="18" fill="#1a1a1a"/>
          <rect x="10" y="10" width="220" height="340" rx="12" fill="none" stroke="#ffffff" stroke-width="8"/>
          <ellipse cx="118.78647" cy="183.36061" rx="88" ry="156.33998" fill="url(#unoRedLocal)" stroke="null" transform="rotate(27 118.786 183.361)"/>
          <text x="125" y="195" font-family="Arial Black, sans-serif" font-size="75" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" letter-spacing="2" transform="rotate(-16.0628 125 184.453)">UNO</text>
          <text transform="rotate(-15.8894 120 179.453)" x="120" y="190" font-family="Arial Black, sans-serif" font-size="75" font-weight="900" fill="url(#unoYellowLocal)" stroke="#000000" stroke-width="2" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">UNO</text>
         </g>
        </svg>`;
    return el;
  }

  // --- 2. Render Front of Card ---
  
  // Determine Fill Color (uses gradients defined in HTML head)
  let fill = '';
  let isWild = false;
  
  if (card.c === 'red') fill = 'url(#unoRed)';
  else if (card.c === 'blue') fill = 'url(#unoBlue)';
  else if (card.c === 'green') fill = 'url(#unoGreen)';
  else if (card.c === 'yellow') fill = 'url(#unoYellow)';
  else {
    fill = '#1a1a1a'; // Wild card background
    isWild = true;
  }

  // Prepare Content Variables
  let centerContent = '';
  let cornerValue = card.v;
  let centerFontSize = 180;

  // Logic for specific card types
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
    centerContent = ''; // Wild visuals handled by pattern
  } else if (card.v === '+4') {
    cornerValue = '+4';
    // Special skew transform for +4
    centerContent = `<g transform="skewX(-10)">
        <text stroke-width="10" stroke="#000000" dominant-baseline="middle" text-anchor="middle" fill="#000000" font-weight="900" font-size="100" font-family="Arial Black, sans-serif" y="186" x="152.41306">+4</text>
        <text dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-weight="900" font-size="100" font-family="Arial Black, sans-serif" y="179" x="145.41306">+4</text>
      </g>`;
  } else {
    // Standard Numbers 0-9
    centerContent = `<text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#000000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${card.v}</text>
                      <text y="196" font-family="Arial Black, sans-serif" font-size="${centerFontSize}" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" x="120">${card.v}</text>`;
  }

  // Wild Card Pattern (Multi-color ellipse)
  let wildPattern = '';
  if (isWild) {
    wildPattern = `
      <g transform="rotate(-50 120 180)">
       <path fill="#0055aa" d="m120,180l0,-85a145,85 0 0 1 145,85l-145,0z"/>
       <path fill="#2d801a" d="m120,180l145,0a145,85 0 0 1 -145,85l0,-85z"/>
       <path fill="#ffcc00" d="m120,180l0,85a145,85 0 0 1 -145,-85l145,0z"/>
       <path fill="#d50000" d="m120,180l-145,0a145,85 0 0 1 145,-85l0,85z"/>
       <ellipse stroke-width="4" stroke="#ffffff" fill="none" ry="85" rx="145" cy="180" cx="120"/>
      </g>`;
  }

  // Center Ellipse (White ring) - Only for colored cards
  let centerEllipse = '';
  if (!isWild) {
    centerEllipse = `<ellipse transform="rotate(-60.409 117.875 181.408)" stroke="#ffffff" cx="117.87508" cy="181.40815" rx="159.19945" ry="82.07582" fill="none" stroke-width="6"/>`;
  }

  // Construct Final SVG String
  el.innerHTML = `
    <svg width="240" height="360" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
     <g>
      <rect x="0" y="0" width="240" height="360" rx="25" ry="25" fill="${fill}"/>
      <rect x="10" y="10" width="220" height="340" rx="20" ry="20" fill="none" stroke="#ffffff" stroke-width="8"/>
      ${centerEllipse}
      ${wildPattern}
      ${centerContent}
      <!-- Corner Top Left -->
      <g>
       <text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#000000" text-anchor="middle" x="44.67969" y="61">${cornerValue}</text>
       <text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#ffffff" text-anchor="middle" y="58" x="41.67969">${cornerValue}</text>
      </g>
      <!-- Corner Bottom Right (Rotated) -->
      <g transform="rotate(180 162 238)">
       <text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#000000" text-anchor="middle" x="45" y="61">${cornerValue}</text>
       <text font-family="Arial Black, sans-serif" font-size="50" font-weight="900" fill="#ffffff" text-anchor="middle" y="58" x="42">${cornerValue}</text>
      </g>
     </g>
    </svg>`;

  return el;
}

// UI Rendering
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
    
    document.querySelectorAll('.player-avatar').forEach((avatar, idx) => {
      avatar.classList.remove('color-glow', 'red', 'blue', 'green', 'yellow');
      if (idx < state.players.length) {
        avatar.classList.add('color-glow', state.activeColor);
      }
    });
  }
  
  const deckCount = document.getElementById('deck-count');
  if (deckCount) deckCount.textContent = state.deck.length;
  
  const directionArc = document.getElementById('direction-arc');
  if (directionArc) {
    directionArc.classList.remove('clockwise', 'counter');
    directionArc.classList.add(state.direction === 1 ? 'clockwise' : 'counter');
  }
  
  const unoBtn = document.getElementById('uno-btn');
  const currentPlayer = state.players[state.turn];
  if (unoBtn && currentPlayer) {
    if (state.turn === 0 && currentPlayer.hand.length === 2 && state.active && !state.saidUno.has(0)) {
      unoBtn.classList.add('active');
    } else {
      unoBtn.classList.remove('active');
    }
  }
  
  updateStackCounter();
  updateTurnIndicator();
  updateValidCardsIndicator();
}

function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');
  const turnText = document.getElementById('turn-text');
  const dot = indicator ? indicator.querySelector('.dot') : null;
  const playerTimer = document.getElementById('player-turn-timer');
  
  if (!indicator) return;
  
  if (state.active && !state.isOver) {
    indicator.style.display = 'flex';
    const currentPlayer = state.players[state.turn];
    if (state.turn === 0) {
      turnText.textContent = 'Your Turn';
      if (dot) dot.style.background = 'var(--uno-green)';
    } else {
      turnText.textContent = currentPlayer?.name + "'s Turn";
      if (dot) dot.style.background = getPlayerColor(state.turn);
    }
    
    if (playerTimer) {
      playerTimer.textContent = state.timer + 's';
      playerTimer.classList.remove('warning', 'danger');
      if (state.timer <= 3) playerTimer.classList.add('danger');
      else if (state.timer <= 5) playerTimer.classList.add('warning');
    }
    
    document.querySelectorAll('.player-info').forEach((info, idx) => {
      info.classList.remove('warning');
      if (idx === state.turn && state.timer <= 3) {
        info.classList.add('warning');
      }
    });
  } else {
    indicator.style.display = 'none';
  }
}

function updateStackCounter() {
  const centerArea = document.getElementById('center-area');
  if (!centerArea) return;
  
  let stackEl = centerArea.querySelector('.stack-counter');
  
  if (state.drawStack > 0) {
    if (!stackEl) {
      stackEl = document.createElement('div');
      stackEl.className = 'stack-counter';
      centerArea.appendChild(stackEl);
    }
    stackEl.innerHTML = '<span>+' + state.drawStack + '</span>';
  } else if (stackEl) {
    stackEl.remove();
  }
}

// Valid Cards Indicator
function updateValidCardsIndicator() {
  const indicator = document.getElementById('valid-cards-indicator');
  if (!indicator) return;
  
  if (state.turn === 0 && state.active && !state.isOver) {
    const player = state.players[0];
    if (!player) return;
    
    let validCount = 0;
    
    if (state.drawStack > 0 && gameSettings.stacking) {
      validCount = player.hand.filter(c => canStackCard(c)).length;
      indicator.textContent = validCount + ' stackable card' + (validCount !== 1 ? 's' : '');
    } else {
      validCount = player.hand.filter(c => checkValidPlay(c)).length;
      indicator.textContent = validCount + ' playable card' + (validCount !== 1 ? 's' : '');
    }
    
    indicator.classList.add('visible');
  } else {
    indicator.classList.remove('visible');
  }
}

// Sort Hand
function sortHand(mode) {
  if (state.sortMode === mode) {
    state.sortMode = null;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  } else {
    state.sortMode = mode;
    document.getElementById('sort-color')?.classList.toggle('active', mode === 'color');
    document.getElementById('sort-value')?.classList.toggle('active', mode === 'value');
  }
  renderHand();
}

function getSortedHand() {
  const player = state.players[0];
  if (!player) return [];
  
  let hand = [...player.hand];
  
  if (state.sortMode === 'color') {
    const colorOrder = { red: 0, blue: 1, green: 2, yellow: 3, black: 4 };
    hand.sort((a, b) => {
      if (colorOrder[a.c] !== colorOrder[b.c]) {
        return colorOrder[a.c] - colorOrder[b.c];
      }
      return a.v.localeCompare(b.v);
    });
  } else if (state.sortMode === 'value') {
    hand.sort((a, b) => {
      const aVal = parseInt(a.v) || (SPECIAL_VALUES.includes(a.v) ? 20 : (WILD_VALUES.includes(a.v) ? 30 : 0));
      const bVal = parseInt(b.v) || (SPECIAL_VALUES.includes(b.v) ? 20 : (WILD_VALUES.includes(b.v) ? 30 : 0));
      return aVal - bVal;
    });
  }
  
  return hand;
}

function renderHand() {
  const handContainer = document.getElementById('player-hand');
  if (!handContainer) return;
  handContainer.innerHTML = '';
  const player = state.players[0];
  if (!player) return;
  
  const hand = state.sortMode ? getSortedHand() : player.hand;
  const originalIndices = state.sortMode ? hand.map(card => player.hand.indexOf(card)) : null;
  
  const needsStacking = hand.length >= 15;
  if (needsStacking) {
    handContainer.classList.add('stacked');
  } else {
    handContainer.classList.remove('stacked');
  }
  
  const isMyTurn = state.turn === 0;
  
  hand.forEach((card, idx) => {
    const originalIdx = originalIndices ? originalIndices[idx] : idx;
    const el = renderCard(card);
    let isValid = false;
    let isStackCard = false;
    
    if (isMyTurn && state.active) {
      if (state.drawStack > 0 && gameSettings.stacking) {
        if (canStackCard(card)) {
          isValid = true;
          isStackCard = true;
        }
      } else {
        isValid = checkValidPlay(card);
      }
    }
    
    if (isValid) {
      el.classList.add('playable');
      if (isStackCard) el.classList.add('stackable');
    }
    
    el.draggable = true;
    
    el.addEventListener('dragstart', (e) => {
      if (!isValid) {
        e.preventDefault();
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
        return;
      }
      state.dragCard = originalIdx;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      state.dragCard = null;
    });
    
    el.onclick = async function() {
      if (!state.active || state.turn !== 0) return;
      if (isValid) {
        await executePlayerTurn(originalIdx);
      } else if (isMyTurn) {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
      }
    };
    
    handContainer.appendChild(el);
  });
}

function renderGameTable() {
  const gameTable = document.getElementById('game-table');
  if (!gameTable) return;
  gameTable.querySelectorAll('.player-zone').forEach(z => z.remove());
  
  const playerCount = state.players.length;
  
  state.players.forEach((player, idx) => {
    if (idx === 0) return;
    
    const zone = document.createElement('div');
    zone.className = 'player-zone ' + getPositionClass(idx);
    
    const info = document.createElement('div');
    info.className = 'player-info glass-panel';
    if (state.turn === idx) info.classList.add('active');
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'player-avatar color-glow ' + state.activeColor;
    avatarDiv.style.background = getPlayerColor(idx);
    avatarDiv.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
    
    const nameDiv = document.createElement('div');
    nameDiv.innerHTML = '<div class="font-bold text-xs" style="color: var(--fg);">' + player.name + '</div><div class="card-count-badge">' + player.hand.length + '</div>';
    
    info.appendChild(avatarDiv);
    info.appendChild(nameDiv);
    zone.appendChild(info);
    
    if (player.hand.length === 1) {
      const unoAlert = document.createElement('div');
      unoAlert.className = 'uno-alert';
      unoAlert.textContent = 'UNO!';
      info.appendChild(unoAlert);
    }
    
    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'bot-cards ' + (getPositionClass(idx) === 'left' || getPositionClass(idx) === 'right' ? 'vertical' : '');
    const displayCount = Math.min(player.hand.length, 7);
    for (let i = 0; i < displayCount; i++) {
      cardsDiv.appendChild(renderCard(null, true));
    }
    
    zone.appendChild(cardsDiv);
    gameTable.appendChild(zone);
  });
  
  const mainZone = document.createElement('div');
  mainZone.className = 'player-zone bottom';
  
  const mainInfo = document.createElement('div');
  mainInfo.className = 'player-info glass-panel';
  if (state.turn === 0) mainInfo.classList.add('active');
  
  const mainAvatar = document.createElement('div');
  mainAvatar.className = 'player-avatar color-glow ' + state.activeColor;
  mainAvatar.style.background = getPlayerColor(0);
  mainAvatar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
  
  const mainNameDiv = document.createElement('div');
  mainNameDiv.innerHTML = '<div class="font-bold text-xs" style="color: var(--fg);">' + state.players[0].name + '</div><div class="card-count-badge">' + state.players[0].hand.length + '</div>';
  
  mainInfo.appendChild(mainAvatar);
  mainInfo.appendChild(mainNameDiv);
  
  if (state.players[0].hand.length === 1) {
    const unoAlert = document.createElement('div');
    unoAlert.className = 'uno-alert';
    unoAlert.textContent = 'UNO!';
    mainInfo.appendChild(unoAlert);
  }
  
  mainZone.appendChild(mainInfo);
  gameTable.appendChild(mainZone);
}

// Timer
function startTimer() {
  if (!gameSettings.timer) return;
  stopTimer();
  state.timer = TURN_TIME;
  updateTurnIndicator();
  
  state.timerInterval = setInterval(() => {
    state.timer--;
    updateTurnIndicator();
    
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

function startGameTimer() {
  stopGameTimer();
  state.gameTime = GAME_TIME;
  updateGameTimerDisplay();
  
  state.gameTimerInterval = setInterval(() => {
    state.gameTime--;
    updateGameTimerDisplay();
    
    if (state.gameTime <= 0) {
      stopGameTimer();
      handleGameTimeout();
    }
  }, 1000);
}

function stopGameTimer() {
  if (state.gameTimerInterval) {
    clearInterval(state.gameTimerInterval);
    state.gameTimerInterval = null;
  }
}

function updateGameTimerDisplay() {
  const timerDisplay = document.getElementById('game-timer');
  const timerContainer = document.getElementById('game-timer-display');
  
  if (timerDisplay) {
    const minutes = Math.floor(state.gameTime / 60);
    const seconds = state.gameTime % 60;
    timerDisplay.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  }
  
  if (timerContainer) {
    timerContainer.classList.remove('warning', 'danger');
    if (state.gameTime <= 30) {
      timerContainer.classList.add('danger');
    } else if (state.gameTime <= 60) {
      timerContainer.classList.add('warning');
    }
  }
}

function handleTimeout() {
  if (state.turn !== 0) return;
  showGameMessage('Time Out!');
  vibrate([100, 50, 100]);
  
  if (state.drawStack > 0) {
    const drawn = drawCards(state.drawStack);
    state.players[0].hand.push(...drawn);
    state.drawStack = 0;
    state.stackType = null;
  } else {
    const card = drawCards(1)[0];
    if (card) state.players[0].hand.push(card);
  }
  
  renderHand();
  renderGameTable();
  updateUI();
  advanceTurn();
}

function handleGameTimeout() {
  showGameMessage('Time Up!');
  
  let minCards = Infinity;
  let winner = 0;
  
  state.players.forEach((player, idx) => {
    if (player.hand.length < minCards) {
      minCards = player.hand.length;
      winner = idx;
    }
  });
  
  setTimeout(() => endGame(winner, true), 500);
}

// Game Logic
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

async function drawCardsWithAnimation(playerIndex, count) {
  const player = state.players[playerIndex];
  if (!player) return;
  
  for (let i = 0; i < count; i++) {
    const card = drawCards(1)[0];
    if (!card) break;
    player.hand.push(card);
    playSound('draw');
    vibrate(30);
    
    if (playerIndex === 0) renderHand();
    else renderGameTable();
    
    await sleep(60);
  }
}

async function dealCardsFromCenter() {
  const gameTable = document.getElementById('game-table');
  if (!gameTable) return;
  
  const centerX = gameTable.offsetWidth / 2;
  const centerY = gameTable.offsetHeight / 2;
  
  for (let round = 0; round < 7; round++) {
    for (let pIdx = 0; pIdx < state.players.length; pIdx++) {
      const card = drawCards(1)[0];
      if (!card) continue;
      state.players[pIdx].hand.push(card);
      
      playSound('deal');
      
      const animCard = document.createElement('div');
      animCard.className = 'card-deal-animation';
      animCard.style.position = 'fixed';
      animCard.style.left = centerX + 'px';
      animCard.style.top = centerY + 'px';
      animCard.style.zIndex = '150';
      animCard.style.pointerEvents = 'none';
      
      const cardEl = renderCard(pIdx === 0 ? card : null, pIdx !== 0);
      cardEl.style.transform = 'scale(0.3)';
      animCard.appendChild(cardEl);
      document.body.appendChild(animCard);
      
      const targetPos = getCardDestination(pIdx, gameTable);
      requestAnimationFrame(() => {
        animCard.style.transition = 'all 0.25s ease-out';
        animCard.style.left = targetPos.x + 'px';
        animCard.style.top = targetPos.y + 'px';
        cardEl.style.transform = 'scale(1)';
      });
      
      await sleep(40);
      
      setTimeout(() => animCard.remove(), 300);
      
      if (pIdx === 0) renderHand();
      renderGameTable();
    }
  }
  
  updateUI();
}

function getCardDestination(playerIndex, gameTable) {
  if (!gameTable) return { x: 0, y: 0 };
  
  const w = gameTable.offsetWidth;
  const h = gameTable.offsetHeight;
  
  const positions = [
    { x: w / 2, y: h - 50 },
    { x: w - 80, y: h / 2 },
    { x: w / 2, y: 80 },
    { x: 80, y: h / 2 }
  ];
  
  return positions[playerIndex % positions.length];
}

async function playCard(playerIndex, cardIndex) {
  const player = state.players[playerIndex];
  if (!player) return;
  
  const card = player.hand.splice(cardIndex, 1)[0];
  state.discard.push(card);
  
  const now = Date.now();
  if (now - state.lastPlayTime < 2000) {
    state.comboCount++;
    if (state.comboCount >= 2) {
      playSound('combo');
    }
  } else {
    state.comboCount = 0;
  }
  state.lastPlayTime = now;
  
  if (card.v === 'S') {
    playSound('skip');
    shakeTable();
  } else if (card.v === 'R') {
    playSound('reverse');
    shakeTable();
  } else if (card.v === 'W' || card.v === '+4') {
    playSound('wild');
  } else {
    playSound('card');
  }
  vibrate(50);
  
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
  
  if (player.hand.length === 0) {
    stopTimer();
    stopGameTimer();
    setTimeout(() => endGame(playerIndex), 400);
    updateUI();
    return;
  }
  
  if (player.hand.length === 1) {
    state.saidUno.add(playerIndex);
    if (playerIndex !== 0) {
      showEmote(playerIndex, 'UNO!');
    }
  }
  
  if (card.c === 'black') {
    if (playerIndex === 0) {
      state.pendingWild = card;
      showColorPicker3D();
      updateUI();
      return;
    } else {
      state.activeColor = chooseColor(playerIndex);
      showColorPicker3DForBot(state.activeColor);
    }
  } else {
    state.activeColor = card.c;
  }
  
  await applyCardEffect(card, playerIndex);
  advanceTurn();
}

function shakeTable() {
  const table = document.getElementById('table-surface');
  if (table) {
    table.classList.add('shake');
    setTimeout(() => table.classList.remove('shake'), 500);
  }
}

async function applyCardEffect(card, currentPlayerIndex) {
  const nextIdx = getNextPlayerIndex();
  const nextPlayer = state.players[nextIdx];
  
  if (state.drawStack === 0 || !gameSettings.stacking) {
    if (card.v === 'S') {
      showGameMessage(nextPlayer.name + ' Skipped!');
      showEmote(nextIdx, getRandomEmote('skip'));
      await sleep(600);
      state.turn = nextIdx;
    } else if (card.v === 'R') {
      state.direction *= -1;
      showGameMessage('Reversed!');
      await sleep(500);
      if (state.players.length === 2) state.turn = nextIdx;
    }
  }
  
  if (state.drawStack > 0 && gameSettings.stacking) {
    const canStack = nextPlayer.hand.some(c => canStackCard(c));
    if (!canStack) {
      await drawCardsWithAnimation(nextIdx, state.drawStack);
      showGameMessage(nextPlayer.name + ' drew ' + state.drawStack + ' cards!');
      showEmote(nextIdx, getRandomEmote('draw'));
      state.drawStack = 0;
      state.stackType = null;
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

function advanceTurn() {
  state.turn = getNextPlayerIndex();
  updateUI();
  renderHand();
  renderGameTable();
  
  const currentPlayer = state.players[state.turn];
  if (currentPlayer && currentPlayer.isBot) {
    const personality = BOT_PERSONALITIES[state.turn % BOT_PERSONALITIES.length];
    let delay = 600 + Math.random() * 600;
    
    if (personality === 'aggressive') delay *= 0.7;
    else if (personality === 'defensive') delay *= 1.3;
    
    setTimeout(botTurn, delay);
  } else {
    startTimer();
    vibrate(100);
  }
}

// Bot AI
async function botTurn() {
  if (state.isOver || !state.active) return;
  
  const player = state.players[state.turn];
  if (!player) return;
  
  const personality = BOT_PERSONALITIES[state.turn % BOT_PERSONALITIES.length];
  
  if (state.drawStack > 0 && gameSettings.stacking) {
    const stackCardIdx = player.hand.findIndex(c => canStackCard(c));
    if (stackCardIdx !== -1) {
      showGameMessage(player.name + ' stacks!');
      showEmote(state.turn, '😤');
      await sleep(300);
      playCard(state.turn, stackCardIdx);
      return;
    } else {
      await drawCardsWithAnimation(state.turn, state.drawStack);
      showGameMessage(player.name + ' drew ' + state.drawStack + ' cards!');
      showEmote(state.turn, getRandomEmote('draw'));
      state.drawStack = 0;
      state.stackType = null;
      advanceTurn();
      return;
    }
  }
  
  let validMoves = [];
  player.hand.forEach((card, index) => {
    if (checkValidPlay(card)) validMoves.push({ card, index });
  });
  
  if (validMoves.length > 0) {
    if (personality === 'aggressive') {
      validMoves.sort((a, b) => {
        const aScore = getCardPriority(a.card);
        const bScore = getCardPriority(b.card);
        return bScore - aScore;
      });
    } else if (personality === 'defensive') {
      validMoves.sort((a, b) => {
        const aScore = getCardPriority(a.card);
        const bScore = getCardPriority(b.card);
        return aScore - bScore;
      });
    } else {
      validMoves.sort((a, b) => getCardPriority(b.card) - getCardPriority(a.card));
    }
    
    const choice = validMoves[0];
    await sleep(300);
    playCard(state.turn, choice.index);
  } else {
    await drawCardsWithAnimation(state.turn, 1);
    showGameMessage(player.name + ' drew a card');
    
    const drawnCard = player.hand[player.hand.length - 1];
    if (drawnCard && checkValidPlay(drawnCard)) {
      await sleep(400);
      playCard(state.turn, player.hand.length - 1);
    } else {
      advanceTurn();
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

// 3D Color Picker
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

async function showColorPicker3DForBot(chosenColor) {
  const picker = document.getElementById('color-picker-3d');
  if (!picker) return;
  
  picker.classList.add('active');
  
  picker.querySelectorAll('.color-box-3d').forEach(box => {
    if (box.dataset.color === chosenColor) {
      box.classList.add('selected');
    } else {
      box.classList.add('fade-out');
    }
  });
  
  await sleep(800);
  hideColorPicker3D();
}

// Menu Functions
function selectTheme(mode) {
  gameMode = mode;
  document.querySelectorAll('.theme-card').forEach(card => card.classList.remove('selected'));
  const selected = document.querySelector('[data-mode="' + mode + '"]');
  if (selected) selected.classList.add('selected');
}

function setDifficulty(diff) {
  gameSettings.botDifficulty = diff;
  document.querySelectorAll('.diff-btn').forEach(btn => btn.classList.remove('active'));
  const active = document.querySelector('[data-diff="' + diff + '"]');
  if (active) active.classList.add('active');
}

function showSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('active');
  updateSettingsUI();
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('active');
}

function toggleSetting(setting) {
  gameSettings[setting] = !gameSettings[setting];
  updateSettingsUI();
}

function updateSettingsUI() {
  const mapping = {
    stacking: 'toggle-stacking',
    jumpIn: 'toggle-jumpin',
    timer: 'toggle-timer',
    sound: 'toggle-sound'
  };
  
  Object.keys(mapping).forEach(key => {
    const toggle = document.getElementById(mapping[key]);
    if (toggle) toggle.classList.toggle('active', gameSettings[key]);
  });
}

// Matchmaking
async function enterMatchmaking() {
  showScreen('matchmaking-room');
  
  matchmakingState = {
    found: [true, false, false, false],
    names: ['You', '', '', '']
  };
  
  updateMatchmakingUI();
  
  for (let i = 1; i < 4; i++) {
    await sleep(400 + Math.random() * 600);
    matchmakingState.found[i] = true;
    matchmakingState.names[i] = BOT_NAMES[(i - 1) % BOT_NAMES.length];
    updateMatchmakingUI();
    playSound('deal');
  }
  
  const startBtn = document.getElementById('start-match-btn');
  if (startBtn) startBtn.disabled = false;
}

function updateMatchmakingUI() {
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById('slot-' + i);
    if (!slot) continue;
    
    const avatar = slot.querySelector('.slot-avatar');
    const name = slot.querySelector('.slot-name');
    const searching = slot.querySelector('.searching-animation');
    const status = slot.querySelector('.slot-status');
    
    if (matchmakingState.found[i]) {
      slot.classList.add('filled');
      if (avatar) avatar.classList.add('filled');
      if (name) name.textContent = matchmakingState.names[i];
      if (searching) searching.style.display = 'none';
      if (status) {
        status.style.display = 'block';
        status.textContent = 'Ready';
      }
    } else {
      slot.classList.remove('filled');
      if (avatar) avatar.classList.remove('filled');
      if (name) name.textContent = 'Searching...';
      if (searching) searching.style.display = 'flex';
      if (status) status.style.display = 'none';
    }
  }
}

function cancelMatchmaking() {
  showScreen('menu-screen');
  const startBtn = document.getElementById('start-match-btn');
  if (startBtn) startBtn.disabled = true;
}

async function startMatch() {
  initAudio();
  showScreen('game-app');
  await initGame();
}

async function initGame() {
  const players = [{ name: 'You', hand: [], isBot: false }];
  for (let i = 1; i < 4; i++) {
    players.push({
      name: matchmakingState.names[i] || BOT_NAMES[(i - 1) % BOT_NAMES.length],
      hand: [],
      isBot: true
    });
  }
  
  state = {
    deck: createDeck(),
    discard: [],
    players: players,
    turn: 0,
    direction: 1,
    activeColor: 'red',
    isOver: false,
    active: true,
    saidUno: new Set(),
    pendingWild: null,
    teams: [],
    drawStack: 0,
    stackType: null,
    timer: TURN_TIME,
    timerInterval: null,
    gameTime: GAME_TIME,
    gameTimerInterval: null,
    discardRotation: 0,
    sortMode: null,
    dragCard: null,
    comboCount: 0,
    lastPlayTime: 0
  };
  
  renderHand();
  renderGameTable();
  updateUI();
  
  showGameMessage('Dealing Cards...', 1500);
  await sleep(500);
  
  await dealCardsFromCenter();
  
  let startCard = drawCards(1)[0];
  while (startCard && (startCard.c === 'black' || SPECIAL_VALUES.includes(startCard.v))) {
    state.deck.unshift(startCard);
    state.deck = shuffle(state.deck);
    startCard = drawCards(1)[0];
  }
  
  if (startCard) {
    state.discard.push(startCard);
    state.activeColor = startCard.c;
  }
  
  playSound('card');
  updateUI();
  renderHand();
  
  state.turn = Math.floor(Math.random() * state.players.length);
  
  showGameMessage(state.players[state.turn].name + ' goes first!', 1200);
  
  await sleep(800);
  
  startGameTimer();
  
  if (state.players[state.turn].isBot) {
    setTimeout(botTurn, 800);
  } else {
    startTimer();
  }
}

// Confetti
function createConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  
  const colors = ['#ff4757', '#3742fa', '#2ed573', '#ffa502', '#a55eea'];
  
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 1 + 's';
    confetti.style.width = (5 + Math.random() * 8) + 'px';
    confetti.style.height = confetti.style.width;
    container.appendChild(confetti);
  }
  
  setTimeout(() => container.innerHTML = '', 4000);
}

function calculatePoints(hand) {
  let points = 0;
  hand.forEach(card => {
    if (card.v === 'W' || card.v === '+4') points += 50;
    else if (SPECIAL_VALUES.includes(card.v)) points += 20;
    else points += parseInt(card.v) || 0;
  });
  return points;
}

function endGame(winnerIndex, isTimeUp) {
  state.isOver = true;
  state.active = false;
  stopTimer();
  stopGameTimer();
  
  const isWin = winnerIndex === 0;
  
  if (isWin) {
    createConfetti();
    playSound('win');
    vibrate([100, 50, 100, 50, 200]);
    document.getElementById('result-emoji').innerHTML = '<svg width="50" height="50" viewBox="0 0 24 24" fill="#2ed573"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
    showEmote(winnerIndex, getRandomEmote('win'));
  } else {
    playSound('lose');
    vibrate([200, 100, 200]);
    document.getElementById('result-emoji').innerHTML = '<svg width="50" height="50" viewBox="0 0 24 24" fill="#ff4757"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>';
    showEmote(0, getRandomEmote('lose'));
  }
  
  let winnerText = isWin ? 'YOU WIN!' : 'YOU LOSE';
  if (isTimeUp) winnerText += ' (Time Up)';
  document.getElementById('winner-text').textContent = winnerText;
  
  const results = state.players.map((p, idx) => ({
    name: p.name,
    hand: [...p.hand],
    points: calculatePoints(p.hand),
    cards: p.hand.length,
    isWinner: idx === winnerIndex
  })).sort((a, b) => a.cards - b.cards);
  
  const resultsContainer = document.getElementById('results-container');
  if (resultsContainer) {
    resultsContainer.innerHTML = results.map((r, i) => 
      '<div class="flex items-center gap-3 p-2 rounded-xl mb-2" style="background: ' + (r.isWinner ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255,255,255,0.03)') + '">' +
        '<div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white" style="background: ' + (r.isWinner ? 'var(--uno-green)' : '#3d3d5c') + '">' + (i + 1) + '</div>' +
        '<div class="flex-1 font-bold text-xs" style="color: var(--fg);">' + r.name + '</div>' +
        '<div class="text-xs" style="color: var(--muted);">' + r.cards + ' cards</div>' +
        '<div class="font-bold text-xs" style="color: var(--uno-red);">' + r.points + ' pts</div>' +
      '</div>'
    ).join('');
  }
  
  const gameOver = document.getElementById('game-over');
  if (gameOver) gameOver.classList.add('active');
}

async function executePlayerTurn(cardIndex) {
  if (state.turn !== 0 || state.isOver || !state.active) return;
  stopTimer();
  await playCard(0, cardIndex);
}

// Table Ripple Effect
function createTableRipple(e) {
  const gameTable = document.getElementById('game-table');
  const tableSurface = document.getElementById('table-surface');
  if (!gameTable || !tableSurface) return;
  
  if (e.target.closest('.player-zone') || e.target.closest('.center-area') || e.target.closest('.direction-ring')) return;
  
  tableSurface.classList.remove('ripple');
  void tableSurface.offsetWidth;
  tableSurface.classList.add('ripple');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  runLoadingScreen();
  
  // Theme card clicks
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => selectTheme(card.dataset.mode));
  });
  
  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
  });
  
  // Restart/Lobby buttons
  document.getElementById('btn-restart')?.addEventListener('click', () => {
    document.getElementById('game-over')?.classList.remove('active');
    enterMatchmaking();
  });
  
  document.getElementById('btn-lobby')?.addEventListener('click', () => {
    document.getElementById('game-over')?.classList.remove('active');
    showScreen('menu-screen');
  });
  
  // Draw pile
  document.getElementById('draw-pile')?.addEventListener('click', async () => {
    if (state.turn !== 0 || state.isOver || !state.active) return;
    stopTimer();
    
    if (state.drawStack > 0 && gameSettings.stacking) {
      await drawCardsWithAnimation(0, state.drawStack);
      showGameMessage('You drew ' + state.drawStack + ' cards!');
      vibrate([50, 30, 50]);
      state.drawStack = 0;
      state.stackType = null;
      renderHand();
      updateUI();
      advanceTurn();
      return;
    }
    
    await drawCardsWithAnimation(0, 1);
    showGameMessage('You drew 1 card');
    renderHand();
    updateUI();
    
    const drawnCard = state.players[0].hand[state.players[0].hand.length - 1];
    if (!drawnCard || !checkValidPlay(drawnCard)) {
      await sleep(300);
      advanceTurn();
    } else {
      startTimer();
    }
  });
  
  // UNO button
  document.getElementById('uno-btn')?.addEventListener('click', () => {
    if (state.turn === 0 && state.players[0] && state.players[0].hand.length === 2 && state.active && !state.saidUno.has(0)) {
      state.saidUno.add(0);
      document.getElementById('uno-btn')?.classList.remove('active');
      showGameMessage('UNO!');
      playSound('uno');
      vibrate(100);
      renderGameTable();
    }
  });
  
  // Color picker boxes
  document.querySelectorAll('.color-box-3d').forEach(box => {
    box.addEventListener('click', async () => {
      if (!state.pendingWild) return;
      
      const chosenColor = box.dataset.color;
      state.activeColor = chosenColor;
      
      document.querySelectorAll('.color-box-3d').forEach(b => {
        if (b.dataset.color === chosenColor) {
          b.classList.add('selected');
        } else {
          b.classList.add('fade-out');
        }
      });
      
      await sleep(500);
      hideColorPicker3D();
      
      await applyCardEffect(state.pendingWild, 0);
      state.pendingWild = null;
      advanceTurn();
    });
  });
  
  // Table click for ripple
  document.getElementById('game-table')?.addEventListener('click', createTableRipple);
  
  // Drag and drop to discard pile
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
      
      if (state.dragCard !== null && state.turn === 0 && state.active) {
        const card = state.players[0].hand[state.dragCard];
        if (checkValidPlay(card)) {
          await executePlayerTurn(state.dragCard);
        }
      }
      state.dragCard = null;
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (state.isOver || !state.active) return;
    if (e.key === 'u' || e.key === 'U') document.getElementById('uno-btn')?.click();
    if (e.key === 'd' || e.key === 'D') document.getElementById('draw-pile')?.click();
    if (e.key === 'Escape') {
      closeSettings();
      hideColorPicker3D();
    }
  });
});
