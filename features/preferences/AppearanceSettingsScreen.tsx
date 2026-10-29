import React from "react";
import AppearanceSettings from "./AppearanceSettings";
import SettingsPage from "./SettingsPage";

export default function AppearanceSettingsScreen() {
  return <SettingsPage title="Appearance"><AppearanceSettings showSectionTitle={false} /></SettingsPage>;
}
