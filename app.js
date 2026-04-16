const appNodes = {
  list: document.getElementById("gameList"),
  title: document.getElementById("gameTitle"),
  tagline: document.getElementById("gameTagline"),
  genre: document.getElementById("gameGenre"),
  difficulty: document.getElementById("gameDifficulty"),
  controlsShort: document.getElementById("gameControlsShort"),
  controls: document.getElementById("gameControls"),
  host: document.getElementById("gameHost"),
  restart: document.getElementById("restartBtn"),
};

let activeGameId = null;
let activeCleanup = null;
const AVATAR_SRC = "./assets/avatar.jpg";
const avatarImage = new Image();
avatarImage.src = AVATAR_SRC;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createAvatarFace({ label = "", className = "", ring = "", title = "" } = {}) {
  const face = el("span", ["avatar-face", className].filter(Boolean).join(" "));
  if (ring) {
    face.style.setProperty("--avatar-ring", ring);
  }
  if (title) {
    face.title = title;
  }
  if (label) {
    face.append(el("span", "avatar-label", label));
  }
  return face;
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawAvatarFill(ctx, x, y, width, height) {
  if (avatarImage.complete && avatarImage.naturalWidth) {
    const size = Math.min(avatarImage.naturalWidth, avatarImage.naturalHeight);
    const sx = (avatarImage.naturalWidth - size) / 2;
    const sy = (avatarImage.naturalHeight - size) / 2;
    ctx.drawImage(avatarImage, sx, sy, size, size, x, y, width, height);
    return;
  }

  ctx.fillStyle = "#d7c5ba";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "rgba(32, 26, 23, 0.64)";
  ctx.font = `${Math.floor(width * 0.32)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("脸", x + width / 2, y + height / 2);
}

function drawAvatarCircle(ctx, x, y, radius, { borderColor = "rgba(255,255,255,0.86)", borderWidth = 4, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  drawAvatarFill(ctx, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.arc(x, y, radius - borderWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function choice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectCollision(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  return distance(circle.x, circle.y, closestX, closestY) <= circle.r;
}

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function createDisposer() {
  const cleanups = [];
  return {
    add(callback) {
      cleanups.push(callback);
      return callback;
    },
    timeout(callback, delay) {
      const id = setTimeout(callback, delay);
      cleanups.push(() => clearTimeout(id));
      return id;
    },
    interval(callback, delay) {
      const id = setInterval(callback, delay);
      cleanups.push(() => clearInterval(id));
      return id;
    },
    raf(step) {
      let rafId = 0;
      let last = performance.now();
      const frame = (time) => {
        const dt = Math.min(0.033, (time - last) / 1000);
        last = time;
        step(dt, time / 1000);
        rafId = requestAnimationFrame(frame);
      };
      rafId = requestAnimationFrame(frame);
      cleanups.push(() => cancelAnimationFrame(rafId));
    },
    destroy() {
      while (cleanups.length) {
        try {
          cleanups.pop()();
        } catch {
          // ignore cleanup errors
        }
      }
    },
  };
}

function createGameLayout(host, { canvas = true, width = 860, height = 520, context = "2d" } = {}) {
  host.innerHTML = "";
  const shell = el("div", "game-shell");
  const playfield = el("div", canvas ? "playfield" : "dom-playfield");
  const panel = el("aside", "panel");
  const notice = el("div", "notice");
  let canvasEl = null;
  let ctx = null;

  if (canvas) {
    canvasEl = document.createElement("canvas");
    canvasEl.width = width;
    canvasEl.height = height;
    playfield.append(canvasEl, notice);
  } else {
    playfield.append(notice);
  }

  shell.append(playfield, panel);
  host.append(shell);

  if (canvasEl) {
    ctx = context
      ? canvasEl.getContext(context, context === "webgl2" ? { antialias: true, alpha: false } : undefined)
      : null;
  }

  return { shell, playfield, panel, canvas: canvasEl, ctx, notice };
}

function createScoreStrip(panel, definitions) {
  const strip = el("div", "score-strip");
  const refs = {};

  definitions.forEach(({ key, label, value }) => {
    const chip = el("div", "control-chip");
    const labelEl = el("span", "", label);
    const valueEl = el("strong", "", value ?? "0");
    chip.append(labelEl, valueEl);
    strip.append(chip);
    refs[key] = valueEl;
  });

  panel.append(strip);
  return refs;
}

function addPanelText(panel, title, htmlText) {
  const section = el("section", "");
  const heading = el("h4", "", title);
  const text = el("p", "inline-help");
  text.innerHTML = htmlText;
  section.append(heading, text);
  panel.append(section);
  return section;
}

function addPanelList(panel, title, items) {
  const section = el("section", "");
  const heading = el("h4", "", title);
  const list = el("ul", "tip-list");
  items.forEach((item) => {
    list.append(el("li", "", item));
  });
  section.append(heading, list);
  panel.append(section);
  return section;
}

function addGlobalListener(disposer, target, type, handler, options) {
  target.addEventListener(type, handler, options);
  disposer.add(() => target.removeEventListener(type, handler, options));
}

function showNotice(notice, message, duration = 1400) {
  notice.textContent = message;
  notice.classList.add("visible");
  if (showNotice._timer) {
    clearTimeout(showNotice._timer);
  }
  showNotice._timer = setTimeout(() => {
    notice.classList.remove("visible");
  }, duration);
}

function createOverlay(playfield) {
  const overlay = el("div", "game-overlay");
  const card = el("div", "overlay-card");
  const title = el("h3", "", "");
  const body = el("p", "", "");
  const button = el("button", "pill-button", "再来一局");
  let action = null;

  overlay.style.display = "none";
  button.addEventListener("click", () => action && action());
  card.append(title, body, button);
  overlay.append(card);
  playfield.append(overlay);

  return {
    show({ titleText, bodyHtml, buttonLabel = "再来一局", onAction }) {
      title.textContent = titleText;
      body.innerHTML = bodyHtml;
      button.textContent = buttonLabel;
      action = onAction;
      overlay.style.display = "grid";
    },
    hide() {
      overlay.style.display = "none";
    },
  };
}

function drawSkyBackground(ctx, width, height, topColor, bottomColor) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function mountDinoRunner(host) {
  const disposer = createDisposer();
  const { playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 900, height: 320 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "分数", value: "0" },
    { key: "best", label: "最佳", value: String(safeGet("arcade.dino.best", 0)) },
    { key: "speed", label: "速度", value: "1.0x" },
  ]);

  addPanelText(panel, "操作", "<span class='kbd'>Space</span> / <span class='kbd'>↑</span> / 点击画布跳跃");
  addPanelList(panel, "规则", [
    "自动向前冲刺，躲开仙人掌和石块。",
    "分数越高，速度越快，间隔越短。",
    "撞到障碍后可直接按空格重开。",
  ]);

  const width = canvas.width;
  const height = canvas.height;
  const groundY = 270;
  let best = safeGet("arcade.dino.best", 0);
  let state = null;

  function createClouds() {
    return Array.from({ length: 5 }, (_, index) => ({
      x: index * 200 + rand(0, 80),
      y: rand(34, 96),
      w: rand(44, 96),
      s: rand(16, 34),
    }));
  }

  function reset() {
    state = {
      running: true,
      over: false,
      score: 0,
      speed: 320,
      spawnTimer: 1.05,
      dino: { x: 92, y: groundY - 52, w: 48, h: 52, vy: 0 },
      obstacles: [],
      clouds: createClouds(),
      hillsOffset: 0,
    };
    overlay.hide();
    stats.score.textContent = "0";
    stats.best.textContent = String(best);
    stats.speed.textContent = "1.0x";
  }

  function jump() {
    if (state.over) {
      reset();
      return;
    }
    const onGround = state.dino.y >= groundY - state.dino.h - 1;
    if (!onGround) return;
    state.dino.vy = -560;
    showNotice(notice, "跳跃");
  }

  function spawnObstacle() {
    const tall = Math.random() > 0.45;
    state.obstacles.push({
      x: width + 24,
      w: tall ? rand(26, 36) : rand(38, 54),
      h: tall ? rand(48, 78) : rand(26, 38),
      tall,
    });
    state.spawnTimer = rand(0.82, 1.5) - Math.min(0.42, state.score / 240);
  }

  function gameOver() {
    state.running = false;
    state.over = true;
    best = Math.max(best, Math.floor(state.score));
    safeSet("arcade.dino.best", best);
    stats.best.textContent = String(best);
    overlay.show({
      titleText: "冲刺结束",
      bodyHtml: `本轮得分 <strong>${Math.floor(state.score)}</strong>，最佳 <strong>${best}</strong>。`,
      onAction: reset,
    });
  }

  function update(dt) {
    if (!state.running) return;

    state.score += dt * 13;
    state.speed = Math.min(650, 320 + state.score * 1.35);
    state.spawnTimer -= dt;
    state.hillsOffset += dt * state.speed * 0.2;

    if (state.spawnTimer <= 0) {
      spawnObstacle();
    }

    state.clouds.forEach((cloud) => {
      cloud.x -= dt * 36;
      if (cloud.x + cloud.w < -20) {
        cloud.x = width + rand(20, 100);
        cloud.y = rand(28, 90);
      }
    });

    state.dino.vy += 1600 * dt;
    state.dino.y += state.dino.vy * dt;
    if (state.dino.y > groundY - state.dino.h) {
      state.dino.y = groundY - state.dino.h;
      state.dino.vy = 0;
    }

    const dinoHitbox = {
      x: state.dino.x + 8,
      y: state.dino.y + 6,
      w: state.dino.w - 14,
      h: state.dino.h - 10,
    };

    state.obstacles.forEach((obstacle) => {
      obstacle.x -= dt * state.speed;
      const obstacleBox = { x: obstacle.x, y: groundY - obstacle.h, w: obstacle.w, h: obstacle.h };
      if (rectsOverlap(dinoHitbox, obstacleBox)) {
        gameOver();
      }
    });

    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -60);
    stats.score.textContent = String(Math.floor(state.score));
    stats.speed.textContent = `${(state.speed / 320).toFixed(1)}x`;
  }

  function drawCloud(cloud) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.s * 0.7, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.s * 0.7, cloud.y - 8, cloud.s, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.s * 1.55, cloud.y, cloud.s * 0.82, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    drawSkyBackground(ctx, width, height, "#fceab0", "#ffe7d6");

    ctx.fillStyle = "rgba(255, 210, 92, 0.7)";
    ctx.beginPath();
    ctx.arc(770, 68, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(200, 160, 110, 0.18)";
    for (let i = 0; i < 6; i += 1) {
      const x = ((i * 180 - state.hillsOffset) % (width + 220)) - 80;
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.quadraticCurveTo(x + 90, 150, x + 190, groundY);
      ctx.closePath();
      ctx.fill();
    }

    state.clouds.forEach(drawCloud);

    ctx.fillStyle = "#c89253";
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.fillStyle = "#7bb45f";
    ctx.fillRect(0, groundY, width, 10);

    ctx.strokeStyle = "rgba(86, 50, 28, 0.12)";
    ctx.lineWidth = 2;
    for (let i = 0; i < width; i += 40) {
      const dashX = (i - state.hillsOffset * 1.3) % (width + 40);
      ctx.beginPath();
      ctx.moveTo(dashX, groundY + 26);
      ctx.lineTo(dashX + 18, groundY + 26);
      ctx.stroke();
    }

    state.obstacles.forEach((obstacle) => {
      const baseY = groundY - obstacle.h;
      ctx.fillStyle = obstacle.tall ? "#4d8d3a" : "#876143";
      if (obstacle.tall) {
        ctx.fillRect(obstacle.x + obstacle.w * 0.35, baseY, obstacle.w * 0.3, obstacle.h);
        ctx.fillRect(obstacle.x, baseY + obstacle.h * 0.35, obstacle.w * 0.3, obstacle.h * 0.16);
        ctx.fillRect(obstacle.x + obstacle.w * 0.7, baseY + obstacle.h * 0.48, obstacle.w * 0.24, obstacle.h * 0.14);
      } else {
        ctx.beginPath();
        ctx.moveTo(obstacle.x, groundY);
        ctx.lineTo(obstacle.x + obstacle.w * 0.4, baseY);
        ctx.lineTo(obstacle.x + obstacle.w, groundY);
        ctx.closePath();
        ctx.fill();
      }
    });

    const dino = state.dino;
    ctx.fillStyle = "rgba(32, 26, 23, 0.16)";
    ctx.beginPath();
    ctx.ellipse(dino.x + 24, groundY + 6, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    drawAvatarCircle(ctx, dino.x + 24, dino.y + 24, 22, { borderColor: "rgba(255,255,255,0.92)" });
    ctx.strokeStyle = "#2c2a29";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(dino.x + 16, dino.y + 42);
    ctx.lineTo(dino.x + 12, dino.y + 54);
    ctx.moveTo(dino.x + 30, dino.y + 42);
    ctx.lineTo(dino.x + 34, dino.y + 54);
    ctx.stroke();
  }

  addGlobalListener(disposer, window, "keydown", (event) => {
    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
      event.preventDefault();
      jump();
    }
  });

  addGlobalListener(disposer, playfield, "pointerdown", () => jump());
  disposer.raf((dt) => {
    update(dt);
    draw();
  });

  reset();
  return () => disposer.destroy();
}

function mountSnake(host) {
  const disposer = createDisposer();
  const { playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 520, height: 520 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "长度", value: "3" },
    { key: "best", label: "最佳", value: String(safeGet("arcade.snake.best", 3)) },
    { key: "speed", label: "节奏", value: "普通" },
  ]);

  addPanelText(panel, "操作", "<span class='kbd'>↑↓←→</span> 或 <span class='kbd'>WASD</span> 控制方向");
  addPanelList(panel, "规则", [
    "吃到果子就会变长。",
    "撞墙或咬到自己会结束。",
    "分数越高，移动速度越快。",
  ]);

  const gridSize = 20;
  const cell = canvas.width / gridSize;
  let best = safeGet("arcade.snake.best", 3);
  let state = null;

  function spawnFood(snake) {
    while (true) {
      const food = { x: randInt(0, gridSize - 1), y: randInt(0, gridSize - 1) };
      if (!snake.some((segment) => segment.x === food.x && segment.y === food.y)) {
        return food;
      }
    }
  }

  function reset() {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    state = {
      snake,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: spawnFood(snake),
      tick: 0.15,
      acc: 0,
      running: true,
      over: false,
    };
    overlay.hide();
    stats.score.textContent = "3";
    stats.best.textContent = String(best);
    stats.speed.textContent = "普通";
  }

  function setDirection(nextX, nextY) {
    if (state.over) {
      reset();
      return;
    }
    if (state.dir.x === -nextX && state.dir.y === -nextY) return;
    state.nextDir = { x: nextX, y: nextY };
  }

  function gameOver() {
    state.running = false;
    state.over = true;
    best = Math.max(best, state.snake.length);
    safeSet("arcade.snake.best", best);
    stats.best.textContent = String(best);
    overlay.show({
      titleText: "蛇打结了",
      bodyHtml: `你吃到了 <strong>${state.snake.length}</strong> 格长度。`,
      onAction: reset,
    });
  }

  function step() {
    state.dir = { ...state.nextDir };
    const nextHead = {
      x: state.snake[0].x + state.dir.x,
      y: state.snake[0].y + state.dir.y,
    };

    if (
      nextHead.x < 0 ||
      nextHead.x >= gridSize ||
      nextHead.y < 0 ||
      nextHead.y >= gridSize ||
      state.snake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)
    ) {
      gameOver();
      return;
    }

    state.snake.unshift(nextHead);
    if (nextHead.x === state.food.x && nextHead.y === state.food.y) {
      state.food = spawnFood(state.snake);
      state.tick = Math.max(0.065, state.tick - 0.004);
      showNotice(notice, "+1 果子");
    } else {
      state.snake.pop();
    }

    stats.score.textContent = String(state.snake.length);
    stats.speed.textContent = state.tick < 0.09 ? "很快" : state.tick < 0.12 ? "加速" : "普通";
  }

  function update(dt) {
    if (!state.running) return;
    state.acc += dt;
    while (state.acc >= state.tick) {
      state.acc -= state.tick;
      step();
      if (state.over) break;
    }
  }

  function drawCell(x, y, color, radius = 8) {
    const px = x * cell + 4;
    const py = y * cell + 4;
    const size = cell - 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px + radius, py);
    ctx.lineTo(px + size - radius, py);
    ctx.quadraticCurveTo(px + size, py, px + size, py + radius);
    ctx.lineTo(px + size, py + size - radius);
    ctx.quadraticCurveTo(px + size, py + size, px + size - radius, py + size);
    ctx.lineTo(px + radius, py + size);
    ctx.quadraticCurveTo(px, py + size, px, py + size - radius);
    ctx.lineTo(px, py + radius);
    ctx.quadraticCurveTo(px, py, px + radius, py);
    ctx.fill();
  }

  function draw() {
    drawSkyBackground(ctx, canvas.width, canvas.height, "#f9f7f0", "#efe4d7");
    ctx.strokeStyle = "rgba(60, 34, 20, 0.08)";
    for (let i = 0; i <= gridSize; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(canvas.width, i * cell);
      ctx.stroke();
    }

    drawCell(state.food.x, state.food.y, "#ff7b61", 16);
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(state.food.x * cell + cell / 2, state.food.y * cell + cell / 2 - 4, 5, 0, Math.PI * 2);
    ctx.fill();

    state.snake.forEach((segment, index) => {
      drawCell(segment.x, segment.y, index === 0 ? "#0e8f8c" : "#45b584", 10);
      if (index === 0) {
        const centerX = segment.x * cell + cell / 2;
        const centerY = segment.y * cell + cell / 2;
        drawAvatarCircle(ctx, centerX, centerY, cell * 0.34, { borderColor: "rgba(255,255,255,0.94)", borderWidth: 3 });
      }
    });
  }

  addGlobalListener(disposer, window, "keydown", (event) => {
    const map = {
      ArrowUp: [0, -1],
      KeyW: [0, -1],
      ArrowDown: [0, 1],
      KeyS: [0, 1],
      ArrowLeft: [-1, 0],
      KeyA: [-1, 0],
      ArrowRight: [1, 0],
      KeyD: [1, 0],
    };
    if (map[event.code]) {
      event.preventDefault();
      setDirection(...map[event.code]);
    }
  });

  disposer.raf((dt) => {
    update(dt);
    draw();
  });

  reset();
  return () => disposer.destroy();
}

function mountAngryBirds(host) {
  const disposer = createDisposer();
  const { playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 920, height: 380 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "birds", label: "弹鸟", value: "3" },
    { key: "pigs", label: "猪猪", value: "3" },
    { key: "score", label: "得分", value: "0" },
  ]);

  addPanelText(panel, "操作", "按住小鸟拖拽，松手发射。撞倒所有猪猪就算过关。\n");
  addPanelList(panel, "提示", [
    "拖得越远，初速度越高。",
    "先拆木头，再打后方猪猪更稳。",
    "鸟打完还没清空目标就失败。",
  ]);

  const anchor = { x: 120, y: 280 };
  let state = null;
  let session = 0;

  function buildLevel() {
    return {
      pigs: [
        { x: 698, y: 290, r: 18, alive: true },
        { x: 770, y: 290, r: 18, alive: true },
        { x: 734, y: 232, r: 18, alive: true },
      ],
      blocks: [
        { x: 668, y: 220, w: 18, h: 90, hp: 2 },
        { x: 788, y: 220, w: 18, h: 90, hp: 2 },
        { x: 704, y: 250, w: 18, h: 60, hp: 2 },
        { x: 748, y: 250, w: 18, h: 60, hp: 2 },
        { x: 666, y: 202, w: 140, h: 18, hp: 3 },
      ],
    };
  }

  function remainingBirdsLabel() {
    return String(state.reserveBirds + (state.bird ? 1 : 0));
  }

  function spawnBird() {
    if (state.reserveBirds <= 0) {
      state.bird = null;
      stats.birds.textContent = "0";
      return;
    }
    state.reserveBirds -= 1;
    state.bird = {
      x: anchor.x,
      y: anchor.y,
      vx: 0,
      vy: 0,
      r: 18,
      launched: false,
      rest: 0,
    };
    state.dragging = false;
    stats.birds.textContent = remainingBirdsLabel();
  }

  function reset() {
    session += 1;
    state = {
      reserveBirds: 3,
      bird: null,
      dragging: false,
      score: 0,
      result: "",
      ...buildLevel(),
    };
    overlay.hide();
    spawnBird();
    stats.pigs.textContent = String(state.pigs.filter((pig) => pig.alive).length);
    stats.score.textContent = "0";
  }

  function finish(titleText, bodyHtml) {
    state.result = titleText;
    overlay.show({ titleText, bodyHtml, onAction: reset });
  }

  function scoreHit(amount) {
    state.score += amount;
    stats.score.textContent = String(state.score);
  }

  function spendBird() {
    state.bird = null;
    stats.birds.textContent = remainingBirdsLabel();
    if (state.pigs.every((pig) => !pig.alive)) {
      finish("城堡倒了", `你用 <strong>${state.score}</strong> 分清空了所有目标。`);
      return;
    }
    if (state.reserveBirds <= 0) {
      finish("弹药耗尽", `还剩 <strong>${state.pigs.filter((pig) => pig.alive).length}</strong> 只猪猪没解决。`);
      return;
    }
    const token = session;
    disposer.timeout(() => {
      if (token !== session || state.result) return;
      spawnBird();
      showNotice(notice, "下一只就位");
    }, 600);
  }

  function update(dt) {
    if (!state.bird || state.result || state.dragging) return;

    const bird = state.bird;
    if (bird.launched) {
      bird.vy += 820 * dt;
      bird.x += bird.vx * dt;
      bird.y += bird.vy * dt;
      bird.vx *= 0.995;

      if (bird.y + bird.r > 320) {
        bird.y = 320 - bird.r;
        bird.vy *= -0.16;
        bird.vx *= 0.8;
      }

      state.blocks.forEach((block) => {
        if (block.hp <= 0) return;
        if (circleRectCollision({ x: bird.x, y: bird.y, r: bird.r }, block)) {
          block.hp -= 1;
          bird.vx *= -0.72;
          bird.vy *= 0.86;
          scoreHit(block.hp <= 0 ? 80 : 25);
        }
      });
      state.blocks = state.blocks.filter((block) => block.hp > 0);

      state.pigs.forEach((pig) => {
        if (!pig.alive) return;
        if (distance(bird.x, bird.y, pig.x, pig.y) <= pig.r + bird.r) {
          pig.alive = false;
          bird.vx *= 0.76;
          bird.vy *= 0.84;
          scoreHit(150);
          stats.pigs.textContent = String(state.pigs.filter((item) => item.alive).length);
          showNotice(notice, "命中目标");
        }
      });

      if (state.pigs.every((pig) => !pig.alive)) {
        finish("一击清场", `你用 <strong>${state.score}</strong> 分解决了整座猪堡。`);
        return;
      }

      const stillMoving = Math.abs(bird.vx) > 22 || Math.abs(bird.vy) > 24;
      if (!stillMoving || bird.x > canvas.width + 60 || bird.y > canvas.height + 40) {
        bird.rest += dt;
      }
      if (bird.rest > 0.6) {
        spendBird();
      }
    }
  }

  function drawSlingshotBand(fromX, fromY, toX, toY) {
    ctx.strokeStyle = "#8a5732";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  }

  function draw() {
    drawSkyBackground(ctx, canvas.width, canvas.height, "#dff4ff", "#fbe3c7");
    ctx.fillStyle = "#ffd35c";
    ctx.beginPath();
    ctx.arc(760, 74, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8fd17f";
    ctx.fillRect(0, 320, canvas.width, 60);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "28px serif";
    ctx.fillText("☁︎", 120, 78);
    ctx.fillText("☁︎", 220, 118);
    ctx.fillText("☁︎", 640, 116);

    ctx.fillStyle = "#6e3d26";
    ctx.fillRect(anchor.x - 30, anchor.y - 16, 10, 56);
    ctx.fillRect(anchor.x + 18, anchor.y - 16, 10, 56);

    state.blocks.forEach((block) => {
      ctx.fillStyle = block.hp > 1 ? "#b67b46" : "#d89d5d";
      ctx.fillRect(block.x, block.y, block.w, block.h);
    });

    state.pigs.forEach((pig) => {
      if (!pig.alive) return;
      ctx.fillStyle = "#8fd265";
      ctx.beginPath();
      ctx.arc(pig.x, pig.y, pig.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2c2a29";
      ctx.beginPath();
      ctx.arc(pig.x - 6, pig.y - 5, 2.4, 0, Math.PI * 2);
      ctx.arc(pig.x + 6, pig.y - 5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(pig.x - 7, pig.y + 2, 14, 5);
    });

    if (state.bird) {
      const bird = state.bird;
      if (!bird.launched) {
        drawSlingshotBand(anchor.x - 20, anchor.y, bird.x, bird.y);
        drawSlingshotBand(anchor.x + 24, anchor.y, bird.x, bird.y);
      }
      drawAvatarCircle(ctx, bird.x, bird.y, bird.r, { borderColor: "#d9473f", borderWidth: 5 });
    }
  }

  addGlobalListener(disposer, canvas, "pointerdown", (event) => {
    if (!state.bird || state.result) return;
    const point = canvasPoint(canvas, event);
    if (distance(point.x, point.y, state.bird.x, state.bird.y) <= state.bird.r + 10 && !state.bird.launched) {
      state.dragging = true;
    }
  });

  addGlobalListener(disposer, canvas, "pointermove", (event) => {
    if (!state.dragging || !state.bird) return;
    const point = canvasPoint(canvas, event);
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const dist = Math.hypot(dx, dy);
    const maxPull = 88;
    const ratio = dist > maxPull ? maxPull / dist : 1;
    state.bird.x = anchor.x + dx * ratio;
    state.bird.y = anchor.y + dy * ratio;
  });

  addGlobalListener(disposer, window, "pointerup", () => {
    if (!state.dragging || !state.bird) return;
    state.dragging = false;
    state.bird.vx = (anchor.x - state.bird.x) * 3.3;
    state.bird.vy = (anchor.y - state.bird.y) * 3.3;
    state.bird.launched = true;
    showNotice(notice, "发射");
  });

  disposer.raf((dt) => {
    update(dt);
    draw();
  });

  reset();
  return () => disposer.destroy();
}

function mountPlantsVsZombies(host) {
  const disposer = createDisposer();
  const { playfield, panel, notice } = createGameLayout(host, { canvas: false });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "sun", label: "阳光", value: "175" },
    { key: "kills", label: "击杀", value: "0" },
    { key: "wave", label: "波次", value: "1" },
  ]);

  addPanelText(panel, "操作", "点击植物卡牌切换类型，再点击草地格子种植。坚持到 20 次击杀即胜利。");
  addPanelList(panel, "植物说明", [
    "🌱 豌豆射手：100 阳光，持续输出。",
    "🌻 向日葵：50 阳光，周期产出阳光。",
    "🥔 坚果墙：75 阳光，专门拖时间。",
  ]);

  playfield.style.padding = "18px";
  const wrap = el("div", "pvz-wrap");
  const toolbar = el("div", "tool-row");
  const grid = el("div", "pvz-grid");
  wrap.append(toolbar, grid);
  playfield.append(wrap);

  const rows = 5;
  const cols = 9;
  const plantDefs = {
    peashooter: { label: "豌豆射手", badge: "射", cost: 100, hp: 92 },
    sunflower: { label: "向日葵", badge: "阳", cost: 50, hp: 74 },
    wallnut: { label: "坚果墙", badge: "墙", cost: 75, hp: 280 },
  };

  const buttons = {};
  const cells = [];
  let selected = "peashooter";
  let state = null;

  Object.entries(plantDefs).forEach(([key, def]) => {
    const button = el("button", "plant-button");
    button.type = "button";
    button.append(createAvatarFace({ label: def.badge, className: "small", ring: "rgba(255,255,255,0.86)" }));
    button.append(document.createElement("br"));
    button.insertAdjacentHTML("beforeend", `<strong>${def.label}</strong><br><span>${def.cost} 阳光</span>`);
    button.addEventListener("click", () => {
      selected = key;
      updateSelection();
      showNotice(notice, `已选 ${def.label}`);
    });
    toolbar.append(button);
    buttons[key] = button;
  });

  for (let index = 0; index < rows * cols; index += 1) {
    const cell = el("button", "pvz-cell");
    cell.type = "button";
    cell.dataset.index = String(index);
    cell.addEventListener("click", () => placePlant(index));
    grid.append(cell);
    cells.push(cell);
  }

  function updateSelection() {
    Object.entries(buttons).forEach(([key, button]) => {
      button.classList.toggle("active", key === selected);
    });
  }

  function updateStats() {
    stats.sun.textContent = String(state.sun);
    stats.kills.textContent = String(state.kills);
    stats.wave.textContent = String(state.wave);
  }

  function createPlant(type) {
    return {
      type,
      hp: plantDefs[type].hp,
      nextShot: 0,
      nextSun: state.time + 5.2,
    };
  }

  function reset() {
    state = {
      sun: 175,
      kills: 0,
      wave: 1,
      time: 0,
      nextAmbientSun: 4.5,
      nextZombie: 2.4,
      plants: Array(rows * cols).fill(null),
      peas: [],
      zombies: [],
      result: "",
    };
    selected = "peashooter";
    updateSelection();
    updateStats();
    overlay.hide();
    render();
  }

  function placePlant(index) {
    if (state.result) return;
    if (state.plants[index]) {
      showNotice(notice, "这个格子已经种过了");
      return;
    }
    const def = plantDefs[selected];
    if (state.sun < def.cost) {
      showNotice(notice, "阳光不够");
      return;
    }
    state.sun -= def.cost;
    state.plants[index] = createPlant(selected);
    updateStats();
    render();
  }

  function spawnZombie() {
    const row = randInt(0, rows - 1);
    state.zombies.push({
      row,
      x: cols - 0.15,
      hp: 100 + state.wave * 18,
      speed: 0.09 + Math.min(0.045, state.wave * 0.003),
      damage: 12 + Math.floor(state.wave / 5),
    });
    state.wave += 1;
    state.nextZombie = state.time + Math.max(1.25, 4.1 - state.wave * 0.1);
  }

  function finish(titleText, bodyHtml) {
    state.result = titleText;
    overlay.show({ titleText, bodyHtml, onAction: reset });
  }

  function removeZombie(zombie, bonusSun = 15) {
    const index = state.zombies.indexOf(zombie);
    if (index >= 0) {
      state.zombies.splice(index, 1);
      state.kills += 1;
      state.sun += bonusSun;
      updateStats();
    }
  }

  function step() {
    if (state.result) return;
    state.time += 0.2;

    if (state.time >= state.nextAmbientSun) {
      state.sun += 25;
      state.nextAmbientSun += 5;
      updateStats();
      showNotice(notice, "+25 自然阳光");
    }

    if (state.time >= state.nextZombie) {
      spawnZombie();
      updateStats();
    }

    state.plants.forEach((plant, index) => {
      if (!plant) return;
      const row = Math.floor(index / cols);
      const col = index % cols;

      if (plant.type === "sunflower" && state.time >= plant.nextSun) {
        state.sun += 25;
        plant.nextSun = state.time + 5.8;
        updateStats();
      }

      if (
        plant.type === "peashooter" &&
        state.time >= plant.nextShot &&
        state.zombies.some((zombie) => zombie.row === row && zombie.x > col)
      ) {
        state.peas.push({ row, x: col + 0.55, damage: 26 });
        plant.nextShot = state.time + 1.2;
      }
    });

    for (let peaIndex = state.peas.length - 1; peaIndex >= 0; peaIndex -= 1) {
      const pea = state.peas[peaIndex];
      pea.x += 0.45;
      const hit = state.zombies.find((zombie) => zombie.row === pea.row && Math.abs(zombie.x - pea.x) < 0.32);
      if (hit) {
        hit.hp -= pea.damage;
        state.peas.splice(peaIndex, 1);
        if (hit.hp <= 0) {
          removeZombie(hit);
          showNotice(notice, "僵尸倒下");
        }
        continue;
      }
      if (pea.x > cols + 0.4) {
        state.peas.splice(peaIndex, 1);
      }
    }

    for (let zombieIndex = state.zombies.length - 1; zombieIndex >= 0; zombieIndex -= 1) {
      const zombie = state.zombies[zombieIndex];
      const currentCol = Math.max(0, Math.floor(zombie.x));
      const plantIndex = zombie.row * cols + currentCol;
      const plant = state.plants[plantIndex];
      if (plant && zombie.x < currentCol + 0.72) {
        plant.hp -= zombie.damage;
        if (plant.hp <= 0) {
          state.plants[plantIndex] = null;
        }
      } else {
        zombie.x -= zombie.speed;
      }

      if (zombie.x < -0.05) {
        finish("防线失守", `僵尸突破了左侧防线，最终击杀 <strong>${state.kills}</strong>。`);
        return;
      }
    }

    if (state.kills >= 20) {
      finish("花园守住了", `你成功守住了草坪，并拿到 <strong>${state.kills}</strong> 次击杀。`);
      return;
    }

    render();
  }

  function renderCell(index) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const cell = cells[index];
    const plant = state.plants[index];
    const zombies = state.zombies.filter((zombie) => zombie.row === row && Math.floor(zombie.x) === col);
    const peas = state.peas.filter((pea) => pea.row === row && Math.floor(pea.x) === col);

    cell.innerHTML = "";
    cell.dataset.zombie = zombies.length ? "true" : "false";

    if (plant) {
      const plantEl = createAvatarFace({
        label: plantDefs[plant.type].badge,
        className: "tiny",
        ring: "rgba(255,255,255,0.9)",
      });
      plantEl.classList.add("pvz-plant");
      plantEl.style.left = "8px";
      plantEl.style.top = "8px";
      cell.append(plantEl);
    }

    if (zombies.length) {
      const zombieEl = createAvatarFace({ label: "僵", className: "tiny", ring: "rgba(160, 68, 68, 0.9)" });
      zombieEl.classList.add("pvz-zombie");
      zombieEl.style.right = "8px";
      zombieEl.style.bottom = "8px";
      cell.append(zombieEl);
    }

    if (peas.length) {
      const peaEl = el("span", "", "•".repeat(Math.min(3, peas.length)));
      peaEl.style.position = "absolute";
      peaEl.style.left = "50%";
      peaEl.style.bottom = "6px";
      peaEl.style.transform = "translateX(-50%)";
      peaEl.style.color = "#17363d";
      peaEl.style.fontWeight = "700";
      cell.append(peaEl);
    }
  }

  function render() {
    for (let index = 0; index < cells.length; index += 1) {
      renderCell(index);
    }
  }

  disposer.interval(step, 200);
  reset();
  return () => disposer.destroy();
}

function mountTetris(host) {
  const disposer = createDisposer();
  const { playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 360, height: 720 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "分数", value: "0" },
    { key: "lines", label: "消行", value: "0" },
    { key: "next", label: "下一个", value: "-" },
  ]);

  addPanelText(panel, "操作", "<span class='kbd'>←→</span> 平移，<span class='kbd'>↓</span> 加速，<span class='kbd'>↑</span>/<span class='kbd'>Space</span> 旋转。");
  addPanelList(panel, "目标", [
    "尽量持续消行，速度会随着进度提升。",
    "方块堆到顶部就结束。",
    "一次消四行得分最高。",
  ]);

  const cols = 10;
  const rows = 20;
  const cell = 34;
  const shapes = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    L: [[1, 0], [1, 0], [1, 1]],
    J: [[0, 1], [0, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
  };
  const colors = {
    I: "#63d1d0",
    O: "#ffd35c",
    T: "#c78cff",
    L: "#ff9c5a",
    J: "#5b8fff",
    S: "#6fd07f",
    Z: "#ff7070",
  };

  let state = null;

  function rotateMatrix(matrix) {
    return matrix[0].map((_, x) => matrix.map((row) => row[x]).reverse());
  }

  function cloneMatrix(matrix) {
    return matrix.map((row) => [...row]);
  }

  function randomPieceType() {
    return choice(Object.keys(shapes));
  }

  function createPiece(type) {
    const matrix = cloneMatrix(shapes[type]);
    return {
      type,
      matrix,
      x: Math.floor(cols / 2) - Math.ceil(matrix[0].length / 2),
      y: -1,
    };
  }

  function collides(piece, dx = 0, dy = 0, matrix = piece.matrix) {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;
        const nextX = piece.x + x + dx;
        const nextY = piece.y + y + dy;
        if (nextX < 0 || nextX >= cols || nextY >= rows) return true;
        if (nextY >= 0 && state.board[nextY][nextX]) return true;
      }
    }
    return false;
  }

  function updateStats() {
    stats.score.textContent = String(state.score);
    stats.lines.textContent = String(state.lines);
    stats.next.textContent = state.next;
  }

  function finish() {
    state.over = true;
    overlay.show({
      titleText: "方块堆满了",
      bodyHtml: `你一共消除了 <strong>${state.lines}</strong> 行，得到 <strong>${state.score}</strong> 分。`,
      onAction: reset,
    });
  }

  function spawnPiece() {
    state.current = createPiece(state.next);
    state.next = randomPieceType();
    updateStats();
    if (collides(state.current)) {
      finish();
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = rows - 1; y >= 0; y -= 1) {
      if (state.board[y].every(Boolean)) {
        state.board.splice(y, 1);
        state.board.unshift(Array(cols).fill(""));
        cleared += 1;
        y += 1;
      }
    }
    if (!cleared) return;
    state.lines += cleared;
    state.score += [0, 120, 320, 560, 900][cleared];
    state.dropInterval = Math.max(0.11, 0.66 - state.lines * 0.012);
    updateStats();
  }

  function mergeCurrent() {
    state.current.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (!value) return;
        const boardY = state.current.y + y;
        if (boardY >= 0) {
          state.board[boardY][state.current.x + x] = state.current.type;
        }
      });
    });
  }

  function drop() {
    if (!state.current || state.over) return;
    if (!collides(state.current, 0, 1)) {
      state.current.y += 1;
      return;
    }
    mergeCurrent();
    clearLines();
    spawnPiece();
  }

  function tryMove(dx) {
    if (!state.current || state.over) return;
    if (!collides(state.current, dx, 0)) {
      state.current.x += dx;
    }
  }

  function tryRotate() {
    if (!state.current || state.over) return;
    const rotated = rotateMatrix(state.current.matrix);
    if (!collides(state.current, 0, 0, rotated)) {
      state.current.matrix = rotated;
      return;
    }
    if (!collides(state.current, 1, 0, rotated)) {
      state.current.x += 1;
      state.current.matrix = rotated;
      return;
    }
    if (!collides(state.current, -1, 0, rotated)) {
      state.current.x -= 1;
      state.current.matrix = rotated;
    }
  }

  function reset() {
    state = {
      board: Array.from({ length: rows }, () => Array(cols).fill("")),
      score: 0,
      lines: 0,
      acc: 0,
      over: false,
      dropInterval: 0.66,
      current: null,
      next: randomPieceType(),
    };
    overlay.hide();
    spawnPiece();
    updateStats();
  }

  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * cell + 8, y * cell + 8, cell - 4, cell - 4);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x * cell + 12, y * cell + 12, cell - 18, 6);
    drawAvatarCircle(ctx, x * cell + cell / 2 + 6, y * cell + cell / 2 + 6, 9, {
      borderColor: "rgba(255,255,255,0.76)",
      borderWidth: 2,
      alpha: 0.92,
    });
  }

  function draw() {
    drawSkyBackground(ctx, canvas.width, canvas.height, "#1f232b", "#353841");
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let x = 0; x <= cols; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, rows * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(cols * cell, y * cell);
      ctx.stroke();
    }

    state.board.forEach((row, y) => {
      row.forEach((type, x) => {
        if (type) {
          drawCell(x, y, colors[type]);
        }
      });
    });

    if (state.current) {
      state.current.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (!value) return;
          const drawY = state.current.y + y;
          if (drawY >= 0) {
            drawCell(state.current.x + x, drawY, colors[state.current.type]);
          }
        });
      });
    }
  }

  addGlobalListener(disposer, window, "keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if (state.over && ["Enter", "Space"].includes(event.code)) {
      reset();
      return;
    }
    if (event.code === "ArrowLeft") tryMove(-1);
    if (event.code === "ArrowRight") tryMove(1);
    if (event.code === "ArrowDown") drop();
    if (["ArrowUp", "Space"].includes(event.code)) tryRotate();
  });

  disposer.raf((dt) => {
    if (!state.over) {
      state.acc += dt;
      if (state.acc >= state.dropInterval) {
        state.acc = 0;
        drop();
      }
    }
    draw();
  });

  reset();
  return () => disposer.destroy();
}

function mountBreakout(host) {
  const disposer = createDisposer();
  const { playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 840, height: 500 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "得分", value: "0" },
    { key: "lives", label: "生命", value: "3" },
    { key: "level", label: "关卡", value: "1" },
  ]);

  addPanelText(panel, "操作", "鼠标移动或 <span class='kbd'>←→</span> 控制挡板，<span class='kbd'>Space</span> 发球。");
  addPanelList(panel, "规则", [
    "所有砖块清空后自动进入下一关。",
    "掉球会损失生命，三次后失败。",
    "击中挡板不同位置会改变反弹角度。",
  ]);

  let state = null;
  const keys = { left: false, right: false };

  function makeBricks(level) {
    const bricks = [];
    const rows = 5 + Math.min(2, level - 1);
    const cols = 10;
    const brickWidth = 72;
    const brickHeight = 24;
    const startX = 40;
    const startY = 50;
    const colors = ["#ff8c69", "#ffd35c", "#7fd27b", "#63d1d0", "#5b8fff", "#c78cff", "#ff7cad"];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        bricks.push({
          x: startX + col * (brickWidth + 6),
          y: startY + row * (brickHeight + 8),
          w: brickWidth,
          h: brickHeight,
          hits: row < 2 && level > 1 ? 2 : 1,
          color: colors[row % colors.length],
        });
      }
    }

    return bricks;
  }

  function serveBall() {
    state.started = true;
    state.ball.vx = rand(-220, 220);
    state.ball.vy = -340;
  }

  function resetBall() {
    state.ball = { x: state.paddle.x + state.paddle.w / 2, y: state.paddle.y - 14, vx: 0, vy: 0, r: 10 };
    state.started = false;
  }

  function reset(level = 1) {
    state = {
      paddle: { x: 340, y: 446, w: 150, h: 16 },
      ball: null,
      bricks: makeBricks(level),
      level,
      lives: 3,
      score: 0,
      started: false,
      over: false,
    };
    resetBall();
    overlay.hide();
    updateStats();
  }

  function updateStats() {
    stats.score.textContent = String(state.score);
    stats.lives.textContent = String(state.lives);
    stats.level.textContent = String(state.level);
  }

  function nextLevel() {
    state.level += 1;
    state.bricks = makeBricks(state.level);
    state.paddle.w = Math.max(96, state.paddle.w - 8);
    resetBall();
    updateStats();
    showNotice(notice, `第 ${state.level} 关`);
  }

  function finish() {
    state.over = true;
    overlay.show({
      titleText: "挡板失守",
      bodyHtml: `你打到了 <strong>${state.score}</strong> 分，闯到第 <strong>${state.level}</strong> 关。`,
      onAction: () => reset(1),
    });
  }

  function update(dt) {
    if (state.over) return;

    if (keys.left) state.paddle.x -= 520 * dt;
    if (keys.right) state.paddle.x += 520 * dt;
    state.paddle.x = clamp(state.paddle.x, 10, canvas.width - state.paddle.w - 10);

    if (!state.started) {
      state.ball.x = state.paddle.x + state.paddle.w / 2;
      state.ball.y = state.paddle.y - 14;
      return;
    }

    state.ball.x += state.ball.vx * dt;
    state.ball.y += state.ball.vy * dt;

    if (state.ball.x - state.ball.r < 0 || state.ball.x + state.ball.r > canvas.width) {
      state.ball.vx *= -1;
    }
    if (state.ball.y - state.ball.r < 0) {
      state.ball.vy *= -1;
    }

    const paddleBox = state.paddle;
    if (circleRectCollision({ x: state.ball.x, y: state.ball.y, r: state.ball.r }, paddleBox) && state.ball.vy > 0) {
      const impact = (state.ball.x - (state.paddle.x + state.paddle.w / 2)) / (state.paddle.w / 2);
      state.ball.vx = impact * 320;
      state.ball.vy = -Math.abs(state.ball.vy);
    }

    for (let index = state.bricks.length - 1; index >= 0; index -= 1) {
      const brick = state.bricks[index];
      if (!circleRectCollision({ x: state.ball.x, y: state.ball.y, r: state.ball.r }, brick)) continue;
      brick.hits -= 1;
      state.score += 20;
      if (brick.hits <= 0) {
        state.bricks.splice(index, 1);
        state.score += 20;
      }

      const overlapLeft = state.ball.x + state.ball.r - brick.x;
      const overlapRight = brick.x + brick.w - (state.ball.x - state.ball.r);
      const overlapTop = state.ball.y + state.ball.r - brick.y;
      const overlapBottom = brick.y + brick.h - (state.ball.y - state.ball.r);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      if (minOverlap === overlapLeft || minOverlap === overlapRight) {
        state.ball.vx *= -1;
      } else {
        state.ball.vy *= -1;
      }
      updateStats();
      break;
    }

    if (!state.bricks.length) {
      nextLevel();
      return;
    }

    if (state.ball.y - state.ball.r > canvas.height) {
      state.lives -= 1;
      updateStats();
      if (state.lives <= 0) {
        finish();
        return;
      }
      resetBall();
      showNotice(notice, "掉球了");
    }
  }

  function draw() {
    drawSkyBackground(ctx, canvas.width, canvas.height, "#1e2737", "#0c1118");
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 36; i += 1) {
      ctx.fillRect((i * 137) % canvas.width, (i * 73) % canvas.height, 2, 2);
    }

    state.bricks.forEach((brick) => {
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      if (brick.hits > 1) {
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.fillRect(brick.x + 8, brick.y + 7, brick.w - 16, 5);
      }
      drawAvatarCircle(ctx, brick.x + brick.w / 2, brick.y + brick.h / 2, 7, {
        borderColor: "rgba(255,255,255,0.68)",
        borderWidth: 2,
        alpha: 0.85,
      });
    });

    ctx.fillStyle = "#f3f0ea";
    ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h);

    drawAvatarCircle(ctx, state.ball.x, state.ball.y, state.ball.r, { borderColor: "#ff824b", borderWidth: 3 });
  }

  addGlobalListener(disposer, canvas, "pointermove", (event) => {
    const point = canvasPoint(canvas, event);
    state.paddle.x = clamp(point.x - state.paddle.w / 2, 10, canvas.width - state.paddle.w - 10);
  });

  addGlobalListener(disposer, window, "keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === "ArrowLeft") keys.left = true;
    if (event.code === "ArrowRight") keys.right = true;
    if (event.code === "Space") {
      if (state.over) {
        reset(1);
      } else if (!state.started) {
        serveBall();
      }
    }
  });

  addGlobalListener(disposer, window, "keyup", (event) => {
    if (event.code === "ArrowLeft") keys.left = false;
    if (event.code === "ArrowRight") keys.right = false;
  });

  disposer.raf((dt) => {
    update(dt);
    draw();
  });

  reset();
  return () => disposer.destroy();
}

function mountFlappyBird(host) {
  const disposer = createDisposer();
  const { playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 500, height: 720 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "得分", value: "0" },
    { key: "best", label: "最佳", value: String(safeGet("arcade.flappy.best", 0)) },
    { key: "status", label: "状态", value: "待起飞" },
  ]);

  addPanelText(panel, "操作", "点击画布或按 <span class='kbd'>Space</span> / <span class='kbd'>↑</span> 让小鸟上扬。");
  addPanelList(panel, "规则", [
    "第一次操作后游戏正式开始。",
    "穿过每组管道加 1 分。",
    "撞到管道或地面就结束。",
  ]);

  let best = safeGet("arcade.flappy.best", 0);
  let state = null;

  function reset() {
    state = {
      bird: { x: 126, y: 280, vy: 0, r: 18 },
      pipes: [],
      score: 0,
      started: false,
      over: false,
      pipeTimer: 1.2,
      bob: 0,
    };
    overlay.hide();
    stats.score.textContent = "0";
    stats.best.textContent = String(best);
    stats.status.textContent = "待起飞";
  }

  function flap() {
    if (state.over) {
      reset();
      return;
    }
    state.started = true;
    state.bird.vy = -310;
    stats.status.textContent = "飞行中";
  }

  function finish() {
    state.over = true;
    best = Math.max(best, state.score);
    safeSet("arcade.flappy.best", best);
    stats.best.textContent = String(best);
    stats.status.textContent = "已坠机";
    overlay.show({
      titleText: "像素鸟坠机",
      bodyHtml: `本轮穿过了 <strong>${state.score}</strong> 组管道，最佳 <strong>${best}</strong>。`,
      onAction: reset,
    });
  }

  function spawnPipe() {
    state.pipes.push({
      x: canvas.width + 80,
      gapY: rand(170, 430),
      gap: 160,
      w: 70,
      scored: false,
    });
  }

  function update(dt) {
    state.bob += dt * 3;
    if (!state.started || state.over) return;

    state.bird.vy += 760 * dt;
    state.bird.y += state.bird.vy * dt;

    state.pipeTimer -= dt;
    if (state.pipeTimer <= 0) {
      spawnPipe();
      state.pipeTimer = 1.55;
    }

    state.pipes.forEach((pipe) => {
      pipe.x -= 210 * dt;
      if (!pipe.scored && pipe.x + pipe.w < state.bird.x) {
        pipe.scored = true;
        state.score += 1;
        stats.score.textContent = String(state.score);
      }

      const hitTop = circleRectCollision(
        { x: state.bird.x, y: state.bird.y, r: state.bird.r },
        { x: pipe.x, y: 0, w: pipe.w, h: pipe.gapY - pipe.gap / 2 }
      );
      const hitBottom = circleRectCollision(
        { x: state.bird.x, y: state.bird.y, r: state.bird.r },
        { x: pipe.x, y: pipe.gapY + pipe.gap / 2, w: pipe.w, h: canvas.height }
      );
      if (hitTop || hitBottom) {
        finish();
      }
    });

    state.pipes = state.pipes.filter((pipe) => pipe.x + pipe.w > -20);

    if (state.bird.y - state.bird.r < 0 || state.bird.y + state.bird.r > canvas.height - 54) {
      finish();
    }
  }

  function draw() {
    drawSkyBackground(ctx, canvas.width, canvas.height, "#90d7ff", "#dff5ff");
    ctx.fillStyle = "rgba(255,255,255,0.84)";
    ctx.font = "30px serif";
    ctx.fillText("☁︎", 60, 80);
    ctx.fillText("☁︎", 220, 140);
    ctx.fillText("☁︎", 330, 95);

    ctx.fillStyle = "#f6c04e";
    ctx.beginPath();
    ctx.arc(420, 80, 36, 0, Math.PI * 2);
    ctx.fill();

    state.pipes.forEach((pipe) => {
      ctx.fillStyle = "#44a55a";
      ctx.fillRect(pipe.x, 0, pipe.w, pipe.gapY - pipe.gap / 2);
      ctx.fillRect(pipe.x, pipe.gapY + pipe.gap / 2, pipe.w, canvas.height);
      ctx.fillStyle = "#368545";
      ctx.fillRect(pipe.x - 6, pipe.gapY - pipe.gap / 2 - 14, pipe.w + 12, 14);
      ctx.fillRect(pipe.x - 6, pipe.gapY + pipe.gap / 2, pipe.w + 12, 14);
    });

    ctx.fillStyle = "#8bc96a";
    ctx.fillRect(0, canvas.height - 54, canvas.width, 54);
    ctx.fillStyle = "#cca26d";
    ctx.fillRect(0, canvas.height - 18, canvas.width, 18);

    const birdY = state.started ? state.bird.y : state.bird.y + Math.sin(state.bob) * 12;
    drawAvatarCircle(ctx, state.bird.x, birdY, state.bird.r, { borderColor: "#ffd35c", borderWidth: 4 });

    if (!state.started && !state.over) {
      ctx.fillStyle = "rgba(32, 26, 23, 0.7)";
      ctx.font = "bold 26px Avenir Next";
      ctx.fillText("点击或空格开始", 128, 180);
    }
  }

  addGlobalListener(disposer, playfield, "pointerdown", () => flap());
  addGlobalListener(disposer, window, "keydown", (event) => {
    if (["Space", "ArrowUp"].includes(event.code)) {
      event.preventDefault();
      flap();
    }
  });

  disposer.raf((dt) => {
    update(dt);
    draw();
  });

  reset();
  return () => disposer.destroy();
}

function mountGame2048(host) {
  const disposer = createDisposer();
  const { playfield, panel, notice } = createGameLayout(host, { canvas: false });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "分数", value: "0" },
    { key: "best", label: "最佳", value: String(safeGet("arcade.2048.best", 0)) },
    { key: "peak", label: "峰值", value: "2" },
  ]);

  addPanelText(panel, "操作", "<span class='kbd'>↑↓←→</span> 或 <span class='kbd'>WASD</span> 合并方块。");
  addPanelList(panel, "规则", [
    "相同数字碰撞后会合并。",
    "每次移动后会随机生成新数字。",
    "棋盘填满且无法移动就结束。",
  ]);

  playfield.style.padding = "18px";
  const boardEl = el("div", "board-2048");
  const tiles = [];
  playfield.append(boardEl);
  for (let i = 0; i < 16; i += 1) {
    const tile = el("div", "tile-2048", "");
    tile.dataset.v = "0";
    boardEl.append(tile);
    tiles.push(tile);
  }

  let best = safeGet("arcade.2048.best", 0);
  let state = null;

  function transpose(matrix) {
    return matrix[0].map((_, index) => matrix.map((row) => row[index]));
  }

  function slideLine(line) {
    const values = line.filter(Boolean);
    const merged = [];
    let gained = 0;

    for (let i = 0; i < values.length; i += 1) {
      if (values[i] === values[i + 1]) {
        const value = values[i] * 2;
        merged.push(value);
        gained += value;
        i += 1;
      } else {
        merged.push(values[i]);
      }
    }

    while (merged.length < 4) {
      merged.push(0);
    }

    return {
      line: merged,
      gained,
      moved: merged.some((value, index) => value !== line[index]),
    };
  }

  function spawnTile() {
    const empty = [];
    state.board.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (!value) empty.push([rowIndex, colIndex]);
      });
    });
    if (!empty.length) return;
    const [row, col] = choice(empty);
    state.board[row][col] = Math.random() > 0.9 ? 4 : 2;
  }

  function highestTile() {
    return Math.max(...state.board.flat());
  }

  function canMove() {
    if (state.board.some((row) => row.includes(0))) return true;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const value = state.board[row][col];
        if (state.board[row + 1]?.[col] === value || state.board[row]?.[col + 1] === value) {
          return true;
        }
      }
    }
    return false;
  }

  function updateStats() {
    stats.score.textContent = String(state.score);
    stats.best.textContent = String(best);
    stats.peak.textContent = String(highestTile());
  }

  function render() {
    state.board.flat().forEach((value, index) => {
      tiles[index].dataset.v = String(value);
      tiles[index].textContent = value ? String(value) : "";
    });
    updateStats();
  }

  function finish() {
    state.over = true;
    overlay.show({
      titleText: "棋盘塞满了",
      bodyHtml: `最终得分 <strong>${state.score}</strong>，最高拼到 <strong>${highestTile()}</strong>。`,
      onAction: reset,
    });
  }

  function move(direction) {
    if (state.over) {
      reset();
      return;
    }

    let board = state.board.map((row) => [...row]);
    let restore = (matrix) => matrix;

    if (direction === "right") {
      board = board.map((row) => [...row].reverse());
      restore = (matrix) => matrix.map((row) => [...row].reverse());
    }
    if (direction === "up") {
      board = transpose(board);
      restore = (matrix) => transpose(matrix);
    }
    if (direction === "down") {
      board = transpose(board).map((row) => [...row].reverse());
      restore = (matrix) => transpose(matrix.map((row) => [...row].reverse()));
    }

    let moved = false;
    let gained = 0;
    board = board.map((line) => {
      const result = slideLine(line);
      moved = moved || result.moved;
      gained += result.gained;
      return result.line;
    });

    if (!moved) return;

    state.board = restore(board);
    state.score += gained;
    best = Math.max(best, state.score);
    safeSet("arcade.2048.best", best);
    spawnTile();
    render();

    if (!canMove()) {
      finish();
    }
  }

  function reset() {
    state = {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      score: 0,
      over: false,
    };
    spawnTile();
    spawnTile();
    overlay.hide();
    render();
  }

  addGlobalListener(disposer, window, "keydown", (event) => {
    const map = {
      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
      ArrowUp: "up",
      KeyW: "up",
      ArrowDown: "down",
      KeyS: "down",
    };
    if (map[event.code]) {
      event.preventDefault();
      move(map[event.code]);
    }
  });

  reset();
  return () => disposer.destroy();
}

function mountWhackAMole(host) {
  const disposer = createDisposer();
  const { playfield, panel, notice } = createGameLayout(host, { canvas: false });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "得分", value: "0" },
    { key: "time", label: "剩余", value: "30s" },
    { key: "combo", label: "连击", value: "0" },
  ]);

  addPanelText(panel, "操作", "直接点击冒头的地鼠。打到越快，刷新节奏越高。");
  addPanelList(panel, "规则", [
    "每轮 30 秒。",
    "击中目标会提高连击奖励。",
    "游戏结束后点击任意地洞或重开按钮继续。",
  ]);

  playfield.style.padding = "18px";
  const grid = el("div", "mole-grid");
  const holes = [];
  playfield.append(grid);

  for (let i = 0; i < 9; i += 1) {
    const hole = el("button", "hole");
    hole.type = "button";
    hole.append(createAvatarFace({ className: "large", ring: "rgba(255,255,255,0.9)" }));
    hole.addEventListener("click", () => hit(i));
    grid.append(hole);
    holes.push(hole);
  }

  let state = null;

  function updateStats() {
    stats.score.textContent = String(state.score);
    stats.time.textContent = `${Math.max(0, Math.ceil(state.timeLeft))}s`;
    stats.combo.textContent = String(state.combo);
  }

  function render() {
    holes.forEach((hole, index) => {
      hole.classList.toggle("active", index === state.activeHole);
    });
    updateStats();
  }

  function reset() {
    state = {
      score: 0,
      timeLeft: 30,
      combo: 0,
      activeHole: -1,
      popTimer: 0,
      nextDelay: 0.72,
      over: false,
    };
    overlay.hide();
    render();
  }

  function finish() {
    state.over = true;
    state.activeHole = -1;
    render();
    overlay.show({
      titleText: "收工了",
      bodyHtml: `30 秒内你一共打中了 <strong>${state.score}</strong> 次。`,
      onAction: reset,
    });
  }

  function hit(index) {
    if (state.over) {
      reset();
      return;
    }
    if (index !== state.activeHole) {
      state.combo = 0;
      render();
      return;
    }
    state.score += 1 + Math.floor(state.combo / 3);
    state.combo += 1;
    state.activeHole = -1;
    state.nextDelay = Math.max(0.28, state.nextDelay - 0.018);
    showNotice(notice, "+1 命中");
    render();
  }

  disposer.raf((dt) => {
    if (state.over) return;
    state.timeLeft -= dt;
    state.popTimer += dt;
    if (state.popTimer >= state.nextDelay) {
      state.popTimer = 0;
      state.activeHole = randInt(0, 8);
    }
    if (state.timeLeft <= 0) {
      finish();
    } else {
      updateStats();
      holes.forEach((hole, index) => {
        hole.classList.toggle("active", index === state.activeHole);
      });
    }
  });

  reset();
  return () => disposer.destroy();
}

function mountSpaceShooter(host) {
  const disposer = createDisposer();
  const { playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 820, height: 520 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "得分", value: "0" },
    { key: "lives", label: "护盾", value: "3" },
    { key: "wave", label: "波次", value: "1" },
  ]);

  addPanelText(panel, "操作", "<span class='kbd'>←→</span> / <span class='kbd'>AD</span> 移动，<span class='kbd'>Space</span> 发射。");
  addPanelList(panel, "规则", [
    "清空一整波敌人后自动进入下一波。",
    "敌方子弹会削减护盾。",
    "敌军压到底线会直接失败。",
  ]);

  const keys = { left: false, right: false, fire: false };
  let state = null;

  function makeEnemies(wave) {
    const enemies = [];
    const rows = 3 + Math.min(2, wave - 1);
    const cols = 8;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        enemies.push({ x: 100 + col * 72, y: 72 + row * 52, w: 42, h: 24 });
      }
    }
    return enemies;
  }

  function updateStats() {
    stats.score.textContent = String(state.score);
    stats.lives.textContent = String(state.lives);
    stats.wave.textContent = String(state.wave);
  }

  function reset() {
    state = {
      player: { x: 384, y: 466, w: 52, h: 24 },
      bullets: [],
      enemyBullets: [],
      enemies: makeEnemies(1),
      dir: 1,
      score: 0,
      lives: 3,
      wave: 1,
      fireCooldown: 0,
      enemyShotTimer: 0.9,
      over: false,
    };
    overlay.hide();
    updateStats();
  }

  function finish() {
    state.over = true;
    overlay.show({
      titleText: "舰队失守",
      bodyHtml: `你扛到了第 <strong>${state.wave}</strong> 波，最终得分 <strong>${state.score}</strong>。`,
      onAction: reset,
    });
  }

  function nextWave() {
    state.wave += 1;
    state.enemies = makeEnemies(state.wave);
    state.dir = 1;
    state.enemyBullets = [];
    state.bullets = [];
    updateStats();
    showNotice(notice, `第 ${state.wave} 波来袭`);
  }

  function fireEnemy() {
    if (!state.enemies.length) return;
    const columns = new Map();
    state.enemies.forEach((enemy) => {
      const key = Math.round(enemy.x);
      const current = columns.get(key);
      if (!current || enemy.y > current.y) {
        columns.set(key, enemy);
      }
    });
    const shooter = choice([...columns.values()]);
    if (!shooter) return;
    state.enemyBullets.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h, r: 5, vy: 260 + state.wave * 18 });
  }

  function update(dt) {
    if (state.over) return;

    if (keys.left) state.player.x -= 360 * dt;
    if (keys.right) state.player.x += 360 * dt;
    state.player.x = clamp(state.player.x, 20, canvas.width - state.player.w - 20);

    state.fireCooldown -= dt;
    if (keys.fire && state.fireCooldown <= 0) {
      state.bullets.push({ x: state.player.x + state.player.w / 2, y: state.player.y, r: 4, vy: -460 });
      state.fireCooldown = 0.22;
    }

    state.enemyShotTimer -= dt;
    if (state.enemyShotTimer <= 0) {
      fireEnemy();
      state.enemyShotTimer = rand(0.65, 1.1);
    }

    state.bullets.forEach((bullet) => {
      bullet.y += bullet.vy * dt;
    });
    state.enemyBullets.forEach((bullet) => {
      bullet.y += bullet.vy * dt;
    });
    state.bullets = state.bullets.filter((bullet) => bullet.y > -20);
    state.enemyBullets = state.enemyBullets.filter((bullet) => bullet.y < canvas.height + 20);

    const speed = 38 + state.wave * 6 + (30 - state.enemies.length) * 1.2;
    let hitEdge = false;
    state.enemies.forEach((enemy) => {
      enemy.x += state.dir * speed * dt;
      if (enemy.x < 18 || enemy.x + enemy.w > canvas.width - 18) {
        hitEdge = true;
      }
    });
    if (hitEdge) {
      state.dir *= -1;
      state.enemies.forEach((enemy) => {
        enemy.y += 16;
      });
    }

    for (let bulletIndex = state.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      const bullet = state.bullets[bulletIndex];
      const hitIndex = state.enemies.findIndex((enemy) => rectsOverlap({ x: bullet.x - bullet.r, y: bullet.y - bullet.r, w: bullet.r * 2, h: bullet.r * 2 }, enemy));
      if (hitIndex >= 0) {
        state.enemies.splice(hitIndex, 1);
        state.bullets.splice(bulletIndex, 1);
        state.score += 40;
        updateStats();
      }
    }

    for (let bulletIndex = state.enemyBullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      const bullet = state.enemyBullets[bulletIndex];
      if (rectsOverlap({ x: bullet.x - bullet.r, y: bullet.y - bullet.r, w: bullet.r * 2, h: bullet.r * 2 }, state.player)) {
        state.enemyBullets.splice(bulletIndex, 1);
        state.lives -= 1;
        updateStats();
        showNotice(notice, "护盾受损");
        if (state.lives <= 0) {
          finish();
          return;
        }
      }
    }

    if (state.enemies.some((enemy) => enemy.y + enemy.h >= state.player.y - 10)) {
      finish();
      return;
    }

    if (!state.enemies.length) {
      nextWave();
    }
  }

  function draw() {
    drawSkyBackground(ctx, canvas.width, canvas.height, "#101828", "#05080f");
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 80; i += 1) {
      ctx.fillRect((i * 67) % canvas.width, (i * 139) % canvas.height, 2, 2);
    }

    drawAvatarCircle(ctx, state.player.x + state.player.w / 2, state.player.y + state.player.h / 2, 24, {
      borderColor: "#63d1d0",
      borderWidth: 4,
    });

    ctx.fillStyle = "#ffd35c";
    state.bullets.forEach((bullet) => {
      ctx.fillRect(bullet.x - 2, bullet.y - 10, 4, 12);
    });

    ctx.fillStyle = "#ff8c69";
    state.enemyBullets.forEach((bullet) => {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
      ctx.fill();
    });

    state.enemies.forEach((enemy, index) => {
      drawAvatarCircle(ctx, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 18, {
        borderColor: index % 2 ? "#ff824b" : "#ffd35c",
        borderWidth: 4,
      });
    });
  }

  addGlobalListener(disposer, window, "keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = true;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = true;
    if (event.code === "Space") keys.fire = true;
  });

  addGlobalListener(disposer, window, "keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
    if (event.code === "Space") keys.fire = false;
  });

  disposer.raf((dt) => {
    update(dt);
    draw();
  });

  reset();
  return () => disposer.destroy();
}

function mountMemoryMatch(host) {
  const disposer = createDisposer();
  const { playfield, panel } = createGameLayout(host, { canvas: false });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "moves", label: "步数", value: "0" },
    { key: "pairs", label: "配对", value: "0/8" },
    { key: "time", label: "用时", value: "0s" },
  ]);

  addPanelText(panel, "操作", "翻开两张牌，如果相同就保留，不同则翻回去。");
  addPanelList(panel, "目标", [
    "总共 8 对图案。",
    "尽量减少翻牌步数。",
    "全部配对完成后自动结算。",
  ]);

  playfield.style.padding = "18px";
  const grid = el("div", "memory-grid");
  playfield.append(grid);

  const faces = ["跑酷", "吃果", "弹射", "守塔", "消行", "打砖", "飞鸟", "射击"];
  const cards = [];
  let state = null;
  let session = 0;

  for (let i = 0; i < 16; i += 1) {
    const card = el("button", "memory-card", "?");
    card.type = "button";
    card.addEventListener("click", () => flipCard(i));
    grid.append(card);
    cards.push(card);
  }

  function updateStats() {
    stats.moves.textContent = String(state.moves);
    stats.pairs.textContent = `${state.matches}/8`;
    stats.time.textContent = `${Math.floor(state.time)}s`;
  }

  function render() {
    state.cards.forEach((card, index) => {
      const node = cards[index];
      node.classList.toggle("flipped", card.flipped);
      node.classList.toggle("matched", card.matched);
      node.textContent = card.flipped || card.matched ? card.face : "?";
    });
    updateStats();
  }

  function reset() {
    session += 1;
    const shuffled = shuffle([...faces, ...faces]);
    state = {
      cards: shuffled.map((face) => ({ face, flipped: false, matched: false })),
      open: [],
      moves: 0,
      matches: 0,
      time: 0,
      lock: false,
      over: false,
    };
    overlay.hide();
    render();
  }

  function finish() {
    state.over = true;
    overlay.show({
      titleText: "记忆清空",
      bodyHtml: `你用了 <strong>${state.moves}</strong> 步，耗时 <strong>${Math.floor(state.time)}</strong> 秒完成全配对。`,
      onAction: reset,
    });
  }

  function flipCard(index) {
    if (state.over) {
      reset();
      return;
    }
    if (state.lock) return;
    const card = state.cards[index];
    if (card.flipped || card.matched) return;

    card.flipped = true;
    state.open.push(index);
    render();

    if (state.open.length < 2) return;

    state.moves += 1;
    const [firstIndex, secondIndex] = state.open;
    const first = state.cards[firstIndex];
    const second = state.cards[secondIndex];

    if (first.face === second.face) {
      first.matched = true;
      second.matched = true;
      state.matches += 1;
      state.open = [];
      render();
      if (state.matches === 8) {
        finish();
      }
      return;
    }

    state.lock = true;
    const token = session;
    disposer.timeout(() => {
      if (token !== session) return;
      first.flipped = false;
      second.flipped = false;
      state.open = [];
      state.lock = false;
      render();
    }, 700);
  }

  disposer.raf((dt) => {
    if (!state.over) {
      state.time += dt;
      updateStats();
    }
  });

  reset();
  return () => disposer.destroy();
}

function mountSimonSays(host) {
  const disposer = createDisposer();
  const { playfield, panel, notice } = createGameLayout(host, { canvas: false });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "round", label: "轮次", value: "0" },
    { key: "best", label: "最佳", value: String(safeGet("arcade.simon.best", 0)) },
    { key: "status", label: "状态", value: "准备中" },
  ]);

  addPanelText(panel, "操作", "记住亮起顺序并按同样顺序点回去。");
  addPanelList(panel, "规则", [
    "每通过一轮，序列会增加 1 个色块。",
    "播放阶段不能点击。",
    "点错任何一步都会立即失败。",
  ]);

  playfield.style.padding = "18px";
  const grid = el("div", "simon-grid");
  playfield.append(grid);

  const colors = ["#ff824b", "#ffd35c", "#45b584", "#0e8f8c"];
  const pads = [];
  let best = safeGet("arcade.simon.best", 0);
  let state = null;
  let session = 0;

  for (let i = 0; i < 4; i += 1) {
    const pad = el("button", "simon-pad");
    pad.type = "button";
    pad.style.background = colors[i];
    pad.append(createAvatarFace({ className: "medium", ring: "rgba(255,255,255,0.58)" }));
    pad.addEventListener("click", () => pressPad(i));
    grid.append(pad);
    pads.push(pad);
  }

  function updateStats() {
    stats.round.textContent = String(Math.max(0, state.sequence.length - (state.accepting ? 0 : 1)));
    stats.best.textContent = String(best);
    stats.status.textContent = state.accepting ? "轮到你" : "播放中";
  }

  function schedule(callback, delay) {
    const token = session;
    disposer.timeout(() => {
      if (token === session) callback();
    }, delay);
  }

  function lightPad(index) {
    pads[index].classList.add("lit");
    schedule(() => pads[index].classList.remove("lit"), 280);
  }

  function playSequence() {
    state.accepting = false;
    updateStats();
    state.sequence.forEach((index, order) => {
      schedule(() => lightPad(index), 500 + order * 600);
    });
    schedule(() => {
      state.accepting = true;
      updateStats();
      showNotice(notice, "轮到你了");
    }, 500 + state.sequence.length * 600);
  }

  function nextRound() {
    state.sequence.push(randInt(0, 3));
    state.inputIndex = 0;
    playSequence();
  }

  function reset() {
    session += 1;
    state = {
      sequence: [],
      inputIndex: 0,
      accepting: false,
      over: false,
    };
    overlay.hide();
    updateStats();
    schedule(nextRound, 500);
  }

  function finish() {
    state.over = true;
    best = Math.max(best, Math.max(0, state.sequence.length - 1));
    safeSet("arcade.simon.best", best);
    stats.best.textContent = String(best);
    overlay.show({
      titleText: "顺序记错了",
      bodyHtml: `你成功完成了 <strong>${Math.max(0, state.sequence.length - 1)}</strong> 轮。`,
      onAction: reset,
    });
  }

  function pressPad(index) {
    if (state.over) {
      reset();
      return;
    }
    if (!state.accepting) return;
    lightPad(index);
    if (state.sequence[state.inputIndex] !== index) {
      finish();
      return;
    }
    state.inputIndex += 1;
    if (state.inputIndex === state.sequence.length) {
      state.accepting = false;
      updateStats();
      schedule(nextRound, 700);
    }
  }

  reset();
  return () => disposer.destroy();
}

function mountZmjjkkTrial(host) {
  const disposer = createDisposer();
  const { shell, playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 1600, height: 900 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "score", label: "热度", value: "0" },
    { key: "hp", label: "血量", value: "100" },
    { key: "ult", label: "绝招", value: "0%" },
  ]);

  host.classList.add("boss-host");
  shell.classList.add("boss-shell");
  playfield.classList.add("boss-playfield");
  panel.classList.add("boss-panel");
  canvas.classList.add("boss-canvas");
  playfield.style.cursor = "crosshair";
  const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const exitFullscreen = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    return Promise.resolve();
  };
  const requestFullscreen = () => {
    if (playfield.requestFullscreen) return playfield.requestFullscreen();
    if (playfield.webkitRequestFullscreen) return playfield.webkitRequestFullscreen();
    return Promise.reject(new Error("fullscreen unsupported"));
  };
  disposer.add(() => {
    host.classList.remove("boss-host");
    if (getFullscreenElement() === playfield) {
      Promise.resolve(exitFullscreen()).catch(() => {});
    }
  });

  const bossTools = el("div", "tool-row boss-tools");
  const fullscreenBtn = el("button", "small-button", "全屏作战");
  bossTools.append(fullscreenBtn);
  panel.append(bossTools);
  addPanelText(
    panel,
    "操作",
    "<span class='kbd'>WASD</span> 移动，鼠标瞄准，长按左键 / <span class='kbd'>Space</span> 连射，<span class='kbd'>Shift</span> 冲刺，<span class='kbd'>Q</span> 开大。"
  );
  addPanelList(panel, "战术词条", [
    "命中会叠加连杀热度，贴近圆心算高伤爆头。",
    "大招“神罚一狙”启动后，射击穿透并减速全场。",
    "最终 Boss 分三阶段，梗图弹幕和扫射模式会持续升级。",
  ]);

  const statusSection = el("section", "");
  statusSection.append(el("h4", "", "战况直播"));
  const waveLine = el("p", "stat-line");
  const waveLabel = el("span", "", "波次");
  const waveValue = el("strong", "", "1");
  waveLine.append(waveLabel, waveValue);
  const comboLine = el("p", "stat-line");
  const comboLabel = el("span", "", "连杀");
  const comboValue = el("strong", "", "0");
  comboLine.append(comboLabel, comboValue);
  const dashLine = el("p", "stat-line");
  const dashLabel = el("span", "", "冲刺");
  const dashValue = el("strong", "", "就绪");
  dashLine.append(dashLabel, dashValue);
  const modeLine = el("p", "stat-line");
  const modeLabel = el("span", "", "模式");
  const modeValue = el("strong", "", "热手");
  modeLine.append(modeLabel, modeValue);
  const bestLine = el("p", "stat-line");
  const bestLabel = el("span", "", "最佳热度");
  const bestValue = el("strong", "", String(safeGet("arcade.zmjjkk.best", 0)));
  bestLine.append(bestLabel, bestValue);
  statusSection.append(waveLine, comboLine, dashLine, modeLine, bestLine);
  panel.append(statusSection);

  const feedSection = el("section", "");
  feedSection.append(el("h4", "", "弹幕回放"));
  const feedList = el("ul", "tip-list");
  feedSection.append(feedList);
  panel.append(feedSection);

  const memePool = {
    intro: [
      "EDG 进点，康康开转。",
      "你先别急，手感正在加载。",
      "这把不讲道理，只讲准星。",
    ],
    wave: [
      "这波有说法。",
      "稳住，我们能赢。",
      "不是哥们，还真要一穿五？",
    ],
    kill: [
      "一枪一个，这就是教学局。",
      "别急，热度刚起来。",
      "我超，这也太准了。",
      "进点，继续进点。",
      "这波属于纯手法。",
    ],
    phase: [
      "不是哥们，Boss 真红温了。",
      "第二阶段启动，梗图弹幕加倍。",
      "第三阶段：脸都骑你脸上了。",
    ],
    hurt: [
      "别上头，先活着。",
      "这波有点抽象了。",
      "先别红温，还有残局。",
    ],
    ult: [
      "开了？没开，是神罚模式。",
      "锁头没有，准星到位。",
      "EDG! EDG! EDG!",
    ],
    win: [
      "这把叫康康个人秀。",
      "全场静音，只剩操作。",
      "收工，热梗和人头一起到账。",
    ],
  };

  const keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    Space: false,
  };
  const mouse = {
    x: canvas.width * 0.76,
    y: canvas.height * 0.5,
    down: false,
  };

  let best = safeGet("arcade.zmjjkk.best", 0);
  let state = null;

  function pushFeed(text) {
    state.feed.unshift(text);
    state.feed = state.feed.slice(0, 6);
    feedList.innerHTML = "";
    state.feed.forEach((item) => feedList.append(el("li", "", item)));
  }

  function syncFullscreenLabel() {
    fullscreenBtn.textContent = getFullscreenElement() === playfield ? "退出全屏" : "全屏作战";
  }

  async function toggleFullscreen() {
    try {
      if (getFullscreenElement() === playfield) {
        await exitFullscreen();
      } else {
        await requestFullscreen();
      }
    } catch {
      showNotice(notice, "当前浏览器不支持全屏", 1000);
    } finally {
      syncFullscreenLabel();
    }
  }

  function spawnText(text, x, y, color = "white", size = 18, life = 0.9) {
    state.texts.push({ text, x, y, vx: rand(-18, 18), vy: rand(-48, -16), color, size, life, maxLife: life });
  }

  function spawnParticle({
    x,
    y,
    vx = 0,
    vy = 0,
    life = 0.5,
    size = 3,
    color = "rgba(255,255,255,0.9)",
  }) {
    state.particles.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }

  function screenShake(amount) {
    state.shake = Math.max(state.shake, amount);
  }

  function aimedVelocity(fromX, fromY, toX, toY, speed) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy) || 1;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed };
  }

  function radialBullets(originX, originY, count, speed, startAngle = 0, options = {}) {
    for (let i = 0; i < count; i += 1) {
      const angle = startAngle + (Math.PI * 2 * i) / count;
      state.enemyBullets.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: options.r ?? 6,
        damage: options.damage ?? 10,
        color: options.color ?? "#ff8c69",
        trail: [],
      });
    }
  }

  function fanBullets(originX, originY, targetX, targetY, count, speed, spread = 0.18, options = {}) {
    const base = Math.atan2(targetY - originY, targetX - originX);
    const centerOffset = (count - 1) / 2;
    for (let i = 0; i < count; i += 1) {
      const angle = base + (i - centerOffset) * spread;
      state.enemyBullets.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: options.r ?? 6,
        damage: options.damage ?? 12,
        color: options.color ?? "#ffd35c",
        trail: [],
      });
    }
  }

  function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy || 1;
    const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1);
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    return distance(px, py, cx, cy);
  }

  function addLaser(originX, originY, angle, telegraph = 0.7, active = 0.26, damage = 18) {
    const reach = 1400;
    state.lasers.push({
      x1: originX,
      y1: originY,
      x2: originX + Math.cos(angle) * reach,
      y2: originY + Math.sin(angle) * reach,
      telegraph,
      active,
      life: telegraph + active,
      damage,
      hitTimer: 0,
    });
  }

  function spawnEnemy(kind, waveLevel = 1) {
    const common = {
      x: rand(canvas.width * 0.6, canvas.width - 60),
      y: rand(70, canvas.height - 70),
      trail: [],
      wobble: rand(0, Math.PI * 2),
      flash: 0,
      score: 35,
    };

    if (kind === "rusher") {
      return {
        ...common,
        kind,
        r: 22,
        hp: 78 + waveLevel * 16,
        maxHp: 78 + waveLevel * 16,
        speed: 88 + waveLevel * 8,
        fireCd: rand(1.0, 1.5),
        score: 45,
      };
    }

    if (kind === "sniper") {
      return {
        ...common,
        kind,
        r: 20,
        hp: 54 + waveLevel * 12,
        maxHp: 54 + waveLevel * 12,
        speed: 54,
        fireCd: rand(0.8, 1.2),
        driftY: rand(-1, 1),
        score: 60,
      };
    }

    if (kind === "orbiter") {
      const anchorX = rand(canvas.width * 0.62, canvas.width * 0.84);
      const anchorY = rand(120, canvas.height - 120);
      return {
        ...common,
        kind,
        anchorX,
        anchorY,
        orbitAngle: rand(0, Math.PI * 2),
        orbitDir: Math.random() > 0.5 ? 1 : -1,
        orbitRadius: rand(40, 76),
        r: 24,
        hp: 96 + waveLevel * 14,
        maxHp: 96 + waveLevel * 14,
        fireCd: rand(1.1, 1.5),
        score: 72,
      };
    }

    return {
      ...common,
      kind: "tank",
      r: 30,
      hp: 168 + waveLevel * 22,
      maxHp: 168 + waveLevel * 22,
      speed: 36,
      fireCd: rand(1.2, 1.7),
      score: 110,
    };
  }

  function spawnWave(index) {
    state.wave = index;
    const waveSpecs = [
      { name: "热手机场", banner: "先热手，再接管比赛。", roster: [["rusher", 4], ["sniper", 2]] },
      { name: "梗图高地", banner: "你先别急，这波真有说法。", roster: [["rusher", 4], ["orbiter", 3], ["sniper", 2]] },
      { name: "残局加载", banner: "不是哥们，真要开始转了。", roster: [["rusher", 5], ["orbiter", 3], ["tank", 2]] },
    ];

    const spec = waveSpecs[index - 1];
    if (!spec) {
      spawnBoss();
      return;
    }

    spec.roster.forEach(([kind, count]) => {
      for (let i = 0; i < count; i += 1) {
        state.enemies.push(spawnEnemy(kind, index));
      }
    });

    state.banner = { text: spec.banner, life: 2.2, maxLife: 2.2 };
    pushFeed(`第 ${index} 波：${spec.name}`);
    showNotice(notice, spec.banner, 1600);
  }

  function spawnBoss() {
    state.boss = {
      x: canvas.width * 0.72,
      y: 116,
      r: 84,
      hp: 1980,
      maxHp: 1980,
      phase: 1,
      patternCd: 0.8,
      spiralAngle: 0,
      specialCd: 2.4,
      spawnCd: 3.6,
      dashTimer: 0,
      dashVectorX: 0,
      dashVectorY: 0,
      hitFlash: 0,
      tauntCd: 1.2,
    };
    state.banner = { text: "最终残局：ZmjjKK 神狙试炼", life: 2.8, maxLife: 2.8 };
    pushFeed("Boss 入场：不是哥们脸阵，启动。");
    showNotice(notice, "Boss 战开始", 2000);
  }

  function updateStatusPanel() {
    stats.score.textContent = String(Math.floor(state.score));
    stats.hp.textContent = String(Math.max(0, Math.ceil(state.player.hp)));
    stats.ult.textContent = `${Math.floor(state.player.ult)}%`;
    waveValue.textContent = state.boss ? `Boss P${state.boss.phase}` : String(state.wave);
    comboValue.textContent = state.player.combo > 0 ? `${state.player.combo}x` : "0";
    dashValue.textContent = state.player.dashCd <= 0 ? "就绪" : `${state.player.dashCd.toFixed(1)}s`;
    modeValue.textContent = state.player.ultTimer > 0 ? "神罚模式" : state.boss ? "高压残局" : "进点中";
    bestValue.textContent = String(best);
  }

  function updateBest() {
    best = Math.max(best, Math.floor(state.score));
    safeSet("arcade.zmjjkk.best", best);
    bestValue.textContent = String(best);
  }

  function damagePlayer(amount, reason) {
    if (state.player.invuln > 0 || state.over) return;
    state.player.hp -= amount;
    state.player.invuln = 0.4;
    state.player.combo = 0;
    state.player.comboTimer = 0;
    screenShake(8);
    spawnText(choice(memePool.hurt), state.player.x, state.player.y - 26, "#ffb570", 16, 0.8);
    pushFeed(`${reason}，掉了 ${Math.ceil(amount)} 血。`);
    updateStatusPanel();
    if (state.player.hp <= 0) {
      lose();
    }
  }

  function removeEnemy(enemy, isBoss = false) {
    if (isBoss) {
      state.boss = null;
      state.score += 1200;
      state.banner = { text: choice(memePool.win), life: 2.8, maxLife: 2.8 };
      pushFeed("Boss 被打穿了，EDG 全场欢呼。");
      updateBest();
      overlay.show({
        titleText: "残局拿下",
        bodyHtml: `热度 <strong>${Math.floor(state.score)}</strong>，这把属于康康个人秀。`,
        onAction: reset,
      });
      state.over = true;
      return;
    }

    const index = state.enemies.indexOf(enemy);
    if (index >= 0) {
      state.enemies.splice(index, 1);
      state.score += enemy.score;
      state.player.combo += 1;
      state.player.comboTimer = 2.4;
      state.player.ult = clamp(state.player.ult + 7, 0, 100);
      pushFeed(choice(memePool.kill));
      spawnText("一枪一个", enemy.x, enemy.y - enemy.r, "#ffe087", 16, 0.8);
      for (let i = 0; i < 14; i += 1) {
        spawnParticle({
          x: enemy.x,
          y: enemy.y,
          vx: rand(-90, 90),
          vy: rand(-90, 90),
          size: rand(2, 5),
          color: "rgba(255, 208, 128, 0.92)",
          life: rand(0.3, 0.8),
        });
      }
      updateBest();
      updateStatusPanel();
    }
  }

  function shootPlayer() {
    if (state.player.fireCd > 0 || state.over) return;
    const player = state.player;
    const { vx, vy } = aimedVelocity(player.x, player.y, mouse.x, mouse.y, player.ultTimer > 0 ? 720 : 620);
    const shotLen = Math.hypot(vx, vy) || 1;
    state.bullets.push({
      x: player.x + (vx / shotLen) * (player.r + 14),
      y: player.y + (vy / shotLen) * (player.r + 14),
      vx,
      vy,
      r: player.ultTimer > 0 ? 7 : 4,
      damage: player.ultTimer > 0 ? 90 : 34,
      life: player.ultTimer > 0 ? 1.1 : 0.8,
      pierce: player.ultTimer > 0 ? 4 : 0,
      color: player.ultTimer > 0 ? "#82f6ff" : "#d7f7ff",
      trail: [],
    });
    for (let i = 0; i < 6; i += 1) {
      spawnParticle({
        x: player.x,
        y: player.y,
        vx: vx * 0.08 + rand(-28, 28),
        vy: vy * 0.08 + rand(-28, 28),
        size: rand(2, 4),
        color: player.ultTimer > 0 ? "rgba(130, 246, 255, 0.94)" : "rgba(255,255,255,0.8)",
        life: rand(0.2, 0.42),
      });
    }
    state.player.fireCd = state.player.ultTimer > 0 ? 0.055 : 0.13;
  }

  function triggerDash() {
    if (state.player.dashCd > 0 || state.player.dashTimer > 0 || state.over) return;
    let dx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    let dy = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
    if (!dx && !dy) {
      dx = mouse.x - state.player.x;
      dy = mouse.y - state.player.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    state.player.dashVX = (dx / len) * 640;
    state.player.dashVY = (dy / len) * 640;
    state.player.dashTimer = 0.15;
    state.player.dashCd = 1.7;
    state.player.invuln = 0.22;
    screenShake(5);
    showNotice(notice, "瞬步进点", 700);
  }

  function triggerUltimate() {
    if (state.player.ult < 100 || state.player.ultTimer > 0 || state.over) return;
    state.player.ult = 0;
    state.player.ultTimer = 4.2;
    state.banner = { text: choice(memePool.ult), life: 2.2, maxLife: 2.2 };
    pushFeed("神罚模式已开启，所有子弹穿透。");
    showNotice(notice, "一发入魂模式", 1400);
    screenShake(10);
    updateStatusPanel();
  }

  function updatePlayer(dt) {
    const player = state.player;
    player.fireCd = Math.max(0, player.fireCd - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.ultTimer = Math.max(0, player.ultTimer - dt);

    if (player.comboTimer > 0) {
      player.comboTimer -= dt;
      if (player.comboTimer <= 0) {
        player.combo = 0;
      }
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.x += player.dashVX * dt;
      player.y += player.dashVY * dt;
    } else {
      const moveX = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      const moveY = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
      const len = Math.hypot(moveX, moveY) || 1;
      if (moveX || moveY) {
        const speed = state.player.ultTimer > 0 ? 320 : 270;
        player.x += (moveX / len) * speed * dt;
        player.y += (moveY / len) * speed * dt;
      }
    }

    player.x = clamp(player.x, player.r + 18, canvas.width - player.r - 18);
    player.y = clamp(player.y, player.r + 18, canvas.height - player.r - 18);

    if (mouse.down || keys.Space) {
      shootPlayer();
    }
  }

  function updateEnemy(enemy, dt) {
    enemy.flash = Math.max(0, enemy.flash - dt * 4);
    enemy.wobble += dt;

    if (enemy.kind === "rusher") {
      const aim = aimedVelocity(enemy.x, enemy.y, state.player.x, state.player.y, enemy.speed);
      enemy.x += aim.vx * dt + Math.sin(state.time * 4 + enemy.wobble) * 18 * dt;
      enemy.y += aim.vy * dt + Math.cos(state.time * 3 + enemy.wobble) * 16 * dt;
      enemy.fireCd -= dt;
      if (enemy.fireCd <= 0) {
        fanBullets(enemy.x, enemy.y, state.player.x, state.player.y, 3, 220, 0.18, { color: "#ff9c7a", damage: 8, r: 5 });
        enemy.fireCd = rand(1.1, 1.6);
      }
    } else if (enemy.kind === "sniper") {
      enemy.x += Math.sin(state.time * 0.8 + enemy.wobble) * 26 * dt;
      enemy.y += Math.cos(state.time * 1.4 + enemy.wobble) * 18 * dt;
      enemy.fireCd -= dt;
      if (enemy.fireCd <= 0) {
        const shot = aimedVelocity(enemy.x, enemy.y, state.player.x, state.player.y, 360);
        state.enemyBullets.push({ x: enemy.x, y: enemy.y, ...shot, r: 7, damage: 12, color: "#ffd35c", trail: [] });
        enemy.fireCd = rand(0.95, 1.35);
      }
    } else if (enemy.kind === "orbiter") {
      enemy.orbitAngle += dt * 1.4 * enemy.orbitDir;
      enemy.x = enemy.anchorX + Math.cos(enemy.orbitAngle) * enemy.orbitRadius;
      enemy.y = enemy.anchorY + Math.sin(enemy.orbitAngle) * (enemy.orbitRadius + 24);
      enemy.fireCd -= dt;
      if (enemy.fireCd <= 0) {
        radialBullets(enemy.x, enemy.y, 6, 180, enemy.orbitAngle, { color: "#8fe3ff", damage: 9, r: 5 });
        enemy.fireCd = rand(1.2, 1.6);
      }
    } else {
      const aim = aimedVelocity(enemy.x, enemy.y, state.player.x, state.player.y, enemy.speed);
      enemy.x += aim.vx * dt * 0.5;
      enemy.y += aim.vy * dt * 0.4;
      enemy.fireCd -= dt;
      if (enemy.fireCd <= 0) {
        radialBullets(enemy.x, enemy.y, 10, 160, state.time, { color: "#ff8c69", damage: 10, r: 6 });
        enemy.fireCd = rand(1.4, 1.9);
      }
    }

    if (distance(enemy.x, enemy.y, state.player.x, state.player.y) < enemy.r + state.player.r + 6) {
      damagePlayer(12, "被头像贴脸");
    }
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss) return;

    const nextPhase = boss.hp <= 700 ? 3 : boss.hp <= 1320 ? 2 : 1;
    if (nextPhase !== boss.phase) {
      boss.phase = nextPhase;
      boss.specialCd = 1.1;
      boss.spawnCd = 2.4;
      state.banner = { text: memePool.phase[nextPhase - 1], life: 2.2, maxLife: 2.2 };
      pushFeed(memePool.phase[nextPhase - 1]);
      showNotice(notice, `Boss 进入 ${nextPhase} 阶段`, 1500);
    }

    boss.hitFlash = Math.max(0, boss.hitFlash - dt * 4);
    boss.patternCd -= dt;
    boss.specialCd -= dt;
    boss.spawnCd -= dt;
    boss.tauntCd -= dt;

    if (boss.phase === 1) {
      boss.x = canvas.width * 0.72 + Math.sin(state.time * 0.8) * 150;
      boss.y = 120 + Math.cos(state.time * 1.4) * 24;
      if (boss.patternCd <= 0) {
        fanBullets(boss.x, boss.y, state.player.x, state.player.y, 5, 280, 0.14, { color: "#ff8c69", damage: 11, r: 6 });
        boss.patternCd = 0.6;
      }
      if (boss.specialCd <= 0) {
        radialBullets(boss.x, boss.y, 12, 160, state.time, { color: "#ffd35c", damage: 10, r: 5 });
        boss.specialCd = 2.2;
      }
      if (boss.spawnCd <= 0) {
        state.enemies.push(spawnEnemy("rusher", 3), spawnEnemy("sniper", 3));
        boss.spawnCd = 4.4;
      }
    } else if (boss.phase === 2) {
      boss.x = canvas.width * 0.62 + Math.sin(state.time * 1.5) * 220;
      boss.y = 150 + Math.sin(state.time * 0.9) * 50;
      boss.spiralAngle += dt * 3.2;
      if (boss.patternCd <= 0) {
        state.enemyBullets.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(boss.spiralAngle) * 230,
          vy: Math.sin(boss.spiralAngle) * 230,
          r: 5,
          damage: 10,
          color: "#8fe3ff",
          trail: [],
        });
        state.enemyBullets.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(boss.spiralAngle + Math.PI) * 230,
          vy: Math.sin(boss.spiralAngle + Math.PI) * 230,
          r: 5,
          damage: 10,
          color: "#ffd35c",
          trail: [],
        });
        boss.patternCd = 0.08;
      }
      if (boss.specialCd <= 0) {
        addLaser(boss.x, boss.y, Math.atan2(state.player.y - boss.y, state.player.x - boss.x), 0.75, 0.24, 20);
        addLaser(boss.x, boss.y, Math.atan2(state.player.y - boss.y, state.player.x - boss.x) + 0.45, 0.75, 0.24, 18);
        boss.specialCd = 2.8;
      }
      if (boss.spawnCd <= 0) {
        state.enemies.push(spawnEnemy("orbiter", 3));
        boss.spawnCd = 4.6;
      }
    } else {
      if (boss.dashTimer > 0) {
        boss.dashTimer -= dt;
        boss.x += boss.dashVectorX * dt;
        boss.y += boss.dashVectorY * dt;
        if (Math.random() > 0.55) {
          radialBullets(boss.x, boss.y, 6, 150, state.time, { color: "#ff8c69", damage: 10, r: 5 });
        }
      } else {
        boss.x = canvas.width * 0.68 + Math.sin(state.time * 2.1) * 180;
        boss.y = 170 + Math.cos(state.time * 1.3) * 76;
        if (boss.specialCd <= 0) {
          const aim = aimedVelocity(boss.x, boss.y, state.player.x, state.player.y, 900);
          boss.dashVectorX = aim.vx;
          boss.dashVectorY = aim.vy;
          boss.dashTimer = 0.45;
          boss.specialCd = 1.7;
          pushFeed("Boss 开始贴脸冲点。");
        }
      }

      if (boss.patternCd <= 0) {
        fanBullets(boss.x, boss.y, state.player.x, state.player.y, 7, 300, 0.11, { color: "#ffd35c", damage: 12, r: 5 });
        boss.patternCd = 0.42;
      }
      if (boss.spawnCd <= 0) {
        radialBullets(boss.x, boss.y, 16, 180, state.time * 0.5, { color: "#8fe3ff", damage: 11, r: 5 });
        boss.spawnCd = 1.8;
      }
    }

    if (boss.tauntCd <= 0) {
      spawnText(choice(memePool.wave), boss.x, boss.y - boss.r - 18, "#ffffff", 18, 1.1);
      boss.tauntCd = 2.2;
    }

    if (distance(boss.x, boss.y, state.player.x, state.player.y) < boss.r + state.player.r + 10) {
      damagePlayer(16, "Boss 贴脸冲点");
    }
  }

  function updateProjectiles(dt) {
    const bulletScale = state.player.ultTimer > 0 ? 0.72 : 1;

    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      if (bullet.trail.length > 8) bullet.trail.shift();

      let removeBullet = bullet.life <= 0;

      for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0 && !removeBullet; enemyIndex -= 1) {
        const enemy = state.enemies[enemyIndex];
        if (distance(bullet.x, bullet.y, enemy.x, enemy.y) > enemy.r + bullet.r) continue;
        const centerHit = distance(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.r * 0.46;
        const damage = bullet.damage * (centerHit ? 1.65 : 1);
        enemy.hp -= damage;
        enemy.flash = 1;
        state.player.ult = clamp(state.player.ult + (centerHit ? 4.5 : 2.6), 0, 100);
        state.score += centerHit ? 20 : 10;
        spawnText(centerHit ? "爆头" : "命中", enemy.x, enemy.y - enemy.r - 8, centerHit ? "#ffe087" : "#ffffff", 14, 0.45);
        if (enemy.hp <= 0) {
          removeEnemy(enemy);
        }
        if (bullet.pierce > 0) {
          bullet.pierce -= 1;
        } else {
          removeBullet = true;
        }
      }

      if (!removeBullet && state.boss && distance(bullet.x, bullet.y, state.boss.x, state.boss.y) <= state.boss.r + bullet.r) {
        const boss = state.boss;
        const centerHit = distance(bullet.x, bullet.y, boss.x, boss.y) < boss.r * 0.38;
        const damage = bullet.damage * (centerHit ? 1.45 : 1);
        boss.hp -= damage;
        boss.hitFlash = 1;
        state.player.ult = clamp(state.player.ult + (centerHit ? 3.2 : 1.8), 0, 100);
        state.score += centerHit ? 16 : 9;
        if (boss.hp <= 0) {
          removeEnemy(boss, true);
        }
        if (bullet.pierce > 0) {
          bullet.pierce -= 1;
        } else {
          removeBullet = true;
        }
      }

      if (
        removeBullet ||
        bullet.x < -40 ||
        bullet.x > canvas.width + 40 ||
        bullet.y < -40 ||
        bullet.y > canvas.height + 40
      ) {
        state.bullets.splice(i, 1);
      }
    }

    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.enemyBullets[i];
      bullet.x += bullet.vx * dt * bulletScale;
      bullet.y += bullet.vy * dt * bulletScale;
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      if (bullet.trail.length > 7) bullet.trail.shift();

      if (distance(bullet.x, bullet.y, state.player.x, state.player.y) <= bullet.r + state.player.r) {
        state.enemyBullets.splice(i, 1);
        damagePlayer(bullet.damage, "吃到了梗图子弹");
        continue;
      }

      if (
        bullet.x < -60 ||
        bullet.x > canvas.width + 60 ||
        bullet.y < -60 ||
        bullet.y > canvas.height + 60
      ) {
        state.enemyBullets.splice(i, 1);
      }
    }
  }

  function updateLasers(dt) {
    for (let i = state.lasers.length - 1; i >= 0; i -= 1) {
      const laser = state.lasers[i];
      laser.life -= dt;
      laser.hitTimer -= dt;
      if (laser.life <= 0) {
        state.lasers.splice(i, 1);
        continue;
      }
      const active = laser.life <= laser.active;
      if (active && laser.hitTimer <= 0) {
        const dist = distanceToSegment(state.player.x, state.player.y, laser.x1, laser.y1, laser.x2, laser.y2);
        if (dist <= state.player.r + 7) {
          damagePlayer(laser.damage, "被扫射线刮到了");
          laser.hitTimer = 0.14;
        }
      }
    }
  }

  function updateEffects(dt) {
    state.shake = Math.max(0, state.shake - dt * 24);
    if (state.banner) {
      state.banner.life -= dt;
      if (state.banner.life <= 0) state.banner = null;
    }

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      if (particle.life <= 0) {
        state.particles.splice(i, 1);
      }
    }

    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const text = state.texts[i];
      text.life -= dt;
      text.x += text.vx * dt;
      text.y += text.vy * dt;
      if (text.life <= 0) {
        state.texts.splice(i, 1);
      }
    }
  }

  function lose() {
    state.over = true;
    updateBest();
    overlay.show({
      titleText: "残局没兜住",
      bodyHtml: `热度 <strong>${Math.floor(state.score)}</strong>，下一把继续接管。`,
      onAction: reset,
    });
  }

  function update(dt) {
    if (!state) return;

    if (!state.over) {
      state.time += dt;
      updatePlayer(dt);

      state.enemies.forEach((enemy) => updateEnemy(enemy, dt * (state.player.ultTimer > 0 ? 0.82 : 1)));
      updateBoss(dt * (state.player.ultTimer > 0 ? 0.78 : 1));
      updateProjectiles(dt);
      updateLasers(dt);
      updateEffects(dt);

      if (!state.boss && !state.enemies.length) {
        state.waveCooldown -= dt;
        if (state.waveCooldown <= 0) {
          spawnWave(state.wave + 1);
          state.waveCooldown = 1.6;
        }
      } else {
        state.waveCooldown = 1.6;
      }

      updateStatusPanel();
    } else {
      updateEffects(dt);
    }
  }

  function drawBackground() {
    drawSkyBackground(ctx, canvas.width, canvas.height, "#08131f", "#0e2435");
    ctx.fillStyle = "rgba(112, 220, 255, 0.06)";
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.fillRect(x, 0, 1, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.fillRect(0, y, canvas.width, 1);
    }

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.font = "bold 18px Avenir Next";
    ctx.fillText("SITE A", 62, 78);
    ctx.fillText("SITE B", canvas.width - 138, canvas.height - 38);
    ctx.font = "bold 26px Avenir Next";
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillText("EDG // ZMJJKK // OPERATOR TRIAL", 26, 36);
  }

  function drawBar(x, y, width, height, value, color, bgColor = "rgba(255,255,255,0.12)") {
    roundRectPath(ctx, x, y, width, height, height / 2);
    ctx.fillStyle = bgColor;
    ctx.fill();
    roundRectPath(ctx, x, y, width * clamp(value, 0, 1), height, height / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawPlayer() {
    const player = state.player;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    const ringColor = player.invuln > 0 ? "#82f6ff" : "#63d1d0";
    const auraRadius = player.r + 18;

    ctx.save();
    ctx.globalAlpha = player.ultTimer > 0 ? 0.22 : 0.14;
    ctx.fillStyle = ringColor;
    ctx.beginPath();
    ctx.arc(player.x, player.y, auraRadius + Math.sin(state.time * 6) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(223, 252, 255, 0.82)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(angle) * (player.r + 24), player.y + Math.sin(angle) * (player.r + 24));
    ctx.stroke();
    ctx.restore();

    drawAvatarCircle(ctx, player.x, player.y, player.r, { borderColor: ringColor, borderWidth: 8 });
    ctx.strokeStyle = "rgba(223, 252, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 12, angle - 0.42, angle + 0.42);
    ctx.stroke();
    ctx.fillStyle = "#dffcff";
    ctx.font = "bold 16px Avenir Next";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("KK", player.x, player.y + player.r + 18);
  }

  function drawEnemy(entity, boss = false) {
    const ring = boss
      ? entity.phase === 3
        ? "#ff8c69"
        : entity.phase === 2
          ? "#ffd35c"
          : "#8fe3ff"
      : entity.kind === "sniper"
        ? "#ffd35c"
        : entity.kind === "orbiter"
          ? "#8fe3ff"
          : entity.kind === "tank"
            ? "#ff8c69"
            : "#ffffff";

    ctx.save();
    ctx.globalAlpha = boss ? 0.2 : 0.1;
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.r + (boss ? 20 : 12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawAvatarCircle(ctx, entity.x, entity.y, entity.r, { borderColor: ring, borderWidth: boss ? 8 : 4 });
    if (entity.flash > 0) {
      ctx.save();
      ctx.globalAlpha = entity.flash * 0.45;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, entity.r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const hpRatio = clamp(entity.hp / entity.maxHp, 0, 1);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = boss ? 10 : 5;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.r + (boss ? 16 : 10), -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.r + (boss ? 16 : 10), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
    ctx.stroke();
  }

  function drawBullets(list) {
    list.forEach((bullet) => {
      bullet.trail.forEach((point, index) => {
        const alpha = (index + 1) / bullet.trail.length;
        ctx.fillStyle = `${bullet.color}${bullet.color.startsWith("#") ? "" : ""}`;
        ctx.save();
        ctx.globalAlpha = alpha * 0.25;
        ctx.beginPath();
        ctx.arc(point.x, point.y, bullet.r * alpha * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = bullet.color;
        ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawLasers() {
    state.lasers.forEach((laser) => {
      const active = laser.life <= laser.active;
      ctx.save();
      ctx.strokeStyle = active ? "rgba(255, 140, 105, 0.95)" : "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = active ? 12 : 4;
      ctx.setLineDash(active ? [] : [14, 10]);
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawEffects() {
    state.particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = particle.life / particle.maxLife;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    state.texts.forEach((text) => {
      ctx.save();
      ctx.globalAlpha = text.life / text.maxLife;
      ctx.fillStyle = text.color;
      ctx.font = `bold ${text.size}px Avenir Next`;
      ctx.textAlign = "center";
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    });

    if (state.banner) {
      ctx.save();
      ctx.globalAlpha = state.banner.life / state.banner.maxLife;
      ctx.fillStyle = "rgba(4, 16, 25, 0.78)";
      roundRectPath(ctx, canvas.width / 2 - 220, 18, 440, 46, 23);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Avenir Next";
      ctx.textAlign = "center";
      ctx.fillText(state.banner.text, canvas.width / 2, 47);
      ctx.restore();
    }
  }

  function drawHud() {
    drawBar(24, canvas.height - 34, 220, 12, state.player.hp / 100, "#63d1d0");
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "12px Avenir Next";
    ctx.textAlign = "left";
    ctx.fillText(`HP ${Math.max(0, Math.ceil(state.player.hp))}`, 24, canvas.height - 42);

    drawBar(258, canvas.height - 34, 180, 12, state.player.ult / 100, "#ffd35c");
    ctx.fillText(`ULT ${Math.floor(state.player.ult)}%`, 258, canvas.height - 42);

    if (state.boss) {
      drawBar(canvas.width - 330, 28, 290, 14, state.boss.hp / state.boss.maxHp, "#ff8c69", "rgba(255,255,255,0.1)");
      ctx.fillText(`Boss Phase ${state.boss.phase}`, canvas.width - 330, 22);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mouse.x - 12, mouse.y);
    ctx.lineTo(mouse.x + 12, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 12);
    ctx.lineTo(mouse.x, mouse.y + 12);
    ctx.stroke();
  }

  function draw() {
    ctx.save();
    const shakeX = state ? rand(-state.shake, state.shake) : 0;
    const shakeY = state ? rand(-state.shake, state.shake) : 0;
    ctx.translate(shakeX, shakeY);

    drawBackground();
    drawLasers();
    drawBullets(state.enemyBullets);
    drawBullets(state.bullets);
    state.enemies.forEach((enemy) => drawEnemy(enemy));
    if (state.boss) drawEnemy(state.boss, true);
    drawPlayer();
    drawEffects();
    drawHud();

    ctx.restore();
  }

  function reset() {
    state = {
      time: 0,
      wave: 0,
      waveCooldown: 1.6,
      player: {
        x: 180,
        y: canvas.height / 2,
        r: 30,
        hp: 100,
        fireCd: 0,
        dashCd: 0,
        dashTimer: 0,
        dashVX: 0,
        dashVY: 0,
        invuln: 0,
        ult: 0,
        ultTimer: 0,
        combo: 0,
        comboTimer: 0,
      },
      bullets: [],
      enemyBullets: [],
      enemies: [],
      boss: null,
      particles: [],
      texts: [],
      lasers: [],
      feed: [],
      banner: null,
      score: 0,
      shake: 0,
      over: false,
    };

    feedList.innerHTML = "";
    pushFeed(choice(memePool.intro));
    overlay.hide();
    spawnWave(1);
    updateStatusPanel();
  }

  addGlobalListener(disposer, canvas, "pointermove", (event) => {
    const point = canvasPoint(canvas, event);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  addGlobalListener(disposer, canvas, "pointerdown", (event) => {
    if (event.button === 0) {
      mouse.down = true;
    }
  });
  addGlobalListener(disposer, canvas, "dblclick", () => {
    toggleFullscreen();
  });
  addGlobalListener(disposer, window, "pointerup", () => {
    mouse.down = false;
  });
  addGlobalListener(disposer, canvas, "contextmenu", (event) => event.preventDefault());
  addGlobalListener(disposer, document, "fullscreenchange", syncFullscreenLabel);
  addGlobalListener(disposer, document, "webkitfullscreenchange", syncFullscreenLabel);
  addGlobalListener(disposer, fullscreenBtn, "click", () => {
    toggleFullscreen();
  });

  addGlobalListener(disposer, window, "keydown", (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight", "KeyQ", "KeyF"].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code in keys) {
      keys[event.code] = true;
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      triggerDash();
    }
    if (event.code === "KeyQ") {
      triggerUltimate();
    }
    if (event.code === "KeyF") {
      toggleFullscreen();
    }
  });

  addGlobalListener(disposer, window, "keyup", (event) => {
    if (event.code in keys) {
      keys[event.code] = false;
    }
  });

  disposer.raf((dt) => {
    update(dt);
    draw();
  });

  syncFullscreenLabel();
  reset();
  return () => disposer.destroy();
}

function mountBallBattle(host) {
  const disposer = createDisposer();
  const { playfield, panel, canvas, ctx, notice } = createGameLayout(host, { canvas: true, width: 1440, height: 840 });
  const overlay = createOverlay(playfield);
  const stats = createScoreStrip(panel, [
    { key: "mass", label: "体积", value: "1400" },
    { key: "rank", label: "排名", value: "#8" },
    { key: "best", label: "最佳", value: String(safeGet("arcade.ball.best", 1400)) },
  ]);

  addPanelText(
    panel,
    "操作",
    "移动鼠标控制方向，按住左键加速冲刺。吃掉更小的图片球、躲开更大的图片球，先发育再接管全场。"
  );
  addPanelList(panel, "规则", [
    "所有球体都用图片文件做成圆形头像球。",
    "长按左键会加速，但会持续掉一点体积。",
    "成为全场第一并把体积涨到 4800 即算获胜。",
  ]);

  const boardSection = el("section", "");
  boardSection.append(el("h4", "", "排行榜"));
  const boardList = el("ul", "tip-list");
  boardSection.append(boardList);
  panel.append(boardSection);

  const feedSection = el("section", "");
  feedSection.append(el("h4", "", "战场播报"));
  const feedList = el("ul", "tip-list");
  feedSection.append(feedList);
  panel.append(feedSection);

  const world = { width: 4200, height: 4200 };
  const names = [
    "急急国王",
    "发育大师",
    "稳住哥",
    "红温选手",
    "路人王",
    "运营鬼才",
    "老六球",
    "暴食球",
    "绝活哥",
    "逆风局",
    "细节怪",
    "别急球",
    "高分仔",
    "拉扯王",
  ];
  const ringPalette = ["#63d1d0", "#ffd35c", "#ff8c69", "#8fe3ff", "#b8ff8b", "#f6a4ff"];
  let best = safeGet("arcade.ball.best", 1400);
  let state = null;
  let idSeed = 0;

  const mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    down: false,
  };

  function worldToScreen(x, y) {
    return {
      x: x - state.camera.x + canvas.width / 2,
      y: y - state.camera.y + canvas.height / 2,
    };
  }

  function massToRadius(mass) {
    return Math.sqrt(mass);
  }

  function updateBlobRadius(blob) {
    blob.r = massToRadius(blob.mass);
  }

  function spawnFeed(text) {
    state.feed.unshift(text);
    state.feed = state.feed.slice(0, 6);
    feedList.innerHTML = "";
    state.feed.forEach((item) => feedList.append(el("li", "", item)));
  }

  function spawnFloatText(text, x, y, color = "#ffffff", life = 0.8, size = 18) {
    state.texts.push({ text, x, y, color, life, maxLife: life, size, vy: rand(-50, -20) });
  }

  function spawnParticle(x, y, color, size = 4) {
    state.particles.push({
      x,
      y,
      vx: rand(-90, 90),
      vy: rand(-90, 90),
      life: rand(0.25, 0.7),
      maxLife: 0.7,
      size,
      color,
    });
  }

  function randomPoint(margin = 80) {
    return {
      x: rand(margin, world.width - margin),
      y: rand(margin, world.height - margin),
    };
  }

  function createFood() {
    const point = randomPoint(40);
    const mass = rand(40, 90);
    return {
      id: `food-${++idSeed}`,
      x: point.x,
      y: point.y,
      mass,
      r: massToRadius(mass),
      ring: choice(ringPalette),
      pulse: rand(0, Math.PI * 2),
    };
  }

  function createBot(index = 0) {
    const point = randomPoint(120);
    const mass = rand(620, 2300);
    const bot = {
      id: `bot-${++idSeed}`,
      name: names[index % names.length],
      x: point.x,
      y: point.y,
      vx: 0,
      vy: 0,
      mass,
      ring: ringPalette[index % ringPalette.length],
      angle: rand(0, Math.PI * 2),
      decisionTimer: rand(0.3, 1.1),
      boostTimer: 0,
      boostCd: rand(1.2, 3.2),
      alive: true,
    };
    updateBlobRadius(bot);
    return bot;
  }

  function createPlayer() {
    const player = {
      id: "player",
      name: "你",
      x: world.width * 0.3,
      y: world.height * 0.52,
      vx: 0,
      vy: 0,
      mass: 1400,
      ring: "#ffffff",
      boostTrail: 0,
      alive: true,
    };
    updateBlobRadius(player);
    return player;
  }

  function eatBlob(eater, target, factor = 0.9) {
    eater.mass += target.mass * factor;
    updateBlobRadius(eater);
    state.score += Math.floor(target.mass * 0.14);
    for (let i = 0; i < 10; i += 1) {
      spawnParticle(target.x, target.y, eater === state.player ? "rgba(255,224,135,0.95)" : "rgba(255,255,255,0.8)", rand(2, 5));
    }
  }

  function canAbsorb(a, b) {
    if (!a.alive || !b.alive) return false;
    const dist = distance(a.x, a.y, b.x, b.y);
    return a.r > b.r * 1.12 && dist < a.r - b.r * 0.12;
  }

  function clampBlob(blob) {
    blob.x = clamp(blob.x, blob.r + 12, world.width - blob.r - 12);
    blob.y = clamp(blob.y, blob.r + 12, world.height - blob.r - 12);
  }

  function updateBest() {
    best = Math.max(best, Math.floor(state.player.mass));
    safeSet("arcade.ball.best", best);
    stats.best.textContent = String(best);
  }

  function updateStatsPanel() {
    const all = [state.player, ...state.bots.filter((bot) => bot.alive)].sort((a, b) => b.mass - a.mass);
    const rank = all.findIndex((blob) => blob.id === state.player.id) + 1;
    stats.mass.textContent = String(Math.floor(state.player.mass));
    stats.rank.textContent = `#${rank}`;
    stats.best.textContent = String(best);

    boardList.innerHTML = "";
    all.slice(0, 6).forEach((blob, index) => {
      const name = blob.id === "player" ? "你" : blob.name;
      boardList.append(el("li", "", `${index + 1}. ${name} · ${Math.floor(blob.mass)}`));
    });

    if (state.player.mass >= 4800 && rank === 1 && !state.over) {
      state.over = true;
      updateBest();
      overlay.show({
        titleText: "吞噬全场",
        bodyHtml: `你成为了场上最大的图片球，最终体积 <strong>${Math.floor(state.player.mass)}</strong>。`,
        onAction: reset,
      });
    }
  }

  function loseTo(bot) {
    if (state.over) return;
    state.over = true;
    spawnFeed(`被 ${bot.name} 吞掉了。`);
    updateBest();
    overlay.show({
      titleText: "发育失败",
      bodyHtml: `你最后的体积是 <strong>${Math.floor(state.player.mass)}</strong>，吞掉你的是 <strong>${bot.name}</strong>。`,
      onAction: reset,
    });
  }

  function spawnMoreFood(count = 1) {
    for (let i = 0; i < count; i += 1) {
      state.foods.push(createFood());
    }
  }

  function updatePlayer(dt) {
    const player = state.player;
    const targetX = state.camera.x - canvas.width / 2 + mouse.x;
    const targetY = state.camera.y - canvas.height / 2 + mouse.y;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const len = Math.hypot(dx, dy) || 1;
    let speed = clamp(260 - player.r * 1.45, 92, 250);

    if (mouse.down && player.mass > 900) {
      speed *= 1.55;
      player.mass = Math.max(850, player.mass - dt * 22);
      updateBlobRadius(player);
      player.boostTrail += dt;
      if (player.boostTrail > 0.02) {
        player.boostTrail = 0;
        spawnParticle(player.x, player.y, "rgba(99,209,208,0.9)", rand(3, 6));
      }
    }

    player.vx += (dx / len) * speed * dt * 1.8;
    player.vy += (dy / len) * speed * dt * 1.8;
    player.vx *= 0.92;
    player.vy *= 0.92;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    clampBlob(player);
  }

  function updateBot(bot, dt) {
    bot.decisionTimer -= dt;
    bot.boostCd -= dt;
    bot.boostTimer = Math.max(0, bot.boostTimer - dt);

    let desiredX = Math.cos(bot.angle);
    let desiredY = Math.sin(bot.angle);
    let fleeing = null;
    let prey = null;

    const rivals = [state.player, ...state.bots.filter((item) => item.id !== bot.id && item.alive)];
    rivals.forEach((target) => {
      const d = distance(bot.x, bot.y, target.x, target.y);
      if (target.r > bot.r * 1.18 && d < 620 && (!fleeing || d < fleeing.d)) {
        fleeing = { target, d };
      }
      if (bot.r > target.r * 1.16 && d < 540 && (!prey || d < prey.d)) {
        prey = { target, d };
      }
    });

    if (fleeing) {
      desiredX = bot.x - fleeing.target.x;
      desiredY = bot.y - fleeing.target.y;
      if (bot.boostCd <= 0) {
        bot.boostTimer = 0.42;
        bot.boostCd = rand(2.4, 4.1);
      }
    } else if (prey) {
      desiredX = prey.target.x - bot.x;
      desiredY = prey.target.y - bot.y;
      if (bot.boostCd <= 0 && prey.target.id !== "player") {
        bot.boostTimer = 0.24;
        bot.boostCd = rand(2.8, 4.6);
      }
    } else if (bot.decisionTimer <= 0) {
      bot.angle = rand(0, Math.PI * 2);
      bot.decisionTimer = rand(0.6, 1.6);
      desiredX = Math.cos(bot.angle);
      desiredY = Math.sin(bot.angle);
    }

    const len = Math.hypot(desiredX, desiredY) || 1;
    let speed = clamp(245 - bot.r * 1.52, 90, 220);
    if (bot.boostTimer > 0) speed *= 1.35;
    bot.vx += (desiredX / len) * speed * dt * 1.35;
    bot.vy += (desiredY / len) * speed * dt * 1.35;
    bot.vx *= 0.92;
    bot.vy *= 0.92;
    bot.x += bot.vx * dt;
    bot.y += bot.vy * dt;
    clampBlob(bot);
  }

  function resolveFoodCollisions() {
    for (let i = state.foods.length - 1; i >= 0; i -= 1) {
      const food = state.foods[i];
      food.pulse += 0.04;

      if (distance(state.player.x, state.player.y, food.x, food.y) < state.player.r * 0.96) {
        eatBlob(state.player, food, 0.92);
        state.foods.splice(i, 1);
        spawnMoreFood(1);
        continue;
      }

      let eaten = false;
      for (let botIndex = 0; botIndex < state.bots.length; botIndex += 1) {
        const bot = state.bots[botIndex];
        if (!bot.alive) continue;
        if (distance(bot.x, bot.y, food.x, food.y) < bot.r * 0.94) {
          eatBlob(bot, food, 0.88);
          state.foods.splice(i, 1);
          spawnMoreFood(1);
          eaten = true;
          break;
        }
      }
      if (eaten) continue;
    }
  }

  function resolveBlobCollisions() {
    for (let i = state.bots.length - 1; i >= 0; i -= 1) {
      const bot = state.bots[i];
      if (!bot.alive) continue;

      if (canAbsorb(state.player, bot)) {
        eatBlob(state.player, bot, 0.96);
        spawnFeed(`你吞掉了 ${bot.name}`);
        spawnFloatText("吞噬", bot.x, bot.y - bot.r, "#ffe087", 0.8, 16);
        state.bots.splice(i, 1);
        updateBest();
        continue;
      }

      if (canAbsorb(bot, state.player)) {
        loseTo(bot);
        return;
      }
    }

    for (let i = 0; i < state.bots.length; i += 1) {
      const a = state.bots[i];
      if (!a?.alive) continue;
      for (let j = state.bots.length - 1; j > i; j -= 1) {
        const b = state.bots[j];
        if (!b?.alive) continue;
        if (canAbsorb(a, b)) {
          eatBlob(a, b, 0.9);
          state.bots.splice(j, 1);
        } else if (canAbsorb(b, a)) {
          eatBlob(b, a, 0.9);
          state.bots.splice(i, 1);
          i -= 1;
          break;
        }
      }
    }

    while (state.bots.length < 14) {
      state.bots.push(createBot(state.bots.length + randInt(0, names.length - 1)));
    }
  }

  function updateCamera(dt) {
    state.camera.x += (state.player.x - state.camera.x) * Math.min(1, dt * 4.6);
    state.camera.y += (state.player.y - state.camera.y) * Math.min(1, dt * 4.6);
    state.camera.x = clamp(state.camera.x, canvas.width / 2, world.width - canvas.width / 2);
    state.camera.y = clamp(state.camera.y, canvas.height / 2, world.height - canvas.height / 2);
  }

  function updateEffects(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.95;
      particle.vy *= 0.95;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const text = state.texts[i];
      text.life -= dt;
      text.y += text.vy * dt;
      if (text.life <= 0) state.texts.splice(i, 1);
    }
  }

  function update(dt) {
    if (!state) return;

    if (!state.over) {
      state.time += dt;
      updatePlayer(dt);
      state.bots.forEach((bot) => updateBot(bot, dt));
      resolveFoodCollisions();
      resolveBlobCollisions();
      updateEffects(dt);
      updateCamera(dt);
      updateBest();
      updateStatsPanel();
    } else {
      updateEffects(dt);
      updateCamera(dt);
    }
  }

  function drawBlob(blob, { player = false } = {}) {
    const pos = worldToScreen(blob.x, blob.y);
    if (pos.x + blob.r < -80 || pos.x - blob.r > canvas.width + 80 || pos.y + blob.r < -80 || pos.y - blob.r > canvas.height + 80) {
      return;
    }

    let ring = blob.r < state.player.r * 0.86 ? "#8dff9d" : blob.r > state.player.r * 1.14 ? "#ff8c69" : blob.ring;
    if (player) ring = "#ffffff";

    ctx.save();
    ctx.globalAlpha = player ? 0.18 : 0.1;
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, blob.r + (player ? 18 : 12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawAvatarCircle(ctx, pos.x, pos.y, blob.r, { borderColor: ring, borderWidth: player ? 8 : 5 });

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${player ? 18 : 14}px Avenir Next`;
    ctx.fillText(blob.name, pos.x, pos.y + 1);
    ctx.font = `bold ${player ? 14 : 12}px Avenir Next`;
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText(String(Math.floor(blob.mass)), pos.x, pos.y + blob.r + 18);
  }

  function drawFood(food) {
    const pos = worldToScreen(food.x, food.y);
    if (pos.x + food.r < -40 || pos.x - food.r > canvas.width + 40 || pos.y + food.r < -40 || pos.y - food.r > canvas.height + 40) {
      return;
    }
    drawAvatarCircle(ctx, pos.x, pos.y, food.r + Math.sin(food.pulse) * 0.8, {
      borderColor: food.ring,
      borderWidth: 2,
      alpha: 0.95,
    });
  }

  function drawBackground() {
    drawSkyBackground(ctx, canvas.width, canvas.height, "#0b1520", "#10273b");
    const startX = Math.floor((state.camera.x - canvas.width / 2) / 120) * 120;
    const endX = state.camera.x + canvas.width / 2 + 120;
    const startY = Math.floor((state.camera.y - canvas.height / 2) / 120) * 120;
    const endY = state.camera.y + canvas.height / 2 + 120;

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let x = startX; x < endX; x += 120) {
      const sx = x - state.camera.x + canvas.width / 2;
      ctx.fillRect(sx, 0, 1, canvas.height);
    }
    for (let y = startY; y < endY; y += 120) {
      const sy = y - state.camera.y + canvas.height / 2;
      ctx.fillRect(0, sy, canvas.width, 1);
    }

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = "bold 24px Avenir Next";
    ctx.textAlign = "left";
    ctx.fillText("IMAGE BALL BATTLE", 26, 34);
  }

  function drawEffects() {
    state.particles.forEach((particle) => {
      const pos = worldToScreen(particle.x, particle.y);
      ctx.save();
      ctx.globalAlpha = particle.life / particle.maxLife;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    state.texts.forEach((text) => {
      const pos = worldToScreen(text.x, text.y);
      ctx.save();
      ctx.globalAlpha = text.life / text.maxLife;
      ctx.fillStyle = text.color;
      ctx.font = `bold ${text.size}px Avenir Next`;
      ctx.textAlign = "center";
      ctx.fillText(text.text, pos.x, pos.y);
      ctx.restore();
    });
  }

  function drawMiniMap() {
    const mapW = 170;
    const mapH = 170;
    const x = canvas.width - mapW - 22;
    const y = canvas.height - mapH - 22;
    ctx.fillStyle = "rgba(5, 16, 25, 0.62)";
    roundRectPath(ctx, x, y, mapW, mapH, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    const scaleX = mapW / world.width;
    const scaleY = mapH / world.height;
    state.foods.forEach((food) => {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x + food.x * scaleX, y + food.y * scaleY, 2, 2);
    });
    state.bots.forEach((bot) => {
      ctx.fillStyle = bot.r < state.player.r * 0.86 ? "#8dff9d" : bot.r > state.player.r * 1.14 ? "#ff8c69" : "#ffd35c";
      ctx.beginPath();
      ctx.arc(x + bot.x * scaleX, y + bot.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + state.player.x * scaleX, y + state.player.y * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud() {
    drawMiniMap();
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "bold 16px Avenir Next";
    ctx.textAlign = "left";
    ctx.fillText(`体积 ${Math.floor(state.player.mass)}`, 24, canvas.height - 52);
    ctx.fillText(`目标 4800`, 24, canvas.height - 28);
  }

  function draw() {
    drawBackground();
    state.foods.forEach(drawFood);
    state.bots.forEach((bot) => drawBlob(bot));
    drawBlob(state.player, { player: true });
    drawEffects();
    drawHud();
  }

  function reset() {
    state = {
      time: 0,
      camera: { x: world.width * 0.3, y: world.height * 0.52 },
      player: createPlayer(),
      foods: Array.from({ length: 240 }, createFood),
      bots: Array.from({ length: 14 }, (_, index) => createBot(index)),
      particles: [],
      texts: [],
      feed: [],
      score: 0,
      over: false,
    };

    feedList.innerHTML = "";
    spawnFeed("开局先发育，别去碰大球。");
    spawnFeed("所有球都用图片做成圆形头像皮肤。");
    overlay.hide();
    updateStatsPanel();
  }

  addGlobalListener(disposer, canvas, "pointermove", (event) => {
    const point = canvasPoint(canvas, event);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  addGlobalListener(disposer, canvas, "pointerdown", (event) => {
    if (event.button === 0) mouse.down = true;
  });
  addGlobalListener(disposer, window, "pointerup", () => {
    mouse.down = false;
  });

  disposer.raf((dt) => {
    update(dt);
    draw();
  });

  reset();
  return () => disposer.destroy();
}

const games = [
  {
    id: "zmjjkk-trial",
    title: "ZmjjKK 神狙试炼",
    tagline: "EDG 风格的高压残局 Boss 战，梗图弹幕和头像敌人一起上。",
    genre: "Boss 射击",
    difficulty: "很高",
    controlsShort: "WASD + 鼠标",
    controls: "用 <span class='kbd'>WASD</span> 走位，鼠标瞄准，长按左键或 <span class='kbd'>Space</span> 射击，<span class='kbd'>Shift</span> 冲刺，<span class='kbd'>Q</span> 开启“神罚一狙”。",
    tags: ["EDG", "梗图弹幕", "多阶段 Boss"],
    mount: mountZmjjkkTrial,
  },
  {
    id: "ball-battle",
    title: "图片球球大作战",
    tagline: "用图片文件做圆形头像球，吃小躲大，发育到全场第一。",
    genre: "吞噬生存",
    difficulty: "中高",
    controlsShort: "鼠标移动",
    controls: "移动鼠标控制方向，按住左键冲刺吞噬。所有球体都用同一张图片文件做成圆形贴图。",
    tags: ["图片球", "大地图", "排行榜"],
    mount: mountBallBattle,
  },
  {
    id: "dragon-lore-fps",
    title: "龙狙突围 3D",
    tagline: "把 AWP Dragon Lore 模型塞进第一人称战场，清波推进。",
    genre: "3D 第一人称射击",
    difficulty: "高",
    controlsShort: "WASD + 鼠标锁定",
    controls: "点击画面锁定鼠标并进入瞄准，<span class='kbd'>WASD</span> 移动，鼠标看向，左键射击，<span class='kbd'>R</span> 换弹，<span class='kbd'>Shift</span> 冲刺，<span class='kbd'>F</span> 全屏。",
    tags: ["WebGL2", "龙狙模型", "离线 3D"],
    mount: mountDragonLoreFPS,
  },
  {
    id: "dino",
    title: "谷歌小恐龙",
    tagline: "离线跑酷名场面，越跑越快。",
    genre: "跑酷",
    difficulty: "中",
    controlsShort: "空格跳跃",
    controls: "自动奔跑，按 <span class='kbd'>Space</span> / <span class='kbd'>↑</span> 或点击画布跳跃，躲开障碍。",
    tags: ["Canvas", "经典复刻"],
    mount: mountDinoRunner,
  },
  {
    id: "snake",
    title: "贪吃蛇",
    tagline: "纯经典，越吃越快，越长越危险。",
    genre: "反应",
    difficulty: "中",
    controlsShort: "方向键",
    controls: "用方向键或 <span class='kbd'>WASD</span> 控制蛇移动，别撞墙，也别咬到自己。",
    tags: ["网格", "耐玩"],
    mount: mountSnake,
  },
  {
    id: "angry-birds",
    title: "愤怒的小鸟",
    tagline: "拖拽发射，拆塔打猪。",
    genre: "物理弹射",
    difficulty: "中",
    controlsShort: "拖拽发射",
    controls: "按住小鸟向后拖，松手发射。清掉所有猪猪即可过关。",
    tags: ["弹射", "关卡"],
    mount: mountAngryBirds,
  },
  {
    id: "pvz",
    title: "植物大战僵尸",
    tagline: "五条线防守，靠资源调度撑住尸潮。",
    genre: "塔防",
    difficulty: "中高",
    controlsShort: "点选种植",
    controls: "先选植物，再点格子种下。击杀 20 只僵尸前别让它们冲破左侧防线。",
    tags: ["策略", "塔防"],
    mount: mountPlantsVsZombies,
  },
  {
    id: "tetris",
    title: "俄罗斯方块",
    tagline: "标准堆叠，节奏越来越紧。",
    genre: "益智",
    difficulty: "中高",
    controlsShort: "移动旋转",
    controls: "方向键移动和旋转方块，尽量连续消行，不要堆到顶部。",
    tags: ["经典", "堆叠"],
    mount: mountTetris,
  },
  {
    id: "breakout",
    title: "打砖块",
    tagline: "挡板接球，拆光整面砖墙。",
    genre: "街机",
    difficulty: "中",
    controlsShort: "挡板反弹",
    controls: "鼠标或方向键移动挡板，空格发球。清空砖块自动进下一关。",
    tags: ["反弹", "关卡"],
    mount: mountBreakout,
  },
  {
    id: "flappy",
    title: "像素鸟",
    tagline: "一键上扬，考的是稳定节奏。",
    genre: "反应",
    difficulty: "高",
    controlsShort: "点击起飞",
    controls: "点击画布或按 <span class='kbd'>Space</span> / <span class='kbd'>↑</span> 让小鸟穿过管道。",
    tags: ["虐心", "节奏"],
    mount: mountFlappyBird,
  },
  {
    id: "2048",
    title: "2048",
    tagline: "数字合并，越往后越考布局。",
    genre: "数字益智",
    difficulty: "中",
    controlsShort: "滑动合并",
    controls: "方向键或 <span class='kbd'>WASD</span> 移动棋盘，让相同数字合并，尽量冲更高分。",
    tags: ["数字", "策略"],
    mount: mountGame2048,
  },
  {
    id: "mole",
    title: "打地鼠",
    tagline: "30 秒手速测试，连击越高越赚。",
    genre: "休闲反应",
    difficulty: "低",
    controlsShort: "鼠标点击",
    controls: "看到地鼠就点，命中会提升连击和刷新速度。",
    tags: ["手速", "休闲"],
    mount: mountWhackAMole,
  },
  {
    id: "shooter",
    title: "太空射击",
    tagline: "守住底线，逐波清空敌军。",
    genre: "射击",
    difficulty: "中高",
    controlsShort: "移动开火",
    controls: "用 <span class='kbd'>←→</span> / <span class='kbd'>AD</span> 左右移动，<span class='kbd'>Space</span> 持续开火。",
    tags: ["横版", "弹幕"],
    mount: mountSpaceShooter,
  },
  {
    id: "memory",
    title: "记忆翻牌",
    tagline: "纯记忆局，少走弯路更关键。",
    genre: "记忆益智",
    difficulty: "低",
    controlsShort: "翻牌配对",
    controls: "每次翻两张，记住图案位置，尽量用更少步数完成 8 对。",
    tags: ["轻量", "记忆"],
    mount: mountMemoryMatch,
  },
  {
    id: "simon",
    title: "灯光记忆",
    tagline: "看一遍，复刻一遍，轮次不断增加。",
    genre: "记忆反应",
    difficulty: "中",
    controlsShort: "顺序点击",
    controls: "观察亮起顺序，播放完后按同样顺序点击 4 个色块。",
    tags: ["顺序", "挑战"],
    mount: mountSimonSays,
  },
];

function renderGameList() {
  appNodes.list.innerHTML = "";
  games.forEach((game, index) => {
    const button = el("button", `game-card${game.id === activeGameId ? " active" : ""}`);
    button.type = "button";
    button.innerHTML = `
      <div class="card-head">
        <span class="card-thumb" aria-hidden="true"></span>
        <div class="card-meta">
          <div class="card-topline">
            <strong>${String(index + 1).padStart(2, "0")}. ${game.title}</strong>
            <span>${game.genre}</span>
          </div>
          <p class="card-copy">${game.tagline}</p>
        </div>
      </div>
      <div class="card-tags">
        ${game.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
    `;
    button.addEventListener("click", () => mountGame(game.id));
    appNodes.list.append(button);
  });
}

function mountGame(id) {
  const game = games.find((entry) => entry.id === id);
  if (!game) return;
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  activeGameId = id;
  appNodes.title.textContent = game.title;
  appNodes.tagline.textContent = game.tagline;
  appNodes.genre.textContent = game.genre;
  appNodes.difficulty.textContent = game.difficulty;
  appNodes.controlsShort.textContent = game.controlsShort;
  appNodes.controls.innerHTML = game.controls;

  activeCleanup = game.mount(appNodes.host);
  renderGameList();
}

appNodes.restart.addEventListener("click", () => {
  if (activeGameId) {
    mountGame(activeGameId);
  }
});

renderGameList();
mountGame(games[0].id);
