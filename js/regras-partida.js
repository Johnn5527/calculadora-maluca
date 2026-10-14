/**
 * regras-partida.js — Regras puras de uma partida (sem DOM), usadas pelo app E pelo servidor.
 * O servidor importa este arquivo para montar as fases, prever a duração e limitar o que
 * o cliente pode declarar; por isso nada aqui pode depender do navegador.
 */
import { calcular } from './math/engine.js';
import { desafioDoDia } from './diario.js';

/** A partir de quantas operações a conta é "gigante" (vira chefão). */
export const OPERACOES_CONTA_GIGANTE = 4;

/** Contas com menos fases que isso jogam cada fase no tempo normal. */
export const MIN_FASES_RELAMPAGO = 3;

/** Durações-base (segundos) antes do multiplicador de velocidade. */
export const DURACAO_NORMAL = 9;
export const DURACAO_RELAMPAGO = 4;
const DURACAO_POR_OP = { chefe: 14, divzero: 7 };
const SEM_RELAMPAGO = new Set(['divzero', 'chefe']);

/** Tempo da animação de encerramento de cada fase (câmera lenta). */
const ENCERRAMENTO = { normal: 1.0, relampago: 0.55 };

/**
 * Maior "total" (itens coletáveis / acertos possíveis) que cada minijogo pode ter.
 * Espelha o criar() de cada jogo: o servidor recusa partidas que declarem mais que isso.
 */
export const TETO_COLETA = { add: 10, sub: 5, mul: 3, div: 5, pow: 6, sqrt: 3, pct: 3, divzero: 6, chefe: 6 };

export const OPS_COM_JOGO = Object.keys(TETO_COLETA);

/** Duração-base de uma fase (s): chefão e dragão têm a sua; relâmpago é sempre curta. */
export const duracaoBase = (op, relampago) => (relampago ? DURACAO_RELAMPAGO : DURACAO_POR_OP[op] ?? DURACAO_NORMAL);

/**
 * Decide se a conta vira luta de chefão e monta a fase única dele.
 * @param {object} res  resultado de calcular()
 * @param {{diario?:boolean, liberado?:boolean}} o  liberado = nível do chefão ou "chefão livre"
 */
export function fasesDoChefao(res, { diario = false, liberado = false } = {}) {
  const gigante = res.passos.length >= OPERACOES_CONTA_GIGANTE && liberado;
  if (!res.ok || !(diario || gigante)) return null;
  const n = res.passos.length;
  return [{ op: 'chefe', a: res.passos[0]?.a ?? res.valor, b: null, r: res.valor, hp: Math.min(6, Math.max(3, n)), passos: n }];
}

/**
 * Quais fases serão jogadas, se cada uma é relâmpago e quanto dura (s).
 * @param {object[]} fases  fases do engine (ou a fase do chefão)
 * @param {{multTempo?:number, relampago?:{ligado:boolean, segundos:number|null}}} o
 */
export function planejarFases(fases, { multTempo = 1, relampago = { ligado: true, segundos: null } } = {}) {
  let jogaveis = fases.filter((f) => TETO_COLETA[f.op] !== undefined);
  // relâmpago desligado (perfis infantil/sênior): joga só a última fase, que termina no resultado
  if (!relampago.ligado && jogaveis.length >= MIN_FASES_RELAMPAGO) jogaveis = jogaveis.slice(-1);
  const encadeada = jogaveis.length >= MIN_FASES_RELAMPAGO;
  return jogaveis.map((fase) => {
    const ehRelampago = encadeada && !SEM_RELAMPAGO.has(fase.op);
    const base = ehRelampago && relampago.segundos ? relampago.segundos : duracaoBase(fase.op, ehRelampago);
    return { fase, relampago: ehRelampago, duracao: base * multTempo };
  });
}

/** Duração máxima prevista (ms) de um plano: tempo das fases + encerramentos. */
export const duracaoPrevistaMs = (plano) =>
  Math.round(plano.reduce((s, p) => s + p.duracao + (p.relampago ? ENCERRAMENTO.relampago : ENCERRAMENTO.normal), 0) * 1000);

/** Soma dos tetos de coleta das fases do plano. */
export const tetoColeta = (plano) => plano.reduce((s, p) => s + TETO_COLETA[p.fase.op], 0);

/**
 * Monta a partida a partir do que o jogador digitou (ou do desafio do dia).
 * @param {{expressao?:string, modo:'normal'|'chefe'|'diario', dataDiario?:string,
 *          multTempo?:number, relampago?:object}} o
 * @returns {{ok:true, expressao:string, res:object, plano:object[]} | {ok:false, motivo:string}}
 */
export function montarPartida({ expressao, modo, dataDiario, multTempo = 1, relampago }) {
  const expr = modo === 'diario' ? desafioDoDia(dataDiario).expressao : String(expressao ?? '').trim();
  if (!expr) return { ok: false, motivo: 'Conta vazia' };
  const res = calcular(expr);
  if (!res.ok && res.tipo !== 'divzero') return { ok: false, motivo: res.mensagem };
  let fases = res.fases;
  if (modo === 'chefe' || modo === 'diario') {
    fases = fasesDoChefao(res, { diario: modo === 'diario', liberado: true });
    if (!fases) return { ok: false, motivo: 'Essa conta não vira chefão' };
  }
  const plano = planejarFases(fases, { multTempo, relampago });
  if (!plano.length) return { ok: false, motivo: 'Essa conta não tem minijogo' };
  return { ok: true, expressao: expr, res, plano };
}
