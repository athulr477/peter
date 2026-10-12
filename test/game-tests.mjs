import { BallPhysics, GOAL_BOUNDS } from "../js/physics.js";
import { Goalkeeper } from "../js/goalkeeper.js";

console.log("=== RUNNING AUTOMATED GAME PHYSICS & AI TESTS ===");
let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log("✓ PASS:", message);
    passed++;
  } else {
    console.error("✗ FAIL:", message);
  }
}

const mockAudio = {
  playKick: () => {},
  playPostClang: () => {},
  playSave: () => {},
  playNet: () => {},
  playGoalCheer: () => {},
  playMissSound: () => {},
};

const mockParticles = {
  emitSandPuff: () => {},
  emitGoalSparks: () => {},
  emitPostImpact: () => {},
  triggerNetRipple: () => {},
};

// 1. Goal Scored Test
{
  const ball = new BallPhysics();
  const keeper = new Goalkeeper();
  keeper.checkSave = () => false;
  ball.shoot(0.3, 0.4, 1.0, 0.0);

  for (let i = 0; i < 20; i++) {
    ball.update(0.05, keeper, mockParticles, mockAudio);
  }
  assert(ball.result === "GOAL!", `Valid shot inside posts produces GOAL! (got: ${ball.result})`);
}

// 2. Shot Saved Test
{
  const ball = new BallPhysics();
  const keeper = new Goalkeeper();
  keeper.checkSave = () => true;
  ball.shoot(0.0, 0.3, 1.0, 0.0);

  for (let i = 0; i < 20; i++) {
    ball.update(0.05, keeper, mockParticles, mockAudio);
  }
  assert(ball.result === "SAVED!", `Shot intercepted by goalkeeper produces SAVED! (got: ${ball.result})`);
}

// 3. Off Left Post Test
{
  const ball = new BallPhysics();
  const keeper = new Goalkeeper();
  ball.shoot(GOAL_BOUNDS.leftPostX, 0.4, 1.0, 0.0);

  for (let i = 0; i < 20; i++) {
    ball.update(0.05, keeper, mockParticles, mockAudio);
  }
  assert(ball.result === "OFF THE POST!", `Shot hitting left post produces OFF THE POST! (got: ${ball.result})`);
}

// 4. Off Crossbar Test
{
  const ball = new BallPhysics();
  const keeper = new Goalkeeper();
  ball.shoot(0.0, GOAL_BOUNDS.crossbarY, 1.0, 0.0);

  for (let i = 0; i < 20; i++) {
    ball.update(0.05, keeper, mockParticles, mockAudio);
  }
  assert(ball.result === "OFF THE BAR!", `Shot hitting crossbar produces OFF THE BAR! (got: ${ball.result})`);
}

// 5. Over the Crossbar Test
{
  const ball = new BallPhysics();
  const keeper = new Goalkeeper();
  ball.shoot(0.0, 0.85, 1.0, 0.0);

  for (let i = 0; i < 20; i++) {
    ball.update(0.05, keeper, mockParticles, mockAudio);
  }
  assert(ball.result === "OVER THE BAR!", `Shot above crossbar produces OVER THE BAR! (got: ${ball.result})`);
}

// 6. Wide Shot Test
{
  const ball = new BallPhysics();
  const keeper = new Goalkeeper();
  ball.shoot(0.95, 0.4, 1.0, 0.0);

  for (let i = 0; i < 20; i++) {
    ball.update(0.05, keeper, mockParticles, mockAudio);
  }
  assert(ball.result === "WIDE!", `Shot outside right post produces WIDE! (got: ${ball.result})`);
}

// 7. Goalkeeper State Machine & Dive Kinematics Test
{
  const keeper = new Goalkeeper();
  assert(keeper.state === "idle" && keeper.currentPose === "guard", "Keeper starts in idle state with guard pose");

  keeper.onAimStart();
  assert(keeper.state === "anticipating" && keeper.currentPose === "ready", "Keeper switches to anticipating with ready pose on aim");

  keeper.onShotFired(0.5, 0.3, 1.0);
  assert(keeper.state === "reacting", "Keeper reacts after shot fired");

  for (let i = 0; i < 15; i++) keeper.update(0.05);
  assert(keeper.state.startsWith("diving"), `Keeper dives towards ball target (got: ${keeper.state})`);

  keeper.onSaveSuccess();
  assert(keeper.state === "saving", "Keeper transitions to saving state on save");

  keeper.startRecovery();
  assert(keeper.state === "recovering", "Keeper recovers after save");

  for (let i = 0; i < 40; i++) keeper.update(0.05);
  assert(keeper.state === "idle" && keeper.currentPose === "guard", "Keeper returns to idle guard pose after recovery");
}

// 8. Crosswind Drift Physics Test
{
  const ballNoWind = new BallPhysics();
  const keeper = new Goalkeeper();
  ballNoWind.shoot(0.0, 0.4, 1.0, 0.0, 0.0);
  for (let i = 0; i < 10; i++) ballNoWind.update(0.05, keeper, mockParticles, mockAudio);

  const ballWithWind = new BallPhysics();
  ballWithWind.shoot(0.0, 0.4, 1.0, 0.0, 0.5); // Rightward crosswind
  for (let i = 0; i < 10; i++) ballWithWind.update(0.05, keeper, mockParticles, mockAudio);

  assert(ballWithWind.x > ballNoWind.x, `Crosswind drifts ball rightward (x: ${ballWithWind.x.toFixed(3)} > ${ballNoWind.x.toFixed(3)})`);
}

// 9. Bullseye Target Ring Collision Test
{
  const ball = new BallPhysics();
  const keeper = new Goalkeeper();
  keeper.checkSave = () => false;

  const targetRing = { id: "tr", x: 0.52, y: 0.54, radius: 0.11, points: 500, label: "+500", hit: false };
  ball.shoot(0.52, 0.54, 1.0, 0.0, 0.0);

  for (let i = 0; i < 20; i++) {
    ball.update(0.05, keeper, mockParticles, mockAudio, [targetRing]);
  }

  assert(targetRing.hit === true, "Ball directly on target ring triggers target.hit = true");
  assert(ball.result.includes("BULLSEYE"), `Result text indicates BULLSEYE hit (got: ${ball.result})`);
}

// 10. Level Progression & Star Evaluation Test
{
  const { LevelManager, LEVELS_DATA } = await import("../js/levels.js");
  const lm = new LevelManager();

  assert(LEVELS_DATA.length === 6, `Level progression has 6 progressive levels (got: ${LEVELS_DATA.length})`);
  assert(lm.isUnlocked(1) === true, "Level 1 is unlocked initially");
  assert(lm.isUnlocked(2) === false, "Level 2 is locked initially");

  // Clear level 1 with 4 goals (3 stars)
  const evalPass = lm.evaluateResult(4, 0, 4200);
  assert(evalPass.passed === true, "4 goals on Level 1 passes target");
  assert(evalPass.stars === 3, `4 goals awards 3 stars (got: ${evalPass.stars})`);
  assert(lm.isUnlocked(2) === true, "Level 2 unlocked after clearing Level 1");

  // Test failure on level 1
  lm.setCurrentLevel(1);
  const evalFail = lm.evaluateResult(1, 0, 1000);
  assert(evalFail.passed === false, "1 goal fails Level 1 target of 2 goals");
}

console.log(`=== TEST SUMMARY: ${passed} / ${total} PASSED ===`);
if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
