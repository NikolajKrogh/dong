import { useEffect, useId, useState } from "react";
import { useNavigation, useRouter } from "expo-router";

import type { TaskOverlayProps } from "./taskNavigation.shared";
import {
  isTaskOverlayPresented, presentTaskOverlay, registerTaskOverlay,
  requestTaskOverlayDismiss, unregisterTaskOverlay, updateTaskOverlay,
} from "./taskOverlayRegistry";

/** The caller stays mounted; Expo Router owns the transparent overlay's history. */
export function TaskOverlay(props: TaskOverlayProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const id = useId();
  const [ownerKey] = useState(() => {
    const state = navigation.getState();
    return state?.routes[state.index]?.key ?? "";
  });

  useEffect(() => {
    registerTaskOverlay({ id, ownerKey, props });
    return () => unregisterTaskOverlay(id);
    // Registration lifetime belongs to the caller; props update separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ownerKey]);

  useEffect(() => { updateTaskOverlay(id, props); }, [id, props]);

  useEffect(() => {
    if (props.open && !isTaskOverlayPresented(id)) {
      const opener = typeof document !== "undefined" ? document.activeElement : null;
      presentTaskOverlay(id, undefined, () => {
        if (typeof document === "undefined" || typeof HTMLElement === "undefined") return;
        const replacement = props.returnFocusId
          ? document.getElementById(props.returnFocusId)
            ?? document.querySelector('[data-testid="' + CSS.escape(props.returnFocusId) + '"]')
          : null;
        const target = replacement ?? (opener instanceof HTMLElement && opener.isConnected ? opener : null);
        if (target instanceof HTMLElement && target.isConnected) target.focus();
      });
      router.push({ pathname: "/taskOverlay", params: { overlayId: id, parent: props.fallbackHref } });
    } else if (!props.open && isTaskOverlayPresented(id)) {
      requestTaskOverlayDismiss(id);
    }
  }, [id, props.open, props.fallbackHref, props.returnFocusId, router]);

  return null;
}
