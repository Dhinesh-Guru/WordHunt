// Authentication Service Modules
const Auth = {
  currentUser: null,

  // Check if user is logged in on load
  init: () => {
    const cached = localStorage.getItem('wordhunt_user');
    if (cached) {
      Auth.currentUser = JSON.parse(cached);
      return Auth.currentUser;
    }
    return null;
  },

  // Set user session
  setUser: (user) => {
    Auth.currentUser = user;
    localStorage.setItem('wordhunt_user', JSON.stringify(user));
  },

  // Clear user session
  logout: () => {
    Auth.currentUser = null;
    localStorage.removeItem('wordhunt_user');
  },

  // Signup API Call
  signup: async (email, username, password, rePassword) => {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password, rePassword })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed.');
    }
    return data;
  },

  // Login API Call
  login: async (identifier, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed.');
    }
    Auth.setUser(data.user);
    return data.user;
  },

  // Fetch updated profile
  fetchProfile: async (userId) => {
    const response = await fetch(`/api/auth/profile/${userId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch profile.');
    }
    return data.user;
  },

  // Update Profile API Call
  updateProfile: async (userId, username, email, currentPassword, newPassword, profilePic) => {
    const response = await fetch('/api/auth/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username, email, currentPassword, newPassword, profilePic })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update profile.');
    }
    Auth.setUser(data.user); // Sync local data
    return data.user;
  },

  // Request Reset Password API Call
  forgotPassword: async (email) => {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Password reset request failed.');
    }
    return data;
  },

  // Reset Password API Call
  resetPassword: async (token, password, rePassword) => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, rePassword })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Reset password failed.');
    }
    return data;
  }
};
