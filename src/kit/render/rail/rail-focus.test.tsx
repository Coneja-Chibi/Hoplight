/** @jsxImportSource @opentui/react */
/**
 * Does typing /rail leave the rail able to hear an arrow key?
 *
 * Reported three times as dead arrow keys, and it was never the keys. The rail opened beside a
 * composer that still owned the keyboard, so a bare arrow moved the cursor in a half-typed prompt.
 * The handler was right, the focus was wrong, and no test walked the path a person walks: run the
 * command, then press the key.
 */
import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { settleRender, testRender } from "../test-render";
import { useRailSession } from "./use-rail-session";
import type { PresetBody } from "../../../entities/preset";

const body = (name: string): PresetBody =>
  ({ name, prompts: [{ id: "b0", name: "Opening", content: "x" }] }) as PresetBody;

/** Just enough studio for the rail to open something and step off it. */
const presets = {
  list: async () => [
    { id: "first", name: "First Preset" },
    { id: "second", name: "Second Preset" },
  ],
  read: async (id: string) => body(id === "first" ? "First Preset" : "Second Preset"),
};

/**
 * Mounts the session hook and runs /rail exactly once, the way the shell does.
 *
 * Nothing here presses ctrl+B. That is the whole point: the person who types /rail has not been
 * told about a focus chord and should not have to be.
 */
function Harness({ said }: { said: string[] }): ReactNode {
  const rail = useRailSession(
    { presets } as never,
    {} as never,
    (text) => { said.push(text); },
    () => 10,
  );
  if (!rail.open) void rail.commands.open("first");
  return (
    <box>
      <text>{`title=${rail.title}`}</text>
      <text>{rail.focused ? "focused" : "blurred"}</text>
    </box>
  );
}

/**
 * A studio where applying anything saves it somewhere ELSE, the way a foreign edit does.
 *
 * `stage` is asked about `first` and the receipt comes back naming `first-2`, because editing a raw
 * export writes a Hoplight copy under a free id rather than over the original.
 */
const copyingPresets = {
  ...presets,
  stage: async () => ({ ok: true as const, draftId: "d1", review: {} as never }),
  commit: async () => ({
    draftId: "d1",
    target: { kind: "preset" as const, id: "first-2", revision: "r1" },
    status: "applied" as const,
    operationCount: 1,
    changeCount: 1,
    detail: "",
  }),
  discard: () => {},
};

let applyApi: ReturnType<typeof useRailSession> | null = null;

/** Opens, stages a rename by hand, and applies it - the path a foreign preset takes. */
function ApplyHarness({ said }: { said: string[] }): ReactNode {
  const rail = useRailSession(
    { presets: copyingPresets } as never,
    { seam: () => ({ requestConfirm: async () => ({ type: "allow-once" as const }) }) } as never,
    (text) => { said.push(text); },
    () => 10,
  );
  if (!rail.open) void rail.commands.open("first");
  applyApi = rail;
  return (
    <box>
      <text>{`id=${rail.presetId ?? "-"}`}</text>
      <text>{`pending=${rail.pending}`}</text>
    </box>
  );
}

describe("applying a foreign preset", () => {
  /**
   * THE RAIL FOLLOWS WHAT IT WROTE.
   *
   * The rename applied cleanly and the header snapped back to the untouched original, because the
   * rail went on pointing at the piece it opened rather than the copy that was saved. It reads as
   * the rename being lost, and the next apply would have made another copy beside the first.
   */
  test("the rail moves to the copy it just saved", async () => {
    const said: string[] = [];
    const { mockInput, renderer, captureCharFrame } = await testRender(
      <ApplyHarness said={said} />,
      { width: 80, height: 24 },
    );
    try {
      await settleRender();
      expect(captureCharFrame()).toContain("id=first");

      // Reached in from outside, the way a click or the composer Tab does. There is no composer in
      // this harness, and the rail has no focus key of its own: inside it, Tab is how you LEAVE.
      applyApi!.takeFocus();
      await settleRender();
      // t renames the PRESET - it was shift+R, one key from the block rename. A typed character
      // makes it a real change; enter commits the name, and s saves.
      mockInput.pressKey("t");
      await settleRender();
      mockInput.pressKey("!");
      await settleRender();
      mockInput.pressEnter();
      await settleRender();
      expect(captureCharFrame()).toContain("pending=1");

      // s saves, whatever is pending. Enter used to do this, and also opened a row.
      mockInput.pressKey("s");
      await settleRender();
      await settleRender();
      expect(captureCharFrame()).toContain("id=first-2");
      expect(captureCharFrame()).toContain("pending=0");
    } finally {
      await renderer.destroy();
    }
  });
});

describe("/rail leaves the keyboard where typing works", () => {
  /**
   * OPENING MUST NOT TAKE THE KEYBOARD.
   *
   * The version that did was worse than the one that did not: the rail's letters mean things - r
   * renames, e rewrites, n opens a note - so a rail holding the keys turned an ordinary attempt to
   * type a message into a rename dialog, with no obvious way out. Reported as "I am trying to type
   * and literally now can't".
   */
  test("the rail opens without stealing focus", async () => {
    const said: string[] = [];
    const { renderer, captureCharFrame } = await testRender(<Harness said={said} />, { width: 80, height: 24 });
    try {
      await settleRender();
      const frame = captureCharFrame();
      expect(frame).toContain("title=First Preset");
      expect(frame).toContain("blurred");
    } finally {
      await renderer.destroy();
    }
  });

  /**
   * And the arrows still work, because the COMPOSER forwards them - see composer.tsx, which only
   * does it while its draft is empty. That guard is the whole design: an arrow in a half-written
   * sentence is a cursor move and nothing may take it.
   *
   * `step` is the seam the composer calls, so this presses on the seam rather than on a terminal.
   */
  test("stepping works without the rail ever holding the keyboard", async () => {
    const said: string[] = [];
    let session: { step: (d: number) => Promise<void>; title: string } | null = null;
    function Capture(): ReactNode {
      const rail = useRailSession({ presets } as never, {} as never, (t) => { said.push(t); }, () => 10);
      if (!rail.open) void rail.commands.open("first");
      session = rail;
      return <box><text>{`title=${rail.title}`}</text><text>{rail.focused ? "focused" : "blurred"}</text></box>;
    }
    const { renderer, captureCharFrame } = await testRender(<Capture />, { width: 80, height: 24 });
    try {
      await settleRender();
      await session!.step(1);
      await settleRender();
      expect(captureCharFrame()).toContain("title=Second Preset");
      // Still blurred: stepping must not quietly take the keyboard either.
      expect(captureCharFrame()).toContain("blurred");

      // The SECOND step, which is where the old blur-on-follow bug killed the arrows.
      await session!.step(1);
      await settleRender();
      expect(captureCharFrame()).toContain("title=First Preset");
    } finally {
      await renderer.destroy();
    }
  });
});
