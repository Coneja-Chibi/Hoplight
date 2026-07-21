/**
 * DropVeil - app-wide file-drop feedback. Dragging files anywhere over the window dims the studio
 * behind a "Drop to import" plate; dropping routes the files through the import signal (Library
 * mounts, receipts open) from ANY room. Capture-phase with stopPropagation so this is the one
 * drop path - app-local drop handlers never double-import. Internal drags (TOC reorder, folder
 * re-parenting) carry no Files type and never trigger it.
 *
 * Folder drops walk the directory tree (webkitGetAsEntry): dropping an entire SillyTavern backups
 * folder hands every file inside to the import triage, which sorts eatable from not. dataTransfer
 * entries are only readable synchronously inside the event, so they are collected before any await.
 */
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { requestImport } from "../_shared/import-signal";
import { useShellStore } from "./store";

const hasFiles = (e: DragEvent): boolean =>
  !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

/** Hard ceiling on a folder walk; a runaway tree stops here instead of eating the tab. */
const DROP_WALK_CAP = 8000;

const fileOf = (entry: FileSystemFileEntry): Promise<File | null> =>
  new Promise((resolve) => entry.file(resolve, () => resolve(null)));

/** One readEntries batch is capped (Chromium: 100); drain until an empty batch comes back. */
const drainDir = async (dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
  const reader = dir.createReader();
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) =>
      reader.readEntries(resolve, () => resolve([])),
    );
    if (batch.length === 0) return all;
    all.push(...batch);
  }
};

async function collectFiles(entries: FileSystemEntry[], out: File[]): Promise<void> {
  const queue = [...entries];
  while (queue.length > 0 && out.length < DROP_WALK_CAP) {
    const entry = queue.shift()!;
    if (entry.isFile) {
      const f = await fileOf(entry as FileSystemFileEntry);
      if (f) out.push(f);
    } else if (entry.isDirectory) {
      queue.push(...(await drainDir(entry as FileSystemDirectoryEntry)));
    }
  }
}

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
      // entries must be pulled from dataTransfer NOW; the list is dead after this handler yields
      const entries = Array.from(e.dataTransfer?.items ?? [])
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null);
      const flat = Array.from(e.dataTransfer?.files ?? []);
      void (async () => {
        let files = flat;
        if (entries.length > 0) {
          const walked: File[] = [];
          await collectFiles(entries, walked);
          if (walked.length >= DROP_WALK_CAP) {
            console.warn(`drop: stopped the folder walk at ${DROP_WALK_CAP} files`);
          }
          if (walked.length > 0) files = walked;
        }
        if (files.length === 0) return;
        const state = useShellStore.getState();
        const shelves = state.firstLandingApp();
        if (shelves) state.mountApp(shelves.id);
        requestImport(files);
      })();
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
