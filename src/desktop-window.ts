/**
 * The native window, in a WORKER thread - because webview's run() is a blocking native message pump
 * that would starve the server's event loop on the main thread (verified live: window up, server
 * dead). The worker owns the window; the main thread owns the server; a close message joins them.
 *
 * Size is set at construction (Mac invisible-until-resized pitfall). Title comes from the host so
 * "Hoplight (Dev)" vs "Hoplight." matches the Start Menu tile the user clicked.
 */
import { Webview, SizeHint } from "webview-bun";
import { runWindowSession } from "./desktop-window-session";

declare const self: Worker;

self.onmessage = (event: MessageEvent<{ url: string; title?: string }>) => {
  const title = event.data.title?.trim() || "Hoplight.";
  const wv = new Webview(false, {
    width: 1280,
    height: 820,
    hint: SizeHint.NONE,
  });
  runWindowSession(wv, { url: event.data.url, title }, () => wv.run(), () => self.postMessage({ closed: true }));
};
