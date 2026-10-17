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
const registrations = new Map<string, TaskOverlayRegistration>();
const lifecycles = new Map<string, OverlayLifecycle>();
const listeners = new Set<() => void>();
export const subscribeTaskOverlays = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getTaskOverlay = (id: string) => registrations.get(id);
const notify = () => listeners.forEach((listener) => listener());

export function registerTaskOverlay(entry: TaskOverlayRegistration) {
  registrations.set(entry.id, entry);
  lifecycles.set(entry.id, { presented: false });
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
  lifecycles.delete(id);
  notify();
}
export const isTaskOverlayPresented = (id: string) => lifecycles.get(id)?.presented ?? false;
export function presentTaskOverlay(id: string, dismiss?: (action?: () => void) => void, restoreFocus?: () => void) {
  const lifecycle = lifecycles.get(id);
  if (lifecycle) lifecycles.set(id, { ...lifecycle, presented: true, dismiss: dismiss ?? lifecycle.dismiss, restoreFocus: restoreFocus ?? lifecycle.restoreFocus });
  const entry = registrations.get(id);
  return () => finishTaskOverlay(id, entry?.props.onClose, restoreFocus ?? lifecycle?.restoreFocus);
}
export function requestTaskOverlayDismiss(id: string) {
  lifecycles.get(id)?.dismiss?.();
}
function finishTaskOverlay(id: string, fallbackClose?: () => void, fallbackFocus?: () => void) {
  const entry = registrations.get(id);
  const lifecycle = lifecycles.get(id);
  if (lifecycle) lifecycles.set(id, { presented: false, restoreFocus: lifecycle.restoreFocus });
  (entry?.props.onClose ?? fallbackClose)?.();
  const restoreFocus = lifecycle?.restoreFocus ?? fallbackFocus;
  if (restoreFocus) requestAnimationFrame(restoreFocus);
}
