/**
 * reveal.js — A revelação exagerada do resultado.
 * Sequência: hit-stop + zoom + flash -> odômetro travando dígito a dígito -> efeito temático
 * -> estrelas e rank carimbado -> espera o jogador continuar.
 * O número exibido é SEMPRE o texto calculado pelo engine.
 */
import { rodarOdometro } from './odometer.js';
import { efeitos } from './confetti.js';
import { tremer, flash, esperar, prefereMovimentoReduzido, vibrar, multiplicadorDeTempo } from './shake.js';

/** Escolhe a revelação temática conforme a faixa do resultado. */
export function temaDaRevelacao(valor, anterior) {
  if (anterior !== null && anterior !== undefined && valor === anterior) return 'glitch';
  if (valor === 0) return 'buraco';
  if (valor === 42) return 'v42';
  if (valor === 69) return 'v69';
  if (valor === 100) return 'v100';
  if (valor === 1337) return 'v1337';
  if (Math.abs(valor) >= 1e6) return 'foguete';
  if (valor < 0) return 'chuva';
  if (!Number.isInteger(valor)) return 'pizza';
  return 'padrao';
}

const TEMAS = {
  padrao: { emoji: '🎉', titulo: 'RESULTADO!', legenda: 'Conta resolvida com estilo.', som: 'vitoria', efeito: (e) => { e.confete(120); e.fogos(2); } },
  chuva: { emoji: '🌧️', titulo: 'NO VERMELHO...', legenda: 'Número negativo! Leve um guarda-chuva.', som: 'derrota', efeito: (e) => e.chuva(1800) },
  buraco: { emoji: '🕳️', titulo: 'O VAZIO!', legenda: 'Zero. Até a luz foi sugada.', som: 'whoosh', efeito: (e) => e.buracoNegro(1600) },
  v42: { emoji: '🌌', titulo: 'A RESPOSTA!', legenda: 'Para a vida, o universo e tudo mais.', som: 'vitoria', efeito: (e) => { e.fogos(4); e.confete(80); } },
  v69: { emoji: '😎', titulo: 'NICE.', legenda: 'Nice. Muito nice.', som: 'vitoria', efeito: (e) => e.emojis('😎', 18) },
  v100: { emoji: '🪙', titulo: 'CEM MOEDAS!', legenda: 'Explosão de moedas! 1UP matemático.', som: 'moeda', efeito: (e) => e.moedas(100) },
  v1337: { emoji: '💾', titulo: 'L33T H4CK3R', legenda: 'Você hackeou a calculadora. Ou não.', som: 'estrela', efeito: (e) => e.emojis(['1', '0', '1', '3', '3', '7'], 60, '#2bd66b') },
  foguete: { emoji: '🚀', titulo: 'NÚMERO ESPACIAL!', legenda: 'Esse número saiu da órbita.', som: 'explosao', efeito: (e) => { e.foguete(); e.fogos(4); } },
  pizza: { emoji: '🍕', titulo: 'FATIAS DECIMAIS!', legenda: 'Resultado quebrado em fatias.', som: 'vitoria', efeito: (e) => e.emojis('🍕', 22) },
  glitch: { emoji: '👾', titulo: 'DÉJÀ VU?!', legenda: 'Mesmo resultado da conta anterior. Bugou tudo!', som: 'erro', efeito: (e) => e.emojis('👾', 14) },
  dragao: { emoji: '🐉', titulo: 'DEVORADO!', legenda: '', som: 'dragao', efeito: (e) => e.emojis(['🔥', '🐉'], 20) },
};

const FATOR_INTENSIDADE = { chill: 0.4, maluco: 1, caos: 1.6 };

/**
 * @param {object} o
 * @param {string} o.texto        texto final (engine)
 * @param {number|null} o.valor
 * @param {number|null} o.anterior resultado anterior (para o glitch)
 * @param {'chill'|'maluco'|'caos'} o.intensidade
 * @param {{rank:string, estrelas:number, pontos:number, xp:number}} o.avaliacao
 * @param {object} o.stats
 * @param {string} [o.mensagemDragao]
 * @param {{subiu:boolean, nivelDepois:number, desbloqueios:string[]}} [o.nivel]
 * @param {(nome:string)=>void} o.sfx
 * @param {HTMLElement} o.alvoTremor elemento que treme (o app)
 * @param {(() => void)|null} [o.aoComo] abre o passo a passo (modo professor)
 * @param {string} [o.tituloExtra] substitui o título (ex.: "DESAFIO DIÁRIO!")
 */
