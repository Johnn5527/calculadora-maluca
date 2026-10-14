/**
 * main.js — Ponto de entrada. Liga teclado, motor matemático, minijogos, revelação e progresso.
 *
 * Fluxo do "=":
 *   1. engine.calcular()  -> valor exato (fonte da verdade) + fases
 *   2. SessaoDeJogo        -> minijogos (só decoram; geram estatísticas de bônus)
 *   3. avaliarDesempenho   -> rank, estrelas, XP
 *   4. revelar()           -> odômetro + efeitos mostrando o valor do passo 1
 *
 * Contas gigantes (4+ operações, a partir do nível 5) e o desafio diário viram luta de chefão.
 */
import { calcular, formatar } from './math/engine.js';
import { audio } from './audio.js';
import * as armazenamento from './storage.js';
import {
  avaliarDesempenho, dificuldadeAdaptativa, registrarPartida, nivelDoXp, SKINS, TEMAS,
  NIVEL_CHEFAO, skinLiberada, adicionarXp,
} from './progresso.js';
import { fasesDoChefao } from './regras-partida.js';
import * as servidor from './api.js';
import { Entrada } from './games/game-base.js';
import { SessaoDeJogo, MIN_FASES_RELAMPAGO } from './games/index.js';
import { revelar } from './fx/reveal.js';
import { efeitos } from './fx/confetti.js';
import {
  tremer, prefereMovimentoReduzido, configurarVibracao, vibrar, esperar,
  configurarSemEfeitos, configurarMultiplicadorTempo,
} from './fx/shake.js';
import { dataLocal, desafioDoDia, registrarDiario, jogouHoje } from './diario.js';
import {
  multDaVelocidade, ritmoInimigos, configRelampago, teclasBloqueadas, aplicarPerfil, limitesDificuldade,
} from './perfis.js';
import { prepararDia, atualizarMissoes } from './missoes.js';
import { processarEvento } from './conquistas.js';
import { criarEditorSkin } from './editor-skin.js';
import { novoDesafio, VERSAO_TERMOS } from './responsavel.js';
import * as ui from './ui.js';

/* =========================================================================
 * ESTADO
 * ========================================================================= */

const estado = {
  expr: '',
  ans: null, // último resultado numérico
  mostrandoResultado: false,
  ocupado: false,
  config: armazenamento.carregarConfig(),
  progresso: armazenamento.carregarProgresso(),
  historico: armazenamento.carregarHistorico(),
  diario: armazenamento.carregarDiario(),
  conquistas: armazenamento.carregarConquistas(),
  skinPersonalizada: armazenamento.carregarSkinPersonalizada(),
  missoes: armazenamento.carregarMissoes(),
  ultimaConta: null, // {expressao, passos, texto} para o modo professor
};

const opcoesMissoes = () => ({ perfil: estado.config.perfil, comJogos: estado.config.jogosLigados });

/** Vibração curtinha para cada efeito sonoro marcante (celular). */
const VIBRACAO_SFX = { pisar: 20, bloco: 25, explosao: 60, dragao: [80, 40, 80], laser: 10, moeda: 6, jackpot: [30, 30, 30, 30, 60] };
const sfx = (nome) => {
  audio.tocar(nome);
  if (VIBRACAO_SFX[nome]) vibrar(VIBRACAO_SFX[nome]);
};

let editorSkin = null;

const OPERADORES = ['+', '−', '×', '÷', '^', '%'];
const TAMANHO_MAX_EXPR = 120;

/* =========================================================================
 * INICIALIZAÇÃO
 * ========================================================================= */

