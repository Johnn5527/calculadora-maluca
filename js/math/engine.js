/**
 * engine.js — Motor matemático da Calculadora Maluca.
 *
 * REGRA DE OURO: este módulo é a única fonte da verdade do resultado.
 * Os minijogos apenas decoram o valor calculado aqui.
 *
 * Estratégia contra erro de ponto flutuante:
 *   - cada operação intermediária é arredondada para 15 dígitos significativos;
 *   - o resultado final é arredondado para 12 dígitos significativos.
 *   Assim 0.1 + 0.2 = 0.3, 0.1 + 0.2 - 0.3 = 0 e (1/3) * 3 = 1.
 */
import { analisar, ErroSintaxe } from './parser.js';

export const DIGITOS_INTERNOS = 15;
export const DIGITOS_FINAIS = 12;

export class ErroMatematico extends Error {
  /** @param {'divzero'|'dominio'|'overflow'} tipo */
  constructor(tipo, mensagem) {
    super(mensagem);
    this.name = 'ErroMatematico';
    this.tipo = tipo;
  }
}

/** Arredonda para N dígitos significativos e elimina o -0. */
export function arredondar(x, digitos = DIGITOS_INTERNOS) {
  if (!Number.isFinite(x)) return x;
  if (x === 0) return 0;
  return Number(x.toPrecision(digitos));
}

/** Formata o número para o visor (notação científica só para valores extremos). */
export function formatar(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) return 'ERRO';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '-∞';
  if (x === 0) return '0';
  const abs = Math.abs(x);
  if (abs >= 1e15 || abs < 1e-9) {
    // 1.23456789e+20 -> 1.23456789e20
    return arredondar(x, DIGITOS_FINAIS).toExponential().replace('e+', 'e');
  }
  return String(arredondar(x, DIGITOS_FINAIS));
}

/** Nome amigável de cada operação. */
export const NOMES_OPERACOES = {
  add: 'Soma',
  sub: 'Subtração',
  mul: 'Multiplicação',
  div: 'Divisão',
  pow: 'Potência',
  sqrt: 'Raiz',
  pct: 'Porcentagem',
  divzero: 'Divisão por zero',
};

const OP_BIN = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '^': 'pow' };

/**
 * Avalia a AST registrando cada operação feita (as "fases").
 * @param {object} no
 * @param {{op:string,a:number,b:number|null,r:number}[]} fases
 */
function avaliar(no, fases) {
  switch (no.tipo) {
    case 'num':
      return no.valor;

    case 'neg':
      return arredondar(-avaliar(no.arg, fases));

    case 'raiz': {
      const v = avaliar(no.arg, fases);
      if (v < 0) throw new ErroMatematico('dominio', 'Raiz de número negativo (isso é coisa de número imaginário!)');
      const r = arredondar(Math.sqrt(v));
      fases.push({ op: 'sqrt', a: v, b: null, r });
      return r;
    }

    case 'pct': {
      // Porcentagem "solta": 50% = 0.5
      const v = avaliar(no.arg, fases);
      const r = arredondar(v / 100);
      fases.push({ op: 'pct', a: v, b: null, r });
      return r;
    }

    case 'bin': {
      // Porcentagem contextual de calculadora: 200 + 10% = 220 ; 200 - 10% = 180
      if ((no.op === '+' || no.op === '-') && no.dir.tipo === 'pct') {
        const a = avaliar(no.esq, fases);
        const p = avaliar(no.dir.arg, fases);
        const parcela = arredondar((a * p) / 100);
        const r = arredondar(no.op === '+' ? a + parcela : a - parcela);
        fases.push({ op: 'pct', a, b: p, r, sinal: no.op, parcela });
        return verificar(r);
      }

      const a = avaliar(no.esq, fases);
      const b = avaliar(no.dir, fases);
      let r;
      switch (no.op) {
        case '+': r = a + b; break;
        case '-': r = a - b; break;
        case '*': r = a * b; break;
        case '/':
          if (b === 0) {
            fases.push({ op: 'divzero', a, b: 0, r: null });
            throw new ErroMatematico('divzero', 'Divisão por zero');
          }
          r = a / b;
          break;
        case '^':
          if (a === 0 && b < 0) throw new ErroMatematico('divzero', 'Zero elevado a negativo é divisão por zero');
          r = Math.pow(a, b);
          if (Number.isNaN(r)) throw new ErroMatematico('dominio', 'Potência fracionária de número negativo');
          break;
        default:
          throw new ErroSintaxe(`Operador desconhecido ${no.op}`);
      }
      r = verificar(arredondar(r));
      fases.push({ op: OP_BIN[no.op], a, b, r });
      return r;
    }

    default:
      throw new ErroSintaxe('Nó desconhecido');
  }
}

function verificar(r) {
  if (!Number.isFinite(r)) throw new ErroMatematico('overflow', 'Número grande demais até para o dragão');
  return r;
}

/**
 * Junta fases consecutivas da mesma operação (1+2+3+4 vira uma única fase de soma)
 * e limita a quantidade para que o minijogo dure no máximo ~8 segundos.
 */
export function compactarFases(fases, maximo = 3) {
  const juntas = [];
  for (const f of fases) {
    const ultima = juntas[juntas.length - 1];
    if (ultima && ultima.op === f.op && ultima.r === f.a) {
      ultima.b = ultima.op === 'add' || ultima.op === 'sub' ? arredondar((ultima.b ?? 0) + (f.b ?? 0)) : f.b;
      ultima.r = f.r;
      ultima.passos = (ultima.passos || 1) + 1;
    } else {
      juntas.push({ ...f, passos: 1 });
    }
  }
  return juntas.slice(-maximo);
}

/**
 * Calcula a expressão.
 * @param {string} expressao
 * `passos` é a lista bruta de operações na ordem em que foram feitas (modo professor).
 * @returns {{ok:true, valor:number, texto:string, fases:object[], passos:object[], principal:string|null}
 *         | {ok:false, tipo:string, mensagem:string, fases:object[], passos:object[]}}
 */
export function calcular(expressao) {
  const fasesBrutas = [];
  const passos = () => fasesBrutas.map((f) => ({ ...f }));
  try {
    const arvore = analisar(expressao);
    const bruto = avaliar(arvore, fasesBrutas);
    const valor = arredondar(verificar(bruto), DIGITOS_FINAIS);
    const fases = compactarFases(fasesBrutas);
    // operação principal = a última executada (raiz da árvore)
    const principal = fasesBrutas.length ? fasesBrutas[fasesBrutas.length - 1].op : null;
    if (fases.length) fases[fases.length - 1].r = valor;
    return { ok: true, valor, texto: formatar(valor), fases, passos: passos(), principal };
  } catch (e) {
    if (e instanceof ErroMatematico) {
      const fases = e.tipo === 'divzero' ? [{ op: 'divzero', a: 0, b: 0, r: null, passos: 1 }] : [];
      return { ok: false, tipo: e.tipo, mensagem: e.message, fases, passos: passos() };
    }
    if (e instanceof ErroSintaxe) {
      return { ok: false, tipo: 'sintaxe', mensagem: e.message, posicao: e.posicao, fases: [], passos: [] };
    }
    return { ok: false, tipo: 'interno', mensagem: 'Erro inesperado no motor', fases: [], passos: [] };
  }
}
