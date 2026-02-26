'use client';

import { useState } from 'react';

interface ColorSwatchPickerProps {
  colors: number[];           // hex numbers like 0xf5d0a9
  selected: number;
  onChange: (color: number) => void;
  showHexInput?: boolean;
  label?: string;
}

function toHexStr(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

function fromHexStr(s: string): number {
  return parseInt(s.replace('#', ''), 16) || 0;
}

export function ColorSwatchPicker({
  colors,
  selected,
  onChange,
  showHexInput = false,
  label,
}: ColorSwatchPickerProps) {
  const [hexInput, setHexInput] = useState(toHexStr(selected));

  return (
    <div>
      {label && (
        <span className="mb-1 block font-mono text-[10px] text-gray-500">{label}</span>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => { onChange(c); setHexInput(toHexStr(c)); }}
            className="h-6 w-6 rounded-full border-2 transition-all"
            style={{
              backgroundColor: toHexStr(c),
              borderColor: c === selected ? '#00ffff' : 'rgba(255,255,255,0.15)',
              boxShadow: c === selected ? '0 0 6px #00ffff' : 'none',
            }}
            aria-label={`Color ${toHexStr(c)}`}
          />
        ))}
        {showHexInput && (
          <input
            type="text"
            value={hexInput}
            onChange={e => {
              setHexInput(e.target.value);
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                onChange(fromHexStr(e.target.value));
              }
            }}
            className="w-20 rounded border border-white/10 bg-[#0d0d1a] px-1.5 py-0.5 font-mono text-[10px] text-white outline-none focus:border-cyan-500/50"
            placeholder="#ffffff"
          />
        )}
      </div>
    </div>
  );
}
