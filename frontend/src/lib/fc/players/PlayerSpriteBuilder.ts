// ─────────────────── PlayerSpriteBuilder ──────────────────────────
// Pixel drawing engine: stamps material-coded body part templates
// onto an OffscreenCanvas, applies auto-outline + shading.
// Produces crisp pixel art at 24×32 native resolution.

import type { PlayerAppearance } from './PlayerFactory';
import type { BodyPartTemplate } from './templates';
import type { FramePose } from './poses';
import {
  HEAD_FRONT,
  TORSO_FRONT, TORSO_SLIM, TORSO_STOCKY,
  SHORTS, SHORTS_SLIM, SHORTS_STOCKY,
  ARM, ARM_LONG,
  LEG,
  BOOT,
  HAIR_VARIANTS,
  HAIR_OFFSETS_X,
  HAIR_OFFSETS_Y,
  FACE_VARIANTS,
  DIGIT_FONT,
  MAT,
  ACCESSORY_HEADBAND,
  ACCESSORY_CAPTAIN,
  ACCESSORY_WRISTBAND,
} from './templates';
import { getBasePositions } from './poses';

// ── Constants ─────────────────────────────────────────────────────

export const SPRITE_W = 24;
export const SPRITE_H = 32;
const OUTLINE_COLOR = 0x111111;

// ── Material Map ──────────────────────────────────────────────────

/** Build a color lookup table from material codes → hex colors */
export function buildMaterialMap(app: PlayerAppearance): number[] {
  const map = new Array(16).fill(0);
  map[MAT._]  = 0;                              // transparent
  map[MAT.S]  = app.skinTone;
  map[MAT.Sd] = adjust(app.skinTone, 0.7);      // skin shadow
  map[MAT.Sh] = adjust(app.skinTone, 1.3);      // skin highlight
  map[MAT.J]  = app.jerseyColor;
  map[MAT.Jd] = adjust(app.jerseyColor, 0.65);  // jersey shadow
  map[MAT.Jh] = adjust(app.jerseyColor, 1.35);  // jersey highlight
  map[MAT.P]  = app.shortsColor;
  map[MAT.Pd] = adjust(app.shortsColor, 0.7);
  map[MAT.H]  = app.hairColor;
  map[MAT.Hd] = adjust(app.hairColor, 0.6);
  map[MAT.B]  = app.bootsColor;
  map[MAT.O]  = OUTLINE_COLOR;
  map[MAT.G]  = app.isGK ? 0xffd700 : app.skinTone; // gold gloves for GK
  map[MAT.K]  = app.socksColor;
  map[MAT.N]  = 0xffffff;                       // jersey number
  return map;
}

