/**
 * ui.js — Tudo que toca o DOM da calculadora: visor, HUD do jogo, painéis
 * (histórico, ranking, configurações), barra de XP, toasts e anúncios para leitores de tela.
 */
import { formatar, arredondar } from './math/engine.js';
import { nivelDoXp, progressoNoNivel, SKINS, TEMAS, skinLiberada } from './progresso.js';
import { VELOCIDADES, OPCOES_RELAMPAGO, CONJUNTOS_TECLAS, FONTES, PERFIS, teclasBloqueadas } from './perfis.js';
import { missaoPorId, sequenciaAtual, proximosPremios, XP_BAU_DIARIO } from './missoes.js';
import { diaAnterior } from './diario.js';
import { CONQUISTAS, progressoConquista } from './conquistas.js';
import { descreverPassos, ORDEM_DAS_OPERACOES } from './professor.js';

const $ = (sel) => document.querySelector(sel);

export const el = {
  app: $('#app'),
  calculadora: $('#calculadora'),
  visor: $('#visor'),
  expressao: $('#visor-expressao'),
  resultado: $('#visor-resultado'),
  bonus: $('#visor-bonus'),
  teclado: $('#teclado'),
  igual: $('[data-tecla="="]'),
  nivelTexto: $('#nivel-texto'),
  barraXp: $('#barra-xp'),
  barraXpFill: $('#barra-xp-fill'),
  btnSom: $('#btn-som'),
  btnHistorico: $('#btn-historico'),
  btnRanking: $('#btn-ranking'),
  btnConfig: $('#btn-config'),
  btnDiario: $('#btn-diario'),
  btnConquistas: $('#btn-conquistas'),
  btnEditor: $('#btn-editor'),
  btnPassos: $('#btn-passos'),
  rodapeModo: $('#rodape-modo'),
  // jogo
  jogo: $('#jogo'),
  canvas: $('#jogo-canvas'),
  jogoTitulo: $('#jogo-titulo'),
  jogoFase: $('#jogo-fase'),
  jogoConta: $('#jogo-conta'),
  jogoContador: $('#jogo-contador'),
  jogoTempo: $('#jogo-tempo-fill'),
  jogoDica: $('#jogo-dica'),
  btnAuto: $('#btn-auto'),
  btnPular: $('#btn-pular'),
  // painéis
  dlgHistorico: $('#dlg-historico'),
  listaHistorico: $('#lista-historico'),
  btnLimparHistorico: $('#btn-limpar-historico'),
  dlgRanking: $('#dlg-ranking'),
  listaRanking: $('#lista-ranking'),
  blocoRankingAntigo: $('#bloco-ranking-antigo'),
  listaRankingAntigo: $('#lista-ranking-antigo'),
  abasRanking: $('#abas-ranking'),
  painelRankingLocal: $('#painel-ranking-local'),
  painelRankingOnline: $('#painel-ranking-online'),
  rankingOnlineInfo: $('#ranking-online-info'),
  listaRankingOnline: $('#lista-ranking-online'),
  rankingVoce: $('#ranking-voce'),
  dlgConfig: $('#dlg-config'),
  formConfig: $('#form-config'),
  btnConfigEditor: $('#btn-config-editor'),
  configResponsavel: $('#config-responsavel'),
  btnApagarOnline: $('#btn-apagar-online'),
  dlgResponsavel: $('#dlg-responsavel'),
  formResponsavel: $('#form-responsavel'),
  responsavelDesafio: $('#responsavel-desafio'),
  responsavelErro: $('#responsavel-erro'),
  btnResponsavelNao: $('#btn-responsavel-nao'),
  dlgDiario: $('#dlg-diario'),
  diarioData: $('#diario-data'),
  diarioConta: $('#diario-conta'),
  diarioStatus: $('#diario-status'),
  diarioLista: $('#diario-lista'),
  btnJogarDiario: $('#btn-jogar-diario'),
  dlgConquistas: $('#dlg-conquistas'),
  conquistasResumo: $('#conquistas-resumo'),
  listaConquistas: $('#lista-conquistas'),
  dlgPassos: $('#dlg-passos'),
  passosConta: $('#passos-conta'),
  listaPassos: $('#lista-passos'),
  passosResultado: $('#passos-resultado'),
  passosOrdem: $('#passos-ordem'),
  dlgEditor: $('#dlg-editor'),
  dlgPerfil: $('#dlg-perfil'),
  listaPerfis: $('#lista-perfis'),
  perfilAtual: $('#perfil-atual'),
  btnTrocarPerfil: $('#btn-trocar-perfil'),
  listaMissoes: $('#lista-missoes'),
  bauMissoes: $('#bau-missoes'),
  streakDias: $('#streak-dias'),
  streakMetas: $('#streak-metas'),
  streakCalendario: $('#streak-calendario'),
  fxCanvas: $('#fx-canvas'),
  anuncio: $('#anuncio'),
  toast: $('#toast'),
};

