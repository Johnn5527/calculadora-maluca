/**
 * index.js — Sobe a API: valida o .env, abre o banco, aplica migrations pendentes e escuta.
 */
import { carregarArquivoEnv, lerConfig } from './config.js';
import { abrirBanco } from './db.js';
import { migrar } from './migrar.js';
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
const aplicadas = await migrar(db);
if (aplicadas.length) console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`);

const app = await construirApp({ config, db, logger: { level: 'info' } });
await app.listen({ port: config.porta, host: config.host });

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.once(sinal, async () => {
    await app.close();
    await db.fechar();
    process.exit(0);
  });
}
