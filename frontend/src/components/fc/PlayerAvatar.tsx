'use client';

import { useRef, useEffect } from 'react';
import type { PlayerStats } from '@/lib/fc/types';
import { playerTier } from '@/lib/fc/playerNames';
import { deriveNFTAppearance } from '@/lib/fc/players/NFTAppearanceFactory';
import { bakeFrame, buildMaterialMap, SPRITE_W, SPRITE_H } from '@/lib/fc/players/PlayerSpriteBuilder';
import { IDLE_FRAMES } from '@/lib/fc/players/poses';

interface PlayerAvatarProps {
  tokenId: number;
  stats: PlayerStats;
  size?: number; // display size in pixels (default 36)
}

export function PlayerAvatar({ tokenId, stats, size = 36 }: PlayerAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const avg = Math.round(
      (stats.speed + stats.passing + stats.shooting + stats.defense + stats.stamina) / 5,
    );
    const tier = playerTier(avg);
    const appearance = deriveNFTAppearance(tokenId, stats, tier);
    const materialMap = buildMaterialMap(appearance);
    const sprite = bakeFrame(appearance, IDLE_FRAMES[0], materialMap);

    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(sprite, 0, 0);
  }, [tokenId, stats]);

  const h = Math.round(size * (SPRITE_H / SPRITE_W));

  return (
    <canvas
      ref={canvasRef}
      width={SPRITE_W}
      height={SPRITE_H}
      style={{
        width: size,
        height: h,
        imageRendering: 'pixelated',
      }}
    />
  );
}
