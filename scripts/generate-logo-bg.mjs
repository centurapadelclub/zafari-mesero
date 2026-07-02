/**
 * Genera assets/logo-zafari-bg.png: el logo (transparente) compuesto sobre un
 * fondo sólido #0d0d0d, para usar como ícono de app y splash en Android (que
 * necesitan fondo opaco).
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

const canvas = new Jimp({ width, height, color: BG });
canvas.composite(logo, 0, 0);
await canvas.write(OUT);

console.log(`OK -> ${OUT} (${width}x${height}, fondo #0d0d0d)`);
