package br.com.calculadoramaluca.config;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import br.com.calculadoramaluca.calculo.CalculoException;

/** Respostas de erro padronizadas em JSON. */
@RestControllerAdvice
public class TratadorDeErros {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validacao(MethodArgumentNotValidException e) {
        Map<String, String> campos = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> campos.put(f.getField(), f.getDefaultMessage()));
        return ResponseEntity.badRequest().body(Map.of("erro", "validacao", "campos", campos));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> jsonInvalido(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(Map.of("erro", "json_invalido", "mensagem", "Corpo da requisição inválido"));
    }

    @ExceptionHandler(CalculoException.class)
    public ResponseEntity<Map<String, Object>> calculo(CalculoException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("erro", e.getTipo().name().toLowerCase(), "mensagem", e.getMessage()));
    }
}
