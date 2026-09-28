import React from "react";
import AppearanceSettings from "../../components/preferences/AppearanceSettings";
import SettingsPage from "../../components/preferences/SettingsPage";

export default function AppearanceScreen() {
  return <SettingsPage title="Appearance"><AppearanceSettings showSectionTitle={false} /></SettingsPage>;
}
