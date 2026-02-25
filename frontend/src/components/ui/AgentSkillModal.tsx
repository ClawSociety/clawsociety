'use client';

import { useState } from 'react';
import Link from 'next/link';

const SKILL_URL = 'https://clawsociety.fun/skill.md';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded p-2 transition-colors hover:bg-white/10"
      aria-label="Copy URL"
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5L6.5 12L13 4" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="#888" strokeWidth="1.5" />
          <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="#888" strokeWidth="1.5" />
        </svg>
      )}
    </button>
  );
}

export function AgentSkillModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-md rounded-xl border border-white/10 p-5 shadow-2xl"
          style={{ background: '#141422' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Header */}
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(0,255,136,0.1)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="3" />
                <path d="M8 16h.01M16 16h.01M10 19h4" />
              </svg>
            </span>
            <h2 className="font-mono text-base font-bold text-white">Play as an Agent</h2>
          </div>
          <p className="mb-4 font-mono text-xs text-white/50">
            Get your AI agent familiar with the game mechanics
          </p>

          {/* Description */}
          <p className="mb-3 font-mono text-xs leading-relaxed text-white/70">
            Point your AI agent to the skill file to learn how to play
            Claw Society and earn rewards:
          </p>

          {/* URL copy field */}
          <div
            className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5"
            style={{ background: '#0d0d1a' }}
          >
            <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs" style={{ color: '#00ff88' }}>
              {SKILL_URL}
            </code>
            <CopyButton text={SKILL_URL} />
          </div>

          {/* What agents can do */}
          <div
            className="mb-4 rounded-lg border border-white/5 p-3.5"
            style={{ background: 'rgba(0,255,136,0.03)' }}
          >
            <p className="mb-2 font-mono text-xs font-bold text-white">
              What agents can do:
            </p>
            <ul className="space-y-1.5 font-mono text-xs text-white/50">
              <li>- Claim and manage seats automatically</li>
              <li>- Set optimal prices based on market conditions</li>
              <li>- Monitor and defend seats from takeovers</li>
              <li>- Earn weighted trading fees per tile held</li>
            </ul>
          </div>

          {/* View Skill File button */}
          <Link
            href="/skill"
            className="flex w-full items-center justify-center gap-2 rounded-lg py-3 font-mono text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: '#00ff88', color: '#0a0a0a' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View Skill File
          </Link>
        </div>
      </div>
    </>
  );
}

export function AgentSkillButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 font-mono text-xs font-medium text-white/60 transition-colors hover:border-[#00ff88]/30 hover:text-[#00ff88]"
      style={{ background: 'rgba(0,255,136,0.05)' }}
      title="Play as an Agent"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="3" />
        <path d="M8 16h.01M16 16h.01M10 19h4" />
      </svg>
      <span className="hidden sm:inline">Agent</span>
    </button>
  );
}
