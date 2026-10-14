/**
 * servidor.js — Servidor estático mínimo (sem dependências) para rodar o jogo.
 * ES modules não funcionam via file://, por isso este servidor.
 * Uso: node servidor.js  (ou npm start)  ->  http://localhost:5173
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORTA = Number(process.env.PORT) || 5173;
/** Nunca servir o código/segredos do servidor nem arquivos ocultos (.env, .git). */
const PRIVADO = /^(server|backend)([\\/]|$)|(^|[\\/])\./i;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const caminhoUrl = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let arquivo = normalize(join(RAIZ, caminhoUrl));
    if (!arquivo.startsWith(RAIZ) || PRIVADO.test(relative(RAIZ, arquivo))) {
      res.writeHead(403).end('Proibido');
      return;
    }
    const info = await stat(arquivo).catch(() => null);
    if (info?.isDirectory()) arquivo = join(arquivo, 'index.html');
    const dados = await readFile(arquivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(dados);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}).listen(PORTA, () => {
  console.log(`Calculadora Maluca rodando em http://localhost:${PORTA}`);
  console.log(`Testes no navegador:   http://localhost:${PORTA}/tests/`);
});