function iniciar() {
  garantirDesbloqueios();
  aplicarConfig();
  ui.atualizarNivel(estado.progresso);
  ui.mostrarExpressao('');
  ui.mostrarResultado('0');
  efeitos.iniciar(ui.el.fxCanvas);

  // Áudio só após o primeiro gesto do usuário
  const desbloquearAudio = () => audio.desbloquear();
  window.addEventListener('pointerdown', desbloquearAudio, { once: true, capture: true });
  window.addEventListener('keydown', desbloquearAudio, { once: true, capture: true });

  ui.el.teclado.addEventListener('click', aoClicarTecla);
  window.addEventListener('keydown', aoTeclar);

  ui.el.btnSom.addEventListener('click', alternarSom);
  ui.el.btnHistorico.addEventListener('click', abrirHistorico);
  ui.el.btnRanking.addEventListener('click', abrirRanking);
  ui.el.abasRanking.addEventListener('click', aoUsarAbasRanking);
  ui.el.abasRanking.addEventListener('keydown', aoUsarAbasRanking);
  ui.el.btnConfig.addEventListener('click', abrirConfig);
  ui.el.btnLimparHistorico.addEventListener('click', () => {
    estado.historico = armazenamento.limparHistorico();
    renderizarHistorico();
    ui.toast('Histórico limpo!');
  });
  ui.el.formConfig.addEventListener('input', salvarConfigDoForm);
  ui.el.formConfig.addEventListener('change', salvarConfigDoForm);
  ui.el.formConfig.addEventListener('submit', (e) => e.preventDefault()); // Enter no campo não recarrega
  ui.el.formResponsavel.addEventListener('submit', conferirResponsavel);
  ui.el.btnResponsavelNao.addEventListener('click', () => ui.el.dlgResponsavel.close());
  ui.el.btnApagarOnline.addEventListener('click', apagarDadosOnline);

  // v2: desafio diário, conquistas, editor de skins, modo professor
  ui.el.btnDiario.addEventListener('click', abrirDiario);
  ui.el.btnJogarDiario.addEventListener('click', jogarDiario);
  ui.el.btnConquistas.addEventListener('click', abrirConquistas);
  ui.el.btnEditor.addEventListener('click', abrirEditor);
  ui.el.btnConfigEditor.addEventListener('click', () => { ui.el.dlgConfig.close(); abrirEditor(); });
  ui.el.btnPassos.addEventListener('click', abrirPassos);
  editorSkin = criarEditorSkin({
    dialogo: ui.el.dlgEditor,
    carregar: () => estado.skinPersonalizada,
    aoSalvar: salvarSkin,
    avisar: (m) => mostrarAvisos([m]),
  });
  ui.marcarNovidadeDiario(temNovidadeHoje());

  // v3: perfis por idade
  ui.el.btnTrocarPerfil.addEventListener('click', () => { ui.el.dlgConfig.close(); abrirPerfis(); });

  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // clique fora fecha
    dlg.addEventListener('close', () => {
      // durante a revelação o foco fica com ela (o "COMO?" abre o professor por cima)
      if (!estado.ocupado) ui.el.igual.focus({ preventScroll: true });
    });
  }

  registrarServiceWorker();
  if (!estado.config.perfil) abrirPerfis(); // primeiro uso

  // Rede de segurança: nenhum erro trava a UI
  window.addEventListener('error', (e) => recuperar(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => recuperar(e.reason));
}

/** Se o progresso diminuir (ex.: storage apagado), volta para itens liberados. */
function garantirDesbloqueios() {
  const cfg = estado.config;
  if (!skinLiberada(SKINS.find((s) => s.id === cfg.skin), contextoSkins())) cfg.skin = 'classico';
  if ((TEMAS.find((t) => t.id === cfg.tema)?.nivel ?? 99) > nivelDoXp(estado.progresso.xp)) cfg.tema = 'dia';
}

const contextoSkins = () => ({
  nivel: nivelDoXp(estado.progresso.xp),
  premios: estado.missoes.streak?.premios || [],
  temSkinPersonalizada: !!estado.skinPersonalizada,
});

function aplicarConfig() {
  const cfg = estado.config;
  ui.aplicarTema(cfg.tema);
  ui.aplicarAcessibilidade(cfg);
  configurarSemEfeitos(cfg.semEfeitos);
  configurarMultiplicadorTempo(multDaVelocidade(cfg.velocidade));
  configurarVibracao(cfg.vibracao);
  audio.definirVolume(cfg.volume);
  audio.definirMudo(cfg.mudo);
  ui.atualizarBotaoSom(cfg.mudo);
  ui.atualizarRodape(cfg);
}

