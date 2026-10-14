/**
 * sw.js — Service worker da Calculadora Maluca (PWA offline).
 *
 * Estratégia:
 *   - instala: pré-carrega todo o "app shell" (HTML, CSS, JS, ícones)
 *   - mesma origem: rede primeiro (pega atualizações), cache como reserva offline
 *   - Google Fonts: cache primeiro (a fonte não muda)
 *   - API do ranking (outra origem ou /api/): nunca passa pelo cache
 *
 * Ao mudar arquivos do app, suba a VERSAO para descartar o cache antigo.
 */
const VERSAO = 'cm-v3.3.0';
const CACHE_APP = `${VERSAO}-app`;
const CACHE_FONTES = 'cm-fontes';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './privacidade.html',
  './termos.html',
  './css/style.css',
  './css/legal.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/main.js',
  './js/ambiente.js',
  './js/apelidos.js',
  './js/responsavel.js',
  './js/ui.js',
  './js/audio.js',
  './js/storage.js',
  './js/progresso.js',
  './js/diario.js',
  './js/conquistas.js',
  './js/professor.js',
  './js/skin-codigo.js',
  './js/editor-skin.js',
  './js/perfis.js',
  './js/regras-partida.js',
  './js/api.js',
  './js/missoes.js',
  './js/math/parser.js',
  './js/math/engine.js',
  './js/fx/shake.js',
  './js/fx/confetti.js',
  './js/fx/odometer.js',
  './js/fx/reveal.js',
  './js/games/game-base.js',
  './js/games/index.js',
  './js/games/chuva-de-moedas.js',
  './js/games/pisa-pisa.js',
  './js/games/bloco-duplicador.js',
  './js/games/corta-bandeira.js',
  './js/games/estrela-turbo.js',
  './js/games/cano-subterraneo.js',
  './js/games/roleta-dos-cogumelos.js',
  './js/games/dragao-devorador.js',
  './js/games/chefao.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_APP)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves.filter((c) => c !== CACHE_APP && c !== CACHE_FONTES).map((c) => caches.delete(c)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cachePrimeiro(req, CACHE_FONTES));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  e.respondWith(redePrimeiro(req));
});

async function redePrimeiro(req) {
  const cache = await caches.open(CACHE_APP);
  try {
    const resp = await fetch(req);
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch {
    const salvo = await cache.match(req, { ignoreSearch: true });
    if (salvo) return salvo;
    // navegação offline para uma rota desconhecida: devolve o app
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  }
}

async function cachePrimeiro(req, nomeCache) {
  const cache = await caches.open(nomeCache);
  const salvo = await cache.match(req);
  if (salvo) return salvo;
  try {
    const resp = await fetch(req);
    if (resp.ok || resp.type === 'opaque') cache.put(req, resp.clone());
    return resp;
  } catch {
    return Response.error();
  }
}
