import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "../../styles/theme";
import { createUserPreferencesStyles } from "../../styles/userPreferencesStyles";
import type { LegacyHistoryDerivedClaimantOption } from "../../utils/legacyHistoryImport";

interface LegacyHistoryImportClaimantModalProps {
  visible: boolean;
  claimantOptions: LegacyHistoryDerivedClaimantOption[];
  isImporting: boolean;
  onClose: () => void;
  onSelectClaimant: (
    claimant: LegacyHistoryDerivedClaimantOption,
  ) => Promise<void> | void;
}

const formatSessionCount = (sessionCount: number) => {
  return `${sessionCount} saved session${sessionCount === 1 ? "" : "s"}`;
};

const formatAmbiguousSessionCount = (ambiguousSessionCount: number) => {
  return `Unavailable: duplicate name in ${ambiguousSessionCount} saved session${
    ambiguousSessionCount === 1 ? "" : "s"
  }.`;
};

const LegacyHistoryImportClaimantModal: React.FC<
  LegacyHistoryImportClaimantModalProps
> = ({ visible, claimantOptions, isImporting, onClose, onSelectClaimant }) => {
  const colors = useColors();
  const { legacyHistoryImportStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors],
  );

  const hasClaimantOptions = claimantOptions.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={legacyHistoryImportStyles.modalSafeArea}
        testID="LegacyHistoryImportClaimantModal"
      >
        <View style={legacyHistoryImportStyles.modalHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={legacyHistoryImportStyles.modalCloseButton}
            testID="LegacyHistoryImportClaimantModalClose"
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={legacyHistoryImportStyles.modalHeaderTitle}>
            Choose Your Player
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={legacyHistoryImportStyles.modalContent}>
          <Text style={legacyHistoryImportStyles.modalDescription}>
            Pick the local participant that should be linked to your signed-in
            account. Everyone else stays as a session-scoped guest snapshot.
          </Text>

          {hasClaimantOptions ? (
            <FlatList
              data={claimantOptions}
              keyExtractor={(item) => item.normalizedName}
              renderItem={({ item }) => {
                const isAmbiguous = item.ambiguousSessionIds.length > 0;

                return (
                  <TouchableOpacity
                    testID={`LegacyHistoryClaimantOption-${item.id}`}
                    style={[
                      legacyHistoryImportStyles.claimantOptionRow,
                      isAmbiguous
                        ? legacyHistoryImportStyles.claimantOptionRowDisabled
                        : null,
                    ]}
                    disabled={isAmbiguous || isImporting}
                    onPress={() => {
                      void onSelectClaimant(item);
                    }}
                  >
                    <View
                      style={legacyHistoryImportStyles.claimantOptionContent}
                    >
                      <Text
                        style={legacyHistoryImportStyles.claimantOptionName}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={legacyHistoryImportStyles.claimantOptionMeta}
                      >
                        {formatSessionCount(item.sessionCount)}
                      </Text>
                      {isAmbiguous ? (
                        <Text
                          style={
                            legacyHistoryImportStyles.claimantOptionWarning
                          }
                        >
                          {formatAmbiguousSessionCount(
                            item.ambiguousSessionIds.length,
                          )}
                        </Text>
                      ) : null}
                    </View>

                    <Ionicons
                      name={
                        isAmbiguous ? "warning-outline" : "cloud-upload-outline"
                      }
                      size={20}
                      color={isAmbiguous ? colors.warning : colors.primary}
                    />
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={legacyHistoryImportStyles.modalEmptyState}>
              <Text style={legacyHistoryImportStyles.modalEmptyTitle}>
                No Claimant Options Available
              </Text>
              <Text style={legacyHistoryImportStyles.modalEmptyMessage}>
                Save at least one local session with named participants before
                starting the import.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default LegacyHistoryImportClaimantModal;
