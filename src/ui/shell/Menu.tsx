/**
 * Menu - the one right-click renderer for the whole app (transcribed 1:1 from
 * src/ui/_shared/context-menu.ts's `show`/document-listener behavior, store-driven per CONTRACT
 * V2). Mounted once at the shell root. Owns the document-level listeners: `contextmenu` resolves
 * the target and shows the menu (deny by absence at every step), `click` away and `Escape` close
 * it, `blur`/`resize` close it too. The menu itself renders from `openMenu` alone - no imperative
 * DOM building, unlike the vanilla version this replaces.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { findMenuTarget, menuSectionsFor, useShellStore } from "./store";

export function Menu(): JSX.Element | null {
  const openMenu = useShellStore((s) => s.openMenu);
  const showMenu = useShellStore((s) => s.showMenu);
  const closeMenu = useShellStore((s) => s.closeMenu);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent): void => {
      const target = findMenuTarget(e.target);
      if (!target) return; // nothing attached anywhere up the tree: let the browser have it
      const sections = menuSectionsFor(target);
      if (sections.length === 0) return; // no provider spoke: deny by absence, browser menu stands
      e.preventDefault();
      showMenu(e.clientX, e.clientY, target, sections);
    };
    const onClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [showMenu, closeMenu]);

  // clamp into the viewport once the menu has real dimensions (mirrors the vanilla getBoundingClientRect clamp)
  useLayoutEffect(() => {
    if (!openMenu || !menuRef.current) {
      setPos(null);
      return;
    }
    const r = menuRef.current.getBoundingClientRect();
    setPos({
      left: Math.min(openMenu.x, window.innerWidth - r.width - 8),
      top: Math.min(openMenu.y, window.innerHeight - r.height - 8),
    });
  }, [openMenu]);

  if (!openMenu) return null;

  return (
    <div
      ref={menuRef}
      className="vmenu"
      role="menu"
      style={pos ? { left: pos.left, top: pos.top } : { left: openMenu.x, top: openMenu.y, visibility: "hidden" }}
    >
      <div className="hd">{openMenu.target.label}</div>
      {openMenu.sections.map((section, i) => (
        <div key={i}>
          {i > 0 && <div className="sep" />}
          {section.map((item, j) => (
            <button
              key={j}
              className={`it${item.danger ? " danger" : ""}`}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                closeMenu();
                item.onPick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