/* ---------------- Visor ---------------- */

export function mostrarExpressao(expr) {
  el.expressao.textContent = expr || '\u00a0';
}

export function mostrarResultado(texto, { erro = false } = {}) {
  el.resultado.textContent = texto;
  el.resultado.classList.toggle('erro', erro);
  const len = texto.length;
  el.resultado.style.setProperty('--len', String(Math.max(8, len)));
}

export function mostrarBonus(texto) {
  el.bonus.textContent = texto || '';
}

/** Mensagem para leitores de tela. */
export function anunciar(msg) {
  el.anuncio.textContent = '';
  // pequeno atraso garante que a mudança seja percebida
  setTimeout(() => { el.anuncio.textContent = msg; }, 50);
}

let timerToast = 0;
export function toast(msg, ms = 2600) {
  clearTimeout(timerToast);
  el.toast.textContent = msg;
  el.toast.classList.add('visivel');
  timerToast = setTimeout(() => el.toast.classList.remove('visivel'), ms);
}

/** Efeito squash & stretch na tecla apertada. */
export function animarTecla(botao) {
  if (!botao) return;
  botao.classList.remove('apertou');
  void botao.offsetWidth; // reinicia a animação
  botao.classList.add('apertou');
}

/* ---------------- Progresso ---------------- */

export function atualizarNivel(progresso) {
  const nivel = nivelDoXp(progresso.xp);
  const pct = Math.round(progressoNoNivel(progresso.xp) * 100);
  el.nivelTexto.textContent = `NV ${nivel}`;
  el.barraXpFill.style.width = `${pct}%`;
  el.barraXp.setAttribute('aria-valuenow', String(pct));
  el.barraXp.setAttribute('aria-valuetext', `Nível ${nivel}, ${pct}% para o próximo (${progresso.xp} XP)`);
}

export function aplicarTema(tema) {
  document.body.dataset.tema = tema;
}

export function atualizarBotaoSom(mudo) {
  el.btnSom.textContent = mudo ? '🔇' : '🔊';
  el.btnSom.setAttribute('aria-pressed', String(mudo));
  el.btnSom.setAttribute('aria-label', mudo ? 'Som desligado (ativar)' : 'Som ligado (silenciar)');
}

export function atualizarRodape(cfg) {
  const nomes = { chill: 'CHILL', maluco: 'MALUCO', caos: 'CAOS TOTAL' };
  el.rodapeModo.textContent = `${nomes[cfg.intensidade] || 'MALUCO'}${cfg.jogosLigados ? '' : ' · DIRETO'}${cfg.autoPlay ? ' · AUTO' : ''}`;
}

/* ---------------- HUD do minijogo ---------------- */

const SIMBOLO_OP = { add: '+', sub: '−', mul: '×', div: '÷', pow: '^' };

/** Texto curto da conta da fase (ex.: "12 + 30"). */
export function textoDaFase(f) {
  const fm = (x) => (Number.isFinite(x) ? formatar(x) : '?');
  switch (f.op) {
    case 'sqrt': return `√${fm(f.a)}`;
    case 'pct': return f.b === null || f.b === undefined ? `${fm(f.a)}%` : `${fm(f.a)} ± ${fm(f.b)}%`;
    case 'divzero': return '? ÷ 0';
    case 'chefe': return `CONTA GIGANTE · ${f.passos ?? '?'} OPERAÇÕES`;
    default: return `${fm(f.a)} ${SIMBOLO_OP[f.op] || '?'} ${fm(f.b)}`;
  }
}

