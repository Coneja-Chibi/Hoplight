/**
 * The persona editor's cards (P4 v2): everything composes into the CHARACTER editor's bento
 * grammar - BentoCard tiles + the .lcard/.portrait face plate from editor-styles - per the
 * layout ruling that character and persona surfaces must feel like kin. This module owns the
 * card CONTENTS only; the grid arrangement lives in persona-editor.tsx.
 */
import { useMemo, useState, type JSX } from "react";
import type { PersonaBody } from "../../../../entities/persona/schema";
import type { PersonaWriteForProfile } from "../../../../core/persona";
import { platformOwnsField } from "../../../../core/persona";
import { BentoCard } from "../../../components/bento-card";
import { ExpandTextarea } from "../../../components/expand";
import { HOUSE_PALETTE, SwatchRow } from "../../../components/swatch-row";
import { PaletteControl } from "../controls/color-controls";
import { resolveCssColor } from "../../../_shared/css-color";
import es from "../editor-styles";
import { patchBody, patchIdentity, patchSections, toggleTrait } from "./session";
import s from "./persona.module.css";

type OnBody = (fn: (b: PersonaBody) => PersonaBody) => void;

/** Identity: tagline + pronouns/height/age + the BRIEF with its never-injected honesty line. */
export function IdentityCard({ body, onBody }: { body: PersonaBody; onBody: OnBody }): JSX.Element {
  const id = body.identity ?? {};
  return (
    <BentoCard title="Identity" filled={!!(id.tagline || id.pronouns || body.brief)}>
      <div className={es.bfield}>
        <span className={es.blabel}>Tagline</span>
        <input
          className={es.in}
          value={id.tagline ?? ""}
          placeholder="A brief tagline..."
          aria-label="Tagline"
          onChange={(e) => onBody((b) => patchIdentity(b, { tagline: e.target.value }))}
        />
      </div>
      <div className={es.bfield}>
        <span className={es.blabel}>Pronouns · Height · Age</span>
        <div className={s.idRow}>
          <input className={es.in} value={id.pronouns ?? ""} placeholder="pronouns" aria-label="Pronouns"
            onChange={(e) => onBody((b) => patchIdentity(b, { pronouns: e.target.value }))} />
          <input className={es.in} value={id.height ?? ""} placeholder="height" aria-label="Height"
            onChange={(e) => onBody((b) => patchIdentity(b, { height: e.target.value }))} />
          <input className={es.in} value={id.age ?? ""} placeholder="age" aria-label="Age"
            onChange={(e) => onBody((b) => patchIdentity(b, { age: e.target.value }))} />
        </div>
      </div>
      <div className={es.bfield}>
        <span className={es.blabel}>Brief</span>
        <ExpandTextarea
          label="Brief"
          className={`${es.in} ${es.ta}`}
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
      <ExpandTextarea
        label={title}
        className={`${es.in} ${es.ta}`}
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
      <ExpandTextarea
        label="Identity text"
        className={`${es.in} ${es.ta}`}
        style={{ minHeight: "5rem" }}
        value={body.content}
        placeholder="Who you are, in first person..."
        aria-label="Identity text"
        onChange={(e) => onBody((b) => patchBody(b, { content: e.target.value }))}
      />
    </BentoCard>
  );
}

/** Color palette on the SHARED controls (registry-first): SwatchRow is the signature slot (the
 *  house per-entity accent - resolved to real hex, signatureColor exports through codecs) and
 *  PaletteControl in two-field mode edits the labeled colors the compiler turns into tags. */
export function PaletteCard({ body, onBody }: { body: PersonaBody; onBody: OnBody }): JSX.Element {
  const colors = body.presentation?.colors ?? [];
  const sig = body.presentation?.signatureColor;
  const sigPalette = useMemo(() => HOUSE_PALETTE.map((c) => ({ ...c, hex: resolveCssColor(c.hex) })), []);
  return (
    <BentoCard title="Color Palette" filled={colors.length > 0 || !!sig}>
      <span className={s.honest}>signature themes this persona's cards · labeled colors go into the prompt</span>
      <SwatchRow
        palette={sigPalette}
        value={sig}
        allowCustom
        onChange={(hex) =>
          onBody((b) => ({ ...b, presentation: { ...(b.presentation ?? {}), signatureColor: hex } }))
        }
      />
      <PaletteControl
        value={colors}
        styles={es}
        twoField={{ label: "Slot this color fills (Hair, Eyes, Skin...)", name: "The color's name (chestnut, storm gray...)" }}
        onChange={(rows) =>
          onBody((b) => ({ ...b, presentation: { ...(b.presentation ?? {}), colors: rows } }))
        }
      />
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
