require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const db = require('./database/db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Load Word Dictionary
let wordDictionary = {};
try {
  wordDictionary = require('./database/words.json');
} catch (error) {
  console.error('Failed to load words.json. Creating default list.', error);
  wordDictionary = {
    "5": ["apple", "phone", "water"],
    "6": ["active", "jungle", "winter"],
    "7": ["academy", "journey", "victory"],
    "8": ["absolute", "database", "tomorrow"],
    "9": ["adventure", "beautiful", "wonderful"]
  };
}

// Endpoint to retrieve word lists
app.get('/api/words', (req, res) => {
  res.json(wordDictionary);
});

// Endpoint to verify a custom word against the online dictionary API
app.get('/api/words/verify', (req, res) => {
  const word = req.query.word?.trim().toLowerCase();
  const length = parseInt(req.query.length, 10);

  if (!word || isNaN(length) || word.length !== length || !/^[a-z]+$/.test(word)) {
    return res.json({ valid: false, error: 'Invalid word format.' });
  }

  const countStr = length.toString();

  // If already in local dictionary, return valid immediately
  if (wordDictionary[countStr] && wordDictionary[countStr].includes(word)) {
    return res.json({ valid: true });
  }

  // Otherwise check API
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const options = {
    headers: {
      'User-Agent': 'WordHunt-Server/1.0'
    }
  };

  https.get(url, options, (apiRes) => {
    if (apiRes.statusCode === 200) {
      let rawData = '';
      apiRes.on('data', (chunk) => { rawData += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Word is valid! Add to our local dictionary files
            if (!wordDictionary[countStr]) {
              wordDictionary[countStr] = [];
            }
            if (!wordDictionary[countStr].includes(word)) {
              wordDictionary[countStr].push(word);
              const wordsPath = path.join(__dirname, 'database', 'words.json');
              fs.writeFile(wordsPath, JSON.stringify(wordDictionary, null, 2), 'utf8', (err) => {
                if (err) console.error('Error writing to words.json:', err);
              });
            }
            return res.json({ valid: true });
          }
          return res.json({ valid: false });
        } catch (e) {
          console.error('Error parsing dictionary response:', e);
          return res.json({ valid: false, error: 'Parsing error.' });
        }
      });
    } else {
      return res.json({ valid: false });
    }
  }).on('error', (err) => {
    console.error('Error contacting Dictionary API:', err.message);
    return res.json({ valid: false, error: 'Service unavailable.' });
  });
});

