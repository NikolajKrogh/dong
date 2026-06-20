package com.dong.commandapi.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless security. Public: OpenAPI docs + actuator health.
 * Protected: everything under {@code /v1/**} and metrics endpoints.
 *
 * <p>
 * Filter placement: {@code SupabaseJwtFilter} is positioned just before
 * {@link AuthorizationFilter} (after {@code ExceptionTranslationFilter} at
 * order 3100) so that {@code ExceptionTranslationFilter} wraps it and can
 * route {@link InvalidTokenException} → {@link ApiAuthenticationEntryPoint}.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

        private static final String[] PUBLIC_PATHS = {
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/actuator/health",
                        "/actuator/health/**"
        };

        private final SupabaseJwtFilter supabaseJwtFilter;
        private final ApiAuthenticationEntryPoint authenticationEntryPoint;
        private final ApiAccessDeniedHandler accessDeniedHandler;

        public SecurityConfig(SupabaseJwtFilter supabaseJwtFilter,
                        ApiAuthenticationEntryPoint authenticationEntryPoint,
                        ApiAccessDeniedHandler accessDeniedHandler) {
                this.supabaseJwtFilter = supabaseJwtFilter;
                this.authenticationEntryPoint = authenticationEntryPoint;
                this.accessDeniedHandler = accessDeniedHandler;
        }

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .csrf(csrf -> csrf.disable())
                                .cors(Customizer.withDefaults())
                                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .formLogin(form -> form.disable())
                                .httpBasic(basic -> basic.disable())
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(PUBLIC_PATHS).permitAll()
                                                .requestMatchers(HttpMethod.GET, "/v1/matches").permitAll()
                                                .requestMatchers("/v1/**").authenticated()
                                                .anyRequest().denyAll())
                                .exceptionHandling(ex -> ex
                                                .authenticationEntryPoint(authenticationEntryPoint)
                                                .accessDeniedHandler(accessDeniedHandler))
                                .addFilterBefore(supabaseJwtFilter, AuthorizationFilter.class);
                return http.build();
        }

        /** Dev-only CORS, active only when {@code command-api.cors.enabled=true}. */
        @Bean
        @ConditionalOnProperty(prefix = "command-api.cors", name = "enabled", havingValue = "true")
        public CorsConfigurationSource corsConfigurationSource(CorsProperties props) {
                CorsConfiguration config = new CorsConfiguration();
                config.setAllowedOrigins(props.allowedOrigins());
                config.setAllowedMethods(props.allowedMethods());
                config.setAllowedHeaders(props.allowedHeaders());
                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", config);
                return source;
        }
}
