import React from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import styles from "../../app/style/setupGameStyles";
import { SetupGamePlayerList, MatchList, AssignmentSection } from "../index";

interface ActiveTabProps {
  activeTab: string;
  renderPlayersTab: () => React.ReactNode;
  renderMatchesTab: () => React.ReactNode;
  renderAssignTab: () => React.ReactNode;
  handleStartGame: () => void;
}

const ActiveTabView: React.FC<ActiveTabProps> = ({
  activeTab,
  renderPlayersTab,
  renderMatchesTab,
  renderAssignTab,
  handleStartGame,
}) => {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <ScrollView>
        {activeTab === "players" && renderPlayersTab()}
        {activeTab === "matches" && renderMatchesTab()}
        {activeTab === "assign" && renderAssignTab()}

        <TouchableOpacity style={styles.startButton} onPress={handleStartGame}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ActiveTabView;
