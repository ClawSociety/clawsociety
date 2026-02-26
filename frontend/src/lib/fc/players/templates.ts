// ─────────────────── Pixel Art Templates ──────────────────────────
// Body part pixel arrays using material codes.
// Material codes are resolved to actual hex colors per-player at bake time.
// Same template → completely different characters just by changing the color map.

// ── Material Codes ────────────────────────────────────────────────
export const MAT = {
  _: 0,   // transparent
  S: 1,   // skin
  Sd: 2,  // skin shadow
  Sh: 3,  // skin highlight
  J: 4,   // jersey
  Jd: 5,  // jersey shadow
  Jh: 6,  // jersey highlight
  P: 7,   // shorts (pants)
  Pd: 8,  // shorts shadow
  H: 9,   // hair
  Hd: 10, // hair shadow
  B: 11,  // boots
  O: 12,  // outline (eyes, auto-outline border)
  G: 13,  // gloves (GK=gold, others=skin)
  K: 14,  // socks
  N: 15,  // jersey number (white)
} as const;

export type MaterialCode = (typeof MAT)[keyof typeof MAT];

// ── Body Part Template ────────────────────────────────────────────
export interface BodyPartTemplate {
  w: number;
  h: number;
  pixels: number[]; // flat row-major array, length = w * h
}

const { _, S, Sd, Sh, J, Jd, Jh, P, Pd, H, Hd, B, O, G, K } = MAT;

// ── Head (8×7) ────────────────────────────────────────────────────

export const HEAD_FRONT: BodyPartTemplate = {
  w: 8, h: 7,
  pixels: [
    _, _, S, S, S, S, _, _,  // top of head
    _, S, S, S, S, S, S, _,  // forehead
    S, S,Sh, O, S, O,Sh, S,  // eyes: highlight=white, outline=pupil
    S, S, S, S, S, S, S, S,  // cheeks
    _, S, S,Sd,Sd, S, S, _,  // mouth hint (shadow)
    _, _, S, S, S, S, _, _,  // jaw
    _, _, _,Sd,Sd, _, _, _,  // neck
  ],
};

export const HEAD_BACK: BodyPartTemplate = {
  w: 8, h: 7,
  pixels: [
    _, _, S, S, S, S, _, _,
    _, S, S, S, S, S, S, _,
    S, S, S, S, S, S, S, S,
    S, S, S, S, S, S, S, S,
    _, S, S, S, S, S, S, _,
    _, _,Sd,Sd,Sd,Sd, _, _,
    _, _, _,Sd,Sd, _, _, _,
  ],
};

export const HEAD_SIDE: BodyPartTemplate = {
  w: 8, h: 7,
  pixels: [
    _, _, S, S, S, S, _, _,
    _, S, S, S, S, S, _, _,
    S, S, S,Sh, O, S, _, _,  // one eye in profile
    S, S, S, S, S, S, _, _,
    _, S, S, S,Sd, _, _, _,  // mouth hint
    _, _, S, S, S, _, _, _,
    _, _, _,Sd,Sd, _, _, _,
  ],
};

// Face variants: different eye/expression patterns stamped onto head
// Each is a sparse overlay: [x, y, materialCode] relative to head origin
export type FaceOverlay = [number, number, number][];

export const FACE_VARIANTS: FaceOverlay[] = [
  // Type 0: Default (wide eyes) — uses HEAD_FRONT as-is
  [],
  // Type 1: Narrow eyes (determined look)
  [[2, 2, S], [5, 2, S], [3, 2, O], [4, 2, O]],
  // Type 2: Happy (curved mouth)
  [[3, 4, S], [4, 4, S], [3, 3, Sd], [4, 3, Sd]],
  // Type 3: Tough (thicker brow line)
  [[2, 1, Sd], [3, 1, Sd], [4, 1, Sd], [5, 1, Sd]],
  // Type 4: Calm (relaxed half-closed eyes)
  [[3, 2, Sd], [4, 2, Sd], [3, 4, Sh], [4, 4, Sh]],
  // Type 5: Intense (furrowed brow + narrow eyes)
  [[2, 1, Sd], [5, 1, Sd], [2, 2, S], [5, 2, S], [3, 2, O], [4, 2, O]],
  // Type 6: Scowl (angry mouth + brow)
  [[2, 1, Sd], [5, 1, Sd], [3, 4, Sd], [4, 4, Sd], [3, 5, S], [4, 5, S]],
  // Type 7: Scar (mark across left eye)
  [[1, 2, Sd], [2, 3, Sd], [3, 4, Sd]],
];

