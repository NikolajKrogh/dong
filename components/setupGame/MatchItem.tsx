import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "../../app/store";
import styles from "../../app/style/setupGameStyles";

interface MatchItemProps {
  match: Match;
  selectedCommonMatch: string | null;
  handleSelectCommonMatch: (id: string) => void;
  handleRemoveMatch: (id: string) => void;
}

const MatchItem: React.FC<MatchItemProps> = ({
  match,
  selectedCommonMatch,
  handleSelectCommonMatch,
  handleRemoveMatch,
}) => {
  return (
    <View style={styles.matchItemWrapper}>
      <TouchableOpacity
        onPress={() => handleSelectCommonMatch(match.id)}
        activeOpacity={0.6}
        style={[
          styles.assignmentItem,
          selectedCommonMatch === match.id && styles.selectedAssignmentItem,
        ]}
      >
        <View style={styles.assignmentItemContent}>
          <Text style={styles.matchText}>
            {match.homeTeam} vs {match.awayTeam}
          </Text>
          {selectedCommonMatch === match.id ? (
            <Ionicons name="checkmark-circle" size={20} color="#007bff" />
          ) : (
            <Ionicons name="ellipse-outline" size={20} color="#777" />
          )}
        </View>

        <TouchableOpacity
          style={styles.subtleDeleteButton}
          onPress={() => handleRemoveMatch(match.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#999" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

export default MatchItem;
