/**
 * The local API client - the one door to the engine (extracted verbatim from the old boot.ts).
 * Every fetch the shell or an app makes to the loopback server funnels through this object, whose
 * shape is pinned by AppContext["api"] (app-contract.ts).
 */
import type { AppContext, InspectResult } from "./app-contract";

export const api: AppContext["api"] = {
  listEntities: async (kind) =>
    (await fetch(`/api/studio/list${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`)).json(),
  getEntity: async (id) => (await fetch(`/api/studio/get?${id}`)).json(),
  saveEntity: async (entity) =>
    (
      await fetch("/api/studio/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(entity),
      })
    ).json(),
  inspectFile: async (file): Promise<InspectResult> =>
    (
      await fetch("/api/inspect", {
        method: "POST",
        headers: { "x-filename": file.name },
        body: await file.arrayBuffer(),
      })
    ).json(),
  exportEntity: async (entity, targetId) =>
    (
      await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity, targetId }),
      })
    ).json(),
  formats: async () => (await fetch("/api/formats")).json(),
  coverage: async () => (await fetch("/api/coverage")).json(),
};
