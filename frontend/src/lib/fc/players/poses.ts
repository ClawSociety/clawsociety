// ─────────────────── Animation Poses ──────────────────────────────
// Frame offset data for all 5 animation states.
// Each frame specifies pixel offsets for body parts relative to base positions.
// At 24×32 native resolution, 1px offset = 3px on screen (3x scale).

// ── Types ─────────────────────────────────────────────────────────

export type Facing = 'front' | 'back' | 'right';

export interface FramePose {
  bodyDy: number;        // whole body vertical offset (bounce/jump)
  headDx: number;
  headDy: number;
  torsoDx: number;
  torsoDy: number;
  leftArmDx: number;
  leftArmDy: number;
  rightArmDx: number;
  rightArmDy: number;
  leftLegDx: number;
  leftLegDy: number;
  rightLegDx: number;
  rightLegDy: number;
  leftBootDx: number;
  leftBootDy: number;
  rightBootDx: number;
  rightBootDy: number;
}

// ── Base Positions ────────────────────────────────────────────────
// Anchor: body parts placed on 24×32 canvas, character roughly centered

export interface BasePositions {
  head: { x: number; y: number };
  torso: { x: number; y: number };
  shorts: { x: number; y: number };
  leftArm: { x: number; y: number };
  rightArm: { x: number; y: number };
  leftLeg: { x: number; y: number };
  rightLeg: { x: number; y: number };
  leftBoot: { x: number; y: number };
  rightBoot: { x: number; y: number };
}

// Front-facing base (primary view — normal build)
export const BASE_FRONT: BasePositions = {
  head:      { x: 8,  y: 2 },   // 8×7 head
  torso:     { x: 8,  y: 9 },   // 8×7 torso
  shorts:    { x: 8,  y: 16 },  // 8×3 shorts
  leftArm:   { x: 5,  y: 9 },   // 3×8 arm
  rightArm:  { x: 16, y: 9 },   // 3×8 arm
  leftLeg:   { x: 9,  y: 19 },  // 3×7 leg
  rightLeg:  { x: 13, y: 19 },  // 3×7 leg
  leftBoot:  { x: 8,  y: 25 },  // 4×3 boot
  rightBoot: { x: 12, y: 25 },  // 4×3 boot
};

// Slim build — narrower torso (6w), arms shifted inward
export const BASE_SLIM: BasePositions = {
  head:      { x: 8,  y: 2 },
  torso:     { x: 9,  y: 9 },   // 6×7 torso, shifted right 1 to center
  shorts:    { x: 9,  y: 16 },  // 6×3 shorts, same
  leftArm:   { x: 6,  y: 9 },   // arm 1px inward
  rightArm:  { x: 15, y: 9 },   // arm 1px inward
  leftLeg:   { x: 9,  y: 19 },
  rightLeg:  { x: 13, y: 19 },
  leftBoot:  { x: 8,  y: 25 },
  rightBoot: { x: 12, y: 25 },
};

// Stocky build — wider torso (10w), arms shifted outward
export const BASE_STOCKY: BasePositions = {
  head:      { x: 8,  y: 2 },
  torso:     { x: 7,  y: 9 },   // 10×7 torso, shifted left 1 to center
  shorts:    { x: 7,  y: 16 },  // 10×3 shorts, same
  leftArm:   { x: 4,  y: 9 },   // arm 1px outward
  rightArm:  { x: 17, y: 9 },   // arm 1px outward
  leftLeg:   { x: 9,  y: 19 },
  rightLeg:  { x: 13, y: 19 },
  leftBoot:  { x: 8,  y: 25 },
  rightBoot: { x: 12, y: 25 },
};

/** Get base positions for a given build type (0=slim, 1=normal, 2=stocky) */
export function getBasePositions(buildType: number): BasePositions {
  if (buildType === 0) return BASE_SLIM;
  if (buildType === 2) return BASE_STOCKY;
  return BASE_FRONT;
}

