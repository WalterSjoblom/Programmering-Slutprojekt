// fiender.js – fiender, kollisionsdetektering och våghantering
// Tre fiendetyper: Basic (snabb, 1 HP), Tank (seg, 3 HP), Springer (håller avstånd och kretsar)

// Spawnar fiender från en slumpmässig kant av canvasen.
// Antalet ökar per våg men är max 14 st för att inte överbelasta spelet.
function spawnEnemies(wave) {
    const count = Math.min(4 + wave * 2, 14);
    for (let i = 0; i < count; i++) {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if      (side === 0) { x = Math.random() * canvas.width;  y = -30; }
        else if (side === 1) { x = canvas.width  + 30; y = Math.random() * canvas.height; }
        else if (side === 2) { x = Math.random() * canvas.width;  y = canvas.height + 30; }
        else                 { x = -30;                y = Math.random() * canvas.height; }

        // Tank spawnar från våg 2, var tredje fiende (index % 3 === 0)
        const isTank = wave >= 2 && i % 3 === 0;

        // Springer spawnar från våg 3, varannan fiende som inte är tank
        const isSpringer = wave >= 3 && !isTank && i % 2 === 0;

        enemies.push({
            x, y,
            r:         isTank ? 22 : isSpringer ? 13 : 15,
            speed:     isTank ? 1.2 : isSpringer ? 2.8 + wave * 0.1 : 2.0 + wave * 0.15,
            hp:        isTank ? 3  : 1,
            maxHp:     isTank ? 3  : 1,
            points:    isTank ? 30 : isSpringer ? 20 : 10,
            isTank,
            isSpringer,
            hitFlash:  0,
            // orbitAngle används av Springer för att kretsa runt spelaren
            orbitAngle: Math.atan2(y - canvas.height / 2, x - canvas.width / 2)
        });
    }
}

function updateEnemies() {
    for (const e of enemies) {
        if (e.isSpringer) {
            // Springer håller ett fast avstånd (orbitRadius) från spelaren och kretsar runt.
            // orbitAngle ökar varje frame vilket gör att fienden snurrar runt spelaren.
            // Tanken är att den är svårare att träffa eftersom den inte rör sig rakt mot dig.
            const orbitRadius = 160;
            e.orbitAngle += 0.025;
            const targetX = player.x + Math.cos(e.orbitAngle) * orbitRadius;
            const targetY = player.y + Math.sin(e.orbitAngle) * orbitRadius;
            const dx = targetX - e.x, dy = targetY - e.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            e.x += (dx / len) * e.speed;
            e.y += (dy / len) * e.speed;
        } else {
            // Basic och Tank rör sig rakt mot spelaren
            const dx = player.x - e.x, dy = player.y - e.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            e.x += (dx / len) * e.speed;
            e.y += (dy / len) * e.speed;
        }
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

        // Färg: vit vid träff (hitFlash), annars typfärg
        if (e.isSpringer) {
            ctx.fillStyle = e.hitFlash > 0 ? "white" : "#27ae60";
        } else {
            ctx.fillStyle = e.hitFlash > 0 ? "white" : (e.isTank ? "#8e44ad" : "#e74c3c");
        }
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();

        // Ögon
        ctx.fillStyle = "white";
        ctx.fillRect( 4, -7, 6, 6); ctx.fillRect(-10, -7, 6, 6);
        ctx.fillStyle = "#111";
        ctx.fillRect( 6, -5, 3, 3); ctx.fillRect( -8, -5, 3, 3);

        // Mun
        ctx.fillStyle = e.isTank ? "#6c3483" : e.isSpringer ? "#1e8449" : "#c0392b";
        ctx.fillRect(-7, 4, 14, 3);
        for (let i = 0; i < 4; i++) ctx.fillRect(-6 + i * 4, 7, 3, 4);

        ctx.restore();

        // HP-bar visas bara för Tank eftersom Basic och Springer dör på 1 träff
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
// Jämför avstånd² mot (r1+r2)² istället för att använda Math.sqrt,
// eftersom kvadratroten är dyr att räkna ut och vi inte behöver det exakta avståndet
function circlesCollide(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy < (ar + br) ** 2;
}

function checkCollisions() {
    // Kolla kulor mot fiender
    for (const b of bullets) {
        for (const e of enemies) {
            if (circlesCollide(b.x, b.y, b.r, e.x, e.y, e.r)) {
                b.life = 0;
                e.hp--;
                e.hitFlash = 6;
                if (e.hp <= 0) {
                    spawnParticles(e.x, e.y, e.isTank ? "#9b59b6" : e.isSpringer ? "#27ae60" : "#e74c3c", e.isTank ? 14 : 7);
                    score += e.points;
                    // Tankfiender ger 3 laddningspoäng, Springer 2, Basic 1
                    const chargeGain = e.isTank ? 3 : e.isSpringer ? 2 : 1;
                    if (!player.superActive) {
                        player.superCharge = Math.min(player.superMax, player.superCharge + chargeGain);
                        player.superReady  = (player.superCharge >= player.superMax);
                    }
                }
            }
        }
    }
    // Kolla fiender mot spelaren
    for (const e of enemies) {
        if (circlesCollide(player.x, player.y, player.r - 4, e.x, e.y, e.r)) {
            player.hit();
        }
    }
}

// Våghantering – väntar 90 frames (ca 1.5 sek) efter att alla fiender är döda innan nästa våg
function updateWaves() {
    if (enemies.length === 0) {
        waveTimer++;
        if (waveTimer >= 90) { wave++; waveTimer = 0; spawnEnemies(wave); }
    }
}