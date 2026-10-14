-- V1: jogadores anônimos (sem e-mail, sem nome real) e seus tokens.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE jogador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- letras com acento são aceitas (JOÃO, CAÇADOR); o servidor também valida antes de gravar
  apelido citext NOT NULL CHECK (apelido ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _]{3,12}$'),
  tag smallint NOT NULL CHECK (tag BETWEEN 1000 AND 9999),
  faixa_etaria text NOT NULL CHECK (faixa_etaria IN ('4-7','8-12','13+','60+')),
  -- desligado por padrão: o cadastro liga só para 13+ e 60+; para 4 a 12 anos quem liga é o responsável
  ranking_publico boolean NOT NULL DEFAULT false,
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  partidas integer NOT NULL DEFAULT 0 CHECK (partidas >= 0),
  banido boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  visto_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (apelido, tag)
);

-- só o hash (HMAC-SHA256 com pepper) do token fica no banco
CREATE TABLE jogador_token (
  token_hash bytea PRIMARY KEY CHECK (length(token_hash) = 32),
  jogador_id uuid NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz
);
CREATE INDEX ix_token_jogador ON jogador_token(jogador_id);

CREATE TABLE codigo_recuperacao (
  codigo_hash bytea PRIMARY KEY,
  jogador_id uuid NOT NULL REFERENCES jogador(id) ON DELETE CASCADE,
  expira_em timestamptz NOT NULL,
  usado_em timestamptz
);
