// ─────────────────── CameraSystem ────────────────────────────
// Spring-damper camera that loosely follows the ball.
// Outputs: offsetX, offsetY, zoom for gameContainer transform.

import type { Vec2 } from '../types';

// Spring constants — snappier for visible camera movement
const SPRING_K = 0.0015;       // spring stiffness per ms (was 0.0008)
const SPRING_DAMPING = 0.70;   // velocity damping per frame (was 0.82 — more responsive)
const ZOOM_SPRING_K = 0.0020;
const ZOOM_DAMPING = 0.80;

export interface CameraFrame {
  offsetX: number; // pixel offset from center
  offsetY: number;
  zoom: number;
}

export class CameraSystem {
  private cx = 0;           // current camera offset (normalized)
  private cy = 0;
  private vx = 0;           // velocity
  private vy = 0;
  private zoom = 1;
  private zoomVel = 0;

  // External overrides from CinematicDirector
  private overrideTarget: Vec2 | null = null;
  private overrideZoom = 1;

  reset() {
    this.cx = 0;
    this.cy = 0;
    this.vx = 0;
    this.vy = 0;
    this.zoom = 1;
    this.zoomVel = 0;
    this.overrideTarget = null;
    this.overrideZoom = 1;
  }

  /** CinematicDirector can set a focus point and zoom */
  setOverride(target: Vec2 | null, zoom: number) {
    this.overrideTarget = target;
    this.overrideZoom = zoom;
  }

  /**
   * Update camera to follow ball (or override target).
   * @param ballPos - normalized ball position
   * @param screenW - screen width in pixels
   * @param screenH - screen height in pixels
   * @param deltaMs - frame delta
   */
  update(ballPos: Vec2, screenW: number, screenH: number, deltaMs: number): CameraFrame {
    const dt = Math.min(deltaMs, 32);

    // Target position (normalized, centered at 0.5)
    const target = this.overrideTarget ?? ballPos;
    const targetX = (target.x - 0.5) * 0.0; // no pan — camera stays centered
    const targetY = (target.y - 0.5) * 0.0; // only zoom on special events

    // Spring physics for position
    const forceX = (targetX - this.cx) * SPRING_K * dt;
    const forceY = (targetY - this.cy) * SPRING_K * dt;
    this.vx = (this.vx + forceX) * SPRING_DAMPING;
    this.vy = (this.vy + forceY) * SPRING_DAMPING;
    this.cx += this.vx * dt;
    this.cy += this.vy * dt;

    // Spring physics for zoom
    const targetZoom = this.overrideZoom;
    const zoomForce = (targetZoom - this.zoom) * ZOOM_SPRING_K * dt;
    this.zoomVel = (this.zoomVel + zoomForce) * ZOOM_DAMPING;
    this.zoom += this.zoomVel * dt;
    this.zoom = Math.max(0.8, Math.min(1.6, this.zoom)); // clamp

    return {
      offsetX: this.cx * screenW,
      offsetY: this.cy * screenH,
      zoom: this.zoom,
    };
  }
}
