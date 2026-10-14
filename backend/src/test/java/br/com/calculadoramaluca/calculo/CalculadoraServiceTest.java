package br.com.calculadoramaluca.calculo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import br.com.calculadoramaluca.calculo.CalculoException.Tipo;

/** Espelha tests/casos.js do front-end. */
class CalculadoraServiceTest {

    private final CalculadoraService service = new CalculadoraService();

    static Stream<Arguments> casosNumericos() {
        return Stream.of(
                // básicos
                Arguments.of("1+1", 2.0),
                Arguments.of("2+3*4", 14.0),
                Arguments.of("(2+3)*4", 20.0),
                Arguments.of("10-4-3", 3.0),
                Arguments.of("100/4/5", 5.0),
                Arguments.of("7/2", 3.5),
                Arguments.of("2*3+4*5", 26.0),
                // ponto flutuante
                Arguments.of("0.1+0.2", 0.3),
                Arguments.of("0.1+0.2-0.3", 0.0),
                Arguments.of("1.1*3", 3.3),
                Arguments.of("1/3*3", 1.0),
                Arguments.of("0.3-0.1", 0.2),
                Arguments.of("1/3", 0.333333333333),
                // negativos e unários
                Arguments.of("-5+3", -2.0),
                Arguments.of("-(2+3)", -5.0),
                Arguments.of("--4", 4.0),
                Arguments.of("3*-2", -6.0),
                Arguments.of("-2^2", -4.0),
                Arguments.of("(-2)^2", 4.0),
                // potência
                Arguments.of("2^10", 1024.0),
                Arguments.of("2^3^2", 512.0),
                Arguments.of("2^-1", 0.5),
                Arguments.of("4^0.5", 2.0),
                Arguments.of("10^15", 1e15),
                // raiz
                Arguments.of("√9", 3.0),
                Arguments.of("√2*√2", 2.0),
                Arguments.of("2√9", 6.0),
                Arguments.of("√(16)+1", 5.0),
                Arguments.of("√0", 0.0),
                // porcentagem
                Arguments.of("50%", 0.5),
                Arguments.of("200+10%", 220.0),
                Arguments.of("200-10%", 180.0),
                Arguments.of("200*10%", 20.0),
                Arguments.of("10%*200", 20.0),
                // parênteses e multiplicação implícita
                Arguments.of("2(3+4)", 14.0),
                Arguments.of("(1+2)(3+4)", 21.0),
                Arguments.of("((((5))))", 5.0),
                Arguments.of("(2+3", 5.0),
                // decimais e símbolos da UI
                Arguments.of(".5+.5", 1.0),
                Arguments.of("3,5+1", 4.5),
                Arguments.of("6×7", 42.0),
                Arguments.of("84÷2", 42.0),
                Arguments.of("9−10", -1.0),
                Arguments.of("1e3+1", 1001.0),
                Arguments.of("999999*999999", 999998000001.0));
    }

    static Stream<Arguments> casosDeErro() {
        return Stream.of(
                Arguments.of("", Tipo.SINTAXE),
                Arguments.of("2+", Tipo.SINTAXE),
                Arguments.of("*3", Tipo.SINTAXE),
                Arguments.of("1..2", Tipo.SINTAXE),
                Arguments.of("2)", Tipo.SINTAXE),
                Arguments.of("abc", Tipo.SINTAXE),
                Arguments.of("5/0", Tipo.DIVZERO),
                Arguments.of("1/(2-2)", Tipo.DIVZERO),
                Arguments.of("0^-1", Tipo.DIVZERO),
                Arguments.of("√-4", Tipo.DOMINIO),
                Arguments.of("(-8)^0.5", Tipo.DOMINIO),
                Arguments.of("10^400", Tipo.OVERFLOW));
    }

    @ParameterizedTest(name = "{0} = {1}")
    @MethodSource("casosNumericos")
    void calculaCorretamente(String expressao, double esperado) {
        assertEquals(esperado, service.calcular(expressao).valor(), 0.0);
    }

    @ParameterizedTest(name = "{0} gera {1}")
    @MethodSource("casosDeErro")
    void detectaErros(String expressao, Tipo esperado) {
        CalculoException e = assertThrows(CalculoException.class, () -> service.calcular(expressao));
        assertEquals(esperado, e.getTipo());
    }

    @Test
    void formataComoOFront() {
        assertEquals("1e20", CalculadoraService.formatar(1e20));
        assertEquals("0", CalculadoraService.formatar(-0.0));
        assertEquals("1000000", CalculadoraService.formatar(1_000_000));
        assertEquals("0.3", service.calcular("0.1+0.2").texto());
    }

    @Test
    void operacaoPrincipalEhAUltimaExecutada() {
        assertEquals("add", service.calcular("2+3*4").principal());
        assertEquals("mul", service.calcular("(2+3)*4").principal());
        assertEquals("pct", service.calcular("200+10%").principal());
    }
}
