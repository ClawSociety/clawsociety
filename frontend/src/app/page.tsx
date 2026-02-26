'use client';

import Link from 'next/link';
import { useGridState } from '@/hooks/useGridState';
import { useCloudFCMatches } from '@/hooks/useCloudFC';
import { TotalDistributed } from '@/components/ui/TotalDistributed';
import { TokenAddress, SOCIETY_TOKEN } from '@/components/ui/TokenAddress';
import { ZERO_ADDRESS } from '@/lib/utils';

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-[#0d0d1a] p-4 text-center"
      style={{ boxShadow: `0 0 20px ${color}08` }}
    >
      <div
        className="font-mono text-2xl font-bold tabular-nums"
        style={{ color, textShadow: `0 0 12px ${color}55` }}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-500">
        {label}
      </div>
    </div>
  );
}

function GameCard({
  title,
  description,
  href,
  accent,
  stats,
  comingSoon,
}: {
  title: string;
  description: string;
  href?: string;
  accent: string;
  stats?: { label: string; value: string }[];
  comingSoon?: boolean;
}) {
  const content = (
    <div
      className={`group rounded-xl border bg-[#0d0d1a] p-5 transition-all ${
        comingSoon
          ? 'border-white/5 opacity-50'
          : 'border-white/10 hover:border-opacity-60 cursor-pointer'
      }`}
      style={{
        borderColor: comingSoon ? undefined : `${accent}33`,
        boxShadow: comingSoon ? 'none' : `0 0 30px ${accent}08`,
      }}
    >
      <h3
        className="font-mono text-sm font-bold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {title}
      </h3>
      <p className="mt-2 font-mono text-xs text-gray-400 leading-relaxed">
        {description}
      </p>

      {stats && stats.length > 0 && (
        <div className="mt-3 flex gap-4">
          {stats.map((s) => (
            <div key={s.label}>
              <span className="font-mono text-xs font-bold text-white">{s.value}</span>
              <span className="ml-1 font-mono text-[10px] text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {!comingSoon && (
        <div
          className="mt-3 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors"
          style={{ color: `${accent}88` }}
        >
          Play Now &rarr;
        </div>
      )}

      {comingSoon && (
        <div className="mt-3 font-mono text-[10px] font-bold uppercase tracking-widest text-gray-600">
          Coming Soon
        </div>
      )}
    </div>
  );

  if (href && !comingSoon) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export default function PortalPage() {
  const { seats } = useGridState();
  const { total: totalMatches } = useCloudFCMatches();

  const seatsClaimed = seats.filter((s) => s.holder !== ZERO_ADDRESS).length;
  const uniqueHolders = new Set(
    seats
      .filter((s) => s.holder !== ZERO_ADDRESS)
      .map((s) => s.holder.toLowerCase())
  ).size;

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <div className="px-4 py-8 text-center sm:px-6 sm:py-12">
        <p
          className="font-mono text-xs uppercase tracking-[0.3em]"
          style={{ color: 'rgba(160,160,200,0.5)' }}
        >
          Multi-Game Ecosystem on Base
        </p>
        <h2
          className="mt-2 font-mono text-lg font-bold uppercase tracking-widest sm:text-xl"
          style={{ color: '#00ff88' }}
        >
          One Community. Multiple Games. Shared Economy.
        </h2>
      </div>

      {/* Ecosystem Stats */}
      <div className="px-4 sm:px-6">
        <TotalDistributed />
      </div>

      <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-3 px-4 pb-6 sm:grid-cols-3 sm:px-6">
        <StatCard label="Seats Claimed" value={`${seatsClaimed}/100`} color="#00ff88" />
        <StatCard label="Seat Holders" value={String(uniqueHolders)} color="#00ffff" />
        <StatCard label="FC Matches" value={String(totalMatches)} color="#ff44ff" />
      </div>

      {/* Game Cards */}
      <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 pb-6 sm:grid-cols-2 sm:px-6">
        <GameCard
          title="Society Grid"
          description="100 Harberger-taxed seats earning ETH from every $SOCIETY trade. Claim tiles, set prices, collect fees."
          href="/society"
          accent="#00ff88"
          stats={[
            { label: 'seats', value: `${seatsClaimed}/100` },
            { label: 'holders', value: String(uniqueHolders) },
          ]}
        />
        <GameCard
          title="Claw FC"
          description="Player-Centric 5v5 on-chain football. Build squads, challenge opponents, earn ETH rewards."
          href="/fc"
          accent="#00ffff"
          stats={[
            { label: 'matches', value: String(totalMatches) },
          ]}
        />
        <GameCard
          title="Agent Royale"
          description="AI-powered battle royale. Deploy agents, compete in arenas, survive to earn."
          accent="#ff8855"
          comingSoon
        />
        <GameCard
          title="More Games"
          description="The Claw Society ecosystem is expanding. New game modules plug into the shared economy."
          accent="#8855ff"
          comingSoon
        />
      </div>

      {/* DexScreener Chart + Token Address */}
      <div className="px-4 pb-6 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-white/10 bg-[#0d0d1a] p-4">
          <h3
            className="mb-3 font-mono text-xs font-bold uppercase tracking-widest"
            style={{ color: '#00ffff' }}
          >
            $SOCIETY Chart
          </h3>
          <div
            className="overflow-hidden rounded-lg"
            style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}
          >
            <iframe
              src={`https://dexscreener.com/base/${SOCIETY_TOKEN}?embed=1&theme=dark&info=0`}
              title="$SOCIETY DexScreener Chart"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              allow="clipboard-write"
            />
          </div>
          <TokenAddress />
        </div>
      </div>
    </div>
  );
}
