/**
 * roleta-dos-cogumelos.js — Minijogo da PORCENTAGEM (%).
 * Uma slot machine de três rolos em pixel art. Embaixo de cada rolo há um botão-bloco:
 * dê cabeçadas na ordem (1, 2, 3) para parar os rolos. Trinca = JACKPOT de pontos.
 * A sorte é "generosa" com quem está indo mal (nunca frustra). O resultado é sempre o do motor.
 */
import { GameBase, SPRITES, CHAO, texto } from './game-base.js';

const MX = 82;
const MY = 14;
const MW = 156;
const MH = 76;
const RW = 36;
const RH = 40;

export class RoletaDosCogumelos extends GameBase {
  static titulo = 'ROLETA DOS COGUMELOS';
  static dica = 'Cabeçada nos botões 1, 2, 3!';

  criar() {
    this.simbolos = [SPRITES.cogumelo(), SPRITES.moeda(), SPRITES.estrela(), SPRITES.gema(), SPRITES.sete(), SPRITES.porcento()];
    this.rolos = [0, 1, 2].map((i) => ({
      x: MX + 12 + i * (RW + 10),
      pos: Math.random() * this.simbolos.length,
      vel: 9 + i * 2,
      parado: false,
      parando: false,
      alvo: 0,
    }));
    this.botoes = this.rolos.map((r, i) => ({ x: r.x + RW / 2 - 9, y: CHAO - 54, w: 18, h: 12, i, bump: 0 }));
    this.solidos = this.botoes;
    this.proximo = 0;
    this.heroi.x = 30;
    this.tick = 0;
    this.resultado = null;
    this.fimEm = null;
    this.stats.total = 3;
  }

  atualizar(dt) {
    this.moverHeroi(dt, {
      aoBaterCabeca: (s) => {
        if (s.i === this.proximo) this.pararRolo(true);
        else {
          s.bump = 0.6;
          this.flutuar(`BOTÃO ${this.proximo + 1}!`, s.x + 9, s.y - 8, '#ff9a9a');
          this.sfx('ops');
        }
      },
    });
    for (const b of this.botoes) b.bump = Math.max(0, b.bump - dt * 5);

    let girando = false;
    for (const r of this.rolos) {
      if (r.parado) continue;
      if (r.parando) {
        // desacelera até travar exatamente no símbolo alvo
        const n = this.simbolos.length;
        const dist = (r.alvo - r.pos + n * 10) % n;
        const passo = Math.max(2.5, dist * 6) * dt;
        if (dist <= passo || dist > n - 0.01) {
          r.pos = r.alvo;
          r.parado = true;
          this.sfx('travar');
          this.tremer(2);
        } else {
          r.pos = (r.pos + passo) % n;
        }
      } else {
        r.pos = (r.pos + r.vel * dt) % this.simbolos.length;
        girando = true;
      }
    }
    this.tick += dt;
    if (girando && this.tick > 0.07) {
      this.tick = 0;
      this.sfx('roleta');
    }

    if (!this.resultado && this.rolos.every((r) => r.parado)) this.avaliar();
    if (this.fimEm !== null && this.t >= this.fimEm && !this.finalizando) this.terminar(this.resultado);
  }

  /** Para o próximo rolo, escolhendo o símbolo com uma pitada de sorte adaptativa. */
  pararRolo(peloJogador) {
    if (this.proximo > 2) return;
    const r = this.rolos[this.proximo];
    const b = this.botoes[this.proximo];
    b.bump = 1;
    let alvo = Math.round(r.pos + 1) % this.simbolos.length;
    if (this.proximo > 0) {
      const anterior = this.rolos[this.proximo - 1].alvo;
      const sorte = 0.35 + (1 - this.dificuldade) * 0.35;
      if (Math.random() < sorte) alvo = anterior;
    }
    r.alvo = alvo;
    r.parando = true;
    this.proximo++;
    this.progressoContador(this.proximo / 3);
    if (peloJogador) this.acerto(b.x + 9, b.y - 6, 80, ['#ffb000', '#fff']);
    this.sfx('bloco');
  }