export async function revelar(o) {
  const raiz = document.getElementById('revelacao');
  const cartao = raiz.querySelector('.rev-cartao');
  const elTitulo = document.getElementById('rev-titulo');
  const elEmoji = document.getElementById('rev-emoji');
  const elOdo = document.getElementById('rev-odometro');
  const elLegenda = document.getElementById('rev-legenda');
  const elEstrelas = document.getElementById('rev-estrelas');
  const elRank = document.getElementById('rev-rank');
  const elInfo = document.getElementById('rev-info');
  const btn = document.getElementById('rev-continuar');
  const btnComo = document.getElementById('rev-como');

  const reduzido = prefereMovimentoReduzido();
  const intensidade = reduzido ? 'chill' : o.intensidade;
  const fator = FATOR_INTENSIDADE[intensidade] ?? 1;
  efeitos.definirIntensidade(fator);

  const chave = o.mensagemDragao ? 'dragao' : temaDaRevelacao(o.valor, o.anterior);
  const tema = TEMAS[chave];

  // estado inicial
  raiz.className = `revelacao tema-${chave} int-${intensidade}`;
  raiz.hidden = false;
  elTitulo.textContent = o.tituloExtra || tema.titulo;
  elEmoji.textContent = tema.emoji;
  elLegenda.textContent = o.mensagemDragao || tema.legenda;
  elLegenda.classList.remove('visivel');
  elEstrelas.innerHTML = '';
  elRank.textContent = '';
  elRank.className = 'rev-rank';
  elInfo.textContent = '';
  btn.hidden = true;
  btnComo.hidden = true;
  elOdo.classList.toggle('glitch', chave === 'glitch');

  const controle = new AbortController();
  let odometro = null;
  let fase = 'animando';
  let fechar;
  const fechou = new Promise((r) => { fechar = r; });

  // Toque/tecla durante a animação = acelera; depois = fecha.
  // (ignora os primeiros instantes para o mesmo toque do "=" não fechar a revelação)
  const aberturaEm = performance.now();
  const interagir = (e) => {
    if (performance.now() - aberturaEm < 200) return;
    // o passo a passo abre um diálogo por cima: não fecha a revelação por baixo dele
    if (document.querySelector('dialog[open]') || e.target?.closest?.('#rev-como')) return;
    if (e.type === 'keydown' && !['Enter', ' ', 'Escape', 'Spacebar'].includes(e.key)) return;
    e.preventDefault();
    if (fase === 'animando') {
      fase = 'pressa';
      odometro?.finalizar();
    } else if (fase === 'pronto') {
      fechar();
    }
  };
  raiz.addEventListener('pointerdown', interagir, { signal: controle.signal });
  window.addEventListener('keydown', interagir, { signal: controle.signal });

  const pressa = () => fase === 'pressa';

  try {
    // 1) Hit-stop + zoom + flash
    if (intensidade === 'caos') document.body.classList.add('caos');
    if (!reduzido && intensidade !== 'chill') flash(chave === 'buraco' ? '#000000' : '#ffffff', 200);
    if (!reduzido) tremer(o.alvoTremor, { forca: 6 * fator, duracao: 350, girar: intensidade === 'caos' });
    o.sfx('explosao');
    await esperar(reduzido || pressa() ? 0 : 260);

    // 2) Odômetro
    odometro = rodarOdometro(elOdo, o.texto, {
      aoTravar: () => {
        o.sfx('travar');
        vibrar(8);
        if (intensidade === 'caos') tremer(cartao, { forca: 5, duracao: 120 });
      },
    });
    if (fase === 'pressa') odometro.finalizar();
    await odometro.promessa;

    // 3) Efeito temático
    o.sfx(tema.som);
    vibrar([30, 40, 80]);
    tema.efeito(efeitos);
    elLegenda.classList.add('visivel');
    if (!reduzido && intensidade !== 'chill') tremer(cartao, { forca: 10 * fator, duracao: 400, girar: intensidade === 'caos' });

    // 4) Estrelas, uma a uma
    const av = o.avaliacao;
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'estrela' + (i < av.estrelas ? ' cheia' : '');
      s.textContent = '★';
      s.setAttribute('aria-hidden', 'true');
      elEstrelas.appendChild(s);
      if (i < av.estrelas) {
        o.sfx('moeda');
        await esperar(reduzido || pressa() ? 0 : 160);
      }
    }
    elEstrelas.setAttribute('aria-label', `${av.estrelas} de 3 estrelas`);

    // 5) Rank carimbado
    elRank.textContent = av.rank;
    elRank.classList.add('carimbo', `rank-${av.rank}`);
    if (av.rank === 'S' && !reduzido) efeitos.fogos(3);
    o.sfx(av.rank === 'S' || av.rank === 'A' ? 'jackpot' : 'bloco');

    const partes = [`${av.pontos} PTS`, `+${av.xp} XP`];
    if (o.stats.comboMax > 1) partes.unshift(`COMBO x${o.stats.comboMax}`);
    if (o.stats.auto) partes.push('AUTO');
    if (o.stats.pulou) partes.push('PULOU');
    elInfo.textContent = partes.join(' · ');

    if (o.nivel?.subiu) {
      await esperar(reduzido ? 0 : 250);
      const nv = document.createElement('div');
      nv.className = 'rev-nivel';
      nv.textContent = `NÍVEL ${o.nivel.nivelDepois}!` + (o.nivel.desbloqueios.length ? ` 🔓 ${o.nivel.desbloqueios.join(', ')}` : '');
      elInfo.appendChild(nv);
      o.sfx('nivel');
      efeitos.confete(60);
    }

    fase = 'pronto';
    btn.hidden = false;
    btn.focus({ preventScroll: true });
    btn.addEventListener('click', () => fechar(), { signal: controle.signal });
    if (o.aoComo) {
      btnComo.hidden = false;
      btnComo.addEventListener('click', () => o.aoComo(), { signal: controle.signal });
    }

    // auto-fecha depois de um tempo para nunca "prender" o usuário (exceto lendo o passo a passo)
    const timer = setInterval(() => {
      if (!document.querySelector('dialog[open]') && performance.now() - aberturaEm > 18000 * Math.max(1, multiplicadorDeTempo())) fechar();
    }, 1000);
    await fechou;
    clearInterval(timer);
  } finally {
    controle.abort();
    odometro?.finalizar();
    document.body.classList.remove('caos');
    btnComo.hidden = true;
    raiz.hidden = true;
    raiz.className = 'revelacao';
  }
}
