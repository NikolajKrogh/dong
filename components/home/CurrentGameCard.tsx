import React from "react";
import { Text, View } from "react-native";

import AppIcon from "../AppIcon";
import { ShellActionButton, ShellCard } from "../ui";
import createStyles from "../../styles/indexStyles";
import { useColors } from "../../styles/theme";

interface CurrentGameCardProps {
  colors: ReturnType<typeof useColors>;
  styles: ReturnType<typeof createStyles>;
  matchesCount: number;
  playersCount: number;
  onContinue: () => void;
  onCancel: () => void;
}

export const CurrentGameCard: React.FC<CurrentGameCardProps> = ({
  colors,
  styles,
  matchesCount,
  playersCount,
  onContinue,
  onCancel,
}) => {
  return (
    <ShellCard
      elevated
      testID="home-current-game-card"
      style={{ marginTop: 16, marginBottom: 16 }}
    >
      <Text style={styles.sessionTitle}>Current Game in Progress</Text>
      <View style={styles.sessionInfoRow}>
        <View style={styles.infoItem}>
          <AppIcon name="people" size={22} color={colors.primary} />
          <Text style={styles.infoText}>{playersCount} Players</Text>
        </View>
        <View style={styles.infoItem}>
          <AppIcon name="football" size={22} color={colors.primary} />
          <Text style={styles.infoText}>{matchesCount} Matches</Text>
        </View>
      </View>

      <ShellActionButton
        variant="success"
        label="Continue Game"
        icon={<AppIcon name="play" size={22} color={colors.white} />}
        onPress={onContinue}
      />

      <ShellActionButton
        variant="danger"
        label="Cancel Game"
        icon={
          <AppIcon name="close-circle-outline" size={22} color={colors.white} />
        }
        onPress={onCancel}
        style={{ marginTop: 12 }}
      />
    </ShellCard>
  );
};

export default CurrentGameCard;
