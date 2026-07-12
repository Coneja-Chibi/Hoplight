/**
 * BenchImport - the test bench's Import preview tab (design/vs-regex-tryit.html second wire, 1:1).
 * Drop or browse a rival regex file; it is detected + decoded server-side through the registered R1
 * codecs (ctx.api.inspectFile -> the ST regex codec, which reads BOTH a bare RegexScriptData[] file
 * and a card's extensions.regex_scripts). Each decoded rule is shown against the CURRENT sample with
 * its would-be effect; check the ones you want; Import stages them into the open set (fresh ids +
 * increasing sortOrder) via the host - NOTHING is written until the button.
 *
 * DEVIATION (stated): only the SillyTavern regex codec is a registered adapter, so inspectFile reaches
 * ST (bare array + card) today. RoleCall / Risu / Lumiverse / Marinara decoders exist as functions but
 * are not registered adapters; wiring them to detection is a separate server-side task (they need to be
 * added to their format index arrays). The bare-array case the task verifies is fully covered here.
 */
import { useMemo, useRef, useState, type DragEvent, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { RegexRule } from "../../../../entities/regex/schema";
import { perRuleEffect, phaseLabel, stageRules } from "./bench-core";
import styles from "./bench-import.module.css";

export interface BenchImportProps {
  ctx: AppContext;
  sample: string;
  existingRules: readonly RegexRule[];
  onImportPicked: (picked: RegexRule[]) => void;
}

interface Detected {
  filename: string;
  dialect: string;
  rules: RegexRule[];
}

const DIALECT_LABEL: Record<string, string> = {
  "sillytavern-regex": "SillyTavern",
};

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Pull the decoded regex rules out of an inspectFile result, or null when it is not a regex file. */
function rulesFromInspect(result: unknown): RegexRule[] | null {
  if (!isRec(result) || result.ok !== true || result.kind !== "regex") return null;
  const entity = result.entity;
  if (!isRec(entity)) return null;
  const body = entity.body;
  if (!isRec(body) || !Array.isArray(body.rules)) return null;
  return body.rules as RegexRule[];
}

/** A short phase summary for a rule's meta line (the wireframe's "prompt only · 5 phases"). */
function metaFor(rule: RegexRule, matched: boolean): string {
  if (!matched) return "no matches on your sample";
  const phases = rule.phases;
  const label =
    phases.length === 0
      ? "no phase"
      : phases.length <= 2
        ? phases.map(phaseLabel).join(", ")
        : `${phases.length} phases`;
  return rule.runOnEdit ? `${label} · runs on edit` : label;
}

const truncate = (s: string, n = 160): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export function BenchImport({
  ctx,
  sample,
  existingRules,
  onImportPicked,
}: BenchImportProps): JSX.Element {
  const [detected, setDetected] = useState<Detected | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const takeFile = async (file: File): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await ctx.api.inspectFile(file);
      const rules = rulesFromInspect(result);
      if (!rules) {
        setDetected(null);
        const msg = isRec(result) && typeof result.error === "string" ? result.error : null;
        setError(msg ?? "That file is not a regex script set we can read.");
        return;
      }
      const formatId = isRec(result) && typeof result.formatId === "string" ? result.formatId : "";
      setDetected({
        filename: file.name,
        dialect: DIALECT_LABEL[formatId] ?? formatId ?? "Unknown",
        rules,
      });
      setPicked(new Set(rules.map((r) => r.id)));
    } catch (e) {
      setDetected(null);
      setError(e instanceof Error ? e.message : "could not read that file");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void takeFile(file);
  };

  const toggle = (id: string): void => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const effects = useMemo(() => {
    if (!detected) return new Map<string, ReturnType<typeof perRuleEffect>>();
    return new Map(detected.rules.map((r) => [r.id, perRuleEffect(sample, r)]));
  }, [detected, sample]);

  const pickedCount = picked.size;
  const allPicked = detected ? pickedCount === detected.rules.length : false;

  const doImport = (): void => {
    if (!detected) return;
    const chosen = detected.rules.filter((r) => picked.has(r.id));
    if (chosen.length === 0) return;
    onImportPicked(stageRules(chosen, existingRules));
    // Clear so a second import starts fresh; the host reports the append.
    setDetected(null);
    setPicked(new Set());
  };

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className={styles.hiddenInput}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void takeFile(file);
          e.target.value = "";
        }}
      />

      {!detected ? (
        <div
          className={dragOver ? `${styles.drop} ${styles.dropOver}` : styles.drop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          {busy ? "Reading…" : "Drop a regex file here, or click to browse."}
        </div>
      ) : (
        <>
          <p className={styles.summary}>
            Dropped: <b>{detected.filename}</b> &middot; {detected.dialect} dialect &middot;{" "}
            {detected.rules.length} rule{detected.rules.length === 1 ? "" : "s"} found. Each shown against
            your sample - uncheck what you don&apos;t want.
          </p>

          {detected.rules.map((rule) => {
            const on = picked.has(rule.id);
            const eff = effects.get(rule.id);
            const matched = eff?.matched ?? false;
            const label = rule.label?.trim() || rule.id;
            return (
              <div key={rule.id} className={styles.impRow}>
                <button
                  type="button"
                  className={styles.impHead}
                  aria-pressed={on}
                  onClick={() => toggle(rule.id)}
                >
                  <span className={on ? `${styles.cb} ${styles.cbOn}` : styles.cb} aria-hidden="true" />
                  <b>{label}</b>
                  <i>{metaFor(rule, matched)}</i>
                </button>
                <div className={styles.impEffect}>
                  <div className={styles.impCell}>
                    <b>Your sample</b>
                    {truncate(eff?.before ?? sample)}
                  </div>
                  <div className={styles.impCell}>
                    <b>After this rule</b>
                    {eff?.error ? eff.error : matched ? truncate(eff?.after ?? "") : "no change"}
                  </div>
                </div>
              </div>
            );
          })}

          <div className={styles.impBar}>
            <span className={styles.pickCount}>
              {pickedCount} of {detected.rules.length} picked
            </span>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() =>
                setPicked(allPicked ? new Set() : new Set(detected.rules.map((r) => r.id)))
              }
            >
              {allPicked ? "Select none" : "Select all"}
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => setDetected(null)}>
              Add another
            </button>
            <button type="button" className={styles.primary} disabled={pickedCount === 0} onClick={doImport}>
              Import {pickedCount} rule{pickedCount === 1 ? "" : "s"}
            </button>
          </div>
        </>
      )}

      {error && <p className={styles.err}>{error}</p>}
    </div>
  );
}