function adjust(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

// ── Frame Baking ──────────────────────────────────────────────────

/**
 * Bake a single animation frame to an OffscreenCanvas.
 * Returns a 24×32 canvas with the character drawn in pixel art.
 */
export type CanvasFactory = (w: number, h: number) => OffscreenCanvas;

const defaultCanvasFactory: CanvasFactory = (w, h) => new OffscreenCanvas(w, h);

export function bakeFrame(
  app: PlayerAppearance,
  framePose: FramePose,
  materialMap: number[],
  canvasFactory: CanvasFactory = defaultCanvasFactory,
) {
  const canvas = canvasFactory(SPRITE_W, SPRITE_H);
  const ctx = canvas.getContext('2d')!;

  // Work with raw pixel data for precise pixel placement
  const imageData = ctx.createImageData(SPRITE_W, SPRITE_H);
  const pixels = imageData.data; // Uint8ClampedArray, RGBA

  // Select base positions by build type
  const base = getBasePositions(app.buildType);
  const dy = framePose.bodyDy;

  // Height ratio offset: tall players shift legs down, short shift up
  const heightDy = app.heightRatio > 1.0 ? 1 : app.heightRatio < 0.95 ? -1 : 0;

  // Select torso/shorts template by build type
  const torsoTemplate = app.buildType === 0 ? TORSO_SLIM
    : app.buildType === 2 ? TORSO_STOCKY
    : TORSO_FRONT;
  const shortsTemplate = app.buildType === 0 ? SHORTS_SLIM
    : app.buildType === 2 ? SHORTS_STOCKY
    : SHORTS;

  // Determine arm template based on sleeve style / GK
  const armTemplate = (app.isGK || app.sleeveStyle === 1) ? ARM_LONG : ARM;

  // Draw order (back to front):
  // 1. Legs + boots
  // 2. Torso + shorts
  // 3. Arms
  // 4. Head + hair
  // This ensures head overlaps torso top, arms overlap torso sides

  // -- Legs (offset by heightDy) --
  stampPart(pixels, LEG, materialMap,
    base.leftLeg.x + framePose.leftLegDx,
    base.leftLeg.y + framePose.leftLegDy + dy + heightDy);
  stampPart(pixels, LEG, materialMap,
    base.rightLeg.x + framePose.rightLegDx,
    base.rightLeg.y + framePose.rightLegDy + dy + heightDy);

  // -- Boots (offset by heightDy) --
  stampPart(pixels, BOOT, materialMap,
    base.leftBoot.x + framePose.leftBootDx,
    base.leftBoot.y + framePose.leftBootDy + dy + heightDy);
  stampPart(pixels, BOOT, materialMap,
    base.rightBoot.x + framePose.rightBootDx,
    base.rightBoot.y + framePose.rightBootDy + dy + heightDy);

  // -- Torso --
  stampPart(pixels, torsoTemplate, materialMap,
    base.torso.x + framePose.torsoDx,
    base.torso.y + framePose.torsoDy + dy);

  // -- Shorts --
  stampPart(pixels, shortsTemplate, materialMap,
    base.shorts.x + framePose.torsoDx,
    base.shorts.y + framePose.torsoDy + dy);

  // -- Arms (Dx clamped to ±1 to prevent detachment) --
  const laDx = Math.max(-1, Math.min(1, framePose.leftArmDx));
  const raDx = Math.max(-1, Math.min(1, framePose.rightArmDx));
  stampPart(pixels, armTemplate, materialMap,
    base.leftArm.x + laDx,
    base.leftArm.y + framePose.leftArmDy + dy);
  // Right arm: mirror horizontally
  stampPartMirrored(pixels, armTemplate, materialMap,
    base.rightArm.x + raDx,
    base.rightArm.y + framePose.rightArmDy + dy);

  // -- Head --
  stampPart(pixels, HEAD_FRONT, materialMap,
    base.head.x + framePose.headDx,
    base.head.y + framePose.headDy + dy);

  // -- Face variant overlay --
  if (app.faceType > 0 && app.faceType < FACE_VARIANTS.length) {
    const overlay = FACE_VARIANTS[app.faceType];
    applyOverlay(pixels, overlay, materialMap,
      base.head.x + framePose.headDx,
      base.head.y + framePose.headDy + dy);
  }

  // -- Hair --
  const hairIdx = app.hairType;
  if (hairIdx < HAIR_VARIANTS.length) {
    const hair = HAIR_VARIANTS[hairIdx];
    if (hair.w > 0) {
      const hx = base.head.x + HAIR_OFFSETS_X[hairIdx] + framePose.headDx;
      const hy = base.head.y + HAIR_OFFSETS_Y[hairIdx] + framePose.headDy + dy;
      stampPart(pixels, hair, materialMap, hx, hy);
    }
  }

  // -- Accessories --
  if (app.accessory === 1) {
    // Headband
    applyOverlay(pixels, ACCESSORY_HEADBAND, materialMap,
      base.head.x + framePose.headDx,
      base.head.y + framePose.headDy + dy);
  } else if (app.accessory === 2) {
    // Wristband on left arm
    applyOverlay(pixels, ACCESSORY_WRISTBAND, materialMap,
      base.leftArm.x + laDx,
      base.leftArm.y + framePose.leftArmDy + dy);
  } else if (app.accessory === 3) {
    // Captain armband on left arm
    applyOverlay(pixels, ACCESSORY_CAPTAIN, materialMap,
      base.leftArm.x + laDx,
      base.leftArm.y + framePose.leftArmDy + dy);
  }

  // -- Jersey number --
  drawNumber(pixels, app.number, materialMap,
    base.torso.x + framePose.torsoDx,
    base.torso.y + framePose.torsoDy + dy);

  // -- Auto-outline --
  applyOutline(pixels);

  // -- Rimlight shading pass --
  applyRimlight(pixels);

  // Write pixel data to canvas
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ── Pixel Stamping ────────────────────────────────────────────────

/** Stamp a body part template onto the pixel buffer at (ox, oy) */
function stampPart(
  pixels: Uint8ClampedArray,
  template: BodyPartTemplate,
  materialMap: number[],
  ox: number,
  oy: number,
) {
  for (let row = 0; row < template.h; row++) {
    for (let col = 0; col < template.w; col++) {
      const mat = template.pixels[row * template.w + col];
      if (mat === MAT._) continue; // transparent

      const px = ox + col;
      const py = oy + row;
      if (px < 0 || px >= SPRITE_W || py < 0 || py >= SPRITE_H) continue;

      const color = materialMap[mat];
      setPixel(pixels, px, py, color);
    }
  }
}

/** Stamp a body part mirrored horizontally */
function stampPartMirrored(
  pixels: Uint8ClampedArray,
  template: BodyPartTemplate,
  materialMap: number[],
  ox: number,
  oy: number,
) {
  for (let row = 0; row < template.h; row++) {
    for (let col = 0; col < template.w; col++) {
      const mat = template.pixels[row * template.w + col];
      if (mat === MAT._) continue;

      const px = ox + (template.w - 1 - col); // mirror X
      const py = oy + row;
      if (px < 0 || px >= SPRITE_W || py < 0 || py >= SPRITE_H) continue;

      const color = materialMap[mat];
      setPixel(pixels, px, py, color);
    }
  }
}

/** Apply a sparse overlay at (ox, oy) */
function applyOverlay(
  pixels: Uint8ClampedArray,
  overlay: [number, number, number][],
  materialMap: number[],
  ox: number,
  oy: number,
) {
  for (const [dx, dy, mat] of overlay) {
    const px = ox + dx;
    const py = oy + dy;
    if (px < 0 || px >= SPRITE_W || py < 0 || py >= SPRITE_H) continue;
    setPixel(pixels, px, py, materialMap[mat]);
  }
}

// ── Jersey Number Drawing ─────────────────────────────────────────

/** Draw jersey number (1-2 digits) centered on torso */
function drawNumber(
  pixels: Uint8ClampedArray,
  num: number,
  materialMap: number[],
  torsoX: number,
  torsoY: number,
) {
  const numColor = materialMap[MAT.N];
  const digits = String(Math.min(num, 99));

  if (digits.length === 1) {
    // Single digit: center on torso (torso is 8 wide)
    const d = parseInt(digits[0]);
    if (d >= 0 && d < DIGIT_FONT.length) {
      stampDigit(pixels, DIGIT_FONT[d], numColor, torsoX + 3, torsoY + 1);
    }
  } else {
    // Two digits
    const d1 = parseInt(digits[0]);
    const d2 = parseInt(digits[1]);
    if (d1 >= 0 && d1 < DIGIT_FONT.length) {
      stampDigit(pixels, DIGIT_FONT[d1], numColor, torsoX + 1, torsoY + 1);
    }
    if (d2 >= 0 && d2 < DIGIT_FONT.length) {
      stampDigit(pixels, DIGIT_FONT[d2], numColor, torsoX + 5, torsoY + 1);
    }
  }
}

/** Stamp a 3×5 digit font at (ox, oy) */
function stampDigit(
  pixels: Uint8ClampedArray,
  font: number[],
  color: number,
  ox: number,
  oy: number,
) {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (font[row * 3 + col] === 0) continue;
      const px = ox + col;
      const py = oy + row;
      if (px < 0 || px >= SPRITE_W || py < 0 || py >= SPRITE_H) continue;
      setPixel(pixels, px, py, color);
    }
  }
}

