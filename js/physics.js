// Physics & Ball Trajectory Engine for Beach Penalty Shootout

export const GOAL_BOUNDS = {
  // Normalized world coordinates
  leftPostX: -0.74,
  rightPostX: 0.74,
  crossbarY: 0.71,
  groundY: 0.0,
  postRadius: 0.048,
  netDepthZ: 1.25,
};

export class BallPhysics {
  constructor() {
    this.reset();
  }

  reset() {
    // 3D position in normalized space
    this.x = 0;        // -1 to 1 (0 is goal center)
    this.y = 0;        // 0 is sand, 0.71 is crossbar
    this.z = 0;        // 0 is foreground penalty spot, 1 is goal line

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.targetX = 0;
    this.targetY = 0;
    this.curve = 0;      // Lateral Magnus spin
    this.arcPeak = 0;    // Vertical arc bonus

    this.flightTime = 0;
    this.duration = 0.7; // Total time to reach goal plane

    this.rotation = 0;
    this.rotSpeed = 0;

    this.state = "AT_REST"; // "AT_REST", "IN_FLIGHT", "SCORED", "SAVED", "HIT_POST", "HIT_BAR", "MISSED", "GROUNDED"
    this.result = null;     // "GOAL", "SAVED", "OFF THE POST!", "WIDE!", "OVER THE BAR!"
    this.checkedCollision = false;

    // Deflection / rebound physics
    this.reboundVx = 0;
    this.reboundVy = 0;
    this.reboundVz = 0;
  }

  // Launch a shot based on swipe analysis
  shoot(targetWorldX, targetWorldY, power = 1.0, curve = 0.0) {
    this.reset();

    this.targetX = targetWorldX;
    this.targetY = targetWorldY;
    this.curve = curve;

    // Power controls flight duration (faster swipe = faster shot)
    const baseDuration = 0.72;
    this.duration = Math.max(0.48, Math.min(0.95, baseDuration / Math.max(0.6, power)));

    // Ballistic arc height
    this.arcPeak = Math.max(0.04, 0.12 - (targetWorldY * 0.05));

    this.flightTime = 0;
    this.rotSpeed = (12 + Math.abs(curve) * 15 + power * 8) * (curve >= 0 ? 1 : -1);
    this.state = "IN_FLIGHT";
    this.result = null;
    this.checkedCollision = false;
  }

  update(dt, keeper, particleSystem, audio) {
    if (this.state === "AT_REST") return;

    this.rotation += this.rotSpeed * dt;

    if (this.state === "IN_FLIGHT") {
      this.flightTime += dt;
      const progress = Math.min(1.0, this.flightTime / this.duration);

      // Interpolate depth Z from 0 to 1
      this.z = progress;

      // Parabolic vertical trajectory
      const linearY = this.targetY * progress;
      const parabolicArc = 4 * this.arcPeak * progress * (1 - progress);
      this.y = Math.max(0, linearY + parabolicArc);

      // Curved horizontal trajectory (Magnus curve effect)
      const linearX = this.targetX * progress;
      const curveX = this.curve * Math.sin(progress * Math.PI) * 0.35;
      this.x = linearX + curveX;

      // Check collision near goal plane (Z >= 0.94)
      if (progress >= 0.94 && !this.checkedCollision) {
        this.evaluateGoalPlane(keeper, particleSystem, audio);
      }

      // Reached goal line
      if (progress >= 1.0) {
        if (this.state === "IN_FLIGHT") {
          // Fallback if not evaluated
          this.evaluateGoalPlane(keeper, particleSystem, audio);
        }
      }
    } else if (this.state === "SCORED") {
      // Ball drops inside the net
      this.z = Math.min(1.15, this.z + 0.3 * dt);
      this.y = Math.max(0.05, this.y - 1.2 * dt);
      this.rotSpeed *= 0.92;
    } else if (this.state === "SAVED" || this.state === "HIT_POST" || this.state === "HIT_BAR" || this.state === "MISSED") {
      // Ball rebounds / continues on deflect path
      this.x += this.reboundVx * dt;
      this.y += this.reboundVy * dt;
      this.z += this.reboundVz * dt;
      this.reboundVy -= 1.8 * dt; // Gravity

      if (this.y <= 0) {
        this.y = 0;
        this.reboundVy = -this.reboundVy * 0.4;
        this.reboundVx *= 0.7;
        this.rotSpeed *= 0.8;
      }
    }
  }

