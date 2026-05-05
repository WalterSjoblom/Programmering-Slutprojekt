
const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");


const STATE = {
    START:          "start",
    PLAYING:        "playing",
    LEVEL_COMPLETE: "level_complete",
    GAME_OVER:      "game_over"
};


let gameState = STATE.START;

let currentLevel = 0;
let score        = 0;
let lives        = 3;


const keys = {};

document.addEventListener("keydown", e => {
    keys[e.code] = true;


    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
    }


    if ((e.code === "Space" || e.code === "Enter") && gameState === STATE.START) {
        startGame();
    }

    if (e.code === "Enter" && gameState === STATE.LEVEL_COMPLETE) {
        nextLevel();
    }


    if (e.code === "Enter" && gameState === STATE.GAME_OVER) {
        resetGame();
    }
});

document.addEventListener("keyup", e => {
    keys[e.code] = false;
});


function startGame() {
    currentLevel = 0;
    score        = 0;
    lives        = 3;
    gameState    = STATE.PLAYING;
    // loadLevel(currentLevel) – läggs till i steg 2
}

function nextLevel() {
    currentLevel++;
    gameState = STATE.PLAYING;
    // loadLevel(currentLevel) – läggs till i steg 2
}

function resetGame() {
    gameState = STATE.START;
}


function update() {
    if (gameState !== STATE.PLAYING) return;
senare
}

function render() {

    ctx.fillStyle = "#16213e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === STATE.START) {
        // Rita en enkel startskärm som bekräftar att allt fungerar
        ctx.textAlign = "center";
        ctx.fillStyle = "#f1c40f";
        ctx.font      = "bold 40px Courier New";
        ctx.fillText("Pink Monster Adventure", canvas.width / 2, 200);

        ctx.fillStyle = "white";
        ctx.font      = "20px Courier New";
        ctx.fillText("Tryck Enter eller Mellanslag för att börja", canvas.width / 2, 280);

        ctx.textAlign = "left";
        return; // Rita inget mer på startskärmen
    }

    if (gameState === STATE.PLAYING) {

        ctx.fillStyle = "white";
        ctx.font      = "18px Courier New";
        ctx.fillText(`Nivå: ${currentLevel + 1}   Poäng: ${score}   Liv: ${lives}`, 16, 30);

        ctx.fillStyle = "#aaa";
        ctx.font      = "16px Courier New";
        ctx.textAlign = "center";
        ctx.fillText("(Spelet renderas här – plattformar och spelare läggs till i steg 2)", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
    }
}


function gameLoop() {
    try {
        update();
        render();
    } catch (err) {
        console.error("Spelfel:", err);
    }
    requestAnimationFrame(gameLoop);
}

gameLoop();