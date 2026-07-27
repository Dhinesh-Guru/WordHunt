// Core Application Orchestration & Routing
const App = {
  activeExitHandler: null,
  aiLetterCount: 5,
  hostLetterCount: 5,

  init: () => {
    // Initialize Sub-Modules
    GameAI.init();
    GameMulti.init();

    // Listen for browser Back/Forward navigation buttons
    window.addEventListener('popstate', (e) => {
      const targetScreen = e.state?.screen || (Auth.currentUser ? 'screen-home' : 'screen-login');
      App.switchScreen(targetScreen, false);
    });

    // Check query params for reset password token
    const token = App.getResetTokenFromHash();
    if (token) {
      App.switchScreen('screen-reset-password');
    } else {
      // Check Auth Session
      const user = Auth.init();
      if (user) {
        App.updateProfileUI(user);
        
        // Restore AI Game if active
        if (GameAI.hasActiveSavedGame()) {
          GameAI.restoreSavedGame();
          if (window.location.hash === '#screen-game-ai') {
            App.switchScreen('screen-game-ai', false);
          } else {
            App.switchScreen('screen-home', false);
          }
        } else {
          App.switchScreen('screen-home', false);
        }
      } else {
        App.switchScreen('screen-login', false);
      }
    }

    // Bind Navigation & UI Buttons
    App.bindNavigationEvents();
    App.bindAuthEvents();
    App.bindGameSetupEvents();
  },

  getResetTokenFromHash: () => {
    const hash = window.location.hash || '';
    if (hash.startsWith('#reset-password')) {
      const match = hash.match(/token=([^&]+)/);
      return match ? match[1] : null;
    }
    return null;
  },

  // Screen Routing Switcher
  switchScreen: (screenId, pushHistory = true) => {
    // Hide all view screens
    const screens = document.querySelectorAll('.view-screen');
    screens.forEach(s => s.classList.add('hidden'));

    // Show selected view screen
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.remove('hidden');
    }

    // Update browser history state
    if (pushHistory && history.state?.screen !== screenId) {
      history.pushState({ screen: screenId }, '', '#' + screenId);
    }

    // Header Profile display control
    const headerProfile = document.getElementById('header-profile');
    const authScreens = ['screen-signup', 'screen-login', 'screen-forgot', 'screen-reset-password'];
    
    if (authScreens.includes(screenId) || !Auth.currentUser) {
      headerProfile.classList.add('hidden');
    } else {
      headerProfile.classList.remove('hidden');
    }
  },

  openOverlay: (overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.remove('hidden');
  },

  closeOverlay: (overlayId) => {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.add('hidden');
  },

  updateProfileUI: (user) => {
    document.getElementById('profile-display-username').textContent = user.username;
    document.getElementById('welcome-username').textContent = user.username;
    
    // Fill profile update inputs
    document.getElementById('profile-username').value = user.username;
    document.getElementById('profile-email').value = user.email;

    // Render profile pics in header and settings dialog
    const headerPic = document.getElementById('header-profile-pic');
    const headerIcon = document.getElementById('header-profile-icon');
    const previewPic = document.getElementById('profile-pic-preview');
    const previewIcon = document.getElementById('profile-pic-placeholder');
    const removeBtn = document.getElementById('profile-pic-remove-btn');

    if (user.profilePic) {
      // Header
      headerPic.src = user.profilePic;
      headerPic.classList.remove('hidden');
      headerIcon.classList.add('hidden');
      // Settings dialog preview
      previewPic.src = user.profilePic;
      previewPic.classList.remove('hidden');
      previewIcon.classList.add('hidden');
      removeBtn.classList.remove('hidden');
    } else {
      // Header
      headerPic.classList.add('hidden');
      headerIcon.classList.remove('hidden');
      // Settings dialog preview
      previewPic.classList.add('hidden');
      previewIcon.classList.remove('hidden');
      removeBtn.classList.add('hidden');
    }
  },

  // Confirmation Dialogue Wrapper
  requestExitConfirmation: (exitHandler) => {
    App.activeExitHandler = exitHandler;
    App.openOverlay('confirm-overlay');
  },

  bindNavigationEvents: () => {
    // Switch between Signup/Login/Forgot
    document.getElementById('link-to-login').addEventListener('click', (e) => {
      e.preventDefault();
      App.switchScreen('screen-login');
    });
    document.getElementById('link-to-signup').addEventListener('click', (e) => {
      e.preventDefault();
      App.switchScreen('screen-signup');
    });
    document.getElementById('link-forgot-password').addEventListener('click', (e) => {
      e.preventDefault();
      App.switchScreen('screen-forgot');
    });
    document.getElementById('forgot-to-signup').addEventListener('click', (e) => {
      e.preventDefault();
      App.switchScreen('screen-signup');
    });
    document.getElementById('forgot-to-login').addEventListener('click', (e) => {
      e.preventDefault();
      App.switchScreen('screen-login');
    });

    // Profile Trigger Modal
    document.getElementById('profile-trigger-btn').addEventListener('click', () => {
      App.openOverlay('profile-overlay');
    });
    document.getElementById('profile-close-btn').addEventListener('click', () => {
      App.closeOverlay('profile-overlay');
    });

    // Confirm Exit modal Yes/No
    document.getElementById('confirm-yes-btn').addEventListener('click', () => {
      App.closeOverlay('confirm-overlay');
      if (App.activeExitHandler) {
        App.activeExitHandler();
      }
    });
    document.getElementById('confirm-no-btn').addEventListener('click', () => {
      App.closeOverlay('confirm-overlay');
      App.activeExitHandler = null;
    });

    // Exit Game triggers
    document.getElementById('ai-exit-btn').addEventListener('click', () => {
      App.requestExitConfirmation(() => {
        GameAI.clearState();
        App.switchScreen('screen-home');
      });
    });

    document.getElementById('lobby-exit-btn').addEventListener('click', () => {
      App.requestExitConfirmation(() => {
        GameMulti.exitGame();
      });
    });

    document.getElementById('multi-exit-btn').addEventListener('click', () => {
      App.requestExitConfirmation(() => {
        GameMulti.exitGame();
      });
    });

    document.getElementById('spec-exit-btn').addEventListener('click', () => {
      App.requestExitConfirmation(() => {
        GameMulti.exitGame();
      });
    });

    document.getElementById('winner-exit-btn').addEventListener('click', () => {
      // No confirmation modal needed after game finishes
      GameMulti.exitGame();
    });

  },

  bindAuthEvents: () => {
    // Sign Up form submit
    const signupForm = document.getElementById('signup-form');
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email').value;
      const username = document.getElementById('signup-username').value;
      const password = document.getElementById('signup-password').value;
      const rePassword = document.getElementById('signup-repassword').value;
      const errorDiv = document.getElementById('signup-error');

      errorDiv.classList.add('hidden');

      try {
        await Auth.signup(email, username, password, rePassword);
        alert('Registration successful! Please login.');
        signupForm.reset();
        App.switchScreen('screen-login');
      } catch (err) {
        errorDiv.innerHTML = `<div>${err.message}</div>`;
        if (err.suggestions && err.suggestions.length > 0) {
          const sugChips = err.suggestions.map(s => `<button type="button" class="suggestion-chip" data-username="${s}">${s}</button>`).join(' ');
          errorDiv.innerHTML += `
            <div class="suggestions-wrapper" style="margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary);">
              <div style="margin-bottom: 6px; font-weight: 600;">Try these available usernames:</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">${sugChips}</div>
            </div>
          `;
        }
        errorDiv.classList.remove('hidden');

        // Add event listeners to suggestion chips
        const chips = errorDiv.querySelectorAll('.suggestion-chip');
        chips.forEach(chip => {
          chip.addEventListener('click', () => {
            document.getElementById('signup-username').value = chip.getAttribute('data-username');
            errorDiv.classList.add('hidden');
          });
        });
      }
    });

    // Login form submit
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('login-identifier').value;
      const password = document.getElementById('login-password').value;
      const errorDiv = document.getElementById('login-error');

      errorDiv.classList.add('hidden');

      try {
        const user = await Auth.login(identifier, password);
        App.updateProfileUI(user);
        loginForm.reset();
        App.switchScreen('screen-home');
      } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
      }
    });

    // Forgot Password submit
    const forgotForm = document.getElementById('forgot-form');
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value;
      const errorDiv = document.getElementById('forgot-error');
      const successDiv = document.getElementById('forgot-success');

      errorDiv.classList.add('hidden');
      successDiv.classList.add('hidden');

      try {
        const data = await Auth.forgotPassword(email);
        successDiv.textContent = data.message;
        successDiv.classList.remove('hidden');
        forgotForm.reset();

      } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
      }
    });

    // Reset password form submit
    const resetForm = document.getElementById('reset-password-form');
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('reset-new-password').value;
      const rePassword = document.getElementById('reset-confirm-password').value;
      const errorDiv = document.getElementById('reset-error');
      const successDiv = document.getElementById('reset-success');

      errorDiv.classList.add('hidden');
      successDiv.classList.add('hidden');

      const token = App.getResetTokenFromHash();
      if (!token) {
        errorDiv.textContent = 'Invalid or missing reset token.';
        errorDiv.classList.remove('hidden');
        return;
      }

      try {
        await Auth.resetPassword(token, password, rePassword);
        successDiv.textContent = 'Password reset successful! Redirecting to login...';
        successDiv.classList.remove('hidden');
        resetForm.reset();

        // Clear hash and redirect after delay
        setTimeout(() => {
          window.location.hash = '';
          App.switchScreen('screen-login');
        }, 1800);
      } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
      }
    });

    // Profile Picture Select
    const profilePicInput = document.getElementById('profile-pic-input');
    const previewPic = document.getElementById('profile-pic-preview');
    const previewIcon = document.getElementById('profile-pic-placeholder');
    const removeBtn = document.getElementById('profile-pic-remove-btn');

    profilePicInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Limit size to 200KB
      if (file.size > 204800) {
        alert('Image is too large. Max size is 200KB.');
        profilePicInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        App.selectedProfilePicBase64 = event.target.result;
        previewPic.src = App.selectedProfilePicBase64;
        previewPic.classList.remove('hidden');
        previewIcon.classList.add('hidden');
        removeBtn.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });

    // Profile Picture Remove
    removeBtn.addEventListener('click', () => {
      App.selectedProfilePicBase64 = ''; // empty string represents remove
      previewPic.classList.add('hidden');
      previewIcon.classList.remove('hidden');
      removeBtn.classList.add('hidden');
      profilePicInput.value = '';
    });

    // Profile Edit submit
    const profileForm = document.getElementById('profile-update-form');
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('profile-username').value;
      const email = document.getElementById('profile-email').value;
      const currentPassword = document.getElementById('profile-current-password').value;
      const newPassword = document.getElementById('profile-new-password').value;
      const msgDiv = document.getElementById('profile-message');

      msgDiv.classList.add('hidden');
      msgDiv.className = 'form-message'; // reset styling

      try {
        const updatedUser = await Auth.updateProfile(
          Auth.currentUser.id,
          username,
          email,
          currentPassword,
          newPassword,
          App.selectedProfilePicBase64
        );
        App.updateProfileUI(updatedUser);
        App.selectedProfilePicBase64 = undefined; // reset local state
        
        msgDiv.textContent = 'Profile updated successfully!';
        msgDiv.classList.add('form-success');
        msgDiv.classList.remove('hidden');
        
        // Reset password fields
        document.getElementById('profile-current-password').value = '';
        document.getElementById('profile-new-password').value = '';
      } catch (err) {
        msgDiv.textContent = err.message;
        msgDiv.classList.add('form-error');
        msgDiv.classList.remove('hidden');
      }
    });

    // Logout click
    document.getElementById('profile-logout-btn').addEventListener('click', () => {
      Auth.logout();
      App.closeOverlay('profile-overlay');
      App.switchScreen('screen-login');
    });
  },

  bindGameSetupEvents: () => {
    // VS AI Setup trigger
    document.getElementById('btn-vs-ai').addEventListener('click', () => {
      if (GameAI.hasActiveSavedGame()) {
        GameAI.restoreSavedGame();
        App.switchScreen('screen-game-ai');
      } else {
        App.aiLetterCount = 5;
        document.getElementById('ai-letter-count-box').textContent = App.aiLetterCount;
        App.openOverlay('ai-setup-overlay');
      }
    });

    document.getElementById('ai-setup-close-btn').addEventListener('click', () => {
      App.closeOverlay('ai-setup-overlay');
    });

    // Plus/Minus selector for VS AI
    document.getElementById('ai-minus-btn').addEventListener('click', () => {
      if (App.aiLetterCount > 5) {
        App.aiLetterCount--;
        document.getElementById('ai-letter-count-box').textContent = App.aiLetterCount;
      }
    });
    document.getElementById('ai-plus-btn').addEventListener('click', () => {
      if (App.aiLetterCount < 9) {
        App.aiLetterCount++;
        document.getElementById('ai-letter-count-box').textContent = App.aiLetterCount;
      }
    });

    // Start AI game click
    document.getElementById('ai-start-game-btn').addEventListener('click', () => {
      GameAI.clearState();
      App.closeOverlay('ai-setup-overlay');
      GameAI.startNewGame(App.aiLetterCount);
    });

    // VS Players Setup trigger
    document.getElementById('btn-vs-players').addEventListener('click', () => {
      // Hide sub forms, reset count
      document.getElementById('host-room-form').classList.add('hidden');
      document.getElementById('join-room-form').classList.add('hidden');
      App.hostLetterCount = 5;
      document.getElementById('host-letter-count-box').textContent = App.hostLetterCount;
      App.openOverlay('players-mode-overlay');
    });

    document.getElementById('players-mode-close-btn').addEventListener('click', () => {
      App.closeOverlay('players-mode-overlay');
    });

    // Collapsible Sub-menus
    document.getElementById('btn-host-menu').addEventListener('click', () => {
      document.getElementById('host-room-form').classList.remove('hidden');
      document.getElementById('join-room-form').classList.add('hidden');
      document.getElementById('host-error').classList.add('hidden');
    });
    document.getElementById('btn-join-menu').addEventListener('click', () => {
      document.getElementById('join-room-form').classList.remove('hidden');
      document.getElementById('host-room-form').classList.add('hidden');
      document.getElementById('join-error').classList.add('hidden');
    });

    // Plus/Minus selector for Host Room
    document.getElementById('host-minus-btn').addEventListener('click', () => {
      if (App.hostLetterCount > 5) {
        App.hostLetterCount--;
        document.getElementById('host-letter-count-box').textContent = App.hostLetterCount;
      }
    });
    document.getElementById('host-plus-btn').addEventListener('click', () => {
      if (App.hostLetterCount < 9) {
        App.hostLetterCount++;
        document.getElementById('host-letter-count-box').textContent = App.hostLetterCount;
      }
    });

    // Host room form submit
    const hostRoomForm = document.getElementById('host-room-form');
    hostRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const roomId = document.getElementById('host-room-id').value.trim();
      const password = document.getElementById('host-password').value;
      const spectate = document.getElementById('host-spectate-chk').checked;
      
      if (!roomId || !password) return;

      GameMulti.hostRoom(roomId, password, App.hostLetterCount, spectate);
      hostRoomForm.reset();
      App.closeOverlay('players-mode-overlay');
    });

    // Join room form submit
    const joinRoomForm = document.getElementById('join-room-form');
    joinRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const roomId = document.getElementById('join-room-id').value.trim();
      const password = document.getElementById('join-password').value;

      if (!roomId || !password) return;
      GameMulti.verifyRoom(roomId, password);
    });

    // Player input secret word form submit
    const wordForm = document.getElementById('player-word-form');
    wordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const word = document.getElementById('player-secret-word-input').value.trim().toLowerCase();
      const errorDiv = document.getElementById('player-word-error');
      
      errorDiv.classList.add('hidden');

      if (word.length !== GameMulti.wordLength) {
        errorDiv.textContent = `Word must be exactly ${GameMulti.wordLength} letters long.`;
        errorDiv.classList.remove('hidden');
        return;
      }

      if (!/^[a-z]+$/.test(word)) {
        errorDiv.textContent = 'Word must contain only English letters.';
        errorDiv.classList.remove('hidden');
        return;
      }

      // Quick check against loaded client-side words list
      if (isValidWord(word, GameMulti.wordLength)) {
        GameMulti.submitWord(word);
        wordForm.reset();
        return;
      }

      // If not in local cache, perform spinner pre-check
      const submitBtn = document.getElementById('player-word-submit-btn');
      const wordInput = document.getElementById('player-secret-word-input');
      const originalBtnHTML = submitBtn.innerHTML;

      // Show spinner & disable controls
      submitBtn.disabled = true;
      wordInput.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking word...';

      fetch(`/api/words/verify?word=${encodeURIComponent(word)}&length=${GameMulti.wordLength}`)
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            GameMulti.submitWord(word);
            wordForm.reset();
          } else {
            errorDiv.textContent = 'Invalid English word. Please enter a real word.';
            errorDiv.classList.remove('hidden');
          }
        })
        .catch(err => {
          console.error(err);
          errorDiv.textContent = 'Verification service error. Please try again.';
          errorDiv.classList.remove('hidden');
        })
        .finally(() => {
          // Restore button & input states
          submitBtn.disabled = false;
          wordInput.disabled = false;
          submitBtn.innerHTML = originalBtnHTML;
        });
    });

    // Player cancel input secret word (Back to lobby setup / home)
    document.getElementById('player-word-cancel-btn').addEventListener('click', () => {
      App.closeOverlay('player-word-overlay');
      GameMulti.exitGame();
    });

    // Lobby start game trigger
    document.getElementById('lobby-start-btn').addEventListener('click', () => {
      GameMulti.startGame();
    });
  }
};

// Initialize Application on load
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
