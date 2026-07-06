/**
 * TabStrip - the Workbench's open-piece tabs (transcribed 1:1 from src/ui/index.html's #tabstrip
 * markup and CSS). Clicking a tab focuses its editor; the close glyph removes it without
 * navigating; "+" walks to the first-landing app (the shelves) to open another.
 */
import type { CSSProperties, JSX, MouseEvent } from "react";
import type { StudioEntitySummary } from "../app-contract";
import { deckMeta } from "../_shared/decks";
import { keyOf } from "./store-core";
import { useContextMenu, useShellStore } from "./store";

function Tab({ piece, active }: { piece: StudioEntitySummary; active: boolean }): JSX.Element {
  const focusPiece = useShellStore((s) => s.focusPiece);
  const removePiece = useShellStore((s) => s.removePiece);
  const menuRef = useContextMenu(() => ({ type: "entity", label: piece.name, data: piece }));

  const onClose = (e: MouseEvent): void => {
    e.stopPropagation();
    removePiece(piece.id, piece.kind);
  };

  return (
    <button
      ref={menuRef}
      className={`tab${active ? " active" : ""}`}
      style={piece.accent ? ({ "--a": piece.accent } as CSSProperties) : undefined}
      onClick={() => focusPiece(piece.id, piece.kind)}
    >
      <span className="pip" />
      {piece.name}
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
  const manifests = useShellStore((s) => s.manifests);
  const mountApp = useShellStore((s) => s.mountApp);

  const openAnother = (): void => {
    const lib = manifests.find((m) => m.firstRunLanding && !m.comingSoon);
    if (lib) mountApp(lib.id);
  };

  return (
    <nav id="tabstrip" className={openPieces.length > 0 ? "hastabs" : undefined} aria-label="Open pieces">
      {openPieces.map((p) => (
        <Tab key={keyOf(p.id, p.kind)} piece={p} active={keyOf(p.id, p.kind) === activeKey} />
      ))}
      <button id="tabadd" title="Open another" onClick={openAnother}>
        +
      </button>
      <span className="tabfill" />
    </nav>
  );
}
