export interface Seat {
  holder: string;
  price: bigint;
  deposit: bigint;
  lastTaxTime: bigint;
  lastPriceChangeTime: bigint;
  buildingType: number;
}

export interface BuildingConfig {
  name: string;
  emoji: string;
  color: string;
  borderColor: string;
  multiplier: number;
  glowColor: string;
}

export type SeatStatus = 'available' | 'owned' | 'mine' | 'forfeiting';
