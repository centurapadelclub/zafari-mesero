/**
 * Genera assets/logo-zafari-bg.png: el logo centrado a ~65% con MARGEN alrededor,
 * sobre fondo sólido #0d0d0d. Pensado para el ícono adaptativo de Android (que
 * recorta a la zona segura ~66%) y para el splash, para que el símbolo quede
 * completo y con aire, sin cortarse.
 *
 * Robusto ante dos formas del logo de origen:
 *  - Logo blanco sobre negro opaco (#000000) -> se reemplaza el negro por #0d0d0d.
 *  - Logo transparente -> se compone sobre #0d0d0d.
 *
 * Requiere jimp:  npm i -D jimp   (o: npm i jimp --no-save)
 * Uso:            node scripts/generate-logo-bg.mjs
 */
import { Jimp } from 'jimp';

const SRC = 'assets/logo-zafari.png';
const OUT = 'assets/logo-zafari-bg.png';
const BG = 0x0d0d0dff; // #0d0d0d opaco
const SCALE = 0.65; // el logo ocupa ~65% del cuadro (35% de margen total)

const src = await Jimp.read(SRC);
const S = Math.max(src.bitmap.width, src.bitmap.height);

// Normalizar el fondo del logo a #0d0d0d (negro puro -> #0d0d0d) para que al
// escalarlo y centrarlo no se note ninguna costura con el canvas.
const ld = src.bitmap.data;
for (let i = 0; i < ld.length; i += 4) {
  if (ld[i] === 0 && ld[i + 1] === 0 && ld[i + 2] === 0) {
    ld[i] = 0x0d;
    ld[i + 1] = 0x0d;
    ld[i + 2] = 0x0d;
    ld[i + 3] = 255;
  }
}

// Escalar el logo y centrarlo en un canvas #0d0d0d del tamaño original.
const inner = Math.round(S * SCALE);
const scaled = src.clone().resize({ w: inner, h: inner });

const canvas = new Jimp({ width: S, height: S, color: BG });
const off = Math.round((S - inner) / 2);
canvas.composite(scaled, off, off);

await canvas.write(OUT);
console.log(`OK -> ${OUT} (${S}x${S}, logo a ${Math.round(SCALE * 100)}% centrado, fondo #0d0d0d)`);
