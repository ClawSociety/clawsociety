'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useMyPlayers } from '@/hooks/useCloudFC';
import type { PlayerStats, CloudFCPlayer } from '@/lib/fc/types';
import type { PlayerAppearance } from '@/lib/fc/players/PlayerFactory';
import { playerTier, TIER_COLORS } from '@/lib/fc/playerNames';
import { bakeFrame, buildMaterialMap, SPRITE_W, SPRITE_H } from '@/lib/fc/players/PlayerSpriteBuilder';
import { IDLE_FRAMES } from '@/lib/fc/players/poses';
import { renderCard } from '@/lib/fc/players/CardRenderer';
import { downloadCard } from '@/lib/fc/players/CardExporter';
import { PixelCard } from './PixelCard';
import { ColorSwatchPicker } from './ColorSwatchPicker';

// ─────────────────── Constants ───────────────────────────────

const SKIN_TONES = [0xf5d0a9, 0xddb58a, 0xc49e6c, 0x8b6914, 0x5c3317];
const HAIR_COLORS = [0x1a1a1a, 0x4a3520, 0xc9a94e, 0x8b2500, 0x6e4b2a];
const JERSEY_PRESETS = [0x00ffff, 0xff0055, 0x0055ff, 0x00ff88, 0xffd700, 0xff8855, 0x8855ff, 0xffffff];
const HAIR_LABELS = ['Buzz', 'Short', 'Mohawk', 'Swept', 'Afro', 'Bald', 'Dreads', 'Topknot', 'Fauxhawk', 'Curtains'];
const FACE_LABELS = ['Default', 'Narrow', 'Happy', 'Tough', 'Calm', 'Intense', 'Scowl', 'Scar'];
const BUILD_LABELS = ['Slim', 'Normal', 'Stocky'];
const ACCESSORY_LABELS = ['None', 'Headband', 'Wristband', 'Captain', 'Goggles'];

// ─────────────────── Helpers ────────────────────────────────

function avgStat(stats: PlayerStats): number {
  return Math.round(
    (stats.speed + stats.passing + stats.shooting + stats.defense + stats.stamina) / 5,
  );
}

function randomAppearance(): PlayerAppearance {
  return {
    skinTone: SKIN_TONES[Math.floor(Math.random() * 5)],
    hairType: Math.floor(Math.random() * 10),
    hairColor: HAIR_COLORS[Math.floor(Math.random() * 5)],
    heightRatio: 0.9 + Math.random() * 0.2,
    jerseyColor: JERSEY_PRESETS[Math.floor(Math.random() * JERSEY_PRESETS.length)],
    shortsColor: JERSEY_PRESETS[Math.floor(Math.random() * JERSEY_PRESETS.length)],
    socksColor: 0xffffff,
    bootsColor: 0x111111,
    number: Math.floor(Math.random() * 99) + 1,
    isGK: false,
    buildType: Math.floor(Math.random() * 3),
    faceType: Math.floor(Math.random() * 8),
    accessory: Math.floor(Math.random() * 4),
    sleeveStyle: Math.floor(Math.random() * 2),
  };
}

// ─────────────────── My Cards Mode ──────────────────────────

function MyCards({ onGoToPacks }: { onGoToPacks?: () => void }) {
  const { address } = useAccount();
  const { players: myPlayers } = useMyPlayers(address);
  const [selectedPlayer, setSelectedPlayer] = useState<CloudFCPlayer | null>(null);

  if (!address) {
    return <p className="text-xs text-gray-500">Connect wallet to see your cards.</p>;
  }

  if (myPlayers.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="mb-2 text-sm text-gray-400">No players yet.</p>
        <p className="mb-4 text-xs text-gray-600">Open packs to get players!</p>
        {onGoToPacks && (
          <button
            onClick={onGoToPacks}
            className="rounded bg-cyan-500 px-4 py-2 text-xs font-bold uppercase text-black hover:bg-cyan-400"
          >
            Open a Pack
          </button>
        )}
      </div>
    );
  }

  const sorted = [...myPlayers].sort((a, b) => avgStat(b.stats) - avgStat(a.stats));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map(player => (
          <PixelCard
            key={player.id}
            tokenId={player.id}
            stats={player.stats}
            width={160}
            className="rounded-lg transition-transform hover:scale-[1.03]"
            onClick={() => setSelectedPlayer(player)}
          />
        ))}
      </div>

      {/* Full-size modal */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setSelectedPlayer(null)}
        >
          <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <PixelCard
              tokenId={selectedPlayer.id}
              stats={selectedPlayer.stats}
              width={300}
            />
            <div className="flex gap-2">
              <button
                onClick={() => downloadCard(selectedPlayer.id, selectedPlayer.stats)}
                className="rounded bg-cyan-500 px-4 py-2 text-xs font-bold uppercase text-black hover:bg-cyan-400"
              >
                Download PNG
              </button>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="rounded border border-white/20 px-4 py-2 text-xs text-gray-400 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────── Sandbox Mode ───────────────────────────

