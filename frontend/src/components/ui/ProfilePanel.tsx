'use client';

/**
 * ProfilePanel — avatar + nickname editor shown in the header when wallet is connected.
 *
 * Usage:
 *   <ProfilePanel address={address} seats={seats} totalPendingFees={totalPending} />
 *
 * Features:
 *   - Displays truncated wallet address or nickname
 *   - Click to open a dropdown panel
 *   - Edit nickname (max 24 chars)
 *   - Paste an image URL for avatar (or leave blank for a generated identicon)
 *   - Shows: seats owned, total deposit value, pending ETH fees
 */

import { useState, useRef, useEffect, useCallback, CSSProperties } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Seat } from '@/lib/types';
import { formatETH, shortenAddress, ZERO_ADDRESS } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Identicon — deterministic color avatar generated from the wallet address
// ---------------------------------------------------------------------------

function Identicon({ address, size = 32 }: { address: string; size?: number }) {
  // Generate a stable hue from the address
  const hue = parseInt(address.slice(2, 8), 16) % 360;
  const sat = 60 + (parseInt(address.slice(8, 12), 16) % 30);
  const lit = 45 + (parseInt(address.slice(12, 16), 16) % 20);

  // 5x5 symmetric grid of "pixels" derived from address bytes
  const cells: boolean[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const byteIndex = row * 3 + col;
      const byte = parseInt(address.slice(2 + byteIndex * 2, 4 + byteIndex * 2), 16);
      cells.push(byte > 127);
    }
  }

  const pixelSize = size / 5;
  const color = `hsl(${hue},${sat}%,${lit}%)`;
  const bg = `hsl(${hue},20%,12%)`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ borderRadius: '4px', flexShrink: 0 }}
    >
      <rect width={size} height={size} fill={bg} />
      {cells.map((filled, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        if (!filled) return null;

        // Mirror col 0,1,2 to 4,3,2 for symmetry
        const rects = [
          <rect key={`${i}-a`} x={col * pixelSize} y={row * pixelSize} width={pixelSize} height={pixelSize} fill={color} />,
        ];
        if (col < 2) {
          rects.push(
            <rect
              key={`${i}-b`}
              x={(4 - col) * pixelSize}
              y={row * pixelSize}
              width={pixelSize}
              height={pixelSize}
              fill={color}
            />
          );
        }
        return rects;
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Avatar — shows custom image URL or falls back to Identicon
// ---------------------------------------------------------------------------

function Avatar({
  address,
  avatarUrl,
  size = 32,
}: {
  address: string;
  avatarUrl: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt="Profile avatar"
        width={size}
        height={size}
        onError={() => setImgFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '4px',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }

  return <Identicon address={address} size={size} />;
}

// ---------------------------------------------------------------------------
// ProfilePanel props
// ---------------------------------------------------------------------------

interface ProfilePanelProps {
  address: string;
  seats: Seat[];
  totalPendingFees: bigint;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProfilePanel({ address, seats, totalPendingFees }: ProfilePanelProps) {
  const { profile, setNickname, setAvatarUrl } = useProfile(address);
  const [open, setOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('');
  const [saved, setSaved] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync inputs when profile loads or address changes
  useEffect(() => {
    setNicknameInput(profile.nickname);
    setAvatarInput(profile.avatarUrl);
  }, [profile.nickname, profile.avatarUrl]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Derived stats
  const mySeats = seats.filter(
    (s) => s.holder !== ZERO_ADDRESS && s.holder.toLowerCase() === address.toLowerCase()
  );
  const totalDeposit = mySeats.reduce((acc, s) => acc + s.deposit, 0n);
  const totalValue = mySeats.reduce((acc, s) => acc + s.price, 0n);

  const displayName = profile.nickname || shortenAddress(address);

  const handleSave = useCallback(() => {
    setNickname(nicknameInput);
    setAvatarUrl(avatarInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [nicknameInput, avatarInput, setNickname, setAvatarUrl]);

  // Button style
  const triggerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#0d0d1a',
    border: '1px solid rgba(0,255,136,0.25)',
    borderRadius: '6px',
    padding: '4px 10px 4px 6px',
    cursor: 'pointer',
    color: '#ededed',
    fontFamily: 'var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, monospace',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    whiteSpace: 'nowrap',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    background: '#0a0a15',
    border: '1px solid rgba(0,255,136,0.2)',
    borderRadius: '4px',
    padding: '6px 8px',
    color: '#ededed',
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: '0.72rem',
    outline: 'none',
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Profile for ${displayName}`}
        style={triggerStyle}
        onMouseEnter={(e) =>
          Object.assign(e.currentTarget.style, {
            borderColor: 'rgba(0,255,136,0.6)',
            boxShadow: '0 0 10px rgba(0,255,136,0.2)',
          })
        }
        onMouseLeave={(e) =>
          Object.assign(e.currentTarget.style, {
            borderColor: 'rgba(0,255,136,0.25)',
            boxShadow: 'none',
          })
        }
      >
        <Avatar address={address} avatarUrl={profile.avatarUrl} size={24} />
        <span>{displayName}</span>
        <span
          aria-hidden="true"
          style={{
            color: 'rgba(0,255,136,0.5)',
            fontSize: '0.6rem',
            marginLeft: '2px',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
            display: 'inline-block',
          }}
        >
          v
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Profile settings"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '280px',
            background: '#0d0d1a',
            border: '1px solid rgba(0,255,136,0.2)',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(0,255,136,0.06)',
            zIndex: 100,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}
        >
          {/* Profile avatar preview + address */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <Avatar address={address} avatarUrl={profile.avatarUrl} size={48} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#00ff88',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {profile.nickname || 'Unnamed'}
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'rgba(160,160,200,0.5)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '2px',
                }}
              >
                {shortenAddress(address)}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              marginBottom: '14px',
            }}
          >
            {[
              { label: 'Seats', value: String(mySeats.length), color: '#00ffff' },
              { label: 'Portfolio', value: totalValue > 0n ? formatETH(totalValue) : '0 ETH', color: '#ff44ff' },
              { label: 'Deposit', value: formatETH(totalDeposit), color: '#ffd700' },
              { label: 'Pending', value: totalPendingFees > 0n ? formatETH(totalPendingFees) : '0 ETH', color: '#00ff88' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '4px',
                  padding: '6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.6rem', color: 'rgba(160,160,200,0.5)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {label}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '12px' }} />

          {/* Nickname input */}
          <div style={{ marginBottom: '10px' }}>
            <label
              htmlFor="profile-nickname"
              style={{
                display: 'block',
                fontSize: '0.6rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(160,160,200,0.55)',
                marginBottom: '4px',
              }}
            >
              Nickname (max 24 chars)
            </label>
            <input
              id="profile-nickname"
              type="text"
              maxLength={24}
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="Your name..."
              style={inputStyle}
              onFocus={(e) =>
                Object.assign(e.currentTarget.style, { borderColor: 'rgba(0,255,136,0.5)' })
              }
              onBlur={(e) =>
                Object.assign(e.currentTarget.style, { borderColor: 'rgba(0,255,136,0.2)' })
              }
            />
            <div
              style={{
                textAlign: 'right',
                fontSize: '0.6rem',
                color: 'rgba(160,160,200,0.3)',
                marginTop: '2px',
              }}
            >
              {nicknameInput.length}/24
            </div>
          </div>

          {/* Avatar URL input */}
          <div style={{ marginBottom: '14px' }}>
            <label
              htmlFor="profile-avatar"
              style={{
                display: 'block',
                fontSize: '0.6rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(160,160,200,0.55)',
                marginBottom: '4px',
              }}
            >
              Avatar image URL
            </label>
            <input
              id="profile-avatar"
              type="url"
              value={avatarInput}
              onChange={(e) => setAvatarInput(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
              onFocus={(e) =>
                Object.assign(e.currentTarget.style, { borderColor: 'rgba(0,255,136,0.5)' })
              }
              onBlur={(e) =>
                Object.assign(e.currentTarget.style, { borderColor: 'rgba(0,255,136,0.2)' })
              }
            />
            <div
              style={{
                fontSize: '0.6rem',
                color: 'rgba(160,160,200,0.3)',
                marginTop: '2px',
              }}
            >
              Leave blank to use generated identicon
            </div>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '8px',
              background: saved ? 'rgba(0,255,136,0.15)' : 'rgba(0,255,136,0.08)',
              border: `1px solid ${saved ? 'rgba(0,255,136,0.6)' : 'rgba(0,255,136,0.3)'}`,
              borderRadius: '4px',
              color: saved ? '#00ff88' : '#00cc70',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      )}
    </div>
  );
}
