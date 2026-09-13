/** Serve the generated Pages artifact locally under the same /Hoplight/ project prefix. */
import { fileURLToPath } from "node:url";
import { resolvePagesPreviewPath } from "./pages-preview-path";

const root = fileURLToPath(new URL("../dist/pages/", import.meta.url));
const port = Number(Bun.argv[2] ?? 8877);

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const path = resolvePagesPreviewPath(root, url.pathname);
    if (!path) return new Response("not found", { status: 404 });
    const file = Bun.file(path);
    return await file.exists() ? new Response(file) : new Response("not found", { status: 404 });
  },
});

console.log(`Pages preview: http://127.0.0.1:${port}/Hoplight/`);
