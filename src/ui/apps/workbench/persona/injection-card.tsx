/**
 * InjectionCard (P4) - "where your persona appears": the stops this lens can carry as pills
 * (injectionsForProfile - the position-picker law), a foreign already-set stop shown dashed
 * amber instead of vanishing, depth input where the stop takes one, role for ST's in-chat, and
 * RC's custom wrapper text.
 */
import type { JSX } from "react";
import type { PersonaBody } from "../../../../entities/persona/schema";
import { patchInjection } from "./session";
import { personaStyles as s } from "./persona-styles";

export interface InjectionCardProps {
  body: PersonaBody;
  onBody: (fn: (b: PersonaBody) => PersonaBody) => void;
  stops: readonly string[];
  labels: Record<string, { label: string; hint: string }>;
  showWrapper: boolean;
}

const DEPTH_STOPS = new Set(["depth", "in_chat"]);

export function InjectionCard({ body, onBody, stops, labels, showWrapper }: InjectionCardProps): JSX.Element {
  const current = body.chatInjection?.position ?? "character";
  const foreign = current && !stops.includes(current);

  return (
    <div className={s.card}>
      <div className={s.chead}>
        <b className={s.cheadB}>Prompt injection</b>
        <span className={s.cheadKick}>where your persona appears · stops this lens can carry</span>
      </div>
      <div className={s.cbody}>
        <div className={s.stops} role="group" aria-label="Where it is injected">
          {stops.map((stop) => {
            const on = current === stop;
            const meta = labels[stop] ?? { label: stop, hint: "" };
            return (
              <button
                key={stop}
                type="button"
                className={on ? `${s.stop} ${s.stopOn}` : s.stop}
                aria-pressed={on}
                onClick={() => onBody((b) => patchInjection(b, { position: stop }))}
              >
                <b className={s.stopB}>{meta.label}</b>
                <span className={s.stopHint}>{meta.hint}</span>
              </button>
            );
          })}
          {foreign && (
            <button type="button" className={`${s.stop} ${s.stopOn} ${s.stopForeign}`} aria-pressed disabled>
              <b className={s.stopB}>{labels[current]?.label ?? current}</b>
              <span className={s.stopHint}>set on another platform's lens - kept, not carried here</span>
            </button>
          )}
        </div>

        {DEPTH_STOPS.has(current) && (
          <div className={s.depthRow}>
            <span>at depth</span>
            <input
              className={s.depthIn}
              type="number"
              min={0}
              max={10}
              value={body.chatInjection?.depth ?? 2}
              aria-label="Injection depth"
              onChange={(e) => onBody((b) => patchInjection(b, { depth: Number(e.target.value) }))}
            />
            {current === "in_chat" && (
              <>
                <span>as</span>
                <select
                  className={s.depthIn}
                  style={{ width: "6.5rem" }}
                  value={body.chatInjection?.role ?? "system"}
                  aria-label="Injection role"
                  onChange={(e) =>
                    onBody((b) => patchInjection(b, { role: e.target.value as "system" | "user" | "assistant" }))
                  }
                >
                  <option value="system">system</option>
                  <option value="user">user</option>
                  <option value="assistant">assistant</option>
                </select>
              </>
            )}
          </div>
        )}

        {showWrapper && (
          <input
            className={s.wrapIn}
            value={body.chatInjection?.wrapper ?? ""}
            placeholder="Custom wrapper text (optional), e.g. This is {{user}}'s identity:"
            aria-label="Custom wrapper text"
            onChange={(e) => onBody((b) => patchInjection(b, { wrapper: e.target.value }))}
          />
        )}
      </div>
      <div className={s.finePrint}>
        Under a platform lens, stops that wire cannot carry disappear; a foreign stop already set
        shows dashed amber. Lenses with no injection wire hide this card.
      </div>
    </div>
  );
}
