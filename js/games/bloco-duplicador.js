/**
 * bloco-duplicador.js — Minijogo da MULTIPLICAÇÃO (×).
 * Bata de cabeça no bloco "?" e as gemas se multiplicam em cascata (1 → 2 → 4 → 8...).
 * O contador vai de A até A×B. Pegar as gemas que quicam dá pontos extras.
 */
import { GameBase, SPRITES, CHAO, LARGURA, colide, aleatorio, texto } from './game-base.js';

const MAX_GEMAS = 10;

export class BlocoDuplicador extends GameBase {
  static titulo = 'BLOCO DUPLICADOR';
  static dica = 'Dê cabeçadas no bloco ?';

  criar() {
    this.sprGema = SPRITES.gema();
    this.sprInterrogacao = SPRITES.interrogacao();
    this.batidasNecessarias = this.relampago ? 2 : 3;
    this.batidas = 0;
    this.baseX = LARGURA / 2 - 8;
    this.bloco = { x: this.baseX, y: CHAO - 60, w: 16, h: 16, bump: 0, usado: false };
    this.solidos = [this.bloco];
    this.gemas = [];
    this.heroi.x = 60;
    this.stats.total = this.batidasNecessarias;
    this.fimEm = null;
  }

  atualizar(dt) {
    // em dificuldade alta o bloco passeia de leve
    if (!this.bloco.usado) this.bloco.x = this.baseX + Math.sin(this.t * 1.5) * 30 * this.dificuldade;
    this.moverHeroi(dt, { aoBaterCabeca: (s) => s === this.bloco && this.bater(true) });
    this.bloco.bump = Math.max(0, this.bloco.bump - dt * 6);

    const h = this.heroi;
    for (const gm of this.gemas) {
      if (gm.pega) continue;
      gm.vy += 600 * dt;
      gm.x += gm.vx * dt;
      gm.y += gm.vy * dt;
      if (gm.x < 2 || gm.x > LARGURA - 10) gm.vx *= -1;
      if (gm.y > CHAO - 7) { gm.y = CHAO - 7; gm.vy *= -0.6; gm.vx *= 0.8; }
      if (gm.vy > -5 && gm.vy < 5 && gm.y >= CHAO - 8) gm.vy = 0;
      if (this.batidas >= 1 && colide(h, gm) && gm.idade > 0.25) {
        gm.pega = true;
        this.stats.pontos += 25;
        this.stats.extras.gemas = (this.stats.extras.gemas || 0) + 1;
        this.particulas.emitir(gm.x + 4, gm.y + 4, { n: 6, cores: ['#38e8ff', '#e8ffff'] });
        this.sfx('moeda');
      }
      gm.idade += dt;
    }

    if (this.fimEm !== null && !this.finalizando && this.t >= this.fimEm) this.terminar('MULTIPLICOU!');
  }

  /** Uma cabeçada no bloco: as gemas dobram. */
  bater(peloJogador) {
    if (this.bloco.usado || this.batidas >= this.batidasNecessarias) return;
    this.batidas++;
    this.bloco.bump = 1;
    if (peloJogador) this.acerto(this.bloco.x + 8, this.bloco.y - 6, 150, ['#ffb000', '#fff04a']);
    this.sfx('bloco');
    this.tremer(3);

    // cascata: cada gema existente "gera" uma nova (limite visual de 10)
    const novas = Math.max(1, Math.min(MAX_GEMAS - this.gemas.length, this.gemas.length || 1));
    for (let i = 0; i < novas; i++) this.criarGema(this.bloco.x + 4, this.bloco.y - 8, i * 0.05);
    if (this.gemas.length === 1 && novas === 1) this.criarGema(this.bloco.x + 4, this.bloco.y - 8, 0.08);
    this.progressoContador(this.batidas / this.batidasNecessarias);

    if (this.batidas >= this.batidasNecessarias) {
      this.bloco.usado = true;
      this.hitStop = this.reduzido ? 0 : 0.08;
      this.fimEm = this.t + 0.9;
      // explosão final em cascata
      this.particulas.emitir(this.bloco.x + 8, this.bloco.y, { n: this.reduzido ? 8 : 30, cores: ['#38e8ff', '#fff04a', '#ff5df2'], vel: 140, cima: 60 });
    }
  }

  criarGema(x, y, atraso) {
    if (this.gemas.length >= MAX_GEMAS) return;
    this.gemas.push({ x, y, w: 8, h: 7, vx: aleatorio(-90, 90), vy: aleatorio(-260, -180) - atraso * 200, pega: false, idade: 0 });
  }

  forcarFim() {
    if (this.batidas < this.batidasNecessarias) {
      // o bloco se bate sozinho (ajuda automática)
      if (Math.floor(this.t * 6) !== this._ultimaAuto) {
        this._ultimaAuto = Math.floor(this.t * 6);
        this.bater(false);
      }
    } else if (!this.finalizando) {
      this.terminar('MULTIPLICOU!');
    }
  }

  ia() {
    const h = this.heroi;
    if (this.bloco.usado) {
      const gm = this.gemas.find((x) => !x.pega && x.idade > 0.25);
      if (!gm) return { esq: false, dir: false, pulo: false };
      const dx = gm.x - h.x;
      return { esq: dx < -4, dir: dx > 4, pulo: false };
    }
    const dx = this.bloco.x + 8 - (h.x + h.w / 2);
    return {
      esq: dx < -3,
      dir: dx > 3,
      pulo: (Math.abs(dx) < 6 && h.noChao) || (!h.noChao && h.vy < 0),
    };
  }

  desenharMundo(g) {
    const b = this.bloco;
    const by = Math.round(b.y - Math.sin(b.bump * Math.PI) * 5);
    const bx = Math.round(b.x);
    // bloco 3D
    g.fillStyle = '#1a1028';
    g.fillRect(bx, by, 16, 16);
    g.fillStyle = b.usado ? '#7a5a4a' : '#ffb000';
    g.fillRect(bx + 1, by + 1, 14, 14);
    g.fillStyle = b.usado ? '#5a3a2a' : '#c97a00';
    g.fillRect(bx + 1, by + 13, 14, 2);
    g.fillRect(bx + 13, by + 1, 2, 14);
    g.fillStyle = b.usado ? '#5a3a2a' : '#ffe08a';
    g.fillRect(bx + 1, by + 1, 14, 1);
    if (!b.usado) {
      const pisca = Math.floor(this.t * 4) % 2 ? 0 : 1;
      g.drawImage(this.sprInterrogacao, bx + 5, by + 4 + pisca);
    } else {
      texto(g, `×${this.batidasNecessarias}`, bx + 8, by + 8, { tam: 6, cor: '#ffe08a' });
    }

    for (const gm of this.gemas) {
      if (gm.pega) continue;
      g.drawImage(this.sprGema, Math.round(gm.x), Math.round(gm.y));
    }
    this.desenharHeroi(g);

    // indicador de quantas batidas faltam
    for (let i = 0; i < this.batidasNecessarias; i++) {
      g.fillStyle = i < this.batidas ? '#fff04a' : 'rgba(255,255,255,0.35)';
      g.fillRect(LARGURA / 2 - this.batidasNecessarias * 5 + i * 10, 18, 6, 6);
    }
  }
}
