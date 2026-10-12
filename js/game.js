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
      scoreValue: document.getElementById("scoreValue"),
      roundValue: document.getElementById("roundValue"),
      targetValue: document.getElementById("targetValue"),
      attemptIndicators: document.getElementById("attemptIndicators"),
      hudLevelNum: document.getElementById("hudLevelNum"),
      hudLevelName: document.getElementById("hudLevelName"),
      hudLevelStars: document.getElementById("hudLevelStars"),
      levelBadgeBtn: document.getElementById("levelBadgeBtn"),
      hudWindWidget: document.getElementById("hudWindWidget"),
      hudWindText: document.getElementById("hudWindText"),
      tutorial: document.getElementById("swipeTutorial"),
      resultBanner: document.getElementById("resultBanner"),
      resultText: document.getElementById("resultText"),
      openLevelSelectBtn: document.getElementById("openLevelSelectBtn"),
      pauseBtn: document.getElementById("pauseBtn"),
      quickRestartBtn: document.getElementById("quickRestartBtn"),
      pauseModal: document.getElementById("pauseModal"),
      resumeBtn: document.getElementById("resumeBtn"),
      pauseLevelSelectBtn: document.getElementById("pauseLevelSelectBtn"),
      restartBtn: document.getElementById("restartBtn"),
      soundToggleBtn: document.getElementById("soundToggleBtn"),
      soundIcon: document.getElementById("soundIcon"),
      summaryModal: document.getElementById("summaryModal"),
      summaryScore: document.getElementById("summaryScore"),
      summaryRating: document.getElementById("summaryRating"),
      summaryDetails: document.getElementById("summaryDetails"),
      playAgainBtn: document.getElementById("playAgainBtn"),
      levelSelectModal: document.getElementById("levelSelectModal"),
      closeLevelSelectBtn: document.getElementById("closeLevelSelectBtn"),
      totalStarsCount: document.getElementById("totalStarsCount"),
      levelsGrid: document.getElementById("levelsGrid"),
      levelResultModal: document.getElementById("levelResultModal"),
      resultTrophyIcon: document.getElementById("resultTrophyIcon"),
      resultHeaderTitle: document.getElementById("resultHeaderTitle"),
      resultLevelSub: document.getElementById("resultLevelSub"),
      star1: document.getElementById("star1"),
      star2: document.getElementById("star2"),
      star3: document.getElementById("star3"),
      resGoalsText: document.getElementById("resGoalsText"),
      resTargetText: document.getElementById("resTargetText"),
      resTargetHitsRow: document.getElementById("resTargetHitsRow"),
      resTargetHitsText: document.getElementById("resTargetHitsText"),
      resPointsText: document.getElementById("resPointsText"),
      nextLevelBtn: document.getElementById("nextLevelBtn"),
      retryLevelBtn: document.getElementById("retryLevelBtn"),
      openLevelsFromResultsBtn: document.getElementById("openLevelsFromResultsBtn"),
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
    // Pause button & modal
    this.ui.pauseBtn.addEventListener("click", () => this.pauseGame());
    this.ui.resumeBtn.addEventListener("click", () => this.resumeGame());
    this.ui.restartBtn.addEventListener("click", () => {
      this.resumeGame();
      this.resetRound();
    });

    // Quick restart button (HUD)
    if (this.ui.quickRestartBtn) {
      this.ui.quickRestartBtn.addEventListener("click", () => {
        if (this.state === "PAUSED") this.resumeGame();
        this.resetRound();
      });
    }

    // Level Badge Button opens Level Select
    if (this.ui.levelBadgeBtn) {
      this.ui.levelBadgeBtn.addEventListener("click", () => {
        this.openLevelSelectModal();
      });
    }

    // Open Level Select Button (HUD)
    if (this.ui.openLevelSelectBtn) {
      this.ui.openLevelSelectBtn.addEventListener("click", () => {
        this.openLevelSelectModal();
      });
    }

    if (this.ui.pauseLevelSelectBtn) {
      this.ui.pauseLevelSelectBtn.addEventListener("click", () => {
        this.ui.pauseModal.classList.add("hidden");
        this.openLevelSelectModal();
      });
    }

    if (this.ui.closeLevelSelectBtn) {
      this.ui.closeLevelSelectBtn.addEventListener("click", () => {
        this.closeLevelSelectModal();
      });
    }

    // Level Result Modal Actions
    if (this.ui.nextLevelBtn) {
      this.ui.nextLevelBtn.addEventListener("click", () => {
        const nextId = this.levelManager.getNextLevelId();
        if (nextId) {
          this.ui.levelResultModal.classList.add("hidden");
          this.loadLevel(nextId);
        }
      });
    }

    if (this.ui.retryLevelBtn) {
      this.ui.retryLevelBtn.addEventListener("click", () => {
        this.ui.levelResultModal.classList.add("hidden");
        this.resetRound();
      });
    }

    if (this.ui.openLevelsFromResultsBtn) {
      this.ui.openLevelsFromResultsBtn.addEventListener("click", () => {
        this.ui.levelResultModal.classList.add("hidden");
        this.openLevelSelectModal();
      });
    }

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === "r" || e.key === "R") {
        if (this.state === "PAUSED") this.resumeGame();
        this.resetRound();
      } else if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (this.state === "PAUSED") {
          this.resumeGame();
        } else if (this.state === "READY" || this.state === "AIMING") {
          this.pauseGame();
        }
      } else if (e.key === "l" || e.key === "L") {
        this.openLevelSelectModal();
      }
    });

    // Sound toggle
    this.ui.soundToggleBtn.addEventListener("click", () => {
      const isMuted = audio.toggleMute();
      this.updateSoundIcon(isMuted);
    });

    // Play Again button (legacy summary)
    this.ui.playAgainBtn.addEventListener("click", () => {
      this.ui.summaryModal.classList.add("hidden");
      this.resetRound();
    });

    // Prevent double-tap zoom on buttons
    document.querySelectorAll(".btn, .hud-btn, .close-modal-btn").forEach((btn) => {
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
      const evalRes = this.levelManager.evaluateResult(this.goals, this.targetsHitCount, this.levelScore);
      this.showLevelResultModal(evalRes);
      return;
    }

    // Next kick in current level
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
    const lvl = this.levelManager.getCurrentLevel();

    this.ui.scoreValue.textContent = this.levelScore.toLocaleString();
    this.ui.roundValue.textContent = `${this.currentAttempt}/${this.maxAttempts}`;
    this.ui.targetValue.textContent = `${this.goals}/${lvl.targetGoals} REQ`;

    if (this.ui.hudLevelNum) this.ui.hudLevelNum.textContent = lvl.id;
    if (this.ui.hudLevelName) this.ui.hudLevelName.textContent = lvl.name;

    // Mini stars for current level
    if (this.ui.hudLevelStars) {
      const stars = this.levelManager.getStarsEarned(lvl.id);
      let starsStr = "";
      for (let s = 1; s <= 3; s++) {
        starsStr += s <= stars ? "★" : "☆";
      }
      this.ui.hudLevelStars.textContent = starsStr;
    }

    // Wind Widget
    if (this.ui.hudWindWidget) {
      if (Math.abs(this.wind) > 0.05) {
        this.ui.hudWindWidget.classList.remove("hidden");
        this.ui.hudWindText.textContent = lvl.windLabel;
      } else {
        this.ui.hudWindWidget.classList.add("hidden");
      }
    }

    // 5 attempt indicator dots
    this.ui.attemptIndicators.innerHTML = "";
    for (let i = 1; i <= this.maxAttempts; i++) {
      const dot = document.createElement("div");
      dot.className = "attempt-dot";

      const past = this.history.find((h) => h.attempt === i);
      if (past) {
        if (past.result.includes("GOAL") || past.result.includes("BULLSEYE")) {
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

  showLevelResultModal(evalRes) {
    const modal = this.ui.levelResultModal;
    modal.classList.remove("hidden");

    this.ui.resultLevelSub.textContent = `LEVEL ${evalRes.levelId}: ${evalRes.levelName}`;
    this.ui.resGoalsText.textContent = `${evalRes.goalsScored} / ${evalRes.maxAttempts}`;
    this.ui.resTargetText.textContent = `${evalRes.targetGoals} Goals`;
    this.ui.resPointsText.textContent = `${evalRes.totalPoints.toLocaleString()} PTS`;

    if (evalRes.targetsHitCount > 0) {
      this.ui.resTargetHitsRow.classList.remove("hidden");
      this.ui.resTargetHitsText.textContent = `${evalRes.targetsHitCount}`;
    } else {
      this.ui.resTargetHitsRow.classList.add("hidden");
    }

    // Star elements reset
    [this.ui.star1, this.ui.star2, this.ui.star3].forEach((star) => {
      star.className = "result-star";
    });

    if (evalRes.passed) {
      this.ui.resultTrophyIcon.textContent = "🏆";
      this.ui.resultHeaderTitle.textContent = "LEVEL CLEARED! 🌟";
      this.ui.resultHeaderTitle.style.color = "var(--color-gold)";

      // Sound
      audio.playLevelWin();

      // Show Next Level button if next level exists
      if (evalRes.hasNextLevel) {
        this.ui.nextLevelBtn.style.display = "flex";
      } else {
        this.ui.nextLevelBtn.style.display = "none";
      }

      // Animate earned stars sequentially
      for (let s = 1; s <= evalRes.stars; s++) {
        setTimeout(() => {
          const starEl = this.ui[`star${s}`];
          if (starEl) {
            starEl.classList.add("earned");
            audio.playStarReveal(s);
          }
        }, 350 * s);
      }
    } else {
      this.ui.resultTrophyIcon.textContent = "💔";
      this.ui.resultHeaderTitle.textContent = "LEVEL FAILED";
      this.ui.resultHeaderTitle.style.color = "#ff4757";

      audio.playLevelFail();
      this.ui.nextLevelBtn.style.display = "none";
    }
  }

  openLevelSelectModal() {
    if (this.state === "READY" || this.state === "AIMING") {
      this.input.setEnabled(false);
    }

    const modal = this.ui.levelSelectModal;
    modal.classList.remove("hidden");

    this.ui.totalStarsCount.textContent = this.levelManager.getTotalStars();

    const levels = this.levelManager.getAllLevels();
    const grid = this.ui.levelsGrid;
    grid.innerHTML = "";

    levels.forEach((lvl) => {
      const card = document.createElement("div");
      card.className = "level-card";
      if (!lvl.isUnlocked) card.classList.add("locked");
      if (lvl.id === this.levelManager.currentLevelId) card.classList.add("active-level");

      // Stars string
      let starsHtml = "";
      for (let i = 1; i <= 3; i++) {
        if (i <= lvl.starsEarned) {
          starsHtml += "<span>★</span>";
        } else {
          starsHtml += "<span class='empty-star'>★</span>";
        }
      }

      // Meta pills
      let metaHtml = `<span class="meta-pill">🎯 Goal: ${lvl.targetGoals}/5</span>`;
      if (lvl.targets && lvl.targets.length > 0) {
        metaHtml += `<span class="meta-pill pill-target">Bullseyes (${lvl.targets.length})</span>`;
      }
      if (Math.abs(lvl.wind) > 0.05) {
        metaHtml += `<span class="meta-pill pill-wind">💨 ${lvl.windLabel}</span>`;
      }

      card.innerHTML = `
        <div class="level-card-top">
          <span class="level-num-badge">LEVEL ${lvl.id}</span>
          <div class="level-stars-row">${starsHtml}</div>
        </div>
        <div class="level-card-name">${lvl.icon} ${lvl.name} ${!lvl.isUnlocked ? "🔒" : ""}</div>
        <p class="level-card-desc">${lvl.subtitle}</p>
        <div class="level-card-meta">${metaHtml}</div>
      `;

      if (lvl.isUnlocked) {
        card.addEventListener("click", () => {
          this.closeLevelSelectModal();
          this.loadLevel(lvl.id);
        });
      }

      grid.appendChild(card);
    });
  }

  closeLevelSelectModal() {
    this.ui.levelSelectModal.classList.add("hidden");
    if (this.state === "READY" || this.state === "AIMING") {
      this.input.setEnabled(true);
    }
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
