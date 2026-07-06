/**
 * StatusBar - the mono status footer (transcribed 1:1 from src/ui/index.html's #status markup
 * and CSS). Segments render only real state: the active app + its accent dot, the theme label,
 * the studio's piece count (or the empty-shelves line), and an optional status note.
 */
import type { CSSProperties, JSX } from "react";
import { useShellStore } from "./store";

export function StatusBar(): JSX.Element {
  const manifests = useShellStore((s) => s.manifests);
  const activeAppId = useShellStore((s) => s.activeAppId);
  const theme = useShellStore((s) => s.theme);
  const studioCount = useShellStore((s) => s.studioCount);
  const statusNote = useShellStore((s) => s.statusNote);

  const active = manifests.find((m) => m.id === activeAppId);
  const appLabel = active ? active.title.replace(/^The /, "") : "";
  const studioLabel = studioCount === 0 ? "0 · your shelves are empty" : String(studioCount);

  return (
    <footer id="status">
      <span className="seg">
        <span className="appdot" style={active ? ({ "--adot": active.accent } as CSSProperties) : undefined} />
        <span className="k">app</span>
        <span className="b">{appLabel}</span>
      </span>
      <span className="sep">·</span>
      <span className="seg">
        <span className="k">theme</span>
        <span className="b">{theme === "paper" ? "light" : "dark"}</span>
      </span>
      <span className="sep">·</span>
      <span className="seg trim">
        <span className="k">pieces</span>
        <span className="b">{studioLabel}</span>
      </span>
      <span className="seg trim">{statusNote && (<><span className="sep">·</span><span className="k">{statusNote}</span></>)}</span>
      <span className="spacer" />
      <span className="vaude">
        $ vaude<i>.</i>
      </span>
    </footer>
  );
}
