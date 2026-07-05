/**
 * The house color-swatch component - shared UI extracted exactly once (same rule as formats'
 * _shared). Consumers today: the setup accent step; next: Settings (change-it-later) and the
 * editor's per-entity accent (DECISIONS #9). The swatch look is the locked vs-setup-hybrid stamp:
 * ink border, hard shadow, hover lifts, picked presses with an ink halo, mono label below.
 *
 * Two ways in:
 * - swatchButton(choice): one bare button, for hosts that own selection (the wizard's option loop
 *   toggles .on itself).
 * - swatchRow({...}): a self-managing row for plain hosts (settings/editor panels).
 * CSS ships as SWATCH_CSS for hosts that inject styles themselves (wizard steps), or
 * injectSwatchCss() for hosts that want it dropped into <head> once.
 *
 * swatchRow can also offer a `custom` tile (allowCustom) that opens the reusable Paint picker in
 * solid mode - the presets stay the fast path, custom is the door to any color.
 */
import { createPaintPicker } from "./paint-picker";
import { solidPaint } from "./paint";

export interface SwatchChoice {
  /** stable name ("rose") */
  id: string;
  /** label under the square (mono, lowercase by design) */
  label: string;
  /** the stored/applied hex */
  hex: string;
}

/** The authored house palette (locked vs-setup-hybrid). Entity accents may widen later. */
export const HOUSE_PALETTE: SwatchChoice[] = [
  { id: "rose", label: "rose", hex: "#e11d48" },
  { id: "amber", label: "amber", hex: "#f59e0b" },
  { id: "emerald", label: "emerald", hex: "#10b981" },
  { id: "violet", label: "violet", hex: "#8b5cf6" },
  { id: "blue", label: "blue", hex: "#3b82f6" },
];

export const SWATCH_CSS = `
.swatches{display:flex;gap:.9rem;flex-wrap:wrap;justify-content:flex-start;padding:.4rem 0 1.9rem}
.sw{width:clamp(3rem,8vw,3.5rem);aspect-ratio:1;border:3px solid var(--ink);cursor:pointer;
  position:relative;box-shadow:4px 4px 0 0 var(--ink);padding:0;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.sw:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 var(--ink)}
.sw:active,.sw.on{transform:translate(3px,3px);box-shadow:1px 1px 0 0 var(--ink)}
.sw.on::after{content:"";position:absolute;inset:-9px;border:3px solid var(--ink)}
.sw .lbl{position:absolute;left:0;right:0;bottom:-1.4rem;text-align:center;
  font-family:var(--font-mono);font-size:.625rem;letter-spacing:.08em;color:var(--muted)}
.swatchwrap{display:flex;flex-direction:column;gap:.5rem}
.sw.custom{background:conic-gradient(from 0deg,#e11d48,#f59e0b,#10b981,#3b82f6,#8b5cf6,#e11d48)}
.sw.custom.empty::before{content:"+";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-family:var(--font-big);font-weight:900;font-size:1.4rem;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.swpanel{display:none}
.swpanel.open{display:block;padding-top:.2rem}
@media(prefers-reduced-motion:reduce){.sw{transition:none}}
`;

const CSS_MARK = "data-vaude-swatch-css";

/** Drop the swatch css into <head> once (idempotent), for hosts without their own style pipe. */
export function injectSwatchCss(): void {
  if (document.head.querySelector(`style[${CSS_MARK}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(CSS_MARK, "");
  style.textContent = SWATCH_CSS;
  document.head.append(style);
}

/** One swatch button. No selection logic: the host toggles .on (wizard) or uses swatchRow. */
export function swatchButton(choice: SwatchChoice): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "sw";
  btn.style.background = choice.hex;
  btn.title = choice.label;
  const lbl = document.createElement("span");
  lbl.className = "lbl";
  lbl.textContent = choice.label;
  btn.append(lbl);
  return btn;
}

/** A self-managing swatch row for plain hosts (settings, editor). Injects css, owns selection.
 * With allowCustom, a final "custom" tile opens the reusable Paint picker (solid) for any color. */
export function swatchRow(opts: {
  palette: SwatchChoice[];
  /** currently applied hex, if any */
  value?: string;
  onPick(choice: SwatchChoice): void;
  /** offer a custom-color tile after the presets (opens the Paint picker in solid mode) */
  allowCustom?: boolean;
}): { root: HTMLElement; setValue(hex: string): void } {
  injectSwatchCss();
  const root = document.createElement("div");
  root.className = "swatchwrap";
  const row = document.createElement("div");
  row.className = "swatches";
  root.append(row);

  const buttons = new Map<string, HTMLButtonElement>();
  const eq = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
  const inPalette = (hex: string): boolean => opts.palette.some((c) => eq(c.hex, hex));
  let current = opts.value ?? opts.palette[0]?.hex ?? "#e11d48";

  let customBtn: HTMLButtonElement | null = null;

  const setValue = (hex: string): void => {
    current = hex;
    for (const [h, b] of buttons) {
      const on = eq(h, hex);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (customBtn) {
      const isCustom = !inPalette(hex);
      customBtn.classList.toggle("on", isCustom);
      customBtn.classList.toggle("empty", !isCustom);
      customBtn.style.background = isCustom ? hex : "";
    }
  };

  for (const choice of opts.palette) {
    const btn = swatchButton(choice);
    buttons.set(choice.hex, btn);
    btn.addEventListener("click", () => {
      setValue(choice.hex);
      opts.onPick(choice);
    });
    row.append(btn);
  }

  if (opts.allowCustom) {
    customBtn = document.createElement("button");
    customBtn.className = "sw custom empty";
    customBtn.title = "Custom color";
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = "custom";
    customBtn.append(lbl);
    row.append(customBtn);

    const panel = document.createElement("div");
    panel.className = "swpanel";
    root.append(panel);
    let picker: { root: HTMLElement; setValue(p: import("./paint").Paint): void } | null = null;

    customBtn.addEventListener("click", () => {
      if (!picker) {
        picker = createPaintPicker({
          value: solidPaint(current),
          allow: ["solid"],
          onChange: (p) => {
            if (p.kind !== "solid") return;
            setValue(p.color);
            opts.onPick({ id: "custom", label: "custom", hex: p.color });
          },
        });
        panel.append(picker.root);
      } else {
        picker.setValue(solidPaint(current));
      }
      panel.classList.toggle("open");
    });
  }

  setValue(current);
  return { root, setValue };
}