export function hudFase({ indice, total, titulo, dica, fase }) {
  el.jogoTitulo.textContent = titulo;
  el.jogoFase.textContent = total > 1 ? `FASE ${indice + 1}/${total}` : '';
  el.jogoConta.textContent = textoDaFase(fase);
  el.jogoDica.textContent = dica;
  el.jogoDica.classList.remove('some');
  void el.jogoDica.offsetWidth;
  el.jogoDica.classList.add('some');
}

let ultimoContador = '';
let ultimaLargura = '';
export function hud({ contador, progresso }) {
  const txt = Number.isFinite(contador) ? formatar(arredondar(contador, 8)) : '∞?!';
  if (txt !== ultimoContador) {
    el.jogoContador.textContent = txt;
    ultimoContador = txt;
  }
  const w = `${Math.round((1 - progresso) * 100)}%`;
  if (w !== ultimaLargura) {
    el.jogoTempo.style.width = w;
    ultimaLargura = w;
  }
}

export function botaoAuto(ligado) {
  el.btnAuto.setAttribute('aria-pressed', String(ligado));
  el.btnAuto.classList.toggle('ligado', ligado);
}

/* ---------------- Histórico ---------------- */

/**
 * @param {object[]} lista
 * @param {{usarResultado:(h)=>void, usarConta:(h)=>void, apagar:(h)=>void}} acoes
 */
export function renderHistorico(lista, acoes) {
  el.listaHistorico.textContent = '';
  if (!lista.length) {
    const li = document.createElement('li');
    li.className = 'vazio';
    li.textContent = 'Nenhuma conta ainda. Aperte "=" e se divirta!';
    el.listaHistorico.appendChild(li);
    el.btnLimparHistorico.disabled = true;
    return;
  }
  el.btnLimparHistorico.disabled = false;
  for (const h of lista) {
    const li = document.createElement('li');
    const conta = document.createElement('div');
    conta.className = 'hist-conta';
    conta.textContent = `${h.expressao} =`;
    const res = document.createElement('div');
    res.className = 'hist-resultado';
    res.textContent = h.resultado;
    const meta = document.createElement('div');
    meta.className = 'hist-meta';
    meta.textContent = h.rank ? `RANK ${h.rank} · ${'★'.repeat(h.estrelas || 0)}` : '';
    const botoes = document.createElement('div');
    botoes.className = 'hist-botoes';
    botoes.append(
      botaoPequeno('USAR', `Usar o resultado ${h.resultado}`, () => acoes.usarResultado(h)),
      botaoPequeno('CONTA', `Reutilizar a conta ${h.expressao}`, () => acoes.usarConta(h)),
      botaoPequeno('🗑', `Apagar ${h.expressao}`, () => acoes.apagar(h)),
    );
    li.append(conta, res, meta, botoes);
    el.listaHistorico.appendChild(li);
  }
}

function botaoPequeno(texto, rotulo, aoClicar) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-mini';
  b.textContent = texto;
  b.setAttribute('aria-label', rotulo);
  b.addEventListener('click', aoClicar);
  return b;
}

/* ---------------- Ranking ---------------- */

export function renderRanking(alvo, lista, vazio = 'Sem pontuações ainda.') {
  alvo.textContent = '';
  if (!lista || !lista.length) {
    const li = document.createElement('li');
    li.className = 'vazio';
    li.textContent = vazio;
    alvo.appendChild(li);
    return;
  }
  lista.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.eu) li.classList.add('rk-eu');
    const pos = document.createElement('span');
    pos.className = 'rk-pos';
    pos.textContent = `${r.posicao ?? i + 1}º`;
    const nome = document.createElement('span');
    nome.className = 'rk-nome';
    nome.textContent = r.nome ?? `${r.apelido}#${r.tag}`;
    if (r.eu) nome.textContent += ' (você)';
    const pts = document.createElement('span');
    pts.className = 'rk-pts';
    pts.textContent = `${r.pontos}`;
    const rank = document.createElement('span');
    rank.className = `rk-rank rank-${r.rank}`;
    rank.textContent = r.rank;
    li.append(pos, nome, rank, pts);
    alvo.appendChild(li);
  });
}

