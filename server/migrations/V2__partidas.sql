-- V2: partidas assinadas (o servidor calcula conta, fases, pontos e rank) e tentativas do diário.
CREATE TYPE modo_partida AS ENUM ('normal','chefe','diario');
CREATE TYPE status_partida AS ENUM ('aberta','aceita','recusada','expirada');

CREATE TABLE partida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jogador_id uuid NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  expressao varchar(200) NOT NULL,
  resultado varchar(60),
  operacao text NOT NULL CHECK (operacao IN ('add','sub','mul','div','pow','sqrt','pct','divzero','num','chefe','diario')),
  n_fases smallint NOT NULL CHECK (n_fases BETWEEN 1 AND 20),
  modo modo_partida NOT NULL,
  velocidade numeric(3,2) NOT NULL CHECK (velocidade BETWEEN 0.5 AND 2.0),
  -- previstos pelo servidor ao abrir (regras-partida.js): base da conferência de plausibilidade
  duracao_prevista_ms integer NOT NULL CHECK (duracao_prevista_ms > 0),
  teto_coleta smallint NOT NULL CHECK (teto_coleta >= 0),
  data_diario date,
  seed bigint NOT NULL,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  finalizada_em timestamptz,
  duracao_ms integer CHECK (duracao_ms BETWEEN 0 AND 600000),
  status status_partida NOT NULL DEFAULT 'aberta',
  motivo_recusa text,
  idempotency_key uuid UNIQUE,
  -- números brutos declarados pelo cliente (guardados para a detecção de trapaça)
  coletados numeric(5,1) CHECK (coletados >= 0),
  total smallint CHECK (total >= 0),
  danos smallint CHECK (danos >= 0),
  rapido boolean,
  -- calculados pelo servidor
  nota smallint CHECK (nota BETWEEN 0 AND 100),
  rank char(1) CHECK (rank IN ('S','A','B','C','D')),
  estrelas smallint CHECK (estrelas BETWEEN 1 AND 3),
  pontos integer CHECK (pontos BETWEEN 0 AND 1000000),
  xp_ganho integer CHECK (xp_ganho >= 0),
  combo_max smallint CHECK (combo_max >= 0),
  auto boolean NOT NULL DEFAULT false,
  pulou boolean NOT NULL DEFAULT false,
  CHECK ((modo = 'diario') = (data_diario IS NOT NULL)),
  CHECK (status <> 'aceita' OR (pontos IS NOT NULL AND finalizada_em IS NOT NULL)),
  CHECK (finalizada_em IS NULL OR finalizada_em >= iniciada_em)
);
CREATE INDEX ix_partida_jogador_data ON partida (jogador_id, iniciada_em DESC);
CREATE INDEX ix_partida_abertas ON partida (iniciada_em) WHERE status = 'aberta';
-- no máximo 1 partida aberta por jogador
CREATE UNIQUE INDEX ux_partida_aberta ON partida (jogador_id) WHERE status = 'aberta';
CREATE INDEX ix_rank_global ON partida (pontos DESC, finalizada_em)
  WHERE status = 'aceita' AND NOT auto AND NOT pulou;
CREATE INDEX ix_rank_periodo ON partida (finalizada_em, pontos DESC)
  WHERE status = 'aceita' AND NOT auto AND NOT pulou;
CREATE INDEX ix_rank_diario ON partida (data_diario, pontos DESC)
  WHERE modo = 'diario' AND status = 'aceita' AND NOT auto AND NOT pulou;

-- só a melhor tentativa válida (sem auto-play e sem pulo) de cada dia
CREATE TABLE diario_tentativa (
  jogador_id uuid NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  data date NOT NULL,
  partida_id uuid NOT NULL REFERENCES partida(id) ON DELETE CASCADE,
  melhor_pontos integer NOT NULL CHECK (melhor_pontos >= 0),
  PRIMARY KEY (jogador_id, data)
);
