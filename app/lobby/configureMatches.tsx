/**
 * @file lobby/configureMatches.tsx
 * @description The room's match-selection screen — the wizard's matches step,
 * backed by the room's server-owned pool instead of the local store.
 *
 * A route rather than a modal, and rendering the very same `MatchList` the
 * single-player wizard's second step uses, so the host gets one consistent way to
 * pick fixtures: league filter, date, time range, the discovered catalogue, and
 * manual team entry. The previous in-lobby modal was a reduced reimplementation
 * that had drifted — most visibly it never sent `requestedAt`, so it could only
 * ever show today.
 *
 * `MatchList` is untouched by this: it already takes its writes as props, and
 * {@link useRoomMatchPool} supplies room-backed implementations.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text as TamaguiText } from "tamagui";

import MatchList from "../../components/setupGame/MatchList";
import { ShellActionButton, ShellScreen } from "../../components/ui";
import { useRoomConfigure } from "../../hooks/useRoomConfigure";
import { useRoomLobby } from "../../hooks/useRoomLobby";
import { useRoomMatchPool } from "../../hooks/useRoomMatchPool";

const normalizeParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const ConfigureRoomMatchesScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId: string;
    participantId: string;
  }>();
  const sessionId = normalizeParam(params.sessionId);
  const participantId = normalizeParam(params.participantId) || null;

  const lobby = useRoomLobby(sessionId || null, participantId);
  const configure = useRoomConfigure(lobby.snapshot, lobby.refresh);

  // Manual-entry fields are the caller's state in the wizard too, so they stay
  // here rather than inside MatchList.
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");

  const pool = useRoomMatchPool({
    roomMatches: lobby.snapshot?.matches ?? [],
    addMatch: configure.addMatch,
    removeMatch: configure.removeMatch,
  });

  /**
   * Mirrors the wizard's manual add: build the fixture from the two fields, hand it
   * to the pool as an append, then clear them. Routed through `setMatches` rather
   * than calling `addMatch` directly so both add paths converge on one place that
   * decides provenance.
   */
  const handleAddMatch = () => {
    if (!homeTeam.trim() || !awayTeam.trim()) {
      return;
    }
    pool.setMatches([
      ...pool.matches,
      {
        id: String(Date.now()),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeGoals: 0,
        awayGoals: 0,
      },
    ]);
    setHomeTeam("");
    setAwayTeam("");
  };

  return (
    <ShellScreen padded={false}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: 16, gap: 12, flex: 1 }}>
          <TamaguiText
            color="$color"
            fontSize={22}
            fontWeight="700"
            testID="configure-room-matches-title"
          >
            Select Matches
          </TamaguiText>
          <TamaguiText color="$colorMuted" fontSize={14}>
            {pool.matches.length} in this room
          </TamaguiText>

          {configure.error ? (
            <TamaguiText
              testID="configure-room-matches-error"
              color="$danger"
              fontSize={14}
            >
              {configure.error}
            </TamaguiText>
          ) : null}

          <View style={{ flex: 1 }}>
            <MatchList
              matches={pool.matches}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              setHomeTeam={setHomeTeam}
              setAwayTeam={setAwayTeam}
              handleAddMatch={handleAddMatch}
              handleRemoveMatch={pool.removeMatch}
              setGlobalMatches={pool.setMatches}
            />
          </View>

          <ShellActionButton
            variant="primary"
            label="Done"
            testID="configure-room-matches-done"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default ConfigureRoomMatchesScreen;
