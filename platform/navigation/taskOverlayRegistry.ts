import type { TaskOverlayProps } from "./taskNavigation.shared";

export interface TaskOverlayRegistration {
  id: string;
  ownerKey: string;
  props: TaskOverlayProps;
}
interface OverlayLifecycle {
  presented: boolean;
  dismiss?: (action?: () => void) => void;
  restoreFocus?: () => void;
}
type OverlayEntry = TaskOverlayRegistration & { lifecycle: OverlayLifecycle };
const registrations = new Map<string, OverlayEntry>();
const listeners = new Set<() => void>();
export const subscribeTaskOverlays = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getTaskOverlay = (id: string): TaskOverlayRegistration | undefined => registrations.get(id);
const notify = () => listeners.forEach((listener) => listener());

export function registerTaskOverlay(entry: TaskOverlayRegistration) {
  registrations.set(entry.id, { ...entry, lifecycle: { presented: false } });
  notify();
}
export function updateTaskOverlay(id: string, props: TaskOverlayProps) {
  const entry = registrations.get(id);
  if (!entry) return;
  registrations.set(id, { ...entry, props });
  notify();
}
export function unregisterTaskOverlay(id: string) {
  registrations.delete(id);
  notify();
}
export const isTaskOverlayPresented = (id: string) => registrations.get(id)?.lifecycle.presented ?? false;
export function presentTaskOverlay(id: string, dismiss?: (action?: () => void) => void, restoreFocus?: () => void) {
  const entry = registrations.get(id);
  const lifecycle = entry?.lifecycle;
  if (entry && lifecycle) {
    entry.lifecycle = {
      presented: true,
      dismiss: dismiss ?? lifecycle.dismiss,
      restoreFocus: restoreFocus ?? lifecycle.restoreFocus,
    };
  }
  return () => finishTaskOverlay(id, entry?.props.onClose, restoreFocus ?? lifecycle?.restoreFocus);
}
export function requestTaskOverlayDismiss(id: string) {
  registrations.get(id)?.lifecycle.dismiss?.();
}
function finishTaskOverlay(id: string, fallbackClose?: () => void, fallbackFocus?: () => void) {
  const entry = registrations.get(id);
  const lifecycle = entry?.lifecycle;
  if (entry && lifecycle) entry.lifecycle = { presented: false, restoreFocus: lifecycle.restoreFocus };
  (entry?.props.onClose ?? fallbackClose)?.();
  const restoreFocus = lifecycle?.restoreFocus ?? fallbackFocus;
  if (restoreFocus) requestAnimationFrame(restoreFocus);
}
