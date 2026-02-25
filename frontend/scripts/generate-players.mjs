#!/usr/bin/env node

/**
 * generate-players.mjs
 *
 * Generates ~200 player card portraits (50 per tier) for CloudFC Lootbox.
 * Uses OpenAI gpt-image-1 API.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-players.mjs
 *
 * Falls back to colored placeholder PNGs if API unavailable.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = "dall-e-2";
const API_URL = "https://api.openai.com/v1/images/generations";

const OUTPUT_BASE = "/home/lumen/clawsociety/frontend/public/fc-cards";
const DELAY_MS = 1500; // pause between API calls
const IMAGES_PER_TIER = 50;
const IMAGE_SIZE = "256x256";

const TIERS = [
  {
    name: "bronze",
    prompt:
      "Pixel art portrait, 256x256, amateur street footballer, worn jersey, determined expression, urban background, gritty style, dark tones, no text, no letters, no watermark",
    color: [205, 127, 50],
  },
  {
    name: "silver",
    prompt:
      "Pixel art portrait, 256x256, skilled footballer, clean kit, confident pose, stadium lights background, vibrant colors, no text, no letters, no watermark",
    color: [192, 192, 192],
  },
  {
    name: "gold",
    prompt:
      "Pixel art portrait, 256x256, elite footballer, golden highlights, intense expression, spotlight background, premium feel, golden aura, no text, no letters, no watermark",
    color: [255, 215, 0],
  },
  {
    name: "diamond",
    prompt:
      "Pixel art portrait, 256x256, legendary footballer, glowing diamond aura, epic pose, cosmic background, ethereal glow, masterpiece quality, no text, no letters, no watermark",
    color: [185, 242, 255],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a minimal valid 256x256 PNG with a solid colour and gradient.
 */
