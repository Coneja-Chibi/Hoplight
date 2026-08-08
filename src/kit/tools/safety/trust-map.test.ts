/**
 * Every first-party tool must be classified in the trust map.
 *
 * WHY THIS EXISTS. `access.ts` is deliberately deny-by-absence: a tool never declares its own risk,
 * so an unlisted name resolves to "unknown" and the Gate treats it as dangerous. That is the right
 * posture for a tool somebody drops in. It is the wrong FAILURE MODE for Kit's own tools, because a
 * forgotten entry does not produce a quiet hole - it produces a DANGER banner reading `unrecognized
 * tool` on something perfectly safe.
 *
 * That is not hypothetical. `block_lookup`, `folder_search`, `folder_import`, `preset_verify` and
 * `rail_open` all shipped missing from the map. Every call raised a false alarm, including on
 * `folder_import` - the tool a user needed to bring their own file in. Alarms on safe operations are
 * how people learn to click through the prompt that actually matters, so this is a security defect in
 * both directions, not only an annoyance.
 *
 * The belt is discovered from the folder, so this test sees whatever is really shipped rather than a
 * list somebody remembered to update. A new tool with no entry fails here, in CI, instead of in front
 * of somebody using it.
 */
import { describe, expect, test } from "bun:test";
import { discoverTools } from "../discover";
import { resolveAccess } from "./access";

describe("the trust map covers every shipped tool", () => {
  test("no first-party tool resolves to unknown", async () => {
    const tools = await discoverTools();
    // A belt that came back empty would make this test vacuously green, which is the same trap the
    // map itself fell into: absence reading as success.
    expect(tools.length).toBeGreaterThan(10);

    const unclassified = tools.map((t) => t.name).filter((name) => resolveAccess(name) === "unknown");
    expect(unclassified).toEqual([]);
  });

  test("a tool's declared effect agrees with the class the map gives it", async () => {
    const tools = await discoverTools();
    const disagreed: string[] = [];
    for (const tool of tools) {
      const declared = (tool as { effect?: string }).effect;
      if (declared === undefined) continue;
      const granted = resolveAccess(tool.name);
      // The map may be STRICTER than the tool claims - that is the whole point of not letting the
      // gated thing set its own risk. It may never be looser: a tool declaring `read` must not have
      // been handed `write`, which would mean the map trusts it with more than it asked for.
      const looser =
        (declared === "read" && granted !== "read") ||
        (declared === "draft" && (granted === "write" || granted === "delete" || granted === "exec"));
      if (looser) disagreed.push(`${tool.name}: declares ${declared}, map grants ${granted}`);
    }
    expect(disagreed).toEqual([]);
  });
});
