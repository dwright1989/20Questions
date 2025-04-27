
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
const auth = firebase.auth();

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

  // Use Firebase Authentication to sign in or create a user
  auth.signInAnonymously()
    .then(() => {
      const user = auth.currentUser; // Get current authenticated user
      const playerName = user.displayName || name; // Set the player name

      const playerRef = db.ref(`games/${code}/players`).push();
      playerRef.set({
        name: playerName,
        score: 0,
        character: {}
      });

      // Save the key for later use
      localStorage.setItem("playerId", playerRef.key);
      localStorage.setItem("gameCode", code); // just in case

      joinArea.style.display = "none";
      hostScreen.classList.remove("active");
      playerScreen.classList.add("active");
      waitingScreen.style.display = "block";

      // Listen for gameStarted state from Firebase
      db.ref(`games/${code}`).on('value', snapshot => {
        const gameData = snapshot.val() || {};
        if (gameData.gameStarted) {
          console.log("game started");
          document.getElementById("player-question-area").style.display = "block";
          document.getElementById("waiting-for-host").style.display = "none";
          const topic = gameData.topic || "Unknown"; // Default to "Unknown" if no topic is set
          document.getElementById("game-category").innerHTML = getTopicName(topic);
          showOtherPlayersCharacters();
        }
      });
    })
    .catch(error => {
      console.error("Error signing in anonymously:", error);
    });

    // Call this function after a player joins
    updatePlayerList(code);
}



function showOtherPlayersCharacters() {
    console.log("In showOtherPlayersCharacters");

    const gameCode = localStorage.getItem("gameCode");  // Ensure gameCode is retrieved properly
    console.log("Game Code:", gameCode);  // Check if gameCode is set correctly
    const playersRef = firebase.database().ref(`games/${gameCode}/players`);
    const currentPlayerId = localStorage.getItem("playerId");

    console.log("playersRef: " + playersRef);

    playersRef.on('value', snapshot => {
        const players = snapshot.val() || {};
        let otherPlayersHtml = "<h3>Other Players' Characters:</h3>";

        console.log("Players data: ", players);  // Debugging player data

        // Loop through the players and generate HTML for other players (excluding the current player)
        Object.keys(players).forEach(playerId => {
            const player = players[playerId];
            if (playerId !== currentPlayerId) {  // Skip showing the current player's character
                otherPlayersHtml += `
                  <div class="player">
                    <p><strong>${player.name}</strong></p>
                    <img src="${player.character.image}" alt="${player.character.name}" style="width: 100px; height: 100px;"/>
                    <p>${player.character.name}</p>
                  </div>
                `;
            }
        });

        console.log("Generated HTML:", otherPlayersHtml);

        // Update the HTML for the player screen
        const playerScreenContainer = document.getElementById("other-players-answers");
        if (playerScreenContainer) {
            playerScreenContainer.innerHTML = otherPlayersHtml;
        } else {
            console.error("Error: The element #other-players-answers does not exist on the player screen.");
        }
    });
}







function chooseTopic(topic){
    gameStarted = true;
     // Set gameStarted to true in Firebase
     db.ref(`games/${gameCode}`).update({ gameStarted: true, topic: topic });
    let topicTitle = getTopicName(topic);
    console.log("topic title: " + topicTitle);
    document.getElementById("choose-topic").style.display = "none";
    document.getElementById("game-area").style.display = "block";
    document.getElementById("chosen-category").style.display = "block";
    document.getElementById("chosen-category").innerHTML = topicTitle;
    assignPlayerCharacters(topic);
}

function assignPlayerCharacters(topic) {
  const gameCode = localStorage.getItem("gameCode");

  if (!gameCode) {
    console.error("Missing gameCode");
    return;
  }

  // Fetch characters from Firebase
  firebase.database().ref(`characters/${topic}`).once('value')
    .then(snapshot => {
      const characters = snapshot.val();
      if (!characters) {
        throw new Error("No characters found for topic: " + topic);
      }

      const characterArray = Object.values(characters);
      const usedIndexes = new Set(); // To prevent duplicates

      // Fetch all players
      return db.ref(`games/${gameCode}/players`).once('value').then(playerSnap => {
        const players = playerSnap.val() || {};
        const updates = {};

        Object.keys(players).forEach(playerId => {
          let randomIndex;
          do {
            randomIndex = Math.floor(Math.random() * characterArray.length);
          } while (usedIndexes.has(randomIndex) && usedIndexes.size < characterArray.length);

          usedIndexes.add(randomIndex);
          const character = characterArray[randomIndex];

          updates[`games/${gameCode}/players/${playerId}/character`] = {
            name: character.name,
            image: character.image
          };
        });

        // Apply all character assignments at once
        return db.ref().update(updates);
      });
    })
    .then(() => {
      console.log("Characters assigned to all players.");
      showOtherPlayersCharacters();
    })
    .catch(error => {
      console.error("Error assigning characters:", error);
    });
}



function updatePlayerList(code) {
console.log("Game Code:", code); // Ensure the gameCode is correct here
  db.ref(`games/${code}/players`).once('value', snapshot => {
    const players = snapshot.val() || {};
    playerList.innerHTML = `<h3>Players Joined:</h3>` +
      Object.values(players).map(player => `<p>${player.name}</p>`).join('');

    if (Object.keys(players).length > 0) {
      document.getElementById("start-game-container").style.display = "block";
    } else {
      document.getElementById("start-game-container").style.display = "none";
    }
  });
}


function getTopicName(topic){
    switch(topic) {
      case "southPark":
        return "South Park";
        break;
      case "friends":
        return "Friends";
        break;
      default:
        return "Unknown";
    }
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
