/**
 * chefao.js — Fase de CHEFÃO para "contas gigantes" (4+ operações, a partir do nível 5)
 * e para o Desafio Diário.
 * O Rei Ábaco (chefe original: um ábaco gigante de coroa) anda, pula e arremessa contas
 * do ábaco. Pule na cabeça dele! A vida dele = número de operações da conta (3 a 6).
 * Encostar nele ou nas continhas só empurra; depois de 60% do tempo ele fica tonto.
 */
import { GameBase, CHAO, LARGURA, colide, limitar, texto } from './game-base.js';

const BW = 40;
const BH = 44;
const CORES_CONTAS = ['#e43b44', '#3b7dd8', '#2bd66b', '#ffd43b'];

export class Chefao extends GameBase {
  static titulo = 'CHEFÃO: REI ÁBACO';
  static dica = 'Pule na cabeça do Rei Ábaco!';

  criar() {
    this.hpMax = limitar(Math.round(this.fase.hp ?? 4), 3, 6);
    this.hp = this.hpMax;
    this.acertosJogador = 0;
    this.chefe = { x: 230, y: CHAO - BH, w: BW, h: BH, vx: -1, vy: 0, noChao: true, invul: 0, proxPulo: 1.3, tonto: false, morto: false, tMorte: 0 };
    this.projeteis = [];
    this.proxTiro = 2;
    this.proxAutoGolpe = 0;
    this.heroi.x = 30;
    this.heroi.forcaPulo = 370;
    this.stats.total = this.hpMax;
  }

  atualizar(dt) {
    const h = this.heroi;
    const c = this.chefe;
    this.moverHeroi(dt);

    if (c.morto) {
      c.tMorte += dt;
      if (!this.reduzido && Math.random() < 0.4) {
        this.particulas.emitir(c.x + Math.random() * BW, c.y + Math.random() * BH, { n: 6, cores: ['#fff04a', '#ff9a00', '#ffffff'], vel: 120, tam: 3 });
        this.tremer(3);
      }
      if (c.tMorte > 0.9 && !this.finalizando) this.terminar('CHEFÃO DERROTADO!');
      return;
    }

    c.invul = Math.max(0, c.invul - dt);
    c.tonto = this.t > this.duracao * 0.6;

    if (!c.tonto) {
      const vel = (45 + (this.hpMax - this.hp) * 14 + this.dificuldade * 20) * this.ritmo;
      c.vx = (c.vx < 0 ? -1 : 1) * vel;
      c.x += c.vx * dt;
      if (c.x < 4) { c.x = 4; c.vx = vel; }
      if (c.x > LARGURA - BW - 4) { c.x = LARGURA - BW - 4; c.vx = -vel; }

      c.proxPulo -= dt;
      if (c.proxPulo <= 0 && c.noChao) {
        c.vy = -240;
        c.noChao = false;
        c.proxPulo = (1.3 + Math.random()) / this.ritmo;
      }

      this.proxTiro -= dt;
      if (this.proxTiro <= 0) {
        this.proxTiro = (1.7 - this.dificuldade * 0.4) / this.ritmo;
        const dir = h.x < c.x ? -1 : 1;
        this.projeteis.push({ x: c.x + BW / 2, y: c.y + 10, w: 5, h: 5, vx: dir * (70 + Math.random() * 50) * this.ritmo, vy: -200, vida: 2.2, cor: CORES_CONTAS[this.projeteis.length % 4] });
        this.sfx('roleta');
      }
    }

    // gravidade do chefe
    c.vy += 900 * dt;
    c.y += c.vy * dt;
    if (c.y + BH >= CHAO) {
      if (!c.noChao) {
        this.tremer(3);
        this.sfx('pisar');
      }
      c.y = CHAO - BH;
      c.vy = 0;
      c.noChao = true;
    }

    // contas arremessadas
    for (let i = this.projeteis.length - 1; i >= 0; i--) {
      const p = this.projeteis[i];
      p.vida -= dt;
      p.vy += 600 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y + p.h > CHAO) { p.y = CHAO - p.h; p.vy *= -0.5; }
      if (p.vida <= 0 || p.x < -10 || p.x > LARGURA + 10) { this.projeteis.splice(i, 1); continue; }
      if (!this.finalizando && colide(h, p) && h.invul <= 0) {
        this.empurrar(p.x);
        this.projeteis.splice(i, 1);
      }
    }