// ── Hair (various sizes) ─────────────────────────────────────────

export const HAIR_BUZZ: BodyPartTemplate = {
  w: 8, h: 3,
  pixels: [
    _, _, H, H, H, H, _, _,
    _, H, H, H, H, H, H, _,
    _, _,Hd,Hd,Hd,Hd, _, _,
  ],
};

export const HAIR_SHORT: BodyPartTemplate = {
  w: 8, h: 4,
  pixels: [
    _, _, H, H, H, H, _, _,
    _, H, H, H, H, H, H, _,
    H, H,Hd,Hd,Hd,Hd, H, H,
    H, _, _, _, _, _, _, H,
  ],
};

export const HAIR_MOHAWK: BodyPartTemplate = {
  w: 4, h: 6,
  pixels: [
    _, H, H, _,
    _, H, H, _,
    H, H, H, H,
    H,Hd,Hd, H,
    _, H, H, _,
    _, _, _, _,
  ],
};

export const HAIR_SWEPT: BodyPartTemplate = {
  w: 8, h: 4,
  pixels: [
    _, _, _, H, H, H, H, _,
    _, _, H, H, H, H, H, H,
    _, H, H,Hd,Hd,Hd, _, _,
    H, H, _, _, _, _, _, _,
  ],
};

export const HAIR_AFRO: BodyPartTemplate = {
  w: 10, h: 5,
  pixels: [
    _, _, H, H, H, H, H, H, _, _,
    _, H, H, H, H, H, H, H, H, _,
    H, H, H,Hd,Hd,Hd,Hd, H, H, H,
    H, H, _, _, _, _, _, _, H, H,
    _, H, _, _, _, _, _, _, H, _,
  ],
};

// Bald — empty template (no hair drawn)
export const HAIR_BALD: BodyPartTemplate = { w: 0, h: 0, pixels: [] };

// ── New hair styles ──────────────────────────────────────────

export const HAIR_DREADS: BodyPartTemplate = {
  w: 10, h: 6,
  pixels: [
    _, _, H, H, H, H, H, H, _, _,
    _, H, H,Hd,Hd,Hd,Hd, H, H, _,
    H, H, _, _, _, _, _, _, H, H,
    H, _, _, _, _, _, _, _, _, H,
    H, _, _, _, _, _, _, _, _, H,
    H, _, _, _, _, _, _, _, _, H,
  ],
};

export const HAIR_TOPKNOT: BodyPartTemplate = {
  w: 6, h: 7,
  pixels: [
    _, _, H, H, _, _,
    _, H, H, H, H, _,
    _, _, H, H, _, _,
    _, H, H, H, H, _,
    H, H,Hd,Hd, H, H,
    H, _, _, _, _, H,
    _, _, _, _, _, _,
  ],
};

export const HAIR_FAUXHAWK: BodyPartTemplate = {
  w: 8, h: 5,
  pixels: [
    _, _, _, H, H, H, _, _,
    _, _, H, H, H, H, H, _,
    _, H, H,Hd,Hd,Hd, H, _,
    H, H, _, _, _, _, _, _,
    H, _, _, _, _, _, _, _,
  ],
};

export const HAIR_CURTAINS: BodyPartTemplate = {
  w: 10, h: 4,
  pixels: [
    _, _, H, H, _, _, H, H, _, _,
    _, H, H,Hd, _, _,Hd, H, H, _,
    H, H, _, _, _, _, _, _, H, H,
    H, _, _, _, _, _, _, _, _, H,
  ],
};

