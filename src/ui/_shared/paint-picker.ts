/**
 * The Paint picker - the reusable fill chooser. Composes the HSV color surface (color-picker.ts)
 * to edit a solid color OR each stop of a gradient. `allow` gates the modes, so the same widget
 * serves a solid-only accent and a full gradient fill from one implementation. Emits a Paint
 * through onChange on every edit; setValue pushes an external value in.
 */
import { clamp01, createColorPicker, horizontalDrag, injectColorPickerCss, normalizeHex } from "./color-picker";
import { gradientPaint, type GradientPaint, type GradientStop, type Paint, paintToCss, normalizePaint, solidPaint } from "./paint";

type Mode = "solid" | "gradient";

const PAINT_PICKER_CSS = `
.pp{display:flex;flex-direction:column;gap:.6rem;width:clamp(11rem,17rem,100%)}
.pp-modes{display:flex;border:3px solid var(--ink,#000);box-shadow:3px 3px 0 0 var(--ink,#000)}
.pp-modes button{flex:1;border:none;border-left:3px solid var(--ink,#000);background:var(--paper,#fff);
  font-family:var(--font-mono),monospace;font-size:.625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink,#111);padding:.42rem;cursor:pointer}
.pp-modes button:first-child{border-left:none}
.pp-modes button.on{background:var(--ink,#111);color:var(--paper,#fff)}
.pp-grad{display:flex;flex-direction:column;gap:.55rem}
.pp-bar{position:relative;width:100%;height:1.5rem;border:3px solid var(--ink,#000);
  box-shadow:3px 3px 0 0 var(--ink,#000);cursor:copy;touch-action:none;margin-top:.5rem}
.pp-stop{position:absolute;top:50%;width:14px;height:2rem;transform:translate(-50%,-50%);
  border:3px solid var(--ink,#000);cursor:grab;touch-action:none;box-shadow:0 0 0 2px var(--paper,#fff)}
.pp-stop.sel{box-shadow:0 0 0 2px var(--paper,#fff),0 0 0 5px var(--ink,#000);z-index:2}
.pp-row{display:flex;align-items:center;gap:.5rem}
.pp-out{width:1.7rem;height:1.7rem;flex:none;border:3px solid var(--ink,#000);box-shadow:2px 2px 0 0 var(--ink,#000)}
.pp-seg{display:flex;border:3px solid var(--ink,#000)}
.pp-seg button{border:none;border-left:3px solid var(--ink,#000);background:var(--paper,#fff);
  font-family:var(--font-mono),monospace;font-size:.5625rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink,#111);padding:.32rem .55rem;cursor:pointer}
.pp-seg button:first-child{border-left:none}
.pp-seg button.on{background:var(--ink,#111);color:var(--paper,#fff)}
.pp-rm{margin-left:auto;font-family:var(--font-mono),monospace;font-size:.5625rem;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;background:var(--paper,#fff);border:3px solid var(--ink,#000);color:var(--ink,#111);
  padding:.32rem .55rem;cursor:pointer}
.pp-rm:disabled{opacity:.4;cursor:not-allowed}
.pp-angle{display:flex;align-items:center;gap:.5rem}
.pp-angle input{flex:1;min-width:0}
.pp-deg{font-family:var(--font-mono),monospace;font-size:.625rem;font-weight:700;color:var(--ink,#111);min-width:2.6rem;text-align:right}
`;

