// Goalkeeper AI & State Machine for Beach Penalty Shootout

export class Goalkeeper {
  constructor() {
    this.levelConfig = {};
    this.reset();
  }

  setLevelConfig(config = {}) {
    this.levelConfig = config;
    if (config.diveSpeed) this.diveSpeed = config.diveSpeed;
    if (config.reactionDelay) this.reactionDelay = config.reactionDelay;
    if (config.reachRadius) this.reachRadius = config.reachRadius;
  }

  reset() {
    this.x = 0;              // -1 to 1 (0 is goal center line)
    this.y = 0;              // 0 is ground
    this.z = 0.98;           // Placed right on the goal line

    this.targetX = 0;
    this.targetY = 0;
    this.diveSpeed = this.levelConfig.diveSpeed || 2.0;

    this.state = "idle";     // "idle", "anticipating", "reacting", "diving-left", "diving-right", "diving-center", "saving", "beaten", "celebrating", "recovering"
    this.currentPose = "guard"; // "guard" or "ready"

    this.rotation = 0;       // Body tilt in radians
    this.scale = 1.0;
    this.reactionTimer = 0;
    this.reactionDelay = this.levelConfig.reactionDelay || 0.22; // Realistic human delay in seconds

    this.idleTimer = 0;
    this.diveProgress = 0;
    this.reachRadius = this.levelConfig.reachRadius || 0.09; // Fair glove/body reach, does not vacuum the ball
    this.aiGoalX = 0;
    this.aiGoalY = 0;
  }

  onAimStart() {
    if (this.state === "idle") {
      this.state = "anticipating";
      this.currentPose = "ready";
    }
  }

  onAimMove(aimDirectionX) {
    if (this.state === "anticipating") {
      // Subtle anticipation lean
      this.x = aimDirectionX * 0.04;
    }
  }

  onAimCancel() {
    if (this.state === "anticipating") {
      this.state = "idle";
      this.currentPose = "guard";
      this.x = 0;
    }
  }

  onShotFired(targetWorldX, targetWorldY, power) {
    this.state = "reacting";
    this.currentPose = "ready";
    this.targetX = targetWorldX;
    this.targetY = targetWorldY;

    // Human reaction delay (keeper reacts after the ball is kicked, not before)
    this.reactionDelay = Math.max(0.20, 0.28 - power * 0.05);
    this.reactionTimer = 0;
    this.diveProgress = 0;

    // Independent blind guess: penalty goalkeepers commit to a direction independently of the shot
    // 45% dives Left, 45% dives Right, 10% freezes Center
    const guessRoll = Math.random();
    let diveTargetX = 0;
    let diveTargetY = Math.min(0.35, Math.random() * 0.32);

    if (guessRoll < 0.45) {
      // Dive Left
      diveTargetX = -(0.28 + Math.random() * 0.08);
    } else if (guessRoll < 0.90) {
      // Dive Right
      diveTargetX = 0.28 + Math.random() * 0.08;
    } else {
      // Stay Center / late jump
      diveTargetX = 0;
    }

    this.aiGoalX = diveTargetX;
    this.aiGoalY = diveTargetY;
  }

  update(dt) {
    this.idleTimer += dt;

    if (this.state === "idle") {
      this.currentPose = "guard";
      this.rotation = Math.sin(this.idleTimer * 2.5) * 0.02;
      this.y = Math.abs(Math.sin(this.idleTimer * 3)) * 0.015;
      this.x += (0 - this.x) * 0.1;
    } else if (this.state === "anticipating") {
      this.currentPose = "ready";
      this.rotation = Math.sin(this.idleTimer * 4.0) * 0.03;
    } else if (this.state === "reacting") {
      this.reactionTimer += dt;
      if (this.reactionTimer >= this.reactionDelay) {
        // Start diving
        if (this.aiGoalX < -0.12) {
          this.state = "diving-left";
        } else if (this.aiGoalX > 0.12) {
          this.state = "diving-right";
        } else {
          this.state = "diving-center";
        }
      }
    } else if (this.state.startsWith("diving")) {
      this.diveProgress = Math.min(1.0, this.diveProgress + dt * this.diveSpeed);

      // Move toward target position
      this.x = this.x + (this.aiGoalX - this.x) * (dt * 5.8);
      this.y = Math.max(0, this.aiGoalY * Math.sin(this.diveProgress * Math.PI));

      // Tilt body according to dive direction
      if (this.aiGoalX < -0.1) {
        this.rotation = -0.42 * Math.sin(this.diveProgress * Math.PI * 0.8);
      } else if (this.aiGoalX > 0.1) {
        this.rotation = 0.42 * Math.sin(this.diveProgress * Math.PI * 0.8);
      } else {
        this.rotation = 0;
      }
    } else if (this.state === "saving" || this.state === "celebrating") {
      // Pump fists / victory pose
      this.currentPose = "guard";
      this.rotation = Math.sin(this.idleTimer * 8) * 0.05;
    } else if (this.state === "beaten") {
      // Conceded goal reaction
      this.rotation *= 0.95;
      this.y = Math.max(0, this.y - dt * 1.5);
    } else if (this.state === "recovering") {
      // Smoothly return to center
      this.x += (0 - this.x) * (dt * 3.5);
      this.y += (0 - this.y) * (dt * 3.5);
      this.rotation *= 0.88;
      if (Math.abs(this.x) < 0.02 && this.y < 0.02) {
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.state = "idle";
        this.currentPose = "guard";
      }
    }
  }

  checkSave(ballX, ballY) {
    // Current keeper center in world units
    const kx = this.x;
    const ky = this.y + 0.24; // Glove center height above ground

    // Reach ellipse: glove/arm reach
    const dx = (ballX - kx) / this.reachRadius;
    const dy = (ballY - ky) / (this.reachRadius * 1.25);
    const distSq = dx * dx + dy * dy;

    // Saved if ball intersects reach radius
    return distSq <= 1.0;
  }

  onSaveSuccess() {
    this.state = "saving";
    setTimeout(() => {
      if (this.state === "saving") this.state = "celebrating";
    }, 200);
  }

  onGoalConceded() {
    this.state = "beaten";
  }

  onMissFired() {
    setTimeout(() => {
      this.state = "celebrating";
    }, 200);
  }

  startRecovery() {
    this.state = "recovering";
  }
}
