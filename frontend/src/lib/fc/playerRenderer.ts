import type { PlayerState, Team, Direction8 } from './types';
import type { SpriteAtlas, SpriteTeam } from './spriteLoader';
import { getRunFrame } from './spriteLoader';

// ─────────────────── NES Sprite Player Renderer ─────────────
// Renders players using 16×24 NES pixel art sprites.
// Replaces the v2 canvas-path bonecos.

const FRAME_W = 16;
const FRAME_H = 24;

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sprites: SpriteAtlas,
  team: Team,
  state: PlayerState,
  dir: Direction8,
  animTick: number,
  scale: number,
) {
  const spriteTeam: SpriteTeam = team === 'home' ? 'a' : 'b';
  const drawW = FRAME_W * scale;
  const drawH = FRAME_H * scale;

  // Ground shadow ellipse
  ctx.beginPath();
  ctx.ellipse(x, y + drawH * 0.45, drawW * 0.4, drawH * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // Select sprite + source frame
  let img: HTMLImageElement | null = null;
  let sx = 0;

  if (state === 'running' || state === 'idle') {
    img = sprites.get(spriteTeam, 'run', dir);
    const frameCount = 4;
    const frameIdx = state === 'idle' ? 0 : Math.floor(animTick * frameCount) % frameCount;
    sx = frameIdx * FRAME_W;
  } else if (state === 'kicking') {
    img = sprites.get(spriteTeam, 'kick', dir);
    sx = 0;
  } else if (state === 'diving') {
    img = sprites.get(spriteTeam, 'tackle', dir);
    sx = 0;
  } else if (state === 'celebrating') {
    img = sprites.get(spriteTeam, 'celebrate', dir);
    // Celebration is a 4-frame strip
    const frameIdx = Math.floor(animTick * 4) % 4;
    sx = frameIdx * FRAME_W;
  }

  if (!img) return;

  // Determine source width based on whether this is a strip or single frame
  const isStrip = state === 'running' || state === 'idle' || state === 'celebrating';
  const { sw, sh } = isStrip
    ? getRunFrame(0) // just get dimensions
    : { sw: FRAME_W, sh: FRAME_H };

  // Pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    sx, 0, sw, sh,
    Math.round(x - drawW / 2), Math.round(y - drawH + drawH * 0.15),
    Math.round(drawW), Math.round(drawH),
  );
  ctx.imageSmoothingEnabled = true;
}
