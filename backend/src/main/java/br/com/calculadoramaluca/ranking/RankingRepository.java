package br.com.calculadoramaluca.ranking;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RankingRepository extends JpaRepository<Ranking, Long> {

    /** As 10 maiores pontuações. */
    List<Ranking> findTop10ByOrderByPontosDescCriadoEmAsc();
}
