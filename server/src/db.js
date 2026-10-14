/**
 * db.js — Acesso ao PostgreSQL com a mesma interface para dois motores:
 *   - DATABASE_URL=postgres://...      -> Postgres de verdade (Neon, Docker, VPS) via "pg"
 *   - DATABASE_URL=pglite:./dados/pg   -> PGlite (Postgres embutido no Node), para dev e testes
 *   - DATABASE_URL=pglite:memoria      -> PGlite só em memória (testes)
 */
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * @typedef {{query:(sql:string, params?:unknown[])=>Promise<object[]>}} Consulta
 * @typedef {Consulta & {script:(sql:string)=>Promise<void>, transacao:<T>(fn:(tx:Consulta)=>Promise<T>)=>Promise<T>, fechar:()=>Promise<void>}} Banco
 */

/** @returns {Promise<Banco>} */
export async function abrirBanco(url) {
  if (url.startsWith('pglite:')) return abrirPglite(url.slice('pglite:'.length));
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const consulta = (c) => ({ query: async (sql, params) => (await c.query(sql, params)).rows });
  return {
    ...consulta(pool),
    script: async (sql) => { await pool.query(sql); },
    async transacao(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const r = await fn(consulta(cliente));
        await cliente.query('COMMIT');
        return r;
      } catch (e) {
        await cliente.query('ROLLBACK');
        throw e;
      } finally {
        cliente.release();
      }
    },
    fechar: () => pool.end(),
  };
}

async function abrirPglite(caminho) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { citext } = await import('@electric-sql/pglite/contrib/citext');
  const dataDir = !caminho || caminho === 'memoria' ? undefined : caminho;
  if (dataDir) await mkdir(dirname(dataDir), { recursive: true });
  const pg = await PGlite.create({ dataDir, extensions: { citext } });
  const consulta = (c) => ({ query: async (sql, params = []) => (await c.query(sql, params)).rows });
  return {
    ...consulta(pg),
    script: async (sql) => { await pg.exec(sql); },
    transacao: (fn) => pg.transaction((tx) => fn(consulta(tx))),
    fechar: () => pg.close(),
  };
}
