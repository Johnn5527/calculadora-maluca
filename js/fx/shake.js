/**
 * shake.js — Tremor de tela, flash e utilidades de tempo.
 * Respeita prefers-reduced-motion: nada treme e nada pisca.
 */

const consultaReduzido = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

let semEfeitos = false;
let multiplicadorTempo = 1;

/** Movimento reduzido do sistema OU opção "sem flash nem tremor" dos ajustes. */
export const prefereMovimentoReduzido = () => semEfeitos || !!consultaReduzido?.matches;

/** Liga/desliga o modo calmo escolhido nos ajustes (independe do sistema). */
export function configurarSemEfeitos(ligado) {
  semEfeitos = !!ligado;
}

/** Multiplicador de tempo global (seletor de velocidade): >1 = mais devagar. */
export function configurarMultiplicadorTempo(m) {
  multiplicadorTempo = Number.isFinite(m) && m > 0 ? m : 1;
}

export const multiplicadorDeTempo = () => multiplicadorTempo;

/** Promessa que resolve após ms milissegundos. */
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const ativos = new WeakMap();

/** Cancela um tremor em andamento no elemento. */
export function pararTremor(el) {
  const at = ativos.get(el);
  if (!at) return;
  cancelAnimationFrame(at.raf);
  el.style.translate = '';
  el.style.rotate = '';
  ativos.delete(el);
  at.resolver();
}

/**
 * Faz o elemento tremer (usa as propriedades CSS individuais translate/rotate
 * para não brigar com animações de transform).
 */
export function tremer(el, { forca = 8, duracao = 450, girar = false } = {}) {
  if (!el || prefereMovimentoReduzido() || forca <= 0) return Promise.resolve();
  pararTremor(el);
  return new Promise((resolver) => {
    const inicio = performance.now();
    const passo = (agora) => {
      const p = (agora - inicio) / duracao;
      if (p >= 1) {
        el.style.translate = '';
        el.style.rotate = '';
        ativos.delete(el);
        resolver();
        return;
      }
      const f = forca * (1 - p) * (1 - p);
      el.style.translate = `${(Math.random() * 2 - 1) * f}px ${(Math.random() * 2 - 1) * f}px`;
      if (girar) el.style.rotate = `${(Math.random() * 2 - 1) * f * 0.4}deg`;
      ativos.set(el, { raf: requestAnimationFrame(passo), resolver });
    };
    ativos.set(el, { raf: requestAnimationFrame(passo), resolver });
  });
}

let vibracaoLigada = true;

/** Liga/desliga a vibração (configuração do usuário). */
export function configurarVibracao(ligada) {
  vibracaoLigada = !!ligada;
}

/** Vibra o celular (se suportado, ligado e sem preferência por movimento reduzido). */
export function vibrar(padrao) {
  if (!vibracaoLigada || prefereMovimentoReduzido()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(padrao);
  } catch {
    /* alguns navegadores bloqueiam sem gesto do usuário */
  }
}

/** Flash de tela cheia. */
export function flash(cor = '#ffffff', duracao = 180) {
  if (prefereMovimentoReduzido()) return;
  const div = document.createElement('div');
  div.className = 'fx-flash';
  div.style.background = cor;
  document.body.appendChild(div);
  const anim = div.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: duracao, easing: 'ease-out' });
  anim.onfinish = () => div.remove();
  anim.oncancel = () => div.remove();
}
