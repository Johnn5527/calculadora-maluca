/**
 * montar-site.js — Monta o site estático em dist/ para publicar (Cloudflare Pages ou similar).
 * Copia só o que o navegador precisa (sem tests/, server/, backend/, tools/), grava a URL da API
 * em js/ambiente.js e gera o _headers com os cabeçalhos de segurança (CSP, HSTS...).
 *
 * Uso: API_URL=https://api.seudominio.com.br npm run build
 *      (para conferir local: API_URL=http://localhost:8787 npm run build && SITE=dist npm start)
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'dist');
const ARQUIVOS = ['index.html', 'privacidade.html', 'termos.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];
const FONTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

function lerApiUrl() {
  const bruta = process.env.API_URL?.trim();
  if (!bruta) throw new Error('Defina API_URL (ex.: API_URL=https://api.seudominio.com.br npm run build)');
  const url = new URL(bruta);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) throw new Error('API_URL precisa ser https:// (só localhost pode ser http)');
  if (url.pathname !== '/' || url.search) throw new Error('API_URL é só a origem, sem caminho (o app acrescenta /api/v1)');
  return url.origin;
}

/** Cabeçalhos do Cloudflare Pages (o mesmo arquivo serve o "SITE=dist npm start"). */
function cabecalhos(api) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self' ${FONTES[0]}`,
    `font-src ${FONTES[1]}`,
    "img-src 'self' data: blob:",
    // o service worker também baixa as fontes para o modo offline
    `connect-src 'self' ${api} ${FONTES.join(' ')}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(api.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  return `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin

/sw.js
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache
`;
}

const api = lerApiUrl();
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST);
for (const item of ARQUIVOS) await cp(join(RAIZ, item), join(DIST, item), { recursive: true });
await writeFile(
  join(DIST, 'js', 'ambiente.js'),
  `/** ambiente.js — gerado por tools/montar-site.js; não edite no dist/. */\nexport const API_URL = ${JSON.stringify(api)};\n`,
);
await writeFile(join(DIST, '_headers'), cabecalhos(api));
console.log(`dist/ pronto (API: ${api}).`);
