// ─────────────────── PlayerTextureCache ───────────────────────────
// Bakes all animation frames per player to a PixiJS Texture atlas.
// One atlas per unique appearance. Runtime = swap Sprite.texture per frame.
// Uses nearest-neighbor filtering for crisp pixel art edges.

import { Texture, Rectangle } from 'pixi.js';
import type { PlayerAppearance } from './PlayerFactory';
import type { PlayerState } from '../types';
import { bakeFrame, buildMaterialMap, SPRITE_W, SPRITE_H } from './PlayerSpriteBuilder';
import { getFrames } from './poses';

// ── Atlas Layout ──────────────────────────────────────────────────
// All states baked into a single atlas canvas.
// Layout: states packed sequentially, frames in a row per state.

const STATES: PlayerState[] = ['idle', 'running', 'kicking', 'diving', 'celebrating'];
const FRAME_COUNTS: Record<PlayerState, number> = {
  idle: 4,
  running: 6,
  kicking: 4,
  diving: 4,
  celebrating: 4,
};

// Atlas grid: 6 columns × 4 rows (24 cells, 22 used)
const ATLAS_COLS = 6;
const ATLAS_ROWS = 4;

// ── Types ─────────────────────────────────────────────────────────

interface CachedAtlas {
  baseTexture: Texture;
  frames: Map<string, Texture>; // key: "state:frameIdx"
}

// ── Cache ─────────────────────────────────────────────────────────

const cache = new Map<string, CachedAtlas>();

/** Generate a deterministic hash for an appearance (for cache lookup) */
function appearanceKey(app: PlayerAppearance): string {
  return [
    app.skinTone, app.hairType, app.hairColor, app.jerseyColor,
    app.shortsColor, app.socksColor, app.bootsColor, app.number,
    app.isGK ? 1 : 0, app.buildType, app.faceType, app.accessory,
    app.sleeveStyle, Math.round(app.heightRatio * 1000),
  ].join(':');
}

/** Bake a full texture atlas for a player appearance */
export function bakeAtlas(app: PlayerAppearance): CachedAtlas {
  const key = appearanceKey(app);
  const existing = cache.get(key);
  if (existing) return existing;

  const atlasW = ATLAS_COLS * SPRITE_W;
  const atlasH = ATLAS_ROWS * SPRITE_H;
  const atlasCanvas = new OffscreenCanvas(atlasW, atlasH);
  const atlasCtx = atlasCanvas.getContext('2d')!;

  const materialMap = buildMaterialMap(app);
  const frames = new Map<string, Texture>();

  let frameIdx = 0;
  for (const state of STATES) {
    const poseFrames = getFrames(state);
    for (let i = 0; i < poseFrames.length; i++) {
      const frameCanvas = bakeFrame(app, poseFrames[i], materialMap);

      // Place frame on atlas grid
      const col = frameIdx % ATLAS_COLS;
      const row = Math.floor(frameIdx / ATLAS_COLS);
      atlasCtx.drawImage(frameCanvas, col * SPRITE_W, row * SPRITE_H);

      frameIdx++;
    }
  }

  // Create base texture from atlas canvas
  const baseTexture = Texture.from({
    resource: atlasCanvas,
    alphaMode: 'premultiply-alpha-on-upload',
  });
  baseTexture.source.scaleMode = 'nearest';

  // Create sub-textures for each frame
  frameIdx = 0;
  for (const state of STATES) {
    const count = FRAME_COUNTS[state];
    for (let i = 0; i < count; i++) {
      const col = frameIdx % ATLAS_COLS;
      const row = Math.floor(frameIdx / ATLAS_COLS);

      const subTexture = new Texture({
        source: baseTexture.source,
        frame: new Rectangle(
          col * SPRITE_W,
          row * SPRITE_H,
          SPRITE_W,
          SPRITE_H,
        ),
      });

      frames.set(`${state}:${i}`, subTexture);
      frameIdx++;
    }
  }

  const atlas: CachedAtlas = { baseTexture, frames };
  cache.set(key, atlas);
  return atlas;
}

/** Get a specific frame texture from a baked atlas */
export function getFrameTexture(
  atlas: CachedAtlas,
  state: PlayerState,
  animTick: number,
): Texture {
  const count = FRAME_COUNTS[state];
  const idx = Math.min(Math.floor(animTick * count), count - 1);
  const key = `${state}:${idx}`;
  return atlas.frames.get(key) ?? atlas.frames.get('idle:0')!;
}

/** Clear the entire texture cache (call on cleanup) */
export function clearCache() {
  for (const atlas of cache.values()) {
    atlas.baseTexture.destroy(true);
  }
  cache.clear();
}
