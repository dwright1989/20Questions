
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
let hasGuessedThisTurn = false;
let lastTurnId = null;

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


// Function to start a new game (host)
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

  db.ref(`games/${gameCode}/guesses`).remove();

  // Start listening for changes in player list and current turn
  console.log("about to listen to game state change from new game");
  listenToGameState();

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

// Function to join a game
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
        questionsLeft: 20,
        currentTurn: null,
        character: {}
      });

      // Save the key for later use
      localStorage.setItem("playerId", playerRef.key);
      localStorage.setItem("gameCode", code); // just in case

      joinArea.style.display = "none";
      hostScreen.classList.remove("active");
      playerScreen.classList.add("active");
      waitingScreen.style.display = "block";

      let hasStartedListening = false;
      // Listen for gameStarted state from Firebase
      db.ref(`games/${code}`).on('value', snapshot => {
        const gameData = snapshot.val() || {};
        if (gameData.gameStarted) {
          console.log("game started");
          document.getElementById("player-question-area").style.display = "block";
          document.getElementById("waiting-for-host").style.display = "none";
          const topic = gameData.topic || "Unknown"; // Default to "Unknown" if no topic is set
          document.getElementById("game-category").innerHTML = getTopicName(topic);
          document.getElementById("current-player-details").innerHTML = playerName;
          showOtherPlayersCharacters();
          console.log("about to listen to game state change from join game");


            // Only listen once!
            if (!hasStartedListening) {
              console.log("Player is now listening to game state changes");
              listenToGameState();
              hasStartedListening = true;
            }

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






// Function to start the game
function chooseTopic(topic) {
  gameStarted = true;
  // Set gameStarted to true and the first turn to the first player
  const playersRef = db.ref(`games/${gameCode}/players`);

  playersRef.once('value', snapshot => {
    const players = snapshot.val() || {};
    const firstPlayerId = Object.keys(players)[0]; // First player becomes the first to play

    // Update the currentTurn in Firebase
    db.ref(`games/${gameCode}`).update({
      gameStarted: true,
      topic: topic,
      currentTurn: firstPlayerId
    });
  });

  let topicTitle = getTopicName(topic);
  document.getElementById("choose-topic").style.display = "none";
  document.getElementById("game-area").style.display = "block";
  document.getElementById("chosen-category").style.display = "block";
  document.getElementById("chosen-category").innerHTML = topicTitle;
  assignPlayerCharacters(topic);
  listenToGameState();
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

function listenToGameState() {
  const gameCode = localStorage.getItem("gameCode");
  const currentPlayerId = localStorage.getItem("playerId");

  const gameRef = db.ref(`games/${gameCode}`);
  const playersRef = db.ref(`games/${gameCode}/players`);
  const guessesRef = db.ref(`games/${gameCode}/guesses`);

  // ✅ Attach currentGuessingPlayer listener separately
  if (hostScreen.classList.contains("active")) {
    gameRef.child("currentGuessingPlayer").on("value", (snapshot) => {
      const data = snapshot.val();
      const hostGuessArea = document.getElementById("host-guess-area");
      if (data && hostGuessArea) {
        hostGuessArea.innerHTML = `
          <h3>${data.playerName} is about to make a guess...</h3>
          <p>Waiting for their guess submission.</p>
        `;
      } else if (hostGuessArea) {
        hostGuessArea.innerHTML = "";
      }
    });
  }

  // 🔥 Then separately listen to main game state changes
  gameRef.on('value', snapshot => {
    const gameData = snapshot.val() || {};
    const currentTurnId = gameData.currentTurn;
    const gameStarted = gameData.gameStarted;

    if (currentTurnId) {
      playersRef.once('value', snapshot => {
        const players = snapshot.val() || {};
        const currentPlayer = players[currentTurnId];


        if (hostScreen.classList.contains("active")) {
          if (currentPlayer) {
            document.getElementById("current-turn").innerHTML = `<h3>It's ${currentPlayer.name}'s turn!</h3>`;
          }
        }
        if (lastTurnId !== currentTurnId) {
          hasGuessedThisTurn = false;
          lastTurnId = currentTurnId;
        }
        if (playerScreen.classList.contains("active")) {

        // Check if current player has won
        const thisPlayer = players[currentPlayerId];
        if (thisPlayer && thisPlayer.win) {
          // Show win message and hide rest of interface
          document.getElementById("player-turn").innerHTML = `<h2>🎉 You guessed correctly and won! 🎉</h2>`;
          document.getElementById("answer-turn-area").style.display = "none";
          document.getElementById("player-question-area").style.display = "none";
          document.getElementById("end-turn").style.display = "none";
          document.getElementById("guess-answer").style.display = "none";
          return; // skip further UI updates
        }

          if (currentPlayerId === currentTurnId) {
            document.getElementById("player-turn").innerHTML = `<h3>It's your turn, ${currentPlayer.name}!</h3>`;
             if (lastTurnId !== currentTurnId) {
                hasGuessedThisTurn = false;
                lastTurnId = currentTurnId;
              }
            if (!hasGuessedThisTurn) {
                document.getElementById("answer-turn-area").style.display = "block";
                document.getElementById("guess-answer").style.display = "block";
                 //  Force guess if only 1 question left
                  if (currentPlayer.questionsLeft <= 1) {
                    document.getElementById("end-turn").style.display = "none";
                  } else {
                    document.getElementById("end-turn").style.display = "block";
                  }
            }else{
                document.getElementById("answer-turn-area").style.display = "none";
                document.getElementById("end-turn").style.display = "none";
                document.getElementById("guess-answer").style.display = "none";
            }

            const endTurnButton = document.getElementById("end-turn");
            const guessAnswerButton = document.getElementById("guess-answer");

            if (endTurnButton && !endTurnButton.dataset.listenerAdded) {
              endTurnButton.addEventListener("click", () => {
                console.log("End turn button clicked.");
                reduceTheNumberOfQuestionsForPlayer(currentPlayerId);
                moveToNextTurn();
              });
              endTurnButton.dataset.listenerAdded = true;
            }

            if (guessAnswerButton && !guessAnswerButton.dataset.listenerAdded) {
              guessAnswerButton.addEventListener("click", () => {
                console.log("Player going to guess the answer.");
                 hasGuessedThisTurn = true;
                guessAnswer();
              });
              guessAnswerButton.dataset.listenerAdded = true;
            }
          } else {
            document.getElementById("player-turn").innerHTML = `<h3>It's ${currentPlayer.name}'s turn. Please wait...</h3>`;
            document.getElementById("end-turn").style.display = "none";
            document.getElementById("guess-answer").style.display = "none";
          }
        }
      });
    }

    if (gameStarted) {
      if (playerScreen.classList.contains("active")) {
        document.getElementById("player-question-area").style.display = "block";
        document.getElementById("waiting-for-host").style.display = "none";
      }
    }

    // Listen for player guesses and update the host screen
    guessesRef.on('child_added', snapshot => {
      const guessData = snapshot.val();
      displayGuessForVoting(guessData);
    });
  });

  // 🆕 Listen for player questionsLeft changes
  playersRef.on('value', snapshot => {
    const players = snapshot.val() || {};
    updateQuestionsLeftUI(players);
  });
}



function updateQuestionsLeftUI(players) {
  const hostQuestionsLeftArea = document.getElementById("host-questions-left");
  const playerQuestionsLeftArea = document.getElementById("player-questions-left");

  if (hostQuestionsLeftArea) {
    hostQuestionsLeftArea.innerHTML = "<h3>Questions Left:</h3>" +
      Object.values(players).map(player => `<p>${player.name}: ${player.questionsLeft} left</p>`).join('');
  }

  if (playerQuestionsLeftArea) {
    playerQuestionsLeftArea.innerHTML = "<h3>Questions Left:</h3>" +
      Object.values(players).map(player => `<p>${player.name}: ${player.questionsLeft} left</p>`).join('');
  }
}


function moveToNextTurn() {
  hasGuessedThisTurn = false;
  lastTurnId = null; // force reset so the new one is set on next tick
  console.log("test move to next turn");

  const gameCode = localStorage.getItem("gameCode");
  const playersRef = db.ref(`games/${gameCode}/players`);
  const gameRef = db.ref(`games/${gameCode}`);

  playersRef.once('value', playersSnapshot => {
    const players = playersSnapshot.val() || {};
    const playerIds = Object.keys(players);

    gameRef.once('value', gameSnapshot => {
      const gameData = gameSnapshot.val() || {};
      const currentTurnId = gameData.currentTurn;

      if (!currentTurnId) {
        console.error("No current turn found!");
        return;
      }

      const currentTurnIndex = playerIds.indexOf(currentTurnId);
      let nextTurnPlayerId = null;

      for (let i = 1; i <= playerIds.length; i++) {
        const nextIndex = (currentTurnIndex + i) % playerIds.length;
        const candidateId = playerIds[nextIndex];
        const candidate = players[candidateId];

        // Skip players who have won
        if (candidate && !candidate.win) {
          nextTurnPlayerId = candidateId;
          break;
        }
      }

      if (nextTurnPlayerId) {
        gameRef.update({
          currentTurn: nextTurnPlayerId
        });
        console.log(`Moved turn to player ID: ${nextTurnPlayerId}`);
      } else {
        console.log("No eligible players left to take a turn.");
        // Optionally handle end-of-game here
      }
    }); // <-- This closes gameRef.once
  }); // <-- This closes playersRef.once
}


function reduceTheNumberOfQuestionsForPlayer(currentTurnId){
    const gameCode = localStorage.getItem("gameCode");
    const currentPlayerRef = db.ref(`games/${gameCode}/players/${currentTurnId}`);
    currentPlayerRef.once('value', snapshot => {
      const currentPlayerData = snapshot.val();
      if (currentPlayerData && currentPlayerData.questionsLeft > 0) {
        currentPlayerRef.update({
          questionsLeft: currentPlayerData.questionsLeft - 1
        });
        console.log(`Reduced questions left for player ${currentTurnId}`);
      }
    });
}

function guessAnswer() {
  const gameCode = localStorage.getItem("gameCode");
  const playersRef = db.ref(`games/${gameCode}/players`);
  const gameRef = db.ref(`games/${gameCode}`);
  const currentPlayerId = localStorage.getItem("playerId");

  getPlayerNameFromId(currentPlayerId, (playerName) => {
    // 🔥 Clear any previous guesses before starting a new one
    db.ref(`games/${gameCode}/guesses`).remove().then(() => {
      // ✅ Then mark this player as the current guesser
      gameRef.update({
        currentGuessingPlayer: {
          playerId: currentPlayerId,
          playerName: playerName,
          updatedAt: Date.now()
        }
      });

      // Show guess form on player screen
      const guessFormHtml = `
        <h3>Your Guess</h3>
        <input type="text" id="guess-input" placeholder="Type your guess...">
        <button id="submit-guess">Submit Guess</button>
      `;

      document.getElementById("player-guess-area").innerHTML = guessFormHtml;
      document.getElementById("player-guess-area").style.display = "block";
      document.getElementById("answer-turn-area").style.display = "none";

      document.getElementById("submit-guess").addEventListener("click", () => {
        const guess = document.getElementById("guess-input").value.trim();
        if (!guess) return alert("Please enter a guess!");

        const guessRef = db.ref(`games/${gameCode}/guesses`).push();
        const guessId = guessRef.key;
        guessRef.set({
          id: guessId,
          playerId: currentPlayerId,
          guess: guess,
          timeSubmitted: firebase.database.ServerValue.TIMESTAMP
        });

        document.getElementById("player-guess-area").style.display = "none";
      });
    });
  });
}



function displayGuessForVoting(guessData) {
    if (!guessData || !guessData.guess || guessData.guess.trim() === "") return; // ignore empty guesses
  const guesserPlayerId = guessData.playerId; // <-- use the guesser's ID
  getPlayerNameFromId(guesserPlayerId, (playerName) => {
    let playerGuessName = playerName || "Unknown";

    const guessHtml = `
      <h3>Guess by ${playerGuessName}</h3>
      <p>${guessData.guess}</p>
      <button class="vote" data-vote="correct" data-guess-id="${guessData.id}" onClick="markGuess('correct', '${guesserPlayerId}')">Correct</button>
      <button class="vote" data-vote="incorrect" data-guess-id="${guessData.id}"  onClick="markGuess('incorrect', '${guesserPlayerId}')">Incorrect</button>
    `;
    document.getElementById("host-guess-area").innerHTML = guessHtml;

    const voteButtons = document.querySelectorAll(".vote");
    voteButtons.forEach(button => {
      button.addEventListener("click", (event) => {
        const vote = event.target.dataset.vote;
        const guessId = event.target.dataset.guessId;
        const gameCode = localStorage.getItem("gameCode");


      });
    });


  });
}

function markGuess(correctOrIncorrect, playerId){
    const gameCode = localStorage.getItem("gameCode");
    const playerRef = db.ref(`games/${gameCode}/players/${playerId}`);
     const guessesRef = db.ref(`games/${gameCode}/guesses`);

     console.log("the player: " + playerId + " was " + correctOrIncorrect);
    if(correctOrIncorrect === "correct"){
         db.ref(`games/${gameCode}/players/${playerId}`).update({ win: true });

          // Show winner UI
          showWinnerUI(playerId);
    }else{
      playerRef.once("value").then(snapshot => {
        const playerData = snapshot.val();
        reduceTheNumberOfQuestionsForPlayer(playerId);
        if (playerData && playerData.questionsLeft > 0) {
            playerRef.update({ win: true })
                 .then(() => {
                   console.log("Player marked as winner.");
                   // Optionally move to next turn if game continues
                   moveToNextTurn();
                 });
        } else {
          // TODO - you lose, you're out or something
          moveToNextTurn();
        }
        document.getElementById("host-guess-area").innerHTML = "";
        guessesRef.remove()
                .then(() => {
                  console.log("Guesses cleared.");
                  document.getElementById("host-guess-area").innerHTML = ""; // just in case
                })
                .catch(error => {
                  console.error("Failed to clear guesses:", error.message);
                });
            });
    }
     // 🧼 Always clear previous guesses
      guessesRef.remove();
}

function showWinnerUI(playerId) {
  getPlayerNameFromId(playerId, (playerName) => {
    const hostGuessArea = document.getElementById("host-guess-area");
    hostGuessArea.innerHTML = `
      <h3>🎉 ${playerName} has won! 🎉</h3>
      <button id="continue-game">Continue Game</button>
      <button id="end-game">End Game</button>
    `;

    document.getElementById("continue-game").addEventListener("click", () => {
      db.ref(`games/${gameCode}/players/${playerId}`).update({ eliminated: true }); // Optionally mark winner as done
      moveToNextTurn();
    });

    document.getElementById("end-game").addEventListener("click", () => {
      // Redirect or show a game over screen
      hostGuessArea.innerHTML = "<h3>Game Over. Thanks for playing!</h3>";
    });
  });
}


function getPlayerNameFromId(playerId, callback) {
   const gameCode = localStorage.getItem("gameCode");
   const playerRef = db.ref(`games/${gameCode}/players/${playerId}`);

   playerRef.once('value', snapshot => {
     if (snapshot.exists()) {
       const playerData = snapshot.val();
       console.log(playerData.name);
       callback(playerData.name); // call the callback with the name
     } else {
       console.log('Player not found.');
       callback(null);
     }
   });
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

