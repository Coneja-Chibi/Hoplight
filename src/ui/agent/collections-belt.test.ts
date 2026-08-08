/**
 * That the window's belt actually CARRIES studio_collections.
 *
 * WHY THIS TEST EXISTS AT ALL. Earlier in this window's life the system prompt said "you have no
 * tools" while the session ran twenty of them, and two tests asserted the false sentence rather than
 * the belt. The prompt now goes the other way - it tells the model to call studio_collections - and
 * an untrue instruction in that direction is the same defect: the model tries, gets nothing, and
 * tells the person a feature they can see in their library does not exist.
 *
 * Registering the file in the manifest proves DISCOVERY. It does not prove the tool survives to
 * dispatch, which is what a turn actually reaches. That is the gap this closes.
 */
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBridge } from "../../kit/bridge";
import { createSession } from "../../kit/session";
import { systemPrompt } from "./server-agent";

const root = mkdtempSync(join(tmpdir(), "hoplight-collections-belt-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("the session the window runs offers studio_collections to the model", async () => {
  const session = await createSession(createBridge(root));
  const snapshot = session.contextSnapshot?.();
  expect(snapshot).toBeDefined();
  const names = snapshot!.tools.map((tool) => tool.name);
  expect(names).toContain("studio_collections");
});

test("THE PROMPT ONLY NAMES A TOOL THE BELT HAS", async () => {
  /**
   * The pairing is the point. If somebody renames the tool, one of these two fails - rather than
   * both continuing to pass while the sentence quietly stops matching the world.
   */
  const session = await createSession(createBridge(root));
  const names = new Set(session.contextSnapshot?.().tools.map((tool) => tool.name) ?? []);
  const prompt = systemPrompt();
  for (const named of prompt.match(/studio_[a-z_]+/g) ?? []) {
    expect(names.has(named)).toBe(true);
  }
});

test("the marker the prompt teaches is the one the picker writes", () => {
  // use-mentions.test.ts proves the picker emits `@collection:<id>`; this proves the model is told
  // about that exact spelling and not a near miss.
  expect(systemPrompt()).toContain("@collection:<id>");
});
