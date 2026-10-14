package br.com.calculadoramaluca.historico;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.calculadoramaluca.calculo.CalculadoraService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/historico")
public class HistoricoController {

    /** O cliente manda a expressão; o resultado enviado é ignorado e recalculado aqui (regra de ouro). */
    public record HistoricoRequest(
            @NotBlank @Size(max = 200) String expressao,
            @Size(max = 60) String resultado) { }

    private final HistoricoRepository repositorio;
    private final CalculadoraService calculadora;

    public HistoricoController(HistoricoRepository repositorio, CalculadoraService calculadora) {
        this.repositorio = repositorio;
        this.calculadora = calculadora;
    }

    @GetMapping
    public List<Historico> listar() {
        return repositorio.findTop20ByOrderByCriadoEmDesc();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Historico salvar(@Valid @RequestBody HistoricoRequest req) {
        String resultado = calculadora.calcular(req.expressao()).texto();
        return repositorio.save(new Historico(req.expressao(), resultado));
    }
}
