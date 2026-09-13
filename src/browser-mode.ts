/** Detect the static, memory-only browser Studio from its build-time document marker. */
export function isBrowserStudio(
  doc: Pick<Document, "querySelector"> | undefined = typeof document === "undefined" ? undefined : document,
): boolean {
  return doc?.querySelector('meta[name="hoplight-runtime"]')?.getAttribute("content") === "browser";
}

export const BROWSER_STUDIO_CHANGE_EVENT = "hoplight:studio-change";

export function announceBrowserStudioChange(kinds: readonly string[]): void {
  if (!isBrowserStudio() || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BROWSER_STUDIO_CHANGE_EVENT, { detail: { kinds } }));
}
