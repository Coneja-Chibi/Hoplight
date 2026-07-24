/**
 * NanoGPT plan routing: the chat base must follow the picked plan (subscription hits the
 * subscription endpoint), and an explicit base URL must always win. The model list is
 * plan-independent by design (verified against the live public endpoint).
 */
import { describe, expect, test } from "bun:test";
import { chatBase } from "./nanogpt";

describe("nanogpt chatBase", () => {
  test("pay-as-you-go is the default", () => {
    expect(chatBase({})).toBe("https://nano-gpt.com/api/v1");
    expect(chatBase({ options: { plan: "paygo" } })).toBe("https://nano-gpt.com/api/v1");
  });

  test("subscription routes to the subscription endpoint", () => {
    expect(chatBase({ options: { plan: "subscription" } })).toBe(
      "https://nano-gpt.com/api/subscription/v1",
    );
  });

  test("an explicit base URL always wins", () => {
    expect(chatBase({ baseURL: "https://proxy.example/v1", options: { plan: "subscription" } })).toBe(
      "https://proxy.example/v1",
    );
  });
});
