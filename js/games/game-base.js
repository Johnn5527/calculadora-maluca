/**
 * game-base.js — Fundação de todos os minijogos.
 *   - Entrada unificada (teclado, toque, mouse) com limpeza via AbortController
 *   - Sprites em pixel art desenhados por código (mapas de caracteres -> canvas em cache)
 *   - Cenários por tema (Dia, Noite, Caverna, Castelo, Neon)
 *   - Partículas, textos flutuantes, tremor de câmera, hit-stop e câmera lenta
 *   - Física de plataforma (gravidade, coyote time, buffer de pulo, colisão AABB)
 *   - Loop com requestAnimationFrame + delta time
 *
 * Herói original: "Teclito", uma tecla de calculadora com bandana e perninhas.
 */
import { duracaoBase } from '../regras-partida.js';

export const LARGURA = 320;
export const ALTURA = 180;
export const CHAO = 152;
export const GRAVIDADE = 900;
export const FONTE = '"Press Start 2P", monospace';

/* =========================================================================
 * ENTRADA
 * ========================================================================= */

export class Entrada {
  /**
   * @param {{botoes?: HTMLElement[], superficie?: HTMLElement}} opts
   *   botoes: elementos com data-ctl="esq|dir|pulo"
   *   superficie: elemento onde um toque = pulo (o canvas)
   */
  constructor({ botoes = [], superficie = null } = {}) {
    this.teclas = new Set();
    this.toques = { esq: false, dir: false, pulo: false };
    this.pulosPendentes = 0;
    this._controle = new AbortController();
    const op = { signal: this._controle.signal };

    window.addEventListener('keydown', (e) => {
      const c = this._mapear(e.code || e.key);
      if (!c) return;
      e.preventDefault();
      if (c === 'pulo' && !e.repeat) this.pulosPendentes++;
      this.teclas.add(c);
    }, op);
    window.addEventListener('keyup', (e) => {
      const c = this._mapear(e.code || e.key);
      if (c) this.teclas.delete(c);
    }, op);
    window.addEventListener('blur', () => this.limpar(), op);

    for (const b of botoes) {
      const ctl = b.dataset.ctl;
      if (!['esq', 'dir', 'pulo'].includes(ctl)) continue;
      const soltar = () => { this.toques[ctl] = false; b.classList.remove('ativo'); };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch { /* ok */ }
        this.toques[ctl] = true;
        b.classList.add('ativo');
        if (ctl === 'pulo') this.pulosPendentes++;
      }, op);
      b.addEventListener('pointerup', soltar, op);
      b.addEventListener('pointercancel', soltar, op);
      b.addEventListener('lostpointercapture', soltar, op);
      b.addEventListener('contextmenu', (e) => e.preventDefault(), op);
    }

    if (superficie) {
      superficie.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.pulosPendentes++;
        this.toques.pulo = true;
      }, op);
      const fim = () => { this.toques.pulo = false; };
      superficie.addEventListener('pointerup', fim, op);
      superficie.addEventListener('pointercancel', fim, op);
      superficie.addEventListener('pointerleave', fim, op);
    }
  }

  _mapear(codigo) {
    switch (codigo) {
      case 'ArrowLeft': case 'KeyA': case 'a': return 'esq';
      case 'ArrowRight': case 'KeyD': case 'd': return 'dir';
      case 'ArrowUp': case 'KeyW': case 'Space': case ' ': case 'KeyZ': case 'KeyX': case 'w': return 'pulo';
      default: return null;
    }
  }

  /** Estado atual combinado (teclado + toque). */
  estado() {
    return {
      esq: this.teclas.has('esq') || this.toques.esq,
      dir: this.teclas.has('dir') || this.toques.dir,
      pulo: this.teclas.has('pulo') || this.toques.pulo,
    };
  }

  /** Quantos "apertos" de pulo aconteceram desde a última consulta. */
  consumirPulos() {
    const n = this.pulosPendentes;
    this.pulosPendentes = 0;
    return n;
  }

  limpar() {
    this.teclas.clear();
    this.toques = { esq: false, dir: false, pulo: false };
    this.pulosPendentes = 0;
  }

  destruir() {
    this._controle.abort();
    this.limpar();
  }
}

/* =========================================================================
 * SPRITES (pixel art por código)
 * ========================================================================= */

