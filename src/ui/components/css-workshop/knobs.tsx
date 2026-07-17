/**
 * Assist knobs for one CSS rule. Heavily assisted property panel, not no-code only.
 * Composes house PaintPicker, Slider, ToggleSwitch.
 */
import type { JSX } from "react";
import { PaintPicker } from "../paint-picker";
import { Slider } from "../slider";
import { ToggleSwitch } from "../toggle-switch";
import { paintToCss, solidPaint, type Paint } from "../../_shared/paint";
import { getProp, setProp, type CssRule } from "./model";
import styles from "./styles.module.css";

export interface RuleKnobsProps {
  rule: CssRule;
  onChange(next: CssRule): void;
}

const FONT_FAMILIES = [
  "system-ui, sans-serif",
  "Georgia, serif",
  "ui-monospace, monospace",
  "Georgia, \"Times New Roman\", serif",
  "system-ui, -apple-system, Segoe UI, sans-serif",
] as const;

const parsePaintFromCss = (css: string): Paint | undefined => {
  const t = css.trim();
  if (!t) return undefined;
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return solidPaint(t);
  return undefined;
};

/** Property knobs for the selected rule. */
export function RuleKnobs({ rule, onChange }: RuleKnobsProps): JSX.Element {
  const bg = getProp(rule, "background") ?? getProp(rule, "background-color");
  const paintGuess = bg ? parsePaintFromCss(bg.value) : solidPaint("#1a1820");
  const color = getProp(rule, "color");
  const pad = getProp(rule, "padding");
  const radius = getProp(rule, "border-radius");
  const border = getProp(rule, "border");
  const shadow = getProp(rule, "box-shadow");
  const opacity = getProp(rule, "opacity");
  const fontSize = getProp(rule, "font-size");
  const fontWeight = getProp(rule, "font-weight");
  const fontFamily = getProp(rule, "font-family");
  const textAlign = getProp(rule, "text-align");
  const display = getProp(rule, "display");
  const important = Boolean(
    bg?.important || color?.important || pad?.important || radius?.important,
  );

  const set = (property: string, value: string, imp = important): void => {
    onChange(setProp(rule, property, value, imp));
  };

  const opacityNum = opacity ? Number.parseFloat(opacity.value) : 1;
  const opacitySafe = Number.isFinite(opacityNum) ? opacityNum : 1;

  return (
    <div className={styles.knobGrid}>
      <div className={styles.knob}>
        <span className={styles.knobLabel}>Selector</span>
        <input
          className={styles.input}
          value={rule.selector}
          onChange={(e) => onChange({ ...rule, selector: e.target.value })}
          spellCheck={false}
          aria-label="CSS selector"
        />
      </div>

      <div className={styles.knob}>
        <span className={styles.knobLabel}>Background</span>
        <PaintPicker
          value={paintGuess ?? solidPaint("#1a1820")}
          onChange={(p) => {
            let next = setProp(rule, "background-color", "");
            next = setProp(next, "background-image", "");
            next = setProp(next, "background", paintToCss(p), important);
            onChange(next);
          }}
        />
        <input
          className={styles.input}
          value={bg?.value ?? ""}
          placeholder="or type any CSS background"
          onChange={(e) => set("background", e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className={styles.knob}>
        <span className={styles.knobLabel}>Text color</span>
        <div className={styles.row}>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(color?.value ?? "") ? color!.value : "#e8e4ef"}
            onChange={(e) => set("color", e.target.value)}
            aria-label="Text color swatch"
          />
          <input
            className={styles.input}
            value={color?.value ?? ""}
            placeholder="#hex or name"
            onChange={(e) => set("color", e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      <div className={styles.knob}>
        <span className={styles.knobLabel}>Type</span>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={fontSize?.value ?? ""}
            placeholder="font-size e.g. 0.95rem"
            onChange={(e) => set("font-size", e.target.value)}
            spellCheck={false}
          />
          <select
            className={styles.sel}
            value={fontWeight?.value ?? ""}
            onChange={(e) => set("font-weight", e.target.value)}
            aria-label="Font weight"
          >
            <option value="">weight</option>
            <option value="400">400</option>
            <option value="600">600</option>
            <option value="700">700</option>
          </select>
        </div>
        <select
          className={styles.sel}
          value={fontFamily?.value ?? ""}
          onChange={(e) => set("font-family", e.target.value)}
          aria-label="Font family"
        >
          <option value="">font family</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          className={styles.sel}
          value={textAlign?.value ?? ""}
          onChange={(e) => set("text-align", e.target.value)}
          aria-label="Text align"
        >
          <option value="">align</option>
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </div>

      <div className={styles.knob}>
        <span className={styles.knobLabel}>Box</span>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={pad?.value ?? ""}
            placeholder="padding e.g. 12px"
            onChange={(e) => set("padding", e.target.value)}
            spellCheck={false}
          />
          <input
            className={styles.input}
            value={radius?.value ?? ""}
            placeholder="radius e.g. 12px"
            onChange={(e) => set("border-radius", e.target.value)}
            spellCheck={false}
          />
        </div>
        <input
          className={styles.input}
          value={border?.value ?? ""}
          placeholder="border e.g. 1px solid #333"
          onChange={(e) => set("border", e.target.value)}
          spellCheck={false}
        />
        <input
          className={styles.input}
          value={shadow?.value ?? ""}
          placeholder="box-shadow"
          onChange={(e) => set("box-shadow", e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className={styles.knob}>
        <span className={styles.knobLabel}>Opacity</span>
        <Slider
          value={opacitySafe}
          min={0}
          max={1}
          step={0.05}
          format={(v) => v.toFixed(2)}
          aria-label="Opacity"
          onChange={(v) => set("opacity", String(v))}
        />
      </div>

      <div className={styles.knob}>
        <span className={styles.knobLabel}>Visibility</span>
        <div className={styles.row}>
          <button type="button" className={styles.mini} onClick={() => set("display", "none")}>
            hide
          </button>
          <button
            type="button"
            className={styles.mini}
            onClick={() => {
              let next = setProp(rule, "display", "");
              next = setProp(next, "visibility", "");
              onChange(next);
            }}
          >
            show
          </button>
          <span className={styles.hint}>{display?.value === "none" ? "currently hidden" : "visible"}</span>
        </div>
      </div>

      <ToggleSwitch
        on={important}
        label="force with !important (often needed on host sites)"
        onChange={(on) => {
          let next = rule;
          for (const d of rule.decls) {
            next = setProp(next, d.property, d.value, on);
          }
          onChange(next);
        }}
      />
    </div>
  );
}
