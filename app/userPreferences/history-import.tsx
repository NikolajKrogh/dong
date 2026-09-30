import React from "react";
import LegacyHistoryImportSection from "../../components/preferences/LegacyHistoryImportSection";
import SettingsPage from "../../components/preferences/SettingsPage";

export default function HistoryImportSettingsScreen() {
  return <SettingsPage title="History import"><LegacyHistoryImportSection showSectionTitle={false} /></SettingsPage>;
}
