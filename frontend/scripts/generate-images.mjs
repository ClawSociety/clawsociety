#!/usr/bin/env node

/**
 * generate-images.mjs
 *
 * Generates landing page and FC page hero images using DALL-E 3.
 *
 * Usage:
 *   node scripts/generate-images.mjs
 *
 * Requires OPENAI_API_KEY in .env.local (or environment).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, "..");

// Load .env.local
const envPath = path.join(BASE_DIR, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: OPENAI_API_KEY not found in environment or .env.local");
  process.exit(1);
}

const API_URL = "https://api.openai.com/v1/images/generations";
const DELAY_MS = 5000;

const OUTPUT_DIR = path.join(BASE_DIR, "public/images");

const IMAGES = [
  {
    name: "Hero Banner",
    file: "hero-banner.png",
    size: "1792x1024",
    prompt:
      "A breathtaking cyberpunk cityscape at night viewed from a rooftop. A glowing neon grid pattern covers the ground below, casting teal and purple light. Towering skyscrapers with holographic advertisements and neon signs in cyan, magenta, and electric green. Flying vehicles streak across a dark sky filled with digital constellations. The overall mood is futuristic, atmospheric, and immersive. Digital art style, high detail, cinematic lighting. No text or logos.",
  },
  {
    name: "FC Hero",
    file: "fc-hero.png",
    size: "1792x1024",
    prompt:
      "A pixel art style 5-versus-5 football match on a futuristic neon-lit pitch at night. One team wears cyan jerseys, the other wears magenta. The pitch has glowing neon field lines in electric green on a dark surface. A retro-futuristic stadium with holographic scoreboards and neon spectator stands surrounds the field. The ball trails a bright glow. Pixel art style mixed with modern particle effects. No text or logos. Atmospheric and exciting.",
  },
  {
    name: "Grid Illustration",
    file: "grid-illustration.png",
    size: "1024x1024",
    prompt:
      "An isometric view of a cyberpunk city grid with exactly 10 different types of glowing neon buildings on a dark background. Buildings include: a large server farm with blinking lights, a bank with gold accents, an AI laboratory with holographic displays, an arena with purple spotlights, a marketplace with neon signs, a factory with smoke and orange glow, a cozy cafe with warm light, a nightclub with laser beams, residential quarters with blue windows, and a green park with bioluminescent trees. Each building type is visually distinct and glows with different colored neon. Isometric pixel art style, detailed, atmospheric. No text.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(prompt, size) {
  const body = {
    model: "dall-e-3",
    prompt,
    n: 1,
    size,
    quality: "hd",
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
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image data in response: " + JSON.stringify(data).substring(0, 500));
  }

  return Buffer.from(b64, "base64");
}

/**
 * Create a minimal placeholder PNG with gradient (fallback if API fails).
 */
function createPlaceholderPng(width, height, r, g, b) {
  const rawSize = height * (1 + width * 4);
  const raw = Buffer.alloc(rawSize);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter byte
    const brightness = 1 - y / height * 0.5;
    for (let x = 0; x < width; x++) {
      raw[offset++] = Math.round(r * brightness);
      raw[offset++] = Math.round(g * brightness);
      raw[offset++] = Math.round(b * brightness);
      raw[offset++] = 255;
    }
  }

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

  let a = 1,
    b2 = 0;
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

const PLACEHOLDER_COLORS = [
  [10, 60, 40],   // hero - dark teal
  [40, 10, 60],   // fc - dark purple
  [10, 40, 30],   // grid - dark green
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("==============================================");
  console.log(" Claw Society - DALL-E 3 Image Generator");
  console.log("==============================================");
  console.log(`Images: ${IMAGES.length}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log("");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (let i = 0; i < IMAGES.length; i++) {
    const img = IMAGES[i];
    const outputPath = path.join(OUTPUT_DIR, img.file);
    console.log(`\n[${i + 1}/${IMAGES.length}] Generating: ${img.name}`);
    console.log(`  Size: ${img.size}`);
    console.log(`  Output: ${outputPath}`);

    if (i > 0) {
      console.log(`  Waiting ${DELAY_MS / 1000}s before request...`);
      await sleep(DELAY_MS);
    }

    try {
      const imgBuf = await generateImage(img.prompt, img.size);
      fs.writeFileSync(outputPath, imgBuf);
      console.log(`  OK — saved (${imgBuf.length} bytes)`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      console.log("  Writing placeholder instead.");
      const [w, h] = img.size.split("x").map(Number);
      const [r, g, b] = PLACEHOLDER_COLORS[i];
      const placeholder = createPlaceholderPng(w, h, r, g, b);
      fs.writeFileSync(outputPath, placeholder);
      console.log(`  Placeholder saved (${placeholder.length} bytes)`);
    }
  }

  console.log("\n==============================================");
  console.log(" Generation complete!");
  console.log("==============================================");

  for (const img of IMAGES) {
    const p = path.join(OUTPUT_DIR, img.file);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      console.log(`  ${img.name}: ${p} (${stat.size} bytes)`);
    } else {
      console.log(`  ${img.name}: MISSING`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
