package com.urbanheat.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI urbanHeatOpenApi() {
        return new OpenAPI()
                .info(new Info().title("Urban Heat Mitigation DSS - Backend API").version("1.0.0")
                        .description("REST API for authentication, datasets, analysis runs, indicators, hotspots, AI predictions, "
                                + "SHAP explanations, mitigation recommendations, cost analysis, prioritisation and PDF reports. "
                                + "Use POST /api/auth/login, then click 'Authorize' and paste the token."))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }
}
