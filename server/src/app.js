/**
 * app.js — API /api/v1 da Calculadora Maluca.
 * O back-end manda: recalcula a conta com o MESMO motor do app (js/math/engine.js),
 * monta as fases com as mesmas regras (js/regras-partida.js) e calcula pontos/rank/XP
 * com a mesma avaliação (js/progresso.js). O cliente só informa números brutos.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { montarPartida, duracaoPrevistaMs, tetoColeta } from '../../js/regras-partida.js';
import { avaliarDesempenho } from '../../js/progresso.js';
import { multDaVelocidade, configRelampago, VELOCIDADES, OPCOES_RELAMPAGO } from '../../js/perfis.js';
import { RE_APELIDO, apelidoImproprio, apelidoProntoValido } from '../../js/apelidos.js';
import { FAIXAS_COM_RESPONSAVEL, VERSAO_TERMOS } from '../../js/responsavel.js';
import { gerarToken, hashToken, gerarSeed, assinarPartida, conferirAssinatura } from './seguranca.js';
import { conferirPartida } from './plausibilidade.js';

/** Partida aberta há mais tempo que isso não pode mais ser finalizada. */
export const VALIDADE_PARTIDA_MS = 10 * 60 * 1000;
const FUSO = 'America/Sao_Paulo';
const FAIXAS = ['4-7', '8-12', '13+', '60+'];
const FAIXAS_RANKING_LIGADO = new Set(['13+', '60+']);
const TENTATIVAS_TAG = 20;

/**
 * Limite de requisições por IP (por minuto, salvo onde diz). Uma partida honesta leva
 * vários segundos, então 30 aberturas por minuto já é muito acima do normal.
 */
export const LIMITES = {
  geral: { max: 120, timeWindow: '1 minute' },
  cadastro: { max: 10, timeWindow: '1 hour' }, // escola/família atrás do mesmo IP ainda cabe
  partida: { max: 30, timeWindow: '1 minute' },
  ranking: { max: 60, timeWindow: '1 minute' },
};

export class ErroHttp extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

/** Data AAAA-MM-DD no fuso do jogo. */
const dataNoFuso = (d) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Segunda-feira 00:00 (fuso do jogo) da semana de `d`. */
export function inicioDaSemana(d) {
  const [a, m, dia] = dataNoFuso(d).split('-').map(Number);
  const meioDia = new Date(Date.UTC(a, m - 1, dia, 12));
  const desdeSegunda = (meioDia.getUTCDay() + 6) % 7;
  const segunda = new Date(meioDia.getTime() - desdeSegunda * 86400000).toISOString().slice(0, 10);
  const deslocamento = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, timeZoneName: 'longOffset' })
    .formatToParts(meioDia).find((p) => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
  return new Date(`${segunda}T00:00:00${deslocamento}`);
}

const TAMANHO_TOP = 10;
const VALIDA_PARA_RANKING = `p.status = 'aceita' AND NOT p.auto AND NOT p.pulou`;

/**
 * SQL da melhor pontuação de cada jogador no período: (jogador_id, pontos, rank, quando).
 * Usa sempre o parâmetro $1 (data inicial, data do diário ou null).
 */
const MELHORES_SQL = {
  global: `SELECT DISTINCT ON (p.jogador_id) p.jogador_id, p.pontos, p.rank, p.finalizada_em AS quando
             FROM partida p WHERE ${VALIDA_PARA_RANKING} AND $1::timestamptz IS NULL
            ORDER BY p.jogador_id, p.pontos DESC, p.finalizada_em`,
  semana: `SELECT DISTINCT ON (p.jogador_id) p.jogador_id, p.pontos, p.rank, p.finalizada_em AS quando
             FROM partida p WHERE ${VALIDA_PARA_RANKING} AND p.finalizada_em >= $1::timestamptz
            ORDER BY p.jogador_id, p.pontos DESC, p.finalizada_em`,
  // desafio do dia: a tabela já guarda só a melhor tentativa válida de cada um
  dia: `SELECT d.jogador_id, d.melhor_pontos AS pontos, p.rank, p.finalizada_em AS quando
          FROM diario_tentativa d JOIN partida p ON p.id = d.partida_id WHERE d.data = $1::date`,
};
const VISIVEL = 'j.ranking_publico AND NOT j.banido';

const jogadorPublico = (j) => ({
  id: j.id,
  apelido: j.apelido,
  tag: j.tag,
  faixaEtaria: j.faixa_etaria,
  rankingPublico: j.ranking_publico,
  xp: j.xp,
  partidas: j.partidas,
});

