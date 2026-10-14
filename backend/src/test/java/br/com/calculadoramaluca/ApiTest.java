package br.com.calculadoramaluca;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ApiTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void rankingValidaEntrada() throws Exception {
        mvc.perform(post("/api/ranking").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"\",\"pontos\":-1,\"rank\":\"Z\",\"operacao\":\"hack\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("validacao"));
    }

    @Test
    void rankingSalvaEListaOrdenado() throws Exception {
        mvc.perform(post("/api/ranking").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"teclito\",\"pontos\":999,\"rank\":\"S\",\"operacao\":\"add\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nome").value("TECLITO"));
        mvc.perform(get("/api/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pontos").value(999));
    }

    @Test
    void historicoRecalculaNoServidor() throws Exception {
        // o cliente "mente" o resultado; o servidor recalcula
        mvc.perform(post("/api/historico").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expressao\":\"0.1+0.2\",\"resultado\":\"999\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.resultado").value("0.3"));
    }

    @Test
    void historicoRecusaDivisaoPorZero() throws Exception {
        mvc.perform(post("/api/historico").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expressao\":\"5/0\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.erro").value("divzero"));
    }
}
