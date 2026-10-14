/**
 * gerar-icones.js — Gera icons/icon-192.png e icons/icon-512.png sem dependências
 * (encoder PNG mínimo com zlib do Node). O desenho é o mesmo pixel art 16×16 do icon.svg.
 *
 * Uso: node tools/gerar-icones.js
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// mesmos retângulos do icons/icon.svg: [x, y, largura, altura, cor]
const RETANGULOS = [
  [0, 0, 16, 16, '#1b1b3a'],
  [2, 1, 12, 14, '#1a1028'],
  [3, 2, 10, 4, '#9bbc0f'],
  [3, 7, 2, 2, '#f4f0e0'],
  [6, 7, 2, 2, '#f4f0e0'],
  [9, 7, 4, 2, '#e43b44'],
  [3, 10, 2, 2, '#f4f0e0'],
  [6, 10, 2, 2, '#f4f0e0'],
  [9, 10, 4, 4, '#2bd66b'],
  [3, 13, 5, 1, '#3b7dd8'],
];

function pixelArt16() {
  const px = Array.from({ length: 16 * 16 }, () => [0, 0, 0]);
  for (const [x0, y0, w, h, cor] of RETANGULOS) {
    const rgb = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px[y * 16 + x] = rgb;
  }
  return px;
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}

/**
 * @param {number} tamanho lado em px
 * @param {number} [arteFracao] fração do lado ocupada pelo desenho; o resto é fundo.
 *   Ícone "maskable" usa 0,625: o Android corta tudo fora do círculo de 80% (zona segura).
 */
function png(tamanho, arteFracao = 1) {
  const arte = pixelArt16();
  const lado = Math.round((tamanho * arteFracao) / 16) * 16; // múltiplo de 16: pixels nítidos
  const escala = lado / 16;
  const margem = Math.floor((tamanho - lado) / 2);
  const fundo = arte[0];
  const linhas = Buffer.alloc(tamanho * (tamanho * 3 + 1));
  for (let y = 0; y < tamanho; y++) {
    const base = y * (tamanho * 3 + 1);
    linhas[base] = 0; // filtro "none"
    for (let x = 0; x < tamanho; x++) {
      const ax = Math.floor((x - margem) / escala);
      const ay = Math.floor((y - margem) / escala);
      const dentro = ax >= 0 && ay >= 0 && ax < 16 && ay < 16;
      const [r, g, b] = dentro ? arte[ay * 16 + ax] : fundo;
      linhas[base + 1 + x * 3] = r;
      linhas[base + 2 + x * 3] = g;
      linhas[base + 3 + x * 3] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(linhas)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join(raiz, 'icons'), { recursive: true });
for (const t of [192, 512]) {
  writeFileSync(join(raiz, 'icons', `icon-${t}.png`), png(t));
  console.log(`icons/icon-${t}.png gerado`);
  writeFileSync(join(raiz, 'icons', `icon-maskable-${t}.png`), png(t, 0.625));
  console.log(`icons/icon-maskable-${t}.png gerado`);
}
writeFileSync(join(raiz, 'icons', 'apple-touch-icon.png'), png(180, 0.8));
console.log('icons/apple-touch-icon.png gerado');