// Hair variant lookup: index matches hairType field in PlayerAppearance
export const HAIR_VARIANTS: BodyPartTemplate[] = [
  HAIR_BUZZ,     // 0
  HAIR_SHORT,    // 1
  HAIR_MOHAWK,   // 2
  HAIR_SWEPT,    // 3
  HAIR_AFRO,     // 4
  HAIR_BALD,     // 5
  HAIR_DREADS,   // 6
  HAIR_TOPKNOT,  // 7
  HAIR_FAUXHAWK, // 8
  HAIR_CURTAINS, // 9
];

// Hair Y-offset relative to head top (negative = above head)
export const HAIR_OFFSETS_Y: number[] = [
  -1,  // buzz: sits just above head
  -2,  // short: extends above
  -4,  // mohawk: tall spike
  -2,  // swept: similar to short
  -3,  // afro: big volume
  0,   // bald: nothing
  -3,  // dreads: hanging down from head
  -5,  // topknot: tall bun
  -3,  // fauxhawk: asymmetric
  -2,  // curtains: parted
];

// Hair X-offset relative to head left edge
export const HAIR_OFFSETS_X: number[] = [
  0,   // buzz: same width as head
  0,   // short: same width
  2,   // mohawk: narrower, centered
  0,   // swept: same width
  -1,  // afro: wider than head
  0,   // bald
  -1,  // dreads: wider than head
  1,   // topknot: narrower, centered
  0,   // fauxhawk: same width
  -1,  // curtains: wider than head
];

// ── Torso (8×7) — Normal build ───────────────────────────────────

export const TORSO_FRONT: BodyPartTemplate = {
  w: 8, h: 7,
  pixels: [
    _, J, J, J, J, J, J, _,  // shoulders
    J, J, J, J, J, J, J, J,  // upper chest
    J,Jh, J, J, J, J,Jh, J,  // highlight on sides
    J, J, J, J, J, J, J, J,  // mid torso
    J,Jd, J, J, J, J,Jd, J,  // shadow on sides
    J,Jd, J, J, J, J,Jd, J,  // lower torso
    _, J, J, J, J, J, J, _,  // waist
  ],
};

// ── Torso Slim (6×7) ────────────────────────────────────────────

export const TORSO_SLIM: BodyPartTemplate = {
  w: 6, h: 7,
  pixels: [
    _, J, J, J, J, _,  // shoulders
    J, J, J, J, J, J,  // upper chest
    J,Jh, J, J,Jh, J,  // highlight
    J, J, J, J, J, J,  // mid
    J,Jd, J, J,Jd, J,  // shadow
    J,Jd, J, J,Jd, J,  // lower
    _, J, J, J, J, _,  // waist
  ],
};

// ── Torso Stocky (10×7) ─────────────────────────────────────────

export const TORSO_STOCKY: BodyPartTemplate = {
  w: 10, h: 7,
  pixels: [
    _, _, J, J, J, J, J, J, _, _,  // shoulders
    _, J, J, J, J, J, J, J, J, _,  // upper chest
    J, J,Jh, J, J, J, J,Jh, J, J,  // highlight
    J, J, J, J, J, J, J, J, J, J,  // mid
    J, J,Jd, J, J, J, J,Jd, J, J,  // shadow
    _, J,Jd, J, J, J, J,Jd, J, _,  // lower
    _, _, J, J, J, J, J, J, _, _,  // waist
  ],
};

// ── Shorts (8×3) — Normal build ──────────────────────────────────

export const SHORTS: BodyPartTemplate = {
  w: 8, h: 3,
  pixels: [
    P, P, P, P, P, P, P, P,  // waistband
    P,Pd, P, P, P, P,Pd, P,  // shadow on sides
    P, P, _, _, _, _, P, P,   // leg openings
  ],
};

// ── Shorts Slim (6×3) ───────────────────────────────────────────

export const SHORTS_SLIM: BodyPartTemplate = {
  w: 6, h: 3,
  pixels: [
    P, P, P, P, P, P,  // waistband
    P,Pd, P, P,Pd, P,  // shadow
    P, _, _, _, _, P,   // leg openings
  ],
};

// ── Shorts Stocky (10×3) ────────────────────────────────────────

