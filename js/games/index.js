/**
 * games/index.js — Registro dos minijogos e sessão que encadeia as fases.
 * Para adicionar um minijogo novo basta registrá-lo em JOGOS (veja o guia no README da entrega).
 */
import { ChuvaDeMoedas } from './chuva-de-moedas.js';
import { PisaPisa } from './pisa-pisa.js';
import { BlocoDuplicador } from './bloco-duplicador.js';
import { CortaBandeira } from './corta-bandeira.js';
import { EstrelaTurbo } from './estrela-turbo.js';
import { CanoSubterraneo } from './cano-subterraneo.js';
import { RoletaDosCogumelos } from './roleta-dos-cogumelos.js';
import { DragaoDevorador } from './dragao-devorador.js';
import { Chefao } from './chefao.js';
import { planejarFases } from '../regras-partida.js';

export { MIN_FASES_RELAMPAGO } from '../regras-partida.js';

/** operação -> classe do minijogo */
export const JOGOS = {
  chefe: Chefao,
  add: ChuvaDeMoedas,
  sub: PisaPisa,
  mul: BlocoDuplicador,
  div: CortaBandeira,
  pow: EstrelaTurbo,
  sqrt: CanoSubterraneo,
  pct: RoletaDosCogumelos,
  divzero: DragaoDevorador,
};

/** Soma as estatísticas de várias fases. */
function juntarStats(total, st) {
  total.pontos += st.pontos || 0;
  total.comboMax = Math.max(total.comboMax, st.comboMax || 0);
  total.coletados += st.coletados || 0;
  total.total += st.total || 0;
  total.danos += st.danos || 0;
  total.pulou = total.pulou || !!st.pulou;
  total.auto = total.auto || !!st.auto;
  total.rapido = total.rapido && !!st.rapido;
  Object.assign(total.extras, st.extras || {});
  return total;
}

export class SessaoDeJogo {
  /**
   * @param {object} o
   * @param {object[]} o.fases  fases vindas do engine ({op,a,b,r})
   * @param {HTMLCanvasElement} o.canvas
   * @param {import('./game-base.js').Entrada} o.entrada
   * @param {object} o.opcoes  {dificuldade, auto, tema, skin, sfx, reduzido,
   *   multTempo (1 = normal, >1 = mais devagar), ritmoInimigos,
   *   relampago: {ligado:boolean, segundos:number}}
   * @param {(info:{indice:number,total:number,titulo:string,dica:string,fase:object})=>void} [o.aoMudarFase]
   * @param {(hud:object)=>void} [o.aoHud]
   */
  constructor(o) {
    const { multTempo = 1, relampago = { ligado: true, segundos: null }, ...opcoes } = o.opcoes;
    this.plano = planejarFases(o.fases, { multTempo, relampago }).filter((p) => JOGOS[p.fase.op]);
    this.canvas = o.canvas;
    this.entrada = o.entrada;
    this.opcoes = opcoes;
    this.aoMudarFase = o.aoMudarFase || (() => {});
    this.aoHud = o.aoHud || (() => {});
    this.atual = null;
    this.pulado = false;
    this.auto = !!o.opcoes.auto;
  }

  async rodar() {
    const total = { pontos: 0, comboMax: 0, coletados: 0, total: 0, danos: 0, pulou: false, auto: this.auto, rapido: true, extras: {} };
    const n = this.plano.length;

    for (let i = 0; i < n; i++) {
      if (this.pulado) break;
      const { fase, relampago, duracao } = this.plano[i];
      const Classe = JOGOS[fase.op];
      this.aoMudarFase({ indice: i, total: n, titulo: Classe.titulo, dica: Classe.dica, fase });
      this.entrada.limpar();
      // opções do usuário primeiro; os valores calculados por fase vêm depois e não podem ser sobrescritos
      this.atual = new Classe({
        ...this.opcoes,
        canvas: this.canvas,
        entrada: this.entrada,
        fase,
        relampago,
        duracao,
        auto: this.auto,
        aoHud: (h) => this.aoHud({ ...h, indice: i, total: n, fase }),
      });
      try {
        juntarStats(total, await this.atual.iniciar());
      } catch (e) {
        console.error('[sessão] fase falhou, seguindo em frente', e);
      } finally {
        this.atual.destruir();
        this.atual = null;
      }
    }
    if (this.pulado) total.pulou = true;
    return total;
  }

  /** Botão PULAR: encerra a fase atual e todas as seguintes. */
  pular() {
    this.pulado = true;
    this.atual?.pular();
  }

  definirAuto(ligado) {
    this.auto = !!ligado;
    if (this.atual) {
      this.atual.auto = this.auto;
      if (this.auto) this.atual.stats.auto = true;
    }
  }

  destruir() {
    this.pular();
  }
}
