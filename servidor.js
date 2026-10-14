/**
 * servidor.js — Servidor estático mínimo (sem dependências) para rodar o jogo.
 * ES modules não funcionam via file://, por isso este servidor.
 * Uso: node servidor.js  (ou npm start)  ->  http://localhost:5173
 * Só para desenvolvimento: em produção o site é o dist/ (npm run build) num host estático.
 * Escuta só neste computador; para testar no celular da mesma rede: HOST=0.0.0.0 npm start
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// SITE=dist serve o site montado pelo "npm run build", com os cabeçalhos do _headers (CSP etc.)
const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), process.env.SITE || '.');
const CABECALHOS = await lerCabecalhosGerais(join(RAIZ, '_headers'));
const PORTA = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';
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

/** Cabeçalhos do bloco "/*" do _headers (formato do Cloudflare Pages); sem o arquivo, nenhum. */
async function lerCabecalhosGerais(caminho) {
  const texto = await readFile(caminho, 'utf8').catch(() => '');
  const bloco = /^\/\*\r?\n((?:[ \t]+.+\r?\n?)+)/m.exec(texto)?.[1] ?? '';
  return Object.fromEntries(bloco.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const i = l.indexOf(':');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
}

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
      ...CABECALHOS,
      'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(dados);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}).listen(PORTA, HOST, () => {
  if (Object.keys(CABECALHOS).length) console.log(`Servindo ${RAIZ} com os cabeçalhos do _headers`);
  console.log(`Calculadora Maluca rodando em http://localhost:${PORTA}${HOST === '127.0.0.1' ? '' : ` (aberto na rede: ${HOST})`}`);
  console.log(`Testes no navegador:   http://localhost:${PORTA}/tests/`);
});
