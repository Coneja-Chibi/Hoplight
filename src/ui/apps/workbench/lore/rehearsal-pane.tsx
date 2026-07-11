/**
 * Rehearsal companion: Try lines with real scanBook verdicts (vs-lore-rehearsal).
 * Canned stand-in replies only - never a model call.
 */
import { useMemo, useState, type FormEvent, type JSX } from "react";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import {
  scanBook,
  type FireReason,
  type ScanLine,
  type SkipReason,
  type TimedState,
} from "../../../../core/lore";
import { PlaybackTab } from "./playback-tab";
import styles from "./rehearsal-pane.module.css";

const CANNED = [
  "The air stills for a beat.",
  "A distant bell marks the hour.",
  "They wait for your next move.",
  "Nothing answers but the wind.",
];

export interface RehearsalPaneProps {
  body: LorebookBody;
  onClose: () => void;
  onJumpEntry: (id: string) => void;
}

const emptyTimed = (): TimedState => ({ stickyLeft: {}, cooldownLeft: {}, turn: 0 });

function reasonText(r: FireReason | SkipReason): string {
  switch (r.kind) {
    case "constant":
      return "always on";
    case "key":
      return `matched "${r.keyword}"${r.wholeWord ? " (whole word)" : ""}`;
    case "recursion":
      return `woken by another entry via "${r.keyword}"`;
    case "sticky":
      return `sticky, ${r.remaining} left`;
    case "disabled":
      return "off";
    case "no-key-match":
      return "no key hit";
    case "secondary-logic":
      return `secondary keys failed (${r.logic})`;
    case "chance":
      return `the ${r.needed}% chance rolled ${Math.round(r.rolled)}`;
    case "cooldown":
      return `cooling down, ${r.remaining} left`;
    case "delay":
      return `waits for ${r.needs} messages (have ${r.have})`;
    case "budget-cut":
      return `cut by budget (would cost ${r.wouldCost}, ${r.left} left)`;
    case "vectorized":
      return "by meaning only (not key-scanned)";
    case "exclude-recursion":
      return "cannot be woken by recursion";
    case "delay-until-recursion":
      return `waits for recursion level ${r.needs}`;
    case "empty-keys":
      return "no keys";
    default:
      return "skipped";
  }
}

export function RehearsalPane({ body, onClose, onJumpEntry }: RehearsalPaneProps): JSX.Element {
  const [tab, setTab] = useState<"try" | "playback">("try");
  const [chat, setChat] = useState<ScanLine[]>([]);
  const [input, setInput] = useState("");
  const [turnState, setTurnState] = useState<TimedState>(emptyTimed);
  const [cannedAt, setCannedAt] = useState(0);
  const [last, setLast] = useState<ReturnType<typeof scanBook> | null>(null);

  const budgetLine = useMemo(() => {
    if (!last?.budget.limit) return null;
    return `${last.budget.spent} / ${last.budget.limit} tokens used`;
  }, [last]);

  const say = (text: string): void => {
    const user: ScanLine = { text, role: "user" };
    const window = [...chat, user];
    const result = scanBook(body, window, {
      chanceMode: "roll",
      rng: () => 0.25,
      turnState,
      tokenBudget: body.tokenBudget > 0 ? body.tokenBudget : undefined,
    });
    const reply = CANNED[cannedAt % CANNED.length]!;
    setCannedAt((n) => n + 1);
    setChat([...window, { text: reply, role: "assistant" }]);
    setTurnState(result.nextTurnState);
    setLast(result);
  };

  const onSubmit = (ev: FormEvent): void => {
    ev.preventDefault();
    const t = input.trim();
    if (!t) return;
    say(t);
    setInput("");
  };

  const fired = last?.fired ?? [];
  const skipped = (last?.verdicts ?? []).filter((v) => !v.fired && v.reason.kind !== "disabled");

  return (
    <aside className={styles.pane} aria-label="Rehearsal">
      <div className={styles.head}>
        <b>Rehearsal</b>
        <i>try lines · real rules</i>
        <button type="button" className={styles.x} aria-label="Close rehearsal" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Rehearsal mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "try"}
          className={tab === "try" ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          onClick={() => setTab("try")}
        >
          Try lines
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "playback"}
          className={tab === "playback" ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          onClick={() => setTab("playback")}
        >
          Playback
        </button>
      </div>

      {tab === "playback" ? (
        <PlaybackTab body={body} onJumpEntry={onJumpEntry} />
      ) : (
        <>
          <div className={styles.chat}>
            {chat.length === 0 && (
              <p className={styles.empty}>Type a line to see what would fire.</p>
            )}
            {chat.map((m, i) => (
              <div key={i} className={m.role === "user" ? styles.user : styles.bot}>
                {m.text}
              </div>
            ))}
          </div>

          <form className={styles.composer} onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
              placeholder="Type something to test…"
              aria-label="Rehearsal line"
            />
            <button type="submit" disabled={!input.trim()}>
              Say
            </button>
          </form>

          {last && (
            <div className={styles.results}>
              <div className={styles.rhead}>Fired ({fired.length})</div>
              {fired.length === 0 && <p className={styles.empty}>Nothing fired.</p>}
              {fired.map((v) => {
                const title = body.entries.find((e) => e.id === v.entryId)?.title || v.entryId;
                return (
                  <button
                    key={v.entryId}
                    type="button"
                    className={styles.hit}
                    onClick={() => onJumpEntry(v.entryId)}
                  >
                    <b>{title}</b>
                    <span>
                      {reasonText(v.reason)} · ~{v.tokenCost}t
                    </span>
                  </button>
                );
              })}
              {budgetLine && <p className={styles.budget}>{budgetLine}</p>}
              {last.budget.cuts.length > 0 && (
                <details className={styles.cuts}>
                  <summary>Cut by budget ({last.budget.cuts.length})</summary>
                  {last.budget.cuts.map((c) => (
                    <div key={c.entryId}>{reasonText(c.reason)}</div>
                  ))}
                </details>
              )}
              <details className={styles.miss}>
                <summary>Didn&apos;t fire ({skipped.length})</summary>
                {skipped.map((v) => {
                  const title = body.entries.find((e) => e.id === v.entryId)?.title || v.entryId;
                  return (
                    <button
                      key={v.entryId}
                      type="button"
                      className={styles.skip}
                      onClick={() => onJumpEntry(v.entryId)}
                    >
                      <b>{title}</b>
                      <span>{reasonText(v.reason)}</span>
                    </button>
                  );
                })}
              </details>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
