const STORAGE_KEY = 'dong:history-detail-parents';
const MAX_ENTRIES = 32;
function entryId(): string | null {
  const id: unknown = window.history.state?.id;
  return typeof id === 'string' && id.length > 0 && id.length <= 128 ? id : null;
}
function rememberedIds(): string[] {
  const value: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '[]');
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length <= 128).slice(-MAX_ENTRIES) : [];
}
/** Read the Router's opaque browser entry identity; never alter browser history. */
export function hasDetailListParent(): boolean {
  try { const id = entryId(); return !!id && rememberedIds().includes(id); } catch { return false; }
}
/** Remember ownership only after the URL and Router's browser entry have committed. */
export function rememberDetailListParent(gameId: string): () => void {
  let frame = 0;
  let attempts = 0;
  const remember = () => {
    try {
      const id = entryId();
      if (id && new URLSearchParams(window.location.search).get('gameId') === gameId) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...rememberedIds().filter(value => value !== id), id].slice(-MAX_ENTRIES)));
        return;
      }
      if (++attempts < 10) frame = window.requestAnimationFrame(remember);
    } catch { /* Navigation still works when session storage is unavailable. */ }
  };
  frame = window.requestAnimationFrame(remember);
  return () => window.cancelAnimationFrame(frame);
}

/** Let the existing Router popstate listener consume an owned browser Back after reload. */
export function backToRememberedDetailList(): boolean {
  if (!hasDetailListParent()) return false;
  window.history.back();
  return true;
}
