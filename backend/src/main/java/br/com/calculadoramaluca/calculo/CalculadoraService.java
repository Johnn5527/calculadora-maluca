package br.com.calculadoramaluca.calculo;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import br.com.calculadoramaluca.calculo.CalculoException.Tipo;

/**
 * Port fiel do motor JavaScript (js/math/parser.js + js/math/engine.js).
 * Descida recursiva, sem eval, com o mesmo arredondamento:
 * 15 dígitos significativos nas operações intermediárias e 12 no resultado final.
 */
@Service
public class CalculadoraService {

    public static final int DIGITOS_INTERNOS = 15;
    public static final int DIGITOS_FINAIS = 12;
    public static final int TAMANHO_MAXIMO = 200;

    /** Resultado do cálculo. principal = última operação executada (add, sub, mul...). */
    public record Resultado(double valor, String texto, String principal) { }

    /* ===================== Árvore sintática ===================== */

    sealed interface No permits Num, Neg, Raiz, Pct, Bin { }
    record Num(double valor) implements No { }
    record Neg(No arg) implements No { }
    record Raiz(No arg) implements No { }
    record Pct(No arg) implements No { }
    record Bin(char op, No esq, No dir) implements No { }

    private record Token(String tipo, String valor, double numero, int pos) { }

    private static final Map<Character, String> SIMBOLOS = Map.ofEntries(
            Map.entry('+', "+"),
            Map.entry('-', "-"), Map.entry('−', "-"), Map.entry('–', "-"),
            Map.entry('*', "*"), Map.entry('×', "*"), Map.entry('x', "*"), Map.entry('X', "*"), Map.entry('·', "*"),
            Map.entry('/', "/"), Map.entry('÷', "/"), Map.entry(':', "/"),
            Map.entry('^', "^"),
            Map.entry('%', "%"),
            Map.entry('√', "√"));

    /* ===================== API pública ===================== */

    public Resultado calcular(String expressao) {
        List<Token> tokens = tokenizar(expressao);
        if (tokens.isEmpty()) {
            throw new CalculoException(Tipo.SINTAXE, "Expressão vazia");
        }
        Parser parser = new Parser(tokens, expressao.length());
        No arvore = parser.expressao();
        if (parser.i < tokens.size()) {
            throw new CalculoException(Tipo.SINTAXE, "Símbolo inesperado \"" + tokens.get(parser.i).valor() + "\"");
        }
        List<String> ops = new ArrayList<>();
        double bruto = avaliar(arvore, ops);
        double valor = arredondar(verificar(bruto), DIGITOS_FINAIS);
        String principal = ops.isEmpty() ? null : ops.get(ops.size() - 1);
        return new Resultado(valor, formatar(valor), principal);
    }

    /** Arredonda para N dígitos significativos (mesma regra do toPrecision do JS). */
    public static double arredondar(double x, int digitos) {
        if (!Double.isFinite(x)) {
            return x;
        }
        if (x == 0) {
            return 0.0; // também elimina o -0
        }
        return new BigDecimal(x).round(new MathContext(digitos, RoundingMode.HALF_UP)).doubleValue();
    }

    /** Formata como o visor do front (notação científica só para valores extremos). */
    public static String formatar(double x) {
        if (Double.isNaN(x)) {
            return "ERRO";
        }
        if (Double.isInfinite(x)) {
            return x > 0 ? "∞" : "-∞";
        }
        if (x == 0) {
            return "0";
        }
        double abs = Math.abs(x);
        BigDecimal bd = BigDecimal.valueOf(arredondar(x, DIGITOS_FINAIS)).stripTrailingZeros();
        if (abs >= 1e15 || abs < 1e-9) {
            return bd.toString().replace("E+", "e").replace("E", "e");
        }
        return bd.toPlainString();
    }

    /* ===================== Tokenizador ===================== */

