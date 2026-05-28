// Monster Shooter – top-down shooter
// Spelaren rör sig med WASD, siktar med musen och skjuter med vänsterklick.

const canvas = document.getElementById("c");
const ctx    = canvas.getContext("2d");

// Spelstillstånd
const STATE = { START: 0, PLAYING: 1, GAME_OVER: 2 };
let state     = STATE.START;
let highscore = parseInt(localStorage.getItem("shooterHS") || "0");

// Hjärtspritesheet
// sprite.png har 3 frames (varje frame = 300×300px):
// Frame 0 = fullt hjärta, frame 1 = halvt, frame 2 = tomt
const heartImg = new Image();
heartImg.src = "bilder/sprite.png";

// Varje hjärta har sin egen animationsstatus
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

// Spritesheet för spelaren (idle och run)
const sprites = {
    idle: { img: new Image(), frames: 4, loaded: false },
    run:  { img: new Image(), frames: 6, loaded: false },
};

const SPRITE_BASE = "sprites/1 Pink_Monster/";
sprites.idle.img.src = SPRITE_BASE + "Pink_Monster_Idle_4.png";
sprites.run.img.src  = SPRITE_BASE + "Pink_Monster_Run_6.png";
for (const key in sprites) {
    sprites[key].img.onload = () => { sprites[key].loaded = true; };
}

// Tangentbordsinput
const keys = {};
document.addEventListener("keydown", e => { keys[e.code] = true;  });
document.addEventListener("keyup",   e => { keys[e.code] = false; });

