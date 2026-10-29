package com.dong.gameapi.footballmatch;

import com.dong.gameapi.footballmatch.dto.NormalizedMatch;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.nio.file.Path;
import java.util.Arrays;
import static org.assertj.core.api.Assertions.assertThat;

class MatchLifecycleContractTest {
    @Test
    void wireValuesMatchTheSharedClientLifecycleMatrix() throws Exception {
        String[] expected = new ObjectMapper().readValue(
                Path.of("../__tests__/fixtures/matchCatalog/lifecycles.json").toFile(), String[].class);
        assertThat(Arrays.stream(NormalizedMatch.MatchStatus.values()).map(NormalizedMatch.MatchStatus::wireValue))
                .containsExactlyInAnyOrder(expected);
    }
}
