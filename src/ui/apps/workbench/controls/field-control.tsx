/**
 * The editor's field-rendering ENGINE, lifted from Editor.tsx: the composite bodies (tags/rating/prose/
 * greetings/background/spotlight), the SubField primitive (renderSub), and controlFor - the one control
 * per FIELD_MODULES kind that every presenter renders through. They all thread the same draft/setField
 * state, so they come out together as a factory: makeControlFor(ctx) closes over the shell's draft,
 * setField, styles and the already-built gradient/palette/portrait bodies, and returns { controlFor,
 * proseBody } (proseBody is also used by the quiz's answerFor). Bodies are verbatim; only the ctx wrap
 * is new.
 */
import type { JSX, ReactNode } from "react";
import { greetingsOf, rec, str, strArr, type Greeting } from "../editor-derive";
import { readPath } from "../editor-core";
import { RenderBox } from "../../../components/render-box";
import { categorizeTag } from "../../../../core/tag-taxonomy";
import { TAG_CATEGORY_STYLE } from "../tag-category-style";
import { OptionCards } from "./option-cards";
import type { FieldModule, SubField } from "../fields";

const PROSE_MONO = new Set(["firstMes", "mesExample"]);
const ASSET_ROLES: readonly string[] = ["portrait", "emotion", "outfit", "pose", "background", "other"];
const SPOTLIGHT_FIELDS: ReadonlyArray<readonly [key: string, label: string]> = [
  ["description", "Description"],
  ["personality", "Personality"],
  ["scenario", "Scenario"],
  ["firstMessage", "First Message"],
  ["creatorNotes", "From the Creator"],
  ["systemPrompt", "System Prompt"],
];

export interface FieldCtx {
  draft: unknown;
  setField(path: string, value: unknown): void;
  styles: Readonly<Record<string, string>>;
  /** the gradient/palette composites are built in the shell (canonical routing) and injected */
  gradientBody: JSX.Element;
  paletteBody: JSX.Element;
  /** the portrait card (the `portrait` kind returns it) */
  leftCard: ReactNode;
}

export interface FieldControlApi {
  controlFor(m: FieldModule): JSX.Element;
  /** exposed for the quiz presenter's answerFor */
  proseBody(id: string, path: string): JSX.Element;
}

