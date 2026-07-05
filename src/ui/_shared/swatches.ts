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
 */

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

/** A self-managing swatch row for plain hosts (settings, editor). Injects css, owns selection. */
export function swatchRow(opts: {
  palette: SwatchChoice[];
  /** currently applied hex, if any */
  value?: string;
  onPick(choice: SwatchChoice): void;
}): { root: HTMLElement; setValue(hex: string): void } {
  injectSwatchCss();
  const root = document.createElement("div");
  root.className = "swatches";
  const buttons = new Map<string, HTMLButtonElement>();

  const setValue = (hex: string): void => {
    for (const [h, b] of buttons) {
      b.classList.toggle("on", h === hex);
      b.setAttribute("aria-pressed", h === hex ? "true" : "false");
    }
  };

  for (const choice of opts.palette) {
    const btn = swatchButton(choice);
    buttons.set(choice.hex, btn);
    btn.addEventListener("click", () => {
      setValue(choice.hex);
      opts.onPick(choice);
    });
    root.append(btn);
  }
  if (opts.value) setValue(opts.value);
  return { root, setValue };
}
