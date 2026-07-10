/**
 * TabStrip - the ONE chrome row above the canvas: open-piece tabs left, global actions right
 * (search, import, theme - absorbed from the deleted TopBar, whose other jobs duplicated the dock
 * and Settings; a second full-height row bought nothing). Clicking a tab focuses its editor; the
 * close glyph removes it; "+" walks to the shelves.
 */
import type { CSSProperties, JSX, MouseEvent } from "react";
import type { StudioEntitySummary } from "../app-contract";
import { deckMeta } from "../_shared/decks";
import { Stamp } from "../components/stamp";
import { keyOf } from "./store-core";
import { useContextMenu, useShellStore } from "./store";

function Tab({ piece, active, beside }: { piece: StudioEntitySummary; active: boolean; beside: boolean }): JSX.Element {
  const focusPiece = useShellStore((s) => s.focusPiece);
  const removePiece = useShellStore((s) => s.removePiece);
  const dirty = useShellStore((s) => s.dirtyPieces[keyOf(piece.id, piece.kind)] === true);
  const menuRef = useContextMenu(() => ({ type: "entity", label: piece.name, data: piece }));

  const onClose = (e: MouseEvent): void => {
    e.stopPropagation();
    removePiece(piece.id, piece.kind);
  };

  return (
    <button
      ref={menuRef}
      className={`tab${active ? " active" : ""}${beside ? " beside" : ""}`}
      style={piece.accent ? ({ "--a": piece.accent } as CSSProperties) : undefined}
      onClick={() => focusPiece(piece.id, piece.kind)}
    >
      <span className="pip" />
      {piece.name}
      {dirty && <span className="dirty" title="unsaved changes">&#9679;</span>}
      <span className="kind">{deckMeta(piece.kind).short}</span>
      <span className="close" onClick={onClose}>
        &times;
      </span>
    </button>
  );
}

export function TabStrip(): JSX.Element {
  const openPieces = useShellStore((s) => s.openPieces);
  const activeKey = useShellStore((s) => s.activeKey);
  const splitKey = useShellStore((s) => s.splitKey);
  const manifests = useShellStore((s) => s.manifests);
  const mountApp = useShellStore((s) => s.mountApp);
  const setStatus = useShellStore((s) => s.setStatus);
  const toggleTheme = useShellStore((s) => s.toggleTheme);

  const openAnother = (): void => {
    const lib = manifests.find((m) => m.firstRunLanding && !m.comingSoon);
    if (lib) mountApp(lib.id);
  };
  const goImport = (): void => {
    const shelves = manifests.find((m) => m.firstRunLanding && !m.comingSoon);
    if (shelves) mountApp(shelves.id);
    setStatus("drop files anywhere on the shelves");
  };

  return (
    <nav id="tabstrip" className={openPieces.length > 0 ? "hastabs" : undefined} aria-label="Open pieces">
      {openPieces.map((p) => (
        <Tab
          key={keyOf(p.id, p.kind)}
          piece={p}
          active={keyOf(p.id, p.kind) === activeKey}
          beside={keyOf(p.id, p.kind) === splitKey}
        />
      ))}
      <button id="tabadd" title="Open another" onClick={openAnother}>
        +
      </button>
      <span className="tabfill" />
      <label id="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input placeholder="Search your whole studio" aria-label="Search your whole studio" />
      </label>
      <span id="topact">
        <Stamp id="importBtn" onClick={goImport}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M4 20h16" />
          </svg>
          <span className="im-t">Import</span>
        </Stamp>
        <Stamp id="themeBtn" onClick={toggleTheme} title="Switch theme" aria-label="Switch theme">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
          </svg>
        </Stamp>
      </span>
    </nav>
  );
}