function recuperar(erro) {
  console.error('[calculadora maluca]', erro);
  estado.ocupado = false;
  document.body.classList.remove('caos', 'em-jogo');
  ui.el.jogo.hidden = true;
  document.getElementById('revelacao').hidden = true;
  audio.pararMusica();
  ui.toast('Ops! Um bug escapou, mas a calculadora continua firme.');
}

/* =========================================================================
 * ENTRADA DA CALCULADORA
 * ========================================================================= */

function aoClicarTecla(e) {
  const botao = e.target.closest('[data-tecla]');
  if (!botao) return;
  ui.animarTecla(botao);
  processarTecla(botao.dataset.tecla);
}

const MAPA_TECLADO = {
  '+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷', ':': '÷', '^': '^', '%': '%',
  '(': '(', ')': ')', '.': '.', ',': '.', r: '√', R: '√', a: 'ANS', A: 'ANS',
  Enter: '=', '=': '=', Backspace: 'DEL', Escape: 'C', Delete: 'C',
};

function aoTeclar(e) {
  // não interfere quando há jogo, revelação, diálogo aberto ou foco num campo de texto
  if (estado.ocupado || document.querySelector('dialog[open]')) return;
  if (e.target.closest?.('input, select, textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tecla = /^[0-9]$/.test(e.key) ? e.key : MAPA_TECLADO[e.key];
  if (!tecla) return;
  // Enter num botão focado já gera "click"; evita duplicar
  if (e.key === 'Enter' && e.target.closest?.('button')) return;
  e.preventDefault();
  ui.animarTecla(ui.el.teclado.querySelector(`[data-tecla="${CSS.escape(tecla)}"]`));
  processarTecla(tecla);
}

function textoAns() {
  if (estado.ans === null) return '';
  const t = formatar(estado.ans);
  return estado.ans < 0 ? `(${t})` : t;
}

function processarTecla(tecla) {
  if (estado.ocupado) return;
  if (teclasBloqueadas(estado.config.teclas).includes(tecla)) {
    ui.toast('Essa operação está desligada neste perfil (⚙️ Acessibilidade).');
    return;
  }
  audio.tocar('clique');

  if (tecla === '=') {
    aoIgual();
    return;
  }

  if (tecla === 'C') {
    estado.expr = '';
    estado.mostrandoResultado = false;
    ui.mostrarExpressao('');
    ui.mostrarResultado('0');
    ui.mostrarBonus('');
    ui.mostrarBotaoPassos(false);
    return;
  }

  // depois de um resultado: número começa conta nova; operador continua do resultado
  if (estado.mostrandoResultado) {
    estado.mostrandoResultado = false;
    ui.mostrarBotaoPassos(false);
    if (OPERADORES.includes(tecla) && estado.ans !== null) estado.expr = textoAns();
    else if (tecla === 'DEL') estado.expr = '';
    else estado.expr = '';
  }

  if (tecla === 'DEL') {
    estado.expr = estado.expr.slice(0, -1);
  } else if (tecla === 'ANS') {
    if (estado.ans === null) {
      ui.toast('Ainda não há resultado anterior.');
      return;
    }
    acrescentar(textoAns());
  } else {
    acrescentar(tecla);
  }
  ui.mostrarExpressao(estado.expr);
}

function acrescentar(txt) {
  if ((estado.expr + txt).length > TAMANHO_MAX_EXPR) {
    ui.toast('Conta grande demais!');
    audio.tocar('erro');
    return;
  }
  estado.expr += txt;
}

/* =========================================================================
 * O GRANDE "="
 * ========================================================================= */

const statsVazios = (pulou) => ({ pontos: 0, comboMax: 0, coletados: 0, total: 0, danos: 0, pulou, auto: false, rapido: false, extras: {} });

const chefaoLiberado = () => nivelDoXp(estado.progresso.xp) >= NIVEL_CHEFAO || estado.config.chefaoLivre;

/**
 * @param {{diario?: {data:string, expressao:string}}} [o] quando vem do desafio diário
 */
async function aoIgual({ diario = null } = {}) {
  if (estado.ocupado) return;
  if (diario) {
    estado.expr = diario.expressao;
    estado.mostrandoResultado = false;
    ui.mostrarExpressao(estado.expr);
  }
  const expr = estado.expr.trim();
  if (!expr) {
    ui.toast('Digite uma conta primeiro!');
    audio.tocar('erro');
    return;
  }

  const res = calcular(expr);

  // Erros "normais" (sintaxe, domínio, overflow) não abrem jogo: só tremem o visor.
  if (!res.ok && res.tipo !== 'divzero') {
    audio.tocar('erro');
    ui.mostrarResultado('ERRO', { erro: true });
    ui.mostrarBonus(res.mensagem);
    ui.anunciar(`Erro: ${res.mensagem}`);
    tremer(ui.el.visor, { forca: 8, duracao: 350 });
    return;
  }

  estado.ocupado = true;
  ui.el.app.setAttribute('aria-busy', 'true');
  try {
    // 1) Minijogo(s) — ou o chefão, se a conta for gigante / desafio diário
    const fasesChefe = fasesDoChefao(res, { diario: !!diario, liberado: chefaoLiberado() });
    const fases = fasesChefe || res.fases;
    let stats;
    let partidaOnline = null;
    if ((estado.config.jogosLigados || diario) && fases.length) {
      // abre a partida no servidor em paralelo: o jogo nunca espera a rede
      partidaOnline = servidor.abrirPartida(estado.config, {
        expressao: expr,
        modo: diario ? 'diario' : fasesChefe ? 'chefe' : 'normal',
        dataDiario: diario?.data,
        velocidade: estado.config.velocidade,
        relampago: estado.config.relampago,
      });
      const inicio = performance.now();
      stats = await jogar(fases);
      stats.duracaoMs = Math.round(performance.now() - inicio);
    } else {
      stats = statsVazios(true);
    }

    // 2) Bônus (nunca altera o número). O servidor recalcula a mesma avaliação para o ranking online.
    const avaliacao = avaliarDesempenho(stats, {
      semDerrota: estado.config.semDerrota,
      multTempo: multDaVelocidade(estado.config.velocidade),
    });
    if (partidaOnline) servidor.finalizarPartida(estado.config, partidaOnline, stats);
    const reg = registrarPartida(estado.progresso, avaliacao);
    estado.progresso = reg.progresso;
    armazenamento.salvarProgresso(estado.progresso);

    let sequencia = 0;
    if (diario) {
      const r = registrarDiario(estado.diario, diario.data, avaliacao);
      estado.diario = r.estado;
      sequencia = r.estado.sequencia;
      armazenamento.salvarDiario(estado.diario);
    }

    // 3) Revelação (o botão "COMO?" abre o passo a passo por cima)
    estado.ultimaConta = res.ok ? { expressao: expr, passos: res.passos, texto: res.texto } : null;
    const texto = res.ok ? res.texto : '∞?!';
    const anterior = estado.historico[0]?.valor ?? null;
    await revelar({
      texto,
      valor: res.ok ? res.valor : null,
      anterior,
      intensidade: estado.config.intensidade,
      avaliacao,
      stats,
      mensagemDragao: res.ok ? null : stats.extras.mensagem || 'NHAM! DIVIDIR POR ZERO NÃO PODE!',
      nivel: reg,
      sfx,
      alvoTremor: ui.el.app,
      aoComo: res.ok && res.passos.length ? abrirPassos : null,
      tituloExtra: diario ? 'DESAFIO DIÁRIO!' : fasesChefe ? (stats.extras.chefao ? 'REI DERRUBADO!' : 'CHEFÃO VENCIDO!') : '',
    });

    // 4) Visor, histórico e ranking
    ui.mostrarExpressao(`${expr} =`);
    if (res.ok) {
      ui.mostrarResultado(res.texto);
      estado.ans = res.valor;
      estado.historico = armazenamento.adicionarHistorico({
        expressao: expr,
        resultado: res.texto,
        valor: res.valor,
        rank: avaliacao.rank,
        estrelas: avaliacao.estrelas,
      });
      ui.anunciar(`Resultado: ${res.texto}. Rank ${avaliacao.rank}, ${avaliacao.estrelas} estrelas.`);
    } else {
      ui.mostrarResultado('÷0 = 🐉', { erro: true });
      ui.anunciar('Divisão por zero! O dragão comeu a conta.');
    }
    ui.mostrarBonus(`${'★'.repeat(avaliacao.estrelas)}${'☆'.repeat(3 - avaliacao.estrelas)} RANK ${avaliacao.rank} +${avaliacao.xp}XP`);
    ui.atualizarNivel(estado.progresso);
    ui.mostrarBotaoPassos(!!estado.ultimaConta?.passos.length);
    estado.mostrandoResultado = true;

    // auto-play e pulo dão XP, mas não entram no ranking
    if (!stats.pulou && !stats.auto && avaliacao.pontos > 0) {
      const operacao = diario ? 'diario' : fasesChefe ? 'chefe' : res.ok ? (res.principal || 'num') : 'divzero';
      armazenamento.adicionarRanking({ nome: estado.config.nome, pontos: avaliacao.pontos, rank: avaliacao.rank, operacao });
    }

    // 5) Conquistas e avisos (em fila, para não atropelar um ao outro)
    const avisos = [];
    if (reg.subiu) avisos.push(`NÍVEL ${reg.nivelDepois}! ${reg.desbloqueios.join(' · ')}`.trim());
    const novas = registrarConquistas({
      tipo: 'partida',
      avaliacao,
      stats,
      valor: res.ok ? res.valor : null,
      divzero: !res.ok,
      ops: fases.map((f) => f.op),
      nivel: reg.nivelDepois,
      diario: !!diario,
      sequencia,
    });
    avisos.push(...novas);
    avisos.push(...registrarMissoes({
      tipo: 'partida',
      stats,
      avaliacao,
      ops: res.passos.map((p) => p.op),
      diario: !!diario,
      chefao: !!stats.extras.chefao,
    }));
    mostrarAvisos(avisos);

    // perfil criança: o passo a passo aparece sozinho em contas com mais de uma operação
    if (estado.config.professorAuto && (estado.ultimaConta?.passos.length || 0) >= 2) abrirPassos();
  } catch (e) {
    recuperar(e);
  } finally {
    estado.ocupado = false;
    ui.el.app.removeAttribute('aria-busy');
    ui.el.igual.focus({ preventScroll: true });
  }
}

/** Abre a tela do minijogo, roda as fases e devolve as estatísticas. */
async function jogar(fases) {
  const overlay = ui.el.jogo;
  const controle = new AbortController();
  const sinal = { signal: controle.signal };
  overlay.hidden = false;
  document.body.classList.add('em-jogo');

  const entrada = new Entrada({ botoes: [...overlay.querySelectorAll('[data-ctl]')], superficie: ui.el.canvas });
  let auto = estado.config.autoPlay;
  ui.botaoAuto(auto);

  const sessao = new SessaoDeJogo({
    fases,
    canvas: ui.el.canvas,
    entrada,
    opcoes: {
      dificuldade: dificuldadeAdaptativa(estado.progresso, limitesDificuldade(estado.config.perfil)),
      multTempo: multDaVelocidade(estado.config.velocidade),
      ritmoInimigos: ritmoInimigos(multDaVelocidade(estado.config.velocidade)),
      relampago: configRelampago(estado.config.relampago),
      auto,
      tema: estado.config.tema,
      skin: estado.config.skin,
      skinPersonalizada: estado.skinPersonalizada,
      sfx,
      aoEnergia: (n) => audio.definirEnergia(n),
      reduzido: prefereMovimentoReduzido(),
    },
    aoMudarFase: ui.hudFase,
    aoHud: ui.hud,
  });

  const alternarAuto = () => {
    auto = !auto;
    sessao.definirAuto(auto);
    ui.botaoAuto(auto);
  };
  ui.el.btnPular.addEventListener('click', () => sessao.pular(), sinal);
  ui.el.btnAuto.addEventListener('click', alternarAuto, sinal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); sessao.pular(); }
    if (e.key === 'p' || e.key === 'P') alternarAuto();
  }, sinal);

  audio.definirEnergia(0);
  audio.iniciarMusica(fases.length >= MIN_FASES_RELAMPAGO || fases[0]?.op === 'chefe');
  ui.el.canvas.focus({ preventScroll: true });

  try {
    return await sessao.rodar();
  } finally {
    controle.abort();
    entrada.destruir();
    audio.pararMusica();
    overlay.hidden = true;
    document.body.classList.remove('em-jogo');
  }
}

