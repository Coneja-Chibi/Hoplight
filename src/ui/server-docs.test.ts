/** Packaged docs HTTP proof: catalog pages and strictly scoped presentation assets. */
import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StudioStore } from "../studio/store";
import { SettingsStore } from "../studio/settings";
import type { PackagedAssets } from "./assets";
import { createHandler, createSecurityContext } from "./server";

const apiReq = (path: string): Request => new Request(`http://127.0.0.1:8321${path}`, {
  headers: { host: "127.0.0.1:8321", origin: "http://127.0.0.1:8321" },
});

const handlerFor = async (docs: PackagedAssets["docs"]): Promise<(req: Request) => Promise<Response>> => {
  const dir = await mkdtemp(join(tmpdir(), "vaude-docs-"));
  const sec = createSecurityContext();
  sec.expectedHost = "127.0.0.1:8321";
  sec.expectedOrigin = "http://127.0.0.1:8321";
  return createHandler(
    new StudioStore(dir),
    new SettingsStore(dir),
    { docs } as unknown as PackagedAssets,
    sec,
  );
};

describe("packaged docs HTTP boundary", () => {
  test("serves the committed catalog and rejects unknown ids", async () => {
    const handler = await handlerFor({
      index: {
        generated: "2026-07-20",
        count: 1,
        docs: [{
          id: "guide/getting-started",
          path: "docs/guide/getting-started.md",
          title: "Get started",
          audience: "user",
          summary: "Start here.",
          tags: [],
          related: [],
          anchors: [],
        }],
      },
      pages: { "guide/getting-started": "# Get started\n" },
      figures: [],
      assets: {},
    });

    const index = await handler(apiReq("/api/docs/index"));
    expect(index.status).toBe(200);
    expect(((await index.json()) as { count: number }).count).toBe(1);
    const page = await handler(apiReq("/api/docs/get?id=guide%2Fgetting-started"));
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("# Get started\n");
    expect((await handler(apiReq("/api/docs/get?id=..%2FSECURITY"))).status).toBe(404);
    expect((await handler(apiReq("/api/docs/get?id=guide%2Fmissing"))).status).toBe(404);
  });

  test("exposes only baked figure and media assets", async () => {
    const handler = await handlerFor({
      index: { generated: "2026-07-20", count: 0, docs: [] },
      pages: {},
      figures: [],
      assets: {
        "docs/generated/figures/start.svg": {
          mime: "image/svg+xml",
          b64: Buffer.from("<svg></svg>").toString("base64"),
        },
      },
    });
    const figure = await handler(apiReq("/api/docs/asset?path=docs%2Fgenerated%2Ffigures%2Fstart.svg"));
    expect(figure.status).toBe(200);
    expect(figure.headers.get("content-type")).toBe("image/svg+xml");
    expect(figure.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await handler(apiReq("/api/docs/asset?path=docs%2Fmedia%2F..%2FSECURITY.md"))).status).toBe(404);
  });
});
