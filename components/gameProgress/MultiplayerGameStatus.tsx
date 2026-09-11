import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import type { ActiveGameSyncStatus, PendingGameplayMutation } from "../../hooks/useActiveGameRoomSync";
import { ShellCard } from "../ui";

interface MultiplayerGameStatusProps {
  status: ActiveGameSyncStatus;
  error: string | null;
  pendingMutations: PendingGameplayMutation[];
  onRefresh: () => void;
  onRetryMutation: (id: string) => void;
}

const STATUS_COPY: Record<ActiveGameSyncStatus, string> = {
  idle: "",
  hydrating: "Recovering the shared game…",
  ready: "Shared game · synced",
  refreshing: "Saving to the shared game…",
  offline: "Reconnect to continue shared play.",
  ended: "Game complete · results are read-only",
  access_lost: "You no longer have access to this room.",
  error: "The shared game needs attention.",
};

/** Small status strip for multiplayer recovery and mutation state. */
export function MultiplayerGameStatus({
  status,
  error,
  pendingMutations,
  onRefresh,
  onRetryMutation,
}: MultiplayerGameStatusProps) {
  if (status === "idle") return null;

  const showRefresh =
    status === "offline" || status === "access_lost" || status === "error";
  const uncertain = pendingMutations.filter(
    (mutation) => mutation.status === "uncertain",
  );

  return (
    <ShellCard compact>
      <View style={{ gap: 8 }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View
            style={{ alignItems: "center", flexDirection: "row", gap: 8, flex: 1 }}
          >
            {status === "hydrating" || status === "refreshing" ? (
              <ActivityIndicator size="small" />
            ) : null}
            <Text style={{ flexShrink: 1 }}>{STATUS_COPY[status]}</Text>
          </View>
          {showRefresh ? (
            <TouchableOpacity onPress={onRefresh} accessibilityRole="button">
              <Text>Refresh</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? <Text style={{ color: "#dc3545" }}>{error}</Text> : null}
        {uncertain.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text>
              A change may have reached the room. Retry to resolve it safely.
            </Text>
            {uncertain.map((mutation) => (
              <TouchableOpacity
                key={mutation.id}
                onPress={() => onRetryMutation(mutation.id)}
                accessibilityRole="button"
              >
                <Text>Retry</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </ShellCard>
  );
}
