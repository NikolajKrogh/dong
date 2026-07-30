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
 * The chrome deliberately borrows `SetupWizard`'s style keys rather than being
 * invented here: the same bordered `surface` panel, the same scroll region, and
 * the same bottom navigation bar. `SetupWizard` itself is not reused because it
 * hard-codes the solo flow's four steps. Mounting a wizard step's content in a
 * screen that looked nothing like the wizard was the substance of the "doesn't
 * match the feel of the app" feedback.
 *
 * `MatchList` is untouched by this: it already takes its writes as props, and
 * {@link useRoomMatchPool} supplies room-backed implementations.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Text as TamaguiText } from "tamagui";

import MatchList from "../../components/setupGame/MatchList";
import AppIcon from "../../components/AppIcon";
import { ShellScreen } from "../../components/ui";
import { useRoomConfigure } from "../../hooks/useRoomConfigure";
import { useRoomLobby } from "../../hooks/useRoomLobby";
import { useRoomMatchPool } from "../../hooks/useRoomMatchPool";
import { isWideLayout as isWideViewport } from "../../styles/responsive";
import createSetupGameStyles from "../../styles/setupGameStyles";
import { useColors } from "../../styles/theme";

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

  const { width } = useWindowDimensions();
  const wideLayout = isWideViewport(width);
  const colors = useColors();
  const styles = useMemo(() => createSetupGameStyles(colors), [colors]);

  const lobby = useRoomLobby(sessionId || null, participantId);
  const configure = useRoomConfigure(lobby.snapshot, lobby.refresh);

  // Manual-entry fields are the caller's state in the wizard too, so they stay
  // here rather than inside MatchList.
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");

  const pool = useRoomMatchPool({
    roomMatches: lobby.snapshot?.matches ?? [],
    addMatches: configure.addMatches,
    removeMatch: configure.removeMatch,
    removeMatches: configure.removeMatches,
    // A repeat fixture is skipped rather than failed, so without this the host
    // would select ten, see eight land, and have no idea why.
    onBatchAdded: ({ added, skipped }) => {
      if (skipped > 0) {
        Toast.show({
          type: "themedWarning",
          text1: `Added ${added}`,
          text2: `${skipped} already in this room.`,
          position: "bottom",
        });
      }
    },
  });

  return (
    <ShellScreen
      padded={false}
      centerContent={wideLayout}
      contentMaxWidth={wideLayout ? 1120 : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={[
            styles.wizardContainer,
            wideLayout && styles.wizardWideLayout,
          ]}
        >
          <View style={styles.wizardMainPanel}>
            {/*
              MatchList needs a scrolling ancestor: the shared match-card list it
              renders the pool through sets `scrollEnabled={false}`, and
              MatchList's own layout style carries no flex while its inner results
              style is `flex: 1`. Put that in a fixed-height flex box rather than a
              ScrollView and the list collapses to nothing, silently hiding every
              added match. `stepContentScroll` is the wizard's own key for exactly
              this job.
            */}
            <ScrollView
              style={styles.stepContentScroll}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {/*
                Padded to line up with MatchList's own `tabContent` inset below,
                which is the only padding inside the panel — the screen used to add
                a second 16 on top of it, double-insetting the filter cards.
              */}
              <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 4 }}>
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
              </View>

              {/*
                `showSectionTitle={false}` because this screen supplies its own
                heading; leaving both on stacked two titles from two different type
                systems. `disableSelection` while a write is in flight: unlike the
                solo flow, releasing a match here is a server round-trip.
              */}
              <MatchList
                matches={pool.matches}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                setHomeTeam={setHomeTeam}
                setAwayTeam={setAwayTeam}
                handleRemoveMatch={pool.removeMatch}
                setGlobalMatches={pool.setMatches}
                showSectionTitle={false}
                disableSelection={configure.isBusy}
              />
            </ScrollView>

            <View
              testID="configure-room-matches-navigation"
              style={[
                styles.wizardNavigation,
                wideLayout && styles.wizardNavigationWide,
              ]}
            >
              <TouchableOpacity
                testID="configure-room-matches-back"
                style={[styles.navButton, wideLayout && styles.navButtonWide]}
                onPress={() => router.back()}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <AppIcon
                    name="arrow-back"
                    size={20}
                    color={colors.textLight}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.navButtonText}>Back</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                testID="configure-room-matches-done"
                style={[styles.navButton, wideLayout && styles.navButtonWide]}
                onPress={() => router.back()}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.navButtonText}>Done</Text>
                  {/* arrow-forward, matching the wizard's Next: the icon set has
                      no checkmark and this stays inside the app's vocabulary. */}
                  <AppIcon
                    name="arrow-forward"
                    size={20}
                    color={colors.textLight}
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ShellScreen>
  );
};

export default ConfigureRoomMatchesScreen;
