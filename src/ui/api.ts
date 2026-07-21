/**
 * The local API client - the one door to the engine.
 * Every fetch funnels through apiFetch (session token + non-2xx rejection).
 */
import type { AppContext, InspectResult, SaveBundleResult } from "./app-contract";
import { apiFetchJson, INSPECT_BODY_MAX_BYTES } from "./_shared/api-fetch";

export { ApiHttpError as ApiError } from "./_shared/api-fetch";

export const api: AppContext["api"] = {
  listEntities: async (kind) =>
    apiFetchJson(`/api/studio/list${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, {
      requireToken: false,
    }),
  getEntity: async (id) =>
    apiFetchJson(`/api/studio/get?${id}`, { requireToken: false }),
  saveEntity: async (entity, opts) =>
    apiFetchJson("/api/studio/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts?.overwrite ? { entity, overwrite: true } : entity),
    }),
  deleteEntity: async (kind, id) =>
    apiFetchJson("/api/studio/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, id }),
    }),
  saveBundle: async (payload): Promise<SaveBundleResult> =>
    apiFetchJson("/api/studio/save-bundle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  inspectFile: async (file): Promise<InspectResult> => {
    if (file.size > INSPECT_BODY_MAX_BYTES) {
      throw new Error("file too large to inspect");
    }
    return apiFetchJson("/api/inspect", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        // HTTP headers are ISO-8859-1 only; an emoji in a filename made fetch itself throw and
        // every import "fail" client-side. Always URI-encode; the server always decodes.
        "x-filename": encodeURIComponent(file.name),
      },
      body: await file.arrayBuffer(),
    });
  },
  exportEntity: async (entity, targetId) =>
    apiFetchJson("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, targetId }),
    }),
  formats: async () => apiFetchJson("/api/formats", { requireToken: false }),
  version: async () => apiFetchJson("/api/version", { requireToken: false }),
  updateCheck: async () => apiFetchJson("/api/update-check", { requireToken: false }),
  shutdownApp: async () => apiFetchJson("/api/shutdown", { method: "POST" }),
  restartApp: async () => apiFetchJson("/api/restart", { method: "POST" }),
  coverage: async () => apiFetchJson("/api/coverage", { requireToken: false }),
};
