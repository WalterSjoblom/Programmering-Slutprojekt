
// MONSTER SHOOTER – Top-down shooter
// Spelaren rör sig med WASD, siktar med musen och skjuter
// med vänsterklick. Karaktären ritas med Pink Monster-spritesheet
// och roteras mot muspekaren varje frame.


const canvas = document.getElementById("c");
const ctx    = canvas.getContext("2d");

// ---- Spelstillstånd ----
const STATE = { START: 0, PLAYING: 1, GAME_OVER: 2 };
let state     = STATE.START;
let highscore = parseInt(localStorage.getItem("shooterHS") || "0");


// MUSHANTERING

// getBoundingClientRect() konverterar sidkoordinater till
// canvas-koordinater, nödvändigt om canvasen inte är i (0,0).
// mouseDown sätts true vid klick och används i update() för skott.

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


// SPRITESHEET-INLADDNING
// Använder Pink Monster idle- och run-spritesheet för spelaren.
// Spriten roteras mot musen varje frame med ctx.rotate().
// Om filerna saknas används en fallback-ritning istället.

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


// KEYBOARD INPUT

const keys = {};
document.addEventListener("keydown", e => { keys[e.code] = true;  });
document.addEventListener("keyup",   e => { keys[e.code] = false; });


// SPELARE

const player = {
    x: canvas.width  / 2,
    y: canvas.height / 2,
    r: 18,
    speed: 3.5,
    lives: 3,

    aimAngle: 0,          // Vinkel i radianer mot musen (beräknas med atan2)

    shootCooldown: 0,
    shootRate:    14,     // Frames mellan skott

    invincible:       false,
    invincibleTimer:  0,
    invincibleDur:    90,

    frameIndex:    0,
    frameTimer:    0,
    frameDelay:    7,
    currentSprite: "idle",
    isMoving:      false,

    // SUPERKANON
    // Laddas upp genom att döda fiender (superCharge ökas i checkCollisions).
    // När mätaren är full kan spelaren trycka Mellanslag för att aktivera.
    // Under superläget ökas skottfrekvensen kraftigt och kulorna är större.
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
        this.superCharge   = 0;
        this.superActive   = false;
        this.superTimer    = 0;
        this.superReady    = false;
    },

    update() {
        // ---- Rörelse ----
        let dx = 0, dy = 0;
        if (keys["ArrowLeft"]  || keys["KeyA"]) dx -= 1;
        if (keys["ArrowRight"] || keys["KeyD"]) dx += 1;
        if (keys["ArrowUp"]    || keys["KeyW"]) dy -= 1;
        if (keys["ArrowDown"]  || keys["KeyS"]) dy += 1;

        // Normalisera diagonal rörelse så att spelaren inte rör sig
        // snabbare diagonalt (sqrt(2) ~= 1.41x utan normalisering)
        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

        this.x += dx * this.speed;
        this.y += dy * this.speed;
        this.x  = Math.max(this.r, Math.min(canvas.width  - this.r, this.x));
        this.y  = Math.max(this.r, Math.min(canvas.height - this.r, this.y));
        this.isMoving = (dx !== 0 || dy !== 0);

        // ---- Sikte ----
        // atan2(dy, dx) returnerar vinkeln i radianer mellan spelarens
        // position och musen. Används för att rotera spriten och kulans riktning.
        this.aimAngle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

        // ---- Superkanon: räkna ner aktiv tid ----
        if (this.superActive) {
            this.superTimer--;
            if (this.superTimer <= 0) {
                // Superläget tar slut – återställ till normal skottfrekvens
                this.superActive = false;
                this.superCharge = 0;
            }
        }

        // ---- Skjut vid vänsterklick ----
        // Under superläget är shootRate 4x snabbare (5 vs 14 frames).
        // Vi väljer cooldown-värde baserat på om superläget är aktivt.
        const activeCooldown = this.superActive ? 4 : this.shootRate;
        this.shootCooldown--;
        if (mouse.down && this.shootCooldown <= 0) {
            this.shoot();
            this.shootCooldown = activeCooldown;
        }

        // ---- Oövervinnlighetstimer ----
        if (this.invincible) {
            this.invincibleTimer++;
            if (this.invincibleTimer >= this.invincibleDur) {
                this.invincible = false;
            }
        }

        // ---- Animationsframe ----
        this.currentSprite = this.isMoving ? "run" : "idle";
        this.frameTimer++;
        if (this.frameTimer >= this.frameDelay) {
            this.frameTimer = 0;
            this.frameIndex = (this.frameIndex + 1) % sprites[this.currentSprite].frames;
        }
    },

    shoot() {
        // Beräkna kulans hastighetsvektor från sikesvinkel
        if (this.superActive) {
            // Superläge: tre kulor i en spridning (spread shot).
            // Vi skjuter en rak kula och två lite vinklade åt sidan.
            // Spridningsvinkeln (0.2 rad ≈ 11°) ger bred täckning utan att
            // göra det för enkelt att träffa utan att sikta.
            const spread = 0.22;
            for (let i = -1; i <= 1; i++) {
                const angle = this.aimAngle + i * spread;
                bullets.push({
                    x:      this.x + Math.cos(this.aimAngle) * (this.r + 8),
                    y:      this.y + Math.sin(this.aimAngle) * (this.r + 8),
                    vx:     Math.cos(angle) * 12,
                    vy:     Math.sin(angle) * 12,
                    r:      7,       // Större kula under superläge
                    life:   70,
                    isSuper: true    // Flagga för speciell färg i drawBullets
                });
            }
        } else {
            // Normalt skott – en kula rakt mot musen
            bullets.push({
                x:    this.x + Math.cos(this.aimAngle) * (this.r + 8),
                y:    this.y + Math.sin(this.aimAngle) * (this.r + 8),
                vx:   Math.cos(this.aimAngle) * 10,
                vy:   Math.sin(this.aimAngle) * 10,
                r:    5,
                life: 65,
                isSuper: false
            });
        }
    },

    hit() {
        if (this.invincible) return;
        this.lives--;
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
        // Flytta origo till spelarens position och rotera mot musen.
        // Alla draw-anrop nedan ritas relativt det roterade koordinatsystemet.
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

        // Kanonpipa – bredare och guldglödande under superläge
        if (this.superActive) {
            // Glödande aura runt kanonpipan
            ctx.shadowColor = "#f1c40f";
            ctx.shadowBlur  = 18;
            ctx.fillStyle = "#f39c12";
            ctx.fillRect(this.r - 4, -7, 22, 14);   // Bredare pipa
            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(this.r + 14, -5, 10, 10);  // Bredare mynning
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(this.r - 4, -5, 18, 10);
            ctx.fillStyle = "#95a5a6";
            ctx.fillRect(this.r + 10, -4, 8, 8);
        }

        ctx.restore();

        // Glödande ring runt spelaren under superläget (ritas utan rotation)
        if (this.superActive) {
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80); // Pulserande effekt
            ctx.strokeStyle = `rgba(255, 200, 0, ${0.5 + pulse * 0.5})`;
            ctx.lineWidth   = 3 + pulse * 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r + 12 + pulse * 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
};


