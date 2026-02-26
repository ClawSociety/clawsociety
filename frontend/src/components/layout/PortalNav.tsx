'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import Image from 'next/image';
import { ConnectButton } from '@/components/ui/ConnectButton';
import { ProfilePanel } from '@/components/ui/ProfilePanel';
import { AgentSkillModal, AgentSkillButton } from '@/components/ui/AgentSkillModal';
import { useGridState } from '@/hooks/useGridState';
import { useClaimFees } from '@/hooks/useClaimFees';
import { ZERO_ADDRESS } from '@/lib/utils';

const GAMES = [
  { name: 'Portal', href: '/', accent: '#00ff88' },
  { name: 'Society', href: '/society', accent: '#00ff88' },
  { name: 'Claw FC', href: '/fc', accent: '#00ffff' },
  { name: 'Royale', href: '/royale', accent: '#ff8855' },
] as const;

export function PortalNav() {
  const pathname = usePathname();
  const { address } = useAccount();
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const { seats } = useGridState();

  const myOwnedSeatIds: bigint[] = seats
    .map((s, i) => ({ s, i }))
    .filter(
      ({ s }) =>
        address &&
        s.holder !== ZERO_ADDRESS &&
        s.holder.toLowerCase() === address.toLowerCase()
    )
    .map(({ i }) => BigInt(i));

  const { totalPending } = useClaimFees(myOwnedSeatIds);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="shrink-0">
            <Image
              src="/logo.png"
              alt="Claw Society logo"
              width={40}
              height={40}
              className="shrink-0"
              priority
            />
          </Link>
          <div className="min-w-0">
            <Link href="/">
              <h1
                className="neon-text-flicker font-mono font-extrabold uppercase"
                style={{
                  color: '#00ff88',
                  fontSize: 'clamp(1.1rem, 3vw, 1.6rem)',
                  letterSpacing: '0.2em',
                }}
              >
                CLAW SOCIETY
              </h1>
            </Link>
            {/* Game nav pills */}
            <nav className="mt-1 flex gap-1.5 overflow-x-auto scrollbar-none">
              {GAMES.map((game) => {
                const active = isActive(game.href);
                return (
                  <Link
                    key={game.href}
                    href={game.href}
                    className="shrink-0 rounded px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      color: active ? '#0d0d1a' : game.accent,
                      background: active ? game.accent : 'transparent',
                      border: `1px solid ${active ? game.accent : game.accent + '33'}`,
                      boxShadow: active ? `0 0 8px ${game.accent}44` : 'none',
                    }}
                  >
                    {game.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Right side: socials + agent button + profile panel */}
        <div className="self-end sm:self-auto ml-4 shrink-0 flex items-center gap-2">
          <a
            href="https://phantom.app/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:border-purple-500/40 hover:text-purple-400"
            title="Get Phantom Wallet"
          >
            <svg width="16" height="16" viewBox="0 0 128 128" fill="currentColor"><path d="M110.584 64.914c-1.768 0-3.202-1.434-3.202-3.202 0-24.239-19.66-43.899-43.898-43.899S19.585 37.473 19.585 61.712c0 1.768-1.434 3.202-3.202 3.202s-3.202-1.434-3.202-3.202C13.181 33.926 35.698 11.41 63.484 11.41s50.303 22.517 50.303 50.302c0 1.768-1.435 3.202-3.203 3.202zm-15.61 0c-1.768 0-3.202-1.434-3.202-3.202 0-15.634-12.721-28.289-28.288-28.289S35.196 46.078 35.196 61.712c0 1.768-1.434 3.202-3.202 3.202s-3.202-1.434-3.202-3.202c0-19.168 15.524-34.692 34.692-34.692s34.692 15.524 34.692 34.692c0 1.768-1.434 3.202-3.202 3.202zm-15.61 0c-1.768 0-3.202-1.434-3.202-3.202 0-7.03-5.688-12.678-12.678-12.678S50.806 54.682 50.806 61.712c0 1.768-1.434 3.202-3.202 3.202s-3.202-1.434-3.202-3.202c0-10.564 8.518-19.082 19.082-19.082s19.082 8.518 19.082 19.082c0 1.768-1.434 3.202-3.202 3.202zm-15.61 3.202a6.404 6.404 0 1 0 0-12.808 6.404 6.404 0 0 0 0 12.808z" fillRule="evenodd"/></svg>
          </a>
          <a
            href="https://t.me/clawsociety"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:border-[#00ff88]/30 hover:text-[#00ff88]"
            title="Telegram"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          </a>
          <a
            href="https://x.com/clawsociety"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:border-[#00ff88]/30 hover:text-[#00ff88]"
            title="Twitter"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <AgentSkillButton onClick={() => setAgentModalOpen(true)} />
          {address ? (
            <ProfilePanel
              address={address}
              seats={seats}
              totalPendingFees={totalPending}
            />
          ) : (
            <ConnectButton />
          )}
        </div>
      </header>

      <AgentSkillModal open={agentModalOpen} onClose={() => setAgentModalOpen(false)} />
    </>
  );
}
