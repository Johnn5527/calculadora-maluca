/**
 * chuva-de-moedas.js — Minijogo da SOMA (+).
 * Moedas caem do céu; algumas ficam flutuando (precisa pular). Cada moeda é uma "parcela"
 * e faz o contador andar de A até A+B. Depois de um tempo, as moedas viram ímã (nunca frustra).
 */
import { GameBase, SPRITES, CHAO, LARGURA, aleatorio, colide, limitar } from './game-base.js';

export class ChuvaDeMoedas extends GameBase {
  static titulo = 'CHUVA DE MOEDAS';
  static dica = 'Pegue as moedas! ◀ ▶ + A';

  criar() {
    const n = this.relampago ? 5 : Math.round(7 + this.dificuldade * 3); // 7 a 10 moedas
    this.sprMoeda = SPRITES.moeda();
    this.moedas = [];
    for (let i = 0; i < n; i++) {
      const noAr = i % 3 === 1;
      this.moedas.push({
        x: Math.round(limitar(70 + (i * 233) % 240 + aleatorio(-10, 10), 12, LARGURA - 20)),
        y: -12 - i * 6,
        w: 8, h: 8,
        vy: 0,
        alvoY: noAr ? aleatorio(88, 112) : CHAO - 8,
        nasce: (i / n) * (this.relampago ? 0.6 : 1.4),
        pousou: false,
        pega: false,
        ima: false,
      });
    }
    this.stats.total = n;
  }

  atualizar(dt) {
    this.moverHeroi(dt);
    const h = this.heroi;
    const coletadas = this.moedas.filter((m) => m.pega).length;
    const imaGeral = this.t > this.duracao * (0.55 + this.dificuldade * 0.15);

    for (const m of this.moedas) {
      if (m.pega || this.t < m.nasce) continue;

      if (m.ima || (imaGeral && !this.finalizando)) {
        // ímã: a moeda voa até o herói
        m.ima = true;
        const dx = h.x + h.w / 2 - (m.x + 4);
        const dy = h.y + h.h / 2 - (m.y + 4);
        const d = Math.hypot(dx, dy) || 1;
        m.x += (dx / d) * 220 * dt;
        m.y += (dy / d) * 220 * dt;
      } else if (!m.pousou) {
        m.vy = Math.min(260, m.vy + 500 * dt);
        m.y += m.vy * dt;
        if (m.y >= m.alvoY) {
          m.y = m.alvoY;
          m.pousou = true;
        }
      }

      if (colide(h, m)) {
        m.pega = true;
        if (!m.ima) {
          this.acerto(m.x + 4, m.y, 100);
        } else {
          // moeda que veio pelo ímã vale meia coleta
          this.acerto(m.x + 4, m.y, 50);
          this.stats.coletados -= 0.5;
        }
        this.sfx('moeda');
        const total = this.moedas.filter((x) => x.pega).length;
        this.progressoContador(total / this.moedas.length);
      }
    }

    if (!this.finalizando && coletadas === this.moedas.length) this.terminar('SOMA FEITA!');
  }

  forcarFim() {
    for (const m of this.moedas) m.ima = true;
    // dá mais um respiro para as moedas chegarem; se não der, termina mesmo assim
    if (this.t > this.duracao + 0.8) this.terminar('SOMA FEITA!');
  }

  ia() {
    const h = this.heroi;
    const alvo = this.moedas
      .filter((m) => !m.pega && this.t >= m.nasce && m.y > 40)
      .sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x))[0];
    if (!alvo) return { esq: false, dir: false, pulo: false };
    const dx = alvo.x + 4 - (h.x + h.w / 2);
    const acima = alvo.y < h.y - 6 && alvo.pousou;
    return {
      esq: dx < -3,
      dir: dx > 3,
      pulo: (acima && Math.abs(dx) < 20 && h.noChao) || (!h.noChao && h.vy < 0),
    };
  }

  desenharMundo(g) {
    for (const m of this.moedas) {
      if (m.pega || this.t < m.nasce) continue;
      // moeda "girando": escala horizontal oscila
      const giro = Math.abs(Math.cos(this.t * 6 + m.x));
      const w = Math.max(2, Math.round(8 * giro));
      const bob = m.pousou && m.alvoY < CHAO - 8 ? Math.round(Math.sin(this.t * 5 + m.x) * 2) : 0;
      g.drawImage(this.sprMoeda, Math.round(m.x + (8 - w) / 2), Math.round(m.y + bob), w, 8);
    }
    this.desenharHeroi(g);
  }
}
