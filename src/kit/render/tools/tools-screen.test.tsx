/** @jsxImportSource @opentui/react */
/**
 * Render proof for the wide and compact capability browser plus its real keyboard path.
 */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { ContentCapability } from "../../../entities/capabilities";
import { ToolsScreen } from "./tools-screen";

const pieces = [{ id: "book", kind: "lorebook", name: "Aetheria", importedAt: "" }];
const capabilities = [{
  id: "lorebook.entries.update",
  kind: "lorebook",
  area: "entries",
  action: "update",
  summary: "Update one lorebook entry.",
  platforms: "canonical",
}] as unknown as ContentCapability[];

for (const size of [{ width: 110, height: 30 }, { width: 60, height: 20 }]) {
  test(`renders the three-pane browser at ${size.width} columns`, async () => {
    const t = await testRender(
      <ToolsScreen
        pieces={pieces}
        capabilities={capabilities}
        studioName="Hoplight Studio"
        onClose={() => {}}
      />,
      size,
    );
    try {
      await t.waitForFrame((frame) => frame.includes("Aetheria"), { maxPasses: 100 });
      const frame = t.captureCharFrame();
      expect(frame).toContain("PIECE");
      if (size.width >= 72) {
        expect(frame).toContain("AREA");
        expect(frame).toContain("ACTIONS");
        expect(frame).toContain("entries");
      } else {
        expect(frame).not.toContain("ACTIONS");
        expect(frame).toContain("Aetheria");
      }
    } finally {
      await t.renderer.destroy();
    }
  });
}

test("keyboard reaches action details and escape closes", async () => {
  let closed = false;
  const t = await testRender(
    <ToolsScreen
      pieces={pieces}
      capabilities={capabilities}
      studioName="Studio"
      onClose={() => { closed = true; }}
    />,
    { width: 90, height: 24 },
  );
  try {
    await t.waitForFrame((frame) => frame.includes("Aetheria"), { maxPasses: 100 });
    t.mockInput.pressKey("ARROW_RIGHT");
    t.mockInput.pressKey("ARROW_RIGHT");
    await t.waitForFrame((frame) => frame.includes("Update one lorebook entry."), { maxPasses: 100 });
    t.mockInput.pressEscape();
    await Bun.sleep(20);
    expect(closed).toBe(true);
  } finally {
    await t.renderer.destroy();
  }
});