  evaluateGoalPlane(keeper, particleSystem, audio) {
    this.checkedCollision = true;

    const ballX = this.x;
    const ballY = this.y;

    // 1. Post and Crossbar Collisions
    const leftDist = Math.hypot(ballX - GOAL_BOUNDS.leftPostX, Math.max(0, ballY - Math.min(ballY, GOAL_BOUNDS.crossbarY)));
    const rightDist = Math.hypot(ballX - GOAL_BOUNDS.rightPostX, Math.max(0, ballY - Math.min(ballY, GOAL_BOUNDS.crossbarY)));
    const barDist = ballX >= GOAL_BOUNDS.leftPostX && ballX <= GOAL_BOUNDS.rightPostX
      ? Math.abs(ballY - GOAL_BOUNDS.crossbarY)
      : 999;

    if (leftDist <= GOAL_BOUNDS.postRadius) {
      this.state = "HIT_POST";
      this.result = "OFF THE POST!";
      this.reboundVx = 0.9 + Math.random() * 0.4;
      this.reboundVy = 0.5 + Math.random() * 0.4;
      this.reboundVz = -0.5;
      audio.playPostClang();
      return;
    }

    if (rightDist <= GOAL_BOUNDS.postRadius) {
      this.state = "HIT_POST";
      this.result = "OFF THE POST!";
      this.reboundVx = -(0.9 + Math.random() * 0.4);
      this.reboundVy = 0.5 + Math.random() * 0.4;
      this.reboundVz = -0.5;
      audio.playPostClang();
      return;
    }

    if (barDist <= GOAL_BOUNDS.postRadius) {
      this.state = "HIT_BAR";
      this.result = "OFF THE BAR!";
      this.reboundVx = (Math.random() - 0.5) * 0.6;
      this.reboundVy = 0.7;
      this.reboundVz = -0.6;
      audio.playPostClang();
      return;
    }

    // 2. Goalkeeper Save Check
    const saved = keeper.checkSave(ballX, ballY);
    if (saved) {
      this.state = "SAVED";
      this.result = "SAVED!";
      this.reboundVx = (ballX - keeper.x) * 1.5 + (Math.random() - 0.5) * 0.4;
      this.reboundVy = 0.4 + Math.random() * 0.4;
      this.reboundVz = -0.4;
      audio.playSave();
      keeper.onSaveSuccess();
      return;
    }

    // 3. Goal vs Miss Check
    const isInsideWidth = ballX > GOAL_BOUNDS.leftPostX && ballX < GOAL_BOUNDS.rightPostX;
    const isBelowBar = ballY < GOAL_BOUNDS.crossbarY;
    const isAboveGround = ballY >= 0.0;

    if (isInsideWidth && isBelowBar && isAboveGround) {
      // GOAL!
      this.state = "SCORED";
      this.result = "GOAL!";
      audio.playNet();
      audio.playGoalCheer();
      keeper.onGoalConceded();
      return;
    }

    // Otherwise Missed
    this.state = "MISSED";
    if (!isBelowBar) {
      this.result = "OVER THE BAR!";
    } else {
      this.result = "WIDE!";
    }
    this.reboundVx = (ballX > 0 ? 0.4 : -0.4);
    this.reboundVy = this.targetY * 0.3;
    this.reboundVz = 0.5;
    audio.playMissSound();
    keeper.onMissFired();
  }
}
