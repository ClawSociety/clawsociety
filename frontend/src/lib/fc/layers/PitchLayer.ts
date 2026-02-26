// ─────────────────── PitchLayer ──────────────────────────────
// Pre-renders the pitch to a RenderTexture once.
// Eliminates 240+ draw calls per frame from the old Canvas 2D renderer.

import { Container, Graphics, RenderTexture, Sprite, BlurFilter, type Application } from 'pixi.js';
import type { MatchRenderConfig } from '../types';

export class PitchLayer extends Container {
  private pitchSprite!: Sprite;

  constructor(app: Application, cfg: MatchRenderConfig) {
    super();
    this.buildPitch(app, cfg);
  }

  private buildPitch(app: Application, cfg: MatchRenderConfig) {
    const w = app.screen.width;
    const h = app.screen.height;
    const pad = 24;
    const pw = w - pad * 2;
    const ph = h - pad * 2;

    const g = new Graphics();

    // Background
    g.rect(0, 0, w, h).fill(cfg.pitchColor);

    // Grass stripes
    const stripeCount = 12;
    const stripeW = pw / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const color = i % 2 === 0 ? 0x0a2a0a : 0x113811;
      g.rect(pad + i * stripeW, pad, stripeW + 1, ph).fill(color);
    }

    // Center spotlight — radial bright zone
    const spotlightG = new Graphics();
    spotlightG.circle(w / 2, h / 2, Math.min(pw, ph) * 0.45)
      .fill({ color: 0x1a4a1a, alpha: 0.35 });
    spotlightG.filters = [new BlurFilter({ strength: 40 })];

    // Pitch outline
    g.rect(pad, pad, pw, ph).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Center line
    g.moveTo(w / 2, pad).lineTo(w / 2, pad + ph).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Center circle
    g.circle(w / 2, h / 2, ph * 0.15).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Center dot
    g.circle(w / 2, h / 2, 3).fill({ color: 0xffffff, alpha: 0.4 });

    // Penalty areas
    const penW = pw * 0.13;
    const penH = ph * 0.45;
    g.rect(pad, h / 2 - penH / 2, penW, penH).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.rect(pad + pw - penW, h / 2 - penH / 2, penW, penH).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // 6-yard boxes
    const sixW = pw * 0.05;
    const sixH = ph * 0.22;
    g.rect(pad, h / 2 - sixH / 2, sixW, sixH).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.rect(pad + pw - sixW, h / 2 - sixH / 2, sixW, sixH).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Corner arcs
    const cornerR = pw * 0.025;
    g.arc(pad, pad, cornerR, 0, Math.PI / 2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.arc(pad + pw, pad, cornerR, Math.PI / 2, Math.PI).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.arc(pad, pad + ph, cornerR, -Math.PI / 2, 0).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.arc(pad + pw, pad + ph, cornerR, Math.PI, Math.PI * 1.5).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Penalty spots
    g.circle(pad + penW * 0.75, h / 2, 2).fill({ color: 0xffffff, alpha: 0.35 });
    g.circle(pad + pw - penW * 0.75, h / 2, 2).fill({ color: 0xffffff, alpha: 0.35 });

    // Goals with neon glow
    const goalW = pw * 0.025;
    const goalH = ph * 0.28;
    const homeColor = parseInt(cfg.home.primary.replace('#', ''), 16);
    const awayColor = parseInt(cfg.away.primary.replace('#', ''), 16);

    // Left goal (home)
    g.rect(pad - goalW, h / 2 - goalH / 2, goalW, goalH)
      .stroke({ width: 3, color: homeColor, alpha: 0.7 });

    // Right goal (away)
    g.rect(pad + pw, h / 2 - goalH / 2, goalW, goalH)
      .stroke({ width: 3, color: awayColor, alpha: 0.7 });

    // Goal nets (subtle lines)
    const netStep = goalH / 6;
    for (let i = 1; i < 6; i++) {
      const ny = h / 2 - goalH / 2 + i * netStep;
      g.moveTo(pad - goalW, ny).lineTo(pad, ny).stroke({ width: 0.5, color: 0xffffff, alpha: 0.06 });
      g.moveTo(pad + pw, ny).lineTo(pad + pw + goalW, ny).stroke({ width: 0.5, color: 0xffffff, alpha: 0.06 });
    }

    // Goal glow containers (separate Graphics for blur filter)
    const homeGlow = new Graphics();
    homeGlow.rect(pad - goalW - 4, h / 2 - goalH / 2 - 4, goalW + 8, goalH + 8)
      .fill({ color: homeColor, alpha: 0.2 });
    homeGlow.filters = [new BlurFilter({ strength: 12 })];

    const awayGlow = new Graphics();
    awayGlow.rect(pad + pw - 4, h / 2 - goalH / 2 - 4, goalW + 8, goalH + 8)
      .fill({ color: awayColor, alpha: 0.2 });
    awayGlow.filters = [new BlurFilter({ strength: 12 })];

    // Vignette — darkened edges
    const vignette = new Graphics();
    // Top edge
    vignette.rect(0, 0, w, pad * 1.5).fill({ color: 0x000000, alpha: 0.3 });
    // Bottom edge
    vignette.rect(0, h - pad * 1.5, w, pad * 1.5).fill({ color: 0x000000, alpha: 0.3 });
    // Left edge
    vignette.rect(0, 0, pad * 1.5, h).fill({ color: 0x000000, alpha: 0.2 });
    // Right edge
    vignette.rect(w - pad * 1.5, 0, pad * 1.5, h).fill({ color: 0x000000, alpha: 0.2 });
    vignette.filters = [new BlurFilter({ strength: 20 })];

    // Render to texture
    const rt = RenderTexture.create({ width: w, height: h });
    const tempContainer = new Container();
    tempContainer.addChild(homeGlow, awayGlow, spotlightG, g, vignette);
    app.renderer.render({ container: tempContainer, target: rt });

    this.pitchSprite = new Sprite(rt);
    this.addChild(this.pitchSprite);

    // Cleanup temp
    tempContainer.destroy({ children: true });
  }

  resize(app: Application, cfg: MatchRenderConfig) {
    // Remove old sprite and rebuild
    this.removeChildren();
    this.buildPitch(app, cfg);
  }
}
