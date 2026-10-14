/**
 * engine.test.js — Executor de testes do motor (sem dependências).
 * Node:      node tests/engine.test.js
 * Navegador: abra tests/index.html pelo servidor local.
 */
import { calcular, formatar, compactarFases } from '../js/math/engine.js';
import { desafioDoDia, registrarDiario, diaAnterior, DIARIO_PADRAO } from '../js/diario.js';
import { descreverPassos } from '../js/professor.js';
import { codificarSkin, decodificarSkin, skinBase, validarSkin } from '../js/skin-codigo.js';
import { processarEvento, CONQUISTAS_PADRAO } from '../js/conquistas.js';
import { CASOS } from './casos.js';
import { dificuldadeAdaptativa, avaliarDesempenho, skinLiberada, SKINS } from '../js/progresso.js';
import { aplicarPerfil, limitesDificuldade, multDaVelocidade, ritmoInimigos, configRelampago, teclasBloqueadas } from '../js/perfis.js';
import { missoesDoDia, atualizarMissoes, MISSOES_PADRAO, sequenciaAtual, prepararDia } from '../js/missoes.js';
import { duracaoBase, TETO_COLETA } from '../js/regras-partida.js';
import { JOGOS } from '../js/games/index.js';
function testesV3() {
  const ruim = { notasRecentes: [0, 0, 0] };
  const otimo = { notasRecentes: [100, 100, 100] };
  const infantil = aplicarPerfil({ nome: 'ANA', tema: 'noite' }, 'infantil');
  const statsRuins = { pontos: 0, comboMax: 0, coletados: 0, total: 5, danos: 5, pulou: false, auto: false, rapido: false };

  // missões: 3 contas resolvidas completam "partidas3" se ela estiver no dia
  const dia = '2026-10-14';
  const ids = missoesDoDia(dia, { perfil: 'teen' });
  let m = MISSOES_PADRAO;
  const evento = { tipo: 'partida', stats: { comboMax: 9, total: 3, extras: {} }, avaliacao: { rank: 'S', estrelas: 3 }, ops: ['add', 'sub', 'mul', 'div', 'sqrt'], diario: true, chefao: true };
  let bau = null;
  for (let i = 0; i < 6; i++) {
    const r = atualizarMissoes(m, dia, evento, { perfil: 'teen' });
    m = r.estado;
    bau = bau || r.bau;
  }
  const r2 = atualizarMissoes(m, dia, { tipo: 'professor' }, { perfil: 'teen' });
  m = r2.estado;
  bau = bau || r2.bau;

  // sequência: 7 dias seguidos liberam a skin pirata
  let s = MISSOES_PADRAO;
  let premios = [];
  for (let i = 0; i < 7; i++) {
    const r = atualizarMissoes(s, `2026-01-0${i + 1}`, { tipo: 'partida', stats: { extras: {} } }, {});
    s = r.estado;
    premios = premios.concat(r.recompensas);
  }
  const quebra = atualizarMissoes(s, '2026-01-10', { tipo: 'partida', stats: { extras: {} } }, {}).estado;

  return [
    ['dificuldade tem teto 0,8', dificuldadeAdaptativa(otimo) === 0.8],
    ['dificuldade tem piso do perfil', dificuldadeAdaptativa(ruim, [0.2, 0.8]) === 0.2],
    ['dificuldade infantil não passa de 0,3', dificuldadeAdaptativa(otimo, limitesDificuldade('infantil')) === 0.3],
    ['sem derrota garante rank B', avaliarDesempenho(statsRuins, { semDerrota: true }).rank === 'B' && avaliarDesempenho(statsRuins).rank === 'D'],
    ['perfil infantil preenche ajustes e mantém o resto', infantil.velocidade === 'bem-lento' && infantil.teclas === 'basicas' && infantil.nome === 'ANA' && infantil.tema === 'noite'],
    ['velocidade lenta ×1,6 e inimigos 25% mais lentos', multDaVelocidade('lento') === 1.6 && ritmoInimigos(1.6) === 0.75],
    ['relâmpago desligado / segundos', !configRelampago('desligado').ligado && configRelampago('5').segundos === 5],
    ['teclas básicas bloqueiam × ÷ ^ √ %', teclasBloqueadas('basicas').join('') === '×÷^√%'],
    ['durações-base: normal 9, relâmpago 4, chefão 14, dragão 7',
      duracaoBase('add', false) === 9 && duracaoBase('add', true) === 4
      && duracaoBase('chefe', false) === 14 && duracaoBase('divzero', false) === 7],
    ['recorde diário da fórmula antiga é substituído pela nova tentativa', (() => {
      const antigo = { registros: { '2026-10-14': { pontos: 5000, rank: 'S', estrelas: 3 } }, ultimaData: '2026-10-14', sequencia: 1 };
      const r = registrarDiario(antigo, '2026-10-14', { pontos: 900, rank: 'B', estrelas: 2 });
      const r2 = registrarDiario(r.estado, '2026-10-14', { pontos: 800, rank: 'C', estrelas: 1 });
      return r.melhorou && r.estado.registros['2026-10-14'].pontos === 900 && !r2.melhorou;
    })()],
    ['todo minijogo registrado tem teto de coleta (o servidor confere)',
      Object.keys(JOGOS).every((op) => TETO_COLETA[op] > 0) && Object.keys(TETO_COLETA).every((op) => JOGOS[op])],
    ['missões do dia: 3, determinísticas', ids.length === 3 && ids.join() === missoesDoDia(dia, { perfil: 'teen' }).join()],
    ['missões infantis não pedem ×, ÷ nem √', ['2026-01-01', '2026-02-02', '2026-03-03', '2026-04-04', '2026-05-05']
      .every((x) => !missoesDoDia(x, { perfil: 'infantil' }).some((id) => ['vezes', 'divide', 'raiz', 'chefao'].includes(id)))],
    ['modo direto só sorteia missões possíveis sem jogo', !missoesDoDia(dia, { comJogos: false }).some((id) => ['combo5', 'semPular', 'rankA', 'estrelas6', 'chefao'].includes(id))],
    ['3 missões completas abrem o baú uma vez', m.bauAberto && !!bau],
    ['7 dias seguidos: baú + skin pirata', premios.some((p) => p.tipo === 'bau') && s.streak.premios.includes('pirata') && s.streak.sequencia === 7],
    ['pular dia zera a sequência', quebra.streak.sequencia === 1 && quebra.streak.melhor === 7],
    ['sequência some se não jogou ontem', sequenciaAtual(s.streak, '2026-01-20') === 0 && sequenciaAtual(s.streak, '2026-01-08') === 7],
    ['skin pirata só com prêmio', !skinLiberada(SKINS.find((x) => x.id === 'pirata'), { nivel: 99 }) && skinLiberada(SKINS.find((x) => x.id === 'pirata'), { nivel: 1, premios: ['pirata'] })],
    ['trocar de perfil no mesmo dia sorteia missões do novo perfil', (() => {
      const semPerfil = prepararDia(MISSOES_PADRAO, '2026-01-01', {});
      const infantilHoje = prepararDia(semPerfil, '2026-01-01', { perfil: 'infantil' });
      return infantilHoje.ids.join() === missoesDoDia('2026-01-01', { perfil: 'infantil' }).join()
        && prepararDia(infantilHoje, '2026-01-01', { perfil: 'infantil' }) === infantilHoje;
    })()],
  ];
}

