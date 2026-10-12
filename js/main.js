// Entry point for Beach Penalty Shootout

import { BeachPenaltyGame } from "./game.js";

function initApp() {
  const game = new BeachPenaltyGame();
  window.__penaltyGame = game; // Expose for testing and debugging

  // Register Service Worker for PWA install and instant offline play
  if ("serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("./sw.js")
      .then((reg) => {
        console.log("Service Worker registered:", reg.scope);
        reg.update();
      })
      .catch((err) => {
        console.warn("Service Worker registration skipped:", err);
      });
  }
}

// Guarantee execution whether DOM is loading, interactive, or complete
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

