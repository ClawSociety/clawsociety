'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEcosystemStats } from '@/hooks/useEcosystemStats';
import { TotalDistributed } from '@/components/ui/TotalDistributed';
import { TokenAddress, SOCIETY_TOKEN } from '@/components/ui/TokenAddress';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBlock({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="font-mono text-3xl font-bold tabular-nums sm:text-4xl"
        style={{ color, textShadow: `0 0 20px ${color}44` }}
      >
        {value}
      </span>
      <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">
        {label}
      </span>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm"
      style={{ borderColor: `${accent}22` }}
    >
      <h3
        className="font-mono text-xs font-bold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {title}
      </h3>
      <p className="mt-2 font-mono text-xs leading-relaxed text-gray-400">
        {description}
      </p>
    </div>
  );
}

function GameShowcase({
  title,
  description,
  imageSrc,
  imageAlt,
  href,
  accent,
  reverse,
  comingSoon,
  alpha,
  logoSrc,
  stats,
}: {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  href?: string;
  accent: string;
  reverse?: boolean;
  comingSoon?: boolean;
  alpha?: boolean;
  logoSrc?: string;
  stats?: { label: string; value: string }[];
}) {
  const imageBlock = (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10">
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
      {logoSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Image
            src={logoSrc}
            alt={`${title} logo`}
            width={160}
            height={160}
            className="object-contain drop-shadow-[0_0_20px_rgba(0,255,255,0.4)]"
          />
        </div>
      )}
      {comingSoon && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <span className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-white/60">
            Coming Soon
          </span>
        </div>
      )}
    </div>
  );

  const textBlock = (
    <div className="flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <h3
          className="font-mono text-lg font-bold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {title}
        </h3>
        {alpha && (
          <span
            className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest"
            style={{ borderColor: `${accent}44`, color: accent }}
          >
            Alpha
          </span>
        )}
      </div>
      <p className="mt-3 font-mono text-sm leading-relaxed text-gray-400">
        {description}
      </p>
      {stats && stats.length > 0 && (
        <div className="mt-4 flex gap-6">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-bold text-white">{s.value}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
      {href && !comingSoon && (
        <Link
          href={href}
          className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-[#0a0a0a] transition-all hover:brightness-110"
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 16px ${accent}44`,
          }}
        >
          Play Now
          <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </div>
  );

  return (
    <div
      className={`grid gap-6 md:grid-cols-2 md:gap-10 ${
        reverse ? 'md:[&>*:first-child]:order-2' : ''
      }`}
    >
      {imageBlock}
      {textBlock}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalPage() {
  const { seatsClaimed, uniqueHolders, totalMatches } = useEcosystemStats();

  return (
    <div className="flex flex-1 flex-col">
      {/* ── Hero Banner ── */}
      <section className="relative flex h-[70vh] max-h-[600px] items-center justify-center overflow-hidden bg-[#0a0a0a]">
        <Image
          src="/images/hero-banner.png"
          alt="Cyberpunk cityscape"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Gradient overlays — heavy darken for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.82) 35%, rgba(10,10,10,0.80) 65%, rgba(10,10,10,1) 100%)',
          }}
        />

        <div className="relative z-10 flex flex-col items-center px-4 text-center">
          <h1
            className="font-mono text-4xl font-extrabold uppercase tracking-[0.2em] sm:text-5xl md:text-6xl"
            style={{
              color: '#00ff88',
              textShadow: '0 0 40px rgba(0,255,136,0.4), 0 0 80px rgba(0,255,136,0.15)',
            }}
          >
            Claw Society
          </h1>
          <p className="mt-3 font-mono text-sm font-semibold uppercase tracking-[0.25em] text-white/80 sm:text-base"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
          >
            Multi-Game Ecosystem on Base
          </p>
          <p className="mx-auto mt-4 max-w-lg font-mono text-xs leading-relaxed text-gray-200/80 sm:text-sm"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
          >
            100 Harberger-taxed seats. 5v5 on-chain football. AI battle royale.
            One token economy connecting every game.
          </p>

          {/* CTAs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/society"
              className="rounded-lg bg-[#00ff88] px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-[#0a0a0a] shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all hover:bg-[#33ffaa] hover:shadow-[0_0_30px_rgba(0,255,136,0.5)]"
            >
              Enter Portal
            </Link>
            <a
              href={`https://dexscreener.com/base/${SOCIETY_TOKEN}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border-2 border-white/30 bg-white/10 px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/20"
            >
              Buy $SOCIETY
            </a>
          </div>

          {/* Contract address */}
          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">CA:</span>
            <code
              className="font-mono text-[11px] font-bold tracking-wide"
              style={{ color: '#00ff88', textShadow: '0 0 10px rgba(0,255,136,0.3)' }}
            >
              {SOCIETY_TOKEN}
            </code>
          </div>

          {/* Total Distributed inline */}
          <div className="mt-3 w-full max-w-xl">
            <TotalDistributed />
          </div>
        </div>
      </section>

      {/* ── What is Claw Society? ── */}
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <h2 className="text-center font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/30">
          What is Claw Society?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center font-mono text-sm leading-relaxed text-gray-400">
          A decentralized gaming ecosystem where every game shares the same token economy.
          Hold seats, build squads, deploy agents — and earn real ETH from the $SOCIETY token&apos;s trading fees.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            title="$SOCIETY Token"
            description="A Flaunch-deployed token on Base. Every buy & sell generates trading fees that flow back to seat holders."
            accent="#00ff88"
          />
          <FeatureCard
            title="Earn ETH"
            description="100 Harberger-taxed seats split trading fees in real-time. Set your price, pay your tax, collect your share."
            accent="#00ffff"
          />
          <FeatureCard
            title="Multiple Games"
            description="Society Grid, Claw FC, Agent Royale — each game plugs into the shared economy. More games, more value."
            accent="#ff44ff"
          />
        </div>
      </section>

      {/* ── Ecosystem Stats ── */}
      <section
        className="border-y border-white/5 py-10"
        style={{
          background:
            'linear-gradient(135deg, rgba(0,255,136,0.03) 0%, rgba(0,255,255,0.02) 50%, rgba(255,68,255,0.02) 100%)',
        }}
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-10 px-4 sm:gap-16">
          <StatBlock value={`${seatsClaimed}/100`} label="Seats Claimed" color="#00ff88" />
          <StatBlock value={String(uniqueHolders)} label="Seat Holders" color="#00ffff" />
          <StatBlock value={String(totalMatches)} label="FC Matches" color="#ff44ff" />
        </div>
      </section>

      {/* ── Games Showcase ── */}
      <section className="mx-auto w-full max-w-5xl space-y-14 px-4 py-14 sm:px-6">
        <h2 className="text-center font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/30">
          The Games
        </h2>

        <GameShowcase
          title="Society Grid"
          description="A 10x10 cyberpunk city grid with 100 Harberger-taxed seats. Each tile represents a building type — from Server Farms to Parks. Claim a seat, set your price, and earn a share of every $SOCIETY trade. Higher-value tiles at the center earn more. Anyone can buy your seat at any time by paying a 20% buyout fee."
          imageSrc="/images/grid-illustration.png"
          imageAlt="Isometric cyberpunk city grid"
          href="/society"
          accent="#00ff88"
          alpha
          stats={[
            { label: 'seats', value: `${seatsClaimed}/100` },
            { label: 'holders', value: String(uniqueHolders) },
          ]}
        />

        <GameShowcase
          title="Claw FC"
          description="Player-centric 5v5 on-chain football. Open lootboxes to mint NFT players with unique stats. Build your squad, pick a formation, and challenge opponents. Matches are deterministic and fully replayable — powered by a Poisson goal model with VRF fairness. Winners earn 65% of the pot."
          imageSrc="/images/fc-hero.png"
          imageAlt="Pixel art football match"
          href="/fc"
          accent="#00ffff"
          reverse
          alpha
          logoSrc="/images/claw-fc-logo.png"
          stats={[{ label: 'matches played', value: String(totalMatches) }]}
        />

        <GameShowcase
          title="Agent Royale"
          description="AI-powered battle royale. Deploy autonomous agents into arenas, watch them battle with Chainlink VRF randomness, earn ETH. Part of the Claw Society ecosystem."
          imageSrc="/images/royale-hero.png"
          imageAlt="Agent Royale battle arena"
          href="/royale"
          accent="#ff8855"
          alpha
        />
      </section>

      {/* ── Agent Royale Featured Banner ── */}
      <section
        className="relative overflow-hidden border-y py-12 sm:py-16"
        style={{
          borderColor: 'rgba(255,136,85,0.2)',
          background: 'linear-gradient(135deg, rgba(255,136,85,0.08) 0%, rgba(10,10,26,1) 40%, rgba(10,10,26,1) 60%, rgba(139,92,246,0.06) 100%)',
        }}
      >
        {/* Glow accents */}
        <div className="pointer-events-none absolute -left-32 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(255,136,85,0.4) 0%, transparent 70%)' }}
        />
        <div className="pointer-events-none absolute -right-32 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 sm:flex-row sm:gap-10 sm:px-6">
          {/* Image */}
          <div className="relative aspect-video w-full max-w-md shrink-0 overflow-hidden rounded-xl border border-[#ff8855]/20 sm:w-[45%]">
            <Image
              src="/images/royale-hero.png"
              alt="Agent Royale battle arena"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 45vw"
            />
          </div>

          {/* Text */}
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest"
                style={{
                  background: 'rgba(255,136,85,0.15)',
                  border: '1px solid rgba(255,136,85,0.4)',
                  color: '#ff8855',
                }}
              >
                New Franchise
              </span>
              <span
                className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest"
                style={{ borderColor: 'rgba(255,136,85,0.3)', color: '#ff8855' }}
              >
                Alpha
              </span>
            </div>
            <h3
              className="mt-3 font-mono text-2xl font-extrabold uppercase tracking-widest sm:text-3xl"
              style={{ color: '#ff8855', textShadow: '0 0 30px rgba(255,136,85,0.3)' }}
            >
              Agent Royale
            </h3>
            <p className="mt-2 max-w-md font-mono text-sm leading-relaxed text-gray-400">
              AI-powered battle royale on Base. Deploy autonomous agents, watch them fight with Chainlink VRF randomness, and claim ETH prizes. The newest game in the Claw Society ecosystem.
            </p>
            <Link
              href="/royale"
              className="mt-5 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-[#0a0a0a] transition-all hover:brightness-110"
              style={{
                backgroundColor: '#ff8855',
                boxShadow: '0 0 20px rgba(255,136,85,0.35)',
              }}
            >
              Enter Arena
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Token Economy ── */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-10 sm:px-6">
        <h2 className="text-center font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/30">
          Token Economy
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center font-mono text-xs leading-relaxed text-gray-500">
          $SOCIETY is deployed via Flaunch on Base. Trading fees flow to the 100 seat holders
          proportionally. Harberger taxation ensures seats circulate — set your price too high and
          your tax drains your deposit. Set it too low and someone buys you out.
        </p>

        {/* DexScreener Chart */}
        <div className="mt-8 rounded-xl border border-white/10 bg-[#0d0d1a] p-4">
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
      </section>

      {/* ── CTA Footer ── */}
      <section
        className="border-t border-white/5 py-10"
        style={{
          background:
            'linear-gradient(to top, rgba(0,255,136,0.04) 0%, transparent 100%)',
        }}
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 px-4">
          <Link
            href="/society"
            className="rounded-lg bg-[#00ff88] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-[#0a0a0a] shadow-[0_0_16px_rgba(0,255,136,0.3)] transition-all hover:bg-[#33ffaa]"
          >
            Claim a Seat
          </Link>
          <Link
            href="/fc"
            className="rounded-lg bg-[#00ffff] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-[#0a0a0a] shadow-[0_0_16px_rgba(0,255,255,0.3)] transition-all hover:bg-[#44ffff]"
          >
            Open a Pack
          </Link>
          <a
            href="https://t.me/clawsociety"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border-2 border-white/30 bg-white/10 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/20"
          >
            Join Telegram
          </a>
        </div>
      </section>
    </div>
  );
}