const CSS_MARK = "data-vaude-paintpicker-css";
function injectCss(): void {
  if (document.head.querySelector(`style[${CSS_MARK}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(CSS_MARK, "");
  style.textContent = PAINT_PICKER_CSS;
  document.head.append(style);
}

const mk = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt((normalizeHex(hex) ?? "#000000").slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, "0");

/** Linear interpolation between two hex colors in RGB (good enough for a stop sampled off a bar). */
function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}

/** The color the gradient shows at fraction f (for a new stop dropped on the bar). */
function sampleAt(stops: GradientStop[], f: number): string {
  const sorted = [...stops].sort((s1, s2) => s1.at - s2.at);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (f <= first.at) return first.color;
  if (f >= last.at) return last.color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]!;
    const hi = sorted[i + 1]!;
    if (f >= lo.at && f <= hi.at) return lerpHex(lo.color, hi.color, (f - lo.at) / (hi.at - lo.at));
  }
  return last.color;
}

const clonePaint = (p: Paint): Paint =>
  p.kind === "solid" ? { ...p } : { ...p, stops: p.stops.map((s) => ({ ...s })) };

export function createPaintPicker(opts: {
  value?: Paint;
  /** which modes are offered (default both); a single mode hides the mode toggle */
  allow?: Mode[];
  onChange(paint: Paint): void;
}): { root: HTMLElement; setValue(paint: Paint): void } {
  injectColorPickerCss();
  injectCss();
  const allow: Mode[] = opts.allow?.length ? opts.allow : ["solid", "gradient"];

  let paint: Paint = normalizePaint(opts.value) ?? solidPaint();
  if (paint.kind === "gradient" && !allow.includes("gradient")) paint = solidPaint(paint.stops[0]!.color);
  if (paint.kind === "solid" && !allow.includes("solid")) paint = gradientPaint(paint.color);
  let sel = 0; // selected gradient stop index

  const root = mk("div", "pp");
  const modes = mk("div", "pp-modes");
  const body = mk("div");
  if (allow.length > 1) root.append(modes);
  root.append(body);

  const emit = (): void => opts.onChange(clonePaint(paint));

  const buildModes = (): void => {
    modes.replaceChildren();
    for (const m of ["solid", "gradient"] as const) {
      if (!allow.includes(m)) continue;
      const b = mk("button", paint.kind === m ? "on" : undefined, m);
      b.addEventListener("click", () => switchMode(m));
      modes.append(b);
    }
  };

  const switchMode = (m: Mode): void => {
    if (paint.kind === m) return;
    paint = m === "gradient" ? gradientPaint(paint.kind === "solid" ? paint.color : undefined) : solidPaint(paint.kind === "gradient" ? paint.stops[0]!.color : undefined);
    sel = 0;
    buildModes();
    buildBody();
    emit();
  };

  const buildBody = (): void => {
    body.replaceChildren();
    if (paint.kind === "solid") {
      const cp = createColorPicker({
        value: paint.color,
        onChange: (hex) => {
          paint = { kind: "solid", color: hex };
          emit();
        },
      });
      body.append(cp.root);
    } else {
      body.append(buildGradient(paint));
    }
  };

  function buildGradient(g: GradientPaint): HTMLElement {
    const wrap = mk("div", "pp-grad");
    const bar = mk("div", "pp-bar");
    const out = mk("div", "pp-out"); // true output preview (shows radial actually curving)

    const paintBar = (): void => {
      const stops = [...g.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${Math.round(s.at * 100)}%`);
      bar.style.background = `linear-gradient(90deg, ${stops.join(", ")})`; // editing track is always flat
      out.style.background = paintToCss(g);
    };

    const stopColor = createColorPicker({
      value: g.stops[sel]!.color,
      onChange: (hex) => {
        g.stops[sel]!.color = hex;
        renderHandles();
        paintBar();
        emit();
      },
    });

    const select = (i: number): void => {
      sel = i;
      stopColor.setValue(g.stops[sel]!.color);
      renderHandles();
    };

    function renderHandles(): void {
      for (const old of [...bar.querySelectorAll(".pp-stop")]) old.remove();
      g.stops.forEach((s, i) => {
        const handle = mk("span", `pp-stop${i === sel ? " sel" : ""}`);
        handle.style.left = `${s.at * 100}%`;
        handle.style.background = s.color;
        handle.addEventListener("pointerdown", (e) => {
          e.stopPropagation(); // don't let the bar add a new stop under the handle
          select(i);
        });
        horizontalDrag(
          handle,
          (f) => {
            g.stops[i]!.at = f;
            handle.style.left = `${f * 100}%`;
            paintBar();
            emit();
          },
          bar,
          false, // select on pointerdown; only move once the pointer actually travels
        );
        bar.append(handle);
      });
      rm.disabled = g.stops.length <= 2;
    }

    // click bare track -> add a stop sampled at that position
    bar.addEventListener("pointerdown", (e) => {
      if (e.target !== bar) return;
      const r = bar.getBoundingClientRect();
      const f = clamp01((e.clientX - r.left) / r.width);
      g.stops.push({ color: sampleAt(g.stops, f), at: f });
      select(g.stops.length - 1);
      paintBar();
      emit();
    });

    // type + remove row
    const typeRow = mk("div", "pp-row");
    const seg = mk("div", "pp-seg");
    const angleRow = mk("div", "pp-angle");
    for (const t of ["linear", "radial"] as const) {
      const b = mk("button", g.type === t ? "on" : undefined, t);
      b.addEventListener("click", () => {
        g.type = t;
        for (const other of [...seg.children]) other.classList.toggle("on", other.textContent === t);
        angleRow.style.display = t === "linear" ? "" : "none";
        paintBar();
        emit();
      });
      seg.append(b);
    }
    const rm = mk("button", "pp-rm", "remove") as HTMLButtonElement;
    rm.addEventListener("click", () => {
      if (g.stops.length <= 2) return;
      g.stops.splice(sel, 1);
      select(Math.min(sel, g.stops.length - 1));
      paintBar();
      emit();
    });
    typeRow.append(out, seg, rm);

    // angle row (linear only)
    const angle = mk("input") as HTMLInputElement;
    angle.type = "range";
    angle.min = "0";
    angle.max = "360";
    angle.value = String(Math.round(g.angle));
    const deg = mk("span", "pp-deg", `${Math.round(g.angle)}°`);
    angle.addEventListener("input", () => {
      g.angle = Number(angle.value);
      deg.textContent = `${g.angle}°`;
      paintBar();
      emit();
    });
    angleRow.append(mk("span", "pp-deg", "angle"), angle, deg);
    angleRow.style.display = g.type === "linear" ? "" : "none";

    wrap.append(bar, typeRow, angleRow, stopColor.root);
    renderHandles();
    paintBar();
    return wrap;
  }

  buildModes();
  buildBody();

  return {
    root,
    setValue(next) {
      const norm = normalizePaint(next);
      if (!norm) return;
      paint = norm;
      if (paint.kind === "gradient" && !allow.includes("gradient")) paint = solidPaint(paint.stops[0]!.color);
      if (paint.kind === "solid" && !allow.includes("solid")) paint = gradientPaint(paint.color);
      sel = 0;
      buildModes();
      buildBody();
    },
  };
}