// ── Auto-Outline ──────────────────────────────────────────────────

/**
 * Scan every pixel: if transparent AND has a non-transparent neighbor,
 * fill with dark outline color. Produces clean contours automatically.
 */
function applyOutline(pixels: Uint8ClampedArray) {
  const outlinePixels: [number, number][] = [];

  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      // Only process transparent pixels
      if (getAlpha(pixels, x, y) > 0) continue;

      // Check 4-connected neighbors
      if (
        hasContent(pixels, x - 1, y) ||
        hasContent(pixels, x + 1, y) ||
        hasContent(pixels, x, y - 1) ||
        hasContent(pixels, x, y + 1)
      ) {
        outlinePixels.push([x, y]);
      }
    }
  }

  // Apply outline pixels (deferred to avoid affecting neighbor checks)
  for (const [x, y] of outlinePixels) {
    setPixel(pixels, x, y, OUTLINE_COLOR);
  }
}

// ── Pixel Helpers ─────────────────────────────────────────────────

function setPixel(pixels: Uint8ClampedArray, x: number, y: number, color: number) {
  const idx = (y * SPRITE_W + x) * 4;
  pixels[idx]     = (color >> 16) & 0xff; // R
  pixels[idx + 1] = (color >> 8) & 0xff;  // G
  pixels[idx + 2] = color & 0xff;         // B
  pixels[idx + 3] = 255;                  // A
}

