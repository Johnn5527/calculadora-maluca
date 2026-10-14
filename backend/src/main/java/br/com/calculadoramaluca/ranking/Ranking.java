package br.com.calculadoramaluca.ranking;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

/** Uma pontuação de minijogo. */
@Entity
public class Ranking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String nome;

    @Column(nullable = false)
    private int pontos;

    @Column(nullable = false, length = 1)
    private String rank;

    @Column(nullable = false, length = 10)
    private String operacao;

    @Column(nullable = false)
    private Instant criadoEm = Instant.now();

    protected Ranking() {
        // exigido pelo JPA
    }

    public Ranking(String nome, int pontos, String rank, String operacao) {
        this.nome = nome;
        this.pontos = pontos;
        this.rank = rank;
        this.operacao = operacao;
    }

    public Long getId() { return id; }
    public String getNome() { return nome; }
    public int getPontos() { return pontos; }
    public String getRank() { return rank; }
    public String getOperacao() { return operacao; }
    public Instant getCriadoEm() { return criadoEm; }
}
