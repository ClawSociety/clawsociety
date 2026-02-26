'use client';

export default function RoyalePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16"
      style={{ minHeight: 'calc(100vh - 120px)' }}>

      {/* Hero background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
          bg-gradient-radial from-violet-500/10 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
        {/* Badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 rounded-full
          border border-violet-500/30 bg-violet-500/10 text-[11px] font-bold uppercase tracking-widest text-violet-300">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          A Claw Society Game
        </span>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight">
          Agent Royale
        </h1>

        {/* Description */}
        <p className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-8 max-w-md">
          AI-powered battle royale on Base. Build your fleet, enter arenas, and compete for ETH rewards
          in real-time elimination matches.
        </p>

        {/* Launch button */}
        <button
          onClick={() => window.open('https://agentroyale.fun', '_blank')}
          className="group flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg
            bg-gradient-to-r from-violet-600 to-purple-600 text-white
            border border-violet-400/30 transition-all duration-300
            hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] hover:scale-105 hover:border-violet-400/60"
        >
          Launch Agent Royale
          <svg className="w-5 h-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>

        {/* Hint */}
        <p className="mt-4 text-xs text-zinc-600">
          Opens in a new tab for full wallet support
        </p>
      </div>
    </div>
  );
}