// Spelaren
const player = {
    x: canvas.width  / 2,
    y: canvas.height / 2,
    r: 18,
    speed: 3.5,
    lives: 3,

    aimAngle: 0,

    shootCooldown: 0,
    shootRate:    14,

    invincible:       false,
    invincibleTimer:  0,
    invincibleDur:    90,

    frameIndex:    0,
    frameTimer:    0,
    frameDelay:    7,
    currentSprite: "idle",
    isMoving:      false,

    superCharge:    0,
    superMax:      10,
    superActive:   false,
    superTimer:    0,
    superDuration: 300,
    superReady:    false,

    reset() {
        this.x               = canvas.width  / 2;
        this.y               = canvas.height / 2;
        this.lives           = 3;
        this.invincible      = false;
        this.invincibleTimer = 0;
        this.shootCooldown   = 0;
        this.aimAngle        = 0;
        this.frameIndex      = 0;
        this.superCharge     = 0;
        this.superActive     = false;
        this.superTimer      = 0;
        this.superReady      = false;
    },

    update() {
        let dx = 0, dy = 0;
        if (keys["ArrowLeft"]  || keys["KeyA"]) dx -= 1;
        if (keys["ArrowRight"] || keys["KeyD"]) dx += 1;
        if (keys["ArrowUp"]    || keys["KeyW"]) dy -= 1;
        if (keys["ArrowDown"]  || keys["KeyS"]) dy += 1;

        // Normalisera diagonal rörelse så spelaren inte rör sig snabbare diagonalt
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

        this.x += dx * this.speed;
        this.y += dy * this.speed;
        this.x  = Math.max(this.r, Math.min(canvas.width  - this.r, this.x));
        this.y  = Math.max(this.r, Math.min(canvas.height - this.r, this.y));
        this.isMoving = (dx !== 0 || dy !== 0);

        // atan2 ger vinkeln i radianer mot musen – används för rotation och kulriktning
        this.aimAngle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        if (this.superActive) {
            this.superTimer--;
            if (this.superTimer <= 0) {
                this.superActive = false;
                this.superCharge = 0;
            }
        }

        const activeCooldown = this.superActive ? 4 : this.shootRate;
        this.shootCooldown--;
        if (mouse.down && this.shootCooldown <= 0) {
            this.shoot();
            this.shootCooldown = activeCooldown;
        }

        if (this.invincible) {
            this.invincibleTimer++;
            if (this.invincibleTimer >= this.invincibleDur) {
                this.invincible = false;
            }
        }

        this.currentSprite = this.isMoving ? "run" : "idle";
        this.frameTimer++;
        if (this.frameTimer >= this.frameDelay) {
            this.frameTimer = 0;
            this.frameIndex = (this.frameIndex + 1) % sprites[this.currentSprite].frames;
        }
    },

    shoot() {
        if (this.superActive) {
            // Superläge: tre kulor med spridning (0.22 rad ≈ 13° åt varje håll)
            const spread = 0.22;
            for (let i = -1; i <= 1; i++) {
                const angle = this.aimAngle + i * spread;
                bullets.push({
                    x:       this.x + Math.cos(this.aimAngle) * (this.r + 8),
                    y:       this.y + Math.sin(this.aimAngle) * (this.r + 8),
                    vx:      Math.cos(angle) * 12,
                    vy:      Math.sin(angle) * 12,
                    r:       7,
                    life:    70,
                    isSuper: true
                });
            }
        } else {
            bullets.push({
                x:       this.x + Math.cos(this.aimAngle) * (this.r + 8),
                y:       this.y + Math.sin(this.aimAngle) * (this.r + 8),
                vx:      Math.cos(this.aimAngle) * 10,
                vy:      Math.sin(this.aimAngle) * 10,
                r:       5,
                life:    65,
                isSuper: false
            });
        }
    },

    hit() {
        if (this.invincible) return;
        this.lives--;
        // this.lives är nu antal kvar, dvs. indexet på det förlorade hjärtat
        triggerHeartAnim(this.lives);
        this.invincible      = true;
        this.invincibleTimer = 0;
        spawnParticles(this.x, this.y, "#ff6ec7", 10);
        if (this.lives <= 0) {
            if (score > highscore) {
                highscore = score;
                localStorage.setItem("shooterHS", highscore);
            }
            state = STATE.GAME_OVER;
        }
    },

    draw() {
        if (this.invincible && Math.floor(this.invincibleTimer / 5) % 2 === 0) return;

        const sprite      = sprites[this.currentSprite];
        const spriteReady = sprite && sprite.img.complete && sprite.img.naturalWidth > 0;
        const fw = 32, fh = 32;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.aimAngle);

        if (spriteReady) {
            ctx.drawImage(
                sprite.img,
                this.frameIndex * fw, 0, fw, fh,
                -this.r, -this.r, this.r * 2, this.r * 2
            );
        } else {
            // Fallback om sprites saknas
            ctx.fillStyle = "#ff6ec7";
            ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "white";
            ctx.fillRect( 4, -8, 6, 6);
            ctx.fillRect(-10, -8, 6, 6);
        }

        if (this.superActive) {
            ctx.shadowColor = "#f1c40f";
            ctx.shadowBlur  = 18;
            ctx.fillStyle = "#f39c12";
            ctx.fillRect(this.r - 4, -7, 22, 14);
            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(this.r + 14, -5, 10, 10);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(this.r - 4, -5, 18, 10);
            ctx.fillStyle = "#95a5a6";
            ctx.fillRect(this.r + 10, -4, 8, 8);
        }

        ctx.restore();

        if (this.superActive) {
            // Pulserande ring runt spelaren under superläget
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80);
            ctx.strokeStyle = `rgba(255, 200, 0, ${0.5 + pulse * 0.5})`;
            ctx.lineWidth   = 3 + pulse * 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r + 12 + pulse * 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
};

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

// Kulor
let bullets = [];

function updateBullets() {
    for (const b of bullets) { b.x += b.vx; b.y += b.vy; b.life--; }
    bullets = bullets.filter(b =>
        b.life > 0 &&
        b.x > -10 && b.x < canvas.width  + 10 &&
        b.y > -10 && b.y < canvas.height + 10
    );
}

