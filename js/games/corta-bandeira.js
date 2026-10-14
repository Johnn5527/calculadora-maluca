/**
 * corta-bandeira.js — Minijogo da DIVISÃO (÷).
 * Uma bandeira-plataforma gigante paira no céu com marcas de corte.
 * Fique embaixo de uma marca e aperte A: o Teclito pula e dispara um laser de pixels que
 * corta a bandeira em partes iguais. A mira "gruda" na marca mais próxima (assistência).
 */
import { GameBase, CHAO, texto } from './game-base.js';

const BX = 40;
const BW = 240;
const BY = 44;
const BH = 18;

export class CortaBandeira extends GameBase {
  static titulo = 'CORTA-BANDEIRA';
  static dica = 'Fique sob a marca e aperte A!';

  criar() {
    const b = Math.abs(this.fase.b ?? 2);
    const maxPartes = this.relampago ? 3 : 6;
    this.partes = Number.isInteger(b) && b >= 2 ? Math.min(b, maxPartes) : 2;
    this.marcas = [];
    for (let i = 1; i < this.partes; i++) this.marcas.push({ x: BX + (BW * i) / this.partes, cortada: false });
    this.lasers = [];
    this.pedacos = null;
    this.recarga = 0;
    this.heroi.x = 20;
    this.stats.total = this.marcas.length;
    this.fimEm = null;
  }

