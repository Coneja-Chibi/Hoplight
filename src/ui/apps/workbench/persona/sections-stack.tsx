/**
 * SectionsStack (P4) - the RC section editors: one card per canonical section (the fixed five;
 * "body" is authored separately but folds into appearance at compile time - the compiler's RC
 * rule), trait chips inside Personality, and the flat-content card for personas authored without
 * structure. Custom user-named sections are a stated deviation: the canonical schema carries the
 * fixed five (like RC's PersonaDetails), so "+ Add section" is not shipped - the wireframe's
 * button awaits a schema decision.
 */
import { useState, type JSX } from "react";
import type { PersonaBody } from "../../../../entities/persona/schema";
import type { PersonaWriteForProfile } from "../../../../core/persona";
import { platformOwnsField } from "../../../../core/persona";
import { patchBody, patchSections, toggleTrait } from "./session";
import { personaStyles as s } from "./persona-styles";

const SECTION_META: ReadonlyArray<{ key: "appearance" | "body" | "personality" | "quirks" | "history"; title: string; hint: string; placeholder: string }> = [
  { key: "appearance", title: "Appearance", hint: "what they look like", placeholder: "Build, features, style..." },
  { key: "body", title: "Body", hint: "folds into appearance in the prompt", placeholder: "Physical details..." },
  { key: "personality", title: "Personality", hint: "demeanor + trait chips", placeholder: "How they act, their demeanor..." },
  { key: "quirks", title: "Quirks", hint: "habits, mannerisms, speech", placeholder: "Habits, mannerisms..." },
  { key: "history", title: "History", hint: "background, origins", placeholder: "Background, origins..." },
];

export interface SectionsStackProps {
  body: PersonaBody;
  onBody: (fn: (b: PersonaBody) => PersonaBody) => void;
  writeFor: PersonaWriteForProfile;
}

export function SectionsStack({ body, onBody, writeFor }: SectionsStackProps): JSX.Element {
  const [newTrait, setNewTrait] = useState("");
  const sections = body.sections ?? {};
  const showSections = platformOwnsField(writeFor, "sections");
  const showTraits = platformOwnsField(writeFor, "traits");

  const addTrait = (): void => {
    const t = newTrait.trim();
    if (!t) return;
    onBody((b) => toggleTrait(b, t));
    setNewTrait("");
  };

  return (
    <>
      {showSections &&
        SECTION_META.map((m) => (
          <div className={s.card} key={m.key}>
            <div className={s.chead}>
              <b className={s.cheadB}>{m.title}</b>
              <span className={s.cheadKick}>{m.hint}</span>
            </div>
            <div className={s.cbody}>
              <textarea
                className={s.secTa}
                value={sections[m.key] ?? ""}
                placeholder={m.placeholder}
                aria-label={m.title}
                onChange={(e) => onBody((b) => patchSections(b, { [m.key]: e.target.value }))}
              />
              {m.key === "personality" && showTraits && (
                <div className={s.traits}>
                  {(body.traits ?? []).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={s.trait}
                      title="Remove this trait"
                      onClick={() => onBody((b) => toggleTrait(b, t))}
                    >
                      {t} &#215;
                    </button>
                  ))}
                  <input
                    className={s.traitAdd}
                    value={newTrait}
                    placeholder="+ add trait"
                    aria-label="Add a trait"
                    onChange={(e) => setNewTrait(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTrait();
                    }}
                    onBlur={addTrait}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

      <div className={s.card}>
        <div className={s.chead}>
          <b className={s.cheadB}>Identity text</b>
          <span className={s.cheadKick}>
            {showSections
              ? "flat text - used when the sections above are empty"
              : "the whole persona on this platform"}
          </span>
        </div>
        <div className={s.cbody}>
          <textarea
            className={s.secTa}
            style={{ minHeight: "5rem" }}
            value={body.content}
            placeholder="Who you are, in first person..."
            aria-label="Identity text"
            onChange={(e) => onBody((b) => patchBody(b, { content: e.target.value }))}
          />
        </div>
      </div>
    </>
  );
}
