/**
 * config.js — Lê e valida as variáveis de ambiente. O servidor NÃO sobe se faltar alguma.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ARQUIVO_ENV = fileURLToPath(new URL('../.env', import.meta.url));
const TAMANHO_MIN_SEGREDO = 32;

/** Carrega server/.env (se existir) sem sobrescrever o que já veio do ambiente. */
export function carregarArquivoEnv(caminho = ARQUIVO_ENV) {
  if (existsSync(caminho)) process.loadEnvFile(caminho);
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{databaseUrl:string, hmacPartida:string, tokenPepper:string, corsOrigens:string[], porta:number, host:string}}
 */
export function lerConfig(env = process.env) {
  const erros = [];
  const exigir = (nome) => {
    const v = env[nome]?.trim();
    if (!v) erros.push(`${nome} não definida`);
    return v ?? '';
  };
  const segredo = (nome) => {
    const v = exigir(nome);
    if (v && v.length < TAMANHO_MIN_SEGREDO) erros.push(`${nome} precisa de pelo menos ${TAMANHO_MIN_SEGREDO} caracteres`);
    return v;
  };

  const databaseUrl = exigir('DATABASE_URL');
  const hmacPartida = segredo('HMAC_PARTIDA_SECRET');
  const tokenPepper = segredo('TOKEN_PEPPER');
  const corsOrigens = exigir('CORS_ORIGENS').split(',').map((o) => o.trim()).filter(Boolean);
  for (const o of corsOrigens) {
    if (o === '*' || !/^https?:\/\/[^/\s*]+$/.test(o)) erros.push(`CORS_ORIGENS: origem inválida "${o}" (use a origem exata, sem * nem barra no fim)`);
  }
  if (hmacPartida && hmacPartida === tokenPepper) erros.push('HMAC_PARTIDA_SECRET e TOKEN_PEPPER precisam ser diferentes');

  if (erros.length) throw new Error(`Configuração inválida:\n  - ${erros.join('\n  - ')}`);
  return {
    databaseUrl,
    hmacPartida,
    tokenPepper,
    corsOrigens,
    porta: Number(env.PORT) || 8787,
    host: env.HOST?.trim() || '127.0.0.1',
  };
}
