import React, { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useLocalSearchParams, useRootNavigationState, useRouter } from "expo-router";
import { Text, YStack } from "tamagui";

import { ShellActionButton, ShellScreen } from "../components/ui";
import { getTaskOverlay, subscribeTaskOverlays, presentTaskOverlay, finishTaskOverlay } from "../platform/navigation/taskOverlayRegistry";
import { normalizeOverlayFallback, type TaskOverlayControls, type TaskOverlayProps } from "../platform/navigation/taskNavigation.shared";

export default function TaskOverlayRoute() {
  const params = useLocalSearchParams<{ overlayId?: string; parent?: string }>();
  const id = typeof params.overlayId === "string" ? params.overlayId : "";
  const fallbackHref = normalizeOverlayFallback(params.parent);
  const router = useRouter();
  const state = useRootNavigationState();
  const entry = useSyncExternalStore(subscribeTaskOverlays, () => getTaskOverlay(id), () => undefined);
  const available = entry && state.routes.some((route) => route.key === entry.ownerKey);
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
    presentTaskOverlay(id, dismiss);
    return () => {
      finishTaskOverlay(id);
      const action = pendingAction.current;
      if (action) queueMicrotask(action);
    };
  }, [available, dismiss, id]);

  if (!available) {
    return <ShellScreen centerContent>
      <YStack padding="$5" gap="$4">
        <Text accessibilityRole="header">This panel is no longer available</Text>
        <Text>Return to the page and open it again.</Text>
        <ShellActionButton label="Return to page" onPress={() => router.replace(fallbackHref)} />
        {fallbackHref !== "/" ? <ShellActionButton label="Home" variant="surface" onPress={() => router.replace("/")} /> : null}
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