  avaliar() {
    const [a, b, c] = this.rolos.map((r) => r.alvo);
    if (a === b && b === c) {
      this.resultado = 'JACKPOT!!!';
      this.stats.pontos += 500;
      this.stats.extras.jackpot = true;
      this.sfx('jackpot');
      this.flash = this.reduzido ? 0 : 0.7;
      this.particulas.emitir(MX + MW / 2, MY + MH / 2, { n: this.reduzido ? 10 : 50, cores: ['#ffd43b', '#fff04a', '#ff5df2'], vel: 170, cima: 60 });
    } else if (a === b || b === c || a === c) {
      this.resultado = 'PAR! BOA!';
      this.stats.pontos += 150;
    } else {
      this.resultado = 'QUASE!';
      this.stats.pontos += 30;
    }
    this.fimEm = this.t + 0.9;
  }

  forcarFim() {
    if (this.proximo <= 2) {
      const anterior = this.rolos[this.proximo - 1];
      if (!anterior || anterior.parado) this.pararRolo(false);
    } else if (!this.finalizando && this.resultado && this.t > (this.fimEm ?? 0)) {
      this.terminar(this.resultado);
    }
  }

  ia() {
    const h = this.heroi;
    if (this.proximo > 2) return { esq: false, dir: false, pulo: false };
    const b = this.botoes[this.proximo];
    const dx = b.x + 9 - (h.x + h.w / 2);
    return { esq: dx < -3, dir: dx > 3, pulo: (Math.abs(dx) < 6 && h.noChao) || (!h.noChao && h.vy < 0) };
  }

  desenharMundo(g) {
    // gabinete
    g.fillStyle = '#1a1028';
    g.fillRect(MX - 2, MY - 2, MW + 4, MH + 4);
    g.fillStyle = '#c2185b';
    g.fillRect(MX, MY, MW, MH);
    g.fillStyle = '#ff5d8f';
    g.fillRect(MX, MY, MW, 3);
    texto(g, '% ROLETA %', MX + MW / 2, MY + 10, { tam: 6, cor: '#fff04a' });
    // luzinhas
    for (let i = 0; i < 12; i++) {
      g.fillStyle = (i + Math.floor(this.t * 8)) % 2 ? '#fff04a' : '#ff9a00';
      g.fillRect(MX + 6 + i * 12.5, MY + MH - 6, 4, 3);
    }

    // rolos
    for (const r of this.rolos) {
      const ry = MY + 20;
      g.fillStyle = '#1a1028';
      g.fillRect(r.x - 1, ry - 1, RW + 2, RH + 2);
      g.fillStyle = '#f4f0e0';
      g.fillRect(r.x, ry, RW, RH);
      g.save();
      g.beginPath();
      g.rect(r.x, ry, RW, RH);
      g.clip();
      const n = this.simbolos.length;
      const frac = r.pos - Math.floor(r.pos);
      for (let k = -1; k <= 1; k++) {
        const idx = (((Math.floor(r.pos) + k) % n) + n) % n;
        const spr = this.simbolos[idx];
        const y = ry + RH / 2 - (frac - k) * 22 - spr.height;
        g.drawImage(spr, Math.round(r.x + RW / 2 - spr.width), Math.round(y), spr.width * 2, spr.height * 2);
      }
      g.restore();
      if (r.parado) {
        g.strokeStyle = '#fff04a';
        g.lineWidth = 1;
        g.strokeRect(r.x - 0.5, ry - 0.5, RW + 1, RH + 1);
      }
    }

    // botões-bloco
    for (const b of this.botoes) {
      const y = Math.round(b.y - Math.sin(b.bump * Math.PI) * 4);
      const ativo = b.i === this.proximo;
      g.fillStyle = '#1a1028';
      g.fillRect(b.x, y, b.w, b.h);
      g.fillStyle = b.i < this.proximo ? '#555' : ativo && Math.floor(this.t * 4) % 2 ? '#7dff7d' : '#2bd66b';
      g.fillRect(b.x + 1, y + 1, b.w - 2, b.h - 2);
      texto(g, String(b.i + 1), b.x + 9, y + 6, { tam: 6, cor: '#fff' });
    }
    this.desenharHeroi(g);
  }
}