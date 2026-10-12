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

4. **Mobile 6-Level Campaign & Progression System**:
   - **Progressive Difficulty**: 6 unique, handcrafted levels featuring progressive target goals, goalkeeper AI adaptations, and star ratings (⭐ to ⭐⭐⭐).
     - **Level 1: Rookie Warmup** 🏖️ — Target: 2/5 goals. Beginner goalkeeper with relaxed reflexes.
     - **Level 2: Corner Specialist** 🎯 — Target: 3/5 goals. Introduces glowing corner bullseye targets (`+500` bonus points)!
     - **Level 3: Coastal Crosswind** 💨 — Target: 3/5 goals. Active lateral wind drift (`12 km/h ➔`) requiring shot compensation.
     - **Level 4: Precision Master** ⚡ — Target: 4/5 goals. Gusty ocean winds with high-value corner rings.
     - **Level 5: Beach Championship** 🏆 — Target: 4/5 goals. Strong coastal wind gusts and elite championship goalkeeper.
     - **Level 6: Golden Boot Legend** 👑 — Target: 5/5 goals. Flawless shootout challenge with 3 bonus bullseyes.
   - **Level Select Screen**: Interactive grid showing level details, requirements, wind conditions, and unlocked state.
   - **Star Rating & Persistence**: Earn up to 3 stars per level with automatic save/load via `localStorage`.
   - **Victory & Failure Screens**: Animated star pops, stat breakdown, and **NEXT LEVEL** progression.

5. **Self-Contained Web Audio Synthesizer**:
   - Built-in Web Audio API: Punchy boot kick, ball flight whoosh, iron post clang, glove save thud, net ripple, target ring bell chime, star reveal notes, victory fanfares, and crowd cheering roar.
   - Sound toggle button (`ON` / `OFF`).

6. **Mobile-First Responsive Layout & Quick Controls**:
   - Dedicated Quick Restart button `🔄` in top HUD (or press `R`).
   - Quick Level Select button `📋` (or press `L`).
   - Dynamic containment (`Math.min` contain scaling) ensuring 100% of the game area is always visible on all mobile phones, tablets, and desktop displays with zero cropping.

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
Runs 23 deterministic tests covering:
- Goal scoring within post boundaries
- Goalkeeper glove interception and save detection
- Left post cylinder deflection (`OFF THE POST!`)
- Crossbar collision (`OFF THE BAR!`)
- Over-the-bar elevation check
- Wide trajectory check
- Complete goalkeeper state machine and dive kinematics
- Crosswind lateral drift physics
- Bullseye target ring collision detection and bonus result
- Level progression, unlocking rules, and 3-star rating evaluation

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