const lanca = (fn) => { try { fn(); return false; } catch { return true; } };

/** Todos os desafios diários de um ano: precisam ser contas válidas e gigantes. */
function desafiosDoAnoValidos() {
  let d = '2026-12-31';
  for (let i = 0; i < 366; i++) {
    const r = calcular(desafioDoDia(d).expressao);
    if (!r.ok || r.passos.length < 4) return false;
    d = diaAnterior(d);
  }
  return true;
}

function testesV2() {
  const skin = skinBase();
  skin.mapa[0] = 'KKKKKKKKKKKK';
  skin.paleta.B = '#00ff88';
  const codigo = codificarSkin(skin);
  const volta = decodificarSkin(codigo);

  const ev = { tipo: 'partida', avaliacao: { rank: 'S' }, stats: { comboMax: 6, extras: {} }, valor: 42, divzero: false, ops: ['add'], nivel: 1 };
  const c1 = processarEvento(CONQUISTAS_PADRAO, ev);
  const c2 = processarEvento(c1.estado, ev);
  let dz = CONQUISTAS_PADRAO;
  for (let i = 0; i < 10; i++) dz = processarEvento(dz, { tipo: 'partida', stats: { extras: {} }, divzero: true }).estado;

  const av = { pontos: 100, rank: 'A', estrelas: 2 };
  const d1 = registrarDiario(DIARIO_PADRAO, '2026-03-01', av).estado;
  const d2 = registrarDiario(d1, '2026-03-02', { ...av, pontos: 50 }).estado;
  const d3 = registrarDiario(d2, '2026-03-02', { ...av, pontos: 10 });
  const d4 = registrarDiario(d2, '2026-03-05', av).estado;

  const pct = calcular('200+10%');
  return [
    ['desafio diário é determinístico', desafioDoDia('2026-10-14').expressao === desafioDoDia('2026-10-14').expressao],
    ['desafios mudam de um dia para o outro', desafioDoDia('2026-10-14').expressao !== desafioDoDia('2026-10-15').expressao],
    ['desafios do ano todo são válidos e gigantes', desafiosDoAnoValidos()],
    ['diaAnterior vira o mês', diaAnterior('2026-03-01') === '2026-02-28'],
    ['diário: sequência de dias seguidos', d2.sequencia === 2],
    ['diário: guarda a melhor tentativa', d3.estado.registros['2026-03-02'].pontos === 50 && !d3.melhorou],
    ['diário: sequência quebra ao pular dia', d4.sequencia === 1],
    ['passos de 2+3*4 são 2', calcular('2+3*4').passos.length === 2],
    ['passos guardam a ordem real', calcular('2+3*4').passos.map((p) => p.op).join() === 'mul,add'],
    ['% contextual guarda o sinal', pct.passos[0].op === 'pct' && pct.passos[0].sinal === '+' && pct.passos[0].parcela === 20],
    ['divisão por zero tem passo divzero', calcular('5+1/0').passos.at(-1).op === 'divzero'],
    ['erro de sintaxe não tem passos', calcular('2+').passos?.length === 0 || !calcular('2+').ok],
    ['professor descreve todos os passos', descreverPassos(calcular('√16+2^3-10%').passos).every((p) => p.conta && p.explicacao)],
    ['professor explica potência', descreverPassos(calcular('2^3').passos)[0].explicacao.includes('2')],
    ['skin base é válida', validarSkin(skinBase())],
    ['código de skin começa com CM1.', codigo.startsWith('CM1.')],
    ['código de skin ida e volta', JSON.stringify(volta) === JSON.stringify(skin)],
    ['código de skin inválido lança erro', lanca(() => decodificarSkin('XYZ')) && lanca(() => decodificarSkin('CM1.@@@'))],
    ['conquistas: primeira partida desbloqueia várias', ['primeira', 'rank_s', 'combo5', 'resposta'].every((id) => c1.estado.desbloqueadas[id])],
    ['conquistas: não repetem', c2.novas.length === 0],
    ['conquistas: dragão gordo após 10 divisões por zero', !!dz.desbloqueadas.devorado10],
  ];
}

