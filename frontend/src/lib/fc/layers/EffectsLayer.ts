// ─────────────────── EffectsLayer ────────────────────────────
// Cinematic effects: screen shake, goal flash, text overlays,
// camera zoom, full-time overlay.

import { Container, Graphics, Text, type TextStyle } from 'pixi.js';
import type { MatchEvent, MatchRenderConfig, Team } from '../types';

const FONT = 'JetBrains Mono, monospace';

interface ShakeState {
  decay: number;
  intensity: number;
  counter: number; // deterministic shake (no Math.random)
}

export class EffectsLayer extends Container {
  private flash: Graphics;
  private goalText: Text;
  private eventText: Text;
  private fullTimeOverlay: Container;
  private fullTimeScore: Text;
  private fullTimeLabel: Text;
  private cfg: MatchRenderConfig;
  private screenW: number;
  private screenH: number;

  // Shake state — applies to parent container offset
  shake: ShakeState = { decay: 0, intensity: 0, counter: 0 };
  shakeX = 0;
  shakeY = 0;

  // Zoom state
  zoom = 1;
  private zoomTarget = 1;
  private zoomDecay = 0;

  constructor(cfg: MatchRenderConfig, screenW: number, screenH: number) {
    super();
    this.cfg = cfg;
    this.screenW = screenW;
    this.screenH = screenH;

    // Flash overlay
    this.flash = new Graphics();
    this.flash.rect(0, 0, screenW, screenH).fill(0x000000);
    this.flash.alpha = 0;
    this.addChild(this.flash);

    // Goal text
    this.goalText = new Text({
      text: 'GOAL!',
      style: {
        fontFamily: FONT, fontSize: 56, fontWeight: 'bold',
        fill: 0xffffff, align: 'center',
        dropShadow: { color: 0x00ffff, blur: 30, distance: 0, alpha: 1, angle: 0 },
      },
    });
    this.goalText.anchor.set(0.5, 0.5);
    this.goalText.x = screenW / 2;
    this.goalText.y = screenH / 2 - 10;
    this.goalText.visible = false;
    this.addChild(this.goalText);

    // Generic event text (SAVE!, TACKLE)
    this.eventText = new Text({
      text: '',
      style: {
        fontFamily: FONT, fontSize: 20, fontWeight: 'bold',
        fill: 0xffd700, align: 'center',
        dropShadow: { color: 0xffd700, blur: 12, distance: 0, alpha: 1, angle: 0 },
      },
    });
    this.eventText.anchor.set(0.5, 0.5);
    this.eventText.x = screenW / 2;
    this.eventText.y = screenH / 2 + 50;
    this.eventText.visible = false;
    this.addChild(this.eventText);

    // Full time overlay
    this.fullTimeOverlay = new Container();
    this.fullTimeOverlay.visible = false;

    const ftBg = new Graphics();
    ftBg.rect(0, screenH / 2 - 35, screenW, 70).fill({ color: 0x000000, alpha: 0.65 });
    // Border lines
    ftBg.moveTo(screenW * 0.15, screenH / 2 - 35).lineTo(screenW * 0.85, screenH / 2 - 35)
      .stroke({ width: 1, color: 0xffd700, alpha: 0.3 });
    ftBg.moveTo(screenW * 0.15, screenH / 2 + 35).lineTo(screenW * 0.85, screenH / 2 + 35)
      .stroke({ width: 1, color: 0xffd700, alpha: 0.3 });
    this.fullTimeOverlay.addChild(ftBg);

    this.fullTimeLabel = new Text({
      text: 'FULL TIME',
      style: { fontFamily: FONT, fontSize: 10, fontWeight: 'bold', fill: 0xffffff },
    });
    this.fullTimeLabel.alpha = 0.5;
    this.fullTimeLabel.anchor.set(0.5, 0.5);
    this.fullTimeLabel.x = screenW / 2;
    this.fullTimeLabel.y = screenH / 2 - 14;
    this.fullTimeOverlay.addChild(this.fullTimeLabel);

    this.fullTimeScore = new Text({
      text: '0  -  0',
      style: { fontFamily: FONT, fontSize: 28, fontWeight: 'bold', fill: 0xffd700 },
    });
    this.fullTimeScore.anchor.set(0.5, 0.5);
    this.fullTimeScore.x = screenW / 2;
    this.fullTimeScore.y = screenH / 2 + 12;
    this.fullTimeOverlay.addChild(this.fullTimeScore);

    this.addChild(this.fullTimeOverlay);
  }

