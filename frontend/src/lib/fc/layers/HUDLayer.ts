// ─────────────────── HUDLayer ────────────────────────────────
// Score, match minute, momentum bar, progress.
// Positioned outside shake transform.

import { Container, Graphics, Text, type TextStyle } from 'pixi.js';
import type { MatchRenderConfig } from '../types';

const FONT = 'JetBrains Mono, monospace';
const HUD_HEIGHT = 44;

export class HUDLayer extends Container {
  private bg: Graphics;
  private homeLabel: Text;
  private awayLabel: Text;
  private homePowerText: Text;
  private awayPowerText: Text;
  private scoreText: Text;
  private dashText: Text;
  private awayScoreText: Text;
  private minuteText: Text;
  private momentumBg: Graphics;
  private momentumHome: Graphics;
  private momentumAway: Graphics;
  private progressBar: Graphics;
  private progressFill: Graphics;
  private homeAccent: Graphics;
  private awayAccent: Graphics;

  private cfg: MatchRenderConfig;
  private screenW: number;
  private screenH: number;
  private momentum = 0.5;

  constructor(cfg: MatchRenderConfig, screenW: number, screenH: number, homePower: number, awayPower: number) {
    super();
    this.cfg = cfg;
    this.screenW = screenW;
    this.screenH = screenH;

    // Background bar
    this.bg = new Graphics();
    this.bg.rect(0, 0, screenW, HUD_HEIGHT).fill({ color: 0x000000, alpha: 0.7 });
    this.addChild(this.bg);

    // Team color accents
    const homeColor = parseInt(cfg.home.primary.replace('#', ''), 16);
    const awayColor = parseInt(cfg.away.primary.replace('#', ''), 16);

    this.homeAccent = new Graphics();
    this.homeAccent.rect(0, 0, 4, HUD_HEIGHT).fill({ color: homeColor, alpha: 0.2 });
    this.addChild(this.homeAccent);

    this.awayAccent = new Graphics();
    this.awayAccent.rect(screenW - 4, 0, 4, HUD_HEIGHT).fill({ color: awayColor, alpha: 0.2 });
    this.addChild(this.awayAccent);

    // HOME label
    const labelStyle: Partial<TextStyle> = {
      fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: homeColor,
    };
    this.homeLabel = new Text({ text: 'HOME', style: labelStyle });
    this.homeLabel.x = 10;
    this.homeLabel.y = 5;
    this.addChild(this.homeLabel);

    // Home power
    const powerStyle: Partial<TextStyle> = {
      fontFamily: FONT, fontSize: 8, fill: 0xffffff,
    };
    const hpEth = homePower > 0 ? (homePower / 1e18).toFixed(2) + ' ETH' : '';
    this.homePowerText = new Text({ text: hpEth, style: { ...powerStyle } });
    this.homePowerText.alpha = 0.35;
    this.homePowerText.x = 10;
    this.homePowerText.y = 22;
    this.addChild(this.homePowerText);

    // AWAY label
    this.awayLabel = new Text({
      text: 'AWAY',
      style: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: awayColor },
    });
    this.awayLabel.anchor.set(1, 0);
    this.awayLabel.x = screenW - 10;
    this.awayLabel.y = 5;
    this.addChild(this.awayLabel);

    // Away power
    const apEth = awayPower > 0 ? (awayPower / 1e18).toFixed(2) + ' ETH' : '';
    this.awayPowerText = new Text({ text: apEth, style: { ...powerStyle } });
    this.awayPowerText.alpha = 0.35;
    this.awayPowerText.anchor.set(1, 0);
    this.awayPowerText.x = screenW - 10;
    this.awayPowerText.y = 22;
    this.addChild(this.awayPowerText);

    // Score
    const scoreStyle: Partial<TextStyle> = {
      fontFamily: FONT, fontSize: 36, fontWeight: 'bold', fill: 0xffffff,
    };
    this.scoreText = new Text({ text: '0', style: scoreStyle });
    this.scoreText.anchor.set(0.5, 0.5);
    this.scoreText.x = screenW / 2 - 30;
    this.scoreText.y = 18;
    this.addChild(this.scoreText);

    this.dashText = new Text({ text: '-', style: { ...scoreStyle } });
    this.dashText.alpha = 0.3;
    this.dashText.anchor.set(0.5, 0.5);
    this.dashText.x = screenW / 2;
    this.dashText.y = 18;
    this.addChild(this.dashText);

    this.awayScoreText = new Text({ text: '0', style: scoreStyle });
    this.awayScoreText.anchor.set(0.5, 0.5);
    this.awayScoreText.x = screenW / 2 + 30;
    this.awayScoreText.y = 18;
    this.addChild(this.awayScoreText);

    // Minute
    this.minuteText = new Text({
      text: "0'",
      style: { fontFamily: FONT, fontSize: 12, fill: 0xffffff },
    });
    this.minuteText.alpha = 0.5;
    this.minuteText.anchor.set(0.5, 0);
    this.minuteText.x = screenW / 2;
    this.minuteText.y = 34;
    this.addChild(this.minuteText);

    // Momentum bar at bottom
    const barW = screenW * 0.5;
    const barX = (screenW - barW) / 2;
    const barY = screenH - 6;

    this.momentumBg = new Graphics();
    this.momentumBg.rect(barX, barY, barW, 5).fill({ color: 0x000000, alpha: 0.4 });
    this.addChild(this.momentumBg);

    this.momentumHome = new Graphics();
    this.addChild(this.momentumHome);

    this.momentumAway = new Graphics();
    this.addChild(this.momentumAway);

    // Progress bar under HUD
    this.progressBar = new Graphics();
    this.progressBar.rect(10, HUD_HEIGHT, screenW - 20, 2).fill({ color: 0xffffff, alpha: 0.1 });
    this.addChild(this.progressBar);

    this.progressFill = new Graphics();
    this.addChild(this.progressFill);
  }

  update(progress: number, homeGoals: number, awayGoals: number, momentum: number) {
    // Score
    this.scoreText.text = `${homeGoals}`;
    this.awayScoreText.text = `${awayGoals}`;

    // Minute
    const minute = Math.min(90, Math.floor(progress * 90));
    this.minuteText.text = `${minute}'`;

    // Momentum (lerp)
    this.momentum += (momentum - this.momentum) * 0.08;

    const barW = this.screenW * 0.5;
    const barX = (this.screenW - barW) / 2;
    const barY = this.screenH - 6;
    const homeW = barW * this.momentum;
    const homeColor = parseInt(this.cfg.home.primary.replace('#', ''), 16);
    const awayColor = parseInt(this.cfg.away.primary.replace('#', ''), 16);

    this.momentumHome.clear();
    this.momentumHome.rect(barX, barY, homeW, 5).fill({ color: homeColor, alpha: 0.6 });

    this.momentumAway.clear();
    this.momentumAway.rect(barX + homeW, barY, barW - homeW, 5).fill({ color: awayColor, alpha: 0.6 });

    // Progress bar
    const progW = (this.screenW - 20) * progress;
    this.progressFill.clear();
    this.progressFill.rect(10, HUD_HEIGHT, progW, 2).fill({ color: 0xffd700, alpha: 0.4 });
  }
}