const cacheSprites = new Map();

/**
 * Converte um mapa de caracteres em um canvas (cacheado).
 * '.' = transparente; cada outro caractere é procurado na paleta.
 */
export function criarSprite(chave, mapa, paleta) {
  if (cacheSprites.has(chave)) return cacheSprites.get(chave);
  const alt = mapa.length;
  const larg = Math.max(...mapa.map((l) => l.length));
  const c = document.createElement('canvas');
  c.width = larg;
  c.height = alt;
  const g = c.getContext('2d');
  for (let y = 0; y < alt; y++) {
    for (let x = 0; x < mapa[y].length; x++) {
      const ch = mapa[y][x];
      if (ch === '.' || !paleta[ch]) continue;
      g.fillStyle = paleta[ch];
      g.fillRect(x, y, 1, 1);
    }
  }
  cacheSprites.set(chave, c);
  return c;
}

export const HEROI_CORPO = [
  '...KKKKKK...',
  '..KBBBBBBK..',
  '.KBBBBBBBBKB',
  '.KWWWWWWWWKB',
  '.KWKWWWWKWK.',
  '.KWKWWWWKWK.',
  '.KWWWWWWWWK.',
  '.KWWWWPWWWK.',
  '.KWWWPPPWWK.',
  '.KWWWWPWWWK.',
  '.KWWWWWWWWK.',
  '..KKKKKKKK..',
];
const HEROI_PERNAS_A = ['..KK....KK..', '.SSS....SSS.'];
const HEROI_PERNAS_B = ['...KK..KK...', '..SSS..SSS..'];
const HEROI_PERNAS_PULO = ['.KK......KK.', 'SSS......SSS'];

export const PALETAS_SKIN = {
  classico: { K: '#1a1028', B: '#e43b44', W: '#f4f0e0', P: '#3b7dd8', S: '#5a3a22' },
  noturno: { K: '#0b0b14', B: '#2b2b3f', W: '#c9c7e8', P: '#8a5cff', S: '#22223a' },
  robo: { K: '#14202b', B: '#2ce8f5', W: '#9fb4c7', P: '#ff5d5d', S: '#3a4a5a' },
  ouro: { K: '#3a2200', B: '#ff7a00', W: '#ffd84a', P: '#ffffff', S: '#8a4b00' },
  arcoiris: { K: '#1a1028', B: '#ff2bd6', W: '#7dffb2', P: '#ffe600', S: '#3b7dd8' },
  pirata: { K: '#1a1028', B: '#1a1028', W: '#e8c9a0', P: '#e43b44', S: '#3a2210' },
  lendaria: { K: '#2a0a3a', B: '#b04aff', W: '#fff7c2', P: '#ff9a00', S: '#ffd43b' },
};

/**
 * Retorna os 3 quadros do herói para a skin escolhida.
 * @param {string} skin id da skin ('custom' usa a skin personalizada)
 * @param {{mapa:string[], paleta:object}|null} [personalizada] skin criada no editor
 */
export function spritesHeroi(skin = 'classico', personalizada = null) {
  let corpo = HEROI_CORPO;
  let paleta = PALETAS_SKIN[skin] || PALETAS_SKIN.classico;
  let chave = skin;
  if (skin === 'custom' && personalizada?.mapa?.length) {
    corpo = personalizada.mapa;
    paleta = personalizada.paleta;
    // a chave do cache muda sempre que o desenho ou as cores mudam
    const assinatura = corpo.join('') + Object.values(paleta).join('');
    let h = 0;
    for (let i = 0; i < assinatura.length; i++) h = (Math.imul(h, 31) + assinatura.charCodeAt(i)) | 0;
    chave = `custom-${h >>> 0}`;
  }
  return {
    andarA: criarSprite(`heroi-${chave}-a`, [...corpo, ...HEROI_PERNAS_A], paleta),
    andarB: criarSprite(`heroi-${chave}-b`, [...corpo, ...HEROI_PERNAS_B], paleta),
    pulo: criarSprite(`heroi-${chave}-p`, [...corpo, ...HEROI_PERNAS_PULO], paleta),
  };
}

