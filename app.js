
const firebaseConfig = {
  apiKey: "AIzaSyBIx9m2RspAUHiMtINd96VQdWaprH-8m24",
  authDomain: "quizapp-765f0.firebaseapp.com",
  databaseURL: "https://quizapp-765f0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "quizapp-765f0",
  storageBucket: "quizapp-765f0.appspot.com",
  messagingSenderId: "454149464659",
  appId: "1:454149464659:web:3e776c432ac2b4cb615ca6",
  measurementId: "G-4MKJ7T5YTQ"
};

firebase.initializeApp(firebaseConfig);
let isHost = false;
let gameStarted = false;
const db = firebase.database();

const hostScreen = document.getElementById("host-screen");
const hostStartScreen = document.getElementById("host-start-screen");
const playerScreen = document.getElementById("player-screen");
const joinArea = document.getElementById("join-container");
const codeInput = document.getElementById("code-input");
const playerNameInput = document.getElementById("player-name");
const questionArea = document.getElementById("question-area");
const playerList = document.getElementById("player-list");
const waitingScreen = document.getElementById("waiting-for-host");

let gameCode = "";

function generateGameCode() {
  return Math.random().toString(36).substr(2, 4).toUpperCase();
}

function startGame() {
   if(isHost){
       document.getElementById("host-question-area").style.display = "block";
       document.getElementById("choose-topic").style.display = "block";
       document.getElementById("host-start-screen").style.display = "none";
   }
}


function newGame() {
  gameStarted = false;
  isHost = true;
  gameCode = generateGameCode();
  const joinUrl = "https://dwright1989.github.io/quiz-time/index.html?join=" + gameCode;
  document.getElementById("game-code").innerHTML = `<h2>Game Code: ${gameCode}</h2><p>Or scan the QR to join!</p>`;

  new QRious({
    element: document.getElementById("qr-code"),
    value: joinUrl,
    size: 200
  });
    // Set up the game in Firebase with the gameStarted flag
    db.ref(`games/${gameCode}`).set({
      gameStarted: false,  // Initialize gameStarted to false
      players: {}
    });

  db.ref(`games/${gameCode}/players`).on('value', snapshot => {
    const players = snapshot.val() || {};
    playerList.innerHTML = `<h3>Players Joined:</h3>` +
      Object.values(players).map(player => `<p>${player.name}</p>`).join('');
    // Show Start Game button only if at least one player is present
    if (Object.keys(players).length > 0) {
      document.getElementById("start-game-container").style.display = "block";
    }
  });

}

function joinGame() {
  const code = codeInput.value.trim().toUpperCase();
  const name = playerNameInput.value.trim();
  if (!name) return alert("Please enter your name");

  db.ref(`games/${code}/players`).push({
    name: name,
    score: 0
  });
  joinArea.style.display = "none";

  gameCode = code;
  hostScreen.classList.remove("active");
  playerScreen.classList.add("active");
  waitingScreen.style.display = "block";

  // Listen for gameStarted state from Firebase
  db.ref(`games/${gameCode}`).on('value', snapshot => {
    const gameData = snapshot.val() || {};
    if (gameData.gameStarted) {
      // Once gameStarted is true, the player can start seeing questions
      document.getElementById("player-question-area").style.display = "block";
      document.getElementById("waiting-for-host").style.display = "none";
    }
  });

}

function chooseTopic(topic){
    gameStarted = true;
     // Set gameStarted to true in Firebase
     db.ref(`games/${gameCode}`).update({ gameStarted: true });
    let topicTitle;
    if(topic=="south-park"){
        topicTitle = "South Park";
    }
    console.log("topic title: " + topicTitle);
    document.getElementById("choose-topic").style.display = "none";
    document.getElementById("game-area").style.display = "block";
    document.getElementById("chosen-category").style.display = "block";
    document.getElementById("chosen-category").innerHTML = topicTitle;

    assignPlayerCharacters(topic);
}

function assignPlayerCharacters(topic){

}

// Auto-join via ?join=CODE
window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("join");
  if (code && codeInput) {
    hostScreen.classList.remove("active");
    joinArea.classList.add("active");
    playerScreen.classList.add("active");
    codeInput.value = code;
  }
});
