/**
 * The house color picker - a reusable HSV surface. Presets stay the fast path (HOUSE_PALETTE
 * swatches); this is the custom door. Consumers: the shared swatchRow's `custom` tile, the setup
 * accent step, and the editor's per-entity accent. On-brand by construction (no OS color dialog):
 * a saturation/value square, a hue strip, and a hex field, all in the neobrutalist stamp.
 *
 * Functional core, imperative shell: the color math (normalizeHex/hexToHsv/hsvToHex) is pure and
 * unit-tested; createColorPicker is the thin DOM around it.
 */

export interface Hsv {
  /** hue 0-360 */
  h: number;
  /** saturation 0-1 */
  s: number;
  /** value 0-1 */
  v: number;
}

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Coerce user hex into "#rrggbb" lowercase, or null when it is not a color (fail closed). */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  return /^[0-9a-f]{6}$/.test(full) ? `#${full}` : null;
}

/** Hex -> HSV. Tolerant: an unparseable value reads as black (never throws). */
export function hexToHsv(hex: string): Hsv {
  const norm = normalizeHex(hex) ?? "#000000";
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** HSV -> "#rrggbb". Clamps every axis; the inverse of hexToHsv within rounding. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const val = clamp01(v);
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to = (n: number): string =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export const COLOR_PICKER_CSS = `
.cp{display:flex;flex-direction:column;gap:.55rem;width:clamp(11rem,17rem,100%)}
.cp-sv{position:relative;width:100%;aspect-ratio:3/2;border:3px solid var(--ink,#000);
  box-shadow:4px 4px 0 0 var(--ink,#000);cursor:crosshair;touch-action:none}
.cp-hue{position:relative;width:100%;height:1rem;border:3px solid var(--ink,#000);
  box-shadow:3px 3px 0 0 var(--ink,#000);cursor:ew-resize;touch-action:none;
  background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}
.cp-thumb{position:absolute;width:14px;height:14px;border:3px solid #fff;outline:2px solid #000;
  border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 0 1px #000}
.cp-hue .cp-thumb{top:50%}
.cp-foot{display:flex;align-items:center;gap:.5rem}
.cp-chip{width:1.6rem;height:1.6rem;flex:none;border:3px solid var(--ink,#000);box-shadow:2px 2px 0 0 var(--ink,#000)}
.cp-hex{flex:1;min-width:0;font-family:var(--font-mono);font-size:.8rem;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink,#111);background:var(--paper,#fff);border:3px solid var(--ink,#000);
  padding:.4rem .55rem}
.cp-hex:focus{outline:none;box-shadow:3px 3px 0 0 var(--ink,#000)}
@media(prefers-reduced-motion:reduce){.cp-sv,.cp-hue{transition:none}}
`;

const CSS_MARK = "data-vaude-colorpicker-css";

/** Drop the picker css into <head> once (idempotent), for hosts without their own style pipe. */
export function injectColorPickerCss(): void {
  if (document.head.querySelector(`style[${CSS_MARK}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(CSS_MARK, "");
  style.textContent = COLOR_PICKER_CSS;
  document.head.append(style);
}

/**
 * Run `onMove` for a pointerdown and every drag until release, with the surface's live rect.
 * `fireOnDown` false skips the initial pointerdown fire, so a draggable handle can be selected
 * without snapping to the click point - it only moves once the pointer actually travels.
 */
function draggable(
  surface: HTMLElement,
  onMove: (rect: DOMRect, x: number, y: number) => void,
  fireOnDown = true,
): void {
  const fire = (ev: PointerEvent): void => onMove(surface.getBoundingClientRect(), ev.clientX, ev.clientY);
  surface.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    surface.setPointerCapture(ev.pointerId);
    if (fireOnDown) fire(ev);
    const move = (e: PointerEvent): void => fire(e);
    const up = (): void => {
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", up);
    };
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerup", up);
  });
}

/**
 * Drag along a track's width, reporting a clamped 0-1 fraction (hue strip, gradient stop rail).
 * `ref` is the element the fraction is measured against - pass the track when the draggable thing
 * is a small handle sitting on a wider bar.
 */
export function horizontalDrag(
  surface: HTMLElement,
  onFraction: (fraction: number) => void,
  ref: HTMLElement = surface,
  fireOnDown = true,
): void {
  draggable(
    surface,
    (_rect, x) => {
      const r = ref.getBoundingClientRect();
      onFraction(clamp01((x - r.left) / r.width));
    },
    fireOnDown,
  );
}

const mk = (tag: string, cls?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};

/**
 * A self-contained HSV picker. Emits a normalized "#rrggbb" through onChange on every edit (drag or
 * hex entry). setValue lets the host push an external color in (e.g. a preset was clicked instead).
 */
export function createColorPicker(opts: {
  value?: string;
  onChange(hex: string): void;
}): { root: HTMLElement; setValue(hex: string): void } {
  injectColorPickerCss();
  let hsv: Hsv = hexToHsv(opts.value ?? "#e11d48");

  const root = mk("div", "cp");
  const sv = mk("div", "cp-sv");
  const svThumb = mk("div", "cp-thumb");
  sv.append(svThumb);
  const hue = mk("div", "cp-hue");
  const hueThumb = mk("div", "cp-thumb");
  hue.append(hueThumb);
  const foot = mk("div", "cp-foot");
  const chip = mk("div", "cp-chip");
  const hex = mk("input", "cp-hex") as HTMLInputElement;
  hex.spellcheck = false;
  hex.setAttribute("aria-label", "Hex color");
  foot.append(chip, hex);
  root.append(sv, hue, foot);

  // paint the current state onto the surfaces; `fromHex` keeps the hex field's own caret when typing
  const paint = (fromHex = false): void => {
    const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
    sv.style.background = `linear-gradient(to top,#000,rgba(0,0,0,0)),linear-gradient(to right,#fff,${pure})`;
    svThumb.style.left = `${hsv.s * 100}%`;
    svThumb.style.top = `${(1 - hsv.v) * 100}%`;
    hueThumb.style.left = `${(hsv.h / 360) * 100}%`;
    const current = hsvToHex(hsv);
    chip.style.background = current;
    if (!fromHex) hex.value = current;
  };

  const emit = (fromHex = false): void => {
    paint(fromHex);
    opts.onChange(hsvToHex(hsv));
  };

  draggable(sv, (rect, x, y) => {
    hsv = { ...hsv, s: clamp01((x - rect.left) / rect.width), v: clamp01(1 - (y - rect.top) / rect.height) };
    emit();
  });
  horizontalDrag(hue, (f) => {
    hsv = { ...hsv, h: f * 360 };
    emit();
  });
  hex.addEventListener("input", () => {
    const norm = normalizeHex(hex.value);
    if (!norm) return; // tolerate mid-typing garbage; commit only a real color
    hsv = hexToHsv(norm);
    emit(true);
  });

  paint();
  return {
    root,
    setValue(next) {
      hsv = hexToHsv(next);
      paint();
    },
  };
}