export const SPRITES = {
  moeda: () => criarSprite('moeda', [
    '..KKKK..',
    '.KYYYYK.',
    'KYYWYYOK',
    'KYWYYYOK',
    'KYWYYYOK',
    'KYYYYOOK',
    '.KYOOOK.',
    '..KKKK..',
  ], { K: '#5a3200', Y: '#ffd43b', W: '#fff7c2', O: '#e09400' }),

  cogumelo: () => criarSprite('cogumelo', [
    '...KKKKKK...',
    '.KKPPWWPPKK.',
    'KPPPPWWPPPPK',
    'KPWWPPPPWWPK',
    'KPPPPPPPPPPK',
    '.KKKKKKKKKK.',
    '..KKFFFFKK..',
    '..KFKFFKFK..',
    '..KFFFFFFK..',
    '..KFKKKKFK..',
    '...KFFFFK...',
    '..KKK..KKK..',
  ], { K: '#1a1028', P: '#8e3bd6', W: '#f6d6ff', F: '#ffe2b8' }),

  estrela: () => criarSprite('estrela', [
    '....KK....',
    '...KYYK...',
    '...KYYK...',
    'KKKKYYKKKK',
    'KYYYYYYYYK',
    '.KYKYYKYK.',
    '..KYYYYK..',
    '.KYYKKYYK.',
    '.KYK..KYK.',
    '.KK....KK.',
  ], { K: '#5a3200', Y: '#fff04a' }),

  gema: () => criarSprite('gema', [
    '..KKKK..',
    '.KCWCCK.',
    'KCWCCCCK',
    'KCCCCCDK',
    '.KCCCDK.',
    '..KCDK..',
    '...KK...',
  ], { K: '#0a2a3a', C: '#38e8ff', W: '#e8ffff', D: '#1a9ec0' }),

  sete: () => criarSprite('sete', [
    'KKKKKKKK',
    'KRRRRRRK',
    'KKKKKRRK',
    '...KRRK.',
    '..KRRK..',
    '..KRRK..',
    '.KRRK...',
    '.KKKK...',
  ], { K: '#3a0010', R: '#ff3b5c' }),

  porcento: () => criarSprite('porcento', [
    'KK....K.',
    'KK...K..',
    '....K...',
    '...K....',
    '..K.....',
    '.K....KK',
    'K.....KK',
  ], { K: '#2bd66b' }),

  interrogacao: () => criarSprite('interrogacao', [
    '.WWWW.',
    'WW..WW',
    '....WW',
    '...WW.',
    '..WW..',
    '......',
    '..WW..',
  ], { W: '#ffffff' }),
};

/* =========================================================================
 * CENÁRIOS
 * ========================================================================= */

export const CENARIOS = {
  dia: { ceu: ['#5fcde4', '#c9f6ff'], colinas: '#3e9c4a', colinas2: '#62c46b', chao: '#c76b2f', chao2: '#9a4f1f', topo: '#4bbf3c', detalhe: 'nuvens' },
  noite: { ceu: ['#0b1030', '#2c2a6b'], colinas: '#1f3d5a', colinas2: '#2b5577', chao: '#5a3a2a', chao2: '#3d271c', topo: '#2f7d5b', detalhe: 'estrelas' },
  caverna: { ceu: ['#120c18', '#3a2a3a'], colinas: '#2a1f33', colinas2: '#3b2b47', chao: '#5b4a6b', chao2: '#3f3350', topo: '#8a6bb0', detalhe: 'estalactites' },
  castelo: { ceu: ['#2a0f12', '#6b1f1f'], colinas: '#3a1a1f', colinas2: '#4d2228', chao: '#555566', chao2: '#3c3c4a', topo: '#9a9ab0', detalhe: 'tochas' },
  neon: { ceu: ['#07000f', '#2a0055'], colinas: '#2b0a5a', colinas2: '#00e5ff', chao: '#12002a', chao2: '#1f0044', topo: '#ff2bd6', detalhe: 'grade' },
};

const cacheFundos = new Map();