const resumoPartida = (p) =>
  p.status === 'aceita'
    ? {
        status: p.status,
        nota: p.nota,
        rank: p.rank,
        estrelas: p.estrelas,
        pontos: p.pontos,
        xp: p.xp_ganho,
        entraNoRanking: !p.auto && !p.pulou,
      }
    : { status: p.status, motivo: p.motivo_recusa };

const ehViolacaoUnica = (e) => e?.code === '23505';

/* ---------- esquemas (validação do Fastify) ---------- */
const UUID = { type: 'string', format: 'uuid' };
const esquemaCadastro = {
  body: {
    type: 'object',
    required: ['apelido', 'faixaEtaria'],
    additionalProperties: false,
    properties: {
      apelido: { type: 'string', minLength: 1, maxLength: 40 },
      faixaEtaria: { enum: FAIXAS },
      consentimentoResponsavel: { type: 'boolean', default: false },
      versaoTermos: { type: 'string', maxLength: 40 },
    },
  },
};
const esquemaRanking = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: { periodo: { enum: ['global', 'semana', 'dia'], default: 'global' } },
  },
};
const esquemaAbrir = {
  body: {
    type: 'object',
    required: ['modo'],
    additionalProperties: false,
    properties: {
      expressao: { type: 'string', maxLength: 200 },
      modo: { enum: ['normal', 'chefe', 'diario'] },
      dataDiario: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      velocidade: { enum: VELOCIDADES.map((v) => v.id), default: 'normal' },
      relampago: { enum: OPCOES_RELAMPAGO.map((o) => o.id), default: '4' },
    },
  },
};
const numero = { type: 'number', minimum: 0, maximum: 10000 };
const esquemaFinalizar = {
  params: { type: 'object', required: ['id'], properties: { id: UUID } },
  body: {
    type: 'object',
    required: ['assinatura', 'idempotencyKey', 'duracaoMs', 'stats'],
    additionalProperties: false,
    properties: {
      assinatura: { type: 'string', maxLength: 100 },
      idempotencyKey: UUID,
      duracaoMs: { type: 'integer', minimum: 0, maximum: 600000 },
      stats: {
        type: 'object',
        required: ['coletados', 'total', 'comboMax', 'danos', 'rapido', 'pulou', 'auto'],
        additionalProperties: false,
        properties: {
          coletados: numero,
          total: { type: 'integer', minimum: 0, maximum: 10000 },
          comboMax: { type: 'integer', minimum: 0, maximum: 10000 },
          danos: { type: 'integer', minimum: 0, maximum: 10000 },
          rapido: { type: 'boolean' },
          pulou: { type: 'boolean' },
          auto: { type: 'boolean' },
        },
      },
    },
  },
};

/**
 * @param {{config:object, db:import('./db.js').Banco, relogio?:()=>Date, logger?:boolean|object,
 *          limitar?:boolean}} o  limitar=false desliga o limite por IP (testes que fazem muitas chamadas)
 */
