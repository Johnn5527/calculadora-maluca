/**
 * dragao-devorador.js — Minijogo da DIVISÃO POR ZERO.
 * Zerão, o Dragão Devorador (100% original, com um "0" na barriga), chega voando,
 * come a calculadora e cospe uma mensagem engraçada. Aperte A enquanto ele mastiga
 * para dar soluços nele e ganhar pontos.
 */
import { GameBase, CHAO, LARGURA, texto, limitar } from './game-base.js';

export const MENSAGENS_DRAGAO = [
  'DIVIDIR POR ZERO? NEM EU COMO TANTO!',
  'O INFINITO ESTAVA DELICIOSO. NHAM.',
  'ERRO 404: RESULTADO NO MEU ESTÔMAGO.',
  'ZERO PEDAÇOS? ENTÃO SOBRA TUDO PRA MIM!',
  'MATEMÁTICA PROIBIDA DETECTADA. ARROTO.',
  'TENTA DE NOVO SEM O ZERO, CAMPEÃO.',
];

const U = 3; // tamanho do "pixel" do dragão
const ROTEIRO = 5.6; // segundos do roteiro original (chegada, mordida, mastigação, cuspe)

export class DragaoDevorador extends GameBase {
  static titulo = 'DRAGÃO DEVORADOR';
  static dica = 'Aperte A para dar soluço no dragão!';

  criar() {
    // o roteiro foi escrito para 5,6 s; estica/encolhe para caber na duração real
    this.escalaRoteiro = ROTEIRO / this.duracao;
    this.mensagem = MENSAGENS_DRAGAO[Math.floor(Math.random() * MENSAGENS_DRAGAO.length)];
    this.stats.extras.mensagem = this.mensagem;
    this.calc = { x: 112, y: CHAO - 22, comida: false };
    this.dragao = { x: LARGURA + 40, y: 52, abertura: 0, soluco: 0 };
    this.rugiu = false;
    this.mastigadas = 0;
    this.solucos = 0;
    this.stats.total = 6;
    this.heroi.x = 30;
  }

  atualizar(dt) {
    this.moverHeroi(dt);
    const t = this.t * this.escalaRoteiro;
    const d = this.dragao;
    d.soluco = Math.max(0, d.soluco - dt * 4);

    if (t < 1.1) {
      if (Math.random() < 0.3) this.tremer(1);
    } else if (t < 2.1) {
      // chegada voando
      const p = (t - 1.1) / 1.0;
      d.x = LARGURA + 40 - (LARGURA + 40 - 150) * (1 - (1 - p) ** 3);
    } else if (t < 2.5) {
      d.x = 150;
      if (!this.rugiu) {
        this.rugiu = true;
        this.sfx('dragao');
        this.tremer(7);
        this.flutuar('ROAAARR!', d.x + 20, d.y - 12, '#ff3b5c');
      }
      d.abertura = limitar((t - 2.1) / 0.3, 0, 1);
    } else if (t < 3.1) {
      // suga a calculadora
      const p = limitar((t - 2.5) / 0.5, 0, 1);
      const boca = this.posBoca();
      this.calc.x = 112 + (boca.x - 112 - 8) * p * p;
      this.calc.y = CHAO - 22 + (boca.y - (CHAO - 22) - 8) * p * p;
      if (p >= 1 && !this.calc.comida) {
        this.calc.comida = true;
        d.abertura = 0;
        this.sfx('nham');
        this.tremer(6);
        this.hitStop = this.reduzido ? 0 : 0.12;
        this.particulas.emitir(boca.x, boca.y, { n: this.reduzido ? 6 : 24, cores: ['#9fb4c7', '#2bd66b', '#f4f0e0', '#1a1028'], vel: 120, cima: 60, tam: 3 });
      }
    } else if (t < 4.4) {
      // mastigando: o jogador pode dar soluços
      d.abertura = Math.abs(Math.sin(t * 12)) * 0.4;
      if (Math.floor(t * 6) !== this.mastigadas) {
        this.mastigadas = Math.floor(t * 6);
        if (this.mastigadas % 2 === 0) this.sfx('nham');
      }
      if (this._ctl.puloNovo) this.soluco(true);
    } else {
      d.abertura = 0.8;
      if (!this.cuspiu) {
        this.cuspiu = true;
        this.sfx('whoosh');
        this.particulas.emitir(this.posBoca().x, this.posBoca().y, { n: this.reduzido ? 6 : 20, cores: ['#ffffff', '#c9f6ff'], vel: 100 });
      }
      if (t > 5.2) d.x += 260 * dt; // vai embora voando
    }
    d.y = 52 + Math.sin(t * 3) * 4 - d.soluco * 10;
  }

  soluco(peloJogador) {
    this.dragao.soluco = 1;
    this.solucos++;
    this.sfx('soluco');
    if (this.solucos <= this.stats.total) {
      if (peloJogador) this.acerto(this.dragao.x + 30, this.dragao.y, 60, ['#fff04a', '#ff5df2']);
    } else {
      this.stats.pontos += 10;
    }
    this.progressoContador(Math.min(1, this.solucos / this.stats.total));
  }

  posBoca() {
    const d = this.dragao;
    return { x: d.x + 1 * U, y: d.y + 6 * U + d.abertura * 2 * U };
  }

  forcarFim() {
    this.terminar('NHAM!');
  }

