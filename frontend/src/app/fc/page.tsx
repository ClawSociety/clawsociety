'use client';

import Image from 'next/image';
import Link from 'next/link';
import { PitchCanvas } from '@/components/fc/PitchCanvas';
import { FCPanel } from '@/components/fc/FCPanel';

// ---------------------------------------------------------------------------
// Demo match constants (same as /fc/demo)
// ---------------------------------------------------------------------------

const DEMO_STATS = [
  { speed: 75, passing: 60, shooting: 45, defense: 80, stamina: 70 },
  { speed: 55, passing: 65, shooting: 30, defense: 85, stamina: 75 },
  { speed: 60, passing: 70, shooting: 35, defense: 78, stamina: 72 },
  { speed: 80, passing: 82, shooting: 65, defense: 40, stamina: 68 },
  { speed: 88, passing: 55, shooting: 92, defense: 25, stamina: 60 },
];

const DEMO_STATS_AWAY = [
  { speed: 70, passing: 55, shooting: 40, defense: 82, stamina: 74 },
  { speed: 50, passing: 68, shooting: 28, defense: 88, stamina: 78 },
  { speed: 58, passing: 72, shooting: 32, defense: 75, stamina: 70 },
  { speed: 85, passing: 78, shooting: 70, defense: 38, stamina: 65 },
  { speed: 90, passing: 50, shooting: 88, defense: 22, stamina: 58 },
];

// ---------------------------------------------------------------------------
// Rule card component
// ---------------------------------------------------------------------------

