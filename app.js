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
  const joinUrl = "https://dwright1989.github.io/20Questions/index.html?join=" + gameCode;
  document.getElementById("game-code").innerHTML = `<h2>Game Code: ${gameCode}</h2><p>Or scan the QR to join!</p>`;
  document.getElementById("qr-container").style.display = "inline-block";

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

  const shownPlayers = new Set(); // Track already displayed players

  db.ref(`games/${gameCode}/players`).on('value', snapshot => {
    const players = snapshot.val() || {};
    const playerList = document.getElementById("player-list");

    // Update Start Game button visibility
    const hasPlayers = Object.keys(players).length > 0;
    document.getElementById("start-game-container").style.display = hasPlayers ? "block" : "none";

    // Don't reset the whole list — just append new ones
    Object.values(players).forEach(player => {
      if (!shownPlayers.has(player.name)) {
        shownPlayers.add(player.name);

        const p = document.createElement("p");
        p.textContent = player.name;
        p.classList.add("player-name", "player-entry"); // animate!

        playerList.appendChild(p);

        // Optional: remove animation class after it's done
        setTimeout(() => {
          p.classList.remove("player-entry");
        }, 500);
      }
    });
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

      // Start listening to this player's questionsLeft
      listenToCurrentPlayerQuestionsLeft();

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
          showOtherPlayersCharacters(code);
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



function showOtherPlayersCharacters(gameCode) {
    console.log("In showOtherPlayersCharacters");

   // const gameCode = localStorage.getItem("gameCode");  // Ensure gameCode is retrieved properly
    console.log("Game Code:", gameCode);  // Check if gameCode is set correctly
    const playersRef = firebase.database().ref(`games/${gameCode}/players`);
    const currentPlayerId = localStorage.getItem("playerId");
    const topic = localStorage.getItem("topic");
    console.log("playersRef: " + playersRef);

    playersRef.on('value', snapshot => {
        const players = snapshot.val() || {};
        let otherPlayersHtml = `
          <h3>Other Players' Characters:</h3>
          <div class="player-row">
        `;

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
        otherPlayersHtml += `</div>`;
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


function chooseType(type){
    const playersRef = db.ref(`games/${gameCode}/players`);
      localStorage.setItem("type", type);
      playersRef.once('value', snapshot => {
        db.ref(`games/${gameCode}`).update({
          type: type
        });
      });
      if(type==='hen'){
         document.getElementById("hen").style.display = "block";
      }else{
         document.getElementById("movie-tv").style.display = "block";
      }
       document.getElementById("choose-type").style.display = "none";
}

function goBackToChooseType(){
    document.getElementById("hen").style.display = "none";
    document.getElementById("movie-tv").style.display = "none";
    document.getElementById("choose-type").style.display = "flex";
}

// Function to start the game
function chooseTopic(topic) {
  gameStarted = true;
  let difficulty;
  const radios = document.querySelectorAll('input[name="difficulty"]');
    for (const radio of radios) {
      if (radio.checked) {
        difficulty =  radio.value;
      }
    }
    localStorage.setItem("difficulty", difficulty);
  // Set gameStarted to true and the first turn to the first player
  const playersRef = db.ref(`games/${gameCode}/players`);
  localStorage.setItem("topic", topic);
  playersRef.once('value', snapshot => {
    const players = snapshot.val() || {};
    const firstPlayerId = Object.keys(players)[0]; // First player becomes the first to play

    // Update the currentTurn in Firebase
    db.ref(`games/${gameCode}`).update({
      gameStarted: true,
      topic: topic,
      difficulty: difficulty,
      currentTurn: firstPlayerId
    });
  });

  let topicTitle = getTopicName(topic);
  document.getElementById("choose-topic").style.display = "none";
  document.getElementById("game-area").style.display = "block";
  document.getElementById("chosen-category").style.display = "block";
  document.getElementById("chosen-category").innerHTML = topicTitle;
  document.getElementById("topic-image").appendChild(getTopicImage(topic));
  assignPlayerCharacters(topic, difficulty, gameCode);
  listenToGameState();
}

function setTheme(topic) {
  const link = document.getElementById('theme-stylesheet');
  if (topic === 'cassie') {
    link.href = 'css/default.css';
  } else if (topic === 'horrorFilms') {
    link.href = 'css/default.css';
  } else {
    link.href = 'css/default.css';
  }
}




async function assignPlayerCharacters(topic, difficulty, gameCode) {
  //const gameCode = localStorage.getItem("gameCode");
  if (!gameCode) {
    console.error("Missing gameCode");
    return;
  }

  try {
    // Fetch characters from Firebase for the given topic
    const snapshot = await firebase.database().ref(`characters/${topic}`).once('value');
    const characters = snapshot.val();
    if (!characters) {
      throw new Error("No characters found for topic: " + topic);
    }

    // Convert characters to array and filter by difficulty
    let characterArray = Object.values(characters);

    const allowedDifficulties = {
      easy: ["easy"],
      medium: ["easy", "medium"],
      hard: ["easy", "medium", "hard"]
    };

    const validDifficulties = allowedDifficulties[difficulty] || ["easy"];
    characterArray = characterArray.filter(c => validDifficulties.includes(c.difficulty));

    if (characterArray.length === 0) {
      throw new Error(`No characters found for difficulty: ${difficulty}`);
    }

    const usedIndexes = new Set();

    // Fetch all players
    const playerSnap = await db.ref(`games/${gameCode}/players`).once('value');
    const players = playerSnap.val() || {};
    const updates = {};

    for (const playerId of Object.keys(players)) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * characterArray.length);
      } while (usedIndexes.has(randomIndex) && usedIndexes.size < characterArray.length);

      usedIndexes.add(randomIndex);
      const character = characterArray[randomIndex];

      updates[`games/${gameCode}/players/${playerId}/character`] = {
        name: character.name,
        image: `images/${topic}/${character.imageName}`
      };
    }

    await db.ref().update(updates);
    console.log("Characters assigned to all players.");
    showOtherPlayersCharacters(gameCode);

  } catch (error) {
    console.error("Error assigning characters:", error);
  }
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
      case "cassie":
      return "Cassie";
      break;
      case "horrorFilms":
      return "Horror Films";
      break;
      case "hotties":
      return "Hotties";
      break;
      default:
        return "Unknown";
    }
}

function getTopicImage(topic){
    const img = document.createElement("img");
    switch(topic){
        case "southPark":
            img.src = "images/south-park.png";
            img.alt = "South Park";
            img.style.maxWidth = "100px";
            break;
        case "friends":
            img.src = "images/friends.jfif";
            img.alt = "friends";
            img.style.maxWidth = "160px";
            img.classList.add("cute-image");
            break;
        case "cassie":
            img.src = "images/cassie.jpg";
            img.alt = "cassie";
            img.style.maxWidth = "130px";
            img.classList.add("cute-image");
            break;
        case "horrorFilms":
            img.src = "images/horror-films.jfif";
            img.alt = "Horror Films";
            img.style.maxWidth = "180px";
             img.classList.add("cute-image");
        case "hotties":
              img.src = "images/hotties.jpg";
             img.alt = "Hotties";
             img.style.maxWidth = "150px";
              img.classList.add("cute-image");
       default:
            img.alt="unknown";
    }
    return img;
}

function listenToGameState() {
  const gameCode = localStorage.getItem("gameCode");
  const currentPlayerId = localStorage.getItem("playerId");

  const gameRef = db.ref(`games/${gameCode}`);
  const playersRef = db.ref(`games/${gameCode}/players`);
  const guessesRef = db.ref(`games/${gameCode}/guesses`);

  // Listen for topic changes and apply theme
  gameRef.child("topic").on("value", (snapshot) => {
    const topic = snapshot.val();
    if (topic) {
      setTheme(topic);
    }
  });


  //  Attach currentGuessingPlayer listener separately
  if (hostScreen.classList.contains("active")) {
    gameRef.child("currentGuessingPlayer").on("value", (snapshot) => {
      const data = snapshot.val();
      const hostGuessArea = document.getElementById("host-guess-area");
      if (data && hostGuessArea) {
        hostGuessArea.innerHTML = `
          <h3>${data.playerName} is about to make a guess...</h3>
          <p>Waiting for their guess submission.</p>
        `;
        hostGuessArea.style.display = "block";
      } else if (hostGuessArea) {
        hostGuessArea.innerHTML = "";
        hostGuessArea.style.display = "none";
      }
    });
  }

  //  Then separately listen to main game state changes
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
            document.getElementById("current-turn").style.display = "inline-block";
            document.getElementById("current-turn").innerHTML = `<h3>It's ${currentPlayer.name}'s turn!</h3>`;
          }
        }
        if (lastTurnId !== currentTurnId) {
          gameRef.update({
              hasGuessedThisTurn: false
            });
            playersRef.child(currentTurnId).update({
            hasGuessedThisTurn: false
          });
          lastTurnId = currentTurnId;
        }
        if (playerScreen.classList.contains("active")) {

        // Check if current player has won
        const thisPlayer = players[currentPlayerId];
        if (thisPlayer && thisPlayer.win) {
          // Show win message and hide rest of interface
          document.getElementById("player-turn").innerHTML = `<h2>You guessed correctly and won!</h2>`;
          document.getElementById("answer-turn-area").style.display = "none";
          document.getElementById("player-question-area").style.display = "none";
          document.getElementById("end-turn").style.display = "none";
          document.getElementById("guess-answer").style.display = "none";
          return; // skip further UI updates
        }

          if (currentPlayerId === currentTurnId) {
            document.getElementById("player-turn").innerHTML = `<h3>It's your turn, ${currentPlayer.name}!</h3>`;
             if (lastTurnId !== currentTurnId) {
                gameRef.update({
                    hasGuessedThisTurn: false
                  });
                  playersRef.child(currentTurnId).update({
                              hasGuessedThisTurn: false
                            });
                lastTurnId = currentTurnId;
              }
            if (!currentPlayer.hasGuessedThisTurn) {
                document.getElementById("answer-turn-area").style.display = "flex";
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
                const currentPlayerId = localStorage.getItem("playerId");

                // Set hasGuessedThisTurn in both the root and the player object
                gameRef.update({
                  hasGuessedThisTurn: true
                });

                playersRef.child(currentPlayerId).update({
                  hasGuessedThisTurn: true
                });

                guessAnswer(); // Show the guess input etc.
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

  //  Listen for player questionsLeft changes
  playersRef.on('value', snapshot => {
    const players = snapshot.val() || {};
    updateQuestionsLeftUI(players);
  });
}



function updateQuestionsLeftUI(players) {
  const hostQuestionsLeftArea = document.getElementById("host-questions-left");
  const playerQuestionsLeftArea = document.getElementById("player-questions-left");

  const generatePlayerStatus = (player) => {
  const questionsLeft = player.questionsLeft;
  let colorClass = '';
  // Change color based on questions left
      if (questionsLeft <= 2) {
        colorClass = 'few-questions'; // Red for 2 or less questions left
      } else if (questionsLeft <= 5) {
        colorClass = 'some-questions'; // Yellow for 3-5 questions left
      } else {
        colorClass = 'many-questions'; // Green for more than 5 questions left
      }
    if (player.win) {
      return `<p><span class="player-name winner">${player.name}</span>Winner!</p>`;
    } else {
      return `<p><span class="player-name">${player.name}</span><span class="questions-left ${colorClass}">${questionsLeft} left</span></p>`;
    }
  };

  if (hostQuestionsLeftArea) {
    hostQuestionsLeftArea.innerHTML = "<h3>Questions Left</h3>" +
      Object.values(players).map(generatePlayerStatus).join('');
  }

}


function moveToNextTurn() {
const gameCode = localStorage.getItem("gameCode");
  const playersRef = db.ref(`games/${gameCode}/players`);
  const gameRef = db.ref(`games/${gameCode}`);
  gameRef.update({
    hasGuessedThisTurn: false
  });

  lastTurnId = null; // force reset so the new one is set on next tick
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
        showScoreboard();
      }
    }); // <-- This closes gameRef.once
  }); // <-- This closes playersRef.once
}