  ia() {
    const t = this.t * this.escalaRoteiro;
    if (t > 3.1 && t < 4.4) return { esq: false, dir: false, pulo: Math.floor(t * 8) % 2 === 0 };
    return { esq: false, dir: false, pulo: false };
  }

  desenharCalculadora(g, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    g.fillStyle = '#1a1028';
    g.fillRect(x - 1, y - 1, 18, 24);
    g.fillStyle = '#9fb4c7';
    g.fillRect(x, y, 16, 22);
    g.fillStyle = '#2bd66b';
    g.fillRect(x + 2, y + 2, 12, 5);
    g.fillStyle = '#1a1028';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.fillRect(x + 2 + i * 4, y + 9 + j * 4, 3, 3);
  }

  desenharDragao(g) {
    const d = this.dragao;
    const dx = d.x;
    const dy = d.y;
    const R = (x, y, w, h, cor) => {
      g.fillStyle = cor;
      g.fillRect(Math.round(dx + x * U), Math.round(dy + y * U), Math.ceil(w * U), Math.ceil(h * U));
    };
    const roxo = '#7b2cbf';
    const escuro = '#4a1580';
    const barriga = '#ffd166';
    const K = '#1a1028';
    const asa = Math.round(Math.sin(this.t * 10) * 2);

    // asa (atrás do corpo)
    R(11, 3 - asa, 7, 2, escuro);
    R(12, 1 - asa * 1.5, 5, 2, escuro);
    R(13, -1 - asa * 2, 3, 2, escuro);
    // cauda
    R(20, 9, 4, 3, roxo);
    R(23, 7, 3, 3, roxo);
    R(25, 5, 2, 3, '#ff3b5c');
    // corpo e barriga com o "0"
    R(8, 6, 12, 8, roxo);
    R(9, 8, 9, 6, barriga);
    R(12, 9, 3, 1, K);
    R(11, 10, 1, 3, K);
    R(15, 10, 1, 3, K);
    R(12, 13, 3, 1, K);
    // pernas
    R(10, 14, 2, 3, escuro);
    R(16, 14, 2, 3, escuro);
    // pescoço e cabeça
    R(5, 4, 4, 5, roxo);
    R(0, 1, 8, 5, roxo);
    R(-3, 3, 4, 3, roxo);
    // chifres
    R(5, -1, 1, 2, '#f4f0e0');
    R(7, -2, 1, 3, '#f4f0e0');
    // olho (pisca quando soluça)
    R(3, 2, 2, d.soluco > 0.5 ? 0.5 : 2, '#fff04a');
    R(3, 2, 1, 1, K);
    // narina
    R(-3, 3, 1, 1, K);
    // boca
    const ab = d.abertura * 4;
    if (ab > 0.1) R(-2, 6, 8, ab, '#c1121f');
    R(-2, 6, 1, 1, '#ffffff');
    R(0, 6, 1, 1, '#ffffff');
    R(-3, 6 + ab, 9, 2, roxo);
    if (ab > 0.1) {
      R(-1, 5 + ab, 1, 1, '#ffffff');
      R(1, 5 + ab, 1, 1, '#ffffff');
    }
    // fumacinha das narinas
    if (!this.reduzido && Math.random() < 0.15) {
      this.particulas.emitir(dx - 3 * U, dy + 3 * U, { n: 1, cores: ['#888', '#aaa'], vel: 15, grav: -30, vida: 0.6, tam: 2 });
    }
  }

  desenharMundo(g) {
    if (!this.calc.comida) {
      this.desenharCalculadora(g, this.calc.x, this.calc.y);
      if (this.t * this.escalaRoteiro < 2.1) texto(g, '÷ 0 ?!', 120, CHAO - 34 + Math.sin(this.t * 8) * 2, { cor: '#ff3b5c' });
    }
    this.desenharHeroi(g);
    this.desenharDragao(g);

    const tr = this.t * this.escalaRoteiro;
    if (tr > 3.1 && tr < 4.4) {
      texto(g, 'APERTE A! SOLUÇO!', LARGURA / 2, 20, { tam: 8, cor: Math.floor(this.t * 6) % 2 ? '#fff04a' : '#fff' });
      texto(g, `SOLUÇOS: ${this.solucos}`, LARGURA / 2, 34, { tam: 6 });
    }

    if (this.cuspiu) {
      // balão de fala com a mensagem
      const linhas = quebrarLinhas(this.mensagem, 24);
      const bw = 240;
      const bh = 12 + linhas.length * 11;
      const bx = (LARGURA - bw) / 2;
      const by = 8;
      g.fillStyle = '#1a1028';
      g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      g.fillStyle = '#ffffff';
      g.fillRect(bx, by, bw, bh);
      g.fillRect(Math.round(this.posBoca().x) - 4, by + bh, 8, 6);
      linhas.forEach((l, i) => texto(g, l, LARGURA / 2, by + 10 + i * 11, { tam: 6, cor: '#1a1028', contorno: null }));
    }
  }
}

/** Quebra a mensagem em linhas de até N caracteres. */
export function quebrarLinhas(msg, max) {
  const palavras = msg.split(' ');
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    if ((atual + ' ' + p).trim().length > max) {
      if (atual) linhas.push(atual);
      atual = p;
    } else {
      atual = (atual + ' ' + p).trim();
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}
