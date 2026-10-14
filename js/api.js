/**
 * api.js — Conversa com o servidor do ranking (/api/v1).
 * Tudo é opcional: com o servidor desligado ou fora do ar, o app segue só com o localStorage.
 * O cliente nunca manda pontos nem rank: só os números brutos da partida; o servidor calcula o resto.
 */
import { carregarJogador, salvarJogador, esquecerJogador } from './storage.js';
import { RE_APELIDO, apelidoImproprio, sortearApelidoPronto } from './apelidos.js';
import { FAIXAS_COM_RESPONSAVEL, VERSAO_TERMOS } from './responsavel.js';

const TEMPO_LIMITE_MS = 4000;
const FAIXA_DO_PERFIL = { infantil: '4-7', crianca: '8-12', teen: '13+', senior: '60+' };
const faixaDoPerfil = (cfg) => FAIXA_DO_PERFIL[cfg.perfil] ?? '13+';

/** true quando o perfil é de criança e ainda falta um adulto autorizar o ranking online. */
export const precisaResponsavel = (cfg) =>
  FAIXAS_COM_RESPONSAVEL.has(faixaDoPerfil(cfg)) && cfg.consentimento?.versao !== VERSAO_TERMOS;

const raiz = (cfg) => `${cfg.backendUrl.replace(/\/$/, '')}/api/v1`;
const ativo = (cfg) => !!(cfg.backendAtivo && cfg.backendUrl);

class ErroApi extends Error {
  constructor(status, corpo) {
    super(corpo?.erro?.mensagem || `HTTP ${status}`);
    this.status = status;
    this.codigo = corpo?.erro?.codigo;
  }
}

