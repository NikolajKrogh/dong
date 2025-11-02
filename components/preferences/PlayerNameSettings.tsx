import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../app/style/theme";
import { createUserPreferencesStyles } from "../../app/style/userPreferencesStyles";

interface PlayerNameSettingsProps {
  playerName: string | null;
  onSave: (name: string) => void;
}

/**
 * Player Name Settings Component
 * Allows users to set/update their default player name for multiplayer games
 */
const PlayerNameSettings: React.FC<PlayerNameSettingsProps> = ({
  playerName,
  onSave,
}) => {
  const colors = useColors();
  const { commonStyles, settingsStyles } = createUserPreferencesStyles(colors);
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(playerName || "");

  const handleSave = () => {
    const trimmedName = tempName.trim();
    if (!trimmedName) {
      Alert.alert("Invalid Name", "Please enter a valid name");
      return;
    }
    onSave(trimmedName);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempName(playerName || "");
    setIsEditing(false);
  };

  return (
    <View style={commonStyles.section}>
      <Text style={commonStyles.sectionTitle}>Player Name</Text>
      <Text style={commonStyles.sectionDescription}>
        Set your default name for multiplayer games
      </Text>

      <View style={settingsStyles.settingCard}>
        <View style={settingsStyles.settingRow}>
          <View style={settingsStyles.settingIconContainer}>
            <Ionicons name="person" size={24} color={colors.primary} />
          </View>
          <View style={settingsStyles.settingContent}>
            {isEditing ? (
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[
                    settingsStyles.settingInput,
                    {
                      backgroundColor: colors.backgroundLight,
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    },
                  ]}
                  value={tempName}
                  onChangeText={setTempName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textPlaceholder}
                  autoFocus={true}
                  autoCapitalize="words"
                />
                <View style={settingsStyles.buttonRow}>
                  <TouchableOpacity
                    style={[settingsStyles.button, settingsStyles.cancelButton]}
                    onPress={handleCancel}
                  >
                    <Text
                      style={[
                        settingsStyles.buttonText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[settingsStyles.button, settingsStyles.saveButton]}
                    onPress={handleSave}
                  >
                    <Text
                      style={[
                        settingsStyles.buttonText,
                        { color: colors.white },
                      ]}
                    >
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={settingsStyles.settingLabel}>Name</Text>
                  <Text style={settingsStyles.settingValue}>
                    {playerName || "Not set"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="create-outline"
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

export default PlayerNameSettings;