  triggerGoal(team: Team) {
    const color = team === 'home'
      ? parseInt(this.cfg.home.primary.replace('#', ''), 16)
      : parseInt(this.cfg.away.primary.replace('#', ''), 16);

    // Flash
    this.flash.clear();
    this.flash.rect(0, 0, this.screenW, this.screenH).fill(color);
    this.flash.alpha = 0.45;

    // Goal text color
    (this.goalText.style as TextStyle).fill = color;
    (this.goalText.style as TextStyle).dropShadow = { color, blur: 30, distance: 0, alpha: 1, angle: 0 };

    // Shake
    this.shake.decay = 600;
    this.shake.intensity = 8;

    // Zoom
    this.zoomTarget = 1.3;
    this.zoomDecay = 1200;
  }

  triggerShot() {
    this.shake.decay = 120;
    this.shake.intensity = 3;
  }

  triggerTackle() {
    this.shake.decay = 60;
    this.shake.intensity = 1.5;
  }

  triggerSave() {
    this.shake.decay = 80;
    this.shake.intensity = 2;
  }

  update(event: MatchEvent | null, eventProgress: number, deltaMs: number) {
    // Shake update (deterministic — no Math.random)
    if (this.shake.decay > 0) {
      this.shake.counter++;
      const t = this.shake.decay / 600 * this.shake.intensity;
      // Use sine waves at different frequencies for pseudo-random shake
      this.shakeX = Math.sin(this.shake.counter * 7.3) * t;
      this.shakeY = Math.cos(this.shake.counter * 11.1) * t;
      this.shake.decay = Math.max(0, this.shake.decay - deltaMs);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    // Zoom update
    if (this.zoomDecay > 0) {
      this.zoomDecay = Math.max(0, this.zoomDecay - deltaMs);
      const t = this.zoomDecay / 1200;
      this.zoom = 1 + (this.zoomTarget - 1) * this.easeOut(t);
    } else {
      this.zoom = 1;
    }

    // Flash fade
    if (this.flash.alpha > 0) {
      this.flash.alpha = Math.max(0, this.flash.alpha - deltaMs * 0.001);
    }

    // Goal text
    if (event?.type === 'goal') {
      this.goalText.visible = eventProgress > 0.1;
      if (eventProgress > 0.1) {
        const textAlpha = Math.min(1, (eventProgress - 0.1) / 0.15) * Math.max(0, 1 - (eventProgress - 0.6) / 0.4);
        const sc = 1 + Math.max(0, (0.3 - eventProgress)) * 2;
        this.goalText.alpha = textAlpha;
        this.goalText.scale.set(sc);
      }
    } else {
      this.goalText.visible = false;
    }

    // Event text (SAVE, TACKLE)
    if (event?.type === 'save' && eventProgress > 0.2) {
      this.showEventText('SAVE!', 0xffd700, eventProgress);
    } else if (event?.type === 'tackle' && eventProgress > 0.15 && eventProgress < 0.85) {
      this.showEventText('TACKLE', 0xff8855, eventProgress);
    } else {
      this.eventText.visible = false;
    }
  }

  private showEventText(text: string, color: number, ep: number) {
    this.eventText.visible = true;
    this.eventText.text = text;
    (this.eventText.style as TextStyle).fill = color;

    const fadeIn = Math.min(1, ep * 4);
    const fadeOut = Math.max(0, 1 - (ep - 0.5) * 4);
    this.eventText.alpha = fadeIn * fadeOut;
    this.eventText.y = this.screenH / 2 + 50 - (1 - this.easeOut(fadeIn)) * 10;
  }

  showFullTime(homeGoals: number, awayGoals: number) {
    this.fullTimeOverlay.visible = true;
    this.fullTimeScore.text = `${homeGoals}  -  ${awayGoals}`;
  }

  private easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }
}
