import { expect, test } from "bun:test";
import { characterFields, fieldsFor } from "./inspect-core";

const keys = (body: unknown): string[] => characterFields(body).map((f) => f.k);

test("pulls the core words in reading order", () => {
  const body = {
    identity: { tagline: "a rogue", description: "tall and tired" },
    persona: { personality: "wry", scenario: "a tavern" },
    greetings: { firstMessage: "hey" },
    examples: { exampleMessages: "<START>..." },
  };
  expect(keys(body)).toEqual([
    "tagline",
    "description",
    "personality",
    "scenario",
    "first message",
    "example messages",
  ]);
});

test("skips absent and blank fields (never a throw)", () => {
  expect(characterFields(undefined)).toEqual([]);
  expect(characterFields(null)).toEqual([]);
  expect(characterFields("not an object")).toEqual([]);
  expect(characterFields({ identity: { description: "   " }, persona: { personality: "" } })).toEqual([]);
});

test("enumerates alternate greetings, titled when the greeting has a title", () => {
  const body = {
    greetings: {
      firstMessage: "hi",
      alternateGreetings: [{ text: "morning" }, { text: "evening", title: "Dusk" }],
    },
  };
  const fields = characterFields(body);
  expect(fields.map((f) => f.k)).toEqual(["first message", "alt greeting 1", "alt greeting · Dusk"]);
  expect(fields.find((f) => f.k === "alt greeting · Dusk")?.v).toBe("evening");
});

test("flattens string lists (tags, source, content warnings)", () => {
  const body = {
    attribution: { source: ["chub", "discord"] },
    discovery: { tags: ["fantasy", "male"], contentWarnings: ["violence"] },
  };
  const map = Object.fromEntries(characterFields(body).map((f) => [f.k, f.v]));
  expect(map["tags"]).toBe("fantasy, male");
  expect(map["source"]).toBe("chub, discord");
  expect(map["content warnings"]).toBe("violence");
});

test("surfaces prompt slots, identity facts, and attribution notes", () => {
  const body = {
    identity: { age: "300+", pronouns: "he/him", fullName: "Lucio Vane" },
    prompts: { systemPrompt: "stay in character", prefill: "Sure," },
    attribution: { creator: "ada", creatorNotes: "be gentle", license: "CC-BY" },
  };
  const got = new Set(keys(body));
  for (const k of ["age", "pronouns", "full name", "system prompt", "prefill", "creator", "creator notes", "license"]) {
    expect(got.has(k)).toBe(true);
  }
});

test("fieldsFor dispatches character and defers unknown kinds", () => {
  const body = { identity: { tagline: "x" } };
  expect(fieldsFor("character", body).length).toBe(1);
  expect(fieldsFor("lorebook", body)).toEqual([]);
  expect(fieldsFor("preset", body)).toEqual([]);
});
