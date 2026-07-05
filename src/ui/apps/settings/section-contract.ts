/**
 * The settings-section contract - Settings is built from DROP-IN SECTIONS (Chi, 2026-07-06:
 * "expose all configurables in reasonable tabs, hyper modular"). A section is one file in
 * sections/ default-exporting a SettingsSection; sections/registry.ts is the one stated seam
 * (one import line per section). Every control is CALL AND RESPONSE: read the current value from
 * ctx.prefs, write on change, and the shell applies it live (theme/accent repaint immediately).
 */
import type { AppContext } from "../../app-contract";

export interface SettingsSection {
  /** file/section id ("appearance") */
  id: string;
  /** the tab label ("Appearance") */
  label: string;
  /** tab ordering */
  order: number;
  /** render the section's controls into host; re-run after any change the section makes */
  render(ctx: AppContext, host: HTMLElement): void | Promise<void>;
}

/** tiny DOM helper shared by sections */
export const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** A titled control row: label + hint on the left, the control on the right. */
export function row(label: string, hint: string, control: HTMLElement): HTMLElement {
  const wrap = h("div", "set-row");
  const tx = h("div", "set-tx");
  tx.append(h("div", "set-label", label), h("div", "set-hint", hint));
  wrap.append(tx, control);
  return wrap;
}

/** A house segmented control bound call-and-response to a settings value. */
export function segControl(
  options: { value: string; label: string }[],
  current: string,
  onPick: (value: string) => void,
): HTMLElement {
  const seg = h("div", "set-seg");
  for (const opt of options) {
    const b = h("button", opt.value === current ? "on" : undefined, opt.label);
    b.addEventListener("click", () => onPick(opt.value));
    seg.append(b);
  }
  return seg;
}
