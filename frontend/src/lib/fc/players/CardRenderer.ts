// ─────────────────── Card Renderer ──────────────────────────────
// Renders a full NFT card (360×504) from pixel art sprite + stats.
// Pipeline: background → border → portrait → name → stats → badges.

import type { PlayerStats } from '../types';
import type { Tier } from '../playerNames';
import { TIER_COLORS, TIER_LABELS, TIER_STARS } from '../playerNames';
import { deriveNFTAppearance } from './NFTAppearanceFactory';
import { bakeFrame, buildMaterialMap, type CanvasFactory } from './PlayerSpriteBuilder';
import { IDLE_FRAMES } from './poses';

// ── Constants ─────────────────────────────────────────────────

const CARD_W = 360;
const CARD_H = 504;
const PORTRAIT_SCALE = 8; // 24×32 → 192×256

// Tier gradient backgrounds (dark bottom → tier color top)
const TIER_GRADIENTS: Record<Tier, { top: string; bottom: string }> = {
  bronze:  { top: '#3d2b1a', bottom: '#0d0d1a' },
  silver:  { top: '#2a2a3a', bottom: '#0d0d1a' },
  gold:    { top: '#3d3510', bottom: '#0d0d1a' },
  diamond: { top: '#1a2d3a', bottom: '#0d0d1a' },
};

// ── Stat Color ────────────────────────────────────────────────

export function statColor(val: number): string {
  if (val >= 85) return '#00ff88';
  if (val >= 70) return '#00ffff';
  if (val >= 50) return '#ffd700';
  if (val >= 30) return '#ff8855';
  return '#ff0055';
}

// ── Main Render Function ──────────────────────────────────────

const defaultCanvasFactory: CanvasFactory = (w, h) => new OffscreenCanvas(w, h);

export function renderCard(
  tokenId: number,
  stats: PlayerStats,
  tier: Tier,
  name: string,
  canvasFactory: CanvasFactory = defaultCanvasFactory,
) {
  const canvas = canvasFactory(CARD_W, CARD_H);
  const ctx = canvas.getContext('2d')!;
  const colors = TIER_COLORS[tier];
  const grad = TIER_GRADIENTS[tier];

  // 1. Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bgGrad.addColorStop(0, grad.top);
  bgGrad.addColorStop(1, grad.bottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 2. Border frame with corner accents
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, CARD_W - 8, CARD_H - 8);

  // Corner accents (small L-shapes)
  ctx.lineWidth = 3;
  const corners = [
    [6, 6, 20, 6, 6, 20],       // top-left
    [CARD_W - 6, 6, CARD_W - 20, 6, CARD_W - 6, 20], // top-right
    [6, CARD_H - 6, 20, CARD_H - 6, 6, CARD_H - 20], // bottom-left
    [CARD_W - 6, CARD_H - 6, CARD_W - 20, CARD_H - 6, CARD_W - 6, CARD_H - 20], // bottom-right
  ];
  for (const [x1, y1, x2, y2, x3, y3] of corners) {
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }

  // 3. Derive appearance + bake idle frame 0
  const appearance = deriveNFTAppearance(tokenId, stats, tier);
  const materialMap = buildMaterialMap(appearance);
  const spriteCanvas = bakeFrame(appearance, IDLE_FRAMES[0], materialMap, canvasFactory);

  // 4. Radial glow behind portrait
  const glowX = CARD_W / 2;
  const glowY = 180;
  const glowGrad = ctx.createRadialGradient(glowX, glowY, 30, glowX, glowY, 140);
  glowGrad.addColorStop(0, colors.glow);
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 40, CARD_W, 260);

  // 5. Upscale portrait 8× with nearest-neighbor (crisp pixels)
  const portraitW = 24 * PORTRAIT_SCALE; // 192
  const portraitH = 32 * PORTRAIT_SCALE; // 256
  const portraitX = (CARD_W - portraitW) / 2;
  const portraitY = 50;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas, portraitX, portraitY, portraitW, portraitH);
  ctx.imageSmoothingEnabled = true;

  // 6. Tier badge + stars at top
  ctx.fillStyle = colors.text;
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${TIER_STARS[tier]} ${TIER_LABELS[tier]} ${TIER_STARS[tier]}`,
    CARD_W / 2,
    30,
  );

  // 7. Player name below portrait
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(name, CARD_W / 2, portraitY + portraitH + 22);

  // 8. Token ID
  ctx.fillStyle = '#666666';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText(`#${String(tokenId).padStart(4, '0')}`, CARD_W / 2, portraitY + portraitH + 38);

  // 9. OVR circle badge
  const avg = Math.round(
    (stats.speed + stats.passing + stats.shooting + stats.defense + stats.stamina) / 5,
  );
  const ovrX = CARD_W / 2;
  const ovrY = portraitY + portraitH + 62;
  const ovrR = 20;

  ctx.beginPath();
  ctx.arc(ovrX, ovrY, ovrR, 0, Math.PI * 2);
  ctx.fillStyle = statColor(avg);
  ctx.fill();
  ctx.strokeStyle = '#0d0d1a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0d0d1a';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(avg), ovrX, ovrY);
  ctx.textBaseline = 'alphabetic';

  // 10. Stat bars
  const statY0 = ovrY + ovrR + 16;
  const statLabels = ['SPD', 'PAS', 'SHO', 'DEF', 'STA'];
  const statValues = [stats.speed, stats.passing, stats.shooting, stats.defense, stats.stamina];
  const barX = 40;
  const barW = CARD_W - 100;
  const barH = 8;
  const barGap = 18;

  for (let i = 0; i < 5; i++) {
    const y = statY0 + i * barGap;
    const val = statValues[i];

    // Label
    ctx.fillStyle = '#888888';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(statLabels[i], barX - 30, y + barH - 1);

    // Background bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, barX, y, barW, barH, 3);
    ctx.fill();

    // Filled bar
    ctx.fillStyle = statColor(val);
    roundRect(ctx, barX, y, barW * (val / 100), barH, 3);
    ctx.fill();

    // Value
    ctx.fillStyle = statColor(val);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(val), CARD_W - 20, y + barH - 1);
  }

  return canvas;
}

// ── Helpers ───────────────────────────────────────────────────

function roundRect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