// Helper to get local network IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Background function to verify word on the internet and add to words.json
function verifyAndAddWordToDictionary(word, length) {
  const countStr = length.toString();
  
  // Check if it's already in the dictionary
  if (wordDictionary[countStr] && wordDictionary[countStr].includes(word)) {
    return;
  }

  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  
  const options = {
    headers: {
      'User-Agent': 'WordHunt-Server/1.0'
    }
  };

  https.get(url, options, (res) => {
    if (res.statusCode === 200) {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[Dictionary API] Verified "${word}" is a valid word. Adding to dictionary.`);
            
            if (!wordDictionary[countStr]) {
              wordDictionary[countStr] = [];
            }
            
            if (!wordDictionary[countStr].includes(word)) {
              wordDictionary[countStr].push(word);
              
              // Save to words.json
              const wordsPath = path.join(__dirname, 'database', 'words.json');
              fs.writeFile(wordsPath, JSON.stringify(wordDictionary, null, 2), 'utf8', (err) => {
                if (err) {
                  console.error('Error writing to words.json:', err);
                } else {
                  console.log(`[Dictionary API] "${word}" saved to database/words.json successfully.`);
                }
              });
            }
          }
        } catch (e) {
          console.error('Error parsing dictionary response:', e);
        }
      });
    } else {
      console.log(`[Dictionary API] Checked "${word}" but API returned code: ${res.statusCode} (likely invalid word).`);
    }
  }).on('error', (err) => {
    console.error('Error contacting Dictionary API:', err.message);
  });
}

// ----------------------------------------------------
// REST APIs (Authentication & Profiles)
// ----------------------------------------------------

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  const { email, username, password, rePassword } = req.body;
  if (!email || !username || !password || !rePassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (password !== rePassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  try {
    const user = await db.signup(email, username, password);
    res.status(201).json({ message: 'Signup successful!', user });
  } catch (error) {
    res.status(400).json({ error: error.message, suggestions: error.suggestions || [] });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }
  try {
    const user = await db.login(identifier, password);
    res.status(200).json({ message: 'Login successful!', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Profile
app.get('/api/auth/profile/:userId', async (req, res) => {
  try {
    const user = await db.getUser(req.params.userId);
    res.status(200).json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update Profile
app.post('/api/auth/profile/update', async (req, res) => {
  const { userId, username, email, currentPassword, newPassword, profilePic } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }
  try {
    const user = await db.updateProfile(userId, username, email, currentPassword, newPassword, profilePic);
    res.status(200).json({ message: 'Profile updated successfully!', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Request Password Reset (Forgot Password)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  try {
    const token = await db.requestPasswordReset(email);
    let hostDomain = `http://${getLocalIpAddress()}:${process.env.PORT || 3000}`;
    if (process.env.RENDER_EXTERNAL_URL) {
      hostDomain = process.env.RENDER_EXTERNAL_URL;
    }
    const resetLink = `${hostDomain}/#reset-password?token=${token}`;
    
    // Log the link in console for easy testing/retrieval
    console.log('\n=========================================');
    console.log(`PASSWORD RESET REQUEST FOR: ${email}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log('=========================================\n');

    // Return generic success message without exposing the link to the client
    res.status(200).json({ 
      message: 'A password reset link has been generated and logged to the server terminal console.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password, rePassword } = req.body;
  if (!token || !password || !rePassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (password !== rePassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  try {
    await db.resetPassword(token, password);
    res.status(200).json({ message: 'Password reset successfully!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ----------------------------------------------------
// AI Mode Game REST APIs
// ----------------------------------------------------
const aiGames = new Map();

// Start AI Game
app.post('/api/ai/start', (req, res) => {
  const { letterCount } = req.body;
  const count = parseInt(letterCount, 10);
  if (isNaN(count) || count < 5 || count > 9) {
    return res.status(400).json({ error: 'Invalid letter count. Must be between 5 and 9.' });
  }

  const words = wordDictionary[count.toString()];
  if (!words || words.length === 0) {
    return res.status(400).json({ error: `No words found for length ${count}.` });
  }

  const secretWord = words[Math.floor(Math.random() * words.length)].toLowerCase();
  const gameId = 'ai_' + Math.random().toString(36).substr(2, 9);
  
  // Game session state
  aiGames.set(gameId, {
    word: secretWord,
    guesses: 0,
    guessedLetters: new Set(),
    wrongLetters: new Set()
  });

  // Return masked word
  const maskedWord = '_'.repeat(secretWord.length).split('').join(' ');
  res.status(200).json({ gameId, maskedWord, wordLength: secretWord.length });
});

// Submit Guess in AI Game
app.post('/api/ai/guess', (req, res) => {
  const { gameId, guess } = req.body;
  const game = aiGames.get(gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game session not found.' });
  }

  if (!guess || typeof guess !== 'string') {
    return res.status(400).json({ error: 'Invalid guess.' });
  }

  const cleanGuess = guess.trim().toLowerCase();
  if (!/^[a-z]+$/.test(cleanGuess)) {
    return res.status(400).json({ error: 'Guesses must contain only English letters.' });
  }

  game.guesses += 1;
  const isWordGuess = cleanGuess.length > 1;
  let correct = false;
  let won = false;

  if (isWordGuess) {
    if (cleanGuess === game.word) {
      correct = true;
      won = true;
      // Reveal all letters
      for (const char of game.word) {
        game.guessedLetters.add(char);
      }
    } else {
      correct = false;
    }
  } else {
    // Single letter guess
    const letter = cleanGuess;
    if (game.word.includes(letter)) {
      correct = true;
      game.guessedLetters.add(letter);
      // Check if all letters are now guessed
      won = game.word.split('').every(char => game.guessedLetters.has(char));
    } else {
      correct = false;
      game.wrongLetters.add(letter);
    }
  }

  // Create masked word representation
  const maskedWord = game.word
    .split('')
    .map(char => (game.guessedLetters.has(char) ? char : '_'))
    .join(' ');

  const response = {
    correct,
    won,
    guesses: game.guesses,
    maskedWord,
    wrongLetters: Array.from(game.wrongLetters).join(', ')
  };

  if (won) {
    aiGames.delete(gameId); // Clean up session
  }

  res.status(200).json(response);
});

// ----------------------------------------------------
// Real-time Multiplayer Socket.io State
// ----------------------------------------------------
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Host creates a room
  socket.on('create_room', ({ roomId, password, letterCount, spectateMode, user }) => {
    if (!roomId || !password || !letterCount) {
      return socket.emit('error_message', 'Room ID, password, and letter count are required.');
    }
    if (rooms.has(roomId)) {
      return socket.emit('error_message', 'Room ID already exists.');
    }

    const count = parseInt(letterCount, 10);
    if (count < 5 || count > 9) {
      return socket.emit('error_message', 'Word length must be between 5 and 9.');
    }

    const roomState = {
      roomId,
      password,
      letterCount: count,
      spectatorHostId: spectateMode ? socket.id : null,
      hostUser: user,
      players: [],          // active players
      exitedPlayers: [],    // disconnected/exited players history
      turnIndex: 0,
      started: false,
      timer: 30,
      timerIntervalId: null,
      lastGuessMessage: ''
    };

    rooms.set(roomId, roomState);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = user.id;

    console.log(`Room created: ${roomId} by ${user.username}`);

    if (spectateMode) {
      socket.emit('room_created', { roomId, isSpectator: true, letterCount: count, password: password });
      io.to(roomId).emit('lobby_update', getLobbyState(roomState));
    } else {
      socket.emit('room_created', { roomId, isSpectator: false, letterCount: count, password: password });
    }
  });

  // Player joins a room (checks passwords first, then UI prompts for word)
  socket.on('join_room_verify', ({ roomId, password }) => {
    const room = rooms.get(roomId);
    if (!room) {
      return socket.emit('error_message', 'Incorrect room ID/password');
    }
    if (room.password !== password) {
      return socket.emit('error_message', 'Incorrect room ID/password');
    }
    if (room.started) {
      return socket.emit('error_message', 'Game has already started in this room.');
    }
    
    socket.emit('room_verified', { roomId, letterCount: room.letterCount });
  });

  // Submit word and join game lobby
  socket.on('submit_word_join', ({ roomId, user, word }) => {
    const room = rooms.get(roomId);
    if (!room) {
      return socket.emit('error_message', 'Room not found.');
    }
    if (room.started) {
      return socket.emit('error_message', 'Game has already started.');
    }

    const cleanWord = word.trim().toLowerCase();
    if (cleanWord.length !== room.letterCount) {
      return socket.emit('error_message', `Word must be exactly ${room.letterCount} letters long.`);
    }
    if (!/^[a-z]+$/.test(cleanWord)) {
      return socket.emit('error_message', 'Word must contain only English letters.');
    }

    // Check if player already joined
    const existingPlayer = room.players.find(p => p.id === user.id);
    if (existingPlayer) {
      return socket.emit('error_message', 'You have already joined this room.');
    }

    const newPlayer = {
      id: user.id,
      socketId: socket.id,
      username: user.username,
      profilePic: user.profilePic || null,
      word: cleanWord,
      revealedMask: '_'.repeat(cleanWord.length).split(''),
      wrongGuesses: new Set(),
      points: 0,
      active: true
    };

    room.players.push(newPlayer);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = user.id;

    console.log(`Player ${user.username} joined room ${roomId} with word "${cleanWord}"`);

    socket.emit('joined_lobby', { roomId });
    io.to(roomId).emit('lobby_update', getLobbyState(roomState = room));
  });

  // Host starts the game
  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error_message', 'Room not found.');
    if (room.started) return socket.emit('error_message', 'Game has already started.');
    
    // Check if there are players to play
    if (room.players.length < 1) {
      return socket.emit('error_message', 'Need at least 1 player to start the game.');
    }

    room.started = true;
    room.turnIndex = 0;
    room.timer = 30;

    console.log(`Game started in room ${roomId}`);
    broadcastGameState(roomId);
    startTurnTimer(roomId);
  });

  // Player makes a guess
  socket.on('make_guess', ({ roomId, targetPlayerId, guess }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error_message', 'Room not found.');
    if (!room.started) return socket.emit('error_message', 'Game has not started yet.');

    const activePlayer = room.players[room.turnIndex];
    if (!activePlayer || activePlayer.socketId !== socket.id) {
      return socket.emit('error_message', 'It is not your turn.');
    }

    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      return socket.emit('error_message', 'Target player not found.');
    }
    if (targetPlayer.id === activePlayer.id) {
      return socket.emit('error_message', 'You cannot guess your own word.');
    }
    
    // Check if target player's word is already solved
    const targetWordSolved = targetPlayer.revealedMask.join('') === targetPlayer.word;
    if (targetWordSolved) {
      return socket.emit('error_message', 'This player\'s word has already been fully guessed.');
    }

    const cleanGuess = guess.trim().toLowerCase();
    if (!/^[a-z]+$/.test(cleanGuess)) {
      return socket.emit('error_message', 'Guess must only contain letters.');
    }

    let isCorrect = false;
    let pointsAwarded = 0;
    const isWordGuess = cleanGuess.length > 1;

    // Count how many dashes are NOT guessed before this turn
    const preDashesCount = targetPlayer.revealedMask.filter(c => c === '_').length;

    if (isWordGuess) {
      if (cleanGuess === targetPlayer.word) {
        isCorrect = true;
        
        // Reveal the entire word
        targetPlayer.revealedMask = targetPlayer.word.split('');
        
        // Points calculation:
        // If at-least three dashes ('_') not guessed: not_guessed * 3 + 2 points.
        // Else: not_guessed * 3 points.
        if (preDashesCount >= 3) {
          pointsAwarded = preDashesCount * 3 + 2;
        } else {
          pointsAwarded = preDashesCount * 3;
        }
        activePlayer.points += pointsAwarded;
      } else {
        // Incorrect word guess: lose not_guessed * 1 points
        isCorrect = false;
        pointsAwarded = -preDashesCount;
        activePlayer.points += pointsAwarded;
        // Points cannot be negative? No, let's allow negative or keep min at 0?
        // Standard points tables allow negative points. Let's allow negative.
      }
    } else {
      // Single letter guess
      const letter = cleanGuess;
      if (targetPlayer.word.includes(letter)) {
        isCorrect = true;
        let revealedCount = 0;

        // Reveal matching letters
        for (let i = 0; i < targetPlayer.word.length; i++) {
          if (targetPlayer.word[i] === letter && targetPlayer.revealedMask[i] === '_') {
            targetPlayer.revealedMask[i] = letter;
            revealedCount++;
          }
        }

        if (revealedCount > 0) {
          pointsAwarded = revealedCount * 3; // +3 points for each newly revealed letter (e.g., if two are revealed: 2 * 3 = 6 points)
          activePlayer.points += pointsAwarded;
        } else {
          // Already revealed letter guess counts as incorrect
          isCorrect = false;
          pointsAwarded = -1;
          activePlayer.points += pointsAwarded;
        }
      } else {
        // Wrong letter guess: lose 1 point, append to wrong guesses
        isCorrect = false;
        pointsAwarded = -1;
        activePlayer.points += pointsAwarded;
        targetPlayer.wrongGuesses.add(letter);
      }
    }

    // Set message
    const correctText = isCorrect ? 'correctly' : (isWordGuess ? 'wrongly' : 'wrong');
    const color = isCorrect ? 'green' : 'red';
    room.lastGuessMessage = `<span class="guess-msg-${color}">${activePlayer.username} to ${targetPlayer.username} : guessed '${cleanGuess}' ${correctText}</span>`;

    // Reset turn timer, increment turn
    nextTurn(roomId);
  });

  // Client requests to exit game
  socket.on('exit_game', () => {
    handleExiting(socket);
  });

  // Handle chat messages in multiplayer rooms
  socket.on('chat_message', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    let senderName = 'Spectator';
    let senderAvatar = null;
    let senderId = 'spectator';

    if (player) {
      senderName = player.username;
      senderAvatar = player.profilePic;
      senderId = player.id;
    } else if (socket.id === room.spectatorHostId) {
      senderName = 'Host (Spectator)';
      senderAvatar = null;
      senderId = 'host';
    }

    io.to(roomId).emit('chat_message_received', {
      senderName,
      senderAvatar,
      senderId,
      message: message.trim().slice(0, 150),
      timestamp: Date.now()
    });
  });

  // Socket disconnected
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    handleExiting(socket);
  });
});

// Helper: Get public lobby list state
function getLobbyState(room) {
  return {
    roomId: room.roomId,
    letterCount: room.letterCount,
    players: room.players.map(p => ({ username: p.username, profilePic: p.profilePic || null })),
    hostUsername: room.hostUser.username,
    spectatorMode: room.spectatorHostId !== null
  };
}

// Helper: Broadcast current game states to players in room
function broadcastGameState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Sorted leaderboard (descending)
  const leaderboard = [...room.players, ...room.exitedPlayers]
    .map(p => ({
      id: p.id,
      username: p.username,
      points: p.active ? p.points : 'Disconnected',
      isActive: p.active,
      profilePic: p.profilePic || null
    }))
    .sort((a, b) => {
      if (typeof a.points === 'string') return 1; // Put disconnected at the bottom
      if (typeof b.points === 'string') return -1;
      return b.points - a.points;
    });

  // We need to send tailored payloads for each player
  room.players.forEach(p => {
    // Other players data
    const otherPlayers = room.players
      .filter(other => other.id !== p.id)
      .map(other => ({
        id: other.id,
        username: other.username,
        profilePic: other.profilePic || null,
        // Revealed dashes / characters
        revealedMask: other.revealedMask.join(' '),
        // Set wrong guesses array
        wrongGuesses: Array.from(other.wrongGuesses).join(', '),
        isSolved: other.revealedMask.join('') === other.word
      }));

    io.to(p.socketId).emit('game_update', {
      yourWord: p.word.split(''), // Array of characters to display in queue boxes
      yourWordRevealedMask: p.revealedMask, // Shows which letters of player's word have been found
      otherPlayers,
      leaderboard,
      activePlayerUsername: room.players[room.turnIndex]?.username || '',
      isActiveTurn: room.players[room.turnIndex]?.id === p.id,
      timer: room.timer,
      lastGuessMessage: room.lastGuessMessage,
      roomId: room.roomId
    });
  });

  // If host is spectating, send the spectator-specific payload
  if (room.spectatorHostId) {
    const spectatorPlayers = room.players.map(p => ({
      id: p.id,
      username: p.username,
      profilePic: p.profilePic || null,
      revealedMask: p.revealedMask.join(' '),
      wrongGuesses: Array.from(p.wrongGuesses).join(', '),
      isSolved: p.revealedMask.join('') === p.word
    }));

    io.to(room.spectatorHostId).emit('spectator_update', {
      players: spectatorPlayers,
      leaderboard,
      activePlayerUsername: room.players[room.turnIndex]?.username || '',
      timer: room.timer,
      lastGuessMessage: room.lastGuessMessage,
      roomId: room.roomId,
      roomPassword: room.password
    });
  }
}

// Helper: Start turn 30s countdown timer
function startTurnTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timerIntervalId) {
    clearInterval(room.timerIntervalId);
  }

  room.timer = 30;
  room.timerIntervalId = setInterval(() => {
    if (!rooms.has(roomId)) {
      clearInterval(room.timerIntervalId);
      return;
    }

    room.timer -= 1;
    if (room.timer <= 0) {
      // Timeout: pass turn to next player
      room.lastGuessMessage = `<span class="guess-msg-timeout">${room.players[room.turnIndex]?.username || 'Player'} ran out of time! Turn skipped.</span>`;
      nextTurn(roomId);
    } else {
      // Sync timer to everyone
      io.to(roomId).emit('timer_sync', { timer: room.timer });
    }
  }, 1000);
}

// Helper: Advance turn index
function nextTurn(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Check if game is over
  if (checkGameOver(room)) {
    handleGameOver(room);
    return;
  }

  // Increment turn index (skip solved or inactive players if any, though they still take turns if not solved)
  let foundNextPlayer = false;
  let attempts = 0;
  
  while (!foundNextPlayer && attempts < room.players.length) {
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    attempts++;

    const nextPlayer = room.players[room.turnIndex];
    // A player still gets their turn to guess other's words even if their own word is solved.
    // They only don't get a turn if they are inactive (disconnected/exited).
    if (nextPlayer && nextPlayer.active) {
      // Also, check if there is anyone left for this player to guess.
      // If all OTHER players' words are already solved, this player can't guess.
      const hasWordToGuess = room.players.some(p => p.id !== nextPlayer.id && p.revealedMask.join('') !== p.word);
      if (hasWordToGuess) {
        foundNextPlayer = true;
      }
    }
  }

  // If no one can make a guess (e.g. all words are solved), trigger game over
  if (!foundNextPlayer) {
    handleGameOver(room);
    return;
  }

  // Reset timer
  startTurnTimer(roomId);
  broadcastGameState(roomId);
}

// Helper: Check if all players words are fully solved, or only one active player remains
function checkGameOver(room) {
  // Check active players count
  const activePlayers = room.players.filter(p => p.active);
  if (activePlayers.length === 0) return true;
  if (activePlayers.length === 1 && room.players.length > 1) {
    // If multiplayer and only 1 remains, end game
    return true;
  }

  // Check if all players' words are solved
  const allSolved = room.players.every(p => p.revealedMask.join('') === p.word);
  if (allSolved) return true;

  return false;
}

// Helper: Handle ending the game
function handleGameOver(room, hostDisconnected = false) {
  if (room.timerIntervalId) {
    clearInterval(room.timerIntervalId);
    room.timerIntervalId = null;
  }

  // Prepare final leaderboard
  const finalLeaderboard = [...room.players, ...room.exitedPlayers]
    .map(p => ({
      username: p.username,
      points: typeof p.points === 'number' ? p.points : 0,
      profilePic: p.profilePic || null
    }))
    .sort((a, b) => b.points - a.points);

  console.log(`Game over in room ${room.roomId}. Leaderboard:`, finalLeaderboard);

  io.to(room.roomId).emit('game_over_leaderboard', { 
    leaderboard: finalLeaderboard,
    hostDisconnected
  });
  
  // Clean up room memory
  rooms.delete(room.roomId);
}

// Helper: Handle player exits or socket disconnects
function handleExiting(socket) {
  const roomId = socket.roomId;
  const userId = socket.userId;
  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  
  const isHost = (userId === room.hostUser.id || socket.id === room.spectatorHostId);

  // If the host leaves
  if (isHost) {
    console.log(`Host ${room.hostUser?.username || 'unknown'} left room ${roomId}. Ending game/lobby.`);
    
    if (room.started) {
      // Game started: end game immediately with hostDisconnected = true
      handleGameOver(room, true);
    } else {
      // Game not started (lobby): notify players lobby closed and cleanup
      io.to(roomId).emit('lobby_closed', 'Host disconnected. Room closed.');
      if (room.timerIntervalId) clearInterval(room.timerIntervalId);
      rooms.delete(roomId);
    }
    
    socket.leave(roomId);
    return;
  }

  // Find player
  const playerIndex = room.players.findIndex(p => p.id === userId);
  if (playerIndex !== -1) {
    const player = room.players[playerIndex];
    console.log(`Player ${player.username} exited room ${roomId}`);
    
    player.active = false;
    
    // Remove from active players list
    room.players.splice(playerIndex, 1);
    socket.leave(roomId);

    // If game has started, adjust turn indices and check game state
    if (room.started) {
      // Add to exited players history for leaderboard record only if the game has started
      room.exitedPlayers.push({
        id: player.id,
        username: player.username,
        points: 'Disconnected/Exited',
        active: false
      });

      room.lastGuessMessage = `<span class="guess-msg-timeout">${player.username} has disconnected/left the game.</span>`;
      
      // If it was their turn, adjust or advance turn index
      if (room.turnIndex >= room.players.length) {
        room.turnIndex = 0;
      }
      
      if (checkGameOver(room)) {
        handleGameOver(room);
      } else {
        nextTurn(roomId);
      }
    } else {
      // If game has not started, just update the lobby list
      io.to(roomId).emit('lobby_update', getLobbyState(room));
    }
  }

  // Cleanup room if entirely empty
  if (room.players.length === 0 && !room.spectatorHostId) {
    if (room.timerIntervalId) clearInterval(room.timerIntervalId);
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted as it is empty.`);
  }
}

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const hostIp = getLocalIpAddress();
  console.log('\n======================================================');
  console.log(`WordHunt server running locally at: http://localhost:${PORT}`);
  console.log(`To play on OTHER devices (e.g. mobile/iPhone, laptop):`);
  console.log(`Open: http://${hostIp}:${PORT}`);
  console.log('======================================================\n');
});