/** Pré-renderiza a parte estática do cenário (céu, colinas, chão). */
function fundoEstatico(tema) {
  if (cacheFundos.has(tema)) return cacheFundos.get(tema);
  const cen = CENARIOS[tema] || CENARIOS.dia;
  const c = document.createElement('canvas');
  c.width = LARGURA;
  c.height = ALTURA;
  const g = c.getContext('2d');

  // céu em faixas (dithering de 8 bits)
  const faixas = 12;
  for (let i = 0; i < faixas; i++) {
    g.fillStyle = misturar(cen.ceu[0], cen.ceu[1], i / (faixas - 1));
    g.fillRect(0, Math.floor((i * CHAO) / faixas), LARGURA, Math.ceil(CHAO / faixas) + 1);
  }

  // colinas em degraus
  for (let camada = 0; camada < 2; camada++) {
    g.fillStyle = camada === 0 ? cen.colinas : cen.colinas2;
    const base = CHAO - (camada === 0 ? 10 : 0);
    for (let x = 0; x < LARGURA; x += 4) {
      const h = (camada === 0 ? 46 : 26) + Math.sin(x / (camada === 0 ? 37 : 23) + camada * 2) * (camada === 0 ? 18 : 10);
      g.fillRect(x, Math.round(base - h), 4, Math.round(h));
    }
  }

  if (cen.detalhe === 'grade') {
    g.strokeStyle = 'rgba(0,229,255,0.35)';
    g.lineWidth = 1;
    for (let x = -LARGURA; x < LARGURA * 2; x += 24) {
      g.beginPath(); g.moveTo(LARGURA / 2 + (x - LARGURA / 2) * 0.2, 90); g.lineTo(x, CHAO); g.stroke();
    }
    for (let y = 96; y < CHAO; y += 10) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(LARGURA, y + 0.5); g.stroke(); }
  }
  if (cen.detalhe === 'tochas') {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < CHAO - 40; y += 10) {
      for (let x = (y / 10) % 2 ? 0 : 10; x < LARGURA; x += 20) g.fillRect(x, y, 19, 1);
    }
  }

  // chão em blocos
  g.fillStyle = cen.chao;
  g.fillRect(0, CHAO, LARGURA, ALTURA - CHAO);
  g.fillStyle = cen.chao2;
  for (let y = CHAO + 6; y < ALTURA; y += 8) {
    for (let x = ((y / 8) | 0) % 2 ? 0 : 8; x < LARGURA; x += 16) g.fillRect(x, y, 2, 2);
  }
  g.fillStyle = cen.topo;
  g.fillRect(0, CHAO, LARGURA, 4);
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fillRect(0, CHAO + 4, LARGURA, 1);

  cacheFundos.set(tema, c);
  return c;
}

/** Desenha o cenário completo (estático + detalhes animados baratos). */
export function desenharCenario(g, tema, t) {
  g.drawImage(fundoEstatico(tema), 0, 0);
  const cen = CENARIOS[tema] || CENARIOS.dia;
  switch (cen.detalhe) {
    case 'nuvens':
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const x = ((i * 97 + t * (6 + i * 2)) % (LARGURA + 60)) - 40;
        const y = 16 + i * 13;
        g.fillRect(Math.round(x), y, 28, 6);
        g.fillRect(Math.round(x) + 6, y - 4, 14, 4);
      }
      break;
    case 'estrelas':
      for (let i = 0; i < 26; i++) {
        const pisca = Math.sin(t * 3 + i * 1.7) > 0.3;
        g.fillStyle = pisca ? '#ffffff' : '#8a8acc';
        g.fillRect((i * 53) % LARGURA, (i * 29) % 80, 1, 1);
      }
      g.fillStyle = '#fff6c2';
      g.fillRect(270, 14, 14, 14);
      g.fillStyle = CENARIOS.noite.ceu[0];
      g.fillRect(276, 12, 10, 12);
      break;
    case 'estalactites':
      g.fillStyle = '#4a3a5a';
      for (let i = 0; i < 12; i++) {
        const x = i * 28 + 6;
        const h = 10 + ((i * 7) % 14);
        for (let k = 0; k < h; k += 2) g.fillRect(x + k / 4, k, 8 - k / 2, 2);
      }
      // gotinhas
      g.fillStyle = '#7fd0ff';
      for (let i = 0; i < 3; i++) g.fillRect(i * 112 + 10, ((t * 60 + i * 50) % 140) + 20, 1, 3);
      break;
    case 'tochas':
      for (let i = 0; i < 3; i++) {
        const x = 50 + i * 110;
        g.fillStyle = '#5a3a22';
        g.fillRect(x, 60, 4, 12);
        g.fillStyle = Math.sin(t * 20 + i) > 0 ? '#ffb000' : '#ff5a00';
        g.fillRect(x - 1, 54 + Math.round(Math.sin(t * 15 + i)), 6, 6);
      }
      break;
    case 'grade': {
      g.fillStyle = '#ff2bd6';
      const s = 40 + Math.sin(t * 2) * 2;
      g.fillRect(LARGURA / 2 - s / 2, 40, s, 2);
      g.fillRect(LARGURA / 2 - s / 3, 46, (s * 2) / 3, 2);
      g.fillRect(LARGURA / 2 - s / 5, 52, (s * 2) / 5, 2);
      break;
    }
    default: break;
  }
}

