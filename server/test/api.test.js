import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lerConfig } from '../src/config.js';
import { abrirBanco } from '../src/db.js';
import { migrar } from '../src/migrar.js';
import { construirApp } from '../src/app.js';
import { avaliarDesempenho } from '../../js/progresso.js';
import { desafioDoDia } from '../../js/diario.js';

const config = lerConfig({
  DATABASE_URL: 'pglite:memoria',
  HMAC_PARTIDA_SECRET: 'h'.repeat(40),
  TOKEN_PEPPER: 'p'.repeat(40),
  CORS_ORIGENS: 'http://localhost:5173',
});

let agora = new Date('2026-10-14T15:00:00Z'); // 12:00 em São Paulo
const avancar = (ms) => { agora = new Date(agora.getTime() + ms); };
let db;
let app;

before(async () => {
  db = await abrirBanco(config.databaseUrl);
  await migrar(db);
  app = await construirApp({ config, db, relogio: () => new Date(agora) });
});
after(async () => {
  await app.close();
  await db.fechar();
});

async function chamar(metodo, url, { token, corpo, headers = {} } = {}) {
  const r = await app.inject({
    method: metodo,
    url,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    ...(corpo ? { payload: corpo } : {}),
  });
  return { status: r.statusCode, corpo: r.body ? JSON.parse(r.body) : null, headers: r.headers };
}

const cadastrar = async (apelido = 'TECLITO', faixaEtaria = '13+') =>
  (await chamar('POST', '/api/v1/jogadores', { corpo: { apelido, faixaEtaria } })).corpo;

const abrir = (token, corpo = { expressao: '2+3', modo: 'normal' }) => chamar('POST', '/api/v1/partidas', { token, corpo });

const STATS = { coletados: 8, total: 9, comboMax: 4, danos: 0, rapido: false, pulou: false, auto: false };
const finalizar = (token, partida, { stats = {}, duracaoMs = 7900, chave = randomUUID(), assinatura = partida.assinatura } = {}) =>
  chamar('POST', `/api/v1/partidas/${partida.id}/finalizar`, {
    token,
    corpo: { assinatura, idempotencyKey: chave, duracaoMs, stats: { ...STATS, ...stats } },
  });

test('cadastro anônimo: tag, token e só o hash no banco', async () => {
  const r = await chamar('POST', '/api/v1/jogadores', { corpo: { apelido: '  João  Bolinha ', faixaEtaria: '13+' } });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.jogador.apelido, 'João Bolinha');
  assert.ok(r.corpo.jogador.tag >= 1000 && r.corpo.jogador.tag <= 9999);
  assert.equal(r.corpo.jogador.rankingPublico, true);
  assert.ok(r.corpo.token.length >= 40);
  const linhas = await db.query('SELECT token_hash FROM jogador_token WHERE jogador_id = $1', [r.corpo.jogador.id]);
  assert.equal(linhas.length, 1);
  assert.equal(Buffer.from(linhas[0].token_hash).length, 32);
  assert.ok(!Buffer.from(linhas[0].token_hash).toString('utf8').includes(r.corpo.token));
});

test('cadastro: criança começa com ranking público desligado', async () => {
  assert.equal((await cadastrar('ANA', '8-12')).jogador.rankingPublico, false);
  assert.equal((await cadastrar('BIA', '4-7')).jogador.rankingPublico, false);
  assert.equal((await cadastrar('VOVÔ ZÉ', '60+')).jogador.rankingPublico, true);
});

test('cadastro: apelido e faixa inválidos', async () => {
  assert.equal((await chamar('POST', '/api/v1/jogadores', { corpo: { apelido: 'ab', faixaEtaria: '13+' } })).status, 422);
  assert.equal((await chamar('POST', '/api/v1/jogadores', { corpo: { apelido: '<script>', faixaEtaria: '13+' } })).status, 422);
  const r = await chamar('POST', '/api/v1/jogadores', { corpo: { apelido: 'TECLITO', faixaEtaria: '30' } });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.erro.codigo, 'requisicao_invalida');
});

test('mesmo apelido ganha tags diferentes', async () => {
  const a = await cadastrar('GÊMEO');
  const b = await cadastrar('GÊMEO');
  assert.notEqual(a.jogador.tag, b.jogador.tag);
});

test('/eu exige token válido', async () => {
  const { token, jogador } = await cadastrar();
  assert.equal((await chamar('GET', '/api/v1/eu')).status, 401);
  assert.equal((await chamar('GET', '/api/v1/eu', { token: 'falso' })).corpo.erro.codigo, 'token_invalido');
  const r = await chamar('GET', '/api/v1/eu', { token });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.jogador.id, jogador.id);
});

