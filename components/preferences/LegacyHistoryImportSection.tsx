import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, View } from "react-native";

import { useColors } from "../../styles/theme";
import { createUserPreferencesStyles } from "../../styles/userPreferencesStyles";
import { useLegacyHistoryImport } from "../../hooks/useLegacyHistoryImport";
import { ShellActionButton, ShellCard, ShellSection } from "../ui";
import LegacyHistoryImportClaimantModal from "./LegacyHistoryImportClaimantModal";

const formatSummaryCount = (count: number) => {
  return count.toString();
};

const formatImportStatus = (
  importedCount: number,
  skippedCount: number,
  failedCount: number,
) => {
  return `Imported ${importedCount}, skipped ${skippedCount}, failed ${failedCount}.`;
};

const buildStatusMessage = ({
  importError,
  importResult,
  importPhase,
  isCheckingAvailability,
  hasLocalHistory,
  hasClaimantOptions,
  availabilityReason,
}: {
  importError: string | null;
  importResult: ReturnType<typeof useLegacyHistoryImport>["importResult"];
  importPhase: ReturnType<typeof useLegacyHistoryImport>["importPhase"];
  isCheckingAvailability: boolean;
  hasLocalHistory: boolean;
  hasClaimantOptions: boolean;
  availabilityReason: string | null;
}) => {
  if (importError) {
    return importError;
  }

  if (importResult) {
    if (importPhase === "completed") {
      return `Import completed successfully. ${formatImportStatus(
        importResult.summary.importedCount,
        importResult.summary.skippedCount,
        importResult.summary.failedCount,
      )}`;
    }

    if (importPhase === "failed") {
      return `Import finished with failures. ${formatImportStatus(
        importResult.summary.importedCount,
        importResult.summary.skippedCount,
        importResult.summary.failedCount,
      )} Retry the claimant selection to try again.`;
    }

    return formatImportStatus(
      importResult.summary.importedCount,
      importResult.summary.skippedCount,
      importResult.summary.failedCount,
    );
  }

  if (isCheckingAvailability) {
    return "Checking cloud access...";
  }

  if (!hasLocalHistory) {
    return "No local history saved on this device yet.";
  }

  if (!hasClaimantOptions) {
    return "No eligible participants were found in your saved history.";
  }

  if (availabilityReason) {
    return availabilityReason;
  }

  return "Choose which saved participant should represent your cloud account, then start the one-time import.";
};

const getButtonLabel = (
  isImporting: boolean,
  importPhase: ReturnType<typeof useLegacyHistoryImport>["importPhase"],
) => {
  if (isImporting) {
    return "Importing...";
  }

  if (importPhase === "completed") {
    return "Import Complete";
  }

  if (importPhase === "failed") {
    return "Retry Import";
  }

  return "Import Local History";
};

