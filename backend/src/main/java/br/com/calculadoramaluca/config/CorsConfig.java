package br.com.calculadoramaluca.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Libera o front (servidor estático em outra porta) para chamar a API. */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final String[] origens;

    public CorsConfig(@Value("${app.cors.origens}") String[] origens) {
        this.origens = origens;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(origens)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("Content-Type")
                .maxAge(3600);
    }
}
