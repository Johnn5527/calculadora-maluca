/**
 * apelidos.js — Regras de apelido compartilhadas entre o app e o servidor.
 * Criança (até 12 anos) só escolhe da lista pronta: nada de nome real nem texto livre no ranking.
 * A partir de 13, apelido livre passa pelo filtro de palavrões abaixo.
 */

/** Formato aceito: 3 a 12 letras (com acento), números, espaço ou _. */
export const RE_APELIDO = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _]{3,12}$/;

/** Apelidos prontos para crianças (todos com até 12 caracteres). */
export const APELIDOS_PRONTOS = Object.freeze([
  'Tigre Veloz', 'Panda Mágico', 'Foca Feliz', 'Gato Ninja', 'Dino Rápido',
  'Coruja Sábia', 'Leão Bravo', 'Polvo Doido', 'Sapo Pulador', 'Raposa Azul',
  'Urso Gentil', 'Pinguim Top', 'Abelha Ágil', 'Tatu Bola', 'Peixe Voador',
  'Lobo Esperto', 'Zebra Listra', 'Cometa Azul', 'Robô Amigo', 'Foguete Zum',
  'Estrela Boa', 'Nuvem Fofa', 'Trovão Doce', 'Arco Íris', 'Pipoca Doida',
  'Bolha Feliz', 'Cacto Legal', 'Banana Nanica', 'Kiwi Valente', 'Jabuti Turbo',
  'Ouriço Ágil', 'Tucano Top', 'Arara Rápida', 'Mico Leão', 'Boto Rosa',
  'Capivara Zen', 'Lhama Chique', 'Polvo Pirata', 'Dragão Bom', 'Fada Ligeira',
]);

const SUBSTITUI = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' };

/** Tira acento, troca "l33t" por letra e junta letras repetidas: "P0RRRR4" vira "pora". */
export function normalizarApelido(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0134578@$]/g, (c) => SUBSTITUI[c])
    .replace(/(.)\1+/g, '$1');
}

// Pedaços que não podem aparecer em lugar nenhum do apelido (já normalizados).
// Lista base: amplie conforme aparecerem casos reais na moderação.
const RAIZES = [
  'caralh', 'buceta', 'xoxota', 'xereca', 'piroca', 'poraloca', 'foder', 'fodas', 'fodid', 'fodao',
  'viado', 'arombad', 'cuzao', 'bosta', 'merd', 'punheta', 'siririca', 'boquet', 'prostitut',
  'vagabund', 'vadia', 'retardad', 'mongoloid', 'estupr', 'pedofil', 'penis', 'vagina', 'putaria',
  'putinh', 'cacete', 'sapatao', 'nazi', 'hitler', 'tesao',
  'fuck', 'shit', 'bitch', 'cunt', 'niga', 'niger', 'fagot', 'whore', 'slut', 'porn', 'pusy',
  'asshole', 'bastard', 'nude',
];
// Palavras curtas ou comuns dentro de outras ("pora" em "temporada"): só contam inteiras.
const PALAVRAS = new Set([
  'cu', 'cus', 'puta', 'puto', 'putas', 'putos', 'fdp', 'vsf', 'pqp', 'tnc', 'krl', 'crl', 'pau',
  'rola', 'sexo', 'sex', 'xxx', 'rape', 'cock', 'dick', 'ass', 'bct', 'fod', 'foda', 'fode',
  'porra', 'bicha',
]);
const RAIZES_NORMAIS = RAIZES.map(normalizarApelido);
const PALAVRAS_NORMAIS = new Set([...PALAVRAS].map(normalizarApelido));

/** true se o apelido tiver palavrão (mesmo disfarçado com números, acento ou espaço no meio). */
export function apelidoImproprio(apelido) {
  const normal = normalizarApelido(apelido);
  const palavras = normal.split(/[^a-z]+/).filter(Boolean);
  const grudado = palavras.join('');
  if (palavras.some((p) => PALAVRAS_NORMAIS.has(p)) || PALAVRAS_NORMAIS.has(grudado)) return true;
  return RAIZES_NORMAIS.some((r) => grudado.includes(r));
}

/** O apelido pronto correspondente (ignora maiúsculas e espaços extras), ou null. */
export function apelidoProntoValido(apelido) {
  const chave = String(apelido).replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  return APELIDOS_PRONTOS.find((a) => a.toLocaleLowerCase('pt-BR') === chave) ?? null;
}

/** Sorteia um apelido pronto (para o cadastro automático de criança). */
export function sortearApelidoPronto(aleatorio = Math.random) {
  return APELIDOS_PRONTOS[Math.floor(aleatorio() * APELIDOS_PRONTOS.length)];
}
