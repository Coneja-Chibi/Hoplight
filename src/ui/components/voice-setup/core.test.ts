/** Regression coverage for the core.test behavior owned beside this file. */
import { test, expect } from "bun:test";
import { normalizeVoice, voiceToCanonical } from "./core";

test("normalizeVoice reads provider and extras", () => {
  const v = normalizeVoice({
    provider: "elevenlabs",
    voiceId: "abc",
    rate: 1.1,
    extras: { stability: 0.5 },
  });
  expect(v.provider).toBe("elevenlabs");
  expect(v.voiceId).toBe("abc");
  expect(v.extras.stability).toBe("0.5");
});

test("normalizeVoice accepts legacy service key", () => {
  const v = normalizeVoice({ service: "novel", voiceId: "n1" });
  expect(v.provider).toBe("novel");
  expect(v.voiceId).toBe("n1");
});

test("voiceToCanonical drops default rate/pitch", () => {
  const w = voiceToCanonical({
    provider: "agnaistic",
    voiceId: "x",
    rate: 1,
    pitch: 0,
    disabled: false,
    extras: {},
  });
  expect(w).toEqual({ provider: "agnaistic", voiceId: "x" });
});

test("voiceToCanonical keeps disabled and extras", () => {
  const w = voiceToCanonical({
    provider: "elevenlabs",
    voiceId: "",
    rate: 1.2,
    pitch: 0,
    disabled: true,
    extras: { stability: "0.5" },
  });
  expect(w).toEqual({
    provider: "elevenlabs",
    rate: 1.2,
    disabled: true,
    extras: { stability: 0.5 },
  });
});
