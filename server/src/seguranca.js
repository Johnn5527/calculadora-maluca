/**
 * seguranca.js — Tokens de jogador e assinatura HMAC das partidas.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** Token entregue ao app uma única vez (256 bits). */
export const gerarToken = () => randomBytes(32).toString('base64url');

/** O banco guarda só HMAC-SHA256(pepper, token): vazou o banco, os tokens continuam inúteis. */
export const hashToken = (token, pepper) => createHmac('sha256', pepper).update(String(token)).digest();

/** Semente da partida (guardada para, no futuro, refazer a partida no servidor). */
export const gerarSeed = () => randomInt(1, 2 ** 47);

/** Assina os campos que identificam a partida: id, dono, semente e início. */
export function assinarPartida(segredo, { id, jogadorId, seed, iniciadaEm }) {
  const msg = `${id}.${jogadorId}.${seed}.${new Date(iniciadaEm).getTime()}`;
  return createHmac('sha256', segredo).update(msg).digest('base64url');
}

export function conferirAssinatura(segredo, partida, assinatura) {
  const esperada = Buffer.from(assinarPartida(segredo, partida));
  const recebida = Buffer.from(String(assinatura ?? ''));
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}