function RuleCard({
  title,
  accent,
  icon,
  children,
}: {
  title: string;
  accent: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border bg-white/[0.02] p-5"
      style={{ borderColor: `${accent}22` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h3
          className="font-mono text-xs font-bold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {title}
        </h3>
      </div>
      <div className="mt-3 font-mono text-xs leading-relaxed text-gray-400">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FCPage() {
  return (
    <div className="relative z-10 flex flex-1 flex-col">
      {/* ── Hero ── */}
      <section className="relative flex h-[300px] items-center justify-center overflow-hidden bg-[#0a0a0a]">
        <Image
          src="/images/fc-hero.png"
          alt="Pixel art football match"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.5) 40%, rgba(10,10,10,0.95) 100%)',
          }}
        />
        <div className="relative z-10 flex flex-col items-center px-4 text-center">
          <Image
            src="/images/claw-fc-logo.png"
            alt="Claw FC logo"
            width={120}
            height={120}
            className="object-contain drop-shadow-[0_0_24px_rgba(0,255,255,0.4)]"
          />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <p className="font-mono text-sm uppercase tracking-[0.15em] text-white/50">
              Player-Centric 5v5 On-Chain Football
            </p>
            <span className="rounded border border-[#00ffff]/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#00ffff]">
              Alpha
            </span>
            <span className="rounded border border-[#ffd700]/40 bg-[#ffd700]/5 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#ffd700]">
              Season 01
            </span>
          </div>
          <p className="mt-2 font-mono text-xs text-gray-400">
            Build squads. Pick formations. Earn ETH.
          </p>
        </div>
        {/* Bottom fade for smooth transition */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
      </section>

      {/* ── Live Demo Match ── */}
      <section className="mx-auto w-full max-w-[680px] px-4 py-10">
        <h2
          className="mb-1 text-center font-mono text-xs font-bold uppercase tracking-[0.3em]"
          style={{ color: '#00ffff' }}
        >
          Watch a Match
        </h2>
        <p className="mb-5 text-center font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Deterministic match engine &bull; Every match replayable
        </p>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <PitchCanvas
            homeGoals={3}
            awayGoals={2}
            seed={420691337n}
            homePower={340}
            awayPower={320}
            homeStats={DEMO_STATS}
            awayStats={DEMO_STATS_AWAY}
            homePlayerIds={[101, 102, 103, 104, 105]}
            awayPlayerIds={[201, 202, 203, 204, 205]}
            width={640}
            height={420}
          />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-12">
        <h2 className="mb-8 text-center font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/30">
          How It Works
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RuleCard title="5 Player Stats" accent="#00ffff" icon="&#x2B50;">
            <p>
              <strong className="text-white/70">SPD</strong>,{' '}
              <strong className="text-white/70">PAS</strong>,{' '}
              <strong className="text-white/70">SHO</strong>,{' '}
              <strong className="text-white/70">DEF</strong>,{' '}
              <strong className="text-white/70">STA</strong> &mdash; each rated 0-100, immutable on mint.
            </p>
            <p className="mt-2">
              Each stat has different weight depending on position.
              Place your best shooters as forwards and your best defenders at the back.
            </p>
          </RuleCard>

          <RuleCard title="Formation RPS" accent="#ff44ff" icon="&#x1F504;">
            <p>Rock-paper-scissors formation meta:</p>
            <div
              className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-black/30 p-3 font-mono text-[11px]"
            >
              <span style={{ color: '#ff4444' }}>OFF</span>
              <span className="text-white/30">&gt;</span>
              <span style={{ color: '#44ff44' }}>BAL</span>
              <span className="text-white/30">&gt;</span>
              <span style={{ color: '#4488ff' }}>DEF</span>
              <span className="text-white/30">&gt;</span>
              <span style={{ color: '#ff4444' }}>OFF</span>
            </div>
            <p className="mt-2">Counter bonus: <strong className="text-white/70">+5%</strong> power.</p>
          </RuleCard>

          <RuleCard title="ETH Rewards" accent="#00ff88" icon="&#x1F4B0;">
            <p>Ranked matches: both players stake ETH.</p>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full" style={{ background: '#00ff88' }} />
                <span className="text-[10px] text-white/50">65% winner</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-[46%] rounded-full" style={{ background: '#00ffff' }} />
                <span className="text-[10px] text-white/50">30% loser</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-[8%] rounded-full" style={{ background: '#8855ff' }} />
                <span className="text-[10px] text-white/50">5% protocol</span>
              </div>
            </div>
            <p className="mt-2">Break-even at ~<strong className="text-white/70">57%</strong> win rate.</p>
          </RuleCard>

          <RuleCard title="5v5 Positions" accent="#ffd700" icon="&#x26BD;">
            <p>Each position weights stats differently:</p>
            <div className="mt-2 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-white/60">GK</span>
                <span>DEF <strong className="text-white/70">40%</strong></span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">DEF</span>
                <span>DEF <strong className="text-white/70">35%</strong></span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">MID</span>
                <span>PAS <strong className="text-white/70">30%</strong></span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">FWD</span>
                <span>SHO <strong className="text-white/70">35%</strong></span>
              </div>
            </div>
          </RuleCard>

          <RuleCard title="On-Chain Fair" accent="#8855ff" icon="&#x1F3B2;">
            <p>
              VRF-seeded randomness. Poisson goal model (max 6 goals/team).
              &plusmn;8% noise on attack <em>and</em> defense.
            </p>
            <p className="mt-2">
              Every match is <strong className="text-white/70">provably fair</strong> and{' '}
              <strong className="text-white/70">fully replayable</strong> from on-chain data.
            </p>
          </RuleCard>

          <RuleCard title="Get Started" accent="#ff8855" icon="&#x1F680;">
            <p>
              Open a lootbox to mint <strong className="text-white/70">5 NFT players</strong>.
              Build your squad, pick a formation, stake ETH or play friendly.
            </p>
            <Link
              href="#panel"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#ff8855]/30 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ff8855] transition-all hover:bg-[#ff8855]/10"
            >
              Start Playing <span aria-hidden="true">&darr;</span>
            </Link>
          </RuleCard>
        </div>
      </section>

      {/* ── FCPanel ── */}
      <section id="panel" className="mx-auto w-full max-w-3xl px-4 pb-8">
        <FCPanel />
      </section>
    </div>
  );
}