/* =========================================================================
 * PAINÉIS
 * ========================================================================= */

function alternarSom() {
  audio.desbloquear();
  estado.config.mudo = !estado.config.mudo;
  armazenamento.salvarConfig(estado.config);
  aplicarConfig();
  if (!estado.config.mudo) audio.tocar('moeda');
}

function renderizarHistorico() {
  ui.renderHistorico(estado.historico, {
    usarResultado: (h) => {
      ui.el.dlgHistorico.close();
      if (estado.mostrandoResultado) { estado.expr = ''; estado.mostrandoResultado = false; }
      const t = h.valor < 0 ? `(${h.resultado})` : h.resultado;
      acrescentar(t);
      ui.mostrarExpressao(estado.expr);
    },
    usarConta: (h) => {
      ui.el.dlgHistorico.close();
      estado.expr = h.expressao;
      estado.mostrandoResultado = false;
      ui.mostrarExpressao(estado.expr);
    },
    apagar: (h) => {
      estado.historico = armazenamento.removerHistorico(h.id);
      renderizarHistorico();
    },
  });
}

function abrirHistorico() {
  if (estado.ocupado) return;
  renderizarHistorico();
  ui.el.dlgHistorico.showModal();
}

function abrirRanking() {
  if (estado.ocupado) return;
  ui.renderRanking(ui.el.listaRanking, armazenamento.carregarRanking());
  const antigo = armazenamento.carregarRankingAntigo();
  ui.el.blocoRankingAntigo.hidden = !antigo.length;
  ui.renderRanking(ui.el.listaRankingAntigo, antigo);
  mostrarAbaRanking('local');
  ui.el.dlgRanking.showModal();
}