test('fluxo completo: servidor calcula conta, pontos e XP', async () => {
  const { token } = await cadastrar();
  const a = await abrir(token);
  assert.equal(a.status, 201);
  assert.equal(a.corpo.resultado, '5');
  assert.equal(a.corpo.nFases, 1);
  assert.equal(a.corpo.duracaoPrevistaMs, 10000);
  avancar(8000);
  const f = await finalizar(token, a.corpo);
  assert.equal(f.status, 200);
  const esperado = avaliarDesempenho(STATS);
  assert.deepEqual(
    { status: f.corpo.status, pontos: f.corpo.pontos, rank: f.corpo.rank, xp: f.corpo.xp, entraNoRanking: f.corpo.entraNoRanking },
    { status: 'aceita', pontos: esperado.pontos, rank: esperado.rank, xp: esperado.xp, entraNoRanking: true },
  );
  const eu = (await chamar('GET', '/api/v1/eu', { token })).corpo.jogador;
  assert.equal(eu.xp, esperado.xp);
  assert.equal(eu.partidas, 1);
});

test('pontos mandados pelo cliente são ignorados', async () => {
  const { token } = await cadastrar();
  const a = (await abrir(token)).corpo;
  avancar(8000);
  const r = await chamar('POST', `/api/v1/partidas/${a.id}/finalizar`, {
    token,
    corpo: { assinatura: a.assinatura, idempotencyKey: randomUUID(), duracaoMs: 7900, stats: { ...STATS, pontos: 999999 }, pontos: 999999, rank: 'S' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.pontos, avaliarDesempenho(STATS).pontos);
});

test('reenvio da mesma finalização não conta duas vezes', async () => {
  const { token } = await cadastrar();
  const a = (await abrir(token)).corpo;
  avancar(8000);
  const chave = randomUUID();
  const r1 = await finalizar(token, a, { chave });
  const r2 = await finalizar(token, a, { chave });
  assert.equal(r2.status, 200);
  assert.equal(r2.corpo.repetida, true);
  assert.equal(r2.corpo.pontos, r1.corpo.pontos);
  assert.equal((await chamar('GET', '/api/v1/eu', { token })).corpo.jogador.partidas, 1);
  // outra chave na partida já fechada = tentativa de contar de novo
  assert.equal((await finalizar(token, a)).status, 409);
});

test('assinatura errada, dono errado e partida inexistente', async () => {
  const dono = await cadastrar();
  const intruso = await cadastrar('INTRUSO');
  const a = (await abrir(dono.token)).corpo;
  avancar(8000);
  assert.equal((await finalizar(dono.token, a, { assinatura: 'x'.repeat(43) })).status, 403);
  assert.equal((await finalizar(intruso.token, a)).status, 404);
  assert.equal((await finalizar(dono.token, { ...a, id: randomUUID() })).status, 404);
  assert.equal((await finalizar(dono.token, a)).corpo.status, 'aceita');
});

test('números impossíveis: partida recusada fica gravada com o motivo', async () => {
  const { token } = await cadastrar();
  const casos = [
    [{ stats: { total: 1000, coletados: 1000 } }, /acima do possível/],
    [{ duracaoMs: 500 }, /rápida demais/],
    [{ duracaoMs: 30000 }, /tempo real/],
  ];
  for (const [mudanca, motivo] of casos) {
    const a = (await abrir(token)).corpo;
    avancar(8000);
    const r = await finalizar(token, a, mudanca);
    assert.equal(r.corpo.status, 'recusada');
    assert.match(r.corpo.motivo, motivo);
    const [linha] = await db.query('SELECT status, motivo_recusa, pontos FROM partida WHERE id = $1', [a.id]);
    assert.equal(linha.status, 'recusada');
    assert.match(linha.motivo_recusa, motivo);
    assert.equal(linha.pontos, null);
  }
  const eu = (await chamar('GET', '/api/v1/eu', { token })).corpo.jogador;
  assert.equal(eu.xp, 0);
  assert.equal(eu.partidas, 0);
});

test('auto-play e pulo dão XP, mas não entram no ranking', async () => {
  const { token, jogador } = await cadastrar();
  for (const stats of [{ auto: true }, { pulou: true }]) {
    const a = (await abrir(token)).corpo;
    avancar(8000);
    const r = await finalizar(token, a, { stats });
    assert.equal(r.corpo.status, 'aceita');
    assert.equal(r.corpo.entraNoRanking, false);
    assert.ok(r.corpo.xp > 0);
  }
  const [{ n }] = await db.query(
    `SELECT count(*)::int AS n FROM partida WHERE jogador_id = $1 AND status = 'aceita' AND NOT auto AND NOT pulou`,
    [jogador.id],
  );
  assert.equal(n, 0);
});

test('partida expira em 10 minutos', async () => {
  const { token } = await cadastrar();
  const a = (await abrir(token)).corpo;
  avancar(11 * 60 * 1000);
  const r = await finalizar(token, a, { duracaoMs: 8000 });
  assert.equal(r.status, 410);
  const [linha] = await db.query('SELECT status FROM partida WHERE id = $1', [a.id]);
  assert.equal(linha.status, 'expirada');
});

test('só 1 partida aberta por vez: abrir outra abandona a anterior', async () => {
  const { token, jogador } = await cadastrar();
  const a1 = (await abrir(token)).corpo;
  const a2 = (await abrir(token)).corpo;
  const abertas = await db.query(`SELECT id FROM partida WHERE jogador_id = $1 AND status = 'aberta'`, [jogador.id]);
  assert.deepEqual(abertas.map((p) => p.id), [a2.id]);
  avancar(8000);
  assert.equal((await finalizar(token, a1)).status, 409);
  assert.equal((await finalizar(token, a2)).corpo.status, 'aceita');
});

test('conta inválida não abre partida; ÷0 abre o dragão', async () => {
  const { token } = await cadastrar();
  assert.equal((await abrir(token, { expressao: '2+', modo: 'normal' })).corpo.erro.codigo, 'conta_invalida');
  assert.equal((await abrir(token, { expressao: '2+3', modo: 'chefe' })).status, 422);
  const d = await abrir(token, { expressao: '5÷0', modo: 'normal' });
  assert.equal(d.status, 201);
  assert.equal(d.corpo.resultado, null);
  assert.equal(d.corpo.duracaoPrevistaMs, 8000);
});

test('velocidade lenta: duração prevista maior e pontos menores', async () => {
  const { token } = await cadastrar();
  const a = (await abrir(token, { expressao: '2+3', modo: 'normal', velocidade: 'bem-lento' })).corpo;
  assert.equal(a.duracaoPrevistaMs, Math.round((9 * 1.8 + 1) * 1000));
  avancar(15000);
  const r = await finalizar(token, a, { duracaoMs: 14000 });
  assert.equal(r.corpo.pontos, avaliarDesempenho(STATS, { multTempo: 1.8 }).pontos);
  assert.ok(r.corpo.pontos < avaliarDesempenho(STATS).pontos);
});

test('diário: conta gerada no servidor e só a melhor tentativa conta', async () => {
  const { token, jogador } = await cadastrar();
  const data = '2026-10-14';
  const a1 = (await abrir(token, { modo: 'diario', dataDiario: data, expressao: '1+1' })).corpo;
  assert.equal(a1.expressao, desafioDoDia(data).expressao);
  avancar(12000);
  const r1 = await finalizar(token, a1, { duracaoMs: 11000, stats: { total: 5, coletados: 5, comboMax: 5 } });

  const a2 = (await abrir(token, { modo: 'diario', dataDiario: data })).corpo;
  avancar(12000);
  const r2 = await finalizar(token, a2, { duracaoMs: 11000, stats: { total: 5, coletados: 1, comboMax: 1 } });
  assert.ok(r2.corpo.pontos < r1.corpo.pontos);

  const [t] = await db.query('SELECT partida_id, melhor_pontos FROM diario_tentativa WHERE jogador_id = $1', [jogador.id]);
  assert.equal(t.partida_id, a1.id);
  assert.equal(t.melhor_pontos, r1.corpo.pontos);

  assert.equal((await abrir(token, { modo: 'diario', dataDiario: '2026-01-01' })).corpo.erro.codigo, 'diario_fora_do_dia');
});

test('apagar a conta remove tudo em cascata (LGPD)', async () => {
  const { token, jogador } = await cadastrar();
  const a = (await abrir(token)).corpo;
  avancar(8000);
  await finalizar(token, a);
  assert.equal((await chamar('DELETE', '/api/v1/eu', { token })).status, 204);
  const contar = async (tabela) => (await db.query(`SELECT count(*)::int AS n FROM ${tabela} WHERE jogador_id = $1`, [jogador.id]))[0].n;
  assert.equal(await contar('partida'), 0);
  assert.equal(await contar('jogador_token'), 0);
  assert.equal((await chamar('GET', '/api/v1/eu', { token })).status, 401);
});

test('CORS só libera as origens da lista', async () => {
  const pre = (origin) => chamar('OPTIONS', '/api/v1/partidas', {
    headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,authorization' },
  });
  assert.equal((await pre('http://localhost:5173')).headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal((await pre('https://site-malvado.com')).headers['access-control-allow-origin'], undefined);
});

test('migrations rodam de novo sem efeito', async () => {
  assert.deepEqual(await migrar(db), []);
});