const INFO_PERIODO = {
  global: 'Melhor partida de cada jogador, de todos os tempos.',
  semana: 'Melhor partida de cada jogador desde segunda-feira.',
  dia: 'Desafio diário de hoje: vale a melhor tentativa.',
};

/** Marca a aba escolhida e mostra o painel certo. */
export function selecionarAbaRanking(aba) {
  for (const b of el.abasRanking.querySelectorAll('[role="tab"]')) {
    const ativa = b.dataset.aba === aba;
    b.setAttribute('aria-selected', String(ativa));
    b.tabIndex = ativa ? 0 : -1;
  }
  el.painelRankingLocal.hidden = aba !== 'local';
  el.painelRankingOnline.hidden = aba === 'local';
  if (aba !== 'local') el.painelRankingOnline.setAttribute('aria-labelledby', `aba-ranking-${aba}`);
}

/**
 * Ranking online: carregando, desligado, offline ou a lista com "você".
 * @param {'global'|'semana'|'dia'} periodo
 * @param {object|null} dados  resposta de api.buscarRanking (null = carregando)
 */
export function renderRankingOnline(periodo, dados) {
  const voce = el.rankingVoce;
  voce.hidden = true;
  if (!dados) {
    el.rankingOnlineInfo.textContent = INFO_PERIODO[periodo];
    renderRanking(el.listaRankingOnline, [], 'Carregando…');
    return;
  }
  if (dados.desligado) {
    el.rankingOnlineInfo.textContent = 'O ranking online está desligado neste aparelho.';
    renderRanking(el.listaRankingOnline, [], 'Ligue em ⚙️ → Servidor → "Enviar partidas para o ranking online".');
    return;
  }
  if (dados.erro) {
    el.rankingOnlineInfo.textContent = INFO_PERIODO[periodo];
    renderRanking(el.listaRankingOnline, [], 'Servidor fora do ar. Seus pontos continuam salvos aqui no aparelho.');
    return;
  }
  el.rankingOnlineInfo.textContent = INFO_PERIODO[periodo];
  renderRanking(el.listaRankingOnline, dados.top, periodo === 'dia' ? 'Ninguém jogou o desafio de hoje ainda. Seja o primeiro!' : 'Sem pontuações ainda.');

  const v = dados.voce;
  if (!v || dados.top.some((t) => t.eu)) return;
  voce.hidden = false;
  if (!v.publico) {
    voce.textContent = `${v.apelido}#${v.tag}: seu ranking público está desligado${v.pontos != null ? ` (seu melhor: ${v.pontos} PTS)` : ''}.`;
  } else if (v.pontos == null) {
    voce.textContent = periodo === 'dia' ? 'Você ainda não jogou o desafio de hoje.' : 'Você ainda não pontuou neste período.';
  } else {
    voce.textContent = `Você (${v.apelido}#${v.tag}): ${v.posicao}º · RANK ${v.rank} · ${v.pontos} PTS`;
  }
}

/* ---------------- Configurações ---------------- */

const CAMPOS_CHECK = ['mudo', 'vibracao', 'autoPlay', 'jogosLigados', 'backendAtivo',
  'contraste', 'semDerrota', 'professorAuto', 'semEfeitos', 'botoesGrandes', 'chefaoLivre'];

/**
 * @param {object} cfg
 * @param {{nivel:number, temSkinPersonalizada:boolean, premios:string[]}} contexto
 */
