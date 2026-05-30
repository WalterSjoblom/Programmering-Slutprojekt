// spelare.js – spelaren med rörelse, skjutning, animering och partikeleffekter

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

// Kulor
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

// Partikeleffekter
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