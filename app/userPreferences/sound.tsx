import React from "react";
import SoundNotificationSettings from "../../components/preferences/SoundNotificationSettings";
import SettingsPage from "../../components/preferences/SettingsPage";
import { useGameStore } from "../../store/store";

export default function SoundSettingsScreen() {
  const soundEnabled = useGameStore((state) => state.soundEnabled);
  const setSoundEnabled = useGameStore((state) => state.setSoundEnabled);
  const commonMatchNotificationsEnabled = useGameStore((state) => state.commonMatchNotificationsEnabled);
  const setCommonMatchNotificationsEnabled = useGameStore((state) => state.setCommonMatchNotificationsEnabled);
  return (
    <SettingsPage title="Sound & notifications">
      <SoundNotificationSettings
        showSectionTitle={false}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        commonMatchNotificationsEnabled={commonMatchNotificationsEnabled}
        setCommonMatchNotificationsEnabled={setCommonMatchNotificationsEnabled}
      />
    </SettingsPage>
  );
}
