// Main Game Orchestration for Beach Penalty Shootout
// Fully mobile-optimized with 6-level campaign, wind physics, targets, and star system

import { audio } from "./audio.js";
import { ParticleSystem } from "./particles.js";
import { BallPhysics } from "./physics.js";
import { Goalkeeper } from "./goalkeeper.js";
import { GameRenderer } from "./renderer.js";
import { InputController } from "./input.js";
import { LevelManager } from "./levels.js";

export class BeachPenaltyGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.renderer = new GameRenderer(this.canvas);
    this.particles = new ParticleSystem();
    this.ball = new BallPhysics();
    this.keeper = new Goalkeeper();
    this.input = new InputController(this.canvas, this.renderer);
    this.levelManager = new LevelManager();

    // Game state
    this.state = "LOADING"; // "LOADING", "READY", "AIMING", "IN_FLIGHT", "RESULT", "PAUSED", "ROUND_OVER"
    this.savedStateBeforePause = "READY";

    // Round & Level Stats
    this.maxAttempts = 5;
    this.currentAttempt = 1;
    this.goals = 0;
    this.saves = 0;
    this.misses = 0;
    this.levelScore = 0;
    this.targetsHitCount = 0;
    this.activeTargets = [];
    this.wind = 0;
    this.history = []; // Array of { attempt: 1, result: "GOAL" }

    this.tutorialVisible = true;
    this.resultTimer = 0;
    this.lastTime = performance.now();
    this._rafId = null;
    this._isVisible = true;

    // DOM UI elements
    this.ui = {
      resultBanner: document.getElementById("resultBanner"),
      resultText: document.getElementById("resultText"),
      gameOverModal: document.getElementById("gameOverModal"),
      gameOverIcon: document.getElementById("gameOverIcon"),
      gameOverTitle: document.getElementById("gameOverTitle"),
      gameOverScoreText: document.getElementById("gameOverScoreText"),
      gameOverRating: document.getElementById("gameOverRating"),
      gameOverRestartBtn: document.getElementById("gameOverRestartBtn"),
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
        // Complete preloading
        if (this.ui.loadingOverlay) {
          this.ui.loadingOverlay.classList.add("hidden");
          setTimeout(() => {
            if (this.ui.loadingOverlay) {
              this.ui.loadingOverlay.style.display = "none";
            }
          }, 300);
        }
        this.loadLevel(this.levelManager.currentLevelId);
        this.state = "READY";
        this.lastTime = performance.now();
        this._rafId = requestAnimationFrame((t) => this.loop(t));
      }
    );
  }

  loadLevel(levelId) {
    this.levelManager.setCurrentLevel(levelId);
    const lvl = this.levelManager.getCurrentLevel();

    this.maxAttempts = lvl.maxAttempts;
    this.wind = lvl.wind || 0;
    this.activeTargets = lvl.targets ? lvl.targets.map((t) => ({ ...t, hit: false })) : [];
    this.keeper.setLevelConfig(lvl.keeperConfig);

    this.resetRound();
  }

  setupVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this._isVisible = false;
        if (this.state === "READY" || this.state === "AIMING") {
          this.pauseGame();
        }
      } else {
        this._isVisible = true;
        this.lastTime = performance.now();
      }
    });

    window.addEventListener("pagehide", () => {
      this._isVisible = false;
    });
    window.addEventListener("pageshow", () => {
      this._isVisible = true;
      this.lastTime = performance.now();
    });
  }

  setupMobileEnhancements() {
    const container = document.getElementById("gameContainer");
    if (container) {
      container.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    }

    document.body.addEventListener("touchmove", (e) => {
      if (e.target === document.body || e.target === this.canvas) {
        e.preventDefault();
      }
    }, { passive: false });
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
    // Restart button in Game Over modal
    if (this.ui.gameOverRestartBtn) {
      this.ui.gameOverRestartBtn.addEventListener("click", () => {
        this.resetRound();
      });
    }

    // Keyboard shortcuts: R to restart anytime
    window.addEventListener("keydown", (e) => {
      if (e.key === "r" || e.key === "R") {
        this.resetRound();
      }
    });

    // Prevent double-tap zoom on buttons
    document.querySelectorAll(".btn, .restart-main-btn").forEach((btn) => {
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

    audio.playKick(power);
    const ballPos = this.renderer.worldToRef(this.ball.x, this.ball.y, this.ball.z);
    this.particles.emitSandPuff(ballPos.x, ballPos.groundY, 30, power);

    if ("vibrate" in navigator) {
      try { navigator.vibrate(40); } catch (e) {}
    }

    // Goalkeeper reaction
    this.keeper.onShotFired(targetX, targetY, power);

    // Launch ball with level wind
    this.ball.shoot(targetX, targetY, power, curve, this.wind);
  }

  onShotResolved(result) {
    this.state = "RESULT";
    this.resultTimer = 1.6;

    this.history.push({ attempt: this.currentAttempt, result });

    if (result.includes("GOAL") || result.includes("BULLSEYE")) {
      this.goals++;
      let pointsAwarded = 1000;

      const ballPos = this.renderer.worldToRef(this.ball.x, this.ball.y, this.ball.z);
      this.particles.emitGoalSparks(ballPos.x, ballPos.y, 70);
      this.particles.triggerNetRipple(ballPos.x, ballPos.y);

      // Check if target was hit
      if (this.ball.hitTarget) {
        this.targetsHitCount++;
        pointsAwarded += this.ball.hitTarget.points;

        const targetRef = this.renderer.worldToRef(this.ball.hitTarget.x, this.ball.hitTarget.y, 1.0);
        this.particles.emitTargetShatter(targetRef.x, targetRef.y);

        if ("vibrate" in navigator) {
          try { navigator.vibrate([80, 50, 150]); } catch (e) {}
        }
      } else if ("vibrate" in navigator) {
        try { navigator.vibrate([60, 40, 120]); } catch (e) {}
      }

      this.levelScore += pointsAwarded;
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
    if (result.includes("BULLSEYE")) {
      banner.classList.add("goal");
      text.textContent = result;
    } else if (result === "GOAL!") {
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
      // Level Round Finished
      this.state = "ROUND_OVER";
      this.showGameOverModal();
      return;
    }

    // Next kick in current round
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
    this.levelScore = 0;
    this.targetsHitCount = 0;
    this.history = [];

    // Reset targets for current level
    const lvl = this.levelManager.getCurrentLevel();
    this.activeTargets = lvl.targets ? lvl.targets.map((t) => ({ ...t, hit: false })) : [];

    if (this.ui.gameOverModal) this.ui.gameOverModal.classList.add("hidden");
    if (this.ui.pauseModal) this.ui.pauseModal.classList.add("hidden");
    if (this.ui.summaryModal) this.ui.summaryModal.classList.add("hidden");
    if (this.ui.levelResultModal) this.ui.levelResultModal.classList.add("hidden");
    if (this.ui.levelSelectModal) this.ui.levelSelectModal.classList.add("hidden");

    this.ball.reset();
    this.keeper.reset();
    this.particles.clear();
    this.input.setEnabled(true);
    this.state = "READY";
    this.hideResultBanner();
    this.updateHUD();
    audio.playWhistle();
  }

  updateHUD() {
    if (this.ui.scoreValue) this.ui.scoreValue.textContent = this.levelScore.toLocaleString();
    if (this.ui.roundValue) this.ui.roundValue.textContent = `${this.currentAttempt}/${this.maxAttempts}`;
    if (this.ui.targetValue) this.ui.targetValue.textContent = `${this.goals} GOALS`;
  }

  showGameOverModal() {
    const modal = this.ui.gameOverModal;
    if (!modal) return;
    modal.classList.remove("hidden");

    if (this.ui.gameOverScoreText) {
      this.ui.gameOverScoreText.textContent = `${this.goals} / ${this.maxAttempts}`;
    }

    if (this.ui.gameOverRating) {
      if (this.goals >= 5) {
        this.ui.gameOverRating.textContent = "PERFECT 5/5! BEACH LEGEND! 🌟";
      } else if (this.goals >= 4) {
        this.ui.gameOverRating.textContent = "FANTASTIC SHOOTING! ⚽";
      } else if (this.goals >= 3) {
        this.ui.gameOverRating.textContent = "GREAT GOALSCORER! 🎯";
      } else if (this.goals >= 1) {
        this.ui.gameOverRating.textContent = "GOOD EFFORT! KEEP GOING! 💪";
      } else {
        this.ui.gameOverRating.textContent = "TRY AGAIN! YOU CAN DO IT! 🏖️";
      }
    }

    if (this.goals >= 3) {
      audio.playLevelWin();
    } else {
      audio.playWhistle();
    }
  }


  openLevelSelectModal() {
    if (!this.ui.levelSelectModal) return;
    if (this.state === "READY" || this.state === "AIMING") {
      this.input.setEnabled(false);
    }

    const modal = this.ui.levelSelectModal;
    modal.classList.remove("hidden");
  }

  closeLevelSelectModal() {
    if (this.ui.levelSelectModal) {
      this.ui.levelSelectModal.classList.add("hidden");
    }
    if (this.state === "READY" || this.state === "AIMING") {
      this.input.setEnabled(true);
    }
  }

  pauseGame() {
    if (this.state === "PAUSED" || this.state === "LOADING") return;
    this.savedStateBeforePause = this.state;
    this.state = "PAUSED";
    this.input.setEnabled(false);
    if (this.ui.pauseModal) {
      this.ui.pauseModal.classList.remove("hidden");
    }
  }

  resumeGame() {
    if (this.state !== "PAUSED") return;
    this.state = this.savedStateBeforePause;
    if (this.state === "READY" || this.state === "AIMING") {
      this.input.setEnabled(true);
    }
    if (this.ui.pauseModal) {
      this.ui.pauseModal.classList.add("hidden");
    }
    this.lastTime = performance.now();
  }

  loop(currentTime) {
    if (!this._isVisible) {
      this._rafId = requestAnimationFrame((t) => this.loop(t));
      this.lastTime = currentTime;
      return;
    }

    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    if (this.state !== "PAUSED" && this.state !== "LOADING") {
      // 1. Update Ball Physics with level targets & wind
      this.ball.update(dt, this.keeper, this.particles, audio, this.activeTargets);

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

    // 5. Render Scene with targets and wind
    this.renderer.render(
      this.state,
      this.keeper,
      this.ball,
      this.particles,
      this.input,
      this.activeTargets,
      this.wind
    );

    this._rafId = requestAnimationFrame((t) => this.loop(t));
  }
}