export function makeControlFor(ctx: FieldCtx): FieldControlApi {
  const { draft, setField, styles, gradientBody, paletteBody, leftCard } = ctx;
  const text = (path: string): string => str(readPath(draft, path));

  const tagsControl = (
    <>
      <div className={styles.tagbar}>
        <button type="button" className={styles.tagsheet} disabled title="The tagsheet taxonomy lands with the discovery milestone">
          Open Tagsheet
        </button>
        <button type="button" className={styles.autotag} disabled title="Auto-tag lands with the brain milestone">
          Auto-tag
        </button>
      </div>
      <label className={styles.k}>{`selected tags (${strArr(readPath(draft, "discovery.tags")).length})`}</label>
      <div className={styles.tags}>
        {strArr(readPath(draft, "discovery.tags")).map((tag) => {
          const cs = TAG_CATEGORY_STYLE[categorizeTag(tag)];
          return (
            <button
              key={tag}
              type="button"
              className={styles.tag}
              style={{ color: cs.color, borderColor: `${cs.color}80`, background: `${cs.color}1f` }}
              title={`Remove tag ${tag}`}
              onClick={() => setField("discovery.tags", strArr(readPath(draft, "discovery.tags")).filter((t) => t !== tag))}
            >
              <span className={styles.tagIco}>{cs.icon}</span>
              {tag} <i>x</i>
            </button>
          );
        })}
        <input
          className={styles.tagIn}
          placeholder="+ tag, enter"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const value = e.currentTarget.value.trim();
            if (!value) return;
            const cur = strArr(readPath(draft, "discovery.tags"));
            if (!cur.includes(value)) setField("discovery.tags", [...cur, value]);
            e.currentTarget.value = "";
          }}
        />
      </div>
    </>
  );

  const ratingControl = (
    <div className={styles.rating}>
      <div className={styles.ratingRow}>
        <b>CONTENT RATING</b>
        <span className={styles.pill}>{text("discovery.rating") || "unrated"}</span>
        <i>auto-calc lands with the tagsheet</i>
      </div>
      <label className={styles.k}>override</label>
      <select className={styles.in} value={text("discovery.rating") || ""} onChange={(e) => setField("discovery.rating", e.target.value)}>
        <option value="">unrated</option>
        <option value="all-ages">all ages</option>
        <option value="mature">mature</option>
        <option value="explicit">explicit</option>
      </select>
    </div>
  );

  const proseBody = (id: string, path: string): JSX.Element => {
    const value = text(path);
    return (
      <RenderBox value={value} format="markdown">
        <textarea
          className={`${styles.ta}${PROSE_MONO.has(id) ? ` ${styles.mono}` : ""}`}
          spellCheck={false}
          value={value}
          onChange={(e) => setField(path, e.target.value)}
        />
        <span className={styles.cnt}>{`${value.length} chars`}</span>
      </RenderBox>
    );
  };

  const greetingsBodyFor = (path: string): JSX.Element => {
    const rows = greetingsOf(draft, path);
    const setRows = (next: Greeting[]): void =>
      setField(path, next.filter((g) => g.text !== "" || (g.title ?? "") !== ""));
    return (
      <>
        {rows.map((g, i) => (
          <div className={styles.greetRow} key={i}>
            <div className={styles.greetHead}>
              <input
                className={styles.in}
                placeholder="optional title"
                value={g.title ?? ""}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value || undefined } : x)))}
              />
              <button type="button" className={styles.rm} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                remove
              </button>
            </div>
            <RenderBox value={g.text} format="markdown">
              <textarea
                className={`${styles.ta} ${styles.mono}`}
                spellCheck={false}
                value={g.text}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              />
            </RenderBox>
          </div>
        ))}
        <button type="button" className={styles.add} onClick={() => setRows([...rows, { text: "" }])}>
          + add a greeting
        </button>
      </>
    );
  };

  const bgRef = text("presentation.background.ref");
  const backgroundBody = (
    <>
      {bgRef === "" ? (
        <div className={styles.bgempty}>No default background</div>
      ) : (
        <div className={styles.bgPreview} style={{ backgroundImage: `url("${bgRef}")` }} />
      )}
      <div className={styles.bgrow}>
        <span>Custom URL</span>
        <input
          className={styles.in}
          style={{ maxWidth: "12rem" }}
          placeholder="applied when starting a chat"
          value={bgRef}
          onChange={(e) => setField("presentation.background.ref", e.target.value)}
        />
      </div>
    </>
  );

  const spoilers = rec(readPath(draft, "presentation.spoilers"));
  const spoilFields = rec(spoilers.fields);
  const spoilOrder = ((): string[] => {
    const saved = strArr(spoilers.order).filter((k) => SPOTLIGHT_FIELDS.some(([key]) => key === k));
    const missing = SPOTLIGHT_FIELDS.map(([key]) => key).filter((k) => !saved.includes(k));
    return [...saved, ...missing];
  })();
  const moveSpoil = (key: string, dir: -1 | 1): void => {
    const at = spoilOrder.indexOf(key);
    const to = at + dir;
    if (to < 0 || to >= spoilOrder.length) return;
    const next = [...spoilOrder];
    [next[at], next[to]] = [next[to]!, next[at]!];
    setField("presentation.spoilers", { ...spoilers, order: next });
  };
  const spotlightBody = (
    <>
      {spoilOrder.map((key) => {
        const label = SPOTLIGHT_FIELDS.find(([k]) => k === key)?.[1] ?? key;
        const on = spoilFields[key] === true;
        return (
          <div className={styles.spoilRow} key={key}>
            <span className={styles.ud}>
              <button type="button" onClick={() => moveSpoil(key, -1)} title={`Move ${label} up`}>&#8593;</button>
              <button type="button" onClick={() => moveSpoil(key, 1)} title={`Move ${label} down`}>&#8595;</button>
            </span>
            <span>{label}</span>
            <button
              type="button"
              className={`${styles.spoil}${on ? ` ${styles.spoilOn}` : ""}`}
              onClick={() => setField("presentation.spoilers", { ...spoilers, fields: { ...spoilFields, [key]: !on } })}
            >
              {on ? "SPOILERED" : "visible"}
            </button>
          </div>
        );
      })}
    </>
  );

  const renderSub = (value: unknown, onChange: (v: unknown) => void, sf: SubField): JSX.Element => {
    switch (sf.kind) {
      case "prose":
        return <textarea className={styles.ta} spellCheck={false} value={str(value)} onChange={(e) => onChange(e.target.value)} />;
      case "number":
        return (
          <input
            className={styles.in}
            type="number"
            step={sf.number?.step}
            min={sf.number?.min}
            max={sf.number?.max}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
        );
      case "toggle":
        return (
          <button
            type="button"
            className={`${styles.toggle}${value === true ? ` ${styles.toggleOn}` : ""}`}
            aria-pressed={value === true}
            onClick={() => onChange(value !== true)}
          >
            {value === true ? "On" : "Off"}
          </button>
        );
      case "select":
        return (
          <select className={styles.in} value={str(value)} onChange={(e) => onChange(e.target.value)}>
            {(sf.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      default:
        return <input className={styles.in} placeholder={sf.placeholder} value={str(value)} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  const controlFor = (m: FieldModule): JSX.Element => {
    switch (m.kind) {
      case "text":
        return (
          <input
            className={styles.in}
            placeholder={m.placeholder}
            value={text(m.path)}
            onChange={(e) => setField(m.path, e.target.value)}
          />
        );
      case "prose": return proseBody(m.id, m.path);
      case "tags": return tagsControl;
      case "rating": return ratingControl;
      case "portrait": return <>{leftCard}</>;
      case "gradient": return gradientBody;
      case "palette": return paletteBody;
      case "greetings": return greetingsBodyFor(m.path);
      case "background": return backgroundBody;
      case "spotlight": return spotlightBody;
      case "list": {
        const items = strArr(readPath(draft, m.path));
        return (
          <div className={styles.tags}>
            {items.map((it) => (
              <button
                key={it}
                type="button"
                className={styles.tag}
                style={{ color: "var(--text-dim)", borderColor: "var(--seam)", background: "transparent" }}
                title={`Remove ${it}`}
                onClick={() => setField(m.path, items.filter((x) => x !== it))}
              >
                {it} <i>x</i>
              </button>
            ))}
            <input
              className={styles.tagIn}
              placeholder="+ add, enter"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const v = e.currentTarget.value.trim();
                if (v === "") return;
                if (!items.includes(v)) setField(m.path, [...items, v]);
                e.currentTarget.value = "";
              }}
            />
          </div>
        );
      }
      case "select":
        return (
          <OptionCards
            options={(m.options ?? []).map((o) => ({ value: o.value, title: o.label }))}
            value={text(m.path)}
            onSelect={(v) => setField(m.path, v)}
            styles={styles}
          />
        );
      case "number": {
        const raw = readPath(draft, m.path);
        const n = typeof raw === "number" ? raw : undefined;
        const meta = m.number;
        if (meta?.range) {
          return (
            <div className={styles.numrange}>
              <input
                type="range"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={n ?? meta.min ?? 0}
                onChange={(e) => setField(m.path, Number(e.target.value))}
              />
              <span className={styles.numval}>{n === undefined ? "unset" : `${n}${meta.unit ?? ""}`}</span>
            </div>
          );
        }
        return (
          <input
            className={styles.in}
            type="number"
            step={meta?.step}
            min={meta?.min}
            max={meta?.max}
            value={n ?? ""}
            onChange={(e) => setField(m.path, e.target.value === "" ? undefined : Number(e.target.value))}
          />
        );
      }
      case "keyvalue": {
        const entries = Object.entries(rec(readPath(draft, m.path)));
        const kv = m.keyValue ?? { keyLabel: "Key", valueLabel: "Value" };
        const isList = kv.valueList === true;
        const showVal = (v: unknown): string => (isList ? strArr(v).join(", ") : str(v));
        const parseVal = (s: string): unknown => (isList ? s.split(",").map((x) => x.trim()).filter(Boolean) : s);
        const write = (next: [string, unknown][]): void => setField(m.path, Object.fromEntries(next));
        return (
          <div className={styles.kv}>
            {entries.map(([k, v], i) => (
              <div className={styles.kvrow} key={i}>
                <input
                  className={styles.in}
                  placeholder={kv.keyPlaceholder ?? kv.keyLabel}
                  value={k}
                  onChange={(e) => write(entries.map((en, j) => (j === i ? [e.target.value, en[1]] : en)))}
                />
                <input
                  className={styles.in}
                  placeholder={kv.valueLabel}
                  value={showVal(v)}
                  onChange={(e) => write(entries.map((en, j) => (j === i ? [en[0], parseVal(e.target.value)] : en)))}
                />
                <button type="button" className={styles.rm} onClick={() => write(entries.filter((_, j) => j !== i))}>
                  remove
                </button>
              </div>
            ))}
            <button type="button" className={styles.add} onClick={() => write([...entries, ["", ""]])}>
              {`+ add ${kv.keyLabel.toLowerCase()}`}
            </button>
          </div>
        );
      }
      case "list-subeditor": {
        const raw = readPath(draft, m.path);
        const rows: Record<string, unknown>[] = Array.isArray(raw) ? raw.map(rec) : [];
        const subs = m.subFields ?? [];
        const setRows = (next: Record<string, unknown>[]): void => setField(m.path, next);
        return (
          <div className={styles.sublist}>
            {rows.map((row, i) => (
              <div className={styles.subrow} key={i}>
                {subs.map((sf) => (
                  <label className={styles.subcell} key={sf.key}>
                    <span className={styles.subk}>{sf.label}</span>
                    {renderSub(row[sf.key], (v) => setRows(rows.map((r, j) => (j === i ? { ...r, [sf.key]: v } : r))), sf)}
                  </label>
                ))}
                <button type="button" className={styles.rm} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  remove
                </button>
              </div>
            ))}
            <button type="button" className={styles.add} onClick={() => setRows([...rows, {}])}>
              {m.addLabel ?? "+ add"}
            </button>
          </div>
        );
      }
      case "structured-subeditor": {
        const obj = rec(readPath(draft, m.path));
        const subs = m.subFields ?? [];
        return (
          <div className={styles.structured}>
            {subs.map((sf) => (
              <label className={styles.subcell} key={sf.key}>
                <span className={styles.subk}>{sf.label}</span>
                {renderSub(obj[sf.key], (v) => setField(`${m.path}.${sf.key}`, v), sf)}
              </label>
            ))}
          </div>
        );
      }
      case "asset-gallery": {
        const raw = readPath(draft, m.path);
        const assets: Record<string, unknown>[] = Array.isArray(raw) ? raw.map(rec) : [];
        const setAssets = (next: Record<string, unknown>[]): void => setField(m.path, next);
        const update = (i: number, patch: Record<string, unknown>): void =>
          setAssets(assets.map((a, j) => (j === i ? { ...a, ...patch } : a)));
        const addFiles = (files: FileList | null): void => {
          if (files === null) return;
          const readers = [...files].map(
            (f) =>
              new Promise<Record<string, unknown>>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ role: "other", ref: String(reader.result), mime: f.type, label: f.name });
                reader.readAsDataURL(f);
              }),
          );
          void Promise.all(readers).then((added) => setAssets([...assets, ...added]));
        };
        return (
          <div className={styles.gallery}>
            {assets.map((a, i) => {
              const ref = str(a.ref);
              const isImg = ref.startsWith("data:image") || ref.startsWith("http");
              return (
                <div className={styles.assetCard} key={i}>
                  <div className={styles.assetThumb}>
                    {isImg ? <img src={ref} alt="" /> : <span>{str(a.role) || "asset"}</span>}
                  </div>
                  <select className={styles.in} value={str(a.role)} onChange={(e) => update(i, { role: e.target.value })}>
                    {ASSET_ROLES.map((rr) => (
                      <option key={rr} value={rr}>{rr}</option>
                    ))}
                  </select>
                  <input className={styles.in} placeholder="label" value={str(a.label)} onChange={(e) => update(i, { label: e.target.value })} />
                  <div className={styles.assetRow}>
                    <button
                      type="button"
                      className={`${styles.toggle}${a.primary === true ? ` ${styles.toggleOn}` : ""}`}
                      onClick={() => update(i, { primary: a.primary !== true })}
                    >
                      Primary
                    </button>
                    <button type="button" className={styles.rm} onClick={() => setAssets(assets.filter((_, j) => j !== i))}>
                      remove
                    </button>
                  </div>
                </div>
              );
            })}
            <label className={styles.add}>
              + add images
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        );
      }
    }
  };

  return { controlFor, proseBody };
}