function getAlpha(pixels: Uint8ClampedArray, x: number, y: number): number {
  if (x < 0 || x >= SPRITE_W || y < 0 || y >= SPRITE_H) return 0;
  return pixels[(y * SPRITE_W + x) * 4 + 3];
}

function hasContent(pixels: Uint8ClampedArray, x: number, y: number): boolean {
  if (x < 0 || x >= SPRITE_W || y < 0 || y >= SPRITE_H) return false;
  return pixels[(y * SPRITE_W + x) * 4 + 3] > 0;
}

// ── Rimlight Shading ──────────────────────────────────────────

/**
 * Directional rimlight: for each outline pixel,
 * brighten neighbor above-left by 15%, darken neighbor below-right by 10%.
 * Creates a subtle directional light feel that makes characters pop.
 */
function applyRimlight(pixels: Uint8ClampedArray) {
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      const idx = (y * SPRITE_W + x) * 4;
      if (pixels[idx + 3] === 0) continue;

      // Check if this is an outline pixel (dark, near #111111)
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      if (r > 0x22 || g > 0x22 || b > 0x22) continue; // not outline

      // Brighten filled pixel above-left (highlight side)
      if (x > 0 && y > 0) {
        const hlIdx = ((y - 1) * SPRITE_W + (x - 1)) * 4;
        if (pixels[hlIdx + 3] > 0 && (pixels[hlIdx] > 0x22 || pixels[hlIdx + 1] > 0x22 || pixels[hlIdx + 2] > 0x22)) {
          pixels[hlIdx]     = Math.min(255, Math.round(pixels[hlIdx] * 1.15));
          pixels[hlIdx + 1] = Math.min(255, Math.round(pixels[hlIdx + 1] * 1.15));
          pixels[hlIdx + 2] = Math.min(255, Math.round(pixels[hlIdx + 2] * 1.15));
        }
      }

      // Darken filled pixel below-right (shadow side)
      if (x < SPRITE_W - 1 && y < SPRITE_H - 1) {
        const shIdx = ((y + 1) * SPRITE_W + (x + 1)) * 4;
        if (pixels[shIdx + 3] > 0 && (pixels[shIdx] > 0x22 || pixels[shIdx + 1] > 0x22 || pixels[shIdx + 2] > 0x22)) {
          pixels[shIdx]     = Math.round(pixels[shIdx] * 0.9);
          pixels[shIdx + 1] = Math.round(pixels[shIdx + 1] * 0.9);
          pixels[shIdx + 2] = Math.round(pixels[shIdx + 2] * 0.9);
        }
      }
    }
  }
}
