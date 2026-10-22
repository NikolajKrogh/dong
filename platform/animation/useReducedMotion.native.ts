import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    let settingChanged = false;
    const update = (value: boolean) => { if (mounted) setReduceMotion(value); };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => {
      settingChanged = true;
      update(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (!settingChanged) update(value); }).catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduceMotion;
}
