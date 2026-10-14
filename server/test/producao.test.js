import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerConfig } from '../src/config.js';
import { abrirBanco } from '../src/db.js';
import { migrar, pendentes } from '../src/migrar.js';
import { construirApp, LIMITES } from '../src/app.js';

const BASE = {
  DATABASE_URL: 'pglite:memoria',
  HMAC_PARTIDA_SECRET: 'h'.repeat(40),
  TOKEN_PEPPER: 'p'.repeat(40),
  CORS_ORIGENS: 'http://localhost:5173',
};

test('produção recusa PGlite e origem sem https', () => {
  assert.throws(
    () => lerConfig({ ...BASE, NODE_ENV: 'production' }),
    (e) => /PGlite/.test(e.message) && /https/.test(e.message),
  );
  const ok = lerConfig({
    ...BASE,
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://u:s@exemplo.neon.tech/db?sslmode=require',
    CORS_ORIGENS: 'https://calculadoramaluca.com.br',
    TRUST_PROXY: '1',
  });
  assert.equal(ok.producao, true);
  assert.equal(ok.proxies, 1);
  assert.throws(() => lerConfig({ ...BASE, TRUST_PROXY: 'sim' }), /TRUST_PROXY/);
});

test('pendentes(): lista o que falta sem mexer no banco', async () => {
  const db = await abrirBanco('pglite:memoria');
  try {
    const antes = await pendentes(db);
    assert.ok(antes.length >= 4);
    assert.equal(antes[0], 'V1__jogadores.sql');
    await migrar(db);
    assert.deepEqual(await pendentes(db), []);
  } finally {
    await db.fechar();
  }
});

test('limite por IP: cadastro em massa leva 429 com mensagem padrão', async () => {
  const db = await abrirBanco('pglite:memoria');
  await migrar(db);
  const app = await construirApp({ config: lerConfig(BASE), db });
  try {
    const cadastrar = (i) =>
      app.inject({ method: 'POST', url: '/api/v1/jogadores', payload: { apelido: `ROBO${i}`, faixaEtaria: '13+' } });
    for (let i = 0; i < LIMITES.cadastro.max; i++) assert.equal((await cadastrar(i)).statusCode, 201);
    const r = await cadastrar(99);
    assert.equal(r.statusCode, 429);
    assert.equal(JSON.parse(r.body).erro.codigo, 'muitas_requisicoes');
    assert.ok(Number(r.headers['retry-after']) > 0);
    // a saúde não entra no limite (o healthcheck bate nela o tempo todo)
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/saude' })).statusCode, 200);
  } finally {
    await app.close();
    await db.fechar();
  }
});
