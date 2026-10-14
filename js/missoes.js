/**
 * missoes.js — 3 missões diárias com baú + sequência de dias (streak) com prêmios.
 * Regras puras (sem DOM). As missões do dia são sorteadas pela data, então são iguais
 * para todo mundo do mesmo perfil.
 *
 * Eventos aceitos:
 *   {tipo:'partida', stats, avaliacao, ops, diario, chefao}
 *   {tipo:'professor'}
 */
import { diaAnterior, rngDoTexto } from './diario.js';

const partida = (ev) => ev.tipo === 'partida';
const jogou = (ev) => partida(ev) && !ev.stats?.pulou;
const usou = (op) => (ev) => (partida(ev) && ev.ops?.includes(op) ? 1 : 0);

/**
 * semJogo: dá para cumprir no modo direto (minijogos desligados).
 * excluir: perfis em que a missão não faz sentido (ex.: × para quem só tem + e −).
 */
export const MISSOES = [
  { id: 'partidas3', icone: '🧮', desc: 'Resolva 3 contas', meta: 3, semJogo: true, conta: (ev) => (partida(ev) ? 1 : 0) },
  { id: 'soma2', icone: '➕', desc: 'Faça 2 contas com +', meta: 2, semJogo: true, conta: usou('add') },
  { id: 'menos2', icone: '➖', desc: 'Faça 2 contas com −', meta: 2, semJogo: true, conta: usou('sub') },
  { id: 'vezes', icone: '✖️', desc: 'Faça uma conta com ×', meta: 1, semJogo: true, excluir: ['infantil'], conta: usou('mul') },
  { id: 'divide', icone: '➗', desc: 'Faça uma conta com ÷', meta: 1, semJogo: true, excluir: ['infantil'], conta: usou('div') },
  { id: 'raiz', icone: '🌱', desc: 'Use a raiz √', meta: 1, semJogo: true, excluir: ['infantil', 'crianca'], conta: usou('sqrt') },
  { id: 'professor', icone: '📖', desc: 'Abra o passo a passo de uma conta', meta: 1, semJogo: true, conta: (ev) => (ev.tipo === 'professor' ? 1 : 0) },
  { id: 'diario', icone: '📅', desc: 'Enfrente o desafio diário', meta: 1, semJogo: true, conta: (ev) => (partida(ev) && ev.diario ? 1 : 0) },
  { id: 'combo5', icone: '🔥', desc: 'Faça um combo de 5', meta: 1, conta: (ev) => (jogou(ev) && (ev.stats.comboMax || 0) >= 5 ? 1 : 0) },
  { id: 'semPular', icone: '💪', desc: 'Termine um minijogo sem pular nem auto-play', meta: 1, conta: (ev) => (jogou(ev) && !ev.stats.auto && (ev.stats.total || 0) > 0 ? 1 : 0) },
  { id: 'rankA', icone: '🅰️', desc: 'Tire rank A ou S', meta: 1, conta: (ev) => (jogou(ev) && ['A', 'S'].includes(ev.avaliacao?.rank) ? 1 : 0) },
  { id: 'estrelas6', icone: '⭐', desc: 'Junte 6 estrelas', meta: 6, conta: (ev) => (jogou(ev) ? ev.avaliacao?.estrelas || 0 : 0) },
  { id: 'chefao', icone: '👑', desc: 'Derrube o Rei Ábaco', meta: 1, excluir: ['infantil'], conta: (ev) => (jogou(ev) && ev.chefao ? 1 : 0) },
];

export const XP_BAU_DIARIO = 80;
export const XP_BAU_SEMANAL = 150;
export const DIAS_SKIN_PIRATA = 7;
export const DIAS_SKIN_LENDARIA = 30;

export const MISSOES_PADRAO = {
  data: null,
  chave: null, // perfil/modo usados no sorteio do dia
  ids: [],
  progresso: {},
  bauAberto: false,
  streak: { ultimaData: null, sequencia: 0, melhor: 0, premios: [] },
};

/** Sorteia as 3 missões do dia para o perfil. */
export function missoesDoDia(data, { perfil = null, comJogos = true } = {}) {
  const pool = MISSOES.filter((m) => (comJogos || m.semJogo) && !(perfil && m.excluir?.includes(perfil)));
  const rnd = rngDoTexto(`missoes:${data}:${perfil || '-'}:${comJogos ? 1 : 0}`);
  const embaralhado = [...pool];
  for (let i = embaralhado.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [embaralhado[i], embaralhado[j]] = [embaralhado[j], embaralhado[i]];
  }
  return embaralhado.slice(0, 3).map((m) => m.id);
}