    private List<Token> tokenizar(String texto) {
        if (texto == null) {
            throw new CalculoException(Tipo.SINTAXE, "Expressão inválida");
        }
        if (texto.length() > TAMANHO_MAXIMO) {
            throw new CalculoException(Tipo.SINTAXE, "Expressão longa demais");
        }
        List<Token> tokens = new ArrayList<>();
        int i = 0;
        while (i < texto.length()) {
            char c = texto.charAt(i);
            if (Character.isWhitespace(c)) {
                i++;
                continue;
            }
            if (Character.isDigit(c) || c == '.' || c == ',') {
                int inicio = i;
                StringBuilder corpo = new StringBuilder();
                int pontos = 0;
                while (i < texto.length() && (Character.isDigit(texto.charAt(i)) || texto.charAt(i) == '.' || texto.charAt(i) == ',')) {
                    char d = texto.charAt(i);
                    if (d == '.' || d == ',') {
                        pontos++;
                        corpo.append('.');
                    } else {
                        corpo.append(d);
                    }
                    i++;
                }
                if (pontos > 1) {
                    throw new CalculoException(Tipo.SINTAXE, "Número com dois pontos decimais");
                }
                if (corpo.toString().equals(".")) {
                    throw new CalculoException(Tipo.SINTAXE, "Ponto decimal sozinho");
                }
                // notação científica: 1e5, 2.5e-3
                if (i < texto.length() && (texto.charAt(i) == 'e' || texto.charAt(i) == 'E')
                        && i + 1 < texto.length() && (Character.isDigit(texto.charAt(i + 1)) || texto.charAt(i + 1) == '+' || texto.charAt(i + 1) == '-')) {
                    corpo.append('e');
                    i++;
                    if (texto.charAt(i) == '+' || texto.charAt(i) == '-') {
                        corpo.append(texto.charAt(i++));
                    }
                    if (i >= texto.length() || !Character.isDigit(texto.charAt(i))) {
                        throw new CalculoException(Tipo.SINTAXE, "Expoente inválido");
                    }
                    while (i < texto.length() && Character.isDigit(texto.charAt(i))) {
                        corpo.append(texto.charAt(i++));
                    }
                }
                String numTexto = corpo.toString();
                if (numTexto.endsWith(".")) {
                    numTexto = numTexto + "0";
                }
                if (numTexto.startsWith(".")) {
                    numTexto = "0" + numTexto;
                }
                double valor = Double.parseDouble(numTexto);
                if (!Double.isFinite(valor)) {
                    throw new CalculoException(Tipo.SINTAXE, "Número inválido");
                }
                tokens.add(new Token("num", texto.substring(inicio, i), valor, inicio));
                continue;
            }
            if (c == '(' || c == ')') {
                tokens.add(new Token(String.valueOf(c), String.valueOf(c), 0, i));
                i++;
                continue;
            }
            String op = SIMBOLOS.get(c);
            if (op != null) {
                tokens.add(new Token("op", op, 0, i));
                i++;
                continue;
            }
            throw new CalculoException(Tipo.SINTAXE, "Símbolo desconhecido \"" + c + "\"");
        }
        return tokens;
    }

    /* ===================== Parser (descida recursiva) ===================== */

    private static final class Parser {
        private final List<Token> tokens;
        private final int tamanhoTexto;
        private int i = 0;
        private int profundidade = 0;

        Parser(List<Token> tokens, int tamanhoTexto) {
            this.tokens = tokens;
            this.tamanhoTexto = tamanhoTexto;
        }

        private Token ver() {
            return i < tokens.size() ? tokens.get(i) : null;
        }

        private Token comer() {
            return i < tokens.size() ? tokens.get(i++) : null;
        }

        private boolean ehOp(Token t, String... ops) {
            if (t == null || !t.tipo().equals("op")) {
                return false;
            }
            for (String o : ops) {
                if (o.equals(t.valor())) {
                    return true;
                }
            }
            return false;
        }

        private boolean comecaFator(Token t) {
            return t != null && (t.tipo().equals("num") || t.tipo().equals("(") || ehOp(t, "√"));
        }

        No expressao() {
            No no = termo();
            while (ehOp(ver(), "+", "-")) {
                char op = comer().valor().charAt(0);
                no = new Bin(op, no, termo());
            }
            return no;
        }

        No termo() {
            No no = unario();
            while (true) {
                Token t = ver();
                if (ehOp(t, "*", "/")) {
                    comer();
                    no = new Bin(t.valor().charAt(0), no, unario());
                } else if (comecaFator(t)) {
                    no = new Bin('*', no, unario()); // multiplicação implícita
                } else {
                    break;
                }
            }
            return no;
        }