function createPlaceholderPng(r, g, b) {
  const width = 256;
  const height = 256;

  const rawSize = height * (1 + width * 4);
  const raw = Buffer.alloc(rawSize);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter: None
    const fade = 1 - y / height * 0.6;
    for (let x = 0; x < width; x++) {
      raw[offset++] = Math.round(r * fade);
      raw[offset++] = Math.round(g * fade);
      raw[offset++] = Math.round(b * fade);
      raw[offset++] = 255;
    }
  }

  // zlib store (no compression)
  const blocks = [];
  let pos = 0;
  while (pos < raw.length) {
    const end = Math.min(pos + 65535, raw.length);
    const len = end - pos;
    const last = end === raw.length ? 1 : 0;
    const header = Buffer.alloc(5);
    header[0] = last;
    header.writeUInt16LE(len, 1);
    header.writeUInt16LE(len ^ 0xffff, 3);
    blocks.push(header, raw.subarray(pos, end));
    pos = end;
  }

  const zlibHeader = Buffer.from([0x78, 0x01]);
  const deflated = Buffer.concat([zlibHeader, ...blocks]);

  let a = 1, b2 = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]) % 65521;
    b2 = (b2 + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(((b2 << 16) | a) >>> 0, 0);

  const compressedData = Buffer.concat([deflated, adler]);

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

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = chunk("IHDR", ihdrData);
  const idat = chunk("IDAT", compressedData);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ---------------------------------------------------------------------------
// OpenAI Image Generation API
// ---------------------------------------------------------------------------

async function generateImageWithOpenAI(prompt, variation) {
  const fullPrompt = `${prompt}, unique character variation ${variation}, facing forward`;

  const body = {
    model: MODEL,
    prompt: fullPrompt,
    n: 1,
    size: IMAGE_SIZE,
    response_format: "b64_json",
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${errBody}`);
  }

  const data = await response.json();

  // gpt-image-1 returns b64_json by default
  const imageData = data.data?.[0];
  if (imageData?.b64_json) {
    return Buffer.from(imageData.b64_json, "base64");
  }
  // Fallback: URL-based response
  if (imageData?.url) {
    const imgResponse = await fetch(imageData.url);
    if (!imgResponse.ok) throw new Error(`Failed to download image: ${imgResponse.status}`);
    const arrayBuf = await imgResponse.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  throw new Error(
    "No image data in response: " + JSON.stringify(data).substring(0, 500)
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("==============================================");
  console.log(" CloudFC - Player Card Generator (OpenAI)");
  console.log("==============================================");
  console.log(`Output: ${OUTPUT_BASE}`);
  console.log(`Model:  ${MODEL}`);
  console.log(`Size:   ${IMAGE_SIZE}`);
  console.log(`${TIERS.length} tiers x ${IMAGES_PER_TIER} = ${TIERS.length * IMAGES_PER_TIER} images`);
  console.log("");

  let useApi = !!API_KEY;

  if (!API_KEY) {
    console.warn("[pre-flight] No OPENAI_API_KEY set. Using placeholder PNGs.");
    console.warn("  Run with: OPENAI_API_KEY=sk-... node scripts/generate-players.mjs\n");
    useApi = false;
  }

  // Pre-flight check
  if (useApi) {
    console.log("[pre-flight] Testing OpenAI API...");
    try {
      const testImg = await generateImageWithOpenAI(TIERS[0].prompt, 0);
      const testDir = path.join(OUTPUT_BASE, TIERS[0].name);
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "0.png"), testImg);
      console.log(`[pre-flight] Success! (${testImg.length} bytes)\n`);
    } catch (err) {
      console.warn(`[pre-flight] API unavailable: ${err.message}`);
      console.warn("[pre-flight] Using placeholder PNGs.\n");
      useApi = false;
    }
  }

  for (const tier of TIERS) {
    const tierDir = path.join(OUTPUT_BASE, tier.name);
    fs.mkdirSync(tierDir, { recursive: true });

    console.log(`\n── ${tier.name.toUpperCase()} ──`);

    // Start from 0 (or 1 if pre-flight already wrote bronze/0)
    const startIdx = tier.name === "bronze" && useApi ? 1 : 0;

    for (let i = startIdx; i < IMAGES_PER_TIER; i++) {
      const outPath = path.join(tierDir, `${i}.png`);

      if (useApi) {
        try {
          if (i > startIdx || tier.name !== "bronze") {
            await sleep(DELAY_MS);
          }
          const imgBuf = await generateImageWithOpenAI(tier.prompt, i);
          fs.writeFileSync(outPath, imgBuf);
          console.log(`  [${i}/${IMAGES_PER_TIER - 1}] ${tier.name}/${i}.png (${imgBuf.length} bytes)`);
        } catch (err) {
          console.error(`  [${i}] ERROR: ${err.message}`);
          const [r, g, b] = tier.color;
          const placeholder = createPlaceholderPng(r, g, b);
          fs.writeFileSync(outPath, placeholder);
          console.log(`  [${i}] placeholder saved`);
        }
      } else {
        const [r, g, b] = tier.color;
        const placeholder = createPlaceholderPng(r, g, b);
        fs.writeFileSync(outPath, placeholder);
        if (i % 10 === 0) {
          console.log(`  [${i}..${Math.min(i + 9, IMAGES_PER_TIER - 1)}] placeholders`);
        }
      }
    }
  }

  // Summary
  console.log("\n==============================================");
  console.log(" Generation complete!");
  console.log("==============================================");

  for (const tier of TIERS) {
    const tierDir = path.join(OUTPUT_BASE, tier.name);
    if (fs.existsSync(tierDir)) {
      const files = fs.readdirSync(tierDir).filter(f => f.endsWith(".png"));
      console.log(`  ${tier.name}: ${files.length} images`);
    }
  }

  if (!useApi) {
    console.log("\nNOTE: Placeholder images generated.");
    console.log("Re-run with OPENAI_API_KEY=sk-... for AI-generated art.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
