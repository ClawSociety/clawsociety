import fs from 'node:fs';

const API_KEY = 'AIzaSyCSOGC1qAzjr4YKjNq8lrjZRibE9TGE2l8';
const MODEL = 'gemini-2.0-flash-exp-image-generation';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

async function gen(desc, file) {
  const prompt = `Pixel art, 64x64, cyberpunk isometric building view, ${desc}, dark background, neon glow effects, vibrant colors, no text, game tile style`;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
  const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { console.log('Error for', file, ':', await res.text()); return; }
  const data = await res.json();
  for (const c of (data.candidates || [])) {
    for (const p of (c.content?.parts || [])) {
      const d = p.inlineData || p.inline_data;
      if (d && d.data) { fs.writeFileSync(file, Buffer.from(d.data, 'base64')); console.log('Saved', file, fs.statSync(file).size, 'bytes'); return; }
    }
  }
  console.log('No image in response for', file);
}

(async () => {
  console.log('Retrying Arena (3)...');
  await gen('a battle arena and colosseum with orange fire effects and neon lights', '/home/lumen/clawsociety/frontend/public/buildings/3.png');
  await new Promise(r => setTimeout(r, 3000));
  console.log('Retrying Park (9)...');
  await gen('a cyber-garden with bioluminescent plants and green glow', '/home/lumen/clawsociety/frontend/public/buildings/9.png');
})();