function Sandbox() {
  const spriteCanvasRef = useRef<HTMLCanvasElement>(null);
  const cardCanvasRef = useRef<HTMLCanvasElement>(null);
  const [app, setApp] = useState<PlayerAppearance>(randomAppearance);

  const updateApp = useCallback((patch: Partial<PlayerAppearance>) => {
    setApp(prev => ({ ...prev, ...patch }));
  }, []);

  // Draw live sprite preview
  useEffect(() => {
    const canvas = spriteCanvasRef.current;
    if (!canvas) return;

    const materialMap = buildMaterialMap(app);
    const sprite = bakeFrame(app, IDLE_FRAMES[0], materialMap);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = SPRITE_W * 8;
    canvas.height = SPRITE_H * 8;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, 0, 0, SPRITE_W * 8, SPRITE_H * 8);
  }, [app]);

  // Draw card preview
  useEffect(() => {
    const canvas = cardCanvasRef.current;
    if (!canvas) return;

    const stats: PlayerStats = { speed: 75, passing: 70, shooting: 80, defense: 60, stamina: 65 };
    const avg = avgStat(stats);
    const tier = playerTier(avg);
    const name = 'Preview Player';
    const offscreen = renderCard(0, stats, tier, name);

    // Override the portrait portion by re-rendering with our custom appearance
    const ctx2d = offscreen.getContext('2d')!;
    const materialMap = buildMaterialMap(app);
    const sprite = bakeFrame(app, IDLE_FRAMES[0], materialMap);

    // Draw glow
    const glowGrad = ctx2d.createRadialGradient(180, 180, 30, 180, 180, 140);
    const colors = TIER_COLORS[tier];
    glowGrad.addColorStop(0, colors.glow);
    glowGrad.addColorStop(1, 'transparent');
    ctx2d.fillStyle = glowGrad;
    ctx2d.fillRect(60, 50, 240, 256);

    // Overdraw portrait
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.drawImage(sprite, (360 - 192) / 2, 50, 192, 256);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 360;
    canvas.height = 504;
    ctx.drawImage(offscreen, 0, 0);
  }, [app]);

  const handleRandomize = () => setApp(randomAppearance());

  const handleDownloadCard = async () => {
    const canvas = cardCanvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudfc-custom-${app.number}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Preview column */}
      <div className="flex flex-col items-center gap-3">
        <canvas
          ref={spriteCanvasRef}
          className="rounded-lg border border-white/10 bg-[#1a1a2e]"
          style={{ imageRendering: 'pixelated', width: 192, height: 256 }}
        />
        <canvas
          ref={cardCanvasRef}
          className="rounded-lg"
          style={{ imageRendering: 'pixelated', width: 180, height: 252 }}
        />
        <div className="flex gap-2">
          <button
            onClick={handleRandomize}
            className="rounded border border-cyan-500/30 px-3 py-1.5 text-[10px] font-bold uppercase text-cyan-400 hover:bg-cyan-500/10"
          >
            Randomize
          </button>
          <button
            onClick={handleDownloadCard}
            className="rounded bg-cyan-500 px-3 py-1.5 text-[10px] font-bold uppercase text-black hover:bg-cyan-400"
          >
            Download Card
          </button>
        </div>
      </div>

      {/* Controls column */}
      <div className="flex-1 space-y-3">
        {/* Skin Tone */}
        <ColorSwatchPicker
          label="Skin Tone"
          colors={SKIN_TONES}
          selected={app.skinTone}
          onChange={c => updateApp({ skinTone: c })}
        />

        {/* Hair Style */}
        <div>
          <span className="mb-1 block font-mono text-[10px] text-gray-500">Hair Style</span>
          <div className="flex flex-wrap gap-1">
            {HAIR_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => updateApp({ hairType: i })}
                className={`rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  app.hairType === i
                    ? 'bg-cyan-500 font-bold text-black'
                    : 'border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Hair Color */}
        <ColorSwatchPicker
          label="Hair Color"
          colors={HAIR_COLORS}
          selected={app.hairColor}
          onChange={c => updateApp({ hairColor: c })}
        />

        {/* Build */}
        <div>
          <span className="mb-1 block font-mono text-[10px] text-gray-500">Build</span>
          <div className="flex gap-1">
            {BUILD_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => updateApp({ buildType: i })}
                className={`flex-1 rounded py-1 font-mono text-[10px] transition-colors ${
                  app.buildType === i
                    ? 'bg-cyan-500 font-bold text-black'
                    : 'border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Face */}
        <div>
          <span className="mb-1 block font-mono text-[10px] text-gray-500">Face</span>
          <div className="flex flex-wrap gap-1">
            {FACE_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => updateApp({ faceType: i })}
                className={`rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  app.faceType === i
                    ? 'bg-cyan-500 font-bold text-black'
                    : 'border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Accessory */}
        <div>
          <span className="mb-1 block font-mono text-[10px] text-gray-500">Accessory</span>
          <div className="flex flex-wrap gap-1">
            {ACCESSORY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => updateApp({ accessory: i })}
                className={`rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  app.accessory === i
                    ? 'bg-cyan-500 font-bold text-black'
                    : 'border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Jersey Color */}
        <ColorSwatchPicker
          label="Jersey Color"
          colors={JERSEY_PRESETS}
          selected={app.jerseyColor}
          onChange={c => updateApp({ jerseyColor: c })}
          showHexInput
        />

        {/* Shorts Color */}
        <ColorSwatchPicker
          label="Shorts Color"
          colors={JERSEY_PRESETS}
          selected={app.shortsColor}
          onChange={c => updateApp({ shortsColor: c })}
          showHexInput
        />

        {/* Sleeve */}
        <div>
          <span className="mb-1 block font-mono text-[10px] text-gray-500">Sleeve</span>
          <div className="flex gap-1">
            {['Short', 'Long'].map((label, i) => (
              <button
                key={i}
                onClick={() => updateApp({ sleeveStyle: i })}
                className={`flex-1 rounded py-1 font-mono text-[10px] transition-colors ${
                  app.sleeveStyle === i
                    ? 'bg-cyan-500 font-bold text-black'
                    : 'border border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Number */}
        <div>
          <span className="mb-1 block font-mono text-[10px] text-gray-500">Number</span>
          <input
            type="number"
            min={1}
            max={99}
            value={app.number}
            onChange={e => updateApp({ number: Math.max(1, Math.min(99, parseInt(e.target.value) || 1)) })}
            className="w-16 rounded border border-white/10 bg-[#0d0d1a] px-2 py-1 font-mono text-xs text-white outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Main Creator ───────────────────────────

type CreatorMode = 'cards' | 'sandbox';

export function PlayerCreator({ onGoToPacks }: { onGoToPacks?: () => void }) {
  const { address } = useAccount();
  const [mode, setMode] = useState<CreatorMode>(address ? 'cards' : 'sandbox');

  return (
    <div className="flex flex-col gap-3 font-mono">
      <div className="rounded-xl border border-white/10 bg-[#1a1a2e] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl">&#x1F3A8;</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">
              Player Creator
            </h2>
            <p className="text-[10px] text-gray-500">
              View your NFT cards or design custom players
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1">
          {([
            { id: 'cards' as CreatorMode, label: 'My Cards' },
            { id: 'sandbox' as CreatorMode, label: 'Sandbox' },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className="flex-1 rounded py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
              style={{
                color: mode === id ? '#0d0d1a' : '#00ffff',
                background: mode === id ? '#00ffff' : 'transparent',
                border: `1px solid ${mode === id ? '#00ffff' : '#00ffff33'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#0d0d1a] p-3">
        {mode === 'cards' ? (
          <MyCards onGoToPacks={onGoToPacks} />
        ) : (
          <Sandbox />
        )}
      </div>
    </div>
  );
}
