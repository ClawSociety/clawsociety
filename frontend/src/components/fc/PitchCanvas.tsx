'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { generateTimeline } from '@/lib/fc/simulation';
import { MatchRenderer } from '@/lib/fc/matchRenderer';
import { loadSprites, type SpriteAtlas } from '@/lib/fc/spriteLoader';

// ─────────────────── Props (UNCHANGED) ──────────────────────

interface PitchCanvasProps {
  homeGoals: number;
  awayGoals: number;
  seed: bigint;
  homePower: number;
  awayPower: number;
  width?: number;
  height?: number;
}

// ─────────────────── Component ──────────────────────────────

export function PitchCanvas({
  homeGoals,
  awayGoals,
  seed,
  homePower,
  awayPower,
  width = 540,
  height = 340,
}: PitchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [sprites, setSprites] = useState<SpriteAtlas | null>(null);

  // Load sprites once
  useEffect(() => {
    loadSprites().then(setSprites);
  }, []);

  // Deterministic timeline — only recomputes when match data changes
  const timeline = useMemo(
    () => generateTimeline(homeGoals, awayGoals, seed, homePower, awayPower),
    [homeGoals, awayGoals, seed, homePower, awayPower],
  );

  // Renderer instance — depends on sprites being loaded
  const renderer = useMemo(
    () => sprites ? new MatchRenderer(timeline, undefined, homePower, awayPower, sprites) : null,
    [timeline, homePower, awayPower, sprites],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Show loading state if sprites not ready
    if (!renderer) {
      ctx.fillStyle = '#0a1a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('LOADING...', canvas.width / 2, canvas.height / 2);
      return;
    }

    let start = 0;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;

      const running = renderer.renderFrame(ctx, canvas.width, canvas.height, elapsed);

      if (running) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [renderer, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full rounded-lg border border-white/10"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
