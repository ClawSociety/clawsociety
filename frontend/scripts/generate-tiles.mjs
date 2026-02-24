#!/usr/bin/env node

/**
 * generate-tiles.mjs
 *
 * Generates 10 cyberpunk building tile images for the Claw Society dApp
 * using the Google Gemini API (image generation via generateContent).
 *
 * Usage:
 *   node scripts/generate-tiles.mjs
 *
 * If the Gemini API is unavailable or the key is invalid, the script falls
 * back to generating solid-color placeholder PNGs so the build pipeline is
 * never blocked.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = "AIzaSyCSOGC1qAzjr4YKjNq8lrjZRibE9TGE2l8";
const MODEL = "gemini-2.0-flash-exp-image-generation";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const OUTPUT_DIR = "/home/lumen/clawsociety/frontend/public/buildings";
const DELAY_MS = 2000; // pause between API calls to respect rate limits

const BUILDING_TYPES = [
  {
    id: 0,
    name: "Server Farm",
    description:
      "a futuristic glowing server room with blue and red neon lights, cyberpunk style",
  },
  {
    id: 1,
    name: "Bank",
    description:
      "a grand cyberpunk vault and bank building with gold neon accents",
  },
  {
    id: 2,
    name: "AI Lab",
    description:
      "a high-tech laboratory with holographic displays and cyan neon",
  },
  {
    id: 3,
    name: "Arena",
    description:
      "a battle arena and colosseum with orange fire effects and neon lights",
  },
  {
    id: 4,
    name: "Market",
    description:
      "a bustling neon market and bazaar with green holographic signs",
  },
  {
    id: 5,
    name: "Factory",
    description:
      "a mechanical factory with purple neon pipes and steam",
  },
  {
    id: 6,
    name: "Cafe",
    description:
      "a cozy cyberpunk coffee shop with warm orange neon signs",
  },
  {
    id: 7,
    name: "Club",
    description:
      "a nightclub with pink and magenta neon and music visualizations",
  },
  {
    id: 8,
    name: "Quarters",
    description:
      "living quarters and apartments with blue neon windows at night",
  },
  {
    id: 9,
    name: "Park",
    description:
      "a cyber-garden with bioluminescent plants and green glow",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrompt(description) {
  return (
    "Pixel art, 64x64, cyberpunk isometric building view, " +
    description +
    ", dark background, neon glow effects, vibrant colors, no text, game tile style"
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a minimal valid 64x64 PNG with a solid colour.
 * This is a self-contained PNG encoder (no dependencies) that writes a
 * well-formed file browsers and Next.js can load.
 */
function createPlaceholderPng(r, g, b) {
  const width = 64;
  const height = 64;

  // ---------- Build raw RGBA scanlines (filter byte 0 = None per row) ------
  const rawSize = height * (1 + width * 4); // filter byte + RGBA per pixel
  const raw = Buffer.alloc(rawSize);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = 255; // alpha
    }
  }

  // ---------- zlib deflate (store only, no compression) --------------------
  // We split into 65535-byte blocks (max deflate stored block).
  const blocks = [];
  let pos = 0;
  while (pos < raw.length) {
    const end = Math.min(pos + 65535, raw.length);
    const len = end - pos;
    const last = end === raw.length ? 1 : 0;
    const header = Buffer.alloc(5);
    header[0] = last; // BFINAL + BTYPE=00
    header.writeUInt16LE(len, 1);
    header.writeUInt16LE(len ^ 0xffff, 3);
    blocks.push(header, raw.subarray(pos, end));
    pos = end;
  }

  // zlib wrapper: CMF=0x78, FLG=0x01  (deflate, no dict, check bits)
  const zlibHeader = Buffer.from([0x78, 0x01]);
  const deflated = Buffer.concat([zlibHeader, ...blocks]);

  // Adler-32 of uncompressed data
  let a = 1,
    b2 = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]) % 65521;
    b2 = (b2 + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(((b2 << 16) | a) >>> 0, 0);

  const compressedData = Buffer.concat([deflated, adler]);

  // ---------- PNG chunks ---------------------------------------------------
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crc]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width(4) height(4) bitDepth(1) colorType(1) compression(1) filter(1) interlace(1)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = chunk("IHDR", ihdrData);
  const idat = chunk("IDAT", compressedData);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Accent colours per building type (used for placeholders)
const PLACEHOLDER_COLORS = [
  [40, 80, 200],  // 0 Server Farm  - blue
  [200, 170, 40], // 1 Bank         - gold
  [0, 200, 210],  // 2 AI Lab       - cyan
  [220, 120, 20], // 3 Arena        - orange
  [30, 180, 60],  // 4 Market       - green
  [140, 40, 200], // 5 Factory      - purple
  [210, 140, 50], // 6 Cafe         - warm orange
  [210, 40, 160], // 7 Club         - magenta
  [50, 90, 200],  // 8 Quarters     - blue
  [40, 200, 80],  // 9 Park         - green
];

