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
    this.reachRadius = this.levelConfig.reachRadius || 0.17; // Glove and arm extension reach (fair and realistic)
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
      // Subtle anticipation lean toward aim side
      this.x = aimDirectionX * 0.08;
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

    // Reaction delay based on power (harder shots leave less reaction window for keeper)
    this.reactionDelay = Math.max(0.16, 0.26 - power * 0.06);
    this.reactionTimer = 0;
    this.diveProgress = 0;

    const roll = Math.random();
    let diveTargetX = 0;
    let diveTargetY = targetWorldY * 0.72;

    // Realistic penalty shootout goalkeeper decision making:
    // Real penalty goalkeepers must guess a direction or hold center
    if (Math.abs(targetWorldX) < 0.22) {
      // Central shot:
      // 45% chance keeper gambles and dives toward a post, leaving center open!
      // 55% chance keeper stays relatively central and saves it
      if (roll < 0.45) {
        diveTargetX = (roll < 0.22 ? -1 : 1) * (0.35 + Math.random() * 0.12);
      } else {
        diveTargetX = targetWorldX * 0.55;
      }
    } else {
      // Shot aimed towards a side:
      const targetSide = Math.sign(targetWorldX); // -1 (left) or 1 (right)
      const wrongChance = this.levelConfig.wrongGuessChance ?? 0.32;

      if (roll < wrongChance) {
        // Goalkeeper guesses WRONG side! (Dives opposite way -> GOAL!)
        diveTargetX = -targetSide * (0.32 + Math.random() * 0.15);
      } else if (roll < wrongChance + 0.20) {
        // Goalkeeper hesitates / late dive
        this.reactionDelay += 0.10;
        diveTargetX = targetSide * (0.28 + Math.random() * 0.14);
      } else {
        // Goalkeeper anticipates correct side!
        // But human dive reach is physically limited - corner shots beat them!
        diveTargetX = targetSide * Math.min(0.42, Math.abs(targetWorldX) * 0.75);
      }
    }

    // Limit maximum goalkeeper reach so corners and top bins are beatable with good shots!
    this.aiGoalX = Math.max(-0.44, Math.min(0.44, diveTargetX));
    this.aiGoalY = Math.max(0, Math.min(0.45, diveTargetY));
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
