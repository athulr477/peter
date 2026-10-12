// Pointer Events Input Controller for Beach Penalty Shootout
// Fully supports Desktop Mouse and Mobile Touchscreen (all browsers)
// Optimized for small screens, low-end devices, and touch latency

export class InputController {
  constructor(canvas, renderer) {
    this.canvas = canvas;
    this.renderer = renderer;

    this.isDragging = false;
    this.startScreenX = 0;
    this.startScreenY = 0;
    this.currentScreenX = 0;
    this.currentScreenY = 0;
    this.startTime = 0;
    this.activePointerId = null; // Track a single pointer to prevent multi-touch issues

    this.onAimStartCallback = null;
    this.onAimMoveCallback = null;
    this.onAimCancelCallback = null;
    this.onShootCallback = null;

    this.enabled = true;

    // Cache screen dimensions to avoid layout thrashing during drag
    this._cachedRect = null;
    this._cachedScreenW = 0;

    this.bindEvents();
  }

  _getRect() {
    // Cache bounding rect; invalidated on resize
    if (!this._cachedRect) {
      this._cachedRect = this.canvas.getBoundingClientRect();
      this._cachedScreenW = window.innerWidth;
    }
    return this._cachedRect;
  }

  _invalidateRect() {
    this._cachedRect = null;
  }

  bindEvents() {
    // Use touch events on mobile for lower latency, pointer events as fallback
    const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (supportsTouch) {
      this.canvas.addEventListener("touchstart", this._handleTouchStart.bind(this), { passive: false });
      window.addEventListener("touchmove", this._handleTouchMove.bind(this), { passive: false });
      window.addEventListener("touchend", this._handleTouchEnd.bind(this), { passive: false });
      window.addEventListener("touchcancel", this._handleTouchCancel.bind(this), { passive: false });
    }

    // Always bind pointer events too (for desktop + stylus + hybrid devices)
    this.canvas.addEventListener("pointerdown", this.handlePointerDown.bind(this), { passive: false });
    window.addEventListener("pointermove", this.handlePointerMove.bind(this), { passive: false });
    window.addEventListener("pointerup", this.handlePointerUp.bind(this), { passive: false });
    window.addEventListener("pointercancel", this.handlePointerCancel.bind(this), { passive: false });

    // Invalidate cached rect on resize / orientation change
    window.addEventListener("resize", () => this._invalidateRect());
    window.addEventListener("orientationchange", () => {
      // Orientation change needs a small delay for layout to settle
      setTimeout(() => this._invalidateRect(), 200);
    });

    // Prevent context menu on long-press (mobile browsers)
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  setEnabled(val) {
    this.enabled = val;
    if (!val) {
      this.isDragging = false;
      this.activePointerId = null;
    }
  }

  // -------------------------------------------------------
  // Touch Events (lower latency on mobile)
  // -------------------------------------------------------
  _handleTouchStart(e) {
    if (!this.enabled) return;
    // Only track first touch, ignore multi-touch
    if (this.isDragging) return;
    e.preventDefault();

    const touch = e.changedTouches[0];
    this.activePointerId = touch.identifier;

    const rect = this._getRect();
    const screenX = touch.clientX - rect.left;
    const screenY = touch.clientY - rect.top;

    this._startAim(screenX, screenY);
  }

  _handleTouchMove(e) {
    if (!this.isDragging || !this.enabled) return;
    e.preventDefault();

    const touch = this._findActiveTouch(e.changedTouches);
    if (!touch) return;

    const rect = this._getRect();
    this.currentScreenX = touch.clientX - rect.left;
    this.currentScreenY = touch.clientY - rect.top;

    const dx = this.currentScreenX - this.startScreenX;
    const normalizedLean = Math.max(-1, Math.min(1, dx / this._getSwipeSensitivity()));

    if (this.onAimMoveCallback) {
      this.onAimMoveCallback(normalizedLean);
    }
  }

  _handleTouchEnd(e) {
    if (!this.isDragging) return;

    const touch = this._findActiveTouch(e.changedTouches);
    if (!touch) return;

    const rect = this._getRect();
    const endScreenX = touch.clientX - rect.left;
    const endScreenY = touch.clientY - rect.top;

    this._finishSwipe(endScreenX, endScreenY);
  }

  _handleTouchCancel(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.activePointerId = null;
      if (this.onAimCancelCallback) {
        this.onAimCancelCallback();
      }
    }
  }

