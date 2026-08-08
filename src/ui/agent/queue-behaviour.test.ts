/**
 * What happens to a message typed while the agent is still answering.
 *
 * The bound and the FIFO are Kit's, tested where they live. What is worth pinning here is that this
 * window uses THAT queue rather than a second one - the terminal has had this since before the
 * window existed, and two implementations drift the first time either changes its mind.
 */
import { describe, expect, test } from "bun:test";
import { appendQueued, dequeueQueued, MAX_QUEUED } from "../../kit/render/primitives/composer/queue";
import { QUEUE_KEY, RESET_KEYS } from "../_shared/window-memory";

describe("the queue the window uses", () => {
  test("IT IS KIT'S, not a second one", () => {
    // Imported from the terminal's composer. If this file ever grows its own append/dequeue, the
    // two surfaces can disagree about how many messages may wait.
    expect(typeof appendQueued).toBe("function");
    expect(typeof dequeueQueued).toBe("function");
    expect(MAX_QUEUED).toBeGreaterThan(0);
  });

  test("empty lines are refused, so an accidental Enter queues nothing", () => {
    expect(appendQueued([], "   ").accepted).toBe(false);
    expect(appendQueued([], "a real thought").accepted).toBe(true);
  });

  test("BOUNDED, so a stuck turn cannot bank a hundred sends", () => {
    const full = Array.from({ length: MAX_QUEUED }, (_, i) => `m${String(i)}`);
    expect(appendQueued(full, "one more").accepted).toBe(false);
  });

  test("oldest first: the order things were said in is the order they are asked in", () => {
    const { item, queue } = dequeueQueued(["first", "second"]);
    expect(item).toBe("first");
    expect(queue).toEqual(["second"]);
  });
});

describe("what the queue survives", () => {
  test("A RELOAD DOES NOT EAT IT", () => {
    /**
     * Session storage rather than component state, because this page reloads itself whenever the
     * source changes underneath it - and a queued message is something somebody wrote and has not
     * seen answered yet.
     */
    expect(RESET_KEYS.some((k) => k.key === QUEUE_KEY && k.where === "session")).toBe(true);
  });

  test("BUT A RESET CLEARS IT, with the transcript it belongs to", () => {
    // A fresh conversation inheriting the last one's unsent thoughts would send them into a chat
    // they were never meant for.
    expect(RESET_KEYS.map((k) => k.key)).toContain(QUEUE_KEY);
  });
});
