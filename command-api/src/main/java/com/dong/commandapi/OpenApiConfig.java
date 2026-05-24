package com.dong.commandapi;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata + the {@code bearerAuth} security scheme. Lives at the
 * package root (not a single-file {@code config/} package). springdoc
 * generates {@code /v3/api-docs} and {@code /swagger-ui.html} from this plus
 * controller annotations (code-first — research.md ADR-8).
 */
@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "DONG Command API",
                version = "1.0.0",
                description = "Authenticated command endpoints for multiplayer room and gameplay writes."
        )
)
@SecurityScheme(
        name = "bearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT"
)
public class OpenApiConfig {
}
