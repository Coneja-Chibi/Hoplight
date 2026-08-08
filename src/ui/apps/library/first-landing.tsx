/**
 * The two full-screen states the Library shows INSTEAD of shelves, kept side by side because the
 * whole point is that they must never be confused with each other.
 *
 * A STUDIO THAT COULD NOT BE READ IS NOT AN EMPTY STUDIO. One of these says "start fresh" and the
 * other refuses to, because offering it over a full studio nobody could reach reads as "your work
 * is gone" and invites somebody to act on it. The same distinction runs through the room's search
 * (an empty deck versus a deck filtered to nothing) and its status line.
 *
 * Both are dumb renderers, taking already-bound callbacks. Lifted out of index.tsx when the search
 * box arrived and the room hit its line cap; nothing about them needs the room's state.
 */
import type { DragEvent, JSX, ReactNode } from "react";
import type { StudioDamagedEntry } from "../../app-contract";
import { DamageNotice } from "./damage-notice";

interface DoorsBase {
  /** the room's injected stylesheet, which these full-screen states render outside of */
  css: string;
  damaged: StudioDamagedEntry[];
  studioDir?: string;
}

/** The studio did not answer. NO create button: the pieces are probably all still there. */
export function StudioUnreachable({
  css,
  damaged,
  studioDir,
  onRetry,
}: DoorsBase & { onRetry: () => void }): JSX.Element {
  return (
    <div className="lib">
      <style>{css}</style>
      <DamageNotice entries={damaged} studioDir={studioDir} />
      <div className="stagezone seam">
        <p className="voice">Could not reach the studio. Your pieces are still on disk.</p>
        <button className="doorcard stamp" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}

/** FIRST LANDING (locked): two massive door-cards, verbatim copy, nothing else competing. */
export function FirstLanding({
  css,
  damaged,
  studioDir,
  onDrop,
  onPickImport,
  onStartFresh,
  overlay,
}: DoorsBase & {
  onDrop: (evt: DragEvent<HTMLDivElement>) => void;
  onPickImport: () => void;
  onStartFresh: () => void;
  /** the import sheet, when a drop is being checked over */
  overlay: ReactNode;
}): JSX.Element {
  return (
    <div className="lib" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <style>{css}</style>
      <DamageNotice entries={damaged} studioDir={studioDir} />
      <div className="stagezone seam">
        <button className="doorcard primary stamp" onClick={onPickImport}>
          Drag and drop to import asset
        </button>
        <button className="doorcard stamp" onClick={onStartFresh}>
          Click here to start fresh
        </button>
      </div>
      <p className="voice">Every pack starts with a first card.</p>
      {overlay}
    </div>
  );
}
