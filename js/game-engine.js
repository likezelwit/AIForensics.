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
