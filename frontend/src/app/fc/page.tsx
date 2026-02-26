'use client';

import { FCPanel } from '@/components/fc/FCPanel';

export default function FCPage() {
  return (
    <main className="flex-1 px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <FCPanel />
      </div>
    </main>
  );
}