/** Só a resposta da última aba clicada é desenhada (cliques rápidos não embaralham). */
let pedidoRanking = 0;

async function mostrarAbaRanking(aba) {
  ui.selecionarAbaRanking(aba);
  if (aba === 'local') return;
  const pedido = ++pedidoRanking;
  ui.renderRankingOnline(aba, null);
  const dados = await servidor.buscarRanking(estado.config, aba);
  if (pedido === pedidoRanking) ui.renderRankingOnline(aba, dados);
}

/** Abas acessíveis: clique ou setas ← → / Home / End. */
function aoUsarAbasRanking(e) {
  const abas = [...ui.el.abasRanking.querySelectorAll('[role="tab"]')];
  let alvo = e.target.closest('[role="tab"]');
  if (e.type === 'keydown') {
    const i = abas.indexOf(document.activeElement);
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
    if (destino === undefined || i < 0) return;
    e.preventDefault();
    alvo = abas[(destino + abas.length) % abas.length];
    alvo.focus();
  }
  if (alvo) mostrarAbaRanking(alvo.dataset.aba);
}

function abrirConfig() {
  if (estado.ocupado) return;
  preencherConfig();
  ui.el.dlgConfig.showModal();
}

function preencherConfig() {
  ui.preencherConfig(estado.config, contextoSkins());
  const autorizado = estado.config.consentimento;
  let nota = null;
  if (servidor.precisaResponsavel(estado.config)) nota = '🧑‍🧒 Neste perfil, ligar o ranking online pede a autorização de um adulto.';
  else if (autorizado && ['infantil', 'crianca'].includes(estado.config.perfil)) {
    nota = `✅ Ranking online autorizado por um adulto em ${new Date(autorizado.em).toLocaleDateString('pt-BR')}.`;
  }
  ui.notaResponsavel(nota);
}

