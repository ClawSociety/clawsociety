'use client';

/**
 * HowItWorks — collapsible explainer section for Claw Society.
 *
 * Usage:
 *   <HowItWorks />
 *
 * Shows a "How It Works" toggle bar. When expanded it reveals:
 *   1. What is Claw Society?
 *   2. Harberger Tax
 *   3. Building Types & Multipliers
 *   4. ETH Fee Distribution
 *   5. Buyout Mechanics
 *   6. Server Fund
 *   7. Tax Deposit System
 */

import { useState, CSSProperties } from 'react';
import { BUILDING_CONFIGS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ children, color = '#00ff88' }: { children: React.ReactNode; color?: string }) {
  return (
    <h3
      style={{
        fontSize: '0.7rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color,
        marginBottom: '8px',
      }}
    >
      {children}
    </h3>
  );
}

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '0.72rem',
        lineHeight: 1.65,
        color: 'rgba(200,200,220,0.75)',
        marginBottom: '10px',
      }}
    >
      {children}
    </p>
  );
}

function HighlightBox({
  children,
  accentColor = '#00ff88',
}: {
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div
      style={{
        background: `${accentColor}0d`,
        border: `1px solid ${accentColor}33`,
        borderRadius: '6px',
        padding: '10px 12px',
        marginBottom: '12px',
        fontSize: '0.7rem',
        lineHeight: 1.6,
        color: 'rgba(210,210,230,0.85)',
      }}
    >
      {children}
    </div>
  );
}

function InlineHighlight({ children, color = '#00ff88' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ color, fontWeight: 700 }}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Building grid
// ---------------------------------------------------------------------------

function BuildingGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '6px',
        marginBottom: '12px',
      }}
    >
      {Object.entries(BUILDING_CONFIGS)
        .sort((a, b) => b[1].multiplier - a[1].multiplier)
        .map(([typeKey, cfg]) => (
          <div
            key={typeKey}
            style={{
              background: `${cfg.color}0f`,
              border: `1px solid ${cfg.color}33`,
              borderRadius: '5px',
              padding: '7px 9px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{cfg.emoji}</span>
              <span style={{ fontSize: '0.67rem', fontWeight: 700, color: cfg.color, lineHeight: 1.2 }}>
                {cfg.name}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.65rem',
                color: 'rgba(160,160,200,0.55)',
                fontWeight: 600,
              }}
            >
              <span style={{ color: cfg.color }}>{cfg.multiplier.toFixed(1)}x</span>{' '}
              fee multiplier
            </div>
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card (numbered)
// ---------------------------------------------------------------------------

function StepCard({
  number,
  title,
  children,
  accent = '#00ff88',
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '14px',
      }}
    >
      {/* Number badge */}
      <div
        aria-hidden="true"
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: `${accent}22`,
          border: `1px solid ${accent}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '0.65rem',
          fontWeight: 800,
          color: accent,
          marginTop: '1px',
        }}
      >
        {number}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#ededed',
            marginBottom: '4px',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(180,180,200,0.75)', lineHeight: 1.6 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section block with divider
// ---------------------------------------------------------------------------

function InfoSection({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor?: string;
  children: React.ReactNode;
}) {
  const color = accentColor ?? '#00ff88';
  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Divider + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ height: '1px', flex: '0 0 12px', background: `${color}44` }} />
        <SectionHeading color={color}>{title}</SectionHeading>
        <div style={{ height: '1px', flex: 1, background: `${color}22` }} />
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HowItWorks() {
  const [expanded, setExpanded] = useState(false);

  const cardStyle: CSSProperties = {
    background: '#0d0d1a',
    border: '1px solid rgba(0,255,136,0.12)',
    borderRadius: '8px',
    overflow: 'hidden',
    fontFamily: 'var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, monospace',
  };

  const toggleStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: '#ededed',
    textAlign: 'left',
  };

  return (
    <div style={cardStyle}>
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="how-it-works-body"
        style={toggleStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            aria-hidden="true"
            style={{
              fontSize: '0.85rem',
              color: '#00ff88',
              fontWeight: 800,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            How It Works
          </span>
          <span
            style={{
              fontSize: '0.6rem',
              color: 'rgba(0,255,136,0.65)',
              fontWeight: 600,
              letterSpacing: '0.06em',
            }}
          >
            Harberger tax · ETH fees · 100 seats
          </span>
        </div>

        {/* Chevron */}
        <span
          aria-hidden="true"
          style={{
            fontSize: '0.7rem',
            color: 'rgba(0,255,136,0.6)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.25s ease',
            display: 'inline-block',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {/* Expandable body */}
      <div
        id="how-it-works-body"
        style={{
          maxHeight: expanded ? '4000px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.4s ease',
        }}
      >
        <div
          style={{
            padding: '0 16px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* --- WHAT IS CLAW SOCIETY --- */}
          <InfoSection title="What is Claw Society?" accentColor="#00ff88">
            <BodyText>
              Claw Society is a{' '}
              <InlineHighlight>tokenized city grid on Base</InlineHighlight>. The city has{' '}
              <InlineHighlight>100 seats</InlineHighlight> arranged in a 10x10 grid, each
              representing a building type with a different yield multiplier. Seats are
              held under <InlineHighlight color="#00ffff">Harberger Tax</InlineHighlight> — a
              mechanism that forces owners to keep their seats priced honestly or lose them.
            </BodyText>
            <HighlightBox accentColor="#00ff88">
              <InlineHighlight>Revenue source:</InlineHighlight> Every time the CLAW token is
              traded on Flaunch, a portion of the fee goes into a pool. That ETH is distributed
              to all current seat-holders, weighted by their building&apos;s multiplier.
            </HighlightBox>
          </InfoSection>

          {/* --- HARBERGER TAX --- */}
          <InfoSection title="Harberger Tax" accentColor="#00ffff">
            <BodyText>
              Harberger Tax is a property ownership model where you must always declare a sale
              price for what you own — and anyone can buy it from you at that price.
            </BodyText>

            <div style={{ marginBottom: '12px' }}>
              <StepCard number={1} title="Claim a seat" accent="#00ffff">
                Set your own price (in ETH) and deposit enough ETH to cover the weekly tax.
                The deposit slowly drains over time.
              </StepCard>
              <StepCard number={2} title="Pay weekly tax" accent="#00ffff">
                Tax is <InlineHighlight color="#ff8855">5% of your listed price per week</InlineHighlight>{' '}
                (annualized ~260%). This incentivizes low honest pricing. Tax is deducted from
                your deposit automatically.
              </StepCard>
              <StepCard number={3} title="Stay funded or forfeit" accent="#00ffff">
                If your deposit runs out, your seat can be claimed by anyone for free.
                Top up your deposit at any time to keep the seat.
              </StepCard>
              <StepCard number={4} title="Anyone can buy you out" accent="#ff0055">
                Any wallet can pay your listed price and take your seat, at any time. They must
                also provide a new price and their own deposit.
              </StepCard>
            </div>

            <HighlightBox accentColor="#00ffff">
              <InlineHighlight color="#00ffff">Strategy tip:</InlineHighlight> Set a higher price
              to make it harder to be bought out, but you&apos;ll pay more tax. Set a lower price
              to pay less tax, but be easier to buy out. Find your sweet spot.
            </HighlightBox>
          </InfoSection>

          {/* --- BUILDING TYPES --- */}
          <InfoSection title="Building Types & Multipliers" accentColor="#ffd700">
            <BodyText>
              Each seat in the grid has a fixed building type. Higher-value buildings sit at the
              center of the grid. Your ETH fee share is proportional to your building&apos;s
              multiplier relative to all other active seats.
            </BodyText>
            <BuildingGrid />
            <HighlightBox accentColor="#ffd700">
              The <InlineHighlight color="#ff0055">Server Farm</InlineHighlight> (2x, center seat)
              earns double the base rate. A{' '}
              <InlineHighlight color="#44cc44">Park</InlineHighlight> (0.7x, edge) earns 70%.
              Total ETH in any epoch is split proportionally across all active multipliers.
            </HighlightBox>
          </InfoSection>

          {/* --- ETH FEE DISTRIBUTION --- */}
          <InfoSection title="ETH Fee Distribution" accentColor="#8855ff">
            <BodyText>
              Claw Society earns ETH from trading fees on the CLAW token via{' '}
              <InlineHighlight color="#8855ff">Flaunch</InlineHighlight>. Every CLAW buy/sell
              generates a fee, a portion of which flows into the Claw Society fee pool.
            </BodyText>

            <div style={{ marginBottom: '12px' }}>
              <StepCard number={1} title="CLAW trades happen" accent="#8855ff">
                When anyone buys or sells the CLAW token on-chain, the AMM collects a trading fee.
              </StepCard>
              <StepCard number={2} title="ETH flows to fee pool" accent="#8855ff">
                A share of those fees (in ETH) is sent to the ClawSociety contract.
              </StepCard>
              <StepCard number={3} title="Lazy accumulator distributes" accent="#8855ff">
                The contract uses an O(1) accumulator pattern. Every seat&apos;s pending ETH
                is calculated on the fly — no looping over 100 seats on-chain.
              </StepCard>
              <StepCard number={4} title="Claim any time" accent="#00ff88">
                When you click <InlineHighlight>Claim ETH Fees</InlineHighlight>, all pending
                ETH for your seats is sent to your wallet in one transaction.
              </StepCard>
            </div>
          </InfoSection>

          {/* --- BUYOUT MECHANICS --- */}
          <InfoSection title="Buyout Mechanics" accentColor="#ff0055">
            <BodyText>
              When you buy out a seat, a <InlineHighlight color="#ff0055">20% fee</InlineHighlight>{' '}
              is applied on top of the listed price. The fee is split:
            </BodyText>

            <HighlightBox accentColor="#ff0055">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <div style={{ color: '#ff0055', fontWeight: 700 }}>6%</div>
                  <div style={{ color: 'rgba(180,180,200,0.7)', fontSize: '0.67rem' }}>Protocol treasury</div>
                </div>
                <div>
                  <div style={{ color: '#ff8855', fontWeight: 700 }}>14%</div>
                  <div style={{ color: 'rgba(180,180,200,0.7)', fontSize: '0.67rem' }}>Creator (deployer)</div>
                </div>
                <div>
                  <div style={{ color: '#ededed', fontWeight: 700 }}>100%</div>
                  <div style={{ color: 'rgba(180,180,200,0.7)', fontSize: '0.67rem' }}>Goes to previous holder</div>
                </div>
                <div>
                  <div style={{ color: '#ffd700', fontWeight: 700 }}>120%</div>
                  <div style={{ color: 'rgba(180,180,200,0.7)', fontSize: '0.67rem' }}>Total buyer pays</div>
                </div>
              </div>
            </HighlightBox>

            <BodyText>
              The previous holder always receives the full listed price. The 20% fee is charged
              on top, not subtracted from it. So if a seat lists at{' '}
              <InlineHighlight>0.1 ETH</InlineHighlight>, the buyer pays{' '}
              <InlineHighlight>0.12 ETH</InlineHighlight> total.
            </BodyText>
          </InfoSection>

          {/* --- SERVER FUND --- */}
          <InfoSection title="Server Fund" accentColor="#00ffff">
            <BodyText>
              The Server Fund collects <InlineHighlight color="#00ffff">5% of all tax revenue</InlineHighlight>{' '}
              (in ETH) until it reaches <InlineHighlight>1 ETH</InlineHighlight>. The goal
              is to fund the ongoing infrastructure (hosting, RPC, APIs) that keeps the app running
              indefinitely without relying on subscriptions or ads.
            </BodyText>
            <HighlightBox accentColor="#00ffff">
              Once the fund hits 1 ETH, the status bar at the top of the page reads{' '}
              <InlineHighlight color="#00ff88">SOCIETY AUTONOMOUS</InlineHighlight> and the
              5% server fund deduction stops. Tax collection continues, but 100% goes back
              to the fee pool for seat-holders.
            </HighlightBox>
          </InfoSection>

          {/* --- DEPOSIT SYSTEM --- */}
          <InfoSection title="Tax Deposit System" accentColor="#ffd700">
            <BodyText>
              When you claim or buy out a seat, you provide an ETH deposit up front. This
              deposit is your &quot;runway&quot; — it covers future tax payments automatically.
            </BodyText>

            <div style={{ marginBottom: '12px' }}>
              <StepCard number={1} title="Deposit funds your tax" accent="#ffd700">
                Tax is deducted continuously from your deposit at the rate of 5% of your price
                per week. The sidebar shows exactly how many days/weeks your deposit lasts.
              </StepCard>
              <StepCard number={2} title="Top up any time" accent="#ffd700">
                You can add more ETH to your deposit at any time to extend your runway.
              </StepCard>
              <StepCard number={3} title="Partial withdrawal allowed" accent="#ffd700">
                You can withdraw ETH from your deposit, as long as you leave at least a
                minimum amount. Over-withdrawing is not permitted.
              </StepCard>
              <StepCard number={4} title="Forfeit if empty" accent="#ff4422">
                If your deposit reaches zero, you cannot claim fees and others can take
                your seat for free. Keep your deposit funded!
              </StepCard>
            </div>

            <HighlightBox accentColor="#ffd700">
              <InlineHighlight color="#ffd700">Formula:</InlineHighlight> Weekly tax =
              price &times; 5%. A seat priced at 1 ETH costs 0.05 ETH/week in tax.
              A 0.5 ETH deposit gives you a 10-week runway.
            </HighlightBox>
          </InfoSection>

          {/* Footer note */}
          <div
            style={{
              fontSize: '0.62rem',
              color: 'rgba(130,130,160,0.45)',
              textAlign: 'center',
              marginTop: '4px',
              letterSpacing: '0.05em',
            }}
          >
            Contract: 0xD7A01085aC48cBBa903934b3c8F0D7700e054Baa on Base Mainnet
          </div>
        </div>
      </div>
    </div>
  );
}
