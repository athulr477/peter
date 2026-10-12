// Main Game Orchestration for Beach Penalty Shootout
// Optimized for mobile: visibility API, orientation handling, performance

import { audio } from "./audio.js";
import { ParticleSystem } from "./particles.js";
import { BallPhysics } from "./physics.js";
import { Goalkeeper } from "./goalkeeper.js";
import { GameRenderer } from "./renderer.js";
import { InputController } from "./input.js";

export class BeachPenaltyGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.renderer = new GameRenderer(this.canvas);
    this.particles = new ParticleSystem();
    this.ball = new BallPhysics();
    this.keeper = new Goalkeeper();
    this.input = new InputController(this.canvas, this.renderer);

    // Game state
    this.state = "LOADING"; // "LOADING", "READY", "AIMING", "IN_FLIGHT", "RESULT", "PAUSED", "ROUND_OVER"
    this.savedStateBeforePause = "READY";

    // Round stats (5 attempts)
    this.maxAttempts = 5;
    this.currentAttempt = 1;
    this.goals = 0;
    this.saves = 0;
    this.misses = 0;
    this.history = []; // Array of { attempt: 1, result: "GOAL" }

    this.tutorialVisible = true;
    this.resultTimer = 0;
    this.lastTime = performance.now();
    this._rafId = null;
    this._isVisible = true;

    // DOM UI elements
    this.ui = {
      scoreValue: document.getElementById("scoreValue"),
      roundValue: document.getElementById("roundValue"),
      attemptIndicators: document.getElementById("attemptIndicators"),
      tutorial: document.getElementById("swipeTutorial"),
      resultBanner: document.getElementById("resultBanner"),
      resultText: document.getElementById("resultText"),
      pauseBtn: document.getElementById("pauseBtn"),
      pauseModal: document.getElementById("pauseModal"),
      resumeBtn: document.getElementById("resumeBtn"),
      restartBtn: document.getElementById("restartBtn"),
      soundToggleBtn: document.getElementById("soundToggleBtn"),
      soundIcon: document.getElementById("soundIcon"),
      summaryModal: document.getElementById("summaryModal"),
      summaryScore: document.getElementById("summaryScore"),
      summaryRating: document.getElementById("summaryRating"),
      summaryDetails: document.getElementById("summaryDetails"),
      playAgainBtn: document.getElementById("playAgainBtn"),
      loadingOverlay: document.getElementById("loadingOverlay"),
      loadingBar: document.getElementById("loadingBar"),
    };

    this.setupInputs();
    this.setupUI();
    this.setupVisibility();
    this.setupMobileEnhancements();
    this.init();
  }

  init() {
    window.addEventListener("resize", () => this.renderer.resize());
    // Also handle orientation changes with a debounce
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.renderer.resize(), 300);
    });
    this.renderer.resize();

    // Preload assets
    this.renderer.loadAssets(
      (progress) => {
        if (this.ui.loadingBar) {
          this.ui.loadingBar.style.width = `${progress * 100}%`;
        }
      },
      () => {
        // Complete
        if (this.ui.loadingOverlay) {
          this.ui.loadingOverlay.classList.add("hidden");
        }
        this.state = "READY";
        this.updateHUD();
        this.lastTime = performance.now();
        this._rafId = requestAnimationFrame((t) => this.loop(t));
      }
    );
  }

  setupVisibility() {
    // Pause rendering when tab/app is backgrounded (saves battery on mobile)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this._isVisible = false;
        // Auto-pause if in an active game state
        if (this.state === "READY" || this.state === "AIMING") {
          this.pauseGame();
        }
      } else {
        this._isVisible = true;
        // Reset timing to avoid huge dt spike
        this.lastTime = performance.now();
      }
    });

    // iOS Safari: also use pageshow/pagehide
    window.addEventListener("pagehide", () => {
      this._isVisible = false;
    });
    window.addEventListener("pageshow", () => {
      this._isVisible = true;
      this.lastTime = performance.now();
    });
  }

  setupMobileEnhancements() {
    // Prevent pull-to-refresh and bounce scrolling on the game container
    const container = document.getElementById("gameContainer");
    if (container) {
      container.addEventListener("touchmove", (e) => {
        e.preventDefault();
      }, { passive: false });
    }

    // Prevent iOS Safari from showing the address bar on swipe up
    document.body.addEventListener("touchmove", (e) => {
      if (e.target === document.body || e.target === this.canvas) {
        e.preventDefault();
      }
    }, { passive: false });

    // Try to lock screen orientation to portrait (if API is available)
    this._tryLockOrientation();

    // Wake lock: keep screen on while playing (if API is available)
    this._tryWakeLock();
  }

  async _tryLockOrientation() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("portrait");
      }
    } catch (e) {
      // Not supported or not allowed — that's fine
    }
  }

  async _tryWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        this._wakeLock = await navigator.wakeLock.request("screen");
        // Re-acquire on visibility change
        document.addEventListener("visibilitychange", async () => {
          if (!document.hidden && "wakeLock" in navigator) {
            try {
              this._wakeLock = await navigator.wakeLock.request("screen");
            } catch (e) {}
          }
        });
      }
    } catch (e) {
      // Not supported
    }
  }

  setupInputs() {
    this.input.onAimStartCallback = () => {
      if (this.state === "READY") {
        this.state = "AIMING";
        this.keeper.onAimStart();
        if (this.tutorialVisible) {
          this.hideTutorial();
        }
      }
    };

    this.input.onAimMoveCallback = (lean) => {
      if (this.state === "AIMING") {
        this.keeper.onAimMove(lean);
      }
    };

    this.input.onAimCancelCallback = () => {
      if (this.state === "AIMING") {
        this.state = "READY";
        this.keeper.onAimCancel();
      }
    };

    this.input.onShootCallback = (targetX, targetY, power, curve) => {
      if (this.state === "AIMING") {
        this.fireShot(targetX, targetY, power, curve);
      }
    };
  }

  setupUI() {
    // Pause button
    this.ui.pauseBtn.addEventListener("click", () => this.pauseGame());
    this.ui.resumeBtn.addEventListener("click", () => this.resumeGame());
    this.ui.restartBtn.addEventListener("click", () => {
      this.resumeGame();
      this.resetRound();
    });

    // Sound toggle
    this.ui.soundToggleBtn.addEventListener("click", () => {
      const isMuted = audio.toggleMute();
      this.updateSoundIcon(isMuted);
    });

    // Play Again button
    this.ui.playAgainBtn.addEventListener("click", () => {
      this.ui.summaryModal.classList.add("hidden");
      this.resetRound();
    });

    // Make all buttons touch-friendly: prevent double-tap zoom
    document.querySelectorAll(".btn, .hud-btn").forEach((btn) => {
      btn.style.touchAction = "manipulation";
    });
  }

  updateSoundIcon(isMuted) {
    if (this.ui.soundIcon) {
      this.ui.soundIcon.textContent = isMuted ? "🔇" : "🔊";
    }
    if (this.ui.soundToggleBtn) {
      this.ui.soundToggleBtn.querySelector("span.label").textContent = isMuted ? "SOUND: OFF" : "SOUND: ON";
    }
  }

  hideTutorial() {
    this.tutorialVisible = false;
    if (this.ui.tutorial) {
      this.ui.tutorial.classList.add("fade-out");
      setTimeout(() => {
        this.ui.tutorial.style.display = "none";
      }, 500);
    }
  }

  fireShot(targetX, targetY, power, curve) {
    this.state = "IN_FLIGHT";
    this.input.setEnabled(false);

    // Audio & Sand Puff
    audio.playKick(power);
    const ballPos = this.renderer.worldToRef(this.ball.x, this.ball.y, this.ball.z);
    this.particles.emitSandPuff(ballPos.x, ballPos.groundY, 30, power);

    // Mobile vibration if supported
    if ("vibrate" in navigator) {
      try { navigator.vibrate(40); } catch (e) {}
    }

    // Goalkeeper reacts
    this.keeper.onShotFired(targetX, targetY, power);

    // Launch ball
    this.ball.shoot(targetX, targetY, power, curve);
  }

  onShotResolved(result) {
    this.state = "RESULT";
    this.resultTimer = 1.6; // Time to celebrate / show banner before next kick

    this.history.push({ attempt: this.currentAttempt, result });

    if (result === "GOAL!") {
      this.goals++;
      const ballPos = this.renderer.worldToRef(this.ball.x, this.ball.y, this.ball.z);
      this.particles.emitGoalSparks(ballPos.x, ballPos.y, 70);
      this.particles.triggerNetRipple(ballPos.x, ballPos.y);

      if ("vibrate" in navigator) {
        try { navigator.vibrate([60, 40, 120]); } catch (e) {}
      }
    } else if (result === "SAVED!") {
      this.saves++;
    } else {
      this.misses++;
      if (result.includes("POST") || result.includes("BAR")) {
        const ballPos = this.renderer.worldToRef(this.ball.x, this.ball.y, this.ball.z);
        this.particles.emitPostImpact(ballPos.x, ballPos.y);
      }
    }

    this.showResultBanner(result);
    this.updateHUD();
  }

  showResultBanner(result) {
    const banner = this.ui.resultBanner;
    const text = this.ui.resultText;

    banner.className = "result-banner show";
    if (result === "GOAL!") {
      banner.classList.add("goal");
      text.textContent = "⚽ GOAL!";
    } else if (result === "SAVED!") {
      banner.classList.add("saved");
      text.textContent = "🧤 SAVED!";
    } else if (result.includes("POST") || result.includes("BAR")) {
      banner.classList.add("post");
      text.textContent = `⚡ ${result}`;
    } else {
      banner.classList.add("miss");
      text.textContent = `❌ ${result}`;
    }
  }

  hideResultBanner() {
    this.ui.resultBanner.className = "result-banner hidden";
  }

  prepareNextAttempt() {
    this.hideResultBanner();

    if (this.currentAttempt >= this.maxAttempts) {
      // Round Complete
      this.state = "ROUND_OVER";
      this.showSummaryModal();
      return;
    }

    // Next kick
    this.currentAttempt++;
    this.ball.reset();
    this.keeper.startRecovery();
    this.input.setEnabled(true);
    this.state = "READY";
    this.updateHUD();
  }

  resetRound() {
    this.currentAttempt = 1;
    this.goals = 0;
    this.saves = 0;
    this.misses = 0;
    this.history = [];

    this.ball.reset();
    this.keeper.reset();
    this.particles.clear();
    this.input.setEnabled(true);
    this.state = "READY";
    this.hideResultBanner();
    this.updateHUD();
  }

  updateHUD() {
    this.ui.scoreValue.textContent = this.goals;
    this.ui.roundValue.textContent = `${this.currentAttempt}/${this.maxAttempts}`;

    // Render 5 attempt indicator dots
    this.ui.attemptIndicators.innerHTML = "";
    for (let i = 1; i <= this.maxAttempts; i++) {
      const dot = document.createElement("div");
      dot.className = "attempt-dot";

      const past = this.history.find((h) => h.attempt === i);
      if (past) {
        if (past.result === "GOAL!") {
          dot.classList.add("goal");
          dot.textContent = "⚽";
        } else {
          dot.classList.add("miss");
          dot.textContent = "❌";
        }
      } else if (i === this.currentAttempt) {
        dot.classList.add("current");
      }
      this.ui.attemptIndicators.appendChild(dot);
    }
  }

  showSummaryModal() {
    const modal = this.ui.summaryModal;
    modal.classList.remove("hidden");

    this.ui.summaryScore.textContent = `${this.goals} / ${this.maxAttempts}`;

    let rating = "";
    if (this.goals === 5) {
      rating = "🏆 BEACH FOOTBALL LEGEND! 🌟";
    } else if (this.goals >= 4) {
      rating = "🔥 SHARPSHOOTER! FANTASTIC! ⚽";
    } else if (this.goals >= 3) {
      rating = "👏 GREAT EFFORT! 🏖️";
    } else if (this.goals >= 1) {
      rating = "💪 GOOD TRY! KEEP PRACTICING!";
    } else {
      rating = "🧤 GOALKEEPER MASTERCLASS! TRY AGAIN!";
    }
    this.ui.summaryRating.textContent = rating;

    const acc = Math.round((this.goals / this.maxAttempts) * 100);
    this.ui.summaryDetails.innerHTML = `
      <div class="stat-row"><span>Goals:</span><strong>${this.goals}</strong></div>
      <div class="stat-row"><span>Saved:</span><strong>${this.saves}</strong></div>
      <div class="stat-row"><span>Missed:</span><strong>${this.misses}</strong></div>
      <div class="stat-row"><span>Accuracy:</span><strong>${acc}%</strong></div>
    `;

    audio.playWhistle();
  }

  pauseGame() {
    if (this.state === "PAUSED" || this.state === "LOADING") return;
    this.savedStateBeforePause = this.state;
    this.state = "PAUSED";
    this.input.setEnabled(false);
    this.ui.pauseModal.classList.remove("hidden");
  }

  resumeGame() {
    if (this.state !== "PAUSED") return;
    this.state = this.savedStateBeforePause;
    if (this.state === "READY" || this.state === "AIMING") {
      this.input.setEnabled(true);
    }
    this.ui.pauseModal.classList.add("hidden");
    this.lastTime = performance.now();
  }

  loop(currentTime) {
    // Skip rendering when page is hidden (saves battery)
    if (!this._isVisible) {
      this._rafId = requestAnimationFrame((t) => this.loop(t));
      this.lastTime = currentTime;
      return;
    }

    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    if (this.state !== "PAUSED" && this.state !== "LOADING") {
      // 1. Update Ball Physics
      this.ball.update(dt, this.keeper, this.particles, audio);

      // Check if shot has finished
      if (this.state === "IN_FLIGHT" && this.ball.result) {
        this.onShotResolved(this.ball.result);
      }

      // 2. Update Goalkeeper
      this.keeper.update(dt);

      // 3. Update Particles
      this.particles.update(dt);

      // 4. Result timer countdown
      if (this.state === "RESULT") {
        this.resultTimer -= dt;
        if (this.resultTimer <= 0) {
          this.prepareNextAttempt();
        }
      }
    }

    // 5. Render Scene
    this.renderer.render(this.state, this.keeper, this.ball, this.particles, this.input);

    this._rafId = requestAnimationFrame((t) => this.loop(t));
  }
}