/* ---------------- Portão do responsável (LGPD: criança só entra online com um adulto) ---------------- */

let desafioResponsavel = null;

function abrirPortaoResponsavel() {
  desafioResponsavel = novoDesafio();
  ui.abrirPortaoResponsavel(desafioResponsavel);
}

function conferirResponsavel(e) {
  e.preventDefault();
  const f = ui.el.formResponsavel;
  const resposta = f.resposta.value.trim();
  if (resposta !== desafioResponsavel.resposta) {
    // errou: troca o número para não dar para ir chutando
    desafioResponsavel = novoDesafio();
    ui.el.responsavelDesafio.textContent = desafioResponsavel.texto.toUpperCase();
    f.resposta.value = '';
    ui.el.responsavelErro.textContent = 'Número errado. Tente este outro.';
    f.resposta.focus();
    return;
  }
  if (!f.aceito.checked) {
    ui.el.responsavelErro.textContent = 'Marque a caixa de autorização para continuar.';
    f.aceito.focus();
    return;
  }
  estado.config = { ...estado.config, backendAtivo: true, consentimento: { em: new Date().toISOString(), versao: VERSAO_TERMOS } };
  armazenamento.salvarConfig(estado.config);
  ui.el.dlgResponsavel.close();
  if (ui.el.dlgConfig.open) preencherConfig();
  ui.toast('Ranking online autorizado. Obrigado!');
}