function drawBullets() {
    for (const b of bullets) {
        if (b.isSuper) {
            ctx.shadowColor = "#ff6600";
            ctx.shadowBlur  = 14;
            ctx.fillStyle   = "rgba(255,100,0,0.3)";
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ff6600";
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ffcc00";
            ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "rgba(255,200,0,0.25)";
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#f1c40f";
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "white";
            ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// Fiender
// BasicEnemy: snabb, 1 HP. TankEnemy: långsam, 3 HP med HP-bar.
let enemies = [];

function spawnEnemies(wave) {
    const count = Math.min(4 + wave * 2, 14);
    for (let i = 0; i < count; i++) {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if      (side === 0) { x = Math.random() * canvas.width;  y = -30; }
        else if (side === 1) { x = canvas.width  + 30; y = Math.random() * canvas.height; }
        else if (side === 2) { x = Math.random() * canvas.width;  y = canvas.height + 30; }
        else                 { x = -30;                y = Math.random() * canvas.height; }

        const isTank = wave >= 2 && i % 3 === 0;
        enemies.push({
            x, y,
            r:      isTank ? 22  : 15,
            speed:  isTank ? 1.2 : 2.0 + wave * 0.15,
            hp:     isTank ? 3   : 1,
            maxHp:  isTank ? 3   : 1,
            points: isTank ? 30  : 10,
            isTank,
            hitFlash: 0
        });
    }
}

function updateEnemies() {
    for (const e of enemies) {
        const dx = player.x - e.x, dy = player.y - e.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        e.x += (dx / len) * e.speed;
        e.y += (dy / len) * e.speed;
        if (e.hitFlash > 0) e.hitFlash--;
    }
    enemies = enemies.filter(e => e.hp > 0);
}

function drawEnemies() {
    for (const e of enemies) {
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(angle);

        ctx.fillStyle = e.hitFlash > 0 ? "white" : (e.isTank ? "#8e44ad" : "#e74c3c");
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "white";
        ctx.fillRect( 4, -7, 6, 6); ctx.fillRect(-10, -7, 6, 6);
        ctx.fillStyle = "#111";
        ctx.fillRect( 6, -5, 3, 3); ctx.fillRect( -8, -5, 3, 3);

        ctx.fillStyle = e.isTank ? "#6c3483" : "#c0392b";
        ctx.fillRect(-7, 4, 14, 3);
        for (let i = 0; i < 4; i++) ctx.fillRect(-6 + i * 4, 7, 3, 4);

        ctx.restore();

        if (e.isTank) {
            const bw = e.r * 2.2;
            ctx.fillStyle = "#333";
            ctx.fillRect(e.x - e.r - 1, e.y - e.r - 12, bw + 2, 7);
            ctx.fillStyle = e.hp === 3 ? "#2ecc71" : e.hp === 2 ? "#f39c12" : "#e74c3c";
            ctx.fillRect(e.x - e.r, e.y - e.r - 11, bw * (e.hp / e.maxHp), 5);
        }
    }
}

// Partikeleffekter
let particles = [];

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 25 + Math.random() * 20,
            maxLife: 45,
            r: 2 + Math.random() * 3,
            color
        });
    }
}

function updateParticles() {
    for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.91; p.vy *= 0.91;
        p.life--;
    }
    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle   = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// Kollisionsdetektering
// Jämför avstånd² mot (r1+r2)² – undviker Math.sqrt för bättre prestanda
function circlesCollide(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy < (ar + br) ** 2;
}

function checkCollisions() {
    for (const b of bullets) {
        for (const e of enemies) {
            if (circlesCollide(b.x, b.y, b.r, e.x, e.y, e.r)) {
                b.life = 0;
                e.hp--;
                e.hitFlash = 6;
                if (e.hp <= 0) {
                    spawnParticles(e.x, e.y, e.isTank ? "#9b59b6" : "#e74c3c", e.isTank ? 14 : 7);
                    score += e.points;
                    const chargeGain = e.isTank ? 3 : 1;
                    if (!player.superActive) {
                        player.superCharge = Math.min(player.superMax, player.superCharge + chargeGain);
                        player.superReady  = (player.superCharge >= player.superMax);
                    }
                }
            }
        }
    }
    for (const e of enemies) {
        if (circlesCollide(player.x, player.y, player.r - 4, e.x, e.y, e.r)) {
            player.hit();
        }
    }
}

// Våghantering
let wave = 0, waveTimer = 0;

function updateWaves() {
    if (enemies.length === 0) {
        waveTimer++;
        if (waveTimer >= 90) { wave++; waveTimer = 0; spawnEnemies(wave); }
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

// Spelhantering
let score = 0;

function startOrRestart() {
    player.reset();
    bullets = []; enemies = []; particles = [];
    score = 0; wave = 0; waveTimer = 0;
    resetHearts();
    state = STATE.PLAYING;
}

document.addEventListener("keydown", e => {
    if (e.code === "Enter" && state !== STATE.PLAYING) startOrRestart();

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