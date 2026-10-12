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

console.log(`=== TEST SUMMARY: ${passed} / ${total} PASSED ===`);
if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
