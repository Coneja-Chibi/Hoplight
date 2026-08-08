/**
 * Which screen the agent window is looking at.
 *
 * The test that matters here is the SECOND one. The first version of this file asserted that
 * unmounting a screen cleared its snapshot, which reads as obviously correct and made the entire
 * feature deliver nothing: the shell mounts one app at a time, so opening the agent window unmounts
 * the screen it exists to describe.
 */
import { describe, expect, test } from "bun:test";
import { createLiveSurface } from "./live-state";

const state = (headline: string) => ({ headline });

describe("createLiveSurface", () => {
  test("nothing is published to begin with", () => {
    expect(createLiveSurface().current()).toBeNull();
  });

  test("A SCREEN THAT HAS GONE AWAY IS STILL THE SCREEN YOU CAME FROM", () => {
    /**
     * The bug this file was written the wrong way round for.
     *
     * The shell swaps apps into one slot, so opening the agent window unmounts the Library. If that
     * unmount withdrew the Library's snapshot - which the first version did, via a cleanup returned
     * from the publishing effect - the window read null on the one navigation it exists for, said
     * "no screen has described itself yet", and sent every turn to the model with no context.
     *
     * Persisting is not tolerated staleness. It is the requirement: the screen being described is by
     * definition the one no longer mounted.
     */
    const live = createLiveSurface();
    live.publish("library", state("The Presets shelf, 164 pieces."));

    // ... the Library unmounts here as the agent window opens. Nothing is withdrawn, because there
    // is no withdrawal: publishing is the only operation this surface has.

    expect(live.current()?.appId).toBe("library");
    expect(live.current()?.state.headline).toContain("164 pieces");
  });

  test("the newest screen replaces the one before it", () => {
    const live = createLiveSurface();
    live.publish("library", state("The Library."));
    live.publish("workbench", state("The Workbench."));

    expect(live.current()?.appId).toBe("workbench");
    expect(live.current()?.state.headline).toBe("The Workbench.");
  });

  test("subscribers hear every publish, and can leave", () => {
    const live = createLiveSurface();
    let heard = 0;
    const stop = live.onChange(() => { heard++; });

    live.publish("library", state("one"));
    live.publish("library", state("two"));
    expect(heard).toBe(2);

    stop();
    live.publish("library", state("three"));
    expect(heard).toBe(2);
  });

  test("a listener that unsubscribes itself does not skip the next one", () => {
    // The set is copied before iterating; mutating it mid-loop would drop whoever came after.
    const live = createLiveSurface();
    const heard: string[] = [];
    const stopA = live.onChange(() => { heard.push("a"); stopA(); });
    live.onChange(() => { heard.push("b"); });

    live.publish("library", state("one"));
    expect(heard).toEqual(["a", "b"]);
  });
});
