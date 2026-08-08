/**
 * Questions the agent is holding, and every way one can end.
 *
 * Each test here is a way a write could escape review, which is why they read like paranoia. The
 * gate exists so nothing is written without somebody saying yes; a parked promise that resolves to
 * "allow" on a timeout, a stale id, or an abandoned tab would defeat it more completely than not
 * having a gate at all, because the window would still be showing one.
 */
import { describe, expect, test } from "bun:test";
import { createPendingGates } from "./pending-gates";

describe("createPendingGates", () => {
  test("an answer resolves the promise the loop is parked on", async () => {
    const gates = createPendingGates();
    const { id, answer } = gates.ask("turn-1");

    expect(gates.answer(id, { type: "allow-once" })).toBe(true);
    await expect(answer).resolves.toEqual({ type: "allow-once" });
    expect(gates.size()).toBe(0);
  });

  test("AN UNKNOWN ID IS REFUSED, not quietly accepted", async () => {
    // A stale id is a double-click or a question that already timed out. Silence would let the
    // window show "sent" for an answer that reached nothing.
    const gates = createPendingGates();
    expect(gates.answer("not-a-real-id", { type: "allow-once" })).toBe(false);
  });

  test("A QUESTION CANNOT BE ANSWERED TWICE", async () => {
    /**
     * Two clicks on a slow gate must not become allow-then-deny reaching two different places, and
     * a resolved promise silently ignoring the second answer would leave the window believing the
     * later one won.
     */
    const gates = createPendingGates();
    const { id, answer } = gates.ask("turn-1");

    expect(gates.answer(id, { type: "allow-once" })).toBe(true);
    expect(gates.answer(id, { type: "deny" })).toBe(false);
    await expect(answer).resolves.toEqual({ type: "allow-once" });
  });

  test("AN ABANDONED TURN DENIES EVERYTHING IT WAS HOLDING", async () => {
    /**
     * The tab closed, or the laptop slept, mid-question. Leaving these parked holds a dispatch loop
     * and a provider connection open; resolving them to anything but deny would apply a write
     * nobody was there to see.
     */
    const gates = createPendingGates();
    const one = gates.ask("turn-1");
    const two = gates.ask("turn-1");
    const other = gates.ask("turn-2");

    expect(gates.abandon("turn-1")).toBe(2);

    await expect(one.answer).resolves.toEqual({ type: "deny" });
    await expect(two.answer).resolves.toEqual({ type: "deny" });
    // Another turn's questions are untouched: turns are independent.
    expect(gates.size()).toBe(1);
    expect(gates.answer(other.id, { type: "allow-once" })).toBe(true);
  });

  test("ids are unique across turns, so one turn cannot answer another's question", () => {
    const gates = createPendingGates();
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(gates.ask(i % 2 ? "a" : "b").id);
    expect(seen.size).toBe(50);
  });

  test("abandoning a turn with nothing open is not an error", () => {
    expect(createPendingGates().abandon("never-existed")).toBe(0);
  });
});
