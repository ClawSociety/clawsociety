'use client';

/**
 * Tile — a single cell in the 10x10 Claw Society grid.
 *
 * Usage:
 *   <Tile
 *     seat={seats[id]}
 *     seatId={id}
 *     isSelected={selectedSeat === id}
 *     userAddress={address}
 *     onClick={(id) => setSelectedSeat(id)}
 *   />
 */

import { useState, useCallback, memo, CSSProperties } from 'react';
import { Seat, SeatStatus } from '@/lib/types';
import { BUILDING_CONFIGS } from '@/lib/constants';
import { formatETH, shortenAddress, ZERO_ADDRESS } from '@/lib/utils';

/** Read a stored nickname for any address directly from localStorage (no React state needed). */
function readNickname(address: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(`claw_profile_${address.toLowerCase()}`);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { nickname?: string };
    return typeof parsed.nickname === 'string' ? parsed.nickname : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TileProps {
  seat: Seat;
  seatId: number;
  isSelected: boolean;
  userAddress?: string;
  onClick: (seatId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeatStatus(seat: Seat, userAddress?: string): SeatStatus {
  if (seat.holder === ZERO_ADDRESS) return 'available';
  if (userAddress && seat.holder.toLowerCase() === userAddress.toLowerCase()) return 'mine';
  // A seat is considered "forfeiting" when deposit is critically low relative to
  // its price. We use a simple heuristic: deposit < 5% of price (< 0.05 * price).
  if (seat.price > 0n && seat.deposit < seat.price / 20n) return 'forfeiting';
  return 'owned';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Tile = memo(function Tile({ seat, seatId, isSelected, userAddress, onClick }: TileProps) {
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const config = BUILDING_CONFIGS[seat.buildingType] ?? BUILDING_CONFIGS[0];
  const status: SeatStatus = getSeatStatus(seat, userAddress);

  const isAvailable = status === 'available';
  const isMine = status === 'mine';
  const isForfeiting = status === 'forfeiting';

  // ------------------------------------------------------------------
  // Dynamic border / glow logic
  // ------------------------------------------------------------------
  //   priority: selected > mine > available > forfeiting > default owned
  // ------------------------------------------------------------------

  let borderColor = config.borderColor;
  let borderWidth = '1px';
  let boxShadow = 'none';
  let bgOverlayOpacity = 0.15; // opacity of the flat color overlay on top of image

  if (isSelected) {
    borderColor = config.borderColor;
    borderWidth = '2px';
    const glow = config.glowColor;
    boxShadow = `0 0 12px 3px ${glow}, 0 0 24px 6px ${glow.replace('0.5', '0.25').replace('0.4', '0.2').replace('0.3', '0.15')}`;
    bgOverlayOpacity = 0.25;
  } else if (isMine) {
    // Yellow-green tint — override the building border with a warm lime hue
    borderColor = '#b8ff3c';
    borderWidth = '2px';
    boxShadow = '0 0 8px 2px rgba(184,255,60,0.4)';
    bgOverlayOpacity = 0.2;
  } else if (isForfeiting) {
    borderColor = '#ff4422';
    borderWidth = '1px';
    boxShadow = '0 0 6px 1px rgba(255,68,34,0.5)';
  }

  if (isHovered && !isSelected) {
    boxShadow = `0 0 10px 2px ${config.glowColor}`;
    borderWidth = isSelected || isMine ? borderWidth : '2px';
  }

  // ------------------------------------------------------------------
  // Container styles (inline for dynamic values, Tailwind for the rest)
  // ------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    borderColor,
    borderWidth,
    borderStyle: 'solid',
    boxShadow,
    transform: isHovered ? 'scale(1.04)' : 'scale(1)',
    transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
    aspectRatio: '1',
    backgroundColor: '#1a1a2e',
    position: 'relative',
    cursor: 'pointer',
    overflow: 'hidden',
    borderRadius: '4px',
    userSelect: 'none',
  };

  // ------------------------------------------------------------------
  // Background image (building illustration)
  // ------------------------------------------------------------------

  const showBgImage = !imgError;
  const bgImageStyle: CSSProperties = showBgImage
    ? {
        backgroundImage: `url('/buildings/${seat.buildingType}.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'absolute',
        inset: 0,
        opacity: 0.55,
      }
    : {};

  // Flat color overlay — always present, opacity varies by state
  const colorOverlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: config.color,
    opacity: bgOverlayOpacity,
    pointerEvents: 'none',
  };

  // ------------------------------------------------------------------
  // Price / availability label
  // ------------------------------------------------------------------

  const priceLabel =
    isAvailable ? 'AVAILABLE' : formatETH(seat.price);

  const priceLabelColor =
    isAvailable
      ? '#00ff88'
      : isMine
      ? '#b8ff3c'
      : isForfeiting
      ? '#ff4422'
      : '#e0e0e0';

  // ------------------------------------------------------------------
  // Multiplier badge color — use the building accent color
  // ------------------------------------------------------------------

  const badgeStyle: CSSProperties = {
    position: 'absolute',
    top: '3px',
    right: '3px',
    fontSize: '0.55rem',
    lineHeight: 1,
    fontFamily: 'var(--font-geist-mono, monospace)',
    fontWeight: 700,
    color: config.color,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: '1px 3px',
    borderRadius: '3px',
    letterSpacing: '0.02em',
    pointerEvents: 'none',
  };

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleClick = useCallback(() => onClick(seatId), [onClick, seatId]);
  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const handleImgError = useCallback(() => setImgError(true), []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Seat ${seatId}: ${config.name}, ${priceLabel}${isMine ? ', owned by you' : ''}`}
      aria-pressed={isSelected}
      style={containerStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={[
        // Pulse ring for available seats
        isAvailable ? 'tile-available' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Hidden img tag — used solely to detect 404s so we can fall back */}
      {showBgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/buildings/${seat.buildingType}.png`}
          alt=""
          aria-hidden="true"
          onError={handleImgError}
          style={{ display: 'none' }}
        />
      )}

      {/* Background layer: image (if available) */}
      {showBgImage && <div style={bgImageStyle} />}

      {/* Color overlay */}
      <div style={colorOverlayStyle} />

      {/* Multiplier badge */}
      <span style={badgeStyle} aria-hidden="true">
        {config.multiplier.toFixed(1)}x
      </span>

      {/* Content */}
      <div
        className="relative flex flex-col items-center justify-center w-full h-full p-0.5"
        style={{ zIndex: 1 }}
      >
        {/* Emoji */}
        <span
          aria-hidden="true"
          className="leading-none select-none"
          style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.5rem)' }}
        >
          {config.emoji}
        </span>

        {/* Building name */}
        <span
          className="mt-0.5 text-center font-semibold leading-tight truncate w-full text-center"
          style={{
            fontSize: 'clamp(0.5rem, 0.9vw, 0.6rem)',
            color: '#c0c0d0',
            fontFamily: 'var(--font-geist-mono, monospace)',
          }}
          aria-hidden="true"
        >
          {config.name}
        </span>

        {/* Price / AVAILABLE */}
        <span
          className="font-bold leading-tight truncate w-full text-center"
          style={{
            fontSize: 'clamp(0.45rem, 0.8vw, 0.55rem)',
            color: priceLabelColor,
            fontFamily: 'var(--font-geist-mono, monospace)',
            marginTop: '1px',
          }}
          aria-hidden="true"
        >
          {priceLabel}
        </span>

        {/* Holder address or nickname — only shown on selected tile */}
        {isSelected && !isAvailable && (
          <span
            className="leading-none truncate w-full text-center mt-0.5"
            style={{
              fontSize: 'clamp(0.4rem, 0.7vw, 0.48rem)',
              color: 'rgba(200,200,220,0.75)',
              fontFamily: 'var(--font-geist-mono, monospace)',
            }}
          >
            {readNickname(seat.holder) || shortenAddress(seat.holder)}
          </span>
        )}
      </div>

      {/* Forfeiting warning stripe */}
      {isForfeiting && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'repeating-linear-gradient(90deg, #ff4422 0px, #ff4422 4px, transparent 4px, transparent 8px)',
          }}
        />
      )}
    </div>
  );
}, (prev, next) =>
  prev.seat.holder === next.seat.holder &&
  prev.seat.price === next.seat.price &&
  prev.seat.deposit === next.seat.deposit &&
  prev.seat.buildingType === next.seat.buildingType &&
  prev.isSelected === next.isSelected &&
  prev.userAddress === next.userAddress
);
