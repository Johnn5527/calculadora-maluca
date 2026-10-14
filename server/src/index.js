/**
 * index.js — Sobe a API: valida o .env, abre o banco, confere as migrations e escuta.
 * Em desenvolvimento aplica as pendentes sozinho; em produção elas são um passo do deploy
 * (npm run migrate) e a API se recusa a subir com o banco desatualizado.
 */
import { carregarArquivoEnv, lerConfig } from './config.js';
import { abrirBanco } from './db.js';
import { migrar, pendentes } from './migrar.js';
import { construirApp } from './app.js';

carregarArquivoEnv();
let config;
try {
  config = lerConfig();
} catch (e) {
  console.error(e.message);
  console.error('Copie server/.env.example para server/.env e preencha os valores.');
  process.exit(1);
}

const db = await abrirBanco(config.databaseUrl);
if (config.producao) {
  const faltam = await pendentes(db);
  if (faltam.length) {
    console.error(`Banco desatualizado, faltam: ${faltam.join(', ')}. Rode "npm run migrate" no deploy antes de subir a API.`);
    await db.fechar();
    process.exit(1);
  }
} else {
  const aplicadas = await migrar(db);
  if (aplicadas.length) console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`);
}

const app = await construirApp({ config, db, logger: { level: 'info' } });
await app.listen({ port: config.porta, host: config.host });

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.once(sinal, async () => {
    await app.close();
    await db.fechar();
    process.exit(0);
  });
}
