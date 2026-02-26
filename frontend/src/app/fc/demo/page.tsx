'use client';

import { PitchCanvas } from '@/components/fc/PitchCanvas';

const DEMO_STATS = [
  { speed: 75, passing: 60, shooting: 45, defense: 80, stamina: 70 }, // GK
  { speed: 55, passing: 65, shooting: 30, defense: 85, stamina: 75 }, // DEF
  { speed: 60, passing: 70, shooting: 35, defense: 78, stamina: 72 }, // DEF
  { speed: 80, passing: 82, shooting: 65, defense: 40, stamina: 68 }, // MID
  { speed: 88, passing: 55, shooting: 92, defense: 25, stamina: 60 }, // FWD
];

const DEMO_STATS_AWAY = [
  { speed: 70, passing: 55, shooting: 40, defense: 82, stamina: 74 },
  { speed: 50, passing: 68, shooting: 28, defense: 88, stamina: 78 },
  { speed: 58, passing: 72, shooting: 32, defense: 75, stamina: 70 },
  { speed: 85, passing: 78, shooting: 70, defense: 38, stamina: 65 },
  { speed: 90, passing: 50, shooting: 88, defense: 22, stamina: 58 },
];

export default function DemoPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-[80vh]">
      <h1 className="text-xl font-mono font-bold text-white mb-1">
        CloudFC Engine Demo
      </h1>
      <p className="text-white/40 text-sm font-mono mb-6">
        SOTA Match Engine — 3-2 thriller
      </p>

      <div className="w-full max-w-[600px]">
        <PitchCanvas
          homeGoals={3}
          awayGoals={2}
          seed={420691337n}
          homePower={340}
          awayPower={320}
          homeStats={DEMO_STATS}
          awayStats={DEMO_STATS_AWAY}
          homePlayerIds={[101, 102, 103, 104, 105]}
          awayPlayerIds={[201, 202, 203, 204, 205]}
          width={640}
          height={420}
        />
      </div>

      <div className="mt-6 text-center text-white/30 text-xs font-mono space-y-1">
        <p>Steering behaviors + bezier ball + tactical formations</p>
        <p>Cinematic goal sequences + spring camera</p>
      </div>
    </main>
  );
}
