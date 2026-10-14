-- V4: consentimento do responsável (LGPD art. 14) para jogadores de até 12 anos.
-- Guarda quando o adulto autorizou e qual versão dos termos/política ele viu.
ALTER TABLE jogador
  ADD COLUMN consentimento_em timestamptz,
  ADD COLUMN consentimento_versao text;

-- NOT VALID: vale para cadastros novos sem barrar linhas antigas de teste.
ALTER TABLE jogador
  ADD CONSTRAINT ck_jogador_consentimento_crianca
  CHECK (faixa_etaria IN ('13+','60+') OR consentimento_em IS NOT NULL) NOT VALID;
