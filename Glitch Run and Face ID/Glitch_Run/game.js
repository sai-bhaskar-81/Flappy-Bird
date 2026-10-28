(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const startButton = document.getElementById("startButton");
  const message = document.getElementById("message");

  const healthValue = document.getElementById("healthValue");
  const healthBar = document.getElementById("healthBar");
  const scoreValue = document.getElementById("scoreValue");
  const threatValue = document.getElementById("threatValue");
  const dashValue = document.getElementById("dashValue");
  const dashBar = document.getElementById("dashBar");
  const glitchValue = document.getElementById("glitchValue");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const MAX_HEALTH = 100;
  const MAX_SHIELD = 100;
  const DASH_COOLDOWN = 2.5;
  const GLITCH_INTERVAL = 10;
  const GLITCH_DURATION = 3;
  const ORB_INTERVAL = 4.5;
  const MAX_ORBS = 7;
  const WIN_SCORE = 50000;

  let running = false;
  let lastTime = 0;
  let elapsed = 0;
  let score = 0;
  let health = MAX_HEALTH;
  let shield = 0;

  let enemySpawnTimer = 0;
  let orbSpawnTimer = 1.5;
  let fireCooldown = 0;
  let glitchTimer = 0;
  let glitchActive = 0;
  let currentGlitch = "";
  let dashCooldown = 0;
  let dashTime = 0;
  let invulnerableTime = 0;
  let shakeTime = 0;
  let shakePower = 0;

  let enemies = [];
  let bullets = [];
  let orbs = [];
  let particles = [];
  let dashTrail = [];

  const keys = new Set();
  const mouse = { x: WIDTH / 2 + 100, y: HEIGHT / 2, down: false };

  const player = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    size: 20,
    speed: 250,
    vx: 0,
    vy: 0,
    facingX: 1,
    facingY: 0
  };

  // Weapon upgrades every 5,000 points.
  // Fire rate becomes dramatically faster as weapon levels rise.
  const WEAPONS = [
    "BASIC BLASTER",
    "MACHINE GUN",
    "FIRECRACKER LAUNCHER",
    "LASER BLASTER",
    "PLASMA BLASTER",
    "IRON MAN GLOVE"
  ];

  function getWeaponLevel() {
    return Math.floor(score / 5000) % WEAPONS.length;
  }

  function getWeaponName() {
    return score < 5000 ? WEAPONS[0] : WEAPONS[getWeaponLevel()];
  }

  function getUpgradeCount() {
    return Math.floor(score / 5000);
  }

  // Lower cooldown = faster shooting.
  // Each 5,000-point upgrade makes the weapon fire faster.
  function getFireCooldown() {
    const upgrades = getUpgradeCount();
    return Math.max(0.025, 0.15 * Math.pow(0.70, upgrades));
  }

  function getGameSpeed() {
    return 1 + Math.floor(score / 10000) * 0.08;
  }

  function getDamage() {
    const upgrades = getUpgradeCount();
    return 1 + upgrades * 0.8;
  }

  function getBulletSpeed() {
    return 620 + getUpgradeCount() * 45;
  }

  function getBulletSize() {
    return Math.min(15, 6 + getUpgradeCount() * 1.1);
  }

  function resetGame() {
    running = true;
    elapsed = 0;
    score = 0;
    health = MAX_HEALTH;
    shield = 0;

    enemySpawnTimer = 0;
    orbSpawnTimer = 1.5;
    fireCooldown = 0;
    glitchTimer = 0;
    glitchActive = 0;
    currentGlitch = "";
    dashCooldown = 0;
    dashTime = 0;
    invulnerableTime = 0;
    shakeTime = 0;
    shakePower = 0;

    enemies = [];
    bullets = [];
    orbs = [];
    particles = [];
    dashTrail = [];

    player.x = WIDTH / 2;
    player.y = HEIGHT / 2;
    player.vx = 0;
    player.vy = 0;
    player.facingX = 1;
    player.facingY = 0;

    mouse.down = false;
    overlay.classList.add("hidden");
    message.textContent = "SYSTEM ONLINE — SURVIVE AS LONG AS YOU CAN";

    lastTime = performance.now();
    updateHUD();
  }

  function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;

    if (edge === 0) {
      x = Math.random() * WIDTH;
      y = -20;
    } else if (edge === 1) {
      x = WIDTH + 20;
      y = Math.random() * HEIGHT;
    } else if (edge === 2) {
      x = Math.random() * WIDTH;
      y = HEIGHT + 20;
    } else {
      x = -20;
      y = Math.random() * HEIGHT;
    }

    enemies.push({
      x,
      y,
      size: 15 + Math.random() * 5,
      speed: 65 + Math.random() * 35 + Math.min(70, elapsed * 1.2),
      wobble: Math.random() * Math.PI * 2,
      hp: 1,
      maxHp: 1
    });
  }

  function spawnOrb() {
    const pad = 35;
    const roll = Math.random();

    let type = "score";
    if (roll > 0.94) type = "health";
    else if (roll > 0.87) type = "shield";

    let x, y, attempts = 0;
    do {
      x = pad + Math.random() * (WIDTH - pad * 2);
      y = pad + Math.random() * (HEIGHT - pad * 2);
      attempts++;
    } while (
      Math.hypot(x - player.x, y - player.y) < 100 &&
      attempts < 12
    );

    orbs.push({
      x,
      y,
      size: type === "score" ? 10 : 12,
      type,
      phase: Math.random() * Math.PI * 2
    });
  }

  function getAimDirection() {
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  function createBullet(angle, options = {}) {
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const weapon = getWeaponLevel();

    const speed = options.speed || getBulletSpeed();
    const damage = options.damage || getDamage();
    const size = options.size || getBulletSize();

    bullets.push({
      x: player.x + directionX * (player.size * 0.7),
      y: player.y + directionY * (player.size * 0.7),
      vx: directionX * speed,
      vy: directionY * speed,
      size,
      damage,
      life: options.life || 1.35,
      color: options.color || (
        weapon === 2 ? "#ffb347" :
        weapon === 3 ? "#6cfaff" :
        weapon === 4 ? "#c66bff" :
        weapon === 5 ? "#ffe66d" :
        "#35f6ff"
      ),
      splash: options.splash || 0,
      pierce: options.pierce || 0,
      laser: options.laser || false
    });
  }

  function shoot() {
    const direction = getAimDirection();
    const angle = Math.atan2(direction.y, direction.x);
    const weapon = getWeaponLevel();
    const upgrades = getUpgradeCount();

    // The glove and multi-shot weapons become wider and stronger
    // at later upgrade levels.
    const spread = Math.min(0.24, 0.07 + upgrades * 0.012);

    if (weapon === 0) {
      createBullet(angle, {
        damage: getDamage() * 1.2
      });
    } else if (weapon === 1) {
      // Machine gun: fast, rapid-fire shots.
      createBullet(angle, {
        speed: getBulletSpeed() * 1.12,
        damage: getDamage() * 1.1,
        size: getBulletSize()
      });
    } else if (weapon === 2) {
      // Firecracker launcher: explosive projectiles.
      createBullet(angle, {
        speed: getBulletSpeed() * 0.78,
        damage: getDamage() * 2.4,
        size: getBulletSize() * 1.5,
        splash: 75 + upgrades * 7,
        color: "#ff9b42",
        life: 1.7
      });
    } else if (weapon === 3) {
      // Laser blaster: extremely fast, piercing laser bolts.
      createBullet(angle, {
        speed: getBulletSpeed() * 2.2,
        damage: getDamage() * 1.8,
        size: getBulletSize() * 0.85,
        color: "#70ffff",
        life: 1.05,
        pierce: 2 + Math.floor(upgrades / 2),
        laser: true
      });
    } else if (weapon === 4) {
      // Plasma blaster: heavy shots with a large blast radius.
      createBullet(angle, {
        speed: getBulletSpeed() * 0.9,
        damage: getDamage() * 3.2,
        size: getBulletSize() * 1.8,
        splash: 105 + upgrades * 9,
        color: "#c66bff",
        life: 1.6
      });
    } else {
      // Iron Man Glove: five powerful shots in a fan.
      for (let i = -2; i <= 2; i++) {
        createBullet(angle + i * spread, {
          speed: getBulletSpeed() * 1.3,
          damage: getDamage() * 2.0,
          size: getBulletSize() * 1.15,
          color: "#ffe66d",
          life: 1.35,
          splash: i === 0 ? 30 + upgrades * 5 : 0
        });
      }
    }
  }

  function beginDash() {
    if (!running || dashCooldown > 0 || dashTime > 0) return;

    let dx = 0;
    let dy = 0;

    if (keys.has("w") || keys.has("arrowup")) dy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dy += 1;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;

    if (dx === 0 && dy === 0) {
      dx = player.facingX;
      dy = player.facingY;
    }

    const length = Math.hypot(dx, dy) || 1;
    player.vx = dx / length * 700;
    player.vy = dy / length * 700;

    dashTime = 0.18;
    dashCooldown = DASH_COOLDOWN;
    invulnerableTime = 0.3;

    burst(player.x, player.y, "#35f6ff", 15);
  }

  function burst(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 220;

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.45,
        maxLife: 0.7,
        color,
        size: 2 + Math.random() * 4
      });
    }
  }

  function triggerGlitch() {
    const glitchTypes = ["SPEED SURGE", "PIXEL STORM", "ENEMY OVERLOAD"];
    currentGlitch = glitchTypes[Math.floor(Math.random() * glitchTypes.length)];
    glitchActive = GLITCH_DURATION;
    glitchTimer = 0;
    message.textContent = "SYSTEM GLITCH: " + currentGlitch;

    if (currentGlitch === "ENEMY OVERLOAD") {
      for (let i = 0; i < 5 && enemies.length < 30; i++) {
        spawnEnemy();
      }
    }

    if (currentGlitch === "PIXEL STORM") {
      for (let i = 0; i < 35; i++) {
        particles.push({
          x: Math.random() * WIDTH,
          y: Math.random() * HEIGHT,
          vx: (Math.random() - 0.5) * 100,
          vy: (Math.random() - 0.5) * 100,
          life: 0.5 + Math.random(),
          maxLife: 1.5,
          color: Math.random() > 0.5 ? "#ff3d9a" : "#35f6ff",
          size: 2 + Math.random() * 4
        });
      }
    }
  }

  function endGame(won = false) {
    running = false;
    mouse.down = false;
    overlay.classList.remove("hidden");

    overlay.querySelector("h2").textContent = won ? "YOU WIN" : "SYSTEM FAILURE";
    overlay.querySelector("p:not(.eyebrow)").textContent = won
      ? "Meme kaali ante maakante kaliga unnav enti mawa!"
      : "Final score: " + score.toLocaleString() + " — survive longer next run.";

    startButton.textContent = "PLAY AGAIN";
    message.textContent = won ? "TARGET SCORE REACHED — SYSTEM COMPLETE" : "RUN ENDED — SYSTEM OFFLINE";
  }

    function update(dt) {
    elapsed += dt;

    if (fireCooldown > 0) fireCooldown = Math.max(0, fireCooldown - dt);
    if (dashCooldown > 0) dashCooldown = Math.max(0, dashCooldown - dt);
    if (dashTime > 0) dashTime = Math.max(0, dashTime - dt);
    if (invulnerableTime > 0) invulnerableTime = Math.max(0, invulnerableTime - dt);
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);

    glitchTimer += dt;
    if (glitchActive > 0) {
      glitchActive = Math.max(0, glitchActive - dt);
      if (glitchActive === 0) {
        currentGlitch = "";
        message.textContent = "SYSTEM STABLE — KEEP MOVING";
      }
    } else if (glitchTimer >= GLITCH_INTERVAL) {
      triggerGlitch();
    }

    // Movement.
    let dx = 0;
    let dy = 0;

    if (keys.has("w") || keys.has("arrowup")) dy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dy += 1;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;

    const length = Math.hypot(dx, dy);
    if (length > 0) {
      dx /= length;
      dy /= length;
      player.facingX = dx;
      player.facingY = dy;
    }

    if (dashTime > 0) {
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      dashTrail.push({ x: player.x, y: player.y, life: 0.22 });
      if (dashTrail.length > 14) dashTrail.shift();
    } else {
      const boost = currentGlitch === "SPEED SURGE" && glitchActive > 0 ? 1.75 : 1;
      player.x += dx * player.speed * boost * dt;
      player.y += dy * player.speed * boost * dt;
      player.vx = 0;
      player.vy = 0;
    }

    player.x = Math.max(player.size / 2, Math.min(WIDTH - player.size / 2, player.x));
    player.y = Math.max(player.size / 2, Math.min(HEIGHT - player.size / 2, player.y));

    // Hold the left mouse button to fire continuously.
    if (mouse.down && fireCooldown <= 0) {
      shoot();
      fireCooldown = getFireCooldown();
    }

    // Enemy spawning increases gradually, with a cap.
    enemySpawnTimer += dt;
    const difficulty = Math.min(1, elapsed / 100);
    const spawnRate = Math.max(0.38, 0.9 - difficulty * 0.4);
    const enemyCap = Math.floor(12 + difficulty * 18);

    if (enemySpawnTimer >= spawnRate && enemies.length < enemyCap) {
      enemySpawnTimer = 0;
      spawnEnemy();
    }

    // Move enemies and handle player collisions.
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const vx = player.x - enemy.x;
      const vy = player.y - enemy.y;
      const distance = Math.hypot(vx, vy) || 1;

      enemy.wobble += dt * 5;
      const wobble = Math.sin(enemy.wobble) * 10;

      enemy.x += (vx / distance * enemy.speed + wobble * vy / distance) * dt;
      enemy.y += (vy / distance * enemy.speed - wobble * vx / distance) * dt;

      if (distance < player.size * 0.65 + enemy.size * 0.5) {
        if (dashTime > 0) {
          burst(enemy.x, enemy.y, "#35f6ff", 12);
          enemies.splice(i, 1);
          score += 50;
          continue;
        }

        if (invulnerableTime <= 0) {
          if (shield > 0) {
            shield = Math.max(0, shield - 25);
          } else {
            health -= 18;
          }

          invulnerableTime = 0.7;
          shakeTime = 0.2;
          shakePower = 6;
          burst(player.x, player.y, "#ff4b5c", 12);
          message.textContent = shield > 0
            ? "SHIELD HIT — KEEP MOVING"
            : "DAMAGE DETECTED — KEEP MOVING";
        }
      }
    }

    // Move bullets and detect hits.
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];

      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;

      if (
        bullet.life <= 0 ||
        bullet.x < -60 || bullet.x > WIDTH + 60 ||
        bullet.y < -60 || bullet.y > HEIGHT + 60
      ) {
        bullets.splice(i, 1);
        continue;
      }

      let bulletConsumed = false;

      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        const hitDistance = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);

        if (hitDistance < bullet.size / 2 + enemy.size / 2) {
          // Stronger weapons deal much more damage.
          enemy.hp -= bullet.damage;

          if (bullet.splash > 0) {
            burst(bullet.x, bullet.y, bullet.color, 18);

            for (let k = enemies.length - 1; k >= 0; k--) {
              if (k === j) continue;
              const nearby = enemies[k];
              if (Math.hypot(nearby.x - bullet.x, nearby.y - bullet.y) < bullet.splash) {
                nearby.hp -= bullet.damage * 0.75;

                if (nearby.hp <= 0) {
                  burst(nearby.x, nearby.y, bullet.color, 10);
                  enemies.splice(k, 1);
                  score += 50;
                }
              }
            }
          } else {
            burst(bullet.x, bullet.y, bullet.color, 5);
          }

          if (enemy.hp <= 0) {
            burst(enemy.x, enemy.y, "#ff3d9a", 12);
            enemies.splice(j, 1);
            score += 50;
          }

          if (bullet.pierce > 0) {
            bullet.pierce--;
          } else {
            bullets.splice(i, 1);
            bulletConsumed = true;
          }

          break;
        }
      }

      if (bulletConsumed) continue;
    }

    // Spawn and collect point, health, and shield orbs.
    orbSpawnTimer += dt;
    if (orbSpawnTimer >= ORB_INTERVAL && orbs.length < MAX_ORBS) {
      orbSpawnTimer = 0;
      spawnOrb();
    }

    for (let i = orbs.length - 1; i >= 0; i--) {
      const orb = orbs[i];
      orb.phase += dt * 4;

      if (Math.hypot(player.x - orb.x, player.y - orb.y) < player.size / 2 + orb.size) {
        if (orb.type === "health") {
          health = Math.min(MAX_HEALTH, health + 25);
          message.textContent = "HEALTH RESTORED: +25";
          burst(orb.x, orb.y, "#62ff8a", 15);
        } else if (orb.type === "shield") {
          shield = Math.min(MAX_SHIELD, shield + 25);
          message.textContent = "SHIELD CHARGED: +25";
          burst(orb.x, orb.y, "#7b8cff", 15);
        } else {
          score += 100;
          message.textContent = "ENERGY ACQUIRED: +100 SCORE";
          burst(orb.x, orb.y, "#35f6ff", 15);
        }

        orbs.splice(i, 1);
      }
    }

    // Particles and dash trails.
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      particle.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    for (const trail of dashTrail) trail.life -= dt;
    dashTrail = dashTrail.filter(t => t.life > 0);

    // Win condition.
    if (score >= WIN_SCORE) {
      score = WIN_SCORE;
      updateHUD();
      endGame(true);
      return;
    }

    if (health <= 0) {
      health = 0;
      updateHUD();
      endGame(false);
      return;
    }

    updateHUD();
  }

  function drawGrid() {
    const redShift = Math.min(1, score / WIN_SCORE);

    ctx.fillStyle = `rgb(${5 + redShift * 24}, ${9 - redShift * 5}, ${20 - redShift * 8})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.strokeStyle = `rgba(35, ${150 - redShift * 100}, ${200 - redShift * 150}, 0.22)`;
    ctx.lineWidth = 1;

    const grid = 32;
    const offset = (elapsed * 8) % grid;

    for (let x = -grid + offset; x < WIDTH; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }

    for (let y = -grid + offset; y < HEIGHT; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    ctx.strokeStyle = redShift > 0.5 ? "rgba(255,60,90,.4)" : "rgba(53,246,255,.3)";
    ctx.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);
    ctx.restore();
  }

  function drawOrbs() {
    for (const orb of orbs) {
      const pulse = Math.sin(orb.phase) * 2;
      const colors = {
        score: "#35f6ff",
        health: "#62ff8a",
        shield: "#7b8cff"
      };
      const color = colors[orb.type];

      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(
        orb.x - orb.size / 2 - pulse / 2,
        orb.y - orb.size / 2 - pulse / 2,
        orb.size + pulse,
        orb.size + pulse
      );
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(orb.x - 2, orb.y - 2, 4, 4);
      ctx.restore();
    }
  }

  function drawPlayer() {
    for (const trail of dashTrail) {
      ctx.globalAlpha = Math.max(0, trail.life / 0.22) * 0.45;
      ctx.fillStyle = "#35f6ff";
      ctx.fillRect(
        trail.x - player.size / 2,
        trail.y - player.size / 2,
        player.size,
        player.size
      );
    }
    ctx.globalAlpha = 1;

    if (invulnerableTime > 0 && Math.floor(elapsed * 24) % 2 === 0) return;

    const weapon = getWeaponLevel();
    const colors = ["#b9fdff", "#35f6ff", "#ffb347", "#70ffff", "#c66bff", "#ffe66d"];

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(Math.atan2(mouse.y - player.y, mouse.x - player.x));
    ctx.shadowBlur = weapon >= 3 ? 26 : 18;
    ctx.shadowColor = colors[weapon];
    ctx.fillStyle = colors[weapon];
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;

    // Square player and a small barrel pointing toward the cursor.
    ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
    ctx.fillRect(0, -4, player.size * 1.15, 8);
    ctx.strokeRect(-player.size / 2, -player.size / 2, player.size, player.size);
    ctx.restore();
  }

  function drawEnemies() {
    for (const enemy of enemies) {
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#ff3d9a";
      ctx.fillStyle = "#ff3d9a";
      ctx.fillRect(
        enemy.x - enemy.size / 2,
        enemy.y - enemy.size / 2,
        enemy.size,
        enemy.size
      );
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const bullet of bullets) {
      ctx.save();
      ctx.shadowBlur = bullet.laser ? 25 : 14;
      ctx.shadowColor = bullet.color;
      ctx.fillStyle = bullet.color;

      if (bullet.laser) {
        ctx.translate(bullet.x, bullet.y);
        ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
        ctx.fillRect(-bullet.size, -2, bullet.size * 3.5, 4);
      } else {
        ctx.fillRect(
          bullet.x - bullet.size / 2,
          bullet.y - bullet.size / 2,
          bullet.size,
          bullet.size
        );
      }

      ctx.restore();
    }
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlitch() {
    if (glitchActive > 0 && currentGlitch === "PIXEL STORM") {
      ctx.save();
      ctx.globalAlpha = 0.15;

      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? "#ff3d9a" : "#35f6ff";
        ctx.fillRect(
          Math.random() * WIDTH,
          Math.random() * HEIGHT,
          30 + Math.random() * 80,
          2 + Math.random() * 5
        );
      }

      ctx.restore();
    }

    if (glitchActive > 0) {
      ctx.save();
      ctx.fillStyle = "#35f6ff";
      ctx.font = "700 13px monospace";
      ctx.textAlign = "right";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#35f6ff";
      ctx.fillText(
        "GLITCH: " + currentGlitch + " " + glitchActive.toFixed(1) + "s",
        WIDTH - 22,
        28
      );
      ctx.restore();
    }
  }

  function render() {
    ctx.save();

    if (shakeTime > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shakePower,
        (Math.random() - 0.5) * shakePower
      );
    }

    drawGrid();
    drawOrbs();
    drawEnemies();
    drawBullets();
    drawPlayer();
    drawParticles();
    drawGlitch();

    ctx.restore();
  }

  function updateHUD() {
    healthValue.textContent = Math.ceil(health) + " / " + Math.ceil(shield);
    healthBar.style.width = (health / MAX_HEALTH * 100) + "%";
    scoreValue.textContent = score.toLocaleString();
    threatValue.textContent = enemies.length;
    dashValue.textContent = dashCooldown <= 0 ? "READY" : dashCooldown.toFixed(1) + "s";
    dashBar.style.width = ((1 - dashCooldown / DASH_COOLDOWN) * 100) + "%";

    if (glitchValue) {
      glitchValue.textContent = glitchActive > 0 ? currentGlitch : "STABLE";
    }

    // Keep the current weapon and firing speed visible in the status message.
    if (running && !mouse.down && !glitchActive) {
      message.textContent =
        getWeaponName() +
        "  |  FIRE RATE LV " + getUpgradeCount() +
        "  |  " + Math.round(1 / getFireCooldown()) + " SHOTS/SEC";
    }
  }

  function loop(now) {
    const rawDt = Math.min((now - lastTime) / 1000 || 0, 0.033);
    lastTime = now;

    if (running) {
      update(rawDt * getGameSpeed());
    }

    render();
    requestAnimationFrame(loop);
  }

  function updateMousePosition(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  }

  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      event.preventDefault();
    }

    keys.add(key);

    if (key === " " && !event.repeat) beginDash();
    if (key === "enter" && !running) resetGame();
  });

  window.addEventListener("keyup", event => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => {
    keys.clear();
    mouse.down = false;
  });

  canvas.addEventListener("mousemove", updateMousePosition);

  canvas.addEventListener("mousedown", event => {
    if (event.button === 0 && running) {
      updateMousePosition(event);
      mouse.down = true;
      if (fireCooldown <= 0) {
        shoot();
        fireCooldown = getFireCooldown();
      }
    }
  });

  window.addEventListener("mouseup", event => {
    if (event.button === 0) mouse.down = false;
  });

  canvas.addEventListener("contextmenu", event => event.preventDefault());

  startButton.addEventListener("click", () => {
    overlay.querySelector("h2").textContent = "READY TO RUN?";
    overlay.querySelector("p:not(.eyebrow)").textContent =
      "Move. Aim with your mouse. Hold left click to fire. Space to dash.";
    startButton.textContent = "START RUN";
    resetGame();
  });

  drawGrid();
  updateHUD();
  requestAnimationFrame(now => {
    lastTime = now;
    loop(now);
  });
})();
