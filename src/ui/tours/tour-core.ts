/**
 * Pure sequencing logic for the tour engine (the functional core the TourGuide shell wraps). No DOM,
 * no prefs, no effects - just: where am I in the tour, what is the next/prev step, is it seen. Every
 * function is a deterministic map over the tour data + an index, so tour-core.test.ts pins them
 * directly. The imperative shell (components/tour-guide) supplies the real index state, the DOM
 * highlight, and the pref read/write.
 */
import type { Tour, TourStep } from "./tour-contract";

/** The settings key that records a tour as completed (namespaced by app, per the prefs convention). */
export const tourSeenKey = (appId: string): string => `tour.${appId}.seen`;

/** Has this tour been completed before? The shell auto-launches only when this is false. Tolerant:
 * anything other than the literal `true` (unset, stale shapes) reads as not-yet-seen. */
export const hasSeenTour = (prefValue: unknown): boolean => prefValue === true;

/** Where the tour is right now, resolved from a raw (possibly out-of-range) index. */
export interface TourPosition {
  /** the active step, or null for an empty tour */
  step: TourStep | null;
  /** the index clamped into range */
  index: number;
  /** number of steps */
  total: number;
  /** human 1-based position for "N of M" */
  human: number;
  isFirst: boolean;
  isLast: boolean;
}

/** Resolve the current position. Tolerant: an empty tour yields a null step; an out-of-range index
 * clamps into [0, total) rather than throwing (a shell never has to guard the index itself). */
export function positionAt(tour: Tour, rawIndex: number): TourPosition {
  const total = tour.steps.length;
  if (total === 0) return { step: null, index: 0, total: 0, human: 0, isFirst: true, isLast: true };
  const index = Math.max(0, Math.min(Math.trunc(rawIndex) || 0, total - 1));
  return {
    step: tour.steps[index]!,
    index,
    total,
    human: index + 1,
    isFirst: index === 0,
    isLast: index === total - 1,
  };
}

/** The next index, clamped to the last step (advancing past the end is a no-op, not an overflow). */
export const nextIndex = (tour: Tour, index: number): number =>
  Math.min(Math.max(0, index) + 1, Math.max(0, tour.steps.length - 1));

/** The previous index, clamped to the first step. */
export const prevIndex = (index: number): number => Math.max(0, index - 1);

/** A validity check a shell can use before mounting: a real tour has at least one step. */
export const isRunnable = (tour: Tour | null | undefined): tour is Tour =>
  !!tour && Array.isArray(tour.steps) && tour.steps.length > 0;
