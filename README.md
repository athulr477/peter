# Beach Penalty Shootout ⚽🏖️

A realistic, responsive football penalty shootout game built with **HTML5 Canvas 2D, CSS, and Vanilla JavaScript**.

Inspired by beach soccer penalty challenges, players aim and swipe to shoot a classic worn soccer ball past an animated goalkeeper into a weathered coastal goal frame.

---

## 🌟 Key Features

1. **Supplied High-Definition Character & Ball Integration**:
   - **Goalkeeper Guard Stance**: Isolated transparent cutout preserving black hair, beard, shirt, rolled-up denim shorts, gloves, and bare feet.
   - **Goalkeeper Ready Pose**: Alternate action pose used for anticipation, dives, jumps, and dynamic reactions.
   - **Worn Classic Soccer Ball**: Centered in the foreground, scaling with depth, rotating with shot velocity, and casting an authentic soft ground shadow.
   - **Coastal Beach & Goal Environment**: Authentic weathered rusty iron goal posts, detailed net mesh, wet beach sand ripples, and coastal palm trees matching the visual reference.

2. **Real Swipe-to-Shoot Pointer Controls**:
   - Works across **desktop mouse** and **mobile touchscreens** via Pointer Events (`pointerdown`, `pointermove`, `pointerup`).
   - Drag to aim with dynamic trajectory arc, glowing aim indicator, and target reticle.
   - Swipe distance, speed, and lateral curvature control elevation, power, and Magnus curve effect.
   - Threshold filtering prevents accidental taps or backwards swipes.

3. **Goalkeeper AI & Collision Detection**:
   - Multiple states: `idle`, `anticipating`, `reacting`, `diving-left`, `diving-right`, `jumping`, `saving`, `celebrating`, `recovering`.
   - Fair and balanced: top corners and misdirected dives reward skillful player shots, while center or predictable shots get saved.
   - Cylinder-intersection collision for posts and crossbars (`OFF THE POST!`, `OFF THE BAR!`).

4. **Tournament 5-Round Shootout System**:
   - Real-time HUD: Score counter, Round indicator (`1/5` to `5/5`), and 5 attempt dots (⚽ for goal, ❌ for save/miss, glowing dot for current).
   - Dynamic popup banners: `GOAL!`, `SAVED!`, `OFF THE POST!`, `WIDE!`, `OVER THE BAR!`.
   - Post-match Round Summary modal with accuracy stats, trophy rating, and **PLAY AGAIN** restart.

5. **Self-Contained Web Audio Synthesizer**:
   - Built-in Web Audio API: Punchy boot kick, ball flight whoosh, iron post clang, glove save thud, net ripple, referee whistles, and crowd cheering roar.
   - Sound toggle button (`ON` / `OFF`).

6. **Pause Menu & Responsive High-DPI Canvas**:
   - Pause button in upper right corner with `RESUME`, `RESTART ROUND`, and `SOUND` controls.
   - Responsive aspect ratio scaling supporting desktop monitors, tablets, and mobile screens in both portrait and landscape.

---

## 🚀 How to Run Locally

### 1. Start the Local Server
Run with Python:
```bash
python -m http.server 5173
```
Or run with Node / npx:
```bash
npx --yes serve -l 5173
```

### 2. Open in Browser
Open your browser and navigate to:
```
http://localhost:5173/
```

---

## 🧪 Automated Testing

Run the included automated physics and AI test suite:
```bash
node test/game-tests.mjs
```
Runs 13 deterministic tests covering:
- Goal scoring within post boundaries
- Goalkeeper glove interception and save detection
- Left post cylinder deflection (`OFF THE POST!`)
- Crossbar collision (`OFF THE BAR!`)
- Over-the-bar elevation check
- Wide trajectory check
- Complete goalkeeper state machine and dive kinematics

---

## 📁 Project Structure

```text
e:/peter/
├── index.html                   # Semantic markup, HUD, modals, tutorial
├── package.json                 # Project scripts and metadata
├── README.md                    # Documentation
├── css/
│   └── style.css                # Modern athletic styling, glassmorphism, animations
├── js/
│   ├── main.js                  # Entry point initialization
│   ├── game.js                  # Game loop, state machine, rounds, HUD
│   ├── physics.js               # Ball flight, 3D perspective, post collisions
│   ├── goalkeeper.js            # Goalkeeper AI, pose transitions, reach check
│   ├── renderer.js              # 2D Canvas renderer, high-DPI scaling, shadows
│   ├── input.js                 # Pointer Events swipe controller
│   ├── audio.js                 # Web Audio API sound synthesizer
│   └── particles.js             # Sand puffs, net ripples, celebratory sparks
├── test/
│   └── game-tests.mjs           # Automated test suite
└── assets/
    ├── beach-goal-bg.jpg        # Coastal goal scene background
    ├── goalkeeper-guard-cutout.png # Guard stance transparent cutout
    ├── goalkeeper-ready-cutout.png # Ready stance transparent cutout
    ├── soccer-ball.png          # Classic worn soccer ball cutout
    ├── beach-reference.png      # Original visual reference
    ├── goalkeeper-guard.png     # Original guard photo
    └── goalkeeper-ready.png     # Original ready photo
```