    // pisão na cabeça x encostão
    if (!this.finalizando && colide(h, c)) {
      const pisando = h.vy > 0 && h.y + h.h - c.y < 12;
      if (pisando && c.invul <= 0) this.golpear(true);
      else if (pisando) h.vy = -250;
      else if (h.invul <= 0) this.empurrar(c.x + BW / 2);
    }
  }

  empurrar(origemX) {
    const h = this.heroi;
    h.vx = h.x + h.w / 2 < origemX ? -200 : 200;
    h.vy = -180;
    h.invul = 0.8;
    this.stats.danos++;
    this.stats.combo = 0;
    this.sfx('ops');
    this.tremer(2);
  }

  /** Um golpe no chefe. */
  golpear(peloJogador) {
    const c = this.chefe;
    if (c.morto) return;
    this.hp--;
    c.invul = 0.8;
    if (peloJogador) {
      this.acertosJogador++;
      this.heroi.vy = -330;
      this.acerto(c.x + BW / 2, c.y - 6, 250, CORES_CONTAS);
    }
    this.particulas.emitir(c.x + BW / 2, c.y + BH / 2, { n: this.reduzido ? 6 : 24, cores: CORES_CONTAS, vel: 150, cima: 60, tam: 3 });
    this.sfx('bloco');
    this.tremer(6);
    this.hitStop = this.reduzido ? 0 : 0.08;
    this.progressoContador((this.hpMax - this.hp) / this.hpMax);
    if (this.hp <= 0) {
      c.morto = true;
      this.projeteis.length = 0;
      this.flash = this.reduzido ? 0 : 0.9;
      this.sfx('explosao');
      this.stats.extras.chefao = this.acertosJogador >= Math.ceil(this.hpMax / 2);
    }
  }

  forcarFim() {
    const c = this.chefe;
    if (!c.morto) {
      // o rei tropeça na própria coroa: golpes automáticos
      if (this.t >= this.proxAutoGolpe) {
        this.proxAutoGolpe = this.t + 0.25;
        c.invul = 0;
        this.golpear(false);
      }
    } else if (!this.finalizando && c.tMorte > 0.9) {
      this.terminar('CHEFÃO DERROTADO!');
    }
  }

  ia() {
    const h = this.heroi;
    const c = this.chefe;
    if (c.morto) return { esq: false, dir: false, pulo: false };
    const dx = c.x + BW / 2 - (h.x + h.w / 2);
    if (h.noChao) {
      const perto = Math.abs(dx) < 46 && c.noChao && c.invul < 0.3;
      return { esq: dx < -20, dir: dx > 20, pulo: perto };
    }
    return { esq: dx < -3, dir: dx > 3, pulo: h.vy < 0 };
  }

  desenharChefe(g) {
    const c = this.chefe;
    if (c.morto && c.tMorte > 0.6) return;
    if (c.invul > 0 && Math.floor(c.invul * 20) % 2 === 0) return;
    const x = Math.round(c.x);
    const y = Math.round(c.y + (c.tonto ? Math.sin(this.t * 10) : 0));
    const R = (dx, dy, w, h, cor) => {
      g.fillStyle = cor;
      g.fillRect(x + dx, y + dy, w, h);
    };
    // pés
    R(4, BH - 4, 10, 4, '#1a1028');
    R(BW - 14, BH - 4, 10, 4, '#1a1028');
    // moldura de madeira
    R(0, 6, BW, BH - 10, '#1a1028');
    R(2, 8, BW - 4, BH - 14, '#7a4a22');
    R(6, 16, BW - 12, BH - 26, '#f4f0e0');
    // arames e continhas deslizando
    for (let i = 0; i < 3; i++) {
      const wy = 19 + i * 6;
      R(6, wy, BW - 12, 1, '#5a3a22');
      for (let k = 0; k < 3; k++) {
        const desl = Math.round(Math.sin(this.t * 3 + i + k) * 2);
        R(8 + k * 8 + desl + i, wy - 2, 5, 5, CORES_CONTAS[(i + k) % 4]);
      }
    }
    // olhos bravos (ou tontos)
    if (c.tonto) {
      for (const ox of [9, BW - 15]) {
        R(ox, 10, 2, 2, '#fff');
        R(ox + 4, 10, 2, 2, '#fff');
        R(ox + 2, 12, 2, 2, '#fff');
      }
    } else {
      R(9, 10, 6, 4, '#ffffff');
      R(BW - 15, 10, 6, 4, '#ffffff');
      R(12, 11, 2, 2, '#1a1028');
      R(BW - 14, 11, 2, 2, '#1a1028');
      R(8, 8, 4, 1, '#1a1028');
      R(12, 9, 4, 1, '#1a1028');
      R(BW - 16, 9, 4, 1, '#1a1028');
      R(BW - 12, 8, 4, 1, '#1a1028');
    }
    // coroa
    R(8, 1, BW - 16, 6, '#ffd43b');
    R(8, -3, 4, 4, '#ffd43b');
    R(BW / 2 - 2, -5, 4, 6, '#ffd43b');
    R(BW - 12, -3, 4, 4, '#ffd43b');
    R(BW / 2 - 1, 2, 2, 2, '#e43b44');
    if (c.tonto) {
      g.fillStyle = '#fff04a';
      for (let k = 0; k < 3; k++) {
        const a = this.t * 5 + (k * Math.PI * 2) / 3;
        g.fillRect(Math.round(x + BW / 2 + Math.cos(a) * 14), Math.round(y - 8 + Math.sin(a) * 3), 2, 2);
      }
    }
  }

  desenharMundo(g) {
    for (const p of this.projeteis) {
      g.fillStyle = '#1a1028';
      g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 7, 7);
      g.fillStyle = p.cor;
      g.fillRect(Math.round(p.x), Math.round(p.y), 5, 5);
    }
    this.desenharChefe(g);
    this.desenharHeroi(g);

    // barra de vida do chefe
    texto(g, 'REI ÁBACO', LARGURA / 2, 10, { tam: 6, cor: '#ffd43b' });
    const larg = 14;
    const inicio = LARGURA / 2 - (this.hpMax * (larg + 2)) / 2;
    for (let i = 0; i < this.hpMax; i++) {
      g.fillStyle = '#1a1028';
      g.fillRect(inicio + i * (larg + 2), 16, larg, 6);
      g.fillStyle = i < this.hp ? '#e43b44' : '#444';
      g.fillRect(inicio + i * (larg + 2) + 1, 17, larg - 2, 4);
    }
  }
}
