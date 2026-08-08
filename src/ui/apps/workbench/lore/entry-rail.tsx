/**
 * Lore binder right rail: Carrot-Compass-grade tools that stay on-screen while editing.
 * - Live try: real scanBook (keys, chance, recursion, timed) not sample-match
 * - Wake map: who can wake this entry / who this entry can wake (bookWakeGraph)
 * - Health tips + launchers into full panes
 * Timing dials (chance/sticky/cool/delay) are NOT here: one home on the page fold.
 */
import { useMemo, useState, type JSX } from "react";
import type { LorebookBody, LorebookEntry } from "../../../../entities/lorebook/schema";
import {
  bookWakeGraph,
  cryptoUnit,
  scanBook,
  type FireReason,
  type LoreHealthNote,
  type SkipReason,
} from "../../../../core/lore";
import { ExpandTextarea } from "../../../components/expand";

export interface EntryRailProps {
  body: LorebookBody;
  focusedId: string | null;
  entries: readonly LorebookEntry[];
  notes: readonly LoreHealthNote[];
  styles: Readonly<Record<string, string>>;
  onOpenHealth?: () => void;
  onOpenChanges?: () => void;
  onOpenRehearsal?: () => void;
  onSelectEntry?: (id: string) => void;
}

function reasonPlain(r: FireReason | SkipReason): string {
  switch (r.kind) {
    case "constant":
      return "always on";
    case "key":
      return `key "${r.keyword}"`;
    case "recursion":
      return `woken via "${r.keyword}"`;
    case "sticky":
      return `sticky (${r.remaining} left)`;
    case "disabled":
      return "off";
    case "no-key-match":
      return "no key hit";
    case "secondary-logic":
      return `secondary (${r.logic}) failed`;
    case "chance":
      return `chance ${r.needed}% rolled ${Math.round(r.rolled)}`;
    case "cooldown":
      return `cooldown ${r.remaining}`;
    case "delay":
      return `delay needs ${r.needs} msgs`;
    case "budget-cut":
      return "cut by budget";
    case "vectorized":
      return "by meaning only";
    case "exclude-recursion":
      return "blocks recursion wake";
    case "delay-until-recursion":
      return `needs recursion ≥ ${r.needs}`;
    case "empty-keys":
      return "no keys";
    default:
      return "skipped";
  }
}

