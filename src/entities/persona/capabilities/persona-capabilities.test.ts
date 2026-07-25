/**
 * Persona semantic bundle coverage: short/long text separation, nested fields, and escrow safety.
 */
import { expect, test } from "bun:test";
import type { CanonicalPersona } from "../schema";
import identity from "./identity";
import profile from "./profile";
import injection from "./injection";
import presentation from "./presentation";

const persona = (): CanonicalPersona => ({
  schemaVersion: "1",
  kind: "persona",
  id: "ada",
  body: {
    name: "Ada",
    brief: "A patient engineer.",
    content: "I build careful machines.",
    sections: { personality: "Direct", history: "Raised among engines." },
    traits: ["methodical"],
    identity: { pronouns: "she/her", tagline: "Builder" },
    chatInjection: { position: "character", wrapper: "The user is:" },
  },
  original: {
    rolecall: {
      raw: { sealed: true },
      unmapped: { privateField: 7 },
    },
  },
});

test("identity keeps persona brief and injected content as distinct semantic fields", () => {
  const before = persona();
  const preview = identity.preview(before, identity.input.parse({
    target: { id: "ada" },
    patch: {
      name: "Ada Vale",
      brief: null,
      content: "I build systems that fail visibly.",
    },
  }));
  expect(preview.entity.body.name).toBe("Ada Vale");
  expect(preview.entity.body.brief).toBeUndefined();
  expect(preview.entity.body.content).toBe("I build systems that fail visibly.");
  expect(preview.entity.original).toEqual(before.original);
});

test("profile updates structured sections and casting facts without rebuilding siblings", () => {
  const before = persona();
  const preview = profile.preview(before, profile.input.parse({
    target: { id: "ada" },
    patch: {
      appearance: "Oil-stained sleeves.",
      personality: "Warm and exact.",
      traits: ["methodical", "kind"],
      pronounSet: { subjective: "she", objective: "her", possessive: "hers" },
    },
  }));
  expect(preview.entity.body.sections).toEqual({
    appearance: "Oil-stained sleeves.",
    personality: "Warm and exact.",
    history: "Raised among engines.",
  });
  expect(preview.entity.body.identity?.tagline).toBe("Builder");
  expect(preview.entity.body.identity?.pronounSet?.possessive).toBe("hers");
});

test("injection can be replaced or explicitly removed", () => {
  const before = persona();
  const changed = injection.preview(before, injection.input.parse({
    target: { id: "ada" },
    injection: { position: "in_chat", depth: 2, role: "user" },
  }));
  expect(changed.entity.body.chatInjection).toEqual({
    position: "in_chat",
    depth: 2,
    role: "user",
  });
  const cleared = injection.preview(changed.entity, injection.input.parse({
    target: { id: "ada" },
    injection: null,
  }));
  expect(cleared.entity.body.chatInjection).toBeUndefined();
});

test("presentation updates portable visual, knowledge, rating, attribution, and portrait slots", () => {
  const before = persona();
  const preview = presentation.preview(before, presentation.input.parse({
    target: { id: "ada" },
    patch: {
      signatureColor: "violet",
      colors: [{ hex: "violet", label: "Coat", name: "Twilight" }],
      knowledgeRefs: ["workshop-lore"],
      rating: "all-ages",
      creator: "Coneja",
      portrait: { role: "portrait", ref: "asset://ada", primary: true },
    },
  }));
  expect(preview.entity.body.presentation?.signatureColor).toBe("violet");
  expect(preview.entity.body.knowledgeRefs).toEqual(["workshop-lore"]);
  expect(preview.entity.body.attribution?.creator).toBe("Coneja");
  expect(preview.entity.body.media?.portrait?.ref).toBe("asset://ada");
  expect(preview.entity.original).toEqual(before.original);
});
