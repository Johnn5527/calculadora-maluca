/**
 * odometer.js — Resultado em estilo odômetro / caça-níquel:
 * cada dígito gira e trava, um por vez, da esquerda para a direita.
 */
import { prefereMovimentoReduzido, multiplicadorDeTempo } from './shake.js';

/**
 * Monta e anima o odômetro.
 * @param {HTMLElement} el
 * @param {string} texto  texto final (já formatado pelo engine)
 * @param {{aoTravar?: (i:number)=>void, intervaloMs?: number}} opcoes
 * @returns {{promessa: Promise<void>, finalizar: () => void}}
 */
export function rodarOdometro(el, texto, { aoTravar = () => {}, intervaloMs = null } = {}) {
  el.textContent = '';
  el.classList.remove('odo-pronto');
  el.style.setProperty('--len', String(Math.max(3, texto.length)));

  const colunas = [];
  for (const ch of texto) {
    if (/[0-9]/.test(ch)) {
      const col = document.createElement('span');
      col.className = 'odo-col girando';
      const fita = document.createElement('span');
      fita.className = 'odo-fita';
      // 3 voltas de 0-9: a do meio é o alvo, permitindo "passar do ponto" e voltar
      for (let v = 0; v < 3; v++) {
        for (let d = 0; d < 10; d++) {
          const s = document.createElement('span');
          s.textContent = String(d);
          fita.appendChild(s);
        }
      }
      fita.style.setProperty('--alvo', String(10 + Number(ch)));
      fita.style.animationDelay = `${-Math.random() * 0.3}s`;
      col.appendChild(fita);
      el.appendChild(col);
      colunas.push(col);
    } else {
      const sep = document.createElement('span');
      sep.className = 'odo-sep';
      sep.textContent = ch;
      el.appendChild(sep);
      colunas.push(sep);
    }
  }

  const timers = [];
  let resolver;
  const promessa = new Promise((r) => { resolver = r; });
  let terminado = false;

  const travar = (i) => {
    const c = colunas[i];
    if (!c || c.classList.contains('travado')) return;
    c.classList.remove('girando');
    c.classList.add('travado');
    aoTravar(i);
  };

  const finalizar = () => {
    if (terminado) return;
    terminado = true;
    timers.forEach(clearTimeout);
    colunas.forEach((_, i) => {
      const c = colunas[i];
      if (!c.classList.contains('travado')) {
        c.classList.remove('girando');
        c.classList.add('travado', 'sem-animacao');
      }
    });
    el.classList.add('odo-pronto');
    resolver();
  };

  if (prefereMovimentoReduzido()) {
    finalizar();
    return { promessa, finalizar };
  }

  const ritmo = Math.min(1.4, Math.max(0.8, multiplicadorDeTempo()));
  const intervalo = intervaloMs ?? Math.max(110, Math.min(220, 2000 / Math.max(1, colunas.length))) * ritmo;
  const espera = 380; // um tempinho girando antes de começar a travar
  colunas.forEach((_, i) => timers.push(setTimeout(() => travar(i), espera + i * intervalo)));
  timers.push(setTimeout(finalizar, espera + colunas.length * intervalo + 260));

  return { promessa, finalizar };
}
