package br.com.calculadoramaluca.historico;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HistoricoRepository extends JpaRepository<Historico, Long> {

    /** As 20 contas mais recentes. */
    List<Historico> findTop20ByOrderByCriadoEmDesc();
}