/** Mistura duas cores hexadecimais. */
export function misturar(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${gg},${bl})`;
}

/* =========================================================================
 * PARTÍCULAS
 * ========================================================================= */

export class Particulas {
  constructor(limite = 300) {
    this.lista = [];
    this.limite = limite;
  }

  emitir(x, y, { n = 10, cores = ['#fff'], vel = 80, vida = 0.6, grav = 300, tam = 2, cima = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      if (this.lista.length >= this.limite) return;
      const ang = Math.random() * Math.PI * 2;
      const v = vel * (0.4 + Math.random() * 0.8);
      this.lista.push({
        x, y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v - cima,
        vida: vida * (0.6 + Math.random() * 0.6),
        max: vida,
        cor: cores[(Math.random() * cores.length) | 0],
        tam,
        grav,
      });
    }
  }

  atualizar(dt) {
    const lista = this.lista;
    let vivos = 0;
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      p.vida -= dt;
      if (p.vida <= 0) continue;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      lista[vivos++] = p;
    }
    lista.length = vivos;
  }

  desenhar(g) {
    for (const p of this.lista) {
      g.globalAlpha = Math.min(1, p.vida / (p.max * 0.5));
      g.fillStyle = p.cor;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam);
    }
    g.globalAlpha = 1;
  }
}

/* =========================================================================
 * UTILITÁRIOS
 * ========================================================================= */

export const colide = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
export const aleatorio = (min, max) => min + Math.random() * (max - min);

/** Texto pixelado com contorno. */
export function texto(g, msg, x, y, { cor = '#fff', tam = 8, alinhar = 'center', contorno = '#000' } = {}) {
  g.font = `${tam}px ${FONTE}`;
  g.textAlign = alinhar;
  g.textBaseline = 'middle';
  if (contorno) {
    g.fillStyle = contorno;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(msg, x + dx, y + dy);
  }
  g.fillStyle = cor;
  g.fillText(msg, x, y);
}

/* =========================================================================
 * CLASSE BASE
 * ========================================================================= */

/** Maior passo de física por subquadro: acima disso o quadro é dividido. */
const PASSO_MAX = 0.05;

export class GameBase {
  static titulo = 'MINIJOGO';
  static dica = '◀ ▶ para andar, A para pular';

  /**
   * @param {object} o
   * @param {HTMLCanvasElement} o.canvas
   * @param {Entrada} o.entrada
   * @param {{op:string,a:number,b:number|null,r:number}} o.fase
   * @param {number} [o.duracao] segundos máximos da fase (a sessão calcula com o seletor de velocidade)
   * @param {boolean} [o.relampago] fase relâmpago (expressões encadeadas)
   * @param {number} [o.ritmoInimigos] multiplicador da velocidade dos inimigos (1 = normal)
   * @param {number} [o.dificuldade] 0..1
   * @param {boolean} [o.auto] auto-play
   * @param {string} [o.tema] cenário
   * @param {string} [o.skin] skin do herói
   * @param {(nome:string)=>void} [o.sfx]
   * @param {(info:object)=>void} [o.aoHud]
   * @param {boolean} [o.reduzido] prefers-reduced-motion
   */
  constructor(o) {
    this.canvas = o.canvas;
    this.g = o.canvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.entrada = o.entrada;
    this.fase = o.fase;
    this.relampago = !!o.relampago;
    this.duracao = o.duracao ?? duracaoBase(o.fase?.op, this.relampago);
    this.ritmo = o.ritmoInimigos ?? 1;
    this.dificuldade = o.dificuldade ?? 0.3;
    this.auto = !!o.auto;
    this.tema = o.tema || 'dia';
    this.sfx = o.sfx || (() => {});
    this.aoHud = o.aoHud || (() => {});
    this.reduzido = !!o.reduzido;

    this.t = 0;
    this.particulas = new Particulas();
    this.textos = [];
    this.tremor = 0;
    this.hitStop = 0;
    this.escalaTempo = 1;
    this.flash = 0;
    this.finalizando = false;
    this.encerrado = false;
    this.tempoFinal = 0;
    this.msgFinal = '';
    this.contador = Number.isFinite(o.fase?.a) ? o.fase.a : 0;
    this.ultimoAcerto = -10;

    this.stats = { pontos: 0, combo: 0, comboMax: 0, coletados: 0, total: 0, danos: 0, pulou: false, auto: this.auto, rapido: false, extras: {} };

    this.sprHeroi = spritesHeroi(o.skin, o.skinPersonalizada);
    this.aoEnergia = o.aoEnergia || (() => {});
    this._energia = -1;
    this.heroi = this.criarHeroi(40);
    this.solidos = [];
    this._ctl = { esq: false, dir: false, pulo: false, puloNovo: false };
  }

  /* ---------- ciclo de vida ---------- */

  /** Começa a fase. Resolve com as estatísticas quando termina. */
  iniciar() {
    return new Promise((resolve) => {
      this._resolver = resolve;
      try {
        this.criar();
      } catch (e) {
        console.error('[minijogo] erro ao criar', e);
        this._finalizar();
        return;
      }
      this.entrada.consumirPulos();
      this.ultimo = performance.now();
      this.raf = requestAnimationFrame(this._quadro);
    });
  }

  _quadro = (agora) => {
    if (this.encerrado) return;
    this.raf = requestAnimationFrame(this._quadro);
    // Em aparelho lento um quadro pode passar de 50 ms: em vez de cortar o tempo (o relógio
    // "arrastava"), divide em subpassos. Teto de 0,25 s para a volta de uma aba em segundo plano.
    let restante = limitar((agora - this.ultimo) / 1000, 0, 0.25);
    this.ultimo = agora;
    try {
      let primeiro = true;
      while (restante > 0 && !this.encerrado) {
        const dtReal = Math.min(restante, PASSO_MAX);
        restante -= dtReal;
        this._passo(dtReal, primeiro);
        primeiro = false;
      }
      // "energia" = combo ativo (esfria 1,5 s depois do último acerto); acelera a trilha sonora
      const energia = this.t - this.ultimoAcerto < 1.5 ? this.stats.combo : 0;
      if (energia !== this._energia) {
        this._energia = energia;
        this.aoEnergia(energia);
      }
      this._desenhar();
      this.aoHud({
        contador: this.finalizando ? this.fase.r : this.contador,
        progresso: limitar(this.t / this.duracao, 0, 1),
      });
    } catch (e) {
      console.error('[minijogo] erro no loop', e);
      this._finalizar();
    }
  };

  /** Um subpasso da simulação. Os controles só são lidos no primeiro subpasso do quadro. */
  _passo(dtReal, lerControles) {
    if (this.hitStop > 0) {
      this.hitStop -= dtReal;
      return;
    }
    const dt = dtReal * this.escalaTempo;
    this.t += dt;
    if (lerControles) this._lerControles();
    else this._ctl.puloNovo = false;
    this.atualizar(dt);
    if (!this.finalizando && this.t >= this.duracao) this.forcarFim();
    if (this.finalizando) {
      this.tempoFinal += dtReal;
      this.escalaTempo = Math.min(1, this.escalaTempo + dtReal * 0.8);
      if (this.tempoFinal > (this.relampago ? 0.55 : 1.0)) this._finalizar();
    }
    this.particulas.atualizar(dt);
    this._atualizarTextos(dt);
    this.tremor = Math.max(0, this.tremor - dtReal * 30);
    this.flash = Math.max(0, this.flash - dtReal * 4);
  }

  _lerControles() {
    const real = this.entrada.estado();
    const pulos = this.entrada.consumirPulos();
    if (this.finalizando) {
      this._ctl = { esq: false, dir: false, pulo: false, puloNovo: false };
      return;
    }
    let c = { ...real, puloNovo: pulos > 0 };
    if (this.auto) {
      const ia = this.ia() || {};
      c = {
        esq: real.esq || !!ia.esq,
        dir: real.dir || !!ia.dir,
        pulo: real.pulo || !!ia.pulo,
        puloNovo: pulos > 0 || (!!ia.pulo && !this._iaPuloAnterior),
      };
      this._iaPuloAnterior = !!ia.pulo;
    }
    this._ctl = c;
  }

  /** Inicia o encerramento com câmera lenta + hit-stop. */
  terminar(msg = 'LIMPO!') {
    if (this.finalizando) return;
    this.finalizando = true;
    this.msgFinal = msg;
    this.contador = this.fase.r;
    this.stats.rapido = this.t < this.duracao * 0.7;
    if (!this.reduzido) {
      this.hitStop = 0.12;
      this.escalaTempo = 0.3;
      this.flash = 0.6;
    }
    this.sfx('vitoria-curta');
  }

  /** Chamado quando o tempo acaba: cada jogo completa o objetivo com "ajuda". */
  forcarFim() {
    this.terminar('TEMPO!');
  }

  /** Botão PULAR: encerra imediatamente. */
  pular() {
    this.stats.pulou = true;
    this._finalizar();
  }

  _finalizar() {
    if (this.encerrado) return;
    this.encerrado = true;
    cancelAnimationFrame(this.raf);
    this.stats.tempo = this.t;
    const r = this._resolver;
    this._resolver = null;
    r?.(this.stats);
  }

  destruir() {
    this._finalizar();
  }

  /* ---------- hooks para as subclasses ---------- */
  criar() {}
  atualizar(_dt) {}
  desenharMundo(_g) {}
  /** Auto-play: devolve {esq, dir, pulo}. */
  ia() { return null; }

  /* ---------- herói e física ---------- */

  criarHeroi(x) {
    return {
      x, y: CHAO - 14, w: 10, h: 14,
      vx: 0, vy: 0, dir: 1, noChao: true, sobre: null,
      coyote: 0, buffer: 0, anim: 0, squash: 0, escala: 1, invul: 0,
      forcaPulo: 330, velMax: 125,
    };
  }

  /** Movimento de plataforma com colisão AABB em dois eixos. */
  moverHeroi(dt, { aoBaterCabeca = null } = {}) {
    const h = this.heroi;
    const c = this._ctl;
    const acel = h.noChao ? 1100 : 750;

    if (c.esq && !c.dir) { h.vx = Math.max(-h.velMax, h.vx - acel * dt); h.dir = -1; }
    else if (c.dir && !c.esq) { h.vx = Math.min(h.velMax, h.vx + acel * dt); h.dir = 1; }
    else {
      const atrito = (h.noChao ? 900 : 300) * dt;
      h.vx = Math.abs(h.vx) <= atrito ? 0 : h.vx - Math.sign(h.vx) * atrito;
    }

    // coyote time + buffer de pulo = controles generosos
    h.coyote = h.noChao ? 0.09 : Math.max(0, h.coyote - dt);
    h.buffer = c.puloNovo ? 0.13 : Math.max(0, h.buffer - dt);
    if (h.buffer > 0 && h.coyote > 0) {
      h.vy = -h.forcaPulo;
      h.noChao = false;
      h.coyote = 0;
      h.buffer = 0;
      h.squash = -0.35;
      this.sfx('pulo');
    }
    if (!c.pulo && h.vy < -140) h.vy = -140; // pulo de altura variável

    h.vy = Math.min(520, h.vy + GRAVIDADE * dt);

    // eixo X
    h.x += h.vx * dt;
    h.x = limitar(h.x, 2, LARGURA - h.w - 2);
    for (const s of this.solidos) {
      if (s.inativo || !colide(h, s)) continue;
      if (h.vx > 0) h.x = s.x - h.w; else if (h.vx < 0) h.x = s.x + s.w;
      else h.x = h.x + h.w / 2 < s.x + s.w / 2 ? s.x - h.w : s.x + s.w;
      h.vx = 0;
    }

    // eixo Y
    const estavaNoChao = h.noChao;
    h.noChao = false;
    h.sobre = null;
    const vyAntes = h.vy;
    h.y += h.vy * dt;
    for (const s of this.solidos) {
      if (s.inativo || !colide(h, s)) continue;
      if (h.vy > 0) { h.y = s.y - h.h; h.vy = 0; h.noChao = true; h.sobre = s; }
      else if (h.vy < 0) { h.y = s.y + s.h; h.vy = 60; aoBaterCabeca?.(s); }
    }
    if (h.y + h.h >= CHAO) { h.y = CHAO - h.h; h.vy = 0; h.noChao = true; }
    if (h.noChao && !estavaNoChao && vyAntes > 200) h.squash = 0.3;

    h.squash *= Math.pow(0.0001, dt);
    h.invul = Math.max(0, h.invul - dt);
    h.anim += Math.abs(h.vx) * dt;
  }

  desenharHeroi(g) {
    const h = this.heroi;
    if (h.invul > 0 && Math.floor(h.invul * 20) % 2 === 0) return;
    const spr = !h.noChao ? this.sprHeroi.pulo : Math.abs(h.vx) > 10 && Math.floor(h.anim / 8) % 2 ? this.sprHeroi.andarB : this.sprHeroi.andarA;
    const sx = (1 + h.squash) * h.escala;
    const sy = (1 - h.squash) * h.escala;
    g.save();
    g.translate(Math.round(h.x + h.w / 2), Math.round(h.y + h.h));
    g.scale(h.dir * sx, sy);
    g.drawImage(spr, -6, -14);
    g.restore();
  }

  /* ---------- pontuação e feedback ---------- */

  /** Registra um acerto: combo, pontos, texto flutuante e partículas. */
  acerto(x, y, pontos = 100, cores = ['#fff04a', '#ffffff']) {
    this.stats.combo = this.t - this.ultimoAcerto < 1.1 ? this.stats.combo + 1 : 1;
    this.ultimoAcerto = this.t;
    this.stats.comboMax = Math.max(this.stats.comboMax, this.stats.combo);
    this.stats.pontos += pontos * this.stats.combo;
    this.stats.coletados++;
    this.flutuar(this.stats.combo > 1 ? `x${this.stats.combo}!` : `+${pontos}`, x, y, this.stats.combo > 2 ? '#ff5df2' : '#fff04a');
    this.particulas.emitir(x, y, { n: this.reduzido ? 4 : 12, cores, vel: 90, cima: 40 });
  }

  flutuar(msg, x, y, cor = '#fff') {
    this.textos.push({ msg, x, y, cor, vida: 0.8 });
  }

  _atualizarTextos(dt) {
    for (let i = this.textos.length - 1; i >= 0; i--) {
      const tx = this.textos[i];
      tx.vida -= dt;
      tx.y -= 30 * dt;
      if (tx.vida <= 0) this.textos.splice(i, 1);
    }
  }

  tremer(forca = 4) {
    if (!this.reduzido) this.tremor = Math.max(this.tremor, forca);
  }

  /** Interpola o contador decorativo entre a e r (o valor final é SEMPRE fase.r). */
  progressoContador(p) {
    const a = Number.isFinite(this.fase.a) ? this.fase.a : 0;
    const r = Number.isFinite(this.fase.r) ? this.fase.r : 0;
    this.contador = a + (r - a) * limitar(p, 0, 1);
  }

  /* ---------- desenho ---------- */

  _desenhar() {
    const g = this.g;
    g.save();
    if (this.tremor > 0) g.translate(Math.round(aleatorio(-this.tremor, this.tremor)), Math.round(aleatorio(-this.tremor, this.tremor)));
    desenharCenario(g, this.tema, this.t);
    this.desenharMundo(g);
    this.particulas.desenhar(g);
    for (const tx of this.textos) {
      g.globalAlpha = Math.min(1, tx.vida * 2);
      texto(g, tx.msg, tx.x, tx.y, { cor: tx.cor });
    }
    g.globalAlpha = 1;
    g.restore();

    if (this.t < 0.9 && !this.finalizando) {
      const esc = 1 + Math.max(0, 0.5 - this.t);
      texto(g, this.relampago ? 'RELÂMPAGO!' : 'VAI!', LARGURA / 2, 40, { cor: '#fff04a', tam: Math.round(12 * esc) });
    }
    if (this.finalizando) {
      texto(g, this.msgFinal, LARGURA / 2, ALTURA / 2 - 20, { cor: '#fff04a', tam: 16 });
    }
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${this.flash * 0.7})`;
      g.fillRect(0, 0, LARGURA, ALTURA);
    }
  }
}
