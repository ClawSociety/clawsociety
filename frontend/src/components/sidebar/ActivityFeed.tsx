'use client';

// ActivityFeed - placeholder for live contract event stream
// Will integrate with useContractEvents hook once available

export function ActivityFeed() {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d1a] p-3">
      <h3
        className="mb-2 font-mono text-xs font-bold uppercase tracking-widest"
        style={{ color: '#00ffff' }}
      >
        Activity
      </h3>
      <p className="font-mono text-xs text-gray-500">Watching for events...</p>
    </div>
  );
}
