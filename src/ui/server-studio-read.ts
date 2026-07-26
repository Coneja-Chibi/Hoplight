/**
 * Read-only Studio HTTP routes.
 */
import type { StudioStoreLike } from "../studio/contracts";
import { json, studioErr } from "./server-security";

/** Return a Studio read response when the path is owned here, otherwise let the main router continue. */
export async function handleStudioRead(
  path: string,
  url: URL,
  store: StudioStoreLike,
): Promise<Response | null> {
  const kind = url.searchParams.get("kind") ?? undefined;
  try {
    if (path === "/api/studio/list") return json(await store.list(kind));
    if (path === "/api/studio/inventory") return json(await store.inventory(kind));
  } catch (error) {
    return studioErr(error);
  }
  return null;
}
