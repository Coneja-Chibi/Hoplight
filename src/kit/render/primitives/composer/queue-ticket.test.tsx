/** Rendered-frame proof for the compact queued-whisper ticket. */
import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { QueueTicket } from "./queue-ticket";

test("shows the next whisper and folds the remaining count", async () => {
  const rendered = await testRender(
    <QueueTicket items={["check Cedric too", "then compare Basil", "last one"]} />,
    { width: 72, height: 4 },
  );
  try {
    await rendered.renderOnce();
    const frame = rendered.captureCharFrame();
    expect(frame).toContain("QUEUED");
    expect(frame).toContain("check Cedric too");
    expect(frame).toContain("2 more");
  } finally {
    await rendered.renderer.destroy();
  }
});
