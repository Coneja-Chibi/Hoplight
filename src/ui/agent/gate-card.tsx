/**
 * The Gate, in a browser.
 *
 * THE THING THAT MAKES TOOLS ALLOWABLE. Kit has had this for a long time as a terminal prompt; the
 * window had no counterpart, which is why it shipped with no tools at all. Every write the agent
 * proposes stops here and waits for a person. While this card is up, a dispatch loop on the server
 * is genuinely parked on a promise this card resolves.
 *
 * IT SHOWS THE WARNINGS, NOT A COUNT OF THEM. A number with no words is decoration on a decision
 * somebody is being asked to make. If a change replaces three blocks, that sentence is the whole
 * reason to say no, and hiding it behind "3 warnings" makes the card look careful while being
 * useless.
 *
 * EVERY ANSWER KIT UNDERSTANDS IS OFFERED, including `hold` - "I want to know more first" is a real
 * position and is not the same as no. Closing the card without choosing is not one of them: the
 * only ways out are answers, because a gate you can dismiss is a gate that gets dismissed.
 */
import type { JSX } from "react";

/** The gate frame as it arrives. Read defensively: it crossed a wire. */
export interface GateView {
  readonly id: string;
  readonly name?: string;
  readonly verdict?: { readonly level?: string; readonly why?: string };
  readonly peek?: { readonly title?: string; readonly lines?: readonly string[] };
  readonly review?: {
    readonly title?: string;
    readonly warnings?: readonly string[];
    readonly lines?: readonly string[];
  };
  readonly crossing?: { readonly lines?: readonly string[] };
}

export type GateAnswerChoice =
  | { type: "allow-once" }
  | { type: "allow-session" }
  | { type: "deny" }
  | { type: "hold" }
  | { type: "abort" };

const asLines = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((l): l is string => typeof l === "string") : [];

export function GateCard({
  request,
  busy,
  onAnswer,
}: {
  request: GateView | null;
  /** An answer is in flight; the buttons disable rather than queueing a second one. */
  busy?: boolean;
  onAnswer: (choice: GateAnswerChoice) => void;
}): JSX.Element | null {
  if (!request) return null;

  const warnings = asLines(request.review?.warnings);
  const detail = [
    ...asLines(request.review?.lines),
    ...asLines(request.crossing?.lines),
    ...asLines(request.peek?.lines),
  ];
  const title = request.review?.title ?? request.peek?.title ?? request.name ?? "a change";

  return (
    <section className="gate-card" role="alertdialog" aria-labelledby="gate-card-title">
      <p className="gate-card__kick">
        {/* The tool's real name. Somebody deciding about a write deserves to know what is writing. */}
        {request.name ? `${request.name} · ` : ""}
        {request.verdict?.level ?? "review"}
      </p>
      <strong id="gate-card__title" className="gate-card__title">{title}</strong>
      {request.verdict?.why && <p className="gate-card__why">{request.verdict.why}</p>}

      {warnings.length > 0 && (
        <ul className="gate-card__warnings">
          {/* In full, and above the detail. These are the reasons to say no. */}
          {warnings.map((w, i) => <li key={`w${String(i)}`}>{w}</li>)}
        </ul>
      )}

      {detail.length > 0 && (
        <pre className="gate-card__detail">{detail.join("\n")}</pre>
      )}

      <div className="gate-card__row">
        <button
          type="button"
          className="gate-card__yes"
          disabled={busy}
          onClick={() => { onAnswer({ type: "allow-once" }); }}
        >
          {"Allow once"}
        </button>
        <button type="button" disabled={busy} onClick={() => { onAnswer({ type: "allow-session" }); }}>
          {"Allow for this session"}
        </button>
        <button type="button" disabled={busy} onClick={() => { onAnswer({ type: "deny" }); }}>
          {"No"}
        </button>
        {/* Not a synonym for no: it stops the call and leaves the subject open to ask about. */}
        <button type="button" disabled={busy} onClick={() => { onAnswer({ type: "hold" }); }}>
          {"Wait, tell me more"}
        </button>
        <button
          type="button"
          className="gate-card__abort"
          disabled={busy}
          onClick={() => { onAnswer({ type: "abort" }); }}
        >
          {"Stop the whole turn"}
        </button>
      </div>
    </section>
  );
}