export function preencherConfig(cfg, { nivel, temSkinPersonalizada = false, premios = [] }) {
  const f = el.formConfig;
  f.nome.value = cfg.nome;
  for (const r of f.querySelectorAll('input[name="intensidade"]')) r.checked = r.value === cfg.intensidade;
  preencherOpcoes(f.tema, TEMAS.map((t) => ({
    id: t.id, rotulo: t.nivel > nivel ? `🔒 ${t.nome} (NV ${t.nivel})` : t.nome, bloqueado: t.nivel > nivel,
  })), cfg.tema);
  preencherOpcoes(f.skin, SKINS.map((s) => {
    const livre = skinLiberada(s, { nivel, premios, temSkinPersonalizada });
    let rotulo = s.nome;
    if (!livre) rotulo = s.personalizada ? `🎨 ${s.nome} — crie no editor` : s.premio ? `🔥 ${s.nome} (${s.requisito})` : `🔒 ${s.nome} (NV ${s.nivel})`;
    return { id: s.id, rotulo, bloqueado: !livre };
  }), cfg.skin);
  preencherOpcoes(f.velocidade, VELOCIDADES.map((v) => ({ id: v.id, rotulo: v.nome })), cfg.velocidade);
  preencherOpcoes(f.relampago, OPCOES_RELAMPAGO.map((o) => ({ id: o.id, rotulo: o.nome })), cfg.relampago);
  preencherOpcoes(f.teclas, CONJUNTOS_TECLAS.map((c) => ({ id: c.id, rotulo: c.nome })), cfg.teclas);
  for (const r of f.querySelectorAll('input[name="fonte"]')) r.checked = r.value === cfg.fonte;
  f.volume.value = String(Math.round(cfg.volume * 100));
  for (const nome of CAMPOS_CHECK) f[nome].checked = !!cfg[nome];
  f.backendUrl.value = cfg.backendUrl;
  const perfil = PERFIS.find((p) => p.id === cfg.perfil);
  el.perfilAtual.textContent = perfil ? `${perfil.emoji} ${perfil.nome}` : 'nenhum';
}

/** Linha sobre a autorização do responsável nos ajustes (null esconde). */
export function notaResponsavel(texto) {
  el.configResponsavel.hidden = !texto;
  el.configResponsavel.textContent = texto ?? '';
}

/** Abre o portão do responsável com um desafio novo; a resposta é conferida em main.js. */
export function abrirPortaoResponsavel(desafio) {
  const f = el.formResponsavel;
  f.reset();
  el.responsavelDesafio.textContent = desafio.texto.toUpperCase();
  el.responsavelErro.textContent = '';
  el.dlgResponsavel.showModal();
  f.resposta.focus();
}

function preencherOpcoes(select, itens, atual) {
  select.textContent = '';
  for (const it of itens) {
    const op = document.createElement('option');
    op.value = it.id;
    op.disabled = !!it.bloqueado;
    op.textContent = it.rotulo;
    op.selected = it.id === atual;
    select.appendChild(op);
  }
}

export function lerConfig(base) {
  const f = el.formConfig;
  const intensidade = f.querySelector('input[name="intensidade"]:checked')?.value || base.intensidade;
  return {
    ...base,
    nome: (f.nome.value || 'JOGADOR').trim().slice(0, 16).toUpperCase() || 'JOGADOR',
    intensidade,
    tema: f.tema.value || base.tema,
    skin: f.skin.value || base.skin,
    volume: Number(f.volume.value) / 100,
    velocidade: f.velocidade.value || base.velocidade,
    relampago: f.relampago.value || base.relampago,
    teclas: f.teclas.value || base.teclas,
    fonte: f.querySelector('input[name="fonte"]:checked')?.value || base.fonte,
    ...Object.fromEntries(CAMPOS_CHECK.map((nome) => [nome, f[nome].checked])),
    backendUrl: f.backendUrl.value.trim() || base.backendUrl,
  };
}

/* ---------------- Acessibilidade e perfil ---------------- */

/** Aplica fonte, contraste, botões grandes e teclas permitidas na página. */
export function aplicarAcessibilidade(cfg) {
  const corpo = document.body;
  const escala = FONTES.find((x) => x.id === cfg.fonte)?.escala ?? 1;
  document.documentElement.style.setProperty('--fs', String(escala));
  corpo.dataset.fonte = cfg.fonte;
  corpo.classList.toggle('alto-contraste', !!cfg.contraste);
  corpo.classList.toggle('botoes-grandes', !!cfg.botoesGrandes);
  const bloqueadas = new Set(teclasBloqueadas(cfg.teclas));
  for (const b of el.teclado.querySelectorAll('[data-tecla]')) {
    const off = bloqueadas.has(b.dataset.tecla);
    b.disabled = off;
    b.classList.toggle('t-bloqueada', off);
  }
}

