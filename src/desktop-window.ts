/**
 * The native window, in a WORKER thread - because webview's run() is a blocking native message pump
 * that would starve the server's event loop on the main thread (verified live: window up, server
 * dead). The worker owns the window; the main thread owns the server; a close message joins them.
 */
import { Webview, SizeHint } from "webview-bun";

declare const self: Worker;

self.onmessage = (event: MessageEvent<{ url: string }>) => {
  const wv = new Webview();
  wv.title = "Vaude.";
  wv.size = { width: 1280, height: 820, hint: SizeHint.NONE };
  wv.navigate(event.data.url);
  wv.run(); // blocks THIS worker until the user closes the window
  self.postMessage({ closed: true });
};
