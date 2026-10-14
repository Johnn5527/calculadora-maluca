/**
 * plausibilidade.js — Confere se os números brutos de uma partida são possíveis.
 * Não prova que o jogador jogou (o minijogo roda no aparelho), mas impede valores
 * absurdos: o máximo que um trapaceiro consegue é a nota de uma partida perfeita.
 */

/** Nenhuma fase termina em menos que isso, nem completando o objetivo na hora. */
export const MIN_MS_POR_FASE = 1500;
/** Folga entre o relógio do servidor e a duração medida no aparelho (rede, abertura em paralelo). */
export const TOLERANCIA_RELOGIO_MS = 3000;
/** "Rápido" só vale se a partida terminou bem antes do tempo previsto. */
const FRACAO_RAPIDO = 0.85;
const MAX_DANOS = 99;

/**
 * @param {object} o
 * @param {{coletados:number,total:number,comboMax:number,danos:number,rapido:boolean,pulou:boolean,auto:boolean}} o.stats
 * @param {number} o.duracaoMs     duração medida no aparelho
 * @param {number} o.decorridoMs   tempo real entre abrir e finalizar (relógio do servidor)
 * @param {number} o.nFases
 * @param {number} o.tetoColeta    soma dos tetos de coleta das fases
 * @param {number} o.duracaoPrevistaMs
 * @returns {{ok:true, stats:object} | {ok:false, motivo:string}}
 */
export function conferirPartida({ stats, duracaoMs, decorridoMs, nFases, tetoColeta, duracaoPrevistaMs }) {
  const { coletados, total, comboMax, danos, pulou } = stats;
  if (total > tetoColeta) return { ok: false, motivo: `total ${total} acima do possível (${tetoColeta})` };
  if (coletados > total) return { ok: false, motivo: `coletou ${coletados} de ${total}` };
  if (comboMax > total) return { ok: false, motivo: `combo ${comboMax} maior que o total ${total}` };
  if (danos > MAX_DANOS) return { ok: false, motivo: `danos demais (${danos})` };
  if (duracaoMs > decorridoMs + TOLERANCIA_RELOGIO_MS) {
    return { ok: false, motivo: `duração ${duracaoMs} ms maior que o tempo real ${decorridoMs} ms` };
  }
  if (!pulou) {
    const minimo = nFases * MIN_MS_POR_FASE;
    if (duracaoMs < minimo || decorridoMs + TOLERANCIA_RELOGIO_MS < minimo) {
      return { ok: false, motivo: `rápida demais: ${duracaoMs} ms para ${nFases} fase(s)` };
    }
  }
  // "rápido" impossível não reprova: só deixa de valer o bônus
  const rapido = stats.rapido && duracaoMs <= duracaoPrevistaMs * FRACAO_RAPIDO;
  return { ok: true, stats: { ...stats, rapido } };
}
