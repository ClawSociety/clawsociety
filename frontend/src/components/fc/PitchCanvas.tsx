'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { generateTimeline } from '@/lib/fc/simulation';

// PixiMatchRenderer is dynamically imported inside useEffect to avoid
// PixiJS accessing `navigator` during SSR (Next.js server rendering).

// ─────────────────── Props (UNCHANGED) ──────────────────────

interface PitchCanvasProps {
  homeGoals: number;
  awayGoals: number;
  seed: bigint;
  homePower?: number;
  awayPower?: number;
  width?: number;
  height?: number;
  /** Optional NFT token IDs for home team players (5 entries) */
  homePlayerIds?: number[];
  /** Optional NFT token IDs for away team players (5 entries) */
  awayPlayerIds?: number[];
  /** Optional stats for home team players (5 entries) */
  homeStats?: { speed: number; passing: number; shooting: number; defense: number; stamina: number }[];
  /** Optional stats for away team players (5 entries) */
  awayStats?: { speed: number; passing: number; shooting: number; defense: number; stamina: number }[];
  /** Optional formation for home/away teams */
  homeFormation?: 'balanced' | 'offensive' | 'defensive';
  awayFormation?: 'balanced' | 'offensive' | 'defensive';
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
  homePlayerIds,
  awayPlayerIds,
  homeStats,
  awayStats,
  homeFormation,
  awayFormation,
}: PitchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<{ destroy: () => void; togglePause: () => void; isPaused: () => boolean; setSpeed: (s: number) => void; seek: (p: number) => void } | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);

  // Deterministic timeline — only recomputes when match data changes
  const timeline = useMemo(
    () => generateTimeline({
      homeGoals, awayGoals, seed,
      homePower: homePower || undefined,
      awayPower: awayPower || undefined,
      homeStats,
      awayStats,
      homeFormation,
      awayFormation,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homeGoals, awayGoals, seed, homePower, awayPower],
  );

  // Initialize PixiJS renderer (dynamic import to avoid SSR crash)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;

    (async () => {
      // Dynamic import — only loads PixiJS in the browser
      const { PixiMatchRenderer } = await import('@/lib/fc/PixiMatchRenderer');

      if (destroyed) return;

      // Build NFT identity arrays if player IDs provided
      let nftHome: { tokenId: number; stats: { speed: number; passing: number; shooting: number; defense: number; stamina: number }; tier: 'bronze' | 'silver' | 'gold' | 'diamond' }[] | undefined;
      let nftAway: typeof nftHome;

      if (homePlayerIds?.length === 5 && homeStats?.length === 5) {
        nftHome = homePlayerIds.map((id, i) => {
          const s = homeStats[i];
          const avg = (s.speed + s.passing + s.shooting + s.defense + s.stamina) / 5;
          const tier = avg >= 80 ? 'diamond' as const : avg >= 60 ? 'gold' as const : avg >= 40 ? 'silver' as const : 'bronze' as const;
          return { tokenId: id, stats: s, tier };
        });
      }
      if (awayPlayerIds?.length === 5 && awayStats?.length === 5) {
        nftAway = awayPlayerIds.map((id, i) => {
          const s = awayStats[i];
          const avg = (s.speed + s.passing + s.shooting + s.defense + s.stamina) / 5;
          const tier = avg >= 80 ? 'diamond' as const : avg >= 60 ? 'gold' as const : avg >= 40 ? 'silver' as const : 'bronze' as const;
          return { tokenId: id, stats: s, tier };
        });
      }

      const renderer = new PixiMatchRenderer(timeline, undefined, homePower ?? 0, awayPower ?? 0, nftHome, nftAway);
      rendererRef.current = renderer;

      await renderer.init(canvas, width, height, () => setIsFinished(true));
      if (!destroyed) setLoading(false);
    })();

    return () => {
      destroyed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [timeline, homePower, awayPower, width, height]);

  // Play/Pause
  const handleTogglePause = useCallback(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.togglePause();
    setIsPaused(r.isPaused());
  }, []);

  // Speed control
  const handleSpeed = useCallback((s: number) => {
    const r = rendererRef.current;
    if (!r) return;
    r.setSpeed(s);
    setSpeed(s);
  }, []);

  // Replay
  const handleReplay = useCallback(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.seek(0);
    setIsFinished(false);
    if (r.isPaused()) {
      r.togglePause();
      setIsPaused(false);
    }
  }, []);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1a0a] rounded-lg border border-white/10">
          <span className="text-white/40 text-sm font-mono">Loading match...</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full rounded-lg border border-white/10"
      />

      {/* Replay Controls */}
      <div className="flex items-center justify-center gap-2 mt-2">
        {/* Play/Pause */}
        <button
          onClick={handleTogglePause}
          className="px-2 py-1 text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors"
          title={isPaused ? 'Play' : 'Pause'}
        >
          {isPaused ? '\u25B6' : '\u275A\u275A'}
        </button>

        {/* Speed buttons */}
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            onClick={() => handleSpeed(s)}
            className={`px-2 py-1 text-xs font-mono border rounded transition-colors ${
              speed === s
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/60'
            }`}
          >
            {s}x
          </button>
        ))}

        {/* Replay */}
        {isFinished && (
          <button
            onClick={handleReplay}
            className="px-2 py-1 text-xs font-mono bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded transition-colors"
          >
            Replay
          </button>
        )}
      </div>
    </div>
  );
}
