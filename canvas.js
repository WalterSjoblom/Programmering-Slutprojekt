// canvas.js – sätter upp canvas, spelstillstånd och delade variabler
// Måste laddas först eftersom alla andra filer använder canvas och ctx

const canvas = document.getElementById("c");
const ctx    = canvas.getContext("2d");

// Spelstillstånd – START innan spelet börjar, PLAYING under spel, GAME_OVER när man dör
const STATE = { START: 0, PLAYING: 1, GAME_OVER: 2 };
let state     = STATE.START;
let score     = 0;
let wave      = 0;
let waveTimer = 0;
let highscore = parseInt(localStorage.getItem("shooterHS") || "0");

// Delade listor som används av flera filer
let bullets   = [];
let enemies   = [];
let particles = [];