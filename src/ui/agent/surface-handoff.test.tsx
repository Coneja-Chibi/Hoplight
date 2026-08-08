/**
 * The handoff: a screen publishes, the user opens the agent window, the window still knows.
 *
 * THIS FILE EXISTS BECAUSE THE OTHER TESTS DID NOT CATCH THE BUG. The room's tests use
 * renderToStaticMarkup with a snapshot published by hand, which runs no effects and unmounts
 * nothing - so the one sequence production always takes was never executed. The window shipped
 * reading null on every navigation and every turn went to the model with no context.
 *
 * So this one MOUNTS, unmounts, and mounts again through a real DOM, which is the only way the
 * publish lifecycle is exercised at all.
 */
import { describe, expect, test, beforeAll } from "bun:test";
import { JSDOM } from "jsdom";
import { useEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { liveSurface } from "./live-state";
import type { AgentState } from "./surface";

beforeAll(() => {
  const dom = new JSDOM("<!doctype html><div id=\"root\"></div>", { pretendToBeVisual: true });
  const g = globalThis as unknown as Record<string, unknown>;
  g["window"] = dom.window;
  g["document"] = dom.window.document;
  g["navigator"] = dom.window.navigator;
  g["HTMLElement"] = dom.window.HTMLElement;
  g["Element"] = dom.window.Element;
  g["Node"] = dom.window.Node;
  // flushSync already commits synchronously here, so act() would add nothing but a wrapper. The
  // flag is what makes React ask for one, and asking produces a warning in otherwise clean output.
  g["IS_REACT_ACT_ENVIRONMENT"] = false;
});

/** A stand-in for any app that describes itself: publishes on mount, the way the Library does. */
function PublishingScreen({ appId, state }: { appId: string; state: AgentState }): null {
  useEffect(() => {
    liveSurface.publish(appId, state);
  }, [appId, state]);
  return null;
}

describe("handing the screen to the agent window", () => {
  test("THE SNAPSHOT SURVIVES THE SCREEN BEING UNMOUNTED", () => {
    /**
     * The exact production sequence. The shell swaps apps through one slot, so opening the agent
     * window unmounts the app behind it. When publishing returned a cleanup, React ran it here and
     * the window read null - the failure was total and silent, on the only path that matters.
     */
    const host = document.getElementById("root");
    if (!host) throw new Error("no host");
    const root: Root = createRoot(host);

    flushSync(() => {
      root.render(
        <PublishingScreen appId="library" state={{ headline: "The Presets shelf, 164 pieces." }} />,
      );
    });
    expect(liveSurface.current()?.appId).toBe("library");

    // The user opens the agent window: the Library comes off the slot.
    flushSync(() => { root.render(<div />); });

    expect(liveSurface.current()?.appId).toBe("library");
    expect(liveSurface.current()?.state.headline).toContain("164 pieces");

    root.unmount();
  });

  test("a screen that publishes later replaces the one before it", () => {
    const host = document.getElementById("root");
    if (!host) throw new Error("no host");
    const root: Root = createRoot(host);

    flushSync(() => {
      root.render(<PublishingScreen appId="library" state={{ headline: "The Library." }} />);
    });
    flushSync(() => {
      root.render(<PublishingScreen appId="workbench" state={{ headline: "The Workbench." }} />);
    });

    expect(liveSurface.current()?.appId).toBe("workbench");
    root.unmount();
  });
});
