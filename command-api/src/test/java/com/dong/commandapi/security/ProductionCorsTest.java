package com.dong.commandapi.security;

import com.dong.commandapi.testsupport.JwksTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "supabase.jwks-url=https://example.invalid/.well-known/jwks.json",
        "supabase.url=http://localhost:9",
        "COMMAND_API_CORS_ALLOWED_ORIGINS=https://dong.example,https://dong.pages.dev"
})
@ActiveProfiles("prod")
@AutoConfigureMockMvc
@Import(JwksTestSupport.TestJwksConfig.class)
class ProductionCorsTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void productionAllowsConfiguredOriginsAndRejectsOthers() throws Exception {
        for (String origin : new String[]{"https://dong.example", "https://dong.pages.dev"}) {
            mockMvc.perform(options("/v1/rooms/test/commands/noop")
                            .header("Origin", origin)
                            .header("Access-Control-Request-Method", "POST")
                            .header("Access-Control-Request-Headers", "authorization,content-type,idempotency-key"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", origin));
        }
        mockMvc.perform(options("/v1/matches")
                        .header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
