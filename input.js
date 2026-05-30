// input.js – hanterar all input från mus och tangentbord

// Mushantering
// getBoundingClientRect konverterar sidkoordinater till canvas-koordinater
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

canvas.addEventListener("mousemove", e => {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top)  * scaleY;
});

canvas.addEventListener("mousedown", e => {
    if (e.button === 0) {
        mouse.down = true;
        if (state !== STATE.PLAYING) startOrRestart();
    }
});

canvas.addEventListener("mouseup", e => {
    if (e.button === 0) mouse.down = false;
});

canvas.addEventListener("contextmenu", e => e.preventDefault());

// Tangentbordsinput
const keys = {};
document.addEventListener("keydown", e => { keys[e.code] = true;  });
document.addEventListener("keyup",   e => { keys[e.code] = false; });

document.addEventListener("keydown", e => {
    if (e.code === "Enter" && state !== STATE.PLAYING) startOrRestart();

    // Mellanslag aktiverar superkanonen om laddningen är full
    if (e.code === "Space" && state === STATE.PLAYING) {
        e.preventDefault();
        if (player.superReady && !player.superActive) {
            player.superActive = true;
            player.superTimer  = player.superDuration;
            player.superReady  = false;
            spawnParticles(player.x, player.y, "#f1c40f", 20);
        }
    }
});