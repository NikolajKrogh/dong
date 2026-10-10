// React Native's AbortSignal polyfill has aborted, but not throwIfAborted().
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
  }
}
