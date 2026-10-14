/**
 * responsavel.js — Portão do responsável: antes de uma criança (até 12 anos) entrar no
 * ranking online, um adulto precisa ler o resumo, resolver um desafio e autorizar.
 */

/** Versão da política/termos que o adulto aceitou (muda quando o texto mudar). */
export const VERSAO_TERMOS = '2026-10-rascunho';

/** Faixas que precisam de consentimento do responsável. */
export const FAIXAS_COM_RESPONSAVEL = new Set(['4-7', '8-12']);

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];

/** Número de 0 a 99 por extenso ("quarenta e sete"). */
export function porExtenso(n) {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return DEZ_A_DEZENOVE[n - 10];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d];
}

/**
 * Desafio para adulto: ler um número escrito por extenso e digitá-lo em algarismos.
 * Fica entre 21 e 99 e nunca é dezena redonda, para não dar para chutar.
 */
export function novoDesafio(aleatorio = Math.random) {
  let n;
  do n = 21 + Math.floor(aleatorio() * 79);
  while (n % 10 === 0);
  return { texto: porExtenso(n), resposta: String(n) };
}