        No unario() {
            Token t = ver();
            if (ehOp(t, "-", "+")) {
                comer();
                No arg = unario();
                return t.valor().equals("-") ? new Neg(arg) : arg;
            }
            if (ehOp(t, "√")) {
                comer();
                return new Raiz(unario());
            }
            return potencia();
        }

        No potencia() {
            No base = posfixo();
            if (ehOp(ver(), "^")) {
                comer();
                return new Bin('^', base, unario());
            }
            return base;
        }

        No posfixo() {
            No no = primario();
            while (ehOp(ver(), "%")) {
                comer();
                no = new Pct(no);
            }
            return no;
        }

        No primario() {
            Token t = comer();
            if (t == null) {
                throw new CalculoException(Tipo.SINTAXE, "Expressão incompleta");
            }
            if (t.tipo().equals("num")) {
                return new Num(t.numero());
            }
            if (t.tipo().equals("(")) {
                if (++profundidade > 50) {
                    throw new CalculoException(Tipo.SINTAXE, "Parênteses demais");
                }
                No no = expressao();
                profundidade--;
                Token f = ver();
                if (f != null && f.tipo().equals(")")) {
                    comer();
                } else if (f != null) {
                    throw new CalculoException(Tipo.SINTAXE, "Esperava \")\" mas veio \"" + f.valor() + "\"");
                }
                // fim da expressão: fecha o parêntese automaticamente
                return no;
            }
            throw new CalculoException(Tipo.SINTAXE, "Símbolo inesperado \"" + t.valor() + "\" (posição " + t.pos() + " de " + tamanhoTexto + ")");
        }
    }

    /* ===================== Avaliação ===================== */

    private double avaliar(No no, List<String> ops) {
        if (no instanceof Num n) {
            return n.valor();
        }
        if (no instanceof Neg n) {
            return arredondar(-avaliar(n.arg(), ops), DIGITOS_INTERNOS);
        }
        if (no instanceof Raiz r) {
            double v = avaliar(r.arg(), ops);
            if (v < 0) {
                throw new CalculoException(Tipo.DOMINIO, "Raiz de número negativo");
            }
            ops.add("sqrt");
            return arredondar(Math.sqrt(v), DIGITOS_INTERNOS);
        }
        if (no instanceof Pct p) {
            double v = avaliar(p.arg(), ops);
            ops.add("pct");
            return arredondar(v / 100, DIGITOS_INTERNOS);
        }
        Bin b = (Bin) no;
        // porcentagem contextual: 200 + 10% = 220
        if ((b.op() == '+' || b.op() == '-') && b.dir() instanceof Pct pct) {
            double a = avaliar(b.esq(), ops);
            double p = avaliar(pct.arg(), ops);
            double parcela = arredondar(a * p / 100, DIGITOS_INTERNOS);
            ops.add("pct");
            return verificar(arredondar(b.op() == '+' ? a + parcela : a - parcela, DIGITOS_INTERNOS));
        }
        double a = avaliar(b.esq(), ops);
        double c = avaliar(b.dir(), ops);
        double r;
        switch (b.op()) {
            case '+' -> { r = a + c; ops.add("add"); }
            case '-' -> { r = a - c; ops.add("sub"); }
            case '*' -> { r = a * c; ops.add("mul"); }
            case '/' -> {
                if (c == 0) {
                    throw new CalculoException(Tipo.DIVZERO, "Divisão por zero");
                }
                r = a / c;
                ops.add("div");
            }
            case '^' -> {
                if (a == 0 && c < 0) {
                    throw new CalculoException(Tipo.DIVZERO, "Zero elevado a negativo é divisão por zero");
                }
                r = Math.pow(a, c);
                if (Double.isNaN(r)) {
                    throw new CalculoException(Tipo.DOMINIO, "Potência fracionária de número negativo");
                }
                ops.add("pow");
            }
            default -> throw new CalculoException(Tipo.SINTAXE, "Operador desconhecido " + b.op());
        }
        return verificar(arredondar(r, DIGITOS_INTERNOS));
    }

    private static double verificar(double r) {
        if (!Double.isFinite(r)) {
            throw new CalculoException(Tipo.OVERFLOW, "Número grande demais até para o dragão");
        }
        return r;
    }
}
