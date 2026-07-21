/**
 * The update-check route - the server's ONE deliberate outbound call, and only when the Settings
 * button asks. The target is the RELEASES_API constant (never caller input), so there is no SSRF
 * surface; failures fold to httpStatus 0, which the row renders as "Could not reach GitHub."
 */
import { RELEASES_API } from "./_shared/update-check";

export async function handleUpdateCheck(): Promise<Response> {
  try {
    const res = await fetch(RELEASES_API, {
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/vnd.github+json", "user-agent": "hoplight-update-check" },
    });
    const body = res.status === 200 ? await res.json().catch(() => null) : null;
    return Response.json({ httpStatus: res.status, body });
  } catch {
    return Response.json({ httpStatus: 0, body: null });
  }
}
