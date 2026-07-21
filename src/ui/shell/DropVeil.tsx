/**
 * DropVeil - app-wide file-drop feedback. Dragging files anywhere over the window dims the studio
 * behind a "Drop to import" plate; dropping routes the files through the import signal (Library
 * mounts, receipts open) from ANY room. Capture-phase with stopPropagation so this is the one
 * drop path - app-local drop handlers never double-import. Internal drags (TOC reorder, folder
 * re-parenting) carry no Files type and never trigger it.
 */
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { requestImport } from "../_shared/import-signal";
import { useShellStore } from "./store";

const hasFiles = (e: DragEvent): boolean =>
  !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

export function DropVeil(): JSX.Element | null {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const enter = (e: DragEvent): void => {
      if (!hasFiles(e)) return;
      depth.current++;
      setActive(true);
    };
    const over = (e: DragEvent): void => {
      if (hasFiles(e)) e.preventDefault(); // required, or the browser navigates on drop
    };
    const leave = (e: DragEvent): void => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const drop = (e: DragEvent): void => {
      depth.current = 0;
      setActive(false);
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      const state = useShellStore.getState();
      const shelves = state.firstLandingApp();
      if (shelves) state.mountApp(shelves.id);
      requestImport(files);
    };
    window.addEventListener("dragenter", enter, true);
    window.addEventListener("dragover", over, true);
    window.addEventListener("dragleave", leave, true);
    window.addEventListener("drop", drop, true);
    return () => {
      window.removeEventListener("dragenter", enter, true);
      window.removeEventListener("dragover", over, true);
      window.removeEventListener("dragleave", leave, true);
      window.removeEventListener("drop", drop, true);
    };
  }, []);

  if (!active) return null;
  return (
    <div id="dropveil" aria-hidden="true">
      <div className="veilbox">Drop to import</div>
    </div>
  );
}
