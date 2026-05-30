// game.js – HUD, hjärtanimation, bakgrund, spelhantering och game loop
// Måste laddas sist eftersom den startar game loop och använder allt annat

// Hjärtspritesheet
// sprite.png har 3 frames (varje frame = 300×300px):
// Frame 0 = fullt hjärta, frame 1 = halvt, frame 2 = tomt
const heartImg = new Image();
heartImg.src = "bilder/sprite.png";

const hearts = [
    { animFrame: 0, animTimer: 0, animating: false, lost: false },
    { animFrame: 0, animTimer: 0, animating: false, lost: false },
    { animFrame: 0, animTimer: 0, animating: false, lost: false },
];

// Hur många frames varje animationssteg visas
const HEART_ANIM_SPEED = 15;
const HEART_SIZE = 36;
const HEART_GAP  = 8;

// Startar hjärtanimationen för hjärtat som precis förlorades.
// livesLeft = liv kvar efter träffen = indexet på det förlorade hjärtat
function triggerHeartAnim(livesLeft) {
    const h = hearts[livesLeft];
    if (h) {
        h.animFrame = 0;
        h.animTimer = 0;
        h.animating = true;
        h.lost      = false;
    }
}

// Stegar igenom frames. När frame 2 är klar sätts lost=true och hjärtat försvinner
function updateHearts() {
    for (const h of hearts) {
        if (!h.animating) continue;
        h.animTimer++;
        if (h.animTimer >= HEART_ANIM_SPEED) {
            h.animTimer = 0;
            h.animFrame++;
            if (h.animFrame > 2) {
                h.animFrame = 2;
                h.animating = false;
                h.lost      = true;
            }
        }
    }
}

// Ritar hjärtana i HUD från höger
function drawHearts() {
    if (!heartImg.complete || heartImg.naturalWidth === 0) return;
    const frameW = 300, frameH = 300;
    for (let i = 0; i < hearts.length; i++) {
        const h = hearts[i];
        if (h.lost) continue;
        const x = canvas.width - 14 - (i + 1) * (HEART_SIZE + HEART_GAP);
        const y = 6;
        ctx.drawImage(
            heartImg,
            h.animFrame * frameW, 0, frameW, frameH,
            x, y, HEART_SIZE, HEART_SIZE
        );
    }
}

// Nollställer hjärtan vid omstart
function resetHearts() {
    for (const h of hearts) {
        h.animFrame = 0;
        h.animTimer = 0;
        h.animating = false;
        h.lost      = false;
    }
}

// Bakgrund – rutnät och radiell gradient för rymdkänsla
function drawBackground() {
    ctx.fillStyle = "#0d0d20";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const grd = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 50,
        canvas.width / 2, canvas.height / 2, 420
    );
    grd.addColorStop(0, "rgba(30,30,80,0.5)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth   = 1;
    for (let x = 0; x < canvas.width;  x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

// Sikesmarkör – ersätter OS-pekaren med ett hårkors
canvas.style.cursor = "none";

function drawCrosshair() {
    const x = mouse.x, y = mouse.y, size = 12, gap = 4;
    ctx.strokeStyle = mouse.down ? "#e74c3c" : "#f1c40f";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(x - size, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap,  y); ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap);  ctx.lineTo(x, y + size);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke();
}

// HUD – visar poäng, våg, hjärtan och supermätare
function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, 48);
    ctx.fillStyle = "white";
    ctx.font      = "bold 18px Courier New";
    ctx.textAlign = "left";
    ctx.fillText(`Poäng: ${score}`, 14, 30);
    ctx.textAlign = "center";
    ctx.fillText(`— Våg ${wave} —`, canvas.width / 2, 30);

    // Vit bakgrund bakom hjärtana
    const heartsW = hearts.length * (HEART_SIZE + HEART_GAP) + 8;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(canvas.width - 14 - heartsW, 2, heartsW, HEART_SIZE + 8);
    drawHearts();

    const barX = 14, barY = canvas.height - 36;
    const barW = 160, barH = 18;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX - 2, barY - 20, barW + 80, 38);

    ctx.fillStyle = player.superActive ? "#f1c40f" : (player.superReady ? "#f39c12" : "#aaa");
    ctx.font      = "bold 12px Courier New";
    ctx.textAlign = "left";
    ctx.fillText(
        player.superActive ? `SUPER AKTIV! ${Math.ceil(player.superTimer / 60)}s` :
        player.superReady  ? "SUPER REDO! [Mellanslag]" : "SUPERKANON",
        barX, barY - 4
    );

    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barW, barH);

    const fill = (player.superCharge / player.superMax) * barW;
    if (player.superActive) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100);
        ctx.fillStyle = `rgba(255, ${150 + pulse * 80}, 0, 1)`;
    } else {
        ctx.fillStyle = player.superReady ? "#f39c12" : "#e67e22";
    }
    ctx.fillRect(barX, barY, fill, barH);

    ctx.strokeStyle = player.superReady || player.superActive ? "#f1c40f" : "#555";
    ctx.lineWidth   = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    if (enemies.length > 0) {
        ctx.textAlign = "center"; ctx.fillStyle = "#e74c3c"; ctx.font = "13px Courier New";
        ctx.fillText(`Fiender kvar: ${enemies.length}`, canvas.width / 2, canvas.height - 10);
    } else if (state === STATE.PLAYING) {
        ctx.textAlign = "center"; ctx.fillStyle = "#2ecc71"; ctx.font = "13px Courier New";
        ctx.fillText(`Våg ${wave} klar! Nästa börjar snart...`, canvas.width / 2, canvas.height - 10);
    }
    ctx.textAlign = "left";
}

