/**
 * pisa-pisa.js — Minijogo da SUBTRAÇÃO (−).
 * Cogumelos Rabugentos (inimigos originais) marcham pelo chão. Pule em cima deles!
 * Cada um derrotado desce o contador de A até A−B. Encostar de lado só empurra (nunca morre).
 */
import { GameBase, SPRITES, CHAO, LARGURA, colide } from './game-base.js';

export class PisaPisa extends GameBase {
  static titulo = 'PISA-PISA';
  static dica = 'Pule em cima dos Rabugentos!';

  criar() {
    const n = this.relampago ? 3 : 5;
    this.spr = SPRITES.cogumelo();
    this.inimigos = [];
    const vel = (22 + this.dificuldade * 28) * this.ritmo;
    for (let i = 0; i < n; i++) {
      this.inimigos.push({
        x: LARGURA + 10 + i * 34,
        y: CHAO - 12,
        w: 12, h: 12,
        vx: -vel * (0.8 + (i % 3) * 0.15),
        vivo: true,
        esmagado: 0,
        tonto: false,
        entrou: false,
      });
    }
    this.stats.total = n;
  }

  atualizar(dt) {
    this.moverHeroi(dt);
    const h = this.heroi;
    const tontos = this.t > this.duracao * (0.6 + this.dificuldade * 0.1);

    for (const e of this.inimigos) {
      if (!e.vivo) {
        e.esmagado += dt;
        continue;
      }
      e.tonto = tontos;
      if (!e.tonto) {
        // entram correndo na tela, depois andam no ritmo normal
        e.x += (e.entrou ? e.vx : -Math.max(80, Math.abs(e.vx))) * dt;
        if (e.x < LARGURA - e.w) e.entrou = true;
        if (e.entrou && (e.x < 2 || e.x > LARGURA - e.w - 2)) {
          e.vx *= -1;
          e.x = Math.max(2, Math.min(LARGURA - e.w - 2, e.x));
        }
      } else if (e.x > LARGURA - e.w - 4) {
        e.x -= 60 * dt; // entra na tela mesmo tonto
      }

      if (!this.finalizando && colide(h, e)) {
        const pePisando = h.vy > 0 && h.y + h.h - e.y < 9;
        if (pePisando) this.esmagar(e, true);
        else if (h.invul <= 0) {
          // empurrãozinho: sem morte, sem frustração
          h.vx = h.x < e.x ? -170 : 170;
          h.vy = -150;
          h.invul = 0.8;
          this.stats.danos++;
          this.stats.combo = 0;
          this.sfx('ops');
          this.tremer(2);
        }
      }
    }

    const vivos = this.inimigos.filter((e) => e.vivo).length;
    if (!this.finalizando && vivos === 0) this.terminar('SUBTRAÍDO!');
  }

  esmagar(e, peloJogador) {
    e.vivo = false;
    e.esmagado = 0;
    if (peloJogador) {
      this.heroi.vy = -230;
      this.acerto(e.x + 6, e.y, 100, ['#8e3bd6', '#f6d6ff', '#fff']);
      this.hitStop = this.reduzido ? 0 : 0.04;
    } else {
      this.particulas.emitir(e.x + 6, e.y + 6, { n: 6, cores: ['#8e3bd6'] });
    }
    this.sfx('pisar');
    this.tremer(3);
    const derrotados = this.inimigos.filter((x) => !x.vivo).length;
    this.progressoContador(derrotados / this.inimigos.length);
  }

  forcarFim() {
    // os Rabugentos desmaiam de vergonha, um por quadro
    const proximo = this.inimigos.find((e) => e.vivo);
    if (proximo) this.esmagar(proximo, false);
    else this.terminar('SUBTRAÍDO!');
  }

  ia() {
    const h = this.heroi;
    const alvo = this.inimigos
      .filter((e) => e.vivo && e.x < LARGURA - 8)
      .sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x))[0];
    if (!alvo) return { esq: false, dir: h.x < LARGURA / 2, pulo: false };
    const dx = alvo.x + 6 - (h.x + h.w / 2);
    const perto = Math.abs(dx) < 34 + Math.abs(alvo.vx) * 0.2;
    return {
      esq: h.noChao ? dx < -18 : dx < -2,
      dir: h.noChao ? dx > 18 : dx > 2,
      pulo: (perto && h.noChao) || (!h.noChao && h.vy < 0),
    };
  }

  desenharMundo(g) {
    for (const e of this.inimigos) {
      if (!e.vivo) {
        if (e.esmagado > 0.5) continue;
        // achatado (squash)
        g.drawImage(this.spr, Math.round(e.x - 2), Math.round(e.y + 8), 16, 4);
        continue;
      }
      const passo = Math.floor(this.t * 8 + e.x) % 2;
      g.save();
      g.translate(Math.round(e.x + 6), Math.round(e.y + 12));
      g.scale(e.vx > 0 ? -1 : 1, 1);
      g.drawImage(this.spr, -6, -12 + (e.tonto ? 0 : passo));
      g.restore();
      if (e.tonto) {
        // estrelinhas de tontura
        g.fillStyle = '#fff04a';
        for (let k = 0; k < 3; k++) {
          const a = this.t * 6 + (k * Math.PI * 2) / 3;
          g.fillRect(Math.round(e.x + 6 + Math.cos(a) * 7), Math.round(e.y - 4 + Math.sin(a) * 2), 2, 2);
        }
      }
    }
    this.desenharHeroi(g);
  }
}
