'use client';

import { useState, useCallback } from 'react';

export const SOCIETY_TOKEN = '0x12b7e46c5e98514447178994f26f06200e0db660';

export function TokenAddress() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(SOCIETY_TOKEN).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs text-white/40 shrink-0">Token:</span>
        <span
          className="font-mono text-xs truncate"
          style={{ color: '#00ff88' }}
          title={SOCIETY_TOKEN}
        >
          {SOCIETY_TOKEN}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded border border-white/10 px-2 py-1 font-mono text-xs transition-all hover:border-[#00ff88]/40 hover:text-[#00ff88]"
          style={{ color: copied ? '#00ff88' : 'rgba(160,160,200,0.6)' }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <a
        href={`https://dexscreener.com/base/${SOCIETY_TOKEN}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-white/40 transition-colors hover:text-[#00ff88] shrink-0"
      >
        View on DexScreener &rarr;
      </a>
    </div>
  );
}
