import type { Href, useRouter } from "expo-router";
import type { ReactNode } from "react";

export type TaskOverlayFallback = "/" | "/history" | "/gameProgress" | "/userPreferences/leagues";
export interface TaskOverlayControls {
  open: boolean;
  dismiss: () => void;
  runAfterDismiss: (action: () => void) => void;
}
export interface TaskOverlayProps {
  open: boolean;
  onClose: () => void;
  fallbackHref: TaskOverlayFallback;
  returnFocusId?: string;
  children: (controls: TaskOverlayControls) => ReactNode;
}

export function returnToParent(router: Pick<ReturnType<typeof useRouter>, "canGoBack" | "back" | "replace">, fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

export function normalizeOverlayFallback(value: unknown): TaskOverlayFallback {
  return value === "/history" || value === "/gameProgress" || value === "/userPreferences/leagues" ? value : "/";
}

type NavigationTree = { routes: readonly { key?: string; state?: NavigationTree }[] };
export function hasTaskOverlayOwner(state: NavigationTree, ownerKey: string): boolean {
  return state.routes.some((route) => route.key === ownerKey
    || (route.state !== undefined && hasTaskOverlayOwner(route.state, ownerKey)));
}
