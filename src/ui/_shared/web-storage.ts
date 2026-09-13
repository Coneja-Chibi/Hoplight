/** Select browser storage, with an explicitly volatile implementation for the static Studio. */
type StorageArea = "local" | "session";

export interface WebStorage {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

const volatile = new Map<StorageArea, WebStorage>();

function memoryStorage(): WebStorage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(String(key)) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(String(key)); },
    setItem: (key, value) => { values.set(String(key), String(value)); },
  };
}

/** Turn every subsequent UI storage access into page-memory access. Native storage is untouched. */
export function enableVolatileWebStorage(): void {
  volatile.set("local", memoryStorage());
  volatile.set("session", memoryStorage());
}

/** Return UI storage to the browser-owned stores. Used when a pocket runtime is disposed in tests. */
export function disableVolatileWebStorage(): void {
  volatile.clear();
}

/** Return the selected store, or null in a DOM-less build/import context. */
export function webStorage(area: StorageArea): WebStorage | null {
  const transient = volatile.get(area);
  if (transient) return transient;
  if (typeof globalThis === "undefined") return null;
  try {
    return area === "local" ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}
