// ─────────────────── PlayerSprite ─────────────────────────────────
// Replaces PlayerRig. Holds a Sprite + shadow + label.
// Runtime: swaps texture per frame from the pre-baked atlas.
// One draw call per player vs 12+ Graphics objects in the old rig.

import { Container, Sprite, Graphics, Text, type TextStyle } from 'pixi.js';
import type { PlayerAppearance } from './PlayerFactory';
import type { PlayerState } from '../types';
import { bakeAtlas, getFrameTexture } from './PlayerTextureCache';
import { SPRITE_H } from './PlayerSpriteBuilder';

// Display scale: 24×32 native → 48×64 on screen
const SCALE = 2;

export class PlayerSprite {
  readonly root: Container;
  private sprite: Sprite;
  private shadow: Graphics;
  private label: Text;
  private atlas: ReturnType<typeof bakeAtlas>;
  private currentState: PlayerState = 'idle';
  private facingLeft = false;

  constructor(appearance: PlayerAppearance) {
    this.atlas = bakeAtlas(appearance);

    this.root = new Container();
    this.root.sortableChildren = true;

    // Shadow ellipse
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 0, 12, 4).fill({ color: 0x000000, alpha: 0.35 });
    this.shadow.y = (SPRITE_H * SCALE) / 2; // bottom of sprite
    this.shadow.zIndex = 0;
    this.root.addChild(this.shadow);

    // Main sprite
    const initialTexture = getFrameTexture(this.atlas, 'idle', 0);
    this.sprite = new Sprite(initialTexture);
    this.sprite.anchor.set(0.5, 1.0); // anchor at bottom-center
    this.sprite.scale.set(SCALE);
    this.sprite.y = (SPRITE_H * SCALE) / 2;
    this.sprite.zIndex = 1;
    this.root.addChild(this.sprite);

    // Jersey number label
    const labelStyle: Partial<TextStyle> = {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10,
      fontWeight: 'bold',
      fill: 0xffffff,
      align: 'center',
    };
    this.label = new Text({ text: `${appearance.number}`, style: labelStyle });
    this.label.anchor.set(0.5, 0);
    this.label.y = (SPRITE_H * SCALE) / 2 + 2; // just below sprite
    this.label.zIndex = 2;
    this.root.addChild(this.label);
  }

  /** Set facing direction (flips sprite horizontally for left-facing) */
  setDirection(facingLeft: boolean) {
    this.facingLeft = facingLeft;
    this.sprite.scale.x = facingLeft ? -SCALE : SCALE;
  }

  /** Set animation state (idle, running, kicking, diving, celebrating) */
  setState(state: PlayerState) {
    this.currentState = state;
  }

  /** Update sprite texture based on current animation tick */
  animate(animTick: number) {
    const texture = getFrameTexture(this.atlas, this.currentState, animTick);
    this.sprite.texture = texture;
  }
}
