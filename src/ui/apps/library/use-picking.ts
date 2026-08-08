/**
 * The shelf's selection, held in one place.
 *
 * The room used to keep a bare `Set` and toggle it inline, which was exactly right when a click was
 * the only way to pick something. Ranges and dragged boxes both need to know WHERE THE LAST CLICK
 * WAS, and an anchor threaded through JSX beside a setState call is how the three gestures start
 * disagreeing. Every decision lives in select-core.ts; this owns the state and nothing else.
 */
import { useCallback, useRef, useState } from "react";
import { applyMarquee, applyPick, marqueeHits, type Box, type Picking } from "./select-core";

export interface PickingRoom {
  readonly selected: ReadonlySet<string>;
  /** One click, with whatever modifiers came with it. */
  press: (key: string, mods: { shift: boolean; meta: boolean }, order: readonly string[], open: ReadonlySet<string>) => void;
  /** A released drag box, against the cards it swept. */
  sweep: (
    cards: readonly { key: string; box: Box }[],
    box: Box,
    additive: boolean,
    open: ReadonlySet<string>,
  ) => void;
  /** Stage exactly these (Select all), or none (Clear, and after a send). */
  replace: (keys: readonly string[]) => void;
}

export function usePicking(): PickingRoom {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set<string>());
  /**
   * The anchor rides a REF, not state. It changes on every click and nothing renders from it, so
   * as state it would be a second repaint per click for no visible difference.
   */
  const anchor = useRef("");

  const commit = useCallback((next: Picking): void => {
    anchor.current = next.anchor;
    setSelected(next.selected);
  }, []);

  const press: PickingRoom["press"] = useCallback((key, mods, order, open) => {
    setSelected((current) => {
      const next = applyPick({ selected: current, anchor: anchor.current }, { key, order, open, ...mods });
      anchor.current = next.anchor;
      return next.selected;
    });
  }, []);

  const sweep: PickingRoom["sweep"] = useCallback((cards, box, additive, open) => {
    const hits = marqueeHits(cards, box, open);
    // A box that swept nothing and was not additive still means something: it clears, the way
    // dragging on empty space does everywhere else.
    setSelected((current) => {
      const next = applyMarquee({ selected: current, anchor: anchor.current }, hits, additive);
      anchor.current = next.anchor;
      return next.selected;
    });
  }, []);

  const replace: PickingRoom["replace"] = useCallback((keys) => {
    commit({ selected: new Set(keys), anchor: keys.at(-1) ?? "" });
  }, [commit]);

  return { selected, press, sweep, replace };
}
