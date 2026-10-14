import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lerConfig } from '../src/config.js';
import { abrirBanco } from '../src/db.js';
import { migrar } from '../src/migrar.js';
import { construirApp, inicioDaSemana } from '../src/app.js';

const config = lerConfig({
  DATABASE_URL: 'pglite:memoria',
  HMAC_PARTIDA_SECRET: 'h'.repeat(40),
  TOKEN_PEPPER: 'p'.repeat(40),
  CORS_ORIGENS: 'http://localhost:5173',
});

// começa na quinta da semana passada; depois pula para a quarta 14/10/2026, 12:00 em São Paulo
let agora = new Date('2026-10-08T15:00:00Z');
const avancar = (ms) => { agora = new Date(agora.getTime() + ms); };
let db;
let app;
const j = {};

async function chamar(metodo, url, { token, corpo } = {}) {
  const r = await app.inject({ method: metodo, url, headers: token ? { authorization: `Bearer ${token}` } : {}, ...(corpo ? { payload: corpo } : {}) });
  return { status: r.statusCode, corpo: r.body ? JSON.parse(r.body) : null };
}
const cadastrar = async (apelido, faixaEtaria = '13+') => (await chamar('POST', '/api/v1/jogadores', { corpo: { apelido, faixaEtaria } })).corpo;

const PERFEITO = { coletados: 10, total: 10, comboMax: 10, danos: 0, rapido: false, pulou: false, auto: false };
const MEDIO = { coletados: 6, total: 10, comboMax: 3, danos: 1, rapido: false, pulou: false, auto: false };
const FRACO = { coletados: 2, total: 10, comboMax: 1, danos: 3, rapido: false, pulou: false, auto: false };

/** Abre e fecha uma partida; devolve os pontos dados pelo servidor. */
async function jogar(token, stats, abrir = { expressao: '2+3', modo: 'normal' }) {
  const a = (await chamar('POST', '/api/v1/partidas', { token, corpo: abrir })).corpo;
  avancar(12000);
  const f = await chamar('POST', `/api/v1/partidas/${a.id}/finalizar`, {
    token,
    corpo: { assinatura: a.assinatura, idempotencyKey: randomUUID(), duracaoMs: 11000, stats },
  });
  assert.equal(f.corpo.status, 'aceita');
  return f.corpo.pontos;
}
const ranking = (periodo, token) => chamar('GET', `/api/v1/ranking${periodo ? `?periodo=${periodo}` : ''}`, { token });

before(async () => {
  db = await abrirBanco(config.databaseUrl);
  await migrar(db);
  app = await construirApp({ config, db, relogio: () => new Date(agora) });

  for (const [nome, faixa] of [['ANA', '13+'], ['BETO', '13+'], ['CACÁ', '8-12'], ['DUDU', '13+']]) j[nome] = await cadastrar(nome, faixa);

  // semana passada: BETO faz a melhor partida da história
  j.BETO.recordeAntigo = await jogar(j.BETO.token, PERFEITO);

  agora = new Date('2026-10-14T15:00:00Z');
  j.ANA.pontos = await jogar(j.ANA.token, MEDIO);
  await jogar(j.ANA.token, FRACO); // pior que a anterior: não muda nada
  await jogar(j.ANA.token, { ...PERFEITO, auto: true }); // auto-play não entra
  j.BETO.semana = await jogar(j.BETO.token, FRACO);
  j.CACÁ.pontos = await jogar(j.CACÁ.token, PERFEITO); // criança: ranking público desligado
  await jogar(j.DUDU.token, PERFEITO);
  await db.query('UPDATE jogador SET banido = true WHERE id = $1', [j.DUDU.jogador.id]);

  // desafio do dia: só ANA joga
  const diario = { modo: 'diario', dataDiario: '2026-10-14' };
  j.ANA.diario = await jogar(j.ANA.token, { coletados: 4, total: 5, comboMax: 3, danos: 0, rapido: false, pulou: false, auto: false }, diario);
  // a partida do diário também é uma partida válida: vale para o global e o semanal
  j.ANA.melhor = Math.max(j.ANA.pontos, j.ANA.diario);
});
after(async () => {
  await app.close();
  await db.fechar();
});

const resumo = (top) => top.map((t) => `${t.posicao}:${t.apelido}:${t.pontos}`);

test('global: melhor partida de cada um, sem auto-play, crianças privadas nem banidos', async () => {
  const r = await ranking();
  assert.equal(r.status, 200);
  assert.equal(r.corpo.periodo, 'global');
  assert.deepEqual(resumo(r.corpo.top), [`1:BETO:${j.BETO.recordeAntigo}`, `2:ANA:${j.ANA.melhor}`]);
  assert.equal(r.corpo.voce, null);
  assert.equal(r.corpo.top[0].tag, j.BETO.jogador.tag);
  assert.equal('jogador_id' in r.corpo.top[0], false);
});

test('semana: só conta o que foi feito desde segunda-feira', async () => {
  const r = await ranking('semana');
  assert.equal(r.corpo.desde, '2026-10-12T03:00:00.000Z');
  assert.deepEqual(resumo(r.corpo.top), [`1:ANA:${j.ANA.melhor}`, `2:BETO:${j.BETO.semana}`]);
});

test('dia: ranking do desafio diário de hoje', async () => {
  const r = await ranking('dia');
  assert.equal(r.corpo.data, '2026-10-14');
  assert.deepEqual(resumo(r.corpo.top), [`1:ANA:${j.ANA.diario}`]);
});

test('com token: a linha do jogador vem marcada e "você" traz a posição', async () => {
  const r = await ranking('global', j.ANA.token);
  assert.deepEqual(r.corpo.top.map((t) => t.eu), [false, true]);
  assert.deepEqual(
    { posicao: r.corpo.voce.posicao, pontos: r.corpo.voce.pontos, publico: r.corpo.voce.publico },
    { posicao: 2, pontos: j.ANA.melhor, publico: true },
  );
});

test('criança com ranking desligado vê os próprios pontos, mas sem posição', async () => {
  const r = await ranking('global', j.CACÁ.token);
  assert.equal(r.corpo.top.some((t) => t.eu), false);
  assert.deepEqual(
    { publico: r.corpo.voce.publico, pontos: r.corpo.voce.pontos, posicao: r.corpo.voce.posicao },
    { publico: false, pontos: j.CACÁ.pontos, posicao: null },
  );
});

test('quem ainda não jogou no período recebe "você" sem pontos', async () => {
  const r = await ranking('dia', j.BETO.token);
  assert.equal(r.corpo.voce.pontos, null);
  assert.equal(r.corpo.voce.posicao, null);
});

test('período inválido e token inválido', async () => {
  assert.equal((await ranking('ano')).status, 400);
  assert.equal((await ranking('global', 'falso')).status, 401);
});

test('início da semana no fuso de São Paulo', () => {
  assert.equal(inicioDaSemana(new Date('2026-10-14T15:00:00Z')).toISOString(), '2026-10-12T03:00:00.000Z');
  // domingo 23:30 em SP ainda é a mesma semana
  assert.equal(inicioDaSemana(new Date('2026-10-19T02:30:00Z')).toISOString(), '2026-10-12T03:00:00.000Z');
  // segunda 00:30 em SP já é a semana nova
  assert.equal(inicioDaSemana(new Date('2026-10-19T03:30:00Z')).toISOString(), '2026-10-19T03:00:00.000Z');
});
