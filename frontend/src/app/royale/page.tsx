'use client';

import { useState } from 'react';

export default function RoyalePage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative flex flex-1 flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Loading skeleton */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff8855] border-t-transparent" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#ff8855]/60">
              Loading Agent Royale...
            </span>
          </div>
        </div>
      )}

      <iframe
        src="https://agentroyale.fun"
        title="Agent Royale"
        className="flex-1 border-none"
        style={{ minHeight: 'calc(100vh - 120px)' }}
        allow="clipboard-write; web-share"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
