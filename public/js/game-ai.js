// AI Mode Game Module
const GameAI = {
  activeGameId: null,
  wordLength: 5,
  
  // Elements
  elWordDisplay: null,
  elGuessesCount: null,
  elFeedbackBox: null,
  elGuessInput: null,
  elGuessBtn: null,
  elWrongGuessesBox: null,

  init: () => {
    GameAI.elWordDisplay = document.getElementById('ai-word-display');
    GameAI.elGuessesCount = document.getElementById('ai-guesses-count');
    GameAI.elFeedbackBox = document.getElementById('ai-feedback-box');
    GameAI.elGuessInput = document.getElementById('ai-guess-input');
    GameAI.elGuessBtn = document.getElementById('ai-guess-btn');
    GameAI.elWrongGuessesBox = document.getElementById('ai-wrong-guesses-box');

    // Bind Event Listeners
    GameAI.elGuessBtn.addEventListener('click', GameAI.submitGuess);
    GameAI.elGuessInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') GameAI.submitGuess();
    });
  },

  startNewGame: async (letterCount) => {
    try {
      const response = await fetch('/api/ai/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterCount })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start AI game.');
      }

      // Initialize game state
      GameAI.activeGameId = data.gameId;
      GameAI.wordLength = data.wordLength;

      // Update UI
      GameAI.elGuessesCount.textContent = 'Number of guesses: 0';
      GameAI.elWordDisplay.textContent = data.maskedWord;
      GameAI.elFeedbackBox.innerHTML = '';
      GameAI.elWrongGuessesBox.textContent = '';
      GameAI.elGuessInput.value = '';

      // Switch screen
      App.switchScreen('screen-game-ai');
    } catch (error) {
      alert(error.message);
    }
  },

  submitGuess: async () => {
    const guess = GameAI.elGuessInput.value.trim().toLowerCase();
    if (!guess) return;

    if (!/^[a-z]+$/.test(guess)) {
      GameAI.showFeedback('Guesses must contain letters only.', 'red');
      return;
    }

    try {
      const response = await fetch('/api/ai/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: GameAI.activeGameId, guess })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit guess.');
      }

      // Update UI state
      GameAI.elGuessesCount.textContent = `Number of guesses: ${data.guesses}`;
      GameAI.elWordDisplay.textContent = data.maskedWord;
      GameAI.elWrongGuessesBox.textContent = data.wrongLetters;
      GameAI.elGuessInput.value = '';

      const username = Auth.currentUser?.username || 'You';
      
      // Update Correct/Wrong Guess feedback
      if (data.correct) {
        GameAI.showFeedback(`"${username}" guessed '${guess}' correctly`, 'green');
      } else {
        GameAI.showFeedback(`"${username}" guessed '${guess}' wrong`, 'red');
      }

      // Check win condition
      if (data.won) {
        setTimeout(() => {
          alert(`Congratulations! You guessed the word correctly in ${data.guesses} guesses!`);
          App.switchScreen('screen-home');
        }, 500);
      }
    } catch (error) {
      GameAI.showFeedback(error.message, 'red');
    }
  },

  showFeedback: (message, type) => {
    GameAI.elFeedbackBox.innerHTML = `<span class="guess-msg-${type}">${message}</span>`;
  }
};
