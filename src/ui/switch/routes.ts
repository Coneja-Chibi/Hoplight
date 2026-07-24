/**
 * The version-switch routes (host-only; /api/updates/* is refused to any remote/LAN device upstream). POST
 * /switch validates and kicks off ONE switch (202, then the client polls /switch-status); /pending reads
 * and CLEARS the restart-outcome marker so a no-ack restart cannot re-show a stale popup. The long work
 * runs in the manager, never inside the request (a minutes-long download must not hold the socket open).
 */
import { err, json, readJsonCapped } from "../server-security";
import type { SettingsStoreLike } from "../../studio/contracts";
import { isReleaseTag } from "../_shared/version-history";
import { classifyDataChange, switchKind } from "../_shared/switch-decision";
import { readPendingSwitch } from "../_shared/pending-switch";
import { clampPage, handleReleasesFetch } from "../server-updates";
import type { SwitchManager } from "./manager";

export interface UpdatesRouteDeps {
  manager: SwitchManager;
  settings: SettingsStoreLike;
  /** the running version, for direction + data-change decisions. */
  installed: string;
}

/** The one /api/updates/* dispatcher (host-only): releases list, switch, switch-status, pending. Returns
 *  null for any other path. */
export async function handleUpdatesRoutes(
  req: Request,
  p: string,
  deps: UpdatesRouteDeps,
): Promise<Response | null> {
  const { manager, settings, installed } = deps;

  if (p === "/api/updates/releases") {
    return handleReleasesFetch(clampPage(new URL(req.url).searchParams.get("page")));
  }

  if (p === "/api/updates/switch" && req.method === "POST") {
    const parsed = await readJsonCapped(req, 4096);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value as { version?: unknown } | null;
    const version = typeof body?.version === "string" ? body.version : "";
    if (!isReleaseTag(version)) return err("expected { version } as a release tag like v0.1.9", 400);

    const kind = switchKind(installed, version);
    if (kind === "current") return err("you are already on this version", 400);
    // Fail-closed tripwire: a rollback that crosses a storage-changing release is refused until the
    // backup + at-risk preview exists (SCHEMA_BUMPS is empty today, so this never fires yet, but the
    // guard is here so the day a bump lands, the dangerous rollback is blocked rather than silent).
    if (kind === "rollback" && classifyDataChange(installed, version)) {
      return err(
        "this rollback crosses a version that changed how your studio is stored; it is not yet supported safely",
        409,
      );
    }

    const started = manager.start(version);
    if (!started) return err("a version switch is already running", 409);
    return json({ started: true, kind }, 202);
  }

  if (p === "/api/updates/switch-status") {
    return json(manager.status());
  }

  if (p === "/api/updates/pending") {
    // Read the restart-outcome marker and CLEAR it on first read: if the user closes the popup without
    // acking, a later restart must not greet them with a stale "you are now on vX".
    const s = await settings.read();
    const marker = readPendingSwitch(s.pendingSwitch);
    if (marker) await settings.update({ pendingSwitch: undefined });
    return json({ marker });
  }

  return null;
}
