// Multiplayer Real-time Game Module
const GameMulti = {
  socket: null,
  roomId: null,
  isHost: false,
  isSpectator: false,
  wordLength: 5,
  currentTurnUser: null,

  // Chat Elements
  elChatDrawer: null,
  elChatMessages: null,
  elChatInput: null,
  elChatSendBtn: null,
  elChatTriggerBtn: null,
  elChatBadge: null,
  elChatCloseBtn: null,
  unreadMessagesCount: 0,
  chatDrawerOpen: false,
  elLobbyRoomId: null,
  elLobbyRoomPass: null,
  elLobbyWordLen: null,
  elLobbyPlayersList: null,
  elLobbyAdminPanel: null,
  elLobbyWaitMsg: null,
  elLobbyStartBtn: null,
  
  // Game window elements
  elYourWordContainer: null,
  elTurnPlayerLabel: null,
  elTimerBadge: null,
  elTimerVal: null,
  elOpponentsContainer: null,
  elGuessAnnouncement: null,
  elLeaderboardBody: null,

  // Spectator elements
  elSpecRoomId: null,
  elSpecRoomPassword: null,
  elSpecPlayersContainer: null,
  elSpecActivePlayer: null,
  elSpecTimerVal: null,
  elSpecLeaderboardBody: null,
  elSpecAnnouncement: null,

  init: () => {
    // Lobby elements
    GameMulti.elLobbyRoomId = document.getElementById('lobby-room-id-val');
    GameMulti.elLobbyRoomPass = document.getElementById('lobby-room-pass-val');
    GameMulti.elLobbyWordLen = document.getElementById('lobby-word-len-val');
    GameMulti.elLobbyPlayersList = document.getElementById('lobby-players-list');
    GameMulti.elLobbyAdminPanel = document.getElementById('lobby-admin-panel');
    GameMulti.elLobbyWaitMsg = document.getElementById('lobby-wait-msg');
    GameMulti.elLobbyStartBtn = document.getElementById('lobby-start-btn');

    // Game elements
    GameMulti.elYourWordContainer = document.getElementById('multi-your-word-container');
    GameMulti.elTurnPlayerLabel = document.getElementById('multi-turn-player-label');
    GameMulti.elTimerBadge = document.getElementById('multi-timer-badge');
    GameMulti.elTimerVal = document.getElementById('multi-timer-val');
    GameMulti.elOpponentsContainer = document.getElementById('multi-opponents-container');
    GameMulti.elGuessAnnouncement = document.getElementById('multi-guess-announcement');
    GameMulti.elLeaderboardBody = document.getElementById('multi-leaderboard-body');

    // Spectator elements
    GameMulti.elSpecRoomId = document.getElementById('spec-room-id');
    GameMulti.elSpecRoomPassword = document.getElementById('spec-room-password');
    GameMulti.elSpecPlayersContainer = document.getElementById('spec-players-container');
    GameMulti.elSpecActivePlayer = document.getElementById('spec-active-player');
    GameMulti.elSpecTimerVal = document.getElementById('spec-timer-val');
    GameMulti.elSpecLeaderboardBody = document.getElementById('spec-leaderboard-body');
    GameMulti.elSpecAnnouncement = document.getElementById('spec-announcement');

    // Chat elements
    GameMulti.elChatDrawer = document.getElementById('chat-drawer');
    GameMulti.elChatMessages = document.getElementById('chat-messages-container');
    GameMulti.elChatInput = document.getElementById('chat-input');
    GameMulti.elChatSendBtn = document.getElementById('chat-send-btn');
    GameMulti.elChatTriggerBtn = document.getElementById('chat-trigger-btn');
    GameMulti.elChatBadge = document.getElementById('chat-badge');
    GameMulti.elChatCloseBtn = document.getElementById('chat-close-btn');

    // Bind chat events
    GameMulti.bindChatEvents();

    // Connect to WebSockets
    GameMulti.connectSockets();
  },

  connectSockets: () => {
    // Connect to host IP (relative url works automatically with socket.io)
    GameMulti.socket = io();

    // Listen for sockets connection errors
    GameMulti.socket.on('connect_error', () => {
      console.warn('Socket connection error. Retrying...');
    });

    // Error messages from server
    GameMulti.socket.on('error_message', (msg) => {
      alert(msg);
    });

    // Host room created
    GameMulti.socket.on('room_created', ({ roomId, isSpectator, letterCount, password }) => {
      GameMulti.roomId = roomId;
      GameMulti.isHost = true;
      GameMulti.isSpectator = isSpectator;
      GameMulti.wordLength = letterCount;
      GameMulti.roomPassword = password;

      if (isSpectator) {
        App.switchScreen('screen-lobby');
        GameMulti.elChatTriggerBtn.classList.remove('hidden');
      } else {
        // Must enter word before lobby
        GameMulti.showWordInputPopup(letterCount);
      }
    });

    // Join verification passed, ask for secret word
    GameMulti.socket.on('room_verified', ({ roomId, letterCount }) => {
      GameMulti.roomId = roomId;
      GameMulti.isHost = false;
      GameMulti.isSpectator = false;
      GameMulti.wordLength = letterCount;
      
      // Close selections card
      App.closeOverlay('players-mode-overlay');
      
      // Prompt for secret word
      GameMulti.showWordInputPopup(letterCount);
    });

    // Joined successfully
    GameMulti.socket.on('joined_lobby', ({ roomId }) => {
      App.closeOverlay('player-word-overlay');
      App.switchScreen('screen-lobby');
      GameMulti.elChatTriggerBtn.classList.remove('hidden');
    });

    // Lobby closed (Host left)
    GameMulti.socket.on('lobby_closed', (msg) => {
      alert(msg);
      GameMulti.roomId = null;
      GameMulti.isHost = false;
      GameMulti.isSpectator = false;
      GameMulti.resetChatState();
      App.switchScreen('screen-home');
    });

    // Lobby players count update
    GameMulti.socket.on('lobby_update', ({ roomId, letterCount, players, hostUsername, spectatorMode }) => {
      GameMulti.elLobbyRoomId.textContent = roomId;
      GameMulti.elLobbyWordLen.textContent = letterCount;

      // Handle password reveal logic for host
      const toggleBtn = document.getElementById('lobby-toggle-pass-btn');
      GameMulti.elLobbyRoomPass.textContent = '******';

      if (GameMulti.isHost && GameMulti.roomPassword) {
        toggleBtn.classList.remove('hidden');
        
        // Remove previous listener to prevent duplicate triggers
        const newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

        newToggleBtn.addEventListener('click', () => {
          const isMasked = GameMulti.elLobbyRoomPass.textContent === '******';
          if (isMasked) {
            GameMulti.elLobbyRoomPass.textContent = GameMulti.roomPassword;
            newToggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
          } else {
            GameMulti.elLobbyRoomPass.textContent = '******';
            newToggleBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
          }
        });
      } else {
        if (toggleBtn) toggleBtn.classList.add('hidden');
      }

      // Render players list
      GameMulti.elLobbyPlayersList.innerHTML = '';
      players.forEach(p => {
        const li = document.createElement('li');
        li.className = 'lobby-player-row';
        if (p.profilePic) {
          li.innerHTML = `<img src="${p.profilePic}" alt="Avatar" class="profile-pic-avatar"><span>${p.username}</span>`;
        } else {
          li.innerHTML = `<i class="fa-solid fa-circle-user" style="font-size: 1.5rem; color: var(--text-muted);"></i> <span>${p.username}</span>`;
        }
        GameMulti.elLobbyPlayersList.appendChild(li);
      });

      // Render control panels
      const activeUser = Auth.currentUser;
      if (activeUser && hostUsername === activeUser.username) {
        GameMulti.elLobbyAdminPanel.classList.remove('hidden');
        GameMulti.elLobbyWaitMsg.classList.add('hidden');
        // Enable start button if there are players to play (even if host is spectator)
        // If host is playing, we need at least 2 players to play vs each other, or 1 player if solo lobby.
        // Let's enable start button if players count >= 1
        GameMulti.elLobbyStartBtn.disabled = players.length < 1;
      } else {
        GameMulti.elLobbyAdminPanel.classList.add('hidden');
        GameMulti.elLobbyWaitMsg.classList.remove('hidden');
      }
    });

    // Real-time Timer Sync
    GameMulti.socket.on('timer_sync', ({ timer }) => {
      if (GameMulti.elTimerVal) GameMulti.elTimerVal.textContent = timer;
      if (GameMulti.elSpecTimerVal) GameMulti.elSpecTimerVal.textContent = timer;
    });

    // Game Update (Player Mode)
    GameMulti.socket.on('game_update', (data) => {
      App.switchScreen('screen-game-multi');
      
      // Render own word queue
      // Data: { yourWord, yourWordRevealedMask, otherPlayers, leaderboard, activePlayerUsername, isActiveTurn, timer, lastGuessMessage }
      GameMulti.elYourWordContainer.innerHTML = '';
      data.yourWord.forEach((char, index) => {
        const letterBox = document.createElement('div');
        letterBox.className = 'letter-box';
        letterBox.textContent = char;
        
        // If this letter was guessed correctly by other users (revealed in mask)
        const letterGuessed = data.yourWordRevealedMask[index] !== '_';
        if (letterGuessed) {
          letterBox.classList.add('greyed');
        }
        GameMulti.elYourWordContainer.appendChild(letterBox);
      });

      // Active status & Timer
      GameMulti.elTurnPlayerLabel.textContent = `${data.activePlayerUsername}'s Turn`;
      if (data.isActiveTurn) {
        GameMulti.elTimerBadge.classList.remove('hidden');
        GameMulti.elTimerVal.textContent = data.timer;
      } else {
        GameMulti.elTimerBadge.classList.add('hidden');
      }

      // Guesses announcements
      if (data.lastGuessMessage) {
        GameMulti.elGuessAnnouncement.innerHTML = data.lastGuessMessage;
      } else {
        GameMulti.elGuessAnnouncement.innerHTML = 'Game started. Guess other players\' words!';
      }

      // Opponents grid
      GameMulti.elOpponentsContainer.innerHTML = '';
      data.otherPlayers.forEach(opp => {
        const row = document.createElement('div');
        row.className = 'opponent-row';

        // Username
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'opp-username';
        usernameSpan.style.display = 'flex';
        usernameSpan.style.alignItems = 'center';
        usernameSpan.style.gap = '8px';
        if (opp.profilePic) {
          usernameSpan.innerHTML = `<img src="${opp.profilePic}" alt="" class="profile-pic-avatar-mid"> <span>${opp.username}</span>`;
        } else {
          usernameSpan.innerHTML = `<i class="fa-solid fa-circle-user" style="font-size: 1.8rem; color: var(--text-muted);"></i> <span>${opp.username}</span>`;
        }
        row.appendChild(usernameSpan);

        // Word mask
        const maskDiv = document.createElement('div');
        maskDiv.className = 'opp-word-mask';
        maskDiv.textContent = opp.revealedMask;
        row.appendChild(maskDiv);

        // Guess inputs
        const inputGroup = document.createElement('div');
        inputGroup.className = 'opp-guess-input-group';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Guess...';
        input.maxLength = GameMulti.wordLength;
        input.disabled = !data.isActiveTurn || opp.isSolved;
        
        const button = document.createElement('button');
        button.className = 'btn btn-success';
        button.innerHTML = '<i class="fa-solid fa-check"></i>';
        button.disabled = !data.isActiveTurn || opp.isSolved;

        // Submit guess action
        const makeGuessAction = () => {
          const guessVal = input.value.trim().toLowerCase();
          if (!guessVal) return;
          GameMulti.socket.emit('make_guess', {
            roomId: GameMulti.roomId,
            targetPlayerId: opp.id,
            guess: guessVal
          });
          input.value = '';
        };

        button.addEventListener('click', makeGuessAction);
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') makeGuessAction();
        });

        inputGroup.appendChild(input);
        inputGroup.appendChild(button);
        row.appendChild(inputGroup);

        // Wrong guesses log box
        const wrongBox = document.createElement('div');
        wrongBox.className = 'opp-wrong-box';
        wrongBox.innerHTML = `<span>Wrongs:</span> ${opp.wrongGuesses || '--'}`;
        row.appendChild(wrongBox);

        GameMulti.elOpponentsContainer.appendChild(row);
      });

      // Leaderboard points table (rendered in white fonts)
      GameMulti.elLeaderboardBody.innerHTML = '';
      data.leaderboard.forEach((player, index) => {
        const tr = document.createElement('tr');
        
        const tdPos = document.createElement('td');
        tdPos.textContent = index + 1;
        
        const tdName = document.createElement('td');
        tdName.style.display = 'flex';
        tdName.style.alignItems = 'center';
        tdName.style.gap = '8px';
        if (player.profilePic) {
          tdName.innerHTML = `<img src="${player.profilePic}" alt="" class="profile-pic-avatar"> <span>${player.username}</span>`;
        } else {
          tdName.innerHTML = `<i class="fa-solid fa-circle-user" style="font-size: 1.25rem; color: var(--text-muted);"></i> <span>${player.username}</span>`;
        }
        
        const tdPoints = document.createElement('td');
        tdPoints.textContent = player.points;
        if (!player.isActive) {
          tdPoints.classList.add('disconnected');
        }

        tr.appendChild(tdPos);
        tr.appendChild(tdName);
        tr.appendChild(tdPoints);
        GameMulti.elLeaderboardBody.appendChild(tr);
      });
    });

    // Spectator Mode Update
    GameMulti.socket.on('spectator_update', (data) => {
      App.switchScreen('screen-spectator');
      
      GameMulti.elSpecRoomId.textContent = data.roomId;
      GameMulti.elSpecRoomPassword.textContent = data.roomPassword;
      GameMulti.elSpecActivePlayer.textContent = `${data.activePlayerUsername}'s Turn`;
      GameMulti.elSpecTimerVal.textContent = data.timer;
      
      if (data.lastGuessMessage) {
        GameMulti.elSpecAnnouncement.innerHTML = data.lastGuessMessage;
      } else {
        GameMulti.elSpecAnnouncement.innerHTML = 'Spectating WordHunt game room.';
      }

      // Render players mask lists
      GameMulti.elSpecPlayersContainer.innerHTML = '';
      data.players.forEach(p => {
        const row = document.createElement('div');
        row.className = 'opponent-row spectator-row';

        const infoCol = document.createElement('div');
        infoCol.className = 'spec-player-info-col';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'opp-username';
        nameSpan.style.display = 'flex';
        nameSpan.style.alignItems = 'center';
        nameSpan.style.gap = '8px';
        if (p.profilePic) {
          nameSpan.innerHTML = `<img src="${p.profilePic}" alt="" class="profile-pic-avatar-mid"> <span>${p.username}</span>`;
        } else {
          nameSpan.innerHTML = `<i class="fa-solid fa-circle-user" style="font-size: 1.8rem; color: var(--text-muted);"></i> <span>${p.username}</span>`;
        }
        infoCol.appendChild(nameSpan);

        const wrongBox = document.createElement('div');
        wrongBox.className = 'opp-wrong-box-spec';
        wrongBox.innerHTML = `<span>Wrongs:</span> ${p.wrongGuesses || '--'}`;
        infoCol.appendChild(wrongBox);

        row.appendChild(infoCol);

        const maskDiv = document.createElement('div');
        maskDiv.className = 'opp-word-mask';
        maskDiv.textContent = p.revealedMask;
        row.appendChild(maskDiv);

        GameMulti.elSpecPlayersContainer.appendChild(row);
      });

      // Render leaderboard points table (top score highlighted green)
      GameMulti.elSpecLeaderboardBody.innerHTML = '';
      data.leaderboard.forEach((player, index) => {
        const tr = document.createElement('tr');
        if (index === 0 && player.isActive) {
          tr.style.color = 'var(--color-success)';
          tr.style.textShadow = '0 0 8px var(--color-success-glow)';
        }

        const tdPos = document.createElement('td');
        tdPos.textContent = index + 1;

        const tdName = document.createElement('td');
        tdName.style.display = 'flex';
        tdName.style.alignItems = 'center';
        tdName.style.gap = '8px';
        if (player.profilePic) {
          tdName.innerHTML = `<img src="${player.profilePic}" alt="" class="profile-pic-avatar"> <span>${player.username}</span>`;
        } else {
          tdName.innerHTML = `<i class="fa-solid fa-circle-user" style="font-size: 1.25rem; color: var(--text-muted);"></i> <span>${player.username}</span>`;
        }

        const tdPoints = document.createElement('td');
        tdPoints.textContent = player.points;
        if (!player.isActive) {
          tdPoints.classList.add('disconnected');
        }

        tr.appendChild(tdPos);
        tr.appendChild(tdName);
        tr.appendChild(tdPoints);
        GameMulti.elSpecLeaderboardBody.appendChild(tr);
      });
    });

    // Game Finished, show victory screen
    GameMulti.socket.on('game_over_leaderboard', ({ leaderboard, hostDisconnected }) => {
      App.switchScreen('screen-winner');
      
      const hostDisconnectMsg = document.getElementById('winner-host-disconnect-msg');
      if (hostDisconnected) {
        hostDisconnectMsg.classList.remove('hidden');
      } else {
        hostDisconnectMsg.classList.add('hidden');
      }
      
      // Reset variables
      GameMulti.roomId = null;
      GameMulti.isHost = false;
      GameMulti.isSpectator = false;

      // Populate podium steps
      const p1st = leaderboard[0];
      const p2nd = leaderboard[1];
      const p3rd = leaderboard[2];

      const step1st = document.getElementById('podium-1st');
      const step2nd = document.getElementById('podium-2nd');
      const step3rd = document.getElementById('podium-3rd');

      // 1st Place
      if (p1st) {
        step1st.classList.remove('hidden');
        document.getElementById('winner-1st-name').textContent = p1st.username;
        document.getElementById('winner-1st-score').textContent = `${p1st.points} pts`;

        let avatarHtml = p1st.profilePic 
          ? `<img src="${p1st.profilePic}" class="podium-profile-pic">`
          : `<div class="podium-profile-placeholder"><i class="fa-solid fa-user"></i></div>`;
        let picDiv = step1st.querySelector('.podium-pic-wrapper');
        if (!picDiv) {
          picDiv = document.createElement('div');
          picDiv.className = 'podium-pic-wrapper';
          step1st.insertBefore(picDiv, document.getElementById('winner-1st-name'));
        }
        picDiv.innerHTML = avatarHtml;
      } else {
        step1st.classList.add('hidden');
      }

      // 2nd Place
      if (p2nd) {
        step2nd.classList.remove('hidden');
        document.getElementById('winner-2nd-name').textContent = p2nd.username;
        document.getElementById('winner-2nd-score').textContent = `${p2nd.points} pts`;

        let avatarHtml = p2nd.profilePic 
          ? `<img src="${p2nd.profilePic}" class="podium-profile-pic">`
          : `<div class="podium-profile-placeholder"><i class="fa-solid fa-user"></i></div>`;
        let picDiv = step2nd.querySelector('.podium-pic-wrapper');
        if (!picDiv) {
          picDiv = document.createElement('div');
          picDiv.className = 'podium-pic-wrapper';
          step2nd.insertBefore(picDiv, document.getElementById('winner-2nd-name'));
        }
        picDiv.innerHTML = avatarHtml;
      } else {
        step2nd.classList.add('hidden');
      }

      // 3rd Place
      if (p3rd) {
        step3rd.classList.remove('hidden');
        document.getElementById('winner-3rd-name').textContent = p3rd.username;
        document.getElementById('winner-3rd-score').textContent = `${p3rd.points} pts`;

        let avatarHtml = p3rd.profilePic 
          ? `<img src="${p3rd.profilePic}" class="podium-profile-pic">`
          : `<div class="podium-profile-placeholder"><i class="fa-solid fa-user"></i></div>`;
        let picDiv = step3rd.querySelector('.podium-pic-wrapper');
        if (!picDiv) {
          picDiv = document.createElement('div');
          picDiv.className = 'podium-pic-wrapper';
          step3rd.insertBefore(picDiv, document.getElementById('winner-3rd-name'));
        }
        picDiv.innerHTML = avatarHtml;
      } else {
        step3rd.classList.add('hidden');
      }

      // Full rest of players list
      const restList = document.getElementById('winner-rest-list');
      restList.innerHTML = '';
      if (leaderboard.length > 3) {
        leaderboard.slice(3).forEach((p, idx) => {
          const li = document.createElement('li');
          let avatarHtml = p.profilePic 
            ? `<img src="${p.profilePic}" class="profile-pic-avatar" style="margin-right: 8px;">`
            : `<i class="fa-solid fa-circle-user" style="font-size: 1.25rem; color: var(--text-muted); margin-right: 8px;"></i>`;
          li.innerHTML = `<span class="pos">#${idx + 4}</span><span class="name" style="display:flex; align-items:center;">${avatarHtml} ${p.username}</span><span class="score">${p.points} pts</span>`;
          restList.appendChild(li);
        });
      }
    });

    // Received chat message
    GameMulti.socket.on('chat_message_received', ({ senderName, senderAvatar, senderId, message, timestamp }) => {
      const isSelf = (senderId === Auth.currentUser?.id);
      
      const msgRow = document.createElement('div');
      msgRow.className = `chat-message-row ${isSelf ? 'self' : ''}`;

      const senderDiv = document.createElement('div');
      senderDiv.className = 'chat-msg-sender';
      
      if (senderAvatar) {
        senderDiv.innerHTML = `<img src="${senderAvatar}" alt="" class="chat-msg-avatar"> <span>${senderName}</span>`;
      } else {
        senderDiv.innerHTML = `<i class="fa-solid fa-circle-user" style="font-size: 0.9rem; color: var(--text-muted);"></i> <span>${senderName}</span>`;
      }
      msgRow.appendChild(senderDiv);

      const bubbleDiv = document.createElement('div');
      bubbleDiv.className = 'chat-msg-bubble';
      bubbleDiv.textContent = message;
      msgRow.appendChild(bubbleDiv);

      GameMulti.elChatMessages.appendChild(msgRow);
      GameMulti.elChatMessages.scrollTop = GameMulti.elChatMessages.scrollHeight;

      // Handle unread badge
      if (!GameMulti.chatDrawerOpen) {
        GameMulti.unreadMessagesCount++;
        GameMulti.updateChatBadge();
      }
    });
  },

  // Host room creation
  hostRoom: (roomId, password, letterCount, spectateMode) => {
    const user = Auth.currentUser;
    if (!user) return alert('You must login first.');

    GameMulti.socket.emit('create_room', {
      roomId,
      password,
      letterCount,
      spectateMode,
      user
    });
  },

  // Verify and join room
  verifyRoom: (roomId, password) => {
    GameMulti.socket.emit('join_room_verify', { roomId, password });
  },

  // Submit player secret word and join
  submitWord: (word) => {
    const user = Auth.currentUser;
    if (!user) return alert('You must login first.');

    GameMulti.socket.emit('submit_word_join', {
      roomId: GameMulti.roomId,
      user,
      word
    });
  },

  // Host starts the game
  startGame: () => {
    if (!GameMulti.roomId) return;
    GameMulti.socket.emit('start_game', { roomId: GameMulti.roomId });
  },

  // Player leaves or disconnects
  exitGame: () => {
    if (GameMulti.socket) {
      GameMulti.socket.emit('exit_game');
    }
    GameMulti.roomId = null;
    GameMulti.isHost = false;
    GameMulti.isSpectator = false;
    GameMulti.resetChatState();
    App.switchScreen('screen-home');
  },

  resetChatState: () => {
    if (GameMulti.elChatTriggerBtn) GameMulti.elChatTriggerBtn.classList.add('hidden');
    if (GameMulti.elChatDrawer) GameMulti.elChatDrawer.classList.remove('open');
    if (GameMulti.elChatMessages) GameMulti.elChatMessages.innerHTML = '';
    GameMulti.unreadMessagesCount = 0;
    GameMulti.chatDrawerOpen = false;
    GameMulti.updateChatBadge();
  },

  updateChatBadge: () => {
    if (GameMulti.unreadMessagesCount > 0) {
      GameMulti.elChatBadge.textContent = GameMulti.unreadMessagesCount;
      GameMulti.elChatBadge.classList.remove('hidden');
    } else {
      GameMulti.elChatBadge.classList.add('hidden');
    }
  },

  bindChatEvents: () => {
    GameMulti.elChatTriggerBtn.addEventListener('click', () => {
      GameMulti.elChatDrawer.classList.add('open');
      GameMulti.chatDrawerOpen = true;
      GameMulti.unreadMessagesCount = 0;
      GameMulti.updateChatBadge();
      GameMulti.elChatInput.focus();
      setTimeout(() => {
        GameMulti.elChatMessages.scrollTop = GameMulti.elChatMessages.scrollHeight;
      }, 50);
    });

    GameMulti.elChatCloseBtn.addEventListener('click', () => {
      GameMulti.elChatDrawer.classList.remove('open');
      GameMulti.chatDrawerOpen = false;
    });

    const sendMessage = () => {
      const text = GameMulti.elChatInput.value.trim();
      if (!text) return;
      GameMulti.socket.emit('chat_message', {
        roomId: GameMulti.roomId,
        message: text
      });
      GameMulti.elChatInput.value = '';
    };

    GameMulti.elChatSendBtn.addEventListener('click', sendMessage);
    GameMulti.elChatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    document.querySelectorAll('.quick-chat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        GameMulti.socket.emit('chat_message', {
          roomId: GameMulti.roomId,
          message: text
        });
      });
    });
  },

  // Show modal to enter secret word
  showWordInputPopup: (letterCount) => {
    document.getElementById('player-word-len-label').textContent = letterCount;
    const input = document.getElementById('player-secret-word-input');
    input.maxLength = letterCount;
    input.value = '';
    input.placeholder = `${letterCount} Letter Word`;
    document.getElementById('player-word-error').classList.add('hidden');
    App.openOverlay('player-word-overlay');
  }
};
