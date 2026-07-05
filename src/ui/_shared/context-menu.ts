/**
 * The context-menu SHELL - one right-click system for the whole app: consistent everywhere,
 * different target types get different menus, trivially extensible. Hyper-modular by
 * registration, deny-by-absence:
 *
 * - a surface marks an element as a TARGET: attach(el, () => ({ type: "entity", ... }))
 * - a feature CONTRIBUTES items for a target type: register("entity", (target) => items)
 *   (any number of providers per type; sections separate automatically; empty = no contribution)
 * - the shell owns ONE document listener + ONE renderer (house stamp styling, keyboard + click-away
 *   close, viewport clamped). Nothing central lists menus: adding one = one register() call.
 *
 * Targets nest: the deepest attached element wins. A document-level "shell" target is the
 * always-there fallback so EVERY page answers a right-click.
 */

export interface MenuTarget {
  /** open string ("entity", "app", "shell", ...); drop-in features may claim new types */
  type: string;
  /** the header line the menu shows ("Adrian", "The Library") */
  label: string;
  /** whatever the providers need (the entity summary, the manifest, ...) */
  data?: unknown;
}

export interface MenuItem {
  label: string;
  /** pick handler; the menu closes itself first */
  onPick(): void;
  disabled?: boolean;
  /** destructive styling (rose text) */
  danger?: boolean;
}

/** items for a target, or null/[] to contribute nothing (deny by absence) */
export type MenuProvider = (target: MenuTarget) => MenuItem[] | null;

const CSS = `
.vmenu{position:fixed;z-index:200;min-width:11rem;max-width:16rem;background:var(--face);
  border:3px solid var(--edge);box-shadow:5px 5px 0 0 var(--edge);padding:.25rem;
  font-family:var(--font-big)}
.vmenu .hd{font-family:var(--font-mono);font-size:.625rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--text-dim);padding:.4rem .6rem .35rem;border-bottom:2px solid var(--seam);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vmenu .it{display:block;width:100%;text-align:left;font:inherit;font-weight:700;font-size:.8125rem;
  color:var(--text);background:none;border:none;cursor:pointer;padding:.45rem .6rem}
.vmenu .it:hover,.vmenu .it:focus-visible{background:var(--stamp-bg);color:var(--stamp-fg);outline:none}
.vmenu .it[disabled]{color:var(--text-faint);cursor:default}
.vmenu .it[disabled]:hover{background:none;color:var(--text-faint)}
.vmenu .it.danger{color:var(--rose)}
.vmenu .it.danger:hover{background:var(--rose);color:#fff}
.vmenu .sep{height:2px;background:var(--seam);margin:.25rem .35rem;opacity:.7}
`;

type TargetFactory = () => MenuTarget;

export interface ContextMenus {
  /** mark an element as a right-click target; the deepest attached element wins */
  attach(el: HTMLElement, factory: TargetFactory): void;
  /** contribute items for a target type; returns an unregister (call it in app cleanup) */
  register(type: string, provider: MenuProvider): () => void;
}

/** Create THE menu system (the shell calls this once and hands it to every app via ctx). */
export function createContextMenus(): ContextMenus {
  const targets = new WeakMap<HTMLElement, TargetFactory>();
  const providers = new Map<string, Set<MenuProvider>>();
  let open: HTMLElement | null = null;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);

  const close = (): void => {
    open?.remove();
    open = null;
  };

  function findTarget(start: EventTarget | null): MenuTarget | null {
    for (let el = start as HTMLElement | null; el; el = el.parentElement) {
      const factory = targets.get(el);
      if (factory) return factory();
    }
    return null;
  }

  function itemsFor(target: MenuTarget): MenuItem[][] {
    const sections: MenuItem[][] = [];
    for (const provider of providers.get(target.type) ?? []) {
      const items = provider(target);
      if (items && items.length > 0) sections.push(items);
    }
    return sections;
  }

  function show(x: number, y: number, target: MenuTarget, sections: MenuItem[][]): void {
    close();
    const menu = document.createElement("div");
    menu.className = "vmenu";
    menu.setAttribute("role", "menu");
    const hd = document.createElement("div");
    hd.className = "hd";
    hd.textContent = target.label;
    menu.append(hd);
    sections.forEach((section, i) => {
      if (i > 0) {
        const sep = document.createElement("div");
        sep.className = "sep";
        menu.append(sep);
      }
      for (const item of section) {
        const btn = document.createElement("button");
        btn.className = `it${item.danger ? " danger" : ""}`;
        btn.textContent = item.label;
        btn.setAttribute("role", "menuitem");
        if (item.disabled) btn.setAttribute("disabled", "true");
        else
          btn.addEventListener("click", () => {
            close();
            item.onPick();
          });
        menu.append(btn);
      }
    });
    document.body.append(menu);
    // clamp into the viewport (menus never spill off an edge)
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(x, window.innerWidth - r.width - 8)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - r.height - 8)}px`;
    (menu.querySelector<HTMLButtonElement>(".it:not([disabled])") ?? menu).focus?.();
    open = menu;
  }

  document.addEventListener("contextmenu", (e) => {
    const target = findTarget(e.target);
    if (!target) return; // nothing attached anywhere up the tree: let the browser have it
    const sections = itemsFor(target);
    if (sections.length === 0) return; // no provider spoke: deny by absence, browser menu stands
    e.preventDefault();
    show(e.clientX, e.clientY, target, sections);
  });
  document.addEventListener("click", (e) => {
    if (open && !open.contains(e.target as Node)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  window.addEventListener("blur", close);
  window.addEventListener("resize", close);

  return {
    attach: (el, factory) => targets.set(el, factory),
    register: (type, provider) => {
      const set = providers.get(type) ?? new Set();
      set.add(provider);
      providers.set(type, set);
      return () => set.delete(provider);
    },
  };
}
