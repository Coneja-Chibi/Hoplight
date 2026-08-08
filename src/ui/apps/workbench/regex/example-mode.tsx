/**
 * "Match by example" sub-mode (design/vs-regex-editor.html wire 1.5, RC's readout transcribed): give
 * example phrases, the shared structure is detected, and the result is shown in RC's exact readout -
 * a delimited syntax-colored pattern, the Mode / Examples / Uses meta lines, token chips, and an
 * inline "Test it out" box. Every piece is engine truth from a single AST parse (readoutFor): spans
 * index the real pattern, and the test box highlights real matches. The pattern is rendered as colored
 * React SPANS, never innerHTML. By-example does not decompile back to state (RC's decompile-null), so
 * editing the examples rebuilds; the examples themselves are ephemeral authoring input.
 */
import { useMemo, useState, type JSX, type ReactNode } from "react";
import { buildFromExamples, readoutFor, type PatternSpan, type SpanKind } from "../../../../core/regex";
import { mulberry32 } from "../../../../core/lore/rng";
import { seedFrom } from "./mode-words";
import { ExpandTextarea } from "../../../components/expand";

export interface ExampleModeProps {
  exampleText: string;
  styles: Readonly<Record<string, string>>;
  onChangeExamples: (text: string) => void;
}

const SPAN_CLASS: Record<SpanKind, string> = {
  literal: "pLiteral",
  anchor: "pAnchor",
  special: "pSpecial",
  group: "pGroup",
};

/** Render the delimited, syntax-colored pattern from AST spans (React elements, never innerHTML). */
function renderPattern(
  spans: readonly PatternSpan[],
  flags: string,
  styles: Readonly<Record<string, string>>,
): ReactNode {
  return (
    <>
      <span className={styles.pDelim}>/</span>
      {spans.map((s, i) => (
        <span key={i} className={styles[SPAN_CLASS[s.kind]]}>
          {s.text}
        </span>
      ))}
      <span className={styles.pDelim}>/</span>
      <span className={styles.pFlag}>{flags}</span>
    </>
  );
}

/** Highlight every match of the compiled pattern inside the test text (marks, left to right). */
function renderTest(
  text: string,
  pattern: string,
  flags: string,
  markClass: string | undefined,
): ReactNode {
  if (text === "" || pattern === "") return text;
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
  } catch {
    return text;
  }
  const out: ReactNode[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(text)) !== null && guard < 500) {
    guard++;
    if (m.index > cursor) out.push(text.slice(cursor, m.index));
    out.push(
      <mark key={`m-${m.index}`} className={markClass}>
        {m[0]}
      </mark>,
    );
    cursor = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function ExampleMode({ exampleText, styles, onChangeExamples }: ExampleModeProps): JSX.Element {
  const [testText, setTestText] = useState("");

  const built = useMemo(() => buildFromExamples(exampleText.split(/[\n,]/)), [exampleText]);
  const readout = useMemo(
    () => readoutFor(built.pattern, built.flags, { rng: mulberry32(seedFrom(built.pattern)), count: 5 }),
    [built.pattern, built.flags],
  );

  return (
    <>
      <p className={styles.hint}>
        Give 2-5 examples of what should match; the pattern is detected from their shared structure.
      </p>
      <ExpandTextarea
        label="Example phrases to match"
        className={styles.exBig}
        value={exampleText}
        placeholder="is it raining, did it rain, has it rained"
        aria-label="Example phrases to match"
        spellCheck={false}
        onChange={(e) => onChangeExamples(e.target.value)}
      />

      {built.pattern !== "" && (
        <div className={styles.rcOut}>
          <div className={styles.rcPat}>{renderPattern(readout.spans, built.flags, styles)}</div>
          <p className={styles.rcMeta}>
            {readout.mode.length > 0 && (
              <>
                <b className={styles.rcMetaB}>Mode:</b> {readout.mode.join(", ")}
                <br />
              </>
            )}
            {readout.words.length > 0 && (
              <>
                <b className={styles.rcMetaB}>Examples:</b> {readout.words.join(", ")}
                <br />
              </>
            )}
            {readout.uses.length > 0 && (
              <>
                <b className={styles.rcMetaB}>Uses:</b> {readout.uses.join(", ")}
              </>
            )}
          </p>
          {readout.words.length > 0 && (
            <div className={styles.tokRow}>
              {readout.words.slice(0, 6).map((w) => (
                <span key={w} className={styles.tok}>
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.testBox}>
        <label className={styles.testLabel} htmlFor="regex-example-test">
          Test it out
        </label>
        <ExpandTextarea
          label="Test it out"
          id="regex-example-test"
          className={styles.exBig}
          value={testText}
          placeholder="Paste sample text here to see what matches..."
          aria-label="Sample text to test against"
          spellCheck={false}
          onChange={(e) => setTestText(e.target.value)}
        />
        {testText !== "" && (
          <div className={styles.testOut}>{renderTest(testText, built.pattern, built.flags, styles.testMark)}</div>
        )}
      </div>
    </>
  );
}
