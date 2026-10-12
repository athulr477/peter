// Beach Penalty Shootout — Level Progression & Configuration Engine
// Provides multi-level campaign, progressive difficulty, wind, targets, and persistence

export const LEVELS_DATA = [
  {
    id: 1,
    name: "Rookie Warmup",
    subtitle: "Find your shooting rhythm. Aim for the open corners!",
    targetGoals: 2,
    maxAttempts: 5,
    wind: 0,
    windLabel: "CALM",
    keeperConfig: {
      diveSpeed: 1.7,
      reactionDelay: 0.26,
      reachRadius: 0.15,
      wrongGuessChance: 0.45,
    },
    targets: [],
    starThresholds: [2, 3, 4],
    icon: "🏖️",
  },
  {
    id: 2,
    name: "Corner Specialist",
    subtitle: "Hit corner targets for big bonus points!",
    targetGoals: 3,
    maxAttempts: 5,
    wind: 0,
    windLabel: "CALM",
    keeperConfig: {
      diveSpeed: 1.9,
      reactionDelay: 0.23,
      reachRadius: 0.16,
      wrongGuessChance: 0.38,
    },
    targets: [
      { id: "tl", x: -0.52, y: 0.54, radius: 0.11, points: 500, label: "+500", hit: false },
      { id: "tr", x: 0.52, y: 0.54, radius: 0.11, points: 500, label: "+500", hit: false },
    ],
    starThresholds: [3, 4, 5],
    icon: "🎯",
  },
  {
    id: 3,
    name: "Coastal Crosswind",
    subtitle: "Ocean breeze is blowing! Compensate for lateral drift.",
    targetGoals: 3,
    maxAttempts: 5,
    wind: 0.42,
    windLabel: "12 km/h ➔",
    windSpeedKmh: 12,
    windDirection: "RIGHT",
    keeperConfig: {
      diveSpeed: 2.0,
      reactionDelay: 0.22,
      reachRadius: 0.17,
      wrongGuessChance: 0.32,
    },
    targets: [],
    starThresholds: [3, 4, 5],
    icon: "💨",
  },
  {
    id: 4,
    name: "Precision Master",
    subtitle: "Variable ocean breeze & precision corner rings!",
    targetGoals: 4,
    maxAttempts: 5,
    wind: -0.38,
    windLabel: "⬅ 10 km/h",
    windSpeedKmh: 10,
    windDirection: "LEFT",
    keeperConfig: {
      diveSpeed: 2.1,
      reactionDelay: 0.20,
      reachRadius: 0.17,
      wrongGuessChance: 0.30,
    },
    targets: [
      { id: "bl", x: -0.54, y: 0.14, radius: 0.10, points: 600, label: "+600", hit: false },
      { id: "tr", x: 0.54, y: 0.56, radius: 0.10, points: 800, label: "+800", hit: false },
    ],
    starThresholds: [4, 4, 5],
    icon: "⚡",
  },
  {
    id: 5,
    name: "Beach Championship",
    subtitle: "Grand Coastal Final! The championship goalie won't go down easy.",
    targetGoals: 4,
    maxAttempts: 5,
    wind: 0.60,
    windLabel: "16 km/h ➔",
    windSpeedKmh: 16,
    windDirection: "RIGHT",
    keeperConfig: {
      diveSpeed: 2.2,
      reactionDelay: 0.18,
      reachRadius: 0.18,
      wrongGuessChance: 0.25,
    },
    targets: [
      { id: "tl", x: -0.55, y: 0.55, radius: 0.10, points: 1000, label: "+1000", hit: false },
      { id: "tr", x: 0.55, y: 0.55, radius: 0.10, points: 1000, label: "+1000", hit: false },
    ],
    starThresholds: [4, 5, 5],
    icon: "🏆",
  },
  {
    id: 6,
    name: "Golden Boot Legend",
    subtitle: "The ultimate shootout! Flawless 5/5 needed for legendary status.",
    targetGoals: 5,
    maxAttempts: 5,
    wind: -0.50,
    windLabel: "⬅ 14 km/h",
    windSpeedKmh: 14,
    windDirection: "LEFT",
    keeperConfig: {
      diveSpeed: 2.3,
      reactionDelay: 0.17,
      reachRadius: 0.18,
      wrongGuessChance: 0.22,
    },
    targets: [
      { id: "topCenter", x: 0.0, y: 0.58, radius: 0.10, points: 1500, label: "+1500", hit: false },
      { id: "tl", x: -0.56, y: 0.54, radius: 0.09, points: 1200, label: "+1200", hit: false },
      { id: "tr", x: 0.56, y: 0.54, radius: 0.09, points: 1200, label: "+1200", hit: false },
    ],
    starThresholds: [4, 5, 5],
    icon: "👑",
  },
];