export async function construirApp({ config, db, relogio = () => new Date(), logger = false, limitar = true }) {
  // sem isso, atrás do proxy da hospedagem todo mundo teria o mesmo IP e dividiria o limite
  const app = Fastify({ logger, bodyLimit: 16 * 1024, trustProxy: config.proxies || false });

  await app.register(helmet, {
    // a API só devolve JSON; o front fica em outra origem e lê via CORS
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: config.producao ? { maxAge: 31536000, includeSubDomains: true } : false,
  });
  await app.register(cors, {
    origin: config.corsOrigens,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  if (limitar) {
    await app.register(rateLimit, {
      ...LIMITES.geral,
      errorResponseBuilder: (req, ctx) =>
        new ErroHttp(429, 'muitas_requisicoes', `Calma! Tente de novo em ${Math.ceil(ctx.ttl / 1000)} s`),
    });
  }
  const limite = (nome) => (limitar ? { config: { rateLimit: LIMITES[nome] } } : {});

  app.setErrorHandler((erro, req, resp) => {
    if (erro instanceof ErroHttp) return resp.status(erro.status).send({ erro: { codigo: erro.codigo, mensagem: erro.message } });
    if (erro.validation) return resp.status(400).send({ erro: { codigo: 'requisicao_invalida', mensagem: erro.message } });
    if (erro.statusCode && erro.statusCode < 500) {
      return resp.status(erro.statusCode).send({ erro: { codigo: 'requisicao_invalida', mensagem: erro.message } });
    }
    req.log.error(erro);
    return resp.status(500).send({ erro: { codigo: 'erro_interno', mensagem: 'Erro interno' } });
  });
  app.setNotFoundHandler((req, resp) => resp.status(404).send({ erro: { codigo: 'nao_encontrado', mensagem: 'Rota não encontrada' } }));

  /** Identifica o jogador pelo token "Authorization: Bearer ...". */
  async function autenticar(req) {
    const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new ErroHttp(401, 'sem_token', 'Envie o token do jogador');
    const [jogador] = await db.query(
      `SELECT j.* FROM jogador_token t JOIN jogador j ON j.id = t.jogador_id
        WHERE t.token_hash = $1 AND t.revogado_em IS NULL`,
      [hashToken(token, config.tokenPepper)],
    );
    if (!jogador) throw new ErroHttp(401, 'token_invalido', 'Token inválido ou revogado');
    req.jogador = jogador;
  }

  /** Rotas públicas que mostram algo a mais para quem manda o token (inválido continua 401). */
  async function autenticarSeTiver(req) {
    if (req.headers.authorization) await autenticar(req);
  }

  /* ---------- rotas ---------- */
  // usada pelo healthcheck do Docker/hospedagem: só diz "ok" se o banco responder
  app.get('/api/v1/saude', { config: { rateLimit: false } }, async (req, resp) => {
    try {
      await db.query('SELECT 1');
      return { ok: true };
    } catch (e) {
      req.log.error(e);
      return resp.status(503).send({ ok: false, erro: { codigo: 'banco_fora', mensagem: 'Banco indisponível' } });
    }
  });

  app.post('/api/v1/jogadores', { schema: esquemaCadastro, ...limite('cadastro') }, async (req, resp) => {
    const { faixaEtaria, consentimentoResponsavel } = req.body;
    const crianca = FAIXAS_COM_RESPONSAVEL.has(faixaEtaria);
    let apelido = req.body.apelido.replace(/\s+/g, ' ').trim();
    if (crianca) {
      // criança não digita apelido: só os da lista pronta (sem nome real, sem texto livre)
      apelido = apelidoProntoValido(apelido);
      if (!apelido) throw new ErroHttp(422, 'apelido_fora_da_lista', 'Para até 12 anos, escolha um apelido da lista');
      if (!consentimentoResponsavel) {
        throw new ErroHttp(422, 'consentimento_obrigatorio', 'Um responsável precisa autorizar o ranking online');
      }
    } else {
      if (!RE_APELIDO.test(apelido)) {
        throw new ErroHttp(422, 'apelido_invalido', 'Apelido: 3 a 12 letras, números, espaço ou _');
      }
      if (apelidoImproprio(apelido)) throw new ErroHttp(422, 'apelido_improprio', 'Esse apelido não pode. Escolha outro');
    }
    const consentimentoEm = crianca ? relogio() : null;
    const consentimentoVersao = crianca ? req.body.versaoTermos || VERSAO_TERMOS : null;
    const token = gerarToken();
    for (let i = 0; i < TENTATIVAS_TAG; i++) {
      const tag = 1000 + Math.floor(Math.random() * 9000);
      try {
        const jogador = await db.transacao(async (tx) => {
          const [j] = await tx.query(
            `INSERT INTO jogador (apelido, tag, faixa_etaria, ranking_publico, consentimento_em, consentimento_versao)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [apelido, tag, faixaEtaria, FAIXAS_RANKING_LIGADO.has(faixaEtaria), consentimentoEm, consentimentoVersao],
          );
          await tx.query('INSERT INTO jogador_token (token_hash, jogador_id) VALUES ($1, $2)', [hashToken(token, config.tokenPepper), j.id]);
          return j;
        });
        return resp.status(201).send({ jogador: jogadorPublico(jogador), token });
      } catch (e) {
        if (!ehViolacaoUnica(e)) throw e; // apelido#tag já existe: sorteia outra tag
      }
    }
    throw new ErroHttp(409, 'apelido_lotado', 'Esse apelido está muito popular, tente outro');
  });

  app.get('/api/v1/eu', { preHandler: autenticar }, async (req) => {
    await db.query('UPDATE jogador SET visto_em = $2 WHERE id = $1', [req.jogador.id, relogio()]);
    return { jogador: jogadorPublico(req.jogador) };
  });

  // LGPD: apagar a conta remove tudo em cascata (tokens, partidas, diário)
  app.delete('/api/v1/eu', { preHandler: autenticar }, async (req, resp) => {
    await db.query('DELETE FROM jogador WHERE id = $1', [req.jogador.id]);
    return resp.status(204).send();
  });

  // melhor partida de cada jogador no período (ninguém ocupa o top 10 sozinho)
  app.get('/api/v1/ranking', { schema: esquemaRanking, preHandler: autenticarSeTiver, ...limite('ranking') }, async (req) => {
    const { periodo } = req.query;
    const agora = relogio();
    const filtro = periodo === 'semana' ? inicioDaSemana(agora) : periodo === 'dia' ? dataNoFuso(agora) : null;
    const melhores = MELHORES_SQL[periodo];
    const eu = req.jogador?.id ?? null;

    const linhas = await db.query(
      `WITH melhores AS (${melhores})
       SELECT m.jogador_id, j.apelido, j.tag, m.pontos, m.rank, rank() OVER (ORDER BY m.pontos DESC)::int AS posicao
         FROM melhores m JOIN jogador j ON j.id = m.jogador_id
        WHERE ${VISIVEL}
        ORDER BY m.pontos DESC, m.quando
        LIMIT ${TAMANHO_TOP}`,
      [filtro],
    );
    const top = linhas.map((l) => ({
      posicao: l.posicao, apelido: l.apelido, tag: l.tag, pontos: l.pontos, rank: l.rank, eu: l.jogador_id === eu,
    }));

    let voce = null;
    if (eu) {
      const [minha] = await db.query(
        `WITH melhores AS (${melhores})
         SELECT m.pontos, m.rank,
                (SELECT count(*)::int + 1 FROM melhores o JOIN jogador j ON j.id = o.jogador_id
                  WHERE ${VISIVEL} AND o.pontos > m.pontos) AS posicao
           FROM melhores m WHERE m.jogador_id = $2`,
        [filtro, eu],
      );
      const publico = req.jogador.ranking_publico && !req.jogador.banido;
      voce = {
        apelido: req.jogador.apelido,
        tag: req.jogador.tag,
        publico,
        pontos: minha?.pontos ?? null,
        rank: minha?.rank ?? null,
        posicao: minha && publico ? minha.posicao : null,
      };
    }

    return {
      periodo,
      ...(periodo === 'semana' ? { desde: filtro.toISOString() } : {}),
      ...(periodo === 'dia' ? { data: filtro } : {}),
      top,
      voce,
    };
  });

  app.post('/api/v1/partidas', { schema: esquemaAbrir, preHandler: autenticar, ...limite('partida') }, async (req, resp) => {
    const { modo, expressao, velocidade, relampago } = req.body;
    const agora = relogio();
    let dataDiario = null;
    if (modo === 'diario') {
      // só vale o desafio de hoje no fuso do jogo (senão daria para treinar o de amanhã antes)
      const hoje = dataNoFuso(agora);
      dataDiario = req.body.dataDiario ?? hoje;
      if (dataDiario !== hoje) throw new ErroHttp(422, 'diario_fora_do_dia', 'Esse desafio diário não está valendo agora');
    } else if (!expressao?.trim()) {
      throw new ErroHttp(422, 'conta_invalida', 'Conta vazia');
    }

    const multTempo = multDaVelocidade(velocidade);
    const m = montarPartida({ expressao, modo, dataDiario, multTempo, relampago: configRelampago(relampago) });
    if (!m.ok) throw new ErroHttp(422, 'conta_invalida', m.motivo);

    const operacao = modo !== 'normal' ? modo : m.res.ok ? (m.res.principal || 'num') : 'divzero';
    const previsto = duracaoPrevistaMs(m.plano);
    const p = await db.transacao(async (tx) => {
      // só 1 partida aberta por vez: abrir outra abandona a anterior
      await tx.query(`UPDATE partida SET status = 'expirada' WHERE jogador_id = $1 AND status = 'aberta'`, [req.jogador.id]);
      const [nova] = await tx.query(
        `INSERT INTO partida (jogador_id, expressao, resultado, operacao, n_fases, modo, velocidade,
                              duracao_prevista_ms, teto_coleta, data_diario, seed, iniciada_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, seed, iniciada_em`,
        [req.jogador.id, m.expressao, m.res.ok ? m.res.texto : null, operacao, m.plano.length, modo, multTempo,
          previsto, tetoColeta(m.plano), dataDiario, gerarSeed(), agora],
      );
      return nova;
    });

    const assinatura = assinarPartida(config.hmacPartida, { id: p.id, jogadorId: req.jogador.id, seed: p.seed, iniciadaEm: p.iniciada_em });
    return resp.status(201).send({
      id: p.id,
      assinatura,
      expiraEm: new Date(new Date(p.iniciada_em).getTime() + VALIDADE_PARTIDA_MS).toISOString(),
      expressao: m.expressao,
      resultado: m.res.ok ? m.res.texto : null,
      nFases: m.plano.length,
      duracaoPrevistaMs: previsto,
    });
  });

  app.post('/api/v1/partidas/:id/finalizar', { schema: esquemaFinalizar, preHandler: autenticar, ...limite('partida') }, async (req) => {
    const { assinatura, idempotencyKey, duracaoMs } = req.body;
    const agora = relogio();
    let expirou = false;

    const resposta = await db.transacao(async (tx) => {
      const [p] = await tx.query('SELECT * FROM partida WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!p || p.jogador_id !== req.jogador.id) throw new ErroHttp(404, 'partida_nao_encontrada', 'Partida não encontrada');

      if (p.status !== 'aberta') {
        // reenvio da mesma finalização: devolve o mesmo resultado, sem contar de novo
        if (p.idempotency_key === idempotencyKey) return { ...resumoPartida(p), repetida: true };
        throw new ErroHttp(409, 'partida_fechada', `Partida já está ${p.status}`);
      }
      if (!conferirAssinatura(config.hmacPartida, { id: p.id, jogadorId: p.jogador_id, seed: p.seed, iniciadaEm: p.iniciada_em }, assinatura)) {
        throw new ErroHttp(403, 'assinatura_invalida', 'Assinatura da partida inválida');
      }
      const decorridoMs = agora.getTime() - new Date(p.iniciada_em).getTime();
      if (decorridoMs > VALIDADE_PARTIDA_MS) {
        await tx.query(`UPDATE partida SET status = 'expirada' WHERE id = $1`, [p.id]);
        expirou = true;
        return null;
      }

      const stats = req.body.stats;
      const conferencia = conferirPartida({
        stats,
        duracaoMs,
        decorridoMs,
        nFases: p.n_fases,
        tetoColeta: p.teto_coleta,
        duracaoPrevistaMs: p.duracao_prevista_ms,
      });
      const brutos = [p.id, agora, duracaoMs, idempotencyKey, stats.coletados, stats.total, stats.danos, stats.auto, stats.pulou];

      if (!conferencia.ok) {
        const [r] = await tx.query(
          `UPDATE partida SET status = 'recusada', motivo_recusa = $10, finalizada_em = $2, duracao_ms = $3,
                  idempotency_key = $4, coletados = $5, total = $6, danos = $7, auto = $8, pulou = $9,
                  rapido = $11, combo_max = $12, xp_ganho = 0
            WHERE id = $1 RETURNING *`,
          [...brutos, conferencia.motivo, stats.rapido, stats.comboMax],
        );
        return resumoPartida(r);
      }

      const av = avaliarDesempenho(conferencia.stats, { multTempo: Number(p.velocidade) });
      const [r] = await tx.query(
        `UPDATE partida SET status = 'aceita', finalizada_em = $2, duracao_ms = $3, idempotency_key = $4,
                coletados = $5, total = $6, danos = $7, auto = $8, pulou = $9, rapido = $10, combo_max = $11,
                nota = $12, rank = $13, estrelas = $14, pontos = $15, xp_ganho = $16
          WHERE id = $1 RETURNING *`,
        [...brutos, conferencia.stats.rapido, stats.comboMax, av.nota, av.rank, av.estrelas, av.pontos, av.xp],
      );
      await tx.query('UPDATE jogador SET xp = xp + $2, partidas = partidas + 1, visto_em = $3 WHERE id = $1', [p.jogador_id, av.xp, agora]);
      if (p.modo === 'diario' && !r.auto && !r.pulou) {
        await tx.query(
          `INSERT INTO diario_tentativa (jogador_id, data, partida_id, melhor_pontos) VALUES ($1, $2, $3, $4)
           ON CONFLICT (jogador_id, data) DO UPDATE
             SET partida_id = EXCLUDED.partida_id, melhor_pontos = EXCLUDED.melhor_pontos
             WHERE diario_tentativa.melhor_pontos < EXCLUDED.melhor_pontos`,
          [p.jogador_id, p.data_diario, p.id, av.pontos],
        );
      }
      return resumoPartida(r);
    }).catch((e) => {
      if (ehViolacaoUnica(e)) throw new ErroHttp(409, 'chave_repetida', 'idempotencyKey já usada em outra partida');
      throw e;
    });

    if (expirou) throw new ErroHttp(410, 'partida_expirada', 'A partida passou de 10 minutos e expirou');
    return resposta;
  });

  return app;
}
