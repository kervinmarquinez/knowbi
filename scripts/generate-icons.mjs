import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'assets/mascot-head.png');

async function gen(outRel, size, scale, bg) {
  const out = resolve(ROOT, outRel);
  const inner = Math.round(size * scale);
  const mascot = await sharp(SRC)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const canvasBg = bg ?? { r: 0, g: 0, b: 0, alpha: 0 };
  await sharp({
    create: { width: size, height: size, channels: 4, background: canvasBg },
  })
    .composite([{ input: mascot, gravity: 'center' }])
    .png()
    .toFile(out);

  console.log(
    `wrote ${outRel} (${size}x${size}, mascot ${inner}px, bg ${bg ? 'white' : 'transparent'})`,
  );
}

await gen('assets/icon.png', 1024, 0.78, { r: 255, g: 255, b: 255, alpha: 1 });
await gen('assets/adaptive-icon.png', 1024, 0.62, null);
await gen('assets/splash-icon.png', 1024, 0.62, null);
await gen('assets/favicon.png', 48, 0.78, { r: 255, g: 255, b: 255, alpha: 1 });
