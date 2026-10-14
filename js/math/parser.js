/**
 * parser.js — Tokenizador + parser de descida recursiva (SEM eval).
 *
 * Gramática (da menor para a maior precedência):
 *   expressao := termo (('+' | '-') termo)*
 *   termo     := unario (('*' | '/') unario | <multiplicação implícita> unario)*
 *   unario    := ('-' | '+') unario | '√' unario | potencia
 *   potencia  := posfixo ('^' unario)?          (associativa à direita: 2^3^2 = 2^9)
 *   posfixo   := primario ('%')*
 *   primario  := numero | '(' expressao ')'      (parênteses finais podem ser omitidos)
 *
 * Detalhes:
 *   - "-2^2" = -(2^2) = -4 (convenção matemática).
 *   - "2(3)", "2√9", "(1)(2)" usam multiplicação implícita.
 *   - "%" é posfixo. O significado contextual (200 + 10% = 220) é resolvido no engine.
 */

export class ErroSintaxe extends Error {
  constructor(mensagem, posicao = -1) {
    super(mensagem);
    this.name = 'ErroSintaxe';
    this.tipo = 'sintaxe';
    this.posicao = posicao;
  }
}

/** Mapeia os símbolos aceitos (inclusive os "bonitos" da UI) para operadores internos. */
const SIMBOLOS = {
  '+': '+',
  '-': '-', '−': '-', '–': '-',
  '*': '*', '×': '*', 'x': '*', 'X': '*', '·': '*',
  '/': '/', '÷': '/', ':': '/',
  '^': '^',
  '%': '%',
  '√': '√',
};

export const TAMANHO_MAXIMO = 200;

/**
 * Converte o texto em uma lista de tokens.
 * @param {string} texto
 * @returns {{tipo:'num'|'op'|'('|')', valor:any, pos:number, texto:string}[]}
 */
export function tokenizar(texto) {
  if (typeof texto !== 'string') throw new ErroSintaxe('Expressão inválida');
  if (texto.length > TAMANHO_MAXIMO) throw new ErroSintaxe('Expressão longa demais');

  const tokens = [];
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];

    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }

    // Números: 12, 3.5, .5, 7., 1e5, 2.5e-3 (vírgula também vale como decimal)
    if (/[0-9.,]/.test(c)) {
      const inicio = i;
      let corpo = '';
      let pontos = 0;
      while (i < texto.length && /[0-9.,]/.test(texto[i])) {
        if (texto[i] === '.' || texto[i] === ',') { pontos++; corpo += '.'; } else corpo += texto[i];
        i++;
      }
      if (pontos > 1) throw new ErroSintaxe('Número com dois pontos decimais', inicio);
      if (corpo === '.') throw new ErroSintaxe('Ponto decimal sozinho', inicio);
      // Notação científica (vem do botão ANS com números enormes)
      if ((texto[i] === 'e' || texto[i] === 'E') && /[0-9+\-]/.test(texto[i + 1] || '')) {
        let exp = 'e';
        i++;
        if (texto[i] === '+' || texto[i] === '-') exp += texto[i++];
        if (!/[0-9]/.test(texto[i] || '')) throw new ErroSintaxe('Expoente inválido', i);
        while (i < texto.length && /[0-9]/.test(texto[i])) exp += texto[i++];
        corpo += exp;
      }
      const valor = Number(corpo);
      if (!Number.isFinite(valor)) throw new ErroSintaxe('Número inválido', inicio);
      tokens.push({ tipo: 'num', valor, pos: inicio, texto: texto.slice(inicio, i) });
      continue;
    }

    if (c === '(' || c === ')') {
      tokens.push({ tipo: c, valor: c, pos: i, texto: c });
      i++;
      continue;
    }

    if (SIMBOLOS[c]) {
      tokens.push({ tipo: 'op', valor: SIMBOLOS[c], pos: i, texto: c });
      i++;
      continue;
    }

    throw new ErroSintaxe(`Símbolo desconhecido "${c}"`, i);
  }
  return tokens;
}

/**
 * Gera a árvore sintática (AST) da expressão.
 * Nós: {tipo:'num', valor} | {tipo:'neg', arg} | {tipo:'raiz', arg} | {tipo:'pct', arg}
 *      | {tipo:'bin', op:'+'|'-'|'*'|'/'|'^', esq, dir}
 * @param {string} texto
 */
export function analisar(texto) {
  const tokens = tokenizar(texto);
  if (tokens.length === 0) throw new ErroSintaxe('Expressão vazia', 0);

  let i = 0;
  const ver = () => tokens[i];
  const comer = () => tokens[i++];
  const ehOp = (t, ...ops) => !!t && t.tipo === 'op' && ops.includes(t.valor);
  const comecaFator = (t) => !!t && (t.tipo === 'num' || t.tipo === '(' || ehOp(t, '√'));
  let profundidade = 0;

  function expressao() {
    let no = termo();
    while (ehOp(ver(), '+', '-')) {
      const op = comer().valor;
      no = { tipo: 'bin', op, esq: no, dir: termo() };
    }
    return no;
  }

  function termo() {
    let no = unario();
    for (;;) {
      const t = ver();
      if (ehOp(t, '*', '/')) {
        comer();
        no = { tipo: 'bin', op: t.valor, esq: no, dir: unario() };
      } else if (comecaFator(t)) {
        no = { tipo: 'bin', op: '*', esq: no, dir: unario(), implicito: true };
      } else {
        break;
      }
    }
    return no;
  }

  function unario() {
    const t = ver();
    if (ehOp(t, '-', '+')) {
      comer();
      const arg = unario();
      return t.valor === '-' ? { tipo: 'neg', arg } : arg;
    }
    if (ehOp(t, '√')) {
      comer();
      return { tipo: 'raiz', arg: unario() };
    }
    return potencia();
  }

  function potencia() {
    const base = posfixo();
    if (ehOp(ver(), '^')) {
      comer();
      return { tipo: 'bin', op: '^', esq: base, dir: unario() };
    }
    return base;
  }

  function posfixo() {
    let no = primario();
    while (ehOp(ver(), '%')) {
      comer();
      no = { tipo: 'pct', arg: no };
    }
    return no;
  }

  function primario() {
    const t = comer();
    if (!t) throw new ErroSintaxe('Expressão incompleta', texto.length);
    if (t.tipo === 'num') return { tipo: 'num', valor: t.valor };
    if (t.tipo === '(') {
      if (++profundidade > 50) throw new ErroSintaxe('Parênteses demais', t.pos);
      const no = expressao();
      profundidade--;
      const f = ver();
      if (f && f.tipo === ')') comer();
      else if (f) throw new ErroSintaxe(`Esperava ")" mas veio "${f.texto}"`, f.pos);
      // se acabou a expressão, fechamos o parêntese automaticamente (gentileza!)
      return no;
    }
    throw new ErroSintaxe(`Símbolo inesperado "${t.texto}"`, t.pos);
  }

  const arvore = expressao();
  if (i < tokens.length) {
    const t = tokens[i];
    throw new ErroSintaxe(`Símbolo inesperado "${t.texto}"`, t.pos);
  }
  return arvore;
}
