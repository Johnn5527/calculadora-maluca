/**
 * progresso.js — Pontuação, rank (D a S), estrelas, XP, níveis e desbloqueios.
 * IMPORTANTE: nada aqui mexe no resultado matemático; só no "bônus".
 */

export const SKINS = [
  { id: 'classico', nome: 'Teclito Clássico', nivel: 1 },
  { id: 'noturno', nome: 'Teclito Noturno', nivel: 2 },
  { id: 'robo', nome: 'Robô de Bolso', nivel: 3 },
  { id: 'ouro', nome: 'Teclito de Ouro', nivel: 5 },
  { id: 'arcoiris', nome: 'Arco-Íris Maluco', nivel: 7 },
  { id: 'pirata', nome: 'Teclito Pirata', nivel: 1, premio: 'pirata', requisito: '7 dias seguidos' },
  { id: 'lendaria', nome: 'Teclito Lendário', nivel: 1, premio: 'lendaria', requisito: '30 dias seguidos' },
  { id: 'custom', nome: 'Minha Skin (editor 🎨)', nivel: 1, personalizada: true },
];

/** A skin está liberada? (nível, prêmio de sequência ou skin própria) */
export function skinLiberada(s, { nivel, premios = [], temSkinPersonalizada = false }) {
  if (!s) return false;
  if (s.personalizada) return temSkinPersonalizada;
  if (s.premio) return premios.includes(s.premio);
  return s.nivel <= nivel;
}

/** XP extra (baús): soma XP sem contar como partida. */
export function adicionarXp(progresso, xp) {
  const nivelAntes = nivelDoXp(progresso.xp);
  const novo = { ...progresso, xp: progresso.xp + xp };
  const nivelDepois = nivelDoXp(novo.xp);
  return { progresso: novo, subiu: nivelDepois > nivelAntes, nivelDepois };
}

/** A partir deste nível, contas gigantes (4+ operações) viram luta de chefão. */
export const NIVEL_CHEFAO = 5;

export const TEMAS = [
  { id: 'dia', nome: 'Dia', nivel: 1 },
  { id: 'noite', nome: 'Noite', nivel: 1 },
  { id: 'caverna', nome: 'Caverna', nivel: 2 },
  { id: 'castelo', nome: 'Castelo', nivel: 3 },
  { id: 'neon', nome: 'Neon', nivel: 4 },
];

/** Nível a partir do XP: 0→1, 50→2, 200→3, 450→4, 800→5... */
export function nivelDoXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

/** XP necessário para atingir o nível n. */
export function xpDoNivel(n) {
  return 50 * (n - 1) ** 2;
}

/** Fração (0..1) do caminho até o próximo nível. */
export function progressoNoNivel(xp) {
  const n = nivelDoXp(xp);
  const base = xpDoNivel(n);
  const prox = xpDoNivel(n + 1);
  return (xp - base) / (prox - base);
}

/** Sobe quando a fórmula de pontos muda: pontuações de versões diferentes não se comparam. */
export const VERSAO_PONTOS = 2;

/** Jogar mais devagar dá mais tempo para coletar, então vale um pouco menos (e o rápido, mais). */
export const fatorVelocidade = (multTempo = 1) => Math.min(1.2, 1 / Math.sqrt(multTempo));

/**
 * Avalia o desempenho somado das fases. O servidor roda esta mesma função para o ranking,
 * então os pontos só usam números que ele consegue conferir (nunca os pontos internos do minijogo).
 * @param {{comboMax:number, coletados:number, total:number, danos:number, pulou:boolean, auto:boolean, rapido:boolean}} st
 * @param {{semDerrota?:boolean, multTempo?:number}} [o]
 */
export function avaliarDesempenho(st, { semDerrota = false, multTempo = 1 } = {}) {
  const aproveitamento = st.total > 0 ? Math.min(1, st.coletados / st.total) : 1;
  let nota = aproveitamento * 60;
  nota += Math.min(st.comboMax || 0, 8) * 3; // até 24
  nota += Math.max(0, 10 - (st.danos || 0) * 4); // até 10
  if (st.rapido) nota += 8;
  if (st.pulou) nota *= 0.4;
  if (st.auto) nota = Math.min(nota, 65); // auto-play é divertido, mas não vale S
  if (semDerrota) nota = Math.max(nota, 58); // modo infantil: nunca abaixo de B
  nota = Math.round(Math.max(0, Math.min(100, nota)));

  const rank = nota >= 92 ? 'S' : nota >= 78 ? 'A' : nota >= 58 ? 'B' : nota >= 38 ? 'C' : 'D';
  const estrelas = rank === 'S' || rank === 'A' ? 3 : rank === 'B' ? 2 : 1;
  const coletados = Math.max(0, Math.min(st.coletados || 0, st.total || 0));
  const pontos = Math.round((nota * 10 + coletados * 50 + Math.min(st.comboMax || 0, 10) * 20) * fatorVelocidade(multTempo));
  const xp = Math.round((10 + nota) * (st.auto ? 0.5 : 1));
  return { nota, rank, estrelas, pontos, xp };
}

/**
 * Dificuldade adaptativa: quem vai bem recebe um pouco mais de desafio (0 = fácil, 1 = difícil).
 * Sobe e desce com a média das últimas notas, sempre dentro de [min, max] (piso/teto do perfil).
 */
export function dificuldadeAdaptativa(progresso, [min, max] = [0, 0.8]) {
  const notas = progresso.notasRecentes || [];
  const bruta = notas.length ? (notas.reduce((s, n) => s + n, 0) / notas.length - 40) / 50 : 0.3;
  return Math.max(min, Math.min(max, bruta));
}

/**
 * Aplica o resultado da partida ao progresso.
 * @returns {{progresso:object, subiu:boolean, nivelAntes:number, nivelDepois:number, desbloqueios:string[]}}
 */
export function registrarPartida(progresso, avaliacao) {
  const nivelAntes = nivelDoXp(progresso.xp);
  const novo = {
    ...progresso,
    xp: progresso.xp + avaliacao.xp,
    partidas: (progresso.partidas || 0) + 1,
    notasRecentes: [...(progresso.notasRecentes || []), avaliacao.nota].slice(-5),
  };
  const nivelDepois = nivelDoXp(novo.xp);
  const desbloqueios = [];
  if (nivelDepois > nivelAntes) {
    for (const s of SKINS) if (s.nivel > nivelAntes && s.nivel <= nivelDepois) desbloqueios.push(`Skin: ${s.nome}`);
    for (const t of TEMAS) if (t.nivel > nivelAntes && t.nivel <= nivelDepois) desbloqueios.push(`Tema: ${t.nome}`);
    if (NIVEL_CHEFAO > nivelAntes && NIVEL_CHEFAO <= nivelDepois) desbloqueios.push('Chefões em contas gigantes');
  }
  return { progresso: novo, subiu: nivelDepois > nivelAntes, nivelAntes, nivelDepois, desbloqueios };
}