async function requisitar(cfg, caminho, { metodo = 'GET', corpo, token } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resp = await fetch(raiz(cfg) + caminho, {
      method: metodo,
      headers: {
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
    const dados = resp.status === 204 ? null : await resp.json().catch(() => null);
    if (!resp.ok) throw new ErroApi(resp.status, dados);
    return dados;
  } finally {
    clearTimeout(timer);
  }
}

/** UUID v4 (crypto.randomUUID só existe em contexto seguro; no celular via IP da rede, não). */
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Apelido no formato que o servidor aceita (3 a 12 letras, números, espaço ou _) e sem palavrão. */
export function apelidoDoNome(nome) {
  const limpo = String(nome || '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9 _]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12).trim();
  return RE_APELIDO.test(limpo) && !apelidoImproprio(limpo) ? limpo : 'JOGADOR';
}

let cadastroEmAndamento = null;

/** Corpo do cadastro: criança ganha apelido sorteado da lista e leva a autorização do adulto. */
function dadosDoCadastro(cfg) {
  const faixaEtaria = faixaDoPerfil(cfg);
  if (!FAIXAS_COM_RESPONSAVEL.has(faixaEtaria)) return { apelido: apelidoDoNome(cfg.nome), faixaEtaria };
  return { apelido: sortearApelidoPronto(), faixaEtaria, consentimentoResponsavel: true, versaoTermos: cfg.consentimento.versao };
}

async function cadastrar(cfg) {
  const corpo = dadosDoCadastro(cfg);
  try {
    return await requisitar(cfg, '/jogadores', { metodo: 'POST', corpo });
  } catch (e) {
    // o servidor pode ter um filtro mais novo que este app: tenta de novo com o apelido padrão
    if (e.codigo !== 'apelido_improprio' && e.codigo !== 'apelido_invalido') throw e;
    return requisitar(cfg, '/jogadores', { metodo: 'POST', corpo: { ...corpo, apelido: 'JOGADOR' } });
  }
}

/**
 * Cadastra o jogador anônimo na primeira vez (o token fica só neste aparelho).
 * Trocar o perfil para outra faixa de idade cria um jogador novo, com as regras daquela faixa.
 * @returns {Promise<object|null>} null quando falta a autorização do responsável
 */
async function garantirJogador(cfg) {
  if (precisaResponsavel(cfg)) return null;
  const salvo = carregarJogador();
  if (salvo?.servidor === raiz(cfg) && salvo.faixaEtaria === faixaDoPerfil(cfg)) return salvo;
  cadastroEmAndamento ??= cadastrar(cfg)
    .then(({ jogador, token }) => {
      const j = { ...jogador, token, servidor: raiz(cfg) };
      salvarJogador(j);
      return j;
    })
    .finally(() => { cadastroEmAndamento = null; });
  return cadastroEmAndamento;
}

/**
 * Ranking online (top 10 + "você", quando este aparelho já tem jogador).
 * @param {'global'|'semana'|'dia'} periodo
 * @returns {Promise<{top:object[], voce:object|null, periodo:string} | {desligado:true} | {erro:true}>}
 */
export async function buscarRanking(cfg, periodo) {
  if (!ativo(cfg)) return { desligado: true };
  const salvo = carregarJogador();
  const token = salvo?.servidor === raiz(cfg) ? salvo.token : undefined;
  try {
    return await requisitar(cfg, `/ranking?periodo=${encodeURIComponent(periodo)}`, { token });
  } catch (e) {
    if (e.status === 401 && token) {
      esquecerJogador();
      return buscarRanking(cfg, periodo);
    }
    console.info('[servidor] ranking indisponível:', e.message);
    return { erro: true };
  }
}

/**
 * LGPD: apaga no servidor tudo do jogador deste aparelho (partidas, diário, token).
 * @returns {Promise<'apagado'|'nada'|'erro'>}
 */
export async function apagarDadosOnline(cfg) {
  const salvo = carregarJogador();
  if (!salvo?.token) return 'nada';
  try {
    await requisitar({ ...cfg, backendUrl: salvo.servidor.replace(/\/api\/v1$/, '') }, '/eu', { metodo: 'DELETE', token: salvo.token });
  } catch (e) {
    if (e.status !== 401) return 'erro'; // 401: já não existia no servidor
  }
  esquecerJogador();
  return 'apagado';
}

/**
 * Abre a partida no servidor (ele já calcula a conta e as fases).
 * @returns {Promise<object|null>} null quando offline/desligado
 */
export async function abrirPartida(cfg, dados) {
  if (!ativo(cfg)) return null;
  try {
    const jogador = await garantirJogador(cfg);
    if (!jogador) return null;
    const partida = await requisitar(cfg, '/partidas', { metodo: 'POST', corpo: dados, token: jogador.token });
    return { ...partida, token: jogador.token, idempotencyKey: uuid() };
  } catch (e) {
    if (e.status === 401) esquecerJogador(); // conta apagada ou token revogado: cadastra de novo na próxima
    console.info('[servidor] partida só local:', e.message);
    return null;
  }
}

/**
 * Fecha a partida mandando só os números brutos. Repete uma vez se a rede falhar
 * (o servidor é idempotente: a mesma chave nunca conta duas vezes).
 */
export async function finalizarPartida(cfg, aberta, stats) {
  const partida = await aberta;
  if (!partida) return null;
  const corpo = {
    assinatura: partida.assinatura,
    idempotencyKey: partida.idempotencyKey,
    duracaoMs: Math.max(0, Math.round(stats.duracaoMs || 0)),
    stats: {
      coletados: Math.max(0, stats.coletados || 0),
      total: Math.max(0, stats.total || 0),
      comboMax: Math.max(0, stats.comboMax || 0),
      danos: Math.max(0, stats.danos || 0),
      rapido: !!stats.rapido,
      pulou: !!stats.pulou,
      auto: !!stats.auto,
    },
  };
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const r = await requisitar(cfg, `/partidas/${partida.id}/finalizar`, { metodo: 'POST', corpo, token: partida.token });
      if (r?.status === 'recusada') console.info('[servidor] partida recusada:', r.motivo);
      return r;
    } catch (e) {
      if (e.status) {
        console.info('[servidor] não deu para fechar a partida:', e.message);
        return null;
      }
      if (tentativa < 2) await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  return null;
}
