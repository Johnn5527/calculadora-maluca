/**
 * professor.js — Modo professor: transforma os passos brutos do motor em
 * uma explicação passo a passo em português.
 */
import { formatar, arredondar } from './math/engine.js';

const f = (x) => (Number.isFinite(x) ? formatar(x) : '?');

/** Lembrete da ordem das operações. */
export const ORDEM_DAS_OPERACOES =
  'Ordem: primeiro parênteses, depois √ e potência, depois × e ÷, e por último + e −. Empate? Da esquerda para a direita.';

/**
 * @param {{op:string,a:number,b:number|null,r:number|null,sinal?:string,parcela?:number}[]} passos
 * @returns {{conta:string, explicacao:string}[]}
 */
export function descreverPassos(passos) {
  return (passos || []).map((p) => {
    switch (p.op) {
      case 'add':
        return { conta: `${f(p.a)} + ${f(p.b)} = ${f(p.r)}`, explicacao: 'Soma: junta as duas parcelas.' };
      case 'sub':
        return { conta: `${f(p.a)} − ${f(p.b)} = ${f(p.r)}`, explicacao: `Subtração: tira ${f(p.b)} de ${f(p.a)}.` };
      case 'mul':
        return { conta: `${f(p.a)} × ${f(p.b)} = ${f(p.r)}`, explicacao: `Multiplicação: ${f(p.a)} repetido ${f(p.b)} vezes.` };
      case 'div':
        return { conta: `${f(p.a)} ÷ ${f(p.b)} = ${f(p.r)}`, explicacao: `Divisão: reparte ${f(p.a)} em ${f(p.b)} partes iguais.` };
      case 'pow': {
        const repetido = Number.isInteger(p.b) && p.b > 0 && p.b <= 6
          ? Array(p.b).fill(f(p.a)).join(' × ')
          : null;
        return {
          conta: `${f(p.a)} ^ ${f(p.b)} = ${f(p.r)}`,
          explicacao: repetido ? `Potência: ${repetido}.` : `Potência: ${f(p.a)} multiplicado por ele mesmo ${f(p.b)} vezes.`,
        };
      }
      case 'sqrt':
        return { conta: `√${f(p.a)} = ${f(p.r)}`, explicacao: `Raiz: qual número vezes ele mesmo dá ${f(p.a)}? É ${f(p.r)}.` };
      case 'pct':
        if (p.b === null || p.b === undefined) {
          return { conta: `${f(p.a)}% = ${f(p.r)}`, explicacao: `Porcentagem: ${f(p.a)} ÷ 100.` };
        }
        {
          const parcela = Number.isFinite(p.parcela) ? p.parcela : arredondar((p.a * p.b) / 100);
          const sinal = p.sinal === '-' ? '−' : '+';
          return {
            conta: `${f(p.a)} ${sinal} ${f(p.b)}% = ${f(p.r)}`,
            explicacao: `${f(p.b)}% de ${f(p.a)} é ${f(parcela)}; então ${f(p.a)} ${sinal} ${f(parcela)} = ${f(p.r)}.`,
          };
        }
      case 'divzero':
        return { conta: `${f(p.a)} ÷ 0 = ???`, explicacao: 'Ninguém consegue repartir em zero partes. O dragão comeu a conta!' };
      default:
        return { conta: '?', explicacao: 'Passo desconhecido.' };
    }
  });
}
