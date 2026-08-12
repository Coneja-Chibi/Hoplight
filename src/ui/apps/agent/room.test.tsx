/**
 * The agent window, actually rendered.
 *
 * It exists because typecheck and unit tests both pass on a window that mounts as a stack of
 * unstyled text, and this session has twice proved a layer UNDER the door somebody actually opens.
 * These render the component and read what comes out.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AppContext, AppManifestEntry } from "../../app-contract";
import type { AgentState } from "../../agent/surface";
import { AgentRoom } from "./room";

const LIBRARY: AppManifestEntry = {
  id: "library",
  title: "The Library",
  markSvg: "<svg/>",
  accent: "#3b82f6",
  order: 20,
  agentSurface: {
    describe: "Every piece in the studio.",
    actions: [{ id: "open-piece", label: "Open a piece", describe: "Put it on the Workbench." }],
  },
};

/** Only the two members the room touches; the rest of AppContext is irrelevant here. */
/**
 * `prefs` is real rather than absent because the room reads one to decide whether its top band is
 * folded. A double that omits what the component uses tests a component nobody ships.
 */
/**
 * THE SURFACE ARRIVES THROUGH THE CONTEXT, and these tests drive it that way on purpose.
 *
 * They used to publish into the live-state MODULE and let the room import the same one. That works
 * in a test process and never in the artifact: every app under /apps is bundled separately, so the
 * room's import was its own permanently empty copy, and the window said "no screen has described
 * itself yet" from every screen while the floating panel - which runs inside the shell's bundle -
 * worked. The test could not see the difference, so it certified a room nobody could use.
 */
const ctx = (
  manifests: AppManifestEntry[],
  published?: { appId: string; state: AgentState },
): AppContext =>
  ({
    apps: () => manifests,
    prefs: { get: () => undefined, set: () => undefined },
    agent: {
      publish: () => undefined,
      current: () => published ?? null,
      onChange: () => () => undefined,
    },
  }) as unknown as AppContext;

describe("AgentRoom", () => {
  test("IT SHIPS ITS OWN STYLES, rather than mounting as unstyled text", () => {
    /**
     * Every other app in this folder injects a style string. A window whose class names match
     * nothing renders as a column of plain paragraphs, which typecheck is perfectly happy with.
     */
    const html = renderToStaticMarkup(<AgentRoom ctx={ctx([])} />);

    expect(html).toContain("<style>");
    expect(html).toContain(".agent-room__brief");
    // Every class the markup uses must be one the stylesheet actually defines.
    for (const cls of ["agent-room__head", "agent-room__notice", "agent-room__dot"]) {
      expect(html).toContain(`.${cls}{`);
    }
    /**
     * The transcript widgets keep their CSS beside themselves in agent/kit-transcript-style.ts, so
     * this window has to inject that too. A class defined in a stylesheet nobody mounts is the same
     * bug as no stylesheet at all, and it renders as an unstyled column exactly the same way.
     */
    for (const cls of ["kit-md__head", "kit-band__copy", "kit-meterbar", "kit-ask__q", "kit-error"]) {
      expect(html).toContain(`.${cls}`);
    }
  });

  test("IT SHOWS THE METER, not a pair of raw token counts", () => {
    /**
     * The header used to print "0 in / 0 out", which is two facts nobody can act on. What a person
     * needs is whether the conversation is about to fall off the front of the model's window, and
     * that is a ratio - Kit's meter. With no provider connected there is no context size to divide
     * by, so it correctly draws the count alone rather than a bar against a guess.
     */
    const html = renderToStaticMarkup(<AgentRoom ctx={ctx([])} />);
    expect(html).toContain("kit-meterbar");
    expect(html).toContain("ctx");
    expect(html).toContain("session");
    expect(html).not.toContain(" in / ");
  });

  test("with no model it says so, and refuses to send a QUESTION it cannot answer", () => {
    /**
     * A chat box that accepts a question it cannot send is worse than one that is plainly shut: the
     * first loses what somebody typed, the second tells them where to go.
     *
     * THE FIELD ITSELF IS NO LONGER SHUT, and that is a deliberate change rather than a slip. Every
     * slash command works without a provider - `/model` is how you connect one and `/doctor` is how
     * you find out why you cannot - so a composer that refused a keystroke was a composer nobody
     * could use to fix the thing it was complaining about. The refusal moved to the send key, which
     * is where the question actually leaves.
     */
    const html = renderToStaticMarkup(<AgentRoom ctx={ctx([])} />);

    expect(html).toContain("no model connected");
    expect(html).toContain("No model is connected. Add one in Settings");
    expect(html).toContain("Type / for a command, or connect a model in Settings");
    // The field takes a command; the send key is genuinely disabled, not merely styled that way.
    expect(html).not.toContain('<textarea rows="2" placeholder="Type / for a command, or connect a model in Settings" disabled=""');
    expect(html).toContain('<button type="submit" disabled=""');
  });

  test("NO GATE CARD UNTIL THERE IS SOMETHING TO DECIDE", () => {
    /**
     * The agent has the tool belt now, so this window can propose writes. A gate card rendered
     * speculatively - empty, or on every turn - would train somebody to click through it, which is
     * the failure mode that makes a confirmation step worse than none at all.
     */
    const html = renderToStaticMarkup(<AgentRoom ctx={ctx([])} />);
    // The rendered element, not the class name: every class appears in the <style> block regardless.
    expect(html).not.toContain('role="alertdialog"');
    expect(html).not.toContain("<button type=\"button\" class=\"gate-card__yes\"");
  });

  test("IT DESCRIBES THE SCREEN YOU CAME FROM, not itself", () => {
    /**
     * Opening this window makes it the active app, so without the publisher stamp the only surface
     * it could ever report would be its own. That would make the whole feature pointless.
     */
    const standing = {
      appId: "library",
      state: {
        headline: "The Presets shelf, showing 2 of 164 pieces.",
        items: [{ kind: "preset", id: "hawthorne", name: "HawThorne", dirty: true }],
        notes: ["1 file(s) in the studio folder did not open: preset/Clean.json (schema-mismatch)"],
      },
    };

    const html = renderToStaticMarkup(<AgentRoom ctx={ctx([LIBRARY], standing)} />);

    expect(html).toContain("Standing on The Library");
    expect(html).toContain("2 of 164 pieces");
    expect(html).toContain("preset/hawthorne");
    expect(html).toContain("unsaved changes");
    expect(html).toContain("schema-mismatch");
    /**
     * The offered action reaches the MODEL through the brief, and is marked there as a suggestion
     * rather than a boundary. The clickable chip beside the composer is a convenience on top of
     * this; it only renders once a model is connected, since a button that asked nobody anything
     * would be worse than no button.
     */
    expect(html).toContain("open-piece: Put it on the Workbench.");
    expect(html).toContain("suggestions, not limits");
  });
});
