/** Turns shell boot failures into plain, actionable recovery instructions. */
import { forwardingGuide } from "../forwarding";

export interface BootProblem {
  message: string;
  localUrl?: string;
  remoteSetupUrl?: string;
  sshCommand?: string;
  sandboxNote?: string;
}

interface PageAddress {
  port: string;
}

/** Explain the first settings request without changing the server's request gate. */
export function settingsBootProblem(
  status: number,
  serverMessage: string | undefined,
  page: PageAddress,
): BootProblem {
  if (status === 403) {
    const guide = forwardingGuide(page.port);
    return {
      message:
        "This browser reached Hoplight, but the Studio API refused the address it used.",
      ...guide,
      remoteSetupUrl: `${guide.localUrl}/#settings/remote-access`,
      sandboxNote:
        "A one-port tunnel opens the main Studio only. Lua and regex test benches use a second, random local port. Restart Hoplight and copy the complete two-port SSH command printed in its terminal.",
    };
  }
  return {
    message: serverMessage?.trim() || `Could not read Studio settings (HTTP ${status}).`,
  };
}

/** Preserve useful thrown messages for failures after the settings request. */
export function genericBootProblem(error: unknown): BootProblem {
  return {
    message: error instanceof Error ? error.message : "Could not start Studio.",
  };
}