export const SHORTS_STOCKY: BodyPartTemplate = {
  w: 10, h: 3,
  pixels: [
    _, P, P, P, P, P, P, P, P, _,  // waistband
    P, P,Pd, P, P, P, P,Pd, P, P,  // shadow
    P, P, _, _, _, _, _, _, P, P,   // leg openings
  ],
};

// ── Arm (3×8) ────────────────────────────────────────────────────
// Sleeve (jersey) at top, skin forearm, hand/glove at bottom

export const ARM: BodyPartTemplate = {
  w: 3, h: 8,
  pixels: [
    J, J, _,  // sleeve top
    J,Jd, _,  // sleeve shadow
    J, J, _,  // sleeve bottom
    S, S, _,  // upper forearm
    S,Sd, _,  // forearm shadow
    S, S, _,  // lower forearm
    G, G, _,  // hand (glove for GK, skin for others)
    _, G, _,  // fingertips
  ],
};

// Long sleeve variant (for GK or sleeveStyle=long)
export const ARM_LONG: BodyPartTemplate = {
  w: 3, h: 8,
  pixels: [
    J, J, _,  // sleeve
    J,Jd, _,
    J, J, _,
    J,Jd, _,  // continued sleeve
    J, J, _,
    J, J, _,  // cuff
    G, G, _,  // hand/glove
    _, G, _,
  ],
};

// ── Leg (3×7) ────────────────────────────────────────────────────

export const LEG: BodyPartTemplate = {
  w: 3, h: 7,
  pixels: [
    S, S, _,  // thigh
    S,Sd, _,  // thigh shadow
    S, S, _,  // knee
    K, K, _,  // sock top
    K, K, _,  // sock mid
    K, K, _,  // sock bottom
    _, _, _,  // gap (boot drawn separately)
  ],
};

// ── Boot (4×3) ───────────────────────────────────────────────────

export const BOOT: BodyPartTemplate = {
  w: 4, h: 3,
  pixels: [
    _, B, B, _,  // ankle
    B, B, B, B,  // sole
    _, B, B, _,  // toe/stud
  ],
};

// ── Jersey Number Font (3×5 per digit) ───────────────────────────
// 1 = filled pixel, 0 = transparent

export const DIGIT_FONT: number[][] = [
  // Digit 0 (unused, placeholder)
  [1,1,1, 1,0,1, 1,0,1, 1,0,1, 1,1,1],
  // Digit 1
  [0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1],
  // Digit 2
  [1,1,0, 0,0,1, 0,1,0, 1,0,0, 1,1,1],
  // Digit 3
  [1,1,0, 0,0,1, 0,1,0, 0,0,1, 1,1,0],
  // Digit 4
  [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1],
  // Digit 5
  [1,1,1, 1,0,0, 1,1,0, 0,0,1, 1,1,0],
  // Digit 6
  [0,1,1, 1,0,0, 1,1,1, 1,0,1, 0,1,0],
  // Digit 7
  [1,1,1, 0,0,1, 0,1,0, 0,1,0, 0,1,0],
  // Digit 8
  [1,1,1, 1,0,1, 1,1,1, 1,0,1, 1,1,1],
  // Digit 9
  [0,1,0, 1,0,1, 1,1,1, 0,0,1, 1,1,0],
];

// ── Accessory overlays ───────────────────────────────────────────
// Sparse pixel overlays: [x, y, materialCode] relative to body part
// Applied after main body parts, before auto-outline

// Headband: horizontal band across forehead (relative to head position)
export const ACCESSORY_HEADBAND: [number, number, number][] = [
  [1, 1, O], [2, 1, O], [3, 1, O], [4, 1, O], [5, 1, O], [6, 1, O],
];

// Captain armband: band on left arm (relative to arm position)
export const ACCESSORY_CAPTAIN: [number, number, number][] = [
  [0, 3, O], [1, 3, O],
];

// Wristband: 2 pixels on arm at y=4 (relative to arm position)
export const ACCESSORY_WRISTBAND: [number, number, number][] = [
  [0, 4, O], [1, 4, O],
];