async function apagarDadosOnline() {
  if (!confirm('Apagar do servidor o jogador deste aparelho, com todas as partidas online? Os dados do aparelho continuam.')) return;
  const r = await servidor.apagarDadosOnline(estado.config);
  if (r === 'erro') {
    ui.toast('Não deu para falar com o servidor agora. Tente de novo mais tarde.');
    return;
  }
  // a autorização vale para o cadastro apagado: um novo cadastro pede outra
  estado.config = { ...estado.config, backendAtivo: false, consentimento: null };
  armazenamento.salvarConfig(estado.config);
  preencherConfig();
  ui.toast(r === 'apagado' ? 'Dados online apagados.' : 'Este aparelho não tinha dados online.');
}

/* ---------------- Perfis por idade ---------------- */

function abrirPerfis() {
  ui.renderPerfis(estado.config.perfil, escolherPerfil);
  ui.el.dlgPerfil.showModal();
}

function escolherPerfil(id) {
  estado.config = aplicarPerfil(estado.config, id);
  const avisos = ['Perfil aplicado! Tudo pode ser ajustado em ⚙️.'];
  if (estado.config.backendAtivo && servidor.precisaResponsavel(estado.config)) {
    estado.config.backendAtivo = false;
    avisos.push('Ranking online desligado: para ligar neste perfil, chame um adulto em ⚙️.');
  }
  armazenamento.salvarConfig(estado.config);
  aplicarConfig();
  ui.el.dlgPerfil.close();
  mostrarAvisos(avisos);
}

/* ---------------- Desafio diário, missões e sequência ---------------- */

function missoesDeHoje() {
  const hoje = dataLocal();
  const preparado = prepararDia(estado.missoes, hoje, opcoesMissoes());
  if (preparado !== estado.missoes) {
    estado.missoes = preparado;
    armazenamento.salvarMissoes(estado.missoes);
  }
  return estado.missoes;
}

/** A bolinha do 📅 acende se o desafio ou o baú do dia ainda estão pendentes. */
const temNovidadeHoje = () => !jogouHoje(estado.diario, dataLocal()) || !missoesDeHoje().bauAberto;

function abrirDiario() {
  if (estado.ocupado) return;
  const hoje = dataLocal();
  ui.renderDiario(desafioDoDia(hoje), estado.diario);
  ui.renderMissoes(missoesDeHoje(), hoje);
  ui.el.dlgDiario.showModal();
}

/**
 * Atualiza missões/sequência com um evento, aplica o XP dos baús e devolve os avisos.
 * @returns {string[]}
 */
