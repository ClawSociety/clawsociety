'use client';

import { useState, useMemo } from 'react';
import {
  PLAYER_NAMES,
  TIER_COLORS,
  TIER_LABELS,
  TIER_STARS,
  type Tier,
} from '@/lib/fc/playerNames';

// ─────────────────── Constants ───────────────────────────────

const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'diamond'];

type FilterTab = 'all' | Tier;

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'bronze', label: 'BRONZE' },
  { id: 'silver', label: 'SILVER' },
  { id: 'gold', label: 'GOLD' },
  { id: 'diamond', label: 'DIAMOND' },
];

const TIER_STAT_RANGES: Record<Tier, { min: number; max: number }> = {
  bronze:  { min: 25, max: 55 },
  silver:  { min: 45, max: 75 },
  gold:    { min: 65, max: 90 },
  diamond: { min: 80, max: 100 },
};

const TIER_DROP_RATES: Record<Tier, number> = {
  bronze:  60,
  silver:  25,
  gold:    12,
  diamond: 3,
};

const STAT_LABELS: { key: string; desc: string }[] = [
  { key: 'SPD', desc: 'Speed — movement, pressing, transition' },
  { key: 'PAS', desc: 'Passing — build-up play, assist potential' },
  { key: 'SHO', desc: 'Shooting — finishing, conversion rate' },
  { key: 'DEF', desc: 'Defense — tackling, interceptions, blocking' },
  { key: 'STA', desc: 'Stamina — sustained performance over 90min' },
];

// ─────────────────── Helpers ─────────────────────────────────

function cardImageUrl(tier: Tier, index: number): string {
  return `/fc-cards/${tier}/${index}.png`;
}

function midStat(tier: Tier): number {
  const { min, max } = TIER_STAT_RANGES[tier];
  return Math.round((min + max) / 2);
}

function statColor(val: number): string {
  if (val >= 85) return '#00ff88';
  if (val >= 70) return '#00ffff';
  if (val >= 50) return '#ffd700';
  if (val >= 30) return '#ff8855';
  return '#ff0055';
}

// ─────────────────── GalleryCard ─────────────────────────────

interface GalleryCardProps {
  tier: Tier;
  index: number;
  onClick: () => void;
}

function GalleryCard({ tier, index, onClick }: GalleryCardProps) {
  const colors = TIER_COLORS[tier];
  const name = PLAYER_NAMES[tier][index];
  const imgUrl = cardImageUrl(tier, index);
  const { min, max } = TIER_STAT_RANGES[tier];
  const mid = midStat(tier);

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border-2 p-2.5 font-mono text-left transition-all duration-200 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0d0d1a]"
      style={{
        borderColor: colors.border,
        background: `linear-gradient(180deg, ${colors.bg} 0%, #0d0d1a 100%)`,
        boxShadow: `0 0 0 0 ${colors.glow}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 18px ${colors.glow}`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 transparent';
      }}
      aria-label={`View ${name} — ${TIER_LABELS[tier]} tier player card`}
    >
      {/* Card art */}
      <div
        className="mb-2 w-full overflow-hidden rounded-lg border"
        style={{ borderColor: `${colors.border}55`, aspectRatio: '3/4' }}
      >
        <img
          src={imgUrl}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={e => {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) {
              parent.innerHTML = `<div class="flex h-full w-full items-center justify-center text-4xl" style="background:${colors.bg}; color:${colors.text}">&#9917;</div>`;
            }
          }}
        />
      </div>

      {/* Tier badge */}
      <div className="mb-0.5 text-center">
        <span
          className="text-[9px] font-bold tracking-[0.18em] uppercase"
          style={{ color: colors.text }}
        >
          {TIER_STARS[tier]} {TIER_LABELS[tier]}
        </span>
      </div>

      {/* Name */}
      <div className="mb-1 text-center">
        <span className="block truncate text-[11px] font-bold text-white leading-tight">
          {name}
        </span>
      </div>

      {/* Stat range bar */}
      <div className="mt-auto">
        <div className="mb-0.5 flex items-center justify-between text-[8px] text-gray-600">
          <span>{min}</span>
          <span className="text-gray-500">STATS</span>
          <span>{max}</span>
        </div>
        <div className="h-1 w-full rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${max}%`,
              background: `linear-gradient(90deg, ${colors.border}88, ${colors.border})`,
            }}
          />
        </div>
        <div className="mt-0.5 text-center text-[8px]" style={{ color: colors.text }}>
          avg ~{mid}
        </div>
      </div>
    </button>
  );
}

