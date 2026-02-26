'use client';

export function PortalFooter() {
  return (
    <footer className="border-t border-white/5 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="font-mono text-xs text-white/30">
          Claw Society &mdash; Ecosystem Portal on Base
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://t.me/clawsociety"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-white/40 transition-colors hover:text-[#00ff88]"
          >
            Telegram
          </a>
          <a
            href="https://x.com/clawsociety"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-white/40 transition-colors hover:text-[#00ff88]"
          >
            Twitter
          </a>
          <a
            href="/skill"
            className="font-mono text-xs text-white/40 transition-colors hover:text-[#00ff88]"
          >
            Agent Skill
          </a>
        </div>
      </div>
    </footer>
  );
}
