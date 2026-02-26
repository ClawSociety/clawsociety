'use client';

import { useRef, useEffect } from 'react';
import type { PlayerStats } from '@/lib/fc/types';
import type { Tier } from '@/lib/fc/playerNames';
import { playerTier, playerName } from '@/lib/fc/playerNames';
import { renderCard } from '@/lib/fc/players/CardRenderer';

interface PixelCardProps {
  tokenId: number;
  stats: PlayerStats;
  tier?: Tier;
  name?: string;
  width?: number;
  className?: string;
  onClick?: () => void;
}

export function PixelCard({
  tokenId,
  stats,
  tier,
  name,
  width = 180,
  className = '',
  onClick,
}: PixelCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const avg = Math.round(
    (stats.speed + stats.passing + stats.shooting + stats.defense + stats.stamina) / 5,
  );
  const resolvedTier = tier ?? playerTier(avg);
  const resolvedName = name ?? playerName(tokenId, resolvedTier);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Render on OffscreenCanvas then draw to visible canvas
    const offscreen = renderCard(tokenId, stats, resolvedTier, resolvedName);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 360;
    canvas.height = 504;
    ctx.drawImage(offscreen, 0, 0);
  }, [tokenId, stats, resolvedTier, resolvedName]);

  const height = Math.round(width * (504 / 360));

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={504}
      className={className}
      onClick={onClick}
      style={{
        width,
        height,
        imageRendering: 'pixelated',
        cursor: onClick ? 'pointer' : undefined,
      }}
    />
  );
}
