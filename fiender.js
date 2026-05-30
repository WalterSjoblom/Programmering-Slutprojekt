// fiender.js – fiender, kollisionsdetektering och våghantering

// Fiender
// BasicEnemy: snabb, 1 HP. TankEnemy: långsam, 3 HP med HP-bar.
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

// Våghantering – väntar 90 frames efter att alla fiender är döda innan nästa våg
function updateWaves() {
    if (enemies.length === 0) {
        waveTimer++;
        if (waveTimer >= 90) { wave++; waveTimer = 0; spawnEnemies(wave); }
    }
}