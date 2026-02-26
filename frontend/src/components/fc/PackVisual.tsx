'use client';

import { useRef, useEffect } from 'react';
import { formatETH } from '@/lib/utils';

// ── Pixel art pack rendering ──────────────────────────────────────────────

function drawPack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;

  // Box dimensions
  const bx = 20, by = 30, bw = w - 40, bh = h - 70;

  // ── Box body ──
  ctx.fillStyle = '#0d0d2a';
  ctx.fillRect(bx, by, bw, bh);

  // Inner gradient panels
  ctx.fillStyle = '#10103a';
  ctx.fillRect(bx + 6, by + 6, bw - 12, bh - 12);
  ctx.fillStyle = '#131348';
  ctx.fillRect(bx + 10, by + 10, bw - 20, bh - 20);

  // ── Neon cyan border (2px) ──
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

  // Corner highlights (brighter dots)
  ctx.fillStyle = '#66ffff';
  const corners = [
    [bx + 2, by + 2],
    [bx + bw - 5, by + 2],
    [bx + 2, by + bh - 5],
    [bx + bw - 5, by + bh - 5],
  ];
  corners.forEach(([cx, cy]) => ctx.fillRect(cx, cy, 3, 3));

  // ── Claw symbol (center pixel art) ──
  const clawColor = '#00ffff';
  const clawCx = Math.floor(w / 2);
  const clawCy = Math.floor(by + bh / 2) - 8;
  const p = 3; // pixel size

  // Three claw marks (talon scratches)
  ctx.fillStyle = clawColor;
  // Left talon
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(clawCx - 4 * p + i * p * 0.3, clawCy - 2 * p + i * p, p, p);
  }
  // Center talon
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(clawCx - p / 2, clawCy - 3 * p + i * p, p, p);
  }
  // Right talon
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(clawCx + 3 * p - i * p * 0.3, clawCy - 2 * p + i * p, p, p);
  }

  // Claw tips (brighter)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(clawCx - 4 * p, clawCy - 2 * p, p, p);
  ctx.fillRect(clawCx - p / 2, clawCy - 3 * p, p, p);
  ctx.fillRect(clawCx + 3 * p, clawCy - 2 * p, p, p);

  // ── "x5" pixel text ──
  const tx = Math.floor(w / 2) - 18;
  const ty = clawCy + 5 * p + 4;
  ctx.fillStyle = '#00ffff88';

  // "x" character (5x5 pixel font)
  const xChar = [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ];
  xChar.forEach((row, ry) =>
    row.forEach((on, rx) => {
      if (on) ctx.fillRect(tx + rx * 2, ty + ry * 2, 2, 2);
    })
  );

  // "5" character
  const fiveChar = [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 1],
    [1, 1, 1, 0],
  ];
  fiveChar.forEach((row, ry) =>
    row.forEach((on, rx) => {
      if (on) ctx.fillRect(tx + 14 + rx * 2, ty + ry * 2, 2, 2);
    })
  );

  // ── Tier stripe lines at bottom ──
  const tierColors = ['#cd7f32', '#c0c0c0', '#ffd700', '#88ddff'];
  const stripeY = by + bh - 14;
  tierColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(bx + 12, stripeY + i * 3, bw - 24, 2);
  });

  // ── "PLAYERS" text below x5 ──
  ctx.fillStyle = '#00ffff44';
  const label = 'PLAYERS';
  const labelX = Math.floor(w / 2) - 21;
  const labelY = ty + 14;
  // Tiny 3x5 pixel font for each letter
  const miniFont: Record<string, number[][]> = {
    P: [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
    L: [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
    A: [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    Y: [[1,0,1],[1,0,1],[0,1,0],[0,1,0],[0,1,0]],
    E: [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
    R: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
    S: [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
  };
  label.split('').forEach((ch, ci) => {
    const glyph = miniFont[ch];
    if (!glyph) return;
    glyph.forEach((row, ry) =>
      row.forEach((on, rx) => {
        if (on) ctx.fillRect(labelX + ci * 6 + rx * 2, labelY + ry * 2, 1, 1);
      })
    );
  });
}

// ── Component ─────────────────────────────────────────────────────────────

export function PackVisual({
  isPending,
  packPrice,
}: {
  isPending: boolean;
  packPrice: bigint;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 160;
  const H = 200;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    drawPack(ctx, W, H);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`pack-visual relative ${isPending ? 'pack-opening' : 'pack-idle'}`}
        style={{
          filter: isPending
            ? 'drop-shadow(0 0 16px rgba(255,255,255,0.6))'
            : 'drop-shadow(0 0 12px rgba(0,255,255,0.35))',
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <span className="font-mono text-lg font-black uppercase text-cyan-400">
        {isPending ? 'Opening...' : 'Open Pack'}
      </span>
      <span className="font-mono text-xs text-gray-400">
        {formatETH(packPrice)} for 5 players
      </span>

      <style jsx>{`
        .pack-idle {
          animation: packFloat 3s ease-in-out infinite;
          cursor: pointer;
          transition: filter 0.2s, transform 0.2s;
        }
        .pack-idle:hover {
          filter: drop-shadow(0 0 20px rgba(0,255,255,0.6)) !important;
          transform: scale(1.05);
        }
        .pack-opening {
          animation: packShake 0.15s ease-in-out infinite;
        }
        @keyframes packFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes packShake {
          0% { transform: translate(-2px, 0) rotate(-1deg); }
          25% { transform: translate(2px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 1px) rotate(-0.5deg); }
          75% { transform: translate(1px, -1px) rotate(0.5deg); }
          100% { transform: translate(-2px, 0) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}

