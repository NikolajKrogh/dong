import React from "react";
import { Animated, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../../styles/theme";
import { Player } from "../../../store/store";
import { createStyles } from "./styles";

interface PlayersSectionProps {
  affectedPlayersCount: number;
  playerColumns: Player[][];
  modalContentAnim: Animated.Value;
  styles: ReturnType<typeof createStyles>;
}

/** Affected-players list, laid out in columns, with an empty state. */
export const PlayersSection = ({
  affectedPlayersCount,
  playerColumns,
  modalContentAnim,
  styles,
}: PlayersSectionProps) => {
  const colors = useColors();

  return (
    <>
      {affectedPlayersCount > 0 && (
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={16} color={colors.textSecondary} />
          <Text style={styles.sectionTitle}>
            Players ({affectedPlayersCount})
          </Text>
        </View>
      )}

      {affectedPlayersCount > 0 ? (
        <View style={styles.compactContainer}>
          {playerColumns.map(
            (column, columnIndex) =>
              column.length > 0 && (
                <View
                  key={
                    column.map((player) => player.id).join("-") ||
                    `empty-${columnIndex}`
                  }
                  style={styles.playerColumn}
                >
                  {column.map((player) => (
                    <Animated.View
                      key={player.id}
                      style={[
                        styles.compactPlayerCard,
                        {
                          opacity: modalContentAnim,
                          transform: [
                            {
                              translateY: modalContentAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [5, 0], //NOSONAR - Animation value
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={styles.compactPlayerName}>
                        {player.name}
                      </Text>
                    </Animated.View>
                  ))}
                </View>
              ),
          )}
        </View>
      ) : (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="person-outline" size={24} color={colors.textMuted} />
          <Text style={styles.noPlayersText}>No players affected</Text>
        </View>
      )}
    </>
  );
};
