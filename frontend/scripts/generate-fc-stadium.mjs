#!/usr/bin/env node

/**
 * generate-fc-stadium.mjs
 *
 * Generates a dark futuristic stadium background image using DALL-E 3.
 *
 * Usage:
 *   node scripts/generate-fc-stadium.mjs
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
  console.log("Writing placeholder instead.");
  writePlaceholder();
  process.exit(0);
}

const API_URL = "https://api.openai.com/v1/images/generations";
const OUTPUT_DIR = path.join(BASE_DIR, "public/images");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "fc-stadium-bg.png");

const PROMPT =
  "Dark futuristic arena interior, viewed from center court looking outward. Cyan and purple LED accent strips along the architecture. Volumetric light beams cutting through atmospheric haze. Very dark overall — mostly blacks and deep blues with subtle colored lighting. No people, no text, no logos. Cinematic, moody, atmospheric. Suitable as a subtle website background at low opacity.";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function generateImage() {
  const body = {
    model: "dall-e-3",
    prompt: PROMPT,
    n: 1,
    size: "1792x1024",
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
    throw new Error(
      "No image data in response: " +
        JSON.stringify(data).substring(0, 500)
    );
  }

  return Buffer.from(b64, "base64");
}

/**
 * Create a minimal dark placeholder PNG (gradient from dark purple to black).
 */
function createPlaceholderPng(width, height) {
  const rawSize = height * (1 + width * 4);
  const raw = Buffer.alloc(rawSize);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter byte
    const t = y / height;
    for (let x = 0; x < width; x++) {
      const xt = x / width;
      // Dark with subtle cyan/purple hints
      raw[offset++] = Math.round(5 + 10 * (1 - t) * xt); // R
      raw[offset++] = Math.round(5 + 15 * (1 - t) * (1 - xt)); // G (cyan)
      raw[offset++] = Math.round(10 + 20 * (1 - t)); // B (purple)
      raw[offset++] = 255; // A
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

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressedData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function writePlaceholder() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const placeholder = createPlaceholderPng(256, 144);
  fs.writeFileSync(OUTPUT_FILE, placeholder);
  console.log(`Placeholder saved: ${OUTPUT_FILE} (${placeholder.length} bytes)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("==============================================");
  console.log(" FC Stadium Background Generator (DALL-E 3)");
  console.log("==============================================");
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log("");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    console.log("Generating stadium background...");
    const imgBuf = await generateImage();
    fs.writeFileSync(OUTPUT_FILE, imgBuf);
    console.log(`OK — saved (${imgBuf.length} bytes)`);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    console.log("Writing placeholder instead.");
    writePlaceholder();
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
