/**
 * confetti.js — Partículas de tela cheia: confete, fogos de artifício, moedas, chuva,
 * buraco negro, foguete e "chuva" de emojis/texto. Um único loop que dorme quando não há partículas.
 */
import { prefereMovimentoReduzido } from './shake.js';

const CORES = ['#ff3b5c', '#fff04a', '#38e8ff', '#2bd66b', '#ff5df2', '#ff9a00', '#ffffff'];
const LIMITE = 700;

class EfeitosTela {
  constructor() {
    this.canvas = null;
    this.g = null;
    this.lista = [];
    this.raf = 0;
    this.ultimo = 0;
    this.escala = 1;
    this.multiplicador = 1;
    this._aoRedimensionar = () => this._redimensionar();
  }

  /** Liga o sistema a um <canvas> que cobre a tela. */
  iniciar(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this._redimensionar();
    window.addEventListener('resize', this._aoRedimensionar);
  }

  destruir() {
    window.removeEventListener('resize', this._aoRedimensionar);
    this.limpar();
  }

  /** Quantidade de partículas conforme intensidade (chill=0.4, maluco=1, caos=1.6). */
  definirIntensidade(m) {
    this.multiplicador = m;
  }

  _redimensionar() {
    if (!this.canvas) return;
    this.escala = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(window.innerWidth * this.escala);
    this.canvas.height = Math.round(window.innerHeight * this.escala);
  }

  get L() { return window.innerWidth; }
  get A() { return window.innerHeight; }

  _qtd(n) {
    const fator = prefereMovimentoReduzido() ? 0.15 : this.multiplicador;
    return Math.max(1, Math.round(n * fator));
  }

  _add(p) {
    if (this.lista.length >= LIMITE) return; // tela cheia: descarta o novo (shift() seria O(n))
    this.lista.push({ rot: 0, vr: 0, grav: 600, arrasto: 0.99, vida: 2, max: 2, tam: 8, tipo: 'ret', ...p });
    if (!this.raf) {
      this.ultimo = performance.now();
      this.raf = requestAnimationFrame(this._quadro);
    }
  }

  confete(n = 120) {
    const q = this._qtd(n);
    for (let i = 0; i < q; i++) {
      const daEsquerda = i % 2 === 0;
      this._add({
        x: daEsquerda ? -10 : this.L + 10,
        y: this.A * (0.5 + Math.random() * 0.3),
        vx: (daEsquerda ? 1 : -1) * (250 + Math.random() * 450),
        vy: -(400 + Math.random() * 500),
        cor: CORES[i % CORES.length],
        tam: 6 + Math.random() * 6,
        vr: (Math.random() - 0.5) * 14,
        vida: 2.5 + Math.random(),
        max: 3.5,
        arrasto: 0.985,
        grav: 500,
      });
    }
  }

  fogos(n = 3) {
    if (prefereMovimentoReduzido()) return;
    const q = Math.max(1, Math.round(n * this.multiplicador));
    for (let i = 0; i < q; i++) {
      setTimeout(() => {
        this._add({
          tipo: 'foguinho',
          x: this.L * (0.15 + Math.random() * 0.7),
          y: this.A + 10,
          vx: (Math.random() - 0.5) * 60,
          vy: -(this.A * 0.9 + Math.random() * 250),
          cor: CORES[Math.floor(Math.random() * CORES.length)],
          tam: 4,
          grav: 500,
          vida: 0.9 + Math.random() * 0.3,
          max: 1.2,
          aoMorrer: (p) => this._explodir(p.x, p.y, p.cor),
        });
      }, i * 220);
    }
  }

  _explodir(x, y, cor) {
    const q = this._qtd(46);
    for (let i = 0; i < q; i++) {
      const ang = (i / q) * Math.PI * 2;
      const v = 160 + Math.random() * 140;
      this._add({ tipo: 'faisca', x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, cor: Math.random() < 0.3 ? '#ffffff' : cor, tam: 4, grav: 180, arrasto: 0.96, vida: 1.1, max: 1.1 });
    }
  }

  moedas(n = 60) {
    const q = this._qtd(n);
    for (let i = 0; i < q; i++) {
      this._add({
        tipo: 'moeda',
        x: this.L / 2 + (Math.random() - 0.5) * 40,
        y: this.A / 2,
        vx: (Math.random() - 0.5) * 900,
        vy: -(300 + Math.random() * 700),
        tam: 14,
        vida: 2.5,
        max: 2.5,
        grav: 900,
        vr: 10,
      });
    }
  }

  chuva(ms = 1600) {
    const q = this._qtd(140);
    for (let i = 0; i < q; i++) {
      this._add({
        tipo: 'gota',
        x: Math.random() * this.L,
        y: -Math.random() * this.A * 0.8,
        vx: -40,
        vy: 700 + Math.random() * 300,
        grav: 0,
        arrasto: 1,
        cor: '#7fb8ff',
        tam: 14,
        vida: ms / 1000,
        max: ms / 1000,
      });
    }
  }

