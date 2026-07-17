import { test, expect } from "bun:test";
import { normalizeSprite, spriteToCanonical, spriteToWire } from "./core";

test("normalize flat wire", () => {
  const s = normalizeSprite({ body: "base_01", eyeColor: "#fff", gender: "female" });
  expect(s.parts.body).toBe("base_01");
  expect(s.eyeColor).toBe("#fff");
  expect(s.gender).toBe("female");
});

test("spriteToWire is flat", () => {
  expect(spriteToWire({
    parts: { eyes: "neutral" },
    gender: "male",
    eyeColor: "#000",
    bodyColor: "",
    hairColor: "",
  })).toEqual({ eyes: "neutral", gender: "male", eyeColor: "#000" });
});

test("spriteToCanonical nests parts", () => {
  expect(spriteToCanonical({
    parts: { eyes: "neutral" },
    gender: "male",
    eyeColor: "#000",
    bodyColor: "",
    hairColor: "",
  })).toEqual({ parts: { eyes: "neutral" }, gender: "male", eyeColor: "#000" });
});
