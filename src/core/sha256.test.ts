/** SHA-256 compatibility vectors for the shared synchronous implementation. */
import { describe, expect, test } from "bun:test";
import { sha256Hex } from "./sha256";

describe("sha256Hex", () => {
  test.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["Hoplight / こんにちは", "0f0a0082f55c04ae4a540ca89511e2609b5d79e675c74a0344ad9dfdb4bbd5cc"],
  ])("hashes %j", (value, expected) => expect(sha256Hex(value)).toBe(expected));
});
