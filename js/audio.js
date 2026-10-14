/**
 * audio.js — Chiptune 100% sintetizado com Web Audio API (nenhum arquivo de som).
 * O AudioContext só é criado após o primeiro gesto do usuário (política dos navegadores).
 */

class AudioMaluco {
  constructor() {
    this.ctx = null;
    this.mestre = null;
    this.volume = 0.6;
    this.mudo = false;
    this._ruido = null;
    this._musica = null;
  }

  /** Cria/retoma o contexto. Chamar dentro de um gesto (toque, clique, tecla). */
  desbloquear() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.mestre = this.ctx.createGain();
        this.mestre.connect(this.ctx.destination);
        this._aplicarVolume();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) {
      console.warn('[audio] indisponível', e);
    }
  }

  get pronto() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  definirVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0));
    this._aplicarVolume();
  }

  definirMudo(m) {
    this.mudo = !!m;
    this._aplicarVolume();
  }

  _aplicarVolume() {
    if (!this.mestre) return;
    const alvo = this.mudo ? 0 : this.volume * 0.5;
    this.mestre.gain.setTargetAtTime(alvo, this.ctx.currentTime, 0.02);
  }

  /** Toca uma nota com envelope simples. */
  nota(freq, dur = 0.1, { tipo = 'square', vol = 0.3, quando = 0, ate = null, destino = null } = {}) {
    if (!this.pronto) return;
    const t0 = this.ctx.currentTime + quando;
    const osc = this.ctx.createOscillator();
    const ganho = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t0);
    if (ate) osc.frequency.exponentialRampToValueAtTime(Math.max(20, ate), t0 + dur);
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(ganho).connect(destino || this.mestre);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Ruído branco (explosões, pisões). */
  ruido(dur = 0.2, { vol = 0.3, quando = 0, filtro = 2000 } = {}) {
    if (!this.pronto) return;
    if (!this._ruido) {
      const tam = this.ctx.sampleRate;
      this._ruido = this.ctx.createBuffer(1, tam, tam);
      const d = this._ruido.getChannelData(0);
      for (let i = 0; i < tam; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = this.ctx.currentTime + quando;
    const fonte = this.ctx.createBufferSource();
    fonte.buffer = this._ruido;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filtro;
    const ganho = this.ctx.createGain();
    ganho.gain.setValueAtTime(vol, t0);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    fonte.connect(lp).connect(ganho).connect(this.mestre);
    fonte.start(t0);
    fonte.stop(t0 + dur + 0.02);
  }

  /** Efeitos sonoros nomeados. */
  tocar(nome) {
    if (!this.pronto || this.mudo) return;
    try {
      const n = (f, d, o) => this.nota(f, d, o);
      switch (nome) {
        case 'clique': n(660, 0.04, { vol: 0.12 }); break;
        case 'pulo': n(280, 0.14, { ate: 640, vol: 0.18 }); break;
        case 'moeda': n(988, 0.06, { vol: 0.2 }); n(1319, 0.22, { vol: 0.2, quando: 0.06 }); break;
        case 'pisar': n(220, 0.12, { ate: 70, vol: 0.3 }); this.ruido(0.08, { vol: 0.2, filtro: 900 }); break;
        case 'ops': n(300, 0.1, { tipo: 'triangle', ate: 150, vol: 0.25 }); break;
        case 'bloco':
          n(140, 0.08, { tipo: 'triangle', vol: 0.4 });
          [523, 659, 784, 1047].forEach((f, i) => n(f, 0.08, { vol: 0.15, quando: 0.05 + i * 0.04 }));
          break;
        case 'laser': n(1400, 0.22, { tipo: 'sawtooth', ate: 180, vol: 0.18 }); break;
        case 'estrela': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => n(f, 0.07, { vol: 0.15, quando: i * 0.045 })); break;
        case 'cano': [440, 330, 220, 110].forEach((f, i) => n(f, 0.09, { tipo: 'triangle', vol: 0.3, quando: i * 0.08 })); break;
        case 'roleta': n(1500, 0.025, { vol: 0.08 }); break;
        case 'jackpot': [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => n(f, 0.1, { vol: 0.2, quando: i * 0.08 })); break;
        case 'vitoria': {
          const mel = [523, 659, 784, 1047, 784, 1047];
          mel.forEach((f, i) => n(f, 0.12, { vol: 0.2, quando: i * 0.09 }));
          n(262, 0.5, { tipo: 'triangle', vol: 0.3, quando: 0.45 });
          break;
        }
        case 'vitoria-curta': [659, 880, 1319].forEach((f, i) => n(f, 0.09, { vol: 0.18, quando: i * 0.06 })); break;
        case 'derrota': [392, 330, 262, 196].forEach((f, i) => n(f, 0.18, { tipo: 'triangle', vol: 0.3, quando: i * 0.15 })); break;
        case 'explosao': this.ruido(0.6, { vol: 0.5, filtro: 1200 }); n(90, 0.4, { ate: 30, vol: 0.4, tipo: 'triangle' }); break;
        case 'dragao': n(110, 0.7, { tipo: 'sawtooth', ate: 45, vol: 0.35 }); this.ruido(0.7, { vol: 0.25, filtro: 500 }); break;
        case 'nham': n(180, 0.08, { tipo: 'square', vol: 0.3 }); this.ruido(0.1, { vol: 0.3, filtro: 700, quando: 0.02 }); break;
        case 'soluco': n(400, 0.08, { ate: 900, vol: 0.2 }); break;
        case 'travar': n(880 + Math.random() * 120, 0.035, { vol: 0.12 }); break;
        case 'erro': n(160, 0.12, { vol: 0.25 }); n(120, 0.18, { vol: 0.25, quando: 0.13 }); break;
        case 'whoosh': this.ruido(0.35, { vol: 0.2, filtro: 3000 }); break;
        case 'nivel': [523, 523, 523, 659, 784, 1047].forEach((f, i) => n(f, 0.1, { vol: 0.2, quando: i * 0.1 })); break;
        default: break;
      }
    } catch (e) {
      console.warn('[audio] falha ao tocar', nome, e);
    }
  }

  /**
   * Musiquinha chiptune original em loop durante os minijogos.
   * Trilha ADAPTATIVA: a "energia" (combo atual) acelera o andamento, sobe a melodia
   * uma oitava a partir de combo 4 e liga um chimbal de ruído a partir de combo 2.
   */
  iniciarMusica(rapida = false) {
    this.pararMusica();
    if (!this.pronto) return;
    this._bpmBase = rapida ? 190 : 150;
    this._energia = 0;
    // Melodia original (pentatônica de Dó), 16 passos; 0 = pausa
    const melodia = [659, 0, 784, 659, 523, 0, 587, 659, 784, 0, 880, 784, 659, 587, 523, 0];
    const baixo = [131, 131, 196, 196, 175, 175, 196, 196];
    let indice = 0;
    let proximo = this.ctx.currentTime + 0.05;
    const agendar = () => {
      if (!this.ctx) return;
      while (proximo < this.ctx.currentTime + 0.12) {
        const energia = Math.min(this._energia, 8);
        const passo = 60 / (this._bpmBase + energia * 8) / 2; // colcheias
        const quando = proximo - this.ctx.currentTime;
        const m = melodia[indice % melodia.length];
        if (!this.mudo) {
          if (m) this.nota(m * (energia >= 4 ? 2 : 1), passo * 0.9, { vol: 0.06, quando });
          if (indice % 2 === 0) {
            const b = baixo[(indice / 2) % baixo.length];
            this.nota(b, passo * 1.8, { tipo: 'triangle', vol: 0.12, quando });
          }
          if (energia >= 2 && indice % 2 === 1) this.ruido(0.03, { vol: 0.06, quando, filtro: 9000 });
        }
        proximo += passo;
        indice++;
      }
    };
    this._musica = setInterval(agendar, 40);
    agendar();
  }

  /** Define a energia da trilha (normalmente o combo atual do jogador). */
  definirEnergia(n) {
    this._energia = Math.max(0, Math.floor(Number(n) || 0));
  }

  pararMusica() {
    if (this._musica) clearInterval(this._musica);
    this._musica = null;
  }
}

export const audio = new AudioMaluco();