const chaveDoSorteio = ({ perfil = null, comJogos = true } = {}) => `${perfil || '-'}:${comJogos ? 1 : 0}`;

/**
 * Garante que o estado é do dia `data`: sorteia novas missões quando o dia vira, ou quando
 * o perfil / modo direto mudou e o baú do dia ainda não foi aberto (o progresso é mantido).
 */
export function prepararDia(estadoAtual, data, opcoes) {
  const estado = { ...MISSOES_PADRAO, ...estadoAtual, streak: { ...MISSOES_PADRAO.streak, ...estadoAtual?.streak } };
  const chave = chaveDoSorteio(opcoes);
  if (estado.data === data && estado.ids.length) {
    if (estado.chave === chave || estado.bauAberto) return estadoAtual; // nada mudou: mesmo objeto (evita salvar à toa)
    return { ...estado, chave, ids: missoesDoDia(data, opcoes) };
  }
  return { ...estado, data, chave, ids: missoesDoDia(data, opcoes), progresso: {}, bauAberto: false };
}

export const missaoPorId = (id) => MISSOES.find((m) => m.id === id);

export const missaoCompleta = (estado, id) => (estado.progresso[id] || 0) >= (missaoPorId(id)?.meta ?? Infinity);

/**
 * Processa um evento.
 * @returns {{estado:object, concluidas:object[], bau:{xp:number}|null, recompensas:{tipo:string, xp?:number, skin?:string, dias:number}[]}}
 */
export function atualizarMissoes(estadoAtual, data, ev, opcoes = {}) {
  let estado = prepararDia(estadoAtual, data, opcoes);
  estado = { ...estado, progresso: { ...estado.progresso }, streak: { ...estado.streak, premios: [...estado.streak.premios] } };

  const concluidas = [];
  for (const id of estado.ids) {
    const m = missaoPorId(id);
    if (!m || missaoCompleta(estado, id)) continue;
    const inc = m.conta(ev);
    if (!inc) continue;
    estado.progresso[id] = Math.min(m.meta, (estado.progresso[id] || 0) + inc);
    if (missaoCompleta(estado, id)) concluidas.push(m);
  }

  let bau = null;
  if (!estado.bauAberto && estado.ids.length && estado.ids.every((id) => missaoCompleta(estado, id))) {
    estado.bauAberto = true;
    bau = { xp: XP_BAU_DIARIO };
  }

  // sequência: conta dias com pelo menos uma conta resolvida
  const recompensas = [];
  if (partida(ev) && estado.streak.ultimaData !== data) {
    const s = estado.streak;
    s.sequencia = s.ultimaData === diaAnterior(data) ? s.sequencia + 1 : 1;
    s.ultimaData = data;
    s.melhor = Math.max(s.melhor, s.sequencia);
    if (s.sequencia % 7 === 0) recompensas.push({ tipo: 'bau', xp: XP_BAU_SEMANAL, dias: s.sequencia });
    if (s.sequencia >= DIAS_SKIN_PIRATA && !s.premios.includes('pirata')) {
      s.premios.push('pirata');
      recompensas.push({ tipo: 'skin', skin: 'pirata', dias: s.sequencia });
    }
    if (s.sequencia >= DIAS_SKIN_LENDARIA && !s.premios.includes('lendaria')) {
      s.premios.push('lendaria');
      recompensas.push({ tipo: 'skin', skin: 'lendaria', dias: s.sequencia });
    }
  }

  return { estado, concluidas, bau, recompensas };
}

/** Sequência que ainda vale hoje (zera se o último dia jogado foi antes de ontem). */
export function sequenciaAtual(streak, hoje) {
  if (!streak?.ultimaData) return 0;
  return streak.ultimaData === hoje || streak.ultimaData === diaAnterior(hoje) ? streak.sequencia : 0;
}

/** Quantos dias faltam para o próximo baú semanal e para cada skin de sequência. */
export function proximosPremios(streak, hoje) {
  const seq = sequenciaAtual(streak, hoje);
  return {
    bau: 7 - (seq % 7),
    pirata: streak.premios.includes('pirata') ? null : Math.max(0, DIAS_SKIN_PIRATA - seq),
    lendaria: streak.premios.includes('lendaria') ? null : Math.max(0, DIAS_SKIN_LENDARIA - seq),
  };
}
