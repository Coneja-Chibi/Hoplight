/**
 * The `/art` seam a session command talks to: find a picture, put it in the transcript.
 *
 * Lifted out of app.tsx because it is one whole concept with two dependencies - the session that
 * can look art up, and the line-adder that can show it - rather than because the file was long. It
 * reads better here than as a nested object literal fourteen levels into a command context, and it
 * can be checked without standing up a renderer.
 *
 * A STUDIO WITHOUT AN ART SEAM IS NOT AN ERROR, it is a studio that has no art: the refusal says so
 * in those words rather than failing, because the person asked a reasonable question.
 */
import type { Session as ChatSession } from "../session";
import type { RenderLine } from "./turn-events";

export interface ArtCommands {
  show(query: string): Promise<{ ok: true } | { ok: false; detail: string }>;
}

export function artCommands(
  session: ChatSession,
  add: (line: RenderLine) => void,
): ArtCommands {
  return {
    async show(query) {
      if (!session.art) return { ok: false as const, detail: "This studio has no art seam." };
      const found = await session.art.find(query);
      if ("detail" in found) return { ok: false as const, detail: found.detail };
      add({ role: "portrait", bytes: found.bytes, caption: found.name });
      return { ok: true as const };
    },
  };
}
