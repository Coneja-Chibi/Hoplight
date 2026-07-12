/**
 * The persona editor's cards (P4 v2): everything composes into the CHARACTER editor's bento
 * grammar - BentoCard tiles + the .lcard/.portrait face plate from editor-styles - per the
 * layout ruling that character and persona surfaces must feel like kin. This module owns the
 * card CONTENTS only; the grid arrangement lives in persona-editor.tsx.
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { PersonaBody } from "../../../../entities/persona/schema";
import type { PersonaWriteForProfile } from "../../../../core/persona";
import { platformOwnsField } from "../../../../core/persona";
import { BentoCard } from "../../../components/bento-card";
import es from "../editor-styles";
import { patchBody, patchIdentity, patchSections, patchSwatch, toggleTrait } from "./session";
import s from "./persona.module.css";

type OnBody = (fn: (b: PersonaBody) => PersonaBody) => void;

/** The left face plate: the character editor's .lcard/.portrait grammar, persona-simple. */
export function FaceCard({
  body,
  portraitUrl,
  tokens,
}: {
  body: PersonaBody;
  portraitUrl: string | null;
  tokens: number;
}): JSX.Element {
  return (
    <div className={es.lcard}>
      <div className={es.portrait} title="The portrait rides import for now; in-editor upload lands with the media slice">
        {portraitUrl ? (
          <img src={portraitUrl} alt={body.name || "persona portrait"} />
        ) : (
          <span className={s.faceHint}>portrait via import</span>
        )}
      </div>
      <div className={s.faceName}>{body.name || "Untitled persona"}</div>
      <div className={s.faceMeta}>persona · ~{tokens} tokens</div>
    </div>
  );
}

/** Identity: tagline + pronouns/height/age + the BRIEF with its never-injected honesty line. */
export function IdentityCard({ body, onBody }: { body: PersonaBody; onBody: OnBody }): JSX.Element {
  const id = body.identity ?? {};
  return (
    <BentoCard title="Identity" filled={!!(id.tagline || id.pronouns || body.brief)}>
      <div className={es.bfield}>
        <span className={es.blabel}>Tagline</span>
        <input
          className={s.fIn}
          value={id.tagline ?? ""}
          placeholder="A brief tagline..."
          aria-label="Tagline"
          onChange={(e) => onBody((b) => patchIdentity(b, { tagline: e.target.value }))}
        />
      </div>
      <div className={es.bfield}>
        <span className={es.blabel}>Pronouns · Height · Age</span>
        <div className={s.idRow}>
          <input className={s.fIn} value={id.pronouns ?? ""} placeholder="pronouns" aria-label="Pronouns"
            onChange={(e) => onBody((b) => patchIdentity(b, { pronouns: e.target.value }))} />
          <input className={s.fIn} value={id.height ?? ""} placeholder="height" aria-label="Height"
            onChange={(e) => onBody((b) => patchIdentity(b, { height: e.target.value }))} />
          <input className={s.fIn} value={id.age ?? ""} placeholder="age" aria-label="Age"
            onChange={(e) => onBody((b) => patchIdentity(b, { age: e.target.value }))} />
        </div>
      </div>
      <div className={es.bfield}>
        <span className={es.blabel}>Brief</span>
        <textarea
          className={s.fTa}
          style={{ minHeight: "2.4rem" }}
          value={body.brief ?? ""}
          placeholder="Library card blurb..."
          aria-label="Brief (library blurb)"
          onChange={(e) => onBody((b) => patchBody(b, { brief: e.target.value }))}
        />
        <span className={s.honest}>the blurb stays on the shelf · never sent to the model</span>
      </div>
    </BentoCard>
  );
}

