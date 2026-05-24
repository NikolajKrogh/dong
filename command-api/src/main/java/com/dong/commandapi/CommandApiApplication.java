package com.dong.commandapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Entry point for the DONG command API.
 *
 * <p>{@code @ConfigurationPropertiesScan} activates {@code @ConfigurationProperties}
 * beans (e.g. {@code SupabaseProperties}). A missing/blank Supabase secret makes
 * bean validation fail and prevents startup — the fail-closed guarantee (FR-013).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class CommandApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(CommandApiApplication.class, args);
    }
}