function registrarMissoes(evento) {
  const r = atualizarMissoes(estado.missoes, dataLocal(), evento, opcoesMissoes());
  estado.missoes = r.estado;
  armazenamento.salvarMissoes(estado.missoes);

  const avisos = r.concluidas.map((m) => `${m.icone} MISSÃO: ${m.desc}!`);
  let xp = 0;
  if (r.bau) {
    xp += r.bau.xp;
    avisos.push(`🎁 BAÚ DO DIA ABERTO! +${r.bau.xp} XP`);
  }
  for (const rec of r.recompensas) {
    if (rec.tipo === 'bau') {
      xp += rec.xp;
      avisos.push(`🔥 ${rec.dias} DIAS SEGUIDOS! BAÚ: +${rec.xp} XP`);
    } else if (rec.tipo === 'skin') {
      const nome = SKINS.find((s) => s.id === rec.skin)?.nome || rec.skin;
      avisos.push(`🔥 ${rec.dias} DIAS SEGUIDOS! SKIN LIBERADA: ${nome}`);
    }
  }
  if (xp) {
    const ganho = adicionarXp(estado.progresso, xp);
    estado.progresso = ganho.progresso;
    armazenamento.salvarProgresso(estado.progresso);
    ui.atualizarNivel(estado.progresso);
    if (ganho.subiu) avisos.push(`NÍVEL ${ganho.nivelDepois}!`);
  }
  if (r.bau || r.recompensas.length) efeitos.confete(prefereMovimentoReduzido() ? 10 : 80);
  ui.marcarNovidadeDiario(temNovidadeHoje());
  return avisos;
}

function jogarDiario() {
  ui.el.dlgDiario.close();
  aoIgual({ diario: desafioDoDia(dataLocal()) });
}

/* ---------------- Conquistas ---------------- */

function abrirConquistas() {
  if (estado.ocupado) return;
  ui.renderConquistas(estado.conquistas);
  ui.el.dlgConquistas.showModal();
}

/** Processa um evento de conquista, salva e devolve os textos das recém-desbloqueadas. */
function registrarConquistas(evento) {
  const r = processarEvento(estado.conquistas, evento);
  estado.conquistas = r.estado;
  armazenamento.salvarConquistas(estado.conquistas);
  return r.novas.map((c) => `${c.icone} CONQUISTA: ${c.nome}!`);
}

let filaAvisos = Promise.resolve();
const DURACAO_AVISO = 2600;

/** Espera o minijogo sair da tela (avisos não podem aparecer por cima do jogo). */
async function esperarTelaLivre() {
  while (document.body.classList.contains('em-jogo')) await esperar(250);
}

/** Mostra toasts um depois do outro, só quando não há minijogo na tela. */
function mostrarAvisos(textos) {
  for (const t of textos) {
    filaAvisos = filaAvisos.then(async () => {
      await esperarTelaLivre();
      ui.toast(t, DURACAO_AVISO);
      ui.anunciar(t);
      if (t.includes('CONQUISTA') || t.includes('MISSÃO')) sfx('estrela');
      if (t.includes('BAÚ')) sfx('jackpot');
      await esperar(DURACAO_AVISO + 200);
    }).catch((e) => console.warn('[avisos]', e));
  }
}

/* ---------------- Editor de skins ---------------- */

function abrirEditor() {
  if (estado.ocupado) return;
  editorSkin.abrir();
}

function salvarSkin(skin) {
  estado.skinPersonalizada = skin;
  armazenamento.salvarSkinPersonalizada(skin);
  estado.config.skin = 'custom';
  armazenamento.salvarConfig(estado.config);
  mostrarAvisos(registrarConquistas({ tipo: 'pintor' }));
}

/* ---------------- Modo professor ---------------- */

function abrirPassos() {
  if (!estado.ultimaConta || ui.el.dlgPassos.open) return;
  ui.renderPassos(estado.ultimaConta);
  ui.el.dlgPassos.showModal();
  mostrarAvisos([...registrarConquistas({ tipo: 'professor' }), ...registrarMissoes({ tipo: 'professor' })]);
}

/* ---------------- PWA ---------------- */

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const registrar = () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[pwa] service worker falhou', e));
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar, { once: true });
}

function salvarConfigDoForm() {
  const ligandoOnline = !estado.config.backendAtivo && ui.el.formConfig.backendAtivo.checked;
  estado.config = ui.lerConfig(estado.config);
  if (ligandoOnline && servidor.precisaResponsavel(estado.config)) {
    // só liga depois que o adulto autorizar no portão
    estado.config.backendAtivo = false;
    ui.el.formConfig.backendAtivo.checked = false;
    abrirPortaoResponsavel();
  }
  armazenamento.salvarConfig(estado.config);
  aplicarConfig();
}

iniciar();
