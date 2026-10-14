/**
 * estrela-turbo.js — Minijogo da POTÊNCIA (^).
 * Pegue a Estrela Turbo que quica pela tela: o Teclito vira GIGANTE, esmaga os tijolos
 * e o contador explode exponencialmente de A até A^B.
 */
import { GameBase, SPRITES, CHAO, LARGURA, colide, limitar } from './game-base.js';

const ESCALA_GIGANTE = 2.5;

export class EstrelaTurbo extends GameBase {
  static titulo = 'ESTRELA TURBO';
  static dica = 'Pegue a estrela e vire GIGANTE!';

  criar() {
    this.sprEstrela = SPRITES.estrela();
    this.estrela = { x: 220, y: 60, w: 10, h: 10, vx: -(70 + this.dificuldade * 40) * this.ritmo, vy: 0, pega: false };
    this.gigante = false;
    this.tGigante = 0;
    const n = this.relampago ? 3 : 5;
    this.tijolos = [];
    for (let i = 0; i < n; i++) {
      this.tijolos.push({ x: 50 + i * (240 / n) + 10, y: CHAO - 16, w: 16, h: 16, quebrado: false });
    }
    this.heroi.x = 30;
    this.stats.total = 1 + n;
  }

  atualizar(dt) {
    const h = this.heroi;
    this.moverHeroi(dt);

    if (!this.estrela.pega) {
      const e = this.estrela;
      const ajuda = this.t > this.duracao * 0.45;
      if (ajuda) {
        // a estrela fica com dó e vem até você
        const dx = h.x + h.w / 2 - (e.x + 5);
        const dy = h.y - (e.y + 5);
        e.vx += Math.sign(dx) * 120 * dt;
        e.vy += Math.sign(dy) * 60 * dt;
        e.vx = limitar(e.vx, -90, 90);
      }
      e.vy += 520 * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.y > CHAO - 10) { e.y = CHAO - 10; e.vy = -(ajuda ? 200 : 280); }
      if (e.x < 2 || e.x > LARGURA - 12) { e.vx *= -1; e.x = limitar(e.x, 2, LARGURA - 12); }
      if (colide(h, e)) this.pegarEstrela(true);
    } else {
      // crescimento suave mantendo os pés no chão
      const alvo = ESCALA_GIGANTE;
      const pe = h.y + h.h;
      h.escala = Math.min(alvo, h.escala + dt * 4);
      h.w = 10 * h.escala;
      h.h = 14 * h.escala;
      h.y = pe - h.h;
      h.velMax = 170;

      const tg = this.t - this.tGigante;
      const a = this.fase.a;
      const r = this.fase.r;
      const p = limitar(tg / 1.4, 0, 1);
      // explosão exponencial do contador (quando possível), senão linear
      if (a > 0 && r > 0) this.contador = a * Math.pow(r / a, p * p);
      else this.progressoContador(p);

      if (!this.reduzido && Math.random() < 0.5) {
        this.particulas.emitir(h.x + Math.random() * h.w, h.y + Math.random() * h.h, { n: 1, cores: ['#fff04a', '#ff5df2', '#38e8ff'], vel: 30, grav: -40, vida: 0.4 });
      }

      for (const tj of this.tijolos) {
        if (!tj.quebrado && colide(h, tj)) {
          tj.quebrado = true;
          this.acerto(tj.x + 8, tj.y, 100, ['#c76b2f', '#9a4f1f', '#fff04a']);
          this.sfx('explosao');
          this.tremer(5);
          this.particulas.emitir(tj.x + 8, tj.y + 8, { n: this.reduzido ? 4 : 14, cores: ['#c76b2f', '#9a4f1f'], vel: 150, cima: 80, tam: 3 });
        }
      }
      const todos = this.tijolos.every((t) => t.quebrado);
      if (!this.finalizando && (tg > 2.6 || (todos && tg > 1.5))) this.terminar('POTÊNCIA MÁXIMA!');
    }
  }

  pegarEstrela(peloJogador) {
    if (this.estrela.pega) return;
    this.estrela.pega = true;
    this.gigante = true;
    this.tGigante = this.t;
    if (peloJogador) this.acerto(this.estrela.x, this.estrela.y, 200, ['#fff04a', '#ffffff']);
    this.sfx('estrela');
    this.flash = this.reduzido ? 0 : 0.8;
    this.hitStop = this.reduzido ? 0 : 0.1;
    this.tremer(6);
  }

  forcarFim() {
    if (!this.estrela.pega) this.pegarEstrela(false);
    else if (!this.finalizando && this.t - this.tGigante > 1.5) this.terminar('POTÊNCIA MÁXIMA!');
  }

  ia() {
    const h = this.heroi;
    if (!this.estrela.pega) {
      const e = this.estrela;
      const dx = e.x + 5 - (h.x + h.w / 2);
      return { esq: dx < -4, dir: dx > 4, pulo: (Math.abs(dx) < 24 && e.y < h.y && h.noChao) || (!h.noChao && h.vy < 0) };
    }
    const alvo = this.tijolos.find((t) => !t.quebrado);
    if (!alvo) return { esq: false, dir: false, pulo: false };
    const dx = alvo.x + 8 - (h.x + h.w / 2);
    return { esq: dx < 0, dir: dx >= 0, pulo: false };
  }

  desenharMundo(g) {
    for (const tj of this.tijolos) {
      if (tj.quebrado) continue;
      g.fillStyle = '#1a1028';
      g.fillRect(tj.x, tj.y, 16, 16);
      g.fillStyle = '#c76b2f';
      g.fillRect(tj.x + 1, tj.y + 1, 14, 14);
      g.fillStyle = '#9a4f1f';
      g.fillRect(tj.x + 1, tj.y + 7, 14, 1);
      g.fillRect(tj.x + 7, tj.y + 1, 1, 6);
      g.fillRect(tj.x + 4, tj.y + 8, 1, 7);
      g.fillRect(tj.x + 11, tj.y + 8, 1, 7);
    }
    if (!this.estrela.pega) {
      const e = this.estrela;
      const brilho = Math.floor(this.t * 10) % 2;
      if (brilho) {
        g.fillStyle = 'rgba(255,240,74,0.35)';
        g.fillRect(Math.round(e.x) - 2, Math.round(e.y) - 2, 14, 14);
      }
      g.drawImage(this.sprEstrela, Math.round(e.x), Math.round(e.y));
    }
    if (this.gigante && !this.reduzido) {
      // aura arco-íris piscando
      const cores = ['#ff3b5c', '#fff04a', '#38e8ff', '#ff5df2'];
      const h = this.heroi;
      g.fillStyle = cores[Math.floor(this.t * 12) % cores.length];
      g.globalAlpha = 0.25;
      g.fillRect(Math.round(h.x) - 3, Math.round(h.y) - 3, Math.round(h.w) + 6, Math.round(h.h) + 6);
      g.globalAlpha = 1;
    }
    this.desenharHeroi(g);
  }
}
