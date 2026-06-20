package com.dong.commandapi.match.espn;

import java.time.LocalDate;

public interface EspnClient {

    EspnScoreboardResponse fetchScoreboard(String leagueCode, LocalDate matchDate);
}