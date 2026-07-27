const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const bcrypt = require('bcryptjs');

let app;

// Initialize Firebase Admin SDK
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    app = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('Firebase Admin initialized from env variable.');
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', error);
  }
} else {
  // Local fallback
  try {
    const path = require('path');
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    app = initializeApp({
      credential: cert(require(serviceAccountPath))
    });
    console.log('Firebase Admin initialized from local serviceAccountKey.json.');
  } catch (error) {
    console.error('Firebase initialization error. Please ensure you placed serviceAccountKey.json in the database/ folder.', error);
  }
}

const firestore = getFirestore();
const usersCollection = firestore.collection('users');

const generateUsernameSuggestions = async (baseUsername) => {
  const base = baseUsername.trim();
  const suffixes = ['01', '123', '@1', '_42', '99', '007', '_pro', '2026', 'X', '_01'];
  const suggestions = [];
  for (const suffix of suffixes) {
    const candidate = `${base}${suffix}`;
    const query = await usersCollection.where('usernameLower', '==', candidate.toLowerCase()).get();
    if (query.empty) {
      suggestions.push(candidate);
      if (suggestions.length >= 3) break;
    }
  }
  return suggestions;
};

const db = {
  // Sign Up a user
  signup: async (email, username, password) => {
    // Check if email or username already exists
    const emailQuery = await usersCollection.where('emailLower', '==', email.toLowerCase()).get();
    if (!emailQuery.empty) {
      throw new Error('Email is already registered.');
    }

    const usernameQuery = await usersCollection.where('usernameLower', '==', username.toLowerCase()).get();
    if (!usernameQuery.empty) {
      const suggestions = await generateUsernameSuggestions(username);
      const err = new Error('Username is already taken.');
      err.suggestions = suggestions;
      throw err;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user document
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    await usersCollection.doc(userId).set({
      id: userId,
      email: email,
      emailLower: email.toLowerCase(),
      username: username,
      usernameLower: username.toLowerCase(),
      password: hashedPassword,
      profilePic: null,
      createdAt: new Date().toISOString()
    });

    return { id: userId, email, username, profilePic: null };
  },

  // Login a user
  login: async (identifier, password) => {
    let userDoc = null;
    const cleanIdentifier = identifier.trim().toLowerCase();

    // Query by email
    const emailQuery = await usersCollection.where('emailLower', '==', cleanIdentifier).get();
    if (!emailQuery.empty) {
      userDoc = emailQuery.docs[0];
    } else {
      // Query by username
      const usernameQuery = await usersCollection.where('usernameLower', '==', cleanIdentifier).get();
      if (!usernameQuery.empty) {
        userDoc = usernameQuery.docs[0];
      }
    }

    if (!userDoc) {
      throw new Error('Incorrect username/email or password.');
    }

    const user = userDoc.data();
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Incorrect username/email or password.');
    }

    return { id: user.id, email: user.email, username: user.username, profilePic: user.profilePic || null };
  },

  // Get user profile
  getUser: async (userId) => {
    const doc = await usersCollection.doc(userId).get();
    if (!doc.exists) {
      throw new Error('User not found.');
    }
    const user = doc.data();
    return { id: user.id, email: user.email, username: user.username, profilePic: user.profilePic || null };
  },

  // Update profile details
  updateProfile: async (userId, newUsername, newEmail, currentPassword, newPassword, profilePic) => {
    const docRef = usersCollection.doc(userId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('User not found.');
    }

    const user = doc.data();
    const updates = {};

    // If profile picture is provided or removed
    if (profilePic !== undefined) {
      updates.profilePic = profilePic;
    }

    // If email is changing, verify it is unique
    if (newEmail && newEmail.toLowerCase() !== user.email.toLowerCase()) {
      const emailQuery = await usersCollection.where('emailLower', '==', newEmail.toLowerCase()).get();
      const existingEmailDocs = emailQuery.docs.filter(d => d.id !== userId);
      if (existingEmailDocs.length > 0) {
        throw new Error('Email is already in use.');
      }
      updates.email = newEmail;
      updates.emailLower = newEmail.toLowerCase();
    }

    // If username is changing, verify it is unique
    if (newUsername && newUsername.toLowerCase() !== user.username.toLowerCase()) {
      const usernameQuery = await usersCollection.where('usernameLower', '==', newUsername.toLowerCase()).get();
      const existingUsernameDocs = usernameQuery.docs.filter(d => d.id !== userId);
      if (existingUsernameDocs.length > 0) {
        throw new Error('Username is already in use.');
      }
      updates.username = newUsername;
      updates.usernameLower = newUsername.toLowerCase();
    }

    // If password change is requested
    if (newPassword) {
      if (!currentPassword) {
        throw new Error('Current password is required to set a new password.');
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        throw new Error('Current password is incorrect.');
      }
      if (currentPassword === newPassword) {
        throw new Error("You can't use your old password as new password.");
      }
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(newPassword, salt);
    }

    // Apply updates in Firestore
    if (Object.keys(updates).length > 0) {
      await docRef.update(updates);
    }

    const finalDoc = await docRef.get();
    const finalUser = finalDoc.data();

    return { 
      id: finalUser.id, 
      email: finalUser.email, 
      username: finalUser.username, 
      profilePic: finalUser.profilePic || null 
    };
  },

  // Request password reset (Generates a token)
  requestPasswordReset: async (email) => {
    const emailQuery = await usersCollection.where('emailLower', '==', email.toLowerCase()).get();
    if (emailQuery.empty) {
      throw new Error('Email is not registered.');
    }

    const userDoc = emailQuery.docs[0];
    const token = 'token_' + Math.random().toString(36).substr(2, 15);
    const expires = Date.now() + 3600000; // 1 hour expiry

    await userDoc.ref.update({
      resetToken: token,
      resetTokenExpires: expires
    });

    return token;
  },

  // Reset password using token
  resetPassword: async (token, newPassword) => {
    const tokenQuery = await usersCollection.where('resetToken', '==', token).get();
    if (tokenQuery.empty) {
      throw new Error('Invalid or expired reset token.');
    }

    const userDoc = tokenQuery.docs[0];
    const user = userDoc.data();

    if (!user.resetTokenExpires || user.resetTokenExpires < Date.now()) {
      throw new Error('Invalid or expired reset token.');
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new Error("You can't use your old password as new password.");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await userDoc.ref.update({
      password: hashedPassword,
      resetToken: FieldValue.delete(),
      resetTokenExpires: FieldValue.delete()
    });

    return true;
  }
};

module.exports = db;
