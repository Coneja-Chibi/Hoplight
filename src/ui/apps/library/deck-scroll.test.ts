/**
 * Deck-chip wheel navigation keeps every overflowing Library deck reachable with an ordinary mouse.
 */
import { describe, expect, test } from "bun:test";
import {
  attachDeckWheelListener,
  createDeckWheelRef,
  handleDeckWheel,
  scrollDecksOnWheel,
} from "./deck-scroll";

describe("scrollDecksOnWheel", () => {
  test("maps vertical wheel movement onto an overflowing deck row", () => {
    const row = { scrollLeft: 0, scrollWidth: 900, clientWidth: 300 };

    expect(scrollDecksOnWheel(row, 0, 120)).toBe(true);
    expect(row.scrollLeft).toBe(120);
  });

  test("preserves horizontal trackpad movement when both deltas are present", () => {
    const row = { scrollLeft: 40, scrollWidth: 900, clientWidth: 300 };

    expect(scrollDecksOnWheel(row, 30, 100)).toBe(true);
    expect(row.scrollLeft).toBe(70);
  });

  test("scales line and page deltas to pixel scroll offsets", () => {
    const lines = { scrollLeft: 0, scrollWidth: 900, clientWidth: 300 };
    const pages = { scrollLeft: 0, scrollWidth: 900, clientWidth: 300 };

    expect(scrollDecksOnWheel(lines, 0, 3, 1, 20)).toBe(true);
    expect(lines.scrollLeft).toBe(60);
    expect(scrollDecksOnWheel(pages, 0, 1, 2)).toBe(true);
    expect(pages.scrollLeft).toBe(300);
  });

  test("uses a safe line-height fallback for invalid computed values", () => {
    const row = { scrollLeft: 0, scrollWidth: 900, clientWidth: 300 };

    expect(scrollDecksOnWheel(row, 0, 3, 1, Number.NaN)).toBe(true);
    expect(row.scrollLeft).toBe(48);
  });

  test("does not consume wheel movement when the row fits or is at an edge", () => {
    const fits = { scrollLeft: 0, scrollWidth: 300, clientWidth: 300 };
    const atEnd = { scrollLeft: 600, scrollWidth: 900, clientWidth: 300 };

    expect(scrollDecksOnWheel(fits, 0, 100)).toBe(false);
    expect(fits.scrollLeft).toBe(0);
    expect(scrollDecksOnWheel(atEnd, 0, 100)).toBe(false);
    expect(atEnd.scrollLeft).toBe(600);
  });
});

describe("handleDeckWheel", () => {
  test("cancels the browser default only when the deck row moved", () => {
    const row = { scrollLeft: 0, scrollWidth: 900, clientWidth: 300 } as HTMLElement;
    let canceled = false;
    const event = {
      deltaX: 0,
      deltaY: 120,
      deltaMode: 0,
      preventDefault: () => { canceled = true; },
    } as WheelEvent;

    handleDeckWheel(row, event);
    expect(canceled).toBe(true);
    expect(row.scrollLeft).toBe(120);
  });

  test("registers and removes a non-passive native wheel listener", () => {
    let registeredOptions: AddEventListenerOptions | undefined;
    let registeredListener: EventListenerOrEventListenerObject | undefined;
    let removedListener: EventListenerOrEventListenerObject | undefined;
    const row = {
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        registeredListener = listener;
        registeredOptions = typeof options === "object" ? options : undefined;
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        removedListener = listener;
      },
    } as unknown as HTMLElement;

    const detach = attachDeckWheelListener(row);
    expect(registeredOptions).toEqual({ passive: false });
    detach();
    expect(removedListener).toBe(registeredListener);
  });

  test("leaves Ctrl-wheel available for browser zoom", () => {
    const row = { scrollLeft: 0, scrollWidth: 900, clientWidth: 300 } as HTMLElement;
    let canceled = false;
    const event = {
      deltaX: 0,
      deltaY: 120,
      deltaMode: 0,
      ctrlKey: true,
      preventDefault: () => { canceled = true; },
    } as WheelEvent;

    handleDeckWheel(row, event);
    expect(row.scrollLeft).toBe(0);
    expect(canceled).toBe(false);
  });
});

describe("createDeckWheelRef", () => {
  test("attaches when the row mounts and cleans up when it unmounts", () => {
    let added: EventListenerOrEventListenerObject | undefined;
    let removed: EventListenerOrEventListenerObject | undefined;
    let options: AddEventListenerOptions | undefined;
    const row = {
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject, value?: boolean | AddEventListenerOptions) => {
        added = listener;
        options = typeof value === "object" ? value : undefined;
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        removed = listener;
      },
    } as unknown as HTMLDivElement;
    const ref = createDeckWheelRef();

    ref(row);
    expect(added).toBeDefined();
    expect(options).toEqual({ passive: false });
    ref(null);
    expect(removed).toBe(added);
  });
});
