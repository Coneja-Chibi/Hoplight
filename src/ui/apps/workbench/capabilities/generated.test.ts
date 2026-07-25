/** Generated Workbench capability manifest parity with Kit's filesystem discovery. */
import { expect, test } from "bun:test";
import { discoverCapabilities } from "../../../../kit/capabilities/discover";
import { workbenchCapabilities } from "./generated";

test("generated Workbench capabilities match Kit discovery", async () => {
  const browserIds = workbenchCapabilities.map((capability) => capability.id).sort();
  const kitIds = (await discoverCapabilities()).map((capability) => capability.id).sort();
  expect(browserIds).toEqual(kitIds);
});
