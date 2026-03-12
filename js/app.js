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

// ==================== REMATCH & NAVIGATION ====================
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
