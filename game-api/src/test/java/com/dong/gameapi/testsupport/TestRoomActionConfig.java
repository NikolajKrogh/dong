package com.dong.gameapi.testsupport;

import com.dong.gameapi.roomaction.RoomActionContext;
import com.dong.gameapi.roomaction.RoomActionHandler;
import com.dong.gameapi.roomaction.RoomActionResult;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** Envelope fixture registered only by tests, never by the production component scan. */
@TestConfiguration
public class TestRoomActionConfig {
    @Bean
    RoomActionHandler envelopeTestAction() {
        return new RoomActionHandler() {
            public String actionType() { return "test-action"; }
            public RoomActionResult handleAction(RoomActionContext context) { return RoomActionResult.accepted(); }
        };
    }
}
