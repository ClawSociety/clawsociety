// ─────────────────── Card Exporter ──────────────────────────────
// Utility: canvas → PNG blob / browser download.

import type { PlayerStats } from '../types';
import type { Tier } from '../playerNames';
import { playerName, playerTier } from '../playerNames';
import { renderCard } from './CardRenderer';

/** Convert an OffscreenCanvas to a PNG Blob */
export async function cardToBlob(canvas: OffscreenCanvas): Promise<Blob> {
  return canvas.convertToBlob({ type: 'image/png' });
}

/** Render a card and trigger browser download as PNG */
export async function downloadCard(
  tokenId: number,
  stats: PlayerStats,
  tier?: Tier,
): Promise<void> {
  const avg = Math.round(
    (stats.speed + stats.passing + stats.shooting + stats.defense + stats.stamina) / 5,
  );
  const t = tier ?? playerTier(avg);
  const name = playerName(tokenId, t);
  const canvas = renderCard(tokenId, stats, t, name);
  const blob = await cardToBlob(canvas);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudfc-${tokenId}-${name.replace(/\s+/g, '_')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