// Zero pose — no offsets (used as base for creating frame poses)
const ZERO: FramePose = {
  bodyDy: 0,
  headDx: 0, headDy: 0,
  torsoDx: 0, torsoDy: 0,
  leftArmDx: 0, leftArmDy: 0,
  rightArmDx: 0, rightArmDy: 0,
  leftLegDx: 0, leftLegDy: 0,
  rightLegDx: 0, rightLegDy: 0,
  leftBootDx: 0, leftBootDy: 0,
  rightBootDx: 0, rightBootDy: 0,
};

function pose(overrides: Partial<FramePose>): FramePose {
  return { ...ZERO, ...overrides };
}

// ── Idle (4 frames) ──────────────────────────────────────────────
// Subtle breathing: body shifts ±1px vertically

export const IDLE_FRAMES: FramePose[] = [
  pose({}),                            // neutral
  pose({ bodyDy: 1 }),                 // breathe in (body drops 1px)
  pose({}),                            // neutral
  pose({ bodyDy: -1 }),                // breathe out (body rises 1px)
];

// ── Run (6 frames) ───────────────────────────────────────────────
// Full stride cycle: two steps (R forward, then L forward)
// Legs alternate, arms counterswing, body bounces

export const RUN_FRAMES: FramePose[] = [
  // Frame 0: Right foot contact
  pose({
    bodyDy: 0,
    rightLegDy: -2, rightBootDy: -2,     // right leg forward (up)
    leftLegDy: 1, leftBootDy: 1,         // left leg back (down)
    rightArmDy: 1,                        // right arm back
    leftArmDy: -1,                        // left arm forward
  }),
  // Frame 1: Right foot passing
  pose({
    bodyDy: -1,
    rightLegDy: -1, rightBootDy: -1,
    leftLegDy: 0, leftBootDy: 0,
    rightArmDy: 0,
    leftArmDy: 0,
  }),
  // Frame 2: Right foot flight
  pose({
    bodyDy: -2,
    rightLegDy: 1, rightBootDy: 1,       // right leg now behind
    leftLegDy: -1, leftBootDy: -1,       // left leg coming forward
    rightArmDy: -1,
    leftArmDy: 1,
  }),
  // Frame 3: Left foot contact
  pose({
    bodyDy: 0,
    leftLegDy: -2, leftBootDy: -2,       // left leg forward
    rightLegDy: 1, rightBootDy: 1,       // right leg back
    leftArmDy: 1,
    rightArmDy: -1,
  }),
  // Frame 4: Left foot passing
  pose({
    bodyDy: -1,
    leftLegDy: -1, leftBootDy: -1,
    rightLegDy: 0, rightBootDy: 0,
    leftArmDy: 0,
    rightArmDy: 0,
  }),
  // Frame 5: Left foot flight
  pose({
    bodyDy: -2,
    leftLegDy: 1, leftBootDy: 1,         // left leg behind
    rightLegDy: -1, rightBootDy: -1,     // right leg forward
    leftArmDy: -1,
    rightArmDy: 1,
  }),
];

// ── Kick (4 frames) ─────────────────────────────────────────────
// Wind-up → plant → strike → follow-through

export const KICK_FRAMES: FramePose[] = [
  // Frame 0: Wind-up — kick leg pulls back
  pose({
    bodyDy: 0,
    rightLegDy: 2, rightBootDy: 2,       // right leg back/down
    leftLegDy: 0, leftBootDy: 0,         // support leg planted
    rightArmDy: -1,                       // arm counterbalance
    leftArmDy: 1,
    torsoDy: 1,                           // lean back slightly
  }),
  // Frame 1: Plant — body squares up
  pose({
    bodyDy: -1,
    rightLegDy: 1, rightBootDy: 1,       // leg still back
    leftLegDy: 1, leftBootDy: 1,         // support leg bends
    rightArmDy: -1,
    leftArmDy: 0,
  }),
  // Frame 2: Strike — kick leg swings forward
  pose({
    bodyDy: -1,
    rightLegDy: -3, rightBootDy: -3,     // leg extends forward (up)
    leftLegDy: 1, leftBootDy: 1,         // support leg bent
    rightArmDy: 1,                        // arm follows through
    leftArmDy: -1,                        // counterbalance
    torsoDy: -1,                          // lean into kick
  }),
  // Frame 3: Follow-through
  pose({
    bodyDy: 0,
    rightLegDy: -2, rightBootDy: -2,     // leg still up
    leftLegDy: 0, leftBootDy: 0,
    rightArmDy: 0,
    leftArmDy: 0,
  }),
];

