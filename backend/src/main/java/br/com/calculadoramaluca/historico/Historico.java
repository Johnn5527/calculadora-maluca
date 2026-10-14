package br.com.calculadoramaluca.historico;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

/** Uma conta feita na calculadora (o resultado é recalculado no servidor). */
@Entity
public class Historico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String expressao;

    @Column(nullable = false, length = 60)
    private String resultado;

    @Column(nullable = false)
    private Instant criadoEm = Instant.now();

    protected Historico() {
        // exigido pelo JPA
    }

    public Historico(String expressao, String resultado) {
        this.expressao = expressao;
        this.resultado = resultado;
    }

    public Long getId() { return id; }
    public String getExpressao() { return expressao; }
    public String getResultado() { return resultado; }
    public Instant getCriadoEm() { return criadoEm; }
}
