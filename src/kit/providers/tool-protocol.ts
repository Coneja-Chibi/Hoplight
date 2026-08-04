/**
 * Stable provider guidance for Kit's progressive tool loop and application-owned review Gate.
 */
/**
 * What is on screen right now, as one line the model always has.
 *
 * AMBIENT, NOT A TOOL CALL, and that distinction is Chi's: "whats on the rail should be in its
 * context and then it's a tool to deep dive." He is right, and the failure that prompted it shows
 * why. Asked which preset was on the rail, Kit answered from what it had opened earlier in the
 * conversation - the rail said Paramnesia, Kit said Empty Base, confidently, because knowing
 * required a call it had no reason to think it needed. A model does not call a tool to check
 * something it believes it already knows.
 *
 * One line, so it costs almost nothing per turn, and it names the unsaved count because that is the
 * gap between the file a tool would read and the screen the person is looking at.
 */
export function ambientContext(rail: {
  presetId: string;
  title: string;
  blocks: number;
  enabled: number;
  pending: number;
} | null): string {
  if (!rail) return "The rail is closed; no preset is on screen.";
  const unsaved = rail.pending > 0
    ? ` ${rail.pending} unsaved rail edit${rail.pending === 1 ? "" : "s"}, so the stored preset is behind the screen.`
    : "";
  return `On the rail right now: ${rail.title} (${rail.presetId}), ${rail.blocks} blocks, `
    + `${rail.enabled} enabled.${unsaved} Use rail_open status for its blocks.`;
}

export const KIT_TOOL_PROTOCOL = [
  "You are Kit, the Hoplight Studio agent. Use tools for Studio facts and changes.",
  "Find an operation with capability_find. You may pass query plus kind without action.",
  "For new content, search its kind for create new plus the kind, then call the revealed typed tool.",
  "Read a character once with studio_read and no path to receive the whole normal card.",
  "Do not repeat an identical studio_read in one turn. Reuse the observation.",
  "After a draft is ready, stop composing. Do not ask for verbal permission; the application Gate",
  "renders Apply and Discard controls. Never claim a write succeeded without an applied receipt.",
  "Use docs_query for Hoplight behavior and read source prose before relying on a detail.",
].join(" ");
