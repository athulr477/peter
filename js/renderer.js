// 2D Canvas Renderer for Beach Penalty Shootout
// Optimized for all mobile phones and browsers

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {
      alpha: false,         // No transparency needed on canvas = perf boost
      desynchronized: true, // Allow async rendering (reduces input latency on mobile)
    });

    // Reference internal resolution matching beach-goal-bg.jpg
    this.refWidth = 1264;
    this.refHeight = 848;

    // Viewport transforms
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;

    // Actual device pixel ratio (capped for performance)
    this.dpr = 1.0;

    // Asset images
    this.images = {
      bg: new Image(),
      ball: new Image(),
      guard: new Image(),
      ready: new Image(),
    };

    this.loadedCount = 0;
    this.totalImages = 4;
    this.allLoaded = false;

    // Performance: track if we're on a low-end device
    this._isLowEnd = this._detectLowEnd();
  }

  _detectLowEnd() {
    // Heuristic: low-end if <4 cores or low memory or high DPR with small screen
    const cores = navigator.hardwareConcurrency || 2;
    const mem = navigator.deviceMemory || 4; // GB, Chrome only
    const smallScreen = window.innerWidth <= 400;
    return cores <= 2 || mem <= 2 || (smallScreen && (window.devicePixelRatio || 1) > 2);
  }

  loadAssets(onProgress, onComplete) {
    const assets = [
      { key: "bg", webp: "assets/beach-goal-bg.webp", fallback: "assets/beach-goal-bg.jpg" },
      { key: "ball", webp: "assets/soccer-ball.webp", fallback: "assets/soccer-ball.png" },
      { key: "guard", webp: "assets/goalkeeper-guard-cutout.webp", fallback: "assets/goalkeeper-guard-cutout.png" },
      { key: "ready", webp: "assets/goalkeeper-ready-cutout.webp", fallback: "assets/goalkeeper-ready-cutout.png" },
    ];

    const markFinished = () => {
      this.loadedCount++;
      if (onProgress) onProgress(this.loadedCount / this.totalImages);
      if (this.loadedCount === this.totalImages) {
        this.allLoaded = true;
        if (onComplete) onComplete();
      }
    };

    assets.forEach((item) => {
      const img = this.images[item.key];
      let triedFallback = false;

      img.onload = () => {
        markFinished();
      };

      img.onerror = () => {
        if (!triedFallback && item.fallback) {
          triedFallback = true;
          console.warn(`WebP failed for ${item.key}, trying fallback: ${item.fallback}`);
          img.src = item.fallback;
        } else {
          console.error("Failed to load asset:", img.src);
          // Mark finished so loading screen doesn't block forever
          markFinished();
        }
      };

      // Try modern WebP first
      img.src = item.webp;
    });
  }

  resize() {
    // Cap DPR: 2 for normal, 1.5 for low-end, prevents huge canvas on 3x phones
    const rawDpr = window.devicePixelRatio || 1;
    this.dpr = this._isLowEnd ? Math.min(rawDpr, 1.5) : Math.min(rawDpr, 2.0);

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    // Scale to fit viewport maintaining aspect ratio
    const scaleX = this.canvas.width / this.refWidth;
    const scaleY = this.canvas.height / this.refHeight;

    // Use Math.max to cover the entire screen (crop edges rather than letterbox)
    // This prevents black bars on tall/narrow phones
    this.scale = Math.max(scaleX, scaleY);

    this.offsetX = (this.canvas.width - this.refWidth * this.scale) / 2;
    this.offsetY = (this.canvas.height - this.refHeight * this.scale) / 2;

    // Enable image smoothing for scaled sprites
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = this._isLowEnd ? "low" : "medium";
  }

  // Convert 3D world space (x: -1..1, y: 0..1, z: 0..1) to 2D reference canvas pixels
  worldToRef(x, y, z) {
    // Goal line:
    // When z = 0 (foreground ball spot):
    // Center = 632, Ground Y = 750, horizSpan = 330, vertSpan = 420
    // When z = 1 (goal line):
    // Center = 632, Ground Y = 542, horizSpan = 735, vertSpan = 672

    const groundY = 750 * (1 - z) + 542 * z;
    const horizSpan = 330 * (1 - z) + 735 * z;
    const vertSpan = 420 * (1 - z) + 672 * z;

    const refX = 632 + x * horizSpan;
    const refY = groundY - y * vertSpan;
    const ballScale = 1.0 / (1.0 + z * 2.7);

    return {
      x: refX,
      y: refY,
      groundY: groundY,
      scale: ballScale,
    };
  }

  // Convert screen mouse/touch event coordinates to reference space
  screenToRef(screenX, screenY) {
    const canvasX = screenX * this.dpr;
    const canvasY = screenY * this.dpr;

    const refX = (canvasX - this.offsetX) / this.scale;
    const refY = (canvasY - this.offsetY) / this.scale;

    return { x: refX, y: refY };
  }

  render(gameState, keeper, ball, particles, input) {
    if (!this.allLoaded) return;

    const ctx = this.ctx;
    ctx.save();

    // Clear canvas
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply viewport transform
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 1. Draw Beach & Goal Background
    ctx.drawImage(this.images.bg, 0, 0, this.refWidth, this.refHeight);

    // 2. Draw Dynamic Net Ripple Waves over goal opening
    const goalRect = { x: 88, y: 55, width: 1088, height: 490 };
    particles.drawNetRipples(ctx, goalRect);

    // 3. Draw Goalkeeper Shadow
    this.drawKeeperShadow(ctx, keeper);

    // 4. Draw Goalkeeper
    this.drawGoalkeeper(ctx, keeper);

    // 5. Draw Ball Shadow (ground projection)
    this.drawBallShadow(ctx, ball);

    // 6. Draw Ball
    this.drawBall(ctx, ball);

    // 7. Draw Aiming Indicator (if dragging)
    if (gameState === "AIMING" && input.isDragging) {
      this.drawAimLine(ctx, input, ball);
    }

    // 8. Draw Particle Effects (sand puffs, sparks)
    particles.draw(ctx);

    ctx.restore();
  }

  drawKeeperShadow(ctx, keeper) {
    const pos = this.worldToRef(keeper.x, keeper.y, keeper.z);
    ctx.save();
    ctx.fillStyle = "rgba(40, 25, 10, 0.45)";
    ctx.beginPath();
    const shadowWidth = 140 * Math.max(0.4, 1.0 - keeper.y * 0.8);
    const shadowHeight = 22 * Math.max(0.4, 1.0 - keeper.y * 0.8);
    ctx.ellipse(pos.x, pos.groundY + 6, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawGoalkeeper(ctx, keeper) {
    const pos = this.worldToRef(keeper.x, keeper.y, keeper.z);
    const sprite = keeper.currentPose === "ready" ? this.images.ready : this.images.guard;

    // Goalkeeper natural height in goal opening: ~340px
    const baseW = 275;
    const baseH = 368;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(keeper.rotation);

    // Subtle scale breathing
    const scale = keeper.scale;
    ctx.scale(scale, scale);

    // Center sprite at feet / bottom center
    ctx.drawImage(sprite, -baseW / 2, -baseH + 18, baseW, baseH);

    ctx.restore();
  }

  drawBallShadow(ctx, ball) {
    const pos = this.worldToRef(ball.x, ball.y, ball.z);
    const baseRadius = 80 * pos.scale;

    ctx.save();
    const alpha = Math.max(0.12, 0.65 * (1.0 - ball.y * 0.7));
    ctx.fillStyle = `rgba(35, 20, 10, ${alpha})`;
    ctx.beginPath();

    const radiusX = baseRadius * (1.0 + ball.y * 0.25);
    const radiusY = baseRadius * 0.32;
    ctx.ellipse(pos.x, pos.groundY + 4, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBall(ctx, ball) {
    const pos = this.worldToRef(ball.x, ball.y, ball.z);
    const ballImg = this.images.ball;

    // Native ball diameter in foreground: 165px
    const baseSize = 168;
    const size = baseSize * pos.scale;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(ball.rotation);

    ctx.drawImage(ballImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  drawAimLine(ctx, input, ball) {
    const startRef = this.worldToRef(ball.x, ball.y, ball.z);
    const curRef = this.screenToRef(input.currentScreenX, input.currentScreenY);

    const dx = curRef.x - startRef.x;
    const dy = curRef.y - startRef.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 15) return;

    // Shot target in goal coordinates
    const targetRefX = startRef.x + (dx * 2.8);
    const targetRefY = Math.max(80, Math.min(540, startRef.y + (dy * 2.2)));

    ctx.save();

    // 1. Target reticle in the goal mouth
    ctx.strokeStyle = "rgba(0, 230, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(targetRefX, targetRefY, 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 230, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(targetRefX, targetRefY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Center cross
    ctx.beginPath();
    ctx.moveTo(targetRefX - 8, targetRefY);
    ctx.lineTo(targetRefX + 8, targetRefY);
    ctx.moveTo(targetRefX, targetRefY - 8);
    ctx.lineTo(targetRefX, targetRefY + 8);
    ctx.stroke();

    // 2. Animated curved aim trajectory line
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -Date.now() / 25;
    ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(startRef.x, startRef.y);
    // Quadratic curve
    const ctrlX = (startRef.x + targetRefX) / 2;
    const ctrlY = Math.min(startRef.y, targetRefY) - 50;
    ctx.quadraticCurveTo(ctrlX, ctrlY, targetRefX, targetRefY);
    ctx.stroke();

    // Glow effect
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}