// Spelhantering – nollställer allt och startar spelet
function startOrRestart() {
    player.reset();
    bullets = []; enemies = []; particles = [];
    score = 0; wave = 0; waveTimer = 0;
    resetHearts();
    state = STATE.PLAYING;
}

// Game loop – anropas ~60 gånger per sekund av requestAnimationFrame
function gameLoop() {
    try {
        drawBackground();
        if (state === STATE.PLAYING) {
            player.update();
            updateBullets();
            updateEnemies();
            updateParticles();
            updateWaves();
            updateHearts();
            checkCollisions();
        }
        drawParticles();
        drawBullets();
        drawEnemies();
        if (state !== STATE.START) { player.draw(); drawHUD(); }
        drawCrosshair();

        if (state === STATE.START) {
            ctx.textAlign = "center";
            ctx.fillStyle = "#f1c40f"; ctx.font = "bold 44px Courier New";
            ctx.fillText("Monster Shooter", canvas.width / 2, 180);
            ctx.fillStyle = "white"; ctx.font = "18px Courier New";
            ctx.fillText("WASD – Rörelse", canvas.width / 2, 250);
            ctx.fillText("Mus – Sikta      Vänsterklick – Skjut", canvas.width / 2, 278);
            ctx.fillStyle = "#aaa"; ctx.font = "15px Courier New";
            ctx.fillText("🟥 Röd = 1 träff (10p)   🟣 Lila tank = 3 träffar (30p)", canvas.width / 2, 330);
            if (highscore > 0) {
                ctx.fillStyle = "#f39c12"; ctx.font = "16px Courier New";
                ctx.fillText(`Bästa: ${highscore} poäng`, canvas.width / 2, 375);
            }
            ctx.fillStyle = "#2ecc71"; ctx.font = "bold 20px Courier New";
            ctx.fillText("Klicka eller tryck Enter för att börja", canvas.width / 2, 440);
        }

        if (state === STATE.GAME_OVER) {
            ctx.fillStyle = "rgba(0,0,0,0.78)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.textAlign = "center";
            ctx.fillStyle = "#e74c3c"; ctx.font = "bold 52px Courier New";
            ctx.fillText("Game Over", canvas.width / 2, 200);
            ctx.fillStyle = "white"; ctx.font = "24px Courier New";
            ctx.fillText(`Poäng: ${score}   Våg: ${wave}`, canvas.width / 2, 262);
            ctx.fillStyle = "#f39c12";
            ctx.fillText(`Bästa: ${highscore}`, canvas.width / 2, 300);
            ctx.fillStyle = "#2ecc71"; ctx.font = "bold 19px Courier New";
            ctx.fillText("Klicka eller tryck Enter för att spela igen", canvas.width / 2, 375);
        }
    } catch(err) { console.error("Spelfel:", err); }
    requestAnimationFrame(gameLoop);
}

gameLoop();