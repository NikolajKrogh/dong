export function subscribeConnectivity(listener: (online: boolean) => void) {
  if (typeof window === 'undefined') return () => {};
  const update = () => listener(navigator.onLine !== false);
  window.addEventListener('online', update); window.addEventListener('offline', update); update();
  return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
}
