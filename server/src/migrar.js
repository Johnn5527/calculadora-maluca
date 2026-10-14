/**
 * migrar.js — Aplica as migrations de server/migrations (V<n>__nome.sql, mesmo padrão do Flyway),
 * em ordem, cada uma numa transação. Uso: npm run migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { abrirBanco } from './db.js';
import { carregarArquivoEnv, lerConfig } from './config.js';

const PASTA = fileURLToPath(new URL('../migrations', import.meta.url));
const versao = (arquivo) => Number(/^V(\d+)__/.exec(arquivo)[1]);

const listarArquivos = async (pasta) =>
  (await readdir(pasta)).filter((f) => /^V\d+__.+\.sql$/.test(f)).sort((a, b) => versao(a) - versao(b));

/** Migrations que ainda faltam no banco (sem alterar nada). */
export async function pendentes(db, pasta = PASTA) {
  const [{ existe }] = await db.query(`SELECT to_regclass('schema_migracao') IS NOT NULL AS existe`);
  const feitas = existe ? new Set((await db.query('SELECT versao FROM schema_migracao')).map((r) => r.versao)) : new Set();
  return (await listarArquivos(pasta)).filter((f) => !feitas.has(versao(f)));
}

/** @returns {Promise<string[]>} migrations aplicadas agora */
export async function migrar(db, pasta = PASTA) {
  await db.script(`CREATE TABLE IF NOT EXISTS schema_migracao (
    versao integer PRIMARY KEY,
    arquivo text NOT NULL,
    aplicada_em timestamptz NOT NULL DEFAULT now()
  )`);
  const feitas = new Set((await db.query('SELECT versao FROM schema_migracao')).map((r) => r.versao));
  const arquivos = await listarArquivos(pasta);
  const aplicadas = [];
  for (const arquivo of arquivos) {
    if (feitas.has(versao(arquivo))) continue;
    const sql = await readFile(join(pasta, arquivo), 'utf8');
    await db.script(`BEGIN;\n${sql}\nINSERT INTO schema_migracao (versao, arquivo) VALUES (${versao(arquivo)}, '${arquivo}');\nCOMMIT;`);
    aplicadas.push(arquivo);
  }
  return aplicadas;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  carregarArquivoEnv();
  const db = await abrirBanco(lerConfig().databaseUrl);
  try {
    const aplicadas = await migrar(db);
    console.log(aplicadas.length ? `Aplicadas: ${aplicadas.join(', ')}` : 'Banco já está atualizado.');
  } finally {
    await db.fechar();
  }
}
