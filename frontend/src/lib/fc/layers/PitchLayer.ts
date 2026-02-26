// ─────────────────── PitchLayer ──────────────────────────────
// Pre-renders the pitch + crowd stands to a RenderTexture once.
// Eliminates 240+ draw calls per frame from the old Canvas 2D renderer.

import { Container, Graphics, RenderTexture, Sprite, BlurFilter, type Application } from 'pixi.js';
import type { MatchRenderConfig } from '../types';

const PAD = 60; // margin for crowd stands

export class PitchLayer extends Container {
  private pitchSprite!: Sprite;

  constructor(app: Application, cfg: MatchRenderConfig) {
    super();
    this.buildPitch(app, cfg);
  }

  private buildPitch(app: Application, cfg: MatchRenderConfig) {
    const w = app.screen.width;
    const h = app.screen.height;
    const pw = w - PAD * 2;
    const ph = h - PAD * 2;

    const g = new Graphics();

    // ─── Stadium Background ─────────────────────────────
    g.rect(0, 0, w, h).fill(0x050a05);

    // ─── Crowd Stands ───────────────────────────────────
    // Dark stands around the pitch with subtle crowd dots
    const standColor = 0x0c0c14;
    const standHighlight = 0x141420;

    // Top stand
    g.rect(0, 0, w, PAD - 4).fill(standColor);
    // Bottom stand
    g.rect(0, PAD + ph + 4, w, PAD - 4).fill(standColor);
    // Left stand
    g.rect(0, 0, PAD - 4, h).fill(standHighlight);
    // Right stand
    g.rect(PAD + pw + 4, 0, PAD - 4, h).fill(standHighlight);

    // Crowd dots — rows of tiny colored dots in the stands
    const crowdG = new Graphics();
    const crowdColors = [0x44aaff, 0xff4466, 0xffcc00, 0xffffff, 0x66ff88, 0xff8844];
    let dotSeed = 31337;
    const pseudoRng = () => {
      dotSeed = (dotSeed * 1103515245 + 12345) >>> 0;
      return (dotSeed & 0x7fffffff) / 0x7fffffff;
    };

    // Top crowd (rows)
    for (let row = 0; row < 4; row++) {
      const ry = 8 + row * 11;
      for (let col = 0; col < 60; col++) {
        const rx = PAD * 0.3 + col * (pw / 55) + pseudoRng() * 4;
        if (rx > w - PAD * 0.3) continue;
        const c = crowdColors[Math.floor(pseudoRng() * crowdColors.length)];
        const alpha = 0.15 + pseudoRng() * 0.25;
        crowdG.circle(rx, ry, 1.5 + pseudoRng() * 1).fill({ color: c, alpha });
      }
    }

    // Bottom crowd (rows)
    for (let row = 0; row < 4; row++) {
      const ry = PAD + ph + 8 + row * 11;
      for (let col = 0; col < 60; col++) {
        const rx = PAD * 0.3 + col * (pw / 55) + pseudoRng() * 4;
        if (rx > w - PAD * 0.3) continue;
        const c = crowdColors[Math.floor(pseudoRng() * crowdColors.length)];
        const alpha = 0.15 + pseudoRng() * 0.25;
        crowdG.circle(rx, ry, 1.5 + pseudoRng() * 1).fill({ color: c, alpha });
      }
    }

    // Left crowd
    for (let row = 0; row < 3; row++) {
      const rx = 10 + row * 14;
      for (let col = 0; col < 20; col++) {
        const ry = PAD + col * (ph / 18) + pseudoRng() * 6;
        if (ry > PAD + ph) continue;
        const c = crowdColors[Math.floor(pseudoRng() * crowdColors.length)];
        const alpha = 0.12 + pseudoRng() * 0.2;
        crowdG.circle(rx, ry, 1.2 + pseudoRng() * 0.8).fill({ color: c, alpha });
      }
    }

    // Right crowd
    for (let row = 0; row < 3; row++) {
      const rx = w - 10 - row * 14;
      for (let col = 0; col < 20; col++) {
        const ry = PAD + col * (ph / 18) + pseudoRng() * 6;
        if (ry > PAD + ph) continue;
        const c = crowdColors[Math.floor(pseudoRng() * crowdColors.length)];
        const alpha = 0.12 + pseudoRng() * 0.2;
        crowdG.circle(rx, ry, 1.2 + pseudoRng() * 0.8).fill({ color: c, alpha });
      }
    }

    // Stand edge lines (barrier between crowd and pitch)
    const barrierG = new Graphics();
    // Top barrier
    barrierG.moveTo(PAD - 3, PAD - 3).lineTo(PAD + pw + 3, PAD - 3)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.08 });
    // Bottom barrier
    barrierG.moveTo(PAD - 3, PAD + ph + 3).lineTo(PAD + pw + 3, PAD + ph + 3)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.08 });
    // Left barrier
    barrierG.moveTo(PAD - 3, PAD - 3).lineTo(PAD - 3, PAD + ph + 3)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.08 });
    // Right barrier
    barrierG.moveTo(PAD + pw + 3, PAD - 3).lineTo(PAD + pw + 3, PAD + ph + 3)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.08 });

    // ─── Grass Stripes ──────────────────────────────────
    const stripeCount = 12;
    const stripeW = pw / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const color = i % 2 === 0 ? 0x0a2a0a : 0x113811;
      g.rect(PAD + i * stripeW, PAD, stripeW + 1, ph).fill(color);
    }

    // Center spotlight — radial bright zone
    const spotlightG = new Graphics();
    spotlightG.circle(w / 2, h / 2, Math.min(pw, ph) * 0.45)
      .fill({ color: 0x1a4a1a, alpha: 0.35 });
    spotlightG.filters = [new BlurFilter({ strength: 40 })];

    // ─── Pitch Lines ────────────────────────────────────
    // Outline
    g.rect(PAD, PAD, pw, ph).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Center line
    g.moveTo(w / 2, PAD).lineTo(w / 2, PAD + ph).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Center circle
    g.circle(w / 2, h / 2, ph * 0.15).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Center dot
    g.circle(w / 2, h / 2, 3).fill({ color: 0xffffff, alpha: 0.4 });

    // Penalty areas
    const penW = pw * 0.13;
    const penH = ph * 0.45;
    g.rect(PAD, h / 2 - penH / 2, penW, penH).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.rect(PAD + pw - penW, h / 2 - penH / 2, penW, penH).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // 6-yard boxes
    const sixW = pw * 0.05;
    const sixH = ph * 0.22;
    g.rect(PAD, h / 2 - sixH / 2, sixW, sixH).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.rect(PAD + pw - sixW, h / 2 - sixH / 2, sixW, sixH).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Corner arcs
    const cornerR = pw * 0.025;
    g.arc(PAD, PAD, cornerR, 0, Math.PI / 2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.arc(PAD + pw, PAD, cornerR, Math.PI / 2, Math.PI).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.arc(PAD, PAD + ph, cornerR, -Math.PI / 2, 0).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });
    g.arc(PAD + pw, PAD + ph, cornerR, Math.PI, Math.PI * 1.5).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

    // Penalty spots
    g.circle(PAD + penW * 0.75, h / 2, 2).fill({ color: 0xffffff, alpha: 0.35 });
    g.circle(PAD + pw - penW * 0.75, h / 2, 2).fill({ color: 0xffffff, alpha: 0.35 });

    // ─── Goals ──────────────────────────────────────────
    const goalW = pw * 0.04;
    const goalH = ph * 0.28;
    const homeColor = parseInt(cfg.home.primary.replace('#', ''), 16);
    const awayColor = parseInt(cfg.away.primary.replace('#', ''), 16);

    // Goal interior (dark fill — back of the net)
    g.rect(PAD - goalW, h / 2 - goalH / 2, goalW, goalH)
      .fill({ color: 0x000000, alpha: 0.6 });
    g.rect(PAD + pw, h / 2 - goalH / 2, goalW, goalH)
      .fill({ color: 0x000000, alpha: 0.6 });

    // Goalposts (thick bright lines on 3 sides — open toward pitch)
    // Left goal (home): posts on left, top, bottom
    g.moveTo(PAD - goalW, h / 2 - goalH / 2).lineTo(PAD - goalW, h / 2 + goalH / 2)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.8 }); // back post
    g.moveTo(PAD - goalW, h / 2 - goalH / 2).lineTo(PAD, h / 2 - goalH / 2)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.7 }); // top bar
    g.moveTo(PAD - goalW, h / 2 + goalH / 2).lineTo(PAD, h / 2 + goalH / 2)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.7 }); // bottom bar

    // Right goal (away): posts on right, top, bottom
    g.moveTo(PAD + pw + goalW, h / 2 - goalH / 2).lineTo(PAD + pw + goalW, h / 2 + goalH / 2)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.8 });
    g.moveTo(PAD + pw, h / 2 - goalH / 2).lineTo(PAD + pw + goalW, h / 2 - goalH / 2)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.7 });
    g.moveTo(PAD + pw, h / 2 + goalH / 2).lineTo(PAD + pw + goalW, h / 2 + goalH / 2)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.7 });

    // Net pattern — crosshatch inside each goal
    const netStepH = goalH / 8;
    const netStepW = goalW / 4;

    // Left goal net (horizontal + vertical lines)
    for (let i = 1; i < 8; i++) {
      const ny = h / 2 - goalH / 2 + i * netStepH;
      g.moveTo(PAD - goalW, ny).lineTo(PAD, ny)
        .stroke({ width: 0.8, color: 0xffffff, alpha: 0.15 });
    }
    for (let i = 1; i < 4; i++) {
      const nx = PAD - goalW + i * netStepW;
      g.moveTo(nx, h / 2 - goalH / 2).lineTo(nx, h / 2 + goalH / 2)
        .stroke({ width: 0.8, color: 0xffffff, alpha: 0.12 });
    }

    // Right goal net
    for (let i = 1; i < 8; i++) {
      const ny = h / 2 - goalH / 2 + i * netStepH;
      g.moveTo(PAD + pw, ny).lineTo(PAD + pw + goalW, ny)
        .stroke({ width: 0.8, color: 0xffffff, alpha: 0.15 });
    }
    for (let i = 1; i < 4; i++) {
      const nx = PAD + pw + i * netStepW;
      g.moveTo(nx, h / 2 - goalH / 2).lineTo(nx, h / 2 + goalH / 2)
        .stroke({ width: 0.8, color: 0xffffff, alpha: 0.12 });
    }

    // Goal glows (team-colored)
    const homeGlow = new Graphics();
    homeGlow.rect(PAD - goalW - 4, h / 2 - goalH / 2 - 4, goalW + 8, goalH + 8)
      .fill({ color: homeColor, alpha: 0.15 });
    homeGlow.filters = [new BlurFilter({ strength: 12 })];

    const awayGlow = new Graphics();
    awayGlow.rect(PAD + pw - 4, h / 2 - goalH / 2 - 4, goalW + 8, goalH + 8)
      .fill({ color: awayColor, alpha: 0.15 });
    awayGlow.filters = [new BlurFilter({ strength: 12 })];

    // ─── Vignette ───────────────────────────────────────
    const vignette = new Graphics();
    vignette.rect(0, 0, w, 20).fill({ color: 0x000000, alpha: 0.5 });
    vignette.rect(0, h - 20, w, 20).fill({ color: 0x000000, alpha: 0.5 });
    vignette.rect(0, 0, 16, h).fill({ color: 0x000000, alpha: 0.4 });
    vignette.rect(w - 16, 0, 16, h).fill({ color: 0x000000, alpha: 0.4 });
    vignette.filters = [new BlurFilter({ strength: 16 })];

    // ─── Render to Texture ──────────────────────────────
    const rt = RenderTexture.create({ width: w, height: h });
    const tempContainer = new Container();
    tempContainer.addChild(homeGlow, awayGlow, spotlightG, g, crowdG, barrierG, vignette);
    app.renderer.render({ container: tempContainer, target: rt });

    this.pitchSprite = new Sprite(rt);
    this.addChild(this.pitchSprite);

    tempContainer.destroy({ children: true });
  }

  resize(app: Application, cfg: MatchRenderConfig) {
    this.removeChildren();
    this.buildPitch(app, cfg);
  }
}
