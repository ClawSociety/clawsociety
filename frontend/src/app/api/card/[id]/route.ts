import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { join } from 'path';
import { renderCard } from '@/lib/fc/players/CardRenderer';
import { playerTier, playerName } from '@/lib/fc/playerNames';
import type { PlayerStats } from '@/lib/fc/types';

// Register JetBrains Mono font for server-side rendering
const fontPath = join(process.cwd(), 'src/assets/fonts/JetBrainsMono-Bold.ttf');
GlobalFonts.registerFromPath(fontPath, 'JetBrains Mono');

const PLAYERS_ADDRESS = (process.env.NEXT_PUBLIC_CLOUDFC_PLAYERS_ADDRESS ?? '0x597f4d2C59eE490006d5e2b8f6F70BAb88e05Ec4') as `0x${string}`;

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const getStatsAbi = [{
  type: 'function' as const,
  name: 'getStats',
  inputs: [{ name: 'playerId', type: 'uint256' }],
  outputs: [
    { name: 'spd', type: 'uint8' },
    { name: 'pas', type: 'uint8' },
    { name: 'sho', type: 'uint8' },
    { name: 'def', type: 'uint8' },
    { name: 'sta', type: 'uint8' },
  ],
  stateMutability: 'view' as const,
}] as const;

// Canvas factory for server-side rendering via @napi-rs/canvas
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serverCanvasFactory = (w: number, h: number) => createCanvas(w, h) as any;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const tokenId = Number(params.id);

  if (!Number.isInteger(tokenId) || tokenId < 0) {
    return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 });
  }

  try {
    const result = await client.readContract({
      address: PLAYERS_ADDRESS,
      abi: getStatsAbi,
      functionName: 'getStats',
      args: [BigInt(tokenId)],
    });

    const [spd, pas, sho, def, sta] = result as [number, number, number, number, number];

    const stats: PlayerStats = {
      speed: spd,
      passing: pas,
      shooting: sho,
      defense: def,
      stamina: sta,
    };

    const avg = Math.round((spd + pas + sho + def + sta) / 5);
    const tier = playerTier(avg);
    const name = playerName(tokenId, tier);

    const canvas = renderCard(tokenId, stats, tier, name, serverCanvasFactory);

    // @napi-rs/canvas returns a Canvas with toBuffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = (canvas as any).toBuffer('image/png');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: unknown) {
    // Contract reverts with PlayerDoesNotExist for invalid IDs
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('PlayerDoesNotExist') || message.includes('revert')) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    console.error('Card render error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