/** Monta os cartões de perfil na tela de boas-vindas. */
export function renderPerfis(atual, aoEscolher) {
  el.listaPerfis.textContent = '';
  for (const p of PERFIS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cartao-perfil' + (p.id === atual ? ' atual' : '');
    b.innerHTML = `<span class="pf-emoji" aria-hidden="true"></span><span class="pf-nome"></span><span class="pf-idade"></span><span class="pf-resumo"></span>`;
    b.querySelector('.pf-emoji').textContent = p.emoji;
    b.querySelector('.pf-nome').textContent = p.nome;
    b.querySelector('.pf-idade').textContent = p.idade;
    b.querySelector('.pf-resumo').textContent = p.resumo;
    b.addEventListener('click', () => aoEscolher(p.id));
    el.listaPerfis.appendChild(b);
  }
}

/* ---------------- Missões diárias e sequência ---------------- */

export function renderMissoes(estado, hoje) {
  el.listaMissoes.textContent = '';
  for (const id of estado.ids) {
    const m = missaoPorId(id);
    if (!m) continue;
    const feito = Math.min(m.meta, estado.progresso[id] || 0);
    const li = document.createElement('li');
    li.className = 'missao' + (feito >= m.meta ? ' ok' : '');
    const icone = document.createElement('span');
    icone.className = 'ms-icone';
    icone.setAttribute('aria-hidden', 'true');
    icone.textContent = feito >= m.meta ? '✅' : m.icone;
    const corpo = document.createElement('div');
    corpo.className = 'ms-corpo';
    const desc = document.createElement('div');
    desc.textContent = m.desc;
    const barra = document.createElement('div');
    barra.className = 'ms-barra';
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-valuemin', '0');
    barra.setAttribute('aria-valuemax', String(m.meta));
    barra.setAttribute('aria-valuenow', String(feito));
    barra.setAttribute('aria-label', `${m.desc}: ${feito} de ${m.meta}`);
    const fill = document.createElement('span');
    fill.style.width = `${(feito / m.meta) * 100}%`;
    barra.appendChild(fill);
    const num = document.createElement('span');
    num.className = 'ms-num';
    num.textContent = `${feito}/${m.meta}`;
    corpo.append(desc, barra);
    li.append(icone, corpo, num);
    el.listaMissoes.appendChild(li);
  }
  el.bauMissoes.textContent = estado.bauAberto
    ? `🎁 Baú do dia aberto! (+${XP_BAU_DIARIO} XP)`
    : `🔒 Complete as 3 missões para abrir o baú (+${XP_BAU_DIARIO} XP)`;
  el.bauMissoes.classList.toggle('aberto', estado.bauAberto);

  const seq = sequenciaAtual(estado.streak, hoje);
  const prox = proximosPremios(estado.streak, hoje);
  el.streakDias.textContent = `🔥 ${seq} dia${seq === 1 ? '' : 's'} seguido${seq === 1 ? '' : 's'} · recorde ${estado.streak.melhor}`;
  const metas = [`🎁 baú em ${prox.bau} dia${prox.bau === 1 ? '' : 's'}`];
  if (prox.pirata) metas.push(`🏴‍☠️ skin Pirata em ${prox.pirata}`);
  if (prox.lendaria) metas.push(`👑 skin Lendária em ${prox.lendaria}`);
  el.streakMetas.textContent = metas.join(' · ');

  // calendário dos últimos 7 dias (✓ = jogou)
  el.streakCalendario.textContent = '';
  const ultimo = estado.streak.ultimaData;
  let d = hoje;
  const dias = [];
  for (let i = 0; i < 7; i++) {
    dias.unshift(d);
    d = diaAnterior(d);
  }
  for (const dia of dias) {
    // os dias jogados da sequência são os `sequencia` dias que terminam em `ultimaData`
    const jogou = !!ultimo && dia <= ultimo && diasEntre(dia, ultimo) < (estado.streak.sequencia || 0);
    const c = document.createElement('span');
    c.className = 'cal-dia' + (jogou ? ' jogou' : '') + (dia === hoje ? ' hoje' : '');
    c.textContent = dia.slice(8);
    c.setAttribute('aria-label', `${dia.split('-').reverse().join('/')}: ${jogou ? 'jogou' : 'não jogou'}`);
    el.streakCalendario.appendChild(c);
  }
}

