/**
 * skin-codigo.js — Formato das skins personalizadas e o código de compartilhamento.
 * Uma skin = mapa 12×12 do corpo do Teclito (caracteres . K B W P S) + paleta de 5 cores.
 * Código: "CM1." + base64url(JSON compacto). Puro (funciona no Node para testes).
 */
import { HEROI_CORPO, PALETAS_SKIN } from './games/game-base.js';

export const LARGURA_SKIN = 12;
export const ALTURA_SKIN = 12;
export const CORES_IDS = ['K', 'B', 'W', 'P', 'S'];
export const NOMES_CORES = { '.': 'Transparente', K: 'Contorno', B: 'Bandana', W: 'Corpo', P: 'Símbolo', S: 'Sapatos' };
const PREFIXO = 'CM1.';

/** Skin inicial do editor (cópia do Teclito clássico). */
export function skinBase() {
  return { mapa: [...HEROI_CORPO], paleta: { ...PALETAS_SKIN.classico } };
}

const ehCor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

export function validarSkin(skin) {
  if (!skin || !Array.isArray(skin.mapa) || skin.mapa.length !== ALTURA_SKIN) return false;
  if (!skin.mapa.every((l) => typeof l === 'string' && l.length === LARGURA_SKIN && /^[.KBWPS]+$/.test(l))) return false;
  return CORES_IDS.every((id) => ehCor(skin.paleta?.[id]));
}

const paraBase64Url = (txt) => btoa(txt).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64Url = (txt) => {
  const b = txt.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b + '='.repeat((4 - (b.length % 4)) % 4));
};

/** Gera o código compartilhável da skin. */
export function codificarSkin(skin) {
  if (!validarSkin(skin)) throw new Error('Skin inválida');
  const compacto = { m: skin.mapa.join(''), p: CORES_IDS.map((id) => skin.paleta[id].slice(1).toLowerCase()) };
  return PREFIXO + paraBase64Url(JSON.stringify(compacto));
}

/** Lê um código de skin. Lança erro com mensagem amigável se for inválido. */
export function decodificarSkin(codigo) {
  const txt = String(codigo || '').trim();
  if (!txt.startsWith(PREFIXO)) throw new Error('Código de skin inválido (deve começar com CM1.)');
  let dados;
  try {
    dados = JSON.parse(deBase64Url(txt.slice(PREFIXO.length)));
  } catch {
    throw new Error('Código de skin corrompido');
  }
  if (typeof dados?.m !== 'string' || !Array.isArray(dados?.p) || dados.p.length !== CORES_IDS.length) {
    throw new Error('Código de skin incompleto');
  }
  const mapa = [];
  for (let y = 0; y < ALTURA_SKIN; y++) mapa.push(dados.m.slice(y * LARGURA_SKIN, (y + 1) * LARGURA_SKIN));
  const paleta = Object.fromEntries(CORES_IDS.map((id, i) => [id, `#${String(dados.p[i])}`]));
  const skin = { mapa, paleta };
  if (!validarSkin(skin)) throw new Error('Código de skin com dados inválidos');
  return skin;
}
