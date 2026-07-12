/**
 * PreviewRail (P4) - the rail: LIVE PREVIEW (the REAL inject.ts output, engine truth - this
 * component receives the compiled XML, it never re-derives), the token line (the lore chars/4
 * convention), the linked-lorebook picker (knowledgeRefs, first slot), and the default-persona
 * star (a studio pref; the shelf badge reads the same pref).
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { PersonaBody } from "../../../../entities/persona/schema";
import { personaStyles as s } from "./persona-styles";

export interface PreviewRailProps {
  ctx: AppContext;
  body: PersonaBody;
  onBody: (fn: (b: PersonaBody) => PersonaBody) => void;
  xml: string;
  tokens: number;
  stopLabel: string;
  isDefault: boolean;
  onToggleDefault: () => void;
}

export function PreviewRail({
  ctx,
  body,
  onBody,
  xml,
  tokens,
  stopLabel,
  isDefault,
  onToggleDefault,
}: PreviewRailProps): JSX.Element {
  const [books, setBooks] = useState<StudioEntitySummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void ctx.api
      .listEntities("lorebook")
      .then((list) => {
        if (!cancelled) setBooks(list);
      })
      .catch(() => {
        /* the picker just stays empty */
      });
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  const linked = body.knowledgeRefs?.[0] ?? "";

  return (
    <>
      <div className={s.card}>
        <div className={s.chead}>
          <b className={s.cheadB}>Live preview</b>
          <span className={s.cheadKick}>the real compiler · @ {stopLabel.toLowerCase()}</span>
        </div>
        <pre className={s.xml}>{xml}</pre>
        <div className={s.tokens}>
          Tokens <b className={s.tokensN}>~{tokens}</b>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.chead}>
          <b className={s.cheadB}>Linked lorebook</b>
          <span className={s.cheadKick}>wakes with this persona</span>
        </div>
        <div className={s.loreRow}>
          <select
            className={s.loreSel}
            value={linked}
            aria-label="Linked lorebook"
            onChange={(e) =>
              onBody((b) => ({
                ...b,
                knowledgeRefs: e.target.value ? [e.target.value, ...(b.knowledgeRefs ?? []).slice(1)] : (b.knowledgeRefs ?? []).slice(1),
              }))
            }
          >
            <option value="">None</option>
            {books.map((bk) => (
              <option key={bk.id} value={bk.id}>
                {bk.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        className={isDefault ? `${s.defaultBtn} ${s.defaultOn}` : s.defaultBtn}
        aria-pressed={isDefault}
        onClick={onToggleDefault}
      >
        {isDefault ? "★ Default persona" : "☆ Set as default persona"}
      </button>
    </>
  );
}
