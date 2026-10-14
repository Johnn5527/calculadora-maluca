import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferirPartida, MIN_MS_POR_FASE } from '../src/plausibilidade.js';
import { hashToken, gerarToken, assinarPartida, conferirAssinatura } from '../src/seguranca.js';
import { lerConfig } from '../src/config.js';
import { planejarFases, duracaoPrevistaMs, tetoColeta, montarPartida } from '../../js/regras-partida.js';
import { calcular } from '../../js/math/engine.js';
import { avaliarDesempenho } from '../../js/progresso.js';

const base = {
  stats: { coletados: 5, total: 8, comboMax: 3, danos: 0, rapido: false, pulou: false, auto: false },
  duracaoMs: 8000,
  decorridoMs: 8500,
  nFases: 1,
  tetoColeta: 10,
  duracaoPrevistaMs: 10000,
};
const conferir = (mudancas = {}, stats = {}) => conferirPartida({ ...base, ...mudancas, stats: { ...base.stats, ...stats } });

test('plausibilidade: partida normal passa', () => {
  assert.equal(conferir().ok, true);
});

test('plausibilidade: números impossíveis reprovam com motivo', () => {
  assert.match(conferir({}, { total: 11 }).motivo, /acima do possível/);
  assert.match(conferir({}, { coletados: 9 }).motivo, /coletou/);
  assert.match(conferir({}, { comboMax: 9 }).motivo, /combo/);
  assert.match(conferir({}, { danos: 500 }).motivo, /danos/);
});

test('plausibilidade: relógio do servidor manda', () => {
  assert.match(conferir({ duracaoMs: 20000, decorridoMs: 9000 }).motivo, /tempo real/);
  assert.match(conferir({ duracaoMs: MIN_MS_POR_FASE - 1 }).motivo, /rápida demais/);
  assert.match(conferir({ nFases: 3, duracaoMs: 4000, decorridoMs: 4000 }).motivo, /rápida demais/);
  // quem pulou pode terminar em 0,3 s (e não entra no ranking)
  assert.equal(conferir({ duracaoMs: 300, decorridoMs: 400 }, { pulou: true }).ok, true);
});

test('plausibilidade: "rápido" impossível perde o bônus, mas não reprova', () => {
  const r = conferir({ duracaoMs: 9500, decorridoMs: 9600 }, { rapido: true });
  assert.equal(r.ok, true);
  assert.equal(r.stats.rapido, false);
  assert.equal(conferir({ duracaoMs: 5000, decorridoMs: 5200 }, { rapido: true }).stats.rapido, true);
});

test('token: hash de 32 bytes, depende do pepper, nunca é o token', () => {
  const token = gerarToken();
  const h = hashToken(token, 'p'.repeat(40));
  assert.equal(h.length, 32);
  assert.deepEqual(h, hashToken(token, 'p'.repeat(40)));
  assert.notDeepEqual(h, hashToken(token, 'q'.repeat(40)));
  assert.notEqual(h.toString('utf8'), token);
});

test('assinatura HMAC: confere e detecta qualquer alteração', () => {
  const p = { id: 'a', jogadorId: 'b', seed: '123', iniciadaEm: new Date('2026-01-01T00:00:00Z') };
  const segredo = 's'.repeat(40);
  const ass = assinarPartida(segredo, p);
  assert.equal(conferirAssinatura(segredo, p, ass), true);
  assert.equal(conferirAssinatura(segredo, { ...p, jogadorId: 'c' }, ass), false);
  assert.equal(conferirAssinatura(segredo, { ...p, seed: 124 }, ass), false);
  assert.equal(conferirAssinatura('t'.repeat(40), p, ass), false);
  assert.equal(conferirAssinatura(segredo, p, 'lixo'), false);
  assert.equal(conferirAssinatura(segredo, p, undefined), false);
});

test('config: não sobe sem as variáveis e recusa CORS com *', () => {
  assert.throws(() => lerConfig({}), /DATABASE_URL[\s\S]*HMAC_PARTIDA_SECRET[\s\S]*TOKEN_PEPPER[\s\S]*CORS_ORIGENS/);
  const ok = { DATABASE_URL: 'pglite:memoria', HMAC_PARTIDA_SECRET: 'h'.repeat(32), TOKEN_PEPPER: 'p'.repeat(32), CORS_ORIGENS: 'http://localhost:5173' };
  assert.equal(lerConfig(ok).porta, 8787);
  assert.throws(() => lerConfig({ ...ok, CORS_ORIGENS: '*' }), /origem inválida/);
  assert.throws(() => lerConfig({ ...ok, CORS_ORIGENS: 'http://a.com/' }), /origem inválida/);
  assert.throws(() => lerConfig({ ...ok, TOKEN_PEPPER: 'curto' }), /32 caracteres/);
  assert.throws(() => lerConfig({ ...ok, TOKEN_PEPPER: ok.HMAC_PARTIDA_SECRET }), /diferentes/);
});

test('regras: durações e tetos batem com os minijogos', () => {
  const uma = planejarFases(calcular('2+3').fases);
  assert.deepEqual(uma.map((p) => [p.fase.op, p.relampago, p.duracao]), [['add', false, 9]]);
  assert.equal(duracaoPrevistaMs(uma), 10000);
  assert.equal(tetoColeta(uma), 10);

  const tres = planejarFases(calcular('2+3×4−1').fases, { multTempo: 2, relampago: { ligado: true, segundos: 5 } });
  assert.deepEqual(tres.map((p) => p.duracao), [10, 10, 10]);
  assert.equal(tres.every((p) => p.relampago), true);

  const desligado = planejarFases(calcular('2+3×4−1').fases, { relampago: { ligado: false, segundos: null } });
  assert.equal(desligado.length, 1);
  assert.equal(desligado[0].duracao, 9);
});

test('regras: modos chefe/diário e contas inválidas', () => {
  const chefe = montarPartida({ expressao: '1+2+3+4+5', modo: 'chefe' });
  assert.equal(chefe.plano[0].fase.op, 'chefe');
  assert.equal(chefe.plano[0].duracao, 14);
  assert.equal(montarPartida({ expressao: '1+2', modo: 'chefe' }).ok, false);
  assert.equal(montarPartida({ expressao: '2+', modo: 'normal' }).ok, false);
  assert.equal(montarPartida({ expressao: '5÷0', modo: 'normal' }).plano[0].fase.op, 'divzero');
  assert.equal(montarPartida({ modo: 'diario', dataDiario: '2026-10-14' }).plano[0].fase.op, 'chefe');
});

test('avaliação: pontos só de números conferíveis e velocidade pesa', () => {
  const st = { coletados: 8, total: 8, comboMax: 8, danos: 0, rapido: true, pulou: false, auto: false };
  const normal = avaliarDesempenho(st);
  assert.equal(avaliarDesempenho({ ...st, pontos: 999999 }).pontos, normal.pontos);
  assert.ok(avaliarDesempenho(st, { multTempo: 1.8 }).pontos < normal.pontos);
  assert.ok(avaliarDesempenho(st, { multTempo: 0.7 }).pontos > normal.pontos);
});
