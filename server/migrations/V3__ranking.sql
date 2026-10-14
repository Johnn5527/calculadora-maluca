-- V3: índices do ranking (melhor partida de cada jogador e ranking do desafio do dia).
CREATE INDEX ix_rank_melhor_do_jogador ON partida (jogador_id, pontos DESC, finalizada_em)
  WHERE status = 'aceita' AND NOT auto AND NOT pulou;
CREATE INDEX ix_diario_tentativa_dia ON diario_tentativa (data, melhor_pontos DESC);
