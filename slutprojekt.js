
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
 

const STATE = {
    START: "start",
    PLAYING: "playing",
    LEVEL_COMPLETE: "level_complete",
    GAME_OVER: "game_over"
};
let gameState = STATE.START;