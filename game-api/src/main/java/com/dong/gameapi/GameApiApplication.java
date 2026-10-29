package com.dong.gameapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Entry point for the DONG game API.
 *
 * <p>{@code @ConfigurationPropertiesScan} activates {@code @ConfigurationProperties}
 * beans (e.g. {@code SupabaseProperties}). Missing required Supabase URLs fail
 * bean validation and prevent startup. JWT verification uses published signing
 * keys; the service does not hold a shared JWT signing secret.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class GameApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(GameApiApplication.class, args);
    }
}