const LegacyHistoryImportSection: React.FC = () => {
  const colors = useColors();
  const { legacyHistoryImportStyles } = React.useMemo(
    () => createUserPreferencesStyles(colors),
    [colors],
  );
  const [showClaimantModal, setShowClaimantModal] = useState(false);

  const {
    claimantOptions,
    historySessionCount,
    hasLocalHistory,
    isConfigured,
    authChecked,
    isImporting,
    importPhase,
    canStartImport,
    canRetryImport,
    availabilityReason,
    importError,
    importResult,
    importHistory,
  } = useLegacyHistoryImport();

  const isCheckingAvailability = isConfigured && !authChecked;
  const hasClaimantOptions = claimantOptions.length > 0;
  const hasAmbiguousClaimants = claimantOptions.some(
    (option) => option.ambiguousSessionIds.length > 0,
  );
  let buttonVariant: "primary" | "secondary" | "success" = "primary";

  if (importPhase === "completed") {
    buttonVariant = "success";
  } else if (canRetryImport) {
    buttonVariant = "secondary";
  }

  let buttonIconName:
    | "checkmark-circle-outline"
    | "refresh-outline"
    | "cloud-upload-outline" = "cloud-upload-outline";

  if (importPhase === "completed") {
    buttonIconName = "checkmark-circle-outline";
  } else if (canRetryImport) {
    buttonIconName = "refresh-outline";
  }

  const statusMessage = buildStatusMessage({
    importError,
    importResult,
    importPhase,
    isCheckingAvailability,
    hasLocalHistory,
    hasClaimantOptions,
    availabilityReason,
  });

  let statusTextStyle;

  if (importError) {
    statusTextStyle = legacyHistoryImportStyles.statusTextError;
  } else if (importResult) {
    statusTextStyle = legacyHistoryImportStyles.statusTextSuccess;
  }

  const actionDisabled =
    !canStartImport || isCheckingAvailability || Boolean(availabilityReason);

  const buttonLabel = getButtonLabel(isImporting, importPhase);

  return (
    <ShellSection title="History Import" marginBottom="$3">
      <ShellCard compact testID="LegacyHistoryImportSection">
        <Text style={legacyHistoryImportStyles.description}>
          Import the sessions saved on this device into your cloud account once.
        </Text>

        <View style={legacyHistoryImportStyles.summaryRow}>
          <Text style={legacyHistoryImportStyles.summaryLabel}>
            Saved sessions
          </Text>
          <Text style={legacyHistoryImportStyles.summaryValue}>
            {formatSummaryCount(historySessionCount)}
          </Text>
        </View>

        <View style={legacyHistoryImportStyles.summaryRow}>
          <Text style={legacyHistoryImportStyles.summaryLabel}>
            Claimant options
          </Text>
          <Text style={legacyHistoryImportStyles.summaryValue}>
            {formatSummaryCount(claimantOptions.length)}
          </Text>
        </View>

        {hasAmbiguousClaimants ? (
          <Text style={legacyHistoryImportStyles.warningText}>
            Some names appear more than once inside a saved session and cannot
            be claimed safely.
          </Text>
        ) : null}

        <View style={legacyHistoryImportStyles.statusPanel}>
          <Text
            style={[legacyHistoryImportStyles.statusText, statusTextStyle]}
            testID="LegacyHistoryImportStatus"
          >
            {statusMessage}
          </Text>

          {importResult ? (
            <>
              <View style={legacyHistoryImportStyles.resultSummaryRow}>
                <Text style={legacyHistoryImportStyles.resultSummaryLabel}>
                  Imported
                </Text>
                <Text style={legacyHistoryImportStyles.resultSummaryValue}>
                  {formatSummaryCount(importResult.summary.importedCount)}
                </Text>
              </View>
              <View style={legacyHistoryImportStyles.resultSummaryRow}>
                <Text style={legacyHistoryImportStyles.resultSummaryLabel}>
                  Skipped
                </Text>
                <Text style={legacyHistoryImportStyles.resultSummaryValue}>
                  {formatSummaryCount(importResult.summary.skippedCount)}
                </Text>
              </View>
              <View style={legacyHistoryImportStyles.resultSummaryRow}>
                <Text style={legacyHistoryImportStyles.resultSummaryLabel}>
                  Failed
                </Text>
                <Text style={legacyHistoryImportStyles.resultSummaryValue}>
                  {formatSummaryCount(importResult.summary.failedCount)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={legacyHistoryImportStyles.buttonContainer}>
          <ShellActionButton
            testID="LegacyHistoryImportButton"
            label={buttonLabel}
            variant={buttonVariant}
            disabled={actionDisabled}
            onPress={() => setShowClaimantModal(true)}
            icon={
              <Ionicons
                name={buttonIconName}
                size={18}
                color={colors.textLight}
              />
            }
          />
        </View>
      </ShellCard>

      <LegacyHistoryImportClaimantModal
        visible={showClaimantModal}
        claimantOptions={claimantOptions}
        isImporting={isImporting}
        onClose={() => setShowClaimantModal(false)}
        onSelectClaimant={async (claimant) => {
          setShowClaimantModal(false);
          await importHistory(claimant);
        }}
      />
    </ShellSection>
  );
};

export default LegacyHistoryImportSection;
