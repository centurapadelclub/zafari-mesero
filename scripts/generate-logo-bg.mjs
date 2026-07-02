/**
 * Genera assets/logo-zafari-bg.png con fondo sólido #0d0d0d, para usar como
 * ícono de app y splash en Android (que necesitan fondo opaco).
 *
 * Robusto ante dos formas del logo de origen:
 *  - Logo transparente  -> se compone sobre un fondo #0d0d0d.
 *  - Logo blanco sobre negro opaco (#000000) -> se reemplaza el negro por #0d0d0d.
 *
 * Requiere jimp:  npm i -D jimp   (o: npm i jimp --no-save)
 * Uso:            node scripts/generate-logo-bg.mjs
 */
import { Jimp } from 'jimp';

const SRC = 'assets/logo-zafari.png';
const OUT = 'assets/logo-zafari-bg.png';
const BG = 0x0d0d0dff; // #0d0d0d opaco

const logo = await Jimp.read(SRC);
const { width, height } = logo.bitmap;

// 1) Fondo #0d0d0d + logo encima (cubre el caso transparente).
const canvas = new Jimp({ width, height, color: BG });
canvas.composite(logo, 0, 0);

// 2) Reemplazar el negro puro (#000000) por #0d0d0d (cubre el caso de logo
//    blanco con fondo negro opaco). Manipulamos el buffer RGBA directamente.
const data = canvas.bitmap.data;
for (let i = 0; i < data.length; i += 4) {
  if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
    data[i] = 0x0d;
    data[i + 1] = 0x0d;
    data[i + 2] = 0x0d;
    data[i + 3] = 255;
  }
}

await canvas.write(OUT);
console.log(`OK -> ${OUT} (${width}x${height}, fondo #0d0d0d)`);
