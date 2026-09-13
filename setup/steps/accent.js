{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";s.textContent="/* src/ui/components/color-picker/styles.module.css */\n.cp_SWqr_A {\n  display: flex;\n  flex-direction: column;\n  gap: .55rem;\n  width: clamp(11rem, 17rem, 100%);\n}\n\n.sv_SWqr_A {\n  position: relative;\n  aspect-ratio: 3 / 2;\n  border: 3px solid var(--ink);\n  box-shadow: 4px 4px 0 0 var(--ink);\n  cursor: crosshair;\n  touch-action: none;\n  width: 100%;\n}\n\n.hue_SWqr_A {\n  position: relative;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n  cursor: ew-resize;\n  touch-action: none;\n  background: linear-gradient(to right, red, #ff0, #0f0, #0ff, #00f, #f0f, red);\n  width: 100%;\n  height: 1rem;\n}\n\n.thumb_SWqr_A {\n  position: absolute;\n  border: 3px solid var(--stage-white);\n  outline: 2px solid var(--stage-black);\n  pointer-events: none;\n  box-shadow: 0 0 0 1px var(--stage-black);\n  border-radius: 50%;\n  width: 14px;\n  height: 14px;\n  transform: translate(-50%, -50%);\n}\n\n.foot_SWqr_A {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.chip_SWqr_A {\n  border: 3px solid var(--ink);\n  box-shadow: 2px 2px 0 0 var(--ink);\n  flex: none;\n  width: 1.6rem;\n  height: 1.6rem;\n}\n\n.hex_SWqr_A {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--ink);\n  background: var(--paper);\n  border: 3px solid var(--ink);\n  flex: 1;\n  min-width: 0;\n  padding: .4rem .55rem;\n  font-size: .8rem;\n  font-weight: 700;\n}\n\n.hex_SWqr_A:focus {\n  outline: none;\n  box-shadow: 3px 3px 0 0 var(--ink);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .sv_SWqr_A, .hue_SWqr_A {\n    transition: none;\n  }\n}\n\n/* src/ui/components/paint-picker/styles.module.css */\n.pp_655Ssw {\n  display: flex;\n  flex-direction: column;\n  gap: .6rem;\n  width: clamp(11rem, 17rem, 100%);\n}\n\n.modes_655Ssw {\n  display: flex;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n}\n\n.modes_655Ssw button {\n  border: none;\n  border-left: 3px solid var(--ink);\n  background: var(--paper);\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--ink);\n  cursor: pointer;\n  flex: 1;\n  padding: .42rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.modes_655Ssw button:first-child {\n  border-left: none;\n}\n\n.modes_655Ssw button.on_655Ssw {\n  background: var(--ink);\n  color: var(--paper);\n}\n\n.grad_655Ssw {\n  display: flex;\n  flex-direction: column;\n  gap: .55rem;\n}\n\n.bar_655Ssw {\n  position: relative;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n  cursor: copy;\n  touch-action: none;\n  width: 100%;\n  height: 1.5rem;\n  margin-top: .5rem;\n}\n\n.stop_655Ssw {\n  position: absolute;\n  border: 3px solid var(--ink);\n  cursor: grab;\n  touch-action: none;\n  box-shadow: 0 0 0 2px var(--paper);\n  width: 14px;\n  height: 2rem;\n  top: 50%;\n  transform: translate(-50%, -50%);\n}\n\n.stop_655Ssw.sel_655Ssw {\n  box-shadow: 0 0 0 2px var(--paper), 0 0 0 5px var(--ink);\n  z-index: 2;\n}\n\n.row_655Ssw {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.out_655Ssw {\n  border: 3px solid var(--ink);\n  box-shadow: 2px 2px 0 0 var(--ink);\n  flex: none;\n  width: 1.7rem;\n  height: 1.7rem;\n}\n\n.seg_655Ssw {\n  display: flex;\n  border: 3px solid var(--ink);\n}\n\n.seg_655Ssw button {\n  border: none;\n  border-left: 3px solid var(--ink);\n  background: var(--paper);\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--ink);\n  cursor: pointer;\n  padding: .32rem .55rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.seg_655Ssw button:first-child {\n  border-left: none;\n}\n\n.seg_655Ssw button.on_655Ssw {\n  background: var(--ink);\n  color: var(--paper);\n}\n\n.rm_655Ssw {\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  background: var(--paper);\n  border: 3px solid var(--ink);\n  color: var(--ink);\n  cursor: pointer;\n  margin-left: auto;\n  padding: .32rem .55rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.rm_655Ssw:disabled {\n  opacity: .4;\n  cursor: not-allowed;\n}\n\n.angle_655Ssw {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.angle_655Ssw input {\n  flex: 1;\n  min-width: 0;\n}\n\n.deg_655Ssw {\n  font-family: var(--font-mono), monospace;\n  color: var(--ink);\n  text-align: right;\n  min-width: 2.6rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n/* src/ui/components/swatch-row/styles.module.css */\n.wrap_OmPbpg {\n  display: flex;\n  flex-direction: column;\n  gap: .5rem;\n}\n\n.row_OmPbpg {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: flex-start;\n  gap: .9rem;\n  padding: .4rem 0 1.9rem;\n}\n\n.sw_OmPbpg {\n  aspect-ratio: 1;\n  border: 3px solid var(--ink);\n  cursor: pointer;\n  position: relative;\n  font-family: var(--font-mono);\n  box-shadow: 4px 4px 0 0 var(--ink);\n  width: clamp(3rem, 8vw, 3.5rem);\n  padding: 0;\n  transition: transform .1s ease-out, box-shadow .1s ease-out;\n}\n\n.sw_OmPbpg:hover {\n  box-shadow: 6px 6px 0 0 var(--ink);\n  transform: translate(-2px, -2px);\n}\n\n.sw_OmPbpg:active, .sw_OmPbpg.on_OmPbpg {\n  box-shadow: 1px 1px 0 0 var(--ink);\n  transform: translate(3px, 3px);\n}\n\n.sw_OmPbpg.on_OmPbpg:after {\n  content: \"\";\n  position: absolute;\n  border: 3px solid var(--ink);\n  inset: -9px;\n}\n\n.sw_OmPbpg .lbl_OmPbpg {\n  position: absolute;\n  text-align: center;\n  font-family: var(--font-mono);\n  letter-spacing: .07em;\n  color: var(--text);\n  font-size: .66rem;\n  font-weight: 600;\n  bottom: -1.4rem;\n  left: 0;\n  right: 0;\n}\n\n.sw_OmPbpg.custom_OmPbpg {\n  background: conic-gradient(from 0deg, var(--rose), #f59e0b, #10b981, #3b82f6, #8b5cf6, var(--rose));\n}\n\n.sw_OmPbpg.custom_OmPbpg.empty_OmPbpg:before {\n  content: \"+\";\n  position: absolute;\n  display: flex;\n  font-family: var(--font-big);\n  color: var(--stage-white);\n  text-shadow: 0 1px 3px var(--shadow-ink);\n  justify-content: center;\n  align-items:  center;\n  font-size: 1.4rem;\n  font-weight: 900;\n  inset: 0;\n}\n\n.panel_OmPbpg {\n  padding-top: .2rem;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .sw_OmPbpg {\n    transition: none;\n  }\n}\n";document.head.append(s);}
// src/studio/settings-shape.ts
var SETTING_KEYS = {
  theme: "theme",
  firstDeck: "firstDeck",
  makes: "makes",
  publishTargets: "publishTargets",
  houseAccent: "houseAccent",
  homeApp: "homeApp",
  workbenchFollow: "workbench.follow",
  workbenchRecents: "workbench.recents",
  dockSlim: "shell.dockSlim",
  remoteAccessEnabled: "remoteAccessEnabled"
};

// src/ui/components/swatch-row/index.tsx
import { useState as useState3 } from "react";

// src/ui/components/paint-picker/index.tsx
import { useState as useState2 } from "react";

// src/ui/components/color-picker/index.tsx
import { useEffect, useRef, useState } from "react";

// src/ui/_shared/color-math.ts
var clamp01 = (n) => Math.min(1, Math.max(0, n));
function normalizeHex(input) {
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  return /^[0-9a-f]{6}$/.test(full) ? `#${full}` : null;
}
function hexToHsv(hex) {
  const norm = normalizeHex(hex) ?? "#000000";
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r)
      h = (g - b) / d % 6;
    else if (max === g)
      h = (b - r) / d + 2;
    else
      h = (r - g) / d + 4;
    h *= 60;
    if (h < 0)
      h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}
function hsvToHex({ h, s, v }) {
  const hue = (h % 360 + 360) % 360;
  const sat = clamp01(s);
  const val = clamp01(v);
  const c = val * sat;
  const x = c * (1 - Math.abs(hue / 60 % 2 - 1));
  const m = val - c;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const to = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function dragFraction(pos, origin, size) {
  return size === 0 ? 0 : clamp01((pos - origin) / size);
}

// src/ui/components/color-picker/styles.module.css
var styles_module_default = {
  cp: "cp_SWqr_A",
  sv: "sv_SWqr_A",
  hue: "hue_SWqr_A",
  thumb: "thumb_SWqr_A",
  foot: "foot_SWqr_A",
  chip: "chip_SWqr_A",
  hex: "hex_SWqr_A"
};

// src/ui/components/color-picker/index.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
function ColorPicker({ value, onChange }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value ?? "var(--rose)"));
  const [hexDraft, setHexDraft] = useState(() => hsvToHex(hsv));
  const hexFocused = useRef(false);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  useEffect(() => {
    const norm = normalizeHex(value ?? "");
    if (!norm || norm === hsvToHex(hsvRef.current))
      return;
    setHsv(hexToHsv(norm));
    if (!hexFocused.current)
      setHexDraft(norm);
  }, [value]);
  const emit = (next) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexDraft(hex);
    onChange(hex);
  };
  const dragSv = (rect, clientX, clientY) => {
    emit({
      ...hsv,
      s: dragFraction(clientX, rect.left, rect.width),
      v: 1 - dragFraction(clientY, rect.top, rect.height)
    });
  };
  const dragHue = (rect, clientX) => {
    emit({ ...hsv, h: dragFraction(clientX, rect.left, rect.width) * 360 });
  };
  const onSvPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragSv(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  };
  const onSvPointerMove = (e) => {
    if (e.buttons === 0)
      return;
    dragSv(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  };
  const onHuePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragHue(e.currentTarget.getBoundingClientRect(), e.clientX);
  };
  const onHuePointerMove = (e) => {
    if (e.buttons === 0)
      return;
    dragHue(e.currentTarget.getBoundingClientRect(), e.clientX);
  };
  const onHexChange = (e) => {
    setHexDraft(e.target.value);
    const norm = normalizeHex(e.target.value);
    if (!norm)
      return;
    setHsv(hexToHsv(norm));
    onChange(norm);
  };
  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);
  return /* @__PURE__ */ jsxDEV("div", {
    className: styles_module_default.cp,
    children: [
      /* @__PURE__ */ jsxDEV("div", {
        className: styles_module_default.sv,
        style: {
          background: `linear-gradient(to top,var(--stage-black),transparent),linear-gradient(to right,var(--stage-white),${pure})`
        },
        onPointerDown: onSvPointerDown,
        onPointerMove: onSvPointerMove,
        children: /* @__PURE__ */ jsxDEV("div", {
          className: styles_module_default.thumb,
          style: { left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        className: styles_module_default.hue,
        onPointerDown: onHuePointerDown,
        onPointerMove: onHuePointerMove,
        children: /* @__PURE__ */ jsxDEV("div", {
          className: styles_module_default.thumb,
          style: { left: `${hsv.h / 360 * 100}%`, top: "50%" }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        className: styles_module_default.foot,
        children: [
          /* @__PURE__ */ jsxDEV("div", {
            className: styles_module_default.chip,
            style: { background: current }
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("input", {
            className: styles_module_default.hex,
            spellCheck: false,
            "aria-label": "Hex color",
            value: hexDraft,
            onFocus: () => {
              hexFocused.current = true;
            },
            onBlur: () => {
              hexFocused.current = false;
              setHexDraft(current);
            },
            onChange: onHexChange
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/_shared/paint.ts
var solidPaint = (color = "#e11d48") => ({ kind: "solid", color });
var gradientPaint = (from = "#e11d48", to = "#f59e0b") => ({
  kind: "gradient",
  type: "linear",
  angle: 135,
  stops: [
    { color: from, at: 0 },
    { color: to, at: 1 }
  ]
});
var roundPct = (at) => `${Math.round(clamp01(at) * 1000) / 10}%`;
function paintToCss(p) {
  if (p.kind === "solid")
    return p.color;
  const stops = [...p.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${roundPct(s.at)}`);
  if (p.type === "radial")
    return `radial-gradient(circle, ${stops.join(", ")})`;
  return `linear-gradient(${Math.round(p.angle)}deg, ${stops.join(", ")})`;
}
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function parseStop(raw) {
  if (!isRecord(raw))
    return null;
  const color = typeof raw.color === "string" ? normalizeHex(raw.color) : null;
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? clamp01(raw.at) : null;
  return color && at !== null ? { color, at } : null;
}
function normalizePaint(raw) {
  if (!isRecord(raw))
    return null;
  if (raw.kind === "solid") {
    const color = typeof raw.color === "string" ? normalizeHex(raw.color) : null;
    return color ? { kind: "solid", color } : null;
  }
  if (raw.kind === "gradient") {
    const type = raw.type === "radial" ? "radial" : raw.type === "linear" ? "linear" : null;
    if (!type)
      return null;
    const angle = typeof raw.angle === "number" && Number.isFinite(raw.angle) ? raw.angle : 0;
    const stops = Array.isArray(raw.stops) ? raw.stops.map(parseStop).filter((s) => s !== null) : [];
    if (stops.length < 2)
      return null;
    return { kind: "gradient", type, angle: (angle % 360 + 360) % 360, stops: stops.sort((a, b) => a.at - b.at) };
  }
  return null;
}

// src/ui/components/paint-picker/styles.module.css
var styles_module_default2 = {
  pp: "pp_655Ssw",
  modes: "modes_655Ssw",
  on: "on_655Ssw",
  grad: "grad_655Ssw",
  bar: "bar_655Ssw",
  stop: "stop_655Ssw",
  sel: "sel_655Ssw",
  row: "row_655Ssw",
  out: "out_655Ssw",
  seg: "seg_655Ssw",
  rm: "rm_655Ssw",
  angle: "angle_655Ssw",
  deg: "deg_655Ssw"
};

// src/ui/components/paint-picker/index.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
var rgb = (hex) => {
  const n = parseInt((normalizeHex(hex) ?? "var(--stage-black)").slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
var toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
function lerpHex(a, b, t) {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}
function sampleAt(stops, f) {
  const sorted = [...stops].sort((s1, s2) => s1.at - s2.at);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (f <= first.at)
    return first.color;
  if (f >= last.at)
    return last.color;
  for (let i = 0;i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (f >= lo.at && f <= hi.at)
      return lerpHex(lo.color, hi.color, (f - lo.at) / (hi.at - lo.at));
  }
  return last.color;
}
function clampToAllowed(paint, allow) {
  if (paint.kind === "gradient" && !allow.includes("gradient"))
    return solidPaint(paint.stops[0].color);
  if (paint.kind === "solid" && !allow.includes("solid"))
    return gradientPaint(paint.color);
  return paint;
}
function PaintPicker({ value, allow: allowProp, onChange }) {
  const allow = allowProp?.length ? allowProp : ["solid", "gradient"];
  const paint = clampToAllowed(normalizePaint(value) ?? solidPaint(), allow);
  const [sel, setSel] = useState2(0);
  const selClamped = paint.kind === "gradient" ? Math.min(sel, paint.stops.length - 1) : 0;
  const switchMode = (m) => {
    if (paint.kind === m)
      return;
    setSel(0);
    onChange(m === "gradient" ? gradientPaint(paint.kind === "solid" ? paint.color : undefined) : solidPaint(paint.kind === "gradient" ? paint.stops[0].color : undefined));
  };
  return /* @__PURE__ */ jsxDEV2("div", {
    className: styles_module_default2.pp,
    children: [
      allow.length > 1 && /* @__PURE__ */ jsxDEV2("div", {
        className: styles_module_default2.modes,
        children: ["solid", "gradient"].filter((m) => allow.includes(m)).map((m) => /* @__PURE__ */ jsxDEV2("button", {
          type: "button",
          className: paint.kind === m ? styles_module_default2.on : undefined,
          onClick: () => switchMode(m),
          children: m
        }, m, false, undefined, this))
      }, undefined, false, undefined, this),
      paint.kind === "solid" ? /* @__PURE__ */ jsxDEV2(ColorPicker, {
        value: paint.color,
        onChange: (hex) => onChange({ kind: "solid", color: hex })
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV2(GradientEditor, {
        paint,
        sel: selClamped,
        onSel: setSel,
        onChange
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function GradientEditor({
  paint,
  sel,
  onSel,
  onChange
}) {
  const stop = paint.stops[sel];
  const withStops = (stops) => ({ ...paint, stops });
  const onBarPointerDown = (e) => {
    if (e.target !== e.currentTarget)
      return;
    const rect = e.currentTarget.getBoundingClientRect();
    const f = dragFraction(e.clientX, rect.left, rect.width);
    const stops = [...paint.stops, { color: sampleAt(paint.stops, f), at: f }];
    onSel(stops.length - 1);
    onChange(withStops(stops));
  };
  const dragStop = (i, bar, clientX) => {
    const rect = bar.getBoundingClientRect();
    const f = dragFraction(clientX, rect.left, rect.width);
    onChange(withStops(paint.stops.map((s, idx) => idx === i ? { ...s, at: f } : s)));
  };
  const removeStop = () => {
    if (paint.stops.length <= 2)
      return;
    const stops = paint.stops.filter((_, i) => i !== sel);
    onSel(Math.min(sel, stops.length - 1));
    onChange(withStops(stops));
  };
  const barBg = `linear-gradient(90deg, ${[...paint.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(", ")})`;
  return /* @__PURE__ */ jsxDEV2("div", {
    className: styles_module_default2.grad,
    children: [
      /* @__PURE__ */ jsxDEV2("div", {
        className: styles_module_default2.bar,
        style: { background: barBg },
        onPointerDown: onBarPointerDown,
        children: paint.stops.map((s, i) => /* @__PURE__ */ jsxDEV2("span", {
          className: i === sel ? `${styles_module_default2.stop} ${styles_module_default2.sel}` : styles_module_default2.stop,
          style: { left: `${s.at * 100}%`, background: s.color },
          onPointerDown: (e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onSel(i);
          },
          onPointerMove: (e) => {
            if (e.buttons === 0)
              return;
            e.stopPropagation();
            dragStop(i, e.currentTarget.parentElement, e.clientX);
          }
        }, i, false, undefined, this))
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2("div", {
        className: styles_module_default2.row,
        children: [
          /* @__PURE__ */ jsxDEV2("div", {
            className: styles_module_default2.out,
            style: { background: paintToCss(paint) }
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV2("div", {
            className: styles_module_default2.seg,
            children: ["linear", "radial"].map((t) => /* @__PURE__ */ jsxDEV2("button", {
              type: "button",
              className: paint.type === t ? styles_module_default2.on : undefined,
              onClick: () => onChange({ ...paint, type: t }),
              children: t
            }, t, false, undefined, this))
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV2("button", {
            type: "button",
            className: styles_module_default2.rm,
            disabled: paint.stops.length <= 2,
            onClick: removeStop,
            children: "remove"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      paint.type === "linear" && /* @__PURE__ */ jsxDEV2("div", {
        className: styles_module_default2.angle,
        children: [
          /* @__PURE__ */ jsxDEV2("span", {
            className: styles_module_default2.deg,
            children: "angle"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV2("input", {
            type: "range",
            min: 0,
            max: 360,
            value: Math.round(paint.angle),
            onChange: (e) => onChange({ ...paint, angle: Number(e.target.value) })
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV2("span", {
            className: styles_module_default2.deg,
            children: [
              Math.round(paint.angle),
              "°"
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV2(ColorPicker, {
        value: stop.color,
        onChange: (hex) => onChange(withStops(paint.stops.map((s, i) => i === sel ? { ...s, color: hex } : s)))
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/swatch-row/styles.module.css
var styles_module_default3 = {
  wrap: "wrap_OmPbpg",
  row: "row_OmPbpg",
  sw: "sw_OmPbpg",
  on: "on_OmPbpg",
  lbl: "lbl_OmPbpg",
  custom: "custom_OmPbpg",
  empty: "empty_OmPbpg",
  panel: "panel_OmPbpg"
};

// src/ui/components/swatch-row/index.tsx
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
var HOUSE_PALETTE = [
  { id: "rose", label: "rose", hex: "var(--rose)" },
  { id: "amber", label: "amber", hex: "#f59e0b" },
  { id: "emerald", label: "emerald", hex: "#10b981" },
  { id: "violet", label: "violet", hex: "#8b5cf6" },
  { id: "blue", label: "blue", hex: "#3b82f6" }
];
var eq = (a, b) => a.toLowerCase() === b.toLowerCase();
function SwatchRow({ palette, value, onChange, allowCustom }) {
  const [open, setOpen] = useState3(false);
  const current = value ?? palette[0]?.hex ?? "var(--rose)";
  const isCustom = !palette.some((c) => eq(c.hex, current));
  return /* @__PURE__ */ jsxDEV3("div", {
    className: styles_module_default3.wrap,
    children: [
      /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default3.row,
        children: [
          palette.map((choice) => /* @__PURE__ */ jsxDEV3("button", {
            type: "button",
            className: eq(choice.hex, current) ? `${styles_module_default3.sw} ${styles_module_default3.on}` : styles_module_default3.sw,
            style: { background: choice.hex },
            title: choice.label,
            "aria-pressed": eq(choice.hex, current),
            onClick: () => onChange(choice.hex),
            children: /* @__PURE__ */ jsxDEV3("span", {
              className: styles_module_default3.lbl,
              children: choice.label
            }, undefined, false, undefined, this)
          }, choice.id, false, undefined, this)),
          allowCustom && /* @__PURE__ */ jsxDEV3("button", {
            type: "button",
            className: `${styles_module_default3.sw} ${styles_module_default3.custom} ${isCustom ? styles_module_default3.on : styles_module_default3.empty}`,
            style: isCustom ? { background: current } : undefined,
            title: "Custom color",
            "aria-pressed": isCustom,
            onClick: () => setOpen((o) => !o),
            children: /* @__PURE__ */ jsxDEV3("span", {
              className: styles_module_default3.lbl,
              children: "custom"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      allowCustom && open && /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default3.panel,
        children: /* @__PURE__ */ jsxDEV3(PaintPicker, {
          value: solidPaint(current),
          allow: ["solid"],
          onChange: (p) => {
            if (p.kind !== "solid")
              return;
            onChange(p.color);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/setup/steps/accent/index.tsx
import { jsxDEV as jsxDEV4 } from "react/jsx-dev-runtime";
var OPTIONS = HOUSE_PALETTE.map((c) => ({
  id: c.id,
  title: c.label,
  value: c.hex,
  isDefault: c.id === "rose"
}));
var step = {
  manifest: {
    id: "accent",
    order: 40,
    question: "Pick your color.",
    say: "One accent for your workspace. Rose is a good place to start.",
    settingsKey: SETTING_KEYS.houseAccent,
    layoutClass: "swatches",
    stageNote: "accent pieces repaint"
  },
  options: () => OPTIONS,
  renderOptions(options, draft, onPick) {
    const value = draft[SETTING_KEYS.houseAccent];
    return /* @__PURE__ */ jsxDEV4(SwatchRow, {
      palette: HOUSE_PALETTE,
      value: typeof value === "string" ? value : undefined,
      allowCustom: true,
      onChange: (hex) => {
        const picked = options.find((o) => o.value === hex);
        onPick(picked ?? { id: "custom", title: "Custom", value: hex });
      }
    }, undefined, false, undefined, this);
  },
  stageVars(draft) {
    const hex = draft[SETTING_KEYS.houseAccent];
    return typeof hex === "string" ? { "--accent": hex } : undefined;
  },
  pageVars(draft) {
    const hex = draft[SETTING_KEYS.houseAccent];
    return typeof hex === "string" ? { "--wiz-a": hex } : undefined;
  },
  phrase(draft, options) {
    const hex = draft[SETTING_KEYS.houseAccent];
    if (typeof hex !== "string")
      return null;
    const picked = options.find((o) => o.value === hex);
    return { pre: "in ", strong: picked ? picked.title : "your own color" };
  },
  recap(draft, options) {
    const hex = draft[SETTING_KEYS.houseAccent];
    if (typeof hex !== "string")
      return null;
    const picked = options.find((o) => o.value === hex);
    return { label: "color", value: picked ? picked.title : hex };
  }
};
var accent_default = step;
export {
  accent_default as default
};
