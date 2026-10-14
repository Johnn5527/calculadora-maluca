/**
 * cano-subterraneo.js — Minijogo da RAIZ (√).
 * Três canos por andar; o cano certo brilha com uma seta. Suba nele e o Teclito desce
 * para o próximo andar subterrâneo, até chegar na raiz do número.
 */
import { GameBase, CHAO, LARGURA, ALTURA, texto, limitar } from './game-base.js';

const CORES_ANDAR = ['rgba(0,0,0,0)', 'rgba(20,10,40,0.35)', 'rgba(10,5,25,0.55)', 'rgba(0,0,10,0.7)'];

export class CanoSubterraneo extends GameBase {
  static titulo = 'CANO SUBTERRÂNEO';
  static dica = 'Suba no cano que brilha!';

  criar() {
    this.andares = this.relampago ? 2 : 3;
    this.andar = 0;
    this.descendo = 0; // > 0 durante a animação de descida
    this.stats.total = this.andares;
    this.montarAndar();
  }

  montarAndar() {
    const xs = [50, 148, 246];
    const alturas = [26, 34, 22];
    this.alvo = (this.andar * 2 + 1 + Math.floor(Math.random() * 2)) % 3;
    // nunca começa em cima do cano certo
    const h = this.heroi;
    this.canos = xs.map((x, i) => ({ x, y: CHAO - alturas[(i + this.andar) % 3], w: 26, h: alturas[(i + this.andar) % 3], certo: i === this.alvo }));
    this.solidos = this.canos;
    h.escala = 1;
    h.w = 10;
    h.h = 14;
    const inicio = this.alvo === 0 ? 290 : 14;
    h.x = inicio;
    h.y = CHAO - h.h;
    h.vx = 0;
    h.vy = 0;
  }

  atualizar(dt) {
    const h = this.heroi;
    if (this.descendo > 0) {
      // afundando no cano
      this.descendo -= dt;
      h.y += 40 * dt;
      if (this.descendo <= 0) {
        this.andar++;
        this.progressoContador(this.andar / this.andares);
        if (this.andar >= this.andares) {
          this.terminar('RAIZ ENCONTRADA!');
          this.solidos = [];
        } else {
          this.montarAndar();
        }
      }
      return;
    }
    if (this.finalizando) return;

    this.moverHeroi(dt);

    const cano = h.sobre;
    if (cano && cano.certo && Math.abs(h.x + h.w / 2 - (cano.x + cano.w / 2)) < 10) this.descer(true);
    else if (cano && !cano.certo && h.noChao && !this._avisou) {
      this.flutuar('NÃO É ESSE!', cano.x + 13, cano.y - 10, '#ff9a9a');
      this._avisou = true;
      this.stats.combo = 0;
    }
    if (!cano) this._avisou = false;
  }

  descer(peloJogador) {
    const h = this.heroi;
    const cano = this.canos[this.alvo];
    h.x = cano.x + cano.w / 2 - h.w / 2;
    h.y = cano.y - h.h;
    this.descendo = 0.45;
    this.solidos = [];
    if (peloJogador) this.acerto(cano.x + 13, cano.y - 8, 150, ['#2bd6a0', '#fff']);
    this.sfx('cano');
  }

  forcarFim() {
    if (this.descendo <= 0 && !this.finalizando) this.descer(false);
  }

  ia() {
    const h = this.heroi;
    const cano = this.canos[this.alvo];
    const dx = cano.x + cano.w / 2 - (h.x + h.w / 2);
    // pula quando está perto o bastante para cair em cima
    const perto = Math.abs(dx) < 36 && Math.abs(dx) > 6;
    // ou quando um cano errado bloqueia o caminho
    const sentido = Math.sign(dx);
    const bloqueado = this.canos.some((c) => {
      if (c.certo || h.y + h.h <= c.y) return false;
      const distancia = sentido > 0 ? c.x - (h.x + h.w) : h.x - (c.x + c.w);
      return distancia > -2 && distancia < 22;
    });
    return {
      esq: dx < -3,
      dir: dx > 3,
      pulo: ((perto || bloqueado) && h.noChao && h.y + h.h > cano.y) || (!h.noChao && h.vy < 0),
    };
  }

  desenharMundo(g) {
    // escurece a cada andar (mais fundo = mais escuro)
    g.fillStyle = CORES_ANDAR[limitar(this.andar, 0, 3)];
    g.fillRect(0, 0, LARGURA, ALTURA);

    texto(g, `ANDAR -${this.andar + 1}`, 34, 12, { tam: 6, cor: '#c9f6ff' });

    // herói é desenhado ANTES dos canos para "entrar" neles
    this.desenharHeroi(g);

    for (const c of this.canos) {
      const brilha = c.certo && Math.floor(this.t * 5) % 2;
      // corpo
      g.fillStyle = '#0d2b2a';
      g.fillRect(c.x - 1, c.y + 6, c.w + 2, c.h - 6);
      g.fillStyle = c.certo ? '#2bd6a0' : '#2a9d8f';
      g.fillRect(c.x + 1, c.y + 6, c.w - 2, c.h - 6);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(c.x + 4, c.y + 6, 3, c.h - 6);
      // boca
      g.fillStyle = '#0d2b2a';
      g.fillRect(c.x - 3, c.y, c.w + 6, 7);
      g.fillStyle = brilha ? '#7dffd8' : c.certo ? '#2bd6a0' : '#2a9d8f';
      g.fillRect(c.x - 2, c.y + 1, c.w + 4, 5);
      if (c.certo) {
        const bob = Math.round(Math.sin(this.t * 6) * 2);
        g.fillStyle = '#fff04a';
        g.fillRect(c.x + 11, c.y - 20 + bob, 4, 6);
        g.fillRect(c.x + 8, c.y - 14 + bob, 10, 2);
        g.fillRect(c.x + 10, c.y - 12 + bob, 6, 2);
        g.fillRect(c.x + 12, c.y - 10 + bob, 2, 2);
        texto(g, '√', c.x + 13, c.y - 28 + bob, { tam: 8, cor: '#fff04a' });
      }
    }
  }
}
