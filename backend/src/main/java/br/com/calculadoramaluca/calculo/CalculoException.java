package br.com.calculadoramaluca.calculo;

/** Erro de cálculo com o mesmo "tipo" usado pelo motor JavaScript. */
public class CalculoException extends RuntimeException {

    public enum Tipo { SINTAXE, DIVZERO, DOMINIO, OVERFLOW }

    private final Tipo tipo;

    public CalculoException(Tipo tipo, String mensagem) {
        super(mensagem);
        this.tipo = tipo;
    }

    public Tipo getTipo() {
        return tipo;
    }
}
