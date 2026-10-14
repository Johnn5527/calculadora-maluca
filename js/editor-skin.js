/**
 * editor-skin.js — Editor de skins em pixel art (12×12) com prévia animada e código de compartilhamento.
 *
 * Controles:
 *   - mouse/toque: clique e arraste para pintar (botão direito apaga)
 *   - teclado: setas movem o cursor, Espaço/Enter pinta, Delete apaga, 0–5 escolhem a cor
 */
import { spritesHeroi } from './games/game-base.js';
import {
  LARGURA_SKIN, ALTURA_SKIN, CORES_IDS, NOMES_CORES,
  skinBase, validarSkin, codificarSkin, decodificarSkin,
} from './skin-codigo.js';

const ESCALA = 20; // pixels de tela por pixel da skin
const TINTAS = ['.', ...CORES_IDS];

/**
 * @param {object} o
 * @param {HTMLDialogElement} o.dialogo
 * @param {() => object|null} o.carregar devolve a skin salva (ou null)
 * @param {(skin:object) => void} o.aoSalvar
 * @param {(msg:string) => void} o.avisar
 */
export function criarEditorSkin({ dialogo, carregar, aoSalvar, avisar }) {
  const tela = dialogo.querySelector('#editor-tela');
  const g = tela.getContext('2d');
  const previa = dialogo.querySelector('#editor-previa');
  const gp = previa.getContext('2d');
  const paletaEl = dialogo.querySelector('#editor-paleta');
  const campoCodigo = dialogo.querySelector('#editor-codigo');
  const status = dialogo.querySelector('#editor-status');

  tela.width = LARGURA_SKIN * ESCALA;
  tela.height = ALTURA_SKIN * ESCALA;

  let skin = skinBase();
  let grade = [];
  let tinta = 'B';
  let cursor = { x: 5, y: 5 };
  let pintando = null; // caractere sendo pintado durante o arraste
  let raf = 0;
  let controle = null;
  let quadrosPrevia = null;

  const paraGrade = (mapa) => mapa.map((l) => l.split(''));
  const paraMapa = () => grade.map((l) => l.join(''));
  const skinAtual = () => ({ mapa: paraMapa(), paleta: { ...skin.paleta } });

  /* ---------- paleta ---------- */
  function montarPaleta() {
    paletaEl.textContent = '';
    TINTAS.forEach((id, i) => {
      const item = document.createElement('div');
      item.className = 'ed-cor';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ed-tinta';
      btn.dataset.tinta = id;
      btn.setAttribute('aria-pressed', String(id === tinta));
      btn.setAttribute('aria-label', `Pincel ${NOMES_CORES[id]} (tecla ${i})`);
      btn.title = `${NOMES_CORES[id]} (${i})`;
      btn.style.background = id === '.' ? '' : skin.paleta[id];
      if (id === '.') btn.classList.add('transparente');
      btn.textContent = String(i);
      btn.addEventListener('click', () => escolherTinta(id), { signal: controle.signal });
      item.appendChild(btn);

      if (id !== '.') {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = skin.paleta[id];
        input.setAttribute('aria-label', `Cor de ${NOMES_CORES[id]}`);
        input.addEventListener('input', () => {
          skin.paleta[id] = input.value;
          btn.style.background = input.value;
          desenhar();
        }, { signal: controle.signal });
        item.appendChild(input);
      }
      paletaEl.appendChild(item);
    });
  }

  function escolherTinta(id) {
    tinta = id;
    for (const b of paletaEl.querySelectorAll('.ed-tinta')) b.setAttribute('aria-pressed', String(b.dataset.tinta === id));
    status.textContent = `Pincel: ${NOMES_CORES[id]}`;
  }

  /* ---------- desenho ---------- */
  function desenhar() {
    quadrosPrevia = null;
    g.clearRect(0, 0, tela.width, tela.height);
    for (let y = 0; y < ALTURA_SKIN; y++) {
      for (let x = 0; x < LARGURA_SKIN; x++) {
        const ch = grade[y][x];
        if (ch === '.') {
          // xadrez indica transparência
          g.fillStyle = (x + y) % 2 ? '#2a2540' : '#352f50';
        } else {
          g.fillStyle = skin.paleta[ch];
        }
        g.fillRect(x * ESCALA, y * ESCALA, ESCALA, ESCALA);
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 1;
    for (let i = 1; i < LARGURA_SKIN; i++) {
      g.beginPath(); g.moveTo(i * ESCALA + 0.5, 0); g.lineTo(i * ESCALA + 0.5, tela.height); g.stroke();
    }
    for (let i = 1; i < ALTURA_SKIN; i++) {
      g.beginPath(); g.moveTo(0, i * ESCALA + 0.5); g.lineTo(tela.width, i * ESCALA + 0.5); g.stroke();
    }
    if (document.activeElement === tela) {
      g.strokeStyle = '#ffe600';
      g.lineWidth = 3;
      g.strokeRect(cursor.x * ESCALA + 1.5, cursor.y * ESCALA + 1.5, ESCALA - 3, ESCALA - 3);
    }
  }

  function pintar(x, y, ch) {
    if (x < 0 || y < 0 || x >= LARGURA_SKIN || y >= ALTURA_SKIN) return;
    if (grade[y][x] === ch) return;
    grade[y][x] = ch;
    desenhar();
  }

  /* ---------- prévia animada (rAF só enquanto o diálogo está aberto) ---------- */
  function animarPrevia(t) {
    if (!quadrosPrevia) quadrosPrevia = spritesHeroi('custom', skinAtual());
    const quadros = quadrosPrevia;
    const fase = Math.floor(t / 1000 * 3) % 4;
    const spr = fase === 3 ? quadros.pulo : fase % 2 ? quadros.andarB : quadros.andarA;
    const pulo = fase === 3 ? -6 : 0;
    gp.imageSmoothingEnabled = false;
    gp.fillStyle = '#5c94fc';
    gp.fillRect(0, 0, previa.width, previa.height);
    gp.fillStyle = '#8a4b22';
    gp.fillRect(0, previa.height - 12, previa.width, 12);
    const esc = 4;
    const x = (previa.width - spr.width * esc) / 2;
    const y = previa.height - 12 - spr.height * esc + pulo * esc;
    gp.drawImage(spr, Math.round(x), Math.round(y), spr.width * esc, spr.height * esc);
    raf = requestAnimationFrame(animarPrevia);
  }

  /* ---------- entrada ---------- */
  function celulaDoEvento(e) {
    const r = tela.getBoundingClientRect();
    return {
      x: Math.floor(((e.clientX - r.left) / r.width) * LARGURA_SKIN),
      y: Math.floor(((e.clientY - r.top) / r.height) * ALTURA_SKIN),
    };
  }

  function ligarEventos() {
    const signal = controle.signal;
    tela.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      tela.setPointerCapture(e.pointerId);
      pintando = e.button === 2 ? '.' : tinta;
      const c = celulaDoEvento(e);
      cursor = c;
      pintar(c.x, c.y, pintando);
    }, { signal });
    tela.addEventListener('pointermove', (e) => {
      if (pintando === null) return;
      const c = celulaDoEvento(e);
      pintar(c.x, c.y, pintando);
    }, { signal });
    const parar = () => { pintando = null; };
    tela.addEventListener('pointerup', parar, { signal });
    tela.addEventListener('pointercancel', parar, { signal });
    tela.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    tela.addEventListener('focus', desenhar, { signal });
    tela.addEventListener('blur', desenhar, { signal });

    tela.addEventListener('keydown', (e) => {
      const mov = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (mov) {
        cursor.x = Math.max(0, Math.min(LARGURA_SKIN - 1, cursor.x + mov[0]));
        cursor.y = Math.max(0, Math.min(ALTURA_SKIN - 1, cursor.y + mov[1]));
        desenhar();
      } else if (e.key === ' ' || e.key === 'Enter') {
        pintar(cursor.x, cursor.y, tinta);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        pintar(cursor.x, cursor.y, '.');
      } else if (/^[0-5]$/.test(e.key)) {
        escolherTinta(TINTAS[Number(e.key)]);
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }, { signal });

    const acao = (id, fn) => dialogo.querySelector(id).addEventListener('click', fn, { signal });
    acao('#editor-limpar', () => {
      grade = paraGrade(skinBase().mapa);
      skin = skinBase();
      montarPaleta();
      desenhar();
      status.textContent = 'Voltou ao Teclito clássico.';
    });
    acao('#editor-espelhar', () => {
      grade = grade.map((l) => [...l].reverse());
      desenhar();
      status.textContent = 'Espelhado!';
    });
    acao('#editor-copiar', async () => {
      const codigo = codificarSkin(skinAtual());
      campoCodigo.value = codigo;
      try {
        await navigator.clipboard.writeText(codigo);
        status.textContent = 'Código copiado! Mande para um amigo.';
      } catch {
        campoCodigo.select();
        status.textContent = 'Copie o código do campo abaixo.';
      }
    });
    acao('#editor-importar', () => {
      try {
        const nova = decodificarSkin(campoCodigo.value);
        skin = { mapa: nova.mapa, paleta: { ...nova.paleta } };
        grade = paraGrade(nova.mapa);
        montarPaleta();
        desenhar();
        status.textContent = 'Skin importada! Clique em SALVAR para usar.';
      } catch (err) {
        status.textContent = err.message;
      }
    });
    acao('#editor-salvar', () => {
      const final = skinAtual();
      if (!validarSkin(final)) {
        status.textContent = 'Skin inválida.';
        return;
      }
      avisar('🎨 Skin salva e equipada!');
      aoSalvar(final);
      dialogo.close();
    });

    dialogo.addEventListener('close', fechar, { signal, once: true });
  }

  /* ---------- ciclo de vida ---------- */
  function abrir() {
    if (dialogo.open) return;
    const salva = carregar();
    skin = salva ? { mapa: [...salva.mapa], paleta: { ...salva.paleta } } : skinBase();
    grade = paraGrade(skin.mapa);
    campoCodigo.value = salva ? codificarSkin(salva) : '';
    status.textContent = 'Pinte o Teclito! Setas + Espaço também funcionam.';
    controle = new AbortController();
    montarPaleta();
    escolherTinta(tinta);
    ligarEventos();
    desenhar();
    dialogo.showModal();
    raf = requestAnimationFrame(animarPrevia);
  }

  function fechar() {
    cancelAnimationFrame(raf);
    raf = 0;
    pintando = null;
    controle?.abort();
    controle = null;
  }

  return { abrir };
}
