/**
 * conquistas.js — Conquistas desbloqueáveis (regras puras, sem DOM).
 */

export const CONQUISTAS = [
  { id: 'primeira', icone: '🎈', nome: 'Primeira Conta', desc: 'Termine sua primeira conta maluca.' },
  { id: 'rank_s', icone: '🏆', nome: 'Perfeição', desc: 'Tire rank S.' },
  { id: 'combo5', icone: '🔥', nome: 'Combo Maluco', desc: 'Faça um combo de 5 ou mais.' },
  { id: 'devorado1', icone: '🐉', nome: 'Lanche do Dragão', desc: 'Divida por zero.' },
  { id: 'devorado10', icone: '🍖', nome: 'Dragão Gordo', desc: 'Divida por zero 10 vezes.', meta: 10, contador: 'divzero' },
  { id: 'jackpot', icone: '🎰', nome: 'Sortudo', desc: 'Tire uma trinca na Roleta dos Cogumelos.' },
  { id: 'milionario', icone: '💰', nome: 'Milionário', desc: 'Chegue a um resultado de 1 milhão ou mais.' },
  { id: 'resposta', icone: '🌌', nome: 'A Resposta', desc: 'Chegue ao resultado 42.' },
  { id: 'explorador', icone: '🗺️', nome: 'Explorador', desc: 'Jogue os 8 minijogos.', meta: 8, contador: 'ops' },
  { id: 'chefao', icone: '👑', nome: 'Derrubou o Rei', desc: 'Derrote o Rei Ábaco com seus próprios pulos.' },
  { id: 'diario', icone: '📅', nome: 'Pontual', desc: 'Complete um desafio diário.' },
  { id: 'sequencia3', icone: '📆', nome: 'Fiel', desc: 'Jogue o desafio diário 3 dias seguidos.', meta: 3, contador: 'sequencia' },
  { id: 'nivel5', icone: '⭐', nome: 'Veterano', desc: 'Alcance o nível 5.' },
  { id: 'pintor', icone: '🎨', nome: 'Pintor de Pixels', desc: 'Salve uma skin criada por você.' },
  { id: 'professor', icone: '📖', nome: 'Aluno Aplicado', desc: 'Abra o passo a passo de uma conta.' },
  { id: 'apressado', icone: '⏩', nome: 'Apressadinho', desc: 'Pule 10 minijogos.', meta: 10, contador: 'pulos' },
  { id: 'robo', icone: '🤖', nome: 'Robô Preguiçoso', desc: 'Use o auto-play 5 vezes.', meta: 5, contador: 'autos' },
];

export const CONQUISTAS_PADRAO = {
  desbloqueadas: {},
  contadores: { divzero: 0, pulos: 0, autos: 0, sequencia: 0 },
  opsJogadas: [],
};

const TODAS_OPS = ['add', 'sub', 'mul', 'div', 'pow', 'sqrt', 'pct', 'divzero'];

/** Progresso numérico de uma conquista com meta (para a barra na lista). */
export function progressoConquista(estado, c) {
  if (!c.meta) return null;
  const valor = c.contador === 'ops'
    ? estado.opsJogadas.filter((o) => TODAS_OPS.includes(o)).length
    : estado.contadores[c.contador] || 0;
  return { valor: Math.min(valor, c.meta), meta: c.meta };
}

/**
 * Processa um evento e devolve o novo estado + as conquistas recém-desbloqueadas.
 * Eventos:
 *   {tipo:'partida', avaliacao, stats, valor, divzero, ops, nivel, diario, sequencia}
 *   {tipo:'pintor'} | {tipo:'professor'}
 */
export function processarEvento(estadoAtual, ev) {
  const estado = {
    desbloqueadas: { ...estadoAtual.desbloqueadas },
    contadores: { ...CONQUISTAS_PADRAO.contadores, ...estadoAtual.contadores },
    opsJogadas: [...(estadoAtual.opsJogadas || [])],
  };
  const ganhar = new Set();

  if (ev.tipo === 'pintor') ganhar.add('pintor');
  if (ev.tipo === 'professor') ganhar.add('professor');

  if (ev.tipo === 'partida') {
    const st = ev.stats || {};
    ganhar.add('primeira');
    if (ev.avaliacao?.rank === 'S') ganhar.add('rank_s');
    if ((st.comboMax || 0) >= 5) ganhar.add('combo5');
    if (st.extras?.jackpot) ganhar.add('jackpot');
    if (st.extras?.chefao && !st.pulou && !st.auto) ganhar.add('chefao');
    if (st.pulou) estado.contadores.pulos++;
    if (st.auto) estado.contadores.autos++;
    if (ev.divzero) {
      estado.contadores.divzero++;
      ganhar.add('devorado1');
    }
    if (Number.isFinite(ev.valor) && Math.abs(ev.valor) >= 1e6) ganhar.add('milionario');
    if (ev.valor === 42) ganhar.add('resposta');
    if ((ev.nivel || 0) >= 5) ganhar.add('nivel5');
    if (ev.diario) {
      ganhar.add('diario');
      estado.contadores.sequencia = Math.max(estado.contadores.sequencia, ev.sequencia || 0);
    }
    for (const op of ev.ops || []) if (!estado.opsJogadas.includes(op)) estado.opsJogadas.push(op);
  }

  // conquistas com meta numérica
  for (const c of CONQUISTAS) {
    const p = progressoConquista(estado, c);
    if (p && p.valor >= p.meta) ganhar.add(c.id);
  }

  const novas = [];
  for (const id of ganhar) {
    if (estado.desbloqueadas[id]) continue;
    estado.desbloqueadas[id] = new Date().toISOString();
    novas.push(CONQUISTAS.find((c) => c.id === id));
  }
  return { estado, novas: novas.filter(Boolean) };
}
