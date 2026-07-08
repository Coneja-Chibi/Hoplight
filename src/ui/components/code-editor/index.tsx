/**
 * CodeEditor - a dependency-free source editor for a card's raw code (backgroundHTML/CSS, virtualScript,
 * defaultVariables). A highlight <pre> of typed token spans sits under a transparent-text <textarea>
 * (React text nodes, never innerHTML - the source is untrusted), with a line-number gutter and a
 * caret-anchored CBS macro autocomplete. Nothing here executes the code; running it is the sandbox's job.
 */
import { useRef, useState, type JSX } from "react";
import { tokenize, type CodeLang } from "./highlight";
import styles from "./index.module.css";

export interface MacroHint {
  sig: string;
  desc: string;
}

/** the CBS macros the autocomplete offers by default (the ones cards reach for most). */
export const DEFAULT_MACROS: readonly MacroHint[] = [
  { sig: "getvar::name", desc: "read a variable" },
  { sig: "setvar::name::value", desc: "store a variable" },
  { sig: "tempvar::name::value", desc: "store, this turn only" },
  { sig: "gettempvar::name", desc: "read a temp variable" },
  { sig: "roll::N", desc: "random 1..N" },
  { sig: "random::a::b::c", desc: "pick one at random" },
  { sig: "calc::expr", desc: "do math" },
  { sig: "equal::a::b", desc: "a equals b" },
  { sig: "greater_equal::a::b", desc: "a >= b" },
  { sig: "less::a::b", desc: "a < b" },
  { sig: "char", desc: "character name" },
  { sig: "user", desc: "user name" },
];

export interface CodeEditorProps {
  value: string;
  onChange(value: string): void;
  language?: CodeLang;
  placeholder?: string;
  minRows?: number;
  macros?: readonly MacroHint[];
}

export function CodeEditor(props: CodeEditorProps): JSX.Element {
  const { value, onChange, language = "text", placeholder, minRows = 8, macros = DEFAULT_MACROS } = props;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const [ac, setAc] = useState<{ items: MacroHint[]; index: number; start: number; x: number; y: number } | null>(null);

  const tokens = tokenize(value, language);
  const lineCount = Math.max(value.split("\n").length, minRows);
  const gutter = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

  const syncScroll = (): void => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  // -- macro autocomplete: detect an open {{ before the caret, position a popover at the caret --
  const macroTokenBefore = (ta: HTMLTextAreaElement): { start: number; query: string } | null => {
    const upto = ta.value.slice(0, ta.selectionStart);
    const open = upto.lastIndexOf("{{");
    if (open === -1) return null;
    const between = upto.slice(open + 2);
    if (between.includes("}}")) return null;
    const query = between.split("::")[0] ?? "";
    if (!/^[a-z_]*$/i.test(query)) return null;
    return { start: open, query };
  };

  const caretXY = (ta: HTMLTextAreaElement): { x: number; y: number } => {
    const mirror = mirrorRef.current;
    if (!mirror) return { x: 0, y: 0 };
    const s = getComputedStyle(ta);
    for (const p of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "paddingTop", "paddingLeft", "letterSpacing"] as const) {
      mirror.style[p] = s[p];
    }
    mirror.style.width = `${ta.clientWidth}px`;
    mirror.textContent = ta.value.slice(0, ta.selectionStart);
    const marker = document.createElement("span");
    marker.textContent = "​";
    mirror.appendChild(marker);
    const x = marker.offsetLeft - ta.scrollLeft;
    const y = marker.offsetTop - ta.scrollTop + (parseFloat(s.lineHeight) || 16);
    return { x, y };
  };

  const refreshAc = (ta: HTMLTextAreaElement): void => {
    const tok = macroTokenBefore(ta);
    if (!tok) {
      setAc(null);
      return;
    }
    const items = macros.filter((m) => m.sig.toLowerCase().startsWith(tok.query.toLowerCase()));
    if (items.length === 0) {
      setAc(null);
      return;
    }
    const { x, y } = caretXY(ta);
    setAc({ items, index: 0, start: tok.start, x, y });
  };

  const insertMacro = (): void => {
    const ta = taRef.current;
    if (!ta || !ac) return;
    const chosen = ac.items[ac.index]!;
    const before = ta.value.slice(0, ac.start);
    const after = ta.value.slice(ta.selectionStart);
    const insert = `{{${chosen.sig}}}`;
    const next = before + insert + after;
    const caret = before.length + insert.length;
    onChange(next);
    setAc(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!ac) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAc({ ...ac, index: (ac.index + 1) % ac.items.length });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAc({ ...ac, index: (ac.index - 1 + ac.items.length) % ac.items.length });
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      insertMacro();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAc(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.gutter} ref={gutterRef}>{gutter}</div>
      <div className={styles.stack}>
        <pre className={styles.pre} ref={preRef} aria-hidden="true">
          {tokens.map((t, i) => (
            <span key={i} className={styles[t.type]}>{t.text}</span>
          ))}
          {"\n"}
        </pre>
        <textarea
          ref={taRef}
          className={styles.ta}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          style={{ minHeight: `${minRows * 1.6}em` }}
          onChange={(e) => {
            onChange(e.target.value);
            refreshAc(e.target);
          }}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setAc(null), 120)}
        />
        {ac && (
          <div className={styles.ac} style={{ left: ac.x, top: ac.y }}>
            <div className={styles.acHead}>macros &middot; tab to insert</div>
            {ac.items.map((m, i) => (
              <div
                key={m.sig}
                className={`${styles.acItem}${i === ac.index ? ` ${styles.acItemOn}` : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setAc({ ...ac, index: i });
                  insertMacro();
                }}
              >
                <span className={styles.acSig}>{`{{${m.sig}}}`}</span>
                <span className={styles.acDesc}>{m.desc}</span>
              </div>
            ))}
          </div>
        )}
        <div className={styles.mirror} ref={mirrorRef} aria-hidden="true" />
      </div>
    </div>
  );
}
