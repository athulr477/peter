// Goalkeeper AI & State Machine for Beach Penalty Shootout

export class Goalkeeper {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0;              // -1 to 1 (0 is goal center line)
    this.y = 0;              // 0 is ground
    this.z = 0.98;           // Placed right on the goal line

    this.targetX = 0;
    this.targetY = 0;
    this.diveSpeed = 2.4;

    this.state = "idle";     // "idle", "anticipating", "reacting", "diving-left", "diving-right", "jumping", "saving", "beaten", "celebrating", "recovering"
    this.currentPose = "guard"; // "guard" or "ready"

    this.rotation = 0;       // Body tilt in radians
    this.scale = 1.0;
    this.reactionTimer = 0;
    this.reactionDelay = 0.16; // Realistic human delay in seconds

    this.idleTimer = 0;
    this.diveProgress = 0;
    this.reachRadius = 0.28; // Glove and arm extension reach
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

    // Reaction delay based on power (harder shots leave less reaction window)
    this.reactionDelay = Math.max(0.12, 0.22 - power * 0.06);
    this.reactionTimer = 0;
    this.diveProgress = 0;

    // AI decision: Determine goalkeeper anticipation accuracy
    // Real beach keepers guess direction with high accuracy, but corner shots are harder to reach
    const roll = Math.random();
    let diveTargetX = targetWorldX;
    let diveTargetY = targetWorldY;

    // 20% chance of guessing wrong side if shot is very wide, or hesitating
    if (roll < 0.20 && Math.abs(targetWorldX) > 0.35) {
      // Wrong dive or slow reaction
      diveTargetX = -targetWorldX * 0.5;
    } else if (roll < 0.35 && Math.abs(targetWorldX) > 0.45) {
      // Late dive
      this.reactionDelay += 0.08;
    }

    // Clamp dive reach so top corners remain beatable for skillful players!
    this.aiGoalX = Math.max(-0.58, Math.min(0.58, diveTargetX * 0.9));
    this.aiGoalY = Math.max(0, Math.min(0.52, diveTargetY * 0.85));
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
        if (this.aiGoalX < -0.15) {
          this.state = "diving-left";
        } else if (this.aiGoalX > 0.15) {
          this.state = "diving-right";
        } else if (this.aiGoalY > 0.35) {
          this.state = "jumping";
        } else {
          this.state = "diving-center";
        }
      }
    } else if (this.state.startsWith("diving") || this.state === "jumping") {
      this.diveProgress = Math.min(1.0, this.diveProgress + dt * this.diveSpeed);

      // Move toward target position
      const ease = 1 - Math.pow(1 - this.diveProgress, 3);
      this.x = this.x + (this.aiGoalX - this.x) * (dt * 6.5);
      this.y = Math.max(0, this.aiGoalY * Math.sin(this.diveProgress * Math.PI));

      // Tilt body according to dive direction
      if (this.aiGoalX < -0.1) {
        this.rotation = -0.45 * Math.sin(this.diveProgress * Math.PI * 0.8);
      } else if (this.aiGoalX > 0.1) {
        this.rotation = 0.45 * Math.sin(this.diveProgress * Math.PI * 0.8);
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
    const ky = this.y + 0.28; // Glove center height above ground

    // Reach ellipse: keeper has horizontal reach from arms, plus vertical reach
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
