/**
 * The local API client - the one door to the engine.
 * Every fetch funnels through apiFetch (session token + non-2xx rejection).
 */
import type { AppContext, InspectArchiveResult, InspectResult, SaveBundleResult } from "./app-contract";
import { apiFetchJson, INSPECT_BODY_MAX_BYTES } from "./_shared/api-fetch";

export { ApiHttpError as ApiError } from "./_shared/api-fetch";

export const api: AppContext["api"] = {
  listEntities: async (kind) =>
    apiFetchJson(`/api/studio/list${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, {
      requireToken: false,
    }),
  studioInventory: async (kind) =>
    apiFetchJson(`/api/studio/inventory${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, {
      requireToken: false,
    }),
  getEntity: async (id) =>
    apiFetchJson(`/api/studio/get?${id}`, { requireToken: false }),
  getEditableEntity: async (id) =>
    apiFetchJson(`/api/studio/get?${id}&revision=1`, { requireToken: false }),
  saveEntity: async (entity, opts) =>
    apiFetchJson("/api/studio/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts?.overwrite ? { entity, overwrite: true } : entity),
    }),
  saveEditedEntity: async (entity, expectedRevision) =>
    apiFetchJson("/api/studio/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, expectedRevision }),
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
  inspectFile: async (file, signal): Promise<InspectResult> => {
    if (file.size > INSPECT_BODY_MAX_BYTES) {
      throw new Error("file too large to inspect");
    }
    // Per-request deadline so one dead connection can never freeze a bulk run; the caller's
    // signal (the import sheet's Cancel) composes with it.
    const deadline = AbortSignal.timeout(90_000);
    return apiFetchJson("/api/inspect", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        // HTTP headers are ISO-8859-1 only; an emoji in a filename made fetch itself throw and
        // every import "fail" client-side. Always URI-encode; the server always decodes.
        "x-filename": encodeURIComponent(file.name),
      },
      body: await file.arrayBuffer(),
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    });
  },
  inspectArchive: async (file, signal): Promise<InspectArchiveResult> =>
    // `body: file` - the browser streams a File straight off disk; unlike inspectFile's
    // `await file.arrayBuffer()`, this never holds a multi-gigabyte backup in JS memory at once.
    // No fixed deadline either: inspectFile's 90s timeout assumes a small file on a live
    // connection, which a real Lumiverse backup's upload time cannot promise - the sheet's own
    // Cancel (the caller's `signal`) is the only abort this needs.
    apiFetchJson("/api/inspect-archive", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-filename": encodeURIComponent(file.name),
      },
      body: file,
      signal,
    }),
  exportEntity: async (entity, targetId) =>
    apiFetchJson("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, targetId }),
    }),
  formats: async () => apiFetchJson("/api/formats", { requireToken: false }),
  version: async () => apiFetchJson("/api/version", { requireToken: false }),
  updateCheck: async () => apiFetchJson("/api/update-check", { requireToken: false }),
  updatesReleases: async (page = 1) =>
    apiFetchJson(`/api/updates/releases?page=${page}`, { requireToken: false }),
  switchTo: async (version: string) =>
    apiFetchJson("/api/updates/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version }),
    }),
  switchStatus: async () => apiFetchJson("/api/updates/switch-status", { requireToken: false }),
  switchPending: async () => apiFetchJson("/api/updates/pending", { requireToken: false }),
  shutdownApp: async () => apiFetchJson("/api/shutdown", { method: "POST" }),
  restartApp: async () => apiFetchJson("/api/restart", { method: "POST" }),
  coverage: async () => apiFetchJson("/api/coverage", { requireToken: false }),
  remoteStatus: async () => apiFetchJson("/api/remote/status", { requireToken: false }),
  remoteEnable: async () => apiFetchJson("/api/remote/enable", { method: "POST" }),
  remoteDisable: async () => apiFetchJson("/api/remote/disable", { method: "POST" }),
  remoteDevices: async () => apiFetchJson("/api/remote/devices", { requireToken: false }),
  remoteKick: async (nodeId: string) =>
    apiFetchJson("/api/remote/kick", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId }),
    }),
  remoteHelperStatus: async () => apiFetchJson("/api/remote/helper/status", { requireToken: false }),
  remoteHelperDownload: async () => apiFetchJson("/api/remote/helper/download", { method: "POST" }),
  remoteLanStatus: async () => apiFetchJson("/api/remote/lan/status", { requireToken: false }),
  remoteLanEnable: async () => apiFetchJson("/api/remote/lan/enable", { method: "POST" }),
  remoteLanDisable: async () => apiFetchJson("/api/remote/lan/disable", { method: "POST" }),
  remoteLanApprove: async (id: string) =>
    apiFetchJson("/api/remote/lan/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  remoteLanDeny: async (id: string) =>
    apiFetchJson("/api/remote/lan/deny", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  remoteLanKick: async (id: string) =>
    apiFetchJson("/api/remote/lan/kick", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }),
};
