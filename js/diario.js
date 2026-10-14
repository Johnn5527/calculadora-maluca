/**
 * diario.js — Desafio diário: a mesma "conta gigante" para todo mundo no mesmo dia.
 * A conta é gerada por um PRNG com semente = data local, então não precisa de servidor.
 * O desafio diário sempre vira uma luta contra o Chefão.
 */
import { VERSAO_PONTOS } from './progresso.js';

/** Data local no formato AAAA-MM-DD. */
export function dataLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Dia anterior a uma data AAAA-MM-DD. */
export function diaAnterior(data) {
  const [a, m, d] = data.split('-').map(Number);
  return dataLocal(new Date(a, m - 1, d - 1));
}

/** Hash FNV-1a de 32 bits. */
function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG mulberry32: determinístico a partir da semente. */
function mulberry32(semente) {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gerador determinístico (0..1) a partir de um texto: mesmo texto, mesma sequência. */
export const rngDoTexto = (texto) => mulberry32(hash(texto));

/** Modelos de contas gigantes (4 ou 5 operações, nunca dividem por zero). */
const MODELOS = [
  ({ n, quad }) => `${n(2, 9)}×${n(2, 9)}+√${quad()}−${n(1, 20)}`,
  ({ n, escolher }) => `(${n(10, 50)}+${n(10, 50)})÷${escolher([2, 4, 5])}+${n(2, 5)}^2`,
  ({ n, escolher, quad }) => `${n(100, 500)}+${escolher([10, 20, 25, 50])}%−${n(2, 9)}×${n(2, 9)}+√${quad()}`,
  ({ n, escolher, quad }) => `${n(2, 4)}^${n(2, 5)}−√${quad()}+${n(10, 99)}÷${escolher([2, 5, 10])}`,
  ({ n, quad }) => `√${quad()}×(${n(2, 9)}+${n(2, 9)})−${n(1, 9)}^2`,
];

/** Gera o desafio do dia. */
export function desafioDoDia(data = dataLocal()) {
  const rnd = mulberry32(hash(`calculadora-maluca:${data}`));
  const n = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  const escolher = (lista) => lista[Math.floor(rnd() * lista.length)];
  const quad = () => n(2, 15) ** 2;
  const modelo = MODELOS[Math.floor(rnd() * MODELOS.length)];
  return { data, expressao: modelo({ n, escolher, quad }) };
}

export const DIARIO_PADRAO = { registros: {}, ultimaData: null, sequencia: 0 };

/**
 * Registra uma tentativa do desafio do dia (guarda a melhor) e atualiza a sequência de dias.
 * @returns {{estado:object, melhorou:boolean}}
 */
export function registrarDiario(estado, data, avaliacao) {
  const anterior = estado.registros[data];
  // recorde feito com outra fórmula de pontos não se compara: a nova tentativa substitui
  const melhorou = !anterior || anterior.versao !== VERSAO_PONTOS || avaliacao.pontos > anterior.pontos;
  const registros = { ...estado.registros };
  if (melhorou) registros[data] = { pontos: avaliacao.pontos, rank: avaliacao.rank, estrelas: avaliacao.estrelas, versao: VERSAO_PONTOS };

  // mantém só os últimos 14 dias
  const datas = Object.keys(registros).sort().slice(-14);
  const cortados = Object.fromEntries(datas.map((d) => [d, registros[d]]));

  let sequencia = estado.sequencia || 0;
  if (estado.ultimaData !== data) sequencia = estado.ultimaData === diaAnterior(data) ? sequencia + 1 : 1;

  return { estado: { registros: cortados, ultimaData: data, sequencia }, melhorou };
}

/** Já jogou o desafio hoje? */
export const jogouHoje = (estado, data = dataLocal()) => !!estado.registros?.[data];