// SIKESMARKÖR (crosshair)
// Ersätter OS-pekaren med ett hårkors på canvasen.
// Färgen ändras till röd när man klickar.

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


// KULOR

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
            // Superkulor: orange med kraftigare glöd
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


// FIENDER
// BasicEnemy: rakt mot spelaren, 1 HP.
// TankEnemy:  långsammare, 3 HP med HP-bar, mer poäng.
// Spawnar från slumpmässig kant på canvasen.

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

        // Ögon roterade mot spelaren
        ctx.fillStyle = "white";
        ctx.fillRect( 4, -7, 6, 6); ctx.fillRect(-10, -7, 6, 6);
        ctx.fillStyle = "#111";
        ctx.fillRect( 6, -5, 3, 3); ctx.fillRect( -8, -5, 3, 3);

        // Tandad mun
        ctx.fillStyle = e.isTank ? "#6c3483" : "#c0392b";
        ctx.fillRect(-7, 4, 14, 3);
        for (let i = 0; i < 4; i++) ctx.fillRect(-6 + i * 4, 7, 3, 4);

        ctx.restore();

        // HP-bar för tankfiender (utanför rotation)
        if (e.isTank) {
            const bw = e.r * 2.2;
            ctx.fillStyle = "#333";
            ctx.fillRect(e.x - e.r - 1, e.y - e.r - 12, bw + 2, 7);
            ctx.fillStyle = e.hp === 3 ? "#2ecc71" : e.hp === 2 ? "#f39c12" : "#e74c3c";
            ctx.fillRect(e.x - e.r, e.y - e.r - 11, bw * (e.hp / e.maxHp), 5);
        }
    }
}


