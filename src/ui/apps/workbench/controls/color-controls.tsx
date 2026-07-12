/**
 * GradientControl + PaletteControl - the editor's two color composites, lifted from Editor.tsx as
 * self-contained components that own their OWN popover state (which stop / swatch is open). The shell
 * keeps the canonical derivation + routing (signatureColor vs gradientColors, presentation.palette) and
 * passes a plain value + onChange; these just draw the tiles, the open-gated ColorPicker popover, and
 * add/remove. This deletes the 4 popover useState from the parent.
 */
import { useState, type JSX } from "react";
import { ColorPicker } from "../../../components/color-picker";
import { normalizeHex } from "../../../_shared/color-math";
import { resolveCssColor } from "../../../_shared/css-color";

/** New swatches start on the house rose, resolved to real hex: these values are entity DATA that
 *  export through codecs, so a raw var(--rose) string must never be stored. */
const defaultSwatchHex = (): string => resolveCssColor("var(--rose)");

type Styles = Readonly<Record<string, string>>;

export interface GradientControlProps {
  /** the unified color list: 1 = solid signature, 2-3 = blend */
  value: string[];
  onChange(rows: string[]): void;
  styles: Styles;
}

export function GradientControl({ value, onChange, styles }: GradientControlProps): JSX.Element {
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(false);
  const at = Math.min(sel, Math.max(0, value.length - 1));
  // a single color renders solid; two or more blend left to right (a 1-stop gradient is invalid CSS)
  const css = value.length < 2 ? value[0] ?? "transparent" : `linear-gradient(90deg, ${value.join(", ")})`;
  return (
    <>
      <span className={styles.hint}>one color is solid; add up to 3 to blend them into a gradient</span>
      <div className={styles.palGrid}>
        {value.map((hex, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.palTile}${i === at && open ? ` ${styles.palTileOn}` : ""}`}
            onClick={() => {
              const closing = i === sel && open;
              setSel(i);
              setOpen(!closing);
            }}
            title={hex}
          >
            <span className={styles.palChip} style={{ background: hex }} />
            <span className={styles.palName}>{hex}</span>
          </button>
        ))}
        {value.length < 3 && (
          <button
            type="button"
            className={styles.palAdd}
            onClick={() => {
              const next = [...value, defaultSwatchHex()];
              onChange(next);
              setSel(next.length - 1);
              setOpen(true);
            }}
          >
            + add
          </button>
        )}
      </div>
      {value.length === 0 ? (
        <span className={styles.hint}>no signature color yet - add one, or add up to 3 to blend a gradient</span>
      ) : (
        <>
          <div className={styles.gradBar} style={{ background: css }} />
          {open && (
            <div className={styles.palEdit}>
              {/* eslint-disable-next-line no-restricted-syntax -- open-gated popover: raw picker edits the one selected gradient stop; SwatchRow is single-value, PaintPicker boxes hex in a Paint */}
              <ColorPicker
                value={normalizeHex(value[at] ?? "") ?? value[at]}
                onChange={(hex) => onChange(value.map((c, i) => (i === at ? hex : c)))}
              />
              <div className={styles.palRow}>
                <button type="button" className={styles.rm} onClick={() => setOpen(false)}>
                  done
                </button>
                <button
                  type="button"
                  className={styles.rm}
                  onClick={() => {
                    onChange(value.filter((_, i) => i !== at));
                    setSel(Math.max(0, at - 1));
                    setOpen(false);
                  }}
                >
                  remove color
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export interface Swatch {
  label?: string;
  name?: string;
  hex: string;
}

export interface PaletteControlProps {
  value: Swatch[];
  onChange(rows: Swatch[]): void;
  styles: Styles;
  /** Opt-in second input: edit `label` (the slot the color fills - Hair, Eyes) and `name` (the
   *  color's own name - chestnut) as separate fields, with these placeholders. Absent = the
   *  single name field. The persona compiler needs BOTH before a swatch enters the prompt. */
  twoField?: { label: string; name: string };
}

export function PaletteControl({ value, onChange, styles, twoField }: PaletteControlProps): JSX.Element {
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(false);
  const at = Math.min(sel, Math.max(0, value.length - 1));
  const cur = value[at];
  // two-field mode leads with the slot (label); single-field mode's one input edits name
  const tileName = (sw: Swatch): string =>
    (twoField ? sw.label || sw.name : sw.name || sw.label) || "unnamed";
  return (
    <>
      <div className={styles.palGrid}>
        {value.map((s, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.palTile}${i === at && open ? ` ${styles.palTileOn}` : ""}`}
            onClick={() => {
              const closing = i === sel && open;
              setSel(i);
              setOpen(!closing);
            }}
            title={s.name ?? s.label ?? s.hex}
          >
            <span className={styles.palChip} style={{ background: s.hex }} />
            <span className={styles.palName}>{tileName(s)}</span>
          </button>
        ))}
        <button
          type="button"
          className={styles.palAdd}
          onClick={() => {
            const next = [...value, { name: "", hex: defaultSwatchHex() }];
            onChange(next);
            setSel(next.length - 1);
            setOpen(true);
          }}
        >
          + add
        </button>
      </div>
      {value.length === 0 ? (
        <span className={styles.hint}>
          {twoField
            ? "no labeled colors yet - add one and it rides into the prompt"
            : "no palette on this card yet - add a swatch to name a signature color"}
        </span>
      ) : (
        open &&
        cur && (
          <div className={styles.palEdit}>
            {twoField && (
              <input
                className={styles.in}
                placeholder={twoField.label}
                value={cur.label ?? ""}
                onChange={(e) => onChange(value.map((s, i) => (i === at ? { ...s, label: e.target.value } : s)))}
              />
            )}
            <input
              className={styles.in}
              placeholder={twoField ? twoField.name : "Name this swatch (Hair, Eyes, Skin...)"}
              value={cur.name ?? (twoField ? "" : cur.label) ?? ""}
              onChange={(e) => onChange(value.map((s, i) => (i === at ? { ...s, name: e.target.value } : s)))}
            />
            {/* eslint-disable-next-line no-restricted-syntax -- open-gated popover: raw picker edits the one selected named swatch; SwatchRow is single-value, PaintPicker boxes hex in a Paint */}
            <ColorPicker
              value={normalizeHex(cur.hex) ?? cur.hex}
              onChange={(hex) => onChange(value.map((s, i) => (i === at ? { ...s, hex } : s)))}
            />
            <div className={styles.palRow}>
              <button type="button" className={styles.rm} onClick={() => setOpen(false)}>
                done
              </button>
              <button
                type="button"
                className={styles.rm}
                onClick={() => {
                  onChange(value.filter((_, i) => i !== at));
                  setSel(Math.max(0, at - 1));
                  setOpen(false);
                }}
              >
                remove swatch
              </button>
            </div>
          </div>
        )
      )}
    </>
  );
}