function reduceTheNumberOfQuestionsForPlayer(currentTurnId) {
    const gameCode = localStorage.getItem("gameCode");
    const currentPlayerRef = db.ref(`games/${gameCode}/players/${currentTurnId}`);

    return currentPlayerRef.once('value').then(snapshot => {
        const currentPlayerData = snapshot.val();
        if (currentPlayerData && currentPlayerData.questionsLeft > 0) {
            return currentPlayerRef.update({
                questionsLeft: currentPlayerData.questionsLeft - 1
            }).then(() => {
                console.log(`Reduced questions left for player ${currentTurnId}`);
            });
        }
    });
}


function guessAnswer() {
const gameCode = localStorage.getItem("gameCode");
  const gameRef = db.ref(`games/${gameCode}`);
    const playersRef = db.ref(`games/${gameCode}/players`);
    const currentPlayerId = localStorage.getItem("playerId");
    getPlayerNameFromId(currentPlayerId, (playerName) => {
    // Clear any previous guesses before starting a new one
    db.ref(`games/${gameCode}/guesses`).remove().then(() => {
      // Then mark this player as the current guesser
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
        document.getElementById("answer-turn-area").style.display = "none";
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
      <div class="guess-text">${guessData.guess}</div>
      <div class="answer-buttons">
        <button class="vote correct-button" data-vote="correct" data-guess-id="${guessData.id}" onClick="markGuess('correct', '${guesserPlayerId}')"><i class="fa fa-check" style="color: #66b26"></i></button>
        <button class="vote incorrect-button" data-vote="incorrect" data-guess-id="${guessData.id}"  onClick="markGuess('incorrect', '${guesserPlayerId}')"><i class="fa fa-times" style="color: #ff66b3"></i></button>
      </div>
    `;
    document.getElementById("host-guess-area").innerHTML = guessHtml;
    document.getElementById("host-guess-area").display.style = "block";
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

function markGuess(correctOrIncorrect, playerId) {
    const gameCode = localStorage.getItem("gameCode");
    const playerRef = db.ref(`games/${gameCode}/players/${playerId}`);
    const guessesRef = db.ref(`games/${gameCode}/guesses`);

    console.log("The player: " + playerId + " was " + correctOrIncorrect);

    if (correctOrIncorrect === "correct") {
        showTemporaryMessageForGuess("Correct");
        playerRef.update({ win: true });
        showWinnerUI(playerId);
         updateHostScreenPlayerStatus(playerId, true);
    } else {
       playerRef.once("value").then(snapshot => {
           const playerData = snapshot.val();
           const playerName = playerData?.name || "A player";
           document.getElementById("host-guess-area").innerHTML = "";
           document.getElementById("host-guess-area").style.display = "none";
           showTemporaryMessageForGuess("Incorrect");

           return reduceTheNumberOfQuestionsForPlayer(playerId).then(() => {
               // Wait for the DB to update, then fetch the updated value
               return playerRef.once("value");
           }).then(updatedSnap => {
               const updatedData = updatedSnap.val();

               // Now check updated value
               if (updatedData && updatedData.questionsLeft > 0) {
                   console.log("moving to next turn");
                   moveToNextTurn();
               } else {
                   console.log("no questions left — showing incorrect screen then scoreboard");
                   showTemporaryMessageForGuess("Incorrect"); // your animated incorrect screen
                   setTimeout(() => {
                     showScoreboard();
                   }, 3000); // Wait 2 seconds before showing scoreboard
               }


               return guessesRef.remove()
                 .then(() => {
                     console.log("Guesses cleared.");
                     document.getElementById("host-guess-area").innerHTML = "";
                     document.getElementById("host-guess-area").style.display = "none";
                 })
                 .catch(error => {
                     console.error("Failed to clear guesses:", error.message);
                 });
           });
       });

    }

    // Check if the game should end after each guess
    checkIfGameShouldEnd();
}

function showTemporaryMessageForGuess(text, duration = 2000){
    if(text==="Correct"){
        const correctDiv = document.getElementById("correct");
        correctDiv.classList.add("show");
        const victorySound = document.getElementById("victory-sound");
          victorySound.currentTime = 0;
          victorySound.play().catch(e => console.warn("Autoplay failed:", e));

        correctDiv.innerHTML = "You win";
        const end = Date.now() + 1000;

         (function frame() {
           confetti({
             particleCount: 4,
             angle: 60,
             spread: 55,
             origin: { x: 0 },
           });
           confetti({
             particleCount: 4,
             angle: 120,
             spread: 55,
             origin: { x: 1 },
           });

           if (Date.now() < end) {
             requestAnimationFrame(frame);
           }
         })();

         setTimeout(() => {
            correctDiv.classList.remove("show");
          }, duration);
    }else{
        const incorrectDiv = document.getElementById("incorrect");
        incorrectDiv.classList.add("show");
        incorrectDiv.innerHTML = text;
        // 🔊 Play fail sound
          const failSound = document.getElementById("fail-sound");
          failSound.currentTime = 0;
          failSound.play().catch(e => console.warn("Autoplay failed:", e));
          setTimeout(() => {
             incorrectDiv.classList.remove("show");
             incorrectDiv.style.opacity = "0";              // 👈 force hide
             incorrectDiv.style.pointerEvents = "none";     // 👈 disable click layer
             incorrectDiv.textContent = "";                 // 👈 clear lingering text
           }, duration);
    }
}

function updateHostScreenPlayerStatus(playerId, hasWon) {
    const gameCode = localStorage.getItem("gameCode");
    const playersRef = db.ref(`games/${gameCode}/players`);

    playersRef.once('value').then(snapshot => {
        const players = snapshot.val() || {};
        const playerData = players[playerId];

        if (playerData) {
            const playerElement = document.getElementById(`player-${playerId}`);
            if (playerElement) {
                const playerName = playerData.name;
                const questionsLeft = playerData.questionsLeft;
                const winText = hasWon ? "🎉 Winner!" : `❌ ${questionsLeft} questions left`;

                // Update the player's status on the host screen
                playerElement.innerHTML = `${playerName} - ${winText}`;
            }
        }
    });
}

function listenToCurrentPlayerQuestionsLeft() {
console.log("Listening to current player's questions left...");
  const currentPlayerId = localStorage.getItem("playerId");
  const gameCode = localStorage.getItem("gameCode");
  const playerQuestionsLeftArea = document.getElementById("player-questions-left");

  if (!currentPlayerId || !playerQuestionsLeftArea) return;

  const currentPlayerRef = db.ref(`games/${gameCode}/players/${currentPlayerId}`);
console.log("gameCode " + gameCode + " currentplayerId: " + currentPlayerId);
  currentPlayerRef.on('value', snapshot => {
    const playerData = snapshot.val();
    if (playerData && typeof playerData.questionsLeft !== 'undefined') {
      playerQuestionsLeftArea.innerHTML = `<div>Questions Left: ${playerData.questionsLeft}</div>`;
    }
  });
}



function showWinnerUI(playerId) {
  const gameCode = localStorage.getItem("gameCode");
  const guessesRef = db.ref(`games/${gameCode}/guesses`);
  getPlayerNameFromId(playerId, (playerName) => {
    const hostGuessArea = document.getElementById("host-guess-area");
    hostGuessArea.innerHTML = `
      <div class="winner-announcement">
        <h2 class="flash-text"> ${playerName} has WON the game!</h2>
        <p class="subtext">They correctly guessed the answer. Absolute champion, gorgeous angel!</p>
        <div class="winner-buttons">
          <button id="continue-game" class="game-button">Continue Game</button>
          <button id="end-game" class="game-button">End Game</button>
        </div>
      </div>
    `;
    document.getElementById("current-turn").style.display = "none";
    hostGuessArea.style.display = "block";
    document.getElementById("continue-game").addEventListener("click", () => {
      db.ref(`games/${gameCode}/players/${playerId}`).update({ eliminated: true }); // Optionally mark winner as done
       guessesRef.remove()
       .then(() => {
           console.log("Guesses cleared.");
           document.getElementById("host-guess-area").innerHTML = "";
           document.getElementById("host-guess-area").style.display = "none";
       })
       .catch(error => {
           console.error("Failed to clear guesses:", error.message);
       });
      moveToNextTurn();
    });

    document.getElementById("end-game").addEventListener("click", () => {
     showScoreboard();
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
function showScoreboard() {
  console.log("show scoreboard");
  const gameCode = localStorage.getItem("gameCode");
  const playersRef = db.ref(`games/${gameCode}/players`);

  playersRef.once('value').then(snapshot => {
    const players = snapshot.val() || {};
    const list = document.getElementById("scoreboard-list");
    list.innerHTML = "";

    Object.entries(players).forEach(([id, player]) => {
      const li = document.createElement("li");
      li.classList.add("scoreboard-player");

      const character = player.character || {};
      const characterName = character.name || "No character";
      const characterImageURL = character.image || "placeholder.png";

      const nameDiv = document.createElement("div");
      nameDiv.classList.add("player-name");
      nameDiv.textContent = player.name;

      const statusDiv = document.createElement("div");
      statusDiv.classList.add("player-status");
      if (player.win) {
        li.classList.add("winner");
        statusDiv.textContent = `Winner! (${player.questionsLeft || 0} questions left)`;
      } else {
        statusDiv.textContent = `${player.questionsLeft || 0} questions left`;
      }

      const characterDiv = document.createElement("div");
      characterDiv.classList.add("player-character");

      const img = document.createElement("img");
      img.src = characterImageURL;
      img.alt = characterName;
      img.classList.add("scoreboard-avatar");

      const charNameEl = document.createElement("div");
      charNameEl.textContent = characterName;
      charNameEl.classList.add("character-name");

      characterDiv.appendChild(img);
      characterDiv.appendChild(charNameEl);

      li.appendChild(nameDiv);
      li.appendChild(statusDiv);
      li.appendChild(characterDiv);
      list.appendChild(li);
    });

    document.getElementById("scoreboard").style.display = "block";
    document.getElementById("host-screen").style.display = "none";

    // ✅ Add click listener *after* DOM is updated
    document.querySelectorAll(".scoreboard-avatar").forEach(img => {
      img.addEventListener("click", () => {
        const overlay = document.createElement("div");
        overlay.classList.add("image-overlay");

        const enlargedImg = document.createElement("img");
        enlargedImg.src = img.src;
        enlargedImg.alt = img.alt;

        overlay.appendChild(enlargedImg);
        document.body.appendChild(overlay);

        overlay.addEventListener("click", () => {
          overlay.remove();
        });
      });
    });
  });
}




function launchConfetti() {
  const container = document.getElementById("confetti-container");
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement("div");
    confetti.classList.add("confetti");
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.backgroundColor = pastelColor();
    confetti.style.animationDuration = (2 + Math.random() * 2) + "s";
    container.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, 4000);
  }
}

function pastelColor() {
  const pastelColors = ["#f48fb1", "#fce4ec", "#f8bbd0", "#e1bee7", "#d1c4e9", "#c8e6c9", "#fff9c4"];
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
}


function checkIfGameShouldEnd() {
  const gameCode = localStorage.getItem("gameCode");
  const playersRef = db.ref(`games/${gameCode}/players`);

  playersRef.once('value').then(snapshot => {
    const players = snapshot.val() || {};

    // Check if any player still has questions left
    const playersWithQuestionsLeft = Object.values(players).filter(player => player.questionsLeft > 0);

    // If no players have questions left, end the game
    if (playersWithQuestionsLeft.length === 0) {
      console.log("No players left with questions, ending the game...");
      endGame();  // Call your end game function
    }
  });
}


function endGame() {
  console.log("Ending game...");

  // Show final scoreboard
  showScoreboard();

  // Hide the host screen or display a message
  document.getElementById("host-screen").style.display = "none";
  document.getElementById("game-over-screen").style.display = "block";  // If you have a dedicated "game over" screen
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

