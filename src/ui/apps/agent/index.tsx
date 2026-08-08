/**
 * The agent window - a dock app that knows which screen you are standing on.
 *
 * WHY IT IS AN APP AND NOT A PANEL. Everything else in Hoplight arrives by dropping a folder into
 * src/ui/apps, and an agent that needed the shell edited to exist would be the first exception. It
 * gets a tile like the rest, which also means it can be closed and ignored by anybody who does not
 * want it.
 *
 * A conversation with whatever model the vault has configured, standing on whichever screen you came
 * from, with Kit's real tool belt behind it. The window reads the manifest half of `agentSurface`
 * from that app, joins it to whatever the app published about its own state, and sends the result as
 * context on every turn. There is no provider layer and no tool registry here: the loopback server
 * asks Kit's, so there is one vault, one egress ledger and one Gate.
 *
 * EVERY WRITE STOPS AT THE GATE. When the agent wants to change something, the turn's stream carries
 * the request out and a card in this window carries the answer back, while a dispatch loop on the
 * server is genuinely parked in between. That round trip is why the turn is a stream rather than a
 * request: over a plain POST the Gate is unreachable, and tools without it would be writes with no
 * review.
 */
import type { HoplightApp } from "../../app-contract";
import { AgentRoom } from "./room";

/** A speech mark with a cursor in it: something that talks, and edits. */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
  '<path d="M4 5.5h16v10H12l-5 4v-4H4z" stroke-linejoin="round"/>' +
  '<path d="M11 8.5v4"/>' +
  "</svg>";

const app: HoplightApp = {
  manifest: {
    id: "agent",
    title: "The Agent",
    markSvg: MARK_SVG,
    accent: "#0f9b8e", // hardcode-ok: per-app identity accent, not theming
    order: 40,
    // In the dock, not behind the Apps catalog: a window you have to go and install is a window
    // nobody opens, and this one is meant to be glanced at from wherever you already are.
    subtitle: "app · agent",
    agentSurface: {
      describe:
        "The agent's own window. Shows what it can see on the screen you were last standing on, and the brief it would be given.",
      actions: [
        {
          id: "explain-surface",
          label: "Explain this screen",
          describe: "Say what the current screen is showing and what would be worth doing on it.",
        },
      ],
    },
  },
  Component: ({ ctx }) => <AgentRoom ctx={ctx} />,
};

export default app;