// ─────────────────── CardDetailModal ─────────────────────────

interface CardDetail {
  tier: Tier;
  index: number;
}

function CardDetailModal({
  detail,
  onClose,
}: {
  detail: CardDetail;
  onClose: () => void;
}) {
  const { tier, index } = detail;
  const colors = TIER_COLORS[tier];
  const name = PLAYER_NAMES[tier][index];
  const imgUrl = cardImageUrl(tier, index);
  const { min, max } = TIER_STAT_RANGES[tier];
  const mid = midStat(tier);
  const dropRate = TIER_DROP_RATES[tier];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} card detail`}
    >
      <div
        className="relative flex w-full max-w-xs flex-col rounded-2xl border-2 p-5 font-mono"
        style={{
          borderColor: colors.border,
          background: `linear-gradient(180deg, ${colors.bg} 0%, #0d0d1a 100%)`,
          boxShadow: `0 0 40px ${colors.glow}, inset 0 0 40px ${colors.glow}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-500 hover:text-white transition-colors text-lg leading-none"
          aria-label="Close card detail"
        >
          &times;
        </button>

        {/* Tier banner */}
        <div className="mb-2 text-center">
          <span
            className="text-xs font-bold tracking-[0.2em] uppercase"
            style={{ color: colors.text }}
          >
            {TIER_STARS[tier]} {TIER_LABELS[tier]} {TIER_STARS[tier]}
          </span>
        </div>

        {/* Card art — larger */}
        <div
          className="mx-auto mb-3 w-48 overflow-hidden rounded-xl border-2"
          style={{ borderColor: colors.border, aspectRatio: '3/4' }}
        >
          <img
            src={imgUrl}
            alt={name}
            className="h-full w-full object-cover"
            onError={e => {
              const el = e.target as HTMLImageElement;
              el.style.display = 'none';
              const parent = el.parentElement;
              if (parent) {
                parent.innerHTML = `<div class="flex h-full w-full items-center justify-center text-6xl" style="background:${colors.bg}; color:${colors.text}">&#9917;</div>`;
              }
            }}
          />
        </div>

        {/* Name */}
        <div className="mb-1 text-center">
          <span className="block text-base font-black text-white tracking-wide">{name}</span>
        </div>

        {/* Card index */}
        <div className="mb-3 text-center">
          <span className="text-[9px] text-gray-600">
            CARD #{String(index).padStart(3, '0')} OF 50
          </span>
        </div>

        {/* Stat range bars */}
        <div className="mb-3 space-y-1.5">
          {STAT_LABELS.map(({ key }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-7 text-[9px] text-gray-500">{key}</span>
              <div className="relative h-2 flex-1 rounded-full bg-white/10">
                {/* min marker */}
                <div
                  className="absolute h-full rounded-full opacity-30"
                  style={{
                    left: 0,
                    width: `${min}%`,
                    backgroundColor: colors.border,
                  }}
                />
                {/* range fill */}
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    left: `${min}%`,
                    width: `${max - min}%`,
                    backgroundColor: colors.border,
                  }}
                />
              </div>
              <span
                className="w-14 text-right text-[9px]"
                style={{ color: colors.text }}
              >
                {min}–{max}
              </span>
            </div>
          ))}
        </div>

        {/* Info rows */}
        <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/30 p-2.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Avg Stat</span>
            <span style={{ color: statColor(mid) }} className="font-bold">~{mid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Drop Rate</span>
            <span style={{ color: colors.text }} className="font-bold">{dropRate}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Card Pool</span>
            <span className="text-white">50 unique</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── TierInfoBanner ──────────────────────────

function TierInfoBanner() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TIERS.map(tier => {
        const colors = TIER_COLORS[tier];
        const { min, max } = TIER_STAT_RANGES[tier];
        const rate = TIER_DROP_RATES[tier];
        return (
          <div
            key={tier}
            className="rounded-lg border p-2.5 text-center font-mono"
            style={{
              borderColor: `${colors.border}55`,
              background: colors.bg,
            }}
          >
            <div
              className="mb-0.5 text-[9px] font-bold tracking-widest uppercase"
              style={{ color: colors.text }}
            >
              {TIER_STARS[tier]} {TIER_LABELS[tier]}
            </div>
            <div className="text-xs font-black text-white">
              {min}–{max}
            </div>
            <div className="text-[9px] text-gray-500">stats</div>
            <div
              className="mt-1 text-[9px] font-bold"
              style={{ color: colors.text }}
            >
              {rate}% drop
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────── StatsLegend ─────────────────────────────

function StatsLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d1a] font-mono">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] text-gray-400 hover:text-white transition-colors"
        aria-expanded={open}
      >
        <span className="font-bold uppercase tracking-widest">Stats Legend</span>
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-white/10 px-3 pb-3 pt-2 space-y-1.5">
          {STAT_LABELS.map(({ key, desc }) => (
            <div key={key} className="flex gap-2 text-[10px]">
              <span className="w-7 shrink-0 font-bold text-cyan-400">{key}</span>
              <span className="text-gray-400">{desc}</span>
            </div>
          ))}
          <div className="mt-2 border-t border-white/10 pt-2 text-[10px] text-gray-600">
            All stats are randomly assigned within tier range at mint.
            Each card has a fixed name and art tied to its index (0–49) in the pool.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────── CardGallery (main) ──────────────────────

export function CardGallery() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [detail, setDetail] = useState<CardDetail | null>(null);

  const cards = useMemo(() => {
    const result: { tier: Tier; index: number }[] = [];
    const tiersToShow = filter === 'all' ? TIERS : [filter as Tier];
    // Diamond first in ALL view
    const ordered: Tier[] = filter === 'all'
      ? ['diamond', 'gold', 'silver', 'bronze']
      : tiersToShow;
    for (const tier of ordered) {
      for (let i = 0; i < 50; i++) {
        result.push({ tier, index: i });
      }
    }
    return result;
  }, [filter]);

  return (
    <div className="flex flex-col gap-3 font-mono">
      {/* Header */}
      <div className="rounded-xl border border-white/10 bg-[#1a1a2e] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">&#x1F3AF;</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">
              Card Catalog
            </h2>
            <p className="text-[10px] text-gray-500">
              200 unique player cards across 4 tiers
            </p>
          </div>
          <span className="ml-auto rounded bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
            {filter === 'all' ? '200 cards' : `50 cards`}
          </span>
        </div>

        {/* Tier filter tabs */}
        <div className="flex gap-1" role="tablist" aria-label="Filter by tier">
          {FILTER_TABS.map(({ id, label }) => {
            const isActive = filter === id;
            const tierColors = id !== 'all' ? TIER_COLORS[id as Tier] : null;
            const activeColor = tierColors ? tierColors.border : '#00ffff';
            const activeBg = tierColors ? tierColors.bg : 'rgba(0,255,255,0.12)';

            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(id)}
                className="flex-1 rounded py-1 text-[9px] font-bold uppercase tracking-wider transition-all duration-150"
                style={
                  isActive
                    ? {
                        color: id === 'all' ? '#0d0d1a' : activeColor,
                        background: id === 'all' ? '#00ffff' : activeBg,
                        border: `1px solid ${activeColor}`,
                        boxShadow: `0 0 8px ${activeColor}55`,
                      }
                    : {
                        color: tierColors ? tierColors.text : '#00ffff',
                        background: 'transparent',
                        border: `1px solid ${tierColors ? tierColors.border + '44' : '#00ffff33'}`,
                      }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier info banners */}
      {filter === 'all' && <TierInfoBanner />}

      {/* Single-tier summary bar */}
      {filter !== 'all' && (
        <div
          className="flex items-center gap-3 rounded-lg border px-4 py-2.5 font-mono text-xs"
          style={{
            borderColor: `${TIER_COLORS[filter as Tier].border}55`,
            background: TIER_COLORS[filter as Tier].bg,
          }}
        >
          <span
            className="font-bold uppercase tracking-widest"
            style={{ color: TIER_COLORS[filter as Tier].text }}
          >
            {TIER_STARS[filter as Tier]} {TIER_LABELS[filter as Tier]}
          </span>
          <span className="text-gray-400">
            Stats {TIER_STAT_RANGES[filter as Tier].min}–{TIER_STAT_RANGES[filter as Tier].max}
          </span>
          <span
            className="ml-auto font-bold"
            style={{ color: TIER_COLORS[filter as Tier].text }}
          >
            {TIER_DROP_RATES[filter as Tier]}% drop rate
          </span>
        </div>
      )}

      {/* Card grid */}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        }}
        role="list"
        aria-label="Player card gallery"
      >
        {cards.map(({ tier, index }) => (
          <div key={`${tier}-${index}`} role="listitem">
            <GalleryCard
              tier={tier}
              index={index}
              onClick={() => setDetail({ tier, index })}
            />
          </div>
        ))}
      </div>

      {/* Stats legend (collapsible) */}
      <StatsLegend />

      {/* Detail modal */}
      {detail && (
        <CardDetailModal
          detail={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
