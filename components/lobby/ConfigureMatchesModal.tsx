import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, TouchableOpacity, View } from "react-native";
import { Text, XStack, YStack } from "tamagui";

import { buildRequestedAt } from "../../hooks/useMatchData";
import {
  formatDateIsoValue,
  parseDateIsoValue,
  PlatformDatePicker,
} from "../../platform";
import { useGameStore } from "../../store/store";
import type {
  AddRoomMatchRequest,
  RoomMatchSummary,
} from "../../types/room";
import {
  getMatchDiscoveryApiClient,
  type NormalizedMatch,
} from "../../utils/commandApiClient";
import { ShellActionButton } from "../ui";

interface ConfigureMatchesModalProps {
  visible: boolean;
  /** Matches already in the room's selected pool — rendered as "Added". */
  selectedMatches: RoomMatchSummary[];
  onAdd: (request: AddRoomMatchRequest) => void;
  onClose: () => void;
}

const toAddRequest = (match: NormalizedMatch): AddRoomMatchRequest => ({
  sourceProvider: "espn",
  sourceMatchId: match.id,
  homeTeamName: match.homeTeam,
  awayTeamName: match.awayTeam,
  kickoffAt: match.startDateTime,
});

const groupByLeague = (matches: NormalizedMatch[]) => {
  const groups = new Map<string, NormalizedMatch[]>();
  matches.forEach((match) => {
    const existing = groups.get(match.league) ?? [];
    existing.push(match);
    groups.set(match.league, existing);
  });
  return Array.from(groups.entries());
};

export const ConfigureMatchesModal: React.FC<ConfigureMatchesModalProps> = ({
  visible,
  selectedMatches,
  onAdd,
  onClose,
}) => {
  const configuredLeagues = useGameStore((state) => state.configuredLeagues);
  const [catalog, setCatalog] = useState<NormalizedMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /**
   * Which day's fixtures to browse. Without this the request omitted
   * `requestedAt`, pinning discovery to today — so during an off-season gap the
   * modal was empty with no way to look at another date.
   */
  const [selectedDate, setSelectedDate] = useState(() =>
    formatDateIsoValue(new Date()),
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    if (!visible || configuredLeagues.length === 0) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    getMatchDiscoveryApiClient()
      .discoverMatches({
        leagueCodes: configuredLeagues.map((l) => l.code),
        requestedAt: buildRequestedAt(selectedDate),
      })
      .then((matches) => {
        if (!cancelled) {
          setCatalog(matches);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the match catalog right now.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible, configuredLeagues, selectedDate]);

  const selectedSourceMatchIds = useMemo(
    () => new Set(selectedMatches.map((match) => match.sourceMatchId)),
    [selectedMatches],
  );

  const leagueGroups = useMemo(() => groupByLeague(catalog), [catalog]);

  const handleAdd = useCallback(
    (match: NormalizedMatch) => {
      onAdd(toAddRequest(match));
    },
    [onAdd],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: 24,
        }}
      >
        <YStack
          testID="configure-matches-modal"
          backgroundColor="$background"
          borderRadius="$6"
          gap="$3"
          padding="$5"
          width="100%"
          maxWidth={480}
          maxHeight="80%"
        >
          <Text color="$color" fontSize={20} fontWeight="700">
            Select Matches
          </Text>

          <XStack alignItems="center" gap="$2">
            <Text color="$colorMuted" fontSize={14}>
              Date
            </Text>
            <TouchableOpacity
              testID="configure-matches-date-button"
              onPress={() => setIsDatePickerOpen(true)}
            >
              <Text color="$color" fontSize={15} fontWeight="600">
                {parseDateIsoValue(selectedDate, new Date()).toLocaleDateString(
                  "en-GB",
                  { weekday: "short", day: "numeric", month: "short", year: "numeric" },
                )}
              </Text>
            </TouchableOpacity>
          </XStack>
          <PlatformDatePicker
            open={isDatePickerOpen}
            date={parseDateIsoValue(selectedDate, new Date())}
            onConfirm={(date) => {
              setIsDatePickerOpen(false);
              setSelectedDate(formatDateIsoValue(date));
            }}
            onCancel={() => setIsDatePickerOpen(false)}
          />

          {isLoading ? (
            <Text color="$colorMuted" fontSize={14}>
              Loading live fixtures…
            </Text>
          ) : null}

          {errorMessage ? (
            <Text color="$danger" fontSize={14} testID="configure-matches-error">
              {errorMessage}
            </Text>
          ) : null}

          {!isLoading && !errorMessage && leagueGroups.length === 0 ? (
            <Text
              color="$colorMuted"
              fontSize={14}
              testID="configure-matches-empty"
            >
              No fixtures in your configured leagues on this date.
            </Text>
          ) : null}

          <ScrollView>
            <YStack gap="$4">
              {leagueGroups.map(([league, matches]) => (
                <YStack key={league} gap="$2">
                  <Text color="$colorMuted" fontSize={13} fontWeight="700">
                    {league}
                  </Text>
                  {matches.map((match) => {
                    const isAdded = selectedSourceMatchIds.has(match.id);
                    return (
                      <XStack
                        key={match.id}
                        testID={`configure-match-${match.id}`}
                        alignItems="center"
                        justifyContent="space-between"
                        backgroundColor="$backgroundLight"
                        borderColor="$borderColorLight"
                        borderRadius="$5"
                        borderWidth={1}
                        gap="$2"
                        padding="$3"
                      >
                        <Text color="$color" fontSize={14} flex={1}>
                          {match.homeTeam} vs {match.awayTeam}
                        </Text>
                        <ShellActionButton
                          variant={isAdded ? "surface" : "primary"}
                          size="small"
                          widthMode="content"
                          label={isAdded ? "Added" : "Add"}
                          disabled={isAdded}
                          testID={`configure-match-add-${match.id}`}
                          onPress={() => handleAdd(match)}
                        />
                      </XStack>
                    );
                  })}
                </YStack>
              ))}
            </YStack>
          </ScrollView>

          <ShellActionButton
            variant="surface"
            label="Done"
            testID="configure-matches-close"
            onPress={onClose}
          />
        </YStack>
      </View>
    </Modal>
  );
};