/** Roda todos os testes e devolve um relatório. */
export function rodarTestes() {
  const resultados = [];

  for (const [expr, esperado] of CASOS) {
    const r = calcular(expr);
    let passou;
    let obtido;
    if (typeof esperado === 'number') {
      obtido = r.ok ? r.valor : `erro:${r.tipo}`;
      passou = r.ok && Object.is(r.valor, esperado);
    } else {
      obtido = r.ok ? r.valor : r.tipo;
      passou = !r.ok && r.tipo === esperado;
    }
    resultados.push({ nome: `calcular("${expr}") = ${esperado}`, passou, obtido });
  }

  // Testes extras de formatação e fases
  const extras = [
    ['formatar(1e20)', formatar(1e20) === '1e20'],
    ['formatar(-0)', formatar(-0) === '0'],
    ['formatar(1000000)', formatar(1000000) === '1000000'],
    ['fase principal de 2+3 é soma', calcular('2+3').principal === 'add'],
    ['fase principal de 2+3*4 é soma', calcular('2+3*4').principal === 'add'],
    ['1+2+3+4 vira uma fase só', calcular('1+2+3+4').fases.length === 1],
    ['fases limitadas a 3', calcular('√16+2*3-1^2/1').fases.length <= 3],
    ['última fase termina no valor real', calcular('2*3+1').fases.at(-1).r === 7],
    ['divisão por zero gera fase do dragão', calcular('1/0').fases[0].op === 'divzero'],
    ['compactar mantém ordem', compactarFases([{ op: 'mul', a: 2, b: 3, r: 6 }, { op: 'add', a: 6, b: 1, r: 7 }]).map((f) => f.op).join() === 'mul,add'],
  ];
  for (const [nome, passou] of [...extras, ...testesV2(), ...testesV3()]) resultados.push({ nome, passou, obtido: passou });

  const falhas = resultados.filter((r) => !r.passou);
  return { total: resultados.length, falhas, resultados };
}

// Execução direta no Node
if (typeof window === 'undefined') {
  const { total, falhas } = rodarTestes();
  for (const f of falhas) console.error(`✗ ${f.nome} (obtido: ${f.obtido})`);
  console.log(`${total - falhas.length}/${total} testes passaram.`);
  process.exitCode = falhas.length ? 1 : 0;
}