function diasEntre(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/* ---------------- Desafio diário ---------------- */

/**
 * @param {{data:string, expressao:string}} desafio
 * @param {{registros:object, sequencia:number}} estadoDiario
 */
export function renderDiario(desafio, estadoDiario) {
  el.diarioData.textContent = desafio.data.split('-').reverse().join('/');
  el.diarioConta.textContent = desafio.expressao;
  const hoje = estadoDiario.registros[desafio.data];
  el.diarioStatus.textContent = hoje
    ? `Seu melhor hoje: ${hoje.pontos} PTS · RANK ${hoje.rank} · 🔥 ${estadoDiario.sequencia} dia(s) seguidos`
    : `Ainda não jogou hoje!${estadoDiario.sequencia ? ` · 🔥 sequência: ${estadoDiario.sequencia}` : ''}`;
  el.btnJogarDiario.textContent = hoje ? 'JOGAR DE NOVO ▶' : 'ENFRENTAR O CHEFÃO ▶';

  el.diarioLista.textContent = '';
  const datas = Object.keys(estadoDiario.registros).sort().reverse().slice(0, 7);
  if (!datas.length) {
    const li = document.createElement('li');
    li.className = 'vazio';
    li.textContent = 'Nenhum desafio ainda.';
    el.diarioLista.appendChild(li);
    return;
  }
  for (const d of datas) {
    const r = estadoDiario.registros[d];
    const li = document.createElement('li');
    li.textContent = `${d.split('-').reverse().join('/')} · ${r.pontos} PTS · RANK ${r.rank} · ${'★'.repeat(r.estrelas || 0)}`;
    el.diarioLista.appendChild(li);
  }
}

export function marcarNovidadeDiario(tem) {
  el.btnDiario.classList.toggle('tem-novidade', tem);
  el.btnDiario.setAttribute('aria-label', `Diário: desafio, missões e sequência${tem ? ' (tem novidade hoje!)' : ''}`);
}

/* ---------------- Conquistas ---------------- */

export function renderConquistas(estado) {
  const total = CONQUISTAS.length;
  const feitas = CONQUISTAS.filter((c) => estado.desbloqueadas[c.id]).length;
  el.conquistasResumo.textContent = `${feitas}/${total} desbloqueadas`;
  el.listaConquistas.textContent = '';
  for (const c of CONQUISTAS) {
    const ok = !!estado.desbloqueadas[c.id];
    const li = document.createElement('li');
    li.className = ok ? 'conquista ok' : 'conquista';
    const icone = document.createElement('span');
    icone.className = 'cq-icone';
    icone.setAttribute('aria-hidden', 'true');
    icone.textContent = ok ? c.icone : '🔒';
    const corpo = document.createElement('div');
    const nome = document.createElement('div');
    nome.className = 'cq-nome';
    nome.textContent = c.nome;
    const desc = document.createElement('div');
    desc.className = 'cq-desc';
    const p = progressoConquista(estado, c);
    desc.textContent = c.desc + (p && !ok ? ` (${p.valor}/${p.meta})` : '');
    corpo.append(nome, desc);
    li.append(icone, corpo);
    li.setAttribute('aria-label', `${c.nome}: ${ok ? 'desbloqueada' : 'bloqueada'}. ${desc.textContent}`);
    el.listaConquistas.appendChild(li);
  }
}

/* ---------------- Modo professor ---------------- */

/**
 * @param {{expressao:string, passos:object[], texto:string}} conta
 */
export function renderPassos(conta) {
  el.passosConta.textContent = conta.expressao;
  el.listaPassos.textContent = '';
  const itens = descreverPassos(conta.passos);
  if (!itens.length) {
    const li = document.createElement('li');
    li.className = 'vazio';
    li.textContent = 'Essa conta é só um número: nada para resolver!';
    el.listaPassos.appendChild(li);
  }
  for (const it of itens) {
    const li = document.createElement('li');
    const conta2 = document.createElement('div');
    conta2.className = 'passo-conta';
    conta2.textContent = it.conta;
    const exp = document.createElement('div');
    exp.className = 'passo-explicacao';
    exp.textContent = it.explicacao;
    li.append(conta2, exp);
    el.listaPassos.appendChild(li);
  }
  el.passosResultado.textContent = `Resultado: ${conta.texto}`;
  el.passosOrdem.textContent = ORDEM_DAS_OPERACOES;
}

export function mostrarBotaoPassos(visivel) {
  el.btnPassos.hidden = !visivel;
}
