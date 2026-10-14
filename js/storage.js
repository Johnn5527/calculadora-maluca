/**
 * storage.js — Persistência local (localStorage). Tudo funciona offline;
 * a conversa com o servidor fica em api.js.
 */

import { DIARIO_PADRAO } from './diario.js';
import { CONQUISTAS_PADRAO } from './conquistas.js';
import { validarSkin } from './skin-codigo.js';
import { MISSOES_PADRAO } from './missoes.js';
import { VERSAO_PONTOS } from './progresso.js';
import { API_URL } from './ambiente.js';

const CHAVES = {
  historico: 'cm:historico',
  config: 'cm:config',
  progresso: 'cm:progresso',
  ranking: 'cm:ranking',
  diario: 'cm:diario',
  conquistas: 'cm:conquistas',
  skin: 'cm:skin',
  missoes: 'cm:missoes',
  jogador: 'cm:jogador',
};

export const LIMITE_HISTORICO = 20;
export const LIMITE_RANKING = 10;

export const CONFIG_PADRAO = {
  nome: 'JOGADOR',
  intensidade: 'maluco', // 'chill' | 'maluco' | 'caos'
  tema: 'dia',
  skin: 'classico',
  volume: 0.6,
  mudo: false,
  autoPlay: false,
  jogosLigados: true,
  vibracao: true,
  // v3: perfil por idade, ritmo e acessibilidade
  perfil: null, // null = ainda não escolheu (mostra a tela de boas-vindas)
  velocidade: 'normal',
  relampago: '4',
  teclas: 'todas',
  fonte: 'm',
  contraste: false,
  semDerrota: false,
  professorAuto: false,
  semEfeitos: false,
  botoesGrandes: false,
  chefaoLivre: false,
  backendAtivo: false,
  backendUrl: API_URL,
  // autorização do responsável para o ranking online (perfis até 12 anos): {em, versao} ou null
  consentimento: null,
};

const ehLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

export const PROGRESSO_PADRAO = {
  xp: 0,
  partidas: 0,
  notasRecentes: [],
};

function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return structuredClone(padrao);
    const dados = JSON.parse(bruto);
    if (Array.isArray(padrao)) return Array.isArray(dados) ? dados : structuredClone(padrao);
    return { ...structuredClone(padrao), ...dados };
  } catch {
    return structuredClone(padrao);
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (e) {
    console.warn('[storage] não foi possível salvar', chave, e);
    return false;
  }
}

/* ---------------- Configurações ---------------- */
export function carregarConfig() {
  const cfg = ler(CHAVES.config, CONFIG_PADRAO);
  // endereço local guardado (servidor Java antigo ou dev) não vale no site publicado
  if (cfg.backendUrl === 'http://localhost:8080' || (ehLocal(cfg.backendUrl) && !ehLocal(API_URL))) {
    cfg.backendUrl = API_URL;
  }
  return cfg;
}
export const salvarConfig = (cfg) => gravar(CHAVES.config, cfg);

/* ---------------- Progresso (XP, níveis, dificuldade adaptativa) ---------------- */
export const carregarProgresso = () => ler(CHAVES.progresso, PROGRESSO_PADRAO);
export const salvarProgresso = (p) => gravar(CHAVES.progresso, p);

/* ---------------- Histórico ---------------- */
export const carregarHistorico = () => ler(CHAVES.historico, []);

/** Adiciona uma conta ao topo do histórico (máx. 20). */
export function adicionarHistorico(item) {
  const lista = carregarHistorico();
  lista.unshift({ id: Date.now() + Math.random(), data: new Date().toISOString(), ...item });
  const cortada = lista.slice(0, LIMITE_HISTORICO);
  gravar(CHAVES.historico, cortada);
  return cortada;
}

export function removerHistorico(id) {
  const lista = carregarHistorico().filter((h) => h.id !== id);
  gravar(CHAVES.historico, lista);
  return lista;
}

export function limparHistorico() {
  gravar(CHAVES.historico, []);
  return [];
}

/* ---------------- Ranking local ---------------- */
const daVersaoAtual = (r) => r.versao === VERSAO_PONTOS;

/** Top 10 com a fórmula de pontos atual. */
export const carregarRanking = () => ler(CHAVES.ranking, []).filter(daVersaoAtual);

/** Pontuações de fórmulas antigas: ficam guardadas, mas fora da disputa. */
export const carregarRankingAntigo = () => ler(CHAVES.ranking, []).filter((r) => !daVersaoAtual(r));

export function adicionarRanking(item) {
  const lista = carregarRanking();
  lista.push({ data: new Date().toISOString(), ...item, versao: VERSAO_PONTOS });
  lista.sort((a, b) => b.pontos - a.pontos);
  const cortada = lista.slice(0, LIMITE_RANKING);
  gravar(CHAVES.ranking, [...cortada, ...carregarRankingAntigo()]);
  return cortada;
}

/* ---------------- Desafio diário ---------------- */
export const carregarDiario = () => ler(CHAVES.diario, DIARIO_PADRAO);
export const salvarDiario = (d) => gravar(CHAVES.diario, d);

/* ---------------- Conquistas ---------------- */
export const carregarConquistas = () => ler(CHAVES.conquistas, CONQUISTAS_PADRAO);
export const salvarConquistas = (c) => gravar(CHAVES.conquistas, c);

/* ---------------- Missões diárias e sequência ---------------- */
export const carregarMissoes = () => ler(CHAVES.missoes, MISSOES_PADRAO);
export const salvarMissoes = (m) => gravar(CHAVES.missoes, m);

/* ---------------- Skin personalizada ---------------- */
export function carregarSkinPersonalizada() {
  try {
    const skin = JSON.parse(localStorage.getItem(CHAVES.skin) || 'null');
    return validarSkin(skin) ? skin : null;
  } catch {
    return null;
  }
}
export const salvarSkinPersonalizada = (skin) => gravar(CHAVES.skin, skin);

/* ---------------- Jogador anônimo do servidor ({id, apelido, tag, token}) ---------------- */
export function carregarJogador() {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVES.jogador) || 'null');
    return j?.token && j?.servidor ? j : null;
  } catch {
    return null;
  }
}
export const salvarJogador = (j) => gravar(CHAVES.jogador, j);
export const esquecerJogador = () => localStorage.removeItem(CHAVES.jogador);