// ─────────────────── PlayerLayer ─────────────────────────────
// 10 pixel art player sprites (5 home + 5 away).
// Each player is a pre-baked texture atlas — no runtime Graphics.
// Y-sorted with secondary X sort to prevent flicker.

import { Container } from 'pixi.js';
import type { PlayerFrame, Team, MatchRenderConfig } from '../types';
import { HOME_FORMATION, AWAY_FORMATION } from '../types';
import { PlayerSprite } from '../players/PlayerSprite';
import { deriveAppearance } from '../players/PlayerFactory';

const PADDING = 24;

interface SpriteEntry {
  sprite: PlayerSprite;
  team: Team;
  index: number;
}

export class PlayerLayer extends Container {
  private sprites: SpriteEntry[] = [];
  private pw = 0;
  private ph = 0;

  constructor(cfg: MatchRenderConfig, screenW: number, screenH: number) {
    super();
    this.pw = screenW - PADDING * 2;
    this.ph = screenH - PADDING * 2;
    this.sortableChildren = true;

    // Create 10 pixel art player sprites
    for (const formation of [HOME_FORMATION, AWAY_FORMATION]) {
      for (const player of formation) {
        const appearance = deriveAppearance(player.team, player.index, player.role, cfg);
        const sprite = new PlayerSprite(appearance);
        this.addChild(sprite.root);
        this.sprites.push({ sprite, team: player.team, index: player.index });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(frames: PlayerFrame[], _elapsedMs: number) {
    // Y-sort with secondary X sort
    const sorted = [...frames].sort((a, b) => {
      const dy = a.pos.y - b.pos.y;
      return dy !== 0 ? dy : a.pos.x - b.pos.x;
    });

    for (let i = 0; i < sorted.length; i++) {
      const frame = sorted[i];
      const entry = this.findSprite(frame.team, frame.index);
      if (!entry) continue;

      const { sprite } = entry;

      // Position on pitch
      sprite.root.x = PADDING + frame.pos.x * this.pw;
      sprite.root.y = PADDING + frame.pos.y * this.ph;
      sprite.root.zIndex = i;

      // Direction: flip sprite for westward facing
      const facingLeft = frame.dir === 'west' || frame.dir === 'northwest' || frame.dir === 'southwest';
      sprite.setDirection(facingLeft);

      // Animation state + frame
      sprite.setState(frame.state);
      sprite.animate(frame.animTick);
    }
  }

  private findSprite(team: Team, index: number): SpriteEntry | undefined {
    return this.sprites.find(s => s.team === team && s.index === index);
  }

  resize(screenW: number, screenH: number) {
    this.pw = screenW - PADDING * 2;
    this.ph = screenH - PADDING * 2;
  }
}
