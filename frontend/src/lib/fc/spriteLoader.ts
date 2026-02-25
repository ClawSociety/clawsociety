// ─────────────────── NES Sprite Loader ──────────────────────
// Preloads the ChasersGaming NES Soccer Asset Pack sprites
// and provides an atlas API for the player renderer.

import type { Direction8 } from './types';

export type SpriteTeam = 'a' | 'b';
export type SpriteAction = 'run' | 'kick' | 'tackle' | 'celebrate';

export interface SpriteAtlas {
  loaded: boolean;
  get(team: SpriteTeam, action: SpriteAction, dir: Direction8): HTMLImageElement | null;
  ball: HTMLImageElement | null;
}

const DIRECTIONS: Direction8[] = [
  'north', 'northeast', 'east', 'southeast',
  'south', 'southwest', 'west', 'northwest',
];

const SPRITE_BASE = '/fc-sprites';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export async function loadSprites(): Promise<SpriteAtlas> {
  const map = new Map<string, HTMLImageElement>();
  const promises: Promise<void>[] = [];

  const load = (key: string, path: string) => {
    promises.push(
      loadImage(`${SPRITE_BASE}/${path}`).then((img) => {
        map.set(key, img);
      }),
    );
  };

  // Team A: run, kick, tackle (all 8 dirs)
  for (const dir of DIRECTIONS) {
    load(`a-run-${dir}`, `a-run-${dir}.png`);
    load(`a-kick-${dir}`, `a-kick-${dir}.png`);
    load(`a-tackle-${dir}`, `a-tackle-${dir}.png`);
  }

  // Team B: run, kick, tackle (all 8 dirs)
  for (const dir of DIRECTIONS) {
    load(`b-run-${dir}`, `b-run-${dir}.png`);
    load(`b-kick-${dir}`, `b-kick-${dir}.png`);
    load(`b-tackle-${dir}`, `b-tackle-${dir}.png`);
  }

  // Team B celebration (north + south only)
  load('b-celebrate-north', 'b-celebrate-north.png');
  load('b-celebrate-south', 'b-celebrate-south.png');

  // Ball
  load('ball', 'ball.png');

  await Promise.all(promises);

  return {
    loaded: true,
    get(team: SpriteTeam, action: SpriteAction, dir: Direction8) {
      // Celebration: only Team B has it, only north/south
      if (action === 'celebrate') {
        const celebDir = dir === 'south' || dir === 'southeast' || dir === 'southwest' ? 'south' : 'north';
        // Team A celebrates with Team B sprites (scoring team celebrates)
        return map.get(`b-celebrate-${celebDir}`) ?? null;
      }
      return map.get(`${team}-${action}-${dir}`) ?? null;
    },
    ball: map.get('ball') ?? null,
  };
}

/** For run/celebrate strip sprites: 4 frames of 16×24 in a 64×24 strip */
export function getRunFrame(frameIndex: number): { sx: number; sy: number; sw: number; sh: number } {
  return { sx: frameIndex * 16, sy: 0, sw: 16, sh: 24 };
}

/** Convert a movement vector (dx, dy) to the nearest 8-direction */
export function angleToDir8(dx: number, dy: number): Direction8 {
  if (dx === 0 && dy === 0) return 'south'; // default facing
  const angle = Math.atan2(dy, dx); // radians, 0=east, PI/2=south
  // Map angle to 8 directions (each spanning 45 degrees)
  const index = Math.round(angle / (Math.PI / 4));
  // atan2 range: -PI..PI. index: -4..4
  const DIR_MAP: Direction8[] = [
    'east',      // 0
    'southeast', // 1
    'south',     // 2
    'southwest', // 3
    'west',      // 4 or -4
    'northwest', // -3
    'north',     // -2
    'northeast', // -1
  ];
  const normalized = ((index % 8) + 8) % 8;
  return DIR_MAP[normalized];
}
