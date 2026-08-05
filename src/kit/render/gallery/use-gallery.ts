/**
 * The gallery: every piece of card art you own, laid out along the bottom of the screen.
 *
 * The preset rail answers "what order do these blocks run in", which is a question you cannot see any
 * other way. This answers a different one, and a simpler one: what does my cast LOOK like. A studio
 * full of portraits had no route to the screen at all, so the only way to remember a face was to open
 * the app.
 *
 * ALONG THE BOTTOM, ATTACHED TO THE COMPOSER, because that is where a shelf belongs relative to the
 * thing you are writing in: you glance down at it and go back to typing. The preset rail is vertical
 * and to the side for the opposite reason - a block list is long and read top to bottom.
 *
 * THE KEYBOARD CONTRACT IS THE RAIL'S, DELIBERATELY. Ctrl+B hands the keyboard over, arrows move,
 * escape hands it back, and NOTHING is prevented while the composer holds focus. That last clause is
 * the whole lesson from the rail eating the composer: opentui stops dispatching a prevented key to
 * the focused renderable, so a strip that grabbed the arrows would silently break typing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import type { Session } from "../../session";
import type { FoundArt } from "../art-lookup";

export interface GalleryState {
  readonly open: boolean;
  readonly loading: boolean;
  /** Every piece with art, in shelf order. */
  readonly items: readonly FoundArt[];
  /** Which one is under the cursor; -1 when the shelf is empty. */
  readonly index: number;
  /** Does the strip have the keyboard? False means every key belongs to the composer. */
  readonly focused: boolean;
  /** Pieces looked at that carried no art, so the count can be honest about what is missing. */
  readonly withoutArt: number;
  /** True when the deck was larger than the scan limit. */
  readonly more: boolean;
  readonly close: () => void;
}

export interface GalleryCommands {
  /** Open the strip for a deck, loading it if it is not already loaded. */
  open: (kind?: string) => Promise<{ ok: true; count: number } | { ok: false; detail: string }>;
  close: () => void;
}

export interface GallerySession {
  state: GalleryState;
  commands: GalleryCommands;
  /** The name under the cursor, for the composer to insert when somebody picks one. */
  picked: string | null;
  clearPicked: () => void;
  select: (index: number) => void;
}

export function useGallery(session: Session): GallerySession {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<readonly FoundArt[]>([]);
  const [index, setIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [withoutArt, setWithoutArt] = useState(0);
  const [more, setMore] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Handing the keyboard back on close is not tidiness. A closed strip that still held focus would
    // swallow every arrow key with nothing on screen to explain why.
    setFocused(false);
  }, []);

  const openFor = useCallback(async (kind = "character") => {
    if (!session.art) return { ok: false as const, detail: "This studio has no art seam." };
    setLoading(true);
    try {
      const { found, scanned, more: truncated } = await session.art.gallery(kind);
      setItems(found);
      setWithoutArt(Math.max(0, scanned - found.length));
      setMore(truncated);
      setIndex(found.length > 0 ? 0 : -1);
      setOpen(true);
      if (found.length === 0) {
        // Open anyway, with the reason on screen. A strip that refuses to appear looks broken; one
        // that appears and says "none of your 23 characters carry art" answers the question asked.
        return { ok: true as const, count: 0 };
      }
      return { ok: true as const, count: found.length };
    } finally {
      setLoading(false);
    }
  }, [session]);

  const stateRef = useRef({ open, focused, index, count: items.length });
  stateRef.current = { open, focused, index, count: items.length };

  useKeyboard((event: KeyEvent) => {
    const now = stateRef.current;
    if (!now.open) return;

    // Ctrl+B hands the keyboard over, the same door the preset rail uses. One gesture for "let me
    // drive the thing beside my typing" rather than a second one to learn.
    if (event.name === "b" && event.ctrl === true) {
      event.preventDefault();
      setFocused((on) => !on);
      return;
    }

    // NOTHING BELOW RUNS WHILE THE COMPOSER HAS FOCUS. See the header.
    if (!now.focused) return;

    if (event.name === "escape") {
      event.preventDefault();
      setFocused(false);
      return;
    }
    if (event.name === "left" || event.name === "right") {
      event.preventDefault();
      if (now.count === 0) return;
      const step = event.name === "right" ? 1 : -1;
      // Clamped rather than wrapped: a shelf has ends, and wrapping from the last face to the first
      // reads as the list having jumped rather than as having arrived.
      setIndex((i) => Math.min(now.count - 1, Math.max(0, i + step)));
      return;
    }
    if (event.name === "home" || event.name === "end") {
      event.preventDefault();
      if (now.count > 0) setIndex(event.name === "home" ? 0 : now.count - 1);
      return;
    }
    if (event.name === "return") {
      event.preventDefault();
      const chosen = items[now.index];
      // Fills the composer rather than sending, the same rule the choice list follows: picking is
      // not speaking, and the person still owns the message.
      if (chosen) setPicked(chosen.name);
    }
  });

  useEffect(() => {
    if (!open) setFocused(false);
  }, [open]);

  return {
    state: { open, loading, items, index, focused, withoutArt, more, close },
    commands: { open: openFor, close },
    picked,
    clearPicked: () => setPicked(null),
    select: (next: number) => setIndex(next),
  };
}
