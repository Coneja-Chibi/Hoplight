/**
 * The shell context-menu system (ported from _shared/context-menu.ts): target registry,
 * per-type providers, and the ref-callback hook. Split from store.ts (one concept per file);
 * store.ts re-exports the surface so existing imports keep the one door.
 */
import { useRef } from "react";
import type { RefCallback } from "react";


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

export interface ContextMenus {
  /** mark an element as a right-click target; the deepest attached element wins. Returns a detach
   * function (CONTRACT V2) - the shell's own imperative attaches (the document-level fallback)
   * call it on their own cleanup path. */
  attach(el: HTMLElement, factory: () => MenuTarget): () => void;
  /** contribute items for a target type; returns an unregister (call it in the app's cleanup) */
  register(type: string, provider: MenuProvider): () => void;
  /** the ref-callback hook form, ON the ctx so apps never import shell modules (a per-bundle copy
   * of this store would be a second menu universe; the ctx is the one door - gate-enforced) */
  useContextMenu(factory: () => MenuTarget): RefCallback<HTMLElement>;
}

export interface OpenMenu {
  x: number;
  y: number;
  target: MenuTarget;
  sections: MenuItem[][];
}

const menuTargets = new WeakMap<HTMLElement, () => MenuTarget>();
const menuProviders = new Map<string, Set<MenuProvider>>();

/** Walk up from `start`; the deepest attached element wins. Exported so the shell's one document
 * `contextmenu` listener (Menu.tsx) can decide whether to preventDefault BEFORE touching the store. */
export function findMenuTarget(start: EventTarget | null): MenuTarget | null {
  for (let el = start as HTMLElement | null; el; el = el.parentElement) {
    const factory = menuTargets.get(el);
    if (factory) return factory();
  }
  return null;
}

/** Collect every provider's items for a target's type; empty sections = deny by absence. */
export function menuSectionsFor(target: MenuTarget): MenuItem[][] {
  const sections: MenuItem[][] = [];
  for (const provider of menuProviders.get(target.type) ?? []) {
    const items = provider(target);
    if (items && items.length > 0) sections.push(items);
  }
  return sections;
}

/** The one menus object handed to every app via ctx.menus and used by the shell's own targets. */
export const menus: ContextMenus = {
  attach(el, factory) {
    menuTargets.set(el, factory);
    return () => menuTargets.delete(el);
  },
  register(type, provider) {
    const set = menuProviders.get(type) ?? new Set();
    set.add(provider);
    menuProviders.set(type, set);
    return () => set.delete(provider);
  },
  useContextMenu(factory) {
    return useContextMenu(factory);
  },
};

/** CONTRACT V2's ref-callback form of `menus.attach`: attaches on mount, detaches on unmount, via
 * React 19's ref-cleanup-function return (no separate effect needed). One stable identity per
 * component instance so re-renders never thrash the WeakMap registration. */
export function useContextMenu(factory: () => MenuTarget): RefCallback<HTMLElement> {
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  const cbRef = useRef<RefCallback<HTMLElement> | null>(null);
  if (!cbRef.current) {
    cbRef.current = (el) => {
      if (!el) return;
      return menus.attach(el, () => factoryRef.current());
    };
  }
  return cbRef.current;
}
