/**
 * Focus mode - the reusable editor fullscreen. Any editing surface mounts one toggle; clicking it
 * stamps `focus-editor` on <body>, and the SHELL's own css hides the chrome (dock, top strip, tab
 * strip) so the pane takes the whole window. Esc always exits. Session-scoped by design: focus is
 * a gesture, not a setting, so it is never persisted and a relaunch always restores the chrome
 * (the safe default for anyone who "lost" their UI).
 */

const FOCUS_CLASS = "focus-editor";

const EXPAND_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>';
const SHRINK_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6"/></svg>';

const CSS = `
.focus-btn{display:flex;align-items:center;justify-content:center;width:1.6rem;height:1.6rem;flex:none;
  background:transparent;border:2px solid #4a4556;color:#8f8a9e;cursor:pointer;padding:0}
.focus-btn:hover{color:#e7e3da;border-color:#8f8a9e}
`;

const CSS_MARK = "data-vaude-focus-css";
function injectCss(): void {
  if (document.head.querySelector(`style[${CSS_MARK}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(CSS_MARK, "");
  style.textContent = CSS;
  document.head.append(style);
}

export const isFocused = (): boolean => document.body.classList.contains(FOCUS_CLASS);

export function exitFocus(): void {
  document.body.classList.remove(FOCUS_CLASS);
}

/**
 * Create the focus toggle. Mount `root` wherever the surface wants it (a crumb bar, a toolbar);
 * call `dispose` on unmount - it drops the Esc listener AND exits focus, so no surface can leave
 * the shell chrome hidden behind it.
 */
export function focusToggle(): { root: HTMLElement; dispose(): void } {
  injectCss();
  const btn = document.createElement("button");
  btn.className = "focus-btn";

  // static first-party icon constants parsed into live nodes (no innerHTML, house rule)
  const icon = (markup: string): Node =>
    document.importNode(new DOMParser().parseFromString(markup, "image/svg+xml").documentElement, true);
  const expandIcon = icon(EXPAND_SVG);
  const shrinkIcon = icon(SHRINK_SVG);

  const sync = (): void => {
    const on = isFocused();
    btn.replaceChildren(on ? shrinkIcon : expandIcon);
    btn.title = on ? "Exit focus (Esc)" : "Focus: hide the chrome, fill the window";
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-pressed", String(on));
  };

  btn.addEventListener("click", () => {
    document.body.classList.toggle(FOCUS_CLASS);
    sync();
  });
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && isFocused()) {
      exitFocus();
      sync();
    }
  };
  window.addEventListener("keydown", onKey);
  sync();

  return {
    root: btn,
    dispose(): void {
      window.removeEventListener("keydown", onKey);
      exitFocus();
    },
  };
}