const STORAGE_KEY = "beach_penalty_level_progress_v1";

export class LevelManager {
  constructor() {
    this.currentLevelId = 1;
    this.progress = this.loadProgress();
    this.activeLevel = this.instantiateLevel(this.currentLevelId);
  }

  loadProgress() {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            highestUnlocked: parsed.highestUnlocked || 1,
            stars: parsed.stars || {},
            highScores: parsed.highScores || {},
          };
        }
      }
    } catch (e) {
      // Ignored for non-browser environments
    }
    return {
      highestUnlocked: 1,
      stars: {},
      highScores: {},
    };
  }

  saveProgress() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
      }
    } catch (e) {
      // Ignored for non-browser environments
    }
  }

  instantiateLevel(levelId) {
    const raw = LEVELS_DATA.find((l) => l.id === levelId) || LEVELS_DATA[0];
    return {
      ...raw,
      targets: raw.targets.map((t) => ({ ...t, hit: false })),
    };
  }

  getAllLevels() {
    return LEVELS_DATA.map((lvl) => ({
      ...lvl,
      isUnlocked: lvl.id <= this.progress.highestUnlocked,
      starsEarned: this.progress.stars[lvl.id] || 0,
      highScore: this.progress.highScores[lvl.id] || 0,
    }));
  }

  getCurrentLevel() {
    return this.activeLevel;
  }

  setCurrentLevel(levelId) {
    if (levelId > this.progress.highestUnlocked) {
      console.warn(`Level ${levelId} is locked.`);
      return false;
    }
    this.currentLevelId = levelId;
    this.activeLevel = this.instantiateLevel(levelId);
    return true;
  }

  resetCurrentLevel() {
    this.activeLevel = this.instantiateLevel(this.currentLevelId);
    return this.activeLevel;
  }

  getNextLevelId() {
    const nextId = this.currentLevelId + 1;
    if (LEVELS_DATA.some((l) => l.id === nextId)) {
      return nextId;
    }
    return null;
  }

  isUnlocked(levelId) {
    return levelId <= this.progress.highestUnlocked;
  }

  getStarsEarned(levelId) {
    return this.progress.stars[levelId] || 0;
  }

  getTotalStars() {
    return Object.values(this.progress.stars).reduce((sum, s) => sum + s, 0);
  }

  evaluateResult(goalsScored, targetsHitCount, totalPoints) {
    const lvl = this.activeLevel;
    const passed = goalsScored >= lvl.targetGoals;

    let stars = 0;
    if (passed) {
      if (goalsScored >= lvl.starThresholds[2] || (lvl.targets.length > 0 && targetsHitCount >= lvl.targets.length)) {
        stars = 3;
      } else if (goalsScored >= lvl.starThresholds[1] || targetsHitCount > 0) {
        stars = 2;
      } else {
        stars = 1;
      }
    }

    let isNewUnlock = false;
    if (passed) {
      const nextId = this.currentLevelId + 1;
      if (nextId > this.progress.highestUnlocked && LEVELS_DATA.some((l) => l.id === nextId)) {
        this.progress.highestUnlocked = nextId;
        isNewUnlock = true;
      }

      const prevStars = this.progress.stars[this.currentLevelId] || 0;
      if (stars > prevStars) {
        this.progress.stars[this.currentLevelId] = stars;
      }

      const prevScore = this.progress.highScores[this.currentLevelId] || 0;
      if (totalPoints > prevScore) {
        this.progress.highScores[this.currentLevelId] = totalPoints;
      }

      this.saveProgress();
    }

    return {
      passed,
      stars,
      goalsScored,
      targetGoals: lvl.targetGoals,
      maxAttempts: lvl.maxAttempts,
      targetsHitCount,
      totalPoints,
      isNewUnlock,
      hasNextLevel: this.getNextLevelId() !== null,
      levelId: this.currentLevelId,
      levelName: lvl.name,
    };
  }
}