export function LoreEntryRail({
  body,
  focusedId,
  entries,
  notes,
  styles,
  onOpenHealth,
  onOpenChanges,
  onOpenRehearsal,
  onSelectEntry,
}: EntryRailProps): JSX.Element {
  const [sample, setSample] = useState("");
  const focused = entries.find((e) => e.id === focusedId) ?? null;

  const live = useMemo(() => {
    const text = sample.trim();
    if (!text) return null;
    return scanBook(
      body,
      [{ text, role: "user" }],
      {
        chanceMode: "roll",
        rng: cryptoUnit,
        tokenBudget: body.tokenBudget > 0 ? body.tokenBudget : undefined,
      },
    );
  }, [sample, body]);

  const wake = useMemo(() => {
    const { edges } = bookWakeGraph(body);
    if (!focusedId) {
      return { inbound: [] as typeof edges, outbound: [] as typeof edges };
    }
    return {
      inbound: edges.filter((e) => e.to === focusedId),
      outbound: edges.filter((e) => e.from === focusedId),
    };
  }, [body, focusedId]);

  const titleOf = (id: string): string =>
    entries.find((e) => e.id === id)?.title?.trim() || id;

  const focusedVerdict = live?.verdicts.find((v) => v.entryId === focusedId) ?? null;
  const fired = live?.fired ?? [];

  return (
    <aside className={styles.rail} aria-label="Live tools">
      {/* ---- Live try (real engine) ---- */}
      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Try a line</b>
          <i>real activation</i>
        </div>
        <div className={styles.rbody}>
          <ExpandTextarea
            label="Sample chat line"
            className={styles.textarea}
            style={{ minHeight: "3.2rem" }}
            placeholder="Sample chat line…"
            value={sample}
            aria-label="Sample chat line for live activation"
            onChange={(ev) => setSample(ev.target.value)}
          />
          {!live && (
            <p className={styles.hint}>
              Runs the real matcher: keys, chance, recursion, timed, budget.
            </p>
          )}
          {live && (
            <>
              {focused && focusedVerdict && (
                <div
                  className={
                    focusedVerdict.fired ? styles.focusHit : styles.focusMiss
                  }
                >
                  <span className={styles.focusLbl}>This entry</span>
                  <strong>{focused.title || "(untitled)"}</strong>
                  <span>
                    {focusedVerdict.fired ? "fires" : "skips"} ·{" "}
                    {reasonPlain(focusedVerdict.reason)}
                    {focusedVerdict.loop > 0 ? ` · loop ${focusedVerdict.loop}` : ""}
                  </span>
                </div>
              )}
              <div className={styles.chip}>
                Fired {fired.length}
                {live.budget.limit != null
                  ? ` · budget ${live.budget.spent}/${live.budget.limit}`
                  : ""}
                {live.budget.cuts.length > 0
                  ? ` · ${live.budget.cuts.length} cut`
                  : ""}
                {live.loops > 0 ? ` · recursion loops ${live.loops}` : ""}
              </div>
              {fired.length > 0 && (
                <ul className={styles.matchList}>
                  {fired.slice(0, 8).map((v) => (
                    <li key={v.entryId} className={styles.matchHit}>
                      <button
                        type="button"
                        className={styles.linkish}
                        onClick={() => onSelectEntry?.(v.entryId)}
                      >
                        {titleOf(v.entryId)}
                      </button>
                      <span>
                        {" "}
                        · {reasonPlain(v.reason)}
                        {v.loop > 0 ? ` · L${v.loop}` : ""} · ~{v.tokenCost}t
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {fired.length === 0 && sample.trim() && (
                <p className={styles.hint}>Nothing fired on that line.</p>
              )}
            </>
          )}
          {onOpenRehearsal && (
            <button type="button" className={styles.texpBtn} onClick={onOpenRehearsal}>
              Open Rehearsal
            </button>
          )}
        </div>
      </div>

      {/* ---- Wake / recursion map for focused entry ---- */}
      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Wake map</b>
          <i>recursion</i>
        </div>
        <div className={styles.rbody}>
          {!focused && (
            <p className={styles.hint}>Pick an entry to see who wakes whom.</p>
          )}
          {focused && (
            <>
              <div className={styles.chipRow}>
                {focused.preventRecursion && (
                  <span className={styles.chip}>wakes nobody</span>
                )}
                {focused.excludeRecursion && (
                  <span className={styles.chip}>immune to wake</span>
                )}
                {focused.delayUntilRecursion > 0 && (
                  <span className={styles.chip}>
                    delay until L{focused.delayUntilRecursion}
                  </span>
                )}
                {!focused.preventRecursion &&
                  !focused.excludeRecursion &&
                  focused.delayUntilRecursion === 0 && (
                    <span className={styles.chip}>normal recursion</span>
                  )}
              </div>
              <div className={styles.wakeBlock}>
                <span className={styles.wakeLbl}>Wakes this entry</span>
                {wake.inbound.length === 0 ? (
                  <p className={styles.hint}>No other entry can wake it (chat keys only).</p>
                ) : (
                  <ul className={styles.matchList}>
                    {wake.inbound.map((e) => (
                      <li key={`${e.from}-${e.keyword}`} className={styles.matchHit}>
                        <button
                          type="button"
                          className={styles.linkish}
                          onClick={() => onSelectEntry?.(e.from)}
                        >
                          {titleOf(e.from)}
                        </button>
                        <span> · via &quot;{e.keyword}&quot;</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={styles.wakeBlock}>
                <span className={styles.wakeLbl}>This entry can wake</span>
                {focused.preventRecursion ? (
                  <p className={styles.hint}>Prevent recursion is on.</p>
                ) : wake.outbound.length === 0 ? (
                  <p className={styles.hint}>Does not appear in any other entry&apos;s keys.</p>
                ) : (
                  <ul className={styles.matchList}>
                    {wake.outbound.map((e) => (
                      <li key={`${e.to}-${e.keyword}`} className={styles.matchHit}>
                        <button
                          type="button"
                          className={styles.linkish}
                          onClick={() => onSelectEntry?.(e.to)}
                        >
                          {titleOf(e.to)}
                        </button>
                        <span> · via &quot;{e.keyword}&quot;</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Health ---- */}
      <div className={styles.rcard}>
        <div className={styles.rhead}>
          <b>Health</b>
          <i>quiet tips</i>
        </div>
        <div className={styles.rbody}>
          {notes.length === 0 && (
            <div className={styles.healthOk}>&#9679; This entry is ready.</div>
          )}
          {notes.slice(0, 4).map((h) => (
            <div
              key={h.code}
              className={h.level === "warn" ? styles.healthTip : styles.healthOk}
            >
              {h.level === "warn" ? <>&#9650; </> : <>&#9679; </>}
              {h.message}
            </div>
          ))}
          {onOpenHealth && (
            <button type="button" className={styles.texpBtn} onClick={onOpenHealth}>
              Open the full check
            </button>
          )}
          {onOpenChanges && (
            <button type="button" className={styles.texpBtn} onClick={onOpenChanges}>
              Open Changes
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
