'use client';

/**
 * ConnectButton — custom-styled wrapper around RainbowKit's ConnectButton.
 *
 * Usage:
 *   <ConnectButton />
 *
 * Renders a compact wallet button that matches the Claw Society cyberpunk
 * aesthetic: dark background, neon green accent, monospace font.
 */

import { ConnectButton as RKConnectButton } from '@rainbow-me/rainbowkit';

// Shared button base styles used across both connected and disconnected states
const baseButtonStyle: React.CSSProperties = {
  background: '#0d0d1a',
  border: '1px solid rgba(0,255,136,0.4)',
  color: '#00ff88',
  fontFamily: 'var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, monospace',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  padding: '6px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  lineHeight: 1.4,
};

const hoverStyle: React.CSSProperties = {
  borderColor: 'rgba(0,255,136,0.8)',
  boxShadow: '0 0 10px rgba(0,255,136,0.35)',
};

function CyberpunkButton({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={baseButtonStyle}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
      onMouseLeave={(e) =>
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(0,255,136,0.4)',
          boxShadow: 'none',
        })
      }
    >
      {children}
    </button>
  );
}

export function ConnectButton() {
  return (
    <RKConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!ready) {
          // Avoid layout shift while RainbowKit hydrates
          return (
            <div
              aria-hidden="true"
              style={{
                ...baseButtonStyle,
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              Connect
            </div>
          );
        }

        if (!connected) {
          return (
            <CyberpunkButton onClick={openConnectModal}>
              Connect
            </CyberpunkButton>
          );
        }

        if (chain.unsupported) {
          return (
            <CyberpunkButton onClick={openChainModal}>
              <span style={{ color: '#ff3377' }}>Wrong Network</span>
            </CyberpunkButton>
          );
        }

        return (
          <div className="flex items-center gap-2">
            {/* Chain indicator — only show when we might be on wrong network */}
            <button
              type="button"
              onClick={openChainModal}
              style={{
                ...baseButtonStyle,
                padding: '6px 8px',
                color: 'rgba(0,255,136,0.7)',
              }}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
              onMouseLeave={(e) =>
                Object.assign(e.currentTarget.style, {
                  borderColor: 'rgba(0,255,136,0.4)',
                  boxShadow: 'none',
                })
              }
              aria-label={`Switch chain, currently on ${chain.name}`}
            >
              {chain.hasIcon && chain.iconUrl && (
                <img
                  src={chain.iconUrl}
                  alt={chain.name ?? 'chain icon'}
                  style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}
                />
              )}
              <span style={{ verticalAlign: 'middle' }}>{chain.name}</span>
            </button>

            {/* Account button */}
            <CyberpunkButton onClick={openAccountModal}>
              {account.displayName}
              {account.displayBalance ? (
                <span style={{ color: 'rgba(0,255,136,0.55)', marginLeft: 6 }}>
                  {account.displayBalance}
                </span>
              ) : null}
            </CyberpunkButton>
          </div>
        );
      }}
    </RKConnectButton.Custom>
  );
}
