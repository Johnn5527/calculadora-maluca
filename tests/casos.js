/**
 * casos.js — Casos de teste do motor matemático.
 * Os mesmos casos são espelhados no backend Java (CalculadoraServiceTest).
 *
 * Formato: [expressão, esperado]
 *   esperado = número  -> resultado deve ser exatamente esse valor
 *   esperado = 'sintaxe' | 'divzero' | 'dominio' | 'overflow' -> tipo de erro esperado
 */
export const CASOS = [
  // básicos
  ['1+1', 2],
  ['2+3*4', 14],
  ['(2+3)*4', 20],
  ['10-4-3', 3],
  ['100/4/5', 5],
  ['7/2', 3.5],
  ['2*3+4*5', 26],
  // ponto flutuante
  ['0.1+0.2', 0.3],
  ['0.1+0.2-0.3', 0],
  ['1.1*3', 3.3],
  ['1/3*3', 1],
  ['0.3-0.1', 0.2],
  ['1/3', 0.333333333333],
  // negativos e unários
  ['-5+3', -2],
  ['-(2+3)', -5],
  ['--4', 4],
  ['3*-2', -6],
  ['-2^2', -4],
  ['(-2)^2', 4],
  // potência
  ['2^10', 1024],
  ['2^3^2', 512],
  ['2^-1', 0.5],
  ['4^0.5', 2],
  ['10^15', 1e15],
  // raiz
  ['√9', 3],
  ['√2*√2', 2],
  ['2√9', 6],
  ['√(16)+1', 5],
  ['√0', 0],
  // porcentagem
  ['50%', 0.5],
  ['200+10%', 220],
  ['200-10%', 180],
  ['200*10%', 20],
  ['10%*200', 20],
  // parênteses e multiplicação implícita
  ['2(3+4)', 14],
  ['(1+2)(3+4)', 21],
  ['((((5))))', 5],
  ['(2+3', 5],
  // decimais e símbolos da UI
  ['.5+.5', 1],
  ['3,5+1', 4.5],
  ['6×7', 42],
  ['84÷2', 42],
  ['9−10', -1],
  ['1e3+1', 1001],
  ['999999*999999', 999998000001],
  // erros
  ['', 'sintaxe'],
  ['2+', 'sintaxe'],
  ['*3', 'sintaxe'],
  ['1..2', 'sintaxe'],
  ['2)', 'sintaxe'],
  ['abc', 'sintaxe'],
  ['5/0', 'divzero'],
  ['1/(2-2)', 'divzero'],
  ['0^-1', 'divzero'],
  ['√-4', 'dominio'],
  ['(-8)^0.5', 'dominio'],
  ['10^400', 'overflow'],
];