  buracoNegro(ms = 1500) {
    const q = this._qtd(120);
    const cx = this.L / 2;
    const cy = this.A / 2;
    for (let i = 0; i < q; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.max(this.L, this.A) * (0.4 + Math.random() * 0.4);
      this._add({
        tipo: 'faisca',
        x: cx + Math.cos(ang) * r,
        y: cy + Math.sin(ang) * r,
        vx: Math.cos(ang + Math.PI / 2) * 200,
        vy: Math.sin(ang + Math.PI / 2) * 200,
        grav: 0,
        arrasto: 0.98,
        atrator: { x: cx, y: cy, forca: 2400 },
        cor: CORES[i % CORES.length],
        tam: 4,
        vida: ms / 1000,
        max: ms / 1000,
      });
    }
  }

  /** Cai uma chuva de emojis ou caracteres. */
  emojis(simbolo = '🎉', n = 20, cor = null) {
    const q = this._qtd(n);
    const lista = Array.isArray(simbolo) ? simbolo : [simbolo];
    for (let i = 0; i < q; i++) {
      this._add({
        tipo: 'emoji',
        texto: lista[i % lista.length],
        cor,
        x: Math.random() * this.L,
        y: -40 - Math.random() * this.A * 0.6,
        vx: (Math.random() - 0.5) * 80,
        vy: 100 + Math.random() * 200,
        grav: 300,
        tam: 22 + Math.random() * 18,
        vr: (Math.random() - 0.5) * 4,
        vida: 3,
        max: 3,
      });
    }
  }

  /** Um foguete atravessa a tela deixando rastro de fogo. */
  foguete() {
    this._add({
      tipo: 'emoji',
      texto: '🚀',
      x: -40,
      y: this.A + 40,
      vx: this.L * 0.55,
      vy: -this.A * 0.75,
      grav: 0,
      arrasto: 1,
      tam: 56,
      rot: 0,
      vida: 2.2,
      max: 2.2,
      rastro: true,
    });
  }

  limpar() {
    this.lista.length = 0;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.g) this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _quadro = (agora) => {
    const dt = Math.min(0.05, (agora - this.ultimo) / 1000);
    this.ultimo = agora;
    const g = this.g;
    g.setTransform(this.escala, 0, 0, this.escala, 0, 0);
    g.clearRect(0, 0, this.L, this.A);

    // compacta a lista no lugar (O(n)) em vez de splice a cada item que morre
    const novas = [];
    const lista = this.lista;
    let vivos = 0;
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      p.vida -= dt;
      if (p.vida <= 0) {
        if (p.aoMorrer) novas.push(p);
        continue;
      }
      lista[vivos++] = p;
      if (p.atrator) {
        const dx = p.atrator.x - p.x;
        const dy = p.atrator.y - p.y;
        const d = Math.max(20, Math.hypot(dx, dy));
        p.vx += (dx / d) * p.atrator.forca * dt;
        p.vy += (dy / d) * p.atrator.forca * dt;
        if (d < 24) p.vida = Math.min(p.vida, 0.05);
      }
      p.vy += p.grav * dt;
      p.vx *= p.arrasto;
      p.vy *= p.arrasto;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.rastro && Math.random() < 0.8) {
        novas.push({ rastroDe: p });
      }
      this._desenhar(g, p);
    }
    lista.length = vivos;
    for (const n of novas) {
      if (n.rastroDe) {
        const r = n.rastroDe;
        this._add({ tipo: 'faisca', x: r.x - 14, y: r.y + 14, vx: -60 + Math.random() * 30, vy: 60 + Math.random() * 30, grav: 0, cor: Math.random() < 0.5 ? '#ff9a00' : '#fff04a', tam: 6, vida: 0.4, max: 0.4 });
      } else {
        n.aoMorrer(n);
      }
    }

    if (this.lista.length) this.raf = requestAnimationFrame(this._quadro);
    else {
      this.raf = 0;
      g.clearRect(0, 0, this.L, this.A);
    }
  };

  _desenhar(g, p) {
    const alfa = Math.min(1, p.vida / (p.max * 0.3));
    g.globalAlpha = alfa;
    switch (p.tipo) {
      case 'ret': {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(1, Math.cos(p.rot * 2));
        g.fillStyle = p.cor;
        g.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
        g.restore();
        break;
      }
      case 'faisca':
      case 'foguinho':
        g.fillStyle = p.cor;
        g.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
        break;
      case 'gota':
        g.fillStyle = p.cor;
        g.fillRect(Math.round(p.x), Math.round(p.y), 2, p.tam);
        break;
      case 'moeda': {
        const w = Math.max(2, Math.abs(Math.cos(p.rot)) * p.tam);
        g.fillStyle = '#5a3200';
        g.fillRect(p.x - w / 2 - 2, p.y - p.tam / 2 - 2, w + 4, p.tam + 4);
        g.fillStyle = '#ffd43b';
        g.fillRect(p.x - w / 2, p.y - p.tam / 2, w, p.tam);
        g.fillStyle = '#fff7c2';
        g.fillRect(p.x - w / 4, p.y - p.tam / 3, Math.max(1, w / 5), p.tam / 1.6);
        break;
      }
      case 'emoji':
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rastro ? 0 : p.rot);
        g.font = `${p.tam}px "Press Start 2P", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = p.cor || '#fff';
        g.fillText(p.texto, 0, 0);
        g.restore();
        break;
      default:
        break;
    }
    g.globalAlpha = 1;
  }
}

export const efeitos = new EfeitosTela();
