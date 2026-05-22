

const canvas = document.getElementById("c");
const ctx    = canvas.getContext("2d");

// ---- Spelstillstånd ----
const STATE = { START: 0, PLAYING: 1, GAME_OVER: 2 };
let state     = STATE.START;
let highscore = parseInt(localStorage.getItem("shooterHS") || "0");


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


const keys = {};
document.addEventListener("keydown", e => { keys[e.code] = true;  });
document.addEventListener("keyup",   e => { keys[e.code] = false; });


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

   
    superCharge:    0,     // Nuvarande laddning (0–100)
    superMax:      10,     // Antal kills som krävs för full laddning
    superActive:   false,  // Är superläget aktivt just nu?
    superTimer:    0,      // Frames kvar av superläget
    superDuration: 300,    // Hur länge superläget pågår (~5 sekunder vid 60fps)
    superReady:    false,  // Sann när laddningen är full men inte aktiverad än

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


        // Under superläget är shootRate 4x snabbare (5 vs 14 frames).
        // Vi väljer cooldown-värde baserat på om superläget är aktivt.
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