// ---------------------------------------------------------------------------
// Gemini API image generation
// ---------------------------------------------------------------------------

async function generateImageWithGemini(prompt) {
  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errBody}`);
  }

  const data = await response.json();

  // Walk through candidate parts looking for inline image data
  const candidates = data.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      const inlineData = part.inlineData || part.inline_data;
      if (inlineData && inlineData.data) {
        return Buffer.from(inlineData.data, "base64");
      }
    }
  }

  throw new Error(
    "No image data found in Gemini response. Full response: " +
      JSON.stringify(data).substring(0, 500)
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("==============================================");
  console.log(" Claw Society - Building Tile Generator");
  console.log("==============================================");
  console.log(`Output directory : ${OUTPUT_DIR}`);
  console.log(`Model            : ${MODEL}`);
  console.log(`Buildings        : ${BUILDING_TYPES.length}`);
  console.log("");

  let useApi = true;

  // -- Quick connectivity / auth check with the first building ---------------
  {
    const firstPrompt = buildPrompt(BUILDING_TYPES[0].description);
    console.log("[pre-flight] Testing Gemini API with first prompt...");
    try {
      const imgBuf = await generateImageWithGemini(firstPrompt);
      const outPath = path.join(OUTPUT_DIR, "0.png");
      fs.writeFileSync(outPath, imgBuf);
      console.log(
        `[pre-flight] Success! Saved ${outPath} (${imgBuf.length} bytes)`
      );
    } catch (err) {
      console.warn(`[pre-flight] Gemini API unavailable: ${err.message}`);
      console.warn(
        "[pre-flight] Falling back to placeholder PNG generation.\n"
      );
      useApi = false;

      // Write placeholder for building 0
      const [r, g, b] = PLACEHOLDER_COLORS[0];
      const placeholder = createPlaceholderPng(r, g, b);
      const outPath = path.join(OUTPUT_DIR, "0.png");
      fs.writeFileSync(outPath, placeholder);
      console.log(
        `[0/9] (placeholder) ${BUILDING_TYPES[0].name} -> ${outPath} (${placeholder.length} bytes)`
      );
    }
  }

  // -- Generate remaining buildings (1-9) ------------------------------------
  for (let i = 1; i < BUILDING_TYPES.length; i++) {
    const building = BUILDING_TYPES[i];
    const outPath = path.join(OUTPUT_DIR, `${building.id}.png`);
    const prompt = buildPrompt(building.description);

    console.log(
      `\n[${i}/${BUILDING_TYPES.length - 1}] Generating: ${building.name} (type ${building.id})`
    );
    console.log(`  Prompt: ${prompt}`);

    if (useApi) {
      try {
        // Delay to stay within rate limits
        if (i > 0) {
          console.log(`  Waiting ${DELAY_MS / 1000}s before request...`);
          await sleep(DELAY_MS);
        }

        const imgBuf = await generateImageWithGemini(prompt);
        fs.writeFileSync(outPath, imgBuf);
        console.log(`  Saved: ${outPath} (${imgBuf.length} bytes)`);
      } catch (err) {
        console.error(`  ERROR generating ${building.name}: ${err.message}`);
        console.log("  Writing placeholder instead.");
        const [r, g, b] = PLACEHOLDER_COLORS[building.id];
        const placeholder = createPlaceholderPng(r, g, b);
        fs.writeFileSync(outPath, placeholder);
        console.log(
          `  Placeholder saved: ${outPath} (${placeholder.length} bytes)`
        );
      }
    } else {
      const [r, g, b] = PLACEHOLDER_COLORS[building.id];
      const placeholder = createPlaceholderPng(r, g, b);
      fs.writeFileSync(outPath, placeholder);
      console.log(
        `  (placeholder) Saved: ${outPath} (${placeholder.length} bytes)`
      );
    }
  }

  // -- Summary ---------------------------------------------------------------
  console.log("\n==============================================");
  console.log(" Generation complete!");
  console.log("==============================================");

  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".png"));
  console.log(`Files in ${OUTPUT_DIR}:`);
  for (const file of files.sort()) {
    const stat = fs.statSync(path.join(OUTPUT_DIR, file));
    console.log(`  ${file}  (${stat.size} bytes)`);
  }

  if (!useApi) {
    console.log(
      "\nNOTE: Placeholder images were generated because the Gemini API was"
    );
    console.log(
      "unavailable. Replace the API key or re-run when the API is accessible"
    );
    console.log("to get AI-generated building tiles.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
