/**
 * perfis.js — Velocidade do jogo e perfis por idade (regras puras, sem DOM).
 * Um perfil só preenche os ajustes de uma vez; depois cada ajuste pode ser mudado à mão.
 */

/** Seletor de velocidade: multiplicador da duração das fases (>1 = mais tempo). */
export const VELOCIDADES = [
  { id: 'bem-lento', nome: 'Bem devagar (×1,8)', mult: 1.8 },
  { id: 'lento', nome: 'Lento (×1,6)', mult: 1.6 },
  { id: 'calmo', nome: 'Calmo (×1,2)', mult: 1.2 },
  { id: 'normal', nome: 'Normal', mult: 1 },
  { id: 'rapido', nome: 'Rápido (×0,7)', mult: 0.7 },
];

export const multDaVelocidade = (id) => VELOCIDADES.find((v) => v.id === id)?.mult ?? 1;

/** No modo lento os inimigos também andam mais devagar. */
export const ritmoInimigos = (mult) => (mult >= 1.6 ? 0.75 : mult >= 1.2 ? 0.9 : 1);

/** Fase relâmpago: 'desligado' ou segundos por fase. */
export const OPCOES_RELAMPAGO = [
  { id: 'desligado', nome: 'Desligado (só a última fase)' },
  { id: '4', nome: '4 s por fase' },
  { id: '5', nome: '5 s por fase' },
  { id: '6', nome: '6 s por fase' },
];

export function configRelampago(id) {
  if (id === 'desligado') return { ligado: false, segundos: null };
  const s = Number(id);
  return { ligado: true, segundos: Number.isFinite(s) && s > 0 ? s : 4 };
}

/** Quais teclas de operação ficam ativas. */
export const CONJUNTOS_TECLAS = [
  { id: 'basicas', nome: 'Só + e −', teclas: ['+', '−'] },
  { id: 'quatro', nome: '+ − × ÷', teclas: ['+', '−', '×', '÷'] },
  { id: 'todas', nome: 'Todas', teclas: ['+', '−', '×', '÷', '^', '√', '%'] },
];
const TODAS_OPS = CONJUNTOS_TECLAS.at(-1).teclas;

/** Teclas de operação que ficam desativadas no conjunto escolhido. */
export function teclasBloqueadas(id) {
  const ativas = CONJUNTOS_TECLAS.find((c) => c.id === id)?.teclas ?? TODAS_OPS;
  return TODAS_OPS.filter((t) => !ativas.includes(t));
}

export const FONTES = [
  { id: 'p', nome: 'P', escala: 0.85 },
  { id: 'm', nome: 'M', escala: 1 },
  { id: 'g', nome: 'G', escala: 1.2 },
  { id: 'gg', nome: 'GG', escala: 1.4 },
];

/** Limites de dificuldade adaptativa quando não há perfil. */
export const DIFICULDADE_PADRAO = [0, 0.8];

export const PERFIS = [
  {
    id: 'infantil',
    emoji: '🧸',
    nome: 'Infantil',
    idade: '4 a 7 anos',
    resumo: 'Bem devagar, só + e −, letras gigantes, botões grandes e sem derrota.',
    dificuldade: [0, 0.3],
    ajustes: {
      velocidade: 'bem-lento', relampago: 'desligado', teclas: 'basicas', fonte: 'gg',
      semDerrota: true, professorAuto: false, semEfeitos: false, botoesGrandes: true,
      chefaoLivre: false, jogosLigados: true, intensidade: 'maluco',
    },
  },
  {
    id: 'crianca',
    emoji: '🎒',
    nome: 'Criança',
    idade: '8 a 12 anos',
    resumo: 'Um pouco mais calmo, + − × ÷, letras grandes e dicas do professor.',
    dificuldade: [0.1, 0.55],
    ajustes: {
      velocidade: 'calmo', relampago: '5', teclas: 'quatro', fonte: 'g',
      semDerrota: false, professorAuto: true, semEfeitos: false, botoesGrandes: false,
      chefaoLivre: false, jogosLigados: true, intensidade: 'maluco',
    },
  },
  {
    id: 'teen',
    emoji: '🎮',
    nome: 'Teen / Adulto',
    idade: '13+ anos',
    resumo: 'Velocidade normal, todas as operações, chefão em qualquer nível, combos e atalhos.',
    dificuldade: [0.2, 0.8],
    ajustes: {
      velocidade: 'normal', relampago: '4', teclas: 'todas', fonte: 'm',
      semDerrota: false, professorAuto: false, semEfeitos: false, botoesGrandes: false,
      chefaoLivre: true, jogosLigados: true, intensidade: 'maluco',
    },
  },
  {
    id: 'senior',
    emoji: '🧓',
    nome: 'Sênior',
    idade: '60+ anos',
    resumo: 'Lento, letras gigantes, botões grandes, modo direto e sem flash nem tremor.',
    dificuldade: [0, 0.4],
    ajustes: {
      velocidade: 'lento', relampago: 'desligado', teclas: 'todas', fonte: 'gg',
      semDerrota: false, professorAuto: false, semEfeitos: true, botoesGrandes: true,
      chefaoLivre: false, jogosLigados: false, intensidade: 'chill',
    },
  },
];

/** Aplica um perfil sobre a configuração atual (mantém nome, tema, skin, som...). */
export function aplicarPerfil(config, id) {
  const p = PERFIS.find((x) => x.id === id);
  if (!p) return config;
  return { ...config, ...p.ajustes, perfil: id };
}

/** Piso e teto da dificuldade adaptativa para o perfil. */
export const limitesDificuldade = (perfil) => PERFIS.find((p) => p.id === perfil)?.dificuldade ?? DIFICULDADE_PADRAO;