/** One canonical text section as a bento tile; Personality also carries the trait chips. */
export function SectionCard({
  body,
  onBody,
  writeFor,
  sectionKey,
  title,
  placeholder,
}: {
  body: PersonaBody;
  onBody: OnBody;
  writeFor: PersonaWriteForProfile;
  sectionKey: "appearance" | "body" | "personality" | "quirks" | "history";
  title: string;
  placeholder: string;
}): JSX.Element | null {
  const [newTrait, setNewTrait] = useState("");
  if (!platformOwnsField(writeFor, "sections")) return null;
  const value = (body.sections ?? {})[sectionKey] ?? "";
  const traits = sectionKey === "personality" && platformOwnsField(writeFor, "traits");

  const addTrait = (): void => {
    const t = newTrait.trim();
    if (!t) return;
    onBody((b) => toggleTrait(b, t));
    setNewTrait("");
  };

  return (
    <BentoCard title={title} filled={value.trim() !== ""}>
      <textarea
        className={s.fTa}
        value={value}
        placeholder={placeholder}
        aria-label={title}
        onChange={(e) => onBody((b) => patchSections(b, { [sectionKey]: e.target.value }))}
      />
      {traits && (
        <div className={s.traits}>
          {(body.traits ?? []).map((t) => (
            <button key={t} type="button" className={s.trait} title="Remove this trait"
              onClick={() => onBody((b) => toggleTrait(b, t))}>
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
    </BentoCard>
  );
}

/** The flat identity text (the whole persona on section-less platforms). */
export function ContentCard({
  body,
  onBody,
  writeFor,
}: {
  body: PersonaBody;
  onBody: OnBody;
  writeFor: PersonaWriteForProfile;
}): JSX.Element {
  const sectioned = platformOwnsField(writeFor, "sections");
  return (
    <BentoCard title="Identity Text" filled={body.content.trim() !== ""}>
      <span className={s.honest}>
        {sectioned ? "flat text · used when the sections are empty" : "the whole persona on this platform"}
      </span>
      <textarea
        className={s.fTa}
        style={{ minHeight: "5rem" }}
        value={body.content}
        placeholder="Who you are, in first person..."
        aria-label="Identity text"
        onChange={(e) => onBody((b) => patchBody(b, { content: e.target.value }))}
      />
    </BentoCard>
  );
}

/** Color palette: signature slot + labeled swatches (compiled into the prompt as labeled tags). */
export function PaletteCard({ body, onBody }: { body: PersonaBody; onBody: OnBody }): JSX.Element {
  const colors = body.presentation?.colors ?? [];
  const sig = body.presentation?.signatureColor;
  const FOG_HEX = "#8a8496"; // hardcode-ok: color inputs take literal hex only (deck-fog value)
  return (
    <BentoCard title="Color Palette" filled={colors.length > 0 || !!sig}>
      <div className={s.pal}>
        <span className={s.sw} title="The signature color themes this persona's cards">
          <input type="color" className={s.dot} value={sig || FOG_HEX} aria-label="Signature color"
            onChange={(e) =>
              onBody((b) => ({ ...b, presentation: { ...(b.presentation ?? {}), signatureColor: e.target.value } }))
            } />
          <span className={`${s.swLabel} ${s.swSig}`}>Signature</span>
        </span>
        {colors.map((c, i) => (
          <span className={s.sw} key={i}>
            <input type="color" className={s.dot} value={c.hex} aria-label={`${c.label ?? "color"} swatch`}
              onChange={(e) => onBody((b) => patchSwatch(b, i, { ...c, hex: e.target.value }))} />
            <input className={s.swName} value={c.name ?? ""} placeholder="name" aria-label="Color name"
              onChange={(e) => onBody((b) => patchSwatch(b, i, { ...c, name: e.target.value }))} />
            <input className={s.swLabel} value={c.label ?? ""} placeholder="label" aria-label="Color label"
              onChange={(e) => onBody((b) => patchSwatch(b, i, { ...c, label: e.target.value }))} />
          </span>
        ))}
        <button type="button" className={s.sw} title="Add a labeled color"
          onClick={() => onBody((b) => patchSwatch(b, colors.length, { label: "", name: "", hex: FOG_HEX }))}>
          <span className={`${s.dot} ${s.dotAdd}`}>+</span>
          <span className={s.swLabel}>Add</span>
        </button>
      </div>
    </BentoCard>
  );
}

/** Live preview: the REAL compiler's output + the shared token convention. */
export function PreviewCard({ xml, tokens, stopLabel }: { xml: string; tokens: number; stopLabel: string }): JSX.Element {
  return (
    <BentoCard title="Live Preview" filled>
      <span className={s.honest}>the real compiler · @ {stopLabel.toLowerCase()}</span>
      <pre className={s.xml}>{xml}</pre>
      <div className={s.tokens}>
        Tokens <b className={s.tokensN}>~{tokens}</b>
      </div>
    </BentoCard>
  );
}

/** Linked lorebook (knowledgeRefs, first slot) - wakes with this persona. */
export function LorebookCard({ ctx, body, onBody }: { ctx: AppContext; body: PersonaBody; onBody: OnBody }): JSX.Element {
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
    <BentoCard title="Linked Lorebook" filled={linked !== ""}>
      <span className={s.honest}>wakes with this persona</span>
      <select
        className={s.loreSel}
        value={linked}
        aria-label="Linked lorebook"
        onChange={(e) =>
          onBody((b) => ({
            ...b,
            knowledgeRefs: e.target.value
              ? [e.target.value, ...(b.knowledgeRefs ?? []).slice(1)]
              : (b.knowledgeRefs ?? []).slice(1),
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
    </BentoCard>
  );
}