  atualizar(dt) {
    this.moverHeroi(dt);
    const c = this._ctl;
    this.recarga = Math.max(0, this.recarga - dt);
    if (c.puloNovo && this.recarga === 0 && !this.pedacos) this.atirar(true);

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].vida -= dt;
      if (this.lasers[i].vida <= 0) this.lasers.splice(i, 1);
    }

    if (this.pedacos) {
      for (const p of this.pedacos) {
        p.vy += 400 * dt;
        p.y += p.vy * dt;
        p.x += p.vx * dt;
        p.rot += p.vr * dt;
      }
      if (this.fimEm !== null && this.t >= this.fimEm && !this.finalizando) this.terminar('DIVIDIDO!');
    }
  }

  /** Dispara o laser da posição do herói. A tolerância aumenta com o tempo (nunca frustra). */
  atirar(peloJogador) {
    const h = this.heroi;
    const cx = h.x + h.w / 2;
    this.recarga = 0.22;
    const tolerancia = 10 + (1 - this.dificuldade) * 10 + this.t * 3;
    const alvo = this.marcas
      .filter((m) => !m.cortada)
      .sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
    this.sfx('laser');

    if (alvo && Math.abs(alvo.x - cx) <= tolerancia) {
      alvo.cortada = true;
      this.lasers.push({ x: alvo.x, de: h.y, vida: 0.25, acertou: true });
      if (peloJogador) this.acerto(alvo.x, BY + BH + 6, 120, ['#ff3b5c', '#fff04a', '#fff']);
      else this.particulas.emitir(alvo.x, BY + BH, { n: 8, cores: ['#ff3b5c'] });
      this.particulas.emitir(alvo.x, BY + BH / 2, { n: this.reduzido ? 4 : 16, cores: ['#ffffff', '#ff3b5c'], vel: 100 });
      this.hitStop = this.reduzido ? 0 : 0.05;
      this.tremer(2);
      const feitas = this.marcas.filter((m) => m.cortada).length;
      this.progressoContador(feitas / this.marcas.length);
      if (feitas === this.marcas.length) this.desmontar();
    } else {
      this.lasers.push({ x: cx, de: h.y, vida: 0.15, acertou: false });
      if (peloJogador) {
        this.flutuar('QUASE!', cx, h.y - 10, '#aaa');
        this.stats.combo = 0;
      }
    }
  }

  /** A bandeira se separa em pedaços iguais que caem girando. */
  desmontar() {
    const w = BW / this.partes;
    this.pedacos = [];
    for (let i = 0; i < this.partes; i++) {
      this.pedacos.push({
        x: BX + i * w, y: BY, w,
        vx: (i - (this.partes - 1) / 2) * 30,
        vy: -80 - Math.random() * 40,
        rot: 0,
        vr: (Math.random() - 0.5) * 4,
        cor: i % 2 ? '#3b7dd8' : '#e43b44',
      });
    }
    this.sfx('explosao');
    this.tremer(5);
    this.fimEm = this.t + 0.8;
  }

  forcarFim() {
    if (!this.pedacos) {
      const alvo = this.marcas.find((m) => !m.cortada);
      if (alvo) {
        this.heroi.x = alvo.x - this.heroi.w / 2;
        this.atirar(false);
      }
    } else if (!this.finalizando && this.t > (this.fimEm ?? 0)) {
      this.terminar('DIVIDIDO!');
    }
  }

  ia() {
    const h = this.heroi;
    const cx = h.x + h.w / 2;
    const alvo = this.marcas.filter((m) => !m.cortada).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
    if (!alvo) return { esq: false, dir: false, pulo: false };
    const dx = alvo.x - cx;
    return { esq: dx < -2, dir: dx > 2, pulo: Math.abs(dx) < 4 && this.recarga === 0 && h.noChao };
  }

  desenharMundo(g) {
    const cx = this.heroi.x + this.heroi.w / 2;

    if (!this.pedacos) {
      // mastros
      g.fillStyle = '#d8d8e8';
      g.fillRect(BX - 4, BY - 6, 3, CHAO - BY + 6);
      g.fillRect(BX + BW + 1, BY - 6, 3, CHAO - BY + 6);
      // bandeira xadrez ondulando
      for (let x = 0; x < BW; x += 4) {
        const onda = Math.round(Math.sin(this.t * 4 + x / 18) * 2);
        for (let y = 0; y < BH; y += 6) {
          const quad = ((x / 12) | 0) + ((y / 6) | 0);
          g.fillStyle = quad % 2 ? '#ffffff' : '#1a1028';
          g.fillRect(BX + x, BY + y + onda, 4, 6);
        }
      }
      texto(g, `÷ ${this.partes}`, BX + BW / 2, BY - 10, { cor: '#fff04a' });
      // marcas de corte
      for (const m of this.marcas) {
        const pisca = Math.floor(this.t * 6) % 2;
        g.fillStyle = m.cortada ? '#ff3b5c' : pisca ? '#fff04a' : '#ff9a00';
        for (let y = BY - 4; y < BY + BH + 4; y += 4) g.fillRect(Math.round(m.x) - 1, y, 2, 2);
        if (!m.cortada) {
          // seta no chão mostrando onde parar
          const perto = Math.abs(m.x - cx) < 8;
          g.fillStyle = perto ? '#7dff7d' : '#ffffff';
          g.fillRect(Math.round(m.x) - 3, CHAO + 6, 6, 2);
          g.fillRect(Math.round(m.x) - 1, CHAO + 4, 2, 2);
        }
      }
    } else {
      for (const p of this.pedacos) {
        g.save();
        g.translate(p.x + p.w / 2, p.y + BH / 2);
        g.rotate(p.rot);
        g.fillStyle = '#1a1028';
        g.fillRect(-p.w / 2 - 1, -BH / 2 - 1, p.w + 2, BH + 2);
        g.fillStyle = p.cor;
        g.fillRect(-p.w / 2, -BH / 2, p.w, BH);
        g.restore();
      }
    }

    // lasers
    for (const l of this.lasers) {
      const largura = l.acertou ? 4 : 2;
      g.fillStyle = l.acertou ? '#ff3b5c' : 'rgba(255,255,255,0.6)';
      g.fillRect(Math.round(l.x - largura / 2), BY - 6, largura, l.de - BY + 6);
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(l.x) - 1, BY - 6, 1, l.de - BY + 6);
    }

    this.desenharHeroi(g);
    // canhãozinho na cabeça do herói
    const h = this.heroi;
    g.fillStyle = '#ff3b5c';
    g.fillRect(Math.round(h.x + h.w / 2) - 1, Math.round(h.y) - 3, 2, 3);
  }
}
