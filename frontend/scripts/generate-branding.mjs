#!/usr/bin/env node

/**
 * generate-branding.mjs
 *
 * Generates logo, favicon, apple-touch-icon, and OG image for Claw Society
 * using the Google Gemini API (same approach as generate-tiles.mjs).
 *
 * Usage:
 *   node scripts/generate-branding.mjs
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = "AIzaSyCSOGC1qAzjr4YKjNq8lrjZRibE9TGE2l8";
const MODEL = "gemini-2.0-flash-exp-image-generation";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const DELAY_MS = 3000; // pause between API calls to respect rate limits

const BASE_DIR = "/home/lumen/clawsociety/frontend";

const ASSETS = [
  {
    name: "Logo (512x512)",
    outputPath: path.join(BASE_DIR, "public/logo.png"),
    prompt:
      "Design a bold emblem logo for 'Claw Society', a cyberpunk crypto city. The logo features a stylized mechanical claw or talon gripping a glowing green hexagonal gem, surrounded by circuit board traces. Neon green (#00ff88) is the primary accent color on a dark background (#0a0a0a). Style: flat vector cyberpunk, clean lines, symmetrical, suitable as an app icon. No text. Dark background. High contrast neon glow. Image size: 512x512 pixels.",
  },
  {
    name: "Favicon (32x32)",
    outputPath: path.join(BASE_DIR, "src/app/favicon.ico"),
    prompt:
      "A tiny 32x32 pixel icon of a stylized green neon claw/talon symbol on a pure black background. Minimal detail, just the iconic claw shape glowing in bright green (#00ff88). Pixel-perfect, clean edges, no text, suitable as a browser tab favicon. Image size: 32x32 pixels.",
  },
  {
    name: "Apple Touch Icon (180x180)",
    outputPath: path.join(BASE_DIR, "src/app/apple-icon.png"),
    prompt:
      "App icon for 'Claw Society'. A stylized mechanical claw gripping a glowing green gem on a solid dark background (#111111). Cyberpunk style with neon green (#00ff88) accents. Rounded corners friendly. No transparency. No text. Clean, bold, recognizable at small size. Image size: 180x180 pixels.",
  },
  {
    name: "OG Image (1200x630)",
    outputPath: path.join(BASE_DIR, "src/app/opengraph-image.png"),
    prompt:
      "Wide banner image for 'Claw Society' — a cyberpunk city grid game on blockchain. Show a dark futuristic cityscape with a 10x10 grid of neon-lit buildings viewed from above at an angle. The title 'CLAW SOCIETY' appears in large bold neon green (#00ff88) glowing text at center. Below the title: '100 SEATS. HARBERGER-TAXED. ETH FROM EVERY TRADE.' in smaller white text. Dark background (#0a0a0a). Cyberpunk aesthetic with purple, cyan, and green neon accents. Image size: 1200x630 pixels.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/**
 * Create a minimal valid PNG with a solid colour (fallback placeholder).
 */
function createPlaceholderPng(width, height, r, g, b) {
  const rawSize = height * (1 + width * 4);
  const raw = Buffer.alloc(rawSize);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
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

// Placeholder dimensions per asset
const PLACEHOLDER_DIMS = [
  [512, 512],
  [32, 32],
  [180, 180],
  [1200, 630],
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("==============================================");
  console.log(" Claw Society - Branding Asset Generator");
  console.log("==============================================");
  console.log(`Model : ${MODEL}`);
  console.log(`Assets: ${ASSETS.length}`);
  console.log("");

  for (let i = 0; i < ASSETS.length; i++) {
    const asset = ASSETS[i];
    console.log(`\n[${i + 1}/${ASSETS.length}] Generating: ${asset.name}`);
    console.log(`  Output: ${asset.outputPath}`);

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(asset.outputPath), { recursive: true });

    if (i > 0) {
      console.log(`  Waiting ${DELAY_MS / 1000}s before request...`);
      await sleep(DELAY_MS);
    }

    try {
      const imgBuf = await generateImageWithGemini(asset.prompt);
      fs.writeFileSync(asset.outputPath, imgBuf);
      console.log(`  OK — saved (${imgBuf.length} bytes)`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      console.log("  Writing placeholder instead.");
      const [w, h] = PLACEHOLDER_DIMS[i];
      const placeholder = createPlaceholderPng(w, h, 0, 255, 136); // #00ff88
      fs.writeFileSync(asset.outputPath, placeholder);
      console.log(`  Placeholder saved (${placeholder.length} bytes)`);
    }
  }

  console.log("\n==============================================");
  console.log(" Generation complete!");
  console.log("==============================================");

  for (const asset of ASSETS) {
    if (fs.existsSync(asset.outputPath)) {
      const stat = fs.statSync(asset.outputPath);
      console.log(`  ${asset.name}: ${asset.outputPath} (${stat.size} bytes)`);
    } else {
      console.log(`  ${asset.name}: MISSING`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
