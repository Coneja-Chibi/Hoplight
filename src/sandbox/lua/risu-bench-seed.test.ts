/**
 * Bench seed from character body + vars.
 */
import { test, expect } from "bun:test";
import { defaultBenchChat, metaFromCharacterBody, seedRisuBench } from "./risu-bench-seed";

test("metaFromCharacterBody reads identity and first greeting", () => {
  const meta = metaFromCharacterBody({
    identity: { name: "Cherry", description: "a student" },
    greetings: [{ text: "Hi there." }],
    persona: { personality: "warm" },
  });
  expect(meta.name).toBe("Cherry");
  expect(meta.description).toBe("a student");
  expect(meta.firstMessage).toBe("Hi there.");
  expect(meta.personaDescription).toBe("warm");
});

test("seedRisuBench merges vars and default chat", () => {
  const state = seedRisuBench({
    vars: [{ name: "hp", value: "9" }],
    body: { identity: { name: "A" }, greetings: ["yo"] },
  });
  expect(state.chatVars.hp).toBe("9");
  expect(state.meta.name).toBe("A");
  expect(state.chat.length).toBe(2);
  expect(state.chat[0]?.data).toBe("yo");
  expect(defaultBenchChat(state.meta)[0]?.role).toBe("char");
});
