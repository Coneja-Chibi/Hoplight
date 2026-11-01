/** A native window becomes a closed session only after creation and its run loop succeed. */
export interface NativeWindow {
  readonly unsafeHandle: number | null;
  title: string;
  navigate(url: string): void;
}
export function runWindowSession(
  window: NativeWindow,
  target: { url: string; title: string },
  run: () => void,
  closed: () => void,
): void {
  if (!window.unsafeHandle) throw new Error("The native window could not be created. Studio remains available in your browser.");
  window.title = target.title;
  window.navigate(target.url);
  run();
  closed();
}
