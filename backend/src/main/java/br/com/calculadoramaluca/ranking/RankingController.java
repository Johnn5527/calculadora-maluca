package br.com.calculadoramaluca.ranking;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/ranking")
public class RankingController {

    public record RankingRequest(
            @NotBlank @Size(max = 16) String nome,
            @NotNull @Min(0) @Max(1_000_000) Integer pontos,
            @NotBlank @Pattern(regexp = "[SABCD]", message = "rank deve ser S, A, B, C ou D") String rank,
            @NotBlank @Pattern(regexp = "add|sub|mul|div|pow|sqrt|pct|divzero|num|chefe|diario", message = "operação desconhecida") String operacao) { }

    private final RankingRepository repositorio;

    public RankingController(RankingRepository repositorio) {
        this.repositorio = repositorio;
    }

    @GetMapping
    public List<Ranking> listar() {
        return repositorio.findTop10ByOrderByPontosDescCriadoEmAsc();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Ranking salvar(@Valid @RequestBody RankingRequest req) {
        String nome = req.nome().trim().toUpperCase();
        return repositorio.save(new Ranking(nome, req.pontos(), req.rank(), req.operacao()));
    }
}