// ── Dive (4 frames) ─────────────────────────────────────────────
// GK dive: crouch → launch → full extension → landing

export const DIVE_FRAMES: FramePose[] = [
  // Frame 0: Crouch
  pose({
    bodyDy: 2,                            // body drops
    leftArmDy: 1, rightArmDy: 1,         // arms ready
    leftLegDy: 1, leftBootDy: 1,         // legs bend
    rightLegDy: 1, rightBootDy: 1,
  }),
  // Frame 1: Launch
  pose({
    bodyDy: 0,
    leftArmDy: -1, rightArmDy: -1,       // arms extending up
    leftArmDx: -1, rightArmDx: 1,        // arms spread (clamped to ±1)
    leftLegDy: 1, leftBootDy: 1,
    rightLegDy: 1, rightBootDy: 1,
    headDy: -1,
  }),
  // Frame 2: Full extension
  pose({
    bodyDy: -1,
    leftArmDy: -2, rightArmDy: -2,       // arms stretched
    leftArmDx: -1, rightArmDx: 1,        // spread (clamped)
    leftLegDy: 1, leftBootDy: 2,
    rightLegDy: 1, rightBootDy: 2,
    headDy: -1,
    torsoDy: -1,
  }),
  // Frame 3: Landing
  pose({
    bodyDy: 3,                            // body on ground
    leftArmDy: 0, rightArmDy: 0,
    leftLegDy: 1, leftBootDy: 1,
    rightLegDy: 1, rightBootDy: 1,
  }),
];

// ── Celebrate (4 frames) ────────────────────────────────────────
// Arms raising → jump → fist pump → return

export const CELEBRATE_FRAMES: FramePose[] = [
  // Frame 0: Starting to raise arms
  pose({
    leftArmDy: -1, rightArmDy: -1,
  }),
  // Frame 1: Jump — body rises, arms high
  pose({
    bodyDy: -3,
    leftArmDy: -2, rightArmDy: -2,
    leftArmDx: -1, rightArmDx: 1,        // arms spread (clamped to ±1)
    leftLegDy: 1, leftBootDy: 1,         // legs dangle
    rightLegDy: 1, rightBootDy: 1,
  }),
  // Frame 2: Fist pump — arms highest, peak of jump
  pose({
    bodyDy: -4,
    leftArmDy: -2, rightArmDy: -2,
    leftArmDx: -1, rightArmDx: 1,
    leftLegDy: 1, leftBootDy: 1,
    rightLegDy: 1, rightBootDy: 1,
    headDy: -1,
  }),
  // Frame 3: Landing
  pose({
    bodyDy: -1,
    leftArmDy: -2, rightArmDy: -2,
    leftLegDy: 0, leftBootDy: 0,
    rightLegDy: 0, rightBootDy: 0,
  }),
];

// ── Frame Lookup ─────────────────────────────────────────────────

import type { PlayerState } from '../types';

const STATE_FRAMES: Record<PlayerState, FramePose[]> = {
  idle: IDLE_FRAMES,
  running: RUN_FRAMES,
  kicking: KICK_FRAMES,
  diving: DIVE_FRAMES,
  celebrating: CELEBRATE_FRAMES,
};

/** Get the frame array for a given animation state */
export function getFrames(state: PlayerState): FramePose[] {
  return STATE_FRAMES[state];
}

/** Get a specific frame by state and normalized tick (0..1) */
export function getFrame(state: PlayerState, animTick: number): FramePose {
  const frames = STATE_FRAMES[state];
  const idx = Math.min(
    Math.floor(animTick * frames.length),
    frames.length - 1,
  );
  return frames[idx];
}
