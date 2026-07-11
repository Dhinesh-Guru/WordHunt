# 🎮 WordHunt - Real-time Multiplayer Word Game

WordHunt is a premium, real-time multiplayer word-finding game with a gorgeous glassmorphic dark theme. Play against an intelligent AI in training mode, or challenge your friends across devices from anywhere in the world!

---

## ✨ Features

- **🌐 Public Cloud Multiplayer**: Fully synchronized gameplay powered by **Socket.io** and hosted on the cloud.
- **🤖 Intelligent VS AI Mode**: Single-player practice mode with variable word lengths.
- **🔒 Secure Authentication**: Cloud-hosted accounts backed by **Firebase Firestore** and password encryption via **bcryptjs**.
- **🖼️ Profile Avatars**: Upload and synchronize custom profile pictures across the entire game (leaderboards, guessing grids, lobby, and victory podiums).
- **📋 Live Spectator View**: Hosts can spectate ongoing matches with live updates on guessed letters and points.
- **🏆 Interactive Winner Podium**: Gold, Silver, and Bronze victory pedestals for top players on the game-over screen.
- **📱 Fully Responsive**: Custom CSS Clamp configurations ensure all elements, inputs, and letter grids adapt perfectly to mobile, tablet, and desktop screens without text wrapping.

---

## 🎲 Rules & Scoring

### Game Modes
1. **VS AI Mode**: Choose a word size (5 to 9 letters) and try to guess the secret word selected by the computer.
2. **VS Players Mode**: Connect with friends. Each player submits a secret word. You must guess other players' words while they try to guess yours!

### Scoring Formulas
- **Correct Letter Guess**: `+3 points` *per occurrence revealed* (e.g., guessing `e` in "agree" awards `2 * 3 = 6` points).
- **Incorrect Letter Guess**: `-1 point`.
- **Solving the Word (Early)**: `not_guessed_letters * 3 + 2 points` (if at least 3 letters remained hidden).
- **Solving the Word (Late)**: `not_guessed_letters * 3 points` (if less than 3 letters remained hidden).
- **Incorrect Word Guess**: `-not_guessed_letters * 1 points`.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism design, CSS variables, CSS Clamp), JavaScript (ES6 Modules)
- **Backend**: Node.js, Express, Socket.io
- **Database**: Firebase Cloud Firestore
- **Security**: Cryptographic password hashing (`bcryptjs`)

---

## 🚀 Local Development Setup

To run WordHunt locally on your machine, follow these steps:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Dhinesh-Guru/WordHunt.git
cd WordHunt
npm install
```

### 2. Configure Firebase Credentials
1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** (keep Database ID as `(default)`).
3. Go to **Project Settings** ➔ **Service Accounts** and click **Generate new private key**.
4. Download the JSON key file, place it in the `database/` folder of your project, and rename it to **`serviceAccountKey.json`**.
*(Note: This file is ignored by Git in `.gitignore` to protect credentials).*

### 3. Run the App
```bash
npm start
```
The game will start on `http://localhost:3000`.

---

## ☁️ Cloud Deployment (Render / Railway)

To make the game publicly accessible online:

1. Connect your GitHub repository to a Cloud PaaS provider like **Render** or **Railway**.
2. Configure a **Web Service** with:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
3. Add these **Environment Variables**:
   - `PORT`: `3000`
   - `FIREBASE_SERVICE_ACCOUNT`: *(Paste the entire JSON string content of your local `serviceAccountKey.json` file).*

---

## 📝 License

This project is open-source and available under the MIT License. Developed with ❤️ by Dhinesh Guru.