  _findActiveTouch(touchList) {
    for (let i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === this.activePointerId) {
        return touchList[i];
      }
    }
    return null;
  }

  // -------------------------------------------------------
  // Pointer Events (desktop + fallback)
  // -------------------------------------------------------
  handlePointerDown(e) {
    if (!this.enabled) return;
    // Skip if already tracking a touch (avoid double-firing on hybrid devices)
    if (this.isDragging) return;
    // Only primary button
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();

    this.activePointerId = e.pointerId;

    const rect = this._getRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    this._startAim(screenX, screenY);
  }

  handlePointerMove(e) {
    if (!this.isDragging || !this.enabled) return;
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();

    const rect = this._getRect();
    this.currentScreenX = e.clientX - rect.left;
    this.currentScreenY = e.clientY - rect.top;

    const dx = this.currentScreenX - this.startScreenX;
    const normalizedLean = Math.max(-1, Math.min(1, dx / this._getSwipeSensitivity()));

    if (this.onAimMoveCallback) {
      this.onAimMoveCallback(normalizedLean);
    }
  }

  handlePointerUp(e) {
    if (!this.isDragging) return;
    if (e.pointerId !== this.activePointerId) return;

    const rect = this._getRect();
    const endScreenX = e.clientX - rect.left;
    const endScreenY = e.clientY - rect.top;

    this._finishSwipe(endScreenX, endScreenY);
  }

  handlePointerCancel() {
    if (this.isDragging) {
      this.isDragging = false;
      this.activePointerId = null;
      if (this.onAimCancelCallback) {
        this.onAimCancelCallback();
      }
    }
  }

  // -------------------------------------------------------
  // Shared Logic
  // -------------------------------------------------------
  _startAim(screenX, screenY) {
    const ref = this.renderer.screenToRef(screenX, screenY);

    // Ball center in ref coords is ~ (632, 750)
    const distToBall = Math.hypot(ref.x - 632, ref.y - 750);
    const touchZoneRadius = this._getScaledTouchZone();

    // Allow swipe start from ball area, below goal line, or lower portion of screen
    const isLowerScreen = screenY > (window.innerHeight * 0.40);

    if (distToBall < touchZoneRadius || ref.y > 520 || isLowerScreen) {
      this.isDragging = true;
      this.startScreenX = screenX;
      this.startScreenY = screenY;
      this.currentScreenX = screenX;
      this.currentScreenY = screenY;
      this.startTime = performance.now();

      if (this.onAimStartCallback) {
        this.onAimStartCallback();
      }
    }
  }

  _finishSwipe(endScreenX, endScreenY) {
    this.isDragging = false;
    this.activePointerId = null;

    const dx = endScreenX - this.startScreenX;
    const dy = endScreenY - this.startScreenY;
    const swipeDist = Math.hypot(dx, dy);
    const duration = Math.max(20, performance.now() - this.startTime);

    // Scale minimum swipe threshold for screen size
    const minSwipe = this._getMinSwipeThreshold();

    // Minimum swipe threshold: prevent accidental taps or downward-only swipes
    if (swipeDist < minSwipe || dy > -10) {
      if (this.onAimCancelCallback) {
        this.onAimCancelCallback();
      }
      return;
    }

    // Convert swipe vector to target in world coordinates
    // Use rendered game dimensions on screen for perfectly consistent aiming across all devices
    const gameW = (this.renderer.refWidth * this.renderer.scale) / this.renderer.dpr;
    const gameH = (this.renderer.refHeight * this.renderer.scale) / this.renderer.dpr;

    // Shot target X: 0 is center, -0.74 is left post, +0.74 is right post
    const lateralFraction = dx / Math.max(80, gameW * 0.28);
    const targetWorldX = Math.max(-0.85, Math.min(0.85, lateralFraction * 0.65));

    // Shot target Y: 0 is ground, 0.71 is crossbar
    const verticalFraction = (-dy) / Math.max(80, gameH * 0.40);
    const targetWorldY = Math.max(0.08, Math.min(0.82, verticalFraction * 0.55));

    // Shot power and speed based on swipe velocity
    const speedPxPerSec = (swipeDist / duration) * 1000;
    const power = Math.max(0.75, Math.min(1.35, speedPxPerSec / this._getPowerDivisor()));

    // Lateral spin curve based on horizontal swipe flick
    const curve = Math.max(-0.35, Math.min(0.35, (dx / Math.max(60, gameW * 0.35)) * 0.30));

    if (this.onShootCallback) {
      this.onShootCallback(targetWorldX, targetWorldY, power, curve);
    }
  }

  // -------------------------------------------------------
  // Screen-size-aware thresholds
  // -------------------------------------------------------
  _getScaledTouchZone() {
    // Larger touch zone on smaller screens
    const w = this._cachedScreenW || window.innerWidth;
    if (w <= 360) return 250;
    if (w <= 480) return 220;
    return 180;
  }

  _getMinSwipeThreshold() {
    // Shorter swipe distance required on small screens
    const w = this._cachedScreenW || window.innerWidth;
    if (w <= 360) return 20;
    if (w <= 480) return 25;
    return 35;
  }

  _getSwipeSensitivity() {
    // Sensitivity divisor for lean detection (lower = more sensitive)
    const w = this._cachedScreenW || window.innerWidth;
    if (w <= 360) return 70;
    if (w <= 480) return 90;
    return 120;
  }

  _getPowerDivisor() {
    // On small screens, swipes are shorter so need lower divisor for same power
    const w = this._cachedScreenW || window.innerWidth;
    if (w <= 360) return 300;
    if (w <= 480) return 380;
    return 500;
  }
}
