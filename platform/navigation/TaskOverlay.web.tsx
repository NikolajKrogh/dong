import { useEffect, useLayoutEffect, useId, useState } from "react";
import { useNavigation, useRouter } from "expo-router";

import type { TaskOverlayProps } from "./taskNavigation.shared";
import {
  isTaskOverlayPresented, presentTaskOverlay, registerTaskOverlay,
  requestTaskOverlayDismiss, unregisterTaskOverlay, updateTaskOverlay,
} from "./taskOverlayRegistry";

/** The caller stays mounted; Expo Router owns the transparent overlay's history. */
export function TaskOverlay(props: TaskOverlayProps) {
  const navigation = useNavigation();
  const id = useId();
  const [ownerKey] = useState(() => {
    const state = navigation.getState();
    return state?.routes[state.index]?.key ?? "";
  });

  useLayoutEffect(() => {
    registerTaskOverlay({ id, ownerKey, props });
    return () => unregisterTaskOverlay(id);
    // Registration lifetime belongs to the caller; props update separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ownerKey]);

  useLayoutEffect(() => { updateTaskOverlay(id, props); }, [id, props]);

  return props.open ? <OverlayPresentation id={id} fallbackHref={props.fallbackHref} returnFocusId={props.returnFocusId} /> : null;
}

function OverlayPresentation({ id, fallbackHref, returnFocusId }: Pick<TaskOverlayProps, "fallbackHref" | "returnFocusId"> & { id: string }) {
  const router = useRouter();
  useEffect(() => {
    if (isTaskOverlayPresented(id)) return;
    const opener = typeof document !== "undefined" ? document.activeElement : null;
    presentTaskOverlay(id, undefined, () => {
      if (typeof document === "undefined" || typeof HTMLElement === "undefined") return;
      const replacement = returnFocusId
        ? document.getElementById(returnFocusId)
          ?? document.querySelector('[data-testid="' + CSS.escape(returnFocusId) + '"]')
        : null;
      const target = replacement ?? (opener instanceof HTMLElement && opener.isConnected ? opener : null);
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    });
    router.push({ pathname: "/taskOverlay", params: { overlayId: id, parent: fallbackHref } });
  }, [id, fallbackHref, returnFocusId, router]);
  useEffect(() => () => { requestTaskOverlayDismiss(id); }, [id]);
  return null;
}
