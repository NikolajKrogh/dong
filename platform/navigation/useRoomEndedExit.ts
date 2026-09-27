import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler } from "react-native";
import { useAppVisibility } from "../visibility/useAppVisibility";

export function useRoomEndedExit(onExit: () => void) {
  const { isInteractive } = useAppVisibility();
  const [screenReader, setScreenReader] = useState<boolean | null>(null);
  const [remainingMs, setRemainingMs] = useState(5000);
  const remaining = useRef(5000);
  const exited = useRef(false);
  const exitCallback = useRef(onExit);
  useEffect(() => { exitCallback.current = onExit; }, [onExit]);
  const exit = useCallback(() => {
    if (exited.current) return;
    exited.current = true;
    exitCallback.current();
  }, []);

  useEffect(() => {
    let mounted = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener?.("screenReaderChanged", (enabled) => {
      changed = true;
      setScreenReader(enabled);
    });
    Promise.resolve().then(() => AccessibilityInfo.isScreenReaderEnabled?.() ?? true).then((enabled) => {
      if (mounted && !changed) setScreenReader(enabled);
    }).catch(() => {
      if (mounted && !changed) setScreenReader(true);
    });
    return () => { mounted = false; subscription?.remove(); };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      exit();
      return true;
    });
    return () => subscription.remove();
  }, [exit]);

  useEffect(() => {
    if (!isInteractive || screenReader !== false || exited.current) return;
    const startedAt = Date.now();
    const initial = remaining.current;
    const update = () => {
      remaining.current = Math.max(0, initial - (Date.now() - startedAt));
      setRemainingMs(remaining.current);
      if (remaining.current === 0) exit();
    };
    const timer = setInterval(update, 100);
    return () => {
      clearInterval(timer);
      remaining.current = Math.max(0, initial - (Date.now() - startedAt));
    };
  }, [exit, isInteractive, screenReader]);

  return { exit, seconds: Math.ceil(remainingMs / 1000), progress: remainingMs / 5000, automatic: screenReader === false };
}
