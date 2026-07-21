/**
 * The import request signal: the shell (Import button, global file drop) asks; the Library
 * answers by opening the picker or reading the dropped files. The pending latch lives ON THE
 * WINDOW, not in module state - the shell and each app are separate bundles, so a module-level
 * variable would exist once per bundle and the request could never cross (the same per-bundle
 * fork the no-shell-imports gate exists to prevent). A request fired before the Library mounts
 * is consumed the moment it subscribes.
 */

const EVENT = "hoplight:import-request";
const SLOT = "__hoplightImportRequest";

type Slot = { files: File[] | null } | null;

const readSlot = (): Slot => (window as unknown as Record<string, Slot>)[SLOT] ?? null;
const writeSlot = (v: Slot): void => {
  (window as unknown as Record<string, Slot>)[SLOT] = v;
};

/** Ask for an import. With files (a drop), the Library reads them; without, it opens the picker. */
export function requestImport(files?: File[]): void {
  writeSlot({ files: files && files.length > 0 ? files : null });
  window.dispatchEvent(new Event(EVENT));
}

/** Subscribe (the Library). Consumes an already-pending request immediately. Returns cleanup. */
export function consumeImportRequests(cb: (files: File[] | null) => void): () => void {
  const handler = (): void => {
    const pending = readSlot();
    if (!pending) return;
    writeSlot(null);
    cb(pending.files);
  };
  window.addEventListener(EVENT, handler);
  handler(); // a request may already be latched from before this subscriber existed
  return () => window.removeEventListener(EVENT, handler);
}
