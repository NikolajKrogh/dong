import React, { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useLocalSearchParams, useRootNavigationState, useRouter } from "expo-router";
import { Platform } from "react-native";
import { Text, YStack } from "tamagui";

import { ShellActionButton, ShellScreen } from "../components/ui";
import { getTaskOverlay, subscribeTaskOverlays, presentTaskOverlay } from "../platform/navigation/taskOverlayRegistry";
import { normalizeOverlayFallback, hasTaskOverlayOwner, type TaskOverlayControls, type TaskOverlayProps } from "../platform/navigation/taskNavigation.shared";

export default function TaskOverlayRoute() {
  const params = useLocalSearchParams<{ overlayId?: string; parent?: string }>();
  const id = typeof params.overlayId === "string" ? params.overlayId : "";
  const fallbackHref = normalizeOverlayFallback(params.parent);
  const router = useRouter();
  const state = useRootNavigationState();
  const entry = useSyncExternalStore(subscribeTaskOverlays, () => getTaskOverlay(id), () => undefined);
  const available = entry && hasTaskOverlayOwner(state, entry.ownerKey);
  const pendingAction = useRef<(() => void) | undefined>(undefined);
  const closing = useRef(false);

  const dismiss = useCallback((action?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    pendingAction.current = action;
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  }, [fallbackHref, router]);

  useEffect(() => {
    if (!available) return;
    const finish = presentTaskOverlay(id, dismiss);
    return () => {
      finish();
      const action = pendingAction.current;
      if (action) queueMicrotask(action);
    };
  }, [available, dismiss, id]);

  if (!available) {
    return <ShellScreen centerContent>
      <YStack padding="$5" gap="$4">
        <Text {...(Platform.OS === "web" ? { role: "heading", "aria-level": 1 } : { accessibilityRole: "header" })}>This panel is no longer available</Text>
        <Text>Return Home, then open the page again.</Text>
        <ShellActionButton label="Home" onPress={() => router.dismissTo("/")} />
      </YStack>
    </ShellScreen>;
  }
  return <TaskOverlayContent render={entry.props.children} controls={{
    open: true,
    dismiss: () => dismiss(),
    runAfterDismiss: (action) => dismiss(action),
  }} />;
}

function TaskOverlayContent({ render, controls }: {
  render: TaskOverlayProps["children"];
  controls: TaskOverlayControls;
}) {
  return <>{render(controls)}</>;
}