// PARTIKELEFFEKTER

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


// KOLLISION (cirkel mot cirkel)
// Jämför avstånd² mot (r1+r2)² – undviker Math.sqrt för prestanda.

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
                    // Öka superladdningen vid kill.
                    // Tankfiender ger 3 laddningspoäng eftersom de är svårare att döda.
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


// VÅGHANTERING

let wave = 0, waveTimer = 0;

function updateWaves() {
    if (enemies.length === 0) {
        waveTimer++;
        if (waveTimer >= 90) { wave++; waveTimer = 0; spawnEnemies(wave); }
    }
}


// BAKGRUND

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


// HUD
// Visar poäng, våg, liv och superladdningsmätaren.

function drawHUD() {
    // Övre remsa
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, 48);
    ctx.fillStyle = "white";
    ctx.font      = "bold 18px Courier New";
    ctx.textAlign = "left";
    ctx.fillText(`Poäng: ${score}`, 14, 30);
    ctx.textAlign = "center";
    ctx.fillText(`— Våg ${wave} —`, canvas.width / 2, 30);
    ctx.textAlign = "right";
    ctx.font      = "20px Arial";
    for (let i = 0; i < player.lives; i++) ctx.fillText("❤️", canvas.width - 14 - i * 30, 30);

    // ---- Superladdningsmätare ----
    // Visas nere till vänster. Mätaren fylls när man dödar fiender.
    const barX = 14, barY = canvas.height - 36;
    const barW = 160, barH = 18;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(barX - 2, barY - 20, barW + 80, 38);

    // Etikett
    ctx.fillStyle = player.superActive ? "#f1c40f" : (player.superReady ? "#f39c12" : "#aaa");
    ctx.font      = "bold 12px Courier New";
    ctx.textAlign = "left";
    ctx.fillText(
        player.superActive ? `SUPER AKTIV! ${Math.ceil(player.superTimer / 60)}s` :
        player.superReady  ? "SUPER REDO! [Mellanslag]" : "SUPERKANON",
        barX, barY - 4
    );

    // Bakgrund till mätaren
    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barW, barH);

    // Fyllnad – gradient från gul till orange när full
    const fill = (player.superCharge / player.superMax) * barW;
    if (player.superActive) {
        // Pulserande guld under aktivt superläge
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100);
        ctx.fillStyle = `rgba(255, ${150 + pulse * 80}, 0, 1)`;
    } else {
        ctx.fillStyle = player.superReady ? "#f39c12" : "#e67e22";
    }
    ctx.fillRect(barX, barY, fill, barH);

    // Kant
    ctx.strokeStyle = player.superReady || player.superActive ? "#f1c40f" : "#555";
    ctx.lineWidth   = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // Statustext botten
    if (enemies.length > 0) {
        ctx.textAlign = "center"; ctx.fillStyle = "#e74c3c"; ctx.font = "13px Courier New";
        ctx.fillText(`Fiender kvar: ${enemies.length}`, canvas.width / 2, canvas.height - 10);
    } else if (state === STATE.PLAYING) {
        ctx.textAlign = "center"; ctx.fillStyle = "#2ecc71"; ctx.font = "13px Courier New";
        ctx.fillText(`Våg ${wave} klar! Nästa börjar snart...`, canvas.width / 2, canvas.height - 10);
    }
    ctx.textAlign = "left";
}


// SPELHANTERING

let score = 0;

function startOrRestart() {
    player.reset();
    bullets = []; enemies = []; particles = [];
    score = 0; wave = 0; waveTimer = 0;
    state = STATE.PLAYING;
}

document.addEventListener("keydown", e => {
    if (e.code === "Enter" && state !== STATE.PLAYING) startOrRestart();

    // Mellanslag aktiverar superkanonen om laddningen är full
    if (e.code === "Space" && state === STATE.PLAYING) {
        e.preventDefault();
        if (player.superReady && !player.superActive) {
            player.superActive = true;
            player.superTimer  = player.superDuration;
            player.superReady  = false;
            // Spawna partikelexplosion vid aktivering för visuell feedback
            spawnParticles(player.x, player.y, "#f1c40f", 20);
        }
    }
});

//GAME LOOP

function gameLoop() {
    try {
        drawBackground();
        if (state === STATE.PLAYING) {
            player.update();
            updateBullets();
            updateEnemies();
            updateParticles();
            updateWaves();
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